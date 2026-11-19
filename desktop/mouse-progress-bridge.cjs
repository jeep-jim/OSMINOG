'use strict';
// Presentation-only task metadata. Neither navigation nor a loading spinner is
// a task. The sender, document token and native tab membership own every report.
const {randomUUID}=require('node:crypto');
const {etaSeconds,phase,MAX_PER_OWNER,ProgressLimitError}=require('./mouse-progress.cjs');
function install({win,browser,ipcMain,trusted,progress,isPrivate=()=>false,powerMonitor}){
 const shell=win.webContents,owners=new Map(),automatic=new Map(),bindings=new Map(),listeners=new Set();let disposed=false,locked=false,shellEpoch=0;
 const listen=(target,event,handler)=>{const entry=[target,event,handler];target.on(event,handler);listeners.add(entry);return()=>{target.removeListener(event,handler);listeners.delete(entry);};};
 function context(page){
  const bank=browser.mouseDesktops?.bank,desk=bank&&Object.hasOwn(bank.members,page.id)?bank.members[page.id]:'';if(!desk)return null;
  const wc=page.view.webContents,binding=bindings.get(wc);if(wc.isDestroyed()||binding?.page!==page)return null;
  let hostname;try{const u=new URL(wc.getURL());if(!['http:','https:'].includes(u.protocol))return null;hostname=u.hostname;}catch{return null;}
  return{desk,source:'page',label:hostname.slice(0,64),tabId:page.id,token:binding.token};
 }
 function clearPage(wc){for(const map of [owners,automatic]){const entry=map.get(wc.id);if(entry){progress.removeOwner(entry.owner);map.delete(wc.id);}}}
 function resetDocument(wc){clearPage(wc);const binding=bindings.get(wc);if(binding)binding.token=randomUUID();}
 function reconcile(){
  for(const map of [owners,automatic])for(const[id,entry]of map){
   const page=browser.tabs.get(entry.tabId),next=page&&context(page);
   if(!next||next.token!==entry.token||next.label!==entry.label){progress.removeOwner(entry.owner);map.delete(id);}
   else if(next.desk!==entry.desk){progress.moveOwner(entry.owner,next.desk);entry.desk=next.desk;}
  }
 }
 function available(){if(disposed||locked||isPrivate())throw Error('Прогресс недоступен в этом режиме');}
 function requestResync(wc){try{if(!wc.isDestroyed())wc.send?.('mouse:page-activity-resync');}catch{/* Closing pages cannot interrupt document cleanup. */}}
 function bind(page){
  const wc=page.view.webContents;if(bindings.has(wc))return;bindings.set(wc,{page,token:randomUUID()});const off=[];
  // A pushState/hash route changes the browser's navigationEpoch, but retains
  // the same document and its actual background task. Only a new document
  // invalidates its token and removes task metadata; load completion emits none.
  off.push(listen(wc,'did-start-navigation',(_event,_url,inPlace,mainFrame)=>{if(mainFrame&&!inPlace)resetDocument(wc);}));
  off.push(listen(wc,'did-fail-load',(_event,_code,_description,_url,mainFrame)=>{if(mainFrame!==false)requestResync(wc);}));
  off.push(listen(wc,'render-process-gone',()=>resetDocument(wc)));
  off.push(listen(wc,'destroyed',()=>{clearPage(wc);bindings.delete(wc);for(const remove of off)remove();}));
 }
 for(const page of browser.tabs.values())bind(page);
 const previousMake=browser.make;const make=function(...args){const page=previousMake.apply(this,args);bind(page);return page;};browser.make=make;
 const previousEmit=browser.emit;const emit=function(...args){if(!disposed)reconcile();return previousEmit.apply(this,args);};browser.emit=emit;
 function payload(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid progress update');const {percent,statusText,taskId}=value;
  if(percent!==null&&percent!==undefined&&(typeof percent!=='number'||!Number.isFinite(percent)||percent<0||percent>100))throw Error('Progress must be null or 0–100');
  if(typeof statusText!=='string'||statusText.length>240)throw Error('Progress status must be at most 240 characters');
  if(taskId!==undefined&&(typeof taskId!=='string'||!/^[a-zA-Z0-9_.:-]{1,64}$/.test(taskId)))throw Error('Invalid progress task ID');
  return{percent:percent??null,statusText,...(taskId?{taskId}:{}),phase:phase(value.phase),etaSeconds:etaSeconds(value.etaSeconds)};
 }
 function pageForEvent(event){
  const wc=event.sender;if(!wc||wc.isDestroyed()||event.senderFrame!==wc.mainFrame)throw Error('Progress requires the owning main frame');
  const page=bindings.get(wc)?.page,ctx=page&&browser.tabs.get(page.id)===page&&context(page);if(!ctx)throw Error('Page does not own a workspace tab');return{wc,page,ctx};
 }
 function documentForEvent(event,value){const result=pageForEvent(event);if(value?.documentToken!==result.ctx.token)throw Error('Progress document is no longer current');return result;}
 function pageCapacity(page,owner,clean){
  if(clean.phase!=='running'||clean.percent===100)return;
  const active=[...progress.entries.values()].filter(entry=>entry.phase==='running'&&entry.source==='page'&&entry.tabId===page.id);
  if(active.some(entry=>entry.owner===owner&&entry.taskId===(clean.taskId??'default')))return;
  // Both public APIs and DOM declarations belong to this same page. Separate
  // source-kind bookkeeping must not double its four-task presentation limit.
  if(active.length>=MAX_PER_OWNER)throw new ProgressLimitError();
 }
 ipcMain.handle('mouse:page-progress-context',event=>{available();return{documentToken:pageForEvent(event).ctx.token};});
 ipcMain.handle('mouse:page-progress',(event,value)=>{
  available();const {wc,page,ctx}=documentForEvent(event,value),clean=payload(value);reconcile();let entry=owners.get(wc.id);
  if(!entry){entry={...ctx,owner:'page:'+wc.id+':'+ctx.token};owners.set(wc.id,entry);}
  pageCapacity(page,entry.owner,clean);
  return progress.report(entry.owner,{...clean,desk:ctx.desk,source:ctx.source,label:ctx.label,tabId:page.id,kind:'reported',estimated:true});
 });
 // An explicitly marked DOM task is an opt-in site report, not a prediction.
 // The isolated preload sends only bounded semantic attributes, never page text.
 const activity=(event,value)=>{
  try{
   available();const {wc,page,ctx}=documentForEvent(event,value);
   if(!value||typeof value!=='object'||Array.isArray(value)||value.kind!=='dom'||typeof value.active!=='boolean')return;
   const clean=payload(value);if(!clean.taskId)return;reconcile();let entry=automatic.get(wc.id);
   if(!value.active){if(entry)progress.removeTask(entry.owner,clean.taskId);return;}
   if(!entry){entry={...ctx,owner:'observed:'+wc.id+':'+ctx.token};automatic.set(wc.id,entry);}
   pageCapacity(page,entry.owner,clean);
   progress.report(entry.owner,{...clean,desk:ctx.desk,source:'page',label:ctx.label,tabId:page.id,kind:'observed',estimated:true});
  }catch{/* Invalid, expired or over-limit site hints cannot interrupt browsing. */}
 };
 if(ipcMain.on)listen(ipcMain,'mouse:page-activity',activity);
 ipcMain.handle('mouse:progress',(event,action,value={})=>{
  trusted(event);if(action==='state')return isPrivate()||locked?{tasks:[],revision:0}:progress.snapshot();available();
  if(action==='dismiss'){if(typeof value.id!=='string'||value.id.length>200)throw Error('Invalid progress ID');return progress.dismiss(value.id);}
  if(action!=='update')throw Error('Unknown progress action');const desk=browser.mouseDesktops?.bank.active;if(!desk)throw Error('No active desktop');
  let tabId=value.tabId;if(tabId!==undefined&&tabId!==''){if(typeof tabId!=='string'||!browser.tabs.has(tabId)||browser.mouseDesktops?.bank.members[tabId]!==desk)throw Error('Progress tab is outside the active desktop');}else{const current=browser.mouseDesktops?.bank.current?.()?.layout;tabId=current?.slots?.[current?.active]||'';}
  return progress.report('shell:'+shell.id+':'+shellEpoch+':'+desk+':'+tabId,{...payload(value),desk,source:'shell',label:'Инструмент ИИ',...(tabId?{tabId}:{}),kind:'reported',estimated:true});
 });
 listen(shell,'did-start-navigation',(_event,_url,inPlace,mainFrame)=>{if(mainFrame&&!inPlace){for(const entry of [...progress.entries.values()])if(entry.owner.startsWith('shell:'+shell.id+':'+shellEpoch+':'))progress.removeOwner(entry.owner);shellEpoch++;}});
 const clear=()=>{owners.clear();automatic.clear();progress.clear();};
 const resume=()=>{if(disposed||locked||isPrivate()||browser.disposed)return;for(const page of browser.tabs.values())if(context(page))requestResync(page.view.webContents);};
 if(powerMonitor){listen(powerMonitor,'lock-screen',()=>{locked=true;clear();});listen(powerMonitor,'unlock-screen',()=>{locked=false;resume();});}
 function dispose(){if(disposed)return;disposed=true;clear();bindings.clear();for(const[target,event,handler]of listeners)target.removeListener(event,handler);listeners.clear();if(browser.make===make)browser.make=previousMake;if(browser.emit===emit)browser.emit=previousEmit;}
 return{clear,resume,dispose};
}
module.exports={install};
