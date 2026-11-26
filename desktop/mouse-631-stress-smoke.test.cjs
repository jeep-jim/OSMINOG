'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./mouse-631-stress-smoke.cjs'),'utf8');

// Exercise the actual fixture's setup/finally without pretending to run native
// pages on this host. Stop at bank access, after media setup and before HTTP/UI.
async function trial(before,{enableFailure=false,restoreMismatch=false}={}){
 let reduced=before,attached=false,report,cleanupCalls=0;
 const commands=[],setupFailure=Error('Owned fixture setup stopped for cleanup test');
 const debug={isAttached:()=>attached,attach:version=>{assert.equal(version,'1.3');attached=true;},detach:()=>{attached=false;},sendCommand:async(name,params)=>{
  assert.equal(name,'Emulation.setEmulatedMedia');commands.push(JSON.parse(JSON.stringify(params)));
  if(params.features.length){reduced=false;if(enableFailure)throw Error('Media command failed after applying override');}
  else reduced=restoreMismatch?!before:before;
 }};
 const fixture={win:{webContents:{debugger:debug}},js:async text=>{assert.equal(text,'matchMedia("(prefers-reduced-motion:reduce)").matches');return reduced;},cleanup:async()=>{cleanupCalls++;return{restored:true};},get bank(){throw setupFailure;}};
 const sandbox={module:{exports:{}},process,performance,structuredClone,console,setInterval,clearInterval,require:name=>{
  if(name==='node:fs/promises')return{writeFile:async(_name,bytes)=>{report=JSON.parse(bytes);}};
  if(name==='./mouse-631-smoke-helpers.cjs')return{createFixture:async()=>fixture,bounded:async operation=>operation,sleep:async()=>{},pageHTML:()=>{throw Error('HTTP must not start in this targeted fixture test');}};
  return require(name);
 }};
 vm.runInNewContext(source,sandbox,{filename:'mouse-631-stress-smoke.cjs'});
 await assert.rejects(sandbox.module.exports({app:{getVersion:()=> '6.0.31'}}),enableFailure?/Media command failed/:/Owned fixture setup stopped/);
 return{commands,attached,reduced,report,cleanupCalls};
}

for(const before of [true,false])test('stress animation fixture restores inherited reduced motion '+before+' after failure',async()=>{
 const result=await trial(before);
 assert.deepEqual(result.commands,[{features:[{name:'prefers-reduced-motion',value:'no-preference'}]},{media:'',features:[]}]);
 assert.deepEqual(result.report.motionMedia,{before,normal:false,restored:before});
 assert.equal(result.attached,false);assert.equal(result.reduced,before);assert.equal(result.cleanupCalls,1);assert.equal(result.report.ok,false);assert.equal(result.report.motionCleanupError,undefined);
});

test('stress fixture clears a partially applied media override when setup rejects',async()=>{
 const result=await trial(true,{enableFailure:true});
 assert.equal(result.commands.length,2);assert.equal(result.report.motionMedia.restored,true);assert.equal(result.reduced,true);assert.equal(result.attached,false);assert.equal(result.cleanupCalls,1);
});

test('stress fixture records a failed inherited motion restoration and remains failed',async()=>{
 const result=await trial(true,{restoreMismatch:true});
 assert.equal(result.attached,false);assert.equal(result.report.ok,false);assert.match(result.report.motionCleanupError.message,/restores the inherited motion preference/);
});

function timingHarness(now){
 const sandbox={module:{exports:{}},require:name=>name==='./mouse-631-smoke-helpers.cjs'?{}:require(name)};
 vm.runInNewContext(source,sandbox,{filename:'mouse-631-stress-smoke.cjs'});
 return sandbox.createSwitchTimings(now);
}

test('passive switch timing leaves calls outside the measured window unchanged',()=>{
 const timings=timingHarness(()=>{throw Error('An inactive diagnostic must not read the clock');});
 const receiver={},argument={},result={};
 function original(value){assert.equal(this,receiver);assert.equal(value,argument);return result;}
 assert.equal(timings.call('setBounds',original,receiver,[argument],7),result);
 const first=timings.begin(20,1);timings.end(42);
 assert.equal(timings.call('setBounds',original,receiver,[argument],7),result);
 assert.equal(first.calls.length,0);assert.equal(first.endedAt,42);
 const second=timings.begin(50,2);timings.end(84);
 assert.notEqual(first,second);assert.equal(second.stage,50);assert.equal(second.switchSequence,2);assert.equal(second.calls.length,0);
});

