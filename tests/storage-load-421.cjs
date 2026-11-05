// Exercise the real loader with Chrome's asynchronous callback contract. A
// callback-based storage.get returns undefined, not a signal of empty storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = process.env.OSMINOG_EDITOR_SOURCE || path.join(__dirname, '..', 'editor.js');
const source = fs.readFileSync(filename, 'utf8');
function actualFunction(name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\([^\\n]*', 'm').exec(source);
  assert.ok(match, 'Missing editor function: ' + name);
  if (match[0].trimEnd().endsWith('}')) return match[0];
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index, 'Missing function end: ' + name);
  return source.slice(match.index, end + 2);
}

(async () => {
  const saved = {
    briefCraftStudioV2: {
      language: 'ru', theme: 'light', activeProject: 'other',
      ui: {textSizeDefaultNormalV3144: true, threeThemeMigratedV31114: true},
      projects: [{id: 'target', name: 'Saved desk', objects: [{
        id: 'capture-legacy', captureId: 'legacy', type: 'image',
        src: 'data:image/png;base64,c2F2ZWQ=', osminogFolderId: 'inbox', capturedAt: 1700000000000
      }], osminogFolders: [{id: 'inbox', name: 'Inbox', members: ['capture-legacy']}]},
      {id: 'other', name: 'Active desk', objects: [{id: 'manual', type: 'brief', text: 'Saved manual paste'}]}]
    },
    briefCraftStudioV2Backup: {projects: [{id: 'older-backup', objects: []}]}
  };
  const reads = [], writes = [];
  const chrome = {
    runtime: {}, storage: {local: {get(keys, callback) {
      reads.push({keys, callback});
      return undefined; // Real Chrome callback overload: delivery happens later.
    }}}
  };
  const context = vm.createContext({
    chrome, URLSearchParams, location: {search: ''}, innerWidth: 1440, innerHeight: 1000,
    STORAGE_KEY: 'briefCraftStudioV2', STORAGE_BACKUP_KEY: 'briefCraftStudioV2Backup', LANGS: ['en', 'ru'],
    state: {projects: [], activeProject: null, ui: {}, connectionPreset: {}, view: {x: 0, y: 0, scale: 1}},
    loadPersistentHandle: async () => null,
    applyWorkspaceOverrides() {}, applyTheme() {}, applyInterfaceTextSize() {}, applyLanguage() {},
    syncProjectFolderButton() {}, applyPanelWidths() {}, renderProfile() {}, showWelcome() {},
    setTimeout(callback) {writes.push(callback); return writes.length;}, queuePersist() {writes.push('persist');}
  });
  vm.runInContext(['storageGet', 'uid', 'clone', 'project', 'defaultProject', 'normalizeProject', 'loadState', 'persistPayload']
    .map(actualFunction).join('\n'), context, {filename});

  const loading = vm.runInContext('globalThis.OSMINOGStateReady = loadState()', context);
  let loaded = false;
  loading.then(() => {loaded = true;});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(loaded, false, 'OSMINOGStateReady must wait for the asynchronous storage callback');
  assert.equal(writes.length, 0, 'An unfinished read must not schedule saving an empty workspace');
  assert.equal(reads.length, 1);
  reads.shift().callback(structuredClone(saved));
  await loading;
  const restored = JSON.parse(JSON.stringify(vm.runInContext('persistPayload().briefCraftStudioV2', context)));
  assert.deepEqual(restored.projects.map(p => p.id), ['target', 'other']);
  assert.equal(restored.activeProject, 'other');
  assert.equal(restored.language, 'ru');
  assert.equal(restored.theme, 'light');
  assert.equal(restored.projects[0].objects[0].captureId, 'legacy');
  assert.equal(restored.projects[0].objects[0].src, saved.briefCraftStudioV2.projects[0].objects[0].src);
  assert.deepEqual(restored.projects[0].osminogFolders[0].members, ['capture-legacy']);
  assert.equal(restored.projects[1].objects[0].text, 'Saved manual paste');

  const failedRead = vm.runInContext("storageGet('briefCraftStudioV2')", context);
  chrome.runtime.lastError = {message: 'Storage temporarily unavailable'};
  reads.shift().callback();
  delete chrome.runtime.lastError;
  await assert.rejects(failedRead, /Storage temporarily unavailable/);

  // Promise-only adapters must also work; desktop/adapter.js supports both
  // callbacks and returned Promises, unlike native Chrome's callback overload.
  chrome.storage.local.get = async () => structuredClone(saved);
  const promised = await vm.runInContext("storageGet('briefCraftStudioV2')", context);
  assert.equal(promised.briefCraftStudioV2.projects[0].objects[0].captureId, 'legacy');
  chrome.storage.local.get = async () => {throw Error('Promise storage failure');};
  await assert.rejects(vm.runInContext("storageGet('briefCraftStudioV2')", context), /Promise storage failure/);

  chrome.storage.local.get = (keys, callback) => {queueMicrotask(() => callback({}));};
  assert.deepEqual(JSON.parse(JSON.stringify(await vm.runInContext("storageGet('missing')", context))), {});
  context.chrome = undefined;
  assert.deepEqual(JSON.parse(JSON.stringify(await vm.runInContext("storageGet('missing')", context))), {});
  console.log('PASS async Chrome callback waits; real loadState restores projects, images, folder membership and manual paste; read errors reject; Promise adapters and missing API fallback work.');
})().catch(error => {console.error(error); process.exit(1);});
