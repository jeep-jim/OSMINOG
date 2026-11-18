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
