'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {install,KEY,CHANNEL,EVENT}=require('./mouse-gesture.cjs');
const {installIPCSwitch}=require('./mouse-private-core.cjs');
const {createMouseDesktopGesture}=require('./mouse/desktop-gesture.js');

async function fixture({platform='darwin',completed=false}={}){
 const handlers=new Map(),writes=[],sent=[],timers=new Map(),data={[KEY]:{completed},unrelated:{keep:true}};
 const ipcMain={handle:(name,handler)=>handlers.set(name,handler)};
 const win=new EventEmitter();win.webContents=new EventEmitter();win.isDestroyed=win.webContents.isDestroyed=()=>false;win.isFocused=()=>true;
 win.webContents.send=(channel,packet)=>{sent.push({channel,packet});win.webContents.emit(channel,packet);};
 const event={sender:win.webContents},router=installIPCSwitch(ipcMain,()=>win.webContents);
 let active='b',privateMode=null,busy=false,time=1000,nextTimer=0;
 const store={get:async key=>({[key]:structuredClone(data[key])}),set:async value=>{writes.push(structuredClone(value));Object.assign(data,structuredClone(value));}};
 const service={state:()=>({desktopId:active,desktops:{active,items:['a','b','c'].map(id=>({id,active:id===active}))}})};
 const controller=await install({win,store,ipcMain,trusted:e=>{if(e!==event)throw Error('Untrusted frame');},getContext:()=>({privateMode,busy,desktopService:service}),platform,now:()=>time,setTimer:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id)});
 const command=(action,args)=>handlers.get(CHANNEL)(event,action,args);
 const swipe=direction=>win.emit('swipe',{},direction);
 const latest=()=>sent.filter(item=>item.channel===EVENT).at(-1)?.packet;
 return{win,store,handlers,event,router,controller,command,swipe,latest,sent,writes,timers,data,advance:ms=>{time+=ms;},active:()=>active,setActive:id=>{active=id;},setBusy:value=>{busy=value;},privateSession:value=>{privateMode=value;router.use(value?new Map([[CHANNEL,router.normal.get(CHANNEL)]]):null);}};
}

test('only a horizontal native swipe while Nora is open dispatches the adjacent desktop',async()=>{
 const f=await fixture();
 f.swipe('left');assert.equal(f.sent.length,0);
 await f.command('context',{open:true});f.swipe('up');f.win.emit('wheel',{deltaX:400});assert.equal(f.sent.length,0);
 f.swipe('right');assert.deepEqual(f.latest(),{id:'swipe-1',direction:'right',from:'b',to:'a',source:'macos-three-finger-swipe'});
 f.swipe('right');f.swipe('left');assert.equal(f.sent.length,1,'one outstanding native event may produce only one switch');
 const unchanged=await f.command('finish',{id:f.latest().id,changed:true});assert.equal(unchanged.completed,false);assert.equal(f.writes.length,0);
 f.advance(200);f.swipe('left');assert.equal(f.latest().to,'c');f.setActive('c');
 const done=await f.command('finish',{id:f.latest().id,changed:true});assert.equal(done.completed,true);assert.equal(done.learned,true);
 assert.deepEqual(f.writes,[{[KEY]:{completed:true}}]);assert.deepEqual(f.data.unrelated,{keep:true});f.controller.dispose();
});

test('an animation acknowledgement cannot learn the gesture unless the actual bank selected its exact target',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.swipe('left');const id=f.latest().id;
 f.setActive('a');const wrongTarget=await f.command('finish',{id,changed:true});assert.equal(wrongTarget.completed,false);assert.equal(wrongTarget.learned,false);
 const forged=await f.command('finish',{id:'ordinary-button-click',changed:true});assert.equal(forged.accepted,false);assert.equal(f.writes.length,0);f.controller.dispose();
});

test('desktop edges, closed Nora, privacy transitions and unfocused windows do not dispatch',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.setActive('a');f.swipe('right');assert.equal(f.sent.length,0);
 f.setActive('c');f.swipe('left');assert.equal(f.sent.length,0);
 f.setActive('b');f.setBusy(true);f.swipe('left');f.setBusy(false);f.win.isFocused=()=>false;f.swipe('left');assert.equal(f.sent.length,0);
 f.win.isFocused=()=>true;await f.command('context',{open:false});f.swipe('left');assert.equal(f.sent.length,0);f.controller.dispose();
});

test('completion expires or is invalidated by closing Nora and main-frame navigation',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.swipe('left');let id=f.latest().id;f.setActive('c');f.advance(5001);
 assert.equal((await f.command('finish',{id,changed:true})).completed,false);
 f.setActive('b');f.swipe('left');id=f.latest().id;await f.command('context',{open:false});f.setActive('c');assert.equal((await f.command('finish',{id,changed:true})).completed,false);
 f.advance(200);f.setActive('b');await f.command('context',{open:true});f.swipe('left');id=f.latest().id;f.win.webContents.emit('did-start-navigation',{},'file:///shell',false,true);f.setActive('c');
 assert.equal((await f.command('finish',{id,changed:true})).completed,false);assert.equal(f.writes.length,0);assert.equal(f.timers.size,0);f.controller.dispose();
});

