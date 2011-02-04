define(["args", "config", "loader", "./fileUtils", "./defaultBuildControl"], function(args, config, loader, fileUtils, bc) {
var
  getFilename= fileUtils.getFilename,
  getFilepath= fileUtils.getFilepath,
  cleanupPath= fileUtils.cleanupPath,
  compactPath= loader.compactPath,
  isAbsolutePath= fileUtils.isAbsolutePath,
  catPath= fileUtils.catPath,

  isString= function(it) {
    return typeof it === "string";
  },

  cleanAndComputeBuildInfo= function() {
    // Clean up the configuration and compute default values:
    var
      computePath= function(path, base) {
        return compactPath((!base || isAbsolutePath(path)) ? cleanupPath(path) : catPath(base, cleanupPath(path)));
      },

      normalizeCopyDirs= function(vector, srcBase, destBase) {
        // vector is a vector of [src, dest, exclude] triples (exclude is optional); relative names are relative to srcBase and destBase, repectively
        return (vector || []).map(function(item) {
          return [computePath(item[0], srcBase), computePath(item[1], destBase), item[2] || []];
        });
      },

      normalizeCopyFiles= function(vector, srcBase, destBase) {
        // vector is a vector of [src, dest] filenames; relative names are relative to srcBase and destBase, repectively
        return (vector || []).map(function(item) {
          var dest= computePath(item[1], destBase);
          return [computePath(item[0], srcBase), dest];
        });
      },

      // the mother of all src paths
      basePath= bc.basePath= compactPath(cleanupPath(bc.basePath)),

      // the mother of all dest paths
      destBasePath= bc.destBasePath= computePath(bc.destBasePath),

      // the default dest package base
      destPackageBasePath= bc.destPackageBasePath= computePath(bc.destPackageBasePath, destBasePath);


    bc.pagePath= compactPath(cleanupPath(bc.pagePath)) || basePath;
    bc.pathTransforms= bc.pathTransform || [];

    if (!destBasePath || !destBasePath.length) {
      console.log('You must specify a destination destBasePath path (use the "--base" build option or build script "destBasePath" property).');
      throw new Error("failed to provide destination base path");
    }

    if (bc.srcLoader) {
      bc.srcLoader= computePath(bc.srcLoader, bc.basePath);
      bc.loaderName= getFilename(bc.srcLoader);
      bc.destLoader= bc.destLoader ? computePath(bc.destLoader, destBasePath) : computePath("./" + bc.loaderName, destBasePath);
    } else {
      bc.srcLoader= bc.loaderName= bc.destLoader= 0;
    }

    // copyDirs is a vector of [src, dest] pairs; relative names are relative to basePath and destBasePath, repectively
    bc.copyDirs= normalizeCopyDirs(bc.copyDirs, basePath, destBasePath);
    bc.copyFiles= normalizeCopyFiles(bc.copyFiles, basePath, destBasePath);

    // clean up the package objects and fully compute each field
    bc.packageMap= {};
    for (var packageName in bc.packages) {
      var src= bc.packages[packageName];
      // build up info to tell all about a package; name, lib, main, urlMap, packageMap, location
      // are semantically identical to definitions used by AMD loader
      src.srcName= src.name;
      src.srcLib= isString(src.lib) ? src.lib : "lib";
      src.srcMain= isString(src.main) ? src.main : "main";
      src.srcUrlMap= src.urlMap || [];
      src.srcPackageMap= src.packageMap || 0;
      src.srcLocation= computePath(src.location || src.name, basePath);

      // exclude gives a vector of regexs to that give filenames to exclude from automatic module discovery
      src.exclude= src.exclude || [];
      
      // modules gives a vector of specific modules to include in the build
      src.modules= src.modules || [];

      // dest says where to output the compiled code stack
      // TODO destPackagemap
      src.destName= src.destName || src.srcName;
      src.destLib= src.destLib || src.srcLib;
      src.destMain= src.destMain || src.srcMain;
      src.destUrlMap= src.destUrlMap || src.urlMap || [];
      src.destLocation= src.name ? computePath(src.destLocation || src.destName, destPackageBasePath) : destBasePath;

      if (!src.copyDirs && !bc.buildFlags.singleFile) {
        // copy the lib directory; don't copy any hidden directorys (e.g., .git, .svn)
        if (src.srcName) {
          // regular package
          bc.copyDirs.push([catPath(src.srcLocation, src.srcLib), catPath(src.destLocation, src.destLib), ["*/.*"]]);
        } else {
          // default package
          bc.copyDirs.push([basePath, destBasePath, ["*/.*"]]);
        }
      }

      // copyDirs/copyFiles just like global, except relative to the src.(src|dest)Location
      if (src.copyDirs && src.copyDirs.length) {
        bc.copyDirs= bc.copyDirs.concat(normalizeCopyDirs(src.copyDirs, src.srcLocation, src.destLocation));
      }
      if (src.copyFiles && src.copyFiles.length) {
        bc.copyFiles= bc.copyFiles.concat(normalizeCopyFiles(src.copyFiles, src.srcLocation, src.destLocation));
      }

      if (src.srcName) {
        // recall, the default package has name===""
        bc.packageMap[src.srcName]= src.srcName;
      }
    }

    for (var p in bc.modules || {}) {
      bc.modules[p]= computePath(bc.modules[p], basePath);
    }

    // figure out the real load value; lots of possibilities for requirejs compat
    var load= 
      bc.loaderConfig.load || 
      (bc.loaderConfig.main && [bc.loaderConfig.main]) || 
      bc.loaderConfig.deps ||
      bc.load || 
      (bc.main && [bc.main]) || 
      bc.deps;
    delete bc.loaderConfig.load;
    delete bc.loaderConfig.main;
    delete bc.loaderConfig.deps;
    delete bc.load;
    delete bc.main;
    delete bc.deps;
    if (load) {
      bc.loaderConfig.load= load;
    } else {
      delete bc.loaderConfig.load;
    }

    var fixedLayers= {};
    for (var mid in bc.layers) {
      var layer= bc.layers[mid];
      if (layer instanceof Array) {
        layer= {
          exclude: layer,
          include: []
        };
      } else {
        layer.exclude= layer.exclude || [];
        layer.include= layer.include || [];
      }
      if (layer.boot) {
        layer.boot= computePath(layer.boot, destBasePath);
      };
      fixedLayers[mid]= layer;
    }
    bc.layers= fixedLayers;

    bc.locales= bc.loaderConfig.locales || bc.locales || [];

    //cleanup the copyDirs and copyFiles
    bc.copyDirs= bc.copyDirs.map(function(item) {
      return [compactPath(item[0]), compactPath(item[1]), item[2] || []];
    });
    bc.copyFiles= bc.copyFiles.map(function(item) {
      return [compactPath(item[0]), compactPath(item[1])];
    });
    if (bc.noCopy) {
      bc.copyDirs= bc.copyFiles= [];
    }

    // cleanup cssCompactSet
    // cssCompactSet is a set from destination CSS file name to source CSS filename or vector of source CSS filenames
    // relative src/dest paths are relative to basePath/destBasePath
    var cssCompactList= [];
    for (var destCssFilename in bc.cssCompactSet) {
      var srcCssFilenames= bc.cssCompactSet[destCssFilename];
      if (isString(srcCssFilenames)) {
        srcCssFilenames= [srcCssFilenames];
      }
      cssCompactList.push([
        computePath(destCssFilename, destBasePath), 
        srcCssFilenames.map(function(filename){return computePath(filename, basePath);})]);
    }
    cssCompactList.sort(function(lhs, rhs){return lhs[0] < rhs[0] ? -1  : (lhs[0] > rhs[0] ? 1 : 0);});
    bc.cssCompactList= cssCompactList;
    delete bc.cssCompactSet;

    bc.sandbox= computePath(bc.sandbox || config.sandbox, basePath);
    bc.backup= (bc.backup || config.backup) && computePath(bc.backup || config.backup, basePath);

    bc.startTimestamp= new Date();

    bc.jobs= {};

    // bc.destDirs says directories that will be written to by the build
    bc.destDirs= [];
  },

  mix= function(dest, src) {
    dest= dest || {};
    src= src || {};
    for (var p in src) src.hasOwnProperty(p) && (dest[p]= src[p]);
    return dest;
  },

  mixedBuildProps= "packageMap.paths.modules.loaderConfig.loaderHasMap.staticHasFlags.buildFlags.procMap".split("."),

  mixBuild= function(src) {
    // the build control properties...
    //   packages, packagePaths, packageMap, paths, modules, loaderConfig, loaderHasMap, staticHasFlags, buildFlags, procMap
    // ...are mixed; all others are over-written
    for (var p in src) {
      if (src.hasOwnProperty(p) && !/(packages)|(packagePaths)|(packageMap)|(paths)|(modules)|(loaderConfig)|(loaderHasMap)|(staticHasFlags)|(buildFlags)|(procMap)/.test(p)) {
        bc[p]= src[p];
      }
    }

    // process packagePaths before packages since packagePaths is syntax sugar for packages
    // and if the user wants to override an existing package, the long form is more-likely authoritative
    for (var base in src.packagePaths) {
      src.packagePaths[base].forEach(function(packageInfo) {
        if (isString(packageInfo)) {
          packageInfo= {name:packageInfo};
        }
        packageInfo.location= catPath(cleanupPath(base), cleanupPath(packageInfo.name));
        var name= packageInfo.name || "*";
        bc.packages[name]= mix(bc.packages[name], pack);
      });
    };
    (src.packages || []).forEach(function(pack) {
      if (isString(pack)) {
        pack= {name:pack};
      }
      var name= pack.name || "*";
      bc.packages[name]= mix(bc.packages[name], pack);
    });

    mixedBuildProps.forEach(function(prop) {
      mix(bc[prop], src[prop]);
    });
  };

// initialize the build log
bc.messages= [];
bc.log= function(message) {
  bc.messages.push(message);
  if (bc.showLog || true) {
    console.log(message);
  }
};
bc.logWarn= function(message) {
  message= "WARN: " + message;
  bc.messages.push(message);
  console.log(message);
};
bc.logError= function(message) {
  message= "ERROR: " + message;
  bc.messages.push(message);
  console.log(message);
};

// some required initialization
mixedBuildProps.forEach(function(prop) {
  bc[prop]= bc[prop] || {};
});

// default build control object gives packages as a vector; convert to a map
var packages= {};
(bc.packages || []).forEach(function(pack) {
  if (isString(pack)) {
    pack= {name:pack};
  }
  var name= pack.name || "*";
  packages[name]= pack;
});
bc.packages= packages;

// additional build control objects are mixed into the build control object in the order they appeared on the command line
args.build.forEach(function(item) {
  var build= 0;
  if (item.build) {
    build= item.build;
    delete item.build;
  }
  mixBuild(item);
  build && mixBuild(build);
});

// specific command line switches have the highest priority
"basePath.destBasePath.destPackageBasePath.destroyBackups.amdLoader.amdLoaderConfig.destroyBackups.dump.check".split(".").forEach(function(p) {
  if (args.hasOwnProperty(p)) {
    bc[p]= args[p];
  }
});

cleanAndComputeBuildInfo();
return bc;
});
