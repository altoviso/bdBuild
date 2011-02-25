///
// \amd-mid bdBuild/lib/transforms/readBdLoad
// 
// A function to read the bdLoad resource.
// 
// The function publishes the resource to the build control so that other resources may
// send information to the bdLoad transform (e.g., requesting bootstraps be written or
// providing has.js implementations). Otherwise, delegates to bdBuild/transforms/read
// for reading of resource content.
define(["../buildControl", "./read"], function(bc, read) {
  return function(resource, asyncReturn) {
    // other transforms may instruct the loader write transform to write a bootstrap by
    // pushing into bc.loader.boots...
    resource.boots= [];
    bc.loader= resource;
    return read(resource, bc, asyncReturn);
  };
});
