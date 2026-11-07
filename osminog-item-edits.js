// Small, replayable writes for captures, positions and project navigation. Full saves fold
// the records into the normal project snapshot and its portable disk copy.
(()=>{
 const prefix='osminogItemEdit:', pending=new Map(), writing=new Set(), views=new Map();let order=0,viewTimer,navigationOrder=0;
 const navigationRank=value=>Number.isSafeInteger(value)&&value>0?value:0;
 function savedNavigationOrder(){return navigationRank(state.ui?.savedNavigationOrder)}
 function validNavigation(e){return e.kind==='navigation'&&typeof e.activeProject==='string'&&e.activeProject===e.projectId&&navigationRank(e.navigationOrder)>0}
 function remember(p,token){
  (p.savedItemEdits??={})[token]=true;
  pending.set(token,p);
 }
 async function directory(root,create){
  const meta=await root.getDirectoryHandle('.osminog',{create});
  return meta.getDirectoryHandle('item-edits',{create});
 }
 function apply(p,e,navigationFloor=0){
  // Project files can be newer than the global active-project snapshot. Their
  // per-project tokens cannot prove that global navigation was already folded.
  if(e.kind==='navigation'){
   if(validNavigation(e)&&e.navigationOrder>navigationFloor){
    state.activeProject=p.id;(state.ui??={}).savedNavigationOrder=e.navigationOrder;
   }
   remember(p,e.token);return;
  }
  if(globalThis.OSMINOGRestore438?.shouldApplyLegacyEdit(p,e)===false){remember(p,e.token);return}
  if(!p.savedItemEdits?.[e.token]){
   if(e.kind==='capture'){
    if(!p.objects.some(o=>o.id===e.object.id)){
     const o=e.object;p.objects.push(o);
     const f=p.osminogFolders?.find(f=>f.id===o.osminogFolderId);
     if(f&&!(f.members||=[]).includes(o.id))f.members.push(o.id);
    }
   }else if(e.kind==='view'){
    if(e.view&&['x','y','scale'].every(k=>Number.isFinite(e.view[k]))&&e.view.scale>0)p.view={...e.view};
   }else if(e.kind==='objectPosition'){
    const o=p.objects.find(item=>item.id===e.objectId);if(o)Object.assign(o,e.position);
   }else{
    const f=p.osminogFolders?.find(f=>f.id===e.folderId);
    if(f)Object.assign(f,e.position);
   }
  }
  remember(p,e.token);
 }
 async function saveRecord(p,patch){
  const token=patch.kind==='capture'?'capture-'+patch.object.captureId:crypto.randomUUID();
  const e={token,projectId:p.id,at:Date.now(),order:++order,...(p.osminogRestore438?.runId?{restoredRunId:p.osminogRestore438.runId}:{}),...patch};
  const root=state.folderHandle;
  await chrome.storage.local.set({[prefix+token]:e});
  if(root){
   const dir=await directory(root,true);
   await writeHandleText(dir,token+'.json',JSON.stringify(e));
  }
  remember(p,token);
 }
 function save(p,patch){
  const task=saveRecord(p,patch);writing.add(task);
  const finished=()=>writing.delete(task);task.then(finished,finished);
  return task;
 }
 function saveNavigation(projectId){
  const p=state.projects.find(project=>project.id===projectId);
  if(!p)return Promise.reject(new Error('Project navigation target is unavailable'));
  navigationOrder=Math.max(navigationOrder,savedNavigationOrder())+1;
  // Pair intent with its global snapshot before any await. An immediate save
  // of a subsequently created desk must not replay this older selection later.
  state.activeProject=projectId;(state.ui??={}).savedNavigationOrder=navigationOrder;
  return save(p,{kind:'navigation',activeProject:projectId,navigationOrder});
 }
 function queueView(p,view){
  if(!p)return;
  p.view={x:view.x,y:view.y,scale:view.scale};p.updated=Date.now();
  views.set(p.id,{project:p,view:{...p.view}});
  clearTimeout(viewTimer);viewTimer=setTimeout(()=>flushViews().catch(()=>queuePersist()),300);
 }
 async function flushViews(){
  clearTimeout(viewTimer);
  const batch=[...views.values()];views.clear();
  await Promise.all(batch.map(async entry=>{
   try{await save(entry.project,{kind:'view',view:entry.view})}
   catch(error){if(!views.has(entry.project.id))views.set(entry.project.id,entry);throw error}
  }));
 }
 async function flush(){
  do{if(views.size)await flushViews();if(writing.size)await Promise.all([...writing])}while(views.size||writing.size);
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
  // Capture the folded snapshot watermark before replay. Pending records must
  // not raise it until applied, including records written during a full save.
  const navigationFloor=savedNavigationOrder(),navigation=[];
  for(const e of records.values())if(validNavigation(e)){
   navigationOrder=Math.max(navigationOrder,e.navigationOrder);
   navigation.push(e);
  }
  navigationOrder=Math.max(navigationOrder,navigationFloor);
  for(const e of [...records.values()].filter(e=>e.kind!=='navigation').sort((a,b)=>a.at-b.at||(a.order||0)-(b.order||0))){
   const p=state.projects.find(project=>project.id===e.projectId);if(p)apply(p,e);
  }
  for(const e of navigation.sort((a,b)=>a.navigationOrder-b.navigationOrder)){
   const p=state.projects.find(project=>project.id===e.projectId);if(p)apply(p,e,navigationFloor);
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
 globalThis.OSMINOGItemEdits={save,saveNavigation,restore,batch,compact,flush,queueView};
 if(typeof document!=='undefined'){
  const finish=()=>{if(views.size)flush().catch(()=>{})};
  globalThis.addEventListener?.('pagehide',finish);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')finish()});
 }
})();
