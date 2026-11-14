'use strict';
// No filesystem imports. Private application state never reaches the profile Store.
class MemoryStore {
 constructor(seed={}){this.data=structuredClone(seed);this.queue=Promise.resolve();this.destroyed=false;}
 async get(keys){if(this.destroyed)return {};const list=Array.isArray(keys)?keys:[keys];return structuredClone(Object.fromEntries(list.filter(k=>Object.hasOwn(this.data,k)).map(k=>[k,this.data[k]])));}
 async set(value){if(!this.destroyed)Object.assign(this.data,structuredClone(value));return true;}
 destroy(){this.destroyed=true;this.data={};}
}
// All privileged handlers still run their original trusted-frame checks. Only the
// known shell can switch contexts; guest pages never acquire a private host API.
function installIPCSwitch(ipcMain,getShell){
 const original=ipcMain.handle.bind(ipcMain),normal=new Map();let active=null;
 ipcMain.handle=(channel,handler)=>{normal.set(channel,handler);return original(channel,(event,...args)=>{
  if(active&&event.sender===getShell()){
   const selected=active.get(channel);if(!selected)throw Error('Эта функция недоступна в инкогнито');return selected(event,...args);
  }
  return handler(event,...args);
 });};
 return{normal,use:handlers=>{active=handlers;},current:()=>active};
}
async function clearPrivateSession(ses){
 // Call after destroying all private page renderers, including service workers.
 const methods=['clearStorageData','clearCache','clearAuthCache','clearHostResolverCache','closeAllConnections'];
 const result=await Promise.allSettled(methods.map(name=>Promise.resolve().then(()=>ses[name]())));
 if(result.some(r=>r.status==='rejected'))throw Error('Не удалось полностью очистить приватную сессию. Завершите браузер через ⌘Q.');
}
module.exports={MemoryStore,installIPCSwitch,clearPrivateSession};
