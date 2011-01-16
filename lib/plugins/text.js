///
// \module bdBuild/plugins/text
//
define(["bdBuild/buildControl"], function(bc) {
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
  
    startTextPlugin= function(
      mid,
      referenceModule
    ) {
      console.log("TODO: starting text plugin: " + mid);
      return {
        read: textPluginRead,
        globalOptimize: textPluginGlobalOptimize,
        write: textPluginWrite
      };
    };
  bc.plugins["*text"]= startTextPlugin;
});
