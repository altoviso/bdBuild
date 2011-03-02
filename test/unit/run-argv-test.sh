# various kinds of bcs's; all empty
node ../../lib/main.js --build bcs01.bcs.js --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js --build bcs02.bcs.js --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js --require bcs03.js --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js --loader bcs04.js --unit-test argv --unit-test-param argv-expected-01.txt

# same as above, short flag names
node ../../lib/main.js -b bcs01.bcs.js --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js -b bcs02.bcs.js --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js -r bcs03.js --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js -l bcs04.js --unit-test argv --unit-test-param argv-expected-01.txt

# same as above, no file types
node ../../lib/main.js --build bcs01 --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js --build bcs02 --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js --require bcs03 --unit-test argv --unit-test-param argv-expected-01.txt
node ../../lib/main.js --loader bcs04 --unit-test argv --unit-test-param argv-expected-01.txt

# some command line props
node ../../lib/main.js -b bcs01 --someProperty v1 --someOtherProperty v2 --unit-test argv --unit-test-param argv-expected-02.txt

echo
echo print the help
node ../../lib/main.js --help
echo
echo "pass a build file that doesn't exist; should report and terminate"
node ../../lib/main.js -b thisIsNonSense.js
echo
echo "pass a build file that has syntax errors; should report and terminate"
node ../../lib/main.js -b bcs05
echo
echo "pass an empty command line with no config file; should report and terminate"
node ../../lib/main.js
echo
