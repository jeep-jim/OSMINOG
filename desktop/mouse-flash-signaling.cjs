'use strict';

// Privileged, fixed-origin signaling proxy. Renderer-visible handles never
// contain the host/peer role bearer. The invitation secret never enters here.
const { randomBytes } = require('node:crypto');
const { inspectSignalEnvelope, INVITE_TTL_MS } = require('./mouse-flash-crypto.js');

const MAX_RESPONSE_BYTES = 320 * 1024;
const MAX_REQUEST_BYTES = 160 * 1024;
const MESSAGES = Object.freeze({
  SIGNAL_OFFLINE: 'Mouse Flash rendezvous is not configured.',
  BROKER_CONFIG: 'Use a configured HTTPS broker, or explicit HTTP loopback for local testing.',
  BROKER_MISMATCH: 'This invitation uses a different rendezvous service.',
  SIGNAL_INPUT: 'Invalid Mouse Flash signaling request.',
  SIGNAL_OPERATION: 'Unsupported Mouse Flash signaling operation.',
  SIGNAL_SESSION: 'This signaling session is unavailable.',
  SIGNAL_CAPACITY: 'Close an existing signaling session before creating another.',
  SIGNAL_EXPIRED: 'The invitation expired. Create a new invitation.',
  SIGNAL_ABORTED: 'The signaling session was closed.',
  SIGNAL_TIMEOUT: 'The rendezvous request timed out.',
  SIGNAL_NETWORK: 'The rendezvous service could not be reached.',
  BROKER_REDIRECT: 'Rendezvous redirects are not allowed.',
  BROKER_RESPONSE: 'The rendezvous service returned an invalid response.',
  BROKER_RESPONSE_TOO_LARGE: 'The rendezvous response exceeded its size limit.',
  BROKER_UNAUTHORIZED: 'The rendezvous capability is no longer valid.',
  BROKER_CONFLICT: 'The rendezvous session is no longer in the expected state.',
  BROKER_LIMIT: 'The rendezvous service reached a temporary limit.',
  BROKER_UNAVAILABLE: 'The rendezvous service is unavailable.'
});
class FlashSignalingError extends Error {
  constructor(code, status) { super(MESSAGES[code] || MESSAGES.BROKER_RESPONSE); this.name = 'FlashSignalingError'; this.code = code; if (status) this.status = status; }
}
function fail(code, status) { throw new FlashSignalingError(code, status); }
function shape(value, required, optional = [], code = 'SIGNAL_INPUT') {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail(code);
}
function encoded(value, bytes, code = 'SIGNAL_INPUT') {
  if (typeof value !== 'string' || value.length !== Math.ceil(bytes * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value)) fail(code);
  const buffer = Buffer.from(value, 'base64url');
  if (buffer.length !== bytes || buffer.toString('base64url') !== value) fail(code);
  return value;
}
function normalizeBroker(input, allowLoopback) {
  if (typeof input !== 'string' || input.length > 2048) fail('BROKER_CONFIG');
  let url;
  try { url = new URL(input); } catch { fail('BROKER_CONFIG'); }
  if ((url.protocol !== 'https:' && !(allowLoopback && url.protocol === 'http:' && url.hostname === '127.0.0.1'))
    || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) fail('BROKER_CONFIG');
  return url.origin;
}
function expiry(value, expected) {
  if (!Number.isSafeInteger(value) || value <= Date.now() || value > Date.now() + INVITE_TTL_MS + 60000
    || (expected !== undefined && value !== expected)) fail('BROKER_RESPONSE');
  return value;
}
function cursor(value, minimum = 0, code = 'BROKER_RESPONSE') {
  if (!Number.isSafeInteger(value) || value < minimum) fail(code);
  return value;
}

