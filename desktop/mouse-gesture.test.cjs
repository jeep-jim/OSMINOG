'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {install,KEY,CHANNEL,EVENT,PAGE_CHANNEL,RECOGNIZER}=require('./mouse-gesture.cjs');
const {installIPCSwitch}=require('./mouse-private-core.cjs');
const {createMouseDesktopGesture}=require('./mouse/desktop-gesture.js');
const Wheel=require('./mouse/desktop-wheel.js');
async function fixture({platform='darwin',completed=false}={}){
 const handlers=new Map(),writes=[],sent=[],timers=new Map(),data={[KEY]:{completed},unrelated:{keep:true}},ipcMain=new EventEmitter();ipcMain.handle=(name,handler)=>handlers.set(name,handler);
 const win=new EventEmitter();win.webContents=new EventEmitter();win.isDestroyed=win.webContents.isDestroyed=()=>false;win.isFocused=()=>true;
 win.webContents.send=(channel,packet)=>{sent.push({channel,packet});win.webContents.emit(channel,packet);};
 const event={sender:win.webContents},router=installIPCSwitch(ipcMain,()=>win.webContents);
 let active='b',privateMode=null,busy=false,time=1000,nextTimer=0;
 const store={get:async key=>({[key]:structuredClone(data[key])}),set:async value=>{writes.push(structuredClone(value));Object.assign(data,structuredClone(value));}};
 const page=(id='normal')=>{const wc={mainFrame:{},isDestroyed:()=>false,getURL:()=> 'https://fixture.example/'};return{id,visible:true,view:{webContents:wc}};};
 const normalPage=page(),normalBrowser={tabs:new Map([[normalPage.id,normalPage]]),mouseDesktops:{bank:{members:{[normalPage.id]:'b'}}}};
 let browser=normalBrowser;
 const service={state:()=>({desktopId:active,desktops:{active,items:['a','b','c'].map(id=>({id,active:id===active}))}})};
 const controller=await install({win,store,ipcMain,trusted:e=>{if(e!==event)throw Error('Untrusted frame');},getContext:()=>({privateMode,busy,desktopService:service,browser}),platform,now:()=>time,setTimer:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id)});
 const command=(action,args)=>handlers.get(CHANNEL)(event,action,args),latest=()=>sent.filter(item=>item.channel===EVENT).at(-1)?.packet;
 const wheel=async(direction='left',scope='nora')=>{const deltaX=direction==='left'?56:-56;await command('wheel',{scope,deltaX,deltaY:0});time+=20;await command('wheel',{scope,deltaX,deltaY:0});};
 const pageWheel=(p=normalPage,args={deltaX:56,deltaY:0},frame=p.view.webContents.mainFrame)=>ipcMain.emit(PAGE_CHANNEL,{sender:p.view.webContents,senderFrame:frame},{scope:'page',...args});
 return{win,store,handlers,event,router,controller,command,wheel,pageWheel,normalPage,normalBrowser,latest,sent,writes,timers,data,ipcMain,advance:ms=>{time+=ms;},active:()=>active,setActive:id=>{active=id;},setBusy:value=>{busy=value;},privateSession:value=>{privateMode=value;if(value){const p=page('private');browser={tabs:new Map([[p.id,p]]),mouseDesktops:{bank:{members:{private:'b'}}}};}else browser=normalBrowser;router.use(value?new Map([[CHANNEL,router.normal.get(CHANNEL)]]):null);return browser;}};
}

