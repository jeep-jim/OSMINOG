const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
const manager=read('osminog-session-manager.js'),hub=read('osminog-browser-hub.js'),background=read('background.js'),manifest=require('../manifest.json');

assert.equal(manifest.version,'4.0.2');
assert.match(manager,/setGroup\("provider-sessions",items\)/);
assert.match(manager,/mode:"osminog-dock"/);
assert.match(manager,/onOpen:\(\)=>openSettings\(id\)/);
assert.match(hub,/focus\?\.\(id,\{external:false\}\)/);
assert.match(background,/type:"popup",width:920,height:760/);
assert.match(background,/state:"minimized",focused:false/);
assert.match(background,/osminogConnectExisting[^{]+\{provider=osminogProviderKey\(provider\);const tab=/);
assert.match(background,/return bcConnectProviderTab\(provider,tab\.id,\{managed:true\}\)/);

console.log('OSMINOG 3.21.9 provider dock: PASS');


