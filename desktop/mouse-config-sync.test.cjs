'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {exportWorkspace,importWorkspace,mergeWorkspace,MouseConfigSync,CACHE,PROJECT}=require('./mouse-config-sync.cjs');
const {validateSyncState,MAX_BYTES}=require('./mouse-sync-schema.cjs');
const L=require('./mouse/layout.js');
const clone=x=>structuredClone(x),blank=()=>exportWorkspace({});
const bookmark=(title='Mouse')=>({id:randomUUID(),url:'https://mouse.black/',title,at:1});
class MemoryStore{constructor(value={}){this.value=clone(value);this.mutations=0;}async get(){return clone(this.value);}async set(changes){Object.assign(this.value,clone(changes));}async mutate(callback){this.mutations++;return callback(this.value);}}
function account(remote,id=2){return{snapshot:()=>({accountId:id}),request:async(method,route,body,options)=>{if(options)assert.equal(options.expectedAccountId,id);if(method==='GET'&&route==='/sync/revision')return{revision:remote.revision,updatedAt:remote.updatedAt??null};assert.equal(route,'/sync');if(method==='GET')return clone(remote);if(body.revision!==remote.revision)throw Object.assign(Error(),{status:409});remote.revision++;remote.state=validateSyncState(body.state);return clone(remote);}};}

