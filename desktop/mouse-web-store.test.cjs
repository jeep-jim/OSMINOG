'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {installMouseWebStore,storeURL,detailID}=require('./mouse-web-store.cjs');
const {inspectStoreManifest,permissionText}=require('./mouse-web-store-manager.cjs');
const ID='eimadpbcbfnmbkopoojfekhnkhdbieeh',URL='https://chromewebstore.google.com/detail/dark-reader/'+ID;
function fixture(){
 const app=new EventEmitter(),shell=new EventEmitter(),win={webContents:shell,isDestroyed:()=>false},ipcMain={handle(name,fn){this.name=name;this.handler=fn;},removeHandler(){}};
 Object.assign(shell,{id:1,url:'file:///owned/mouse/index.html',isDestroyed:()=>false,getURL(){return this.url;},mainFrame:{url:'file:///owned/mouse/index.html',parent:null,detached:false}});
 const session={registerPreloadScript(options){this.preload=options;},unregisterPreloadScript(){}};
 let available=true,installed=[],beforeInstall=async()=>{},afterInstall=async()=>{},consent=0;
 const wc=new EventEmitter();Object.assign(wc,{id:2,session,url:URL,isDestroyed:()=>false,getURL(){return this.url;},send(){}});const frame={url:URL,parent:null,detached:false};wc.mainFrame=frame;
 const page={id:'owned',project:'project',title:'Owned fixture - Chrome Web Store',visible:false,view:{webContents:wc}},browser={session,project:'project',tabs:new Map([['owned',page]]),providers:new Map(),mouseDesktops:{bank:{active:'desk-1',members:{owned:'desk-1'}}}};const calls=[];
 const extensions={state:()=>installed,chromiumId:id=>installed.some(e=>e.id===id&&e.enabled)?id:null,installStore:async(id,options)=>{calls.push({id,options});await beforeInstall(options);if(!options.valid())throw Error('Страница установки изменилась');installed=[{id,source:'chrome-web-store',enabled:true,name:'Owned fixture',version:'1'}];options.onCommit?.();await afterInstall(options);},setEnabled:async(id,value)=>{installed[0].enabled=value;},remove:async()=>{installed=[];}};
 const bridge=installMouseWebStore({app,browser,win,ipcMain,dialog:{showMessageBox:async()=>({response:consent})},extensions,isAvailable:()=>available});
 return {app,win,shell,page,browser,extensions,wc,frame,event:{sender:wc,senderFrame:frame},session,bridge,calls,gesture:()=>wc.emit('before-mouse-event',{}, {type:'mouseDown',button:'left'}),shellGesture:(value={type:'mouseDown',button:'left'})=>shell.emit(value.type==='keyDown'?'before-input-event':'before-mouse-event',{},value),set available(v){available=v;},set beforeInstall(fn){beforeInstall=fn;},set afterInstall(fn){afterInstall=fn;},set consent(v){consent=v;}};
}
test('store bridge uses an exact HTTPS origin and detail ID, never prefix or embedded paths',()=>{
 assert.equal(storeURL(URL),true);assert.equal(detailID(URL),ID);assert.equal(detailID('https://chromewebstore.google.com/'),null);
});
test('prefix/lookalike origins, subframes, wrong sessions and private transition cannot invoke installation',async()=>{
 const f=fixture();
 for(const url of ['https://chromewebstore.google.com.evil.test/detail/x/'+ID,'https://evil.test/?url='+URL,'http://chromewebstore.google.com/detail/x/'+ID]){f.wc.url=f.frame.url=url;await assert.rejects(f.bridge.invoke(f.event,'status',[ID]));}
 f.wc.url=f.frame.url=URL;await assert.rejects(f.bridge.invoke({...f.event,senderFrame:{...f.frame,parent:f.frame}},'begin',[{id:ID}]));
 f.available=false;await assert.rejects(f.bridge.invoke(f.event,'status',[ID]));assert.equal(f.calls.length,0);f.bridge.dispose();
});
test('a consumed native gesture binds the current detail page and cannot be replayed',async()=>{
 const f=fixture();assert.equal((await f.bridge.invoke(f.event,'begin',[{id:ID}])).result,'user_gesture_required');assert.equal(f.calls.length,0);
 f.gesture();assert.equal((await f.bridge.invoke(f.event,'begin',[{id:ID}])).result,'success');assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.valid(),true);
 assert.equal((await f.bridge.invoke(f.event,'begin',[{id:ID}])).result,'user_gesture_required');assert.equal(await f.bridge.invoke(f.event,'complete',[ID]),'success');
 const receipt=f.bridge.installEvidence(f.wc);assert.equal(receipt.extensionId,ID);assert.equal(receipt.nativeGestureType,'mouseDown');assert.equal(receipt.result,'success');assert.ok(receipt.completeAt>=receipt.installedAt&&receipt.beginAt>=receipt.nativeGestureAt);
 assert.equal(await f.bridge.invoke(f.event,'complete',['a'.repeat(32)]),'install_error');f.bridge.dispose();
});
test('preload publishes lastError before the native CWS callback and clears it after the callback',async()=>{
 const code=fs.readFileSync(path.join(__dirname,'mouse-web-store-preload.cjs'),'utf8'),window={};window.top=window;let exposed,release,called=false;const scripts=[];
 vm.runInNewContext(code,{require:()=>({contextBridge:{exposeInMainWorld(_name,value){exposed=value;}},ipcRenderer:{on(){},invoke:async()=>({result:'install_error',message:'Owned error'})},webFrame:{executeJavaScript:script=>{scripts.push(script);return scripts.length===2?new Promise(resolve=>{release=resolve;}):Promise.resolve();}}}),location:{origin:'https://chromewebstore.google.com'},window,process:{isMainFrame:true},Promise,Map,Set});
 const result=exposed.api.beginInstallWithManifest3({id:ID},value=>{called=true;assert.equal(value,'install_error');assert.match(scripts.at(-1),/Owned error/);});await new Promise(resolve=>setImmediate(resolve));assert.equal(called,false);release();assert.equal(await result,'install_error');assert.equal(called,true);assert.match(scripts.at(-1),/lastError=undefined/);
});
test('navigation during download cancels the origin-bound install and never reports success',async()=>{
 const f=fixture();f.beforeInstall=async options=>{f.wc.url=f.frame.url='https://example.com/';f.wc.emit('did-start-navigation',{},f.wc.url,false,true);assert.equal(options.signal.aborted,true);assert.equal(options.valid(),false);};
 f.gesture();assert.equal((await f.bridge.invoke(f.event,'begin',[{id:ID}])).result,'install_error');f.bridge.dispose();
});
test('uninstall requires a new native gesture and its own actual confirmation',async()=>{
 const f=fixture();f.gesture();await f.bridge.invoke(f.event,'begin',[{id:ID}]);await assert.rejects(f.bridge.invoke(f.event,'uninstall',[ID]));
 f.gesture();assert.equal(await f.bridge.invoke(f.event,'uninstall',[ID]),'user_cancelled');assert.equal((await f.bridge.invoke(f.event,'getAll')).length,1);
 f.gesture();f.consent=1;assert.equal(await f.bridge.invoke(f.event,'uninstall',[ID]),'success');assert.deepEqual(await f.bridge.invoke(f.event,'getAll'),[]);f.bridge.dispose();
});
test('signed Web Store manifests support workers, localization and broad sites without promising native programs',()=>{
 const m={manifest_version:3,name:'__MSG_name__',default_locale:'en',version:'1.2.3',background:{service_worker:'background.js'},permissions:['storage','scripting'],host_permissions:['<all_urls>'],optional_permissions:['contextMenus'],action:{default_popup:'popup.html'},key:'signed',update_url:'https://clients2.google.com/service/update2/crx'},files=new Map([['_locales/en/messages.json',Buffer.from('{"name":{"message":"Owned store fixture"}}')],['popup.html',Buffer.from('content')]]);
 const result=inspectStoreManifest(m,files);assert.equal(result.name,'Owned store fixture');assert.equal(result.popupRel,'popup.html');assert.match(permissionText(result),/всех сайтах/);assert.deepEqual(result.optionalPermissions,['contextMenus']);
 for(const change of [{manifest_version:2},{permissions:['nativeMessaging']},{permissions:['debugger']},{permissions:['proxy']},{optional_permissions:['enterprise.platformKeys']},{theme:{colors:{}}}])assert.throws(()=>inspectStoreManifest({...m,...change},files));
});
test('preload exposes no API in another origin or a subframe and strips IPC event objects',()=>{
 const code=fs.readFileSync(path.join(__dirname,'mouse-web-store-preload.cjs'),'utf8');
 for(const [origin,main]of [['https://example.com',true],['https://chromewebstore.google.com.evil.test',true],['https://chromewebstore.google.com',false]]){
  let exposed=0;const window={};window.top=main?window:{};vm.runInNewContext(code,{require:()=>({contextBridge:{exposeInMainWorld(){exposed++;}}}),location:{origin},window,process:{isMainFrame:main}});assert.equal(exposed,0);
 }
 let exposed,listener;const window={};window.top=window;const calls=[];
 vm.runInNewContext(code,{require:()=>({contextBridge:{exposeInMainWorld(_name,value){exposed=value;}},ipcRenderer:{on(_name,fn){listener=fn;},invoke:async(...args)=>{calls.push(args);return[];}},webFrame:{executeJavaScript:async()=>{}}}),location:{origin:'https://chromewebstore.google.com'},window,process:{isMainFrame:true},Promise,Map,Set});
 let delivered;exposed.management.onInstalled.addListener(value=>{delivered=value;});listener({secret:'ipc'},{event:'installed',data:{id:ID}});assert.equal(delivered.id,ID);assert.equal(delivered.secret,undefined);
});

