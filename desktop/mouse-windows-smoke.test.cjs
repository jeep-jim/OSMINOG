'use strict';
// Exercise the actual shell handler and renderer probe with delayed OS delivery.
// Installed Windows/User32 acceptance remains the native proof.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const smoke={exports:{}},filename=path.join(__dirname,'mouse-windows-smoke.cjs');
vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:smoke,require:name=>name==='electron'?{}:require(name)},{filename});
const {fillNativeAddress}=smoke.exports.fixtures;
const selector='.pane[data-pane="p0"] .pane-address input',oldURL='http://127.0.0.1:41234/second',url='http://127.0.0.1:41234/first';

function installRealShell(webContents){
 const shell={exports:{}},filename=path.join(__dirname,'mouse-shell.cjs');
 const localRequire=name=>name==='electron'?{}:name==='./mouse-emoji.cjs'?{install(){}}:
  name==='./mouse-mac-chrome.cjs'?{install:()=>({state:()=>({})})}:require(name);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:shell,require:localRequire,process:{platform:'win32'},Buffer},{filename});
 shell.exports.install({win:{webContents},browser:{tabs:new Map(),providers:new Map(),make(){}},
  ipcMain:{handle(){}},trusted(){},send(){},test:true});
}

function fixture(options={}){
 let time=10000,active=null,documentFocused=true,dispatching=false,lateRead=false;const queue=[],trace=[],waits=[],insertions=[],receipt={};
 function field(value){
  const state={value,start:value.length,end:value.length,connected:true,listeners:new Set()};
  const node={
   get value(){return state.value;},set value(_){throw Error('Programmatic value mutation is forbidden');},
   get selectionStart(){return state.start;},set selectionStart(_){throw Error('Programmatic selection is forbidden');},
   get selectionEnd(){return state.end;},set selectionEnd(_){throw Error('Programmatic selection is forbidden');},
   get isConnected(){return state.connected;},
   addEventListener(type,listener){assert.equal(type,'keydown');state.listeners.add(listener);},
   removeEventListener(type,listener){assert.equal(type,'keydown');state.listeners.delete(listener);},
   focus(){throw Error('Programmatic focus is forbidden');},select(){throw Error('Programmatic selection is forbidden');},
   setSelectionRange(){throw Error('Programmatic selection is forbidden');}
  };
  return{state,node};
 }
 const original=field(oldURL),other={};let current=original;
 const shell=Object.assign(new EventEmitter(),{id:14,isDestroyed:()=>false}),foreign=Object.assign(new EventEmitter(),{id:15,isDestroyed:()=>false});
 let currentShell=shell;
 const document={querySelector:value=>{assert.equal(value,selector);return current.node;},get activeElement(){return active;},hasFocus:()=>documentFocused};
 const context=vm.createContext({document,Date:{now:()=>time}});
 const js=async source=>{
  const value=JSON.parse(JSON.stringify(vm.runInContext(source,context)));
  if(options.lateRead&&!lateRead&&value?.value===oldURL&&value.selectionStart===0&&value.selectionEnd===oldURL.length){lateRead=true;time+=20000;}
  return value;
 };
 const completeSelection=()=>{
  if(!options.partial){current.state.start=0;current.state.end=current.state.value.length;}
  if(options.loseFocus)active=other;if(options.loseDocumentFocus)documentFocused=false;
  trace.push('selection delivered');
 };
 shell.selectAll=()=>{assert.equal(dispatching,true,'Only the production input handler may request selectAll');trace.push('production selectAll');queue.push(completeSelection);};
 installRealShell(shell);const originalListeners=shell.listenerCount('before-input-event');
 const domKey=input=>{
  if(input.type!=='keyDown'||(input.key==='Control'&&options.noControl))return;
  trace.push('DOM '+input.key);
  const event={key:input.key,ctrlKey:input.control,altKey:input.alt,metaKey:input.meta,shiftKey:input.shift,
   isTrusted:input.isTrusted??!options.untrusted,target:options.wrongTarget?other:original.node,...options.domKey};
  for(const listener of original.state.listeners)listener(event);
 };
 const emitNative=(owner,input)=>{
  trace.push('before-input '+input.key);const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  dispatching=true;try{owner.emit('before-input-event',event,input);}finally{dispatching=false;}
  if(owner===shell&&!event.defaultPrevented)domKey(input);
  return event;
 };
 const control={type:'keyDown',key:'Control',code:'ControlLeft',control:true,alt:false,meta:false,shift:false,isAutoRepeat:false};
 const a={type:'keyDown',key:'a',code:'KeyA',control:true,alt:false,meta:false,shift:false,isAutoRepeat:false};
 const click=async value=>{
  assert.equal(value,selector);trace.push('native click queued');
  queue.push(()=>{if(!options.noFocus)active=original.node;trace.push('click delivered');});
 };
 const testKey=chord=>{
  assert.equal(chord,'CTRL+A');assert.equal(active,original.node,'CTRL+A waits for actual native focus');trace.push('CTRL+A queued');
  queue.push(()=>emitNative(shell,control));
  queue.push(()=>{
   if(options.lateA)time+=20000;
   if(options.domOnlyA)domKey({...a,isTrusted:false});
   else emitNative(options.wrongWebContents?foreign:shell,{...a,...options.nativeKey});
   if(options.forceSelection)queue.push(completeSelection);
   if(options.flood)for(let i=0;i<40;i++)emitNative(shell,{...a,type:'keyUp',key:'F8',code:'F8',control:false});
   if(options.replace){original.state.connected=false;current=field(oldURL);active=current.node;}
   if(options.replaceShell)currentShell=foreign;
  });
  return true;
 };
 const insertText=async value=>{
  trace.push('insertText');const state=current.state;
  insertions.push({value:state.value,start:state.start,end:state.end,at:time});
  state.value=state.value.slice(0,state.start)+value+state.value.slice(state.end);state.start=state.end=state.start+value.length;
 };
 const until=async(check,label,timeout)=>{
  waits.push({label,timeout});const deadline=time+timeout;
  do{
   if(await check())return;
   await new Promise(resolve=>setImmediate(resolve));time+=options.tickMs||1000;queue.shift()?.();
  }while(time<deadline);
  throw Error('Windows native verification timed out: '+label);
 };
 return{run:()=>fillNativeAddress({selector,url,click,js,getWebContents:()=>currentShell,testKey,insertText,until,receipt,now:()=>time}),
  receipt,trace,waits,insertions,original,shell,originalListeners,lateNative:()=>emitNative(shell,a),
  get value(){return current.state.value;},get observer(){return context.__mouseWindowsAddressSelection;}};
}

