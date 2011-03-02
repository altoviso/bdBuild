// 
// Program Design
// 
// 1. Read the core program configuration (at ./config) that specifies the where to find the AMD loader and configuration for that loader.
// 2. Load and initialize the AMD loader; the remaider of the program is implemented as a set of AMD modules that are executed by the AMD loader.
// 3. Process the command line and then process the build control script(s) as specified by the command line.
// 4. Discover all resources as instructed by the build control script
// 5. Move the resources through an ordered set of gates. Zero to many synchronous and/or asynchronous transforms may be applied to various 
//    resources as specified by the build control script. Different resources can be subject to different transforms. Resources are allowed
//    to move through gates without stopping until a "synchronized" gate is encountered. All transforms must complete for the previous gate before
//    any transform is allowed on the synchronized gate.
// 6. After the last gate has been completed, print a done message and terminate.
// 
// See also:
// 
// project home: http://bdframework.org/bdBuild/index
// fossil: http://bdframework.org/bdBuild/repo
// github: https://github.com/altoviso/bdBuild
// docs: http://bdframework.org/bdBuild/docs
// 

var
  // configuration info for the build program
  config= require("./config"),

  // load and configure the AMD loader
  loader= require(config.amdLoader).boot(config.amdLoaderConfig);

// publish several modules to the AMD loader so that AMD modules have access to them
// config and loader have already been defined by the node loader
// we also need access to the fs module to read/write resources and a sync console function is nice for debugging
define("config", [], config);
define("loader", [], loader);
define("fs", [], require("fs"));
define("util", [], require("util"));
loader.require(["util", "bdBuild/stringify"], function(util, stringify) {
  global.debug= function(item) {
    util.debug(stringify(item).result);
  };
});