test('browser Store context derives its ID from the live owned current desktop URL even while the manager hides the guest',async()=>{
 const f=fixture();assert.equal(f.page.visible,false);
 assert.deepEqual(f.bridge.currentPage('owned'),{tabId:'owned',extensionId:ID,url:URL,webContentsId:f.wc.id,title:f.page.title});
 f.page.url='https://evil.test/detail/'+ID;assert.equal(f.bridge.currentPage('owned').url,URL,'Stored metadata cannot replace the real URL');
 assert.equal(f.bridge.currentPage('missing'),null);assert.equal(f.bridge.currentPage({toString:()=> 'owned'}),null);assert.equal(f.calls.length,0);
 f.bridge.dispose();
 const invalid=[
  f=>{f.available=false;},f=>{f.browser.privateMode=true;},f=>{f.browser.disposed=true;},f=>{f.browser.session={};},
  f=>{f.page.project='other';},f=>{f.page.managedExtension={};},f=>{f.page.internal=true;},f=>{f.browser.tabs.delete('owned');},
  f=>{f.browser.mouseDesktops.bank.active='desk-2';},f=>{f.browser.mouseDesktops.bank.members.owned='desk-2';},
  f=>{f.wc.session={};},f=>{f.wc.isDestroyed=()=>true;},f=>{f.win.isDestroyed=()=>true;},f=>{f.shell.isDestroyed=()=>true;},
  f=>{f.frame.detached=true;},f=>{f.frame.parent={};},f=>{f.wc.mainFrame=null;},f=>{f.frame.url=URL+'?different';},
  ...['https://example.com/detail/'+ID,'https://chromewebstore.google.com.evil.test/detail/'+ID,'http://chromewebstore.google.com/detail/'+ID,'https://u:p@chromewebstore.google.com/detail/'+ID,'https://chromewebstore.google.com/search?q='+ID].map(url=>f=>{f.wc.url=f.frame.url=url;})
 ];
 for(const change of invalid){const f=fixture();f.shellGesture();change(f);assert.equal(f.bridge.currentPage('owned'),null);assert.equal((await f.bridge.installFromBrowser('owned')).result,'invalid_id');assert.equal(f.calls.length,0);f.bridge.dispose();}
});

