'use strict';
// macOS native acceptance for the shipped profile card. No bundled browser build is required.
// All identities, issuer credentials, avatar pixels and files in this test are disposable fixtures.
const electron = require('electron');
const {app, BrowserWindow, ipcMain, session, nativeImage, screen} = electron;
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {MouseProfile, avatarHash} = require('../desktop/mouse-profile.cjs');
const {trustedFrame} = require('../desktop/trust.cjs');
const {loadIdentity} = require('../desktop/mouse-flash-identity.cjs');
const {FlashService} = require('../desktop/mouse-flash.cjs');
const {openAccountRegistry} = require('./mouse-account-registry.cjs');
const {accountChallengeTranscript} = require('../desktop/mouse-account-proof.cjs');
const root = path.resolve(process.env.MOUSE_PROFILE_SMOKE_ROOT || path.join(os.tmpdir(), 'mouse-profile-ui-' + crypto.randomBytes(8).toString('hex')));
const evidence = path.resolve(process.env.MOUSE_PROFILE_EVIDENCE || path.join(root, 'evidence'));
app.setPath('userData', path.join(root, 'electron-profile'));
app.on('window-all-closed', () => {});
const receipt = {schema: 1, status: 'RUNNING', pass: false, platform: process.platform, architecture: process.arch, electron: process.versions.electron,
  source: process.env.GITHUB_SHA || null, nativeElectron: true, sandbox: true, nodeIntegration: false, contextIsolation: true,
  scope: 'Shipped settings UI and native profile in owned windows; synthetic devices and a local test issuer. This is not enrollment or testing of the owner’s physical Mac or a deployed account service.',
  checks: [], screenshots: [], rendererErrors: []};
