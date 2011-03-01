var
  // configuration info for the build program
  config= require("../../lib/config"),

  // load the AMD loader
  loader= require(config.amdLoader).boot();

// configure the loader
loader.require(config.amdLoaderConfig);

// define the node.js file system module to the AMD loader
define("fs", [], require("fs"));

function isEmpty(it) {
  for (var p in it) return false;
  return true;
}

function propsEqual(a, b) {
  var p;
  for (p in a) if (a[p]!==b[p]) return false;
  for (p in b) if (a[p]!==b[p]) return false;
  return true;
}

function eqByValue(a, b) {
  return JSON.stringify(a)==JSON.stringify(b);
}


var tests= [];

define("args", [], {build:[{}]});
loader.require(["bdBuild/buildControl", "bdBuild/defaultBuildControl"], function(bc, defaultBc) {
  tests= tests.concat([
//0
    isEmpty(bc.paths),
    isEmpty(bc.packageMap),
    isEmpty(bc.layers),
    bc.files.length==0,
    bc.dirs.length==0,
    bc.trees.length==0,
    bc.locales.length==0,
    bc.pathTransforms.length==0,
    !bc.load,
    bc.basePath=="",
    bc.destBasePath=="",
    bc.destPackageBasePath=="./packages",
    bc.pagePath=="",
    propsEqual(bc.transforms, defaultBc.transforms),
    propsEqual(bc.transformJobs, defaultBc.transformJobs),
    propsEqual(bc.loaderConfig, defaultBc.loaderConfig),
    propsEqual(bc.staticHasFlags, defaultBc.staticHasFlags),
    propsEqual(bc.buildFlags, defaultBc.buildFlags)
  ]);
});

// test files, dirs, trees with absolute paths
loader.require.undef("bdBuild/buildControl");
loader.require.undef("args");
var testBc= {
  files:[
    ["/src/path/file1", "/dest/path/file1"],
    ["/src/path/file2", "/dest/path/file2"]
  ],

  dirs:[
    ["/src/path3", "/dest/path3"],
    ["/src/path4", "/dest/path4"]
  ],

  trees:[
    ["/src/path5", "/dest/path5"],
    ["/src/path6", "/dest/path6"]
  ]
};
define("args", [], {build:[testBc]});
loader.require(["bdBuild/buildControl", "bdBuild/defaultBuildControl"], function(bc, defaultBc) {
  tests= tests.concat([
//18
    eqByValue(bc.files, testBc.files),
    eqByValue(bc.dirs, testBc.dirs),
    eqByValue(bc.trees, testBc.trees),
    isEmpty(bc.paths),
    isEmpty(bc.packageMap),
    isEmpty(bc.layers),
    bc.locales.length==0,
    bc.pathTransforms.length==0,
    !bc.load,
    bc.basePath=="",
    bc.destBasePath=="",
    bc.destPackageBasePath=="./packages",
    bc.pagePath=="",
    propsEqual(bc.transforms, defaultBc.transforms),
    propsEqual(bc.transformJobs, defaultBc.transformJobs),
    propsEqual(bc.loaderConfig, defaultBc.loaderConfig),
    propsEqual(bc.staticHasFlags, defaultBc.staticHasFlags),
    propsEqual(bc.buildFlags, defaultBc.buildFlags)
  ]);
});

// test baseTree, files, dirs, trees with mixed relative and absolute paths
loader.require.undef("bdBuild/buildControl");
loader.require.undef("args");
testBc= {
  baseTree:"/home/rcgill/dev/bdBuild/test/unit",

  files:[
    ["/src/path/file1", "/dest/path/file1"],
    ["./src/path/file2", "./dest/path/file2"],
    ["../src/path/file3", "../dest/path/file3"]
  ],

  dirs:[
    ["/src/path4", "/dest/path4"],
    ["./src/path5", "./dest/path5"],
    ["../src/path6", "../dest/path6"]
  ],

  trees:[
    ["/src/path7", "/dest/path7"],
    ["./src/path8", "./dest/path8"],
    ["../src/path9", "../dest/path9"]
  ]
};
define("args", [], {build:[testBc]});
loader.require(["bdBuild/buildControl", "bdBuild/defaultBuildControl"], function(bc, defaultBc) {
  tests= tests.concat([
//36
    bc.basePath=="/home/rcgill/dev/bdBuild/test/unit",
    bc.destBasePath=="/home/rcgill/dev/bdBuild/test/unit-build",
    bc.destPackageBasePath=="/home/rcgill/dev/bdBuild/test/unit-build/packages",
    bc.pagePath=="/home/rcgill/dev/bdBuild/test/unit",

    eqByValue(bc.files, [
      ["/src/path/file1", "/dest/path/file1"],
      ["/home/rcgill/dev/bdBuild/test/unit/src/path/file2", "/home/rcgill/dev/bdBuild/test/unit-build/dest/path/file2"],
      ["/home/rcgill/dev/bdBuild/test/src/path/file3", "/home/rcgill/dev/bdBuild/test/dest/path/file3"]
    ]),
    eqByValue(bc.dirs, [
      ["/src/path4", "/dest/path4"],
      ["/home/rcgill/dev/bdBuild/test/unit/src/path5", "/home/rcgill/dev/bdBuild/test/unit-build/dest/path5"],
      ["/home/rcgill/dev/bdBuild/test/src/path6", "/home/rcgill/dev/bdBuild/test/dest/path6"]
    ]),
    eqByValue(bc.trees, [
      ["/src/path7", "/dest/path7"],
      ["/home/rcgill/dev/bdBuild/test/unit/src/path8", "/home/rcgill/dev/bdBuild/test/unit-build/dest/path8"],
      ["/home/rcgill/dev/bdBuild/test/src/path9", "/home/rcgill/dev/bdBuild/test/dest/path9"]
    ])

  ]);
});

