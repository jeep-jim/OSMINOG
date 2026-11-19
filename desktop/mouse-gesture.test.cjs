'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {install,KEY,CHANNEL,EVENT,PAGE_CHANNEL,PAGE_RECOGNIZER}=require('./mouse-gesture.cjs');
const {installIPCSwitch}=require('./mouse-private-core.cjs');
const {createMouseDesktopGesture}=require('./mouse/desktop-gesture.js');
const Wheel=require('./mouse/desktop-wheel.js');

async function fixture({completed=false,retiredCompleted=false}={}){
 const handlers=new Map(),writes=[],sent=[],timers=new Map(),data={[KEY]:{completed},mouseDesktopGestureHintV1:{completed:retiredCompleted},unrelated:{keep:true}};
 const ipcMain=new EventEmitter();ipcMain.handle=(name,handler)=>handlers.set(name,handler);
 const win=new EventEmitter();win.webContents=new EventEmitter();win.isDestroyed=win.webContents.isDestroyed=()=>false;win.isFocused=()=>true;
 win.webContents.send=(channel,packet)=>{sent.push({channel,packet});win.webContents.emit(channel,packet);};
 const event={sender:win.webContents},router=installIPCSwitch(ipcMain,()=>win.webContents);
 let active='b',privateMode=null,busy=false,time=1000,nextTimer=0;
 const store={get:async key=>({[key]:structuredClone(data[key])}),set:async value=>{writes.push(structuredClone(value));Object.assign(data,structuredClone(value));}};
 const normalPage={id:'normal',visible:true,nativeVisible:true,view:{webContents:{mainFrame:{},isDestroyed:()=>false,getURL:()=> 'https://fixture.example/'}}};normalPage.view.getVisible=()=>normalPage.nativeVisible;
 const normalBrowser={tabs:new Map([[normalPage.id,normalPage]]),mouseDesktops:{bank:{members:{normal:'b'}}}};let browser=normalBrowser;
 const service={state:()=>({desktopId:active,desktops:{active,items:['a','b','c'].map(id=>({id,active:id===active}))}})};
 const controller=await install({win,store,ipcMain,trusted:e=>{if(e!==event)throw Error('Untrusted frame');},getContext:()=>({privateMode,busy,desktopService:service,browser}),now:()=>time,setTimer:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id)});
 const command=(action,args)=>handlers.get(CHANNEL)(event,action,args);
 const wheel=direction=>command('wheel',{direction});
 const latest=()=>sent.filter(item=>item.channel===EVENT).at(-1)?.packet;
 const closedWheel=async(direction='left',scope='panel')=>{const deltaX=direction==='left'?56:-56;await command('wheel',{scope,deltaX,deltaY:0});time+=20;await command('wheel',{scope,deltaX,deltaY:0});};
 const pageWheel=(p=normalPage,args={deltaX:56,deltaY:0},frame=p.view.webContents.mainFrame)=>ipcMain.emit(PAGE_CHANNEL,{sender:p.view.webContents,senderFrame:frame},{scope:'page',...args});
 return{win,store,handlers,event,router,controller,command,wheel,closedWheel,pageWheel,normalPage,normalBrowser,ipcMain,latest,now:()=>time,sent,writes,timers,data,advance:ms=>{time+=ms;},active:()=>active,setActive:id=>{active=id;},setBusy:value=>{busy=value;},privateSession:value=>{privateMode=value;if(value){const p={id:'private',visible:true,view:{webContents:{mainFrame:{},isDestroyed:()=>false,getURL:()=> 'https://fixture.example/'},getVisible:()=>true}};browser={tabs:new Map([[p.id,p]]),mouseDesktops:{bank:{members:{private:'b'}}}};}else browser=normalBrowser;router.use(value?new Map([[CHANNEL,router.normal.get(CHANNEL)]]):null);return browser;}};
}