test('explicit export contains layouts/bookmarks/themes only; files, page text, history and passwords remain local',()=>{
 const id=randomUUID(),secret='NEVER-UPLOAD-CAPTURED-TEXT';
 const data={browserSessions:{[PROJECT]:[{id,url:'https://mouse.black/',lane:'main',thread:secret},{id:randomUUID(),url:'file:///Users/anton/private.jpg',lane:'main'},{id:randomUUID(),url:'https://site.test/?access_token='+secret,lane:'main'}]},
  quadroLibrary:{bookmarks:[bookmark()],downloads:[{filename:secret}],history:[{title:secret}]},mouseCaptureArchive:{text:secret,image:'data:image/png;base64,SECRET'},browserNetwork:{password:secret},mouseCredentials:{password:secret},cookies:secret,other:{value:secret},quadroStartPage:{background:'custom',path:'/Users/anton/photo.jpg'},mouseControlSettings:{blockAds:true}};
 const state=exportWorkspace(data),raw=JSON.stringify(state);assert(!raw.includes(secret));assert(!raw.includes('file:'));assert(!raw.includes('base64'));assert(!raw.includes('/Users/'));assert.equal(state.tabs.length,1);assert.equal(state.settings.blockAds,true);
 const restored=importWorkspace(data,state);assert.deepEqual(restored.mouseCredentials,data.mouseCredentials);assert.deepEqual(restored.quadroLibrary.downloads,data.quadroLibrary.downloads);assert.equal(restored.quadroStartPage.background,'custom');
});
test('server schema rejects unknown nested data, URLs with credentials and unbounded metadata',()=>{
 for(const inject of [s=>s.files=[],s=>s.appearance.image='data:image/png;base64,AA',s=>s.desktops.items[0].layout.tree.secret='text',s=>s.settings.password='secret',s=>s.preferences.aiSites=[{name:'test',url:'file:///tmp/local'}],s=>s.bookmarks=[{...bookmark(),url:'https://user:pass@example.test/'}],s=>s.bookmarks=[{...bookmark(),url:'https://example.test/#access_token=secret'}]]){const s=blank();inject(s);assert.throws(()=>validateSyncState(s));}
 const huge=blank();huge.bookmarks=Array.from({length:5000},()=>({...bookmark(),title:'a'.repeat(500)}));assert(Buffer.byteLength(JSON.stringify(huge))>MAX_BYTES);assert.throws(()=>validateSyncState(huge));
});
test('twelve-pane grid, pinned empty pane, AI, styles and tab identities round-trip into a new local profile',()=>{
 const s=blank(),d=s.desktops.items[2],a=randomUUID(),b=randomUUID();s.tabs=[{id:a,url:'https://mouse.black/',lane:'main'},{id:b,url:'https://example.com/',lane:'side'}];s.desktops.members={[a]:d.id,[b]:d.id};d.layout={...d.layout,tree:L.preset(12),slots:{p1:a},active:'p1',tabOrder:[a],pinnedPanes:{p2:''},aiId:b,aiOpen:true,aiSessions:{'https://example.com/':b}};s.appearance={paneMode:'square',whiteTone:70,surfaces:{dark:{bottom:{mode:'gradient',color:'#123456',endColor:'#234567',angle:90,opacity:75}}},tones:{blackTemperature:40}};s.preferences.theme='dark';s.bookmarks=[bookmark()];
 const again=exportWorkspace(importWorkspace({},s));assert.deepEqual(again,validateSyncState(s));assert.equal(L.leaves(again.desktops.items[2].layout.tree).length,12);
});
test('three-way merge preserves independent additions and respects intentional deletions',()=>{
 const b=blank(),old=bookmark('old');b.bookmarks=[old];const l=clone(b),r=clone(b),left=bookmark('left'),right=bookmark('right');l.bookmarks=[left];r.bookmarks.push(right);r.preferences.theme='dark';l.settings.blockAds=true;
 const result=mergeWorkspace(b,l,r);assert.deepEqual(new Set(result.bookmarks.map(x=>x.id)),new Set([left.id,right.id]));assert.equal(result.preferences.theme,'dark');assert.equal(result.settings.blockAds,true);
});
test('one-device bookmark additions retain the exact native newest-first order without sorting existing imported rows',()=>{
 const base=blank(),old={...bookmark('old'),at:100},imported={...bookmark('imported'),at:200};base.bookmarks=[old,imported];
 const local=clone(base),remote=clone(base),latest={...bookmark('last edit before logout'),at:300};local.bookmarks.unshift(latest);remote.preferences.theme='dark';
 assert.deepEqual(mergeWorkspace(base,local,remote).bookmarks,[latest,old,imported]);
 assert.deepEqual(mergeWorkspace(base,remote,local).bookmarks,[latest,old,imported]);
});
test('simultaneous bookmark additions use newest-first order and the same ID tie break on either device',()=>{
 const base=blank(),old={...bookmark('old'),at:1};base.bookmarks=[old];const left=clone(base),right=clone(base);
 const a={...bookmark('left'),id:'a-concurrent',at:2},z={...bookmark('right'),id:'z-concurrent',at:2};left.bookmarks.unshift(z);right.bookmarks.unshift(a);
 assert.deepEqual(mergeWorkspace(base,left,right).bookmarks,[a,z,old]);
 assert.deepEqual(mergeWorkspace(base,right,left).bookmarks,[a,z,old]);
});
test('two sync engines preserve final bookmark order and converge without repeated reorder uploads',async()=>{
 const initial=blank(),old={...bookmark('existing'),at:1};initial.bookmarks=[old];
 const remote={revision:1,state:initial},leftStore=new MemoryStore(),rightStore=new MemoryStore();
 const left=new MouseConfigSync({store:leftStore,account:account(remote)}),right=new MouseConfigSync({store:rightStore,account:account(remote)});
 await left.tick({apply:true});await right.tick({apply:true});
 const a={...bookmark('first device'),at:2},b={...bookmark('second device'),at:3};
 leftStore.value.quadroLibrary.bookmarks.unshift(a);rightStore.value.quadroLibrary.bookmarks.unshift(b);
 await left.tick();assert.equal(left.state().phase,'synced');assert.deepEqual(remote.state.bookmarks,[a,old]);
 await right.tick();assert.deepEqual(remote.state.bookmarks,[b,a,old]);assert.equal(remote.revision,3);
 await left.tick({apply:true});await right.tick({apply:true});
 assert.deepEqual(exportWorkspace(leftStore.value),remote.state);assert.deepEqual(exportWorkspace(rightStore.value),remote.state);
 for(let i=0;i<5;i++){await left.tick();await right.tick();}
 assert.equal(remote.revision,3);assert.equal(left.state().phase,'synced');assert.equal(right.state().phase,'synced');
});
test('edit versus delete retains edited bookmark; concurrent title edits keep both values',()=>{
 const b=blank();b.bookmarks=[bookmark('old')];let l=clone(b),r=clone(b);l.bookmarks=[];r.bookmarks[0].title='remote edit';assert.equal(mergeWorkspace(b,l,r).bookmarks[0].title,'remote edit');l=clone(b);l.bookmarks[0].title='local edit';const merged=mergeWorkspace(b,l,r);assert.equal(merged.bookmarks.length,2);assert(merged.bookmarks.some(x=>x.title==='local edit'));assert(merged.bookmarks.some(x=>x.title.startsWith('remote edit')));
});
test('concurrent grid edits preserve the other complete grid in existing layout history',()=>{
 const b=blank(),l=clone(b),r=clone(b);l.desktops.items[2].layout.tree=L.preset(4);r.desktops.items[2].layout.tree=L.preset(9);
 const merged=mergeWorkspace(b,l,r);assert.equal(L.leaves(merged.desktops.items[2].layout.tree).length,4);assert.equal(L.leaves(merged.layoutAlternatives[0].layout.tree).length,9);
 const restored=importWorkspace({},merged);assert.equal(L.leaves(restored.mouseDesktopsV1.items[2].history.past[0].layout.tree).length,9);assert.deepEqual(exportWorkspace(restored).layoutAlternatives,merged.layoutAlternatives);
});
test('two real sync engines converge without one inactive device wiping remote changes',async()=>{
 const remote={revision:0,state:null},leftStore=new MemoryStore(importWorkspace({},blank())),rightStore=new MemoryStore();
 const left=new MouseConfigSync({store:leftStore,account:account(remote)});await left.tick({apply:true});
 const right=new MouseConfigSync({store:rightStore,account:account(remote)});await right.tick({apply:true});
 const a=bookmark('from left'),b=bookmark('from right');leftStore.value.quadroLibrary.bookmarks.push(a);await left.tick();rightStore.value.quadroLibrary.bookmarks.push(b);await right.tick();await left.tick();await right.tick();
 assert.deepEqual(new Set(remote.state.bookmarks.map(x=>x.id)),new Set([a.id,b.id]));assert(left.state().pendingRemote);assert(right.state().pendingRemote);
 await left.tick({apply:true});await right.tick({apply:true});assert.deepEqual(exportWorkspace(leftStore.value),exportWorkspace(rightStore.value));assert.equal(remote.revision,3);
});
test('cloud pull stays pending during browsing; next startup applies it without page disruption',async()=>{
 const initial=blank(),remote={revision:1,state:initial},store=new MemoryStore(importWorkspace({},initial)),sync=new MouseConfigSync({store,account:account(remote)});await sync.tick({apply:true});remote.state={...clone(initial),preferences:{...initial.preferences,theme:'dark'}};remote.revision++;
 await sync.tick();assert.equal(store.value.quadroPreferences.theme,'light');assert.equal(sync.state().phase,'pending');await sync.tick({apply:true});assert.equal(store.value.quadroPreferences.theme,'dark');
});
test('offline failure and CAS race never rewrite local data or claim successful sync',async()=>{
 const store=new MemoryStore(importWorkspace({},blank())),before=clone(store.value);let mode='offline';const acc={snapshot:()=>({accountId:2}),request:async method=>{if(mode==='offline')throw Error('offline');if(method==='GET')return{revision:1,state:null};throw Object.assign(Error(),{status:409});}};const sync=new MouseConfigSync({store,account:acc});await sync.tick();assert.deepEqual(store.value,before);assert.equal(sync.state().phase,'error');mode='conflict';await sync.tick();assert.deepEqual(store.value,before);assert.equal(sync.state().phase,'retry');
});
test('logout/account rotation during a cloud request cannot import another account configuration',async()=>{
 const store=new MemoryStore(importWorkspace({},blank())),before=clone(store.value);let id=2,resolve;const acc={snapshot:()=>id?{accountId:id}:null,request:()=>new Promise(r=>{resolve=r;})};const sync=new MouseConfigSync({store,account:acc});const pending=sync.tick({apply:true});while(!resolve)await new Promise(r=>setImmediate(r));id=3;resolve({revision:1,state:blank()});await pending;assert.deepEqual(store.value,before);assert(!store.value[CACHE]);
});

