// TODO: check that the win version for node uses forward slash
// TODO: make sure all async error returns are handled or thrown
var
  // configuration info for the build program
  config= require("./config"),

  // parse the command line
  args= require("./processCommandLine"),

  // load the AMD loader
  loader= require(args.amdLoader || config.amdLoader).boot();

// configure the loader
loader.require(args.amdLoaderConfig || config.amdLoaderConfig);

// define the config and args modules which have already been instantiated by the node loader
define("config", 0, config);
define("args", 0, args);

// define the loader, which is slightly indirect...
define("loader", 0, (function() {
  var result= {};
  for (var p in loader.require) result[p]= loader.require[p];
  return result;
})());

// these node modules are used by AMD modules; provide access through the AMD loader
define("child_process", 0, require("child_process"));
define("fs", 0, require("fs"));

// remember the node module loader with respect to the program root
define("nodeRequire", 0, function(){ return require; });

// use the AMD loader to load the rest of the bdBuild program and then execute the build
loader.require(["bdBuild/fileUtils", "bdBuild/buildControl"], function(fileUtils, bc) {
  var
    runPhase= function(phase, nextPhase) {
      // block until all job requests are made for this phase
      bc.waiting++;
      bc.phase= phase;
      bc.cb= nextPhase;
      var 
        jobs= bc.jobs, 
        job, p;
      for (p in jobs) {
        job= jobs[p];
        if (job[phase]) {
          job[phase](nextPhase);
        }
      }
      nextPhase();
    };

  // The build is executed by completing an ordered set of phases:
  //   * start:
  //   * global optimize:
  //   * write
  // During each phase, several async operations may be ongoing concurrently.  bc.waiting===0 signals the 
  // next phase can begin. For any particular phase, that phase can be blocked from
  // entering the next phase by incrementing bc.waiting by at least one more than the
  // count of async processes that each of those processes cause to decrement bc.waiting on exit.
  bc.waiting= 0;

  bc.hasLocations= {};

  bc.read= function(err) {
    if (err) {
      bc.logError("terminating build during startup phase");
      throw err;
    }
    // wait for previous phase to complete
    if (--bc.waiting) return;

    bc.log("reading source...");
    runPhase("read", bc.globalOptimize);
  };

  bc.globalOptimize= function(err) {
    if (err) {
      bc.logError("terminating build during read phase");
      bc.logError(err);
      throw err;
    }
    // wait for previous phase to complete
    if (--bc.waiting) return;

    bc.log("computing global optimizations...");
    runPhase("globalOptimize", bc.write);
  };

  bc.write= function(err) {
    if (err) {
      bc.logError("terminating build during global optimization phase");
      throw err;
    }
    // wait for previous phase to complete
    if (--bc.waiting) return;

    bc.log("writing results...");
    runPhase("write", bc.cleanup);
  };

  bc.cleanup= function(err) {
    if (err) {
      bc.logError("terminating build during write phase");
      bc.logError(err);
      throw err;
    }
    // wait for previous phase to complete
    if (--bc.waiting) return;

    bc.log("cleaning up...");
    runPhase("cleanup", bc.report);
  };

  bc.report= function(err) {
    if (err) {
      bc.logError("error found during cleanup phase; ignoring error and continuing");
    }
    // wait for previous phase to complete
    if (--bc.waiting) return;
    bc.log("Completed build successfully!");
    bc.log("Total build time: " + ((new Date()).getTime() - bc.startTimestamp.getTime()) / 1000 + " seconds");
  };

  if (bc.check) {
    console.log(bc);
  } else {
    fileUtils.ensurePath(bc.sandbox);
    var
      procNames= [], 
      deps= [];
    for (var p in bc.procMap) {
      procNames.push(p);
      deps.push(bc.procMap[p]);
    }
    loader.require(deps.concat(bc.pluginResourceProcessors), function() {
      for (var i=0; i<procNames.length; i++) {
        bc[procNames[i]]= arguments[i];
      }
      bc.waiting++;
      loader.require(bc.jobList, function() {
        bc.phase= "start";
        for (var i= 0; i<arguments.length; i++) {
          arguments[i].start(bc.read);
        }
        bc.read(0);
      });
    });
  };
});

