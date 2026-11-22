'use strict';
// Installed Electron/macOS proof. Local fixtures are explicitly test pages, never real service accounts.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {screen}=require('electron');
const {createPresetProof,ownedPresetPage,canonicalServices}=require('./mouse-637-presets-helpers.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,n=180){for(let i=0;i<n;i++){if(await fn())return;await sleep(60);}throw Error('Mouse622 timeout: '+label);}
const copy=x=>JSON.parse(JSON.stringify(x));
module.exports=async({app,win,browser,store})=>{
 const js=source=>win.webContents.executeJavaScript(source),native=require('./mouse-native-menu.node'),original=await js('MouseTest.prefs()'),bounds=win.getBounds(),bank=browser.mouseDesktops.bank,saved=bank.snapshot(),before=new Set(Object.keys(bank.members)),globals=copy(bank.global);
 const burrow623=require('./mouse-623-smoke.cjs')({win,js});
 const features624=require('./mouse-624-smoke.cjs')({win,browser,store,js,click,until,sleep,painted});
 let server,captureTab,captureOriginal,lastClick=null,intercepted=false;
 const selected=[];
 const proof=createPresetProof({app,browser,js,until,selectedRequests:selected,click:async selector=>{await click(selector);return copy(lastClick);},frame:painted});
 const {evidence:presetEvidence}=proof;
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
 try{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave full screen');await sleep(300);}
  const work=screen.getPrimaryDisplay().workArea;win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1200,work.width-16),height:Math.min(820,work.height-16)});await activate();
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');
  const fixtureFavicon=await fs.readFile(path.join(__dirname,'mouse/brand.png'));
  server=http.createServer((req,res)=>{if((req.url||'').split('?')[0]==='/favicon.png'){res.setHeader('Content-Type','image/png');res.end(fixtureFavicon);return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(ownedPresetPage(decodeURIComponent((req.url||'/').split('/').pop())));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root='http://127.0.0.1:'+server.address().port;
  presetEvidence.fixtureOrigin=root;const serviceURLs=canonicalServices();
  browser.session.webRequest.onBeforeRequest({urls:serviceURLs},(details,done)=>{selected.push(details.url);done({redirectURL:root+'/suggested/'+encodeURIComponent(details.url)});});intercepted=true;
  const {supportIds,allIds}=await proof.runCatalog();
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
   assert.equal(await js('document.querySelectorAll("#desk-modes [data-mode]").length'),4);assert.equal(await js('document.querySelectorAll("#desk-modes [data-mode=agents]").length'),0);assert.equal(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")'),'true');const expanded=await js('(()=>{const t=document.querySelector("#desktop-tray"),r=t.getBoundingClientRect(),c=t.querySelector(".desk-content");return{top:r.top,bottom:r.bottom,height:r.height,scrollTop:c.scrollTop,scrollHeight:c.scrollHeight,clientHeight:c.clientHeight}})()');assert.ok(expanded.height>compact.height+16&&expanded.top<compact.top-16,'Modes grow Nora upward to fit the added controls');assert.ok(Math.abs(expanded.bottom-compact.bottom)<=1,'Content growth keeps the footer anchor');assert.equal(expanded.scrollTop,0);assert.ok(expanded.scrollHeight<=expanded.clientHeight+1,'Expanded Nora has no internal vertical overflow');await painted();await fs.writeFile('mouse-622-modes-'+theme+'.png',(await win.capturePage()).toPNG());await burrow623.capture(theme,'modes');await click('#desks-close');
  }
  await burrow623.finish();
  await burrow623.verifyTabs({browser,bank,click,activate,root,native,until,sleep});
  await features624.verifyLayoutAndHistory({root,bank});await features624.verifyPageProgress({root,bank});await js('MouseTest.switchDesktop("desk-1")');
  await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").open'),'tray for switch');await click('[data-desk="desk-2"] .desk-open');await until(()=>js('MouseTest.model.desktopId==="desk-2"&&!MouseTest.model.switching'),'native desk switch');assert.equal(bank.items.length,5);
  console.log('MOUSE_622_FIVE_DESKS_MODES_PRESERVE_TABS_PASS');console.log('MOUSE_622_BURROW_PREVIEW_BOTH_THEMES_PASS');
  const facts={fixedDesks:5,suggestedRequests:selected.length,preservedTabs:allIds.length,hiddenCaptures,realThumbnails:true,presetEvidence};await fs.writeFile('mouse-622-verification.json',JSON.stringify(facts,null,2)+'\n');console.log('MOUSE_622_WORKSPACE_PRESETS_PASS',JSON.stringify({fixedDesks:5,preservedTabs:allIds.length,applications:presetEvidence.applications.length,selectedRequests:selected.length}));
 }catch(error){
  console.log('MOUSE_622_FAILURE_CONTEXT',JSON.stringify({lastClick,window:win.getBounds(),focused:win.isFocused()}));await fs.writeFile('mouse-622-failure.png',(await win.capturePage()).toPNG());throw error;
 }finally{
  if(captureTab&&captureOriginal)captureTab.capturePage=captureOriginal;

  if(intercepted)browser.session.webRequest.onBeforeRequest(null);
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.feedback.hide()').catch(()=>{});
  for(const id of Object.keys(bank.members))if(!before.has(id))await js(`MouseNative.desktops('close-tab',{id:${JSON.stringify(id)}})`).catch(()=>{});
  await js(`MouseTest.switchDesktop(${JSON.stringify(original.desktopId)})`).catch(()=>{});bank.items=copy(saved.items);bank.members=Object.assign(Object.create(null),saved.members);bank.active=saved.active;bank.global=globals;bank.recovery=saved.recovery?copy(saved.recovery):null;browser.mouseDesktops.previews.clear();
  await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);browser.emit();await browser.save();await store.queue;win.setBounds(bounds);server?.close();
 }
};
