/* Native acceptance of the restored full workspace.
 * Run: xvfb-run -a node tests/restore-workspace-439.cjs
 *
 * Runtime files come from the same allowlist as the shipped ZIP. A separate
 * inert extension page seeds real 4.0.38 databases and writes the real clipboard.
 * Chrome storage, IndexedDB, offscreen paste and application UI are not mocked.
 * Network responses are blocked. These Linux Chromium results do not certify
 * performance on the owner's Windows installation or total process memory.
 */
'use strict';
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {deflateSync} = require('node:zlib');

const root = path.resolve(__dirname, '..'), artifacts = path.resolve('artifacts');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'osminog-restore-439-'));
const installed = path.join(temp, 'extension'), profile = path.join(temp, 'profile');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const extensionId = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex')
  .slice(0, 32).replace(/[0-9a-f]/g, char => String.fromCharCode(97 + parseInt(char, 16)));
const origin = `chrome-extension://${extensionId}`;
const existingDesk = 'restore439-existing', newDesk = 'restore439-new', stressDesk = 'restore439-stress';
const sourceSize = {width: 512, height: 384}, sourceCount = 1200, objectCount = 2400;
const hash = value => createHash('sha256').update(value).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], errors = [], crashes = [], workerErrors = [];
const report = {version: manifest.version, scope: 'full unpacked extension with real storage, 4.0.38 recovery and native clipboard',
  ownerWindowsTested: false, platform: {os: os.platform(), release: os.release(), arch: os.arch(), runner: process.env.RUNNER_OS || null},
  fixture: {objectCount, uniqueImages: sourceCount, sourceSize, folders: 60}, checks, errors, crashes, workerErrors,
  geometry: [], viewport: []};
let context, editor, monitor, closing = false, contextClosed = false;
const record = label => { checks.push(label); console.log('PASS ' + label); };

