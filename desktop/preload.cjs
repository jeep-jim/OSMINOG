'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Only the packaged main frame receives native capabilities. Documents and remote frames do not.
if(process.isMainFrame)contextBridge.exposeInMainWorld('OSMINOGNative',{
  checkUpdate:()=>ipcRenderer.invoke('update:check'),
  downloadUpdate:()=>ipcRenderer.invoke('update:download'),
  installUpdate:()=>ipcRenderer.invoke('update:install'),
  get:keys=>ipcRenderer.invoke('store:get',keys),
  set:values=>ipcRenderer.invoke('store:set',values),
  remove:keys=>ipcRenderer.invoke('store:remove',keys),
  open:url=>ipcRenderer.invoke('external:open',url),
  onChanged:callback=>{const listener=(_,changes)=>callback(changes,'local');ipcRenderer.on('store:changed',listener);return()=>ipcRenderer.removeListener('store:changed',listener)},
  version:'0.1.0'
});
