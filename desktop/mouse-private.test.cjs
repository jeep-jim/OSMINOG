'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {MemoryStore,installIPCSwitch,clearPrivateSession}=require('./mouse-private-core.cjs');
test('private store is cloned, memory-only, and rejects late retention after destruction',async()=>{
 const source={preferences:{theme:'dark'}},s=new MemoryStore(source);source.preferences.theme='wrong';assert.equal((await s.get('preferences')).preferences.theme,'dark');
 await s.set({secret:'private-marker'});s.destroy();await s.set({secret:'late'});assert.deepEqual(await s.get('secret'),{});assert.deepEqual(s.data,{});
 assert.doesNotMatch(fs.readFileSync(require.resolve('./mouse-private-core.cjs'),'utf8'),/require\(['"](?:node:)?fs/);
});
test('private host routes do not fall through into normal privileged storage handlers',async()=>{
 const callbacks=new Map(),ipc={handle:(name,fn)=>callbacks.set(name,fn)},shell={},guest={};
 const router=installIPCSwitch(ipc,()=>shell);ipc.handle('save',()=> 'normal');ipc.handle('wallet',()=> 'secret-normal-vault');
 router.use(new Map([['save',()=> 'memory']]));assert.equal(callbacks.get('save')({sender:shell}),'memory');assert.throws(()=>callbacks.get('wallet')({sender:shell}),/инкогнито/);
 router.use(null);assert.equal(callbacks.get('save')({sender:shell}),'normal');
});
test('private cleanup clears storage, cache, auth, resolver and network; no silent success',async()=>{
 const names=['clearStorageData','clearCache','clearAuthCache','clearHostResolverCache','closeAllConnections'],seen=[];
 await clearPrivateSession(Object.fromEntries(names.map(n=>[n,async()=>seen.push(n)])));assert.deepEqual(seen.sort(),names.sort());
 await assert.rejects(()=>clearPrivateSession(Object.fromEntries(names.map(n=>[n,async()=>{if(n==='clearCache')throw Error('fixture');}]))),/очистить/);
});
test('incognito page excludes wallet provider and custom wallpaper writes',()=>{
 const preload=fs.readFileSync(require.resolve('./mouse-page-preload.cjs'),'utf8');assert.doesNotMatch(preload,/ethereum|wallet|executeJavaScript|eval\(/);
 for(const isMainFrame of [true,false]){
  const bridges=[],listeners=[],calls=[];
  const electron={contextBridge:{exposeInMainWorld:(name,api)=>bridges.push({name,api})},ipcRenderer:{invoke:(channel,args)=>{calls.push({channel,args:structuredClone(args)});return Promise.resolve();}}};
  require('node:vm').runInNewContext(preload,{process:{isMainFrame},require(name){assert.equal(name,'electron');return electron;},document:{addEventListener:name=>listeners.push(name)}},{timeout:1000});
  assert.deepEqual(bridges.map(b=>b.name),isMainFrame?['MouseAgent']:[]);assert.deepEqual(listeners,isMainFrame?['dragstart']:[]);
  if(isMainFrame){const api=bridges[0].api;assert.deepEqual(Object.keys(api),['updateProgress']);assert.equal(Object.isFrozen(api),true);api.updateProgress(null,'Waiting',{taskId:'own-task',sourceId:'another-page',privateMode:false,channel:'mouse:save',file:'/private/path'});assert.deepEqual(calls,[{channel:'mouse:page-progress',args:{percent:null,statusText:'Waiting',taskId:'own-task'}}]);}else assert.deepEqual(calls,[]);
 }
 assert.match(fs.readFileSync(require.resolve('./mouse-start.cjs'),'utf8'),/if\(privateMode\)throw Error/);
 const s=fs.readFileSync(require.resolve('./mouse-private.cjs'),'utf8');assert.match(s,/cache:false/);assert.match(s,/ses.isPersistent/);assert.match(s,/loadURL\('about:blank'\)/);
});
test('owner mascot keeps exact source, has no invented name; capture flash is not painted into PNG',()=>{
 assert.equal(require('./mouse-brand.cjs').mascot,'маскот');const script=fs.readFileSync(require.resolve('./mouse/capture.js'),'utf8');assert.match(script,/if\(kind!=='initial'\)feedback/);assert.match(script,/dataset.captured/);assert.doesNotMatch(script,/ctx.fill.*flash/i);
 const svg=fs.readFileSync(require.resolve('./mouse/mouse-private.svg'),'utf8');assert.match(svg,/shape-rendering="crispEdges"/);assert.doesNotMatch(svg,/<script|https?:\/\/[^w]/);
});

test('privacy completion notifies observers only after the transition is no longer busy, including failure',async()=>{
 const {PrivateMode}=require('./mouse-private.cjs'),states=[];const mode=new PrivateMode({onPrivacySettled:()=>states.push({busy:mode.busy,private:!!mode.current})});
 mode.enter=async()=>{assert.equal(mode.busy,true);mode.current={};};mode.leave=async()=>{assert.equal(mode.busy,true);mode.current=null;};
 await mode.toggle();await mode.toggle();assert.deepEqual(states,[{busy:false,private:true},{busy:false,private:false}]);
 mode.enter=async()=>{throw Error('Fixture transition failed');};await assert.rejects(mode.toggle(),/Fixture transition failed/);assert.deepEqual(states.at(-1),{busy:false,private:false});assert.equal(mode.busy,false);
});