// use the AMD loader to load the rest of the bdBuild program and then execute the process as described above
loader.require(["bdBuild/buildControl"], function(bc) {
  var
    transforms= bc.transforms,
    transformJobs= bc.transformJobs,
    transformJobsLength= transformJobs.length,

    // all discovered resources
    resources= [],

    reportError= function(resource, err) {
      bc.logError("error while transforming resource: " + resource.src + "\ntransform: " + resource.jobPos + "\n" + err);
      resource.error= true;
    },

    returnFromAsyncProc= function(resource, err) {
      bc.waiting--;
      if (err) {
        // notice reportError can decide to continue or panic
        reportError(resource, err);
      }
      advance(resource, true);
    },

    advance= function(resource, continuingSameGate) {
      if (resource.error) {
        return;
      }
      if (!continuingSameGate) {
        // first time trying to advance through the current gate
        bc.waiting++;
      }
        
      // apply all transforms with a gateId <= the current gate for resource that have not yet been applied
      var err, nextJobPos, candidate;
      while (1) {
        nextJobPos= resource.jobPos + 1,
        candidate= nextJobPos<resource.job.length && resource.job[nextJobPos];
        // candidate (if any) is a [transformProc, gateId] pair
        if (candidate && candidate[1]<=bc.currentGate) {
          resource.jobPos++;
          bc.waiting++;     
          err= candidate[0](resource, returnFromAsyncProc);
          if (err===returnFromAsyncProc) {
            // the transform proc must call returnFromAsyncProc when complete
            return;
          }
          bc.waiting--;     
          if (err) {
            // notice we reportError can decide to continue or panic
            reportError(resource, err);
            // if reportError didn't panic, then this break will cause this resource to clear the next
            // gate; when all resources have cleared the next gate, passGate will notice error count and
            // quit
            break;
          }
        } else {
          break;
        }
      }

      // got through the gate; advise passGate which will decrement the lock we set at top of this function
      passGate();
    },

    advanceGate= function(currentGate, log) {
      while (1) {
        bc.currentGate= ++currentGate;
        log && bc.log(bc.gates[bc.currentGate][2] + "...");
        if (currentGate==bc.gates.length-1 || bc.gates[currentGate+1][0]) {
          // if we've either advanced to the last gate or the next gate is a synchronized gate, then hold at the current gate
          return;
        }
      }
    },

    passGate= function() {
      if (--bc.waiting) {
        return;
      } //  else all processes have passed through bc.currentGate

      // hold then next gate until all resources have been advised
      advanceGate(bc.currentGate, true);
      if (bc.currentGate!=bc.gates.length-1) {
        bc.waiting++;
        resources.forEach(function(resource){ advance(resource, 0); });
        // release the hold placed above
        passGate();
      } else if (bc.errorCount) {
        bc.log("Errors detected, stopped build before completing.");
      } else {
        bc.log("Total build time: " + ((new Date()).getTime() - bc.startTimestamp.getTime()) / 1000 + " seconds");
        // that's all, folks...
      }
    };

  bc.start= function(resource) {
    // check for collisions
    var
      src= resource.src,
      dest= resource.dest;
    if (bc.resourcesByDest[src]) {
      // a dest is scheduled to overwrite a source
      bc.logError(src + " will be overwritten by " + bc.resources.byDest[src].src);
      return;
    }
    if (bc.resourcesByDest[dest]) {
      // multiple srcs scheduled to write into a single dest
      bc.logError(src + " and " + bc.resourcesByDest[dest].src + " are both attempting to write into " + dest);
      return;
    }
    
    // remember the resources in the global maps
    bc.resources[resource.src]= resource;
    bc.resourcesByDest[resource.dest]= resource;
    resource.pqn && (bc.amdResources[resource.pqn]= resource);

    // find the transformJob and start it...
    for (var i= 0; i<transformJobsLength; i++) {
      if (transformJobs[i][0](resource, bc)) {
        // job gives a vector of functions to apply to the resource
        // jobPos says the index in the job vector that has been applied
        resources.push(resource);
        resource.job= transformJobs[i][1];
        resource.jobPos= -1;
        advance(resource);
        return;
      }
    }
    bc.logWarn("Resource (" + resource.srcName + ") was discovered, but there is no transform job specified.");    
  };

  if (!bc.errorCount && !bc.check) {
    var
      transformNames= [], 
      pluginNames= [], 
      deps= [];
    bc.discoveryProcs.forEach(function(mid) { deps.push(mid); });
    for (var p in bc.transforms) {
      // each item is a [AMD-MID, gateId] pair
      transformNames.push(p);
      deps.push(bc.transforms[p][0]);
    }
    for (p in bc.plugins) {
      pluginNames.push(p);
      deps.push(bc.plugins[p]);
    }
    bc.plugins= {};
    loader.require(deps, function() {
      // pull out the discovery procedures
      for (var discoveryProcs= [], argsPos= 0; argsPos<bc.discoveryProcs.length; discoveryProcs.push(arguments[argsPos++]));
      
      // replace the transformIds in the transformJobs with the actual transform procs; similarly for plugins
      for (var id, proc, i=0; i<transformNames.length;) {
        id= transformNames[i++];
        proc= arguments[argsPos++];
        // replace every occurence of id with proc
        transformJobs.forEach(function(item) {
          // item is a [predicate, vector of [transformId, gateId] pairs] pairs
          for (var transforms=item[1], i= 0; i<transforms.length; i++) {
            if (transforms[i][0]==id) {
              transforms[i][0]= proc;
              break;
            }
          }
        });
      }
      for (i=0; i<pluginNames.length;) {
        bc.plugins[bc.getSrcModuleInfo(pluginNames[i++]).pqn]= arguments[argsPos++];
      }

      // start the transform engine: initialize bc.currentGate and bc.waiting, then discover and start each resource.
      // Hold the gate to "parse" at least until discovery procs return.
      // note: discovery procs will call bc.start with each discovered resource, which will call advance, which will
      // enter each resource in a race to the next gate, which will result in many bc.waiting incs/decs
      bc.waiting= 1;
      bc.log("discovering resources...");
      advanceGate(-1, false);
      discoveryProcs.forEach(function(proc) { proc(); });
      if (!resources.length) {
        bc.logWarn("failed to discover any resources to transform. Nothing to do; terminating application");
        process.exit(0);
      }
      for (i= 0; i<=bc.currentGate; i++) {
        bc.log(bc.gates[i][2] + "...");
      }
      // release the gate lock set above
      passGate();
    });
  };
});
