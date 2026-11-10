const{contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('LightDesktop',{
 capture:enabled=>ipcRenderer.invoke('capture',!!enabled),
 onClipboard:fn=>ipcRenderer.on('clipboard',(_event,data)=>fn(data)),
 openAI:provider=>ipcRenderer.invoke('open-ai',provider),
 saveStart:name=>ipcRenderer.invoke('save-start',name),saveChunk:(token,bytes)=>ipcRenderer.invoke('save-chunk',token,bytes),saveEnd:token=>ipcRenderer.invoke('save-end',token),saveAbort:token=>ipcRenderer.invoke('save-abort',token)
});
