'use strict';
// Passive retained-smoke evidence. Delivery is accepted only by the caller's
// existing trusted-event predicate; a driver return is never a delivered click.
const assert=require('node:assert/strict');

function errorFacts(error){return{message:error?.message||String(error),stack:error?.stack||null};}
function diagnostic(read){try{return structuredClone(read());}catch(error){return{diagnosticError:errorFacts(error)};}}

// Serialized into the owned diagnostic documents only. This function observes
// browser events; it never focuses, dispatches, prevents or waits for input.
function installInputTrace(surface){
 const key='__mouse636InputTrace';
 if(globalThis[key])return{installed:globalThis[key].schema===1,reused:true};
 const LIMIT=64,FIRST=16,STRING=96,PATH=4,RECTS=8,ERRORS=4;
 const events=[],errors=[],truncated={strings:0,paths:0,rects:0};let total=0,dropped=0,errorCount=0,disposed=false;
 const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
 const text=value=>{const raw=String(value??'');if(raw.length<=STRING)return raw;truncated.strings++;return raw.slice(0,STRING);};
 const describe=node=>node?{tagName:text(node.tagName||node.nodeName||''),id:text(node.id||''),className:text(typeof node.className==='string'?node.className:'')}:null;
 const error=reason=>{errorCount++;if(errors.length<ERRORS)errors.push({message:text(reason?.message||reason),at:number(performance.now())});};
 const read=fn=>{try{return fn();}catch(reason){error(reason);return null;}};
 const rect=value=>value?Object.fromEntries(['x','y','width','height','left','top','right','bottom'].map(name=>[name,number(value[name])])):null;
 const clock=()=>({kind:'renderer-performance',surface,timeOrigin:number(performance.timeOrigin),now:number(performance.now())});
 const focused=()=>read(()=>document.hasFocus());
 function retain(row){total++;row.sequence=total;if(events.length>=LIMIT){events.splice(FIRST,1);dropped++;}events.push(row);}
 function observe(event){
  if(disposed)return;
  try{
   const path=read(()=>typeof event.composedPath==='function'?event.composedPath():[]);if(path&&path.length>PATH)truncated.paths++;
   retain({type:text(event.type),at:number(performance.now()),eventTimeStamp:number(event.timeStamp),trusted:event.isTrusted===true,
    target:describe(event.target),relatedTarget:describe(event.relatedTarget),path:path?.slice(0,PATH).map(describe)||[],
    client:{x:number(event.clientX),y:number(event.clientY)},screen:{x:number(event.screenX),y:number(event.screenY)},
    button:number(event.button),buttons:number(event.buttons),detail:number(event.detail),pointerId:number(event.pointerId),pointerType:text(event.pointerType||''),
    defaultPrevented:event.defaultPrevented===true,eventPhase:number(event.eventPhase),documentFocused:focused(),activeElement:read(()=>describe(document.activeElement))});
  }catch(reason){error(reason);}
 }
 const types=['pointerdown','pointerup','pointercancel','mousedown','mouseup','click','focus','blur'];
 for(const type of types)globalThis.addEventListener(type,observe,{capture:true,passive:true});
 function snapshot({selector='',point=null}={}){
  const captured=clock(),node=selector?read(()=>document.querySelector(selector)):null;
  const hit=point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?read(()=>document.elementFromPoint(point.x,point.y)):null;
  const fragments=node?read(()=>[...node.getClientRects()]):[];if(fragments&&fragments.length>RECTS)truncated.rects++;
  const result={schema:1,clock:captured,disposed,limits:{events:LIMIT,firstEvents:FIRST,stringUnits:STRING,pathNodes:PATH,rects:RECTS,errors:ERRORS},
   observedEvents:total,droppedEvents:dropped,events:structuredClone(events),selector:text(selector),point:point?{x:number(point.x),y:number(point.y)}:null,
   documentFocused:focused(),activeElement:read(()=>describe(document.activeElement)),target:describe(node),targetBounds:node?read(()=>rect(node.getBoundingClientRect())):null,
   targetRects:fragments?.slice(0,RECTS).map(rect)||[],hitTarget:describe(hit),targetContainsHit:node&&hit?read(()=>node.contains(hit)):null,
   viewport:{width:number(globalThis.innerWidth),height:number(globalThis.innerHeight),devicePixelRatio:number(globalThis.devicePixelRatio)},
   scroll:{x:number(globalThis.scrollX),y:number(globalThis.scrollY)}};
  result.truncated={...truncated};result.errorCount=errorCount;result.droppedErrors=Math.max(0,errorCount-ERRORS);result.errors=structuredClone(errors);return result;
 }
 const api={schema:1,snapshot,dispose(){if(disposed)return;disposed=true;for(const type of types)globalThis.removeEventListener(type,observe,true);delete globalThis[key];}};
 Object.defineProperty(globalThis,key,{configurable:true,value:api});return{installed:true,reused:false};
}

