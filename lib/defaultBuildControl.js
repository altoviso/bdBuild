define([], {
  staticHasFlags:{
    "dom":1,
    "loader-node":0,
    "loader-injectApi":1,
    "loader-timeoutApi":0,
    "loader-traceApi":0,
    "loader-buildToolsApi":0,
    "loader-catchApi":1,
    "loader-pageLoadApi":1,
    "loader-errorApi":1,
    "loader-sniffApi":0,
    "loader-undefApi":0,
    "loader-publish-privates":1,
    "loader-requirejsApi":1,
    "loader-createHas":1,
    "loader-createHasModule":1,
    "loader-pushHas":0,
    "loader-amdFactoryScan":0,
    "loader-throttleCheckComplete":0
  },

  loaderConfig: {
    host:"browser",
    isBrowser:1,
    timeout:0
  },

  // 
  buildFlags:{
    stripConsole:1,
    optimizeHas:1
  },

  pluginMap:{
    text:"bdBuild/plugins/text",
    i18n:"bdBuild/plugins/i18n"
  },

  transformMap:{
    read:["bdBuild/transforms/read", "read"],
    write:["bdBuild/transforms/write", "write"]
  },

  transformJobsMap:[
    [
      function(filename){ return true; },
      ["read", "write"]
    ]
  ]
});
