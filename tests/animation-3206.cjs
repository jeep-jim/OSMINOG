const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('osminog-animation-studio.js','utf8');
assert.ok(source.includes('OSMINOGAnimationStudio'));
assert.ok(source.includes('MediaRecorder'));
assert.ok(source.includes('animationDocument'));
assert.ok(source.includes('keyframes')||source.includes('addKey'));
new vm.Script(source);
const html=fs.readFileSync('editor.html','utf8');
assert.ok(html.includes('data-workdesk="true"'));
assert.ok(html.includes('<script src="osminog-animation-studio.js">')); // Retired studio must not boot in Workdesk.
const bridge=fs.readFileSync('bridge.js','utf8');
for(const tool of ['animation_status','animation_open','animation_edit'])assert.ok(bridge.includes(tool));
console.log('animation-3206: ok');
const presence=fs.readFileSync('gpt-presence.js','utf8');
assert.ok(presence.includes('await osminogGrantFullAccess()'));
assert.ok(presence.includes('if(execution==="canvas"&&isWebAssetAction(text)&&directWebAssetSuitable(text))'));
assert.ok(presence.includes('executeDirectWebAsset(text)'));

