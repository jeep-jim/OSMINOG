'use strict';
// Exercise the real renderer probe with delayed native input delivery. These
// scheduling tests do not stand in for installed Windows/User32 acceptance.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const smoke={exports:{}},filename=path.join(__dirname,'mouse-windows-smoke.cjs');
vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:smoke,require:name=>name==='electron'?{}:require(name)},{filename});
const {fillNativeAddress}=smoke.exports.fixtures;
const selector='.pane[data-pane="p0"] .pane-address input',oldURL='http://127.0.0.1:41234/second',url='http://127.0.0.1:41234/first';

function fixture(options={}){
 let time=10000,active=null,documentFocused=true;const queue=[],trace=[],waits=[],insertions=[],receipt={};
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
 const document={querySelector:value=>{assert.equal(value,selector);return current.node;},get activeElement(){return active;},hasFocus:()=>documentFocused};
 const context=vm.createContext({document,Date:{now:()=>time}});
 const js=async source=>JSON.parse(JSON.stringify(vm.runInContext(source,context)));
 const click=async value=>{
  assert.equal(value,selector);trace.push('native click queued');
  queue.push(()=>{if(!options.noFocus)active=original.node;trace.push('click delivered');});
 };
 const testKey=chord=>{
  assert.equal(chord,'CTRL+A');assert.equal(active,original.node,'CTRL+A must wait for the native click to focus its input');trace.push('CTRL+A queued');
  queue.push(()=>{
   trace.push('keydown delivered');
   const event={key:'a',ctrlKey:true,altKey:false,metaKey:false,isTrusted:!options.untrusted,target:options.wrongTarget?other:original.node,...options.key};
   if(!options.noKey)for(const listener of original.state.listeners)listener(event);
   if(options.replace){original.state.connected=false;current=field(oldURL);active=current.node;}
  });
  queue.push(()=>{
   if(!options.partial){current.state.start=0;current.state.end=current.state.value.length;}
   if(options.loseFocus)active=other;if(options.loseDocumentFocus)documentFocused=false;
   trace.push('selection delivered');
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
 return{run:()=>fillNativeAddress({selector,url,click,js,testKey,insertText,until,receipt,now:()=>time}),receipt,trace,waits,insertions,original,
  get value(){return current.state.value;},get observer(){return context.__mouseWindowsAddressSelection;}};
}

test('address insertion waits for the delivered native click, trusted CTRL+A and completed selection',async()=>{
 const f=fixture();await f.run();
 assert.deepEqual(f.trace,['native click queued','click delivered','CTRL+A queued','keydown delivered','selection delivered','insertText']);
 assert.equal(f.value,url);assert.deepEqual(f.insertions,[{value:oldURL,start:0,end:oldURL.length,at:13000}]);
 assert.equal(f.receipt.stage,'ready');assert.equal(f.receipt.focus.value,oldURL);assert.equal(f.receipt.focus.selectionStart,oldURL.length);
 assert.equal(f.receipt.selection.selectionStart,0);assert.equal(f.receipt.selection.selectionEnd,oldURL.length);
 assert.equal(f.receipt.selection.keys[0].trusted,true);assert.equal(f.receipt.selection.keys[0].targetSame,true);
 assert.equal(f.receipt.inserted.value,url);assert.equal(f.observer,undefined);assert.equal(f.original.state.listeners.size,0);
});

test('a click that never focuses the actual address input cannot send CTRL+A or insert text',async()=>{
 const f=fixture({noFocus:true});await assert.rejects(f.run(),/native address input focus/);
 assert.equal(f.receipt.stage,'focus');assert.equal(f.receipt.focus.focused,false);assert.equal(f.value,oldURL);
 assert.equal(f.trace.includes('CTRL+A queued'),false);assert.deepEqual(f.insertions,[]);assert.equal(f.observer,undefined);
});

test('selection alone, an untrusted or wrong key, and partial selection cannot authorize insertion',async()=>{
 for(const options of [{noKey:true},{untrusted:true},{wrongTarget:true},{key:{key:'s'}},{key:{ctrlKey:false}},{key:{altKey:true}},{key:{metaKey:true}},{partial:true}]){
  const f=fixture(options);await assert.rejects(f.run(),/native address CTRL\+A selection/);
  assert.equal(f.receipt.stage,'selection');assert.equal(f.value,oldURL);assert.deepEqual(f.insertions,[]);
  assert.equal(f.observer,undefined);assert.equal(f.original.state.listeners.size,0);
 }
});

test('replacement or focus loss after trusted CTRL+A cannot inherit the original input selection',async()=>{
 for(const options of [{replace:true},{loseFocus:true},{loseDocumentFocus:true}]){
  const f=fixture(options);await assert.rejects(f.run(),/native address CTRL\+A selection/);
  assert.equal(f.receipt.selection.keys[0].trusted,true);assert.equal(f.value,oldURL);assert.deepEqual(f.insertions,[]);
  if(options.replace){assert.equal(f.receipt.selection.sameInput,false);assert.equal(f.receipt.selection.connected,false);}
  assert.equal(f.observer,undefined);assert.equal(f.original.state.listeners.size,0);
 }
});

test('focus, selection and value share the original 15000ms window, including late delivery',async()=>{
 const passing=fixture({tickMs:3000});await passing.run();
 assert.deepEqual(passing.waits.map(wait=>wait.timeout),[15000,12000,6000]);assert.equal(passing.value,url);
 const late=fixture({tickMs:5000});await assert.rejects(late.run(),/native address CTRL\+A selection/);
 assert.deepEqual(late.waits.map(wait=>wait.timeout),[15000,10000]);assert.deepEqual(late.insertions,[]);assert.equal(late.value,oldURL);
 assert.equal(late.observer,undefined);assert.equal(late.original.state.listeners.size,0);
});
