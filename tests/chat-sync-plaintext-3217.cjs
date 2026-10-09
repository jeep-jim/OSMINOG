'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
const background=read('background.js'),tab=read('provider-tab-bridge.js'),presence=read('osminog-live-presence.js'),panel=read('gpt-presence.js');
// Explicit native sync is still a plaintext channel. The internal agent must not
// auto-bind that channel and thereby lose the board/tool protocol.
assert.match(tab,/dataset\.osminogChatSyncBound=syncBinding\.id/);
assert.match(presence,/if\(document\.documentElement\.dataset\.osminogChatSyncBound\)return/);
const bind=panel.slice(panel.indexOf('async function ensureThreadSync('),panel.indexOf('async function refreshNativeCanvas('));
assert.doesNotMatch(bind,/type:\s*['"]BC_CHAT_SYNC_BIND['"]/);
assert.match(bind,/delete ctx\.chat\.syncBindingId/);
assert.match(background,/const prompt=bcDecoratePrompt\(toolResult\?bcToolPrompt/);
assert.match(tab,/if\(isGpt\(\)&&!syncBinding&&!managedAgentSession\)/);
assert.match(tab,/Only extension background may configure managed execution/);
console.log('PASS explicit plaintext sync separated from managed agent context/tools');
