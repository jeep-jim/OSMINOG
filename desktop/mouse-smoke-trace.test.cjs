'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createMotionTrace,TRACE_CATEGORIES}=require('./mouse-smoke-trace.cjs');
const sample={cat:'devtools.timeline',name:'Animation',ph:'b',pid:10,tid:20,ts:123,id2:{local:'0x42'},args:{data:{nodeId:12,nodeName:'DIALOG',compositeFailed:16,unsupportedProperties:['height','background-color'],url:'https://private.invalid/',text:'private text',stackTrace:[{url:'private'}]}}};
class Debugger extends EventEmitter{
 constructor({events=[sample],chunks,complete={},command}={}){super();this.calls=[];this.chunks=chunks||[{data:JSON.stringify({traceEvents:events}),eof:true}];this.complete={stream:'fixture-stream',traceFormat:'json',streamCompression:'none',dataLossOccurred:false,...complete};this.command=command;}
 async sendCommand(method,params){this.calls.push({method,params});if(this.command){const result=this.command(method,params,this);if(result!==undefined)return result;}if(method==='Tracing.end')queueMicrotask(()=>this.emit('message',{},'Tracing.tracingComplete',this.complete));if(method==='IO.read')return this.chunks.shift()||{data:'',eof:true};return{};}
 count(method){return this.calls.filter(call=>call.method===method).length;}
}
function fixture(debug=new Debugger(),options={}){
 const saved=[],trace=createMotionTrace(debug,{snapshot:async label=>({label,visible:true,focused:true}),limits:{recordMs:1000,commandMs:60,readMs:300,writeMs:60},write:async(file,data,signal)=>{saved.push({file,data,signal});},...options});
 return{debug,trace,saved};
}
test('stream trace preserves scheduling, compositor failure, marker and process/thread identity without page content',async()=>{
 const events=[sample,{cat:'__metadata',name:'process_name',ph:'M',pid:10,tid:0,args:{name:'Renderer'}},{cat:'__metadata',name:'thread_name',ph:'M',pid:10,tid:20,args:{name:'CrRendererMain'}},{cat:'renderer.scheduler',name:'RunTask',ph:'X',pid:10,tid:20,ts:120,dur:200,tts:30,tdur:150,args:{task_type:'MainThreadTask',queue:{priority:'normal',queued:3},requestHeaders:{secret:'no'}}},{cat:'blink.user_timing',name:'mouse627.motion.arm-light-closing',ph:'R',pid:10,tid:20,ts:122,args:{detail:'private detail'}},{cat:'blink.user_timing',name:'private-page-mark',ph:'R',pid:10,tid:20,ts:122},{cat:'__metadata',name:'process_labels',ph:'M',pid:10,args:{labels:'Private page'}},{cat:'devtools.timeline',name:'ResourceSendRequest',ph:'I',args:{url:'https://private.invalid'}},{cat:'disabled-by-default-devtools.screenshot',name:'Screenshot',ph:'O',args:{snapshot:'secret pixels'}}];
 const f=fixture(new Debugger({events}));await f.trace.start();f.trace.checkpoint('click-close',{visible:true,renderer:{marker:'mouse627.motion.click-close',markStartTime:12}});f.debug.emit('message',{},'Tracing.bufferUsage',{percentFull:.5,eventCount:100});
 const document=await f.trace.stop(),meta=document.mouseMotionTrace,config=f.debug.calls[0].params;
 assert.equal(meta.complete,true);assert.equal(meta.eventCount,5);assert.equal(meta.droppedEvents,4);assert.deepEqual(meta.errors,[]);assert.equal(config.transferMode,'ReturnAsStream');assert.equal(config.streamFormat,'json');assert.equal(config.traceConfig.recordMode,'recordContinuously');assert.deepEqual(config.traceConfig.includedCategories,TRACE_CATEGORIES);assert.deepEqual(config.traceConfig.excludedCategories,['*']);assert.equal(config.traceConfig.enableSampling,false);
 assert.equal(document.traceEvents[0].args.data.compositeFailed,16);assert.deepEqual(document.traceEvents[0].args.data.unsupportedProperties,['height','background-color']);assert.deepEqual(document.traceEvents[0].id2,{local:'0x42'});assert.equal(document.traceEvents[1].args.name,'Renderer');assert.equal(document.traceEvents[2].args.name,'CrRendererMain');assert.equal(document.traceEvents[3].args.queue.priority,'normal');assert.equal(document.traceEvents[3].dur,200);assert.equal(document.traceEvents[3].tdur,150);assert.equal(meta.bufferUsage[0].percentFull,.5);
 assert.deepEqual(meta.snapshots.map(item=>item.label),['before','click-close','after']);assert.doesNotMatch(f.saved[0].data,/private|secret pixels|Private page|ResourceSendRequest|Screenshot/);assert.equal(f.debug.count('IO.close'),1);assert.equal(f.debug.listenerCount('message'),0);assert.equal(f.debug.listenerCount('detach'),0);
});
test('base64 stream chunks are joined and concurrent stop calls close/write only once',async()=>{
 const source=JSON.stringify({traceEvents:[sample]}),half=Math.floor(source.length/2),f=fixture(new Debugger({chunks:[{data:source.slice(0,half),eof:false},{data:Buffer.from(source.slice(half)).toString('base64'),base64Encoded:true,eof:true}]}));
 await f.trace.start();const [a,b]=await Promise.all([f.trace.stop('failed-motion'),f.trace.stop('cleanup')]);assert.equal(a,b);assert.equal(a.mouseMotionTrace.reason,'failed-motion');assert.equal(a.mouseMotionTrace.bytes,Buffer.byteLength(source));assert.equal(f.debug.count('Tracing.end'),1);assert.equal(f.debug.count('IO.read'),2);assert.equal(f.debug.count('IO.close'),1);assert.equal(f.saved.length,1);
});
test('cancelling before start never starts tracing, and cancelling pending start still ends it',async()=>{
 const early=fixture();await early.trace.stop('cancelled');await early.trace.start();assert.equal(early.debug.calls.length,0);assert.equal(early.debug.listenerCount('message'),0);
 let ready;const late=fixture(new Debugger({command:method=>method==='Tracing.start'?new Promise(resolve=>{ready=resolve;}):undefined}));const started=late.trace.start(),stopped=late.trace.stop('cancelled');await Promise.resolve();ready({});await started;const document=await stopped;assert.equal(document.mouseMotionTrace.complete,true);assert.equal(late.debug.count('Tracing.start'),1);assert.equal(late.debug.count('Tracing.end'),1);assert.equal(late.debug.count('IO.close'),1);assert.equal(late.trace.active,false);assert.equal(late.debug.listenerCount('message'),0);
});
test('recording deadline stops and drains without waiting for fixture cleanup',async()=>{
 let resolveWrite;const written=new Promise(resolve=>{resolveWrite=resolve;}),f=fixture(new Debugger(),{limits:{recordMs:10,commandMs:100,readMs:300,writeMs:100},write:async()=>resolveWrite()});await f.trace.start();await written;const document=await f.trace.stop();assert.equal(document.mouseMotionTrace.reason,'record-duration-limit');assert.equal(document.mouseMotionTrace.complete,true);assert.equal(f.debug.count('Tracing.end'),1);assert.equal(f.debug.count('IO.close'),1);assert.equal(f.trace.active,false);
});
test('a timed out start is followed by end and stream close, never a diagnostic exception',async()=>{
 const f=fixture(new Debugger({command:method=>method==='Tracing.start'?new Promise(()=>{}):undefined}),{limits:{recordMs:1000,commandMs:10,readMs:100,writeMs:100}});await f.trace.start();const document=await f.trace.stop('cleanup');assert.ok(document.mouseMotionTrace.errors.some(error=>error.stage==='start'&&/timed out/.test(error.message)));assert.equal(f.debug.count('Tracing.end'),1);assert.equal(f.debug.count('IO.close'),1);assert.equal(f.debug.listenerCount('message'),0);
});
test('byte, read-count, event and malformed-JSON limits close every returned stream',async()=>{
 for(const [name,debug,limits,match]of [
  ['bytes',new Debugger(),{maxBytes:8},/byte limit/],
  ['reads',new Debugger({chunks:[{data:'{',eof:false},{data:'',eof:false}]}),{maxReads:1},/read-count limit/],
  ['events',new Debugger({events:[sample,sample]}),{maxEvents:1},/event limit/],
  ['json',new Debugger({chunks:[{data:'private invalid json',eof:true}]}),{},/not valid JSON/]
 ]){const f=fixture(debug,{limits:{recordMs:1000,commandMs:100,readMs:300,writeMs:100,...limits}});await f.trace.start();const document=await f.trace.stop();assert.equal(document.mouseMotionTrace.complete,false,name);assert.ok(document.mouseMotionTrace.errors.some(error=>match.test(error.message)),name);assert.equal(debug.count('IO.close'),1,name);assert.equal(debug.listenerCount('message'),0,name);assert.doesNotMatch(f.saved[0].data,/private invalid json/);}
});
test('read and tracing-completion deadlines are bounded and preserve diagnostic errors',async()=>{
 const read=fixture(new Debugger({command:method=>method==='IO.read'?new Promise(()=>{}):undefined}),{limits:{recordMs:1000,commandMs:30,readMs:10,writeMs:100}});await read.trace.start();const readResult=await read.trace.stop();assert.ok(readResult.mouseMotionTrace.errors.some(error=>/IO.read timed out/.test(error.message)));assert.equal(read.debug.count('IO.close'),1);assert.equal(read.debug.listenerCount('message'),0);
 const completion=fixture(new Debugger({command:method=>method==='Tracing.end'?{}:undefined}),{limits:{recordMs:1000,commandMs:10,readMs:100,writeMs:100}});await completion.trace.start();const result=await completion.trace.stop();assert.ok(result.mouseMotionTrace.errors.some(error=>/Tracing.tracingComplete timed out/.test(error.message)));assert.equal(completion.debug.count('Tracing.end'),1);assert.equal(completion.debug.listenerCount('message'),0);
});
test('unexpected format closes its handle, and detach cannot prevent a diagnostic artifact',async()=>{
 const format=fixture(new Debugger({complete:{traceFormat:'proto'}}));await format.trace.start();const bad=await format.trace.stop();assert.equal(bad.mouseMotionTrace.complete,false);assert.equal(format.debug.count('IO.read'),0);assert.equal(format.debug.count('IO.close'),1);
 const detached=fixture();await detached.trace.start();detached.debug.emit('detach',{},'target closed');const document=await detached.trace.stop();assert.ok(document.mouseMotionTrace.errors.some(error=>/detached/.test(error.message)));assert.equal(detached.saved.length,1);assert.equal(detached.debug.listenerCount('detach'),0);
});
test('disk timeout aborts write and returns the error instead of replacing the original verification failure',async()=>{
 let signal;const f=fixture(new Debugger(),{limits:{recordMs:1000,commandMs:100,readMs:300,writeMs:10},write:async(_file,_data,value)=>{signal=value;return new Promise(()=>{});}});await f.trace.start();const original=Error('original painted-frame failure');let observed;try{try{throw original;}finally{await f.trace.stop('verification-error');}}catch(error){observed=error;}assert.equal(observed,original);assert.equal(signal.aborted,true);const document=await f.trace.stop();assert.ok(document.mouseMotionTrace.errors.some(error=>error.stage==='write'&&/timed out/.test(error.message)));assert.equal(f.debug.count('IO.close'),1);
});
test('default writer atomically saves a valid JSON artifact and removes the partial file',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-smoke-trace-')),file=path.join(directory,'mouse-627-motion-trace.json');try{const trace=createMotionTrace(new Debugger(),{file});await trace.start();const document=await trace.stop();assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),document);assert.deepEqual(await fs.readdir(directory),['mouse-627-motion-trace.json']);}finally{await fs.rm(directory,{recursive:true,force:true});}
});
