define(["fs"], function(fs) {
  return function(resource, bc, asyncReturn) {
    fs.readFile(resource.src, "utf8", function(err, data) {
      if (!err) {
        resource.text= data;
      }
      bc.returnFromAsyncProc(resource, err);
    });
    return asyncReturn;
  };
});
