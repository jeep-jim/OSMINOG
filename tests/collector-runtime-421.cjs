const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');

const root = path.resolve(__dirname, '..');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {resolve = done;});
  return {promise, resolve};
};

function collectorFixture(initial, transport) {
  let clipboard = initial, poll, pasteListener, allowed = true, readGate, sendGate, failNext = false;
  const sent = [], acknowledged = [], errors = [];
  let reads = 0;
  const sink = {
    addEventListener(type, listener) {assert.equal(type, 'paste'); pasteListener = listener;},
    replaceChildren() {}, focus() {}
  };
  const context = {
    console,
    document: {
      querySelector(selector) {assert.equal(selector, '#clipboard'); return sink;},
      execCommand(command) {
        assert.equal(command, 'paste'); reads++;
        if (!allowed) return false;
        const data = clipboard;
        const file = data?.kind === 'image' ? {type: 'image/png', value: data.value} : null;
        pasteListener({preventDefault() {}, clipboardData: {
          files: file && !data.itemsOnly ? [file] : [],
          items: file ? [{kind: 'file', type: file.type, getAsFile: () => file}] : [],
          getData: () => data?.kind === 'text' ? data.value : ''
        }});
        return true;
      }
    },
    FileReader: class {
      readAsDataURL(file) {
        const gate = readGate;
        Promise.resolve(gate?.promise).then(() => {this.result = file.value; this.onload();});
      }
    },
    navigator: {clipboard: {read: () => {throw Error('Unfocused navigator.clipboard must not be used');}}},
    chrome: {runtime: {sendMessage: async message => {
      sent.push({...message});
      if (message.type === 'OSMINOG_COLLECTOR_ERROR') {errors.push(message.error); return transport ? transport(message) : {ok: true};}
      assert.equal(message.type, 'OSMINOG_COLLECTOR_CAPTURE');
      if (sendGate) await sendGate.promise;
      if (failNext) {failNext = false; return {ok: false, error: 'storage temporarily unavailable'};}
      if (transport) {
        const result = await transport(message);
        if (result?.ok) acknowledged.push({...message});
        return result;
      }
      acknowledged.push({...message});
      return {ok: true};
    }}},
    setInterval(callback, delay) {assert.equal(delay, 1500); poll = callback;}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'collector.js'), 'utf8'), context);
  return {
    sent, acknowledged, errors, poll: () => poll(),
    reads: () => reads,
    setClipboard(value) {clipboard = value;},
    deny() {allowed = false;}, allow() {allowed = true;},
    holdRead() {readGate = deferred(); return readGate;},
    holdSend() {sendGate = deferred(); return sendGate;},
    failOnce() {failNext = true;}
  };
}

