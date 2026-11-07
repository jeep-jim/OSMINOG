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
function fixture(initial = {text: 'old clipboard'}, options = {}) {
  let clipboard = initial, paste, interval, readCount = 0, gate, failId = null;
  const messages = [], stored = new Map(), blobs = new Map(), attempts = [], digests = [], notifications = [], runtimeListeners = [];
  let active = 0, peak = 0, initCount = 0;
  const sink = {addEventListener(type, fn) { assert.equal(type, 'paste'); paste = fn; }, focus() {}, replaceChildren() {}};
  const context = vm.createContext({console, Blob, Uint8Array, DataView, Promise, Object, Array, String, Number, Date, performance,
    setTimeout, clearTimeout, queueMicrotask, setInterval(fn) { interval = fn; return 1; }, clearInterval() { interval = null; },
    crypto: {randomUUID: () => webcrypto.randomUUID(), subtle: {digest: async (kind, bytes) => { digests.push(bytes.byteLength); return webcrypto.subtle.digest(kind, bytes); }}},
    document: {querySelector: () => sink, execCommand(command) {
      assert.equal(command, 'paste'); readCount++;
      const data = clipboard;
      paste({preventDefault() {}, clipboardData: {files: data?.files || [], items: [], getData: () => data?.text || ''}}); return true;
    }},
    chrome: {runtime: {id: 'fixture', getURL: value => 'chrome-extension://fixture/' + value,
      onMessage: {addListener(fn) { runtimeListeners.push(fn); }}, sendMessage: async message => {
        assert.equal(Object.hasOwn(message, 'blob'), false); assert.equal(Object.hasOwn(message, 'text'), false);
        messages.push(message);
        if (message.type === 'OSMINOG_CORE_MIGRATED') return {ok: true, config: {enabled: true, projectId: 'desk', folderId: null}};
        if (message.type === 'OSMINOG_CORE_CAPTURE_COMMITTED') {
          assert(stored.has(message.id), 'notification must follow durable commit'); notifications.push(message.id);
        }
        return {ok: true};
      }}},
    OSMINOGCoreStore: {
      init: async initOptions => {
        initCount++;
        if (options.initialize) await options.initialize(initOptions, initCount);
        return {status: 'done'};
      }, getBlob: async id => blobs.get(id),
      capture: async input => {
        active++; peak = Math.max(peak, active); attempts.push(input.captureId);
        try {
          if (gate) { gate.entered.resolve(); await gate.promise; }
          if (failId && input.captureId.endsWith(failId)) { failId = null; throw Error('Transient storage failure'); }
          let item = stored.get(input.id);
          if (!item) { item = {...input, assetId: input.blobId}; stored.set(input.id, item); if (input.blob) blobs.set(item.assetId, input.blob); }
          return {ok: true, item};
        } finally { active--; }
      }
    }
  });
  vm.runInContext(source, context, {filename: 'collector.js'});
  return {context, messages, stored, blobs, attempts, digests, notifications,
    setClipboard(value) { clipboard = value; }, poll: () => interval?.(), reads: () => readCount, peak: () => peak, initCount: () => initCount,
    hold() { gate = deferred(); gate.entered = deferred(); return gate; }, release() { gate.resolve(); gate = null; }, failFile(suffix) { failId = suffix; },
    async idle() { for (let n = 0; n < 200; n++) { await settle(); if (vm.runInContext('!busy && migrated', context)) return; } throw Error('Collector did not settle'); },
    async bootIdle() { for (let n = 0; n < 200; n++) { await settle(); if (vm.runInContext('!bootstrapTask', context)) return; } throw Error('Migration did not settle'); },
    migrate() { return new Promise(resolve => { for (const listener of runtimeListeners) listener({type: 'OSMINOG_CORE_MIGRATE'}, {id: 'fixture'}, resolve); }); },
    configure(config) { for (const listener of runtimeListeners) listener({type: 'OSMINOG_CORE_CAPTURE_CONFIG', config}, {id: 'fixture'}); }
  };
}
function file(bytes, name, mime = 'image/png') { const blob = new Blob([bytes], {type: mime}); blob.name = name; return blob; }
test('all clipboard files save sequentially; unchanged files do not allocate whole hash buffers or cross runtime messages', {timeout: 10000}, async () => {
  const f = fixture(); await f.idle(); assert.equal(f.stored.size, 0);
  const bytes = Uint8Array.from({length: 200000}, (_, i) => i % 256);
  f.setClipboard({files: [file(bytes, 'first.png'), file([1, 2, 3], 'second.bin', 'application/octet-stream')]});
  const held = f.hold(); f.poll(); await held.entered.promise; f.poll(); f.poll(); assert.equal(f.peak(), 1);
  f.release(); await f.idle();
  assert.equal(f.stored.size, 2); assert.equal(f.peak(), 1); assert.equal(f.notifications.length, 2);
  assert.deepEqual([...f.stored.values()].map(value => value.fileName), ['first.png', 'second.bin']);
  const hashCount = f.digests.length;
  f.poll(); await f.idle(); assert.equal(f.digests.length, hashCount); assert.equal(f.stored.size, 2);
  const changed = bytes.slice(); changed[100000] ^= 1; // same name, length, prefix and suffix
  f.setClipboard({files: [file(changed, 'first.png'), file([1, 2, 3], 'second.bin', 'application/octet-stream')]});
  f.poll(); await f.idle(); assert.equal(f.stored.size, 4, 'an equal-sized change in the middle is detected exactly; every file in the changed batch is saved');
});
test('a partially committed file batch resumes with stable ids before the next clipboard value', async () => {
  const f = fixture(null); await f.idle();
  f.setClipboard({files: [file([11], 'one.png'), file([22], 'two.png'), file([33], 'three.png')]});
  f.failFile('-1'); f.poll(); await f.idle(); assert.equal(f.stored.size, 1);
  f.setClipboard({text: 'the next copy'}); f.poll(); await f.idle();
  assert.equal(f.stored.size, 4); assert.equal(f.notifications.length, 4);
  const ids = [...f.stored.keys()]; assert.equal(new Set(ids).size, 4);
  assert.equal([...f.stored.values()].filter(value => value.fileName === 'one.png').length, 1);
  assert.equal([...f.stored.values()].at(-1).text, 'the next copy');
  assert(f.messages.some(message => message.error === 'Transient storage failure'));
  assert.equal(f.messages.at(-1).error, '');
});
test('pause stops clipboard reads; fresh enable uses a baseline; later captures continue', async () => {
  const f = fixture(); await f.idle();
  f.configure({enabled: false, projectId: 'desk'}); const before = f.reads(); f.poll(); await settle(); assert.equal(f.reads(), before);
  f.setClipboard({text: 'copied while paused'}); f.configure({enabled: true, projectId: 'desk'}); await f.idle(); assert.equal(f.stored.size, 0);
  f.setClipboard({text: 'copied after enabling'}); f.poll(); await f.idle(); assert.equal(f.stored.size, 1);
});
test('migration retries after an error, remains singleflight, and never restarts a completed collector', async () => {
  const gate = deferred(), entered = deferred();
  const f = fixture(undefined, {async initialize(options, attempt) {
    if (attempt === 1) throw Error('Transient migration failure');
    entered.resolve(); await gate.promise;
    options.onProgress({status: 'running'});
  }});
  await f.bootIdle(); assert.equal(f.initCount(), 1); assert.equal(f.reads(), 0);
  assert(f.messages.some(message => message.error === 'Transient migration failure'));
  let acknowledged = false;
  const first = f.migrate().then(reply => { acknowledged = true; return reply; }), second = f.migrate();
  await entered.promise; await settle(); assert.equal(f.initCount(), 2); assert.equal(acknowledged, false);
  gate.resolve(); const replies = await Promise.all([first, second]);
  assert(replies.every(reply => reply.ok)); await f.idle(); await f.bootIdle();
  const reads = f.reads(); await f.migrate(); await settle();
  assert.equal(f.initCount(), 2); assert.equal(f.reads(), reads, 'completed collector keeps its current clipboard baseline');
  f.setClipboard({text: 'captured after retry'}); f.poll(); await f.idle(); assert.equal(f.stored.size, 1);
});
