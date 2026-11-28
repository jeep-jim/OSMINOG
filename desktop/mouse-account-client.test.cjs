'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomBytes, createCipheriv, createDecipheriv, generateKeyPairSync} = require('node:crypto');
const {MouseAccountClient, nativeJSON} = require('./mouse-account-client.cjs');
const {createIdentityServer} = require('../services/mouse-identity/http.cjs');
const {setup, device, PASSWORD, state} = require('../services/mouse-identity/test/helpers.cjs');
const code = expected => error => error.code === expected;

async function environment(t) {
  const f = setup(t), server = createIdentityServer({service: f.service, allowInsecureLoopback: true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const key = randomBytes(32), devices = new Map(), clients = [];
  const protect = async value => {
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
  };
  const unprotect = async value => {
    const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
  };
  f.client = (name, options = {}) => {
    if (!devices.has(name)) devices.set(name, device(name));
    const dev = devices.get(name), identity = {...dev, sign: hash => ({signature: dev.sign(hash)})};
    const client = new MouseAccountClient({directory: path.join(f.directory, 'native-' + name), origin,
      serverPublicKey: f.service.serverPublicKey, getIdentity: async () => identity, protect, unprotect,
      allowLoopback: true, now: () => f.clock.value, ...options}); clients.push(client); return client;
  };
  f.protect = protect; f.unprotect = unprotect;
  t.after(async () => { for (const client of clients) client.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); key.fill(0); });
  return f;
}
async function create(client, extra = {}) {
  return client.operation('register', {name: 'Антон', password: PASSWORD, ...extra}, {avatar: null});
}

test('native client registers, stores only protected secrets, restores and syncs on another device, then logs out', async t => {
  const f = await environment(t), activated = [], exited = [], first = f.client('first', {onActivate: async id => activated.push(id), onLogout: async () => exited.push('guest')});
  const result = await create(first); assert.equal(result.state.accountId, 2); assert.equal(result.state.recoveryPending, true);
  assert.equal(activated.length, 0); const stored = await fs.readFile(first.filename, 'utf8');
  for (const secret of [PASSWORD, first.tokens.accessToken, first.tokens.refreshToken, result.recoveryKey]) assert.equal(stored.includes(secret), false);
  await first.operation('ack-recovery'); assert.deepEqual(activated, [2]);
  const pushed = await first.request('PUT', '/sync', {revision: 0, state: state()}); assert.equal(pushed.revision, 1);
  const second = f.client('second'); await second.operation('login', {accountId: 2, password: PASSWORD});
  assert.equal(second.state().accountId, 2); assert.equal((await second.request('GET', '/sync')).state.preferences.theme, 'dark');
  first.dispose(); const reopened = f.client('first', {onLogout: async () => exited.push('guest')}); await reopened.ready;
  assert.equal(reopened.state().phase, 'authenticated'); await reopened.restore();
  assert.equal((await reopened.request('GET', '/devices')).devices.length, 2);
  await reopened.logout(); assert.equal(reopened.state().phase, 'guest'); assert.equal(reopened.state().accountId, null);
  await assert.rejects(fs.stat(reopened.filename), error => error.code === 'ENOENT'); assert.equal(exited.length, 1);
  assert.equal((await second.request('GET', '/me')).account.id, 2);
});

test('native registration retry after a lost response reuses the durable pending registrationId', async t => {
  const f = await environment(t); let lose = true;
  const first = f.client('retry', {transport: async options => {
    const value = await nativeJSON(options);
    if (lose && options.pathname.endsWith('/register')) { lose = false; throw Object.assign(new Error('Lost test response'), {code: 'ACCOUNT_NETWORK'}); }
    return value;
  }});
  await assert.rejects(create(first), code('ACCOUNT_NETWORK'));
  const pending = JSON.parse(await fs.readFile(first.registrationFile, 'utf8')); assert.equal(pending.registrationId.length, 43);
  assert.equal(f.service.get('SELECT count(*) AS count FROM accounts').count, 2);
  first.dispose(); const resumed = f.client('retry'); const value = await create(resumed);
  assert.equal(value.state.accountId, 2); assert.equal(value.recoveryKey.length, 43);
  assert.equal(f.service.get('SELECT count(*) AS count FROM accounts').count, 2);
  await resumed.operation('ack-recovery'); await assert.rejects(fs.stat(resumed.registrationFile), error => error.code === 'ENOENT');
});

test('a valid thirty-day refresh survives expired access and a twenty-four-hour certificate on cold start', async t => {
  const f = await environment(t), first = f.client('expiry'); await create(first); await first.operation('ack-recovery');
  first.dispose(); f.clock.value += 25 * 60 * 60 * 1000;
  const reopened = f.client('expiry'); await reopened.ready;
  assert.equal(reopened.state().phase, 'locked'); assert.ok(reopened.tokens?.refreshToken);
  await reopened.restore(); assert.equal(reopened.state().phase, 'authenticated');
  assert.ok(reopened.snapshot().certificate.claims.expiresAt > f.clock.value);
});

test('pending recovery survives a cold restart only in encrypted storage and ack removes it before activating', async t => {
  const f = await environment(t), activated = [], first = f.client('backup');
  const created = await create(first), recoveryCode = created.recoveryKey;
  const before = JSON.parse(await fs.readFile(first.filename, 'utf8'));
  assert.equal(before.recoveryPending, true); assert.equal(JSON.stringify(before).includes(recoveryCode), false);
  assert.equal(JSON.parse(await f.unprotect(Buffer.from(before.ciphertext, 'base64'))).pendingRecoveryCode, recoveryCode);
  first.dispose(); const reopened = f.client('backup', {onActivate: async (id, options) => activated.push({id, ...options})});
  await reopened.ready; assert.equal(reopened.state().recoveryKey, recoveryCode); assert.equal(reopened.state().recoveryPending, true);
  await reopened.restore(); assert.equal(reopened.state().recoveryKey, recoveryCode);
  await reopened.operation('ack-recovery'); assert.deepEqual(activated, [{id: 2, registration: true}]);
  const after = JSON.parse(await fs.readFile(reopened.filename, 'utf8'));
  assert.equal(after.recoveryPending, false); assert.equal(JSON.parse(await f.unprotect(Buffer.from(after.ciphertext, 'base64'))).pendingRecoveryCode, undefined);
});

test('native recovery revokes old sessions and logging in to another Mouse ID exposes only that account settings', async t => {
  const f = await environment(t), a = f.client('a'), b = f.client('b');
  const original = await create(a); await a.operation('ack-recovery'); await a.request('PUT', '/sync', {revision: 0, state: state()});
  const recovered = await b.operation('recover', {accountId: 2, recoveryKey: original.recoveryKey, password: 'new private recovery mountain phrase'});
  assert.equal(recovered.state.accountId, 2); assert.notEqual(recovered.recoveryKey, original.recoveryKey);
  await b.operation('ack-recovery'); await assert.rejects(a.request('GET', '/me'), code('AUTH_REQUIRED'));
  await b.logout(); const other = await create(b); assert.equal(other.state.accountId, 3); await b.operation('ack-recovery');
  assert.equal((await b.request('GET', '/sync')).state, null);
  await b.logout(); await b.operation('login', {accountId: 2, password: 'new private recovery mountain phrase'});
  assert.equal((await b.request('GET', '/sync')).state.preferences.theme, 'dark');
});

test('certificate pin mismatch and edited local ID never become an authenticated or locked identity label', async t => {
  const f = await environment(t), first = f.client('signed'); await create(first); await first.operation('ack-recovery'); first.dispose();
  const record = JSON.parse(await fs.readFile(first.filename, 'utf8')); record.account.id = 1; await fs.writeFile(first.filename, JSON.stringify(record));
  const forged = f.client('signed'); await assert.rejects(forged.ready, code('ACCOUNT_PROOF_INVALID'));
  assert.equal(forged.state().accountId, null); assert.equal(forged.state().phase, 'guest');
  await forged.logout(); await assert.rejects(fs.stat(forged.filename), error => error.code === 'ENOENT');
  const alien = generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'der'}).toString('base64');
  const unpinned = f.client('unpinned', {serverPublicKey: alien});
  await assert.rejects(create(unpinned), code('ACCOUNT_PROOF_INVALID')); assert.equal(unpinned.state().accountId, null);
});

