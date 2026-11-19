'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DesktopBank}=require('./mouse-desktops.cjs'),{DesktopPreviews,MAX_IMAGES}=require('./mouse-desktop-previews.cjs'),L=require('./mouse/layout.js');
function fixture(){
 const bank=new DesktopBank(),browser={tabs:new Map()},records=[],captures=[];let now=100;
 const image={getSize:()=>({width:800,height:600}),resize({width}){assert.equal(width,400);return this;},toJPEG(quality){assert.equal(quality,70);return Buffer.from('image');}};
 function add(id,desk='desk-3',{visible=true,internal=false,lane='main'}={}){bank.assign(id,desk);const record={id,url:'https://'+id+'.test/',title:'Title '+id,internal,lane};records.push(record);const t={id,url:record.url,visible,navigationEpoch:0,view:{webContents:{isDestroyed:()=>false,getURL:()=>record.url,async capturePage(){captures.push(id);return image;}}}};if(!internal)browser.tabs.set(id,t);return{t,record};}
 const previews=new DesktopPreviews({bank,browser,state:()=>({tabs:records}),now:()=>++now});return{bank,browser,records,captures,previews,add,image,advance:ms=>{now+=ms;}};
}
test('preview captures only visible active pages, preserves exact layout and uses cached images without waking hidden desks',async()=>{
 const f=fixture();f.add('a');f.add('hidden','desk-1',{visible:false});f.add('internal','desk-3',{internal:true});f.add('ai','desk-3',{lane:'side'});f.bank.savePreferences({tree:L.preset(2),slots:{p1:'a',p2:'internal'},aiOpen:true,aiId:'ai'});await f.previews.capture();assert.deepEqual(f.captures,['a','ai']);const active=f.previews.snapshot().items[2];assert.equal(active.preview.panes.length,3);assert.equal(active.preview.panes[0].site,'a.test');assert.match(active.preview.panes[0].src,/^data:image\/jpeg;base64,/);assert.equal(active.preview.panes[1].internal,true);assert.equal(active.preview.panes[1].src,'');assert.equal(active.preview.panes[2].pane,'ai');f.bank.select('desk-1');f.browser.tabs.get('a').visible=false;f.browser.tabs.get('ai').visible=false;await f.previews.capture();assert.deepEqual(f.captures,['a','ai']);assert.ok(f.previews.snapshot().items[2].preview.panes[0].src);
});
test('navigation, including same URL navigation, invalidates cached content and never serves stale pixels',async()=>{
 const f=fixture(),{t}=f.add('a');f.bank.savePreferences({tree:L.preset(1),slots:{p1:'a'}});await f.previews.capture();assert.ok(f.previews.snapshot().items[2].preview.panes[0].src);t.navigationEpoch++;assert.equal(f.previews.snapshot().items[2].preview.panes[0].src,'');await f.previews.capture();f.records[0].url='https://different.test/';assert.equal(f.previews.snapshot().items[2].preview.panes[0].src,'');
});
test('privacy clear, lock and disposal invalidate delayed asynchronous captures',async()=>{
 for(const transition of ['clear','lock','dispose']){
  const f=fixture(),{t}=f.add('a');let finish;t.view.webContents.capturePage=()=>new Promise(resolve=>{finish=resolve;});const pending=f.previews.captureOne('a');await new Promise(r=>setImmediate(r));f.previews[transition]();finish(f.image);await pending;assert.equal(f.previews.cache.size,0);if(transition==='lock'){await f.previews.capture();assert.equal(f.previews.cache.size,0);f.previews.unlock();}
 }
});
test('a thumbnail capture finishing after Nora hides a page never asks Electron to reveal or keep it awake',async()=>{
 const f=fixture(),{t}=f.add('a');let finish,received;
 t.view.webContents.capturePage=(rect,options)=>{received={rect,options};return new Promise(resolve=>{finish=resolve;});};
 const work=f.previews.captureOne('a');await new Promise(resolve=>setImmediate(resolve));
 t.visible=false;
 assert.deepEqual(received,{rect:undefined,options:{stayHidden:true,stayAwake:false}});
 finish(f.image);await work;
 assert.equal(t.visible,false);assert.deepEqual(await f.previews.thumbnail('a'),{src:''});
});
test('late captures cannot cross desktops and cache stays bounded',async()=>{
 const f=fixture(),{t}=f.add('a');let finish;t.view.webContents.capturePage=()=>new Promise(resolve=>{finish=resolve;});const pending=f.previews.captureOne('a');await new Promise(r=>setImmediate(r));f.bank.select('desk-1');finish(f.image);await pending;assert.equal(f.previews.cache.size,0);f.bank.select('desk-3');for(let n=0;n<MAX_IMAGES+4;n++){f.add('p'+n);await f.previews.captureOne('p'+n);}assert.equal(f.previews.cache.size,MAX_IMAGES);assert.equal(f.previews.cache.has('p0'),false);assert.equal(f.previews.cache.has('p63'),true);
});
test('same ID replacement or closure invalidates cached image ownership',async()=>{
 const f=fixture();f.add('a');f.bank.savePreferences({tree:L.preset(1),slots:{p1:'a'}});await f.previews.capture();assert.ok(f.previews.cache.has('a'));const original=f.browser.tabs.get('a');f.browser.tabs.set('a',{...original});assert.equal(f.previews.snapshot().items[2].preview.panes[0].src,'');await f.previews.capture();f.records.length=0;f.browser.tabs.delete('a');assert.equal(f.previews.snapshot().items[2].preview.panes[0].id,'');assert.equal(f.previews.cache.size,0);
});
test('internal-only tabs remain represented and oversized images are omitted',async()=>{
 const f=fixture();f.add('start','desk-3',{internal:true});const {t}=f.add('large');f.bank.savePreferences({tree:L.preset(2),slots:{p1:'start',p2:'large'}});t.view.webContents.capturePage=async()=>({getSize:()=>({width:900}),resize(){return this;},toJPEG:()=>Buffer.alloc(256*1024+1)});await f.previews.capture();const panes=f.previews.snapshot().items[2].preview.panes;assert.equal(panes[0].id,'start');assert.equal(panes[1].src,'');assert.equal(f.previews.cache.size,0);
});
test('opening a burrow reuses one valid capture for thumbnails and preview snapshots within 750ms',async()=>{
 const f=fixture(),{t}=f.add('a');f.bank.savePreferences({tree:L.preset(1),slots:{p1:'a'}});await f.previews.capture();const first=await f.previews.thumbnail('a');await f.previews.capture();assert.deepEqual(f.captures,['a']);assert.match(first.src,/^data:image\/jpeg;base64,/);assert.equal(first.src,f.previews.snapshot().items[2].preview.panes[0].src);
 f.advance(751);await f.previews.thumbnail('a');assert.equal(f.captures.length,2);t.navigationEpoch++;await f.previews.thumbnail('a');assert.equal(f.captures.length,3);t.visible=false;assert.deepEqual(await f.previews.thumbnail('a'),{src:''});assert.equal(f.captures.length,3);
});
test('capture queue runs at most two native captures and never starts a queued hidden page',async()=>{
 const f=fixture(),finish=[];let active=0,maximum=0;for(const id of ['a','b','c','d']){const {t}=f.add(id);t.view.webContents.capturePage=()=>{f.captures.push(id);active++;maximum=Math.max(maximum,active);return new Promise(resolve=>finish.push(()=>{active--;resolve(f.image);}));};}
 const work=Promise.all(['a','b','c','d'].map(id=>f.previews.captureOne(id)));await new Promise(r=>setImmediate(r));assert.deepEqual(f.captures,['a','b']);assert.equal(maximum,2);
 f.browser.tabs.get('d').visible=false;finish.shift()();await new Promise(r=>setImmediate(r));assert.deepEqual(f.captures,['a','b','c']);finish.shift()();finish.shift()();await work;assert.equal(maximum,2);assert.equal(f.previews.activeCaptures,0);assert.equal(f.previews.captureWaiters.length,0);assert.equal(f.previews.pending.size,0);assert.ok(!f.previews.cache.has('d'));
});
test('clearing previews cancels queued captures and invalidates every running result',async()=>{
 const f=fixture(),finish=[];for(let i=0;i<18;i++){const {t}=f.add('p'+i);t.view.webContents.capturePage=()=>{f.captures.push(t.id);return new Promise(resolve=>finish.push(()=>resolve(f.image)));};}
 const work=Promise.all(Array.from({length:18},(_,i)=>f.previews.captureOne('p'+i)));await new Promise(r=>setImmediate(r));assert.equal(f.captures.length,2);assert.equal(f.previews.captureWaiters.length,12);f.previews.clear();for(const resolve of finish)resolve();await work;assert.equal(f.captures.length,2);assert.equal(f.previews.cache.size,0);assert.equal(f.previews.pending.size,0);assert.equal(f.previews.activeCaptures,0);
});
test('preview chip order and favicons follow current live tab metadata without taking captures',()=>{
 const f=fixture();f.add('a');const {record}=f.add('b');record.favicon='https://b.test/icon.png';f.bank.savePreferences({tree:L.preset(1),slots:{p1:'a'},tabOrder:['b','a']});
 let d=f.previews.snapshot().items[2];assert.deepEqual(d.preview.tabs.map(t=>t.id),['b','a']);assert.equal(d.preview.tabs[0].favicon,record.favicon);assert.equal(d.preview.tabs[0].placed,false);assert.equal(d.preview.tabs[1].placed,true);assert.equal(d.hiddenCount,1);assert.deepEqual(f.captures,[]);
 record.title='Updated title';d=f.previews.snapshot().items[2];assert.equal(d.preview.tabs[0].title,'Updated title');f.records.splice(1,1);f.browser.tabs.delete('b');d=f.previews.snapshot().items[2];assert.deepEqual(d.preview.tabs.map(t=>t.id),['a']);assert.equal(d.count,1);assert.deepEqual(f.captures,[]);
});
