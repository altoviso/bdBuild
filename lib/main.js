// TODO: check that the win version for node uses forward slash
// TODO: make sure all async error returns are handled or thrown

// read and process the command line
var commandLine= require("./processCommandLine");

// load and configure the backdraft loader
// commandLine.bdBuildConfig configures the backdraft loader for bdBuild (this program, *not* for the target we're building)
require.paths.unshift(commandLine.bdBuildConfig.bdLoadRoot);
var bdLoad= require("bdLoad/lib/node").load(commandLine.bdBuildConfig);

// use the backdraft loader to load the rest of the bdBuild program and then execute the build
bdLoad(["bdBuild/fileUtils", "bdParse", "bdBuild/pragmaPreprocessor", "bdBuild/hasPreprocessor"], function(fileUtils, parser, pragmaPP, hasPP) {
  var 
    // config controls the build
    config= commandLine.config,

    cleanupScript= function() {
      // clean up the configuration and compute default values
      if (!config.destRootPath || !config.destRootPath.length) {
        console.log('You must specify a destination root path (use the "--root" build option or build script "destRootPath" property).');
        throw new Error("failed to provide destination root path");
      } else if (config.destRootPath.charAt(0)==".") {
        config.destRootPath= process.cwd() + "/" + config.destRootPath;
      }

      var
        cleanupPath= fileUtils.cleanupPath,
        isAbsolutePath= fileUtils.isAbsolutePath,
        catPath= fileUtils.catPath,

        // this will be the list of directories that will receive output
        dirs= [];
  
      // cleanup all the user input; compute default values if no specific values given
      var root= config.destRootPath= cleanupPath(config.destRootPath);
      dirs.push(config.destRootPath);
  
      dirs.push(config.destLoaderPath= isAbsolutePath(config.destLoaderPath) ?
        cleanupPath(config.destLoaderPath) :
        catPath(root, cleanupPath(config.destLoaderPath)));
  
      dirs.push(config.destPackageRootPath= isAbsolutePath(config.destPackageRootPath) ?
        cleanupPath(config.destPackageRootPath) :
        catPath(root, cleanupPath(config.destPackageRootPath)));
  
      config.copyDirs= (config.copyDirs || []).map(function(item) {
        var dest= cleanupPath(item[1]);
        dirs.push(dest);
        return [cleanupPath(item[0]), dest];
      });
  
      config.copyFiles= (config.copyFiles || []).map(function(filename) {
        var match= filename.match(/^([\w\W])+\/[^\/]+$/);
        match && dirs.push(match[1]);
      });

/*
   [ { name: 'bd'
     , location: '/home/rcgill/dev/backdraft/demo/helloWorld//home/rcgill/dev/backdraft/demo/helloWorld/0'
     , destLocation: '/home/rcgill/dev/backdraft/demo/helloWorld/0'
     , copyDirs: []
     , copyFiles: []
*/
  
      var
        srcRootPath= config.srcRootPath= cleanupPath(config.srcRootPath),
        srcRootPackagePath= (config.srcRootPackagePath= cleanupPath(config.srcRootPackagePath)) || srcRootPath,
        packages= {};
      config.packages.forEach(function(info) {
        var temp;
        temp= catPath(cleanupPath(info.location || info.name), cleanupPath(info.lib || "lib"));
        info.srcLocation= isAbsolutePath(temp) ? temp : catPath(srcRootPackagePath, temp);
        temp= catPath(cleanupPath(info.destLocation || info.name), cleanupPath(info.destLib || "lib"));   
        info.destLocation= isAbsolutePath(temp) ? temp : catPath(root, temp);

        info.copyDirs= (info.copyDirs || []).map(function(item) {
          var dest= cleanupPath(item[1]);
          dirs.push(dest);
          return [cleanupPath(item[0]), dest];
        });
        info.copyFiles= (info.copyFiles || []).map(function(filename) {
          var match= filename.match(/^([\w\W])+\/[^\/]+$/);
          match && dirs.push(match[1]);
        });
        packages[info.name]= info;
      });
      config.packages= packages;
  
      // calculate each root directory that will receive output
      dirs.sort();
      var
        next, 
        current= dirs.shift(),
        roots= config.destRoots= [current];
      while (dirs.length) {
        next= dirs.shift();
        if (next.indexOf(current)) {
          current= next;
          roots.push(current);
        }
      }
    },

  // The build is executed by completing an ordered set of phases. During each phase,
  // several async operations may be ongoing concurrently.  waiting===0 signals the 
  // next phase can begin. For any particular phase, that phase can be blocked from
  // entering the next phase by incrementing waiting by at least one more than the
  // count of async processes that each decrement waiting on exit.
  waiting= 0,

  preprocessResource= function(resource, preprocessors, callback) {
    waiting++;
    console.log("preprocessing " + resource.filename);
    fileUtils.read(resource.filename, function(err, text) {
      if (err) {
        callback(err);
        return;
      }
      resource.text= resource.parser.split(text);
      resource.tokens= resource.parser.tokenize(resource.text);
      resource.tokens= resource.parser.filterComments(resource.tokens);
      resource.tree= resource.parser.parse(resource.tokens);
      resource.deleteList= [];
      preprocessors && preprocessors.map(function(preprocessor) { 
        preprocessor(resource); 
      });
      callback(resource);
    });
  },

  prepareDestTree= function() {
    var oldBackups= [];
    try {
      config.destRoots.forEach(function(path) {
        oldBackups= oldBackups.concat(fileUtils.prepareRootDestDirectory(path));
      });
      config.oldBackups= oldBackups;
    } catch (e) {
      console.log("Failed to create or clean destination directory. Do you have appropriate priviledges?");
      throw e;
    }
  },

  hasLocations= {},

  resource= function(
    packageName,
    moduleName,
    filename,
    parser,
    pragmaPP,
    hasPP,
    bdLoad
  ) {
    this.packageName= packageName;
    this.moduleName= moduleName;
    this.filename= filename;
    this.parser= parser;
    this.pragmaPP= pragmaPP;
    this.hasPP= hasPP;
    this.hasLocations= hasLocations;
    this.bdLoad= bdLoad;
  },

  jsResources= [],

  processInput= function() {
    console.log("Reading resources...");

    // block until all process requests are made for this phase
    waiting++;
    if (config.loader) {
      var loader= new resource("", "", config.loader, parser, pragmaPP, hasPP, bdLoad);
      loader.destFilename= config.destLoaderPath + "/" + (config.destLoaderName || config.loader.match(/^.+\/(.+)$/)[1]);
      preprocessResource(loader, [function(resource) { hasPP(loader, config.staticHasFlags); }], prepareHas);
      jsResources.push(loader);
    }

    // process the packages...

    // process non-module resources as required...

    // unblock
    prepareHas();
  },

  prepareHas= function() {
    // wait for previous phase to complete
    if (--waiting) return;

    console.log("Optimizing has.js...");

    // block until all process requests are made for this phase
    waiting++;
    
    //TODO: real work

    writeBuild();
  },

  writeBuild= function() {
    // wait for previous phase to complete
    if (--waiting) return;

    console.log("Writing results...");

    // block until all process requests are made for this phase
    waiting++;

    prepareDestTree();
    jsResources.forEach(function(resource) {
      waiting++;
      fileUtils.writeJsResource(resource, cleanup);
    });
    // unblock
    cleanup();  
  },

  cleanup= function() {
    // wait for previous phase to complete
    if (--waiting) return;

    // block until all process requests are made for this phase
    waiting++;
    if (config.destroyBackups && config.oldBackups.length) {
      console.log("Removing old backups...");

      var spawn= require('child_process').spawn;
      config.oldBackups.forEach(function(filename) {
        spawn("rm", ["-Rf", filename]).on('exit', function () { waiting--; });
      });
    }
    // unblock
    report();
  },

  report= function() {
    console.log("Completed build successfully!");
    console.log("Total build time: " + ((new Date()).getTime() - config.startTimestamp.getTime()) / 1000 + " seconds");
  };

  cleanupScript();
  if (config.dumpConfig) {
    console.log(config);
  }
  //processInput();
});
