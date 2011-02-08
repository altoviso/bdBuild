// this is a default, standard has implementation to use when you don't have/want the real has.js
(function() {
  // if has is not provided, define a standard implementation
  // this implementation adopted from https://github.com/phiggins42/has.js
  var
    global= this,
    doc= document,
    element= doc.createElement("div"),
    cache= {
      "dom-addEventListener":!!doc.addEventListener
    },
    has= function(name) {
      if (typeof cache[name] == "function") {
        cache[name]= cache[name](global, doc, element);
      }
      return cache[name];
    };
    has.cache= cache;
    has.add= function(name, test, now) {
      cache[name]= now ? test(global, doc, element) : test;
    };
    return has;
})()
