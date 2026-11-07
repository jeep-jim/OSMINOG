'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '..', 'collector.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
function fixture(initial = {text: 'old clipboard'}) {
  let clipboard = initial, paste, interval, readCount = 0, gate, failId = null, active = 0, peak = 0;
  const messages = [], stored = new Map(), attempts = [], digests = [], notifications = [], runtimeListeners = [];
  const sink = {addEventListener(type, fn) { assert.equal(type, 'paste'); paste = fn; }, focus() {}, replaceChildren() {}};
  const context = vm.createContext({console, Blob, Uint8Array, DataView, Promise, Object, Array, String, Number, Date, performance,
    setTimeout, clearTimeout, queueMicrotask, setInterval(fn) { interval = fn; return 1; }, clearInterval() { interval = null; },
    crypto: {randomUUID: () => webcrypto.randomUUID(), subtle: {digest: async (kind, bytes) => { digests.push(bytes.byteLength); return webcrypto.subtle.digest(kind, bytes); }}},
    document: {querySelector: () => sink, execCommand(command) {
      assert.equal(command, 'paste'); readCount++;
      const data = clipboard;
      paste({preventDefault() {}, clipboardData: {files: data?.files || [], items: data?.items || [], getData: () => data?.text || ''}}); return true;
    }},
    chrome: {runtime: {id: 'fixture', getURL: value => 'chrome-extension://fixture/' + value,
      onMessage: {addListener(fn) { runtimeListeners.push(fn); }}, sendMessage: async message => {
        assert.equal(Object.hasOwn(message, 'blob'), false); assert.equal(Object.hasOwn(message, 'value'), false);
        assert.equal(Object.hasOwn(message, 'text'), false); messages.push(message);
        if (message.type === 'OSMINOG_COLLECTOR_STATUS') return {enabled: true, projectId: 'desk', folderId: null};
        if (message.type === 'OSMINOG_COLLECTOR_COMMITTED') {
          assert(stored.has(message.id), 'notification must follow durable queue commit'); notifications.push(message.id);
        }
        return {ok: true};
      }}},
    OSMINOGCaptureStore: {put: async input => {
      active++; peak = Math.max(peak, active); attempts.push(input.id);
      try {
        if (gate) { gate.entered.resolve(); await gate.promise; }
        if (failId && input.id.endsWith(failId)) { failId = null; throw Error('Transient storage failure'); }
        let entry = stored.get(input.id);
        if (!entry) { entry = {...input}; stored.set(input.id, entry); }
        return {ok: true, entry};
      } finally { active--; }
    }}
  });
  vm.runInContext(source, context, {filename: 'collector.js'});
  return {context, messages, stored, attempts, digests, notifications,
    setClipboard(value) { clipboard = value; }, poll: () => interval?.(), reads: () => readCount, peak: () => peak,
    hold() { gate = deferred(); gate.entered = deferred(); return gate; }, release() { gate.resolve(); gate = null; }, failFile(suffix) { failId = suffix; },
    async idle() { const deadline = Date.now() + 3000; do { await new Promise(resolve => setTimeout(resolve, 1)); if (vm.runInContext('!busy && ready', context)) return; } while (Date.now() < deadline); throw Error('Collector did not settle'); },
    configure(config) { for (const listener of runtimeListeners) listener({type: 'OSMINOG_COLLECTOR_CONFIG', config}, {id: 'fixture'}); },
    ignore(kind, hash) { for (const listener of runtimeListeners) listener({type: 'OSMINOG_COLLECTOR_IGNORED', kind, hash}, {id: 'fixture'}); }
  };
}
function file(bytes, name, mime = 'image/png') { const blob = new Blob([bytes], {type: mime}); blob.name = name; return blob; }

