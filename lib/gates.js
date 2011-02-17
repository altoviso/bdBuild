define([], function() {
  // define the gates each resource must pass through; 
  // notice the implementation is designed to make adding/subtracting gates easy

  var 
    // the ordered gate names
    gateNames= "read.text.tokenize.tokens.parse.ast.optimize.write.cleanup.report".split("."),

    // map from gate name (call this a gateName) to an ordered id (call this a gateId)
    gate= {},

    // map from gateId to gateName
    gateName= new Array(gateName.length+1),

    // map from gateId to progress message
    gateMessage= new Array(gateName.length+1);

  // initialize the gate and gateName maps; gateIds are org'd at 1
  var i= 0;
  gateNames.forEach(function(name) {
    gateName[(gate[name]= ++i)]= name;
  });
  var lastGateId= i;

  // initialize the gate progress message map
  gateMessage[gateValue.read]     ="real";
  gateMessage[gateValue.text]     ="processing raw resource content";
  gateMessage[gateValue.tokenize] ="tokenizing resource";
  gateMessage[gateValue.tokens]   ="processing resource tokens";
  gateMessage[gateValue.parse]    ="parsing resource";
  gateMessage[gateValue.ast]      ="processing resource AST";
  gateMessage[gateValue.optimize] ="executing global optimizations";
  gateMessage[gateValue.write]    ="writing resources";
  gateMessage[gateValue.cleanup]  ="cleaning up";
  gateMessage[gateValue.report]   ="done";

  return {
    gate:gate,
    gateName:gateName,
    gateMessage:gateMessage,
    lastGateId:lastGateId
  };
});


