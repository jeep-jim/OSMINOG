'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const L=require('./mouse/layout.js'),MouseTabOrder=require('./mouse/mouse-613-ui.js'),{PaneFocus}=require('./mouse-pane-focus.cjs');
const {createMouseContextMenu}=require('./mouse/context-menu.js');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8'),renderer=read('mouse/browser.js'),arrangement=read('mouse/mouse-613-ui.js');
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};},flush=()=>new Promise(setImmediate);

// Execute the real production functions without starting the whole application.
// Syntax compilation, rather than brace counting, handles nested functions and
// literals. The fixture controls only asynchronous IPC and DOM presentation.
function functionSource(source,name){
 const match=new RegExp('(?:^|\\n)[ \\t]*(?:async )?function '+name+'\\(').exec(source);assert.ok(match,'Missing production function '+name);
 const start=match.index+(source[match.index]==='\n'?1:0);let end=source.indexOf('\n',start);
 for(;end>=0;end=source.indexOf('\n',end+1)){const candidate=source.slice(start,end).trim();try{new vm.Script('('+candidate+')');return candidate;}catch{}}
 throw Error('Could not isolate '+name);
}
function installFunctions(context,names,source=renderer){for(const name of names)vm.runInContext('var '+name+'=('+functionSource(source,name)+');',context);}
function fixture(){
 const state={tabs:['a','b','unplaced'].map(id=>({id,lane:'main',url:'https://'+id+'.test/'})),desktops:{items:[]}},m={ready:true,desktopId:'desk-a',state,tree:L.preset(2),slots:{p1:'a',p2:'b'},active:'p2',classicTabId:'',tabOrder:['a','b','unplaced'],pinnedPanes:{},aiSessions:{},aiId:'',aiPreviewId:'',aiOpen:false,focusPane:'',focusAI:false,switching:false},events=[],presented=[];
 const context=vm.createContext({m,L,MouseTabOrder,structuredClone,clearTimeout,setTimeout,deskSwitch:Promise.resolve(),arrangement:null,desktopUI:null,document:{querySelectorAll:()=>[]},MouseModes:{get:()=>({})},endDrag(){},requestLayout(){},save(){events.push('save');},setStatus(message){events.push(['status',message]);},browsing:{close(){},hideHints(){}},renderAISites(){},applySide(){},renderTabs(){events.push('tabs');},syncPaneLabels(){},tab:id=>m.state.tabs.find(t=>t.id===id),mainTabs:()=>m.state.tabs.filter(t=>t.lane!=='side'),N:{window:async action=>events.push(action),save:async()=>{},browser:async()=>m.state,desktops:async()=>{throw Error('No reply configured');}},stateReceiver:{accept(state){m.state=state;return true;},refresh(state,desk){if(desk!==m.desktopId)return false;m.state=state;return true;}}});
 installFunctions(context,['visibleTree','reconcile','restorePane','showClassic','returnToGrid','togglePaneFullscreen','acceptDesktopResult','mutateDesktopTabs','applyMode','restoreLayout','setActive','split','activateDesktopTab','placementPane','openPage']);
 vm.runInContext(renderer.match(/^ const prefs=.*$/m)[0],context);
 context.renderTree=()=>{context.reconcile();presented.push(m.classicTabId?'classic:'+m.classicTabId:'grid');};
 const win=new EventEmitter();Object.assign(win,{webContents:new EventEmitter(),fullscreen:false,isDestroyed:()=>false,isFullScreen(){return this.fullscreen;},isMaximized:()=>false,getBounds:()=>({x:12,y:20,width:1000,height:800}),setFullScreen(value){this.fullscreen=value;},setBounds(){}});
 const focus=new PaneFocus({win,restore:()=>context.restorePane()});
 return{m,events,presented,context,win,focus,reply(preferences={},tabs=m.state.tabs){return{preferences:{desktopId:m.desktopId,tree:structuredClone(m.tree),slots:{...m.slots},active:m.active,tabOrder:m.tabOrder.filter(id=>tabs.some(t=>t.id===id)),aiSessions:{},...preferences},state:{...m.state,tabs}};},native(){context.N.window=async action=>{events.push(action);if(action==='pane-fullscreen')focus.enter();else if(action==='pane-restore')focus.leave();};}};
}

