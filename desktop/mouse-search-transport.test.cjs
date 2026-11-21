'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createSearchTransport,pinnedCertificateDecision}=require('./mouse-search-transport.cjs');
const {DEFAULT_AI_ENDPOINT}=require('./mouse-search-service.cjs');
const API=DEFAULT_AI_ENDPOINT+'/v1/chat';
const send=(transport,url=API,options={})=>transport.request(url,{method:'POST',body:'{}',...options});
function setup(t,fetch,network=()=>({mode:'system'})){
 const calls=[],proxy=[];let verify;
 const ses={setCertificateVerifyProc:fn=>{verify=fn;},setProxy:async value=>proxy.push(value),closeAllConnections:async()=>{},fetch:async(url,options)=>{calls.push({url,options});return fetch(url,options);}};
 const session={fromPartition:(name,options)=>{assert.equal(name.startsWith('persist:'),false);assert.equal(options.cache,false);return ses;}};
 const transport=createSearchTransport({session,network});t.after(()=>transport.dispose());return{transport,ses,calls,proxy,verify:()=>verify};
}
test('own AI transport has a separate memory session and excludes ordinary browser cookies',async t=>{
 const f=setup(t,()=>new Response('{"ok":true}',{headers:{'Content-Type':'application/json','Content-Encoding':'gzip'}}));
 const result=await send(f.transport,API,{headers:{Cookie:'private-cookie','Proxy-Authorization':'private-proxy','Content-Length':'999'}});
 assert.equal(result.body.toString(),'{"ok":true}');assert.deepEqual(f.proxy,[{mode:'system'}]);
 const init=f.calls[0].options;assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');assert.equal(init.bypassCustomProtocolHandlers,true);
 for(const name of ['Cookie','Proxy-Authorization','Content-Length'])assert.equal(init.headers[name],undefined);
 assert.deepEqual(f.transport.state(),{kind:'chromium',scope:'own-ai',proxyMode:'system',credentials:'omit',persistent:false});
 assert.equal(f.transport.observeSearch,undefined,'AI bodies are not public search evidence');
});
test('the existing browser proxy is mirrored without serializing its address',async t=>{
 let network={mode:'fixed_servers',server:'http://proxy.example.com:8080'};const f=setup(t,()=>new Response('{}'),()=>network);
 await send(f.transport);await send(f.transport);assert.equal(f.proxy.length,1);assert.deepEqual(f.proxy[0],{mode:'fixed_servers',proxyRules:network.server,proxyBypassRules:'<local>'});
 network={mode:'direct'};await send(f.transport);assert.deepEqual(f.proxy[1],{mode:'direct'});assert.equal(JSON.stringify(f.transport.state()).includes('proxy.example'),false);
});
test('search APIs, arbitrary URLs, key headers, and unknown own-server routes are rejected before network',async t=>{
 const f=setup(t,()=>new Response('{}'));
 for(const url of ['http://127.0.0.1/','https://arbitrary.example.com/','https://api.duckduckgo.com/','https://api.mwmbl.org/api/v2/search/','https://api.search.brave.com/res/v1/web/search','https://api.mymemory.translated.net/get','https://u:p@151.248.113.177:3081/v1/chat',DEFAULT_AI_ENDPOINT+'/admin',API+'?query=public'])await assert.rejects(send(f.transport,url),{code:'SEARCH_ENDPOINT'});
 await assert.rejects(send(f.transport,API,{headers:{'X-Subscription-Token':'unused-key'}}),{code:'SEARCH_ENDPOINT'});
 await assert.rejects(send(f.transport,API,{method:'GET'}),{code:'SEARCH_ENDPOINT'});assert.equal(f.calls.length,0);
 await send(f.transport,API,{headers:{Authorization:'Bearer fixture-session'}});assert.equal(f.calls[0].options.headers.Authorization,'Bearer fixture-session');
});
test('only the exact own AI certificate gets scoped trust; ordinary engine pages retain normal Chromium TLS',()=>{
 const certificate=new crypto.X509Certificate(fs.readFileSync(path.join(__dirname,'mouse-search-ca.crt'))),now=Date.parse('2026-11-21T12:00:00Z'),hostname=new URL(DEFAULT_AI_ENDPOINT).hostname,request={hostname,certificate:{data:certificate.toString()}};
 assert.equal(pinnedCertificateDecision(request,certificate,now),0);assert.equal(pinnedCertificateDecision({...request,hostname:'www.google.com'},certificate,now),-3);
 assert.equal(pinnedCertificateDecision({...request,certificate:{data:'wrong certificate'}},certificate,now),-2);assert.equal(pinnedCertificateDecision(request,certificate,Date.parse('2030-01-01')),-2);
});
test('redirects and 403/429 close the body without carrying credentials elsewhere',async t=>{
 for(const [status,code]of [[302,'SEARCH_REDIRECT'],[403,'SEARCH_BLOCKED'],[429,'SEARCH_RATE_LIMIT']]){
  let cancelled=0;const f=setup(t,()=>({status,headers:new Headers({Location:'http://127.0.0.1/secret'}),body:{getReader:()=>({cancel:async()=>{cancelled++;}})}}));
  await assert.rejects(send(f.transport,API,{headers:{Authorization:'Bearer fixture-session'}}),{code,status});assert.equal(f.calls.length,1);assert.equal(cancelled,1);
 }
});
test('decoded response bytes, fetch timeout and streaming reads stay bounded',async t=>{
 const large=setup(t,()=>new Response('x'.repeat(100)));await assert.rejects(send(large.transport,API,{maxBytes:10}),{code:'SEARCH_TOO_LARGE'});
 const hanging=setup(t,()=>new Promise(()=>{}));await assert.rejects(send(hanging.transport,API,{timeoutMs:25}),{code:'SEARCH_TIMEOUT'});assert.equal(hanging.calls[0].options.signal.aborted,true);
 let cancelled=0;const stream=setup(t,()=>({status:200,headers:new Headers(),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancelled++;}})}}));
 await assert.rejects(send(stream.transport,API,{timeoutMs:25}),{code:'SEARCH_TIMEOUT'});assert.equal(cancelled,1);
});
test('cancel and dispose abort pending Chromium work and keep safe network diagnostics',async t=>{
 const failed=setup(t,()=>{throw Error('net::ERR_PROXY_CONNECTION_FAILED');});await assert.rejects(send(failed.transport),{code:'SEARCH_PROXY',causeCode:'ERR_PROXY_CONNECTION_FAILED'});
 const f=setup(t,()=>new Promise(()=>{})),controller=new AbortController(),request=send(f.transport,API,{signal:controller.signal}),rejected=assert.rejects(request,{code:'SEARCH_CANCELLED'});await new Promise(setImmediate);controller.abort();await rejected;
 const pending=send(f.transport),disposed=assert.rejects(pending,{code:'SEARCH_CANCELLED'});await new Promise(setImmediate);f.transport.dispose();await disposed;await assert.rejects(send(f.transport),{code:'SEARCH_CLOSED'});
});