test('private completion stays in that session and never writes the normal profile',async()=>{
 const f=await fixture();const first={};f.privateSession(first);await f.command('context',{open:true});f.swipe('left');f.setActive('c');
 assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).learned,true);assert.equal(f.writes.length,0);
 await f.command('context',{open:false});await f.command('context',{open:true});assert.equal((await f.command('state')).learned,true);
 f.privateSession({});assert.equal((await f.command('state')).learned,false);f.privateSession(null);assert.equal((await f.command('state')).learned,false);assert.equal(f.writes.length,0);f.controller.dispose();
});

test('a stale native event cannot mark completion in a different privacy session',async()=>{
 const f=await fixture();await f.command('context',{open:true});f.swipe('left');const id=f.latest().id;
 f.privateSession({});f.setActive('c');assert.equal((await f.command('finish',{id,changed:true})).completed,false);assert.equal(f.writes.length,0);f.controller.dispose();
});

test('trusted IPC, disposal and persisted normal completion retain their boundaries',async()=>{
 const f=await fixture({completed:true});assert.equal((await f.command('state')).learned,true);
 await assert.rejects(f.handlers.get(CHANNEL)({sender:{}},'state'),/Untrusted/);
 await assert.rejects(f.command('context',{open:'yes'}),/Некорректное/);
 await assert.rejects(f.command('invented'),/Неизвестная/);
 await f.command('context',{open:true});f.swipe('left');f.setActive('c');assert.equal((await f.command('finish',{id:f.latest().id,changed:true})).completed,true);assert.equal(f.writes.length,0,'completed profiles are not rewritten');
 f.controller.dispose();assert.equal(f.win.listenerCount('swipe'),0);assert.equal(f.timers.size,0);await assert.rejects(f.command('state'),/недоступны/);
 const other=await fixture({platform:'linux'});await other.command('context',{open:true});other.swipe('left');assert.equal(other.sent.length,0);assert.equal((await other.command('state')).supported,false);other.controller.dispose();
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
async function uiFixture({changeBank=true,fail=false,open=true}={}){
 const native=await fixture(),observers=[],oldDocument=global.document,oldObserver=global.MutationObserver;
 global.document={createElement:()=>new Element()};global.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
 const tray=new Element(),content=new Element(),model={desktopId:'b',state:{desktopId:'b'}},errors=[];tray.open=open;tray.hidden=!open;
 let calls=0,resolveSwitch,changed=0;
 const N={test:true,desktopGesture:native.command,onDesktopSwipe:fn=>{native.win.webContents.on(EVENT,fn);return()=>native.win.webContents.removeListener(EVENT,fn);}};
 const ui=createMouseDesktopGesture({N,tray,content,model,changed:()=>changed++,status:error=>errors.push(error),switchBehind:async id=>{calls++;assert.equal(tray.open,true);assert.equal(tray.hidden,false);await new Promise(resolve=>{resolveSwitch=resolve;});if(fail)throw Error('switch failed');model.desktopId=id;if(changeBank)native.setActive(id);return true;}});
 await ui.ready;
 return{...native,ui,tray,content,model,errors,calls:()=>calls,changes:()=>changed,finish:()=>resolveSwitch(),dispose:()=>{ui.dispose();native.controller.dispose();global.document=oldDocument;global.MutationObserver=oldObserver;}};
}

test('the hint stays until a native swipe really changes the bank, then stays hidden after reopening Nora',async()=>{
 const f=await uiFixture();assert.equal(f.ui.diagnostics().hintVisible,true);
 f.content.children[0].details.listeners.get('toggle')();await tick();assert.equal(f.writes.length,0,'opening help or watching animation does not complete onboarding');
 f.swipe('left');await tick();assert.equal(f.calls(),1);assert.equal(f.ui.diagnostics().hintVisible,true);
 const packet=f.latest();f.win.webContents.emit(EVENT,packet);await tick();assert.equal(f.calls(),1);
 f.finish();await tick();await tick();assert.equal(f.ui.diagnostics().learned,true);assert.equal(f.ui.diagnostics().hintVisible,false);assert.equal(f.tray.open,true);assert.equal(f.writes.length,1);
 f.tray.hidden=true;f.tray.open=false;await f.ui.sync();f.tray.hidden=false;f.tray.open=true;await f.ui.sync();assert.equal(f.ui.diagnostics().hintVisible,false);assert.equal(f.writes.length,1);f.dispose();
});

test('a renderer-only change or failed switch leaves the hint available for another real attempt',async()=>{
 for(const options of [{changeBank:false},{fail:true}]){
  const f=await uiFixture(options);f.swipe('left');await tick();f.finish();await tick();await tick();
  assert.equal(f.ui.diagnostics().learned,false);assert.equal(f.ui.diagnostics().hintVisible,true);assert.equal(f.writes.length,0);assert.equal(f.tray.open,true);
  if(options.fail)assert.deepEqual(f.errors,['switch failed']);f.dispose();
 }
});

test('ordinary desktop selection, a hidden Nora and inert controls never count as gesture training',async()=>{
 const f=await uiFixture();f.model.desktopId='c';f.setActive('c');await f.ui.sync();assert.equal(f.ui.diagnostics().learned,false);assert.equal(f.writes.length,0);
 f.content.inert=true;f.swipe('right');await tick();assert.equal(f.calls(),0);assert.equal(f.writes.length,0);
 f.content.inert=false;f.tray.hidden=true;f.tray.open=false;await f.ui.sync();f.advance(200);f.swipe('right');await tick();assert.equal(f.calls(),0);f.dispose();
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
