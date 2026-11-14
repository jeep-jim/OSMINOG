'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const on=(channel,callback)=>{const listener=(_event,data)=>callback(data);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener)};
if(process.isMainFrame)contextBridge.exposeInMainWorld('QuadroNative',Object.freeze({
 version:process.argv.find(x=>x.startsWith('--quadro-version='))?.slice(17)||'6.0.0',
 test:process.argv.includes('--quadro-test'),
 init:()=>ipcRenderer.invoke('quadro:init'),save:p=>ipcRenderer.invoke('quadro:save',p),
 browser:(action,args)=>ipcRenderer.invoke('quadro:browser',action,args),theme:t=>ipcRenderer.invoke('quadro:theme',t),
 globalCapture:(action,args)=>ipcRenderer.invoke('quadro:global-capture-admin',action,args),onGlobalCapture:cb=>on('quadro:global-capture-state',cb),
 capture:(action,args)=>ipcRenderer.invoke('quadro:capture',action,args),
 aiIcon:args=>ipcRenderer.invoke('mouse:ai-icon',args),favicon:id=>ipcRenderer.invoke('quadro:favicon',id),chrome:()=>ipcRenderer.invoke('quadro:chrome'),onChrome:cb=>on('quadro:chrome',cb),
 library:(action,args)=>ipcRenderer.invoke('quadro:library',action,args),onLibrary:cb=>on('quadro:library-changed',cb),
 overlay:state=>ipcRenderer.invoke('quadro:overlay',state),
 start:(action,args)=>ipcRenderer.invoke('quadro:start',action,args),onStart:cb=>on('quadro:start-changed',cb),
 window:action=>ipcRenderer.invoke('quadro:window',action),
 web3:(action,args)=>ipcRenderer.invoke('quadro:web3-admin',action,args),onWeb3:cb=>on('quadro:web3-state',cb),
 wallet:(action,args)=>ipcRenderer.invoke('quadro:wallet',action,args),update:action=>ipcRenderer.invoke('quadro:update',action),
 onState:cb=>on('browser:state',cb),onFocus:cb=>on('browser:focus',cb),onError:cb=>on('browser:error',cb),
 onMenu:cb=>on('quadro:menu',cb),onUpdate:cb=>on('quadro:update-state',cb)
}));
