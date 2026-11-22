'use strict';
// Opt-in, separate installed CI replay. Nothing here is release acceptance.
const assert=require('node:assert/strict'),path=require('node:path');
const LIMITS=Object.freeze({commandMs:3000,writeMs:5000,recordMs:180000,profileBytes:16*1024*1024,reportBytes:2*1024*1024,markers:512,errors:32,samplingIntervalUs:1000});
const FILES=Object.freeze({report:'mouse-637-performance-diagnostic.json',main:'mouse-637-performance-main.cpuprofile',renderer:'mouse-637-performance-renderer.cpuprofile'});

function rendererSetup(limit){
 const state=globalThis.__mouse637PerformanceDiagnostic={clock:'renderer.performance.now',timeOrigin:performance.timeOrigin,markers:[],dropped:0};
 state.mark=value=>{const row={...value,at:performance.now()};if(state.markers.length<limit)state.markers.push(row);else{state.markers[limit-1]=row;state.dropped++;}};
 return{clock:state.clock,timeOrigin:state.timeOrigin,now:performance.now()};
}
function rendererFinish(){
 const state=globalThis.__mouse637PerformanceDiagnostic;if(!state)return null;
 const result={clock:state.clock,timeOrigin:state.timeOrigin,now:performance.now(),markers:state.markers,dropped:state.dropped};delete globalThis.__mouse637PerformanceDiagnostic;return result;
}
function rendererExpression(code,identity){
 return `(()=>{const mark=phase=>{try{globalThis.__mouse637PerformanceDiagnostic?.mark({...${JSON.stringify(identity)},phase});}catch{}};mark('begin');let result;try{result=(${code});}catch(error){mark('throw');throw error;}if(result&&typeof result.then==='function')result.then(()=>mark('resolved'),()=>mark('rejected'));else mark('returned');return result;})()`;
}

