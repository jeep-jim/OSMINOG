'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<240;n++){if(await fn())return;await sleep(60);}throw Error('Timed out '+label);}
module.exports=async({app,win,browser,store,privateMode,localCaptures})=>{
 let server;const js=s=>win.webContents.executeJavaScript(s),marker='PRIVATE_SENTINEL_606_6f532';
 async function initialStartPlaced(){
  const current=privateMode.current,ids=[...current.startService.tabs.keys()],p=current.desktopService.preferences();
  assert.equal(ids.length,1,'A fresh private session owns exactly one initial start tab');assert.deepEqual(p.slots,{p1:ids[0]},'The initial private start tab is placed before the renderer loads');assert.equal(p.active,'p1');assert.deepEqual(p.tabOrder,ids);
  const h=current.desktopService.bank.historyState(p.desktopId,true);assert.equal(h.canUndo,false,'Private bootstrap is the initial checkpoint, not an undoable empty layout');assert.equal(h.canRedo,false);assert.equal(h.entries.length,1);assert.deepEqual(h.entries[0].slots,{p1:ids[0]});
  assert.deepEqual(await js('({active:MouseTest.model.active,slots:MouseTest.model.slots,tabOrder:MouseTest.model.tabOrder})'),{active:'p1',slots:{p1:ids[0]},tabOrder:ids},'Renderer adopts the same initial private placement');
 }
 try{
  server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Private test fixture</title><input id="field"><script>window.loaded=Math.random()</script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
  await js(`MouseTest.openPage(${JSON.stringify(root+'/normal')})`);await until(()=>[...browser.tabs.values()].some(t=>!t.loading&&t.url===root+'/normal'),'normal fixture');
  const normal=[...browser.tabs.values()].find(t=>t.url===root+'/normal'),wc=normal.view.webContents,id=wc.id,loaded=await wc.executeJavaScript('loaded');
  await browser.session.cookies.set({url:root,name:'ordinary',value:'keep-normal'});await wc.executeJavaScript('localStorage.setItem("normal","retained")');
  const progress=await wc.executeJavaScript('MouseAgent.updateProgress(55,"Normal fixture progress",{taskId:"624-private-boundary"})');assert.equal(progress.source,'page');assert.equal(progress.tabId,normal.id);
  await until(()=>js(`!!document.querySelector('.mouse-progress-pill[data-progress-id="${progress.id}"]')`),'normal progress paints before privacy');
  await localCaptures.archive.configure({enabled:true});
  const captureReads=localCaptures.archive.reads;
  // Enter via actual footer mouse events, not just a direct service method.
  const p=await js('(()=>{const r=document.querySelector("#private-button").getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()');win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});
  await until(()=>privateMode.current&&!privateMode.busy,'enter private');
  assert.equal(await js('document.documentElement.dataset.private'),'true');
  assert.deepEqual((await js('MouseNative.progress("state")')).tasks,[],'Private shell exposes no normal progress');
  assert.equal(await js('MouseNative.archive("list",{}).then(()=>false,()=>true)'),true);
  await localCaptures.archive.tick();assert.equal(localCaptures.archive.reads,captureReads);assert.equal(localCaptures.archive.items.length,0);
  await require('electron').clipboard.writeText('PRIVATE_CAPTURE620_SENTINEL');
  assert.equal(await js('getComputedStyle(document.querySelector(".private-welcome")).display'),'block');
  await initialStartPlaced();
  await require('./mouse-611-smoke.cjs')({win});
  if(!process.argv.includes('--mouse-private-close'))await require('./mouse-614-smoke.cjs')({win,browser:privateMode.current.browser,scope:'private'});
  if(!process.argv.includes('--mouse-private-close'))await require('./mouse-emoji-smoke.cjs')({app,win,browser:privateMode.current.browser,scope:'private'});
  const first=privateMode.current,ses=first.ses;assert.equal(ses.isPersistent(),false);assert.equal(ses.storagePath,null);
  assert.equal((await ses.cookies.get({url:root})).length,0);
  await js(`MouseTest.openPage(${JSON.stringify(root+'/'+marker)})`);await until(()=>[...first.browser.tabs.values()].some(t=>!t.loading),'private fixture');
  const page=[...first.browser.tabs.values()][0].view.webContents;
  assert.equal(await page.executeJavaScript('typeof MouseAgent.updateProgress'),'function');assert.equal(await page.executeJavaScript('MouseAgent.updateProgress(90,"Private fixture",{taskId:"624-private-denied"}).then(()=>false,()=>true)'),true,'Actual private-page IPC is rejected');
  assert.equal(await page.executeJavaScript('typeof ethereum'),'undefined');assert.equal(await page.executeJavaScript('localStorage.getItem("normal")'),null);
  await ses.cookies.set({url:root,name:'private-marker',value:marker,expirationDate:Date.now()/1000+3600});
  await page.executeJavaScript(`localStorage.setItem('private',${JSON.stringify(marker)});sessionStorage.setItem('private',${JSON.stringify(marker)})`);
  await page.executeJavaScript(`new Promise((resolve,reject)=>{const r=indexedDB.open('private-db');r.onupgradeneeded=()=>r.result.createObjectStore('test');r.onsuccess=()=>{const db=r.result,t=db.transaction('test','readwrite');t.objectStore('test').put(${JSON.stringify(marker)},'data');t.oncomplete=()=>{db.close();resolve(true)}};r.onerror=()=>reject(r.error)})`);
  assert.equal(first.libraryService.library.data.history.length,0);assert.equal(first.libraryService.library.data.searches.length,0);
  assert.equal(await js('typeof MouseNative.web3 === "undefined" && typeof MouseNative.wallet === "undefined"'),true);
  assert.equal(await js('MouseNative.update("check").then(()=>false,()=>true)'),true);
  assert.equal(await js('MouseNative.start("background").then(()=>false,()=>true)'),true);
  await js('MouseTest.changeLayout(2)');await js('MouseTest.save()');
  await fs.writeFile('mouse-incognito-dark.png',(await win.capturePage()).toPNG());
  if(process.argv.includes('--mouse-private-close')){console.log('MOUSE_PRIVATE_CLOSE_READY');server.close();win.close();return;}
  await privateMode.leave();
  await localCaptures.archive.tick();assert.equal(localCaptures.archive.items.length,0);await localCaptures.archive.configure({enabled:false});
  assert.equal(await js('document.documentElement.dataset.private'),'false');assert.equal(privateMode.current,null);assert.equal(first.store.destroyed,true);assert.equal(first.browser.tabs.size,0);assert.equal((await ses.cookies.get({url:root})).length,0);
  assert.equal(browser.get(normal.id).view.webContents.id,id);assert.equal(await wc.executeJavaScript('loaded'),loaded);assert.equal(await wc.executeJavaScript('localStorage.getItem("normal")'),'retained');assert.equal((await browser.session.cookies.get({url:root,name:'ordinary'}))[0].value,'keep-normal');
  assert.deepEqual((await js('MouseNative.progress("state")')).tasks,[],'Normal progress was cleared, not merely hidden while private');console.log('MOUSE_624_PRIVATE_PROGRESS_SCOPE_PASS');
  await browser.save();await browser.saveQueue;await store.queue;const profile=await fs.readFile(path.join(app.getPath('userData'),'workspace.json'),'utf8');assert.ok(!profile.includes(marker));assert.ok(!profile.includes('mouse-private-'));
  await privateMode.enter();assert.notEqual(privateMode.current.partition,first.partition);assert.equal((await privateMode.current.ses.cookies.get({url:root})).length,0);await initialStartPlaced();await privateMode.leave();
  console.log('MOUSE_PRIVATE_MEMORY_ISOLATION_CLEANUP_NORMAL_UNCHANGED_PASS');
  console.log('MOUSE_PRIVATE_MASCOT_GLASSES_REAL_BUTTON_PASS');server.close();app.exit(0);
 }catch(error){console.error(error);await fs.writeFile('mouse-private-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});server?.close();app.exit(1);}
};
