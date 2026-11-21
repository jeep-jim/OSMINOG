'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('mouse/desktop-slide.js','utf8');
function fixture({borrowed=false,reduced=false,failOutgoing=false,failIncoming=false,failReplace=false}={}){
 const calls=[],listeners=new Map(),workspace={style:{visibility:''},dataset:{},inert:false},model={desktopId:'a'},context={module:{exports:{}},performance:{now:()=>calls.length},matchMedia:()=>({matches:reduced}),setTimeout,clearTimeout,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 vm.runInNewContext(source,context);const api=context.module.exports;let clears,valid=true;
 const packet=()=>({desk:model.desktopId,complete:true,surfaces:[],token:'frame-'+model.desktopId});
 const N={test:true,onPreviewsCleared(fn){clears=fn;return()=>{clears=null;}},async desktops(action,args){calls.push([action,{...args}]);if(action==='surfaces')return packet();if(args.phase==='begin')return{held:true,token:args.token};return{released:true};}};
 const scene={ids:()=>[model.desktopId+'-page'],valid:()=>valid,async stage(kind,data){calls.push(['stage',kind,data.desk]);return kind==='outgoing'?!failOutgoing:!failIncoming;},show(){calls.push(['show']);},async animate(){calls.push(['animate']);return valid;},timing:()=>({animationStartedAt:1,animationEndedAt:331,animationDurationMs:330}),cancel(){valid=false;calls.push(['cancel']);},remove(){calls.push(['remove']);}};
 const lease=borrowed?{token:'nora-hold',outgoing:packet(),valid:()=>valid,async replace(data){calls.push(['replace',data.desk]);return!failReplace;},async abort(){calls.push(['abort']);}}:null;
 const params={N,workspace,model,lease,sceneFactory:(_workspace,_model,_direction,options)=>{calls.push(['scene',{...options}]);return scene;},present:async()=>{calls.push(['present']);return valid;},async change(){calls.push(['change']);model.desktopId='b';},async layout(){calls.push(['layout']);}};
 return{api,params,calls,listeners,workspace,model,scene,lease,invalidate(){valid=false;clears?.();}};
}
test('ordinary desktop selection uses live pages without capture, clones, native holds or a blocking animation',async()=>{
 const f=fixture({failOutgoing:true,failIncoming:true});const result=await f.api.run(f.params);
 assert.equal(result.strategy,'live');assert.equal(result.phase,'complete');assert.equal(result.presented,true);assert.equal(result.snapshotCaptures,0);assert.equal(result.animated,false);assert.equal(result.decoded,false);assert.equal(result.layoutCalls,1);
 assert.deepEqual(f.calls.map(x=>x[0]),['change','layout','present']);assert.equal(f.model.desktopId,'b');
 assert.equal(f.workspace.style.visibility,'');assert.equal(f.workspace.inert,false);assert.equal(f.model.desktopSliding,false);assert.equal(f.listeners.size,0);
});
test('live selection errors restore input ownership without triggering a snapshot fallback',async()=>{
 const f=fixture();f.params.change=async()=>{throw Error('Owned switch failure');};await assert.rejects(()=>f.api.run(f.params),/Owned switch failure/);
 assert.equal(f.model.desktopId,'a');assert.equal(f.calls.length,0);assert.equal(f.workspace.inert,false);assert.equal(f.model.desktopSliding,false);assert.equal(f.api.last.phase,'failed');
});
test('a borrowed Nora hold keeps the dialog background owned through the complete transition and replaces it under cover',async()=>{
 const f=fixture({borrowed:true}),result=await f.api.run(f.params),names=f.calls.map(x=>x[0]);
 assert.equal(result.animated,true);assert.equal(result.borrowedHold,true);assert.equal(result.phase,'complete');
 assert.deepEqual(f.calls.find(x=>x[0]==='scene')[1],{borrowedHold:true},'The borrowed scene must stay below Nora’s existing scrim');
 assert.equal(f.calls.filter(x=>x[0]==='surface-hold').length,0,'Borrowed hold is neither reacquired nor released');
 assert.deepEqual(f.calls.filter(x=>x[0]==='surfaces').map(x=>x[1]),[{ids:['b-page'],hold:'nora-hold',paintProof:true}]);
 assert.ok(names.indexOf('animate')<names.indexOf('replace'));assert.ok(names.indexOf('replace')<names.indexOf('remove'),'Incoming Nora pixels exist before the transition cover is removed');
 assert.equal(names.includes('abort'),false);assert.equal(f.workspace.style.visibility,'');assert.equal(f.workspace.inert,false);
});
test('reduced motion updates the borrowed Nora background without animation or releasing its hold',async()=>{
 const f=fixture({borrowed:true,reduced:true}),result=await f.api.run(f.params);
 assert.equal(result.animated,false);assert.equal(result.reducedMotion,true);assert.equal(result.decoded,true);assert.equal(result.phase,'complete');
 assert.equal(f.calls.some(x=>x[0]==='animate'||x[0]==='surface-hold'||x[0]==='abort'),false);assert.ok(f.calls.some(x=>x[0]==='replace'&&x[1]==='b'));
});
test('failed incoming capture or replacement releases Nora safely instead of leaving stale outgoing pixels',async()=>{
 for(const option of ['failIncoming','failReplace']){const f=fixture({borrowed:true,[option]:true});await assert.rejects(()=>f.api.run(f.params));assert.equal(f.model.desktopId,'b');assert.equal(f.calls.filter(x=>x[0]==='abort').length,1);assert.equal(f.calls.some(x=>x[0]==='surface-hold'),false);assert.ok(f.calls.findIndex(x=>x[0]==='abort')<f.calls.findIndex(x=>x[0]==='remove'));assert.equal(f.model.desktopSliding,false);assert.equal(f.workspace.style.visibility,'');}
});
test('a cancelled borrowed transition aborts its changed desk and removes handlers and cover',async()=>{
 const f=fixture({borrowed:true});f.params.layout=async()=>{f.calls.push(['layout']);if(f.model.desktopId==='b')f.invalidate();};
 await f.api.run(f.params);assert.equal(f.calls.filter(x=>x[0]==='abort').length,1);assert.equal(f.calls.some(x=>x[0]==='replace'),false);assert.equal(f.listeners.size,0);assert.equal(f.model.desktopSliding,false);
});
test('presentation waits for real frames beyond the former 120 ms cutoff and is cancellable',async()=>{
 let clock=0,id=0;const frames=new Map(),timers=new Map(),context={module:{exports:{}},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,context);const api=context.module.exports;let settled=false,value;
 const pending=api.presented().then(v=>{settled=true;value=v;});clock=200;for(const [id,timer]of timers)if(timer.at<=clock){timers.delete(id);timer.fn();}await Promise.resolve();assert.equal(settled,false,'Slow preparation is not replaced by a direct change');
 let first=frames.entries().next().value;frames.delete(first[0]);first[1]();clock=260;first=frames.entries().next().value;frames.delete(first[0]);first[1]();await pending;assert.equal(value,true);assert.equal(timers.size,0);
 let valid=true;const cancelled=api.presented(()=>valid);valid=false;first=frames.entries().next().value;frames.delete(first[0]);first[1]();assert.equal(await cancelled,false);assert.equal(frames.size,0);assert.equal(timers.size,0);
});

function rendererSwitchFixture({focus='',library=true,targetAI=true}={}){
 const browserSource=fs.readFileSync('mouse/browser.js','utf8'),begin=browserSource.indexOf('async function switchDesktop('),end=browserSource.indexOf('async function applyMode(',begin);
 assert.ok(begin>=0&&end>begin);const events=[],staged=[];let geometry=1;
 const model={desktopId:'old',state:{desktops:{items:[{id:'old'},{id:'new'}]},tabs:[]},tree:{id:'p1'},slots:{'p1':'source-page'},active:'p1',libraryOpen:library,focusPane:focus==='pane'?'p1':'',focusAI:focus==='ai',switching:false};
 const workspace={style:{visibility:''},dataset:{},inert:false},packet=()=>({desk:model.desktopId,complete:true,token:'capture-'+model.desktopId,holdToken:'nora-hold',boundsVersion:geometry,surfaces:[]});
 const lease={token:'nora-hold',outgoing:packet(),valid:()=>true,async replace(){events.push('replace');return true;},async abort(){events.push('abort');}};
 const desktopUI={isOpen:true,async close(){events.push('nora.close');this.isOpen=false;},transitionLease(){events.push('lease');return lease;},render(){events.push('nora.render');}};
 const scene={ids:()=>[model.desktopId+'-page'],valid:()=>true,async stage(kind,data){events.push('stage:'+kind);staged.push({kind,focusPane:model.focusPane,focusAI:model.focusAI,library:model.libraryOpen});return data.desk===model.desktopId&&data.boundsVersion===geometry;},show(){},async animate(){events.push('animate');return true;},timing:()=>({}),cancel(){},remove(){events.push('remove');}};
 const slideContext={module:{exports:{}},performance:{now:()=>events.length}};vm.runInNewContext(source,slideContext);const slide=slideContext.module.exports;
 const N={test:true,async window(action){events.push('window:'+action);geometry++;},async desktops(action,args){
  events.push('native:'+action);
  if(action==='surfaces')return packet();
  if(action==='surface-hold')return args.phase==='begin'?{held:true,token:args.token}:{released:true};
  assert.equal(action,'switch');return{preferences:{desktopId:'new',tree:{id:'p2'},slots:{'p2':'target-page'},active:'p2',aiOpen:targetAI,aiId:targetAI?'target-ai':'',agentOpen:false},state:{desktops:{items:[{id:'old'},{id:'new'}]},tabs:[{id:'target-page',lane:'main'},...(targetAI?[{id:'target-ai',lane:'side'}]:[])]}};
 }};
 const context={m:model,N,desktopUI,searchUI:null,progressUI:{prepareLayout(){events.push('progress.prepare');assert.equal(model.desktopId,'new');assert.equal(model.desktopSliding,true);assert.equal(workspace.style.visibility,desktopUI.isOpen?'hidden':'');}},deskSwitch:Promise.resolve(),clearTimeout,arrangement:{cancel(){}},browsing:{hideHints(){},close(){events.push('browsing.close');model.libraryOpen=false;geometry++;}},feedback:{hide(){}},zoomUI:{async close(){events.push('zoom.close');}},overlays:{async sync(){}},restorePane(){events.push('restorePane');model.focusPane='';model.focusAI=false;geometry++;},MouseDesktopSlide:{run:options=>slide.run({...options,sceneFactory:()=>scene,present:async()=>true})},$:()=>workspace,L:require('./mouse/layout.js'),prefs:()=>({}),renderTree(){events.push('renderTree');geometry++;},renderAISites(){},applySide(){},requestLayout(){events.push('requestLayout');},layoutNow:async()=>{events.push('layout');}};
 vm.runInNewContext(browserSource.slice(begin,end),context);
 return{events,staged,model,desktopUI,async run(keepNora){await context.switchDesktop('new',false,{keepNora});return slide.last;}};
}
test('renderer switching behind Nora preserves library and fullscreen geometry until the outgoing frame is staged',async()=>{
 for(const options of [{focus:'',library:true},{focus:'pane',library:false},{focus:'ai',library:false,targetAI:true},{focus:'ai',library:false,targetAI:false}]){
  const f=rendererSwitchFixture(options),result=await f.run(true);
  assert.equal(result.borrowedHold,true);assert.equal(result.phase,'complete');assert.equal(f.desktopUI.isOpen,true);assert.equal(f.model.libraryOpen,options.library);
  for(const forbidden of ['nora.close','browsing.close','restorePane','window:pane-restore'])assert.equal(f.events.includes(forbidden),false,forbidden+' must not invalidate the borrowed outgoing frame');
  assert.ok(f.events.indexOf('stage:outgoing')<f.events.indexOf('native:switch'));
  assert.equal(f.staged[0].library,options.library);assert.equal(f.staged[0].focusPane,options.focus==='pane'?'p1':'');assert.equal(f.staged[0].focusAI,options.focus==='ai');
  if(options.focus==='ai'&&options.targetAI){assert.equal(f.model.focusAI,true);assert.equal(f.model.focusPane,'');}
  else if(options.focus){assert.equal(f.model.focusAI,false);assert.equal(f.model.focusPane,'p2','Retained native fullscreen targets an existing pane on the incoming desktop');}
  else{assert.equal(f.model.focusAI,false);assert.equal(f.model.focusPane,'');}
  assert.equal(f.model.switching,false);
 }
});
test('ordinary live desktop switch closes old overlays before selecting the destination',async()=>{
 for(const focus of ['pane','ai']){
  const f=rendererSwitchFixture({focus,library:true}),result=await f.run(false);assert.equal(result.borrowedHold,false);assert.equal(result.phase,'complete');
  for(const action of ['nora.close','browsing.close','restorePane','window:pane-restore'])assert.ok(f.events.indexOf(action)>=0&&f.events.indexOf(action)<f.events.indexOf('native:switch'));
  assert.equal(f.desktopUI.isOpen,false);assert.equal(f.model.libraryOpen,false);assert.equal(f.model.focusPane,'');assert.equal(f.model.focusAI,false);assert.equal(f.model.switching,false);
 }
});

test('renderer prepares incoming progress ownership under the cover before its existing native layout',async()=>{
 for(const keepNora of [false,true]){
  const f=rendererSwitchFixture({focus:'',library:false}),result=await f.run(keepNora);
  assert.equal(f.events.filter(event=>event==='progress.prepare').length,1);
  assert.ok(f.events.indexOf('progress.prepare')>f.events.indexOf('renderTree'));
  assert.ok(f.events.indexOf('progress.prepare')<f.events.indexOf('layout'));
  if(keepNora)assert.ok(f.events.indexOf('layout')<f.events.indexOf('stage:incoming'));else assert.equal(f.events.some(event=>event.startsWith('stage:')),false);
  assert.equal(f.events.filter(event=>event==='layout').length,keepNora?2:1);assert.equal(result.layoutCalls,keepNora?2:1);
 }
});
