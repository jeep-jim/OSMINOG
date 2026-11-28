#!/usr/bin/env node
'use strict';

// No password, bearer, private key, bootstrap value, request URL or body is ever
// logged. Deployment runs this as the dedicated osminog user, never as root.
const fs = require('node:fs');
const path = require('node:path');
const {generateKeyPairSync, createPrivateKey, randomBytes} = require('node:crypto');
const {IdentityService, privateDirectory, token} = require('./service.cjs');
const {createIdentityServer} = require('./http.cjs');

function privateFile(filename, create) {
  let handle;
  try {
    handle = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    const temporary = filename + '.' + randomBytes(12).toString('hex') + '.tmp';
    let out;
    try {
      out = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      fs.writeFileSync(out, create()); fs.fsyncSync(out); fs.closeSync(out); out = undefined;
      fs.linkSync(temporary, filename);
      const dir = fs.openSync(path.dirname(filename), fs.constants.O_RDONLY); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
    } finally { if (out !== undefined) fs.closeSync(out); try { fs.unlinkSync(temporary); } catch {} }
    handle = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  }
  try {
    const info = fs.fstatSync(handle);
    if (!info.isFile() || info.nlink !== 1 || (info.mode & 0o077) !== 0 || info.size < 1 || info.size > 16384
      || process.getuid && info.uid !== process.getuid()) throw new Error('PRIVATE_FILE_UNSAFE');
    return fs.readFileSync(handle);
  } finally { fs.closeSync(handle); }
}
function numeric(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new Error('CONFIG_INVALID');
  return Number(value);
}
function run(env = process.env, args = process.argv.slice(2)) {
  process.umask(0o077);
  if (process.getuid && process.getuid() === 0 && env.MOUSE_ID_ALLOW_ROOT_TEST !== '1') throw new Error('DEDICATED_USER_REQUIRED');
  if (args.some(value => value !== '--init')) throw new Error('CONFIG_INVALID');
  const directory = env.MOUSE_ID_DATA_DIR;
  privateDirectory(directory);
  const keyFile = path.join(directory, 'issuer-ed25519.pem');
  const bootstrapFile = path.join(directory, 'owner-bootstrap.txt');
  const databaseExists = fs.existsSync(path.join(directory, 'accounts.sqlite'));
  const keyBytes = privateFile(keyFile, databaseExists ? undefined : () => generateKeyPairSync('ed25519').privateKey.export({type: 'pkcs8', format: 'pem'}));
  let issuerPrivateKey;
  try { issuerPrivateKey = createPrivateKey(keyBytes); } finally { keyBytes.fill(0); }
  let ownerBootstrapSecret;
  if (!databaseExists || fs.existsSync(bootstrapFile)) {
    const bootstrapBytes = privateFile(bootstrapFile, databaseExists ? undefined : () => token() + '\n');
    try { ownerBootstrapSecret = bootstrapBytes.toString('utf8').trim(); } finally { bootstrapBytes.fill(0); }
  }
  const service = new IdentityService({directory, issuerPrivateKey, ownerBootstrapSecret,
    maxAccounts: numeric(env.MOUSE_ID_MAX_ACCOUNTS, 4096, 2, 1000000)});
  ownerBootstrapSecret = undefined;
  if (args.includes('--init')) { process.stdout.write(JSON.stringify(service.info()) + '\n'); service.close(); return; }
  const host = env.MOUSE_ID_HOST || '127.0.0.1', port = numeric(env.MOUSE_ID_PORT, 8788, 1024, 65535);
  let tls;
  if (env.MOUSE_ID_TLS_CERT || env.MOUSE_ID_TLS_KEY) {
    if (!path.isAbsolute(env.MOUSE_ID_TLS_CERT || '') || !path.isAbsolute(env.MOUSE_ID_TLS_KEY || '')) throw new Error('CONFIG_INVALID');
    const cert = fs.readFileSync(env.MOUSE_ID_TLS_CERT), key = privateFile(env.MOUSE_ID_TLS_KEY);
    tls = {cert, key};
  }
  if (!tls && !['127.0.0.1', '::1'].includes(host)) throw new Error('TLS_REQUIRED');
  const server = createIdentityServer({service, tls, trustLoopbackProxy: env.MOUSE_ID_TRUST_LOOPBACK_PROXY === '1'});
  const maintenance = setInterval(() => {
    try { service.prune(); } catch { process.stderr.write('mouse-identity: maintenance unavailable\n'); }
  }, 30000); maintenance.unref();
  let stopping = false;
  function stop() {
    if (stopping) return; stopping = true; clearInterval(maintenance);
    const deadline = setTimeout(() => { server.closeAllConnections(); service.close(); process.exitCode = 1; }, 15000); deadline.unref();
    server.close(() => { clearTimeout(deadline); service.close(); });
  }
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  server.on('error', () => { process.stderr.write('mouse-identity: listener unavailable\n'); stop(); process.exitCode = 1; });
  server.listen(port, host, () => { process.stdout.write('mouse-identity: listening\n'); });
  return {service, server, stop};
}
if (require.main === module) {
  try { run(); } catch { process.stderr.write('mouse-identity: startup unavailable\n'); process.exitCode = 1; }
}
module.exports = {run, privateFile};
