'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {compile, compileAsync, parseRule, MAX_URL} = require('./mouse-adblock-rules.cjs');

// Exercise the public decisions, not the indexing implementation. The URLs are
// synthetic: these tests make no network requests and do not depend on live ads.
const request = (url, extra = {}) => ({
  url,
  resourceType: 'script',
  initiatorOrigin: 'https://news.example',
  ...extra,
});
const engineFor = (...rules) => compile([rules.join('\n')]);
const decision = (engine, expected, url, extra = {}) => {
  assert.equal(engine.shouldBlock(request(url, extra)), expected,
    JSON.stringify({url, ...extra}));
};

test('domain anchor matches real host labels, subdomains, ports and normalized hosts', () => {
  const engine = engineFor('||ads.example^');
  for (const url of [
    'https://ads.example/pixel',
    'http://ads.example:8080/pixel',
    'https://cdn.ads.example/pixel',
    'https://ADS.EXAMPLE/pixel',
    'https://ads.example./pixel',
    'wss://ads.example/socket',
  ]) decision(engine, true, url);
});

test('domain anchor cannot match another host, credentials, path or query text', () => {
  const engine = engineFor('||ads.example^');
  for (const url of [
    'https://notads.example/pixel',
    'https://ads.example.evil.test/pixel',
    'https://ads-example.test/pixel',
    'https://safe.example/ads.example/pixel',
    'https://safe.example/?destination=https://ads.example/pixel',
    'https://ads.example@safe.example/pixel',
    'https://safe.example/#https://ads.example/pixel',
  ]) decision(engine, false, url);
});

test('left and right anchors describe the whole requested URL', () => {
  const engine = engineFor('|https://ads.example/banner.js|');
  decision(engine, true, 'https://ads.example/banner.js');
  decision(engine, true, 'https://ads.example/banner.js#not-sent-to-server');
  for (const url of [
    'http://ads.example/banner.js',
    'https://cdn.ads.example/banner.js',
    'https://ads.example/banner.js?cache=1',
    'https://ads.example/banner.js/extra',
    'https://safe.example/?next=https://ads.example/banner.js',
  ]) decision(engine, false, url);
});

test('wildcards consume zero or multiple characters without evaluating regex syntax', () => {
  const engine = engineFor('|https://ads.example/assets/*/banner*.js|');
  for (const url of [
    'https://ads.example/assets//banner.js',
    'https://ads.example/assets/a/b/banner-wide.js',
    'https://ads.example/assets/a/banner12.js',
  ]) decision(engine, true, url);
  decision(engine, false, 'https://ads.example/assets/a/banner.js.map');
  decision(engine, false, 'https://ads.example/assets/a/poster.js');
  const literal = engineFor('advertising+banner');
  decision(literal, true, 'https://cdn.example/advertising+banner.js');
  decision(literal, false, 'https://cdn.example/advertisingggbanner.js');
});

test('wildcard hostname anchors remain confined to the hostname', () => {
  const engine = engineFor('||ads*.example^');
  decision(engine, true, 'https://ads123.example/pixel');
  decision(engine, true, 'https://cdn.ads123.example/pixel');
  decision(engine, false, 'https://ads123.example.evil.test/pixel');
  decision(engine, false, 'https://safe.example/?next=ads123.example/pixel');
});

test('separator matches URL end and delimiters but not a word or escaped character', () => {
  const engine = engineFor('/advertising/banner^');
  for (const suffix of ['', '?slot=1', '/child', ':1', '+1', '=1', '&slot=1']) {
    decision(engine, true, 'https://cdn.example/advertising/banner' + suffix);
  }
  for (const suffix of ['x', '2', '_wide', '-wide', '.svg', '%2Fchild']) {
    decision(engine, false, 'https://cdn.example/advertising/banner' + suffix);
  }
});

test('plain URL patterns ignore case by default and match-case preserves path case', () => {
  const insensitive = engineFor('Campaign_Banner');
  decision(insensitive, true, 'https://cdn.example/campaign_banner.js');
  decision(insensitive, true, 'https://cdn.example/CAMPAIGN_BANNER.js');
  const sensitive = engineFor('Campaign_Banner$match-case');
  decision(sensitive, true, 'https://cdn.example/Campaign_Banner.js');
  decision(sensitive, false, 'https://cdn.example/campaign_banner.js');
});

