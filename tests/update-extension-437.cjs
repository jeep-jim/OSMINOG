/* Real unpacked extension, native directory handles, package writes and reloads.
 * Build: node tools/build-updater-recovery.cjs
 * Run: xvfb-run -a node tests/update-extension-437.cjs
 * TEST_HEADLESS=1 selects Chromium's full headless mode for local development.
 *
 * Only the public feed/package responses and directory-consent setup are fixtures.
 * The selected directory is a disposable copy of the complete extension. CDP
 * supplies a native directory drag/drop; Chrome creates and serializes the real
 * FileSystemDirectoryHandle. No filesystem, storage or reload API is replaced.
 * The recovery HTML receives another native drop handle through a consent-only
 * showDirectoryPicker fixture; its real choose/install handlers write the files.
 * The native picker dialog itself is not exercised. A separate read-only probe
 * fetches one pinned public ZIP to verify the helper's real file-origin CORS path.
 * This does not certify the old updater or the owner's Windows installation.
 */
'use strict';

process.env.DEBUG = [process.env.DEBUG, 'pw:browser'].filter(Boolean).join(',');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {createHash, randomUUID} = require('node:crypto');
const {deflateRawSync} = require('node:zlib');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'osminog-update-437-'));
const installed = path.join(temp, 'extension');
const profile = path.join(temp, 'profile');
const artifacts = path.resolve('artifacts');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const extensionId = createHash('sha256').update(Buffer.from(manifest.key, 'base64'))
  .digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const origin = `chrome-extension://${extensionId}`;
const editorURL = `${origin}/editor.html`;
const popupURL = `${origin}/popup.html`;
const pendingKey = 'briefCraftReopenAfterUpdateV1';
const sentinelOrigin = 'https://update-sentinel.osminog.test';
const sentinelText = 'Unsaved browser work must survive the OSMINOG update.';
const retainedText = 'This note and its folder must survive every update.';
const retainedFileText = 'Native full-workspace update file sentinel Δ439';
const publicArchive = {
  url: 'https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/13c19d72cbbf4ed83c168e7d39a91e3df879942f/platforms/chrome-extension/releases/4.0.36/OSMINOG-Chrome-4.0.36.zip',
  size: 9526265,
  sha256: '3c71da62b7556d6cbf281441f311494957ae14108f46e9c2baa61c79a138da9b'
};
const runtimeFiles = [];
const checks = [], lifecycle = [], pageErrors = [];
const networkFixture = {feedResponses: 0, packageResponses: 0, aborted: 0, publicArchiveRequests: 0, packageOrigins: []};
const report = {
  scope: 'candidate updater in real Chromium; disposable native extension folder',
  legacyUpdaterExecuted: false,
  ownerWindowsTested: false,
  baseVersion: manifest.version,
  extensionId,
  checks,
  lifecycle,
  pageErrors,
  networkFixture,
  updates: []
};
let context, editor, sentinel, feedPackage, packageGate, closing = false, contextClosed = false, helperPackageFallback = false;
let packageRequests = 0;
let ids;

const record = label => { checks.push(label); console.log('PASS ' + label); };
const isEditor = url => url === editorURL || url.startsWith(editorURL + '?') || url.startsWith(editorURL + '#');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function copyRuntime() {
  const allowlist = JSON.parse(fs.readFileSync(path.join(root, 'tools/release-files-439.json'), 'utf8'));
  assert.equal(new Set(allowlist).size, allowlist.length);
  for (const rel of [...allowlist].sort()) {
    assert(!path.isAbsolute(rel) && !rel.split('/').includes('..'));
    fs.mkdirSync(path.dirname(path.join(installed, rel)), {recursive: true});
    fs.copyFileSync(path.join(root, rel), path.join(installed, rel));
    runtimeFiles.push(rel);
  }
  report.runtime = {files: runtimeFiles.length, allowlistSha256: createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'tools/release-files-439.json'))).digest('hex')};
}

