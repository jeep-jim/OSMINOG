'use strict';
// Application input proof, not a claim that a physical two-finger device was
// exercised. Every tested gesture enters Chromium via native mouseWheel input.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {KEY,EVENT,PAGE_RECOGNIZER:RECOGNIZER}=require('./mouse-gesture.cjs'),Wheel=require('./mouse/desktop-wheel.js');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let n=0;n<480;n++){if(await fn())return;await sleep(25);}throw Error('Mouse630 wheel timeout: '+label);}
function wheelPreparationBudget({timeoutMs=12000,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const startedAt=now(),deadlineAt=startedAt+timeoutMs;let expired=false;
 const check=label=>{if(expired||now()>=deadlineAt){expired=true;throw Error('Mouse630 wheel readiness timeout: '+label);}};
 async function run(operation,label){
  check(label);let timer;
  try{const value=await Promise.race([Promise.resolve().then(()=>{check(label);return operation();}),new Promise((_,reject)=>{timer=setTimer(()=>{expired=true;reject(Error('Mouse630 wheel readiness timeout: '+label));},Math.max(1,Math.ceil(deadlineAt-now())));})]);check(label);return value;}
  finally{clearTimer(timer);}
 }
 async function wait(predicate,label){for(;;){if(await run(predicate,label)){check(label);return;}await run(()=>new Promise(resolve=>setTimer(resolve,25)),label);}}
 return{startedAt,deadlineAt,timeoutMs,run,wait,check};
}
function wheelTargetProblems(snapshot,focus=false){
 const {native,dom}=snapshot,problems=[];
 for(const key of ['contextMatches','contentsMatches','pageMatches','epochMatches','urlMatches','desktopMatches'])if(native[key]!==true)problems.push('identity:'+key);
 if(native.destroyed)problems.push('identity:destroyed');
 if(!native.window.visible||!native.window.focused||native.window.minimized)problems.push('window-not-ready');
 if(native.busy||native.loading)problems.push('target-loading');
 if(!dom||dom.timeOrigin!==snapshot.timeOrigin)problems.push('identity:timeOrigin');
 if(!dom||dom.readyState!=='complete'||dom.visibilityState!=='visible')problems.push('document-not-visible-ready');
 if(snapshot.nativeBefore){
  for(const key of ['contextMatches','contentsMatches','pageMatches','epochMatches','urlMatches','desktopMatches'])if(snapshot.nativeBefore[key]!==true)problems.push('identity:before-'+key);
  const geometry=value=>JSON.stringify([value.viewBounds,value.rootBounds,value.window.contentBounds,value.rootIndex,value.rootAttached,value.childAttached]);
  if(geometry(snapshot.nativeBefore)!==geometry(native))problems.push('native-geometry-changing');
 }
 const point=dom?.point,inside=(r,p)=>r&&p&&[r.x,r.y,r.width,r.height,p.x,p.y].every(Number.isFinite)&&r.width>0&&r.height>0&&p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height;
 if(!dom?.connected||!dom.hit||!inside({x:0,y:0,width:dom?.viewport?.width,height:dom?.viewport?.height},point))problems.push('target-hit-test');
 if(!native.shell){
  if(!native.browserMatchesWindow||!native.cachedVisible||native.viewVisible!==true||native.hasClip&&native.clipVisible!==true||native.surfaceHeld||!native.rootAttached||!native.childAttached)problems.push('native-target-not-visible-attached');
  const view=native.viewBounds,root=native.rootBounds;
  if(!inside({x:0,y:0,width:view?.width,height:view?.height},point))problems.push('native-view-hit-test');
  const contentPoint=view&&point?{x:point.x+view.x+(native.hasClip?root?.x||0:0),y:point.y+view.y+(native.hasClip?root?.y||0:0)}:null;
  if(!inside(root,contentPoint)||!inside({x:0,y:0,width:native.window.contentBounds.width,height:native.window.contentBounds.height},contentPoint))problems.push('native-clip-hit-test');
 }
 if(focus&&(!native.contentsFocused||dom?.focused!==true))problems.push('target-not-focused');
 return problems;
}
async function prepareWheelTarget({budget,report,read,focusWindow,windowReady,focusContents}){
 const sample=async stage=>{const value=await read();budget.check(stage);report.last=value;report.sampleCount=(report.sampleCount||0)+1;report.stage=stage;return value;};
 report.before=await budget.run(()=>sample('before'),'initial target snapshot');
 await budget.run(focusWindow,'focus window');await budget.wait(windowReady,'native wheel window focused');
 async function ready(focus){const value=await sample(focus?'contents-focus':'placement');report.waitingFor=wheelTargetProblems(value,focus);if(report.waitingFor.some(reason=>reason.startsWith('identity:')))throw Error('Mouse630 wheel target identity changed: '+report.waitingFor.join(', '));return report.waitingFor.length===0;}
 await budget.wait(()=>ready(false),'native wheel target placement');report.placement=report.last;
 await budget.run(focusContents,'focus target WebContents');
 await budget.wait(()=>ready(true),'native wheel target focus');report.ready=report.last;report.stage='ready';return report.ready;
}
module.exports=async({app,win,browser,store,privateMode})=>{
 assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));assert.equal(privateMode.current,null);
 const js=source=>win.webContents.executeJavaScript(source),bank=browser.mouseDesktops.bank;
 await js('MouseTest.desktopUI.close({immediate:true});MouseTest.browsing.close();MouseTest.feedback.hide();MouseTest.save()');await store.queue;
 const original=await js('({preferences:MouseTest.prefs(),focusPane:MouseTest.model.focusPane,focusAI:MouseTest.model.focusAI,libraryOpen:MouseTest.model.libraryOpen})'),savedBank=bank.snapshot(),originalPages=new Map([...browser.tabs.values()].map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL()}])),normalLearnedInitial=structuredClone((await store.get(KEY))[KEY]);
 const desks=bank.items.slice(0,2).map(item=>item.id),made=[],send=win.webContents.send,signs=new Map();assert.equal(desks.length,2);
 const facts={version:app.getVersion(),electronVersion:process.versions.electron,source:'webContents.sendInputEvent mouseWheel via Chromium trusted wheel event',physicalTwoFingerDeviceVerified:false,recognizer:RECOGNIZER,limits:{horizontalThreshold:Wheel.HORIZONTAL_THRESHOLD,controlThreshold:Wheel.CONTROL_THRESHOLD,quietMs:Wheel.QUIET_MS,cooldownMs:Wheel.COOLDOWN_MS},inputs:[],observed:[],packets:[],cases:{},readiness:[],normalLearning:{initial:normalLearnedInitial??null},restored:false};
 const save=()=>fs.writeFile('mouse-630-wheel-pages.json',JSON.stringify(facts,null,2)+'\n');let server,root='',failed;
 const packetRange=entry=>({...entry,packetEndIndex:facts.packets.length,packetCount:facts.packets.length-entry.packetIndex});
 const current=()=>js('({desktopId:MouseTest.model.desktopId,noraOpen:MouseTest.desktopUI.isOpen,switching:MouseTest.model.switching,gesture:MouseTest.desktopUI.gesture.diagnostics()})');
 async function observe(wc){
  await wc.executeJavaScript(`(()=>{if(globalThis.__mouse630WheelObserve)return;globalThis.__mouse630WheelEvents=[];globalThis.__mouse630WheelObserve=event=>{if(globalThis.__mouse630WheelEvents.length<500)globalThis.__mouse630WheelEvents.push({isTrusted:event.isTrusted,deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,defaultPrevented:event.defaultPrevented});};window.addEventListener('wheel',globalThis.__mouse630WheelObserve);})()`);
 }
 async function burst(label,wc,target,{axis='x',direction=1,count=4,amount=32,precise=true}={}){
  const budget=wheelPreparationBudget(),report={case:label,webContentsId:wc.id,selector:target.selector,clock:'node performance.now() milliseconds',startedAt:budget.startedAt,deadlineAt:budget.deadlineAt,timeoutMs:budget.timeoutMs,stage:'observe',sampleCount:0,diagnosticErrors:[]};facts.readiness.push(report);
  let pin,read,native;
  try{
  await budget.run(()=>observe(wc),'install wheel observer');
  const context=privateMode.current,targetBrowser=context?.browser||browser,shell=wc===win.webContents;
  const page=shell?null:[...targetBrowser.tabs.values()].find(item=>item.view.webContents===wc);
  pin={context,browser:targetBrowser,page,shell,wc,epoch:page?.navigationEpoch,url:wc.getURL(),desktop:targetBrowser.mouseDesktops.bank.active,timeOrigin:await budget.run(()=>wc.executeJavaScript('performance.timeOrigin'),'pin target document')};
  native=()=>{
   const currentContext=privateMode.current,currentBrowser=currentContext?.browser||browser,view=page?.view,clip=page?.clipView,rootView=clip||view,children=win.contentView.children,destroyed=wc.isDestroyed();
   return{
    at:performance.now(),shell,privateMode:!!currentContext,
    contextMatches:currentContext===pin.context&&currentBrowser===pin.browser,
    contentsMatches:wc===pin.wc&&(shell?wc===win.webContents:view?.webContents===wc),
    pageMatches:shell||!!page&&currentBrowser.tabs.get(page.id)===page,
    epochMatches:shell||page?.navigationEpoch===pin.epoch,urlMatches:!destroyed&&wc.getURL()===pin.url,
    desktopMatches:currentBrowser.mouseDesktops.bank.active===pin.desktop&&(shell||currentBrowser.mouseDesktops.bank.members[page?.id]===pin.desktop),
    destroyed,contentsFocused:!destroyed&&wc.isFocused(),loading:!destroyed&&wc.isLoadingMainFrame(),busy:privateMode.busy,
    window:{visible:win.isVisible(),focused:win.isFocused(),minimized:win.isMinimized(),contentBounds:{...win.getContentBounds()}},
    pageId:page?.id||null,epoch:page?.navigationEpoch??null,pageError:!!page?.error,browserMatchesWindow:targetBrowser.win===win,cachedVisible:page?.visible??null,
    // Electron44.5 View exposes getVisible. A missing capability stays unknown,
    // never promoted from the cached flag to a proven visible native target.
    viewVisibilitySupported:typeof view?.getVisible==='function',viewVisible:view?.getVisible?.()??null,
    hasClip:!!clip,clipVisibilitySupported:typeof clip?.getVisible==='function',clipVisible:clip?.getVisible?.()??null,
    viewBounds:view?{...view.getBounds()}:null,rootBounds:rootView?{...rootView.getBounds()}:null,
    rootAttached:shell||children.includes(rootView),rootIndex:rootView?children.indexOf(rootView):null,rootsCount:children.length,
    childAttached:!clip||clip.children.includes(view),surfaceHeld:!!targetBrowser.mouseSurfaceHold
   };
  };
  read=async()=>{
   const before=native(),dom=await wc.executeJavaScript(`(()=>{const e=document.querySelector(${JSON.stringify(target.selector)}),r=e?.getBoundingClientRect(),point=r?{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}:null,hit=point?document.elementFromPoint(point.x,point.y):null;return{at:performance.now(),timeOrigin:performance.timeOrigin,readyState:document.readyState,visibilityState:document.visibilityState,focused:document.hasFocus(),viewport:{width:innerWidth,height:innerHeight},connected:!!e?.isConnected,hit:!!e&&(hit===e||e.contains(hit)),point,bounds:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,observerCount:Array.isArray(globalThis.__mouse630WheelEvents)?globalThis.__mouse630WheelEvents.length:null};})()`);
   const after=native();return{timeOrigin:pin.timeOrigin,native:after,nativeBefore:before,dom};
  };
  const ready=await prepareWheelTarget({budget,report,read,focusWindow:()=>{app.focus({steal:true});win.show();win.focus();},windowReady:()=>win.isVisible()&&win.isFocused()&&!win.isMinimized(),focusContents:()=>wc.focus()});
  const point=ready.dom.point,origin=ready.dom.timeOrigin,key=wc.id+':'+origin+':'+axis;
  const input=value=>{const event={type:'mouseWheel',x:Math.round(point.x),y:Math.round(point.y),deltaX:axis==='x'?value:0,deltaY:axis==='y'?value:0,hasPreciseScrollingDeltas:precise,canScroll:true};facts.inputs.push({case:label,webContentsId:wc.id,at:Date.now(),...event});wc.sendInputEvent(event);};
  if(!signs.has(key)){
   const index=await wc.executeJavaScript('globalThis.__mouse630WheelEvents.length');report.stage='calibration';report.calibration={index,inputIndex:facts.inputs.length,sentAt:performance.now()};input(2);let seen;await until(async()=>{seen=await wc.executeJavaScript(`globalThis.__mouse630WheelEvents[${index}]`);return seen;},'wheel calibration observed by Chromium');assert.equal(seen.isTrusted,true);const sign=Math.sign(axis==='x'?seen.deltaX:seen.deltaY);assert.ok(sign);signs.set(key,sign);report.calibration.observed={...seen};report.calibration.completedAt=performance.now();
  }
  await sleep(500);const start=await wc.executeJavaScript('globalThis.__mouse630WheelEvents.length'),before=await current(),packetIndex=facts.packets.length;
  for(let i=0;i<count;i++){input(direction*signs.get(key)*amount);await sleep(16);}
  await sleep(75);const observed=await wc.executeJavaScript(`globalThis.__mouse630WheelEvents.slice(${start})`);assert.ok(observed.length>0);assert.ok(observed.every(event=>event.isTrusted===true));facts.observed.push({case:label,webContentsId:wc.id,events:observed});report.stage='complete';return{before,packetIndex,observed};
  }catch(error){
   report.error={message:error.message,stage:report.stage};
   if(native){try{report.failureNative=native();}catch(diagnosticError){report.diagnosticErrors.push({stage:'failure native snapshot',message:String(diagnosticError.message).slice(0,500)});}}
   if(read){try{report.failure=await wheelPreparationBudget({timeoutMs:1000}).run(read,'failure target snapshot');}catch(diagnosticError){report.diagnosticErrors.push({stage:'failure snapshot',message:String(diagnosticError.message).slice(0,500)});}}
   throw error;
  }finally{report.finishedAt=performance.now();}
 }
 async function settled(target){await until(()=>js(`!MouseTest.model.switching&&!MouseTest.desktopUI.gesture.diagnostics().running&&MouseTest.model.desktopId===${JSON.stringify(target)}`),'adjacent desktop '+target+' settles');return current();}
 // Resolve the selector's actual point only after native placement/focus is ready.
 function point(_wc,selector){return{selector};}
 async function openPage(targetBrowser,desk,url){
  await js(`MouseTest.switchDesktop(${JSON.stringify(desk)})`);await js(`MouseTest.changeLayout(1);MouseTest.model.aiOpen=false;MouseTest.model.agentOpen=false;MouseTest.applySide();MouseTest.openPage(${JSON.stringify(url)})`);const id=await js('MouseTest.model.slots[MouseTest.model.active]');let page;await until(()=>{page=targetBrowser.tabs.get(id);return page?.visible&&!page.loading;},'wheel fixture page is native and visible');return page;
 }
 try{
  win.webContents.send=function(channel,...args){if(channel===EVENT)facts.packets.push({at:Date.now(),channel,packet:structuredClone(args[0])});return send.call(this,channel,...args);};
  server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>Mouse630 native wheel fixture</title><style>html,body{margin:0;background:#e8edf4;color:#25354c;font:16px sans-serif}body{min-height:3200px;padding:24px;box-sizing:border-box}#horizontal{width:240px;height:110px;overflow:auto;background:#c9d8ee}#wide{width:1800px;height:80px;background:linear-gradient(90deg,#3268a8,#50a16a)}#plain{position:fixed;right:25px;top:210px;width:260px;height:160px;background:#d7e8d9}#claimed{width:240px;height:80px;margin-top:25px;background:#ead7c2}#editor{width:220px;height:60px;margin-top:20px;background:white}</style><h1>Local wheel fixture</h1><div id="horizontal"><div id="wide">Horizontal content remains scrollable.</div></div><div id="claimed">This element consumes wheel input.</div><div id="editor" contenteditable="true">Editable content</div><div id="plain">Horizontal gesture here switches the Mouse desktop.</div><script>window.fixtureIdentity=Math.random();document.getElementById("claimed").addEventListener("wheel",event=>event.preventDefault(),{passive:false})</script>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root='http://127.0.0.1:'+server.address().port;
  for(const desk of desks)made.push({desk,page:await openPage(browser,desk,root+'/'+desk)});
  await js(`MouseTest.switchDesktop(${JSON.stringify(desks[0])})`);await settled(desks[0]);let page=made[0].page,wc=page.view.webContents;
  const beforeVertical=await wc.executeJavaScript('scrollY'),vertical=await burst('verticalPage',wc,await point(wc,'#plain'),{axis:'y',amount:50,precise:false});await until(()=>wc.executeJavaScript(`scrollY>${beforeVertical}`),'ordinary vertical page scroll');const afterVertical=await wc.executeJavaScript('scrollY'),verticalAfter=await current();assert.equal(verticalAfter.desktopId,desks[0]);assert.equal(facts.packets.length,vertical.packetIndex);facts.cases.verticalPage={...packetRange(vertical),after:verticalAfter,beforeScrollY:beforeVertical,afterScrollY:afterVertical};
  await wc.executeJavaScript('scrollTo(0,0)');await sleep(150);const horizontalBefore=await wc.executeJavaScript('document.querySelector("#horizontal").scrollLeft'),horizontal=await burst('horizontalScroller',wc,await point(wc,'#horizontal'),{amount:55});await until(()=>wc.executeJavaScript(`document.querySelector('#horizontal').scrollLeft>${horizontalBefore}`),'nested horizontal content scroll');const horizontalAfter=await wc.executeJavaScript('document.querySelector("#horizontal").scrollLeft');assert.equal((await current()).desktopId,desks[0]);assert.equal(facts.packets.length,horizontal.packetIndex);facts.cases.horizontalScroller={...packetRange(horizontal),after:await current(),beforeScrollLeft:horizontalBefore,afterScrollLeft:horizontalAfter};
  const claimed=await burst('pageHandledWheel',wc,await point(wc,'#claimed'),{amount:55});assert.equal((await current()).desktopId,desks[0]);assert.equal(facts.packets.length,claimed.packetIndex);assert.ok(claimed.observed.some(event=>event.defaultPrevented));facts.cases.pageHandledWheel={...packetRange(claimed),after:await current()};
  const editor=await burst('contentEditable',wc,await point(wc,'#editor'),{amount:55});assert.equal((await current()).desktopId,desks[0]);assert.equal(facts.packets.length,editor.packetIndex);facts.cases.contentEditable={...packetRange(editor),after:await current()};
  const forgedBefore=await current(),forgedPackets=facts.packets.length;await wc.executeJavaScript('(()=>{const target=document.querySelector("#plain");for(let i=0;i<6;i++)target.dispatchEvent(new WheelEvent("wheel",{bubbles:true,cancelable:true,deltaX:80,deltaY:0}));})()');await sleep(200);const forgedAfter=await current();assert.equal(forgedAfter.desktopId,forgedBefore.desktopId);assert.equal(facts.packets.length,forgedPackets);facts.cases.forgedDOM={before:forgedBefore,after:forgedAfter,packetIndex:forgedPackets,packetEndIndex:facts.packets.length,packetCount:facts.packets.length-forgedPackets,observed:await wc.executeJavaScript('globalThis.__mouse630WheelEvents.slice(-6)')};assert.ok(facts.cases.forgedDOM.observed.every(event=>event.isTrusted===false));
  const closed=await burst('closedPage',wc,await point(wc,'#plain'),{count:8});const closedAfter=await settled(desks[1]);assert.equal(closed.before.noraOpen,false);assert.equal(closedAfter.noraOpen,false);assert.equal(facts.packets.length-closed.packetIndex,1,'One gesture burst changes one desktop');assert.equal(facts.packets.at(-1).packet.surface,'page');assert.equal(facts.packets.at(-1).packet.tabId,page.id);facts.cases.closedPage={...packetRange(closed),after:closedAfter};facts.cases.duplicateBurst={before:closed.before,after:closedAfter,packetCount:facts.packets.length-closed.packetIndex,inputCount:8};
  const control=await burst('shellControl',win.webContents,await point(win.webContents,'#desktops-button'),{axis:'y',direction:-1,amount:80,count:1,precise:false}),controlAfter=await settled(desks[0]);assert.equal(controlAfter.noraOpen,false);assert.equal(facts.packets.at(-1).packet.surface,'control');assert.equal(facts.packets.at(-1).packet.gesture.axis,'y');facts.cases.shellControl={...packetRange(control),after:controlAfter};
  const boundary=await burst('boundary',made[0].page.view.webContents,await point(made[0].page.view.webContents,'#plain'),{direction:-1});await sleep(200);const boundaryAfter=await current();assert.equal(boundaryAfter.desktopId,desks[0]);assert.equal(facts.packets.length,boundary.packetIndex);facts.cases.boundary={...packetRange(boundary),after:boundaryAfter};
  // The normal gestures above legitimately complete first-use learning. Freeze
  // the privacy baseline only after that real completion and its persisted write.
  assert.equal(closedAfter.gesture.learned,true);assert.equal(closedAfter.gesture.lastResult?.completed,true);assert.equal(closedAfter.gesture.lastResult.id,facts.packets[closed.packetIndex].packet.id);
  await store.queue;const normalLearned=structuredClone((await store.get(KEY))[KEY]);facts.normalLearning.beforePrivate=normalLearned??null;facts.normalLearning.pageResult=closedAfter.gesture.lastResult;assert.equal(normalLearned?.completed,true);
  await privateMode.toggle();await until(()=>js('document.documentElement.dataset.mouseReady==="true"'),'private renderer ready');const privateContext=privateMode.current,privateDesks=privateContext.desktopService.bank.items.slice(0,2).map(item=>item.id),privatePage=await openPage(privateContext.browser,privateDesks[0],root+'/private'),privateWC=privatePage.view.webContents;
  const privateInput=await burst('privateClosedPage',privatePage.view.webContents,await point(privatePage.view.webContents,'#plain'),{count:4}),privateAfter=await settled(privateDesks[1]);assert.equal(privateAfter.noraOpen,false);assert.equal(facts.packets.at(-1).packet.tabId,privatePage.id);await store.queue;
  const normalDuringPrivate=(await store.get(KEY))[KEY],privatePersisted=(await privateContext.store.get(KEY))[KEY];facts.cases.privateClosedPage={...packetRange(privateInput),after:privateAfter,normalPersisted:normalDuringPrivate,privatePersisted:privatePersisted??null};assert.deepEqual(normalDuringPrivate,normalLearned);assert.equal(privatePersisted,undefined);
  await privateMode.toggle();await until(()=>js('document.documentElement.dataset.mouseReady==="true"'),'normal renderer restored');assert.equal((await current()).desktopId,desks[0]);await until(()=>privateWC.isDestroyed(),'private native WebContents destroyed');await store.queue;facts.privacy={normalInitial:normalLearnedInitial??null,normalBefore:normalLearned??null,normalAfter:(await store.get(KEY))[KEY]??null,privateDisposed:{storeDestroyed:privateContext.store.destroyed,tabCount:privateContext.browser.tabs.size,webContentsDestroyed:privateWC.isDestroyed()}};assert.deepEqual(facts.privacy.normalAfter,facts.privacy.normalBefore);assert.equal(facts.privacy.privateDisposed.storeDestroyed,true);assert.equal(facts.privacy.privateDisposed.tabCount,0);
  await fs.writeFile('mouse-630-wheel-desktops.png',(await win.capturePage()).toPNG());facts.capture={file:'mouse-630-wheel-desktops.png',source:'BrowserWindow.capturePage'};
  console.log('MOUSE_630_NATIVE_WHEEL_DESKTOPS_PASS');console.log('MOUSE_630_PAGE_SCROLL_PRESERVED_PASS');
 }catch(error){failed=error;facts.error={message:error.message,stack:error.stack};await fs.writeFile('mouse-630-wheel-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});throw error;}
 finally{
  try{
   if(privateMode.current)await privateMode.toggle();win.webContents.send=send;await js('MouseTest.desktopUI.close({immediate:true})');
   for(const {desk,page}of made){if(!browser.tabs.has(page.id))continue;await js(`MouseTest.switchDesktop(${JSON.stringify(desk)})`);await browser.command('close',{id:page.id});}
   await js('globalThis.MouseFlush?.()');Object.assign(bank,new(require('./mouse-desktops.cjs').DesktopBank)(savedBank,original.preferences));browser.emit();await js(`(async()=>{const initial=await MouseNative.init();Object.assign(MouseTest.model,${JSON.stringify(original.preferences)},{focusPane:${JSON.stringify(original.focusPane)},focusAI:${JSON.stringify(original.focusAI)},libraryOpen:${JSON.stringify(original.libraryOpen)}});MouseTest.model.state=initial.state;MouseTest.setTheme(${JSON.stringify(original.preferences.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();await MouseTest.save();MouseTest.requestLayout();})()`);await browser.save();await store.queue;
   assert.deepEqual(bank.snapshot(),savedBank);assert.deepEqual([...browser.tabs.keys()].sort(),[...originalPages.keys()].sort());for(const [id,originalPage]of originalPages){const currentPage=browser.get(id);assert.equal(currentPage,originalPage.page);assert.equal(currentPage.view.webContents,originalPage.wc);assert.equal(currentPage.view.webContents.getURL(),originalPage.url);}
   await js('if(globalThis.__mouse630WheelObserve){window.removeEventListener("wheel",globalThis.__mouse630WheelObserve);delete globalThis.__mouse630WheelObserve;delete globalThis.__mouse630WheelEvents;}');facts.restored=true;
  }catch(error){facts.cleanupError={message:error.message,stack:error.stack};if(!failed)throw error;}
  finally{win.webContents.send=send;server?.closeAllConnections();server?.close();await save();}
 }
};
module.exports.wheelPreparationBudget=wheelPreparationBudget;
module.exports.wheelTargetProblems=wheelTargetProblems;
module.exports.prepareWheelTarget=prepareWheelTarget;

