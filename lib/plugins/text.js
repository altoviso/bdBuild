///
// \module bdBuild/plugins/text
//
define(["bdBuild/buildControl", "../packageJob", "fs"], function(bc, packageJob, fs) {
  var
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
    
    // note: we use * in the pattern since it is guaranteed not to be in any real path or filetype
    cacheTemplate= 'require(["text"], function(text) {text.cache("*1", "*2", "*3", *4);});\n\n',

    getCacheText= function() {
      return cacheTemplate.replace("*1", this.path + this.filetype).replace("*2", this.path).replace("*3", this.filetype).replace("*4", JSON.stringify(fs.readFileSync(this.srcFilename, "utf8")));
    },
  
    startTextPlugin= function(
      mid,
      referenceModule,
      read
    ) {
      // mid may have a filetype (e.g., ".html") and/or a pragma (e.g. "!strip")
      var 
        parts= mid.split("!"),
        match= parts[0].match(/(.+)(\.[^\/]+)$/),
        pluginResourceMid= (match ? match[1] : parts[0]),
        moduleInfo= packageJob.getModuleInfo(pluginResourceMid, referenceModule),
        filetype= moduleInfo.filetype= (match ? match[2] : ""),
        url= moduleInfo.url= moduleInfo.url.substring(0, moduleInfo.url.length-3) + filetype;
      var pqn= moduleInfo.pqn= "text!" + moduleInfo.pid + "*" + moduleInfo.mid + filetype;
      if (bc.jobs[pqn]) {
        return bc.jobs[pqn];
      } else {
        moduleInfo.deps= [packageJob.getModule("text")];
        moduleInfo.srcFilename= moduleInfo.url;
        moduleInfo.getCacheText= getCacheText;
        moduleInfo.pluginResource= true;
        packageJob.addModule(pqn, moduleInfo);
        return moduleInfo;
      }
    };

  bc.plugins["*text"]= startTextPlugin;
});
