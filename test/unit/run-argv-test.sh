# long flag names...
node ../../lib/main.js -b bcs0.js --base-path ./this/is/a/test --page-base-path /test2 --dest-base-path ../../test3 --dest-package-base-path "\my documents"  --unit-test argv --unit-test-param argv-bcs0-expected.txt
# short flag name...
node ../../lib/main.js -b bcs0.js -s ./this/is/a/test --page-base-path /test2 -d ../../test3 -p "\my documents" --unit-test argv --unit-test-param argv-bcs0-expected.txt
# build scripts; checking for relative path resolution
node ../../lib/main.js -b bcs1.js --unit-test argv --unit-test-param argv-bcs1-expected.txt
node ../../lib/main.js -b bcs2.js --unit-test argv --unit-test-param argv-bcs2-expected.txt
# require config
node ../../lib/main.js -r bcs3.js --unit-test argv --unit-test-param argv-bcs1-expected.txt
# long flag names
node ../../lib/main.js --build bcs1.js --unit-test argv --unit-test-param argv-bcs1-expected.txt
node ../../lib/main.js --require bcs3.js --unit-test argv --unit-test-param argv-bcs1-expected.txt
# multiple bcs
node ../../lib/main.js -b bcs1.js  -b bcs2.js --unit-test argv --unit-test-param argv-bcs3-expected.txt
node ../../lib/main.js -b bcs1.js  -b bcs2.js --unit-test argv --unit-test-param argv-bcs3-expected.txt
echo
echo print the help
node ../../lib/main.js --help
echo
echo pass a bad flag name; should report and terminate
node ../../lib/main.js -build bcs1.js  -b bcs2.js
echo
echo "pass a build file that doesn't exist; should report and terminate"
node ../../lib/main.js -b thisIsNonSense.js
echo
echo "pass a build file that has syntax errors; should report and terminate"
node ../../lib/main.js -r bcs4.js
echo
echo "pass an empty command line with no config file; should report and terminate"
node ../../lib/main.js
echo
