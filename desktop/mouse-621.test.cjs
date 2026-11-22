'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{EventEmitter}=require('node:events');
const C=require('./mouse/capture-core.js'),Z=require('./mouse-zoom.cjs'),D=require('./mouse-image-drag.cjs');
function visibleTransitionFixture({stale=1,scrollPainted=true,visible=true,hideDuringCapture=false,resizeDuringCapture=false}={}){
 const vm=require('node:vm'),writes=new Map(),scripts=[],module={exports:{}},box={x:0,y:68,width:64,height:64};let captures=0,restored=false;
 const wc={id:17,isDestroyed:()=>false,getURL:()=> 'http://127.0.0.1/one',executeJavaScript:async code=>{new vm.Script(code);scripts.push(code);if(code.startsWith('({minHeight:'))return{minHeight:'',scrollX:0,scrollY:0};if(code.startsWith('new Promise'))return{timeOrigin:100,at:20,rafs:[10,20],width:64,height:64,scrollX:0,scrollY:137,band:{x:0,y:0,width:64,height:8,color:'rgb(199, 37, 77)'},scrollProbe:{x:32,y:40,hit:true,color:'rgb(207, 229, 208)'}};if(code.startsWith('document.getElementById'))restored=true;},capturePage:async(rect,options)=>{assert.equal(rect,undefined);assert.equal(options.stayHidden,true);assert.equal(options.stayAwake,false);captures++;if(hideDuringCapture)page.visible=false;if(resizeDuringCapture)box.width++;const pixels=Buffer.alloc(64*64*4,255);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const rgb=captures>stale&&y<8?[199,37,77]:scrollPainted&&x===32&&y===40?[207,229,208]:[240,240,240],i=(y*64+x)*4;pixels[i]=rgb[2];pixels[i+1]=rgb[1];pixels[i+2]=rgb[0];}return{getScaleFactors:()=>[1],getSize:()=>({width:64,height:64}),toBitmap:()=>pixels,toPNG:()=>Buffer.from('native-fixture-png')};}};
 const page={visible,navigationEpoch:3,bounds:{x:0,y:68,width:64,height:64},view:{webContents:wc,getVisible:()=>visible,getBounds:()=>({...box})}},browser={get:()=>page,mouseSurfaceHold:null,mouseDesktops:{bank:{active:'desk-3'}}};
 vm.runInNewContext(fs.readFileSync('mouse-627-desktop-transition-smoke.cjs','utf8'),{module,require:name=>name==='electron'?{nativeImage:{}}:name==='node:fs/promises'?{writeFile:async(name,data)=>writes.set(name,data)}:require(name),performance,Buffer,setTimeout,clearTimeout});
 return{run:()=>module.exports.prepareVisiblePage({browser,id:'page-a',index:0}),writes,scripts,captures:()=>captures,restored:()=>restored};
}
test('transition fixture waits for real native band pixels while visible and retains its original restore state',async()=>{
 const f=visibleTransitionFixture(),row=await f.run();assert.equal(f.captures(),2);assert.equal(row.ready,true);assert.deepEqual(JSON.parse(JSON.stringify(row.original)),{minHeight:'',scrollX:0,scrollY:0});assert.equal(row.native.selectedDesktop,'desk-3');assert.equal(row.native.nativeVisible,true);assert.equal(row.native.webContentsId,17);assert.equal(row.attempts[0].band.count,0);assert.equal(row.attempts[1].band.count,64);assert.equal(row.attempts[1].scrollProbe.painted,true);assert.equal(f.restored(),false);assert.ok(f.writes.has(row.filename));assert.equal(JSON.parse(f.writes.get('mouse-627-desktop-transition-preparation-0.json')).ready,true);
});
test('correct DOM marker cannot bless a stale native frame and bounded preparation restores the fixture',async()=>{
 const f=visibleTransitionFixture({stale:Infinity});await assert.rejects(f.run(),/must paint its band and scrolled content/);assert.equal(f.captures(),8);assert.equal(f.restored(),true);const proof=JSON.parse(f.writes.get('mouse-627-desktop-transition-preparation-0.json'));assert.equal(proof.ready,false);assert.ok(proof.attempts.every(row=>row.dom.band.color==='rgb(199, 37, 77)'&&row.band.count===0));assert.ok(f.writes.has(proof.filename));
});
test('a painted fixed band cannot conceal stale scroll pixels in transition preparation',async()=>{
 const f=visibleTransitionFixture({stale:0,scrollPainted:false});await assert.rejects(f.run(),/must paint its band and scrolled content/);assert.equal(f.captures(),8);const proof=JSON.parse(f.writes.get('mouse-627-desktop-transition-preparation-0.json'));assert.ok(proof.attempts.every(row=>row.band.count>=row.band.minimum&&!row.scrollProbe.painted));assert.equal(f.restored(),true);
});
test('transition preparation rejects hidden pages and identity or viewport changes during readback',async()=>{
 const hidden=visibleTransitionFixture({visible:false});await assert.rejects(hidden.run());assert.equal(hidden.captures(),0);assert.equal(hidden.scripts.length,0);
 for(const option of [{hideDuringCapture:true},{resizeDuringCapture:true}]){const f=visibleTransitionFixture({stale:0,...option});await assert.rejects(f.run(),/identity and visibility/);assert.equal(f.captures(),1);assert.equal(f.restored(),true);}
});
test('annotation selection is last-painted first, movement immutable and preserves all style points',()=>{const a={tool:'arrow',color:'#32c76a',width:3,points:[{x:10,y:15},{x:100,y:80}]},b={tool:'text',font:24,text:'text',points:[{x:20,y:20}]};assert.equal(C.hit([a,b],{x:22,y:22}),1);assert.equal(C.hit([a],{x:200,y:200}),-1);const n=C.translate(a,10,-1);assert.deepEqual(n.points,[{x:20,y:14},{x:110,y:79}]);assert.deepEqual(a.points,[{x:10,y:15},{x:100,y:80}]);assert.equal(n.color,a.color);assert.throws(()=>C.translate(a,NaN,0));assert.ok(C.bounds(b).height>24);});
test('editor defaults green and has reversible select/move, keyboard, and toggleable bounded palette',()=>{const s=fs.readFileSync('mouse/capture.js','utf8');for(const text of ['data-tool="move"',"setColor('#32c76a')","e.shiftKey?10:1","before:moving.before,after","if(!palette.hidden){closePalette();return;}",'render(false)','apply(change,false)','apply(change,true)'])assert.ok(s.includes(text),text);assert.doesNotMatch(s,/type="color"/);assert.match(fs.readFileSync('mouse/browsing.js','utf8'),/rows.length\+' \/ '\+total\+' · '\+names\[kind\]\(\)/);});
test('page zoom is persisted, isolated from origin defaults, and affects existing and future pages',async()=>{const handlers=new Map(),saved={},pages=[];const page=()=>{const w=new EventEmitter();w.isDestroyed=()=>false;w.setZoomFactor=v=>w.factor=v;w.setZoomMode=v=>w.mode=v;const t={view:{webContents:w}};pages.push(t);return t};const b={tabs:new Map([['a',page()]]),providers:new Map(),make(){const t=page();this.tabs.set('new'+pages.length,t);return t},dispose(){}};const z=await Z.install({browser:b,store:{get:async()=>({mouseGlobalZoom:1.25}),set:async v=>Object.assign(saved,v)},ipcMain:{handle:(n,h)=>handlers.set(n,h)},trusted:()=>{},win:{isDestroyed:()=>false,webContents:{send(){}}}});assert.equal(pages[0].view.webContents.factor,1.25);await handlers.get('mouse:zoom')({},'set',{factor:1.5});const n=b.make();assert.equal(n.view.webContents.factor,1.5);assert.equal(n.view.webContents.mode,'isolated');n.view.webContents.emit('zoom-changed',{},'in');await z.flush();assert.equal(saved.mouseGlobalZoom,1.6);assert.ok(pages.every(p=>p.view.webContents.factor===1.6));assert.throws(()=>Z.scale(NaN));assert.throws(()=>Z.scale(6));});
test('native image transfer rejects local paths, credentials, malformed data and foreign/hidden frames',()=>{for(const s of ['file:///etc/passwd','/tmp/x','https://u:p@example.test/x','javascript:alert(1)','data:text/html;base64,AAA='])assert.throws(()=>D.source(s));assert.equal(D.source('https://example.test/a.png'),'https://example.test/a.png');assert.equal(D.source('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');const frame={},wc={mainFrame:frame,isDestroyed:()=>false},t={visible:true,view:{webContents:wc}},b={tabs:new Map([['t',t]])};assert.equal(D.owned(b,{sender:wc,senderFrame:frame}),t);assert.equal(D.owned(b,{sender:wc,senderFrame:{}}),null);t.visible=false;assert.equal(D.owned(b,{sender:wc,senderFrame:frame}),null);});
test('image drag keeps its gesture guards and the browser task API reports only scoped progress',async()=>{
 const p=fs.readFileSync('mouse-page-preload.cjs','utf8'),h=fs.readFileSync('mouse-image-drag.cjs','utf8'),bridges=[],calls=[],listeners=[];
 const electron={contextBridge:{exposeInMainWorld:(name,api)=>bridges.push({name,api})},ipcRenderer:{invoke:async(channel,args)=>{calls.push({channel,args:structuredClone(args)});return channel==='mouse:page-progress-context'?{documentToken:'owned-document'}:{accepted:true};}}};
 require('node:vm').runInNewContext(p,{process:{isMainFrame:true},require(name){assert.equal(name,'electron');return electron;},document:{addEventListener:(name,callback,capture)=>listeners.push({name,callback,capture})}},{timeout:1000});
 assert.deepEqual(bridges.map(b=>b.name),['browser']);const api=bridges[0].api;assert.deepEqual(Object.keys(api),['setProgress']);assert.equal(Object.isFrozen(api),true);
 assert.deepEqual(await api.setProgress(37,'Building',{taskId:'my-task',etaSeconds:45,sourceId:'foreign-page',desk:'desk-1',command:'ignored',percent:99}),{accepted:true});assert.deepEqual(calls,[{channel:'mouse:page-progress-context',args:undefined},{channel:'mouse:page-progress',args:{percent:37,statusText:'Building',taskId:'my-task',phase:undefined,etaSeconds:45,documentToken:'owned-document'}}]);
 assert.deepEqual(listeners.map(l=>[l.name,l.capture]),[['dragstart',true]]);assert.equal(typeof listeners[0].callback,'function');assert.match(p,/event.isTrusted/);assert.doesNotMatch(p,/ethereum|wallet|executeJavaScript|eval\(/);
 assert.match(h,/native.primaryDown/);assert.match(h,/page.navigationEpoch===epoch/);assert.match(h,/getBrowser\(\)===browser/);assert.match(h,/0o600/);assert.match(h,/generation\+\+/);assert.match(h,/AbortSignal.timeout\(5000\)/);
});
test('status notification lives outside footer and expires without resetting on repeated same error',()=>{const s=fs.readFileSync('mouse/feedback.js','utf8'),css=fs.readFileSync('mouse/mouse-621.css','utf8');assert.match(s,/document.body.append\(node\)/);assert.match(s,/timer=setTimeout\(hide,4500\)/);assert.match(s,/now<until&&!node.hidden/);assert.match(css,/body>#status\{position:fixed/);assert.match(css,/left:50%/);assert.match(css,/pointer-events:none/);});
function slideFixture(delay=0,options={}){
 const vm=require('node:vm'),code=fs.readFileSync('mouse/desktop-slide.js','utf8'),events=[],listeners=new Map(),frames=new Map(),timers=new Map();let time=0,cleared,task=0;
 const ctx={module:{exports:{}},performance:{now:()=>time},matchMedia:()=>({matches:!!options.reduced}),addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 if(options.manualFrames)Object.assign(ctx,{requestAnimationFrame:fn=>{const id=++task;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{const id=++task;timers.set(id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInNewContext(code,ctx);const S=ctx.module.exports,w={style:{transform:'',visibility:''},dataset:{},inert:false},model={desktopId:'old'},scene={ids:()=>[model.desktopId],valid:()=>true,stage:async(kind,packet)=>{events.push('decoded:'+kind);return packet.complete;},show:()=>events.push('show-old'),animate:async()=>{events.push('animate-start');time+=S.DURATION;events.push('animate-end');return true;},timing:()=>({animationDurationMs:S.DURATION}),cancel:()=>events.push('cancel'),remove:()=>events.push('remove')};
 const N={test:true,onPreviewsCleared:fn=>{cleared=fn;return()=>{cleared=null;}},desktops:async(action,args)=>{
  if(action==='surfaces'){events.push('capture:'+model.desktopId);if(options.cancelIncoming&&model.desktopId==='new')cleared();return{token:'capture-token',complete:!(options.incomplete&&model.desktopId==='old')};}
  events.push(args.phase);if(args.phase==='begin'){assert.ok(events.includes('decoded:outgoing'));assert.equal(w.style.visibility,'');return{held:options.begin!==false,token:'capture-token'};}
  assert.equal(w.style.visibility,'');return{released:true};
 }};
 const run=()=>S.run({workspace:w,model,N,sceneFactory:()=>scene,direction:options.direction||1,layout:async()=>{events.push('layout');time+=delay;},change:async()=>{events.push('change');if(options.fail)throw Error('fixture failure');model.desktopId='new';}});
 const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
 const paint=async()=>{time+=16;for(const [id,fn]of [...frames])if(frames.delete(id))fn(time);await flush();};
 const elapse=async ms=>{time+=ms;for(const [id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}await flush();};
 return{S,w,model,N,events,listeners,run,clock:()=>time,hasCleared:()=>!!cleared,flush,paint,elapse,pendingFrames:()=>frames.size,pendingTimers:()=>timers.size};
}
test('ordinary desktop selection uses live views without decoding or holding surfaces and always restores input',async()=>{
 for(const options of [{},{fail:true},{incomplete:true},{begin:false},{cancelIncoming:true},{reduced:true}]){
  const f=slideFixture(0,options),error=options.fail?/fixture failure/:null;
  if(error)await assert.rejects(f.run(),error);else await f.run();
  assert.deepEqual(f.events,options.fail?['change']:['change','layout'],'A normal switch never invokes native capture, holds or a compositor scene');assert.equal(f.w.style.transform,'');assert.equal(f.w.style.visibility,'');assert.equal(f.w.inert,false);assert.equal(!!f.model.desktopSliding,false);assert.equal(f.w.dataset.sliding,undefined);assert.equal(f.listeners.size,0);assert.equal(f.hasCleared(),false);
  assert.equal(f.S.last.strategy,'live');assert.equal(f.S.last.snapshotCaptures,0);assert.equal(f.S.last.phase,options.fail?'failed':'complete');
 }
 const f=slideFixture();await f.run();assert.equal(f.S.last.decoded,false);assert.equal(f.S.last.animated,false);assert.equal(f.S.last.presented,true);
 assert.equal(f.S.ease(0),0);assert.equal(f.S.ease(.5),.5);assert.equal(f.S.ease(1),1);
});
test('owner final top plus and centered bottom burrow keep distinct actions',()=>{
 const css=fs.readFileSync('mouse/mouse-621.css','utf8'),ui=fs.readFileSync('mouse/desktops.js','utf8');assert.match(css,/#statusbar #desktops-button\{top:auto;bottom:0;width:36px;height:23px;min-width:36px;min-height:23px/);assert.match(css,/#statusbar\{position:relative;z-index:8;overflow:visible\}/);assert.match(css,/\.toolbar>#new-tab\{[^}]*width:28px;height:28px/);assert.match(css,/\.toolbar>#new-tab::before\{display:none!important\}/);assert.match(ui,/button.onclick=open/);assert.match(fs.readFileSync('mouse/browser.js','utf8'),/name==='new-tab'\)return openPage\('mouse:\/\/start'\)/);
});
test('ordinary switching waits for one native acknowledgement without a fixed animation or per-frame layout calls',async()=>{
 for(const direction of [-1,1])for(const delay of [0,250]){
  const f=slideFixture(delay,{direction});await f.run();
  assert.equal(f.events.filter(x=>x==='layout').length,1);assert.equal(f.S.last.layoutCalls,1);assert.equal(f.S.last.animationDurationMs,undefined);
  assert.equal(f.S.last.totalDurationMs,delay);assert.equal(f.clock(),delay);assert.deepEqual(f.events,['change','layout']);
  assert.equal(f.w.style.transform,'');assert.equal(f.S.last.direction,direction);
 }
});
test('ordinary desktop selection waits for two actual presentation frames before releasing input',async()=>{
 const f=slideFixture(0,{manualFrames:true}),running=f.run();await f.flush();
 assert.equal(f.model.desktopId,'new');assert.deepEqual(f.events,['change','layout']);assert.equal(f.w.inert,true);
 await f.paint();assert.equal(f.w.inert,true,'One presentation frame is insufficient');await f.paint();await running;
 assert.equal(f.S.last.presented,true);assert.equal(f.S.last.animated,false);assert.equal(f.events.filter(x=>x==='layout').length,1);assert.equal(f.w.inert,false);
 assert.equal(f.pendingFrames(),0);assert.equal(f.pendingTimers(),0);
});
test('a missing live presentation times out without creating surfaces and restores the input state',async()=>{
 const f=slideFixture(0,{manualFrames:true}),running=f.run(),rejected=assert.rejects(running,/Не удалось отрисовать выбранный рабочий стол/);await f.flush();await f.paint();
 await f.elapse(1483);assert.equal(f.w.inert,true);await f.elapse(1);await rejected;
 assert.deepEqual(f.events,['change','layout']);assert.equal(f.S.last.phase,'failed');assert.equal(f.S.last.presented,false);assert.equal(f.S.last.snapshotCaptures,0);
 assert.equal(f.w.style.visibility,'');assert.equal(f.w.inert,false);assert.equal(f.model.desktopSliding,false);assert.equal(f.w.dataset.sliding,undefined);
 assert.equal(f.listeners.size,0);assert.equal(f.hasCleared(),false);assert.equal(f.pendingFrames(),0);assert.equal(f.pendingTimers(),0);
});

function pendingSlideScene(direction=1,{outgoingBody='',incomingBody=''}={}){
 const vm=require('node:vm'),animations=[],area={x:0,y:0,width:500,height:300},frames=new Map(),timers=new Map();let now=1000,document,task=0;
 const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
 class Animation{
  constructor(node,frames,options){this.node=node;this.frames=frames;this.options=options;this.pending=true;this.playState='running';this.start=null;this.holdTime=0;this.writes=[];this.cancelled=false;this.readyTask=deferred();this.finishTask=deferred();this.ready=this.readyTask.promise;this.finished=this.finishTask.promise;animations.push(this);}
  get startTime(){return this.start;}
  set startTime(value){this.writes.push(value);this.start=value;this.pending=false;this.readyTask.resolve(this);this.advance();}
  get currentTime(){return this.pending||this.playState==='paused'?this.holdTime:Math.max(0,Math.min(this.options.duration,now-this.start));}
  set currentTime(value){this.holdTime=value;}
  pause(){this.playState='paused';this.start=null;this.pending=true;Promise.resolve().then(()=>{if(this.cancelled||this.playState!=='paused')return;this.pending=false;this.readyTask.resolve(this);});}
  play(){this.playState='running';this.pending=true;this.start=null;this.readyTask=deferred();this.ready=this.readyTask.promise;}
  browserReady(){if(this.cancelled||!this.pending||this.playState!=='running')return;this.start=now-this.holdTime;this.pending=false;this.readyTask.resolve(this);this.advance();}
  advance(){if(this.playState==='running'&&!this.pending&&!this.cancelled&&this.currentTime===this.options.duration)this.finishTask.resolve(this);}
  cancel(){this.cancelled=true;const error=Object.assign(Error('cancelled'),{name:'AbortError'});this.readyTask.reject(error);this.finishTask.reject(error);}
 }
 class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.style={setProperty(name,value){this[name]=value;}};this.attributes=[];this.dataset={};this.children=[];this.isConnected=false;}
  setAttribute(name,value){const old=this.attributes.find(a=>a.name===name);if(old)old.value=String(value);else this.attributes.push({name,value:String(value)});}getAttribute(name){return this.attributes.find(a=>a.name===name)?.value??null;}removeAttribute(name){this.attributes=this.attributes.filter(a=>a.name!==name);}querySelector(){return null;}querySelectorAll(){return[];}getBoundingClientRect(){return{...area};}
  cloneNode(){return new Node();}append(...nodes){this.children.push(...nodes);for(const node of nodes)node.isConnected=true;}
  attachShadow(){this.shadow=new Node();return this.shadow;}remove(){this.isConnected=false;}animate(frames,options){return new Animation(this,frames,options);}
 }
 document={styleSheets:[],documentElement:{attributes:[],dataset:{theme:'light'}},timeline:{currentTime:600},createElement:tag=>new Node(tag)};document.body=new Node();
 const workspace=new Node(),model={desktopId:'old',state:{tabs:[]}},ctx={module:{exports:{}},performance:{now:()=>now},requestAnimationFrame:fn=>{const id=++task;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{const id=++task;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync('mouse/desktop-slide.js','utf8'),ctx);const scene=ctx.module.exports.createScene(workspace,model,direction);
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 const paint=async()=>{now+=16;for(const [id,fn]of [...frames])if(frames.delete(id))fn(now);await flush();};
 return{scene,animations,area,async stage(){document.body.setAttribute('class',outgoingBody);assert.equal(await scene.stage('outgoing',{desk:'old',complete:true,surfaces:[]}),true);model.desktopId='new';document.body.setAttribute('class',incomingBody);assert.equal(await scene.stage('incoming',{desk:'new',complete:true,surfaces:[]}),true);},async preparePlayers(){await flush();assert.ok(animations.every(a=>a.playState==='paused'&&a.currentTime===0));await paint();assert.ok(animations.every(a=>a.playState==='paused'),'One painted paused frame is insufficient');await paint();assert.ok(animations.every(a=>a.playState==='running'&&a.pending&&a.currentTime===0));assert.equal(timers.size,0);},async at(value){now=value;for(const animation of animations)animation.advance();await flush();},flush};
}
test('each desktop frame retains its own fullscreen body selectors when the target changes from AI to a pane',async()=>{
 const f=pendingSlideScene(1,{outgoingBody:'ai-focused',incomingBody:'pane-focused'});await f.stage();
 const contexts=f.scene.overlay.shadow.children.filter(node=>node.dataset.transitionRoot==='true');assert.equal(contexts.length,2);
 const shells=contexts.map(html=>html.children[0]);assert.equal(shells[0].getAttribute('class'),'ai-focused');assert.equal(shells[1].getAttribute('class'),'pane-focused');
 assert.equal(shells[0].children[0].dataset.transitionFrame,'outgoing');assert.equal(shells[1].children[0].dataset.transitionFrame,'incoming');
 for(const element of [...contexts,...shells])assert.equal(element.style.display,'contents');f.scene.remove();
});
test('pending desktop players ignore stale document time and align only to the actual outgoing start',async()=>{
 for(const direction of [-1,1]){
  const f=pendingSlideScene(direction);await f.stage();const running=f.scene.animate();await f.preparePlayers();
  assert.deepEqual(f.animations.map(a=>a.startTime),[null,null],'an old document timestamp must not bypass pending play');
  assert.deepEqual(f.animations.map(a=>a.currentTime),[0,0]);await f.at(1040);f.animations[0].browserReady();await f.flush();
  assert.deepEqual(f.animations.map(a=>a.startTime),[1040,null]);await f.at(1052);f.animations[1].browserReady();await f.flush();
  assert.deepEqual(f.animations.map(a=>a.startTime),[1040,1040]);assert.deepEqual(f.animations[0].writes,[],'the outgoing playhead is never rewound');assert.deepEqual(f.animations[1].writes,[1040]);
  for(const time of [1100,1230,1369]){await f.at(time);const [a,b]=f.animations;assert.equal(a.currentTime,b.currentTime);const outgoing=-direction*f.area.width*a.currentTime/330,incoming=direction*f.area.width*(1-b.currentTime/330);assert.ok(Math.abs(incoming-outgoing-direction*f.area.width)<1e-9);assert.ok(a.currentTime<330);}
  await f.at(1370);assert.equal(await running,true);for(const animation of f.animations){assert.equal(animation.options.duration,330);assert.equal(animation.options.easing,'cubic-bezier(.22,1,.36,1)');}
 }
});
test('desktop players already sharing an actual browser start need no timestamp assignment',async()=>{
 const f=pendingSlideScene();await f.stage();const running=f.scene.animate();await f.preparePlayers();await f.at(1040);for(const animation of f.animations)animation.browserReady();await f.flush();
 assert.deepEqual(f.animations.map(a=>a.startTime),[1040,1040]);assert.ok(f.animations.every(a=>a.writes.length===0));
 await f.at(1370);assert.equal(await running,true);
});
test('cancelling desktop players while browser play is pending settles ready and finished safely',async()=>{
 const f=pendingSlideScene();await f.stage();const running=f.scene.animate();await f.preparePlayers();f.scene.cancel();assert.equal(await running,false);f.scene.remove();
 assert.ok(f.animations.every(a=>a.cancelled&&a.writes.length===0));assert.equal(f.scene.overlay.isConnected,false);
});

test('Nora controls cancel global backdrop effects in the loaded CSS without restyling other controls',()=>{
 const html=fs.readFileSync('mouse/index.html','utf8'),sheets=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match=>match[1]).filter(file=>!file.startsWith('agent-vendor/')),rules=[];
 for(const file of sheets){
  const css=fs.readFileSync('mouse/'+file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
   const declarations=match[2].split(';').flatMap(text=>{const colon=text.indexOf(':');return colon<0?[]:[[text.slice(0,colon).trim(),text.slice(colon+1).trim()]];});
   for(const selector of match[1].split(',').map(text=>text.trim()))if(/^(?:#desktop-tray )?(?:button|select)$/.test(selector))rules.push({selector,declarations});
  }
 }
 // Resolve the actual generic and scoped declarations for simple control
 // fixtures. Native verification additionally checks Chromium's computed CSS.
 const effect=(tag,inNora,property)=>{
  let winner={weight:-1,value:''};
  for(const rule of rules){if(rule.selector!==tag&&!(inNora&&rule.selector==='#desktop-tray '+tag))continue;
   for(const [name,raw]of rule.declarations)if(name===property){const important=/!important\s*$/.test(raw),weight=(important?1000:0)+(rule.selector.startsWith('#')?100:0);if(weight>=winner.weight)winner={weight,value:raw.replace(/\s*!important\s*$/,'')};}
  }return winner.value;
 };
 for(const tag of ['button','select'])for(const property of ['backdrop-filter','-webkit-backdrop-filter']){
  assert.equal(effect(tag,true,property),'none',tag+' inside Nora must not sample a backdrop');
  assert.equal(effect(tag,false,property),'blur(14px) saturate(1.15)',tag+' outside Nora retains its existing effect');
 }
 const scoped=rules.filter(rule=>rule.selector.startsWith('#desktop-tray '));assert.equal(scoped.length,2);
 for(const rule of scoped)assert.deepEqual(rule.declarations.map(([property])=>property).sort(),['-webkit-backdrop-filter','backdrop-filter'],'the reset must not change colors, borders, backgrounds or other control styles');
});

require('./mouse-floating-overlay.test.cjs');
