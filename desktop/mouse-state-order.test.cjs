'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),L=require('./mouse/layout.js'),Modes=require('./mouse/modes.js'),MouseTabOrder=require('./mouse/mouse-613-ui.js');
const copy=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function snapshot(revision,tabs,{epoch='unit-normal',desk='desk-2'}={}){return{snapshot:{epoch,revision},desktopId:desk,tabs:copy(tabs)};}
function renderer(){
 const old=Array.from({length:10},(_,i)=>({id:'old-'+i,lane:'main',title:'Existing '+i})),added=Array.from({length:5},(_,i)=>({id:'design-'+i,lane:'main',title:'Design '+i})),tabs=[...old,...added];
 const layout=Modes.arranged('design',tabs,{}, {selectedIds:added.map(t=>t.id)}),initial=snapshot(19,old),fresh=snapshot(21,tabs);
 const model={...copy(layout),desktopId:'desk-2',state:initial,ready:true,switching:false,pinnedPanes:{},aiPreviewId:'',aiSessions:{},aiSites:[],appearance:{},active:'p1'},calls={save:0,render:0,layout:0},noop=()=>{};
 const ctx=vm.createContext({m:model,L,MouseTabOrder,mediaWidget:null,pendingState:null,desktopUI:{render:noop},progressUI:{render:noop},renderTabs:()=>calls.render++,syncPaneLabels:noop,syncAIIcon:noop,syncAIPreview:noop,applySide:()=>calls.layout++,save:()=>calls.save++});
 const line=prefix=>source.split('\n').find(row=>row.trimStart().startsWith(prefix));
 // Both runs execute the checked-out production functions. On the old source
 // there is no receiver; the regression still reaches its real reconcile().
 const receiver=source.includes('function createStateReceiver(')?section(' function createStateReceiver(','\n const stateReceiver=')+'\nconst stateReceiver=createStateReceiver(m);globalThis.receiver=stateReceiver;':'';
 vm.runInContext([line('const tab='),line('const prefs='),line('function reconcile('),receiver,line('function acceptDesktopResult('),section(' function receiveState(','\n N.onState('),'globalThis.receive=receiveState;globalThis.acceptResult=acceptDesktopResult;'].join('\n'),ctx);
 if(ctx.receiver)ctx.receiver.init(initial,'desk-2');
 return{ctx,model,calls,old,added,tabs,layout,initial,fresh};
}
function acceptDesign(f,revision=21){const state=snapshot(revision,f.tabs);f.ctx.acceptResult({state,preferences:{...copy(f.layout),desktopId:'desk-2'}});return state;}
function receiver(model){const ctx=vm.createContext({model});vm.runInContext(section(' function createStateReceiver(','\n const stateReceiver=')+'\nglobalThis.receiver=createStateReceiver(model);',ctx);return ctx.receiver;}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('older push after an accepted invoke result cannot clear live preset slots or save that loss',()=>{
 const f=renderer(),result={state:f.fresh,preferences:{...copy(f.layout),desktopId:'desk-2'}};
 f.ctx.acceptResult(result);const expected=copy(f.model.slots),state=f.model.state;
 f.ctx.receive(snapshot(20,f.old));
 assert.deepEqual(f.model.slots,expected,'The older ten-tab push must not erase the five newer Design bindings');
 assert.equal(f.model.state,state);assert.deepEqual(f.calls,{save:0,render:0,layout:0});
});

test('the observed native221 result then equivalent220 push keeps the newer accepted revision',()=>{
 const f=renderer(),state=acceptDesign(f,221),before=copy(f.model.slots);f.ctx.receive(snapshot(220,f.tabs));
 assert.equal(f.model.state,state);assert.equal(f.model.state.snapshot.revision,221);assert.deepEqual(f.model.slots,before);assert.deepEqual(f.calls,{save:0,render:0,layout:0});
});

test('fresh title, loading, navigation and real closure still update the current desktop',()=>{
 const f=renderer();acceptDesign(f);let revision=21;
 for(const change of [{title:'Current title'},{loading:true},{url:'https://next.test/',back:true}]){
  const tabs=copy(f.model.state.tabs);Object.assign(tabs[10],change);f.ctx.receive(snapshot(++revision,tabs));
  for(const [key,value]of Object.entries(change))assert.equal(f.model.state.tabs[10][key],value);
 }
 assert.deepEqual(f.calls,{save:0,render:3,layout:0});const removed=f.model.slots.p3;
 f.ctx.receive(snapshot(++revision,f.model.state.tabs.filter(tab=>tab.id!==removed)));
 assert.equal(f.model.slots.p3,'');assert.equal(f.model.state.tabs.length,14);assert.deepEqual(f.calls,{save:1,render:4,layout:1});
});

