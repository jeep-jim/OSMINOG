'use strict';

// Server-side prototype module, not an HTTP service or a deployed account
// registry. ID 1 is reserved before any registration. The owner bootstrap
// capability is supplied privately by the operator and only its salted digest
// is persisted. Inject the server signing key from protected server storage.
// One process owns the durable registry. A stale writer lock fails closed and
// requires operator review; account recovery/key rotation/device linking are
// deliberately outside this first module.
const fs = require('node:fs/promises');
const {constants} = require('node:fs');
const path = require('node:path');
const {createHash, createPublicKey, randomBytes, sign, verify: verifyBytes, timingSafeEqual, KeyObject} = require('node:crypto');
const {verify: verifyDeviceProof} = require('../desktop/mouse-flash-identity.cjs');
const {MouseAccountError, normalizeAccountProfile, accountChallengeTranscript, certificateSigningBytes,
  readIdentity, publicKey, bytes64, shape, timestamp, token, CHALLENGE_TTL_MS, CERTIFICATE_TTL_MS,
  CLOCK_SKEW_MS, verifyAccountCertificate} = require('../desktop/mouse-account-proof.cjs');

const REGISTRY_FILENAME = 'mouse-account-registry.json';
const LOCK_DIRECTORY = '.mouse-account-writer.lock';
const MAX_ACCOUNTS = 4096;
const MAX_STATE_BYTES = 4 * 1024 * 1024;
const MAX_CHALLENGES = 256;
const MAX_DEVICE_CHALLENGES = 4;
const HEX64 = /^[a-f0-9]{64}$/;
function fail(code, message) { throw new MouseAccountError(code, message); }
function bootstrapHash(secret, registryId) {
  try { token(secret); } catch { fail('ACCOUNT_BOOTSTRAP_INVALID', 'A private 256-bit owner bootstrap capability is required.'); }
  return createHash('sha256').update('MouseAccountOwnerBootstrap:v1:' + registryId + ':' + secret).digest('hex');
}
function equalHash(left, right) {
  return typeof left === 'string' && typeof right === 'string' && HEX64.test(left) && HEX64.test(right)
    && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function stateBytes(payload) { return Buffer.from('MouseAccountRegistryState:v1:' + JSON.stringify(payload), 'utf8'); }
function record(value) {
  shape(value, ['accountId', 'deviceId', 'publicKey', 'name', 'avatarHash', 'createdAt', 'updatedAt']);
  if (!Number.isSafeInteger(value.accountId) || value.accountId < 1) fail('ACCOUNT_STATE_INVALID', 'Invalid durable account ID.');
  const profile = normalizeAccountProfile({name: value.name, avatarHash: value.avatarHash});
  if (profile.name !== value.name || profile.avatarHash !== value.avatarHash || publicKey(value.publicKey).keyId.slice(0, 32) !== value.deviceId) {
    fail('ACCOUNT_STATE_INVALID', 'Invalid durable account identity.');
  }
  if (timestamp(value.updatedAt) < timestamp(value.createdAt)) fail('ACCOUNT_STATE_INVALID', 'Invalid durable account timestamps.');
  return {...value};
}
function validateState(value, expectedPublicKey) {
  shape(value, ['v', 'registryId', 'serverPublicKey', 'revision', 'nextId', 'owner', 'accounts']);
  if (value.v !== 1 || value.serverPublicKey !== expectedPublicKey || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !Number.isSafeInteger(value.nextId) || value.nextId < 2 || !Array.isArray(value.accounts) || value.accounts.length > MAX_ACCOUNTS) {
    fail('ACCOUNT_STATE_INVALID', 'The durable account registry does not match its configuration.');
  }
  token(value.registryId); shape(value.owner, ['accountId', 'status', 'deviceId', 'bootstrapHash']);
  if (value.owner.accountId !== 1 || !['reserved', 'claimed'].includes(value.owner.status)) fail('ACCOUNT_STATE_INVALID', 'Owner ID 1 must remain reserved.');
  const devices = new Set(), keys = new Set(); let previous = 0, normal = 2, owner = null;
  const accounts = value.accounts.map(input => {
    const account = record(input);
    if (account.accountId <= previous || devices.has(account.deviceId) || keys.has(account.publicKey)) fail('ACCOUNT_STATE_INVALID', 'Duplicate durable account identity.');
    previous = account.accountId; devices.add(account.deviceId); keys.add(account.publicKey);
    if (account.accountId === 1) owner = account;
    else if (account.accountId !== normal++) fail('ACCOUNT_STATE_INVALID', 'Invalid account allocation sequence.');
    return account;
  });
  if (value.nextId !== normal) fail('ACCOUNT_STATE_INVALID', 'Invalid next account ID.');
  if (value.owner.status === 'reserved') {
    if (owner || accounts.length >= MAX_ACCOUNTS || value.owner.deviceId !== null
      || typeof value.owner.bootstrapHash !== 'string' || !HEX64.test(value.owner.bootstrapHash)) {
      fail('ACCOUNT_STATE_INVALID', 'Invalid reserved owner slot.');
    }
  } else if (!owner || value.owner.deviceId !== owner.deviceId || value.owner.bootstrapHash !== null) {
    fail('ACCOUNT_STATE_INVALID', 'The claimed owner slot must have a consumed bootstrap capability.');
  }
  return {...value, owner: {...value.owner}, accounts};
}
async function syncDirectory(directory) {
  const handle = await fs.open(directory, constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function readState(filename, serverPublicKey) {
  let handle;
  try {
    handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_STATE_BYTES) fail('ACCOUNT_STATE_INVALID', 'Invalid durable account file.');
    await handle.chmod(0o600);
    const data = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < data.length) { const result = await handle.read(data, length, data.length - length, length); if (!result.bytesRead) break; length += result.bytesRead; }
    if (length !== stat.size) fail('ACCOUNT_STATE_INVALID', 'The durable account file changed while reading.');
    let envelope;
    try { envelope = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(data.subarray(0, length))); }
    catch { fail('ACCOUNT_STATE_INVALID', 'Invalid durable account JSON.'); }
    shape(envelope, ['payload', 'signature']);
    if (!verifyBytes(null, stateBytes(envelope.payload), publicKey(serverPublicKey).key, bytes64(envelope.signature, 64))) {
      fail('ACCOUNT_STATE_INVALID', 'The durable account registry signature is invalid.');
    }
    return validateState(envelope.payload, serverPublicKey);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof MouseAccountError) throw error;
    fail('ACCOUNT_STORAGE', 'The private account registry could not be read.');
  } finally { if (handle) await handle.close(); }
}
async function writeState(directory, filename, state, signingKey) {
  const payload = validateState(state, state.serverPublicKey);
  const data = Buffer.from(JSON.stringify({payload, signature: sign(null, stateBytes(payload), signingKey).toString('base64')}) + '\n');
  if (data.length > MAX_STATE_BYTES) fail('ACCOUNT_CAPACITY', 'The prototype account registry has reached its storage limit.');
  const temporary = path.join(directory, '.account-' + randomBytes(16).toString('hex') + '.tmp');
  let handle;
  try {
    handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600);
    await handle.writeFile(data); await handle.sync(); await handle.close(); handle = null;
    await fs.rename(temporary, filename); await syncDirectory(directory);
  } catch { fail('ACCOUNT_STORAGE', 'The account change could not be durably committed.'); }
  finally { if (handle) await handle.close().catch(() => {}); await fs.unlink(temporary).catch(() => {}); }
}

