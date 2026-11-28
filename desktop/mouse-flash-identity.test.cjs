'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes, createCipheriv, createDecipheriv, createHash, createPublicKey, generateKeyPairSync,
  verify: verifyBytes } = require('node:crypto');
const { loadIdentity, verify, IDENTITY_FILENAME, ENCRYPTION_FILENAME } = require('./mouse-flash-identity.cjs');

const code = expected => error => error && error.code === expected;
function protection(key = randomBytes(32)) {
  return {
    protect(value) {
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
    },
    unprotect(value) {
      const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
    }
  };
}
async function directory(t) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'mouse-flash-identity-'));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  return path.join(parent, 'private');
}

test('persistent Ed25519 identity is encrypted, mode0600 in0700, and reloads the same key', async t => {
  const dir = await directory(t), protector = protection(); let clear;
  const options = { directory: dir, ...protector, protect: value => { clear = value; return protector.protect(value); } };
  const first = await loadIdentity(options), second = await loadIdentity({ ...options, name: 'Другой Mac' });
  assert.equal(first.identity.name, 'Mac'); assert.equal(second.identity.name, 'Другой Mac');
  assert.equal(first.identity.deviceId, second.identity.deviceId); assert.equal(first.identity.publicKey, second.identity.publicKey);
  const recordPath = path.join(dir, IDENTITY_FILENAME), text = await fs.readFile(recordPath, 'utf8');
  assert.ok(!text.includes(clear), 'PKCS8 plaintext must not be persisted');
  assert.equal((await fs.stat(dir)).mode & 0o777, 0o700); assert.equal((await fs.stat(recordPath)).mode & 0o777, 0o600);
  assert.deepEqual((await fs.readdir(dir)).sort(), [ENCRYPTION_FILENAME, IDENTITY_FILENAME].sort());
  assert.equal(first.encryptionKey, second.encryptionKey);assert.equal(createPublicKey({key:Buffer.from(first.encryptionKey,'base64'),format:'der',type:'spki'}).asymmetricKeyType,'x25519');
  assert.equal((await fs.stat(path.join(dir,ENCRYPTION_FILENAME))).mode & 0o777,0o600);
  assert.ok(!(await fs.readFile(path.join(dir,ENCRYPTION_FILENAME),'utf8')).includes(clear));
  const der = Buffer.from(first.identity.publicKey, 'base64');
  assert.equal(der.length, 44); assert.equal(first.identity.deviceId, createHash('sha256').update(der).digest('hex').slice(0, 32));
  assert.ok(!JSON.stringify(first).includes(clear));
});

test('device proof signs the exact domain-separated transcript and verifies independently', async t => {
  const identity = await loadIdentity({ directory: await directory(t), ...protection() });
  const transcriptHash = createHash('sha256').update('real SDP/session/manifest transcript fixture').digest('hex');
  const { signature } = identity.sign(transcriptHash);
  assert.equal(Buffer.from(signature, 'base64').length, 64);
  assert.deepEqual(verify({ identity: identity.identity, transcriptHash, signature }), { ok: true, deviceId: identity.identity.deviceId });
  const publicKey = createPublicKey({ key: Buffer.from(identity.identity.publicKey, 'base64'), type: 'spki', format: 'der' });
  assert.equal(verifyBytes(null, Buffer.from('MouseFlashIdentity:v1:' + transcriptHash), publicKey, Buffer.from(signature, 'base64')), true);
  assert.equal(verifyBytes(null, Buffer.from(transcriptHash), publicKey, Buffer.from(signature, 'base64')), false);
});

test('altered transcript, signature and device ID cannot become a valid peer proof', async t => {
  const loaded = await loadIdentity({ directory: await directory(t), ...protection() }), transcriptHash = 'a'.repeat(64);
  const { signature } = loaded.sign(transcriptHash);
  assert.throws(() => verify({ identity: loaded.identity, transcriptHash: 'b'.repeat(64), signature }), code('IDENTITY_PROOF_INVALID'));
  const broken = Buffer.from(signature, 'base64'); broken[0] ^= 1;
  assert.throws(() => verify({ identity: loaded.identity, transcriptHash, signature: broken.toString('base64') }), code('IDENTITY_PROOF_INVALID'));
  const changedId = (loaded.identity.deviceId[0] === '0' ? '1' : '0') + loaded.identity.deviceId.slice(1);
  assert.throws(() => verify({ identity: { ...loaded.identity, deviceId: changedId }, transcriptHash, signature }), code('IDENTITY_FORMAT'));
  assert.throws(() => loaded.sign('not-a-sha256'), code('IDENTITY_TRANSCRIPT'));
  assert.throws(() => verify({ identity: loaded.identity, transcriptHash, signature: signature + '=' }), code('IDENTITY_FORMAT'));
});

