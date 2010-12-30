///
// \module bdBuild/layersJob
//
define(["./moduleJob", "./fileUtils", "./buildControl", "bdParse"], function(moduleJob, fileUtils, buildControl, parser) {

var
  depsSet,
 
  visitedSet,

  getPack= function(pid) {
    return buildControl["**package*" + pid];
  },

  resolve= function(name, reference) {
    if (name.charAt(0)==".") {
    } else {
      var match= name.match(/([^\/]+)\/(.+)/);
      if (match) {
        // either a module name in the default package or a package/module
        var packageId= "**package*" + match[1] + "*";
        if (buildControl[packageId]) {
        
        }
    }
  }

  traverse= function(name) {
    if (visitedSet[name]) {
      return;
    }
    visitedSet[name]= 1;
    depsSet=
    var split=
  },

  read= function(cb) {
    if (buildControl.main) {
    }
  },

  globalOptimize= function(cb) {
  },

  write= function(cb) {
    if (buildControl.layers) {
    }
    if (buildControl.loaderConfig) {
      var loaderConfig= buildControl.loaderConfig;
      if (loaderConfig.main) {
        depsSet= {};
        visitedSet= {};
        traverse(loaderConfig.main);
      }
      if (loaderConfig.deps) {
      }
    }
    for (var p in buildControl.jobs) console.log(p);
  },

  start= function(
    cb
  ) {
    buildControl.jobs["**layers"]= {
      read:read,
      globalOptimize:globalOptimize,
      write:write
    };
  };

return {
  start:start
};
});
