// Small, replayable writes for captures and folder positions. Full saves fold
// the records into the normal project snapshot and its portable disk copy.
(()=>{
 const prefix='osminogItemEdit:', pending=new Map();let order=0;
 function remember(p,token){
  (p.savedItemEdits??={})[token]=true;
  pending.set(token,p);
 }
 async function directory(root,create){
  const meta=await root.getDirectoryHandle('.osminog',{create});
  return meta.getDirectoryHandle('item-edits',{create});
 }
 function apply(p,e){
  if(!p.savedItemEdits?.[e.token]){
   if(e.kind==='capture'){
    if(!p.objects.some(o=>o.id===e.object.id)){
     const o=e.object;p.objects.push(o);
     const f=p.osminogFolders?.find(f=>f.id===o.osminogFolderId);
     if(f&&!(f.members||=[]).includes(o.id))f.members.push(o.id);
    }
   }else if(e.kind==='objectPosition'){
    const o=p.objects.find(item=>item.id===e.objectId);if(o)Object.assign(o,e.position);
   }else{
    const f=p.osminogFolders?.find(f=>f.id===e.folderId);
    if(f)Object.assign(f,e.position);
   }
  }
  remember(p,e.token);
 }
 async function save(p,patch){
  const token=patch.kind==='capture'?'capture-'+patch.object.captureId:crypto.randomUUID();
  const e={token,projectId:p.id,at:Date.now(),order:++order,...patch};
  const root=state.folderHandle;
  await chrome.storage.local.set({[prefix+token]:e});
  if(root){
   const dir=await directory(root,true);
   await writeHandleText(dir,token+'.json',JSON.stringify(e));
  }
  remember(p,token);
 }
 async function restore(root){
  const local=await OSMINOGIOBudget.selectedStorage(chrome.storage.local,k=>k.startsWith(prefix));
  const records=new Map(Object.values(local).map(e=>[e.token,e]));
  if(root){try{
   const dir=await directory(root,false);
   for await(const [name,entry] of dir.entries()){
    if(entry.kind!=='file'||!name.endsWith('.json'))continue;
    const token=name.slice(0,-5);if(records.has(token))continue;
    const e=JSON.parse(await(await entry.getFile()).text());
    if(e.token===token)records.set(token,e);
   }
  }catch(e){if(e.name!=='NotFoundError')throw e}}
  for(const e of [...records.values()].sort((a,b)=>a.at-b.at||(a.order||0)-(b.order||0))){
   const p=state.projects.find(project=>project.id===e.projectId);if(p)apply(p,e);
  }
 }
 function batch(){return [...pending].filter(([token,p])=>state.projects.includes(p)&&p.savedItemEdits?.[token])}
 async function compact(entries,root){
  if(!entries.length)return;
  if(root){
   const dir=await directory(root,true);
   for(const [token] of entries){try{await dir.removeEntry(token+'.json')}catch(e){if(e.name!=='NotFoundError')throw e}}
  }
  await chrome.storage.local.remove(entries.map(([token])=>prefix+token));
  for(const [token,p] of entries){pending.delete(token);delete p.savedItemEdits[token]}
 }
 globalThis.OSMINOGItemEdits={save,restore,batch,compact};
})();
