///
// \amd-mid bdBuild/lib/transforms/bdLoadWrite
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
  "../fileUtils", 
  "fs", 
  "../configStringify", 
  "bdParse", 
  "text!../has/bdBuildHas.js", 
  "text!../has/naiveHas.js"
], function(fileUtils, fs, stringify, bdParse, bdBuildHasText, naiveHasText) {
  return function(resource, bc, asyncReturn) {
    var    
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

      getConfig= function() {
        var config= bc.loaderConfig;
        config.packages= [];
        config.baseUrl= bc.baseUrl || "";
        for (var p in bc.packages) if (p!="*") config.packages.push(getPackage(bc.packages[p]));
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
          bc.returnFromAsyncProc(resource, errors.length && errors);
        }
      },

      doWrite= function(filename, text) {
        waitCount++;
        fileUtils.ensureDirectoryByFilename(filename);
        fs.writeFile(filename, text, "utf8", onWriteComplete);
      };

    // the bdLoadWrite transform...
    try {
      var 
        config= getConfig(),
        loaderText= bdParse.deleteText(resource.text, resource.deleteList).join("\n");

      // the default application to the loader constructor is replaced with getConfigText
      loaderText= loaderText.replace(/\/\/\sbegin\sdefault\sbootstrap[\w\W]+$/, "");
      doWrite(resource.dest, loaderText + getConfigText(config));

      //write any bootstraps
      resource.boots.forEach(function(item) {
          var result= item();
          doWrite(result[0], loaderText + getConfigText(config) + result[1]);
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
    return asyncReturn;
  };
});
