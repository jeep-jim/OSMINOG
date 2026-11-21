'use strict';

// Installed Windows acceptance. Existing document, search, progress, Nora and
// scrollbar proofs keep their original assertions and use a real User32 driver.
// HTTP pages, permissions and files are owned fixtures in the isolated CI profile.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),syncFS=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {screen,globalShortcut}=require('electron');
const {AgentController}=require('./mouse-agent/agent-connector.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const PRIVATE_MARKER='MOUSE_WINDOWS_PRIVATE_SENTINEL_629';
const PROFILE_KEY='mouseWindows629Verification';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function until(check,label,timeout=15000){const deadline=Date.now()+timeout;do{if(await check())return;await sleep(50);}while(Date.now()<deadline);throw Error('Windows native verification timed out: '+label);}
function alive(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}}

module.exports=async ctx=>{
 const {app,win,browser,store,libraryService,privateMode,globalCapture,agentHost}=ctx;
 const updateMode=process.argv.includes('--mouse-windows-update-smoke'),readMode=process.argv.includes('--mouse-windows-smoke-read'),mode=updateMode?'update':readMode?'read':'write';
 const js=source=>win.webContents.executeJavaScript(source),exit=require('./mouse-smoke-exit.cjs')({app,win});
 const facts={ok:false,version:app.getVersion(),platform:process.platform,arch:process.arch,mode,pid:process.pid,checks:{},physicalTrackpadVerified:false,liveExternalAccountsVerified:false};
 const expectedProfileVersion=readMode&&process.argv.includes('--mouse-windows-upgrade-from=6.0.29')?'6.0.29':'6.0.36';
 const report='mouse-windows-smoke-'+mode+'.json';
 let server,nativeInput,origin,currentStep='identity';
 const save=()=>fs.writeFile(report,JSON.stringify(facts,null,2)+'\n');
 const watchdog=setTimeout(()=>{console.error('MOUSE_WINDOWS_SMOKE_TIMEOUT',currentStep);app.exit(1);},updateMode?210000:readMode?150000:1440000);watchdog.unref();
 const frame=()=>js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 async function focus(){win.show();if(win.isMinimized())win.restore();win.focus();win.webContents.focus();await until(()=>win.isFocused(),'native window foreground');await frame();}
 async function click(selector){
  const inAgentSettings=await js(`!!document.querySelector(${JSON.stringify(selector)})?.closest('#agent-settings-page')`);
  if(inAgentSettings&&await js('document.querySelector("#agent-settings-page").hidden')){await click('#agent-settings-open');await until(()=>js('!document.querySelector("#agent-settings-page").hidden'),'Agent inline settings opens through its native button');}
  if(inAgentSettings)await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;e.scrollIntoView({block:'nearest',inline:'nearest'});})()`);
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
  await js(`MouseTest.openPage(${JSON.stringify(url)})`);let page;
  await until(async()=>{const id=await js('MouseTest.model.slots[MouseTest.model.active]');page=browser.get(id);return page&&!page.loading&&page.view.webContents.getURL()===url;},'native page '+url);
  assert.equal(page.error,'');assert.equal(await page.view.webContents.executeJavaScript('typeof mouseWindowsIdentity'),'number');return page;
 }
 async function nativePages(){
  const work=screen.getDisplayMatching(win.getBounds()).workArea;assert.ok(work.width>=800&&work.height>=600);
  win.setBounds({x:work.x,y:work.y,width:Math.min(1320,work.width),height:Math.min(900,work.height)});await focus();
  for(let i=0;i<6;i++)await open(origin+'/pane/'+i);
  for(const count of [1,2,4,6]){
   await js(`MouseTest.changeLayout(${count})`);
   await until(async()=>{const boxes=await js(`Array.from(document.querySelectorAll('.pane')).map(p=>{const r=p.querySelector('.page-slot').getBoundingClientRect();return{id:MouseTest.model.slots[p.dataset.pane],x:r.x,y:r.y,width:r.width,height:r.height}})`);return boxes.length===count&&boxes.every(box=>{const page=browser.get(box.id);return page?.visible&&page.view.getVisible()&&['x','y','width','height'].every(key=>Math.abs(page.bounds[key]-box[key])<=1.5);});},count+' real native panes match the shell');
  }
  const page=await open(origin+'/first'),id=page.id;
  // Navigation must originate from real OS input. Programmatic anchor.click()
  // has no user activation and Chromium may omit that entry from Back UI.
  await focus();await page.view.webContents.executeJavaScript('document.querySelector("#next").scrollIntoView({block:"center"});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const link=await page.view.webContents.executeJavaScript(`(${nativeHitTarget.toString()})(document.querySelector('#next'))`);assert.equal(link.ready,true);
  const host=win.getContentBounds(),outer=page.clipView?.getBounds(),rounded=page.roundView?.getBounds(),inner=page.view.getBounds();
  const surface={x:(outer?.x||0)+(rounded?.x||0)+inner.x,y:(outer?.y||0)+(rounded?.y||0)+inner.y};
  assert.equal(surface.x,page.bounds.x,'Windows nested native view X maps to the unchanged webpage origin');assert.equal(surface.y,page.bounds.y,'Windows nested native view Y maps to the unchanged webpage origin');
  nativeInput.testClick(host.x+surface.x+link.x,host.y+surface.y+link.y);await until(()=>!page.loading&&page.view.webContents.getURL()===origin+'/second','native link navigation');
  facts.navigation={id,link,host,outer,rounded,inner,surface,native:{url:page.view.webContents.getURL(),back:page.view.webContents.navigationHistory.canGoBack(),forward:page.view.webContents.navigationHistory.canGoForward()},guest:await page.view.webContents.executeJavaScript('({historyLength:history.length,userActivation:navigator.userActivation.hasBeenActive})'),shell:await js(`({active:MouseTest.model.active,slots:MouseTest.model.slots,page:MouseTest.model.state.tabs.find(t=>t.id===${JSON.stringify(id)}),backDisabled:document.querySelector('.pane.active [data-pane-action="back"]').disabled})`)};await save();
  await click('.pane.active [data-pane-action="back"]');await until(()=>!page.loading&&page.view.webContents.getURL()===origin+'/first','native back');
  await click('.pane.active [data-pane-action="forward"]');await until(()=>!page.loading&&page.view.webContents.getURL()===origin+'/second','native forward');
  const old=await page.view.webContents.executeJavaScript('mouseWindowsIdentity');await click('.pane.active [data-pane-action="reload"]');
  await until(async()=>!page.loading&&await page.view.webContents.executeJavaScript('mouseWindowsIdentity')!==old,'native reload');assert.equal(browser.get(id),page);
  facts.nativePages={layouts:[1,2,4,6],pageId:id,webContentsId:page.view.webContents.id,back:true,forward:true,reload:true};
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
   await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:${JSON.stringify(slots)},active:${JSON.stringify(leaves[0])},aiOpen:false,agentOpen:false,libraryOpen:false,focusPane:'',focusAI:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);
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
  await js(`MouseTest.openPage(${JSON.stringify(origin+'/'+PRIVATE_MARKER)})`);let page;await until(async()=>{const id=await js('MouseTest.model.slots[MouseTest.model.active]');page=current.browser.get(id);return page&&!page.loading&&page.view.webContents.getURL().endsWith(PRIVATE_MARKER);},'private page');
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
 async function agent(){
  const originalDialog=agentHost.dialog,originalFolder=agentHost.folder,original=await js('MouseTest.prefs()'),base=path.join(app.getPath('userData'),'Agent Windows проект'),project=path.join(base,'Рабочие файлы'),outside=path.join(base,'outside');
  await fs.mkdir(project,{recursive:true});await fs.mkdir(outside,{recursive:true});const initial='Mouse Windows UTF-8: привет €\n',secret='WINDOWS_MCP_OUTSIDE_SECRET';
  await fs.writeFile(path.join(project,'message.txt'),initial);await fs.writeFile(path.join(outside,'secret.txt'),secret);await fs.symlink(outside,path.join(project,'outside-junction'),'junction');await fs.link(path.join(outside,'secret.txt'),path.join(project,'outside-hardlink'));
  const proof={fixture:true,protocol:'official MCP SDK stdio',denials:[],files:[],stopped:false};let client,serverPid=0,ptyPid=0;
  async function denied(label,operation){await assert.rejects(operation);proof.denials.push(label);}
  async function clickOwnedTarget(target){
   // One existing 15s budget covers presentation, two frames and acknowledgement.
   // Observe the actual socket and owned document; never wrap or replace the SDK.
   const startedAt=Date.now(),deadlineAt=startedAt+15000,witness=proof.cdpClick={source:'Passive loopback CDP requests and owned page trusted pointer events',targetId:target,url:origin+'/agent-cdp',timeoutMs:15000,startedAt,deadlineAt,status:'preparing',requests:[],observationErrors:[],readinessSamples:0};
   let expired=false,page,wc,pin,peer,observe;
   const check=label=>{if(expired||Date.now()>=deadlineAt){expired=true;throw Error('Windows Agent single-click deadline: '+label);}};
   async function run(operation,label){check(label);try{const value=await require('./mouse-lifecycle.cjs').bounded(Promise.resolve().then(()=>{check(label);return operation();}),Math.max(1,deadlineAt-Date.now()),'Windows Agent '+label);check(label);return value;}catch(error){if(Date.now()>=deadlineAt)expired=true;throw error;}}
   async function wait(predicate,label){for(;;){if(await run(predicate,label))return;await run(()=>sleep(Math.min(50,Math.max(1,deadlineAt-Date.now()))),label);}}
   function native(){
    const current=browser.tabs.get(target),destroyed=!wc||wc.isDestroyed();if(!current||destroyed)return{current:current===page,destroyed:true};
    const view=page.view.getBounds(),parent=page.clipView?.getBounds()||null,actual={x:view.x+(parent?.x||0),y:view.y+(parent?.y||0),width:view.width,height:view.height};
    return{current:current===page,webContentsId:wc.id,url:wc.getURL(),navigationEpoch:page.navigationEpoch||0,desk:browser.mouseDesktops.bank.members[target],activeDesk:browser.mouseDesktops.bank.active,loading:page.loading||wc.isLoadingMainFrame(),error:page.error,visible:page.visible,viewVisible:page.view.getVisible(),parentVisible:page.clipView?.getVisible()??true,attached:win.contentView.children.includes(page.clipView||page.view),bounds:{...page.bounds},viewBounds:view,parentBounds:parent,actualBounds:actual,zoom:wc.getZoomFactor(),focused:wc.isFocused(),blocked:!!ctx.overlayGate.blocked||!!browser.mouseSurfaceHold,privateMode:!!privateMode.current,window:{visible:win.isVisible(),focused:win.isFocused(),minimized:win.isMinimized(),contentBounds:win.getContentBounds()}};
   }
   async function read(){
    check('target snapshot');const before=native();
    const shell=await js('(()=>{const m=MouseTest.model,r=document.querySelector(".pane.active .page-slot")?.getBoundingClientRect();return{ready:m.ready,agentOpen:m.agentOpen,switching:!!m.switching,sliding:!!m.desktopSliding,active:m.active,selected:m.slots[m.active],slot:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null};})()');
    check('owned document snapshot');const guest=await wc.executeJavaScript('(()=>{const e=document.querySelector("#action"),r=e?.getBoundingClientRect(),s=e&&getComputedStyle(e),box=r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,point=r?{x:(r.left+parseFloat(s.borderLeftWidth)+parseFloat(s.paddingLeft)+r.right-parseFloat(s.borderRightWidth)-parseFloat(s.paddingRight))/2,y:(r.top+parseFloat(s.borderTopWidth)+parseFloat(s.paddingTop)+r.bottom-parseFloat(s.borderBottomWidth)-parseFloat(s.paddingBottom))/2}:null;return{url:location.href,identity:mouseWindowsIdentity,timeOrigin:performance.timeOrigin,readyState:document.readyState,visibilityState:document.visibilityState,focused:document.hasFocus(),activeElement:document.activeElement?.id||"",viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY},target:box,point,exposed:!!point&&!!e&&e.contains(document.elementFromPoint(point.x,point.y)),result:document.querySelector("#result")?.textContent,pointerSequence:mouseWindowsPointerSequence,pointerEvents:mouseWindowsPointerEvents};})()');
    const after=native();if(pin)for(const row of [before,after]){assert.equal(row.current,true);assert.equal(row.webContentsId,pin.webContentsId);assert.equal(row.url,pin.url);assert.equal(row.navigationEpoch,pin.navigationEpoch);assert.equal(row.desk,pin.desk);assert.equal(row.activeDesk,pin.desk);}if(pin){assert.equal(guest.identity,pin.identity);assert.equal(guest.timeOrigin,pin.timeOrigin);assert.equal(guest.url,pin.url);}
    return{at:Date.now(),before,native:after,shell,guest};
   }
   function ready(sample){
    const n=sample.native,s=sample.shell,g=sample.guest,b=n.bounds,v=n.viewBounds;
    return n.current&&!n.destroyed&&!n.loading&&!n.error&&n.visible&&n.viewVisible&&n.parentVisible&&n.attached&&!n.blocked&&!n.privateMode&&n.focused&&n.window.visible&&n.window.focused&&!n.window.minimized&&s.ready&&s.agentOpen&&!s.switching&&!s.sliding&&s.selected===target&&s.slot&&g.readyState==='complete'&&g.visibilityState==='visible'&&g.focused&&g.exposed&&g.target.width>0&&g.target.height>0&&JSON.stringify(sample.before.actualBounds)===JSON.stringify(n.actualBounds)&&JSON.stringify(n.actualBounds)===JSON.stringify(b)&&['x','y','width','height'].every(key=>Math.abs(s.slot[key]-b[key])<=1.5)&&Math.abs(g.viewport.width-v.width/n.zoom)<=1&&Math.abs(g.viewport.height-v.height/n.zoom)<=1;
   }
   const geometry=sample=>JSON.stringify({bounds:sample.native.actualBounds,zoom:sample.native.zoom,contentBounds:sample.native.window.contentBounds,slot:sample.shell.slot,viewport:sample.guest.viewport,scroll:sample.guest.scroll,target:sample.guest.target,point:sample.guest.point});
   try{
    await wait(()=>{page=browser.get(target);return page&&!page.loading&&!page.error&&page.view.webContents.getURL()===witness.url;},'external Agent opens native page');wc=page.view.webContents;
    await run(()=>{win.show();if(win.isMinimized())win.restore();win.focus();},'native foreground');await run(()=>client.activate(target),'activate exact target');
    const initial=await run(read,'initial target');witness.initial=initial;pin=witness.pin={webContentsId:wc.id,url:initial.guest.url,navigationEpoch:page.navigationEpoch||0,desk:browser.mouseDesktops.bank.active,identity:initial.guest.identity,timeOrigin:initial.guest.timeOrigin};assert.equal(pin.url,witness.url);
    await wait(async()=>{const before=await read();witness.readinessSamples++;witness.lastReadiness=before;if(!ready(before))return false;await run(()=>wc.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'),'two presented target frames');const after=await read();witness.lastReadiness=after;if(!ready(after)||geometry(before)!==geometry(after))return false;witness.before=after;return true;},'visible active target and settled viewport');
    assert.equal(witness.before.guest.result,'Ready');const sequence=witness.before.guest.pointerSequence;
    const peers=[...agentHost.gateway.clients];assert.equal(peers.length,1,'Owned acceptance has exactly its own CDP peer');peer=peers[0];
    observe=bytes=>{try{const request=JSON.parse(bytes.toString());if(request.method==='Input.dispatchMouseEvent'&&peer.sessions.get(request.sessionId)===target){const {type,x,y,button,clickCount}=request.params;witness.requests.push({at:Date.now(),requestId:request.id,sessionId:request.sessionId,tabId:target,type,x,y,button,clickCount,native:native()});}}catch(error){witness.observationErrors.push(error.message);}};peer.socket.on('message',observe);
    witness.status='dispatching';witness.dispatchStartedAt=Date.now();await run(()=>client.clickSelector(target,'#action'),'one unchanged SDK selector click');witness.dispatchResolvedAt=Date.now();
    await wait(async()=>{const after=await read();witness.after=after;witness.pointerReceipts=after.guest.pointerEvents.filter(event=>event.sequence>sequence);return after.guest.result==='Windows native click'&&witness.pointerReceipts.some(event=>event.type==='click'&&event.trusted&&event.targetId==='action'&&event.identity===pin.identity&&event.timeOrigin===pin.timeOrigin);},'one click trusted receipt and result');
    assert.equal(witness.after.guest.result,'Windows native click');assert.deepEqual(witness.requests.map(row=>row.type),['mouseMoved','mousePressed','mouseReleased']);assert.deepEqual(witness.observationErrors,[]);witness.status='passed';witness.acknowledgedAt=Date.now();
   }catch(error){witness.status='failed';witness.error={message:error.message,stack:error.stack};try{witness.failureNative=native();}catch(failure){witness.failureNativeError=failure.message;}throw error;}
   finally{if(peer&&observe)peer.socket.removeListener('message',observe);witness.finishedAt=Date.now();witness.elapsedMs=witness.finishedAt-startedAt;await fs.writeFile('mouse-windows-agent-click.json',JSON.stringify(witness,null,2)+'\n');}
  }
  try{
   assert.equal(agentHost.state().enabled,false);await js('MouseTest.desktopUI.close({immediate:true});MouseTest.restorePane();MouseTest.model.libraryOpen=false;MouseTest.applyMode("agents")');
   await until(()=>js('!document.querySelector("#agent-panel").hidden'),'Agent panel');
   agentHost.dialog={...originalDialog,showMessageBox:async()=>({response:1}),showOpenDialog:async()=>({canceled:false,filePaths:[project]})};
   await checkbox('#agent-autonomous',true);await click('#agent-enable');await until(()=>agentHost.state().enabled,'Agent session enable');await click('#agent-folder');await until(()=>agentHost.mcp.connected&&!agentHost.localBusy,'MCP stdio child');
   client=await new AgentController(agentHost.state().connectionUrl,{timeout:60000}).connect();serverPid=agentHost.mcp.transport.pid;assert.ok(serverPid>0&&serverPid!==process.pid&&alive(serverPid));
   const tools=await client.localTools();assert.deepEqual(tools.tools.map(tool=>tool.name),['read_file','write_file','list_directory','search_files']);assert.equal(tools.readOnly,true);assert.equal(tools.sandboxed,false);
   const first=(await client.localFile('read_file',{path:'message.txt'})).structuredContent;assert.equal(first.content,initial);assert.equal(first.sha256,hash(initial));
   await denied('write-disabled',()=>client.localFile('write_file',{path:'denied.txt',content:'denied'}));await denied('terminal-disabled',()=>client.terminal("Write-Output 'MUST_NOT_RUN'"));
   for(const [label,value]of [['traversal','../outside/secret.txt'],['absolute',path.join(outside,'secret.txt')],['junction','outside-junction/secret.txt'],['hardlink','outside-hardlink']])await denied(label,()=>client.localFile('read_file',{path:value}));
   await denied('external-cannot-enable-permissions',()=>client.send('Mouse.localPermissions',{write:true,commands:true}));
   const listing=(await client.localFile('list_directory',{path:'.',depth:2})).structuredContent;assert.ok(listing.entries.some(entry=>entry.path==='message.txt'));assert.ok(!listing.entries.some(entry=>entry.path==='outside-junction/secret.txt'));assert.equal(listing.entries.find(entry=>entry.path==='outside-hardlink').type,'blocked');
   await checkbox('#agent-local-write',true);await until(()=>agentHost.mcp.writeAllowed&&!agentHost.localBusy,'write permission');await checkbox('#agent-local-commands',true);await until(()=>agentHost.localCommands&&!agentHost.localBusy,'command permission');
   const updated='Изменено через MCP в Windows\n';await client.localFile('write_file',{path:'message.txt',content:updated,expectedSha256:first.sha256});assert.equal(await fs.readFile(path.join(project,'message.txt'),'utf8'),updated);
   await denied('stale-hash',()=>client.localFile('write_file',{path:'message.txt',content:'bad stale write',expectedSha256:first.sha256}));assert.equal(await fs.readFile(path.join(project,'message.txt'),'utf8'),updated);
   await client.localFile('write_file',{path:'Новый файл.txt',content:'Windows Unicode path'});assert.equal(await fs.readFile(path.join(project,'Новый файл.txt'),'utf8'),'Windows Unicode path');
   const search=(await client.localFile('search_files',{query:'Новый'})).structuredContent;assert.ok(search.entries.some(entry=>entry.path==='Новый файл.txt'));
   const command=await client.terminal("Write-Output 'WINDOWS_PTY_OK'; [IO.File]::WriteAllText((Join-Path (Get-Location) 'pty-created.txt'), 'PTY wrote real bytes'); (Get-FileHash -Algorithm SHA256 -LiteralPath 'pty-created.txt').Hash");assert.equal(command.exitCode,0);assert.match(command.stdout,/WINDOWS_PTY_OK/);assert.equal(await fs.readFile(path.join(project,'pty-created.txt'),'utf8'),'PTY wrote real bytes');assert.match(command.stdout,new RegExp(hash('PTY wrote real bytes'),'i'),'The actual PowerShell Utility hash command works inside the packaged PTY');
   ptyPid=agentHost.terminalService.proc.pid;assert.ok(ptyPid>0&&ptyPid!==process.pid&&alive(ptyPid));const failure=await client.terminal('cmd.exe /d /c exit 7');assert.equal(failure.exitCode,7);
   // A new successful command must not inherit the preceding native exit code.
   const recover=await client.terminal("Write-Output 'WINDOWS_PTY_RECOVERED'");assert.equal(recover.exitCode,0);assert.match(recover.stdout,/WINDOWS_PTY_RECOVERED/);
   const target=await client.open(origin+'/agent-cdp');await click('#agent-settings-close');await until(()=>js('document.querySelector("#agent-settings-page").hidden'),'Agent settings close before native CDP pointer');await clickOwnedTarget(target);
   await client.clickSelector(target,'#retained');await client.type(target,'Agent typed');assert.ok((await browser.get(target).view.webContents.executeJavaScript('document.querySelector("#retained").value')).includes('Agent typed'));
   const shot=await client.screenshot(target);assert.match(shot.data,/^iVBOR/);proof.cdp={tabId:target,clicked:true,typed:true,nativePNG:true};
   for(const theme of ['light','dark']){await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await frame();await fs.writeFile('mouse-windows-agent-'+theme+'.png',(await win.capturePage()).toPNG());}
   await checkbox('#agent-local-write',false);await until(()=>!agentHost.mcp.writeAllowed&&!agentHost.localBusy,'write revoked');await denied('write-revoked',()=>client.localFile('write_file',{path:'revoked.txt',content:'forbidden'}));assert.equal(syncFS.existsSync(path.join(project,'revoked.txt')),false);
   await checkbox('#agent-local-commands',false);await until(()=>!agentHost.localCommands&&!agentHost.localBusy&&!alive(ptyPid),'commands revoked and PTY exited');await denied('terminal-revoked',()=>client.terminal("Write-Output 'MUST_NOT_RUN'"));
   serverPid=agentHost.mcp.transport.pid;await privateMode.enter();await agentHost.stopping;await until(()=>!alive(serverPid),'private entry closes MCP child');assert.equal(agentHost.state().local,null);await denied('private-local-access',()=>agentHost.handle('local-call',{name:'read_file',arguments:{path:'message.txt'}}));await privateMode.leave();
   assert.equal(await fs.readFile(path.join(outside,'secret.txt'),'utf8'),secret);proof.files=['message.txt','Новый файл.txt','pty-created.txt'];proof.pty={pid:ptyPid,successExit:command.exitCode,failureExit:failure.exitCode,recoveredExit:recover.exitCode,fileHashCommand:true,fileSha256:hash('PTY wrote real bytes'),stopped:!alive(ptyPid)};proof.mcpPid=serverPid;
  }finally{
   await client?.close();await agentHost.stop('Windows acceptance completed');if(privateMode.current)await privateMode.leave();agentHost.dialog=originalDialog;agentHost.folder=originalFolder;
   await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);
   proof.stopped=!agentHost.state().enabled&&!agentHost.mcp.connected&&!agentHost.terminalService.proc;facts.agent=proof;await fs.writeFile('mouse-windows-agent.json',JSON.stringify(proof,null,2)+'\n');
  }
  assert.equal(proof.stopped,true);console.log('MOUSE_WINDOWS_AGENT_PTY_LOCAL_MCP_PASS');
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
  assert.deepEqual(await js('MouseTest.prefs()'),record.preferences,'Reinstalled application preserves exact workspace preferences');
  if(record.updateToken)assert.equal((await store.get('mouseWindowsUpdateSentinel')).mouseWindowsUpdateSentinel,record.updateToken,'Actual updater retains the existing profile');
  assert.equal((await browser.session.cookies.get({url:record.origin,name:'mouse-windows-persistent'}))[0]?.value,record.token);
  assert.ok(libraryService.library.data.bookmarks.some(value=>value.title==='Windows persisted bookmark'&&value.url===record.origin+'/persisted'));
  await serve(record.port);const page=browser.get(record.pageId);assert.ok(page,'Persisted native tab ID restored');await page.view.webContents.loadURL(record.origin+'/persisted');assert.equal(await page.view.webContents.executeJavaScript('localStorage.getItem("mouseWindowsPersisted")'),record.token);
  facts.profile={previousVersion:record.version,currentVersion:app.getVersion(),differentProcess:true,preferencesPreserved:true,cookiePreserved:true,localStoragePreserved:true,bookmarkPreserved:true,desktops:record.deskIds};console.log('MOUSE_WINDOWS_PROFILE_COOKIE_RESTART_PASS');
 }
 async function updateButton(){
  const {updates}=ctx,source=process.env.MOUSE_WINDOWS_TEST_INSTALLER;
  assert.ok(path.isAbsolute(source||''));const stat=await fs.stat(source),name='Mouse-Browser-6.0.36-Windows-x64.exe';assert.equal(path.basename(source),name);
  const candidate={version:'6.0.36',name,size:stat.size,hash:await require('./mouse-update.cjs').fileHash(source),url:'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.36-x64/'+name};
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
  assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(app.isPackaged,true);assert.equal(app.getName(),'Mouse Browser');assert.equal(app.getVersion(),'6.0.36');assert.equal(process.env.CI,'true');assert.ok(path.isAbsolute(process.env.MOUSE_TEST_PROFILE||''));assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
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
   await step('privacy',privateIsolation);await step('agentPTYLocalMCP',agent);await step('profileWrite',writeProfile);
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
