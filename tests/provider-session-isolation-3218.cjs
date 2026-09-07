const assert=require('node:assert/strict');
const fs=require('node:fs');
const bg=fs.readFileSync('background.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));

assert.equal(manifest.version,'3.22.0');
assert.match(bg,/link\?\.managed&&service&&Number\(link\.tabId\)===Number\(service\.id\)/);
assert.match(bg,/Number\(tab\.windowId\)===Number\(hub\.id\)/);
assert.match(bg,/Обычный пользовательский чат нельзя назначить фоновой сессией OSMINOG/);
assert.match(bg,/OSMINOG не использует обычный пользовательский чат как фоновую сессию/);
assert.match(bg,/bcConnectProviderTab\(provider,tab\.id,\{managed:true\}\)/);
assert.doesNotMatch(bg,/await osminogRememberSession\(provider,tab\);return\{ok:true,provider,mode:/);
console.log('OSMINOG 3.21.8 provider session isolation: PASS');