function inputTraceReadback(options){
 try{return globalThis.__mouse636InputTrace?.snapshot(options)||{unavailable:true};}
 catch(error){return{diagnosticError:{message:error?.message||String(error)}};}
}

function guestInputReadback(traceOptions){
 const count=mouse634.clicks.length;
 try{return{count,documentFocused:document.hasFocus(),activeElement:{tagName:document.activeElement?.tagName||'',id:document.activeElement?.id||''},...(traceOptions?{inputTrace:globalThis.__mouse636InputTrace?.snapshot(traceOptions)||{unavailable:true}}:{})};}
 catch(error){return{count,diagnosticError:{message:error?.message||String(error)}};}
}

function nativeGuestInputState({win,page,screen,webContents}){
 const wc=page.view.webContents;
 return{
  windowBounds:diagnostic(()=>win.getBounds()),contentBounds:diagnostic(()=>win.getContentBounds()),
  cursor:diagnostic(()=>screen.getCursorScreenPoint()),
  focus:{window:diagnostic(()=>win.isFocused()),shell:diagnostic(()=>win.webContents.isFocused()),
   guest:diagnostic(()=>wc.isFocused()),webContentsId:diagnostic(()=>webContents.getFocusedWebContents()?.id??null)},
  native:{cachedBounds:diagnostic(()=>page.bounds),viewBounds:diagnostic(()=>page.view.getBounds()),
   parentBounds:diagnostic(()=>page.clipView?.getBounds()||null),visible:diagnostic(()=>page.view.getVisible()),
   parentVisible:diagnostic(()=>page.clipView?.getVisible()??true),cachedVisible:diagnostic(()=>!!page.visible),
   attached:diagnostic(()=>win.contentView.children.includes(page.clipView||page.view))},
  url:diagnostic(()=>wc.getURL()),loading:diagnostic(()=>wc.isLoadingMainFrame())
 };
}

async function observeGuestClick({attempts,details,readNative,post,readEvents,accept,waitFor,label,save,readTrace}){
 const attempt={...diagnostic(()=>details),before:{at:Date.now(),native:diagnostic(readNative)},posted:null,poll:null};
 if(readTrace)attempt.clock={kind:'main-performance',timeOrigin:performance.timeOrigin,before:performance.now()};
 const trace=async()=>{try{attempt.inputTrace=structuredClone(await readTrace());}catch(reason){attempt.inputTrace={diagnosticError:errorFacts(reason)};}};
 attempts.push(attempt);
 try{
  const result=await post();
  attempt.posted={at:Date.now(),result,native:diagnostic(readNative)};
  if(readTrace)attempt.clock.posted=performance.now();
  assert.equal(result,true);
  let events;
  // No save/IPC/extra wait between the original driver call and original wait.
  await waitFor(async()=>{
   events=await readEvents();attempt.poll={at:Date.now(),events:diagnostic(()=>events)};
   return accept(events);
  },label);
  if(readTrace){attempt.clock.settled=performance.now();await trace();}
  return events;
 }catch(error){
  attempt.error=errorFacts(error);attempt.failedNative={at:Date.now(),native:diagnostic(readNative)};
  if(readTrace){attempt.clock.failed=performance.now();await trace();}
  try{await save();}catch(saveError){attempt.diagnosticSaveError=errorFacts(saveError);}
  throw error;
 }
}

module.exports={guestInputReadback,nativeGuestInputState,observeGuestClick,installInputTrace,inputTraceReadback};
