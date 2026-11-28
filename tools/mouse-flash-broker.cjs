#!/usr/bin/env node
'use strict';

// Opaque, bounded rendezvous only. No file endpoint, content storage, payload
// logging, or TURN service. Deploy behind HTTPS; the standalone listener is
// loopback-only. Tokens and queues live in memory and disappear on shutdown.
const http = require('node:http');
const net = require('node:net');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { inspectSignalEnvelope, INVITE_TTL_MS } = require('../desktop/mouse-flash-crypto.js');

const DEFAULT_LIMITS = Object.freeze({
  maxRooms: 64, maxBodyBytes: 160 * 1024, maxMessageBytes: 128 * 1024,
  maxRoomQueueBytes: 1024 * 1024, maxTotalQueueBytes: 8 * 1024 * 1024,
  maxRoomQueuedMessages: 128, maxSignalsPerRole: 128, maxPollBytes: 256 * 1024,
  rateWindowMs: 60000, maxRequestsPerWindow: 600, maxCreatesPerWindow: 20,
  maxRateEntries: 1024
});
class BrokerError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const reject = (status, code, message) => { throw new BrokerError(status, code, message); };
const random = bytes => randomBytes(bytes).toString('base64url');
const digest = token => createHash('sha256').update(token).digest();
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function onlyKeys(value, keys) {
  if (!plain(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    reject(400, 'INVALID_BODY', 'Unexpected request fields.');
  }
}
function tokenFrom(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || '');
  if (!match) reject(401, 'UNAUTHORIZED', 'A valid role capability is required.');
  return digest(match[1]);
}
const matches = (left, right) => Boolean(right && timingSafeEqual(left, right));

