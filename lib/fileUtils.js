define(["fs"], function(fs) {
  var 
    getFilename= function(filename) {
      if (/\//.test(filename)) {
        return filename.match(/^.*\/([^\/]+)$/)[1];
      }
      return filename;
    },

    getFilepath= function(filename) {
      if (/\//.test(filename)) {
        var result= filename.match(/^(.*)\/[^\/]+$/)[1];
        // if result=="", then must have been something like "/someFile"
        return result.length ? result : "/";
      }
      return "";
    },

    getFiletype= function(filename, trimDot) {
      var match= filename.match(/(\.([^\/]*))$/);
      return (match && (trimDot ? match[2] : match[1])) || "";
    },

    cleanupPath= function(path) {
      // change any falsy to ""
      path= path || "";

      // change all backslashes to forward slashes for those with bad habits from windows
      path= path.replace(/\\/g, "/");

      // remove any trailing "/" to be less sensitive to careless user input
      // but remember "/" is not a trailing slash--it's the root 
      if (path.length>1 && path.charAt(path.length-1)=="/") {
        path= path.substring(0, path.length-1);
      }
      return path;
    },

    catPath= function(lhs, rhs) {
      if (arguments.length>2) {
        for (var args= [], i= 1; i<arguments.length; args.push(arguments[i++]));
        return catPath(lhs, catPath.apply(this, args));
      } else if (!rhs || !rhs.length) {
        return lhs;
      } else if (!lhs || !lhs.length) {
        return rhs;
      } else {
        return (lhs + "/" + rhs).replace(/\/\/\/?/, "/");
      }
    },

    compactPath= function(path) {
      while(/\/\.\//.test(path)) path= path.replace(/\/\.\//, "/");
      path= path.replace(/(.*)\/\.$/, "$1");
      while(/[^\/]+\/\.\./.test(path)) path= path.replace(/[^\/]+\/\.\.\/?/, "");
      return path.charAt(path.length-1)=="/" ? path.substring(0, path.length-1) : path;
    },

    isAbsolutePath= function(path) { 
      return path && path.length && path.charAt(0)=="/"; 
    }, 
    
    getAbsolutePath= function(src, base) {
      src= cleanupPath(src);
      if (src.charAt(0)!="/") {
        src= catPath(base, src);
      }
      return compactPath(src);
    },

    getTimestamp= function(ts) {
      var f= function(i) { return "-" + (i<10 ? "0" + i : i); };
      return ts.getFullYear() + f(ts.getMonth()+1) + f(ts.getDate()) + f(ts.getHours()) + f(ts.getMinutes()) + f(ts.getSeconds());
    },

    getMode= function(octal) {
      for (var result= 0, i= 0; i<octal.length; result= (result * 8) + octal.charCodeAt(i++) - 48);
      return result;
    },

    dirExists= function(
      filename
    ) {
      try {
        return fs.statSync(filename).isDirectory();
      } catch(e) {
        return false;
      }
    },

    checkedDirectories= {},

    clearCheckedDirectoriesCache= function() {
      checkedDirectories= {}; 
    },

    ensureDirectory= function(path) {
      if (!checkedDirectories[path]) {
        if (!dirExists(path)) {
          ensureDirectory(getFilepath(path));
          try {

            fs.mkdirSync(path, getMode("774"));
          } catch (e) {
            //squelch
          }
        }
        checkedDirectories[path]= 1;
      }
    },
        
    ensureDirectoryByFilename= function(filename) {
      ensureDirectory(getFilepath(filename));
    };

  return {
    getFilename:getFilename,
    getFilepath:getFilepath,
    getFiletype:getFiletype,
    cleanupPath:cleanupPath,
    isAbsolutePath:isAbsolutePath,
    getAbsolutePath:getAbsolutePath,
    catPath:catPath,
    compactPath:compactPath,
    getMode:getMode,
    getTimestamp:getTimestamp,
    dirExists:dirExists,
    ensureDirectory:ensureDirectory,
    ensureDirectoryByFilename:ensureDirectoryByFilename,
    clearCheckedDirectoriesCache:clearCheckedDirectoriesCache
  };
});