test('rejected older or foreign desktop results cannot replace associated preferences',()=>{
 const f=renderer();acceptDesign(f);const state=f.model.state,before=copy(f.model),preferences={...copy(f.layout),mode:'support',slots:{p1:'old-0'},tree:L.preset(1),desktopId:'desk-2'};
 for(const value of [{state:snapshot(20,f.old),preferences},{state:snapshot(1000,f.old,{epoch:'unit-private'}),preferences},{state:snapshot(1001,f.old,{desk:'desk-5'}),preferences:{...preferences,desktopId:'desk-5'}}]){
  assert.equal(f.ctx.acceptResult(value),false);assert.equal(f.model.state,state);assert.deepEqual(copy(f.model),before);
 }
});

test('switching and foreign pushes do not advance the accepted watermark',()=>{
 const f=renderer();acceptDesign(f);f.model.switching=true;f.ctx.receive(snapshot(900,f.old));f.model.switching=false;
 f.ctx.receive(snapshot(901,f.old,{desk:'desk-5'}));f.ctx.receive(snapshot(902,f.old,{epoch:'unit-private'}));
 const fresh=snapshot(22,f.tabs.map(tab=>({...tab,title:'newer accepted'})));f.ctx.receive(fresh);assert.equal(f.model.state,fresh);assert.equal(f.model.slots.p1,'design-0');assert.equal(f.calls.save,0);
});

test('pre-init buckets retain the newest matching owner and desktop despite foreign interleaving',()=>{
 const model={state:{tabs:[]},desktopId:'desk-2'},r=receiver(model),initial=snapshot(2,[]),a3=snapshot(3,[{id:'current'}]);
 r.queue(a3);r.queue(snapshot(100,[],{epoch:'foreign'}));r.queue(snapshot(999,[],{desk:'desk-5'}));r.queue(snapshot(1,[]));
 assert.equal(r.pendingCount,3);assert.equal(r.init(initial,'desk-2'),true);assert.equal(model.state,a3);assert.equal(r.pendingCount,0);
 assert.equal(r.accept(snapshot(101,[],{epoch:'foreign'})),false);assert.equal(r.accept(snapshot(4,[{id:'later'}])),true);
 assert.throws(()=>r.init(snapshot(1,[],{epoch:'foreign'}),'desk-2'),/начальное состояние/);
});

test('pre-init buffering is bounded and does not clone page state',()=>{
 const model={state:{tabs:[]},desktopId:'desk-2'},r=receiver(model);for(let i=0;i<24;i++){r.queue(snapshot(1,[],{epoch:'foreign-'+i}));assert.ok(r.pendingCount<=16);}
 const own=snapshot(3,[{id:'owned'}]);r.queue(own);r.init(snapshot(2,[]),'desk-2');assert.equal(model.state,own);assert.equal(r.pendingCount,0);
});

test('normal, private and reloaded renderers bind independent canonical epochs',()=>{
 const normal={state:{tabs:[]},desktopId:'desk-2'},privateModel={state:{tabs:[]},desktopId:'desk-2'},n=receiver(normal),p=receiver(privateModel);
 n.init(snapshot(100,[{id:'normal'}]),'desk-2');p.init(snapshot(1,[{id:'private'}],{epoch:'unit-private'}),'desk-2');
 assert.equal(n.accept(snapshot(101,[],{epoch:'unit-private'})),false);assert.equal(p.accept(snapshot(102,[])),false);
 assert.equal(n.accept(snapshot(101,[{id:'normal-new'}])),true);assert.equal(p.accept(snapshot(2,[{id:'private-new'}],{epoch:'unit-private'})),true);
 const reloaded={state:{tabs:[]},desktopId:'desk-2'},r=receiver(reloaded);r.init(snapshot(103,[{id:'normal-new'}]),'desk-2');assert.equal(r.accept(snapshot(102,[])),false);assert.equal(r.accept(snapshot(104,[{id:'normal-new'}])),true);
});

