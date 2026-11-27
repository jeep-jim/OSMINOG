'use strict';
// Synthetic renderer scheduling: production probes observe delivered events.
// The installed native suite still provides the OS click and exact final value.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {inputProbe,enterShellText}=require('./mouse-641-workspace-smoke.cjs').fixtures;
const selector='#settings-adblock-exception-url',value='https://LOCALHOST:443/owned?path=one';
function fixture({initial='',selectDelay=0,backspaceDelay=3,dropKeyup=false,untrusted=false,loseFocus=false,inserted=value,failDiagnostic=false}={}){
 const input={id:selector.slice(1),tagName:'INPUT',type:'text',value:initial,selectionStart:initial.length,selectionEnd:initial.length,selectionDirection:'none',contains:target=>target===input};
 const other={id:'other',tagName:'INPUT',type:'text'},listeners=new Map(),pending=[],trace=[],records=[];let tick=0,clicks=0,inserts=0,failed=false;
 const document={activeElement:input,querySelector:s=>s===selector?input:null,addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
 const context=vm.createContext({document,Date});
 const emit=(type,key)=>listeners.get(type)?.({type,key,target:document.activeElement,isTrusted:!untrusted});
 const deliver=event=>{
  trace.push(['deliver',event.type,event.keyCode,tick]);
  if(event.keyCode==='A'&&event.type==='keyDown'){input.selectionStart=0;input.selectionEnd=input.value.length;}
  if(event.keyCode==='Backspace'&&event.type==='keyDown'){
   if(loseFocus)document.activeElement=other;
   const start=input.selectionStart,end=input.selectionEnd,from=start===end?Math.max(0,start-1):start;
   input.value=input.value.slice(0,from)+input.value.slice(end);input.selectionStart=input.selectionEnd=from;emit('input');
  }
  if(!(dropKeyup&&event.keyCode==='Backspace'&&event.type==='keyUp'))emit(event.type==='keyDown'?'keydown':'keyup',event.keyCode==='A'?'a':'Backspace');
 };
 const flush=()=>{tick++;for(let i=0;i<pending.length;){if(pending[i].at<=tick)deliver(pending.splice(i,1)[0].event);else i++;}};
 const webContents={
  sendInputEvent(event){trace.push(['send',event.type,event.keyCode,tick]);const delay=event.keyCode==='A'?selectDelay:backspaceDelay;if(delay)pending.push({at:tick+delay+(event.type==='keyUp'?1:0),event});else deliver(event);},
  async insertText(text){assert.equal(text,value);inserts++;trace.push(['insert',tick]);input.value=inserted;input.selectionStart=input.selectionEnd=input.value.length;emit('input');}
 };
 const read=async script=>{if(failed&&failDiagnostic)throw Error('diagnostic renderer unavailable');return vm.runInContext(script,context);};
 const until=async(check,label,ms)=>{assert.ok(ms>=0&&ms<=12000);for(let i=0;i<12;i++){if(await check())return;flush();}failed=true;throw Error('bounded '+label);};
 const click=async s=>{assert.equal(s,selector);clicks++;vm.runInContext('('+inputProbe.toString()+')('+JSON.stringify(s)+')',context);for(const type of ['pointerdown','pointerup','click'])emit(type);return{selector:s,source:'CGEvent',events:JSON.parse(JSON.stringify(context.__mouse641Input.events))};};
 return{run:()=>enterShellText({selector,value,click,webContents,read,until,platform:'darwin',record:row=>records.push(row)}),click,webContents,flush,input,document,other,trace,records,get clicks(){return clicks;},get inserts(){return inserts;},get pending(){return pending.length;}};
}
test('delayed Backspace reproduces one-character loss; an already-empty native-focused target queues no editing keys',async()=>{
 const naive=fixture();await naive.click(selector);
 for(const type of ['keyDown','keyUp'])naive.webContents.sendInputEvent({type,keyCode:'A',modifiers:['meta']});
 for(const type of ['keyDown','keyUp'])naive.webContents.sendInputEvent({type,keyCode:'Backspace'});
 await naive.webContents.insertText(value);while(naive.pending)naive.flush();
 assert.equal(naive.input.value,'https://LOCALHOST:443/owned?path=on','The old dispatch order can delete the last inserted character');
 const f=fixture(),row=await f.run();assert.equal(f.input.value,value);assert.equal(f.clicks,1);assert.equal(f.inserts,1);assert.equal(f.trace.filter(x=>x[0]==='send').length,0);assert.equal(f.pending,0);
 assert.equal(row.preparation,'already-empty');assert.equal(row.source,'native focus and webContents.insertText');assert.equal(row.selected,undefined);assert.equal(row.cleared,undefined);
 for(const snapshot of [row.before,row.prepared]){assert.equal(snapshot.value,'');assert.equal(snapshot.selectionStart,0);assert.equal(snapshot.selectionEnd,0);assert.equal(snapshot.focused,true);assert.equal(snapshot.sameTarget,true);}
 assert.equal(row.after.value,value);assert.equal(row.stage,'complete');assert.ok(row.events.some(e=>e.type==='input'&&e.trusted&&e.matches));assert.ok(!row.events.some(e=>e.type==='keydown'||e.type==='keyup'));
});
test('select-all must arrive and cover existing text before Backspace is sent',async()=>{
 const f=fixture({initial:'old retained entry',selectDelay:3}),row=await f.run();
 assert.equal(row.selected.value,'old retained entry');assert.equal(row.selected.selectionStart,0);assert.equal(row.selected.selectionEnd,'old retained entry'.length);
 assert.ok(f.trace.findIndex(x=>x[0]==='send'&&x[2]==='Backspace')>f.trace.findIndex(x=>x[0]==='deliver'&&x[1]==='keyUp'&&x[2]==='A'));
 assert.ok(f.trace.findIndex(x=>x[0]==='insert')>f.trace.findIndex(x=>x[0]==='deliver'&&x[1]==='keyUp'&&x[2]==='Backspace'));
 assert.equal(row.preparation,'delivered-clear');assert.equal(row.source,'native focus, webContents.sendInputEvent and insertText');assert.equal(row.cleared.value,'');assert.equal(f.input.value,value);assert.equal(f.inserts,1);
});
test('missing or untrusted clearing keyup fails before insertion and retains actual events and selection',async()=>{
 for(const options of [{dropKeyup:true},{untrusted:true}]){
  const f=fixture({initial:'old',...options});await assert.rejects(f.run(),/bounded 641 (clearing keys|select-all) delivered/);
  assert.equal(f.inserts,0);assert.equal(f.clicks,1);assert.equal(f.records.length,1);const row=f.records[0];
  assert.equal(row.failure.value,options.untrusted?'old':'');assert.equal(row.failure.focused,true);assert.equal(row.failure.activeElement.id,selector.slice(1));assert.equal(row.failure.selectionStart,0);assert.equal(row.failure.selectionEnd,options.untrusted?3:0);
  assert.ok(row.failure.events.some(e=>e.type==='keydown'));assert.match(row.error.message,/bounded/);
  while(f.pending)f.flush();await Promise.resolve();assert.equal(f.inserts,0,'Late event delivery cannot trigger insertion after rejection');
 }
});
test('focus leaving the exact clicked control prevents insertion despite delivered clearing keys',async()=>{
 const f=fixture({initial:'old',loseFocus:true});await assert.rejects(f.run(),/bounded 641 clearing keys delivered/);assert.equal(f.inserts,0);
 assert.equal(f.records[0].failure.focused,false);assert.equal(f.records[0].failure.activeElement.id,'other');assert.equal(f.records[0].failure.sameTarget,true);
});
test('a wrong final value remains a failure with its actual DOM value; no corrective insertion is attempted',async()=>{
 const f=fixture({inserted:value.slice(0,-1)});await assert.rejects(f.run(),/bounded 641 entered text/);assert.equal(f.inserts,1);assert.equal(f.records[0].failure.value,value.slice(0,-1));
 assert.ok(f.records[0].failure.events.some(e=>e.type==='input'&&e.trusted));assert.equal(f.records[0].stage,'insert');
});
test('failure diagnostics cannot replace the original preparation exception',async()=>{
 const f=fixture({initial:'old',dropKeyup:true,failDiagnostic:true});await assert.rejects(f.run(),/bounded 641 clearing keys delivered/);
 assert.match(f.records[0].error.message,/bounded 641 clearing keys delivered/);assert.equal(f.records[0].diagnosticError,'diagnostic renderer unavailable');assert.equal(f.inserts,0);
});
test('an empty field still requires the clicked target to hold focus and a trusted matching insertion',async()=>{
 const lost=fixture();lost.document.activeElement=lost.other;await assert.rejects(lost.run(),/bounded 641 text target focus/);assert.equal(lost.inserts,0);
 const untrusted=fixture({untrusted:true});await assert.rejects(untrusted.run(),/bounded 641 entered text/);assert.equal(untrusted.inserts,1);assert.equal(untrusted.records[0].stage,'insert');
});
