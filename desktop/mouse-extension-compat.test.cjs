'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const A='a'.repeat(32),B='b'.repeat(32),SITE='https://owned.example/page';
function fixture(){
 const app=new EventEmitter(),ipcMain=new EventEmitter(),module={exports:{}};
 const electron={app,ipcMain},source=fs.readFileSync(path.join(__dirname,'mouse-extension-compat.cjs'),'utf8');
 vm.runInNewContext('(function(require,module,exports){'+source+'\n})',{URL,Map,Set,WeakMap,WeakSet,Number,Object,Array,RegExp,Date,queueMicrotask})(name=>name==='electron'?electron:require(name),module,module.exports);
 const ext=new Map([[A,{id:A,name:'Owned A',manifest:{permissions:[],host_permissions:[]}}],[B,{id:B,name:'Owned B',manifest:{permissions:['tabs','cookies','webNavigation'],host_permissions:['https://owned.example/*']}}]]),session={extensions:new EventEmitter()};
 session.extensions.getExtension=id=>ext.get(id);let available=true,result,created=0;const sent=[],calls=[],listenerCalls=[];
 const wc=new EventEmitter();Object.assign(wc,{id:41,session,isDestroyed:()=>false,getURL:()=>SITE});const page={id:'owned-tab',project:'owned-project',view:{webContents:wc}},win={isDestroyed:()=>false,getContentBounds:()=>({width:1200,height:800})},browser={session,project:'owned-project',tabs:new Map([[page.id,page]]),providers:new Map(),state:()=>({desktopId:'owned-desk'}),make:()=>page,open:()=>({id:page.id}),openManagedExtension:()=>({id:page.id}),get:()=>page,command(){}};
 const delegate={onAddListener:(...a)=>listenerCalls.push(['add',...a]),onRemoveListener:(...a)=>listenerCalls.push(['remove',...a])};
 class FakeExtensions extends EventEmitter{
  constructor(options){super();this.options=options;this.ctx={router:{delegate,listeners:new Map(),addListener(){},onExtensionMessage:async(...args)=>{calls.push(args);return result;},sendEvent:(...args)=>sent.push(args)},store:{getActiveTabOfCurrentWindow:()=>wc}};this.api={browserAction:{activateClick:()=>created++,getState:()=>({}),getPopupUrl:()=>null},permissions:{permissionMap:new Map([...ext].map(([id,e])=>[id,{permissions:e.manifest.permissions,origins:e.manifest.host_permissions}]))}};}
  addTab(){}selectTab(){}getContextMenuItems(){return[];}
 }
 const compat=module.exports.installExtensionCompatibility({browser,win,dialog:{showMessageBox:async()=>({response:1})},isAvailable:()=>available,Extensions:FakeExtensions});
 const event=id=>({type:'frame',sender:{session},senderFrame:{url:'chrome-extension://'+id+'/popup.html'}});
 return{...module.exports,app,ipcMain,compat,router:compat.instance.ctx.router,ext,session,wc,page,event,sent,calls,listenerCalls,delegate,get created(){return created;},set result(v){result=v;},set available(v){available=v;}};
}
test('Chrome match patterns never include privileged schemes or lookalike/subdomain suffixes',()=>{
 const f=fixture();for(const [pattern,url,match]of [['https://*.example.com/*','https://sub.example.com/a',true],['https://*.example.com/*','https://example.com/a',true],['https://*.example.com/*','https://example.com.evil/a',false],['<all_urls>','chrome-extension://'+A+'/x',false],['*://*/*','file:///private',false],['https://owned.example/path*','http://owned.example/path',false]])assert.equal(f.matchHost(pattern,url),match);
});
test('extension methods bind both native sender identity and persistent session',async()=>{
 const f=fixture();await assert.rejects(f.router.onExtensionMessage(f.event(A),B,'tabs.query'),/Источник/);
 await assert.rejects(f.router.onExtensionMessage({...f.event(A),sender:{session:{}}},A,'tabs.query'),/Источник/);
 await assert.rejects(f.router.onExtensionMessage({type:'service-worker',session:f.session,serviceWorker:{scope:'chrome-extension://'+B+'/'}},A,'tabs.query'),/Источник/);
 f.available=false;await assert.rejects(f.router.onExtensionMessage(f.event(A),A,'tabs.query'),/приватном/);assert.equal(f.calls.length,0);
});
test('method returns redact sensitive tabs, including populated windows and query predicates',async()=>{
 const f=fixture(),tab={id:41,url:SITE,title:'private title',favIconUrl:'https://owned.example/icon',pendingUrl:SITE,status:'complete'};f.result=[tab];
 assert.deepEqual(JSON.parse(JSON.stringify(await f.router.onExtensionMessage(f.event(A),A,'tabs.query'))),[{id:41,status:'complete'}]);
 assert.deepEqual(JSON.parse(JSON.stringify(await f.router.onExtensionMessage(f.event(B),B,'tabs.query'))),[tab]);
 f.result={id:1,tabs:[tab]};assert.deepEqual(JSON.parse(JSON.stringify(await f.router.onExtensionMessage(f.event(A),A,'windows.get',1))),{id:1,tabs:[{id:41,status:'complete'}]});
 f.result=[tab];assert.deepEqual(JSON.parse(JSON.stringify(await f.router.onExtensionMessage(f.event(A),A,'tabs.query',{url:'https://owned.example/*'}))),[]);assert.equal(f.calls.at(-1)[3].url,undefined);
});
test('broadcast metadata is copied and filtered independently for each actual extension listener',()=>{
 const f=fixture(),tab={id:41,url:SITE,title:'owned',favIconUrl:SITE+'/icon'},change={url:SITE,title:'owned',status:'complete'},listeners=[{extensionId:A},{extensionId:A},{extensionId:B}];
 f.router.listeners.set('tabs.onUpdated',listeners);f.router.sendEvent(undefined,'tabs.onUpdated',41,change,tab);
 assert.equal(f.sent.length,2);assert.deepEqual(JSON.parse(JSON.stringify(f.sent[0])),[A,'tabs.onUpdated',41,{status:'complete'},{id:41}]);assert.equal(f.sent[1][3].url,SITE);assert.equal(change.url,SITE);assert.equal(tab.title,'owned');
 f.sent.length=0;f.router.listeners.set('cookies.onChanged',listeners);f.router.sendEvent(undefined,'cookies.onChanged',{cookie:{domain:'.owned.example',path:'/',secure:true,value:'secret'}});assert.equal(f.sent.length,1);assert.equal(f.sent[0][0],B);
 f.sent.length=0;f.router.sendEvent(undefined,'cookies.onChanged',{cookie:{domain:'other.example',path:'/',secure:true,value:'secret'}});assert.equal(f.sent.length,0);
 f.router.listeners.set('webNavigation.onCommitted',listeners);f.router.sendEvent(undefined,'webNavigation.onCommitted',{url:SITE,tabId:41});assert.equal(f.sent.length,1);assert.equal(f.sent[0][0],B);
 f.available=false;f.router.sendEvent(B,'browserAction.onClicked',tab);assert.equal(f.sent.length,1);
});
test('tab creation and updates cannot open another installed extension, and optional APIs require grants',async()=>{
 const f=fixture();for(const [method,args]of [['tabs.create',[{url:'chrome-extension://'+B+'/options.html'}]],['tabs.update',[41,{url:'chrome-extension://'+B+'/options.html'}]],['webNavigation.getAllFrames',[{tabId:41}]],['cookies.getAll',[{}]],['contextMenus.create',[{id:'x'}]]])await assert.rejects(f.router.onExtensionMessage(f.event(A),A,method,...args));assert.equal(f.calls.length,0);
 f.result={id:41,url:'chrome-extension://'+A+'/options.html'};await f.router.onExtensionMessage(f.event(A),A,'tabs.create',{url:'chrome-extension://'+A+'/options.html'});assert.equal(f.calls.length,1);
});
test('tab URLs are resolved before ownership and navigation checks',async()=>{
 const f=fixture(),blocked=['//'+B+'/options.html','file:///tmp/private.txt','data:text/html,local','javascript:alert(1)','https://user:password@owned.example/page','chrome-extension://user@'+A+'/options.html',['file:///tmp/private.txt'],null,42];
 for(const method of ['tabs.create','tabs.update'])for(const url of blocked){
  const args=method==='tabs.create'?[{url}]:[41,{url}];
  await assert.rejects(f.router.onExtensionMessage(f.event(A),A,method,...args));
 }
 assert.equal(f.calls.length,0);
 for(const [method,args,index,expected]of [
  ['tabs.create',[{url:'options.html'}],3,'chrome-extension://'+A+'/options.html'],
  ['tabs.update',[41,{url:'/options.html'}],4,'chrome-extension://'+A+'/options.html'],
  ['tabs.update',[{url:'./options.html'}],3,'chrome-extension://'+A+'/options.html'],
  ['tabs.create',[{url:'https://owned.example/page'}],3,SITE],
  ['tabs.update',[41,{url:'http://owned.example/page'}],4,'http://owned.example/page']
 ]){
  await f.router.onExtensionMessage(f.event(A),A,method,...args);
  assert.equal(f.calls.at(-1)[index].url,expected);
 }
});
test('worker listeners authenticate scope before upstream loses its native sender',()=>{
 const f=fixture(),event={type:'service-worker',session:f.session,serviceWorker:{scope:'chrome-extension://'+A+'/'}};
 f.delegate.onAddListener(event,B,'tabs.onUpdated');assert.equal(f.listenerCalls.length,0);
 f.delegate.onAddListener(event,A,'tabs.onUpdated');assert.equal(f.listenerCalls.length,1);
 f.delegate.onRemoveListener(event,B,'tabs.onUpdated');assert.equal(f.listenerCalls.length,1);
 f.delegate.onRemoveListener(event,A,'tabs.onUpdated');assert.equal(f.listenerCalls.length,2);
});
test('activeTab permission follows the native action and clears on navigation or private transition',async()=>{
 const f=fixture();f.ext.get(A).manifest.permissions.push('activeTab');f.result={id:41,url:SITE,title:'owned'};
 f.compat.activate(A,{tabId:f.page.id});assert.equal(f.created,1);assert.equal((await f.router.onExtensionMessage(f.event(A),A,'tabs.get',41)).url,SITE);
 f.wc.emit('did-start-navigation',{},SITE+'/next',false,true);assert.equal((await f.router.onExtensionMessage(f.event(A),A,'tabs.get',41)).url,undefined);
 f.compat.activate(A,{tabId:f.page.id});f.compat.suspend();assert.equal((await f.router.onExtensionMessage(f.event(A),A,'tabs.get',41)).url,undefined);
});
