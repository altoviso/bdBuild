// this script tests the argv module propertly resolves all the various relative basePath values
// with the bcs given as an object
{
  // when running this test, make sure the following path is set appropriately for your installation
  baseTree:"./test1",
  baseDir:"./test2",
  basePath:"./test3",

  build: {
    baseTree:"./test4",
    baseDir:"./test5",
    basePath:"./test6"
  }
}