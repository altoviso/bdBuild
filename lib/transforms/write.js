define(["../buildControl", "../fileUtils", "fs", "../replace"], function(bc, fileUtils, fs, replace) {
  return function(resource, asyncReturn) {
    fileUtils.ensureDirectoryByFilename(resource.dest);
    fs.writeFile(resource.dest, resource.getText(), resource.encoding, function(err) {
      bc.returnFromAsyncProc(resource, err);
    });
    return asyncReturn;
  };
});

 