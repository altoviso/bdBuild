define(["fs", "bdBuild/configStringify", "text!bdBuild/has/bdLoadHas.js"], function(fs, stringify, hasText) {
  return function(bc) {
    var hasMap= "has.hasMap= {};";
    if (bc.hasMap) {
      if (typeof bc.hasMap=="string") {
        hasMap= fs.readFileSync(bc.hasMap, "utf8");
      } else {
        var text= stringify(bc.hasMap);
        if (text.unsolved) {
          bc.logWarn("The has map contains unsolved values. This may or may not be an error.");
        }
        hasMap= text.result;
      }
    }
    return hasText.replace(/has\.hasMap=\s\{\}\;/, "has.hasMap= \n" + hasMap + ";\n");
   };
});