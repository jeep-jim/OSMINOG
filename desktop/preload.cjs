'use strict';
const {contextBridge,ipcRenderer}=require('electron');
// Only the packaged main frame receives native capabilities. Documents and remote frames do not.
if(process.isMainFrame)contextBridge.exposeInMainWorld('OSMINOGNative',{
  agentRuntime:true,
  chatActions:payload=>ipcRenderer.invoke('osminog.chat.actions',payload),
  onChain:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('osminog.chat.progress',listener);return()=>ipcRenderer.removeListener('osminog.chat.progress',listener)},
  copyFiles:files=>ipcRenderer.invoke('file:copy',files),
  openFile:file=>ipcRenderer.invoke('file:open',file),
  officeFile:file=>ipcRenderer.invoke('file:office',file),
  browser:(action,args)=>ipcRenderer.invoke('browser:command',action,args),
  saveFile:args=>ipcRenderer.invoke('file:save',args),
  runtime:(message,projectId)=>ipcRenderer.invoke('provider:runtime',message,projectId),
  onMedia:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('browser:media',listener);return()=>ipcRenderer.removeListener('browser:media',listener)},
  onProvider:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('provider:open',listener);return()=>ipcRenderer.removeListener('provider:open',listener)},
  onFocus:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('browser:focus',listener);return()=>ipcRenderer.removeListener('browser:focus',listener)},
  onBrowser:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('browser:state',listener);return()=>ipcRenderer.removeListener('browser:state',listener)},
  onTaskStatus:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('browser:task-status',listener);return()=>ipcRenderer.removeListener('browser:task-status',listener)},
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



