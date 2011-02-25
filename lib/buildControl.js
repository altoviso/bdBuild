define(["./argv", "./fileUtils", "./defaultBuildControl", "./gates", "./stringify", "loader"], function(args, fileUtils, defaultBuildControl, gates, stringify, loader) {
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
      return compactPath(isAbsolutePath(path) ? path : catPath(base, path));
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
      destPathTransforms:[],
      pluginMap:[],
      transformConfig:{},
      transformMap:{},
      transformJobsMap:[],
      loaderConfig:{},
      staticHasFlags:{},
      buildFlags:{},
      replacements:{},
      compactCssSet:{},

      // resources
      resources:{},
      resourcesByDest:{},
      amdResources:{},
  
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
    var
      temp= mix({}, item),
      build= item.build;
    delete temp.build;
    mixBuildControlObject(temp);
    build && mixBuildControlObject(build);
  });


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
    resolveBasePathPair(bc, "baseTree") ||
    resolveBasePathPair(bc, "baseDir") ||
    bc.basePath));
  // the other source path; easy...
  bc.pagePath= computePath(bc.pagePath || bc.basePath, bc.basePath);

  // if basePath was found in a pair, then the only way to override destBasePath is through the command line
  bc.destBasePath= computePath(
    args.destBasePath ||
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

  // cleanup the replacements (if any)
  (function() {
    var cleanSet= {}, src, dest;
    for (src in bc.replacements) {
      cleanSet[computePath(src, bc.basePath)]= bc.replacements[src];
    }
    bc.replacements= cleanSet;
  })();

  (function() {
    // the purpose of this routine is to clean up bc.packages, bc.packageMap, and bc.paths so they can be used just as in bdLoad

    // if there is at least one package and the default package was not explicitly given provide it
    if (!isEmpty(bc.packageMap) && !bc.noDefaultPackage && !bc.packageMap["*"]) {
      bc.packageMap["*"]= {name:"", lib:"", main:"", location:""};
    }
    if (bc.packageMap["*"]) {
      // overridable defaults for lib, location, destLib destLocation
      // name, main, destName, destMain are unconditionally ""
      bc.packageMap["*"]= mix(mix({lib:".", location:bc.basePath, destLib:".", destLocation:bc.destBasePath}, bc.packageMap["*"]), {name:"", main:"", destName:"", destMain:""});
    }
    // so far, we've been using bc.packageMap to accumulate package info as it is provided by packagePaths and/or packages
    // in zero to many build control scripts. This routine moves each package config into bc.packages which is a map
    // from package name to package config (this is different from the array the user uses to pass package config info). Along 
    // the way, each package config object is cleaned up and all default values are calculated. Finally, the bdLoad-required 
    // global packageMap (a map from package name to package name) is computed.
    bc.packages= bc.packageMap;
    bc.destPackages= {};
    bc.packageMap= {};
    bc.destPackageMap= {};
    for (var packageName in bc.packages) {
      var pack= bc.packages[packageName];
      // build up info to tell all about a package; all properties semantically identical to definitions used by bdLoad
      // note: pack.name=="" for default package
      pack.lib= isString(pack.lib) ? pack.lib : "lib";
      pack.main= isString(pack.main) ? pack.main : "main";
      pack.location= computePath(pack.location || (pack.name ? "./" + pack.name : bc.basePath), bc.basePath);
      pack.packageMap= pack.packageMap || 0;
      pack.mapProg= loader.computeMapProg(pack.packageMap);
      pack.pathTransforms= pack.pathTransforms || [];
  
      // dest says where to output the compiled code stack
      var destPack= bc.destPackages[pack.name || "*"]= {
        name:pack.destName || pack.name,
        lib:pack.destLib || pack.lib,
        main:pack.destMain || pack.main,
        location:computePath(pack.destLocation || ("./" + (pack.destName || pack.name)), bc.destPackageBasePath),
        packageMap:pack.destPackageMap || pack.packageMap,
        mapProg:loader.computeMapProg(pack.destPackageMap),
        pathTransforms:pack.destPathTransforms || pack.pathTransforms
      };
  
      if (!pack.dirs && !pack.trees) {
        // copy the lib directory; don't copy any hidden directorys (e.g., .git, .svn) or temp files
        pack.trees= [[compactPath(catPath(pack.location, pack.lib)), compactPath(catPath(destPack.location, destPack.lib)), "*/.*", "*~"]];
      } // else the user has provided explicit copy instructions
  
      // filenames, dirs, trees just like global, except relative to the pack.(src|dest)Location
      for (var property in {files:1, dirs:1, trees:1}) {
        pack[property]= (pack[property] || []).map(function(item) {
          return cleanupFilenamePair(item, pack.location, destPack.location, property + " in package " + pack.name);
        });
      }
      if (pack.name) {
        // don't try to put the default package (named "") in the packageMap
        bc.packageMap[pack.name]= pack.name;
        bc.destPackageMap[destPack.name]= destPack.name;
      }
    }
    // now that bc.packageMap is initialized...
    bc.packageMapProg= loader.computeMapProg(bc.packageMap);
    bc.destPackageMapProg= loader.computeMapProg(bc.destPackageMap);

    // get this done too...
    bc.pathsMapProg= loader.computeMapProg(bc.paths);
    bc.destPathsMapProg= loader.computeMapProg(bc.destPaths || bc.paths);

    // add some methods to bc to help with resolving AMD module info
    bc.srcModules= {};
    bc.getSrcModuleInfo= function(mid, referenceModule) {
      var result= loader.getModuleInfo(mid, referenceModule, bc.packages, bc.srcModules, bc.basePath + "/", bc.pagePath, bc.packageMapProg, bc.pathsMapProg, bc.pathTransforms, true);
      if (result.pid=="") {
        result.pack= bc.packages["*"];
      }
      return result;
    };

    bc.nameToUrl= function(name, ext, referenceModule) {
      // slightly different algorithm depending upon whether or not name contains
      // a filetype. This is a requirejs artifact which we don't like.
      // note: this is only needed to find source modules, never dest modules
      var
        match= name.match(/(.+)(\.[^\/]+)$/),
        moduleInfo= bc.getSrcModuleInfo(match && match[1] || name, referenceModule),
        url= moduleInfo.url;
      // recall, getModuleInfo always returns a url with a ".js" suffix; therefore, we've got to trim it
      return url.substring(0, url.length-3) + (ext ? ext : (match ? match[2] : ""));
    },      

    bc.destModules= {};
    bc.getDestModuleInfo= function(mid, referenceModule) {
      // note: bd.destPagePath should never be required; but it's included for completeness and up to the user to provide it if some transform does decide to use it
      var result= loader.getModuleInfo(mid, referenceModule, bc.destPackages, bc.destModules, bc.destBasePath + "/", bc.destPagePath, bc.destPackageMapProg, bc.destPathsMapProg, bc.destPathTransforms, true);
      if (result.pid=="") {
        result.pack= bc.packages["*"];
      }
      return result;
    };
  })();


  // a layer is a module that should be written with all of its dependencies, as well as all modules given in
  // the include vector together with their dependencies, excluding modules contained in the exclude vector and their dependencies
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
  if (bc.check) (function() {
    // don't dump out private properties used by bdBuild--they'll just generate questions
    var 
      dump= {},
      internalProps= {
        buildControlScripts:1,
        check:1,
        destModules:1,
        destPackageMapProg:1,
        destPackages:1,
        destPathsMapProg:1,
        errorCount:1,
        getDestModuleInfo:1,
        getSrcModuleInfo:1,
        log:1,
        logError:1,
        logWarn:1,
        messages:1,
        nameToUrl:1,
        packageMap:1,
        packageMapProg:1,
        packages:1,
        pathsMapProg:1,
        resources:1,
        resourcesByDest:1,
        srcModules:1,
        startTimestamp:1,
        version:1,
        warnCount:1
      };
    for (var p in bc) if (!internalProps[p]) {
      dump[p]= bc[p];
    }
    var packages= dump.packages= [];
    for (p in bc.packages) {
      var 
        pack= bc.packages[p],
        destPack= bc.destPackages[p];
      packages.push({
        name:pack.name, lib:pack.lib, main:pack.main, location:pack.location, modules:pack.modules||{},
        destName:destPack.name, destLib:destPack.lib, destMain:destPack.main, destLocation:destPack.location
      });
    }
    console.log(stringify(dump).result + "\n");
  })();

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
          bc.logError("Unknown transform (" + id + ") in transformJobsMap.");
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

  if (args.unitTest=="dumpbc") {
    console.log(stringify(bc).result + "\n");
  }

  return bc;
});
