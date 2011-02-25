define(["../buildControl", "bdParse"], function(bc, bdParse) {
  var 
    filterComments= bdParse.filterComments,
    parse= bdParse.parse;
  return function(resource) {
    try {
      resource.tree= parse(filterComments(resource.tokens));
      return 0;
    } catch (e) {
      bc.logError("failed to tokenize");
      return e;
    }
  };
});
