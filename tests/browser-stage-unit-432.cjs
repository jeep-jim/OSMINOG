'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const listeners={},store={},windows=new Map([[10,{id:10,type:'normal',state:'normal',focused:true}]]),tabs=new Map([[1,{id:1,windowId:10,url:'chrome-extension://owner/editor.html',active:true}],[2,{id:2,windowId:10,url:'https://personal.example/',active:false}]]),calls=[];
 let next=20;
 const ev=k=>({addListener:fn=>(listeners[k]||=[]).push(fn)});
 const chrome={runtime:{id:'owner',getURL:p=>'chrome-extension://owner/'+p,onMessage:ev('message'),getContexts:async()=>[{tabId:1}],sendMessage:async m=>{calls.push(['notify',m])}},storage:{session:{get:async k=>({[k]:store[k]}),set:async v=>{Object.assign(store,structuredClone(v))}}},tabs:{
  get:async id=>{if(!tabs.has(id))throw Error('No tab');return {...tabs.get(id)}},query:async q=>[...tabs.values()].filter(t=>!q.windowId||t.windowId===q.windowId),
  create:async o=>{const t={id:next++,windowId:o.windowId,url:o.url,active:o.active};tabs.set(t.id,t);calls.push(['createTab',o]);return {...t}},
  update:async(id,o)=>{Object.assign(tabs.get(id),o);calls.push(['updateTab',id,o]);return {...tabs.get(id)}},remove:async id=>{tabs.delete(id);calls.push(['removeTab',id])},
  goBack:async id=>calls.push(['back',id]),goForward:async id=>calls.push(['forward',id]),
  onUpdated:ev('updated'),onCreated:ev('created'),onActivated:ev('activated'),onRemoved:ev('removedTab')},
 windows:{get:async id=>{if(!windows.has(id))throw Error('No window');return {...windows.get(id)}},
  create:async o=>{const w={id:next++,type:o.type,state:'normal',...o};windows.set(w.id,w);const t=await chrome.tabs.create({windowId:w.id,url:o.url,active:true});calls.push(['createWindow',o]);return {...w,tabs:[t]}},
  update:async(id,o)=>{Object.assign(windows.get(id),o);calls.push(['updateWindow',id,o]);return {...windows.get(id)}},
  onBoundsChanged:ev('bounds'),onRemoved:ev('removedWindow')}};
 vm.runInNewContext(fs.readFileSync('osminog-web-stage.js','utf8'),{chrome,URL,Promise,Map,Object,Number,String,Math,Error},{filename:'osminog-web-stage.js'});
 const sender={id:'owner',url:'chrome-extension://owner/editor.html',documentId:'editor-document'};
 const send=(op,args={},who=sender)=>new Promise(resolve=>listeners.message[0]({type:'OSMINOG_WEB_STAGE_'+op,...args},who,resolve));
 const fire=async(k,...args)=>{for(const fn of listeners[k]||[])fn(...args);await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r))};
 return{send,fire,calls,store,windows,tabs,sender};
}
const geometry={left:-1200,top:160,width:700,height:800},url='https://example.com/';
test('validated source, URL, geometry and foreign tab ownership',async()=>{
 const x=setup();assert.equal((await x.send('OPEN',{url,geometry},{id:'evil',url:'https://evil/'})).ok,false);
 assert.equal((await x.send('OPEN',{url:'javascript:alert(1)',geometry})).ok,false);
 assert.equal((await x.send('OPEN',{url,geometry:{...geometry,width:1}})).ok,false);
 assert.equal(x.calls.filter(c=>c[0]==='createWindow').length,0);
 const r=await x.send('OPEN',{url,geometry});assert.equal(r.ok,true);assert.equal(r.displayVerified,false);
 assert.equal((await x.send('HIDE',{parentTabId:2})).ok,false);
 assert.equal((await x.send('CLOSE_TAB',{tabId:2})).ok,false);assert.equal(x.tabs.has(2),true);
 assert.equal((await x.send('HISTORY',{tabId:2,direction:-1})).ok,false);
});
test('one popup per logical tab; switching retains URL/document',async()=>{
 const x=setup();const [a,b]=await Promise.all([x.send('OPEN',{url,geometry}),x.send('OPEN',{url:url+'second',geometry})]);
 assert.notEqual(a.windowId,b.windowId);assert.equal(x.calls.filter(c=>c[0]==='createWindow').length,2);assert.equal(x.windows.get(a.windowId).state,'minimized');
 x.calls.length=0;await x.send('OPEN',{url,geometry,tabId:a.tabId});
 assert.equal(x.calls.some(c=>c[0]==='updateTab'&&Object.hasOwn(c[2],'url')),false);
 await x.send('HISTORY',{tabId:a.tabId,direction:-1});assert.equal(x.calls.some(c=>c[0]==='back'),true);
});
test('geometry updates never steal focus or restore a hidden popup',async()=>{
 const x=setup(),r=await x.send('OPEN',{url,geometry});x.calls.length=0;
 await x.send('BOUNDS',{geometry:{...geometry,width:710}});
 assert.equal(x.calls.filter(c=>c[0]==='updateWindow').every(c=>!Object.hasOwn(c[2],'focused')&&!Object.hasOwn(c[2],'state')),true);
 await x.send('HIDE');x.calls.length=0;await x.send('BOUNDS',{geometry:{...geometry,width:720}});
 assert.equal(x.calls.some(c=>c[0]==='updateWindow'),false);assert.equal(x.windows.get(r.windowId).state,'minimized');
 await x.send('FOCUS',{tabId:r.tabId});assert.equal(x.windows.get(r.windowId).state,'normal');
});
test('auth/new-window contexts are never moved, duplicated or removed',async()=>{
 const x=setup(),r=await x.send('OPEN',{url,geometry});x.calls.length=0;
 const child={id:99,windowId:10,openerTabId:r.tabId,url:'https://login.example/callback',active:true};x.tabs.set(99,child);
 await x.fire('created',child);await x.fire('updated',99,{status:'complete'},child);
 assert.equal(x.tabs.has(99),true);assert.equal(x.calls.length,0);
});
test('switching editor tabs and minimizing the parent do not hide the site popup',async()=>{
 const x=setup(),r=await x.send('OPEN',{url,geometry});
 await x.fire('activated',{tabId:2,windowId:10});
 assert.equal(x.windows.get(r.windowId).state,'normal');
 assert.equal(x.store.osminogWebStagesV2[1].visible,true);
 await x.fire('bounds',{id:10,state:'minimized'});
 assert.equal(x.windows.get(r.windowId).state,'normal');
 assert.equal(x.store.osminogWebStagesV2[1].visible,true);
 await x.fire('removedTab',1,{windowId:10});
 assert.equal(x.tabs.has(r.tabId),true);assert.equal(x.windows.has(r.windowId),true);
 assert.equal(x.store.osminogWebStagesV2[1],undefined);
});