test('passive switch timing records nested native wall spans without changing returns or receivers',()=>{
 let now=10;const timings=timingHarness(()=>now),scope=timings.begin(20,3),browser={},page={},argument={},result={};
 scope.startedAt=9;
 const returned=timings.call('browser.layout',function(value){
  assert.equal(this,browser);assert.equal(value,argument);now=12;
  assert.equal(timings.call('setBounds',function(bounds){assert.equal(this,page);assert.equal(bounds,argument);now=17;return result;},page,[argument],7),result);
  now=20;return result;
 },browser,[argument]);
 timings.end(22);
 assert.equal(returned,result);assert.equal(scope.clock,'main.performance.now');assert.equal(scope.startedAt,9);assert.equal(scope.endedAt,22);
 assert.deepEqual(JSON.parse(JSON.stringify(scope.calls)),[
  {id:1,parentId:null,method:'browser.layout',startedAt:10,elapsedMs:10},
  {id:2,parentId:1,method:'setBounds',pageIndex:7,startedAt:12,elapsedMs:5}
 ]);
});

test('passive switch timing preserves native exceptions and unwinds parent spans',()=>{
 let now=1;const timings=timingHarness(()=>now++),scope=timings.begin(50,9),failure=Error('native operation failed');
 assert.throws(()=>timings.call('browser.layout',()=>timings.call('setVisible',()=>{throw failure;},null,[false],4),null,[]),error=>error===failure);
 const result={};assert.equal(timings.call('nativeCorners',()=>result,null,[[]]),result);timings.end(now);
 assert.equal(scope.calls[0].threw,true);assert.equal(scope.calls[1].threw,true);
 assert.equal(scope.calls[1].parentId,scope.calls[0].id);assert.equal(scope.calls[2].parentId,null);
 assert.equal(scope.calls[0].elapsedMs,3);assert.equal(scope.calls[1].elapsedMs,1);assert.equal(scope.calls[2].elapsedMs,1);
});

test('passive state and layout context preserve exact results and diagnostic errors cannot mask native failures',()=>{
 let now=0,described=0;const timings=timingHarness(()=>now++),receiver={},argument={},returned=Promise.resolve('unchanged'),failure=Error('original state failure');
 const describe=()=>{described++;return{activeDesk:'desk-b',requestedPanelIds:['left','right']};};
 function original(value){assert.equal(this,receiver);assert.equal(value,argument);return returned;}
 assert.equal(timings.call('browser.layout',original,receiver,[argument],undefined,describe),returned);assert.equal(described,0);
 const scope=timings.begin(20,1);
 assert.equal(timings.call('browser.layout',original,receiver,[argument],undefined,describe),returned);
 assert.equal(timings.call('browser.state',original,receiver,[argument]),returned);
 assert.throws(()=>timings.call('browser.layout',()=>{throw failure;},receiver,[],undefined,()=>{throw Error('context unavailable');}),error=>error===failure);
 timings.end(10);
 assert.equal(described,1);assert.deepEqual(JSON.parse(JSON.stringify(scope.calls[0].context)),{activeDesk:'desk-b',requestedPanelIds:['left','right']});
 assert.equal(scope.calls[1].method,'browser.state');assert.equal(scope.calls[1].threw,undefined);
 assert.equal(scope.calls[2].contextError,'context unavailable');assert.equal(scope.calls[2].threw,true);
});

// These are unit-only renderer API adapters. Evaluate the actual serialized
// function in a fresh realm, as fixture.js does; no browser/native proof is claimed.
function monitorHarness({supported=['longtask'],observeFailure=false,takeFailure=false,nativeTest=false,now=()=>{throw Error('Inactive trace must not read the clock');}}={}){
 const declarations={module:{exports:{}},require:name=>name==='./mouse-631-smoke-helpers.cjs'?{}:require(name)};
 vm.runInNewContext(source,declarations,{filename:'mouse-631-stress-smoke.cjs'});
 const monitorSource=declarations.rendererMonitorInPage.toString(),pending=new Map(),observers=[],cancelled=[];let nextId=0,scheduled=0;
 class MockPerformanceObserver{
  static get supportedEntryTypes(){return supported;}
  constructor(callback){this.callback=callback;this.records=[];this.disconnected=false;observers.push(this);}
  observe(options){this.options=JSON.parse(JSON.stringify(options));if(options.type==='long-animation-frame'&&observeFailure)throw Error('optional observe unavailable');}
  takeRecords(){if(takeFailure)throw Error('optional records unavailable');return this.records.splice(0);}
  disconnect(){this.disconnected=true;}
 }
 const renderer=vm.createContext({MouseNative:{test:nativeTest},performance:{now},PerformanceObserver:MockPerformanceObserver,requestAnimationFrame:callback=>{scheduled++;pending.set(++nextId,callback);return nextId;},cancelAnimationFrame:id=>{cancelled.push(id);pending.delete(id);}});
 vm.runInContext(fs.readFileSync(require.resolve('./mouse/desktop-slide.js'),'utf8'),renderer);
 const call=start=>vm.runInContext(`(${monitorSource})(${start})`,renderer);
 return{
  start:()=>call(true),stop:()=>JSON.parse(JSON.stringify(call(false))),
  tick:time=>{assert.equal(pending.size,1,'Only the original monitor frame may be pending');const [id,callback]=pending.entries().next().value;pending.delete(id);callback(time);},
  observer:type=>observers.find(observer=>observer.options?.type===type),
  emit:(type,entries)=>observers.find(observer=>observer.options?.type===type).callback({getEntries:()=>entries}),
  trace:(phase,frameTime)=>renderer.MouseDesktopSlide.trace(phase,frameTime),
  snapshot:()=>{const value=renderer.__mouse631Frames?.switchTrace?.snapshot();return value?JSON.parse(JSON.stringify(value)):null;},
  pending,observers,cancelled,get scheduled(){return scheduled;}
 };
}

