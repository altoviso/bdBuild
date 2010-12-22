// TODO: check that the win version for node uses forward slash
// TODO: make sure all async error returns are handled or thrown
var
  packageRoot= __dirname.match(/^(.+)\/bdBuild\/lib$/)[1],

  // default AMD loader configuration
  amdLoaderConfig= {
    rootPath: packageRoot,
    packages:[{
      name:"bdBuild",
      location:packageRoot + "/bdBuild/"
    }, {
      name:"bdParse",
      location:packageRoot + "/bdParse/"
    }, {
      name:"bdLoad",
      location:packageRoot + "/bdLoad/"
    }]
  },

  // parse the command line
  args= require("./processCommandLine"),

  // load and configure the AMD loader
  bdLoad= require(args.amdLoader || "../../bdLoad/lib/node").load(args.amdLoaderConfig || amdLoaderConfig);

// push the parsed command line into the loader property userConfig for retrieval by the bdBuild/buildControl module
bdLoad.userConfig= args;

// use the AMD loader to load the rest of the bdBuild program and then execute the build
bdLoad(["bdBuild/fileUtils", "bdBuild/buildControl"], function(fileUtils, buildControl) {
  var 
    prepareDestTree= function() {
      buildControl.oldBackups= [];
      try {
        buildControl.destRoots.forEach(function(path) {
          buildControl.oldBackups= buildControl.oldBackups.concat(fileUtils.prepareDestDirectory(path));
        });
      } catch (e) {
        console.log("Failed to create or clean destination directory. Do you have appropriate priviledges?");
        throw e;
      }
    },

    destroyBackups= function() {
      if (buildControl.destroyBackups) {
        // block until all spawned processes have started
        buildControl.waiting++;
        var spawn= require('child_process').spawn;
        buildControl.oldBackups.forEach(function(filename) {
          buildControl.waiting++;
          spawn("rm", ["-Rf", filename]).on('exit', function () { buildControl.report(); });
        });
        // unblock
        buildControl.report();
      }
    },

    runPhase= function(phase, nextPhase) {
      // block until all job requests are made for this phase
      buildControl.waiting++;
      var 
        jobs= buildControl.jobs, 
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
  // During each phase, several async operations may be ongoing concurrently.  buildControl.waiting===0 signals the 
  // next phase can begin. For any particular phase, that phase can be blocked from
  // entering the next phase by incrementing buildControl.waiting by at least one more than the
  // count of async processes that each of those processes cause to decrement buildControl.waiting on exit.
  buildControl.waiting= 0;

  buildControl.jobs= {};

  buildControl.hasLocations= {};

  buildControl.read= function(err) {
    if (err) {
      console.log("terminating build during startup phase");
      throw err;
    }
    // wait for previous phase to complete
    if (--buildControl.waiting) return;

    console.log("reading source...");
    runPhase("read", buildControl.globalOptimize);
  };

  buildControl.globalOptimize= function(err) {
    if (err) {
      console.log("terminating build during read phase");
      throw err;
    }
    // wait for previous phase to complete
    if (--buildControl.waiting) return;

    console.log("computing global optimizations...");
    runPhase("globalOptimize", buildControl.write);
  };

  buildControl.write= function(err) {
    if (err) {
      console.log("terminating build during global optimization phase");
      throw err;
    }
    // wait for previous phase to complete
    if (--buildControl.waiting) return;

    console.log("writing results...");
    runPhase("write", buildControl.cleanup);
  };

  buildControl.cleanup= function(err) {
    if (err) {
      console.log("terminating build during write phase");
      throw err;
    }
    // wait for previous phase to complete
    if (--buildControl.waiting) return;

    console.log("cleaning up...");
    destroyBackups();
    runPhase("cleanup", buildControl.report);
  };

  buildControl.report= function(err) {
    if (err) {
      console.log("error found during cleanup phase; ignoring error and continuing");
    }
    // wait for previous phase to complete
    if (--buildControl.waiting) return;
    console.log("Completed build successfully!");
    console.log("Total build time: " + ((new Date()).getTime() - buildControl.startTimestamp.getTime()) / 1000 + " seconds");
  };

  if (buildControl.check) {
    console.log(buildControl);
  } else {
    var
      procNames= [], 
      deps= [];
    for (var p in buildControl.procMap) {
      procNames.push(p);
      deps.push(buildControl.procMap[p]);
    }
    bdLoad(deps, function() {
      for (var i=0; i<procNames.length; i++) {
        buildControl[procNames[i]]= arguments[i];
      }
      buildControl.waiting++;
      bdLoad(buildControl.jobList, function() {
        for (var i= 0; i<arguments.length; i++) {
          arguments[i].start(buildControl.read);
        }
        buildControl.read(0);
      });
    });
  };
});

