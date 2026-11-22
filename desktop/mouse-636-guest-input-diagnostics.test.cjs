'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {guestInputReadback,nativeGuestInputState,observeGuestClick,installInputTrace,inputTraceReadback,createBrowserInputTrace}=require('./mouse-636-guest-input-diagnostics.cjs');

function scene(){
 const calls=[],facts={guestClickAttempts:[],nativeInputs:[]};
 const bounds={x:0,y:74,width:597,height:686},state={windowBounds:{x:4,y:29,width:1200,height:794},contentBounds:{x:4,y:29,width:1200,height:794},cursor:{x:20,y:20},focus:{window:true,shell:true,guest:false,webContentsId:1},native:{cachedBounds:bounds,viewBounds:{...bounds},parentBounds:null,visible:true,parentVisible:true,cachedVisible:true,attached:true}};
 const details={selector:'#download-a',source:'CGEvent',tabId:'owned-page',webContentsId:2,point:{x:105,y:301},factor:1,contentBounds:{...state.contentBounds},pageBounds:{...bounds},hit:{ready:true,x:101,y:198},beforeCount:7,beforeGuest:{count:7,documentFocused:false,activeElement:{tagName:'BODY',id:''}}};
 let saved;
 const args={attempts:facts.guestClickAttempts,details,readNative:()=>state,
  post:async()=>{calls.push('post');state.cursor={...details.point};state.focus={window:true,shell:false,guest:true,webContentsId:2};return true;},
  readEvents:async()=>{calls.push('read-events');return[{id:'other-link',trusted:true}];},
  accept:events=>events.some(event=>event.id==='download-a'&&event.trusted),
  waitFor:async(check,label)=>{calls.push('wait');assert.equal(label,'634 trusted guest link #download-a');assert.equal(await check(),true);},
  label:'634 trusted guest link #download-a',save:async()=>{calls.push('save');saved=structuredClone(facts);}};
 return{args,calls,facts,state,get saved(){return saved;}};
}

test('timed-out trusted guest click persists actual attempt before cleanup and rethrows the same error',async()=>{
 const s=scene(),original=new Error('the existing trusted guest link timeout');
 s.args.waitFor=async check=>{s.calls.push('wait');assert.equal(await check(),false);throw original;};
 await assert.rejects(async()=>{const events=await observeGuestClick(s.args);s.facts.nativeInputs.push({events});},error=>error===original);
 assert.deepEqual(s.calls,['post','wait','read-events','save']);
 assert.deepEqual(s.saved.nativeInputs,[]);assert.equal(s.saved.guestClickAttempts.length,1);
 const r=s.saved.guestClickAttempts[0];
 assert.deepEqual(r.point,{x:105,y:301});assert.equal(r.beforeCount,7);assert.deepEqual(r.pageBounds,{x:0,y:74,width:597,height:686});
 assert.equal(r.before.native.focus.guest,false);assert.deepEqual(r.before.native.cursor,{x:20,y:20});
 assert.equal(r.posted.result,true);assert.equal(r.posted.native.focus.guest,true);assert.deepEqual(r.posted.native.cursor,r.point);
 assert.deepEqual(r.poll.events,[{id:'other-link',trusted:true}]);assert.equal(r.error.message,original.message);
 s.state.native.cachedBounds.height=1;assert.equal(r.before.native.native.cachedBounds.height,686);
});

test('successful observation keeps one native click and the original trusted-event result without saving during the wait',async()=>{
 const s=scene(),events=[{id:'download-a',trusted:true}];s.args.readEvents=async()=>{s.calls.push('read-events');return events;};
 const result=await observeGuestClick(s.args);s.facts.nativeInputs.push({events:result});
 assert.equal(result,events);assert.deepEqual(s.calls,['post','wait','read-events']);
 assert.equal(s.saved,undefined);assert.equal(s.facts.nativeInputs.length,1);
 assert.deepEqual(s.facts.guestClickAttempts[0].poll.events,events);assert.equal(s.facts.guestClickAttempts[0].error,undefined);
});

test('native diagnostic and diagnostic-save errors cannot replace the original timeout or create success',async()=>{
 const s=scene(),original=new Error('original timeout');
 s.args.readNative=()=>{throw Error('native read unavailable');};
 s.args.waitFor=async check=>{s.calls.push('wait');await check();throw original;};
 s.args.save=async()=>{s.calls.push('save');throw Error('diagnostic write failed');};
 await assert.rejects(observeGuestClick(s.args),error=>error===original);
 const r=s.facts.guestClickAttempts[0];
 assert.equal(r.before.native.diagnosticError.message,'native read unavailable');
 assert.equal(r.posted.result,true);assert.equal(r.posted.native.diagnosticError.message,'native read unavailable');
 assert.equal(r.failedNative.native.diagnosticError.message,'native read unavailable');
 assert.equal(r.diagnosticSaveError.message,'diagnostic write failed');assert.equal(r.error.message,original.message);
 assert.deepEqual(s.facts.nativeInputs,[]);assert.deepEqual(s.calls,['post','wait','read-events','save']);
});

