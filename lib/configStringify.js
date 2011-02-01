///
// \module bdBuild/configStringify
//
define(["bdParse"], function(bdParse) {
var
  spaces= "          ",
  indentFactor= 2,

  setIndentFactor= function(factor) {
    indentFactor= factor;
  },

  indent= function(n) {
    n= n * indentFactor;
    while (spaces.length<n) spaces+= spaces;
    return spaces.substring(0, n);
  },

  propName= function(name) {
    return /^[\w\$]+$/.test(name) ?
      name + ":" :
      "'" + name + "':";
  },

  text,
  unsolved,

  configStringify= function(it, level) {
    if (!level) {
      text= "";
      unsolved= false;
      level= 1;
    } else {
      level++;
    }
    var temp, space, p, i;
    switch (typeof it) {
      case "undefined": 
        text+= "undefined";
        break;

      case "boolean": 
        text+= (it ? "true" : "false");
        break;

      case "number": 
        text+= it.toString();
        break;

      case "string": 
        text+= JSON.stringify(it);
        break;

      case "object":
        if (it===null) {
          text+= "null";
        } else if (it instanceof RegExp) {
          text+= RegExp.toString();
        } else if (it instanceof Array) {
          if (it.length>1) {
            text+= "[\n";
            for (i= 0; i<it.length-1; i++) {
              text+= indent(level);
              configStringify(it[i], level);
              text+= ",\n";
            }
            text+= indent(level);
            configStringify(it[i], level);
            text+= "\n" + indent(level-1) + "]";
          } else if (it.length) {
            text+= "[";
            configStringify(it[0], level);
            text+= "]";
          } else {
            text+= "[]";
          }
        } else {
          temp= [];
          for (p in it) temp.push(p);
          if (temp.length>1) {
            text+= "{\n";
            for (i= 0; i<temp.length-1; i++) {
              text+= indent(level) + propName(temp[i]);
              configStringify(it[temp[i]], level);
              text+= ",\n";
            }
            text+= indent(level) + propName(temp[i]);
            configStringify(it[temp[i]], level);
            text+= "\n";
            text+= indent(level-1) + "}";
          } else if (temp.length) {
            text+= "{" + propName(temp[0]);
            configStringify(it[temp[0]], level);
            text+= "}";
          } else {
            text+= "{}";
          }
        }
        break;

      case "function":
        space= indent(level);
        text+= "\n" + bdParse.split(it.toString()).map(function(line) { return space + line; }).join("\n");
        break;

      default:
        text+= "undefined /* unsolved */";
        unsolved= true;
    }
    return {result: text, unsolved:unsolved};
  };

configStringify.setIndentFactor= setIndentFactor;
return configStringify;
  
});
