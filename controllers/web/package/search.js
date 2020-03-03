'use strict';

var debug = require('debug')('cnpmjs.org:controllers:web:package:search');
var packageService = require('../../../services/package');
var config = require('../../../config');
var redirectUrl = config.sourceNpmRegistry;

redirectUrl = config.sourceNpmWeb || redirectUrl.replace('//registry.', '//');
module.exports = function* search() {
  var params = this.params;
  var word = params.word || params[0];
  var limit = Number(this.query.limit) || 100;

  if (limit > 10000) {
    limit = 10000;
  }

  debug('search %j', word);
  var result = yield packageService.search(word, {
    limit: limit
  });

  var match = null;
  const searchResultCount = result.searchMatchs.length;
  for (var i = 0; i < searchResultCount; i++) {
    var p = result.searchMatchs[i];
    if (p.name === word) {
      match = p;
      break;
    }
  }
  if(searchResultCount ===0){
    var url = redirectUrl + this.url;
    this.redirect(url);
    return;
  }

  // return a json result
  if (this.query && this.query.type === 'json') {
    this.jsonp = {
      keyword: word,
      match: match,
      packages: result.searchMatchs,
      keywords: result.keywordMatchs,
    };
    return;
  }
  yield this.render('search', {
    title: 'Keyword - ' + word,
    keyword: word,
    match: match,
    packages: result.searchMatchs,
    keywords: result.keywordMatchs,
  });
};
