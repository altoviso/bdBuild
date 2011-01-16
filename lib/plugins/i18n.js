///
// \module bdBuild/plugins/i18n
//
define(["bdBuild/buildControl"], function(bc) {
  var
    i18nPluginRead= function(
      cb
    ) {
    },
  
    i18nPluginGlobalOptimize= function(
      cb
    ) {
    },
  
    i18nPluginWrite= function(
      cb
    ) {
    },
  
    startI18nPlugin= function(
      mid,
      referenceModule
    ) {
      console.log("TODO: starting i18n plugin: " + mid);
      return {
        read: i18nPluginRead,
        globalOptimize: i18nPluginGlobalOptimize,
        write: i18nPluginWrite
      };
    };
  bc.plugins["*i18n"]= startI18nPlugin;
});
