'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {generateKeyPairSync, randomBytes} = require('node:crypto');
const {IdentityService, ACCESS_TTL_MS, REFRESH_TTL_MS} = require('../service.cjs');
const {PasswordHasher, passwordBytes} = require('../passwords.cjs');
const {RateLimiter} = require('../limits.cjs');
const proof = require('../../../desktop/mouse-account-proof.cjs');
const {setup, device, challenge, register, login, auth, state, PASSWORD} = require('./helpers.cjs');
const code = expected => error => error.code === expected;

test('SQLite reserves owner 1, persists ordinary IDs and hashed credentials across restart', async t => {
  const f = setup(t), a = await register(f), b = await register(f);
  assert.equal(a.account.id, 2); assert.equal(b.account.id, 3);
  assert.equal(a.recoveryCode.length, 43); assert.equal(a.certificate.claims.v, 2);
  const pinned = proof.verifyAccountCertificate({certificate: a.certificate, serverPublicKey: f.service.serverPublicKey, deviceId: a.dev.identity.deviceId});
  assert.equal(pinned.claims.encryptionKey, a.dev.encryptionKey);
  const db = f.service.db;
  const stored = db.prepare('SELECT * FROM accounts WHERE id=2').get();
  assert.equal(stored.password_hash.length, 32); assert.equal(stored.password_salt.length, 16);
  const session = db.prepare('SELECT * FROM sessions WHERE account_id=2').get();
  assert.notEqual(session.access_hash, a.accessToken); assert.notEqual(session.refresh_hash, a.refreshToken);
  const publicKey = f.service.serverPublicKey; f.reopen();
  assert.equal(f.service.serverPublicKey, publicKey); assert.equal(f.service.me(auth(f, a)).account.id, 2);
  assert.equal((await login(f, device(), 2)).account.id, 2);
  const raw = fs.readFileSync(path.join(f.directory, 'accounts.sqlite'));
  for (const secret of [PASSWORD, a.accessToken, a.refreshToken, a.recoveryCode, f.config.ownerBootstrapSecret]) assert.equal(raw.includes(Buffer.from(secret)), false);
  assert.equal(fs.statSync(f.directory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(f.directory, 'accounts.sqlite')).mode & 0o777, 0o600);
});

test('owner bootstrap needs device proof, burns failed challenges and cannot be reused', async t => {
  const f = setup(t), dev = device();
  const c = challenge(f.service, dev, 'claim-owner', {context: f.context()});
  const bad = {challengeId: c.challengeId, signature: c.signature, password: PASSWORD, avatar: null, ownerBootstrapSecret: randomBytes(32).toString('base64url')};
  await assert.rejects(f.service.register(bad, f.context(), {owner: true}), code('AUTH_FAILED'));
  await assert.rejects(f.service.register({...bad, ownerBootstrapSecret: f.config.ownerBootstrapSecret}, f.context(), {owner: true}), code('AUTH_FAILED'));
  const owner = await register(f, dev, {owner: true}); assert.equal(owner.account.id, 1);
  f.reopen();
  assert.equal(f.service.get("SELECT value FROM meta WHERE key='bootstrap_hash'"), undefined);
  await assert.rejects(register(f, device(), {owner: true}), code('AUTH_FAILED'));
  const signed = challenge(f.service, device(), 'register', {context: f.context()});
  await assert.rejects(f.service.register({challengeId: signed.challengeId, signature: signed.signature, password: PASSWORD, avatar: null, accountId: 1}, f.context()), code('INVALID_REQUEST'));
});

test('a lost registration response is retried by signed registrationId without duplicate account or plaintext recovery cache', async t => {
  const f = setup(t), dev = device(), registrationId = randomBytes(32).toString('base64url');
  async function attempt({owner = false, id = registrationId, password = PASSWORD, currentDevice = dev} = {}) {
    const c = challenge(f.service, currentDevice, owner ? 'claim-owner' : 'register', {registrationId: id, context: f.context()});
    return f.service.register({challengeId: c.challengeId, signature: c.signature, password, avatar: null,
      ...(owner ? {ownerBootstrapSecret: f.config.ownerBootstrapSecret} : {})}, f.context(), {owner});
  }
  const lost = await attempt(); f.reopen();
  const retried = await attempt();
  assert.equal(retried.account.id, lost.account.id); assert.notEqual(retried.recoveryCode, lost.recoveryCode);
  assert.equal(f.service.get('SELECT count(*) AS count FROM accounts').count, 2);
  assert.throws(() => auth(f, lost), code('AUTH_REQUIRED'));
  await assert.rejects(attempt({currentDevice: device()}), code('AUTH_FAILED'));
  await assert.rejects(attempt({password: 'an incorrect but adequate length password'}), code('AUTH_FAILED'));
  const ownerRegistration = randomBytes(32).toString('base64url');
  const ownerLost = await attempt({owner: true, id: ownerRegistration});
  const ownerRetried = await attempt({owner: true, id: ownerRegistration});
  assert.equal(ownerLost.account.id, 1); assert.equal(ownerRetried.account.id, 1);
});

