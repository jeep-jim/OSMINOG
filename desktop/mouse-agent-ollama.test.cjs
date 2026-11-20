'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {models,TAGS,ENDPOINT}=require('./mouse-agent/ollama.cjs');
test('Ollama discovery uses one fixed loopback GET without credentials or redirects and exposes local names only',async()=>{
 const calls=[],result=await models({fetcher:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({models:[{name:'local:4b',size:42},{name:'local:4b',size:42},{name:'large:cloud'},{name:'large:120b-cloud'},{name:'remote',remote_host:'https://example.test'},{name:'bad\nname'},{name:'other-local',size:-1}]}));}});
 assert.equal(calls.length,1);assert.equal(calls[0].url,TAGS);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.headers,undefined);assert.equal(calls[0].options.body,undefined);
 assert.deepEqual(result,{available:true,endpoint:ENDPOINT,models:[{name:'local:4b',size:42},{name:'other-local',size:0}]});
});
test('Ollama probe distinguishes a running empty installation from failed or invalid responses',async()=>{
 assert.deepEqual(await models({fetcher:async()=>new Response('{"models":[]}')}),{available:true,endpoint:ENDPOINT,models:[]});
 for(const fetcher of [async()=>{throw Error('private-network-detail');},async()=>new Response('secret-error',{status:500}),async()=>new Response('{"notModels":[]}'),async()=>new Response('not-json'),async()=>new Response('x',{headers:{'content-length':String(2*1024*1024)}})]){
  const result=await models({fetcher});assert.equal(result.available,false);assert.deepEqual(result.models,[]);assert.match(result.reason,/Ollama/);assert.doesNotMatch(JSON.stringify(result),/private-network-detail|secret-error|not-json/);
 }
});
test('Ollama probe bounds a chunked body even if the size header is missing',async()=>{
 let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(1024*1024+1));},cancel(){cancelled=true;}});
 const result=await models({fetcher:async()=>new Response(stream)});assert.equal(result.available,false);assert.equal(cancelled,true);
});
