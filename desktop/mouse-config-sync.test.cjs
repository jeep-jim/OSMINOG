'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {exportWorkspace,importWorkspace,mergeWorkspace,MouseConfigSync,CACHE,PROJECT}=require('./mouse-config-sync.cjs');
const {validateSyncState,MAX_BYTES}=require('./mouse-sync-schema.cjs');
const L=require('./mouse/layout.js');
const clone=x=>structuredClone(x),blank=()=>exportWorkspace({});
const bookmark=(title='Mouse')=>({id:randomUUID(),url:'https://mouse.black/',title,at:1});
class MemoryStore{constructor(value={}){this.value=clone(value);}async get(){return clone(this.value);}async set(changes){Object.assign(this.value,clone(changes));}}
function account(remote,id=2){return{snapshot:()=>({accountId:id}),request:async(method,route,body)=>{assert.equal(route,'/sync');if(method==='GET')return clone(remote);if(body.revision!==remote.revision)throw Object.assign(Error(),{status:409});remote.revision++;remote.state=validateSyncState(body.state);return clone(remote);}};}

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
