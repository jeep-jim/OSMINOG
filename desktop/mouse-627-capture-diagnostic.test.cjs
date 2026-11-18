'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {PLAN,LIMITS,summarize,stopDiagnosticTrace,runCaptureDiagnostic}=require('./mouse-627-capture-diagnostic.cjs');
function fixture({failPrepare=false,failStopTrace=false,failCleanup=false,rejectSentinel=false}={}){
 let clock=0,active=null,capturing=false,tracing=false,recording=false,readyAccess=0;const events=[],saved=[];
 const event=(name,row)=>{events.push({name,id:row?.id||active?.id,at:clock++});};
 const hooks={now:()=>clock,sleep:async ms=>{event('sleep:'+ms);clock+=ms;},persist:async report=>{saved.push(JSON.parse(JSON.stringify(report)));},
  baseline:async row=>{event('baseline',row);assert.equal(capturing,false);assert.equal(tracing,false);assert.equal(recording,false);return{closed:true};},
  startTrace:async row=>{event('trace-start',row);assert.equal(row.trace,true);assert.equal(tracing,false);tracing=true;},
  stopTrace:async row=>{event('trace-stop',row);assert.equal(tracing,true);if(failStopTrace)throw Error('trace still recording');tracing=false;return{complete:true};},
  prepare:async row=>{active=row;event('prepare',row);if(failPrepare)throw Error('opening capture timed out');return{samePages:true};},
  installRecorder:async row=>{event('record-start',row);assert.equal(recording,false);recording=true;},
  armCapture:async row=>{
   event('capture-arm',row);assert.equal(row.capture,true);assert.equal(capturing,false);capturing=true;
   let resolve,reject;const result=new Promise((yes,no)=>{resolve=yes;reject=no;});result.catch(()=>{});
   const capture={result,resolve,reject,cancel(){event('capture-cancel',row);capturing=false;reject(Error('cancelled'));}};
   Object.defineProperty(capture,'ready',{get(){readyAccess++;assert.equal(row.kind,'first-bitmap-barrier-sentinel','Matched trials must never access the first-frame barrier');event('first-frame-ready',row);return Promise.resolve({sequence:1});}});
   active.captureFixture=capture;return capture;
  },
  snapshot:async(row,label)=>{event('snapshot:'+label,row);return{phase:label==='before-click'?'open':'closed'};},
  clickClose:async row=>{event('click',row);if(row.capture){if(rejectSentinel&&row.kind==='first-bitmap-barrier-sentinel')row.captureFixture.reject(Error('original 4000ms deadline'));else row.captureFixture.resolve({selected:true});}return{nativeAt:clock};},
  waitClosed:async row=>event('wait-closed',row),
  stopRecorder:async row=>{event('record-stop',row);assert.equal(recording,true);recording=false;return{frames:[{time:1,phase:'closing',progress:1,matrix:{f:0}},{time:134,phase:'closing',progress:.95,matrix:{f:22}}],startup:{events:[{event:'play-ready'}]}};},
  checkRecord:async()=>({continuous:{satisfied:false,message:'only one intermediate'}}),
  finishCapture:async(_capture,row)=>{event('capture-write',row);assert.equal(capturing,false);assert.equal(tracing,false);assert.equal(recording,false);return{outcome:'recorded'};},
  cleanup:async row=>{event('cleanup',row);if(failCleanup)throw Error('native page identity changed');capturing=false;tracing=false;recording=false;},
 };
 return{hooks,events,saved,get readyAccess(){return readyAccess;}};
}