test('fresh direct native cleanup assignment remains a high-water mark without changing retained fixtures',()=>{
 const f=renderer();acceptDesign(f);const direct=snapshot(50,f.tabs);f.model.state=direct;
 f.ctx.receive(snapshot(49,f.old));assert.equal(f.model.state,direct);assert.equal(f.ctx.receiver.accept(snapshot(48,f.old)),false);assert.equal(f.ctx.receiver.accept(snapshot(51,f.tabs)),true);
 assert.equal(f.model.slots.p1,'design-0');assert.equal(f.calls.save,0);
});

test('malformed snapshot stamps cannot replace accepted state or poison bootstrap buckets',()=>{
 const f=renderer();acceptDesign(f);const current=f.model.state;
 for(const value of [{},null,{epoch:'unit-normal',revision:0},{epoch:'unit-normal',revision:-1},{epoch:'unit-normal',revision:1.5},{epoch:'unit-normal',revision:Number.MAX_SAFE_INTEGER+1},{epoch:'',revision:99}]){
  const invalid={...snapshot(99,f.old),snapshot:value};f.ctx.receive(invalid);assert.equal(f.model.state,current);f.ctx.receiver.queue(invalid);
 }
 assert.equal(f.ctx.receiver.pendingCount,0);assert.deepEqual(f.calls,{save:0,render:0,layout:0});
});

test('an older openPage state response cannot overwrite a newer accepted mode or select its old result',async()=>{
 const f=renderer();let resolveState;const pending=new Promise(resolve=>resolveState=resolve),calls=[];
 Object.assign(f.ctx,{N:{browser:async(action)=>{calls.push(action);return action==='open'?{id:'opened-page'}:pending;}},deskSwitch:Promise.resolve(),setStatus(){},renderTree:()=>f.calls.render++});
 vm.runInContext(section(' function placementPane(','\n function setActive')+'\n'+section(' async function openPage(','\n async function navigateStart')+'\nglobalThis.openPage=openPage;',f.ctx);
 const operation=f.ctx.openPage('https://owned.test/');await flush();acceptDesign(f);const before=copy(f.model.slots);resolveState(snapshot(20,[...f.old,{id:'opened-page',lane:'main'}]));await operation;
 assert.deepEqual(f.model.slots,before);assert.equal(f.model.state.snapshot.revision,21);assert.deepEqual(f.calls,{save:0,render:0,layout:0});assert.deepEqual(calls,['open','state']);
});

test('an older openAI state response cannot restore obsolete AI ownership or custom-site preferences',async()=>{
 const f=renderer();let resolveState;const pending=new Promise(resolve=>resolveState=resolve);
 Object.assign(f.ctx,{URL,presets:[],N:{browser:async action=>action==='open'?{id:'opened-ai'}:pending},deskSwitch:Promise.resolve(),renderAISites:()=>f.calls.render++,setStatus(){},syncAIIcon(){},$(){return{};}});
 vm.runInContext(section(' async function openAI(','\n\n const aiIcons=')+'\nglobalThis.openAI=openAI;',f.ctx);
 const operation=f.ctx.openAI('https://owned-ai.test/');await flush();acceptDesign(f);const before=copy({slots:f.model.slots,aiId:f.model.aiId,aiSessions:f.model.aiSessions,aiSites:f.model.aiSites});resolveState(snapshot(20,[...f.old,{id:'opened-ai',lane:'side'}]));await operation;
 assert.deepEqual(copy({slots:f.model.slots,aiId:f.model.aiId,aiSessions:f.model.aiSessions,aiSites:f.model.aiSites}),before);assert.equal(f.model.state.snapshot.revision,21);assert.deepEqual(f.calls,{save:0,render:0,layout:0});
});

test('a newer accepted snapshot retaining the new page lets openPage finish without rolling state back',async()=>{
 const f=renderer();acceptDesign(f);let resolveState;const pending=new Promise(resolve=>resolveState=resolve),calls=[];
 Object.assign(f.ctx,{N:{browser:async action=>{calls.push(action);return action==='open'?{id:'opened-page'}:pending;}},deskSwitch:Promise.resolve(),setStatus(){},renderTree:()=>f.calls.render++});
 vm.runInContext(section(' function placementPane(','\n function setActive')+'\n'+section(' async function openPage(','\n async function navigateStart')+'\nglobalThis.openPage=openPage;',f.ctx);
 const operation=f.ctx.openPage('https://owned.test/');await flush();const tabs=[...f.tabs,{id:'opened-page',lane:'main',title:'Fresh current title'}],current=snapshot(23,tabs);f.ctx.receive(current);Object.assign(f.calls,{save:0,render:0,layout:0});
 resolveState(snapshot(22,tabs.map(t=>({...t,title:'Old title'}))));await operation;
 assert.equal(f.model.state,current);assert.equal(f.model.slots.p1,'opened-page');assert.equal(f.model.state.tabs.at(-1).title,'Fresh current title');assert.deepEqual(f.calls,{save:1,render:1,layout:0});assert.deepEqual(calls,['open','state']);
});

