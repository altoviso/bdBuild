define(["bdParse"], function(bdParse) {
  var
    split= bdParse.split,
    tokenize= bdParse.tokenize;
  return function(resource, bc) {
    try {
      resource.deleteList= [];
      resource.getResultText= function() {
        return bdParse.deleteText(resource.text, resource.deleteList).join("\n");
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
