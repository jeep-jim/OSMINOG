'use strict';
// Account routing only introduces devices. No file, source path or invitation
// fragment reaches the mailbox in plaintext. RTC traffic never enters here.
const {createHash} = require('node:crypto');
const {parseInvite, normalizeBrokerURL} = require('./mouse-flash-crypto.js');
const {verify} = require('./mouse-flash-identity.cjs');
const {avatarHash} = require('./mouse-profile.cjs');
const TTL = 5 * 60 * 1000, HEX = /^[a-f0-9]{32}$/;
function need(value, message) { if (!value) throw Error(message); }
function accountId(value) { need(Number.isSafeInteger(value) && value >= 1, 'Invalid Mouse ID'); return value; }
function inviteTranscript(value) {
  const payload = {v: 1, invite: value.invite, fromCertificate: value.fromCertificate, toDeviceId: value.toDeviceId, issuedAt: value.issuedAt, expiresAt: value.expiresAt};
  return createHash('sha256').update('MouseFlashAccountInvite:v1:' + JSON.stringify(payload)).digest('hex');
}
function checkedAvatar(value, expected) {
  if (!value || !expected) return null;
  try { return avatarHash(value) === expected ? value : null; } catch { return null; }
}
class FlashAccounts {
  constructor({provider, identity, broker, assertLive, isListening = () => true, ownsInvite = () => true}) {
    this.provider = provider; this.identity = identity; this.broker = broker; this.assertLive = assertLive;
    this.isListening = isListening; this.ownsInvite = ownsInvite;
    this.choices = new Map(); this.avatars = new Map(); this.seen = new Map(); this.rates = new Map(); this.polling = false;
  }
  rate(name, milliseconds) {
    const now = Date.now(); if ((this.rates.get(name) || 0) > now) return false;
    this.rates.set(name, now + milliseconds); return true;
  }
  cacheAvatar(deviceId, hash, avatar) {
    if (!avatar) return;
    this.avatars.delete(deviceId);
    while (this.avatars.size >= 32) this.avatars.delete(this.avatars.keys().next().value);
    this.avatars.set(deviceId, {hash, avatar});
  }
  async claims(certificate, expected = {}) {
    need(this.provider && typeof this.provider.verifyCertificate === 'function', 'Mouse ID verification is unavailable');
    const verified = await this.provider.verifyCertificate(certificate, expected); this.assertLive();
    const claims = verified?.claims || verified;
    need(claims && claims.v === 2 && HEX.test(claims.deviceId) && Number.isSafeInteger(claims.accountId) && claims.accountId >= 1 &&
      (!expected.deviceId || expected.deviceId === claims.deviceId) && (!expected.publicKey || expected.publicKey === claims.publicKey), 'Mouse ID certificate does not match this device');
    return claims;
  }
  async snapshot() {
    if (!this.provider) return null;
    const value = await this.provider.snapshot(); this.assertLive(); if (!value) return null;
    const claims = await this.claims(value.certificate, {deviceId: this.identity.identity.deviceId, publicKey: this.identity.identity.publicKey});
    need(claims.encryptionKey === this.identity.encryptionKey, 'Mouse ID encryption key does not match this device');
    const avatar = checkedAvatar(value.avatar, claims.avatarHash);
    this.cacheAvatar(claims.deviceId, claims.avatarHash, avatar);
    return {accountId: claims.accountId, deviceId: claims.deviceId, name: claims.name, avatar, certificate: value.certificate};
  }
  async lookup(value) {
    const id = accountId(value); need(await this.snapshot(), 'Войдите в Mouse ID в настройках, чтобы найти устройство.');
    need(this.rate('lookup', 2000), 'Подождите немного перед повторным поиском.');
    const result = await this.provider.devices(id); this.assertLive();
    need(result && Array.isArray(result.devices) && result.devices.length <= 32, 'Invalid Mouse device list');
    this.choices.clear(); const devices = [];
    for (const item of result.devices) {
      try {
        const claims = await this.claims(item.certificate, {deviceId: item.deviceId});
        need(claims.accountId === id, 'Mouse account mismatch');
        if (claims.deviceId === this.identity.identity.deviceId) continue;
        const avatar = checkedAvatar(result.account?.avatar, claims.avatarHash);
        const deviceName = typeof item.name === 'string' && item.name.length <= 100 && !/[\x00-\x1f\x7f]/.test(item.name) ? item.name : 'Устройство Mouse';
        const record = {accountId: id, deviceId: claims.deviceId, name: claims.name, deviceName, avatar, certificate: item.certificate};
        this.choices.set(claims.deviceId, {...record, encryptionKey: claims.encryptionKey, expiresAt: Math.min(Date.now() + 90000, claims.expiresAt)});
        this.cacheAvatar(claims.deviceId, claims.avatarHash, avatar);
        devices.push(record);
      } catch { /* An invalid entry never becomes a selectable recipient. */ }
    }
    return {accountId: id, devices};
  }
  async send({accountId: toAccount, deviceId, invite} = {}) {
    const own = await this.snapshot(); need(own, 'Войдите в Mouse ID в настройках.');
    accountId(toAccount); need(HEX.test(deviceId) && this.rate('send', 3000), 'Приглашение уже отправляется.');
    const target = this.choices.get(deviceId);
    need(target && target.accountId === toAccount && target.expiresAt > Date.now(), 'Найдите устройство ещё раз: его доступность могла измениться.');
    const parsed = parseInvite(invite); need(normalizeBrokerURL(parsed.broker) === normalizeBrokerURL(this.broker) && this.ownsInvite(parsed), 'This invitation does not belong to the active Flash session');
    const issuedAt = Date.now(), expiresAt = Math.min(issuedAt + TTL, parsed.expiresAt, target.certificate.claims.expiresAt, own.certificate.claims.expiresAt);
    need(expiresAt > issuedAt, 'The invitation is no longer available');
    const payload = {v: 1, invite, fromCertificate: own.certificate, toDeviceId: deviceId, issuedAt, expiresAt};
    payload.signature = this.identity.sign(inviteTranscript(payload)).signature;
    const envelope = this.identity.sealInvitation({recipientDeviceId: deviceId, recipientEncryptionKey: target.encryptionKey, payload});
    const result = await this.provider.sendInvitation({recipientAccountId: toAccount, recipientDeviceId: deviceId, envelope});
    this.assertLive(); return {...result, peer: {accountId: toAccount, deviceId, name: target.name, avatar: target.avatar}};
  }
  async presence() {
    if (!this.isListening() || !this.rate('presence', 30000) || !await this.snapshot()) return {ok: true, listening: false};
    const result = await this.provider.presence(); this.assertLive(); return result;
  }
  async incoming() {
    if (!this.isListening() || this.polling || !this.rate('poll', 3000) || !await this.snapshot()) return {invitations: []};
    this.polling = true;
    try {
      const response = await this.provider.invitations(); this.assertLive();
      need(response && Array.isArray(response.invitations) && response.invitations.length <= 10, 'Invalid Mouse invitations response');
      const invitations = [], now = Date.now(); let photoLookups = 0;
      for (const [key, expiresAt] of this.seen) if (expiresAt <= now) this.seen.delete(key);
      for (const item of response.invitations) {
        try {
          need(item && Number.isSafeInteger(item.expiresAt) && item.expiresAt > now && item.expiresAt <= now + TTL + 60000, 'Expired invitation');
          const envelopeText = JSON.stringify(item.envelope); need(typeof envelopeText === 'string' && Buffer.byteLength(envelopeText) <= 16384, 'Oversized invitation');
          const digest = createHash('sha256').update(envelopeText).digest('hex');
          need(!this.seen.has(digest) && this.seen.size < 128, 'Repeated invitation');
          const payload = this.identity.openInvitation(item.envelope);
          need(payload && Object.keys(payload).length === 7 && ['v', 'invite', 'fromCertificate', 'toDeviceId', 'issuedAt', 'expiresAt', 'signature'].every(key => Object.hasOwn(payload, key)) &&
            payload.v === 1 && payload.toDeviceId === this.identity.identity.deviceId && Number.isSafeInteger(payload.issuedAt) && Number.isSafeInteger(payload.expiresAt) &&
            payload.issuedAt <= now + 60000 && payload.expiresAt > now && payload.expiresAt > payload.issuedAt && payload.expiresAt - payload.issuedAt <= TTL, 'Invalid invitation recipient or lifetime');
          const claims = await this.claims(payload.fromCertificate, {deviceId: item.fromDeviceId});
          need(claims.accountId === item.fromAccountId && claims.deviceId !== this.identity.identity.deviceId, 'Invitation sender mismatch');
          verify({identity: {deviceId: claims.deviceId, publicKey: claims.publicKey, name: 'Mouse'}, transcriptHash: inviteTranscript(payload), signature: payload.signature});
          const parsed = parseInvite(payload.invite); need(normalizeBrokerURL(parsed.broker) === normalizeBrokerURL(this.broker), 'Invitation service mismatch');
          this.seen.set(digest, payload.expiresAt);
          const cached = this.avatars.get(claims.deviceId); let avatar = cached?.hash === claims.avatarHash ? cached.avatar : null;
          try {
            if (!avatar && claims.avatarHash && photoLookups < 2) {
              photoLookups++; const source = await this.provider.devices(claims.accountId); this.assertLive();
              avatar = checkedAvatar(source.account?.avatar, claims.avatarHash);
            }
          } catch { /* A broker outage must not erase a locally verified invitation. */ }
          this.cacheAvatar(claims.deviceId, claims.avatarHash, avatar);
          invitations.push({invitationId: item.invitationId, invite: payload.invite, expiresAt: payload.expiresAt,
            peer: {accountId: claims.accountId, deviceId: claims.deviceId, name: claims.name, avatar}});
        } catch { /* Malformed mail is consumed without exposing capabilities or unverified identity. */ }
      }
      this.assertLive(); return {invitations};
    } finally { this.polling = false; }
  }
  async verifyPeer({certificate, identity} = {}) {
    if (!certificate) return null;
    need(identity && HEX.test(identity.deviceId), 'Invalid peer identity');
    const claims = await this.claims(certificate, {deviceId: identity.deviceId, publicKey: identity.publicKey});
    const cached = this.avatars.get(claims.deviceId);
    return {accountId: claims.accountId, deviceId: claims.deviceId, name: claims.name, avatar: cached?.hash === claims.avatarHash ? cached.avatar : null};
  }
}
module.exports = {FlashAccounts, inviteTranscript, TTL};
