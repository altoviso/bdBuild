///
// \module bdBuild/packageJob
//
define(["child_process", "loader", "bdBuild/fileUtils", "bdBuild/buildControl", "bdParse"], function(child_process, loader, fileUtils, bc, bdParse) {
  var
    spawn= child_process.spawn,
  
    catPath= fileUtils.catPath,
    getFilepath= fileUtils.getFilepath,
    compactPath= fileUtils.compactPath,

    isFunction= loader.isFunction,
    computeMapProg= loader.computeMapProg,
    runMapProg= loader.runMapProg,
    //TODO....compactPath= loader.compactPath,
    transformPath= loader.transformPath,
  
    modules= {},
    badModules= bc.badModules= {},

    getModuleInfo= function(mid, referenceModule) {
      var result= loader.getModuleInfo(mid, referenceModule, bc.packages, modules, bc.basePath + "/", bc.pagePath, bc.packageMapProg, bc.pathsMapProg, bc.pathTransforms, true);
      if (result.pid=="") {
        result.pack= bc.packages["*"];
      }
      return result;
    },  

    nameToUrl= function(name, ext, referenceModule) {
      // slightly different algorithm depending upon whether or not name contains
      // a filetype. This is a requirejs artifact which we don't like.
      var
        match= name.match(/(.+)(\.[^\/]+)$/),
        moduleInfo= getModuleInfo(match && match[1] || name, referenceModule),
        url= moduleInfo.url;
      // recall, getModuleInfo always returns a url with a ".js" suffix; therefore, we've got to trim it
      return url.substring(0, url.length-3) + (ext ? ext : (match ? match[2] : ""));
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

    computeLayerContents= function(
      layerModule
    ) {
      var
        includeSet= {},
        visited, 
        includePhase,
        traverse= function(module) {
          var pqn= module.pqn;
          if (visited[pqn]) {
            return;
          }
          visited[pqn]= 1;
          if (includePhase) {
            includeSet[pqn]= 1;
          } else {
            delete includeSet[pqn];
          }
          for (var deps= module.deps, i= 0; deps && i<deps.length; traverse(deps[i++]));
        };

      visited= {};
      includePhase= true;
      traverse(layerModule);     
      layerModule.layerInclude.forEach(function(mid) { 
        var module= modules[getModuleInfo(mid, layerModule).pqn];
        if (!module) {
          bc.logError("in layer " + layerModule.pqn + ", failed to find layer include module " + mid);
        } else {
          traverse(module);
        }
      });

      visited= {};
      includePhase= false;
      layerModule.layerExclude.forEach(function(mid) { 
        var module= modules[getModuleInfo(mid, layerModule).pqn];
        if (!module) {
          bc.logError("in layer " + layerModule.pqn + ", failed to find layer exclude module " + mid);
        } else {
          traverse(module);
        }
      });
      delete includeSet[layerModule.pqn];
      layerModule.layerSet= includeSet;
    },

    getLayerText= function() {
      if (this.layerText) {
        return this.layerText;
      }
      var 
        layerModule= this,
        cache= ["'" + this.pqn + "':function(){\n" + this.resultText + "\n}"],
        pluginResources= [];
      for (var p in layerModule.layerSet) {
        var module= modules[p];
        if (module) {
          if (module.pluginResource) {
            if (module.getCacheText) {
              pluginResources.push(module.getCacheText());
            } else {
              bc.logError("in layer " + layerModule.pqn + ", unable to write dependent plugin resource " + p + " (no ability to write this module to cache)");
            }
          } else {
            cache.push("'" + p + "':function(){\n" + module.resultText + "\n}");
          }
        } else {
          // shouldn't get here because we should've eliminated this module in the dependency tracing
          bc.logError("in layer " + layerModule.pqn + ", unable to find dependent module " + p);
        }
      }
      return (this.layerText= "\nrequire({cache:{\n" + cache.join(",\n") + "}});\n" + pluginResources.join("\n\n") + this.bootText);
    },

    getCacheText= function() {
      return this.resultText;
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
      if (this.layerExclude) {
        computeLayerContents(this);
      } 
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
          destFilename= bc.sandbox + this.destFilename,
          text = this.layerInclude ? this.getLayerText() : this.resultText;
        fileUtils.write(destFilename, text, function(err) {
          if (err) {
            logModuleError(thisObject, " unable to write module (" + err + ")");
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

    addModule= function(
      pqn,
      module
    ) {
      return bc.jobs[pqn] || (bc.jobs[pqn]= modules[pqn]= module);
    },
  
    startModule= function(
      mid, 
      referenceModule,
      read
    ) {
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
          getCacheText:getCacheText,
          read:readModule,
          globalOptimize:globalOptimizeModule,
          write:writeModule
        };
        var
          pack= moduleInfo.pack,
          pqn= moduleInfo.pqn;
        module.destFilename= compactPath(catPath(pack.destLocation, pack.destLib, (module.mid ? module.mid : pack.main) + ".js"));
        if (bc.plugins[moduleInfo.pqn]) {
          module.startPluginResource= bc.plugins[moduleInfo.pqn];
        }
        bc.destDirs.push(getFilepath(module.destFilename));
        addModule(pqn, module);
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
        src= compactPath(catPath(pack.srcLocation, pack.srcLib)),
        params= ["-L", src, "-name", "*.js", "!", "-path", "*/nls/*"];
      if (pack.name=="") {
        // it is possible other packages overlap into the default pack; 
        // don't processes these as part of the default pack
        for (var p in bc.packages) {
          var thisPack= bc.packages[p];
          if (thisPack!==pack) {
            var thisPackPath= compactPath(catPath(thisPack.srcLocation, thisPack.srcLib));
            if (thisPackPath.indexOf(src)==0) {
              params.push("-and", "!", "-path", thisPackPath + "/*");
            }
          }
        }
      }
      var
        find= spawn("find", params),
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
          // that don't have /nls/ in the path; these are the automatically "discovered" modules
          // for this package
          list= bdParse.split(list);

          // filter out empty lines
          var filtered= [];
          list.forEach(function(filename){
            if (filename) {
              filtered.push(filename);
            }
          });
          list= filtered;

          // exclude discovered modules as per explicit pack.exclude vector
          if (pack.exclude.length) {
            var
              excludeVector= pack.exclude,
              excludeVectorLength= excludeVector.length, 
              i;
            filtered= [];
            list.forEach(function(filename) {
              for (i= 0; i<excludeVectorLength; i++) {
                if (excludeVector[i].test(filename)) {
                  return;
                }
              }
              filtered.push(filename);
            });
            list= filtered;
          }
  
          // include discovered modules iff the mid resolved to the same filename that discovered the mid
          var 
            modules= {},
            srcLength= src.length + 1,
            prefix= pack.srcName ? pack.srcName + "/" : "",
            // since the mid is not relative, the only thing the start module needs from the reference module is the package
            referenceModule= {pack:pack};
          list.forEach(function(filename) {
            if (filename) {
              // strip the package location path and the .js suffix...
              var mid= filename.substring(srcLength, filename.length-3);
              if (compactPath(getModuleInfo(prefix+mid, referenceModule).url)==compactPath(filename)) {
                modules[mid]= 1;
              } else {
                // else, mid does not map to filename; therefore, it's not a module...
                // ...or, at least it's not mid in this package owing to a mapping
                console.log("excluded: " + pack.name + ":" + mid + ", derived from:" + filename);
              }
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

      // a layer module is a module that should be written with all of its dependencies, as well as all modules given in
      // the include vector together with their dependencies, excluding modules contained in the exclude vector and their dependencies

      // request all the layer modules
      for (var mid in bc.layers) {
        var 
          layer= bc.layers[mid],
          module= startModule(mid, 0);
        if (!module) {
          bc.logError("unable to find the module for layer " + mid);
        } else {
          module.layerExclude= layer.exclude;
          module.layerInclude= layer.include;
          module.bootText= layer.bootText || "";
          module.getLayerText= getLayerText;
        }
      }

      cb(0);
    };

  return {
    start:start,
    getModule:getModule,
    getModuleInfo:getModuleInfo,
    addModule:addModule,
    nameToUrl:nameToUrl
  };
});
