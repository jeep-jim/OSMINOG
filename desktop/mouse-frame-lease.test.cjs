'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createFrameLease, MAX_LEASE_MS} = require('./mouse-frame-lease.cjs');

class Clock {
  constructor() { this.time = 100; this.serial = 0; this.jobs = new Map(); this.callbacks = new Map(); }
  now = () => this.time;
  setTimeout = (fn, ms) => { const id = ++this.serial; this.jobs.set(id, {fn, at: this.time + ms}); this.callbacks.set(id, fn); return id; };
  clearTimeout = id => this.jobs.delete(id);
  jump(ms) { this.time += ms; }
  tick(ms) {
    this.time += ms;
    for (const [id, job] of [...this.jobs]) if (job.at <= this.time) { this.jobs.delete(id); job.fn(); }
  }
}
function fixture(options = {}) {
  const state = {visible: true, focused: true, minimized: false, locked: false, closing: false,
    windowDestroyed: false, contentsDestroyed: false, throttling: options.previous ?? true};
  const win = new EventEmitter(), contents = new EventEmitter(), clock = new Clock(), calls = [], traces = [];
  contents.mainFrame = {processId: 7, routingId: 11, url: 'file:///mouse/index.html'};
  contents.isDestroyed = () => state.contentsDestroyed;
  contents.getBackgroundThrottling = () => { if (options.getter) return options.getter(state); return state.throttling; };
  contents.setBackgroundThrottling = value => {
    calls.push(['set', value]);
    if (options.setter) options.setter(value, state, win, contents);
    else state.throttling = value;
  };
  contents.invalidate = () => { calls.push(['invalidate']); options.invalidateCall?.(state, win); };
  Object.assign(win, {webContents: contents, isDestroyed: () => state.windowDestroyed,
    isVisible: () => state.visible, isFocused: () => state.focused, isMinimized: () => state.minimized});
  let serial = 0;
  const config = {win, authorize: () => true, isLocked: () => state.locked, isClosing: () => state.closing,
    platform: 'darwin', clock, tokenFactory: () => Buffer.alloc(32, ++serial).toString('base64url'),
    onTrace: value => { traces.push(value); options.trace?.(value); }, ...options.config};
  const lease = createFrameLease(config);
  const event = () => ({sender: contents, senderFrame: {...contents.mainFrame}});
  return {state, win, contents, clock, calls, traces, lease, event, config,
    begin: () => lease.handle(event(), 'begin'), end: token => lease.handle(event(), 'end', token)};
}

test('one foreground begin toggles only the owned shell, then real-frame end restores the exact prior value', () => {
  const f = fixture(), begin = f.begin();
  assert.deepEqual(Object.keys(begin), ['active', 'token', 'remainingMs']);
  assert.equal(begin.active, true); assert.equal(begin.token.length, 43); assert.equal(begin.remainingMs, 1500);
  assert.equal(f.state.throttling, false); assert.deepEqual(f.calls, [['set', false], ['invalidate']]);
  assert.deepEqual(f.end(begin.token), {released: true});
  assert.equal(f.state.throttling, true); assert.equal(f.clock.jobs.size, 0);
  assert.deepEqual(f.calls, [['set', false], ['invalidate'], ['set', true]]);
  assert.deepEqual(f.end(begin.token), {released: false});
  assert.equal(f.lease.inspect().restoreAttempts, 1); f.lease.destroy();
});

test('duplicate begins share the exact token and deadline without extra setters, invalidation or watchdog', () => {
  const f = fixture(), first = f.begin(); f.clock.tick(600);
  const second = f.begin();
  assert.equal(second.token, first.token); assert.equal(second.remainingMs, 900);
  assert.equal(f.clock.serial, 1); assert.equal(f.clock.jobs.size, 1);
  assert.deepEqual(f.calls, [['set', false], ['invalidate']]);
  f.clock.tick(899); assert.equal(f.state.throttling, false);
  f.clock.tick(1); assert.equal(f.state.throttling, true); assert.equal(f.lease.inspect().active, false);
  f.lease.destroy();
});

