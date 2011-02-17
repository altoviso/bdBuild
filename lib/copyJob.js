///
// \module bdBuild/copyJob
//
define(["child_process", "fs", "bdBuild/fileUtils", "bdBuild/buildControl", "bdBuild/packageJob", "bdParse"], function(child_process, fs, fileUtils, bc, packageJob, bdParse) {
var
  spawn= child_process.spawn,


  copyDirs= 
    // a working copy of bc.copyDirs
    [],

  copyFiles= 
    // a working copy of bc.copyFiles
    [],

  destBases,
    // the list if root destination directorys

  currentCopyDirsFind= 
    // the current bc.copyDir item being processed by onFindCopyDirs
    0,

  copyDirsExpanded= 
    // the vector of pairs of [src-path, dest-path] that gives the individual directories to copy
    [],

  copySrc= 0,
  copyDest= 0,
    // the current source and destination of the current spawned copy command

  errorMessage= 
    // used to accumulate error output from spawned processes
    "",

  rewrite= function(filename, replacement) {
    filename= bc.sandbox + filename;
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
          rewrite(item[1], replacement);
          found= true;
        }
      }
      for (i= copyDirs.length; !found && i--;) {
        item= copyDirs[i];
        if (!filename.indexOf(item[0])) {
          // this copyDir entry given holds filename
          rewrite(item[1] + filename.substring(item[0].length), replacement);
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

  copy= function(code, signal) {
    if (code) {
      bc.logError("Failed copy, source= " + copySrc + ", dest= " + copyDest + ".\n" + errorMessage);
      bc.cb(code || 1);
    }
    if (copySrc) {
      bc.log("Copied \"" + copySrc + "\" to \"" + copyDest + "\".");
    }
    var item, process;
    if (copyDirs.length) {
      item= copyDirs.shift();
      copySrc= item[0];
      copyDest= item[2]= fileUtils.catPath(bc.sandbox, item[1]);
      process= spawn("find", [copySrc, "-type", "f", "-depth", "1", "-exec", "cp", "{}", copyDest, ";"]).on('exit', copy);

    } else if (copyFiles.length) {
      item= copyFiles.shift();
      copySrc= item[0];
      copyDest= item[2]= fileUtils.catPath(bc.sandbox, item[1]);
      process= spawn("cp", [copySrc, copyDest]).on('exit', copy);
    } else {
      doReplacements(bc.copyDirs, bc.copyFiles, bc.replacements);
      bc.cb(0);
      return;
    }
    process.stderr.on('data', function (data) {
      errorMessage+= data.toString("ascii");
    });
  },

  analyzeRequest= function() {
    // copyDirsExpanded now holds a pair for each specific directory that will be copied

    // check which dirs have been requested to copy and warn of unusual copying
    var srcDirs= {}, destDirs= {};
    copyDirsExpanded.forEach(function(item) {
      var 
        src= item[0],
        dest= item[1],
        dests= srcDirs[src] || (srcDirs[src]= []),
        srcss= destDirs[dest] || (destDirs[dest]= []);
      if (dests.indexOf(dest)==-1) {
        dests.push(dest);
      }
      if (!srcss.indexOf(src)==-1) {
        srcs.push(src);
      }
    });
    var p, dests, srcs;
    // cleanup copyDirsExpanded to eliminate any dups as part of the next iteration
    copyDirsExpanded= [];
    for (p in srcDirs) {
      dests= srcDirs[p];
      if (dests.length>1) {
        bc.logWarn("The directory " + p + " will be copied into multiple destinations (" + dests.join(", ") + ")");
      }
      dests.forEach(function(dest) {copyDirsExpanded.push([p, dest]);});
    }
    for (p in destDirs) {
      srcs= destDirs[p];
      if (srcs.length>1) {
        bc.logWarn("Multiple directories (" + srcs.join(", ") + ") will be copied into the directory " + p);
      }
    }


    // find the list of directories that will receive output
    var dirs= bc.destDirs;
    if (bc.destLoader) {
      dirs.push(fileUtils.getFilepath(bc.destLoader));
    }
    copyDirsExpanded.forEach(function(pair) {
      dirs.push(pair[1]);
    });
    bc.copyFiles.forEach(function(pair) {
      dirs.push(getFilepath(pair[1]));
    });

    // filter down to the unique names and sort lexically
    var unique= {};
    dirs.forEach(function(path) { unique[path]= 1; });
    dirs= bc.destDirs= [];
    for (p in unique) dirs.push(p);
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

    // create working vectors for the async copy jobs
    copyDirs= copyDirsExpanded.slice(0);
    copyFiles= bc.copyFiles.slice(0);

    // start the async copy jobs
    copy(0, 0);
  },

  copyDirsFindOutput,
    // the cummulative output of a single find command fun by onFindCopyDirs

  onFindCopyDirs= function(code, signal) {
    if (code) {
      bc.logError("Failed to inspect \"" + current[0] + "\" while trying to copy this directory.\n" + errorMessage);
      bc.cb(code);
      return;
    }
    if (currentCopyDirsFind) {
      var 
        list= bdParse.split(copyDirsFindOutput),
        srcRootLength= currentCopyDirsFind[0].length,
        destRoot= currentCopyDirsFind[1];
      list.forEach(function(path) {
        if (path) {
          copyDirsExpanded.push([path, destRoot + path.substring(srcRootLength)]);
        }
      });
    }
    if (copyDirs.length) {
      var current= currentCopyDirsFind= copyDirs.pop();
      var params= ["-L", current[0], "-type", "d"];
      current[2].forEach(function(exclude) {
        params.push("-and", "!", "-path", exclude);
      });
      copyDirsFindOutput= "";
      var find= spawn("find", params);
      find.stdout.on('data', function (data) {
        copyDirsFindOutput+= data.toString("ascii");
      });
      find.stderr.on('data', function (data) {
        errorMessage+= data.toString("ascii");
      });
      find.on("exit", onFindCopyDirs);
    } else {
      analyzeRequest();
    }
  },  

  globalOptimize= function(
    cb
  ) {
    // wait for global optimize phase to do copying since other job start routines
    // may add to bd.destDirs, bc.copyDirs, and/or bd.copyFiles
    bc.waiting++;
    copyDirs= bc.copyDirs.slice(0);
    currentCopyDirsFind= 0;
    onFindCopyDirs(0, 0);
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
      bc.cb(code);
    });

    if (bc.destroyBackups) {
      bc.waiting++;
      spawn("rm", ["-R", "-f", bc.backup]).on('exit', function(code) {
        bc.log("Deleted backups (" + bc.backup + ").");
        bc.cb(code);
      });
    }

    bc.cb(0);
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
