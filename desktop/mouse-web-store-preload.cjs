'use strict';
// Only this exact top-level origin receives the store API. No host bridge is
// exposed to extension pages, normal sites, embedded frames or private sessions.
const {contextBridge,ipcRenderer,webFrame}=require('electron');
if(location.origin==='https://chromewebstore.google.com'&&window.top===window&&process.isMainFrame!==false){
 const listeners=new Map();
 const call=(method,args=[])=>ipcRenderer.invoke('mouse:web-store',method,args);
 const done=(promise,callback)=>promise.then(value=>{if(typeof callback==='function')callback(value);return value;});
 const events=name=>({addListener:fn=>{if(typeof fn!=='function')return;if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeListener:fn=>listeners.get(name)?.delete(fn),hasListener:fn=>listeners.get(name)?.has(fn)||false});
 ipcRenderer.on('mouse:web-store-event',(_event,{event,data}={})=>{for(const listener of listeners.get(event)||[])try{listener(data);}catch{}});
 const Result={SUCCESS:'success',ALREADY_INSTALLED:'already_installed',INSTALL_ERROR:'install_error',INSTALL_IN_PROGRESS:'install_in_progress',INVALID_ID:'invalid_id',USER_CANCELLED:'user_cancelled',USER_GESTURE_REQUIRED:'user_gesture_required',MANIFEST_ERROR:'manifest_error',BLOCKED_BY_POLICY:'blocked_by_policy',UNSUPPORTED_EXTENSION_TYPE:'unsupported_extension_type',UNKNOWN_ERROR:'unknown_error'};
 const Status={INSTALLABLE:'installable',ENABLED:'enabled',DISABLED:'disabled',CORRUPTED:'corrupted',BLOCKED_BY_POLICY:'blocked_by_policy',DEPRECATED_MANIFEST_VERSION:'deprecated_manifest_version'};
 const api={
  ExtensionInstallStatus:Status,Result,MV2DeprecationStatus:{INACTIVE:'inactive',WARNING:'warning',SOFT_DISABLE:'soft_disable'},WebGlStatus:{WEBGL_ALLOWED:'webgl_allowed',WEBGL_BLOCKED:'webgl_blocked'},
  beginInstallWithManifest3:(details,callback)=>call('begin',[details]).then(async({result,message})=>{
   // Chrome exposes lastError only while invoking this callback. Wait for the
   // main-world value before crossing the bridge; otherwise CWS can miss the
   // failure and render a completed installation after a cancelled prompt.
   const setError=value=>webFrame.executeJavaScript('if(globalThis.chrome){chrome.runtime.lastError='+JSON.stringify(value)+';chrome.extension.lastError='+JSON.stringify(value)+';}');
   await setError(message?{message}:undefined);
   try{if(typeof callback==='function')callback(result);return result;}finally{await setError(undefined);}
  }),
  completeInstall:(id,callback)=>done(call('complete',[id]),callback),
  getExtensionStatus:(id,manifest,callback)=>done(call('status',[id,manifest]),callback),
  getFullChromeVersion:callback=>done(call('version'),callback),
  getMV2DeprecationStatus:callback=>done(Promise.resolve('soft_disable'),callback),
  getWebGLStatus:callback=>done(call('webgl'),callback),
  isInIncognitoMode:callback=>done(Promise.resolve(false),callback),
  isPendingCustodianApproval:(_id,callback)=>done(Promise.resolve(false),callback),
  getIsLauncherEnabled:callback=>done(Promise.resolve(false),callback),
  getBrowserLogin:callback=>done(Promise.resolve(''),callback),
  getStoreLogin:callback=>done(Promise.resolve(''),callback),
  getReferrerChain:callback=>done(Promise.resolve(''),callback),
  shouldShowEnterprisePromotionBanner:callback=>done(Promise.resolve(false),callback),
  logEnterprisePromoShown:()=>{},onEnterprisePromoClick:()=>{}
 };
 const management={getAll:callback=>done(call('getAll'),callback),setEnabled:(id,enabled,callback)=>done(call('setEnabled',[id,enabled]),callback),uninstall:(id,options,callback)=>done(call('uninstall',[id]),typeof options==='function'?options:callback),onInstalled:events('installed'),onUninstalled:events('uninstalled'),onEnabled:events('enabled'),onDisabled:events('disabled')};
 contextBridge.exposeInMainWorld('__mouseChromeStore',{api,management});
 void webFrame.executeJavaScript(`(()=>{const chrome=globalThis.chrome||(globalThis.chrome={});chrome.runtime=chrome.runtime||{};chrome.extension=chrome.extension||{};chrome.management=Object.assign(chrome.management||{},__mouseChromeStore.management);chrome.webstorePrivate=__mouseChromeStore.api;})();`);
}
