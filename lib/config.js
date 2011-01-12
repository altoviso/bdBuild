exports.amdLoader=
  "../../bdLoad/lib/node";

exports.amdLoaderConfig= {
  baseUrl:__dirname + "/../../",

  packages: [{
    name:"bdBuild"
  }, {
    name:"bdParse"
  }, {
    name:"bdLoad"
  }]
};

exports.sandbox= __dirname + "/../temp";

