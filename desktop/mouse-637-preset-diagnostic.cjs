'use strict';
// Diagnostic branch only. Never a release gate, retry, or source of UI state.
const fs=require('node:fs/promises'),path=require('node:path');
const ENV='MOUSE_637_PRESET_DIAGNOSTIC',FIELD='__mouse637PresetSnapshot',FILE='mouse-637-preset-diagnostic.json';

// This self-contained function is also installed in the existing shell. The
// clocks are deliberately local to each process; snapshot sequence is causal.
function createCollector({domain,now=()=>performance.now(),maxEvents=512,maxBytes=1048576,maxRecordBytes=32768}={}){
 const first=[],tail=[],errors=[],truncated={strings:0,arrays:0,objects:0,depth:0,nodes:0,records:0},prefixLimit=Math.min(32,maxEvents-1);
 let bytes=0,sequence=0,dropped=0,droppedErrors=0,prefixClosed=false,evictedBytes=0,eventLimitEvictions=0,byteLimitEvictions=0;
 function clean(value,depth=0,seen=new Set(),budget={left:2048}){
  if(--budget.left<0){truncated.nodes++;return null;}
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='string'){if(value.length<=256)return value;truncated.strings++;return value.slice(0,127)+'…'+value.slice(-128);}
  if(value===undefined)return null;
  if(typeof value!=='object')return String(typeof value);
  if(depth>12||seen.has(value)){truncated.depth++;return null;}
  seen.add(value);let result;
  if(Array.isArray(value)){if(value.length>64)truncated.arrays+=value.length-64;result=value.slice(0,64).map(v=>clean(v,depth+1,seen,budget));}
  else{result={};let count=0;for(const key in value){if(!Object.hasOwn(value,key))continue;if(count++===64){truncated.objects++;break;}result[key]=clean(value[key],depth+1,seen,budget);}}
  seen.delete(value);return result;
 }
 function error(where,cause){if(errors.length<16)errors.push({where:String(where).slice(0,64),message:String(cause?.message||cause).slice(0,512)});else droppedErrors++;}
 function record(kind,value){
  const id=++sequence;
  try{
   let item={sequence:id,at:now(),kind:String(kind).slice(0,80),data:clean(value)},size=JSON.stringify(item).length*3;
   // Three bytes per serialized UTF-16 unit bounds UTF-8, including escapes.
   if(size>maxRecordBytes){truncated.records++;item={sequence:id,at:item.at,kind:item.kind,omitted:true,serializedUpperBoundBytes:size};size=JSON.stringify(item).length*3;}
   // Reserve one maximum-sized record while keeping the initial prefix.
   // After that, evict the oldest tail records, retaining adjacent recent
   // build/send and receive/reconcile events within both original caps.
   if(!prefixClosed&&first.length<prefixLimit&&bytes+size<=maxBytes-maxRecordBytes){first.push({item,size});bytes+=size;}
   else{
    prefixClosed=true;
    while(tail.length&&(first.length+tail.length>=maxEvents||bytes+size>maxBytes)){
     if(first.length+tail.length>=maxEvents)eventLimitEvictions++;
     if(bytes+size>maxBytes)byteLimitEvictions++;
     const removed=tail.shift();bytes-=removed.size;evictedBytes+=removed.size;dropped++;
    }
    tail.push({item,size});bytes+=size;
   }
  }catch(cause){error('record:'+kind,cause);}
  return id;
 }
 return{record,error,copy:clean,snapshot(){return{domain,clock:'performance.now milliseconds; no cross-process origin comparison',limits:{maxEvents,maxBytes,maxRecordBytes,strings:256,array:64,object:64,depth:12},sequence,events:[...first,...tail].map(entry=>entry.item),firstAndLatest:true,retention:{strategy:'first-prefix-and-rolling-tail',prefixLimit,prefixRetained:first.length,tailRetained:tail.length,retainedUpperBoundBytes:bytes,evictedUpperBoundBytes:evictedBytes,eventLimitEvictions,byteLimitEvictions},recordLimitReached:dropped>0,dropped,truncated:{...truncated},errors:errors.slice(),droppedErrors};}};
}

function guard(app,env=process.env){
 if(env[ENV]!=='1')return false;
 if(env.CI!=='true'||!app?.isPackaged||!path.isAbsolute(env.MOUSE_TEST_PROFILE||'')||path.resolve(app.getPath('userData'))!==path.resolve(env.MOUSE_TEST_PROFILE))throw Error('Preset diagnostics require packaged CI and its isolated absolute profile');
 return true;
}
function selectedPreferences(value){if(!value)return null;const out={};for(const key of ['desktopId','mode','tree','slots','tabOrder','aiOpen','aiId','agentOpen','agentPreviewId','presetTabs'])if(value[key]!==undefined)out[key]=value[key];return out;}
function selectedState(state){const active=state?.desktops?.items?.slice(0,64).find(item=>item.active);return{desktopId:state?.desktopId,tabCount:state?.tabs?.length??0,tabs:state?.tabs?.slice(0,64).map(({id,lane,internal,previewOf})=>({id,lane,internal,previewOf})),tabsOmitted:Math.max(0,(state?.tabs?.length||0)-64),active:active?{id:active.id,mode:active.mode,tree:active.tree,slots:active.slots,aiOpen:active.aiOpen,aiId:active.aiId}:null};}

