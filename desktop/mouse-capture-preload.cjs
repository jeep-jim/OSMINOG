'use strict';
const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame)contextBridge.exposeInMainWorld('MouseNative',Object.freeze({
 test:process.argv.includes('--mouse-capture-test'),
 theme:process.argv.find(x=>x.startsWith('--mouse-capture-theme='))?.split('=')[1]==='dark'?'dark':'light',
 capture:(action,args)=>{if(!['initial','copy','save'].includes(action))return Promise.reject(Error('Unsupported screenshot action'));return ipcRenderer.invoke('mouse:global-capture-editor',action,args);},
 close:()=>ipcRenderer.invoke('mouse:global-capture-editor','close')
}));
