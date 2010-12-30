define(["bdParse"], function(bdParse) {
  return function(resource) {
    resource.text= bdParse.split(resource.text);
  };
});