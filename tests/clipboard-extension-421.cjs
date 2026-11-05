/* Full extension regression: real clipboard APIs, real offscreen document,
 * real chrome.storage and the complete editor. Run under xvfb-run in CI.
 * A separate HTTPS-origin tab represents the application copying the material.
 * Its HTML is served by Playwright routing; clipboard/storage are never mocked.
 */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(process.env.OSMINOG_EXTENSION_ROOT || path.join(__dirname, '..'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'osminog-clipboard-e2e-'));
const writerOrigin = 'https://clipboard-fixture.osminog.test';
const KEY = 'osminogCollectorV1', PREFIX = 'osminogCapture:';
const imageSpec = {width: 223, height: 151, corner: [12, 100, 200, 255]};
let context, editor, writer, extensionId;
const errors = [], checks = [];
const record = label => { checks.push(label); console.log('PASS ' + label); };

async function launch() {
  context = await chromium.launchPersistentContext(profile, {
    headless: process.env.TEST_HEADLESS === '1',
    ...(process.env.TEST_CHROMIUM ? {executablePath: process.env.TEST_CHROMIUM} : {channel: 'chromium'}),
    viewport: {width: 1440, height: 1000},
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-dev-shm-usage',
      `--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  context.setDefaultTimeout(15000);
  await context.route('https://**', route => route.abort());
  await context.route(writerOrigin + '/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><meta charset="utf-8"><title>External clipboard fixture</title><textarea id="external-editor"></textarea>'
  }));
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: writerOrigin});
  const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', {timeout: 20000});
  extensionId = new URL(sw.url()).host;
  editor = await context.newPage();
  editor.on('pageerror', error => errors.push(error.message));
  await editor.goto(`chrome-extension://${extensionId}/editor.html`);
  await ready();
  writer = await context.newPage();
  await writer.goto(writerOrigin + '/');
  console.log('Browser ' + (context.browser()?.version() || await editor.evaluate(() => navigator.userAgent)) + '; extension ' + extensionId);
}

async function ready() {
  await editor.waitForFunction(() => !!globalThis.OSMINOGLibrary && !!globalThis.OSMINOGWindowsFolders);
  await editor.evaluate(async () => {
    await OSMINOGStateReady;
    document.querySelector('#osminogStorageOnboarding')?.close();
  });
  await editor.waitForSelector('#libraryCapture', {state: 'attached'});
}

async function configure(patch) {
  const result = await editor.evaluate(patch => chrome.runtime.sendMessage({
    type: 'OSMINOG_COLLECTOR_CONFIGURE', patch
  }), patch);
  assert.equal(result?.ok, true, result?.error || 'Collector configuration was not acknowledged');
}

async function nativeCopyText(text) {
  await writer.bringToFront();
  await writer.evaluate(text => navigator.clipboard.writeText(text), text);
  assert.equal(await writer.evaluate(() => navigator.clipboard.readText()), text);
}

async function nativeCopyImage(spec = imageSpec) {
  await writer.bringToFront();
  return writer.evaluate(async spec => {
    const canvas = document.createElement('canvas');
    canvas.width = spec.width; canvas.height = spec.height;
    const c = canvas.getContext('2d');
    c.fillStyle = `rgb(${spec.corner.slice(0, 3).join(',')})`;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#f9c12c'; c.fillRect(20, 30, 80, 45);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
    return canvas.toDataURL('image/png');
  }, spec);
}

async function waitForCapture(projectId, query) {
  await editor.waitForFunction(({projectId, query}) => {
    const p = state.projects.find(p => p.id === projectId);
    return p?.objects.some(o => o.captureId &&
      (!query.type || o.type === query.type) &&
      (!query.text || o.text === query.text) &&
      (!query.id || o.captureId === query.id));
  }, {projectId, query}, {timeout: 20000});
  return editor.evaluate(({projectId, query}) => {
    const p = state.projects.find(p => p.id === projectId);
    return p.objects.find(o => o.captureId &&
      (!query.type || o.type === query.type) &&
      (!query.text || o.text === query.text) &&
      (!query.id || o.captureId === query.id));
  }, {projectId, query});
}

async function assertImage(object, spec = imageSpec) {
  const actual = await editor.evaluate(async src => {
    const bitmap = await createImageBitmap(await (await fetch(src)).blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const c = canvas.getContext('2d'); c.drawImage(bitmap, 0, 0);
    const value = {width: bitmap.width, height: bitmap.height, corner: [...c.getImageData(1, 1, 1, 1).data]};
    bitmap.close(); return value;
  }, object.src);
  assert.deepEqual(actual, spec, 'Clipboard PNG dimensions and pixels changed');
}

async function captureCount(projectId) {
  return editor.evaluate(id => state.projects.find(p => p.id === id).objects.filter(o => o.captureId).length, projectId);
}

async function queueKeys() {
  return editor.evaluate(async prefix => Object.keys(await chrome.storage.local.get(null)).filter(k => k.startsWith(prefix)), PREFIX);
}

async function snapshot() {
  if (!editor || editor.isClosed()) return null;
  return editor.evaluate(async ({KEY, PREFIX}) => {
    const storage = await chrome.storage.local.get(null);
    return {config: storage[KEY], toast: document.querySelector('#toast')?.textContent,
      queue: Object.entries(storage).filter(([k]) => k.startsWith(PREFIX)).map(([key, v]) =>
        ({key, id: v.id, kind: v.kind, projectId: v.projectId, folderId: v.folderId})),
      projects: state.projects.map(p => ({id: p.id, captures: p.objects.filter(o => o.captureId).map(o =>
        ({id: o.id, captureId: o.captureId, type: o.type, folderId: o.osminogFolderId}))}))};
  }, {KEY, PREFIX});
}

(async () => {
  try {
    await launch();
    const ids = await editor.evaluate(async () => {
      state.language = 'ru';
      createProject(); document.querySelector('#osminogStorageOnboarding')?.close();
      const target = project(); target.name = 'Capture destination';
      const folder = OSMINOGWindowsFolders.create({name: 'Clipboard inbox', rename: false});
      const other = defaultProject('Other active desk'); state.projects.push(other);
      await persist();
      return {target: target.id, folder: folder.id, other: other.id};
    });
    await nativeCopyText('pre-existing clipboard baseline');

    // Use the real settings UI for the existing saved-folder destination.
    await editor.bringToFront();
    await editor.locator('#libraryCapture').click();
    await editor.locator('#osminogLibrary [data-folder]').selectOption(ids.folder);
    await editor.locator('#osminogLibrary [data-destination]').click();
    await editor.waitForFunction(async ids => {
      const v = (await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1;
      return v?.projectId === ids.target && v?.folderId === ids.folder;
    }, ids);
    await editor.waitForFunction(() => {
      const open = document.querySelector('#osminogLibrary [data-open-folder]');
      return open && !open.disabled;
    });
    await editor.locator('#osminogLibrary [data-enabled]').check();
    await editor.waitForFunction(async () => (await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length === 1);
    await editor.locator('#osminogLibrary [data-close]').click();
    await editor.evaluate(async id => {openProject(id); await persist();}, ids.other);
    await writer.bringToFront();
    await writer.waitForTimeout(1900);
    assert.equal(await editor.evaluate(() => document.hasFocus()), false, 'Editor must be unfocused during automatic collection');
    assert.equal(await captureCount(ids.target), 0, 'Enabling must not import the old clipboard contents');
    record('real settings enable the offscreen collector and skip the pre-existing clipboard');

    const text = 'External application invoice 82713';
    await nativeCopyText(text);
    const textCapture = await waitForCapture(ids.target, {text});
    assert.equal(textCapture.osminogFolderId, ids.folder);
    const imageData = await nativeCopyImage();
    const imageCapture = await waitForCapture(ids.target, {type: 'image'});
    await assertImage(imageCapture);
    assert.equal(imageCapture.osminogFolderId, ids.folder);
    assert.equal(await editor.evaluate(id => project().id === id, ids.other), true, 'Collecting must not switch the active desk');
    assert.equal(await captureCount(ids.other), 0, 'Automatic collection must keep the chosen destination');
    await editor.waitForFunction(async () => !Object.keys(await chrome.storage.local.get(null)).some(k => k.startsWith('osminogCapture:')));
    await writer.waitForTimeout(3200);
    assert.equal(await captureCount(ids.target), 2, 'Repeated polls must not duplicate clipboard items');
    record('external text and PNG reach the chosen folder while another desk and another tab are active; dimensions, pixels and dedupe verified');

    // This is the exact failed path from 4.0.20: ordinary Ctrl+V also invokes
    // library reuse/drain. Use the browser's actual paste event and clipboard.
    await editor.bringToFront();
    await editor.locator('#viewport').focus();
    await editor.keyboard.press('Control+v');
    await editor.waitForFunction(() => objects().some(o => o.type === 'image'));
    const pasted = await editor.evaluate(() => objects().find(o => o.type === 'image'));
    await assertImage(pasted);
    assert.equal(await editor.evaluate(id => objects().filter(o => o.id === id).length, pasted.id), 1);
    assert.equal(await captureCount(ids.target), 2, 'Explicit paste on a different desk must keep its saved-folder copy');
    assert.doesNotMatch(await editor.locator('#toast').textContent() || '', /loadImage|не удалось вставить/i);
    record('native Ctrl+V pastes the screenshot on the active desk without breaking the selected-folder copy');

    await editor.evaluate(ids => {openProject(ids.target); OSMINOGWindowsFolders.openVirtual(ids.folder);}, ids);
    await editor.waitForSelector('#osminogWindowsExplorerItems [data-item-key]');
    await nativeCopyText('Live folder update 97101');
    const live = await waitForCapture(ids.target, {text: 'Live folder update 97101'});
    await editor.locator(`#osminogWindowsExplorerItems [data-item-key="obj:${live.id}"]`).waitFor({state: 'visible'});
    assert.equal(await editor.locator('#osminogWindowsExplorerStatus').textContent(), '3 элемент(а)');
    assert.equal(await editor.locator(`[data-win-folder-id="${ids.folder}"] small`).textContent(), '3 элемент(а)');
    record('an already-open destination folder and its desktop item counter refresh after automatic import');
    await editor.bringToFront();
    await editor.locator('#osminogWindowsExplorerClose').click();
    await editor.evaluate(async id => {openProject(id); await persist();}, ids.other);

    // The destination may also be a desk root, rather than a virtual folder.
    await configure({enabled: true, projectId: ids.target, folderId: null, lastHash: ''});
    await nativeCopyText('Root desk capture 39102');
    const rootCapture = await waitForCapture(ids.target, {text: 'Root desk capture 39102'});
    assert.equal(!!rootCapture.osminogFolderId, false);
    assert.equal(await editor.evaluate(id => project().id === id, ids.other), true);
    record('the chosen desk root accepts automatic capture independently of the active desk');

    await configure({enabled: false});
    await editor.waitForFunction(async () => (await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length === 0);
    const beforePause = await captureCount(ids.target);
    await nativeCopyText('Paused collector must not capture');
    await writer.waitForTimeout(1800);
    assert.equal(await captureCount(ids.target), beforePause);

    // A malformed legacy queued item must remain recoverable and must not make
    // a valid manual image paste fail. This is an injected storage fixture, not
    // a claim that the malformed item came through the native clipboard.
    await editor.evaluate(async ids => {
      await chrome.storage.local.set({'osminogCapture:malformed-qa': {
        id: 'malformed-qa', at: Date.now(), kind: 'image', value: 'data:image/png;base64,bm90LWFuLWltYWdl',
        projectId: ids.target, folderId: ids.folder
      }});
    }, ids);
    const secondSpec = {width: 171, height: 109, corner: [170, 30, 80, 255]};
    await nativeCopyImage(secondSpec);
    const beforePaste = await editor.evaluate(() => objects().filter(o => o.type === 'image').length);
    await editor.bringToFront(); await editor.locator('#viewport').focus();
    await editor.keyboard.press('Control+v');
    await editor.waitForFunction(count => objects().filter(o => o.type === 'image').length === count + 1, beforePaste);
    const second = await editor.evaluate(() => objects().filter(o => o.type === 'image').at(-1));
    await assertImage(second, secondSpec);
    assert.equal((await queueKeys()).includes('osminogCapture:malformed-qa'), true, 'Failed import must retain the queued data');
    await editor.evaluate(() => chrome.storage.local.remove('osminogCapture:malformed-qa'));
    record('pause stops collection; an unrelated malformed pending capture does not block native image paste or get discarded');

    // A queue entry left by 4.0.20 must be imported after upgrading/reloading.
    await editor.evaluate(async ({ids, src}) => {
      await chrome.storage.local.set({'osminogCapture:legacy-qa': {
        id: 'legacy-qa', hash: 'legacy-fixture', at: Date.now(), kind: 'image', value: src,
        projectId: ids.target, folderId: ids.folder
      }});
    }, {ids, src: imageData});
    await editor.reload(); await ready();
    const recovered = await waitForCapture(ids.target, {id: 'legacy-qa'});
    await assertImage(recovered);
    assert.equal(recovered.osminogFolderId, ids.folder);
    await editor.waitForFunction(async () => !(await chrome.storage.local.get('osminogCapture:legacy-qa'))['osminogCapture:legacy-qa']);
    const persisted = await editor.evaluate(async id => {
      const v = (await chrome.storage.local.get('briefCraftStudioV2')).briefCraftStudioV2;
      return v.projects.find(p => p.id === id).objects.filter(o => o.captureId === 'legacy-qa').length;
    }, ids.target);
    assert.equal(persisted, 1, 'Queue acknowledgement requires a persisted project record');
    assert.equal(await editor.evaluate(id => objects().some(o => o.id === id), second.id), true, 'Manual paste must survive editor reload');
    record('pending 4.0.20 screenshot recovery and both automatic/manual images survive editor reload with one persisted object per capture');

    // A real browser restart also replaces the MV3 service worker and offscreen
    // document. Reuse the same temporary profile and check enabled-state resume.
    await configure({enabled: true, projectId: ids.target, folderId: null, lastHash: ''});
    await editor.evaluate(() => persist());
    await context.close(); context = null;
    await launch();
    await editor.waitForFunction(async () => (await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length === 1);
    await writer.bringToFront(); await writer.waitForTimeout(1800);
    await nativeCopyText('After full browser and worker restart 62019');
    const resumed = await waitForCapture(ids.target, {text: 'After full browser and worker restart 62019'});
    assert.equal(!!resumed.osminogFolderId, false);
    assert.equal(await editor.evaluate(id => state.projects.find(p => p.id === id).objects.filter(o => o.captureId === 'legacy-qa').length, ids.target), 1);
    record('enabled collection resumes after a real browser/service-worker restart and retains the saved projects');

    await configure({enabled: false});
    assert.deepEqual(errors, [], 'Unexpected uncaught editor errors');
    fs.mkdirSync(path.resolve('artifacts'), {recursive: true});
    await editor.bringToFront();
    await editor.evaluate(ids => {openProject(ids.target); OSMINOGWindowsFolders.openVirtual(ids.folder);}, ids);
    await editor.screenshot({path: path.resolve('artifacts/clipboard-extension-421.png')});
    console.log(JSON.stringify({result: 'CLIPBOARD_EXTENSION_421_PASS',checks, manifest: JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version}));
  } catch (error) {
    console.error('CLIPBOARD_EXTENSION_421_FAILURE', error);
    console.error('STATE', JSON.stringify(await snapshot().catch(() => null)));
    throw error;
  } finally {
    await context?.close();
    fs.rmSync(profile, {recursive: true, force: true});
  }
})().catch(() => {process.exitCode = 1;});