async function waitForAsync(page, predicate, argument, {timeout = 30000, message = 'Native async condition'} = {}) {
  // Playwright 1.62.1 treats an async predicate's Promise as truthy. Poll the
  // awaited result in Node so a resolved false cannot count as success.
  const end = Date.now() + timeout;
  let last;
  do { last = await page.evaluate(predicate, argument); if (last === true) return; await delay(60); } while (Date.now() < end);
  throw Error(`${message} timed out; last value ${JSON.stringify(last)}`);
}
const crcTable = Uint32Array.from({length: 256}, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4); let value = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  size.writeUInt32BE(data.length); crc.writeUInt32BE((value ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, name, data, crc]);
}
function uniquePNG(index, width = sourceSize.width, height = sourceSize.height) {
  const row = Buffer.alloc(width * 4 + 1), raw = Buffer.alloc(row.length * height);
  for (let x = 0; x < width; x++) {
    const offset = 1 + x * 4;
    row[offset] = index & 255; row[offset + 1] = Math.floor(index / 256);
    row[offset + 2] = (index * 37 + (x >> 3)) & 255; row[offset + 3] = 255;
  }
  for (let y = 0; y < height; y++) row.copy(raw, y * row.length);
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function makeFixture() {
  const at = 1700000000000, images = Array.from({length: sourceCount}, (_, index) => uniquePNG(index));
  assert.equal(new Set(images.map(hash)).size, sourceCount);
  const originalImage = uniquePNG(1201, 80, 60), newImage = uniquePNG(1202, 96, 72);
  const longText = 'Written in 4.0.38\n' + 'Retain every character and property. '.repeat(220) + '\nrestore439-tail-needle';
  const folder = {id: 'restore439-folder', name: 'Original folder', members: ['restore439-note', 'restore439-deleted'], unknownFolder: {keep: true}};
  const existing = {id: existingDesk, name: 'Before 4.0.38', created: at, updated: at, activeDesktop: 'main',
    osminogFolders: [folder], view: {x: 0, y: 0, scale: 1}, unknownDesk: {layers: [1, 2, 3]},
    objects: [
      {id: 'restore439-note', type: 'brief', name: 'Original note', text: 'Old snapshot text', x: 40, y: 80, w: 300, h: 180,
        osminogFolderId: folder.id, unknownObject: {deep: ['original', {retain: true}]}},
      {id: 'restore439-deleted', type: 'brief', name: 'Deleted in 4.0.38', text: 'Do not resurrect', x: 400, y: 80, w: 250, h: 180},
      {id: 'restore439-image', type: 'image', name: 'Original binary', src: 'data:image/png;base64,' + originalImage.toString('base64'),
        x: 40, y: 320, w: 160, h: 120, customCrop: {left: 2, top: 3}, searchIndex: {text: 'retained439-ocr-needle'}},
      {id: 'restore439-custom', type: 'legacy-custom-module', name: 'Custom module payload', x: 400, y: 320, w: 250, h: 180,
        customPayload: {layers: [{id: 'keep-layer', options: {strength: .35}}]}}
    ]};
  const stress = {id: stressDesk, name: '2400 materials · 60 folders', created: at, updated: at, activeDesktop: 'main',
    view: {x: 0, y: 0, scale: 1}, connections: [], groups: [],
    osminogFolders: Array.from({length: 60}, (_, i) => ({id: `restore439-folder-${i}`, name: `Folder ${i + 1}`,
      members: Array.from({length: 20}, (_, j) => `restore439-stress-${sourceCount + i * 20 + j}`)})),
    objects: Array.from({length: objectCount}, (_, i) => ({id: `restore439-stress-${i}`, name: `Material ${i}`, type: i < sourceCount ? 'image' : 'brief',
      osminogDesktopId: 'main', x: i < 36 ? 20 + (i % 6) * 190 : 4000 + (i % 40) * 380,
      y: i < 36 ? 20 + Math.floor(i / 6) * 150 : 3000 + Math.floor(i / 40) * 300, w: 160, h: 120,
      ...(i < sourceCount ? {src: 'data:image/png;base64,' + images[i].toString('base64')} : {
        text: i === objectCount - 1 ? 'restore439-last-search-needle' : `Folder material ${i}`,
        osminogFolderId: `restore439-folder-${Math.floor((i - sourceCount) / 20)}`})}))};
  const primary = {schema: 2, activeProject: existingDesk, language: 'ru', theme: 'dark', unknownWorkspace: {keep: true}, projects: [existing, stress]};
  const chat = [{id: 'restore439-chat-old', role: 'user', text: 'Previous full workspace conversation', at},
    {id: 'restore439-chat-new', role: 'assistant', text: 'Written in the 4.0.38 chat', at: at + 10000,
      attachments: [{name: 'source.bin', mime: 'application/octet-stream', dataUrl: 'data:application/octet-stream;base64,' + Buffer.from([0, 255, 3, 19]).toString('base64'), extra: {retain: true}}]}];
  const values = {briefCraftStudioV2: primary, briefCraftStudioV2Backup: structuredClone(primary),
    osminogCollectorV1: {enabled: false, projectId: existingDesk, folderId: null, error: ''},
    [`briefCraftGptThreads:${existingDesk}`]: {items: [{id: 'main', name: 'Главный', provider: 'gpt', kind: 'main'}], active: 'main'},
    [`briefCraftGptLiteChat:${existingDesk}:main`]: [chat[0]],
    restore439Unrelated: {keep: ['exact', 439]}};
  return {values, longText, newImage: 'data:image/png;base64,' + newImage.toString('base64'),
    originalImageHash: hash(originalImage), newImageHash: hash(newImage), chat};
}
const fixture = makeFixture();

async function ready(page) {
  await page.waitForFunction(() => !!globalThis.OSMINOGStateReady && !!globalThis.OSMINOGLibrary && !!globalThis.OSMINOGWindowsFolders &&
    !!globalThis.OSMINOGCanvasBudget && !!document.querySelector('#librarySearch'), null, {timeout: 90000});
  await page.evaluate(async () => { await OSMINOGStateReady; document.querySelector('#osminogStorageOnboarding')?.close(); });
}
async function openEditor() {
  const page = await context.newPage(); await page.goto(origin + '/editor.html?view=desk'); await ready(page); return page;
}
async function sourceDigest() {
  return monitor.evaluate(async () => {
    const digest = bytes => crypto.subtle.digest('SHA-256', bytes).then(buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join(''));
    const stable = async value => {
      if (value instanceof Blob) return {blobType: value.type, size: value.size, sha256: await digest(await value.arrayBuffer())};
      if (Array.isArray(value)) return Promise.all(value.map(stable));
      if (value && typeof value === 'object') { const out = {}; for (const key of Object.keys(value).sort()) out[key] = await stable(value[key]); return out; }
      return value;
    };
    const out = {};
    for (const name of ['osminog-core-v1', 'osminog-core-chat-v1']) {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const rows = {};
      for (const name of [...db.objectStoreNames].sort()) {
        const tx = db.transaction(name, 'readonly'), store = tx.objectStore(name);
        const [keys, values] = await Promise.all([store.getAllKeys(), store.getAll()].map(r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); })));
        rows[name] = await stable(keys.map((key, i) => [key, values[i]]));
      }
      db.close(); out[name] = await digest(new TextEncoder().encode(JSON.stringify(rows)));
    }
    return out;
  });
}
async function seed() {
  await monitor.evaluate(async ({values, existingDesk, newDesk, longText, newImage, chat}) => {
    await navigator.locks.request('osminog-restore-438-to-439', async () => {
    await chrome.storage.local.set(values);
    const store = OSMINOGCoreStore; await store.init({migrate: false});
    const raw = values.briefCraftStudioV2.projects.find(p => p.id === existingDesk);
    const detail = {...raw}; delete detail.objects;
    const detailBlobId = await store.putBlob(new Blob([JSON.stringify(detail)], {type: 'application/json'}), {id: 'legacy-desk:' + existingDesk});
    await store.saveDesk({id: existingDesk, sourceId: existingDesk, name: 'Edited in 4.0.38', detailBlobId,
      folders: [{...raw.osminogFolders[0], name: 'Renamed in 4.0.38', members: []}], view: {x: 11, y: 17, scale: .85}, activeDesktop: 'main'});
    const note = raw.objects.find(o => o.id === 'restore439-note'), noteDetail = {...note}; delete noteDetail.text;
    const noteBlob = await store.putBlob(new Blob([JSON.stringify(noteDetail)], {type: 'application/json'}), {id: 'legacy-detail:' + note.id});
    await store.putItem({id: note.id, sourceId: note.id, deskId: existingDesk, type: 'text', name: 'Edited note', text: longText,
      detailBlobId: noteBlob, x: 520, y: 80, w: 300, h: 180, folderId: null, desktopId: 'main'});
    await store.putItem({id: 'restore439-deleted', sourceId: 'restore439-deleted', deskId: existingDesk, type: 'text', name: 'Deleted in 4.0.38', deletedAt: Date.now()});
    await store.saveDesk({id: newDesk, name: 'Created in 4.0.38', folders: [], view: {x: 0, y: 0, scale: 1}});
    await store.putItem({id: 'restore439-new-note', deskId: newDesk, type: 'text', name: 'New 4.0.38 text', text: 'restore439-new-note-needle', x: 30, y: 30, w: 260, h: 180});
    const imageBlob = await (await fetch(newImage)).blob();
    await store.putItem({id: 'restore439-new-image', deskId: newDesk, type: 'image', name: 'New 4.0.38 image', blob: imageBlob, x: 340, y: 30, w: 192, h: 144});
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('osminog-core-chat-v1', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('threads', {keyPath: ['scope', 'thread']});
        const messages = r.result.createObjectStore('messages', {keyPath: ['scope', 'thread', 'seq']});
        messages.createIndex('byTime', ['scope', 'thread', 'at', 'seq']); r.result.createObjectStore('bodies');
      };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['threads', 'messages', 'bodies'], 'readwrite');
      tx.objectStore('threads').put({scope: existingDesk, thread: 'main', name: 'Главный', provider: 'gpt', kind: 'main', legacyDone: true, nextSeq: chat.length, clearedAt: 0});
      chat.forEach((message, seq) => { tx.objectStore('bodies').put(message, [existingDesk, 'main', seq]);
        tx.objectStore('messages').put({scope: existingDesk, thread: 'main', seq, id: message.id, role: message.role, text: message.text, at: message.at}); });
      tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error);
    });
    db.close();
    window.storageWrites = [];
    chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local') for (const [key, value] of Object.entries(changes)) {
      storageWrites.push({key, at: Date.now(), bytes: JSON.stringify(value.newValue ?? null).length});
    }});
    });
  }, {...fixture, existingDesk, newDesk});
  report.sourceBefore = await sourceDigest();
}

