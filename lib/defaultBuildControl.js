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
    "loader-amdFactoryScan":0
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
    dojoPragmas:["bdBuild/transforms/dojoPragmas", "read"],
    jsTokenize:["bdBuild/transforms/jsTokenize", "tokenize"],
    jsParse:["bdBuild/transforms/jsParse", "parse"],
    has:["bdBuild/transforms/has", "ast"],
    write:["bdBuild/transforms/write", "write"],
    readBdLoad:["bdBuild/transforms/readBdLoad", "read"],
    writeBdLoad:["bdBuild/transforms/writeBdLoad", "write"],
    compactCss:["bdBuild/transforms/compactCss", "optimize"],
    writeCss:["bdBuild/transforms/writeCss", "write"]
  },

  transformJobsMap:[
    [
      // the backdraft loader, bdLoad
      function(filename) {
          return /.*\/bdLoad\/lib\/require\.js$/.test(filename);
      },
      ["readBdLoad", "jsTokenize", "jsParse", "has", "writeBdLoad"]
    ],[
      // normal, non-i18n Javascript code modules...
      function(filename) {
        return /\.js$/.test(filename) && !/.*\/nls\/.*/.test(filename);
      },
      ["read", "dojoPragmas", "jsTokenize", "jsParse", "has", "write"]
    ],[
      // css that are designated to compact
      function(filename, bc) {
        return bc.compactCssSet[filename];
      },
      ["read", "compactCss", "writeCss"]
    ],[
      // just copy everything else...
      function(filename) {
        return true; 
      },
      ["read", "write"]
    ]
  ]
});