test('only trusted wheel requests while Nora is open dispatch the adjacent desktop',async()=>{
 const f=await fixture();
 f.wheel('left');assert.equal(f.sent.length,0);
 await f.command('context',{open:true});await assert.rejects(f.command('wheel',{direction:'up'}),/направление/);f.win.emit('swipe',{},'left');f.win.emit('wheel',{deltaX:400});assert.equal(f.sent.length,0,'system swipes and out-of-panel wheels are not registered');
 f.wheel('right');assert.deepEqual(f.latest(),{id:'wheel-1',direction:'right',from:'b',to:'a',source:'nora-wheel'});
 f.wheel('right');f.wheel('left');assert.equal(f.sent.length,1,'one outstanding wheel request may produce only one switch');
 const unchanged=await f.command('finish',{id:f.latest().id,changed:true});assert.equal(unchanged.completed,false);assert.equal(f.writes.length,0);
 f.advance(200);f.wheel('left');assert.equal(f.latest().to,'c');f.setActive('c');
 const done=await f.command('finish',{id:f.latest().id,changed:true});assert.equal(done.completed,true);assert.equal(done.learned,true);
 assert.deepEqual(f.writes,[{[KEY]:{completed:true}}]);assert.deepEqual(f.data.unrelated,{keep:true});f.controller.dispose();
});

test('an animation acknowledgement cannot learn the gesture unless the actual bank selected its exact target',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.wheel('left');const id=f.latest().id;
 f.setActive('a');const wrongTarget=await f.command('finish',{id,changed:true});assert.equal(wrongTarget.completed,false);assert.equal(wrongTarget.learned,false);
 const forged=await f.command('finish',{id:'ordinary-button-click',changed:true});assert.equal(forged.accepted,false);assert.equal(f.writes.length,0);f.controller.dispose();
});

test('desktop edges, closed Nora, privacy transitions and unfocused windows do not dispatch',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.setActive('a');f.wheel('right');assert.equal(f.sent.length,0);
 f.setActive('c');f.wheel('left');assert.equal(f.sent.length,0);
 f.setActive('b');f.setBusy(true);f.wheel('left');f.setBusy(false);f.win.isFocused=()=>false;f.wheel('left');assert.equal(f.sent.length,0);
 f.win.isFocused=()=>true;await f.command('context',{open:false});f.wheel('left');assert.equal(f.sent.length,0);f.controller.dispose();
});

test('completion expires or is invalidated by closing Nora and main-frame navigation',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.wheel('left');let id=f.latest().id;f.setActive('c');f.advance(5001);
 assert.equal((await f.command('finish',{id,changed:true})).completed,false);
 f.setActive('b');f.wheel('left');id=f.latest().id;await f.command('context',{open:false});f.setActive('c');assert.equal((await f.command('finish',{id,changed:true})).completed,false);
 f.advance(200);f.setActive('b');await f.command('context',{open:true});f.wheel('left');id=f.latest().id;f.win.webContents.emit('did-start-navigation',{},'file:///shell',false,true);f.setActive('c');
 assert.equal((await f.command('finish',{id,changed:true})).completed,false);assert.equal(f.writes.length,0);assert.equal(f.timers.size,0);f.controller.dispose();
});

test('private completion stays in that session and never writes the normal profile',async()=>{
 const f=await fixture();const first={};f.privateSession(first);await f.command('context',{open:true});f.wheel('left');f.setActive('c');
 assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).learned,true);assert.equal(f.writes.length,0);
 await f.command('context',{open:false});await f.command('context',{open:true});assert.equal((await f.command('state')).learned,true);
 f.privateSession({});assert.equal((await f.command('state')).learned,false);f.privateSession(null);assert.equal((await f.command('state')).learned,false);assert.equal(f.writes.length,0);f.controller.dispose();
});

test('a stale wheel request cannot mark completion in a different privacy session',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.wheel('left');const id=f.latest().id;
 f.privateSession({});f.setActive('c');assert.equal((await f.command('finish',{id,changed:true})).completed,false);assert.equal(f.writes.length,0);f.controller.dispose();
});