test('network exceptions take precedence regardless of list order', () => {
  const block = '||ads.example^';
  const allow = '@@||ads.example/needed.js|';
  for (const texts of [[block, allow], [allow, block]]) {
    const engine = compile(texts);
    decision(engine, false, 'https://ads.example/needed.js');
    decision(engine, true, 'https://ads.example/banner.js');
    decision(engine, true, 'https://ads.example/needed.js?different=1');
  }
});

test('network exceptions preserve source-domain and resource-type restrictions', () => {
  const engine = engineFor('||ads.example^', '@@||ads.example^$image,domain=news.example');
  decision(engine, false, 'https://ads.example/asset', {resourceType: 'image'});
  decision(engine, true, 'https://ads.example/asset', {resourceType: 'script'});
  decision(engine, true, 'https://ads.example/asset', {
    resourceType: 'image', initiatorOrigin: 'https://other.example',
  });
});

test('domain lists use the source, include subdomains and give exclusions priority', () => {
  const engine = engineFor('||ads.example^$domain=news.example|blog.example|~private.news.example');
  for (const source of ['https://news.example', 'https://www.news.example', 'https://blog.example']) {
    decision(engine, true, 'https://ads.example/pixel', {initiatorOrigin: source});
  }
  for (const source of ['https://private.news.example', 'https://child.private.news.example',
    'https://notnews.example', 'https://news.example.evil.test', 'https://ads.example']) {
    decision(engine, false, 'https://ads.example/pixel', {initiatorOrigin: source});
  }
  decision(engine, false, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://other.example', topUrl: 'https://news.example/article',
  });
});

test('negative-only domain lists apply outside the excluded source and require context', () => {
  const engine = engineFor('||ads.example^$domain=~news.example');
  decision(engine, true, 'https://ads.example/pixel', {initiatorOrigin: 'https://other.example'});
  decision(engine, false, 'https://ads.example/pixel', {initiatorOrigin: 'https://sub.news.example'});
  decision(engine, false, 'https://ads.example/pixel', {initiatorOrigin: undefined});
});

test('source-domain restrictions normalize internationalized hostnames', () => {
  const engine = engineFor('||ads.example^$domain=пример.рф');
  decision(engine, true, 'https://ads.example/pixel', {initiatorOrigin: 'https://пример.рф'});
  decision(engine, true, 'https://ads.example/pixel', {initiatorOrigin: 'https://www.xn--e1afmkfd.xn--p1ai'});
  decision(engine, false, 'https://ads.example/pixel', {initiatorOrigin: 'https://другой.рф'});
});

test('positive types form a union, negative types take priority, and negative-only filters work', () => {
  const union = engineFor('||ads.example^$script,image,~image');
  decision(union, true, 'https://ads.example/asset', {resourceType: 'script'});
  decision(union, false, 'https://ads.example/asset', {resourceType: 'image'});
  decision(union, false, 'https://ads.example/asset', {resourceType: 'font'});
  const negative = engineFor('||ads.example^$~image');
  decision(negative, true, 'https://ads.example/asset', {resourceType: 'script'});
  decision(negative, false, 'https://ads.example/asset', {resourceType: 'image'});
});

test('supported ABP resource names map to actual Electron resource types', () => {
  for (const [filterType, resourceType] of Object.entries({
    script: 'script', image: 'image', stylesheet: 'stylesheet', object: 'object',
    xmlhttprequest: 'xhr', subdocument: 'subFrame', media: 'media', font: 'font',
    websocket: 'webSocket', ping: 'ping', other: 'other',
  })) {
    const engine = engineFor('||ads.example^$' + filterType);
    decision(engine, true, 'https://ads.example/asset', {resourceType});
    decision(engine, false, 'https://ads.example/asset', {resourceType: resourceType === 'image' ? 'script' : 'image'});
  }
});

