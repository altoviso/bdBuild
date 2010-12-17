///
// \module bdBuild.hasPreprocessor
//
define(["bdParse"], function(parser) {

var 
  symbols= parser.symbols,
  asntName= symbols["asntName"],
  asntString= symbols["asntString"],

  location= parser.location,


  blanks= "                                                                                ",

  getBlanks= function(length) {
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
    return !!eval("(" + code + ")");
  },

  // deleteList and text will be set each time the preprocessor is executed on a tree
  resource, deleteList, text, staticHasFlags, hasLocations;

//
// hasPP walks the tree and returns true for constant expressions (not statements)
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

var depth= 0;

var hasPP= function() {
  for (var arg, result= 1, i= 0; i<arguments.length; i++) {
    arg= arguments[i];
    if (arg && arg.type.hasPP) {
      result= arg.type.hasPP(arg.children, arg) && result;
    }
  }
  return result;
};

symbols["asntComment"].hasPP= function() {
};

symbols["asntLabel"].hasPP= function(children) {
  hasPP(children[1]);
};

symbols["asntBlock"].hasPP= function(children) {
  hasPP.apply(this, children);
};

symbols["asntSwitch"].hasPP= function(children) {
  hasPP(children(0));
  hasPP.apply(this, children[1]);
};

symbols["asntCase"].hasPP= function(children) {
  hasPP(children);
};

symbols["asntDefault"].hasPP= function(children) {
};

symbols["asntDebugger"].hasPP= function(children) {
};

symbols["asntDo"].hasPP= function(children) {
  hasPP(children[0]);
  hasPP(children[1]);
};

symbols["asntReturn"].hasPP= function(children) {
  hasPP(children);
};

symbols["asntThrow"].hasPP= function(children) {
  hasPP(children);
};

symbols["asntVar"].hasPP= function(children) {
  children.map(function(item) { hasPP(item.initialValue); });
}

symbols["asntWhile"].hasPP= function(children) {
  hasPP(children[0]);
  hasPP(children[1]);
};

symbols["asntWith"].hasPP= function(children) {
  hasPP(children[0]);
  hasPP(children[1]);
};

symbols["asntStatement"].hasPP= function(children) {
  hasPP(children);
};

symbols["asntBreak"].hasPP= function(children) {
};

symbols["asntContinue"].hasPP= function(children) {
};

symbols["asntForIn"].hasPP= function(children) {
  hasPP(children[1]);
  hasPP(children[2]);
};

symbols["asntFor"].hasPP= function(children) {
  var init= children[0][0];
  if (init instanceof Array) {
    symbols.asntVar.hasPP(init);
  } else {
    hasPP(init);
  }
  hasPP(children[1][0]);
  hasPP(children[2]);
  hasPP(children[3]);
};

symbols["asntFunctionDef"].hasPP= function(children) {
  hasPP.apply(this, children[2]);
};

symbols["asntFunctionLiteral"].hasPP= function(children) {
  hasPP.apply(this, children[2]);
};

symbols["asntIf"].hasPP= function(children, thisNode) {
  if (hasPP(children[0])) {
    var hasExprVal= evalHasExpr(children[0].location);
    if (hasExprVal===true) {
      // delete the if statement; keep the true statement
      deleteList.push(new location(thisNode.location.start(), children[1].location.start()));
      if (children[2]) {
        deleteList.push(new location(children[1].location.end(1), children[2].location.end()));
      }
      hasPP(children[1]);
    } else if (hasExprVal===false) {
      // delete the if statement; keep the false statement
      if (children[2]) {
        deleteList.push(new location(thisNode.location.start(), children[2].location.start(-1)));
        hasPP(children[2]);
      } else {
        deleteList.push(thisNode.location);
      }
    }
  } else {
    hasPP(children[1]);
    hasPP(children[2]);
  }
};

symbols["asntTry"].hasPP= function(children) {
  hasPP(
    children[0], // try block
    children[1], // catch block
    children[2]  // finally block
  );
};

symbols["asntExprList"].hasPP= function(children) {
  hasPP.apply(this, children);
};

symbols["asntNew"].hasPP= function(children) {
  hasPP.apply(this, children);
};

symbols["asntUnaryPostfix"].hasPP= function(children) {
  return hasPP(children[1]);
};

symbols["asntUnaryPrefix"].hasPP= function(children) {
  return  hasPP(children[1]);
};

symbols["asntArray"].hasPP= function(children) {
  hasPP.apply(this, children);
};

symbols["asntObject"].hasPP= function(children) {
  children.map(function(item) { hasPP(item[1]); });
};

symbols["asntName"].hasPP= function(children) {
  // the follow is discarded with the limitation that true | false | null is *not* considered static
  //var name= children.value;
  //return name=="true" || name=="false" || name=="null";
  return false;
};

symbols["asntNumber"].hasPP= function(children) {
  return true;
};

symbols["asntString"].hasPP= function(children) {
  return true;
};

symbols["asntRegEx"].hasPP= function(children) {
  return true;
};

symbols["asntBinaryOp"].hasPP= function(children, thisNode) {
  if (children[0].value=="(") {
    // children[1] is the function name (an expr)
    // children[2] is the function args (an array of expr)
    var
      name= children[1],
      args= children[2];
    if (name.type===asntName && name.children.value=="has") {
      var feature= args && args.length==1 && args[0].type==asntString && args[0].children.value;
      if (feature) {
        // thisNode holds "has("<feature>")"
        if (staticHasFlags.hasOwnProperty(feature)) {
          // replace has with constant "1" or "0", for example
          //     "has("this-feature")"
          // becomes
          //     "1                  "
          // if feature is true
          var 
            replacement= staticHasFlags[feature] ? "1" : "0",
            location= thisNode.location,
            sline= name.children.location.startLine,
            sCol= name.children.location.startCol,
            eCol= args[0].children.location.endCol,
            line= text[sline];
          text[sline]= line.substring(0, sCol) + replacement + getBlanks(eCol-sCol) + line.substring(eCol);
          // this is a constant expression
          return true;
        } else {
          // a has that will be computed at run-time
          var featureVector= hasLocations[feature]= hasLocations[feature] || []; 
          featureVector.push([resource, args[0].children.location]);
          return false;
        }
      } else {
        hasPP.apply(this, args);
      }
    } else {
      hasPP(name);
      hasPP.apply(this, args);
    }
  } else {
    hasPP(children[1], children[2]);
  }
  return false;
};

symbols["asntConditional"].hasPP= function(children) {
  if (hasPP(children[0])) {
    var hasExprVal= evalHasExpr(children[0]);
    if (hasExprVal===true) {
      // delete the if statement; keep the true statement
      deleteList.push(new location(thisNode.location.start(), children[1].location.start()));
      if (children[2]) {
        deleteList.push(new location(children[1].location.start(1), chldren[2].location.end()));
      }
      hasPP(children[1]);
    } else if (hasExprVal===false) {
      // delete the if statement; keep the false statement
      if (children[2]) {
        deleteList.push(new location(thisNode.location.start(), children[2].location.start(-1)));
        hasPP(children[2]);
      } else {
        deleteList.push(thisNode.location);
      }
    }
  } else {
    hasPP(children[1]);
    hasPP(children[2]);
  }
};

return function(resource_, staticHasFlags_) {
  resource= resource_;
  if (!resource.tree) {
    return;
  }
  deleteList= resource.deleteList;
  text= resource.text;
  staticHasFlags= staticHasFlags_;
  hasLocations= resource.hasLocations;
  try {
    hasPP.apply(this, resource.tree.children);
  } catch (e) {
    console.log(e);
    e.message= "Failed during has preprocessing: " + e.message;
    throw e;
  }
};

});
