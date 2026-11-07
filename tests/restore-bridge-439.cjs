/* Real IndexedDB migration, interruption and Blob-queue tests. The native
 * extension suite separately exercises the background RPC and Chrome storage. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const scripts = Object.fromEntries([
  ['core', 'osminog-core-store.js'], ['chat', 'osminog-core-chat.js'],
  ['restore', 'osminog-restore-438.js'], ['capture', 'osminog-capture-store.js']
].map(([key, file]) => ['/' + key + '.js', fs.readFileSync(path.join(root, file))]));
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000030806000000', 'hex');
const bytes = Buffer.from(Array.from({length: 100003}, (_, index) => index % 251));
const imageURL = 'data:image/png;base64,' + png.toString('base64'), fileURL = 'data:application/octet-stream;base64,' + bytes.toString('base64');
const original = {
  briefCraftStudioV2: {activeProject: 'desk', theme: 'dark', language: 'ru', customWorkspace: {kept: true}, projects: [
    {id: 'desk', name: 'Original desk', updated: 10, view: {x: 1, y: 2, scale: 1}, canvas: {grid: 'dots'},
      customTools: {module: {source: 'unchanged source', permissions: ['local']}},
      osminogFolders: [{id: 'folder', name: 'Sources', members: ['note', 'image'], screenX: 5, screenY: 6, customFolder: 27}],
      desktops: [{id: 'main', name: 'Main'}, {id: 'side', name: 'Side', unknownDesktop: true}], activeDesktop: 'main',
      connections: [{id: 'line', from: 'note', to: 'image', curvature: 0.9, description: 'preserve'}, {id: 'deleted-line', from: 'note', to: 'deleted'}],
      objects: [
        {id: 'note', type: 'note', text: 'old text', html: '<b>old text</b>', name: 'Note', x: 3, y: 4, w: 250, h: 180, custom: {nested: 17}},
        {id: 'code', type: 'code', code: 'old code', activeCodeFile: 'main', codeFiles: [{id: 'main', name: 'index.html', content: 'old code', custom: 9}, {id: 'css', name: 'style.css', content: 'keep css'}]},
        {id: 'vector', type: 'vector', pathNodes: [{x: 0, y: 0}, {x: 1, y: 1}], toolData: {gradient: ['red', 'blue']}, x: 1, y: 2},
        {id: 'image', type: 'image', src: imageURL, searchIndex: {text: 'ORIGINAL_OCR', customIndex: true}, osminogFolderId: 'folder'},
        {id: 'file', type: 'file', src: fileURL, fileName: 'exact.bin', mime: 'application/octet-stream', fileData: {unknown: 'preserved'}},
        {id: 'deleted', type: 'brief', text: 'deleted in Lite', customDeleted: 13}
      ]},
    {id: 'deleted-desk', name: 'Deleted desk', objects: [{id: 'removed-desk-object', type: 'brief', text: 'trash body', custom: 'still archived'}]}
  ]},
  briefCraftStudioV2Backup: {projects: [{id: 'backup-only', objects: [{id: 'never-resurrect', text: 'old backup'}]}]},
  'osminogCapture:queued': {id: 'queued', projectId: 'desk', folderId: 'folder', kind: 'text', value: 'queue later deleted in Lite', at: 100},
  'osminogItemEdit:old-position': {token: 'old-position', projectId: 'desk', kind: 'objectPosition', objectId: 'note', position: {x: 40, y: 41}, at: 100, order: 1},
  'briefCraftGptThreads:desk': {active: 'main', items: [{id: 'main', name: 'Main'}, {id: 'cleared', name: 'Cleared'}], unknownThreadConfig: {kept: true}},
  'briefCraftGptLiteChat:desk:main': [{id: 'old-message', role: 'user', text: 'old chat', at: 100, unknown: {kept: true}, attachments: [{previewDataUrl: imageURL, unknownFile: 7}]}, 'repeated no-id body'],
  'briefCraftGptLiteChat:desk:cleared': [{id: 'old-cleared', role: 'assistant', text: 'must remain cleared', at: 100}]
};
let browser;
const server = http.createServer((req, res) => {
  if (scripts[req.url]) { res.setHeader('Content-Type', 'text/javascript'); return res.end(scripts[req.url]); }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><title>Restore 439 tests</title>' + Object.keys(scripts).map(url => '<script src="' + url + '"></script>').join(''));
});
async function fixture() {
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.evaluate(data => {
    window.values = structuredClone(data); window.writes = []; window.reads = [];
    window.failKey = '';
    window.chrome = {storage: {local: {
      async get(keys) {
        const list = keys == null ? Object.keys(values) : typeof keys === 'string' ? [keys] : keys;
        reads.push(...list);
        return Object.fromEntries(list.filter(key => Object.hasOwn(values, key)).map(key => [key, structuredClone(values[key])]));
      },
      async set(update) {
        if (failKey && Object.hasOwn(update, failKey)) { failKey = ''; throw Error('Injected storage interruption'); }
        writes.push(...Object.keys(update)); Object.assign(values, structuredClone(update));
      },
      async getKeys() { return Object.keys(values); }
    }}, runtime: {getURL: path => 'chrome-extension://fixture/' + path}};
    window.seedLite = async () => {
      const S = OSMINOGCoreStore;
      await S.init({migrate: true, legacyReader: keys => chrome.storage.local.get(keys), legacyKeys: () => chrome.storage.local.getKeys()});
      await S.patchItem('note', {text: 'edited in 4.0.38 ' + 'long '.repeat(1800), x: 777, y: 888, folderId: null, desktopId: 'side'});
      await S.patchItem('code', {text: 'new active code'});
      await S.deleteItem('deleted'); await S.deleteItem('capture-queued');
      const desk = await S.getDesk('desk');
      await S.saveDesk({...desk, name: 'Desk from Lite', view: {x: 500, y: 600, scale: 1.25},
        folders: desk.folders.map(folder => ({...folder, screenX: 901, screenY: 902}))});
      await S.saveDesk({...await S.getDesk('deleted-desk'), deletedAt: Date.now()});
      await S.saveDesk({id: 'new-desk', name: 'New in Lite', view: {x: 70, y: 80, scale: 1}, folders: [{id: 'new-folder', name: 'New folder'}]});
      await S.putItem({id: 'new-file', deskId: 'new-desk', type: 'file', fileName: 'new.bin', folderId: 'new-folder',
        blob: new Blob([new Uint8Array([0, 255, 3, 4])], {type: 'application/octet-stream'}), x: 13, y: 14});
      const H = OSMINOGCoreChat.createHistory();
      await H.ensure('desk', 'main');
      await H.append('desk', 'main', {id: 'new-message', role: 'assistant', text: 'new chat', at: 900, attachments: [{previewDataUrl: values.briefCraftStudioV2.projects[0].objects.find(o => o.id === 'image').src, custom: 'exact'}], unknown: {field: 19}});
      await H.append('desk', 'main', 'repeated no-id body'); await H.append('desk', 'main', 'repeated no-id body');
      await H.ensure('desk', 'cleared');
      await H.append('desk', 'cleared', {id: 'after-clear', role: 'assistant', text: 'new after clear', at: 900});
      values['briefCraftGptLiteChat:desk:cleared'] = []; values['briefCraftGptChatCleared:desk:cleared'] = {at: 500};
      await H.close();
    };
    window.digestDatabase = async name => {
      const db = await OSMINOGRestore438.__test.existing(name), output = {};
      for (const name of db.objectStoreNames) {
        const tx = db.transaction(name), store = tx.objectStore(name);
        const read = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
        const [keys, rows] = await Promise.all([read(store.getAllKeys()), read(store.getAll())]);
        for (const row of rows) if (row?.blob instanceof Blob) {
          row.blob = {size: row.blob.size, type: row.blob.type, hash: await OSMINOGCaptureStore.hash(row.blob)};
        }
        output[name] = {keys, rows};
      }
      db.close(); return JSON.stringify(output);
    };
  }, original);
  return {page, close: () => context.close()};
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless: true, ...(process.env.TEST_CHROMIUM ? {executablePath: process.env.TEST_CHROMIUM} : {}), args: ['--no-sandbox']});
  {
    const f = await fixture(), page = f.page;
    const initial = await page.evaluate(async () => ({result: await OSMINOGRestore438.ready(), reads}));
    assert.equal(initial.result.status, 'not-needed'); assert.deepEqual(initial.reads, [], 'direct 4.0.37 startup must not hydrate a workspace in background');
    await page.evaluate(() => seedLite());
    const before = await page.evaluate(async () => [await digestDatabase('osminog-core-v1'), await digestDatabase('osminog-core-chat-v1')]);
    const result = await page.evaluate(async () => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(...args) {
        if (['osminog-core-v1', 'osminog-core-chat-v1'].includes(this.transaction.db.name)) throw Error('Source Core database must stay read-only');
        return put.apply(this, args);
      };
      try { return await OSMINOGRestore438.beforeLoad(); } finally { IDBObjectStore.prototype.put = put; }
    });
    assert.equal(result.status, 'done');
    const restored = await page.evaluate(async () => ({workspace: values.briefCraftStudioV2, trash: values.osminogTrashIndex,
      deletedDesk: values['osminogTrashProject:deleted-desk'], chat: values['briefCraftGptLiteChat:desk:main'], clear: values['briefCraftGptLiteChat:desk:cleared'],
      original: await OSMINOGRestore438.__test.original('briefCraftStudioV2'), backup: await OSMINOGRestore438.__test.original('briefCraftStudioV2Backup'),
      skip: await OSMINOGRestore438.skipLegacyCapture(values['osminogCapture:queued'])}));
    const desk = restored.workspace.projects.find(p => p.id === 'desk'), note = desk.objects.find(o => o.id === 'note'), code = desk.objects.find(o => o.id === 'code');
    assert.deepEqual(restored.workspace.customWorkspace, {kept: true}); assert.deepEqual(desk.customTools, original.briefCraftStudioV2.projects[0].customTools);
    assert.equal(note.type, 'note'); assert(note.text.endsWith('long ')); assert.equal(note.html, undefined); assert.equal(note.osminogRestore438OriginalHtml, '<b>old text</b>');
    assert.deepEqual(note.custom, {nested: 17}); assert.equal(note.x, 777); assert.equal(note.y, 888); assert.equal(note.osminogFolderId, undefined); assert.equal(note.osminogDesktopId, 'side');
    assert.equal(code.codeFiles[0].content, 'new active code'); assert.equal(code.codeFiles[0].custom, 9); assert.equal(code.codeFiles[1].content, 'keep css');
    assert.deepEqual(desk.objects.find(o => o.id === 'vector').toolData, {gradient: ['red', 'blue']});
    assert.equal(desk.objects.find(o => o.id === 'image').src, imageURL); assert.equal(desk.objects.find(o => o.id === 'image').searchIndex.customIndex, true);
    assert.equal(desk.objects.find(o => o.id === 'file').src, fileURL); assert.equal(desk.osminogFolders[0].customFolder, 27);
    assert.equal(desk.osminogFolders[0].screenX, 901); assert.equal(desk.osminogFolders[0].members.includes('note'), false);
    assert.equal(desk.connections.find(link => link.id === 'line').curvature, .9); assert.equal(desk.connections.some(link => link.id === 'deleted-line'), false);
    assert.equal(desk.objects.some(o => ['deleted', 'capture-queued'].includes(o.id)), false); assert.equal(restored.skip, true);
    assert.equal(desk.savedItemEdits['old-position'], true); assert.equal(restored.workspace.projects.some(p => ['deleted-desk', 'backup-only'].includes(p.id)), false);
    assert(restored.trash['deleted-desk']); assert.equal(restored.deletedDesk.objects[0].custom, 'still archived');
    const added = restored.workspace.projects.find(p => p.id === 'new-desk').objects[0];
    assert.equal(added.fileName, 'new.bin'); assert.equal(added.osminogFolderId, 'new-folder');
    assert.deepEqual(Buffer.from(added.src.split(',')[1], 'base64'), Buffer.from([0, 255, 3, 4]));
    assert.equal(restored.chat.filter(value => value === 'repeated no-id body').length, 3, 'equal no-id messages keep their multiplicity');
    assert.equal(restored.chat.find(value => value?.id === 'new-message').attachments[0].previewDataUrl, imageURL);
    assert.deepEqual(restored.chat.find(value => value?.id === 'new-message').unknown, {field: 19});
    assert.deepEqual(restored.clear.map(value => value.id), ['after-clear']);
    assert.deepEqual(restored.original.value, original.briefCraftStudioV2); assert.deepEqual(restored.backup.value, original.briefCraftStudioV2Backup);
    assert.deepEqual(await page.evaluate(async () => [await digestDatabase('osminog-core-v1'), await digestDatabase('osminog-core-chat-v1')]), before);
    console.log('PASS native bridge restores Lite edits, media, new desks, code, folders, unknown properties, exact chat bodies and deletions without writing Core sources');
    const retry = await page.evaluate(async data => {
      const beforeWrites = writes.length; await OSMINOGRestore438.beforeLoad();
      const idempotent = beforeWrites === writes.length;
      const stale = {projects: structuredClone(data.briefCraftStudioV2.projects), activeProject: 'desk'};
      const first = await OSMINOGRestore438.afterLoad(stale), p = stale.projects.find(p => p.id === 'desk');
      p.objects.find(o => o.id === 'note').text = 'new full-UI edit'; p.view = {x: 99, y: 98, scale: .75};
      const second = await OSMINOGRestore438.afterLoad(stale);
      return {idempotent, first, second, text: p.objects.find(o => o.id === 'note').text, view: p.view};
    }, original);
    assert.equal(retry.idempotent, true); assert.equal(retry.first.changed, true); assert.equal(retry.second.changed, false);
    assert.equal(retry.text, 'new full-UI edit'); assert.equal(retry.view.x, 99);
    const queue = await page.evaluate(async () => {
      const Q = OSMINOGCaptureStore, todayBase = {day: new Date().toLocaleDateString('en-CA'), count: 7};
      await Q.put({id: 'text', kind: 'text', projectId: 'desk', value: 'exact clipboard text', todayBase});
      await Q.put({id: 'file', kind: 'file', projectId: 'desk', blob: new Blob([new Uint8Array([1, 0, 255, 4])], {type: 'application/octet-stream'}), fileName: 'a.bin', todayBase});
      await Q.put({id: 'empty', kind: 'file', projectId: 'desk', blob: new Blob([], {type: 'text/plain'}), fileName: 'empty.txt', todayBase});
      const duplicate = await Q.put({id: 'text', kind: 'text', projectId: 'desk', value: 'exact clipboard text', todayBase});
      const list = await Q.list(), text = await Q.read('text'), file = await Q.read('file'), binary = await Q.read('file', {binary: true});
      await Q.ack('file');
      return {duplicate: duplicate.duplicate, list, text, file, bytes: [...new Uint8Array(await binary.blob.arrayBuffer())], count: await Q.count(), counter: await Q.today(), missing: await Q.read('file')};
    });
    assert.equal(queue.duplicate, true); assert.equal(queue.counter.count, 10); assert.equal(queue.list.length, 3);
    assert.equal(queue.list.some(value => 'value' in value || 'blob' in value), false); assert.equal(queue.text.value, 'exact clipboard text');
    assert.deepEqual(queue.bytes, [1, 0, 255, 4]); assert.deepEqual(Buffer.from(queue.file.value.split(',')[1], 'base64'), Buffer.from(queue.bytes));
    assert.equal(queue.count, 2); assert.equal(queue.missing, null);
    console.log('PASS bridge replay is idempotent and queue commits exact text/binary/empty files with metadata-only listings and durable acknowledgement');
    await f.close();
  }
  {
    const f = await fixture(), page = f.page;
    await page.evaluate(() => seedLite());
    await page.evaluate(() => { failKey = 'briefCraftGptLiteChat:desk:main'; });
    const failure = await page.evaluate(async () => { try { await OSMINOGRestore438.beforeLoad(); return ''; } catch (error) { return error.message; } });
    assert.match(failure, /Injected storage interruption/);
    const retried = await page.evaluate(async () => {
      const result = await OSMINOGRestore438.beforeLoad();
      return {result, originals: await OSMINOGRestore438.__test.original('briefCraftStudioV2'), chat: values['briefCraftGptLiteChat:desk:main'],
        note: values.briefCraftStudioV2.projects.find(p => p.id === 'desk').objects.find(o => o.id === 'note'),
        ids: values.briefCraftStudioV2.projects.flatMap(p => p.objects.map(o => p.id + ':' + o.id))};
    });
    assert.equal(retried.result.status, 'done'); assert.deepEqual(retried.originals.value, original.briefCraftStudioV2);
    assert.equal(new Set(retried.ids).size, retried.ids.length); assert.equal(retried.chat.filter(value => value?.id === 'new-message').length, 1);
    assert.equal(retried.chat.filter(value => value === 'repeated no-id body').length, 3);
    assert.equal(retried.note.html, undefined, 'interruption retry must not restore archived HTML over edited Lite text');
    assert.equal(retried.note.osminogRestore438OriginalHtml, '<b>old text</b>');
    assert(retried.note.text.startsWith('edited in 4.0.38 '));
    console.log('PASS interrupted workspace→chat restoration resumes without overwriting originals or duplicating objects/messages');
    await f.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
});
