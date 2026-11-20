'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<240;i++){if(await fn())return;await sleep(60);}throw Error('Mouse614 timeout: '+label);}
async function waitForAIClosed({js,windowed,browser,id,webContents}){
 // Native removal can precede the persisted IPC result accepted by the renderer.
 await until(async()=>windowed()&&!browser.tabs.has(id)&&webContents.isDestroyed()&&await js('MouseTest.model.focusAI===false&&MouseTest.model.aiOpen===false&&MouseTest.model.switching===false'),'close destroys AI and returns layout');
}
function assertVisibleAIPresets(snapshot,scope){
 assert.ok(scope==='normal'||scope==='private');assert.equal(snapshot.privateMode,scope==='private','The visible card contract belongs to the actual browser mode');
 const external=['https://chatgpt.com/','https://claude.ai/','https://gemini.google.com/','https://chat.deepseek.com/'];
 assert.deepEqual(snapshot.urls,scope==='private'?external:['mouse://agent',...external],'Only ordinary mode offers Agent Mouse alongside the four external providers');return true;
}
module.exports=async({win,browser,scope='normal'})=>{
 const js=s=>win.webContents.executeJavaScript(s),bounds=win.getBounds(),wasFull=win.isFullScreen();
 let settledFull=wasFull;const entered=()=>{settledFull=true},left=()=>{settledFull=false};win.on('enter-full-screen',entered);win.on('leave-full-screen',left);
 const full=()=>settledFull&&win.isFullScreen(),windowed=()=>!settledFull&&!win.isFullScreen();
 const saved=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,tabOrder:MouseTest.model.tabOrder,theme:MouseTest.model.theme,aiOpen:MouseTest.model.aiOpen,aiId:MouseTest.model.aiId,aiWidth:MouseTest.model.aiWidth,aiSites:MouseTest.model.aiSites,aiSessions:MouseTest.model.aiSessions,libraryOpen:MouseTest.model.libraryOpen}))');
 const beforeIds=new Set(browser.state().tabs.map(t=>t.id));
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>AI fullscreen fixture</title><input id="draft" value="keep my draft"><div style="height:2000px"></div><script>window.once=Math.random()</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const click=async selector=>{
  win.focus();win.webContents.focus();await sleep(120);
  await until(()=>js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e&&!e.disabled})()`),'control enabled');
  const point=()=>js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden button');return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  let p=await point();win.webContents.sendInputEvent({type:'mouseMove',...p});await sleep(120);p=await point();
  for(const type of ['mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(150);
 };
 const snapshot=()=>js('JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,aiWidth:MouseTest.model.aiWidth,aiId:MouseTest.model.aiId})');
 try{
  if(wasFull){win.setFullScreen(false);await until(windowed,'initial window');await sleep(400);}
  await js(`MouseTest.openPage(${JSON.stringify(url+'/main')})`);await js(`MouseTest.changeLayout(6);MouseTest.model.aiWidth=389;MouseTest.model.libraryOpen=false;MouseTest.openAI(${JSON.stringify(url+'/chat')})`);
  const aiId=await js('MouseTest.model.aiId');await until(()=>!browser.get(aiId).loading,'AI ready');await sleep(200);
  const wc=browser.get(aiId).view.webContents,aiWC=wc.id,once=await wc.executeJavaScript('once');
  const original=await snapshot(),ids=new Map([...browser.tabs.values()].map(t=>[t.id,{id:t.view.webContents.id,epoch:t.navigationEpoch||0}]));
  assert.equal(await js('document.querySelectorAll(".ai-controls [data-action=ai-settings]").length'),0);
  assert.equal(await js('!!document.querySelector("#ai-select option[value=custom]")'),true);
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);await click('[data-action=ai-fullscreen]');
   await until(full,'native fullscreen event');await until(()=>browser.panels.length===1&&browser.panels[0].id===aiId,'only AI native panel');await sleep(350);
   const layout=await js('(()=>{const w=document.querySelector("#workspace").getBoundingClientRect(),p=document.querySelector("#ai-panel").getBoundingClientRect(),b=document.querySelector("[data-action=ai-fullscreen]");return{left:p.left-w.left,width:p.width-w.width,focused:MouseTest.model.focusAI,pressed:b.getAttribute("aria-pressed"),symbol:b.textContent,stage:getComputedStyle(document.querySelector("#stage")).display}})()');
   console.log('MOUSE_614_AI_FOCUSED_GEOMETRY',JSON.stringify(layout));assert.ok(Math.abs(layout.left)<1&&Math.abs(layout.width)<1,JSON.stringify(layout));assert.equal(layout.focused,true);assert.equal(layout.pressed,'true');assert.equal(layout.symbol,'⤡');assert.equal(layout.stage,'none');assert.equal(await snapshot(),original);
   await fs.writeFile('mouse-614-ai-fullscreen-'+scope+'-'+theme+'.png',(await win.capturePage()).toPNG());
   await click('[data-action=ai-fullscreen]');await until(windowed,'restored native window event');await sleep(350);assert.equal(await js('MouseTest.model.focusAI'),false);assert.equal(await snapshot(),original);assert.equal(await js('document.querySelectorAll(".pane").length'),6);
  }
  await click('[data-action=ai-fullscreen]');await until(full,'Escape entry');await sleep(350);wc.focus();wc.sendInputEvent({type:'keyDown',keyCode:'Escape'});wc.sendInputEvent({type:'keyUp',keyCode:'Escape'});await until(async()=>windowed()&&!await js('MouseTest.model.focusAI'),'Escape from actual AI webContents');await sleep(350);assert.equal(await snapshot(),original);
  win.setFullScreen(true);await until(full,'existing fullscreen native event');await sleep(350);await click('[data-action=ai-fullscreen]');await until(()=>browser.panels.length===1&&browser.panels[0].id===aiId,'existing fullscreen AI');await click('[data-action=ai-fullscreen]');await until(async()=>!await js('MouseTest.model.focusAI'),'restore inside existing fullscreen');assert.equal(win.isFullScreen(),true,'must preserve pre-existing fullscreen');assert.equal(await snapshot(),original);
  win.setFullScreen(false);await until(windowed,'leave existing mode');await sleep(350);
  await js(`MouseTest.openAI(${JSON.stringify(url+'/close-chat')})`);const closeId=await js('MouseTest.model.aiId');await until(()=>!browser.get(closeId).loading,'separate close fixture ready');const closeWC=browser.get(closeId).view.webContents;
  await click('[data-action=ai-fullscreen]');await until(full,'close entry');await sleep(350);await click('[data-action=close-ai]');await waitForAIClosed({js,windowed,browser,id:closeId,webContents:closeWC});assert.equal(closeWC.isDestroyed(),true);assert.equal(await js('MouseTest.model.aiOpen'),false);assert.ok(browser.tabs.has(aiId),'Unselected AI session remains open');await js(`MouseTest.openAI(${JSON.stringify(url+'/chat')})`);await sleep(350);assert.equal(await snapshot(),original);
  await js('MouseTest.model.aiId="";MouseTest.applySide()');await click('[data-action=ai-fullscreen]');await until(full,'empty AI can expand');assertVisibleAIPresets(await js('({privateMode:MouseTest.model.privateMode,urls:[...document.querySelectorAll(".ai-preset-card")].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.dataset.aiUrl)})'),scope);await click('[data-action=ai-fullscreen]');await until(windowed,'empty restore');await js(`MouseTest.model.aiId=${JSON.stringify(aiId)};MouseTest.applySide()`);await sleep(300);
  for(const [id,p] of ids){assert.equal(browser.get(id).view.webContents.id,p.id);assert.equal(browser.get(id).navigationEpoch||0,p.epoch);}
  assert.equal(wc.id,aiWC);assert.equal(await wc.executeJavaScript('once'),once);assert.equal(await wc.executeJavaScript('document.querySelector("#draft").value'),'keep my draft');assert.equal(await snapshot(),original);
  console.log('MOUSE_614_AI_FULLSCREEN_RESTORE_'+scope.toUpperCase()+'_PASS');
 }finally{
  await js('MouseTest.restorePane();MouseNative.window("pane-restore")').catch(()=>{});if(win.isFullScreen()){win.setFullScreen(false);await until(windowed,'cleanup fullscreen');}await sleep(350);
  for(const t of browser.state().tabs)if(!beforeIds.has(t.id))await browser.command('close',{id:t.id});
  await js(`Object.assign(MouseTest.model,${JSON.stringify(saved)});MouseTest.setTheme(${JSON.stringify(saved.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);win.setBounds(bounds);win.removeListener('enter-full-screen',entered);win.removeListener('leave-full-screen',left);if(wasFull)win.setFullScreen(true);server.close();
 }
};
module.exports.waitForAIClosed=waitForAIClosed;
module.exports.assertVisibleAIPresets=assertVisibleAIPresets;
