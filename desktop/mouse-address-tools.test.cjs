'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {entries,webAddress}=require('./mouse/address-tools.js');
const {install}=require('./mouse-address-tools.cjs');
test('address list includes all desks and side pages; recent URLs are deduplicated without merging live tabs',()=>{
 const desks={items:[{id:'one',name:'Первый',tabs:[{id:'a',url:'https://example.com/a',title:'Alpha'},{id:'b',url:'mouse://start',internal:true}]},{id:'two',name:'Второй',tabs:[{id:'c',url:'https://example.com/a',title:'Also open',lane:'side'},{id:'d',url:'https://other.test/b',title:'Beta'}]}]};
 const history=[{id:'h1',url:'https://example.com/a'},{id:'h2',url:'https://past.test/',title:'Past'},{id:'h3',url:'javascript:alert(1)'},{id:'h4',url:'https://secret:pass@example.test/'}];
 assert.deepEqual(entries(desks,history).map(x=>[x.kind,x.id,x.desk]),[['open','a','one'],['open','c','two'],['open','d','two'],['history','h2',undefined]]);
 assert.deepEqual(entries(desks,history,' второй ').map(x=>x.id),['c','d']);
 assert.deepEqual(entries(desks,history,'PAST').map(x=>x.id),['h2']);
 assert.equal(webAddress('file:///private/profile'),'');assert.equal(webAddress('https://u:p@example.test'),'');
});
function fixture(){
 let handler,transition=false,currentURL='https://example.test/page';const writes=[];
 const browser={get(id){if(id!=='owned')throw Error('not owned');return {view:{webContents:{isDestroyed:()=>false,getURL:()=>currentURL}}};}};
 let current=browser;
 install({ipcMain:{handle(channel,fn){assert.equal(channel,'mouse:address');handler=fn;}},trusted(event){assert.equal(event.trusted,true);},getBrowser:()=>current,isTransition:()=>transition,clipboard:{async writeText(text){writes.push(text);}}});
 return{run:(args={},event={trusted:true},action='copy')=>handler(event,action,{id:'owned',url:currentURL,...args}),writes,browser,url(value){currentURL=value;},transition(value){transition=value;},workspace(value){current=value;}};
}
test('copy uses the committed URL of the owned live page and acknowledges only after the native write',async()=>{
 const f=fixture();assert.deepEqual(await f.run(),{copied:true});assert.deepEqual(f.writes,['https://example.test/page']);
 await assert.rejects(f.run({id:'other'}));await assert.rejects(f.run({url:'https://old.test/'}));await assert.rejects(f.run({}, {trusted:false}));await assert.rejects(f.run({}, {trusted:true},'read'));
 assert.equal(f.writes.length,1);
});
test('copy refuses private transitions, stale contexts, closed pages and credential URLs',async()=>{
 const f=fixture();f.transition(true);await assert.rejects(f.run());f.transition(false);f.workspace({disposed:true});await assert.rejects(f.run());f.workspace(f.browser);
 for(const url of ['mouse://start','file:///profile','https://u:p@example.test/']){f.url(url);await assert.rejects(f.run());}
 assert.deepEqual(f.writes,[]);
});