test('account context is captured before beforeRead; a profile cannot be uploaded after account or privacy changes',async()=>{
 for(const rotate of ['account','privacy','epoch']){
  const local=blank();local.bookmarks=[bookmark('only-account-2')];const store=new MemoryStore(importWorkspace({},local));let id=2,allowed=true,release,calls=0;
  const gate=new Promise(resolve=>release=resolve),acc={epoch:0,snapshot:()=>({accountId:id}),request:async()=>{calls++;return{revision:0,state:null};}};
  const sync=new MouseConfigSync({store,account:acc,beforeRead:()=>gate,canSync:()=>allowed});const pending=sync.tick({apply:true});
  if(rotate==='account')id=3;else if(rotate==='privacy')allowed=false;else acc.epoch++;
  release();await pending;assert.equal(calls,0,rotate);assert(!store.value[CACHE]);assert.equal(sync.state().phase,'idle');
 }
});

test('stop aborts only its own request and start allows a fresh sync after a cancelled profile switch',async()=>{
 const remote={revision:0,state:null},real=account(remote),store=new MemoryStore();let aborted=false,entered,first=true;
 const waiting=new Promise(resolve=>entered=resolve),acc={snapshot:real.snapshot,request:async(method,route,body,options)=>{
  if(first){first=false;entered();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(Object.assign(Error('aborted'),{code:'ACCOUNT_CANCELLED'}));},{once:true}));}
  return real.request(method,route,body,options);
 }};
 const sync=new MouseConfigSync({store,account:acc});const work=sync.tick();await waiting;await sync.stop();await work;
 assert(aborted);assert.equal(sync.state().phase,'idle');assert(!store.value[CACHE]);
 sync.start();assert.equal(sync.closed,false);await sync.tick({apply:true});assert.equal(sync.state().phase,'synced');assert.equal(remote.revision,1);await sync.stop();
});

