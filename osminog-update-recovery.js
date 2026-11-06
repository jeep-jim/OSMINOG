/* A pending update is consumed only after the new editor acknowledges startup. */
(()=>{'use strict';
 const KEY='briefCraftReopenAfterUpdateV1',url=chrome.runtime.getURL('editor.html');
 const isEditor=value=>typeof value==='string'&&(value===url||value.startsWith(url+'?')||value.startsWith(url+'#'));
 let timer=null,running=null,target=null,attempts=0;
 const schedule=(delay=350)=>{clearTimeout(timer);timer=setTimeout(()=>restore().catch(error=>console.warn('OSMINOG update recovery:',error.message)),delay)};
 async function pending(){const req=(await chrome.storage.local.get(KEY))[KEY];if(!req)return null;const age=Date.now()-Number(req.at);if(!Number.isFinite(age)||age< -60000||age>600000){await chrome.storage.local.remove(KEY);return null}return req}
 function restore(){if(running)return running;running=(async()=>{
  if(!await pending()){clearTimeout(timer);target=null;return}
  if(attempts++>=6)return;
  try{
   const tabs=(await chrome.tabs.query({})).filter(t=>isEditor(t.url));
   const existing=tabs.find(t=>t.id===target)||tabs[0];
   if(existing){
    if(target!==existing.id){const tab=await chrome.tabs.update(existing.id,{url,active:true});target=tab.id}
   }else{const tab=await chrome.tabs.create({url,active:true});target=tab.id}
  }catch(error){target=null;console.warn('OSMINOG editor reopen will retry:',error.message)}
  // The old tab can still exist while Chrome is unloading the old extension.
  // Recheck instead of deleting the marker after focusing that doomed tab.
  schedule(1500);
 })().finally(()=>running=null);return running}
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='OSMINOG_EDITOR_READY'||sender.id!==chrome.runtime.id||!isEditor(sender.url)||message.version!==chrome.runtime.getManifest().version)return;
  (async()=>{if(await pending()){await chrome.storage.local.remove(KEY);clearTimeout(timer);target=null;attempts=0}return{ok:true}})().then(reply,error=>reply({ok:false,error:error.message}));return true;
 });
 chrome.runtime.onInstalled.addListener(()=>{attempts=0;schedule()});
 chrome.runtime.onStartup.addListener(()=>{attempts=0;schedule()});
 chrome.tabs.onRemoved?.addListener(id=>{if(id===target){target=null;schedule(350)}});
 schedule();
})();
