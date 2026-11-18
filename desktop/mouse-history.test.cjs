'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Library}=require('./mouse-library.cjs'),{technical,pageKey,groupHistory,attachHistory}=require('./mouse-history.cjs');
function store(seed={}){let data=structuredClone(seed);return{get:async k=>({[k]:structuredClone(data[k])}),set:async v=>{data=structuredClone({...data,...v});}};}
function fixture(lib){const wc=new EventEmitter();let callback=null,notifies=0;wc.url='';wc.title='';wc.getURL=()=>wc.url;wc.getTitle=()=>wc.title;wc.isDestroyed=()=>false;
 const tracker=attachHistory(wc,lib,()=>notifies++,{setTimer:fn=>(callback=fn,1),clearTimer:()=>{callback=null;}});
 return{wc,tracker,settle(){const f=callback;callback=null;f?.();},navigate(url,title){wc.emit('did-start-navigation',{},url,false,true);wc.url=url;wc.emit('did-navigate',{},url);wc.title=title;wc.emit('page-title-updated',{},title);wc.emit('did-finish-load');},count:()=>notifies};}
function timedFixture(lib){
 const wc=new EventEmitter(),timers=new Map(),visits=[];let now=0,sequence=0;wc.url='';wc.title='';wc.getURL=()=>wc.url;wc.getTitle=()=>wc.title;wc.isDestroyed=()=>false;
 const visit=lib.visit.bind(lib);lib.visit=(...args)=>{const row=visit(...args);visits.push({at:now,id:row?.id,url:args[0],previousId:args[2]?.previousId});return row;};
 const tracker=attachHistory(wc,lib,()=>{},{setTimer:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimer:id=>timers.delete(id)});
 return{wc,tracker,timers,visits,advanceTo(at){assert.ok(at>=now);for(;;){const next=[...timers].filter(([,t])=>t.at<=at).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();}now=at;},navigate(url){wc.url=url;wc.emit('did-navigate',{},url);},title(value){wc.title=value;wc.emit('page-title-updated',{},value);}};
}
test('recorded fd27 navigation timing without an initial start creates one visit after load completion',async t=>{
 const l=await new Library(store()).init(),f=timedFixture(l),url='https://fixture.test/mouse620-history/page';t.after(async()=>{f.tracker.dispose();await l.flush();});
 // Offsets from fd27's observed did-navigate. Its diagnostics attach late;
 // absence of a start here does not prove the history tracker missed that event.
 f.navigate(url);f.advanceTo(45);f.title('620 history fixture');f.advanceTo(930);const beforeFinish=l.data.history.length;
 f.advanceTo(931);f.wc.emit('did-finish-load');
 const offsets=[[1118,1119,1122],[1132,1134,1134],[1135,1135,1136],[1137,1138,1138],[1138,1139,1139],[1140,1141,1141],[1141,1142,1142],[1143,1143,1144],[1144,1145,1145],[1146,1146,1147],[1147,1148,1148],[1148,1149,1149],[1149,1150,1151],[1151,1152,1152],[1153,1153,1154]];
 for(const [n,[start,navigate,title]]of offsets.entries()){
  const next=url+'?filter='+n+'#section'+n;f.advanceTo(start);f.wc.emit('did-start-navigation',{},next,true,true);f.advanceTo(navigate);f.wc.url=next;f.wc.emit('did-navigate-in-page',{},next,true);f.advanceTo(title);f.title('Action '+n);
 }
 f.advanceTo(1605);t.diagnostic(JSON.stringify({scope:'recorded event timing with deterministic timers',beforeFinish,visits:f.visits}));
 assert.equal(l.data.history.length,1);assert.equal(l.list('history','mouse620-history').total,1);assert.equal(beforeFinish,0);assert.equal(f.visits.length,1);assert.equal(f.visits[0].at,1604);assert.equal(l.data.history[0].url,url+'?filter=14#section14');assert.equal(l.data.history[0].title,'Action 14');
});
test('finished navigation with or without an observed start keeps its visit ID through fifteen actions and reload',async t=>{
 for(const withStart of [false,true]){
  const l=await new Library(store()).init(),f=timedFixture(l),url='https://fixture.test/catalog';t.after(async()=>{f.tracker.dispose();await l.flush();});
  if(withStart)f.wc.emit('did-start-navigation',{},url,false,true);f.navigate(url);f.advanceTo(45);f.title('Catalogue');f.advanceTo(930);f.tracker.flush();assert.equal(f.visits.length,0,'No title debounce or explicit flush records an unfinished page');
  f.advanceTo(931);f.wc.emit('did-finish-load');f.advanceTo(1380);assert.equal(f.visits.length,0,'The original450ms debounce is preserved');f.advanceTo(1381);assert.equal(l.data.history.length,1);const id=l.data.history[0].id;
  for(let n=0;n<15;n++){f.advanceTo(1400+n*20);const next=url+'?filter='+n+'#section'+n;f.wc.emit('did-start-navigation',{},next,true,true);f.wc.url=next;f.wc.emit('did-navigate-in-page',{},next,true);f.title('Action '+n);}
  f.advanceTo(2129);assert.equal(f.visits.length,1);f.advanceTo(2130);assert.equal(l.data.history.length,1);assert.equal(l.list('history').total,1);assert.equal(l.data.history[0].id,id);assert.equal(l.data.history[0].url,url+'?filter=14#section14');assert.equal(l.data.history[0].title,'Action 14');
  f.wc.emit('did-start-navigation',{},f.wc.url,false,true);f.navigate(f.wc.url);f.title('Reloaded');f.advanceTo(3000);assert.equal(f.visits.length,2);f.wc.emit('did-finish-load');f.advanceTo(3450);assert.equal(l.data.history.length,1);assert.equal(l.data.history[0].id,id);
  for(const [n,next]of [url+'/different',url+'/different#/one',url+'/different#/two'].entries()){f.wc.url=next;f.wc.emit('did-navigate-in-page',{},next,true);f.title('Route '+n);f.advanceTo(3900+n*450);assert.equal(l.data.history.length,2+n,'Distinct paths and routed hashes remain separate visits');}
 }
});
test('a new committed navigation cancels the prior debounce and records only the latest finished redirect',async t=>{
 const l=await new Library(store()).init(),f=timedFixture(l);t.after(async()=>{f.tracker.dispose();await l.flush();});
 f.navigate('https://fixture.test/previous');f.title('Previous');f.wc.emit('did-finish-load');assert.equal(f.timers.size,1);
 f.advanceTo(100);f.navigate('https://fixture.test/intermediate');assert.equal(f.timers.size,0,'Committed navigation cancels a previous document timer even without start');f.advanceTo(110);f.title('Intermediate');f.advanceTo(600);assert.equal(f.visits.length,0);
 f.advanceTo(650);f.navigate('https://fixture.test/final');f.advanceTo(660);f.title('Final');f.advanceTo(1200);f.tracker.flush();assert.equal(f.visits.length,0);
 f.wc.emit('did-finish-load');f.advanceTo(1649);assert.equal(f.visits.length,0);f.advanceTo(1650);assert.equal(f.visits.length,1);assert.equal(l.data.history.length,1);assert.equal(l.data.history[0].url,'https://fixture.test/final');assert.equal(l.data.history[0].title,'Final');
});
test('failure and disposal cancel an unfinished navigation before its delayed finish',async t=>{
 for(const mode of ['failure','dispose','destroyed']){
  const l=await new Library(store()).init(),f=timedFixture(l);t.after(async()=>{f.tracker.dispose();await l.flush();});
  f.navigate('https://fixture.test/unfinished');f.advanceTo(45);f.title('Unfinished');f.advanceTo(600);assert.equal(f.visits.length,0,mode);
  if(mode==='failure')f.wc.emit('did-fail-load',{},-105,'Fixture failure',f.wc.url,true);else if(mode==='dispose')f.tracker.dispose();else f.wc.emit('destroyed');
  f.title('Late title');f.advanceTo(1200);f.tracker.flush();assert.equal(f.visits.length,0);assert.equal(f.timers.size,0);
  if(mode==='failure'){f.navigate('https://fixture.test/recovered');f.title('Recovered');f.advanceTo(1700);assert.equal(f.visits.length,0);f.wc.emit('did-finish-load');f.advanceTo(2150);assert.equal(l.data.history.length,1);assert.equal(l.data.history[0].url,'https://fixture.test/recovered');}
  else{f.wc.emit('did-finish-load');f.advanceTo(2150);assert.equal(f.visits.length,0);assert.equal(f.wc.listenerCount('did-finish-load'),0);}
 }
});
test('one finished page is not recorded for each anchor, tracking or filter action, title or reload',async()=>{
 const l=await new Library(store()).init(),f=fixture(l),w=f.wc;
 f.navigate('https://example.com/catalog','Catalogue');assert.equal(l.data.history.length,0);f.settle();assert.equal(l.data.history.length,1);const id=l.data.history[0].id;
 for(let n=0;n<20;n++){w.url='https://example.com/catalog?filter='+n+'&utm_source=copy#item'+n;w.emit('did-navigate-in-page',{},w.url,true);f.settle();w.title='Catalogue '+n;w.emit('page-title-updated',{},w.title);}
 assert.equal(l.data.history.length,1);assert.equal(l.data.history[0].id,id);assert.match(l.data.history[0].url,/filter=19/);
 f.navigate(w.url,'Reloaded');f.settle();assert.equal(l.data.history.length,1);
 f.navigate('https://example.com/car/1','Car one');f.settle();assert.equal(l.data.history.length,2);
 w.url='https://example.com/car/2';w.title='Car two';w.emit('did-navigate-in-page',{},w.url,true);f.settle();assert.equal(l.data.history.length,3);
 f.tracker.dispose();await l.flush();
});
test('different tabs coalesce their own page independently and retain separate page paths and routed hashes',async()=>{
 const l=await new Library(store()).init(),a=fixture(l),b=fixture(l);a.navigate('https://a.test/page','A');a.settle();b.navigate('https://b.test/page','B');b.settle();a.wc.url='https://a.test/page#section';a.wc.emit('did-navigate-in-page',{},a.wc.url,true);a.settle();assert.equal(l.data.history.length,2);
 a.wc.url='https://a.test/page#/route-one';a.wc.emit('did-navigate-in-page',{},a.wc.url,true);a.settle();assert.equal(l.data.history.length,3);
 a.wc.url='https://a.test/page#/route-two';a.wc.emit('did-navigate-in-page',{},a.wc.url,true);a.settle();assert.equal(l.data.history.length,4);
 assert.notEqual(pageKey('https://a.test/?q=one'),pageKey('https://a.test/?q=two'));assert.equal(pageKey('https://a.test/#part'),pageKey('https://a.test/?utm_source=x'));
 a.tracker.dispose();b.tracker.dispose();await l.flush();
});
test('technical challenge loops, unfinished navigations, subframes and destroyed pages produce no visits',async()=>{
 const l=await new Library(store()).init(),f=fixture(l),w=f.wc;
 for(let i=0;i<6;i++){f.navigate('https://claude.ai/api/challenge_redirect?t='+i,'Один момент...');f.settle();}
 f.navigate('https://claude.ai/','Just a moment...');f.settle();assert.equal(l.data.history.length,0);
 w.title='Claude';w.emit('page-title-updated',{},w.title);f.settle();assert.equal(l.data.history.length,1);
 w.url='https://frame.test/';w.emit('did-navigate-in-page',{},w.url,false);f.settle();assert.equal(l.data.history.length,1);
 f.navigate('https://failed.test/','Failed');w.emit('did-fail-load',{},-105,'DNS',w.url,true);f.settle();assert.equal(l.data.history.length,1);
 f.navigate('https://destroyed.test/','Disposed');w.emit('destroyed');f.settle();assert.equal(l.data.history.length,1);
 assert.equal(technical('https://example.com/just-a-moment','An article'),false);assert.equal(technical('file:///private'),true);await l.flush();
});
test('existing same-day repeats are grouped for display without changing stored records or other days',async()=>{
 const at=new Date(2026,10,17,12).getTime(),raw=[{id:'one',url:'https://a.test/p?utm_medium=x',title:'A',at},{id:'two',url:'https://a.test/p#part',title:'A again',at:at-10000},{id:'distinct',url:'https://a.test/another',title:'Other page',at:at-20000},{id:'yesterday',url:'https://a.test/p',title:'Yesterday',at:at-86400000},{id:'technical',url:'https://claude.ai/api/challenge_redirect?secret=123',title:'Just a moment...',at}];
 const s=store({quadroLibrary:{history:raw}}),l=await new Library(s).init();assert.deepEqual(l.data.history,raw);assert.equal(l.list('history').total,3);assert.equal(l.suggestions('challenge').length,0);assert.equal(groupHistory(raw)[0].ids.length,2);
 const selected=l.selected('history',{ids:['one']});assert.deepEqual(selected,['one','two']);l.data.history.unshift({id:'new',url:'https://a.test/p',title:'New after confirmation',at:at+20000});assert.equal(l.removeMany('history',selected),2);assert.equal(l.list('history').items[0].id,'new');assert.ok(l.data.history.some(x=>x.id==='yesterday'));assert.ok(l.data.history.some(x=>x.id==='technical'));await l.flush();
});
test('an explicitly cleared current visit is not recreated by an unrelated title update',async()=>{
 const l=await new Library(store()).init(),f=fixture(l);f.navigate('https://example.com/','Page');f.settle();l.clear('history');f.wc.emit('page-title-updated',{},'New title');f.settle();assert.equal(l.data.history.length,0);f.tracker.dispose();await l.flush();
});
