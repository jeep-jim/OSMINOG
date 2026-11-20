'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {TileSearch}=require('./mouse-tile-search.cjs');
const result=(id)=>({id,url:'https://example.com/'+id,title:'Site '+id,type:'article'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const captureRecord=(id)=>({id,visible:true,navigationEpoch:1,bounds:{x:20,y:100,width:120,height:160},view:{webContents:{isDestroyed:()=>false,capturePage:async()=>({isEmpty:()=>false,getSize:()=>({width:120,height:160}),toPNG:()=>Buffer.from('owned captured bitmap')})}}});
function setup({query,summary,chat}={}){
 const log=[],sent=[],registered=new Map(),shell=new EventEmitter();shell.send=(channel,value)=>sent.push({channel,value});shell.isDestroyed=()=>false;
 const win=new EventEmitter();Object.assign(win,{webContents:shell,isDestroyed:()=>false,isMinimized:()=>false});
 const browser={tabs:new Map([['original',{id:'original'}]]),providers:new Map(),mouseDesktops:{bank:{active:'desk-3'}},layout:panels=>log.push(['ordinary-layout',panels]),command:async(action,args)=>{log.push(['browser-command',action,args]);return{id:'opened-result'};}};
 const gate={blocked:false,set(value){this.blocked=value.blocked;log.push(['gate',this.blocked]);return{blocked:this.blocked};}};
 let privateMode=false,visionActive=false,serviceOptions;
 const service={state:()=>({configured:true}),query:query||(async args=>({...args,results:[result('one')],hasMore:true})),summarize:summary||(async()=>({text:'A fixture summary'})),chat:chat||(async()=>({text:'A fixture answer'})),cancel:id=>log.push(['cancel',id]),cancelAll:()=>log.push(['cancel-all']),dispose:()=>log.push(['service-dispose'])};
 const views=new EventEmitter();Object.assign(views,{state:()=>({pages:[]}),setResults(rows,{revision}){assert.ok(revision>=1);this.rows=rows.slice();this.revision=revision;log.push(['results',rows.map(r=>r.id),revision]);},layout:packet=>{log.push(['search-layout',packet]);return{liveCount:1};},suspend:reason=>log.push(['suspend',reason]),resume:()=>log.push(['resume']),close:reason=>log.push(['views-close',reason]),dispose:()=>log.push(['views-dispose']),capturePages:()=>[],resultURL(id){return this.rows.find(row=>row.id===id)?.url;}});
 const vision={state:()=>({active:visionActive,targetId:'one'}),start:async({id,consent})=>{assert.equal(consent,true);visionActive=true;log.push(['vision-start',id]);return{active:true};},stop:reason=>{visionActive=false;log.push(['vision-stop',reason]);return Promise.resolve({active:false});},snapshot:async()=>({elements:[],scope:'selected-main-frame'}),dispose:()=>log.push(['vision-dispose'])};
 const controller=new TileSearch({app:{getPath:()=>'/tmp/fixture-search'},win,browser,overlayGate:gate,isPrivate:()=>privateMode,serviceFactory:options=>{serviceOptions=options;return service;},viewsFactory:()=>views,visionFactory:()=>vision,powerMonitor:new EventEmitter(),ipcMain:{handle:(channel,handler)=>registered.set(channel,handler),removeHandler:channel=>registered.delete(channel)},trusted:event=>{if(event.trusted!==true)throw Error('Untrusted frame');}});
 return{controller,log,sent,registered,browser,gate,views,vision,service,serviceOptions,setPrivate:value=>{privateMode=value;}};
}
test('clearing an empty query removes native results immediately and invalidates outstanding answers without closing the workspace',async()=>{
 const answer=deferred(),f=setup({summary:()=>answer.promise});f.controller.open();await f.controller.search({query:'before clearing',requestId:'before'});await f.controller.handle('vision-start',{id:'one',revision:f.controller.revision,consent:true});const oldRevision=f.controller.revision;
 const cleared=await f.controller.handle('clear');assert.equal(cleared.cleared,true);assert.ok(cleared.revision>oldRevision);assert.equal(f.controller.active,true);assert.deepEqual(f.views.rows,[]);assert.deepEqual(f.controller.results,[]);assert.equal(f.vision.state().active,false);assert.equal(f.controller.query,'');assert.deepEqual([...f.browser.tabs.keys()],['original']);
 answer.resolve({text:'Late answer must remain cancelled'});await new Promise(setImmediate);assert.equal(f.sent.some(row=>row.value.kind==='summary'),false);f.controller.dispose();
});
test('cancelling a completed query also cancels its in-flight automatic summary',async()=>{
 const answer=deferred(),f=setup({summary:()=>answer.promise});f.controller.open();await f.controller.search({query:'summary cancellation',requestId:'q'});await f.controller.handle('cancel',{requestId:'q'});answer.resolve({text:'Late summary'});await new Promise(setImmediate);
 assert.ok(f.log.some(row=>row[0]==='cancel'&&row[1]==='q-summary'));assert.equal(f.sent.some(row=>row.value.kind==='summary'),false);f.controller.dispose();
});
test('overlay snapshots include every stable visible native page and never declare a partial set complete',async()=>{
 const f=setup();f.controller.open();const records=[captureRecord('one'),captureRecord('two')];f.views.capturePages=()=>records;
 const complete=await f.controller.prepareOverlay();assert.equal(complete.complete,true);assert.deepEqual(complete.expectedIds,['one','two']);assert.deepEqual(complete.pages.map(row=>row.bounds),records.map(row=>row.bounds));assert.equal(complete.pages.length,2);
 records[1].view.webContents.capturePage=async()=>{throw Error('Native page unavailable');};await assert.rejects(f.controller.prepareOverlay(),/Native page unavailable/);
 const pendingImage=deferred();records[1].view.webContents.capturePage=()=>pendingImage.promise;const stale=f.controller.prepareOverlay(),rejected=assert.rejects(stale,/изменился/);records[1].navigationEpoch++;pendingImage.resolve({isEmpty:()=>false,getSize:()=>({width:120,height:160}),toPNG:()=>Buffer.from('old bitmap')});await rejected;
 f.gate.set({blocked:true});assert.deepEqual(await f.controller.prepareOverlay(),{revision:f.controller.revision,complete:false,skipped:true,pages:[]});f.controller.dispose();
});
test('opening search holds ordinary pages without changing saved desk membership, and closing restores the normal layout path',async()=>{
 const f=setup(),original=f.browser.tabs.get('original');f.controller.open();assert.ok(f.controller.revision>=1);f.browser.layout([{id:'original'}]);assert.deepEqual(f.log.filter(r=>r[0]==='ordinary-layout').at(-1),['ordinary-layout',[]]);
 const found=await f.controller.handle('query',{query:'real request',page:1,requestId:'q1'});assert.equal(found.results[0].id,'one');assert.deepEqual([...f.browser.tabs.keys()],['original']);assert.equal(f.browser.tabs.get('original'),original);assert.equal(f.browser.mouseDesktops.bank.active,'desk-3');
 f.controller.close();f.browser.layout([{id:'original'}]);assert.deepEqual(f.log.filter(r=>r[0]==='ordinary-layout').at(-1),['ordinary-layout',[{id:'original'}]]);f.controller.dispose();assert.equal(f.registered.size,0);
});
test('an older network reply cannot replace a later query or cross a close and reopen boundary even when transport cancellation is late',async()=>{
 const first=deferred(),second=deferred();let calls=0;const f=setup({query:args=>++calls===1?first.promise:second.promise});f.controller.open();
 const old=f.controller.search({query:'old',requestId:'old'}),oldRejected=assert.rejects(old,/отменён/);const current=f.controller.search({query:'new',requestId:'new'});
 second.resolve({results:[result('new')],hasMore:false});await current;first.resolve({results:[result('old')],hasMore:false});await oldRejected;assert.deepEqual(f.controller.results.map(r=>r.id),['new']);
 const late=deferred();f.service.query=()=>late.promise;const pending=f.controller.search({query:'closed',requestId:'closing'}),rejected=assert.rejects(pending,/отменён/);f.controller.close();f.controller.open();late.resolve({results:[result('late')],hasMore:true});await rejected;assert.deepEqual(f.controller.results,[]);f.controller.dispose();
});
test('pagination is revision-bound, deduplicated, and explicit open uses the authoritative registered URL',async()=>{
 const f=setup({query:async args=>({results:args.page===1?[result('one')]:[result('one'),result('two')],hasMore:args.page===1})});f.controller.open();const one=await f.controller.search({query:'topic',page:1,requestId:'p1'});
 await assert.rejects(f.controller.search({query:'topic',page:2,revision:one.revision-1,requestId:'stale'}),/изменились/);
 const two=await f.controller.search({query:'topic',page:2,revision:one.revision,requestId:'p2'});assert.deepEqual(two.results.map(r=>r.id),['two']);assert.equal(two.hasMore,false);
 await assert.rejects(f.controller.handle('open-result',{id:'not-owned',url:'https://attacker.example'}),/недоступен/);
 await f.controller.handle('open-result',{id:'two',url:'https://attacker.example'});assert.deepEqual(f.log.find(r=>r[0]==='browser-command'),['browser-command','open',{url:'https://example.com/two',lane:'main'}]);assert.equal(f.controller.active,false);f.controller.dispose();
});
test('modal and privacy barriers hide native search pages and revoke selected-page observation',async()=>{
 const f=setup();f.controller.open();await f.controller.search({query:'topic',requestId:'q'});await f.controller.handle('vision-start',{id:'one',consent:true,revision:f.controller.revision});f.log.length=0;
 f.gate.set({blocked:true});assert.equal(f.log[0][0],'suspend');assert.equal(f.vision.state().active,false);assert.deepEqual(f.log.filter(r=>r[0]==='ordinary-layout').at(-1),['ordinary-layout',[]]);
 f.gate.set({blocked:false});assert.equal(f.log.at(-1)[0],'resume');f.setPrivate(true);await assert.rejects(f.controller.handle('query',{query:'secret'}),/обычном/);f.controller.close('private',{reset:true});assert.deepEqual(f.controller.results,[]);assert.equal(f.controller.query,'');f.controller.dispose();
});
test('untrusted IPC cannot query or open native pages, and provider credentials are not exposed in state',async()=>{
 const f=setup(),ipc=f.registered.get('mouse:tile-search');assert.throws(()=>ipc({trusted:false},'open',{}),/Untrusted/);await ipc({trusted:true},'open',{});
 await assert.rejects(ipc({trusted:true},'query',{query:'x'.repeat(150000)}),/Invalid/);await assert.rejects(ipc({trusted:true},'configure',{endpoint:'http://127.0.0.1/'}),/Неизвестная/);
 assert.equal(await f.serviceOptions.getSessionToken(),'');await f.serviceOptions.setSessionToken('fixture-secret');assert.ok(!JSON.stringify(f.controller.state()).includes('fixture-secret'));assert.throws(()=>f.controller.configureFixtureService({endpoint:'http://127.0.0.1/'}),/isolated/);f.controller.dispose();
});
test('an old chat completion cannot unlock or overwrite a newer search conversation',async()=>{
 const old=deferred(),next=deferred();let count=0;const f=setup({chat:()=>++count===1?old.promise:next.promise});f.controller.open();await f.controller.search({query:'first',requestId:'q1'});
 const first=f.controller.chat({message:'first question',revision:f.controller.revision,requestId:'c1'}),rejected=assert.rejects(first,/закрыт/);await f.controller.search({query:'second',requestId:'q2'});const second=f.controller.chat({message:'second question',revision:f.controller.revision,requestId:'c2'});
 old.resolve({text:'obsolete'});await rejected;assert.equal(f.controller.chatPending,true);next.resolve({text:'current'});assert.equal((await second).text,'current');assert.deepEqual(f.controller.history,[{role:'user',content:'second question'},{role:'assistant',content:'current'}]);f.controller.dispose();
});
