'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFlashBroker } = require('../tools/mouse-flash-broker.cjs');
const { NativeSignalClient, MAX_RESPONSE_BYTES } = require('./mouse-flash-signaling.cjs');
const C = require('./mouse-flash-crypto.js');

const code = expected => error => error && error.code === expected;
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const roomResponse = () => ({ v: 1, roomId: C.randomId(), hostToken: C.randomId(32), joinToken: C.randomId(32), expiresAt: Date.now() + 600000 });
async function real(t) {
  const broker = createFlashBroker(), origin = await broker.listen(), wire = [], secretTokens = [];
  const fetchImpl = async (url, options) => {
    wire.push({ url, method: options.method, authorization: options.headers.Authorization, body: options.body, redirect: options.redirect });
    const reply = await fetch(url, options);
    if ((options.method === 'POST' && url.endsWith('/v1/rooms')) || url.endsWith('/join')) {
      const copy = await reply.clone().json();
      if (copy.hostToken) secretTokens.push(copy.hostToken);
      if (copy.peerToken) secretTokens.push(copy.peerToken);
    }
    return reply;
  };
  const host = new NativeSignalClient({ broker: origin, allowLoopback: true, fetchImpl });
  const join = new NativeSignalClient({ broker: origin, allowLoopback: true, fetchImpl });
  t.after(async () => { await Promise.all([host.dispose(), join.dispose()]); await broker.close(); });
  return { broker, origin, wire, secretTokens, host, join };
}

test('native proxy and actual broker deliver encrypted signaling without exposing role bearers', async t => {
  const fixture = await real(t), created = await fixture.host.call({ operation: 'create' });
  assert.deepEqual(Object.keys(created).sort(), ['broker', 'expiresAt', 'joinToken', 'role', 'roomId', 'signalId']);
  const invitation = C.createInvite(created), parsed = C.parseInvite(invitation.text);
  const joined = await fixture.join.call({ operation: 'join', broker: parsed.broker, roomId: parsed.roomId, joinToken: parsed.joinToken });
  assert.deepEqual(Object.keys(joined).sort(), ['broker', 'expiresAt', 'role', 'roomId', 'signalId']);
  assert.equal(created.role, 'host'); assert.equal(joined.role, 'join');
  for (const token of fixture.secretTokens) assert.ok(!JSON.stringify([created, joined, fixture.host, fixture.join]).includes(token));
  const hostBox = await C.createSignalBox({ ...parsed, role: 'host' }), joinBox = await C.createSignalBox({ ...parsed, role: 'join' });
  const offer = { kind: 'offer', sdp: 'v=0\r\na=fingerprint:sha-256 protected-offer\r\n' };
  const sent = await fixture.host.call({ operation: 'send', signalId: created.signalId, envelope: await hostBox.seal(offer) });
  assert.equal(sent.cursor, 1);
  const received = await fixture.join.call({ operation: 'poll', signalId: joined.signalId, after: 0 });
  assert.deepEqual(await joinBox.open(received.messages[0].envelope), offer);
  const answer = { kind: 'answer', sdp: 'v=0\r\na=fingerprint:sha-256 protected-answer\r\n' };
  await fixture.join.call({ operation: 'send', signalId: joined.signalId, envelope: await joinBox.seal(answer) });
  const incoming = await fixture.host.call({ operation: 'poll', signalId: created.signalId, after: 0 });
  assert.deepEqual(await hostBox.open(incoming.messages[0].envelope), answer);
  await fixture.join.call({ operation: 'poll', signalId: joined.signalId, after: received.cursor });
  await fixture.host.call({ operation: 'poll', signalId: created.signalId, after: incoming.cursor });
  assert.equal(fixture.broker.stats().queuedBytes, 0);
  const requests = JSON.stringify(fixture.wire);
  assert.ok(!requests.includes(parsed.secret)); assert.ok(!requests.includes(offer.sdp));
  assert.ok(fixture.wire.every(call => call.redirect === 'manual' && !call.url.includes('Token') && !call.url.includes('token')));
  await assert.rejects(fixture.join.call({ operation: 'poll', signalId: created.signalId }), code('SIGNAL_SESSION'));
});

