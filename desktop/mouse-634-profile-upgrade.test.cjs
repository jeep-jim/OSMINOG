'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const helperPath=path.resolve(__dirname,'../tools/mouse-634-profile-upgrade.cjs');
const {profileDocumentSnapshot,profileDocumentReady,waitForProfileDocument,reportPrefix,processId,mountForExecutable,validateLinuxProcessIdentity,appImageReceipt}=require(helperPath);
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

function syntheticMountedProcess(){
 const input={packageFormat:'appimage',executable:'/tmp/owned/Mouse Browser.AppImage'},executable='/tmp/.mount_Mouse ABC123/mouse-browser';
 const raw='91 37 0:84 / /tmp/.mount_Mouse\\040ABC123 ro,nosuid,nodev,relatime - fuse.AppImage AppImage ro,user_id=1001,group_id=1001';
 const facts={pid:410,launcherPid:400,uid:1001,packageFormat:'appimage',executable,appImage:input.executable,appImageSource:'verified launch path and owned browser ancestry',environmentAppImage:null,
  launchAncestry:[{pid:410,parentPid:400,uid:1001},{pid:400,parentPid:300,uid:1001}],mount:mountForExecutable(raw,executable),
  launchedImage:{path:input.executable,uid:1001,device:2049,inode:12345,size:135575147,sha256:'b'.repeat(64),regularFile:true,executable:true}};
 return{input,facts};
}

test('mounted AppImage identity uses the real FUSE mount and owned launch ancestry when Chromium clears initial environment',()=>{
 const {input,facts}=syntheticMountedProcess();assert.equal(validateLinuxProcessIdentity(facts,input,1001),true);
 assert.equal(facts.mount.mountPoint,'/tmp/.mount_Mouse ABC123');assert.equal(facts.environmentAppImage,null);
 facts.environmentAppImage=input.executable;assert.equal(validateLinuxProcessIdentity(facts,input,1001),true);
 facts.mount.raw=facts.mount.raw.replace('fuse.AppImage','fuse.mouse.browser');facts.mount.filesystem='fuse.mouse.browser';assert.equal(validateLinuxProcessIdentity(facts,input,1001),true);
 facts.pid=facts.launcherPid;facts.launchAncestry=[facts.launchAncestry[1]];assert.equal(validateLinuxProcessIdentity(facts,input,1001),true);
});

test('mounted identity rejects wrong process ownership, ancestry, image receipts and conflicting environment',()=>{
 const mutations=[f=>f.uid=0,f=>f.pid=999,f=>f.launcherPid=999,f=>f.launchAncestry=[],f=>f.launchAncestry[0].parentPid=399,
  f=>f.launchAncestry[1].uid=0,f=>f.launchAncestry.push(f.launchAncestry[0]),f=>f.environmentAppImage='/tmp/different.AppImage',
  f=>f.appImage='/tmp/different.AppImage',f=>f.appImageSource='environment',f=>f.launchedImage.path='/tmp/different.AppImage',
  f=>f.launchedImage.uid=0,f=>f.launchedImage.size=0,f=>f.launchedImage.sha256='missing',f=>f.launchedImage.regularFile=false,f=>f.launchedImage.executable=false];
 for(const mutate of mutations){const {input,facts}=syntheticMountedProcess();mutate(facts);assert.throws(()=>validateLinuxProcessIdentity(facts,input,1001));}
});

test('portable executable path alone cannot pass without its exact read-only native FUSE mount',()=>{
 for(const mutate of [f=>f.executable='/opt/Mouse Browser/mouse-browser',f=>f.executable='/tmp/.mount_Mouse ABC123/other/mouse-browser',
  f=>f.mount.filesystem='ext4',f=>f.mount.options=['rw'],f=>f.mount.root='/other',f=>f.mount.mountPoint='/tmp/another',f=>f.mount.raw=f.mount.raw.replace('0:84','0:85')]){
  const {input,facts}=syntheticMountedProcess();mutate(facts);assert.throws(()=>validateLinuxProcessIdentity(facts,input,1001));
 }
 const {facts}=syntheticMountedProcess(),root='37 1 8:1 / / rw - ext4 /dev/root rw\n';
 assert.equal(mountForExecutable(root+facts.mount.raw+'\n',facts.executable).mountId,91);
 assert.throws(()=>mountForExecutable(facts.mount.raw+'\n'+facts.mount.raw,facts.executable));
 assert.throws(()=>mountForExecutable(root+'\0',facts.executable));
});

test('native deb identity remains the exact installed executable and cannot be relabelled portable',()=>{
 const input={packageFormat:'deb',executable:'/opt/Mouse Browser/mouse-browser'},facts={pid:22,launcherPid:22,uid:1001,packageFormat:'deb',executable:input.executable,appImage:null,environmentAppImage:null,launchAncestry:[{pid:22,parentPid:11,uid:1001}]};
 assert.equal(validateLinuxProcessIdentity(facts,input,1001),true);
 for(const mutate of [f=>f.executable='/opt/Another/mouse-browser',f=>f.executable='/tmp/.mount_Image/mouse-browser',f=>f.appImage='/tmp/owned.AppImage']){
  const copy=structuredClone(facts);mutate(copy);assert.throws(()=>validateLinuxProcessIdentity(copy,input,1001));
 }
});

test('AppImage launch receipt hashes actual owned bytes and rejects symlinks/non-executables',{skip:process.platform!=='linux'},async()=>{
 const fsp=require('node:fs/promises'),os=require('node:os'),crypto=require('node:crypto');
 const folder=await fsp.mkdtemp(path.join(os.tmpdir(),'mouse634-receipt-'));
 try{
  const file=path.join(folder,'synthetic.AppImage'),raw=Buffer.from('Synthetic unit payload, never an installed native app');await fsp.writeFile(file,raw,{mode:0o700});
  const receipt=await appImageReceipt(file,process.getuid());assert.equal(receipt.size,raw.length);assert.equal(receipt.sha256,crypto.createHash('sha256').update(raw).digest('hex'));
  await fsp.writeFile(file,Buffer.concat([raw,Buffer.from('changed')]));assert.notEqual((await appImageReceipt(file,process.getuid())).sha256,receipt.sha256);
  const link=path.join(folder,'link.AppImage');await fsp.symlink(file,link);await assert.rejects(appImageReceipt(link,process.getuid()));
  await fsp.chmod(file,0o600);await assert.rejects(appImageReceipt(file,process.getuid()));
 }finally{await fsp.rm(folder,{recursive:true,force:true});}
});
