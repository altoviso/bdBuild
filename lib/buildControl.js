define(["args", "config", "./fileUtils", "./defaultBuildControl"], function(args, config, fileUtils, bc) {
var
  getFilename= fileUtils.getFilename,
  getFilepath= fileUtils.getFilepath,
  cleanupPath= fileUtils.cleanupPath,
  compactPath= fileUtils.compactPath,
  isAbsolutePath= fileUtils.isAbsolutePath,
  catPath= fileUtils.catPath,

  isString= function(it) {
    return typeof it === "string";
  },

  cleanAndComputeBuildInfo= function() {
    // Clean up the configuration and compute default values:
    var
      // this will be the list of directories that will receive output
      dirs= [],

      computePath= function(path, base) {
        return compactPath((!base || isAbsolutePath(path)) ? cleanupPath(path) : catPath(base, cleanupPath(path)));
      },

      normalizeCopyDirs= function(vector, srcBase, destBase) {
        // vector is a vector of [src, dest] pairs; relative names are relative to srcBase and destBase, repectively
        return (vector || []).map(function(item) {
          var dest= computePath(item[1], destBase);
          return [computePath(item[0], srcBase), dest];
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
      destPackageBase= bc.destPackageBasePath= computePath(bc.destPackageBasePath, destBasePath);

    if (!destBasePath || !destBasePath.length) {
      console.log('You must specify a destination destBasePath path (use the "--base" build option or build script "destBasePath" property).');
      throw new Error("failed to provide destination base path");
    }
    dirs.push(destBasePath);
    dirs.push(destPackageBase);

    if (bc.srcLoader) {
      bc.srcLoader= computePath(bc.srcLoader, bc.basePath);
      bc.loaderName= getFilename(bc.srcLoader);
      bc.destLoader= bc.destLoader ? computePath(bc.destLoader, destBasePath) : computePath("./" + bc.loaderName, destBasePath);
      dirs.push(getFilepath(bc.destLoader));
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
      src.destName= src.destName || src.srcName;
      src.destLib= src.destLib || src.srcLib;
      src.destMain= src.destMain || src.srcMain;
      src.destUrlMap= src.destUrlMap || src.urlMap || [];
      src.destLocation= src.name ? computePath(src.destLocation || src.destName, destPackageBase) : destBasePath;

      if (!src.noCopyLib && !bc.buildFlags.singleFile) {
        if (src.srcName) {
          // regular package
          bc.copyDirs.push([catPath(src.srcLocation, src.srcLib), catPath(src.destLocation, src.destLib)]);
        } else {
          // default package
          bc.copyDirs.push([basePath, destBasePath]);
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

    // calculate each base director that will receive output
    bc.copyDirs.forEach(function(pair) {
      dirs.push(pair[1]);
    });
    bc.copyFiles.forEach(function(pair) {
      dirs.push(getFilepath(pair[1]));
    });
    dirs.sort();
    var
      next, 
      current= dirs.shift(),
      bases= bc.destBases= [current];
    while (dirs.length) {
      next= dirs.shift();
      if (next.indexOf(current)) {
        // next is *not* a decendent of current
        current= next;
        bases.push(current);
      }
    }

    // a sandbox is prepared for each dest base path and the build program writes
    // to the sandbox; the last step of the build backs up any content in the real locations
    // and then moves the sandboxes to the real locations. This algorithm ensures that
    // destination locations are guaranteeed either correctly filled or not touched
    var sandbox= computePath(bc.sandbox || config.sandbox, basePath);
    bases.forEach(function(destPath) {
      if (destPath.indexOf(sandbox)==0 || sandbox.indexOf(destPath)==0)  {
        console.log('The sandbox directory "' + sandbox + '" intersects with the the destination directory "' + destPath + '". The sandbox and destination directories may not intersect.');
        throw new Error("Illegal sandbox or destination path in configuration or build script.");
      }
    });
    bc.sandbox= sandbox + "/" + fileUtils.getTimestamp(bc.startTimestamp);
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

//make sure the default bc has defined all the map props
mixedBuildProps.forEach(function(prop) {
  bc[prop]= bc[prop] || {};
});

// default build info (and explicit build info) gives packages as a vector; convert to a map
var packages= {};
(bc.packages || []).forEach(function(pack) {
  if (isString(pack)) {
    pack= {name:pack};
  }
  var name= pack.name || "*";
  packages[name]= pack;
});
bc.packages= packages;

// additional build control objects are mixed into the build control object
// in the order they appeared on the command line
args.build.forEach(function(item) {
  var build= 0;
  if (item.build) {
    build= item.build;
    delete item.build;
  }
  mixBuild(item);
  build && mixBuild(build);
});

// specific command line switch have the highest priority
"basePath.destBasePath.destPackageBasePath.destroyBackups.amdLoader.amdLoaderConfig.destroyBackups.dump.check".split(".").forEach(function(p) {
  if (args.hasOwnProperty(p)) {
    bc[p]= args[p];
  }
});
bc.startTimestamp= new Date();

cleanAndComputeBuildInfo();
return bc;
});
