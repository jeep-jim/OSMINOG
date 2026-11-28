'use strict';
// Native main-process owner for a short foreground frame-scheduling lease.
// No token, timer or successful begin is evidence of a presented renderer frame.
const {randomBytes} = require('node:crypto');
const {performance} = require('node:perf_hooks');
const MAX_LEASE_MS = 1500;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function failure(code, message, cause) {
  const error = new Error(message, cause ? {cause} : undefined);
  error.code = code;
  return error;
}

function createFrameLease({win, authorize, isLocked = () => false, isClosing = () => false,
  platform = process.platform, durationMs = MAX_LEASE_MS, invalidate = true,
  tokenFactory = () => randomBytes(32).toString('base64url'), onTrace = () => {},
  clock = {now: () => performance.now(), setTimeout, clearTimeout}} = {}) {
  if (!win || !win.webContents || typeof authorize !== 'function'
      || typeof isLocked !== 'function' || typeof isClosing !== 'function'
      || !Number.isInteger(durationMs) || durationMs < 1 || durationMs > MAX_LEASE_MS
      || typeof invalidate !== 'boolean' || typeof tokenFactory !== 'function'
      || typeof onTrace !== 'function' || !clock
      || !['now', 'setTimeout', 'clearTimeout'].every(key => typeof clock[key] === 'function')) {
    throw new TypeError('Invalid native frame lease configuration');
  }
  const contents = win.webContents, listeners = [];
  let active = null, disposed = false, starting = false, blocked = false, documentEpoch = 0, lastReleaseReason = null, lastPriorAllowed = null;
  const counters = {begins: 0, duplicates: 0, releases: 0, restored: 0, restoreAttempts: 0, restoreFailures: 0};
  function trace(phase, detail = {}) {
    // A diagnostic consumer must never interrupt cleanup or extend a lease.
    try { onTrace({phase, ...detail}); } catch {}
  }
  const empty = () => ({active: false, token: null, remainingMs: 0});
  function liveContents() {
    try { return !win.isDestroyed() && win.webContents === contents && !contents.isDestroyed(); }
    catch { return false; }
  }
  function eligible() {
    try {
      return platform === 'darwin' && !disposed && !blocked && liveContents()
        && isLocked() === false && isClosing() === false
        && win.isVisible() === true && win.isMinimized() === false && win.isFocused() === true;
    } catch { return false; }
  }
  function owner(event) {
    // Use an explicit synchronous predicate; a Promise must never authorize IPC.
    if (authorize(event) !== true || event?.sender !== contents) {
      throw failure('FRAME_LEASE_UNTRUSTED', 'Untrusted frame lease request');
    }
    const frame = event.senderFrame, main = contents.mainFrame;
    if (!frame || !main || !Number.isInteger(frame.processId) || !Number.isInteger(frame.routingId)
        || frame.processId !== main.processId || frame.routingId !== main.routingId
        || typeof frame.url !== 'string' || frame.url !== main.url) {
      throw failure('FRAME_LEASE_UNTRUSTED', 'Frame lease requires the current main frame');
    }
    return {epoch: documentEpoch, processId: frame.processId, routingId: frame.routingId, url: frame.url};
  }
  function sameOwner(a, b) {
    return a.epoch === b.epoch && a.processId === b.processId && a.routingId === b.routingId && a.url === b.url;
  }
  function removeListeners(destructionOnly = false) {
    for (let index = listeners.length - 1; index >= 0; index--) {
      const [emitter, name, handler] = listeners[index];
      if (destructionOnly && (emitter === win && name === 'closed' || emitter === contents && name === 'destroyed')) continue;
      emitter.removeListener(name, handler); listeners.splice(index, 1);
    }
  }
  function clearWatchdog(lease) {
    if (lease.timer === null) return;
    const timer = lease.timer; lease.timer = null;
    try { clock.clearTimeout(timer); } catch { trace('timer-clear-failed'); }
  }
  function complete(reason, lease, restored) {
    if (active !== lease) return false;
    active = null;
    clearWatchdog(lease);
    counters.releases++;
    if (restored) counters.restored++;
    lastReleaseReason = reason;
    lastPriorAllowed = lease.previous;
    if (disposed) removeListeners();
    trace('released', {reason, restored, previous: lease.previous});
    return true;
  }
  function release(reason, lease = active, finalAttempt = false) {
    if (!lease || active !== lease) return false;
    if (!liveContents()) return complete('owner-destroyed', lease, false);
    if (lease.restoring || lease.phase === 'restore-failed') return false;
    if (lease.phase === 'restore-pending' && !finalAttempt) return false;
    if (finalAttempt) {
      if (lease.finalAttempted) return false;
      lease.finalAttempted = true;
      clearWatchdog(lease); // The original deadline is consumed, never extended.
    }
    lease.restoring = true;
    lease.phase = 'restoring';
    counters.restoreAttempts++;
    try {
      contents.setBackgroundThrottling(lease.previous);
      // A synchronous destruction event may already have closed the obligation.
      if (active !== lease) return true;
      return complete(reason, lease, true);
    } catch {
      if (active !== lease) return true;
      if (!liveContents()) return complete('owner-destroyed', lease, false);
      counters.restoreFailures++;
      lease.phase = finalAttempt ? 'restore-failed' : 'restore-pending';
      if (finalAttempt) blocked = true;
      // Early failure keeps the original timer and obligation. At the deadline
      // a permanent failure remains visible and disables new leases, with no
      // unbounded retry timers or false claim that restoration succeeded.
      trace('restore-failed', {reason, terminal: finalAttempt});
      return false;
    } finally { lease.restoring = false; }
  }
  function response(lease) {
    if (active !== lease || !eligible()) {
      if (active === lease) release('foreground-lost', lease);
      return empty();
    }
    const remainingMs = Math.max(0, Math.min(durationMs, lease.deadline - clock.now()));
    if (remainingMs <= 0) { release('deadline', lease, true); return empty(); }
    return {active: true, token: lease.token, remainingMs};
  }
  function begin(requestOwner) {
    if (!eligible() || starting) {
      if (!eligible()) release('foreground-lost');
      return empty();
    }
    if (active && active.phase !== 'active') return empty();
    if (active && (clock.now() >= active.deadline || !sameOwner(active.owner, requestOwner))) {
      const expired = clock.now() >= active.deadline;
      if (!release(expired ? 'deadline' : 'document-changed', active, expired)) return empty();
    }
    if (active) {
      counters.duplicates++;
      return response(active); // Does not call setters or reschedule the watchdog.
    }
    if (typeof contents.getBackgroundThrottling !== 'function'
        || typeof contents.setBackgroundThrottling !== 'function'
        || invalidate && typeof contents.invalidate !== 'function') return empty();
    let previous;
    try { previous = contents.getBackgroundThrottling(); }
    catch (cause) { throw failure('FRAME_LEASE_BEGIN_FAILED', 'Cannot read frame scheduling state', cause); }
    if (typeof previous !== 'boolean') throw failure('FRAME_LEASE_BEGIN_FAILED', 'Invalid frame scheduling state');
    const token = tokenFactory();
    if (typeof token !== 'string' || token.length !== 43 || !TOKEN.test(token)) throw failure('FRAME_LEASE_BEGIN_FAILED', 'Invalid native lease token');
    const lease = {token, owner: requestOwner, previous, deadline: clock.now() + durationMs,
      timer: null, phase: 'active', restoring: false, finalAttempted: false};
    active = lease; starting = true;
    try {
      lease.timer = clock.setTimeout(() => {
        if (active !== lease) return;
        lease.timer = null;
        release('deadline', lease, true);
      }, durationMs);
      lease.timer?.unref?.();
      contents.setBackgroundThrottling(false);
      if (active !== lease || !eligible()) {
        release('foreground-lost', lease);
        return empty();
      }
      if (invalidate) contents.invalidate();
      counters.begins++;
      trace('began', {durationMs, previous});
      return response(lease);
    } catch (cause) {
      release('begin-failed', lease);
      throw failure('FRAME_LEASE_BEGIN_FAILED', 'Cannot begin foreground frame scheduling', cause);
    } finally { starting = false; }
  }
  function handle(event, ...args) {
    const requestOwner = owner(event);
    const [action, token] = args;
    if (typeof action !== 'string' || !['begin', 'end'].includes(action)
        || action === 'begin' && args.length !== 1
        || action === 'end' && (args.length !== 2 || typeof token !== 'string' || token.length !== 43 || !TOKEN.test(token))) {
      throw failure('FRAME_LEASE_INVALID_REQUEST', 'Invalid frame lease action or token');
    }
    if (action === 'begin') return begin(requestOwner);
    return {released: !!active && active.token === token && sameOwner(active.owner, requestOwner)
      && release('renderer-end', active)};
  }
  function listen(emitter, name, handler) {
    emitter.on(name, handler); listeners.push([emitter, name, handler]);
  }
  function destroy() {
    if (disposed) {
      // A live failed restore may have retained only these destruction hooks.
      if (active && !liveContents()) release('disposed');
      return;
    }
    disposed = true;
    release('disposed');
    // A failed restore on a still-live owner must retain the existing watchdog
    // and destruction observation, even if the public capability is disposed.
    removeListeners(!!active);
  }
  for (const name of ['hide', 'minimize', 'blur', 'close']) listen(win, name, () => release(name));
  listen(win, 'closed', destroy);
  for (const name of ['will-navigate', 'did-start-navigation', 'render-process-gone']) {
    // Conservative for this local shell: any navigation ends this document's lease.
    listen(contents, name, () => { documentEpoch++; release(name); });
  }
  listen(contents, 'destroyed', destroy);
  // Read-only native diagnostics. Never expose this capability through preload.
  const state = () => ({disposed, blocked, active: !!active, phase: active?.phase ?? 'idle',
    remainingMs: active ? Math.max(0, Math.min(durationMs, active.deadline - clock.now())) : 0,
    priorAllowed: active?.previous ?? lastPriorAllowed, lastReleaseReason, ...counters});
  return Object.freeze({handle, destroy, revoke: () => release('native-revoke'), state, inspect: state});
}

module.exports = {createFrameLease, MAX_LEASE_MS};