test('renderer diagnostics use the original rAF clock and preserve legacy samples without extra frames',()=>{
 const monitor=monitorHarness();assert.equal(monitor.start(),true);
 for(const time of [0,16,33,93])monitor.tick(time);
 monitor.emit('longtask',[{startTime:20,duration:51}]);
 const {diagnostics,...legacy}=monitor.stop();
 assert.deepEqual(legacy,{frames:4,gaps:[16,17,60],maxGapMs:60,longTasks:[{startTime:20,duration:51}]});
 assert.equal(diagnostics.clock,'renderer.performance.now');assert.deepEqual(diagnostics.frameIntervals,[{startTime:0,endTime:16,duration:16},{startTime:16,endTime:33,duration:17},{startTime:33,endTime:93,duration:60}]);
 assert.equal(diagnostics.droppedFrameIntervals,0);assert.equal(diagnostics.longAnimationFrames.supported,false);assert.equal(diagnostics.longAnimationFrames.observeError,null);
 assert.equal(monitor.scheduled,5);assert.equal(monitor.pending.size,0);assert.equal(monitor.cancelled.length,1);assert.equal(monitor.observers.length,1);assert.equal(monitor.observers[0].disconnected,true);
 assert.deepEqual(monitor.observers[0].options,{type:'longtask',buffered:false});
});

test('switch trace requires both native test mode and a running monitor, and ignores work outside a switch',()=>{
 let reads=0;const disabled=monitorHarness({now:()=>{reads++;return reads;}});disabled.start();disabled.trace('switch.begin');disabled.trace('switch.end');assert.equal(disabled.snapshot(),null);assert.equal(disabled.stop().switchTrace,undefined);assert.equal(reads,0);
 const monitor=monitorHarness({nativeTest:true,now:()=>{reads++;return reads;}});
 monitor.trace('switch.begin');assert.equal(reads,0);monitor.start();monitor.trace('render.begin');assert.equal(reads,0);
 monitor.trace('switch.begin');monitor.trace('https://private.example/payload');monitor.trace('present.raf1',-4);monitor.trace('present.raf2',0);monitor.trace('switch.end');
 const trace=monitor.snapshot();assert.equal(trace.clock,'renderer.performance.now');assert.equal(trace.limit,512);assert.equal(trace.sequence,1);assert.equal(trace.closed,true);assert.equal(trace.startedAt,1);assert.equal(trace.endedAt,4);
 assert.deepEqual(trace.records,[{phase:'switch.begin',at:1},{phase:'present.raf1',at:2,frameTime:-4,callbackNow:2},{phase:'present.raf2',at:3,frameTime:0,callbackNow:3},{phase:'switch.end',at:4}]);
 monitor.trace('render.end');assert.equal(reads,4);assert.deepEqual(monitor.stop().switchTrace,trace);monitor.trace('switch.begin');assert.equal(reads,4);assert.equal(monitor.scheduled,1);
});

