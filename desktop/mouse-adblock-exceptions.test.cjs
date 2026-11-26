'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Store}=require('./storage.cjs');
const {KEY,MAX_SITES,normalizeSite,siteFromURL,AdBlockExceptions,install,contextItem}=require('./mouse-adblock-exceptions.cjs');
const memory=seed=>({data:structuredClone(seed||{}),writes:0,async get(key){return{[key]:structuredClone(this.data[key])};},async set(value){this.writes++;Object.assign(this.data,structuredClone(value));}});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
async function service(options={}){const result=new AdBlockExceptions({store:memory(),...options});await result.initialize();return result;}
function page(id,url,project='owned'){
 const wc={getURL:()=>url,isDestroyed:()=>false};return{id,project,title:'Title '+id,url:'https://stale-renderer-value.test/',view:{webContents:wc},navigationEpoch:1,setURL(next){url=next;this.navigationEpoch++;}};
}
function browser(pages){const tabs=new Map(pages.map(p=>[p.id,p]));return{project:'owned',tabs,providers:new Map(),get(id){const p=tabs.get(id);if(!p||p.project!==this.project)throw Error('Not owned');return p;}};}

test('pasted addresses become exact canonical hostnames, preserving IDN, localhost and IP literals',()=>{
 const cases=[['  https://WWW.Example.COM:8443/path?q=private#fragment  ','www.example.com'],['http://Example.COM./','example.com'],['example.com:8080/path','example.com'],['localhost:3000/path','localhost'],['localhost','localhost'],['https://ПРИМЕР.РФ/путь','xn--e1afmkfd.xn--p1ai'],['例え.テスト','xn--r8jz45g.xn--zckzah'],['http://127.0.0.1:1234/page','127.0.0.1'],['http://[0:0:0:0:0:0:0:1]:3000/page','[::1]'],['[2001:db8::1]','[2001:db8::1]'],['2001:db8::1','[2001:db8::1]']];
 for(const [input,expected]of cases)assert.equal(normalizeSite(input),expected,input);
 assert.equal(siteFromURL('example.com'),'');assert.equal(siteFromURL('https://example.com/path'),'example.com');
});
test('malformed addresses, credentials and every non-web scheme are rejected before anything can be persisted',()=>{
 const cases=[null,undefined,1,{},[],true,'','   ','//example.com','https:example.com','https:/example.com','https:///example.com','https://','http://example.com:','http://example.com:65536','https://a..test','https://-bad.test','https://bad-.test','https://bad_name.test','https://'+('a'.repeat(64))+'.test','https://a.test..','https://user@example.com','https://user:password@example.com','https://@example.com','user@example.com','https://example.com\\@other.test','https://exam\nple.com','https://example.com/with space','https://%65xample.com','https://example.com/%zz','https://[not-an-ip]','https://[fe80::1%25eth0]/','*.example.com','https://*.example.com','https://example.com/'+('x'.repeat(8192))];
 for(const scheme of ['file','ftp','ftps','ws','wss','mailto','tel','javascript','data','about','blob','chrome','chrome-extension','devtools','mouse','custom'])for(const suffix of ['//example.com/','123','text/plain,test'])cases.push(scheme+':'+suffix);
 for(const input of cases)assert.throws(()=>normalizeSite(input),{code:'MOUSE_ADBLOCK_SITE_INVALID'},String(input));
});
test('exemptions include all paths and ports of one exact host without admitting its subdomains or lookalikes',async()=>{
 const s=await service();await s.add('https://Example.com/a?secret=one#two');
 for(const url of ['http://example.com/elsewhere','https://EXAMPLE.com:8443/a','https://example.com./'])assert.equal(s.hasURL(url),true,url);
 for(const url of ['https://www.example.com/','https://ad.example.com/','https://example.com.evil.test/','https://notexample.com/','https://other.test/?next=https://example.com','ws://example.com/','file://example.com/a','https://user@example.com/'])assert.equal(s.hasURL(url),false,url);
 assert.deepEqual(s.effective('https://example.com/',true),{host:'example.com',eligible:true,excluded:true,globalEnabled:true,enabled:false,privateMode:false,canChange:true});
 assert.equal(s.effective('https://other.test/',true).enabled,true);assert.equal(s.effective('https://other.test/',false).enabled,false);
 assert.equal(s.effective('mouse://start',true).eligible,false);
});
test('a real profile restart restores sorted hosts and never stores a pasted URL path, query, title or fragment',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-adblock-sites-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const s=await service({store:new Store(directory)});await s.add('https://z.example/path-secret?query-secret=value#fragment-secret');await s.add('a.example');await s.add('https://z.example/another');
 await s.flush();const raw=await fs.readFile(path.join(directory,'workspace.json'),'utf8');
 assert.deepEqual(JSON.parse(raw)[KEY],{schema:1,hosts:['a.example','z.example']});assert.doesNotMatch(raw,/path-secret|query-secret|fragment-secret|https:|another/);
 const restored=await service({store:new Store(directory)});assert.deepEqual(restored.list(),['a.example','z.example']);assert.equal(restored.hasURL('http://z.example/new'),true);
 await restored.remove('https://z.example/ignored');const third=await service({store:new Store(directory)});assert.deepEqual(third.list(),['a.example']);
});
test('duplicate changes are idempotent and returned lists cannot mutate the live policy',async()=>{
 const store=memory(),s=await service({store});await s.add('example.com');await s.add('https://EXAMPLE.COM/path');await s.remove('missing.test');
 assert.equal(store.writes,1);const state=s.state();state.hosts.push('other.test');state.hosts[0]='evil.test';assert.equal(s.hasURL('https://example.com/'),true);assert.equal(s.hasURL('https://evil.test/'),false);assert.equal(s.revision,1);
});
test('a failed write cannot temporarily allow requests or erase the previous exception and the queue recovers',async()=>{
 const store=memory(),changes=[],s=await service({store,notify:state=>changes.push(state)});await s.add('retained.test');
 const save=store.set.bind(store),started=deferred(),release=deferred();store.set=async()=>{started.resolve();await release.promise;throw Error('Disk full');};
 const adding=s.add('failed.test');await started.promise;assert.equal(s.hasURL('https://failed.test/'),false);release.resolve();await assert.rejects(adding,/Disk full/);
 assert.deepEqual(s.list(),['retained.test']);assert.deepEqual(store.data[KEY].hosts,['retained.test']);assert.equal(changes.length,1);
 await assert.rejects(s.remove('retained.test'),/Disk full/);assert.equal(s.hasURL('https://retained.test/'),true);
 store.set=save;await s.add('next.test');assert.deepEqual(s.list(),['next.test','retained.test']);
});
test('parallel additions and removals serialize without losing another accepted site',async()=>{
 const s=await service();await Promise.all([s.add('a.test'),s.add('b.test'),s.remove('a.test'),s.add('c.test'),s.add('b.test')]);
 assert.deepEqual(s.list(),['b.test','c.test']);assert.deepEqual(s.store.data[KEY].hosts,['b.test','c.test']);assert.equal(s.store.writes,4);
});
test('private mode reads the normal policy but cannot write, including mutations queued before the transition',async()=>{
 let privateMode=false;const store=memory(),s=await service({store,isPrivate:()=>privateMode});await s.add('normal.test');
 privateMode=true;assert.equal(s.hasURL('https://normal.test/'),true);assert.equal(s.state().privateMode,true);
 for(const work of [()=>s.add('private.test'),()=>s.remove('normal.test')])await assert.rejects(work(),{code:'MOUSE_ADBLOCK_SITE_PRIVATE'});
 privateMode=false;const blocker=deferred();s.queue=blocker.promise;const queued=s.add('never-persist-private.test');privateMode=true;blocker.resolve();await assert.rejects(queued,{code:'MOUSE_ADBLOCK_SITE_PRIVATE'});
 assert.equal(store.writes,1);assert.deepEqual(store.data[KEY].hosts,['normal.test']);assert.equal(s.effective('https://normal.test/',true).canChange,false);
 privateMode=false;await s.add('after.test');assert.deepEqual(s.list(),['after.test','normal.test']);
});
test('corrupt or unknown persisted records fail closed and diagnostics do not disclose their data',async()=>{
 for(const record of [{schema:2,hosts:['example.com']},{schema:1,hosts:['*.example.com']},{schema:1,hosts:['https://example.com/private']},{schema:1,hosts:['EXAMPLE.COM']},{schema:1,hosts:['example.com','example.com']},{schema:1,hosts:['user@example.com']},null]){
  const reports=[],store=memory({[KEY]:record}),s=await service({store,report:value=>reports.push(value)});assert.deepEqual(s.list(),[]);assert.deepEqual(reports,['MOUSE_ADBLOCK_EXCEPTIONS_IGNORED']);assert.equal(store.writes,0);
 }
 const store=memory({[KEY]:{schema:1,hosts:Array.from({length:MAX_SITES},(_,i)=>'site'+i+'.test')}}),s=await service({store});await assert.rejects(s.add('overflow.test'),{code:'MOUSE_ADBLOCK_SITE_LIMIT'});assert.equal(store.writes,0);await s.remove('site0.test');await s.add('replacement.test');assert.equal(s.list().length,MAX_SITES);
});