test('concurrent first creation publishes exactly one complete protected identity', async t => {
  const dir = await directory(t), protector = protection();
  let arrivals = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const protect = async value => { const encrypted = protector.protect(value); if (++arrivals === 12) release(); await barrier; return encrypted; };
  const identities = await Promise.all(Array.from({ length: 12 }, () => loadIdentity({ directory: dir, protect, unprotect: protector.unprotect })));
  assert.ok(arrivals >= 13 && arrivals <= 24);
  assert.equal(new Set(identities.map(result => result.identity.deviceId)).size, 1);
  assert.equal(new Set(identities.map(result => result.identity.publicKey)).size, 1);
  assert.equal(new Set(identities.map(result => result.encryptionKey)).size, 1);
  assert.deepEqual((await fs.readdir(dir)).sort(), [ENCRYPTION_FILENAME, IDENTITY_FILENAME].sort());
  const reloaded = await loadIdentity({ directory: dir, ...protector });
  assert.equal(reloaded.identity.deviceId, identities[0].identity.deviceId);
});

test('separate processes racing on first creation retain one device key', async t => {
  const dir = await directory(t), key = randomBytes(32).toString('hex');
  const worker = `const {loadIdentity}=require(${JSON.stringify(require.resolve('./mouse-flash-identity.cjs'))});
const {randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const key=Buffer.from(process.env.MOUSE_FLASH_IDENTITY_TEST_KEY,'hex');
const protect=s=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const out=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),out]);};
const unprotect=b=>{const d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');};
loadIdentity({directory:process.argv[1],protect,unprotect}).then(x=>process.stdout.write(JSON.stringify(x.identity))).catch(()=>{process.exitCode=1});`;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', worker, dir], { env: { ...process.env, MOUSE_FLASH_IDENTITY_TEST_KEY: key }, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', value => { output += value; });
    child.once('error', reject); child.once('exit', status => { if (status !== 0) reject(new Error('Identity worker failed')); else resolve(JSON.parse(output)); });
  });
  const identities = await Promise.all([run(), run(), run()]);
  assert.equal(new Set(identities.map(identity => identity.deviceId)).size, 1);
  assert.deepEqual((await fs.readdir(dir)).sort(), [ENCRYPTION_FILENAME, IDENTITY_FILENAME].sort());
});

test('OS protection is mandatory and protector failures never publish plaintext or echo it', async t => {
  const dir = await directory(t);
  await assert.rejects(loadIdentity({ directory: dir }), code('IDENTITY_PROTECTION_UNAVAILABLE'));
  await assert.rejects(fs.stat(dir), error => error.code === 'ENOENT');
  let captured;
  await assert.rejects(loadIdentity({ directory: dir, protect(value) { captured = value; throw new Error(value); }, unprotect: () => '' }), error => {
    assert.equal(error.code, 'IDENTITY_PROTECTION'); assert.ok(!error.message.includes(captured)); return true;
  });
  assert.deepEqual(await fs.readdir(dir), []);
  await assert.rejects(loadIdentity({ directory: dir, protect: () => Buffer.from('opaque'), unprotect: () => 'wrong-private-key' }), code('IDENTITY_PROTECTION'));
  assert.deepEqual(await fs.readdir(dir), []);
});

test('public/protected key mismatch fails closed and never silently rotates identity', async t => {
  const dir = await directory(t), protector = protection();
  await loadIdentity({ directory: dir, ...protector });
  const recordPath = path.join(dir, IDENTITY_FILENAME), record = JSON.parse(await fs.readFile(recordPath, 'utf8'));
  record.publicKey = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const changed = JSON.stringify(record); await fs.writeFile(recordPath, changed);
  await assert.rejects(loadIdentity({ directory: dir, ...protector }), code('IDENTITY_KEY_MISMATCH'));
  assert.equal(await fs.readFile(recordPath, 'utf8'), changed);
});

