'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label)}
function basicsInputBudget({timeoutMs=12000,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const startedAt=now(),deadlineAt=startedAt+timeoutMs;let expired=false;
 const check=label=>{if(expired||now()>=deadlineAt){expired=true;throw Error('Mouse630 basics readiness timeout: '+label);}};
 async function run(operation,label){let timer;check(label);try{const value=await Promise.race([Promise.resolve().then(()=>{check(label);return operation();}),new Promise((_,reject)=>{timer=setTimer(()=>{expired=true;reject(Error('Mouse630 basics readiness timeout: '+label));},Math.max(1,Math.ceil(deadlineAt-now())));})]);check(label);return value;}finally{clearTimer(timer);}}
 async function wait(predicate,label){for(;;){if(await run(predicate,label))return;await run(()=>new Promise(resolve=>setTimer(resolve,25)),label);}}
 return{startedAt,deadlineAt,timeoutMs,run,wait,check};
}
function basicsInputProblems(snapshot,{timeOrigin,targetToken,inputFocused=false}={}){
 const {native,dom,nativeBefore}=snapshot,problems=[];
 if(native.destroyed||!native.contentsMatches||!native.browserMatchesWindow)problems.push('identity:WebContents');
 if(timeOrigin!==undefined&&dom.timeOrigin!==timeOrigin)problems.push('identity:document');
 if(targetToken!==undefined&&dom.target.token!==targetToken)problems.push('identity:target');
 if(!native.window.visible||!native.window.focused||native.window.minimized||!native.contentsFocused||!dom.focused)problems.push('native/document focus');
 if(native.loading||dom.readyState!=='complete'||dom.visibilityState!=='visible')problems.push('document readiness');
 if(!dom.target.connected||!dom.point.ready)problems.push('exposed target');
 if(inputFocused&&!dom.target.active)problems.push('address input focus');
 if(nativeBefore&&(nativeBefore.destroyed||!nativeBefore.contentsMatches||!nativeBefore.browserMatchesWindow||JSON.stringify(nativeBefore.window.contentBounds)!==JSON.stringify(native.window.contentBounds)))problems.push('window changed during observation');
 return problems;
}
async function waitBasicsInput({budget,report,read,label,pin={},condition=()=>true}){
 let previous=null;
 await budget.wait(async()=>{
  const value=await read();budget.check(label);report.last=value;report.samples=(report.samples||0)+1;report.waitingFor=basicsInputProblems(value,pin);
  if(report.waitingFor.some(reason=>reason.startsWith('identity:')))throw Error('Mouse630 basics input identity changed: '+report.waitingFor.join(', '));
  if(report.waitingFor.length||!condition(value)){previous=null;return false;}
  const geometry=JSON.stringify([value.native.window.contentBounds,value.dom.timeOrigin,value.dom.target.token,value.dom.target.bounds,value.dom.point,value.native.panels]);
  const stable=geometry===previous;previous=geometry;return stable;
 },label);
 report.ready=report.last;return report.ready;
}
async function prepareBasicsClick({budget,report,read,focusWindow,windowReady,focusContents,prepareTarget}){
 report.before=await budget.run(read,'initial click target');
 await budget.run(focusWindow,'focus click window');await budget.wait(windowReady,'click window focused');
 await budget.run(focusContents,'focus shell WebContents');
 const ready=await waitBasicsInput({budget,report,read,label:'stable native click target',pin:{timeOrigin:report.before.dom.timeOrigin}});
 if(!prepareTarget)return ready;
 report.beforePreparation=ready;report.preparation=await budget.run(prepareTarget,'prepare address starting state');
 return waitBasicsInput({budget,report,read,label:'prepared native click target',pin:{timeOrigin:ready.dom.timeOrigin,targetToken:ready.dom.target.token}});
}
function resetBasicsAddressHints(){
 const input=document.querySelector('.pane.active input'),pop=document.querySelector('#address-suggestions');if(!input)throw Error('Mouse630 basics address input missing');
 const state=()=>({active:document.activeElement===input,popupOpen:pop.matches(':popover-open'),connected:input.isConnected});
 const before=state();MouseTest.browsing.hideHints();if(document.activeElement===input)input.blur();return{before,after:state()};
}
function freshBasicsSuggestions(snapshot,initial){
 const {dom}=snapshot;
 return dom.target.queryMatches&&dom.target.expanded&&dom.popup.open&&dom.popup.generation>initial.generation&&dom.popup.rows.length>0&&dom.popup.rows.every(id=>!initial.rows.includes(id));
}
function observeBasicsNavigation({contents,readNative,input,expectedURL,report,now=()=>performance.now()}){
 let stopped=false;const listeners=[],before=readNative();
 Object.assign(report,{pageBefore:before,expectedURL,receipts:[],receiptCount:0,truncatedReceipts:0});
 const identity=s=>!s.destroyed&&s.pageMatches&&s.contentsMatches&&s.contextMatches&&s.id===before.id&&s.webContentsId===before.webContentsId&&s.project===before.project;
 const sent=()=>{const event=input();if(event?.type==='keyDown'&&event.keyCode==='Return'&&Number.isFinite(event.at)){report.input={...event};return event;}return null;};
 function receive(event,detail={}){
  if(stopped)return;
  const at=now(),native=readNative(),row={event,at,...detail,native};report.receiptCount++;if(report.receipts.length<32)report.receipts.push(row);else report.truncatedReceipts++;
  const marker=sent();if(!marker||at<marker.at)return;
  if(!identity(native)){report.navigationFailure={reason:'navigation identity changed',receipt:row};return;}
  if(event==='did-start-navigation'&&detail.mainFrame&&!detail.inPlace){
   if(detail.url!==expectedURL||native.epoch<=before.epoch||report.start){report.navigationFailure={reason:'unexpected main-frame navigation',receipt:row};return;}
   report.start=row;
  }else if(event==='did-finish-load'&&report.start&&at>=report.start.at&&native.epoch===report.start.native.epoch){report.finish=row;}
  else if(event==='did-fail-load'&&detail.mainFrame&&report.start&&native.epoch===report.start.native.epoch){report.navigationFailure={reason:'main-frame load failed',receipt:row};}
 }
 const on=(name,fn)=>{contents.on(name,fn);listeners.push([name,fn]);};
 on('did-start-navigation',(_e,url,inPlace,mainFrame)=>receive('did-start-navigation',{url,inPlace:!!inPlace,mainFrame:!!mainFrame}));
 on('did-finish-load',()=>receive('did-finish-load'));
 on('did-fail-load',(_e,code,description,url,mainFrame)=>receive('did-fail-load',{code,description,url,mainFrame:!!mainFrame}));
 return{snapshot(){sent();return readNative();},identity,failure(error){if(report.failure)return;report.failure={at:now(),message:error.message};try{report.failure.page=readNative();sent();}catch(e){report.failure.snapshotError=String(e.message).slice(0,500);}},stop(){if(stopped)return;stopped=true;for(const[name,fn]of listeners)contents.removeListener(name,fn);report.stoppedAt=now();}};
}
async function waitBasicsNavigation({budget,observer,report,read,pin}){
 try{
  await budget.wait(async()=>{
   const before=observer.snapshot();report.lastPageBeforeDOM=before;const value=await read();budget.check('address submission completed');const page=observer.snapshot();
   const sample={...value,pageBefore:before,page};report.last=sample;report.samples=(report.samples||0)+1;const waiting=[];report.waitingFor=waiting;
   if(!observer.identity(before)||!observer.identity(page)||value.native.destroyed||!value.native.contentsMatches||!value.native.browserMatchesWindow||value.native.webContentsId!==pin.shellWebContentsId||value.dom.timeOrigin!==pin.timeOrigin||value.dom.target.token!==pin.targetToken||!value.dom.target.connected||value.dom.context?.desktopId!==pin.desktopId||value.dom.context?.pane!==pin.pane||value.dom.context?.pageId!==pin.pageId)throw Error('Mouse630 basics submission identity changed');
   if(report.navigationFailure)throw Error('Mouse630 basics submission failed: '+report.navigationFailure.reason);
   if(page.error)throw Error('Mouse630 basics submission page failed: '+page.error);
   if(!report.input||!report.start||!report.finish)waiting.push('new main-frame navigation receipt');
   else if(page.epoch!==report.finish.native.epoch||before.epoch!==page.epoch)throw Error('Mouse630 basics submission navigation epoch changed');
   if(before.url!==report.expectedURL||page.url!==report.expectedURL||before.loading||page.loading)waiting.push('completed expected page');
   if(value.dom.target.active)waiting.push('natural address blur');
   if(value.dom.popup.open)waiting.push('accepted suggestion closed');
   return waiting.length===0;
  },'address submission completed');
  report.ready=report.last;return report.ready;
 }catch(error){observer.failure(error);throw error;}finally{observer.stop();}
}
// Serialized into the shell. Only observe events/row identity; never focus,
// click, choose a suggestion, or change the application's hint lifecycle.
function installBasicsInputObserver(hitTarget){
 const key='__mouse630BasicsInput';globalThis[key]?.stop();
 const pop=document.querySelector('#address-suggestions'),tokens=new WeakMap(),events=[],renders=[],listeners=[];let serial=0,generation=0,truncated=0,address=null;
 const token=e=>{if(!e)return null;if(!tokens.has(e))tokens.set(e,++serial);return tokens.get(e);};
 const describe=e=>e?{token:token(e),tag:String(e.tagName||'').toLowerCase(),id:String(e.id||'').slice(0,80),pane:e.closest?.('.pane')?.dataset.pane||null}:null;
 const rows=()=>[...pop.children].map(token),selected=()=>[...pop.querySelectorAll('[aria-selected=true]')].map(token);
 function changed(records){if(!records.some(record=>record.type==='childList'&&record.target===pop))return;generation++;if(renders.length<64)renders.push({at:performance.now(),generation,rows:rows(),selected:selected(),focused:document.hasFocus(),addressActive:document.activeElement===address,queryMatches:address?.value==='visited-alpha'});}
 const observer=new MutationObserver(changed);observer.observe(pop,{childList:true});
 const drain=()=>changed(observer.takeRecords());
 function record(event,phase){drain();if(events.length>=256){truncated++;return;}events.push({at:performance.now(),type:event.type,phase,isTrusted:event.isTrusted,key:String(event.key||'').slice(0,32),defaultPrevented:event.defaultPrevented,target:describe(event.target),active:describe(document.activeElement),focused:document.hasFocus(),generation,selected:selected()});}
 for(const type of ['pointerdown','pointerup','click','focusin','focusout','input','keydown','keyup'])for(const capture of (type.startsWith('key')?[true,false]:[true])){const fn=e=>record(e,capture?'capture':'bubble');window.addEventListener(type,fn,capture);listeners.push([type,fn,capture]);}
 const api={snapshot(selector){
  drain();const e=document.querySelector(selector),r=e?.getBoundingClientRect(),model=globalThis.MouseTest?.model,pane=e?.closest?.('.pane')?.dataset.pane||null;if(selector==='.pane.active input'&&!address)address=e;
  return{at:performance.now(),timeOrigin:performance.timeOrigin,readyState:document.readyState,visibilityState:document.visibilityState,focused:document.hasFocus(),context:model?{desktopId:model.desktopId,pane,pageId:model.slots[pane]||null}:null,active:describe(document.activeElement),target:{...describe(e),connected:!!e?.isConnected,active:e===document.activeElement,queryMatches:e?.value==='visited-alpha',expanded:e?.getAttribute('aria-expanded')==='true',bounds:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null},point:hitTarget(e),popup:{open:pop.matches(':popover-open'),generation,rows:rows(),selected:selected()},events:[...events],renders:[...renders],truncated};
 },stop(){observer.disconnect();for(const [type,fn,capture]of listeners)window.removeEventListener(type,fn,capture);delete globalThis[key];}};
 globalThis[key]=api;
}
module.exports=async({app,win,browser,libraryService})=>{
 const wc=win.webContents,js=s=>wc.executeJavaScript(s),lib=libraryService.library;
 const facts={version:app.getVersion(),source:'webContents.sendInputEvent via Chromium; no key or click retries',clock:'node performance.now() milliseconds; DOM timestamps use performance.timeOrigin',steps:[],inputs:[],diagnosticErrors:[],completed:false};let selector='.pane.active input';
 const native=()=>({at:performance.now(),webContentsId:wc.id,destroyed:wc.isDestroyed(),contentsMatches:wc===win.webContents,browserMatchesWindow:browser.win===win,contentsFocused:!wc.isDestroyed()&&wc.isFocused(),loading:!wc.isDestroyed()&&wc.isLoadingMainFrame(),window:{visible:win.isVisible(),focused:win.isFocused(),minimized:win.isMinimized(),contentBounds:{...win.getContentBounds()}},panels:browser.panels.map(p=>({id:p.id,x:p.x,y:p.y,width:p.width,height:p.height,clip:p.clip?{...p.clip}:null})),pages:[...browser.tabs.values()].filter(p=>p.visible).map(p=>({id:p.id,webContentsId:p.view.webContents.id,focused:p.view.webContents.isFocused(),viewVisible:p.view.getVisible?.()??null,viewBounds:{...p.view.getBounds()},clipVisible:p.clipView?.getVisible?.()??null,rootBounds:{...(p.clipView||p.view).getBounds()},rootAttached:win.contentView.children.includes(p.clipView||p.view)}))});
 const read=async(target,report)=>{const before=native();if(report)report.lastNativeBeforeDOM=before;const dom=await js(`globalThis.__mouse630BasicsInput.snapshot(${JSON.stringify(target)})`);return{nativeBefore:before,native:native(),dom};};
 const step=(label,budget)=>{const report={label,startedAt:budget.startedAt,deadlineAt:budget.deadlineAt,timeoutMs:budget.timeoutMs,samples:0};facts.steps.push(report);return report;};
 const send=event=>{facts.inputs.push({at:performance.now(),...event});wc.sendInputEvent(event);};
 const click=async target=>{
  selector=target;const budget=basicsInputBudget(),report=step('click '+target,budget);
  const ready=await prepareBasicsClick({budget,report,read:()=>read(target,report),focusWindow:()=>{app.focus({steal:true});win.show();win.focus();},windowReady:()=>win.isVisible()&&win.isFocused()&&!win.isMinimized(),focusContents:()=>wc.focus(),prepareTarget:target==='.pane.active input'?()=>js(`(${resetBasicsAddressHints.toString()})()`):undefined});
  const p={x:ready.dom.point.x,y:ready.dom.point.y};send({type:'mouseMove',...p});send({type:'mouseDown',...p,button:'left',clickCount:1});send({type:'mouseUp',...p,button:'left',clickCount:1});await sleep(130);return{budget,ready};
 };
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/download')){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="mouse-fixture.bin"','Content-Length':262144});let count=0;const t=setInterval(()=>{res.write(Buffer.alloc(8192,42));if(++count===32){clearInterval(t);res.end()}},60);res.on('close',()=>clearInterval(t));return}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Library Alpha fixture</title><h1>Local browser history fixture</h1><input value="not-recorded">');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 const destination=path.join(app.getPath('userData'),'mouse-download-fixture.bin');
 const setPath=(_e,item)=>{if(item.getURL().startsWith(root+'/download'))item.setSavePath(destination)};
 browser.session.prependListener('will-download',setPath);
 try{
  await basicsInputBudget().run(()=>js(`(${installBasicsInputObserver.toString()})(${nativeHitTarget.toString()})`),'install basics input observer');
  await js(`MouseTest.openPage(${JSON.stringify(root+'/visited-alpha')})`);await until(()=>lib.data.history.some(x=>x.url===root+'/visited-alpha'),'real navigation in history');
  require('electron').Menu.getApplicationMenu().items.find(x=>x.label==='История').submenu.items.find(x=>x.label==='Добавить закладку').click();await until(()=>lib.data.bookmarks.length>0,'bookmark from retained native menu');
  const address=await click('.pane.active input'),pin={timeOrigin:address.ready.dom.timeOrigin,targetToken:address.ready.dom.target.token,inputFocused:true};facts.addressPin={webContentsId:wc.id,...pin};
  // Drain the initial focus suggestion before changing the query. An already
  // open popup alone cannot prove that the later input debounce has rendered.
  const initialReport=step('initial focus suggestions',address.budget),initial=await waitBasicsInput({budget:address.budget,report:initialReport,read:()=>read(selector,initialReport),label:'initial focus suggestions completed',pin,condition:s=>s.dom.popup.open&&s.dom.popup.rows.length>0&&s.dom.target.expanded});
  facts.initialSuggestions={generation:initial.dom.popup.generation,rows:initial.dom.popup.rows};
  await address.budget.run(()=>js(`(()=>{const e=document.querySelector('.pane.active input');e.value='visited-alpha';e.dispatchEvent(new Event('input',{bubbles:true}))})()`),'enter address query');
  const fresh=s=>freshBasicsSuggestions(s,facts.initialSuggestions);
  const freshReport=step('fresh query suggestions',address.budget);await waitBasicsInput({budget:address.budget,report:freshReport,read:()=>read(selector,freshReport),label:'new query suggestion rows',pin,condition:fresh});
  await until(()=>js('document.querySelector("#address-suggestions").matches(":popover-open")'),'address suggestion popup');
  assert.ok(await js('document.querySelector("#address-suggestions").textContent.includes("visited-alpha")'));
  await until(()=>browser.panels.some(p=>p.clip),'native pages clipped below suggestions');
  // After the real address click, observe retained focus only. Re-focusing here
  // would conceal focus loss caused by the application's clipping/reparenting.
  const downReport=step('before Down',address.budget);await waitBasicsInput({budget:address.budget,report:downReport,read:()=>read(selector,downReport),label:'retained address focus before Down',pin,condition:fresh});
  // sendInputEvent requires Accelerator key codes (Down), not DOM names (ArrowDown).
  send({type:'keyDown',keyCode:'Down'});send({type:'keyUp',keyCode:'Down'});
  await until(()=>js('!!document.querySelector("#address-suggestions [aria-selected=true]")'),'keyboard suggestion selected');
  const returnBudget=basicsInputBudget(),returnReport=step('before Return',returnBudget);await waitBasicsInput({budget:returnBudget,report:returnReport,read:()=>read(selector,returnReport),label:'retained address focus before Return',pin,condition:s=>fresh(s)&&s.dom.popup.selected.length>0});
  const context=returnReport.ready.dom.context,submissionPage=browser.tabs.get(context.pageId),pageContents=submissionPage?.view.webContents;assert.ok(pageContents&&!pageContents.isDestroyed(),'Return submits the pinned native page');
  const project=browser.project,returnIndex=facts.inputs.length,navigation=facts.navigation={startedAt:returnBudget.startedAt,deadlineAt:returnBudget.deadlineAt,timeoutMs:returnBudget.timeoutMs,before:returnReport.ready,samples:0,pin:{shellWebContentsId:wc.id,timeOrigin:pin.timeOrigin,targetToken:pin.targetToken,...context}};
  const pageState=()=>({id:submissionPage.id,webContentsId:pageContents.id,project:submissionPage.project,pageMatches:browser.tabs.get(submissionPage.id)===submissionPage,contentsMatches:submissionPage.view.webContents===pageContents,contextMatches:browser.project===project&&submissionPage.project===project,destroyed:pageContents.isDestroyed(),epoch:submissionPage.navigationEpoch||0,url:pageContents.isDestroyed()?'':pageContents.getURL(),loading:pageContents.isDestroyed()||pageContents.isLoadingMainFrame()||submissionPage.loading,error:submissionPage.error||''});
  returnBudget.check('arm address navigation');const submission=observeBasicsNavigation({contents:pageContents,readNative:pageState,input:()=>facts.inputs[returnIndex],expectedURL:root+'/visited-alpha',report:navigation});
  try{
   returnBudget.check('submit address');
   send({type:'keyDown',keyCode:'Return'});send({type:'keyUp',keyCode:'Return'});
   await until(()=>js('!document.querySelector("#address-suggestions").matches(":popover-open")'),'suggestion accepted');
   // choose() hides the popup before its async form submission completes.
   // Observe the new real load and natural input blur before the next click
   // prepares shell focus; never repair focus while submission is in flight.
   await waitBasicsNavigation({budget:returnBudget,observer:submission,report:navigation,read:()=>read(selector,navigation),pin:navigation.pin});
  }catch(error){submission.failure(error);throw error;}finally{submission.stop();}
  await click('#history-button');await until(()=>js('document.querySelector("#library-dialog").open'),'history UI');assert.ok(await js('document.querySelector("#library-rows").textContent.includes("visited-alpha")'));await click('#library-close');
  await until(()=>js('!document.querySelector("#library-dialog").open'),'history sidebar closed');
  await until(()=>[...browser.tabs.values()].some(t=>t.visible&&t.lane!=='side'&&!t.view.webContents.isDestroyed()),'native page restored after history close');
  console.log('MOUSE_HISTORY_BOOKMARKS_ADDRESS_SUGGESTIONS_PASS');
  const page=[...browser.tabs.values()].find(t=>t.visible&&t.lane!=='side');assert.ok(page,'download starts from a restored live webpage');page.view.webContents.downloadURL(root+'/download');
  await until(()=>lib.data.downloads.some(x=>x.state==='progressing'&&x.received>0),'real download progress');const id=lib.data.downloads[0].id;
  await js(`MouseNative.library('download',{id:${JSON.stringify(id)},action:'pause'})`);assert.equal(lib.data.downloads[0].state,'paused');
  await js(`MouseNative.library('download',{id:${JSON.stringify(id)},action:'resume'})`);await until(()=>lib.data.downloads.find(x=>x.id===id)?.state==='completed','real download completed');
  assert.equal((await fs.readFile(destination)).length,262144);
  await click('#downloads-button');await until(()=>js('document.querySelector("#library-dialog").open'),'downloads UI');assert.ok(await js('document.querySelector("#library-rows").textContent.includes("mouse-fixture.bin")'));await click('#library-close');
  await js(`MouseNative.library('remove',{kind:'downloads',id:${JSON.stringify(id)}})`);assert.ok((await fs.stat(destination)).isFile(),'Removing list entry never deletes file');
  console.log('MOUSE_DOWNLOAD_PROGRESS_PAUSE_RESUME_FILE_PASS');
  for(const fullscreen of [false,true]){
   if(fullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'fullscreen screenshot setup');await sleep(800)}
   await click('#screenshot-button');await until(()=>js('MouseTest.capture.isOpen()'),'open screenshot via camera');
   assert.equal(await js('getComputedStyle(document.querySelector(".toolbar")).webkitAppRegion'),'no-drag');
   await click('#capture-close');await until(()=>js('!MouseTest.capture.isOpen()&&!document.querySelector("#capture-dialog").open'),'actual screenshot X');await until(()=>browser.panels.length>1,'panes restored after screenshot X');
   if(fullscreen)await require('./mouse-lifecycle.cjs').leaveFullscreen(win);
  }
  console.log('MOUSE_SCREENSHOT_X_REAL_CLICK_NORMAL_FULLSCREEN_PASS');
  lib.bookmark(root+'/persistent','Library persistence fixture');lib.input('mouse persistent search','https://www.google.com/search?q=mouse%20persistent%20search');await libraryService.flush();
  await js('MouseTest.browsing.hideHints()');
  await fs.writeFile('mouse-603-browser.png',(await win.capturePage()).toPNG());
  facts.completed=true;
 }catch(error){
  facts.error={message:error.message,stack:error.stack};
  // Keep synchronous native state even when the renderer's diagnostic read hangs.
  try{facts.failureNative=native();}catch(e){facts.diagnosticErrors.push({stage:'failure native',message:String(e.message).slice(0,500)});}
  try{facts.failure=await basicsInputBudget({timeoutMs:1000}).run(()=>read(selector),'failure input snapshot');}catch(e){facts.diagnosticErrors.push({stage:'failure renderer',message:String(e.message).slice(0,500)});}
  throw error;
 }finally{
  if(!facts.failure)try{facts.final=await basicsInputBudget({timeoutMs:1000}).run(()=>read(selector),'final input snapshot');}catch(e){facts.diagnosticErrors.push({stage:'final snapshot',message:String(e.message).slice(0,500)});}
  try{await basicsInputBudget({timeoutMs:1000}).run(()=>js('globalThis.__mouse630BasicsInput?.stop()'),'remove basics observers');}catch(e){facts.diagnosticErrors.push({stage:'observer cleanup',message:String(e.message).slice(0,500)});}
  facts.finishedAt=performance.now();
  try{await basicsInputBudget({timeoutMs:1000}).run(()=>fs.writeFile('mouse-630-basics-input.json',JSON.stringify(facts,null,2)+'\n'),'save basics input diagnostic');}catch(e){console.error('Mouse630 basics diagnostic:',e.message);}
  browser.session.removeListener('will-download',setPath);await new Promise(r=>server.close(r));
 }
};
Object.assign(module.exports,{basicsInputBudget,basicsInputProblems,waitBasicsInput,prepareBasicsClick,resetBasicsAddressHints,freshBasicsSuggestions,observeBasicsNavigation,waitBasicsNavigation,installBasicsInputObserver});
