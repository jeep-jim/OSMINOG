'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{proxyConfig}=require('./network.cjs');
test('network defaults to system and accepts explicit SOCKS5 / HTTP endpoints',()=>{
 assert.deepEqual(proxyConfig(),{mode:'system',server:''});assert.deepEqual(proxyConfig({mode:'fixed_servers',server:'socks5://127.0.0.1:1080'}),{mode:'fixed_servers',server:'socks5://127.0.0.1:1080'});
 assert.equal(proxyConfig({mode:'fixed_servers',server:'https://proxy.example:8443/'}).server,'https://proxy.example:8443');
 for(const server of ['file:///secret','javascript:alert(1)','http://user:pass@host','https://host/path','https://host/?key=value','bad input'])assert.throws(()=>proxyConfig({mode:'fixed_servers',server}));
 assert.throws(()=>proxyConfig({mode:'pac_script'}));
});
test('browser compatibility keeps real Chromium and platform, removes only app tokens',()=>{const {browserUserAgent}=require('./network.cjs');assert.equal(browserUserAgent('Mozilla Windows Chrome/144.0 Electron/44.5.0 osminog-desktop/0.3.1 Safari/537.36'),'Mozilla Windows Chrome/144.0 Safari/537.36')});
test('packaged Mouse user agent removes its own product token while retaining the actual engine and platform',()=>{
 const {browserUserAgent}=require('./network.cjs');
 for(const platform of ['X11; Linux x86_64','Windows NT 10.0; Win64; x64','Macintosh; Intel Mac OS X 10_15_7']){
  const original='Mozilla/5.0 ('+platform+') AppleWebKit/537.36 (KHTML, like Gecko) MouseBrowser/6.0.38 Chrome/152.0.7936.0 Electron/44.5.0 Safari/537.36';
  const expected='Mozilla/5.0 ('+platform+') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7936.0 Safari/537.36';
  assert.equal(browserUserAgent(original),expected);assert.equal(browserUserAgent(expected),expected);
 }
 assert.equal(browserUserAgent('Mozilla/5.0 MouseBrowserHelper/1 NotMouseBrowser/2 Chrome/152.0 Safari/537.36'),'Mozilla/5.0 MouseBrowserHelper/1 NotMouseBrowser/2 Chrome/152.0 Safari/537.36');
});
