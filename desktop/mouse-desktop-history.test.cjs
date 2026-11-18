'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DesktopBank,install,HISTORY_LIMIT,HISTORY_BYTES}=require('./mouse-desktops.cjs');
const L=require('./mouse/layout.js');
const copy=x=>structuredClone(x);
const pages=[{id:'one',lane:'main'},{id:'two',lane:'main'},{id:'three',lane:'main'},{id:'ai',lane:'side'}];
const custom=()=>({tree:{axis:'x',ratio:.37,a:{id:'p1'},b:{axis:'y',ratio:.63,a:{id:'p2'},b:{id:'p3'}}},slots:{p1:'one',p2:'two',p3:'three'},active:'p2',tabOrder:['three','one','two','ai'],aiOpen:true,aiId:'ai',aiWidth:412,aiSessions:{'https://chat.example/':'ai'},mode:'',agentOpen:false});
function makeBank(p=custom()){const b=new DesktopBank(null,p);b.reconcile(pages);return b;}
function edit(b,p,meta={reason:'layout'},tabs=pages){assert.equal(b.savePreferences({...b.preferences(),...p},meta,tabs),true);return copy(b.current().layout);}
function fixture(saved={}){
 const handlers=new Map(),writes=[],effects=[],tabs=new Map();let sequence=0,emits=0;
 const browser={tabs,providers:new Map(),panels:[],state(){return{tabs:[...tabs.values()].map(t=>({id:t.id,title:t.title,url:t.url,lane:t.lane,internal:!!t.internal}))};},make(options={}){const id=options.id||'tab-'+(++sequence),t={id,title:options.title||id,url:options.url||'https://example.test/'+id,lane:options.lane||'main',visible:false,view:{webContents:{destroyed:false,isDestroyed(){return this.destroyed;}}}};tabs.set(id,t);return t;},save:async()=>{},layout(p){this.panels=p;},dispose(){this.disposed=true;},emit(){emits++;return this.state();},async command(action,args={}){effects.push([action,copy(args)]);if(action==='open'){const t=this.make(args);return{id:t.id};}if(action==='close'){const t=tabs.get(args.id);if(t)t.view.webContents.destroyed=true;tabs.delete(args.id);return this.state();}if(action==='state')return this.state();return true;}};
 return{browser,handlers,saved,writes,effects,get emits(){return emits;},store:{async get(){return copy(saved);},async set(value){writes.push(copy(value));Object.assign(saved,copy(value));}},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},trusted:e=>{if(!e.trusted)throw Error('Untrusted frame');}};
}
async function host(f){const service=await install(f);return{service,call:(action,args={})=>f.handlers.get('mouse:desktops')({trusted:true},action,args)};}

test('history restores exact trees, ratios, order and AI settings; selector-only and focus changes create no checkpoint',()=>{
 const b=makeBank(),original=copy(b.current().layout),initialId=b.historyState().currentId;
 edit(b,{agentOpen:true,active:'p3'},{reason:'ai-panel'});assert.equal(b.historyState().currentId,initialId);assert.equal(b.historyState().undoCount,0);
 const before=copy(b.current().layout),tree=copy(before.tree);tree.ratio=.72;tree.b.ratio=.28;
 const after=edit(b,{tree,slots:{p1:'two',p2:'three'},tabOrder:['ai','two','one','three'],active:'p1',aiOpen:false,aiWidth:560,agentOpen:false},{reason:'resize'}),afterId=b.historyState().currentId;
 assert.equal(b.historyState().undoCount,1);assert.equal(b.historyState().undoReason,'resize');assert.equal(b.stepHistory('undo',pages),true);assert.deepEqual(b.current().layout,before);assert.equal(b.historyState().currentId,initialId);assert.equal(b.historyState().redoReason,'resize');
 assert.equal(b.stepHistory('redo',pages),true);assert.deepEqual(b.current().layout,after);assert.equal(b.historyState().currentId,afterId);assert.deepEqual(original.tree,before.tree);
});

