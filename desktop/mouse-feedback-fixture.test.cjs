'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createDownloadFixture}=require('./mouse-629-feedback-smoke.cjs');

test('native download fixture truncates real bytes, rejects automatic restart, and serves only an explicit retry',{timeout:5000},async()=>{
 const known=Buffer.alloc(131072,71),requests=[];let allowed=false;
 const server=http.createServer(createDownloadFixture({known,requests,canRetry:()=>allowed,canFinishKnown:()=>true}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/download/retry';
 const receive=()=>new Promise((resolve,reject)=>{
  http.get(url,response=>{
   const chunks=[];let done=false;
   const finish=error=>{if(done)return;done=true;resolve({status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks),complete:response.complete,error:error?.code||null});};
   response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>finish());response.on('error',finish);
  }).on('error',reject);
 });
 try{
  const broken=await receive();assert.equal(broken.status,200);assert.equal(Number(broken.headers['content-length']),known.length);assert.equal(broken.complete,false);assert.equal(broken.error,'ECONNRESET');assert.ok(broken.bytes.length>0&&broken.bytes.length<known.length);assert.ok(broken.bytes.equals(known.subarray(0,broken.bytes.length)));
  const automatic=await receive();assert.equal(automatic.status,404);assert.equal(automatic.complete,true);assert.equal(automatic.bytes.length,0);
  const again=await receive();assert.equal(again.status,404);assert.equal(again.bytes.length,0);
  allowed=true;const retry=await receive();assert.equal(retry.status,200);assert.equal(retry.complete,true);assert.equal(retry.error,null);assert.ok(retry.bytes.equals(known));
  assert.deepEqual(requests.map(({status,aborted,sentBytes})=>({status,aborted,sentBytes})),[{status:200,aborted:true,sentBytes:65536},{status:404,aborted:false,sentBytes:0},{status:404,aborted:false,sentBytes:0},{status:200,aborted:false,sentBytes:known.length}]);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
