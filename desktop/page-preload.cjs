'use strict';
// Website composers belong to the user. Never intercept send or inject context.
const {ipcRenderer}=require('electron');
if(process.isMainFrame){
 document.addEventListener('dragstart',event=>{if(!event.isTrusted)return;const image=event.target.closest?.('img,video,audio');const url=image?.currentSrc||image?.src||'';const text=url?'':String(getSelection()).slice(0,100000);if(url||text){const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');event.dataTransfer?.setData('application/x-osminog-page-drag',token);ipcRenderer.send('page:drag',{url,text,token})}},true);
}