test('third-party uses registrable domains rather than different subdomains', () => {
  const third = engineFor('advertising$third-party');
  const first = engineFor('advertising$~third-party');
  for (const [source, destination, thirdParty] of [
    ['https://shop.example.com', 'https://ads.example.com/advertising', false],
    ['https://shop.example.com', 'https://ads.other.com/advertising', true],
    ['https://shop.example.co.uk', 'https://ads.example.co.uk/advertising', false],
    ['https://shop.example.co.uk', 'https://ads.other.co.uk/advertising', true],
    ['https://example.com', 'http://example.com:8080/advertising', false],
  ]) {
    decision(third, thirdParty, destination, {initiatorOrigin: source});
    decision(first, !thirdParty, destination, {initiatorOrigin: source});
  }
});

test('private PSL tenants are separate sites but their own subdomains are first-party', () => {
  const engine = engineFor('advertising$third-party');
  decision(engine, true, 'https://bravo.github.io/advertising', {initiatorOrigin: 'https://alpha.github.io'});
  decision(engine, false, 'https://cdn.alpha.github.io/advertising', {initiatorOrigin: 'https://alpha.github.io'});
  decision(engine, true, 'https://bravo.blogspot.com/advertising', {initiatorOrigin: 'https://alpha.blogspot.com'});
});

test('IP addresses and single-label hosts do not collapse into one first-party site', () => {
  const engine = engineFor('advertising$third-party');
  decision(engine, false, 'http://127.0.0.1/advertising', {initiatorOrigin: 'http://127.0.0.1:9000'});
  decision(engine, true, 'http://127.0.0.2/advertising', {initiatorOrigin: 'http://127.0.0.1'});
  decision(engine, false, 'http://localhost/advertising', {initiatorOrigin: 'http://localhost:9000'});
  decision(engine, true, 'http://intranet/advertising', {initiatorOrigin: 'http://localhost'});
});

test('initiator origin is authoritative over a contradictory referrer or top page', () => {
  const engine = engineFor('||ads.example^$domain=trusted.example');
  decision(engine, false, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://untrusted.example', referrer: 'https://trusted.example/article',
    frameUrl: 'https://trusted.example/frame', topUrl: 'https://trusted.example',
  });
  decision(engine, true, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://trusted.example', referrer: 'https://untrusted.example/article',
  });
});

test('referrer supplies source context only when an initiator origin is absent', () => {
  const engine = engineFor('||ads.example^$domain=trusted.example');
  decision(engine, true, 'https://ads.example/pixel', {
    initiatorOrigin: undefined, referrer: 'https://trusted.example/article',
  });
  decision(engine, false, 'https://ads.example/pixel', {
    initiatorOrigin: undefined, topUrl: 'https://trusted.example/article',
  });
});

test('opaque or unknown initiators never guess domain or party restrictions', () => {
  for (const condition of ['third-party', '~third-party', 'domain=news.example', 'domain=~other.example']) {
    const engine = engineFor('||ads.example^$' + condition);
    decision(engine, false, 'https://ads.example/pixel', {initiatorOrigin: undefined});
    decision(engine, false, 'https://ads.example/pixel', {
      initiatorOrigin: 'null', referrer: 'https://news.example/article',
      frameUrl: 'https://news.example/frame', topUrl: 'https://news.example',
    });
  }
  const unconditional = engineFor('||ads.example^');
  decision(unconditional, true, 'https://ads.example/pixel', {initiatorOrigin: undefined});
});

test('document exceptions allow matching documents and their descendant frames', () => {
  const engine = engineFor('||ads.example^', '@@||trusted.example^$document');
  decision(engine, false, 'https://ads.example/pixel', {initiatorOrigin: 'https://trusted.example'});
  decision(engine, false, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://embedded.example', topUrl: 'https://trusted.example/article',
  });
  decision(engine, true, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://embedded.example', topUrl: 'https://other.example/article',
  });
});

test('path-specific document exceptions use same-origin referrer or frame URL', () => {
  const engine = engineFor('||ads.example^', '@@|https://trusted.example/allowed/article|$document');
  decision(engine, false, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://trusted.example', referrer: 'https://trusted.example/allowed/article',
  });
  decision(engine, false, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://trusted.example', frameUrl: 'https://trusted.example/allowed/article',
  });
  decision(engine, true, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://trusted.example', referrer: 'https://trusted.example/other/article',
  });
  decision(engine, true, 'https://ads.example/pixel', {
    initiatorOrigin: 'https://untrusted.example', frameUrl: 'https://trusted.example/allowed/article',
  });
});

