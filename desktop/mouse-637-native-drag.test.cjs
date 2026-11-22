'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream'),{spawn}=require('node:child_process');
const {planGesture,runGesture,createNativeDrag,FLAG,PREFIX,BUDGET_MS,LIFECYCLE_MS}=require('./mouse-637-native-drag.cjs');
const file={name:'Owned image.png',size:309,sha256:'a'.repeat(64)},nonce='12345678-1234-1234-1234-123456789abc';
const runtime=(platform='linux',pid=101,profile='/tmp/mouse637-drag-unit')=>({platform,pid,execPath:process.execPath,argv:['node','fixture.cjs',FLAG],env:{CI:'true',MOUSE_TEST_PROFILE:profile,ELECTRON_RUN_AS_NODE:'1'}});
function fixture(options={}){
 let time=1000;const platform=options.platform||'linux',parent=runtime(platform),child=runtime(platform,202),plan=planGesture({from:{x:100,y:200},to:{x:500,y:300},folder:parent.env.MOUSE_TEST_PROFILE+'/owned',file,remainingMs:options.remainingMs??BUDGET_MS},{runtime:parent,now:()=>time,nonce}),calls=[];
 const signal=()=>({schema:1,nonce:plan.nonce,parentPid:parent.pid,childPid:child.pid,at:time,nativeFile:{...file,hasIcon:true,keys:['file','icon']}});
 return{parent,child,plan,calls,signal,now:()=>time,advance:ms=>{time+=ms;},run:extra=>runGesture(plan,{runtime:child,now:()=>time,wait:async ms=>{time+=ms;},driver:{testMouse:(x,y,phase)=>{calls.push({x,y,phase});return true;}},read:signal,...extra})};
}
test('all Windows gesture points are converted once by the real-screen adapter before the child is created',()=>{
 const parent=runtime('win32',101,'C:\\Temp\\Mouse profile'),calls=[];
 const plan=planGesture({from:{x:40,y:60},to:{x:140,y:160},folder:'C:\\Temp\\Mouse profile\\owned',file},{runtime:parent,now:()=>1000,nonce,screen:{dipToScreenPoint:p=>{calls.push(p);return{x:p.x*2-1920,y:p.y*2};}}});
 assert.equal(calls.length,13);assert.equal(plan.coordinates.source,'Electron screen.dipToScreenPoint');assert.deepEqual(plan.coordinates.samples.map(p=>p.logical),calls);assert.deepEqual(plan.points[0],{x:-1840,y:120,phase:0});assert.deepEqual(plan.points.at(-1),{x:-1640,y:320,phase:2});assert.deepEqual(plan.points[11],{...plan.points[12],phase:1});
});
test('ordinary profiles, missing native flag, escaping folders and nonfinite points cannot launch native input',()=>{
 const parent=runtime(),options={from:{x:1,y:2},to:{x:30,y:40},folder:'/tmp/mouse637-drag-unit/owned',file};
 for(const changed of [{...parent,env:{...parent.env,CI:'false'}},{...parent,env:{...parent.env,MOUSE_TEST_PROFILE:'relative'}},{...parent,argv:['node','fixture.cjs']}])assert.throws(()=>planGesture(options,{runtime:changed}));
 assert.throws(()=>planGesture({...options,folder:'/tmp/foreign'},{runtime:parent}));assert.throws(()=>planGesture({...options,to:{x:Infinity,y:2}},{runtime:parent}));assert.throws(()=>planGesture({...options,remainingMs:0},{runtime:parent}));
});
test('child waits for its own native-file handshake and records all thirteen accepted OS phases',async()=>{
 const f=fixture();let reads=0;const result=await f.run({read:()=>++reads<3?null:f.signal()});
 assert.equal(reads,3);assert.equal(result.ok,true);assert.equal(result.released,true);assert.equal(result.events.length,13);assert.deepEqual(f.calls,f.plan.points);assert.equal(result.childPid,202);assert.notEqual(result.childPid,result.parentPid);assert.ok(result.events[1].at<=result.handshake.observedAt&&result.handshake.observedAt<=result.events[2].at);assert.ok(result.elapsedMs<result.budgetMs);
 const mac=await fixture({platform:'darwin'}).run();assert.equal(mac.source,'CGEvent');assert.equal(mac.driverCallLimitMs,null);
});
test('foreign handshake nonce, parent, child, file bytes and missing native icon release the pointer and fail',async()=>{
 for(const mutate of [v=>v.nonce='00000000-0000-0000-0000-000000000000',v=>v.parentPid++,v=>v.childPid++,v=>v.nativeFile.sha256='b'.repeat(64),v=>v.nativeFile.name='Other.png',v=>v.nativeFile.size++,v=>v.nativeFile.hasIcon=false]){
  const f=fixture(),result=await f.run({read:()=>{const value=f.signal();mutate(value);return value;}});assert.equal(result.ok,false);assert.equal(result.released,true);assert.deepEqual(f.calls.map(p=>p.phase),[0,1,2]);assert.ok(result.error);
 }
});
test('missing handshake and expired initial deadline fail within the child loop and still attempt mouse-up',async()=>{
 const missing=fixture({remainingMs:250}),a=await missing.run({read:()=>null});assert.equal(a.ok,false);assert.match(a.error,/deadline/);assert.equal(a.released,true);assert.deepEqual(missing.calls.map(p=>p.phase),[0,1,2]);
 const expired=fixture();expired.advance(BUDGET_MS+1);const b=await expired.run();assert.equal(b.ok,false);assert.equal(b.released,true);assert.deepEqual(expired.calls.map(p=>p.phase),[2]);
});
test('a driver that throws after posting DOWN or during motion cannot skip the unconditional UP attempt',async()=>{
 for(const failAt of [1,3]){const f=fixture();let count=0;const result=await f.run({driver:{testMouse:(x,y,phase)=>{f.calls.push({x,y,phase});if(++count===failAt)throw Error('Driver failed after OS post');return true;}}});assert.equal(result.ok,false);assert.equal(result.released,true);assert.equal(f.calls.at(-1).phase,2);assert.match(result.error,/after OS post/);}
});
test('failed mouse-up and slow synchronous driver calls cannot produce a successful receipt',async()=>{
 const release=fixture(),a=await release.run({driver:{testMouse:(_x,_y,phase)=>phase!==2}});assert.equal(a.ok,false);assert.equal(a.released,false);assert.match(a.releaseError,/rejected/);
 const slow=fixture(),b=await slow.run({driver:{testMouse:(x,y,phase)=>{slow.calls.push({x,y,phase});if(phase===0)slow.advance(BUDGET_MS+1);return true;}}});assert.equal(b.ok,false);assert.equal(b.released,true);assert.match(b.error,/deadline/);assert.deepEqual(slow.calls.map(p=>p.phase),[0,2]);
});
test('a malformed child plan is rejected before any OS input, including an unbounded deadline',async()=>{
 const f=fixture();f.plan.points[3].phase=0;await assert.rejects(f.run());assert.equal(f.calls.length,0);
 const future=fixture();future.plan.deadlineAt+=BUDGET_MS;await assert.rejects(future.run(),/fixed budget/);assert.equal(future.calls.length,0);
});
test('launcher keeps the native flag in real OS argv and binds child exit, nonce and atomic handshake',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mouse637-drag-launch-')),folder=path.join(root,'owned');fs.mkdirSync(folder);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const parent=runtime(process.platform,101,root),child=new EventEmitter();child.pid=202;child.stdout=new PassThrough();child.stderr=new PassThrough();let time=1000,launched,gesture;
 gesture=createNativeDrag({from:{x:20,y:30},to:{x:100,y:110},folder,file},{runtime:parent,screen:{dipToScreenPoint:p=>p},now:()=>time,spawn:(...args)=>{launched=args;queueMicrotask(async()=>{try{gesture.signal({...file,hasIcon:true,keys:['file','icon']});assert.equal(fs.existsSync(gesture.plan.handshake+'.tmp'),false);const report=await runGesture(gesture.plan,{runtime:{...parent,pid:202},driver:{testMouse:()=>true},now:()=>time,wait:async ms=>{time+=ms;}});child.stdout.write(PREFIX+JSON.stringify(report)+'\n');child.emit('close',report.ok?0:1);}catch(error){child.stderr.write(error.stack);child.emit('close',1);}});return child;}});
 const result=await gesture.run();assert.equal(launched[0],process.execPath);assert.equal(path.basename(launched[1][0]),'mouse-637-native-drag.cjs');assert.equal(launched[1][1],FLAG);assert.equal(launched[2].env.ELECTRON_RUN_AS_NODE,'1');assert.equal(launched[2].shell,undefined);assert.equal(result.driverCallLimitMs,process.platform==='darwin'?null:7000);assert.equal(result.exitCode,0);assert.equal(result.terminationRequested,false);assert.equal(result.lifecycleLimitMs,LIFECYCLE_MS);assert.equal(fs.existsSync(gesture.plan.handshake),false);
});
test('a child failure receipt is preserved and a startup/close stall cannot be accepted or wait indefinitely',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mouse637-drag-stall-')),folder=path.join(root,'owned');fs.mkdirSync(folder);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const parent=runtime(process.platform,101,root);
 const child=new EventEmitter();child.pid=202;child.stdout=new PassThrough();child.stderr=new PassThrough();let timer,killed=false;child.kill=()=>{killed=true;return true;};
 const gesture=createNativeDrag({from:{x:20,y:30},to:{x:100,y:110},folder,file},{runtime:parent,screen:{dipToScreenPoint:p=>p},spawn:()=>child,schedule:(fn,ms)=>{timer={fn,ms,unref(){}};return timer;},cancel:()=>{}}),pending=gesture.run();assert.equal(timer.ms,BUDGET_MS+6*7000+1000);timer.fn();await assert.rejects(pending,error=>{assert.equal(error.nativeDrag.terminationRequested,true);assert.equal(error.nativeDrag.ok,false);assert.equal(error.nativeDrag.exitCode,null);return true;});assert.equal(killed,true);
 const f=fixture(),failed=await f.run({read:()=>{throw Error('Unreadable handshake');}});assert.equal(failed.released,true);let child2=new EventEmitter();child2.pid=202;child2.stdout=new PassThrough();child2.stderr=new PassThrough();const bad=createNativeDrag({from:{x:20,y:30},to:{x:100,y:110},folder,file},{runtime:parent,screen:{dipToScreenPoint:p=>p},spawn:(_cmd,args)=>{const p=JSON.parse(args[2]);Object.assign(failed,{nonce:p.nonce,platform:p.platform,source:p.source});queueMicrotask(()=>{child2.stdout.write(PREFIX+JSON.stringify(failed)+'\n');child2.emit('close',1);});return child2;}});await assert.rejects(bad.run(),error=>{assert.equal(error.nativeDrag.error,'Unreadable handshake');assert.equal(error.nativeDrag.exitCode,1);assert.equal(error.nativeDrag.released,true);return true;});
});
test('a separate child completes motion and UP while the parent JavaScript event loop is blocked',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mouse637-drag-independent-')),folder=path.join(root,'owned');fs.mkdirSync(folder);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const parent=runtime(process.platform,process.pid,root),plan=planGesture({from:{x:20,y:30},to:{x:100,y:110},folder,file},{runtime:parent,screen:{dipToScreenPoint:p=>p}}),trace=path.join(folder,'trace.jsonl'),ready=path.join(folder,'ready'),resultFile=path.join(folder,'result.json');
 const script=`const fs=require('node:fs'),{runGesture}=require(${JSON.stringify(require.resolve('./mouse-637-native-drag.cjs'))});const plan=${JSON.stringify(plan)};const runtime={...process,platform:process.platform,pid:process.pid,env:${JSON.stringify(parent.env)},argv:['node',${JSON.stringify(FLAG)}]};runGesture(plan,{runtime,driver:{testMouse:(x,y,phase)=>{fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({x,y,phase})+'\\n');if(phase===1&&!fs.existsSync(${JSON.stringify(ready)}))fs.writeFileSync(${JSON.stringify(ready)},'ready');return true;}}}).then(result=>{fs.writeFileSync(${JSON.stringify(resultFile)},JSON.stringify(result));process.exitCode=result.ok?0:1;}).catch(error=>{console.error(error);process.exitCode=1;});`;
 const child=spawn(process.execPath,['-e',script],{stdio:['ignore','ignore','pipe']});t.after(()=>{if(child.exitCode===null)child.kill();});let errors='';child.stderr.on('data',b=>errors+=b);const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 const until=Date.now()+5000;while(!fs.existsSync(ready)&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(fs.existsSync(ready),true,errors);fs.writeFileSync(plan.handshake,JSON.stringify({schema:1,nonce:plan.nonce,parentPid:process.pid,childPid:child.pid,at:Date.now(),nativeFile:{...file,hasIcon:true,keys:['file','icon']}}));
 const blockedUntil=Date.now()+5000,blocked=new Int32Array(new SharedArrayBuffer(4));while(!fs.existsSync(resultFile)&&Date.now()<blockedUntil)Atomics.wait(blocked,0,0,10);
 assert.equal(fs.existsSync(resultFile),true,'The child finishes without any parent JS callback after the handshake');const result=JSON.parse(fs.readFileSync(resultFile));assert.equal(result.ok,true);assert.equal(result.released,true);assert.notEqual(result.childPid,process.pid);assert.equal(JSON.parse(fs.readFileSync(trace,'utf8').trim().split('\n').at(-1)).phase,2);assert.equal(await closed,0,errors);
});
