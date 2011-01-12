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
      name: "",
      lib: "",
      urlMap: [],
      location: "",
      destName:"",
      destUrlMap:[]
    }],

  loaderConfig: 
    ///
    //(bdLoad.config, optional, {}) The configuration object to pass to the bdLoad constructor.
    {},

  loaderHasMap: 
    ///
    //(bdLoad.hasMap, optional, {}) The has map to pass to the bdLoad constructor. //If bdLoad.config.has
    // is given, then then this setting is ignored.
    {
      "dom-addEventListener": "this.document && !!document.addEventListener",
      "native-xhr": "!!this.XMLHttpRequest"
    },

  has: 
    //(filename or 0) filename of has.js implementation; 0 indicates use loader has implementation
    0, //packageBase + "/has.js",

  hasFactories:
    //(array of filename)
    [],
  
  staticHasFlags: {
    "dom": 1,
    "loader-node": 0,
    "loader-injectApi": 1,
    "loader-timeoutApi": 0,
    "loader-traceApi": 0,
    "loader-buildToolsApi": 0,
    "loader-catchApi": 1,
    "loader-pageLoadApi": 1,
    "loader-errorApi": 1,
    "loader-sniffApi": 0,
    "loader-undefApi": 0,
    "loader-libApi": 0,
    "loader-requirejsApi": 0,
    "loader-createHas":1,
    "loader-createHasModule":1,
    "loader-pushHas": 0,
    "loader-amdFactoryScan": 0,
    "loader-throttleCheckComplete": 0
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

  // layers to build
  layers:{},

  // 
  buildFlags: {
    stripConsole: 1,
    optimizeHas: 1
  },

  copyDirs: [],
  copyFiles: [],

  plugins: {},

  procMap: {
    jsResourceTextProc:  "bdBuild/jsResourceTextProc",
    jsResourceTokenProc: "bdBuild/jsResourceTokenProc",
    jsResourceAstProc:   "bdBuild/hasAmdAstProc"
  },

  jobList: [
    "bdBuild/loaderJob", 
    "bdBuild/packageJob", 
    "bdBuild/layerJob", 
    "bdBuild/copyJob"
  ]
};
});