test('layout history and stable IDs survive restart, including redo and separate desks',()=>{
 const b=makeBank(),first=copy(b.current().layout);edit(b,{tree:L.preset(2),slots:{p1:'one',p2:'two'},aiWidth:480},{reason:'split'});const second=copy(b.current().layout);edit(b,{aiWidth:600},{reason:'ai-resize'});const thirdId=b.historyState().currentId;
 b.stepHistory('undo',pages);const before=copy(b.historyState('desk-3',true)),restart=new DesktopBank(b.snapshot(),b.preferences());restart.reconcile(pages);assert.deepEqual(restart.historyState('desk-3',true),before);assert.deepEqual(restart.current().layout,second);restart.stepHistory('redo',pages);assert.equal(restart.historyState().currentId,thirdId);assert.equal(restart.preferences().aiWidth,600);
 restart.select('desk-1');edit(restart,{tree:L.preset(4)},{reason:'layout'});assert.equal(restart.historyState().undoCount,1);restart.stepHistory('undo',pages);assert.equal(L.leaves(restart.preferences().tree).length,1);restart.select('desk-3');restart.stepHistory('undo',pages);restart.stepHistory('undo',pages);assert.deepEqual(restart.current().layout,first);
});

test('divider gesture coalesces many writes into one step and a cancelled drag preserves redo',()=>{
 const b=makeBank(),original=copy(b.current().layout),initialId=b.historyState().currentId;
 for(let i=0;i<40;i++){const tree=copy(original.tree);tree.ratio=.4+i/100;edit(b,{tree},{reason:'resize',group:'pointer-17',commit:false});}
 edit(b,{}, {reason:'resize',group:'pointer-17',commit:true});assert.equal(b.historyState().undoCount,1);const changed=copy(b.current().layout),changedId=b.historyState().currentId;
 b.stepHistory('undo',pages);assert.deepEqual(b.current().layout,original);assert.equal(b.historyState().redoCount,1);
 const tree=copy(original.tree);tree.ratio=.55;edit(b,{tree},{reason:'resize',group:'pointer-18',commit:false});edit(b,{tree:original.tree},{reason:'resize',group:'pointer-18',commit:true});assert.equal(b.historyState().currentId,initialId);assert.equal(b.historyState().undoCount,0);assert.equal(b.historyState().redoCount,1);b.stepHistory('redo',pages);assert.deepEqual(b.current().layout,changed);assert.equal(b.historyState().currentId,changedId);
 b.stepHistory('undo',pages);edit(b,{aiWidth:701},{reason:'ai-resize'});assert.equal(b.historyState().redoCount,0);
});

test('closed or transferred IDs are pruned in every checkpoint without filling their slots or reopening pages',()=>{
 const b=makeBank();edit(b,{tree:L.preset(2),slots:{p1:'two',p2:'one'}},{reason:'layout'});edit(b,{tree:L.preset(4),slots:{p1:'one',p3:'three'}},{reason:'split'});
 const live=pages.filter(p=>p.id!=='one'),extra={id:'new',lane:'main'};live.push(extra);b.reconcile(live);
 b.move('two','desk-1',undefined,live);b.stepHistory('undo',live);b.stepHistory('undo',live);
 assert.equal(b.preferences().slots.p1,undefined);assert.equal(b.preferences().slots.p2,undefined);assert.equal(b.preferences().slots.p3,'three');assert.equal(b.members.two,'desk-1');assert.equal(b.members.new,'desk-3');assert.ok(!b.preferences().tabOrder.includes('one'));assert.ok(!b.preferences().tabOrder.includes('two'));assert.ok(b.ordered('desk-3',live).some(t=>t.id==='new'));
 for(const e of b.historyState('desk-3',true).entries){assert.ok(!Object.values(e.slots).includes('one'));assert.ok(!Object.values(e.slots).includes('two'));assert.ok(!e.tabOrder.includes('one'));assert.ok(!e.tabOrder.includes('two'));}
 const restart=new DesktopBank(b.snapshot());restart.reconcile(live);while(restart.historyState().canRedo)restart.stepHistory('redo',live);assert.equal(restart.members.one,undefined);assert.equal(restart.members.two,'desk-1');
});

