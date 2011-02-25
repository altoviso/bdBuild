///
// \module bdBuild/plugins/text
//
define([], function() {
  var   
    // note: we use * in the pattern since it is guaranteed not to be in any real path or filetype
    cacheTemplate= 'require(["text"], function(text) {text.cache("*1", "*2", "*3", *4);});\n\n',

    getCacheText= function() {
      return cacheTemplate.replace("*1", this.path + this.filetype).replace("*2", this.path).replace("*3", this.filetype).replace("*4", JSON.stringify(fs.readFileSync(this.srcFilename, "utf8")));
    },
  
    start= function(
      mid,
      referenceModule,
      bc
    ) {
      // mid may have a filetype (e.g., ".html") and/or a pragma (e.g. "!strip")
      var 
        textPlugin= bc.amdResources["*text"],
        parts= mid.split("!"),
        url= bc.nameToUrl(parts[0], 0, referenceModule).url,
        textResource= bc.resources[url];
      if (!textPlugin) {
        throw new Error("text! plugin missing");
      }
      if (!textResource) {
        throw new Error("text resource (" + url + ") missing");
      }
      return [textPlugin, textResource];
    };

  return {
    start:start
  };
});