function backgroundFixture() {
  const KEY = 'osminogCollectorV1', store = {[KEY]: {enabled: false}};
  const listeners = [], changes = [], contexts = [];
  let createGate, creates = 0, closes = 0, writeFailure = false, keyEnumerations = 0;
  const chrome = {
    runtime: {
      id: 'fixture', getURL: name => 'chrome-extension://fixture/' + name,
      getContexts: async () => contexts.slice(),
      onMessage: {addListener: listener => listeners.push(listener)},
      onStartup: {addListener() {}}
    },
    storage: {
      local: {
        get: async keys => {
          if (keys == null) return structuredClone(store);
          const names = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(names.map(key => [key, structuredClone(store[key])]));
        },
        getKeys: async () => {keyEnumerations++; return Object.keys(store);},
        set: async values => {
          if (writeFailure && Object.keys(values).some(key => key.startsWith('osminogCapture:'))) {
            writeFailure = false;
            throw Error('storage write failed');
          }
          const updates = {};
          for (const [key, value] of Object.entries(values)) {
            updates[key] = {oldValue: structuredClone(store[key]), newValue: structuredClone(value)};
            store[key] = structuredClone(value);
          }
          for (const listener of changes) listener(updates, 'local');
        }
      },
      onChanged: {addListener: listener => changes.push(listener)}
    },
    offscreen: {
      createDocument: async options => {
        assert.equal(options.url, 'collector.html');
        assert.deepEqual(Array.from(options.reasons), ['CLIPBOARD']);
        creates++;
        if (createGate) await createGate.promise;
        assert.equal(contexts.length, 0, 'createDocument must not race another create');
        contexts.push({documentUrl: 'chrome-extension://fixture/collector.html'});
      },
      closeDocument: async () => {closes++; contexts.splice(0);}
    }
  };
  const context = {chrome, crypto: webcrypto, TextEncoder, Uint8Array, Date, console};
  // Match background.js import order: the collector calls the daily-counter
  // migration helper on the first capture of an older installation.
  vm.createContext(context);
  for (const source of ['osminog-today.js', 'osminog-collector-background.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, source), 'utf8'), context, {filename: source});
  }
  const sender = name => ({id: chrome.runtime.id, url: chrome.runtime.getURL(name)});
  const message = (type, values = {}, from = 'collector.html') => new Promise(resolve => {
    let pending = false;
    for (const listener of listeners) if (listener({type, ...values}, sender(from), resolve)) pending = true;
    if (!pending) resolve(undefined);
  });
  return {
    store, contexts, chrome, message,
    configure: patch => message('OSMINOG_COLLECTOR_CONFIGURE', {patch}, 'editor.html'),
    captures: () => Object.entries(store).filter(([key]) => key.startsWith('osminogCapture:')).map(([, value]) => value),
    creates: () => creates, closes: () => closes, keyEnumerations: () => keyEnumerations,
    holdCreate() {createGate = deferred(); return createGate;},
    failNextWrite() {writeFailure = true;}
  };
}

(async () => {
  const reader = collectorFixture({kind: 'text', value: 'old clipboard'});
  await settle();
  assert.equal(reader.acknowledged.length, 0, 'enabling must not capture the existing clipboard');
  reader.setClipboard({kind: 'image', value: 'data:image/png;base64,QUJD', itemsOnly: true});
  const decoding = reader.holdRead(), saving = reader.holdSend();
  const first = reader.poll();
  await reader.poll();
  assert.equal(reader.reads(), 2, 'a second tick must wait for image decoding');
  decoding.resolve();
  await settle();
  await reader.poll();
  assert.equal(reader.reads(), 2, 'a second tick must also wait for durable queue acknowledgement');
  saving.resolve();
  await first;
  await reader.poll();
  assert.equal(reader.acknowledged.length, 1, 'the unchanged image must not be inserted repeatedly');
  assert.equal(reader.acknowledged[0].kind, 'image');

  reader.setClipboard({kind: 'text', value: 'first new copy'});
  reader.failOnce();
  await reader.poll();
  reader.setClipboard({kind: 'text', value: 'second new copy'});
  await reader.poll();
  assert.deepEqual(reader.acknowledged.slice(1).map(item => item.value), ['first new copy', 'second new copy'], 'retry must retain read data even after the clipboard changes');
  assert.deepEqual(reader.errors, ['storage temporarily unavailable', ''], 'recovery clears the displayed reader error');
  reader.deny();
  await reader.poll();
  assert.match(reader.errors.at(-1), /Chrome/);
  reader.allow();
  await reader.poll();
  assert.equal(reader.errors.at(-1), '');

  const empty = collectorFixture(null);
  await settle();
  empty.setClipboard({kind: 'image', value: 'data:image/png;base64,AAAA'});
  await empty.poll();
  assert.equal(empty.acknowledged.length, 1, 'the first screenshot after enabling over an empty clipboard must be saved');

  // Exercise the actual collector/background response contract: permanent
  // validation failures must not block newer clipboard data as storage retries do.
  const validating = backgroundFixture();
  await validating.configure({enabled: true, projectId: 'validation-desk', folderId: null});
  const validated = collectorFixture(null, message => validating.message(message.type, message));
  await settle();
  for (const [invalid, expectedError] of [
    [{kind: 'image', value: 'data:image/svg+xml;base64,AAAA'}, /Неподдерживаемое изображение/],
    [{kind: 'text', value: 'x'.repeat(24000001)}, /слишком большой/]
  ]) {
    const attempts = () => validated.sent.filter(message => message.type === 'OSMINOG_COLLECTOR_CAPTURE').length;
    const beforeAttempts = attempts(), beforeCaptures = validating.captures().length;
    validated.setClipboard(invalid);
    await validated.poll();
    assert.match(validating.store.osminogCollectorV1.error, expectedError);
    await validated.poll();
    validated.setClipboard(null);
    await validated.poll();
    assert.equal(attempts(), beforeAttempts + 1, 'an unchanged permanently rejected capture must not be resent');
    assert.equal(validating.captures().length, beforeCaptures, 'invalid data must not enter the durable queue');
    assert.match(validating.store.osminogCollectorV1.error, expectedError, 'an empty clipboard must not erase the validation error');
    const value = 'small copy after rejection ' + beforeCaptures;
    validated.setClipboard({kind: 'text', value});
    await validated.poll();
    assert.equal(validating.captures().at(-1).value, value, 'the next valid copy must proceed after permanent rejection');
    assert.equal(validating.store.osminogCollectorV1.error, '');
  }
  for (const invalid of [{kind: 'file', value: 'unsupported'}, {kind: 'text', value: ''}]) {
    const result = await validating.message('OSMINOG_COLLECTOR_CAPTURE', invalid);
    assert.equal(result.ok, false);
    assert.equal(result.retryable, false, 'all explicit validation failures are permanent');
  }

  const background = backgroundFixture();
  await settle();
  const capture = value => background.message('OSMINOG_COLLECTOR_CAPTURE', {kind: 'text', value});
  assert.equal((await capture('disabled')).ok, false);
  assert.equal((await background.configure({enabled: true, projectId: 'desk-one', folderId: null})).ok, true);
  const saved = await capture('on the desk');
  assert.equal(saved.ok, true);
  assert.equal(background.captures()[0].projectId, 'desk-one');
  assert.equal(background.captures()[0].folderId, null);
  assert.equal((await capture('on the desk')).duplicate, true);
  assert.equal(background.captures().length, 1);
  assert.equal(background.store.osminogToday.count, 1, 'a duplicate must not increase today count');
  await background.configure({projectId: 'desk-two', folderId: 'inbox'});
  await capture('in a folder');
  assert.equal(background.captures()[1].folderId, 'inbox');
  assert.equal(background.captures()[1].projectId, 'desk-two');

  background.failNextWrite();
  const beforeHash = background.store.osminogCollectorV1.lastHash;
  const beforeToday = structuredClone(background.store.osminogToday);
  const failedWrite = await capture('retry after storage failure');
  assert.equal(failedWrite.ok, false);
  assert.deepEqual(background.store.osminogToday, beforeToday, 'a failed write must not advance today count');
  assert.notEqual(failedWrite.retryable, false, 'storage failures must remain retryable');
  assert.equal(background.store.osminogCollectorV1.lastHash, beforeHash, 'a failed queue write must not advance dedupe');
  assert.equal((await capture('retry after storage failure')).ok, true);
  assert.equal(background.captures().length, 3);
  assert.equal(background.store.osminogToday.count, 3, 'a successful retry increments today count once');
  assert.equal(background.keyEnumerations(), 1, 'normal captures must not rescan the archive');

  const pendingCapture = capture('copy concurrent with pause');
  const paused = background.configure({enabled: false});
  await Promise.all([pendingCapture, paused]);
  assert.equal(background.store.osminogCollectorV1.enabled, false, 'capture metadata must not overwrite a later pause');
  assert.equal(background.contexts.length, 0);
  assert.equal(await background.message('OSMINOG_COLLECTOR_CAPTURE', {kind: 'text', value: 'untrusted'}, 'page.html'), undefined);
  assert.equal(await background.message('OSMINOG_COLLECTOR_CONFIGURE', {patch: {enabled: true}}, 'collector.html'), undefined);

  const racing = backgroundFixture();
  await settle();
  const opening = racing.holdCreate();
  await racing.chrome.storage.local.set({osminogCollectorV1: {enabled: true, projectId: 'desk'}});
  await settle();
  await racing.chrome.storage.local.set({osminogCollectorV1: {enabled: false, projectId: 'desk'}});
  opening.resolve();
  await racing.message('OSMINOG_COLLECTOR_START', {}, 'editor.html');
  assert.equal(racing.creates(), 1);
  assert.equal(racing.closes(), 1);
  assert.equal(racing.contexts.length, 0, 'pause during document creation must not leave a live collector');

  // Migration counts unique captures once across saved projects and the queue.
  const legacy = backgroundFixture(), now = Date.now(), yesterday = now - 86400000;
  await legacy.chrome.storage.local.set({
    briefCraftStudioV2: {projects: [{id: 'legacy', objects: [
      {captureId: 'shared', capturedAt: now},
      {captureId: 'old', capturedAt: yesterday}
    ]}]},
    'osminogCapture:shared': {id: 'shared', at: now},
    'osminogCapture:pending': {id: 'pending', at: now},
    'osminogCapture:old': {id: 'old', at: yesterday}
  });
  await legacy.configure({enabled: true, projectId: 'legacy'});
  const captureLegacy = value => legacy.message('OSMINOG_COLLECTOR_CAPTURE', {kind: 'text', value});
  assert.equal((await captureLegacy('new after migration')).ok, true);
  assert.equal(legacy.store.osminogToday.count, 3, 'migration deduplicates saved and queued captures');
  assert.equal(legacy.keyEnumerations(), 1);
  await captureLegacy('another capture');
  assert.equal(legacy.store.osminogToday.count, 4);
  assert.equal(legacy.keyEnumerations(), 1, 'initialized counter must avoid rescanning stored projects');
  await legacy.chrome.storage.local.set({osminogToday: {
    day: new Date(yesterday).toLocaleDateString('en-CA'), count: 900
  }});
  await captureLegacy('first capture of a new day');
  assert.equal(legacy.store.osminogToday.count, 1, 'a new local day resets the daily counter');
  assert.equal(legacy.store.osminogToday.day, new Date(now).toLocaleDateString('en-CA'));
  assert.equal(legacy.keyEnumerations(), 1, 'day rollover must not reload the archive');
  console.log('PASS daily counter: dedupe, failed-write atomicity, retry, migration, local-day rollover and no repeated scan');

  console.log('PASS collector: awaited image decoding and acknowledgement; retained transient retry; permanent rejection recovery; empty baseline; recovery; desk/folder targets; durable dedupe; concurrent pause; sender checks; offscreen lifecycle race');
})().catch(error => {console.error(error); process.exitCode = 1;});
