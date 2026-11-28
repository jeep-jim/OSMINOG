'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createFlashBroker } = require('./mouse-flash-broker.cjs');
const C = require('../desktop/mouse-flash-crypto.js');

async function start(t, options = {}) {
  const broker = createFlashBroker(options), origin = await broker.listen();
  t.after(() => broker.close());
  async function request(method, path, { token, body, raw, headers = {} } = {}) {
    const response = await fetch(origin + path, { method, headers: {
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    ...(method === 'POST' ? { body: raw === undefined ? JSON.stringify(body === undefined ? {} : body) : raw } : {}) });
    return { status: response.status, data: response.status === 204 ? null : await response.json(), headers: response.headers };
  }
  async function room() { const result = await request('POST', '/v1/rooms'); assert.equal(result.status, 201); return result.data; }
  async function join(room) { const result = await request('POST', `/v1/rooms/${room.roomId}/join`, { token: room.joinToken }); assert.equal(result.status, 200); return result.data; }
  async function box(room, role = 'host', context) {
    context ||= { secret: C.randomId(32), roomId: room.roomId, attemptId: C.randomId() };
    return { context, box: await C.createSignalBox({ ...context, role }) };
  }
  return { broker, origin, request, room, join, box };
}
const path = room => `/v1/rooms/${room.roomId}/messages`;
function check(result, status, code) { assert.equal(result.status, status); if (code) assert.equal(result.data.error.code, code); }

test('actual encrypted HTTP rendezvous sends only opaque messages to the opposite role', async t => {
  const api = await start(t), room = await api.room();
  assert.equal(room.hostToken.length, 43); assert.equal(room.joinToken.length, 43); assert.notEqual(room.hostToken, room.joinToken);
  const host = await api.box(room), offer = await host.box.seal({ kind: 'offer', sdp: 'private-SDP', name: 'private-file-name' });
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: offer } }), 201);
  const before = await api.request('GET', path(room), { token: room.hostToken });
  assert.equal(before.data.peerJoined, false); assert.deepEqual(before.data.messages, []);
  const joined = await api.join(room), join = await api.box(room, 'join', host.context);
  assert.notEqual(joined.peerToken, room.joinToken);
  const incoming = await api.request('GET', path(room), { token: joined.peerToken });
  assert.equal(incoming.data.messages.length, 1);
  assert.ok(!JSON.stringify(incoming.data).includes('private-file-name'));
  assert.deepEqual(await join.box.open(incoming.data.messages[0].envelope), { kind: 'offer', sdp: 'private-SDP', name: 'private-file-name' });
  const answer = await join.box.seal({ kind: 'answer', sdp: 'other-private-SDP' });
  check(await api.request('POST', path(room), { token: joined.peerToken, body: { envelope: answer } }), 201);
  const received = await api.request('GET', path(room), { token: room.hostToken });
  assert.deepEqual(await host.box.open(received.data.messages[0].envelope), { kind: 'answer', sdp: 'other-private-SDP' });
  await api.request('GET', path(room) + '?after=' + incoming.data.cursor, { token: joined.peerToken });
  await api.request('GET', path(room) + '?after=' + received.data.cursor, { token: room.hostToken });
  assert.equal(api.broker.stats().queuedBytes, 0);
  assert.deepEqual(Object.keys(api.broker.stats()).sort(), ['queuedBytes', 'rateEntries', 'rooms']);
});

test('single-use invitation resists simultaneous second and third peer claims', async t => {
  const api = await start(t), room = await api.room(), endpoint = `/v1/rooms/${room.roomId}/join`;
  const claims = await Promise.all([api.request('POST', endpoint, { token: room.joinToken }), api.request('POST', endpoint, { token: room.joinToken })]);
  assert.deepEqual(claims.map(result => result.status).sort(), [200, 409]);
  assert.equal(claims.find(result => result.status === 409).data.error.code, 'ROOM_ALREADY_JOINED');
  check(await api.request('POST', endpoint, { token: room.joinToken }), 409, 'ROOM_ALREADY_JOINED');
  check(await api.request('POST', endpoint, { token: room.hostToken }), 401, 'UNAUTHORIZED');
});

test('host, invitation, peer and unrelated role capabilities cannot be substituted', async t => {
  const api = await start(t), room = await api.room(), joined = await api.join(room), host = await api.box(room);
  for (const token of [undefined, room.joinToken, C.randomId(32)]) check(await api.request('GET', path(room), { token }), 401, 'UNAUTHORIZED');
  const envelope = await host.box.seal({ kind: 'offer' });
  check(await api.request('POST', path(room), { token: joined.peerToken, body: { envelope } }), 403, 'ROLE_MISMATCH');
  const otherRoom = await api.room();
  check(await api.request('GET', path(otherRoom), { token: room.hostToken }), 401, 'UNAUTHORIZED');
});