test('fixed ten-slot plan preserves common timing, separates sentinels and never awaits matched first frames',async()=>{
 const f=fixture(),r=await runCaptureDiagnostic(f.hooks);
 assert.equal(r.status,'complete');assert.equal(r.releaseEligible,false);assert.deepEqual(r.trials.map(row=>row.id),PLAN.map(row=>row.id));assert.equal(f.readyAccess,2);
 assert.deepEqual(r.trials.filter(row=>row.kind==='matched').map(row=>row.condition),['A','B','D','C','C','D','B','A']);
 for(const row of r.trials){
  assert.equal(row.status,'observed');assert.equal(row.summary.intermediateCount,1,'Sparse frames remain an observation, not a replacement trigger');assert.equal(row.observations.continuous.satisfied,false);
  const ev=f.events.filter(e=>e.id===row.id),names=ev.map(e=>e.name);
  assert.equal(names.filter(name=>name==='prepare').length,1);assert.equal(names.filter(name=>name==='click').length,1);
  assert.equal(names.includes('trace-start'),row.trace);assert.equal(names.includes('capture-arm'),row.capture);
  if(row.kind==='matched'){
   assert.ok(names.includes('sleep:'+LIMITS.preClickMs));assert.ok(names.includes('sleep:'+LIMITS.observationMs));assert.ok(!names.includes('first-frame-ready'));
   const before=row.chronology.find(e=>e.event==='matched-pre-click-start'),after=row.chronology.find(e=>e.event==='matched-pre-click-end');assert.equal(after.at-before.at,LIMITS.preClickMs+1);
  }else{assert.ok(names.indexOf('first-frame-ready')<names.indexOf('click'));assert.ok(!names.includes('sleep:'+LIMITS.observationMs));}
  if(row.capture){assert.ok(names.indexOf('capture-cancel')<names.indexOf('capture-write'));assert.ok(names.indexOf('record-stop')<names.indexOf('capture-write'));}
  if(row.trace&&row.capture)assert.ok(names.indexOf('trace-stop')<names.indexOf('capture-write'));
 }
 assert.equal(f.saved.at(-1).status,'complete');
});

test('original protocol capture deadline is preserved as an outcome without retry or replacement',async()=>{
 const f=fixture({rejectSentinel:true}),r=await runCaptureDiagnostic(f.hooks);assert.equal(r.status,'complete');
 for(const row of r.trials.filter(row=>row.kind==='first-bitmap-barrier-sentinel')){assert.equal(row.originalCaptureOutcome,'rejected');assert.match(row.originalCaptureError.message,/4000ms/);}
 assert.equal(f.events.filter(e=>e.name==='click').length,10);assert.equal(r.trials.length,10);
});

test('opening setup failure stops the predefined plan, drains trace and leaves every later slot not-run',async()=>{
 const f=fixture({failPrepare:true}),r=await runCaptureDiagnostic(f.hooks);assert.equal(r.status,'aborted');assert.equal(r.abortedAtTrial,PLAN[0].id);
 assert.equal(r.trials[0].status,'aborted');assert.match(r.trials[0].error.message,/opening capture/);assert.ok(r.trials.slice(1).every(row=>row.status==='not-run'));
 assert.equal(f.events.filter(e=>e.name==='prepare').length,1);assert.equal(f.events.filter(e=>e.name==='trace-stop').length,1);assert.equal(f.events.filter(e=>e.name==='click').length,0);
});

test('trace stop failure aborts remaining OFF trials even if fixture cleanup subsequently succeeds',async()=>{
 const f=fixture({failStopTrace:true}),r=await runCaptureDiagnostic(f.hooks);assert.equal(r.status,'aborted');assert.match(r.trials[0].traceError.message,/still recording/);
 assert.ok(r.trials.slice(1).every(row=>row.status==='not-run'));assert.equal(f.events.filter(e=>e.name==='click').length,1);assert.ok(f.events.some(e=>e.name==='capture-cancel'));
});

test('cleanup invariant failure persists raw observations then aborts without replacing the failed slot',async()=>{
 const f=fixture({failCleanup:true}),r=await runCaptureDiagnostic(f.hooks);assert.equal(r.status,'aborted');assert.equal(r.trials[0].record.frames.length,2);
 assert.match(r.trials[0].cleanupErrors[0].message,/page identity/);assert.ok(r.trials.slice(1).every(row=>row.status==='not-run'));assert.equal(f.saved.at(-1).status,'aborted');
});

test('a complete trace drain retains the shared debugger for the next planned condition',async()=>{
 const meta={complete:true,errors:[]},calls=[];
 const result=await stopDiagnosticTrace({stop:async()=>({mouseMotionTrace:meta})},{isAttached:()=>true,sendCommand:async command=>calls.push(command),detach:()=>calls.push('detach')});
 assert.strictEqual(result,meta);assert.deepEqual(calls,[]);
});

