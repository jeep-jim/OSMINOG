'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {generateKeyPairSync, createHash, randomBytes, sign} = require('node:crypto');
const {MouseProfile, avatarHash} = require('./mouse-profile.cjs');
const {openAccountRegistry} = require('../tools/mouse-account-registry.cjs');
const {accountChallengeTranscript} = require('./mouse-account-proof.cjs');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
const avatar = 'data:image/png;base64,' + PNG.toString('base64');
function device() {
  const keys = generateKeyPairSync('ed25519'), der = keys.publicKey.export({type: 'spki', format: 'der'});
  return {identity: {deviceId: createHash('sha256').update(der).digest('hex').slice(0, 32), publicKey: der.toString('base64'), name: 'Mac'},
    sign: hash => ({signature: sign(null, Buffer.from('MouseFlashIdentity:v1:' + hash), keys.privateKey).toString('base64')})};
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mouse-profile-')), directory = path.join(root, 'profile'), filename = path.join(root, 'avatar.png');
  await fs.writeFile(filename, PNG);
  let normal = true, picker = async () => ({canceled: false, filePaths: [filename]}), thumbnails = 0;
  const actor = device(), secret = randomBytes(32).toString('base64url');
  const registry = await openAccountRegistry({directory: path.join(root, 'registry'), ownerBootstrapSecret: secret, signingKey: generateKeyPairSync('ed25519').privateKey});
  const electron = {dialog: {showOpenDialog: (...args) => picker(...args)}, nativeImage: {createThumbnailFromPath: async file => {
    assert.equal(file, filename); thumbnails++; return {isEmpty: () => false, toPNG: () => PNG};
  }}};
  const options = {directory, electron, window: {}, canUse: () => normal, getIdentity: async () => actor, serverPublicKey: registry.serverPublicKey, flashAvailable: () => true};
  const profile = new MouseProfile(options); await profile.ready;
  t.after(async () => { await profile.flush(); await registry.close(); await fs.rm(root, {recursive: true, force: true}); });
  async function certificate(action = 'claim-owner', selectedActor = actor, fields = {}) {
    const state = await profile.state();
    const challenge = await registry.issueChallenge({action, identity: selectedActor.identity, name: state.name || 'Антон', avatarHash: avatarHash(state.avatar), ...fields});
    return (await registry.completeChallenge({challengeId: challenge.challengeId, ...selectedActor.sign(accountChallengeTranscript(challenge)), ...(action === 'claim-owner' ? {ownerBootstrapSecret: secret} : {})})).certificate;
  }
  return {root, directory, filename, profile, options, registry, actor, certificate, privacy: value => {normal = !value; profile.cancelPending();}, picker: value => {picker = value;}, thumbnails: () => thumbnails};
}
test('new installs are local drafts; local numeric ID fields and forged certificates never assign ID1', async t => {
  const f = await fixture(t), initial = await f.profile.state(); assert.equal(initial.mouseId, null); assert.equal(initial.verified, false);
  await assert.rejects(f.profile.call('set', {name: 'Антон', mouseId: 1}));
  await assert.rejects(f.profile.call('claim-owner', {mouseId: 1}));
  await fs.writeFile(path.join(f.directory, 'profile.json'), JSON.stringify({v: 1, name: 'Подмена', avatar: null, mouseId: 1, verified: true, certificate: {claims: {accountId: 1}, signature: 'fake'}}));
  const reopened = new MouseProfile(f.options), state = await reopened.state();
  assert.equal(state.name, 'Подмена'); assert.equal(state.mouseId, null); assert.equal(state.verified, false);
});
test('name and native-selected PNG persist without renderer-controlled file paths', async t => {
  const f = await fixture(t);
  await f.profile.call('set', {name: '  Анто\u0301н  '});
  const state = await f.profile.call('choose-avatar'); assert.equal(state.avatar, avatar); assert.equal(f.thumbnails(), 1); assert.equal(state.name, 'Анто\u0301н'.normalize('NFC'));
  const reopened = new MouseProfile(f.options); assert.deepEqual(await reopened.state(), state);
  assert.equal((await fs.stat(path.join(f.directory, 'profile.json'))).mode & 0o777, 0o600);
  const stored = await fs.readFile(path.join(f.directory, 'profile.json'), 'utf8'); assert.equal(stored.includes(f.filename), false);
  await assert.rejects(f.profile.call('set', {name: 'A\u202eB'}));
  const removed = await f.profile.call('remove-avatar'); assert.equal(removed.avatar, null);
});
test('cancelled avatar selection preserves the previous profile', async t => {
  const f = await fixture(t); await f.profile.call('set', {name: 'Антон'}); await f.profile.call('choose-avatar');
  f.picker(async () => ({canceled: true, filePaths: []}));
  const state = await f.profile.call('choose-avatar'); assert.equal(state.canceled, true); assert.equal(state.avatar, avatar); assert.equal(state.name, 'Антон'); assert.equal(f.thumbnails(), 1);
});
test('a privacy transition revokes an outstanding picker before reading or saving the image', async t => {
  const f = await fixture(t); await f.profile.call('set', {name: 'Антон'});
  let resolve, entered; const started = new Promise(done => {entered = done;});
  f.picker(() => { entered(); return new Promise(done => {resolve = done;}); });
  const pending = f.profile.call('choose-avatar'); const rejected = assert.rejects(pending, /режиме/); await started; f.privacy(true);
  let flushed = false; const draining = f.profile.flush().then(() => {flushed = true;});
  try { await new Promise(done => setImmediate(done)); assert.equal(flushed, true, 'An unanswered native dialog must not hold the privacy/quit barrier'); }
  finally { resolve({canceled: false, filePaths: [f.filename]}); }
  await rejected; await draining; assert.equal(f.thumbnails(), 0);
  await assert.rejects(f.profile.state(), /режиме/); await f.profile.flush();
  f.privacy(false); assert.equal((await f.profile.state()).avatar, null);
});
test('privacy drains a pending avatar stat and prevents thumbnail I/O after cancellation', async t => {
  const f = await fixture(t); await f.profile.call('set', {name: 'Антон'});
  let entered, release, flushed = false;
  const started = new Promise(resolve => {entered = resolve;}), gate = new Promise(resolve => {release = resolve;});
  const original = fs.lstat;
  t.mock.method(fs, 'lstat', async filename => { if (filename === f.filename) { entered(); await gate; } return original(filename); });
  const pending = f.profile.call('choose-avatar'); const rejected = assert.rejects(pending, /режиме/); await started;
  f.privacy(true); const draining = f.profile.flush().then(() => {flushed = true;});
  try {
    await new Promise(resolve => setImmediate(resolve)); assert.equal(flushed, false);
    release(); await rejected; await draining;
    assert.equal(f.thumbnails(), 0); assert.equal(f.profile.activeAvatarIO.size, 0);
    f.privacy(false); assert.equal((await f.profile.state()).avatar, null);
  } finally { release(); await rejected; await draining; }
});
test('privacy waits for an already started native thumbnail and rejects it without saving', async t => {
  const f = await fixture(t); await f.profile.call('set', {name: 'Антон'});
  let entered, release, flushed = false, conversions = 0;
  const started = new Promise(resolve => {entered = resolve;}), gate = new Promise(resolve => {release = resolve;});
  f.options.electron.nativeImage.createThumbnailFromPath = async () => { entered(); await gate; return {isEmpty: () => false, toPNG: () => {conversions++; return PNG;}}; };
  const pending = f.profile.call('choose-avatar'); const rejected = assert.rejects(pending, /режиме/); await started;
  f.privacy(true); const draining = f.profile.flush().then(() => {flushed = true;});
  try {
    await new Promise(resolve => setImmediate(resolve)); assert.equal(flushed, false);
    release(); await rejected; await draining;
    assert.equal(conversions, 0); assert.equal(f.profile.activeAvatarIO.size, 0);
    f.privacy(false); assert.equal((await f.profile.state()).avatar, null);
    assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, 'profile.json'), 'utf8')).avatar, null);
  } finally { release(); await rejected; await draining; }
});
test('ID1 is displayed only for the owner certificate, matching profile and matching local device', async t => {
  const f = await fixture(t); await f.profile.call('set', {name: 'Антон'}); await f.profile.call('choose-avatar');
  const certificate = await f.certificate(); const verified = await f.profile.acceptCertificate(certificate);
  assert.equal(verified.mouseId, 1); assert.equal(verified.verified, true);
  const reopened = new MouseProfile(f.options); assert.equal((await reopened.state()).mouseId, 1);
  const otherDevice = new MouseProfile({...f.options, getIdentity: async () => device()}); assert.equal((await otherDevice.state()).mouseId, null);
  const wrongServer = new MouseProfile({...f.options, serverPublicKey: generateKeyPairSync('ed25519').publicKey.export({type: 'spki', format: 'der'}).toString('base64')}); assert.equal((await wrongServer.state()).mouseId, null);
  const changed = await f.profile.call('set', {name: 'Другое имя'}); assert.equal(changed.mouseId, null); assert.equal(changed.verified, false);
  await assert.rejects(f.profile.acceptCertificate(certificate), /match/);
});
test('ordinary registration starts at2 and the local client cannot promote its valid certificate to1', async t => {
  const f = await fixture(t); await f.profile.call('set', {name: 'Обычный профиль'});
  const certificate = await f.certificate('register'); const state = await f.profile.acceptCertificate(certificate); assert.equal(state.mouseId, 2);
  const altered = JSON.parse(JSON.stringify(certificate)); altered.claims.accountId = 1;
  await assert.rejects(f.profile.acceptCertificate(altered)); assert.equal((await f.profile.state()).mouseId, 2);
});
test('an edit during identity lookup cannot verify one profile snapshot using another snapshot certificate', async t => {
  const f = await fixture(t);
  await f.profile.call('set', {name: 'Certified Alice'});
  await f.profile.acceptCertificate(await f.certificate());
  await f.profile.call('set', {name: 'Draft Bob'});
  let first = true, entered, release;
  const started = new Promise(resolve => {entered = resolve;}), gate = new Promise(resolve => {release = resolve;});
  f.profile.getIdentity = async () => { if (first) { first = false; entered(); await gate; } return f.actor; };
  const pending = f.profile.state(); await started;
  try {
    const restored = await f.profile.call('set', {name: 'Certified Alice'});
    assert.equal(restored.mouseId, 1); assert.equal(restored.verified, true);
    release(); const oldSnapshot = await pending;
    assert.equal(oldSnapshot.name, 'Draft Bob'); assert.equal(oldSnapshot.mouseId, null); assert.equal(oldSnapshot.verified, false);
    assert.equal((await f.profile.state()).name, 'Certified Alice');
  } finally { release(); }
});
test('image metadata rejects external URLs, SVG and oversized PNG dimensions', () => {
  assert.throws(() => avatarHash('https://example.com/avatar.png')); assert.throws(() => avatarHash('data:image/svg+xml,<svg/>'));
  const large = Buffer.from(PNG); large.writeUInt32BE(257, 16); assert.throws(() => avatarHash('data:image/png;base64,' + large.toString('base64')));
  assert.equal(avatarHash(avatar), createHash('sha256').update(PNG).digest('hex'));
});
