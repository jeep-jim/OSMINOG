'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const {generateKeyPairSync, createHash, randomBytes, sign, createCipheriv, createDecipheriv} = require('node:crypto');
const {openAccountRegistry, REGISTRY_FILENAME, MAX_ACCOUNTS, MAX_DEVICE_CHALLENGES} = require('./mouse-account-registry.cjs');
const {loadIdentity} = require('../desktop/mouse-flash-identity.cjs');
const {verifyAccountCertificate, normalizeAccountProfile, accountChallengeTranscript, certificateSigningBytes,
  CHALLENGE_TTL_MS, CERTIFICATE_TTL_MS} = require('../desktop/mouse-account-proof.cjs');

const code = expected => error => error?.code === expected;
const clone = value => JSON.parse(JSON.stringify(value));
const initialTime = Date.UTC(2026, 10, 28, 12);
function device(name = 'Test Mac') {
  const pair = generateKeyPairSync('ed25519'), der = pair.publicKey.export({type: 'spki', format: 'der'});
  return {identity: {deviceId: createHash('sha256').update(der).digest('hex').slice(0, 32), name, publicKey: der.toString('base64')},
    sign(hash) { return {signature: sign(null, Buffer.from('MouseFlashIdentity:v1:' + hash), pair.privateKey).toString('base64')}; }};
}
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mouse-account-'));
  const signingKey = generateKeyPairSync('ed25519').privateKey, secret = randomBytes(32).toString('base64url');
  let time = initialTime; const instances = [];
  const options = {directory, signingKey, ownerBootstrapSecret: secret, now: () => time};
  async function open(overrides = {}) { const registry = await openAccountRegistry({...options, ...overrides}); instances.push(registry); return registry; }
  t.after(async () => { for (const instance of instances) await instance.close().catch(() => {}); await fs.rm(directory, {recursive: true, force: true}); });
  return {directory, signingKey, secret, options, open, advance: value => { time += value; }, time: () => time};
}
async function challenge(registry, actor, action = 'register', profile = {name: 'Пользователь', avatarHash: null}) {
  return registry.issueChallenge({action, identity: actor.identity, ...profile});
}
function completion(value, actor, extra = {}) {
  return {challengeId: value.challengeId, ...actor.sign(accountChallengeTranscript(value)), ...extra};
}
async function register(registry, actor, profile) { const value = await challenge(registry, actor, 'register', profile); return registry.completeChallenge(completion(value, actor)); }
function checked(registry, actor, certificate, now = initialTime) {
  return verifyAccountCertificate({certificate, serverPublicKey: registry.serverPublicKey, deviceId: actor.identity.deviceId, now});
}

