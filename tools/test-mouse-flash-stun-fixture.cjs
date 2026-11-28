'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {startStunFixture, createBindingResponse} = require('./mouse-flash-stun-fixture.cjs');
const COOKIE = 0x2112a442;
const sender = {family: 'IPv4', address: '192.0.2.1', port: 32853};

function request(attributes = Buffer.alloc(0), transaction = crypto.randomBytes(12)) {
  const bytes = Buffer.alloc(20 + attributes.length);
  bytes.writeUInt16BE(1); bytes.writeUInt16BE(attributes.length, 2);
  bytes.writeUInt32BE(COOKIE, 4); transaction.copy(bytes, 8); attributes.copy(bytes, 20);
  return bytes;
}
function attribute(type, data) {
  const bytes = Buffer.alloc(4 + ((data.length + 3) & ~3));
  bytes.writeUInt16BE(type); bytes.writeUInt16BE(data.length, 2); data.copy(bytes, 4);
  return bytes;
}
function mapped(response) {
  assert.equal(response.length, 40); assert.equal(response.readUInt16BE(0), 0x0101);
  assert.equal(response.readUInt16BE(2), 20); assert.equal(response.readUInt32BE(4), COOKIE);
  assert.equal(response.readUInt16BE(20), 0x0020); assert.equal(response.readUInt16BE(22), 8);
  assert.equal(response[24], 0); assert.equal(response[25], 1);
  const bytes = Buffer.alloc(4); bytes.writeUInt32BE((response.readUInt32BE(28) ^ COOKIE) >>> 0);
  assert.equal(response.readUInt16BE(32), 0x8028); assert.equal(response.readUInt16BE(34), 4);
  // Independent platform CRC implementation, not the fixture's algorithm.
  assert.equal(response.readUInt32BE(36), (zlib.crc32(response.subarray(0, 32)) ^ 0x5354554e) >>> 0);
  return {address: [...bytes].join('.'), port: response.readUInt16BE(26) ^ (COOKIE >>> 16)};
}

test('Binding response preserves transaction ID and encodes only the supplied UDP sender', () => {
  const transaction = Buffer.from('b7e7a701bc34d686fa87dfae', 'hex');
  const reply = createBindingResponse(request(undefined, transaction), sender);
  assert.deepEqual(reply.subarray(8, 20), transaction);
  assert.deepEqual(mapped(reply), {address: sender.address, port: sender.port});
  assert.equal(reply.subarray(26, 32).toString('hex'), 'a147e112a643');
  for (const address of ['127.0.0.1', '10.0.0.2', '255.1.2.3']) {
    assert.deepEqual(mapped(createBindingResponse(request(), {...sender, address, port: 65535})), {address, port: 65535});
  }
});

test('malformed headers, lengths, cookies, methods, TURN and non-STUN data have no response', () => {
  const original = request();
  const invalid = [Buffer.alloc(0), Buffer.alloc(19), Buffer.alloc(1025), 'not bytes', Buffer.from('file data'), Buffer.concat([original, Buffer.alloc(4)])];
  for (const type of [0x0003, 0x0004, 0x0006, 0x0016, 0x0101, 0x0111, 0x4001, 0x8001]) {
    const bytes = Buffer.from(original); bytes.writeUInt16BE(type); invalid.push(bytes);
  }
  for (const length of [1, 2, 3, 4, 65532]) { const bytes = Buffer.from(original); bytes.writeUInt16BE(length, 2); invalid.push(bytes); }
  for (const cookie of [0, COOKIE ^ 1, 0xffffffff]) { const bytes = Buffer.from(original); bytes.writeUInt32BE(cookie, 4); invalid.push(bytes); }
  for (const bytes of invalid) assert.equal(createBindingResponse(bytes, sender), null);
});

