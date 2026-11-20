'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const helperPath=path.resolve(__dirname,'../tools/mouse-634-profile-upgrade.cjs');
const {profileDocumentSnapshot,profileDocumentReady,waitForProfileDocument,reportPrefix,processId}=require(helperPath);
const url='http://127.0.0.1:43125/persisted',origin='http://127.0.0.1:43125';

// Synthetic execution contexts exercise the real read-only renderer probe and
// acceptance predicate; these fixtures are not native installed evidence.
function context(overrides={}){
 const storage={get length(){return 1;},getItem(){throw Error('Readiness must not read saved values');},setItem(){throw Error('Readiness must not write storage');}};
 const value={location:{href:url,origin},document:{readyState:'complete',title:'Mouse634 preserved profile fixture',querySelector:selector=>selector==='#value'?{tagName:'INPUT',type:'text',get value(){throw Error('Readiness must not read input values');}}:null},window:{localStorage:storage}};
 return Object.assign(value,overrides);
}
function sample(value){return JSON.parse(JSON.stringify(vm.runInNewContext('('+profileDocumentSnapshot.toString()+')()',value)));}
function client(contexts){let calls=0;return{get calls(){return calls;},async send(method,params){assert.equal(method,'Runtime.evaluate');assert.equal(params.awaitPromise,true);assert.equal(params.returnByValue,true);const value=contexts[Math.min(calls++,contexts.length-1)];return{result:{value:JSON.parse(JSON.stringify(vm.runInNewContext(params.expression,value)))}};}};}

test('profile readiness rejects a complete initial or wrong-origin document even when target metadata already names the fixture',()=>{
 for(const location of [{href:'about:blank',origin:'null'},{href:url,origin:'http://127.0.0.1:43126'},{href:origin+'/other',origin}]){
  const snapshot=sample(context({location}));assert.equal(snapshot.readyState,'complete');assert.equal(profileDocumentReady(snapshot,url,origin),false);
 }
});

test('profile readiness requires the committed fixture DOM, complete state and accessible storage',()=>{
 for(const document of [
  {readyState:'loading',title:'Mouse634 preserved profile fixture',querySelector:()=>({tagName:'INPUT',type:'text'})},
  {readyState:'complete',title:'Other page',querySelector:()=>({tagName:'INPUT',type:'text'})},
  {readyState:'complete',title:'Mouse634 preserved profile fixture',querySelector:()=>null},
  {readyState:'complete',title:'Mouse634 preserved profile fixture',querySelector:()=>({tagName:'DIV',type:'text'})},
  {readyState:'complete',title:'Mouse634 preserved profile fixture',querySelector:()=>({tagName:'INPUT',type:'password'})}
 ])assert.equal(profileDocumentReady(sample(context({document})),url,origin),false);
 const window={get localStorage(){const error=Error('secret storage value must not enter diagnostics');error.name='SecurityError';throw error;}};
 const denied=sample(context({window}));assert.equal(denied.storageAccessible,false);assert.equal(denied.storageError,'SecurityError');assert.equal(profileDocumentReady(denied,url,origin),false);assert.ok(!JSON.stringify(denied).includes('secret'));
});

test('readiness only reads storage access and records bounded document facts without values',()=>{
 const snapshot=sample(context());assert.equal(profileDocumentReady(snapshot,url,origin),true);
 assert.deepEqual(Object.keys(snapshot).sort(),['href','input','origin','readyState','storageAccessible','storageError','title']);assert.equal(snapshot.storageError,null);
 const long=sample(context({location:{href:'x'.repeat(4096),origin:'y'.repeat(1024)},document:{readyState:'z'.repeat(80),title:'t'.repeat(256),querySelector:()=>null}}));
 assert.equal(long.href.length,2048);assert.equal(long.origin.length,512);assert.equal(long.readyState.length,32);assert.equal(long.title.length,128);assert.equal(profileDocumentReady(long,url,origin),false);
});

test('real wait samples the execution context until the fixture commits and retains target identity diagnostics',async()=>{
 const ready=client([context({location:{href:'about:blank',origin:'null'}}),context()]),facts={};
 assert.equal(await waitForProfileDocument(ready,{id:'owned-page',url},url,origin,facts),true);
 assert.equal(ready.calls,2);assert.equal(facts.attempts,2);assert.equal(facts.ready,true);assert.deepEqual(facts.target,{id:'owned-page',url});assert.equal(facts.last.href,url);assert.equal(facts.last.origin,origin);assert.equal(facts.last.input,true);assert.equal(facts.last.storageAccessible,true);assert.equal(facts.evaluationError,null);
});

test('uncommitted documents exhaust the unchanged twenty-second/100ms polling bound and preserve the last diagnostic',async()=>{
 const source=fs.readFileSync(helperPath,'utf8'),waits=[];let now=0;
 const sandbox={require,module:{exports:{}},exports:{},__dirname:path.dirname(helperPath),process:{argv:['node','import-only','invalid-json'],env:{}},Date:{now:()=>now},setTimeout(callback,ms){waits.push(ms);now+=ms;queueMicrotask(callback);},clearTimeout(){}};
 vm.runInNewContext(source,sandbox,{filename:helperPath});
 const pending=client([context({location:{href:'about:blank',origin:'null'}})]),facts={};
 await assert.rejects(sandbox.module.exports.waitForProfileDocument(pending,{id:'owned-page',url},url,origin,facts),/committed profile webpage ready/);
 assert.equal(now,20000);assert.equal(waits.length,200);assert.ok(waits.every(ms=>ms===100));assert.equal(pending.calls,200);assert.equal(facts.ready,false);assert.equal(facts.last.href,'about:blank');assert.equal(facts.last.origin,'null');assert.equal(facts.last.readyState,'complete');assert.equal(facts.target.url,url);
});


test('Linux report prefixes keep independent deb and AppImage native bytes scoped',()=>{
 for(const format of ['deb','appimage'])assert.equal(reportPrefix({reportPrefix:'mouse-634-upgrade-'+format,packageFormat:format},'linux'),'mouse-634-upgrade-'+format);
 for(const platform of ['darwin','win32'])assert.equal(reportPrefix({},platform),'mouse-634-upgrade');
 for(const value of [{},{reportPrefix:'../other',packageFormat:'deb'},{reportPrefix:'mouse-634-upgrade-deb',packageFormat:'appimage'},{reportPrefix:'mouse-634-upgrade',packageFormat:'deb'}])assert.throws(()=>reportPrefix(value,'linux'));
 assert.throws(()=>reportPrefix({reportPrefix:'mouse-634-upgrade-deb'},'win32'));
});

test('actual CDP browser PID is distinct from a launcher and rejects ambiguous process lists',()=>{
 assert.equal(processId([{type:'renderer',id:17},{type:'browser',id:29}]),29);
 for(const rows of [[],[{type:'renderer',id:17}],[{type:'browser',id:29},{type:'browser',id:30}],[{type:'browser',id:0}],[{type:'browser',id:'29'}],[{type:'browser',id:1.5}]])assert.throws(()=>processId(rows));
});
