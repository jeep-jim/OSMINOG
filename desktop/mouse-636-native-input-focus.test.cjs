'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {focusNativeInputWindow}=require('./mouse-636-native-input-focus.cjs');
const {observeGuestClick}=require('./mouse-636-guest-input-diagnostics.cjs');
const retained=fs.readFileSync(path.join(__dirname,'mouse-636-retained-smoke.cjs'),'utf8');
const helpers=fs.readFileSync(path.join(__dirname,'mouse-631-smoke-helpers.cjs'),'utf8');
function between(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const actualUntil=between(helpers,'async function until(check,label,ms=10000){','\n const frame=');
const actualFocus=between(retained,'async function focus(){','\n async function click(');
const actualGuestClick=between(retained,'async function guestClick(record,selector){','\n async function screenCapture(');
const ready={windowFocused:true,appActive:true,visible:true};

function scene(states=[ready],{platform='darwin',deadline=200000}={}){
 const calls=[],waits=[],sleeps=[];let clock=0,poll=-1,lastError,lastReadiness;
 const state=()=>states[Math.min(Math.max(poll,0),states.length-1)];
 const app={focus:options=>{calls.push(['app.focus',structuredClone(options)]);},isActive:()=>{calls.push(['app.isActive']);return state().appActive;}};
 const win={show:()=>{calls.push(['win.show']);},focus:()=>{calls.push(['win.focus']);},isFocused:()=>{calls.push(['win.isFocused']);return state().windowFocused;},isVisible:()=>{calls.push(['win.isVisible']);return state().visible;},webContents:{focus:()=>{calls.push(['shell.focus']);}}};
 const originalUntil=vm.runInNewContext('('+actualUntil+')',{deadline,performance:{now:()=>clock},sleep:async ms=>{sleeps.push(ms);clock+=ms;},name:'owner636-retained'});
 const until=async(...args)=>{
  const [check,label,...rest]=args;waits.push({label,argumentCount:args.length});
  try{return await originalUntil(label==='634 window focus'?()=>{poll++;return check();}:check,label,...rest);}
  catch(error){lastError=error;throw error;}
 };
 const args={app,win,until,platform};
 const callHelper=async input=>{lastReadiness=await focusNativeInputWindow({...input,platform});return lastReadiness;};
 return{app,win,args,calls,waits,sleeps,until,callHelper,get polls(){return poll+1;},get clock(){return clock;},get lastError(){return lastError;},get lastReadiness(){return lastReadiness;}};
}
function assertSingleActivation(s){
 assert.deepEqual(s.calls.filter(call=>!call[0].startsWith('app.is')&&!call[0].startsWith('win.is')),[['app.focus',{steal:true}],['win.show'],['win.focus'],['shell.focus']]);
 assert.deepEqual(s.waits.filter(wait=>wait.label==='634 window focus'),[{label:'634 window focus',argumentCount:2}]);
}

test('Darwin waits for application activation while keeping one focus sequence and the original poll',async()=>{
 const s=scene([{...ready,appActive:false},ready]);
 const value=await focusNativeInputWindow(s.args);
 assert.deepEqual(value,ready);assert.equal(s.polls,2);assert.deepEqual(s.sleeps,[25]);assertSingleActivation(s);
 for(const method of ['app.isActive','win.isFocused','win.isVisible'])assert.equal(s.calls.filter(call=>call[0]===method).length,2);
});

test('Darwin rejects a non-key or hidden window even when the application is active',async()=>{
 for(const field of ['windowFocused','visible']){
  const s=scene([{...ready,[field]:false},ready]);
  assert.deepEqual(await focusNativeInputWindow(s.args),ready);assert.equal(s.polls,2);assert.deepEqual(s.sleeps,[25]);assertSingleActivation(s);
 }
});

test('the actual retained focus function cannot finish on key=true while appActive=false',async()=>{
 const s=scene([{...ready,appActive:false},ready]);
 const focus=vm.runInNewContext('('+actualFocus+')',{app:s.app,win:s.win,fixture:{until:s.until},focusNativeInputWindow:s.callHelper});
 const value=await focus();
 assert.equal(s.polls,2,'The existing fixture must await the active application, not only the key window');
 assert.equal(value,s.lastReadiness);assert.deepEqual(value,ready);assertSingleActivation(s);
});

test('permanent inactivity keeps the existing 10000 ms timeout, 25 ms poll and original error identity',async()=>{
 const s=scene([{...ready,appActive:false}]);
 await assert.rejects(focusNativeInputWindow(s.args),error=>error===s.lastError&&error.message==='Mouse631 owner636-retained timeout: 634 window focus');
 assert.equal(s.clock,10000);assert.equal(s.polls,400);assert.equal(s.sleeps.length,400);assert.ok(s.sleeps.every(ms=>ms===25));assertSingleActivation(s);
});

test('the existing fixture deadline still bounds focus when it is shorter than the default wait',async()=>{
 const s=scene([{...ready,visible:false}],{deadline:75});
 await assert.rejects(focusNativeInputWindow(s.args),error=>error===s.lastError&&/timeout: 634 window focus$/.test(error.message));
 assert.equal(s.clock,75);assert.equal(s.polls,3);assert.deepEqual(s.sleeps,[25,25,25]);assertSingleActivation(s);
});

test('Windows and Linux keep only their original window-focus predicate',async()=>{
 for(const platform of ['win32','linux']){
  const s=scene([{windowFocused:false},{windowFocused:true}],{platform});
  Object.defineProperty(s.app,'isActive',{get(){throw Error('Mac-only app API accessed');}});
  Object.defineProperty(s.win,'isVisible',{get(){throw Error('additional platform read accessed');}});
  assert.deepEqual(await focusNativeInputWindow(s.args),{windowFocused:true});
  assert.equal(s.polls,2);assert.deepEqual(s.sleeps,[25]);assertSingleActivation(s);
 }
});

test('activation, readiness and existing wait failures propagate unchanged',async()=>{
 for(const operation of ['activation','readiness','wait']){
  const s=scene(),error=new Error(operation+' failed');
  if(operation==='activation')s.app.focus=()=>{throw error;};
  if(operation==='readiness')s.app.isActive=()=>{throw error;};
  if(operation==='wait')s.args.until=async()=>{throw error;};
  await assert.rejects(focusNativeInputWindow(s.args),cause=>cause===error);
 }
});

function guestScene(events){
 const s=scene([{...ready,appActive:false},ready]),facts={guestClickAttempts:[],nativeInputs:[]};let posts=0,saves=0,details;
 const hit={ready:true,x:100,y:149},record={id:'owned-page',page:{bounds:{x:0,y:74,width:597,height:686},view:{webContents:{id:2,getZoomFactor:()=>1}}}};
 s.win.getContentBounds=()=>({x:4,y:29,width:1200,height:794});
 const fixture={until:s.until,pageJS:async(_record,source)=>{
  if(source.startsWith('(function nativeHitTarget('))return hit;
  if(source.startsWith('(function guestInputReadback('))return{count:0};
  assert.equal(source,'mouse634.clicks.slice(0)');return events;
 }};
 const context={app:s.app,win:s.win,fixture,focusNativeInputWindow:s.callHelper,facts,inputSource:()=> 'CGEvent',
  nativeHitTarget:function nativeHitTarget(){},guestInputReadback:function guestInputReadback(){},
  nativeGuestInputState:()=>({observed:true}),screen:{},webContents:{},
  nativeInput:{testClick:(x,y)=>{posts++;assert.deepEqual({x,y},{x:104,y:252});return true;}},
  observeGuestClick:args=>{details=args.details;return observeGuestClick(args);},save:async()=>{saves++;}};
 const guestClick=vm.runInNewContext(actualFocus+'\n('+actualGuestClick+')',context);
 return{s,facts,record,guestClick,get posts(){return posts;},get saves(){return saves;},get details(){return details;}};
}

test('the actual guest click saves the successful readiness readback without another read or click',async()=>{
 const events=[{id:'download-a',trusted:true}],g=guestScene(events);
 const result=await g.guestClick(g.record,'#download-a');
 assert.equal(result.events,events);assert.equal(g.posts,1);assert.equal(g.saves,0);
 assert.equal(g.details.focusReadiness,g.s.lastReadiness);assert.deepEqual(g.details.focusReadiness,ready);
 assert.deepEqual(g.facts.guestClickAttempts[0].focusReadiness,ready);assert.equal(g.facts.nativeInputs.length,1);
 for(const method of ['app.isActive','win.isFocused','win.isVisible'])assert.equal(g.s.calls.filter(call=>call[0]===method).length,2);
 assertSingleActivation(g.s);
});

test('the actual guest click still rejects an untrusted or wrong-target event after one native post',async()=>{
 for(const events of [[{id:'download-a',trusted:false}],[{id:'another-link',trusted:true}]]){
  const g=guestScene(events);
  await assert.rejects(g.guestClick(g.record,'#download-a'),error=>error===g.s.lastError&&error.message==='Mouse631 owner636-retained timeout: 634 trusted guest link #download-a');
  assert.equal(g.posts,1);assert.equal(g.saves,1);assert.equal(g.facts.nativeInputs.length,0);
  assert.deepEqual(g.facts.guestClickAttempts[0].focusReadiness,ready);
  for(const method of ['app.isActive','win.isFocused','win.isVisible'])assert.equal(g.s.calls.filter(call=>call[0]===method).length,2);
  assertSingleActivation(g.s);
 }
});
