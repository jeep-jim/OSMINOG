'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createSearchTransport,pinnedCertificateDecision}=require('./mouse-search-transport.cjs');
const {DEFAULT_ENDPOINT,DEFAULT_AI_ENDPOINT,BRAVE_ENDPOINT}=require('./mouse-search-service.cjs');
function setup(t,fetch,network=()=>({mode:'system'}),extra={}){
 const calls=[],proxy=[];let verify;
 const ses={setCertificateVerifyProc:fn=>{verify=fn;},setProxy:async value=>proxy.push(value),closeAllConnections:async()=>{},fetch:async(url,options)=>{calls.push({url,options});return fetch(url,options);}};
 const session={fromPartition:(name,options)=>{assert.equal(name.startsWith('persist:'),false);assert.equal(options.cache,false);return ses;}};
 const transport=createSearchTransport({session,network,...extra});t.after(()=>transport.dispose());return{transport,ses,calls,proxy,verify:()=>verify};
}
test('Chromium transport uses a separate memory session, system proxy, and no ambient cookies or URL credentials',async t=>{
 const f=setup(t,()=>new Response('{"ok":true}',{headers:{'Content-Type':'application/json','Content-Encoding':'gzip'}}));
 const result=await f.transport.request(DEFAULT_ENDPOINT,{headers:{Cookie:'private-browser-cookie','Proxy-Authorization':'secret','Content-Length':'999'}});
 assert.equal(result.body.toString(),'{"ok":true}');assert.equal(result.transport,'chromium');assert.deepEqual(f.proxy,[{mode:'system'}]);
 const init=f.calls[0].options;assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');assert.equal(init.bypassCustomProtocolHandlers,true);assert.equal(init.headers.Cookie,undefined);assert.equal(init.headers['Proxy-Authorization'],undefined);assert.equal(init.headers['Content-Length'],undefined);
 assert.deepEqual(f.transport.state(),{kind:'chromium',proxyMode:'system',credentials:'omit',persistent:false});
});
test('explicit browser proxy settings are mirrored without disclosing the proxy host in service state',async t=>{
 let network={mode:'fixed_servers',server:'http://proxy.example.com:8080'};const f=setup(t,()=>new Response('{}'),()=>network);
 await f.transport.request(DEFAULT_ENDPOINT);await f.transport.request(DEFAULT_ENDPOINT);assert.equal(f.proxy.length,1);assert.deepEqual(f.proxy[0],{mode:'fixed_servers',proxyRules:network.server,proxyBypassRules:'<local>'});
 network={mode:'direct'};await f.transport.request(DEFAULT_ENDPOINT);assert.deepEqual(f.proxy[1],{mode:'direct'});assert.equal(JSON.stringify(f.transport.state()).includes('proxy.example'),false);
});
test('trusted provider transport never becomes an arbitrary URL, local-address or cross-provider credential proxy',async t=>{
 const f=setup(t,()=>new Response('{}'));
 for(const url of ['http://127.0.0.1/','https://arbitrary.example.com/','https://u:p@api.duckduckgo.com/'])await assert.rejects(f.transport.request(url),{code:'SEARCH_ENDPOINT'});
 await assert.rejects(f.transport.request(DEFAULT_ENDPOINT,{headers:{'X-Subscription-Token':'secret'}}),{code:'SEARCH_ENDPOINT'});
 assert.equal(f.calls.length,0);await f.transport.request(BRAVE_ENDPOINT,{headers:{'X-Subscription-Token':'explicit-test-key'}});assert.equal(f.calls[0].options.headers['X-Subscription-Token'],'explicit-test-key');
});
test('only the exact own AI certificate gets narrowly scoped trust; public APIs use normal Chromium TLS',()=>{
 const certificate=new crypto.X509Certificate(fs.readFileSync(path.join(__dirname,'mouse-search-ca.crt'))),now=Date.parse('2026-11-21T12:00:00Z'),hostname=new URL(DEFAULT_AI_ENDPOINT).hostname,request={hostname,certificate:{data:certificate.toString()}};
 assert.equal(pinnedCertificateDecision(request,certificate,now),0);assert.equal(pinnedCertificateDecision({...request,hostname:new URL(DEFAULT_ENDPOINT).hostname},certificate,now),-3);
 assert.equal(pinnedCertificateDecision({...request,certificate:{data:'wrong certificate'}},certificate,now),-2);assert.equal(pinnedCertificateDecision(request,certificate,Date.parse('2030-01-01')),-2);
});
test('redirects and 403/429 terminate one request and close the response body; no redirect gets credentials',async t=>{
 for(const [status,code] of [[302,'SEARCH_REDIRECT'],[403,'SEARCH_BLOCKED'],[429,'SEARCH_RATE_LIMIT']]){
  let cancelled=0;const f=setup(t,()=>({status,headers:new Headers({Location:'http://127.0.0.1/secret'}),body:{getReader:()=>({cancel:async()=>{cancelled++;}})}}));
  await assert.rejects(f.transport.request(BRAVE_ENDPOINT,{headers:{'X-Subscription-Token':'explicit-test-key'}}),{code,status});assert.equal(f.calls.length,1);assert.equal(cancelled,1);
 }
});
test('decoded response size, fetch timeout and pending stream reads remain bounded',async t=>{
 const large=setup(t,()=>new Response('x'.repeat(100)));await assert.rejects(large.transport.request(DEFAULT_ENDPOINT,{maxBytes:10}),{code:'SEARCH_TOO_LARGE'});
 const hanging=setup(t,()=>new Promise(()=>{}));await assert.rejects(hanging.transport.request(DEFAULT_ENDPOINT,{timeoutMs:25}),{code:'SEARCH_TIMEOUT'});assert.equal(hanging.calls[0].options.signal.aborted,true);
 let cancelled=0;const stream=setup(t,()=>({status:200,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancelled++;}})}}));
 await assert.rejects(stream.transport.request(DEFAULT_ENDPOINT,{timeoutMs:25}),{code:'SEARCH_TIMEOUT'});assert.equal(cancelled,1);
});
test('cancel and dispose abort pending Chromium work and preserve safe underlying network codes',async t=>{
 const failed=setup(t,()=>{throw Error('net::ERR_PROXY_CONNECTION_FAILED');});await assert.rejects(failed.transport.request(DEFAULT_ENDPOINT),{code:'SEARCH_PROXY',causeCode:'ERR_PROXY_CONNECTION_FAILED'});
 const f=setup(t,()=>new Promise(()=>{})),controller=new AbortController(),request=f.transport.request(DEFAULT_ENDPOINT,{signal:controller.signal}),rejected=assert.rejects(request,{code:'SEARCH_CANCELLED'});await new Promise(setImmediate);controller.abort();await rejected;
 const pending=f.transport.request(DEFAULT_ENDPOINT),disposed=assert.rejects(pending,{code:'SEARCH_CANCELLED'});await new Promise(setImmediate);f.transport.dispose();await disposed;await assert.rejects(f.transport.request(DEFAULT_ENDPOINT),{code:'SEARCH_CLOSED'});
});
test('passive API evidence binds exact decoded bytes and omits own AI sessions and echoed keys',async t=>{
 const f=setup(t,()=>new Response('{"actual":"body"}',{headers:{'Content-Type':'application/json'}})),receipts=[],unsubscribe=f.transport.observeSearch(value=>receipts.push(value));
 const response=await f.transport.request(DEFAULT_ENDPOINT+'?q=public');assert.equal(receipts.length,1);assert.equal(receipts[0].query,'public');assert.equal(receipts[0].sha256,crypto.createHash('sha256').update(response.body).digest('hex'));assert.equal(receipts[0].bytes,response.body.length);assert.deepEqual(receipts[0].body,response.body);
 await f.transport.request(DEFAULT_AI_ENDPOINT+'/v1/session');assert.equal(receipts.length,1,'AI/session response is never included in public API artifacts');unsubscribe();
 const key='explicit-test-key',echo=setup(t,()=>new Response(JSON.stringify({secret:key}))),seen=[];echo.transport.observeSearch(value=>seen.push(value));
 await assert.rejects(echo.transport.request(BRAVE_ENDPOINT,{headers:{'X-Subscription-Token':key}}),{code:'SEARCH_FORMAT'});assert.equal(seen[0].body,undefined);assert.equal(JSON.stringify(seen).includes(key),false);
});
test('controlled primary failure requires the exact CI profile, observes the attempted Chromium request, and restores interception',async t=>{
 const before={CI:process.env.CI,profile:process.env.MOUSE_TEST_PROFILE};let intercept=null;
 const f=setup(t,async(url,options)=>{if(intercept){let cancelled=false;intercept({url,method:options.method},value=>{cancelled=value.cancel;});if(cancelled)throw Error('net::ERR_BLOCKED_BY_CLIENT');}return new Response('{}');},undefined,{testContext:{enabled:true,app:{getPath:()=>'/tmp/mouse635-proof'}}});
 f.ses.webRequest={onBeforeRequest:(filter,listener)=>{intercept=filter===null?null:listener;}};
 try{
  delete process.env.CI;await assert.rejects(f.transport.withPrimaryUnavailableForTest(DEFAULT_ENDPOINT,async()=>{}),{code:'SEARCH_TEST_CONFIG'});
  process.env.CI='true';process.env.MOUSE_TEST_PROFILE='/tmp/mouse635-proof';const receipts=[];f.transport.observeSearch(value=>receipts.push(value));
  const result=await f.transport.withPrimaryUnavailableForTest(DEFAULT_ENDPOINT,async()=>{await assert.rejects(f.transport.request(DEFAULT_ENDPOINT+'?q=public'),{code:'SEARCH_NETWORK',causeCode:'ERR_BLOCKED_BY_CLIENT'});return'checked';});
  assert.equal(result.value,'checked');assert.equal(result.blocked.length,1);assert.equal(result.blocked[0].query,'public');assert.equal(intercept,null);assert.equal(receipts[0].ok,false);await f.transport.request(DEFAULT_ENDPOINT);assert.equal(receipts.at(-1).ok,true);
  await assert.rejects(f.transport.withPrimaryUnavailableForTest(DEFAULT_ENDPOINT,async()=>{throw Error('Original failure');}),/Original failure/);assert.equal(intercept,null);
 }finally{if(before.CI===undefined)delete process.env.CI;else process.env.CI=before.CI;if(before.profile===undefined)delete process.env.MOUSE_TEST_PROFILE;else process.env.MOUSE_TEST_PROFILE=before.profile;}
});
