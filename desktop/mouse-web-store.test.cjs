'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {installMouseWebStore,storeURL,detailID}=require('./mouse-web-store.cjs');
const {inspectStoreManifest,permissionText}=require('./mouse-web-store-manager.cjs');
const ID='eimadpbcbfnmbkopoojfekhnkhdbieeh',URL='https://chromewebstore.google.com/detail/dark-reader/'+ID;
function fixture(){
 const app=new EventEmitter(),win={},ipcMain={handle(name,fn){this.name=name;this.handler=fn;},removeHandler(){}};
 const session={registerPreloadScript(options){this.preload=options;},unregisterPreloadScript(){}};
 let available=true,installed=[],beforeInstall=async()=>{},consent=0;
 const wc=new EventEmitter();Object.assign(wc,{session,url:URL,isDestroyed:()=>false,getURL(){return this.url;},send(){}});const frame={url:URL,parent:null,detached:false};wc.mainFrame=frame;
 const browser={session,tabs:new Map([['owned',{view:{webContents:wc}}]]),providers:new Map()};const calls=[];
 const extensions={state:()=>installed,installStore:async(id,options)=>{calls.push({id,options});await beforeInstall(options);if(!options.valid())throw Error('Страница установки изменилась');installed=[{id,source:'chrome-web-store',enabled:true,name:'Owned fixture',version:'1'}];},setEnabled:async(id,value)=>{installed[0].enabled=value;},remove:async()=>{installed=[];}};
 const bridge=installMouseWebStore({app,browser,win,ipcMain,dialog:{showMessageBox:async()=>({response:consent})},extensions,isAvailable:()=>available});
 return {app,wc,frame,event:{sender:wc,senderFrame:frame},session,bridge,calls,gesture:()=>wc.emit('before-mouse-event',{}, {type:'mouseDown',button:'left'}),set available(v){available=v;},set beforeInstall(fn){beforeInstall=fn;},set consent(v){consent=v;}};
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
