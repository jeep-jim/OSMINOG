'use strict';
// Synthetic protocol tests; only the installed Windows run proves User32 input.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{spawn}=require('node:child_process');
const {createNativeDrag,planGesture,runGesture,validateReceipt,FLAG,PREFIX,BUDGET_MS,LIFECYCLE_MS,HOLD_MS}=require('./mouse-641-native-drag.cjs');
const runtime=pid=>({platform:'win32',pid,execPath:process.execPath,argv:['node',FLAG],env:{CI:'true',ELECTRON_RUN_AS_NODE:'1',MOUSE_TEST_PROFILE:'C:\\Temp\\mouse641-owned'}});
const screen={dipToScreenPoint:p=>({x:p.x*2+4,y:p.y*2-6})};
const options=finish=>({from:{x:20,y:30},to:{x:210,y:110},finish:finish?{x:100,y:130}:null});
function edgeObserver(){
 let time=0,edge=null,next=1;const frames=new Map(),model={desktopId:'origin',swapDrag:false,switching:false};
 const context=vm.createContext({MouseTest:{model},document:{getElementById:()=>edge},performance:{now:()=>time},requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 const install=require('./mouse-641-layout-flow.cjs').fixtures.installEdgeObservation;
 vm.runInContext('('+install.toString()+')({edgeId:"mouse-drag-edge-right",destination:"destination",timeoutMs:9000})',context);
 return{model,promise:context.__mouse641HeldEdge.promise,hover:()=>edge={dataset:{hover:'true'}},frame:at=>{time=at;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();},frames};
}
function fixture({edge=false,remainingMs=BUDGET_MS}={}){
 let ticks=0,wall=10000;const calls=[],plan=planGesture({...options(edge),remainingMs},{runtime:runtime(101),screen,now:()=>wall,nonce:'11111111-2222-4333-8444-555555555555'}),child=runtime(202);
 const dependencies={runtime:child,driver:{testMouse:(x,y,phase)=>{calls.push({x,y,phase});return true;}},now:()=>wall,clock:()=>700000000000n+BigInt(ticks)*1000000n,wait:async ms=>{ticks+=ms;wall+=ms;}};
 return{plan,calls,dependencies,run:extra=>runGesture(plan,{...dependencies,...extra}),advance:ms=>{ticks+=ms;wall+=ms;},shiftWall:ms=>wall+=ms,get elapsed(){return ticks;}};
}
function launcher({edge=false,mutate=value=>value,exit=0,prepareMs=0,exitDelayMs=0}={}){
 let parentMs=0,launched,cleanup=0,timer;const child=new EventEmitter();child.pid=202;child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>true;
 const gesture=createNativeDrag(options(edge),{runtime:runtime(101),screen,clock:()=>BigInt(parentMs)*1000000n,now:()=>10000+parentMs,
  schedule:(fn,ms)=>(timer={fn,ms,unref(){}}),cancel:()=>{},emergencyRelease:()=>{cleanup++;return true;},
  spawn:(...args)=>{launched=args;const plan=JSON.parse(args[1][2]);queueMicrotask(async()=>{try{
   const f=fixture({edge});const result=await runGesture(plan,f.dependencies);parentMs+=f.elapsed+exitDelayMs+5;mutate(result);child.stdout.write(PREFIX+JSON.stringify(result)+'\n');child.emit('close',exit,null);
  }catch(error){child.emit('error',error);}});return child;}});
 parentMs+=prepareMs;return{gesture,get launched(){return launched;},get cleanup(){return cleanup;},get timer(){return timer;}};
}
test('Windows plan maps every logical point once and has an autonomous fixed hold/release',()=>{
 for(const edge of [false,true]){
  const f=fixture({edge}),p=f.plan;assert.equal(p.points.length,edge?23:15);assert.equal(p.holdAfter,13);assert.equal(p.holdMs,HOLD_MS[edge?'edge':'blank']);
  assert.deepEqual(p.points.map(p=>p.phase),[0,...Array(edge?21:13).fill(1),2]);assert.deepEqual(p.points[0],{x:44,y:54,phase:0});
  assert.deepEqual(p.coordinates.samples.at(-1).logical,edge?{x:100,y:130}:{x:210,y:110});assert.equal('handshake' in p,false);
 }
});
test('CI, installed flag, isolated profile and finite coordinates are mandatory',()=>{
 for(const mutate of [r=>r.platform='linux',r=>r.env.CI='false',r=>r.env.MOUSE_TEST_PROFILE='relative',r=>r.argv=[]]){
  const r=runtime(101);mutate(r);assert.throws(()=>planGesture(options(false),{runtime:r,screen}));
 }
 assert.throws(()=>planGesture({...options(false),from:{x:NaN,y:20}},{runtime:runtime(101),screen}));
});
test('blank and edge child execute actual driver phases in order with held dwell and finally UP',async()=>{
 for(const edge of [false,true]){
  const f=fixture({edge}),value=await f.run();assert.equal(value.ok,true);assert.equal(value.released,true);assert.deepEqual(f.calls,f.plan.points);
  assert.deepEqual(value.events.map(({x,y,phase})=>({x,y,phase})),f.plan.points);assert.equal(value.stages.at(-2).stage,'finally-up');assert.equal(value.stages.at(-1).stage,'complete');
  assert.equal(BigInt(value.timing.child.holdEndNs)-BigInt(value.timing.child.holdStartNs),BigInt(f.plan.holdMs)*1000000n);
  assert.equal(value.timing.child.eventNs.length,f.plan.points.length);assert.equal(value.driverCallLimitMs,7000);
 }
});
test('a posted DOWN or failed MOVE still attempts native UP at the last attempted position',async()=>{
 for(const failAt of [0,1,7]){
  const f=fixture();let count=0;const value=await f.run({driver:{testMouse:(x,y,phase)=>{f.calls.push({x,y,phase});if(count++===failAt)throw Error('posted but failed');return true;}}});
  assert.equal(value.ok,false);assert.equal(value.released,true);assert.equal(f.calls.at(-1).phase,2);assert.deepEqual(f.calls.at(-1),{...f.calls.at(-2),phase:2});assert.match(value.error,/posted but failed/);
 }
 const f=fixture(),value=await f.run({driver:{testMouse:(_x,_y,phase)=>phase!==2}});assert.equal(value.ok,false);assert.equal(value.released,false);assert.match(value.releaseError,/rejected/);
});
test('fixed monotonic deadline releases even when wall time goes backwards or a driver stalls',async()=>{
 const f=fixture({remainingMs:120}),value=await f.run({wait:async ms=>{f.advance(ms);f.shiftWall(-10000);}});
 assert.equal(value.ok,false);assert.match(value.error,/deadline/);assert.equal(value.released,true);assert.ok(value.elapsedMs<0);assert.deepEqual(f.calls.map(p=>p.phase),[0,1,2]);
 const stalled=fixture(),other=await stalled.run({driver:{testMouse:(x,y,phase)=>{stalled.calls.push({x,y,phase});if(phase===0)stalled.advance(BUDGET_MS+1);return true;}}});
 assert.equal(other.ok,false);assert.equal(other.released,true);assert.deepEqual(stalled.calls.map(p=>p.phase),[0,2]);
});
test('malformed plans do not post OS input and failed stage logging never prevents UP',async()=>{
 for(const mutate of [p=>p.points[4].phase=0,p=>p.holdMs=999999,p=>p.budgetMs=BUDGET_MS+1,p=>p.coordinates.samples[0].logical.x++]){
  const f=fixture();mutate(f.plan);await assert.rejects(f.run());assert.equal(f.calls.length,0);
 }
 const f=fixture(),value=await f.run({diagnostic:()=>{throw Error('broken stderr');}});assert.equal(value.released,true);assert.equal(value.ok,true);assert.equal(value.diagnosticError,'broken stderr');
});
test('launcher binds real argv, child PID, native coordinates, exit and process-local timing',async()=>{
 const f=launcher({edge:true,prepareMs:11}),value=await f.gesture.run();assert.equal(f.launched[0],process.execPath);assert.equal(path.basename(f.launched[1][0]),'mouse-641-native-drag.cjs');
 assert.equal(f.launched[1][1],FLAG);assert.equal(f.launched[2].env.ELECTRON_RUN_AS_NODE,'1');assert.equal(f.launched[2].shell,undefined);assert.equal(value.exitCode,0);assert.equal(value.exitSignal,null);
 assert.equal(value.parentPid,101);assert.equal(value.childPid,202);assert.equal(value.terminationRequested,false);assert.equal(value.lifecycleLimitMs,LIFECYCLE_MS);assert.equal(value.timing.parent.preparationNs,'11000000');assert.equal(f.cleanup,0);
 assert.ok(BigInt(f.gesture.parentElapsedNs())>=BigInt(value.timing.parent.elapsedNs));
});
test('forged success, missing release, wrong coordinates and delayed exit cannot pass launcher verification',async()=>{
 for(const mutate of [r=>r.childPid=101,r=>r.nonce='00000000-0000-4000-8000-000000000000',r=>r.released=false,r=>r.events.pop(),r=>r.coordinates.samples[2].physical.x++,r=>r.timing.child.eventNs[2]='0',r=>r.timing.child.holdEndNs=r.timing.child.holdStartNs]){
  const f=launcher({mutate});await assert.rejects(f.gesture.run());assert.equal(f.cleanup,1);
 }
 for(const opts of [{exit:1},{exitDelayMs:BUDGET_MS},{prepareMs:BUDGET_MS-1}]){const f=launcher(opts);await assert.rejects(f.gesture.run());assert.equal(f.cleanup,1);}
});
test('lifecycle stall is bounded and kill is followed by independent failure-only UP cleanup',async()=>{
 const child=new EventEmitter();child.pid=202;child.stdout=new PassThrough();child.stderr=new PassThrough();const actions=[];child.kill=()=>{actions.push('kill');return true;};let timer;
 const gesture=createNativeDrag(options(false),{runtime:runtime(101),screen,spawn:()=>child,schedule:(fn,ms)=>(timer={fn,ms,unref(){}}),cancel:()=>{},emergencyRelease:(x,y)=>{actions.push({x,y,phase:2});return true;}});
 const pending=gesture.run();assert.equal(timer.ms,30000);timer.fn();await assert.rejects(pending,error=>{assert.equal(error.nativeDrag.ok,false);assert.equal(error.nativeDrag.exitCode,null);assert.equal(error.nativeDrag.terminationRequested,true);assert.equal(error.nativeDrag.failureCleanup.accepted,true);return true;});
 assert.deepEqual(actions,['kill',{x:44,y:54,phase:2}]);
});
test('renderer observer measures actual edge hover independently of approach travel and parent callbacks',async()=>{
 const f=edgeObserver();f.model.swapDrag=true;f.frame(1000);f.hover();f.frame(2100);f.model.desktopId='destination';f.frame(2750);
 const value=await f.promise;assert.equal(value.ok,true);assert.equal(value.armedAtMs,0);assert.equal(value.hoverAtMs,2100);assert.equal(value.switchedAtMs,2750);assert.equal(value.elapsedMs,650);assert.equal(f.frames.size,0);
 const quick=edgeObserver();quick.model.swapDrag=true;quick.frame(3000);quick.hover();quick.frame(4000);quick.model.desktopId='destination';quick.frame(4100);assert.equal((await quick.promise).elapsedMs,100,'Approach time cannot make a short edge hover look valid');
});
test('renderer observation cannot infer a held hover from a later desktop or accept an ended drag',async()=>{
 for(const ended of [false,true]){
  const f=edgeObserver();if(ended){f.model.swapDrag=true;f.hover();f.frame(100);}f.model.swapDrag=false;f.model.desktopId='destination';f.frame(800);const value=await f.promise;assert.equal(value.ok,false);assert.match(value.error,ended?/drag ended/:/without an observed/);
 }
 const f=edgeObserver();f.frame(9001);assert.equal((await f.promise).ok,false);assert.equal(f.frames.size,0);
});
test('separate child completes all phases and UP while parent event loop remains blocked from launch',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mouse641-independent-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const plan=planGesture(options(false),{runtime:runtime(process.pid),screen}),resultFile=path.join(directory,'result.json'),trace=path.join(directory,'trace.jsonl');
 const script=`const fs=require('node:fs'),{runGesture}=require(${JSON.stringify(require.resolve('./mouse-641-native-drag.cjs'))});const runtime=${JSON.stringify(runtime(999))};runtime.pid=process.pid;runGesture(${JSON.stringify(plan)},{runtime,driver:{testMouse:(x,y,phase)=>{fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({x,y,phase})+'\\n');return true;}}}).then(value=>{fs.writeFileSync(${JSON.stringify(resultFile+'.tmp')},JSON.stringify(value));fs.renameSync(${JSON.stringify(resultFile+'.tmp')},${JSON.stringify(resultFile)});process.exitCode=value.ok?0:1;}).catch(error=>{console.error(error);process.exitCode=1;});`;
 const child=spawn(process.execPath,['-e',script],{stdio:['ignore','ignore','pipe']});t.after(()=>{if(child.exitCode===null)child.kill();});let errors='';child.stderr.on('data',b=>errors+=b);const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 // No ready message, parent signal, callback or artificial handshake is sent.
 // The fake driver traces protocol scheduling; installed CI proves OS delivery.
 const block=new Int32Array(new SharedArrayBuffer(4)),end=Date.now()+5000;while(!fs.existsSync(resultFile)&&Date.now()<end)Atomics.wait(block,0,0,10);
 assert.equal(fs.existsSync(resultFile),true,'The child must finish before the parent can run a callback');const value=JSON.parse(fs.readFileSync(resultFile));
 assert.equal(value.ok,true);assert.equal(value.released,true);assert.equal(value.childPid,child.pid);assert.notEqual(value.childPid,process.pid);assert.deepEqual(fs.readFileSync(trace,'utf8').trim().split('\n').map(JSON.parse),plan.points);assert.equal(await closed,0,errors);
});
test('separate child deadline still releases while the parent cannot answer or run timers',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mouse641-deadline-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const plan=planGesture({...options(true),remainingMs:120},{runtime:runtime(process.pid),screen}),resultFile=path.join(directory,'result.json');
 const script=`const fs=require('node:fs'),{runGesture}=require(${JSON.stringify(require.resolve('./mouse-641-native-drag.cjs'))});const runtime=${JSON.stringify(runtime(999))};runtime.pid=process.pid;runGesture(${JSON.stringify(plan)},{runtime,driver:{testMouse:()=>true}}).then(value=>{fs.writeFileSync(${JSON.stringify(resultFile+'.tmp')},JSON.stringify(value));fs.renameSync(${JSON.stringify(resultFile+'.tmp')},${JSON.stringify(resultFile)});process.exitCode=value.ok?0:1;});`;
 const child=spawn(process.execPath,['-e',script],{stdio:'ignore'});t.after(()=>{if(child.exitCode===null)child.kill();});const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 const block=new Int32Array(new SharedArrayBuffer(4)),end=Date.now()+5000;while(!fs.existsSync(resultFile)&&Date.now()<end)Atomics.wait(block,0,0,10);
 assert.equal(fs.existsSync(resultFile),true);const value=JSON.parse(fs.readFileSync(resultFile));assert.equal(value.ok,false);assert.match(value.error,/deadline/);assert.equal(value.released,true);assert.equal(value.events.at(-1).phase,2);assert.equal(await closed,1);
});
