'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{EventEmitter}=require('node:events');

function fixture({mouse=true,stable=false}={}){
 const timers=new Map(),sent=[];let builds=0,saves=0,created=0;
 const setTimeout=(fn,delay)=>{const timer={id:++created,delay,unref(){}};timers.set(timer,fn);return timer;},clearTimeout=timer=>timers.delete(timer);
 class View{
  constructor(options){this.options=options;this.children=[];this.visible=false;this.webContents=new EventEmitter();const wc=this.webContents;Object.assign(wc,{navigationHistory:{canGoBack:()=>false,canGoForward:()=>false},setWindowOpenHandler(){},loadURL:async url=>{wc.url=url;},getURL:()=>wc.url||'',isDestroyed:()=>!!wc.dead,send(){},close(){wc.dead=true;wc.emit('destroyed');}});}
  addChildView(view){this.children.push(view);}removeChildView(view){this.children=this.children.filter(v=>v!==view);}setBounds(bounds){this.bounds=bounds;}setVisible(visible){this.visible=visible;}setBorderRadius(){}
 }
 function load(file){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),{module,exports:module.exports,require:id=>id==='electron'?{View,WebContentsView:View}:require(id),__dirname,setTimeout,clearTimeout,URL},{filename:file});return module.exports;}
 const {BrowserWorkspace}=load('browser.cjs'),win={isDestroyed:()=>false,getContentSize:()=>[1440,960],contentView:new View(),webContents:{send:(channel,state)=>sent.push({channel,state})}},b=Object.assign(Object.create(BrowserWorkspace.prototype),{win,tabs:new Map(),providers:new Map(),project:'fixture',panels:[],mouseCoalescePageState:mouse,save(){saves++;return Promise.resolve();}});
 const state=b.state;b.state=function(){builds++;return state.call(this);};if(stable)load('mouse-stability.cjs').installWorkspace(b);
 return{b,timers,sent,builds:()=>builds,saves:()=>saves,created:()=>created,page:()=>b.make('https://fixture.test/'+b.tabs.size,'fixture'),tick(){for(const [timer,fn]of [...timers])if(timers.delete(timer))fn();}};
}

test('eight live pages share one current state snapshot per metadata burst',()=>{
 const f=fixture(),pages=Array.from({length:8},()=>f.page());
 for(let n=0;n<10;n++)for(const page of pages){page.view.webContents.emit('page-title-updated',{},'Page '+page.id+' '+n);page.view.webContents.emit('page-favicon-updated',{},['https://fixture.test/icon-'+n+'.png']);}
 assert.equal(f.builds(),0,'The 160 event callbacks do not rebuild desktop state');assert.equal(f.timers.size,1);assert.equal([...f.timers.keys()][0].delay,16);
 f.tick();assert.equal(f.builds(),1);assert.equal(f.sent.length,1);assert.equal(f.sent[0].state.tabs.length,8);
 for(const page of pages){const state=f.sent[0].state.tabs.find(t=>t.id===page.id);assert.equal(state.title,'Page '+page.id+' 9');assert.equal(state.favicon,'https://fixture.test/icon-9.png');assert.equal(f.b.tabs.get(page.id),page);assert.equal(page.view.webContents.dead,undefined);}
 for(let n=0;n<10;n++)for(const page of pages){page.view.webContents.emit('page-title-updated',{},page.title);page.view.webContents.emit('page-favicon-updated',{},[page.favicon]);}
 assert.equal(f.created(),1,'Repeated identical metadata creates no extra timer or IPC');assert.equal(f.builds(),1);
});

test('immediate commands supersede queued page state and close remains synchronous',async()=>{
 const f=fixture(),page=f.page(),wc=page.view.webContents;wc.emit('page-title-updated',{},'Latest title');assert.equal(f.timers.size,1);
 f.b.emit();assert.equal(f.timers.size,0);assert.equal(f.sent.length,1);assert.equal(f.sent[0].state.tabs[0].title,'Latest title');f.tick();assert.equal(f.sent.length,1);
 wc.emit('page-title-updated',{},'About to close');await f.b.command('close',{id:page.id});assert.equal(f.timers.size,0);assert.equal(f.sent.length,2);assert.equal(f.sent[1].state.tabs.length,0);assert.equal(wc.dead,true);f.tick();assert.equal(f.sent.length,2);
});

