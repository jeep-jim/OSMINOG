'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {install}=require('./mouse-adblock-subscriptions-ipc.cjs');
function fixture(){
 const handlers=new Map(),calls=[];let privateMode=false;
 const service={state:()=>({enabled:true,subscriptions:[]})};
 for(const name of ['manualRefresh','addSubscription','setSubscriptionEnabled','removeSubscription'])service[name]=async(...args)=>{args.at(-1).guard();calls.push({name,args:args.slice(0,-1)});};
 install({ipcMain:{handle:(channel,fn)=>handlers.set(channel,fn)},trusted:event=>{if(!event.trusted)throw Error('Untrusted');},service,isPrivate:()=>privateMode});
 return{calls,service,command:(action,args,trusted=true)=>handlers.get('mouse:adblock-subscriptions')({trusted},action,args),privacy:value=>{privateMode=value;}};
}
test('only trusted shell IPC can read subscriptions or invoke a supported command',async()=>{
 const f=fixture();await assert.rejects(f.command('state',{},false),/Untrusted/);await assert.rejects(f.command('refresh',{},false),/Untrusted/);await assert.rejects(f.command('execute',{code:'anything'}),/Неизвестная/);assert.deepEqual(f.calls,[]);
});
test('subscription commands pass bounded fields to their service and return the fresh state',async()=>{
 const f=fixture();await f.command('add',{url:'https://filters.example/list.txt',name:'Mine',ignored:'not forwarded'});await f.command('toggle',{id:'custom-1',enabled:false});await f.command('refresh',{id:'easylist'});await f.command('remove',{id:'custom-1'});
 assert.deepEqual(f.calls,[{name:'addSubscription',args:[{url:'https://filters.example/list.txt',name:'Mine'}]},{name:'setSubscriptionEnabled',args:['custom-1',false]},{name:'manualRefresh',args:['easylist']},{name:'removeSubscription',args:['custom-1']}]);assert.equal((await f.command('state')).privateMode,false);
});
test('incognito permits inspecting inherited subscriptions but no persistent change or manual download',async()=>{
 const f=fixture();f.privacy(true);assert.equal((await f.command('state')).privateMode,true);for(const action of ['add','toggle','remove','refresh'])await assert.rejects(f.command(action,{}),/обычном режиме/);assert.deepEqual(f.calls,[]);
});
test('service receives a live privacy guard for a queued mutation',async()=>{
 const f=fixture();let guard;
 f.service.addSubscription=async(_args,options)=>{guard=options.guard;};await f.command('add',{url:'https://filters.example/list.txt'});f.privacy(true);assert.throws(guard,/обычном режиме/);
});
test('invalid IPC parameter containers are rejected before the service',async()=>{
 const f=fixture();for(const args of [null,[],true,5,'text'])await assert.rejects(f.command('add',args),/Некорректные/);assert.deepEqual(f.calls,[]);
});
test('real subscription service accepts normal IPC guards, persists while off and denies private mutations',async t=>{
 const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{MouseAdBlock}=require('./mouse-adblock.cjs');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-subscription-ipc-')),handlers=new Map();let privateMode=false,downloads=0;
 const service=new MouseAdBlock({directory,bundledDirectory:false,isPrivate:()=>privateMode,fetchList:async source=>{downloads++;return{status:200,text:'[Adblock Plus 2.0]\n! Owned IPC integration fixture\n'+Array.from({length:60},(_,i)=>'||ad'+i+'.'+source.id+'.invalid^').join('\n')+'\n',etag:'"owned-ipc-v1"',lastModified:null};}});
 t.after(async()=>{service.dispose();await service.flush();await service.preparing;await service.inFlight;await fs.rm(directory,{recursive:true,force:true});});
 await service.initialize(false);install({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},trusted:event=>{if(!event.trusted)throw Error('Untrusted');},service,isPrivate:()=>privateMode});
 const command=(action,args)=>handlers.get('mouse:adblock-subscriptions')({trusted:true},action,args),config=()=>fs.readFile(path.join(directory,'subscriptions.json'),'utf8');
 let result=await command('add',{url:'https://filters.example.org/owned-ipc.txt'});const custom=result.subscriptions.find(item=>!item.builtin);assert.ok(custom);assert.equal(result.enabled,false);assert.equal(downloads,0);assert.equal(JSON.parse(await config()).custom[0].id,custom.id);
 result=await command('toggle',{id:custom.id,enabled:false});assert.equal(result.subscriptions.find(item=>item.id===custom.id).enabled,false);await command('toggle',{id:custom.id,enabled:true});assert.equal(downloads,0,'Saving list preferences while off never contacts a source');
 service.setEnabled(true);await service.refresh();assert.equal(downloads,3);assert.ok(service.state().subscriptions.every(item=>item.origin==='cache'));
 const beforeRefresh=downloads;result=await command('refresh',{id:custom.id});assert.equal(downloads,beforeRefresh+1);assert.equal(result.subscriptions.find(item=>item.id===custom.id).phase,'ready');
 const beforePrivate=await config(),privateDownloads=downloads;privateMode=true;assert.equal((await command('state')).privateMode,true);
 for(const [action,args]of [['add',{url:'https://filters.example.org/private.txt'}],['toggle',{id:custom.id,enabled:false}],['remove',{id:custom.id}],['refresh',{}]])await assert.rejects(command(action,args),/обычном режиме/);
 assert.equal(await config(),beforePrivate);assert.equal(downloads,privateDownloads);
 privateMode=false;result=await command('remove',{id:custom.id});assert.equal(result.subscriptions.some(item=>item.id===custom.id),false);assert.deepEqual(JSON.parse(await config()).custom,[]);
 // The queue can yield after the IPC's first guard. Entering private mode
 // before that work runs still must prevent the real persistence operation.
 let release;service.queue=new Promise(resolve=>{release=resolve;});const queued=command('add',{url:'https://filters.example.org/queued.txt'});privateMode=true;release();await assert.rejects(queued,/обычном режиме/);assert.deepEqual(JSON.parse(await config()).custom,[]);
});
