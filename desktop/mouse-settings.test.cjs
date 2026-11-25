'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {KEY,DEFAULTS,normalize,patch,install}=require('./mouse-settings.cjs');
async function fixture(saved={},write,onChange){const handlers=new Map(),events=[],writes=[];let privateMode=false;const service=await install({store:{get:async()=>({[KEY]:saved}),set:async value=>{if(write)await write(value);writes.push(structuredClone(value));}},win:{isDestroyed:()=>false,webContents:{send:(...args)=>events.push(args)}},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},trusted:event=>{if(!event.trusted)throw Error('Untrusted frame');},isPrivate:()=>privateMode,onChange});return{service,events,writes,command:(...args)=>handlers.get('mouse:settings')({trusted:true},...args),untrusted:(action='set',args={showBrandName:false})=>handlers.get('mouse:settings')({},action,args),privacy:value=>{privateMode=value;}};}
test('old or malformed control settings preserve usable defaults without accepting arbitrary keys',()=>{assert.deepEqual(normalize({restoreAgent:false,downloadBadge:'false',unexpected:true}),DEFAULTS);for(const value of [null,[],{},'yes',{unknown:true},{restoreAgent:1},{__proto__:{restoreAgent:false}}])assert.throws(()=>patch(value));assert.throws(()=>patch({restoreAgent:false}));assert.deepEqual(patch({showBrandName:false}),{showBrandName:false});});
test('settings persist only whitelisted booleans and emit after successful persistence',async()=>{const f=await fixture({showBrandName:false});await f.command('set',{downloadBounce:false});assert.equal(f.service.state().showBrandName,false);assert.equal(f.service.state().downloadBounce,false);assert.equal(f.events[0][0],'mouse:settings-state');assert.deepEqual(f.writes[0][KEY],{...DEFAULTS,showBrandName:false,downloadBounce:false});const copy=f.service.state();copy.showFavicons=false;assert.equal(f.service.state().showFavicons,true);});
test('concurrent setting changes are serialized without losing other switches',async()=>{let release;const waiting=new Promise(r=>release=r);let count=0;const f=await fixture({},async()=>{if(++count===1)await waiting;});const a=f.command('set',{showBrandName:false}),b=f.command('set',{downloadBadge:false});await Promise.resolve();release();await Promise.all([a,b]);assert.equal(f.writes.length,2);assert.equal(f.service.state().showBrandName,false);assert.equal(f.service.state().downloadBadge,false);});
test('a failed write leaves the real setting unchanged and a later change can recover',async()=>{let count=0;const f=await fixture({},async()=>{if(++count===1)throw Error('disk unavailable');});await assert.rejects(f.command('set',{showFavicons:false}),/disk unavailable/);assert.equal(f.service.state().showFavicons,true);assert.equal(f.events.length,0);await f.service.flush();await f.command('set',{downloadBounce:false});assert.equal(f.service.state().downloadBounce,false);});
test('untrusted and private frames cannot change the normal profile',async()=>{const f=await fixture();await assert.rejects(f.untrusted(),/Untrusted/);f.privacy(true);assert.equal((await f.command('state')).privateMode,true);await assert.rejects(f.command('set',{desktopGestures:false}),/обычном режиме/);assert.equal(f.writes.length,0);assert.equal(f.service.state().desktopGestures,true);});

test('retired Agent settings cannot reappear from an old profile or be written through IPC',async()=>{for(const restoreAgent of [true,false]){const f=await fixture({restoreAgent,showFavicons:false});assert.equal(Object.hasOwn(f.service.state(),'restoreAgent'),false);assert.equal(f.service.state().showFavicons,false);await assert.rejects(f.command('set',{restoreAgent:true}));await f.command('set',{downloadBadge:false});assert.equal(Object.hasOwn(f.writes[0][KEY],'restoreAgent'),false);assert.equal(f.writes[0][KEY].showFavicons,false);}});

