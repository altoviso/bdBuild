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
    cacheTemplate= 'require(["text"], function(text) {text.cache(require.nameToUrl("*1") + "*2", *3);});\n\n',

    getCacheText= function() {
      return cacheTemplate.replace("*1", this.path).replace("*2", this.filetype).replace("*3", JSON.stringify(fs.readFileSync(this.srcFilename, "utf8")));
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
        filetype= (match ? match[2] : ""),
        moduleInfo= packageJob.getModuleInfo(pluginResourceMid, referenceModule),
        url= moduleInfo.url= moduleInfo.url.substring(0, moduleInfo.url.length-3) + filetype;
      moduleInfo.mid+= filetype;
      var pqn= moduleInfo.pqn= "text!" + moduleInfo.pid + "*" + moduleInfo.mid;
      if (bc.jobs[pqn]) {
        return bc.jobs[pqn];
      } else {
        moduleInfo.deps= [packageJob.getModule("text")];
        moduleInfo.srcFilename= moduleInfo.url;
        moduleInfo.getCacheText= getCacheText;
        moduleInfo.filetype= filetype;
        moduleInfo.pluginResource= true;
        packageJob.addModule(pqn, moduleInfo);
        return moduleInfo;
      }
    };

  bc.plugins["*text"]= startTextPlugin;
});