test('queued notification reads the current hook and cannot bypass privacy suppression',()=>{
 const f=fixture(),page=f.page(),emit=f.b.emit;page.view.webContents.emit('page-title-updated',{},'Normal private boundary');f.b.emit=()=>{};f.tick();assert.equal(f.sent.length,0);assert.equal(f.builds(),0);assert.equal(f.b.pageStateTimer,null);
 f.b.emit=emit;page.view.webContents.emit('page-title-updated',{},'Returned to normal');f.tick();assert.equal(f.sent.length,1);assert.equal(f.sent[0].state.tabs[0].title,'Returned to normal');
});

test('workspace disposal cancels queued metadata in base and Mouse lifecycle paths',()=>{
 for(const stable of [false,true]){const f=fixture({stable}),page=f.page();page.view.webContents.emit('page-title-updated',{},'Pending');assert.equal(f.timers.size,1);f.b.dispose();assert.equal(f.timers.size,0);assert.equal(f.b.tabs.size,0);assert.equal(page.view.webContents.dead,true);f.tick();assert.equal(f.sent.length,0);assert.equal(f.builds(),0);}
});

test('load completion and failures remain current; subframe navigation does not save the session',()=>{
 const f=fixture(),page=f.page(),wc=page.view.webContents;wc.emit('did-navigate-in-page',{},'https://frame.test/',false);assert.equal(f.saves(),0);assert.equal(f.timers.size,0);
 wc.emit('did-stop-loading');wc.emit('did-start-loading');wc.emit('did-fail-load',{},-105,'DNS fixture','https://fixture.test/',true);f.tick();assert.equal(f.sent.length,1);assert.equal(f.sent[0].state.tabs[0].loading,false);assert.equal(f.sent[0].state.tabs[0].error,'DNS fixture');
 wc.emit('did-start-loading');wc.emit('did-navigate-in-page',{},'https://fixture.test/next',true);wc.emit('did-stop-loading');f.tick();assert.equal(f.saves(),1);assert.equal(f.sent.length,2);assert.equal(f.sent[1].state.tabs[0].loading,false);assert.equal(f.sent[1].state.tabs[0].error,'');
});

test('non-Mouse workspaces retain immediate page event notifications',()=>{
 const f=fixture({mouse:false}),page=f.page();for(let n=0;n<4;n++)page.view.webContents.emit('page-title-updated',{},'Legacy '+n);assert.equal(f.sent.length,4);assert.equal(f.builds(),4);assert.equal(f.timers.size,0);
});

test('inactive desk metadata is batched at 250 ms and a foreground update supersedes it',()=>{
 const f=fixture(),active=f.page(),hidden=f.page();
 f.b.mouseDesktops={bank:{active:'desk-1',members:{[active.id]:'desk-1',[hidden.id]:'desk-2'}}};
 for(let n=0;n<200;n++)hidden.view.webContents.emit('page-title-updated',{},'Hidden '+n);
 assert.equal(f.timers.size,1);assert.equal([...f.timers.keys()][0].delay,250);assert.equal(f.builds(),0);
 active.view.webContents.emit('page-title-updated',{},'Foreground');assert.equal(f.timers.size,1);assert.equal([...f.timers.keys()][0].delay,16);
 f.tick();assert.equal(f.builds(),1);assert.equal(f.sent[0].state.tabs.find(t=>t.id===hidden.id).title,'Hidden 199');
 assert.equal(f.sent[0].state.tabs.find(t=>t.id===active.id).title,'Foreground');
});

test('fifty live pages do not add hidden native view polling or geometry writes to unchanged layouts',()=>{
 const f=fixture({stable:true}),pages=Array.from({length:50},()=>f.page()),counts={destroyed:0,visible:0,bounds:0,visibility:0};
 for(const page of pages){const view=page.view,wc=view.webContents;wc.isDestroyed=()=>{counts.destroyed++;return!!wc.dead;};view.getVisible=()=>{counts.visible++;return view.visible;};view.setBounds=bounds=>{counts.bounds++;view.bounds=bounds;};view.setVisible=visible=>{counts.visibility++;view.visible=visible;};}
 const panels=pages.slice(0,4).map((page,i)=>({id:page.id,x:100+i*200,y:50,width:180,height:600}));f.b.layout(panels);
 for(const key of Object.keys(counts))counts[key]=0;
 for(let n=0;n<100;n++)f.b.layout(panels);
 assert.equal(counts.visible,400,'Only four selected native views are reconciled on each normal layout');assert.ok(counts.destroyed<=800,'Defensive selected-page checks stay independent of the other 46 live pages');assert.equal(counts.bounds,0);assert.equal(counts.visibility,0);
 counts.destroyed=0;for(let n=0;n<10;n++){for(const page of pages)page.view.webContents.emit('page-title-updated',{},'Title '+page.id+' '+n);f.tick();}
 assert.equal(f.builds(),10);assert.equal(counts.destroyed,0,'Successful state snapshots no longer pre-scan every WebContents in stability');assert.equal(f.b.tabs.size,50);assert.ok(pages.every(page=>!page.view.webContents.dead));
 const next=pages.slice(4,8).map((page,i)=>({...panels[i],id:page.id}));f.b.layout(next);assert.equal(counts.visibility,8,'Only the outgoing and incoming selections change visibility');
 const rogue=pages[49];rogue.visible=false;rogue.view.visible=true;f.b.mouseSurfaceHold='nora';f.b.layout(next);assert.equal(rogue.view.visible,false,'An owned Nora hold still checks actual hidden-view visibility across all pages');assert.ok(pages.every(page=>!page.view.visible));
 f.b.dispose();assert.equal(f.b.layoutPages.size,0);assert.equal(f.b.tabs.size,0);
});

