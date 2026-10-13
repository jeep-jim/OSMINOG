'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Only the packaged main frame receives native capabilities. Documents and remote frames do not.
if(process.isMainFrame)contextBridge.exposeInMainWorld('OSMINOGNative',{
  browser:(action,args)=>ipcRenderer.invoke('browser:command',action,args),
  runtime:(message,projectId)=>ipcRenderer.invoke('provider:runtime',message,projectId),
  onProvider:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('provider:open',listener);return()=>ipcRenderer.removeListener('provider:open',listener)},
  onBrowser:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('browser:state',listener);return()=>ipcRenderer.removeListener('browser:state',listener)},
  checkUpdate:()=>ipcRenderer.invoke('update:check'),
  updateState:()=>ipcRenderer.invoke('update:state'),
  onUpdate:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('update:state',listener);return()=>ipcRenderer.removeListener('update:state',listener)},
  downloadUpdate:()=>ipcRenderer.invoke('update:download'),
  installUpdate:()=>ipcRenderer.invoke('update:install'),
  get:keys=>ipcRenderer.invoke('store:get',keys),
  set:values=>ipcRenderer.invoke('store:set',values),
  remove:keys=>ipcRenderer.invoke('store:remove',keys),
  open:url=>ipcRenderer.invoke('external:open',url),
  onChanged:callback=>{const listener=(_,changes)=>callback(changes,'local');ipcRenderer.on('store:changed',listener);return()=>ipcRenderer.removeListener('store:changed',listener)},
  version:process.argv.find(arg=>arg.startsWith('--osminog-version='))?.slice('--osminog-version='.length)||'0.2.1'
});