test('browser install requires its own one-use shell gesture and completes only after the loaded Store service returns',async()=>{
 const f=fixture();f.gesture();assert.equal((await f.bridge.installFromBrowser('owned')).result,'user_gesture_required');assert.equal(f.calls.length,0);
 let release;f.beforeInstall=()=>new Promise(resolve=>{release=resolve;});f.shellGesture();assert.ok(f.bridge.currentPage('owned'));
 const request=f.bridge.installFromBrowser('owned');assert.equal(f.calls.length,1);assert.equal(f.calls[0].id,ID);assert.equal(typeof f.calls[0].options.valid,'function');assert.ok(f.calls[0].options.signal instanceof AbortSignal);
 assert.equal(f.bridge.installEvidence(f.wc).completeAt,undefined);assert.equal((await f.bridge.installFromBrowser('owned')).result,'install_in_progress');release();assert.equal((await request).result,'success');
 const receipt=f.bridge.installEvidence(f.wc);assert.equal(receipt.requestSource,'browser-control');assert.equal(receipt.completionSource,'browser-control');assert.equal(receipt.tabId,'owned');assert.equal(receipt.webContentsId,f.wc.id);assert.equal(receipt.nativeGestureWebContentsId,f.shell.id);assert.notEqual(receipt.webContentsId,receipt.nativeGestureWebContentsId);assert.equal(receipt.extensionId,ID);assert.equal(receipt.url,URL);assert.equal(receipt.nativeGestureType,'mouseDown');assert.ok(receipt.completeAt>=receipt.installedAt&&receipt.installedAt>=receipt.beginAt&&receipt.beginAt>=receipt.nativeGestureAt);
 assert.equal((await f.bridge.installFromBrowser('owned')).result,'user_gesture_required');assert.equal(f.calls.length,1);f.bridge.dispose();
 const guest=fixture();guest.shellGesture();assert.equal((await guest.bridge.invoke(guest.event,'begin',[{id:ID}])).result,'user_gesture_required');assert.equal(guest.calls.length,0);guest.bridge.dispose();
});

