define(["bdParse"], function(parser) {
  return function(resource) {
    resource.tokens= parser.filterComments(resource.tokens);
  };
});