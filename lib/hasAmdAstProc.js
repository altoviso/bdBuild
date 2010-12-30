define(["bdBuild/hasAstProc", "bdBuild/amdAstProc"], function(hasProcessor, amdProcessor) {
  return function(resource) {
    hasProcessor(resource);
    amdProcessor(resource);
  };
});
