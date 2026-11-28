'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const C = require('./mouse-flash-crypto.js');

const context = () => ({ secret: C.randomId(32), roomId: C.randomId(), attemptId: C.randomId() });
const rejectCode = code => error => error && error.code === code;
async function peers(input = context()) {
  const [host, join] = await Promise.all(['host', 'join'].map(role => C.createSignalBox({ ...input, role })));
  return { input, host, join };
}
function flip64(value) { const bytes = Buffer.from(value, 'base64url'); bytes[0] ^= 1; return bytes.toString('base64url'); }
function encodeInvite(value) { return 'mouse-flash://join#' + Buffer.from(JSON.stringify(value)).toString('base64url'); }

test('invitation has separate strong room, role, secret and attempt capabilities', () => {
  const now = 1000000;
  const invitation = C.createInvite({ broker: 'http://127.0.0.1:8787/', roomId: C.randomId(),
    joinToken: C.randomId(32), expiresAt: now + 1800000 }, { now });
  assert.deepEqual(C.parseInvite(invitation.text, { now }), invitation);
  assert.equal(Buffer.from(invitation.secret, 'base64url').length, 32);
  assert.equal(Buffer.from(invitation.attemptId, 'base64url').length, 16);
  assert.notEqual(invitation.secret, invitation.joinToken);
  assert.equal(invitation.broker, 'http://127.0.0.1:8787');
  assert.match(invitation.text, /^mouse-flash:\/\/join#[A-Za-z0-9_-]+$/);
});

test('invitation rejects expiry, extra fields, malformed encoding and long leases', () => {
  const now = 1000000;
  const invitation = C.createInvite({ broker: 'https://broker.example', roomId: C.randomId(),
    joinToken: C.randomId(32), expiresAt: now + 100 }, { now });
  assert.throws(() => C.parseInvite(invitation.text, { now: now + 100 }), rejectCode('INVITE_EXPIRED'));
  const { text, ...data } = invitation;
  assert.throws(() => C.parseInvite(encodeInvite({ ...data, path: '/private-file' }), { now }), rejectCode('INVALID_FORMAT'));
  assert.throws(() => C.parseInvite(text + '=', { now }), rejectCode('INVALID_FORMAT'));
  assert.throws(() => C.parseInvite(encodeInvite({ ...data, expiresAt: now + 1900000 }), { now }), rejectCode('INVALID_FORMAT'));
  assert.throws(() => C.parseInvite('https://broker.example/#secret', { now }), rejectCode('INVALID_FORMAT'));
});

test('broker URL is only an HTTPS origin or explicit HTTP loopback', () => {
  for (const address of ['http://broker.example', 'http://192.168.1.1:8787', 'https://u:p@broker.example',
    'https://broker.example/path', 'https://broker.example/?x=1', 'https://broker.example/#secret', 'file:///tmp/broker']) {
    assert.throws(() => C.normalizeBrokerURL(address), rejectCode('BROKER_URL'), address);
  }
  assert.equal(C.normalizeBrokerURL('https://BROKER.example:443/'), 'https://broker.example');
  assert.equal(C.normalizeBrokerURL('http://[::1]:8787'), 'http://[::1]:8787');
});

test('encrypted bidirectional signaling round-trips and hides plaintext metadata', async () => {
  const { input, host, join } = await peers();
  const offer = { kind: 'offer', sdp: 'v=0\r\na=fingerprint:sha-256 HOST-TEST\r\n', privateName: 'never-on-broker.txt' };
  const envelope = await host.seal(offer);
  assert.deepEqual(await join.open(envelope), offer);
  assert.equal(envelope.seq, 1);
  for (const secret of [offer.sdp, offer.privateName, input.secret]) assert.ok(!JSON.stringify(envelope).includes(secret));
  const answer = { kind: 'answer', sdp: 'v=0\r\na=fingerprint:sha-256 JOIN-TEST\r\n' };
  assert.deepEqual(await host.open(await join.seal(answer)), answer);
});

test('wrong invitation secret cannot authenticate a valid envelope', async () => {
  const { input, host } = await peers();
  const wrong = await C.createSignalBox({ ...input, secret: C.randomId(32), role: 'join' });
  await assert.rejects(wrong.open(await host.seal({ kind: 'offer' })), rejectCode('AUTH_FAILED'));
});

test('room, attempt, direction and unexpected envelope fields fail closed', async () => {
  const { input, host, join } = await peers();
  const envelope = await host.seal({ kind: 'offer' });
  await assert.rejects(join.open({ ...envelope, roomId: C.randomId() }), rejectCode('CONTEXT_MISMATCH'));
  await assert.rejects(join.open({ ...envelope, attemptId: C.randomId() }), rejectCode('CONTEXT_MISMATCH'));
  await assert.rejects(join.open({ ...envelope, fromRole: 'join' }), rejectCode('ROLE_MISMATCH'));
  await assert.rejects(join.open({ ...envelope, plaintext: 'injected' }), rejectCode('INVALID_FORMAT'));
  const reflected = await C.createSignalBox({ ...input, role: 'host' });
  await assert.rejects(reflected.open({ ...envelope, fromRole: 'join' }), rejectCode('AUTH_FAILED'));
  assert.deepEqual(await join.open(envelope), { kind: 'offer' });
});

test('ciphertext and nonce tampering never advance receive sequence', async () => {
  const { host, join } = await peers();
  const envelope = await host.seal({ kind: 'offer' });
  await assert.rejects(join.open({ ...envelope, ciphertext: flip64(envelope.ciphertext) }), rejectCode('AUTH_FAILED'));
  await assert.rejects(join.open({ ...envelope, iv: flip64(envelope.iv) }), rejectCode('AUTH_FAILED'));
  assert.deepEqual(await join.open(envelope), { kind: 'offer' });
});

test('sequence is authenticated and replay/gaps do not consume the next valid message', async () => {
  const { host, join } = await peers();
  const one = await host.seal({ kind: 'offer' }), two = await host.seal({ kind: 'ice' });
  await assert.rejects(join.open(two), rejectCode('SEQUENCE_GAP'));
  await assert.rejects(join.open({ ...two, seq: 1 }), rejectCode('AUTH_FAILED'));
  assert.deepEqual(await join.open(one), { kind: 'offer' });
  await assert.rejects(join.open(one), rejectCode('REPLAY'));
  assert.deepEqual(await join.open(two), { kind: 'ice' });
});

test('concurrent crypto calls serialize counters and every message has a fresh nonce', async () => {
  const { host, join } = await peers();
  const messages = await Promise.all(Array.from({ length: 16 }, (_, index) => host.seal({ kind: 'ice', index })));
  assert.deepEqual(messages.map(message => message.seq), Array.from({ length: 16 }, (_, index) => index + 1));
  assert.equal(new Set(messages.map(message => message.iv)).size, 16);
  assert.deepEqual((await Promise.all(messages.map(message => join.open(message)))).map(value => value.index),
    Array.from({ length: 16 }, (_, index) => index));
});

test('65536-byte signaling boundary uses UTF-8 byte length and rejected size does not consume sequence', async () => {
  const { host, join } = await peers();
  const overhead = Buffer.byteLength(JSON.stringify({ sdp: '' }));
  const exact = { sdp: 'x'.repeat(C.MAX_SIGNAL_PLAINTEXT_BYTES - overhead) };
  await assert.rejects(host.seal({ sdp: exact.sdp + 'x' }), rejectCode('MESSAGE_TOO_LARGE'));
  await assert.rejects(host.seal({ sdp: 'я'.repeat(32768) }), rejectCode('MESSAGE_TOO_LARGE'));
  const envelope = await host.seal(exact);
  assert.equal(envelope.seq, 1);
  assert.equal(Buffer.from(envelope.ciphertext, 'base64url').length, 65536 + 16);
  assert.deepEqual(await join.open(envelope), exact);
});

test('confirmation binds full SDP, roles/device IDs, manifest, room, attempt and secret', async () => {
  const input = { ...context(), offer: 'v=0\r\na=fingerprint:sha-256 HOST\r\n',
    answer: 'v=0\r\na=fingerprint:sha-256 JOIN\r\n', hostDeviceId: 'host-key', joinDeviceId: 'join-key',
    manifestHash: 'a'.repeat(64) };
  const initial = await C.transcriptCode(input);
  assert.deepEqual(await C.transcriptCode(input), initial);
  assert.match(initial.code, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
  assert.match(initial.transcriptHash, /^[a-f0-9]{64}$/);
  for (const update of [{ offer: input.offer + 'x' }, { answer: input.answer + 'x' },
    { hostDeviceId: input.joinDeviceId, joinDeviceId: input.hostDeviceId }, { manifestHash: 'b'.repeat(64) },
    { roomId: C.randomId() }, { attemptId: C.randomId() }, { secret: C.randomId(32) }]) {
    assert.notEqual((await C.transcriptCode({ ...input, ...update })).code, initial.code);
  }
});

test('packaged browser build loads without require, Buffer, or remote scripts', () => {
  const sandbox = vm.createContext({ crypto: webcrypto, TextEncoder, TextDecoder, URL, btoa, atob });
  vm.runInContext(fs.readFileSync(require.resolve('./mouse-flash-crypto.js'), 'utf8'), sandbox);
  const output = vm.runInContext(`(() => {
    const C = MouseFlashCrypto;
    const invitation = C.createInvite({broker:'http://127.0.0.1:8787',roomId:C.randomId(),joinToken:C.randomId(32),expiresAt:1001000},{now:1000000});
    return C.parseInvite(invitation.text,{now:1000000}).roomId === invitation.roomId;
  })()`, sandbox);
  assert.equal(output, true);
});