test('history has both a step bound and a byte bound, including untrusted saved histories',()=>{
 const b=makeBank();for(let i=0;i<50;i++)edit(b,{aiWidth:300+i},{reason:'ai-resize'});assert.equal(b.historyState().undoCount,HISTORY_LIMIT);assert.equal(b.historyState('desk-3',true).entries.length,HISTORY_LIMIT+1);assert.equal(new DesktopBank(b.snapshot()).historyState().undoCount,HISTORY_LIMIT);
 const big=new DesktopBank(),many=Array.from({length:1000},(_,i)=>({id:'tab-'+i+'x'.repeat(90),lane:'main'}));big.reconcile(many);
 for(let i=0;i<12;i++)edit(big,{tabOrder:many.map(t=>t.id),tree:L.preset(i%2?2:3),aiWidth:300+i},{reason:'layout'},many);
 assert.ok(big.historyState().undoCount<HISTORY_LIMIT);assert.ok(big.historyState().undoCount>0);assert.ok(Buffer.byteLength(JSON.stringify(big.current().history))<=HISTORY_BYTES);
 const snapshot=big.snapshot(),h=snapshot.items[2].history;h.past.push({id:'bad',createdAt:1,reason:'bad',layout:{tree:{evil:true}}});h.past.push(copy(h.past[0]));const restarted=new DesktopBank(snapshot);assert.equal(new Set(restarted.historyState('desk-3',true).entries.map(e=>e.id)).size,restarted.historyState('desk-3',true).entries.length);assert.ok(!restarted.historyState('desk-3',true).entries.some(e=>e.id==='bad'));assert.ok(Buffer.byteLength(JSON.stringify(restarted.current().history))<=HISTORY_BYTES);
});

test('title, favicon and session metadata preserve history identity, bounds and redo',()=>{
 const b=makeBank();edit(b,{aiWidth:488},{reason:'ai-resize'});b.stepHistory('undo',pages);const initial=copy(b.historyState('desk-3',true));
 for(let i=0;i<60;i++){b.reconcile(pages.map(p=>({...p,title:'Updated '+i,favicon:'https://icons.test/'+i})));edit(b,{theme:i%2?'light':'dark',agentOpen:!!(i%2),active:i%2?'p1':'p2',aiSessions:{'https://new.example/':'ai'}},{reason:'metadata'});}
 assert.equal(b.historyState().currentId,initial.currentId);assert.equal(b.historyState().undoCount,initial.undoCount);assert.equal(b.historyState().redoCount,initial.redoCount);assert.equal(b.historyState('desk-3',true).entries.at(-1).id,initial.entries.at(-1).id);assert.ok(!JSON.stringify(b.historyState('desk-3',true)).includes('https://'));assert.ok(!Object.hasOwn(b.describe(pages).items[2].history,'entries'));
});

test('atomic history jumps retain a valid past/future cursor and branch only after a new edit',()=>{
 const b=makeBank(),states=[copy(b.current().layout)],ids=[b.historyState().currentId];for(const width of [440,500,650,700]){states.push(edit(b,{aiWidth:width},{reason:'ai-resize'}));ids.push(b.historyState().currentId);}
 assert.equal(b.restoreLayout(ids[1],pages),true);assert.deepEqual(b.current().layout,states[1]);assert.equal(b.historyState().undoCount,1);assert.equal(b.historyState().redoCount,3);
 assert.equal(b.restoreLayout(ids[4],pages),true);assert.deepEqual(b.current().layout,states[4]);assert.equal(b.historyState().undoCount,4);assert.equal(b.historyState().redoCount,0);
 b.restoreLayout(ids[0],pages);assert.deepEqual(b.current().layout,states[0]);assert.deepEqual(b.historyState('desk-3',true).entries.map(e=>e.id),ids);assert.equal(b.restoreLayout(ids[0],pages),false);
 b.restoreLayout(ids[2],pages);edit(b,{aiWidth:900},{reason:'ai-resize'});assert.equal(b.historyState().redoCount,0);assert.throws(()=>b.restoreLayout(ids[4],pages),/недоступно/);
});

test('old agents mode migrates Agent visibility without rewriting layout or recording selector-only history',()=>{
 const p={...custom(),mode:'agents'};delete p.agentOpen;const b=makeBank(p);assert.equal(b.preferences().agentOpen,true);assert.deepEqual(b.preferences().tree,p.tree);assert.equal(b.historyState().undoCount,0);edit(b,{agentOpen:false},{reason:'ai-panel'});assert.equal(b.preferences().mode,'agents');assert.equal(b.historyState().undoCount,0);const restored=new DesktopBank(b.snapshot());assert.equal(restored.preferences().agentOpen,false);
});

