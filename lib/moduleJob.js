///
// \module bdBuild/moduleJob
//
define(["./fileUtils", "bdParse"], function(fileUtils, bdParse) {
var
  getContent= function(
    text, 
    deleteList
  ) {
    // deleteList must be a vector of non-overlapping locations to delete from text
    if (!deleteList.length) {
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
    return dest.join("\n");
  },

  read= function(
    cb
  ) {  
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
  };

return {
  getContent:getContent,
  start:start
};
  
});
