///
// \module bdBuild/loaderJob
//
define(["./fileUtils", "./buildControl", "bdParse"], function(fileUtils, buildControl, bdParse) {
var
  read= function(
    cb
  ) {  
    buildControl.waiting++;
    var thisObject= this;
    fileUtils.read(this.srcFilename, function(err, text) {
      if (err) {
        cb(err);
        return;
      }
      try {
        thisObject.text= text;
        buildControl.jsResourceTextProc(thisObject);
        thisObject.tokens= bdParse.tokenize(thisObject.text);
        buildControl.jsResourceTokenProc(thisObject);
        thisObject.tree= bdParse.parse(thisObject.tokens);
        buildControl.jsResourceAstProc(thisObject);
        cb(0);
      } catch (e) {
        cb(e);
      }
    });
  },


  globalOptimize= function(
    cb
  ) {
  },

  write= function(
    cb
  ) {
    buildControl.waiting++;
    try {
      fileUtils.write(this.destFilename, bdParse.deleteText(this.text, this.deleteList).join("\n"), cb);
    } catch (e) {
      cb(e);
    }
  },

  start= function(
    cb
  ) {
    if (!buildControl.srcLoader) {
      return;
    }
    buildControl.jobs["**loader"]= {
      packageName: "",
      moduleName: "*loader",
      srcFilename: buildControl.srcLoader,
      destFilename: buildControl.destLoader,
      read:read,
      globalOptimize:globalOptimize,
      write:write
    };
  };

return {
  start:start
};
  
});
