'use strict';
// Installed-app acceptance of the production Chrome Web Store flow. The only
// extension comes from Google; no fixture package, replacement page, fake
// permission response or renderer-dispatched click is used here.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),{createHash}=require('node:crypto');
const {detailID}=require('./mouse-web-store.cjs');
const ID='eimadpbcbfnmbkopoojfekhnkhdbieeh',STORE_URL='https://chromewebstore.google.com/detail/dark-reader/'+ID+'?hl=en';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readRuntime=()=>({url:location.href,title:document.title,mode:document.documentElement.getAttribute('data-darkreader-mode'),scheme:document.documentElement.getAttribute('data-darkreader-scheme'),styles:[...document.querySelectorAll('style.darkreader')].map(s=>({className:s.className,bytes:s.textContent.length})),background:getComputedStyle(document.querySelector('#owned-white')).backgroundColor,color:getComputedStyle(document.querySelector('#owned-white')).color,originalBackground:document.querySelector('#owned-white').style.backgroundColor,text:document.querySelector('#owned-white').textContent});
function storeReadback(){
 const visible=e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2&&getComputedStyle(e).visibility!=='hidden';};
 const buttons=[...document.querySelectorAll('button,[role="button"]')].filter(visible),button=buttons.find(e=>/^Add to (?:Chrome|Mouse(?: Browser)?)$/i.test(e.textContent.trim()));
 const selector=e=>{const chain=[];for(let at=e;at&&at.nodeType===1;at=at.parentElement){if(at===document.documentElement){chain.unshift(at.localName);break;}chain.unshift(at.localName+':nth-child('+([...at.parentElement?.children||[]].indexOf(at)+1)+')');}return chain.join(' > ');};
 return{url:location.href,title:document.title,api:typeof globalThis.chrome?.webstorePrivate?.beginInstallWithManifest3,button:button?{selector:selector(button),text:button.textContent.trim(),disabled:!!button.disabled||button.getAttribute('aria-disabled')==='true',...(()=>{const r=button.getBoundingClientRect();return{bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};})()}:null,buttons:buttons.map(e=>e.textContent.trim()).filter(Boolean).slice(0,24)};
}
module.exports=async ctx=>{
 const {app,win,browser,extensions,dialog,webStore,fixture,nativeInput,click,capture,facts,read,save}=ctx,compat=ctx.extensionCompatibility||ctx.extensionCompat;
 assert.equal(process.env.CI,'true');assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE||''));assert.equal(app.isPackaged,true);assert.ok(extensions&&dialog&&compat&&webStore);
 const known=new Set(browser.tabs.keys()),row='.mouse-extension-row[data-id="'+ID+'"]',pin='.mouse-extension-pin[data-id="'+ID+'"]',out={id:ID,version:app.getVersion(),pid:process.pid,liveStore:!read,installed:false,runtimeVerified:false};
 facts.webStore??={};facts.webStore[read?'restart':'write']=out;
 let server,consentError,restoreDialog;
 const rememberPages=()=>{for(const [id,page]of browser.tabs)if(!known.has(id)&&!fixture.created.some(r=>r.id===id))fixture.created.push({id,page,index:100+fixture.created.length,desk:fixture.bank.active,internal:!!page.internal});};
 const js=source=>fixture.js(source),entry=()=>extensions.state().find(e=>e.id===ID);
 const modalOpen=()=>js('document.querySelector("#mouse-extensions-dialog").open');
 async function openManager(){if(!await modalOpen())await click('#mouse-extensions-button');await fixture.until(modalOpen,'638 extension manager opens');}
 async function closeManager(){if(await modalOpen())await click('#mouse-extensions-dialog [data-close-dialog]');await fixture.until(async()=>!await modalOpen(),'638 extension manager closes');}
 async function show(record){
  const L=require('./mouse/layout.js'),tree=L.preset(1),leaf=L.leaves(tree)[0];
  await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:{${JSON.stringify(leaf)}:${JSON.stringify(record.id)}},active:${JSON.stringify(leaf)},focusPane:'',focusAI:false,aiOpen:false,libraryOpen:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.requestLayout();MouseTest.save()`);
  await fixture.until(()=>record.page.visible&&record.page.bounds?.width>400&&record.page.bounds?.height>300,'638 visible Web Store/runtime page');await fixture.frame();
 }
 async function consentInput(receipt){
  if(process.platform==='linux'){
   let native;await fixture.until(()=>{try{native=nativeInput.testFocusedDialog();return native?.pid===process.pid;}catch{return false;}},'638 owned native GTK consent',12000);
   assert.equal(native.nativeType,'_NET_WM_WINDOW_TYPE_DIALOG');receipt.native=native;
   receipt.capture=(await capture('mouse-638-webstore-consent.png',{meta:{kind:'webstore-consent',extensionId:ID,native}})).filename;
   const keys=['Tab','Return'];receipt.input={action:'dialog-keys',source:'XTest',pid:process.pid,keys,at:Date.now(),native};for(const key of keys)assert.equal(await nativeInput.testKey(key),true);
  }else{
   let button;await fixture.until(()=>{button=nativeInput.testDialogButtons().find(b=>b.pid===process.pid&&b.enabled!==false&&b.title==='Установить расширение');return!!button;},'638 actual native installation button',12000);
   const b=button.bounds;assert.ok([b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>4&&b.height>4);receipt.native=button;
   receipt.capture=(await capture('mouse-638-webstore-consent.png',{meta:{kind:'webstore-consent',extensionId:ID,native:button}})).filename;
   const point={x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};receipt.input={action:'dialog-click',source:button.source,pid:process.pid,point,native:button,at:Date.now()};assert.equal(await nativeInput.testClick(point.x,point.y),true);
  }
  facts.nativeInputs.push(receipt.input);await save();
 }
 function observeConsent(){
  const original=dialog.showMessageBox;
  dialog.showMessageBox=function(owner,options){
   if(options.title!=='Установить расширение из Chrome Web Store?')return original.call(this,owner,options);
   assert.equal(owner,win);assert.deepEqual(options.buttons,['Отмена','Установить расширение']);assert.equal(options.defaultId,0);assert.equal(options.cancelId,0);assert.match(options.message,/^Dark Reader /);
   const receipt=out.consent={message:options.message,detail:options.detail,title:options.title,buttons:[...options.buttons],defaultId:options.defaultId,cancelId:options.cancelId,at:Date.now(),originalNativeDialog:true};
   const result=original.call(this,owner,options);
   void consentInput(receipt).catch(error=>{consentError=error;try{nativeInput.testKey(process.platform==='darwin'?'ESC':process.platform==='win32'?'ESC':'Escape');}catch{}});
   return result.then(response=>{receipt.response=response.response;receipt.resolvedAt=Date.now();return response;});
  };
  restoreDialog=()=>{dialog.showMessageBox=original;};
 }
 async function evidence(){
  const value=extensions.storeEvidence(ID);assert.ok(value);assert.equal(value.extensionId,ID);assert.equal(value.source,'chrome-web-store');assert.equal(value.developerVerified,true);assert.equal(value.publisherVerified,true);assert.ok(value.installedFilesVerified>0);assert.match(value.sha256,/^[a-f0-9]{64}$/);
  const base=path.join(app.getPath('userData'),'mouse-local-extensions','web-store'),registry=JSON.parse(await fs.readFile(path.join(base,'registry.json'),'utf8')),record=registry.find(e=>e.id===ID);assert.ok(record);assert.match(record.package,/^[a-f0-9-]{36}$/);assert.equal(record.crxSha256,value.sha256);
  const bytes=await fs.readFile(path.join(base,'packages',record.package,'extension.crx'));assert.equal(bytes.length,value.bytes);assert.equal(sha(bytes),value.sha256);
  const filename='mouse-638-webstore.crx';if(!read)await fs.writeFile(filename,bytes);else assert.equal(sha(await fs.readFile(filename)),value.sha256);
  return{...value,id:value.extensionId,installedFileCount:value.installedFilesVerified,installedFilesVerified:value.installedFilesVerified>0,artifact:{filename,bytes:bytes.length,sha256:sha(bytes)}};
 }
 async function readPage(record,label,enabled){
  await fixture.until(async()=>{const state=await fixture.pageJS(record,`(${readRuntime.toString()})()`);return enabled?state.mode==='dynamic'&&state.scheme==='dark'&&state.styles.some(s=>s.bytes>0):!state.mode&&state.styles.length===0;},'638 actual extension content '+label,20000);
  const state=await fixture.pageJS(record,`(${readRuntime.toString()})()`),rgb=value=>value.match(/\d+/g).slice(0,3).map(Number);assert.equal(state.originalBackground,'rgb(250, 250, 250)');assert.equal(state.text,'Owned white page — Chrome extension runtime 638');
  if(enabled){assert.ok(rgb(state.background).every(n=>n<100),'Actual Dark Reader worker/content styling darkens the owned white document');assert.ok(rgb(state.color).every(n=>n>100));}else assert.deepEqual(rgb(state.background),[250,250,250]);
  const native=fixture.nativeState(record),rect=await fixture.pageJS(record,'(()=>{const r=document.querySelector("#owned-white").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()');
  const shot=await capture('mouse-638-webstore-runtime-'+label+'.png',{probes:[{kind:'webstore-runtime',point:{x:native.bounds.x+rect.x+24,y:native.bounds.y+rect.y+rect.height-24},expectedRGB:rgb(state.background)}],meta:{kind:'webstore-runtime',extensionId:ID,enabled,label}});
  return{enabled,state,native,rect,capture:shot.filename};
 }
 async function runtime(){
  server=http.createServer((_request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.setHeader('Cache-Control','no-store');response.end('<!doctype html><html><head><title>Mouse 638 owned extension runtime</title></head><body style="margin:0"><main id="owned-white" style="box-sizing:border-box;background:rgb(250,250,250);color:rgb(20,20,20);padding:24px;min-height:500px;font:28px sans-serif">Owned white page — Chrome extension runtime 638</main></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/extension-runtime';
  const record=await fixture.open(url,101,{prepare:false});await show(record);const value={url,ownedResponse:{background:[250,250,250],color:[20,20,20],scripts:0},enabled:await readPage(record,read?'restart':'enabled',true)};
  await openManager();if(!entry().pinned){await click(row+' [data-action="set-pinned"]');await fixture.until(()=>entry()?.pinned,'638 pinned store extension');}await closeManager();
  await fixture.until(()=>js(`!!document.querySelector(${JSON.stringify(pin)})`),'638 actual toolbar action');value.actionInput=await click(pin);
  let popup;await fixture.until(()=>{popup=compat.instance.api.browserAction.popup;return popup&&!popup.isDestroyed()&&popup.browserWindow?.isVisible();},'638 real extension action popup',15000);await popup.whenReady();
  const wc=popup.browserWindow.webContents;await fixture.until(()=>wc.executeJavaScript('document.querySelectorAll("button").length>0&&document.body.innerText.length>40'),'638 live Dark Reader popup UI',15000);
  value.action=await wc.executeJavaScript('({url:location.href,title:document.title,id:chrome.runtime.id,version:chrome.runtime.getManifest().version,text:document.body.innerText.slice(0,400),buttons:document.querySelectorAll("button").length})');assert.equal(value.action.id,ID);assert.equal(value.action.version,entry().version);assert.ok(value.action.url.startsWith('chrome-extension://'+ID+'/'));
  value.action.bounds=popup.browserWindow.getBounds();value.action.capture=(await capture('mouse-638-webstore-action-'+(read?'restart':'write')+'.png',{meta:{kind:'webstore-action',extensionId:ID,bounds:value.action.bounds}})).filename;
  // Focusing the main window closes the production popup. Disable/enable are
  // real manager buttons, followed by ordinary reloads to verify content hooks.
  await openManager();await click(row+' [data-action="set-enabled"]');await fixture.until(()=>entry()?.enabled===false,'638 Web Store extension disabled');await closeManager();
  await browser.command('reload',{id:record.id});await fixture.until(()=>!record.page.loading,'638 disabled page reload');value.disabled=await readPage(record,read?'restart-disabled':'disabled',false);
  await openManager();await click(row+' [data-action="set-enabled"]');await fixture.until(()=>entry()?.enabled===true,'638 Web Store extension reenabled');await closeManager();
  await browser.command('reload',{id:record.id});await fixture.until(()=>!record.page.loading,'638 reenabled page reload');value.reenabled=await readPage(record,read?'restart-reenabled':'reenabled',true);return value;
 }
 try{
  if(read){
   const previous=facts.webStore?.write;assert.ok(previous?.installed&&previous.runtimeVerified);assert.equal(previous.id,ID);assert.ok(entry()?.enabled&&entry()?.pinned);out.restored=true;out.evidence=await evidence();assert.equal(out.evidence.sha256,previous.evidence.sha256);out.sha256=out.evidence.sha256;
  }else{
   assert.equal(entry(),undefined,'Dedicated owned CI profile must not already have the live fixture installed');
   await openManager();const before=new Set(browser.tabs.keys());out.openStoreInput=await click('#mouse-extensions-store');
   let record;await fixture.until(()=>{const page=[...browser.tabs.values()].find(p=>!before.has(p.id)&&!p.managedExtension);if(page)record={id:page.id,page,index:100,desk:fixture.bank.active};return!!record;},'638 store opens from browser extension menu');rememberPages();
   await browser.command('navigate',{id:record.id,url:STORE_URL});await show(record);await fixture.until(()=>detailID(record.page.view.webContents.getURL())===ID&&!record.page.loading,'638 live Chrome Web Store detail',45000);
   let state;await fixture.until(async()=>{state=await fixture.pageJS(record,`(${storeReadback.toString()})()`);out.lastStoreReadback=state;return state.api==='function'&&state.button&&!state.button.disabled;},'638 actual Chrome Web Store install control',30000);
   out.storeURL=state.url;out.storePage=state;out.storeCapture=(await capture('mouse-638-webstore-detail.png',{meta:{kind:'webstore-detail',url:state.url,extensionId:ID,button:state.button}})).filename;
   observeConsent();out.installInput=await click(state.button.selector,record);out.nativeInstallClick=out.installInput.events.some(e=>e.type==='click'&&e.trusted&&e.matches);
   await fixture.until(()=>{if(consentError)throw consentError;return entry()?.enabled&&out.consent?.response===1;},'638 signed live CRX install after native consent',85000);
   await fixture.until(()=>webStore.installEvidence(record.page.view.webContents)?.completeAt,'638 CWS completeInstall callback',15000);
   out.bridge=webStore.installEvidence(record.page.view.webContents);assert.equal(out.bridge.extensionId,ID);assert.equal(out.bridge.result,'success');assert.equal(out.bridge.nativeGestureType,'mouseDown');assert.equal(out.bridge.url,out.storeURL);assert.ok(out.bridge.completeAt>=out.bridge.beginAt);
   out.nativeConsent=out.consent.originalNativeDialog&&out.consent.response===1&&!!out.consent.input&&!!out.consent.capture;assert.equal(out.nativeConsent,true);assert.equal(out.consent.message,entry().name+' '+entry().version);out.evidence=await evidence();out.installed=true;
  }
  restoreDialog?.();restoreDialog=null;rememberPages();out.runtime=await runtime();out.runtimeVerified=true;out.pinned=entry().pinned;
  if(read){await openManager();out.removeInput=await click(row+' [data-action="remove"]');await fixture.until(()=>!entry(),'638 restored live extension removed');await closeManager();out.removed=true;}
  rememberPages();return out;
 }finally{
  restoreDialog?.();rememberPages();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 }
};
module.exports.fixtures={storeReadback};
