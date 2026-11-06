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
const {spawn} = require('node:child_process');
const {createHash} = require('node:crypto');

const root = path.resolve(process.env.OSMINOG_EXTENSION_ROOT || path.join(__dirname, '..'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'osminog-clipboard-e2e-'));
const writerOrigin = 'https://clipboard-fixture.osminog.test';
const KEY = 'osminogCollectorV1', PREFIX = 'osminogCapture:';
const imageSpec = {width: 223, height: 151, corner: [12, 100, 200, 255]};
const extensionManifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.ok(extensionManifest.key, 'The extension must retain its stable manifest public key');
const expectedExtensionId = createHash('sha256').update(Buffer.from(extensionManifest.key, 'base64'))
  .digest('hex').slice(0, 32).replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)));
let context, editor, writer, extensionId, browser, browserProcess, browserProcessClosed;
const errors = [], checks = [];
const record = label => { checks.push(label); console.log('PASS ' + label); };

async function launch() {
  // launchPersistentContext enables focus emulation on every page. A second
  // CDP session cannot release the first session's visibility override. The
  // supported noDefaults CDP connection leaves native tab focus intact.
  const child = spawn(process.env.TEST_CHROMIUM || chromium.executablePath(), [
    '--remote-debugging-pipe', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--password-store=basic', '--use-mock-keychain',
    '--window-size=1440,1100', `--user-data-dir=${profile}`,
    `--disable-extensions-except=${root}`, `--load-extension=${root}`,
    ...(process.env.TEST_HEADLESS === '1' ? ['--headless=new'] : []), 'about:blank'
  ], {stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe']});
  browserProcess = child;
  browserProcessClosed = new Promise(resolve => child.once('close', resolve));
  let pending = '', stderr = '', exited = false;
  const transport = {
    open() {if (exited) transport.onclose?.(stderr || 'Chromium exited before CDP connected');},
    send(message) {child.stdio[3].write(JSON.stringify(message) + '\0');},
    close() {if (!exited) child.kill('SIGTERM');}
  };
  child.stderr.on('data', chunk => {stderr = (stderr + chunk).slice(-8000);});
  child.stdio[4].setEncoding('utf8');
  child.stdio[4].on('data', chunk => {
    pending += chunk;
    for (let end; (end = pending.indexOf('\0')) !== -1;) {
      const message = pending.slice(0, end); pending = pending.slice(end + 1);
      if (message) transport.onmessage?.(JSON.parse(message));
    }
  });
  child.once('error', error => {exited = true; transport.onclose?.(error.message);});
  child.once('exit', () => {exited = true; transport.onclose?.(stderr);});
  browser = await chromium.connectOverCDP(transport, {noDefaults: true, isLocal: true, timeout: 20000});
  context = browser.contexts()[0];
  assert.ok(context, 'Chromium must expose the persistent default context');
  context.setDefaultTimeout(15000);
  await context.route('https://**', route => route.abort());
  await context.route(writerOrigin + '/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><meta charset="utf-8"><title>External clipboard fixture</title><textarea id="external-editor"></textarea>'
  }));
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: writerOrigin});
  const backgroundURL = `chrome-extension://${expectedExtensionId}/${extensionManifest.background.service_worker}`;
  const sw = context.serviceWorkers().find(worker => worker.url() === backgroundURL) ||
    await context.waitForEvent('serviceworker', {predicate: worker => worker.url() === backgroundURL, timeout: 20000});
  extensionId = new URL(sw.url()).host;
  const editorURL = `chrome-extension://${extensionId}/editor.html`;
  const isEditorURL = url => url === editorURL || url.startsWith(editorURL + '?') || url.startsWith(editorURL + '#');
  console.log('Pages on browser startup ' + JSON.stringify(context.pages().map(page => page.url())));
  // Native Chrome can restore the previous editor on restart. Reuse it so the
  // fixture still observes the single editor that imports and acknowledges the
  // queue, rather than silently introducing a second, independently loaded desk.
  editor = context.pages().find(page => isEditorURL(page.url()));
  const restoredEditor = !!editor;
  if (!editor) editor = await context.newPage();
  editor.on('pageerror', error => errors.push(error.message));
  if (restoredEditor) await editor.waitForLoadState('domcontentloaded');
  else await editor.goto(editorURL);
  await ready();
  writer = context.pages().find(page => page.url().startsWith(writerOrigin + '/')) || await context.newPage();
  await writer.goto(writerOrigin + '/');
  const editorTabs = await editor.evaluate(async editorURL => (await chrome.tabs.query({})).filter(tab =>
    tab.url === editorURL || tab.url?.startsWith(editorURL + '?') || tab.url?.startsWith(editorURL + '#'))
    .map(tab => ({id: tab.id, url: tab.url})), editorURL);
  assert.equal(editorTabs.length, 1, 'The native restart fixture must have exactly one editor tab');
  console.log('Editor tab ' + JSON.stringify({restored: restoredEditor, tabs: editorTabs}));
  console.log('Browser ' + (context.browser()?.version() || await editor.evaluate(() => navigator.userAgent)) + '; extension ' + extensionId);
}

