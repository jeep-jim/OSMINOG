'use strict';
// CI-only causal observations. These records cannot satisfy native release gates.
const {bounded}=require('./mouse-smoke-trace.cjs');
const CONDITIONS=Object.freeze({A:{capture:false,trace:false},B:{capture:true,trace:false},C:{capture:false,trace:true},D:{capture:true,trace:true}});
const PLAN=Object.freeze([
 {id:'00-sentinel-before',kind:'first-bitmap-barrier-sentinel',condition:'D'},
 ...['A','B','D','C','C','D','B','A'].map((condition,index)=>({id:String(index+1).padStart(2,'0')+'-'+condition,kind:'matched',condition})),
 {id:'09-sentinel-after',kind:'first-bitmap-barrier-sentinel',condition:'D'},
].map(trial=>Object.freeze({...trial,theme:'light',...CONDITIONS[trial.condition]})));
const LIMITS=Object.freeze({preClickMs:1000,observationMs:2000,quietMs:1000});
const errorValue=error=>({message:String(error?.message||error),...(error?.stack?{stack:error.stack}:{})});

async function stopDiagnosticTrace(trace,debug){
 let meta,reason;
 try{
  meta=(await trace.stop('diagnostic-trial-complete')).mouseMotionTrace;
  if(meta.complete&&debug.isAttached()&&!meta.errors.some(error=>['start','end','stop','close'].includes(error.stage)))return meta;
  reason=Error('Diagnostic trace lifecycle did not prove stop and drain');
 }catch(error){reason=error instanceof Error?error:Error(String(error));}
 const cleanup={attempted:true};
 try{if(debug.isAttached()){await bounded(()=>debug.sendCommand('Tracing.end'),3000,'Diagnostic emergency trace end');cleanup.endCompleted=true;}}
 catch(error){cleanup.endError=errorValue(error);}
 finally{
  try{if(debug.isAttached())debug.detach();cleanup.detached=!debug.isAttached();}
  catch(error){cleanup.detachError=errorValue(error);cleanup.detached=false;}
 }
 reason.traceMeta=meta;reason.traceCleanup=cleanup;throw reason;
}

function summarize(record){
 const frames=record?.frames||[],closing=frames.filter(frame=>frame.phase==='closing'),intermediate=closing.filter(frame=>frame.progress>0&&frame.progress<1);
 const gaps=frames.slice(1).map((frame,index)=>({from:frames[index].time,to:frame.time,ms:frame.time-frames[index].time,fromPhase:frames[index].phase,toPhase:frame.phase}));
 return{frameCount:frames.length,closingFrameCount:closing.length,intermediateCount:intermediate.length,translations:intermediate.map(frame=>frame.matrix.f),gaps,maxGapMs:Math.max(0,...gaps.map(gap=>gap.ms))};
}

