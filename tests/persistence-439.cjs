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

function navigationFixture(snapshot,saved={},clock={now:1000}){
  const state=structuredClone(snapshot),writes=[];
  const local={
    set:async value=>{writes.push(structuredClone(value));Object.assign(saved,structuredClone(value))},
    getKeys:async()=>Object.keys(saved),
    get:async keys=>Object.fromEntries(keys.filter(k=>Object.hasOwn(saved,k)).map(k=>[k,structuredClone(saved[k])])),
    remove:async keys=>{for(const key of keys)delete saved[key]}
  };
  const context=vm.createContext({state,crypto:webcrypto,Date:{now:()=>clock.now},Promise,Map,Set,
    chrome:{storage:{local}},OSMINOGIOBudget:{selectedStorage:require('../osminog-io-budget.js').selectedStorage}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../osminog-item-edits.js'),'utf8'),context);
  return{state,saved,writes,local,context,api:context.OSMINOGItemEdits};
}
const navigationSnapshot=()=>({activeProject:'a',ui:{},projects:['a','b','c'].map(id=>({id,objects:[],view:{x:0,y:0,scale:1}}))});
const navRecord=(token,projectId,navigationOrder,at=1000)=>({token,kind:'navigation',projectId,activeProject:projectId,navigationOrder,at,order:navigationOrder});

test('project navigation writes only small IDs and ordering metadata, with no object or media payload',async()=>{
  const snapshot=navigationSnapshot();snapshot.projects[1].objects=[{id:'large-image',src:'data:image/png;base64,'+'A'.repeat(512*1024)}];
  snapshot.projects[1].osminogRestore438={runId:'restored'};
  const f=navigationFixture(snapshot);await f.api.saveNavigation('b');await f.api.flush();
  assert.equal(f.writes.length,1);const [key,record]=Object.entries(f.writes[0])[0];
  assert(key.startsWith('osminogItemEdit:'));assert.equal(record.kind,'navigation');assert.equal(record.projectId,'b');
  assert.equal(record.activeProject,'b');assert.equal(record.navigationOrder,1);assert.equal(record.restoredRunId,'restored');
  assert(JSON.stringify(record).length<350);assert(!Object.hasOwn(record,'object'));assert(!Object.hasOwn(record,'view'));
  assert.equal(f.state.activeProject,'b');assert.equal(f.state.ui.savedNavigationOrder,1);
  assert.equal(f.api.batch().length,1);assert.equal(f.state.projects[1].objects[0].src,snapshot.projects[1].objects[0].src);
});

test('latest navigation replays across restarts and a wall-clock rollback',async()=>{
  const snapshot=navigationSnapshot(),clock={now:2000},first=navigationFixture(snapshot,{},clock);
  await first.api.saveNavigation('b');clock.now=100;await first.api.saveNavigation('c');
  const second=navigationFixture(snapshot,first.saved,clock);await second.api.restore(null);assert.equal(second.state.activeProject,'c');
  clock.now=1;await second.api.saveNavigation('a');
  assert.deepEqual(Object.values(first.saved).map(e=>e.navigationOrder),[1,2,3]);
  const third=navigationFixture(snapshot,first.saved,clock);await third.api.restore(null);assert.equal(third.state.activeProject,'a');
  assert.equal(third.state.ui.savedNavigationOrder,3);
});

test('navigation rejects missing targets and ignores invalid or removed replay targets',async()=>{
  const f=navigationFixture(navigationSnapshot());await assert.rejects(f.api.saveNavigation('missing'),/unavailable/);assert.equal(f.writes.length,0);
  f.saved['osminogItemEdit:removed']=navRecord('removed','missing',50);
  f.saved['osminogItemEdit:mismatch']={...navRecord('mismatch','b',51),activeProject:'missing'};
  await f.api.restore(null);assert.equal(f.state.activeProject,'a');
  assert.equal(f.state.ui.savedNavigationOrder,undefined);assert.equal(f.api.batch().length,0);
});

test('folded navigation never overrides the snapshot; only newer pending navigation advances its watermark',async()=>{
  const snapshot=navigationSnapshot();snapshot.activeProject='c';
  snapshot.projects[0].savedItemEdits={folded:true};snapshot.ui.savedNavigationOrder=20;
  const saved={'osminogItemEdit:folded':navRecord('folded','a',20),'osminogItemEdit:older':navRecord('older','b',19)};
  const f=navigationFixture(snapshot,saved);await f.api.restore(null);assert.equal(f.state.activeProject,'c');
  assert.equal(f.state.ui.savedNavigationOrder,20,'ignored older navigation cannot advance the snapshot watermark');
  saved['osminogItemEdit:newer']=navRecord('newer','b',21,1);
  snapshot.projects[1].savedItemEdits={newer:true};snapshot.projects[1].savedNavigationOrder=99;
  const next=navigationFixture(snapshot,saved);next.context.OSMINOGRestore438={shouldApplyLegacyEdit:()=>false};
  await next.api.restore(null);assert.equal(next.state.activeProject,'b');assert.equal(next.state.ui.savedNavigationOrder,21);
});

test('navigation written during a captured full save remains pending and restores after that older snapshot',async()=>{
  const f=fixture(),journal={};f.state.projects.push({id:'other',objects:[],view:{x:3,y:4,scale:1}});
  const storage=navigationFixture({projects:[],activeProject:null},journal).local;
  f.context.crypto=webcrypto;f.context.chrome.storage={local:storage};
  f.context.document.addEventListener=()=>{};
  f.context.OSMINOGIOBudget.selectedStorage=require('../osminog-io-budget.js').selectedStorage;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../osminog-item-edits.js'),'utf8'),f.context);
  const api=f.context.OSMINOGItemEdits;await api.saveNavigation('desk');
  const gate=f.holdNext();f.context.markDirty();const saving=f.context.persist();await settle();
  f.state.activeProject='other';f.state.view={x:3,y:4,scale:1};await api.saveNavigation('other');
  gate.resolve();await saving;
  assert.equal(f.data.briefCraftStudioV2.activeProject,'desk');assert.equal(Object.keys(journal).length,1);
  assert.equal(Object.values(journal)[0].activeProject,'other');assert.equal(api.batch().length,1);
  const reloaded=navigationFixture(f.data.briefCraftStudioV2,journal);await reloaded.api.restore(null);
  assert.equal(reloaded.state.activeProject,'other');assert.equal(reloaded.state.ui.savedNavigationOrder,2);
});

test('an immediate primary save folds earlier navigation intent even while its durable journal write is pending',async()=>{
  const f=fixture(),journal={},gate=deferred(),storage=navigationFixture({projects:[],activeProject:null},journal).local;
  const write=storage.set;storage.set=async value=>{await gate.promise;await write(value)};
  f.context.crypto=webcrypto;f.context.chrome.storage={local:storage};f.context.document.addEventListener=()=>{};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../osminog-item-edits.js'),'utf8'),f.context);
  const pending=f.context.OSMINOGItemEdits.saveNavigation('desk');
  assert.equal(f.state.ui.savedNavigationOrder,1,'the global intent is captured before the first storage await');
  f.state.projects.push({id:'created',objects:[],view:{x:8,y:9,scale:1}});f.state.activeProject='created';f.state.view={x:8,y:9,scale:1};
  await f.context.flushPersist();gate.resolve();await pending;
  assert.equal(f.data.briefCraftStudioV2.activeProject,'created');assert.equal(f.data.briefCraftStudioV2.ui.savedNavigationOrder,1);
  assert.equal(f.data.briefCraftStudioV2.projects[0].savedItemEdits,undefined,'snapshot preceded the durable journal acknowledgement');
  const reloaded=navigationFixture(f.data.briefCraftStudioV2,journal);await reloaded.api.restore(null);
  assert.equal(reloaded.state.activeProject,'created');assert.equal(reloaded.state.ui.savedNavigationOrder,1);
});

test('a newer portable project does not fold navigation absent from the global primary snapshot',async()=>{
  const snapshot=navigationSnapshot();snapshot.ui.savedNavigationOrder=1;
  snapshot.projects.forEach(p=>p.updated=100);snapshot.projects[0].savedItemEdits={a1:true};
  const disk=structuredClone(snapshot);disk.activeProject='b';disk.projects[1].updated=200;disk.projects[1].savedItemEdits={b2:true};
  const saved={'osminogItemEdit:b2':navRecord('b2','b',2)};
  const f=navigationFixture(snapshot,saved);
  const root={getDirectoryHandle:async()=>({getFileHandle:async()=>({getFile:async()=>({text:async()=>JSON.stringify({schema:'osminog-local-memory/v1',...disk})})})})};
  Object.assign(f.context,{handlePermission:async()=>true,trashIndex:{},normalizeProject:structuredClone,
    OSMINOGProjectMemory:{owns:()=>false,merge:()=>({})},showToast:message=>assert.fail(message)});
  vm.runInContext(source.slice(source.indexOf('function shouldUseFolderSnapshot('),source.indexOf('async function syncFolder(')),f.context);
  await f.context.restoreFolderMemory(root,{automatic:true});
  assert.equal(f.state.activeProject,'a');assert.equal(f.state.projects.find(p=>p.id==='b').savedItemEdits.b2,true);
  await f.api.restore(null);assert.equal(f.state.activeProject,'b');assert.equal(f.state.ui.savedNavigationOrder,2);
});

test('production openProject preserves pending content saves and falls back only when navigation journaling fails',async()=>{
  const f=fixture(),opened=[],navigated=[],cleared=[];let rejectNavigation=false;
  f.state.projects.push({id:'other',objects:[]});
  f.context.showApp=restoring=>opened.push(restoring);
  f.context.OSMINOGItemEdits.saveNavigation=id=>{navigated.push(id);return rejectNavigation?Promise.reject(Error('storage unavailable')):Promise.resolve()};
  f.context.setTimeout=()=>123;f.context.clearTimeout=timer=>cleared.push(timer);
  vm.runInContext(source.slice(source.indexOf('function openProject('),source.indexOf('function createProject(')),f.context);
  assert.equal(f.context.openProject('other'),true);await settle();
  assert.equal(f.state.dirty,false);assert.equal(f.writes.length,0);assert.deepEqual(opened,[true]);assert.deepEqual(navigated,['other']);
  f.context.markDirty();f.state.saveTimer=77;f.state.selected=['large-image'];
  assert.equal(f.context.openProject('desk'),true);await settle();
  assert.equal(f.state.dirty,true);assert.equal(f.state.saveTimer,77);assert.equal(cleared.length,0);assert.equal(f.writes.length,0);
  assert.equal(f.state.selected.length,0);assert.equal(f.context.openProject('missing'),false);assert.equal(navigated.length,2);
  rejectNavigation=true;assert.equal(f.context.openProject('other'),true);await settle();
  assert.deepEqual(cleared,[77]);assert.equal(f.state.saveTimer,123);assert.equal(f.state.dirty,true);assert.equal(f.writes.length,0);
});
