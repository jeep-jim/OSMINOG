'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSearchService,SearchError,LIMITS,DEFAULT_ENDPOINT,MWMBL_ENDPOINT,BRAVE_ENDPOINT,networkFailure}=require('./mouse-search-service.cjs');
const response=(value,type='application/json')=>({status:200,headers:{'content-type':type},body:Buffer.from(JSON.stringify(value))});
const instant=(extra={})=>({AbstractText:'',AbstractURL:'',RelatedTopics:[],...extra});
const rows=count=>Array.from({length:count},(_,i)=>({url:'https://example.com/result/'+i,title:'Real row '+i,content:'Returned provider excerpt '+i}));
function setup(t,api,extra={}){
 const calls=[];const service=createSearchService({ai:false,endpointRequest:async(url,options)=>{calls.push({url,options});return api(url,options,calls);},request:async url=>({url,status:200,headers:{'content-type':'text/html'},body:Buffer.from('<meta property="og:image" content="/cover.png">')}),...extra});
 t.after(()=>service.dispose());return{service,calls};
}
test('public defaults use actual JSON web rows; Instant Answer topics stay out of the result grid',async t=>{
 const f=setup(t,url=>new URL(url).origin===new URL(DEFAULT_ENDPOINT).origin?response(instant({AbstractText:'An encyclopedia reference.',AbstractURL:'https://reference.example.com/topic',Heading:'Topic',RelatedTopics:[{Text:'Related, not SERP',FirstURL:'https://unrelated.example.com'}]}),'application/x-javascript'):response({query:'topic',number_of_results:1,results:rows(1)}));
 const result=await f.service.query({query:'topic'});
 assert.equal(result.results.length,1);assert.equal(result.results[0].url,'https://example.com/result/0');assert.equal(result.instantAnswer.url,'https://reference.example.com/topic');
 assert.equal(result.provider.id,'mwmbl');assert.equal(result.provider.pagination,'snapshot');assert.equal(result.provider.limited,true);assert.match(result.notice,/неполной/);
 assert.deepEqual(f.calls.map(x=>new URL(x.url).origin),[new URL(DEFAULT_ENDPOINT).origin,new URL(MWMBL_ENDPOINT).origin]);assert.equal(f.calls.some(x=>x.url.includes('151.248.113.177')),false);
 assert.equal(f.calls.some(x=>x.options.headers?.Cookie||x.options.headers?.Authorization),false);
});
test('Mwmbl pagination slices one actual complete snapshot, without inventing remote pages or duplicate URLs',async t=>{
 const f=setup(t,url=>new URL(url).origin===new URL(DEFAULT_ENDPOINT).origin?response(instant()):response({query:'topic',number_of_results:59,results:rows(59)}));
 const a=await f.service.query({query:'topic',page:1}),b=await f.service.query({query:'topic',page:2}),c=await f.service.query({query:'topic',page:3});
 assert.deepEqual([a.results.length,b.results.length,c.results.length],[24,24,11]);assert.deepEqual([a.hasMore,b.hasMore,c.hasMore],[true,true,false]);assert.equal(new Set([...a.results,...b.results,...c.results].map(x=>x.url)).size,59);
 assert.equal(f.calls.length,2);assert.equal(a.provider.total,59);assert.deepEqual(b.attempts,[]);assert.equal(new URL(f.calls[1].url).searchParams.has('page'),false);
});
test('primary connection failure reaches the fixed public JSON fallback, with a safe underlying diagnostic code',async t=>{
 const f=setup(t,url=>{if(new URL(url).origin===new URL(DEFAULT_ENDPOINT).origin)throw networkFailure({code:'ENETUNREACH'});return response({query:'topic',number_of_results:1,results:rows(1)});});
 const result=await f.service.query({query:'topic'});assert.equal(result.results.length,1);assert.equal(result.attempts[0].error.causeCode,'ENETUNREACH');assert.equal(result.attempts[1].id,'mwmbl');assert.equal(result.attempts[1].ok,true);
});
test('rate limits, access denial and CAPTCHA/HTML stop the chain instead of switching providers',async t=>{
 for(const code of ['SEARCH_RATE_LIMIT','SEARCH_BLOCKED','SEARCH_FORMAT']){
  const f=setup(t,()=>{if(code==='SEARCH_FORMAT')return{status:200,headers:{'content-type':'text/html'},body:Buffer.from('<form id="challenge-form">Captcha</form>')};throw new SearchError(code,'Expected denial',code==='SEARCH_RATE_LIMIT'?429:403);});
  await assert.rejects(f.service.query({query:'topic'}),{code});assert.equal(f.calls.length,1);
 }
});
test('malformed or mismatched public API payload is not accepted as an empty web result',async t=>{
 for(const value of [{query:'different',number_of_results:1,results:rows(1)},{query:'topic',number_of_results:2,results:rows(1)},{query:'topic',number_of_results:1,results:[{url:'https://example.com',title:{not:'text'},content:''}]}]){
  const f=setup(t,url=>new URL(url).origin===new URL(DEFAULT_ENDPOINT).origin?response(instant()):response(value));await assert.rejects(f.service.query({query:'topic'}),{code:'SEARCH_FORMAT'});
 }
});
test('Brave is used only with a native supplied key, with real offset and more-results contract',async t=>{
 const key='explicit-test-only-key-never-shipped';
 const f=setup(t,url=>{const u=new URL(url);if(u.origin===new URL(DEFAULT_ENDPOINT).origin)return response(instant());assert.equal(u.origin,new URL(BRAVE_ENDPOINT).origin);const page=Number(u.searchParams.get('offset'));return response({query:{more_results_available:page===0},web:{results:[{url:'https://example.com/brave/'+page,title:'Page '+page,description:'Actual API description',thumbnail:{src:'https://example.com/image.png'}}]}});},{getBraveApiKey:async()=>key});
 const a=await f.service.query({query:'topic',page:1}),b=await f.service.query({query:'topic',page:2});assert.equal(a.provider.id,'brave');assert.equal(a.provider.pagination,'remote');assert.equal(a.hasMore,true);assert.equal(b.hasMore,false);
 const calls=f.calls.filter(x=>new URL(x.url).origin===new URL(BRAVE_ENDPOINT).origin);assert.equal(calls.length,2);assert.deepEqual(calls.map(x=>new URL(x.url).searchParams.get('offset')),['0','1']);assert.ok(calls.every(x=>x.options.headers['X-Subscription-Token']===key));
 assert.equal(new URL(f.calls[0].url).origin,new URL(BRAVE_ENDPOINT).origin);assert.equal(f.calls.some(x=>new URL(x.url).origin===new URL(DEFAULT_ENDPOINT).origin),false);assert.equal(JSON.stringify([a,b,f.service.state()]).includes(key),false);
});
test('Brave authentication denial does not leak the key or silently switch a paginated provider',async t=>{
 const f=setup(t,url=>{if(new URL(url).origin===new URL(DEFAULT_ENDPOINT).origin)return response(instant());throw new SearchError('SEARCH_HTTP','Сервер поиска временно недоступен.',401);},{getBraveApiKey:async()=>'explicit-test-key'});
 await assert.rejects(f.service.query({query:'topic'}),{code:'SEARCH_CREDENTIALS',status:401});assert.equal(f.calls.length,1);assert.equal(JSON.stringify(f.service.state()).includes('explicit-test-key'),false);
});
test('one shared metadata budget retains fast OG and real rows while aborting all slow queued enrichment',async t=>{
 let metadataCalls=0,aborted=0;
 const f=setup(t,url=>new URL(url).origin===new URL(DEFAULT_ENDPOINT).origin?response(instant()):response({query:'topic',number_of_results:24,results:rows(24)}),{request:(url,options)=>{
  metadataCalls++;if(url.endsWith('/0'))return Promise.resolve({url,status:200,headers:{'content-type':'text/html'},body:Buffer.from('<meta property="og:type" content="product"><meta property="product:price:amount" content="12"><meta property="product:price:currency" content="EUR">')});
  options.signal.addEventListener('abort',()=>aborted++,{once:true});return new Promise(()=>{});
 }});
 const started=performance.now(),value=await f.service.query({query:'topic'}),elapsed=performance.now()-started;
 assert.equal(value.results.length,24);assert.equal(value.results[0].type,'product');assert.equal(value.results[0].price,'12 EUR');assert.equal(value.metadata.limited,true);assert.ok(metadataCalls<=LIMITS.metadataConcurrency+1);assert.equal(aborted,metadataCalls-1);assert.ok(elapsed<LIMITS.metadataBudgetMs+750,`one budget, got ${elapsed}`);
});
test('cancellation aborts the chain before a fallback request or a stale result is accepted',async t=>{
 const f=setup(t,(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true})));
 const promise=f.service.query({query:'topic',requestId:'cancelled'}),rejected=assert.rejects(promise,{code:'SEARCH_CANCELLED'});await new Promise(setImmediate);f.service.cancel('cancelled');await rejected;assert.equal(f.calls.length,1);
});
test('a production custom search endpoint cannot reactivate the old private SearX path',()=>{
 assert.throws(()=>createSearchService({endpoint:'https://151.248.113.177:3082/search'}),{code:'SEARCH_TEST_CONFIG'});
 assert.throws(()=>createSearchService({endpoint:'https://other.example.com/search'}),{code:'SEARCH_TEST_CONFIG'});
});
test('installed public helper binds URLs to raw JSON bytes and identifies unrelated topic coverage without inventing relevance',()=>{
 const {createHash}=require('node:crypto'),{validatePublicPage}=require('./mouse-635-public-search-smoke.cjs');
 const value={query:'requested topic',number_of_results:2,results:[{url:'https://example.com/a',title:'Unrelated animals',content:''},{url:'https://example.com/b',title:'Requested topic source',content:''}]},body=Buffer.from(JSON.stringify(value));
 const receipt={ok:true,endpoint:MWMBL_ENDPOINT,query:value.query,method:'GET',transport:'chromium',status:200,contentType:'application/json',bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),body};
 const base={query:value.query,page:1,revision:2,provider:{id:'mwmbl',kind:'web-search',limited:true,pagination:'snapshot'},results:[{id:'a',url:'https://example.com/a',title:'Unrelated animals'}]};
 const proof=validatePublicPage(base,{query:value.query,page:1,receipts:[receipt],topic:['requested topic']});assert.deepEqual(proof.topicMatches,[],'Nonempty unrelated API rows do not cover the owner topic');
 const relevant={...base,results:[{id:'b',url:'https://example.com/b',title:'Requested topic source'}]};assert.deepEqual(validatePublicPage(relevant,{query:value.query,page:1,receipts:[receipt],topic:['requested topic']}).topicMatches,['b']);
 assert.throws(()=>validatePublicPage({...base,results:[{id:'forged',url:'https://invented.example.com',title:'Requested topic'}]},{query:value.query,page:1,receipts:[receipt],topic:['requested topic']}),/invented/);
 assert.throws(()=>validatePublicPage(base,{query:value.query,page:1,receipts:[{...receipt,sha256:'0'.repeat(64)}],topic:[]}),/equal/);
 assert.throws(()=>validatePublicPage(base,{query:value.query,page:1,receipts:[{...receipt,contentType:'text/html'}],topic:[]}),/match/);
 assert.throws(()=>validatePublicPage({...base,provider:{id:'configured-searxng'}},{query:value.query,page:1,receipts:[receipt],topic:[]}),/real public/);
 assert.throws(()=>validatePublicPage({...base,page:2},{query:value.query,page:2,previous:base.results,receipts:[receipt],topic:[]}),/distinct/);
});
test('actual public IPC source executes through the exposed preload without the browser private N closure',async()=>{
 const vm=require('node:vm'),{publicSearchSource}=require('./mouse-635-public-search-smoke.cjs'),calls=[];
 const result={query:'новости про антропик',page:1,results:[]},context=vm.createContext({MouseNative:{search:async(action,args)=>{calls.push([action,JSON.parse(JSON.stringify(args))]);return result;}}});
 assert.equal(vm.runInContext('typeof N',context),'undefined');
 const args={query:'новости про антропик',page:1,filter:'all',requestId:'public635-owner-russian-1'};
 assert.equal(await vm.runInContext(publicSearchSource('query',args),context),result);assert.deepEqual(calls,[['query',args]]);
 const literal={query:'"; globalThis.injected=true; //\nPython',page:2,revision:7,requestId:'public635-control-2'};
 assert.equal(await vm.runInContext(publicSearchSource('query',literal),context),result);assert.deepEqual(calls[1],['query',literal]);assert.equal(context.injected,undefined);
});
test('actual public IPC source preserves the service error envelope and preload rejection',async()=>{
 const vm=require('node:vm'),{publicSearchSource}=require('./mouse-635-public-search-smoke.cjs');
 const envelope={ok:false,error:{code:'SEARCH_NETWORK',message:'Не удалось подключиться к серверу.',retryable:true}};
 const context=vm.createContext({MouseNative:{search:async()=>envelope}});
 assert.equal(await vm.runInContext(publicSearchSource('query',{query:'Python'}),context),envelope);
 const failure=Error('preload unavailable');context.MouseNative.search=async()=>{throw failure;};
 await assert.rejects(vm.runInContext(publicSearchSource('query',{query:'Python'}),context),error=>error===failure);
});
