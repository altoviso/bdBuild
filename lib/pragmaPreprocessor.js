define(["bdParse"], function(bdParse) {
var 
  tComment= bdParse.symbols["tComment"],

  makeDojoPragmaMachine= function(kwargs) {
    ///
    // Creates a pragma machine that processes the dojo build pragmas
    ///
    // The dojo build pragmas consist of the following four functions:
    // 
    //   * includeStart(tag, expr)
    //   * includeEnd(tag)
    //   * excludeStart(tag, expr)
    //   * exclustEnd(tag)
    // 
    // Where tag is a string and expr is an evaluable expression that's intended to be
    // evaluated with the dojo build object `kwArgs in scope.

    var
      include= {},
      exclude= {},
      start= {},
      end= {},
      includeStart= function(tag, expr) {
        return expr ? [include, start, tag] : 0;
      },
      includeEnd= function(tag) {
        return [include, end, tag];
      },
      excludeStart= function(tag, expr) {
        return expr ? [exclude, start, tag] : 0;
      },
      excludeEnd= function(tag) {
        return [exclude, end, tag];
      };
    return function (lineNumber, lineText, filteredTokens, resourceControl) {
      function evalPragma(pragmaText) {
        try {
          return eval(pragmaText);
        } catch (e) {
          throw new Error("(" + resourceControl.filename + ":" + i + ")Failed to evaluate dojo build pragma.\n" + e.message);
        }
      };

      if (/\/\/>>/.test(lineText)) {
        //do something
      }
      return 0;
    };
  },

  processor= function(resourceControl, pragmaMachine) {
    var
      tokens= resourceControl.tokens,
      i= 0, end= tokens.length, 
      filteredTokens= [], 
      result, token;
    while (i<end) {
      token= tokens[i];
      if (tokens.type===tComment && (result= pragmaMachine(i, token.value, filteredTokens, resourceControl))) {
        i= result;
      } else {
        i++;
        filteredTokens.push(token);
      }
    }
    resourceControl.tokens= filteredTokens;
  },

  makePreprocessor= function(pragmaMachine) {
    return function(resourceControl) {
      processor(resourceControl, pragmaMachine);
    };
  };

  return {
    makeDojoPragmaMachine:makeDojoPragmaMachine,
    processor:processor,
    makePreprocessor:makePreprocessor
  };

});