test('raw native and DOM focus snapshots report mismatches and unavailable fields without changing input state',()=>{
 const page={bounds:{x:0,y:74,width:597,height:686},visible:true,
  view:{getBounds:()=>({x:2,y:3,width:590,height:680}),getVisible:()=>true,webContents:{isFocused:()=>false,getURL:()=> 'http://127.0.0.1:1/page/0/',isLoadingMainFrame:()=>false}},
  clipView:{getBounds:()=>({x:0,y:74,width:597,height:686}),getVisible:()=>true}};
 const win={getBounds:()=>({x:4,y:29,width:1200,height:794}),getContentBounds:()=>({x:4,y:29,width:1200,height:794}),isFocused:()=>true,webContents:{isFocused:()=>true},contentView:{children:[page.clipView]}};
 const value=nativeGuestInputState({win,page,screen:{getCursorScreenPoint:()=>{throw Error('cursor unavailable');}},webContents:{getFocusedWebContents:()=>({id:1})}});
 assert.equal(value.native.cachedBounds.width,597);assert.equal(value.native.viewBounds.width,590);
 assert.equal(value.native.attached,true);assert.equal(value.focus.webContentsId,1);assert.equal(value.cursor.diagnosticError.message,'cursor unavailable');
 const read=()=>vm.runInNewContext('('+guestInputReadback.toString()+')()',{mouse634:{clicks:[1,2,3]},document:{hasFocus:()=>{throw Error('DOM focus unavailable');}}});
 assert.equal(read().count,3);assert.equal(read().diagnosticError.message,'DOM focus unavailable');
});

test('optional event readback runs only after the original sole input and trusted-click outcome',async()=>{
 const s=scene(),events=[{id:'download-a',trusted:true}];
 s.args.readEvents=async()=>{s.calls.push('read-events');return events;};
 s.args.readTrace=async()=>{s.calls.push('trace');return{guest:{events:[{type:'click',trusted:true}]}};};
 assert.equal(await observeGuestClick(s.args),events);
 assert.deepEqual(s.calls,['post','wait','read-events','trace']);
 const attempt=s.facts.guestClickAttempts[0];assert.equal(attempt.clock.kind,'main-performance');
 assert.ok(attempt.clock.before<=attempt.clock.posted&&attempt.clock.posted<=attempt.clock.settled);
 assert.equal(attempt.inputTrace.guest.events[0].type,'click');assert.equal(s.saved,undefined);
});

test('event readback failure preserves the original timeout and saved failure identity',async()=>{
 const s=scene(),original=new Error('original trusted event timeout');
 s.args.waitFor=async check=>{s.calls.push('wait');assert.equal(await check(),false);throw original;};
 s.args.readTrace=async()=>{s.calls.push('trace');throw Error('renderer gone');};
 await assert.rejects(observeGuestClick(s.args),error=>error===original);
 assert.deepEqual(s.calls,['post','wait','read-events','trace','save']);
 const attempt=s.saved.guestClickAttempts[0];assert.equal(attempt.error.message,original.message);
 assert.equal(attempt.inputTrace.diagnosticError.message,'renderer gone');assert.deepEqual(s.saved.nativeInputs,[]);
});

function traceScene(surface='guest'){
 const listeners=new Map(),removed=[];let now=10,focused=false,hit;
 const bounds={x:17,y:141,width:166,height:16,left:17,top:141,right:183,bottom:157};
 const target={tagName:'A',nodeName:'A',id:'download-a',className:'owned',contains:value=>value===target,
  getBoundingClientRect:()=>({...bounds}),getClientRects:()=>[{...bounds}],focus(){throw Error('Diagnostics must not focus');}};
 hit=target;
 const document={hasFocus:()=>focused,activeElement:{tagName:'BODY',id:''},querySelector:selector=>selector==='#download-a'?target:null,elementFromPoint:(x,y)=>x===100&&y===149?hit:null};
 const context=vm.createContext({document,structuredClone,performance:{timeOrigin:1234000,now:()=>++now},innerWidth:597,innerHeight:686,devicePixelRatio:1,scrollX:0,scrollY:130,
  addEventListener(type,handler,options){assert.deepEqual({...options},{capture:true,passive:true});assert.ok(!listeners.has(type));listeners.set(type,handler);},
  removeEventListener(type,handler,capture){assert.equal(capture,true);assert.equal(listeners.get(type),handler);removed.push(type);listeners.delete(type);}});
 vm.runInContext('('+installInputTrace.toString()+')('+JSON.stringify(surface)+')',context);
 const snapshot=options=>JSON.parse(JSON.stringify(vm.runInContext('('+inputTraceReadback.toString()+')('+JSON.stringify(options||{})+')',context)));
 function event(type,changes={}){const value={type,target,relatedTarget:null,timeStamp:++now,isTrusted:true,clientX:100,clientY:149,screenX:104,screenY:252,button:0,buttons:1,detail:1,pointerId:1,pointerType:'mouse',defaultPrevented:false,eventPhase:1,composedPath:()=>[target,document],preventDefault(){throw Error('Diagnostics must not cancel');},stopPropagation(){throw Error('Diagnostics must not stop propagation');},...changes};listeners.get(type)?.(value);return value;}
 return{context,listeners,removed,target,document,event,snapshot,setFocus(value){focused=value;},setHit(value){hit=value;}};
}

