// this configuration assumes the bdBuild, bdParse, and bdLoad packages are siblings
exports.amdLoader=
  __dirname + "/../../bdLoad/lib/node";

exports.amdLoaderConfig= {
  baseUrl:__dirname + "/../..",

  packages: [{
    name:"bdBuild"
  },{
    name:"bdParse"
  },{
    name:"bdLoad"
  }]
};

