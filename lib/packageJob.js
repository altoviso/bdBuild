///
// \module bdBuild/packageJob
//

define(["./fileUtils", "./bc", "bdParse"], function(fileUtils, bc, parser) {
var
  spawn= require('child_process').spawn,

  catPath= fileUtils.catPath,

  mapUrl= function(
    filename, 
    urlMap
  ) {
    for (var i= 0, result= 0, item; !result && urlMap && i<urlMap.length;) {
      item= urlMap[i++];
      if (isFunction(item)) {
        result= item(filename);
      } else {
        result= item[0].test(filename) && filename.replace(item[0], item[1]);
      }
    }
    return result;
  },

  getModuleFilename= function(pack, mid) {
    var result;
    if (pack) {
      result= catPath(pack.srcLocation, pack.srcLib) + "/" + mid;
    } else {
      result= bc.basePath + "/" + mid;
    }
    for (var i= 0; i<bc.pathsMapProg.length; i++) {
      if (bc.pathsMapProg[i][2].test(result)) {
        result= result.substring(bc.pathsMapProg[i][3]) + bc.pathsMapProg[i][1];
        break;
      }
    }

    result+= ".js";

    // submit the result to the urlMap transforms; the first one wins
    return (pack && mapUrl(result, pack.urlMap)) || mapUrl(result, bc.urlMap) || result;
  },

  computeMapProg= function(map) {
    // This routine takes a map target-prefix(string)-->replacement(string) into a vector 
    // of quads (target-prefix, replacement, regex-for-target-prefix, length-of-target-prefix)
    // 
    // The loader contains processes that map one string prefix to another. These
    // are encountered when applying the requirejs paths configuration and when mapping
    // package names. We can make the mapping and any replacement easier and faster by
    // replacing the map with a vector of quads and then using this structure in simple machine.
    var p, i, item, mapProg= [];
    for (p in map) mapProg.push([p, map[p]]);
    mapProg.sort(function(lhs, rhs) { return rhs[0].length - lhs[0].length; });
    for (i= 0; i<mapProg.length;) {
      item= mapProg[i++];
      item[2]= new RegExp("^" + item[0] + "(\/|$)");
      item[3]= item[0].length;
    }
    return mapProg;
  }, 

  runMapProg= function(targetMid, map) {
    // search for targetMid in map; return the map item if found; falsy otherwise
    for (var i= 0; i<map.length; i++) {
      if (map[i][2].test(targetMid)) {
        return map[i];
      }
    }
    return 0;
  },

  normalizeName= function(name, base) {
    // normalize name with respect to base iff name starts with a relative module name; return result
    // from bdLoad/require::getModule
    if (name.charAt(0)==".") {
      // find non-empty string, followed by "/", followed by non-empty string without "/" followed by end
      var match= base.match(/(.+)\/[^\/]+$/);
      if (match) {
        // base was m0/m1/../mn-1/mn; prefix name with m0/m1/../mn-1
        name= (match[1] + "/" + name).replace(/\/\.\//g, "/");
      } else if (name.substring(0, 2)=="./") {
        // base was a single name; stip off the "./"
        name= name.substring(2);
      } // else do nothing
      // optionally anything followed by a "/", followed by a non-empty string without "/", followed by "/../", followed by anything
      while ((match= name.match(/(.*\/)?[^\/]+\/\.\.\/(.*)/))) {
        name= match[1] + match[2];
      }
    }
    return name;
  },
  
  resolveModuleId= function(mid, referenceModule) {
    // finds the [pid, mid] of mid with respect to referenceModule
    // if mid gives a plugin, then returns the plugin [pid, mid] and the plugin target [pid, mid] as a pair
    referenceModule= referenceModule || {};
    var
      path= referenceModule && referenceModule.path,
      parts= normalizeName(mid, path).split("!"),
      targetMid= parts[0],
      pluginTargetMid= parts[1],
      targetPid= 0,
      mapProg= referenceModule.pack && referenceModule.pack.mapProg,
      mapItem= (mapProg && runMapProg(targetMid, mapProg)) || runMapProg(targetMid, bc.packageMapProg);
    if (mapItem) {
      // mid specified a module that's a member of a package; figure out the package id and module id
      targetPid= mapItem[1];
      targetMid= targetMid.substring(mapItem[3] + 1);
      if (!targetMid.length) {
        // this is the main module for a package
        targetMid= bc.jobs["**package*" + targetPid].srcMain;
      }
    }
    var result= (targetPid ? targetPid : "") + "*" + targetMid;
    return pluginTargetMid ? [result, resolveModuleId(pluginTargetMid, referenceModule)[0]] : [result];
  },

  readmodule= function(
    cb
  ) {
    bc.waiting++;
    var thisObject= this;
    fileUtils.read(this.srcFilename, function(err, text) {
      if (err) {
        cb(err);
        return;
      }
      try {
        thisObject.text= text;
        bc.jsResourceTextProc(thisObject);
        thisObject.tokens= parser.tokenize(thisObject.text);
        bc.jsResourceTokenProc(thisObject);
        thisObject.tree= parser.parse(thisObject.tokens);
        bc.jsResourceAstProc(thisObject);
        var deps= {};
        thisObject.deps.forEach(function(dep) {
          deps[dep]= deps[dep] || getModule(dep);
        });
        thisObject.deps= deps;
        cb(0);
      } catch (e) {
        cb(e);
      }
    });
  },

  globalOptimizeModule= function(
    cb
  ) {
  },

  getContent= function(
    text, 
    deleteList
  ) {
    // deleteList must be a vector of non-overlapping locations to delete from text
    if (!deleteList || !deleteList.length) {
      return text.join("\n");
    }
    var 
      sorted= deleteList.sort(function(lhs, rhs) { 
        if (lhs.startLine < rhs.startLine) {
          return -1;
        } else if (rhs.startLine < lhs.startLine) {
          return 1;
        } else if (lhs.startCol < rhs.startCol) {
          return -1;
        } else if (rhs.startCol < lhs.startCol) {
          return 1;
        } else {
          return 0;
        }
      }),
      dest= [],
      line, i= 0;
    sorted.forEach(function(item) {
      while (i<item.startLine) dest.push(text[i++]);
      if (item.startLine==item.endLine) {
        line= text[i++];
        dest.push(line.substring(0, item.startCol) + line.substring(item.endCol));
      } else {
        dest.push(text[i++].substring(0, item.startCol));
        while (i<item.endLine) i++;
        dest.push(text[i++].substring(item.endCol));
      }
    });
    while (i<text.length) dest.push(text[i++]);
    return dest.join("\n");
  },

  writeModule= function(
    cb
  ) {
    bc.waiting++;
    try {
      var 
        pack= this.pack,
        destFilename= pack.destLocation + "/" + pack.destLib + "/" + this.mid + ".js";
      fileUtils.write(destFilename, "//synthesized!\n" + moduleJob.getContent(this.text, this.deleteList), cb);
    } catch (e) {
      cb(e);
    }
  },

  getModule= function(cqn) {
    var module= bc.jobs[cqn];
    if (!module) {
      var
        split= cqn.split("*"),
        pid= split[0],
        mid= split[1];
      // some module encountered for the first time
      var pack= bc.jobs["**package*" + (pid ? pid : "*")];
      module= startModule(pack, getModuleFilename(pack, mid), mid);
      module.read(bc.globalOptimize);
    }
    return module;    
  },

  startModule= function(
    pack,
    filename,
    mid
  ) {
    var pid= pack.srcName;
    return (bc.jobs[pid + "*" + mid]= {
      pack:pack,
      mid: mid,
      path: pid + "/" + mid,
      srcFilename: filename,
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
    if (this.destLocation.indexOf(bc.destRootPath)) {
      // this package is going someplace *not* under the destRootPath tree
      dest= this.tempLocation= bc.destRootPath + "/" + "package_lib_" + this.destName;
    } else {
      dest= this.destLocation + "/" + this.destLib;
    }
    fileUtils.ensurePath(fileUtils.getFilepath(dest));
    bc.waiting++;
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

  start= function(
    cb
  ) {
    bc.waiting++;

    // fixup the global packageMap to map modules given without a reference module
    bc.packageMapProg= computeMapProg(bc.packageMap);

    // push in any paths and recompute the internal pathmap
    bc.pathsMapProg= computeMapProg(bc.paths);

    for (var p in bc.packages) {
      var pack= bc.jobs["**package*" + p]= bc.packages[p];
      pack.srcMapProg= computeMapProg(src.srcPackageMap);
      pack.destMapProg= computeMapProg(src.destPackageMap || src.srcPackageMap);
      pack.read= read;
      pack.globalOptimize= globalOptimize;
      pack.write= write;
  
      bc.waiting++;
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
          // list holds all .js filenames contained in the tree rooted at the package location
          // that don't have /nls/ in the path; these are the automatically "discovered" modules for
          // this package
          list= parser.split(list);

          // exclude discovered modules as per explicit pack.exclude vector
          pack.exclude.forEach(function(filter) {
            list= list.map(function(filename) {
              return (!filename || filter.test(filename)) ? 0 : filename;
            });
          });

          // include discovered modules iff the mid resolved to the same filename that discovered the mid
          var modules= {};
          list.forEach(function(filename) {
            if (filename) {
              // strip the package location path and the .js suffix...
              var mid= filename.substring(srcLength+1, name.length-3);
              if (getModuleFilename(pack, mid)==filename) {
                modules[mid]= filename;
              } // else, mid does not map to filename; therefore, it's not a module
            }
          });

          // further add modules as per explicit pack.modules vector
          pack.modules.forEach(function(mid) {
            modules[mid]= modules[mid] || getModuleFilename(pack, mid);
          });

          // add each module that survived the discovery algorithm as a job
          pack.modules= {};
          for (var mid in modules) {
            // this is an async callback and the module may have been added by other means
            pack.modules[mid]= pack.modules[mid] || startModule(pack, module[mid], mid); 
          }
        }
        cb(code);
      });
    }
    
    if (!bc.layers.main && (bc.main || bd.deps)) {
      bc.layers.main= {modules: bc.main ? [bc.main] : bc.deps};
    }

    // request all the layer modules
    for (var layerName in bc.layers) {
      var layer= bc.layers[layerName];
      layer.modules.forEach(function(mid) {
        var 
          match= mid.match(/(^[^\/]+\/(.+)$)/),
          pid= match && match[1],
          pack= pid && bc.packages[pid];
        if (pack) {
          mid= match[2],
          pack.modules[mid]= pack.modules[mid] || startModule(pack, getModuleFilename(pack, mid), mid);
        } else {
          pack= bc.packages["*"];
          pack.modules[mid]= pack.modules[mid] || startModule(pack, getModuleFilename(pack, mid), mid);
        } 
      });
    }
    cb(0);
  };

return {
  start:start,
  resolveModuleId:resolveModuleId
};
});
