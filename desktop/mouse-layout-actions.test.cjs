'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('./mouse/layout.js'),MouseTabOrder=require('./mouse/mouse-613-ui.js'),{DesktopBank}=require('./mouse-desktops.cjs');
const source=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8');
const clone=value=>structuredClone(value),flush=()=>new Promise(resolve=>setImmediate(resolve));

// Execute the production action bodies and pointer listeners. DOM rendering and
// native transport are boundary spies, not alternative implementations of the
// layout, saving, drag, or restore behavior under test.
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Production renderer section exists: '+start);return source.slice(a,b);}
const actions=[
 section(' let arrangement,','\n const resizeHUD'),
 section(' const tab=id=>','\n const feedback='),
 section(' const safe=','\n const el='),
 section(' const prefs=','\n function selected'),
 section(' function reconcile(','\n function setActive'),
 section(' function changeLayout(','\n async function mutateDesktopTabs'),
 section(' function beginDrag(','\n const libraryDivider='),
 section(' async function restoreLayout(','\n async function activateAgentTab')
].join('\n');

function clock(){
 let now=0,sequence=0;const timers=new Map();
 return{
  setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,at:now+Number(delay||0)});return id;},
  clearTimeout(id){timers.delete(id);},
  async advance(ms){const end=now+ms;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}now=end;await flush();}
 };
}
function classes(){const values=new Set();return{add:value=>values.add(value),remove:value=>values.delete(value),contains:value=>values.has(value)};}
function fixture(t){
 const time=clock(),handlers=new Map(),writes=[],renders=[],native=[],errors=[];
 const pages=['one','two','three','four'].map(id=>({id,lane:'main',url:'https://fixture.example/'+id}));
 const initial={desktopId:'desk-3',mode:'',agentOpen:false,tree:L.preset(2),slots:{p1:'one',p2:'two'},active:'p2',tabOrder:pages.map(p=>p.id),aiOpen:false,aiWidth:360,aiId:'',aiSessions:{}};
 const bank=new DesktopBank(null,initial);bank.reconcile(pages);
 const events={addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);}};
 const document={...events,body:{classList:classes()}},window={...events};
 let resolveRestore;
 const pendingRestore=new Promise(resolve=>{resolveRestore=resolve;});
 const N={
  save(preferences,history){writes.push({preferences,history});bank.savePreferences(preferences,history,ctx.api.m.state.tabs);return Promise.resolve();},
  browser:async(action,args)=>{native.push({action,args:clone(args)});},
  window:async()=>{},
  desktops:async(action,args)=>{native.push({action,args:clone(args)});assert.equal(action,'undo');return pendingRestore;}
 };
 const ctx={L,MouseTabOrder,N,document,window,structuredClone,Promise,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,setStatus:message=>errors.push(message),
  resizeHUD:{begin(){},update(){},end(){}},
  requestLayout(){},renderAISites(){},applySide(){},restorePane(){throw Error('Unexpected fullscreen branch in this fixture');},
  renderTree(){const m=ctx.api.m;renders.push({tree:clone(m.tree),slots:clone(m.slots),active:m.active,switching:m.switching});}
 };
 vm.runInNewContext(actions+'\nglobalThis.api={m,prefs,save,changeLayout,split,beginDrag,endDrag,restoreLayout};',ctx,{filename:'mouse/browser.js action fixture',timeout:1000});
 Object.assign(ctx.api.m,clone(initial),{ready:true,switching:false,state:{tabs:clone(pages)}});
 t.after(()=>assert.deepEqual(errors,[],'Renderer safe() must not hide a failed action'));
 const dispatch=(name,event)=>{for(const fn of handlers.get(name)||[])fn(event);};
 return{...ctx.api,time,writes,renders,native,bank,dispatch,resolveRestore,pages};
}

