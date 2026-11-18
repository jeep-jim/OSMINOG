'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {ProgressStore}=require('./mouse-progress.cjs'),{install}=require('./mouse-progress-bridge.cjs');
function fixture(t){
 let n=0,privateMode=false;const ipc=new Map(),power=new EventEmitter();
 function wc(url){const value=new EventEmitter();Object.assign(value,{id:++n,mainFrame:{},url,dead:false,isDestroyed:()=>value.dead,getURL:()=>value.url});return value;}
 const shell=wc('file:///mouse/index.html'),bank={active:'desk-3',items:[{id:'desk-1'},{id:'desk-3'}],members:{}},browser={tabs:new Map(),mouseDesktops:{bank},emit(){}};
 browser.make=(id,desk='desk-3')=>{const value={id,navigationEpoch:0,view:{webContents:wc('https://'+id+'.example/')}};browser.tabs.set(id,value);bank.members[id]=desk;return value;};
 const a=browser.make('a'),b=browser.make('b','desk-1'),progress=new ProgressStore();
 const bridge=install({win:{webContents:shell},browser,ipcMain:{handle:(name,fn)=>ipc.set(name,fn)},trusted:event=>{if(event.sender!==shell||event.senderFrame!==shell.mainFrame)throw Error('Untrusted shell');},progress,isPrivate:()=>privateMode,powerMonitor:power});
 t.after(()=>{bridge.dispose();progress.dispose();});
 const event=page=>({sender:page.view.webContents,senderFrame:page.view.webContents.mainFrame}),update=(page,payload)=>ipc.get('mouse:page-progress')(event(page),payload),host=(action,payload)=>ipc.get('mouse:progress')({sender:shell,senderFrame:shell.mainFrame},action,payload);
 return{ipc,power,shell,bank,browser,a,b,progress,bridge,event,update,host,privacy:value=>{privateMode=value;}};
}
test('page progress binds sender page/desk/source and identical task IDs cannot overwrite another page',t=>{
 const f=fixture(t),a=f.update(f.a,{percent:37,statusText:'Пишу код',taskId:'same',desk:'desk-1',source:'agent',label:'Forged',tabId:'b',estimated:false}),b=f.update(f.b,{percent:null,statusText:'Ожидание',taskId:'same'});
 assert.equal(a.desk,'desk-3');assert.equal(a.source,'page');assert.equal(a.tabId,'a');assert.equal(a.label,'a.example');assert.equal(a.estimated,true);assert.equal(b.desk,'desk-1');assert.notEqual(a.id,b.id);assert.equal(f.progress.snapshot().tasks.length,2);
 f.update(f.a,{percent:51,statusText:'Этап 2',taskId:'same'});assert.equal(f.progress.snapshot().tasks.find(x=>x.id===b.id).percent,null);
});
test('navigation, page closure and desktop moves remove old ownership without leaking indicators',t=>{
 const f=fixture(t);f.update(f.a,{percent:10,statusText:'Первый документ'});f.a.navigationEpoch++;f.a.view.webContents.emit('did-start-navigation',{},'https://a.example/next',false,true);assert.equal(f.progress.snapshot().tasks.length,0);
 f.update(f.a,{percent:20,statusText:'Другой документ'});f.bank.members.a='desk-1';f.browser.emit();assert.equal(f.progress.snapshot().tasks.length,0);assert.equal(f.update(f.a,{percent:30,statusText:'Другой стол'}).desk,'desk-1');
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