test('broker rejects duplicate, reordered and other-attempt messages after acknowledgement too', async t => {
  const api = await start(t), room = await api.room(), joined = await api.join(room), host = await api.box(room);
  const one = await host.box.seal({ kind: 'offer' }), two = await host.box.seal({ kind: 'ice' });
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: two } }), 409, 'SEQUENCE_GAP');
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: one } }), 201);
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: one } }), 409, 'REPLAY');
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: { ...two, attemptId: C.randomId() } } }), 409, 'ATTEMPT_MISMATCH');
  const batch = await api.request('GET', path(room), { token: joined.peerToken });
  await api.request('GET', path(room) + '?after=' + batch.data.cursor, { token: joined.peerToken });
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: one } }), 409, 'REPLAY');
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: two } }), 201);
});

test('peer cannot skip unread signaling using an invented or other-role cursor', async t => {
  const api = await start(t), room = await api.room(), joined = await api.join(room), host = await api.box(room);
  const envelope = await host.box.seal({ kind: 'offer' });
  await api.request('POST', path(room), { token: room.hostToken, body: { envelope } });
  check(await api.request('GET', path(room) + '?after=1', { token: joined.peerToken }), 409, 'INVALID_CURSOR');
  const batch = await api.request('GET', path(room), { token: joined.peerToken }); assert.equal(batch.data.messages.length, 1);
  check(await api.request('GET', path(room) + '?after=1', { token: room.hostToken }), 409, 'INVALID_CURSOR');
  check(await api.request('GET', path(room) + '?after=1', { token: joined.peerToken }), 200);
  check(await api.request('GET', path(room), { token: joined.peerToken }), 409, 'INVALID_CURSOR');
  assert.equal(api.broker.stats().queuedBytes, 0);
});

test('queue backpressure does not consume sequence and capacity returns after peer ACK', async t => {
  const api = await start(t, { limits: { maxRoomQueuedMessages: 1 } });
  const room = await api.room(), joined = await api.join(room), host = await api.box(room);
  const one = await host.box.seal({ kind: 'offer' }), two = await host.box.seal({ kind: 'ice' });
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: one } }), 201);
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: two } }), 429, 'QUEUE_FULL');
  const batch = await api.request('GET', path(room), { token: joined.peerToken });
  await api.request('GET', path(room) + '?after=' + batch.data.cursor, { token: joined.peerToken });
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: two } }), 201);
});

test('aggregate process queue capacity is bounded across independent rooms', async t => {
  const api = await start(t, { limits: { maxTotalQueueBytes: 1024 } });
  const first = await api.room(), second = await api.room(), a = await api.box(first), b = await api.box(second);
  const one = await a.box.seal({ sdp: 'x'.repeat(300) }), two = await b.box.seal({ sdp: 'x'.repeat(300) });
  check(await api.request('POST', path(first), { token: first.hostToken, body: { envelope: one } }), 201);
  check(await api.request('POST', path(second), { token: second.hostToken, body: { envelope: two } }), 429, 'QUEUE_FULL');
  assert.ok(api.broker.stats().queuedBytes <= 1024);
  await api.request('DELETE', `/v1/rooms/${first.roomId}`, { token: first.hostToken });
  check(await api.request('POST', path(second), { token: second.hostToken, body: { envelope: two } }), 201);
});

test('TTL invalidates capabilities and room capacity recovers without a timer sleep', async t => {
  let now = 1000000;
  const api = await start(t, { now: () => now, ttlMs: 100, limits: { maxRooms: 1 } });
  const room = await api.room(); assert.equal(room.expiresAt, now + 100);
  check(await api.request('POST', '/v1/rooms'), 503, 'ROOM_CAPACITY');
  now += 99; check(await api.request('GET', path(room), { token: room.hostToken }), 200);
  now += 1; check(await api.request('GET', path(room), { token: room.hostToken }), 410, 'ROOM_EXPIRED');
  check(await api.request('POST', `/v1/rooms/${room.roomId}/join`, { token: room.joinToken }), 404, 'ROOM_UNAVAILABLE');
  await api.room(); assert.equal(api.broker.stats().rooms, 1);
});