test('v2 challenge and certificate bind account action, device encryption key, profile and pinned issuer', async t => {
  const f = setup(t), dev = device(), c = challenge(f.service, dev, 'register', {context: f.context()});
  assert.throws(() => proof.authChallengeTranscript({...c.value, encryptionKey: device().encryptionKey}), code('ACCOUNT_PROOF_INVALID'));
  assert.throws(() => proof.authChallengeTranscript({...c.value, action: 'login'}), code('ACCOUNT_FORMAT'));
  assert.throws(() => proof.authChallengeTranscript({...c.value, profile: {...c.value.profile, name: 'Changed'}}), code('ACCOUNT_PROOF_INVALID'));
  assert.throws(() => proof.encryptionPublicKey(dev.identity.publicKey), code('ACCOUNT_FORMAT'));
  const a = await register(f, dev);
  const replaced = structuredClone(a.certificate); replaced.claims.encryptionKey = device().encryptionKey;
  assert.throws(() => proof.verifyAccountCertificate({certificate: replaced, serverPublicKey: f.service.serverPublicKey, deviceId: dev.identity.deviceId}), code('ACCOUNT_PROOF_INVALID'));
  const alien = generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'der'}).toString('base64');
  assert.throws(() => proof.verifyAccountCertificate({certificate: a.certificate, serverPublicKey: alien, deviceId: dev.identity.deviceId}), code('ACCOUNT_PROOF_INVALID'));
});

test('password login links another device, supports same installation for distinct users, and isolates accounts', async t => {
  const f = setup(t), a = await register(f), secondDevice = device('Second Mac');
  const second = await login(f, secondDevice, a.account.id);
  assert.equal(second.account.id, a.account.id); assert.equal(second.certificate.claims.deviceId, secondDevice.identity.deviceId);
  assert.equal(f.service.devices(auth(f, a)).devices.length, 2);
  const otherUser = await register(f, secondDevice);
  assert.notEqual(otherUser.account.id, a.account.id);
  assert.equal(f.service.devices(auth(f, otherUser)).devices.length, 1);
  f.service.revokeDevice(auth(f, a), secondDevice.identity.deviceId);
  assert.throws(() => auth(f, second), code('AUTH_REQUIRED'));
  assert.equal(f.service.me(auth(f, otherUser)).account.id, otherUser.account.id);
  assert.equal(f.service.me(auth(f, a)).account.id, a.account.id);
});

test('wrong, short and nonexistent-account passwords give the same authentication failure', async t => {
  const f = setup(t), a = await register(f);
  await assert.rejects(login(f, device(), a.account.id, 'wrong but long password value'), code('AUTH_FAILED'));
  await assert.rejects(login(f, device(), a.account.id, 'short'), code('AUTH_FAILED'));
  await assert.rejects(login(f, device(), 987654, PASSWORD), code('AUTH_FAILED'));
  assert.throws(() => passwordBytes('passwordpassword', {newPassword: true}), code('PASSWORD_TOO_COMMON'));
  assert.throws(() => passwordBytes('abc', {newPassword: true}), code('PASSWORD_POLICY'));
  assert.equal(passwordBytes('вот хорошая длинная фраза').toString(), 'вот хорошая длинная фраза');
  assert.throws(() => passwordBytes('x'.repeat(129)), code('PASSWORD_POLICY'));
});

test('recovery is one-use, rotates password/code and revokes every previous device session', async t => {
  const f = setup(t), a = await register(f), other = await login(f, device(), a.account.id), dev = device('Recovered Mac');
  const c = challenge(f.service, dev, 'recover', {id: a.account.id, context: f.context()});
  const recovered = await f.service.recover({challengeId: c.challengeId, signature: c.signature, recoveryCode: a.recoveryCode,
    newPassword: 'this is a replacement mountain passphrase'}, f.context());
  assert.equal(recovered.account.id, a.account.id); assert.notEqual(recovered.recoveryCode, a.recoveryCode);
  assert.throws(() => auth(f, a), code('AUTH_REQUIRED')); assert.throws(() => auth(f, other), code('AUTH_REQUIRED'));
  assert.equal(f.service.devices(auth(f, recovered)).devices.length, 1);
  const replay = challenge(f.service, dev, 'recover', {id: a.account.id, context: f.context()});
  await assert.rejects(f.service.recover({challengeId: replay.challengeId, signature: replay.signature, recoveryCode: a.recoveryCode,
    newPassword: PASSWORD}, f.context()), code('AUTH_FAILED'));
  await assert.rejects(login(f, device(), a.account.id, PASSWORD), code('AUTH_FAILED'));
  assert.equal((await login(f, device(), a.account.id, 'this is a replacement mountain passphrase')).account.id, a.account.id);
});