test('atomic apply merges edits made during HTTP and preserves latest local download/history/private records',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-sync-race-'));try{
  const {Store}=require('./storage.cjs'),store=new Store(directory),local=blank(),remote=blank(),remoteBookmark=bookmark('remote'),localBookmark=bookmark('new local');
  remote.bookmarks=[remoteBookmark];remote.preferences.theme='dark';
  await store.set({...importWorkspace({},local),privateOnly:{value:'untouched'},quadroLibrary:{bookmarks:[],downloads:[],history:[]}});
  let arrived,release;const reached=new Promise(resolve=>arrived=resolve);
  const acc={snapshot:()=>({accountId:2}),request:async(method,route)=>{if(route==='/sync/revision')return{revision:1,updatedAt:1};arrived();await new Promise(resolve=>release=resolve);return{revision:1,state:remote};}};
  const sync=new MouseConfigSync({store,account:acc});const pending=sync.tick({apply:true});await reached;
  await store.set({privateOnly:{value:'new local private value'},quadroLibrary:{bookmarks:[localBookmark],downloads:[{id:'just-finished'}],history:[{url:'https://local-only.test/'}]}});
  release();await pending;const fresh=await store.get(null);
  assert.deepEqual(new Set(fresh.quadroLibrary.bookmarks.map(b=>b.id)),new Set([remoteBookmark.id,localBookmark.id]));
  assert.equal(fresh.quadroLibrary.downloads[0].id,'just-finished');assert.equal(fresh.quadroLibrary.history[0].url,'https://local-only.test/');assert.equal(fresh.privateOnly.value,'new local private value');
  assert.equal(fresh.quadroPreferences.theme,'dark');assert.equal(fresh[CACHE].local.bookmarks.length,1);assert(sync.state().pendingRemote);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('first offline account changes survive an eventual nonempty remote state while a pristine login accepts remote settings',async()=>{
 const initial=blank(),localBookmark=bookmark('created while offline'),remoteBookmark=bookmark('from the other Mac');initial.bookmarks=[localBookmark];initial.preferences.theme='dark';
 const remote={revision:1,state:{...blank(),bookmarks:[remoteBookmark]}},store=new MemoryStore(importWorkspace({},initial)),real=account(remote);let offline=true;
 const sync=new MouseConfigSync({store,account:{snapshot:real.snapshot,request:(...args)=>{if(offline)throw Error('offline');return real.request(...args);}}});
 await sync.tick({apply:true});assert.equal(sync.state().phase,'error');assert(!store.value[CACHE]);assert.equal(store.value.quadroLibrary.bookmarks[0].id,localBookmark.id);
 offline=false;await sync.tick({apply:true});assert.deepEqual(new Set(store.value.quadroLibrary.bookmarks.map(b=>b.id)),new Set([localBookmark.id,remoteBookmark.id]));assert.equal(remote.state.preferences.theme,'dark');
 const pristine=new MemoryStore(importWorkspace({},blank())),newDevice=new MouseConfigSync({store:pristine,account:account(remote)});await newDevice.tick({apply:true});
 assert.deepEqual(exportWorkspace(pristine.value),remote.state);
});

test('unchanged polling fetches only a tiny revision and performs no full-state download or local rewrite',async()=>{
 const large=blank();large.bookmarks=Array.from({length:1500},()=>({...bookmark(),title:'x'.repeat(400)}));const remote={revision:1,state:large},real=account(remote),store=new MemoryStore();
 const calls=[],sync=new MouseConfigSync({store,account:{snapshot:real.snapshot,request:async(...args)=>{const value=await real.request(...args);calls.push({method:args[0],route:args[1],bytes:Buffer.byteLength(JSON.stringify(value))});return value;}}});
 await sync.tick({apply:true});const mutations=store.mutations;calls.length=0;
 for(let i=0;i<5;i++)await sync.tick();
 assert.equal(calls.length,5);assert(calls.every(c=>c.method==='GET'&&c.route==='/sync/revision'&&c.bytes<100));assert.equal(store.mutations,mutations);
 remote.revision++;remote.state.preferences.theme='dark';await sync.tick();assert.equal(calls.filter(c=>c.route==='/sync').length,1);assert.equal(sync.state().pendingRemote,true);
 calls.length=0;await sync.tick();assert.equal(calls.length,1);assert.equal(calls[0].route,'/sync/revision');
});

test('an account-mismatched local cache is never sent or silently adopted',async()=>{
 const state=blank(),store=new MemoryStore({...importWorkspace({},state),[CACHE]:{schema:1,accountId:2,revision:1,local:state,cloud:state}});let calls=0;
 const sync=new MouseConfigSync({store,account:{snapshot:()=>({accountId:3}),request:async()=>{calls++;throw Error();}}});
 await sync.tick();assert.equal(calls,0);assert.equal(store.value[CACHE].accountId,2);assert.equal(sync.state().phase,'error');
});

test('cloud metadata import preserves excluded local tabs, bookmark URLs and unsynchronized local preferences',()=>{
 const state=blank(),id=randomUUID(),documentTab={id,url:'file:///private/local.pdf',lane:'main'},data=importWorkspace({},state);
 data.browserSessions={[PROJECT]:[documentTab]};data.mouseDesktopsV1.members[id]=state.desktops.active;
 data.quadroPreferences.localOnlyPreference='kept locally';data.quadroLibrary.bookmarks=[{id:'local-bookmark',url:'file:///private/local.pdf',title:'local',at:1}];
 const imported=importWorkspace(data,state);assert.deepEqual(imported.browserSessions[PROJECT],[documentTab]);assert.equal(imported.quadroPreferences.localOnlyPreference,'kept locally');assert.equal(imported.quadroLibrary.bookmarks[0].url,documentTab.url);
 const exported=JSON.stringify(exportWorkspace(imported));assert(!exported.includes('file:'));assert(!exported.includes('kept locally'));assert(!exported.includes('local.pdf'));
});
