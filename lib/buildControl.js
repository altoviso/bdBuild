define(["require", "./fileUtils"], function(require, fileUtils) {
var
  args= 
    // the main program stuffed the parsed command line arguments into the property `userConfig` on the loader
    require.userConfig,

  bc= {
    basePath: 
      ///
      //(bdBuild.path) The root for any path that is not specified as an absolute path.  //Must be provided.
      0,
  
    packages:
      ///
      //(map:string(package name) --> bdBuild.packageInfo(package configuration information)) The
      // set of packages to be compiled.
      [{
      // the default package
      srcName: "",
      srcLib: "",
      srcUrlMap: [],
      srcLocation: "",
      destName:"",
      destUrlMap:[],
      }],
  
    loaderConfig: 
      ///
      //(bdLoad.config or falsy, optional) The configuration object to pass to the bdLoad constructor.
      // is compiled.
      {
        timeout:0
      },
  
    loaderHasMap: 
      ///
      //(bdLoad.hasMap or falsy, optional) The has map to pass to the bdLoad constructor. /If bdLoad.config.has
      // is given, then then loaderHasMap is ignored
      {
        "dom-addEventListener": "this.document && !!document.addEventListener",
        "native-xhr": "!!this.XMLHttpRequest"
      },
  
    has: 
      //(filename or 0) filename of has.js implementation; 0 indicates use loader has implementation
      0, //packageRoot + "/has.js",
  
    hasFactories:
      //(array of filename)
      [],
    
    staticHasFlags: {
      "dom": 1,
      "loader-node": 0,
      "loader-injectApi": 1,
      "loader-timeoutApi": 0,
      "loader-traceApi": 0,
      "loader-buildToolsApi": 0,
      "loader-catchApi": 1,
      "loader-pageLoadApi": 1,
      "loader-errorApi": 1,
      "loader-sniffApi": 0,
      "loader-undefApi": 0,
      "loader-libApi": 0,
      "loader-requirejsApi": 0,
      "loader-createHas": 0,
      "loader-pushHas": 0,
      "loader-amdFactoryScan": 0,
      "loader-throttleCheckComplete": 0
    },
  
    // where to write the output; must be explicitly set by user

    destRootPath: 
      ///
      //(bdBuild.path) The root location to output the build. //Must be provided.
      0,
  
    destPackageRootPath:
      ///
      //(bdBuild.path, optional "packages") The default path that contains all packages.
      ///
      // If not absolute, destRootPath is automatically prepended.
      "packages",
  
    // layers to build
    layers:{},
  
    // 
    flags: {
      stripConsole: 1,
      optimizeHas: 1
    },
  
    copyDirs: [],
    copyFiles: [],

    procMap: {
      jsResourceTextProc:  "bdBuild/jsResourceTextProc",
      jsResourceTokenProc: "bdBuild/jsResourceTokenProc",
      jsResourceAstProc:   "bdBuild/hasAmdAstProc"
    },

    jobList: ["bdBuild/loaderJob", "bdBuild/packageJob", "bdBuild/layerJob", "bdBuild/copyJob"]
  },

  isString= function(it) {
    return typeof it === "string";
  },

  loadBuildInfo= function(filename) {
    // This function loads the contents of the file given by filename and then
    // evaulates that contents with the variables packageRoot and bdBuildConfig
    // in scope
    filename= /^\./.test(filename) ? process.cwd() + "/" + filename : filename;
    var src;
    try {
      src= fileUtils.read(filename);
    } catch (e) {
      console.log("Failed to open and read build info (" + filename + "),");
      console.log(e);
    }
    try {
      var
        dirname= filename.match(/(.+)\/[^\/]+$/)[1], 
        normalize= function(result, name) {
          var s= result[name];
          if (isString(s) && s.length && s.charAt(0)==".") {
            result[name]= dirname + "/" + s;
          }
        },
        result= process.compile(src, filename);
        if (typeof result=="undefined") {
          src+= ";require;";
          result= process.compile(src, filename);
        }
      normalize(result, "basePath");
      return result;
    } catch (e) {
      console.log("Failed to evaluate build info (" + filename + "),");
      console.log(e);
      throw e;
    }
  },

  cleanAndComputeBuildInfo= function() {
    // Clean up the configuration and compute default values:
    var
      getFilename= fileUtils.getFilename,
      getFilepath= fileUtils.getFilepath,
      cleanupPath= fileUtils.cleanupPath,
      compactPath= fileUtils.compactPath,
      isAbsolutePath= fileUtils.isAbsolutePath,
      catPath= fileUtils.catPath,

      // this will be the list of directories that will receive output
      dirs= [],

      alias= function(name) {
        // note: paths are named by (src | dest | <empty>)<role>Path;
        // prefix of <empty> are aliases for src paths since dest paths are 
        // usually computed by default relative to destRootPath which is a
        // required, explicit configuration variable.
        var
          srcName= "src" + name.substring(0, 1).toUpperCase() + name.substring(1),
          result= bc[srcName]= isString(bc[srcName]) ? bc[srcName] : bc[name];
        delete bc[name];
        return result;
      },

      computePath= function(path, base) {
        return compactPath((!base || isAbsolutePath(path)) ? cleanupPath(path) : catPath(base, cleanupPath(path)));
      },

      // the mother of all dest paths
      destRoot= bc.destRootPath= computePath(bc.destRootPath),

      // the default dest package root
      destPackageRoot= bc.destPackageRootPath= computePath(bc.destPackageRootPath, destRoot),

      // the mother of all src paths
      basePath= bc.basePath= compactPath(cleanupPath(bc.basePath));

    if (!destRoot || !destRoot.length) {
      console.log('You must specify a destination destRoot path (use the "--root" build option or build script "destRootPath" property).');
      throw new Error("failed to provide destination root path");
    }
    dirs.push(destRoot);
    dirs.push(destPackageRoot);

    if (bc.srcLoader) {
      bc.srcLoader= computePath(bc.srcLoader, bc.basePath);
      bc.loaderName= getFilename(bc.srcLoader);
      bc.destLoader= bc.destLoader ? computePath(bc.destLoader, destRoot) : computePath("./" + bc.loaderName, destRoot);
      dirs.push(getFilepath(bc.destLoader));
    } else {
      bc.srcLoader= bc.loaderName= bc.destLoader= 0;
    }

    // copyDirs is a vector of [src, dest] pairs; relative names are relative to basePath and destRoot, repectively
    bc.copyDirs= (bc.copyDirs || []).map(function(item) {
      var dest= computePath(item[1], destRoot);
      dirs.push(dest);
      return [computePath(item[0], basePath), dest];
    });

    bc.copyFiles= (bc.copyFiles || []).map(function(filename) {
      var 
        dest= computePath(item[1], destRoot),
        path= getFilepath(dest);
      path && path.length && dirs.push(path);
      return [computePath(item[0], basePath), dest];
    });

    // TODO paths prefixes pathsMapProg

    // unshift any packagePaths into the packages vector; unshift because packagePaths
    // is syntax sugar for packages and if the user wants to override an existing package, the
    // long form is more likely convenient
    for (var base in bc.packagePaths) {
      bc.packagePaths[base].forEach(function(packageInfo) {
        if (isString(packageInfo)) {
          packageInfo= {name:packageInfo};
        }
        packageInfo.location= base + "/" + packageInfo.name;
        bc.packages.unshift(packageInfo);
      });
    };

    // packages is a vector of bdLoad.packageInfo objects. The following cleans up the
    // objects, and changes packages to a map from package name to package info. 
    // 
    // Note, that it is possible that the configuration gives multiple package info objects for
    // the same package. In that case, the last one wins.
    var packages= {};
    bc.packageMap= {};
    bc.packages.forEach(function(src) {
      // calculate the precise (name, basePath, lib, main, mappings) for a package
      if (isString(src)) {
        src= {name:src};
      }
      // build up info to tell all about a package; name, lib, main, urlMap, packageMap, location
      // are semantically identical to definitions used by AMD loader
      var info= {};
      info.srcName= src.name;
      info.srcLib= isString(src.lib) ? src.lib : "lib";
      info.srcMain= isString(src.main) ? src.main : "main";
      info.srcUrlMap= src.urlMap || [];
      info.srcPackageMap= src.packageMap || 0;
      info.srcLocation= computePath(src.location || info.name, basePath);

      // modules gives a vector of specific modules to include in the build
      info.modules= src.modules || [];

      // exclude gives a vector of regexs to that give filenames to exclude from automatic module discover
      info.exclude= src.exclude || [];
      
      // dest says where to output the compiled code stack
      info.destName= src.destName || info.srcName;
      info.destLib= src.destLib || info.srcLib;
      info.destMain= src.destMain || info.srcMain;
      info.destUrlMap= src.destUrlMap || info.srcUrlMap;
      info.destLocation= computePath(src.destLocation || info.destName, destPackageRoot);

      // copyDirs/copyFiles just like global, except relative to the info.(src|dest)Location
      info.copyDirs= (info.copyDirs || []).map(function(item) {
        var dest= computePath(item[1], info.destLocation);
        dirs.push(dest);
        return [computePath(item[0], info.srcLocation), dest];
      });
  
      info.copyFiles= (info.copyFiles || []).map(function(filename) {
        var 
          dest= computePath(item[1], info.destLocation),
          path= getFilepath(dest);
        path && path.length && dirs.push(path);
        return [computePath(item[0], info.srcLocation), dest];
      });

      // now that we've got a fully-resolved package object, push it into the configuration
      // push the default package into the name "*"
      var name= info.srcName || "*";
      packages[name]= info;
      bc.packageMap[name]= name;
    });
    bc.packages= packages;

    for (var p in bc.modules || {}) {
      bc.modules[p]= computePath(bc.modules[p], basePath);
    }

    // calculate each root directory that will receive output
    dirs.sort();
    var
      next, 
      current= dirs.shift(),
      roots= bc.destRoots= [current];
    while (dirs.length) {
      next= dirs.shift();
      if (next.indexOf(current)) {
        current= next;
        roots.push(current);
      }
    }
  },

  mix= function(dest, src) {
    dest= dest || {};
    for (var p in src) src.hasOwnProperty(p) && (dest[p]= src[p]);
    return dest;
  },

  mixBuild= function(src) {
    for (var p in src) {
      if (!/(packages)|(modules)|(loaderConfig)|(loaderHasMap)|(staticHasFlags)/.test(p)) {
        bc[p]= src[p];
      }
    }
    src.packages && src.packages.length && (bc.packages= bc.packages.concat(src.packages));
    bc.packageMap= mix(bc.packageMap, src.packageMap || {});
    bc.paths= mix(bc.paths, src.paths || {});
    bc.modules= mix(bc.modules, src.modules || {});
    bc.loaderConfig= mix(bc.loaderConfig, src.loaderConfig || {});
    bc.loaderHasMap= mix(bc.loaderHasMap, src.loaderHasMap || {});
    bc.staticHasFlags= mix(bc.staticHasFlags, src.staticHasFlags || {});
    bc.procMap= mix(bc.procMap, src.procMap || {});
  };

// additional build control objects are mixed into the build control object
// in the order they appeared on the command line
args.build.forEach(function(filename) {
  mixBuild(loadBuildInfo(filename));
});

// specific command line switch have the highest priority
"destRootPath.destPackageRootPath.destroyReleaseRoot.destroyBackups.noPrompt.dump.check.basePath".split(".").forEach(function(p) {
  args.hasOwnProperty(p) && (bc[p]= args[p]);
});

cleanAndComputeBuildInfo();

// create the work directory
bc.startTimestamp= new Date();
bc.backupPath= bc.destRootPath + "/bdBuild-" + fileUtils.getTimestamp(bc.startTimestamp)  + ".backup";
bc.oldBackups= fileUtils.prepareDestDirectory(bc.destRootPath, bc.backupPath);

return bc;
});
