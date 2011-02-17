// this script tests files, dirs, and trees with baseDir set to an absolute path
{
  // when running this test, make sure the following path is set appropriately for your installation
  baseDir:"/home/rcgill/dev/bdBild/test/test01",
  
  files:[
    ["../../../bdLoad/lib/require.js", "./require.js"]
  ],

  dirs:[
    ["./js", "./js"]
  ],
  
  trees:[
    ["./css", "./css"]
  ]
}