test('panel cancel does not discard a completed registration, but explicit logout prevents late credentials from returning', async t => {
  const f = await environment(t); let releaseResponse, arrived;
  const reached = new Promise(resolve => { arrived = resolve; });
  const client = f.client('panel', {transport: async options => {
    const value = await nativeJSON(options);
    if (options.pathname.endsWith('/register')) { arrived(); await new Promise(resolve => { releaseResponse = resolve; }); }
    return value;
  }});
  const registering = create(client); await reached; await client.operation('cancel'); releaseResponse();
  const pending = await registering; assert.equal(pending.state.recoveryPending, true); await client.operation('ack-recovery'); await client.logout();
  let releaseProtection, protectedEntered;
  const protectionStarted = new Promise(resolve => { protectedEntered = resolve; });
  const late = f.client('late', {protect: async value => { protectedEntered(); await new Promise(resolve => { releaseProtection = resolve; }); return f.protect(value); }});
  const completing = create(late); const cancelled = assert.rejects(completing, code('ACCOUNT_CANCELLED'));
  await protectionStarted; const logout = late.logout();
  await new Promise(resolve => setImmediate(resolve)); releaseProtection(); await logout; await cancelled;
  assert.equal(late.state().phase, 'guest'); assert.equal(late.state().accountId, null); assert.equal(late.tokens, null);
  await assert.rejects(fs.stat(late.filename), error => error.code === 'ENOENT');
});

