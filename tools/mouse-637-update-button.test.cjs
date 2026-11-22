'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const D=require('./mouse-637-update-button.cjs');
const {MouseUpdates,releaseTarget}=require('../desktop/mouse-update.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const names={darwin:'mac-arm64.dmg',win32:'Windows-x64.exe',linux:'Linux-x64.AppImage'};
function candidate(platform,bytes=Buffer.from('owned new package')){
 const target=releaseTarget({platform,arch:platform==='darwin'?'arm64':'x64'}),name='Mouse-Browser-6.0.37-'+names[platform];
 return{name,version:D.TO,size:bytes.length,sha256:sha(bytes),path:path.join(os.tmpdir(),name),url:'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/'+target.tagFor(D.TO)+'/'+name};
}
function input(platform){return{version:D.TO,fromVersion:D.FROM,reportPrefix:D.PREFIX,
 executable:path.join(os.tmpdir(),'owned-app'),profile:path.join(os.tmpdir(),'owned-profile'),output:os.tmpdir(),state:path.join(os.tmpdir(),'state.json'),python:process.execPath,
 baseline:{source:D.SOURCE,updaterBlobSHA:D.UPDATER_BLOB,size:123,sha256:'a'.repeat(64)},ownerSentinel:{name:'mouse637-update-owner.txt',sha256:'b'.repeat(64)},candidate:candidate(platform),...(platform==='linux'?{packageFormat:'appimage'}:{})};}

test('the current packaged updater is byte-identical to the published636 module pinned by the probe',()=>{
 const bytes=sync.readFileSync(path.join(__dirname,'../desktop/mouse-update.cjs'));
 assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),D.UPDATER_BLOB);
});

test('native probe accepts only exact current/predecessor, platform name, canonical package and owned profile contract',()=>{
 for(const platform of Object.keys(names)){
  assert.equal(D.validateInput(input(platform),platform),true);
  for(const modify of [x=>x.version='6.0.36',x=>x.fromVersion='6.0.35',x=>x.baseline.updaterBlobSHA='a'.repeat(40),x=>x.baseline.source='a'.repeat(40),x=>x.profile='relative',x=>x.python='python',x=>x.ownerSentinel.name='../owner.txt',x=>x.candidate.url+='?fixture=1',x=>x.candidate.name='Mouse-Browser-6.0.36-'+names[platform],x=>x.candidate.size=0]){
   const value=input(platform);modify(value);assert.throws(()=>D.validateInput(value,platform));
  }
 }
});

test('fixture transport preserves fetch options and refuses every unlisted URL',async()=>{
 const options={headers:{Accept:'application/json'},signal:new AbortController().signal},calls=[],requests=[];
 const response=new Response('{}');const transport=D.fixtureTransport(async(...args)=>{calls.push(args);return response;},{'https://canonical.invalid/channel':'http://127.0.0.1:1234/channel'},requests);
 assert.equal(await transport('https://canonical.invalid/channel',options),response);assert.equal(calls[0][0],'http://127.0.0.1:1234/channel');assert.equal(calls[0][1],options);assert.equal(requests[0].url,'https://canonical.invalid/channel');
 for(const url of ['https://canonical.invalid/channel?x=1','file:///etc/passwd','https://other.invalid/package'])await assert.rejects(()=>transport(url,options),/Unexpected updater transport URL/);
 assert.equal(calls.length,1);
});

for(const platform of Object.keys(names))test('actual636 '+platform+' updater selects637, validates download and delegates unchanged install',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse637-button-contract-')),bytes=Buffer.from('owned exact candidate '+platform),c=candidate(platform,bytes),target=releaseTarget({platform,arch:platform==='darwin'?'arm64':'x64'});
 const original={...Object.fromEntries(['check','download','verified','install','open'].map(name=>[name,MouseUpdates.prototype[name]]))},calls=[],requests=[],instances=[];
 const fetcher=async(url,options)=>{calls.push({url,options});if(url==='http://127.0.0.1:1234/channel')return Response.json(D.channelFor(c,platform));if(url==='http://127.0.0.1:1234/package')return new Response(bytes);throw Error('Unapproved fixture transport');};
 const prepared=[],installer={prepare:async(...args)=>{prepared.push(args);},install:async()=>{prepared.push('installed');}};
 const app={getVersion:()=>D.FROM,getPath:key=>{assert.equal(key,'temp');return root;}},u=new MouseUpdates({app,fetcher,installer,target});
 const restore=D.attachTransport(MouseUpdates,{[target.channel]:'http://127.0.0.1:1234/channel',[c.url]:'http://127.0.0.1:1234/package'},requests,value=>instances.push(value));
 try{
  for(const name of ['download','verified','install','open'])assert.equal(MouseUpdates.prototype[name],original[name]);
  assert.equal(u.installer,installer);assert.equal(u.app,app);assert.equal(u.state.currentVersion,D.FROM);
  const available=await u.run('check');assert.equal(available.phase,'available');assert.equal(available.availableVersion,D.TO);assert.equal(available.channel,'static');assert.equal(instances[0],u);
  const ready=await u.run('download');assert.equal(ready.phase,'ready');assert.equal(ready.canInstall,true);assert.deepEqual(await fs.readFile(u.file),bytes);
  await u.run('install');assert.equal(prepared[0][0],u.file);assert.equal(prepared[0][1].hash,c.sha256);assert.equal(prepared[0][1].url,c.url);assert.equal(prepared[1],'installed');
  assert.deepEqual(requests.map(row=>row.url),[target.channel,c.url]);assert.equal(calls.length,2);assert.equal(u.app.getVersion(),D.FROM);
 }finally{restore();assert.equal(MouseUpdates.prototype.check,original.check);await fs.rm(root,{recursive:true,force:true});}
});

test('transport fixture cannot bypass checksum failure or manufacture an upgrade for an already-current app',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse637-button-rejection-')),bytes=Buffer.from('original checked bytes'),c=candidate('darwin',bytes),target=releaseTarget();let prepared=false;
 const fetcher=async url=>url.endsWith('/channel')?Response.json(D.channelFor(c,'darwin')):new Response(Buffer.alloc(bytes.length,65));
 const restore=D.attachTransport(MouseUpdates,{[target.channel]:'http://127.0.0.1:1234/channel',[c.url]:'http://127.0.0.1:1234/package'},[],()=>{});
 try{
  const u=new MouseUpdates({app:{getVersion:()=>D.FROM,getPath:()=>root},fetcher,installer:{prepare:()=>{prepared=true;},install(){}}});
  await u.run('check');await assert.rejects(()=>u.run('download'),/SHA-256/);assert.equal(u.state.phase,'error');assert.equal(prepared,false);assert.equal(u.file,null);
  const current=new MouseUpdates({app:{getVersion:()=>D.TO,getPath:()=>root},fetcher});const result=await current.run('check');assert.equal(result.phase,'current');assert.equal(result.availableVersion,'');assert.equal(current.candidate,null);
 }finally{restore();await fs.rm(root,{recursive:true,force:true});}
});