const contexts = [];
let registry, fixture, avatarPath, owner, ordinary, exiting = false;
const testKey = crypto.randomBytes(32);
const protect = text => { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', testKey, iv); return Buffer.concat([iv, cipher.update(text, 'utf8'), cipher.final(), cipher.getAuthTag()]); };
const unprotect = bytes => { const cipher = crypto.createDecipheriv('aes-256-gcm', testKey, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8'); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const check = (name, detail = {}) => { receipt.checks.push({name, ...detail}); console.log('PASS ' + name); };
function bounded(promise, label, milliseconds = 15000) {
  let timer;
  const deadline = new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error(label + ' timed out')), milliseconds); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
const run = (context, code) => bounded(context.window.webContents.executeJavaScript(code, true), 'Profile renderer command');
async function waitFor(label, read, milliseconds = 15000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { const value = await read(); if (value) return value; await delay(40); }
  throw new Error(label + ' timed out');
}
async function snapshot(context) { return run(context, 'MouseProfileSmokeFixture.snapshot()'); }
async function click(context, id) {
  context.window.show(); context.window.focus();
  const point = await run(context, `(()=>{const e=document.getElementById(${JSON.stringify(id)}),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);if(e.disabled||e.hidden||r.width<=0||r.height<=0||!(h===e||e.contains(h)))throw Error('Profile control is not clickable');return{x:Math.round(x),y:Math.round(y)};})()`);
  context.window.webContents.sendInputEvent({type: 'mouseMove', ...point});
  context.window.webContents.sendInputEvent({type: 'mouseDown', ...point, button: 'left', clickCount: 1});
  context.window.webContents.sendInputEvent({type: 'mouseUp', ...point, button: 'left', clickCount: 1});
}
async function editName(context, name) {
  if (!(await snapshot(context)).nodes['settings-profile-editor'].visible) await click(context, 'settings-profile-open');
  await waitFor('profile editor', async () => (await snapshot(context)).nodes['settings-profile-editor'].visible);
  await run(context, "document.getElementById('settings-profile-name-input').focus();document.getElementById('settings-profile-name-input').select()");
  await bounded(context.window.webContents.insertText(name), 'Native text insertion');
  assert.equal(await run(context, "document.getElementById('settings-profile-name-input').value"), name);
  await click(context, 'settings-profile-save');
  await waitFor('persisted profile name', async () => (await snapshot(context)).nodes['settings-profile-name'].text === name);
  assert.equal((await context.profile.state()).name, name);
}
function geometry(value, {wide, id, name, photo = true, editor = false, privateMode = false} = {}) {
  assert.equal(value.open, true); assert.equal(value.nodeInRenderer, false); assert.deepEqual(value.errors, []);
  assert.equal(value.sectionCount, 20); assert.equal(value.toggleCount, 6);
  assert.equal(value.footerContainsCard, true); assert.equal(value.profileBeforeVersion, true);
  const card = value.nodes['settings-profile-open'], version = value.nodes['settings-sidebar-version'];
  for (const key of ['settings-profile', 'settings-profile-open', 'settings-profile-name', 'settings-profile-id', 'settings-sidebar-version']) assert.equal(value.nodes[key].visible, true, key + ' must be visible');
  assert.equal(card.hit, true); assert.equal(version.hit, true);
  assert.ok(card.rect.bottom <= version.rect.top + 1, 'The profile card must sit above the version without overlap');
  assert.ok(value.nodes['settings-profile'].rect.bottom <= version.rect.top + 1, 'The editor/Flash row must not overlap the version');
  assert.ok(card.rect.left >= value.sidebar.left && card.rect.right <= value.sidebar.right + 1, 'Card must stay inside the navigation rail');
  assert.ok(value.footer.bottom <= value.sidebar.bottom + 1, 'Footer must fit in the rail');
  assert.ok(value.navigation.bottom <= value.footer.top + 1, 'Profile footer must not overlap navigation');
  if (wide) {
    assert.ok(value.panel.width > 620); assert.ok(value.sidebar.width < value.panel.width / 2);
    assert.ok(value.sidebar.bottom - value.footer.bottom <= 30, 'Wide profile footer must stay at the bottom left');
    assert.ok(value.sidebar.right <= value.main.left + 1, 'Wide navigation and content must not overlap');
  } else {
    assert.ok(value.panel.width <= 420); assert.ok(value.sidebar.bottom <= value.main.top + 1, 'Narrow navigation and content must not overlap');
  }
  assert.equal(value.nodes['settings-profile-name'].text, name);
  assert.equal(value.nodes['settings-profile-id'].text, privateMode ? 'Профиль скрыт' : id == null ? 'Mouse ID ещё не назначен' : 'Твой Mouse ID: ' + id);
  assert.equal(value.nodes['settings-profile-editor'].visible, editor);
  assert.equal(value.nodes['settings-profile-photo'].visible, photo);
  assert.ok(value.avatar.rect.width >= 34 && Math.abs(value.avatar.rect.width - value.avatar.rect.height) <= 1);
  assert.equal(value.avatar.radius, '50%');
  if (photo) { assert.equal(value.avatar.complete, true); assert.equal(value.avatar.pngSource, true); assert.ok(value.avatar.naturalWidth > 0 && value.avatar.naturalWidth <= 256); assert.ok(value.avatar.naturalHeight > 0 && value.avatar.naturalHeight <= 256); }
  if (privateMode) { assert.equal(card.disabled, true); assert.equal(value.avatar.srcSet, false); assert.equal(value.nodes['settings-profile-flash'].visible, false); }
  else { assert.equal(card.disabled, false); assert.equal(value.nodes['settings-profile-flash'].visible, true); assert.equal(value.nodes['settings-profile-flash'].hit, true); }
  return value;
}
async function capture(context, label, expectation) {
  await run(context, 'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const view = geometry(await snapshot(context), expectation);
  const picture = await bounded(context.window.webContents.capturePage(), 'Profile screenshot');
  assert.equal(picture.isEmpty(), false); const pixels = picture.getSize();
  assert.ok(pixels.width >= view.viewport.width && pixels.height >= view.viewport.height);
  const bytes = picture.toPNG(), filename = label + '.png'; await fs.writeFile(path.join(evidence, filename), bytes);
  receipt.screenshots.push({file: filename, sha256: sha(bytes), bytes: bytes.length, pixels, view}); return view;
}
async function createFixture() {
  await fs.mkdir(root, {recursive: true, mode: 0o700}); await fs.mkdir(evidence, {recursive: true});
  const production = path.resolve(__dirname, '../desktop/mouse'), html = await fs.readFile(path.join(production, 'index.html'), 'utf8');
  const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(match => match[1]);
  assert.ok(styles.includes('settings-glass.css') && styles.includes('mac-workspace-polish.css'));
  const scripts = ['layout.js', 'appearance.js', 'temperature.js', 'chrome-surface-settings.js', 'settings-panel.js', 'i18n.js'];
  const build = await fs.readFile(path.join(production, '../mouse-build.cjs'), 'utf8');
  const version = /extraMetadata:\{[^}]*version:'([^']+)'/.exec(build)?.[1]; assert.match(version || '', /^\d+\.\d+\.\d+$/);
  receipt.assets = [];
  for (const file of [...styles, ...scripts]) {
    assert.match(file, /^[\w.-]+\.(css|js)$/); const data = await fs.readFile(path.join(production, file));
    receipt.assets.push({file: 'desktop/mouse/' + file, sha256: sha(data)});
  }
  const url = filename => pathToFileURL(filename).href;
  const contents = `<!doctype html><html lang="ru" data-theme="light" data-platform="darwin" data-fixture-version="${version}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src file:; style-src file: 'unsafe-inline'; img-src file: data:; font-src file: data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"><title>Mouse — проверка профиля</title>
${styles.map(file => `<link rel="stylesheet" href="${url(path.join(production, file))}">`).join('\n')}
<style>body{display:flex;flex-direction:column}#workspace{flex:1;min-height:0}#stage{display:flex;align-items:center;justify-content:center;color:var(--muted);padding:24px;text-align:center}#statusbar{flex:0 0 28px}#settings-button{position:absolute;left:8px;top:8px;width:1px;height:1px;opacity:0;pointer-events:none}</style>
</head><body><main id="workspace"><section id="stage">Mouse<br>Проверка карточки профиля</section></main><footer id="statusbar">Проверка интерфейса · синтетические профили</footer><button id="settings-button" aria-label="Настройки"></button><dialog id="settings-dialog" data-nonmodal="true"><header></header><div class="dialog-content"></div></dialog>
${scripts.map(file => `<script src="${url(path.join(production, file))}"></script>`).join('\n')}
<script src="${url(path.join(__dirname, 'mouse-profile-ui-smoke-fixture.js'))}"></script></body></html>`;
  fixture = path.join(root, 'profile-fixture.html'); await fs.writeFile(fixture, contents);
  // A deliberately synthetic source image larger than the native 256px thumbnail.
  const width = 512, height = 512, bitmap = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4, circle = (x - 256) ** 2 + (y - 256) ** 2 < 172 ** 2;
    bitmap[at] = circle ? 214 : 238; bitmap[at + 1] = circle ? 127 : 231; bitmap[at + 2] = circle ? 54 : 218; bitmap[at + 3] = 255;
  }
  const image = nativeImage.createFromBitmap(bitmap, {width, height, scaleFactor: 1}); assert.equal(image.isEmpty(), false);
  avatarPath = path.join(root, 'synthetic-avatar.png'); await fs.writeFile(avatarPath, image.toPNG());
}
function resizeNativeWindow(window, narrow = false) {
  const bounds = window.getBounds(), content = window.getContentBounds();
  const available = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(narrow ? 720 : 1100, available.width - (bounds.width - content.width));
  const height = Math.min(840, available.height - (bounds.height - content.height));
  assert.ok(width > (narrow ? 660 : 900) && height >= 500, 'The native display must fit the tested layout');
  window.setContentSize(width, height);
  return {width, height};
}
async function makeContext(role) {
  console.log('PHASE profile window ' + role);
  const directory = path.join(root, role), identity = await loadIdentity({directory: path.join(directory, 'identity'), name: role + ' test Mac', protect, unprotect});
  const channel = 'mouse:profile-smoke:' + crypto.randomBytes(16).toString('hex');
  const partition = 'mouse-profile-smoke-' + crypto.randomBytes(16).toString('hex');
  const isolated = session.fromPartition(partition, {cache: false});
  isolated.setPermissionCheckHandler(() => false); isolated.setPermissionRequestHandler((_wc, _permission, reply) => reply(false));
  isolated.on('will-download', event => event.preventDefault());
  isolated.webRequest.onBeforeRequest({urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']}, (_request, reply) => reply({cancel: true}));
  const window = new BrowserWindow({title: 'Mouse — проверка профиля', width: 1100, height: 840, useContentSize: true,
    show: false, backgroundColor: '#f3f5f9', webPreferences: {partition, preload: path.join(__dirname, 'mouse-profile-ui-smoke-preload.cjs'),
      additionalArguments: ['--mouse-profile-smoke-channel=' + channel], sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false, backgroundThrottling: false}});
  const context = {role, window, channel, identity, privateMode: false, profileCalls: 0, pickerCalls: 0, cancelPicker: false, flashOpens: 0, errors: [], entry: pathToFileURL(fixture).href};
  contexts.push(context);
  const profileElectron = {nativeImage, dialog: {showOpenDialog: async (parent, options) => {
    assert.equal(parent, window); assert.equal(options.properties.includes('openFile'), true); context.pickerCalls++;
    return context.cancelPicker ? {canceled: true, filePaths: []} : {canceled: false, filePaths: [avatarPath]};
  }}};
  context.profile = new MouseProfile({directory: path.join(directory, 'profile'), electron: profileElectron, window,
    canUse: () => !context.privateMode && !window.isDestroyed(), getIdentity: async () => identity,
    serverPublicKey: registry.serverPublicKey, flashAvailable: () => !context.privateMode});
  context.flash = new FlashService({electron, directory: path.join(directory, 'flash'), identity, canOpen: () => !context.privateMode && !window.isDestroyed()});
  ipcMain.handle(channel, async (event, action, payload) => {
    assert.equal(trustedFrame(event, window, context.entry), true, 'Profile fixture rejects untrusted IPC');
    if (action === 'profile') { context.profileCalls++; return context.profile.call(payload.action, payload.payload); }
    if (action === 'open-flash') { assert.equal(context.privateMode, false, 'Flash is unavailable in private mode'); const result = await context.flash.open(); context.flashOpens++; return result; }
    throw new Error('Unknown profile fixture action');
  });
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  window.webContents.on('will-navigate', event => event.preventDefault()); window.webContents.on('will-redirect', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('preload-error', (_event, _file, error) => context.errors.push(error.message));
  window.webContents.on('render-process-gone', (_event, details) => context.errors.push('Renderer gone: ' + details.reason));
  const prefs = window.webContents.getLastWebPreferences();
  for (const [name, value] of Object.entries({sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true, webviewTag: false})) assert.equal(prefs[name], value, name);
  const expectedSize = resizeNativeWindow(window);
  await bounded(window.loadURL(context.entry), 'Load production profile fixture'); window.show(); window.focus();
  await waitFor('initial native profile viewport', () => run(context, `innerWidth===${expectedSize.width}&&innerHeight===${expectedSize.height}`));
  await waitFor('profile fixture boot', () => run(context, '!!globalThis.MouseProfileSmokeFixture'));
  await run(context, 'MouseProfileSmokeFixture.ready');
  await waitFor('native draft/certificate state and decoded avatar', async () => {
    const view = await snapshot(context);
    return view.nodes['settings-profile-id'].text !== '' && (view.nodes['settings-profile-photo'].hidden || view.avatar.complete && view.avatar.naturalWidth > 0);
  });
  return context;
}
async function configure(context, theme, narrow = false) {
  const {width, height} = resizeNativeWindow(context.window, narrow);
  context.window.show(); context.window.focus();
  await waitFor('native profile resize', () => run(context, `innerWidth===${width}&&innerHeight===${height}`));
  return run(context, `MouseProfileSmokeFixture.configure({theme:${JSON.stringify(theme)},width:${narrow ? 380 : 760}})`);
}
async function enroll(context, action, ownerBootstrapSecret) {
  const state = await context.profile.state(); assert.equal(state.verified, false); assert.equal(state.mouseId, null);
  const challenge = await registry.issueChallenge({action, identity: context.identity.identity, name: state.name, avatarHash: avatarHash(state.avatar)});
  const proof = context.identity.sign(accountChallengeTranscript(challenge));
  const result = await registry.completeChallenge({challengeId: challenge.challengeId, ...proof,
    ...(ownerBootstrapSecret === undefined ? {} : {ownerBootstrapSecret})});
  await context.profile.acceptCertificate(result.certificate); await run(context, 'MouseProfileSmokeFixture.reopen()');
  return result;
}
async function closeContext(context) {
  if (context.closed) return; context.closed = true;
  await context.profile.flush(); await context.flash.dispose(); ipcMain.removeHandler(context.channel);
  if (!context.window.isDestroyed()) context.window.destroy();
}
async function main() {
  assert.equal(process.platform, 'darwin', 'This native gate is macOS only');
  await app.whenReady(); await createFixture();
  const ownerBootstrapSecret = crypto.randomBytes(32).toString('base64url');
  registry = await openAccountRegistry({directory: path.join(root, 'registry'), ownerBootstrapSecret, signingKey: crypto.generateKeyPairSync('ed25519').privateKey});
  owner = await makeContext('owner');
  await capture(owner, 'draft-light-wide', {wide: true, id: null, name: 'Твой профиль', photo: false});
  assert.equal((await owner.profile.state()).mouseId, null); check('fresh native profile has no assigned Mouse ID');
  await editName(owner, 'Владелец Mouse');
  await click(owner, 'settings-profile-open'); await waitFor('avatar editor', async () => (await snapshot(owner)).nodes['settings-profile-editor'].visible);
  await click(owner, 'settings-profile-avatar-choose');
  await waitFor('native thumbnail displayed', async () => { const view = await snapshot(owner); return view.nodes['settings-profile-photo'].visible && view.avatar.complete && view.avatar.naturalWidth > 0 && !view.nodes['settings-profile-open'].disabled; });
  const avatarState = await owner.profile.state(), avatar = Buffer.from(avatarState.avatar.split(',')[1], 'base64');
  assert.ok(avatar.readUInt32BE(16) <= 256 && avatar.readUInt32BE(20) <= 256); assert.equal(avatarState.mouseId, null);
  await capture(owner, 'draft-editor-light-wide', {wide: true, id: null, name: 'Владелец Mouse', editor: true});
  owner.cancelPicker = true; const pickerCount = owner.pickerCalls; await click(owner, 'settings-profile-avatar-choose');
  await waitFor('canceled native photo picker', async () => owner.pickerCalls === pickerCount + 1 && !(await snapshot(owner)).nodes['settings-profile-open'].disabled);
  assert.equal((await owner.profile.state()).avatar, avatarState.avatar); owner.cancelPicker = false;
  await click(owner, 'settings-profile-avatar-remove');
  await waitFor('native photo removal', async () => !(await snapshot(owner)).nodes['settings-profile-photo'].visible && !(await snapshot(owner)).nodes['settings-profile-open'].disabled);
  assert.equal((await owner.profile.state()).avatar, null);
  await click(owner, 'settings-profile-avatar-choose');
  await waitFor('native photo replacement', async () => { const view = await snapshot(owner); return view.nodes['settings-profile-photo'].visible && view.avatar.complete && !view.nodes['settings-profile-open'].disabled; });
  await click(owner, 'settings-profile-cancel');
  await waitFor('profile editor closed', async () => !(await snapshot(owner)).nodes['settings-profile-editor'].visible);
  check('native name save, PNG thumbnail, canceled picker, removal and replacement', {pickerCalls: owner.pickerCalls, avatarSha256: sha(avatar), thumbnail: {width: avatar.readUInt32BE(16), height: avatar.readUInt32BE(20)}});
  ordinary = await makeContext('ordinary'); await editName(ordinary, 'Гость Mouse');
  const normalCertificate = await enroll(ordinary, 'register'); assert.equal(normalCertificate.accountId, 2);
  await capture(ordinary, 'ordinary-id2-light-wide', {wide: true, id: 2, name: 'Гость Mouse', photo: false});
  check('first ordinary registration receives ID 2 while owner ID 1 remains reserved');
  const ownerCertificate = await enroll(owner, 'claim-owner', ownerBootstrapSecret); assert.equal(ownerCertificate.accountId, 1);
  await assert.rejects(registry.issueChallenge({action: 'claim-owner', identity: ordinary.identity.identity, name: 'Гость Mouse'}), error => error.code === 'ACCOUNT_OWNER_UNAVAILABLE');
  check('owner ID 1 requires device proof and the one-time test owner capability');
  const colors = {}, panelWidths = new Set();
  for (const theme of ['light', 'dark']) for (const narrow of [false, true]) {
    await configure(owner, theme, narrow);
    const view = await capture(owner, 'owner-id1-' + theme + '-' + (narrow ? 'narrow' : 'wide'), {wide: !narrow, id: 1, name: 'Владелец Mouse'});
    colors[theme] = view.nodes['settings-profile-name'].color; panelWidths.add(view.panel.width);
  }
  assert.notEqual(colors.light, colors.dark); check('visible circular avatar, name and certified ID above version in both themes and widths', {themes: ['light', 'dark'], panelWidths: [...panelWidths], nameColors: colors});
  const savedDeviceId = owner.identity.identity.deviceId, savedProfile = await owner.profile.state();
  await closeContext(owner); owner = await makeContext('owner');
  assert.equal(owner.identity.identity.deviceId, savedDeviceId); assert.equal((await owner.profile.state()).avatar, savedProfile.avatar);
  geometry(await snapshot(owner), {wide: true, id: 1, name: 'Владелец Mouse'});
  check('profile name, avatar, device binding and signed ID survive native store/window reopening');
  await click(owner, 'settings-profile-flash');
  await waitFor('profile Flash action opens shipped isolated window', async () => owner.flashOpens === 1 && owner.flash.window && !(await snapshot(owner)).open);
  const flashPreferences = owner.flash.window.webContents.getLastWebPreferences();
  assert.equal(owner.flash.window.webContents.getURL(), owner.flash.entry); assert.equal(flashPreferences.sandbox, true); assert.equal(flashPreferences.contextIsolation, true); assert.equal(flashPreferences.nodeIntegration, false);
  check('profile Flash action opens the actual sandboxed FlashService window');
  await owner.flash.pause(); await run(owner, 'MouseProfileSmokeFixture.reopen()');
  const callsBeforePrivate = owner.profileCalls, pickerBeforePrivate = owner.pickerCalls;
  owner.privateMode = true; owner.profile.cancelPending(); await run(owner, 'MouseProfileSmokeFixture.configure({privateMode:true})');
  assert.equal(owner.profileCalls, callsBeforePrivate);
  await capture(owner, 'private-light-wide', {wide: true, id: null, name: 'Инкогнито', photo: false, privateMode: true});
  const rejected = await run(owner, `(async()=>{const out=[];for(const [action,payload] of [['state',{}],['set',{name:'ЗАПРЕЩЕНО'}],['choose-avatar',{}],['remove-avatar',{}]]){try{await MouseProfileSmokeNative.profile(action,payload);out.push(false);}catch{out.push(true);}}try{await MouseProfileSmokeNative.openFlash();out.push(false);}catch{out.push(true);}return out;})()`);
  assert.deepEqual(rejected, [true, true, true, true, true]); assert.equal(owner.pickerCalls, pickerBeforePrivate); assert.equal(owner.flashOpens, 1);
  owner.privateMode = false; await run(owner, 'MouseProfileSmokeFixture.configure({privateMode:false})');
  await waitFor('normal profile restored', async () => (await snapshot(owner)).nodes['settings-profile-id'].text === 'Твой Mouse ID: 1');
  assert.equal((await owner.profile.state()).name, savedProfile.name); assert.equal((await owner.profile.state()).avatar, savedProfile.avatar);
  check('incognito clears visible identity and native IPC denies reads, writes, photo picker and Flash');
  for (const context of contexts) assert.deepEqual(context.errors, []);
  receipt.pass = true;
}
async function complete(error) {
  if (exiting) return; exiting = true; clearTimeout(watchdog);
  if (error) { receipt.pass = false; receipt.error = String(error.stack || error).slice(0, 5000); console.error(receipt.error); }
  for (const context of contexts) {
    receipt.rendererErrors.push(...context.errors.map(message => ({role: context.role, message})));
    if (error && !context.window.isDestroyed()) {
      try { receipt.failureView = {role: context.role, view: await snapshot(context)}; await fs.writeFile(path.join(evidence, 'failure-' + context.role + '.png'), (await context.window.webContents.capturePage()).toPNG()); } catch {}
    }
    await bounded(closeContext(context), 'Profile fixture cleanup', 5000).catch(failure => { receipt.pass = false; receipt.cleanupError = failure.message; });
  }
  if (registry) await bounded(registry.close(), 'Profile test issuer cleanup', 5000).catch(failure => { receipt.pass = false; receipt.cleanupError = failure.message; });
  if (error) receipt.pass = false;
  receipt.status = receipt.pass ? 'PASS' : 'FAIL';
  await fs.mkdir(evidence, {recursive: true}); await fs.writeFile(path.join(evidence, 'mouse-profile-ui.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(receipt.pass ? 'MOUSE_PROFILE_UI_PASS' : 'MOUSE_PROFILE_UI_FAIL'); app.exit(receipt.pass ? 0 : 1);
}
const watchdog = setTimeout(() => { void complete(new Error('Native profile acceptance exceeded 180 seconds')); }, 180000);
main().then(() => complete(), error => complete(error)).catch(error => { console.error(error); app.exit(1); });
