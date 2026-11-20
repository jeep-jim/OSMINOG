'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create,resolve,ENGINES,isSearchURL}=require('./mouse-search.cjs');
function memory(initial={}){
 let data=structuredClone(initial);const writes=[];
 return{writes,get:async()=>structuredClone(data),set:async value=>{writes.push(structuredClone(value));data={...data,...structuredClone(value)};},snapshot:()=>structuredClone(data)};
}
test('clean normal and private workspaces start with Google without writing defaults',async()=>{
 const store=memory(),normal=await create({store}),privateSearch=await create({store,privateMode:true});
 for(const service of [normal,privateSearch]){assert.equal(service.state().engine,'google');assert.equal(service.resolve('mouse query'),'https://www.google.com/search?q=mouse%20query');assert.equal(service.resolve(''),'https://www.google.com/');}
 assert.deepEqual(store.writes,[]);assert.equal(privateSearch.state().private,true);assert.deepEqual(normal.state().engines,ENGINES.map(({id,name})=>({id,name})));
 const state=normal.state();state.engine='yandex';state.engines[0].name='changed';assert.equal(normal.state().engine,'google');assert.equal(normal.state().engines[0].name,'Google');
});
test('normal choice persists, survives restart, and keeps explicit existing choices',async()=>{
 const store=memory({unrelated:{keep:true}}),search=await create({store});await search.set('bing');assert.equal(search.state().engine,'bing');
 assert.deepEqual(store.snapshot(),{unrelated:{keep:true},mouseSearch:{engine:'bing'}});assert.equal((await create({store})).state().engine,'bing');
 for(const initial of [{quadroStartPage:{searchEngine:'duckduckgo'}},{quadroPreferences:{searchEngine:'yandex'}}]){const legacy=memory(initial),migrated=await create({store:legacy});assert.notEqual(migrated.state().engine,'google');await legacy.set({quadroStartPage:{background:'dusk'},quadroPreferences:{theme:'dark'}});assert.equal((await create({store:legacy})).state().engine,migrated.state().engine);}
 assert.equal((await create({store:memory({mouseSearch:{engine:'unknown'},quadroStartPage:{searchEngine:'invalid'}})})).state().engine,'google');
 assert.throws(()=>search.set('https://arbitrary.test/?q='),/Неизвестный/);assert.equal(search.state().engine,'bing');
});
test('private selection is RAM-only, survives the service lifetime, and resets on re-entry',async()=>{
 const normalStore=memory(),normal=await create({store:normalStore});await normal.set('bing');const before=normalStore.snapshot();
 const forbiddenStore={get(){throw Error('private search must not read persistent settings');},set(){throw Error('private search must not persist');}};
 const first=await create({store:forbiddenStore,privateMode:true,inheritedEngine:normal.state().engine});assert.equal(first.state().engine,'bing');await first.set('duckduckgo');await first.flush();
 assert.equal(first.state().engine,'duckduckgo');assert.equal(first.resolve('private marker'),'https://duckduckgo.com/?q=private%20marker');assert.deepEqual(normalStore.snapshot(),before);assert.equal(normal.state().engine,'bing');
 const second=await create({store:forbiddenStore,privateMode:true,inheritedEngine:normal.state().engine});assert.equal(second.state().engine,'bing');
});
test('search URL resolution preserves direct websites and rejects privileged or credentialed addresses',()=>{
 const expected={google:'https://www.google.com/search?q=',bing:'https://www.bing.com/search?q=',duckduckgo:'https://duckduckgo.com/?q=',yandex:'https://yandex.ru/search/?text='};
 const query='тест & a+b # 25%';
 for(const {id}of ENGINES){assert.equal(resolve(query,id),expected[id]+encodeURIComponent(query));assert.equal(resolve('example.com/path?q=hello',id),'https://example.com/path?q=hello');assert.equal(resolve('http://127.0.0.1:1234/fixture',id),'http://127.0.0.1:1234/fixture');assert.equal(resolve('https://www.google.com/search?q=explicit',id),'https://www.google.com/search?q=explicit');}
 for(const input of ['file:///etc/passwd','javascript:alert(1)','mouse://agent','data:text/html,hello','https://user:password@example.com/','https://user@example.com/','a'.repeat(8193)])assert.throws(()=>resolve(input));
});
test('query history whitelist requires the exact generated origin, path, parameter and query',()=>{
 for(const {id}of ENGINES){const url=resolve('history marker',id);assert.equal(isSearchURL('history marker',url),true);for(const bad of [url+'&redirect=1',url+'#fragment',url.replace('https:','http:'),url.replace('history%20marker','other'),url.replace('/search?','/other?'),url.replace('https://','https://user@')].filter(v=>v!==url))assert.equal(isSearchURL('history marker',bad),false,bad);}
 assert.equal(isSearchURL('marker','https://www.bing.com/search?q=marker&extra=1'),false);assert.equal(isSearchURL('marker','https://www.bing.com.evil.test/search?q=marker'),false);assert.equal(isSearchURL('marker','https://www.bing.com/maps?q=marker'),false);assert.equal(isSearchURL('marker','https://www.bing.com/search?other=marker'),false);assert.equal(isSearchURL('marker','https://www.bing.com:444/search?q=marker'),false);
});
test('search preference writes serialize and failed persistence never changes the selected engine',async()=>{
 const store=memory(),search=await create({store});await Promise.all([search.set('bing'),search.set('yandex'),search.set('duckduckgo')]);assert.deepEqual(store.writes.map(x=>x.mouseSearch.engine),['bing','yandex','duckduckgo']);assert.equal(search.state().engine,'duckduckgo');
 let fail=true;const fragile=await create({store:{get:async()=>({}),set:async()=>{if(fail)throw Error('disk fixture');}}});await assert.rejects(()=>fragile.set('bing'),/disk fixture/);assert.equal(fragile.state().engine,'google');fail=false;await fragile.set('yandex');assert.equal(fragile.state().engine,'yandex');
});

