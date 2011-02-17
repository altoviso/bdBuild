function(){
return {
  // implied baseDir
 
  files:[
    ["../../../bdLoad/lib/require.js", "./require.js"]
  ],

  dirs:[
    ["./js", "./js"]
  ],
  
  trees:[
    ["./css", "./css"]
  ],

  transforms:{
    dojoPragmas:["bdBuild/dojoPragmas", "tokens"],
    bdBuildAstProc:["bdBuild/astProc/hasAmd", "ast"],
    checkAmdDeps:["bdBuild/checkAmdDeps", "globalOptimize"],
    compactCss:["bdBuild/compactCss", "globalOptimize"]
  },

  transformMap:[
    [
      // normal (i.e., not i18n bundle) Javascript source (maybe or maybe not AMD module)
      function(filename) {
        return /\.js$/.test(filename) && !/.*\/nls\/.*/.test(filename);
      },
      ["dojoPragmas", "bdBuildAstProc", "checkDeps", "writeModule"]
    ],[
      // nls root modules     
      function(filename) {
        return /.*\/nls\/[^\/]\.js$/.test(filename);
      },
      ["writeI18nRootModule"]
    ],[
      // css's to optimize
      function(filename) {
        return /\.css$/.test(filename);
      }
      ["compactCss"]
    ]
  ]
};
}
