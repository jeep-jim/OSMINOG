'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const on=(channel,callback)=>{const listener=(_event,data)=>callback(data);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener)};
if(process.isMainFrame)contextBridge.exposeInMainWorld('MouseNative',Object.freeze({
 version:process.argv.find(x=>x.startsWith('--mouse-version='))?.split('=').slice(1).join('=')||'6.0.0',
 test:process.argv.includes('--mouse-test'),
 agent:(action,args)=>ipcRenderer.invoke('mouse:agent',action,args),onAgent:cb=>on('mouse:agent-state',cb),onTerminal:cb=>on('mouse:terminal-data',cb),onAgentOpen:cb=>on('mouse:agent-open',cb),
 documents:(action,args)=>ipcRenderer.invoke('mouse:documents',action,args),onDocuments:cb=>on('mouse:documents-state',cb),
 desktops:(action,args)=>ipcRenderer.invoke('mouse:desktops',action,args),
 desktopGesture:(action,args)=>ipcRenderer.invoke('mouse:desktop-gesture',action,args),onDesktopSwipe:cb=>on('mouse:desktop-swipe',cb),
 progress:(action,args)=>ipcRenderer.invoke('mouse:progress',action,args),onProgress:cb=>on('mouse:progress-state',cb),
 onPreviewsCleared:cb=>on('mouse:previews-cleared',cb),
 zoom:(action,args)=>ipcRenderer.invoke('mouse:zoom',action,args),onZoom:cb=>on('mouse:zoom-state',cb),
 archive:(action,args)=>ipcRenderer.invoke('mouse:archive',action,args),
 emoji:(action,target)=>ipcRenderer.invoke('mouse:emoji',action,target),
 privacy:()=>ipcRenderer.invoke('mouse:privacy'),init:()=>ipcRenderer.invoke('mouse:init'),save:(p,history)=>ipcRenderer.invoke('mouse:save',p,history),
 browser:(action,args)=>ipcRenderer.invoke('mouse:browser',action,args),theme:t=>ipcRenderer.invoke('mouse:theme',t),
 globalCapture:(action,args)=>ipcRenderer.invoke('mouse:global-capture-admin',action,args),onGlobalCapture:cb=>on('mouse:global-capture-state',cb),
 capture:(action,args)=>ipcRenderer.invoke('mouse:capture',action,args),
 aiIcon:args=>ipcRenderer.invoke('mouse:ai-icon',args),favicon:id=>ipcRenderer.invoke('mouse:favicon',id),chrome:()=>ipcRenderer.invoke('mouse:chrome'),onChrome:cb=>on('mouse:chrome',cb),
 library:(action,args)=>ipcRenderer.invoke('mouse:library',action,args),onLibrary:cb=>on('mouse:library-changed',cb),
 overlay:state=>ipcRenderer.invoke('mouse:overlay',state),
 start:(action,args)=>ipcRenderer.invoke('mouse:start',action,args),onStart:cb=>on('mouse:start-changed',cb),
 window:action=>ipcRenderer.invoke('mouse:window',action),
 update:action=>ipcRenderer.invoke('mouse:update',action),
 onState:cb=>on('browser:state',cb),onFocus:cb=>on('browser:focus',cb),onError:cb=>on('browser:error',cb),
 onMenu:cb=>on('mouse:menu',cb),onUpdate:cb=>on('mouse:update-state',cb)
}));
