'use strict';

// Installed Windows acceptance. Existing document, search, progress, Nora and
// scrollbar proofs keep their original assertions and use a real User32 driver.
// HTTP pages, permissions and files are owned fixtures in the isolated CI profile.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),syncFS=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {screen,globalShortcut}=require('electron');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {assertProfilePreferences}=require('./mouse-637-profile-compat.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const PRIVATE_MARKER='MOUSE_WINDOWS_PRIVATE_SENTINEL_629';
const PROFILE_KEY='mouseWindows629Verification';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function until(check,label,timeout=15000){const deadline=Date.now()+timeout;do{if(await check())return;await sleep(50);}while(Date.now()<deadline);throw Error('Windows native verification timed out: '+label);}
function alive(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}}

module.exports=async ctx=>{
 const {app,win,browser,store,libraryService,privateMode,globalCapture}=ctx;
 const updateMode=process.argv.includes('--mouse-windows-update-smoke'),readMode=process.argv.includes('--mouse-windows-smoke-read'),mode=updateMode?'update':readMode?'read':'write';
 const js=source=>win.webContents.executeJavaScript(source),exit=require('./mouse-smoke-exit.cjs')({app,win});
 const facts={ok:false,version:app.getVersion(),platform:process.platform,arch:process.arch,mode,pid:process.pid,checks:{},physicalTrackpadVerified:false,liveExternalAccountsVerified:false};
 const expectedProfileVersion=readMode&&process.argv.includes('--mouse-windows-upgrade-from=6.0.29')?'6.0.29':app.getVersion();
 const report='mouse-windows-smoke-'+mode+'.json';
 let server,nativeInput,origin,currentStep='identity';
 const save=()=>fs.writeFile(report,JSON.stringify(facts,null,2)+'\n');
 const watchdog=setTimeout(()=>{console.error('MOUSE_WINDOWS_SMOKE_TIMEOUT',currentStep);app.exit(1);},updateMode?210000:readMode?150000:1440000);watchdog.unref();
 const frame=()=>js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 async function focus(){win.show();if(win.isMinimized())win.restore();win.focus();win.webContents.focus();await until(()=>win.isFocused(),'native window foreground');await frame();}
 async function click(selector){
  await focus();let point;await until(async()=>{point=await js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}))`);return point.ready===true;},'native control '+selector).catch(error=>{error.message+='; last hit test: '+JSON.stringify(point);throw error;});
  const bounds=win.getContentBounds();assert.equal(nativeInput.testClick(bounds.x+point.x,bounds.y+point.y),true);await sleep(80);
 }
 async function checkbox(selector,checked){
  await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;e.scrollIntoView({block:'nearest'});})()`);
  if(await js(`document.querySelector(${JSON.stringify(selector)}).checked`)!==checked)await click(selector);
  await until(()=>js(`document.querySelector(${JSON.stringify(selector)}).checked===${checked}`),'checkbox '+selector);
 }
 async function step(name,operation){currentStep=name;console.log('MOUSE_WINDOWS_STEP',name);const started=performance.now();await operation();facts.checks[name]={ok:true,elapsedMs:Math.round(performance.now()-started)};await save();}
 async function serve(port=0){
  server=http.createServer((request,response)=>{
   if(request.url==='/favicon.ico'){response.writeHead(204);response.end();return;}
   response.setHeader('Content-Type','text/html; charset=utf-8');
   response.end('<!doctype html><meta charset="utf-8"><title>Windows native Mouse fixture</title><style>body{margin:12px;background:#246487;color:white;font:16px system-ui;min-height:180vh}input{width:70%;height:32px}button{height:32px}</style><h1>Mouse Browser Windows fixture</h1><input id="retained" value="Unsaved Windows field"><button id="action">Native action</button><p id="result">Ready</p><a id="next" href="/second">Next page</a><script>globalThis.mouseWindowsIdentity=Math.random();document.querySelector("#action").onclick=()=>document.querySelector("#result").textContent="Windows native click";globalThis.windowsKeys=[];document.addEventListener("keydown",e=>windowsKeys.push({key:e.key,control:e.ctrlKey,trusted:e.isTrusted}));globalThis.mouseWindowsPointerEvents=[];globalThis.mouseWindowsPointerSequence=0;if(location.pathname==="/agent-cdp")for(const type of ["pointermove","pointerdown","pointerup","mousedown","mouseup","click"])document.addEventListener(type,e=>{mouseWindowsPointerEvents.push({sequence:++globalThis.mouseWindowsPointerSequence,type:e.type,trusted:e.isTrusted,targetId:e.target.id||"",x:e.clientX,y:e.clientY,button:e.button,at:performance.now(),identity:mouseWindowsIdentity,timeOrigin:performance.timeOrigin,scrollX,scrollY,viewport:{width:innerWidth,height:innerHeight}});if(mouseWindowsPointerEvents.length>64)mouseWindowsPointerEvents.shift();},{capture:true,passive:true});</script>');
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin='http://127.0.0.1:'+server.address().port;
 }
 async function open(url){
  await js(`MouseTest.openPage(${JSON.stringify(url)},MouseTest.model.active)`);let page;
  await until(async()=>{const id=await js('MouseTest.model.slots[MouseTest.model.active]');page=browser.get(id);return page&&!page.loading&&page.view.webContents.getURL()===url;},'native page '+url);
  assert.equal(page.error,'');assert.equal(await page.view.webContents.executeJavaScript('typeof mouseWindowsIdentity'),'number');return page;
 }
 async function nativePages(){
  const work=screen.getDisplayMatching(win.getBounds()).workArea;assert.ok(work.width>=800&&work.height>=600);
  win.setBounds({x:work.x,y:work.y,width:Math.min(1320,work.width),height:Math.min(900,work.height)});await focus();
  const prepared=[];for(let i=0;i<6;i++)prepared.push(await open(origin+'/pane/'+i));
  for(const count of [1,2,4,6]){
   await js(`(async()=>{await MouseTest.changeLayout(${count});const m=MouseTest.model,ids=${JSON.stringify(prepared.map(page=>page.id))};m.classicTabId='';m.slots=Object.fromEntries(MouseLayout.leaves(m.tree).map((pane,index)=>[pane,ids[index]]));MouseTest.renderTree();MouseTest.requestLayout();await MouseTest.save();})()`);
   await until(async()=>{const boxes=await js(`Array.from(document.querySelectorAll('.pane')).map(p=>{const r=p.querySelector('.page-slot').getBoundingClientRect();return{id:MouseTest.model.slots[p.dataset.pane],x:r.x,y:r.y,width:r.width,height:r.height}})`);return boxes.length===count&&boxes.every(box=>{const page=browser.get(box.id);return page?.visible&&page.view.getVisible()&&['x','y','width','height'].every(key=>Math.abs(page.bounds[key]-box[key])<=1.5);});},count+' real native panes match the shell');
  }
  const sourcePage=await open(origin+'/first'),sourceId=sourcePage.id;
  const {nativeLinkInput,readback:readGrid}=require('./mouse-641-ai-link-routing.cjs');
  const read=()=>js('('+readGrid.toString()+')()'),sourceIdentity=()=>sourcePage.view.webContents.executeJavaScript('({identity:mouseWindowsIdentity,timeOrigin:performance.timeOrigin,url:location.href,field:document.querySelector("#retained").value,scrollX,scrollY})');
  await sourcePage.view.webContents.executeJavaScript('document.querySelector("#next").scrollIntoView({block:"center"});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const before=await read(),beforeIdentity=await sourceIdentity(),beforeIds=new Set(browser.tabs.keys());
  const linkInput=await nativeLinkInput({app,win,nativeInput,fixture:{js,until,frame,pageJS:(record,script)=>record.page.view.webContents.executeJavaScript(script)},record:{id:sourceId,page:sourcePage},selector:'#next'});let page;
  await until(()=>{page=[...browser.tabs.values()].find(candidate=>!beforeIds.has(candidate.id)&&candidate.view.webContents.getURL()===origin+'/second');return page&&!page.loading&&page.visible;},'native intercepted link opens a new ordinary page');
  const id=page.id;await until(()=>js('MouseTest.model.classicTabId==='+JSON.stringify(id)),'native linked page is active classic');const classic=await read();
  assert.equal(classic.view,'classic');assert.deepEqual(classic.panes,[{id:'p0',view:'classic'}]);assert.equal(classic.returnVisible,true);assert.equal(page.lane,'main');assert.equal(page.previewOf||'','');
  assert.deepEqual(classic.tree,before.tree);assert.deepEqual(classic.slots,before.slots);assert.deepEqual(await sourceIdentity(),beforeIdentity);assert.equal(browser.get(sourceId),sourcePage);
  // Same-page history is exercised through the visible address input. Anchors
  // intentionally create classic tabs in641 and cannot be used as that setup.
  const addressInputs=[];
  async function address(url){
   const selector='.pane[data-pane="p0"] .pane-address input';await click(selector);assert.equal(nativeInput.testKey('CTRL+A'),true);await win.webContents.insertText(url);
   await until(()=>js('document.querySelector('+JSON.stringify(selector)+').value==='+JSON.stringify(url)),'native address value');
   await js(`globalThis.__mouseWindowsAddress=[];document.querySelector(${JSON.stringify(selector)}).form.addEventListener('submit',event=>__mouseWindowsAddress.push({trusted:event.isTrusted,at:Date.now(),value:event.target.querySelector('input').value}),{capture:true,once:true});true`);
   assert.equal(nativeInput.testKey('ENTER'),true);await until(()=>!page.loading&&page.view.webContents.getURL()===url,'native address commits '+url);
   const events=await js('__mouseWindowsAddress');assert.equal(events.length,1);assert.equal(events[0].trusted,true);assert.equal(events[0].value,url);addressInputs.push({selector,source:'User32',pid:process.pid,url,events});
  }
  await address(origin+'/first');await address(origin+'/second');
  facts.navigation={id,link:linkInput,sourceId,sourceWebContentsId:sourcePage.view.webContents.id,beforeGrid:before,classic,sourceBefore:beforeIdentity,sourceAfter:await sourceIdentity(),addressInputs,native:{url:page.view.webContents.getURL(),back:page.view.webContents.navigationHistory.canGoBack(),forward:page.view.webContents.navigationHistory.canGoForward()},guest:await page.view.webContents.executeJavaScript('({historyLength:history.length,userActivation:navigator.userActivation.hasBeenActive})')};await save();
  await click('.pane.active [data-pane-action="back"]');await until(()=>!page.loading&&page.view.webContents.getURL()===origin+'/first','native back');
  await click('.pane.active [data-pane-action="forward"]');await until(()=>!page.loading&&page.view.webContents.getURL()===origin+'/second','native forward');
  const old=await page.view.webContents.executeJavaScript('mouseWindowsIdentity');await click('.pane.active [data-pane-action="reload"]');
  await until(async()=>!page.loading&&await page.view.webContents.executeJavaScript('mouseWindowsIdentity')!==old,'native reload');assert.equal(browser.get(id),page);
  await click('#return-to-grid');await until(()=>js('!MouseTest.model.classicTabId'),'native Grid control restores Windows grid');facts.navigation.returnedGrid=await read();
  assert.deepEqual(facts.navigation.returnedGrid.tree,before.tree);assert.deepEqual(facts.navigation.returnedGrid.slots,before.slots);assert.deepEqual(facts.navigation.returnedGrid.panes,before.panes);assert.deepEqual(await sourceIdentity(),beforeIdentity);
  facts.nativePages={layouts:[1,2,4,6],pageId:id,webContentsId:page.view.webContents.id,back:true,forward:true,reload:true,linkClassic:true,originalGridPreserved:true};
  console.log('MOUSE_WINDOWS_NATIVE_PAGES_NAVIGATION_PASS');
 }
 async function desktops(){
  const bank=browser.mouseDesktops.bank;assert.equal(bank.items.length,5);const records=[];
  for(const desk of bank.items){
   await js(`MouseTest.switchDesktop(${JSON.stringify(desk.id)})`);await until(()=>bank.active===desk.id,'switch to '+desk.id);
   const page=await open(origin+'/desktop/'+desk.id),wc=page.view.webContents;
   const field='Unsaved '+desk.id;await wc.executeJavaScript(`document.querySelector('#retained').value=${JSON.stringify(field)}`);
   records.push({desk:desk.id,id:page.id,wc:wc.id,identity:await wc.executeJavaScript('mouseWindowsIdentity'),field,url:wc.getURL()});
  }
  for(const record of [...records].reverse()){
   await js(`MouseTest.switchDesktop(${JSON.stringify(record.desk)})`);const page=browser.get(record.id);
   await until(()=>page.visible&&page.view.getVisible(),'restored desktop native page');assert.equal(page.view.webContents.id,record.wc);
   assert.deepEqual(await page.view.webContents.executeJavaScript('({identity:mouseWindowsIdentity,field:document.querySelector("#retained").value})'),{identity:record.identity,field:record.field});
  }
  facts.desktops=records;console.log('MOUSE_WINDOWS_FIVE_DESKTOPS_IDENTITY_PASS');
 }
 async function windowsControls(){
  const bounds=win.getBounds();assert.equal(win.isMaximized(),false);
  await click('[data-window="zoom"]');await until(()=>win.isMaximized(),'native maximize button');
  await click('[data-window="zoom"]');await until(()=>!win.isMaximized(),'native restore button');
  await click('[data-window="minimize"]');await until(()=>win.isMinimized(),'native minimize button');win.restore();await focus();
  win.setBounds(bounds);facts.windowControls={maximize:true,restore:true,minimize:true,normalClose:'native quit button at the end of this process'};console.log('MOUSE_WINDOWS_NATIVE_WINDOW_CONTROLS_PASS');
 }
 async function shortcuts(){
  const page=await open(origin+'/shortcuts');await focus();const local=await page.view.webContents.executeJavaScript('(()=>{const e=document.querySelector("#retained"),r=e.getBoundingClientRect();e.value="Windows Ctrl+A selection";return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
  const content=win.getContentBounds();nativeInput.testClick(content.x+page.bounds.x+local.x,content.y+page.bounds.y+local.y);await until(()=>page.view.webContents.executeJavaScript('document.activeElement?.id==="retained"'),'native webpage input focus');
  assert.equal(globalShortcut.isRegistered('Control+A'),false);nativeInput.testKey('CTRL+A');
  await until(()=>page.view.webContents.executeJavaScript('(()=>{const e=document.querySelector("#retained");return e.selectionStart===0&&e.selectionEnd===e.value.length&&windowsKeys.some(k=>k.key.toLowerCase()==="a"&&k.control&&k.trusted)})()'),'Ctrl+A selects the native webpage text');
  assert.ok(!globalCapture.editor&&!globalCapture.busy,'Ctrl+A does not invoke screen capture');assert.equal(globalCapture.state().registered,true);assert.equal(globalShortcut.isRegistered('Control+Alt+S'),true);
  const before=globalCapture.captureCount;nativeInput.testKey('CTRL+ALT+S');await until(()=>globalCapture.editor&&!globalCapture.busy,'native global screenshot shortcut',25000);
  assert.equal(globalCapture.captureCount,before+1);assert.equal(globalCapture.editor.isVisible(),true);assert.equal(await globalCapture.editor.webContents.executeJavaScript('document.documentElement.dataset.captureReady'),'true');
  const editor=globalCapture.editor;await fs.writeFile('mouse-windows-global-capture.png',(await editor.capturePage()).toPNG());
  const p=await editor.webContents.executeJavaScript(`(${nativeHitTarget.toString()})(document.querySelector('#capture-close'))`);assert.equal(p.ready,true);const box=editor.getContentBounds();nativeInput.testClick(box.x+p.x,box.y+p.y);await until(()=>!globalCapture.editor,'native screenshot close');await focus();
  facts.shortcuts={ctrlASelected:true,ctrlARegistered:false,captureShortcut:'Control+Alt+S',realScreenCapture:true};console.log('MOUSE_WINDOWS_CTRL_A_CAPTURE_SHORTCUT_PASS');
 }
 async function noraMotion(shared){
  // The desktop identity fixture leaves desk1 in its original one-pane layout.
  // The retained628 corner/motion proof needs real split panes beside Nora.
  const copy=value=>JSON.parse(JSON.stringify(value)),bank=browser.mouseDesktops.bank,original=await js('MouseTest.prefs()'),savedBank=bank.snapshot(),savedGlobal=copy(bank.global),before=new Set(browser.tabs.keys()),pages=[];
  facts.noraFixture={layout:4,restored:false};let verificationError;
  try{
   for(let i=0;i<4;i++){const opened=await browser.command('open',{url:origin+'/nora-motion/'+i,lane:'main'});pages.push(browser.get(opened.id));}
   await until(()=>pages.every(page=>!page.loading&&!page.error),'owned Nora fixture pages load');
   const layout=require('./mouse/layout.js'),tree=layout.preset(4),leaves=layout.leaves(tree),slots=Object.fromEntries(leaves.map((id,i)=>[id,pages[i].id]));
   await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:${JSON.stringify(slots)},active:${JSON.stringify(leaves[0])},classicTabId:'',aiOpen:false,libraryOpen:false,focusPane:'',focusAI:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);
   await until(()=>pages.every(page=>page.visible&&page.view.getVisible()),'four real Nora fixture panes are visible');await frame();
   const corners=await js(`Array.from(document.querySelectorAll('.pane')).filter(p=>parseFloat(p.style.getPropertyValue('--pane-round-bottom'))>=4).map(p=>MouseTest.model.slots[p.dataset.pane])`);
   assert.ok(corners.length>=2&&corners.every(id=>pages.some(page=>page.id===id)),'Owned split layout supplies real rounded native corners');
   facts.noraFixture.pageIds=pages.map(page=>page.id);facts.noraFixture.roundedPageIds=corners;await save();
   await require('./mouse-628-ui-smoke.cjs')(shared);
  }catch(error){verificationError=error;throw error;}
  finally{
   try{
    await js('MouseTest.desktopUI.close({immediate:true});MouseFlush()');await until(()=>!browser.mouseSurfaceHold,'Nora fixture releases native pages');
    for(const page of pages)if(browser.tabs.has(page.id)&&!before.has(page.id))await browser.command('close',{id:page.id});
    await js('MouseFlush()');bank.items=copy(savedBank.items);bank.members=Object.assign(Object.create(null),savedBank.members);bank.active=savedBank.active;bank.global=savedGlobal;bank.recovery=savedBank.recovery?copy(savedBank.recovery):null;bank.historyGroups.clear();bank.historyLiveKey='';browser.mouseDesktops.previews.clear();
    await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);browser.emit();await browser.save();await browser.saveQueue;await store.queue;
    assert.deepEqual([...browser.tabs.keys()].sort(),[...before].sort());assert.deepEqual(bank.snapshot(),savedBank,'Nora fixture restores the inherited desktop bank');assert.deepEqual(await js('MouseTest.prefs()'),original,'Nora fixture restores inherited layout and preferences');facts.noraFixture.restored=true;
   }catch(error){facts.noraFixture.cleanupError=error.stack||String(error);if(!verificationError)throw error;}
   finally{await save();}
  }
 }
 async function privateIsolation(){
  const normal=await open(origin+'/normal-isolation'),wc=normal.view.webContents,identity=await wc.executeJavaScript('mouseWindowsIdentity');
  await wc.executeJavaScript('localStorage.setItem("mouseWindowsNormal","retained")');await browser.session.cookies.set({url:origin,name:'mouse-windows-normal',value:'retained'});
  await click('#private-button');await until(()=>privateMode.current&&!privateMode.busy,'private entry');await until(()=>js('document.documentElement.dataset.mouseReady==="true"'),'private shell ready');
  const current=privateMode.current,ses=current.ses;assert.equal(ses.isPersistent(),false);assert.equal(ses.storagePath,null);
  assert.equal((await ses.cookies.get({url:origin})).length,0);
  // The retained611 asset/theme proof measures the private home itself, before
  // the isolation fixture replaces that home with a real native webpage.
  await until(()=>js('!!document.querySelector(".home-page")'),'fresh private home is rendered');
  await require('./mouse-611-smoke.cjs')({win});
  await js(`MouseTest.openPage(${JSON.stringify(origin+'/'+PRIVATE_MARKER)},MouseTest.model.active)`);let page;await until(async()=>{const id=await js('MouseTest.model.slots[MouseTest.model.active]');page=current.browser.get(id);return page&&!page.loading&&page.view.webContents.getURL().endsWith(PRIVATE_MARKER);},'private page');
  assert.equal(await page.view.webContents.executeJavaScript('localStorage.getItem("mouseWindowsNormal")'),null);
  await ses.cookies.set({url:origin,name:'mouse-windows-private',value:PRIVATE_MARKER,expirationDate:Date.now()/1000+3600});
  await page.view.webContents.executeJavaScript(`localStorage.setItem('private',${JSON.stringify(PRIVATE_MARKER)});sessionStorage.setItem('private',${JSON.stringify(PRIVATE_MARKER)})`);
  await page.view.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const request=indexedDB.open('windows-private');request.onupgradeneeded=()=>request.result.createObjectStore('private');request.onsuccess=()=>{const db=request.result,tx=db.transaction('private','readwrite');tx.objectStore('private').put(${JSON.stringify(PRIVATE_MARKER)},'marker');tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>reject(tx.error)};request.onerror=()=>reject(request.error)})`);
  for(const theme of ['light','dark']){await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);assert.equal(await js('document.documentElement.dataset.private'),'true');await fs.writeFile('mouse-windows-private-'+theme+'.png',(await win.capturePage()).toPNG());}
  await click('#private-button');await until(()=>!privateMode.current&&!privateMode.busy,'private cleanup');assert.equal(current.store.destroyed,true);assert.equal(current.browser.tabs.size,0);assert.deepEqual(await ses.cookies.get({url:origin}),[]);
  assert.equal(browser.get(normal.id).view.webContents,wc);assert.equal(await wc.executeJavaScript('mouseWindowsIdentity'),identity);assert.equal(await wc.executeJavaScript('localStorage.getItem("mouseWindowsNormal")'),'retained');assert.equal((await browser.session.cookies.get({url:origin,name:'mouse-windows-normal'}))[0].value,'retained');
  await click('#private-button');await until(()=>privateMode.current&&!privateMode.busy,'fresh private session');assert.notEqual(privateMode.current.partition,current.partition);assert.deepEqual(await privateMode.current.ses.cookies.get({url:origin}),[]);
  await click('#private-button');await until(()=>!privateMode.current&&!privateMode.busy,'normal returns');await browser.save();await browser.saveQueue;await store.queue;
  assert.ok(!(await fs.readFile(path.join(app.getPath('userData'),'workspace.json'),'utf8')).includes(PRIVATE_MARKER));
  facts.privacy={persistent:false,cookiesIsolated:true,localStorageIsolated:true,indexedDBInMemory:true,normalViewPreserved:true,privateStoreDestroyed:true,freshPartition:true};console.log('MOUSE_WINDOWS_PRIVATE_MEMORY_ISOLATION_PASS');
 }
 async function writeProfile(){
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.setTheme("dark");MouseFlush()');
  const token=crypto.randomUUID(),page=await open(origin+'/persisted');await page.view.webContents.executeJavaScript(`localStorage.setItem('mouseWindowsPersisted',${JSON.stringify(token)})`);
  await browser.session.cookies.set({url:origin,name:'mouse-windows-persistent',value:token,expirationDate:Date.now()/1000+86400});await browser.session.cookies.flushStore();
  libraryService.library.bookmark(origin+'/persisted','Windows persisted bookmark');await libraryService.flush();await js('MouseFlush()');await browser.save();await browser.saveQueue;await store.queue;
  const record={token,origin,port:server.address().port,pageId:page.id,deskIds:browser.mouseDesktops.bank.items.map(d=>d.id),preferences:await js('MouseTest.prefs()'),version:app.getVersion(),writePid:process.pid};
  await store.set({[PROFILE_KEY]:record});await store.queue;assert.ok(!(await fs.readFile(path.join(app.getPath('userData'),'workspace.json'),'utf8')).includes(PRIVATE_MARKER));facts.profile={tokenSha256:hash(token),port:record.port,pageId:page.id,desktops:record.deskIds};console.log('MOUSE_WINDOWS_PROFILE_WRITE_PASS');
 }
 async function readProfile(){
  const record=(await store.get(PROFILE_KEY))[PROFILE_KEY];assert.equal(record.version,expectedProfileVersion);assert.notEqual(record.writePid,process.pid);assert.deepEqual(browser.mouseDesktops.bank.items.map(d=>d.id),record.deskIds);assert.equal(record.deskIds.length,5);
  assertProfilePreferences(record,app.getVersion(),await js('MouseTest.prefs()'));
  if(record.updateToken)assert.equal((await store.get('mouseWindowsUpdateSentinel')).mouseWindowsUpdateSentinel,record.updateToken,'Actual updater retains the existing profile');
  assert.equal((await browser.session.cookies.get({url:record.origin,name:'mouse-windows-persistent'}))[0]?.value,record.token);
  assert.ok(libraryService.library.data.bookmarks.some(value=>value.title==='Windows persisted bookmark'&&value.url===record.origin+'/persisted'));
  await serve(record.port);const page=browser.get(record.pageId);assert.ok(page,'Persisted native tab ID restored');await page.view.webContents.loadURL(record.origin+'/persisted');assert.equal(await page.view.webContents.executeJavaScript('localStorage.getItem("mouseWindowsPersisted")'),record.token);
  facts.profile={previousVersion:record.version,currentVersion:app.getVersion(),differentProcess:true,preferencesPreserved:true,cookiePreserved:true,localStoragePreserved:true,bookmarkPreserved:true,desktops:record.deskIds};console.log('MOUSE_WINDOWS_PROFILE_COOKIE_RESTART_PASS');
 }
 async function updateButton(){
  const {updates}=ctx,source=process.env.MOUSE_WINDOWS_TEST_INSTALLER;
  assert.ok(path.isAbsolute(source||''));const stat=await fs.stat(source),name='Mouse-Browser-'+app.getVersion()+'-Windows-x64.exe';assert.equal(path.basename(source),name);
  const candidate={version:app.getVersion(),name,size:stat.size,hash:await require('./mouse-update.cjs').fileHash(source),url:'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v'+app.getVersion()+'-x64/'+name};
  // Only the network transport is local: the actual downloader, digest checks,
  // renderer buttons, IPC, document flush, native helper and installer are used.
  updates.fetcher=async url=>{assert.equal(url,candidate.url);return new Response(require('node:stream').Readable.toWeb(syncFS.createReadStream(source)),{status:200});};
  updates.candidate=candidate;updates.set({phase:'available',latestVersion:candidate.version,availableVersion:candidate.version});
  await js('MouseTest.action("updates")');await click('#update-download');await until(()=>updates.state.phase==='ready','actual downloader validates local installer',120000);
  assert.equal(await require('./mouse-update.cjs').fileHash(updates.file),candidate.hash);assert.equal(updates.state.canInstall,true);
  await fs.writeFile('mouse-windows-update-ready.png',(await win.capturePage()).toPNG());
  const token=crypto.randomUUID();await js('MouseTest.model.aiWidth=437');const record=(await store.get(PROFILE_KEY))[PROFILE_KEY];assert.ok(record);
  const preferences=await js('MouseTest.prefs()');await store.set({[PROFILE_KEY]:{...record,preferences,updateToken:token},mouseWindowsUpdateSentinel:token});await store.queue;
  facts.update={sameVersion:true,transport:'owned local installer stream',candidate,profileTokenSha256:hash(token),downloadedSha256:candidate.hash,downloadButton:true,installButton:false};
  const prepare=updates.installer.prepare;
  updates.installer.prepare=async function(...args){
   const plan=await prepare.apply(this,args);facts.update.plan={stage:plan.stage,receipt:plan.receipt,result:plan.result,ready:plan.ready,target:plan.target,executable:plan.executable,pid:plan.pid};facts.update.installButton=true;
   await save();console.log('MOUSE_WINDOWS_UPDATE_BUTTON_INSTALL_STARTED');return plan;
  };
  await click('#update-install');
  // The app must leave through its real exit controller. Do not fake completion
  // or call app.exit here; the outer driver checks new-process READY and HWND.
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){if(updates.state.phase==='error')throw Error('Actual Windows updater failed: '+updates.state.error);await sleep(50);}
  throw Error('Update did not close the original app');
 }
 async function updateDiagnostics(){
  const installer=ctx.updates?.installer,plan=installer?.plan,child=installer?.child;
  const evidence={state:ctx.updates?.state,stage:plan?.stage,child:child?{pid:child.pid,exitCode:child.exitCode,signalCode:child.signalCode,killed:child.killed}:null,files:{}};
  if(plan?.stage){
   const names=new Set(['plan.json','result.log','helper.ready','cancel','READY']);
   for(const entry of await fs.readdir(plan.stage,{withFileTypes:true}))if(entry.isFile()&&/^[\w.-]+\.log$/.test(entry.name)&&names.size<16)names.add(entry.name);
   for(const name of names){
    let handle;try{
     const file=path.join(plan.stage,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()){evidence.files[name]={regular:false};continue;}
     handle=await fs.open(file,'r');const buffer=Buffer.alloc(65536),{bytesRead}=await handle.read(buffer,0,buffer.length,0);
     evidence.files[name]={bytes:stat.size,truncated:stat.size>bytesRead,text:buffer.subarray(0,bytesRead).toString('utf8')};
    }catch(error){evidence.files[name]={error:error.code||error.message};}finally{await handle?.close();}
   }
  }
  facts.updateHelper=evidence;await fs.writeFile('mouse-windows-update-helper.json',JSON.stringify(evidence,null,2)+'\n');
 }
 try{
  assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(app.isPackaged,true);assert.equal(app.getName(),'Mouse Browser');assert.equal(app.getVersion(),'6.0.41');assert.equal(process.env.CI,'true');assert.ok(path.isAbsolute(process.env.MOUSE_TEST_PROFILE||''));assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
  assert.equal(await js('document.title'),'Mouse Browser');assert.equal(win.isVisible(),true);assert.ok(win.getNativeWindowHandle().readBigUInt64LE()>0n);
  nativeInput=require('./mouse-windows-input.cjs').createWindowsInput();const shared={...ctx,nativeInput,readMode,expectedSavedVersion:expectedProfileVersion};
  if(updateMode){currentStep='actualUpdateButton';await updateButton();return;}
  if(readMode){await step('profileRestart',readProfile);await step('wheelTutorialRestart',()=>require('./mouse-628-ui-smoke.cjs')(shared));}
  else{
   await serve();await step('nativePages',nativePages);await step('fiveDesktops',desktops);await step('windowControls',windowsControls);await step('shortcuts',shortcuts);
   await step('footer632',()=>require('./mouse-615-smoke.cjs')(shared));
   await step('documents',()=>require('./mouse-632-documents-smoke.cjs')(shared));await step('search',()=>require('./mouse-625-search-smoke.cjs')(shared));
   await step('metadataWorkload',()=>require('./mouse-627-performance-smoke.cjs')(shared));await step('perPaneProgress',()=>require('./mouse-628-progress-smoke.cjs')(shared));
   await step('downloadAndCaptureFeedback',()=>require('./mouse-630-feedback-smoke.cjs')(shared));
   await step('noraForeground',()=>require('./mouse-630-nora-smoke.cjs')(shared));
   await step('629UIAndScrollbars',()=>require('./mouse-629-ui-smoke.cjs')(shared));await step('noraMotionPaletteAndWheel',()=>noraMotion(shared));
   // The retained first-use tutorial precedes page/control gestures that learn it.
   await step('pageWheelNavigation',()=>require('./mouse-630-gesture-smoke.cjs')(shared));
   await step('privacy',privateIsolation);await step('profileWrite',writeProfile);
  }
  // Complete the installed run through the real Windows close control and
  // production flush/quit controller. The outer process must observe exit 0;
  // a missing handler or blocked close cannot become a passing smoke result.
  currentStep='nativeClose';facts.nativeClose={selector:'[data-window="quit"]',input:'User32'};facts.ok=true;await save();console.log('MOUSE_WINDOWS_X64_SMOKE_PASS');
  server?.closeAllConnections?.();server?.close();console.log('MOUSE_WINDOWS_NATIVE_CLOSE_REQUESTED');await click('[data-window="quit"]');
  await new Promise((_,reject)=>setTimeout(()=>reject(Error('Native Windows close button did not terminate the application')),30000));
 }catch(error){
  facts.ok=false;facts.error={step:currentStep,message:error.message,stack:error.stack};console.error(error);
  if(updateMode)await require('./mouse-lifecycle.cjs').bounded(updateDiagnostics(),3000,'Windows updater diagnostics').catch(error=>{facts.updateDiagnosticError=error.message;});
  await save().catch(()=>{});
  await require('./mouse-lifecycle.cjs').bounded(win.capturePage(),3000,'Windows failure screenshot').then(image=>fs.writeFile('mouse-windows-failure.png',image.toPNG())).catch(()=>{});
  await require('./mouse-lifecycle.cjs').bounded(globalCapture.acquire(screen.getDisplayMatching(win.getBounds())),5000,'Windows failure display screenshot').then(frame=>{const png=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64');return fs.writeFile('mouse-windows-failure-display.png',png);}).catch(()=>{});
  clearTimeout(watchdog);server?.closeAllConnections?.();server?.close();exit(1);
 }
};