async function runCaptureDiagnostic(hooks){
 const now=hooks.now||(()=>performance.now()),sleep=hooks.sleep||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 const report={schemaVersion:1,diagnosticOnly:true,releaseEligible:false,theme:'light',motionDurationMs:300,limits:LIMITS,
  design:{conditions:CONDITIONS,matchedOrder:'A-B-D-C-C-D-B-A',sentinels:'D before and after preserve the arm/first-bitmap/click barrier policy and original capture deadline; excluded from matched comparison. They add a before-click native/renderer snapshot IPC and defer evidence disk writes until cleanup. This is not an identical replay of the complete normal fixture.',
   captureTreatment:'Closing subscription only; identical opening capture and fixedControls precede every trial. Existing helper stops at its first qualifying bitmap and encodes that frame after unsubscribe.',
   primary:'Same renderer RAF/DOM recorder in every condition; OFF has no closing pixel proof',
   chronology:'Main clock and renderer clock remain separate; trace performance.mark anchors are recorded where available',
   carryover:'Subscription cancelled, recorder stopped, trace drained and files written, then fixed quiet interval. This does not prove hardware GPU drain.',
   stopping:'Exactly the predefined slots. No replacement trials. Setup/cleanup invariant failure aborts remaining slots.'},
  status:'running',startedAt:now(),trials:PLAN.map(trial=>({...trial,status:'not-run'}))};
 await hooks.persist(report);
 for(const row of report.trials){
  row.status='running';row.chronology=[];let capture=null,traceStarted=false,recorderStarted=false,record=null,failed=false;
  const mark=(event,detail)=>{const entry={event,at:now(),...(detail?{detail}:{})};row.chronology.push(entry);return entry;};
  mark('trial-start');await hooks.persist(report);
  try{
   row.baselineBefore=await hooks.baseline(row,'before');mark('baseline-verified');
   if(row.trace){traceStarted=true;await hooks.startTrace(row);mark('trace-started');}
   row.setup=await hooks.prepare(row);mark('common-opening-and-fixed-controls-complete');
   await hooks.installRecorder(row);recorderStarted=true;mark('recorder-installed');
   if(row.capture){capture=await hooks.armCapture(row);mark('capture-armed');}
   if(row.kind==='first-bitmap-barrier-sentinel'){
    row.ready=await capture.ready;mark('original-first-bitmap-ready');
   }else{
    mark('matched-pre-click-start');await sleep(LIMITS.preClickMs);mark('matched-pre-click-end');
   }
   row.beforeClick=await hooks.snapshot(row,'before-click');
   row.click=await hooks.clickClose(row);mark('native-click-returned');
   if(row.kind==='first-bitmap-barrier-sentinel'){
    // This is the original capture deadline/result, not a new qualifying trial.
    try{await capture.result;row.originalCaptureOutcome='selected';}
    catch(error){row.originalCaptureOutcome='rejected';row.originalCaptureError=errorValue(error);}
    mark('original-capture-settled');await hooks.waitClosed(row);
   }else{
    mark('matched-observation-start');await sleep(LIMITS.observationMs);mark('matched-observation-end');
   }
   record=await hooks.stopRecorder(row);recorderStarted=false;row.record=record;row.summary=summarize(record);mark('recorder-stopped');
   row.afterObservation=await hooks.snapshot(row,'after-observation');
   row.observations=await hooks.checkRecord(record,row);row.status='observed';
  }catch(error){failed=true;row.status='aborted';row.error=errorValue(error);mark('setup-or-observation-error');}
  finally{
   // Cancel before trace drain and deferred evidence writes. The reused helper
   // may already have encoded its selected bitmap after ending subscription.
   // Its done guard prevents a late callback from crossing trial boundaries.
   if(capture){try{capture.cancel();mark('capture-cancelled');}catch(error){failed=true;(row.cleanupErrors??=[]).push(errorValue(error));}}
   if(recorderStarted){try{record=await hooks.stopRecorder(row);row.record=record;row.summary=summarize(record);mark('recorder-stopped-on-cleanup');}catch(error){failed=true;(row.cleanupErrors??=[]).push(errorValue(error));}}
   if(traceStarted){try{row.traceResult=await hooks.stopTrace(row);mark('trace-stopped-and-drained');}catch(error){failed=true;row.traceError=errorValue(error);mark('trace-drain-error');}}
   if(capture){try{row.captureResult=await hooks.finishCapture(capture,row);mark('capture-evidence-written');}catch(error){failed=true;(row.cleanupErrors??=[]).push(errorValue(error));}}
   try{await hooks.cleanup(row);mark('fixture-cleaned');await sleep(LIMITS.quietMs);mark('quiet-interval-complete');row.baselineAfter=await hooks.baseline(row,'after');mark('baseline-restored');}
   catch(error){failed=true;(row.cleanupErrors??=[]).push(errorValue(error));mark('cleanup-invariant-error');}
   row.finishedAt=now();
   if(failed){row.status='aborted';report.status='aborted';report.abortedAtTrial=row.id;}
   await hooks.persist(report);
  }
  if(failed)break;
 }
 if(report.status==='running')report.status='complete';report.finishedAt=now();await hooks.persist(report);return report;
}
module.exports={CONDITIONS,PLAN,LIMITS,summarize,stopDiagnosticTrace,runCaptureDiagnostic};
