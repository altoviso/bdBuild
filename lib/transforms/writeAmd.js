define(["../buildControl", "../fileUtils", "fs"], function(bc, fileUtils, fs) {
  var
    computeLayerContents= function(
      layerModule
    ) {
      // add property layerSet (a set of pqn) to layerModule that...
      // 
      //   * includes dependency tree of layerModule
      //   * includes all modules in layerInclude and their dependency trees
      //   * excludes all modules in layerExclude and their dependency trees
      //   * excludes layerModule itself
      // 
      // note: layerSet is built exactly as given above, so included modules that are later excluded
      // are *not* in result layerSet
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
        var module= bc.amdResources[getSrcModuleInfo(mid, layerModule).pqn];
        if (!module) {
          bc.logError("in layer " + layerModule.pqn + ", failed to find layer include module " + mid);
        } else {
          traverse(module);
        }
      });

      visited= {};
      includePhase= false;
      layerModule.layerExclude.forEach(function(mid) { 
        var module= bc.amdResources[getSrcModuleInfo(mid, layerModule).pqn];
        if (!module) {
          bc.logError("in layer " + layerModule.pqn + ", failed to find layer exclude module " + mid);
        } else {
          traverse(module);
        }
      });
      delete includeSet[layerModule.pqn];
      layerModule.layerSet= includeSet;
    },

    getLayerText= function(resource) {
      if (resource.layerText) {
        return resource.layerText;
      }

      computeLayerContents(resource);
      var
        cache= [],
        pluginResources= "";
      for (var p in resource.layerSet) {
        var module= bc.amdResources[p];
        if (module) {
          if (module.pluginResource) {
            if (module.getCacheText) {
              pluginResources+= module.getCacheText();
            } else {
              bc.logError("in layer " + resource.pqn + ", unable to write dependent plugin resource " + p + " (no ability to write this module to cache)");
            }
          } else {
            cache.push("'" + p + "':function(){\n" + module.getText() + "\n}");
          }
        } else {
          // shouldn't get here because we should've eliminated this module in the dependency tracing
          bc.logError("in layer " + resource.pqn + ", unable to find dependent module " + p);
        }
      }
      return (resource.layerText= 
        "require({cache:{\n" + cache.join(",\n") + "}});\n" + 
        pluginResources + "\n" +
        resource.getText() + "\n" +
        (resource.bootText ? resource.bootText : ""));
    };

  return function(resource, asyncReturn) {
    fileUtils.ensureDirectoryByFilename(resource.dest);
    // existence of layerInclude or layerExclude indicates this module should be written as a layer
    var text= resource.layerExclude ? getLayerText(resource) : resource.getText();
    fs.writeFile(resource.dest, text, resource.encoding, function(err) {
      bc.returnFromAsyncProc(resource, err);
    });
    return asyncReturn;
  };
});

 