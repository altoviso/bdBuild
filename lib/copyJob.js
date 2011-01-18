///
// \module bdBuild/copyJob
//
define(["child_process", "fs", "bdBuild/fileUtils", "bdBuild/buildControl", "bdBuild/packageJob"], function(child_process, fs, fileUtils, bc, packageJob) {
var
  spawn= child_process.spawn,

  destBases,
  copyDirs= [],
  copyFiles= [],
  copySrc= 0,
  copyDest= 0,
  errorMessage,

  rewrite= function(filename, replacement) {
    var encoding= "utf8";
    if (replacement[1] instanceof Array) {
      // replacement is a vector of replacement instructions; maybe the first item is an encoding
      if (typeof replacement[0]=="string") {
        encoding= replacement[0];
        replacement= replacement.slice(1);
      }
    } else {
      // replacement is a single replacement [search, replacement, type] triple
      replacement= [replacement];
    }
    // at this point, encoding has been determined and replacement is a vector of [search, replacement, type] triples

    var contents= fs.readFileSync(filename, encoding);
    replacement.forEach(function(item) {
      var 
        searchText= item[0],
        replacementText= item[1],
        type= item[2];
      if (type=="file") {
        // replacementText gives a filename that holds the replacement text
        replacementText= fs.readFileSynch(packageJob.nameToUrl(replacementText), encoding);
      }
      if (searchText instanceof RegExp) {
        contents= contents.replace(searchText, replacementText);
      } else if (typeof searchText=="function") {
        contents= searchText(contents);
      } else {
        // replace all occurences of searchText with replacementText
        var 
          searchTextLength= searchText.length,
          replacementTextLength= replacementText.length,
          start= contents.indexOf(searchText);
        while (start!=-1) {
          contents= contents.substring(0, start) + replacementText + contents.substring(start + searchTextLength);
          start= contents.indexOf(searchText, start + replacementTextLength);
        }
      }
    });
    fs.writeFileSync(filename, contents, encoding);
  },

  doReplacements= function(copyDirs, copyFiles, replacements) {
    var found, filename, replacement, i, item;
    for (filename in replacements) {
      replacement= replacements[filename];
      filename= packageJob.nameToUrl(filename);
      found= false;
      for (i= 0; !found && i<copyFiles.length; i++) {
        item= copyFiles[i];
        if (item[0]==filename) {
          rewrite(item[2], replacement);
          found= true;
        }
      }
      for (i= copyDirs.length; !found && i--;) {
        item= copyDirs[i];
        if (!filename.indexOf(item[0])) {
          // this copyDir entry given holds filename
          rewrite(item[2] + filename.substring(item[0].length), replacement);
          found= true;
        }
      }
      if (found) {
        bc.log("completed replacements in " + filename);
      } else {
        bc.logError("failed to find " + filename + ", which has been designated to recieve replacements, in any source location.");
      }
    }
  },

  globalOptimize= function(
    cb
  ) {
    // find the list of directories that will receive output; other job start routines
    // may have already added to bd.destDirs, bc.copyDirs, and/or bd.copyFiles
    var dirs= bc.destDirs;
    dirs.push(bc.destBasePath, bc.destPackageBasePath);
    if (bc.destLoader) {
      dirs.push(fileUtils.getFilepath(bc.destLoader));
    }
    bc.copyDirs.forEach(function(pair) {
      dirs.push(pair[1]);
    });
    bc.copyFiles.forEach(function(pair) {
      dirs.push(getFilepath(pair[1]));
    });

    // filter down to the unique names
    var unique= {};
    dirs.forEach(function(path) { unique[path]= 1; });
    dirs= bc.destDirs= [];
    for (var p in unique) dirs.push(p);
    dirs.sort();

    // compute and remember the destination bases
    if (dirs.length) {
      destBases= [dirs[0]];
      for (var current= dirs[0], i= 1; i<dirs.length; i++) {
        if (dirs[i].indexOf(current)) {
          // dirs[i] is *not* a decendent of current
          current= dirs[i];
          destBases.push(current);
        }
      }
    }

    // compute the sandbox and backup directories; make sure no intersections with any destinations
    var
      sandbox= bc.sandbox= bc.sandbox + "/" + fileUtils.getTimestamp(bc.startTimestamp),
      backup= bc.backup= bc.backup || (bc.sandbox + "-backup");
    destBases.forEach(function(destPath) {
      if (sandbox.indexOf(destPath)==0 || destPath.indexOf(sandbox)==0)  {
        bc.logError('Distination and sandbox directories intersect (sandbox directory: "' + sandbox + '", destination directory: "' + destPath + '").');
        throw new Error("Illegal sandbox or destination path in configuration or build script.");
      }
      if (backup.indexOf(destPath)==0 || destPath.indexOf(backup)==0)  {
        bc.logError('Distination and backup directories intersect (backup directory: "' + backup + '", destination directory: "' + destPath + '").');
        throw new Error("Illegal backup or destination path in configuration or build script.");
      }
    });

    // create all the destinations
    dirs.forEach(function(path) {
      fileUtils.ensurePath(fileUtils.catPath(bc.sandbox, path));
    });

    // create vectors for the async copy jobs
    // sort copy jobs by dest, least specific to most specific so that more specific will overwrite least specific
    copyDirs= bc.copyDirs.sort(function(lhs, rhs){ return lhs[1] > rhs[1]; }).slice(0);
    copyFiles= bc.copyFiles.sort(function(lhs, rhs){ return lhs[1] > rhs[1]; }).slice(0);

    // start the async copy jobs
    var onCopyExit= function(code, signal) {
      if (code) {
        bc.logError("Failed copy, source= " + copySrc + ", dest= " + copyDest + ".\n" + errorMessage);
        cb(code || 1);
      }
      if (copySrc) {
        bc.log("Copied \"" + copySrc + "\" to \"" + copyDest + "\".");
      }
      var item, copy;
      errorMessage= "";
      if (copyDirs.length) {
        item= copyDirs.shift();
        copySrc= item[0] + "/";
        copyDest= item[2]= fileUtils.catPath(bc.sandbox, item[1]);
        copy= spawn("cp", ["-R", "-L", copySrc, copyDest]).on('exit', onCopyExit);
      } else if (copyFiles.length) {
        item= copyFiles.shift();
        copySrc= item[0];
        copyDest= item[2]= fileUtils.catPath(bc.sandbox, item[1]);
        copy= spawn("cp", [copySrc, copyDest]).on('exit', onCopyExit);
      } else {
        doReplacements(bc.copyDirs, bc.copyFiles, bc.replacements);
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

  cleanup= function(
    cb
  ) {
    bc.waiting++;

    destBases.forEach(function(path) {
      var backupDestPath= fileUtils.catPath(bc.backup, path);
      if (fileUtils.exists(path)) {
        fileUtils.ensurePath(fileUtils.getFilepath(backupDestPath));
        fs.renameSync(path, backupDestPath);
        bc.log("Wrote backup of \"" + path + "\" to \"" + backupDestPath + "\".");
      }
      fileUtils.ensurePath(path);
      fs.renameSync(fileUtils.catPath(bc.sandbox, path), path);
      bc.log("Wrote " + path + ".");
    });

    bc.waiting++;
    spawn("rm", ["-R", "-f", bc.sandbox]).on('exit', function(code) {
      bc.log("Deleted sandbox (" + bc.sandbox + ").");
      cb(code);
    });

    if (bc.destroyBackups) {
      bc.waiting++;
      spawn("rm", ["-R", "-f", bc.backup]).on('exit', function(code) {
        bc.log("Deleted backups (" + bc.backup + ").");
        cb(code);
      });
    }

    cb(0);
  },

  start= function(
    cb
  ) {
    bc.jobs["**copy"]= {
      globalOptimize:globalOptimize,
      cleanup:cleanup
    };
  };

return {
  start:start
};
});
