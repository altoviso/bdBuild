define([], function() {
return {
  basePath:
    ///
    //(bdBuild.path) The root for any source path that is not specified as an absolute path.  //Must be provided.
    0,

  packages:
    ///
    //(vector of bdBuild.packageInfo) The set of packages to be compiled.
    [{
      // the default package
      name:"",
      lib:"",
      main:"",
      urlMap:[],
      location:"",
      destName:"",
      destUrlMap:[]
    }],

  loaderConfig:
    ///
    //(bdLoad.config, optional, {}) The configuration object to pass to the bdLoad constructor.
    {},
  
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
    "loader-libApi":0,
    "loader-requirejsApi":0,
    "loader-createHas":1,
    "loader-createHasModule":1,
    "loader-pushHas":0,
    "loader-amdFactoryScan":0,
    "loader-throttleCheckComplete":0
  },

  has:
    //(moduleName or 0) module name of processor that adds has to the loader (if any)
    "bdBuild/has/bdLoad",
  
  hasMap:
    ///
    //(bdLoad.hasMap, optional, {}) Used with the has implementation provided by bdBuild/has/bdLoad.
    ///
    // The initial has map provided to the has implementation provided by bdBuild/has/bdLoad.
    {
      "dom-addEventListener":"this.document && !!document.addEventListener",
      "native-xhr":"!!this.XMLHttpRequest"
    },

  destBasePath:
    ///
    //(bdBuild.path) The root location to output the build. //Must be provided.
    0,

  destPackageBasePath:
    ///
    //(bdBuild.path, optional "packages") The default path that contains all packages.
    ///
    // If not absolute, destBasePath is automatically prepended.
    "packages",

  ///
  //(map:mid --> array of mid) layers to build.
  // 
  // Each map item says build a layer that includes all fully-resolved dependencies for the module given by
  // the map item key, assuming all modules contained in the map item value, and their fully-resolved dependencies, 
  // have already been defined
  layers:{},

  // 
  buildFlags:{
    stripConsole:1,
    optimizeHas:1
  },

  copyDirs:[],
  copyFiles:[],

  pluginResourceProcessors:[
    "bdBuild/plugins/text",
    "bdBuild/plugins/i18n"
  ],

  plugins:{},

  procMap:{
    jsResourceTextProc:"bdBuild/jsResourceTextProc",
    jsResourceTokenProc:"bdBuild/jsResourceTokenProc",
    jsResourceAstProc:"bdBuild/astProc/hasAmd"
  },

  jobList:[
    "bdBuild/loaderJob", 
    "bdBuild/packageJob", 
    "bdBuild/copyJob"
  ]
};
});
