// test/test01/js/test/test.js
// this is just a nonsense resource to watch how it is transformed, depending upon the build script
if (has("loader-injectApi")) {
  // here is some inject code
}

if (has("loader-injectApi")) {
  // here is some inject code
} else {
  // here is some non-inject code
}

if (has("loader-injectApi")) {
  // here is some inject code
} else if (has("loader-traceApi")) {
  // here is some trace code
} else {
  // here is some non-inject, non-trace code
}
