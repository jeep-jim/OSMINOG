"use strict";
// Only project-owned memory belongs in portable backups. Credentials never do.
(()=>{
  const prefixes=["briefCraftGptLiteChat:","briefCraftGptPinnedContext:","briefCraftGptThreads:","briefCraftGptStyle:"];
  function owns(key,id){return prefixes.some(prefix=>key===prefix+id||key.startsWith(prefix+id+":"))}
  function select(storage,ids){return Object.fromEntries(Object.entries(storage).filter(([key])=>ids.some(id=>owns(key,id))))}
  function mergeMessages(local,remote){
    const seen=new Set(),out=[];
    for(const message of [...local,...remote]){
      const key=message.id||JSON.stringify([message.role,message.at,message.text,message.attachments]);
      if(!seen.has(key)){seen.add(key);out.push(message)}
    }
    return out.sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0));
  }
  function merge(local,remote,ids){
    const result={};
    for(const [key,value] of Object.entries(select(remote,ids))){
      if(Array.isArray(local[key])&&Array.isArray(value)&&key.startsWith(prefixes[0]))result[key]=mergeMessages(local[key],value);
      else if(key.startsWith(prefixes[2])&&Array.isArray(value?.items)&&Array.isArray(local[key]?.items)){
        const items=new Map(value.items.map(item=>[item.id,item]));for(const item of local[key].items)items.set(item.id,item);
        result[key]={...value,...local[key],items:[...items.values()]};
      }else if(local[key]===undefined)result[key]=value;
    }
    return result;
  }
  const api={owns,select,merge,mergeMessages};
  globalThis.OSMINOGProjectMemory=api;
  if(typeof module!=="undefined")module.exports=api;
})();
