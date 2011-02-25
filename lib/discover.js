define(["./buildControl", "./fileUtils", "fs"], function(bc, fileUtils, fs) {
  // find all files as given by files, dirs, trees, and packages
  var
    files=
      // a set of the directory names that have been inspected
      {},

    treesDirsFiles= ["trees", "dirs", "files"],

    srcDirs= {},

    destDirs= {},

    getFilepath= fileUtils.getFilepath,
    catPath= fileUtils.catPath,
    compactPath= fileUtils.compactPath,

    start= function(resource) {
if (/plugins\/text/.test(resource.dest)) {
  debug(resource.src);
  debug(resource.dest);
  debug(resource.pqn);
}
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

    readSingleDir= function(srcPath, destPath, excludes, advise, traverse) {
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
            if (advise) {
              advise(fullFilename);
            } else {
              start({src:fullFilename, dest: destPath + "/" + filename});
            }
          }
        }
      });
      if (traverse && subdirs.length) {
        subdirs.forEach(function(path) {
          readSingleDir(path, destPath + path.substring(srcPathLength), excludes, advise, 1);
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

    readTree= function(item, advise) {
      var excludes= getExcludes(item);
      readSingleDir(item[0], item[1], excludes, advise, 1);
    },

    discover= {
      files:readFile,
      dirs:readDir,
      trees:readTree
    },

    processPackage= function(pack, destPack) {
      // find the package lib tree root in trees; trees may hold a parent directory
      for (var libPath= compactPath(catPath(pack.location, pack.lib)), libTreeItem= 0, trees= pack.trees || [], i= 0; !libTreeItem && i<trees.length; i++) {
        // remember "packages/myPack/lib" has indexOf 0 in "packages/myPack/libfoo", but is not a parent of it
        if (libPath.indexOf(trees[i][0])==0 && (libPath.length==trees[i][0].length || libPath.charAt(libPath.length)=="/")) {
          libTreeItem= trees[i];
        }
      }
      // three possibilities: 1-trees holds libPath, exactly; 2-parent of libPath in trees; trees doesn't hold libPath at all
      var destPath= compactPath(catPath(destPack.location, destPack.lib));
      if (libTreeItem[0]==libPath && libTreeItem[1]==destPath) {
        // case 1         
      } else if (libTreeItem) {
        // case 2
        // use the excludes provided by item in trees; don't kill the item in trees
        libTreeItem= [libPath, destPath].concat(libTreeItem.slice(2));
      } else {
        // case 3
        // create a tree item; don't traverse into hidden, backdup files (e.g., .svn, .git, etc.)
        libTreeItem= [libPath, destPath, "*/.*", "*~"];
      }
      // libTreeItem says how to discover all modules in this package
      var filenames= [];
      readTree(libTreeItem, function(filename){ filenames.push(filename); });

      // next, sift filenames to find AMD modules
      var 
        maybeAmdModules= {},
        notModules= {},
        libPathLength= libPath.length + 1,
        packName= pack.name,
        prefix= packName ? packName + "/" : "",
        mainModuleInfo= packName && bc.getSrcModuleInfo(packName, 0),
        mainModuleFilename= packName && mainModuleInfo.url;
      filenames.forEach(function(filename) {
        // strip the package location path and the .js suffix (iff any) to get the mid
        var 
          maybeModule= /\.js$/.test(filename),
          mid= prefix + filename.substring(libPathLength, maybeModule ? filename.length-3 : filename.length),
          moduleInfo= maybeModule && bc.getSrcModuleInfo(mid);
        if (!maybeModule) {
          notModules[mid]= filename;
        } else if (filename==mainModuleFilename) {
          maybeAmdModules[packName]= mainModuleInfo;
        } else if (moduleInfo.url==filename) {
          maybeAmdModules[mid]= moduleInfo;
        } else {
          notModules[mid]= filename;
        }
      });

      // add modules as per explicit pack.modules vector; this is a way to add modules that map strangely
      // (for example "myPackage/foo" maps to the file "myPackage/bar"); recall, packageInfo.modules has two forms:
      // 
      //   modules: {
      //     "foo":1,
      //     "foo":"path/to/foo/filename.js"
      //   }
      for (var mid in pack.modules) {
        var
          fullMid= prefix + mid,
          moduleInfo= bc.getSrcModuleInfo(fullMid);
        if (typeof pack.modules[mid]=="string") {
          moduleInfo.url= pack.modules[mid];
        }
        maybeAmdModules[fullMid]= moduleInfo;
        delete notModules[fullMid];
      };
      // start all the package modules; each property holds a module info object
      for (var p in maybeAmdModules) {
        var moduleInfo= maybeAmdModules[p];
        start({
          src:moduleInfo.url,
          dest:bc.getDestModuleInfo(moduleInfo.path).url,
          pid:moduleInfo.pid,
          mid:moduleInfo.mid,
          pqn:moduleInfo.pqn,
          pack:pack,
          path:moduleInfo.path,
          deps:[]
        });
      }

      // start all the "notModules"
      var prefixLength= prefix.length;
      for (p in notModules) {
        start({
          src:notModules[p],
          dest:catPath(destPath, p.substring(prefixLength))
        });
      }

      // finish by processing all the trees, dirs, and files explicitly specified for the package
      for (i= 0; i<treesDirsFiles.length; i++) {
        var set= treesDirsFiles[i];
        if (pack[set]) {
          pack[set].forEach(function(item) {
            discover[set](item);
          });
        }
      }
    },

    discoverPackages= function() {
      // discover all the package modules; discover the default package last since it may overlap
      // into other packages and we want modules in those other packages to be discovered as members
      // of those other packages; not as a module in the default package
      for (var p in bc.packages) if (p!="*") {
        processPackage(bc.packages[p], bc.destPackages[p]);
      }
      if (bc.packages["*"]) {
        processPackage(bc.packages["*"], bc.destPackages["*"]);
      }
    };

  return function() {
    ///
    // bdBuild/discover
 
    discoverPackages();
  
    // discover all trees, dirs, and files
    for (var i= 0; i<treesDirsFiles.length; i++) {
      var set= treesDirsFiles[i];
      bc[set].forEach(function(item) {
        discover[set](item);
      });
    }

    // advise all modules that are to be written as a layer
    // advise the loader of boot layers
    for (var mid in bc.layers) {
      var 
        resource= bc.amdResources[bc.getSrcModuleInfo(mid).pqn],
        layer= bc.layers[mid];
      if (!resource) {
        bc.logError("unable to find the resource for layer (" + mid + ")");
      } else if (layer.boot) {
        if (bc.loader) {
          layer.include.unshift(mid);
          bc.loader.boots.push(layer);
        } else {
          bc.logError("unable to find loader for boot layer (" + mid + ")");
        }
      } else {
        resource.layer= layer;
      }
    }
  };
});
