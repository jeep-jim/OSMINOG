'use strict';
// Isolated diagnostic branch only. No input injection, retries or acceptance.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const NAME='mouse-637-input-diagnostic.json',BASE='5a13d620e66e8b25792b3ba26de907c6b66fc422';
const LIMITS=Object.freeze({attempts:16,domEvents:128,nativeEvents:512,stringUnits:128,ancestry:8,domRecordBytes:4096,domCollectionBytes:262144,receiptBytes:33554432});
const errorFacts=error=>({message:String(error?.message||error),...(error?.stack?{stack:String(error.stack)}:{})});

// Serialized into the existing shell probe and owned fixture page HTML.
function installDOMInputDiagnostic(role){
 if(globalThis.__mouse637InputDiagnostic)return true;
 const limits={events:128,prefix:32,stringUnits:128,ancestry:8,recordBytes:4096,collectionBytes:262144},records=[],listeners=[];
 let total=0,dropped=0,bytes=0,oversize=0,stringTruncated=0,byteEvicted=0,errors=0,disposed=false;
 const encoder=new TextEncoder(),size=value=>encoder.encode(JSON.stringify(value)).length;
 const text=value=>{const s=String(value??'');if(s.length<=limits.stringUnits)return s;stringTruncated++;return s.slice(0,63)+'…'+s.slice(-64);};
 const node=value=>value===window?{tagName:'WINDOW',id:''}:value===document?{tagName:'DOCUMENT',id:''}:value?{tagName:text(value.tagName||value.nodeName||''),id:text(value.id||'')}:null;
 const finite=value=>Number.isFinite(value)?value:null;
 const rect=value=>{if(!value?.getBoundingClientRect)return null;const r=value.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 function state(selector,x,y){
  const target=typeof selector==='string'&&selector?document.querySelector(selector):null,hit=Number.isFinite(x)&&Number.isFinite(y)?document.elementFromPoint(x,y):null;
  return{at:Date.now(),performanceNow:performance.now(),timeOrigin:performance.timeOrigin,documentFocused:document.hasFocus(),activeElement:node(document.activeElement),target:node(target),targetBounds:rect(target),hit:node(hit),hitInsideTarget:!!(target&&hit&&target.contains(hit)),viewport:{width:innerWidth,height:innerHeight,scale:devicePixelRatio,scrollX,scrollY}};
 }
 function push(row){
  let length=size(row);if(length>limits.recordBytes){oversize++;row={seq:row.seq,type:row.type,trusted:row.trusted,at:row.at,performanceNow:row.performanceNow,oversize:true,originalBytes:length,clientX:row.clientX,clientY:row.clientY,button:row.button,buttons:row.buttons};length=size(row);}
  records.push({row,length});bytes+=length;
  while(records.length>limits.events||bytes>limits.collectionBytes){const byBytes=bytes>limits.collectionBytes,at=records.length>limits.prefix+1?limits.prefix:records.length-1;bytes-=records[at].length;records.splice(at,1);dropped++;if(byBytes)byteEvicted++;}
 }
 function observe(event){
  if(disposed)return;const seq=++total;
  try{
   const chain=[];let current=event.target;
   for(let i=0;current&&i<limits.ancestry;i++,current=current.parentElement)chain.push(node(current));
   push({seq,type:text(event.type),trusted:event.isTrusted===true,at:Date.now(),performanceNow:performance.now(),target:node(event.target),path:chain,documentFocused:document.hasFocus(),activeElement:node(document.activeElement),clientX:finite(event.clientX),clientY:finite(event.clientY),screenX:finite(event.screenX),screenY:finite(event.screenY),button:finite(event.button),buttons:finite(event.buttons),pointerId:finite(event.pointerId),pointerType:text(event.pointerType||''),detail:finite(event.detail),altKey:event.altKey===true,ctrlKey:event.ctrlKey===true,metaKey:event.metaKey===true,shiftKey:event.shiftKey===true});
  }catch(error){errors++;push({seq,type:'diagnostic-error',message:text(error?.message||error)});}
 }
 for(const type of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','click','focus','blur']){window.addEventListener(type,observe,{capture:true,passive:true});listeners.push(type);}
 globalThis.__mouse637InputDiagnostic={read(selector='',x=null,y=null){return{role,total,dropped,records:records.map(value=>value.row),state:state(selector,x,y),limits:{...limits},oversize,stringTruncated,byteEvicted,errors};},dispose(){if(disposed)return;disposed=true;for(const type of listeners)window.removeEventListener(type,observe,true);}};
 return true;
}

function beginInputDiagnostic({app,nativeInput,env=process.env,argv=process.argv,platform=process.platform,pid=process.pid,write=fs.writeFile}){
 if(env.MOUSE_637_INPUT_DIAGNOSTIC!=='1')return null;
 assert.equal(env.CI,'true');assert.equal(platform,'darwin');assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),'6.0.37');assert.ok(argv.includes('--mouse-636-retained-smoke'));
 const profile=app.getPath('userData');assert.ok(path.isAbsolute(env.MOUSE_TEST_PROFILE||''));assert.equal(path.resolve(profile),path.resolve(env.MOUSE_TEST_PROFILE));
 for(const name of ['inputDiagnosticStart','inputDiagnosticRead','inputDiagnosticStop'])assert.equal(typeof nativeInput[name],'function','Native input diagnostic export missing: '+name);
 const report={schema:1,diagnosticOnly:true,releaseAcceptance:false,sourceBase:BASE,version:app.getVersion(),platform,arch:process.arch,pid,profile,profileIsolated:true,packaged:true,limits:{...LIMITS},clockDomains:{host:'Date.now milliseconds',dom:'performance.now milliseconds and performance.timeOrigin per document',native:'NSEvent timestamp/systemUptime seconds; CGEvent timestamp nanoseconds since startup as decimal string'},retainedCompleted:false,originalFailureRetained:false,originalError:null,capturedBeforeCleanup:false,attempts:[],attemptsDropped:0,native:null,diagnosticErrors:[]};
 let stopped=false;
 const diagnosticError=(stage,error)=>{if(report.diagnosticErrors.length<16)report.diagnosticErrors.push({stage,message:String(error?.message||error).slice(0,1024)});};
 const nativeRead=method=>{try{return JSON.parse(nativeInput[method]());}catch(error){diagnosticError(method,error);return{diagnosticError:errorFacts(error)};}};
 report.native=nativeRead('inputDiagnosticStart');
 const script=role=>'try{('+installDOMInputDiagnostic.toString()+')('+JSON.stringify(role)+');}catch(error){globalThis.__mouse637InputDiagnostic={read:()=>({diagnosticError:{message:String(error?.message||error)}})};}';
 const domRead=(selector='',x=null,y=null)=>'globalThis.__mouse637InputDiagnostic?.read('+[selector,x,y].map(value=>JSON.stringify(value)).join(',')+')';
 async function observed(stage,operation){let timer;try{const value=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Diagnostic read exceeded2000ms: '+stage)),2000);})]);if(value===undefined)throw Error('Diagnostic collector is missing: '+stage);return value;}catch(error){diagnosticError(stage,error);return{diagnosticError:errorFacts(error)};}finally{clearTimeout(timer);}}
 async function save(){try{const data=JSON.stringify(report)+'\n';assert.ok(Buffer.byteLength(data)<=LIMITS.receiptBytes,'Diagnostic receipt exceeds32MiB bound');await write(NAME,data);}catch(error){diagnosticError('write',error);}}
 return{
  report,
  shellInstall:()=>script('shell'),
  pageHTML:html=>html.replace('</body>','<script>'+script('guest')+'</script></body>'),
  beforeGuest:(readback,selector,x,y)=>'(()=>{const result=('+readback.toString()+')();try{return{...result,inputDiagnostic:'+domRead(selector,x,y)+'};}catch(error){return{...result,inputDiagnostic:{diagnosticError:{message:String(error?.message||error)}}};}})()',
  async observe({details,fixture,record,work}){
   if(report.attempts.length>=LIMITS.attempts){report.attemptsDropped++;return work();}
   const row={selector:details.selector,tabId:details.tabId,webContentsId:details.webContentsId,beforeCount:details.beforeCount,guestBefore:details.beforeGuest.inputDiagnostic||{diagnosticError:{message:'Guest collector was not installed'}},guestAfter:null,shellAfter:null,nativeSequenceBefore:null,nativeSequenceAfter:null,capturedBeforeCleanup:false,originalError:null,diagnosticErrors:[]};report.attempts.push(row);
   const initial=nativeRead('inputDiagnosticRead');row.nativeSequenceBefore={events:initial.events?.total??null,posts:initial.posts?.total??null};
   try{return await work();}catch(error){row.originalError=errorFacts(error);throw error;}finally{
    row.guestAfter=await observed('guest after '+details.selector,()=>fixture.pageJS(record,domRead(details.selector,details.hit.x,details.hit.y)));
    const shellX=details.pageBounds.x+details.hit.x*details.factor,shellY=details.pageBounds.y+details.hit.y*details.factor;
    row.shellAfter=await observed('shell after '+details.selector,()=>fixture.js(domRead('',shellX,shellY)));
    for(const [role,value]of [['guest',row.guestAfter],['shell',row.shellAfter]])if(value?.diagnosticError)row.diagnosticErrors.push({role,...value.diagnosticError});
    const final=nativeRead('inputDiagnosticRead');row.nativeSequenceAfter={events:final.events?.total??null,posts:final.posts?.total??null};row.capturedBeforeCleanup=true;await save();
   }
  },
  async beforeCleanup({stage,error}){
   report.failureStage=stage;report.originalError=error?errorFacts(error):null;report.capturedBeforeCleanup=true;
   if(!stopped){stopped=true;report.native=nativeRead('inputDiagnosticStop');}
   await save();
  },
  async finish(facts){
   if(!stopped){stopped=true;report.native=nativeRead('inputDiagnosticStop');}
   report.retainedCompleted=facts.ok===true;report.originalFailureRetained=!report.retainedCompleted;report.originalError=report.retainedCompleted?null:structuredClone(facts.error||facts.cleanupError||{message:'Original retained workload failed without an error report'});report.originalRestored=facts.restored===true;await save();
  }
 };
}
module.exports={NAME,BASE,LIMITS,installDOMInputDiagnostic,beginInputDiagnostic};
