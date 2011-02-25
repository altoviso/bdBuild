define(["../buildControl", "bdParse"], function(bc, bdParse) {
  var
    split= bdParse.split,
    tokenize= bdParse.tokenize;
  return function(resource) {
    try {
      resource.deleteList= [];
      resource.getText= function() {
        if (this.deleteList) {
          this.text= bdParse.deleteText(this.text, this.deleteList).join("\n");
          delete this.deleteList;
          if (bc.replacements[this.src]) {
            this.text= replace(this.text, bc.replacements[this.src]);
          }
        }
        return this.text;
      };
      resource.text= split(resource.text);
      resource.tokens= tokenize(resource.text);
      return 0;
    } catch (e) {
      bc.logError("failed to tokenize");
      return e;
    }
  };
});
