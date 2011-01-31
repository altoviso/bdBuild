///
// \module bdBuild/loaderJob
//
define(["./fileUtils", "./buildControl", "./configStringify", "./packageJob", "bdParse", "require"], function(fileUtils, bc, configStringify, packageJob, bdParse, require) {
var
  read= function(
    cb
  ) {  
    bc.waiting++;
    var thisObject= this;
    fileUtils.read(this.srcFilename, function(err, text) {
      if (err) {
        cb(err);
        return;
      }
      try {
        thisObject.text= text.replace(/\/\/\sbegin\sdefault\sbootstrap[\w\W]+$/, "");
        bc.jsResourceTextProc(thisObject);        
        thisObject.tokens= bdParse.tokenize(thisObject.text);
        bc.jsResourceTokenProc(thisObject);
        thisObject.tree= bdParse.parse(thisObject.tokens);
        bc.jsResourceAstProc(thisObject);
        cb(0);
      } catch (e) {
        cb(e);
      }
    });
  },


  globalOptimize= function(
    cb
  ) {
  },

  getConfig= function() {
    var config= bc.loaderConfig;
    config.packages= [];
    config.baseUrl= bc.baseUrl || "";
    return config;
  },

  getPackage= function(pack) {
    var info= {name:pack.destName};
    info.location= pack.destLocation.indexOf(bc.destBasePath)==0 ?
      pack.destLocation.substring(bc.destBasePath.length+1) :
      pack.destLocation;
    if (pack.destLib!="lib") {
      info.lib= pack.destLib;
    }
    if (pack.destMain!="main") {
      info.main= pack.destMain;
    }
    if (pack.destUrlMap && pack.destUrlMap.length) {
      info.urlMap= pack.destUrlMap;
    }
    if (pack.destPackageMap && pack.destPackageMap.length) {
      info.packageMap= pack.destPackageMap;
    }
    return info;
  },

  getLoaderHasMap= function(
    map
  ) {
    var items= [];
    for (var p in map) items.push('  "' + p + '":' + map[p]);
    return "{\n" + items.join(",\n") + "\n}";
  },

  getConfigText= function(config) {
    var configText= configStringify(config);
    if (configText.unsolved) {
      bc.logWarn("The configuration contains unsolved values. This may or may not be an error.");
    }
    configText= configText.result;
    
    var has= 0;
    if (bc.has) {
      has= require(bc.has)(bc);
    }

    return "(\nthis.require || {},\n" + configText + ",\n" + has + "\n);\n";
  },

  write= function(
    cb
  ) {
    try {
      var config= getConfig();
      for (var p in bc.packages) if (p!="*") config.packages.push(getPackage(bc.packages[p]));
      var loaderText= bdParse.deleteText(this.text, this.deleteList).join("\n");
      bc.waiting++;
      fileUtils.write(bc.sandbox + this.destFilename, loaderText + getConfigText(config), cb);

      //now write any bootstraps
      delete config.load;
      for (var mid in bc.layers) {
        var 
          layer= bc.layers[mid],
          module= packageJob.getModule(mid);
        if (module && layer.boot) {
          bc.waiting++;
          fileUtils.write(bc.sandbox + layer.boot, loaderText + getConfigText(config) + module.getLayerText(), cb);
        }
      }
    } catch (e) {
      cb(e);
    }
  },

  start= function(
    cb
  ) {
    if (!bc.srcLoader) {
      return;
    }
    bc.jobs["**loader"]= {
      packageName: "",
      moduleName: "*loader",
      srcFilename: bc.srcLoader,
      destFilename: bc.destLoader,
      read:read,
      globalOptimize:globalOptimize,
      write:write
    };
  };

return {
  start:start
};
  
});