test('serialized passive collector retains trusted pointer/mouse/focus order and actual hit geometry',()=>{
 const s=traceScene(),types=['pointerdown','mousedown','focus','pointerup','mouseup','click','blur','pointercancel'];
 for(const type of types){s.setFocus(type!=='blur');s.event(type,{isTrusted:type!=='pointercancel'});}
 const r=s.snapshot({selector:'#download-a',point:{x:100,y:149}});
 assert.deepEqual(r.events.map(row=>row.type),types);assert.deepEqual(r.events.map(row=>row.sequence),[1,2,3,4,5,6,7,8]);
 assert.ok(r.events.every((row,i)=>!i||row.at>r.events[i-1].at));assert.equal(r.events[7].trusted,false);
 assert.deepEqual(r.events[0].client,{x:100,y:149});assert.deepEqual(r.events[0].screen,{x:104,y:252});
 assert.equal(r.target.id,'download-a');assert.equal(r.hitTarget.id,'download-a');assert.equal(r.targetContainsHit,true);
 assert.equal(r.targetBounds.width,166);assert.equal(r.clock.surface,'guest');assert.equal(r.clock.timeOrigin,1234000);assert.equal(r.errorCount,0);
 s.setHit({tagName:'DIV',id:'overlay',className:''});assert.equal(s.snapshot({selector:'#download-a',point:{x:100,y:149}}).targetContainsHit,false);
});

test('collector bounds preserve first and last events with explicit drops and truncation',()=>{
 const s=traceScene('shell');s.target.id='x'.repeat(1000);s.target.className='c'.repeat(1000);
 s.target.getClientRects=()=>Array.from({length:20},()=>s.target.getBoundingClientRect());
 for(let i=0;i<140;i++)s.event('mousedown',{composedPath:()=>Array(20).fill(s.target)});
 const r=s.snapshot({selector:'#download-a',point:{x:100,y:149}});
 assert.equal(r.observedEvents,140);assert.equal(r.events.length,64);assert.equal(r.droppedEvents,76);
 assert.deepEqual(r.events.slice(0,16).map(row=>row.sequence),Array.from({length:16},(_,i)=>i+1));
 assert.deepEqual(r.events.slice(16).map(row=>row.sequence),Array.from({length:48},(_,i)=>i+93));
 assert.ok(r.events.every(row=>row.target.id.length===96&&row.target.className.length===96&&row.path.length===4));
 assert.equal(r.targetRects.length,8);assert.equal(r.truncated.paths,140);assert.equal(r.truncated.rects,1);assert.ok(r.truncated.strings>0);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<100000,'One bounded surface report stays below100kB with adversarial long DOM labels');
 const prior=r.events[0].target.id;r.events[0].target.id='changed';assert.equal(s.snapshot().events[0].target.id,prior);
});

test('collector errors remain bounded and dispose removes every passive listener',()=>{
 const s=traceScene();s.document.hasFocus=()=>{throw Error('unavailable focus');};
 for(let i=0;i<10;i++)s.event('blur');
 const r=s.snapshot();assert.equal(r.events.length,10);assert.equal(r.errors.length,4);assert.ok(r.errorCount>=10);assert.equal(r.droppedErrors,r.errorCount-4);
 vm.runInContext('__mouse636InputTrace.dispose()',s.context);
 assert.equal(s.listeners.size,0);assert.equal(s.removed.length,8);assert.deepEqual(s.snapshot(),{unavailable:true});
});