// Generate normal deflated ZIP records, including CRC, without a network ZIP
// dependency. No update application logic is duplicated in this helper.
const crcTable = Uint32Array.from({length: 256}, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, bytes] of entries) {
    const filename = Buffer.from(name, 'utf8'), compressed = deflateRawSync(bytes);
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, compressed);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x800, 8); header.writeUInt16LE(8, 10);
    header.writeUInt32LE(crc, 16); header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(bytes.length, 24); header.writeUInt16LE(filename.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function nextVersion(step) {
  const parts = manifest.version.split('.').map(Number);
  while (parts.length < 4) parts.push(0);
  parts[3] += step;
  assert(parts[3] < 65536, 'Fixture version must fit the Chrome manifest range');
  return parts.join('.');
}

function makePackage(version) {
  const nextManifest = {...manifest, version, version_name: version};
  const entries = runtimeFiles.map(rel => {
    if (rel === 'manifest.json') return [rel, Buffer.from(JSON.stringify(nextManifest, null, 2) + '\n')];
    if (rel === 'OSMINOG_BUILD.json') {
      const build = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
      return [rel, Buffer.from(JSON.stringify({...build, version, versionName: version, manifestVersion: version}, null, 2) + '\n')];
    }
    return [rel, fs.readFileSync(path.join(root, rel))];
  });
  const body = zip(entries), sha256 = createHash('sha256').update(body).digest('hex');
  const name = `OSMINOG-Chrome-${version}-fixture.zip`;
  return {
    version, entries, body, sha256, name,
    url: `https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v${version}/${name}`
  };
}

function feed() {
  return {
    schema: 'osminog-update-feed/v2', product: 'OSMINOG', platform: 'chrome-extension', status: 'active',
    latest: {
      version: feedPackage.version, packageUrl: feedPackage.url,
      size: feedPackage.body.length, sha256: feedPackage.sha256, minUpdaterVersion: '2.0.0'
    }
  };
}

function observe(page) {
  page.on('pageerror', error => pageErrors.push({url: page.url(), message: error.message}));
  page.on('close', () => lifecycle.push({event: 'page-close', url: page.url(), at: Date.now()}));
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) lifecycle.push({event: 'page-navigation', url: frame.url(), at: Date.now()});
  });
  page.on('console', message => {
    if (message.type() === 'warning') lifecycle.push({event: 'warning', url: page.url(), text: message.text().slice(0, 400)});
    if (message.text().startsWith('UPDATE437_HANDOFF ')) lifecycle.push({event: 'handoff-storage', text: message.text().slice(18), at: Date.now()});
  });
}

async function ready(page) {
  await page.waitForFunction(() => !!globalThis.OSMINOGFolderUpdater && !!globalThis.OSMINOGStateReady);
  await page.evaluate(async () => {
    await OSMINOGStateReady;
    document.querySelector('#osminogStorageOnboarding')?.close();
  });
}

async function nativeFolderSetup() {
  const setup = await context.newPage();
  await setup.goto(`${origin}/update-test-setup.html`);
  await setup.evaluate(() => {
    globalThis.fixtureDrop = {pending: true};
    addEventListener('dragover', event => event.preventDefault());
    addEventListener('drop', async event => {
      event.preventDefault();
      try {
        // Obtain the promise in the drop task, before the protected data store
        // closes. The returned object is Chromium's native handle.
        const pendingHandle = event.dataTransfer.items[0].getAsFileSystemHandle();
        const handle = await pendingHandle;
        if (handle.kind !== 'directory') throw Error('The native drop did not provide a directory');
        const read = await handle.queryPermission({mode: 'read'});
        const write = await handle.queryPermission({mode: 'readwrite'});
        if (read !== 'granted' || write !== 'granted') throw Error(`Fixture directory consent failed: ${read}/${write}`);
        const file = await handle.getFileHandle('__native-write-probe.txt', {create: true});
        const writer = await file.createWritable();
        await writer.write('native-directory-confirmed'); await writer.close();
        const lockProbe = await handle.getFileHandle('__native-exclusive-probe.txt', {create: true});
        const firstWriter = await lockProbe.createWritable({mode: 'exclusive'});
        let rejectedSecondWriter = false;
        try {
          const secondWriter = await lockProbe.createWritable({mode: 'exclusive'});
          await secondWriter.abort();
        } catch (error) {
          if (error.name !== 'NoModificationAllowedError') throw error;
          rejectedSecondWriter = true;
        } finally { await firstWriter.abort(); }
        if (!rejectedSecondWriter) throw Error('Chrome silently ignored exclusive native write locking');
        await handle.removeEntry('__native-exclusive-probe.txt');
        const request = indexedDB.open('osminog-managed-folder-updater-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        const db = await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction('state', 'readwrite');
          tx.objectStore('state').put(handle, 'directoryHandle');
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
        });
        db.close();
        globalThis.fixtureDrop = {pending: false, kind: handle.kind, name: handle.name, read, write,
          native: handle instanceof FileSystemDirectoryHandle, exclusiveWriteLock: rejectedSecondWriter};
      } catch (error) {
        globalThis.fixtureDrop = {pending: false, error: error.message};
      }
    }, {once: true});
  });
  const cdp = await context.newCDPSession(setup);
  const data = {items: [], files: [installed], dragOperationsMask: 1};
  for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', {type, x: 160, y: 160, data});
  await setup.waitForFunction(() => !fixtureDrop.pending);
  const outcome = await setup.evaluate(() => fixtureDrop);
  assert.equal(outcome.error, undefined, outcome.error);
  assert.equal(outcome.native, true, 'Fixture must use a real native FileSystemDirectoryHandle');
  assert.equal(outcome.exclusiveWriteLock, true, 'Chromium must enforce native exclusive writes');
  assert.equal(fs.readFileSync(path.join(installed, '__native-write-probe.txt'), 'utf8'), 'native-directory-confirmed');
  fs.unlinkSync(path.join(installed, '__native-write-probe.txt'));
  report.directoryHandle = outcome;
  await cdp.detach(); await setup.close();
  fs.unlinkSync(path.join(installed, 'update-test-setup.html'));
  record('Chrome grants and persists a native handle to the disposable installed directory');
}

