///
// \module bdBuild/compactCssJob
//
define(["child_process", "fs", "loader", "bdBuild/fileUtils", "bdBuild/buildControl", "bdParse"], function(child_process, fs, loader, fileUtils, bc, bdParse) {
  var
    exec= child_process.exec,

    catPath= fileUtils.catPath,
    getFilepath= fileUtils.getFilepath,
    getFiletype= fileUtils.getFiletype,
    compactPath= fileUtils.compactPath,

    destPath= 0,
    externUid= 0,
    externs= {},
    getSyntheticFilename= function(url) {
      if (externs[url]) {
        return externs[url];
      }
      return (externs[url]= "_" + (++externUid) + getFiletype(url));
    },

    readCss= function(filename) {
      // read file filename, strip comments, split into lines, trim ws, return result
      var 
        content= fs.readFileSync(filename, "utf8"),
        result= "",
        commentStart, commentEnd;
      while (content.length) {
        commentStart= content.indexOf("/*");
        if (commentStart!=-1) {
          commentEnd= content.indexOf("*/", commentStart+2);
          if (commentEnd!=-1) {
            result+= content.substring(0, commentStart);
            content= content.substring(commentEnd+2);
          } else {
            bc.logWarn("comment unclosed in " + filename);
            return [];
          }
        } else {
          result+= content;
          break;
        }
      }
      return bdParse.split(result).map(function(line){return line.trim();});
      
    },

    compressCss= function(root, filename) {
      var result= "";
      if (filename.charAt(0)!="/") {
        filename= catPath(root, filename);
      }
      filename= compactPath(filename);
      var path= getFilepath(filename);
      readCss(filename).forEach(function(line) {
        var urlMatch= line.match(/(.*?)url\(\s*('|")?([^'"\:]+)('|")?\s*\)(.*)/);
                      //          1            2     3         4          5
        if (urlMatch) {
          var url= urlMatch[3];
          if (/^\s*@import\s*url/.test(line)) {
            result+= compressCss(path, url);
          } else {
            if (url.charAt(0)!="/") {
              url= compactPath(catPath(path, url));
            }
            result+= urlMatch[1] + "url(" + getSyntheticFilename(url) + ")" + urlMatch[5] + "\n";
          }
        } else {
          result+= line + "\n";
        }
      });
      return result;
    },

    dumpExterns= function() {
      for (var srcFilename in externs) {
        bc.waiting++;
        exec("cp " + srcFilename + " " + destPath + "/" + externs[srcFilename], function(error, stdout, stderr) {
          if (error) {
            //TODO report the error
          }
          bc.cb(0);
        });
      }
      externUid= 0;
      externs= {};
    },

    write= function(
      cb
    ) {
      //bc.cssCompactList is a vector of pairs (destFilename, vector of srcFilename}
      bc.cssCompactList.forEach(function(item) {
        var 
          result= "",
          destFilename= item[0],
          path= getFilepath(bc.sandbox + destFilename);
        if (path!=destPath) {
          dumpExterns();
          destPath= path;
        }
        item[1].forEach(function(srcFilename) {
          result+= compressCss("", srcFilename);
        });
        fs.writeFileSync(bc.sandbox + "/" + destFilename, result, "utf8");
      });
      dumpExterns();
    },

    start= function() {
      bc.cssCompactList.forEach(function(item) {
        bc.destDirs.push(getFilepath(item[0]));
      });
      bc.jobs["**compactCss"]= {
        write:write
      };
    };

  return {
    start:start
  };
  
});