async function beginDiagnostic({app,win,browser,js,env=process.env,write=fs.writeFile,cwd=process.cwd()}){
 if(!guard(app,env))return null;
 if(typeof js!=='function')throw Error('Preset diagnostics require the existing bounded shell adapter');
 const main=createCollector({domain:'main'}),report={schema:1,diagnosticOnly:true,releaseAcceptance:false,sourceBase:'2b73ad7b7924bf8e87fa0932eea672fe2bb89f52',version:app.getVersion(),pid:process.pid,profile:env.MOUSE_TEST_PROFILE,snapshotField:FIELD,errors:[]};
 const previous=browser.mousePresetDiagnostic,originalSend=win.webContents.send,snapshots=new WeakMap();let stateSequence=0,finished=false;
 const issue=(where,cause)=>{main.error(where,cause);if(report.errors.length<16)report.errors.push({where,message:String(cause?.message||cause).slice(0,512)});};
 const api={
  error:issue,
  note(kind,value){try{const data={...value};for(const key of ['preferences','layout'])if(data[key])data[key]=selectedPreferences(data[key]);if(data.state){data.stateSequence=snapshots.get(data.state)??null;data.state=selectedState(data.state);}return main.record(kind,data);}catch(cause){issue('note:'+kind,cause);return null;}},
  state(value){try{const sequence=++stateSequence;snapshots.set(value,sequence);main.record('native-state-built',{sequence,...selectedState(value)});}catch(cause){issue('state',cause);}return value;},
  failedSelection(value){try{report.failedSelection=main.copy(value);main.record('populated-assertion-input',{mode:value.mode,pane:value.pane,id:value.id,hasSlot:value.hasSlot,preferences:selectedPreferences(value.state),pageIds:value.all?.slice(0,64).map(page=>page.id),pageCount:value.all?.length});}catch(cause){issue('selection',cause);}},
  async failure(cause,capture){
   report.originalError={name:cause?.name,message:cause?.message,stack:cause?.stack};
   // The original assertion has already failed. These reads/captures cannot
   // turn it into a PASS and happen before any preset cleanup is attempted.
   try{const pages=[];for(const page of browser.tabs.values()){if(pages.length===64)break;const wc=page.view?.webContents;let url=null,destroyed=null;try{destroyed=wc?.isDestroyed?.()??false;if(!destroyed)url=wc?.getURL?.()??null;}catch(error){url=String(error.message);}pages.push({id:page.id,lane:page.lane,internal:!!page.internal,webContentsId:wc?.id,destroyed,url,visible:page.visible,bounds:page.bounds});}report.nativeAtFailure=main.copy({active:browser.mouseDesktops.bank.active,preferences:browser.mouseDesktops.bank.preferences(),members:browser.mouseDesktops.bank.members,pages,pageCount:browser.tabs.size,pagesOmitted:Math.max(0,browser.tabs.size-pages.length)});}catch(error){issue('native-failure-snapshot',error);}
   try{report.rendererAtFailure=main.copy(await js(`(()=>{const m=MouseTest.model,panes=document.querySelectorAll('.pane');return{preferences:MouseTest.prefs(),desktopId:m.desktopId,switching:m.switching,ready:m.ready,tabCount:m.state.tabs.length,tabs:m.state.tabs.slice(0,64).map(({id,lane,internal,previewOf})=>({id,lane,internal,previewOf})),paneCount:panes.length,panes:Array.prototype.slice.call(panes,0,64).map(p=>({pane:p.dataset.pane,slot:m.slots[p.dataset.pane]}))};})()`));}catch(error){issue('renderer-failure-snapshot',error);}
   try{report.failureCapture=await capture();}catch(error){issue('pre-cleanup-capture',error);}
  },
  async finish(failure){
   if(finished)return report;finished=true;report.presetCompleted=!failure;report.originalFailureRetained=!!failure;
   try{report.renderer=await js('(()=>{const value=globalThis.MousePresetDiagnostic?.snapshot();delete globalThis.MousePresetDiagnostic;return value})()');}catch(error){issue('renderer-trace',error);}
   if(browser.mousePresetDiagnostic===api){if(previous===undefined)delete browser.mousePresetDiagnostic;else browser.mousePresetDiagnostic=previous;}
   if(win.webContents.send===send)win.webContents.send=originalSend;
   report.main=main.snapshot();
   try{const data=JSON.stringify(report)+'\n';if(Buffer.byteLength(data)>8*1024*1024)throw Error('Preset diagnostic receipt exceeds its fixed byte cap');await write(path.join(cwd,FILE),data);}catch(error){issue('diagnostic-write',error);console.error('MOUSE_637_PRESET_DIAGNOSTIC_WRITE_FAILED',error.message);}
   return report;
  }
 };
 function send(...args){if(args[0]==='browser:state'&&args.length===2){const sequence=snapshots.get(args[1])??null;main.record('native-state-sent',{sequence});return originalSend.call(this,...args,{[FIELD]:{sequence}});}return originalSend.apply(this,args);}
 try{await js(`globalThis.MousePresetDiagnostic=(${createCollector.toString()})({domain:'renderer'});true`);browser.mousePresetDiagnostic=api;win.webContents.send=send;main.record('diagnostic-start',{diagnosticOnly:true});}
 catch(error){issue('diagnostic-start',error);await api.finish(error);throw error;}
 return api;
}
module.exports={ENV,FIELD,FILE,guard,createCollector,selectedState,selectedPreferences,beginDiagnostic};
