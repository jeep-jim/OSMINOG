'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ProgressStore,MAX_ACTIVE,MAX_PER_OWNER,MAX_HISTORY,HISTORY_TTL,STALE_TTL,COMPLETED_VISIBLE,STOPPED_VISIBLE,EMIT_INTERVAL,MAX_ETA_SECONDS}=require('./mouse-progress.cjs');
const input=(value={})=>({desk:'desk-3',source:'page',label:'Page task',percent:null,statusText:'Работает',estimated:true,...value});
test('progress is explicit, sanitized and owned; indeterminate and an AI estimate stay distinct',()=>{
 const s=new ProgressStore();try{
  const a=s.update('page:a',input({statusText:'  Готовлю\nданные\u202e <b>  '})),b=s.update('page:b',input({percent:37.56}));assert.equal(a.percent,null);assert.equal(a.statusText,'Готовлю данные <b>');assert.equal(b.percent,37.5);assert.equal(b.estimated,true);assert.notEqual(a.id,b.id);assert.equal(s.snapshot().tasks.length,2);assert.ok(!('owner' in a)&&!('key' in a));
  for(const value of [NaN,Infinity,-1,101,'35',{},true])assert.throws(()=>s.update('page:a',input({percent:value})),/percent/);assert.equal(s.snapshot().tasks[0].percent,null);
  assert.throws(()=>s.update('page:a',input({desk:'desk-1'})),/context/);assert.throws(()=>s.update('page:a',input({label:'Another source'})),/context/);assert.equal(s.snapshot({desk:'desk-1'}).tasks.length,0);
  assert.equal(s.update('page:a',input({percent:99.99})).phase,'running');assert.equal(s.snapshot().tasks.find(t=>t.id===a.id).percent,99.9);s.removeOwner('page:a');assert.deepEqual(s.snapshot().tasks.map(t=>t.id),[b.id]);
 }finally{s.dispose();}
});
test('Stop and errors preserve the last estimate; completed metadata100 is immediately absent from visible tasks',()=>{
 let now=100;const s=new ProgressStore({now:()=>now});try{
  const a=s.update('page:a',input({percent:63}));s.stopOwner('page:a','Остановлено');const stopped=s.snapshot().tasks[0];assert.equal(stopped.phase,'stopped');assert.equal(stopped.percent,63);assert.equal(stopped.dismissAt,now+STOPPED_VISIBLE);
  s.update('shell:a',input({source:'shell',label:'Инструмент ИИ',estimated:false}));const error=s.finish('shell:a','default',{phase:'error',statusText:'Код 2'});assert.equal(error.percent,null);assert.equal(error.estimated,false);
  const complete=s.update('page:b',input({percent:100,statusText:'Готово'}));assert.equal(complete.phase,'completed');assert.equal(complete.estimated,true);assert.equal(COMPLETED_VISIBLE,0);assert.equal(complete.dismissAt,now);assert.ok(!s.snapshot().tasks.some(t=>t.id===complete.id));now+=500;assert.equal(s.update('page:b',input({percent:100,statusText:'Готово'})).id,complete.id,'Repeated100 remains the same hidden completion');
  assert.ok(!s.snapshot().tasks.some(t=>t.id===complete.id));assert.ok(s.snapshot().tasks.some(t=>t.id===a.id));now=100+STOPPED_VISIBLE;assert.equal(s.snapshot().tasks.length,0);assert.equal(s.entries.size,3);now=100+HISTORY_TTL;s.sweep();assert.equal(s.entries.size,0);assert.equal(s.latest.size,0);
 }finally{s.dispose();}
});
test('only a producer supplies ETA; zero stays running, elapsed time changes none, and outcomes clear it',()=>{
 let now=100;const s=new ProgressStore({now:()=>now});try{
  const first=s.report('page',input({source:'page',percent:37,etaSeconds:90}));assert.equal(first.etaSeconds,90);
  now+=10000;assert.equal(s.snapshot().tasks[0].etaSeconds,90,'No timer predicts or counts down the reported remaining time');
  const zero=s.report('page',input({source:'page',percent:37,etaSeconds:0}));assert.equal(zero.etaSeconds,0);assert.equal(zero.phase,'running');
  for(const etaSeconds of [-1,NaN,Infinity,MAX_ETA_SECONDS+1,'12',{}])assert.throws(()=>s.report('page',input({source:'page',etaSeconds})),/ETA/);
  assert.equal(s.snapshot().tasks[0].etaSeconds,0);
  s.report('page',input({source:'page',percent:38}));assert.equal(s.snapshot().tasks[0].etaSeconds,null,'Omission explicitly means unknown rather than retaining a stale estimate');
  const cancelled=s.report('page',input({source:'page',phase:'cancelled',percent:100,etaSeconds:12,statusText:'Request cancelled'}));assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.percent,38);assert.equal(cancelled.etaSeconds,null);
  s.report('next',input({percent:64,etaSeconds:45}));const error=s.report('next',input({phase:'error',percent:100,statusText:'Network error'}));assert.equal(error.percent,64);assert.equal(error.etaSeconds,null);
  s.report('done',input({percent:null,etaSeconds:20}));const done=s.report('done',input({phase:'completed',percent:null}));assert.equal(done.percent,100);assert.ok(!s.snapshot().tasks.some(task=>task.id===done.id));
 }finally{s.dispose();}
});
test('removing one declared task and moving its owner preserves other tasks and stable identities',()=>{
 const s=new ProgressStore();try{
  const a=s.update('page',input({taskId:'a',percent:12})),b=s.update('page',input({taskId:'b',percent:24}));
  s.moveOwner('page','desk-2');assert.deepEqual(s.snapshot({desk:'desk-3'}).tasks,[]);assert.deepEqual(s.snapshot({desk:'desk-2'}).tasks.map(t=>t.id),[a.id,b.id]);
  s.removeTask('page','a');assert.deepEqual(s.snapshot().tasks.map(t=>t.id),[b.id]);assert.equal(s.latest.size,1);
 }finally{s.dispose();}
});
test('active tasks, per-owner tasks and retained history are bounded',()=>{
 const s=new ProgressStore();try{
  for(let i=0;i<MAX_PER_OWNER;i++)s.update('owner',input({taskId:'task-'+i}));assert.throws(()=>s.update('owner',input({taskId:'too-many'})),/limit/);
  for(let i=MAX_PER_OWNER;i<MAX_ACTIVE;i++)s.update('owner-'+i,input());assert.equal(s.snapshot().tasks.length,MAX_ACTIVE);assert.throws(()=>s.update('overflow',input()),error=>error.name==='ProgressLimitError'&&error.code==='MOUSE_PROGRESS_LIMIT');
  for(let i=0;i<MAX_HISTORY+10;i++)s.update('history-'+i,input({percent:100}));assert.ok(s.entries.size<=MAX_ACTIVE+MAX_HISTORY);s.clear();assert.deepEqual(s.snapshot().tasks,[]);assert.equal(s.entries.size,0);
 }finally{s.dispose();}
});
test('fifty independent tabs can report across five desks;65th active owner and fifth task from one owner are bounded',()=>{
 const s=new ProgressStore();try{
  assert.equal(MAX_ACTIVE,64);for(let i=0;i<50;i++)s.update('page:'+i,input({source:'page',desk:'desk-'+Math.floor(i/10),tabId:'tab-'+i,percent:i,statusText:'Site task'}));
  assert.equal(s.snapshot().tasks.length,50);for(let i=50;i<64;i++)s.update('page:'+i,input({source:'page',tabId:'tab-'+i}));assert.equal(s.snapshot().tasks.length,64);assert.throws(()=>s.update('page:65',input({source:'page'})),error=>error.code==='MOUSE_PROGRESS_LIMIT');
  s.clear();for(let i=0;i<4;i++)s.update('one-page',input({taskId:'task-'+i}));assert.throws(()=>s.update('one-page',input({taskId:'fifth'})),error=>error.code==='MOUSE_PROGRESS_LIMIT');
 }finally{s.dispose();}
});
test('an identical producer ETA is a fresh estimate and publishes its new receipt timestamp',()=>{
 let now=1000;const emitted=[],s=new ProgressStore({now:()=>now,emit:value=>emitted.push(value)});try{
  const first=s.update('page',input({source:'page',percent:37,etaSeconds:90}));now+=5000;const next=s.update('page',input({source:'page',percent:37,etaSeconds:90}));
  assert.equal(next.id,first.id);assert.equal(next.updatedAt,6000);assert.equal(emitted.length,2);assert.equal(emitted[1].tasks[0].updatedAt,6000);assert.equal(next.percent,37);assert.equal(next.etaSeconds,90);
 }finally{s.dispose();}
});
test('rapid running updates coalesce, and a terminal outcome publishes immediately',async()=>{
 const events=[],s=new ProgressStore({emit:event=>events.push(event)});try{
  s.update('page',input({percent:0}));for(let i=1;i<=40;i++)s.update('page',input({percent:i,statusText:'Этап '+i}));assert.equal(events.length,1);await new Promise(resolve=>setTimeout(resolve,EMIT_INTERVAL+30));assert.equal(events.length,2);assert.equal(events[1].tasks[0].percent,40);
  s.stopOwner('page');assert.equal(events.length,3);assert.equal(events[2].tasks[0].phase,'stopped');assert.equal(events[2].tasks[0].percent,40);
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

test('removed Agent and terminal runtimes cannot create progress producers',()=>{const s=new ProgressStore();try{for(const source of ['agent','terminal'])assert.throws(()=>s.update('retired',input({source})),/Invalid progress source/);assert.equal(s.snapshot().tasks.length,0);}finally{s.dispose();}});
