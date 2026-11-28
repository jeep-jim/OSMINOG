'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const on=(channel,callback)=>{const listener=(_event,data)=>callback(data);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener)};
if(process.isMainFrame)contextBridge.exposeInMainWorld('MouseNative',Object.freeze({
 platform:process.platform,arch:process.arch,
 ...(process.platform==='darwin'?{frameLease:(...args)=>ipcRenderer.invoke('mouse:frame-lease',...args),profile:(action,args)=>ipcRenderer.invoke('mouse:profile',action,args),account:(action,args)=>ipcRenderer.invoke('mouse:account',action,args),onAccount:cb=>on('mouse:account-state',cb),flashPanel:(action,args)=>ipcRenderer.invoke('mouse:flash-panel',action,args),openFlash:()=>ipcRenderer.invoke('mouse:open-flash')}:{}),
 version:process.argv.find(x=>x.startsWith('--mouse-version='))?.split('=').slice(1).join('=')||'6.0.0',
 test:process.argv.includes('--mouse-test'),
 extensions:(action,args)=>ipcRenderer.invoke('mouse:extensions',action,args),
 onExtensions:cb=>on('mouse:extensions-changed',cb),onExtensionTab:cb=>on('mouse:extension-tab',cb),
 contextMenu:args=>ipcRenderer.invoke('mouse:context-menu',args),onContextAction:cb=>on('mouse:context-action',cb),
 settings:(action,args)=>ipcRenderer.invoke('mouse:settings',action,args),onSettings:cb=>on('mouse:settings-state',cb),
 inputLanguage:(action,args)=>ipcRenderer.invoke('mouse:input-language',action,args),onInputLanguage:cb=>on('mouse:input-language-state',cb),onInputSuggestion:cb=>on('mouse:input-suggestion',cb),
 adBlockExceptions:(action,args)=>ipcRenderer.invoke('mouse:adblock-exceptions',action,args),onAdBlockExceptions:cb=>on('mouse:adblock-exceptions-state',cb),
 adBlockState:()=>ipcRenderer.invoke('mouse:adblock-state'),onAdBlockState:cb=>on('mouse:adblock-state',cb),
 adBlockSubscriptions:(action,args)=>ipcRenderer.invoke('mouse:adblock-subscriptions',action,args),
 import:(action,args)=>ipcRenderer.invoke('mouse:import',action,args),
 documents:(action,args)=>ipcRenderer.invoke('mouse:documents',action,args),onDocuments:cb=>on('mouse:documents-state',cb),
 desktops:(action,args)=>ipcRenderer.invoke('mouse:desktops',action,args),
 desktopGesture:(action,args)=>ipcRenderer.invoke('mouse:desktop-gesture',action,args),onDesktopSwipe:cb=>on('mouse:desktop-swipe',cb),
 progress:(action,args)=>ipcRenderer.invoke('mouse:progress',action,args),onProgress:cb=>on('mouse:progress-state',cb),
 onPreviewsCleared:cb=>on('mouse:previews-cleared',cb),
 zoom:(action,args)=>ipcRenderer.invoke('mouse:zoom',action,args),onZoom:cb=>on('mouse:zoom-state',cb),
 archive:(action,args)=>ipcRenderer.invoke('mouse:archive',action,args),
 emoji:(action,target)=>ipcRenderer.invoke('mouse:emoji',action,target),
 privacy:()=>ipcRenderer.invoke('mouse:privacy'),init:()=>ipcRenderer.invoke('mouse:init'),save:(p,history)=>ipcRenderer.invoke('mouse:save',p,history),
 address:(action,args)=>ipcRenderer.invoke('mouse:address',action,args),
 browser:(action,args)=>ipcRenderer.invoke('mouse:browser',action,args),theme:t=>ipcRenderer.invoke('mouse:theme',t),appearance:value=>ipcRenderer.invoke('mouse:appearance',value),
 globalCapture:(action,args)=>ipcRenderer.invoke('mouse:global-capture-admin',action,args),onGlobalCapture:cb=>on('mouse:global-capture-state',cb),
 capture:(action,args)=>ipcRenderer.invoke('mouse:capture',action,args),
 aiIcon:args=>ipcRenderer.invoke('mouse:ai-icon',args),favicon:id=>ipcRenderer.invoke('mouse:favicon',id),chrome:()=>ipcRenderer.invoke('mouse:chrome'),onChrome:cb=>on('mouse:chrome',cb),
 library:(action,args)=>ipcRenderer.invoke('mouse:library',action,args),onLibrary:cb=>on('mouse:library-changed',cb),
 overlay:state=>ipcRenderer.invoke('mouse:overlay',state),
 start:(action,args)=>ipcRenderer.invoke('mouse:start',action,args),onStart:cb=>on('mouse:start-changed',cb),
 window:action=>ipcRenderer.invoke('mouse:window',action),
 update:action=>ipcRenderer.invoke('mouse:update',action),
 onActivateTab:cb=>on('mouse:activate-tab',cb),onPageArrange:cb=>on('mouse:page-arrange',cb),pageArrange:(action,args)=>ipcRenderer.invoke('mouse:page-arrange-control',action,args),
 onState:cb=>on('browser:state',cb),onFocus:cb=>on('browser:focus',cb),onError:cb=>on('browser:error',cb),
 onMenu:cb=>on('mouse:menu',cb),onUpdate:cb=>on('mouse:update-state',cb)
}));
// This receipt contains no field value. It lets an explicit language selection
// return to the actual shell editor instead of an older guest page.
if(process.isMainFrame&&typeof document!=='undefined')document.addEventListener('focusin',event=>{
 if(!event.isTrusted)return;
 const target=event.composedPath?.()[0]||event.target;
 if(target?.matches?.('input,textarea,[contenteditable="true"],[contenteditable=""]')||target?.isContentEditable)ipcRenderer.send('mouse:input-focus');
},true);
