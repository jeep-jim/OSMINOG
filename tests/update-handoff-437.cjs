'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),KEY='briefCraftReopenAfterUpdateV1';
const editor='chrome-extension://fixture/editor.html';
function fixture({normal=true}={}) {
  const data={},calls=[],handlers={},timers=[];
  let running='4.0.36',disk='4.0.37',storageFailure=false,next=10;
  const tabs=new Map([[3,{id:3,windowId:1,url:editor}],[4,{id:4,windowId:2,url:'https://example.com/unfinished-form'}]]);
  const event=name=>({addListener:fn=>handlers[name]=fn});
  const chrome={
    runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,getManifest:()=>({name:'OSMINOG',version:running,key:'fixed'}),
      onMessage:event('message'),onInstalled:event('installed'),onStartup:event('startup'),reload:()=>calls.push(['reload'])},
    storage:{local:{get:async k=>({[k]:structuredClone(data[k])}),set:async values=>{if(storageFailure)throw Error('storage unavailable');Object.assign(data,structuredClone(values))},remove:async k=>delete data[k]}},
    tabs:{get:async id=>{if(!tabs.has(id))throw Error('closed');return {...tabs.get(id)}},query:async q=>[...tabs.values()].filter(t=>!q?.windowId||t.windowId===q.windowId),
      create:async args=>{const t={id:next++,windowId:args.windowId||2,...args};tabs.set(t.id,t);calls.push(['create',t]);return {...t}},
      update:async(id,args)=>{Object.assign(tabs.get(id),args);calls.push(['update',id,args]);return {...tabs.get(id)}},
      remove:async id=>{calls.push(['remove',id]);tabs.delete(id)},onRemoved:event('removed')},
    windows:{getAll:async()=>normal?[{id:2,type:'normal',focused:true}]:[],
      create:async args=>{calls.push(['window',args]);const tab={id:next++,windowId:7,url:args.url};tabs.set(tab.id,tab);return{id:7,tabs:[tab]}}}
  };
  const context=vm.createContext({chrome,crypto,Date,console:{warn(){}},fetch:async()=>({ok:true,json:async()=>({name:'OSMINOG',version:disk,key:'fixed'})}),
    setTimeout:fn=>{timers.push(fn);return fn},clearTimeout:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1)}});
  vm.runInContext(fs.readFileSync(path.join(root,'osminog-update-handoff.js'),'utf8'),context);
  return {api:context.OSMINOGUpdateHandoff,data,calls,tabs,handlers,
    setRunning:v=>running=v,setDisk:v=>disk=v,failStorage:()=>storageFailure=true,
    recovery:()=>vm.runInContext(fs.readFileSync(path.join(root,'osminog-update-recovery.js'),'utf8'),context),
    async step(){const fn=timers.shift();if(fn)await fn();await new Promise(r=>setImmediate(r))},
    async ready(id=3,version=running){return new Promise(resolve=>{const accepted=handlers.message({type:'OSMINOG_EDITOR_READY',version},{id:'fixture',url:editor,tab:{id}},resolve);if(!accepted)resolve(null)})}
  };
}
test('last extension popup receives a normal guard window before reload; duplicate preparation reuses it',async()=>{
  const f=fixture({normal:false});
  const [a,b]=await Promise.all([f.api.prepare({from:'4.0.36',to:'4.0.37'}),f.api.prepare({from:'4.0.36',to:'4.0.37'})]);
  assert.equal(a.request.requestId,b.request.requestId);
  assert.equal(f.calls.filter(x=>x[0]==='window').length,1);
  assert.equal(f.data[KEY].to,'4.0.37');assert.equal(f.data[KEY].phase,'ready-to-reload');
  await f.api.prepare({from:'4.0.36',to:'4.0.37'});
  assert.equal(f.calls.filter(x=>x[0]==='window').length,1);
  assert.equal(f.calls.filter(x=>x[0]==='reload').length,0,'helper must not reload before its caller receives durable acknowledgement');
});
test('an uncommitted/mismatched disk manifest cannot create tabs or arm reload',async()=>{
  const f=fixture();f.setDisk('4.0.36');
  await assert.rejects(f.api.prepare({from:'4.0.36',to:'4.0.37'}),/не готовы/);
  assert.deepEqual(f.calls,[]);assert.equal(f.data[KEY],undefined);
});
test('failed marker persistence removes only the newly created blank guard',async()=>{
  const f=fixture();f.failStorage();await assert.rejects(f.api.prepare({from:'4.0.36',to:'4.0.37'}),/storage unavailable/);
  assert(f.tabs.has(3));assert(f.tabs.has(4));assert.equal(f.tabs.size,2);
  assert.equal(f.calls.filter(x=>x[0]==='remove').length,1);
});
test('old version ready acknowledgement cannot consume the target version handoff',async()=>{
  const f=fixture();await f.api.prepare({from:'4.0.36',to:'4.0.37'});f.recovery();
  const before=f.calls.length;await f.step();await f.ready(3,'4.0.36');
  assert(f.data[KEY]);assert.equal(f.calls.length,before);
});
test('target ready editor clears the handoff and only the unused guard; ordinary form tab survives',async()=>{
  const f=fixture();const {request}=await f.api.prepare({from:'4.0.36',to:'4.0.37'});
  f.tabs.delete(3);f.setRunning('4.0.37');f.recovery();await f.step();
  const restored=[...f.tabs.values()].find(t=>t.url===editor);assert(restored);
  await f.ready(restored.id,'4.0.37');
  assert.equal(f.data[KEY],undefined);assert(!f.tabs.has(request.guardTabId));
  assert.equal(f.tabs.get(4).url,'https://example.com/unfinished-form');assert(f.tabs.has(restored.id));
});
test('a guard navigated by the user is never closed after editor readiness',async()=>{
  const f=fixture();const {request}=await f.api.prepare({from:'4.0.36',to:'4.0.37'});
  f.tabs.get(request.guardTabId).url='https://example.com/new-work';
  f.setRunning('4.0.37');f.recovery();await f.step();await f.ready(3,'4.0.37');
  assert(f.tabs.has(request.guardTabId));assert.equal(f.calls.filter(x=>x[0]==='remove').length,0);
});

test('finishing a staged update after the old marker expires renews it without creating another guard',async()=>{
  const f=fixture();const first=await f.api.prepare({from:'4.0.36',to:'4.0.37'});
  f.data[KEY].at=Date.now()-700000;
  const next=await f.api.prepare({from:'4.0.36',to:'4.0.37'});
  assert.equal(next.request.guardTabId,first.request.guardTabId);
  assert.notEqual(next.request.requestId,first.request.requestId);
  assert(Date.now()-next.request.at<1000);
  f.setRunning('4.0.37');f.recovery();await f.step();await f.ready(3,'4.0.37');
  assert.equal(f.data[KEY],undefined);
});
