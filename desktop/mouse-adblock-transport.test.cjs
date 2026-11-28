'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SOURCES,MAX_BYTES,MAX_CUSTOM_BYTES,normalizeURL,customSource,publicAddress,publicLookup,downloadList,sha256}=require('./mouse-adblock-subscriptions.cjs');
const text='[Adblock Plus 2.0]\n! Synthetic list\n'+Array.from({length:60},(_,i)=>'||ad'+i+'.example.org^').join('\n')+'\n';
const record=(extra={})=>({schema:1,source:SOURCES[0].id,url:SOURCES[0].url,updatedAt:'2026-01-01T00:00:00.000Z',checkedAt:'2026-01-01T00:00:00.000Z',text,sha256:sha256(text),...extra});

test('custom subscription URLs have bounded canonical public HTTPS origins without credentials',()=>{
 assert.equal(normalizeURL('https://FILTERS.Example.org.:443/list.txt?version=1'),'https://filters.example.org/list.txt?version=1');
 const source=customSource({url:'https://filters.example.org/list.txt?key=private-value',name:' My rules '});
 assert.match(source.id,/^custom-[a-f\d]{24}$/);assert.equal(source.name,'My rules');assert.equal(source.builtin,false);assert.equal(source.id.includes('private-value'),false);
 for(const bad of ['http://filters.example.org/list.txt','file:///tmp/rules','https://user:password@filters.example.org/rules','https://filters.example.org:8443/rules','https://filters.example.org/rules#secret','https://localhost/rules','https://filter.local/rules','https://127.0.0.1/rules','https://2130706433/rules','https://0x7f000001/rules','https://[::1]/rules','https://[2606:4700::1111]/rules','https://filters.example.org\\@127.0.0.1/rules','https://filter%73.example.org/rules','https://filters.example.org/\r\nCookie:secret','https://filters.example.org/'+ 'a'.repeat(2048)])assert.throws(()=>normalizeURL(bad),undefined,bad);
 assert.throws(()=>customSource({url:'https://filters.example.org/rules',name:'x\ny'}));
 assert.throws(()=>customSource({url:'https://filters.example.org/rules',script:'alert(1)'}));
});
test('public DNS validation blocks private, loopback, metadata, documentation and transition ranges',()=>{
 for(const address of ['8.8.8.8','1.1.1.1','93.184.216.34','2606:4700:4700::1111','2001:4860:4860::8888'])assert.equal(publicAddress(address),true,address);
 for(const address of ['0.0.0.0','10.1.2.3','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1','172.31.255.255','192.168.1.1','192.0.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2001::1','2002:7f00:1::1','3fff::1','ff02::1','invalid'])assert.equal(publicAddress(address),false,address);
});
test('socket lookup pins checked answers and rejects a mixed answer or later DNS rebinding',async()=>{
 const run=(answers,options={all:true})=>new Promise((resolve,reject)=>publicLookup('filters.example.org',options,(error,address,family)=>error?reject(error):resolve({address,family}),(_host,config,done)=>{assert.deepEqual(config,{all:true,verbatim:true});done(null,answers);}));
 const answers=[{address:'93.184.216.34',family:4},{address:'2606:4700:4700::1111',family:6}];
 assert.deepEqual((await run(answers)).address,answers);
 assert.deepEqual(await run(answers,{family:4}),{address:'93.184.216.34',family:4});
 await assert.rejects(run([{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]),/public addresses/);
 await assert.rejects(run([{address:'169.254.169.254',family:4}]),/public addresses/);
 await assert.rejects(run([]),/public addresses/);
});
test('HTTP validators are sent only with a verified cache and 304 never replaces its body',async()=>{
 const previous=record({etag:'"version-1"',lastModified:'Thu, 01 Jan 2026 00:00:00 GMT'});let observed;
 const result=await downloadList(SOURCES[0],{record:previous,withMetadata:true,fetchImpl:async(url,options)=>{observed={url,options};return new Response(null,{status:304,headers:{ETag:'"version-1"'}});}});
 assert.deepEqual(result,{status:304,etag:'"version-1"',lastModified:previous.lastModified});
 assert.equal(observed.options.headers['If-None-Match'],previous.etag);assert.equal(observed.options.headers['If-Modified-Since'],previous.lastModified);
 assert.equal(observed.options.credentials,'omit');assert.equal(observed.options.redirect,'error');assert.equal(observed.options.headers.Cookie,undefined);assert.equal(observed.options.headers.Authorization,undefined);
 const modifiedOnly=await downloadList(SOURCES[0],{record:record({lastModified:previous.lastModified}),fetchImpl:async(_url,options)=>{assert.equal(options.headers['If-None-Match'],undefined);return new Response(null,{status:304});}});
 assert.equal(modifiedOnly,text);
});
test('304 without a conditional verified body is rejected, including a corrupted cache and poisoned validators',async()=>{
 for(const previous of [undefined,record(),record({etag:'"x"',sha256:'0'.repeat(64)}),record({etag:'"x"\r\nCookie: secret'})]){
  await assert.rejects(downloadList(SOURCES[0],{record:previous,withMetadata:true,fetchImpl:async(_url,options)=>{assert.equal(options.headers['If-None-Match'],undefined);assert.equal(options.headers['If-Modified-Since'],undefined);return new Response(null,{status:304});}}),/verified conditional cache/);
 }
});
test('200 preserves server validators but rejects redirects, compressed bodies and non-text data',async()=>{
 const result=await downloadList(SOURCES[0],{withMetadata:true,fetchImpl:async()=>new Response(text,{headers:{'content-type':'text/plain; charset=utf-8',ETag:'W/"next"','Last-Modified':'Thu, 01 Jan 2026 00:00:00 GMT'}})});
 assert.equal(result.text,text);assert.equal(result.status,200);assert.equal(result.etag,'W/"next"');
 for(const response of [new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}}),new Response(text,{headers:{'content-type':'text/html'}}),new Response(text,{headers:{'content-encoding':'gzip'}}),new Response(Uint8Array.from([255,254,253]),{headers:{'content-type':'text/plain'}}),new Response(text,{headers:{'content-length':String(MAX_BYTES+1)}}),new Response(text,{headers:{'Last-Modified':'not a date'}})])await assert.rejects(downloadList(SOURCES[0],{fetchImpl:async()=>response}));
});
test('custom lists retain the same transport limits and cannot smuggle an unsupported source identity',async()=>{
 const source=customSource({url:'https://filters.example.org/custom.txt'}),short='[Adblock Plus 2.0]\n||advertising.example.org^\n';
 assert.equal(await downloadList(source,{fetchImpl:async()=>new Response(short)}),short);
 await assert.rejects(downloadList({...source,id:'../../cache'},{fetchImpl:async()=>new Response(short)}),/Unknown filter subscription/);
 await assert.rejects(downloadList(source,{fetchImpl:async()=>new Response(short,{headers:{'content-length':String(MAX_CUSTOM_BYTES+1)}})}),/too large/);
 let cancelled=false;
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_CUSTOM_BYTES+1));},cancel(){cancelled=true;}});
 await assert.rejects(downloadList(source,{fetchImpl:async()=>new Response(body)}),/too large/);assert.equal(cancelled,true);
});
