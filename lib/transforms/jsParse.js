define(["bdParse"], function(bdParse) {
  var 
    filterComments= bdParse.filterComments,
    parse= bdParse.parse;
  return function(resource, bc) {
    try {
      resource.tree= parse(filterComments(resource.tokens));
      return 0;
    } catch (e) {
      bc.logError("failed to tokenize");
      return e;
    }
  };
});
