define([], function() {
  // define the gates each resource must pass through; 
  // notice the implementation is designed to make adding/subtracting gates easy

  var 
    // the ordered gate names
    gateNames= "read.text.tokenize.tokens.parse.ast.optimize.write.cleanup.report".split("."),

    // map from gate name (call this a gateName) to an ordered id (call this a gateId)
    gate= {},

    // map from gateId to gateName
    gateName= new Array(gateNames.length+1),

    // map from gateId to progress message
    gateMessage= new Array(gateName.length+1);

  // initialize the gate and gateName maps; gateIds are org'd at 1
  var i= 0;
  gateNames.forEach(function(name) {
    gateName[(gate[name]= ++i)]= name;
  });
  var lastGateId= i;

  // initialize the gate progress message map
  gateMessage[gate.read]     ="reading resources";
  gateMessage[gate.text]     ="processing raw resource content";
  gateMessage[gate.tokenize] ="tokenizing resource";
  gateMessage[gate.tokens]   ="processing resource tokens";
  gateMessage[gate.parse]    ="parsing resource";
  gateMessage[gate.ast]      ="processing resource AST";
  gateMessage[gate.optimize] ="executing global optimizations";
  gateMessage[gate.write]    ="writing resources";
  gateMessage[gate.cleanup]  ="cleaning up";
  gateMessage[gate.report]   ="done";

  return {
    gate:gate,
    gateName:gateName,
    gateMessage:gateMessage,
    lastGateId:lastGateId
  };
});