function cleaned(f){
 assert.equal(f.observer,undefined);assert.equal(f.original.state.listeners.size,0);
 assert.equal(f.shell.listenerCount('before-input-event'),f.originalListeners,'Only the smoke observer is removed');
}

test('actual mouse-shell consumes CTRL+A before DOM and the address wait observes selection completion',async()=>{
 // This is the production before-input-event path also documented by the
 // existing mouse-625-smoke selection wait; no copied Ctrl+A handler is used.
 const f=fixture();await f.run();
 assert.equal(f.value,url);assert.deepEqual(f.insertions,[{value:oldURL,start:0,end:oldURL.length,at:14000}]);
 assert.ok(f.trace.indexOf('production selectAll')<f.trace.indexOf('selection delivered'));
 assert.ok(f.trace.indexOf('selection delivered')<f.trace.indexOf('insertText'));
 assert.equal(f.trace.includes('DOM a'),false);assert.deepEqual(f.receipt.selection.keys.map(key=>key.key),['Control']);
 assert.equal(f.receipt.selection.keys[0].trusted,true);assert.equal(f.receipt.selection.keys[0].targetSame,true);
 assert.deepEqual(Array.from(f.receipt.nativeKey.events,event=>event.key),['Control','a']);
 assert.ok(f.receipt.nativeKey.events.every(event=>event.webContentsId===14&&event.currentShell));
 assert.equal(f.receipt.stage,'ready');assert.equal(f.receipt.focus.selectionStart,oldURL.length);
 assert.equal(f.receipt.selection.selectionStart,0);assert.equal(f.receipt.selection.selectionEnd,oldURL.length);
 assert.equal(f.receipt.inserted.value,url);cleaned(f);
});

