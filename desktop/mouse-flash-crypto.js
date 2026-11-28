/* Mouse Flash v1: invitation capabilities and authenticated opaque signaling.
 * Loaded only by packaged Mouse code. Never navigate to an invitation or send
 * its secret to the rendezvous broker. Reconnect uses a new room/secret/attempt.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MouseFlashCrypto = api;
})(globalThis, function (root) {
  'use strict';
  const crypto = root.crypto && root.crypto.subtle ? root.crypto
    : (typeof require === 'function' ? require('node:crypto').webcrypto : null);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const MAX_SIGNAL_PLAINTEXT_BYTES = 65536;
  const INVITE_TTL_MS = 30 * 60 * 1000;
  const INVITE_PREFIX = 'mouse-flash://join#';
  const ENVELOPE_KEYS = ['v', 'roomId', 'attemptId', 'fromRole', 'seq', 'iv', 'ciphertext'];

  class FlashCryptoError extends Error {
    constructor(code, message) { super(message); this.name = 'FlashCryptoError'; this.code = code; }
  }
  function fail(code, message) { throw new FlashCryptoError(code, message); }
  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }
  function exactKeys(value, keys) {
    if (!object(value) || Object.keys(value).length !== keys.length
      || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
      fail('INVALID_FORMAT', 'Unexpected message fields.');
    }
  }
  function encode64(bytes) {
    let raw = '';
    for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function decode64(value, { bytes, min = 0, max = 131072 } = {}) {
    if (typeof value !== 'string' || value.length > Math.ceil(max * 4 / 3)
      || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
      fail('INVALID_FORMAT', 'Invalid encoded field.');
    }
    let raw;
    try { raw = atob(value.replace(/-/g, '+').replace(/_/g, '/')); }
    catch { fail('INVALID_FORMAT', 'Invalid encoded field.'); }
    const result = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    if (result.length < min || result.length > max || (bytes !== undefined && result.length !== bytes)
      || encode64(result) !== value) fail('INVALID_FORMAT', 'Invalid encoded field length.');
    return result;
  }
  function requireCrypto() {
    if (!crypto || !crypto.subtle || !crypto.getRandomValues) fail('CRYPTO_UNAVAILABLE', 'Web Crypto is required.');
  }
  function randomId(bytes = 16) {
    requireCrypto();
    if (!Number.isInteger(bytes) || bytes < 16 || bytes > 64) fail('INVALID_FORMAT', 'Random identifier size is invalid.');
    return encode64(crypto.getRandomValues(new Uint8Array(bytes)));
  }
  function normalizeBrokerURL(input) {
    if (typeof input !== 'string' || input.length > 2048) fail('BROKER_URL', 'Invalid broker address.');
    let url;
    try { url = new URL(input); } catch { fail('BROKER_URL', 'Invalid broker address.'); }
    const local = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password
      || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
      fail('BROKER_URL', 'Use an HTTPS broker origin, or HTTP loopback for local testing.');
    }
    return url.origin;
  }
  function validateInvitation(value, now) {
    exactKeys(value, ['v', 'broker', 'roomId', 'joinToken', 'expiresAt', 'secret', 'attemptId']);
    if (value.v !== 1) fail('VERSION', 'Unsupported invitation version.');
    decode64(value.roomId, { bytes: 16 }); decode64(value.attemptId, { bytes: 16 });
    decode64(value.joinToken, { bytes: 32 }); decode64(value.secret, { bytes: 32 });
    if (!Number.isSafeInteger(value.expiresAt) || !Number.isSafeInteger(now)
      || value.expiresAt <= now) fail('INVITE_EXPIRED', 'The invitation has expired.');
    // A small clock allowance does not extend the broker's authoritative lease.
    if (value.expiresAt > now + INVITE_TTL_MS + 60000) fail('INVALID_FORMAT', 'Invitation lifetime is too long.');
    const broker = normalizeBrokerURL(value.broker);
    if (broker !== value.broker) fail('BROKER_URL', 'The broker origin is not canonical.');
    return Object.freeze({ ...value });
  }
  function createInvite(input, { now = Date.now() } = {}) {
    if (!object(input)) fail('INVALID_FORMAT', 'Invitation parameters are required.');
    const invitation = validateInvitation({ v: 1, broker: normalizeBrokerURL(input.broker), roomId: input.roomId,
      joinToken: input.joinToken, expiresAt: input.expiresAt,
      secret: input.secret === undefined ? randomId(32) : input.secret,
      attemptId: input.attemptId === undefined ? randomId(16) : input.attemptId }, now);
    const text = INVITE_PREFIX + encode64(encoder.encode(JSON.stringify(invitation)));
    return Object.freeze({ ...invitation, text });
  }
  function parseInvite(text, { now = Date.now() } = {}) {
    if (typeof text !== 'string' || text.length > 8192 || !text.startsWith(INVITE_PREFIX)) {
      fail('INVALID_FORMAT', 'Paste a complete Mouse Flash invitation.');
    }
    let parsed;
    try { parsed = JSON.parse(decoder.decode(decode64(text.slice(INVITE_PREFIX.length), { max: 6144 }))); }
    catch (error) { if (error instanceof FlashCryptoError) throw error; fail('INVALID_FORMAT', 'Invalid invitation.'); }
    return Object.freeze({ ...validateInvitation(parsed, now), text });
  }
  function inspectSignalEnvelope(value) {
    exactKeys(value, ENVELOPE_KEYS);
    if (value.v !== 1) fail('VERSION', 'Unsupported signaling version.');
    decode64(value.roomId, { bytes: 16 }); decode64(value.attemptId, { bytes: 16 });
    if (!['host', 'join'].includes(value.fromRole)) fail('INVALID_FORMAT', 'Invalid signaling role.');
    if (!Number.isSafeInteger(value.seq) || value.seq < 1 || value.seq > 0xffffffff) fail('INVALID_FORMAT', 'Invalid signaling sequence.');
    decode64(value.iv, { bytes: 12 });
    decode64(value.ciphertext, { min: 16, max: MAX_SIGNAL_PLAINTEXT_BYTES + 16 });
    return value;
  }
  function sessionContext(input) {
    if (!object(input)) fail('INVALID_FORMAT', 'A signaling context is required.');
    const secret = decode64(input.secret, { bytes: 32 });
    decode64(input.roomId, { bytes: 16 }); decode64(input.attemptId, { bytes: 16 });
    return { secret, roomId: input.roomId, attemptId: input.attemptId,
      salt: encoder.encode(JSON.stringify(['MouseFlash', 1, input.roomId, input.attemptId])) };
  }
  async function importMaster(context) {
    requireCrypto();
    return crypto.subtle.importKey('raw', context.secret, 'HKDF', false, ['deriveKey']);
  }
  function derive(master, context, label, algorithm, usages) {
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: context.salt,
      info: encoder.encode('MouseFlash/v1/' + label) }, master, algorithm, false, usages);
  }
  function aad(envelope) {
    return encoder.encode(JSON.stringify(['MouseFlash', 1, envelope.roomId, envelope.attemptId, envelope.fromRole, envelope.seq]));
  }
  async function createSignalBox(input) {
    const context = sessionContext(input);
    const role = input.role;
    if (!['host', 'join'].includes(role)) fail('INVALID_FORMAT', 'Invalid signaling role.');
    const remoteRole = role === 'host' ? 'join' : 'host';
    const master = await importMaster(context);
    const [sendKey, receiveKey] = await Promise.all([role, remoteRole].map(fromRole =>
      derive(master, context, 'signal/' + fromRole, { name: 'AES-GCM', length: 256 }, ['encrypt', 'decrypt'])));
    context.secret.fill(0);
    let sent = 0, received = 0, sendChain = Promise.resolve(), receiveChain = Promise.resolve();
    async function sealOne(payload) {
      if (!object(payload)) fail('INVALID_FORMAT', 'Signaling payload must be an object.');
      let bytes;
      try { bytes = encoder.encode(JSON.stringify(payload)); } catch { fail('INVALID_FORMAT', 'Signaling payload is not JSON.'); }
      if (bytes.length > MAX_SIGNAL_PLAINTEXT_BYTES) fail('MESSAGE_TOO_LARGE', 'Signaling payload is too large.');
      if (sent === 0xffffffff) fail('SEQUENCE_EXHAUSTED', 'Create a new invitation.');
      const envelope = { v: 1, roomId: context.roomId, attemptId: context.attemptId, fromRole: role, seq: ++sent };
      // Fresh CSPRNG IV for every small signaling message; never encrypt file data here.
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(envelope), tagLength: 128 }, sendKey, bytes);
      return Object.freeze({ ...envelope, iv: encode64(iv), ciphertext: encode64(new Uint8Array(ciphertext)) });
    }
    async function openOne(envelope) {
      inspectSignalEnvelope(envelope);
      if (envelope.roomId !== context.roomId || envelope.attemptId !== context.attemptId) fail('CONTEXT_MISMATCH', 'Signaling session does not match.');
      if (envelope.fromRole !== remoteRole) fail('ROLE_MISMATCH', 'Signaling direction does not match.');
      if (envelope.seq <= received) fail('REPLAY', 'Signaling message was already processed.');
      if (envelope.seq !== received + 1) fail('SEQUENCE_GAP', 'Signaling messages are out of sequence.');
      let bytes;
      try {
        bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(envelope.iv, { bytes: 12 }),
          additionalData: aad(envelope), tagLength: 128 }, receiveKey,
        decode64(envelope.ciphertext, { min: 16, max: MAX_SIGNAL_PLAINTEXT_BYTES + 16 }));
      } catch { fail('AUTH_FAILED', 'Signaling authentication failed.'); }
      let payload;
      try { payload = JSON.parse(decoder.decode(bytes)); } catch { fail('INVALID_FORMAT', 'Invalid authenticated signaling payload.'); }
      if (!object(payload)) fail('INVALID_FORMAT', 'Signaling payload must be an object.');
      received = envelope.seq;
      return payload;
    }
    return Object.freeze({
      seal(payload) { const result = sendChain.then(() => sealOne(payload)); sendChain = result.catch(() => {}); return result; },
      open(envelope) { const result = receiveChain.then(() => openOne(envelope)); receiveChain = result.catch(() => {}); return result; }
    });
  }
  async function transcriptCode(input) {
    const context = sessionContext(input);
    for (const key of ['offer', 'answer']) {
      if (typeof input[key] !== 'string' || encoder.encode(input[key]).length > MAX_SIGNAL_PLAINTEXT_BYTES) fail('INVALID_FORMAT', 'Full SDP descriptions are required.');
    }
    const manifestHash = input.manifestHash || '';
    if (manifestHash && !/^[a-f0-9]{64}$/.test(manifestHash)) fail('INVALID_FORMAT', 'Invalid manifest digest.');
    const hostDeviceId = input.hostDeviceId || '', joinDeviceId = input.joinDeviceId || '';
    if ([hostDeviceId, joinDeviceId].some(id => typeof id !== 'string' || id.length > 256)) fail('INVALID_FORMAT', 'Invalid device identifier.');
    const transcript = encoder.encode(JSON.stringify(['MouseFlash', 1, context.roomId, context.attemptId,
      input.offer, input.answer, manifestHash, hostDeviceId, joinDeviceId]));
    const master = await importMaster(context);
    const key = await derive(master, context, 'confirmation', { name: 'HMAC', hash: 'SHA-256', length: 256 }, ['sign']);
    context.secret.fill(0);
    const [mac, hash] = await Promise.all([crypto.subtle.sign('HMAC', key, transcript), crypto.subtle.digest('SHA-256', transcript)]);
    const hex = value => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
    const code = hex(mac).slice(0, 16).toUpperCase().match(/.{4}/g).join('-');
    return Object.freeze({ code, transcriptHash: hex(hash) });
  }
  return Object.freeze({ FlashCryptoError, MAX_SIGNAL_PLAINTEXT_BYTES, INVITE_TTL_MS, randomId,
    normalizeBrokerURL, createInvite, parseInvite, inspectSignalEnvelope, createSignalBox, transcriptCode });
});
