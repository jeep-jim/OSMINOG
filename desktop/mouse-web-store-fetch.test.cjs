'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{Readable,PassThrough,Writable}=require('node:stream');
const {createStoreFetch}=require('./mouse-web-store-fetch.cjs'),CRX=require('./mouse-extension-crx.cjs');
const URL='https://clients2.google.com/service/update2/crx',CDN='https://clients2.googleusercontent.com/owned-unit.crx';
const options=signal=>({redirect:'manual',credentials:'omit',cache:'no-store',...(signal?{signal}:{})});
const turn=()=>new Promise(resolve=>setImmediate(resolve));

// Match Electron44 ClientRequest: manual redirect emits synchronously, then
// fails if neither followRedirect nor abort happened inside that handler.
// Bytes and responses below are unit-only, never native release evidence.
function transport(route){
 const requests=[],contacts=[];
 function request(init){
  const req=new EventEmitter();Object.assign(req,{options:init,aborted:false,abortCount:0,followed:0});requests.push(req);
  req.followRedirect=()=>{req.followed++;};
  req.abort=()=>{if(req.aborted)return;req.aborted=true;req.abortCount++;req.emit('abort');req.emit('error',Error('Owned synchronous abort error'));req.emit('close');if(req.response&&!req.response.destroyed)req.response.destroy();};
  req.redirect=(status,target,headers={})=>{req.emit('redirect',status,'GET',target,headers);if(!req.aborted&&!req.followed)req.emit('error',Error('Redirect was cancelled'));};
  req.respond=(body,{status=200,headers={}}={})=>{const response=body||new PassThrough();Object.assign(response,{statusCode:status,headers});req.response=response;response.once('close',()=>req.emit('close'));req.emit('response',response);return response;};
  req.end=()=>queueMicrotask(()=>{if(!req.aborted){contacts.push(init.url);route(req,requests.length);}});
  return req;
 }
 return{request,requests,contacts};
}

test('manual Electron redirect becomes status/Location before synchronous abort errors; no implicit next request',async()=>{
 const session={name:'owned Chromium session'},net=transport(req=>req.redirect(302,CDN,{location:['https://wrong.example/'],server:['Google']}));
 const response=await createStoreFetch({session,request:net.request})(URL,options());
 assert.equal(response.status,302);assert.equal(response.ok,false);assert.equal(response.headers.get('location'),CDN);assert.equal(response.body,null);
 assert.deepEqual(net.contacts,[URL]);assert.equal(net.requests[0].aborted,true);assert.equal(net.requests[0].followed,0);
 assert.deepEqual(net.requests[0].options,{session,url:URL,method:'GET',redirect:'manual',credentials:'omit',useSessionCookies:false,cache:'no-store'});
});

test('final response keeps real streamed bytes and headers without depending on session.fetch',async()=>{
 const bytes=Buffer.from('owned transport unit bytes'),net=transport(req=>req.respond(Readable.from([bytes.subarray(0,4),bytes.subarray(4)]),{headers:{'content-length':[String(bytes.length)],'content-type':['application/x-chrome-extension']}}));
 const response=await createStoreFetch({session:{fetch:()=>assert.fail('Electron fetch must not handle manual redirects')},request:net.request})(CDN,options());
 assert.equal(response.ok,true);assert.equal(response.status,200);assert.equal(response.headers.get('content-length'),String(bytes.length));
 assert.deepEqual(Buffer.from(await new Response(response.body).arrayBuffer()),bytes);await turn();assert.equal(net.requests[0].abortCount,0);
});

test('Electron Writable finish/close before the HTTP response does not abort a valid GET',async()=>{
 const events=[];let req;
 class NativeRequest extends Writable{
  constructor(){super({autoDestroy:true});this.on('finish',()=>events.push('finish'));this.on('close',()=>events.push('close'));}
  _write(_chunk,_encoding,done){done();}
  _final(done){setImmediate(()=>{events.push('response');const response=Readable.from([Buffer.from('owned delayed response')]);Object.assign(response,{statusCode:200,headers:{}});this.emit('response',response);});done();}
  abort(){events.push('abort');this.emit('abort');}
 }
 const fetch=createStoreFetch({session:{},request:()=>{req=new NativeRequest();return req;}}),response=await fetch(URL,options());
 assert.equal(await new Response(response.body).text(),'owned delayed response');assert.equal(req.writableFinished,true);
 assert.ok(events.indexOf('finish')<events.indexOf('close')&&events.indexOf('close')<events.indexOf('response'));assert.equal(events.includes('abort'),false);
});

