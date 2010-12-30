var rawldTime= 0;
define(["bdBuild/hasAstProc", "bdBuild/amdAstProc"], function(hasProcessor, amdProcessor) {
  return function(resource) {
    var now= (new Date()).getTime();
    hasProcessor(resource);
    amdProcessor(resource);
    rawldTime+= (new Date()).getTime() - now;
  };
});
