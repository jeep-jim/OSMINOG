'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {ProgressStore}=require('./mouse-progress.cjs'),{install}=require('./mouse-progress-bridge.cjs');
function fixture(t){
 let n=0,privateMode=false;const ipc=new Map(),power=new EventEmitter();
 function wc(url){const value=new EventEmitter();Object.assign(value,{id:++n,mainFrame:{},url,dead:false,messages:[],send(channel){value.messages.push(channel);},isDestroyed:()=>value.dead,getURL:()=>value.url});return value;}
 const shell=wc('file:///mouse/index.html'),bank={active:'desk-3',items:[{id:'desk-1'},{id:'desk-3'}],members:{}},browser={tabs:new Map(),mouseDesktops:{bank},emit(){}};
 browser.make=(id,desk='desk-3')=>{const value={id,navigationEpoch:0,view:{webContents:wc('https://'+id+'.example/')}};browser.tabs.set(id,value);bank.members[id]=desk;return value;};
 const a=browser.make('a'),b=browser.make('b','desk-1'),progress=new ProgressStore();
 const ipcMain=new EventEmitter();ipcMain.handle=(name,fn)=>ipc.set(name,fn);
 const bridge=install({win:{webContents:shell},browser,ipcMain,trusted:event=>{if(event.sender!==shell||event.senderFrame!==shell.mainFrame)throw Error('Untrusted shell');},progress,isPrivate:()=>privateMode,powerMonitor:power});
 t.after(()=>{bridge.dispose();progress.dispose();});
 const event=page=>({sender:page.view.webContents,senderFrame:page.view.webContents.mainFrame}),context=page=>ipc.get('mouse:page-progress-context')(event(page)),update=(page,payload)=>ipc.get('mouse:page-progress')(event(page),{...context(page),...payload}),host=(action,payload)=>ipc.get('mouse:progress')({sender:shell,senderFrame:shell.mainFrame},action,payload);
 return{ipc,ipcMain,power,shell,bank,browser,a,b,progress,bridge,event,context,update,host,privacy:value=>{privateMode=value;}};
}
test('page progress binds sender page/desk/source and identical task IDs cannot overwrite another page',t=>{
 const f=fixture(t),a=f.update(f.a,{percent:37,statusText:'Пишу код',taskId:'same',desk:'desk-1',source:'agent',label:'Forged',tabId:'b',estimated:false}),b=f.update(f.b,{percent:null,statusText:'Ожидание',taskId:'same'});
 assert.equal(a.desk,'desk-3');assert.equal(a.source,'page');assert.equal(a.tabId,'a');assert.equal(a.label,'a.example');assert.equal(a.estimated,true);assert.equal(b.desk,'desk-1');assert.notEqual(a.id,b.id);assert.equal(f.progress.snapshot().tasks.length,2);
 f.update(f.a,{percent:51,statusText:'Этап 2',taskId:'same'});assert.equal(f.progress.snapshot().tasks.find(x=>x.id===b.id).percent,null);
});
test('new-document navigation and closure clear ownership; moving the same tab keeps its actual task',t=>{
 const f=fixture(t);f.update(f.a,{percent:10,statusText:'Первый документ'});f.a.navigationEpoch++;f.a.view.webContents.emit('did-start-navigation',{},'https://a.example/next',false,true);assert.equal(f.progress.snapshot().tasks.length,0);
 const moved=f.update(f.a,{percent:20,statusText:'Другой документ'});f.bank.members.a='desk-1';f.browser.emit();assert.equal(f.progress.snapshot().tasks[0].id,moved.id);assert.equal(f.progress.snapshot().tasks[0].desk,'desk-1');assert.equal(f.update(f.a,{percent:30,statusText:'Другой стол'}).desk,'desk-1');
 f.a.view.webContents.dead=true;f.a.view.webContents.emit('destroyed');assert.equal(f.progress.snapshot().tasks.length,0);assert.equal(f.a.view.webContents.listenerCount('did-start-navigation'),0);assert.equal(f.a.view.webContents.listenerCount('destroyed'),0);
 const page=f.browser.make('later');f.update(page,{percent:8,statusText:'Новая вкладка'});delete f.bank.members.later;f.browser.emit();assert.equal(f.progress.snapshot().tasks.length,0);
});
test('subframes, unrelated WebContents, invalid values and internal pages cannot report progress',t=>{
 const f=fixture(t),invoke=f.ipc.get('mouse:page-progress'),p={percent:1,statusText:'x'};
 assert.throws(()=>invoke({...f.event(f.a),senderFrame:{}},p),/main frame/);assert.throws(()=>invoke({sender:f.shell,senderFrame:f.shell.mainFrame},p),/own/);
 for(const percent of [NaN,Infinity,-1,101,'37'])assert.throws(()=>f.update(f.a,{...p,percent}),/Progress/);
 assert.throws(()=>f.update(f.a,{...p,statusText:'x'.repeat(241)}),/240/);assert.throws(()=>f.update(f.a,{...p,taskId:'x'.repeat(65)}),/task ID/);
 f.a.view.webContents.url='file:///private';assert.throws(()=>f.update(f.a,p),/own/);assert.equal(f.progress.snapshot().tasks.length,0);
});
test('shell API is trusted, hiding a pill does not cancel or claim successful work',t=>{
 const f=fixture(t),entry=f.host('update',{percent:37,statusText:'Оценка',taskId:'native'});assert.equal(entry.source,'shell');assert.equal(entry.desk,'desk-3');
 assert.throws(()=>f.ipc.get('mouse:progress')(f.event(f.a),'dismiss',{id:entry.id}),/Untrusted/);
 f.host('dismiss',{id:entry.id});assert.equal(f.progress.snapshot().tasks.length,0);const stored=[...f.progress.entries.values()][0];assert.equal(stored.phase,'running');assert.equal(stored.percent,37);
 f.host('update',{percent:100,statusText:'Готово',taskId:'native'});assert.equal([...f.progress.entries.values()].at(-1).phase,'completed');
});
test('privacy and screen lock clear progress and deny page reports until the session is available',t=>{
 const f=fixture(t);f.update(f.a,{percent:3,statusText:'x'});f.power.emit('lock-screen');assert.equal(f.progress.snapshot().tasks.length,0);assert.throws(()=>f.update(f.a,{percent:4,statusText:'x'}),/недоступен/);f.power.emit('unlock-screen');f.update(f.a,{percent:4,statusText:'x'});
 f.privacy(true);f.bridge.clear();assert.deepEqual(f.host('state'),{tasks:[],revision:0});assert.throws(()=>f.update(f.a,{percent:5,statusText:'x'}),/недоступен/);assert.equal(f.progress.snapshot().tasks.length,0);f.privacy(false);assert.equal(f.update(f.a,{percent:6,statusText:'x'}).percent,6);
 f.bridge.dispose();f.bridge.dispose();assert.equal(f.power.listenerCount('lock-screen'),0);assert.equal(f.shell.listenerCount('did-start-navigation'),0);assert.equal(f.a.view.webContents.listenerCount('destroyed'),0);
});

