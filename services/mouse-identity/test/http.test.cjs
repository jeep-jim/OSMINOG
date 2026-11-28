'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {randomBytes} = require('node:crypto');
const {createIdentityServer, SYNC_BODY_LIMIT} = require('../http.cjs');
const proof = require('../../../desktop/mouse-account-proof.cjs');
const {setup, device, register, PASSWORD, state} = require('./helpers.cjs');

async function server(t, options = {}) {
  const fixture = setup(t), listener = createIdentityServer({service: fixture.service, allowInsecureLoopback: true, ...options});
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); });
  fixture.port = listener.address().port; fixture.listener = listener;
  return fixture;
}
function request(f, method, route, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bytes = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const headers = {...(bytes ? {'Content-Type': 'application/json', 'Content-Length': String(bytes.length)} : {}), ...extraHeaders};
    const req = http.request({host: '127.0.0.1', port: f.port, method, path: route, headers}, res => {
      const chunks = [];
      res.on('data', data => chunks.push(data)); res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8'); let json;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        resolve({status: res.statusCode, headers: res.headers, json, text});
      });
    });
    req.on('error', reject); req.end(bytes);
  });
}
const bearer = session => ({Authorization: 'Bearer ' + session.accessToken});

test('actual HTTP registration, sync CAS, settings isolation and logout', async t => {
  const f = await server(t), dev = device();
  const begin = await request(f, 'POST', '/v1/accounts/challenge', {action: 'register', identity: dev.identity,
    encryptionKey: dev.encryptionKey, registrationId: randomBytes(32).toString('base64url'), profile: {name: 'Антон', avatarHash: null}});
  assert.equal(begin.status, 200); assert.equal(begin.json.accountId, null);
  const created = await request(f, 'POST', '/v1/accounts/register', {challengeId: begin.json.challengeId,
    signature: dev.sign(proof.authChallengeTranscript(begin.json)), password: PASSWORD, avatar: null});
  assert.equal(created.status, 200); assert.equal(created.json.account.id, 2);
  assert.equal(created.headers['cache-control'], 'no-store'); assert.equal(created.headers['x-content-type-options'], 'nosniff');
  const config = state();
  const written = await request(f, 'PUT', '/v1/accounts/sync', {revision: 0, state: config}, bearer(created.json));
  assert.equal(written.status, 200); assert.equal(written.json.revision, 1);
  const stamp = await request(f, 'GET', '/v1/accounts/sync/revision', undefined, bearer(created.json));
  assert.equal(stamp.status, 200); assert.deepEqual(Object.keys(stamp.json).sort(), ['revision', 'updatedAt']); assert.equal(stamp.json.revision, 1);
  const conflict = await request(f, 'PUT', '/v1/accounts/sync', {revision: 0, state: config}, bearer(created.json));
  assert.equal(conflict.status, 409); assert.equal(conflict.json.error, 'SYNC_CONFLICT'); assert.equal(conflict.json.state.preferences.theme, 'dark');
  assert.equal((await request(f, 'GET', '/v1/accounts/sync', undefined, bearer(created.json))).json.revision, 1);
  assert.equal((await request(f, 'POST', '/v1/accounts/logout', {}, bearer(created.json))).status, 200);
  assert.equal((await request(f, 'GET', '/v1/accounts/me', undefined, bearer(created.json))).status, 401);
});

test('revision polling stays under 100 bytes for a large workspace and requires the correct account session', async t => {
  const f = await server(t), a = await register(f), b = await register(f), large = state();
  large.bookmarks = Array.from({length: 1500}, (_, index) => ({id: 'large-' + index, url: 'https://example.com/' + index,
    title: 'x'.repeat(400), at: 1}));
  f.service.syncPut(f.service.authenticate(a.accessToken, f.context()), {revision: 0, state: large});
  const full = await request(f, 'GET', '/v1/accounts/sync', undefined, bearer(a)); assert.ok(Buffer.byteLength(full.text) > 500000);
  const revision = await request(f, 'GET', '/v1/accounts/sync/revision', undefined, bearer(a));
  assert.equal(revision.status, 200); assert.equal(revision.json.revision, 1); assert.ok(Buffer.byteLength(revision.text) < 100);
  const other = await request(f, 'GET', '/v1/accounts/sync/revision', undefined, bearer(b)); assert.equal(other.json.revision, 0);
  assert.equal((await request(f, 'GET', '/v1/accounts/sync/revision')).status, 401);
});