test('an unknown trace stop attempts end once, detaches and preserves lifecycle evidence for abort',async()=>{
 const meta={complete:false,errors:[{stage:'end',message:'timeout'}]},calls=[];let attached=true;
 await assert.rejects(stopDiagnosticTrace({stop:async()=>({mouseMotionTrace:meta})},{isAttached:()=>attached,sendCommand:async command=>{calls.push(command);throw Error('end rejected');},detach:()=>{calls.push('detach');attached=false;}}),error=>{assert.strictEqual(error.traceMeta,meta);assert.equal(error.traceCleanup.detached,true);assert.match(error.traceCleanup.endError.message,/end rejected/);return true;});
 assert.deepEqual(calls,['Tracing.end','detach']);assert.equal(attached,false);
});

test('emergency detach failure retains the original stop error and cannot masquerade as a clean OFF state',async()=>{
 const original=Error('original stop failure');
 await assert.rejects(stopDiagnosticTrace({stop:async()=>{throw original;}},{isAttached:()=>true,sendCommand:async()=>{},detach:()=>{throw Error('detach failed');}}),error=>{assert.strictEqual(error,original);assert.equal(error.traceCleanup.detached,false);assert.match(error.traceCleanup.detachError.message,/detach failed/);return true;});
});

test('summary retains every raw adjacent gap and separates closing endpoints from intermediates',()=>{
 const r=summarize({frames:[{time:10,phase:'open',progress:1,matrix:{f:0}},{time:30,phase:'closing',progress:1,matrix:{f:0}},{time:240,phase:'closing',progress:.5,matrix:{f:220}},{time:260,phase:'closing',progress:0,matrix:{f:440}}]});
 assert.equal(r.intermediateCount,1);assert.deepEqual(r.translations,[220]);assert.deepEqual(r.gaps.map(gap=>gap.ms),[20,210,20]);assert.equal(r.maxGapMs,210);
});

test('real workflow job guards prevent both PR and manual diagnostic branches from producing native candidates',()=>{
 const root=path.resolve(__dirname,'..'),guard=file=>fs.readFileSync(path.join(root,'.github/workflows',file),'utf8').match(/^    if: (.+)$/m)[1];
 const native=new Function('github','return '+guard('mouse-macos.yml')),diagnostic=new Function('github','return '+guard('mouse-capture-diagnostic.yml'));
 for(const github of [{head_ref:'mouse627-capture-diagnostic',ref_name:'166/merge'},{head_ref:'',ref_name:'mouse627-capture-diagnostic'}]){assert.equal(native(github),false);assert.equal(diagnostic(github),true);}
 for(const github of [{head_ref:'mouse627-window-documents-performance',ref_name:'165/merge'},{head_ref:'',ref_name:'main'},{head_ref:'mouse627-capture-diagnostic-other',ref_name:'other'}]){assert.equal(native(github),true);assert.equal(diagnostic(github),false);}
});

test('installed diagnostic wrapper rejects acceptance markers, missing slots and release-eligible reports',()=>{
 const script=`import importlib.util,copy\np=${JSON.stringify(path.resolve(__dirname,'../tools/mouse-capture-diagnostic.py'))}\ns=importlib.util.spec_from_file_location('diagnostic',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nr={'diagnosticOnly':True,'releaseEligible':False,'status':'complete','trials':[{'id':i,'status':'observed'} for i in m.ORDER]}\no=m.MARKER+' {}'\nassert m.validate_result(0,o,r)['releaseEligible'] is False\ncases=[(1,o,r),(0,'',r),(0,o+'\\nMOUSE_ARM64_SMOKE_PASS',r),(0,o,{**r,'releaseEligible':True}),(0,o,{**r,'trials':r['trials'][:-1]}),(0,o,{**r,'status':'aborted'})]\nfor case in cases:\n try:m.validate_result(*case)\n except ValueError:pass\n else:raise AssertionError('invalid diagnostic accepted')\nprint('wrapper contract checked')`;
 const result=spawnSync('python3',['-B','-c',script],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/wrapper contract checked/);
});
