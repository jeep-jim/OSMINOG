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

function resizeInputHelpers(globals={}){const context={module:{exports:{}},require:id=>id==='electron'?{}:require(id),...globals};require('node:vm').runInNewContext(fs.readFileSync('mouse-609-smoke.cjs','utf8'),context,{filename:'mouse-609-smoke.cjs'});return context.module.exports;}
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};},settle=()=>new Promise(resolve=>setImmediate(resolve));
test('installed resize probe keeps methods in the renderer and returns a cloneable IPC completion',()=>{
 const vm=require('node:vm'),listeners=new Map(),cancelled=[],model={tree:{axis:'x',ratio:.5,a:{axis:'y',ratio:.5}},drag:null};
 const context=vm.createContext({MouseTest:{model},document:{body:{classList:{contains:()=>false}},querySelectorAll:()=>[],addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{assert.strictEqual(listeners.get(type),fn);listeners.delete(type);}},performance:{now:()=>1},cancelAnimationFrame:id=>cancelled.push(id)});
 const {resizeInputProbeScript}=resizeInputHelpers(),spec={axis:'y',path:'a',from:{x:125,y:306},to:{x:125,y:366}};
 const completion=vm.runInContext(resizeInputProbeScript(spec),context);
 assert.equal(structuredClone(completion),true,'Electron executeJavaScript can serialize the actual setup completion');
 assert.throws(()=>structuredClone(context.__mouse609ResizeInput),{name:'DataCloneError'},'probe methods must never cross the IPC result boundary');
 const state=structuredClone(vm.runInContext('globalThis.__mouse609ResizeInput.state()',context));assert.equal(state.axis,'y');assert.equal(state.path,'a');assert.deepEqual(state.events,[]);assert.equal(state.ratio,.5);assert.equal(listeners.size,4);
 assert.equal(structuredClone(vm.runInContext('globalThis.__mouse609ResizeInput.dispose();delete globalThis.__mouse609ResizeInput',context)),true);assert.equal(listeners.size,0);assert.equal(context.__mouse609ResizeInput,undefined);assert.deepEqual(cancelled,[0]);
});
test('HUD verification waits for delivered down, delivered move and resize frames; release is observed before completion',async()=>{
 const {observedResizeDrag}=resizeInputHelpers(),from={x:125,y:306},to={x:125,y:366},down=deferred(),move=deferred(),frames=deferred(),released=deferred(),log=[],paint={ratio:.62,badges:[{},{}]};let completed=false;
 const pending=observedResizeDrag({from,to,input:(type,p)=>log.push([type,p]),waitDown:()=>down.promise,waitMove:()=>move.promise,waitFrames:()=>frames.promise,verify:value=>{assert.strictEqual(value,paint);log.push(['verify']);},waitRelease:point=>{assert.strictEqual(point,to);log.push(['release observed']);return released.promise;}}).then(value=>{completed=true;return value;});
 await settle();assert.deepEqual(log,[['mouseMove',from],['mouseDown',from]]);
 down.resolve();await settle();assert.deepEqual(log.at(-1),['mouseMove',to]);assert.equal(log.some(row=>row[0]==='verify'),false);
 move.resolve();await settle();assert.equal(log.some(row=>row[0]==='verify'),false,'a delivered move alone is not a painted HUD');
 frames.resolve(paint);await settle();assert.deepEqual(log.slice(-3),[['verify'],['mouseUp',to],['release observed']]);assert.equal(completed,false,'the fixture cannot restore the model before actual release');released.resolve();assert.strictEqual(await pending,paint);
});
test('every failed resize phase releases its real button and preserves the first failure',async()=>{
 const {observedResizeDrag}=resizeInputHelpers(),from={x:125,y:306},to={x:125,y:366};
 for(const phase of ['down','move','frames','verify']){const failure=Error('failed '+phase),log=[],check=name=>async()=>{if(name===phase)throw failure;return{};};let released=0;
  await assert.rejects(observedResizeDrag({from,to,input:(type,p)=>log.push([type,p]),waitDown:check('down'),waitMove:check('move'),waitFrames:check('frames'),verify:check('verify'),waitRelease:async()=>{released++;}}),error=>error===failure);assert.equal(log.filter(row=>row[0]==='mouseUp').length,1);assert.deepEqual(log.at(-1),['mouseUp',phase==='down'?from:to]);assert.equal(released,1);
 }
 const first=Error('HUD missing after observed frames');await assert.rejects(observedResizeDrag({from,to,input:()=>{},waitDown:async()=>{},waitMove:async()=>{},waitFrames:async()=>({}),verify:()=>{throw first;},waitRelease:()=>{throw Error('release missing');}}),error=>error===first&&/release missing/.test(error.resizeReleaseError));
});
test('the resize receipt probe records only the matching real pointer frames and cancels its observers',()=>{
 const listeners=new Map(),queued=new Map();let next=0,now=0;const model={tree:{axis:'x',ratio:.5,a:{axis:'y',ratio:.5}},drag:{kind:'pane',axis:'y',path:'a',pointer:1}};
 const document={body:{classList:{contains:name=>name==='resizing'}},querySelectorAll:()=>[],addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{assert.strictEqual(listeners.get(type),fn);listeners.delete(type);}};
 const {installResizeInputProbe}=resizeInputHelpers({MouseTest:{model},document,performance:{now:()=>++now},requestAnimationFrame:fn=>{queued.set(++next,fn);return next;},cancelAnimationFrame:id=>queued.delete(id)}),spec={axis:'y',path:'a',from:{x:125,y:306},to:{x:125,y:366}},probe=installResizeInputProbe(spec);
 const dispatch=values=>listeners.get('pointermove')({type:'pointermove',clientX:125,clientY:366,pointerId:1,button:0,buttons:1,isTrusted:true,...values}),paint=()=>{const[id,fn]=queued.entries().next().value;queued.delete(id);fn(++now);};
 dispatch({isTrusted:false});dispatch({pointerId:2});dispatch({clientY:306});assert.equal(queued.size,0,'untrusted, foreign-pointer and unmoved input cannot arm the resize frames');
 dispatch({});assert.equal(queued.size,1);paint();assert.equal(probe.state().frames.length,1);assert.equal(probe.state().frames[0].ratio,.5);model.tree.a.ratio=.62;paint();const state=probe.state();assert.equal(state.frames.length,2);assert.equal(state.frames[1].ratio,.62);assert.equal(state.frames[1].badges.length,0,'the observer never fabricates missing HUDs');assert.ok(state.frames[1].timestamp>state.frames[0].timestamp);probe.dispose();assert.equal(listeners.size,0);assert.equal(queued.size,0);
 const unfinished=installResizeInputProbe(spec);dispatch({});assert.equal(queued.size,1);unfinished.dispose();assert.equal(queued.size,0);assert.equal(listeners.size,0);
});
