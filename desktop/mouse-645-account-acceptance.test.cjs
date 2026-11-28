'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {envelope} = require('./testfixtures/mouse-645-account-evidence.cjs');
const S = require('../tools/mouse-645-account-verify.cjs');
const smoke = require('./mouse-645-account-smoke.cjs');

function presentationFixture({presentsWorkspace = true, ignoreBounds = false, neverReady = false} = {}) {
  const {fixtureWindowBounds} = require('./mouse-631-smoke-helpers.cjs');
  const workArea = {x: 0, y: 25, width: 1600, height: 850}, minimum = [800, 600], report = {}, persisted = [];
  let bounds = {x: 80, y: 25, width: 1440, height: 960}, focused = false, visible = false, frames = 0, reads = 0;
  const win = {isFullScreen: () => false, isMaximized: () => false, isMinimized: () => false,
    getBounds: () => ({...bounds}), getContentBounds: () => ({...bounds}), getMinimumSize: () => minimum,
    setBounds: next => { if (!ignoreBounds) bounds = {...next}; }, show: () => { visible = true; }, focus: () => { focused = true; },
    isVisible: () => visible, isFocused: () => focused, webContents: {focus() {}, isFocused: () => focused}};
  const args = {app: {focus() {}}, win, screen: {getDisplayMatching: () => ({id: 1, bounds: {x: 0, y: 0, width: 1600, height: 900}, workArea, scaleFactor: 1})},
    nativeDesktopId: () => 'desk-1', presentsWorkspace, report, persist: async () => { persisted.push(structuredClone(report)); },
    readState: async () => { reads++; return {ready: true, markerReady: true, switching: reads < 3,
      desktopSliding: false, desktopId: neverReady ? 'desk-2' : 'desk-1', stateDesktopId: 'desk-1', visible: 'visible', focused: true}; },
    frame: async () => { frames++; }, until: async check => { for (let i = 0; i < 4; i++) if (await check()) return; throw Error('fixed preparation budget exhausted'); }};
  return {args, report, persisted, frames: () => frames, expectedBounds: fixtureWindowBounds(workArea, minimum)};
}
test('installed account preparation uses retained geometry and waits for settled renderer/native selection before the writer frame', async () => {
  const fixture = presentationFixture(); await smoke.prepareAccountWindow(fixture.args);
  assert.equal(fixture.report.geometry.before.window.height, 960);
  assert.deepEqual(fixture.report.geometry.requestedBounds, fixture.expectedBounds);
  assert.deepEqual(fixture.report.geometry.after.window, fixture.expectedBounds);
  assert.deepEqual(fixture.report.geometry.after.content, fixture.expectedBounds);
  assert.equal(fixture.report.initial.switching, true); assert.equal(fixture.report.settled.switching, false);
  assert.equal(fixture.report.settled.desktopId, fixture.report.settled.nativeDesktopId);
  assert.equal(fixture.frames(), 1); assert.equal(fixture.report.frameBoundary, true);
  assert.equal(fixture.persisted[0].geometry.before.window.height, 960);
});
test('account state readers require no animation while unfitted windows or mismatched desktop readiness still fail', async () => {
  const reader = presentationFixture({presentsWorkspace: false}); await smoke.prepareAccountWindow(reader.args);
  assert.equal(reader.frames(), 0); assert.equal(reader.report.frameBoundary, false);
  const unfitted = presentationFixture({ignoreBounds: true});
  await assert.rejects(smoke.prepareAccountWindow(unfitted.args), /fit the display work area/); assert.equal(unfitted.frames(), 0);
  const mismatch = presentationFixture({neverReady: true});
  await assert.rejects(smoke.prepareAccountWindow(mismatch.args), /fixed preparation budget/); assert.equal(mismatch.frames(), 0);
});
test('account diagnostics passively observe the actual desktop presentation hook, bound trace size and restore the previous collector', async () => {
  const vm = require('node:vm'), previous = {owned: true}; let now = 0;
  const scope = {__mouse631Frames: previous, MouseNative: {test: true}, performance: {now: () => ++now},
    requestAnimationFrame: callback => { queueMicrotask(() => callback(++now)); return now; }, cancelAnimationFrame() {}, setTimeout, clearTimeout};
  smoke.installPresentationTrace(scope);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'mouse/desktop-slide.js'), 'utf8'), scope);
  assert.equal(await scope.MouseDesktopSlide.presented(), true);
  assert.deepEqual(scope.__mouse645PresentationTrace.read().map(row => row.phase), ['present.raf1', 'present.raf2']);
  for (let i = 0; i < 300; i++) scope.__mouse631Frames.switchTrace.record('layout.end', i);
  const trace = scope.__mouse645PresentationTrace.read(); assert.equal(trace.length, 256); assert.equal(trace.at(-1).frameTime, 299);
  scope.__mouse645PresentationTrace.dispose(); assert.equal(scope.__mouse631Frames, previous); assert.equal(scope.__mouse645PresentationTrace, undefined);
});