function createFlashBroker(options = {}) {
  const now = options.now || Date.now;
  const ttlMs = options.ttlMs === undefined ? INVITE_TTL_MS : options.ttlMs;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > INVITE_TTL_MS) throw new TypeError('Invalid broker TTL.');
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  for (const [key, value] of Object.entries(limits)) {
    if (!Object.hasOwn(DEFAULT_LIMITS, key) || !Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid broker limit.');
  }
  if (limits.maxPollBytes < limits.maxMessageBytes) throw new TypeError('Poll capacity must fit a signaling message.');
  const allowedOrigins = new Set(options.allowedOrigins || []);
  if ([...allowedOrigins].some(origin => typeof origin !== 'string' || origin === '*' || origin === 'null'
    || new URL(origin).origin !== origin)) throw new TypeError('Use explicit trusted origins.');
  const rooms = new Map(), rates = new Map();
  let totalQueuedBytes = 0;
  function erase(roomId) {
    const room = rooms.get(roomId);
    if (room) { totalQueuedBytes -= room.queuedBytes; rooms.delete(roomId); }
  }
  function sweep() {
    const time = now();
    for (const [id, room] of rooms) if (room.expiresAt <= time) erase(id);
    for (const [ip, rate] of rates) if (rate.until <= time) rates.delete(ip);
  }
  function rateLimit(request, creating) {
    let ip = request.socket.remoteAddress || 'unknown';
    // Proxy trust is opt-in and pinned to the loopback peer, never an arbitrary
    // X-Forwarded-For value supplied by an Internet client.
    if (options.trustedProxy === true && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
      const forwarded = request.headers['x-mouse-client-ip'];
      if (typeof forwarded !== 'string' || !net.isIP(forwarded) || forwarded.includes('%')) reject(400, 'INVALID_CLIENT', 'A valid proxy client address is required.');
      ip = forwarded;
    }
    const time = now();
    let rate = rates.get(ip);
    if (!rate || rate.until <= time) {
      for (const [key, value] of rates) if (value.until <= time) rates.delete(key);
      if (!rates.has(ip) && rates.size >= limits.maxRateEntries) reject(429, 'RATE_LIMIT', 'Try again later.');
      rate = { until: time + limits.rateWindowMs, requests: 0, creates: 0 }; rates.set(ip, rate);
    }
    if (++rate.requests > limits.maxRequestsPerWindow || (creating && ++rate.creates > limits.maxCreatesPerWindow)) {
      reject(429, 'RATE_LIMIT', 'Try again later.');
    }
  }
  function findRoom(id) {
    const room = rooms.get(id);
    if (!room) reject(404, 'ROOM_UNAVAILABLE', 'The invitation is unavailable.');
    return room;
  }
  function assertLive(room) {
    if (room.expiresAt <= now()) { erase(room.id); reject(410, 'ROOM_EXPIRED', 'Create a new invitation.'); }
  }
  function authorize(request, room) {
    const hash = tokenFrom(request);
    const role = matches(hash, room.hostHash) ? 'host' : matches(hash, room.peerHash) ? 'join' : null;
    if (!role) reject(401, 'UNAUTHORIZED', 'A valid role capability is required.');
    assertLive(room); return role;
  }
  function respond(response, status, data, origin) {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
      ...(status === 429 ? { 'Retry-After': '60' } : {}),
      ...(status === 413 ? { Connection: 'close' } : {})
    });
    response.end(JSON.stringify(data));
  }
  async function readJSON(request) {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || '')) {
      reject(415, 'CONTENT_TYPE', 'JSON requests are required.');
    }
    if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') reject(415, 'CONTENT_ENCODING', 'Compressed bodies are not supported.');
    const declared = request.headers['content-length'];
    if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > limits.maxBodyBytes)) reject(413, 'BODY_TOO_LARGE', 'The signaling request is too large.');
    const data = await new Promise((resolve, rejectBody) => {
      const chunks = []; let size = 0, settled = false;
      const stop = error => { if (!settled) { settled = true; rejectBody(error); } };
      request.on('data', chunk => {
        if (settled) return;
        size += chunk.length;
        if (size > limits.maxBodyBytes) { request.pause(); stop(new BrokerError(413, 'BODY_TOO_LARGE', 'The signaling request is too large.')); }
        else chunks.push(chunk);
      });
      request.on('end', () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks)); } });
      request.on('aborted', () => stop(new BrokerError(400, 'BODY_ABORTED', 'The signaling request was interrupted.')));
      request.on('error', () => stop(new BrokerError(400, 'BODY_ABORTED', 'The signaling request was interrupted.')));
    });
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); }
    catch { reject(400, 'INVALID_JSON', 'Invalid JSON request.'); }
    return value;
  }
  const server = http.createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    let origin;
    try {
      if (request.headers.origin !== undefined) {
        if (!allowedOrigins.has(request.headers.origin)) reject(403, 'ORIGIN_REJECTED', 'This origin is not allowed.');
        origin = request.headers.origin;
      }
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'OPTIONS') {
        if (!origin) reject(403, 'ORIGIN_REJECTED', 'A trusted origin is required.');
        response.writeHead(204, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '300',
          'Cache-Control': 'no-store' }); response.end(); return;
      }
      const creating = request.method === 'POST' && url.pathname === '/v1/rooms';
      rateLimit(request, creating);
      if (creating) {
        if (url.search) reject(400, 'INVALID_QUERY', 'Unexpected query parameters.');
        onlyKeys(await readJSON(request), []); sweep();
        if (rooms.size >= limits.maxRooms) reject(503, 'ROOM_CAPACITY', 'Try again later.');
        const roomId = random(16), hostToken = random(32), joinToken = random(32), expiresAt = now() + ttlMs;
        rooms.set(roomId, { id: roomId, hostHash: digest(hostToken), joinHash: digest(joinToken), peerHash: null,
          expiresAt, attemptId: null, lastSeq: { host: 0, join: 0 }, cursor: 0, messages: [], queuedBytes: 0,
          delivered: { host: 0, join: 0 }, acked: { host: 0, join: 0 } });
        respond(response, 201, { v: 1, roomId, hostToken, joinToken, expiresAt }, origin); return;
      }
      const route = /^\/v1\/rooms\/([A-Za-z0-9_-]{22})(?:\/(join|messages))?$/.exec(url.pathname);
      if (!route) reject(404, 'NOT_FOUND', 'Unknown rendezvous endpoint.');
      const room = findRoom(route[1]), action = route[2];
      if (request.method === 'POST' && action === 'join') {
        if (!matches(tokenFrom(request), room.joinHash)) reject(401, 'UNAUTHORIZED', 'A valid invitation capability is required.');
        assertLive(room);
        if (room.peerHash) reject(409, 'ROOM_ALREADY_JOINED', 'This invitation has already been used.');
        if (url.search) reject(400, 'INVALID_QUERY', 'Unexpected query parameters.');
        onlyKeys(await readJSON(request), []);
        // Recheck after body parsing: simultaneous claims must not create a third peer.
        if (!rooms.has(room.id)) reject(404, 'ROOM_UNAVAILABLE', 'The invitation is unavailable.');
        assertLive(room);
        if (room.peerHash) reject(409, 'ROOM_ALREADY_JOINED', 'This invitation has already been used.');
        const peerToken = random(32); room.peerHash = digest(peerToken);
        respond(response, 200, { v: 1, roomId: room.id, role: 'join', peerToken, expiresAt: room.expiresAt }, origin); return;
      }
      const role = authorize(request, room);
      if (request.method === 'DELETE' && !action) {
        if (url.search) reject(400, 'INVALID_QUERY', 'Unexpected query parameters.');
        erase(room.id); respond(response, 200, { v: 1, closed: true }, origin); return;
      }
      if (request.method === 'POST' && action === 'messages') {
        if (url.search) reject(400, 'INVALID_QUERY', 'Unexpected query parameters.');
        const body = await readJSON(request); onlyKeys(body, ['envelope']);
        const envelope = body.envelope;
        try { inspectSignalEnvelope(envelope); } catch { reject(400, 'INVALID_ENVELOPE', 'Invalid opaque signaling envelope.'); }
        assertLive(room);
        if (!rooms.has(room.id)) reject(404, 'ROOM_UNAVAILABLE', 'The invitation is unavailable.');
        if (envelope.roomId !== room.id || envelope.fromRole !== role) reject(403, 'ROLE_MISMATCH', 'Signaling capability does not match the envelope.');
        if (room.attemptId && envelope.attemptId !== room.attemptId) reject(409, 'ATTEMPT_MISMATCH', 'Create a new invitation for a new attempt.');
        if (!room.attemptId && role !== 'host') reject(409, 'HOST_OFFER_REQUIRED', 'The host must start signaling.');
        if (envelope.seq <= room.lastSeq[role]) reject(409, 'REPLAY', 'Signaling message was already accepted.');
        if (envelope.seq !== room.lastSeq[role] + 1) reject(409, 'SEQUENCE_GAP', 'Signaling messages must be submitted in order.');
        if (envelope.seq > limits.maxSignalsPerRole) reject(429, 'SIGNAL_LIMIT', 'Create a new invitation.');
        const bytes = Buffer.byteLength(JSON.stringify(envelope));
        if (bytes > limits.maxMessageBytes) reject(413, 'MESSAGE_TOO_LARGE', 'The signaling message is too large.');
        if (room.messages.length >= limits.maxRoomQueuedMessages || room.queuedBytes + bytes > limits.maxRoomQueueBytes
          || totalQueuedBytes + bytes > limits.maxTotalQueueBytes) reject(429, 'QUEUE_FULL', 'The peer must consume queued signaling first.');
        const cursor = ++room.cursor;
        room.attemptId = envelope.attemptId; room.lastSeq[role] = envelope.seq;
        room.messages.push({ cursor, envelope, toRole: role === 'host' ? 'join' : 'host', bytes });
        room.queuedBytes += bytes; totalQueuedBytes += bytes;
        respond(response, 201, { v: 1, cursor }, origin); return;
      }
      if (request.method === 'GET' && action === 'messages') {
        if ([...url.searchParams.keys()].some(key => key !== 'after') || url.searchParams.getAll('after').length > 1) reject(400, 'INVALID_QUERY', 'Unexpected query parameters.');
        const value = url.searchParams.get('after') || '0';
        if (!/^(0|[1-9]\d{0,15})$/.test(value) || !Number.isSafeInteger(Number(value))) reject(400, 'INVALID_CURSOR', 'Invalid queue cursor.');
        const after = Number(value);
        if (after < room.acked[role] || after > room.delivered[role]) reject(409, 'INVALID_CURSOR', 'Only a previously delivered cursor can be acknowledged.');
        room.messages = room.messages.filter(message => {
          if (message.toRole !== role || message.cursor > after) return true;
          room.queuedBytes -= message.bytes; totalQueuedBytes -= message.bytes; return false;
        });
        room.acked[role] = after;
        const messages = []; let bytes = 0;
        for (const message of room.messages) {
          if (message.toRole !== role || message.cursor <= after) continue;
          if (bytes + message.bytes + 256 > limits.maxPollBytes) break;
          messages.push({ cursor: message.cursor, envelope: message.envelope }); bytes += message.bytes + 256;
        }
        const cursor = messages.length ? messages[messages.length - 1].cursor : after;
        room.delivered[role] = Math.max(room.delivered[role], cursor);
        respond(response, 200, { v: 1, messages, cursor, peerJoined: Boolean(room.peerHash), expiresAt: room.expiresAt }, origin); return;
      }
      reject(405, 'METHOD_NOT_ALLOWED', 'Unsupported rendezvous operation.');
    } catch (error) {
      const known = error instanceof BrokerError;
      respond(response, known ? error.status : 500, { error: { code: known ? error.code : 'BROKER_ERROR',
        message: known ? error.message : 'Rendezvous failed.' } }, origin);
      if (known && error.status === 413) {
        response.once('finish', () => request.destroy());
        request.resume();
      } else if (!request.complete) request.resume();
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.keepAliveTimeout = 1000;
  server.maxConnections = 64; server.maxRequestsPerSocket = 64;
  const cleanup = setInterval(sweep, 30000); cleanup.unref();
  server.once('close', () => { clearInterval(cleanup); rooms.clear(); rates.clear(); totalQueuedBytes = 0; });
  return Object.freeze({
    server,
    async listen({ port = 0, host = '127.0.0.1' } = {}) {
      if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new TypeError('Bind loopback; use an HTTPS reverse proxy for remote clients.');
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('Invalid port.');
      await new Promise((resolve, rejectListen) => {
        const onError = error => { server.removeListener('listening', onListen); rejectListen(error); };
        const onListen = () => { server.removeListener('error', onError); resolve(); };
        server.once('error', onError); server.once('listening', onListen); server.listen(port, host);
      });
      const address = server.address();
      return `http://${address.family === 'IPv6' ? '[' + address.address + ']' : address.address}:${address.port}`;
    },
    async close() {
      clearInterval(cleanup);
      if (!server.listening) { rooms.clear(); rates.clear(); totalQueuedBytes = 0; return; }
      await new Promise((resolve, rejectClose) => {
        server.close(error => error ? rejectClose(error) : resolve()); server.closeAllConnections();
      });
    },
    stats() { sweep(); return Object.freeze({ rooms: rooms.size, queuedBytes: totalQueuedBytes, rateEntries: rates.size }); }
  });
}

module.exports = { createFlashBroker, DEFAULT_LIMITS };
if (require.main === module) {
  const broker = createFlashBroker({trustedProxy: process.env.MOUSE_FLASH_TRUST_PROXY === '1'});
  const raw = process.env.MOUSE_FLASH_PORT || '8787';
  if (!/^\d{1,5}$/.test(raw)) throw new TypeError('Invalid MOUSE_FLASH_PORT.');
  broker.listen({ port: Number(raw) }).then(url => {
    console.log(`Mouse Flash rendezvous listening on ${url}; no file relay; in-memory 30-minute rooms.`);
  }).catch(() => { console.error('Mouse Flash rendezvous could not listen.'); process.exitCode = 1; });
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => broker.close().then(() => process.exit(0)));
}