test('declared DOM tasks keep their page identity and disappearance never invents completion',t=>{
 const f=fixture(t),send=(page,value)=>f.ipcMain.emit('mouse:page-activity',f.event(page),{...f.context(page),kind:'dom',active:true,taskId:'real-task',phase:'running',percent:null,statusText:'Работа на сайте',...value});
 send(f.a,{percent:42,source:'agent',tabId:'b',desk:'desk-1'});let task=f.progress.snapshot().tasks[0];assert.equal(task.tabId,'a');assert.equal(task.desk,'desk-3');assert.equal(task.source,'page');assert.equal(task.kind,'observed');assert.equal(task.estimated,true);assert.equal(task.percent,42);
 send(f.b,{percent:17});assert.equal(f.progress.snapshot().tasks.length,2);send(f.a,{active:false});assert.deepEqual(f.progress.snapshot().tasks.map(t=>t.tabId),['b']);
 send(f.a,{percent:100});task=[...f.progress.entries.values()].find(t=>t.tabId==='a');assert.equal(task.phase,'completed');assert.ok(!f.progress.snapshot().tasks.some(t=>t.id===task.id));send(f.a,{active:false});assert.ok(!f.progress.entries.has(task.id));
 f.ipcMain.emit('mouse:page-activity',{...f.event(f.a),senderFrame:{}},{...f.context(f.a),kind:'dom',active:true,taskId:'forged',percent:50,statusText:'forged'});assert.ok(!f.progress.snapshot().tasks.some(t=>t.tabId==='a'));
 for(const value of [NaN,Infinity,-2,101,'99'])send(f.b,{percent:value});assert.equal(f.progress.snapshot().tasks.find(t=>t.tabId==='b').percent,17);
 const packet={...f.context(f.a),kind:'dom',active:true,taskId:'late',percent:77,statusText:'late'};f.power.emit('lock-screen');f.ipcMain.emit('mouse:page-activity',f.event(f.a),packet);assert.equal(f.progress.snapshot().tasks.length,0);f.power.emit('unlock-screen');f.privacy(true);f.ipcMain.emit('mouse:page-activity',f.event(f.a),packet);assert.equal(f.progress.snapshot().tasks.length,0);
});
test('native loading events neither create tasks nor finish a real site task started during page load',async t=>{
 const f=fixture(t),wc=f.a.view.webContents,start=()=>wc.emit('did-start-navigation',{},wc.url,false,true);
 start();wc.emit('did-finish-load');await new Promise(r=>setTimeout(r,280));assert.equal(f.progress.snapshot().tasks.length,0);
 start();await new Promise(r=>setTimeout(r,280));assert.deepEqual(f.progress.snapshot().tasks,[]);
 const task=f.update(f.a,{percent:42,statusText:'Real asynchronous job'});wc.emit('did-finish-load');wc.emit('did-stop-loading');assert.equal(f.progress.snapshot().tasks[0].id,task.id);assert.equal(f.progress.snapshot().tasks[0].phase,'running');assert.equal(f.progress.snapshot().tasks[0].percent,42);
 start();await new Promise(r=>setTimeout(r,280));wc.emit('did-fail-load',{},-105,'NAME_NOT_RESOLVED',wc.url,true);assert.deepEqual(f.progress.snapshot().tasks,[]);
 start();f.bank.members.a='desk-1';f.browser.emit();await new Promise(r=>setTimeout(r,280));assert.equal(f.progress.snapshot().tasks.length,0);
});
test('trusted shell progress binds one current-desktop tab and rejects a foreign tab',t=>{
 const f=fixture(t),a=f.host('update',{percent:20,statusText:'Local task',tabId:'a'});assert.equal(a.tabId,'a');assert.equal(a.kind,'reported');
 assert.throws(()=>f.host('update',{percent:30,statusText:'Foreign',tabId:'b'}),/outside/);assert.equal(f.progress.snapshot().tasks.length,1);
 f.shell.emit('did-start-navigation',{},'file:///next',false,true);assert.equal(f.progress.snapshot().tasks.length,0);
});
test('background desktop switches and same-document routes retain task identity; stale documents cannot resurrect it',t=>{
 const f=fixture(t),old=f.context(f.a),first=f.update(f.a,{percent:21,statusText:'Streaming answer',taskId:'response',etaSeconds:90});
 f.bank.active='desk-1';f.browser.emit();const background=f.update(f.a,{percent:48,statusText:'Still streaming',taskId:'response',etaSeconds:45});assert.equal(background.id,first.id);assert.equal(background.desk,'desk-3');
 f.a.navigationEpoch++;f.a.view.webContents.emit('did-start-navigation',{},'https://a.example/conversation/new',true,true);f.browser.emit();assert.equal(f.progress.snapshot().tasks[0].id,first.id);assert.deepEqual(f.context(f.a),old);
 f.bank.active='desk-3';f.browser.emit();assert.equal(f.progress.snapshot({desk:'desk-3'}).tasks[0].percent,48);
 f.a.navigationEpoch++;f.a.view.webContents.emit('did-start-navigation',{},'https://a.example/new-document',false,true);assert.deepEqual(f.progress.snapshot().tasks,[]);
 assert.throws(()=>f.ipc.get('mouse:page-progress')(f.event(f.a),{...old,percent:80,statusText:'Late result',taskId:'response'}),/document/);
 f.ipcMain.emit('mouse:page-activity',f.event(f.a),{...old,kind:'dom',active:true,taskId:'old-dom',percent:80,statusText:'late'});assert.deepEqual(f.progress.snapshot().tasks,[]);
 const next=f.update(f.a,{percent:null,statusText:'New document task'});assert.notEqual(next.id,first.id);const current=f.context(f.a);f.a.view.webContents.emit('render-process-gone',{},{});assert.deepEqual(f.progress.snapshot().tasks,[]);assert.throws(()=>f.update(f.a,{...current,percent:90,statusText:'Old renderer'}),/document/);
});
test('page-reported ETA and lifecycle are bounded metadata; error and cancel preserve the last percent',t=>{
 const f=fixture(t),first=f.update(f.a,{percent:37,statusText:'Work',taskId:'work',etaSeconds:90});assert.equal(first.etaSeconds,90);
 for(const etaSeconds of [-1,NaN,Infinity,604801,'90'])assert.throws(()=>f.update(f.a,{percent:38,statusText:'bad',taskId:'work',etaSeconds}),/ETA/);
 assert.throws(()=>f.update(f.a,{percent:38,statusText:'bad',taskId:'work',phase:'loading'}),/phase/);
 const zero=f.update(f.a,{percent:null,statusText:'Waiting',taskId:'wait',etaSeconds:0});assert.equal(zero.phase,'running');assert.equal(zero.etaSeconds,0);
 const cancelled=f.update(f.a,{percent:100,statusText:'Owner cancelled',taskId:'work',phase:'cancelled',etaSeconds:10});assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.percent,37);assert.equal(cancelled.etaSeconds,null);
 f.update(f.b,{percent:64,statusText:'Work',taskId:'work',etaSeconds:45});const failed=f.update(f.b,{percent:100,statusText:'Provider error',taskId:'work',phase:'error'});assert.equal(failed.percent,64);assert.equal(failed.etaSeconds,null);
 const done=f.update(f.a,{percent:null,statusText:'Response complete',taskId:'wait',phase:'completed'});assert.equal(done.phase,'completed');assert.ok(!f.progress.snapshot().tasks.some(task=>task.id===done.id));
});
test('one DOM task ending or disappearing cannot remove another task from the same page',t=>{
 const f=fixture(t),send=value=>f.ipcMain.emit('mouse:page-activity',f.event(f.a),{...f.context(f.a),kind:'dom',active:true,phase:'running',percent:25,statusText:'Task',...value});
 send({taskId:'one'});send({taskId:'two',percent:64,etaSeconds:30});const two=f.progress.snapshot().tasks.find(task=>task.taskId==='two');
 send({taskId:'one',active:false});assert.deepEqual(f.progress.snapshot().tasks.map(task=>task.id),[two.id]);
 send({taskId:'one',percent:100});assert.deepEqual(f.progress.snapshot().tasks.map(task=>task.id),[two.id]);
 send({taskId:'two',percent:100});assert.deepEqual(f.progress.snapshot().tasks,[]);
});
test('API and DOM reports share one page four-task cap instead of doubling its allowance',t=>{
 const f=fixture(t),send=value=>f.ipcMain.emit('mouse:page-activity',f.event(f.a),{...f.context(f.a),kind:'dom',active:true,phase:'running',percent:25,statusText:'Task',...value});
 f.update(f.a,{taskId:'api-1',percent:37,statusText:'Task'});f.update(f.a,{taskId:'api-2',percent:37,statusText:'Task'});send({taskId:'dom-1'});send({taskId:'dom-2'});assert.equal(f.progress.snapshot().tasks.length,4);
 assert.throws(()=>f.update(f.a,{taskId:'fifth',percent:37,statusText:'Task'}),error=>error.code==='MOUSE_PROGRESS_LIMIT');send({taskId:'dom-fifth'});assert.equal(f.progress.snapshot().tasks.length,4);
 send({taskId:'dom-1',percent:64});assert.equal(f.progress.snapshot().tasks.find(task=>task.taskId==='dom-1').percent,64);
 f.update(f.a,{taskId:'api-1',percent:100,statusText:'Done'});send({taskId:'dom-third'});assert.equal(f.progress.snapshot().tasks.length,4);
});

test('resuming a normal context requests a fresh observation without leaking normal tasks into private mode',t=>{
 const f=fixture(t),a=f.a.view.webContents,b=f.b.view.webContents;
 f.bridge.resume();assert.deepEqual(a.messages,['mouse:page-activity-resync']);assert.equal(b.messages.length,1);
 f.privacy(true);f.bridge.clear();f.bridge.resume();f.power.emit('lock-screen');f.power.emit('unlock-screen');assert.equal(a.messages.length,1);
 f.privacy(false);f.bridge.resume();assert.equal(a.messages.length,2);assert.equal(b.messages.length,2);
 b.url='file:///internal';f.power.emit('lock-screen');f.power.emit('unlock-screen');assert.equal(a.messages.length,3);assert.equal(b.messages.length,2);
 f.bridge.dispose();f.bridge.resume();assert.equal(a.messages.length,3);
});
