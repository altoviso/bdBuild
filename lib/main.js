// 
// Global Design
// 
// 1. Read the core program configuration (at ./config) that specifies the where to find the AMD loader and configuration for that loader.
// 2. Process the command line; this may change or edit the configuration in [1].
// 3. Loader and initialize the AMD loader.
// 4. Process the build control script(s) as specified by the command line.
// 5. Discover all resources as instructed by the build control script
// 6. Move the resources through an ordered set of gates. Zero to many synchronous and/or asynchronous transforms may be applied to various 
//    transforms as specified by the build control script. Different resources can be subject to different transforms. Resources are allowed
//    to move from the "read" through the "ast" gates without waiting for other resources. But, starting with the "ast" gate, all resources 
//    must finish each gate before any resource may proceed to the next gate. See bdBuild/gates for a list of the gates and their order.
// 7. After the last gate has been completed, print a done message and terminate.
// 
// The program can handle asynchronous and/or synchronous transforms.
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

  // parse the command line; maybe results in editing config
  args= require("./processCommandLine"),

  // load and configure the AMD loader
  loader= require(args.amdLoader || config.amdLoader).boot(args.amdLoaderConfig || config.amdLoaderConfig);

// publish several modules to the AMD loader so that AMD modules have access to them
// config, args, and loader have already been defined by the node loader
// obviously, we need access to the fs module to read/write resources
define("config", [], config);
define("args", [], args);
define("loader", [], loader);
define("fs", [], require("fs"));

// use the AMD loader to load the rest of the bdBuild program and then execute the process as described above
loader.require(["bdBuild/buildControl", "bdBuild/discover", "bdBuild/gates"], function(bc, discover, gates) {
  var
    transforms= bc.transforms,
    transformJobsMap= bc.transformJobsMap,
    transformJobsMapLength= transformJobsMap.length,

    gate= gates.gate,
    gateName= gates.gateName,
    gateMessage= gates.gateMessage,
    lastGateId= gates.lastGateId,

    // all discovered resources
    resources= [],

    reportError= function(resource, err) {
      bc.logError("error file transforming resource: " + resource.src);
      bc.logError("transform: " + resource.jobPos);
      bc.logError(err);
      throw err;
    },

    // a unique object used to signal a transform is an async function
    asyncReturn= {},

    advance= function(resource, continuingSameGate) {
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
          err= candidate[0](resource, bc, asyncReturn);
          if (err===asyncReturn) {
            // the transform proc must call bc.returnFromAsyncProc when complete
            return;
          }
          if (err) {
            // notice we reportError can decide to continue or panic
            reportError(resource, error);
          }
          bc.waiting--;     
        } else {
          break;
        }
      }

      // got through the gate; advise passGate which will decrement the lock we set at top of this function
      passGate();
    },

    passGate= function() {
      if (--bc.waiting) {
        return;
      } //  else all processes have passed through bc.currentGate

      // hold then next gate until all resources have been advised
      bc.currentGate++;
      bc.log(gateMessage[bc.currentGate]);
      if (bc.currentGate!=lastGateId) {
        bc.waiting++;
        resources.forEach(advance);
        // release the hold placed above
        passGate();
      } else {
        bc.log("Total build time: " + ((new Date()).getTime() - bc.startTimestamp.getTime()) / 1000 + " seconds");
        // that's all, folks...
      }
    };

  bc.start= function(resource) {
    // find the transformJob and start it...
    for (var i= 0; i<transformJobsMapLength; i++) {
      if (transformJobsMap[i][0](resource.src)) {
        // job gives a vector of functions to apply to the resource
        // jobPos says the index in the job vector that has been applied
        resources.push(resource);
        resource.job= transformJobsMap[i][1];
        resource.jobPos= -1;
        advance(resource);
        return;
      }
    }
    bc.logWarn("Resource (" + resource.srcName + ") was discovered, but there is no transform job specified.");    
  };

  bc.returnFromAsyncProc= function(resource, err) {
    bc.waiting--;
    if (err) {
      // notice we reportError can decide to continue or panic
      reportError(resource, err);
    }
    advance(resource, true);
  };

  if (!bc.errorCount && !bc.check) {
    var
      transformNames= [], 
      pluginNames= [], 
      deps= [];
    for (var p in bc.transformMap) {
      // each item is a [AMD-MID, gateId] pair
      transformNames.push(p);
      deps.push(bc.transformMap[p][0]);
    }
/* TODO
    for (p in bc.pluginMap) {
      pluginNames.push(p);
      deps.push(bc.pluginMap[p]);
    }
*/
    loader.require(deps, function() {
      // replace the transformIds in the transformJobsMap with the actual transform procs
      for (var id, proc, i=0, argsPos= 0; i<transformNames.length;) {
        id= transformNames[i++];
        proc= arguments[argsPos++];
        // replace every occurence of id with proc
        transformJobsMap.forEach(function(item) {
          // item is a [predicate, vector of [transformId, gateId] pairs] pairs
          for (var transforms=item[1], i= 0; i<transforms.length; i++) {
            if (transforms[i][0]==id) {
              transforms[i][0]= proc;
              break;
            }
          }
        });
      }
      for (i=0; i<pluginNames.length; i++) {
        bc.pluginMap[pluginNames[i++]]= arguments[argsPos++];
      }
      bc.currentGate= gate.ast;
      // hold the gate at least until discover returns; this initializes bc.waiting for the first time
      // note: discover will call bc.start with each discovered resource, which will call advance, which will
      // enter each resource in a race to the next gate, which will result in many bc.waiting incs/decs
      bc.waiting= 1;
      bc.log("discovering resources...");
      discover(bc);
      bc.log("reading resources...");
      // release the gate lock set above
      passGate();
    });
  };
});
