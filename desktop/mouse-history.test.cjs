'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Library}=require('./mouse-library.cjs'),{technical,pageKey,groupHistory,attachHistory}=require('./mouse-history.cjs');
function store(seed={}){let data=structuredClone(seed);return{get:async k=>({[k]:structuredClone(data[k])}),set:async v=>{data=structuredClone({...data,...v});}};}
function fixture(lib){const wc=new EventEmitter();let callback=null,notifies=0;wc.url='';wc.title='';wc.getURL=()=>wc.url;wc.getTitle=()=>wc.title;wc.isDestroyed=()=>false;
 const tracker=attachHistory(wc,lib,()=>notifies++,{setTimer:fn=>(callback=fn,1),clearTimer:()=>{callback=null;}});
 return{wc,tracker,settle(){const f=callback;callback=null;f?.();},navigate(url,title){wc.emit('did-start-navigation',{},url,false,true);wc.url=url;wc.emit('did-navigate',{},url);wc.title=title;wc.emit('page-title-updated',{},title);wc.emit('did-finish-load');},count:()=>notifies};}
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