async function recoveryPageStartup() {
  const helperPath = path.join(root, 'artifacts', 'OSMINOG-Update-Recovery.html');
  assert(fs.existsSync(helperPath), 'Build the standalone recovery page before this test');
  const helper = await context.newPage();
  await helper.goto(pathToFileURL(helperPath).href);
  await helper.waitForFunction(() => !!globalThis.OSMINOGFolderUpdater &&
    !!document.querySelector('#helperVersion').textContent);
  assert.equal(await helper.locator('#chooseFolder').isEnabled(), true,
    'The real file:// recovery page must pass its browser capability check');
  const result = await helper.evaluate(async () => {
    const diagnostics = await OSMINOGFolderUpdater.diagnostics();
    const recovery = await OSMINOGFolderUpdater.recover();
    const release = await OSMINOGFolderUpdater.check();
    return {
      protocol: location.protocol,
      secureContext: isSecureContext,
      directoryPicker: typeof showDirectoryPicker === 'function',
      updaterVersion: OSMINOGFolderUpdater.version,
      runningVersion: diagnostics.runningVersion,
      emptyRecovery: recovery.ok && recovery.recovered === false,
      available: release.available,
      releaseVersion: release.latestVersion,
      source: release.source
    };
  });
  report.recoveryPageStartup = {...result, releaseNetworkFixture: true, folderSelectionExercised: false};
  assert.equal(result.protocol, 'file:');
  assert.equal(result.secureContext, true); assert.equal(result.directoryPicker, true);
  assert.equal(result.updaterVersion, '2.0.0'); assert.equal(result.runningVersion, '0.0.0');
  assert.equal(result.emptyRecovery, true, 'File-origin Web Lock and IndexedDB must be usable, not only exposed');
  assert.equal(result.available, true); assert.equal(result.releaseVersion, feedPackage.version);
  await helper.close();
  record('standalone file:// recovery executes under its real CSP and uses Web Locks, IndexedDB and the fixture feed');
}

async function installWithRecoveryPage(version) {
  feedPackage = makePackage(version);
  const helper = await context.newPage();
  await helper.goto(pathToFileURL(path.join(root, 'artifacts', 'OSMINOG-Update-Recovery.html')).href);
  await helper.waitForFunction(() => !!globalThis.OSMINOGFolderUpdater);
  const live = await helper.evaluate(async archive => {
    const bytes = await OSMINOGFolderUpdater.__test.fetchBytes(archive.url, {limit: archive.size, timeout: 60000});
    return {bytes: bytes.byteLength, sha256: await OSMINOGFolderUpdater.__test.sha256(bytes)};
  }, publicArchive);
  report.publicArchiveProbe = {...live, url: publicArchive.url, source: 'real network; immutable registry commit', installed: false};
  assert.equal(live.bytes, publicArchive.size); assert.equal(live.sha256, publicArchive.sha256);
  record('file:// recovery reads the real pinned public raw ZIP under CSP and verifies its exact size/SHA-256');

  await helper.evaluate(() => {
    globalThis.fixtureDrop = {pending: true};
    addEventListener('dragover', event => event.preventDefault());
    addEventListener('drop', async event => {
      event.preventDefault();
      try {
        const pending = event.dataTransfer.items[0].getAsFileSystemHandle();
        const handle = await pending;
        if (!(handle instanceof FileSystemDirectoryHandle)) throw Error('Recovery fixture needs a native directory handle');
        const read = await handle.queryPermission({mode: 'read'});
        const write = await handle.queryPermission({mode: 'readwrite'});
        if (read !== 'granted' || write !== 'granted') throw Error(`Recovery directory consent failed: ${read}/${write}`);
        globalThis.fixturePickerCalls = 0;
        // Replace only native-dialog selection. The returned handle, subsequent
        // permission queries and every read/write/IDB operation remain native.
        globalThis.showDirectoryPicker = async () => { fixturePickerCalls++; return handle; };
        globalThis.fixtureDrop = {pending: false, native: true, name: handle.name, read, write};
      } catch (error) { globalThis.fixtureDrop = {pending: false, error: error.message}; }
    }, {once: true});
  });
  const cdp = await context.newCDPSession(helper);
  const data = {items: [], files: [installed], dragOperationsMask: 1};
  for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', {type, x: 160, y: 160, data});
  await helper.waitForFunction(() => !fixtureDrop.pending);
  const handle = await helper.evaluate(() => fixtureDrop);
  assert.equal(handle.error, undefined, handle.error); assert.equal(handle.native, true);
  await cdp.detach();
  await helper.locator('#chooseFolder').click();
  await helper.waitForFunction(version => document.querySelector('#targetVersion').textContent === version &&
    !document.querySelector('#installUpdate').disabled, version);
  assert.equal(await helper.evaluate(() => fixturePickerCalls), 1);
  const before = packageRequests, originsBefore = networkFixture.packageOrigins.length;
  let unblock;
  packageGate = new Promise(resolve => { unblock = resolve; });
  helperPackageFallback = true;
  await helper.locator('#installUpdate').click({clickCount: 2, delay: 20});
  const downloadDeadline = Date.now() + 15000;
  while (packageRequests === before && Date.now() < downloadDeadline) await delay(50);
  assert.equal(packageRequests, before + 1);
  assert.equal(await helper.locator('#installUpdate').isDisabled(), true);
  await helper.locator('#installUpdate').evaluate(button => button.click());
  unblock(); packageGate = null;
  await helper.waitForFunction(() => ['success', 'error'].includes(document.querySelector('#statusPanel').dataset.kind), null, {timeout: 150000});
  assert.equal(await helper.locator('#statusPanel').getAttribute('data-kind'), 'success',
    await helper.locator('#statusDetail').innerText());
  assert.equal(await helper.locator('#nextSteps').isVisible(), true);
  helperPackageFallback = false;
  const origins = networkFixture.packageOrigins.slice(originsBefore);
  assert.deepEqual(origins, ['https://github.com', 'https://raw.githubusercontent.com'],
    'File-origin update must recover from the primary network failure with exactly one raw fallback');
  assert.equal(packageRequests - before, 2, 'One helper installation uses one failed primary and one verified fallback');
  assert.equal(JSON.parse(fs.readFileSync(path.join(installed, 'manifest.json'), 'utf8')).version, version);
  assert.equal(fs.existsSync(path.join(installed, '.osminog-update.pending.json')), false);
  const diagnostics = await helper.evaluate(() => OSMINOGFolderUpdater.diagnostics());
  assert.equal(diagnostics.pending, null); assert.equal(diagnostics.installed.to, version);
  assert.equal(await editor.evaluate(() => chrome.runtime.getManifest().version), nextVersion(2),
    'The helper must not reload the extension on its own');
  report.helperInstall = {version, handle, diagnostics, packageOrigins: origins, nativePickerDialogExercised: false};
  await helper.screenshot({path: path.join(artifacts, 'update-recovery-437.png')});
  await helper.close();
  record('real recovery choose/install UI updates native files from file:// with raw fallback and no automatic extension reload');
}