test('old watchdog callbacks and stale renderer end cannot revoke a newer lease', () => {
  const f = fixture(), old = f.begin(), oldTimer = f.clock.callbacks.get(1);
  f.end(old.token); const current = f.begin(); assert.notEqual(old.token, current.token);
  oldTimer(); assert.equal(f.state.throttling, false); assert.equal(f.lease.inspect().active, true);
  assert.deepEqual(f.end(old.token), {released: false}); assert.equal(f.lease.inspect().active, true);
  assert.deepEqual(f.end(current.token), {released: true}); f.lease.destroy();
});

test('a delayed begin response is safe after expiry and cannot end a later generation', () => {
  const f = fixture(), delayed = f.begin(); f.clock.tick(1500);
  const current = f.begin();
  assert.deepEqual(f.end(delayed.token), {released: false}); assert.equal(f.state.throttling, false);
  assert.equal(f.lease.inspect().active, true); f.end(current.token); f.lease.destroy();
});

test('begin notices expiry even when the main watchdog callback has not yet run', () => {
  const f = fixture(), old = f.begin(); f.clock.jump(1600);
  const current = f.begin();
  assert.notEqual(current.token, old.token); assert.equal(current.remainingMs, 1500);
  assert.equal(f.clock.jobs.size, 1);
  assert.deepEqual(f.calls, [['set', false], ['invalidate'], ['set', true], ['set', false], ['invalidate']]);
  f.clock.callbacks.get(1)(); assert.equal(f.lease.inspect().active, true); f.lease.destroy();
});

test('a pre-existing false throttling value remains false on end and on deadline', () => {
  for (const deadline of [false, true]) {
    const f = fixture({previous: false}), begin = f.begin();
    if (deadline) f.clock.tick(1500); else f.end(begin.token);
    assert.equal(f.state.throttling, false);
    assert.deepEqual(f.calls, [['set', false], ['invalidate'], ['set', false]]); f.lease.destroy();
  }
});

test('current foreground, profile and shutdown guards are checked before starting or reusing', () => {
  for (const [key, value] of [['visible', false], ['focused', false], ['minimized', true], ['locked', true],
    ['closing', true], ['windowDestroyed', true], ['contentsDestroyed', true]]) {
    const f = fixture(); f.state[key] = value;
    assert.deepEqual(f.begin(), {active: false, token: null, remainingMs: 0}, key);
    assert.equal(f.calls.length, 0); assert.equal(f.clock.jobs.size, 0); f.lease.destroy();
  }
  for (const key of ['locked', 'closing']) {
    const f = fixture(); f.begin(); f.state[key] = true;
    assert.equal(f.begin().active, false); assert.equal(f.state.throttling, true); f.lease.destroy();
  }
  for (const platform of ['win32', 'linux']) { const f = fixture({config: {platform}}); assert.equal(f.begin().active, false); assert.equal(f.calls.length, 0); f.lease.destroy(); }
});

test('authorization and main-frame ownership are synchronous and required for every action', () => {
  for (const authorize of [() => false, () => undefined, () => Promise.resolve(true)]) {
    const f = fixture({config: {authorize}}); assert.throws(f.begin, {code: 'FRAME_LEASE_UNTRUSTED'});
    assert.equal(f.calls.length, 0); f.lease.destroy();
  }
  const f = fixture(), current = f.begin();
  for (const event of [{...f.event(), sender: {}}, {...f.event(), senderFrame: {...f.contents.mainFrame, routingId: 12}},
    {...f.event(), senderFrame: {...f.contents.mainFrame, url: 'https://foreign.invalid/'}}]) {
    assert.throws(() => f.lease.handle(event, 'end', current.token), {code: 'FRAME_LEASE_UNTRUSTED'});
  }
  assert.equal(f.lease.inspect().active, true); f.lease.destroy();
});

test('Promise guards cannot accidentally allow a lease', () => {
  for (const field of ['isLocked', 'isClosing']) {
    const f = fixture({config: {[field]: () => Promise.resolve(false)}});
    assert.equal(f.begin().active, false); assert.equal(f.calls.length, 0); f.lease.destroy();
  }
});

test('strict action shape and token validation leave the current lease untouched', () => {
  const f = fixture(), current = f.begin();
  for (const args of [[], [null], [{}], ['noop'], ['begin', null], ['begin', 'x'], ['begin', undefined], ['begin', undefined, 'extra'],
    ['end'], ['end', null], ['end', {}], ['end', 'x'], ['end', current.token + '\n'], ['end', current.token, 'extra']]) {
    assert.throws(() => f.lease.handle(f.event(), ...args), {code: 'FRAME_LEASE_INVALID_REQUEST'});
    assert.equal(f.lease.inspect().active, true);
  }
  assert.deepEqual(f.end('Z'.repeat(43)), {released: false}); f.lease.destroy();
});