test('refresh rotates both tokens; reuse revokes only the proven device family and survives restart', async t => {
  const f = setup(t), a = await register(f), other = await login(f, device(), a.account.id);
  const c = challenge(f.service, a.dev, 'refresh', {id: a.account.id, context: f.context()});
  const renewed = f.service.refresh({challengeId: c.challengeId, signature: c.signature, refreshToken: a.refreshToken}, f.context());
  assert.notEqual(renewed.accessToken, a.accessToken); assert.notEqual(renewed.refreshToken, a.refreshToken);
  assert.equal(renewed.refreshExpiresAt, a.refreshExpiresAt);
  assert.throws(() => auth(f, a), code('AUTH_REQUIRED'));
  f.reopen(); assert.equal(f.service.me(auth(f, renewed)).account.id, a.account.id);
  const replay = challenge(f.service, a.dev, 'refresh', {id: a.account.id, context: f.context()});
  assert.throws(() => f.service.refresh({challengeId: replay.challengeId, signature: replay.signature, refreshToken: a.refreshToken}, f.context()), code('AUTH_FAILED'));
  assert.throws(() => auth(f, renewed), code('AUTH_REQUIRED'));
  assert.equal(f.service.me(auth(f, other)).account.id, a.account.id);
});

test('expiry, logout, wrong-device refresh and interrupted challenge cannot resurrect a session', async t => {
  const f = setup(t), a = await register(f), impostor = device();
  const wrong = challenge(f.service, impostor, 'refresh', {id: a.account.id, context: f.context()});
  assert.throws(() => f.service.refresh({challengeId: wrong.challengeId, signature: wrong.signature, refreshToken: a.refreshToken}, f.context()), code('AUTH_FAILED'));
  const pending = challenge(f.service, a.dev, 'login', {id: a.account.id, context: f.context()});
  f.reopen();
  await assert.rejects(f.service.login({challengeId: pending.challengeId, signature: pending.signature, password: PASSWORD}, f.context()), code('AUTH_FAILED'));
  f.clock.value += ACCESS_TTL_MS + 1; assert.throws(() => auth(f, a), code('AUTH_REQUIRED'));
  const c = challenge(f.service, a.dev, 'refresh', {id: a.account.id, context: f.context()});
  const updated = f.service.refresh({challengeId: c.challengeId, signature: c.signature, refreshToken: a.refreshToken}, f.context());
  f.service.logout(auth(f, updated)); assert.throws(() => auth(f, updated), code('AUTH_REQUIRED'));
  const afterLogout = challenge(f.service, a.dev, 'refresh', {id: a.account.id, context: f.context()});
  assert.throws(() => f.service.refresh({challengeId: afterLogout.challengeId, signature: afterLogout.signature, refreshToken: updated.refreshToken}, f.context()), code('AUTH_FAILED'));
  f.clock.value += REFRESH_TTL_MS; f.service.prune(); assert.equal(f.service.get('SELECT count(*) AS count FROM sessions').count, 0);
});

test('concurrent password hashes are bounded and the rate limiter cannot be reset by bucket eviction', async () => {
  const hasher = new PasswordHasher({maxQueue: 1});
  const first = hasher.hash(PASSWORD), second = hasher.hash('another acceptable long secret phrase');
  await assert.rejects(hasher.hash('one more acceptable long secret phrase'), code('AUTH_BUSY'));
  const [a, b] = await Promise.all([first, second]); assert.equal(a.digest.length, 32); assert.equal(b.digest.length, 32); hasher.close();
  let now = 0; const rates = new RateLimiter({now: () => now, maxKeys: 2});
  rates.take('login', 'first', 1, 100); rates.take('login', 'second', 1, 100);
  assert.throws(() => rates.take('login', 'first', 1, 100), code('RATE_LIMITED'));
  assert.throws(() => rates.take('login', 'third', 1, 100), code('RATE_LIMITED'));
  now = 101; rates.take('login', 'third', 1, 100); assert.equal(rates.buckets.size, 1);
});

