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

// test the fileUtils module
loader.require(["bdBuild/fileUtils", "fs"], function(fileUtils, fs) {
  tests= tests.concat([
//0
   fileUtils.getFilename("test")=="test",
   fileUtils.getFilename("test.")=="test.",
   fileUtils.getFilename("test.js")=="test.js",
   fileUtils.getFilename("/test")=="test",
   fileUtils.getFilename("/test.")=="test.",
   fileUtils.getFilename("/test.js")=="test.js",
   fileUtils.getFilename("A/test")=="test",
   fileUtils.getFilename("A/test.")=="test.",
   fileUtils.getFilename("A/test.js")=="test.js",
   fileUtils.getFilename("/A/test")=="test",
   fileUtils.getFilename("/A/test.")=="test.",
   fileUtils.getFilename("/A/test.js")=="test.js",
   fileUtils.getFilename("A/B/test")=="test",
   fileUtils.getFilename("A/B/test.")=="test.",
   fileUtils.getFilename("A/B/test.js")=="test.js",
//15
   fileUtils.getFilepath("test")=="",
   fileUtils.getFilepath("test.")=="",
   fileUtils.getFilepath("test.js")=="",
   fileUtils.getFilepath("/test")=="/",
   fileUtils.getFilepath("/test.")=="/",
   fileUtils.getFilepath("/test.js")=="/",
   fileUtils.getFilepath("A/test")=="A",
   fileUtils.getFilepath("A/test.")=="A",
   fileUtils.getFilepath("A/test.js")=="A",
   fileUtils.getFilepath("/A/test")=="/A",
   fileUtils.getFilepath("/A/test.")=="/A",
   fileUtils.getFilepath("/A/test.js")=="/A",
   fileUtils.getFilepath("A/B/test")=="A/B",
   fileUtils.getFilepath("A/B/test.")=="A/B",
   fileUtils.getFilepath("A/B/test.js")=="A/B",
   fileUtils.getFilepath("/A/B/test")=="/A/B",
   fileUtils.getFilepath("/A/B/test.")=="/A/B",
   fileUtils.getFilepath("/A/B/test.js")=="/A/B",
//33
   fileUtils.getFiletype("test")=="",
   fileUtils.getFiletype("test.")==".",
   fileUtils.getFiletype("test.a")==".a",
   fileUtils.getFiletype("test.abc")==".abc",
   fileUtils.getFiletype("/this/is/a/test/test.abc")==".abc",
//38
   fileUtils.cleanupPath()=="",
   fileUtils.cleanupPath("hello\\windows\\why\\are\\you\\different")=="hello/windows/why/are/you/different",
   fileUtils.cleanupPath("/")=="/",
   fileUtils.cleanupPath("this/is/a/test")=="this/is/a/test",
   fileUtils.cleanupPath("this/is/a/test/")=="this/is/a/test",
//43
   fileUtils.isAbsolutePath("test")===false,
   fileUtils.isAbsolutePath("this/is/a/test")===false,
   fileUtils.isAbsolutePath("/test"),
   fileUtils.isAbsolutePath("/this/is/a/test"),
//47
   fileUtils.catPath("", "")=="",
   fileUtils.catPath("this", "")=="this",
   fileUtils.catPath("", "this")=="this",
   fileUtils.catPath("this", "is")=="this/is",
   fileUtils.catPath("this/is", "a/path")=="this/is/a/path",
   fileUtils.catPath("this/is/", "a/path")=="this/is/a/path",
   fileUtils.catPath("this/is", "/a/path")=="this/is/a/path",
   fileUtils.catPath("this/is/", "/a/path")=="this/is/a/path",
   fileUtils.catPath("/", "this/is/a/path")=="/this/is/a/path",
   fileUtils.catPath("/", "/this/is/a/path")=="/this/is/a/path",
   fileUtils.catPath("/", "this", "is", "a", "path")=="/this/is/a/path",
//58
   fileUtils.compactPath("this/is/a/test/")=="this/is/a/test/",
   fileUtils.compactPath("/this/is/a/test")=="/this/is/a/test",
   fileUtils.compactPath("/this/is/a/test/")=="/this/is/a/test/",
   fileUtils.compactPath("/this/is/./a/test/")=="/this/is/a/test/",
   fileUtils.compactPath("/this/is/././a/test/")=="/this/is/a/test/",
   fileUtils.compactPath("/./this/./is/././a/./test/")=="/this/is/a/test/",
   fileUtils.compactPath("/this/is/a/test/..")=="/this/is/a/",
   fileUtils.compactPath("this/is/a/../test")=="this/is/test",
   fileUtils.compactPath("this/is/a/../../test")=="this/test",
   fileUtils.compactPath("/this/is/a/../../../test")=="/test",
//68
   fileUtils.getMode("0")==0,
   fileUtils.getMode("1")==1,
   fileUtils.getMode("2")==2,
   fileUtils.getMode("3")==3,
   fileUtils.getMode("4")==4,
   fileUtils.getMode("5")==5,
   fileUtils.getMode("6")==6,
   fileUtils.getMode("7")==7,

   fileUtils.getMode("00")==0,
   fileUtils.getMode("11")==(1*8 + 1),
   fileUtils.getMode("22")==(2*8 + 2),
   fileUtils.getMode("33")==(3*8 + 3),
   fileUtils.getMode("44")==(4*8 + 4),
   fileUtils.getMode("55")==(5*8 + 5),
   fileUtils.getMode("66")==(6*8 + 6),
   fileUtils.getMode("77")==(7*8 + 7),

   fileUtils.getMode("000")==0,
   fileUtils.getMode("111")==(1*64 + 1*8 + 1),
   fileUtils.getMode("222")==(2*64 + 2*8 + 2),
   fileUtils.getMode("333")==(3*64 + 3*8 + 3),
   fileUtils.getMode("444")==(4*64 + 4*8 + 4),
   fileUtils.getMode("555")==(5*64 + 5*8 + 5),
   fileUtils.getMode("666")==(6*64 + 6*8 + 6),
   fileUtils.getMode("777")==(7*64 + 7*8 + 7),
//92
   fileUtils.exists(loader.require.nameToUrl("bdBuild/main")+".js"),
   fileUtils.exists(loader.require.nameToUrl("bdBuild/main")+"jibberish")===false,
//94
   (function() {
     var failed= 0;

     function reset() {
       // make sure the test directories are not there...
       try {
         fs.rmdirSync(__dirname + "/junk/for/testing");
       } catch(e){}
       try {
         fs.rmdirSync(__dirname + "/junk/for");
       } catch(e){}
       try {
       fs.rmdirSync(__dirname + "/junk");
       } catch(e){}
       fileUtils.exists(__dirname + "/junk") && failed++;
       fileUtils.exists(__dirname + "/junk/for") && failed++;
       fileUtils.exists(__dirname + "/junk/for/testing") && failed++;
       fileUtils.clearCheckedDirectoriesCache();
     }

     //create via path...
     reset();
     fileUtils.ensureDirectory(__dirname + "/junk");
     fileUtils.ensureDirectory(__dirname + "/junk/for/testing");
     // do it again, if watching in the debugger, shouldn't see directories remade
     fileUtils.ensureDirectory(__dirname + "/junk");
     fileUtils.ensureDirectory(__dirname + "/junk/for/testing");
     !fileUtils.exists(__dirname + "/junk/for/testing") && failed++;

     //create via filename...
     reset();
     fileUtils.ensureDirectoryByFilename(__dirname + "/junk/someFile");
     fileUtils.ensureDirectoryByFilename(__dirname + "/junk/for/testing/someFile");
     // do it again, if watching in the debugger, shouldn't see directories remade
     fileUtils.ensureDirectoryByFilename(__dirname + "/junk/someFile");
     fileUtils.ensureDirectoryByFilename(__dirname + "/junk/for/testing/someFile");
     !fileUtils.exists(__dirname + "/junk/for/testing") && failed++;

     //cleanup
     reset();
     return failed==0;
   })()
  ]);
});


for (var failed= [], i= 0; i<tests.length; i++) if (!tests[i]) failed.push(i+"");
if (!failed.length) {
  console.log("passed all " + tests.length + " tests!");
} else {
  console.log("failed tests " + failed.join(", "));
}
