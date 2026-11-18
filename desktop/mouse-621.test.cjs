'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{EventEmitter}=require('node:events');
const C=require('./mouse/capture-core.js'),Z=require('./mouse-zoom.cjs'),D=require('./mouse-image-drag.cjs');
test('annotation selection is last-painted first, movement immutable and preserves all style points',()=>{const a={tool:'arrow',color:'#32c76a',width:3,points:[{x:10,y:15},{x:100,y:80}]},b={tool:'text',font:24,text:'text',points:[{x:20,y:20}]};assert.equal(C.hit([a,b],{x:22,y:22}),1);assert.equal(C.hit([a],{x:200,y:200}),-1);const n=C.translate(a,10,-1);assert.deepEqual(n.points,[{x:20,y:14},{x:110,y:79}]);assert.deepEqual(a.points,[{x:10,y:15},{x:100,y:80}]);assert.equal(n.color,a.color);assert.throws(()=>C.translate(a,NaN,0));assert.ok(C.bounds(b).height>24);});
test('editor defaults green and has reversible select/move, keyboard, and toggleable bounded palette',()=>{const s=fs.readFileSync('mouse/capture.js','utf8');for(const text of ['data-tool="move"',"setColor('#32c76a')","e.shiftKey?10:1","before:moving.before,after","if(!palette.hidden){closePalette();return;}",'render(false)','apply(change,false)','apply(change,true)'])assert.ok(s.includes(text),text);assert.doesNotMatch(s,/type="color"/);assert.match(fs.readFileSync('mouse/browsing.js','utf8'),/rows.length\+' \/ '\+total\+' · '\+names\[kind\]\(\)/);});
test('page zoom is persisted, isolated from origin defaults, and affects existing and future pages',async()=>{const handlers=new Map(),saved={},pages=[];const page=()=>{const w=new EventEmitter();w.isDestroyed=()=>false;w.setZoomFactor=v=>w.factor=v;w.setZoomMode=v=>w.mode=v;const t={view:{webContents:w}};pages.push(t);return t};const b={tabs:new Map([['a',page()]]),providers:new Map(),make(){const t=page();this.tabs.set('new'+pages.length,t);return t},dispose(){}};const z=await Z.install({browser:b,store:{get:async()=>({mouseGlobalZoom:1.25}),set:async v=>Object.assign(saved,v)},ipcMain:{handle:(n,h)=>handlers.set(n,h)},trusted:()=>{},win:{isDestroyed:()=>false,webContents:{send(){}}}});assert.equal(pages[0].view.webContents.factor,1.25);await handlers.get('mouse:zoom')({},'set',{factor:1.5});const n=b.make();assert.equal(n.view.webContents.factor,1.5);assert.equal(n.view.webContents.mode,'isolated');n.view.webContents.emit('zoom-changed',{},'in');await z.flush();assert.equal(saved.mouseGlobalZoom,1.6);assert.ok(pages.every(p=>p.view.webContents.factor===1.6));assert.throws(()=>Z.scale(NaN));assert.throws(()=>Z.scale(6));});
test('native image transfer rejects local paths, credentials, malformed data and foreign/hidden frames',()=>{for(const s of ['file:///etc/passwd','/tmp/x','https://u:p@example.test/x','javascript:alert(1)','data:text/html;base64,AAA='])assert.throws(()=>D.source(s));assert.equal(D.source('https://example.test/a.png'),'https://example.test/a.png');assert.equal(D.source('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');const frame={},wc={mainFrame:frame,isDestroyed:()=>false},t={visible:true,view:{webContents:wc}},b={tabs:new Map([['t',t]])};assert.equal(D.owned(b,{sender:wc,senderFrame:frame}),t);assert.equal(D.owned(b,{sender:wc,senderFrame:{}}),null);t.visible=false;assert.equal(D.owned(b,{sender:wc,senderFrame:frame}),null);});
test('image drag keeps its gesture guards and the sole page bridge reports only scoped progress',async()=>{
 const p=fs.readFileSync('mouse-page-preload.cjs','utf8'),h=fs.readFileSync('mouse-image-drag.cjs','utf8'),bridges=[],calls=[],listeners=[];
 const electron={contextBridge:{exposeInMainWorld:(name,api)=>bridges.push({name,api})},ipcRenderer:{invoke:async(channel,args)=>{calls.push({channel,args:structuredClone(args)});return{accepted:true};}}};
 require('node:vm').runInNewContext(p,{process:{isMainFrame:true},require(name){assert.equal(name,'electron');return electron;},document:{addEventListener:(name,callback,capture)=>listeners.push({name,callback,capture})}},{timeout:1000});
 assert.deepEqual(bridges.map(b=>b.name),['MouseAgent']);const api=bridges[0].api;assert.deepEqual(Object.keys(api),['updateProgress']);assert.equal(Object.isFrozen(api),true);
 assert.deepEqual(await api.updateProgress(37,'Building',{taskId:'my-task',sourceId:'foreign-page',desk:'desk-1',command:'ignored',percent:99}),{accepted:true});assert.deepEqual(calls,[{channel:'mouse:page-progress',args:{percent:37,statusText:'Building',taskId:'my-task'}}]);
 assert.deepEqual(listeners.map(l=>[l.name,l.capture]),[['dragstart',true]]);assert.equal(typeof listeners[0].callback,'function');assert.match(p,/event.isTrusted/);assert.doesNotMatch(p,/ethereum|wallet|executeJavaScript|eval\(/);
 assert.match(h,/native.primaryDown/);assert.match(h,/page.navigationEpoch===epoch/);assert.match(h,/getBrowser\(\)===browser/);assert.match(h,/0o600/);assert.match(h,/generation\+\+/);assert.match(h,/AbortSignal.timeout\(5000\)/);
});
test('status notification lives outside footer and expires without resetting on repeated same error',()=>{const s=fs.readFileSync('mouse/feedback.js','utf8'),css=fs.readFileSync('mouse/mouse-621.css','utf8');assert.match(s,/document.body.append\(node\)/);assert.match(s,/timer=setTimeout\(hide,4500\)/);assert.match(s,/now<until&&!node.hidden/);assert.match(css,/body>#status\{position:fixed/);assert.match(css,/left:50%/);assert.match(css,/pointer-events:none/);});
function slideFixture(delay=0,options={}){
 const vm=require('node:vm'),code=fs.readFileSync('mouse/desktop-slide.js','utf8'),events=[],listeners=new Map();let time=0,cleared;
 const ctx={module:{exports:{}},performance:{now:()=>time},matchMedia:()=>({matches:!!options.reduced}),addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 vm.runInNewContext(code,ctx);const S=ctx.module.exports,w={style:{transform:'',visibility:''},dataset:{},inert:false},model={desktopId:'old'},scene={ids:()=>[model.desktopId],valid:()=>true,stage:async(kind,packet)=>{events.push('decoded:'+kind);return packet.complete;},show:()=>events.push('show-old'),animate:async()=>{events.push('animate-start');time+=S.DURATION;events.push('animate-end');return true;},timing:()=>({animationDurationMs:S.DURATION}),cancel:()=>events.push('cancel'),remove:()=>events.push('remove')};
 const N={test:true,onPreviewsCleared:fn=>{cleared=fn;return()=>{cleared=null;}},desktops:async(action,args)=>{
  if(action==='surfaces'){events.push('capture:'+model.desktopId);if(options.cancelIncoming&&model.desktopId==='new')cleared();return{token:'capture-token',complete:!(options.incomplete&&model.desktopId==='old')};}
  events.push(args.phase);if(args.phase==='begin'){assert.ok(events.includes('decoded:outgoing'));assert.equal(w.style.visibility,'');return{held:options.begin!==false,token:'capture-token'};}
  assert.equal(w.style.visibility,'');return{released:true};
 }};
 const run=()=>S.run({workspace:w,model,N,sceneFactory:()=>scene,direction:options.direction||1,layout:async()=>{events.push('layout');time+=delay;},change:async()=>{events.push('change');if(options.fail)throw Error('fixture failure');model.desktopId='new';}});
 return{S,w,model,N,events,listeners,run,clock:()=>time,hasCleared:()=>!!cleared};
}
test('desktop transition decodes before hold and restores input, native surfaces and listeners on every outcome',async()=>{
 for(const options of [{},{fail:true},{incomplete:true},{begin:false},{cancelIncoming:true},{reduced:true}]){
  const f=slideFixture(0,options);if(options.fail)await assert.rejects(f.run(),/fixture failure/);else await f.run();
  assert.equal(f.events.filter(x=>x==='change').length,1);assert.equal(f.w.style.transform,'');assert.equal(f.w.style.visibility,'');assert.equal(f.w.inert,false);assert.equal(!!f.model.desktopSliding,false);assert.equal(f.w.dataset.sliding,undefined);assert.equal(f.listeners.size,0);assert.equal(f.hasCleared(),false);
  if(!options.reduced&&!options.incomplete&&options.begin!==false)assert.ok(f.events.includes('end'),'owned hold is released even when change or capture is cancelled');
  if(options.incomplete||options.begin===false||options.cancelIncoming||options.reduced)assert.ok(!f.events.includes('animate-start'));
 }
 const f=slideFixture();await f.run();assert.deepEqual(f.events,['capture:old','decoded:outgoing','show-old','begin','change','layout','capture:new','decoded:incoming','animate-start','animate-end','end','remove','layout']);assert.equal(f.S.last.decoded,true);assert.equal(f.S.last.animated,true);
 assert.equal(f.S.ease(0),0);assert.equal(f.S.ease(.5),.5);assert.equal(f.S.ease(1),1);
});
test('owner final top plus and centered bottom burrow keep distinct actions',()=>{
 const css=fs.readFileSync('mouse/mouse-621.css','utf8'),ui=fs.readFileSync('mouse/desktops.js','utf8');assert.match(css,/#statusbar #desktops-button\{top:auto;bottom:0;width:36px;height:23px;min-width:36px;min-height:23px/);assert.match(css,/#statusbar\{position:relative;z-index:8;overflow:visible\}/);assert.match(css,/\.toolbar>#new-tab\{[^}]*width:28px;height:28px/);assert.match(css,/\.toolbar>#new-tab::before\{display:none!important\}/);assert.match(ui,/button.onclick=open/);assert.match(fs.readFileSync('mouse/browser.js','utf8'),/name==='new-tab'\)return openPage\('mouse:\/\/start'\)/);
});
test('250ms native acknowledgements cannot stretch the shared compositor timeline or add per-frame layout calls',async()=>{
 for(const direction of [-1,1])for(const delay of [0,250]){
  const f=slideFixture(delay,{direction});await f.run();
  assert.equal(f.events.filter(x=>x==='layout').length,2);assert.equal(f.S.last.layoutCalls,2);assert.equal(f.S.last.animationDurationMs,330);
  assert.equal(f.S.last.totalDurationMs,330+2*delay);assert.equal(f.clock(),330+2*delay);
  const start=f.events.indexOf('animate-start'),end=f.events.indexOf('animate-end');assert.deepEqual(f.events.slice(start+1,end),[],'there is no native IPC inside the animation interval');
  assert.equal(f.w.style.transform,'');assert.equal(f.S.last.direction,direction);
 }
});

require('./mouse-floating-overlay.test.cjs');
