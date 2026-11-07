/* Real unpacked-extension acceptance for the reduced OSMINOG shell.
 * Run: xvfb-run -a node tests/lite-core-438.cjs
 *
 * All application storage, migration, canvas input and clipboard APIs are real.
 * Only legacy input data and external network responses are fixtures. A separate
 * extension page observes chrome.storage changes and writes the system clipboard;
 * it does not substitute the offscreen collector or its native paste operation.
 * Image pixel counts measure live rendered media, not total browser process RAM.
 * This Linux Chromium gate is not a reproduction on the owner's Windows machine.
 */
'use strict';

const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {deflateSync} = require('node:zlib');

const root = path.resolve(__dirname, '..');
const artifacts = path.resolve('artifacts');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'osminog-lite-438-'));
const profile = path.join(temp, 'profile'), installed = path.join(temp, 'extension');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const extensionId = createHash('sha256').update(Buffer.from(manifest.key, 'base64'))
  .digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const origin = `chrome-extension://${extensionId}`;
const legacyDesk = 'lite438-legacy', stressDesk = 'lite438-stress', trashDesk = 'lite438-trash';
const sourceSize = {width: 1024, height: 768};
const sourceImageCount = 240, stressItemCount = 2400;
const checks = [], errors = [], crashes = [], workerErrors = [];
const report = {
  scope: 'real unpacked Chromium extension, native IndexedDB and system clipboard',
  ownerWindowsTested: false,
  version: manifest.version,
  platform: {os: os.platform(), release: os.release(), arch: os.arch(), runner: process.env.RUNNER_OS || null},
  fixture: {stressItemCount, uniqueSourceImages: sourceImageCount, sourceSize, folders: 60},
  checks, errors, crashes, workerErrors,
  geometry: [], media: [], timings: {}
};
let context, editor, monitor, closing = false, contextClosed = false;

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const record = label => { checks.push(label); console.log('PASS ' + label); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const crcTable = Uint32Array.from({length: 256}, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function uniquePNG(index, width = sourceSize.width, height = sourceSize.height) {
  const row = Buffer.alloc(width * 4 + 1), raw = Buffer.alloc(row.length * height);
  row[0] = 0;
  for (let x = 0; x < width; x++) {
    const offset = 1 + x * 4;
    row[offset] = index & 255; row[offset + 1] = (index * 37 + (x >> 5)) & 255;
    row[offset + 2] = (index * 91 + (x >> 3)) & 255; row[offset + 3] = 255;
  }
  for (let y = 0; y < height; y++) row.copy(raw, y * row.length);
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function legacyFixture() {
  const at = 1700000000000, images = Array.from({length: sourceImageCount}, (_, i) => uniquePNG(i));
  assert.equal(new Set(images.map(hash)).size, sourceImageCount, 'Stress sources must have distinct bytes');
  const originalImage = uniquePNG(250, 96, 72);
  const originalFile = Buffer.from(Array.from({length: 1025}, (_, index) => (index * 71) & 255));
  const longText = 'Retained long text\n' + 'Evidence remains complete. '.repeat(600) + '\nlegacy438-tail-needle';
  const folder = {id: 'lite438-folder', name: 'Retained folder', members: ['legacy438-note', 'legacy438-image'], x: 22, y: 35,
    extraFolderProperty: {color: '#8399ff', nested: ['unchanged', 438]}};
  const primary = {
    schema: 2, activeProject: legacyDesk, theme: 'dark', language: 'ru', unknownWorkspace: {preserved: true},
    projects: [
      {id: legacyDesk, name: 'Retained desk', created: at, updated: at + 100, view: {x: 0, y: 0, scale: 1},
        osminogFolders: [folder], sharing: {mode: 'private', owner: 'fixture-owner'},
        unknownDeskProperty: {nested: {retained: true}},
        objects: [
          {id: 'legacy438-note', type: 'brief', name: 'Retained note', text: longText, x: 40, y: 60, w: 250, h: 180,
            createdAt: at, updatedAt: at + 10, unusualProperty: {list: [1, null, {deep: 'unchanged'}]},
            osminogFolderId: folder.id},
          {id: 'legacy438-image', type: 'image', name: 'Retained source image', src: 'data:image/png;base64,' + originalImage.toString('base64'),
            x: 400, y: 60, w: 192, h: 144, createdAt: at, updatedAt: at + 20,
            searchIndex: {text: 'legacy438-ocr-needle'}, customCrop: {left: 3, top: 4}},
          {id: 'legacy438-file', type: 'file', name: 'Retained binary', fileName: 'evidence.bin', mime: 'application/octet-stream',
            src: 'data:application/octet-stream;base64,' + originalFile.toString('base64'),
            x: 40, y: 320, w: 250, h: 160, createdAt: at, updatedAt: at + 30, unknownFileProperty: 123},
          {id: 'legacy438-unknown', type: 'retired-special-tool', name: 'Unknown legacy object', x: 400, y: 320, w: 250, h: 160,
            createdAt: at, updatedAt: at + 40, oldToolPayload: {layers: [{id: 'keep-layer', options: {strength: .35}}]}}
        ]},
      {id: stressDesk, name: '2400 materials', created: at, updated: at, view: {x: 0, y: 0, scale: 1},
        osminogFolders: Array.from({length: 60}, (_, folderIndex) => ({id: `stress438-folder-${folderIndex}`, name: `Folder ${folderIndex + 1}`,
          members: Array.from({length: 36}, (_, itemIndex) => `stress438-item-${sourceImageCount + folderIndex * 36 + itemIndex}`)})),
        objects: Array.from({length: stressItemCount}, (_, index) => ({
          id: `stress438-item-${index}`, type: index < sourceImageCount ? 'image' : 'brief',
          name: `stress438 material ${index}`, createdAt: at + index, updatedAt: at + index,
          x: index < sourceImageCount ? 10 + (index % 20) * 54 : 3000 + (index % 60) * 280,
          y: index < sourceImageCount ? 10 + Math.floor(index / 20) * 52 : 2000 + Math.floor(index / 60) * 220,
          w: index < sourceImageCount ? 100 : 240, h: index < sourceImageCount ? 80 : 180,
          ...(index < sourceImageCount ? {src: 'data:image/png;base64,' + images[index].toString('base64')}
            : {text: `Material ${index}. ${index === stressItemCount - 1 ? 'stress438-last-needle' : 'saved searchable content'}`})
        }))}
    ]
  };
  const chat = Array.from({length: 123}, (_, index) => ({id: `legacy438-chat-${index}`, role: index % 2 ? 'assistant' : 'user',
    text: `Retained conversation ${index}`, at: at + index,
    ...(index === 122 ? {attachments: [{name: 'preserved-reference.txt', mime: 'text/plain', customField: 'keep'}]} : {})}));
  const values = {
    briefCraftStudioV2: primary,
    briefCraftStudioV2Backup: JSON.parse(JSON.stringify(primary)),
    osminogCollectorV1: {enabled: false, projectId: legacyDesk, folderId: folder.id, followDesk: true, error: ''},
    'osminogItemEdit:438-position': {token: '438-position', kind: 'objectPosition', projectId: legacyDesk,
      objectId: 'legacy438-note', at: at + 1000, order: 1, position: {x: 80, y: 90}},
    'osminogItemEdit:438-folder': {token: '438-folder', kind: 'folderPosition', projectId: legacyDesk,
      folderId: folder.id, at: at + 1000, order: 2, position: {x: 122, y: 135}},
    'osminogCapture:438-pending': {id: '438-pending', hash: 'retained-capture-hash', at: at + 2000,
      kind: 'text', value: 'legacy438-pending-needle', projectId: legacyDesk, folderId: folder.id},
    osminogTrashIndex: {[trashDesk]: {at: at + 3000}},
    [`osminogTrashProject:${trashDesk}`]: {id: trashDesk, name: 'Retained trash', created: at, updated: at,
      objects: [{id: 'legacy438-trash-item', type: 'brief', text: 'Retained deleted material', customTrashField: ['keep'],
        x: 0, y: 0, w: 200, h: 150}]},
    [`briefCraftGptThreads:${legacyDesk}`]: {items: [{id: 'main', name: 'Главный', provider: 'gpt', kind: 'main'}], active: 'main'},
    [`briefCraftGptLiteChat:${legacyDesk}:main`]: chat,
    [`briefCraftGptChatCleared:${legacyDesk}:main`]: {at: 0},
    lite438Unrelated: {value: 'Do not rewrite or remove unrelated extension data', unknown: [1, 2, 3]}
  };
  const protectedKeys = Object.keys(values).filter(key => key !== 'osminogCollectorV1');
  return {values, protectedKeys, longText, originalImageHash: hash(originalImage), originalFileHash: hash(originalFile), folder, chat};
}
const fixture = legacyFixture();

function observePage(page) {
  page.on('pageerror', error => errors.push({url: page.url(), message: error.message}));
  page.on('crash', () => crashes.push({url: page.url(), at: Date.now()}));
  page.on('console', message => {
    if (/OSMINOG preview worker:/.test(message.text())) workerErrors.push({url: page.url(), message: message.text()});
  });
}
async function ready(page) {
  await page.waitForFunction(() => !!globalThis.OSMINOGCoreApp?.ready && (!document.querySelector('#startupStatus') ||
    !document.querySelector('#startupStatus').getBoundingClientRect().height ||
    document.querySelector('#startupStatus').hidden), null, {timeout: 90000});
  await page.evaluate(() => OSMINOGCoreApp.ready);
}
async function openEditor() {
  const page = await context.newPage();
  await page.goto(origin + '/editor.html'); await ready(page); return page;
}
async function protectedDigest() {
  return monitor.evaluate(async keys => {
    const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
    const values = await chrome.storage.local.get(keys);
    const bytes = new TextEncoder().encode(JSON.stringify(sort(values)));
    return {sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join(''), bytes: bytes.length};
  }, fixture.protectedKeys);
}

async function migrationAssertions() {
  const saved = await editor.evaluate(async ({legacyDesk, stressDesk, trashDesk}) => {
    const store = OSMINOGCoreStore, desk = await store.getDesk(legacyDesk), stress = await store.getDesk(stressDesk);
    const note = await store.getItem('legacy438-note'), image = await store.getItem('legacy438-image');
    const file = await store.getItem('legacy438-file'), unknown = await store.getItem('legacy438-unknown');
    const parse = async id => JSON.parse(await (await store.getBlob(id)).text());
    const hashBlob = async id => {
      const blob = await store.getBlob(id);
      return {size: blob.size, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')};
    };
    let count = 0;
    for (let offset = 0;; offset += 200) { const page = await store.listItems(stressDesk, {offset, limit: 200}); count += page.length; if (page.length < 200) break; }
    return {stats: await store.stats(), desk, stress: {folders: stress.folders, count},
      note, noteDetail: await parse(note.detailBlobId), deskDetail: await parse(desk.detailBlobId),
      image, imageBytes: await hashBlob(image.assetId), fileBytes: await hashBlob(file.assetId),
      unknown, unknownDetail: await parse(unknown.detailBlobId), trash: await store.getDesk(trashDesk),
      trashItem: await store.getItem('legacy438-trash-item'),
      listedDesks: (await store.desks()).map(item => item.id), pendingCapture: await store.getItem('capture-438-pending'),
      tailSearch: (await store.search('legacy438-tail-needle')).map(item => item.id),
      ocrSearch: (await store.search('legacy438-ocr-needle')).map(item => item.id)};
  }, {legacyDesk, stressDesk, trashDesk});
  assert.equal(saved.stats.migration.status, 'done');
  assert.equal(saved.stress.count, stressItemCount); assert.equal(saved.stress.folders.length, 60);
  assert(saved.stress.folders.every(folder => folder.members.length === 36));
  assert.equal(saved.note.text, fixture.longText); assert.equal(saved.note.x, 80); assert.equal(saved.note.y, 90);
  assert.deepEqual(saved.noteDetail.unusualProperty, {list: [1, null, {deep: 'unchanged'}]});
  assert.deepEqual(saved.deskDetail.unknownDeskProperty, {nested: {retained: true}});
  assert.equal(saved.image.folderId, fixture.folder.id, 'Membership-only legacy images must retain their folder');
  assert.equal(saved.desk.folders[0].x, 122); assert.equal(saved.desk.folders[0].y, 135);
  assert.deepEqual(saved.desk.folders[0].extraFolderProperty, fixture.folder.extraFolderProperty);
  assert.equal(saved.imageBytes.sha256, fixture.originalImageHash); assert.equal(saved.fileBytes.sha256, fixture.originalFileHash);
  assert.equal(saved.unknown.type, 'retired-special-tool');
  assert.deepEqual(saved.unknownDetail.oldToolPayload, {layers: [{id: 'keep-layer', options: {strength: .35}}]});
  assert(saved.trash.deletedAt); assert.equal(saved.trashItem.text, 'Retained deleted material');
  assert(!saved.listedDesks.includes(trashDesk), 'Soft-deleted desks must not become active desks');
  assert.equal(saved.pendingCapture.text, 'legacy438-pending-needle'); assert.equal(saved.pendingCapture.folderId, fixture.folder.id);
  assert.deepEqual(saved.tailSearch, ['legacy438-note']); assert.deepEqual(saved.ocrSearch, ['legacy438-image']);
  report.migration = {stats: saved.stats, stressItems: saved.stress.count, folders: saved.stress.folders.length,
    imageBytes: saved.imageBytes, fileBytes: saved.fileBytes, pendingCapture: saved.pendingCapture.id};
  record('native offscreen migration retains 2400 records, 60 folders, unknown fields, full text, binary bytes, pending captures and trash');
}

async function headerRects() {
  return editor.evaluate(() => {
    const rect = element => { const r = element.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom}; };
    const header = document.querySelector('#topbar');
    return {header: rect(header), buttons: Object.fromEntries(Array.from(header.querySelectorAll('button')).map(button => [button.id || button.title || button.textContent, rect(button)]))};
  });
}
function sameRects(before, after, label) {
  assert.deepEqual(Object.keys(after.buttons).sort(), Object.keys(before.buttons).sort(), `${label}: retained buttons stay in the header`);
  for (const [id, expected] of [['header', before.header], ...Object.entries(before.buttons)]) {
    const actual = id === 'header' ? after.header : after.buttons[id];
    for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(expected[key] - actual[key]) <= 1, `${label}: ${id}.${key} moved ${actual[key] - expected[key]}px`);
  }
}
async function geometryAssertions() {
  for (const viewport of [{width: 1440, height: 1000}, {width: 1024, height: 768}]) {
    await editor.setViewportSize(viewport);
    await editor.evaluate(() => ['desks', 'search', 'chat'].forEach(name => OSMINOGCoreApp.togglePanel(name, false)));
    const baseline = await headerRects();
    assert.equal(baseline.header.x, 0); assert.equal(baseline.header.y, 0);
    assert(Math.abs(baseline.header.width - viewport.width) <= 1, 'Header spans the complete viewport');
    const sequence = ['#deskToggle', '#searchToggle', '#chatToggle', '#deskToggle', '#searchToggle', '#deskToggle', '#chatToggle', '#deskToggle'];
    for (const [transition, selector] of sequence.entries()) {
      await editor.locator(selector).click();
      await editor.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      sameRects(baseline, await headerRects(), `${viewport.width}px ${selector}`);
      const layout = await editor.evaluate(() => {
        const header = document.querySelector('#topbar').getBoundingClientRect();
        const visible = element => !!(element && !element.hidden && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().height);
        const panels = ['deskPanel', 'searchPanel', 'coreChat', 'coreAccess'].map(id => document.getElementById(id)).filter(visible)
          .map(element => ({id: element.id, top: element.getBoundingClientRect().top}));
        const blocked = Array.from(document.querySelectorAll('#topbar button')).filter(button => {
          const r = button.getBoundingClientRect(); if (!r.width || !r.height) return false;
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return !hit || !button.contains(hit);
        }).map(button => button.id);
        return {bottom: header.bottom, panels, blocked};
      });
      assert.deepEqual(layout.blocked, [], 'Open panels must not cover or push header controls outside the viewport');
      for (const panel of layout.panels) assert(panel.top >= layout.bottom - 1, `${panel.id} starts under the fixed header`);
      if (transition === 2) await editor.screenshot({path: path.join(artifacts, `lite-core-438-panels-${viewport.width}.png`)});
    }
    await editor.locator('#accessButton').click();
    await editor.locator('#coreAccess').waitFor({state: 'visible'});
    sameRects(baseline, await headerRects(), `${viewport.width}px access`);
    const accessTop = await editor.locator('#coreAccess').evaluate(element => element.getBoundingClientRect().top);
    assert(accessTop >= baseline.header.bottom - 1);
    await editor.keyboard.press('Escape');
    report.geometry.push({viewport, header: baseline.header, testedPanelTransitions: sequence.length + 1});
  }
  await editor.setViewportSize({width: 1440, height: 1000});
  await editor.evaluate(() => ['desks', 'search', 'chat'].forEach(name => OSMINOGCoreApp.togglePanel(name, false)));
  record('header and every retained button keep identical rectangles through panel combinations and access at two viewport sizes');
}

async function mediaSnapshot(label) {
  const value = await editor.evaluate(label => {
    const images = Array.from(document.querySelectorAll('#canvasWorld img')).filter(image => image.currentSrc || image.src);
    const decoded = images.filter(image => image.complete && image.naturalWidth > 0);
    return {label, ...OSMINOGCoreApp.stats(), nodes: document.querySelectorAll('.canvas-item').length,
      images: images.length, decoded: decoded.length,
      liveObjectURLs: globalThis.lite438Probe.liveURLs.size,
      largestEdge: decoded.reduce((max, image) => Math.max(max, image.naturalWidth, image.naturalHeight), 0),
      decodedPixels: decoded.reduce((sum, image) => sum + image.naturalWidth * image.naturalHeight, 0),
      itemMetadataHasInlineSource: OSMINOGCoreApp.items().some(item => typeof item.src === 'string' && item.src.startsWith('data:'))};
  }, label);
  assert(value.nodes <= 160, 'Only the bounded viewport working set may have canvas nodes');
  assert(value.images <= 48 && value.imageUrls <= 48 && value.liveObjectURLs <= 48, 'At most 48 live thumbnail URLs/images are retained');
  assert(value.largestEdge <= 512, 'Rendered images must use thumbnails, not full-resolution legacy sources');
  assert(value.decodedPixels <= 48 * 512 * 512, 'Live rendered thumbnail pixels must fit the explicit media budget');
  assert.equal(value.itemMetadataHasInlineSource, false, 'Canvas metadata must not hold legacy base64 sources');
  report.media.push(value); return value;
}

async function canvasAssertions() {
  await editor.evaluate(id => OSMINOGCoreApp.openDesk(id), stressDesk);
  await editor.waitForFunction(count => OSMINOGCoreApp.items().length === count, stressItemCount);
  await editor.waitForFunction(() => Array.from(document.querySelectorAll('#canvasWorld img')).filter(image => image.complete && image.naturalWidth).length >= 12,
    null, {timeout: 30000});
  const initial = await mediaSnapshot('dense image viewport');
  assert(initial.decoded >= 12, 'The stress case must actually decode distinct visible sources');
  const distinctAssets = await editor.evaluate(() => new Set(OSMINOGCoreApp.items().filter(item => item.type === 'image').map(item => item.assetId)).size);
  assert.equal(distinctAssets, sourceImageCount);
  const canvasBox = await editor.locator('#canvas').boundingBox();
  await editor.evaluate(() => {
    const probe = lite438Probe; probe.phase = 'interaction'; probe.frames = []; probe.measuring = true; probe.previousFrame = null;
    const frame = time => { if (!probe.measuring) return; if (probe.previousFrame !== null) probe.frames.push(time - probe.previousFrame); probe.previousFrame = time; requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  for (let cycle = 0; cycle < 5; cycle++) {
    await editor.keyboard.down('Space');
    await editor.mouse.move(canvasBox.x + canvasBox.width * .7, canvasBox.y + canvasBox.height * .7);
    await editor.mouse.down();
    await editor.mouse.move(canvasBox.x + canvasBox.width * .7 - 360, canvasBox.y + canvasBox.height * .7 - 180, {steps: 18});
    await editor.mouse.up(); await editor.keyboard.up('Space');
    await mediaSnapshot(`pan ${cycle + 1}`);
    await editor.evaluate(id => OSMINOGCoreApp.focusItem(id), `stress438-item-${2399 - cycle}`);
    await editor.locator(`.canvas-item[data-id="stress438-item-${2399 - cycle}"]`).waitFor({state: 'visible'});
    await mediaSnapshot(`far item ${cycle + 1}`);
    await editor.evaluate(() => OSMINOGCoreApp.focusItem('stress438-item-0'));
    await editor.locator('.canvas-item[data-id="stress438-item-0"]').waitFor({state: 'visible'});
  }
  await editor.waitForFunction(() => Array.from(document.querySelectorAll('#canvasWorld img')).filter(image => image.complete && image.naturalWidth).length === 48,
    null, {timeout: 30000});
  await mediaSnapshot('dense viewport after repeated cycles');
  const timing = await editor.evaluate(() => {
    lite438Probe.measuring = false;
    const frames = [...lite438Probe.frames].sort((a, b) => a - b);
    const tasks = lite438Probe.longTasks.filter(task => task.phase === 'interaction');
    lite438Probe.phase = 'idle';
    return {frameSamples: frames.length, p95FrameMs: frames[Math.floor(frames.length * .95)] || 0,
      maxFrameMs: frames.at(-1) || 0, maxLongTaskMs: Math.max(0, ...tasks.map(task => task.duration)), longTaskCount: tasks.length};
  });
  assert(timing.frameSamples >= 10, 'Responsiveness measurements must contain real animation frames');
  assert(timing.p95FrameMs < 150, '95% of observed interaction frames must be shorter than 150 ms on this runner');
  assert(timing.maxLongTaskMs < 1000, 'Canvas interactions must not block the main thread for a second');
  report.timings.interaction = timing;
  await editor.evaluate(id => OSMINOGCoreApp.openDesk(id), legacyDesk);
  await editor.evaluate(() => OSMINOGCoreApp.focusItem('legacy438-note'));
  const note = editor.locator('.canvas-item[data-id="legacy438-note"]');
  await note.waitFor({state: 'visible'});
  const before = await editor.evaluate(() => OSMINOGCoreStore.getItem('legacy438-note'));
  await editor.evaluate(() => { lite438Probe.idbWrites = []; });
  const box = await note.boundingBox();
  await editor.mouse.move(box.x + 20, box.y + 20); await editor.mouse.down();
  await editor.mouse.move(box.x + 110, box.y + 85, {steps: 24});
  const during = await editor.evaluate(() => lite438Probe.idbWrites.filter(write => write.store === 'items'));
  assert.equal(during.length, 0, 'Pointer movement must not persist a full item on every event');
  await editor.mouse.up();
  await editor.waitForFunction(async ({x, y}) => { const item = await OSMINOGCoreStore.getItem('legacy438-note'); return item.x !== x && item.y !== y; }, {x: before.x, y: before.y});
  const moved = await editor.evaluate(() => OSMINOGCoreStore.getItem('legacy438-note'));
  const after = await editor.evaluate(() => lite438Probe.idbWrites.filter(write => write.store === 'items'));
  assert.equal(after.length, 1, 'One completed drag commits one item metadata change');
  const panBox = await editor.locator('#canvas').boundingBox();
  const viewBefore = await editor.evaluate(() => OSMINOGCoreApp.view());
  await editor.mouse.move(panBox.x + panBox.width - 40, panBox.y + panBox.height - 40);
  await editor.mouse.wheel(140, 110);
  await editor.waitForFunction(async ({id, previous}) => {
    const view = OSMINOGCoreApp.view(), saved = (await OSMINOGCoreStore.getDesk(id)).view;
    return (view.x !== previous.x || view.y !== previous.y) && !!saved && Math.abs(view.x - saved.x) < .01 && Math.abs(view.y - saved.y) < .01;
  }, {id: legacyDesk, previous: viewBefore});
  const persistedView = await editor.evaluate(() => OSMINOGCoreApp.view());
  assert(persistedView.x !== viewBefore.x || persistedView.y !== viewBefore.y, 'Wheel input must pan the canvas');
  await editor.reload(); await ready(editor);
  await editor.evaluate(id => OSMINOGCoreApp.openDesk(id), legacyDesk);
  const reloaded = await editor.evaluate(async () => ({item: await OSMINOGCoreStore.getItem('legacy438-note'), view: OSMINOGCoreApp.view()}));
  assert.equal(reloaded.item.x, moved.x); assert.equal(reloaded.item.y, moved.y);
  assert.equal(reloaded.item.text, fixture.longText);
  for (const key of ['x', 'y', 'scale']) assert(Math.abs(reloaded.view[key] - persistedView[key]) < .01, `Reload retains view.${key}`);
  record('2400-item canvas keeps bounded DOM/media, responds during pan/focus cycles, and persists one drag plus the viewport across reload');
}

async function searchAndChatAssertions() {
  await editor.locator('#searchToggle').click();
  await editor.locator('#searchInput').fill('legacy438-ocr-needle');
  await editor.waitForFunction(() => document.querySelectorAll('#searchResults .search-result').length === 1);
  await editor.locator('#searchResults .search-result').click();
  await editor.locator('#itemDialog').waitFor({state: 'visible'});
  await editor.locator('#placeItem').click();
  await editor.locator('.canvas-item[data-id="legacy438-image"]').waitFor({state: 'visible'});
  await editor.evaluate(() => OSMINOGCoreApp.togglePanel('search', true));
  await editor.locator('#searchInput').fill('stress438-last-needle');
  await editor.waitForFunction(() => document.querySelectorAll('#searchResults .search-result').length === 1 && document.querySelector('#searchResults').textContent.includes('2399'));
  await editor.locator('#searchResults .search-result').click();
  await editor.locator('#itemDialog').waitFor({state: 'visible'});
  await editor.locator('#placeItem').click();
  await editor.waitForFunction(id => OSMINOGCoreApp.getDeskId() === id, stressDesk);
  await editor.locator('.canvas-item[data-id="stress438-item-2399"]').waitFor({state: 'visible'});
  await editor.evaluate(() => OSMINOGCoreApp.togglePanel('search', true));
  await editor.locator('#searchInput').fill('stress438');
  await editor.waitForFunction(() => document.querySelectorAll('#searchResults .search-result').length >= 20);
  const resultCount = await editor.locator('#searchResults .search-result').count();
  assert(resultCount <= 200, 'Large search results must remain paged/bounded');
  await editor.evaluate(async id => { OSMINOGCoreApp.togglePanel('search', false); await OSMINOGCoreApp.openDesk(id); OSMINOGCoreApp.togglePanel('chat', true); }, legacyDesk);
  await editor.waitForFunction(() => document.querySelector('#coreChat')?.textContent.includes('Retained conversation 122'));
  const chatBefore = await editor.locator('#coreChat .core-chat-message').count();
  assert(chatBefore > 0 && chatBefore <= 40, 'Chat history renders a bounded message window');
  const storedHistory = await editor.evaluate(async ({scope, last}) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('osminog-core-chat-v1', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = (name, key) => new Promise((resolve, reject) => { const store = db.transaction(name, 'readonly').objectStore(name);
      const request = key === undefined ? store.getAll() : store.get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { const [messages, firstBody, lastBody] = await Promise.all([read('messages'), read('bodies', [scope, 'main', 0]), read('bodies', [scope, 'main', last])]);
      return {messages, firstBody, lastBody}; }
    finally { db.close(); }
  }, {scope: legacyDesk, last: fixture.chat.length - 1});
  assert.equal(storedHistory.messages.filter(message => /^legacy438-chat-/.test(message.id || '')).length, fixture.chat.length,
    'Paging must not discard older imported chat messages');
  assert.deepEqual(storedHistory.firstBody, fixture.chat[0]); assert.deepEqual(storedHistory.lastBody, fixture.chat.at(-1));
  await editor.reload(); await ready(editor);
  await editor.evaluate(async id => { await OSMINOGCoreApp.openDesk(id); OSMINOGCoreApp.togglePanel('chat', true); }, legacyDesk);
  await editor.waitForFunction(() => document.querySelector('#coreChat')?.textContent.includes('Retained conversation 122'));
  assert((await editor.locator('#coreChat .core-chat-message').count()) <= 40);
  report.searchAndChat = {boundedResults: resultCount, renderedMessages: chatBefore, importedMessages: fixture.chat.length};
  record('actual search finds retained OCR/full records across desks and chat history survives migration/reload with bounded message DOM');
}

async function clipboardAssertions() {
  const text = `native438-clipboard-${Date.now()}`, baseline = `native438-baseline-${Date.now()}`;
  await monitor.bringToFront(); await monitor.locator('#focus').click();
  await monitor.evaluate(value => navigator.clipboard.writeText(value), baseline);
  const configured = await editor.evaluate(async id => chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CONFIGURE', patch: {enabled: true, projectId: id, folderId: null}}), legacyDesk);
  assert(configured && configured.ok !== false, 'The actual editor must enable the background collector');
  await editor.evaluate(async ({stressDesk, legacyDesk}) => {
    await OSMINOGCoreApp.openDesk(stressDesk);
    const changed = (await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1;
    if (!changed.enabled || changed.projectId !== stressDesk || changed.folderId !== null) throw Error('Active collection did not follow the selected desk');
    await OSMINOGCoreApp.openDesk(legacyDesk);
  }, {stressDesk, legacyDesk});
  await delay(2200); // Native offscreen polling must first observe the current clipboard baseline.
  await editor.close(); editor = null;
  await monitor.bringToFront(); await monitor.locator('#focus').click();
  const beforeStats = await monitor.evaluate(() => OSMINOGCoreStore.stats());
  const began = Date.now();
  await monitor.evaluate(value => navigator.clipboard.writeText(value), text);
  await monitor.waitForFunction(async ({text, id}) => (await OSMINOGCoreStore.search(text, {deskId: id})).length === 1,
    {text, id: legacyDesk}, {timeout: 20000});
  await monitor.evaluate(value => navigator.clipboard.writeText(value), text);
  await delay(2000);
  const capturedText = await monitor.evaluate(async ({text, baseline, id}) => ({
    matches: await OSMINOGCoreStore.search(text, {deskId: id}), baseline: await OSMINOGCoreStore.search(baseline, {deskId: id})
  }), {text, baseline, id: legacyDesk});
  assert.equal(capturedText.matches.length, 1); assert.equal(capturedText.baseline.length, 0);
  assert(capturedText.matches[0].captureId, 'Text must come through the native collector commit path');
  const expectedPixels = await monitor.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#193d7a'; ctx.fillRect(0, 0, 80, 60);
    ctx.fillStyle = '#f7aa31'; ctx.fillRect(17, 11, 29, 35);
    const bytes = ctx.getImageData(0, 0, 80, 60).data;
    const pixelHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    return {width: 80, height: 60, pixelHash};
  });
  await monitor.waitForFunction(async ({id, began}) => (await OSMINOGCoreStore.listItems(id, {limit: 200}))
    .some(item => item.type === 'image' && item.captureId && item.capturedAt >= began), {id: legacyDesk, began}, {timeout: 20000});
  const capturedImage = await monitor.evaluate(async ({id, began}) => {
    const item = (await OSMINOGCoreStore.listItems(id, {limit: 200})).find(item => item.type === 'image' && item.captureId && item.capturedAt >= began);
    const blob = await OSMINOGCoreStore.getBlob(item.assetId), bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return {id: item.id, deskId: item.deskId, folderId: item.folderId, size: blob.size,
      width: canvas.width, height: canvas.height,
      pixelHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')};
  }, {id: legacyDesk, began});
  assert.equal(capturedImage.pixelHash, expectedPixels.pixelHash); assert.equal(capturedImage.width, expectedPixels.width);
  assert.equal(capturedImage.height, expectedPixels.height); assert.equal(capturedImage.deskId, legacyDesk); assert.equal(capturedImage.folderId, null);
  const afterStats = await monitor.evaluate(() => OSMINOGCoreStore.stats());
  assert.equal(afterStats.captures - beforeStats.captures, 2, 'One text and one image produce exactly two durable captures');
  editor = await openEditor(); await editor.evaluate(id => OSMINOGCoreApp.openDesk(id), legacyDesk);
  await editor.locator('#captureToggle').click();
  await monitor.waitForFunction(async () => !(await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1?.enabled);
  const paused = `native438-paused-${Date.now()}`;
  await monitor.bringToFront(); await monitor.locator('#focus').click();
  await monitor.evaluate(value => navigator.clipboard.writeText(value), paused); await delay(2200);
  assert.equal(await monitor.evaluate(async text => (await OSMINOGCoreStore.search(text)).length, paused), 0);
  report.clipboard = {systemClipboardExercised: true, offscreenPasteExercised: true, editorClosedDuringCapture: true,
    captureId: capturedText.matches[0].id, image: capturedImage, duplicateTextCount: capturedText.matches.length, baselineSkipped: true, pauseVerified: true};
  record('real offscreen clipboard text/image capture works with the editor closed, deduplicates, preserves pixels and stops when paused');
}

async function main() {
  fs.mkdirSync(artifacts, {recursive: true});
  const runtimeFiles = JSON.parse(fs.readFileSync(path.join(root, 'tools/release-files-core.json'), 'utf8'));
  assert.equal(new Set(runtimeFiles).size, runtimeFiles.length);
  for (const name of runtimeFiles) {
    assert(!path.isAbsolute(name) && !name.split('/').includes('..'));
    fs.mkdirSync(path.dirname(path.join(installed, name)), {recursive: true});
    fs.copyFileSync(path.join(root, name), path.join(installed, name));
  }
  fs.mkdirSync(path.join(installed, 'tests'), {recursive: true});
  fs.copyFileSync(path.join(__dirname, 'lite-fixture.html'), path.join(installed, 'tests/lite-fixture.html'));
  report.runtime = {files: runtimeFiles.length, allowlistSha256: hash(fs.readFileSync(path.join(root, 'tools/release-files-core.json'))),
    fixtureFiles: ['tests/lite-fixture.html']};
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: process.env.TEST_HEADLESS === '1', viewport: {width: 1440, height: 1000},
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-dev-shm-usage', `--disable-extensions-except=${installed}`, `--load-extension=${installed}`]
  });
  report.chromiumVersion = context.browser()?.version() || null;
  context.on('close', () => { if (!closing) contextClosed = true; });
  context.on('page', observePage); context.pages().forEach(observePage);
  await context.route(/^https?:\/\//, route => route.abort());
  await context.addInitScript(() => {
    const probe = globalThis.lite438Probe = {phase: 'startup', longTasks: [], idbWrites: [], liveURLs: new Set(), frames: []};
    if (globalThis.PerformanceObserver) {
      try { new PerformanceObserver(list => list.getEntries().forEach(entry => probe.longTasks.push({phase: probe.phase, duration: entry.duration})))
        .observe({type: 'longtask', buffered: true}); } catch {}
    }
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (['items', 'desks'].includes(this.name)) probe.idbWrites.push({store: this.name, id: args[0]?.id, at: performance.now()});
      return Reflect.apply(put, this, args);
    };
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    URL.createObjectURL = function (...args) { const url = Reflect.apply(create, this, args); probe.liveURLs.add(url); return url; };
    URL.revokeObjectURL = function (url) { probe.liveURLs.delete(url); return Reflect.apply(revoke, this, [url]); };
  });
  await (context.serviceWorkers()[0] || context.waitForEvent('serviceworker'));
  monitor = await context.newPage(); await monitor.goto(origin + '/tests/lite-fixture.html');
  const workerMonitor = await context.newCDPSession(monitor);
  workerMonitor.on('ServiceWorker.workerErrorReported', event => workerErrors.push({kind: 'service-worker', ...event}));
  await workerMonitor.send('ServiceWorker.enable');
  await monitor.addScriptTag({url: origin + '/osminog-core-store.js'});
  await monitor.evaluate(() => {
    globalThis.lite438StorageEvents = [];
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [key, change] of Object.entries(changes)) lite438StorageEvents.push({key,
        bytes: change.newValue === undefined ? 0 : new TextEncoder().encode(JSON.stringify(change.newValue)).length,
        removed: change.newValue === undefined, at: Date.now()});
    });
  });
  await monitor.evaluate(values => chrome.storage.local.set(values), fixture.values);
  await monitor.waitForFunction(() => lite438StorageEvents.some(event => event.key === 'briefCraftStudioV2'));
  await monitor.evaluate(() => { lite438StorageEvents = []; });
  const originalDigest = await protectedDigest(); report.legacySource = originalDigest;
  const began = Date.now(); editor = await openEditor(); report.timings.startupMs = Date.now() - began;
  const loaded = await editor.evaluate(() => Array.from(document.scripts).map(script => new URL(script.src || location.href).pathname));
  for (const path of loaded) assert(!/(?:^|\/)(?:gpt-presence|bridge|osminog-library|osminog-windows-folders|osminog-graphics-studio|osminog-photo-editor|fabric\.min|tesseract)[^/]*\.js$/.test(path),
    'The removed monolithic tools must not execute in the Lite shell: ' + path);
  report.loadedScripts = loaded;
  await migrationAssertions();
  await geometryAssertions();
  await canvasAssertions();
  await searchAndChatAssertions();
  await clipboardAssertions();
  assert.deepEqual(await protectedDigest(), originalDigest, 'Migration and normal use must leave every legacy source key byte-equivalent');
  const storageEvents = await monitor.evaluate(() => lite438StorageEvents);
  const protectedWrites = storageEvents.filter(event => fixture.protectedKeys.includes(event.key) || /^(briefCraftStudio|osminogItemEdit:|osminogCapture:|osminogTrashProject:)/.test(event.key));
  assert.deepEqual(protectedWrites, [], 'Normal canvas, search, chat and capture must not rewrite legacy workspace snapshots or serialized capture queues');
  assert(storageEvents.every(event => event.bytes < 64 * 1024), 'Chrome storage writes stay bounded to small configuration/status values');
  report.storage = {writes: storageEvents, maxValueBytes: Math.max(0, ...storageEvents.map(event => event.bytes)), legacySourceUnchanged: true};
  record('migration and interaction leave original snapshots untouched and never send whole-workspace or image values through chrome.storage');
  assert.equal(contextClosed, false); assert.deepEqual(crashes, []); assert.deepEqual(errors, []); assert.deepEqual(workerErrors, []);
  assert.equal(await monitor.locator('#draft').inputValue(), 'Keep this unsaved text.');
  await editor.bringToFront(); await editor.screenshot({path: path.join(artifacts, 'lite-core-438.png')});
  record('browser, unrelated unsaved page and extension remain alive without unhandled page errors');
}

main().then(() => { report.ok = true; }).catch(async error => {
  report.ok = false; report.error = error.stack || error.message;
  if (editor && !editor.isClosed()) {
    await editor.screenshot({path: path.join(artifacts, 'lite-core-438-failure.png')}).catch(() => {});
    report.lastEditorState = await editor.evaluate(async () => ({url: location.href, startup: document.querySelector('#startupStatus')?.textContent,
      app: globalThis.OSMINOGCoreApp?.stats?.(), store: await globalThis.OSMINOGCoreStore?.stats?.(), body: document.body.innerText.slice(0, 4000)})).catch(error => ({error: error.message}));
  }
  if (monitor && !monitor.isClosed()) report.storageEvents = await monitor.evaluate(() => globalThis.lite438StorageEvents).catch(() => null);
  console.error('LITE_CORE_DIAGNOSTICS', JSON.stringify(report)); process.exitCode = 1;
}).finally(async () => {
  fs.mkdirSync(artifacts, {recursive: true}); fs.writeFileSync(path.join(artifacts, 'lite-core-438-results.json'), JSON.stringify(report, null, 2) + '\n');
  closing = true; await context?.close().catch(error => { console.error('Browser cleanup failed:', error.message); process.exitCode = 1; });
  await fs.promises.rm(temp, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
});
