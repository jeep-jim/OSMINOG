'use strict';
// Installed Electron/macOS proof. Local fixtures are explicitly test pages, never real service accounts.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),net=require('node:net');
const {screen}=require('electron');
const {AgentController}=require('./mouse-agent/agent-connector.cjs');
const Modes=require('./mouse/modes.js');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,n=180){for(let i=0;i<n;i++){if(await fn())return;await sleep(60);}throw Error('Mouse622 timeout: '+label);}
const copy=x=>JSON.parse(JSON.stringify(x));
module.exports=async({app,win,browser,store,agentHost})=>{
 const js=source=>win.webContents.executeJavaScript(source),native=require('./mouse-native-menu.node'),before=new Set(browser.tabs.keys()),original=await js('MouseTest.prefs()'),bounds=win.getBounds(),bank=browser.mouseDesktops.bank,saved=bank.snapshot(),globals=copy(bank.global),originalDialog=agentHost?.dialog;
 const burrow623=require('./mouse-623-smoke.cjs')({win,js});
 const features624=require('./mouse-624-smoke.cjs')({win,browser,store,agentHost,js,click,until,sleep,painted});
 let server,modelServer,client,captureTab,captureOriginal,releaseModelCompletion,lastClick=null,intercepted=false,modelRequests=0,workerPid=0,ptyPid=0;
 const selected=[];
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
  server=http.createServer((req,res)=>{if((req.url||'').split('?')[0]==='/favicon.png'){res.setHeader('Content-Type','image/png');res.end(fixtureFavicon);return;}res.setHeader('Content-Type','text/html; charset=utf-8');const label=decodeURIComponent((req.url||'/').split('/').pop()).replace(/[<>"&]/g,'');res.end(`<!doctype html><meta charset="utf-8"><title>622 fixture ${label}</title><link rel="icon" type="image/png" href="/favicon.png"><style>body{margin:0;background:#e8eee9;color:#162119;font:15px system-ui}header{padding:14px;background:#32c76a}main{padding:16px}input,button{display:block;margin:12px 0;padding:8px;max-width:80%}</style><header>Mouse 622 · local test fixture</header><main><h2>${label}</h2><input id="draft" value=""><button id="action">Fixture action</button><p id="result">Ready</p></main><script>window.identity=Math.random();window.clicks=0;document.querySelector('#action').addEventListener('click',()=>{window.clicks++;document.querySelector('#result').textContent='Clicked '+window.clicks});</script>`);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root='http://127.0.0.1:'+server.address().port;
  browser.session.webRequest.onBeforeRequest({urls:Modes.get('support').sites},(details,done)=>{selected.push(details.url);done({redirectURL:root+'/suggested/'+encodeURIComponent(new URL(details.url).hostname)});});intercepted=true;
  await js('MouseTest.switchDesktop("desk-2")');assert.equal(browser.state().tabs.length,0,'The default second desk is empty');
  await js('MouseTest.applyMode("support")');await until(()=>browser.state().tabs.length===7&&browser.state().tabs.every(t=>!browser.get(t.id).loading&&browser.get(t.id).view.webContents.getURL().startsWith(root+'/suggested/')),'seven suggested fixture pages');
  const supportIds=browser.state().tabs.map(t=>t.id),identities=new Map();for(const id of supportIds){const wc=browser.get(id).view.webContents;const identity=await wc.executeJavaScript('window.identity');assert.equal(typeof identity,'number','Suggested page fixture script loaded');identities.set(id,{wc:wc.id,identity});}
  assert.deepEqual(selected.slice().sort(),Modes.get('support').sites.slice().sort());assert.equal(await js('MouseLayout.leaves(MouseTest.model.tree).length'),7);
  // An existing AI side tab also belongs to the user and must not cause suggestions.
  await js(`MouseTest.openAI(${JSON.stringify(root+'/owned-ai')})`);const ai=await js('MouseTest.model.aiId');await until(()=>browser.get(ai)&&!browser.get(ai).loading,'owned AI fixture');const allIds=browser.state().tabs.map(t=>t.id).sort();
  for(const mode of ['trader','design','content','agents','support']){await js(`MouseTest.applyMode(${JSON.stringify(mode)})`);assert.deepEqual(browser.state().tabs.map(t=>t.id).sort(),allIds,'Mode '+mode+' preserves all IDs');}
  assert.equal(selected.length,7,'Existing tabs never seed additional suggested services');
  for(const [id,record]of identities){const wc=browser.get(id).view.webContents;assert.equal(wc.id,record.wc);const identity=await wc.executeJavaScript('window.identity');assert.equal(typeof identity,'number','Mode retained loaded fixture');assert.equal(identity,record.identity);}
  await js('MouseTest.switchDesktop("desk-4")');assert.equal(browser.state().tabs.length,0);await js(`MouseTest.openAI(${JSON.stringify(root+'/ai-only')})`);await until(()=>browser.state().tabs.length===1&&!browser.get(browser.state().tabs[0].id).loading,'AI-only desk');const onlyAI=browser.state().tabs[0].id;await js('MouseTest.applyMode("support")');assert.deepEqual(browser.state().tabs.map(t=>t.id),[onlyAI],'AI-only desk is not empty');assert.equal(selected.length,7);
  await js('MouseTest.switchDesktop("desk-2")');await until(()=>supportIds.some(id=>browser.get(id).visible),'support views restored');
  const snapshot=await js('MouseNative.desktops("remember-preview",{preferences:MouseTest.prefs()})'),own=snapshot.items.find(d=>d.id==='desk-2');assert.ok(own.preview.panes.some(p=>p.src?.startsWith('data:image/jpeg;base64,')),'Real WebContents thumbnail');
  const first=own.preview.panes.find(p=>p.src),stamp=first.capturedAt;captureTab=browser.get(first.id).view.webContents;captureOriginal=captureTab.capturePage;let hiddenCaptures=0;
  await js('MouseTest.switchDesktop("desk-1")');captureTab.capturePage=async function(...args){hiddenCaptures++;return captureOriginal.apply(this,args);};
  const hidden=await js('MouseNative.desktops("previews",{preferences:MouseTest.prefs()})'),remembered=hidden.items.find(d=>d.id==='desk-2').preview.panes.find(p=>p.id===first.id);assert.equal(hiddenCaptures,0,'Hidden previews do not recapture hidden pages');assert.ok(remembered.src);assert.ok(remembered.capturedAt>=stamp);captureTab.capturePage=captureOriginal;captureTab=null;
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").open&&!document.querySelector("#desktop-tray").hidden'),'desktop tray visible');
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
   assert.equal(await js('document.querySelectorAll("#desk-modes [data-mode]").length'),5);assert.equal(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")'),'true');const expanded=await js('(()=>{const t=document.querySelector("#desktop-tray"),r=t.getBoundingClientRect(),c=t.querySelector(".desk-content");return{top:r.top,bottom:r.bottom,height:r.height,scrollTop:c.scrollTop,scrollHeight:c.scrollHeight,clientHeight:c.clientHeight}})()');assert.ok(expanded.height>compact.height+16&&expanded.top<compact.top-16,'Modes grow Nora upward to fit the added controls');assert.ok(Math.abs(expanded.bottom-compact.bottom)<=1,'Content growth keeps the footer anchor');assert.equal(expanded.scrollTop,0);assert.ok(expanded.scrollHeight<=expanded.clientHeight+1,'Expanded Nora has no internal vertical overflow');await painted();await fs.writeFile('mouse-622-modes-'+theme+'.png',(await win.capturePage()).toPNG());await burrow623.capture(theme,'modes');await click('#desks-close');
  }
  await burrow623.finish();
  await burrow623.verifyTabs({browser,bank,click,activate,root,native,until,sleep});
  await burrow623.verifyAgentEntry({browser,agentHost,click,until});
  await features624.verifyLayoutAndHistory({root,bank});await features624.verifyPageProgress({root,bank});await js('MouseTest.switchDesktop("desk-1")');
  await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").open'),'tray for switch');await click('[data-desk="desk-2"] .desk-open');await until(()=>js('MouseTest.model.desktopId==="desk-2"&&!MouseTest.model.switching'),'native desk switch');assert.equal(bank.items.length,5);
  console.log('MOUSE_622_FIVE_DESKS_MODES_PRESERVE_TABS_PASS');console.log('MOUSE_622_BURROW_PREVIEW_BOTH_THEMES_PASS');
  await js('MouseTest.applyMode("agents")');await until(()=>supportIds.some(id=>browser.get(id).visible),'agent layout visible');
  const project=path.join(app.getPath('userData'),'mouse622-agent-fixture');await fs.mkdir(project,{recursive:true});agentHost.dialog={...originalDialog,showMessageBox:async()=>({response:1}),showOpenDialog:async()=>({canceled:false,filePaths:[project]})};
  await agentHost.handle('enable',{port:0});await agentHost.handle('folder');let connection=agentHost.state();assert.equal(connection.autonomous,false);assert.equal(connection.enabled,true);assert.equal(connection.desk,'desk-2');assert.ok(connection.port>0);
  const unauth=await fetch('http://127.0.0.1:'+connection.port+'/json/list');assert.equal(unauth.status,403);await unauth.text();
  client=await new AgentController(connection.connectionUrl).connect();assert.deepEqual((await client.tabs()).map(t=>t.targetId).sort(),allIds,'Only current desk tabs are exposed');
  const target=supportIds.find(id=>browser.get(id).visible),wc=browser.get(target).view.webContents;assert.ok((await client.dom(target)).root);assert.match((await client.read(target)).text,/local test fixture/);
  await approve(client.clickSelector(target,'#action'),'click');assert.equal(await wc.executeJavaScript('window.clicks'),1);
  await approve(client.clickSelector(target,'#draft'),'click');await approve(client.type(target,'agent-622'),'type');assert.equal(await wc.executeJavaScript('document.querySelector("#draft").value'),'agent-622');
  const image=await client.screenshot(target);assert.deepEqual([...Buffer.from(image.data,'base64').subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const terminal=await approve(client.terminal("printf 'MOUSE622_PTY_OK\\n'"),'terminal');assert.equal(terminal.exitCode,0);assert.match(terminal.stdout,/MOUSE622_PTY_OK/);ptyPid=agentHost.terminalService.proc.pid;
  const sideEffect=await client.send('Runtime.evaluate',{expression:'document.body.dataset.forbidden="yes"'},await client.session(target));assert.ok(sideEffect.exceptionDetails);assert.equal(await wc.executeJavaScript('document.body.dataset.forbidden'),undefined);
  // A separately consented autonomous session must perform real actions without
  // per-action approvals, while the default approval checks above remain intact.
  const manualConnection=connection,manualPty=ptyPid;await client.close();client=null;await agentHost.stop('Завершён ручной тест');await until(()=>!alive(manualPty),'manual session PTY stopped');assert.ok(await closedPort(manualConnection.port));
  await agentHost.handle('enable',{port:0,autonomous:true});connection=agentHost.state();assert.equal(connection.autonomous,true);assert.equal(connection.folder,project);assert.notEqual(connection.connectionUrl,manualConnection.connectionUrl);assert.equal(connection.pending,null);
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
  await js(`document.querySelector('#agent-local-port').value=${server.address().port};document.querySelector('.agent-localhost button').scrollIntoView({block:'center'})`);const beforePreview=new Set(browser.tabs.keys());await click('.agent-localhost button');await until(()=>[...browser.tabs.values()].some(t=>!beforePreview.has(t.id)&&t.view.webContents.getURL()===root+'/'),'localhost preview opens inside Mouse');
  await features624.verifyPillStop();
  const facts={fixedDesks:5,suggestedRequests:selected.length,preservedTabs:allIds.length,hiddenCaptures,realThumbnails:true,localModelFixtureRequests:modelRequests,externalWorker:true,ptyStdout:true,autonomousActions:true,stoppedListener:true,localhostPreview:true};await fs.writeFile('mouse-622-verification.json',JSON.stringify(facts,null,2)+'\n');console.log('MOUSE_622_AGENT_CDP_PTY_WORKER_STOP_PASS',JSON.stringify(facts));
 }catch(error){
  console.log('MOUSE_622_FAILURE_CONTEXT',JSON.stringify({lastClick,window:win.getBounds(),focused:win.isFocused(),modelRequests,agent:agentHost?{enabled:agentHost.state().enabled,running:agentHost.state().running,desk:agentHost.state().desk,pending:agentHost.state().pending?.type}:null}));await fs.writeFile('mouse-622-failure.png',(await win.capturePage()).toPNG());throw error;
 }finally{
  releaseModelCompletion?.();
  if(captureTab&&captureOriginal)captureTab.capturePage=captureOriginal;
  await client?.close().catch(()=>{});await agentHost?.stop('Завершена локальная проверка');if(agentHost)agentHost.dialog=originalDialog;
  if(intercepted)browser.session.webRequest.onBeforeRequest(null);
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.feedback.hide()').catch(()=>{});
  for(const tab of [...browser.tabs.values()])if(!before.has(tab.id)){const desk=bank.members[tab.id];await js(`MouseTest.switchDesktop(${JSON.stringify(desk)})`).catch(()=>{});await browser.command('close',{id:tab.id}).catch(()=>{});}
  await js(`MouseTest.switchDesktop(${JSON.stringify(original.desktopId)})`).catch(()=>{});bank.items=copy(saved.items);bank.members=Object.assign(Object.create(null),saved.members);bank.active=saved.active;bank.global=globals;bank.recovery=saved.recovery?copy(saved.recovery):null;browser.mouseDesktops.previews.clear();
  await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);browser.emit();await browser.save();await store.queue;win.setBounds(bounds);server?.close();modelServer?.close();
 }
};