test('a newer accepted snapshot retaining the new AI page lets openAI finish without rolling state back',async()=>{
 const f=renderer();acceptDesign(f);let resolveState;const pending=new Promise(resolve=>resolveState=resolve),calls=[];
 Object.assign(f.ctx,{URL,presets:[],N:{browser:async action=>{calls.push(action);return action==='open'?{id:'opened-ai'}:pending;}},deskSwitch:Promise.resolve(),renderAISites:()=>f.calls.render++,setStatus(){},syncAIIcon(){},$(){return{};}});
 vm.runInContext(section(' async function openAI(','\n\n const aiIcons=')+'\nglobalThis.openAI=openAI;',f.ctx);
 const operation=f.ctx.openAI('https://owned-ai.test/');await flush();const tabs=[...f.tabs,{id:'opened-ai',lane:'side',title:'Fresh AI title'}],current=snapshot(23,tabs);f.ctx.receive(current);Object.assign(f.calls,{save:0,render:0,layout:0});
 resolveState(snapshot(22,tabs.map(t=>({...t,title:'Old title'}))));await operation;
 assert.equal(f.model.state,current);assert.equal(f.model.aiId,'opened-ai');assert.equal(f.model.aiSessions['https://owned-ai.test/'],'opened-ai');assert.equal(f.model.aiSites[0].url,'https://owned-ai.test/');assert.equal(f.model.aiOpen,true);assert.deepEqual(f.calls,{save:1,render:1,layout:1});assert.deepEqual(calls,['open','state']);
});

test('actual navigation, extension and document continuations use current live IDs after a stale read-only refresh',async()=>{
 for(const kind of ['navigate','extension','document'])for(const present of [true,false]){
  const f=renderer();acceptDesign(f);const id='design-0';f.model.state.tabs.find(t=>t.id===id).internal=true;let resolveState;const pending=new Promise(resolve=>resolveState=resolve),activated=[];
  Object.assign(f.ctx,{N:{browser:async action=>action==='navigate'?true:pending},deskSwitch:Promise.resolve(),setStatus(){},setActive(){},renderTree:()=>f.calls.render++,requestLayout:()=>f.calls.layout++,activateDesktopTab:async value=>activated.push(copy(value)),overlays:{show(){}},createMouseExtensionsUI:config=>{f.ctx.extension=config;},createMouseDocumentsUI:config=>{f.ctx.documents=config;return config;},documentsUI:null});
  vm.runInContext(section(' function placementPane(','\n function setActive'),f.ctx);let operation;
  if(kind==='navigate'){vm.runInContext(section(' async function navigateStart(','\n async function openAI')+'\nglobalThis.navigateStart=navigateStart;',f.ctx);operation=f.ctx.navigateStart('https://current.test/','p1');}
  else if(kind==='extension'){vm.runInContext(section(' createMouseExtensionsUI(','\n const capture='),f.ctx);operation=f.ctx.extension.placeTab({id,desk:'desk-2'});}
  else{vm.runInContext(source.split('\n').find(row=>row.startsWith(' documentsUI=')),f.ctx);operation=f.ctx.documents.activate(id);}
  await flush();const tabs=f.tabs.filter(t=>present||t.id!==id).map(t=>({...t,title:'Current title',internal:false})),current=snapshot(23,tabs);f.ctx.receive(current);Object.assign(f.calls,{save:0,render:0,layout:0});const before=copy(f.model.slots);
  resolveState(snapshot(22,f.tabs));await operation;assert.equal(f.model.state,current,kind+' preserves newest state');
  if(!present){assert.deepEqual(f.model.slots,before);assert.deepEqual(f.calls,{save:0,render:0,layout:0});assert.equal(activated.length,0);}
  else if(kind==='document'||kind==='extension'){assert.deepEqual(activated,[{desk:'desk-2',id}]);assert.equal(f.calls.layout,1);}
  else{assert.equal(f.calls.save,1,kind+' completes successful action');assert.equal(f.calls.render,1);assert.equal(f.model.slots.p1,id);}
 }
});

