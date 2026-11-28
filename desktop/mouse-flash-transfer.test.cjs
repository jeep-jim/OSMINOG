'use strict';
// Deterministic protocol tests. This channel fixture is not a native WebRTC test.
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const T=require('./mouse/flash/transfer.js');
const nativeManifest=require('./mouse-flash-files.cjs');
const {BLOCK_BYTES,FRAME_BYTES,CONTROL_BYTES,HIGH_WATER,LOW_WATER}=T.constants;
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const id=n=>n.toString(16).padStart(32,'0');
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function until(fn,message='condition',ms=5000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw Error('Timed out: '+message);await new Promise(setImmediate);}}
class Channel extends EventTarget{
  constructor(){super();this.readyState='open';this.ordered=true;this.maxRetransmits=null;this.maxPacketLifeTime=null;this.bufferedAmount=0;this.bufferedAmountLowThreshold=LOW_WATER;this.sent=[];this.transform=null;}
  send(value){
    assert.equal(this.readyState,'open');let data=typeof value==='string'?value:new Uint8Array(value).slice().buffer;
    this.sent.push(data);if(this.transform)data=this.transform(data);
    const length=typeof data==='string'?Buffer.byteLength(data):data.byteLength;this.bufferedAmount+=length;
    queueMicrotask(()=>{const before=this.bufferedAmount;this.bufferedAmount-=length;if(before>this.bufferedAmountLowThreshold&&this.bufferedAmount<=this.bufferedAmountLowThreshold)this.dispatchEvent(new Event('bufferedamountlow'));
      if(this.peer.readyState==='open')this.peer.dispatchEvent(new MessageEvent('message',{data}));});
  }
  close(){if(this.readyState==='closed')return;this.readyState='closed';this.dispatchEvent(new Event('close'));if(this.peer.readyState!=='closed'){this.peer.readyState='closed';this.peer.dispatchEvent(new Event('close'));}}
}
function channels(){const a=new Channel(),b=new Channel();a.peer=b;b.peer=a;return[a,b];}
async function setup(t,{length=BLOCK_BYTES*5+37,writeGate=null,chooseGate=null,sourceHashGate=null,completeGate=null,finishGate=null,timeoutMs=2000,resumeOffset=0,badReceipt=false,badFinal=false,manifest:provided=null}={}){
  const payload=Buffer.alloc(length);for(let i=0;i<length;i++)payload[i]=i%251;
  const manifest=provided||{v:1,transferId:id(700),files:[{id:id(1),path:'archive.bin',size:length},{id:id(2),path:'empty.txt',size:0}],directories:['empty-folder'],totalBytes:length};
  const manifestHash=await T.hashManifest(manifest),source={sourceId:'source-capability',manifest,manifestHash};
  const [a,b]=channels(),hostCalls=[],joinCalls=[],hostEvents=[],joinEvents=[];
  const incoming=new Map(manifest.files.map(f=>[f.id,Buffer.alloc(f.size)]));if(resumeOffset)payload.copy(incoming.get(id(1)),0,0,resumeOffset);
  const hostNative=async(action,args)=>{
    hostCalls.push({action,args});
    if(action==='read-block'){const data=payload.subarray(args.offset,args.offset+args.length);return{data,sha256:digest(data)};}
    if(action==='source-hash'){if(sourceHashGate)await sourceHashGate.promise;const data=args.fileId===id(1)?payload:Buffer.alloc(0);return{sha256:badFinal?'0'.repeat(64):digest(data),size:data.length};}
    if(['bind-peer','pause','finish'].includes(action))return{ok:true};
    throw Error('Unexpected host action '+action);
  };
  const joinNative=async(action,args)=>{
    joinCalls.push({action,args});
    if(action==='choose-destination'){if(chooseGate)await chooseGate.promise;return{receiveId:'receive-capability',folderName:'Synthetic destination',offsets:manifest.files.map(f=>({id:f.id,offset:f.id===id(1)?resumeOffset:0}))};}
    if(action==='write-block'){
      if(writeGate)await writeGate.promise;assert.equal(digest(args.data),args.sha256);Buffer.from(args.data).copy(incoming.get(args.fileId),args.offset);
      return{id:args.fileId,offset:args.offset+args.data.length+(badReceipt?1:0)};
    }
    if(action==='complete-file'){if(completeGate)await completeGate.promise;assert.equal(digest(incoming.get(args.fileId)),args.sha256,'final full-file checksum');return{id:args.fileId,ok:true};}
    if(action==='finish'&&finishGate)await finishGate.promise;
    if(['pause','finish'].includes(action))return{ok:true};throw Error('Unexpected receiver action '+action);
  };
  const host=new T.Transfer({role:'host',channel:a,callNative:hostNative,source,peerDeviceId:id(90),manifestHash,onEvent:e=>hostEvents.push(e),timeoutMs});
  const join=new T.Transfer({role:'join',channel:b,callNative:joinNative,peerDeviceId:id(80),manifestHash,onEvent:e=>joinEvents.push(e),timeoutMs});
  t.after(async()=>{writeGate?.resolve();chooseGate?.resolve();sourceHashGate?.resolve();completeGate?.resolve();finishGate?.resolve();await host.pause();await join.pause();a.close();});
  return{host,join,a,b,source,manifest,payload,incoming,hostCalls,joinCalls,hostEvents,joinEvents};
}
async function approveHost(pair){await pair.host.approveHost();await until(()=>pair.join.phase==='receiver-approval','manifest approval');}
const controls=channel=>channel.sent.filter(x=>typeof x==='string').map(x=>JSON.parse(x));

