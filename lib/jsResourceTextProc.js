define(["bdParse"], function(parser) {
  return function(resource) {
    resource.text= parser.split(resource.text);
  };
});