test('actual extension selection keeps chat and source previews in their lane and preserves main slots',async()=>{
 for(const role of ['chat','preview','visible-main','new-main']){
  const f=renderer(),chat={id:'owned-chat',lane:'side'},preview={id:'owned-preview',lane:'side',previewOf:chat.id},newMain={id:'owned-new-main',lane:'main'};
  const current=snapshot(24,[...f.old,chat,preview,newMain]);assert.equal(f.ctx.receiver.refresh(current,'desk-2'),true);
  Object.assign(f.model,{tree:L.preset(2),slots:{p1:f.old[0].id,p2:f.old[1].id},active:'p2',aiId:'',aiOpen:false});
  const before=copy(f.model.slots),id=({chat:chat.id,preview:preview.id,'visible-main':f.old[0].id,'new-main':newMain.id})[role];
  Object.assign(f.ctx,{N:{browser:async()=>current},overlays:{show(){}},createMouseExtensionsUI:config=>{f.ctx.extension=config;},renderAISites(){},requestLayout:()=>f.calls.layout++,setActive:pane=>{f.model.active=pane;},renderTree:()=>vm.runInContext('reconcile()',f.ctx)});
  f.ctx.desktopUI.close=()=>{};
  vm.runInContext(section(' function placementPane(','\n function setActive')+'\n'+section(' async function activateDesktopTab(','\n // Keep the page view')+'\n'+section(' createMouseExtensionsUI(','\n const capture='),f.ctx);
  await f.ctx.extension.placeTab({id,desk:'desk-2'});
  if(role==='chat'||role==='preview'){
   assert.deepEqual(copy(f.model.slots),before,'Side activation must not clear or replace a main slot');
   assert.equal(f.model.aiId,chat.id);assert.equal(f.model.aiOpen,true);
  }else if(role==='visible-main'){
   assert.deepEqual(copy(f.model.slots),before);assert.equal(f.model.active,'p1');
  }else{
   assert.deepEqual(copy(f.model.slots),{p1:before.p1,p2:newMain.id});assert.equal(f.model.active,'p2');
  }
 }
});

test('read-only refresh rejects foreign, malformed and switching replies even when the target remains live',()=>{
 const model={state:{tabs:[]},desktopId:'desk-2',switching:false},r=receiver(model),current=snapshot(23,[{id:'live'}]);r.init(current,'desk-2');
 for(const next of [snapshot(22,[{id:'live'}],{epoch:'foreign'}),snapshot(22,[{id:'live'}],{desk:'desk-1'}),{...snapshot(22,[]),snapshot:null}])assert.equal(r.refresh(next,'desk-2'),false);
 model.switching=true;assert.equal(r.refresh(snapshot(22,[]),'desk-2'),false);model.switching=false;assert.equal(r.refresh(snapshot(22,[]),'desk-1'),false);
 assert.equal(model.state,current);assert.equal(r.refresh(snapshot(22,[]),'desk-2'),true);assert.equal(model.state,current);
});

test('actual applyMode does not apply preferences from an older delayed result',async()=>{
 const f=renderer();acceptDesign(f);let resolveResult;const pending=new Promise(resolve=>resolveResult=resolve);
 Object.assign(f.ctx,{MouseModes:Modes,N:{desktops:async action=>action==='apply-mode'?pending:{}},deskSwitch:Promise.resolve(),clearTimeout,arrangement:null,browsing:{close(){}},renderTree:()=>f.calls.render++,renderAISites:()=>f.calls.render++,requestLayout:()=>f.calls.layout++});
 vm.runInContext(section(' async function applyMode(','\n async function restoreLayout(')+'\nglobalThis.applyMode=applyMode;',f.ctx);
 const operation=f.ctx.applyMode('support');await flush();f.ctx.receiver.accept(snapshot(23,f.tabs));const before=copy({mode:f.model.mode,tree:f.model.tree,slots:f.model.slots});
 resolveResult({state:snapshot(22,f.old),preferences:{...copy(f.layout),mode:'support',tree:L.preset(1),slots:{p1:'old-0'},desktopId:'desk-2'}});await operation;
 assert.deepEqual(copy({mode:f.model.mode,tree:f.model.tree,slots:f.model.slots}),before);assert.equal(f.model.state.snapshot.revision,23);assert.equal(f.model.switching,false);assert.deepEqual(f.calls,{save:0,render:0,layout:1});
});
