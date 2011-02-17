var
  // configuration info for the build program
  config= require("./config"),

  // parse the command line
  args= require("./processCommandLine"),

  // load the AMD loader
  loader= require(args.amdLoader || config.amdLoader).boot();

// configure the loader
loader.require(args.amdLoaderConfig || config.amdLoaderConfig);

// publish several modules to the AMD loader so that AMD modules have access to them
// config, args, and loader have already been defined by the node loader
// obviously, we need access to the fs module to read/write resources
define("config", [], config);
define("args", [], args);
define("loader", [], loader);
define("fs", [], require("fs"));

// use the AMD loader to load the rest of the bdBuild program and then execute the build
loader.require(["bdBuild/buildControl", "bdBuild/discover"], function(bc, discover, gates) {
  // resources move through the ordered set of gates.  are allowed to move from "read" through ast without waiting for other resources
  // but all resources must complete "ast" before any resource is allowed to move the next gate, and this is true for all gates after "ast"

  var
    transforms= bc.transforms,
    transformJobMap= bc.transformJobMap,
    transformJobMapLength= transformJobMap.length,

    gate= gate.gate,
    gateName= gate.gateName,
    gateMessage= gate.gateMessage,
    lastGateId= gate.lastGateId,

    // all discovered resources
    resources= [],

    reportError= function(resource, error) {
      bc.logError("error file transforming resource: " + resource.srcFilename);
      bc.logError("transform: " + resource.jobPos);
      bc.logError(err);
      throw err;
    },

    // a unique object used to signal a transform is an async function
    asyncReturn= {},

    advance= function(resource, continuingSameGate) {
      if (!continuingSameGate) {
        // first time trying to advance through the current gate
        bc.currentGate++;
      }
        
      // apply all transforms with a gateId <= the current gate for resource that have not yet been applied
      var err, nextJobPos, candidate;
      while (1) {
        nextJobPos= resource.jobPos + 1,
        candidate= nextJobPos<resource.job.length && resource.job[nextJobPos];
        // candidate (if any) is a [transformProc, gateId] pair
        if (candidate && candidate[1]<=bc.currentGate) {
          resource.jobPos++;
          bc.currentGate++;     
          err= candidate[0](resource, bc, asyncReturn);
          if (err===asyncProcReturn) {
            // the transform proc must call bc.returnFromAsyncProc when complete
            return;
          }
          if (err) {
            // notice we reportError can decide to continue or panic
            reportError(resource, error);
          }
          bc.currentGate--;     
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
    for (var i= 0; i<transformJobMapLength; i++) {
      if (transformJobMap[i][0](resource.src)) {
        // job gives a vector of functions to apply to the resource
        // jobPos says the index in the job vector that has been applied
        resources.push(resource);
        resource.job= transformJobMap[i][1];
        resource.jobPos= -1;
        bc.advance(resource);
        return;
      }
    }
    bc.logWarn("Resource (" + resource.srcName + ") was discovered, but there is no transform job specified.");    
  };

  bc.returnFromAsyncProc= function(resource, err) {
    bc.currentGate--;
    if (err) {
      // notice we reportError can decide to continue or panic
      reportError(resource, error);
    }
    advance(resource, true);
  };

  if (!bc.errorCount) {
    var
      transformNames= [], 
      pluginNames= [], 
      deps= [];
    for (var p in bc.transformMap) {
      // each item is a [AMD-MID, gateId] pair
      procNames.push(p);
      deps.push(bc.transformMap[p][0]);
    }
    for (p in bc.pluginMap) {
      pluginNames.push(p);
      deps.push(bc.pluginMap[p]);
    }
    loader.require(deps, function() {
      // replace the transformIds in the transformJobMap with the actual transform procs
      for (var id, proc, gate, i=0, argsPos= 0; i<transformNames.length;) {
        id= transformNames[i++];
        proc= arguments[argsPos++];
        // replace every occurence of id with proc
        transformJobMap.forEach(function(item) {
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
