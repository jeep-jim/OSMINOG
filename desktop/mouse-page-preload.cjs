'use strict';
// The only page-visible API reports progress for this page. It grants no browser,
// terminal, file, or other-tab access. Native image drag still requires a gesture.
const {ipcRenderer,contextBridge,webFrame}=require('electron');
// Install before page scripts/paint. This remains in the isolated preload and
// changes only native scrollbars; no new bridge or page-callable method exists.
if(typeof location!=='undefined'&&/^https?:$/.test(location.protocol)&&typeof webFrame?.insertCSS==='function'){
 webFrame.insertCSS(MouseScrollbarCSS,{cssOrigin:'user'});
}
if(process.isMainFrame){
 let taskContext=null,documentActive=true,documentVersion=0;
 const resetTaskContext=()=>{taskContext=null;documentVersion++;};
 const context=()=>{
  if(!documentActive)return Promise.reject(Error('Страница задачи уже закрыта'));
  if(!taskContext){const pending=ipcRenderer.invoke('mouse:page-progress-context');taskContext=pending;pending.catch(()=>{if(taskContext===pending)taskContext=null;});}
  return taskContext;
 };
 const updateProgress=async(percent,statusText,options={})=>{
  const version=documentVersion,owner=await context();if(!documentActive||version!==documentVersion)throw Error('Страница задачи уже изменилась');
  return ipcRenderer.invoke('mouse:page-progress',{percent,statusText,taskId:options?.taskId,phase:options?.phase,etaSeconds:options?.etaSeconds,documentToken:owner.documentToken});
 };
 // Electron refuses to bind over an existing main-world property. Wait until
 // the site's initial scripts ran, and leave its own `browser` namespace alone.
 const browserAlias=()=>{try{contextBridge.exposeInMainWorld('browser',Object.freeze({setProgress:updateProgress}));}catch{/* The page owns an existing browser namespace. */}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',browserAlias,{once:true});else browserAlias();
 if(typeof window!=='undefined'){
  window.addEventListener('pagehide',()=>{documentActive=false;resetTaskContext();});
  window.addEventListener('pageshow',()=>{documentActive=true;});
 }
  if(typeof MouseDesktopWheel!=='undefined'&&typeof window!=='undefined'&&/^https?:$/.test(location.protocol)){
    let wheel=null;const start=()=>{if(!wheel)wheel=MouseDesktopWheel.listen({window,scope:()=> 'page',send:value=>ipcRenderer.send('mouse:desktop-wheel',value)});};
    start();window.addEventListener('pageshow',start);window.addEventListener('pagehide',()=>{wheel?.dispose();wheel=null;});
  }
 // The activity observer is lexical to this isolated preload. Only its small
 // presentation packet reaches main; it is not a page-callable browser API.
 if(typeof location!=='undefined'&&/^https?:$/.test(location.protocol)&&!process.argv?.includes('--mouse-private-page')){
  let activity=null;
  const start=()=>{if(!activity)activity=MousePageActivity.observe({document,window,send:value=>{
   const version=documentVersion;void context().then(owner=>{if(documentActive&&version===documentVersion)ipcRenderer.send('mouse:page-activity',{...value,documentToken:owner.documentToken});}).catch(()=>{});
  }});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('pageshow',start);
  window.addEventListener('pagehide',()=>{activity?.dispose();activity=null;});
  ipcRenderer.on('mouse:page-activity-resync',()=>{resetTaskContext();activity?.refresh();});
 }
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