test('account capacity still leaves owner 1 claimable and concurrent registrations allocate distinct IDs', async t => {
  const f = setup(t, {maxAccounts: 3});
  const two = await Promise.all([register(f), register(f)]);
  assert.deepEqual(two.map(value => value.account.id).sort(), [2, 3]);
  await assert.rejects(register(f), code('ACCOUNT_CAPACITY'));
  assert.equal((await register(f, device(), {owner: true})).account.id, 1);
});

test('strict lightweight sync persists with CAS conflict and rejects files, cookies, credentials and cross-account reads', async t => {
  const f = setup(t), a = await register(f), b = await register(f), aAuth = auth(f, a), config = state();
  assert.deepEqual(f.service.syncGet(aAuth), {revision: 0, state: null, updatedAt: null});
  const first = f.service.syncPut(aAuth, {revision: 0, state: config}); assert.equal(first.revision, 1);
  const stale = state(); stale.preferences.theme = 'light';
  assert.throws(() => f.service.syncPut(aAuth, {revision: 0, state: stale}), error => error.code === 'SYNC_CONFLICT'
    && error.status === 409 && error.conflict.revision === 1 && error.conflict.state.preferences.theme === 'dark');
  assert.equal(f.service.syncGet(auth(f, b)).state, null);
  for (const field of ['files', 'screenshots', 'cookies', 'passwords', 'history', 'downloads', 'text']) {
    assert.throws(() => f.service.syncPut(aAuth, {revision: 1, state: {...config, [field]: ['private']}}), code('SYNC_INVALID'));
  }
  for (const url of ['file:///private/photo.jpg', 'data:text/plain;base64,cHJpdmF0ZQ==', 'https://example.com/?access_token=private', 'https://user:password@example.com/']) {
    const bad = structuredClone(config); bad.tabs[0].url = url;
    assert.throws(() => f.service.syncPut(aAuth, {revision: 1, state: bad}), code('SYNC_INVALID'));
  }
  f.reopen(); const saved = f.service.syncGet(auth(f, a)); assert.equal(saved.revision, 1); assert.equal(saved.state.preferences.theme, 'dark');
});

test('Flash addressing requires live certified device, expires, consumes once, isolates recipient and clears on logout', async t => {
  const f = setup(t), a = await register(f), b = await register(f), aAuth = auth(f, a), bAuth = auth(f, b);
  assert.equal(f.service.flashDevices(aAuth, b.account.id).devices.length, 0);
  const presence = f.service.flashPresence(bAuth, {}); assert.ok(presence.expiresAt > f.clock.value);
  const found = f.service.flashDevices(aAuth, b.account.id);
  assert.equal(found.account.id, b.account.id); assert.equal(found.devices[0].certificate.claims.encryptionKey, b.dev.encryptionKey);
  const envelope = {v: 1, ephemeralKey: device().encryptionKey, nonce: randomBytes(12).toString('base64'), ciphertext: randomBytes(40).toString('base64')};
  const sent = f.service.flashSend(aAuth, {recipientAccountId: b.account.id, recipientDeviceId: b.dev.identity.deviceId, envelope});
  assert.equal(f.service.flashInbox(aAuth).invitations.length, 0);
  const incoming = f.service.flashInbox(bAuth).invitations;
  assert.equal(incoming[0].invitationId, sent.invitationId); assert.equal(incoming[0].fromAccountId, a.account.id);
  assert.deepEqual(incoming[0].envelope, envelope); assert.equal(f.service.flashInbox(bAuth).invitations.length, 0);
  f.service.flashSend(aAuth, {recipientAccountId: b.account.id, recipientDeviceId: b.dev.identity.deviceId, envelope});
  f.service.logout(bAuth); assert.equal(f.service.invitations.size, 0); assert.equal(f.service.flashDevices(aAuth, b.account.id).account, null);
});

test('opening a database with a different signer fails closed and symlink database is rejected', async t => {
  const f = setup(t); f.service.close();
  assert.throws(() => new IdentityService({...f.config, issuerPrivateKey: generateKeyPairSync('ed25519').privateKey}), code('ISSUER_MISMATCH'));
  const filename = path.join(f.directory, 'accounts.sqlite'), original = path.join(f.directory, 'original.sqlite');
  fs.renameSync(filename, original); fs.symlinkSync(original, filename);
  assert.throws(() => new IdentityService(f.config), code('STORAGE_UNAVAILABLE'));
});