test('one divider gesture after an unsaved layout saves its baseline and final geometry once, without mid-drag history',async t=>{
 const f=fixture(t);f.changeLayout(3);const baseline=clone(f.prefs());assert.equal(f.writes.length,0);assert.equal(L.leaves(baseline.tree).length,3);
 const divider={classList:classes(),setPointerCapture(){},setAttribute(){}},spec={kind:'pane',path:'',axis:'x',divider,node:{getBoundingClientRect:()=>({left:0,top:0,width:1006,height:806})},a:{style:{}},b:{style:{}}};
 f.beginDrag({button:0,pointerId:17,preventDefault(){}},spec);
 // Move before safe() reaches the IPC boundary. The saved baseline must already
 // be an independent snapshot, not the tree object this pointer listener edits.
 f.dispatch('pointermove',{pointerId:17,clientX:650,clientY:100});await flush();
 assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].preferences,baseline);assert.equal(f.writes[0].history.reason,'layout');assert.equal(f.m.tree.ratio,.65);
 await f.time.advance(1000);assert.equal(f.writes.length,1,'The pre-drag debounce must not fire during the gesture');
 // State notifications can request a save while the pointer is held. Let that
 // debounce actually mature, rather than assuming beginDrag cancelled it.
 f.save('layout');f.dispatch('pointermove',{pointerId:17,clientX:700,clientY:100});await f.time.advance(1000);
 assert.equal(f.writes.length,1,'A save timer maturing while dragging must not create an intermediate checkpoint');assert.equal(f.m.tree.ratio,.7);assert.deepEqual(f.writes[0].preferences,baseline);
 f.dispatch('pointerup',{pointerId:17});assert.equal(f.m.drag,null);await f.time.advance(199);assert.equal(f.writes.length,1);await f.time.advance(1);
 assert.equal(f.writes.length,2);assert.equal(f.writes[1].history.reason,'resize');assert.equal(f.writes[1].preferences.tree.ratio,.7);assert.deepEqual(f.writes[1].preferences.slots,baseline.slots);
 f.dispatch('pointercancel',{pointerId:17});f.dispatch('blur',{});await f.time.advance(1000);assert.equal(f.writes.length,2,'Repeated gesture-end events must not add saves');
 assert.equal(f.bank.historyState().undoCount,2,'The unsaved layout and completed resize are distinct history steps');f.bank.stepHistory('undo',f.pages);assert.deepEqual(f.bank.preferences().tree,baseline.tree);f.bank.stepHistory('undo',f.pages);assert.equal(L.leaves(f.bank.preferences().tree).length,2);
});

for(const action of ['split','layout'])test('queued '+action+' waits for history restoration and edits the restored tabs and geometry',async t=>{
 const f=fixture(t),before=clone(f.prefs());f.save('layout');const restoring=f.restoreLayout('undo');assert.equal(f.m.switching,true);
 const queued=action==='split'?f.split('y'):f.changeLayout(3);assert.ok(queued&&typeof queued.then==='function');await f.time.advance(500);
 assert.deepEqual(clone(f.prefs()),before);assert.equal(f.renders.length,0);assert.equal(f.writes.length,0);assert.deepEqual(f.native.map(n=>n.action),['undo']);
 const tabs=['restored-a','restored-b','restored-c'].map(id=>({id,lane:'main'})),preferences={...before,tree:{axis:'x',ratio:.31,a:{id:'p7'},b:{id:'p8'}},slots:{p7:'restored-a',p8:'restored-b'},active:'p8',tabOrder:tabs.map(p=>p.id)};
 const restored=clone(preferences);f.resolveRestore({preferences,state:{tabs}});await Promise.all([restoring,queued]);
 assert.equal(f.m.switching,false);assert.equal(f.renders.length,2);assert.deepEqual(f.renders[0].tree,restored.tree);assert.deepEqual(f.renders[0].slots,restored.slots);assert.equal(f.renders[1].switching,false,'The queued edit must run after restore releases its switching gate');
 if(action==='split'){
  assert.equal(f.m.tree.ratio,.31);assert.deepEqual(L.leaves(f.m.tree),['p7','p8','p9']);assert.equal(f.m.tree.b.axis,'y');assert.equal(f.m.active,'p9');assert.deepEqual(clone(f.m.slots),{p7:'restored-a',p8:'restored-b',p9:'restored-c'});
 }else{
  assert.deepEqual(L.leaves(f.m.tree),['p1','p2','p3']);assert.deepEqual(clone(f.m.slots),{p1:'restored-a',p2:'restored-b',p3:'restored-c'});
 }
 await f.time.advance(200);assert.equal(f.writes.length,1);assert.equal(f.writes[0].history.reason,action);assert.deepEqual(f.writes[0].preferences.tree,clone(f.m.tree));assert.ok(Object.values(f.writes[0].preferences.slots).every(id=>id.startsWith('restored-')));
});
