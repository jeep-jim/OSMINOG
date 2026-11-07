'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {coalesce}=require('../osminog-io-budget.js');
const source=fs.readFileSync(path.join(__dirname,'../editor.js'),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const p={id:'desk',name:'Original desk',objects:[{id:'image',src:'data:image/png;base64,'+'A'.repeat(512*1024),x:10,y:20}],view:{x:1,y:2,scale:1}};
  const state={projects:[p],activeProject:p.id,view:{...p.view},theme:'dark',language:'ru',ui:{},dirty:false};
  const data={},writes=[],elements=new Map(),calls=[];let nextWriteGate,writeError;
  const context=vm.createContext({state,Date,Promise,console,setTimeout,clearTimeout,queueMicrotask,structuredClone,
    STORAGE_KEY:'briefCraftStudioV2',STORAGE_BACKUP_KEY:'briefCraftStudioV2Backup',STORAGE_REVISIONS_KEY:'osminogProjectRevisionsV1',trashIndex:{},
    project:()=>state.projects.find(p=>p.id===state.activeProject),
    clone:value=>{assert(!Array.isArray(value)&&!value?.objects,'whole media state must not pass through JSON clone');return structuredClone(value)},
    storageGet:async key=>({[key]:structuredClone(data[key])}),
    storageSet:async value=>{const frozen=structuredClone(value);writes.push(frozen);const gate=nextWriteGate;nextWriteGate=null;if(gate)await gate.promise;if(writeError)throw writeError;Object.assign(data,frozen)},
    OSMINOGIOBudget:{coalesce},OSMINOGItemEdits:{flush:async()=>{},batch:()=>[],compact:async()=>{}},
    syncFolder:async()=>({ok:true}),syncLiveWebSnapshots(){},showToast(){},
    $:selector=>{if(!elements.has(selector))elements.set(selector,{classList:{toggle(){},add(){},remove(){}},hidden:false});return elements.get(selector)},
    document:{getElementById:id=>{if(!elements.has('#'+id))elements.set('#'+id,{inert:false});return elements.get('#'+id)}},
    chrome:{runtime:{getManifest:()=>({version:'4.0.39'}),reload:()=>calls.push('reload')}},
    folderUpdater:()=>({version:'2.0.0',check:async()=>({available:true,latestVersion:'4.0.39.1',latest:{minUpdaterVersion:'2.0.0'}}),update:async()=>{calls.push('install');return{updated:true,currentVersion:'4.0.39.1'}}}),
    compareVersions:()=>0,OSMINOGUpdateHandoff:{prepare:async()=>calls.push('handoff')}
  });
  vm.runInContext(source.slice(source.indexOf('function historyCopy('),source.indexOf('function snapshotState(')),context);
  vm.runInContext(source.slice(source.indexOf('function persistPayload('),source.indexOf('function logChange(')),context);
  vm.runInContext(source.slice(source.indexOf('let updatePreflight='),source.indexOf('function toggleUpdatePopover(')),context);
  return{context,p,state,data,writes,calls,elements,holdNext(){return nextWriteGate=deferred()},failWrite(){writeError=Error('disk full')}};
}
test('Update on a clean workspace performs no full state, backup or revision write',async()=>{
  const f=fixture();await f.context.oneClickUpdate();
  assert.equal(f.writes.length,0);assert.deepEqual(f.calls,['install','handoff','reload']);
});
test('Update commits a dirty workspace once without generating full backup or revision copies',async()=>{
  const f=fixture();f.context.markDirty();await f.context.oneClickUpdate();
  assert.deepEqual(f.writes.map(v=>Object.keys(v)),[['briefCraftStudioV2']]);
  assert.equal(f.data.briefCraftStudioV2.projects[0].objects[0].src,f.p.objects[0].src);
  assert.deepEqual(f.calls,['install','handoff','reload']);assert.equal(f.state.dirty,false);
});
test('edits made while a save is in flight remain dirty; the backup contains the captured snapshot',async()=>{
  const f=fixture(),gate=f.holdNext();f.context.markDirty();const save=f.context.persist();await settle();
  f.p.objects[0].x=700;f.context.markDirty();gate.resolve();await save;
  assert.equal(f.state.dirty,true);
  assert.equal(f.data.briefCraftStudioV2.projects[0].objects[0].x,10);
  assert.equal(f.data.briefCraftStudioV2Backup.projects[0].objects[0].x,10);
  assert.equal(f.data.osminogProjectRevisionsV1.desk[0].project.objects[0].x,10);
  await f.context.saveBeforeReload();
  assert.equal(f.data.briefCraftStudioV2.projects[0].objects[0].x,700);assert.equal(f.state.dirty,false);
  assert.equal(f.writes.filter(v=>v.osminogProjectRevisionsV1).length,1);
});
test('Update waits for an existing save, then saves newer edits without launching a second archive pass',async()=>{
  const f=fixture(),gate=f.holdNext();f.context.markDirty();const save=f.context.persist();await settle();
  f.p.objects[0].y=900;f.context.markDirty();let done=false;
  const preparing=f.context.saveBeforeReload().then(()=>done=true);await settle();assert.equal(done,false);
  gate.resolve();await Promise.all([save,preparing]);
  assert.equal(f.data.briefCraftStudioV2.projects[0].objects[0].y,900);
  assert.equal(f.writes.filter(v=>v.briefCraftStudioV2Backup).length,1);
});
test('failed durable save prevents installation and reload and leaves workspace controls usable',async()=>{
  const f=fixture();f.context.markDirty();f.failWrite();await f.context.oneClickUpdate();
  assert.deepEqual(f.calls,[]);assert.equal(f.state.dirty,true);assert.equal(f.elements.get('#app').inert,false);
});
test('failed reload preparation never reloads and releases finalization controls',async()=>{
  const f=fixture();f.context.OSMINOGUpdateHandoff.prepare=async()=>{throw Error('guard unavailable')};await f.context.oneClickUpdate();
  assert.deepEqual(f.calls,['install']);assert.equal(f.elements.get('#app').inert,false);
});
test('pending per-item writes reach durable storage before the reload flush resolves',async()=>{
  const gate=deferred(),saved=[],p={id:'desk',objects:[]};
  const context=vm.createContext({crypto:webcrypto,state:{folderHandle:null,projects:[p]},Date,Promise,Map,Set,
    chrome:{storage:{local:{set:async data=>{await gate.promise;saved.push(data)}}}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../osminog-item-edits.js'),'utf8'),context);
  const api=context.OSMINOGItemEdits;const write=api.save(p,{kind:'objectPosition',objectId:'image',position:{x:10,y:20}});
  let flushed=false;const flush=api.flush().then(()=>flushed=true);await settle();assert.equal(flushed,false);
  gate.resolve();await Promise.all([write,flush]);assert.equal(saved.length,1);assert.equal(api.batch().length,1);
});
test('120 pan/zoom updates coalesce to one small view journal and replay after reload',async()=>{
  const saved={},writes=[],timers=new Set(),p={id:'desk',objects:[{id:'image',src:'data:image/png;base64,'+'A'.repeat(512*1024)}],view:{x:0,y:0,scale:1}};
  const chrome={storage:{local:{
    set:async value=>{writes.push(structuredClone(value));Object.assign(saved,structuredClone(value))},
    getKeys:async()=>Object.keys(saved),get:async keys=>Object.fromEntries(keys.filter(k=>Object.hasOwn(saved,k)).map(k=>[k,structuredClone(saved[k])]))
  }}};
  const make=project=>{
    const context=vm.createContext({crypto:webcrypto,state:{folderHandle:null,projects:[project]},Date,Promise,Map,Set,chrome,
      setTimeout:fn=>{timers.add(fn);return fn},clearTimeout:fn=>timers.delete(fn),queuePersist:()=>assert.fail('metadata save unexpectedly fell back to full persistence'),
      OSMINOGIOBudget:{selectedStorage:require('../osminog-io-budget.js').selectedStorage}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../osminog-item-edits.js'),'utf8'),context);return context.OSMINOGItemEdits;
  };
  const first=make(p);for(let i=0;i<120;i++)first.queueView(p,{x:i,y:i*2,scale:1.25});
  assert.equal(writes.length,0);await first.flush();assert.equal(writes.length,1);
  const [key,record]=Object.entries(writes[0])[0];assert(key.startsWith('osminogItemEdit:'));assert.equal(record.kind,'view');
  assert(JSON.stringify(record).length<350);assert.deepEqual(record.view,{x:119,y:238,scale:1.25});
  const reloaded={id:'desk',objects:p.objects,view:{x:0,y:0,scale:1}};await make(reloaded).restore(null);
  assert.deepEqual({...reloaded.view},{x:119,y:238,scale:1.25});assert.equal(timers.size,0);
});
