///
// \module bdBuild/loaderJob
//
define(["./fileUtils", "./buildControl", "./configStringify", "bdParse", "require"], function(fileUtils, bc, configStringify, bdParse, require) {
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
    config.baseUrl= bc.baseUrl || "./";
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

  write= function(
    cb
  ) {
    bc.waiting++;
    try {
      var config= getConfig();
      for (var p in bc.packages) if (p!="*") config.packages.push(getPackage(bc.packages[p]));
      config= configStringify(config);
      if (config.unsolved) {
        bc.logWarn("The configuration contains unsolved values. This may or may not be an error.");
      }
      config= config.result;
      
      var has= 0;
      if (bc.has) {
        has= require(bc.has)(bc);
      }

      config= "(\nthis.require || {},\n" + config + ",\n" + has + "\n);\n";

      fileUtils.write(bc.sandbox + this.destFilename, bdParse.deleteText(this.text, this.deleteList).join("\n") + config, cb);
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
