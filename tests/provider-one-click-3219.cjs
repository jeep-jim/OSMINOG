const assert=require('node:assert/strict');
const fs=require('node:fs');
const hub=fs.readFileSync('osminog-provider-connections.js','utf8');
const bg=fs.readFileSync('background.js','utf8');
const chat=fs.readFileSync('gpt-presence.js','utf8');
const manager=fs.readFileSync('osminog-session-manager.js','utf8');
// The embedded browser hub is retired; provider login sessions remain separately managed.
assert.match(hub,/mode:'chat-settings'/);
assert.match(hub,/OSMINOGSetAgentSettingsOpen\?\.\(true\)/);
assert.match(chat,/OSMINOGSessionManager\?\.connect\?\.\(provider\)/);
assert.match(chat,/OSMINOGSessionManager\?\.authorize\?\.\(provider\)/);
assert.match(manager,/getOrCreate\(id,\{active:false,reuse:true,allowCreate:true\}\)/);
assert.match(bg,/found=service\|\|await bcFindProviderTab\(provider\)/);
assert.match(bg,/if\(reuse!==false&&provider&&provider!=="web"\)/);
console.log('OSMINOG one-click provider connection: retained chat controls and isolated reusable session PASS');
