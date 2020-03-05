'use strict';

var debug = require('debug')('cnpmjs.org:middleware:proxy_to_npm');
var config = require('../config');

module.exports = function () {

  var redirectUrl = config.sourceNpmRegistry;

  redirectUrl = config.sourceNpmWeb || redirectUrl.replace('//registry.', '//');
  var proxyUrls = [
    // /package/:pkg
    /^\/browse\/keyword\/[\w\-\.]+/,
  ];
  var scopedUrls = [
    // scoped package
    /^\/browse\/keyword\/(@[\w\-\.]+)/,
  ];


  return function* proxyToNpm (next) {
    if (config.syncModel !== 'none') {
      return yield next;
    }

    // syncModel === none
    // only proxy read requests
    if (this.method !== 'GET' && this.method !== 'HEAD') {
      return yield next;
    }

    var pathname = decodeURIComponent(this.path);

    var isScoped = false;
    var isPublichScoped = false;
    // check scoped name
    if (config.scopes && config.scopes.length > 0) {
      for (var i = 0; i < scopedUrls.length; i++) {
        const m = scopedUrls[ i ].exec(pathname);
        if (m) {
          isScoped = true;
          if (config.scopes.indexOf(m[ 1 ]) !== -1) {
            // internal scoped
            isPublichScoped = false;
          } else {
            isPublichScoped = true;
          }
          break;
        }
      }
    }

    var isPublich = false;
    if (!isScoped) {
      for (var i = 0; i < proxyUrls.length; i++) {
        isPublich = proxyUrls[ i ].test(pathname);
        if (isPublich) {
          break;
        }
      }
    }

    if (isPublich || isPublichScoped) {
      var url = redirectUrl + this.url;
      debug('proxy isPublich: %s, isPublichScoped: %s, package to %s',
        isPublich, isPublichScoped, url);
      this.redirect(url);
      return;
    }

    yield next;
  };
};
