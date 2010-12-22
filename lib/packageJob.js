///
// \module bdBuild/packageJob
//

define(["./moduleJob", "./fileUtils", "./buildControl", "bdParse"], function(moduleJob, fileUtils, buildControl, bdParse) {
var
  startPackage= function(
    p,
    cb
  ) {
    var dest;
    if (p.destLocation.indexOf(buildControl.destRootPath)) {
      // this package is going someplace *not* under the destRootPath tree
      dest= p.tempLocation= buildControl.destRootPath + "/" + "package_lib_" + p.destName;
    } else {
      dest= p.destLocation + "/" + p.destLib;
    }
    var spawn= require('child_process').spawn;
    spawn("cp", ["-R", p.srcLocation + "/" + p.srcLib, dest]).on('exit', function (code, signal) {
      console.log("exited child process: " + code + ", " + signal);
      cb(code);
    });
  },

  start= function(
    cb
  ) {
    var packages= buildControl.packages;
    for (var p in packages) {
      startPackage(packages[p]);
    }
  };

return {
  start:start
};
});