test('ad blocking is opt-in for new and old profiles, accepting only an explicit boolean',()=>{
 assert.equal(DEFAULTS.blockAds,false);
 for(const saved of [undefined,null,{},[],{blockAds:'true'},{blockAds:1}])assert.equal(normalize(saved).blockAds,false);
 assert.deepEqual(normalize({showBrandName:false,downloadBadge:false}),{...DEFAULTS,showBrandName:false,downloadBadge:false});
 for(const blockAds of [true,false]){assert.equal(normalize({blockAds}).blockAds,blockAds);assert.deepEqual(patch({blockAds}),{blockAds});}
 for(const blockAds of [null,undefined,'false',0,1])assert.throws(()=>patch({blockAds}),/Неизвестная настройка/);
});

test('the live callback observes committed settings and cannot mutate the saved or returned state',async()=>{
 const changes=[];let f;
 f=await fixture({showFavicons:false},undefined,next=>{
  assert.equal(f.writes.at(-1)[KEY].blockAds,next.blockAds);
  assert.equal(f.service.state().blockAds,next.blockAds);
  assert.equal(Object.hasOwn(next,'privateMode'),false);
  changes.push({...next});next.blockAds=!next.blockAds;next.showFavicons=true;
 });
 assert.equal(changes.length,0);
 const enabled=await f.command('set',{blockAds:true});assert.equal(enabled.blockAds,true);assert.equal(enabled.showFavicons,false);
 assert.deepEqual(f.events[0],['mouse:settings-state',enabled]);
 const reopened=await fixture(f.writes.at(-1)[KEY]);assert.equal(reopened.service.state().blockAds,true);
 await f.command('set',{blockAds:false});assert.deepEqual(changes.map(value=>value.blockAds),[true,false]);
 assert.equal(f.service.state().blockAds,false);assert.equal(f.service.state().showFavicons,false);
});

test('a failed ad-blocking save never invokes the live callback and the next write can recover',async()=>{
 let writes=0;const changes=[];
 const f=await fixture({},async()=>{if(++writes===1)throw Error('disk unavailable');},next=>changes.push(next));
 await assert.rejects(f.command('set',{blockAds:true}),/disk unavailable/);
 assert.equal(f.service.state().blockAds,false);assert.equal(changes.length,0);assert.equal(f.events.length,0);
 await f.command('set',{blockAds:true});assert.equal(changes.length,1);assert.equal(changes[0].blockAds,true);
});

test('an observer failure reports the apply error without rolling back a committed setting or poisoning the queue',async()=>{
 let calls=0;const f=await fixture({},undefined,()=>{if(++calls===1)throw Error('observer failed');});
 const result=await f.command('set',{blockAds:true});assert.equal(result.blockAds,true);
 assert.equal(f.writes[0][KEY].blockAds,true);assert.equal(f.service.state().blockAds,true);
 assert.deepEqual(f.events[0],['mouse:settings-state',result]);assert.equal(f.events[1][0],'browser:error');assert.match(f.events[1][1],/Настройки сохранены/);
 await f.command('set',{blockAds:false});await f.service.flush();assert.equal(f.service.state().blockAds,false);
 assert.equal(f.events.filter(event=>event[0]==='browser:error').length,1);
});

test('untrusted and private callers cannot persist or activate ad blocking, while private reads use the normal setting',async()=>{
 const changes=[];const f=await fixture({blockAds:true},undefined,next=>changes.push(next));
 await assert.rejects(f.untrusted('state'),/Untrusted/);
 await assert.rejects(f.untrusted('set',{blockAds:false}),/Untrusted/);
 const waiting=f.command('set',{blockAds:false});f.privacy(true);
 await assert.rejects(waiting,/Режим приватности изменён/);
 const privateState=await f.command('state');assert.equal(privateState.blockAds,true);assert.equal(privateState.privateMode,true);
 await assert.rejects(f.command('set',{blockAds:false}),/обычном режиме/);
 assert.equal(f.writes.length,0);assert.equal(changes.length,0);
});