async function persistedSnapshot(page) {
  return page.evaluate(async ({projectId, noteId, fileId, folderId, key}) => {
    await OSMINOGStateReady;
    const stored = await chrome.storage.local.get(['briefCraftStudioV2', 'update437Sentinel', key]);
    const p = stored.briefCraftStudioV2?.projects?.find(p => p.id === projectId);
    return {
      version: chrome.runtime.getManifest().version,
      projectName: p?.name,
      text: p?.objects?.find(o => o.id === noteId)?.text,
      fileText: await (await fetch(p.objects.find(o => o.id === fileId).src)).text(),
      noteFolder: p?.objects?.find(o => o.id === noteId)?.osminogFolderId,
      folderMembers: p?.osminogFolders?.find(f => f.id === folderId)?.members,
      marker: stored[key] || null,
      sentinel: stored.update437Sentinel
    };
  }, {projectId: ids.project, noteId: ids.note, fileId: ids.file, folderId: ids.folder, key: pendingKey});
}

async function waitForUpdatedEditor(version) {
  const deadline = Date.now() + 90000;
  let lastStatus;
  while (Date.now() < deadline) {
    assert.equal(contextClosed, false, 'Updating the extension must not close the browser context');
    for (const candidate of context.pages()) {
      if (candidate.isClosed() || !isEditor(candidate.url())) continue;
      try {
        const state = await candidate.evaluate(async ({version, key}) => {
          if (!globalThis.chrome?.runtime?.id || !globalThis.OSMINOGStateReady) return {ready: false};
          await OSMINOGStateReady;
          return {
            ready: chrome.runtime.getManifest().version === version && !(await chrome.storage.local.get(key))[key],
            version: chrome.runtime.getManifest().version,
            status: document.querySelector('#updateStatusText')?.textContent,
            detail: document.querySelector('#updateStatusSub')?.textContent
          };
        }, {version, key: pendingKey});
        lastStatus = state;
        if (state.ready) { await ready(candidate); return candidate; }
      } catch (error) { lastStatus = {transient: error.message}; }
    }
    await delay(100);
  }
  throw Error(`The updated editor did not acknowledge ${version}: ${JSON.stringify(lastStatus)}`);
}