test('manifest canonical bytes and validation agree with privileged file layer',async()=>{
  const manifest={v:1,transferId:id(1),files:[{id:id(2),path:'data/one.bin',size:2**40},{id:id(3),path:'empty',size:0}],directories:['data'],totalBytes:2**40};
  assert.equal(T.canonicalManifest(T.validateManifest(manifest)),nativeManifest.canonicalManifest(nativeManifest.validateManifest(manifest,null)));
  assert.equal(await T.hashManifest(manifest),nativeManifest.hashManifest(manifest));
  for(const path of ['../x','/absolute','back\\slash','CON.txt','a/../b','a.','a/.mouse-flash-partials','x'.repeat(241),'e\u0301']){
    const bad={...manifest,files:[{id:id(2),path,size:0}],directories:[],totalBytes:0};assert.throws(()=>T.validateManifest(bad),path);assert.throws(()=>nativeManifest.validateManifest(bad,null),path);
  }
  assert.throws(()=>T.validateManifest({...manifest,files:[{id:id(2),path:'Case',size:0},{id:id(3),path:'case',size:0}],directories:[],totalBytes:0}),/Имена/);
  assert.throws(()=>T.validateManifest({...manifest,totalBytes:1}),/размер/);
});

test('no content is read or sent until both approvals and destination consent resolve',async t=>{
  const choose=gate(),pair=await setup(t,{length:BLOCK_BYTES+23,chooseGate:choose});
  assert.equal(pair.a.sent.length,0);await approveHost(pair);
  assert.equal(pair.hostCalls.filter(x=>x.action==='bind-peer').length,1);
  assert.equal(pair.hostCalls.filter(x=>x.action==='read-block').length,0);
  const approval=pair.join.approveReceiver();await until(()=>pair.joinCalls.some(x=>x.action==='choose-destination'),'folder prompt');
  assert.equal(pair.hostCalls.filter(x=>x.action==='read-block').length,0);assert.equal(pair.a.sent.filter(x=>typeof x!=='string').length,0);
  choose.resolve();await approval;await until(()=>pair.host.finished&&pair.join.finished,'completed transfer');
  assert.deepEqual(pair.incoming.get(id(1)),pair.payload);assert.equal(pair.hostEvents.filter(e=>e.type==='complete').length,1);assert.equal(pair.joinEvents.filter(e=>e.type==='complete').length,1);
  assert.equal(pair.hostCalls.at(-1).action,'finish');assert.equal(pair.joinCalls.at(-1).action,'finish');
  const frames=pair.a.sent.filter(x=>typeof x!=='string');assert.ok(frames.length>64);assert.ok(frames.every(x=>x.byteLength<=FRAME_BYTES));
  assert.ok(pair.a.sent.filter(x=>typeof x==='string').every(x=>Buffer.byteLength(x)<=CONTROL_BYTES));
});

test('four outstanding disk blocks bound memory and ACK waits for durable write receipt',async t=>{
  const write=gate(),pair=await setup(t,{writeGate:write});await approveHost(pair);await pair.join.approveReceiver();
  await until(()=>pair.host.pending.size===4&&pair.joinCalls.some(x=>x.action==='write-block'),'four outstanding blocks');
  assert.equal(pair.hostCalls.filter(x=>x.action==='read-block').length,4);
  assert.equal(controls(pair.b).filter(x=>x.type==='ack').length,0);assert.equal(pair.host.offsets.get(id(1)),0);
  assert.ok(pair.join.queuedBytes<=4*BLOCK_BYTES+8*CONTROL_BYTES);
  write.resolve();await until(()=>pair.host.finished&&pair.join.finished,'durable transfer');
  assert.deepEqual(pair.incoming.get(id(1)),pair.payload);assert.equal(controls(pair.b).filter(x=>x.type==='ack').length,6);
});