test('horizontal wheel dispatches only after intent; legacy AppKit swipe does nothing',async()=>{
 const f=await fixture();f.win.emit('swipe',{},'left');assert.equal(f.sent.length,0);await f.wheel();assert.equal(f.sent.length,0,'Nora-specific wheel requires the open Nora');
 f.advance(500);await f.command('context',{open:true});await f.command('wheel',{scope:'nora',deltaX:28,deltaY:0});assert.equal(f.sent.length,0);f.advance(20);await f.command('wheel',{scope:'nora',deltaX:84,deltaY:0});
 assert.equal(f.latest().from,'b');assert.equal(f.latest().to,'c');assert.equal(f.latest().source,'trusted-wheel');assert.equal(f.latest().gesture.axis,'x');assert.equal(f.latest().gesture.distance,112);assert.equal(f.latest().gesture.count,2);
 await f.wheel();assert.equal(f.sent.length,1);f.setActive('c');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).completed,true);assert.deepEqual(f.writes,[{[KEY]:{completed:true}}]);assert.deepEqual(f.data.unrelated,{keep:true});f.controller.dispose();
});
test('closed-Nora page wheel authenticates current visible main frame, desktop and session',async()=>{
 const f=await fixture();f.pageWheel();f.advance(20);f.pageWheel();assert.equal(f.latest().surface,'page');assert.equal(f.latest().tabId,'normal');assert.equal(f.latest().to,'c');await f.command('finish',{id:f.latest().id,changed:false});
 f.advance(500);const n=f.sent.length;f.normalPage.visible=false;f.pageWheel();f.pageWheel();assert.equal(f.sent.length,n);f.normalPage.visible=true;f.pageWheel(f.normalPage,undefined,{});f.pageWheel(f.normalPage,undefined,{});assert.equal(f.sent.length,n);
 const current=f.privateSession({}),privatePage=current.tabs.get('private');f.pageWheel();f.pageWheel();assert.equal(f.sent.length,n,'Normal page cannot operate the current private bank');f.pageWheel(privatePage);f.advance(20);f.pageWheel(privatePage);assert.equal(f.latest().tabId,'private');f.controller.dispose();
});
test('vertical page scrolling and diagonals never dispatch; wheel over desktop control does',async()=>{
 const f=await fixture();for(let i=0;i<6;i++){f.pageWheel(f.normalPage,{deltaX:3,deltaY:100});f.advance(15);}assert.equal(f.sent.length,0);
 f.advance(500);await f.command('wheel',{scope:'control',deltaX:0,deltaY:80});assert.equal(f.latest().surface,'control');assert.equal(f.latest().gesture.axis,'y');assert.equal(f.latest().to,'c');f.controller.dispose();
});
test('burst lock survives completion and momentum; next deliberate burst can switch back',async()=>{
 const f=await fixture();await f.wheel('left','control');f.setActive('c');await f.command('finish',{id:f.latest().id,changed:true});
 for(let i=0;i<15;i++){f.advance(40);await f.command('wheel',{scope:'control',deltaX:-64,deltaY:0});}assert.equal(f.sent.length,1);
 f.advance(500);await f.wheel('right','control');assert.equal(f.sent.length,2);assert.equal(f.latest().to,'b');f.controller.dispose();
});
test('boundaries, busy/privacy transitions and unfocused windows retain the current desktop',async()=>{
 const f=await fixture();f.setActive('a');await f.wheel('right','control');f.advance(500);f.setActive('c');await f.wheel('left','control');assert.equal(f.sent.length,0);
 f.setActive('b');f.advance(500);f.setBusy(true);await f.wheel('left','control');f.setBusy(false);f.win.isFocused=()=>false;await f.wheel('left','control');assert.equal(f.sent.length,0);f.controller.dispose();
});
test('successful completion requires the actual requested bank target, not animation acknowledgement',async()=>{
 const f=await fixture();await f.wheel('left','control');f.setActive('a');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).completed,false);assert.equal(f.writes.length,0);
 assert.equal((await f.command('finish',{id:'invented',changed:true})).accepted,false);f.controller.dispose();
});
test('completion expires, closing Nora invalidates Nora request and navigation clears pending state',async()=>{
 const f=await fixture();await f.command('context',{open:true});await f.wheel();const id=f.latest().id;f.setActive('c');f.advance(5001);assert.equal((await f.command('finish',{id,changed:true})).completed,false);
 f.setActive('b');await f.wheel();const next=f.latest().id;await f.command('context',{open:false});f.setActive('c');assert.equal((await f.command('finish',{id:next,changed:true})).completed,false);
 f.advance(500);f.setActive('b');await f.wheel('left','control');f.win.webContents.emit('did-start-navigation',{},'file:///shell',false,true);f.setActive('c');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).completed,false);assert.equal(f.writes.length,0);f.controller.dispose();
});
test('new two-finger tutorial is profile-specific and private learning never persists',async()=>{
 const f=await fixture();assert.equal(KEY,'mouseDesktopGestureHintV2');assert.equal((await f.command('state')).recognizer,RECOGNIZER);const first={};f.privateSession(first);await f.wheel('left','control');f.setActive('c');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).learned,true);assert.equal(f.writes.length,0);f.privateSession({});assert.equal((await f.command('state')).learned,false);f.privateSession(null);assert.equal((await f.command('state')).learned,false);f.controller.dispose();
 const existing=await fixture({completed:true});assert.equal((await existing.command('state')).learned,true);existing.controller.dispose();
});
test('stale gesture completion cannot train a different session',async()=>{const f=await fixture();await f.wheel('left','control');const id=f.latest().id;f.privateSession({});f.setActive('c');assert.equal((await f.command('finish',{id,changed:true})).completed,false);assert.equal(f.writes.length,0);f.controller.dispose();});
test('trusted request validation, teardown and unsupported platform keep strict boundaries',async()=>{
 const f=await fixture();await assert.rejects(f.handlers.get(CHANNEL)({sender:{}},'state'),/Untrusted/);await assert.rejects(f.command('wheel',{scope:'page',deltaX:100,deltaY:0}),/область/);await f.command('wheel',{scope:'control',deltaX:Infinity,deltaY:0});assert.equal(f.sent.length,0);await f.wheel('left','control');assert.equal(f.timers.size,1);
 const shell=f.win.webContents;let invalidReads=0;f.win.isDestroyed=()=>true;Object.defineProperty(f.win,'webContents',{get(){invalidReads++;throw Error('Object destroyed');}});assert.doesNotThrow(()=>f.win.emit('closed'));f.controller.dispose();assert.equal(invalidReads,0);assert.equal(f.timers.size,0);assert.equal(shell.listenerCount('did-start-navigation'),0);assert.equal(f.ipcMain.listenerCount(PAGE_CHANNEL),0);
 const other=await fixture({platform:'linux'});await other.wheel('left','control');assert.equal(other.sent.length,0);assert.equal((await other.command('state')).supported,false);other.controller.dispose();
});