async function closeBrowser() {
  const current = browser, child = browserProcess, closed = browserProcessClosed;
  context = null; browser = null; browserProcess = null; browserProcessClosed = null;
  try {
    if (current?.isConnected()) {
      // The browser may disconnect between isConnected() and session creation.
      try {await (await current.newBrowserCDPSession()).send('Browser.close');} catch {}
    }
    if (child && closed) {
      const waitForClose = async timeout => {
        let timer;
        try {
          return await Promise.race([closed.then(() => true), new Promise(resolve => {
            timer = setTimeout(() => resolve(false), timeout);
          })]);
        } finally {clearTimeout(timer);}
      };
      // Keep CDP connected while Chrome flushes its profile. Disconnecting first
      // invokes transport.close() and can terminate Chrome during that flush.
      if (!await waitForClose(3000)) {
        child.kill('SIGTERM');
        if (!await waitForClose(1000)) {
          child.kill('SIGKILL');
          if (!await waitForClose(3000)) throw Error('Test Chromium did not close after SIGKILL');
        }
      }
    }
  } finally {
    await current?.close().catch(() => {});
  }
}

async function ready() {
  await editor.waitForFunction(() => !!globalThis.OSMINOGLibrary && !!globalThis.OSMINOGWindowsFolders, null, {polling: 100});
  await editor.evaluate(async () => {
    await OSMINOGStateReady;
    document.querySelector('#osminogStorageOnboarding')?.close();
  });
  await editor.waitForSelector('#libraryCapture', {state: 'attached'});
}

async function activateWriter() {
  await writer.bringToFront();
  await writer.waitForFunction(() => document.hasFocus() && document.visibilityState === 'visible', null, {polling: 100});
  await editor.waitForFunction(() => !document.hasFocus() && document.visibilityState === 'hidden', null, {polling: 100});
  const activeURLs = await editor.evaluate(async () => (await chrome.tabs.query({active: true, currentWindow: true})).map(tab => tab.url));
  assert.ok(activeURLs.some(url => url?.startsWith(writerOrigin + '/')), 'Chrome must report the external writer as its active tab');
}

async function configure(patch) {
  const result = await editor.evaluate(patch => chrome.runtime.sendMessage({
    type: 'OSMINOG_COLLECTOR_CONFIGURE', patch
  }), patch);
  assert.equal(result?.ok, true, result?.error || 'Collector configuration was not acknowledged');
}

async function nativeCopyText(text) {
  await activateWriter();
  await writer.evaluate(text => navigator.clipboard.writeText(text), text);
  assert.equal(await writer.evaluate(() => navigator.clipboard.readText()), text);
}