test('trusted IPC, disposal and persisted normal completion retain their boundaries',async()=>{
 const f=await fixture({completed:true});assert.equal((await f.command('state')).learned,true);
 await assert.rejects(f.handlers.get(CHANNEL)({sender:{}},'state'),/Untrusted/);
 await assert.rejects(f.command('context',{open:'yes'}),/Некорректное/);
 await assert.rejects(f.command('invented'),/Неизвестная/);
 await f.command('context',{open:true});f.wheel('left');f.setActive('c');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).completed,true);assert.equal(f.writes.length,0,'completed profiles are not rewritten');
 f.controller.dispose();assert.equal(f.win.listenerCount('swipe'),0);assert.equal(f.timers.size,0);await assert.rejects(f.command('state'),/недоступны/);
 const other=await fixture({retiredCompleted:true});assert.equal((await other.command('state')).learned,false,'retired three-finger training does not suppress the corrected two-finger hint');assert.equal((await other.command('state')).supported,true);assert.equal(other.win.listenerCount('swipe'),0);other.controller.dispose();
});

test('window destruction clears gesture listeners and pending completion without reading its native getter',async()=>{
 const f=await fixture(),shell=f.win.webContents;
 await f.command('context',{open:true});f.wheel('left');assert.equal(f.timers.size,1);
 assert.equal(shell.listenerCount('did-start-navigation'),1);assert.equal(shell.listenerCount('render-process-gone'),1);
 let invalidReads=0;f.win.isDestroyed=()=>true;
 Object.defineProperty(f.win,'webContents',{get(){invalidReads++;throw Error('Object has been destroyed');}});
 let laterCleanup=false;f.win.once('closed',()=>{laterCleanup=true;});
 assert.doesNotThrow(()=>f.win.emit('closed'));assert.doesNotThrow(()=>f.controller.dispose());
 assert.equal(invalidReads,0);assert.equal(laterCleanup,true);assert.equal(f.win.listenerCount('swipe'),0);assert.equal(f.timers.size,0);
 assert.equal(shell.listenerCount('did-start-navigation'),0);assert.equal(shell.listenerCount('render-process-gone'),0);assert.equal(f.writes.length,0);
});

