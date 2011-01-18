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
    
    getAvailableLocales= function(
      root, 
      locale,
      bundlePath,
      bundleName,
      availableLocales
    ) {
      for (var result= [bundlePath + bundleName], localeParts= locale.split("-"), current= "", i= 0; i<localeParts.length; i++) {
        current+= localeParts[i];
        if (root[current]) {
          availableLocales[bundlePath + current + "/" + bundleName]= 1;
        }
      }
    },

    written= {},

    write= function(mid, bundle, cache) {
      if (!written[mid]) {
        written[mid]= 1;
        cache.cacheModules.push("\"" + mid + "\":function(){\n" + bundle + "\n\n}\n");
      }

    },

    bundles= {},

    getBundle= function(filename) {
      if (bundles[filename]) {
        return bundles[filename];
      } else {
        return (bundles[filename]= fs.readFileSync(filename, "utf8"));
      }
    },

    writeModuleToCache= function(cache) {
      var
        rootBundle= getBundle(this.url),
        match= this.url.match(/(.+\/)([^\/]+)$/),
        bundlePath= match[1],
        bundleName= match[2],
        availableLocales= {};
      if (this.locale) {
        getAvailableLocales(rootBundle, this.locale, bundlePath, bundleName, availableLocales);
      }
      bc.locales.forEach(function(locale) {
        getAvailableLocales(rootBundle, locale, bundlePath, bundleName, availableLocales);
      });
      write(this.pqn.substring(5), rootBundle, cache);
      match= this.pqn.match(/^i18n!(.+\/)([^\/]+)$/);
      var 
        midPath= match[1],
        midName= match[2];
      for (var p in availableLocales) {
        write(midPath + p + "/" + midName, getBundle(bundlePath + p + "/" + bundleName), cache);
      }
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
        pqn= moduleInfo.pqn= "i18n!" + moduleInfo.pid + "*" + moduleInfo.mid;
      if (bc.jobs[pqn]) {
        return bc.jobs[pqn];
      } else {
        moduleInfo.locale= locale;
        moduleInfo.deps= [packageJob.getModule("i18n")];
        moduleInfo.writeModuleToCache= writeModuleToCache;     
        return packageJob.addModule(pqn, moduleInfo);
      }
    };

  bc.plugins["*i18n"]= startI18nPlugin;
});
