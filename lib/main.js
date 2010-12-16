// TODO: check that the win version for node uses forward slash
console.log(process.cwd());
var 
  fs= require("fs"),

  load= function(filename) {
    filename= /^\./.test(filename) ? __dirname + "/" + filename : filename;
    var src;
    try {
      src= fs.readFileSync(filename, "utf8");
    } catch (e) {
      console.log(e);
    }
    try {
      return process.compile(src, filename);
    } catch (e) {
      console.log(e);
    }
    return 0;
  },

  packageRoot= __dirname.match(/(.+)\/bdBuild\/lib/)[1],

  // config for bdBuild (i.e., *not* for the target we're building)
  config= {
    baseUrl: packageRoot,
    packages:[{
      name:"bdBuild",
      location:packageRoot + "/bdBuild/"
    }, {
      name:"bdParse",
      location:packageRoot + "/bdParse/"
    }, {
      name:"bdLoad",
      location:packageRoot + "/bdLoad/"
    }]
  },

  // buildScript describes the build
  buildScript= {
    // build source
    srcBaseUrl: packageRoot,
    srcPackageRoot: packageRoot,
    packages:{},

    // loader configuration
    loader:packageRoot + "/bdLoad/lib/junk.js",
    loaderConfig: {
      timeout:0
    },
    loaderHasMap: {
      // is buildScript.has is given, then loaderHasMap is ignored
      "dom-addEventListener": "this.document && !!document.addEventListener",
      "native-xhr": "!!this.XMLHttpRequest"
    },

    has: 
      //(filename or 0) filename of has.js implementation; 0 indicates use loader has implementation
      0, //packageRoot + "/has.js",

    hasFactories:
      //(array of filename)
      [],
    
    staticHasFlags: {
      "dom": 1,
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
      "loader-createHas": 0,
      "loader-pushHas": 0,
      "loader-amdFactoryScan": 0,
      "loader-throttleCheckComplete": 0
    },

    // where to write the output; must be explicitly set by user
    srcBaseUrl: 0,
    srcPackageRoot: 0,

    // layers to build
    layers:{},

    // 
    flags: {
      stripConsole: 1,
      optimizeHas: 1
    }
  },

  hasLocations= {},

  illegalArgumentValue= function(argumentName, position) {
    console.log("illegal argument value for " + argumentName + " (argument " + position + ").");
    return 0;
  },

  setItem= function(dest, src, prop) {
    dest[prop]= src[prop]!==undefined ? src[prop] : dest[prop];
  },

  mix= function(dest, src) {
    dest= dest || {};
    for (var p in src) dest[p]= src[p];
    return p;
  },

  appendBuild= function(src) {
    setItem(buildScript, src, "loader");
    setItem(buildScript, src, "srcBaseUrl");
    setItem(buildScript, src, "srcPackageRoot");
    setItem(buildScript, src, "destBaseUrl");
    setItem(buildScript, src, "destPackageRoot");
    src.packages && src.packages.forEach(function(p) {
      buildScript[p]= src[p];
    });    
    mix(buildScript.loaderConfig, src.loaderConfig || {});
    mix(buildScript.loaderHasMap, src.loaderHasMap || {});
    mix(buildScript.staticHasFlags, src.staticHasFlags || {});
  },

  processCommandLine= function() {
    for (var arg, i= 2, end= process.argv.length; i<end;) {
      switch (process.argv[i++]) {
        case "-b":
        case "--build":
          if (i<end) {
            arg= load(process.argv[i++]);
            if (arg) {
              appendBuild(arg);
            } else {
              return 0;
            }
          } else {
            return illegalArgumentValue("build", i);
          }
          break;

        case "-o":
        case "--release-root":
          if (i<end) {
            buildScript.destBaseUrl= process.argv[i++];
          } else {
            return illegalArgumentValue("build", i);
          }
          break;

        case "-p":
        case "--package-root":
          if (i<end) {
            buildScript.destPackageRoot= process.argv[i++];
          } else {
            return illegalArgumentValue("build", i);
          }
          break;

        case "-d":
        case "--destroy-existing-release-root":
          buildScript.flags.destroyReleaseRoot= true;
          break;

        case "-n":
        case "--no-prompt":
          buildScript.flags.noPrompt= true;
          break;
      }
    }

    if (buildScript.destBaseUrl.charAt(0)==".") {
      buildScript.destBaseUrl= process.cwd() + "/" + buildScript.destBaseUrl;
      console.log(buildScript.destBaseUrl);
    }
     
    return buildScript;
  },

  bdLoad= require.paths.unshift(packageRoot) && require("bdLoad/lib/node").load(config),

  preprocessResource= function(resource, preprocessors, callback) {
    console.log("preprocessing " + resource.filename);
    resource.fileUtils.read(resource.filename, function(err, text) {
      if (err) {
        callback(err);
        return;
      }
      resource.text= resource.parser.split(text);
      resource.tokens= resource.parser.tokenize(resourceControl.text);
      preprocessors && preprocessors.map(function(preprocessor) { preprocessor(resource); });
      callback(resourceControl);
    });
  },

  processLoader= function(filename, parser) {
    var src;
    src= fs.readFileSync(filename, "utf8");
    try {
      var ast= parser.parseText(src);
    } catch (e) {
      console.log("test");
      console.log(e.message);
    }
  };

function resource(
  packageName,
  moduleName,
  filename,
  fileUtils,
  parser,
  pragmaPP,
  hasPP,
  bdLoad
) {
  this.packageName= packageName;
  this.moduleName= moduleName;
  this.filename= filename;
  this.fileUtils= fileUtils;
  this.parser= parser;
  this.pragmaPP= pragmaPP;
  this.hasPP= hasPP;
  this.bdLoad= bdLoad;
}

processCommandLine();
console.log(buildScript);

bdLoad(["bdBuild/fileUtils", "bdParse", "bdBuild/pragmaPreprocessor", "bdBuild/hasPreprocessor"], function(fileUtils, parser, pragmaPP, hasPP) {
  console.log(fileUtils);
  console.log(parser);
  console.log(pragmaPP);
  console.log(hasPP);
  if (buildScript.loader) {
    var loader= new resource("", "", buildScript.loader, fileUtils, parser, pragmaPP, hasPP, bdLoad);
    preprocessResource(loader, [hasPP], function(){});
  }
});