// Run the actual Mouse command and IPC wrappers. Only native page/image services
// are substituted here; the native smoke separately verifies real WebContents.
async function workspace({store=memory(),privateMode=false,inheritedEngine}={}){
 const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
 const handlers=new Map(),ipcMain={handle:(key,fn)=>handlers.set(key,fn)},token={},trusted=e=>{assert.equal(e.sender,token);},sent=[];
 const shellContents=new EventEmitter();shellContents.send=(...args)=>sent.push(args);
 const win={isDestroyed:()=>false,webContents:shellContents},app={getPath:()=>'/tmp/mouse-search-unit'},browser={tabs:new Map(),providers:new Map(),session:new EventEmitter(),project:'fixture',privateMode,emit(){},dispose(){this.disposed=true;},save:async()=>true};let sequence=0;
 browser.make=url=>{const wc=new EventEmitter();wc.url=url;wc.getURL=()=>wc.url;const t={id:'page-'+(++sequence),url,title:'Fixture',lane:'main',view:{webContents:wc}};browser.tabs.set(t.id,t);return t;};
 browser.get=id=>{const t=browser.tabs.get(id);if(!t)throw Error('Unknown fixture tab');return t;};browser.state=()=>({tabs:[...browser.tabs.values()].map(({id,url,lane})=>({id,url,lane}))});
 browser.command=async(action,args={})=>{if(action==='open'){const t=browser.make(args.url);t.lane=args.lane||'main';return{id:t.id};}if(action==='navigate'){const t=browser.get(args.id);t.url=args.url;t.view.webContents.url=args.url;return browser.state();}if(action==='close'){browser.tabs.delete(args.id);return browser.state();}return true;};
 function load(file){const filename=require.resolve(file),actual=createRequire(filename),module={exports:{}};vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,URL,console,setTimeout,clearTimeout,structuredClone,Buffer,require:name=>name==='electron'?{nativeImage:{}}:name==='./mouse-library-icons.cjs'?{createIcons:()=>({site:async()=>'',preview:async()=>'',download:async()=>''})}:name==='./mouse-history.cjs'?{attachHistory(){}}:actual(name)},{filename});return module.exports;}
 const browsing=await load('./mouse-browsing.cjs').install({app,win,browser,store,ipcMain,trusted,shell:{},dialog:{},searchEngine:inheritedEngine});
 if(privateMode)for(const method of ['visit','title','input','closed'])browsing.library[method]=()=>null;
 const start=await load('./mouse-start.cjs').install({app,win,browser,store,libraryService:browsing,ipcMain,trusted,dialog:{},privateMode});
 return{browser,browsing,start,store,sent,call:(action,args={})=>handlers.get('mouse:start')({sender:token},action,args)};
}
test('real start and browsing wrappers apply one preference to internal home and address navigation',async()=>{
 const w=await workspace();assert.equal((await w.call('get')).search.engine,'google');await w.call('preferences',{searchEngine:'bing'});
 const first=await w.browser.command('open',{url:'address marker'});assert.equal(w.browser.get(first.id).url,resolve('address marker','bing'));
 await w.browser.command('navigate',{id:first.id,url:'address next'});assert.equal(w.browser.get(first.id).url,resolve('address next','bing'));
 const home=await w.browser.command('open',{url:'mouse://start'});assert.equal(w.start.tabs.has(home.id),true);await w.browser.command('navigate',{id:home.id,url:'home marker'});assert.equal(w.browser.get(home.id).url,resolve('home marker','bing'));assert.equal(w.start.tabs.has(home.id),false);
 await w.browser.command('navigate',{id:home.id,url:'https://www.google.com/search?q=explicit'});assert.equal(w.browser.get(home.id).url,'https://www.google.com/search?q=explicit');
 await assert.rejects(()=>w.browser.command('navigate',{id:home.id,url:'file:///fixture'}));assert.deepEqual(w.browsing.library.data.searches.map(x=>x.query),['home marker','address next','address marker']);await w.browsing.flush();
});
test('private start IPC changes only its RAM engine and records neither search nor normal settings',async()=>{
 const normalStore=memory(),normal=await workspace({store:normalStore});await normal.call('preferences',{searchEngine:'bing'});await normal.browsing.flush();const before=normalStore.snapshot();
 const privateStore=memory(),w=await workspace({store:privateStore,privateMode:true,inheritedEngine:normal.browser.mouseSearch.state().engine});assert.equal((await w.call('get')).search.engine,'bing');
 const writesBefore=privateStore.writes.length;await w.call('preferences',{searchEngine:'duckduckgo'});assert.equal(privateStore.writes.length,writesBefore,'private preference setter does not write even to the profile abstraction');
 const home=await w.browser.command('open',{url:'mouse://start'});await w.browser.command('navigate',{id:home.id,url:'private search marker'});assert.equal(w.browser.get(home.id).url,resolve('private search marker','duckduckgo'));assert.deepEqual(w.browsing.library.data.searches,[]);assert.deepEqual(normalStore.snapshot(),before);assert.equal(normal.browser.mouseSearch.state().engine,'bing');
 await w.browsing.flush();const again=await workspace({privateMode:true,inheritedEngine:normal.browser.mouseSearch.state().engine});assert.equal((await again.call('get')).search.engine,'bing');
});
