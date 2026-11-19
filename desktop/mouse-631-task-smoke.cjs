'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const {ipcMain}=require('electron');
const {createFixture,pageHTML,bounded,sleep}=require('./mouse-631-smoke-helpers.cjs');

module.exports=async ctx=>{
 const facts={version:ctx.app.getVersion(),platform:process.platform,arch:process.arch,source:'real local page API and opted-in DOM through packaged isolated preload',budgetMs:65000,observations:{},themes:[],events:[],restored:false,ok:false};
 const save=()=>fs.writeFile('mouse-631-task.json',JSON.stringify(facts,null,2)+'\n');
 let fixture,server,verificationError,cleanupError,released=false;const heldImages=[];
 const activity=(event,value)=>{
  const record=fixture?.created.find(record=>record.before?.webContentsId===event.sender.id);if(!record||facts.events.length>=128)return;
  const {active,kind,taskId,phase,percent,statusText,etaSeconds}=value||{};facts.events.push({tabId:record.id,webContentsId:event.sender.id,mainFrame:event.senderFrame===event.sender.mainFrame,active,kind,taskId,phase,percent,statusText,etaSeconds});
 };
 const image=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64');
 function releaseImages(){released=true;for(const res of heldImages.splice(0))res.end(image);}
 try{
  fixture=await createFixture(ctx,'task',facts.budgetMs);ipcMain.on('mouse:page-activity',activity);
  const {browser,bank}=fixture,desk=bank.active,other=bank.items.find(item=>item.id!==desk).id;
  const state=()=>fixture.js('MouseNative.progress("state")');
  const ui=()=>fixture.js(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{sampledAt:Date.now(),theme:document.documentElement.dataset.theme,desk:MouseTest.model.desktopId,footer:rect(document.querySelector('#statusbar')),panes:[...document.querySelectorAll('.pane')].map(p=>{const dock=p.querySelector('.mouse-pane-progress'),node=dock&&[...dock.querySelectorAll('.mouse-progress-pill')].find(e=>!e.hidden&&e.getBoundingClientRect().width>0&&!dock.hidden),meter=node?.querySelector('[role=progressbar]');return{pane:p.dataset.pane,tabId:MouseTest.model.slots[p.dataset.pane]||'',header:rect(p.querySelector('.pane-head')),slot:rect(p.querySelector('.page-slot')),dock:dock?{hidden:dock.hidden,bounds:rect(dock)}:null,pill:node?{id:node.dataset.progressId,taskId:node.dataset.taskId,tabId:node.dataset.tabId,desk:node.dataset.desk,kind:node.dataset.kind,phase:node.dataset.phase,etaSeconds:node.dataset.etaSeconds,estimateUpdatedAt:node.dataset.estimateUpdatedAt,timeRenderedAt:node.dataset.timeRenderedAt,timeKind:node.dataset.timeKind,remainingSeconds:node.dataset.remainingSeconds,elapsedSeconds:node.dataset.elapsedSeconds,indeterminate:node.dataset.indeterminate,value:node.querySelector('.mouse-progress-value').textContent,label:node.querySelector('.mouse-progress-label').textContent,status:node.querySelector('.mouse-progress-status').textContent,title:node.title,ariaNow:meter.getAttribute('aria-valuenow'),ariaText:meter.getAttribute('aria-valuetext'),bounds:rect(node)}:null};})};})()`);
  const task=(snapshot,record,id)=>snapshot.tasks.find(value=>value.tabId===record.id&&value.taskId===id);
  const report=(record,percent,statusText,options)=>fixture.pageJS(record,`MouseAgent.updateProgress(${JSON.stringify(percent)},${JSON.stringify(statusText)},${JSON.stringify(options)})`);
  async function visible(record,id,percent,eta,phase='running'){
   let data;await fixture.until(async()=>{data=await ui();const pill=data.panes.find(pane=>pane.tabId===record.id)?.pill;return pill?.id===id&&pill.phase===phase&&pill.ariaNow===(percent===null?null:String(percent))&&pill.etaSeconds===(eta===null?'':String(eta));},'own task pill '+phase+' '+id,4000);return data;
  }
  server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/hold-image'){res.writeHead(200,{'Content-Type':'image/gif','Cache-Control':'no-store'});if(released)res.end(image);else heldImages.push(res);return;}
   if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
   const match=url.pathname.match(/^\/page\/(\d+)\/$/);if(!match){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(pageHTML(Number(match[1]),{slowImage:url.searchParams.has('slow')}));
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  // executeJavaScript intentionally waits for document loading to stop. The
  // pending-load assertion reads main/shell state before any page JS readback.
  const first=await fixture.open(base+'/page/0/?slow=1',0,{waitLoad:false,prepare:false}),second=await fixture.open(base+'/page/1/',1);await fixture.setLayout([first,second]);
  await fixture.until(()=>heldImages.length===1,'ordinary network request really remains pending');const ordinaryStart=performance.now();await sleep(800);
  const loading=await state(),loadingUI=await ui();assert.equal(first.page.loading,true);assert.deepEqual(loading.tasks,[]);assert.ok(loadingUI.panes.every(pane=>!pane.pill));
  facts.observations.ordinaryLoading={elapsedMs:performance.now()-ordinaryStart,networkPending:heldImages.length,loading:first.page.loading,state:loading,ui:loadingUI};
  releaseImages();await fixture.until(()=>!first.page.loading,'ordinary document load finishes');await fixture.preparePage(first);await sleep(350);
  const loaded=await state(),loadedUI=await ui();assert.deepEqual(loaded.tasks,[]);assert.ok(loadedUI.panes.every(pane=>!pane.pill));facts.observations.ordinaryLoaded={loading:first.page.loading,state:loaded,ui:loadedUI,capture:await fixture.captureContent('mouse-631-task-ordinary.png',[first,second])};await save();
  const reported=await report(first,37,'Building an owned index',{taskId:'site-api',phase:'running',etaSeconds:90});assert.equal(reported.percent,37);assert.equal(reported.etaSeconds,90);assert.equal(reported.tabId,first.id);assert.equal(reported.desk,desk);
  const dom=await fixture.pageJS(second,`(()=>{const e=document.createElement('progress');e.id='site-progress';e.max=200;e.value=128;e.setAttribute('data-mouse-task','site-dom');e.setAttribute('data-mouse-task-state','running');e.setAttribute('data-mouse-eta-seconds','45');e.setAttribute('aria-label','Producing an owned report');document.body.append(e);return{taskId:e.dataset.mouseTask,phase:e.dataset.mouseTaskState,etaSeconds:e.dataset.mouseEtaSeconds,value:e.value,max:e.max};})()`);
  let observed;await fixture.until(async()=>{observed=task(await state(),second,'site-dom');return observed?.percent===64&&observed.etaSeconds===45;},'opted-in DOM task passes owning IPC');assert.equal(observed.kind,'observed');assert.equal(observed.desk,desk);
  await visible(first,reported.id,37,90);await visible(second,observed.id,64,45);
  const etaBefore={at:performance.now(),state:await state(),ui:await ui()};await sleep(1250);
  await fixture.until(async()=>Number((await ui()).panes.find(pane=>pane.tabId===first.id).pill.remainingSeconds)<Number(etaBefore.ui.panes.find(pane=>pane.tabId===first.id).pill.remainingSeconds),'site-derived countdown advances without another report',2500);
  const etaAfter={at:performance.now(),state:await state(),ui:await ui()};
  assert.equal(task(etaAfter.state,first,'site-api').etaSeconds,90);assert.equal(task(etaAfter.state,second,'site-dom').etaSeconds,45);assert.equal(etaAfter.ui.panes.find(pane=>pane.tabId===first.id).pill.etaSeconds,'90');
  facts.observations.siteETA={reported,dom,observed,before:etaBefore,after:etaAfter};
  for(const theme of ['light','dark']){
   await fixture.js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await fixture.frame();const data=await visible(second,observed.id,64,45);
   assert.equal(data.theme,theme);assert.deepEqual(data.footer,loadedUI.footer);
   for(const [record,id,percent,eta]of [[first,reported.id,37,90],[second,observed.id,64,45]]){
    const pane=data.panes.find(pane=>pane.tabId===record.id);assert.equal(pane.pill.id,id);assert.equal(pane.pill.desk,desk);assert.equal(pane.pill.ariaNow,String(percent));assert.equal(pane.pill.etaSeconds,String(eta));assert.match(pane.pill.label,/оценка сайта/);assert.equal(pane.pill.timeKind,'eta');assert.ok(Number(pane.pill.remainingSeconds)>0&&Number(pane.pill.remainingSeconds)<=eta);assert.ok(pane.pill.title.includes(String(pane.pill.remainingSeconds)));
    assert.ok(Math.abs(pane.dock.bounds.y-(pane.header.y+pane.header.height))<=1);assert.ok(Math.abs(pane.slot.y-(pane.dock.bounds.y+pane.dock.bounds.height))<=1);assert.equal(pane.pill.value,percent+'%');
   }
   const regions=data.panes.filter(pane=>pane.pill).map(pane=>({label:theme+' actual '+pane.pill.value+' reported site ETA '+pane.pill.etaSeconds,bounds:pane.pill.bounds}));
   facts.themes.push({theme,state:await state(),ui:data,capture:await fixture.captureContent('mouse-631-task-'+theme+'.png',[first,second],{shellRegions:regions})});await save();
  }
  const zero=await report(first,37,'Site ETA is zero, task still running',{taskId:'site-api',etaSeconds:0});const zeroUI=await visible(first,reported.id,37,0);assert.equal(zero.phase,'running');assert.equal(zeroUI.panes.find(pane=>pane.tabId===first.id).pill.timeKind,'expired');facts.observations.zeroETA={task:zero,ui:zeroUI};
  const short=await report(first,37,'An estimate can expire before the result',{taskId:'site-api',etaSeconds:1}),shortUI=await visible(first,reported.id,37,1);await fixture.frame();const expiryLayoutBefore=browser.mouseLayoutCalls||0;
  let expiredUI;await fixture.until(async()=>{expiredUI=await ui();return expiredUI.panes.find(pane=>pane.tabId===first.id).pill.timeKind==='expired';},'site estimate expires without completing the actual task',3000);
  const expired=task(await state(),first,'site-api');assert.equal(expired.phase,'running');assert.equal(expired.percent,37);assert.equal(expired.etaSeconds,1);assert.equal(expiredUI.panes.find(pane=>pane.tabId===first.id).pill.remainingSeconds,'0');assert.equal((browser.mouseLayoutCalls||0)-expiryLayoutBefore,0,'Text-only estimate ticks never request native layout');
  facts.observations.expiredETA={task:short,before:shortUI,after:expiredUI,state:expired,layoutCalls:0};
  const unknown=await report(first,null,'Waiting for the site to report progress',{taskId:'site-api'}),unknownUI=await visible(first,reported.id,null,null);assert.equal(unknown.etaSeconds,null);const unknownPill=unknownUI.panes.find(pane=>pane.tabId===first.id).pill;assert.equal(unknownPill.value,'…');assert.equal(unknownPill.indeterminate,'true');assert.equal(unknownPill.timeKind,'elapsed');assert.ok(!unknownPill.label.includes('Осталось'));await fixture.frame();const elapsedLayoutBefore=browser.mouseLayoutCalls||0;
  let unknownAfter;await fixture.until(async()=>{unknownAfter=await ui();return Number(unknownAfter.panes.find(pane=>pane.tabId===first.id).pill.elapsedSeconds)>Number(unknownPill.elapsedSeconds);},'unknown ETA shows advancing observed elapsed time',2500);assert.equal((browser.mouseLayoutCalls||0)-elapsedLayoutBefore,0,'Text-only elapsed ticks never request native layout');
  facts.observations.unknown={task:unknown,ui:unknownUI,after:unknownAfter,layoutCalls:0};
  await report(first,37,'Building an owned index',{taskId:'site-api',etaSeconds:90});await visible(first,reported.id,37,90);
  const spaBefore=await fixture.identity(first);await fixture.pageJS(first,"history.pushState({},'', '#owned-spa');true");await fixture.until(()=>first.page.view.webContents.getURL().endsWith('#owned-spa'),'same document route changes');const spaAfter=await fixture.identity(first),spaTask=task(await state(),first,'site-api');
  assert.equal(spaTask.id,reported.id);for(const key of ['identity','timeOrigin','field','scrollY','cookie','webContentsId'])assert.deepEqual(spaAfter[key],spaBefore[key]);facts.observations.sameDocument={before:spaBefore,after:spaAfter,task:spaTask};
  await fixture.switchDesk(other);const inactiveUI=await ui();assert.ok(inactiveUI.panes.every(pane=>pane.pill?.tabId!==first.id&&pane.pill?.tabId!==second.id));
  const hiddenUpdate=await report(first,52,'The site continued while its desktop was hidden',{taskId:'site-api',etaSeconds:17});assert.equal(hiddenUpdate.id,reported.id);assert.equal(hiddenUpdate.desk,desk);
  await fixture.pageJS(second,"document.querySelector('#site-progress').value=140;true");await fixture.until(async()=>task(await state(),second,'site-dom')?.percent===70,'hidden DOM task advances');const inactiveState=await state();
  await fixture.switchDesk(desk);const returnUI=await visible(first,reported.id,52,17);await visible(second,observed.id,70,45);facts.observations.desktopReturn={from:desk,other,inactiveUI,inactiveState,hiddenUpdate,returned:await state(),ui:returnUI};
  await fixture.pageJS(second,"const p=document.querySelector('#site-progress');p.style.display='none';p.value=144;true");await fixture.until(async()=>task(await state(),second,'site-dom')?.percent===72,'explicit hidden producer remains an active task');facts.observations.hiddenProducer={state:await state(),ui:await visible(second,observed.id,72,45)};
  const completionStart=performance.now(),completed=await report(first,100,'Site reports the result is complete',{taskId:'site-api'});assert.equal(completed.phase,'completed');assert.ok(!(await state()).tasks.some(value=>value.id===reported.id));await fixture.until(async()=>!(await ui()).panes.some(pane=>pane.pill?.id===reported.id),'API completion immediately disappears',1000);
  facts.observations.apiCompleted={task:completed,visibleAfter:await state(),ui:await ui(),elapsedMs:performance.now()-completionStart};
  const domCompleteStart=performance.now();await fixture.pageJS(second,"document.querySelector('#site-progress').setAttribute('data-mouse-task-state','completed');true");await fixture.until(async()=>!(await state()).tasks.some(value=>value.id===observed.id),'DOM completion clears the main snapshot',1500);await fixture.until(async()=>!(await ui()).panes.some(pane=>pane.pill?.id===observed.id),'DOM completion immediately removes the pill',1000);
  facts.observations.domCompleted={visibleAfter:await state(),ui:await ui(),elapsedMs:performance.now()-domCompleteStart};
  const errorBefore=await report(first,31,'Preparing an error fixture',{taskId:'error-case',etaSeconds:8}),cancelBefore=await report(second,48,'Preparing a cancellation fixture',{taskId:'cancel-case',etaSeconds:12});
  const errorTask=await report(first,99,'The site reported a real failure',{taskId:'error-case',phase:'error',etaSeconds:1}),cancelTask=await report(second,null,'The site cancelled its task',{taskId:'cancel-case',phase:'cancelled',etaSeconds:0});
  assert.equal(errorTask.percent,31);assert.equal(cancelTask.percent,48);assert.equal(errorTask.etaSeconds,null);assert.equal(cancelTask.etaSeconds,null);
  await visible(first,errorTask.id,31,null,'error');const finalUI=await visible(second,cancelTask.id,48,null,'cancelled');facts.observations.failedAndCancelled={errorBefore,cancelBefore,errorTask,cancelTask,state:await state(),ui:finalUI};
  const retiring=performance.now();await fixture.until(async()=>{const s=await state();return !s.tasks.some(value=>[errorTask.id,cancelTask.id].includes(value.id));},'brief final states expire without becoming success',6500);facts.observations.finalStatesExpired={elapsedMs:performance.now()-retiring,state:await state(),ui:await ui()};
  const navigationTask=await report(first,46,'This task belongs only to the current document',{taskId:'new-document',etaSeconds:11}),navigationBefore=await fixture.identity(first);
  await browser.command('navigate',{id:first.id,url:base+'/page/0/?replacement=1'});await fixture.until(()=>!first.page.loading,'replacement document loads');const navigationAfter=await fixture.identity(first),afterNavigation=await state();assert.notEqual(navigationAfter.identity,navigationBefore.identity);assert.notEqual(navigationAfter.timeOrigin,navigationBefore.timeOrigin);assert.equal(navigationAfter.webContentsId,navigationBefore.webContentsId);assert.ok(!afterNavigation.tasks.some(value=>value.tabId===first.id));
  facts.observations.newDocument={task:navigationTask,before:navigationBefore,after:navigationAfter,state:afterNavigation};
  const closingTask=await report(second,19,'This task belongs to the closing tab',{taskId:'closing',etaSeconds:4});await browser.command('close',{id:second.id});await fixture.until(async()=>!(await state()).tasks.some(value=>value.tabId===second.id),'closing a real native page clears its task');facts.observations.closed={task:closingTask,tabExists:browser.tabs.has(second.id),state:await state()};
  assert.ok(facts.events.some(event=>event.mainFrame&&event.tabId===second.id&&event.taskId==='site-dom'&&event.percent===64&&event.etaSeconds===45),'DOM proof includes actual isolated-preload IPC from its owning main frame');
  facts.pages=[first.before,second.before];facts.elapsedMs=performance.now()-fixture.started;
 }catch(error){verificationError=error;facts.error={message:error.message,stack:error.stack};if(error.capture)facts.failureCapture=error.capture;await save();}
 finally{
  ipcMain.removeListener('mouse:page-activity',activity);releaseImages();
  if(fixture)try{facts.cleanup=await bounded(fixture.cleanup(),22000,'task cleanup');facts.restored=true;}catch(error){cleanupError=error;facts.cleanupError={message:error.message,stack:error.stack};}
  if(server){server.closeAllConnections();await bounded(new Promise(resolve=>server.close(resolve)),2000,'task HTTP shutdown').catch(error=>{cleanupError??=error;facts.serverCleanupError=error.message;});}
  facts.ok=!verificationError&&!cleanupError&&facts.restored;await save();
 }
 if(verificationError)throw verificationError;if(cleanupError)throw cleanupError;
 console.log('MOUSE_631_TASK_ONLY_NATIVE_PASS');return facts;
};
