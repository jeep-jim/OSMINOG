'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomBytes, createCipheriv, createDecipheriv, generateKeyPairSync} = require('node:crypto');
const {MouseAccountClient, nativeJSON} = require('./mouse-account-client.cjs');
const {createIdentityServer} = require('../services/mouse-identity/http.cjs');
const {MouseConfigSync} = require('./mouse-config-sync.cjs');
const {setup, device, register, PASSWORD, state} = require('../services/mouse-identity/test/helpers.cjs');
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

test('normal logout receives the server revoke acknowledgment before onLogout disposes the native client', async t => {
  const f = await environment(t); let acknowledged = false, left = 0;
  const client = f.client('revoke-before-relaunch', {
    transport: async options => {
      const value = await nativeJSON(options);
      if (options.pathname.endsWith('/logout')) acknowledged = true;
      return value;
    },
    onLogout: async () => {
      assert.equal(acknowledged, true);
      assert.equal(f.service.get('SELECT count(*) AS count FROM sessions WHERE revoked_at IS NULL').count, 0);
      assert.equal(client.tokens, null); assert.equal(client.state().accountId, null);
      await assert.rejects(fs.stat(client.filename), error => error.code === 'ENOENT');
      left++; client.dispose();
    }
  });
  await create(client); await client.operation('ack-recovery');
  await client.logout(); assert.equal(left, 1); assert.equal(client.state().phase, 'guest');
});

test('logout invalidates an older login before waiting for the document and final-sync gate', async t => {
  const f = await environment(t), source = f.client('gate-source'); await create(source); await source.operation('ack-recovery');
  let arrived, gateEntered, releaseResponse, releaseGate, activated = 0, left = 0;
  const responseReady = new Promise(resolve => { arrived = resolve; }), gateReady = new Promise(resolve => { gateEntered = resolve; });
  const client = f.client('gate-race', {
    transport: async options => {
      const value = await nativeJSON(options);
      if (options.pathname.endsWith('/login')) { arrived(); await new Promise(resolve => { releaseResponse = resolve; }); }
      return value;
    },
    beforeLogout: async () => { gateEntered(); await new Promise(resolve => { releaseGate = resolve; }); },
    onActivate: async () => { activated++; }, onLogout: async () => { left++; }
  });
  const loggingIn = client.operation('login', {accountId: 2, password: PASSWORD});
  const rejected = assert.rejects(loggingIn, code('ACCOUNT_CANCELLED'));
  await responseReady; const loggingOut = client.logout(); await gateReady;
  releaseResponse(); await rejected;
  assert.equal(activated, 0); assert.equal(left, 0); assert.equal(client.tokens, null);
  releaseGate(); await loggingOut;
  assert.equal(activated, 0); assert.equal(left, 1); assert.equal(client.state().phase, 'guest');
  await assert.rejects(fs.stat(client.filename), error => error.code === 'ENOENT');
});

test('an unresponsive logout transport cannot delay guest transition beyond the revoke deadline or retain local credentials', async t => {
  const f = await environment(t); let arrived, release, left = 0, signal;
  const reached = new Promise(resolve => { arrived = resolve; });
  const client = f.client('bounded-revoke', {onLogout: async () => { left++; client.dispose(); }});
  await create(client); await client.operation('ack-recovery');
  // Deliberately ignore abort as a faulty/offline transport might; the native
  // client still owns the upper bound and never waits for it before clearing.
  client.transport = options => { signal = options.signal; arrived(); return new Promise(resolve => { release = resolve; }); };
  const started = performance.now(), pending = client.logout(); await reached;
  assert.equal(client.tokens, null); assert.equal(client.state().accountId, null); assert.equal(left, 0);
  await assert.rejects(fs.stat(client.filename), error => error.code === 'ENOENT');
  await pending;
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 2000 && elapsed < 5000, `logout deadline: ${Math.round(elapsed)} ms`);
  assert.equal(signal.aborted, true); assert.equal(left, 1); assert.equal(client.state().phase, 'guest');
  // No ACK is claimed for an offline server; its old token expires normally.
  assert.equal(f.service.get('SELECT count(*) AS count FROM sessions WHERE revoked_at IS NULL').count, 1);
  release({ok: true}); await new Promise(resolve => setImmediate(resolve));
});

