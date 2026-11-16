 'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<240;i++){if(await fn())return;await sleep(60);}throw Error('Mouse614 timeout: '+label);}
module.exports=async({win,browser,scope='normal'})=>{
 const js=s=>win.webContents.executeJavaScript(s),bounds=win.getBounds(),wasFull=win.isFullScreen();
 const saved=await js('JSON.parse(JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,tabOrder:QuadroTest.model.tabOrder,theme:QuadroTest.model.theme,aiOpen:QuadroTest.model.aiOpen,aiId:QuadroTest.model.aiId,aiWidth:QuadroTest.model.aiWidth,aiSites:QuadroTest.model.aiSites,aiSessions:QuadroTest.model.aiSessions,libraryOpen:QuadroTest.model.libraryOpen}))');
 const beforeIds=new Set(browser.state().tabs.map(t=>t.id));
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>AI fullscreen fixture</title><input id="draft" value="keep my draft"><div style="height:2000px"></div><script>window.once=Math.random()</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const click=async selector=>{const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden button');return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(150);};
 const snapshot=()=>js('JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,aiWidth:QuadroTest.model.aiWidth,aiId:QuadroTest.model.aiId})');
 try{
  if(wasFull){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'initial window');await sleep(400);}
  await js(`QuadroTest.openPage(${JSON.stringify(url+'/main')})`);await js(`QuadroTest.changeLayout(6);QuadroTest.model.aiWidth=389;QuadroTest.model.libraryOpen=false;QuadroTest.openAI(${JSON.stringify(url+'/chat')})`);
  const aiId=await js('QuadroTest.model.aiId');await until(()=>!browser.get(aiId).loading,'AI ready');await sleep(200);
  const wc=browser.get(aiId).view.webContents,aiWC=wc.id,once=await wc.executeJavaScript('once');
  const original=await snapshot(),ids=new Map([...browser.tabs.values()].map(t=>[t.id,{id:t.view.webContents.id,epoch:t.navigationEpoch||0}]));
  assert.equal(await js('document.querySelectorAll(".ai-controls [data-action=ai-settings]").length'),0);
  assert.equal(await js('!!document.querySelector("#ai-select option[value=custom]")'),true);
  for(const theme of ['light','dark']){
   await js(`QuadroTest.setTheme('${theme}')`);await click('[data-action=ai-fullscreen]');
   await until(()=>win.isFullScreen(),'native fullscreen');await until(()=>browser.panels.length===1&&browser.panels[0].id===aiId,'only AI native panel');await sleep(350);
   const layout=await js('(()=>{const w=document.querySelector("#workspace").getBoundingClientRect(),p=document.querySelector("#ai-panel").getBoundingClientRect(),b=document.querySelector("[data-action=ai-fullscreen]");return{left:p.left-w.left,width:p.width-w.width,focused:QuadroTest.model.focusAI,pressed:b.getAttribute("aria-pressed"),symbol:b.textContent,stage:getComputedStyle(document.querySelector("#stage")).display}})()');
   assert.ok(Math.abs(layout.left)<1&&Math.abs(layout.width)<1);assert.equal(layout.focused,true);assert.equal(layout.pressed,'true');assert.equal(layout.symbol,'⤡');assert.equal(layout.stage,'none');assert.equal(await snapshot(),original);
   await fs.writeFile('mouse-614-ai-fullscreen-'+scope+'-'+theme+'.png',(await win.capturePage()).toPNG());
   await click('[data-action=ai-fullscreen]');await until(()=>!win.isFullScreen(),'restored native window');await sleep(350);assert.equal(await js('QuadroTest.model.focusAI'),false);assert.equal(await snapshot(),original);assert.equal(await js('document.querySelectorAll(".pane").length'),6);
  }
  await click('[data-action=ai-fullscreen]');await until(()=>win.isFullScreen(),'Escape entry');await sleep(350);wc.focus();wc.sendInputEvent({type:'keyDown',keyCode:'Escape'});wc.sendInputEvent({type:'keyUp',keyCode:'Escape'});await until(async()=>!win.isFullScreen()&&!await js('QuadroTest.model.focusAI'),'Escape from actual AI webContents');await sleep(350);assert.equal(await snapshot(),original);
  win.setFullScreen(true);await until(()=>win.isFullScreen(),'existing fullscreen');await sleep(350);await click('[data-action=ai-fullscreen]');await until(()=>browser.panels.length===1&&browser.panels[0].id===aiId,'existing fullscreen AI');await click('[data-action=ai-fullscreen]');await sleep(300);assert.equal(win.isFullScreen(),true,'must preserve pre-existing fullscreen');assert.equal(await js('QuadroTest.model.focusAI'),false);assert.equal(await snapshot(),original);
  win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave existing mode');await sleep(350);
  await click('[data-action=ai-fullscreen]');await until(()=>win.isFullScreen(),'close entry');await sleep(350);await click('[data-action=close-ai]');await until(async()=>!win.isFullScreen()&&!await js('QuadroTest.model.focusAI'),'close returns layout');assert.equal(await js('QuadroTest.model.aiOpen'),false);assert.ok(browser.tabs.has(aiId));await js('QuadroTest.action("ai")');await sleep(350);assert.equal(await snapshot(),original);
  await js('QuadroTest.model.aiId="";QuadroTest.applySide()');await click('[data-action=ai-fullscreen]');await until(()=>win.isFullScreen(),'empty AI can expand');assert.equal(await js('document.querySelectorAll(".ai-preset-card").length'),4);await click('[data-action=ai-fullscreen]');await until(()=>!win.isFullScreen(),'empty restore');await js(`QuadroTest.model.aiId=${JSON.stringify(aiId)};QuadroTest.applySide()`);await sleep(300);
  for(const [id,p] of ids){assert.equal(browser.get(id).view.webContents.id,p.id);assert.equal(browser.get(id).navigationEpoch||0,p.epoch);}
  assert.equal(wc.id,aiWC);assert.equal(await wc.executeJavaScript('once'),once);assert.equal(await wc.executeJavaScript('document.querySelector("#draft").value'),'keep my draft');assert.equal(await snapshot(),original);
  console.log('MOUSE_614_AI_FULLSCREEN_RESTORE_'+scope.toUpperCase()+'_PASS');
 }finally{
  await js('QuadroTest.restorePane();QuadroNative.window("pane-restore")').catch(()=>{});if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'cleanup fullscreen');}await sleep(350);
  for(const t of browser.state().tabs)if(!beforeIds.has(t.id))await browser.command('close',{id:t.id});
  await js(`Object.assign(QuadroTest.model,${JSON.stringify(saved)});QuadroTest.setTheme(${JSON.stringify(saved.theme)});QuadroTest.renderTree();QuadroTest.renderAISites();QuadroTest.applySide();QuadroTest.save()`);win.setBounds(bounds);if(wasFull)win.setFullScreen(true);server.close();
 }
};
