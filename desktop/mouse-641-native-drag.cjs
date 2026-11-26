'use strict';
// CI-only Windows HTML drag input. OLE may suspend the Electron main thread's
// Node callbacks. Motion, the bounded hold and finally-UP therefore all belong
// to this child. It never waits for a parent callback or a file handshake.
const assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const FLAG='--mouse-641-workspace-smoke',PREFIX='MOUSE_641_NATIVE_DRAG ',STAGE='MOUSE_641_NATIVE_DRAG_STAGE ';
const BUDGET_MS=15000,DRIVER_CALL_MS=7000,LIFECYCLE_MS=BUDGET_MS+2*DRIVER_CALL_MS+1000;
// Leave the edge after its real 650 ms UI dwell. Remaining held observation
// time belongs at the pane center, so a stationary edge cannot traverse more
// desktops. These pauses are input scheduling, never proof of a UI switch.
const HOLD_MS={blank:400,edge:800},SETTLE_MS={blank:200,edge:5000};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),monotonic=()=>process.hrtime.bigint();
const elapsed=(origin,clock)=>{const value=clock()-origin;assert.ok(value>=0n,'Native641 monotonic clock went backwards');return value;};
function scope(runtime){
 assert.equal(runtime.platform,'win32','This helper is only for Windows native HTML drags');
 assert.equal(runtime.env.CI,'true');assert.ok(path.win32.isAbsolute(runtime.env.MOUSE_TEST_PROFILE||''),'Native641 input needs an isolated absolute CI profile');
 assert.ok(runtime.argv.includes(FLAG),'Native641 input needs the existing installed workspace flag');
}
function point(value){assert.ok(value&&Number.isFinite(value.x)&&Number.isFinite(value.y));const p={x:Math.round(value.x),y:Math.round(value.y)};assert.ok(Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y));return p;}
function logicalPoints(from,to,finish){
 const threshold={x:from.x+12,y:from.y+7},points=[{...from,phase:0},{...threshold,phase:1}];
 const segment=(start,end,count)=>{for(let n=1;n<=count;n++)points.push({...point({x:start.x+(end.x-start.x)*n/count,y:start.y+(end.y-start.y)*n/count}),phase:1});};
 segment(threshold,to,12);if(finish)points.push({...finish,phase:1});points.push({...finish||to,phase:2});return points;
}
function planGesture({from,to,finish=null,remainingMs=BUDGET_MS},{runtime=process,screen,now=Date.now,nonce=randomUUID()}={}){
 scope(runtime);from=point(from);to=point(to);if(finish)finish=point(finish);assert.match(nonce,/^[a-f0-9-]{36}$/);
 assert.ok(Number.isFinite(remainingMs)&&remainingMs>0);const budgetMs=Math.floor(Math.min(BUDGET_MS,remainingMs));assert.ok(budgetMs>0);
 const logical=logicalPoints(from,to,finish),points=logical.map(p=>({...point(screen.dipToScreenPoint({x:p.x,y:p.y})),phase:p.phase}));
 return{schema:1,platform:'win32',source:'User32',parentPid:runtime.pid,nonce,kind:finish?'edge':'blank',from,to,finish,
  points,coordinates:{source:'Electron screen.dipToScreenPoint',samples:logical.map((p,i)=>({logical:{x:p.x,y:p.y},physical:{x:points[i].x,y:points[i].y}}))},
  holdAfter:13,holdMs:HOLD_MS[finish?'edge':'blank'],settleMs:SETTLE_MS[finish?'edge':'blank'],budgetMs,deadlineAt:now()+budgetMs};
}
function validatePlan(plan,runtime){
 scope(runtime);assert.equal(runtime.env.ELECTRON_RUN_AS_NODE,'1');assert.equal(plan.schema,1);assert.equal(plan.platform,'win32');assert.equal(plan.source,'User32');
 assert.ok(Number.isSafeInteger(plan.parentPid)&&plan.parentPid>0&&plan.parentPid!==runtime.pid);assert.match(plan.nonce,/^[a-f0-9-]{36}$/);
 assert.ok(Number.isInteger(plan.budgetMs)&&plan.budgetMs>0&&plan.budgetMs<=BUDGET_MS);assert.ok(Number.isSafeInteger(plan.deadlineAt));
 assert.deepEqual(point(plan.from),plan.from);assert.deepEqual(point(plan.to),plan.to);if(plan.finish)assert.deepEqual(point(plan.finish),plan.finish);else assert.equal(plan.finish,null);
 assert.equal(plan.kind,plan.finish?'edge':'blank');assert.equal(plan.holdMs,HOLD_MS[plan.kind]);assert.equal(plan.holdAfter,13);assert.equal(plan.settleMs,SETTLE_MS[plan.kind]);
 const logical=logicalPoints(plan.from,plan.to,plan.finish);assert.equal(plan.points.length,logical.length);assert.equal(plan.coordinates.source,'Electron screen.dipToScreenPoint');assert.equal(plan.coordinates.samples.length,logical.length);
 plan.points.forEach((p,i)=>{assert.deepEqual(point(p),{x:p.x,y:p.y});assert.equal(p.phase,logical[i].phase);assert.deepEqual(plan.coordinates.samples[i],{logical:{x:logical[i].x,y:logical[i].y},physical:{x:p.x,y:p.y}});});
 assert.deepEqual(plan.points.at(-2),{...plan.points.at(-1),phase:1});
}
async function runGesture(plan,{runtime=process,driver,clock=monotonic,now=Date.now,wait=sleep,diagnostic=()=>{}}={}){
 validatePlan(plan,runtime);
 // The parent used Electron's real display mapping. The existing User32 driver
 // receives physical coordinates here and must not scale them a second time.
 driver||=require('./mouse-windows-input.cjs').createWindowsInput({runtime,screen:{dipToScreenPoint:p=>p}});
 const origin=clock(),budgetNs=BigInt(plan.budgetMs)*1000000n;
 const result={schema:1,method:'independent-native-html-input-process',platform:'win32',source:'User32',parentPid:plan.parentPid,childPid:runtime.pid,nonce:plan.nonce,kind:plan.kind,
  budgetMs:plan.budgetMs,driverCallLimitMs:DRIVER_CALL_MS,holdMs:plan.holdMs,settleMs:plan.settleMs,deadlineAt:plan.deadlineAt,startedAt:now(),coordinates:plan.coordinates,
  events:[],stages:[],released:false,ok:false,timing:{source:'process.hrtime.bigint',scope:'per-process elapsed',child:{eventNs:[],holdStartNs:null,holdEndNs:null,elapsedNs:null}}};
 const timing=result.timing.child;let error,current=plan.points[0];
 const stage=name=>{const row={stage:name,childPid:runtime.pid,nonce:plan.nonce,at:now(),elapsedNs:elapsed(origin,clock).toString()};result.stages.push(row);try{diagnostic(row);}catch(cause){result.diagnosticError=String(cause.message||cause);}};
 const deadline=()=>assert.ok(elapsed(origin,clock)<budgetNs,'Native641 child deadline exceeded');
 const waitAtLeast=async ms=>{
  const target=elapsed(origin,clock)+BigInt(ms)*1000000n;
  for(;;){
   const current=elapsed(origin,clock);assert.ok(current<budgetNs,'Native641 child deadline exceeded');
   const remaining=target-current;if(remaining<=0n)return;
   // A timer may wake before the requested hrtime duration. Yield again for
   // the positive remainder, rounded up, without extending the child deadline.
   const available=budgetNs-current,delay=remaining<available?remaining:available;
   await wait(Number((delay+999999n)/1000000n));
  }
 };
 const move=p=>{current=p;const accepted=driver.testMouse(p.x,p.y,p.phase);assert.equal(accepted,true,'Actual native641 User32 input rejected a phase');result.events.push({...p,at:now(),accepted});timing.eventNs.push(elapsed(origin,clock).toString());};
 try{
  stage('down');deadline();move(plan.points[0]);await wait(60);
  stage('threshold');deadline();move(plan.points[1]);await wait(100);
  for(let i=2;i<plan.points.length-1;i++){
   deadline();move(plan.points[i]);
   if(i===plan.holdAfter){stage('destination-held');timing.holdStartNs=elapsed(origin,clock).toString();await waitAtLeast(plan.holdMs);timing.holdEndNs=elapsed(origin,clock).toString();deadline();stage('held-dwell-finished');}
   else await wait(22);
  }
  await waitAtLeast(plan.settleMs);deadline();
 }catch(cause){error=cause;}
 finally{
  // Even a DOWN call that throws may already have posted its OS event. Release
  // at the last actual position; do not move to an unvisited target on failure.
  stage('finally-up');try{move({...current,phase:2});result.released=true;}catch(cause){error||=cause;result.releaseError=String(cause.message||cause);}
  result.completedAt=now();result.elapsedMs=result.completedAt-result.startedAt;timing.elapsedNs=elapsed(origin,clock).toString();
  if(BigInt(timing.elapsedNs)>budgetNs)error||=Error('Native641 child deadline exceeded');stage('complete');
 }
 result.ok=!error;if(error)result.error=String(error.message||error);return result;
}
function validateReceipt(receipt,plan,{parentPid,childPid,exitCode,exitSignal,parentTiming}){
 assert.equal(receipt.schema,1);assert.equal(receipt.method,'independent-native-html-input-process');assert.equal(receipt.platform,'win32');assert.equal(receipt.source,'User32');
 assert.equal(receipt.parentPid,parentPid);assert.equal(receipt.childPid,childPid);assert.notEqual(parentPid,childPid);assert.equal(receipt.nonce,plan.nonce);assert.equal(receipt.kind,plan.kind);
 assert.equal(exitCode,0,receipt.error);assert.equal(exitSignal,null);assert.equal(receipt.ok,true,receipt.error);assert.equal(receipt.released,true);
 assert.equal(receipt.budgetMs,plan.budgetMs);assert.equal(receipt.driverCallLimitMs,DRIVER_CALL_MS);assert.equal(receipt.holdMs,plan.holdMs);assert.equal(receipt.settleMs,SETTLE_MS[plan.kind]);assert.deepEqual(receipt.coordinates,plan.coordinates);
 assert.deepEqual(receipt.events.map(({x,y,phase})=>({x,y,phase})),plan.points);assert.ok(receipt.events.every(e=>e.accepted===true));
 assert.equal(receipt.timing?.source,'process.hrtime.bigint');assert.equal(receipt.timing.scope,'per-process elapsed');const timing=receipt.timing.child,budget=BigInt(plan.budgetMs)*1000000n;
 const ns=value=>{assert.equal(typeof value,'string');assert.match(value,/^(?:0|[1-9]\d*)$/);return BigInt(value);};
 assert.equal(timing.eventNs.length,plan.points.length);const events=timing.eventNs.map(ns),total=ns(timing.elapsedNs);
 assert.ok(total<=budget&&events.every((value,i)=>value<=total&&(i===0||value>=events[i-1])));
 assert.ok(ns(timing.holdStartNs)>=events[plan.holdAfter]&&ns(timing.holdEndNs)-ns(timing.holdStartNs)>=BigInt(plan.holdMs)*1000000n&&ns(timing.holdEndNs)<=events[plan.holdAfter+1]);
 assert.ok(ns(parentTiming.preparationNs)+ns(parentTiming.elapsedNs)<=budget,'Native641 parent deadline exceeded including startup and exit');
 return receipt;
}
function createNativeDrag(options,{runtime=process,screen,spawn=require('node:child_process').spawn,now=Date.now,clock=monotonic,schedule=setTimeout,cancel=clearTimeout,emergencyRelease}={}){
 const planned=clock(),plan=planGesture(options,{runtime,screen,now});let started=false;
 async function run(){
  assert.equal(started,false);started=true;const origin=clock(),forkedAt=now(),parentTiming={preparationNs:elapsed(planned,clock).toString(),elapsedNs:null};
  let child,timer,output='',errors='',receipt,exitCode=null,exitSignal=null,exitAt=null,terminationRequested=false;
  try{
   assert.ok(BigInt(parentTiming.preparationNs)<BigInt(plan.budgetMs)*1000000n,'Native641 deadline exceeded before startup');
   await new Promise((resolve,reject)=>{
    child=spawn(runtime.execPath,[__filename,FLAG,JSON.stringify(plan)],{env:{...runtime.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    // Allow one already-running bounded driver call and finally-UP after the
    // gesture deadline. During OLE, the independent child's deadline releases.
    timer=schedule(()=>{terminationRequested=true;child.kill();reject(Error('Native641 child lifecycle exceeded '+LIFECYCLE_MS+' ms'));},LIFECYCLE_MS);timer.unref?.();
    child.stdout.on('data',b=>{output=(output+b).slice(-65536);});child.stderr.on('data',b=>{errors=(errors+b).slice(-16384);});child.once('error',reject);child.once('close',(code,signal)=>{exitCode=code;exitSignal=signal||null;exitAt=now();parentTiming.elapsedNs=elapsed(origin,clock).toString();resolve();});
   });
   const rows=output.split(/\r?\n/).filter(line=>line.startsWith(PREFIX));assert.equal(rows.length,1,'Native641 child must emit exactly one receipt: '+errors);receipt=JSON.parse(rows[0].slice(PREFIX.length));
   Object.assign(receipt,{forkedAt,exitAt,exitCode,exitSignal,lifecycleLimitMs:LIFECYCLE_MS,terminationRequested});receipt.timing.parent=parentTiming;
   return validateReceipt(receipt,plan,{parentPid:runtime.pid,childPid:child.pid,exitCode,exitSignal,parentTiming});
  }catch(error){
   error.nativeDrag=receipt||{schema:1,method:'independent-native-html-input-process',platform:'win32',source:'User32',parentPid:runtime.pid,childPid:child?.pid||null,nonce:plan.nonce,kind:plan.kind,
    forkedAt,exitAt,exitCode,exitSignal,lifecycleLimitMs:LIFECYCLE_MS,terminationRequested,timing:{source:'process.hrtime.bigint',scope:'per-process elapsed',parent:parentTiming},ok:false,error:String(error.message||error),stderr:errors};
   // A crashed/killed child cannot execute finally. A bounded parent cleanup is
   // additional failure evidence only; it never repairs the success receipt.
   if(Number.isSafeInteger(child?.pid)){
    const last=receipt?.events?.at(-1)||plan.points[0],cleanup={source:'User32',parentPid:runtime.pid,x:last.x,y:last.y,phase:2,driverCallLimitMs:DRIVER_CALL_MS,at:now(),accepted:false};
    try{if(exitAt===null&&!terminationRequested){terminationRequested=true;child.kill();}cleanup.accepted=(emergencyRelease||((x,y)=>require('./mouse-windows-input.cjs').createWindowsInput({runtime,screen:{dipToScreenPoint:p=>p}}).testMouse(x,y,2)))(last.x,last.y)===true;}catch(cause){cleanup.error=String(cause.message||cause);}
    error.nativeDrag.failureCleanup=cleanup;error.nativeDrag.terminationRequested=terminationRequested;
   }
   throw error;
  }finally{cancel(timer);}
 }
 return{plan,run,parentElapsedNs:()=>elapsed(planned,clock).toString()};
}
if(require.main===module){
 (async()=>{assert.equal(process.argv[2],FLAG);const result=await runGesture(JSON.parse(process.argv[3]),{diagnostic:row=>process.stderr.write(STAGE+JSON.stringify(row)+'\n')});process.stdout.write(PREFIX+JSON.stringify(result)+'\n');process.exitCode=result.ok?0:1;})().catch(error=>{process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;});
}
module.exports={createNativeDrag,planGesture,runGesture,validatePlan,validateReceipt,FLAG,PREFIX,STAGE,BUDGET_MS,DRIVER_CALL_MS,LIFECYCLE_MS,HOLD_MS,SETTLE_MS};
