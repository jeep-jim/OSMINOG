'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {DocumentService}=require('./mouse-documents.cjs'),{install}=require('./mouse-document-tabs.cjs'),{install:desktops}=require('./mouse-desktops.cjs'),L=require('./mouse/layout.js');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-document-tabs-'));let privacy=false,seq=0;const choices={close:2,open:path.join(root,'notes.txt'),save:path.join(root,'copy.txt')},handlers=new Map(),saved={},emissions=[];
 await fs.writeFile(choices.open,'Original');
 const documents=new DocumentService({isPrivate:()=>privacy,dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[choices.open]}),showSaveDialog:async()=>({canceled:!choices.save,filePath:choices.save}),showMessageBox:async()=>({response:choices.close})}});
 const browser={project:'mouse',tabs:new Map(),providers:new Map(),mouseSearch:{resolve:input=>{if(input==='bad:')throw Error('Invalid address');return'https://example.test/'+input;}},state(){return{tabs:[...this.tabs.values()].map(p=>({id:p.id,title:p.title,url:p.url,lane:'main'}))};},make(url){const page={id:'page-'+(++seq),title:'Page',url,view:{webContents:{}}};this.tabs.set(page.id,page);return page;},layout(){},save:async()=>{},dispose(){this.disposed=true;},emit(){emissions.push(this.state());},async command(action,args={}){if(action==='close'){this.tabs.delete(args.id);this.emit();}return this.state();}};
 const closeDocument=(id,commit)=>documents.closeDocument(id,async()=>({bytes:new TextEncoder().encode('Saved')}),commit);
 install({browser,documents,closeDocument});
 const service=await desktops({browser,store:{get:async()=>saved,set:async value=>Object.assign(saved,structuredClone(value))},win:{isDestroyed:()=>false,webContents:{send(){}}},ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},trusted:()=>{}});
 const call=(action,args)=>handlers.get('mouse:desktops')({},action,args);
 t.after(async()=>{browser.dispose();documents.dispose();await fs.rm(root,{recursive:true,force:true});});return{root,browser,documents,service,call,choices,emissions,privacy:value=>{privacy=value;}};
}
test('documents use the ordinary tab bank without allocating WebContents and keep their desk while edited',async t=>{
 const f=await fixture(t),info=await f.documents.handle('open');let state=f.browser.state();assert.equal(f.browser.tabs.size,0);assert.equal(state.tabs[0].id,info.id);assert.equal(state.tabs[0].documentId,info.id);assert.equal(state.tabs[0].internal,true);assert.equal(f.service.bank.members[info.id],'desk-3');
 await f.call('move-tab',{id:info.id,desk:'desk-1'});assert.equal(f.browser.state().tabs.length,0);f.documents.draft(info.id,{text:'Moved edit'});assert.equal(f.service.bank.members[info.id],'desk-1');assert.equal(f.browser.state().desktops.items[0].tabs[0].id,info.id);assert.equal(f.browser.tabs.size,0);
 await f.call('switch',{id:'desk-1'});assert.equal(f.browser.state().tabs[0].dirty,true);assert.equal(f.documents.read(info.id).draft.text,'Moved edit');
});
test('ordinary tab close honors cancel, cancelled Save As and successful save before release',async t=>{
 const f=await fixture(t),info=await f.documents.handle('open');f.documents.draft(info.id,{text:'Unsaved'});let state=await f.browser.command('close',{id:info.id});assert.equal(state.cancelled,true);assert.equal(f.documents.read(info.id).dirty,true);
 f.choices.close=0;f.choices.save=null;state=await f.browser.command('close',{id:info.id});assert.equal(state.cancelled,true);assert.equal(f.service.bank.members[info.id],'desk-3');
 f.choices.save=path.join(f.root,'copy.txt');state=await f.browser.command('close',{id:info.id});assert.equal(state.cancelled,undefined);assert.equal(await fs.readFile(f.choices.save,'utf8'),'Saved');assert.equal(f.documents.records.has(info.id),false);assert.equal(f.service.bank.members[info.id],undefined);
});
test('cancelled pane removal leaves both layout and dirty document intact, including inactive-desk preview close',async t=>{
 const f=await fixture(t),info=await f.documents.handle('open');f.documents.draft(info.id,{text:'Keep'});await f.service.savePreferences({...f.service.preferences(),tree:L.preset(2),slots:{p1:info.id},active:'p1'});const before=f.service.preferences();
 const current={...before,tree:{...before.tree,ratio:.64}},result=await f.call('close-tab',{id:info.id,from:'desk-3',preferences:current,afterClosePreferences:{...current,tree:L.preset(1),slots:{},active:'p1'}});assert.equal(result.cancelled,true);assert.deepEqual(result.preferences,current);assert.equal(f.documents.read(info.id).dirty,true);
 await f.call('move-tab',{id:info.id,desk:'desk-1'});const preview=await f.call('close-tab',{id:info.id});assert.equal(preview.cancelled,true);assert.equal(f.service.bank.members[info.id],'desk-1');assert.equal(f.browser.state().desktopId,'desk-3');
});
test('document navigation validates first, preserves cancellation and replaces the same tab ID after discard',async t=>{
 const f=await fixture(t),info=await f.documents.handle('open');await f.service.savePreferences({...f.service.preferences(),slots:{p1:info.id},tabOrder:[info.id]});f.documents.draft(info.id,{text:'Keep until discard'});
 await assert.rejects(f.browser.command('navigate',{id:info.id,url:'bad:'}),/Invalid address/);assert.equal(f.documents.records.has(info.id),true);
 const cancelled=await f.browser.command('navigate',{id:info.id,url:'next'});assert.equal(cancelled.cancelled,true);assert.equal(f.browser.tabs.size,0);assert.equal(f.service.preferences().slots.p1,info.id);
 f.choices.close=1;f.emissions.length=0;await f.browser.command('navigate',{id:info.id,url:'next'});assert.equal(f.documents.records.has(info.id),false);assert.equal(f.browser.tabs.size,1);assert.equal(f.browser.tabs.get(info.id).url,'https://example.test/next');assert.equal(f.service.preferences().slots.p1,info.id);assert.deepEqual(f.service.preferences().tabOrder,[info.id]);assert.ok(f.emissions.every(s=>s.tabs.some(tab=>tab.id===info.id)),'no emitted empty tab state may erase the selected pane');
});
test('privacy clearing removes document descriptors and disposing removes subscriptions',async t=>{
 const f=await fixture(t),info=await f.documents.handle('open');assert.equal(f.documents.listeners.size,1);f.documents.clear();f.privacy(true);assert.equal(f.browser.state().tabs.length,0);assert.throws(()=>f.documents.read(info.id),/недоступен/);await f.documents.handle('open');assert.equal(f.browser.state().tabs.length,0,'private document never appears in normal state');f.browser.dispose();assert.equal(f.documents.listeners.size,0);
});
test('dirty release cannot bypass the ordinary tab close guard',async t=>{const f=await fixture(t),info=await f.documents.handle('open');f.documents.draft(info.id,{text:'Keep'});await assert.rejects(f.documents.handle('release',{id:info.id}),/через его вкладку/);assert.equal(f.documents.read(info.id).dirty,true);});
test('typing keeps stale-write generations without repeating unchanged browser tab metadata',async t=>{const f=await fixture(t),info=await f.documents.handle('open');f.emissions.length=0;for(let i=0;i<100;i++)f.documents.draft(info.id,undefined,0);assert.equal(f.documents.records.get(info.id).editGeneration,100);assert.equal(f.emissions.length,1);f.documents.draft(info.id,{text:'A final full draft'},0);assert.equal(f.documents.records.get(info.id).editGeneration,101);assert.equal(f.emissions.length,1);assert.equal(f.documents.read(info.id).draft.text,'A final full draft');});
