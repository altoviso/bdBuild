define(["./has", "./amd"], function(hasProcessor, amdProcessor) {
  return function(resource) {
    hasProcessor(resource);
    amdProcessor(resource);
  };
});
