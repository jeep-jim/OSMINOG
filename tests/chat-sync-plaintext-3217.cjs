const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');

const background=read('background.js');
const bridge=read('provider-tab-bridge.js');
const presence=read('osminog-live-presence.js');

assert.match(background,/bound=!!context\?\.chat\?\.syncBindingId,prompt=bound\?String\(text\|\|""\)/);
assert.match(bridge,/dataset\.osminogChatSyncBound=syncBinding\.id/);
assert.match(presence,/if\(document\.documentElement\.dataset\.osminogChatSyncBound\)return/);

const select=(text,bound,decorate)=>bound?String(text||''):decorate(text);
assert.equal(select('чистый текст',true,()=>{throw Error('context leaked')}),'чистый текст');
assert.equal(select('task',false,text=>text+'\nOSMINOG_CONTEXT_V1'),'task\nOSMINOG_CONTEXT_V1');

console.log('OSMINOG 3.21.7 plaintext sync guard: PASS');