test('trusted IPC selects an actual live tab, ignores cached renderer addresses and rejects unowned or stale targets',async()=>{
 const s=await service(),first=page('a','https://actual.test/private-path'),other=page('b','https://other.test/'),foreign=page('foreign','https://foreign.test/','foreign-project'),local=browser([first,other,foreign]);let current=local,enabled=true,available=true,handler,trustedCalls=0;
 const api=install({service:s,ipcMain:{handle(name,fn){assert.equal(name,'mouse:adblock-exceptions');handler=fn;}},trusted:event=>{trustedCalls++;if(event!=='trusted')throw Error('Untrusted');},getBrowser:()=>current,getEnabled:()=>enabled,isAvailable:()=>available});
 const state=await handler('trusted','state');assert.deepEqual(state.tabs.map(row=>[row.id,row.host]),[['a','actual.test'],['b','other.test']]);assert.ok(state.tabs.every(row=>!Object.hasOwn(row,'url')));
 await assert.rejects(handler('untrusted','add',{url:'evil.test'}),/Untrusted/);await assert.rejects(handler('trusted','add-tab',{tabId:'foreign'}),/Not owned/);
 await handler('trusted','add-tab',{tabId:'a',host:'actual.test'});assert.deepEqual(s.list(),['actual.test']);assert.equal((await handler('trusted','site',{tabId:'a'})).excluded,true);
 first.setURL('https://navigated.test/');await assert.rejects(handler('trusted','add-tab',{tabId:'a',host:'actual.test'}),{code:'MOUSE_ADBLOCK_SITE_CHANGED'});
 const blocker=deferred();s.queue=blocker.promise;const queued=handler('trusted','add-tab',{tabId:'a',host:'navigated.test'});first.setURL('https://changed-before-save.test/');blocker.resolve();await assert.rejects(queued,{code:'MOUSE_ADBLOCK_SITE_CHANGED'});
 assert.deepEqual(s.list(),['actual.test']);enabled=false;await assert.rejects(handler('trusted','set-site',{tabId:'b',blocking:false}),/Сначала включите/);available=false;await assert.rejects(handler('trusted','state'),/переключения/);
 available=true;current=browser([]);assert.deepEqual(api.state().tabs,[]);assert.ok(trustedCalls>=9);
});
test('site IPC applies the global switch and live guard without allowing arbitrary operation keys',async()=>{
 const s=await service(),p=page('a','https://actual.test/'),local=browser([p]);let handler;install({service:s,ipcMain:{handle(_name,fn){handler=fn;}},trusted:()=>{},getBrowser:()=>local,getEnabled:()=>true});
 await handler({},'set-site',{tabId:'a',blocking:false});assert.equal(s.hasURL(p.view.webContents.getURL()),true);
 await handler({},'set-site',{tabId:'a',blocking:true});assert.equal(s.hasURL(p.view.webContents.getURL()),false);
 for(const [action,args]of [['add',{url:'example.com',wildcard:true}],['remove',{host:'example.com',all:true}],['add-tab',{tabId:'a',url:'https://attacker.test/'}],['set-site',{tabId:'a',blocking:'false'}]])await assert.rejects(handler({},action,args));
 assert.deepEqual(s.list(),[]);
});
test('native checkbox targets the whole top-level site and becomes read-only while globally off or private',async()=>{
 let enabled=true,privateMode=false,valid=true;const s=await service({isPrivate:()=>privateMode}),p=page('a','https://news.test/private-path'),args={service:s,wc:p.view.webContents,getEnabled:()=>enabled,valid:()=>valid,locale:'en'};
 let item=contextItem(args);assert.equal(item.id,'mouse-context-adblock');assert.equal(item.type,'checkbox');assert.equal(item.checked,true);assert.equal(item.enabled,true);
 await item.click();assert.deepEqual(s.list(),['news.test']);item=contextItem(args);assert.equal(item.checked,false);await item.click();assert.deepEqual(s.list(),[]);
 item=contextItem(args);p.setURL('https://different.test/');await item.click();assert.deepEqual(s.list(),[]);
 item=contextItem(args);valid=false;await item.click();assert.deepEqual(s.list(),[]);valid=true;
 enabled=false;item=contextItem(args);assert.equal(item.checked,false);assert.equal(item.enabled,false);await item.click();assert.deepEqual(s.list(),[]);
 enabled=true;privateMode=true;item=contextItem(args);assert.equal(item.enabled,false);await item.click();assert.deepEqual(s.list(),[]);
 privateMode=false;p.setURL('mouse://start');item=contextItem(args);assert.equal(item.enabled,false);
});
test('a stale native menu cannot toggle a newer policy and save failures are reported without optimistic changes',async()=>{
 const failures=[],s=await service(),p=page('a','https://news.test/'),args={service:s,wc:p.view.webContents,getEnabled:()=>true,onError:error=>failures.push(error.message)};
 const stale=contextItem(args);await s.add('other.test');await stale.click();assert.deepEqual(s.list(),['other.test']);
 s.store.set=async()=>{throw Error('Write failed');};await contextItem(args).click();assert.deepEqual(failures,['Write failed']);assert.equal(s.hasURL('https://news.test/'),false);
});
