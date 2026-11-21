'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSearchService,SearchError,publicSearchError,networkFailure}=require('./mouse-search-service.cjs');
function native(t,query=async args=>({requestId:args.requestId,query:args.query,page:args.page,results:[{id:'r_actual',url:'https://example.com/actual',title:'Actual <b> &amp; DOM text',content:'Returned DOM excerpt'}],hasMore:false,provider:{id:'bing',name:'Bing',kind:'web-search',transport:'native-serp',pagination:'remote',limited:true}})){
 const calls=[],cancels=[];let resets=0,disposals=0;
 const source={query:args=>{calls.push(args);return query(args);},cancel:id=>{cancels.push(id);return false;},cancelAll:()=>{resets++;},dispose:()=>{disposals++;},state:()=>({configured:true,engine:'bing',engineName:'Bing',endpoint:'https://www.bing.com/search?q=',providers:['bing'],transport:{kind:'native-serp',session:'browser',private:false}})};
 const service=createSearchService({nativeSource:source,ai:false,getBraveApiKey:()=>{throw Error('Legacy key must not be read');},endpointRequest:()=>{throw Error('No search API request is allowed');},request:()=>{throw Error('Native DOM needs no secondary metadata request');}});t.after(()=>service.dispose());return{service,source,calls,cancels,get resets(){return resets;},get disposals(){return disposals;}};
}
test('installed service delegates the exact Russian query to the selected native engine without API, key or translation',async t=>{
 const f=native(t),value=await f.service.query({query:'новости про антропик',requestId:'native-request'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].query,'новости про антропик');assert.equal(f.calls[0].page,1);assert.equal(f.calls[0].filter,'all');assert.ok(f.calls[0].signal instanceof AbortSignal);
 assert.equal(value.provider.id,'bing');assert.equal(value.results[0].title,'Actual <b> &amp; DOM text');assert.equal(value.query,'новости про антропик');
 assert.deepEqual(f.service.state().providers,['bing']);assert.equal(f.service.state().transport.kind,'native-serp');assert.equal(f.service.nativeSource,f.source);
});
test('native page and filter arguments are forwarded without synthetic pagination',async t=>{
 const f=native(t);await f.service.performSearch('current topic',2,'videos',{requestId:'native-page2'});
 assert.equal(f.calls[0].page,2);assert.equal(f.calls[0].filter,'video');assert.equal(f.calls[0].query,'current topic');
 for(const args of [{query:''},{query:'x',page:0},{query:'x',filter:'unknown'},{query:'x',requestId:'bad / id'}])await assert.rejects(f.service.query(args));
 assert.equal(f.calls.length,1);
});
test('missing native engine never falls back to a different public API or a reference answer',async()=>{
 let reads=0;const service=createSearchService({ai:false,getBraveApiKey:()=>{reads++;return'unused';},endpointRequest:()=>{reads++;throw Error('Unexpected request');}});
 try{assert.equal(service.state().configured,false);assert.deepEqual(service.state().providers,[]);await assert.rejects(service.query({query:'normal web query'}),{code:'SEARCH_ENGINE_UNAVAILABLE'});assert.equal(reads,0);}finally{service.dispose();}
});
test('manual engine challenges remain explicit and preserve only the authoritative action handle',async t=>{
 for(const code of ['SEARCH_ENGINE_CHALLENGE','SEARCH_ENGINE_LAYOUT']){
  const denied=new SearchError(code,'Откройте страницу поисковика.');denied.manualAction={available:true,requestId:'challenge-id',engine:'google',url:'https://untrusted.example.com',cookie:'not exposed'};
  const f=native(t,async()=>{throw denied;});await assert.rejects(f.service.query({query:'topic',requestId:'challenge-id'}),error=>error===denied);
  const safe=publicSearchError(denied);assert.equal(safe.retryable,true);assert.deepEqual(safe.manualAction,{available:true,requestId:'challenge-id',engine:'google'});assert.equal(JSON.stringify(safe).includes('not exposed'),false);
 }
 const malformed=new SearchError('SEARCH_ENGINE_LAYOUT','Invalid handle');malformed.manualAction={available:true,requestId:'bad / id',engine:'google'};assert.equal(publicSearchError(malformed).manualAction,undefined);
});
test('cancellation closes the native attempt and prevents a late native result reaching the caller',async t=>{
 let resolve,started;const ready=new Promise(r=>{started=r;}),f=native(t,()=>{started();return new Promise(r=>{resolve=r;});});
 const pending=f.service.query({query:'topic',requestId:'stop-native'}),rejected=assert.rejects(pending,{code:'SEARCH_CANCELLED'});await ready;assert.equal(f.service.cancel('stop-native'),true);await rejected;resolve({results:[{url:'https://example.com/late'}]});
 assert.ok(f.cancels.includes('stop-native'));assert.equal(f.calls[0].signal.aborted,true);
});
test('service reset and disposal cancel a reusable native source; only its owning controller disposes it',async t=>{
 const f=native(t);await f.service.query({query:'topic'});const before=f.resets;f.service.resetCache();assert.ok(f.resets>before);
 f.service.dispose();assert.equal(f.disposals,0);await assert.rejects(f.service.query({query:'after close'}),{code:'SEARCH_CLOSED'});
 const restored=createSearchService({nativeSource:f.source,ai:false});try{assert.equal((await restored.query({query:'restored'})).provider.id,'bing');}finally{restored.dispose();}assert.equal(f.disposals,0);
});
test('native errors retain safe network diagnostics and never serialize raw provider responses',()=>{
 const error=networkFailure({code:'ENETUNREACH'});error.body='private response';const value=publicSearchError(error);
 assert.equal(value.code,'SEARCH_NETWORK');assert.equal(value.retryable,true);assert.equal(value.body,undefined);assert.equal(publicSearchError(new Error('raw path')),null);
});
test('fixture endpoint injection remains restricted to the explicit owned CI profile',()=>{
 for(const endpoint of ['https://example.com/search','https://151.248.113.177:3082/search','http://127.0.0.1:8080/search'])assert.throws(()=>createSearchService({endpoint}),{code:'SEARCH_TEST_CONFIG'});
});
