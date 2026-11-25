'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {MouseAdBlock,SOURCES,MAX_BYTES,MAX_AGE,sha256,validateText,validRecord,downloadList}=require('./mouse-adblock.cjs');
const list=(marker='example')=>'[Adblock Plus 2.0]\n! Synthetic network-filter fixture; not a public subscription\n'+Array.from({length:60},(_,i)=>'||ad'+i+'.'+marker+'.test^').join('\n')+'\n';
async function fixture(t,options={}){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-adblock-'));const service=new MouseAdBlock({directory,...options});t.after(async()=>{service.dispose();await service.preparing;await service.inFlight;await fs.rm(directory,{recursive:true,force:true});});return service;}
const record=(source,text,when=Date.now())=>({schema:1,source:source.id,url:source.url,updatedAt:new Date(when).toISOString(),sha256:sha256(text),text});
async function cache(service,source,text,when){await fs.writeFile(path.join(service.directory,source.id+'.json'),JSON.stringify(record(source,text,when)));}
const fakeSession=()=>{const ses={calls:0,listener:null};ses.webRequest={onBeforeRequest(filter,fn){ses.calls++;ses.listener=filter===null?null:fn;}};return ses;};
const request=(ses,url='https://ads.vk.com/ad.js')=>{let calls=0,decision;ses.listener({url,resourceType:'script',initiatorOrigin:'https://vk.com'},value=>{calls++;decision=value;});assert.equal(calls,1);return decision;};

test('disabled profiles neither download nor read lists and existing sessions share the opt-in state',async t=>{
 let downloads=0;const service=await fixture(t,{fetchList:async()=>{downloads++;throw Error('offline');}});
 await service.initialize();assert.equal(service.state().enabled,false);assert.equal(service.prepared,false);assert.equal(downloads,0);
 const normal=fakeSession(),privateSession=fakeSession(),shell=fakeSession();
 const detach=service.attach(normal);assert.equal(service.attach(normal),detach);service.attach(privateSession);service.attach(shell);
 for(const ses of [normal,privateSession,shell])assert.deepEqual(request(ses),{cancel:false});
 service.setEnabled(true);await service.prepare();await service.refresh();
 for(const ses of [normal,privateSession,shell]){assert.deepEqual(request(ses),{cancel:true});assert.deepEqual(request(ses,'https://vk.com/audio/song.mp3'),{cancel:false});assert.equal(ses.calls,1);}
 assert.equal(service.state().phase,'fallback');assert.equal(downloads,2);
 service.setEnabled(false);for(const ses of [normal,privateSession,shell]){assert.deepEqual(request(ses),{cancel:false});assert.equal(ses.calls,1);}
 detach();assert.equal(normal.listener,null);assert.equal(service.sessions.size,2);
});
test('fresh verified local lists work offline, including after a new controller is created',async t=>{
 let downloads=0;const service=await fixture(t,{fetchList:async()=>{downloads++;throw Error('must not contact a server');}});
 for(const source of SOURCES)await cache(service,source,list(source.id));
 await service.initialize(true);await service.refresh();assert.equal(downloads,0);assert.equal(service.state().lists,2);assert.equal(service.state().phase,'ready');
 const ses=fakeSession();service.attach(ses);assert.deepEqual(request(ses,'https://ad4.easylist.test/ad.js'),{cancel:true});
 service.dispose();const restored=new MouseAdBlock({directory:service.directory,fetchList:async()=>{throw Error('offline');}});t.after(()=>restored.dispose());
 await restored.initialize(true);const next=fakeSession();restored.attach(next);assert.deepEqual(request(next,'https://ad4.ruadlist.test/ad.js'),{cancel:true});
});
test('bad download keeps the last verified list while another subscription can update independently',async t=>{
 const now=Date.now(),service=await fixture(t,{now:()=>now,fetchList:async source=>source.id==='easylist'?'<html>Error</html>':list('updated')});
 const old=list('retained');for(const source of SOURCES)await cache(service,source,old,now-MAX_AGE-1);
 await service.initialize(true);await service.refresh();
 assert.equal(service.state().phase,'ready');assert.equal(service.state().lists,2);
 assert.equal(JSON.parse(await fs.readFile(path.join(service.directory,'easylist.json'),'utf8')).text,old);
 const ses=fakeSession();service.attach(ses);assert.deepEqual(request(ses,'https://ad1.retained.test/ad.js'),{cancel:true});assert.deepEqual(request(ses,'https://ad1.updated.test/ad.js'),{cancel:true});
});
test('tampered cache and unavailable providers leave only the explicit basic rules',async t=>{
 const service=await fixture(t,{fetchList:async()=>{throw Error('offline');}});const source=SOURCES[0],bad=record(source,list());bad.text+='||vk.com^\n';
 await fs.writeFile(path.join(service.directory,'easylist.json'),JSON.stringify(bad));await service.initialize(true);await service.refresh();
 assert.equal(service.state().lists,0);assert.equal(service.state().phase,'fallback');assert.equal(service.state().rules,3);
 const ses=fakeSession();service.attach(ses);assert.deepEqual(request(ses,'https://vk.com/api/content'),{cancel:false});
});
test('turning off aborts subscription transfers and cannot late-enable filtering',async t=>{
 let startedResolve;const started=new Promise(resolve=>startedResolve=resolve);let aborted=0;
 const service=await fixture(t,{fetchList:(_source,{signal})=>new Promise((resolve,reject)=>{startedResolve();signal.addEventListener('abort',()=>{aborted++;reject(Error('aborted'));},{once:true});})});
 service.setEnabled(true);await started;const pending=service.inFlight;service.setEnabled(false);await pending;
 assert.ok(aborted>0);assert.equal(service.state().phase,'off');assert.equal(service.state().lists,0);
 const ses=fakeSession();service.attach(ses);assert.deepEqual(request(ses),{cancel:false});
});
test('unexpected matching errors fail open and answer the Electron callback exactly once',async t=>{
 const service=await fixture(t);const ses=fakeSession();service.attach(ses);service.enabled=true;service.engine={count:0,shouldBlock(){throw Error('bad frame');}};
 assert.deepEqual(request(ses),{cancel:false});
});
test('list validation rejects incomplete manifests, HTML, future dates and damaged hashes',()=>{
 for(const bad of ['<html>Access denied</html>','[Adblock Plus 2.0]\n||ads.test^',list()+'\n%include other-file%',list()+'\0'])assert.throws(()=>validateText(bad));
 const source=SOURCES[0];assert.equal(validRecord(record(source,list()),source).source,'easylist');
 assert.throws(()=>validRecord(record(source,list(),Date.now()+600000),source));
 assert.throws(()=>validRecord({...record(source,list()),url:'http://elsewhere.test/'},source));
 assert.throws(()=>validRecord({...record(source,list()),sha256:'0'.repeat(64)},source));
});
test('fixed HTTPS subscriptions omit credentials, reject redirects and validate bounded response bodies',async()=>{
 let observed;const fake=async(url,options)=>{observed={url,options};return new Response(list(),{status:200,headers:{'content-type':'text/plain; charset=utf-8'}});};
 assert.equal(await downloadList(SOURCES[0],{fetchImpl:fake}),list());assert.equal(observed.url,SOURCES[0].url);assert.equal(observed.options.redirect,'error');assert.equal(observed.options.credentials,'omit');assert.equal(observed.options.headers.Cookie,undefined);
 await assert.rejects(downloadList({id:'other',url:'https://other.test/'},{fetchImpl:fake}));
 await assert.rejects(downloadList(SOURCES[0],{fetchImpl:async()=>new Response('<html>denied</html>',{headers:{'content-type':'text/html'}})}));
 await assert.rejects(downloadList(SOURCES[0],{fetchImpl:async()=>new Response(list(),{headers:{'content-length':String(MAX_BYTES+1),'content-type':'text/plain'}})}));
});
