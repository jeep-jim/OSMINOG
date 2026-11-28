'use strict';

// The caller injects Electron safeStorage only when OS protection is available.
// There is deliberately no plaintext or application-embedded-key fallback.
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { createHash, createPrivateKey, createPublicKey, generateKeyPairSync,
  randomBytes, sign: signBytes, verify: verifyBytes } = require('node:crypto');

const IDENTITY_FILENAME = 'mouse-flash-identity.json';
const MAX_RECORD_BYTES = 32768;
class FlashIdentityError extends Error {
  constructor(code, message) { super(message); this.name = 'FlashIdentityError'; this.code = code; }
}
function fail(code, message) { throw new FlashIdentityError(code, message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function base64(value, { bytes, maximum = 16384 } = {}) {
  if (typeof value !== 'string' || value.length > Math.ceil(maximum / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    fail('IDENTITY_FORMAT', 'Invalid identity encoding.');
  }
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.length > maximum || (bytes !== undefined && buffer.length !== bytes)
    || buffer.toString('base64') !== value) fail('IDENTITY_FORMAT', 'Invalid identity field length.');
  return buffer;
}
function deviceName(value) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > 256 || /[\u0000-\u001f\u007f]/.test(value)) {
    fail('IDENTITY_FORMAT', 'Invalid device name.');
  }
  return value.trim();
}
function transcript(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('IDENTITY_TRANSCRIPT', 'A SHA-256 transcript digest is required.');
  return Buffer.from('MouseFlashIdentity:v1:' + value, 'utf8');
}
function publicIdentity(publicKey, name) {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return Object.freeze({ deviceId: createHash('sha256').update(der).digest('hex').slice(0, 32),
    name: deviceName(name), publicKey: der.toString('base64') });
}
function readPublic(identity) {
  if (!object(identity) || Object.keys(identity).some(key => !['deviceId', 'name', 'publicKey'].includes(key))
    || typeof identity.deviceId !== 'string' || !/^[a-f0-9]{32}$/.test(identity.deviceId)) fail('IDENTITY_FORMAT', 'Invalid peer identity.');
  deviceName(identity.name);
  const der = base64(identity.publicKey, { bytes: 44 });
  let key;
  try { key = createPublicKey({ key: der, type: 'spki', format: 'der' }); }
  catch { fail('IDENTITY_FORMAT', 'Invalid peer public key.'); }
  if (key.asymmetricKeyType !== 'ed25519' || !key.export({ type: 'spki', format: 'der' }).equals(der)
    || publicIdentity(key, identity.name).deviceId !== identity.deviceId) fail('IDENTITY_FORMAT', 'Peer identity does not match its public key.');
  return key;
}
function verify({ identity, transcriptHash, signature } = {}) {
  const message = transcript(transcriptHash), publicKey = readPublic(identity);
  const bytes = base64(signature, { bytes: 64 });
  if (!verifyBytes(null, message, publicKey, bytes)) fail('IDENTITY_PROOF_INVALID', 'The peer did not prove possession of this device key.');
  return Object.freeze({ ok: true, deviceId: identity.deviceId });
}
async function prepareDirectory(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) fail('IDENTITY_STORAGE', 'An absolute private identity directory is required.');
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('IDENTITY_STORAGE', 'The identity directory must be a real directory.');
    await fs.chmod(directory, 0o700);
  } catch (error) {
    if (error instanceof FlashIdentityError) throw error;
    fail('IDENTITY_STORAGE', 'The private identity directory is unavailable.');
  }
}
async function readRecord(filename) {
  let handle;
  try {
    handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_RECORD_BYTES) fail('IDENTITY_FORMAT', 'Invalid identity record.');
    await handle.chmod(0o600);
    const buffer = Buffer.alloc(MAX_RECORD_BYTES + 1); let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_RECORD_BYTES) fail('IDENTITY_FORMAT', 'Identity record is too large.');
    let record;
    try { record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length))); }
    catch { fail('IDENTITY_FORMAT', 'Invalid identity record.'); }
    if (!object(record) || record.v !== 1 || Object.keys(record).length !== 3
      || !Object.hasOwn(record, 'publicKey') || !Object.hasOwn(record, 'privateKeyCiphertext')) fail('IDENTITY_FORMAT', 'Invalid identity record schema.');
    return record;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof FlashIdentityError) throw error;
    fail('IDENTITY_STORAGE', 'The protected identity record is unavailable.');
  } finally { if (handle) await handle.close(); }
}
async function decodeRecord(record, unprotect) {
  const publicDer = base64(record.publicKey, { bytes: 44 });
  const ciphertext = base64(record.privateKeyCiphertext);
  let plaintext;
  try { plaintext = await unprotect(ciphertext); }
  catch { fail('IDENTITY_PROTECTION', 'OS protection could not unlock the device identity.'); }
  let privateDer;
  try { privateDer = base64(plaintext, { bytes: 48 }); }
  catch { fail('IDENTITY_PROTECTION', 'OS protection returned an invalid device key.'); }
  try {
    const privateKey = createPrivateKey({ key: privateDer, type: 'pkcs8', format: 'der' });
    if (privateKey.asymmetricKeyType !== 'ed25519' || !privateKey.export({ type: 'pkcs8', format: 'der' }).equals(privateDer)) fail('IDENTITY_FORMAT', 'Invalid protected device key.');
    const publicKey = createPublicKey(privateKey);
    if (!publicKey.export({ type: 'spki', format: 'der' }).equals(publicDer)) fail('IDENTITY_KEY_MISMATCH', 'The public and protected device keys do not match.');
    return { privateKey, publicKey };
  } catch (error) {
    if (error instanceof FlashIdentityError) throw error;
    fail('IDENTITY_FORMAT', 'Invalid protected device key.');
  } finally { privateDer.fill(0); }
}
async function syncDirectory(directory) {
  const handle = await fs.open(directory, constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function publishRecord(directory, filename, record) {
  const temporary = path.join(directory, '.flash-identity-' + randomBytes(16).toString('hex') + '.tmp');
  let handle;
  try {
    handle = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600);
    await handle.writeFile(JSON.stringify(record) + '\n', 'utf8'); await handle.sync(); await handle.close(); handle = null;
    try { await fs.link(temporary, filename); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await fs.unlink(temporary); await syncDirectory(directory);
  } catch {
    fail('IDENTITY_STORAGE', 'The protected device identity could not be committed.');
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw new FlashIdentityError('IDENTITY_STORAGE', 'Identity temporary cleanup failed.'); });
  }
}
async function loadIdentity({ directory, name = 'Mac', protect, unprotect } = {}) {
  name = deviceName(name);
  if (typeof protect !== 'function' || typeof unprotect !== 'function') fail('IDENTITY_PROTECTION_UNAVAILABLE', 'OS protected storage is required for Mouse Flash identity.');
  await prepareDirectory(directory);
  const filename = path.join(directory, IDENTITY_FILENAME);
  let record = await readRecord(filename);
  if (!record) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const privateDer = privateKey.export({ type: 'pkcs8', format: 'der' });
    let encrypted;
    try { encrypted = await protect(privateDer.toString('base64')); }
    catch { fail('IDENTITY_PROTECTION', 'OS protection could not secure the device identity.'); }
    finally { privateDer.fill(0); }
    if (!Buffer.isBuffer(encrypted) || encrypted.length < 1 || encrypted.length > 16384) fail('IDENTITY_PROTECTION', 'OS protection returned an invalid encrypted record.');
    record = { v: 1, publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), privateKeyCiphertext: encrypted.toString('base64') };
    // Detect a broken protector before any record becomes the persistent identity.
    await decodeRecord(record, unprotect);
    await publishRecord(directory, filename, record);
    // Another process may have won the non-replacing publication race.
    record = await readRecord(filename);
    if (!record) fail('IDENTITY_STORAGE', 'The protected identity disappeared before it could be loaded.');
  }
  const keys = await decodeRecord(record, unprotect);
  const identity = publicIdentity(keys.publicKey, name);
  return Object.freeze({ identity,
    sign(transcriptHash) { return Object.freeze({ signature: signBytes(null, transcript(transcriptHash), keys.privateKey).toString('base64') }); },
    verify
  });
}
module.exports = { loadIdentity, verify, FlashIdentityError, IDENTITY_FILENAME };