test('cosmetic exceptions do not accidentally whitelist network requests', () => {
  for (const exception of [
    '@@||ads.example^$elemhide', '@@||ads.example^$generichide',
    '@@||trusted.example^$elemhide', '@@||trusted.example^$generichide',
    'trusted.example#@#.advertising', 'trusted.example#@#+js(noop)',
  ]) {
    const engine = engineFor('||ads.example^', exception);
    decision(engine, true, 'https://ads.example/pixel', {initiatorOrigin: 'https://trusted.example'});
  }
});

test('badfilter disables an exact rule across lists regardless of order or option order', () => {
  const block = '||ads.example^$script,third-party';
  const disable = '||ads.example^$third-party,badfilter,script';
  for (const texts of [[block, disable], [disable, block], [block + '\n' + disable]]) {
    const engine = compile(texts);
    decision(engine, false, 'https://ads.example/pixel');
  }
});

test('badfilter is not a request-level allow rule and can disable exceptions', () => {
  const engine = engineFor('||ads.example^', '||ads.example^$badfilter', '/advertising/banner^');
  decision(engine, false, 'https://ads.example/pixel');
  decision(engine, true, 'https://ads.example/advertising/banner?slot=1');
  const disabledException = engineFor('||ads.example^', '@@||ads.example^$image',
    '@@||ads.example^$badfilter,image');
  decision(disabledException, true, 'https://ads.example/pixel', {resourceType: 'image'});
});

test('unsupported blocking actions and conditions never become unconditional blockers', () => {
  for (const option of [
    'redirect=noopjs', 'redirect-rule=noopjs', 'rewrite=abp-resource:blank-js',
    'csp=script-src-none', 'removeparam=tracking', 'replace=/advertising//',
    'header=content-type:image/png', 'sitekey=not-a-real-key', 'popup', 'webrtc',
    'unknown-condition', 'domain=example.*', 'domain=/example/',
  ]) {
    for (const prefix of ['', 'image,']) {
      const engine = engineFor('||ads.example^$' + prefix + option);
      decision(engine, false, 'https://ads.example/pixel', {resourceType: 'image'});
    }
  }
});

test('unsupported network-exception conditions fail open only for the matching URL pattern', () => {
  const engine = engineFor('/advertising-script.js', '/different-blocker.js',
    '@@/advertising-script.js$sitekey=unimplemented');
  decision(engine, false, 'https://cdn.example/advertising-script.js');
  decision(engine, true, 'https://cdn.example/different-blocker.js');
});

test('conservatively widened network exceptions retain their understood conditions', () => {
  const engine = engineFor('||ads.example^',
    '@@||ads.example^$image,domain=news.example,sitekey=unimplemented');
  decision(engine, false, 'https://ads.example/pixel', {resourceType: 'image'});
  decision(engine, true, 'https://ads.example/pixel', {resourceType: 'script'});
  decision(engine, true, 'https://ads.example/pixel', {
    resourceType: 'image', initiatorOrigin: 'https://other.example',
  });
  const unsupportedDomain = engineFor('||ads.example^', '@@||ads.example^$image,domain=example.*');
  decision(unsupportedDomain, false, 'https://ads.example/pixel', {resourceType: 'image'});
  decision(unsupportedDomain, true, 'https://ads.example/pixel', {resourceType: 'script'});
});

test('explicit document exceptions remain effective when paired with cosmetic modifiers', () => {
  const engine = engineFor('||ads.example^', '@@||trusted.example^$document,generichide');
  decision(engine, false, 'https://ads.example/pixel', {initiatorOrigin: 'https://trusted.example'});
  decision(engine, true, 'https://ads.example/pixel', {initiatorOrigin: 'https://other.example'});
  const cosmeticOnly = engineFor('||ads.example^', '@@||ads.example^$specifichide,domain=trusted.example');
  decision(cosmeticOnly, true, 'https://ads.example/pixel', {initiatorOrigin: 'https://trusted.example'});
});

