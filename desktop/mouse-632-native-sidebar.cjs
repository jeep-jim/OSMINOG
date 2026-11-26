'use strict';
const assert=require('node:assert/strict');
const PAGE_RECEIPTS=32,SAMPLE_RECEIPTS=8;
const rect=value=>value?{x:value.x,y:value.y,width:value.width,height:value.height}:null;
const validRect=value=>!!value&&['x','y','width','height'].every(key=>Number.isFinite(value[key]))&&value.width>=0&&value.height>=0;
const intersects=(a,b)=>a.width>0&&a.height>0&&b.width>0&&b.height>0&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function intersection(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);return{x,y,width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-x),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-y)};}

// Main-process observation only. Logical page.bounds and browser.panels do not
// prove that the native child has relinquished the sidebar's input region.
function readNativeSidebar(ctx){
 const {win,privateMode,browser}=ctx;
 try{
  const session=privateMode?.current||null,current=session?.browser||browser,gate=session?.gate||ctx.overlayGate||privateMode?.normalGate,contents=win.webContents,main=contents.mainFrame,root=win.contentView,contentBounds=rect(win.getContentBounds());
  const owner={win,current,session,gate,contents,root,processId:main.processId,routingId:main.routingId,frameToken:main.frameToken};
  const state={at:performance.now(),clock:'main.performance.now',frame:{processId:main.processId,routingId:main.routingId,frameToken:main.frameToken,detached:main.detached},gate:{blocked:gate?.blocked??null,sequence:gate?.sequence??null,documentFrame:gate?.documentFrame??null},privateMode:!!session,privateBusy:!!privateMode?.busy,browserDisposed:!!current.disposed,browserMatchesWindow:current.win===win,windowDestroyed:win.isDestroyed(),shellWebContentsId:contents.id,contentBounds,surfaceHeld:!!current.mouseSurfaceHold,windowFocused:win.isFocused(),shellFocused:contents.isFocused(),pages:[]};
  const viewport={x:0,y:0,width:contentBounds.width,height:contentBounds.height};
  for(const page of [...current.tabs.values(),...current.providers.values()]){
   const row={id:page.id,visible:page.visible,bounds:rect(page.bounds)};
   try{
    const view=page.view,parent=page.clipView,wc=view.webContents;
    Object.assign(row,{webContentsId:wc.id,destroyed:wc.isDestroyed(),focused:wc.isFocused(),viewVisible:view.getVisible(),parentVisible:parent?parent.getVisible():null,parentAttached:root.children.includes(parent||view),childAttached:!parent||parent.children.includes(view),viewBounds:rect(view.getBounds()),parentBounds:parent?rect(parent.getBounds()):null});
    row.attached=row.parentAttached&&row.childAttached;
    if(validRect(row.viewBounds)&&(!parent||validRect(row.parentBounds))){
     row.contentViewBounds={...row.viewBounds,x:row.viewBounds.x+(row.parentBounds?.x||0),y:row.viewBounds.y+(row.parentBounds?.y||0)};
     row.clippedBounds=intersection(intersection(row.contentViewBounds,row.parentBounds||viewport),viewport);
    }
   }catch(error){row.readError=String(error?.message||error).slice(0,240);}
   state.pages.push(row);
  }
  return{owner,state};
 }catch(error){return{owner:null,state:{readError:String(error?.message||error).slice(0,240),pages:[]}};}
}

function nativeSidebarReceipt(snapshot){
 const {state}=snapshot,pages=state.pages||[];
 return{...state,pages:pages.slice(0,PAGE_RECEIPTS),pageCount:pages.length,droppedPages:Math.max(0,pages.length-PAGE_RECEIPTS),focusedGuests:pages.filter(page=>page.focused).map(page=>({id:page.id,webContentsId:page.webContentsId})).slice(0,PAGE_RECEIPTS)};
}

// Serialized into the existing shell read. No focus, layout, animation or input
// changes: the selected control and its sidebar must be observed together.
function sidebarClickTarget(selector,hitTarget){
 const element=document.querySelector(selector),sidebar=document.querySelector('#settings-dialog'),bounds=sidebar?.getBoundingClientRect();
 return{at:performance.now(),timeOrigin:performance.timeOrigin,focused:document.hasFocus(),visible:document.visibilityState==='visible',viewport:{width:innerWidth,height:innerHeight},connected:!!element?.isConnected,insideSidebar:!!sidebar&&sidebar.contains(element),point:hitTarget(element),sidebar:sidebar?{open:sidebar.open,modal:sidebar.matches(':modal'),connected:sidebar.isConnected,x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,right:bounds.right,bottom:bounds.bottom}:null,input:globalThis.__mouse632DocumentInput?.snapshot()??null};
}

