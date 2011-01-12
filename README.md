# bdBuild - The Backdraft Build Program

bdBuild processes the set of resources that comprise a browser-based program and outputs an optimized version of those
resources. It is designed to be complimentary to [bdLoad](https://github.com/altoviso/bdLoad), the backdraft loader. It
can also be configured to work with other [AMD](http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition)-compliant loaders. 

The following optimizations are planned for the first release:

  * Aggregating sets of AMD-compliant modules into a single resources
  * Copying development trees into release trees
  * Package renaming and mapping
  * Removing has.js feature tests for features known at build time
  * Optimizing run-time has.js to include only those features used by the program
  * Processing dojo build pragmas
  * Option to output a single-file program, thereby eliminating the need for any loader
  
Unlike several competing systems, bdBuild parses javascript resources to effect some of this processing. This allows for
several advanced optimization techniques (e.g., static analysis and data flow analysis) that will be included in future
versions. Although bdBuild is part of the  [backdraft framework](http://bdframework.org/index.html), it may be
used with any html/javascript application.

## Status

bdBuild is currently pre-alpha. Expect an alpha release in Jan 2011.

## License

bdBuild is free and open source software available under a BSD-style license.

## See Also

[The backdraft framwork](http://bdframework.org/index.html)

[bdLoad](https://github.com/altoviso/bdLoad) (the backdraft loader)

[bdParse](https://github.com/altoviso/bdParse) (a javascript parser, implemented in javascript)

[bdLoad](https://github.com/altoviso/bdLoad) (the backdraft loader)




