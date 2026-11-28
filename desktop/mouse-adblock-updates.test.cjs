'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {MouseAdBlock,SOURCES,MAX_AGE,RETRY_BASE,MAX_RETRY,MAX_CUSTOM_SOURCES,CONFIG_FILE,sha256,downloadList}=require('./mouse-adblock.cjs');
const list=(marker='fixture')=>'[Adblock Plus 2.0]\n! Synthetic filter-list fixture\n'+Array.from({length:60},(_,i)=>'||ad'+i+'.'+marker+'.example.org^').join('\n')+'\n';
const customText='[Adblock Plus 2.0]\n||custom-ad.example.org^\n';
const record=(source,text,when,extra={})=>({schema:1,source:source.id,url:source.url,updatedAt:new Date(when).toISOString(),text,sha256:sha256(text),...extra});
async function fixture(t,options={}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-updates-')),service=new MouseAdBlock({directory,bundledDirectory:false,fetchList:async()=>{throw Error('Synthetic offline');},...options});
 t.after(async()=>{service.dispose();await service.flush();await service.preparing;await service.inFlight;await fs.rm(directory,{recursive:true,force:true});});return service;
}
async function cache(service,source,text,when,extra={}){const value=record(source,text,when,extra);await fs.writeFile(path.join(service.directory,source.id+'.json'),JSON.stringify(value));return value;}
const blocked=(service,url)=>service.engine.shouldBlock({url,resourceType:'script',initiatorOrigin:'https://content.example.net'});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
async function settle(service){await service.flush();await service.prepare();await service.refresh();}