function createPerformanceDiagnostic({app,env=process.env,platform=process.platform,arch=process.arch,pid=process.pid,cwd=process.cwd(),limits:overrides={},dependencies={}}){
 if(env.MOUSE_637_PERFORMANCE_DIAGNOSTIC!=='1')return null;
 assert.equal(env.CI,'true','Performance diagnostics require CI');assert.equal(platform,'darwin');
 assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),'6.0.37');
 assert.ok(path.isAbsolute(env.MOUSE_TEST_PROFILE||''),'An isolated absolute profile is required');
 assert.equal(path.resolve(app.getPath('userData')),path.resolve(env.MOUSE_TEST_PROFILE));
 const limits={...LIMITS,...overrides};for(const value of Object.values(limits))assert.ok(Number.isSafeInteger(value)&&value>0);
 const fs=dependencies.fs||require('node:fs/promises'),hash=dependencies.hash||(bytes=>require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
 const now=dependencies.now||(()=>performance.now()),monotonic=dependencies.monotonic||(()=>process.hrtime.bigint().toString());
 const sessionFactory=dependencies.sessionFactory||(()=>new(require('node:inspector').Session)());
 const stamp=()=>({performanceNowMs:now(),monotonicNs:String(monotonic())});
 const report={schema:1,kind:'separate-installed-performance-replay',diagnosticOnly:true,acceptanceEligible:false,version:app.getVersion(),platform,arch,pid,
  limits,source:env.GITHUB_SHA||null,clockNote:'Each process keeps its own clock domain. Profile start/end timestamps are raw V8 microseconds. Command brackets and renderer calibrations bound alignment; they do not establish exact one-way IPC latency.',
  mainClock:{clock:'main.performance.now',timeOrigin:performance.timeOrigin,initial:stamp()},commands:[],mainMarkers:[],droppedMainMarkers:0,renderer:{start:null,end:null},profiles:{},errors:[],droppedErrors:0,recordLimitReached:false,ok:false};
 let session,debug,fixture,scope=null,invocation=0,markerReady=false,started=false,stopped=false,recordTimer,startPromise,profilesPromise,stopPromise;
 const running={main:false,renderer:false},attempted={main:false,renderer:false},enabled={main:false,renderer:false};
 function error(stage,cause){const row={stage,message:String(cause?.message||cause).slice(0,512)};if(report.errors.length<limits.errors)report.errors.push(row);else report.droppedErrors++;}
 function pushMarker(row){const value={...row,...stamp()};if(report.mainMarkers.length<limits.markers)report.mainMarkers.push(value);else{report.mainMarkers[limits.markers-1]=value;report.droppedMainMarkers++;}}
 async function bounded(work,ms,label){let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}
 async function command(target,method,params={}){
  const record={target,method,before:stamp()};report.commands.push(record);
  try{return await bounded(()=>target==='main'?new Promise((resolve,reject)=>session.post(method,params,(cause,value)=>cause?reject(cause):resolve(value))):debug.sendCommand(method,params),limits.commandMs,target+' '+method);}
  catch(cause){record.error=String(cause?.message||cause).slice(0,512);throw cause;}
  finally{record.after=stamp();}
 }
 async function write(file,value,maxBytes){
  const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>maxBytes)throw Error(file+' exceeds the diagnostic byte cap');
  const target=path.join(cwd,file),partial=target+'.partial',controller=new AbortController();
  try{await bounded(async()=>{await fs.writeFile(partial,bytes,{flag:'wx',signal:controller.signal});controller.signal.throwIfAborted();await fs.rename(partial,target);},limits.writeMs,'Diagnostic write '+file);return{file,bytes:bytes.length,sha256:hash(bytes)};}
  finally{controller.abort();await fs.rm(partial,{force:true}).catch(()=>{});}
 }
 async function calibration(name,code){
  const before=stamp();try{const value=await bounded(()=>fixture.js(code),limits.commandMs,'Renderer '+name+' calibration');report.renderer[name]={mainBefore:before,mainAfter:stamp(),value};return value;}
  catch(cause){error('renderer '+name,cause);return null;}
 }
 async function startProfile(target){
  try{
   if(target==='main'){session=sessionFactory();session.connect();}
   enabled[target]=true;await command(target,'Profiler.enable');await command(target,'Profiler.setSamplingInterval',{interval:limits.samplingIntervalUs});
   attempted[target]=true;await command(target,'Profiler.start');running[target]=true;
  }catch(cause){error(target+' start',cause);}
 }
 function finishProfiles(reason){
  if(profilesPromise)return profilesPromise;
  clearTimeout(recordTimer);report.profilesStopReason=reason;
  profilesPromise=(async()=>{
   await Promise.all(['main','renderer'].map(async target=>{
    try{
     if(attempted[target]){
      const result=await command(target,'Profiler.stop'),profile=result?.profile;
      if(!profile||!Array.isArray(profile.nodes)||!Number.isFinite(profile.startTime)||!Number.isFinite(profile.endTime))throw Error('CPU profile is absent or malformed');
      report.profiles[target]={...await write(FILES[target],profile,limits.profileBytes),startTime:profile.startTime,endTime:profile.endTime,nodes:profile.nodes.length,samples:Array.isArray(profile.samples)?profile.samples.length:null,timeDeltas:Array.isArray(profile.timeDeltas)?profile.timeDeltas.length:null};
     }
    }catch(cause){error(target+' stop',cause);}
    finally{running[target]=false;if(enabled[target])try{await command(target,'Profiler.disable');}catch(cause){error(target+' disable',cause);}}
   }));
   if(session)try{session.disconnect();}catch(cause){error('main disconnect',cause);}
  })();return profilesPromise;
 }
 return{
  start({debugger:ownedDebugger,fixture:ownedFixture}){
   if(startPromise)return startPromise;debug=ownedDebugger;fixture=ownedFixture;
   startPromise=(async()=>{
    try{
     assert.equal(debug.isAttached(),true,'Use the stress fixture debugger after its own attach');
     markerReady=!!await calibration('start',`(${rendererSetup.toString()})(${limits.markers})`);
     await Promise.all([startProfile('main'),startProfile('renderer')]);started=true;
     recordTimer=setTimeout(()=>{report.recordLimitReached=true;void finishProfiles('record-limit');},limits.recordMs);recordTimer.unref?.();
    }catch(cause){error('start',cause);}
   })();return startPromise;
  },
  beginSwitch(value){if(!started||stopped)return;scope={stage:value.stage,sequence:value.sequence};pushMarker({...scope,phase:'switch-window-begin'});},
  endSwitch(){if(!scope)return;pushMarker({...scope,phase:'switch-window-end'});scope=null;},
  invoke(kind,code,execute){
   if(!scope||!markerReady||stopped)return execute(code);
   const identity={...scope,invocation:++invocation,kind};pushMarker({...identity,phase:'submitted'});
   let result;try{result=execute(rendererExpression(code,identity));}catch(cause){pushMarker({...identity,phase:'throw'});throw cause;}
   if(result&&typeof result.then==='function')result.then(()=>pushMarker({...identity,phase:'resolved'}),()=>pushMarker({...identity,phase:'rejected'}));else pushMarker({...identity,phase:'returned'});
   return result;
  },
  stop(reason='workload-complete'){
   if(stopPromise)return stopPromise;stopped=true;scope=null;
   stopPromise=(async()=>{
    if(startPromise)await startPromise;
    await finishProfiles(reason);
    if(markerReady)await calibration('end',`(${rendererFinish.toString()})()`);
    report.mainClock.final=stamp();report.ok=!!report.profiles.main&&!!report.profiles.renderer&&!!report.renderer.end?.value&&!report.errors.length&&!report.recordLimitReached;
    try{await write(FILES.report,report,limits.reportBytes);}catch(cause){error('report write',cause);}
    return report;
   })();return stopPromise;
  }
 };
}
module.exports={createPerformanceDiagnostic,rendererExpression,LIMITS,FILES};
