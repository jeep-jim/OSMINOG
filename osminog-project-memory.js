"use strict";
// Only project-owned memory belongs in portable backups. Credentials never do.
(()=>{
  const clearPrefix="briefCraftGptChatCleared:";
  const prefixes=["briefCraftGptLiteChat:","briefCraftGptPinnedContext:","briefCraftGptThreads:","briefCraftGptStyle:",clearPrefix];
  const clearedAt=value=>Math.max(0,Number(value?.at??value)||0);
  function clearKey(key,ids){
    const id=ids.find(id=>key===prefixes[0]+id||key.startsWith(prefixes[0]+id+":"));
    return id===undefined?null:clearPrefix+id+":"+(key.slice((prefixes[0]+id+":").length)||"main");
  }
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
    const incoming=select(remote,ids),owned=select(local,ids);
    for(const key of new Set([...Object.keys(owned),...Object.keys(incoming)])){
      const value=incoming[key];
      if(key.startsWith(clearPrefix)){result[key]={at:Math.max(clearedAt(local[key]),clearedAt(value))};continue}
      if(key.startsWith(prefixes[0])){
        const marker=clearKey(key,ids),cutoff=Math.max(clearedAt(local[marker]),clearedAt(incoming[marker]));
        result[key]=mergeMessages(Array.isArray(local[key])?local[key]:[],Array.isArray(value)?value:[]).filter(m=>!cutoff||Number(m.at)>cutoff);
      }
      else if(key.startsWith(prefixes[2])&&Array.isArray(value?.items)&&Array.isArray(local[key]?.items)){
        const items=new Map(value.items.map(item=>[item.id,item]));for(const item of local[key].items)items.set(item.id,item);
        result[key]={...value,...local[key],items:[...items.values()]};
      }else if(local[key]===undefined&&value!==undefined)result[key]=value;
    }
    return result;
  }
  const api={owns,select,merge,mergeMessages};
  globalThis.OSMINOGProjectMemory=api;
  if(typeof module!=="undefined")module.exports=api;
})();