test('all invalidating lifecycle events restore once and stale follow-up notifications are harmless', () => {
  for (const name of ['hide', 'minimize', 'blur', 'close', 'closed', 'will-navigate', 'did-start-navigation', 'render-process-gone']) {
    const f = fixture(), current = f.begin(), emitter = ['will-navigate', 'did-start-navigation', 'render-process-gone'].includes(name) ? f.contents : f.win;
    emitter.emit(name); f.win.emit('blur'); f.end(current.token);
    assert.equal(f.state.throttling, true, name); assert.equal(f.clock.jobs.size, 0, name);
    assert.equal(f.lease.inspect().restoreAttempts, 1, name); f.lease.destroy();
  }
});

test('destroyed WebContents and window never receive a restore setter', () => {
  for (const target of ['contents', 'window']) {
    const f = fixture(); f.begin();
    if (target === 'contents') { f.state.contentsDestroyed = true; f.contents.emit('destroyed'); }
    else { f.state.windowDestroyed = true; f.win.emit('closed'); }
    assert.deepEqual(f.calls, [['set', false], ['invalidate']]); assert.equal(f.clock.jobs.size, 0);
    assert.equal(f.lease.inspect().disposed, true); f.lease.destroy();
  }
});

test('navigation retires the old document and duplicate begin never reuses a different main frame', () => {
  for (const notify of [false, true]) {
    const f = fixture(), old = f.begin();
    if (notify) f.contents.emit('did-start-navigation');
    f.contents.mainFrame = {...f.contents.mainFrame, routingId: 33};
    const current = f.begin(); assert.notEqual(current.token, old.token);
    assert.deepEqual(f.end(old.token), {released: false}); assert.equal(f.state.throttling, false); f.lease.destroy();
  }
});

test('getter failure leaves no timer or setter; partial setter failure restores the previous flag', () => {
  const a = fixture({getter: () => { throw Error('getter'); }});
  assert.throws(a.begin, {code: 'FRAME_LEASE_BEGIN_FAILED'}); assert.equal(a.calls.length, 0); assert.equal(a.clock.jobs.size, 0); a.lease.destroy();
  let first = true;
  const b = fixture({setter: (value, state) => { state.throttling = value; if (first) { first = false; throw Error('partial setter'); } }});
  assert.throws(b.begin, {code: 'FRAME_LEASE_BEGIN_FAILED'});
  assert.deepEqual(b.calls, [['set', false], ['set', true]]); assert.equal(b.state.throttling, true);
  assert.equal(b.clock.jobs.size, 0); assert.equal(b.lease.inspect().active, false); b.lease.destroy();
});

test('invalidate exception rolls back the scheduling change and cancels the watchdog', () => {
  const f = fixture({invalidateCall: () => { throw Error('invalidate'); }});
  assert.throws(f.begin, {code: 'FRAME_LEASE_BEGIN_FAILED'});
  assert.equal(f.state.throttling, true); assert.equal(f.clock.jobs.size, 0);
  assert.deepEqual(f.calls, [['set', false], ['invalidate'], ['set', true]]); f.lease.destroy();
});

test('reentrant blur during begin never returns an active token or invalidates a background window', () => {
  const f = fixture({setter: (value, state, win) => { state.throttling = value; if (!value) { state.focused = false; win.emit('blur'); } }});
  assert.equal(f.begin().active, false); assert.equal(f.state.throttling, true);
  assert.deepEqual(f.calls, [['set', false], ['set', true]]); assert.equal(f.clock.jobs.size, 0); f.lease.destroy();
});

