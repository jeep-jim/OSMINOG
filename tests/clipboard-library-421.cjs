// Full editor + actual Chromium clipboard. Chrome storage is fault-injected here;
// the separate extension e2e covers the real offscreen/storage transport.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

(async () => {
  const root = path.resolve(process.env.OSMINOG_TEST_ROOT || path.join(__dirname, '..'));
  const baseline = process.env.EXPECT_BASELINE_FAILURE === '1';
  const server = http.createServer((req, res) => {
    const name = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!name.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(name, (error, bytes) => {
      if (error) return res.writeHead(404).end();
      res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
      res.end(bytes);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.TEST_CHROMIUM || undefined});
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, permissions: ['clipboard-read', 'clipboard-write']});
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.addInitScript(() => {
      if (window !== window.top) return;
      const store = {}, event = {addListener() {}, removeListener() {}};
      window.__store = store;
      window.__ignored = [];
      window.__failWorkspaceSave = false;
      window.__failRemove = false;
      window.chrome = {
        runtime: {
          getURL: p => new URL(p, location.href).href, getManifest: () => ({version: '4.0.21'}), onMessage: event,
          sendMessage: async m => {
            if (m.type === 'OSMINOG_COLLECTOR_CONFIGURE') {
              store.osminogCollectorV1 = {...store.osminogCollectorV1, ...m.patch};
              return {ok: true, config: structuredClone(store.osminogCollectorV1)};
            }
            if (m.type === 'OSMINOG_COLLECTOR_IGNORE') {
              const persisted = store.briefCraftStudioV2?.projects?.flatMap(p => p.objects) || [];
              window.__ignored.push({kind: m.kind, value: m.value, saved: persisted.some(o => m.kind === 'image' ? o.src === m.value : o.text === m.value)});
              return {ok: true};
            }
            return {ok: false, error: 'offline fixture'};
          }
        },
        storage: {
          local: {
            get: (keys, cb) => {
              const v = keys == null ? {...store} : typeof keys === 'string' ? {[keys]: store[keys]} : Object.fromEntries(keys.map(k => [k, store[k]]));
              const copy = structuredClone(v); cb?.(copy); return Promise.resolve(copy);
            },
            set: (values, cb) => {
              if (window.__failWorkspaceSave && Object.hasOwn(values, 'briefCraftStudioV2')) {
                if (cb) {
                  chrome.runtime.lastError = {message: 'Simulated storage failure'};
                  cb(); delete chrome.runtime.lastError; return Promise.resolve();
                }
                return Promise.reject(Error('Simulated storage failure'));
              }
              Object.assign(store, structuredClone(values)); cb?.(); return Promise.resolve();
            },
            remove: async key => {if (window.__failRemove) throw Error('Simulated queue ACK failure'); delete store[key];}
          }, onChanged: event
        },
        tabs: {getCurrent: async () => ({id: 1}), query: async () => [], create: async () => {}},
        permissions: {contains: async () => true, request: async () => true},
        identity: {getRedirectURL: () => location.origin + '/oauth'}, i18n: {getMessage: () => ''}
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
    await page.waitForFunction(() => window.OSMINOGWorkdesk && window.OSMINOGLibrary && window.OSMINOGWindowsFolders);
    await page.evaluate(async () => {
      await OSMINOGStateReady;
      document.querySelector('#osminogStorageOnboarding')?.close();
      createProject(); state.language = 'ru';
      document.querySelector('#osminogStorageOnboarding')?.close();
      // OCR is independent of this regression; keep its automatic work bounded.
      Tesseract.createWorker = async () => ({recognize: async () => ({data: {text: ''}})});
      clearTimeout(state.saveTimer); await persist();
    });
    const fixture = await page.evaluate(async () => {
      const p = project(), f = OSMINOGWindowsFolders.create({name: 'Inbox regression', rename: false});
      const canvas = document.createElement('canvas'); canvas.width = 317; canvas.height = 193;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f02663'; ctx.fillRect(0, 0, 317, 193); ctx.fillStyle = '#12a7ce'; ctx.fillRect(100, 40, 50, 50);
      // The OS clipboard can re-encode PNG. Seed the legacy queue with the
      // bytes that the collector and native paste actually read.
      await navigator.clipboard.write([new ClipboardItem({'image/png': await new Promise(r => canvas.toBlob(r))})]);
      const clipboard = await navigator.clipboard.read(), png = await clipboard[0].getType('image/png');
      const image = await new Promise(resolve => {const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(png);});
      clearTimeout(state.saveTimer); await persist();
      const entry = {id: 'old-image-420', kind: 'image', value: image, projectId: p.id, folderId: f.id, at: Date.now()};
      await chrome.storage.local.set({'osminogCapture:old-image-420': entry});
      return {projectId: p.id, folderId: f.id, image};
    });
    const drainResult = await page.evaluate(async () => {
      try {return {result: await OSMINOGLibrary.drain()};} catch (e) {return {error: e.message};}
    });
    if (baseline) {
      assert.match(drainResult.error, /loadImage is not defined/);
      await page.locator('#viewport').focus(); await page.keyboard.press('Control+v');
      await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('loadImage is not defined'));
      assert.equal(await page.evaluate(() => objects().filter(o => o.type === 'image').length), 0);
      assert.equal(await page.evaluate(() => !!window.__store['osminogCapture:old-image-420']), true);
      console.log('PASS baseline reproduced: 4.0.20 queued PNG throws loadImage is not defined; real Ctrl+V repeats the exact toast and creates no image; queue remains.');
      return;
    }
    assert.equal(drainResult.error, undefined);
    assert.deepEqual(drainResult.result, {pending: 0, errors: []});
    assert.deepEqual(await page.evaluate(() => {
      const o = objects().find(o => o.captureId === 'old-image-420');
      return {w: o.w, h: o.h, count: objects().filter(o => o.captureId === 'old-image-420').length, folder: o.osminogFolderId, stored: !!window.__store['osminogCapture:old-image-420']};
    }), {w: 317, h: 193, count: 1, folder: fixture.folderId, stored: false});
    // Actual Ctrl+V consumes the queued/imported screenshot without duplication.
    await page.locator('#viewport').focus(); await page.keyboard.press('Control+v');
    await page.waitForFunction(() => objects().some(o => o.captureId === 'old-image-420' && !o.osminogFolderId));
    assert.equal(await page.evaluate(() => objects().filter(o => o.src === __store.briefCraftStudioV2.projects.find(p => p.id === state.activeProject).objects.find(o => o.captureId === 'old-image-420').src).length), 1);
    // An already open folder refreshes without reopening or clearing its search.
    await page.evaluate(async f => {
      const p = project(), folder = p.osminogFolders.find(x => x.id === f.folderId);
      for (let i = 0; i < 30; i++) {
        const o = {...objectDefaults('brief'), id: 'history-' + i, name: 'Healthy history ' + String(i).padStart(2, '0'), text: 'Earlier saved text', osminogFolderId: folder.id};
        p.objects.push(o); folder.members.push(o.id);
      }
      await persist(); OSMINOGWindowsFolders.openVirtual(f.folderId);
    }, fixture);
    await page.locator('#osminogWindowsExplorerSearch').fill('Healthy');
    const folderScroll = await page.locator('#osminogWindowsExplorerItems').evaluate(box => {box.scrollTop = 200; return box.scrollTop;});
    assert.ok(folderScroll > 0, 'fixture must actually scroll before refreshing');
    // A corrupt entry must stay available for diagnosis and not block later entries.
    await page.evaluate(async f => {
      await chrome.storage.local.set({
        'osminogCapture:broken': {id: 'broken', kind: 'image', value: 'data:image/png;base64,broken', projectId: f.projectId, folderId: f.folderId, at: Date.now()},
        'osminogCapture:healthy': {id: 'healthy', kind: 'text', value: 'Healthy after broken PNG', projectId: f.projectId, folderId: f.folderId, at: Date.now()}
      });
      await OSMINOGLibrary.drain(); OSMINOGLibrary.open('capture');
    }, fixture);
    assert.equal(await page.evaluate(() => objects().filter(o => o.captureId === 'healthy').length), 1);
    await page.locator('[data-item-key="obj:capture-healthy"]').waitFor({state: 'visible'});
    assert.equal(await page.locator('#osminogWindowsExplorerSearch').inputValue(), 'Healthy');
    assert.equal(await page.locator('#osminogWindowsExplorerTitle').innerText(), 'Inbox regression');
    assert.equal(await page.locator('#osminogWindowsExplorerItems').evaluate(box => box.scrollTop), folderScroll);
    assert.equal(await page.evaluate(() => !!__store['osminogCapture:broken']), true);
    assert.match(await page.locator('#osminogLibrary [data-status]').innerText(), /Не удалось сохранить материал/);
    assert.match(await page.locator('#osminogLibrary [data-status]').innerText(), /Ожидают сохранения: 1/);
    await page.locator('#osminogLibrary [data-close]').click();
    await page.locator('#osminogWindowsExplorerClose').click();
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 87; c.height = 61; c.getContext('2d').fillRect(0, 0, 87, 61);
      await navigator.clipboard.write([new ClipboardItem({'image/png': await new Promise(r => c.toBlob(r))})]);
      const items = await navigator.clipboard.read(), png = await items[0].getType('image/png');
      window.__manualImage = await new Promise(resolve => {const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(png);});
    });
    await page.locator('#viewport').focus(); await page.keyboard.press('Control+v');
    await page.waitForFunction(() => objects().some(o => o.src === window.__manualImage));
    assert.equal(await page.evaluate(() => __store.briefCraftStudioV2.projects.flatMap(p => p.objects).filter(o => o.src === __manualImage).length), 1);
    assert.equal(await page.evaluate(() => __ignored.every(x => x.saved)), true, 'IGNORE must only follow durable save');
    // Root desk destination is explicit and imported into the visible viewport.
    await page.evaluate(() => OSMINOGLibrary.open('capture'));
    await page.locator('#osminogLibrary [data-folder]').selectOption(''); await page.locator('#osminogLibrary [data-destination]').click();
    await page.waitForFunction(() => __store.osminogCollectorV1?.folderId === '' && __store.osminogCollectorV1?.projectId === state.activeProject);
    await page.evaluate(async f => {
      await chrome.storage.local.remove('osminogCapture:broken');
      await chrome.storage.local.set({'osminogCapture:root': {id: 'root', kind: 'image', value: f.image, projectId: f.projectId, folderId: '', at: Date.now()}});
      await OSMINOGLibrary.drain();
    }, fixture);
    assert.equal(await page.evaluate(() => desktopObjects().filter(o => o.captureId === 'root').length), 1);
    const rootVisible = await page.evaluate(() => {
      const o = objects().find(o => o.captureId === 'root'), r = document.querySelector('#viewport').getBoundingClientRect();
      const x = state.view.x + o.x * state.view.scale, y = state.view.y + o.y * state.view.scale;
      return x + o.w > 0 && y + o.h > 0 && x < r.width && y < r.height;
    });
    assert.equal(rootVisible, true, 'root captures must appear in the saved viewport, not world origin');
    // Failed storage must retain the queue and must not treat an in-memory id as ACK.
    await page.evaluate(async f => {
      await chrome.storage.local.set({'osminogCapture:retry': {id: 'retry', kind: 'text', value: 'Save retry is durable', projectId: f.projectId, folderId: '', at: Date.now()}});
      window.__failWorkspaceSave = true; await OSMINOGLibrary.drain(); await OSMINOGLibrary.drain();
    }, fixture);
    assert.equal(await page.evaluate(() => objects().filter(o => o.captureId === 'retry').length), 1);
    assert.equal(await page.evaluate(() => !!__store['osminogCapture:retry']), true);
    assert.equal(await page.evaluate(() => __store.briefCraftStudioV2.projects.flatMap(p => p.objects).some(o => o.captureId === 'retry')), false);
    await page.evaluate(async () => {window.__failWorkspaceSave = false; await OSMINOGLibrary.drain();});
    assert.equal(await page.evaluate(() => !!__store['osminogCapture:retry']), false);
    assert.equal(await page.evaluate(() => __store.briefCraftStudioV2.projects.flatMap(p => p.objects).filter(o => o.captureId === 'retry').length), 1);
    // A queue-remove failure after a successful save must also retry without duplicates.
    await page.evaluate(async f => {
      await chrome.storage.local.set({'osminogCapture:ack': {id: 'ack', kind: 'text', value: 'ACK retry stays singular', projectId: f.projectId, folderId: f.folderId, at: Date.now()}});
      window.__failRemove = true; await OSMINOGLibrary.drain(); window.__failRemove = false;
      await OSMINOGLibrary.drain(); await OSMINOGLibrary.drain();
    }, fixture);
    assert.equal(await page.evaluate(() => objects().filter(o => o.captureId === 'ack').length), 1);
    assert.equal(await page.evaluate(() => !!__store['osminogCapture:ack']), false);
    // A new capture after the current storage snapshot is imported before drain resolves.
    await page.evaluate(async f => {
      const entry = id => ({id, kind: 'text', value: 'In-flight ' + id, projectId: f.projectId, folderId: '', at: Date.now()});
      await chrome.storage.local.set({'osminogCapture:inflight-a': entry('inflight-a')});
      const get = chrome.storage.local.get; let inject = true;
      chrome.storage.local.get = async (keys, cb) => {
        const snapshot = await get(keys, cb);
        if (keys === null && inject) {
          inject = false; await chrome.storage.local.set({'osminogCapture:inflight-b': entry('inflight-b')});
          void OSMINOGLibrary.drain();
        }
        return snapshot;
      };
      try {await OSMINOGLibrary.drain();} finally {chrome.storage.local.get = get;}
    }, fixture);
    assert.deepEqual(await page.evaluate(() => ['inflight-a', 'inflight-b'].map(id => ({count: objects().filter(o => o.captureId === id).length, pending: !!__store['osminogCapture:' + id]}))), [{count: 1, pending: false}, {count: 1, pending: false}]);
    assert.deepEqual(errors, []);
    console.log('PASS queued PNG repair; real Ctrl+V; live folder refresh preserves search and scroll; bad-entry isolation and status; explicit root destination and placement; IGNORE after save; failed persist/ACK retry without loss or duplication; captures arriving during drain.');
  } finally {await browser?.close(); await new Promise(resolve => server.close(resolve));}
})().catch(error => {console.error(error); process.exit(1);});
