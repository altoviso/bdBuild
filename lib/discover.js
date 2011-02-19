define(["./fileUtils", "fs"], function(fileUtils, fs) {
  return function(bc) {
    // find all files as given by files, dirs, trees, and packageMap
    var
      files=
        // a set of the directory names that have been inspected
        {},
  
      treesDirsFiles= ["trees", "dirs", "files"],

      srcDirs= {},

      destDirs= {},

      getFilepath= fileUtils.getFilepath,

      start= function(resource) {
        bc.start(resource);
        srcDirs[getFilepath(resource.src)]= 1;
        destDirs[getFilepath(resource.dest)]= 1;
      },
  
      getExcludes= function(item) {
        // item is a tress, dirs, of files item...[src, dest, [excludes]]
        var result= item.slice(2);
        if (!result.length) {
          return 0;
        }
  
        // turn globs to regular expressions;
        for (var i= 0, length= result.length; i<length; i++) {
          if (typeof result[i] === "string") {
            result[i]= new RegExp(result[i].replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, function(c) {
              return (c=="*" || c=="?") ? "." + c : "\\" + c;
            }));
          }
        }
      
        return function(filename) {
          for (var i= 0; i<length;) {
            if (result[i++].test(filename)) {
              return true;
            }
          }
          return false;
        };
      },
  
      readSingleDir= function(srcPath, destPath, excludes, packageInfo, traverse) {
        if (files[srcPath]) {
          return;
        }
        files[srcPath]= 1;
        var
          srcPathLength= srcPath.length,
          subdirs= [];
        fs.readdirSync(srcPath).forEach(function(filename) {
          var fullFilename= srcPath + "/" + filename;
          if (!excludes || !excludes(fullFilename)) {
            var stats= fs.statSync(fullFilename);
            if (stats.isDirectory()) {
              subdirs.push(fullFilename);
            } else {
              var resource= {
                src:fullFilename
              };
              if (packageInfo) {
                resource.packageInfo= packageInfo;
              } else {
                resource.dest= destPath + "/" + filename;
              };
              start(resource);
            }
          }
        });
        if (traverse && subdirs.length) {
          subdirs.forEach(function(path) {
            readSingleDir(path, destPath + path.substring(srcPathLength), excludes, packageInfo, 1);
          });
        }
      },
  
      readFile= function(item) {
        start({src:item[0], dest:item[1]});
      },
  
      readDir= function(item) {
        var excludes= getExcludes(item);
        readSingleDir(item[0], item[1], excludes, 0, 0, 0);
      },
  
      readTree= function(item, packageInfo) {
        var excludes= getExcludes(item);
        readSingleDir(item[0], item[1], excludes, packageInfo, 1);
      },
  
      discover= {
        files:readFile,
        dirs:readDir,
        trees:readTree
      },
  
      processPackage= function(packageInfo) {
        // compute the lib tree root; make sure it's in trees
        var libPath= catPath(packageInfo.srcLocation, packgeInfo.srcLib);
        for (var libTreeItem= 0, trees= packageInfo.trees, i= 0; !libTreeItem && i<trees.length; i++) {
          if (trees[i][0]==libPath) {
            libTreeItem= trees[i];
          }
        }
        if (!libTreeItem) {
          // if the lib tree isn't given explicitly, then automatically create an item
          // don't traverse into hidden files (e.g., .svn, .git, etc.)
          packageInfo.trees.push([libPath, catPath(packageInfo.srcLocation, packgeInfo.srcLib), "*/.*"]);
        }
    
        // discover all trees, dirs, and files for the package, inform the discover procs when traversing
        // the lib directory so that all .js modules can be marked for AMD package module discovery
        for (i= 0; i<treesDirsFiles.length; i++) {
          var set= treesDirsFiles[i];
          packageInfo[set].forEach(function(item) {
            discover[set](item, item[0]==libPath && packageInfo);
          });
        }
      },

      computeBases= function(dirSet) {
        // compute and remember the src bases
        var dirs= [];
        for (p in dirSet) dirs.push(p);
        dirs.sort();
        var result= [];
        if (dirs.length) {
          result.push(dirs[0]);
          for (var current= dirs[0], i= 1; i<dirs.length; i++) {
            if (dirs[i].indexOf(current)) {
              // dirs[i] is *not* a decendent of current
              current= dirs[i];
              result.push(current);
            }
          }
        }
        return result;
      };

    // function discover starts here...
    for (var p in bc.packageMap) {
      processPackage(bc.packageMap[p]);
    }
  
    for (var i= 0; i<treesDirsFiles.length; i++) {
      var set= treesDirsFiles[i];
      bc[set].forEach(function(item) {
        discover[set](item);
      });
    }

    var 
      srcBases= computeBases(srcDirs),
      srcBasesLength= srcBases.length,
      destBases= computeBases(destDirs),
      overwrite= {},
      overwriteList= []; 
    // note, these should be quite small sets so the n-squared algorithm shouldn't hurt...
    destBases.forEach(function(dir) {
      for (var src, i= 0; i<srcBasesLength; i++) {
        src= srcBases[i];
        if (dir.length<src.length) {
          if (indexOf(dir)==0) {
            overwrite[dir]= 1;
          }
        } else if (dir.indexOf(src)==0) {
          overwrite[dir]= 1;
        }
      }
    });

    for (p in overwrite) overwriteList.push(p);
    if (overwriteList.length) {
      bc.logError("some destinations overwrite some sources:\n" + overwriteList.join("\n") + "\nterminating application");
      process.exit(0);
    }
  };
});

