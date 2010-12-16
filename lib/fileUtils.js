define([], function() {
  var 
    fs= require("fs"),

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
          while (i<item.endLine) dest.push(src[i++]);
          dest.push(src[i++].substring(item.endCol));
        }
      });
      return dest.join("\n");
    },    
 
    write= function(
      resource,
      cb
    ) {
      fs.write(resource.destFilename, "w+", function(err, fd) {
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
      for (var components= path.split("/"), i= 0; i<components.length; i++) {
        fs.mkdirSync(components.slice(0, i+1).join("/"), 744);
      }
    };

  return {
    read:read,
    write:write,
    getContent:getContent
  };

});
