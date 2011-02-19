define(["./fileUtils", "fs"], function(fileUtils, fs) {
  ///
  // AMD-ID bdBuild/argv
  //
  // This module parses the command line and returns the result in an object with the following properties
  //
  //   build: a vector of build objects
  //   basePath:
  //   pagePath:
  //   destBasePath:
  //   destPackageBasePath:
  //   check:
  //
  // Design of relative paths:
  // 
  //   * All relative source paths and relative bd.destBasePath are relative to bc.basePath
  //   * All relative destination paths are relative to bc.destBasePath
  //   * Relative bd.basePath found in a build control script is relative to the directory that contains the script
  //   * Any relative path found on the command line is relative to the current working directory
  //   * If no bc.basePath is given, then it defaults to tha path where tha last build control script resides
  
  var
    // used to build up the result
    result= {
      buildControlScripts:[]
    },

    buildControlScripts= result.buildControlScripts,
  
    cwd= process.cwd(),

    getAbsolutePath= fileUtils.getAbsolutePath,
  
    // hold the directory of the last build script processed; this is the default location of basePath
    defaultBasePath= 0,
  
    illegalArgumentValue= function(argumentName, position) {
      return new Error("illegal argument value for " + argumentName + " (argument " + position + ").");
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

      defaultBasePath= fileUtils.getFilepath(filename);
      var src;
      try {
        src= readFileSync(filename, "utf8");
        if (scopeType=="require") {
          src= "(function(){var result, require= function(config){result=config;};" + src + "; return result;})();";
        } else if (scopeType=="requireConfig") {
          src= src + ";require;";
        } else {
          src= "(" + src + ")";
        }
      } catch (e) {
        console.log("Failed to open and read build info (" + filename + ").");
        throw e;
      }
      try {
        var result= process.compile(src, filename);
        if (!result) {
          throw new Error("Failed to evaluate build info (" + filename + ").");
        }
        if (typeof result.basePath == "string") {
          result.basePath= getAbsolutePath(result.basePath, defaultBasePath);
        }
        if (result.build && typeof result.build.basePath == "string") {
          result.build.basePath= getAbsolutePath(result.basePath, defaultBasePath);
        }
        buildControlScripts.push(result);
      } catch (e) {
        throw e;
      }
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
          throw illegalArgumentValue("build", i);
        }
        break;
  
      case "-r":
      case "--require":
        if (i<end) {
          loadBuildInfo(getAbsolutePath(argv[i++], cwd), "require");
        } else {
          throw illegalArgumentValue("require", i);
        }
        break;
  
      case "-s": //e.g., source
      case "--base-path":
        if (i<end) {
          result.basePath= getAbsolutePath(argv[i++], cwd);
        } else {
          throw illegalArgumentValue("base-path", i);
        }
        break;
  
      case "-d":
      case "--dest-base-path":
        if (i<end) {
          result.destBasePath= getAbsolutePath(argv[i++], cwd);
        } else {
          throw illegalArgumentValue("dest-base-path", i);
        }
        break;
  
      case "-p":
      case "--dest-package-base-path":
        if (i<end) {
          result.destPackageBasePath= getAbsolutePath(argv[i++], cwd);
        } else {
          throw illegalArgumentValue("dest-package-base-path", i);
        }
        break;
  
      case "--check":
        // read, process, and send the configuration to the console and then exit
        result.check= true;
        break;
  
      default:
        throw illegalArgumentValue(arg, i);
    }
  }
  
  if (!buildControlScripts.length) {
    console.log("no build control script was given; trying to read config.js in the current working directory");
    loadBuildInfo(getAbsolutePath("./config", cwd), "requireConfig");
    console.log("successfully read config.js; using it for the build");
  }

  var found= false;
  for (i= 0; i<buildControlScripts.length; i++) {
    var bcs= buildControlScripts[i];
    if (bcs.basePath || bcs.build.basePath) {
      found= true;
    }
  }
  if (!found) {
    result.basePath= defaultBasePath;
  }
  return result;
});