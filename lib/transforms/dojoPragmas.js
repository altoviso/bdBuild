///
// \amd-mid bdBuild/lib/transforms/dojoPragmas
// 
// A transform to apply dojo pragmas.
// 
// The function is derived from https://github.com/dojo/util/blob/master/buildscripts/jslib/buildUtil.js.
// See https://github.com/dojo/util/blob/master/LICENSE for licensing.
define(["../buildControl"], function(bc) {
  var 
    dojoPragmaRe = /(exclude|include)Start\s*\(\s*["'](\w+)["']\s*,(.*)\)/,
    evalPragma= function(code, kwArgs, fileName) {
      return !!eval("(" + code + ")");
    };

  return function(resource) {
    var 
      foundIndex = -1,
      startIndex = 0,
      text= resource.text;
    while((foundIndex = text.indexOf("//>>", startIndex)) != -1){
      //Found a conditional. Get the conditional line.
      var lineEndIndex = text.indexOf("\n", foundIndex);
      if(lineEndIndex == -1){
        lineEndIndex = text.length - 1;
      }
  
      //Increment startIndex past the line so the next conditional search can be done.
      startIndex = lineEndIndex + 1;
  
      //Break apart the conditional.
      var conditionLine = text.substring(foundIndex, lineEndIndex + 1);
      var matches = conditionLine.match(dojoPragmaRe);
      if(matches){
        var type = matches[1];
        var marker = matches[2];
        var condition = matches[3];
        var isTrue = false;
        //See if the condition is true.
        try{
          isTrue = evalPragma(condition, bc.dojoPragmaKwArgs, resource.src);
        }catch(e){
          return "error while applying dojo pragma (" + conditionLine + ")\n" + e + "\n";
        }
      
        //Find the endpoint marker.
        var endRegExp = new RegExp('\\/\\/\\>\\>\\s*' + type + 'End\\(\\s*[\'"]' + marker + '[\'"]\\s*\\)', "g");
        var endMatches = endRegExp.exec(text.substring(startIndex, text.length));
        if(endMatches){
          
          var endMarkerIndex = startIndex + endRegExp.lastIndex - endMatches[0].length;
          
          //Find the next line return based on the match position.
          lineEndIndex = text.indexOf("\n", endMarkerIndex);
          if(lineEndIndex == -1){
            lineEndIndex = text.length - 1;
          }
  
          //Should we include the segment?
          var shouldInclude = ((type == "exclude" && !isTrue) || (type == "include" && isTrue));
          
          //Remove the conditional comments, and optionally remove the content inside
          //the conditional comments.
          var startLength = startIndex - foundIndex;
          text = text.substring(0, foundIndex)
            + (shouldInclude ? text.substring(startIndex, endMarkerIndex) : "")
            + text.substring(lineEndIndex + 1, text.length);
          
          //Move startIndex to foundIndex, since that is the new position in the file
          //where we need to look for more conditionals in the next while loop pass.
          startIndex = foundIndex;
        }else{
          return "cannot find end marker while applying dojo pragma (" + conditionLine + ")";
        }
      }
    }
    resource.text= text;
    return 0;
  };
});