test('only native left down, Enter and Space authorize browser installation within eight seconds',async t=>{
 let now=10000;t.mock.method(Date,'now',()=>now);
 for(const value of [{type:'mouseUp',button:'left'},{type:'mouseDown',button:'right'},{type:'keyDown',key:'X'}]){const f=fixture();f.shellGesture(value);assert.equal((await f.bridge.installFromBrowser('owned')).result,'user_gesture_required');assert.equal(f.calls.length,0);f.bridge.dispose();}
 for(const key of ['Enter',' ','Space']){const f=fixture();f.shellGesture({type:'keyDown',key});now+=8000;assert.equal((await f.bridge.installFromBrowser('owned')).result,'success');assert.equal(f.bridge.installEvidence(f.wc).nativeGestureType,'keyDown');f.bridge.dispose();}
 const expired=fixture();expired.shellGesture();now+=8001;assert.equal((await expired.bridge.installFromBrowser('owned')).result,'user_gesture_required');assert.equal(expired.calls.length,0);expired.bridge.dispose();
 for(const mutate of [f=>f.shell.emit('did-start-navigation',{},f.shell.url,false,true),f=>{f.shell.mainFrame={...f.shell.mainFrame};},f=>{f.shell.mainFrame=null;},f=>{f.shell.mainFrame.detached=true;}]){const f=fixture();f.shellGesture();mutate(f);assert.equal((await f.bridge.installFromBrowser('owned')).result,'user_gesture_required');assert.equal(f.calls.length,0);f.bridge.dispose();}
});