test('switch trace caps actual records, counts dropped events, closes after overflow and resets for the next switch',()=>{
 let now=0;const monitor=monitorHarness({nativeTest:true,now:()=>++now});monitor.start();monitor.trace('switch.begin');
 for(let i=0;i<600;i++)monitor.trace('state.begin');monitor.trace('switch.end');
 const first=monitor.snapshot();assert.equal(first.records.length,512);assert.equal(first.dropped,90);assert.equal(first.closed,true);assert.equal(first.endedAt,513);assert.equal(now,513,'Dropped ordinary records do not read the clock');
 monitor.trace('switch.begin');monitor.trace('switch.end');const second=monitor.snapshot();assert.equal(second.sequence,2);assert.equal(second.records.length,2);assert.equal(second.dropped,0);assert.equal(first.records.length,512);
 monitor.trace('switch.begin');monitor.trace('render.begin');const partial=monitor.stop().switchTrace;assert.equal(partial.sequence,3);assert.equal(partial.closed,false);assert.equal(partial.endedAt,undefined);assert.equal(monitor.snapshot(),null);monitor.trace('switch.end');assert.equal(now,517);
});

test('observer clock failure is fail-open and the switch finally still clears the active trace',()=>{
 let fail=false,reads=0;const monitor=monitorHarness({nativeTest:true,now:()=>{reads++;if(fail)throw Error('diagnostic clock failed');return reads;}});monitor.start();monitor.trace('switch.begin');fail=true;
 assert.doesNotThrow(()=>monitor.trace('layout.begin'));assert.doesNotThrow(()=>monitor.trace('switch.end'));const partial=monitor.snapshot();assert.equal(partial.records.length,1);assert.equal(partial.closed,false);
 fail=false;monitor.trace('state.begin');assert.equal(reads,3,'A failed end cannot leave a collector active');monitor.trace('switch.begin');monitor.trace('switch.end');assert.equal(monitor.snapshot().sequence,2);assert.equal(monitor.snapshot().closed,true);monitor.stop();
});

test('renderer diagnostics stay bounded while legacy gaps and long tasks retain their original rolling windows',()=>{
 const monitor=monitorHarness();monitor.start();for(let index=0;index<4100;index++)monitor.tick(index*10);
 monitor.emit('longtask',Array.from({length:130},(_,index)=>({startTime:index,duration:50+index})));
 const result=monitor.stop(),intervals=result.diagnostics.frameIntervals;
 assert.equal(result.frames,4100);assert.equal(result.gaps.length,4096);assert.ok(result.gaps.every(gap=>gap===10));assert.equal(result.maxGapMs,10);
 assert.equal(result.longTasks.length,128);assert.equal(result.longTasks[0].startTime,2);assert.equal(result.longTasks.at(-1).startTime,129);
 assert.equal(intervals.length,4096);assert.deepEqual(intervals[0],{startTime:0,endTime:10,duration:10});assert.deepEqual(intervals.at(-1),{startTime:40980,endTime:40990,duration:10});assert.equal(result.diagnostics.droppedFrameIntervals,3);
 assert.equal(monitor.scheduled,4101);assert.equal(monitor.pending.size,0);
});

test('optional LoAF stores only bounded plain fields and keeps unavailable numeric attribution null',()=>{
 const monitor=monitorHarness({supported:['longtask','long-animation-frame']});monitor.start();monitor.tick(1);
 const windowObject={};windowObject.circular=windowObject;
 const script={startTime:2,duration:7,executionStart:3,forcedStyleAndLayoutDuration:Infinity,sourceCharPosition:12,invokerType:'event-listener',invoker:'x'.repeat(1100),sourceURL:'file:///app/'+'directory/'.repeat(12)+'desktop/browser.js',sourceFunctionName:'renderTree',windowAttribution:'self',window:windowObject};
 const row={startTime:1,duration:80,renderStart:20,styleAndLayoutStart:NaN,blockingDuration:30,scripts:Array(34).fill(script)};
 monitor.emit('long-animation-frame',[row]);
 monitor.observer('long-animation-frame').records.push({startTime:90,duration:60,scripts:[]});
 const result=monitor.stop(),loaf=result.diagnostics.longAnimationFrames;
 assert.equal(loaf.supported,true);assert.equal(loaf.observeError,null);assert.equal(loaf.entries.length,2);assert.equal(loaf.entries[0].scripts.length,8);
 assert.deepEqual(Object.keys(loaf.entries[0]),['startTime','duration','renderStart','styleAndLayoutStart','blockingDuration','scripts']);
 assert.equal(loaf.entries[0].styleAndLayoutStart,null);assert.equal(loaf.entries[1].renderStart,null);assert.equal(loaf.entries[1].blockingDuration,null);
 assert.equal(loaf.entries[0].scripts[0].forcedStyleAndLayoutDuration,null);assert.equal(loaf.entries[0].scripts[0].invoker.length,64);assert.equal('window' in loaf.entries[0].scripts[0],false);
 assert.deepEqual(loaf.textTruncation,{strategy:'head+ellipsis+tail',maxUTF16Units:64});
 const location=loaf.entries[0].scripts[0].sourceURL;assert.equal(location.length,64);assert.ok(location.startsWith('file:///app/'));assert.ok(location.includes('…'));assert.ok(location.endsWith('desktop/browser.js'));
 assert.deepEqual(loaf.truncated,{frames:0,scripts:26,strings:16});assert.deepEqual(monitor.observer('long-animation-frame').options,{type:'long-animation-frame',buffered:false});
 assert.equal(monitor.observer('long-animation-frame').disconnected,true);assert.equal(monitor.scheduled,2);
});