test('durable initialization reserves ID1, stores no bootstrap plaintext/private signer, and first visitors receive2 then3', async t => {
  const f = await fixture(t), registry = await f.open();
  const filename = path.join(f.directory, REGISTRY_FILENAME);
  const initial = JSON.parse(await fs.readFile(filename, 'utf8'));
  assert.deepEqual({accountId: initial.payload.owner.accountId, status: initial.payload.owner.status, deviceId: initial.payload.owner.deviceId}, {accountId: 1, status: 'reserved', deviceId: null});
  assert.equal(initial.payload.nextId, 2); assert.deepEqual(initial.payload.accounts, []);
  const a = device(), b = device(), first = await register(registry, a), second = await register(registry, b);
  assert.equal(first.accountId, 2); assert.equal(second.accountId, 3);
  assert.equal(checked(registry, a, first.certificate).accountId, 2);
  const stored = await fs.readFile(filename, 'utf8');
  assert.equal(stored.includes(f.secret), false);
  assert.equal(stored.includes(f.signingKey.export({type: 'pkcs8', format: 'der'}).toString('base64')), false);
  assert.equal(JSON.parse(stored).payload.owner.status, 'reserved');
  assert.equal((await fs.stat(f.directory)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
});

test('device registration is idempotent across concurrent proofs and reopen; profile update keeps the same ID', async t => {
  const f = await fixture(t), registry = await f.open(), actor = device();
  const pending = await Promise.all(Array.from({length: 4}, () => challenge(registry, actor)));
  const results = await Promise.all(pending.map(value => registry.completeChallenge(completion(value, actor))));
  assert.deepEqual(results.map(value => value.accountId), [2, 2, 2, 2]);
  await registry.close();
  const reopened = await f.open({ownerBootstrapSecret: undefined});
  const profile = {name: '  Анто\u0301н  ', avatarHash: createHash('sha256').update(Buffer.from([0x89, 0x50, 0x4e, 0x47])).digest('hex')};
  const result = await register(reopened, actor, profile);
  assert.equal(result.accountId, 2);
  assert.equal(checked(reopened, actor, result.certificate).claims.name, profile.name.trim().normalize('NFC'));
  assert.equal(result.certificate.claims.avatarHash, profile.avatarHash);
  assert.equal((await register(reopened, device())).accountId, 3);
});

test('owner claim requires both the private bootstrap capability and possession of the correct device key', async t => {
  const f = await fixture(t), registry = await f.open(), owner = device(), stranger = device();
  let value = await challenge(registry, owner, 'claim-owner');
  await assert.rejects(registry.completeChallenge(completion(value, owner)), code('ACCOUNT_BOOTSTRAP_INVALID'));
  await assert.rejects(registry.completeChallenge(completion(value, owner, {ownerBootstrapSecret: f.secret})), code('ACCOUNT_CHALLENGE_INVALID'));
  value = await challenge(registry, owner, 'claim-owner');
  await assert.rejects(registry.completeChallenge(completion(value, owner, {ownerBootstrapSecret: randomBytes(32).toString('base64url')})), code('ACCOUNT_BOOTSTRAP_INVALID'));
  value = await challenge(registry, owner, 'claim-owner');
  await assert.rejects(registry.completeChallenge(completion(value, stranger, {ownerBootstrapSecret: f.secret})), code('ACCOUNT_DEVICE_PROOF_INVALID'));
  const state = JSON.parse(await fs.readFile(path.join(f.directory, REGISTRY_FILENAME), 'utf8')).payload;
  assert.equal(state.owner.status, 'reserved'); assert.equal(state.nextId, 2); assert.deepEqual(state.accounts, []);
  assert.equal((await register(registry, stranger)).accountId, 2);
});

test('owner secret consumption and ID1 binding persist together; replay or a second owner cannot take the slot', async t => {
  const f = await fixture(t), registry = await f.open(), owner = device(), other = device();
  const value = await challenge(registry, owner, 'claim-owner', {name: 'Антон', avatarHash: null});
  const second = await challenge(registry, other, 'claim-owner');
  const request = completion(value, owner, {ownerBootstrapSecret: f.secret});
  const result = await registry.completeChallenge(request);
  assert.equal(result.accountId, 1); assert.equal(checked(registry, owner, result.certificate).accountId, 1);
  await assert.rejects(registry.completeChallenge(request), code('ACCOUNT_CHALLENGE_INVALID'));
  await assert.rejects(registry.completeChallenge(completion(second, other, {ownerBootstrapSecret: f.secret})), code('ACCOUNT_OWNER_UNAVAILABLE'));
  let stored = JSON.parse(await fs.readFile(path.join(f.directory, REGISTRY_FILENAME), 'utf8')).payload;
  assert.deepEqual(stored.owner, {accountId: 1, status: 'claimed', deviceId: owner.identity.deviceId, bootstrapHash: null});
  assert.equal(stored.accounts.length, 1); assert.equal(stored.nextId, 2);
  await registry.close(); const reopened = await f.open({ownerBootstrapSecret: undefined});
  await assert.rejects(challenge(reopened, other, 'claim-owner'), code('ACCOUNT_OWNER_UNAVAILABLE'));
  assert.equal((await register(reopened, other)).accountId, 2);
  assert.equal((await register(reopened, owner, {name: 'Антон', avatarHash: null})).accountId, 1, 'an already-bound owner reauthenticates with its device key');
  stored = JSON.parse(await fs.readFile(path.join(f.directory, REGISTRY_FILENAME), 'utf8')).payload;
  assert.equal(stored.owner.bootstrapHash, null);
});

test('registration and completion reject client-chosen IDs, action substitution and bootstrap use on the normal path', async t => {
  const f = await fixture(t), registry = await f.open(), actor = device();
  await assert.rejects(registry.issueChallenge({action: 'register', identity: actor.identity, name: 'User', accountId: 1}), code('ACCOUNT_FORMAT'));
  let value = await challenge(registry, actor);
  await assert.rejects(registry.completeChallenge({...completion(value, actor), accountId: 1}), code('ACCOUNT_FORMAT'));
  await assert.rejects(registry.completeChallenge(completion(value, actor, {ownerBootstrapSecret: f.secret})), code('ACCOUNT_ACTION'));
  assert.equal((await register(registry, actor)).accountId, 2);
  value = await challenge(registry, actor, 'claim-owner');
  await assert.rejects(registry.completeChallenge(completion(value, actor, {ownerBootstrapSecret: f.secret})), code('ACCOUNT_ALREADY_REGISTERED'));
  assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, REGISTRY_FILENAME), 'utf8')).payload.owner.status, 'reserved');
});

