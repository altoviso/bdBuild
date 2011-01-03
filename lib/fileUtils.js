define(["fs"], function(fs) {
  var 
    getFilename= function(filename) {
      if (/\//.test(filename)) {
        return filename.match(/^.+\/([^\/]+)$/)[1];
      }
      return filename;
    },

    getFilepath= function(filename) {
      if (/\//.test(filename)) {
        return filename.match(/^(.+)\/[^\/]+$/)[1];
      }
      return "";
    },

    cleanupPath= function(path) {
      // change any falsy to ""
      path= path || "";

      // change all backslashes to forward slashes for those with bad habits from windows
      path= path.replace(/\\/g, "/");

      // remove any trailing "/" to be less sensitive to careless user input
      if (path.length && path.charAt(path.length-1)=="/") {
        path= path.substring(0, path.length-1);
      }
      return path;
    },

    compactPath= function(path) {
      // a/./b => a/b
      path= path.replace(/\/\.\//g, "/");
      // a/. => a
      path= path.replace(/\/\.$/g, "");
      var match;
      // optionally anything followed by a "/", followed by a non-empty string without "/" or ".", followed by "/../", followed by anything
      // e.g. a/b/../c => a/b; a/../b => a
      while ((match= path.match(/^(.*)\/[^\/\.]+\/\.\.\/(.*)$/))) {
        path= match[1] + "/" +  match[2];
      }
      // a/b/.. => a
      while ((match= path.match(/^(.*)\/[^\/\.]+\/\.\.$/))) {
        path= match[1];
      }
      return path;
    },

    isAbsolutePath= function(path) { 
      return path && path.length && path.charAt(0)=="/"; 
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
        return (lhs + "/" + rhs).replace(/\/\//g, "/");
      }
    },

    getTimestamp= function(ts) {
      var f= function(i) { return "-" + (i<10 ? "0" + i : i); };
      return ts.getFullYear() + f(ts.getMonth()+1) + f(ts.getDate()) + f(ts.getHours()) + f(ts.getMinutes()) + f(ts.getSeconds());
    },

    getMode= function(octal) {
      for (var result= 0, i= 0; i<octal.length; result= (result * 8) + octal.charCodeAt(i++) - 48);
      return result;
    },

    read= function(
      filename, 
      cb
    ) {
      if (!cb) {
        return fs.readFileSync(filename, "utf8");
      }
      fs.stat(filename, function(err, stats) {
        if (err) {
          cb(err);
          return;
        }
        var buffer= new Buffer(stats.size);
        fs.open(filename, "r", function(err, fd) {
          if (err) {
            cb(err);
            return;
           }
           fs.read(fd, buffer, 0, stats.size, 0, function(err, total) {
             if (err || total!=stats.size) {
               cb(err);
               return;
             }
             cb(0, buffer.toString('utf8', 0, stats.size));
           });
         });
      });
      return 0;
    },

    write= function(
      filename,
      contents,
      cb
    ) {
      fs.open(filename, "w+", function(err, fd) {
        if (err) {
          cb(err);
        }
        var 
          buffer= new Buffer(contents, "utf8"),
          length= Buffer.byteLength(contents, "utf8");
        fs.write(fd, buffer, 0, length, null, function(err) {
          if (err) {
            cb(err);
          }
          fs.close(fd, function(err) {
            cb(err);
          });
        });
      });
    },
 
    ensurePath= function(
      path
    ) {
      var 
        components= path.split("/"),
        name= "";
      if (components.length && !components[0].length) {
        components.shift();
      }
      while (components.length) {
        name+= "/" + components.shift();
        try {
          fs.mkdirSync(name, getMode("774"));
        } catch (e) {
          //squelch
        }
      }
    },

    prepareDestDirectory= function(
      path,
      backupPath
    ) {
      var
        files= [],
        oldBackups= [];
      ensurePath(path);
      fs.readdirSync(path).forEach(function(filename) {
        if (/^bdBuild\-\d\d\d\d\-\d\d\-\d\d\-\d\d\-\d\d\-\d\d\.backup$/.test(filename)) {
          oldBackups.push(path + "/" + filename);
        } else if (filename!="." && filename!="..") {
          files.push(filename);
        }
      });      
      if (files.length) {
        //backup the current files
        fs.mkdirSync(backupPath, getMode("774"));
        oldBackups.push(backupPath);
        files.forEach(function(filename) {
          fs.renameSync(path + "/" + filename, backupPath + "/" + filename);
        });
      }
      return oldBackups;
    };

  return {
    getFilename:getFilename,
    getFilepath:getFilepath,
    cleanupPath:cleanupPath,
    compactPath:compactPath,
    isAbsolutePath:isAbsolutePath,
    catPath:catPath,
    getTimestamp:getTimestamp,
    read:read,
    write:write,
    ensurePath:ensurePath,
    prepareDestDirectory:prepareDestDirectory
  };
});
