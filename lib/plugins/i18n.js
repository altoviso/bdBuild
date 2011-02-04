///
// \module bdBuild/plugins/i18n
//
define(["bdBuild/buildControl", "../packageJob", "fs"], function(bc, packageJob, fs) {
  var
    nlsRe=
      // regexp for reconstructing the master bundle name from parts of the regexp match
      // nlsRe.exec("foo/bar/baz/nls/en-ca/foo") gives:
      // ["foo/bar/baz/nls/en-ca/foo", "foo/bar/baz/nls/", "/", "/", "en-ca", "foo"]
      // nlsRe.exec("foo/bar/baz/nls/foo") gives:
      // ["foo/bar/baz/nls/foo", "foo/bar/baz/nls/", "/", "/", "foo", ""]
      // so, if match[5] is blank, it means this is the top bundle definition.
      // courtesy of http://requirejs.org
      /(^.*(^|\/)nls(\/|$))([^\/]*)\/?([^\/]*)/,

    rootBundles= {},

    getRootBundle= function(filename) {
      if (rootBundles[filename]) {
        return rootBundles[filename];
      }
      var code= fs.readFileSync(filename, "utf8");
      code= "var result; function define(bundle){result= bundle;} " + code + "; result;";
      var result= process.compile(code, filename);
      return (rootBundles[filename]= result);
    },
    
    getAvailableLocales= function(
      root, 
      locale,
      bundlePath,
      bundleName,
      availableLocales
    ) {
      for (var localeParts= locale.split("-"), current= "", i= 0; i<localeParts.length; i++) {
        current+= localeParts[i];
        if (root[current]) {
          availableLocales[bundlePath + current + "/" + bundleName]= 1;
        }
      }
    },

    getCacheText= function() {
      // the required bundles were identified as dependencies; that's all we need to preposition i18n plugin resources
      return "";
    },

    startI18nPlugin= function(
      mid,
      referenceModule
    ) {
      var
        match= nlsRe.exec(mid),
        bundlePath= match[1],
        bundleName= match[5] || match[4],
        locale= (match[5] && match[4]),
        moduleInfo= packageJob.getModuleInfo(bundlePath + bundleName, referenceModule),
        pqn= moduleInfo.pqn= "i18n!" + moduleInfo.pid + "*" + moduleInfo.mid + (locale ? "/" + locale : "");
      if (bc.jobs[pqn]) {
        // already resolved...
        return bc.jobs[pqn];
      } else {
        // bundlePath may have been relative; get the absolute path
        bundlePath= moduleInfo.path.match(/(.+\/)[^\/]+$/)[1];

        // compute all of the necessary bundle module ids
        var 
          rootBundle= getRootBundle(moduleInfo.url),
          availableLocales= {};
        availableLocales[bundlePath + bundleName]= 1;
        if (locale) {
          getAvailableLocales(rootBundle, locale, bundlePath, bundleName, availableLocales);
        }
        bc.locales.forEach(function(locale) {
          getAvailableLocales(rootBundle, locale, bundlePath, bundleName, availableLocales);
        });
  
        var deps= [packageJob.getModule("i18n")];
        for (var p in availableLocales) {
          deps.push(packageJob.getModule(p));
        }
        moduleInfo.deps= deps;
        moduleInfo.getCacheText= getCacheText;
        moduleInfo.pluginResource= true; 
        return packageJob.addModule(pqn, moduleInfo);
      }
    };

  bc.plugins["*i18n"]= startI18nPlugin;
});