async function nativeCopyImage(spec = imageSpec) {
  await activateWriter();
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
  }, {projectId, query}, {timeout: 20000, polling: 100});
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
    const summarize = projects => Array.isArray(projects) ? projects.map(p => ({
      id: p.id, objectCount: p.objects?.length,
      imageIds: (p.objects || []).filter(o => o.type === 'image').map(o => o.id),
      captures: (p.objects || []).filter(o => o.captureId).map(o =>
        ({id: o.id, captureId: o.captureId, type: o.type, folderId: o.osminogFolderId}))
    })) : null;
    return {config: storage[KEY], toast: document.querySelector('#toast')?.textContent,
      tabs: (await chrome.tabs.query({})).map(tab => ({id: tab.id, url: tab.url, active: tab.active})),
      queue: Object.entries(storage).filter(([k]) => k.startsWith(PREFIX)).map(([key, v]) =>
        ({key, id: v.id, kind: v.kind, projectId: v.projectId, folderId: v.folderId})),
      activeProject: state.activeProject, lastSaveError: state.lastSaveError,
      projects: summarize(state.projects),
      persisted: Object.fromEntries(['briefCraftStudioV2', 'briefCraftStudioV2Backup'].map(key =>
        [key, {activeProject: storage[key]?.activeProject, projects: summarize(storage[key]?.projects)}]))};
  }, {KEY, PREFIX});
}

