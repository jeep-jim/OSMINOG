'use strict';
// Presentation-only page API. Identity comes from the IPC sender, never payload.
function install({win,browser,ipcMain,trusted,progress,isPrivate=()=>false,powerMonitor}){
 const shell=win.webContents,owners=new Map(),listeners=new Set();let disposed=false,locked=false,shellEpoch=0;
 const listen=(target,event,handler)=>{const entry=[target,event,handler];target.on(event,handler);listeners.add(entry);return()=>{target.removeListener(event,handler);listeners.delete(entry);};};
 function context(page){const bank=browser.mouseDesktops?.bank,desk=bank&&Object.hasOwn(bank.members,page.id)?bank.members[page.id]:'';if(!desk)return null;const wc=page.view.webContents;if(wc.isDestroyed())return null;let hostname;try{const u=new URL(wc.getURL());if(!['http:','https:'].includes(u.protocol))return null;hostname=u.hostname;}catch{return null;}return{desk,source:'page',label:hostname.slice(0,64),tabId:page.id,epoch:page.navigationEpoch||0};}
 function clearPage(wc){const entry=owners.get(wc.id);if(entry){progress.removeOwner(entry.owner);owners.delete(wc.id);}}
 function reconcile(){for(const[id,entry]of owners){const page=browser.tabs.get(entry.tabId),next=page&&context(page);if(!next||next.desk!==entry.desk||next.epoch!==entry.epoch){progress.removeOwner(entry.owner);owners.delete(id);}}}
 function bind(page){const wc=page.view.webContents;const offNavigation=listen(wc,'did-start-navigation',(_event,_url,_inPlace,mainFrame)=>{if(mainFrame)clearPage(wc);});const offDestroyed=listen(wc,'destroyed',()=>{clearPage(wc);offNavigation();offDestroyed();});}
 for(const page of browser.tabs.values())bind(page);
 const previousMake=browser.make;const make=function(...args){const page=previousMake.apply(this,args);bind(page);return page;};browser.make=make;
 const previousEmit=browser.emit;const emit=function(...args){if(!disposed)reconcile();return previousEmit.apply(this,args);};browser.emit=emit;
 function available(){if(disposed||locked||isPrivate())throw Error('Прогресс недоступен в этом режиме');}
 function payload(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid progress update');const {percent,statusText,taskId}=value;if(percent!==null&&(typeof percent!=='number'||!Number.isFinite(percent)||percent<0||percent>100))throw Error('Progress must be null or 0–100');if(typeof statusText!=='string'||statusText.length>240)throw Error('Progress status must be at most 240 characters');if(taskId!==undefined&&(typeof taskId!=='string'||!/^[a-zA-Z0-9_.:-]{1,64}$/.test(taskId)))throw Error('Invalid progress task ID');return{percent,statusText,...(taskId?{taskId}:{})};}
 ipcMain.handle('mouse:page-progress',(event,value)=>{
  available();const wc=event.sender;if(!wc||wc.isDestroyed()||event.senderFrame!==wc.mainFrame)throw Error('Progress requires the owning main frame');
  const page=[...browser.tabs.values()].find(t=>t.view.webContents===wc),ctx=page&&context(page);if(!ctx)throw Error('Page does not own a workspace tab');reconcile();
  let entry=owners.get(wc.id);if(!entry){entry={...ctx,owner:'page:'+wc.id+':'+ctx.desk+':'+ctx.epoch,tabId:page.id};owners.set(wc.id,entry);}
  return progress.update(entry.owner,{...payload(value),desk:ctx.desk,source:ctx.source,label:ctx.label,tabId:page.id,estimated:true});
 });
 ipcMain.handle('mouse:progress',(event,action,value={})=>{
  trusted(event);if(action==='state')return isPrivate()||locked?{tasks:[],revision:0}:progress.snapshot();available();
  if(action==='dismiss'){if(typeof value.id!=='string'||value.id.length>200)throw Error('Invalid progress ID');return progress.dismiss(value.id);}
  if(action!=='update')throw Error('Unknown progress action');const desk=browser.mouseDesktops?.bank.active;if(!desk)throw Error('No active desktop');
  return progress.update('shell:'+shell.id+':'+shellEpoch+':'+desk,{...payload(value),desk,source:'shell',label:'Инструмент ИИ',estimated:true});
 });
 listen(shell,'did-start-navigation',(_event,_url,inPlace,mainFrame)=>{if(mainFrame&&!inPlace){for(const desk of browser.mouseDesktops?.bank.items||[])progress.removeOwner('shell:'+shell.id+':'+shellEpoch+':'+desk.id);shellEpoch++;}});
 const clear=()=>{owners.clear();progress.clear();};
 if(powerMonitor){listen(powerMonitor,'lock-screen',()=>{locked=true;clear();});listen(powerMonitor,'unlock-screen',()=>{locked=false;});}
 function dispose(){if(disposed)return;disposed=true;clear();for(const[target,event,handler]of listeners)target.removeListener(event,handler);listeners.clear();if(browser.make===make)browser.make=previousMake;if(browser.emit===emit)browser.emit=previousEmit;}
 return{clear,dispose};
}
module.exports={install};
