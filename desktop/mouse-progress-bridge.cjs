'use strict';
// Presentation-only page metadata. Identity is authenticated by the IPC sender.
function install({win,browser,ipcMain,trusted,progress,isPrivate=()=>false,powerMonitor}){
 const shell=win.webContents,owners=new Map(),automatic=new Map(),listeners=new Set();let disposed=false,locked=false,shellEpoch=0;
 const listen=(target,event,handler)=>{const entry=[target,event,handler];target.on(event,handler);listeners.add(entry);return()=>{target.removeListener(event,handler);listeners.delete(entry);};};
 function context(page,url){const bank=browser.mouseDesktops?.bank,desk=bank&&Object.hasOwn(bank.members,page.id)?bank.members[page.id]:'';if(!desk)return null;const wc=page.view.webContents;if(wc.isDestroyed())return null;let hostname;try{const u=new URL(url||wc.getURL());if(!['http:','https:'].includes(u.protocol))return null;hostname=u.hostname;}catch{return null;}return{desk,source:'page',label:hostname.slice(0,64),tabId:page.id,epoch:page.navigationEpoch||0};}
 function removeAutomatic(key){const entry=automatic.get(key);if(entry){clearTimeout(entry.timer);progress.removeOwner(entry.owner);automatic.delete(key);}}
 function clearPage(wc){const entry=owners.get(wc.id);if(entry){progress.removeOwner(entry.owner);owners.delete(wc.id);}for(const [key,value]of automatic)if(value.wc===wc)removeAutomatic(key);}
 function reconcile(){
  for(const [id,entry]of owners){const page=browser.tabs.get(entry.tabId),next=page&&context(page);if(!next||next.desk!==entry.desk||next.epoch!==entry.epoch){progress.removeOwner(entry.owner);owners.delete(id);}}
  for(const [key,entry]of automatic){const page=browser.tabs.get(entry.tabId),next=page&&context(page);if(!next||next.desk!==entry.desk||next.epoch!==entry.epoch)removeAutomatic(key);}
 }
 function available(){if(disposed||locked||isPrivate())throw Error('Прогресс недоступен в этом режиме');}
 function autoUpdate(entry,values){try{available();return progress.update(entry.owner,{...values,desk:entry.desk,source:'page',label:entry.label,tabId:entry.tabId,kind:entry.kind,estimated:entry.kind==='observed'});}catch(error){if(error.code==='MOUSE_PROGRESS_LIMIT'||disposed||locked||isPrivate())return null;throw error;}}
 function navigation(page,url){
  if(disposed||locked||isPrivate())return;const wc=page.view.webContents,ctx=context(page,url);if(!ctx)return;const key=wc.id+':navigation';removeAutomatic(key);
  const entry={...ctx,wc,kind:'navigation',owner:'load:'+wc.id+':'+ctx.desk+':'+ctx.epoch,shown:false,timer:null};automatic.set(key,entry);
  // Fast loads need no flashing footer. The delay never manufactures a percent.
  entry.timer=setTimeout(()=>{entry.timer=null;if(automatic.get(key)!==entry||disposed||locked||isPrivate()||wc.isDestroyed()||browser.tabs.get(page.id)!==page||browser.mouseDesktops?.bank.members[page.id]!==entry.desk)return;entry.shown=!!autoUpdate(entry,{taskId:'$navigation',percent:null,statusText:'Загрузка страницы'});},250);entry.timer.unref?.();
 }
 function navigationEnd(page,phase,statusText){const key=page.view.webContents.id+':navigation',entry=automatic.get(key);if(!entry)return;clearTimeout(entry.timer);entry.timer=null;if(entry.shown)progress.finish(entry.owner,'$navigation',{phase,statusText,estimated:false});else removeAutomatic(key);}
 function bind(page){
  const wc=page.view.webContents,off=[];
  off.push(listen(wc,'did-start-navigation',(_event,url,inPlace,mainFrame)=>{if(mainFrame){clearPage(wc);if(!inPlace)navigation(page,url);}}));
  off.push(listen(wc,'did-finish-load',()=>navigationEnd(page,'completed','Страница загружена')));
  off.push(listen(wc,'did-fail-load',(_event,code,_description,_url,mainFrame)=>{if(mainFrame!==false)navigationEnd(page,code===-3?'stopped':'error',code===-3?'Загрузка отменена':'Страница не загрузилась');}));
  off.push(listen(wc,'did-stop-loading',()=>navigationEnd(page,'stopped','Загрузка прекращена')));
  off.push(listen(wc,'destroyed',()=>{clearPage(wc);for(const remove of off)remove();}));
  if(wc.isLoadingMainFrame?.())navigation(page,wc.getURL()||page.url);
 }
 for(const page of browser.tabs.values())bind(page);
 const previousMake=browser.make;const make=function(...args){const page=previousMake.apply(this,args);bind(page);return page;};browser.make=make;
 const previousEmit=browser.emit;const emit=function(...args){if(!disposed)reconcile();return previousEmit.apply(this,args);};browser.emit=emit;
 function payload(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid progress update');const {percent,statusText,taskId}=value;if(percent!==null&&(typeof percent!=='number'||!Number.isFinite(percent)||percent<0||percent>100))throw Error('Progress must be null or 0–100');if(typeof statusText!=='string'||statusText.length>240)throw Error('Progress status must be at most 240 characters');if(taskId!==undefined&&(typeof taskId!=='string'||!/^[a-zA-Z0-9_.:-]{1,64}$/.test(taskId)))throw Error('Invalid progress task ID');return{percent,statusText,...(taskId?{taskId}:{})};}
 function pageForEvent(event){const wc=event.sender;if(!wc||wc.isDestroyed()||event.senderFrame!==wc.mainFrame)throw Error('Progress requires the owning main frame');const page=[...browser.tabs.values()].find(t=>t.view.webContents===wc),ctx=page&&context(page);if(!ctx)throw Error('Page does not own a workspace tab');return{wc,page,ctx};}
 ipcMain.handle('mouse:page-progress',(event,value)=>{
  available();const {wc,page,ctx}=pageForEvent(event);reconcile();let entry=owners.get(wc.id);if(!entry){entry={...ctx,owner:'page:'+wc.id+':'+ctx.desk+':'+ctx.epoch,tabId:page.id};owners.set(wc.id,entry);}
  return progress.update(entry.owner,{...payload(value),desk:ctx.desk,source:ctx.source,label:ctx.label,tabId:page.id,kind:'reported',estimated:true});
 });
 // This signal is produced by the sandboxed preload. DOM declarations remain
 // untrusted presentation: they do not grant access or prove task success.
 const activity=(event,value)=>{
  try{
   available();const {wc,page,ctx}=pageForEvent(event);if(!value||typeof value!=='object'||Array.isArray(value)||value.kind!=='dom'||typeof value.active!=='boolean')return;
   const key=wc.id+':observed';reconcile();let entry=automatic.get(key);
   if(!value.active){if(entry&&!entry.completed)removeAutomatic(key);return;}
   const clean=payload({percent:value.percent,statusText:value.statusText});
   if(!entry){entry={...ctx,wc,kind:'observed',owner:'observed:'+wc.id+':'+ctx.desk+':'+ctx.epoch,completed:false};automatic.set(key,entry);}
   entry.completed=clean.percent===100;autoUpdate(entry,{...clean,taskId:'$dom'});
  }catch{/* A page's invalid/late observation must not interrupt browsing. */}
 };
 if(ipcMain.on)listen(ipcMain,'mouse:page-activity',activity);
 ipcMain.handle('mouse:progress',(event,action,value={})=>{
  trusted(event);if(action==='state')return isPrivate()||locked?{tasks:[],revision:0}:progress.snapshot();available();
  if(action==='dismiss'){if(typeof value.id!=='string'||value.id.length>200)throw Error('Invalid progress ID');return progress.dismiss(value.id);}
  if(action!=='update')throw Error('Unknown progress action');const desk=browser.mouseDesktops?.bank.active;if(!desk)throw Error('No active desktop');
  let tabId=value.tabId;if(tabId!==undefined&&tabId!==''){if(typeof tabId!=='string'||!browser.tabs.has(tabId)||browser.mouseDesktops?.bank.members[tabId]!==desk)throw Error('Progress tab is outside the active desktop');}else{const current=browser.mouseDesktops?.bank.current?.()?.layout;tabId=current?.slots?.[current?.active]||'';}
  return progress.update('shell:'+shell.id+':'+shellEpoch+':'+desk+':'+tabId,{...payload(value),desk,source:'shell',label:'Инструмент ИИ',...(tabId?{tabId}:{}),kind:'reported',estimated:true});
 });
 listen(shell,'did-start-navigation',(_event,_url,inPlace,mainFrame)=>{if(mainFrame&&!inPlace){for(const entry of [...progress.entries.values()])if(entry.owner.startsWith('shell:'+shell.id+':'+shellEpoch+':'))progress.removeOwner(entry.owner);shellEpoch++;}});
 const clear=()=>{owners.clear();for(const entry of automatic.values())clearTimeout(entry.timer);automatic.clear();progress.clear();};
 const resume=()=>{if(disposed||locked||isPrivate()||browser.disposed)return;for(const page of browser.tabs.values())try{if(context(page))page.view.webContents.send?.('mouse:page-activity-resync');}catch{/* A closing page cannot block a privacy transition. */}};
 if(powerMonitor){listen(powerMonitor,'lock-screen',()=>{locked=true;clear();});listen(powerMonitor,'unlock-screen',()=>{locked=false;resume();});}
 function dispose(){if(disposed)return;disposed=true;clear();for(const[target,event,handler]of listeners)target.removeListener(event,handler);listeners.clear();if(browser.make===make)browser.make=previousMake;if(browser.emit===emit)browser.emit=previousEmit;}
 return{clear,resume,dispose};
}
module.exports={install};