test('resume starts at confirmed offset and still verifies final file and empty file',async t=>{
  const pair=await setup(t,{length:BLOCK_BYTES*2+7,resumeOffset:BLOCK_BYTES});await approveHost(pair);await pair.join.approveReceiver({resume:true});
  await until(()=>pair.host.finished,'resumed transfer');
  const reads=pair.hostCalls.filter(x=>x.action==='read-block');assert.equal(reads[0].args.offset,BLOCK_BYTES);assert.equal(reads.length,2);
  assert.equal(pair.joinCalls.find(x=>x.action==='choose-destination').args.resume,true);
  assert.equal(pair.joinCalls.filter(x=>x.action==='complete-file').length,2);assert.deepEqual(pair.incoming.get(id(1)),pair.payload);
});

test('empty folders finish without content frames or synthetic files',async t=>{
  const manifest={v:1,transferId:id(5),files:[],directories:['empty','empty/nested'],totalBytes:0};
  const pair=await setup(t,{length:0,manifest});await approveHost(pair);await pair.join.approveReceiver();await until(()=>pair.host.finished,'empty folder transfer');
  assert.equal(pair.a.sent.filter(x=>typeof x!=='string').length,0);assert.equal(pair.hostCalls.filter(x=>x.action==='read-block').length,0);
  assert.equal(pair.joinCalls.filter(x=>x.action==='complete-file').length,0);
});

test('manifest and resume inventories use bounded pages even for thousands of entries',async t=>{
  const files=Array.from({length:2200},(_,i)=>({id:id(i+1),path:`folder/${i.toString().padStart(6,'0')}-${'x'.repeat(40)}`,size:0}));
  const manifest={v:1,transferId:id(6000),files,directories:['folder'],totalBytes:0},pair=await setup(t,{length:0,manifest});
  await approveHost(pair);
  const pages=controls(pair.a).filter(x=>x.type==='manifest-files');assert.ok(pages.length>2);assert.ok(pages.every(x=>x.items.length<=1000));
  assert.equal(pages.flatMap(x=>x.items).length,files.length);assert.ok(pair.a.sent.every(x=>typeof x==='string'&&Buffer.byteLength(x)<=CONTROL_BYTES));
  // Ready paging is checked without starting 2,200 per-file acknowledgements.
  pair.host._sendFiles=async()=>{};await pair.join.approveReceiver();await until(()=>pair.host.phase==='sending','paged ready inventory');
  const ready=controls(pair.b).filter(x=>x.type==='ready-page');assert.ok(ready.length>1);assert.ok(ready.every(x=>x.items.length<=1000));
  assert.equal(ready.flatMap(x=>x.items).length,files.length);assert.ok(pair.b.sent.every(x=>typeof x==='string'&&Buffer.byteLength(x)<=CONTROL_BYTES));
});

test('premature binary content is rejected before any native write',async t=>{
  const pair=await setup(t,{length:10});pair.a.send(T.makeFrame(1,0,new Uint8Array([1])));
  await until(()=>pair.join.stopped,'premature data rejected');assert.equal(pair.joinCalls.filter(x=>x.action==='write-block').length,0);assert.equal(pair.hostCalls.filter(x=>x.action==='read-block').length,0);
});

test('tampered block is rejected before write and does not receive ACK',async t=>{
  const pair=await setup(t,{length:20000});let changed=false;
  pair.a.transform=value=>{if(typeof value!=='string'&&!changed){changed=true;const bytes=new Uint8Array(value);bytes[bytes.length-1]^=1;}return value;};
  await approveHost(pair);await pair.join.approveReceiver();await until(()=>pair.join.stopped,'block checksum rejection');
  assert.equal(pair.joinCalls.filter(x=>x.action==='write-block').length,0);assert.equal(controls(pair.b).filter(x=>x.type==='ack').length,0);assert.ok(pair.joinEvents.some(x=>x.type==='error'));
});

test('unexpected durable offset never becomes a sender ACK',async t=>{
  const pair=await setup(t,{length:100,badReceipt:true});await approveHost(pair);await pair.join.approveReceiver();await until(()=>pair.join.stopped,'bad native receipt');
  assert.equal(controls(pair.b).filter(x=>x.type==='ack').length,0);assert.equal(pair.hostCalls.filter(x=>x.action==='finish').length,0);
});

test('full-file checksum failure prevents completion even after valid block ACKs',async t=>{
  const pair=await setup(t,{length:100,badFinal:true});await approveHost(pair);await pair.join.approveReceiver();await until(()=>pair.join.stopped,'final checksum rejection');
  assert.equal(controls(pair.b).filter(x=>x.type==='ack').length,1);assert.equal(controls(pair.b).filter(x=>x.type==='file-ok').length,0);
  assert.equal(pair.joinCalls.filter(x=>x.action==='finish').length,0);assert.equal(pair.hostEvents.filter(x=>x.type==='complete').length,0);
});

