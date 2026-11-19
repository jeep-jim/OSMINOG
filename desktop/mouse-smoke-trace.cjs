'use strict';
// CI-only diagnostics over the debugger already owned by the installed smoke
// fixture. No screenshots, sampling, runtime switch or animation changes.
// Protocol: https://chromedevtools.github.io/devtools-protocol/tot/Tracing/
//           https://chromedevtools.github.io/devtools-protocol/tot/IO/
// Transport: https://www.electronjs.org/docs/latest/api/debugger
const fs=require('node:fs/promises');
const TRACE_CATEGORIES=Object.freeze(['toplevel','devtools.timeline','disabled-by-default-devtools.timeline.frame','blink.animations','blink.user_timing','cc','viz','renderer.scheduler','input','gpu','gpu.capture','__metadata']);
// Run121 lost early motion anchors in the 8MiB Chromium ring. Reserve 16MiB
// for the same causal categories; stream, event, output and recording caps stay fixed.
// Tracing.end acknowledges a command before the asynchronous buffer flush completes.
// Give its completion event a separate bounded transport budget, not a frame deadline.
const DEFAULT_LIMITS=Object.freeze({recordMs:60000,commandMs:3000,completionMs:12000,readMs:12000,writeMs:3000,bufferKb:16384,chunkBytes:65536,maxBytes:64*1024*1024,maxOutputBytes:72*1024*1024,maxEvents:200000,maxReads:1024,maxSnapshots:64});
const MARKER_PREFIX='mouse627.motion.';
const safeToken=value=>typeof value==='string'&&value.length<=240&&/^[\w .:$<>()[\],+*\/-]+$/.test(value)&&!/:\/\/|\b(?:data|file):/i.test(value);
const argumentText=new Set(['type','event_type','task_type','queue_type','priority','state','step','phase','reason','source_func','src_func','functionName','nodeName','unsupportedProperties','property','compositeFailed']);
const privateKey=/url|uri|cookie|header|request|response|body|payload|script|stack|html|text|snapshot|screenshot|image|frameName/i;
// Pinned Chromium152: cc/animation/keyframe_model.cc emits
// TypeName-TargetProperty-group and an enum transition. Keep only their bounded
// structural values; Name/State themselves may never bypass text redaction.
// Target properties: cc/trees/target_property.h. Run states and curve names:
// ui/gfx/animation/keyframe/{keyframe_model,animation_curve}.cc, plus the two cc
// Filter/ScrollOffset curve classes. A compositor group is a batch, not a DOM ID.
const ccRunStates=new Set(['WAITING_FOR_TARGET_AVAILABILITY','WAITING_FOR_DELETION','STARTING','RUNNING','PAUSED','PAUSED_EXCLUSIVE','FINISHED','ABORTED','ABORTED_BUT_NEEDS_COMPLETION']);
function compositorArguments(event){
 if(!event.cat?.split(',').includes('cc'))return;
 const transition=event.name==='ElementAnimations::SetRunState'&&event.ph==='I';
 if(!transition&&!(event.name==='KeyframeModel'&&event.ph==='b'))return;
 const name=event.args?.Name;
 if(typeof name!=='string'||name.length>64)return;
 const match=/^(?:Transform|Float|Size|Color|Rect|Filter|ScrollOffset)-(0|[1-9]|1[01])-([1-9][0-9]{0,9})$/.exec(name);
 if(!match)return;
 const targetProperty=Number(match[1]),group=Number(match[2]);
 if(!Number.isSafeInteger(group)||group>2147483647)return;
 const model={targetProperty,group};
 if(transition){
  const state=event.args?.State;
  if(typeof state!=='string'||state.length>80)return;
  const parts=state.split('->');
  if(parts.length!==2||!parts.every(value=>ccRunStates.has(value)))return;
  model.from=parts[0];model.to=parts[1];
 }
 return model;
}
function numericArguments(value,key='',depth=0){
 if(depth>8||privateKey.test(key))return undefined;
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string')return argumentText.has(key)&&safeToken(value)?value:undefined;
 if(Array.isArray(value))return value.slice(0,128).map(item=>numericArguments(item,key,depth+1)).filter(item=>item!==undefined);
 if(!value||typeof value!=='object')return undefined;
 return Object.fromEntries(Object.entries(value).slice(0,128).filter(([name])=>safeToken(name)).flatMap(([name,item])=>{const result=numericArguments(item,name,depth+1);return result===undefined?[]:[[name,result]];}));
}
function sanitizeEvents(events,maxEvents){
 const clean=[];let dropped=0,limited=0;
 for(const event of events){
  if(!event||typeof event!=='object'||!safeToken(event.name)||!safeToken(event.cat||'' )||/screenshot|snapshot|netlog|network|Resource(?:Send|Receive|Finish)|WebSocket|XHR|Fetch/i.test((event.cat||'')+' '+event.name)){dropped++;continue;}
  if(event.cat?.split(',').includes('blink.user_timing')&&!event.name.startsWith(MARKER_PREFIX)){dropped++;continue;}
  // Process labels may contain a page title; retain only structural names/order.
  if(event.ph==='M'&&!['process_name','thread_name','process_sort_index','thread_sort_index'].includes(event.name)){dropped++;continue;}
  if(clean.length>=maxEvents){limited++;continue;}
  const out={};
  for(const key of ['pid','tid','ts','dur','tts','tdur','use_async_tts','bind_id','flow_in','flow_out'])if(typeof event[key]==='boolean'||typeof event[key]==='number'&&Number.isFinite(event[key]))out[key]=event[key];
  for(const key of ['name','cat','ph','s','scope','id','bind_id','bp'])if(safeToken(event[key])||typeof event[key]==='number'&&Number.isFinite(event[key]))out[key]=event[key];
  if(event.id2&&typeof event.id2==='object')out.id2=Object.fromEntries(['local','global'].flatMap(key=>safeToken(event.id2[key])||typeof event.id2[key]==='number'&&Number.isFinite(event.id2[key])?[[key,event.id2[key]]]:[]));
  out.args=numericArguments(event.args)||{};
  // Reserved derived field: never trust a similarly named raw argument.
  if(typeof out.args==='object')delete out.args.ccModel;
  const ccModel=compositorArguments(event);if(ccModel)out.args.ccModel=ccModel;
  if(event.ph==='M'&&['process_name','thread_name'].includes(event.name)&&safeToken(event.args?.name))out.args.name=event.args.name;
  clean.push(out);
 }
 return{events:clean,dropped,limited};
}
function bounded(operation,ms,label,onTimeout){
 let timer;
 return Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout?.();reject(Error(label+' timed out after '+ms+'ms'));},ms);})]).finally(()=>clearTimeout(timer));
}
async function writeTrace(file,text,signal){
 const partial=file+'.partial';
 try{await fs.writeFile(partial,text,{signal});signal.throwIfAborted();await fs.rename(partial,file);}
 finally{await fs.rm(partial,{force:true}).catch(()=>{});}
}
function createMotionTrace(debug,{file='mouse-627-motion-trace.json',snapshot=async()=>null,versions={},limits:overrides={},write=writeTrace}={}){
 const limits={...DEFAULT_LIMITS,...overrides};for(const [key,value]of Object.entries(limits))if(!Number.isSafeInteger(value)||value<=0)throw Error('Invalid motion trace limit: '+key);
 const config={transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',bufferUsageReportingInterval:500,traceConfig:{recordMode:'recordContinuously',traceBufferSizeInKb:limits.bufferKb,enableSampling:false,enableSystrace:false,enableArgumentFilter:true,includedCategories:[...TRACE_CATEGORIES],excludedCategories:['*']}};
 const meta={schemaVersion:1,source:'Chromium CDP Tracing',versions,config,limits,startedAt:null,stoppedAt:null,endRequestedAt:null,completionReceivedAt:null,completionLatencyMs:null,reason:null,complete:false,dataLossOccurred:null,bytes:0,eventCount:0,droppedEvents:0,limitedEvents:0,bufferUsage:[],snapshots:[],errors:[],clockNote:'Renderer performance.mark names are trace anchors. Main and renderer time origins alone do not establish a shared clock.',retention:'Bounded rolling buffer retains the final motion/failure; earlier events may be overwritten.'};
 const document={traceEvents:[],displayTimeUnit:'ms',mouseMotionTrace:meta};
 let startPromise,stopPromise,timer,attempted=false,started=false,stopping=false,completion=null,resolveComplete,detached=false,endRequestedTime=null;
 const complete=new Promise(resolve=>{resolveComplete=resolve;});
 const error=(stage,value)=>{meta.errors.push({stage,message:String(value?.message||value).replace(/\b(?:https?|file|data):\S+/gi,'[redacted]').slice(0,1000)});};
 const command=(method,params={},timeout=limits.commandMs)=>bounded(()=>debug.sendCommand(method,params),timeout,method);
 const onMessage=(_event,method,params)=>{
  if(method==='Tracing.tracingComplete'&&!completion){meta.completionReceivedAt=Date.now();meta.completionLatencyMs=endRequestedTime===null?null:Math.max(0,performance.now()-endRequestedTime);completion=params||{};resolveComplete(completion);}
  if(method==='Tracing.bufferUsage'){if(meta.bufferUsage.length===64)meta.bufferUsage.shift();meta.bufferUsage.push({at:performance.now(),...Object.fromEntries(['percentFull','eventCount','value'].flatMap(key=>Number.isFinite(params?.[key])?[[key,params[key]]]:[]))});}
 };
 const onDetach=()=>{detached=true;resolveComplete({detached:true});};
 function checkpoint(label,value){if(!stopping&&meta.snapshots.length<limits.maxSnapshots)meta.snapshots.push({label,value});}
 async function capture(label){try{const value=await bounded(()=>snapshot(label),limits.commandMs,'Trace '+label+' snapshot');if(meta.snapshots.length<limits.maxSnapshots)meta.snapshots.push({label,value});}catch(value){error(label+' snapshot',value);}}
 function start(){
  if(startPromise)return startPromise;if(stopping)return Promise.resolve(meta);
  startPromise=(async()=>{
   debug.on('message',onMessage);debug.on('detach',onDetach);attempted=true;meta.startedAt=Date.now();
   timer=setTimeout(()=>{void stop('record-duration-limit');},limits.recordMs);
   try{await command('Tracing.start',config);started=true;if(!stopping)await capture('before');}
   catch(value){error('start',value);queueMicrotask(()=>{void stop('start-error');});}
   return meta;
  })();return startPromise;
 }
 async function drain(handle){
  const chunks=[],deadline=performance.now()+limits.readMs;let eof=false;
  {
   for(let reads=0;reads<limits.maxReads;reads++){
    const remaining=deadline-performance.now();if(remaining<=0)throw Error('Trace stream exceeded read deadline');
    const part=await command('IO.read',{handle,size:limits.chunkBytes},Math.min(limits.commandMs,Math.ceil(remaining)));
    if(typeof part?.data!=='string')throw Error('Trace stream returned no data');
    const chunk=Buffer.from(part.data,part.base64Encoded?'base64':'utf8');meta.bytes+=chunk.length;
    if(meta.bytes>limits.maxBytes)throw Error('Trace stream exceeded byte limit');
    chunks.push(chunk);if(part.eof){eof=true;break;}
   }
   if(!eof)throw Error('Trace stream exceeded read-count limit');
   let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Trace stream is not valid JSON');}
   const events=Array.isArray(parsed)?parsed:parsed?.traceEvents;if(!Array.isArray(events))throw Error('Trace JSON has no traceEvents array');
   const sanitized=sanitizeEvents(events,limits.maxEvents);document.traceEvents=sanitized.events;meta.eventCount=sanitized.events.length;meta.droppedEvents=sanitized.dropped;meta.limitedEvents=sanitized.limited;
   if(sanitized.limited)throw Error('Trace exceeded event limit');
   meta.complete=true;
  }
 }
 function stop(reason='motion-complete'){
  if(stopPromise)return stopPromise;stopping=true;clearTimeout(timer);
  stopPromise=(async()=>{
   try{
    if(startPromise)await startPromise;
    meta.reason=reason;await capture('after');
    if(attempted&&!detached){
     if(!completion){meta.endRequestedAt=Date.now();endRequestedTime=performance.now();await command('Tracing.end').catch(value=>error('end',value));}
     const result=completion||await bounded(()=>complete,limits.completionMs,'Tracing.tracingComplete');
     meta.dataLossOccurred=typeof result.dataLossOccurred==='boolean'?result.dataLossOccurred:null;
     try{
      if(result.detached)throw Error('Debugger detached before trace completion');
      if(result.streamCompression&&result.streamCompression!=='none')throw Error('Unexpected trace stream compression');
      if(result.traceFormat&&result.traceFormat!=='json')throw Error('Unexpected trace stream format');
      if(!result.stream)throw Error('Trace completion supplied no stream');
      await drain(result.stream);
     }finally{if(result.stream)await command('IO.close',{handle:result.stream}).catch(value=>error('close',value));}
    }else if(attempted)throw Error('Debugger detached during trace collection');
   }catch(value){error('stop',value);}
   finally{
    clearTimeout(timer);debug.removeListener('message',onMessage);debug.removeListener('detach',onDetach);meta.stoppedAt=Date.now();
    const controller=new AbortController();
    try{const data=JSON.stringify(document)+'\n';if(Buffer.byteLength(data)>limits.maxOutputBytes)throw Error('Trace output exceeded disk byte limit');await bounded(()=>write(file,data,controller.signal),limits.writeMs,'Trace disk write',()=>controller.abort());}
    catch(value){error('write',value);}
   }
   return document;
  })();return stopPromise;
 }
 return{start,stop,checkpoint,get active(){return started&&!stopping;}};
}
module.exports={createMotionTrace,TRACE_CATEGORIES,DEFAULT_LIMITS,MARKER_PREFIX,bounded};