test('either authenticated peer can abort; all role tokens and queued bytes then expire', async t => {
  const api = await start(t), room = await api.room(), joined = await api.join(room), host = await api.box(room);
  await api.request('POST', path(room), { token: room.hostToken, body: { envelope: await host.box.seal({ kind: 'offer' }) } });
  check(await api.request('DELETE', `/v1/rooms/${room.roomId}`, { token: room.joinToken }), 401, 'UNAUTHORIZED');
  check(await api.request('DELETE', `/v1/rooms/${room.roomId}`, { token: joined.peerToken }), 200);
  for (const token of [room.hostToken, joined.peerToken]) check(await api.request('GET', path(room), { token }), 404, 'ROOM_UNAVAILABLE');
  assert.equal(api.broker.stats().rooms, 0); assert.equal(api.broker.stats().queuedBytes, 0);
});

test('full 65536-byte authenticated SDP fits bounded broker request and polling response', async t => {
  const api = await start(t), room = await api.room(), joined = await api.join(room), host = await api.box(room), join = await api.box(room, 'join', host.context);
  const payload = { sdp: 'x'.repeat(65536 - Buffer.byteLength(JSON.stringify({ sdp: '' }))) };
  const envelope = await host.box.seal(payload);
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope } }), 201);
  const batch = await api.request('GET', path(room), { token: joined.peerToken });
  assert.deepEqual(await join.box.open(batch.data.messages[0].envelope), payload);
});

test('oversized declared and chunked bodies fail while ordinary requests remain usable', async t => {
  const api = await start(t, { limits: { maxBodyBytes: 128 } });
  check(await api.request('POST', '/v1/rooms', { raw: JSON.stringify({ x: 'x'.repeat(256) }) }), 413, 'BODY_TOO_LARGE');
  const chunked = await new Promise((resolve, reject) => {
    const request = http.request(api.origin + '/v1/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(body) })); response.on('error', reject);
    });
    request.on('error', reject); request.write('{"x":"' + 'x'.repeat(256)); request.write('x'.repeat(256)); request.end('"}');
  });
  check(chunked, 413, 'BODY_TOO_LARGE');
  await api.room(); assert.equal(api.broker.stats().rooms, 1);
});

test('request/create rates and per-attempt signal lifetime are finite', async t => {
  let now = 1000000;
  const api = await start(t, { now: () => now, limits: { maxCreatesPerWindow: 1, maxSignalsPerRole: 1 } });
  const room = await api.room();
  check(await api.request('POST', '/v1/rooms'), 429, 'RATE_LIMIT');
  now += 60001; await api.room();
  const host = await api.box(room);
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: await host.box.seal({ kind: 'offer' }) } }), 201);
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: await host.box.seal({ kind: 'ice' }) } }), 429, 'SIGNAL_LIMIT');
  const limited = await start(t, { limits: { maxRequestsPerWindow: 1 } });
  const limitedRoom = await limited.room();
  check(await limited.request('GET', path(limitedRoom), { token: limitedRoom.hostToken }), 429, 'RATE_LIMIT');
});

test('origin checks reject arbitrary pages and opaque origins; explicit trusted origin can preflight', async t => {
  const api = await start(t, { allowedOrigins: ['https://mouse.example'] });
  for (const origin of ['null', 'https://untrusted.example']) check(await api.request('POST', '/v1/rooms', { headers: { Origin: origin } }), 403, 'ORIGIN_REJECTED');
  const preflight = await api.request('OPTIONS', '/v1/rooms', { headers: { Origin: 'https://mouse.example' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://mouse.example');
  assert.throws(() => createFlashBroker({ allowedOrigins: ['*'] }));
  assert.throws(() => createFlashBroker({ allowedOrigins: ['null'] }));
  await assert.rejects(api.broker.listen({ host: '0.0.0.0' }), /loopback/);
});

test('plaintext fields, unknown routes and query credentials are not accepted or echoed', async t => {
  const api = await start(t), secret = 'sensitive-file-name.txt';
  const invalid = await api.request('POST', '/v1/rooms', { body: { filename: secret } });
  check(invalid, 400, 'INVALID_BODY'); assert.ok(!JSON.stringify(invalid.data).includes(secret));
  check(await api.request('POST', '/v1/files', { body: { bytes: secret } }), 404, 'NOT_FOUND');
  const room = await api.room();
  check(await api.request('GET', path(room) + '?token=' + room.hostToken), 401, 'UNAUTHORIZED');
  check(await api.request('POST', path(room), { token: room.hostToken, body: { envelope: {}, filename: secret } }), 400, 'INVALID_BODY');
  check(await api.request('POST', '/v1/rooms', { headers: { 'Content-Type': 'text/plain' } }), 415, 'CONTENT_TYPE');
});
