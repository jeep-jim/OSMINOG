'use strict';
// Installed Electron/macOS proof. Local fixtures are explicitly test pages, never real service accounts.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),net=require('node:net');
const {screen}=require('electron');
const {AgentController}=require('./mouse-agent/agent-connector.cjs');
const {createPresetProof,ownedPresetPage,canonicalServices}=require('./mouse-637-presets-helpers.cjs');
const {createHash}=require('node:crypto');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,n=180){for(let i=0;i<n;i++){if(await fn())return;await sleep(60);}throw Error('Mouse622 timeout: '+label);}
const copy=x=>JSON.parse(JSON.stringify(x));
module.exports=async({app,win,browser,store,agentHost})=>{
 const js=source=>win.webContents.executeJavaScript(source),native=require('./mouse-native-menu.node'),original=await js('MouseTest.prefs()'),bounds=win.getBounds(),bank=browser.mouseDesktops.bank,saved=bank.snapshot(),before=new Set(Object.keys(bank.members)),globals=copy(bank.global),originalDialog=agentHost?.dialog;
 const burrow623=require('./mouse-623-smoke.cjs')({win,js});
 const features624=require('./mouse-624-smoke.cjs')({win,browser,store,agentHost,js,click,until,sleep,painted});
 let server,modelServer,client,captureTab,captureOriginal,releaseModelCompletion,lastClick=null,intercepted=false,modelRequests=0,workerPid=0,ptyPid=0;
 const selected=[];
 const proof=createPresetProof({app,win,browser,agentHost,js,until,selectedRequests:selected,modelRequests:()=>modelRequests,
  click:async selector=>{await click(selector);return copy(lastClick);},
  text:async(selector,value)=>{const modifiers=[process.platform==='darwin'?'meta':'control'];await click(selector);win.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers});win.webContents.sendInputEvent({type:'keyDown',keyCode:'Backspace'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Backspace'});await win.webContents.insertText(value);},
  setTheme:value=>js(`MouseTest.setTheme(${JSON.stringify(value)})`),frame:painted,
  captureLanding:async(read,rgb)=>{
   const image=await win.capturePage(),png=image.toPNG({scaleFactor:1}),bitmap=image.toBitmap({scaleFactor:1}),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},content=win.getContentBounds(),point={x:read.pane.x+12,y:read.pane.y+12},x=Math.floor(point.x*pixelSize.width/content.width),y=Math.floor(point.y*pixelSize.height/content.height);assert.equal(bitmap.length,pixelSize.width*pixelSize.height*4);assert.ok(x>=0&&y>=0&&x<pixelSize.width&&y<pixelSize.height);
   const offset=(y*pixelSize.width+x)*4,actualRGBA=[bitmap[offset+2],bitmap[offset+1],bitmap[offset],bitmap[offset+3]];assert.equal(actualRGBA[3],255);assert.ok(actualRGBA.slice(0,3).every((channel,index)=>Math.abs(channel-rgb[index])<=3),'Native captured landing pixels follow the shell theme');
   const filename='mouse-622-localhost-'+read.theme+'.png';await fs.writeFile(filename,png);return{filename,source:'win.capturePage()',sha256:createHash('sha256').update(png).digest('hex'),bytes:png.length,pixelSize,contentBounds:content,point,x,y,expectedRGB:rgb,actualRGBA};
  }});
 const {evidence:presetEvidence,pages,preserved}=proof;
 async function activate(){
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();await sleep(100);
  if(!win.isFocused()){
   const p=await js(`(()=>{const bar=document.querySelector('#statusbar'),r=bar.getBoundingClientRect(),y=r.y+r.height/2;for(let x=r.x+8;x<r.right-8;x+=4){const e=document.elementFromPoint(x,y);if(e&&bar.contains(e)&&!e.closest('button,a,input,select,label'))return{x,y};}throw Error('No empty footer focus area');})()`),o=win.getContentBounds();
   assert.equal(native.testClick(Math.round(o.x+p.x),Math.round(o.y+p.y)),true);await sleep(150);win.focus();win.webContents.focus();
  }
  await until(()=>win.isFocused(),'focused native window');
 }
 async function motionSettled(){await until(()=>js('(()=>{const t=document.querySelector("#desktop-tray");return t.hidden||t.dataset.motion==="open";})()'),'burrow animation settles before native controls');}
 async function click(selector){
  const inAgentSettings=await js(`!!document.querySelector(${JSON.stringify(selector)})?.closest('#agent-settings-page')`);
  if(inAgentSettings&&await js('document.querySelector("#agent-settings-page").hidden')){await click('#agent-settings-open');await until(()=>js('!document.querySelector("#agent-settings-page").hidden'),'Agent inline settings opens through its native button');}
  if(inAgentSettings)await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;e.scrollIntoView({block:'nearest',inline:'nearest'});})()`);
  await motionSettled();await activate();const target=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return(${nativeHitTarget.toString()})(e);})()`);
  assert.equal(target.ready,true,'Mouse622 native click target: '+JSON.stringify({selector,...target}));const o=win.getContentBounds(),point={x:Math.round(o.x+target.x),y:Math.round(o.y+target.y)},display=screen.getDisplayNearestPoint(point).bounds;
  lastClick={selector,point,display};assert.ok(point.x>=display.x&&point.y>=display.y&&point.x<display.x+display.width&&point.y<display.y+display.height,'Click outside display');assert.equal(native.testClick(point.x,point.y),true);await sleep(180);if(selector==='#desktops-button')await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'burrow opens before existing622 assertions');else if(selector==='#desks-close')await until(()=>js('document.querySelector("#desktop-tray").hidden&&!document.querySelector(".mouse-floating-snapshot")'),'burrow closes before next622 action');await motionSettled();
 }
 async function painted(){
  let timer;try{await Promise.race([js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Mouse622 renderer paint timed out')),1500)})]);}finally{clearTimeout(timer);}await sleep(180);
 }
 async function approve(promise,type){
  // These are only this test's explicit fixture actions; production consent remains unchanged.
  const guarded=Promise.resolve(promise);guarded.catch(()=>{});await until(()=>!!agentHost.pending,'pending '+type);assert.equal(agentHost.state().pending.type,type);await agentHost.handle('approve',{id:agentHost.state().pending.id,allow:true});return guarded;
 }
 async function closedPort(port){return new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(false)});s.once('error',()=>resolve(true));s.setTimeout(500,()=>{s.destroy();resolve(false)});});}
 const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
 try{
  assert.ok(agentHost,'Agent host must be installed in packaged Mouse');assert.equal(agentHost.state().enabled,false);assert.equal(agentHost.state().port,0);
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave full screen');await sleep(300);}
  const work=screen.getPrimaryDisplay().workArea;win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1200,work.width-16),height:Math.min(820,work.height-16)});await activate();
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');
  const fixtureFavicon=await fs.readFile(path.join(__dirname,'mouse/brand.png'));
  server=http.createServer((req,res)=>{if((req.url||'').split('?')[0]==='/favicon.png'){res.setHeader('Content-Type','image/png');res.end(fixtureFavicon);return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(ownedPresetPage(decodeURIComponent((req.url||'/').split('/').pop())));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root='http://127.0.0.1:'+server.address().port;
  presetEvidence.fixtureOrigin=root;const serviceURLs=canonicalServices();
  browser.session.webRequest.onBeforeRequest({urls:serviceURLs},(details,done)=>{selected.push(details.url);done({redirectURL:root+'/suggested/'+encodeURIComponent(details.url)});});intercepted=true;
  const {supportIds,agentPreviewId,allIds}=await proof.runCatalog();
  const snapshot=await js('MouseNative.desktops("remember-preview",{preferences:MouseTest.prefs()})'),own=snapshot.items.find(d=>d.id==='desk-2');assert.ok(own.preview.panes.some(p=>p.src?.startsWith('data:image/jpeg;base64,')),'Real WebContents thumbnail');
  const first=own.preview.panes.find(p=>p.src),stamp=first.capturedAt;captureTab=browser.get(first.id).view.webContents;captureOriginal=captureTab.capturePage;let hiddenCaptures=0;
  await js('MouseTest.switchDesktop("desk-1")');captureTab.capturePage=async function(...args){hiddenCaptures++;return captureOriginal.apply(this,args);};
  const hidden=await js('MouseNative.desktops("previews",{preferences:MouseTest.prefs()})'),remembered=hidden.items.find(d=>d.id==='desk-2').preview.panes.find(p=>p.id===first.id);assert.equal(hiddenCaptures,0,'Hidden previews do not recapture hidden pages');assert.ok(remembered.src);assert.ok(remembered.capturedAt>=stamp);captureTab.capturePage=captureOriginal;captureTab=null;
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await painted();await burrow623.prepareReference(theme);await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").open&&!document.querySelector("#desktop-tray").hidden'),'desktop tray visible');
   const metrics=await js(`(()=>{const t=document.querySelector('#desktop-tray'),r=t.getBoundingClientRect(),f=document.querySelector('#statusbar').getBoundingClientRect(),content=t.querySelector('.desk-content'),active=t.querySelector('[aria-current="true"]'),other=t.querySelector('.desktop-card:not([aria-current="true"])'),motion=MouseTest.desktopUI.motion.sample(),round=[...t.querySelectorAll('#desk-add,#desks-close')].map(e=>{const b=e.getBoundingClientRect(),c=getComputedStyle(e);return{w:b.width,h:b.height,r:c.borderRadius}});return{cards:t.querySelectorAll('.desktop-card').length,round,active:active?.dataset.desk,activeBackground:active&&getComputedStyle(active).backgroundColor,otherBackground:other&&getComputedStyle(other).backgroundColor,activeBorder:active&&parseFloat(getComputedStyle(active).borderTopWidth),activeLabel:active?.querySelector('.desk-meta').textContent,top:r.top,bottom:r.bottom,footer:f.top,width:r.width,viewport:innerWidth,height:r.height,naturalHeight:motion.contentHeight,fits:motion.fits,overflow:getComputedStyle(content).overflowY,scrollHeight:content.scrollHeight,clientHeight:content.clientHeight,scrollTop:content.scrollTop,curve:t.querySelector('#mouse-dock-outline').getAttribute('d')};})()`);
   // 628 keeps the active label and coloured surface; the old green outline,
   // fixed-height viewport and internal scrollbar were explicitly superseded.
   assert.equal(metrics.cards,5);assert.equal(metrics.active,'desk-1');assert.match(metrics.activeLabel,/Вы здесь/);assert.notEqual(metrics.activeBackground,metrics.otherBackground);assert.equal(metrics.activeBorder,0);assert.ok(metrics.width>600&&metrics.width<=metrics.viewport);assert.ok(metrics.top>=0);assert.ok(Math.abs(metrics.bottom-metrics.footer)<=2,'Burrow meets footer');assert.equal(metrics.overflow,'visible');assert.equal(metrics.scrollTop,0);assert.ok(metrics.scrollHeight<=metrics.clientHeight+1);assert.ok(metrics.height>100&&Math.abs(metrics.height-metrics.naturalHeight)<=1);assert.equal(metrics.fits,true);assert.match(metrics.curve,/C/);
   for(const b of metrics.round){assert.ok(b.w>=28&&Math.abs(b.w-b.h)<1);assert.ok(parseFloat(b.r)>=b.w/2||b.r==='50%','Circular plus/close');}
   await painted();await burrow623.capture(theme,'compact');
   await click('[data-desk="desk-2"] .desk-preview-button');await until(()=>js('!document.querySelector("#desktop-preview-popover").hidden'),'pinned desktop preview');assert.equal(await js('MouseTest.model.desktopId'),'desk-1','Preview must not switch desktops');
   await until(()=>js('[...document.querySelectorAll("#desktop-preview-popover .desk-page-image")].some(i=>i.complete&&i.naturalWidth>0)'),'thumbnail paints');
   const peek=await js('(()=>{const e=document.querySelector("#desktop-preview-popover"),content=e.closest(".desk-content"),tray=e.closest("#desktop-tray"),r=e.getBoundingClientRect(),c=content.getBoundingClientRect(),t=tray.getBoundingClientRect();return{top:r.top,bottom:r.bottom,width:r.width,height:r.height,clipTop:Math.max(c.top,t.top),clipBottom:Math.min(c.bottom,t.bottom),viewport:innerHeight}})()');assert.ok(peek.top>=peek.clipTop-1&&peek.bottom<=peek.clipBottom+1&&peek.height>100,'The complete preview is visible without scrolling Nora');
   await painted();await fs.writeFile('mouse-622-preview-'+theme+'.png',(await win.capturePage()).toPNG());await burrow623.capture(theme,'preview');await click('.desk-preview-close');const compact=await js('(()=>{const r=document.querySelector("#desktop-tray").getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height}})()');await click('#desk-modes-button');await sleep(320);
   assert.equal(await js('document.querySelectorAll("#desk-modes [data-mode]").length'),5);assert.equal(await js('document.querySelectorAll("#desk-modes [data-mode=agents]").length'),1,'Agents has its restored preset entry');assert.equal(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")'),'true');const expanded=await js('(()=>{const t=document.querySelector("#desktop-tray"),r=t.getBoundingClientRect(),c=t.querySelector(".desk-content");return{top:r.top,bottom:r.bottom,height:r.height,scrollTop:c.scrollTop,scrollHeight:c.scrollHeight,clientHeight:c.clientHeight}})()');assert.ok(expanded.height>compact.height+16&&expanded.top<compact.top-16,'Modes grow Nora upward to fit the added controls');assert.ok(Math.abs(expanded.bottom-compact.bottom)<=1,'Content growth keeps the footer anchor');assert.equal(expanded.scrollTop,0);assert.ok(expanded.scrollHeight<=expanded.clientHeight+1,'Expanded Nora has no internal vertical overflow');await painted();await fs.writeFile('mouse-622-modes-'+theme+'.png',(await win.capturePage()).toPNG());await burrow623.capture(theme,'modes');await click('#desks-close');
  }
  await burrow623.finish();
  await burrow623.verifyTabs({browser,bank,click,activate,root,native,until,sleep});
  await burrow623.verifyAgentEntry({browser,agentHost,click,until});
  await features624.verifyLayoutAndHistory({root,bank});await features624.verifyPageProgress({root,bank});await js('MouseTest.switchDesktop("desk-1")');
  await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").open'),'tray for switch');await click('[data-desk="desk-2"] .desk-open');await until(()=>js('MouseTest.model.desktopId==="desk-2"&&!MouseTest.model.switching'),'native desk switch');assert.equal(bank.items.length,5);
  console.log('MOUSE_622_FIVE_DESKS_MODES_PRESERVE_TABS_PASS');console.log('MOUSE_622_BURROW_PREVIEW_BOTH_THEMES_PASS');
  await proof.restoreAgent();
  const project=path.join(app.getPath('userData'),'mouse622-agent-fixture');await fs.mkdir(project,{recursive:true});agentHost.dialog={...originalDialog,showMessageBox:async()=>({response:1}),showOpenDialog:async()=>({canceled:false,filePaths:[project]})};
  await agentHost.handle('enable',{port:0});await agentHost.handle('folder');await agentHost.handle('local-permissions',{write:false,commands:true});let connection=agentHost.state();assert.equal(connection.autonomous,false);assert.equal(connection.enabled,true);assert.equal(connection.desk,'desk-2');assert.ok(connection.port>0);
  const unauth=await fetch('http://127.0.0.1:'+connection.port+'/json/list');assert.equal(unauth.status,403);await unauth.text();
  client=await new AgentController(connection.connectionUrl).connect();assert.deepEqual((await client.tabs()).map(t=>t.targetId).sort(),allIds,'Only current desk tabs are exposed');
  const target=agentPreviewId,wc=browser.get(target).view.webContents;assert.ok((await client.dom(target)).root);assert.match((await client.read(target)).text,/local test fixture/);
  await approve(client.clickSelector(target,'#action'),'click');assert.equal(await wc.executeJavaScript('window.clicks'),1);
  await approve(client.clickSelector(target,'#draft'),'click');const selectAll=[process.platform==='darwin'?'meta':'control'];wc.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:selectAll});wc.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:selectAll});await approve(client.type(target,'agent-622'),'type');assert.equal(await wc.executeJavaScript('document.querySelector("#draft").value'),'agent-622');
  const image=await client.screenshot(target);assert.deepEqual([...Buffer.from(image.data,'base64').subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const terminal=await approve(client.terminal("printf 'MOUSE622_PTY_OK\\n'"),'terminal');assert.equal(terminal.exitCode,0);assert.match(terminal.stdout,/MOUSE622_PTY_OK/);ptyPid=agentHost.terminalService.proc.pid;
  const sideEffect=await client.send('Runtime.evaluate',{expression:'document.body.dataset.forbidden="yes"'},await client.session(target));assert.ok(sideEffect.exceptionDetails);assert.equal(await wc.executeJavaScript('document.body.dataset.forbidden'),undefined);
  // A separately consented autonomous session must perform real actions without
  // per-action approvals, while the default approval checks above remain intact.
  const manualConnection=connection,manualPty=ptyPid;await client.close();client=null;await agentHost.stop('Завершён ручной тест');await until(()=>!alive(manualPty),'manual session PTY stopped');assert.ok(await closedPort(manualConnection.port));
  await agentHost.handle('enable',{port:0,autonomous:true});await agentHost.handle('local-permissions',{write:false,commands:true});connection=agentHost.state();assert.equal(connection.autonomous,true);assert.equal(connection.folder,project);assert.notEqual(connection.connectionUrl,manualConnection.connectionUrl);assert.equal(connection.pending,null);
  client=await new AgentController(connection.connectionUrl).connect();await client.clickSelector(target,'#action');assert.equal(await wc.executeJavaScript('window.clicks'),2);assert.equal(agentHost.state().pending,null,'Autonomous click needs no per-action approval');
  const automatic=await client.terminal("printf 'MOUSE622_AUTONOMOUS_PTY_OK\\n'");assert.equal(automatic.exitCode,0);assert.match(automatic.stdout,/MOUSE622_AUTONOMOUS_PTY_OK/);assert.equal(agentHost.state().pending,null,'Autonomous command needs no per-action approval');ptyPid=agentHost.terminalService.proc.pid;
  await client.close();client=null;
  const completionBarrier=new Promise(resolve=>{releaseModelCompletion=resolve});
  modelServer=http.createServer(async(req,res)=>{
   assert.equal(req.url,'/v1/chat/completions');let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(body.model,'mouse622-local-fixture');assert.ok(Array.isArray(body.messages));modelRequests++;
   const action=modelRequests===1?{action:'tabs',summary:'Локальная проверка вкладок'}:modelRequests===2?{action:'read',args:{id:target},summary:'Чтение тестовой страницы'}:{action:'done',args:{text:'MOUSE622_WORKER_FIXTURE_DONE'}};if(modelRequests===3)await completionBarrier;else await sleep(250);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(action)}}]}));
  });await new Promise(resolve=>modelServer.listen(0,'127.0.0.1',resolve));
  await agentHost.handle('task',{endpoint:'http://127.0.0.1:'+modelServer.address().port+'/v1/',model:'mouse622-local-fixture',task:'Проверь только локальную тестовую страницу'});await until(()=>agentHost.worker?.pid>0,'external worker spawned');workerPid=agentHost.worker.pid;assert.equal(agentHost.state().running,true);assert.ok(workerPid>0,'Separate utility process PID');
  await until(()=>modelRequests===3,'worker waits at completion barrier');
  await until(()=>js('MouseTest.model.agentState?.running===true'),'renderer agent running state');assert.equal(await js('MouseTest.model.agentState.desk'),'desk-2');assert.equal(await js('document.querySelector(".agent-presence").dataset.running'),'true');await until(()=>js('(()=>{const i=document.querySelector(".agent-presence img");return i.complete&&i.naturalWidth>0})()'),'pixel mouse image painted');await painted();try{await fs.writeFile('mouse-622-agent-running.png',(await win.capturePage()).toPNG());}finally{releaseModelCompletion();}
  await until(()=>modelRequests===3&&!agentHost.state().running&&agentHost.state().logs.some(x=>x.text==='MOUSE622_WORKER_FIXTURE_DONE'),'separate worker actual local-model roundtrip');await until(()=>!alive(workerPid),'completed worker exit');
  // Stop must revoke the listener and terminal; a cleared label alone is insufficient.
  await click('#agent-stop');await until(()=>!agentHost.state().enabled,'native Stop action');await until(()=>!alive(ptyPid),'PTY process exit');assert.equal(agentHost.state().enabled,false);assert.equal(agentHost.state().terminal,false);assert.equal(agentHost.state().connectionUrl,'');assert.ok(await closedPort(connection.port));
  await js(`document.querySelector('#agent-local-port').value=${server.address().port};document.querySelector('.agent-localhost button').scrollIntoView({block:'center'})`);const beforePreview=new Set(browser.tabs.keys());await click('.agent-localhost button');let actualLocal;await until(()=>{actualLocal=[...browser.tabs.values()].find(t=>!beforePreview.has(t.id)&&t.view.webContents.getURL()===root+'/');return actualLocal;},'localhost preview opens inside Mouse');await click('#agent-settings-close');await until(()=>js('document.querySelector("#agent-settings-page").hidden'),'Localhost settings close before page input');await until(()=>js(`MouseTest.model.agentPreviewId===${JSON.stringify(actualLocal.id)}&&MouseTest.model.presetTabs.agents[0]===${JSON.stringify(actualLocal.id)}`),'existing Agent localhost action updates dedicated mode identity');const localBefore=(await pages([actualLocal.id]))[0],beforeReturn=browser.state().tabs.map(t=>t.id).sort();await js('MouseTest.applyMode("agents")');await until(()=>actualLocal.visible,'return to actual launched local app');const localAfter=(await pages([actualLocal.id]))[0];preserved([localBefore],[localAfter]);assert.deepEqual(browser.state().tabs.map(t=>t.id).sort(),beforeReturn);presetEvidence.agentLanding.settingsLaunch={before:localBefore,after:localAfter,previousId:agentPreviewId,previousRetained:browser.tabs.has(agentPreviewId),beforeIds:beforeReturn,afterIds:browser.state().tabs.map(t=>t.id).sort()};assert.equal(presetEvidence.agentLanding.settingsLaunch.previousRetained,true);
  await features624.verifyPillStop();
  const facts={fixedDesks:5,suggestedRequests:selected.length,preservedTabs:allIds.length,hiddenCaptures,realThumbnails:true,localModelFixtureRequests:modelRequests,externalWorker:true,ptyStdout:true,autonomousActions:true,stoppedListener:true,localhostPreview:true,presetEvidence};await fs.writeFile('mouse-622-verification.json',JSON.stringify(facts,null,2)+'\n');console.log('MOUSE_622_AGENT_CDP_PTY_WORKER_STOP_PASS',JSON.stringify({...facts,presetEvidence:{schema:1,applications:presetEvidence.applications.length,selectedRequests:selected.length}}));
 }catch(error){
  console.log('MOUSE_622_FAILURE_CONTEXT',JSON.stringify({lastClick,window:win.getBounds(),focused:win.isFocused(),modelRequests,agent:agentHost?{enabled:agentHost.state().enabled,running:agentHost.state().running,desk:agentHost.state().desk,pending:agentHost.state().pending?.type}:null}));await fs.writeFile('mouse-622-failure.png',(await win.capturePage()).toPNG());throw error;
 }finally{
  releaseModelCompletion?.();
  if(captureTab&&captureOriginal)captureTab.capturePage=captureOriginal;
  await client?.close().catch(()=>{});await agentHost?.stop('Завершена локальная проверка');if(agentHost)agentHost.dialog=originalDialog;
  if(intercepted)browser.session.webRequest.onBeforeRequest(null);
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.feedback.hide()').catch(()=>{});
  for(const id of Object.keys(bank.members))if(!before.has(id))await js(`MouseNative.desktops('close-tab',{id:${JSON.stringify(id)}})`).catch(()=>{});
  await js(`MouseTest.switchDesktop(${JSON.stringify(original.desktopId)})`).catch(()=>{});bank.items=copy(saved.items);bank.members=Object.assign(Object.create(null),saved.members);bank.active=saved.active;bank.global=globals;bank.recovery=saved.recovery?copy(saved.recovery):null;browser.mouseDesktops.previews.clear();
  await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);browser.emit();await browser.save();await store.queue;win.setBounds(bounds);server?.close();modelServer?.close();
 }
};