test('clipboard files are sequential and exact; unchanged media never gets a whole-file hash or a payload message', async () => {
  const f = fixture(); await f.idle(); assert.equal(f.stored.size, 0);
  const bytes = Uint8Array.from({length: 200000}, (_, i) => i % 256);
  f.setClipboard({files: [file(bytes, 'first.png'), file([1, 2, 3], 'second.bin', 'application/octet-stream'), file([], 'empty.txt', 'text/plain')]});
  const held = f.hold(); f.poll(); await held.entered.promise; f.poll(); f.poll(); assert.equal(f.peak(), 1);
  f.release(); await f.idle();
  assert.equal(f.stored.size, 3); assert.equal(f.peak(), 1); assert.equal(f.notifications.length, 3);
  assert.deepEqual([...f.stored.values()].map(value => value.fileName), ['first.png', 'second.bin', 'empty.txt']);
  assert.deepEqual([...f.stored.values()].map(value => value.kind), ['image', 'file', 'file']);
  assert.deepEqual(new Uint8Array(await [...f.stored.values()][0].blob.arrayBuffer()), bytes);
  const hashCount = f.digests.length;
  f.poll(); await f.idle(); assert.equal(f.digests.length, hashCount); assert.equal(f.stored.size, 3);
  const changed = bytes.slice(); changed[100000] ^= 1;
  f.setClipboard({files: [file(changed, 'first.png'), file([1, 2, 3], 'second.bin', 'application/octet-stream'), file([], 'empty.txt', 'text/plain')]});
  f.poll(); await f.idle(); assert.equal(f.stored.size, 6, 'equal-sized middle-byte change is detected and every file is retained');
});
test('a partially committed batch retries stable IDs before processing the next clipboard value', async () => {
  const f = fixture(null); await f.idle();
  f.setClipboard({files: [file([11], 'one.png'), file([22], 'two.png'), file([33], 'three.png')]});
  f.failFile('-1'); f.poll(); await f.idle(); assert.equal(f.stored.size, 1);
  f.setClipboard({text: 'the next copy'}); f.poll(); await f.idle();
  assert.equal(f.stored.size, 4); assert.equal(f.notifications.length, 4);
  assert.equal([...f.stored.values()].filter(value => value.fileName === 'one.png').length, 1);
  assert.equal([...f.stored.values()].at(-1).value, 'the next copy');
  assert(f.messages.some(message => message.error === 'Transient storage failure'));
  assert.equal(f.messages.at(-1).error, '');
});
test('pause during a pending retry finishes only the already read batch and performs no new clipboard read', async () => {
  const f = fixture(null); await f.idle();
  f.setClipboard({files: [file([1], 'one.png'), file([2], 'two.png'), file([3], 'three.png')]});
  f.failFile('-1'); f.poll(); await f.idle(); assert.equal(f.stored.size, 1);
  const held = f.hold(); f.poll(); await held.entered.promise;
  const before = f.reads(); f.configure({enabled: false, projectId: 'desk'}); f.setClipboard({text: 'must not be read while paused'});
  f.release(); await f.idle(); assert.equal(f.stored.size, 3); assert.equal(f.reads(), before);
  f.poll(); await settle(); assert.equal(f.reads(), before);
  f.configure({enabled: true, projectId: 'desk'}); await f.idle(); assert.equal(f.stored.size, 3, 'reenabling establishes a fresh baseline');
  f.setClipboard({text: 'copied after enabling'}); f.poll(); await f.idle(); assert.equal(f.stored.size, 4);
});
test('empty clipboard releases the previous Blob and copying it again counts as a new capture', async () => {
  const f = fixture(null); await f.idle();
  f.setClipboard({files: [file([4, 5, 6], 'again.png')]}); f.poll(); await f.idle(); assert.equal(f.stored.size, 1);
  f.setClipboard(null); f.poll(); await f.idle(); assert.equal(vm.runInContext('last', f.context), null);
  f.setClipboard({files: [file([4, 5, 6], 'again.png')]}); f.poll(); await f.idle(); assert.equal(f.stored.size, 2);
});
test('manual paste acknowledgement suppresses one matching automatic capture without suppressing later copies', async () => {
  const f = fixture(null); await f.idle();
  const value = 'already pasted manually', hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', Buffer.from(value))).toString('hex');
  f.ignore('text', hash); f.setClipboard({text: value}); f.poll(); await f.idle(); assert.equal(f.stored.size, 0);
  f.setClipboard({text: 'next value'}); f.poll(); await f.idle(); assert.equal(f.stored.size, 1);
  f.setClipboard({text: value}); f.poll(); await f.idle(); assert.equal(f.stored.size, 2);
});