test('durable sign-out intent prevents restoration when real filesystem permissions leave an old protected session behind', {skip: process.getuid?.() === 0}, async t => {
  const f = await environment(t); let left = 0;
  const client = f.client('retained-session', {onLogout: async () => { left++; }});
  await create(client); await client.operation('ack-recovery');
  const saved = await fs.readFile(client.filename, 'utf8'), serialize = client.serializeStorage.bind(client); let fence = true;
  // The intent reaches disk, then the directory becomes read-only before the
  // actual unlink. This produces EACCES from the filesystem, not a mocked error.
  client.serializeStorage = callback => serialize(async () => { const value = await callback(); if (fence) { fence = false; await fs.chmod(client.directory, 0o500); } return value; });
  client.transport = async () => { throw Object.assign(Error('offline'), {code: 'ACCOUNT_NETWORK'}); };
  try {
    await assert.rejects(client.logout(), code('ACCOUNT_STORAGE'));
    assert.equal(left, 1); assert.equal(client.state().phase, 'guest');
    assert.equal(await fs.readFile(client.filename, 'utf8'), saved); assert.ok(await fs.stat(client.signoutFile));
    assert.equal(f.service.get('SELECT count(*) AS count FROM sessions WHERE revoked_at IS NULL').count, 1);
  } finally { await fs.chmod(client.directory, 0o700); }
  client.dispose(); const reopened = f.client('retained-session'); await reopened.ready;
  assert.equal(reopened.state().phase, 'guest'); assert.equal(reopened.state().accountId, null); assert.equal(reopened.tokens, null);
  await assert.rejects(reopened.restore().then(() => reopened.request('GET', '/me')), code('AUTH_REQUIRED'));
  // Only successful explicit password authentication replaces the protected
  // session and then durably removes the intent. Ordinary restart works again.
  await reopened.operation('login', {accountId: 2, password: PASSWORD});
  await assert.rejects(fs.stat(reopened.signoutFile), error => error.code === 'ENOENT');
  reopened.dispose(); const authenticated = f.client('retained-session'); await authenticated.ready;
  assert.equal(authenticated.snapshot().accountId, 2);
});

test('logout is explicitly blocked without relaunch when both intent and session deletion fail on the real filesystem', {skip: process.getuid?.() === 0}, async t => {
  const f = await environment(t); let left = 0;
  const client = f.client('blocked-signout', {onLogout: async () => { left++; }});
  await create(client); await client.operation('ack-recovery');
  const saved = await fs.readFile(client.filename, 'utf8'), token = client.tokens.accessToken;
  await fs.chmod(client.directory, 0o500);
  try {
    await assert.rejects(client.logout(), code('ACCOUNT_SIGNOUT_BLOCKED'));
    assert.equal(left, 0); assert.equal(client.state().phase, 'authenticated'); assert.equal(client.snapshot().accountId, 2);
    assert.equal(client.tokens.accessToken, token); assert.equal(await fs.readFile(client.filename, 'utf8'), saved);
  } finally { await fs.chmod(client.directory, 0o700); }
  assert.equal((await client.request('GET', '/me')).account.id, 2);
});