test('beforeLogout may cancel without dropping auth; successful logout still changes profile when Keychain removal or network fails', async t => {
  const f = await environment(t); let allow = false, left = 0, secret;
  const keychain = {available: () => true, put: async (_id, value) => { secret = value; }, get: async () => secret,
    remove: async () => { throw Error('test entitlement denied'); }};
  const client = f.client('keychain', {keychain, beforeLogout: async () => allow, onLogout: async () => { left++; }});
  await create(client); await client.operation('ack-recovery'); await client.operation('set-touch-id', {enabled: true});
  await assert.rejects(client.logout(), code('ACCOUNT_CANCELLED')); assert.equal(client.state().phase, 'authenticated'); assert.equal(left, 0);
  allow = true; client.transport = async () => { throw Object.assign(Error('offline test'), {code: 'ACCOUNT_NETWORK'}); };
  await client.logout(); assert.equal(client.state().phase, 'guest'); assert.equal(client.state().accountId, null); assert.equal(left, 1);
  await assert.rejects(fs.stat(client.filename), error => error.code === 'ENOENT');
});

test('late profile responses cannot restore an account label or session after logout', async t => {
  const f = await environment(t); let arrived, release;
  const reached = new Promise(resolve => { arrived = resolve; });
  const client = f.client('profile-race', {transport: async options => {
    const value = await nativeJSON(options);
    if (options.pathname.endsWith('/profile')) { arrived(); await new Promise(resolve => { release = resolve; }); }
    return value;
  }});
  await create(client); await client.operation('ack-recovery');
  const changing = client.updateProfile({name: 'Поздний ответ', avatar: null}); const rejected = assert.rejects(changing, code('ACCOUNT_CANCELLED'));
  await reached; await client.logout(); release(); await rejected;
  assert.equal(client.state().accountId, null); assert.equal(client.state().phase, 'guest');
  await assert.rejects(fs.stat(client.filename), error => error.code === 'ENOENT');
});
