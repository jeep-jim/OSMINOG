'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), dgram = require('node:dgram'), crypto = require('node:crypto'), zlib = require('node:zlib');
const {createBindingResponse, createLimiter, startStunService, ipv6Bytes} = require('./mouse-flash-stun-service.cjs');
const COOKIE = 0x2112a442;
function request(attributes = Buffer.alloc(0)) { const value = Buffer.alloc(20 + attributes.length); value.writeUInt16BE(1); value.writeUInt16BE(attributes.length, 2); value.writeUInt32BE(COOKIE, 4); crypto.randomBytes(12).copy(value, 8); attributes.copy(value, 20); return value; }
function attr(type, value) { const result = Buffer.alloc(4 + ((value.length + 3) & ~3)); result.writeUInt16BE(type); result.writeUInt16BE(value.length, 2); value.copy(result, 4); return result; }
function decode(response) {
  assert.equal(response.readUInt16BE(0),0x0101);assert.equal(response.readUInt16BE(2),response.length-20);assert.equal(response.readUInt32BE(4),COOKIE);
  assert.equal(response.readUInt16BE(20),0x20);assert.equal(response.readUInt16BE(response.length-8),0x8028);
  assert.equal(response.readUInt32BE(response.length-4),(zlib.crc32(response.subarray(0,response.length-8))^0x5354554e)>>>0);
  const bytes=Buffer.from(response.subarray(28,response.length-8));for(let i=0;i<bytes.length;i++)bytes[i]^=response[4+i];
  return{bytes,port:response.readUInt16BE(26)^(COOKIE>>>16),family:response[25]};
}
test('production Binding encodes exact IPv4 and IPv6 source, transaction and fingerprint without reflecting attributes',()=>{
  for(const info of [{family:'IPv4',address:'198.51.100.7',port:54321},{family:'IPv6',address:'2001:db8:1234:5678::9',port:65535}]){
    const value=request(attr(0x8022,Buffer.from('private unreflected text'))),reply=createBindingResponse(value,info),decoded=decode(reply);
    assert.deepEqual(reply.subarray(8,20),value.subarray(8,20));assert.equal(decoded.port,info.port);assert.equal(decoded.family,info.family==='IPv4'?1:2);
    assert.deepEqual(decoded.bytes,info.family==='IPv4'?Buffer.from([198,51,100,7]):Buffer.from('20010db8123456780000000000000009','hex'));
    assert.equal(reply.includes(Buffer.from('private unreflected text')),false);assert.ok(reply.length<=52);
  }
  assert.deepEqual(ipv6Bytes('::ffff:192.0.2.9'),Buffer.from('00000000000000000000ffffc0000209','hex'));
});
test('malformed STUN, all TURN methods, redirects and required attributes have no response',()=>{
  const info={family:'IPv4',address:'198.51.100.9',port:3478},valid=request();
  for(const type of [0x0003,0x0004,0x0006,0x0016,0x0101,0x0111,0x4001,0x8001]){const value=Buffer.from(valid);value.writeUInt16BE(type);assert.equal(createBindingResponse(value,info),null);}
  for(const value of [Buffer.alloc(19),Buffer.alloc(1025),request(attr(0x0003,Buffer.alloc(4))),request(attr(0x0006,Buffer.alloc(4))),request(attr(0x0008,Buffer.alloc(20)))])assert.equal(createBindingResponse(value,info),null);
  const fingerprint=request(attr(0x8028,Buffer.alloc(4)));assert.equal(createBindingResponse(fingerprint,info),null);
  fingerprint.writeUInt32BE((zlib.crc32(fingerprint.subarray(0,20))^0x5354554e)>>>0,24);assert.ok(createBindingResponse(fingerprint,info));
  for(const address of ['0.0.0.0','224.0.0.1','255.255.255.255'])assert.equal(createBindingResponse(valid,{...info,address}),null);
  for(const address of ['::','ff02::1','fe80::1%eth0'])assert.equal(createBindingResponse(valid,{...info,address,family:'IPv6'}),null);
});
test('global and per-peer buckets bound responses; IPv6 privacy addresses share a /64 and idle maps expire',()=>{
  let now=0;const limiter=createLimiter({now:()=>now,limits:{globalBurst:4,globalPerSecond:2,peerBurst:2,peerPerSecond:1,maxPeers:2,peerIdleMs:5000}});
  assert.deepEqual(Array.from({length:6},()=>limiter.allowGlobal()),[true,true,true,true,false,false]);now=500;assert.equal(limiter.allowGlobal(),true);assert.equal(limiter.allowGlobal(),false);
  const peer={family:'IPv6',address:'2001:db8:1:2::1',port:10000};assert.equal(limiter.allowPeer(peer),true);assert.equal(limiter.allowPeer({...peer,address:'2001:db8:1:2::2'}),true);assert.equal(limiter.allowPeer({...peer,address:'2001:db8:1:2::ffff'}),false);
  assert.equal(limiter.allowPeer({family:'IPv4',address:'192.0.2.1',port:10000}),true);assert.equal(limiter.allowPeer({family:'IPv4',address:'192.0.2.2',port:10000}),false);assert.equal(limiter.peerCount(),2);
  now=6500;limiter.sweep();assert.equal(limiter.peerCount(),0);assert.equal(limiter.allowPeer(peer),true);
  assert.throws(()=>createLimiter({limits:{maxDatagramBytes:65535}}),/Unsafe/);assert.throws(()=>createLimiter({limits:{globalPerSecond:1000000}}),/Unsafe/);
});
test('real bounded UDP service returns the actual source and refuses excess replies',async()=>{
  const service=await startStunService({hosts:['127.0.0.1'],port:0,limits:{peerBurst:2,peerPerSecond:1}}),client=dgram.createSocket('udp4');
  try{
    await new Promise(resolve=>client.bind(0,'127.0.0.1',resolve));const received=[];client.on('message',value=>received.push(value));
    for(let i=0;i<5;i++)await new Promise((resolve,reject)=>client.send(request(),service.addresses[0].port,'127.0.0.1',error=>error?reject(error):resolve()));
    await new Promise(resolve=>setTimeout(resolve,80));assert.equal(received.length,2);
    const source=decode(received[0]);assert.deepEqual(source.bytes,Buffer.from([127,0,0,1]));assert.equal(source.port,client.address().port);
    assert.equal(service.stats().answered,2);assert.equal(service.stats().dropped,3);assert.equal(service.stats().peers,1);
    await Promise.all([service.close(),service.close()]);assert.equal(service.stats().closed,true);
  }finally{client.close();await service.close();}
});
test('real IPv6 loopback Binding uses an IPv6 XOR-MAPPED-ADDRESS',async t=>{
  let service;try{service=await startStunService({hosts:['::1'],port:0});}catch(error){if(['EADDRNOTAVAIL','EAFNOSUPPORT'].includes(error.code)){t.skip('Host has no IPv6 loopback');return;}throw error;}
  const client=dgram.createSocket('udp6');try{
    await new Promise(resolve=>client.bind(0,'::1',resolve));const reply=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('IPv6 reply timeout')),1000);client.once('message',value=>{clearTimeout(timer);resolve(value);});});
    await new Promise((resolve,reject)=>client.send(request(),service.addresses[0].port,'::1',error=>error?reject(error):resolve()));const result=decode(await reply);
    assert.equal(result.family,2);assert.deepEqual(result.bytes,Buffer.from('00000000000000000000000000000001','hex'));assert.equal(result.port,client.address().port);
  }finally{client.close();await service.close();}
});