test('ordinary classic selection and return leave the saved grid and selected grid pane intact',async()=>{
 const f=fixture(),before=structuredClone({tree:f.m.tree,slots:f.m.slots,active:f.m.active});await f.context.showClassic('unplaced');assert.equal(f.m.classicTabId,'unplaced');await f.context.returnToGrid();assert.equal(f.m.classicTabId,'');assert.deepEqual({tree:f.m.tree,slots:f.m.slots,active:f.m.active},before);
});

test('a delayed fullscreen restore cannot replace a newer classic selection',async()=>{
 const f=fixture(),wait=deferred();f.m.focusPane='p2';f.context.N.window=()=>wait.promise;
 const older=f.context.showClassic('a');await f.context.showClassic('b');assert.equal(f.m.classicTabId,'b');wait.resolve();await older;
 assert.equal(f.m.classicTabId,'b','The latest visible selection owns the view after older IPC completes');
});

test('returning to the grid invalidates a pending classic selection',async()=>{
 const f=fixture(),wait=deferred();f.m.focusPane='p2';f.context.N.window=()=>wait.promise;
 const older=f.context.showClassic('a');await f.context.returnToGrid();wait.resolve();await older;
 assert.equal(f.m.classicTabId,'','An older pane-restore reply must not reopen the classic view');
});

test('a classic selection waiting for native restore cannot clear the next desktop selection',async()=>{
 const f=fixture(),wait=deferred();f.m.focusPane='p2';f.context.N.window=()=>wait.promise;
 const older=f.context.showClassic('a');f.m.desktopId='desk-b';f.m.state={tabs:[{id:'next-desk',lane:'main'}],desktops:{items:[]}};f.m.slots={p1:'next-desk',p2:''};f.m.classicTabId='next-desk';wait.resolve();await older;
 assert.equal(f.m.classicTabId,'next-desk');
});

test('fullscreen of a classic page does not replace the saved active grid pane',async()=>{
 const f=fixture();f.native();await f.context.showClassic('unplaced');assert.equal(f.m.active,'p2');await f.context.togglePaneFullscreen('p0');
 assert.equal(f.focus.active,true);assert.equal(f.win.fullscreen,true);assert.equal(f.m.active,'p2');
});

test('returning to the grid releases native fullscreen ownership created by the classic page',async()=>{
 const f=fixture();f.native();await f.context.showClassic('unplaced');await f.context.togglePaneFullscreen('p0');await f.context.returnToGrid();await flush();
 assert.equal(f.m.focusPane,'');assert.equal(f.m.classicTabId,'');assert.equal(f.focus.active,false,'Renderer and native PaneFocus must leave together');assert.equal(f.win.fullscreen,false);
});

test('closing an unplaced classic tab through desktop actions renders the saved grid',async()=>{
 const f=fixture();await f.context.showClassic('unplaced');const tabs=f.m.state.tabs.filter(t=>t.id!=='unplaced');f.context.N.desktops=async()=>f.reply({},tabs);
 await f.context.mutateDesktopTabs('close-tab',{id:'unplaced'});assert.equal(f.m.classicTabId,'');assert.equal(f.presented.at(-1),'grid','Unchanged grid assignments still require rebuilding the p0 DOM when classic closes');
});

test('applying a desktop mode displays its accepted grid instead of the old classic page',async()=>{
 const f=fixture();await f.context.showClassic('unplaced');const next={tree:L.preset(3),slots:{p1:'a',p2:'b',p3:''},active:'p3',mode:'research'};f.context.N.desktops=async()=>f.reply(next);
 await f.context.applyMode('research');assert.equal(L.leaves(f.m.tree).length,3);assert.equal(f.m.classicTabId,'');assert.equal(f.presented.at(-1),'grid');
});

