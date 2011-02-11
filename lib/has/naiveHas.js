// this is a naive has.js implementation intended for the loaders internal use only
// this is typically used for projects that want has.js control completely separate from the loader
(function() {
  var
    cache= {
      // cache-start
      "dom-addEventListener":!!document.addEventListener
      // cache-end
    };
    return function(name) {
      return cache[name];
    };
})()