async function openAccountRegistry({directory, ownerBootstrapSecret, signingKey, now = Date.now} = {}) {
  if (!(signingKey instanceof KeyObject) || signingKey.type !== 'private' || signingKey.asymmetricKeyType !== 'ed25519') {
    fail('ACCOUNT_SIGNER_REQUIRED', 'An operator-provided Ed25519 server signing key is required.');
  }
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || typeof now !== 'function') fail('ACCOUNT_CONFIG', 'Invalid account registry configuration.');
  const serverPublicKey = createPublicKey(signingKey).export({type: 'spki', format: 'der'}).toString('base64');
  const issuerKeyId = publicKey(serverPublicKey).keyId;
  const filename = path.join(directory, REGISTRY_FILENAME), lock = path.join(directory, LOCK_DIRECTORY);
  let ownsLock = false;
  try {
    await fs.mkdir(directory, {recursive: true, mode: 0o700});
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('ACCOUNT_STORAGE', 'The account registry requires a private real directory.');
    await fs.chmod(directory, 0o700);
    try { await fs.mkdir(lock, {mode: 0o700}); ownsLock = true; }
    catch (error) { if (error.code === 'EEXIST') fail('ACCOUNT_REGISTRY_LOCKED', 'Another writer or an unresolved previous writer owns this account registry.'); throw error; }
    let state = await readState(filename, serverPublicKey);
    if (!state) {
      const registryId = randomBytes(32).toString('base64url');
      state = {v: 1, registryId, serverPublicKey, revision: 0, nextId: 2,
        owner: {accountId: 1, status: 'reserved', deviceId: null, bootstrapHash: bootstrapHash(ownerBootstrapSecret, registryId)}, accounts: []};
      await writeState(directory, filename, state, signingKey);
    } else if (ownerBootstrapSecret !== undefined && state.owner.status === 'reserved'
      && !equalHash(bootstrapHash(ownerBootstrapSecret, state.registryId), state.owner.bootstrapHash)) {
      fail('ACCOUNT_BOOTSTRAP_INVALID', 'The configured owner bootstrap capability does not match the reserved slot.');
    }
    ownerBootstrapSecret = undefined;
    const challenges = new Map(); let tail = Promise.resolve(), accepting = true, poisoned = false, closing;
    function enqueue(operation) {
      if (!accepting) return Promise.reject(new MouseAccountError('ACCOUNT_CLOSED', 'The account registry is closed.'));
      const result = tail.then(async () => {
        if (poisoned) fail('ACCOUNT_STORAGE', 'The account registry requires a durable-state review.');
        return operation();
      });
      tail = result.catch(() => {}); return result;
    }
    function clock() { return timestamp(now()); }
    function sweep(time) { for (const [id, value] of challenges) if (value.expiresAt <= time) challenges.delete(id); }
    async function commit(next) {
      try { await writeState(directory, filename, next, signingKey); state = next; }
      catch (error) { poisoned = true; challenges.clear(); throw error; }
    }
    function certificate(account, time) {
      const claims = Object.freeze({v: 1, issuerKeyId, registryId: state.registryId, accountId: account.accountId,
        deviceId: account.deviceId, publicKey: account.publicKey, name: account.name, avatarHash: account.avatarHash,
        issuedAt: time, expiresAt: time + CERTIFICATE_TTL_MS});
      return Object.freeze({claims, signature: sign(null, certificateSigningBytes(claims), signingKey).toString('base64')});
    }
    return Object.freeze({serverPublicKey,
      issueChallenge(input) {
        return enqueue(() => {
          shape(input, ['action', 'identity', 'name'], ['avatarHash']);
          if (!['register', 'claim-owner'].includes(input.action)) fail('ACCOUNT_ACTION', 'Unsupported account action.');
          const identity = readIdentity(input.identity), profile = normalizeAccountProfile({name: input.name, avatarHash: input.avatarHash});
          const time = clock(); sweep(time);
          if (input.action === 'claim-owner' && state.owner.status !== 'reserved') fail('ACCOUNT_OWNER_UNAVAILABLE', 'The owner slot is already claimed.');
          if (challenges.size >= MAX_CHALLENGES || [...challenges.values()].filter(item => item.identity.publicKey === identity.publicKey).length >= MAX_DEVICE_CHALLENGES) {
            fail('ACCOUNT_CHALLENGE_LIMIT', 'Too many pending account challenges.');
          }
          const payload = {v: 1, challengeId: randomBytes(32).toString('base64url'), action: input.action,
            registryId: state.registryId, issuerKeyId, identity, profile, issuedAt: time, expiresAt: time + CHALLENGE_TTL_MS};
          const challenge = Object.freeze({...payload, transcriptHash: accountChallengeTranscript(payload)});
          challenges.set(challenge.challengeId, challenge); return challenge;
        });
      },
      completeChallenge(input) {
        return enqueue(async () => {
          shape(input, ['challengeId', 'signature'], ['ownerBootstrapSecret']); token(input.challengeId);
          const time = clock(), challenge = challenges.get(input.challengeId);
          // Every completion attempt burns its nonce, including bad proof or
          // bad bootstrap capability. Restart also invalidates pending nonces.
          challenges.delete(input.challengeId); sweep(time);
          if (!challenge || challenge.expiresAt <= time || challenge.issuedAt > time + CLOCK_SKEW_MS) {
            fail('ACCOUNT_CHALLENGE_INVALID', 'The account challenge expired or was already used.');
          }
          try { verifyDeviceProof({identity: challenge.identity, transcriptHash: accountChallengeTranscript(challenge), signature: input.signature}); }
          catch { fail('ACCOUNT_DEVICE_PROOF_INVALID', 'The device did not prove possession of its account key.'); }
          const existing = state.accounts.find(item => item.publicKey === challenge.identity.publicKey);
          if (!existing && state.accounts.some(item => item.deviceId === challenge.identity.deviceId)) fail('ACCOUNT_DEVICE_COLLISION', 'The device identifier is already bound to another key.');
          let accountId;
          if (challenge.action === 'claim-owner') {
            if (state.owner.status !== 'reserved') fail('ACCOUNT_OWNER_UNAVAILABLE', 'The owner slot is already claimed.');
            if (existing) fail('ACCOUNT_ALREADY_REGISTERED', 'The owner bootstrap requires a device key that has not registered another account.');
            if (!equalHash(bootstrapHash(input.ownerBootstrapSecret, state.registryId), state.owner.bootstrapHash)) {
              fail('ACCOUNT_BOOTSTRAP_INVALID', 'The owner bootstrap capability is invalid.');
            }
            accountId = 1;
          } else {
            if (input.ownerBootstrapSecret !== undefined) fail('ACCOUNT_ACTION', 'An owner bootstrap capability is not accepted for normal registration.');
            accountId = existing ? existing.accountId : state.nextId;
          }
          // Reserve actual capacity for ID1 as well as its number. Normal
          // visitors cannot exhaust the last slot before the owner claims it.
          const capacity = state.owner.status === 'reserved' && challenge.action === 'register' ? MAX_ACCOUNTS - 1 : MAX_ACCOUNTS;
          if (!existing && state.accounts.length >= capacity) fail('ACCOUNT_CAPACITY', 'The prototype account registry has reached its account limit.');
          const account = {accountId, deviceId: challenge.identity.deviceId, publicKey: challenge.identity.publicKey,
            name: challenge.profile.name, avatarHash: challenge.profile.avatarHash, createdAt: existing?.createdAt ?? time, updatedAt: Math.max(time, existing?.updatedAt ?? time)};
          const signed = certificate(account, time);
          const next = {...state, revision: state.revision + 1,
            nextId: !existing && accountId !== 1 ? state.nextId + 1 : state.nextId,
            owner: accountId === 1 && challenge.action === 'claim-owner'
              ? {accountId: 1, status: 'claimed', deviceId: account.deviceId, bootstrapHash: null} : {...state.owner},
            accounts: [...state.accounts.filter(item => item.publicKey !== account.publicKey), account].sort((a, b) => a.accountId - b.accountId)};
          // ID allocation, identity binding and owner secret consumption become
          // visible together, only after file+directory fsync has succeeded.
          await commit(next);
          return Object.freeze({accountId, certificate: signed});
        });
      },
      close() {
        if (closing) return closing;
        accepting = false;
        closing = tail.then(async () => { challenges.clear(); await fs.rmdir(lock); ownsLock = false; });
        return closing;
      }
    });
  } catch (error) {
    if (ownsLock) await fs.rmdir(lock).catch(() => {});
    if (error instanceof MouseAccountError) throw error;
    fail('ACCOUNT_STORAGE', 'The private account registry is unavailable.');
  }
}

module.exports = {openAccountRegistry, verifyAccountCertificate, REGISTRY_FILENAME,
  MAX_ACCOUNTS, MAX_CHALLENGES, MAX_DEVICE_CHALLENGES};