test('challenge signatures bind action, nonce, registry, issuer, identity, profile and deadline', async t => {
  const f = await fixture(t), registry = await f.open(), actor = device(), alternate = device();
  const mutations = [
    value => { value.action = 'claim-owner'; },
    value => { value.challengeId = randomBytes(32).toString('base64url'); },
    value => { value.registryId = randomBytes(32).toString('base64url'); },
    value => { value.issuerKeyId = 'a'.repeat(64); },
    value => { value.identity = alternate.identity; },
    value => { value.profile.name = 'Changed'; },
    value => { value.profile.avatarHash = 'b'.repeat(64); },
    value => { value.expiresAt--; }
  ];
  for (const mutate of mutations) {
    const original = await challenge(registry, actor), changed = clone(original);
    delete changed.transcriptHash; mutate(changed);
    const signature = actor.sign(accountChallengeTranscript(changed)).signature;
    await assert.rejects(registry.completeChallenge({challengeId: original.challengeId, signature}), code('ACCOUNT_DEVICE_PROOF_INVALID'));
  }
  assert.equal((await register(registry, actor)).accountId, 2);
});

test('expired, completed and pre-restart challenges cannot be replayed; pending state is bounded', async t => {
  const f = await fixture(t), registry = await f.open(), actor = device();
  const pending = await Promise.all(Array.from({length: MAX_DEVICE_CHALLENGES}, () => challenge(registry, actor)));
  await assert.rejects(challenge(registry, actor), code('ACCOUNT_CHALLENGE_LIMIT'));
  f.advance(CHALLENGE_TTL_MS);
  await assert.rejects(registry.completeChallenge(completion(pending[0], actor)), code('ACCOUNT_CHALLENGE_INVALID'));
  const old = await challenge(registry, actor);
  await registry.close(); const reopened = await f.open({ownerBootstrapSecret: undefined});
  await assert.rejects(reopened.completeChallenge(completion(old, actor)), code('ACCOUNT_CHALLENGE_INVALID'));
  const fresh = await challenge(reopened, actor);
  const results = await Promise.allSettled([reopened.completeChallenge(completion(fresh, actor)), reopened.completeChallenge(completion(fresh, actor))]);
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(results.find(value => value.status === 'rejected').reason.code, 'ACCOUNT_CHALLENGE_INVALID');
});

test('parallel different-device claims allocate unique normal IDs while leaving1 reserved', async t => {
  const f = await fixture(t), registry = await f.open(), actors = Array.from({length: 12}, () => device());
  const requests = await Promise.all(actors.map(actor => challenge(registry, actor)));
  const results = await Promise.all(requests.map((value, index) => registry.completeChallenge(completion(value, actors[index]))));
  assert.deepEqual(results.map(value => value.accountId).sort((a, b) => a - b), Array.from({length: 12}, (_, i) => i + 2));
  await registry.close(); const reopened = await f.open();
  assert.equal((await register(reopened, device())).accountId, 14);
});

