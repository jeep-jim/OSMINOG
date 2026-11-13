'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const on=(channel,callback)=>{const listener=(_event,data)=>callback(data);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener)};
if(process.isMainFrame)contextBridge.exposeInMainWorld('QuadroNative',Object.freeze({
 version:process.argv.find(x=>x.startsWith('--quadro-version='))?.slice(17)||'6.0.0',
 test:process.argv.includes('--quadro-test'),
 init:()=>ipcRenderer.invoke('quadro:init'),save:p=>ipcRenderer.invoke('quadro:save',p),
 browser:(action,args)=>ipcRenderer.invoke('quadro:browser',action,args),theme:t=>ipcRenderer.invoke('quadro:theme',t),
 wallet:(action,args)=>ipcRenderer.invoke('quadro:wallet',action,args),update:action=>ipcRenderer.invoke('quadro:update',action),
 onState:cb=>on('browser:state',cb),onFocus:cb=>on('browser:focus',cb),onError:cb=>on('browser:error',cb),
 onMenu:cb=>on('quadro:menu',cb),onUpdate:cb=>on('quadro:update-state',cb)
}));
