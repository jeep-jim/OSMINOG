'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPreviewRouter,outboundNavigation}=require('./mouse-ai-preview.cjs');
const {DesktopBank}=require('./mouse-desktops.cjs');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const until=async predicate=>{for(let i=0;i<30;i++){if(predicate())return;await new Promise(setImmediate);}assert.fail('Controlled preview transaction did not reach its barrier');};

function fixture(){
 const bank=new DesktopBank(),browser={tabs:new Map(),disposed:false,emit(){}},opened=[],navigated=[],discarded=[],holds={},entered={open:0,navigate:0,persist:0};bank.assign('chat','desk-3');
 const chat={id:'chat',lane:'side',url:'https://chat.example/conversation/one',view:{webContents:{getURL(){return chat.url},isDestroyed:()=>false}}};
 browser.tabs.set(chat.id,chat);
 const router=createPreviewRouter({browser,bank,
  async open(desk,args){await Promise.resolve();const page={...args,id:'preview-'+(opened.length+1),view:{webContents:{isDestroyed:()=>false}}};browser.tabs.set(page.id,page);bank.assign(page.id,desk);opened.push(page);entered.open++;await holds.open;return{id:page.id}},
  async navigate(id,url){browser.tabs.get(id).url=url;navigated.push({id,url});entered.navigate++;await holds.navigate;},
  async discard(id){discarded.push(id);browser.tabs.delete(id);delete bank.members[id];},
  async persist(){entered.persist++;await holds.persist;}});
 return{browser,bank,chat,opened,navigated,discarded,holds,entered,router};
}

test('external same-window navigation is previewed without hijacking chat history or fragment links',()=>{
 const {chat}=fixture();assert.equal(outboundNavigation(chat,'https://source.example/article'),true);
 for(const url of ['https://chat.example/conversation/two','https://chat.example/conversation/one#citation','javascript:alert(1)','file:///tmp/file','not a URL'])assert.equal(outboundNavigation(chat,url),false,url);
 assert.equal(outboundNavigation({...chat,previewOf:'another'},'https://source.example/article'),false);
 assert.equal(outboundNavigation({...chat,lane:'main'},'https://source.example/article'),false);
});

test('rapid chat links reuse one lower preview on the source desktop and retain the chat',async()=>{
 const f=fixture(),original=f.chat,results=await Promise.all([
  f.router.route(f.chat,'https://source.example/first'),
  f.router.route(f.chat,'https://source.example/second')]);
 assert.equal(f.opened.length,1);assert.equal(results[0].id,results[1].id);
 assert.equal(f.browser.tabs.get('chat'),original);assert.equal(original.url,'https://chat.example/conversation/one');
 assert.equal(f.opened[0].lane,'side');assert.equal(f.opened[0].previewOf,'chat');assert.equal(f.opened[0].url,'https://source.example/second');
 assert.equal(f.bank.members[results[0].id],'desk-3');assert.equal(f.browser.tabs.size,2);
 await f.router.route(f.opened[0],'https://source.example/third');
 assert.equal(f.opened.length,1);assert.equal(f.opened[0].url,'https://source.example/third');
});

test('closed, moved and independent private sources cannot reuse another workspace preview',async()=>{
 const normal=fixture(),privateBank=fixture();await normal.router.route(normal.chat,'https://normal.example/');
 await privateBank.router.route(privateBank.chat,'https://private.example/');
 assert.notEqual(normal.opened[0],privateBank.opened[0]);assert.equal(normal.opened[0].url,'https://normal.example/');
 normal.browser.tabs.delete('chat');assert.equal(await normal.router.route(normal.chat,'https://lost.example/'),null);
 privateBank.bank.members[privateBank.opened[0].id]='desk-1';
 assert.equal(await privateBank.router.route(privateBank.opened[0],'https://wrong.example/'),null);
 assert.equal(privateBank.navigated.length,0);
});
test('a delayed open, navigation or persistence follows an atomically moved live chat group',async()=>{
 for(const stage of ['open','navigate','persist']){
  const f=fixture();if(stage==='navigate')await f.router.route(f.chat,'https://source.example/first');
  const gate=deferred(),before=f.entered[stage];f.holds[stage]=gate.promise;const pending=f.router.route(f.chat,'https://source.example/next');await until(()=>f.entered[stage]>before);
  const preview=f.opened[0],wc=preview.view.webContents,moved=f.bank.move('chat','desk-4',undefined,[...f.browser.tabs.values()]);assert.deepEqual(moved.linked,[preview.id]);
  gate.resolve();const result=await pending;assert.deepEqual(result,{id:preview.id,sourceId:'chat',desk:'desk-4'});assert.equal(f.bank.members[preview.id],'desk-4');assert.equal(f.browser.tabs.get(preview.id),preview);assert.equal(preview.view.webContents,wc);assert.deepEqual(f.discarded,[]);
 }
});
test('closing a source during its pending new preview removes only that still-owned orphan',async()=>{
 for(const stage of ['open','persist']){
  const f=fixture(),gate=deferred();f.holds[stage]=gate.promise;const pending=f.router.route(f.chat,'https://source.example/next');await until(()=>f.entered[stage]>0);
  const preview=f.opened[0];f.browser.tabs.delete('chat');delete f.bank.members.chat;gate.resolve();assert.equal(await pending,null);assert.deepEqual(f.discarded,[preview.id]);assert.equal(f.browser.tabs.has(preview.id),false);assert.equal(f.bank.members[preview.id],undefined);
 }
});
test('a user-detached preview survives delayed creation, navigation and persistence as an ordinary main tab',async()=>{
 for(const stage of ['open','navigate','persist']){
  const f=fixture();if(stage==='navigate')await f.router.route(f.chat,'https://source.example/first');
  const gate=deferred(),before=f.entered[stage];f.holds[stage]=gate.promise;const pending=f.router.route(f.chat,'https://source.example/next');await until(()=>f.entered[stage]>before);
  const preview=f.opened[0],wc=preview.view.webContents;f.bank.move(preview.id,'desk-4',undefined,[...f.browser.tabs.values()]);assert.equal(preview.previewOf,undefined);assert.equal(preview.lane,'main');
  gate.resolve();assert.equal(await pending,null);assert.equal(f.browser.tabs.get(preview.id),preview);assert.equal(preview.view.webContents,wc);assert.equal(f.bank.members[preview.id],'desk-4');assert.deepEqual(f.discarded,[]);
 }
});
test('a live navigation error remains visible and is not mistaken for a cancelled relation',async()=>{
 const f=fixture();await f.router.route(f.chat,'https://source.example/first');const gate=deferred();f.holds.navigate=gate.promise;const pending=f.router.route(f.chat,'https://source.example/failure');await until(()=>f.entered.navigate>0);gate.reject(Error('Owned navigation failed'));await assert.rejects(pending,/Owned navigation failed/);assert.deepEqual(f.discarded,[]);assert.equal(f.browser.tabs.size,2);
});