test('browser navigation, shell navigation and destruction abort pending Store installation',async()=>{
 for(const change of [
  f=>{f.wc.url=f.frame.url=URL+'#other';f.wc.emit('did-start-navigation',{},f.wc.url,true,true);},
  f=>f.wc.emit('did-start-navigation',{},URL,false,true),
  f=>f.shell.emit('did-start-navigation',{},f.shell.url,false,true),
  f=>{f.wc.isDestroyed=()=>true;f.wc.emit('destroyed');},
  f=>{f.shell.isDestroyed=()=>true;f.shell.emit('destroyed');},
  f=>f.bridge.dispose()
 ]){
  const f=fixture();f.beforeInstall=async options=>{change(f);assert.equal(options.signal.aborted,true);assert.equal(options.valid(),false);};f.shellGesture();assert.equal((await f.bridge.installFromBrowser('owned')).result,'install_error');const receipt=f.bridge.installEvidence(f.wc);assert.equal(receipt.completeAt,undefined);assert.equal(receipt.completionSource,undefined);assert.deepEqual(f.extensions.state(),[]);f.bridge.dispose();
 }
});

test('Store guards are rechecked after asynchronous consent across privacy, session, project, desktop and frame changes',async()=>{
 for(const change of [f=>{f.available=false;},f=>{f.browser.privateMode=true;},f=>{f.browser.session={};},f=>{f.wc.session={};},f=>{f.browser.project='other';},f=>{f.browser.mouseDesktops.bank.active='desk-2';},f=>{f.wc.mainFrame={...f.frame};},f=>{f.frame.detached=true;},f=>{f.browser.tabs.set('owned',{...f.page});}]){
  const f=fixture();f.beforeInstall=async options=>{assert.equal(options.valid(),true);await Promise.resolve();change(f);assert.equal(options.valid(),false);};f.shellGesture();assert.equal((await f.bridge.installFromBrowser('owned')).result,'install_error');assert.equal(f.bridge.installEvidence(f.wc).completeAt,undefined);assert.deepEqual(f.extensions.state(),[]);f.bridge.dispose();
 }
});

test('Store service cancellation and failed loads never acquire a browser completion receipt or a guest completion',async()=>{
 const cancelled=fixture();cancelled.gesture();await cancelled.bridge.invoke(cancelled.event,'begin',[{id:ID}]);
 cancelled.beforeInstall=async()=>{const error=Error('Установка отменена');error.code='USER_CANCELLED';throw error;};cancelled.shellGesture();const result=await cancelled.bridge.installFromBrowser('owned');assert.equal(result.result,'user_cancelled');assert.equal(result.message,'Установка отменена');assert.equal(cancelled.bridge.installEvidence(cancelled.wc).completeAt,undefined);
 await cancelled.bridge.invoke(cancelled.event,'complete',[ID]);assert.equal(cancelled.bridge.installEvidence(cancelled.wc).completeAt,undefined,'The legacy callback cannot complete a cancelled browser request');cancelled.bridge.dispose();
 const failed=fixture();failed.extensions.chromiumId=()=>null;failed.shellGesture();assert.equal((await failed.bridge.installFromBrowser('owned')).result,'install_error');assert.equal(failed.bridge.installEvidence(failed.wc).completeAt,undefined);failed.bridge.dispose();
});

test('navigation after the synchronous Store commit preserves the completed installation result',async()=>{
 const f=fixture();let sent=0;f.wc.send=()=>{sent++;};
 f.afterInstall=async()=>{assert.equal(f.bridge.installEvidence(f.wc).result,'success');assert.ok(f.bridge.installEvidence(f.wc).completeAt);f.wc.url=f.frame.url='https://example.com/';f.wc.emit('did-start-navigation',{},f.wc.url,false,true);};
 f.shellGesture();assert.equal((await f.bridge.installFromBrowser('owned')).result,'success');assert.equal(f.extensions.state()[0].enabled,true);assert.equal(f.bridge.installEvidence(f.wc).completionSource,'browser-control');assert.equal(sent,0);f.bridge.dispose();
});
