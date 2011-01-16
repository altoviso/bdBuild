// this is a naive has implementation to use when you don't have/want the real has.js
(function() {
  var has= function(name) { 
    return has.hasMap[name]; 
  };
  has.hasMap= {};
  return has;
})()