test('Electron boundary records owned input without canceling, retaining event objects or claiming DOM trust',()=>{
 const {EventEmitter}=require('node:events'),shell=Object.assign(new EventEmitter(),{id:1}),guest=Object.assign(new EventEmitter(),{id:2}),other=Object.assign(new EventEmitter(),{id:3});
 const trace=createBrowserInputTrace();trace.observe(shell,'shell');trace.observe(guest,'guest');trace.observe(guest,'guest');
 assert.equal(shell.listenerCount('before-mouse-event'),1);assert.equal(guest.listenerCount('before-mouse-event'),1);assert.equal(other.listenerCount('before-mouse-event'),0);
 const event={defaultPrevented:false,preventDefault(){throw Error('Diagnostic canceled native input');}},input={type:'mouseDown',x:100,y:149,button:'left',clickCount:1,modifiers:['leftButtonDown']};
 shell.emit('before-mouse-event',event,{...input,type:'mouseLeave'});guest.emit('before-mouse-event',event,input);guest.emit('before-mouse-event',event,{...input,type:'mouseUp'});
 input.x=999;input.modifiers.push('changed');
 const read=trace.snapshot();assert.deepEqual(read.events.map(row=>[row.webContentsId,row.type]),[[1,'mouseLeave'],[2,'mouseDown'],[2,'mouseUp']]);
 assert.equal(event.defaultPrevented,false);assert.equal(read.events[1].x,100);assert.deepEqual(read.events[1].modifiers,['leftButtonDown']);assert.equal(read.events[1].trusted,undefined);
 assert.equal(read.clock.kind,'main-performance');assert.ok(read.events[0].at<=read.events[2].at);
 read.events[0].type='changed';assert.equal(trace.snapshot().events[0].type,'mouseLeave');
 assert.equal(trace.dispose().disposed,true);assert.equal(shell.listenerCount('before-mouse-event'),0);assert.equal(guest.listenerCount('before-mouse-event'),0);
 guest.emit('before-mouse-event',event,input);assert.equal(trace.snapshot().observedEvents,3);
});

test('Electron event, surface and error storage stays bounded with explicit drops',()=>{
 const {EventEmitter}=require('node:events'),trace=createBrowserInputTrace(),surfaces=Array.from({length:18},(_,id)=>Object.assign(new EventEmitter(),{id}));
 surfaces.forEach(wc=>trace.observe(wc,'guest'));
 for(let i=0;i<140;i++)surfaces[0].emit('before-mouse-event',{}, {type:'mouseMove',x:i,button:'x'.repeat(1000),modifiers:Array(20).fill('m'.repeat(1000))});
 const row=trace.snapshot();assert.equal(row.surfaces.length,16);assert.equal(row.droppedSurfaces,2);assert.equal(row.observedEvents,140);assert.equal(row.droppedEvents,76);assert.equal(row.events.length,64);
 assert.deepEqual(row.events.slice(0,16).map(event=>event.sequence),Array.from({length:16},(_,i)=>i+1));assert.deepEqual(row.events.slice(16).map(event=>event.sequence),Array.from({length:48},(_,i)=>i+93));
 assert.equal(row.events[0].button.length,96);assert.equal(row.events[0].modifiers.length,8);assert.equal(row.truncated.modifiers,140);
 for(let i=0;i<10;i++)trace.observe({get id(){throw Error('destroyed WebContents');}},'guest');
 const errors=trace.snapshot();assert.equal(errors.errorCount,10);assert.equal(errors.errors.length,4);assert.equal(errors.droppedErrors,6);
 trace.dispose();assert.ok(surfaces.every(wc=>wc.listenerCount('before-mouse-event')===0));
});

test('optional AppKit and Electron observations occur at original before/post/failure read points and cannot alter timeout',async()=>{
 const s=scene(),reads=[],original=new Error('original timeout');
 const page={bounds:{},visible:true,view:{getBounds:()=>({}),getVisible:()=>true,webContents:{isFocused:()=>false,getURL:()=>'',isLoadingMainFrame:()=>false}}};
 const win={getBounds:()=>({}),getContentBounds:()=>({}),isFocused:()=>true,webContents:{isFocused:()=>true},contentView:{children:[page.view]}};
 const args={win,page,screen:{getCursorScreenPoint:()=>({})},webContents:{getFocusedWebContents:()=>null},readAppKit:()=>{reads.push('appkit');return{observedEvents:reads.length};},readBrowser:()=>{reads.push('browser');throw Error('browser read unavailable');}};
 s.args.readNative=()=>{s.calls.push('native');return nativeGuestInputState(args);};
 s.args.waitFor=async check=>{s.calls.push('wait');await check();throw original;};
 await assert.rejects(observeGuestClick(s.args),error=>error===original);
 assert.deepEqual(s.calls,['native','post','native','wait','read-events','native','save']);assert.deepEqual(reads,['appkit','browser','appkit','browser','appkit','browser']);
 const attempt=s.facts.guestClickAttempts[0];assert.equal(attempt.before.native.appkit.observedEvents,1);assert.equal(attempt.posted.native.appkit.observedEvents,3);assert.equal(attempt.failedNative.native.appkit.observedEvents,5);assert.equal(attempt.before.native.browserInput.diagnosticError.message,'browser read unavailable');
 assert.equal(attempt.error.message,original.message);assert.deepEqual(s.facts.nativeInputs,[]);
});
