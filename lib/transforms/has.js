define(["../buildControl", "bdParse"], function(bc, bdParse) {
  ///
  // \module bdBuild/transforms/has
  //

bc.hasLocations= {};

var 
  symbols= bdParse.symbols,

  asnComment= symbols["asnComment"],
  asnLabel= symbols["asnLabel"],
  asnBlock= symbols["asnBlock"],
  asnSwitch= symbols["asnSwitch"],
  asnCase= symbols["asnCase"],
  asnDefault= symbols["asnDefault"],
  asnDebugger= symbols["asnDebugger"],
  asnDo= symbols["asnDo"],
  asnReturn= symbols["asnReturn"],
  asnThrow= symbols["asnThrow"],
  asnVar= symbols["asnVar"],
  asnWhile= symbols["asnWhile"],
  asnWith= symbols["asnWith"],
  asnStatement= symbols["asnStatement"],
  asnBreak= symbols["asnBreak"],
  asnContinue= symbols["asnContinue"],
  asnForIn= symbols["asnForIn"],
  asnFor= symbols["asnFor"],
  asnFunctionDef= symbols["asnFunctionDef"],
  asnFunctionLiteral= symbols["asnFunctionLiteral"],
  asnIf= symbols["asnIf"],
  asnConditional= symbols["asnConditional"],
  asnTry= symbols["asnTry"],
  asnExprList= symbols["asnExprList"],
  asnNew= symbols["asnNew"],
  asnUnaryPrefix= symbols["asnUnaryPrefix"],
  asnUnaryPostfix= symbols["asnUnaryPostfix"],
  asnBinaryOp= symbols["asnBinaryOp"],
  asnArray= symbols["asnArray"],
  asnObject= symbols["asnObject"],
  asnName= symbols["asnName"],
  asnNumber= symbols["asnNumber"],
  asnString= symbols["asnString"],
  asnRegEx= symbols["asnRegEx"],
  asnAtom= symbols["asnAtom"],
  asnRoot= symbols["asnRoot"],

  location= bdParse.location,

  blanks= "          ",

  getBlanks= function(length) {
    while (blanks.length<length) blanks+= blanks;
    return blanks.substring(0, length);
  },

  evalHasExpr= function(location) {
    var
      sLine= location.startLine,
      sCol= location.startCol,
      eLine= location.endLine,
      eCol= location.endCol,
      code;
    if (sLine==eLine) {
      code= text[sLine].substring(sCol, eCol);
    } else {
      code= text[sLine].substring(sCol);
    }
    for (var i= sLine+1; i<eLine; i++) {
      code+= "\n" + text[i];
    };
    if (eLine>sLine) {
      code= text[eLine].substring(0, eCol);
    }
    try {
      return !!eval("(" + code + ")");
    } catch(e) {
      bc.logWarn(resource.src + "(" + sLine + "):failed const has eval:\n" + code + "\n" + e);
      return false;
    }
  },

  hasPp= function() {
    // hasPp walks the tree and returns true for constant expressions (not statements)
    // 
    // Constant expressions are defined as expressions that do *not* contain names as operands
    // with the exception of has applications to feature arguments that are contained in
    // the staticHasFlag map supplied with the resource.
    
    // Note processor limitation: it is possible that an expression may be constant, yet not
    // detected as such. For example,
    // 
    // var x= 1;
    // if (x) {
    //   //do something
    // } else {
    //   //do something else
    // }
    // 
    // (x) is constant, and the "do something else" block is dead. However, the processor
    // currently will not detect this situation. Such processing and other more-advanced
    // static analysis is planned for future backdraft JavaScript toolsets. Check news at
    // http://www.altoviso.com/software.html
    // 
    // has applications to feature arguments that are contained in the staticHasFlag map
    // supplied with the resource are tranformed to either "1" or "0", depending on the value
    // of the feature in the map. Transformation is effected by directly editing the resource
    // text. This transformation *is* accounted for when computing constant expressions.
    // 
    // Dead code is eliminated (by appending to the resource deleteList) when detected in
    // if and conditional statements.
    //
    for (var arg, result= 1, i= 0; i<arguments.length; i++) {
      arg= arguments[i];
      if (arg && arg.type.hasPp) {
        result= arg.type.hasPp(arg.children, arg) && result;
      }
    }
    return result;
  },

  // resource, deleteList, and text will be set each time the hasPp is executed on a tree
  resource, deleteList, text, watchDeps, depsList;


asnComment.hasPp= function() {
};

asnLabel.hasPp= function(children) {
  hasPp(children[1]);
};

asnBlock.hasPp= function(children) {
  hasPp.apply(this, children);
};

asnSwitch.hasPp= function(children) {
  hasPp(children[0]);
  hasPp.apply(this, children[1]);

};

asnCase.hasPp= function(children) {
  hasPp(children);
};

asnDefault.hasPp= function(children) {
};

asnDebugger.hasPp= function(children) {
};

asnDo.hasPp= function(children) {
  hasPp(children[0]);
  hasPp(children[1]);
};

asnReturn.hasPp= function(children) {
  hasPp(children);
};

asnThrow.hasPp= function(children) {
  hasPp(children);
};

asnVar.hasPp= function(children) {
  children.map(function(item) { hasPp(item.initialValue); });
}

asnWhile.hasPp= function(children) {
  hasPp(children[0]);
  hasPp(children[1]);
};

asnWith.hasPp= function(children) {
  hasPp(children[0]);
  hasPp(children[1]);
};

asnStatement.hasPp= function(children) {
  hasPp(children);
};

asnBreak.hasPp= function(children) {
};

asnContinue.hasPp= function(children) {
};

asnForIn.hasPp= function(children) {
  hasPp(children[1]);
  hasPp(children[2]);
};

asnFor.hasPp= function(children) {
  var init= children[0][0];
  if (init instanceof Array) {
    symbols.asnVar.hasPp(init);
  } else {
    hasPp(init);
  }
  hasPp(children[1][0]);
  hasPp(children[2]);
  hasPp(children[3]);
};

asnFunctionDef.hasPp= function(children) {
  hasPp.apply(this, children[2]);
};

asnFunctionLiteral.hasPp= function(children) {
  hasPp.apply(this, children[2]);
};

asnIf.hasPp= function(children, thisNode) {
  if (hasPp(children[0])) {
    var hasExprVal= evalHasExpr(children[0].location);
    if (hasExprVal===true) {
      // delete the if statement; keep the true statement
      deleteList.push(new location(thisNode.location.start(), children[1].location.start()));
      if (children[2]) {
        deleteList.push(new location(children[1].location.end(1), children[2].location.end()));
      }
      hasPp(children[1]);
      replace(thisNode, children[1]);
      return;
    } else if (hasExprVal===false) {
      // delete the if statement; keep the false statement
      if (children[2]) {
        deleteList.push(new location(thisNode.location.start(), children[2].location.start(-1)));
        hasPp(children[2]);
        replace(thisNode, children[2]);
      } else {
        deleteList.push(thisNode.location);
        replace(thisNode, 0);
      }
      return;
    } // else could not compute expression during build time; fall through
  }
  hasPp(children[1]);
  hasPp(children[2]);
};

asnConditional.hasPp= function(children, thisNode) {
  if (hasPp(children[0])) {
    var hasExprVal= evalHasExpr(children[0].location);
    if (hasExprVal===true) {
      // delete the conditional expression and false branch; keep the true branch
      deleteList.push(new location(thisNode.location.start(), children[1].location.start()));
      deleteList.push(new location(children[1].location.end(), children[2].location.end()));
      hasPp(children[1]);
      replace(thisNode, children[1]);
    } else if (hasExprVal===false) {
      // delete the conditional expression and true branch; keep the false branch
      deleteList.push(new location(thisNode.location.start(), children[2].location.start()));
      hasPp(children[1]);
      replace(thisNode, children[2]);
      return;
    } // else could not compute expression during build time; fall through
  }
  hasPp(children[1]);
  hasPp(children[2]);
};

asnTry.hasPp= function(children) {
  hasPp(
    children[0], // try block
    children[1], // catch block
    children[2]  // finally block
  );
};

asnExprList.hasPp= function(children) {
  hasPp.apply(this, children);
};

asnNew.hasPp= function(children) {
  hasPp.apply(this, children);
};

asnUnaryPostfix.hasPp= function(children) {
  return hasPp(children[1]);
};

asnUnaryPrefix.hasPp= function(children) {
  return  hasPp(children[1]);
};

asnArray.hasPp= function(children) {
  hasPp.apply(this, children);
};

asnObject.hasPp= function(children) {
  children.map(function(item) { hasPp(item[1]); });
};

asnName.hasPp= function(children) {
  // the follow is discarded with the limitation that true | false | null is *not* considered static
  //var name= children.value;
  //return name=="true" || name=="false" || name=="null";
  return false;
};

asnNumber.hasPp= function(children) {
  return true;
};

asnString.hasPp= function(children) {
  return true;
};

asnRegEx.hasPp= function(children) {
  return true;
};

asnBinaryOp.hasPp= function(children, thisNode) {
  if (children[0].value=="(") {
    // children[1] is the function name (an expr)
    // children[2] is the function args (an array of expr)
    var
      name= children[1],
      args= children[2];
    if (name.type===asnName && name.children.value=="has") {
      var feature= args && args.length==1 && args[0].type==asnString && args[0].children.value;
      if (feature) {
        // thisNode holds "has("<feature>")"
        if (bc.staticHasFlags.hasOwnProperty(feature)) {
          // replace has with constant "1" or "0", for example
          //     "has("this-feature")"
          // becomes
          //     "1                  "
          // if feature is true
          var 
            replacement= bc.staticHasFlags[feature] ? "1" : "0",
            location= thisNode.location,
            sline= name.children.location.startLine,
            sCol= name.children.location.startCol,
            eCol= args[0].children.location.endCol,
            line= text[sline];
          text[sline]= line.substring(0, sCol) + replacement + getBlanks(eCol-sCol) + line.substring(eCol+1);
          // this is a constant expression
          return true;
        } else {
          // a has that will be computed at run-time
          var featureVector= bc.hasLocations[feature]= bc.hasLocations[feature] || []; 
          featureVector.push([resource, args[0].children.location]);
          return false;
        }
      }
    } // else, apply to a function which value cannot be computed at build time
    hasPp(name);
    hasPp.apply(this, args);
    return false;
  } else {
    // maybe a boolean expression of several static has values (e.g., has("foo") && has("bar"))
    return hasPp(children[1], children[2]);
  }
};

asnComment.hasPpReplace=
asnDefault.hasPpReplace=
asnDebugger.hasPpReplace=
asnVar.hasPpReplace=
asnBreak.hasPpReplace=
asnContinue.hasPpReplace=
asnName.hasPpReplace=
asnNumber.hasPpReplace=
asnString.hasPpReplace=
asnRegEx.hasPpReplace=
asnAtom.hasPpReplace=
  function() {
    bc.logError("trying to replace an atom in the has preprocessor");
  };

asnLabel.hasPpReplace=
  function(thisNode, children, original, replacement) {
    thisNode.children[1]= replacement;
  };
  
asnBlock.hasPpReplace=
asnDo.hasPpReplace=
asnWhile.hasPpReplace=
asnWith.hasPpReplace=
asnForIn.hasPpReplace=
asnFor.hasPpReplace=
asnIf.hasPpReplace=
asnConditional.hasPpReplace=
asnTry.hasPpReplace=
asnExprList.hasPpReplace=
asnNew.hasPpReplace=
asnUnaryPrefix.hasPpReplace=
asnUnaryPostfix.hasPpReplace=
asnBinaryOp.hasPpReplace=
asnArray.hasPpReplace=
asnRoot.hasPpReplace=
  function(thisNode, children, original, replacement) {
    for (var i= 0, end= children.length; i<end; i++) {
      if (children[i]===original) {
        children[i]= replacement;
        return;
      }
    }
    bc.logError("could not find original in hasPpReplace");
  };

asnSwitch.hasPpReplace=
  function(thisNode, children, original, replacement) {
    if (children[0]===original) {
      children[0]= replacement;
    } else {
      children= children[1];
      for (var i= 0, end= children.length; i<end; i++) {
        if (children[i]===original) {
          children[i]= replacement;
          return;
        }
      }
      bc.logError("could not find original in hasPpReplace");
    }
  };

asnCase.hasPpReplace=
asnReturn.hasPpReplace=
asnThrow.hasPpReplace=
asnStatement.hasPpReplace=
  function(thisNode, children, original, replacement) {
    thisNode.children= replacement;
  };

asnFunctionDef.hasPpReplace=
asnFunctionLiteral.hasPpReplace=
  function(thisNode, children, original, replacement) {
    children= children[2];
    for (var i= 0, end= children.length; i<end; i++) {
      if (children[i]===original) {
        children[i]= replacement;
        return;
      }
    }
    bc.logError("could not find original in hasPpReplace");
  };

asnObject.hasPpReplace=
  function(thisNode, children, original, replacement) {
    for (var i= 0, end= children.length; i<end; i++) {
      if (children[i][1]===original) {
        children[i][1]= replacement;
        return;
      }
    }
    bc.logError("could not find original in hasPpReplace");
  };

var replace= function(node, replacement) {
  var parent= node.parent;
  parent.type.hasPpReplace(parent, parent.children, node, replacement);
};

return function(resource_) {
  if (resource_.tree) {
    resource= resource_;
    deleteList= resource.deleteList;
    text= resource.text;
    try {
      hasPp.apply(this, resource.tree.children);
    } catch (e) {
      bc.logError("failed during has preprocessing");
      return e;
    }
  }
  return 0;
};

});
