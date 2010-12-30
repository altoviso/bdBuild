///
// \module bdBuild/amdAstProc
//
define(["./buildControl", "./packageJob", "bdParse"], function(buildControl, packageJob, bdParse) {
var 
  resolveModuleId= packageJob.resolveModuleId,

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

  amdAstProc= function() {
    for (var arg, result= 1, i= 0; i<arguments.length; i++) {
      arg= arguments[i];
      if (arg && arg.type && arg.type.amdAstProc) {
        result= arg.type.amdAstProc(arg.children, arg) && result;
      }
    }
    return result;
  },

  // a set of strings; used to remember the dependencies for the current resource
  depsSet;

asnComment.amdAstProc=
asnDefault.amdAstProc=
asnDebugger.amdAstProc=
asnVar.amdAstProc=
asnBreak.amdAstProc=
asnContinue.amdAstProc=
asnName.amdAstProc=
asnNumber.amdAstProc=
asnString.amdAstProc=
asnRegEx.amdAstProc=
asnAtom.amdAstProc= 0;

asnLabel.amdAstProc=
  function(children) {
    amdAstProc(children[1]);
  };
  
asnBlock.amdAstProc=
asnDo.amdAstProc=
asnWhile.amdAstProc=
asnWith.amdAstProc=
asnForIn.amdAstProc=
asnFor.amdAstProc=
asnIf.amdAstProc=
asnConditional.amdAstProc=
asnTry.amdAstProc=
asnExprList.amdAstProc=
asnNew.amdAstProc=
asnUnaryPrefix.amdAstProc=
asnUnaryPostfix.amdAstProc=
asnArray.amdAstProc=
asnRoot.amdAstProc=
  function(children) {
    amdAstProc.apply(this, children);
  };

asnSwitch.amdAstProc=
  function(children) {
    amdAstProc(children[0]);
    amdAstProc.apply(this, children[1]);
  };

asnCase.amdAstProc=
asnReturn.amdAstProc=
asnThrow.amdAstProc=
asnStatement.amdAstProc=
  function(children) {
    amdAstProc(children);
  };

asnFunctionDef.amdAstProc=
asnFunctionLiteral.amdAstProc=
  function(children) {
    amdAstProc.apply(this, children[2]);
  };

asnObject.amdAstProc=
  function(children) {
    for (var i= 0, end= children.length; i<end; i++) {
      amdAstProc(children[i][1]);
    }
  };

/*
      if (!args) {
        args= arity==1 ? [0, defaultDeps, mid] :
                         (arity==2 ? (isArray(mid) ? [0, mid, dependencies] : [mid, defaultDeps, dependencies]) :
                                                     [mid, dependencies, factory]);
      }
*/

function getDeps(exprList) {
  for (var i= 0; i<exprList.length; i++) {
    var item= exprList[i];
    if (item.type===asnString) {
      depsSet[exprList[i].children.value]= 1;
    }
  }
}

asnBinaryOp.amdAstProc=
  function(children) {
    if (children[0].value=="(") {
      // children[1] is the function name (an expr)
      // children[2] is the function args (an array of expr)
      var
        name= children[1],
        args= children[2];
      if (name.type===asnName && name.children.value=="define") {
        if (args.length==1) {
          // module name is implied by resource name; no dependencies given; args[0] holds the factory
        } else if (args.length==2 && args[0].type===asnArray) {
          // module name is implied by resource name; args[0] holds dependencies; args[1] holds the factory
          getDeps(args[0].children);
        } else if (args.length==2 && args[0].type===asnString) {
          // module name is given by args[0]; dependencies is missing; args[1] holds the factory
        } else if (args.length==3) {
          // module name is given by args[0]; dependencies by args[1]; factory by args[2]
          getDeps(args[1].children);
        } 
      } else if (name.type===asnName && name.children.value=="require") {
        // args[0] is always the dependency vector and args[1] the factory
        getDeps(args[0].children);
      }
    } else {
      amdAstProc(children[1], children[2]);
    }
  };

return function(resource) {
  if (resource.tree) {
    depsSet= {};
    try {
      amdAstProc.apply(this, resource.tree.children);
      var resolvedDeps= resource.deps= [];
      for (var dep in depsSet) {
        if (dep!="require") {
          resolvedDeps.push(resolveModuleId(dep, resource));
        }
      }
    } catch (e) {
      e.message= "Failed during AMD preprocessing: " + e.message;
      throw e;
    }
  }
};

});
