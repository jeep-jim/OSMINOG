#!/usr/bin/env node
'use strict';
// Bounded public STUN Binding discovery (RFC 8489). No TURN allocation,
// forwarding, alternate destination, credentials, file storage or packet logs.
const dgram = require('node:dgram');
const net = require('node:net');
const COOKIE = 0x2112a442, FINGERPRINT = 0x5354554e;
const DEFAULT_LIMITS = Object.freeze({maxDatagramBytes: 1024, globalPerSecond: 200, globalBurst: 400,
  peerPerSecond: 2, peerBurst: 20, maxPeers: 2048, peerIdleMs: 120000, maxInFlight: 64, maxSendQueueBytes: 65536});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
function ipv6Bytes(address) {
  if (!net.isIPv6(address) || address.includes('%')) return null;
  let text = address;
  if (text.includes('.')) {
    const last = text.lastIndexOf(':'), tail = text.slice(last + 1); if (!net.isIPv4(tail)) return null;
    const b = tail.split('.').map(Number); text = text.slice(0, last + 1) + ((b[0] << 8) | b[1]).toString(16) + ':' + ((b[2] << 8) | b[3]).toString(16);
  }
  const halves = text.split('::'); if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [], right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const parts = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  if (parts.length !== 8) return null;
  const result = Buffer.alloc(16); for (let i = 0; i < 8; i++) result.writeUInt16BE(parseInt(parts[i], 16), i * 2); return result;
}
function senderAddress(info) {
  if (!info || !Number.isInteger(info.port) || info.port < 1 || info.port > 65535) return null;
  if (info.family === 'IPv4' && net.isIPv4(info.address)) {
    const bytes = Buffer.from(info.address.split('.').map(Number));
    if (bytes[0] === 0 || bytes[0] >= 224) return null;
    return {bytes, family: 1, bucket: '4:' + info.address};
  }
  if (info.family === 'IPv6') {
    const bytes = ipv6Bytes(info.address);
    if (!bytes || bytes[0] === 255 || bytes.every(byte => byte === 0)) return null;
    // One quota for an IPv6 /64 prevents trivial rotation through privacy addresses.
    return {bytes, family: 2, bucket: '6:' + bytes.subarray(0, 8).toString('hex')};
  }
  return null;
}
function createBindingResponse(message, info, maxBytes = 1024) {
  if (!Buffer.isBuffer(message) || message.length < 20 || message.length > maxBytes || message.readUInt16BE(0) !== 1 ||
    message.readUInt32BE(4) !== COOKIE || message.readUInt16BE(2) % 4 || message.readUInt16BE(2) !== message.length - 20) return null;
  const sender = senderAddress(info); if (!sender) return null;
  const seen = new Set();
  for (let at = 20; at < message.length;) {
    if (at + 4 > message.length) return null;
    const type = message.readUInt16BE(at), length = message.readUInt16BE(at + 2), end = at + 4 + ((length + 3) & ~3);
    if (end > message.length || seen.has(type) || type < 0x8000) return null;
    seen.add(type);
    if (type === 0x8028 && (length !== 4 || end !== message.length || message.readUInt32BE(at + 4) !== ((crc32(message.subarray(0, at)) ^ FINGERPRINT) >>> 0))) return null;
    at = end;
  }
  const addressLength = sender.bytes.length, fingerprintAt = 28 + addressLength, result = Buffer.alloc(fingerprintAt + 8);
  result.writeUInt16BE(0x0101); result.writeUInt16BE(result.length - 20, 2); result.writeUInt32BE(COOKIE, 4); message.copy(result, 8, 8, 20);
  result.writeUInt16BE(0x0020, 20); result.writeUInt16BE(addressLength + 4, 22); result[25] = sender.family;
  result.writeUInt16BE(info.port ^ (COOKIE >>> 16), 26);
  const mask = result.subarray(4, 20); for (let i = 0; i < addressLength; i++) result[28 + i] = sender.bytes[i] ^ mask[i];
  result.writeUInt16BE(0x8028, fingerprintAt); result.writeUInt16BE(4, fingerprintAt + 2);
  result.writeUInt32BE((crc32(result.subarray(0, fingerprintAt)) ^ FINGERPRINT) >>> 0, fingerprintAt + 4);
  return result;
}
function createLimiter({limits = {}, now = () => performance.now()} = {}) {
  const settings = {...DEFAULT_LIMITS, ...limits};
  for (const [key, value] of Object.entries(settings)) if (!Object.hasOwn(DEFAULT_LIMITS, key) || !Number.isInteger(value) || value < 1) throw TypeError('Invalid STUN limit');
  if (settings.maxDatagramBytes > 1024 || settings.globalBurst > 1000 || settings.globalPerSecond > 1000 || settings.maxPeers > 8192 || settings.peerBurst > 100) throw TypeError('Unsafe STUN limit');
  const peers = new Map(), global = {tokens: settings.globalBurst, at: now()};
  function consume(bucket, rate, burst, time) {
    bucket.tokens = Math.min(burst, bucket.tokens + Math.max(0, time - bucket.at) * rate / 1000); bucket.at = time;
    if (bucket.tokens < 1) return false; bucket.tokens--; return true;
  }
  function sweep(time = now()) { for (const [key, entry] of peers) if (time - entry.at >= settings.peerIdleMs) peers.delete(key); }
  return {settings, allowGlobal: () => consume(global, settings.globalPerSecond, settings.globalBurst, now()),
    allowPeer(info) {
      const address = senderAddress(info); if (!address) return false;
      const time = now(); let bucket = peers.get(address.bucket);
      if (!bucket) { if (peers.size >= settings.maxPeers) sweep(time); if (peers.size >= settings.maxPeers) return false; bucket = {tokens: settings.peerBurst, at: time}; peers.set(address.bucket, bucket); }
      return consume(bucket, settings.peerPerSecond, settings.peerBurst, time);
    }, sweep, peerCount: () => peers.size};
}
async function startStunService({hosts = ['0.0.0.0'], port = 3478, limits = {}} = {}) {
  if (!Array.isArray(hosts) || !hosts.length || hosts.length > 2 || new Set(hosts).size !== hosts.length || hosts.some(host => !net.isIP(host) || host.includes('%')) ||
    !Number.isInteger(port) || port < 0 || port > 65535) throw TypeError('Use explicit IP bindings and a valid UDP port');
  const limiter = createLimiter({limits}), sockets = [], counters = {received: 0, answered: 0, dropped: 0, inFlight: 0}; let closing, closed = false;
  const sweep = setInterval(() => limiter.sweep(), 30000); sweep.unref();
  function close() {
    if (closing) return closing; closed = true; clearInterval(sweep);
    closing = Promise.all(sockets.map(socket => new Promise(resolve => { try { socket.close(resolve); } catch { resolve(); } }))).then(() => {}); return closing;
  }
  try {
    for (const host of hosts) {
      const socket = dgram.createSocket(net.isIPv6(host) ? {type: 'udp6', ipv6Only: true} : {type: 'udp4'}); sockets.push(socket);
      socket.on('message', (message, info) => {
        counters.received++;
        if (closed || !limiter.allowGlobal() || counters.inFlight >= limiter.settings.maxInFlight || socket.getSendQueueSize() >= limiter.settings.maxSendQueueBytes) { counters.dropped++; return; }
        const response = createBindingResponse(message, info, limiter.settings.maxDatagramBytes);
        if (!response || !limiter.allowPeer(info)) { counters.dropped++; return; }
        counters.inFlight++;
        socket.send(response, info.port, info.address, error => { counters.inFlight--; if (error) counters.dropped++; else counters.answered++; });
      });
      await new Promise((resolve, reject) => {
        const fail = error => reject(error); socket.once('error', fail);
        socket.bind(port, host, () => { socket.removeListener('error', fail); resolve(); });
      });
      socket.on('error', () => { void close(); });
    }
  } catch (error) { await close(); throw error; }
  const addresses = sockets.map(socket => socket.address());
  return Object.freeze({addresses, urls: addresses.map(address => `stun:${address.family === 'IPv6' ? '[' + address.address + ']' : address.address}:${address.port}`), close,
    stats: () => Object.freeze({...counters, peers: limiter.peerCount(), closed})});
}
module.exports = {startStunService, createBindingResponse, createLimiter, DEFAULT_LIMITS, ipv6Bytes};
if (require.main === module) {
  const raw = process.env.MOUSE_FLASH_STUN_PORT || '3478', hosts = (process.env.MOUSE_FLASH_STUN_HOSTS || '0.0.0.0').split(',');
  if (!/^[1-9][0-9]{0,4}$/.test(raw)) throw TypeError('Invalid STUN port');
  startStunService({port: Number(raw), hosts}).then(service => {
    console.log('Mouse Flash STUN Binding listening; no relay; bounded UDP discovery.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => service.close().then(() => process.exit(0)));
  }).catch(() => { console.error('Mouse Flash STUN could not listen.'); process.exitCode = 1; });
}