class Element{
 constructor(){this.children=[];this.listeners=new Map();this.hidden=false;this.open=false;this.inert=false;this.attributes=new Map();this.parent=null;}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 set innerHTML(value){this.markup=value;this.details=new Element();}
 querySelector(selector){return selector==='details'?this.details:null;}
 append(node){this.children.push(node);node.parent=this;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
 addEventListener(name,fn){this.listeners.set(name,fn);}
 removeEventListener(name){this.listeners.delete(name);}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function uiFixture({changeBank=true,fail=false,open=true,disabled=false}={}){
 const native=await fixture(),observers=[],oldDocument=global.document,oldObserver=global.MutationObserver,oldWindow=global.window,windowListeners=new Map();
 global.document={createElement:()=>new Element()};global.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
 global.window={document:global.document,innerHeight:800,performance:{now:native.now},getComputedStyle:node=>node.style||{overflowX:'visible',overflowY:'visible'},addEventListener:(name,fn)=>windowListeners.set(name,fn),removeEventListener:name=>windowListeners.delete(name)};
 const tray=new Element(),content=new Element(),model={desktopId:'b',state:{desktopId:'b'}},errors=[];tray.open=open;tray.hidden=!open;
 let calls=0,resolveSwitch,changed=0;
 const N={test:true,desktopGesture:native.command,onDesktopSwipe:fn=>{native.win.webContents.on(EVENT,fn);return()=>native.win.webContents.removeListener(EVENT,fn);}};
 const switchTarget=async(id,wasOpen)=>{calls++;assert.equal(tray.open,wasOpen);assert.equal(tray.hidden,!wasOpen);await new Promise(resolve=>{resolveSwitch=resolve;});if(fail)throw Error('switch failed');model.desktopId=id;if(changeBank)native.setActive(id);return true;};
 const ui=createMouseDesktopGesture({N,tray,content,model,disabled:()=>disabled,now:native.now,changed:()=>changed++,status:error=>errors.push(error),switchBehind:id=>switchTarget(id,true),switchClosed:id=>switchTarget(id,false)});
 await ui.ready;
 const target={closest:selector=>selector==='.desktop-list,.desktop-gesture-hint'?target:null};
 const input=(values={})=>{const event={isTrusted:true,target,cancelable:true,defaultPrevented:false,deltaX:0,deltaY:0,deltaMode:0,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...values};content.listeners.get('wheel')?.(event);return event;};
 const wheel=direction=>input({deltaX:direction==='left'?72:-72});
 const control={nodeType:1,matches:selector=>selector==='#desktops-button'};
 const windowInput=(values={})=>{const event={isTrusted:true,target:control,cancelable:true,defaultPrevented:false,deltaX:0,deltaY:0,deltaMode:0,composedPath:()=>[control],preventDefault(){this.defaultPrevented=true;},...values};windowListeners.get('wheel')?.(event);return event;};
 return{...native,ui,tray,content,model,errors,input,wheel,windowInput,windowListeners,setDisabled:value=>{disabled=value;},calls:()=>calls,changes:()=>changed,finish:()=>resolveSwitch(),dispose:()=>{ui.dispose();native.controller.dispose();global.document=oldDocument;global.MutationObserver=oldObserver;global.window=oldWindow;}};
}

test('the hint stays until a panel wheel really changes the bank, then stays hidden after reopening Nora',async()=>{
 const f=await uiFixture();assert.equal(f.ui.diagnostics().hintVisible,true);
 f.content.children[0].details.listeners.get('toggle')();await tick();assert.equal(f.writes.length,0,'opening help or watching animation does not complete onboarding');
 f.wheel('left');await tick();assert.equal(f.calls(),1);assert.equal(f.ui.diagnostics().hintVisible,true);
 const packet=f.latest();f.win.webContents.emit(EVENT,packet);await tick();assert.equal(f.calls(),1);
 f.finish();await tick();await tick();assert.equal(f.ui.diagnostics().learned,true);assert.equal(f.ui.diagnostics().hintVisible,false);assert.equal(f.tray.open,true);assert.equal(f.writes.length,1);
 f.tray.hidden=true;f.tray.open=false;await f.ui.sync();f.tray.hidden=false;f.tray.open=true;await f.ui.sync();assert.equal(f.ui.diagnostics().hintVisible,false);assert.equal(f.writes.length,1);f.dispose();
});

test('a renderer-only change or failed switch leaves the hint available for another real attempt',async()=>{
 for(const options of [{changeBank:false},{fail:true}]){
  const f=await uiFixture(options);f.wheel('left');await tick();f.finish();await tick();await tick();
  assert.equal(f.ui.diagnostics().learned,false);assert.equal(f.ui.diagnostics().hintVisible,true);assert.equal(f.writes.length,0);assert.equal(f.tray.open,true);
  if(options.fail)assert.deepEqual(f.errors,['switch failed']);f.dispose();
 }
});

test('ordinary desktop selection, a hidden Nora and inert controls never count as gesture training',async()=>{
 const f=await uiFixture();f.model.desktopId='c';f.setActive('c');await f.ui.sync();assert.equal(f.ui.diagnostics().learned,false);assert.equal(f.writes.length,0);
 f.content.inert=true;f.wheel('right');await tick();assert.equal(f.calls(),0);assert.equal(f.writes.length,0);
 f.content.inert=false;f.tray.hidden=true;f.tray.open=false;await f.ui.sync();f.advance(200);f.wheel('right');await tick();assert.equal(f.calls(),0);f.dispose();
});

test('first-use content has its intrinsic height ready before Nora opens',async()=>{
 const f=await uiFixture({open:false});
 assert.equal(f.ui.diagnostics().hintVisible,false);
 assert.equal(f.content.children[0].hidden,false,'the closed parent hides an intrinsically ready hint');
 const changes=f.changes();f.tray.hidden=false;f.tray.open=true;await f.ui.sync();
 assert.equal(f.ui.diagnostics().hintVisible,true);assert.equal(f.changes(),changes,'opening does not reveal extra height during the panel animation');
 f.dispose();
});

test('completion in one normal profile does not train another normal profile',async()=>{
 const first=await fixture({completed:true}),second=await fixture();
 assert.equal((await first.command('state')).learned,true);assert.equal((await second.command('state')).learned,false);
 first.controller.dispose();second.controller.dispose();
});

test('small horizontal trackpad deltas accumulate and a momentum tail cannot skip desks',async()=>{
 const f=await uiFixture();
 for(let i=0;i<3;i++){assert.equal(f.input({deltaX:12}).defaultPrevented,true);f.advance(16);}
 await tick();assert.equal(f.calls(),0);
 f.input({deltaX:12});await tick();assert.equal(f.calls(),1);assert.equal(f.latest().to,'c');
 f.advance(350);f.input({deltaX:100});await tick();assert.equal(f.calls(),1,'the busy animation keeps the stream latched even after a gap');
 f.finish();await tick();await tick();
 for(const deltaX of [24,14,7,3]){f.advance(150);f.input({deltaX});await tick();assert.equal(f.calls(),1,'momentum after animation completion stays in the original gesture');}
 f.advance(281);f.input({deltaX:-60});await tick();assert.equal(f.calls(),2);assert.equal(f.latest().to,'b','a new gesture can move back after the wheel stream is idle');
 f.finish();await tick();await tick();assert.equal(f.active(),'b');assert.equal(f.writes.length,1);f.dispose();
});

test('vertical mouse wheel line and page units select neighboring desks over the picker',async()=>{
 const f=await uiFixture();
 const line=f.input({deltaY:3,deltaMode:1});await tick();assert.equal(line.defaultPrevented,true);assert.equal(f.calls(),1);assert.equal(f.latest().to,'c');assert.deepEqual(f.ui.diagnostics().lastInput,{axis:'y',delta:48,deltaMode:1,trusted:true,at:1000});
 f.finish();await tick();await tick();f.advance(300);
 f.input({deltaY:-1,deltaMode:2});await tick();assert.equal(f.calls(),2);assert.equal(f.latest().to,'b');
 f.finish();await tick();await tick();f.dispose();
});

test('synthetic, pinch, modified and already handled wheel events preserve their original behavior',async()=>{
 const f=await uiFixture();
 for(const options of [{isTrusted:false},{ctrlKey:true},{metaKey:true},{altKey:true},{defaultPrevented:true},{deltaMode:9},{deltaX:NaN},{deltaX:Infinity}]){
  const event=f.input({deltaX:160,...options});await tick();assert.equal(event.defaultPrevented,options.defaultPrevented===true);assert.equal(event.stopped,undefined);
 }
 assert.equal(f.calls(),0);assert.equal(f.sent.length,0);assert.equal(f.writes.length,0);f.dispose();
});

test('fields and the independently scrollable history and tab rows never become desktop gestures',async()=>{
 const f=await uiFixture();
 for(const name of ['input','textarea','select','contenteditable','desk-history-list','desk-peek-tabs']){
  const target={closest:selector=>selector.includes(name)?target:null};
  const event=f.input({target,deltaX:150,deltaY:10});await tick();assert.equal(event.defaultPrevented,false);assert.equal(f.calls(),0);
 }
 const header={closest:()=>null};assert.equal(f.input({target:header,deltaY:120}).defaultPrevented,false,'vertical wheel over non-picker controls is preserved');
 f.input({target:header,deltaX:120});await tick();assert.equal(f.calls(),1,'horizontal two-finger input can begin elsewhere within Nora');
 f.finish();await tick();await tick();f.dispose();assert.equal(f.content.listeners.has('wheel'),false);
});

test('diagonal jitter and a reversed incomplete swipe do not select the wrong desktop',async()=>{
 const f=await uiFixture();
 assert.equal(f.input({deltaX:80,deltaY:80}).defaultPrevented,false);await tick();assert.equal(f.calls(),0);
 f.input({deltaX:30});f.advance(16);f.input({deltaX:-30});await tick();assert.equal(f.calls(),0);
 f.advance(16);f.input({deltaX:-18});await tick();assert.equal(f.calls(),1);assert.equal(f.latest().to,'a');
 f.finish();await tick();await tick();f.dispose();
});

test('closed Nora, system swipes and busy controls do not consume a new desktop gesture',async()=>{
 const f=await uiFixture({open:false});
 assert.equal(f.input({deltaX:120}).defaultPrevented,false);f.win.emit('swipe',{},'left');await tick();assert.equal(f.calls(),0);assert.equal(f.win.listenerCount('swipe'),0);
 f.tray.open=true;f.tray.hidden=false;await f.ui.sync();f.model.switching=true;f.input({deltaX:120});await tick();assert.equal(f.calls(),0);assert.equal(f.sent.length,0);assert.equal(f.ui.diagnostics().learned,false);
 f.model.switching=false;f.advance(100);f.input({deltaX:70});await tick();assert.equal(f.calls(),0,'the tail of a gesture begun while busy cannot trigger a late switch');
 f.advance(300);f.input({deltaX:70});await tick();assert.equal(f.calls(),1);f.finish();await tick();await tick();f.dispose();
});

test('closed-Nora guest wheel authenticates the actual visible main frame, desktop and privacy session',async()=>{
 const f=await fixture();f.pageWheel();f.advance(20);f.pageWheel();assert.equal(f.latest().source,'trusted-wheel');assert.equal(f.latest().surface,'page');assert.equal(f.latest().tabId,'normal');assert.equal(f.latest().to,'c');assert.equal(f.latest().gesture.count,2);await f.command('finish',{id:f.latest().id,changed:false});f.advance(500);const count=f.sent.length;
 f.normalPage.visible=false;f.pageWheel();f.pageWheel();f.normalPage.visible=true;f.normalPage.nativeVisible=false;f.pageWheel();f.pageWheel();f.normalPage.nativeVisible=true;
 f.pageWheel(f.normalPage,undefined,{});f.pageWheel(f.normalPage,undefined,{});f.normalBrowser.mouseDesktops.bank.members.normal='a';f.pageWheel();f.pageWheel();f.normalBrowser.mouseDesktops.bank.members.normal='b';assert.equal(f.sent.length,count);
 const current=f.privateSession({}),privatePage=current.tabs.get('private');f.pageWheel();f.pageWheel();assert.equal(f.sent.length,count,'A normal guest cannot steer the private desktop bank');f.pageWheel(privatePage);f.advance(20);f.pageWheel(privatePage);assert.equal(f.latest().tabId,'private');f.setActive('c');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).learned,true);assert.equal(f.writes.length,0);f.privateSession({});assert.equal((await f.command('state')).learned,false);f.controller.dispose();assert.equal(f.ipcMain.listenerCount(PAGE_CHANNEL),0);
});
test('closed-shell intent has its own thresholds and preserves the accepted Nora tutorial key',async()=>{
 const f=await fixture();assert.equal(KEY,'mouseDesktopWheelHintV2');assert.equal((await f.command('state')).recognizer,'two-finger-or-wheel');assert.equal(PAGE_RECOGNIZER,'horizontal-wheel-and-desktop-controls');
 await f.command('wheel',{scope:'panel',deltaX:111,deltaY:0});assert.equal(f.sent.length,0);f.advance(16);await f.command('wheel',{scope:'panel',deltaX:4,deltaY:0});assert.equal(f.latest().gesture.axis,'x');assert.equal(f.latest().gesture.distance,115);f.setActive('c');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).completed,true);assert.deepEqual(f.writes,[{[KEY]:{completed:true}}]);
 for(let i=0;i<15;i++){f.advance(40);await f.command('wheel',{scope:'control',deltaX:-64,deltaY:0});}assert.equal(f.sent.length,1,'The whole momentum tail remains in one burst');
 f.advance(500);await f.command('wheel',{scope:'control',deltaX:0,deltaY:-64});assert.equal(f.latest().to,'b');assert.equal(f.latest().gesture.axis,'y');f.controller.dispose();
});
test('page input is blocked while Nora owns the modal route and rejects forged shell scopes',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.pageWheel();f.advance(20);f.pageWheel();await f.closedWheel();assert.equal(f.sent.length,0);
 await assert.rejects(f.command('wheel',{scope:'page',deltaX:120,deltaY:0}),/область/);await f.command('context',{open:false});await f.command('wheel',{scope:'panel',deltaX:Infinity,deltaY:0});assert.equal(f.sent.length,0);
 await f.closedWheel();const id=f.latest().id;await f.command('context',{open:true});f.setActive('c');assert.equal((await f.command('finish',{id,changed:true})).completed,false);assert.equal(f.writes.length,0);f.controller.dispose();
});
test('closed-shell controller switches without opening Nora and restores its listener on disposal',async()=>{
 const f=await uiFixture({open:false});assert.equal(f.windowInput({deltaY:64}).defaultPrevented,true);await tick();assert.equal(f.calls(),1);assert.equal(f.latest().surface,'control');f.finish();await tick();await tick();assert.equal(f.tray.open,false);assert.equal(f.ui.diagnostics().lastResult.completed,true);assert.equal(f.ui.diagnostics().learned,true);f.dispose();assert.equal(f.windowListeners.size,0);
});
test('opening/closing and open Nora cannot consume closed-shell wheel',async()=>{
 const f=await uiFixture({open:false,disabled:true});assert.equal(f.windowInput({deltaY:80}).defaultPrevented,false);await tick();assert.equal(f.calls(),0);f.setDisabled(false);f.tray.open=true;f.tray.hidden=false;await f.ui.sync();assert.equal(f.windowInput({deltaY:80}).defaultPrevented,false);await tick();assert.equal(f.calls(),0);f.dispose();
});
test('wheel normalization accepts only actual trusted unmodified finite input',()=>{
 const event={isTrusted:true,deltaMode:0,deltaX:18,deltaY:1};assert.deepEqual(Wheel.normalize(event),{deltaX:18,deltaY:1});assert.deepEqual(Wheel.normalize({...event,deltaMode:1}),{deltaX:288,deltaY:16});for(const patch of [{isTrusted:false},{defaultPrevented:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{deltaX:NaN},{deltaMode:9}])assert.equal(Wheel.normalize({...event,...patch}),null);
});
test('scrollable ancestors, editable controls and page handlers retain input, including a scroller edge',()=>{
 const handlers=new Map(),sent=[],win={document:{},innerHeight:800,performance:{now:()=>0},addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),getComputedStyle:node=>node.style||{overflowX:'visible',overflowY:'visible'}},tools=Wheel.listen({window:win,scope:()=> 'page',send:value=>sent.push(value)});let prevented=0;
 const dispatch=(path,extra={})=>handlers.get('wheel')({isTrusted:true,deltaMode:0,deltaX:80,deltaY:0,cancelable:true,preventDefault(){prevented++;},composedPath:()=>path,...extra});
 const scroll={nodeType:1,scrollWidth:800,clientWidth:200,scrollLeft:600,scrollHeight:100,clientHeight:100,style:{overflowX:'auto',overflowY:'hidden'},matches:()=>false};dispatch([scroll]);dispatch([scroll]);assert.equal(sent.length,0);assert.equal(prevented,0);
 tools.reset();dispatch([],{deltaX:0,deltaY:80});assert.equal(sent.length,0);tools.reset();dispatch([],{defaultPrevented:true});assert.equal(sent.length,0);tools.reset();dispatch([{nodeType:1,isContentEditable:true}]);assert.equal(sent.length,0);tools.reset();dispatch([]);assert.equal(sent.length,1);assert.equal(prevented,1);tools.dispose();assert.equal(handlers.size,0);
});
