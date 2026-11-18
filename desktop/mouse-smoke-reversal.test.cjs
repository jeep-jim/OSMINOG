'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {closingReversalPair,observeNoraReversal}=require('./mouse-smoke-reversal.cjs');
function fixture(observe=observeNoraReversal,timeoutMs=1000){
 let currentTime=0,duration=300,rate=1,playerPresent=true,count=0,frame=null,reopened=0;const listeners=new Map(),tray={open:true},panel={};
 const player={effect:{target:panel,getComputedTiming:()=>({duration})},get currentTime(){return currentTime;},get playbackRate(){return rate;},playState:'running'};panel.getAnimations=()=>playerPresent?[player]:[];
 const eventTarget={addEventListener(type,listener,capture){assert.equal(capture,true);listeners.set(type,listener);},removeEventListener(type,listener,capture){assert.equal(capture,true);if(listeners.get(type)===listener)listeners.delete(type);}};
 const recorder={onFrame:null,sample:()=>frame};
 const observer=observe({recorder,tray,panel,eventTarget,qualifiesClosing:closingReversalPair,timeoutMs,reopen(){reopened++;rate=1;frame={...frame,phase:'opening'};}});
 function set(phase,time,progress=.6,translate=440*(1-progress)){currentTime=time;rate=phase==='closing'?-1:1;frame={time:++count,phase,progress,open:phase!=='closed',hidden:phase==='closed',height:440,paths:{outline:'unchanged'},matrix:{f:translate}};}
 return{observer,recorder,listeners,set,tick(phase,time,progress,translate){set(phase,time,progress,translate);recorder.onFrame?.(frame);},key(time,{isTrusted=true,phase='opening',present=true}={}){playerPresent=present;set(phase,time,.95,22);listeners.get('keydown')?.({key:'Escape',isTrusted});},get reopened(){return reopened;},setDuration:value=>{duration=value;}};
}
test('eased progress cannot trigger early; a real 150ms timeline and delayed native key retain two distinct closing frames',async()=>{
 const f=fixture();let triggered=false;f.observer.opening.then(()=>{triggered=true;});f.tick('opening',30,.6);await Promise.resolve();assert.equal(triggered,false,'visually advanced easing at30ms is still too early');
 f.tick('opening',150,.95);const opening=await f.observer.opening;assert.equal(opening.timing.currentTime,150);assert.equal(opening.frame.phase,'opening');
 f.key(220);assert.equal(f.observer.observed.escape.isTrusted,true);assert.equal(f.observer.observed.escape.timing.currentTime,220,'the main-process round trip has a bounded delivery margin');
 f.tick('closing',200,.9,44);assert.equal(f.reopened,0);f.tick('closing',180,.8,88);const result=await f.observer.promise;assert.equal(result.error,undefined);assert.equal(f.reopened,1);assert.ok(closingReversalPair(...result.closingFrames));assert.equal(result.before.matrix.f,result.after.matrix.f);assert.equal(result.after.phase,'opening');assert.equal(f.recorder.onFrame,null);assert.equal(f.listeners.size,0);
});
test('missed trigger or an already open panel fails instead of substituting a full-open reversal',async()=>{
 for(const [phase,time]of [['opening',201],['open',300]]){const f=fixture();f.tick(phase,time,.99);const [opening,result]=await Promise.all([f.observer.opening,f.observer.promise]);assert.match(opening.error,/trigger was missed/);assert.match(result.error,/trigger was missed/);assert.equal(f.reopened,0);assert.equal(f.recorder.onFrame,null);assert.equal(f.listeners.size,0);}
});
test('native Escape must be trusted, still opening, and inside150..250ms on the unchanged300ms player',async()=>{
 for(const [time,options]of [[149,{}],[251,{}],[300,{phase:'open'}],[180,{isTrusted:false}],[180,{present:false}]]){const f=fixture();f.tick('opening',150,.95);await f.observer.opening;f.key(time,options);const result=await f.observer.promise;assert.match(result.error,/Native Escape did not arrive/);assert.equal(f.reopened,0);assert.equal(f.listeners.size,0);}
 const f=fixture();f.setDuration(600);f.tick('opening',180,.95);f.tick('opening',201,.96);assert.match((await f.observer.promise).error,/trigger was missed/);assert.equal(f.reopened,0);
});
test('single, identical or subpixel closing samples cannot complete the two-frame gate',async()=>{
 const f=fixture();f.tick('opening',200,.98);await f.observer.opening;f.key(250);f.tick('closing',230,.9,44);f.tick('closing',220,.9,44);f.tick('closing',210,.899,44.5);assert.equal(f.reopened,0);let done=false;f.observer.promise.then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);f.observer.dispose();assert.match((await f.observer.promise).error,/disposed/);assert.equal(f.listeners.size,0);
});
test('timeout and explicit disposal release the key listener and both pending promises',async()=>{
 for(const timeout of [true,false]){const f=fixture(observeNoraReversal,timeout?1:1000);if(!timeout)f.observer.dispose();const [opening,result]=await Promise.all([f.observer.opening,f.observer.promise]);assert.match(opening.error,/Timed out|disposed/);assert.match(result.error,/Timed out|disposed/);assert.equal(f.recorder.onFrame,null);assert.equal(f.listeners.size,0);f.observer.dispose();}
});
test('the exact observer serializes into a renderer without module closures',async()=>{
 const observe=vm.runInNewContext('('+observeNoraReversal.toString()+')',{performance,setTimeout,clearTimeout}),f=fixture(observe);f.tick('opening',160,.95);assert.equal((await f.observer.opening).timing.currentTime,160);f.key(190);f.tick('closing',180,.9,44);f.tick('closing',160,.8,88);const result=await f.observer.promise;assert.equal(result.error,undefined);assert.equal(result.observed.escape.isTrusted,true);assert.equal(f.reopened,1);assert.equal(f.listeners.size,0);
});
