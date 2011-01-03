///
// \module bdBuild/packageJob
//
define(["child_process", "bdBuild/fileUtils", "bdBuild/buildControl", "bdParse"], function(child_process, fileUtils, bc, bdParse) {
var
  spawn= child_process.spawn,

  catPath= fileUtils.catPath,

  isFunction= function(it) {
    return (typeof it=="function");
  },
    
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
    var filename= (pack.srcName ? (pack.srcName + "/") : "") + mid;

    for (var i= 0; i<bc.pathsMapProg.length; i++) {
      if (bc.pathsMapProg[i][2].test(filename)) {
        filename= filename.substring(bc.pathsMapProg[i][3]) + bc.pathsMapProg[i][1];
        break;
      }
    }
    if (i==bc.pathsMapProg.length) {
      // did not map the path above; therefore...
      // submit the url to the urlMap transforms; the first one wins
      filename= (pack && mapUrl(filename, pack.urlMap)) || mapUrl(filename, bc.urlMap);

      // no winner? Then its a module in a standard location...
      filename= filename || (pack ? catPath(pack.srcLocation, pack.srcLib) + "/" : "") + mid;
    }

    // if result is not absolute, add baseUrl
    if (!(/^\//.test(filename))) {
      filename= bc.basePath + "/" + filename;
    }

    // add the extension if required
    // TODOC: notice that this algorithm insists on a url having an extension
    filename+= /\.[^\/]+$/.test(filename) ? "" : ".js";

    return filename;
  },

  escapeRegEx= function(s) {
    return s.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, function(c) {
      return "\\" + c;
    });
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
      item[2]= new RegExp("^" + escapeRegEx(item[0]) + "(\/|$)");
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
    if (/dijit\*ContentPane/.test(targetPid)) {
      console.log("error:");
      console.log(mid);
      console.log(referenceModule);
    }
    return ((targetPid ? targetPid : "") + "*" + targetMid) + (pluginTargetMid ? ("!" + resolveModuleId(pluginTargetMid, referenceModule)) : "");
  },

  logModuleError= function(module, error, phase) {
    delete module.text;
    delete module.tokens;
    delete module.tree;
    module.error= error;
    console.log("failed to " + phase + " module");
    console.log("package: " + (module.pack.srcName || "<<default>>"));
    console.log("module: " + module.mid);
    console.log("filename: " + module.srcFilename);
    console.log("error: " + error);
  },

  readModule= function(
    cb
  ) {
    bc.waiting++;
    var thisObject= this;
    fileUtils.read(this.srcFilename, function(err, text) {
      if (!err) {
        try {
          thisObject.text= text;
          bc.jsResourceTextProc(thisObject);
          thisObject.tokens= bdParse.tokenize(thisObject.text);
          bc.jsResourceTokenProc(thisObject);
          thisObject.tree= bdParse.parse(thisObject.tokens);
          bc.jsResourceAstProc(thisObject);
          var deps= {};
          thisObject.deps.forEach(function(dep) {
            var 
              parts= dep.split("!"),
              pluginTarget= parts[1];
            dep= parts[0];
            deps[dep]= deps[dep] || getModule(dep);
            // TODO pluginTarget handling
          });
          thisObject.deps= deps;
        } catch (e) {
          err= e;
        }
      }
      if (err) {
        logModuleError(thisObject, err, "read");
      }
      cb(0);
    });
  },

  globalOptimizeModule= function(
    cb
  ) {
  },

  writeModule= function(
    cb
  ) {
    if (!this.error) {
      console.log(this.srcFilename + " depends on: ");
      for (var p in this.deps) {
        console.log("     " + this.deps[p].srcFilename);
      };
      bc.waiting++;
      var 
        pack= this.pack,
        destFilename= catPath(pack.destLocation, pack.destLib) + "/" + this.mid + ".js";
      fileUtils.write(destFilename, "//synthesized!\n" + bdParse.deleteText(this.text, this.deleteList).join("\n"), function(err) {
        if (err) {
          logModuleError(thisObject, err, "write");
        }
        cb(0);
      });
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
      path: catPath(pid, mid),
      srcFilename: filename,
      read:readModule,
      globalOptimize:globalOptimizeModule,
      write:writeModule
    });
  },

  read= function(
    cb
  ) {
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

  startPackage= function(
    pack,
    cb
  ) {
    pack.srcMapProg= computeMapProg(pack.srcPackageMap);
    pack.destMapProg= computeMapProg(pack.destPackageMap || pack.srcPackageMap);
    pack.read= read;
    pack.globalOptimize= globalOptimize;
    pack.write= write;
return;
    bc.waiting++;
    var 
      src= catPath(pack.srcLocation, pack.srcLib),
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
        list= bdParse .split(list);

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
            var mid= filename.substring(srcLength+1, filename.length-3);
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
          pack.modules[mid]= pack.modules[mid] || startModule(pack, modules[mid], mid); 
        }
      }
      cb(code);
    });
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
      startPackage((bc.jobs["**package*" + p]= bc.packages[p]), cb);
    }
    
    if (!bc.layers.main && (bc.main || bc.deps)) {
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
