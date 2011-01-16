///
// \module bdBuild/packageJob
//
define(["child_process", "loader", "bdBuild/fileUtils", "bdBuild/buildControl", "bdParse"], function(child_process, loader, fileUtils, bc, bdParse) {
  var
    spawn= child_process.spawn,
  
    catPath= fileUtils.catPath,
    getFilepath= fileUtils.getFilepath,

    isFunction= loader.isFunction,
    computeMapProg= loader.computeMapProg,
    runMapProg= loader.runMapProg,
    compactPath= loader.compactPath,
    transformPath= loader.transformPath,
  
    modules= {},
    badModules= bc.badModules= {},

    getModuleInfo= function(mid, referenceModule) {
      var result= loader.getModuleInfo(mid, referenceModule, bc.packages, modules, bc.basePath + "/", bc.pagePath, bc.packageMapProg, bc.pathsMapProg, bc.pathTransforms);
      if (result.pid=="") {
        result.pack= bc.packages["*"];
      }
      return result;
    },  

    getPluginInfo= function(mid) {
      var match= mid.match(/^([^\!]+)\!(.+)$/);
      if (match) {
        return [match[1], match[2]];
      } else {
        return 0;
      };
    },
  
    logModuleError= function(module, error) {
      delete module.text;
      delete module.tokens;
      delete module.tree;
      module.error= error;
      bc.logWarn("Module " + module.pack.srcName + "/" + module.mid + "(" + module.srcFilename + "): " + error);
    },
  
    checkForMissingDepsDone= 0,
  
    checkForMissingDeps= function() {
      if (checkForMissingDepsDone) {
        return;
      }
      checkForMissingDepsDone= 1;
      for (var p in modules) {
        if (modules[p].error) {
          badModules[p]= 1;
        }
      }
      var moreBadModules= true;
      while (moreBadModules) {
        moreBadModules= false;
        for (p in modules) if (!badModules[p]) {
          var module= modules[p];
          module.deps.forEach(function(dep) {
            if (badModules[dep.pqn]) {
              logModuleError(module, "missing dependency " + dep.pqn.replace(/\*/, "/") + ".");
              moreBadModules= true;
              badModules[p]= 1;
            }
          });
        }
      }
    },

    getResolvedText= function(
      layerModule
    ) {
      var
        visited= {},
        writePhase= false,
        cacheText= [],
        traverse= function(module) {
          var pqn= module.pqn;
          if (visited[pqn]) {
            return;
          }
          visited[pqn]= 1;
          if (writePhase && module!==layerModule) {
            cacheText.push("\"" + module.pqn + "\":function(){\n" + module.resultText + "\n\n}\n");
          }
          for (var deps= module.deps, i= 0; deps && i<deps.length; traverse(deps[i++]));
        };

      layerModule.layerExclude.forEach(function(mid) { 
        var module= modules[getModuleInfo(mid).pqn];
        if (!module) {
          bc.logError("exclude module (" + mid + ") not found while processing layer module (" + layerModule.pqn + ")");
        } else {
          traverse(module);
        }
      });
      writePhase= true;
      traverse(layerModule);
      return (cacheText.length ? ("require({\ncache:{\n" + cacheText.join(",\n\n") + "}});\n\n") : "") + layerModule.resultText;
    },
  
    readModule= function(
      cb
    ) {
      bc.waiting++;
      var thisObject= this;
      fileUtils.read(this.srcFilename, function(err, text) {
        if (!err) {
          try {
            thisObject.text= text;
            bc.jsResourceTextProc(thisObject);
            thisObject.tokens= bdParse.tokenize(thisObject.text);
            bc.jsResourceTokenProc(thisObject);
            thisObject.tree= bdParse.parse(thisObject.tokens);
            bc.jsResourceAstProc(thisObject);
          } catch (e) {
            err= e;
          }
        }
        if (err) {
          logModuleError(thisObject, "unable to read module (" + err + ")");
        }
        //bc.log("read module " + thisObject.pqn + " from " + thisObject.srcFilename);
        cb(0);
      });
    },
  
    globalOptimizeModule= function(
      cb
    ) {
      checkForMissingDeps();
      this.resultText= !this.error && bdParse.deleteText(this.text, this.deleteList).join("\n");
      //bc.log("optimized module " + this.pqn);
    },
  
    writeModule= function(
      cb
    ) {
      if (!this.error) {
        bc.waiting++;
        var 
          thisObject= this,
          pack= this.pack,
          destFilename= bc.sandbox + catPath(pack.destLocation, pack.destLib) + "/" + this.mid + ".js",
          text = this.layerExclude ? getResolvedText(this) : "//synthesized!\n" + this.resultText;
        fileUtils.write(destFilename, text, function(err) {
          if (err) {
            logModuleError(thisObject, err, "write");
          }
          //bc.log("wrote module " + thisObject.pqn + " to " + destFilename);
          cb(0);
        });
      }
    },

    getModule= function(
      mid,
      referenceModule
    ) {
      return startModule(mid, referenceModule, true);
    },
  
    startModule= function(
      mid, 
      referenceModule,
      read
    ) {
      // this routine is called during the start phase, so it does *not* automatically call module.read
      var pluginInfo= getPluginInfo(mid);
      if (pluginInfo) {
        var pluginModule= startModule(pluginInfo[0], referenceModule, read);
        if (pluginModule.startPluginResource) {
          return pluginModule.startPluginResource(pluginInfo[1], referenceModule, read);
        } else {
          bc.logWarn("plugin (" + pluginModule.path + ") did not have capability to build a dependent resource (" + pluginInfo[1] + ").");
          // at least dependencies can process the plugin as a dependency...
          return pluginModule;
        }
      }
      var
        moduleInfo= getModuleInfo(mid, referenceModule),
        module= modules[moduleInfo.pqn];
      if (!module) {
        module= {
          pid:moduleInfo.pid,
          mid:moduleInfo.mid,
          pqn:moduleInfo.pqn,
          pack:moduleInfo.pack,
          path:moduleInfo.path,
          deps:[],
          srcFilename:moduleInfo.url,
          read:readModule,
          globalOptimize:globalOptimizeModule,
          write:writeModule
        };
        var
          pack= moduleInfo.pack,
          pqn= moduleInfo.pqn;
        if (bc.plugins[moduleInfo.pqn]) {
          module.startPluginResource= bc.plugins[moduleInfo.pqn];
        }
        bc.destDirs.push(getFilepath(catPath(pack.destLocation, pack.destLib, module.path)));
        bc.jobs[pqn]= modules[pqn]= module;
        //bc.log("started module " + moduleInfo.pqn);
        if (read) {
          //starting a module demanded during the read phase, so press this module into the read phase
          module.read(bc.globalOptimize);
        }
      }
      return module;
    },
  
  //
  // TODOC: 
  // 
  // bc.jobs property names of the form "<pid>*<mid>" are reserved for module names; note:
  // 
  //   bc.jobs["*someModule"] is the module "someModule" in the default package
  //   bc.jobs["somePackage*"] is the main module for the package "somePackage"
  // 
  //   
  //
  
    read= function(
      cb
    ) {
    },
  
    globalOptimize= function(
      cb
    ) {
    },
  
    write= function(
      cb
    ) {
    },
  
    startPackage= function(
      pack,
      cb
    ) {
      pack.read= read;
      pack.globalOptimize= globalOptimize;
      pack.write= write;
      bc.waiting++;
      var 
        src= catPath(pack.srcLocation, pack.srcLib),
        find= spawn("find", ["-L", src, "-name", "*.js", "!", "-path", "*/nls/*"]),
        list= "";
      find.stdout.on('data', function (data) {
        list+= data.toString("ascii");
      });
      find.stderr.on('data', function (data) {
        console.log("find std err");
        console.log(data.toString("ascii"));
      });
      find.on("exit", function(code, signal) {
        if (!code) {
          // list holds all .js filenames contained in the tree rooted at the package location
          // that don't have /nls/ in the path; these are the automatically "discovered" modules for
          // this package
          list= bdParse.split(list);
  
          // exclude discovered modules as per explicit pack.exclude vector
          pack.exclude.forEach(function(filter) {
            list= list.map(function(filename) {
              return (!filename || filter.test(filename)) ? 0 : filename;
            });
          });
  
          // include discovered modules iff the mid resolved to the same filename that discovered the mid
          var 
            modules= {},
            srcLength= src.length + 1,
            prefix= pack.srcName + "/",
            // since the mid is not relative, the only thing the start module needs from the reference module is the package
            referenceModule= {pack:pack};
          list.forEach(function(filename) {
            if (filename) {
              // strip the package location path and the .js suffix...
              var mid= filename.substring(srcLength, filename.length-3);
              if (getModuleInfo(prefix+mid, referenceModule).url==filename) {
                modules[mid]= 1;
              } // else, mid does not map to filename; therefore, it's not a module...
                // ...or, at least it's not mid in this package owing to a mapping
            }
          });
  
          // further add modules as per explicit pack.modules vector
          pack.modules.forEach(function(mid) {
            modules[mid]= 1;
          });
  
          // add each module that survived the discovery algorithm as a job
          for (var mid in modules) {
            startModule(prefix+mid, referenceModule);
          }
          // always add the main module if the package info indicates there is one, but not for the default package
          if (pack.srcMain) {
            startModule(pack.srcName, referenceModule);
          }
        }
        cb(code);
      });
    },
  
    start= function(
      cb
    ) {
      bc.waiting++;

      if (bc.staticHasFlags["loader-createHasModule"]) {
        // put a fake has module in jobs since the real module is part of the loader
        bc.jobs["*has"]=  modules["*has"]= {
          pid:"",
          mid:"has",
          pqn:"*has",
          pack:0,
          path:"has",
          deps:[],
          srcFilename:"",
          read:0,
          globalOptimize:0,
          write:0
        };
      }
  
      // compute all the map programs before starting anything since processing one
      // package may need this information from another package
      bc.packageMapProg= computeMapProg(bc.packageMap);
      bc.pathsMapProg= computeMapProg(bc.paths);
      for (var p in bc.packages) {
        var pack= bc.packages[p];
        pack.srcMapProg= computeMapProg(pack.srcPackageMap);
        pack.destMapProg= computeMapProg(pack.destPackageMap || pack.srcPackageMap);

        // for the read phase, loader.getModuleInfo looks at the main, location, lib, mapProg, and pathsTransform
        // properties, not srcMain, srcLocation, etc. Therefore move as required; these will be twiddled again before the write phase
        pack.main= pack.srcMain;
        pack.location= pack.srcLocation;
        pack.lib= pack.srcLib;
        pack.mapProg= pack.srcMapProg || [];
        pack.pathTransforms= pack.srcPathTransforms || [];
      }

      // now that all the packages have been prepared; start each package processing its modules
      for (p in bc.packages) {
        startPackage((bc.jobs["**package*" + p]= bc.packages[p]), cb);
      }

      // a module with the layerExclude property (a vector of mid's) is a module that should be written with all of its
      // dependencies, excluding modules contained in the module dependency graph given by the modules given in layerExclude

      // request all the layer modules
      for (var mid in bc.layers) {
          startModule(mid, 0).layerExclude= bc.layers[mid];
      }

      // request all the modules in the load config option
      for (var load= bc.loaderConfig.load || [], i= 0; i<load.length; i++) {
        startModule(load[i]).layerExclude= load.slice(0, i);
      }

      cb(0);
    };

  return {
    start:start,
    getModule:getModule
  };
});
