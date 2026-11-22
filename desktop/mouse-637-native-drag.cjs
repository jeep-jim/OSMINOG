'use strict';
// CI-only OS input. A native file drag can suspend the Electron main thread's
// JavaScript until mouse-up, so the entire gesture belongs to this child.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const FLAG='--mouse-637-features-smoke',PREFIX='MOUSE_637_NATIVE_DRAG ',BUDGET_MS=10000,DRIVER_CALL_MS=7000,LIFECYCLE_MS=BUDGET_MS+6*DRIVER_CALL_MS+1000;
const SOURCES={darwin:'CGEvent',win32:'User32',linux:'XTest'};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function scope(runtime){
 assert.equal(runtime.env.CI,'true','Native drag is CI-only');assert.ok(SOURCES[runtime.platform]);
 const paths=runtime.platform==='win32'?path.win32:path.posix;assert.ok(paths.isAbsolute(runtime.env.MOUSE_TEST_PROFILE||''),'Native drag needs an isolated absolute profile');
 assert.ok(runtime.argv.includes(FLAG),'Native drag needs the existing installed feature flag');return paths;
}
function point(value){assert.ok(value&&Number.isFinite(value.x)&&Number.isFinite(value.y),'Native drag coordinates must be finite');const result={x:Math.round(value.x),y:Math.round(value.y)};assert.ok(Number.isSafeInteger(result.x)&&Number.isSafeInteger(result.y));return result;}
function validateFile(file){assert.ok(file&&typeof file.name==='string'&&file.name.length>0&&file.name.length<=200);assert.ok(Number.isSafeInteger(file.size)&&file.size>0&&file.size<100000);assert.match(file.sha256,/^[a-f0-9]{64}$/);}
function planGesture({from,to,folder,file,remainingMs=BUDGET_MS},{runtime=process,screen,now=Date.now,nonce=randomUUID()}={}){
 const paths=scope(runtime),relative=paths.relative(runtime.env.MOUSE_TEST_PROFILE,folder);assert.ok(paths.isAbsolute(folder)&&relative&&!relative.startsWith('..')&&!paths.isAbsolute(relative),'Only the owned fixture folder may hold a drag handshake');validateFile(file);
 assert.match(nonce,/^[a-f0-9-]{36}$/);assert.ok(Number.isFinite(remainingMs)&&remainingMs>0);
 from=point(from);to=point(to);const points=[{...from,phase:0},{x:from.x-14,y:from.y+8,phase:1}];
 for(let step=1;step<=10;step++)points.push({...point({x:from.x+(to.x-from.x)*step/10,y:from.y+(to.y-from.y)*step/10}),phase:1});points.push({...to,phase:2});
 const physical=points.map(p=>({...point(runtime.platform==='win32'?screen.dipToScreenPoint({x:p.x,y:p.y}):p),phase:p.phase})),budgetMs=Math.floor(Math.min(BUDGET_MS,remainingMs));assert.ok(budgetMs>0);
 const coordinates={source:runtime.platform==='win32'?'Electron screen.dipToScreenPoint':'native screen coordinates',samples:points.map((p,i)=>({logical:{x:p.x,y:p.y},physical:{x:physical[i].x,y:physical[i].y}}))};
 return{schema:1,platform:runtime.platform,source:SOURCES[runtime.platform],parentPid:runtime.pid,nonce,handshake:paths.join(folder,'mouse637-drag-'+nonce+'.json'),expected:{...file},points:physical,coordinates,budgetMs,deadlineAt:now()+budgetMs};
}
function validatePlan(plan,runtime){
 const paths=scope(runtime);assert.equal(runtime.env.ELECTRON_RUN_AS_NODE,'1');assert.equal(plan.schema,1);assert.equal(plan.platform,runtime.platform);assert.equal(plan.source,SOURCES[runtime.platform]);assert.ok(Number.isSafeInteger(plan.parentPid)&&plan.parentPid>0&&plan.parentPid!==runtime.pid);assert.match(plan.nonce,/^[a-f0-9-]{36}$/);validateFile(plan.expected);
 const relative=paths.relative(runtime.env.MOUSE_TEST_PROFILE,plan.handshake);assert.ok(paths.isAbsolute(plan.handshake)&&relative&&!relative.startsWith('..')&&!paths.isAbsolute(relative));assert.equal(paths.basename(plan.handshake),'mouse637-drag-'+plan.nonce+'.json');
 assert.ok(Number.isInteger(plan.budgetMs)&&plan.budgetMs>0&&plan.budgetMs<=BUDGET_MS);assert.ok(Number.isSafeInteger(plan.deadlineAt));assert.equal(plan.points.length,13);
 plan.points.forEach((p,i)=>{assert.deepEqual(point(p),{x:p.x,y:p.y});assert.equal(p.phase,i===0?0:i===12?2:1);});assert.deepEqual(plan.points[11],{...plan.points[12],phase:1});
 assert.equal(plan.coordinates.source,runtime.platform==='win32'?'Electron screen.dipToScreenPoint':'native screen coordinates');assert.equal(plan.coordinates.samples.length,13);plan.coordinates.samples.forEach((p,i)=>{assert.deepEqual(point(p.logical),p.logical);assert.deepEqual(p.physical,{x:plan.points[i].x,y:plan.points[i].y});});
}
function loadDriver(platform){
 if(platform==='darwin')return require(require.resolve('./mouse-native-menu.node').replace('app.asar/','app.asar.unpacked/'));
 if(platform==='linux')return require('./mouse-linux-input.cjs').createLinuxInput();
 // These coordinates were converted using the real Electron screen in the
 // parent. The unchanged User32 driver must not convert them a second time.
 return require('./mouse-windows-input.cjs').createWindowsInput({screen:{dipToScreenPoint:p=>p}});
}
function validateHandshake(value,plan,childPid){
 assert.equal(value.schema,1);assert.equal(value.nonce,plan.nonce);assert.equal(value.parentPid,plan.parentPid);assert.equal(value.childPid,childPid);assert.ok(Number.isSafeInteger(value.at));
 assert.deepEqual(value.nativeFile,{...plan.expected,hasIcon:true,keys:['file','icon']},'The native startDrag call must contain this owned file');return value;
}
async function runGesture(plan,{runtime=process,driver,now=Date.now,wait=sleep,read=filename=>{try{const data=fs.readFileSync(filename);assert.ok(data.length<=4096);return JSON.parse(data);}catch(error){if(error.code==='ENOENT')return null;throw error;}}}={}){
 validatePlan(plan,runtime);driver||=loadDriver(runtime.platform);
 // driverCallLimitMs describes each existing spawnSync command, not a whole
 // phase (Linux uses two or three commands). CGEvent has no such timeout.
 const result={schema:1,method:'independent-native-input-process',platform:runtime.platform,source:plan.source,parentPid:plan.parentPid,childPid:runtime.pid,nonce:plan.nonce,budgetMs:plan.budgetMs,driverCallLimitMs:runtime.platform==='darwin'?null:DRIVER_CALL_MS,deadlineAt:plan.deadlineAt,startedAt:now(),coordinates:plan.coordinates,events:[],handshake:null,released:false,ok:false};let error;
 assert.ok(plan.deadlineAt<=result.startedAt+plan.budgetMs,'Native drag child deadline cannot exceed its fixed budget');
 const deadline=()=>assert.ok(now()<plan.deadlineAt,'Native drag child deadline exceeded');
 const move=p=>{const accepted=driver.testMouse(p.x,p.y,p.phase);assert.equal(accepted,true,'Actual native input driver rejected a drag phase');result.events.push({...p,at:now(),accepted});};
 try{
  deadline();move(plan.points[0]);await wait(60);deadline();move(plan.points[1]);
  while(!result.handshake){deadline();const value=read(plan.handshake);if(value)result.handshake={...validateHandshake(value,plan,runtime.pid),observedAt:now()};else await wait(25);}
  await wait(100);
  for(const p of plan.points.slice(2,12)){deadline();move(p);await wait(22);}
  // X11 asynchronous XDND target negotiation must run before the real OS UP.
  // The same 13 native phases, fixed 10s acceptance and unconditional release remain unchanged.
  await wait(runtime.platform==='linux'?520:120);deadline();
 }catch(cause){error=cause;}
 finally{
  // Attempt release even if DOWN threw after posting its OS event. A timeout
  // throws into this finally; neither the parent nor a raw exit sends mouse-up.
  try{move(plan.points[12]);result.released=true;}catch(cause){error||=cause;result.releaseError=String(cause.message||cause);}
  result.completedAt=now();result.elapsedMs=result.completedAt-result.startedAt;
  if(result.completedAt>plan.deadlineAt)error||=Error('Native drag child deadline exceeded');
 }
 result.ok=!error;if(error)result.error=String(error.message||error);return result;
}
function createNativeDrag(options,{runtime=process,spawn=require('node:child_process').spawn,screen,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 const plan=planGesture(options,{runtime,screen,now});let child,started=false,signalled=false;
 const signal=nativeFile=>{
  assert.ok(child&&Number.isSafeInteger(child.pid));assert.equal(signalled,false,'One native file drag owns one handshake');
  const value={schema:1,nonce:plan.nonce,parentPid:runtime.pid,childPid:child.pid,at:now(),nativeFile};validateHandshake(value,plan,child.pid);
  const temporary=plan.handshake+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value),{flag:'wx',mode:0o600});fs.renameSync(temporary,plan.handshake);signalled=true;
 };
 async function run(){
  assert.equal(started,false);started=true;const forkedAt=now();let output='',errors='',receipt,timer,terminationRequested=false,exitCode=null,exitSignal=null,exitAt=null;
  try{
   await new Promise((resolve,reject)=>{
    // Matches the retained627 native window-drag runner. The known flag is in
    // real OS argv too, preserving the Mac addon's NSProcessInfo CI guard.
    child=spawn(runtime.execPath,[__filename,FLAG,JSON.stringify(plan)],{env:{...runtime.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    // Parent fallback for startup/close stalls. Linux's unchanged driver can
    // spend 3 x 7000 ms in one phase: allow an in-flight phase AND final UP
    // beyond the child deadline before terminating. During a native main-thread
    // loop the child's own deadline/finally, not this timer, releases the mouse.
    timer=schedule(()=>{terminationRequested=true;child.kill();reject(Error('Native drag child lifecycle exceeded '+LIFECYCLE_MS+' ms'));},LIFECYCLE_MS);timer.unref?.();
    child.stdout.on('data',b=>{output=(output+b).slice(-65536);});child.stderr.on('data',b=>{errors=(errors+b).slice(-8192);});child.once('error',reject);child.once('close',(code,signal)=>{exitCode=code;exitSignal=signal||null;exitAt=now();resolve();});
   });
   const rows=output.split(/\r?\n/).filter(line=>line.startsWith(PREFIX));assert.equal(rows.length,1,'Native drag child must return one receipt: '+errors);receipt=JSON.parse(rows[0].slice(PREFIX.length));
   Object.assign(receipt,{forkedAt,exitAt,exitCode,exitSignal,lifecycleLimitMs:LIFECYCLE_MS,terminationRequested});assert.equal(receipt.parentPid,runtime.pid);assert.equal(receipt.childPid,child.pid);assert.notEqual(child.pid,runtime.pid);assert.equal(receipt.nonce,plan.nonce);assert.equal(receipt.source,plan.source);assert.equal(receipt.platform,runtime.platform);
   assert.equal(exitCode,0,receipt.error||errors);assert.equal(receipt.ok,true,receipt.error);assert.equal(receipt.released,true);assert.equal(signalled,true);validateHandshake(receipt.handshake,plan,child.pid);assert.deepEqual(receipt.coordinates,plan.coordinates);assert.deepEqual(receipt.events.map(({x,y,phase})=>({x,y,phase})),plan.points);assert.ok(receipt.events.every(event=>event.accepted===true));return receipt;
  }catch(error){error.nativeDrag=receipt||{schema:1,method:'independent-native-input-process',platform:runtime.platform,source:plan.source,parentPid:runtime.pid,childPid:child?.pid||null,nonce:plan.nonce,forkedAt,exitAt,exitCode,exitSignal,lifecycleLimitMs:LIFECYCLE_MS,terminationRequested,ok:false,error:String(error.message||error),stderr:errors};throw error;}
  finally{cancel(timer);for(const filename of [plan.handshake,plan.handshake+'.tmp'])fs.rmSync(filename,{force:true});}
 }
 return{plan,signal,run};
}
if(require.main===module){
 (async()=>{assert.equal(process.argv[2],FLAG);const result=await runGesture(JSON.parse(process.argv[3]));process.stdout.write(PREFIX+JSON.stringify(result)+'\n');process.exitCode=result.ok?0:1;})().catch(error=>{process.stderr.write(String(error.stack||error)+'\n');process.exitCode=1;});
}
module.exports={createNativeDrag,planGesture,runGesture,validateHandshake,FLAG,PREFIX,BUDGET_MS,DRIVER_CALL_MS,LIFECYCLE_MS};
