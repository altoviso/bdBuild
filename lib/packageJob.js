///
// \module bdBuild/packageJob
//

define(["./moduleJob", "./fileUtils", "./buildControl", "bdParse"], function(moduleJob, fileUtils, buildControl, parser) {
var
  spawn= require('child_process').spawn,

  readModule= function(
    cb
  ) {
    buildControl.waiting++;
    var thisObject= this;
    fileUtils.read(this.srcFilename, function(err, text) {
      if (err) {
        cb(err);
        return;
      }
      try {
        thisObject.text= text;
        buildControl.jsResourceTextProc(thisObject);
        thisObject.tokens= parser.tokenize(thisObject.text);
        buildControl.jsResourceTokenProc(thisObject);
        thisObject.tree= parser.parse(thisObject.tokens);
        buildControl.jsResourceAstProc(thisObject);
        cb(0);
      } catch (e) {
console.log("processing: " + thisObject.srcFilename);
console.log(e);
        cb(e);
      }
    });
  },

  globalOptimizeModule= function(
    cb
  ) {
  },

  writeModule= function(
    cb
  ) {
    buildControl.waiting++;
    try {
      var 
        pack= this.pack,
        destFilename= pack.destLocation + "/" + pack.destLib + "/" + this.moduleName;
      fileUtils.write(destFilename, "//synthesized!\n" + moduleJob.getContent(this.text, this.deleteList), cb);
    } catch (e) {
      cb(e);
    }
  },

  startModule= function(
    pack,
    fullName,
    moduleName,
    cb
  ) {
    var packageName= pack.srcName;
    return (buildControl.jobs[packageName + "*" + moduleName]= {
      pack:pack,
      moduleName: moduleName,
      srcFilename: fullName,
      read:readModule,
      globalOptimize:globalOptimizeModule,
      write:writeModule
    });
  },

  read= function(
    cb
  ) {
    var 
      src= this.srcLocation + "/" + this.srcLib,
      dest;
    if (this.destLocation.indexOf(buildControl.destRootPath)) {
      // this package is going someplace *not* under the destRootPath tree
      dest= this.tempLocation= buildControl.destRootPath + "/" + "package_lib_" + this.destName;
    } else {
      dest= this.destLocation + "/" + this.destLib;
    }
    fileUtils.ensurePath(fileUtils.getFilepath(dest));
    buildControl.waiting++;
    var copy= spawn("cp", ["-R", "-L", src, dest]).on('exit', function (code, signal) {
      cb(code);
    });
    copy.stderr.on('data', function (data) {
      console.log("find std err");
      console.log(data.toString("ascii"));
    });

  },

  globalOptimize= function(
    cb
  ) {
  },

  write= function(
    cb
  ) {
  },

  startPackage= function(
    pack,
    cb
  ) {
    buildControl.jobs[pack.srcName + "*"]= pack;
    pack.read= read;
    pack.globalOptimize= globalOptimize;
    pack.write= write;

    buildControl.waiting++;
    var 
      src= pack.srcLocation + "/" + pack.srcLib,
      srcLength= src.length,
      find= spawn("find", ["-L", src, "-name", "*.js", "!", "-path", "*/nls/*"]),
      list= "";
    find.stdout.on('data', function (data) {
      list+= data.toString("ascii");
    });
    find.stderr.on('data', function (data) {
      console.log("find std err");
      console.log(data.toString("ascii"));
    });
    find.on("exit", function(code, signal) {
      if (!code) {
        list= parser.split(list);
        // the new-line after the last item causes an empty entry at the ent
        list.pop();
        pack.modules= list.map(function(name) {
          return startModule(pack, name, name.substring(srcLength+1), cb); 
        });
      }
      cb(code);
    });

  },

  start= function(
    cb
  ) {
    var packages= buildControl.packages;
    buildControl.waiting++;
    for (var p in packages) {
      startPackage(packages[p], cb);
    }
    cb(0);
  };

return {
  start:start
};
});