test('optional attributes are bounded, padded, ignored and never reflected; required attributes are rejected', () => {
  const software = attribute(0x8022, Buffer.from('private fixture'));
  const original = request(software);
  const reply = createBindingResponse(original, sender);
  assert.deepEqual(mapped(reply), {address: sender.address, port: sender.port});
  assert.equal(reply.includes(Buffer.from('private fixture')), false);
  const bad = Buffer.from(original); bad.writeUInt16BE(1000, 22);
  assert.equal(createBindingResponse(bad, sender), null);
  assert.equal(createBindingResponse(request(Buffer.concat([software, software])), sender), null);
  for (const type of [0x0003, 0x0006, 0x0008, 0x0009, 0x0012, 0x0024]) {
    assert.equal(createBindingResponse(request(attribute(type, Buffer.alloc(4))), sender), null);
  }
});

test('request FINGERPRINT must be valid and last; successful response has an independent valid CRC', () => {
  const bytes = request(attribute(0x8028, Buffer.alloc(4)));
  bytes.writeUInt32BE((zlib.crc32(bytes.subarray(0, 20)) ^ 0x5354554e) >>> 0, 24);
  assert.deepEqual(mapped(createBindingResponse(bytes, sender)), {address: sender.address, port: sender.port});
  const corrupted = Buffer.from(bytes); corrupted[24] ^= 1;
  assert.equal(createBindingResponse(corrupted, sender), null);
  const notLast = Buffer.concat([bytes, attribute(0x8022, Buffer.from('after'))]); notLast.writeUInt16BE(notLast.length - 20, 2);
  assert.equal(createBindingResponse(notLast, sender), null);
  assert.equal(createBindingResponse(request(attribute(0x8028, Buffer.alloc(3))), sender), null);
});

test('invalid or non-IPv4 sender metadata is rejected instead of inventing an address', () => {
  for (const value of [null, {}, {...sender, family: 'IPv6'}, {...sender, address: '::1'}, {...sender, address: '1.2.3.999'}, {...sender, port: 0}, {...sender, port: 65536}, {...sender, port: 1.5}]) {
    assert.equal(createBindingResponse(request(), value), null);
  }
});

test('actual UDP fixture returns observed socket address/port, drops invalid requests and closes idempotently', async () => {
  const fixture = await startStunFixture({host: '127.0.0.1', port: 0});
  const client = dgram.createSocket('udp4');
  try {
    assert.match(fixture.url, /^stun:127\.0\.0\.1:[1-9]\d*$/);
    const serverPort = Number(fixture.url.split(':')[2]);
    await new Promise(resolve => client.bind(0, '127.0.0.1', resolve));
    const received = [];
    client.on('message', (message, info) => received.push({message, info}));
    const valid = request(), invalid = Buffer.from(valid); invalid.writeUInt16BE(0x0003);
    await new Promise((resolve, reject) => client.send(invalid, serverPort, '127.0.0.1', error => error ? reject(error) : resolve()));
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(received.length, 0, 'TURN Allocate must not be answered');
    const reply = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('UDP fixture response timed out')), 1000);
      client.once('message', (message, info) => { clearTimeout(timer); resolve({message, info}); });
    });
    await new Promise((resolve, reject) => client.send(valid, serverPort, '127.0.0.1', error => error ? reject(error) : resolve()));
    const result = await reply;
    assert.deepEqual(mapped(result.message), {address: client.address().address, port: client.address().port});
    assert.deepEqual(result.message.subarray(8, 20), valid.subarray(8, 20));
    assert.equal(result.info.address, '127.0.0.1'); assert.equal(result.info.port, serverPort);
    await Promise.all([fixture.close(), fixture.close()]);
    await fixture.close();
  } finally { client.close(); await fixture.close(); }
});

test('fixture cannot bind publicly or accept invalid port configuration', async () => {
  for (const host of ['0.0.0.0', '::1', 'localhost', '192.0.2.1']) await assert.rejects(startStunFixture({host}), /loopback/);
  for (const port of [-1, 65536, 1.5, '3478']) await assert.rejects(startStunFixture({port}), /port/);
});
