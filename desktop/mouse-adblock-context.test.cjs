'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {MouseAdBlock}=require('./mouse-adblock.cjs');
const {AdBlockExceptions}=require('./mouse-adblock-exceptions.cjs');
const {compile}=require('./mouse-adblock-rules.cjs');
const session=()=>{const ses={listener:null};ses.webRequest={onBeforeRequest(filter,listener){ses.listener=filter===null?null:listener;}};return ses;};
let nextId=1;
function contents(ses,url){
 const wc=new EventEmitter();wc.id=nextId++;wc.session=ses;wc.getURL=()=>url;wc.isDestroyed=()=>false;wc.isLoadingMainFrame=()=>false;wc.mainFrame={url,parent:null};wc.mainFrame.top=wc.mainFrame;
 wc.address=value=>{url=value;};wc.frameAddress=value=>{wc.mainFrame.url=value;};wc.commit=value=>{url=value;wc.frameAddress(value);wc.emit('did-navigate',{},value,200,'OK');};return wc;
}
async function fixture(t){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-adblock-context-')),store={async get(){return{};},async set(){}},exceptions=new AdBlockExceptions({store});await exceptions.initialize();
 const lookup=new Map(),adBlock=new MouseAdBlock({directory,exceptions,getWebContents:id=>lookup.get(id),fetchList:async()=>{throw Error('Synthetic offline fixture');}});await adBlock.initialize(true);await adBlock.refresh();
 adBlock.engine=compile(['||ads.vk.com^\n||excluded.test^\n||blocked.example^\n||an.yandex.ru^\n||doubleclick.net^\n']);
 const normal=session(),privateSession=session();adBlock.attach(normal);const privateDetach=adBlock.attach(privateSession);
 const page=(url,ses=normal)=>{const wc=contents(ses,url);lookup.set(wc.id,wc);adBlock.track(wc);return wc;};
 t.after(async()=>{adBlock.dispose();await adBlock.preparing;await adBlock.inFlight;await fs.rm(directory,{recursive:true,force:true});});
 return{adBlock,exceptions,normal,privateSession,privateDetach,page};
}
function request(ses,wc,overrides={}){
 let value,calls=0;ses.listener({id:1,url:'https://ads.vk.com/advertising.js',resourceType:'script',webContents:wc,initiatorOrigin:wc?.getURL(),...overrides},decision=>{calls++;value=decision;});assert.equal(calls,1);return value.cancel;
}