test('account acceptance checks a complete synthetic envelope only as a verifier contract, not native execution', () => {
  const fixture = envelope(), value = S.verify(fixture.read);
  assert.equal(value.status, 'PASS'); assert.equal(value.physicalUserDeviceVerified, false);
  assert.equal(value.logicalDevices, 2); assert.equal(value.installedProcesses, 14);
});
test('account acceptance rejects leaked cookies, local content, incorrect guest restoration and retained credentials', () => {
  for (const [name, edit] of [
    [smoke.reportName(8), value => { value.restored.local.cookie = 'fixture-A'; }],
    [smoke.reportName(8), value => { value.restored.privateMarker.file = 'copied-file'; }],
    [smoke.reportName(4), value => { value.cleanGuest.workspace.theme = 'dark'; }],
    [smoke.reportName(2), value => { value.credentials.present = true; }],
    [smoke.reportName(2), value => { value.cleanGuest.before.state.bookmarks.push({id: 'leak', url: 'https://example.org/', title: 'leak', at: 1}); }],
    ['mouse-645-account-server.json', value => { value.cloud[0].state.files = ['unexpected']; }],
    ['mouse-645-account-server.json', value => { value.normalLogout.activeSessions = 1; }],
    ['mouse-645-account-server.json', value => { value.immediateLogoutSync.state.preferences.theme = 'dark'; }],
    [smoke.reportName(1), value => { value.logoutEdit.syncInvokedAfterEdit = true; }]
  ]) { const fixture = envelope(); fixture.edit(name, edit); assert.throws(() => S.verify(fixture.read), undefined, name); }
});
test('account acceptance rejects pre-window account exposure, forged account certificates and missing recovery acknowledgement', () => {
  for (const [name, edit] of [
    [smoke.reportName(12, '-guard'), value => { value.windowCount = 1; }],
    [smoke.reportName(12, '-guard'), value => { value.phase = 'authenticated'; }],
    [smoke.reportName(1), value => { value.certificate.signature = Buffer.alloc(64).toString('base64'); }],
    [smoke.reportName(0), value => { value.registration.recoveryShown = false; }],
    [smoke.reportName(1), value => { value.credentials.realSafeStorage = false; }],
    [smoke.reportName(8), value => { value.profile.avatarSha256 = null; }]
  ]) { const fixture = envelope(); fixture.edit(name, edit); assert.throws(() => S.verify(fixture.read), undefined, name); }
});
test('account acceptance requires distinct real process/exit bindings and pinned loopback service', () => {
  for (const [name, edit] of [
    [smoke.reportName(5, '-observed'), value => { value.raw = '42 999 /Applications/Other.app/Contents/MacOS/Other'; }],
    [smoke.reportName(5, '-exit'), value => { value.code = 1; }],
    [smoke.reportName(5, '-entry'), value => { value.pid = 1234; }],
    ['mouse-645-account-processes.json', value => { value.identityOrigin = 'https://mouse.black'; }],
    ['mouse-645-account-server.json', value => { value.serverPublicKey = 'wrong pinned issuer'; }]
  ]) { const fixture = envelope(); fixture.edit(name, edit); assert.throws(() => S.verify(fixture.read), undefined, name); }
  assert.equal(S.loopback('http://127.0.0.1:1234'), true);
  for (const origin of ['http://127.0.0.1', 'http://localhost:1234', 'http://127.0.0.1:1234/path', 'https://example.org', 'http://127.0.0.1.evil:1234']) assert.equal(S.loopback(origin), false);
  assert.deepEqual(S.parseProcess(' 12 1 /Applications/Mouse.app/Contents/MacOS/Mouse\n', 12, '/Applications/Mouse.app/Contents/MacOS/Mouse'), {pid: 12, ppid: 1, executable: '/Applications/Mouse.app/Contents/MacOS/Mouse'});
  assert.throws(() => S.parseProcess('12 1 /Applications/Other', 12, '/Applications/Mouse'));
});
test('account receipt summaries never expose response tokens, passwords or recovery material', () => {
  const summary = smoke.stateSummary({phase: 'authenticated', accountId: 2, name: 'A', available: true,
    recoveryPending: true, recoveryKey: 'recovery-secret', accessToken: 'access-secret', refreshToken: 'refresh-secret', password: 'password-secret'});
  for (const text of ['recovery-secret', 'access-secret', 'refresh-secret', 'password-secret']) assert.equal(JSON.stringify(summary).includes(text), false);
});
test('installed grid comparison accepts native omitted empties but rejects changed real pane assignments', () => {
  const {DesktopBank} = require('./mouse-desktops.cjs'), L = require('./mouse/layout.js');
  const bank = new DesktopBank(), id = 'feed0000-1111-4222-8333-abcdef123456', tree = L.preset(2);
  const preferences = {...bank.preferences(), tree, slots: {p1: id, p2: ''}};
  bank.assign(id, bank.active);
  const live = bank.liveLayout(preferences, bank.active, [{id, lane: 'main'}]);
  assert.deepEqual(live.slots, {p1: id}, 'Production native layout omits an empty pane');
  assert.deepEqual(smoke.slotOccupancy(tree, preferences.slots), smoke.slotOccupancy(tree, live.slots));
  assert.deepEqual(smoke.slotOccupancy(tree, {}), {p1: '', p2: ''});
  assert.notDeepEqual(smoke.slotOccupancy(tree, {p1: id}), smoke.slotOccupancy(tree, {}));
  assert.notDeepEqual(smoke.slotOccupancy(tree, {p1: id}), smoke.slotOccupancy(tree, {p2: id}));
  assert.throws(() => smoke.slotOccupancy(tree, {p3: id}));
  assert.throws(() => smoke.slotOccupancy(tree, {p1: null}));
  const fixture = envelope(); fixture.edit(smoke.reportName(0), value => { value.written.workspace.placedTabIds = []; });
  assert.throws(() => S.verify(fixture.read));
});
test('account finalize hashes every consumed receipt and rejects linked files or escaped fixture passwords', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mouse645-account-acceptance-unit-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const fixture = envelope(); for (const [name, bytes] of fixture.files) fs.writeFileSync(path.join(directory, name), bytes);
  const result = S.finalize(directory);
  const release = require('../tools/mouse-645-account-manifest.cjs').bind(directory, 'darwin', 'arm64');
  assert.equal(release.logicalDevices, 2); assert.equal(release.installedProcesses, 14);
  assert.equal(result.artifacts.length, fixture.files.size);
  for (const item of result.artifacts) { const value = fixture.files.get(item.file); assert.equal(item.bytes, value.length); assert.equal(item.sha256, createHash('sha256').update(value).digest('hex')); }
  const log = path.join(directory, 'mouse-645-account-run-0.log');
  fs.writeFileSync(log, smoke.constants.PASSWORDS.A); assert.throws(() => S.finalize(directory), /password/);
  assert.throws(() => require('../tools/mouse-645-account-manifest.cjs').bind(directory, 'darwin', 'arm64'));
  fs.unlinkSync(log); fs.symlinkSync(path.join(directory, 'mouse-645-account-run-1.log'), log);
  assert.throws(() => S.finalize(directory), /linked/);
});
test('Mac release requires the installed account gate, its independent manifest and retained UI gates', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/mouse-macos.yml'), 'utf8');
  for (const name of ['MOUSE_645_ACCOUNT_ACCEPTANCE_PASS', 'mouse-645-account-acceptance.json',
    'mouse-645-account-manifest.cjs', 'account645', 'MOUSE_645_UI_NATIVE_PASS', 'mouse-645-manifest.cjs']) assert.ok(workflow.includes(name), name);
  const runner = fs.readFileSync(path.join(__dirname, '../tools/mouse-verify.py'), 'utf8');
  assert.match(runner, /mouse-645-account-verify\.cjs/); assert.match(runner, /account_result\.returncode/);
  assert.match(runner, /identity_runner\.run/);
});
test('external account fixture starts the real loopback HTTP and SQLite service with owner one reserved', async () => {
  const fixture = await S.serviceFixture();
  try {
    assert.equal(S.loopback(fixture.identityOrigin), true); assert.equal(S.loopback(fixture.browserOrigin), true);
    assert.equal(fixture.service.get('SELECT status FROM accounts WHERE id=1').status, 'reserved');
    assert.equal(fixture.service.get('PRAGMA journal_mode').journal_mode, 'wal');
    assert.equal((await fetch(fixture.identityOrigin + '/health')).status, 200);
    const page = await fetch(fixture.browserOrigin + '/page/A/'); assert.equal(page.status, 200);
    assert.match(await page.text(), /mouse645AccountFixture=true/);
    assert.equal((await fetch(fixture.browserOrigin + '/external')).status, 404);
    assert.equal(fixture.sessionCounts().activeSessions, 0);
  } finally { await fixture.close(); }
});
