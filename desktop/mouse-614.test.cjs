 'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('mouse/browser.js','utf8'),L=require('./mouse/layout.js'),MouseTabOrder=require('./mouse/mouse-613-ui.js');
const clone=value=>structuredClone(value),flush=()=>new Promise(resolve=>setImmediate(resolve));
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Production renderer section exists: '+start);return source.slice(a,b);}
const closeActions=[
 section(' let arrangement,','\n const resizeHUD'),
 section(' const tab=id=>','\n const feedback='),
 section(' const prefs=','\n function selected'),
 section(' function reconcile(','\n function setActive'),
 section(' function acceptDesktopResult(','\n async function removePane'),
 section(' function restorePane(','\n async function togglePaneFullscreen'),
 section(' async function action(','\n document.querySelectorAll(\'[data-action]\')')
].join('\n');
function closeFixture(){
 let now=0,sequence=0,resolveResponse;const timers=new Map(),delays=[],native={windowed:false,destroyed:false},requests=[],renders=[],layouts=[];
 const setTimeout=(fn,ms)=>{const id=++sequence;timers.set(id,{fn,at:now+ms});delays.push(ms);return id;},clearTimeout=id=>timers.delete(id);
 const time={async advance(ms){const end=now+ms;for(;;){await flush();const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();}now=end;await flush();}};
 const id='selected-ai',pages=[{id:'main',lane:'main'},{id:'other-ai',lane:'side'},{id,lane:'side'}],browser={tabs:new Map(pages.map(p=>[p.id,p]))},webContents={isDestroyed:()=>native.destroyed};
 const initial={desktopId:'desk-3',tree:L.preset(1),slots:{p1:'main'},active:'p1',tabOrder:pages.map(p=>p.id),aiOpen:true,aiId:id,aiWidth:389,aiSessions:{'https://other.test/':'other-ai','https://selected.test/':id}};
 // Transport fixtures describe a delayed, already persisted close result. The
 // renderer actions and their acceptance/reconciliation below are production code.
 const result={state:{tabs:clone(pages.filter(p=>p.id!==id))},preferences:{...clone(initial),tabOrder:['main','other-ai'],aiOpen:false,aiId:'',aiSessions:{'https://other.test/':'other-ai'}}};
 const response=new Promise(resolve=>resolveResponse=resolve);
 const N={window:async command=>{assert.equal(command,'pane-restore');native.windowed=true;},desktops:async(command,args)=>{assert.equal(command,'close-tab');assert.equal(args.id,id);assert.equal(args.afterClosePreferences.aiOpen,false);requests.push(clone(args));browser.tabs.delete(id);native.destroyed=true;return response;},save:async()=>{throw Error('Unexpected renderer normalization write');},browser:async()=>{throw Error('Unexpected renderer browser command');}};
 const ctx=vm.createContext({N,L,MouseTabOrder,structuredClone,setTimeout,clearTimeout,requestLayout:()=>layouts.push('layout'),renderTree:()=>renders.push('tree'),renderTabs:()=>renders.push('tabs'),syncPaneLabels:()=>renders.push('labels'),renderAISites:()=>renders.push('ai'),applySide:()=>renders.push('side')});
 vm.runInContext(closeActions+'\nglobalThis.api={m,action};globalThis.MouseTest={model:m};',ctx,{filename:'mouse/browser.js close action fixture',timeout:1000});
 Object.assign(ctx.api.m,clone(initial),{ready:true,switching:false,focusAI:true,state:{tabs:clone(pages)}});
 const module={exports:{}};vm.runInNewContext(fs.readFileSync('mouse-614-smoke.cjs','utf8'),{module,exports:module.exports,require,setTimeout,clearTimeout},{filename:'mouse-614-smoke.cjs'});
 const js=async text=>vm.runInContext(text,ctx),windowed=()=>native.windowed;
 return{...ctx.api,browser,webContents,native,requests,renders,layouts,time,delays,id,windowed,js,respond:()=>resolveResponse(clone(result)),wait:()=>module.exports.waitForAIClosed({js,windowed,browser,id,webContents})};
}
test('AI fullscreen replaces only duplicate header plus, custom provider remains available',()=>{
 const h=fs.readFileSync('mouse/index.html','utf8'),head=h.match(/<div class="ai-controls">(.*?)<div id="ai-slot">/s)[1];
 assert.equal((head.match(/data-action="ai-fullscreen"/g)||[]).length,1);assert.doesNotMatch(head,/data-action="ai-settings"/);assert.match(h,/data-action="ai-settings">Добавить ссылку/);
 const ui=fs.readFileSync('mouse/browser.js','utf8');assert.match(ui,/custom\.value='custom'/);assert.match(ui,/if\(name==='ai-fullscreen'\)return toggleAIFullscreen/);
});
test('AI focus is transient and reuses native fullscreen ownership without navigation',()=>{
 const ui=fs.readFileSync('mouse/browser.js','utf8'),prefs=ui.slice(ui.indexOf('const prefs='),ui.indexOf('function save'));
 assert.doesNotMatch(prefs,/focusAI|focusPane/);
 const enter=ui.slice(ui.indexOf('async function toggleAIFullscreen'),ui.indexOf('async function openPage'));
 assert.match(enter,/N\.window\('pane-fullscreen'\)/);assert.match(enter,/N\.window\('pane-restore'\)/);assert.doesNotMatch(enter,/navigate|reload|m\.tree=|m\.slots=|m\.aiWidth=|loadURL/);
 assert.match(ui,/if\(!m\.focusPane&&!m\.focusAI\)return;m\.focusPane='';m\.focusAI=false/);
 assert.match(ui,/e\.key==='Escape'&&\(m\.focusPane\|\|m\.focusAI\)/);
 assert.match(ui,/for\(const pane of m\.focusAI\?\[\]:document\.querySelectorAll/);
 assert.match(fs.readFileSync('mouse/mouse-614.css','utf8'),/body\.ai-focused #stage/);
});
test('AI close smoke waits for the real renderer transaction after native removal',async()=>{
 const f=closeFixture(),original=clone({tree:f.m.tree,slots:f.m.slots,active:f.m.active,aiWidth:f.m.aiWidth});const closing=f.action('close-ai');await flush();
 assert.equal(f.windowed()&&!f.m.focusAI&&!f.browser.tabs.has(f.id),true,'The previous predicate passes before the IPC result arrives');assert.equal(f.webContents.isDestroyed(),true);assert.equal(f.m.aiOpen,true);assert.equal(f.m.switching,true);assert.equal(f.requests.length,1);
 let settled=false;const waiting=f.wait().then(()=>{settled=true;});await f.time.advance(180);assert.equal(settled,false,'Native tab removal must not substitute for renderer completion');
 f.respond();await closing;assert.equal(f.m.aiOpen,false);assert.equal(f.m.focusAI,false);assert.equal(f.m.switching,false);await f.time.advance(60);await waiting;
 assert.deepEqual(clone({tree:f.m.tree,slots:f.m.slots,active:f.m.active,aiWidth:f.m.aiWidth}),original);assert.ok(f.browser.tabs.has('other-ai'));assert.ok(f.m.state.tabs.some(t=>t.id==='other-ai'));assert.ok(!f.m.state.tabs.some(t=>t.id===f.id));assert.deepEqual(f.renders,['tree','side','tabs','labels','ai','side']);assert.deepEqual(f.layouts,['layout']);
});
test('AI close smoke retains native window and WebContents completion in the full contract',async()=>{
 for(const pending of ['windowed','destroyed']){
  const f=closeFixture(),closing=f.action('close-ai');await flush();f.native[pending]=false;f.respond();await closing;assert.equal(f.m.aiOpen,false);assert.equal(f.m.switching,false);
  let settled=false;const waiting=f.wait().then(()=>{settled=true;});await f.time.advance(120);assert.equal(settled,false,pending+' must complete too');f.native[pending]=true;await f.time.advance(60);await waiting;
 }
});
test('AI close smoke still times out within240×60ms when the renderer IPC response never arrives',async()=>{
 const f=closeFixture();void f.action('close-ai');await flush();assert.equal(f.browser.tabs.has(f.id),false);assert.equal(f.webContents.isDestroyed(),true);assert.equal(f.m.aiOpen,true);assert.equal(f.m.switching,true);
 const rejected=assert.rejects(f.wait(),/Mouse614 timeout: close destroys AI and returns layout/);await f.time.advance(14399);assert.equal(f.m.aiOpen,true);await f.time.advance(1);await rejected;
 assert.equal(f.delays.length,240);assert.ok(f.delays.every(ms=>ms===60));assert.equal(f.m.switching,true);assert.ok(f.browser.tabs.has('other-ai'));
});

const {available}=require('./mouse/mouse-update-badge.js'),{UpdateWatch}=require('./mouse-update-watch.cjs');
test('green indicator requires a validated strictly newer version, persists through download errors, clears on current',()=>{
 for(const s of [{},{phase:'error'},{phase:'available',latestVersion:'6.0.15'},{availableVersion:'6.0.14'},{availableVersion:'6.0.9'},{availableVersion:'bad'}])assert.equal(available('6.0.14',s),false);
 for(const phase of ['available','downloading','ready','opened','installing','error','checking'])assert.equal(available('6.0.14',{phase,availableVersion:'6.0.15'}),true);
});
test('automatic update watcher checks metadata only in ordinary mode and stops cleanly',async()=>{
 let scheduled=[],calls=[],normal=false;const clock={setTimeout(fn,ms){const t={fn,ms};scheduled.push(t);return t},clearTimeout(t){scheduled=scheduled.filter(x=>x!==t)}};const updates={task:null,state:{phase:'idle'},async run(action){calls.push(action)}};
 const w=new UpdateWatch({updates,canCheck:()=>normal,clock});w.start();w.start();assert.equal(scheduled.length,1);assert.equal(scheduled[0].ms,1800);
 await w.tick();assert.deepEqual(calls,[]);normal=true;await w.tick();assert.deepEqual(calls,['check']);updates.state.phase='ready';await w.tick();assert.deepEqual(calls,['check']);w.stop();await w.tick();assert.deepEqual(calls,['check']);
});
test('burrow remains the same accessible new-tab action without changing mascot assets',()=>{const h=fs.readFileSync('mouse/index.html','utf8');assert.match(h,/id="new-tab" data-action="new-tab"[^>]*aria-label="Новая вкладка"><svg class="burrow-plus"/);assert.match(h,/viewBox="0 0 20 20"/);assert.match(h,/class="burrow-plus"/);});

test('private Escape is attached to owned workspace pages without relying on reparented window lookup',()=>{const main=fs.readFileSync('mouse-main.cjs','utf8'),p=fs.readFileSync('mouse-private.cjs','utf8');assert.match(main,/globalCapture,paneFocus,test/);assert.match(p,/const makePrivate=browser.make.bind\(browser\)/);assert.match(p,/this.paneFocus\?\.active/);assert.match(p,/event.preventDefault\(\);this.paneFocus.leave\(\)/);});
