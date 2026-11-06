/* Bounded I/O: one running job and one coalesced batch, never queued snapshots. */
(function(root){'use strict';
 function coalesce(work){
  let running=false,waiting=[],latest;
  async function drain(){
   while(waiting.length){
    const batch=waiting;waiting=[];const request=latest;
    try{const value=await work.apply(request.self,request.args);for(const item of batch)item.resolve(value)}
    catch(error){for(const item of batch)item.reject(error)}
   }
   running=false;
  }
  return function(...args){latest={self:this,args};const result=new Promise((resolve,reject)=>waiting.push({resolve,reject}));if(!running){running=true;queueMicrotask(drain)}return result};
 }
 async function selectedStorage(storage,predicate){
  if(typeof storage.getKeys==='function'){
   const keys=(await storage.getKeys()).filter(predicate);
   return keys.length?storage.get(keys):{};
  }
  const values=await storage.get(null);
  return Object.fromEntries(Object.entries(values).filter(([key])=>predicate(key)));
 }
 const api={coalesce,selectedStorage};root.OSMINOGIOBudget=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof document!=='undefined'){
  const ready=async()=>{try{await root.OSMINOGStateReady;await root.chrome?.runtime?.sendMessage?.({type:'OSMINOG_EDITOR_READY',version:root.chrome.runtime.getManifest().version})}catch{}};
  if(document.readyState==='complete')ready();else root.addEventListener('load',ready,{once:true});
 }
})(globalThis);
