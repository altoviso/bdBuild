define(["../buildControl", "../fileUtils", "fs"], function(bc, fileUtils, fs) {
  var
    computeLayerContents= function(
      layerModule, 
      include, 
      exclude
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
            includeSet[pqn]= module;
          } else {
            delete includeSet[pqn];
          }
          for (var deps= module.deps, i= 0; deps && i<deps.length; traverse(deps[i++]));
        };

      visited= {};
      includePhase= true;
      if (layerModule) {
        traverse(layerModule);     
      }
      include.forEach(function(mid) { 
        var module= bc.amdResources[bc.getSrcModuleInfo(mid).pqn];
        if (!module) {
          bc.logError("failed to find module (" + mid + ") while computing layer include contents");
        } else {
          traverse(module);
        }
      });

      visited= {};
      includePhase= false;
      exclude.forEach(function(mid) { 
        var module= bc.amdResources[bc.getSrcModuleInfo(mid).pqn];
        if (!module) {
          bc.logError("failed to find module (" + mid + ") while computing layer exclude contents");
        } else {
          traverse(module);
        }
      });
      if (layerModule) {
        delete includeSet[layerModule.pqn];
      }
      return includeSet;
    },

    getLayerText= function(
      resource, 
      include, 
      exclude
    ) {
      var
        cache= [],
        pluginLayerText= "",
        moduleSet= computeLayerContents(resource, include, exclude);
      for (var p in moduleSet) {
        var module= moduleSet[p];
        if (module.getPluginLayerText) {
          pluginLayerText+= module.getPluginLayerText();
        } else {
          cache.push("'" + p + "':function(){\n" + module.getText() + "\n}");
        }
      }
      return "require({cache:{\n" + cache.join(",\n") + "}});\n" + pluginLayerText + "\n" + (resource ?  resource.getText() : "");
    },

    write= function(resource, callback) {
      fileUtils.ensureDirectoryByFilename(resource.dest);
      var text= resource.layer ? 
        getLayerText(resource, resource.layer.include, resource.layer.exclude) : 
        resource.getText();
      fs.writeFile(resource.dest, text, resource.encoding, function(err) {
        callback(resource, err);
      });
      return callback;
    };
    write.getLayerText= getLayerText;

    return write;
});

 