test('owner reservation includes the last capacity slot; full normal population cannot prevent its claim', async t => {
  const f = await fixture(t), initial = await f.open(), existing = device(), owner = device(), visitor = device();
  await register(initial, existing); await initial.close();
  const filename = path.join(f.directory, REGISTRY_FILENAME), payload = JSON.parse(await fs.readFile(filename, 'utf8')).payload;
  for (let index = 1; index < MAX_ACCOUNTS - 1; index++) {
    // Build a signed, structurally valid near-capacity server snapshot without
    // thousands of unrelated filesystem writes. Only public test keys remain.
    const der = generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'der'});
    payload.accounts.push({accountId: index + 2, deviceId: createHash('sha256').update(der).digest('hex').slice(0, 32),
      publicKey: der.toString('base64'), name: 'Fixture', avatarHash: null, createdAt: initialTime, updatedAt: initialTime});
  }
  payload.nextId = MAX_ACCOUNTS + 1; payload.revision = MAX_ACCOUNTS - 1;
  const store = async value => fs.writeFile(filename, JSON.stringify({payload: value,
    signature: sign(null, Buffer.from('MouseAccountRegistryState:v1:' + JSON.stringify(value)), f.signingKey).toString('base64')}));
  const overflow = clone(payload), extraDer = generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'der'});
  overflow.accounts.push({accountId: overflow.nextId++, deviceId: createHash('sha256').update(extraDer).digest('hex').slice(0, 32), publicKey: extraDer.toString('base64'), name: 'Overflow', avatarHash: null, createdAt: initialTime, updatedAt: initialTime});
  await store(overflow); await assert.rejects(f.open(), code('ACCOUNT_STATE_INVALID'));
  await store(payload); const registry = await f.open();
  await assert.rejects(register(registry, visitor), code('ACCOUNT_CAPACITY'));
  assert.equal((await register(registry, existing, {name: 'Updated at capacity', avatarHash: null})).accountId, 2);
  const value = await challenge(registry, owner, 'claim-owner');
  assert.equal((await registry.completeChallenge(completion(value, owner, {ownerBootstrapSecret: f.secret}))).accountId, 1);
  await assert.rejects(register(registry, visitor), code('ACCOUNT_CAPACITY'));
  await registry.close(); const reopened = await f.open({ownerBootstrapSecret: undefined});
  const state = JSON.parse(await fs.readFile(filename, 'utf8')).payload;
  assert.equal(state.accounts.length, MAX_ACCOUNTS); assert.equal(state.owner.status, 'claimed');
  assert.equal(checked(reopened, owner, (await register(reopened, owner)).certificate).accountId, 1);
});

test('certificate verification requires the pinned issuer, correct device and signed canonical claims', async t => {
  const f = await fixture(t), registry = await f.open(), actor = device(), other = device();
  const {certificate} = await register(registry, actor, {name: 'Антон', avatarHash: 'c'.repeat(64)});
  assert.deepEqual(Object.keys(checked(registry, actor, certificate)).sort(), ['accountId', 'claims', 'ok']);
  assert.throws(() => verifyAccountCertificate({certificate, deviceId: actor.identity.deviceId, now: f.time()}), code('ACCOUNT_NOT_CONFIGURED'));
  assert.throws(() => verifyAccountCertificate({certificate, serverPublicKey: other.identity.publicKey, deviceId: actor.identity.deviceId, now: f.time()}), code('ACCOUNT_PROOF_INVALID'));
  assert.throws(() => checked(registry, other, certificate), code('ACCOUNT_DEVICE_MISMATCH'));
  const mutations = [
    value => { value.claims.accountId = 1; },
    value => { value.claims.name = 'Someone else'; },
    value => { value.claims.avatarHash = 'd'.repeat(64); },
    value => { value.claims.expiresAt--; },
    value => { value.claims.registryId = randomBytes(32).toString('base64url'); },
    value => { value.signature = Buffer.alloc(64).toString('base64'); },
    value => { value.serverPublicKey = registry.serverPublicKey; }
  ];
  for (const mutate of mutations) { const changed = clone(certificate); mutate(changed); assert.throws(() => checked(registry, actor, changed)); }
  const noncanonical = clone(certificate); noncanonical.claims.name = ' Антон';
  assert.throws(() => checked(registry, actor, noncanonical), code('ACCOUNT_FORMAT'));
  const invalid = clone(certificate); invalid.claims.avatarHash = undefined;
  assert.throws(() => checked(registry, actor, invalid), code('ACCOUNT_FORMAT'));
});