// test basetree, files, dirs, trees with strings
loader.require.undef("bdBuild/buildControl");
loader.require.undef("args");
testBc= {
  baseTree:"/home/rcgill/dev/bdBuild/test/unit",

  files:[
    "./src/path/file1"
  ],

  dirs:[
    "./src/path2"
  ],

  trees:[
    "./src/path3"
  ]
};
define("args", [], {build:[testBc]});
loader.require(["bdBuild/buildControl", "bdBuild/defaultBuildControl"], function(bc, defaultBc) {
  tests= tests.concat([
//43
    bc.basePath=="/home/rcgill/dev/bdBuild/test/unit",
    bc.destBasePath=="/home/rcgill/dev/bdBuild/test/unit-build",
    bc.destPackageBasePath=="/home/rcgill/dev/bdBuild/test/unit-build/packages",
    bc.pagePath=="/home/rcgill/dev/bdBuild/test/unit",

    eqByValue(bc.files, [
      ["/home/rcgill/dev/bdBuild/test/unit/src/path/file1", "/home/rcgill/dev/bdBuild/test/unit-build/src/path/file1"]
    ]),
    eqByValue(bc.dirs, [
      ["/home/rcgill/dev/bdBuild/test/unit/src/path2", "/home/rcgill/dev/bdBuild/test/unit-build/src/path2"]
    ]),
    eqByValue(bc.trees, [
      ["/home/rcgill/dev/bdBuild/test/unit/src/path3", "/home/rcgill/dev/bdBuild/test/unit-build/src/path3"]
    ])

  ]);
});

// test explicit basePath etc., files with pairs, string, and excludes
loader.require.undef("bdBuild/buildControl");
loader.require.undef("args");
testBc= {
  basePath:"/my/basePath",
  destBasePath:"/my/destBasePath",
  destPackageBasePath:"/my/destPackageBasePath",
  pagePath:"/my/pagePath",

  files:[
    ["/src/path/file1", "/dest/path/file1"],
    "./src/path/file2",
    ["./src/path/file3", "./src/path/file3", "*/test/*", /.*\/nls\/.*/]
  ]

};
define("args", [], {build:[testBc]});
loader.require(["bdBuild/buildControl", "bdBuild/defaultBuildControl"], function(bc, defaultBc) {
  tests= tests.concat([
//50
    bc.basePath=="/my/basePath",
    bc.destBasePath=="/my/destBasePath",
    bc.destPackageBasePath=="/my/destPackageBasePath",
    bc.pagePath=="/my/pagePath",

    eqByValue(bc.files, [
      ["/src/path/file1", "/dest/path/file1"],
      ["/my/basePath/src/path/file2", "/my/destBasePath/src/path/file2"],
      ["/my/basePath/src/path/file3", "/my/destBasePath/src/path/file3", "*/test/*", /.*\/nls\/.*/]
    ])
  ]);
});

// test various methods of specifying packages
loader.require.undef("bdBuild/buildControl");
loader.require.undef("args");
var 
  testBc1= {
    basePath:"/my/basePath",

    packagePaths:{
      "/my/packages":[
        "package1",
        {name:"package2"}
      ],
      "/your/packages":[
        "package3"
     ]
   },
   packages:[
     "package4",
     {
       name:"package5",
       location:"/my/packag5/location"
     }
   ]
  },

  // override package5
  testBc2= {
   packages:[
     {
       name:"package5",
       location:"/your/packag5/location"
     }
   ]
  };
