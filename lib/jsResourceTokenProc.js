define(["bdParse"], function(bdParse) {
  return function(resource) {
    resource.tokens= bdParse.filterComments(resource.tokens);
  };
});