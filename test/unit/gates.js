var
  // configuration info for the build program
  config= require("../../lib/config"),

  // load the AMD loader
  loader= require(config.amdLoader).boot();

// configure the loader
loader.require(config.amdLoaderConfig);

// define the node.js file system module to the AMD loader
define("fs", [], require("fs"));

var tests= [];

var start= new Date();

// test the discover module
define("bdBuild/buildControl", [], {
  packageMap:{},
  trees:[["/home/rcgill/dev/dojotoolkit", "/home/rcgill/dev/junk", "*/.*"]],
  dirs:[],
  files:[]
});
loader.require(["bdBuild/gates"], function(gates) {
  console.log(gates);
  tests= tests.concat([
//0
    false,
    false
  ]);
});


for (var failed= [], i= 0; i<tests.length; i++) if (!tests[i]) failed.push(i+"");
if (!failed.length) {
  console.log("passed all " + tests.length + " tests!");
} else {
  console.log("failed tests " + failed.join(", "));
}

console.log("time: " + ((new Date()).getTime() - start.getTime()) / 1000);