async function assertUpdated(version, previousDownloads, expectedDownloads = 1) {
  editor = await waitForUpdatedEditor(version);
  assert.equal(fs.readFileSync(path.join(installed, 'manifest.json'), 'utf8'),
    feedPackage.entries.find(([name]) => name === 'manifest.json')[1].toString());
  assert.equal(packageRequests - previousDownloads, expectedDownloads, 'Each installation downloads exactly one package');
  assert.equal(context.pages().filter(page => !page.isClosed() && isEditor(page.url())).length, 1, 'A reload must reopen exactly one editor');
  const saved = await persistedSnapshot(editor);
  assert.equal(saved.version, version); assert.equal(saved.text, retainedText);
  assert.equal(saved.fileText, retainedFileText);
  assert.equal(saved.noteFolder, ids.folder); assert(saved.folderMembers?.includes(ids.note));
  assert.equal(saved.projectName, 'Native update regression');
  assert.equal(saved.sentinel, ids.sentinel); assert.equal(saved.marker, null);
  assert.equal(fs.readFileSync(path.join(installed, 'user-documents', 'keep.txt'), 'utf8'), 'not an extension file');
  assert.equal(fs.statSync(path.join(installed, 'user-documents', 'large-sparse.bin')).size, 256 * 1024 * 1024);
  const diagnostics = await editor.evaluate(() => OSMINOGFolderUpdater.diagnostics());
  const backup = await editor.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('osminog-managed-folder-updater-v1', 2);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get('lastBackupV2');
      let metadata;
      request.onsuccess = () => {
        const saved = request.result;
        metadata = saved ? {
          phase: saved.phase, from: saved.from, to: saved.to,
          paths: saved.entries.map(entry => entry.path),
          bytes: saved.entries.reduce((sum, entry) => sum + (entry.size || 0), 0)
        } : null;
      };
      tx.oncomplete = () => { db.close(); resolve(metadata); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
  });
  assert(backup, 'A committed update retains its file-scoped backup metadata');
  assert.equal(backup.phase, 'committed');
  assert.equal(backup.paths.at(-1), 'manifest.json');
  assert.deepEqual([...backup.paths].sort(), [...runtimeFiles].sort(),
    'Backup may contain only package paths, never unrelated folders or their large files');
  assert(backup.bytes < 256 * 1024 * 1024, 'The unrelated 256 MiB file must not enter the backup');
  report.updates.push({version, saved, diagnostics,
    backup: {from: backup.from, to: backup.to, files: backup.paths.length, bytes: backup.bytes},
    downloads: packageRequests - previousDownloads});
  return saved;
}

async function clickUpdateWithDuplicateAttempt(version) {
  feedPackage = makePackage(version);
  await editor.evaluate(() => { showApp(true); document.querySelector('#osminogStorageOnboarding')?.close(); });
  await editor.locator('#versionButton').click();
  await editor.waitForFunction(version => !document.querySelector('#oneClickUpdate').disabled &&
    document.querySelector('#updateStatusText').textContent.includes(version), version);
  let unblock;
  packageGate = new Promise(resolve => { unblock = resolve; });
  const before = packageRequests;
  await editor.locator('#oneClickUpdate').click({clickCount: 2, delay: 20});
  const deadline = Date.now() + 15000;
  while (packageRequests === before && Date.now() < deadline) await delay(50);
  assert.equal(packageRequests, before + 1, 'The button must begin one package request');
  assert.equal(await editor.locator('#oneClickUpdate').isDisabled(), true, 'Update button stays disabled while the transaction runs');
  // A fast duplicate UI action cannot queue a second writer or another download.
  await editor.locator('#oneClickUpdate').evaluate(button => button.click());
  await delay(100);
  assert.equal(packageRequests, before + 1);
  unblock(); packageGate = null;
  await assertUpdated(version, before);
}

