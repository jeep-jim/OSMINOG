'use strict';

// This factory has no outer dependencies: beforePack embeds it in the isolated
// sandbox preload. Page values are presentation hints, never browser authority.
function createPageActivityTools(){
 const INTERVAL=250,CANDIDATES=32,SCAN_NODES=1024,ROOTS=8,ANCESTORS=32;
 const attributes=['value','max','min','role','aria-valuenow','aria-valuemin','aria-valuemax','aria-valuetext','aria-label','aria-busy','aria-hidden','hidden','class','style','open'];
 const text=value=>String(value??'').slice(0,240).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
 function finite(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim()))return null;
  const number=Number(value);return Number.isFinite(number)?number:null;
 }
 function percentage(value,min,max){
  if(value===null||min===null||max===null||max<=min)return null;
  // Divide before multiplying so finite large ranges cannot overflow to Infinity.
  const range=max-min,position=value-min;
  if(!Number.isFinite(range)||!Number.isFinite(position))return null;
  return Math.round(Math.max(0,Math.min(100,position/range*100))*10)/10;
 }
 function describe(value){
  if(!value?.visible)return null;
  const tag=String(value.tag||'').toLowerCase(),role=String(value.role||'').trim().toLowerCase();
  if(['slider','scrollbar','spinbutton'].includes(role)||tag==='meter'||(tag==='input'&&String(value.inputType||'').toLowerCase()==='range'))return null;
  const progress=tag==='progress'||role==='progressbar';
  if(!progress&&value.busy!=='true')return null;
  let percent=null;
  if(tag==='progress'){
   const suppliedMax=finite(value.max),max=suppliedMax!==null&&suppliedMax>0?suppliedMax:1;
   percent=percentage(finite(value.value),0,max);
  }else if(role==='progressbar'){
   const min=finite(value.min)??0,max=finite(value.max)??100;
   percent=percentage(finite(value.value),min,max);
  }
  const label=text(value.label),detail=text(value.valueText);
  const statusText=(label&&detail&&label!==detail?label+' · '+detail:detail||label||'Выполняется действие на странице').slice(0,240);
  return{active:true,percent,statusText,kind:'dom',progress};
 }
 function choose(values){
  let busy=null;
  for(const value of values){const activity=describe(value);if(!activity)continue;if(activity.progress){const {progress,...result}=activity;return result;}if(!busy)busy=activity;}
  if(busy){const {progress,...result}=busy;return result;}
  return{active:false,percent:null,statusText:'',kind:'dom'};
 }
 function observe({document,window,send,now=()=>window.performance.now(),setTimer=(fn,ms)=>window.setTimeout(fn,ms),clearTimer=id=>window.clearTimeout(id)}){
  let disposed=false,timer=null,timerAt=Infinity,lastRun=-Infinity,lastSent='',fullScan=null,rescan=false;
  const candidates=new Set(),visibility=new WeakMap(),priority=[],listeners=[];
  const relevant=element=>element?.nodeType===1&&(element.localName==='progress'||element.getAttribute('role')==='progressbar'||element.getAttribute('aria-busy')==='true');
  const remember=element=>{if(!relevant(element)||candidates.has(element))return;if(candidates.size>=CANDIDATES){const hidden=[...candidates].find(candidate=>visibility.get(candidate)===false);if(!hidden)return;candidates.delete(hidden);}candidates.add(element);};
  const makeScan=root=>root?.nodeType===1?{root,walker:document.createTreeWalker(root,1),first:true}:null;
  function requestScan(root){
   if(!root||root.nodeType!==1)return;
   remember(root);
   if(priority.length<ROOTS)priority.push(makeScan(root));else rescan=true;
  }
  function discover(){
   if(!fullScan)fullScan=makeScan(document.documentElement);
   let visited=0;
   while(visited<SCAN_NODES){
    const scan=priority[0]||fullScan;if(!scan)break;
    if(!scan.root.isConnected){if(priority.length)priority.shift();else fullScan=null;continue;}
    const element=scan.first?(scan.first=false,scan.root):scan.walker.nextNode();
    if(!element){if(priority.length)priority.shift();else{fullScan=null;if(rescan){rescan=false;fullScan=makeScan(document.documentElement);}else break;}continue;}
    visited++;remember(element);
   }
  }
  function visible(element,styles,rects){
   if(!element.isConnected)return false;
   const style=node=>{if(!styles.has(node))styles.set(node,window.getComputedStyle(node));return styles.get(node);};
   const rect=node=>{if(!rects.has(node))rects.set(node,node.getBoundingClientRect());return rects.get(node);};
   const box=rect(element);let left=Math.max(0,box.left),top=Math.max(0,box.top),right=Math.min(window.innerWidth,box.right),bottom=Math.min(window.innerHeight,box.bottom),depth=0;
   if(!(box.width>0&&box.height>0&&right>left&&bottom>top))return false;
   for(let node=element;node;node=node.parentElement){
    if(++depth>ANCESTORS||node.hidden||node.getAttribute('aria-hidden')==='true')return false;
    const s=style(node);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||s.contentVisibility==='hidden'||Number(s.opacity)===0)return false;
    if(node!==element){const r=rect(node);if(['hidden','clip','auto','scroll'].includes(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right);}if(['hidden','clip','auto','scroll'].includes(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}if(right<=left||bottom<=top)return false;}
   }
   return true;
  }
  function snapshots(){
   const result=[],styles=new Map(),rects=new Map();
   for(const element of candidates){
    if(!element.isConnected||!relevant(element)){candidates.delete(element);continue;}
    const shown=visible(element,styles,rects);visibility.set(element,shown);if(!shown)continue;
    const native=element.localName==='progress';
    result.push({visible:true,tag:element.localName,role:element.getAttribute('role'),inputType:element.getAttribute('type'),busy:element.getAttribute('aria-busy'),value:element.getAttribute(native?'value':'aria-valuenow'),min:element.getAttribute(native?'min':'aria-valuemin'),max:element.getAttribute(native?'max':'aria-valuemax'),label:element.getAttribute('aria-label'),valueText:element.getAttribute('aria-valuetext')});
   }
   return result;
  }
  function schedule(delay=INTERVAL){
   if(disposed)return;const at=Math.max(now()+delay,lastRun+INTERVAL);
   if(timer!==null&&timerAt<=at)return;if(timer!==null)clearTimer(timer);
   timerAt=at;timer=setTimer(flush,Math.max(0,at-now()));
  }
  function flush(){
   timer=null;timerAt=Infinity;if(disposed)return;lastRun=now();
   discover();const activity=choose(snapshots()),serialized=JSON.stringify(activity);
   if(serialized!==lastSent){const initialInactive=!lastSent&&!activity.active;lastSent=serialized;if(!initialInactive)try{send(activity);}catch{}}
   // Discovery is chunked, and live indicators are rechecked for CSS-only
   // visibility changes. Neither path sends unchanged messages or scans text.
   if(priority.length||fullScan)schedule(INTERVAL);else if(candidates.size)schedule(1000);
  }
  const observer=new window.MutationObserver(records=>{
   for(let i=0;i<Math.min(records.length,64);i++){
    const record=records[i];remember(record.target);
    if(record.type==='childList')for(let j=0;j<Math.min(record.addedNodes.length,ROOTS);j++)requestScan(record.addedNodes[j]);
   }
   if(records.length>64)rescan=true;
   schedule();
  });
  observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:attributes});
  const changed=()=>{rescan=true;schedule();};
  for(const [target,name]of [[document,'scroll'],[window,'resize']]){target.addEventListener(name,changed,{capture:true,passive:true});listeners.push([target,name,changed]);}
  schedule(0);
  return{refresh(){if(disposed)return;lastSent='';rescan=true;schedule(0);},dispose(){if(disposed)return;disposed=true;if(timer!==null)clearTimer(timer);timer=null;observer.disconnect();for(const[target,name,listener]of listeners)target.removeEventListener(name,listener,true);candidates.clear();priority.length=0;fullScan=null;}};
 }
 return{describe,choose,observe};
}

function bundlePagePreload(source){
 const wheel=require('./mouse/desktop-wheel.js').createMouseDesktopWheelTools;
 return "'use strict';\nconst MousePageActivity=("+createPageActivityTools.toString()+")();\nconst MouseDesktopWheel=("+wheel.toString()+")();\n"+source;
}
module.exports={createPageActivityTools,bundlePagePreload};
