'use strict';
const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame)contextBridge.exposeInMainWorld('QuadroNative',Object.freeze({
 test:process.argv.includes('--quadro-capture-test'),
 theme:process.argv.find(x=>x.startsWith('--quadro-capture-theme='))?.split('=')[1]==='dark'?'dark':'light',
 capture:(action,args)=>{if(!['initial','copy','save'].includes(action))return Promise.reject(Error('Unsupported screenshot action'));return ipcRenderer.invoke('quadro:global-capture-editor',action,args);},
 close:()=>ipcRenderer.invoke('quadro:global-capture-editor','close')
}));
