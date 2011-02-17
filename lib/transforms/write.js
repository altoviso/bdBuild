define(["../fileUtils", "fs"], function(fileUtils, fs) {
  return function(resource, bc, asyncReturn) {
    fileUtils.ensureDirectoryByFilename(resource.destFilename);
    fs.writeFile(resource.destFilename, resource.text, "utf8", function(err) {
      bc.returnFromAsyncProc(err);
    });
    return asyncReturn;
  };
});
