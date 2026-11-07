'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {webcrypto, createHash} = require('node:crypto'), {deflateRawSync} = require('node:zlib');
const source = fs.readFileSync(path.join(__dirname, '../osminog-folder-updater.js'), 'utf8');
const oldManifest = {name: 'OSMINOG', manifest_version: 3, key: 'fixed-fixture-key', version: '4.0.36'};
const nextManifest = {...oldManifest, version: '4.0.37'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function crc(bytes) { let n = 0xffffffff; for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; } return (n ^ 0xffffffff) >>> 0; }
function zip(items) {
  const local = [], central = []; let offset = 0;
  for (const item of items) {
    const name = Buffer.from(item.path), raw = Buffer.from(item.data || ''), method = item.deflate ? 8 : 0;
    const packed = item.deflate ? deflateRawSync(raw) : raw, size = item.size ?? raw.length, checksum = item.crc ?? crc(raw), flags = item.descriptor ? 8 : 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt16LE(flags, 6); h.writeUInt16LE(method, 8);
    if (!flags) { h.writeUInt32LE(checksum, 14); h.writeUInt32LE(packed.length, 18); h.writeUInt32LE(size, 22); }
    h.writeUInt16LE(name.length, 26);
    const descriptor = item.descriptor ? Buffer.alloc(16) : Buffer.alloc(0);
    if (descriptor.length) { descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(checksum, 4); descriptor.writeUInt32LE(packed.length, 8); descriptor.writeUInt32LE(size, 12); }
    local.push(h, name, packed, descriptor);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(0x314, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(flags, 8); c.writeUInt16LE(method, 10);
    c.writeUInt32LE(checksum, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(size, 24); c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(((item.mode ?? (item.path.endsWith('/') ? 0x41ed : 0x81a4)) << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, name); offset += h.length + name.length + packed.length + descriptor.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(items.length, 8); end.writeUInt16LE(items.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
const packageItems = () => [{path: 'manifest.json', data: JSON.stringify(nextManifest)}, {path: 'new/feature.js', data: 'new feature'}, {path: 'editor.js', data: 'new editor', deflate: true}, {path: 'empty.txt', data: ''}];
const err = (name, message = name) => Object.assign(new Error(message), {name});
function clone(value) {
  if (!value || typeof value !== 'object') return value;
  if (value.__directory || value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(clone);
  const result = {}; for (const [k, v] of Object.entries(value)) result[k] = clone(v); return result;
}
// Deterministic IDB fixture. Browser integration separately exercises actual IDB and native FSA handles.
function database(root) {
  const stores = new Map([['state', new Map([['directoryHandle', root]])]]), reads = [], writes = [];
  const api = {open() {
    const request = {};
    const db = {objectStoreNames: {contains: name => stores.has(name)}, createObjectStore: name => stores.set(name, new Map()), close() {},
      transaction(name, mode) {
        const tx = {}, draft = new Map(stores.get(name)); let aborted = false;
        tx.objectStore = () => ({
          get(key) { reads.push([name, key]); const req = {}; queueMicrotask(() => { req.result = clone(draft.get(key)); req.onsuccess?.(); }); return req; },
          put(value, key) { draft.set(key, clone(value)); writes.push([name, key]); return {}; },
          delete(key) { draft.delete(key); return {}; }
        });
        tx.abort = () => { aborted = true; queueMicrotask(() => tx.onabort?.()); };
        setImmediate(() => { if (aborted) return; if (mode === 'readwrite') stores.set(name, draft); tx.oncomplete?.(); }); return tx;
      }};
    queueMicrotask(() => { request.result = db; if (!stores.has('backupFiles')) request.onupgradeneeded?.(); request.onsuccess?.(); }); return request;
  }};
  return {api, stores, reads, writes, state: () => stores.get('state')};
}
function filesystem() {
  const files = new Map(), dirs = new Set(['']), nativeLocks = new Set(), reads = [], events = []; let fault = null;
  const set = (name, data, size) => { files.set(name, {data: Buffer.from(data), size: size ?? Buffer.byteLength(data), revision: (files.get(name)?.revision || 0) + 1}); const parts = name.split('/'); parts.pop(); while (parts.length) { dirs.add(parts.join('/')); parts.pop(); } };
  function directory(prefix = '') {
    return {__directory: true, kind: 'directory', name: prefix || 'OSMINOG', prefix, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      isSameEntry: async other => other?.__directory && other.owner === files && other.prefix === prefix,
      owner: files,
      entries() { throw Error('Recursive directory enumeration is forbidden'); },
      async getDirectoryHandle(name, options = {}) {
        const full = prefix ? prefix + '/' + name : name;
        if (files.has(full)) throw err('TypeMismatchError');
        if (!dirs.has(full)) { if (!options.create) throw err('NotFoundError'); dirs.add(full); events.push(['mkdir', full]); }
        return directory(full);
      },
      async getFileHandle(name, options = {}) {
        const full = prefix ? prefix + '/' + name : name;
        if (dirs.has(full)) throw err('TypeMismatchError');
        if (!files.has(full)) { if (!options.create) throw err('NotFoundError'); set(full, ''); events.push(['create', full]); }
        return {kind: 'file', name,
          async getFile() { const original = files.get(full), revision = original.revision; return {name, size: original.size, async arrayBuffer() {
            reads.push(full); if (files.get(full)?.revision !== revision) throw err('NotReadableError', 'FSA snapshot became stale');
            if (original.size > 16 * 1024 * 1024) throw Error('Oversized file bytes must not be read');
            return original.data.buffer.slice(original.data.byteOffset, original.data.byteOffset + original.data.byteLength);
          }}; },
          async createWritable(options = {}) {
            const exclusive = options.mode === 'exclusive';
            if (exclusive && nativeLocks.has(full)) throw err('NoModificationAllowedError');
            if (exclusive) nativeLocks.add(full);
            let bytes;
            return {async write(data) { bytes = Buffer.from(data instanceof Blob ? await data.arrayBuffer() : data); }, async close() {
              events.push(['write', full]); set(full, bytes || ''); nativeLocks.delete(full);
              if (fault?.(full)) throw err('UnknownError', 'Injected disk write failure');
            }, async abort() { if (exclusive) nativeLocks.delete(full); }};
          }};
      },
      async removeEntry(name, options = {}) {
        assert.notEqual(options.recursive, true); const full = prefix ? prefix + '/' + name : name;
        if (files.has(full)) files.delete(full);
        else if (dirs.has(full)) { if ([...dirs, ...files.keys()].some(p => p.startsWith(full + '/'))) throw err('InvalidModificationError'); dirs.delete(full); }
        else throw err('NotFoundError');
        events.push(['remove', full]);
      }};
  }
  set('manifest.json', JSON.stringify(oldManifest)); set('editor.js', 'original editor'); set('empty.txt', '');
  set('user-documents/large-video.bin', '', 256 * 1024 * 1024); set('.osminog/workspace-memory.json', 'PRIVATE DATA'); set('.git/objects/large', '', 512 * 1024 * 1024);
  return {root: directory(), files, dirs, reads, events, nativeLocks, set, fail: fn => { fault = fn; }};
}
function locks() {
  const active = new Set(); return {async request(name, options, fn) { if (active.has(name)) return fn(null); active.add(name); try { return await fn({name}); } finally { active.delete(name); } }};
}
function runtime({disk = filesystem(), db = database(disk.root), manager = locks(), bytes = zip(packageItems()), version = oldManifest.version, fetcher} = {}) {
  let fetchCount = 0;
  const context = {console, Blob, File, TextDecoder, TextEncoder, URL, Response, ReadableStream, DecompressionStream, AbortController,
    crypto: webcrypto, atob, setTimeout, clearTimeout, navigator: {locks: manager}, indexedDB: db.api,
    chrome: {runtime: {getManifest: () => ({...oldManifest, version})}},
    fetch: (...args) => { fetchCount++; return fetcher ? fetcher(...args) : Promise.resolve(new Response(bytes, {headers: {'Content-Length': String(bytes.length)}})); },
    showDirectoryPicker: async () => disk.root};
  vm.runInNewContext(source, context, {filename: 'osminog-folder-updater.js'});
  const preflight = {available: true, latestVersion: nextManifest.version, latest: {version: nextManifest.version, minUpdaterVersion: '2.0.0', size: bytes.length, sha256: hash(bytes), packageUrl: 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/chrome-v4.0.37/fixture.zip'}};
  return {api: context.OSMINOGFolderUpdater, context, disk, db, manager, preflight, fetchCount: () => fetchCount};
}
const writes = disk => disk.events.filter(([type, name]) => ['write', 'create', 'mkdir', 'remove'].includes(type) && !name.startsWith('.osminog-update.'));

test('ZIP validation checks deflate, descriptors and every CRC; manifest is installed last', async () => {
  const f = runtime(), api = f.api.__test;
  const bytes = zip([{path: 'manifest.json', data: JSON.stringify(nextManifest)}, {path: 'test.js', data: 'test'.repeat(2000), deflate: true, descriptor: true}]);
  const archive = api.indexZip(bytes); await api.validateArchive(archive, nextManifest.version);
  assert.equal(archive.entries.at(-1).path, 'manifest.json'); assert.equal(archive.entries[0].size, 8000);
  assert.equal(Buffer.from(await api.extractEntry(archive, archive.entries[0])).toString(), 'test'.repeat(2000));
});

test('path traversal, case collisions, symlinks, overlapping file paths and excessive sizes are rejected', () => {
  const api = runtime().api.__test, m = {path: 'manifest.json', data: JSON.stringify(nextManifest)};
  for (const items of [[{path: '../bad.js', data: 'x'}], [{path: 'a\\b.js', data: 'x'}], [{path: '.osminog/private.json', data: 'x'}],
    [{path: 'code.js', data: 'a'}, {path: 'CODE.js', data: 'b'}], [{path: 'code', data: 'a'}, {path: 'code/file.js', data: 'b'}],
    [{path: 'link', data: 'target', mode: 0xa1ff}], [{path: 'big.js', data: 'x', deflate: true, size: api.LIMITS.fileBytes + 1}]]) assert.throws(() => api.indexZip(zip([...items, m])));
  const malicious = zip([{path: 'bomb.js', data: 'x'.repeat(10000), deflate: true, size: 2}, m]);
  const archive = api.indexZip(malicious); return assert.rejects(api.extractEntry(archive, archive.entries[0]), {code: 'ZIP_INFLATE_LIMIT'});
});

test('a bad CRC in the final file prevents all backups and program mutations', async () => {
  const items = packageItems(); items[0].crc = 1; const f = runtime({bytes: zip(items)});
  await assert.rejects(f.api.update({preflight: f.preflight}), {code: 'ZIP_CRC'});
  assert.equal(writes(f.disk).length, 0); assert.equal(f.db.stores.get('backupFiles').size, 0); assert.equal(f.disk.nativeLocks.size, 0);
});

test('successful update backs up only package targets, never reads unrelated 256 MiB files, and rolls back durable snapshots', async () => {
  const f = runtime(); f.db.state().set('lastBackup', {get items() { throw Error('Legacy whole-tree backup must not be loaded'); }});
  const result = await f.api.update({preflight: f.preflight}); assert.equal(result.updated, true); assert.equal(f.api.version, '2.0.0');
  assert.equal(JSON.parse(f.disk.files.get('manifest.json').data).version, '4.0.37');
  assert.equal(f.disk.events.filter(e => e[0] === 'write').at(-1)[1], 'manifest.json');
  assert(!f.disk.reads.some(p => p.startsWith('user-documents/') || p.startsWith('.git/') || p.startsWith('.osminog/')));
  assert(!f.db.reads.some(([, key]) => key === 'lastBackup'));
  const backup = f.db.state().get('lastBackupV2'); assert.equal(backup.entries.length, 4); assert.equal(f.db.stores.get('backupFiles').size, 3);
  for (const stored of f.db.stores.get('backupFiles').values()) assert(stored.blob instanceof Blob);
  assert.equal((await f.api.diagnostics()).pending, null); assert.equal(f.disk.nativeLocks.size, 0);
  await f.api.rollback();
  assert.equal(f.disk.files.get('editor.js').data.toString(), 'original editor'); assert.equal(f.disk.files.get('empty.txt').data.length, 0);
  assert.equal(JSON.parse(f.disk.files.get('manifest.json').data).version, '4.0.36'); assert(!f.disk.files.has('new/feature.js')); assert(!f.disk.dirs.has('new'));
  assert.equal(f.disk.files.get('.osminog/workspace-memory.json').data.toString(), 'PRIVATE DATA');
  assert.equal(f.db.state().get('lastBackupV2'), undefined); assert.equal(f.db.stores.get('backupFiles').size, 0);
});

test('an overlarge existing program target fails before reading its data or changing program files', async () => {
  const f = runtime(); f.disk.set('editor.js', '', 256 * 1024 * 1024);
  await assert.rejects(f.api.update({preflight: f.preflight}), /безопасный размер/);
  assert(!f.disk.reads.includes('editor.js')); assert.equal(writes(f.disk).length, 0); assert.equal(f.db.state().get('installJournalV2'), undefined);
});

test('write failure rolls back overwritten files and removes new files, with manifest restored last', async () => {
  const f = runtime(); let injected = false;
  f.disk.fail(name => { if (name !== 'editor.js' || injected) return false; injected = true; return true; });
  await assert.rejects(f.api.update({preflight: f.preflight}), /Injected disk/);
  assert.equal(f.disk.files.get('editor.js').data.toString(), 'original editor'); assert(!f.disk.files.has('new/feature.js'));
  assert.equal(JSON.parse(f.disk.files.get('manifest.json').data).version, '4.0.36'); assert.equal(f.db.state().get('installJournalV2'), undefined); assert.equal(f.disk.nativeLocks.size, 0);
});

test('interrupted transaction recovers even a torn manifest, from bound persistent backup records', async () => {
  const f = runtime(); await f.api.update({preflight: f.preflight});
  const journal = clone(f.db.state().get('lastBackupV2')); journal.phase = 'installing';
  f.db.state().set('installJournalV2', journal); f.db.state().delete('lastBackupV2'); f.db.state().delete('lastInstall'); f.disk.set('manifest.json', '{torn');
  f.disk.set('.osminog-update.pending.json', JSON.stringify({schema: 'osminog-folder-pending/v2', id: journal.id, identity: journal.identity}));
  const reopened = runtime({disk: f.disk, db: f.db}); await reopened.api.selectFolder(); const recovered = await reopened.api.recover();
  assert.equal(recovered.recovered, true); assert.equal(JSON.parse(f.disk.files.get('manifest.json').data).version, '4.0.36');
  assert.equal(f.disk.files.get('editor.js').data.toString(), 'original editor'); assert(!f.disk.files.has('new/feature.js'));
  assert.equal(f.disk.events.filter(e => e[0] === 'write').at(-1)[1], 'manifest.json'); assert.equal((await reopened.api.recover()).recovered, false);
});

test('a foreign origin refuses a shared pending marker; its owner recovers before another origin can proceed', async () => {
  const f = runtime(); await f.api.update({preflight: f.preflight});
  const journal = clone(f.db.state().get('lastBackupV2')); journal.phase = 'installing';
  f.db.state().set('installJournalV2', journal); f.db.state().delete('lastInstall'); f.db.state().delete('lastBackupV2');
  f.disk.set('.osminog-update.pending.json', JSON.stringify({schema: 'osminog-folder-pending/v2', id: journal.id, identity: journal.identity}));
  const foreign = runtime({disk: f.disk}), before = writes(f.disk).length;
  await assert.rejects(foreign.api.update({preflight: foreign.preflight}), {code: 'FOREIGN_UPDATE_PENDING'});
  await assert.rejects(foreign.api.recover(), {code: 'FOREIGN_UPDATE_PENDING'}); assert.equal(writes(f.disk).length, before);
  await f.api.recover(); assert(!f.disk.files.has('.osminog-update.pending.json'));
  const result = await foreign.api.update({preflight: foreign.preflight}); assert.equal(result.updated, true);
});

test('committed completion proof permits retry after shared marker cleanup fails', async () => {
  const f = runtime(), remove = f.disk.root.removeEntry; let failOnce = true;
  f.disk.root.removeEntry = async name => { if (name === '.osminog-update.pending.json' && failOnce) { failOnce = false; throw err('NoModificationAllowedError'); } return remove(name); };
  await assert.rejects(f.api.update({preflight: f.preflight}), {name: 'NoModificationAllowedError'});
  assert(f.db.state().get('lastInstall')); assert.equal(f.db.state().get('installJournalV2'), undefined); assert(f.disk.files.has('.osminog-update.pending.json'));
  const before = writes(f.disk).length, result = await f.api.update({preflight: f.preflight});
  assert.equal(result.alreadyInstalled, true); assert.equal(writes(f.disk).length, before); assert(!f.disk.files.has('.osminog-update.pending.json'));
});

test('atomic recovery proof permits retry after marker cleanup fails without restoring twice', async () => {
  const f = runtime(); await f.api.update({preflight: f.preflight});
  const remove = f.disk.root.removeEntry; let failOnce = true;
  f.disk.root.removeEntry = async name => { if (name === '.osminog-update.pending.json' && failOnce) { failOnce = false; throw err('NoModificationAllowedError'); } return remove(name); };
  await assert.rejects(f.api.rollback(), {name: 'NoModificationAllowedError'});
  assert.equal(f.db.state().get('lastOperationV2').stage, 'recovered'); assert.equal(f.db.state().get('installJournalV2'), undefined);
  const before = writes(f.disk).length, result = await f.api.recover(); assert.equal(result.recovered, false);
  assert.equal(writes(f.disk).length, before); assert(!f.disk.files.has('.osminog-update.pending.json'));
});

test('rejected restore leaves a durable journal, forbids changing directory, and succeeds on the next recovery', async () => {
  const f = runtime(); let failed = 0;
  f.disk.fail(name => name === 'editor.js' && ++failed <= 2);
  await assert.rejects(f.api.update({preflight: f.preflight}), {code: 'RECOVERY_REQUIRED'});
  assert(f.db.state().get('installJournalV2')); await assert.rejects(f.api.forgetFolder(), {code: 'RECOVERY_REQUIRED'});
  f.disk.fail(null); const recovered = await f.api.recover(); assert.equal(recovered.recovered, true);
  assert.equal(f.disk.files.get('editor.js').data.toString(), 'original editor'); assert.equal(f.disk.nativeLocks.size, 0);
});

test('same-window, same-origin and cross-origin attempts cannot update one folder concurrently', async () => {
  let release, entered; const gate = new Promise(r => { release = r; }), began = new Promise(r => { entered = r; });
  const bytes = zip(packageItems()), f = runtime({bytes, fetcher: async () => { entered(); await gate; return new Response(bytes); }});
  const running = f.api.update({preflight: f.preflight}); await began;
  await assert.rejects(f.api.update({preflight: f.preflight}), {code: 'UPDATE_BUSY'});
  const sameOrigin = runtime({disk: f.disk, db: f.db, manager: f.manager}); await assert.rejects(sameOrigin.api.update({preflight: f.preflight}), {code: 'UPDATE_BUSY'});
  const otherOrigin = runtime({disk: f.disk}); await assert.rejects(otherOrigin.api.update({preflight: f.preflight}), {code: 'UPDATE_BUSY'});
  release(); await running; assert.equal(f.disk.nativeLocks.size, 0);
});

test('reload retry verifies a committed installation without downloading or rewriting; tampering is rejected', async () => {
  const f = runtime(); await f.api.update({preflight: f.preflight}); const before = writes(f.disk).length, downloads = f.fetchCount();
  const resumed = await f.api.update({preflight: f.preflight}); assert.equal(resumed.alreadyInstalled, true); assert.equal(resumed.currentVersion, '4.0.37');
  assert.equal(writes(f.disk).length, before); assert.equal(f.fetchCount(), downloads);
  f.disk.set('editor.js', 'tampered'); await assert.rejects(f.api.update({preflight: f.preflight}), {code: 'INSTALLED_HASH'}); assert.equal(writes(f.disk).length, before);
});

test('rollback never applies a backup to a different same-key installation', async () => {
  const f = runtime(); await f.api.update({preflight: f.preflight}); const other = filesystem(); other.set('manifest.json', JSON.stringify(nextManifest));
  f.db.state().set('directoryHandle', other.root);
  await assert.rejects(f.api.rollback(), {code: 'JOURNAL_FOLDER'}); assert.equal(writes(other).length, 0); assert.equal(other.files.get('editor.js').data.toString(), 'original editor');
});

test('recovery rejects unrelated directory deletion records before touching files', async () => {
  const f = runtime(); await f.api.update({preflight: f.preflight}); const journal = clone(f.db.state().get('lastBackupV2'));
  journal.phase = 'installing'; journal.createdDirectories.push('user-documents'); f.db.state().set('installJournalV2', journal);
  const before = writes(f.disk).length; await assert.rejects(f.api.recover(), {code: 'JOURNAL_INVALID'}); assert.equal(writes(f.disk).length, before);
});

test('network reads have a deadline and reject excess streamed bytes without relying on Content-Length', async () => {
  const stalled = runtime({fetcher: () => new Promise(() => {})});
  await assert.rejects(stalled.api.__test.fetchBytes('https://example.test/hang', {limit: 100, timeout: 20}), {code: 'NETWORK_TIMEOUT'});
  const overflow = runtime({fetcher: async () => new Response(new Uint8Array(101))});
  await assert.rejects(overflow.api.__test.fetchBytes('https://example.test/overflow', {limit: 100, timeout: 1000}), {code: 'DOWNLOAD_LIMIT'});
});
