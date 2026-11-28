'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {generateKeyPairSync, createHash, sign, randomBytes, randomUUID} = require('node:crypto');
const {IdentityService} = require('../service.cjs');
const proof = require('../../../desktop/mouse-account-proof.cjs');
const PASSWORD = 'a private yellow mountain 2026';
function device(name = 'Test Mac') {
  const pair = generateKeyPairSync('ed25519'), encryption = generateKeyPairSync('x25519');
  const der = pair.publicKey.export({type: 'spki', format: 'der'});
  return {identity: {deviceId: createHash('sha256').update(der).digest('hex').slice(0, 32), name, publicKey: der.toString('base64')},
    encryptionKey: encryption.publicKey.export({type: 'spki', format: 'der'}).toString('base64'),
    sign(hash) { return sign(null, Buffer.from('MouseFlashIdentity:v1:' + hash), pair.privateKey).toString('base64'); }};
}
function setup(test, options = {}) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mouse-identity-test-')));
  const issuerPrivateKey = generateKeyPairSync('ed25519').privateKey, ownerBootstrapSecret = randomBytes(32).toString('base64url');
  const clock = {value: Date.now()}; let count = 0;
  const config = {directory, issuerPrivateKey, ownerBootstrapSecret, now: () => clock.value, ...options};
  const fixture = {directory, config, clock, service: new IdentityService(config),
    context() { return {ip: '192.0.2.' + (++count % 254 + 1)}; },
    reopen() { fixture.service.close(); fixture.service = new IdentityService(config); return fixture.service; }};
  test.after(() => { fixture.service.close(); fs.rmSync(directory, {recursive: true, force: true}); });
  return fixture;
}
function challenge(service, dev, action, {id, profile, registrationId = randomBytes(32).toString('base64url'), context = {ip: '198.51.100.1'}} = {}) {
  const body = {action, identity: dev.identity, encryptionKey: dev.encryptionKey};
  if (['register', 'claim-owner'].includes(action)) { body.profile = profile || {name: 'Test Mouse', avatarHash: null}; body.registrationId = registrationId; }
  else body.accountId = id;
  const value = service.challenge(body, context);
  return {challengeId: value.challengeId, signature: dev.sign(proof.authChallengeTranscript(value)), value};
}
async function register(fixture, dev = device(), {owner = false, password = PASSWORD, context = fixture.context()} = {}) {
  const c = challenge(fixture.service, dev, owner ? 'claim-owner' : 'register', {context});
  const result = await fixture.service.register({challengeId: c.challengeId, signature: c.signature, password, avatar: null,
    ...(owner ? {ownerBootstrapSecret: fixture.config.ownerBootstrapSecret} : {})}, context, {owner});
  return {dev, ...result};
}
async function login(fixture, dev, id, password = PASSWORD) {
  const context = fixture.context(), c = challenge(fixture.service, dev, 'login', {id, context});
  return fixture.service.login({challengeId: c.challengeId, signature: c.signature, password}, context);
}
function auth(fixture, session) { return fixture.service.authenticate(session.accessToken, fixture.context()); }
function state() {
  const tabId = randomUUID();
  return {schema: 1,
    desktops: {active: 'desk-1', items: [{id: 'desk-1', name: 'Работа', layout: {
      tree: {id: 'p1'}, slots: {p1: tabId}, active: 'p1', tabOrder: [tabId],
      aiOpen: false, aiWidth: 420, aiId: '', aiSessions: {}, mode: 'single'}}], members: {[tabId]: 'desk-1'}},
    tabs: [{id: tabId, url: 'https://example.com/', lane: 'main'}], bookmarks: [{id: 'bookmark-1', url: 'https://example.org/', title: 'Работа', at: 1}],
    preferences: {theme: 'dark', locale: 'ru', libraryWidth: 420, settingsWidth: 744, aiSites: []},
    appearance: {paneMode: 'rounded', whiteTone: 90}, settings: {showBrandName: true, showFavicons: true, desktopGestures: true,
      downloadBounce: true, downloadBadge: true, blockAds: true, syncWebsiteTheme: true}};
}
module.exports = {setup, device, challenge, register, login, auth, state, PASSWORD};
