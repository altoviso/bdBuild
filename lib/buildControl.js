define(["./argv", "./fileUtils", "./defaultBuildControl", "./gates", "./stringify"], function(args, fileUtils, defaultBuildControl, gates, stringify) {
  // the first order of business is constructing the raw build control object...
  var
    // alias some fileUtils functions to local variables
    getFilename= fileUtils.getFilename,
    cleanupPath= fileUtils.cleanupPath,
    compactPath= fileUtils.compactPath,
    isAbsolutePath= fileUtils.isAbsolutePath,
    catPath= fileUtils.catPath,

    computePath= function(path, base) {
      path= cleanupPath(path);
      return isAbsolutePath(path) ? compactPath(path) : compactPath(catPath(base, path));
    },

    isString= function(it) {
      return typeof it === "string";
    },

    isEmpty= function(it) {
      for (var p in it) return false;
      return true;
    },

    mix= function(dest, src) {
      dest= dest || {};
      src= src || {};
      for (var p in src) dest[p]= src[p];
      return dest;
    },

    // this is the build control object that will control the entire build process
    bc= {
      paths:{},
      packageMap:{},
      files:[],
      dirs:[],
      trees:[],
      pathTransforms:[],
      pluginMap:[],
      transformConfig:{},
      transformMap:{},
      transformJobsMap:[],
      loaderConfig:{},
      staticHasFlags:{},
      buildFlags:{},
      replacements:[],
      compactCssSet:{},

      // resources
      resources:{},
      resourcesByDest:{},
  
      // initialize the default build log implementation
      errorCount:0,
      warnCount:0,
      messages:[],
  
      log:function(message) {
        bc.messages.push(message);
        if (bc.showLog || true) {
          console.log(message);
        }
      },
  
      logWarn: function(message) {
        bc.warnCount++;
        message= "WARN: " + message;
        bc.messages.push(message);
        console.log(message);
      },
  
      logError: function(message) {
        bc.errorCount++;
        message= "ERROR: " + message;
        bc.messages.push(message);
        console.log(message);
      },

      startTimestamp: new Date()
    },

    mixPackage= function(packageInfo) {
      // the default package is stored at "*"
      var name= packageInfo.name || "*";
      // notice that we only overwrite package properties that are given
      bc.packageMap[name]= mix(bc.packageMap[name], packageInfo);
    },
  
    // mix a build control object into the global build control object
    mixBuildControlObject= function(src) {
      // the build control properties...
      //   paths, packages, packagePaths, packageMap, pluginProcs, transformMap, loaderConfig, staticHasFlags, buildFlags
      // ...are mixed one level deep; all others are over-written
      for (var p in src) {
        if (!/(paths)|(packages)|(packagePaths)|(packageMap)|(pluginProcs)|(transformMap)|(loaderConfig)|(staticHasFlags)|(buildFlags)/.test(p)) {
          bc[p]= src[p];
        }
      }
  
      // packagePaths and packages require special processing to get their contents into packageMap; do that first...
      // process packagePaths before packages before packageMap since packagePaths is less specific than
      // packages is less specific than packageMap. Notice that attempts to edit an already-existing package
      // only edits specific package properties given (see mixPackage, above)
      for (var base in src.packagePaths) {
        src.packagePaths[base].forEach(function(packageInfo) {
          if (isString(packageInfo)) {
            packageInfo= {name:packageInfo};
          }
          packageInfo.location= catPath(base, packageInfo.name);
          mixPackage(packageInfo);
        });
      };
      (src.packages || []).forEach(function(packageInfo) {
          if (isString(packageInfo)) {
            packageInfo= {name:packageInfo};
          }
          mixPackage(packageInfo);
      });
  
      // the rest of the one-level-deep mixers require no special processing
      ["paths","pluginMap","transformMap","loaderConfig","staticHasFlags","buildFlags"].forEach(function(p) {
        bc[p]= mix(bc[p], src[p]);
      });
    };

  //mix the default build control object provided by bdBuild/defaultBuildControl
  mixBuildControlObject(defaultBuildControl);

  // for each build control object in args, mix into bc in the order they appeared on the command line
  args.buildControlScripts.forEach(function(item) {
    mixBuildControlObject(item);
  });

  if (!isEmpty(bc.packageMap) && !bc.noDefaultPackage && !bc.packageMap["*"]) {
    // the default package was not explicitly given; therefore, provide it
    bc.packageMap["*"]= {
      // the default package
      name:"",
      lib:"",
      main:"",
      location:"",
      destName:""
    };
  }

  // lastly, explicit command line switches override any read build control objects
  for (var argName in args) if (argName!="build") {
    bc[argName]= args[argName];
  }

  //
  // at this point the raw build control object has been fully initialized; clean it up and look for errors...
  //

  // compute basePath; it is the root of all relative paths; recall from bdBuild/argv
  // The value of bc.basePath can come from several locations (ranked most-preferred to least-preferred)
  //
  //   1. command line argument "--base-path"
  //   2. bc.build.baseTree[0]
  //   3. bc.build.baseDir[0]
  //   4. bc.build.basePath
  //   5. bc.baseTree[0]
  //   6. bc.baseDir[0]
  //   7. bc.basePath

  var destBasePath= 0;
  function resolveBasePathPair(o, p) {
    var pathPair= o && o[p];
    if (typeof pathPair == "string") {
      destBasePath= pathPair + (bc.basePathSuffix || "-build");
      o[p]= [pathPair, bc.destBasePath];
      return pathPair;
    } else if (pathPair instanceof Array) {
      destBasePath= pathPair[1];
      return pathPair[0];
    }
    return 0;
  }
  bc.basePath= compactPath(cleanupPath(
    args.basePath || 
    resolveBasePathPair(bc.build, "baseTree") ||
    resolveBasePathPair(bc.build, "baseDir") ||
    (bc.build && bc.build.basePath) ||
    resolveBasePathPair(bc, "baseTree") ||
    resolveBasePathPair(bc, "baseDir") ||
    bc.basePath));
  // the other source path; easy...
  bc.pagePath= computePath(bc.pagePath || bc.basePath, bc.basePath);

  // if basePath was found in a pair, then the only way to override destBasePath is through the command line
  bc.destBasePath= computePath(
    args.destBasePath ||
    (bc.build && bc.build.destBasePath) ||
    bc.destBasePath ||
    (bc.basePath + (bc.basePathSuffix || "-build")), bc.basePath);
  // the other dest path; easy...
  bc.destPackageBasePath= computePath(bc.destPackageBasePath || "./packages", bc.destBasePath);

  var cleanupFilenamePair= function(item, srcBasePath, destBasePath, hint) {
    var result;
    if (isString(item)) {
      result= [computePath(item, srcBasePath), computePath(item, destBasePath)];
    } else {
      result= [computePath(item[0], srcBasePath), computePath(item[1], destBasePath)].concat(item.slice(2));
    }
    if (!isAbsolutePath(result[0]) || !isAbsolutePath(result[1])) {
      bc.logError("Unable to compute an absolute path for an item in " + hint + " (" + item + ")");
    }
    return result;
  };

  // compute files, dirs, and trees
  (function () {
    for (var property in {files:1, dirs:1, trees:1}) {
      bc[property]= bc[property].map(function(item) {
        return cleanupFilenamePair(item, bc.basePath, bc.destBasePath, property);
      });
    }
  })();

  // the default for bc.loader[1] is computed slightly differently than files et al
  if (isString(bc.loader)) {
    bc.loader= [bc.loader, "./" + getFilename(bc.loader)];
  }
  if (bc.loader) {
    bc.loader= cleanupFilenamePair(bc.loader, "loader");
  }

  // cleanup the compactCssSet (if any)
  (function() {
    var cleanSet= {}, src, dest;
    for (src in bc.compactCssSet) {
      dest= bc.compactCssSet[src];
      cleanSet[computePath(src, bc.basePath)]= isString(dest) ? computePath(dest, bc.destBasePath) : dest;
    }
    bc.compactCssSet= cleanSet;
  })();

  // clean up the package objects and fully compute each field
  for (var packageName in bc.packageMap) {
    var src= bc.packageMap[packageName];
    // build up info to tell all about a package; name, lib, main, urlMap, packageMap, location
    // are semantically identical to definitions used by AMD loader
    src.srcName= src.name;
    src.srcLib= isString(src.lib) ? src.lib : "lib";
    src.srcMain= isString(src.main) ? src.main : "main";
    src.srcUrlMap= src.urlMap || [];
    src.srcPackageMap= src.packageMap || 0;
    // src.name ? is for the default package in the next statement whcih has location of bc.basePath
    src.srcLocation= computePath(src.location || (src.name ? "./" + src.name : bc.basePath), bc.basePath);

    // exclude gives a vector of regexs to that give filenames to exclude from automatic module discovery
    src.exclude= src.exclude || [];

    // dest says where to output the compiled code stack
    src.destName= src.destName || src.srcName;
    src.destLib= src.destLib || src.srcLib;
    src.destMain= src.destMain || src.srcMain;
    src.destUrlMap= src.destUrlMap || src.urlMap || [];
    src.destPackageMap= src.destPackageMap || src.srcPackageMap;
    src.destLocation= src.name ? computePath(src.destLocation || ("./" + src.destName), bc.destPackageBasePath) : bc.destBasePath;

    if (!src.dirs && !src.trees) {
      // copy the lib directory; don't copy any hidden directorys (e.g., .git, .svn)
      if (src.srcName) {
        // regular package
        src.trees= [[computePath(catPath(src.srcLocation, src.srcLib), bc.basePath), computePath(catPath(src.destLocation, src.destLib), bc.destPackageBasePath), "*/.*"]];
      } else {
        // default package
        src.trees= [[bc.basePath, bc.destBasePath, "*/.*"]];
      }
    }

    // filenames, dirs, trees just like global, except relative to the src.(src|dest)Location
    (function () {
      for (var property in {files:1, dirs:1, trees:1}) {
        src[property]= (src[property] || []).map(function(item) {
          return cleanupFilenamePair(item, src.srcLocation, src.destLocation, property + " in package " + src.srcName);
        });
      }
    })();
  }

  // figure out the real load value; lots of possibilities for requirejs compat
  bc.load= bc.loaderConfig.load || bc.load;

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
      layer.boot= computePath(layer.boot, bc.destBasePath);
    };
    fixedLayers[mid]= layer;
  }
  bc.layers= fixedLayers;

  bc.locales= bc.loaderConfig.locales || bc.locales || [];

  // for the static has flags, -1 means its not static; this gives a way of combining several static has flag sets
  // and still allows later sets to delete flags set in earlier sets
  var deleteStaticHasFlagSet= [];
  for (p in bc.staticHasFlags) if (bc.staticHasFlags[p]==-1) deleteStaticHasFlagSet.push(p);
  deleteStaticHasFlagSet.forEach(function(flag){delete bc.staticHasFlags[flag];});

  // dump bc (if requested) before changing gateNames to gateIds below
  if (bc.check) {
    // don't dump out private properties used by bdBuild--they'll just generate questions
    var dump= {};
    for (p in bc) if (!/buildControlScripts|check|errorCount|log|logError|logWarn|messages|startTimestamp|version|warnCount/.test(p)) {
      dump[p]= bc[p];
    }
    console.log(stringify(dump).result);
  }

  (function() {
    // check that each transform references a valid gate
    var
      transformMap= bc.transformMap,
      gateId;
    for (var transformId in transformMap) {
      // each item is a [AMD-MID, gateName] pair
      if (!(gateId= gates.gate[transformMap[transformId][1]])) {
        bc.logError("Unknown gate (" + transformId + ":" + transformMap[transformId] + ") given in transformMap");
      } else {
        transformMap[transformId][1]= gateId;
      }
    }
  })();

  (function() {
    // check that that each transformId referenced in transformJobsMaps references an existing item in transformMap
    // ensure proper gate order of the transforms given in transformJobsMaps; do not disturb order within a given
    // gate--this is the purview of the user
    var transformMap= bc.transformMap;
    bc.transformJobsMap.forEach(function(item) {
      // item is a [predicate, vector of transformId] pairs
      var error= false;
      var tlist= item[1].map(function(id) {
        // item is a transformId
        if (transformMap[id]) {
          // return a [trandformId, gateId] pair
          return [id, transformMap[id][1]];
        } else {
          error= true;
          bc.logError("Unknown transform (" + transformMap[id] + ") in transformJobsMap.");
          return 0;
        }
      });
      // tlist is a vector of [transformId, gateId] pairs than need to be checked for order
      if (!error) {
        for (var i= 0, end= tlist.length - 1; i<end;) {
          if (tlist[i][1]>tlist[i+1][1]) {
            var t= tlist[i];
            tlist[i]= tlist[i+1];
            tlist[i+1]= t;
            i && i--;
          } else {
            i++;
          }
        }
        // now replace the vector of transformIds with the sorted list
        item[1]= tlist;
      }
    });
  })();

  return bc;
});
