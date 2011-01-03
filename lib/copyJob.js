///
// \module bdBuild/copyJob
//
define(["child_process", "fs", "bdBuild/fileUtils", "bdBuild/buildControl"], function(child_process, fs, fileUtils, bc) {
var
  spawn= child_process.spawn,

  copyDirs= [],
  copyFiles= [],
  finalDirs= [],
  job,
  errorMessage= "",

  read= function(
    cb
  ) {
    var onCopyExit= function(code, signal) {
      if (code || errorMessage) {
        console.log("failed copy, source= " + job[0] + ", dest= " + job[1] + ".\n" + errorMessage);
        cb(code || 1);
      }
      var copy;
      if (copyDirs.length) {
        job= copyDirs.shift();
        copy= spawn("cp", ["-R", "-L", job[0] + "/", fileUtils.catPath(bc.sandbox, job[1])]).on('exit', onCopyExit);
      } else if (copyFiles.length) {
        job= copyFiles.shift();
        copy= spawn("cp", [job[0], fileUtils.catPath(bc.sandbox, job[1])]).on('exit', onCopyExit);
      } else {
        cb(0);
        return;
      }
      copy.stderr.on('data', function (data) {
        errorMessage+= data.toString("ascii");
      });
    };
    bc.waiting++;
    onCopyExit(0, 0);
  },

  globalOptimize= function(
    cb
  ) {
  },

  write= function(
    cb
  ) {
    bc.destBases.forEach(function(path) {
      //console.log("write, ensure= " + path);
      //console.log("write, rename= " + fileUtils.catPath(bc.sandbox, path) + " to " + path);
      fileUtils.ensurePath(path);
      fs.renameSync(fileUtils.catPath(bc.sandbox, path), path);
    });
  },

  start= function(
    cb
  ) {
    // create all the destination directories
    var dirs= [];
    bc.copyDirs.forEach(function(pair) {
      dirs.push(pair[1]);
    });
    bc.copyFiles.forEach(function(pair) {
      dirs.push(getFilepath(pair[1]));
    });
    dirs.sort();
    for (var next, current= 0, i= 0, end= dirs.length; i<end; i++) {
      next= dirs[i];
      if (next!=current) {
        fileUtils.ensurePath(fileUtils.catPath(bc.sandbox, next));
        current= next;
      }
    }

    // sort copy jobs by dest, least specific to most specific so that
    // more specific will overwrite least specific
    bc.copyDirs.sort(function(lhs, rhs){ return lhs[1] < rhs[1]; });
    bc.copyFiles.sort(function(lhs, rhs){ return lhs[1] < rhs[1]; });

    // create vectors for the asynch jobs
    copyDirs= bc.copyDirs.slice(0);
    copyFiles= bc.copyFiles.slice(0);

    bc.jobs["**copy"]= {
      read:read,
      globalOptimize:globalOptimize,
      write:write
    };

  };

return {
  start:start
};
});
