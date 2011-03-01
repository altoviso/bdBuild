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

  buildFlags:{
    stripConsole:1,
    optimizeHas:1
  },

  discoveryProcs:["bdBuild/discover"],

  plugins:{
    text:"bdBuild/plugins/text",
    i18n:"bdBuild/plugins/i18n"
  },

  transforms:{
    read:["bdBuild/transforms/read", "read"],
    dojoPragmas:["bdBuild/transforms/dojoPragmas", "read"],
    jsTokenize:["bdBuild/transforms/jsTokenize", "tokenize"],
    jsParse:["bdBuild/transforms/jsParse", "parse"],
    has:["bdBuild/transforms/has", "ast"],
    amd:["bdBuild/transforms/amd", "ast"],
    write:["bdBuild/transforms/write", "write"],
    writeAmd:["bdBuild/transforms/writeAmd", "write"],
    readBdLoad:["bdBuild/transforms/readBdLoad", "read"],
    writeBdLoad:["bdBuild/transforms/writeBdLoad", "write"],
    compactCss:["bdBuild/transforms/compactCss", "optimize"],
    writeCss:["bdBuild/transforms/writeCss", "write"]
  },

  transformJobs:[[
      // the backdraft loader, bdLoad
      function(resource) {
          return /.*\/bdLoad\/lib\/require\.js$/.test(resource.src);
      },
      ["readBdLoad", "jsTokenize", "jsParse", "has", "writeBdLoad"]
    ],[
      // package/amd modules
      function(resource) {
          return resource.pqn;
      },
      ["read", "dojoPragmas", "jsTokenize", "jsParse", "has", "amd", "writeAmd"]
    ],[
      // normal, non-i18n Javascript code modules...
      function(resource) {
        return /\.js$/.test(resource.src) && !/.*\/nls\/.*/.test(resource.src) && !/\.bcs\./.test(resource.src);
      },
      ["read", "dojoPragmas", "jsTokenize", "jsParse", "has", "write"]
    ],[
      // css that are designated to compact
      function(resource, bc) {
        return bc.compactCssSet[resource.src];
      },
      ["read", "compactCss", "writeCss"]
    ],[
      // just copy everything else...
      function(resource) {
        return true; 
      },
      ["read", "write"]
    ]
  ]
});
 