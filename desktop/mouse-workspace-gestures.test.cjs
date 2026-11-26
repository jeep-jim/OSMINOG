'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {install,LINK_CHANNEL,SOURCE_CHANNEL,EVENT,CONTROL,DRAG_MS,END_GRACE_MS}=require('./mouse-workspace-gestures.cjs');
const UUID='12345678-1234-4123-8123-123456789abc',NEXT='abcdefab-1234-4123-8123-123456789abc';
function fixture(t){
 let time=1000,nativeDown=true,busy=false,cursor={x:200,y:300},nextTimer=0;const handlers=new Map(),timers=new Map(),messages=[],opened=[];
 const ipcMain=new EventEmitter();ipcMain.handle=(name,fn)=>handlers.set(name,fn);ipcMain.removeHandler=name=>handlers.delete(name);
 const shell=new EventEmitter();shell.isDestroyed=()=>false;shell.mainFrame={};shell.send=(channel,value)=>messages.push({channel,value});
 const win=new EventEmitter();win.webContents=shell;win.isDestroyed=()=>false;win.isFocused=()=>true;win.getContentBounds=()=>({x:100,y:200,width:1000,height:700});win.contentView={children:[]};
 const wc=new EventEmitter();wc.id=42;wc.mainFrame={url:'https://source.test/' };wc.isDestroyed=()=>false;wc.getURL=()=>wc.mainFrame.url;
 const view={webContents:wc,getVisible:()=>true,getBounds:()=>({x:10,y:60,width:600,height:400})},page={id:'source',project:'owned',title:'Source website',lane:'main',visible:true,navigationEpoch:1,view};win.contentView.children=[view];
 const bank={active:'desk-a',members:{source:'desk-a'},items:[{id:'desk-a'},{id:'desk-b'}]},browser={project:'owned',tabs:new Map([[page.id,page]]),providers:new Map(),mouseDesktops:{bank},mouseOpenFrom:(source,url)=>opened.push({source,url})};let current=browser;
 const shellEvent={sender:shell,senderFrame:shell.mainFrame},pageEvent={sender:wc,senderFrame:wc.mainFrame};
 const controller=install({win,ipcMain,trusted:event=>{if(event!==shellEvent)throw Error('Untrusted shell');},getBrowser:()=>current,isTransition:()=>busy,screen:{getCursorScreenPoint:()=>cursor},primaryDown:()=>nativeDown,now:()=>time,setTimer:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)});t.after(()=>controller.dispose());
 const source=(value,event=pageEvent)=>ipcMain.emit(SOURCE_CHANNEL,event,value),begin=(token=UUID,extra={})=>source({phase:'begin',token,x:100,y:40,...extra}),take=(token=UUID)=>handlers.get(CONTROL)(shellEvent,'take',{token});
 return{controller,win,shell,wc,view,page,bank,browser,pageEvent,shellEvent,ipcMain,handlers,timers,messages,opened,source,begin,take,latest:()=>messages.filter(row=>row.channel===EVENT).at(-1)?.value,down:value=>nativeDown=value,cursor:value=>cursor=value,busy:value=>busy=value,current:value=>current=value,advance:ms=>time+=ms};
}
test('an ordinary link from a live visible main frame opens through the owned browser routing hook',t=>{
 const f=fixture(t);f.ipcMain.emit(LINK_CHANNEL,f.pageEvent,{url:'https://destination.test/path'});assert.deepEqual(f.opened,[{source:f.page,url:'https://destination.test/path'}]);
 for(const value of [{url:'file:///secret'},{url:'javascript:alert(1)'},{url:'https://user:pass@destination.test/'},{url:'https://destination.test/',command:'execute'},{url:'x'.repeat(8193)},null])f.ipcMain.emit(LINK_CHANNEL,f.pageEvent,value);assert.equal(f.opened.length,1);
 f.ipcMain.emit(LINK_CHANNEL,{...f.pageEvent,senderFrame:{}},{url:'https://destination.test/'});f.page.visible=false;f.ipcMain.emit(LINK_CHANNEL,f.pageEvent,{url:'https://destination.test/'});f.page.visible=true;f.bank.active='desk-b';f.ipcMain.emit(LINK_CHANNEL,f.pageEvent,{url:'https://destination.test/'});assert.equal(f.opened.length,1);
});
test('drag begin derives identity from the native page and requires the actual button and pointer inside its visible surface',t=>{
 const f=fixture(t);f.down(false);f.begin();assert.equal(f.controller.state(),null);f.down(true);f.cursor({x:900,y:800});f.begin();assert.equal(f.controller.state(),null);
 f.cursor({x:200,y:300});f.begin(UUID,{x:900});assert.equal(f.controller.state(),null);f.begin(UUID,{id:'foreign'});assert.equal(f.controller.state(),null);
 f.begin();assert.deepEqual(f.latest(),{phase:'begin',token:UUID,id:'source',desk:'desk-a',title:'Source website',lane:'main',x:100,y:100});assert.deepEqual(f.controller.state(),{token:UUID,id:'source',desk:'desk-a',ending:false});assert.equal(f.timers.size,1);
});
test('hidden native surfaces, detached children and foreign frames cannot arm a pane drag',t=>{
 const f=fixture(t);f.view.getVisible=()=>false;f.begin();assert.equal(f.controller.state(),null);f.view.getVisible=()=>true;
 f.win.contentView.children=[];f.begin();assert.equal(f.controller.state(),null);f.win.contentView.children=[f.view];
 f.source({phase:'begin',token:UUID,x:100,y:40},{...f.pageEvent,senderFrame:{}});assert.equal(f.controller.state(),null);
 f.page.clipView={getVisible:()=>false,getBounds:()=>({x:10,y:60,width:600,height:400})};f.win.contentView.children=[f.page.clipView];f.begin();assert.equal(f.controller.state(),null);
});
test('page zoom is accounted for when validating CSS coordinates against native view dimensions',t=>{
 const f=fixture(t);f.wc.getZoomFactor=()=>.5;f.begin(UUID,{x:900,y:600});assert.ok(f.controller.state());f.controller.cancel();
 f.wc.getZoomFactor=()=>2;f.begin(NEXT,{x:400,y:40});assert.equal(f.controller.state(),null);f.begin(NEXT,{x:100,y:40});assert.ok(f.controller.state());
});
test('take consumes exactly once after a desktop carry while the source remains in its original desk',t=>{
 const f=fixture(t);f.begin();f.bank.active='desk-b';f.page.visible=false;f.view.getVisible=()=>false;
 assert.deepEqual(f.take(),{accepted:true,token:UUID,id:'source',desk:'desk-a',lane:'main',webContentsId:42});assert.equal(f.controller.state(),null);assert.equal(f.timers.size,0);assert.equal(f.latest().taken,true);assert.deepEqual(f.take(),{accepted:false});
 f.bank.active='desk-a';f.page.visible=true;f.view.getVisible=()=>true;f.begin();assert.equal(f.controller.state(),null,'a consumed nonce cannot be replayed as a fresh drag');
});
test('a second begin cannot extend the same nonce and a different real gesture replaces the old one',t=>{
 const f=fixture(t);f.begin();const count=f.messages.length;f.begin();assert.equal(f.messages.length,count);f.begin(NEXT);assert.equal(f.controller.state().token,NEXT);assert.equal(f.messages.at(-2).value.phase,'cancel');assert.deepEqual(f.take(UUID),{accepted:false});assert.equal(f.take(NEXT).accepted,true);
});
test('guest dragend permits a pending shell drop during the short grace then expires exactly that drag',t=>{
 const f=fixture(t);f.begin();f.source({phase:'end',token:UUID});assert.equal(f.controller.state().ending,true);assert.equal([...f.timers.values()].filter(row=>row.ms===END_GRACE_MS).length,1);assert.equal(f.take().accepted,true);
 f.source({phase:'end',token:UUID});assert.equal(f.controller.state(),null);f.begin(NEXT);f.source({phase:'end',token:NEXT});const grace=[...f.timers.values()].find(row=>row.ms===END_GRACE_MS);grace.fn();assert.equal(f.controller.state(),null);assert.equal(f.latest().phase,'end');assert.deepEqual(f.take(NEXT),{accepted:false});
});
test('navigation, changed membership, replacement browser, privacy transition and expiry invalidate a drop',t=>{
 for(const mutate of [f=>{f.page.navigationEpoch++;},f=>{f.wc.mainFrame.url='https://other.test/';},f=>{f.bank.members.source='desk-b';},f=>{f.current({...f.browser});},f=>{f.busy(true);},f=>{f.advance(DRAG_MS+1);},f=>{f.browser.tabs.delete('source');}]){
  const f=fixture(t);f.begin();mutate(f);assert.deepEqual(f.take(),{accepted:false});assert.equal(f.controller.state(),null);
 }
});
test('native navigation listeners cancel only relevant pages and keep subframe changes separate',t=>{
 const f=fixture(t);f.begin();f.wc.emit('did-start-navigation',{url:'https://iframe.test/',isMainFrame:false});assert.ok(f.controller.state());
 f.wc.emit('did-start-navigation',{url:'https://source.test/next',isMainFrame:true,isSameDocument:false});assert.equal(f.controller.state(),null);assert.equal(f.latest().phase,'cancel');assert.equal(f.wc.listenerCount('did-start-navigation'),0);
 f.begin(NEXT);f.wc.emit('destroyed');assert.equal(f.controller.state(),null);assert.equal(f.wc.listenerCount('destroyed'),0);
});
test('only the trusted shell can claim or cancel and a stale cancel cannot erase a newer gesture',t=>{
 const f=fixture(t);f.begin();assert.throws(()=>f.handlers.get(CONTROL)({},'take',{token:UUID}),/Untrusted/);assert.throws(()=>f.handlers.get(CONTROL)(f.shellEvent,'take',{token:UUID,id:'foreign'}),/Некорректный/);assert.throws(()=>f.handlers.get(CONTROL)(f.shellEvent,'execute',{token:UUID}),/Неизвестная/);
 f.begin(NEXT);assert.deepEqual(f.handlers.get(CONTROL)(f.shellEvent,'cancel',{token:UUID}),{accepted:false});assert.equal(f.controller.state().token,NEXT);assert.deepEqual(f.handlers.get(CONTROL)(f.shellEvent,'cancel',{token:NEXT}),{accepted:true});assert.equal(f.controller.state(),null);
});
test('a foreign guest end, forged nonce or cancel cannot finish another page drag',t=>{
 const f=fixture(t);f.begin('not-random');assert.equal(f.controller.state(),null);f.begin();f.source({phase:'end',token:UUID},{sender:{},senderFrame:{}});f.source({phase:'cancel',token:NEXT});assert.equal(f.controller.state().ending,false);f.source({phase:'cancel',token:UUID});assert.equal(f.controller.state(),null);
});
test('controller disposal releases listeners and RAM on a closed native window without reading its destroyed getter',t=>{
 const f=fixture(t);f.begin();f.win.isDestroyed=()=>true;let reads=0;Object.defineProperty(f.win,'webContents',{get(){reads++;throw Error('Destroyed native getter');}});assert.doesNotThrow(()=>f.win.emit('closed'));assert.equal(reads,0);assert.equal(f.controller.state(),null);assert.equal(f.timers.size,0);assert.equal(f.ipcMain.listenerCount(SOURCE_CHANNEL),0);assert.equal(f.ipcMain.listenerCount(LINK_CHANNEL),0);assert.equal(f.handlers.has(CONTROL),false);assert.equal(f.shell.listenerCount('did-start-navigation'),0);
});