async function recoveryAssertions() {
  const saved = await editor.evaluate(async ({existingDesk, newDesk, stressDesk}) => {
    const p = state.projects.find(p => p.id === existingDesk), next = state.projects.find(p => p.id === newDesk), stress = state.projects.find(p => p.id === stressDesk);
    const sha = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch(value)).arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
    const raw = await chrome.storage.local.get([`briefCraftGptLiteChat:${existingDesk}:main`, 'restore439Unrelated']);
    return {name: p?.name, note: p?.objects.find(o => o.id === 'restore439-note'), deleted: p?.objects.some(o => o.id === 'restore439-deleted'),
      folder: p?.osminogFolders?.find(f => f.id === 'restore439-folder'), unknownDesk: p?.unknownDesk,
      custom: p?.objects.find(o => o.id === 'restore439-custom')?.customPayload,
      imageHash: await sha(p.objects.find(o => o.id === 'restore439-image').src),
      imageOCR: p.objects.find(o => o.id === 'restore439-image').searchIndex?.text,
      next: next && {name: next.name, ids: next.objects.map(o => o.id), text: next.objects.find(o => o.id === 'restore439-new-note')?.text,
        imageHash: await sha(next.objects.find(o => o.id === 'restore439-new-image').src)},
      stress: {objects: stress?.objects.length, folders: stress?.osminogFolders.length},
      chat: raw[`briefCraftGptLiteChat:${existingDesk}:main`], unrelated: raw.restore439Unrelated};
  }, {existingDesk, newDesk, stressDesk});
  assert.equal(saved.name, 'Edited in 4.0.38'); assert.equal(saved.note.text, fixture.longText);
  assert.equal(saved.note.x, 520); assert.equal(saved.note.y, 80); assert(!saved.note.osminogFolderId);
  assert.deepEqual(saved.note.unknownObject, fixture.values.briefCraftStudioV2.projects[0].objects[0].unknownObject);
  assert.equal(saved.deleted, false); assert.equal(saved.folder.name, 'Renamed in 4.0.38');
  assert.deepEqual(saved.folder.unknownFolder, {keep: true}); assert.deepEqual(saved.unknownDesk, {layers: [1, 2, 3]});
  assert.deepEqual(saved.custom, fixture.values.briefCraftStudioV2.projects[0].objects[3].customPayload);
  assert.equal(saved.imageHash, fixture.originalImageHash); assert.equal(saved.imageOCR, 'retained439-ocr-needle');
  assert.equal(saved.next.name, 'Created in 4.0.38'); assert.equal(saved.next.text, 'restore439-new-note-needle');
  assert.equal(saved.next.imageHash, fixture.newImageHash); assert.equal(new Set(saved.next.ids).size, 2);
  assert.deepEqual(saved.stress, {objects: objectCount, folders: 60}); assert.deepEqual(saved.chat, fixture.chat);
  assert.deepEqual(saved.unrelated, {keep: ['exact', 439]});
  assert.deepEqual(await sourceDigest(), report.sourceBefore, 'Restoring must not mutate either 4.0.38 source database');
  report.recovery = {...saved, note: {id: saved.note.id, type: saved.note.type, textLength: saved.note.text.length, x: saved.note.x, y: saved.note.y}, chat: {messages: saved.chat.length, exactBodies: true}};
  record('4.0.38 edits, deletions, new desks, exact media and chat bodies recover into the full workspace; source databases remain unchanged');
}
async function headerRects() {
  return editor.evaluate(() => {
    const header = document.querySelector('#osminogWorkspaceHeader');
    return {header: header.getBoundingClientRect().toJSON(), buttons: [...header.querySelectorAll('button,select')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== 'hidden';
    }).map((el, index) => ({id: el.id || `control-${index}`, rect: el.getBoundingClientRect().toJSON()}))};
  });
}
function sameRects(before, after, label) {
  assert.deepEqual(after.buttons.map(b => b.id), before.buttons.map(b => b.id), label + ' retains the header controls');
  for (const [a, b] of [[before.header, after.header], ...before.buttons.map((item, i) => [item.rect, after.buttons[i].rect])])
    for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(a[key] - b[key]) < .6, `${label} shifts ${key}: ${a[key]} → ${b[key]}`);
}
async function settle() { await editor.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function geometryAssertions() {
  for (const width of [1440, 1024]) {
    await editor.setViewportSize({width, height: 1000});
    await editor.evaluate(() => { OSMINOGLibrary.close(); BriefCraftBridge.close(); setLayersOpen(false); document.querySelector('#inspector').classList.add('collapsed'); });
    await settle(); const baseline = await headerRects();
    const transitions = ['#workdeskGPT', '#librarySearch', '#libraryCapture', '#canvasSettings', '#layersToggle'];
    for (const selector of transitions) {
      await editor.locator(selector).click(); await settle(); sameRects(baseline, await headerRects(), `${width}px ${selector}`);
      const layout = await editor.evaluate(() => {
        const header = document.querySelector('#osminogWorkspaceHeader').getBoundingClientRect();
        const visible = el => el && !el.hidden && !el.classList.contains('collapsed') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height;
        return {header: header.toJSON(), panels: ['bridgePanel', 'osminogLibrary', 'inspector', 'layersPanel'].map(id => document.getElementById(id)).filter(visible)
          .map(el => ({id: el.id, rect: el.getBoundingClientRect().toJSON()}))};
      });
      for (const panel of layout.panels) assert(panel.rect.top >= layout.header.bottom - 1, `${width}px ${panel.id} must begin below the header`);
    }
    await editor.screenshot({path: path.join(artifacts, `restore-workspace-439-panels-${width}.png`)});
    report.geometry.push({width, controls: baseline.buttons.length, header: baseline.header, transitions});
  }
  await editor.setViewportSize({width: 1440, height: 1000});
  await editor.evaluate(() => { OSMINOGLibrary.close(); BriefCraftBridge.close(); setLayersOpen(false); document.querySelector('#inspector').classList.add('collapsed'); });
  record('all original header controls keep their rectangles through chat, search, capture, inspector and Layers transitions at 1440px and 1024px');
}
async function viewportSnapshot(label) {
  await settle();
  const value = await editor.evaluate(label => ({label, model: objects().length, desktop: desktopObjects().length, exported: exportObjects().length,
    nodes: document.querySelectorAll('#objects .canvas-object').length,
    images: [...document.querySelectorAll('#objects img')].map(img => ({width: img.naturalWidth, height: img.naturalHeight})),
    view: {...state.view}}), label);
  assert.equal(value.model, objectCount); assert.equal(value.desktop, sourceCount);
  assert(value.nodes > 0 && value.nodes < 200, JSON.stringify(value));
  assert(value.images.length < 200); report.viewport.push({...value, images: value.images.length,
    renderedImagePixels: value.images.reduce((sum, image) => sum + image.width * image.height, 0)});
  return value;
}
async function canvasAssertions() {
  await editor.evaluate(id => { openProject(id); state.view = {x: 0, y: 0, scale: 1}; clearSelection(); renderAll(true); }, stressDesk);
  await viewportSnapshot('initial');
  const budget = await editor.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const root = document.querySelector('#objects'), first = root.querySelector('.canvas-object[data-type="image"]');
    let childMutations = 0; const observer = new MutationObserver(records => childMutations += records.filter(r => r.type === 'childList').length);
    observer.observe(root, {childList: true, subtree: true});
    const start = performance.now(); for (let i = 0; i < 60; i++) renderAll(true);
    const milliseconds = performance.now() - start; await new Promise(resolve => requestAnimationFrame(resolve)); observer.disconnect();
    return {milliseconds, childMutations, sameImageNode: first === root.querySelector(`.canvas-object[data-id="${first.dataset.id}"]`),
      imageSources: new Set(objects().filter(o => o.type === 'image').map(o => o.src)).size};
  });
  assert.equal(budget.sameImageNode, true); assert.equal(budget.childMutations, 0); assert.equal(budget.imageSources, sourceCount);
  assert(budget.milliseconds < 10000, `60 full unchanged redraws must finish within the native responsiveness gate: ${JSON.stringify(budget)}`);
  report.redraw = budget;
  // Measure ordinary interactions separately from migration and the deliberately
  // synchronous redraw stress above. Keep raw intervals for reproducible p95.
  await editor.evaluate(() => {
    const metrics = window.restore439InteractionMetrics = {startedAt: performance.now(), intervals: [], longTasks: [], phases: [],
      longTaskSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'), frame: 0, previous: null};
    const observe = entries => metrics.longTasks.push(...entries.map(entry => ({startTime: entry.startTime, duration: entry.duration})));
    if (metrics.longTaskSupported) {
      metrics.observer = new PerformanceObserver(list => observe(list.getEntries()));
      metrics.observer.observe({type: 'longtask', buffered: false});
    }
    const tick = timestamp => { if (metrics.previous !== null) metrics.intervals.push(timestamp - metrics.previous);
      metrics.previous = timestamp; metrics.frame = requestAnimationFrame(tick); };
    metrics.frame = requestAnimationFrame(tick); metrics.phases.push({name: 'focus across the large desktop', at: performance.now()});
  });
  for (const index of [1199, 0, 1111, 2, 900, 3]) {
    await editor.evaluate(id => { const object = objects().find(o => o.id === id); selectObject(id); focusObject(object); }, `restore439-stress-${index}`);
    await editor.waitForSelector(`#objects .canvas-object[data-id="restore439-stress-${index}"]`);
    await viewportSnapshot('focus-' + index);
  }
  await editor.evaluate(() => clearSelection());
  assert.equal(await editor.evaluate(() => exportObjects().length), sourceCount, 'Exports enumerate the complete desktop, including objects outside the viewport');
  record('2400 objects and 60 folders retain a complete model/export while viewport changes mount fewer than 200 cards; unchanged redraws retain image DOM');

  await editor.evaluate(id => { openProject(id); const object = objects().find(o => o.id === 'restore439-note'); selectObject(object.id); focusObject(object); }, existingDesk);
  await settle(); await delay(600);
  await monitor.evaluate(() => { storageWrites.length = 0; });
  const before = await editor.evaluate(() => ({object: {...objects().find(o => o.id === 'restore439-note')}, view: {...state.view}}));
  const target = editor.locator('#objects .canvas-object[data-id="restore439-note"] .object-bar'); await target.waitFor();
  const box = await target.boundingBox(), pointer = {x: box.x + box.width / 2, y: box.y + box.height / 2};
  const hit = await editor.evaluate(point => document.elementFromPoint(point.x, point.y)?.closest('.canvas-object')?.dataset.id, pointer);
  assert.equal(hit, 'restore439-note', 'A native pointer must actually hit the intended card');
  await editor.evaluate(() => restore439InteractionMetrics.phases.push({name: 'native card drag', at: performance.now()}));
  await editor.mouse.move(pointer.x, pointer.y); await editor.mouse.down(); await editor.mouse.move(pointer.x + 70, pointer.y + 55, {steps: 12}); await editor.mouse.up();
  await waitForAsync(editor, async ({x, y}) => {
    const object = objects().find(o => o.id === 'restore439-note'); if (object.x === x || object.y === y) return false;
    const keys = await chrome.storage.local.get(null);
    return Object.entries(keys).some(([key, value]) => key.startsWith('osminogItemEdit:') && value.objectId === object.id && value.kind === 'objectPosition' && value.position?.x === object.x && value.position?.y === object.y);
  }, {x: before.object.x, y: before.object.y}, {message: 'Native drag position journal commits'});
  const moved = await editor.evaluate(() => ({...objects().find(o => o.id === 'restore439-note')}));
  await editor.evaluate(() => setTool('hand'));
  const viewport = await editor.locator('#viewport').boundingBox(), pan = {x: viewport.x + viewport.width * .6, y: viewport.y + viewport.height * .65};
  await editor.evaluate(() => restore439InteractionMetrics.phases.push({name: 'native canvas pan', at: performance.now()}));
  await editor.mouse.move(pan.x, pan.y); await editor.mouse.down(); await editor.mouse.move(pan.x + 91, pan.y + 63, {steps: 12}); await editor.mouse.up();
  await editor.evaluate(() => setTool('select'));
  await waitForAsync(editor, async before => {
    if (state.view.x === before.x || state.view.y === before.y) return false;
    const all = await chrome.storage.local.get(null);
    return Object.entries(all).some(([key, value]) => key.startsWith('osminogItemEdit:') && value.kind === 'view' && value.projectId === project().id &&
      value.view?.x === state.view.x && value.view?.y === state.view.y && value.view?.scale === state.view.scale);
  }, before.view, {message: 'Native pan view journal commits'});
  const expectedView = await editor.evaluate(() => ({...state.view}));
  const writes = await monitor.evaluate(() => storageWrites.slice());
  assert.deepEqual(writes.filter(value => /^(?:briefCraftStudioV2(?:Backup)?|osminogProjectRevisionsV1)$/.test(value.key)), [], 'Pointer movement writes only small journals, never a complete workspace snapshot');
  await editor.waitForFunction(() => restore439InteractionMetrics.intervals.length >= 120, null, {timeout: 8000});
  report.interaction = await editor.evaluate(() => {
    const metrics = restore439InteractionMetrics;
    cancelAnimationFrame(metrics.frame);
    if (metrics.observer) { metrics.longTasks.push(...metrics.observer.takeRecords().map(entry => ({startTime: entry.startTime, duration: entry.duration}))); metrics.observer.disconnect(); }
    const sorted = [...metrics.intervals].sort((a, b) => a - b);
    return {scope: 'existing focus, desk switch, pointer drag and pan sequence; excludes migration and the 60-redraw stress loop',
      durationMs: performance.now() - metrics.startedAt, frameIntervalsMs: metrics.intervals, frames: sorted.length,
      p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1),
      longTaskSupported: metrics.longTaskSupported, longTaskCount: metrics.longTasks.length,
      longTaskMaxMs: Math.max(0, ...metrics.longTasks.map(entry => entry.duration)), longTasks: metrics.longTasks,
      phases: metrics.phases.map(phase => ({name: phase.name, atMs: phase.at - metrics.startedAt})), ciP95ThresholdMs: 50};
  });
  assert.equal(report.interaction.longTaskSupported, true, 'This Chromium gate must expose Long Task observations');
  assert(report.interaction.p95Ms < 50, 'Interaction frame p95 must remain below 50 ms in this CI fixture: ' + JSON.stringify(report.interaction));
  record(`native interaction timing: ${report.interaction.frames} frame intervals, p95 ${report.interaction.p95Ms.toFixed(1)} ms, max ${report.interaction.maxMs.toFixed(1)} ms, ${report.interaction.longTaskCount} long tasks`);
  await editor.reload(); await ready(editor);
  const restored = await editor.evaluate(id => { openProject(id); return {object: {...objects().find(o => o.id === 'restore439-note')}, view: {...state.view}}; }, existingDesk);
  assert.equal(restored.object.x, moved.x); assert.equal(restored.object.y, moved.y);
  for (const key of ['x', 'y', 'scale']) assert.equal(restored.view[key], expectedView[key], 'Reload restores view.' + key);
  report.pointer = {hit, from: {x: before.object.x, y: before.object.y}, to: {x: moved.x, y: moved.y}, expectedView, restoredView: restored.view, writes};
  record('native card drag and canvas pan commit only metadata journals and restore exact positions after reload');
}
async function clipboardAssertions() {
  const baseline = `restore439-baseline-${Date.now()}`, text = `restore439-clipboard-${Date.now()}`;
  await monitor.bringToFront(); await monitor.locator('#focus').click(); await monitor.evaluate(value => navigator.clipboard.writeText(value), baseline);
  const configured = await editor.evaluate(id => chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CONFIGURE', patch: {enabled: true, projectId: id, folderId: null}}), newDesk);
  assert.equal(configured?.ok, true); await delay(2200); await editor.close(); editor = null;
  await monitor.bringToFront(); await monitor.locator('#focus').click();
  const beforeCount = await monitor.evaluate(() => OSMINOGCaptureStore.count());
  await monitor.evaluate(value => navigator.clipboard.writeText(value), text);
  await waitForAsync(monitor, async text => {
    for (const metadata of await OSMINOGCaptureStore.list({limit: 100})) { const entry = await OSMINOGCaptureStore.read(metadata.id); if (entry?.value === text) return true; }
    return false;
  }, text, {timeout: 20000, message: 'Closed-editor native text capture'});
  await monitor.evaluate(value => navigator.clipboard.writeText(value), text); await delay(2000);
  const expectedImage = await monitor.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#193d7a'; ctx.fillRect(0, 0, 80, 60); ctx.fillStyle = '#f7aa31'; ctx.fillRect(17, 11, 29, 35);
    const pixels = ctx.getImageData(0, 0, 80, 60).data;
    const pixelHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)), b => b.toString(16).padStart(2, '0')).join('');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]); return {width: 80, height: 60, pixelHash};
  });
  await waitForAsync(monitor, async before => await OSMINOGCaptureStore.count() === before + 2, beforeCount,
    {timeout: 20000, message: 'Exactly one text and one native image are durable while the editor is closed'});
  editor = await openEditor();
  await editor.evaluate(id => openProject(id), newDesk);
  await waitForAsync(editor, async ({id, text}) => {
    await OSMINOGLibrary.drain(); const p = state.projects.find(p => p.id === id);
    return p.objects.filter(o => o.captureId && o.text === text).length === 1 && p.objects.some(o => o.captureId && o.type === 'image');
  }, {id: newDesk, text}, {timeout: 30000, message: 'Reopened full editor imports native clipboard queue once'});
  const saved = await editor.evaluate(async ({text, baseline}) => {
    const p = project(), matches = p.objects.filter(o => o.captureId && o.text === text), image = p.objects.find(o => o.captureId && o.type === 'image');
    const blob = await (await fetch(image.src)).blob(), bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height; const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return {matches: matches.length, baseline: p.objects.some(o => o.text === baseline), width: canvas.width, height: canvas.height,
      pixelHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)), b => b.toString(16).padStart(2, '0')).join('')};
  }, {text, baseline});
  assert.equal(saved.matches, 1); assert.equal(saved.baseline, false); assert.equal(saved.width, expectedImage.width);
  assert.equal(saved.height, expectedImage.height); assert.equal(saved.pixelHash, expectedImage.pixelHash);
  await editor.evaluate(() => chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CONFIGURE', patch: {enabled: false}}));
  await waitForAsync(monitor, async () => (await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1?.enabled === false, null,
    {message: 'The collector acknowledges pause'});
  const pausedText = `restore439-paused-${Date.now()}`, pausedCount = await monitor.evaluate(() => OSMINOGCaptureStore.count());
  await monitor.bringToFront(); await monitor.locator('#focus').click(); await monitor.evaluate(value => navigator.clipboard.writeText(value), pausedText);
  await delay(3200);
  assert.equal(await monitor.evaluate(() => OSMINOGCaptureStore.count()), pausedCount);
  assert.equal(await editor.evaluate(text => state.projects.some(p => p.objects.some(o => o.text === text)), pausedText), false);
  report.clipboard = {nativeClipboard: true, editorClosedDuringCapture: true, capturedText: saved.matches, exactImagePixels: saved.pixelHash, baselineSkipped: !saved.baseline};
  record('real text and PNG copies are captured once with the editor closed, retain exact pixels, import on reopen and pause prevents new captures');
}
async function main() {
  fs.mkdirSync(artifacts, {recursive: true}); fs.mkdirSync(installed, {recursive: true});
  const files = JSON.parse(fs.readFileSync(path.join(root, 'tools/release-files-439.json'), 'utf8'));
  for (const file of files) { fs.mkdirSync(path.dirname(path.join(installed, file)), {recursive: true}); fs.copyFileSync(path.join(root, file), path.join(installed, file)); }
  // This historical store script belongs only to the seed page, not the package
  // or editor. It creates real source database records using the shipped 4.0.38 API.
  fs.copyFileSync(path.join(root, 'osminog-core-store.js'), path.join(installed, 'fixture-core-store-438.js'));
  fs.writeFileSync(path.join(installed, 'snapshot-test-439.html'), '<!doctype html><meta charset="utf-8"><title>Native data fixture</title><button id="focus">Clipboard source</button><script src="fixture-core-store-438.js"></script><script src="osminog-capture-store.js"></script>');
  context = await chromium.launchPersistentContext(profile, {headless: process.env.TEST_HEADLESS === '1', channel: 'chromium',
    ...(process.env.TEST_CHROMIUM ? {executablePath: process.env.TEST_CHROMIUM} : {}), ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--disable-extensions-except=${installed}`, `--load-extension=${installed}`], viewport: {width: 1440, height: 1000}});
  context.setDefaultTimeout(15000); context.on('close', () => { if (!closing) contextClosed = true; });
  const observe = page => { page.on('pageerror', error => errors.push({url: page.url(), message: error.message})); page.on('crash', () => crashes.push(page.url())); };
  context.pages().forEach(observe); context.on('page', observe); await context.route(/^https?:\/\//, route => route.abort());
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(() => chrome.storage.local.set({osminogCollectorV1: {enabled: false}}));
  monitor = await context.newPage(); await monitor.goto(origin + '/snapshot-test-439.html');
  const cdp = await context.newCDPSession(monitor); cdp.on('ServiceWorker.workerErrorReported', event => workerErrors.push(event)); await cdp.send('ServiceWorker.enable');
  report.browser = await monitor.evaluate(() => navigator.userAgent); report.packageFiles = files.length;
  await seed(); editor = await openEditor(); await recoveryAssertions();
  const tools = await editor.evaluate(() => ({workdesk: document.body.dataset.workdesk,
    bridge: typeof BriefCraftBridge.executeTool, folders: typeof OSMINOGWindowsFolders.openVirtual,
    graphics: typeof OSMINOGGraphicsStudio.edit, photo: typeof OSMINOGPhotoEditor.open,
    documents: typeof OSMINOGDocuments.tool, extensions: typeof OSMINOGExtensionStudio.list,
    markdown: !!document.querySelector('#markdownStudio'), layers: !!document.querySelector('#layersPanel'),
    originalWorkdeskScript: !!document.querySelector('script[src="osminog-workdesk.js"]'), scripts: [...document.scripts].filter(s => s.src).length}));
  for (const key of ['bridge', 'folders', 'graphics', 'photo', 'documents', 'extensions']) assert.equal(tools[key], 'function', key);
  assert.equal(tools.workdesk, 'true'); assert.equal(tools.markdown, true); assert.equal(tools.layers, true);
  assert(tools.scripts >= 46); report.tools = tools;
  record('the original Workdesk shell and all retained tool modules load in the real extension');
  await geometryAssertions(); await canvasAssertions(); await clipboardAssertions();
  assert.deepEqual(await sourceDigest(), report.sourceBefore, 'Normal restored use leaves the 4.0.38 source databases untouched');
  assert.equal(contextClosed, false); assert.deepEqual(crashes, []); assert.deepEqual(workerErrors, []); assert.deepEqual(errors, []);
  await editor.screenshot({path: path.join(artifacts, 'restore-workspace-439.png')}); report.ok = true;
}
main().catch(async error => {
  report.ok = false; report.error = error.stack || String(error); report.contextClosed = contextClosed;
  try { report.storageWrites = await monitor?.evaluate(() => window.storageWrites || []); } catch {}
  try { if (editor && !editor.isClosed()) { report.state = await editor.evaluate(() => ({url: location.href, active: globalThis.state?.activeProject,
    view: globalThis.state?.view, projects: globalThis.state?.projects?.map(p => ({id: p.id, objects: p.objects?.length})), body: document.body.innerText.slice(-5000)}));
    await editor.screenshot({path: path.join(artifacts, 'restore-workspace-439-failure.png')}); } } catch {}
  console.error('RESTORE439_DIAGNOSTICS', JSON.stringify(report)); process.exitCode = 1;
}).finally(async () => {
  fs.mkdirSync(artifacts, {recursive: true}); fs.writeFileSync(path.join(artifacts, 'restore-workspace-439-results.json'), JSON.stringify(report, null, 2) + '\n');
  closing = true; await context?.close().catch(() => {}); fs.rmSync(temp, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
});