test('optional LoAF caps frame entries and cannot break legacy monitor when observation or readback is unavailable',()=>{
 const capped=monitorHarness({supported:['longtask','long-animation-frame']});capped.start();capped.emit('long-animation-frame',Array.from({length:130},(_,index)=>({startTime:index,duration:51,scripts:[]})));
 const loaf=capped.stop().diagnostics.longAnimationFrames;assert.equal(loaf.entries.length,64);assert.equal(loaf.entries[0].startTime,0);assert.equal(loaf.entries.at(-1).startTime,129);assert.equal(loaf.truncated.frames,66);
 for(const option of ['observeFailure','takeFailure']){
  const monitor=monitorHarness({supported:['longtask','long-animation-frame'],[option]:true});monitor.start();monitor.tick(10);monitor.tick(30);
  const result=monitor.stop();assert.equal(result.frames,2);assert.deepEqual(result.gaps,[20]);assert.equal(result.maxGapMs,20);assert.match(result.diagnostics.longAnimationFrames.observeError,/optional .* unavailable/);
  assert.ok(monitor.observers.every(observer=>observer.disconnected));assert.equal(monitor.pending.size,0);assert.equal(monitor.scheduled,3);
 }
});

test('two fully populated diagnostic stages fit the unchanged 8 MiB reader with a 2 MiB legacy reserve',()=>{
 // NUL and lone-surrogate escaping costs six bytes per UTF-16 unit, more than
 // valid multibyte text. Use the real helper and the exact pretty-JSON save form.
 for(const character of ['\u0000','\ud800','界','😀'])for(const units of [64,128]){
  const number=-0.0000010000000000000002;
  const monitor=monitorHarness({supported:['longtask','long-animation-frame'],nativeTest:true,now:()=>number});monitor.start();
  for(let index=0;index<4097;index++)monitor.tick(index%2?number:-number);
  const script=Object.fromEntries(['startTime','duration','executionStart','forcedStyleAndLayoutDuration','sourceCharPosition'].map(key=>[key,number]));
  for(const key of ['invokerType','invoker','sourceURL','sourceFunctionName','windowAttribution'])script[key]=character.repeat(units).slice(0,units);
  const frame=Object.fromEntries(['startTime','duration','renderStart','styleAndLayoutStart','blockingDuration'].map(key=>[key,number]));frame.scripts=Array(9).fill(script);
  monitor.emit('long-animation-frame',Array(65).fill(frame));
  monitor.emit('long-animation-frame',[{get startTime(){throw Error('\u0000'.repeat(512));}}]);
  monitor.trace('switch.begin');for(let i=0;i<512;i++)monitor.trace('present.raf1',number);monitor.trace('switch.end');
  const {diagnostics,switchTrace}=monitor.stop(),loaf=diagnostics.longAnimationFrames;
  assert.equal(diagnostics.frameIntervals.length,4096);assert.equal(loaf.entries.length,64);assert.ok(loaf.entries.every(entry=>entry.scripts.length===8));
  assert.equal(loaf.observeError.length,512);assert.deepEqual(loaf.truncated,{frames:1,scripts:65,strings:units>64?65*8*5:0});
  assert.equal(switchTrace.records.length,512);assert.equal(switchTrace.closed,true);assert.equal(switchTrace.dropped,2);
  const report={legacyRawReserve:'x'.repeat(2*1024*1024),stages:[{rendererDiagnostics:diagnostics,switches:Array.from({length:5},()=>({rendererTrace:switchTrace}))},{rendererDiagnostics:diagnostics,switches:Array.from({length:10},()=>({rendererTrace:switchTrace}))}],lastSwitchRendererTrace:switchTrace};
  const bytes=Buffer.byteLength(JSON.stringify(report,null,2)+'\n','utf8');
  assert.ok(bytes<8*1024*1024,`${bytes} bytes with ${units} units of ${JSON.stringify(character)} exceeds the existing report limit`);
 }
});
