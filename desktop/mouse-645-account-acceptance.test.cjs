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

function presentationFixture({presentsWorkspace = true, ignoreBounds = false, neverReady = false, neverViewport = false, zoomFactor = 1} = {}) {
  const {fixtureWindowBounds} = require('./mouse-631-smoke-helpers.cjs');
  const workArea = {x: 0, y: 25, width: 1600, height: 850}, minimum = [800, 600], report = {}, persisted = [];
  let bounds = {x: 80, y: 25, width: 1440, height: 960}, focused = false, visible = false, frames = 0, reads = 0;
  const win = {isFullScreen: () => false, isMaximized: () => false, isMinimized: () => false,
    getBounds: () => ({...bounds}), getContentBounds: () => ({...bounds}), getMinimumSize: () => minimum,
    setBounds: next => { if (!ignoreBounds) bounds = {...next}; }, show: () => { visible = true; }, focus: () => { focused = true; },
    isVisible: () => visible, isFocused: () => focused, webContents: {focus() {}, isFocused: () => focused, getZoomFactor: () => zoomFactor}};
  const args = {app: {focus() {}}, win, screen: {getDisplayMatching: () => ({id: 1, bounds: {x: 0, y: 0, width: 1600, height: 900}, workArea, scaleFactor: 1})},
    nativeDesktopId: () => 'desk-1', presentsWorkspace, report, persist: async () => { persisted.push(structuredClone(report)); },
    readState: async () => { reads++; return {ready: true, markerReady: true, switching: reads < 3,
      desktopSliding: false, desktopId: neverReady ? 'desk-2' : 'desk-1', stateDesktopId: 'desk-1', visible: 'visible', focused: true,
      viewport: reads < 4 || neverViewport ? {innerWidth: 1440, innerHeight: 960} : {innerWidth: Math.floor(bounds.width / zoomFactor), innerHeight: Math.floor(bounds.height / zoomFactor)}}; },
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
  assert.equal(fixture.report.geometry.zoomFactor, 1);
  assert.equal(fixture.report.settled.viewport.innerWidth, fixture.expectedBounds.width);
  assert.equal(fixture.report.settled.viewport.innerHeight, fixture.expectedBounds.height);
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
  const stale = presentationFixture({neverViewport: true});
  await assert.rejects(smoke.prepareAccountWindow(stale.args), /fixed preparation budget/); assert.equal(stale.frames(), 0);
  const zoomed = presentationFixture({zoomFactor: 1.25}); await smoke.prepareAccountWindow(zoomed.args);
  assert.equal(zoomed.report.geometry.zoomFactor, 1.25); assert.equal(zoomed.frames(), 1);
  assert.equal(zoomed.report.settled.viewport.innerWidth, zoomed.expectedBounds.width / 1.25);
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
test('presentation readback distinguishes a current CSS viewport and themed pseudo-element from an old native surface without changing DOM', () => {
  const sizes = Object.freeze({clientWidth: 1200, clientHeight: 794, scrollWidth: 1200, scrollHeight: 794});
  const rects = {'.toolbar': {x: 0, y: 0, width: 1200, height: 40}, '#workspace': {x: 0, y: 40, width: 1200, height: 730},
    '#statusbar': {x: 0, y: 770, width: 1200, height: 24}, '#new-tab': {x: 150, y: 2, width: 28, height: 28}};
  const elements = Object.fromEntries(Object.entries(rects).map(([key, value]) => [key, Object.freeze({getBoundingClientRect: () => Object.freeze(value)})]));
  const style = Object.freeze({display: 'flex', visibility: 'visible', opacity: '1'}), pseudo = Object.freeze({display: 'none', position: 'absolute', width: '28px', height: '28px'});
  const scope = {innerWidth: 1200, innerHeight: 794, visualViewport: {width: 1200, height: 794, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0, scale: 1},
    getComputedStyle: (_element, type) => type === '::before' ? pseudo : style,
    document: Object.freeze({visibilityState: 'visible', hasFocus: () => true,
      documentElement: Object.freeze({...sizes, dataset: Object.freeze({mouseReady: 'true', theme: 'light'})}), body: sizes,
      querySelector: selector => elements[selector] || null}),
    MouseTest: {model: {ready: true, desktopId: 'desk-2', state: {desktopId: 'desk-2'}}}};
  const read = smoke.presentationReadback(scope);
  assert.equal(read.rootTheme, 'light'); assert.deepEqual(read.documentSize, sizes); assert.deepEqual(read.bodySize, sizes);
  assert.equal(read.viewport.innerWidth, 1200); assert.equal(read.viewport.innerHeight, 794); assert.equal(read.viewport.visualViewport.scale, 1);
  assert.deepEqual(read.regions.statusbar.bounds, rects['#statusbar']); assert.equal(read.regions.statusbar.display, 'flex');
  assert.equal(read.regions.statusbar.visibility, 'visible'); assert.equal(read.regions.statusbar.opacity, '1');
  assert.deepEqual(read.newTab.before, pseudo); assert.deepEqual(read.newTab.region.bounds, rects['#new-tab']);
  assert.deepEqual(read.longTasks, {supported: false, entries: []});
});
test('long-task diagnostics use an optional bounded PerformanceObserver, drain pending entries and dispose without a heartbeat timer', () => {
  let instance, observeOptions, disconnects = 0;
  class Observer {
    static supportedEntryTypes = ['longtask'];
    constructor(callback) { this.callback = callback; this.pending = []; instance = this; }
    observe(value) { observeOptions = value; }
    takeRecords() { return this.pending.splice(0); }
    disconnect() { disconnects++; }
  }
  const previous = {untouched: true}, scope = {PerformanceObserver: Observer, __mouse631Frames: previous, performance: {now: () => 1},
    setTimeout() { assert.fail('Passive long-task observation must not schedule a heartbeat'); }, setInterval() { assert.fail('No timer'); }};
  smoke.installPresentationTrace(scope); assert.deepEqual(observeOptions, {type: 'longtask', buffered: false});
  instance.pending.push({entryType: 'longtask', startTime: 100, duration: 1600, attribution: [{secret: 'never retained'}]});
  assert.deepEqual(scope.__mouse645PresentationTrace.longTasks(), {supported: true, entries: [{startTime: 100, duration: 1600}]});
  instance.callback({getEntries: () => Array.from({length: 100}, (_, i) => ({entryType: 'longtask', startTime: 1800 + i * 60, duration: 51}))});
  const read = scope.__mouse645PresentationTrace.longTasks(); assert.equal(read.entries.length, 64); assert.ok(disconnects > 0);
  assert.equal(JSON.stringify(read).includes('attribution'), false); const before = disconnects;
  scope.__mouse645PresentationTrace.dispose(); assert.equal(disconnects, before + 1); assert.equal(scope.__mouse631Frames, previous);
  const unsupported = {performance: {now: () => 1}}; smoke.installPresentationTrace(unsupported);
  assert.deepEqual(unsupported.__mouse645PresentationTrace.longTasks(), {supported: false, entries: []}); unsupported.__mouse645PresentationTrace.dispose();
});
test('native presentation observation is bounded, cleans up and preserves a single switch result or original rejection', async () => {
  for (const reject of [false, true]) {
    const report = {}, original = Error('actual switch failed'); let interval, active = false, operations = 0, reads = 0, settle;
    const pending = new Promise((resolve, fail) => { settle = () => reject ? fail(original) : resolve('selected'); });
    const observed = smoke.observeNativePresentation({report, probe() { reads++; if (reads === 2) throw Error('probe unavailable'); return {occlusionVisible: true}; },
      operation: () => { operations++; return pending; }, timers: {setInterval(fn, ms) { assert.equal(ms, 125); interval = fn; active = true; return 7; },
        clearInterval(id) { assert.equal(id, 7); active = false; }}, now: () => reads});
    for (let i = 0; i < 25; i++) interval();
    assert.equal(active, false); assert.equal(report.samples.length, 16); assert.equal(reads, 16);
    assert.equal(report.samples[1].error, 'probe unavailable'); assert.equal(operations, 1);
    settle();
    if (reject) await assert.rejects(observed, error => error === original); else assert.equal(await observed, 'selected');
    assert.equal(active, false); assert.equal(operations, 1); assert.equal(report.diagnosticOnly, true);
  }
  const short = {}, cleared = [];
  assert.equal(await smoke.observeNativePresentation({report: short, probe: () => ({visible: true}), operation: async () => 42,
    timers: {setInterval: () => 8, clearInterval: id => cleared.push(id)}}), 42);
  assert.deepEqual(short.samples.map(row => row.phase), ['before', 'after']); assert.deepEqual(cleared, [8]);
});
function nativeSelectionFixture({trusted = true, matches = true, failed = false} = {}) {
  const vm = require('node:vm'), target = 'desk-2', listeners = new Map(), inputs = [];
  let posts = 0, pending = null, nativeDesk = 'desk-1';
  const content = {inert: true}, tray = {open: false, hidden: true, dataset: {motion: 'closed'}, querySelector: () => content};
  const model = {ready: true, desktopId: nativeDesk, state: {desktopId: nativeDesk}, switching: false, desktopSliding: false};
  const ui = {isOpen: false, isPreparing: false, holdsNative: false, motion: {isSettled: true}};
  const scope = {innerWidth: 1200, innerHeight: 794, MouseTest: {model, desktopUI: ui}, MouseDesktopSlide: {last: null},
    performance: {now: () => 500}, getComputedStyle: () => ({display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto'}),
    __mouse645PresentationTrace: {read: () => scope.MouseDesktopSlide.last ? [{phase: 'present.raf1', at: 530, frameTime: 529},
      ...(!failed ? [{phase: 'present.raf2', at: 550, frameTime: 549}] : [])] : [], longTasks: () => ({supported: false, entries: []})}};
  const document = {defaultView: scope, visibilityState: 'visible', hasFocus: () => true,
    documentElement: {dataset: {mouseReady: 'true', theme: 'light'}}, body: {},
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); }};
  function button(id, x, y) {
    const rect = {x, y, left: x, top: y, width: 20, height: 20, right: x + 20, bottom: y + 20};
    const element = {id, tagName: 'BUTTON', ownerDocument: document, parentElement: null, disabled: false,
      getBoundingClientRect: () => rect, getClientRects: () => [rect], matches: () => false,
      contains: value => value === element}; return element;
  }
  const open = button('desktops-button', 20, 20), go = button('', 60, 60), wrong = button('wrong', 100, 100);
  document.querySelector = selector => selector === '#desktops-button' ? open
    : selector === smoke.desktopSelectionSelector(target) ? go : selector === '#desktop-tray' ? tray : null;
  document.elementFromPoint = (x, y) => x < 50 && y < 50 ? open : go;
  scope.document = document; vm.createContext(scope);
  const js = async source => { const value = vm.runInContext(source, scope); return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); };
  const until = async check => { for (let i = 0; i < 4; i++) {
    if (await check()) return; if (pending) { const deliver = pending; pending = null; deliver(); }
  } throw Error('unchanged native input budget exhausted'); };
  const win = {getContentBounds: () => ({x: 4, y: 29, width: 1200, height: 794}),
    webContents: {id: 71, getZoomFactor: () => 1}};
  const nativeInput = {testClick(x, y) {
    posts++; const element = document.elementFromPoint(x - 4, y - 29);
    pending = () => {
      for (const listener of listeners.get('click') || []) listener({type: 'click', isTrusted: trusted,
        target: matches ? element : wrong, clientX: x - 4, clientY: y - 29});
      if (!trusted || !matches) return;
      if (element === open) { tray.open = true; tray.hidden = false; tray.dataset.motion = 'open'; content.inert = false; ui.isOpen = true; ui.holdsNative = true; }
      else { tray.open = false; tray.hidden = true; ui.isOpen = false; ui.holdsNative = false;
        model.desktopId = target; model.state.desktopId = target; nativeDesk = target;
        scope.MouseDesktopSlide.last = {strategy: 'live', phase: failed ? 'failed' : 'complete', presented: !failed,
          startedAt: 500, selectedAt: 520, layoutAt: 522, totalDurationMs: 60, layoutCalls: 1, snapshotCaptures: 0, borrowedHold: false,
          ...(failed ? {error: 'actual unchanged presentation deadline failed'} : {})}; }
    }; return true;
  }};
  const report = {target, before: {...smoke.presentationReadback(scope), nativeDesktopId: nativeDesk}};
  return {scope, js, until, win, nativeInput, target, report, inputs, posts: () => posts,
    args: {target, win, nativeInput, js, until, report, nativeDesktopId: () => nativeDesk, probe: () => ({visible: true})}};
}
test('account native desktop route posts exactly two real-driver inputs and observes delayed trusted targets before accepting the actual live transition', async () => {
  const fixture = nativeSelectionFixture(), startedAt = Date.now();
  await smoke.selectNativeDesktop(fixture.args);
  assert.equal(fixture.posts(), 2);
  assert.deepEqual(fixture.report.nativeInputs.map(row => row.selector), ['#desktops-button', '.desktop-card[data-desk="desk-2"] .desk-open']);
  assert.equal(smoke.assertDesktopSelection(fixture.report, {pid: process.pid, startedAt, completedAt: Date.now(), target: fixture.target}), true);
  assert.equal(fixture.scope.__mouse633Input, undefined, 'The passive input listeners are removed');
});
test('native account input rejects untrusted or wrong targets after one post and never retries a swallowed product presentation failure', async () => {
  for (const options of [{trusted: false}, {matches: false}]) {
    const fixture = nativeSelectionFixture(options);
    await assert.rejects(smoke.selectNativeDesktop(fixture.args), /unchanged native input budget/);
    assert.equal(fixture.posts(), 1); assert.equal(fixture.report.nativeInputs.length, 1);
    assert.equal(fixture.scope.__mouse633Input, undefined);
  }
  const failed = nativeSelectionFixture({failed: true});
  await assert.rejects(smoke.selectNativeDesktop(failed.args), /actual unchanged presentation deadline failed/);
  assert.equal(failed.posts(), 2); assert.equal(failed.report.after.desktopId, 'desk-2');
  assert.equal(failed.report.after.transition.phase, 'failed'); assert.equal(failed.scope.__mouse633Input, undefined);
});
test('read-only AppKit presentation probe is restricted to exact account CI and does not reuse mutating native state', () => {
  const vm = require('node:vm'), code = fs.readFileSync(path.join(__dirname, 'mouse-native-menu.mm'), 'utf8');
  const guard = code.match(/static bool nativePresentationProbeAllowed\(\)\{([\s\S]*?)\n\}/)[1];
  const expression = guard.match(/return ([\s\S]*?);/)[1].replace('std::strcmp(ci,"true")==0', 'ci==="true"')
    .replace(/\[NSProcessInfo\.processInfo\.arguments containsObject:@"([^"]+)"\]/g, (_, flag) => 'args.includes(' + JSON.stringify(flag) + ')');
  const allowed = vm.runInNewContext('(ci,profile,args)=>!!(' + expression + ')');
  assert.equal(allowed('true', '/owned/profile', [smoke.constants.FLAG]), true);
  for (const ci of [null, '', 'false', 'TRUE', '1']) assert.equal(allowed(ci, '/owned/profile', [smoke.constants.FLAG]), false);
  for (const profile of [null, '', 'relative', 'C:\\profile']) assert.equal(allowed('true', profile, [smoke.constants.FLAG]), false);
  for (const args of [[], ['--mouse-645-smoke'], ['--mouse-645-account-smoke-extra'], ['--mouse-645-account-smoke=1']]) assert.equal(allowed('true', '/owned/profile', args), false);
  const body = code.match(/static napi_value testWindowPresentation\([^\n]+\{([\s\S]*?)\n\}/)[1];
  assert.match(body, /!nativePresentationProbeAllowed\(\)\|\|!NSThread.isMainThread/);
  assert.match(body, /NSWindowOcclusionStateVisible/);
  assert.doesNotMatch(body, /\b(?:state|suppressTitleChrome|setNeedsDisplay|setFrame|setHidden|makeKeyAndOrderFront)\s*\(/);
  const traversal = code.match(/static void presentationViews\([^\n]+\{([\s\S]*?)\n\}/)[1];
  assert.match(traversal, /depth>6\|\|count>=64/);
  assert.doesNotMatch(traversal, /\b(?:setNeedsDisplay|setFrame|setHidden|setAlphaValue)\b/);
});
test('failure capture uses one bounded OS acquisition only for failed writer stages and never writes after a late timeout', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mouse645-failure-capture-unit-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  for (const index of [2, 4, 5, 6, 7, 8, 9, 10, 11, 12]) assert.equal(await smoke.captureWriterFailure({failed: true, index}), null);
  for (const index of [0, 1, 3]) assert.equal(await smoke.captureWriterFailure({failed: false, index}), null);
  let captures = 0, late;
  t.mock.timers.enable({apis: ['setTimeout']});
  const promise = smoke.captureWriterFailure({failed: true, index: 0, output: directory,
    win: {getBounds: () => ({x: 0, y: 0, width: 1, height: 1}), getContentBounds: () => ({x: 0, y: 0, width: 1, height: 1})},
    screen: {getDisplayMatching: () => ({id: 1, bounds: {x: 0, y: 0, width: 1, height: 1}, scaleFactor: 1})},
    globalCapture: {acquire() { captures++; return new Promise(resolve => { late = resolve; }); }}});
  const rejected = assert.rejects(promise, /failure OS display \(4500 ms\)/);
  t.mock.timers.tick(4500); await rejected;
  late({kind: 'screen', backend: 'late diagnostic fixture', base: 'unused'}); await Promise.resolve();
  assert.equal(captures, 1); assert.deepEqual(fs.readdirSync(directory), []);
});

test('account acceptance checks a complete synthetic envelope only as a verifier contract, not native execution', () => {
  const fixture = envelope(), value = S.verify(fixture.read);
  assert.equal(value.status, 'PASS'); assert.equal(value.physicalUserDeviceVerified, false);
  assert.equal(value.logicalDevices, 2); assert.equal(value.installedProcesses, 14);
});
test('independent account reader rejects invented native clicks, stale selected IDs, missing real RAF2 and presentation after the unchanged deadline', () => {
  const edits = [
    value => { delete value.desktopSelection; },
    value => { value.desktopSelection.nativeInputs[1].events[0].trusted = false; },
    value => { value.desktopSelection.nativeInputs[1].events[0].matches = false; },
    value => { value.desktopSelection.nativeInputs[1].source = 'DOM click'; },
    value => { value.desktopSelection.nativeInputs[1].posted = false; },
    value => { value.desktopSelection.nativeInputs[1].selector = '#wrong-target'; },
    value => { value.desktopSelection.nativeInputs.push(value.desktopSelection.nativeInputs[1]); },
    value => { value.desktopSelection.after.nativeDesktopId = 'wrong-desktop'; },
    value => { value.desktopSelection.after.trayOpen = true; },
    value => { value.desktopSelection.after.transition.phase = 'failed'; },
    value => { value.desktopSelection.after.transition.presented = false; },
    value => { value.desktopSelection.after.transition.strategy = 'nora-snapshot'; },
    value => { value.desktopSelection.before.transition = {...value.desktopSelection.after.transition}; },
    value => { value.desktopSelection.after.trace.pop(); },
    value => { const state = value.desktopSelection.after; state.trace[1].at = state.transition.layoutAt + 1501;
      state.trace[1].frameTime = state.trace[1].at - 1; state.transition.totalDurationMs = 2000; }
  ];
  for (const edit of edits) { const fixture = envelope(); fixture.edit(smoke.reportName(0), edit); assert.throws(() => S.verify(fixture.read)); }
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