define("args", [], {build:[testBc1, testBc2]});
loader.require(["bdBuild/buildControl", "bdBuild/defaultBuildControl"], function(bc, defaultBc) {
  var expected= {
    package1:{ 
      name: 'package1'
    , location: '/my/packages/package1'
    , srcName: 'package1'
    , srcLib: 'lib'
    , srcMain: 'main'
    , srcUrlMap: []
    , srcPackageMap: 0
    , srcLocation: '/my/packages/package1'
    , exclude: []
    , destName: 'package1'
    , destLib: 'lib'
    , destMain: 'main'
    , destUrlMap: []
    , destPackageMap: 0
    , destLocation: '/my/basePath-build/packages/package1'
    , trees: 
       [ [ '/my/packages/package1/lib'
         , '/my/basePath-build/packages/package1/lib'
         , '*/.*'
         ]
       ]
    , files: []
    , dirs: []
    },
    package2:{ 
      name: 'package2'
    , location: '/my/packages/package2'
    , srcName: 'package2'
    , srcLib: 'lib'
    , srcMain: 'main'
    , srcUrlMap: []
    , srcPackageMap: 0
    , srcLocation: '/my/packages/package2'
    , exclude: []
    , destName: 'package2'
    , destLib: 'lib'
    , destMain: 'main'
    , destUrlMap: []
    , destPackageMap: 0
    , destLocation: '/my/basePath-build/packages/package2'
    , trees: 
       [ [ '/my/packages/package2/lib'
         , '/my/basePath-build/packages/package2/lib'
         , '*/.*'
         ]
       ]
    , files: []
    , dirs: []
    },
    package3:{ 
      name: 'package3'
    , location: '/your/packages/package3'
    , srcName: 'package3'
    , srcLib: 'lib'
    , srcMain: 'main'
    , srcUrlMap: []
    , srcPackageMap: 0
    , srcLocation: '/your/packages/package3'
    , exclude: []
    , destName: 'package3'
    , destLib: 'lib'
    , destMain: 'main'
    , destUrlMap: []
    , destPackageMap: 0
    , destLocation: '/my/basePath-build/packages/package3'
    , trees: 
       [ [ '/your/packages/package3/lib'
         , '/my/basePath-build/packages/package3/lib'
         , '*/.*'
         ]
       ]
    , files: []
    , dirs: []
    },
    package4:{ 
      name: 'package4'
    , srcName: 'package4'
    , srcLib: 'lib'
    , srcMain: 'main'
    , srcUrlMap: []
    , srcPackageMap: 0
    , srcLocation: '/my/basePath/package4'
    , exclude: []
    , destName: 'package4'
    , destLib: 'lib'
    , destMain: 'main'
    , destUrlMap: []
    , destPackageMap: 0
    , destLocation: '/my/basePath-build/packages/package4'
    , trees: 
       [ [ '/my/basePath/package4/lib'
         , '/my/basePath-build/packages/package4/lib'
         , '*/.*'
         ]
       ]
    , files: []
    , dirs: []
    },
    package5:{ 
      name: 'package5'
    , location: '/your/packag5/location'
    , srcName: 'package5'
    , srcLib: 'lib'
    , srcMain: 'main'
    , srcUrlMap: []
    , srcPackageMap: 0
    , srcLocation: '/your/packag5/location'
    , exclude: []
    , destName: 'package5'
    , destLib: 'lib'
    , destMain: 'main'
    , destUrlMap: []
    , destPackageMap: 0
    , destLocation: '/my/basePath-build/packages/package5'
    , trees: 
       [ [ '/your/packag5/location/lib'
         , '/my/basePath-build/packages/package5/lib'
         , '*/.*'
         ]
       ]
    , files: []
    , dirs: []
    },
    "*":{ 
      name: ''
      , lib: ''
      , main: ''
      , location: ''
      , destName: ''
      , srcName: ''
      , srcLib: ''
      , srcMain: ''
      , srcUrlMap: []
      , srcPackageMap: 0
      , srcLocation: '/my/basePath'
      , exclude: []
      , destLib: ''
      , destMain: ''
      , destUrlMap: []
      , destPackageMap: 0
      , destLocation: '/my/basePath-build'
      , trees: [ [ '/my/basePath', '/my/basePath-build', '*/.*' ] ]
      , files: []
      , dirs: []
    }
 };
  tests= tests.concat([
//55
    eqByValue(bc.packageMap.package1, expected.package1),
    eqByValue(bc.packageMap.package2, expected.package2),
    eqByValue(bc.packageMap.package3, expected.package3),
    eqByValue(bc.packageMap.package4, expected.package4),
    eqByValue(bc.packageMap.package5, expected.package5),
    eqByValue(bc.packageMap["*"], expected["*"])
  ]);
});

// test that the buildControl processing finds all non-absolute paths
loader.require.undef("bdBuild/buildControl");
loader.require.undef("args");
define("args", [], {build:[{
  files:[
    ["src/path/file1", "dest/path/file1"]
  ],

  dirs:[
    ["src/path3", "dest/path3"]
  ],

  trees:[
    ["src/path5", "dest/path5"]
  ]
}]});
loader.require(["bdBuild/buildControl", "bdBuild/defaultBuildControl"], function(bc, defaultBc) {
  tests= tests.concat([
//36
   bc.messages[0]=='ERROR: Unable to compute an absolute path for an item in files (src/path/file1,dest/path/file1)',
   bc.messages[1]=='ERROR: Unable to compute an absolute path for an item in dirs (src/path3,dest/path3)',
   bc.messages[2]=='ERROR: Unable to compute an absolute path for an item in trees (src/path5,dest/path5)'
  ]);
});



for (var failed= [], i= 0; i<tests.length; i++) if (!tests[i]) failed.push(i+"");
if (!failed.length) {
  console.log("passed all " + tests.length + " tests!");
} else {
  console.log("failed test(s) " + failed.join(", "));
}