test('a genuine server certificate for another account on the same device cannot replace the active profile', async t => {
  const f = await environment(t), client = f.client('bound-profile'); await create(client); await client.operation('ack-recovery');
  const identity = await client.getIdentity();
  const other = await register(f, {...identity, sign: hash => identity.sign(hash).signature});
  assert.equal(other.account.id, 3); assert.equal(other.certificate.claims.deviceId, client.record.certificate.claims.deviceId);
  const saved = await fs.readFile(client.filename, 'utf8'), token = client.tokens.accessToken;
  client.transport = options => options.pathname.endsWith('/profile')
    ? Promise.resolve({account: other.account, certificate: other.certificate}) : nativeJSON(options);
  await assert.rejects(client.updateProfile({name: 'Изменение имени', avatar: null}), code('ACCOUNT_PROOF_INVALID'));
  assert.equal(client.snapshot().accountId, 2); assert.equal(client.tokens.accessToken, token);
  assert.equal(await fs.readFile(client.filename, 'utf8'), saved);
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

test('native-only cold Touch ID unlock validates and refreshes without triggering a profile switch', async t => {
  const f = await environment(t), entries = new Map(); let reads = 0, activated = 0;
  const keychain = {reason: '', available: () => true, put: async (id, value) => entries.set(id, value),
    get: async id => { reads++; return entries.get(id); }, remove: async id => entries.delete(id)};
  const first = f.client('cold-touch', {keychain}); await create(first); await first.operation('ack-recovery');
  await first.operation('set-touch-id', {enabled: true}); first.dispose();
  const reopened = f.client('cold-touch', {keychain, onActivate: async () => { activated++; }}); await reopened.ready;
  assert.equal(reopened.state().phase, 'locked'); assert.equal(reopened.tokens, null); assert.equal(reads, 0);
  await reopened.unlockStoredSession(); assert.equal(reads, 1); assert.equal(activated, 0); assert.equal(reopened.snapshot().accountId, 2);
  assert.equal(reopened.state().touchIdReason, '');
  await assert.rejects(reopened.operation('unlockStoredSession'), code('ACCOUNT_ACTION'));
});

test('expected account pin rejects a request before network and stopping sync does not cancel another account request', async t => {
  const f = await environment(t), client = f.client('scoped'); await create(client); await client.operation('ack-recovery');
  let calls = 0, arrived;
  const reached = new Promise(resolve => { arrived = resolve; });
  client.transport = options => {
    calls++;
    if (options.pathname.endsWith('/sync/revision')) {
      arrived(); return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(Error('test cancel'), {code: 'ACCOUNT_CANCELLED'})), {once: true}));
    }
    return nativeJSON(options);
  };
  await assert.rejects(client.request('GET', '/sync', undefined, {expectedAccountId: 3}), code('ACCOUNT_CANCELLED')); assert.equal(calls, 0);
  const {Store} = require('./storage.cjs'), sync = new MouseConfigSync({store: new Store(path.join(f.directory, 'workspace')), account: client});
  const pending = sync.tick(); await reached;
  const independent = client.request('GET', '/me'); await sync.stop(); await pending;
  assert.equal((await independent).account.id, 2); assert.equal(client.state().phase, 'authenticated'); assert.equal(sync.state().phase, 'idle');
});

test('a protected unlock completed after logout cannot restore credentials', async t => {
  const f = await environment(t); let saved, release, arrived;
  const reached = new Promise(resolve => { arrived = resolve; });
  const keychain = {available: () => true, put: async (_id, value) => { saved = value; }, remove: async () => {},
    get: async () => { const value = saved; arrived(); await new Promise(resolve => { release = resolve; }); return value; }};
  const first = f.client('unlock-race', {keychain}); await create(first); await first.operation('ack-recovery'); await first.operation('set-touch-id', {enabled: true}); first.dispose();
  const reopened = f.client('unlock-race', {keychain}); await reopened.ready;
  const pending = reopened.unlockStoredSession(), rejected = assert.rejects(pending, code('ACCOUNT_CANCELLED'));
  await reached; await reopened.logout(); release(); await rejected;
  assert.equal(reopened.tokens, null); assert.equal(reopened.state().phase, 'guest'); assert.equal(reopened.state().accountId, null);
});
