define(["../buildControl", "../fileUtils", "fs", "../replace"], function(bc, fileUtils, fs, replace) {
  var
    getFiletype= fileUtils.getFiletype,

    encodingMap= 
      // map from file type to encoding
      (bc.transformConfig.read && bc.transformConfig.read.encoding) || {
        css:"utf8",
        html:"utf8",
        htm:"utf8",
        js:"utf8",
        json:"utf8",
        asc:"utf8",
        c:"utf8",
        cpp:"utf8",
        log:"utf8",
        conf:"utf8",
        text:"utf8",
        txt:"utf8",
        dtd:"utf8",
        xml:"utf8"
      };
    
  return function(resource, asyncReturn) {
    var
      params= [resource.src],
      encoding= encodingMap[getFiletype(resource.src, 1)];
    if (encoding) {
      resource.encoding= encoding;
      params.push(encoding);
    }
    params.push(function(err, data) {
      if (!err) {
        resource.text= data;
      }
      bc.returnFromAsyncProc(resource, err);
    });
    resource.getText= function() {
      if (!this.replacementsApplied) {
        this.replacementsApplied= true;
        if (bc.replacements[this.src]) {
          this.text= replace(this.text, bc.replacements[this.src]);
        }
      }
      return this.text;
    };
    fs.readFile.apply(fs, params);
    return asyncReturn;
  };
});