test('freshness is twelve hours from the last successful check and manual refresh targets one list',async t=>{
 let now=Date.now(),calls=[];const service=await fixture(t,{now:()=>now,fetchList:async source=>{calls.push(source.id);return list('new');}});
 for(const source of SOURCES)await cache(service,source,list('old'),now);
 await service.initialize(true);await service.refresh();assert.deepEqual(calls,[]);
 now+=MAX_AGE-1;await service.refresh();assert.deepEqual(calls,[]);
 now++;await service.refresh();assert.deepEqual(calls.sort(),['easylist','ruadlist']);assert.equal(service.state().updateIntervalHours,12);
 calls=[];await service.manualRefresh('easylist');assert.deepEqual(calls,['easylist']);
 assert.equal(blocked(service,'https://ad3.new.example.org/ad.js'),true);
});
test('304 advances checkedAt, preserves the exact last-good body/hash/date, and survives restart',async t=>{
 let now=Date.now(),status=200;const requests=[];
 const service=await fixture(t,{now:()=>now,fetchList:(source,options)=>downloadList(source,{...options,fetchImpl:async(_url,request)=>{requests.push(request);return status===200?new Response(list('v1'),{headers:{ETag:'"v1"','Last-Modified':'Thu, 01 Jan 2026 00:00:00 GMT'}}):new Response(null,{status:304});}})});
 await service.initialize();await service.setSubscriptionEnabled('ruadlist',false);service.setEnabled(true);await settle(service);
 const before={...service.records.get('easylist')};assert.equal(requests.length,1);assert.equal(requests[0].headers['If-None-Match'],undefined);
 status=304;now+=MAX_AGE;await service.refresh();const after=service.records.get('easylist');
 assert.equal(requests.length,2);assert.equal(requests[1].headers['If-None-Match'],'"v1"');
 assert.equal(after.text,before.text);assert.equal(after.sha256,before.sha256);assert.equal(after.updatedAt,before.updatedAt);assert.equal(Date.parse(after.checkedAt),now);
 assert.equal(service.state().subscriptions[0].phase,'ready');assert.equal(service.state().subscriptions[0].checkedAt,after.checkedAt);
 const disk=JSON.parse(await fs.readFile(path.join(service.directory,'easylist.json'),'utf8'));assert.deepEqual(disk,after);
 service.dispose();let network=0;const restored=new MouseAdBlock({directory:service.directory,bundledDirectory:false,now:()=>now,fetchList:async()=>{network++;throw Error('Must remain offline');}});t.after(()=>restored.dispose());
 await restored.initialize(true);await restored.refresh();assert.equal(network,0);assert.equal(blocked(restored,'https://ad0.v1.example.org/ad.js'),true);
});
test('unsolicited 304 after a corrupt cache cannot turn missing data into a successful list',async t=>{
 const now=Date.now();let previous;
 const service=await fixture(t,{now:()=>now,fetchList:async(_source,options)=>{previous=options.record;return{status:304,etag:'"missing"'};}});
 await cache(service,SOURCES[0],list(),now-MAX_AGE,{sha256:'0'.repeat(64),etag:'"bad"'});
 await service.initialize(true);await service.refresh();assert.equal(previous,undefined);assert.equal(service.records.size,0);assert.equal(service.state().rules,3);
 assert.equal(service.state().subscriptions[0].lastError,'MOUSE_ADBLOCK_LIST_UNAVAILABLE');
});
test('failed refreshes retain last-good bytes and apply bounded exponential retry; manual retries bypass waiting',async t=>{
 let now=Date.now(),calls=0;const service=await fixture(t,{now:()=>now,fetchList:async()=>{calls++;throw Error('Secret URL must not be surfaced');}});
 await service.initialize();await service.setSubscriptionEnabled('ruadlist',false);
 await cache(service,SOURCES[0],list('retained'),now-MAX_AGE-1);service.setEnabled(true);await settle(service);
 const saved=await fs.readFile(path.join(service.directory,'easylist.json'),'utf8');assert.equal(calls,1);assert.equal(blocked(service,'https://ad4.retained.example.org/ad.js'),true);
 let state=service.state().subscriptions[0];assert.equal(state.phase,'stale');assert.equal(Date.parse(state.nextRetryAt),now+RETRY_BASE);
 await service.refresh();assert.equal(calls,1);now+=RETRY_BASE-1;await service.refresh();assert.equal(calls,1);
 now++;await service.refresh();assert.equal(calls,2);assert.equal(Date.parse(service.state().subscriptions[0].nextRetryAt),now+2*RETRY_BASE);
 await service.manualRefresh('easylist');assert.equal(calls,3);assert.equal(Date.parse(service.state().subscriptions[0].nextRetryAt),now+4*RETRY_BASE);
 for(let i=0;i<12;i++)await service.manualRefresh('easylist');assert.equal(Date.parse(service.state().subscriptions[0].nextRetryAt),now+MAX_RETRY);
 assert.equal(await fs.readFile(path.join(service.directory,'easylist.json'),'utf8'),saved);assert.equal(service.state().subscriptions[0].lastError.includes('Secret'),false);
 service.setEnabled(false);assert.equal(service.timer,null);await assert.rejects(service.manualRefresh(),{code:'MOUSE_ADBLOCK_DISABLED'});assert.equal(service.controllers.size,0);
});
test('a failed cache commit leaves both the previous file and live matcher intact',async t=>{
 const now=Date.now(),service=await fixture(t,{now:()=>now,fetchList:async()=>list('next')});
 for(const source of SOURCES)await cache(service,source,list('old'),now-MAX_AGE-1);
 const before=await fs.readFile(path.join(service.directory,'easylist.json'),'utf8');service.save=async()=>{throw Error('Synthetic disk failure');};
 await service.initialize(true);await service.refresh();assert.equal(await fs.readFile(path.join(service.directory,'easylist.json'),'utf8'),before);
 assert.equal(blocked(service,'https://ad1.old.example.org/a.js'),true);assert.equal(blocked(service,'https://ad1.next.example.org/a.js'),false);
 assert.equal(service.state().subscriptions.every(source=>source.phase==='stale'),true);
});
test('turning off while a cache write is pending prevents late commit and late matcher publication',async t=>{
 const entered=deferred(),resume=deferred(),service=await fixture(t,{fetchList:async()=>list('late')});
 const save=service.save.bind(service);service.save=async(source,value,guard)=>{entered.resolve();await resume.promise;return save(source,value,guard);};
 service.setEnabled(true);await entered.promise;const pending=service.inFlight;service.setEnabled(false);resume.resolve();await pending;
 assert.equal(service.records.size,0);assert.equal(service.state().enabled,false);assert.equal(service.timer,null);
 await assert.rejects(fs.readFile(path.join(service.directory,'easylist.json')),{code:'ENOENT'});assert.equal((await fs.readdir(service.directory)).some(name=>name.endsWith('.tmp')),false);
});
test('a timeout is visible and retries later, while off/dispose aborts are not counted as failures',async t=>{
 const service=await fixture(t,{requestTimeout:5,fetchList:(_source,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Aborted')),{once:true}))});
 // Keep a real event-loop handle while the production timeout remains unref'ed.
 const handle=setTimeout(()=>{},1000);try{await service.initialize(true);await service.refresh();}finally{clearTimeout(handle);}
 assert.equal(service.state().subscriptions.every(source=>source.lastError==='MOUSE_ADBLOCK_TIMEOUT'),true);assert.ok(service.timer);
});
test('custom add/toggle/remove persists, reuses valid cache, and all disabled lists really stop matching',async t=>{
 let calls=[];const service=await fixture(t,{fetchList:async source=>{calls.push(source.id);return source.builtin?list(source.id):customText;}});
 await service.initialize();const added=await service.addSubscription({url:'https://filters.example.org/custom.txt',name:'My network rules'}),id=added.subscriptions.find(source=>!source.builtin).id;
 assert.equal(calls.length,0);assert.equal(service.prepared,false);
 service.setEnabled(true);await settle(service);assert.equal(blocked(service,'https://custom-ad.example.org/ad.js'),true);assert.equal(service.state().subscriptions.find(source=>source.id===id).ruleCount,1);
 await service.setSubscriptionEnabled(id,false);await service.refresh();assert.equal(blocked(service,'https://custom-ad.example.org/ad.js'),false);
 calls=[];await service.setSubscriptionEnabled(id,true);await service.refresh();assert.equal(blocked(service,'https://custom-ad.example.org/ad.js'),true);assert.equal(calls.length,0);
 for(const source of service.sources)await service.setSubscriptionEnabled(source.id,false);await service.refresh();assert.equal(service.state().rules,0);assert.equal(blocked(service,'https://ads.vk.com/ad.js'),false);assert.equal(service.timer,null);
 await service.removeSubscription(id);assert.equal(service.state().subscriptions.some(source=>source.id===id),false);await assert.rejects(fs.readFile(path.join(service.directory,id+'.json')),{code:'ENOENT'});
 const stored=JSON.parse(await fs.readFile(path.join(service.directory,CONFIG_FILE),'utf8'));assert.deepEqual(stored.enabled,{easylist:false,ruadlist:false});assert.deepEqual(stored.custom,[]);
 service.dispose();const restored=new MouseAdBlock({directory:service.directory,bundledDirectory:false,fetchList:async()=>{throw Error('Disabled subscriptions must not download');}});t.after(()=>restored.dispose());
 await restored.initialize(true);await restored.refresh();assert.equal(restored.state().rules,0);assert.equal(restored.loaded.size,0);
});
test('enabling an unprepared profile with every list off never exposes seed rules in its immediate callback',async t=>{
 let downloads=0;const service=await fixture(t,{fetchList:async()=>{downloads++;throw Error('All subscriptions are disabled');}});
 await service.initialize(false);for(const source of SOURCES)await service.setSubscriptionEnabled(source.id,false);
 const immediate=value=>{
  let listener;value.attach({webRequest:{onBeforeRequest(filter,callback){listener=filter?callback:null;}}});
  assert.equal(value.prepared,false);value.setEnabled(true);let decision;
  // Deliberately do not yield to preparation: this is the first real request
  // callback after the global switch becomes active.
  listener({url:'https://ads.vk.com/ad.js',resourceType:'script',initiatorOrigin:'https://content.example.org'},result=>decision=result);
  assert.deepEqual(decision,{cancel:false});assert.equal(value.engine.count,0);
 };
 immediate(service);await service.refresh();assert.equal(downloads,0);service.dispose();
 const restored=new MouseAdBlock({directory:service.directory,bundledDirectory:false,fetchList:async()=>{downloads++;throw Error('All subscriptions are disabled');}});t.after(()=>restored.dispose());
 await restored.initialize(false);immediate(restored);await restored.refresh();assert.equal(downloads,0);
});
test('subscription configuration rejects duplicates, excess entries and untrusted persisted URLs',async t=>{
 const service=await fixture(t);await service.initialize();
 await assert.rejects(service.addSubscription({url:SOURCES[0].url}),{code:'MOUSE_ADBLOCK_SUBSCRIPTION_DUPLICATE'});
 for(let i=0;i<MAX_CUSTOM_SOURCES;i++)await service.addSubscription({url:'https://filters.example.org/list-'+i+'.txt'});
 await assert.rejects(service.addSubscription({url:'https://filters.example.org/excess.txt'}),{code:'MOUSE_ADBLOCK_SUBSCRIPTION_LIMIT'});
 await assert.rejects(service.removeSubscription('easylist'),{code:'MOUSE_ADBLOCK_SUBSCRIPTION_BUILTIN'});
 const invalid=JSON.parse(await fs.readFile(path.join(service.directory,CONFIG_FILE),'utf8'));invalid.custom[0].url='https://127.0.0.1/private';await fs.writeFile(path.join(service.directory,CONFIG_FILE),JSON.stringify(invalid));
 service.dispose();const restored=new MouseAdBlock({directory:service.directory,bundledDirectory:false});t.after(()=>restored.dispose());await restored.initialize(false);
 assert.equal(restored.state().subscriptions.length,2);assert.equal(restored.prepared,false);
});
test('private mode and a mode switch during persistence leave configuration and matching unchanged',async t=>{
 let privateMode=false;const service=await fixture(t,{isPrivate:()=>privateMode});await service.initialize();
 await service.setSubscriptionEnabled('ruadlist',false);const original=await fs.readFile(path.join(service.directory,CONFIG_FILE),'utf8');
 privateMode=true;assert.throws(()=>service.addSubscription({url:'https://filters.example.org/private.txt'}),{code:'MOUSE_ADBLOCK_SUBSCRIPTION_PRIVATE'});await assert.rejects(service.manualRefresh(),{code:'MOUSE_ADBLOCK_SUBSCRIPTION_PRIVATE'});privateMode=false;
 const entered=deferred(),resume=deferred(),write=service.writeAtomic.bind(service);service.writeAtomic=async(name,value,guard)=>{entered.resolve();await resume.promise;return write(name,value,guard);};
 const pending=service.setSubscriptionEnabled('easylist',false);await entered.promise;privateMode=true;resume.resolve();await assert.rejects(pending,{code:'MOUSE_ADBLOCK_SUBSCRIPTION_PRIVATE'});await service.flush();
 assert.equal(service.state().subscriptions[0].enabled,true);assert.equal(await fs.readFile(path.join(service.directory,CONFIG_FILE),'utf8'),original);assert.equal((await fs.readdir(service.directory)).some(name=>name.endsWith('.tmp')),false);
});
test('failed configuration storage leaves source selection and the current matcher unchanged',async t=>{
 const service=await fixture(t,{fetchList:async source=>list(source.id)});await service.initialize(true);await service.refresh();
 const engine=service.engine;service.writeAtomic=async()=>{throw Error('Synthetic storage failure');};await assert.rejects(service.setSubscriptionEnabled('easylist',false),/storage failure/);
 assert.equal(service.sources[0].enabled,true);assert.equal(service.engine,engine);assert.equal(blocked(service,'https://ad0.easylist.example.org/ad.js'),true);
});
test('disabling a subscription cancels an overlapping update and stale data cannot reinstall its rules',async t=>{
 const now=Date.now(),started=deferred(),service=await fixture(t,{now:()=>now});for(const source of SOURCES)await cache(service,source,list(source.id),now);
 await service.initialize(true);await service.refresh();service.fetchList=async(_source,{signal})=>new Promise(resolve=>{started.resolve();signal.addEventListener('abort',()=>resolve(list('late')),{once:true});});
 const updating=service.manualRefresh('easylist');await started.promise;await service.setSubscriptionEnabled('easylist',false);await updating;await service.refresh();
 assert.equal(blocked(service,'https://ad1.easylist.example.org/a.js'),false);assert.equal(blocked(service,'https://ad1.late.example.org/a.js'),false);assert.equal(blocked(service,'https://ad1.ruadlist.example.org/a.js'),true);
 assert.equal(service.records.get('easylist').sha256,sha256(list('easylist')));assert.equal(service.state().subscriptions[0].phase,'disabled');
});
test('a rapid global off/on rejects late responses from the earlier enable generation',async t=>{
 const started=deferred();let calls=0;
 const service=await fixture(t,{fetchList:async(_source,{signal})=>{calls++;if(calls>2)return list('current');return new Promise(resolve=>{started.resolve();signal.addEventListener('abort',()=>resolve(list('late-generation')),{once:true});});}});
 service.setEnabled(true);await started.promise;service.setEnabled(false);assert.equal(service.timer,null);service.setEnabled(true);await service.refresh();
 assert.equal(service.state().enabled,true);assert.equal(service.state().phase,'ready');assert.equal(calls,4);assert.equal(service.controllers.size,0);
 assert.equal(blocked(service,'https://ad1.current.example.org/a.js'),true);assert.equal(blocked(service,'https://ad1.late-generation.example.org/a.js'),false);
});
test('removing and immediately re-adding the same custom ID cannot inherit an older in-flight commit',async t=>{
 const started=deferred();let generation='old';
 const service=await fixture(t,{fetchList:async(source,{signal})=>{
  if(source.builtin)return list(source.id);
  if(generation==='new')return'[Adblock Plus 2.0]\n||new-custom.example.org^\n';
  return new Promise(resolve=>{started.resolve();signal.addEventListener('abort',()=>resolve('[Adblock Plus 2.0]\n||old-custom.example.org^\n'),{once:true});});
 }});
 await service.initialize(true);await service.refresh();const input={url:'https://filters.example.org/readded.txt'};
 const added=await service.addSubscription(input),id=added.subscriptions.find(source=>!source.builtin).id;await started.promise;
 const removing=service.removeSubscription(id);generation='new';const readding=service.addSubscription(input);await removing;await readding;await service.refresh();
 assert.equal(service.state().subscriptions.filter(source=>source.id===id).length,1);assert.equal(blocked(service,'https://old-custom.example.org/ad.js'),false);assert.equal(blocked(service,'https://new-custom.example.org/ad.js'),true);
 const cached=JSON.parse(await fs.readFile(path.join(service.directory,id+'.json'),'utf8'));assert.equal(cached.sha256,sha256('[Adblock Plus 2.0]\n||new-custom.example.org^\n'));
});
test('successful lists publish together only after the replacement matcher is fully compiled',async t=>{
 const now=Date.now(),firstSaved=deferred(),releaseSecond=deferred(),service=await fixture(t,{now:()=>now});
 for(const source of SOURCES)await cache(service,source,list('old-'+source.id),now);await service.initialize(true);await service.refresh();
 const oldEngine=service.engine,save=service.save.bind(service);service.save=async(source,value,guard)=>{const saved=await save(source,value,guard);if(source.id==='easylist')firstSaved.resolve();return saved;};
 service.fetchList=async source=>{if(source.id==='ruadlist')await releaseSecond.promise;return list('new-'+source.id);};
 const pending=service.manualRefresh();await firstSaved.promise;
 assert.equal(service.engine,oldEngine);assert.equal(blocked(service,'https://ad1.old-easylist.example.org/a.js'),true);assert.equal(blocked(service,'https://ad1.new-easylist.example.org/a.js'),false);
 releaseSecond.resolve();await pending;assert.notEqual(service.engine,oldEngine);
 for(const source of SOURCES){assert.equal(blocked(service,'https://ad1.new-'+source.id+'.example.org/a.js'),true);assert.equal(blocked(service,'https://ad1.old-'+source.id+'.example.org/a.js'),false);}
});
test('a changed packaged body fails its manifest hash while another intact fallback remains usable',async t=>{
 const service=await fixture(t),directory=path.join(service.directory,'bundled');await fs.mkdir(directory);service.bundledDirectory=directory;
 const rows=[];
 for(const source of SOURCES){const text=list(source.id);rows.push({id:source.id,url:source.url,file:source.id+'.txt',bytes:Buffer.byteLength(text),sha256:sha256(text),updatedAt:new Date(Date.now()-1000).toISOString()});await fs.writeFile(path.join(directory,source.id+'.txt'),source.id==='easylist'?text.replace('ad0.','ad9.'):text);}
 await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify({schema:1,lists:rows}));await service.initialize(true);await service.refresh();
 assert.equal(service.state().subscriptions[0].origin,'none');assert.equal(service.state().subscriptions[1].origin,'bundled');assert.equal(service.state().lists,1);
 assert.equal(blocked(service,'https://ad1.ruadlist.example.org/a.js'),true);assert.equal(blocked(service,'https://ad1.easylist.example.org/a.js'),false);
});
test('packaged full lists verify original hashes offline, cache takes priority and disabled fallback adds no hidden rules',async t=>{
 const bundledDirectory=path.join(__dirname,'mouse-filter-lists'),service=await fixture(t,{bundledDirectory});await service.initialize(true);await service.refresh();
 const manifest=JSON.parse(await fs.readFile(path.join(bundledDirectory,'manifest.json'),'utf8'));
 assert.equal(service.state().phase,'fallback');assert.equal(service.state().lists,2);assert.ok(service.state().rules>1000);
 for(const row of service.state().subscriptions){const expected=manifest.lists.find(item=>item.id===row.id);assert.equal(row.origin,'bundled');assert.equal(row.sha256,expected.sha256);assert.equal(row.updatedAt,expected.updatedAt);assert.equal(row.checkedAt,null);assert.ok(row.ruleCount>100);assert.ok(row.authors&&row.license);}
 assert.equal(service.records.size,0);for(const source of SOURCES)await service.setSubscriptionEnabled(source.id,false);await service.refresh();assert.equal(service.state().rules,0);
 const newer=await fixture(t,{bundledDirectory});await cache(newer,SOURCES[0],list('priority'),Date.now());await newer.initialize(true);await newer.refresh();
 assert.equal(newer.state().subscriptions[0].origin,'cache');assert.equal(newer.state().subscriptions[0].sha256,sha256(list('priority')));assert.equal(blocked(newer,'https://ad0.priority.example.org/a.js'),true);
});
test('notifications carry increasing revisions across updates and persisted policy changes',async t=>{
 const revisions=[],service=await fixture(t,{fetchList:async source=>list(source.id),notify:state=>revisions.push(state.revision)});await service.initialize(true);await service.refresh();await service.setSubscriptionEnabled('easylist',false);await service.refresh();service.setEnabled(false);
 assert.ok(revisions.length>=5);for(let i=1;i<revisions.length;i++)assert.ok(revisions[i]>revisions[i-1]);assert.equal(service.state().revision,revisions.at(-1));
});