(async () => {
  try {
    await launch();
    // This scenario explicitly enables capture. Pause BEFORE project creation:
    // new desks now initialize their Inbox and collector asynchronously.
    await configure({enabled: false});
    const ids = await editor.evaluate(async () => {
      state.language = 'ru';
      createProject(); document.querySelector('#osminogStorageOnboarding')?.close();
      const target = project(); target.name = 'Capture destination';
      const folder = OSMINOGWindowsFolders.create({name: 'Clipboard inbox', rename: false});
      const other = defaultProject('Other active desk'); state.projects.push(other);
      await persist();
      return {target: target.id, folder: folder.id, other: other.id};
    });
    await editor.evaluate(async()=>{await chrome.runtime.sendMessage({type:'OSMINOG_COLLECTOR_CONFIGURE',patch:{enabled:false}})});
    await editor.waitForFunction(async()=>!(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length);
    await nativeCopyText('pre-existing clipboard baseline');

    // Use the real settings UI for the existing saved-folder destination.
    await editor.bringToFront();
    await editor.locator('#libraryCapture').click();
    await editor.locator('#osminogLibrary [data-folder]').selectOption(ids.folder);
    await editor.locator('#osminogLibrary [data-destination]').click();
    await editor.waitForFunction(async ids => {
      const v = (await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1;
      return v?.projectId === ids.target && v?.folderId === ids.folder;
    }, ids, {polling: 100});
    await editor.waitForFunction(() => {
      const open = document.querySelector('#osminogLibrary [data-open-folder]');
      return open && !open.disabled;
    }, null, {polling: 100});
    assert.equal(await editor.evaluate(async()=>((await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1||{}).enabled),false,'fixture remains paused until the enable control');
    assert.equal(await captureCount(ids.target),0,'baseline cannot be captured while paused');
    await editor.locator('#osminogLibrary [data-enabled]').check();
    await editor.waitForFunction(async () => (await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length === 1, null, {polling: 100});
    await editor.locator('#osminogLibrary [data-close]').click();
    await editor.evaluate(async id => {openProject(id); await persist();}, ids.other);
    await activateWriter();
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
    await editor.waitForFunction(async () => !Object.keys(await chrome.storage.local.get(null)).some(k => k.startsWith('osminogCapture:')), null, {polling: 100});
    await writer.waitForTimeout(3200);
    assert.equal(await captureCount(ids.target), 2, 'Repeated polls must not duplicate clipboard items');
    record('external text and PNG reach the chosen folder while another desk and another tab are active; dimensions, pixels and dedupe verified');

    // This is the exact failed path from 4.0.20: ordinary Ctrl+V also invokes
    // library reuse/drain. Use the browser's actual paste event and clipboard.
    await editor.bringToFront();
    await editor.locator('#viewport').focus();
    await editor.keyboard.press('Control+v');
    await editor.waitForFunction(() => objects().some(o => o.type === 'image'), null, {polling: 100});
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
    assert.equal(await editor.locator('#osminogWindowsExplorerStatus').textContent(), 'Элементы: 3');
    // 4.0.23 presents a readable numeric badge beneath the desktop folder name.
    // Keep the exact count and visible-label assertions, not the retired caption.
    const folderBadge = editor.locator(`[data-win-folder-id="${ids.folder}"] small`);
    assert.equal(await folderBadge.textContent(), '3');
    assert.equal(await folderBadge.isVisible(), true, 'The live numeric folder count must be visible');
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
    await editor.waitForFunction(async () => (await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length === 0, null, {polling: 100});
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
    await editor.waitForFunction(count => objects().filter(o => o.type === 'image').length === count + 1, beforePaste, {polling: 100});
    const second = await editor.evaluate(() => objects().filter(o => o.type === 'image').at(-1));
    await assertImage(second, secondSpec);
    assert.equal((await queueKeys()).includes('osminogCapture:malformed-qa'), true, 'Failed import must retain the queued data');
    await editor.evaluate(() => chrome.storage.local.remove('osminogCapture:malformed-qa'));
    record('pause stops collection; an unrelated malformed pending capture does not block native image paste or get discarded');

    // A queue entry left by 4.0.20 must be imported after upgrading/reloading.
    // Observe the real save completing; do not call persist() to repair a missed
    // manual-paste save. This separates save failure from reload failure.
    await editor.waitForFunction(async ({ids, manualId}) => {
      const saved = (await chrome.storage.local.get('briefCraftStudioV2')).briefCraftStudioV2;
      return saved?.projects.some(p => p.id === ids.target) &&
        saved.projects.find(p => p.id === ids.other)?.objects.some(o => o.id === manualId);
    }, {ids, manualId: second.id}, {timeout: 10000, polling: 100});
    record('both desks and the latest manual image are present in native storage before reload');
    await editor.evaluate(async ({ids, src}) => {
      await chrome.storage.local.set({'osminogCapture:legacy-qa': {
        id: 'legacy-qa', hash: 'legacy-fixture', at: Date.now(), kind: 'image', value: src,
        projectId: ids.target, folderId: ids.folder
      }});
    }, {ids, src: imageData});
    await editor.reload(); await ready();
    assert.equal(await editor.evaluate(ids => [ids.target, ids.other].every(id => state.projects.some(p => p.id === id)), ids), true,
      'Editor reload must restore both previously persisted projects');
    const recovered = await waitForCapture(ids.target, {id: 'legacy-qa'});
    await assertImage(recovered);
    assert.equal(recovered.osminogFolderId, ids.folder);
    await editor.waitForFunction(async () => !(await chrome.storage.local.get('osminogCapture:legacy-qa'))['osminogCapture:legacy-qa'], null, {polling: 100});
    const persisted = await editor.evaluate(async id => {
      const saved = await chrome.storage.local.get(null);
      const v = saved.briefCraftStudioV2;
      const journal = Object.entries(saved).filter(([key,e])=>key.startsWith('osminogItemEdit:')&&e.projectId===id&&e.kind==='capture').map(([,e])=>e.object);
      return new Set([...v.projects.find(p=>p.id===id).objects,...journal].filter(o=>o.captureId==='legacy-qa').map(o=>o.id)).size;
    }, ids.target);
    assert.equal(persisted, 1, 'Queue acknowledgement requires exactly one durable snapshot or replayable journal object');
    assert.equal(await editor.evaluate(id => objects().some(o => o.id === id), second.id), true, 'Manual paste must survive editor reload');
    record('pending 4.0.20 screenshot recovery and both automatic/manual images survive editor reload with one persisted object per capture');

    // A real browser restart also replaces the MV3 service worker and offscreen
    // document. Reuse the same temporary profile and check enabled-state resume.
    await configure({enabled: true, projectId: ids.target, folderId: null, lastHash: ''});
    await editor.evaluate(() => persist());
    await closeBrowser();
    await launch();
    await editor.waitForFunction(async () => (await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length === 1, null, {polling: 100});
    await activateWriter(); await writer.waitForTimeout(1800);
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
  } catch (error) {
    console.error('CLIPBOARD_EXTENSION_421_FAILURE', error);
    console.error('STATE', JSON.stringify(await snapshot().catch(() => null)));
    throw error;
  } finally {
    await closeBrowser();
    await fs.promises.rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  }
  console.log(JSON.stringify({result: 'CLIPBOARD_EXTENSION_421_PASS',checks, manifest: JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version}));
})().catch(error => {console.error(error); process.exitCode = 1;});