test('restoring saved layout displays the accepted grid instead of the old classic page',async()=>{
 const f=fixture();await f.context.showClassic('unplaced');f.context.N.desktops=async()=>f.reply({tree:L.preset(1),slots:{p1:'b'},active:'p1'});
 await f.context.restoreLayout('undo-layout');assert.equal(L.leaves(f.m.tree).length,1);assert.equal(f.m.classicTabId,'');assert.equal(f.presented.at(-1),'grid');
});

test('cancelling while an edge desktop switch is pending restores the original desktop after it settles',async()=>{
 const wait=deferred(),m={desktopId:'desk-a'},calls=[],source={desk:'desk-a',tabId:'live-page',token:'owned-token'};
 const context=vm.createContext({m,finishing:false,cleanup:()=>source,N:{pageArrange:async(action,args)=>calls.push([action,args.token])},edgeWork:wait.promise.then(()=>{m.desktopId='desk-b';}),changeDesk:async id=>{calls.push(['switch',id]);m.desktopId=id;},error:message=>assert.fail(message)});
 installFunctions(context,['cancel'],arrangement);context.cancel({restore:true});wait.resolve();await context.edgeWork;await flush();
 assert.equal(m.desktopId,'desk-a','Escape/dragend during a pending switch must not leave the user on the dragged-to desktop');assert.deepEqual(calls,[['cancel','owned-token'],['switch','desk-a']]);
});

test('right-click split uses the clicked grid pane, not a previously active pane',async()=>{
 const f=fixture();f.m.active='p1';
 const menu=createMouseContextMenu({N:{onContextAction:()=>()=>{}},model:f.m,L,activate:f.context.activateDesktopTab,setActive:f.context.setActive,changeLayout(){},split:f.context.split,pinPane(){},restoreFocused:async()=>{},status:message=>assert.fail(message),document:{addEventListener(){},removeEventListener(){}}});
 const applied=await menu.apply({desk:'desk-a',id:'b',pane:'p2',action:'split-y'});assert.equal(applied,true);
 assert.equal(f.m.tree.a.id,'p1','The previously active pane must retain its geometry');assert.equal(f.m.tree.b.axis,'y');assert.equal(f.m.tree.b.a.id,'p2');assert.equal(f.m.slots.p2,'b');
});

test('splitting an unplaced classic page places that page in the new tile and preserves existing grid assignments',async()=>{
 const f=fixture();f.m.active='p1';await f.context.showClassic('unplaced');
 const menu=createMouseContextMenu({N:{onContextAction:()=>()=>{}},model:f.m,L,activate:f.context.activateDesktopTab,setActive:f.context.setActive,changeLayout(){},split:f.context.split,pinPane(){},restoreFocused:async()=>{},status:message=>assert.fail(message),document:{addEventListener(){},removeEventListener(){}}});
 const applied=await menu.apply({desk:'desk-a',id:'unplaced',pane:'',action:'split-x'});assert.equal(applied,true);assert.equal(f.m.classicTabId,'');
 assert.equal(f.m.slots.p1,'a');assert.equal(f.m.slots.p2,'b');const added=L.leaves(f.m.tree).filter(id=>!['p1','p2'].includes(id));assert.equal(added.length,1);assert.equal(f.m.slots[added[0]],'unplaced');assert.equal(f.m.active,added[0]);
});

test('a later explicit operation invalidates cancellation restoration waiting behind edge work',async()=>{
 const wait=deferred(),m={desktopId:'desk-a'},calls=[];let source={desk:'desk-a',tabId:'live-page',token:'owned-token'};
 const context=vm.createContext({m,finishing:false,cleanup:()=>{const old=source;source=null;return old;},N:{pageArrange:async(action,args)=>calls.push([action,args.token])},edgeWork:wait.promise.then(()=>{m.desktopId='desk-b';}),changeDesk:async id=>{calls.push(['switch',id]);m.desktopId=id;},error:message=>assert.fail(message)});
 installFunctions(context,['cancel'],arrangement);context.cancel({restore:true});context.cancel();wait.resolve();await context.edgeWork;await flush();
 assert.equal(m.desktopId,'desk-b','A newer desktop action owns selection; an earlier cancellation must not restore over it');assert.deepEqual(calls,[['cancel','owned-token']]);
});