test('early transient restoration failure retains the original obligation and retries only at its unchanged deadline', () => {
  let attempts = 0;
  const f = fixture({setter: (value, state) => { if (value && ++attempts === 1) throw Error('transient'); state.throttling = value; }}), current = f.begin();
  const originalTimer = [...f.clock.jobs][0], originalDeadline = originalTimer[1].at;
  f.clock.tick(600);
  assert.deepEqual(f.end(current.token), {released: false});
  assert.equal(f.lease.state().phase, 'restore-pending'); assert.equal(f.lease.state().active, true);
  assert.equal(f.state.throttling, false); assert.equal(f.lease.state().remainingMs, 900);
  assert.equal(f.clock.jobs.get(originalTimer[0]).at, originalDeadline);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(f.end(current.token), {released: false}); assert.equal(f.begin().active, false);
    assert.equal(f.lease.revoke(), false); f.win.emit('hide'); f.win.emit('blur');
  }
  assert.equal(attempts, 1); assert.equal(f.clock.serial, 1); assert.equal(f.clock.jobs.size, 1);
  f.clock.tick(899); assert.equal(attempts, 1); assert.equal(f.state.throttling, false);
  f.clock.tick(1);
  assert.equal(attempts, 2); assert.equal(f.state.throttling, true); assert.equal(f.clock.jobs.size, 0);
  assert.equal(f.lease.state().active, false); assert.equal(f.lease.state().blocked, false);
  assert.equal(f.lease.state().restoreFailures, 1); assert.equal(f.lease.state().restored, 1);
  assert.equal(f.lease.state().lastReleaseReason, 'deadline'); f.lease.destroy();
});

test('permanent restore failure becomes a truthful blocked terminal obligation without further timers or leases', () => {
  const f = fixture({setter: (value, state) => { if (value) throw Error('permanent'); state.throttling = value; }}), current = f.begin();
  f.clock.tick(500); assert.deepEqual(f.end(current.token), {released: false}); f.clock.tick(1000);
  assert.equal(f.lease.state().active, true); assert.equal(f.lease.state().phase, 'restore-failed');
  assert.equal(f.lease.state().blocked, true); assert.equal(f.lease.state().remainingMs, 0);
  assert.equal(f.lease.state().priorAllowed, true); assert.equal(f.lease.state().releases, 0);
  assert.equal(f.lease.state().restoreAttempts, 2); assert.equal(f.lease.state().restoreFailures, 2);
  assert.equal(f.lease.state().restored, 0); assert.equal(f.state.throttling, false);
  const calls = f.calls.length;
  for (let i = 0; i < 3; i++) { assert.equal(f.begin().active, false); assert.equal(f.end(current.token).released, false); f.win.emit('blur'); f.clock.tick(10000); }
  assert.equal(f.calls.length, calls); assert.equal(f.clock.serial, 1); assert.equal(f.clock.jobs.size, 0);
  f.lease.destroy(); assert.equal(f.lease.state().active, true);
  f.state.contentsDestroyed = true; f.contents.emit('destroyed');
  assert.equal(f.lease.state().active, false); assert.equal(f.lease.state().lastReleaseReason, 'owner-destroyed');
  assert.equal(f.lease.state().blocked, true); assert.equal(f.calls.length, calls);
  assert.deepEqual(f.win.eventNames(), []); assert.deepEqual(f.contents.eventNames(), []);
});

test('first restore error at the original watchdog is terminal immediately, without a second timer', () => {
  const f = fixture({setter: (value, state) => { if (value) throw Error('deadline'); state.throttling = value; }});
  f.begin(); f.clock.tick(1500);
  assert.equal(f.lease.state().phase, 'restore-failed'); assert.equal(f.lease.state().restoreAttempts, 1);
  assert.equal(f.lease.state().blocked, true); assert.equal(f.clock.serial, 1); assert.equal(f.clock.jobs.size, 0);
  assert.equal(f.begin().active, false); assert.equal(f.clock.serial, 1);
  f.state.contentsDestroyed = true; f.contents.emit('destroyed');
});

test('destroy on a live pending obligation retains only destruction listeners and the original watchdog until successful restore', () => {
  let attempts = 0;
  const f = fixture({setter: (value, state) => { if (value && ++attempts === 1) throw Error('transient'); state.throttling = value; }});
  const sentinel = () => {}; f.win.on('hide', sentinel);
  const current = f.begin(); f.clock.tick(500); f.end(current.token); f.lease.destroy(); f.lease.destroy();
  assert.equal(f.lease.state().disposed, true); assert.equal(f.lease.state().active, true);
  assert.equal(attempts, 1); assert.equal(f.clock.jobs.size, 1); assert.equal(f.clock.serial, 1);
  assert.deepEqual(f.win.listeners('hide'), [sentinel]);
  assert.equal(f.win.listenerCount('closed'), 1); assert.equal(f.contents.listenerCount('destroyed'), 1);
  for (const name of ['blur', 'minimize', 'close']) assert.equal(f.win.listenerCount(name), 0);
  for (const name of ['will-navigate', 'did-start-navigation', 'render-process-gone']) assert.equal(f.contents.listenerCount(name), 0);
  f.clock.tick(1000);
  assert.equal(f.state.throttling, true); assert.equal(f.lease.state().active, false); assert.equal(attempts, 2);
  assert.equal(f.clock.jobs.size, 0); assert.equal(f.win.listenerCount('closed'), 0); assert.equal(f.contents.listenerCount('destroyed'), 0);
  assert.deepEqual(f.win.listeners('hide'), [sentinel]); assert.equal(f.begin().active, false);
});

