'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),vm=require('node:vm');
const {createSearchVision,createVisionPageReader,installVisionObserver,sanitizeContext,sanitizeAction,WORLD_ID}=require('./mouse-search-vision.cjs');
const tick=()=>new Promise(setImmediate),pageContext=()=>({url:'https://example.test/path?secret=omit#fragment',title:'Owned page',scope:'selected-main-frame',viewport:{width:400,height:300,scrollX:0,scrollY:40},elements:[{role:'button',name:'Continue',selector:'body > button:nth-of-type(1)',bounds:{x:10,y:20,width:100,height:30},disabled:false,value:'must never cross',password:'must never cross'}],rawKeys:'must never cross'});
function fixture(){
 const calls=[],contexts=[],states=[];let privateMode=false,heldRead=null,heldInstall=null;
 const wc=new EventEmitter();Object.assign(wc,{id:9,url:'https://example.test/path',getURL(){return this.url;},isDestroyed:()=>false,executeJavaScriptInIsolatedWorld:async(world,scripts,gesture)=>{calls.push({world,code:scripts[0].code,gesture});const code=scripts[0].code;if(code.includes(']?.read('))return heldRead?heldRead:{context:pageContext(),events:[]};if(code.includes(']?.dispose()'))return;return heldInstall?heldInstall:true;}});Object.defineProperty(wc,'debugger',{get(){throw Error('Vision must not access another debugger');}});
 const record={id:'result',view:{webContents:wc},loading:false,visible:true,navigationEpoch:3},views=new EventEmitter();views.revision=1;views.target=id=>{if(id!==record.id||!record.visible)throw Error('not visible');return record;};
 const win=new EventEmitter();Object.assign(win,{isDestroyed:()=>false,isVisible:()=>true,isMinimized:()=>false});const powerMonitor=new EventEmitter(),vision=createSearchVision({views,win,powerMonitor,isPrivate:()=>privateMode,onState:row=>states.push(row),onContext:row=>contexts.push(row),pollMs:2000});
 return{vision,views,win,wc,record,powerMonitor,calls,contexts,states,setPrivate:value=>{privateMode=value;},holdRead:promise=>{heldRead=promise;},holdInstall:promise=>{heldInstall=promise;}};
}
test('Vision requires explicit selected-page consent and leaves debugger ownership untouched',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);await assert.rejects(f.vision.start({id:'result'}),/Показать экран/);await assert.rejects(f.vision.start({id:'unknown',consent:true}),/not visible/);assert.equal(f.calls.length,0);
 await f.vision.start({id:'result',consent:true});assert.equal(f.vision.state().active,true);assert.equal(f.vision.state().phase,'observing');assert.ok(f.calls.every(row=>row.world===WORLD_ID&&row.gesture===false));assert.equal(f.vision.state().url,'https://example.test/path');assert.equal(JSON.stringify(f.contexts).includes('must never cross'),false);assert.equal(f.contexts[0].untrustedContent,true);await f.vision.dispose();
});
test('real click receipts are normalized from the observed page viewport and extra fields are discarded',()=>{
 const context=sanitizeContext(pageContext()),event=sanitizeAction({type:'click',trusted:true,x:100,y:75,button:0,selector:'button',key:'password',value:'secret',normalizedX:1},context.viewport);
 assert.equal(event.normalizedX,.25);assert.equal(event.normalizedY,.25);assert.equal('key'in event,false);assert.equal('value'in event,false);assert.equal(sanitizeAction({type:'click',trusted:false,x:1,y:1,button:0},context.viewport),null);assert.equal(sanitizeAction({type:'keydown',trusted:true,x:1,y:1,button:0},context.viewport),null);assert.equal(sanitizeAction({type:'click',trusted:true,x:400,y:1,button:0},context.viewport),null);
});
test('large pages retain valid structured context within the actual model budget',()=>{
 const input=pageContext();input.elements=Array.from({length:120},()=>({...input.elements[0],name:'n'.repeat(160),selector:'s'.repeat(300)}));const result=sanitizeContext(input);assert.ok(result.elements.length>0&&result.elements.length<120);assert.equal(result.elementsTruncated,true);assert.ok(JSON.stringify(result).length<=6000);assert.deepEqual(result.viewport,input.viewport);assert.equal(result.url,'https://example.test/path');
});
test('navigation, virtualization, lock and private switching stop observation and clear shared context',async()=>{
 for(const reason of ['navigation','virtualized','lock','private']){
  const f=fixture();await f.vision.start({id:'result',consent:true});
  if(reason==='navigation')f.wc.emit('did-start-navigation',{},'https://example.test/new',false,true);
  if(reason==='virtualized')f.views.emit('invalidate',{id:'result',reason});
  if(reason==='lock')f.powerMonitor.emit('lock-screen');
  if(reason==='private'){f.setPrivate(true);await assert.rejects(f.vision.snapshot(),/остановлен/);await f.vision.stop('private');}
  await tick();assert.equal(f.vision.state().active,false);assert.equal(f.vision.state().context,null);assert.equal(f.vision.state().lastAction,null);assert.equal(f.wc.listenerCount('did-start-navigation'),0);assert.ok(f.calls.some(row=>row.code.includes(']?.dispose()')));await f.vision.dispose();assert.equal(f.views.listenerCount('invalidate'),0);assert.equal(f.powerMonitor.listenerCount('lock-screen'),0);
 }
});
test('a context that finishes after navigation never reaches the UI or model callback',async()=>{
 const f=fixture();await f.vision.start({id:'result',consent:true});const count=f.contexts.length;let finish;f.holdRead(new Promise(resolve=>{finish=resolve;}));const pending=f.vision.snapshot(),rejected=assert.rejects(pending,/остановлен/);await tick();f.record.navigationEpoch++;f.wc.emit('did-start-navigation',{},f.wc.url,false,true);finish({context:pageContext(),events:[{type:'click',trusted:true,x:5,y:5,button:0}]});await rejected;assert.equal(f.contexts.length,count);await f.vision.dispose();
});
test('stop during installation removes that observer and does not start a background poll',async()=>{
 const f=fixture();let finish;f.holdInstall(new Promise(resolve=>{finish=resolve;}));const pending=f.vision.start({id:'result',consent:true}),rejected=assert.rejects(pending,/остановлен/);await tick();const stopped=f.vision.stop('user');assert.equal(f.vision.state().active,false);finish(true);await Promise.all([rejected,stopped]);assert.equal(f.vision.timer,null);assert.equal(f.contexts.length,0);assert.ok(f.calls.some(row=>row.code.includes(']?.dispose()')));await f.vision.dispose();
});
test('a competing start cannot leave two installed observers',async()=>{
 const f=fixture();const first=f.vision.start({id:'result',consent:true}),rejected=assert.rejects(first,/остановлен/);const second=f.vision.start({id:'result',consent:true});await Promise.all([rejected,second]);assert.equal(f.wc.listenerCount('did-start-navigation'),1);await f.vision.dispose();
});
test('selected-page observer listens to trusted clicks only and removes all listeners on stop',()=>{
 const listeners=new Map();let observing=false,disconnected=false;class MutationObserver{constructor(callback){this.callback=callback;}observe(){observing=true;}disconnect(){disconnected=true;}}
 const context=vm.createContext({document:{addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)},MutationObserver,innerWidth:400,innerHeight:200,reader:{describe:()=>({selector:'button'}),context:pageContext}});
 vm.runInContext(`(${installVisionObserver.toString()})('testVision',reader)`,context);assert.equal(observing,true);assert.deepEqual([...listeners.keys()],['click']);const click=listeners.get('click'),target={nodeType:1};click({isTrusted:false,clientX:20,clientY:10,button:0,target});click({isTrusted:true,clientX:100,clientY:50,button:0,target});const value=vm.runInContext('testVision.read(true)',context);assert.equal(value.events.length,1);assert.equal(value.events[0].normalizedX,.25);assert.equal(value.events[0].normalizedY,.25);vm.runInContext('testVision.dispose()',context);assert.equal(disconnected,true);assert.equal(listeners.size,0);assert.equal(context.testVision,undefined);
});
test('DOM reader describes fields without reading values or password/contenteditable elements',()=>{
 let valueReads=0;const make=(tag,attrs={},label='')=>{const node={nodeType:1,tagName:tag.toUpperCase(),parentElement:null,labels:[],disabled:false,getAttribute:key=>attrs[key]||null,closest:()=>attrs.type==='password'||attrs.contenteditable?node:null,getBoundingClientRect:()=>({x:5,y:6,right:105,bottom:36,width:100,height:30}),cloneNode:()=>({querySelectorAll:()=>[],textContent:label})};Object.defineProperty(node,'value',{get(){valueReads++;throw Error('No form values');}});return node;};
 const safe=make('input',{'aria-label':'Email'},'typed content'),password=make('input',{type:'password','aria-label':'Password'},'secret'),editable=make('button',{contenteditable:'true'},'typed secret'),button=make('button',{},'Continue'),nodes=[safe,password,editable,button];
 const context=vm.createContext({document:{title:'Page',querySelectorAll:()=>nodes},location:{href:'https://example.test/path?token=omit'},innerWidth:400,innerHeight:300,scrollX:0,scrollY:0,URL,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})});
 const result=vm.runInContext(`(${createVisionPageReader.toString()})().context()`,context);assert.equal(valueReads,0);assert.deepEqual(Array.from(result.elements,element=>element.name),['Email','Continue']);assert.equal(result.url,'https://example.test/path');assert.equal(JSON.stringify(result).includes('typed'),false);assert.equal(JSON.stringify(result).includes('secret'),false);
});
