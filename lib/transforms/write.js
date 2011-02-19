define(["../fileUtils", "fs"], function(fileUtils, fs) {
  return function(resource, bc, asyncReturn) {
    fileUtils.ensureDirectoryByFilename(resource.dest);
    fs.writeFile(resource.dest, resource.getResultText && resource.getResultText() || resource.text, resource.encoding, function(err) {
      bc.returnFromAsyncProc(resource, err);
    });
    return asyncReturn;
  };
});

 