function sameOwner(a,b){return!!a&&!!b&&['win','current','session','gate','contents','root','processId','routingId','frameToken'].every(key=>a[key]===b[key]);}
function sidebarReadiness(dom,snapshot,owner,timeOrigin){
 const s=snapshot.state,side=dom?.sidebar,point=dom?.point;
 const no=reason=>({ready:false,reason});
 if(!sameOwner(owner,snapshot.owner))return no('native owner or shell frame changed');
 if(s.readError)return no('native state could not be read');
 if(s.privateBusy||s.browserDisposed||!s.browserMatchesWindow||s.windowDestroyed||s.frame.detached)return no('native owner is not ready');
 if(dom?.timeOrigin!==timeOrigin)return no('renderer document changed');
 if(dom.input?.timeOrigin!==timeOrigin)return no('input probe no longer belongs to this document');
 if(!dom?.focused||!dom.visible||!s.windowFocused||!s.shellFocused||s.pages.some(page=>page.focused))return no('shell does not own focus');
 if(s.gate.blocked!==false||s.surfaceHeld)return no('native pages are held or blocked');
 if(!dom.connected||!dom.insideSidebar||!side?.connected||side.open!==true||side.modal!==false||!validRect(side)||side.width<=0||side.height<=0)return no('settings sidebar is not open and nonmodal');
 if(!validRect(s.contentBounds)||dom.viewport?.width!==s.contentBounds.width||dom.viewport?.height!==s.contentBounds.height)return no('shell viewport changed');
 if(!point?.ready||!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<side.x||point.x>=side.x+side.width||point.y<side.y||point.y>=side.y+side.height)return no('DOM target is not exposed inside the sidebar');
 const covering=[];let coveringCount=0;
 for(const page of s.pages){
  if(page.readError)return no('native page state could not be read');
  if(!page.attached||page.viewVisible===false||page.parentVisible===false)continue;
  if(page.destroyed||page.viewVisible!==true||!validRect(page.contentViewBounds))return no('attached native page state is invalid');
  // NativeViewHost can extend beyond a smaller clip View on macOS. Record the
  // intersection, but require the actual translated child itself to leave the
  // sidebar; a small logical parent is not evidence of native input clipping.
  if(intersects(page.contentViewBounds,side)){coveringCount++;if(covering.length<8)covering.push({id:page.id,webContentsId:page.webContentsId,bounds:page.contentViewBounds});}
 }
 return coveringCount?{ready:false,reason:'native child covers the sidebar',coveringCount,covering}:{ready:true,reason:'DOM and actual native sidebar are clear'};
}

// The former visible/hit window remains 10 seconds, additionally capped by the
// existing fixture deadline. Preparation and each asynchronous DOM read share
// that window. A late read cannot post input, even if the underlying acquisition
// has its own longer bound. No extra frames, sleeps or second click are added.
async function clickNativeSidebar({readDOM,readNative,prepare,until,click,onReady,report,fixtureDeadline,now=()=>performance.now(),label}){
 assert.ok(Number.isFinite(fixtureDeadline),'The existing fixture deadline is required');
 const startedAt=now(),deadlineAt=Math.min(startedAt+10000,fixtureDeadline),owner=readNative().owner;
 Object.assign(report,{clock:'main.performance.now',startedAt,deadlineAt,timeoutMs:10000,sampleCount:0,droppedSamples:0,samples:[],clickRequested:false,clickCompleted:false});
 const remaining=()=>{const left=deadlineAt-now();if(left<=0)throw Error('Mouse632 native sidebar readiness deadline exceeded');return left;};
 function record(dom,snapshot,verdict,phase){const {input,...target}=dom;const sample={phase,dom:target,native:nativeSidebarReceipt(snapshot),...verdict};report.sampleCount++;if(report.samples.length<SAMPLE_RECEIPTS)report.samples.push(sample);else{report.samples[SAMPLE_RECEIPTS-1]=sample;report.droppedSamples++;}return sample;}
 remaining();const before=await prepare();remaining();let dom,snapshot;
 await until(async()=>{
  remaining();dom=await readDOM();snapshot=readNative();const verdict=sidebarReadiness(dom,snapshot,owner,before.timeOrigin);record(dom,snapshot,verdict,'wait');remaining();return verdict.ready;
 },label,remaining());
 remaining();const fresh=readNative(),verdict=sidebarReadiness(dom,fresh,owner,before.timeOrigin),sample=record(dom,fresh,verdict,'before-down');
 if(JSON.stringify(fresh.state.contentBounds)!==JSON.stringify(snapshot.state.contentBounds))throw Error('Mouse632 native sidebar window changed before DOWN');
 assert.equal(verdict.ready,true,'Mouse632 native sidebar changed before DOWN: '+verdict.reason);remaining();
 onReady({dom,native:sample.native});remaining();report.clickRequested=true;report.clickRequestedAt=now();
 const result=click(dom.point,fresh.state.contentBounds);report.clickCompleted=result===true;report.clickCompletedAt=now();assert.equal(result,true,'Native sidebar click must be posted once');
 return sample;
}

module.exports={readNativeSidebar,nativeSidebarReceipt,sidebarClickTarget,sidebarReadiness,clickNativeSidebar};
