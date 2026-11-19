'use strict';

// This factory has no outer dependencies: beforePack embeds it in the isolated
// sandbox preload. Only an explicit site task declaration opts in. Generic
// progress/busy widgets, navigation, streamed text and elapsed time prove none.
function createPageActivityTools(){
 const INTERVAL=250,CANDIDATES=32,TASKS=4,SCAN_NODES=1024,ROOTS=8,RECOVERY_DELAY=1500,MAX_ETA_SECONDS=604800;
 const attributes=['data-mouse-task','data-mouse-task-state','data-mouse-eta-seconds','value','max','min','role','aria-valuenow','aria-valuemin','aria-valuemax','aria-valuetext','aria-label','aria-busy'];
 const text=value=>String(value??'').slice(0,240).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
 const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,64}$/.test(value);
 const validPhase=value=>['running','completed','stopped','cancelled','error'].includes(value);
 function finite(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim()))return null;
  const number=Number(value);return Number.isFinite(number)?number:null;
 }
 function percentage(value,min,max){
  if(value===null||min===null||max===null||max<=min)return null;
  const range=max-min,position=value-min;if(!Number.isFinite(range)||!Number.isFinite(position))return null;
  // Never round an unfinished99.96% declaration up to a completed100% task.
  return Math.floor(Math.max(0,Math.min(100,position/range*100))*10)/10;
 }
 function describe(value){
  if(!value||!validId(value.taskId)||!validPhase(value.phase))return null;
  const tag=String(value.tag||'').toLowerCase(),role=String(value.role||'').trim().toLowerCase();
  if(['slider','scrollbar','spinbutton'].includes(role)||tag==='meter'||(tag==='input'&&String(value.inputType||'').toLowerCase()==='range'))return null;
  let percent=null;
  if(tag==='progress'){
   const suppliedMax=finite(value.max),max=suppliedMax!==null&&suppliedMax>0?suppliedMax:1;percent=percentage(finite(value.value),0,max);
  }else if(role==='progressbar')percent=percentage(finite(value.value),finite(value.min)??0,finite(value.max)??100);
  const label=text(value.label),detail=text(value.valueText),eta=finite(value.etaSeconds),phase=value.phase==='running'&&percent===100?'completed':value.phase;
  const statusText=(label&&detail&&label!==detail?label+' · '+detail:detail||label||'Выполняется задача сайта').slice(0,240);
  return{active:true,taskId:value.taskId,phase,percent:phase==='completed'?100:percent,statusText,etaSeconds:phase==='running'&&eta!==null&&eta>=0&&eta<=MAX_ETA_SECONDS?eta:null,kind:'dom'};
 }
 function choose(values){for(const value of values){const result=describe(value);if(result)return result;}return{active:false,percent:null,statusText:'',kind:'dom'};}
 function observe({document,window,send,now=()=>window.performance.now(),setTimer=(fn,ms)=>window.setTimeout(fn,ms),clearTimer=id=>window.clearTimeout(id)}){
  let disposed=false,timer=null,timerAt=Infinity,lastRun=-Infinity,recoveryTimer=null;
  const candidates=new Set(),priority=[],lastSent=new Map(),newEstimates=new Set();
  const relevant=element=>element?.nodeType===1&&validId(element.getAttribute('data-mouse-task'));
  const makeScan=root=>root?.nodeType===1?{root,walker:document.createTreeWalker(root,1),first:true}:null;
  let initialScan=makeScan(document.documentElement);
  const remember=element=>{
   if(!relevant(element)||candidates.has(element))return;
   if(candidates.size>=CANDIDATES){const inactive=[...candidates].find(candidate=>!candidate.isConnected||candidate.getAttribute('data-mouse-task-state')!=='running');if(!inactive)return;candidates.delete(inactive);}
   candidates.add(element);
  };
  function recoverAfterQuiet(){
   if(recoveryTimer!==null)clearTimer(recoveryTimer);
   // Overflow gets one bounded recovery walk after a quiet period, never a
   // whole-document rescan for every unrelated mutation or animation frame.
   recoveryTimer=setTimer(()=>{recoveryTimer=null;if(disposed)return;initialScan=makeScan(document.documentElement);schedule(0);},RECOVERY_DELAY);
  }
  function requestScan(root){
   if(root?.nodeType!==1)return false;remember(root);
   if(!root.children?.length)return relevant(root);
   if(priority.some(scan=>scan.root===root))return true;
   if(priority.length<ROOTS)priority.push(makeScan(root));else recoverAfterQuiet();return true;
  }
  function discover(){
   let visited=0;
   while(visited<SCAN_NODES){
    const scan=priority[0]||initialScan;if(!scan)break;
    if(!scan.root.isConnected){if(priority.length)priority.shift();else initialScan=null;continue;}
    const element=scan.first?(scan.first=false,scan.root):scan.walker.nextNode();
    if(!element){if(priority.length)priority.shift();else initialScan=null;continue;}
    visited++;remember(element);
   }
  }
  function snapshots(){
   const result=[];
   for(const element of candidates){
    if(!element.isConnected||!relevant(element)){candidates.delete(element);continue;}
    const native=element.localName==='progress';
    const value=describe({taskId:element.getAttribute('data-mouse-task'),phase:element.getAttribute('data-mouse-task-state'),etaSeconds:element.getAttribute('data-mouse-eta-seconds'),tag:element.localName,role:element.getAttribute('role'),inputType:element.getAttribute('type'),value:element.getAttribute(native?'value':'aria-valuenow'),min:element.getAttribute(native?'min':'aria-valuemin'),max:element.getAttribute(native?'max':'aria-valuemax'),label:element.getAttribute('aria-label'),valueText:element.getAttribute('aria-valuetext')});
    if(value)result.push(value);
   }
   // Duplicate IDs are ambiguous and must not switch between unrelated widgets.
   const duplicates=new Set(),seen=new Set();for(const value of result){if(seen.has(value.taskId))duplicates.add(value.taskId);seen.add(value.taskId);}
   return result.filter(value=>!duplicates.has(value.taskId)).sort((a,b)=>Number(a.phase!=='running')-Number(b.phase!=='running')).slice(0,TASKS);
  }
  function schedule(delay=INTERVAL){
   if(disposed)return;const at=Math.max(now()+delay,lastRun+INTERVAL);
   if(timer!==null&&timerAt<=at)return;if(timer!==null)clearTimer(timer);timerAt=at;timer=setTimer(flush,Math.max(0,at-now()));
  }
  const emit=packet=>{try{send(packet);}catch{}};
  function flush(){
   timer=null;timerAt=Infinity;if(disposed)return;lastRun=now();discover();const current=new Map(snapshots().map(value=>[value.taskId,value]));
   for(const taskId of lastSent.keys())if(!current.has(taskId)){emit({kind:'dom',active:false,taskId,percent:null,statusText:'',etaSeconds:null,phase:'running'});lastSent.delete(taskId);}
   for(const[taskId,value]of current){const serialized=JSON.stringify(value);if(lastSent.get(taskId)!==serialized||value.etaSeconds!==null&&newEstimates.has(taskId)){lastSent.set(taskId,serialized);emit(value);}}newEstimates.clear();
   // No periodic visibility polling, page geometry reads, response-text reads,
   // or timers remain once discovery settles. Offscreen tasks keep ownership.
   if(priority.length||initialScan)schedule(INTERVAL);
  }
  const observer=new window.MutationObserver(records=>{
   let changed=false;
   for(let i=0;i<Math.min(records.length,64);i++){
    const record=records[i];
    if(record.type==='attributes'&&(relevant(record.target)||candidates.has(record.target))){remember(record.target);if(record.attributeName==='data-mouse-eta-seconds'&&candidates.has(record.target)&&newEstimates.size<CANDIDATES)newEstimates.add(record.target.getAttribute('data-mouse-task'));changed=true;}
    if(record.type==='childList'){
     for(let j=0;j<Math.min(record.addedNodes.length,ROOTS);j++)changed=requestScan(record.addedNodes[j])||changed;
     if(record.addedNodes.length>ROOTS)recoverAfterQuiet();
     if(!changed)for(const candidate of candidates)if(!candidate.isConnected){changed=true;break;}
    }
   }
   if(records.length>64)recoverAfterQuiet();
   if(changed)schedule();
  });
  observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:attributes});schedule(0);
  return{refresh(){if(disposed)return;lastSent.clear();initialScan=makeScan(document.documentElement);schedule(0);},dispose(){if(disposed)return;disposed=true;if(timer!==null)clearTimer(timer);if(recoveryTimer!==null)clearTimer(recoveryTimer);timer=null;recoveryTimer=null;observer.disconnect();candidates.clear();priority.length=0;lastSent.clear();newEstimates.clear();initialScan=null;}};
 }
 return{describe,choose,observe};
}

function bundlePagePreload(source){
 const wheel=require('./mouse/desktop-wheel.js').createMouseDesktopWheelTools;
 return "'use strict';\nconst MousePageActivity=("+createPageActivityTools.toString()+")();\nconst MouseDesktopWheel=("+wheel.toString()+")();\n"+source;
}
module.exports={createPageActivityTools,bundlePagePreload};
