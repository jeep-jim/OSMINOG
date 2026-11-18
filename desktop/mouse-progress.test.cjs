'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ProgressStore,MAX_ACTIVE,MAX_PER_OWNER,MAX_HISTORY,HISTORY_TTL,STALE_TTL,COMPLETED_VISIBLE,STOPPED_VISIBLE,EMIT_INTERVAL}=require('./mouse-progress.cjs');
const input=(value={})=>({desk:'desk-3',source:'agent',label:'Agent Mouse',percent:null,statusText:'Работает',estimated:true,...value});
test('progress is explicit, sanitized and owned; indeterminate and an AI estimate stay distinct',()=>{
 const s=new ProgressStore();try{
  const a=s.update('agent:a',input({statusText:'  Готовлю\nданные\u202e <b>  '})),b=s.update('agent:b',input({percent:37.56}));assert.equal(a.percent,null);assert.equal(a.statusText,'Готовлю данные <b>');assert.equal(b.percent,37.5);assert.equal(b.estimated,true);assert.notEqual(a.id,b.id);assert.equal(s.snapshot().tasks.length,2);assert.ok(!('owner' in a)&&!('key' in a));
  for(const value of [NaN,Infinity,-1,101,'35',{},true])assert.throws(()=>s.update('agent:a',input({percent:value})),/percent/);assert.equal(s.snapshot().tasks[0].percent,null);
  assert.throws(()=>s.update('agent:a',input({desk:'desk-1'})),/context/);assert.throws(()=>s.update('agent:a',input({label:'Another source'})),/context/);assert.equal(s.snapshot({desk:'desk-1'}).tasks.length,0);
  assert.equal(s.update('agent:a',input({percent:99.99})).phase,'running');assert.equal(s.snapshot().tasks.find(t=>t.id===a.id).percent,99.9);s.removeOwner('agent:a');assert.deepEqual(s.snapshot().tasks.map(t=>t.id),[b.id]);
 }finally{s.dispose();}
});
test('Stop and errors preserve the last estimate; only completion yields 100 and then dismisses',()=>{
 let now=100;const s=new ProgressStore({now:()=>now});try{
  const a=s.update('agent:a',input({percent:63}));s.stopOwner('agent:a','Остановлено');const stopped=s.snapshot().tasks[0];assert.equal(stopped.phase,'stopped');assert.equal(stopped.percent,63);assert.equal(stopped.dismissAt,now+STOPPED_VISIBLE);
  s.update('terminal:a',input({source:'terminal',label:'Терминал',estimated:false}));const error=s.finish('terminal:a','default',{phase:'error',statusText:'Код 2'});assert.equal(error.percent,null);assert.equal(error.estimated,false);
  const complete=s.update('agent:b',input({percent:100,statusText:'Готово'}));assert.equal(complete.phase,'completed');assert.equal(complete.estimated,true);assert.equal(complete.dismissAt,now+COMPLETED_VISIBLE);now+=500;s.update('agent:b',input({percent:100,statusText:'Готово'}));assert.equal(s.snapshot().tasks.find(t=>t.id===complete.id).dismissAt,complete.dismissAt,'Repeating 100 does not restart the completion timer');
  now=100+COMPLETED_VISIBLE;assert.ok(!s.snapshot().tasks.some(t=>t.id===complete.id));assert.ok(s.snapshot().tasks.some(t=>t.id===a.id));now=100+STOPPED_VISIBLE;assert.equal(s.snapshot().tasks.length,0);assert.equal(s.entries.size,3);now=100+HISTORY_TTL;s.sweep();assert.equal(s.entries.size,0);assert.equal(s.latest.size,0);
 }finally{s.dispose();}
});
test('active tasks, per-owner tasks and retained history are bounded',()=>{
 const s=new ProgressStore();try{
  for(let i=0;i<MAX_PER_OWNER;i++)s.update('owner',input({taskId:'task-'+i}));assert.throws(()=>s.update('owner',input({taskId:'too-many'})),/limit/);
  for(let i=MAX_PER_OWNER;i<MAX_ACTIVE;i++)s.update('owner-'+i,input());assert.equal(s.snapshot().tasks.length,MAX_ACTIVE);assert.throws(()=>s.update('overflow',input()),error=>error.name==='ProgressLimitError'&&error.code==='MOUSE_PROGRESS_LIMIT');
  for(let i=0;i<MAX_HISTORY+10;i++)s.update('history-'+i,input({percent:100}));assert.ok(s.entries.size<=MAX_ACTIVE+MAX_HISTORY);s.clear();assert.deepEqual(s.snapshot().tasks,[]);assert.equal(s.entries.size,0);
 }finally{s.dispose();}
});
test('rapid running updates coalesce, and a terminal outcome publishes immediately',async()=>{
 const events=[],s=new ProgressStore({emit:event=>events.push(event)});try{
  s.update('agent',input({percent:0}));for(let i=1;i<=40;i++)s.update('agent',input({percent:i,statusText:'Этап '+i}));assert.equal(events.length,1);await new Promise(resolve=>setTimeout(resolve,EMIT_INTERVAL+30));assert.equal(events.length,2);assert.equal(events[1].tasks[0].percent,40);
  s.stopOwner('agent');assert.equal(events.length,3);assert.equal(events[2].tasks[0].phase,'stopped');assert.equal(events[2].tasks[0].percent,40);
 }finally{s.dispose();}
});
test('a silent producer becomes stale without claiming work stopped or completed; ownership removal clears its state',()=>{
 let now=1;const s=new ProgressStore({now:()=>now});try{
  s.update('page:1:0',input({source:'page',label:'example.test',tabId:'page-id',percent:12}));now+=STALE_TTL;s.sweep();const stale=s.snapshot().tasks[0];assert.equal(stale.phase,'stale');assert.notEqual(stale.phase,'stopped');assert.notEqual(stale.phase,'completed');assert.equal(stale.percent,12);assert.equal(stale.statusText,'Нет обновлений');assert.equal(stale.dismissAt,now+STOPPED_VISIBLE);s.removeOwner('page:1:0');assert.deepEqual(s.snapshot().tasks,[]);assert.equal(s.entries.size,0);
 }finally{s.dispose();}
});
test('a burst of reported completions cannot flood renderer events or grow retained history',async()=>{
 const events=[],s=new ProgressStore({emit:value=>events.push(value)});try{
  for(let i=0;i<80;i++)s.update('page',input({source:'page',taskId:'task-'+i,percent:100,statusText:'Result '+i}));assert.ok(events.length<=2);assert.equal(s.entries.size,MAX_HISTORY);await new Promise(resolve=>setTimeout(resolve,EMIT_INTERVAL+30));assert.ok(events.length<=3);s.clear();assert.deepEqual(events.at(-1).tasks,[]);
 }finally{s.dispose();}
});