test('an excluded top-level website allows every attributed resource type, including cross-origin frames and ad redirects',async t=>{
 const f=await fixture(t);await f.exceptions.add('https://excluded.test/article');const wc=f.page('https://excluded.test/');
 for(const resourceType of ['script','image','stylesheet','font','object','xhr','ping','cspReport','media','webSocket','other','subFrame']){
  const frame={url:'https://cross-origin-frame.test/',top:wc.mainFrame};assert.equal(request(f.normal,wc,{resourceType,frame,initiatorOrigin:'https://cross-origin-frame.test',url:resourceType==='webSocket'?'wss://ads.vk.com/ad':'https://ads.vk.com/ad'}),false,resourceType);
 }
 for(const url of ['https://ads.vk.com/ad','https://an.yandex.ru/ad','https://doubleclick.net/ad'])assert.equal(request(f.normal,wc,{id:99,url}),false,url);
});
test('allowlisting an ad host does not allow its resources or embedded frames on another website',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://unexcluded.test/');
 for(const details of [{url:'https://excluded.test/ad.js'},{frame:{url:'https://excluded.test/frame',top:wc.mainFrame},initiatorOrigin:'https://excluded.test',referrer:'https://excluded.test/frame'},{frame:{url:'https://excluded.test/frame'},initiatorOrigin:'https://excluded.test'},{initiatorOrigin:'https://excluded.test',referrer:'https://excluded.test/'},{url:'https://ads.vk.com/redirected.js',initiatorOrigin:'https://excluded.test'}])assert.equal(request(f.normal,wc,details),true);
 assert.equal(request(f.normal,null,{url:'https://excluded.test/ad.js',initiatorOrigin:'https://excluded.test',referrer:'https://excluded.test'}),true);
});
test('each tab has its own effective policy and subdomains do not inherit a host exception',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const excluded=f.page('http://excluded.test:3000/'),other=f.page('https://other.test/'),subdomain=f.page('https://www.excluded.test/');
 for(let i=0;i<3;i++){assert.equal(request(f.normal,excluded),false);assert.equal(request(f.normal,other),true);assert.equal(request(f.normal,subdomain),true);}
 await f.exceptions.remove('excluded.test');assert.equal(request(f.normal,excluded),true);assert.equal(request(f.normal,other),true);
});
test('main-frame navigation and server redirects never carry an old exclusion to a different target',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://excluded.test/');assert.equal(request(f.normal,wc),false);
 wc.emit('did-start-navigation',{url:'https://redirector.test/',isMainFrame:true,isSameDocument:false});
 assert.equal(request(f.normal,wc,{resourceType:'mainFrame',id:10,url:'https://redirector.test/'}),false);
 assert.equal(request(f.normal,wc),true,'old getURL cannot exempt unidentified provisional requests');
 wc.emit('did-redirect-navigation',{url:'https://blocked.example/final',isMainFrame:true,isSameDocument:false});
 assert.equal(request(f.normal,wc,{resourceType:'mainFrame',id:10,url:'https://blocked.example/final'}),false);
 assert.equal(request(f.normal,wc),true);wc.frameAddress('https://blocked.example/final');assert.equal(request(f.normal,wc,{frame:wc.mainFrame}),true,'native target frame overrules stale getURL');
 wc.commit('https://blocked.example/final');assert.equal(request(f.normal,wc),true);
});
test('entering an excluded site does not exempt the old document before commit; native frame evidence enables the new document',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://other.test/');
 wc.emit('did-start-navigation',{},'https://excluded.test/',false,true);request(f.normal,wc,{resourceType:'mainFrame',url:'https://excluded.test/',id:11});
 assert.equal(request(f.normal,wc,{frame:wc.mainFrame}),true);assert.equal(request(f.normal,wc),true);
 wc.frameAddress('https://excluded.test/');assert.equal(request(f.normal,wc,{frame:wc.mainFrame}),false);wc.commit('https://excluded.test/');assert.equal(request(f.normal,wc),false);
 wc.emit('did-start-navigation',{},'https://unexcluded.test/',false,true);request(f.normal,wc,{resourceType:'mainFrame',url:'https://unexcluded.test/',id:12});wc.emit('did-redirect-navigation',{},'https://excluded.test/redirect-target',false,true);request(f.normal,wc,{resourceType:'mainFrame',url:'https://excluded.test/redirect-target',id:12});
 assert.equal(request(f.normal,wc),false);wc.commit('https://excluded.test/redirect-target');assert.equal(request(f.normal,wc),false);
});
test('iframe navigations, resource redirects and opaque initiators cannot replace the live top-level context',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://other.test/');
 wc.emit('did-start-navigation',{url:'https://excluded.test/frame',isMainFrame:false,isSameDocument:false});
 wc.emit('did-redirect-navigation',{url:'https://excluded.test/redirect',isMainFrame:false,isSameDocument:false});
 assert.equal(request(f.normal,wc,{resourceType:'subFrame',url:'https://excluded.test/frame',frame:{url:'https://other-frame.test/',top:wc.mainFrame}}),true);
 for(const details of [{frame:{url:'https://excluded.test/',top:wc.mainFrame},initiatorOrigin:'null'},{frame:null,initiatorOrigin:'https://excluded.test'},{}])assert.equal(request(f.normal,wc,details),true);
 wc.commit('https://excluded.test/');assert.equal(request(f.normal,wc,{initiatorOrigin:'null'}),false,'an opaque child is covered by its known top-level site');
});
test('aborted navigation restores the actual current site while late failures cannot erase a newer navigation',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://excluded.test/');
 wc.emit('did-start-navigation',{url:'https://first.test/',isMainFrame:true});request(f.normal,wc,{resourceType:'mainFrame',url:'https://first.test/',id:30});assert.equal(request(f.normal,wc),true);
 wc.emit('did-fail-provisional-load',{},-3,'Aborted','https://first.test/',true);assert.equal(request(f.normal,wc),false);
 wc.emit('did-start-navigation',{url:'https://first.test/',isMainFrame:true});request(f.normal,wc,{resourceType:'mainFrame',url:'https://first.test/',id:31});
 wc.emit('did-start-navigation',{url:'https://second.test/',isMainFrame:true});request(f.normal,wc,{resourceType:'mainFrame',url:'https://second.test/',id:32});
 wc.emit('did-fail-provisional-load',{},-3,'Aborted','https://first.test/',true);assert.equal(request(f.normal,wc),true);
 wc.emit('did-fail-load',{},-105,'Name not resolved','https://second.test/',true);assert.equal(request(f.normal,wc),false);
});
test('internal navigation and missing or destroyed native identities never borrow a previous site exemption',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://excluded.test/');
 wc.emit('did-start-navigation',{url:'about:blank',isMainFrame:true,isSameDocument:false});assert.equal(request(f.normal,wc),true);
 wc.commit('about:blank');assert.equal(request(f.normal,wc),true);assert.equal(request(f.normal,wc,{frame:{url:'https://excluded.test/',top:{url:'about:blank'}}}),true);
 const live=f.page('https://excluded.test/');assert.equal(request(f.normal,null,{webContentsId:live.id}),false);assert.equal(request(f.privateSession,live),true,'a foreign Session cannot claim this page');
 live.isDestroyed=()=>true;assert.equal(request(f.normal,live),true);live.emit('destroyed');assert.equal(f.adBlock.context.records.has(live),false);
});
test('private sessions inherit exclusions without persisting visits and dispose their native context records',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://excluded.test/private-secret',f.privateSession),other=f.page('https://unexcluded.test/private',f.privateSession);
 assert.equal(request(f.privateSession,wc),false);assert.equal(request(f.privateSession,other),true);const queued=f.privateSession.listener;
 assert.equal(f.adBlock.context.records.has(wc),true);f.privateDetach();assert.equal(f.adBlock.context.records.has(wc),false);assert.equal(f.adBlock.context.records.has(other),false);assert.equal(wc.eventNames().length,0);
 let result;queued({url:'https://ads.vk.com/ad',webContents:wc,resourceType:'script'},value=>result=value);assert.deepEqual(result,{cancel:false});assert.deepEqual(f.exceptions.list(),['excluded.test']);
});
test('the global switch removes interception, survives a queued callback, and retains site choices when re-enabled',async t=>{
 const f=await fixture(t);await f.exceptions.add('excluded.test');const wc=f.page('https://excluded.test/'),other=f.page('https://other.test/'),queued=f.normal.listener;
 assert.equal(request(f.normal,wc),false);assert.equal(request(f.normal,other),true);f.adBlock.setEnabled(false);assert.equal(f.normal.listener,null);
 let result;queued({url:'https://ads.vk.com/ad',resourceType:'script',webContents:other},value=>result=value);assert.deepEqual(result,{cancel:false});
 f.adBlock.setEnabled(true);await f.adBlock.refresh();assert.equal(request(f.normal,wc),false);assert.equal(request(f.normal,other),true);assert.deepEqual(f.exceptions.list(),['excluded.test']);
});