function rendererMetadataFixture(){
 const source=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),begin=source.indexOf('function receiveState('),end=source.indexOf('N.onState(receiveState)',begin);assert.ok(begin>=0&&end>begin);
 const tabs=Array.from({length:10},(_,i)=>({id:'active-'+i,url:'https://fixture.test/'+i,title:'Title '+i,lane:'main',loading:false,internal:false,back:false,forward:false}));
 const model={ready:true,desktopId:'desk-3',state:{tabs},slots:{p1:tabs[0].id,p2:tabs[1].id,p3:tabs[2].id,p4:tabs[3].id},aiId:'',aiPreviewId:'',switching:false},calls={tabs:0,labels:0,ai:0,preview:0,layout:0,desktops:0,progress:0,saves:0};
 const context={m:model,pendingState:null,tab:id=>model.state.tabs.find(t=>t.id===id),prefs:()=>({slots:model.slots,aiId:model.aiId}),reconcile(){for(const [pane,id]of Object.entries(model.slots))if(!model.state.tabs.some(t=>t.id===id))model.slots[pane]='';if(model.aiId&&!model.state.tabs.some(t=>t.id===model.aiId))model.aiId='';},renderTabs:()=>calls.tabs++,syncPaneLabels:()=>calls.labels++,syncAIIcon:()=>calls.ai++,syncAIPreview:()=>calls.preview++,applySide:()=>calls.layout++,desktopUI:{render:()=>calls.desktops++},progressUI:{render:()=>calls.progress++},save:()=>calls.saves++};
 vm.runInNewContext(source.slice(begin,end),context);return{model,calls,receive:context.receiveState};
}

test('background metadata bursts update desktop badges and progress without active DOM rebuild or native layout',()=>{
 const f=rendererMetadataFixture();
 for(let n=0;n<50;n++)f.receive({desktopId:'desk-3',tabs:f.model.state.tabs.map(tab=>({...tab})),desktops:{items:Array.from({length:5},(_,i)=>({id:'desk-'+i,unread:n,title:'Background '+n}))},progress:{sequence:n}});
 assert.deepEqual(f.calls,{tabs:0,labels:0,ai:0,preview:0,layout:0,desktops:50,progress:50,saves:0});assert.equal(f.model.state.progress.sequence,49);
});

test('active title, loading and navigation updates remain current without geometrical relayout',()=>{
 const f=rendererMetadataFixture();
 for(const change of [{title:'A current title'},{loading:true},{loading:false,back:true,url:'https://fixture.test/next'}]){
  const next=f.model.state.tabs.map(tab=>({...tab}));Object.assign(next[0],change);f.receive({desktopId:'desk-3',tabs:next,desktops:{items:[]}});assert.deepEqual(Object.fromEntries(Object.keys(change).map(key=>[key,f.model.state.tabs[0][key]])),change);
 }
 assert.deepEqual(f.calls,{tabs:3,labels:3,ai:3,preview:3,layout:0,desktops:3,progress:3,saves:0});
 const internal=f.model.state.tabs.map(tab=>({...tab}));internal[0].internal=true;f.receive({desktopId:'desk-3',tabs:internal});assert.equal(f.calls.layout,1,'Replacing a native guest with a start/document page requires layout');
 f.receive({desktopId:'desk-3',tabs:internal.filter(tab=>tab.id!=='active-1')});assert.equal(f.model.slots.p2,'');assert.equal(f.calls.layout,2,'Closing a selected page hides its native view');assert.equal(f.calls.saves,1);
 const before={...f.calls};f.model.switching=true;f.receive({desktopId:'desk-4',tabs:[]});assert.deepEqual(f.calls,before,'The active transition owns its state until it settles');
});
