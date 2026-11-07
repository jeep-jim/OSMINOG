'use strict';
// Native offscreen collection, with metadata-only durable-queue observations.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(page, predicate, timeout = 15000) {
  const end = Date.now() + timeout;
  do { if (await page.evaluate(predicate) === true) return; await delay(100); } while (Date.now() < end);
  throw Error('The actual offscreen collector did not satisfy its asynchronous queue condition');
}
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'osminog-collector-'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'osminog-profile-')); let context;
  try {
    for (const file of ['collector.html', 'collector.js', 'osminog-capture-store.js', 'osminog-today.js', 'osminog-collector-background.js'])
      fs.copyFileSync(path.join(__dirname, '..', file), path.join(dir, file));
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({manifest_version: 3, name: 'OSMINOG capture test', version: '1.0',
      permissions: ['storage', 'offscreen', 'clipboardRead', 'clipboardWrite'], background: {service_worker: 'service.js'}}));
    fs.writeFileSync(path.join(dir, 'service.js'), "importScripts('osminog-capture-store.js','osminog-today.js','osminog-collector-background.js');");
    fs.writeFileSync(path.join(dir, 'test.html'), '<!doctype html><title>Clipboard fixture</title><body>Native clipboard fixture<script src="osminog-capture-store.js"></script></body>');
    context = await chromium.launchPersistentContext(profile, {headless: false, channel: 'chromium', ignoreDefaultArgs: ['--disable-extensions'],
      ...(process.env.TEST_CHROMIUM ? {executablePath: process.env.TEST_CHROMIUM} : {}),
      args: ['--no-sandbox', `--disable-extensions-except=${dir}`, `--load-extension=${dir}`]});
    const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(sw.url()).host, page = await context.newPage(); await page.goto(`chrome-extension://${id}/test.html`);
    await page.evaluate(async () => {
      await navigator.clipboard.writeText('baseline');
      const result = await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CONFIGURE', patch: {enabled: true, projectId: 'p1', folderId: 'f1'}});
      if (!result?.ok) throw Error(result?.error || 'Collector configuration failed');
    });
    await delay(2000); await page.evaluate(() => navigator.clipboard.writeText('Captured invoice 82713'));
    await poll(page, async () => {
      for (const metadata of await OSMINOGCaptureStore.list()) if ((await OSMINOGCaptureStore.read(metadata.id))?.value === 'Captured invoice 82713') return true;
      return false;
    });
    await delay(2000);
    const captured = await page.evaluate(async () => {
      const metadata = await OSMINOGCaptureStore.list(), entries = await Promise.all(metadata.map(entry => OSMINOGCaptureStore.read(entry.id)));
      const storage = await chrome.storage.local.get(null);
      return {metadata, entries, chromeQueue: Object.keys(storage).filter(key => key.startsWith('osminogCapture:'))};
    });
    assert.equal(captured.entries.filter(entry => entry.value === 'Captured invoice 82713').length, 1);
    assert.equal(captured.entries.some(entry => entry.value === 'baseline'), false);
    assert(captured.metadata.every(entry => !Object.hasOwn(entry, 'value') && !Object.hasOwn(entry, 'blob')));
    assert.deepEqual(captured.chromeQueue, []);
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; canvas.getContext('2d').fillRect(0, 0, 120, 80);
      const blob = await new Promise(resolve => canvas.toBlob(resolve)); await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    });
    await poll(page, async () => (await OSMINOGCaptureStore.list()).some(entry => entry.kind === 'image'));
    const image = await page.evaluate(async () => {
      const metadata = (await OSMINOGCaptureStore.list()).find(entry => entry.kind === 'image');
      const entry = await OSMINOGCaptureStore.read(metadata.id, {binary: true}), bitmap = await createImageBitmap(entry.blob);
      const result = {width: bitmap.width, height: bitmap.height, projectId: entry.projectId, folderId: entry.folderId}; bitmap.close(); return result;
    });
    assert.deepEqual(image, {width: 120, height: 80, projectId: 'p1', folderId: 'f1'});
    await page.evaluate(() => chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CONFIGURE', patch: {enabled: false}}));
    await poll(page, async () => (await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1?.enabled === false);
    const pausedCount = await page.evaluate(() => OSMINOGCaptureStore.count());
    await page.evaluate(() => navigator.clipboard.writeText('Do not collect while paused'));
    await delay(3200);
    assert.equal(await page.evaluate(() => OSMINOGCaptureStore.count()), pausedCount, 'Pause prevents new captures while a durable queue remains');
    console.log('PASS actual extension offscreen capture, baseline skip, dedupe, durable Blob queue, unchanged image dimensions and pause');
  } finally {
    await context?.close(); fs.rmSync(dir, {recursive: true, force: true}); fs.rmSync(profile, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
