///
// \amd-mid bdBuild/lib/transforms/writeBdLoad
// 
// A function to write the bdLoad resource.
// 
// The function writes the results of transforming the loader source. has.js is integrated as follows:
//   * if bc.has=="*bdBuild", then bdBuild/has/bdBuildHas is provided to the loader boot; otherwise...
//   * if bc.has.getText exists and is a function, then the result of that function is provided to the loader boot; otherwise...
//   * bdBuild/has/naiveHas is provided to the loader boot bc.loader.boots
// 
// Other transforms may request a bootstrap be written for them that includes the loader and loader config. They
// may execute such a request by pushing a function into bc.loader.boots. The function must return a [filename, text]
// pair that indicates the bootstrap text to append to the loader and the destination to write the result.
define([
  "../buildControl",
  "../fileUtils", 
  "fs", 
  "../stringify", 
  "bdParse",
  "./writeAmd",
  "text!../has/bdBuildHas.js", 
  "text!../has/naiveHas.js"
], function(bc, fileUtils, fs, stringify, bdParse, writeAmd, bdBuildHasText, naiveHasText) {
  return function(resource, callback) {
    var    
      getPackage= function(name) {
        // the purpose of this somewhat verbose routine is to write a minimal package object for each 
        // package, yet allow client code to pass extra (i.e., outside the scope of CJS specs) config
        //  information within the package object
        var
           srcPack= bc.packages[name],
           destPack= bc.destPackages[name],
           result= {},
           p;
        for (p in srcPack) result[p]= srcPack[p];
        for (p in destPack) result[p]= destPack[p];
        result.location= destPack.location.indexOf(bc.destBasePath)==0 ?
          "./" + destPack.location.substring(bc.destBasePath.length+1) :
          destPack.location;
        delete result.mapProg;
        delete result.trees;
        delete result.dirs;
        delete result.files;
        if (result.lib=="lib") delete result.lib;
        if (result.main=="main") delete result.main;
        if (!result.packageMap.length) delete result.packageMap;
        if (!result.pathTransforms.length) delete result.pathTransforms;
        return result;
      },

      getConfig= function() {
        var config= bc.loaderConfig;
        config.packages= [];
        config.baseUrl= bc.baseUrl || "";
        for (var p in bc.packages) if (p!="*") config.packages.push(getPackage(p));
        return config;
      },
    
      getConfigText= function(config) {
        var configText= stringify(config);
        if (configText.unsolved) {
          bc.logWarn("The configuration contains unsolved values. This may or may not be an error.");
        }
        configText= configText.result;
        
        var hasText= naiveHasText;
        if (bc.has) {
          if (bc.has=="*bdBuild") {
            hasText= bdBuildHasText;
          } else if (bc.has.getText) {
            hasText= bc.has.getText();
          }
        }
        return "(\nthis.require || {},\n" + configText + ",\n" + hasText + "\n);\n";
      },

      waitCount= 0,

      errors= [],
   
      onWriteComplete= function(err) {
        if (err) {
          errors.push(err);
        }
        if (--waitCount==0) {
          callback(resource, errors.length && errors);
        }
      },

      doWrite= function(filename, text) {
        fileUtils.ensureDirectoryByFilename(filename);
        waitCount++;
        fs.writeFile(filename, text, "utf8", onWriteComplete);
        // this must go *after* the async call
      };

    // the writeBdLoad transform...
    try {
      // the default application to the loader constructor is replaced with getConfigText
      var loaderText= resource.getText().replace(/\/\/\sbegin\sdefault\sbootstrap[\w\W]+$/, "") + getConfigText(getConfig());
      doWrite(resource.dest, loaderText);

      //write any bootstraps; boots is a map from dest filename to boot layer
      resource.boots.forEach(function(item) {
        // each item is a map of include, exclude, boot, bootText
        doWrite(item.boot, loaderText + writeAmd.getLayerText(0, item.include, item.exclude) + item.bootText);
      });
    } catch (e) {
      if (waitCount) {
        // can't return the error since there are async processes already going
        errors.push(e);
        return 0;
      } else {
        return e;
      }
    }
    return callback;
  };
});
