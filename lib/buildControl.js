define(["args", "config", "./fileUtils", "./defaultBuildControl"], function(args, config, fileUtils, bc) {
var
  isString= function(it) {
    return typeof it === "string";
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

      computePath= function(path, base) {
        return compactPath((!base || isAbsolutePath(path)) ? cleanupPath(path) : catPath(base, cleanupPath(path)));
      },

      normalizeCopyDirs= function(vector, srcBase, destBase) {
        // vector is a vector of [src, dest] pairs; relative names are relative to srcBase and destBase, repectively
        return (vector || []).map(function(item) {
          var dest= computePath(item[1], destBase);
          dirs.push(dest);
          return [computePath(item[0], srcBase), dest];
        });
      },

      normalizeCopyFiles= function(vector, srcBase, destBase) {
        // vector is a vector of [src, dest] filenames; relative names are relative to srcBase and destBase, repectively
        return (vector || []).map(function(item) {
          var dest= computePath(item[1], destBase);
          dirs.push(getFilepath(dest));
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

    // unshift any packagePaths into the packages vector; unshift because packagePaths
    // is syntax sugar for packages and if the user wants to override an existing package, the
    // long form is more-likely authoritative
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
    // Note, that it is possible that the configuration gives multiple info objects for
    // the same package. In that case, the last one wins.
    var packages= {};
    bc.packageMap= {};
    bc.packages.forEach(function(src) {
      // calculate the precise (name, location, lib, main, mappings) for a package
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

      // exclude gives a vector of regexs to that give filenames to exclude from automatic module discovery
      info.exclude= src.exclude || [];
      
      // dest says where to output the compiled code stack
      info.destName= src.destName || info.srcName;
      info.destLib= src.destLib || info.srcLib;
      info.destMain= src.destMain || info.srcMain;
      info.destUrlMap= src.destUrlMap || src.urlMap || [];
      info.destLocation= computePath(src.destLocation || info.destName, destPackageBase);

      // copyDirs/copyFiles just like global, except relative to the info.(src|dest)Location
      info.copyDirs= normalizeCopyDirs(info.copyDirs, info.srcLocation, info.destLocation);
      info.copyFiles= normalizeCopyFiles(info.copyFiles, info.srcLocation, info.destLocation);

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

    // calculate each base director that will receive output
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
    for (var p in src) src.hasOwnProperty(p) && (dest[p]= src[p]);
    return dest;
  },

  mixBuild= function(src) {
    for (var p in src) {
      if (!/(packages)|(modules)|(loaderConfig)|(loaderHasMap)|(staticHasFlags)|(buildFlags)/.test(p)) {
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
    bc.buildFlags= mix(bc.buildFlags, src.buildFlags || {});
    bc.procMap= mix(bc.procMap, src.procMap || {});
  };

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