test('a desktop operation cancelling a pending native take cannot commit the old drop onto the new desktop',async()=>{
 const wait=deferred(),m={desktopId:'desk-a'},moves=[],source={desk:'desk-a',tabId:'live-page',token:'owned-token'};
 const context=vm.createContext({m,drag:source,pending:source,finishing:false,label:(_ru,en)=>en,edgeWork:Promise.resolve(),N:{pageArrange:(action)=>action==='take'?wait.promise:Promise.resolve({accepted:true})},targetAt:()=>({kind:'pane',id:'p1',edge:''}),transfer:async args=>moves.push(structuredClone(args)),renderTabs(){},layout(){},error:message=>assert.fail(message)});
 context.cleanup=()=>{const old=context.drag||context.pending;context.drag=null;context.pending=null;return old;};
 installFunctions(context,['finish','cancel'],arrangement);
 const drop=context.finish(400,300,'owned-token');assert.equal(context.finishing,true);context.cancel();m.desktopId='desk-b';wait.resolve({accepted:true,id:'live-page',desk:'desk-a'});await drop;
 assert.deepEqual(moves,[],'Cancellation by a newer desktop operation must invalidate a drop still awaiting its native receipt');
});

test('a created page remains available without replacing a newer classic selection',async()=>{
 const f=fixture(),wait=deferred();f.context.N.browser=action=>action==='open'?wait.promise:Promise.resolve(f.m.state);
 const opening=f.context.openPage('https://new.test/');await f.context.showClassic('b');f.m.state.tabs.push({id:'created',lane:'main'});wait.resolve({id:'created'});await opening;
 assert.ok(f.context.tab('created'));assert.equal(f.m.classicTabId,'b');assert.deepEqual(f.m.slots,{p1:'a',p2:'b'});
});

test('a created page remains available without reopening classic after return to grid',async()=>{
 const f=fixture(),wait=deferred();f.context.N.browser=action=>action==='open'?wait.promise:Promise.resolve(f.m.state);
 const opening=f.context.openPage('https://new.test/');await f.context.returnToGrid();f.m.state.tabs.push({id:'created',lane:'main'});wait.resolve({id:'created'});await opening;
 assert.ok(f.context.tab('created'));assert.equal(f.m.classicTabId,'');
});

test('an open request paused at AI fullscreen restoration cannot create a page on a new desktop',async()=>{
 const f=fixture(),wait=deferred(),opened=[];f.m.focusAI=true;f.context.N.window=()=>wait.promise;f.context.N.browser=async action=>{if(action==='open'){opened.push(f.m.desktopId);return{id:'a'};}return f.m.state;};
 const opening=f.context.openPage('https://new.test/');f.m.desktopId='desk-b';wait.resolve();await opening;
 assert.deepEqual(opened,[],'Source desk ownership must be checked before the open IPC after native restore');
});

test('a failed desktop mode keeps the current classic selection and saved grid',async()=>{
 const f=fixture();await f.context.showClassic('unplaced');const before=structuredClone({tree:f.m.tree,slots:f.m.slots});f.context.N.desktops=async action=>{if(action==='apply-mode')throw Error('Mode failed');return{};};
 await assert.rejects(f.context.applyMode('research'),/Mode failed/);assert.equal(f.m.classicTabId,'unplaced');assert.deepEqual({tree:f.m.tree,slots:f.m.slots},before);assert.equal(f.m.switching,false);
});

test('a delayed explicit open cannot replace a pane that became pinned while the page was created',async()=>{
 const f=fixture(),wait=deferred();f.m.slots.p2='';f.context.N.browser=action=>action==='open'?wait.promise:Promise.resolve(f.m.state);
 const opening=f.context.openPage('https://new.test/','p2');f.m.pinnedPanes={p2:''};f.m.state.tabs.push({id:'created',lane:'main'});wait.resolve({id:'created'});
 try{await opening;}catch(error){assert.match(error.message,/закреп|измен|pin|changed/i);}
 assert.ok(f.context.tab('created'));assert.equal(f.m.slots.p2,'','A pending creation cannot override a newly pinned empty pane');assert.deepEqual(f.m.pinnedPanes,{p2:''});
});