test('long source hash, receiver hash and finish are not limited by block ACK timeout',async t=>{
  const sourceHash=gate(),complete=gate(),finish=gate(),pair=await setup(t,{length:100,timeoutMs:80,sourceHashGate:sourceHash,completeGate:complete,finishGate:finish});
  await approveHost(pair);await pair.join.approveReceiver();
  await until(()=>pair.hostCalls.some(x=>x.action==='source-hash'),'source hashing');await new Promise(r=>setTimeout(r,160));
  assert.equal(pair.host.stopped,false);assert.equal(pair.host.pending.size,0);sourceHash.resolve();
  await until(()=>pair.joinCalls.some(x=>x.action==='complete-file'),'receiver full hash');await new Promise(r=>setTimeout(r,160));
  assert.equal(pair.host.stopped,false);assert.ok(pair.host.fileWait);assert.equal(pair.host.finished,false);complete.resolve();
  await until(()=>pair.joinCalls.some(x=>x.action==='finish'),'receiver finalization');await new Promise(r=>setTimeout(r,160));
  assert.equal(pair.host.stopped,false);assert.ok(pair.host.finishWait);assert.equal(pair.host.finished,false);finish.resolve();
  await until(()=>pair.host.finished&&pair.join.finished,'long checks completed');
});

test('backpressure waits below configured high watermark and releases on low event',async t=>{
  const pair=await setup(t,{length:1});pair.a.bufferedAmount=HIGH_WATER;
  const approval=pair.host.approveHost();await until(()=>pair.hostCalls.some(x=>x.action==='bind-peer'),'peer binding');await new Promise(setImmediate);
  assert.equal(pair.a.sent.length,0);assert.equal(pair.a.bufferedAmountLowThreshold,LOW_WATER);
  pair.a.bufferedAmount=LOW_WATER;pair.a.dispatchEvent(new Event('bufferedamountlow'));await approval;await until(()=>pair.join.phase==='receiver-approval','released backpressure');
});

test('disconnect during backpressure rejects wait and preserves resumable state through pause',async t=>{
  const pair=await setup(t,{length:1});pair.a.bufferedAmount=HIGH_WATER;
  const approval=pair.host.approveHost();await until(()=>pair.host.cleanups.size>0,'backpressure wait');pair.a.close();await assert.rejects(approval);
  await until(()=>pair.hostCalls.some(x=>x.action==='pause'),'native pause');assert.equal(pair.host.cleanups.size,0);assert.equal(pair.hostCalls.filter(x=>x.action==='finish').length,0);
});

test('resume offsets reject gaps, duplicate ids, overflows and unaligned positions',()=>{
  const manifest={files:[{id:id(1),size:BLOCK_BYTES+3},{id:id(2),size:0}]};
  assert.equal(T.validateOffsets([{id:id(1),offset:BLOCK_BYTES},{id:id(2),offset:0}],manifest).get(id(1)),BLOCK_BYTES);
  for(const offsets of [[{id:id(1),offset:1},{id:id(2),offset:0}],[{id:id(1),offset:BLOCK_BYTES+4},{id:id(2),offset:0}],[{id:id(1),offset:0},{id:id(1),offset:0}],[{id:id(1),offset:Number.MAX_SAFE_INTEGER+1},{id:id(2),offset:0}]])assert.throws(()=>T.validateOffsets(offsets,manifest));
});

test('direct-route evidence requires selected successful pair and both direct candidates',()=>{
  const pair={id:'pair',type:'candidate-pair',state:'succeeded',nominated:true,localCandidateId:'local',remoteCandidateId:'remote'};
  const report=new Map([['pair',pair],['local',{type:'local-candidate',candidateType:'host'}],['remote',{type:'remote-candidate',candidateType:'srflx'}]]);
  assert.deepEqual(T.directCandidatePair(report),{pairId:'pair',local:'host',remote:'srflx'});
  assert.equal(T.directCandidatePair(new Map()),null);const incomplete=new Map(report);incomplete.delete('remote');assert.equal(T.directCandidatePair(incomplete),null);
  const pending=new Map(report);pending.set('pair',{...pair,state:'in-progress'});assert.equal(T.directCandidatePair(pending),null);
  const other=new Map(report);other.set('transport',{type:'transport',selectedCandidatePairId:'other-pair'});assert.equal(T.directCandidatePair(other),null);
  const relay=new Map(report);relay.set('remote',{type:'remote-candidate',candidateType:'relay'});assert.throws(()=>T.directCandidatePair(relay),e=>e.code==='RELAY_FORBIDDEN');
});
