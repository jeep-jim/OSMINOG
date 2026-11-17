'use strict';
// No page-visible bridge. Only an actual drag of a visible image can request a
// bounded native file drag. Ordinary text/link/file drops remain Chromium's.
const {ipcRenderer}=require('electron');
if(process.isMainFrame){
 let inFlight=false;
 document.addEventListener('dragstart',event=>{
  if(inFlight||!event.isTrusted||event.defaultPrevented)return;
  const img=event.composedPath().find(node=>node instanceof HTMLImageElement);
  if(!img||!img.complete||!img.naturalWidth||img.naturalWidth*img.naturalHeight>16000000)return;
  const box=img.getBoundingClientRect();if(box.width<8||box.height<8||event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)return;
  let src=img.currentSrc||img.src;if(!/^(https?:|blob:|data:image\/)/i.test(src))return;
  try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);src=canvas.toDataURL('image/png');}catch{}
  if(src.length>24*1024*1024||src.startsWith('blob:'))return;
  event.preventDefault();inFlight=true;
  ipcRenderer.invoke('mouse:image-drag',{src}).catch(()=>{}).finally(()=>{inFlight=false;});
 },true);
}
