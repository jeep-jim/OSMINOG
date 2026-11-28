'use strict';
// Test-only, loopback STUN Binding discovery. This is not a production STUN
// service, a NAT emulator, an ICE peer or a TURN/file relay. Every successful
// response contains only the actual UDP sender address/port supplied by Node.
// RFC 5389 sections 6, 7.3.1.1, 15.2 and 15.5; RFC 8489 supersedes RFC 5389.
const dgram = require('node:dgram');
const net = require('node:net');

const COOKIE = 0x2112a442;
const FINGERPRINT_XOR = 0x5354554e;
const MAX_DATAGRAM_BYTES = 1024;

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function createBindingResponse(message, rinfo) {
  if (!Buffer.isBuffer(message) || message.length < 20 || message.length > MAX_DATAGRAM_BYTES
    || message.readUInt16BE(0) !== 0x0001 || message.readUInt32BE(4) !== COOKIE
    || message.readUInt16BE(2) % 4 !== 0 || message.readUInt16BE(2) !== message.length - 20) return null;
  if (!rinfo || rinfo.family !== 'IPv4' || !net.isIPv4(rinfo.address)
    || !Number.isInteger(rinfo.port) || rinfo.port < 1 || rinfo.port > 65535) return null;

  const seen = new Set();
  for (let offset = 20; offset < message.length;) {
    if (offset + 4 > message.length) return null;
    const type = message.readUInt16BE(offset), length = message.readUInt16BE(offset + 2);
    const end = offset + 4 + ((length + 3) & ~3);
    if (end > message.length || seen.has(type)) return null;
    seen.add(type);
    // The fixture supports only unauthenticated discovery. Silently discard
    // unsupported required attributes, including ICE credentials, allocation
    // and alternate-address requests. Optional attributes are never reflected.
    if (type < 0x8000) return null;
    if (type === 0x8028 && (length !== 4 || end !== message.length
      || message.readUInt32BE(offset + 4) !== ((crc32(message.subarray(0, offset)) ^ FINGERPRINT_XOR) >>> 0))) return null;
    offset = end;
  }

  // A modern cookie-bearing request gets XOR-MAPPED-ADDRESS. libwebrtc's
  // GetAddress(MAPPED_ADDRESS) also accepts XOR-MAPPED-ADDRESS, so no legacy
  // MAPPED attribute or non-cookie compatibility path is necessary.
  const response = Buffer.alloc(40);
  response.writeUInt16BE(0x0101, 0); // Binding success, never a TURN response.
  response.writeUInt16BE(20, 2);
  response.writeUInt32BE(COOKIE, 4);
  message.copy(response, 8, 8, 20); // Exact 96-bit transaction ID.
  response.writeUInt16BE(0x0020, 20);
  response.writeUInt16BE(8, 22);
  response[25] = 0x01; // IPv4, with the reserved byte left zero.
  response.writeUInt16BE(rinfo.port ^ (COOKIE >>> 16), 26);
  const address = Buffer.from(rinfo.address.split('.').map(Number)).readUInt32BE(0);
  response.writeUInt32BE((address ^ COOKIE) >>> 0, 28);
  response.writeUInt16BE(0x8028, 32);
  response.writeUInt16BE(4, 34);
  response.writeUInt32BE((crc32(response.subarray(0, 32)) ^ FINGERPRINT_XOR) >>> 0, 36);
  return response;
}

async function startStunFixture({host = '127.0.0.1', port = 0} = {}) {
  if (host !== '127.0.0.1' || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError('The STUN fixture requires IPv4 loopback and a valid UDP port.');
  }
  const socket = dgram.createSocket('udp4');
  let closing, closed = false, received = 0;
  function close() {
    if (closing) return closing;
    closed = true;
    closing = new Promise(resolve => {
      try { socket.close(resolve); } catch (error) {
        if (error.code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') throw error;
        resolve();
      }
    });
    return closing;
  }
  socket.on('message', (message, rinfo) => {
    if (closed || ++received > 2048) return;
    const response = createBindingResponse(message, rinfo);
    if (response) socket.send(response, rinfo.port, rinfo.address, () => {});
  });
  try {
    await new Promise((resolve, reject) => {
      const failed = error => reject(error);
      socket.once('error', failed);
      socket.bind(port, host, () => { socket.removeListener('error', failed); resolve(); });
    });
  } catch (error) {
    await close();
    throw error;
  }
  socket.on('error', () => { void close(); });
  return Object.freeze({url: `stun:${host}:${socket.address().port}`, close});
}

module.exports = {startStunFixture, createBindingResponse};