test('corrupt or oversized key records cannot trigger an unbounded read or key regeneration', async t => {
  const dir = await directory(t), protector = protection(); await fs.mkdir(dir, { mode: 0o700 });
  const recordPath = path.join(dir, IDENTITY_FILENAME); let unlocks = 0;
  const options = { directory: dir, ...protector, unprotect: value => { unlocks++; return protector.unprotect(value); } };
  await fs.writeFile(recordPath, 'x'.repeat(32769));
  await assert.rejects(loadIdentity(options), code('IDENTITY_FORMAT')); assert.equal(unlocks, 0);
  await fs.writeFile(recordPath, '{invalid-json');
  await assert.rejects(loadIdentity(options), code('IDENTITY_FORMAT')); assert.equal(unlocks, 0);
  assert.equal(await fs.readFile(recordPath, 'utf8'), '{invalid-json');
});

test('symlinked record and directory are refused without touching their targets', async t => {
  const dir = await directory(t), protector = protection(), outside = path.join(path.dirname(dir), 'outside');
  await fs.writeFile(outside, 'unrelated', { mode: 0o644 }); await fs.mkdir(dir, { mode: 0o700 });
  await fs.symlink(outside, path.join(dir, IDENTITY_FILENAME));
  await assert.rejects(loadIdentity({ directory: dir, ...protector }), code('IDENTITY_STORAGE'));
  assert.equal(await fs.readFile(outside, 'utf8'), 'unrelated'); assert.equal((await fs.stat(outside)).mode & 0o777, 0o644);
  const linked = path.join(path.dirname(dir), 'linked'); await fs.symlink(dir, linked);
  await assert.rejects(loadIdentity({ directory: linked, ...protector }), code('IDENTITY_STORAGE'));
});

test('legacy Ed25519 record upgrades by adding protected encryption key without changing device ID or signing bytes',async t=>{
  const dir=await directory(t),protector=protection(),first=await loadIdentity({directory:dir,...protector});
  const original=await fs.readFile(path.join(dir,IDENTITY_FILENAME),'utf8'),signature=first.sign('c'.repeat(64));
  await fs.unlink(path.join(dir,ENCRYPTION_FILENAME));
  const upgraded=await loadIdentity({directory:dir,...protector});assert.equal(upgraded.identity.deviceId,first.identity.deviceId);
  assert.equal(await fs.readFile(path.join(dir,IDENTITY_FILENAME),'utf8'),original);assert.deepEqual(upgraded.sign('c'.repeat(64)),signature);
  const corrupt=JSON.parse(await fs.readFile(path.join(dir,ENCRYPTION_FILENAME),'utf8'));corrupt.publicKey=first.identity.publicKey;
  await fs.writeFile(path.join(dir,ENCRYPTION_FILENAME),JSON.stringify(corrupt));
  await assert.rejects(loadIdentity({directory:dir,...protector}),code('IDENTITY_KEY_MISMATCH'));
  assert.equal(await fs.readFile(path.join(dir,IDENTITY_FILENAME),'utf8'),original);
});
test('mailbox envelope hides invitation secret and binds recipient EdID and X25519 key under AES-GCM',async t=>{
  const receiver=await loadIdentity({directory:await directory(t),...protection()}),other=await loadIdentity({directory:await directory(t),...protection()});
  const payload={v:1,invite:'mouse-flash://join#private-room-secret',toDeviceId:receiver.identity.deviceId,issuedAt:Date.now()};
  const envelope=receiver.sealInvitation({recipientDeviceId:receiver.identity.deviceId,recipientEncryptionKey:receiver.encryptionKey,payload});
  assert.deepEqual(Object.keys(envelope),['v','ephemeralKey','nonce','ciphertext']);assert.ok(!JSON.stringify(envelope).includes(payload.invite));
  assert.deepEqual(receiver.openInvitation(envelope),payload);assert.throws(()=>other.openInvitation(envelope),code('INVITATION_CRYPTO'));
  const mutated=JSON.parse(JSON.stringify(envelope)),bytes=Buffer.from(mutated.ciphertext,'base64');bytes[0]^=1;mutated.ciphertext=bytes.toString('base64');
  assert.throws(()=>receiver.openInvitation(mutated),code('INVITATION_CRYPTO'));
  const wrong=receiver.sealInvitation({recipientDeviceId:other.identity.deviceId,recipientEncryptionKey:receiver.encryptionKey,payload});
  assert.throws(()=>receiver.openInvitation(wrong),code('INVITATION_CRYPTO'));
  assert.throws(()=>receiver.openInvitation({...envelope,secret:'not permitted'}),code('INVITATION_FORMAT'));
  assert.throws(()=>receiver.openInvitation({...envelope,ciphertext:envelope.ciphertext+'='}));
  assert.throws(()=>receiver.sealInvitation({recipientDeviceId:receiver.identity.deviceId,recipientEncryptionKey:receiver.identity.publicKey,payload}),code('INVITATION_FORMAT'));
});
