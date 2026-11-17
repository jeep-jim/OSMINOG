'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const e=require('electron'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<160;n++){if(await fn())return;await sleep(75)}throw Error('Mouse620 timeout: '+label);}
module.exports=async({app,win,browser,libraryService,localCaptures,updates})=>{
 const js=s=>win.webContents.executeJavaScript(s),a=localCaptures.archive,lib=libraryService.library,box=win.getBounds(),originalDialog=e.dialog.showMessageBox,originalOpen=e.dialog.showOpenDialog;
 const originalUpdate=structuredClone(updates.state),originalData=structuredClone(lib.data),model=await js('JSON.parse(JSON.stringify({theme:MouseTest.model.theme,tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,libraryWidth:MouseTest.model.libraryWidth,libraryOpen:MouseTest.model.libraryOpen,aiOpen:MouseTest.model.aiOpen,aiWidth:MouseTest.model.aiWidth}))');
 let historyServer=null,historyTab=null;
 const temp=await fs.mkdtemp(path.join(app.getPath('userData'),'mouse620-fixtures-')),imageFile=path.join(temp,'620-preview.png'),folder=path.join(temp,'Screenshots');await fs.mkdir(folder);
 let answer=0;const fixtureText='<b>Fixture 620 — это текст, не HTML</b>\nЛокальная заметка 😀';
 async function click(selector){win.focus();win.webContents.focus();const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing620 control '+${JSON.stringify(selector)});const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(160);}
 async function query(text){await js(`(()=>{const e=document.querySelector('#library-query');e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(200);}
 try{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave fullscreen');await sleep(350)}
  win.setSize(1100,800);await js('MouseTest.browsing.close();MouseTest.model.libraryWidth=480;MouseTest.applySide()');
  assert.equal(a.enabled,false);assert.equal(a.reads,0);await assert.rejects(fs.stat(a.root),{code:'ENOENT'});
  // The real update service is held at synthetic transfer states. The actual click
  // must not start/check/cancel a transfer, and existing download tests remain intact.
  updates.state={...originalUpdate,phase:'downloading',percent:52,availableVersion:'6.0.21',latestVersion:'6.0.21'};
  await js('MouseTest.action("updates")');assert.equal(await js('document.querySelector("#update-dialog").open'),true);
  await click('#update-minimize');assert.equal(await js('document.querySelector("#update-dialog").open'),false);assert.equal(updates.state.phase,'downloading');
  updates.state.percent=73;win.webContents.send('mouse:update-state',updates.state);
  await until(()=>js('document.querySelector("#version-button").textContent.includes("73%")'),'minimized footer progress');
  await click('#version-button');assert.equal(await js('document.querySelector("#update-dialog").open'),true);assert.equal(updates.state.percent,73);
  await click('#update-minimize');await until(()=>browser.panels.length>0,'native pages restored after minimize');
  updates.state=originalUpdate;win.webContents.send('mouse:update-state',updates.state);
  const png=Buffer.from((await js(`(()=>{const c=document.createElement('canvas');c.width=240;c.height=140;const x=c.getContext('2d');x.fillStyle='#da3760';x.fillRect(0,0,120,140);x.fillStyle='#21a88c';x.fillRect(120,0,120,140);return c.toDataURL('image/png').split(',')[1]})()`)),'base64');await fs.writeFile(imageFile,png);
  lib.data.downloads.unshift({id:'mouse620-preview',filename:'620-preview.png',path:imageFile,state:'completed',received:png.length,total:png.length,at:Date.now()});
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}');MouseTest.model.aiOpen=true;MouseTest.applySide()`);await sleep(150);
   const controls=await js(`(()=>{const sheet=[...document.styleSheets].find(s=>s.href?.endsWith('/mouse-620.css'));const sample=()=>[...document.querySelectorAll('.pane-head button')].map(e=>[getComputedStyle(e).borderRadius,e.offsetWidth,e.offsetHeight]);const after=sample();sheet.disabled=true;const before=sample();sheet.disabled=false;const ai=[...document.querySelectorAll('#ai-panel>.ai-controls>button')].map(e=>getComputedStyle(e).borderRadius);return{before,after,ai,newTab:[document.querySelector('#new-tab').offsetWidth,document.querySelector('#new-tab').offsetHeight]}})()`);
   assert.deepEqual(controls.after,controls.before,'owner main pane circles must remain unchanged');assert.ok(controls.ai.length>=3);assert.ok(controls.ai.every(x=>x==='5px'));assert.deepEqual(controls.newTab,[28,28]);
   await js('MouseTest.browsing.open("downloads")');await query('620-preview');await click('#library-grid');
   await until(()=>js('document.querySelector(".library-thumbnail")?.complete&&document.querySelector(".library-thumbnail").naturalWidth>32'),'actual thumbnail');
   const actual=await js(`(()=>{const i=document.querySelector('.library-thumbnail'),c=document.createElement('canvas');c.width=2;c.height=1;const x=c.getContext('2d');x.drawImage(i,0,0,2,1);return [...x.getImageData(0,0,2,1).data]})()`);assert.ok(actual[0]>150&&actual[5]>100,'thumbnail has original image pixels, not a file icon');
   await fs.writeFile('mouse-620-download-previews-'+theme+'.png',(await win.capturePage()).toPNG());
   await click('[data-library=captures]');await until(()=>js('!document.querySelector("#library-capture-settings").hidden'),'captures section');
   const g=await js(`(()=>{const c=document.querySelector('#library-select-all'),s=getComputedStyle(c),t=document.querySelector('#capture-auto'),r=c.getBoundingClientRect();return{width:r.width,height:r.height,appearance:s.appearance,toggleWidth:t.getBoundingClientRect().width,overflow:document.querySelector('#library-dialog').scrollWidth-document.querySelector('#library-dialog').clientWidth}})()`);
   assert.equal(g.width,16);assert.equal(g.height,16);assert.equal(g.appearance,'none');assert.equal(g.toggleWidth,30);assert.ok(g.overflow<=1);
  }
  e.dialog.showMessageBox=async()=>({response:answer});e.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});
  await click('#capture-watch-folder');assert.equal(a.folder,folder);
  await e.clipboard.writeText('fixture before enable');await click('#capture-auto');assert.equal(a.enabled,false,'cancel keeps collection off');assert.equal(a.reads,0);
  answer=1;await click('#capture-auto');await until(()=>a.enabled,'explicit enable');assert.equal(a.items.length,0);
  await until(()=>js('document.querySelector("#screenshot-button").dataset.archiveActive==="true"'),'visible recording indicator');
  await e.clipboard.writeText(fixtureText);await until(()=>a.items.some(x=>x.type==='text'),'real OS clipboard text collected');
  const textRow=a.items.find(x=>x.type==='text');assert.equal(await fs.readFile(path.join(a.root,textRow.file),'utf8'),fixtureText);
  const sourceImage=path.join(folder,'620-new-shot.png');await fs.writeFile(sourceImage,png);await until(()=>a.items.some(x=>x.type==='image'),'new screenshot-folder image');
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}');MouseTest.browsing.open('captures')`);await click('#library-grid');
   await until(()=>js('document.querySelectorAll(".library-row").length===2'),'local archive cards');
   await until(()=>js('(()=>{const i=document.querySelector(".library-capture-image .library-thumbnail");return i?.dataset.loaded==="true"&&i.complete&&i.naturalWidth>32;})()'),'decoded real archive image, not the fallback');
   const cardGeometry=await js(`(()=>{const image=document.querySelector('.library-capture-image img'),c=document.createElement('canvas');c.width=2;c.height=1;const x=c.getContext('2d');x.drawImage(image,0,0,2,1);const titles=[...document.querySelectorAll('#library-rows .library-row')].map(row=>{const b=row.querySelector('.library-name').getBoundingClientRect(),a=row.querySelector('.library-remove').getBoundingClientRect(),k=row.querySelector('.library-check').getBoundingClientRect();return b.top>=Math.max(a.bottom,k.bottom)+3;});const toggle=document.querySelector('#capture-auto').getBoundingClientRect(),label=document.querySelector('.capture-switch-label span').getBoundingClientRect();return{pixels:[...x.getImageData(0,0,2,1).data],titles,inline:label.left>toggle.right&&Math.abs((label.top+label.bottom-toggle.top-toggle.bottom)/2)<2}})()`);
   assert.ok(cardGeometry.pixels[0]>150&&cardGeometry.pixels[5]>100,'archive tile must show original pixels');assert.ok(cardGeometry.titles.every(Boolean),'titles do not overlap remove or checkbox');assert.ok(cardGeometry.inline,'switch and label share one aligned row');
   await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   const checks=await js(`[...document.querySelectorAll('.library-check')].map(c=>{const r=c.getBoundingClientRect();return[r.width,r.height,getComputedStyle(c).margin]})`);assert.ok(checks.every(v=>v[0]===16&&v[1]===16&&v[2]==='0px'));
   await fs.writeFile('mouse-620-local-archive-'+theme+'.png',(await win.capturePage()).toPNG());
   await click(`[data-id="${textRow.id}"] .library-name`);await until(()=>js('document.querySelector("#local-preview-dialog").open'),'text preview opens');
   assert.equal(await js('document.querySelector(".local-text-full").textContent'),fixtureText);assert.equal(await js('document.querySelector(".local-text-full b")'),null);
   await fs.writeFile('mouse-620-text-preview-'+theme+'.png',(await win.capturePage()).toPNG());await click('#local-preview-dialog button');
  }
  // Simulated OS lock notification verifies the pause path without locking CI.
  const reads=a.reads;e.powerMonitor.emit('lock-screen');await e.clipboard.writeText('locked-only sentinel');await a.tick();assert.equal(a.reads,reads);e.powerMonitor.emit('unlock-screen');await a.tick();assert.ok(!a.items.some(x=>x.snippet.includes('locked-only sentinel')));
  await click('#capture-auto');await until(()=>!a.enabled,'turn collection off');await a.queue;const finalReads=a.reads;await e.clipboard.writeText('off-only sentinel');await a.tick();assert.equal(a.reads,finalReads);
  assert.equal((await new (require('./mouse-capture-archive.cjs').CaptureArchive)({root:a.root,clipboard:e.clipboard,nativeImage:e.nativeImage}).init()).items.length,2,'local archive survives workspace-independent reload');
  await click('#library-select-all');answer=0;await click('#library-clear');assert.equal(a.items.length,2);answer=1;await click('#library-clear');await until(()=>a.items.length===0,'clear only archive copies');assert.deepEqual(await fs.readFile(sourceImage),png);assert.deepEqual(await fs.readFile(imageFile),png);
  // Actual Chromium navigation events, not direct Library.visit fixture calls.
  historyServer=require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>620 history fixture</title><p>Meaningful visit fixture</p>');});
  await new Promise(resolve=>historyServer.listen(0,'127.0.0.1',resolve));const root='http://127.0.0.1:'+historyServer.address().port;
  historyTab=(await browser.command('open',{url:root+'/page',lane:'main'})).id;const wc=browser.get(historyTab).view.webContents;
  await until(()=>lib.list('history',root).total===1,'real navigation stored once');const first=lib.list('history',root).items[0].id;
  await wc.executeJavaScript(`for(let i=0;i<15;i++){history.replaceState({},'', '/page?filter='+i+'#section'+i);document.title='Action '+i;}`);await sleep(900);
  assert.equal(lib.list('history',root).total,1);assert.equal(lib.list('history',root).items[0].id,first);
  await browser.command('reload',{id:historyTab});await until(()=>!browser.get(historyTab).loading,'reload loaded');await sleep(700);assert.equal(lib.list('history',root).total,1);
  await wc.executeJavaScript("history.pushState({},'', '/different-page');document.title='A separate page'");await until(()=>lib.list('history',root).total===2,'meaningful route preserved');
  await wc.loadURL(root+'/api/challenge_redirect?t=1');await sleep(700);assert.equal(lib.list('history',root).total,2,'technical challenge is not a visit');
  await js(`MouseTest.browsing.open('history')`);await query(root);await until(()=>js('document.querySelectorAll(".library-row").length===2'),'grouped actual history');
  await fs.writeFile('mouse-620-history.png',(await win.capturePage()).toPNG());
  console.log('MOUSE_620_REAL_HISTORY_NO_ACTION_FLOOD_PASS');
  console.log('MOUSE_620_UPDATE_HEAD_PREVIEW_ARCHIVE_CONTROLS_PASS');
 }finally{
  if(historyTab&&browser.tabs.has(historyTab))await browser.command('close',{id:historyTab});historyServer?.close();
  e.dialog.showMessageBox=originalDialog;e.dialog.showOpenDialog=originalOpen;updates.state=originalUpdate;win.webContents.send('mouse:update-state',updates.state);
  await a.configure({enabled:false});await js('document.querySelector("#local-preview-dialog")?.open&&document.querySelector("#local-preview-dialog").close();document.querySelector("#update-dialog").open&&document.querySelector("#update-dialog").close();MouseTest.browsing.close()').catch(()=>{});
  lib.data=originalData;await libraryService.flush();await js(`Object.assign(MouseTest.model,${JSON.stringify(model)});MouseTest.setTheme(${JSON.stringify(model.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);win.setBounds(box);
 }
};
