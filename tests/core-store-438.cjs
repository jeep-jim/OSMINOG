/* Real IndexedDB and Web Locks. Legacy storage is a read-only fixture because
 * the end-to-end extension test separately exercises Chrome's real storage. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'osminog-core-store.js'));
const sha = value => createHash('sha256').update(value).digest('hex');
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000030806000000', 'hex');
const binary = Buffer.from(Array.from({length: 65537}, (_, i) => i % 256));
const longText = 'Текст заметки '.repeat(2200) + 'TAIL_NEEDLE';
const legacy = {
  briefCraftStudioV2: {activeProject: 'desk', theme: 'dark', projects: [{
    id: 'desk', name: 'Сохранённый стол', view: {x: 17, y: 19, scale: 0.8}, sharing: {token: 'local-token'},
    osminogFolders: [{id: 'folder', name: 'Источники', members: ['image'], screenX: 3, screenY: 5}],
    osminogDesktops: [{id: 'main', name: 'Главный'}, {id: 'side', name: 'Второй'}], activeDesktop: 'side',
    connections: [{id: 'line', from: 'note', to: 'image', label: 'Связь'}],
    savedItemEdits: {already: true},
    objects: [
      {id: 'note', type: 'brief', text: longText, name: 'Заметка', x: 20, y: 30, w: 300, h: 200, custom: {retained: 'yes'}},
      {id: 'image', type: 'image', name: 'Снимок', src: 'data:image/png;base64,' + png.toString('base64'), osminogDesktopId: 'side', searchIndex: {text: 'OLD_OCR_WORD'}, x: 40, y: 50},
      {id: 'binary', type: 'file', fileName: 'original.bin', mime: 'application/octet-stream', src: 'data:application/octet-stream;base64,' + binary.toString('base64')},
      {id: 'custom-capture', captureId: 'duplicate', type: 'brief', text: 'Only one capture', capturedAt: 1700000000000},
      {id: 'unknown', type: 'legacy-special', sourceExtension: {kind: 'old-module'}, widgetData: {value: 7}, x: 1, y: 2}
    ]
  }]},
  briefCraftStudioV2Backup: {projects: [{id: 'old-backup-only', objects: [{id: 'must-not-return', text: 'deleted'}]}]},
  osminogTrashIndex: {trashed: {expires: 1}, purged: {purged: true}},
  'osminogTrashProject:trashed': {id: 'trashed', name: 'Корзина', objects: [{id: 'trash-item', type: 'brief', text: 'hidden_trash_needle'}]},
  'osminogItemEdit:position-new': {token: 'position-new', projectId: 'desk', kind: 'objectPosition', objectId: 'note', at: 200, order: 3, position: {x: 100, y: 101}},
  'osminogItemEdit:position-old': {token: 'position-old', projectId: 'desk', kind: 'objectPosition', objectId: 'note', at: 100, order: 1, position: {x: 60, y: 61}},
  'osminogItemEdit:folder': {token: 'folder', projectId: 'desk', kind: 'position', folderId: 'folder', at: 200, order: 2, position: {screenX: 70, screenY: 71}},
  'osminogItemEdit:already': {token: 'already', projectId: 'desk', kind: 'capture', object: {id: 'deleted-capture', captureId: 'deleted', type: 'brief', text: 'Must not resurrect'}},
  'osminogItemEdit:new-capture': {token: 'new-capture', projectId: 'desk', kind: 'capture', object: {id: 'journal-capture', captureId: 'journal', type: 'brief', text: 'Journal survives'}},
  'osminogCapture:queued': {id: 'queued', projectId: 'desk', folderId: 'folder', kind: 'text', value: 'Pending queue survives', at: 1700000000010},
  'osminogCapture:duplicate': {id: 'duplicate', projectId: 'desk', kind: 'text', value: 'Only one capture', at: 1700000000000}
};
let browser;
const server = http.createServer((req, res) => {
  if (req.url === '/store.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(source); }
  res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Core store test</title><script src="/store.js"></script>');
});
async function fixture(data) {
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.evaluate(data => {
    window.legacyFixture = data; window.legacyBefore = JSON.stringify(data); window.legacyReads = [];
    window.options = {migrate: true,
      legacyReader: async keys => { window.legacyReads.push(...keys); return Object.fromEntries(keys.map(key => [key, structuredClone(window.legacyFixture[key])])); },
      legacyKeys: async () => Object.keys(window.legacyFixture)};
  }, data);
  return {page, close: () => context.close()};
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless: true, ...(process.env.TEST_CHROMIUM ? {executablePath: process.env.TEST_CHROMIUM} : {}), args: ['--no-sandbox']});
  {
    const f = await fixture(legacy), {page} = f;
    const migration = await page.evaluate(() => OSMINOGCoreStore.init(options));
    assert.equal(migration.status, 'done');
    const migrated = await page.evaluate(async () => {
      const S = OSMINOGCoreStore, list = await S.listItems('desk', {limit: 500}), image = list.find(item => item.id === 'image');
      const hash = async id => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await (await S.getBlob(id)).arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
      return {desks: await S.desks(), allDesks: await S.desks({includeDeleted: true}), list, note: await S.getItem('note'),
        unknown: JSON.parse(await (await S.getBlob((await S.getMetadata('unknown')).detailBlobId)).text()),
        png: await hash(image.assetId), binary: await hash((await S.getMetadata('binary')).assetId),
        ocr: (await S.search('old_ocr_word')).map(item => item.id), long: (await S.search('tail_needle')).map(item => item.id),
        emptyGlobal: (await S.search('')).map(item => item.id), trashSearch: await S.search('hidden_trash_needle'),
        deletedCapture: await S.getMetadata('deleted-capture'), legacyUnchanged: JSON.stringify(legacyFixture) === legacyBefore, reads: legacyReads};
    });
    assert.deepEqual(migrated.desks.map(desk => desk.id), ['desk']);
    assert.equal(migrated.allDesks.find(desk => desk.id === 'trashed').deletedAt > 0, true);
    assert.equal(migrated.desks[0].folders[0].screenX, 70);
    assert.equal(migrated.desks[0].chatProjectId, 'desk');
    assert.equal(migrated.desks[0].desktops[1].id, 'side');
    assert.equal(migrated.desks[0].connections[0].from, 'note');
    assert.equal(migrated.list.length, 7);
    assert.equal(migrated.list.find(item => item.id === 'image').folderId, 'folder');
    assert.equal(migrated.list.find(item => item.id === 'image').desktopId, 'side');
    assert.equal(migrated.list.find(item => item.id === 'note').text.length, 4096);
    assert.equal(migrated.note.text, longText); assert.equal(migrated.note.x, 100); assert.equal(migrated.note.y, 101);
    assert.equal(migrated.png, sha(png)); assert.equal(migrated.binary, sha(binary));
    assert.deepEqual(migrated.unknown.widgetData, {value: 7});
    assert.deepEqual(migrated.ocr, ['image']); assert.deepEqual(migrated.long, ['note']);
    assert.equal(migrated.emptyGlobal.includes('trash-item'), false); assert.deepEqual(migrated.trashSearch, []);
    assert.equal(migrated.deletedCapture, undefined); assert.equal(migrated.legacyUnchanged, true);
    assert.equal(migrated.reads.includes('briefCraftStudioV2Backup'), false);
    assert.equal(migrated.list.some(item => Object.values(item).some(value => typeof value === 'string' && value.startsWith('data:'))), false);
    console.log('PASS native IDB migration preserves binary bytes, full text, OCR index, folders, desktops, links, journal and queue; respects trash and valid primary');
    const writes = await page.evaluate(async () => {
      const writes = [], put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, key) { writes.push({store: this.name, id: value?.id || key}); return put.call(this, value, ...(arguments.length > 1 ? [key] : [])); };
      try { await OSMINOGCoreStore.patchItem('note', {x: 999, y: 888}); }
      finally { IDBObjectStore.prototype.put = put; }
      return writes;
    });
    assert.deepEqual(writes.filter(write => write.store !== 'meta'), [{store: 'items', id: 'note'}]);
    const soft = await page.evaluate(async () => {
      const S = OSMINOGCoreStore; await S.deleteItem('note'); const reads = legacyReads.length; await S.init(options);
      return {deleted: (await S.getMetadata('note')).deletedAt, matches: await S.search('tail_needle'), extraReads: legacyReads.length - reads,
        legacyUnchanged: JSON.stringify(legacyFixture) === legacyBefore, dataStillAvailable: (await S.getItem('note')).text};
    });
    assert(soft.deleted > 0); assert.deepEqual(soft.matches, []); assert.equal(soft.extraReads, 0); assert(soft.legacyUnchanged); assert.equal(soft.dataStillAvailable, longText);
    console.log('PASS a move writes one small item, never media/search/full snapshots; soft deletion and repeated init retain original data');
    const pageResult = await page.evaluate(async () => {
      const S = OSMINOGCoreStore;
      const first = await S.listItems('desk', {includeDeleted: true, offset: 0, limit: 3});
      const second = await S.listItems('desk', {includeDeleted: true, offset: 3, limit: 3});
      const all = await S.listItems('desk', {includeDeleted: true, limit: 500});
      const a = await S.capture({id: 'capture-live-a', captureId: 'live-a', deskId: 'desk', type: 'text', text: 'live a'});
      const retry = await S.capture({id: 'capture-live-a', captureId: 'live-a', deskId: 'desk', type: 'text', text: 'retry must not replace'});
      const b = await S.capture({id: 'capture-live-b', captureId: 'live-b', deskId: 'desk', type: 'text', text: 'live b'});
      return {first: first.map(item => item.id), second: second.map(item => item.id), all: all.map(item => item.id),
        a: a.item, b: b.item, retry: retry.item, duplicate: retry.duplicate};
    });
    assert.deepEqual(pageResult.first, pageResult.all.slice(0, 3)); assert.deepEqual(pageResult.second, pageResult.all.slice(3, 6));
    assert.equal(pageResult.duplicate, true); assert.equal(pageResult.retry.text, 'live a'); assert.notEqual(pageResult.a.x, pageResult.b.x);
    console.log('PASS fast metadata pagination and capture retry without duplicates or overlapping grid positions');
    await f.close();
  }
  {
    const f = await fixture(legacy), {page} = f;
    const failed = await page.evaluate(async () => {
      const put = IDBObjectStore.prototype.put; let once = true;
      IDBObjectStore.prototype.put = function(value, key) {
        if (once && this.name === 'items' && value.id === 'binary') { once = false; throw new DOMException('Injected disk error', 'QuotaExceededError'); }
        return put.call(this, value, ...(arguments.length > 1 ? [key] : []));
      };
      try { await OSMINOGCoreStore.init(options); return false; } catch { return true; }
      finally { IDBObjectStore.prototype.put = put; }
    });
    assert.equal(failed, true);
    const recovery = await page.evaluate(async () => {
      const S = OSMINOGCoreStore; await S.patchItem('note', {x: 777}); await S.deleteItem('image');
      const before = await S.stats(); await S.init(options);
      return {before, after: await S.stats(), note: await S.getMetadata('note'), image: await S.getMetadata('image'),
        binary: await S.getMetadata('binary'), all: await S.listItems('desk', {includeDeleted: true, limit: 500}), unchanged: JSON.stringify(legacyFixture) === legacyBefore};
    });
    assert.equal(recovery.before.migration.status, 'error'); assert.equal(recovery.after.migration.status, 'done');
    assert(recovery.image.deletedAt); assert(recovery.binary.assetId); assert.equal(recovery.all.length, 7); assert(recovery.unchanged);
    console.log('PASS interrupted migration retries without duplicate materials, lost media, legacy writes or resurrecting a soft-deleted item');
    await f.close();
  }
  for (const [primary, expected, backupRead] of [[{projects: []}, 'inbox', false], [{projects: 'broken'}, 'from-backup', true]]) {
    const f = await fixture({briefCraftStudioV2: primary, briefCraftStudioV2Backup: {projects: [{id: 'from-backup', name: 'Backup', objects: []}]}});
    const value = await f.page.evaluate(async () => { await OSMINOGCoreStore.init(options); return {desks: await OSMINOGCoreStore.desks(), reads: legacyReads}; });
    assert.equal(value.desks[0].id, expected); assert.equal(value.reads.includes('briefCraftStudioV2Backup'), backupRead); await f.close();
  }
  console.log('PASS a valid empty primary does not resurrect backup desks; only invalid primary selects backup');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
});