test('host serializes saves with undo, awaits agent stop, preserves page objects and persists after shell restart',async()=>{
 const f=fixture();for(const p of pages)f.browser.make(p);f.saved.quadroPreferences=custom();const {service,call}=await host(f),original=copy(service.preferences()),identities=[...f.browser.tabs.values()];let releaseStop;const stopGate=new Promise(r=>{releaseStop=r;});f.browser.mouseBeforeDesktopChange=()=>stopGate;
 const tree=copy(original.tree);tree.ratio=.76;const saving=service.savePreferences({...original,tree},{reason:'resize'}),undo=call('undo',{from:'desk-3'});await saving;await new Promise(r=>setImmediate(r));assert.equal(service.preferences().tree.ratio,.76);releaseStop();const undone=await undo;assert.equal(undone.changed,true);assert.deepEqual(undone.preferences,original);assert.equal(undone.history.canRedo,true);assert.deepEqual([...f.browser.tabs.values()],identities);assert.deepEqual(f.effects,[]);assert.equal(Object.hasOwn(undone.state.layoutHistory,'entries'),false);
 await service.flush();const f2=fixture(copy(f.saved));for(const p of pages)f2.browser.make(p);const host2=await host(f2),redone=await host2.call('redo',{from:'desk-3'});assert.equal(redone.preferences.tree.ratio,.76);assert.equal(redone.history.currentId,f.saved.mouseDesktopsV1.items[2].history.future.at(-1).id);assert.deepEqual(f2.effects,[]);f.browser.dispose();f2.browser.dispose();
});

test('host mode application checkpoints custom layout and selector save preserves grid and existing page identities',async()=>{
 const f=fixture();for(const p of pages)f.browser.make(p);f.saved.quadroPreferences=custom();const {service,call}=await host(f),original=copy(service.preferences()),identities=[...f.browser.tabs.values()];
 await service.savePreferences({...original,agentOpen:true},{reason:'ai-panel'});assert.deepEqual(service.preferences().tree,original.tree);assert.deepEqual(service.preferences().slots,original.slots);assert.equal(service.preferences().aiOpen,true);assert.equal(service.preferences().aiId,'ai');assert.equal(service.bank.historyState().undoCount,0);assert.equal(service.state().desktops.items[2].paneCount,3);
 const applied=await call('apply-mode',{mode:'agents',from:'desk-3',preferences:service.preferences()});assert.equal(applied.preferences.agentOpen,true);assert.equal(applied.preferences.aiOpen,false);assert.equal(applied.state.layoutHistory.undoCount,1);assert.equal(applied.state.layoutHistory.undoReason,'mode:agents');assert.deepEqual(f.effects,[]);
 const repeated=await call('apply-mode',{mode:'agents',from:'desk-3',preferences:service.preferences()});assert.equal(repeated.state.layoutHistory.currentId,applied.state.layoutHistory.currentId);assert.equal(repeated.state.layoutHistory.undoCount,1);assert.deepEqual(repeated.preferences.tabOrder,['one','two','three','ai']);
 const undo=await call('undo',{from:'desk-3',preferences:service.preferences()});assert.deepEqual(undo.preferences,{...original,agentOpen:true});assert.deepEqual([...f.browser.tabs.values()],identities);assert.deepEqual(f.effects,[]);await call('apply-mode',{mode:'design',from:'desk-3'});assert.equal(service.preferences().agentOpen,false);f.browser.dispose();
});

test('actual host close removes ID from every history state; undo never reloads or fills the vacant pane',async()=>{
 const f=fixture();for(const p of pages)f.browser.make(p);f.saved.quadroPreferences=custom();const {service,call}=await host(f),closed=f.browser.tabs.get('one'),identities=[...f.browser.tabs.values()].filter(t=>t!==closed);
 await service.savePreferences({...service.preferences(),tree:L.preset(2),slots:{p1:'one',p2:'two'}},{reason:'layout'});await call('close-tab',{id:'one',from:'desk-3'});assert.equal(closed.view.webContents.isDestroyed(),true);const undone=await call('undo',{from:'desk-3'});assert.equal(undone.preferences.slots.p1,undefined);assert.equal(undone.preferences.slots.p2,'two');assert.equal(undone.preferences.slots.p3,'three');assert.deepEqual([...f.browser.tabs.values()],identities);assert.deepEqual(f.effects.map(e=>e[0]),['close']);assert.equal(undone.state.desktops.items[2].count,3);assert.ok(undone.history.entries.every(e=>!Object.values(e.slots).includes('one')));f.browser.dispose();
});

