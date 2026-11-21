'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {siteHTML,searchRows,assertSearchGeometry,searchWheelTargetProblems,dispatchSearchWheel,recordSearchWheelFailure,finishSearchWheel,PALETTE,TYPES}=require('./mouse-634-search-smoke.cjs');
const {parseOpenGraph,normalizeResult}=require('./mouse-search-service.cjs');
const {wheelPreparationBudget}=require('./mouse-630-gesture-smoke.cjs');
const {EventEmitter}=require('node:events');
function cleanupTarget(){const wc=new EventEmitter();wc.id=12;let destroyed=false;wc.isDestroyed=()=>destroyed;wc.destroy=()=>{destroyed=true;wc.emit('destroyed');};return wc;}

function scene(){
 const style={backgroundColor:'rgba(255, 255, 255, 0.5)',backgroundImage:'none',borderRadius:'5px',boxShadow:'none',backdropFilter:'none'};
 return{size:[1000,700],ui:{open:true,footerButtons:{immediatelyBefore:true,search:{x:30,width:23},emoji:{x:56,width:23},searchStyle:style,emojiStyle:{...style}},left:{x:0,width:640},right:{x:646,width:354},footer:{y:665},viewport:{x:10.1,y:130.2,width:620.6,height:520.7},cards:[{id:'a',bounds:{x:20.1,y:80.4,width:250.5,height:650.8}}]},state:{liveCount:1,pages:[{id:'a',visible:true,bounds:{x:21,y:131,width:249,height:519},clip:{x:21,y:131,width:249,height:519},radius:12}]}};
}
test('the installed search geometry gate measures the actual inward viewport intersection',()=>{
 const {ui,state,size}=scene();assert.equal(assertSearchGeometry(ui,state,size).length,1);
 for(const bounds of [{x:20,y:130,width:251,height:521},{x:21,y:131,width:249,height:535},{x:21,y:131,width:630,height:519}]){const wrong=structuredClone(state);wrong.pages[0].bounds=bounds;wrong.pages[0].clip=bounds;assert.throws(()=>assertSearchGeometry(ui,wrong,size));}
});
test('the installed search gate rejects too many native pages, missing owners and square corners',()=>{
 const {ui,state,size}=scene();for(const mutate of [value=>{value.liveCount=9;},value=>{value.pages[0].id='unowned';},value=>{value.pages[0].radius=0;},value=>{value.pages[0].clip.height--;}]){const wrong=structuredClone(state);mutate(wrong);assert.throws(()=>assertSearchGeometry(ui,wrong,size));}
});
test('the footer gate requires adjacent search and emoji controls with the same glass style',()=>{
 const {ui,state,size}=scene();for(const mutate of [value=>{value.footerButtons.immediatelyBefore=false;},value=>{value.footerButtons.search.x=100;},value=>{value.footerButtons.searchStyle.boxShadow='0 0 0 10px red';}]){const wrong=structuredClone(ui);mutate(wrong);assert.throws(()=>assertSearchGeometry(wrong,state,size));}
});
test('owned search pagination binds unique result URLs to two distinct fixture origins',()=>{
 const origins=['http://127.0.0.1:43111','http://127.0.0.1:43112'],first=searchRows(1,origins),second=searchRows(2,origins),all=[...first,...second];assert.equal(first.length,9);assert.equal(second.length,3);assert.equal(searchRows(3,origins).length,0);assert.equal(new Set(all.map(row=>row.url)).size,12);assert.deepEqual(new Set(all.map(row=>new URL(row.url).origin)),new Set(origins));for(let index=0;index<all.length;index++){assert.equal(all[index].url,origins[index%2]+'/site/'+index);assert.deepEqual(PALETTE[index].map(value=>Number.isInteger(value)&&value>=0&&value<=255),[true,true,true]);}
});
test('native website fixtures exercise real OG article, video and product metadata parsing',()=>{
 const origins=['http://127.0.0.1:43111','http://127.0.0.1:43112'];for(const [index,row]of searchRows(1,origins).entries()){const metadata=parseOpenGraph(siteHTML(index),row.url,origins),result=normalizeResult({...row,...metadata},origins);assert.equal(result.type,TYPES[index%3]);assert.equal(result.title,'Owned result '+index);assert.equal(result.url,row.url);if(result.type==='product')assert.ok(String(result.price).includes(String(100+index)));}
});
function wheelTarget(){
 const bounds={x:18,y:172,width:306,height:89},contentBounds={x:4,y:29,width:1016,height:676},point={x:40,y:40};
 const pin={identity:'owned-five',timeOrigin:123,url:'http://127.0.0.1:43112/site/5',webContentsId:12,revision:4,navigationEpoch:1,bounds,contentBounds,zoom:1};
 const native={current:true,destroyed:false,webContentsId:12,revision:4,navigationEpoch:1,url:pin.url,visible:true,viewVisible:true,attached:true,blocked:false,loading:false,focused:true,bounds,zoom:1,window:{visible:true,focused:true,minimized:false,contentBounds}};
 return{pin,point,native,before:structuredClone(native),dom:{identity:pin.identity,timeOrigin:123,url:pin.url,readyState:'complete',visibilityState:'visible',focused:true,viewport:{width:306,height:89},point,hit:true,pointer:{trusted:true,x:40,y:40}}};
}
test('search wheel readiness rejects a virtualized or changed native owner before input',()=>{
 assert.deepEqual(searchWheelTargetProblems(wheelTarget(),true),[]);
 for(const mutate of [s=>{s.native.current=false;},s=>{s.native.destroyed=true;},s=>{s.native.webContentsId=13;},s=>{s.native.navigationEpoch++;},s=>{s.native.revision++;},s=>{s.dom.identity='new-document';},s=>{s.dom.timeOrigin++;}]){const snapshot=wheelTarget();mutate(snapshot);assert.ok(searchWheelTargetProblems(snapshot,true).some(reason=>reason.startsWith('identity:')));}
});
test('search wheel readiness requires actual attached geometry, completed loading and native/document focus',()=>{
 for(const mutate of [s=>{s.native.viewVisible=false;},s=>{s.native.attached=false;},s=>{s.native.loading=true;},s=>{s.native.blocked=true;},s=>{s.native.focused=false;},s=>{s.dom.focused=false;},s=>{s.native.window.focused=false;},s=>{s.before.bounds.y++;},s=>{s.native.bounds={...s.native.bounds,y:173};},s=>{s.native.zoom=2;},s=>{s.before.zoom=2;},s=>{s.dom.point={x:40,y:90};},s=>{s.dom.hit=false;}]){const snapshot=wheelTarget();mutate(snapshot);assert.ok(searchWheelTargetProblems(snapshot,true).length>0);}
});
test('search wheel readiness requires a real pointer receipt at the current guest point',()=>{
 for(const pointer of [null,{trusted:false,x:40,y:40},{trusted:true,x:40,y:39}]){const snapshot=wheelTarget();snapshot.dom.pointer=pointer;assert.deepEqual(searchWheelTargetProblems(snapshot,false),[]);assert.ok(searchWheelTargetProblems(snapshot,true).includes('native-pointer-not-observed'));}
 const scaled=wheelTarget();scaled.pin.zoom=scaled.native.zoom=scaled.before.zoom=2;scaled.dom.point={x:20,y:20};scaled.dom.pointer={trusted:true,x:20,y:20};assert.deepEqual(searchWheelTargetProblems(scaled,true),[]);
});
test('search wheel persists real dispatch boundaries and sends exactly one unchanged native input',async()=>{
 const snapshots=[],sent={type:'mouseWheel',x:40,y:40,deltaX:0,deltaY:-650,canScroll:true,hasPreciseScrollingDeltas:true},proof={sent},calls=[];
 const save=async()=>snapshots.push(structuredClone(proof));
 await dispatchSearchWheel({budget:wheelPreparationBudget({timeoutMs:10000}),proof,save,dispatch:event=>{assert.equal(event,sent);assert.equal(snapshots.at(-1).dispatchStage,'before-send');assert.equal(snapshots.at(-1).sentAt,undefined);calls.push(event);}});
 assert.equal(calls.length,1);assert.equal(snapshots[0].status,'prepared');assert.equal(snapshots.at(-1).status,'sent');assert.equal(snapshots.at(-1).dispatchStage,'returned');assert.ok(proof.intentSavedAt<=proof.sentAt&&proof.sentAt<=proof.dispatchReturnedAt);
});
test('a native dispatch exception retains the last truthful pre-dispatch checkpoint',async()=>{
 const snapshots=[],proof={sent:{type:'mouseWheel',deltaY:-650}},error=Error('native dispatch failed');
 await assert.rejects(dispatchSearchWheel({budget:wheelPreparationBudget({timeoutMs:10000}),proof,save:async()=>snapshots.push(structuredClone(proof)),dispatch:()=>{throw error;}}),value=>value===error);
 assert.equal(snapshots.at(-1).dispatchStage,'before-send');assert.equal(proof.dispatchReturnedAt,undefined);assert.notEqual(proof.status,'sent');
});
test('unresponsive failure renderers cannot hide the original wheel timeout or block saved evidence',{timeout:1000},async()=>{
 const proof={},snapshots=[],never=()=>new Promise(()=>{}),error=Error('trusted wheel receipt timeout');
 await recordSearchWheelFailure({proof,error,save:async()=>snapshots.push(structuredClone(proof)),native:()=>({focused:true}),ui:never,read:never,timeoutMs:20});
 assert.equal(snapshots[0].status,'failed');assert.deepEqual(snapshots[0].error,{message:error.message});assert.deepEqual(snapshots[0].failureNative,{focused:true});assert.equal(snapshots[0].failureUIError,undefined);
 assert.match(proof.failureUIError,/timeout/);assert.match(proof.failureReadError,/timeout/);assert.equal(proof.error.message,error.message);assert.equal(proof.failureUI,undefined);assert.equal(proof.failure,undefined);assert.equal(snapshots.length,3);
});
test('unresponsive pointer cleanup settles without masking an existing wheel failure',{timeout:1000},async()=>{
 const proof={status:'failed',error:{message:'trusted wheel receipt timeout'}},snapshots=[],wc=cleanupTarget();
 await finishSearchWheel({proof,wc,save:async()=>snapshots.push(structuredClone(proof)),cleanup:()=>new Promise(()=>{}),timeoutMs:20});
 assert.equal(proof.status,'failed');assert.equal(proof.error.message,'trusted wheel receipt timeout');assert.match(proof.cleanupError,/timeout/);assert.ok(proof.finishedAt>=proof.cleanupStartedAt);assert.equal(snapshots.at(-1).finishedAt,proof.finishedAt);
 assert.equal(proof.pointerCleanup.outcome,'failed');assert.equal(proof.pointerCleanup.destroyedObserved,false);assert.equal(wc.listenerCount('destroyed'),0);
});
test('pointer cleanup failure cannot turn an otherwise completed wheel into a passing report',async()=>{
 const proof={status:'completed'},error=Error('observer cleanup failed'),wc=cleanupTarget();
 await assert.rejects(finishSearchWheel({proof,wc,save:async()=>{},cleanup:()=>{throw error;}}),value=>value===error);assert.equal(proof.status,'failed');assert.equal(proof.cleanupError,error.message);assert.equal(wc.listenerCount('destroyed'),0);
});
test('virtualized target destruction completes pending pointer cleanup with an observed receipt',{timeout:1000},async()=>{
 const proof={status:'completed'},wc=cleanupTarget();let removalCalls=0;
 await finishSearchWheel({proof,wc,save:async()=>{},cleanup:()=>{assert.equal(wc.listenerCount('destroyed'),1);removalCalls++;queueMicrotask(()=>wc.destroy());return new Promise(()=>{});},timeoutMs:20});
 assert.equal(removalCalls,1);assert.equal(proof.status,'completed');assert.equal(proof.pointerCleanup.outcome,'webcontents-destroyed');assert.equal(proof.pointerCleanup.destroyedObserved,true);assert.equal(proof.pointerCleanup.destructionSource,'destroyed-event');assert.equal(proof.pointerCleanup.removalResolved,false);assert.equal(proof.cleanupError,undefined);assert.equal(wc.listenerCount('destroyed'),0);
});
test('already destroyed wheel target never receives renderer cleanup and leaves no listener',async()=>{
 const proof={status:'completed'},wc=cleanupTarget();wc.destroy();
 await finishSearchWheel({proof,wc,save:async()=>{},cleanup:()=>{assert.fail('destroyed target cannot run JavaScript');}});
 assert.equal(proof.pointerCleanup.outcome,'webcontents-destroyed');assert.equal(proof.pointerCleanup.destructionSource,'before-subscription');assert.equal(wc.listenerCount('destroyed'),0);
});
test('successful removal of an alive target is recorded distinctly from destruction',async()=>{
 const proof={status:'completed'},wc=cleanupTarget();
 await finishSearchWheel({proof,wc,save:async()=>{},cleanup:async()=>{}});
 assert.equal(proof.pointerCleanup.outcome,'observer-removed');assert.equal(proof.pointerCleanup.removalResolved,true);assert.equal(proof.pointerCleanup.destroyedObserved,false);assert.equal(wc.listenerCount('destroyed'),0);
});
test('secondary evidence write errors retain the wheel failure and still remove the observer',async()=>{
 const proof={},error=Error('missing trusted wheel receipt'),wc=cleanupTarget(),save=async()=>{throw Error('fixture disk unavailable');};let cleaned=false;
 await recordSearchWheelFailure({proof,error,save,ui:async()=>({scrollTop:1300})});
 await finishSearchWheel({proof,wc,save,cleanup:async()=>{cleaned=true;}});
 assert.equal(proof.error.message,error.message);assert.equal(proof.status,'failed');assert.ok(proof.persistenceErrors.length>=3);assert.equal(cleaned,true);assert.equal(wc.listenerCount('destroyed'),0);
});