class Element{constructor(){this.children=[];this.listeners=new Map();this.hidden=false;this.open=false;this.inert=false;this.attributes=new Map();this.parent=null;}setAttribute(k,v){this.attributes.set(k,String(v));}set innerHTML(v){this.markup=v;this.details=new Element();}querySelector(s){return s==='details'?this.details:null;}append(n){this.children.push(n);n.parent=this;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}addEventListener(n,f){this.listeners.set(n,f);}removeEventListener(n){this.listeners.delete(n);}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function uiFixture({open=true,changeBank=true,fail=false}={}){
 const f=await fixture(),prior={document:global.document,window:global.window,MutationObserver:global.MutationObserver};global.document={createElement:()=>new Element()};global.window={addEventListener(){},removeEventListener(){}};global.MutationObserver=class{observe(){}disconnect(){}};
 const tray=new Element(),content=new Element(),model={desktopId:'b'},errors=[];tray.open=open;tray.hidden=!open;let calls=0,resolve;
 const switcher=async id=>{calls++;await new Promise(r=>{resolve=r;});if(fail)throw Error('switch failed');model.desktopId=id;if(changeBank)f.setActive(id);return true;};
 const N={test:true,desktopGesture:f.command,onDesktopSwipe:fn=>{f.win.webContents.on(EVENT,fn);return()=>f.win.webContents.removeListener(EVENT,fn);}};
 const ui=createMouseDesktopGesture({N,tray,content,model,switchBehind:switcher,switchClosed:switcher,status:e=>errors.push(e)});await ui.ready;
 return{...f,ui,tray,content,model,errors,calls:()=>calls,finish:()=>resolve(),dispose(){ui.dispose();f.controller.dispose();Object.assign(global,prior);}};
}
test('hint stays available until real bank change, then remains hidden after Nora reopens',async()=>{
 const f=await uiFixture();assert.equal(f.ui.diagnostics().hintVisible,true);assert.match(f.content.children[0].markup,/двумя пальцами/);assert.doesNotMatch(f.content.children[0].markup,/тремя|трекпад.*настройк/i);
 await f.wheel();await tick();assert.equal(f.calls(),1);assert.equal(f.ui.diagnostics().hintVisible,true);f.finish();await tick();await tick();assert.equal(f.ui.diagnostics().learned,true);assert.equal(f.tray.open,true);f.tray.hidden=true;f.tray.open=false;await f.ui.sync();f.tray.hidden=false;f.tray.open=true;await f.ui.sync();assert.equal(f.ui.diagnostics().hintVisible,false);f.dispose();
});
test('closed Nora routes a trusted page/control wheel through the normal desktop switch',async()=>{const f=await uiFixture({open:false});await f.wheel('left','control');await tick();assert.equal(f.calls(),1);f.finish();await tick();await tick();assert.equal(f.ui.diagnostics().lastResult.completed,true);assert.equal(f.tray.open,false);assert.equal(f.ui.diagnostics().learned,true);f.dispose();});
test('failed or renderer-only transitions never mark the tutorial learned',async()=>{for(const options of [{changeBank:false},{fail:true}]){const f=await uiFixture(options);await f.wheel();await tick();f.finish();await tick();await tick();assert.equal(f.ui.diagnostics().learned,false);assert.equal(f.writes.length,0);if(options.fail)assert.deepEqual(f.errors,['switch failed']);f.dispose();}});

test('wheel normalization accepts only actual trusted unmodified finite input',()=>{const e={isTrusted:true,deltaMode:0,deltaX:18,deltaY:1};assert.deepEqual(Wheel.normalize(e),{deltaX:18,deltaY:1});assert.deepEqual(Wheel.normalize({...e,deltaMode:1}),{deltaX:288,deltaY:16});for(const patch of [{isTrusted:false},{defaultPrevented:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{deltaX:NaN},{deltaMode:9}])assert.equal(Wheel.normalize({...e,...patch}),null);});
test('scrollable ancestor, contenteditable and page handlers retain horizontal wheel; vertical page scroll stays native',()=>{
 const handlers=new Map(),sent=[],win={document:{},innerHeight:800,performance:{now:()=>0},addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),getComputedStyle:node=>node.style||{overflowX:'visible',overflowY:'visible'}};
 const tools=Wheel.listen({window:win,scope:()=> 'page',send:value=>sent.push(value)});let prevented=0;const dispatch=(path,extra={})=>handlers.get('wheel')({isTrusted:true,deltaMode:0,deltaX:80,deltaY:0,cancelable:true,preventDefault(){prevented++;},composedPath:()=>path,...extra});
 const scroll={nodeType:1,scrollWidth:800,clientWidth:200,scrollHeight:100,clientHeight:100,style:{overflowX:'auto',overflowY:'hidden'},matches:()=>false};dispatch([scroll]);dispatch([scroll]);assert.equal(sent.length,0);assert.equal(prevented,0);
 tools.reset();dispatch([],{deltaX:0,deltaY:80});assert.equal(sent.length,0);assert.equal(prevented,0);tools.reset();dispatch([],{defaultPrevented:true});assert.equal(sent.length,0);
 tools.reset();dispatch([{nodeType:1,isContentEditable:true}]);assert.equal(sent.length,0);tools.reset();dispatch([]);assert.equal(sent.length,1);assert.equal(prevented,1);tools.dispose();assert.equal(handlers.size,0);
});
