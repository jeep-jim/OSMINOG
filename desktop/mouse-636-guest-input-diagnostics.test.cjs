'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {guestInputReadback,nativeGuestInputState,observeGuestClick}=require('./mouse-636-guest-input-diagnostics.cjs');

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
