// This function parses the command line into an object
var
  // holds the parsed command line
  build= exports.build= [],

  cwd= process.cwd(),

  // if basePath and/or destBasePath are not given, then these will
  // hold possible defaults
  candidateBasePath= 0,
  candidateDestBasePath= 0,

  normalizePath= function(path, base) {
    // return path relative to base iff path is not absolute; otherwise return path
    if (path && path.length && path.charAt(0)!="/") {
      return base + "/" + path;
    }
    return path;
  },

  normalizeArgPath= function(path) {
    // normalize path with respect to the current working directory
    return normalizePath(path, cwd);
  },

  normalizePropPath= function(o, p, base) {
    // normalize property p in object o, a path, with repsect to base iff o[p] is not absolute
    if (o[p]) {
      o[p]= normalizePath(o[p], base);
    }
  },

  illegalArgumentValue= function(argumentName, position) {
    return new Error("illegal argument value for " + argumentName + " (argument " + position + ").");
  },

  loadBuildInfo= function(
    filename,
    scopeType
  ) {
    // Load, evaluate and return the result of the contents of the file given by
    // filename in a scope type given by scopeType as follows:
    // 
    // When scopeType is falsy:
    // `code
    // (<contents>)
    // 
    // When scopeType is "require":
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
      path= filename.match(/(.+)\/[^\/]+$/)[1],
      src;
    try {
      src= require("fs").readFileSync(filename, "utf8");
      if (scopeType=="require") {
        src= "(function(){var result, require= function(config){result=config;};" + src + "; return result;})();";
      } else {
        src= "(" + src + ")";
      }
      candidateBasePath= path;
      candidateDestBasePath= path + "-build";
    } catch (e) {
      console.log("Failed to open and read build info (" + filename + ").");
      throw e;
    }
    try {
      var result= process.compile(src, filename);
      if (!result) {
        throw new Error("Failed to evaluate build info (" + filename + ").");
      }
      normalizePropPath(result, "basePath", path);
      normalizePropPath(result, "destBasePath", path);
      if (result.build) {
        normalizePropPath(result.build, "basePath", path);
        normalizePropPath(result.build, "destBasePath", path);
      }
      return result;
    } catch (e) {
      throw e;
    }
  };

for (var argv= process.argv, arg, i= 2, end= argv.length; i<end;) {
  arg= argv[i++];
  switch (arg) {
    case "-b":
    case "--build":
      if (i<end) {
        build.push(loadBuildInfo(normalizeArgPath(argv[i++]), false));
      } else {
        throw illegalArgumentValue("build", i);
      }
      break;

    case "-r":
    case "--require":
      if (i<end) {
        build.push(loadBuildInfo(normalizeArgPath(argv[i++]), "require"));
      } else {
        throw illegalArgumentValue("require", i);
      }
      break;

    case "-s": //e.g., source
    case "--base-path":
      if (i<end) {
        exports.basePath= normalizeArgPath(argv[i++]);
      } else {
        throw illegalArgumentValue("base-path", i);
      }
      break;

    case "-d":
    case "--dest-base-path":
      if (i<end) {
        exports.destBasePath= normalizeArgPath(argv[i++]);
      } else {
        throw illegalArgumentValue("dest-base-path", i);
      }
      break;

    case "-p":
    case "--dest-package-base-path":
      if (i<end) {
        exports.destPackageBasePath= normalizeArgPath(argv[i++]);
      } else {
        throw illegalArgumentValue("dest-package-base-path", i);
      }
      break;

    case "--amd-loader":
      if (i<end) {
        exports.amdLoader= normalizeArgPath(argv[i++]);
      } else {
        throw illegalArgumentValue("amd-loader", i);
      }
      break;

    case "--amd-loader-config":
      if (i<end) {
        exports.amdLoaderConfig= normalizeArgPath(argv[i++]);
      } else {
        throw illegalArgumentValue("amd-loader-base", i);
      }
      break;

    case "--destroy-backups":
      exports.destroyBackups= true;
      break;

    case "--dump":
      // send the configuration to the console the configuration and then exit
      exports.dump= true;
      break;

    case "--check":
      // read, process, and send the configuration to the console and then exit
      exports.check= true;
      exports.dump= true;
      break;

    default:
      throw illegalArgumentValue(arg, i);
  }
}

if (!exports.basePath && build.length==1 && !build[0].basePath) {
  exports.basePath= candidateBasePath;
}

if (!exports.destBasePath && build.length==1 && !build[0].destBasePath) {
  exports.destBasePath= candidateDestBasePath;
}