test('invalid, stale or untrusted history requests cannot alter settings or discard redo',async()=>{
 const f=fixture();for(const p of pages)f.browser.make(p);f.saved.quadroPreferences=custom();const {service,call}=await host(f);await service.savePreferences({...service.preferences(),aiWidth:500},{reason:'ai-resize'});await call('undo');const snapshot=copy(service.bank.snapshot()),prefs={...service.preferences(),tree:L.preset(7),slots:{}};
 await assert.rejects(call('restore-layout',{historyId:'not-a-history-id',preferences:prefs}),/недоступно/);await assert.rejects(call('undo',{from:'desk-1',preferences:prefs}),/уже изменился/);await assert.rejects(f.handlers.get('mouse:desktops')({},'redo',{}),/Untrusted/);assert.deepEqual(service.bank.snapshot(),snapshot);assert.deepEqual(f.effects,[]);
 const history=await call('history-state',{from:'desk-3'}),restored=await call('restore-layout',{historyId:history.entries.at(-1).id,from:'desk-3',preferences:service.preferences()});assert.equal(restored.preferences.aiWidth,500);assert.equal(restored.history.currentId,history.entries.at(-1).id);assert.equal(restored.history.canRedo,false);f.browser.dispose();
});

test('preview save persists the layout checkpoint, while compact repeated saves write nothing',async()=>{
 const f=fixture();for(const p of pages)f.browser.make(p);f.saved.quadroPreferences=custom();const {service,call}=await host(f);await call('previews',{from:'desk-3',preferences:{...service.preferences(),aiWidth:590},history:{reason:'ai-resize'}});assert.equal(f.saved.mouseDesktopsV1.items[2].history.past.length,1);assert.equal(f.saved.quadroPreferences.aiWidth,590);const writes=f.writes.length;
 await Promise.all(Array.from({length:20},()=>service.savePreferences(service.preferences())));assert.equal(f.writes.length,writes);await service.flush();f.browser.dispose();
});

test('restoring a selected future atomically checkpoints an accompanying unsaved edit',async()=>{
 const f=fixture();for(const p of pages)f.browser.make(p);f.saved.quadroPreferences=custom();const {service,call}=await host(f);await service.savePreferences({...service.preferences(),aiWidth:500},{reason:'ai-resize'});await service.savePreferences({...service.preferences(),aiWidth:650},{reason:'ai-resize'});const selected=(await call('history-state')).currentId;await call('undo');
 const result=await call('restore-layout',{historyId:selected,from:'desk-3',preferences:{...service.preferences(),aiWidth:720},history:{reason:'ai-resize'}});assert.equal(result.history.currentId,selected);assert.equal(result.preferences.aiWidth,650);assert.equal(result.changed,true);assert.deepEqual(f.effects,[]);const undone=await call('undo');assert.equal(undone.preferences.aiWidth,720);assert.equal(undone.history.canRedo,true);f.browser.dispose();
});

test('new live tabs append to older checkpoint orders without clearing redo on renderer flush or restart',()=>{
 const initial=[{id:'a',lane:'main'},{id:'b',lane:'main'}],b=new DesktopBank(null,{tree:L.preset(2),slots:{p1:'a',p2:'b'},tabOrder:['b','a']});b.reconcile(initial);
 edit(b,{tree:L.preset(3)},{reason:'split'},initial);const live=[...initial,{id:'new',lane:'main'}];b.reconcile(live);edit(b,{slots:{p1:'a',p2:'b',p3:'new'},tabOrder:['b','new','a']},{reason:'tab-order'},live);
 b.stepHistory('undo',live);b.stepHistory('undo',live);assert.equal(b.historyState().redoCount,2);assert.deepEqual(b.preferences().tabOrder,['b','a','new']);assert.deepEqual(b.preferences().slots,{p1:'a',p2:'b'});
 const before=copy(b.historyState('desk-3',true)),restart=new DesktopBank(b.snapshot(),b.preferences());restart.reconcile(live);
 // This is the complete tab order emitted by browser.js prefs() on startup.
 const rendererPreferences={...restart.preferences(),tabOrder:restart.ordered(restart.active,live).map(t=>t.id)};restart.savePreferences(rendererPreferences,{},live);assert.deepEqual(restart.historyState('desk-3',true),before);
 restart.stepHistory('redo',live);assert.deepEqual(restart.preferences().tabOrder,['b','a','new']);assert.equal(restart.preferences().slots.p3,undefined);restart.stepHistory('redo',live);assert.deepEqual(restart.preferences().tabOrder,['b','new','a']);assert.equal(restart.preferences().slots.p3,'new');
});