async function diagnostics() {
  const pages = [], workers = [];
  for (const page of context?.pages() || []) {
    const item = {url: page.url(), closed: page.isClosed()};
    try {
      item.state = await page.evaluate(async key => ({
        version: globalThis.chrome?.runtime?.getManifest?.().version,
        ready: document.readyState,
        pending: globalThis.chrome?.storage?.local ? (await chrome.storage.local.get(key))[key] : null,
        status: document.querySelector('#updateStatusText')?.textContent,
        detail: document.querySelector('#updateStatusSub')?.textContent,
        recoveryStatus: document.querySelector('#statusTitle')?.textContent,
        recoveryDetail: document.querySelector('#statusDetail')?.textContent,
        updater: globalThis.OSMINOGFolderUpdater?.diagnostics ? await OSMINOGFolderUpdater.diagnostics() : null
      }), pendingKey);
      if (isEditor(page.url())) await page.screenshot({path: path.join(artifacts, 'update-extension-437-failure.png')});
    } catch (error) { item.error = error.message; }
    pages.push(item);
  }
  for (const worker of context?.serviceWorkers() || []) {
    const item = {url: worker.url()};
    try { item.state = await worker.evaluate(async key => ({version: chrome.runtime.getManifest().version,
      pending: (await chrome.storage.local.get(key))[key], tabs: (await chrome.tabs.query({})).map(t => ({id: t.id, windowId: t.windowId, url: t.url}))}), pendingKey); }
    catch (error) { item.error = error.message; }
    workers.push(item);
  }
  const disk = {};
  try {
    const raw = fs.readFileSync(path.join(installed, 'manifest.json'));
    const current = JSON.parse(raw.toString());
    disk.manifest = {version: current.version, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex')};
    const pending = path.join(installed, '.osminog-update.pending.json');
    disk.pending = fs.existsSync(pending) ? fs.readFileSync(pending, 'utf8').slice(0, 8192) : null;
    disk.packageMismatches = (feedPackage?.entries || []).flatMap(([name, expected]) => {
      try { return fs.readFileSync(path.join(installed, name)).equals(expected) ? [] : [name]; }
      catch (error) { return [`${name}: ${error.code}`]; }
    });
  } catch (error) { disk.error = error.message; }
  let extensionManager;
  if (context && !contextClosed) {
    try {
      const manager = await context.newPage(); await manager.goto('chrome://extensions');
      extensionManager = await manager.evaluate(() => new Promise(resolve => {
        if (!chrome.developerPrivate?.getExtensionsInfo) return resolve({error: 'Developer diagnostics API unavailable', text: document.body.innerText});
        chrome.developerPrivate.getExtensionsInfo({includeDisabled: true, includeTerminated: true}, extensions => resolve({
          error: chrome.runtime.lastError?.message,
          extensions: extensions?.map(item => ({id: item.id, name: item.name, state: item.state, location: item.location,
            path: item.path, disableReasons: item.disableReasons, manifestErrors: item.manifestErrors, runtimeErrors: item.runtimeErrors}))
        }));
      }));
      await manager.close();
    } catch (error) { extensionManager = {error: error.message}; }
  }
  return {pages, workers, contextClosed, disk, extensionManager};
}

async function main() {
  fs.mkdirSync(artifacts, {recursive: true});
  copyRuntime();
  fs.writeFileSync(path.join(installed, 'update-test-setup.html'), '<!doctype html><meta charset="utf-8"><title>Native updater directory fixture</title><p>Disposable fixture directory drop target</p>');
  fs.mkdirSync(path.join(installed, 'user-documents'));
  fs.writeFileSync(path.join(installed, 'user-documents', 'keep.txt'), 'not an extension file');
  const sparse = fs.openSync(path.join(installed, 'user-documents', 'large-sparse.bin'), 'w');
  fs.ftruncateSync(sparse, 256 * 1024 * 1024); fs.closeSync(sparse);
  fs.mkdirSync(path.join(profile, 'Default'), {recursive: true});
  // Pre-authorize directory consent for the extension and local helper only in
  // this disposable profile. The actual native handles still come from a drop.
  // Chrome supports ALLOW for per-origin file-system guards, but not as their
  // global default. No existing browser profile or its permissions is changed.
  const permissionSetting = {setting: 1, last_modified: String(BigInt(Date.now()) * 1000n + 11644473600000000n)};
  const consent = {[`${origin},*`]: permissionSetting, 'file:///*,*': permissionSetting};
  fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), JSON.stringify({
    profile: {content_settings: {exceptions: {file_system_read_guard: consent, file_system_write_guard: consent}}}
  }));
  feedPackage = makePackage(nextVersion(1));
  context = await chromium.launchPersistentContext(profile, {
    headless: process.env.TEST_HEADLESS === '1',
    executablePath: process.env.TEST_CHROMIUM || chromium.executablePath(),
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-logging=stderr', `--disable-extensions-except=${installed}`, `--load-extension=${installed}`],
    viewport: {width: 1440, height: 1000}
  });
  context.setDefaultTimeout(15000);
  context.on('close', () => { if (!closing) contextClosed = true; });
  context.pages().forEach(observe); context.on('page', observe);
  context.on('serviceworker', worker => lifecycle.push({event: 'service-worker', url: worker.url(), at: Date.now()}));
  // Observe native worker failures from an unrelated tab which survives reload.
  const workerMonitor = await context.newCDPSession(context.pages()[0]);
  workerMonitor.on('ServiceWorker.workerErrorReported', event => lifecycle.push({event: 'worker-error', detail: event, at: Date.now()}));
  workerMonitor.on('ServiceWorker.workerVersionUpdated', event => lifecycle.push({event: 'worker-version', detail: event, at: Date.now()}));
  await workerMonitor.send('ServiceWorker.enable');
  // A protocol-only glob such as 'https://**' is normalized as a hostname and
  // gains a trailing slash. RegExp matches the full feed/package paths too.
  await context.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.href === publicArchive.url) { networkFixture.publicArchiveRequests++; return route.continue(); }
    if (url.origin === sentinelOrigin) return route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Unrelated unsaved work</title><textarea id="draft"></textarea>'});
    if (url.pathname.endsWith('/channels/dev/chrome-extension.json')) {
      networkFixture.feedResponses++;
      const data = JSON.stringify(feed());
      return route.fulfill({contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: url.hostname === 'api.github.com'
        ? JSON.stringify({content: Buffer.from(data).toString('base64'), encoding: 'base64'}) : data});
    }
    if (url.pathname.endsWith('/' + feedPackage.name)) {
      packageRequests++;
      networkFixture.packageResponses++;
      networkFixture.packageOrigins.push(url.origin);
      const selected = feedPackage;
      const gate = packageGate;
      if (gate) await gate;
      if (helperPackageFallback && url.hostname === 'github.com') {
        // Playwright's fulfill path supplies CORS support, so it cannot model a
        // missing-ACAO response. Exercise a concrete primary transport failure;
        // the separate unmocked raw-archive probe checks real file-origin CORS.
        return route.abort('failed');
      }
      return route.fulfill({contentType: 'application/zip', headers: {'access-control-allow-origin': '*'}, body: selected.body});
    }
    networkFixture.aborted++;
    return route.abort();
  });
  // Use the actual Chrome setting so runtime.reload remains a supported unpacked
  // extension reload. Keep this separate from any extension application code.
  const manager = await context.newPage(); await manager.goto('chrome://extensions');
  const toggle = manager.locator('#devMode'); await toggle.waitFor();
  const initiallyEnabled = await toggle.evaluate(el => el.checked);
  if (initiallyEnabled) await toggle.click();
  await toggle.click();
  report.developerModeSetup = {initiallyEnabled, clicked: true};
  assert.equal(await toggle.evaluate(el => el.checked), true);
  report.developerModeSetup.profile = await manager.evaluate(() => new Promise(resolve => {
    if (!chrome.developerPrivate?.getProfileConfiguration) return resolve(null);
    chrome.developerPrivate.getProfileConfiguration(configuration => resolve(configuration));
  }));
  await manager.close();
  await recoveryPageStartup();
  await nativeFolderSetup();
  const setupWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await setupWorker.evaluate(() => chrome.storage.local.set({osminogCollectorV1: {enabled: false}}));

  sentinel = await context.newPage(); await sentinel.goto(sentinelOrigin + '/');
  const sentinelEpoch = randomUUID();
  await sentinel.locator('#draft').fill(sentinelText);
  await sentinel.evaluate(epoch => { window.fixtureEpoch = epoch; localStorage.setItem('survive-update', epoch); }, sentinelEpoch);
  editor = await context.newPage(); await editor.goto(editorURL + '?view=desk'); await ready(editor);
  await editor.evaluate(key => chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[key]) console.info('UPDATE437_HANDOFF ' + JSON.stringify(changes[key]));
  }), pendingKey);
  ids = await editor.evaluate(async ({retainedText, fileSource}) => {
    createProject(); document.querySelector('#osminogStorageOnboarding')?.close();
    const p = project(); p.name = 'Native update regression'; p.objects = []; p.osminogFolders = [];
    const folder = OSMINOGWindowsFolders.create({name: 'Retained folder', rename: false});
    const note = createObject('brief', {name: 'Retained note', text: retainedText});
    note.osminogFolderId = folder.id; folder.members.push(note.id);
    const file = createObject('file', {name: 'Retained source file', fileName: 'retained.txt', mime: 'text/plain', src: fileSource});
    file.osminogFolderId = folder.id; folder.members.push(file.id);
    const marker = crypto.randomUUID();
    await chrome.storage.local.set({update437Sentinel: marker, osminogCollectorV1: {enabled: false, projectId: p.id, folderId: folder.id, error: ''}});
    clearTimeout(state.saveTimer); await persist();
    return {project: p.id, note: note.id, file: file.id, folder: folder.id, sentinel: marker};
  }, {retainedText, fileSource: 'data:text/plain;charset=utf-8;base64,' + Buffer.from(retainedFileText).toString('base64')});

  await editor.evaluate(async ({key, from, to}) => {
    await chrome.storage.local.set({[key]: {at: Date.now(), from, to, phase: 'ready-to-reload', url: 'editor.html'}});
    await chrome.runtime.sendMessage({type: 'OSMINOG_EDITOR_READY', version: from}).catch(() => {});
    if (!(await chrome.storage.local.get(key))[key]) throw Error('Old editor consumed the new-version marker');
    await chrome.runtime.sendMessage({type: 'OSMINOG_EDITOR_READY', version: to}).catch(() => {});
    if (!(await chrome.storage.local.get(key))[key]) throw Error('Old runtime accepted a forged new-version acknowledgement');
    await chrome.storage.local.remove(key);
  }, {key: pendingKey, from: manifest.version, to: nextVersion(1)});
  record('an old editor cannot consume the pending new-version handoff');

  await clickUpdateWithDuplicateAttempt(nextVersion(1));
  assert.equal(sentinel.isClosed(), false);
  assert.equal(await sentinel.locator('#draft').inputValue(), sentinelText);
  assert.deepEqual(await sentinel.evaluate(() => [window.fixtureEpoch, localStorage.getItem('survive-update')]), [sentinelEpoch, sentinelEpoch]);
  record('actual button update changes native files/version once and preserves unrelated unsaved browser work');

  // Reproduce the last-window shape without terminating a real user's browser:
  // one editor in a popup window, with every ordinary tab in this test closed.
  const popupInfo = await editor.evaluate(url => chrome.windows.create({type: 'popup', url, width: 1440, height: 1000}), editorURL + '?view=desk&update-fixture=last-popup');
  const popupDeadline = Date.now() + 15000;
  let popupEditor;
  while (!popupEditor && Date.now() < popupDeadline) {
    popupEditor = context.pages().find(page => page.url().includes('update-fixture=last-popup'));
    if (!popupEditor) await delay(50);
  }
  assert(popupEditor, 'Chrome did not open the disposable popup'); await ready(popupEditor);
  await popupEditor.evaluate(async id => { openProject(id); clearTimeout(state.saveTimer); await persist(); }, ids.project);
  for (const page of context.pages()) if (page !== popupEditor && !page.isClosed()) await page.close();
  editor = popupEditor;
  const windows = await editor.evaluate(() => chrome.windows.getAll());
  assert.equal(windows.length, 1); assert.equal(windows[0].type, 'popup'); assert.equal(windows[0].id, popupInfo.id);
  await clickUpdateWithDuplicateAttempt(nextVersion(2));
  assert.equal(contextClosed, false);
  record('updating from the only remaining popup keeps Chrome alive and restores exactly one editor');

  // Bootstrap/cache fixture: the popup code loaded before external repair is
  // deliberately different. The real helper UI performs the complete repair.
  fs.writeFileSync(path.join(installed, 'popup.html'), '<!doctype html><title>Legacy popup fixture</title><script src="popup.js"></script>');
  fs.writeFileSync(path.join(installed, 'popup.js'), 'document.documentElement.dataset.legacyPopupFixture="loaded";');
  const legacyPopup = await context.newPage(); await legacyPopup.goto(popupURL);
  await legacyPopup.waitForFunction(() => document.documentElement.dataset.legacyPopupFixture === 'loaded');
  assert.equal(await legacyPopup.evaluate(() => chrome.runtime.getManifest().version), nextVersion(2));
  await legacyPopup.close();
  await installWithRecoveryPage(nextVersion(3));
  const repairedPopup = await context.newPage(); await repairedPopup.goto(popupURL);
  assert.equal(await repairedPopup.evaluate(() => chrome.runtime.getManifest().version), nextVersion(2), 'Disk repair must not silently reload the extension');
  const disk = await repairedPopup.evaluate(async () => (await (await fetch(chrome.runtime.getURL('manifest.json'), {cache: 'no-store'})).json()).version);
  assert.equal(disk, nextVersion(3), 'A newly opened popup must read the repaired manifest before runtime.reload');
  await repairedPopup.waitForFunction(version => document.documentElement.dataset.pendingUpdate === version, nextVersion(3));
  assert.equal(await repairedPopup.locator('#today').isDisabled(), true);
  assert.equal(await repairedPopup.locator('#screenshot').isDisabled(), true);
  assert.match(await repairedPopup.locator('#open').innerText(), /Finish update|Завершить обновление/);
  const downloadsBeforeBootstrap = packageRequests;
  await repairedPopup.locator('#open').click();
  await assertUpdated(nextVersion(3), downloadsBeforeBootstrap, 0);
  record('a newly opened popup loads repaired on-disk code and completes the update without the legacy updater');
  report.bootstrap = {diskVersionBeforeReload: disk, runtimeVersionBeforeReload: nextVersion(2),
    externalInstallation: 'real recovery HTML choose/install UI with native directory handle', nativePickerDialogExercised: false};

  assert.deepEqual(pageErrors, [], 'Extension pages must not throw unhandled errors during update/recovery');
  await editor.screenshot({path: path.join(artifacts, 'update-extension-437.png')});
}

main().then(() => {
  report.ok = true;
}).catch(async error => {
  report.ok = false; report.error = error.stack || error.message;
  Object.assign(report, await diagnostics());
  console.error('UPDATE_EXTENSION_DIAGNOSTICS', JSON.stringify(report));
  process.exitCode = 1;
}).finally(async () => {
  fs.mkdirSync(artifacts, {recursive: true});
  fs.writeFileSync(path.join(artifacts, 'update-extension-437-results.json'), JSON.stringify(report, null, 2) + '\n');
  closing = true;
  await context?.close().catch(error => { console.error('Browser cleanup failed:', error.message); process.exitCode = 1; });
  await fs.promises.rm(temp, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
});
