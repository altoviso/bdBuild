define([], function() {
  var 
    fs= require("fs"),

    cleanupPath= function(path) {
      // change any falsy to ""
      path= path || "";

      // change all backslashes to forward slashes for this with bad habits from windows
      path= path.replace(/\\/g, "/");

      // remove any trailing "/" to be less sensitive to careless user input
      if (path.length && path.charAt(path.length-1)=="/") {
        path= path.substring(0, path.length-1);
      }
      return path;
    },

    isAbsolutePath= function(path) { 
      return path && path.length && path.charAt(0)=="/"; 
    }, 
    
    catPath= function(lhs, rhs) {
      if (!rhs.length) {
        return lhs;
      } else if (!lhs.length) {
        return rhs;
      } else {
        return lhs + "/" + rhs;
      }
    },

    read= function(
      filename, 
      cb
    ) {
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
    },

    getContent= function(
      resource
    ) {
      // resource.deleteList must be a vector of non-overlapping locations to delete from resource.text
      if (!resource.deleteList.length) {
        return resource.text.join("\n");
      }
      var 
        sorted= resource.deleteList.sort(function(lhs, rhs) { 
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
        src= resource.text.slice(0),
        dest= [],
        line, i= 0;
      sorted.forEach(function(item) {
        while (i<item.startLine) dest.push(src[i++]);
        if (item.startLine==item.endLine) {
          line= src[i++];
          dest.push(line.substring(0, item.startCol) + line.substring(item.endCol));
        } else {
          dest.push(src[i++].substring(0, item.startCol));
          while (i<item.endLine) i++;
          dest.push(src[i++].substring(item.endCol));
        }
      });
      return dest.join("\n");
    },    
 
    writeJsResource= function(
      resource,
      cb
    ) {
      fs.open(resource.destFilename, "w+", function(err, fd) {
        if (err) {
          console.log(err);
        } else {
          var 
            content= getContent(resource),
            buffer= new Buffer(content, "utf8"),
            length= Buffer.byteLength(content, "utf8");
          fs.write(fd, buffer, 0, length, null, function(err, fd) {
            fs.close(fd, function(err) {
              cb(err);
            });
          });
        }
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
          fs.mkdirSync(name, 7*64 + 7*8 + 4);
        } catch (e) {
          //squelch
        }
      }
    },

    prepareRootDestDirectory= function(
      path
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
        var 
          ts= new Date(),
          f= function(i) { return "-" + (i<10 ? "0" + i : i); },
          buDir= path + "/bdBuild-" + ts.getFullYear() + f(ts.getMonth()) + f(ts.getDay()) + f(ts.getHours()) + f(ts.getMinutes()) + f(ts.getSeconds()) + ".backup";
        fs.mkdirSync(buDir, 7*64 + 7*8 + 4);
        oldBackups.push(buDir);
        files.forEach(function(filename) {
          fs.renameSync(path + "/" + filename, buDir + "/" + filename);
        });
      }
      return oldBackups;
    };


  return {
    cleanupPath:cleanupPath,
    isAbsolutePath:isAbsolutePath,
    catPath:catPath,
    read:read,
    writeJsResource:writeJsResource,
    getContent:getContent,
    prepareRootDestDirectory:prepareRootDestDirectory
  };

});
