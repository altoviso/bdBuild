define(["./fileUtils", "fs", "./configStringify", "text!./help.txt"], function(fileUtils, fs, stringify, help) {
  ///
  // AMD-ID bdBuild/argv
  //
  // This module parses the command line and returns the result in an object with the following properties
  //
  //   buildControlScripts: a vector of build objects, ordered as provided on the command line
  //   basePath:
  //   pagePath:
  //   destBasePath:
  //   destPackageBasePath:
  //   check:
  //
  // Design of relative paths:
  // 
  //   * All relative source paths and relative bc.destBasePath are relative to bc.basePath
  //   * All relative destination paths are relative to bc.destBasePath
  //   * Relative bd.basePath found in a build control script is relative to the directory that contains the script
  //   * Any relative path found on the command line is relative to the current working directory
  //
  // The value of bc.basePath can come from several locations (ranked most-preferred to least-preferred)
  //
  //   1. command line argument "--base-path"
  //   2. bc.build.baseTree[0]
  //   3. bc.build.baseDir[0]
  //   4. bc.build.basePath
  //   5. bc.baseTree[0]
  //   6. bc.baseDir[0]
  //   7. bc.basePath
  //
  // For each build control script that is compiled, each of these objects is inspected for a relative path; if found,
  // that relative path is understood relative to the directory that contains the script, and the path is converted to
  // an absolute path.
  // 
  // For each build control script that is compiled, if bc.basePath is undefined, it is set to the directory that
  // contains the script. This will have no effect unless nothing is given for any of [1]-[7]. Notice that this feature
  // can be disabled by setting e.g., "basePath==0" in any build control script.
  
  var
    // used to build up the result
    result= {
      version:"1.0.0-beta",
      buildControlScripts:[]
    },

    buildControlScripts= result.buildControlScripts,
  
    cwd= process.cwd(),

    getAbsolutePath= fileUtils.getAbsolutePath,

    printVersion= 0,
    printHelp= 0,

    errorCount= 0,

    reportError= function(message, e) {
      console.log(message);
      if (e) {
        console.log(e);
      }
      errorCount++;
    },
  
    illegalArgumentValue= function(argumentName, position) {
      console.log("illegal argument value for " + argumentName + " (argument " + position + ").");
      errorCount++;
    },
  
    loadBuildInfo= function(
      filename,
      scopeType
    ) {
      ///
      // Load, evaluate and return the result of the contents of the file given by
      // filename in a scope type given by scopeType as follows:
      // 
      // When scopeType is falsy, contents of filename should be a Javascript object.
      // `code
      // (<contents>)
      // 
      // When scopeType is "require", contents of filename should be an application of require to a configuration object.
      // `code
      // (function() {
      //   var result, require= function(config){result=config;};
      //   <contents>
      //   return result;
      // })();
      //     
      // If result contains the properties basePath and/or destBasePath, then these paths are normalized
      // with respect to the path given by filename.

      var
        // remember the the directory of the last build script processed; this is the default location of basePath
        path= fileUtils.getFilepath(filename),
        src;
      try {
        src= fs.readFileSync(filename, "utf8");
        if (scopeType=="require") {
          src= "(function(){var result, require= function(config){result=config;};" + src + "; return result;})();";
        } else if (scopeType=="requireConfig") {
          src= src + ";require;";
        } else {
          src= "(" + src + ")";
        }
      } catch (e) {
        reportError("failed to read build control script " + filename);
        return 0;
      }
      var e= 0;
      try {
        // build control script
        var bcs= eval(src, filename);
        if (bcs) {
          function fixupBasePath(o, p) {
            if (typeof o != "undefined") {
              if (typeof o[p] == "string") {
                o[p]= getAbsolutePath(o[p], path);
              } else if (o[p] instanceof Array) {
                o[p][0]= getAbsolutePath(o[p][0], path);
              }
            }
          }
          fixupBasePath(bcs.build, "baseTree");
          fixupBasePath(bcs.build, "baseDir");
          fixupBasePath(bcs.build, "basePath");
          fixupBasePath(bcs, "baseTree");
          fixupBasePath(bcs, "baseDir");
          fixupBasePath(bcs, "basePath");
          if (typeof bcs.basePath == "undefined") {
            bcs.basePath= path;
          }
          buildControlScripts.push(bcs);
          return true;
        }
      } catch (e) {
        //squelch
      }
      reportError("failed to evaluate build control script " + filename, e);
      return 0;
    };
  
  //arg[0] is node; argv[1] is the buildControlScripts program; therefore, start with argv[2]
  for (var argv= process.argv, arg, i= 2, end= argv.length; i<end;) {
    arg= argv[i++];
    switch (arg) {
      case "-b":
      case "--build":
        if (i<end) {
          loadBuildInfo(getAbsolutePath(argv[i++], cwd), false);
        } else {
          illegalArgumentValue("build", i);
        }
        break;
  
      case "-r":
      case "--require":
        if (i<end) {
          loadBuildInfo(getAbsolutePath(argv[i++], cwd), "require");
        } else {
          illegalArgumentValue("require", i);
        }
        break;
  
      case "-s": //e.g., source
      case "--base-path":
        if (i<end) {
          result.basePath= getAbsolutePath(argv[i++], cwd);
        } else {
          illegalArgumentValue("base-path", i);
        }
        break;
    
      case "--page-base-path":
        if (i<end) {
          result.pageBasePath= getAbsolutePath(argv[i++], cwd);
        } else {
          illegalArgumentValue("page-base-path", i);
        }
        break;

      case "-d":
      case "--dest-base-path":
        if (i<end) {
          result.destBasePath= getAbsolutePath(argv[i++], cwd);
        } else {
          illegalArgumentValue("dest-base-path", i);
        }
        break;
  
      case "-p":
      case "--dest-package-base-path":
        if (i<end) {
          result.destPackageBasePath= getAbsolutePath(argv[i++], cwd);
        } else {
          illegalArgumentValue("dest-package-base-path", i);
        }
        break;
  
      case "--check":
        // read, process, and send the configuration to the console and then exit
        result.check= true;
        break;
  
      case "--help":
        // read, process, and send the configuration to the console and then exit
        printHelp= true;
        console.log(help);
        break;
  
      case "-v":
      case "--version":
        // read, process, and send the configuration to the console and then exit
        printVersion= true;
        console.log("v" + result.version);
        break;
  
      case "--unit-test":
        // special hook for testing
        if (i<end) {
          result.unitTest= argv[i++];
        } else {
          illegalArgumentValue("unit-test", i);
        }
        break;
  
      case "--unit-test-param":
        // special hook for testing
        if (i<end) {
          result.unitTestParam= result.unitTestParam || [];
          result.unitTestParam.push(argv[i++]);
        } else {
          illegalArgumentValue("unit-test", i);
        }
        break;
  
      default:
        illegalArgumentValue(arg, i);
    }
  }

  if ((printHelp || printVersion && argv.length==3) || (printHelp && printVersion && argv.length==4)) {
    //just asked for either help or version or both; don't do more work or reporting
    process.exit(0);
  }
  
  if (!errorCount && !buildControlScripts.length) {
    try {
      console.log("no build control script was given; trying to read config.js in the current working directory");
      if (loadBuildInfo(getAbsolutePath("./config.js", cwd), "requireConfig")) {
        console.log("successfully read config.js; using it for the build");
      }
    } catch(e) {
    }
  }

  if (errorCount==1 && !buildControlScripts.length) {
    console.log("no build control script ever found. Nothing to do; terminating application.");
    process.exit(-1);
  } else if (errorCount) {
    console.log("errors on command line; terminating application.");
    process.exit(-1);
  }

  if (result.unitTest=="argv") {
    var passed= fs.readFileSync(result.unitTestParam[0], "ascii")==stringify(result).result;
    console.log(passed ? "PASSED" : "FAILED");
    process.exit(passed ? 0 : -1);
  }

  return result;
});
