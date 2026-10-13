'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{proxyConfig}=require('./network.cjs');
test('network defaults to system and accepts explicit SOCKS5 / HTTP endpoints',()=>{
 assert.deepEqual(proxyConfig(),{mode:'system',server:''});assert.deepEqual(proxyConfig({mode:'fixed_servers',server:'socks5://127.0.0.1:1080'}),{mode:'fixed_servers',server:'socks5://127.0.0.1:1080'});
 assert.equal(proxyConfig({mode:'fixed_servers',server:'https://proxy.example:8443/'}).server,'https://proxy.example:8443');
 for(const server of ['file:///secret','javascript:alert(1)','http://user:pass@host','https://host/path','https://host/?key=value','bad input'])assert.throws(()=>proxyConfig({mode:'fixed_servers',server}));
 assert.throws(()=>proxyConfig({mode:'pac_script'}));
});