test('synchronous blur or destruction during restore cannot retry a setter or revive a settled obligation', () => {
  for (const destructive of [false, true]) {
    const f = fixture({setter: (value, state, win, contents) => {
      if (!value) { state.throttling = value; return; }
      if (destructive) { state.contentsDestroyed = true; contents.emit('destroyed'); throw Error('already destroyed'); }
      state.throttling = value; win.emit('blur');
    }}), current = f.begin();
    assert.equal(f.end(current.token).released, true); assert.equal(f.lease.state().active, false);
    assert.equal(f.lease.state().restoreAttempts, 1); assert.equal(f.lease.state().restoreFailures, 0);
    assert.equal(f.clock.jobs.size, 0); assert.equal(f.lease.state().phase, 'idle'); f.lease.destroy();
  }
});

test('destroy removes only owned listeners, is idempotent, and prevents later begins', () => {
  const f = fixture(), sentinel = () => {};
  f.win.on('hide', sentinel); f.contents.on('destroyed', sentinel); f.begin();
  f.lease.destroy(); f.lease.destroy();
  assert.deepEqual(f.win.listeners('hide'), [sentinel]); assert.deepEqual(f.contents.listeners('destroyed'), [sentinel]);
  for (const name of ['minimize', 'blur', 'close', 'closed']) assert.equal(f.win.listenerCount(name), 0);
  for (const name of ['will-navigate', 'did-start-navigation', 'render-process-gone']) assert.equal(f.contents.listenerCount(name), 0);
  assert.equal(f.begin().active, false); assert.equal(f.clock.jobs.size, 0); assert.equal(f.lease.inspect().restoreAttempts, 1);
});

test('native revoke and shorter leases work, duration above 1500 is rejected, optional redraw stays optional', () => {
  const f = fixture({config: {durationMs: 100, invalidate: false}}); f.begin();
  assert.deepEqual(f.calls, [['set', false]]); assert.equal(f.lease.revoke(), true); assert.equal(f.lease.revoke(), false);
  for (const durationMs of [0, -1, 1501, Infinity, '1500']) assert.throws(() => createFrameLease({...f.config, durationMs}), TypeError);
  assert.equal(MAX_LEASE_MS, 1500); f.lease.destroy();
});

test('diagnostic callback exceptions never interfere with start or cleanup', () => {
  const f = fixture({trace: () => { throw Error('diagnostic'); }}), current = f.begin();
  assert.equal(current.active, true); assert.equal(f.end(current.token).released, true);
  assert.equal(f.state.throttling, true); assert.equal(f.clock.jobs.size, 0); f.lease.destroy();
});

test('native diagnostics report restoration without tokens, mutation, scheduling, or shared mutable objects', () => {
  const f = fixture(), begin = f.begin(); f.clock.tick(125);
  const calls = f.calls.length, timers = f.clock.serial;
  const a = f.lease.state(), b = f.lease.state();
  assert.deepEqual(a, b); assert.equal(a.active, true); assert.equal(a.remainingMs, 1375);
  assert.equal(a.priorAllowed, true); assert.equal(Object.hasOwn(a, 'token'), false);
  a.begins = 500; assert.equal(f.lease.state().begins, 1);
  assert.equal(f.calls.length, calls); assert.equal(f.clock.serial, timers);
  f.end(begin.token);
  assert.deepEqual(f.lease.state(), {disposed: false, blocked: false, active: false, phase: 'idle', remainingMs: 0, priorAllowed: true,
    lastReleaseReason: 'renderer-end', begins: 1, duplicates: 0, releases: 1, restored: 1, restoreAttempts: 1, restoreFailures: 0});
  f.lease.destroy();
});
