///
// \module bdBuild/packageJob
//
define(["child_process", "loader", "bdBuild/fileUtils", "bdBuild/buildControl", "bdParse"], function(child_process, loader, fileUtils, bc, bdParse) {
  var
    spawn= child_process.spawn,
  
    catPath= fileUtils.catPath,
    getFilepath= fileUtils.getFilepath,

    isFunction= loader.isFunciton,
    computeMapProg= loader.computeMapProg,
    runMapProg= loader.runMapProg,
    compactPath= loader.compactPath,
    transformPath= loader.transformPath,
  
    modules= {},
    badModules= bc.badModules= {},

    getModuleInfo= function(mid, referenceModule) {
      return loader.getModuleInfo(mid, referenceModule, bc.packages, modules, bc.basePath, bc.pagePath, bc.packageMapProg, bc.pathsMapProg, bc.pathTransforms);
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
          for (var q in module.deps) {
            if (badModules[q]) {
              logModuleError(module, "missing dependency " + q.replace(/\*/, "/") + ".");
              moreBadModules= true;
              badModules[p]= 1;
            }
          }
        }
      }
    },
  
    readModule= function(
      cb
    ) {
      bc.waiting++;
      var thisObject= this;
      fileUtils.read(this.srcFilename, function(err, text) {
        if (!err) {
          try {
            //bc.log("Read module at " + thisObject.srcFilename);
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
        cb(0);
      });
    },
  
    globalOptimizeModule= function(
      cb
    ) {
      checkForMissingDeps();
      this.resultText= !this.error && bdParse.deleteText(this.text, this.deleteList).join("\n");
    },
  
    writeModule= function(
      cb
    ) {
      if (!this.error) {
        bc.waiting++;
        var 
          thisObject= this,
          pack= this.pack,
          destFilename= bc.sandbox + catPath(pack.destLocation, pack.destLib) + "/" + this.mid + ".js";
        fileUtils.write(destFilename, "//synthesized!\n" + this.resultText, function(err) {
          if (err) {
            logModuleError(thisObject, err, "write");
          }
          //bc.log("Wrote module at " + destFilename);
  
          cb(0);
        });
      }
    },
  
    startModule= function(
      mid, 
      referenceModule
    ) {
      // this routine is called during the start phase, so it does *not* automatically call module.read
      var pluginInfo= getPluginInfo(mid);
      if (pluginInfo) {
        var pluginModule= startModule(pluginInfo[0], referenceModule);
        if (pluginModule.startModule) {
          return pluginModule.startModule(pluginInfo[1], referenceModule);
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
        if (bc.plugins[moduleInfo.path]) {
          module.start= bc.plugins[moduleInfo.path];
        }
        bc.destDirs.push(getFilepath(catPath(pack.destLocation, pack.destLib, module.path)));
        bc.jobs[pqn]= modules[pqn]= module;
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
        srcLength= src.length,
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
          var modules= {};
          list.forEach(function(filename) {
            if (filename) {
              // strip the package location path and the .js suffix...
              var mid= filename.substring(srcLength+1, filename.length-3);
              if (getModuleInfo(mid, {pack:pack}).url==filename) {
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
          var prefix= pack.srcName + "/";
          for (var mid in modules) {
            // this is an async callback and the module may have been added by other means
            startModule(getModuleInfo(prefix+mid, {pack:pack}));
          }
          // always add the main module if the package info indicates there is one
          if (pack.srcMain) {
            startModule(getModuleInfo(pack.srcMain, {pack:pack}));
          }
        }
        cb(code);
      });
    },
  
    start= function(
      cb
    ) {
      bc.waiting++;
  
      // compute all the map programs before starting anything since processing one
      // package may need this information from another package
      bc.packageMapProg= computeMapProg(bc.packageMap);
      bc.pathsMapProg= computeMapProg(bc.paths);
      for (var p in bc.packages) {
        // loader.getModuleInfo looks at pack.mapProg (i.e., *not* pack.srcMapProg); 
        // therefore, make it available too
        bc.packages[p].srcMapProg= bc.packages[p].mapProg= computeMapProg(pack.srcPackageMap);
        bc.packages[p].destMapProg= computeMapProg(pack.destPackageMap || pack.srcPackageMap);
      }

      for (var p in bc.packages) {
        startPackage((bc.jobs["**package*" + p]= bc.packages[p]), cb);
      }
      
      // request all the layer modules
      for (var layerName in bc.layers) {
        var layer= bc.layers[layerName];
        layer.modules.forEach(function(mid) {
          startModule(mid, 0);
        });
      }
      cb(0);
    },

// built-in plugins processors

    textPluginRead= function(
      cb
    ) {
    },
  
    textPluginGlobalOptimize= function(
      cb
    ) {
    },
  
    textPluginWrite= function(
      cb
    ) {
    },
  
    startTextPlugin= function(
      mid,
      referenceModule
    ) {
      console.log("TODO: starting text plugin: " + mid);
      return {
        read: textPluginReadm,
        globalOptimize: textPluginGlobalOptimize,
        write: textPluginWrite
      };
    };

  bc.plugins.text= startTextPlugin;

  return {
    start:start,
    startModule:startModule
  };
});
