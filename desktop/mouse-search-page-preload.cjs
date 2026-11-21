'use strict';
// Sandbox preload for search cards only. No bridge, Node API, page values or
// keys are exposed to websites. The owning WebContents validates every IPC.
const {ipcRenderer}=require('electron');
let enabled=false,outerScroll=true;
ipcRenderer.on('mouse:search-page-control',(_event,state)=>{enabled=state?.enabled===true;outerScroll=state?.outerScroll!==false;});
window.addEventListener('wheel',event=>{
 if(!enabled||!outerScroll||!event.isTrusted)return;
 const scale=event.deltaMode===1?16:event.deltaMode===2?Math.max(1,innerHeight):1;
 if(!Number.isFinite(event.deltaX)||!Number.isFinite(event.deltaY))return;
 event.preventDefault();event.stopPropagation();
 const bound=value=>Math.max(-4096,Math.min(4096,value*scale));
 ipcRenderer.send('mouse:search-wheel',{deltaX:bound(event.deltaX),deltaY:bound(event.deltaY),ctrlKey:!!event.ctrlKey});
},{capture:true,passive:false});
