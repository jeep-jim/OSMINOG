'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {acquireFrame,permissionError}=require('./mouse-capture-policy.cjs');
const denied=()=>Object.assign(Error('localized platform error'),{nativeCode:-3801,nativeDomain:'com.apple.ScreenCaptureKit.SCStreamErrorDomain'});
function fixture(permission='granted'){
 const calls=[];return{calls,args:{permission,legacy:async()=>{calls.push('legacy');return{backend:'legacy'}},native:async()=>{calls.push('native');return{backend:'native'}},picker:async()=>{calls.push('picker');return{backend:'picker'}}}};
}
test('existing authorized screenshot path runs first, without opening picker',async()=>{const f=fixture();assert.equal((await acquireFrame(f.args)).backend,'legacy');assert.deepEqual(f.calls,['legacy']);});
test('native grant recovers stale Electron status without discarding actual pixels',async()=>{const f=fixture('denied');f.args.nativeGranted=true;assert.equal((await acquireFrame(f.args)).backend,'legacy');});
test('both stale grant paths failing lead to exactly one explicit picker',async()=>{const f=fixture();f.args.legacy=async()=>{f.calls.push('legacy');throw denied()};f.args.native=async()=>{f.calls.push('native');throw denied()};assert.equal((await acquireFrame(f.args)).backend,'picker');assert.deepEqual(f.calls,['legacy','native','picker']);});
test('denied broad permission cannot trigger silent desktop or direct native capture',async()=>{const f=fixture('denied');assert.equal((await acquireFrame(f.args)).backend,'picker');assert.deepEqual(f.calls,['picker']);});
test('explicit selection and cancellation never fall through or loop',async()=>{for(const permission of ['granted','denied']){const f=fixture(permission);f.args.choose=true;f.args.picker=async()=>{f.calls.push('picker');return null};assert.equal(await acquireFrame(f.args),null);assert.deepEqual(f.calls,['picker']);}});
test('picker errors retain native error code, do not falsely claim capture',async()=>{const f=fixture('denied');f.args.picker=async()=>{throw denied()};await assert.rejects(()=>acquireFrame(f.args),permissionError);});
test('no picker and denied permission produces a permission result, not a capture',async()=>{const f=fixture('denied');f.args.picker=null;await assert.rejects(()=>acquireFrame(f.args),permissionError);assert.equal(f.calls.length,0);});
test('native picker retains selected stream only until its first complete frame',()=>{const s=fs.readFileSync('mouse-screen-capture.mm','utf8');assert.match(s,/SCFrameStatusComplete/);assert.match(s,/self\.finished\|\|self\.gotFrame/);assert.match(s,/self.gotFrame=YES/);assert.match(s,/stopCaptureWithCompletionHandler/);assert.match(s,/capturesAudio=NO/);assert.match(s,/nativeCode/);assert.doesNotMatch(s,/tccutil|TCC\.db|spctl|sudo|CGRequestPostEventAccess/);});
test('fullscreen chrome repair scopes to standard window buttons, not Apple menu',()=>{const s=fs.readFileSync('mouse-native-menu.mm','utf8');assert.match(s,/standardWindowButton/);assert.match(s,/button.window==chrome/);assert.match(s,/chrome\.ignoresMouseEvents=YES/);assert.doesNotMatch(s,/setMenuBarVisible:NO|NSApplicationPresentationDisableForceQuit/);});
test('update artwork and resize badges are transient, accessible, and motion-aware',()=>{const css=fs.readFileSync('mouse/mouse-609.css','utf8'),hud=fs.readFileSync('mouse/resize-hud.js','utf8');assert.match(css,/#update-mouse\{[^}]*width:150px/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/pointer-events:none/);assert.match(hud,/before\.clear/);assert.match(hud,/\.remove\(\)/);assert.doesNotMatch(hud,/localStorage|sessionStorage|fetch\(/);});

test('update mascot is the exact tight owner head, with no tail or padded favicon',()=>{
 const b=require('./mouse/mouse-head.json'),s=fs.readFileSync('mouse/mouse-update.svg','utf8'),cells=[...s.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(m=>[+m[1],+m[2]]),expected=[];
 for(let y=0;y<17;y++)for(let x=0;x<19;x++)if(b.pixels[y][x]==='1')expected.push([x,y]);assert.deepEqual(cells,expected);assert.equal(cells.length,128);assert.match(s,/viewBox="0 0 19 17"/);
});
test('stale broad permission reaches the explicit picker only once',()=>{
 const host=fs.readFileSync('mouse-global-capture.cjs','utf8'),native=fs.readFileSync('mouse-screen-capture.mm','utf8');
 assert.match(host,/native:status.pickerAvailable&&status.granted/);assert.match(native,/if\(!choose&&!CGPreflightScreenCaptureAccess\(\)\)/);assert.doesNotMatch(native,/if\(choose\|\|!CGPreflight/);
});