test('native proxy rejects wrong invitation endpoint before any network call', async () => {
  let calls = 0;
  const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async () => { calls++; return response({}); } });
  for (const broker of ['https://other.example', 'https://broker.example/another', 'https://u:p@broker.example',
    'https://broker.example/?token=secret', 'https://broker.example/#secret', 'http://127.0.0.1:8787']) {
    await assert.rejects(client.call({ operation: 'join', broker, roomId: C.randomId(), joinToken: C.randomId(32) }), code('BROKER_MISMATCH'));
  }
  assert.equal(calls, 0);
});

test('no default production endpoint and no implicit insecure or arbitrary local broker', async () => {
  let calls = 0;
  const offline = new NativeSignalClient({ fetchImpl: async () => { calls++; throw new Error('must not fetch'); } });
  await assert.rejects(offline.call({ operation: 'create' }), code('SIGNAL_OFFLINE')); assert.equal(calls, 0);
  for (const broker of ['http://127.0.0.1:8787', 'http://broker.example', 'https://broker.example/path',
    'https://name:secret@broker.example', 'https://broker.example/#secret']) {
    assert.throws(() => new NativeSignalClient({ broker }), code('BROKER_CONFIG'));
  }
  for (const broker of ['http://localhost:8787', 'http://192.168.1.1:8787', 'http://[::1]:8787']) {
    assert.throws(() => new NativeSignalClient({ broker, allowLoopback: true }), code('BROKER_CONFIG'));
  }
});

test('outbound role, room and unexpected plaintext fields are rejected before broker send', async t => {
  const fixture = await real(t), created = await fixture.host.call({ operation: 'create' }), invitation = C.createInvite(created);
  const box = await C.createSignalBox({ ...invitation, role: 'host' }), envelope = await box.seal({ kind: 'offer' });
  const count = fixture.wire.length;
  for (const changed of [{ ...envelope, roomId: C.randomId() }, { ...envelope, fromRole: 'join' }, { ...envelope, plaintext: 'private' }]) {
    await assert.rejects(fixture.host.call({ operation: 'send', signalId: created.signalId, envelope: changed }), code('SIGNAL_INPUT'));
  }
  await assert.rejects(fixture.host.call({ operation: 'send', signalId: created.signalId, envelope, filename: 'private' }), code('SIGNAL_INPUT'));
  assert.equal(fixture.wire.length, count);
});

test('HTTP and followed-response redirects fail closed without fetching their target', async () => {
  for (const status of [301, 302, 307, 308]) {
    let calls = 0;
    const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async (_, options) => {
      calls++; assert.equal(options.redirect, 'manual'); return response({}, status, { Location: 'https://elsewhere.example' });
    } });
    await assert.rejects(client.call({ operation: 'create' }), code('BROKER_REDIRECT')); assert.equal(calls, 1);
  }
  const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async () => {
    const redirected = response(roomResponse()); Object.defineProperty(redirected, 'redirected', { value: true }); return redirected;
  } });
  await assert.rejects(client.call({ operation: 'create' }), code('BROKER_REDIRECT'));
});

test('malformed, non-JSON, extra-field and expired create responses never expose tokens', async () => {
  const valid = roomResponse();
  const replies = [() => new Response('<html>private</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    () => response({ ...valid, hostToken: 'wrong' }), () => response({ ...valid, extra: valid.hostToken }),
    () => response({ ...valid, expiresAt: Date.now() - 1 }), () => response({ ...valid, expiresAt: Date.now() + 86400000 })];
  for (const reply of replies) {
    const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async () => reply() });
    await assert.rejects(client.call({ operation: 'create' }), error => {
      assert.equal(error.code, 'BROKER_RESPONSE'); assert.ok(!String(error).includes(valid.hostToken)); return true;
    });
  }
});

test('declared and streamed JSON/error bodies are bounded and cancelled', async () => {
  let cancelled = false;
  const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{}')); }, cancel() { cancelled = true; }
  }), { headers: { 'Content-Type': 'application/json', 'Content-Length': String(MAX_RESPONSE_BYTES + 1) } }) });
  await assert.rejects(client.call({ operation: 'create' }), code('BROKER_RESPONSE_TOO_LARGE')); assert.equal(cancelled, true);
  for (const status of [200, 401]) {
    const oversized = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async () => response({ error: 'x'.repeat(MAX_RESPONSE_BYTES) }, status) });
    await assert.rejects(oversized.call({ operation: 'create' }), code('BROKER_RESPONSE_TOO_LARGE'));
  }
});