test('cosmetic, procedural, scriptlet and raw regex syntax do not become network blockers', () => {
  for (const rule of [
    'ads.example##.advertising', 'ads.example#?#.advertising:has(a)',
    'ads.example#$#body { display: none; }', 'ads.example##+js(noop)',
    '/ads\\.example/', '/advertising/',
  ]) {
    const engine = engineFor(rule);
    decision(engine, false, 'https://ads.example/advertising/pixel');
  }
});

test('main-frame navigation, internal protocols and unknown resource types remain allowed', () => {
  const engine = engineFor('advertising', '||ads.example^');
  decision(engine, false, 'https://ads.example/advertising', {resourceType: 'mainFrame'});
  for (const url of [
    'about:advertising', 'file:///advertising', 'data:text/plain,advertising',
    'mouse://advertising', 'chrome://advertising', 'devtools://advertising',
    'blob:https://ads.example/advertising', 'ftp://ads.example/advertising',
  ]) decision(engine, false, url);
  for (const resourceType of [undefined, null, '', 'unknown', 'cspReport', 'Script']) {
    decision(engine, false, 'https://ads.example/advertising', {resourceType});
  }
});

test('real list headers, comments, BOM, CRLF and blank lines leave valid rules usable', () => {
  const engine = compile(['\ufeff[Adblock Plus 2.0]\r\n! Title: Sample rules\r\n\r\n' +
    '||ads.example^\r\n  @@||ads.example/needed.js|  \r\n']);
  decision(engine, true, 'https://ads.example/banner.js');
  decision(engine, false, 'https://ads.example/needed.js');
});

test('malformed rules are rejected as whole rules instead of broadening their scope', () => {
  for (const rule of [
    '||ads.example^$domain=', '||ads.example^$domain=~',
    '||ads.example^$domain=news.example||other.example',
    '||ads.example^$domain=news.example,domain=other.example',
    '||ads.example^$script,,image', '||ads.example^$third-party,~third-party',
    '||ads.example^$image$script', '||ads.example^$document',
    '||ads.example^ unexpected-text', '|||ads.example^',
    '||ads.example/' + 'x'.repeat(1100),
  ]) {
    assert.equal(parseRule(rule), null, rule);
    const engine = engineFor(rule);
    decision(engine, false, 'https://ads.example/pixel', {resourceType: 'image'});
  }
  for (const value of [null, undefined, {}, 7]) assert.equal(parseRule(value), null);
});

test('malformed request data does not throw or block', () => {
  const engine = engineFor('advertising', '||ads.example^');
  for (const details of [null, undefined, {}, {url: 'https://ads.example/pixel'},
    request(undefined), request(null), request({}), request('not a URL'),
    request('https://'), request('https://ads.example/' + 'a'.repeat(MAX_URL)),
  ]) assert.equal(engine.shouldBlock(details), false, JSON.stringify(details));
});

test('async and sync compilation obey independently specified decisions across multiple lists', async () => {
  const texts = [
    '! primary\n||ads.example^\n||old.example^\n||old.example^$badfilter',
    '@@||ads.example/needed.js|\n||ads.example^\nadvertising$third-party',
    '@@||trusted.example^$document',
  ];
  const expected = [
    [true, 'https://ads.example/banner.js', {}],
    [false, 'https://ads.example/needed.js', {}],
    [false, 'https://old.example/pixel', {}],
    [true, 'https://bravo.github.io/advertising', {initiatorOrigin: 'https://alpha.github.io'}],
    [false, 'https://ads.example/banner.js', {initiatorOrigin: 'https://trusted.example'}],
    [false, 'https://safe.example/content', {}],
  ];
  for (const engine of [compile(texts), await compileAsync(texts)]) {
    for (const [block, url, extra] of expected) decision(engine, block, url, extra);
  }
});

test('large async compilation yields the event loop and produces a working engine', async () => {
  const text = Array.from({length: 6000}, (_, n) => '||ads' + n + '.example^').join('\n');
  let eventLoopRan = false;
  const pending = setImmediate(() => { eventLoopRan = true; });
  try {
    const engine = await compileAsync([text]);
    assert.equal(eventLoopRan, true, 'compilation must yield before a large list is complete');
    decision(engine, true, 'https://ads5999.example/pixel');
    decision(engine, false, 'https://safe.example/pixel');
  } finally {
    clearImmediate(pending);
  }
});
