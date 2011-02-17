// this script tests files, dirs, and trees with baseDir set to an absolute path
{
  // when running this test, make sure the following path is set appropriately for your installation
  baseDir:"/home/rcgill/dev/bdBuild/test/test01",
  
  files:[
    "./dir-to-optionally-copy/resource-to-optionally-copy-1.js"
  ],

  dirs:[
    ["./js", "./js"]
  ],
  
  trees:[
    ["./css", "./css"]
  ]
}