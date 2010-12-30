// This function parses the command line into an object
var
  // holds the parsed command line
  build= exports.build= [],

  cwd= process.cwd(),

  // relative paths are computed relative to the process current working directory
  normalizePath= function(path) {
    if (path && path.length && path.charAt(0)==".") {
      return cwd + "/" + path;
    }
    return path;
  },

  illegalArgumentValue= function(argumentName, position) {
    return new Error("illegal argument value for " + argumentName + " (argument " + position + ").");
  };

for (var argv= process.argv, arg, i= 2, end= argv.length; i<end;) {
  arg= argv[i++];
  switch (arg) {
    case "-b":
    case "--build":
      if (i<end) {
        build.push(normalizePath(argv[i++]));
      } else {
        throw illegalArgumentValue("build", i);
      }
      break;

    case "-s": //e.g., source
    case "--base-path":
      if (i<end) {
        exports.basePath= normalizePath(argv[i++]);
      } else {
        throw illegalArgumentValue("base-path", i);
      }
      break;

    case "-d":
    case "--dest-root":
      if (i<end) {
        exports.destRootPath= normalizePath(argv[i++]);
      } else {
        throw illegalArgumentValue("dest-root", i);
      }
      break;

    case "-p":
    case "--package-root":
      if (i<end) {
        exports.destPackageRootPath= normalizePath(argv[i++]);
      } else {
        throw illegalArgumentValue("package-root", i);
      }
      break;

    case "--amd-loader":
      if (i<end) {
        exports.amdLoader= normalizePath(argv[i++]);
      } else {
        throw illegalArgumentValue("amd-loader", i);
      }
      break;

    case "--amd-loader-config":
      if (i<end) {
        exports.amdLoaderConfig= normalizePath(argv[i++]);
      } else {
        throw illegalArgumentValue("amd-loader-root", i);
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