test('downloadCrx validates every next hop before contact and keeps the fixed redirect bound',async()=>{
 for(const target of ['https://evil.example/owned.crx','http://clients2.google.com/owned.crx','https://user:pass@clients2.google.com/owned.crx']){
  const net=transport(req=>req.redirect(302,target)),fetch=createStoreFetch({session:{},request:net.request});
  await assert.rejects(CRX.downloadCrx({fetch,id:'a'.repeat(32),chromeVersion:'152.0.0.0'}),{code:'CRX_ORIGIN'});
  assert.equal(net.contacts.length,1);assert.equal(net.requests[0].aborted,true);assert.equal(net.requests[0].followed,0);
 }
 const net=transport((req,n)=>req.redirect(302,CDN+'?hop='+n)),fetch=createStoreFetch({session:{},request:net.request});
 await assert.rejects(CRX.downloadCrx({fetch,id:'a'.repeat(32),chromeVersion:'152.0.0.0'}),{code:'CRX_ORIGIN'});
 assert.equal(net.contacts.length,6);assert.ok(net.requests.every(req=>req.aborted&&!req.followed));
});

test('only an allowed credential-free manual GET can reach the Chromium session',async()=>{
 const net=transport(()=>assert.fail('Invalid request reached network')),fetch=createStoreFetch({session:{},request:net.request});
 for(const [url,init]of [['https://example.test/',options()],[URL,{...options(),redirect:'follow'}],[URL,{...options(),credentials:'include'}],[URL,{...options(),method:'POST'}]])await assert.rejects(fetch(url,init));
 assert.equal(net.requests.length,0);
});

test('AbortSignal stops both pending requests and a body already returned to the CRX reader',async()=>{
 const early=new AbortController();early.abort(Error('Owned early abort'));const untouched=transport(()=>{});
 await assert.rejects(createStoreFetch({session:{},request:untouched.request})(URL,options(early.signal)),/Owned early abort/);assert.equal(untouched.requests.length,0);
 for(const afterHeaders of [false,true]){
  const control=new AbortController(),net=transport(req=>{if(afterHeaders)req.respond();}),fetch=createStoreFetch({session:{},request:net.request});
  const result=fetch(URL,options(control.signal));let body;
  if(afterHeaders)body=(await result).body.getReader();else await turn();
  const pending=afterHeaders?body.read():result;control.abort(Error('Owned download abort'));
  await assert.rejects(pending,/Owned download abort/);await turn();assert.equal(net.requests[0].aborted,true);
 }
});

test('body cancellation and stream failures abort the underlying native request',async()=>{
 for(const failure of [false,true]){
  const net=transport(req=>req.respond()),fetch=createStoreFetch({session:{},request:net.request}),response=await fetch(URL,options());
  if(failure){const pending=response.body.getReader().read();net.requests[0].response.destroy(Error('Owned native stream failure'));await assert.rejects(pending,/Owned native stream failure/);}
  else await response.body.cancel();
  await turn();assert.equal(net.requests[0].aborted,true);
 }
});

test('downloadCrx size rejection cancels the native transfer before consent or extraction',async()=>{
 const net=transport(req=>req.respond(null,{headers:{'content-length':[String(CRX.LIMITS.download+1)]}})),fetch=createStoreFetch({session:{},request:net.request});
 await assert.rejects(CRX.downloadCrx({fetch,id:'a'.repeat(32),chromeVersion:'152.0.0.0'}),{code:'CRX_SIZE'});await turn();
 assert.equal(net.contacts.length,1);assert.equal(net.requests[0].aborted,true);
});