class NativeSignalClient {
  #broker; #allowLoopback; #fetch; #timeoutMs; #sessions = new Map(); #pending = new Set(); #disposed = false;
  constructor({ broker, allowLoopback = false, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
    if (typeof fetchImpl !== 'function' || typeof allowLoopback !== 'boolean'
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) fail('BROKER_CONFIG');
    this.#allowLoopback = allowLoopback;
    this.#broker = broker === undefined || broker === null || broker === '' ? null : normalizeBroker(broker, allowLoopback);
    this.#fetch = fetchImpl; this.#timeoutMs = timeoutMs;
  }
  #configured(input) {
    if (this.#disposed) fail('SIGNAL_ABORTED');
    if (!this.#broker) fail('SIGNAL_OFFLINE');
    if (input !== undefined) {
      let other;
      try { other = normalizeBroker(input, this.#allowLoopback); } catch { fail('BROKER_MISMATCH'); }
      if (other !== this.#broker) fail('BROKER_MISMATCH');
    }
    return this.#broker;
  }
  #invalidate(signalId, entry) {
    this.#sessions.delete(signalId);
    for (const controller of entry.controllers) controller.abort('closed');
  }
  #entry(signalId) {
    encoded(signalId, 16);
    const entry = this.#sessions.get(signalId);
    if (!entry) fail('SIGNAL_SESSION');
    if (entry.expiresAt <= Date.now()) { this.#invalidate(signalId, entry); fail('SIGNAL_EXPIRED'); }
    return entry;
  }
  async #request(method, pathname, { token, body, entry } = {}) {
    const broker = this.#configured();
    if (this.#pending.size >= 16) fail('SIGNAL_CAPACITY');
    const controller = new AbortController(); this.#pending.add(controller); if (entry) entry.controllers.add(controller);
    const timer = setTimeout(() => controller.abort('timeout'), this.#timeoutMs);
    let reader, onAbort, response;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(new FlashSignalingError(controller.signal.reason === 'timeout' ? 'SIGNAL_TIMEOUT' : 'SIGNAL_ABORTED'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      if (payload !== undefined && Buffer.byteLength(payload) > MAX_REQUEST_BYTES) fail('SIGNAL_INPUT');
      response = await Promise.race([this.#fetch(broker + pathname, {
        method, redirect: 'manual', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(payload !== undefined ? { body: payload } : {})
      }), aborted]);
      if (response.redirected || (response.status >= 300 && response.status < 400)) fail('BROKER_REDIRECT');
      if (!Number.isInteger(response.status) || response.status < 200 || response.status > 599) fail('BROKER_RESPONSE');
      const type = response.headers.get('content-type') || '';
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)) fail('BROKER_RESPONSE');
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) fail('BROKER_RESPONSE_TOO_LARGE');
      if (!response.body || typeof response.body.getReader !== 'function') fail('BROKER_RESPONSE');
      reader = response.body.getReader();
      const chunks = []; let size = 0;
      while (true) {
        const part = await Promise.race([reader.read(), aborted]);
        if (part.done) break;
        if (!(part.value instanceof Uint8Array)) fail('BROKER_RESPONSE');
        size += part.value.byteLength;
        if (size > MAX_RESPONSE_BYTES) fail('BROKER_RESPONSE_TOO_LARGE');
        chunks.push(Buffer.from(part.value));
      }
      let result;
      try { result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))); }
      catch { fail('BROKER_RESPONSE'); }
      if (response.status >= 400) {
        // Never relay a remote error body/message: it could echo role tokens or SDP.
        if ([401, 403].includes(response.status)) fail('BROKER_UNAUTHORIZED', response.status);
        if ([404, 410].includes(response.status)) fail('SIGNAL_EXPIRED', response.status);
        if (response.status === 409) fail('BROKER_CONFLICT', response.status);
        if ([413, 429, 503].includes(response.status)) fail('BROKER_LIMIT', response.status);
        fail('BROKER_UNAVAILABLE', response.status);
      }
      return result;
    } catch (error) {
      if (error instanceof FlashSignalingError) throw error;
      if (controller.signal.aborted) fail(controller.signal.reason === 'timeout' ? 'SIGNAL_TIMEOUT' : 'SIGNAL_ABORTED');
      fail('SIGNAL_NETWORK');
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort);
      this.#pending.delete(controller); if (entry) entry.controllers.delete(controller);
      if (!controller.signal.aborted) controller.abort('finished');
      if (reader) { Promise.resolve(reader.cancel()).catch(() => {}); try { reader.releaseLock(); } catch {} }
      else if (response && response.body) Promise.resolve(response.body.cancel()).catch(() => {});
    }
  }
  #remember({ roomId, role, token, expiresAt }) {
    if (this.#disposed) fail('SIGNAL_ABORTED');
    if (this.#sessions.size >= 64) fail('SIGNAL_CAPACITY');
    const signalId = randomBytes(16).toString('base64url');
    this.#sessions.set(signalId, { roomId, role, token, expiresAt, controllers: new Set(), attemptId: null });
    return signalId;
  }
  async call(input) {
    shape(input, ['operation'], ['broker', 'roomId', 'joinToken', 'signalId', 'envelope', 'after']);
    switch (input.operation) {
      case 'create': {
        shape(input, ['operation'], ['broker']); this.#configured(input.broker);
        if (this.#sessions.size >= 64) fail('SIGNAL_CAPACITY');
        const result = await this.#request('POST', '/v1/rooms', { body: {} });
        shape(result, ['v', 'roomId', 'hostToken', 'joinToken', 'expiresAt'], [], 'BROKER_RESPONSE');
        if (result.v !== 1) fail('BROKER_RESPONSE');
        encoded(result.roomId, 16, 'BROKER_RESPONSE'); encoded(result.hostToken, 32, 'BROKER_RESPONSE'); encoded(result.joinToken, 32, 'BROKER_RESPONSE'); expiry(result.expiresAt);
        if (result.hostToken === result.joinToken) fail('BROKER_RESPONSE');
        const signalId = this.#remember({ roomId: result.roomId, role: 'host', token: result.hostToken, expiresAt: result.expiresAt });
        return Object.freeze({ signalId, broker: this.#broker, roomId: result.roomId, joinToken: result.joinToken, expiresAt: result.expiresAt, role: 'host' });
      }
      case 'join': {
        shape(input, ['operation', 'broker', 'roomId', 'joinToken']); this.#configured(input.broker);
        if (this.#sessions.size >= 64) fail('SIGNAL_CAPACITY');
        encoded(input.roomId, 16); encoded(input.joinToken, 32);
        const result = await this.#request('POST', `/v1/rooms/${input.roomId}/join`, { token: input.joinToken, body: {} });
        shape(result, ['v', 'roomId', 'role', 'peerToken', 'expiresAt'], [], 'BROKER_RESPONSE');
        if (result.v !== 1 || result.roomId !== input.roomId || result.role !== 'join') fail('BROKER_RESPONSE');
        encoded(result.peerToken, 32, 'BROKER_RESPONSE'); expiry(result.expiresAt);
        if (result.peerToken === input.joinToken) fail('BROKER_RESPONSE');
        const signalId = this.#remember({ roomId: result.roomId, role: 'join', token: result.peerToken, expiresAt: result.expiresAt });
        return Object.freeze({ signalId, broker: this.#broker, roomId: result.roomId, expiresAt: result.expiresAt, role: 'join' });
      }
      case 'send': {
        shape(input, ['operation', 'signalId', 'envelope']); const entry = this.#entry(input.signalId);
        try { inspectSignalEnvelope(input.envelope); } catch { fail('SIGNAL_INPUT'); }
        if (input.envelope.roomId !== entry.roomId || input.envelope.fromRole !== entry.role
          || (entry.attemptId && input.envelope.attemptId !== entry.attemptId)) fail('SIGNAL_INPUT');
        const result = await this.#request('POST', `/v1/rooms/${entry.roomId}/messages`, { token: entry.token, body: { envelope: input.envelope }, entry });
        shape(result, ['v', 'cursor'], [], 'BROKER_RESPONSE'); if (result.v !== 1) fail('BROKER_RESPONSE'); cursor(result.cursor, 1);
        if (!this.#sessions.has(input.signalId)) fail('SIGNAL_ABORTED');
        entry.attemptId = input.envelope.attemptId;
        return Object.freeze({ v: 1, cursor: result.cursor });
      }
      case 'poll': {
        shape(input, ['operation', 'signalId'], ['after']); const entry = this.#entry(input.signalId);
        const after = input.after === undefined ? 0 : cursor(input.after, 0, 'SIGNAL_INPUT');
        const result = await this.#request('GET', `/v1/rooms/${entry.roomId}/messages?after=${after}`, { token: entry.token, entry });
        shape(result, ['v', 'messages', 'cursor', 'peerJoined', 'expiresAt'], [], 'BROKER_RESPONSE');
        if (result.v !== 1 || typeof result.peerJoined !== 'boolean' || !Array.isArray(result.messages) || result.messages.length > 128) fail('BROKER_RESPONSE');
        expiry(result.expiresAt, entry.expiresAt); cursor(result.cursor, after);
        let last = after;
        for (const message of result.messages) {
          shape(message, ['cursor', 'envelope'], [], 'BROKER_RESPONSE'); cursor(message.cursor, last + 1);
          try { inspectSignalEnvelope(message.envelope); } catch { fail('BROKER_RESPONSE'); }
          if (message.envelope.roomId !== entry.roomId || message.envelope.fromRole === entry.role
            || (entry.attemptId && message.envelope.attemptId !== entry.attemptId)) fail('BROKER_RESPONSE');
          last = message.cursor;
        }
        if (result.cursor !== last) fail('BROKER_RESPONSE');
        if (!this.#sessions.has(input.signalId)) fail('SIGNAL_ABORTED');
        return result;
      }
      case 'close': {
        shape(input, ['operation', 'signalId']); encoded(input.signalId, 16);
        const entry = this.#sessions.get(input.signalId);
        if (!entry) return Object.freeze({ closed: true });
        this.#invalidate(input.signalId, entry);
        // Local invalidation/abort is final even if the remote broker has expired.
        try { await this.#request('DELETE', `/v1/rooms/${entry.roomId}`, { token: entry.token }); } catch {}
        return Object.freeze({ closed: true });
      }
      default: fail('SIGNAL_OPERATION');
    }
  }
  async dispose() {
    if (this.#disposed) return;
    for (const controller of this.#pending) controller.abort('closed');
    const closing = [...this.#sessions.keys()].map(signalId => this.call({ operation: 'close', signalId }));
    this.#disposed = true;
    await Promise.all(closing);
  }
}
module.exports = { NativeSignalClient, FlashSignalingError, MAX_RESPONSE_BYTES };