test('native-only origin policy, HTTPS proxy trust, route/query and header rejection', async t => {
  const f = await server(t, {allowInsecureLoopback: false, trustLoopbackProxy: true});
  assert.equal((await request(f, 'GET', '/health')).status, 200);
  assert.equal((await request(f, 'GET', '/v1/accounts/info')).json.error, 'HTTPS_REQUIRED');
  const proxy = {'X-Forwarded-Proto': 'https', 'X-Real-IP': '192.0.2.25'};
  const info = await request(f, 'GET', '/v1/accounts/info', undefined, proxy);
  assert.equal(info.status, 200); assert.equal(info.headers['strict-transport-security'], 'max-age=31536000');
  assert.equal((await request(f, 'GET', '/v1/accounts/info', undefined, {...proxy, Origin: 'https://evil.example'})).status, 403);
  assert.equal((await request(f, 'GET', '/v1/accounts/info', undefined, {...proxy, Origin: 'null'})).status, 403);
  assert.equal((await request(f, 'GET', '/v1/accounts/info', undefined, {...proxy, 'X-Forwarded-For': '1.2.3.4, 5.6.7.8'})).json.error, 'INVALID_PROXY');
  assert.equal((await request(f, 'GET', '/v1/accounts/info?access_token=never-accepted', undefined, proxy)).status, 404);
  assert.equal((await request(f, 'GET', '/v1/accounts/info', undefined, {...proxy, Host: 'attacker.example'})).status, 400);
  const publicNoProxy = await server(t);
  assert.equal((await request(publicNoProxy, 'GET', '/health', undefined, proxy)).json.error, 'INVALID_PROXY');
});

test('body caps, malformed JSON/UTF8, compressed requests and unknown sync fields fail closed while health stays live', async t => {
  const f = await server(t), a = await register(f);
  assert.equal((await request(f, 'POST', '/v1/accounts/challenge', 'x'.repeat(20000))).status, 413);
  assert.equal((await request(f, 'POST', '/v1/accounts/challenge', '{"broken":')).json.error, 'INVALID_JSON');
  assert.equal((await request(f, 'POST', '/v1/accounts/challenge', Buffer.from([123, 34, 120, 34, 58, 34, 0xc0, 0xaf, 34, 125]))).json.error, 'INVALID_JSON');
  assert.equal((await request(f, 'POST', '/v1/accounts/challenge', {}, {'Content-Encoding': 'gzip'})).status, 415);
  assert.equal((await request(f, 'POST', '/v1/accounts/challenge', {}, {'Content-Type': 'text/plain'})).status, 415);
  const giant = Buffer.alloc(SYNC_BODY_LIMIT + 1, 32);
  assert.equal((await request(f, 'PUT', '/v1/accounts/sync', giant, bearer(a))).status, 413);
  const bad = {...state(), screenshots: ['private screenshot']};
  const rejected = await request(f, 'PUT', '/v1/accounts/sync', {revision: 0, state: bad}, bearer(a));
  assert.equal(rejected.status, 400); assert.equal(rejected.json.error, 'SYNC_INVALID'); assert.equal(rejected.text.includes('private screenshot'), false);
  assert.equal((await request(f, 'GET', '/health')).status, 200);
});

test('async password load leaves health responsive and excessive challenge traffic receives bounded retry', async t => {
  const f = await server(t), a = await register(f), devices = [device(), device(), device()];
  const challenges = [];
  for (const dev of devices) {
    const result = await request(f, 'POST', '/v1/accounts/challenge', {action: 'login', identity: dev.identity, encryptionKey: dev.encryptionKey, accountId: a.account.id});
    assert.equal(result.status, 200); challenges.push(result.json);
  }
  let completed = 0;
  const pending = challenges.map((c, index) => request(f, 'POST', '/v1/accounts/login', {challengeId: c.challengeId,
    signature: devices[index].sign(proof.authChallengeTranscript(c)), password: PASSWORD}).then(result => { completed++; return result; }));
  const health = await request(f, 'GET', '/health'); assert.equal(health.status, 200); assert.ok(completed < 3);
  assert.ok((await Promise.all(pending)).every(value => value.status === 200));
  let last;
  for (let i = 0; i < 28; i++) last = await request(f, 'POST', '/v1/accounts/challenge', {action: 'login', identity: devices[0].identity,
    encryptionKey: devices[0].encryptionKey, accountId: a.account.id});
  assert.equal(last.status, 429); assert.equal(last.headers['retry-after'], '60');
  assert.equal((await request(f, 'GET', '/health')).status, 200);
});

module.exports = {request};