test('a click without actual address focus never sends CTRL+A or inserts text',async()=>{
 const f=fixture({noFocus:true});await assert.rejects(f.run(),/native address input focus/);
 assert.equal(f.receipt.stage,'focus');assert.equal(f.receipt.focus.focused,false);assert.equal(f.value,oldURL);
 assert.equal(f.trace.includes('CTRL+A queued'),false);assert.deepEqual(f.insertions,[]);cleaned(f);
});

test('native selection still needs a trusted Control event on the same focused DOM input',async()=>{
 for(const options of [{noControl:true},{untrusted:true},{wrongTarget:true},{domKey:{key:'a'}},{domKey:{ctrlKey:false}},{domKey:{altKey:true}},{partial:true}]){
  const f=fixture(options);await assert.rejects(f.run(),/native address CTRL\+A selection/);
  assert.equal(f.receipt.stage,'selection');assert.equal(f.value,oldURL);assert.deepEqual(f.insertions,[]);cleaned(f);
 }
});

test('foreign WebContents, wrong native key/modifiers or DOM-only A cannot authorize an already selected input',async()=>{
 for(const options of [{wrongWebContents:true},{nativeKey:{key:'s',code:'KeyS'}},{nativeKey:{control:false}},
  {nativeKey:{alt:true}},{nativeKey:{meta:true}},{nativeKey:{shift:true}},{nativeKey:{type:'keyUp'}},
  {nativeKey:{isAutoRepeat:true}},{domOnlyA:true}]){
  const f=fixture({...options,forceSelection:true});await assert.rejects(f.run(),/native address CTRL\+A selection/);
  assert.equal(f.receipt.selection.selectionStart,0);assert.equal(f.receipt.selection.selectionEnd,oldURL.length);
  assert.equal(f.value,oldURL);assert.deepEqual(f.insertions,[]);cleaned(f);
 }
});

test('input or shell replacement and focus loss cannot inherit a prior native selection receipt',async()=>{
 for(const options of [{replace:true},{replaceShell:true},{loseFocus:true},{loseDocumentFocus:true}]){
  const f=fixture(options);await assert.rejects(f.run(),/native address CTRL\+A selection/);
  assert.equal(f.receipt.selection.keys[0].trusted,true);assert.equal(f.value,oldURL);assert.deepEqual(f.insertions,[]);
  if(options.replace){assert.equal(f.receipt.selection.sameInput,false);assert.equal(f.receipt.selection.connected,false);}
  cleaned(f);
 }
});

test('native receipt stays bounded and cannot be changed by events after finally cleanup',async()=>{
 const f=fixture({flood:true});await f.run();assert.equal(f.receipt.nativeKey.events.length,16);assert.equal(f.receipt.nativeKey.truncated,true);cleaned(f);
 const before=JSON.stringify(f.receipt.nativeKey);f.lateNative();assert.equal(JSON.stringify(f.receipt.nativeKey),before);
});

test('focus, native selection and value share 15000ms, rejecting late events and late async readbacks',async()=>{
 const passing=fixture({tickMs:3000});await passing.run();
 assert.deepEqual(passing.waits.map(wait=>wait.timeout),[15000,12000,3000]);assert.equal(passing.value,url);
 for(const options of [{tickMs:5000},{lateA:true},{lateRead:true}]){
  const late=fixture(options);await assert.rejects(late.run(),/native address CTRL\+A selection/);
  assert.deepEqual(late.insertions,[]);assert.equal(late.value,oldURL);cleaned(late);
  const before=JSON.stringify(late.receipt.nativeKey);late.lateNative();assert.equal(JSON.stringify(late.receipt.nativeKey),before);
 }
});