test('signed certificates expire and cannot authorize a future or overlong validity interval', async t => {
  const f = await fixture(t), registry = await f.open(), actor = device(), {certificate} = await register(registry, actor);
  assert.equal(checked(registry, actor, certificate, initialTime + CERTIFICATE_TTL_MS - 1).ok, true);
  assert.throws(() => checked(registry, actor, certificate, initialTime + CERTIFICATE_TTL_MS), code('ACCOUNT_EXPIRED'));
  assert.throws(() => checked(registry, actor, certificate, initialTime - 60001), code('ACCOUNT_EXPIRED'));
  const changed = clone(certificate); changed.claims.expiresAt++;
  assert.throws(() => certificateSigningBytes(changed.claims), code('ACCOUNT_FORMAT'));
  const wrongDomain = {...certificate, signature: sign(null, Buffer.from(JSON.stringify(certificate.claims)), f.signingKey).toString('base64')};
  assert.throws(() => checked(registry, actor, wrongDomain), code('ACCOUNT_PROOF_INVALID'));
});

test('existing protected Mouse device identity signs a usable account challenge without exporting its private key', async t => {
  const f = await fixture(t), registry = await f.open(), protectionKey = randomBytes(32);
  const actor = await loadIdentity({directory: path.join(f.directory, 'device'), name: 'Mac',
    protect(value) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', protectionKey, iv); const data = Buffer.concat([cipher.update(value), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); },
    unprotect(value) { const decipher = createDecipheriv('aes-256-gcm', protectionKey, value.subarray(0, 12)); decipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8'); }});
  const value = await challenge(registry, actor, 'claim-owner');
  const result = await registry.completeChallenge(completion(value, actor, {ownerBootstrapSecret: f.secret}));
  assert.equal(checked(registry, actor, result.certificate).accountId, 1);
});

test('single writer lock is enforced across processes and never silently stolen', async t => {
  const f = await fixture(t), registry = await f.open();
  await assert.rejects(f.open(), code('ACCOUNT_REGISTRY_LOCKED'));
  const worker = `const {createPrivateKey}=require('node:crypto'); const {openAccountRegistry}=require(${JSON.stringify(require.resolve('./mouse-account-registry.cjs'))});
const signingKey=createPrivateKey({key:Buffer.from(process.env.MOUSE_ACCOUNT_TEST_SIGNER,'base64'),type:'pkcs8',format:'der'});
openAccountRegistry({directory:process.argv[1],signingKey}).then(async r=>{await r.close();process.stdout.write('UNEXPECTED_OPEN');}).catch(e=>process.stdout.write(e.code));`;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', worker, f.directory], {env: {...process.env, MOUSE_ACCOUNT_TEST_SIGNER: f.signingKey.export({type: 'pkcs8', format: 'der'}).toString('base64')}, stdio: ['ignore', 'pipe', 'ignore']});
    let output = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', data => { output += data; });
    child.once('error', reject); child.once('exit', status => status === 0 ? resolve(output) : reject(new Error('Registry worker failed')));
  });
  assert.equal(result, 'ACCOUNT_REGISTRY_LOCKED');
  await Promise.all([registry.close(), registry.close()]);
  await assert.rejects(registry.issueChallenge({}), code('ACCOUNT_CLOSED'));
  const reopened = await f.open(); await reopened.close();
  await fs.mkdir(path.join(f.directory, '.mouse-account-writer.lock'));
  await assert.rejects(f.open(), code('ACCOUNT_REGISTRY_LOCKED'));
});

test('corrupt, altered, oversized or differently signed durable state is refused without reset', async t => {
  const f = await fixture(t), registry = await f.open(), actor = device(); await register(registry, actor); await registry.close();
  const filename = path.join(f.directory, REGISTRY_FILENAME), original = await fs.readFile(filename, 'utf8');
  const changed = JSON.parse(original); changed.payload.nextId = 1; await fs.writeFile(filename, JSON.stringify(changed));
  await assert.rejects(f.open(), code('ACCOUNT_STATE_INVALID')); assert.equal(JSON.parse(await fs.readFile(filename, 'utf8')).payload.nextId, 1);
  await fs.writeFile(filename, '{broken'); await assert.rejects(f.open(), code('ACCOUNT_STATE_INVALID'));
  await fs.writeFile(filename, 'x'.repeat(4 * 1024 * 1024 + 1)); await assert.rejects(f.open(), code('ACCOUNT_STATE_INVALID'));
  await fs.writeFile(filename, original);
  await assert.rejects(f.open({signingKey: generateKeyPairSync('ed25519').privateKey}), code('ACCOUNT_STATE_INVALID'));
  await assert.rejects(f.open({ownerBootstrapSecret: randomBytes(32).toString('base64url')}), code('ACCOUNT_BOOTSTRAP_INVALID'));
  assert.equal(await fs.readFile(filename, 'utf8'), original);
  const reopened = await f.open(); assert.equal((await register(reopened, actor)).accountId, 2);
});

test('unsafe storage and missing operator credentials cannot create or overwrite an owner registry', async t => {
  const f = await fixture(t);
  await assert.rejects(f.open({ownerBootstrapSecret: undefined}), code('ACCOUNT_BOOTSTRAP_INVALID'));
  assert.deepEqual(await fs.readdir(f.directory), []);
  await assert.rejects(f.open({signingKey: undefined}), code('ACCOUNT_SIGNER_REQUIRED'));
  const outside = path.join(f.directory, 'outside'); await fs.writeFile(outside, 'unrelated', {mode: 0o644});
  await fs.symlink(outside, path.join(f.directory, REGISTRY_FILENAME));
  await assert.rejects(f.open(), code('ACCOUNT_STORAGE'));
  assert.equal(await fs.readFile(outside, 'utf8'), 'unrelated'); assert.equal((await fs.stat(outside)).mode & 0o777, 0o644);
  await fs.unlink(path.join(f.directory, REGISTRY_FILENAME));
  const linked = path.join(f.directory, 'linked'); await fs.symlink(f.directory, linked);
  await assert.rejects(f.open({directory: linked}), code('ACCOUNT_STORAGE'));
});

test('profile canonicalization is explicit and rejects control characters, oversized names and ambiguous avatar hashes', () => {
  assert.deepEqual(normalizeAccountProfile({name: '  A\u0301нтон  '}), {name: 'Áнтон', avatarHash: null});
  const digest = createHash('sha256').update(Buffer.from([1, 2, 3, 4])).digest('hex');
  assert.deepEqual(normalizeAccountProfile({name: 'Mouse', avatarHash: digest}), {name: 'Mouse', avatarHash: digest});
  for (const value of [{name: ''}, {name: '\n'}, {name: 'x'.repeat(81)}, {name: 'A\u0000B'}, {name: 'A\u202eB'}, {name: 'Mac', avatarHash: digest.toUpperCase()}, {name: 'Mac', avatarHash: 'data:image/png;base64,abc'}, {name: 'Mac', accountId: 1}]) {
    assert.throws(() => normalizeAccountProfile(value), code('ACCOUNT_FORMAT'));
  }
});
