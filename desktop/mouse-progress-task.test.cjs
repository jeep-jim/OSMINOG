'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {ProgressStore}=require('./mouse-progress.cjs'),{install}=require('./mouse-progress-bridge.cjs'),{createPageActivityTools}=require('./mouse-page-activity.cjs');

test('631 regression: slow ordinary navigation, success, cancellation and failure never create task metadata',async t=>{
 const wc=new EventEmitter();Object.assign(wc,{id:1,mainFrame:{},isDestroyed:()=>false,getURL:()=> 'https://ordinary.example/'});
 const shell=new EventEmitter();Object.assign(shell,{id:2,mainFrame:{}});
 const page={id:'page',navigationEpoch:0,view:{webContents:wc}},browser={tabs:new Map([['page',page]]),mouseDesktops:{bank:{active:'desk',members:{page:'desk'}}},make(){return page;},emit(){}};
 const ipcMain=new EventEmitter();ipcMain.handle=()=>{};const events=[],progress=new ProgressStore({emit:value=>events.push(value)});
 const bridge=install({win:{webContents:shell},browser,ipcMain,trusted:()=>{},progress});t.after(()=>{bridge.dispose();progress.dispose();});
 wc.emit('did-start-navigation',{},wc.getURL(),false,true);await new Promise(resolve=>setTimeout(resolve,310));
 assert.deepEqual(progress.snapshot().tasks,[],'A network load lasting longer than the former250ms threshold is not a user task');
 wc.emit('did-finish-load');wc.emit('did-stop-loading');
 for(const code of [-3,-105]){wc.emit('did-start-navigation',{},wc.getURL(),false,true);wc.emit('did-fail-load',{},code,'fixture',wc.getURL(),true);wc.emit('did-stop-loading');}
 assert.deepEqual(progress.snapshot().tasks,[]);assert.ok(events.every(event=>event.tasks.length===0),'No transient completed/error navigation pill is ever emitted');
});

test('631 regression:100 hides an actual task immediately and an idle100 report never creates a completed pill',()=>{
 const progress=new ProgressStore();try{
  const input={desk:'desk',source:'page',label:'tasks.example',tabId:'page',taskId:'actual',percent:37,statusText:'Processing'};
  const running=progress.update('page',input);assert.equal(progress.snapshot().tasks[0].id,running.id);
  const completed=progress.update('page',{...input,percent:100,statusText:'Result ready'});assert.equal(completed.phase,'completed');assert.deepEqual(progress.snapshot().tasks,[]);
  progress.update('page',{...input,taskId:'already-finished',percent:100,statusText:'Old result'});assert.deepEqual(progress.snapshot().tasks,[]);
 }finally{progress.dispose();}
});

test('631 regression: ordinary ARIA busy and unmarked completed progress are not task declarations',()=>{
 const tools=createPageActivityTools();
 for(const value of [{visible:true,tag:'body',busy:'true',label:'Loading page'},{visible:true,tag:'progress',value:'100',max:'100'},{visible:true,tag:'div',role:'progressbar',value:'42',label:'Page navigation'}])assert.equal(tools.describe(value),null);
});