test('broker error bodies and fetch errors cannot leak credentials through native errors', async () => {
  const sensitive = C.randomId(32);
  for (const fetchImpl of [async () => response({ error: { code: sensitive, message: sensitive, hostToken: sensitive } }, 401),
    async () => { throw new Error('request Authorization: Bearer ' + sensitive); }]) {
    const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl });
    await assert.rejects(client.call({ operation: 'create' }), error => {
      assert.ok(['BROKER_UNAUTHORIZED', 'SIGNAL_NETWORK'].includes(error.code)); assert.ok(!String(error).includes(sensitive));
      assert.equal(error.cause, undefined); return true;
    });
  }
});

test('deadlines cover an unresponsive fetch and a response body that never finishes', async () => {
  const hangingFetch = new NativeSignalClient({ broker: 'https://broker.example', timeoutMs: 20, fetchImpl: async () => new Promise(() => {}) });
  await assert.rejects(hangingFetch.call({ operation: 'create' }), code('SIGNAL_TIMEOUT'));
  let cancelled = false;
  const hangingBody = new NativeSignalClient({ broker: 'https://broker.example', timeoutMs: 20,
    fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(hangingBody.call({ operation: 'create' }), code('SIGNAL_TIMEOUT')); assert.equal(cancelled, true);
});

test('closing a session aborts a pending poll and permanently invalidates its local handle', async () => {
  const state = roomResponse(); let markStarted, pollSignal;
  const started = new Promise(resolve => { markStarted = resolve; });
  const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async (url, options) => {
    if (url.endsWith('/v1/rooms')) return response(state, 201);
    if (options.method === 'GET') { pollSignal = options.signal; markStarted(); return new Promise(() => {}); }
    assert.equal(options.method, 'DELETE'); return response({ v: 1, closed: true });
  } });
  const created = await client.call({ operation: 'create' });
  const rejected = assert.rejects(client.call({ operation: 'poll', signalId: created.signalId }), code('SIGNAL_ABORTED'));
  await started; assert.deepEqual(await client.call({ operation: 'close', signalId: created.signalId }), { closed: true }); await rejected;
  assert.equal(pollSignal.aborted, true);
  await assert.rejects(client.call({ operation: 'poll', signalId: created.signalId }), code('SIGNAL_SESSION'));
  assert.deepEqual(await client.call({ operation: 'close', signalId: created.signalId }), { closed: true });
});

test('poll response cannot inject role tokens, another room, a reflected role or invented cursor', async () => {
  const state = roomResponse(), secret = C.randomId(32), attemptId = C.randomId();
  const peer = await C.createSignalBox({ secret, roomId: state.roomId, attemptId, role: 'join' });
  const envelope = await peer.seal({ kind: 'answer' });
  const base = { v: 1, messages: [{ cursor: 1, envelope }], cursor: 1, peerJoined: true, expiresAt: state.expiresAt };
  for (const reply of [{ ...base, peerToken: C.randomId(32) }, { ...base, cursor: 99 },
    { ...base, messages: [{ cursor: 1, envelope: { ...envelope, roomId: C.randomId() } }] },
    { ...base, messages: [{ cursor: 1, envelope: { ...envelope, fromRole: 'host' } }] }]) {
    const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async url => response(url.endsWith('/v1/rooms') ? state : reply) });
    const created = await client.call({ operation: 'create' });
    await assert.rejects(client.call({ operation: 'poll', signalId: created.signalId }), code('BROKER_RESPONSE'));
  }
});

test('dispose aborts pending creation and leaves no reusable native client', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const client = new NativeSignalClient({ broker: 'https://broker.example', fetchImpl: async () => { started(); return new Promise(() => {}); } });
  const rejected = assert.rejects(client.call({ operation: 'create' }), code('SIGNAL_ABORTED'));
  await ready; await client.dispose(); await rejected;
  await assert.rejects(client.call({ operation: 'create' }), code('SIGNAL_ABORTED'));
});
