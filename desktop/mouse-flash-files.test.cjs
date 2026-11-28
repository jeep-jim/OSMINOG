'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {FlashFiles, BLOCK_BYTES, FREE_LIMIT, canonicalManifest, validateManifest, hashManifest} = require('./mouse-flash-files.cjs');

const id = n => n.toString(16).padStart(32, '0');
const SENDER = id(101), RECEIVER = id(102), OTHER = id(103);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
function manifest(files = [{path: 'payload.bin', size: 3}], directories = [], transferId = id(1000)) {
  return {v: 1, transferId, files: files.map((file, index) => ({id: id(index + 1), ...file})), directories, totalBytes: files.reduce((sum, file) => sum + file.size, 0)};
}
async function fixture(t, maxTransferBytes = FREE_LIMIT) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mouse-flash-files-'));
  const stores = [];
  const sourceDirectory = path.join(root, 'chosen-source');
  const destination = path.join(root, 'chosen-destination');
  await fs.mkdir(sourceDirectory); await fs.mkdir(destination);
  const open = async role => {
    const store = new FlashFiles({stateDirectory: path.join(root, role + '-state'), maxTransferBytes});
    stores.push(store); await store.initialize(); return store;
  };
  t.after(async () => {
    await Promise.allSettled(stores.map(store => store.close()));
    await fs.rm(root, {recursive: true, force: true});
  });
  return {root, sourceDirectory, destination, open, sender: await open('send'), receiver: await open('receive')};
}
async function put(f, name, data) {
  const filename = path.join(f.sourceDirectory, name);
  await fs.mkdir(path.dirname(filename), {recursive: true}); await fs.writeFile(filename, data); return filename;
}
async function selected(f, data, name = 'payload.bin') {
  const filename = await put(f, name, data);
  const source = await f.sender.prepareSource([filename]);
  return {...source, filename, file: source.manifest.files[0]};
}
async function bind(f, source) { await f.sender.bindPeer({sourceId: source.sourceId, peerDeviceId: RECEIVER}); }
async function receive(f, source) {
  const result = await f.receiver.prepareReceive({manifest: source.manifest, manifestHash: source.manifestHash, peerDeviceId: SENDER, destination: f.destination, resume: false});
  return {...result, folder: path.join(f.destination, result.folderName)};
}
async function sendRange(sender, sourceId, receiver, receiveId, file, from = 0) {
  for (let offset = from; offset < file.size;) {
    const length = Math.min(BLOCK_BYTES, file.size - offset);
    const block = await sender.readBlock({sourceId, fileId: file.id, offset, length});
    assert.equal(block.data.length, length); assert.equal(block.sha256, sha(block.data));
    const ack = await receiver.writeBlock({receiveId, fileId: file.id, offset, ...block});
    offset += length; assert.deepEqual(ack, {id: file.id, offset});
  }
}
async function regularFiles(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await regularFiles(filename));
    else if (entry.isFile()) result.push(filename);
  }
  return result;
}
async function partFor(folder, expectedBytes) {
  const found = [];
  for (const filename of await regularFiles(folder)) if ((await fs.stat(filename)).size === expectedBytes) found.push(filename);
  assert.equal(found.length, 1, 'The fixture has exactly one partial payload of the committed size');
  return found[0];
}
async function resumeReceive(receiver, source, folder, changes = {}) {
  return receiver.prepareReceive({manifest: source.manifest, manifestHash: source.manifestHash, peerDeviceId: SENDER, destination: folder, resume: true, ...changes});
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return {promise, resolve, reject};
}
async function blockFirstDiskRead(t, filename) {
  // macOS exposes temporary paths through /var, while source grants use /private/var.
  const canonical = await fs.realpath(filename);
  const entered = deferred(), release = deferred(), open = fs.open.bind(fs);
  const timer = setTimeout(() => {
    release.resolve(); entered.reject(new Error('The real source disk read did not reach its causal test latch within 10 seconds'));
  }, 10000);
  entered.promise.catch(() => {});
  t.after(() => { clearTimeout(timer); release.resolve(); });
  let selectedHandle = false;
  t.mock.method(fs, 'open', async (openedPath, ...args) => {
    const handle = await open(openedPath, ...args);
    if (openedPath === canonical && !selectedHandle) {
      selectedHandle = true;
      const read = handle.read.bind(handle);
      t.mock.method(handle, 'read', async (...readArgs) => {
        clearTimeout(timer); entered.resolve(); await release.promise; return read(...readArgs);
      });
    }
    return handle;
  });
  return {entered: entered.promise, release: release.resolve};
}

test('manifest quota is decimal 100 GB; metadata boundaries do not claim a huge data transfer', () => {
  assert.equal(BLOCK_BYTES, 1024 * 1024); assert.equal(FREE_LIMIT, 100000000000);
  for (const size of [0, FREE_LIMIT - 1, FREE_LIMIT, 2 ** 32 + 17]) {
    const value = manifest([{path: 'large.bin', size}]);
    assert.equal(validateManifest(value).files[0].size, size);
  }
  assert.throws(() => validateManifest(manifest([{path: 'large.bin', size: FREE_LIMIT + 1}])));
  assert.equal(validateManifest(manifest([{path: 'large.bin', size: FREE_LIMIT + 1}]), null).totalBytes, FREE_LIMIT + 1);
  for (const size of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateManifest(manifest([{path: 'bad.bin', size}]), null));
  }
  assert.throws(() => validateManifest(manifest([{path: 'a', size: Number.MAX_SAFE_INTEGER}, {path: 'b', size: 1}]), null));
});

test('canonical manifest has the fixed wire keys and binds names, sizes, IDs and directories', () => {
  const value = manifest([{path: 'é.txt', size: 3}]);
  const expected = '{"v":1,"transferId":"' + id(1000) + '","files":[{"id":"' + id(1) + '","path":"é.txt","size":3}],"directories":[],"totalBytes":3}';
  assert.equal(canonicalManifest(value), expected); assert.equal(hashManifest(value), sha(Buffer.from(expected, 'utf8')));
  const normalized = validateManifest({...value, untrustedAbsolutePath: '/must-not-be-a-capability', files: [{...value.files[0], absolute: '/never-read-this'}]});
  assert.deepEqual(normalized, value);
  for (const change of [v => {v.transferId = id(1001);}, v => {v.files[0].id = id(2);}, v => {v.files[0].path = 'other.txt';}, v => {v.files[0].size++; v.totalBytes++;}, v => {v.directories = ['empty'];}]) {
    const changed = clone(value); change(changed); assert.notEqual(hashManifest(changed), hashManifest(value));
  }
});

test('manifest order uses raw JavaScript lexical order, not locale collation', () => {
  const names = ['Zebra.bin', 'alpha.bin', 'zulu.bin', 'é.bin'];
  assert.deepEqual(names.slice().sort(), names);
  const value = manifest(names.map(name => ({path: name, size: 1})), ['Z-dir', 'a-dir', 'é-dir']);
  assert.deepEqual(validateManifest(value), value);
  const unsorted = clone(value); [unsorted.files[0], unsorted.files[1]] = [unsorted.files[1], unsorted.files[0]];
  assert.throws(() => validateManifest(unsorted));
  const directories = clone(value); directories.directories.reverse(); assert.throws(() => validateManifest(directories));
});

test('remote portable paths reject traversal, Windows devices, ADS, separators and non-NFC names', () => {
  const unsafe = ['../escape', 'a/../escape', './file', '/absolute', 'a//b', 'a/', '\\absolute', 'a\\b', 'C:/file', 'x\0y', 'x\ny', 'file.', 'file ', 'CON', 'con.txt', 'PRN', 'aux.csv', 'NUL', 'COM1.log', 'LPT9.txt', 'nested/CON', 'name:stream', 'a?b', 'a*b', 'a|b', 'a<b', 'a>b', 'a"b', 'e\u0301.txt', '.mouse-flash-partials/data'];
  for (const name of unsafe) assert.throws(() => validateManifest(manifest([{path: name, size: 1}])), undefined, name);
  assert.doesNotThrow(() => validateManifest(manifest([{path: 'é.txt', size: 1}])));
});

test('manifest rejects duplicate IDs, case collisions and a file used as an ancestor directory', () => {
  const duplicateIDs = manifest([{path: 'a', size: 1}, {path: 'b', size: 1}]); duplicateIDs.files[1].id = duplicateIDs.files[0].id;
  const cases = [duplicateIDs, manifest([{path: 'A', size: 1}, {path: 'a', size: 1}]), manifest([], ['A', 'a']), manifest([{path: 'a', size: 1}], ['a']), manifest([{path: 'a', size: 1}, {path: 'a/child', size: 1}]), manifest([{path: 'A', size: 1}, {path: 'a/child', size: 1}])];
  for (const value of cases) assert.throws(() => validateManifest(value));
  const wrongTotal = manifest(); wrongTotal.totalBytes++; assert.throws(() => validateManifest(wrongTotal));
  const invalidID = manifest(); invalidID.files[0].id = '../not-an-id'; assert.throws(() => validateManifest(invalidID));
  assert.throws(() => validateManifest(manifest([], [])));
});

test('actual disk roundtrip preserves more than two blocks, a zero-byte file, nested and empty folders', async t => {
  const f = await fixture(t), bytes = crypto.randomBytes(2 * BLOCK_BYTES + 173);
  await put(f, 'bundle/nested/payload.bin', bytes); await put(f, 'bundle/zero.txt', Buffer.alloc(0));
  await fs.mkdir(path.join(f.sourceDirectory, 'bundle', 'empty-directory'));
  const source = await f.sender.prepareSource([path.join(f.sourceDirectory, 'bundle')]);
  assert.equal(source.manifest.totalBytes, bytes.length); assert.equal(source.manifest.files.length, 2);
  assert.deepEqual(source.manifest.files.map(file => file.path), ['bundle/nested/payload.bin', 'bundle/zero.txt']);
  assert.ok(source.manifest.directories.includes('bundle/empty-directory'));
  await bind(f, source); const target = await receive(f, source);
  for (const file of source.manifest.files) {
    await sendRange(f.sender, source.sourceId, f.receiver, target.receiveId, file);
    const expected = file.path.endsWith('payload.bin') ? bytes : Buffer.alloc(0);
    const actualHash = await f.sender.sourceHash({sourceId: source.sourceId, fileId: file.id});
    assert.deepEqual(actualHash, {sha256: sha(expected), size: expected.length});
    assert.deepEqual(await f.receiver.completeFile({receiveId: target.receiveId, fileId: file.id, sha256: actualHash.sha256}), {id: file.id, ok: true});
    assert.deepEqual(await fs.readFile(path.join(target.folder, file.path)), expected);
  }
  await f.receiver.finish({receiveId: target.receiveId}); await f.sender.finish({sourceId: source.sourceId});
  assert.equal((await fs.stat(path.join(target.folder, 'bundle/empty-directory'))).isDirectory(), true);
  assert.deepEqual(await f.sender.listResumable(), {send: [], receive: []});
  assert.deepEqual(await f.receiver.listResumable(), {send: [], receive: []});
  assert.deepEqual(await fs.readFile(path.join(f.sourceDirectory, 'bundle/nested/payload.bin')), bytes);
});

test('selection is not peer approval: both block reads and source hashing wait for bindPeer', async t => {
  const f = await fixture(t), source = await selected(f, Buffer.from('private source'));
  await assert.rejects(f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: 1}));
  await assert.rejects(f.sender.sourceHash({sourceId: source.sourceId, fileId: source.file.id}));
  await assert.rejects(f.sender.finish({sourceId: source.sourceId}));
  await assert.rejects(f.receiver.writeBlock({receiveId: id(900), fileId: source.file.id, offset: 0, data: Buffer.from('x'), sha256: sha('x')}));
  assert.deepEqual(await fs.readdir(f.destination), []);
  await bind(f, source);
  assert.equal((await f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: 1})).data.toString(), 'p');
  await assert.rejects(f.sender.bindPeer({sourceId: source.sourceId, peerDeviceId: OTHER}));
});

test('read capability rejects unknown files, overflowing ranges and blocks larger than one MiB', async t => {
  const f = await fixture(t), source = await selected(f, Buffer.alloc(BLOCK_BYTES + 1, 19)); await bind(f, source);
  for (const range of [{offset: -1, length: 1}, {offset: 0.5, length: 1}, {offset: 0, length: 0}, {offset: 0, length: BLOCK_BYTES + 1}, {offset: BLOCK_BYTES, length: 2}, {offset: Number.MAX_SAFE_INTEGER, length: 1}]) {
    await assert.rejects(f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, ...range}));
  }
  await assert.rejects(f.sender.readBlock({sourceId: source.sourceId, fileId: id(999), offset: 0, length: 1}));
  await assert.rejects(f.sender.readBlock({sourceId: id(998), fileId: source.file.id, offset: 0, length: 1}));
  assert.deepEqual((await f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: BLOCK_BYTES, length: 1})).data, Buffer.from([19]));
});

test('small configured quota rejects actual source and receiver selection without consuming transfer data', async t => {
  const f = await fixture(t, 5);
  const allowed = await selected(f, Buffer.from('12345'), 'five'); assert.equal(allowed.manifest.totalBytes, 5);
  await assert.rejects(f.sender.prepareSource([await put(f, 'six', Buffer.from('123456'))]));
  await assert.rejects(f.sender.prepareSource([await put(f, 'a', Buffer.from('123')), await put(f, 'b', Buffer.from('456'))]));
  const tooLarge = manifest([{path: 'six', size: 6}]);
  await assert.rejects(f.receiver.prepareReceive({manifest: tooLarge, manifestHash: hashManifest(tooLarge), peerDeviceId: SENDER, destination: f.destination}));
  assert.deepEqual(await fs.readdir(f.destination), []);
  await bind(f, allowed); const target = await receive(f, allowed);
  await sendRange(f.sender, allowed.sourceId, f.receiver, target.receiveId, allowed.file);
  await f.receiver.completeFile({receiveId: target.receiveId, fileId: allowed.file.id, sha256: sha('12345')});
  assert.equal(await fs.readFile(path.join(target.folder, 'five'), 'utf8'), '12345');
});

test('a sparse source checks real seeks beyond 4 GiB, not a claim of a multi-gigabyte transfer', async t => {
  const f = await fixture(t), filename = path.join(f.sourceDirectory, 'sparse-offset.bin');
  const offset = 2 ** 32 + 19, marker = Buffer.from('offset-after-four-gib');
  const handle = await fs.open(filename, 'wx');
  try { await handle.truncate(offset + marker.length); await handle.write(marker, 0, marker.length, offset); } finally { await handle.close(); }
  const source = await f.sender.prepareSource([filename]); await bind(f, source);
  assert.equal(source.manifest.files[0].size, offset + marker.length);
  const block = await f.sender.readBlock({sourceId: source.sourceId, fileId: source.manifest.files[0].id, offset, length: marker.length});
  assert.deepEqual(block.data, marker); assert.equal(block.sha256, sha(marker));
});

test('source selection rejects a symlink root and a nested symlink outside the granted directory', async t => {
  const f = await fixture(t), outside = path.join(f.root, 'outside-original'); await fs.writeFile(outside, 'must stay outside');
  const link = path.join(f.sourceDirectory, 'link'); await fs.symlink(outside, link);
  await assert.rejects(f.sender.prepareSource([link]));
  const folder = path.join(f.sourceDirectory, 'folder'); await fs.mkdir(folder); await fs.symlink(outside, path.join(folder, 'nested-link'));
  await assert.rejects(f.sender.prepareSource([folder]));
  assert.equal(await fs.readFile(outside, 'utf8'), 'must stay outside');
});

test('changed source bytes invalidate reads, hashing and restart capabilities', async t => {
  const f = await fixture(t), source = await selected(f, Buffer.from('old bytes')); await bind(f, source);
  await f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: 1});
  await fs.writeFile(source.filename, 'new bytes');
  const later = new Date(Date.now() + 2000); await fs.utimes(source.filename, later, later);
  await assert.rejects(f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: 1}));
  await assert.rejects(f.sender.sourceHash({sourceId: source.sourceId, fileId: source.file.id}));
  await f.sender.pause({sourceId: source.sourceId}); await f.sender.close();
  const reopened = await f.open('send'); await assert.rejects(reopened.resumeSource(source.manifest.transferId));
});

test('receiver refuses a wrong manifest hash and a symlink destination before creating payload files', async t => {
  const f = await fixture(t), source = await selected(f, Buffer.from('payload'));
  await assert.rejects(f.receiver.prepareReceive({manifest: source.manifest, manifestHash: sha('wrong manifest'), peerDeviceId: SENDER, destination: f.destination}));
  const actual = path.join(f.root, 'actual-destination'), linked = path.join(f.root, 'linked-destination');
  await fs.mkdir(actual); await fs.symlink(actual, linked, 'dir');
  await assert.rejects(f.receiver.prepareReceive({manifest: source.manifest, manifestHash: source.manifestHash, peerDeviceId: SENDER, destination: linked}));
  assert.deepEqual(await fs.readdir(actual), []); assert.deepEqual(await fs.readdir(f.destination), []);
});

test('bad block hash, short block, foreign file and out-of-order data do not advance the receiver', async t => {
  const f = await fixture(t), data = crypto.randomBytes(BLOCK_BYTES + 31), source = await selected(f, data); await bind(f, source); const target = await receive(f, source);
  const first = data.subarray(0, BLOCK_BYTES), second = data.subarray(BLOCK_BYTES);
  const input = {receiveId: target.receiveId, fileId: source.file.id, offset: 0, data: first, sha256: sha(first)};
  await assert.rejects(f.receiver.writeBlock({...input, sha256: sha('tampered')}));
  await assert.rejects(f.receiver.writeBlock({...input, data: first.subarray(0, -1), sha256: sha(first.subarray(0, -1))}));
  await assert.rejects(f.receiver.writeBlock({...input, fileId: id(2000)}));
  await assert.rejects(f.receiver.writeBlock({...input, offset: BLOCK_BYTES, data: second, sha256: sha(second)}));
  await assert.rejects(f.receiver.writeBlock({...input, offset: 0.5}));
  const oversized = Buffer.alloc(BLOCK_BYTES + 1); await assert.rejects(f.receiver.writeBlock({...input, data: oversized, sha256: sha(oversized)}));
  assert.deepEqual(await f.receiver.writeBlock(input), {id: source.file.id, offset: BLOCK_BYTES});
  await assert.rejects(f.receiver.writeBlock(input));
  assert.deepEqual(await f.receiver.writeBlock({...input, offset: BLOCK_BYTES, data: second, sha256: sha(second)}), {id: source.file.id, offset: data.length});
  await assert.rejects(f.receiver.completeFile({receiveId: target.receiveId, fileId: source.file.id, sha256: sha('wrong final')}));
  await f.receiver.completeFile({receiveId: target.receiveId, fileId: source.file.id, sha256: sha(data)});
  assert.deepEqual(await fs.readFile(path.join(target.folder, source.file.path)), data);
});

test('incomplete receives cannot finish and completion never overwrites an existing destination file', async t => {
  const f = await fixture(t), data = Buffer.from('incoming payload'), source = await selected(f, data); await bind(f, source); const target = await receive(f, source);
  await assert.rejects(f.receiver.finish({receiveId: target.receiveId}));
  await assert.rejects(f.receiver.completeFile({receiveId: target.receiveId, fileId: source.file.id, sha256: sha(data)}));
  const destination = path.join(target.folder, source.file.path); await fs.writeFile(destination, 'existing user bytes', {flag: 'wx'});
  await sendRange(f.sender, source.sourceId, f.receiver, target.receiveId, source.file);
  await assert.rejects(f.receiver.completeFile({receiveId: target.receiveId, fileId: source.file.id, sha256: sha(data)}));
  assert.equal(await fs.readFile(destination, 'utf8'), 'existing user bytes');
});

test('replacing a prepared nested destination directory with a symlink cannot redirect completion', async t => {
  const f = await fixture(t), data = Buffer.from('private incoming'), filename = await put(f, 'chosen/nested/file.txt', data);
  const source = await f.sender.prepareSource([path.join(f.sourceDirectory, 'chosen')]); await bind(f, source); const target = await receive(f, source), file = source.manifest.files[0];
  await sendRange(f.sender, source.sourceId, f.receiver, target.receiveId, file);
  const actualDirectory = path.dirname(path.join(target.folder, file.path)), outside = path.join(f.root, 'outside-output'); await fs.mkdir(outside);
  await fs.rmdir(actualDirectory); await fs.symlink(outside, actualDirectory, 'dir');
  await assert.rejects(f.receiver.completeFile({receiveId: target.receiveId, fileId: file.id, sha256: sha(data)}));
  assert.deepEqual(await fs.readdir(outside), []); assert.deepEqual(await fs.readFile(filename), data);
});

test('paused send/receive resume after new store instances from the durable offset and preserve peer binding', async t => {
  const f = await fixture(t), data = crypto.randomBytes(2 * BLOCK_BYTES + 9), source = await selected(f, data); await bind(f, source); const target = await receive(f, source);
  const block = await f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: BLOCK_BYTES});
  assert.deepEqual(await f.receiver.writeBlock({receiveId: target.receiveId, fileId: source.file.id, offset: 0, ...block}), {id: source.file.id, offset: BLOCK_BYTES});
  await f.sender.pause({sourceId: source.sourceId}); await f.receiver.pause({receiveId: target.receiveId}); await f.sender.close(); await f.receiver.close();
  const sender = await f.open('send'), receiver = await f.open('receive');
  assert.equal((await sender.listResumable()).send[0].transferId, source.manifest.transferId);
  assert.equal((await receiver.listResumable()).receive[0].folderName, target.folderName);
  await assert.rejects(sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: 1}));
  const renewed = await sender.resumeSource(source.manifest.transferId); assert.notEqual(renewed.sourceId, source.sourceId); assert.deepEqual(renewed.manifest, source.manifest);
  await assert.rejects(sender.bindPeer({sourceId: renewed.sourceId, peerDeviceId: OTHER}));
  await sender.bindPeer({sourceId: renewed.sourceId, peerDeviceId: RECEIVER});
  await assert.rejects(resumeReceive(receiver, source, target.folder, {peerDeviceId: OTHER}));
  const changed = clone(source.manifest); changed.files[0].path = 'changed-name.bin';
  await assert.rejects(resumeReceive(receiver, source, target.folder, {manifest: changed, manifestHash: hashManifest(changed)}));
  await assert.rejects(resumeReceive(receiver, source, f.destination));
  const resumed = await resumeReceive(receiver, source, target.folder); assert.deepEqual(resumed.offsets, [{id: source.file.id, offset: BLOCK_BYTES}]);
  await assert.rejects(receiver.writeBlock({receiveId: target.receiveId, fileId: source.file.id, offset: BLOCK_BYTES, data: block.data, sha256: block.sha256}));
  await sendRange(sender, renewed.sourceId, receiver, resumed.receiveId, source.file, BLOCK_BYTES);
  await receiver.completeFile({receiveId: resumed.receiveId, fileId: source.file.id, sha256: sha(data)});
  await receiver.finish({receiveId: resumed.receiveId}); await sender.finish({sourceId: renewed.sourceId});
  assert.deepEqual(await fs.readFile(path.join(target.folder, source.file.path)), data);
  assert.deepEqual(await sender.listResumable(), {send: [], receive: []}); assert.deepEqual(await receiver.listResumable(), {send: [], receive: []});
});

test('editing an acknowledged partial on disk rejects resume rather than trusting only journal offsets', async t => {
  const f = await fixture(t), data = crypto.randomBytes(BLOCK_BYTES + 7), source = await selected(f, data); await bind(f, source); const target = await receive(f, source);
  const first = data.subarray(0, BLOCK_BYTES); await f.receiver.writeBlock({receiveId: target.receiveId, fileId: source.file.id, offset: 0, data: first, sha256: sha(first)});
  await f.receiver.pause({receiveId: target.receiveId}); await f.receiver.close();
  const partial = await partFor(target.folder, BLOCK_BYTES), handle = await fs.open(partial, 'r+');
  try { await handle.write(Buffer.from([first[23] ^ 255]), 0, 1, 23); } finally { await handle.close(); }
  const reopened = await f.open('receive'); await assert.rejects(resumeReceive(reopened, source, target.folder));
});

test('an edited completed file also rejects resume of a paused multi-file transfer', async t => {
  const f = await fixture(t), first = await put(f, 'a.txt', 'first file'), second = await put(f, 'b.txt', 'second file');
  const source = await f.sender.prepareSource([first, second]); await bind(f, source); const target = await receive(f, source), file = source.manifest.files[0];
  await sendRange(f.sender, source.sourceId, f.receiver, target.receiveId, file);
  await f.receiver.completeFile({receiveId: target.receiveId, fileId: file.id, sha256: sha('first file')});
  await f.receiver.pause({receiveId: target.receiveId}); await f.receiver.close();
  await fs.writeFile(path.join(target.folder, file.path), 'edited file');
  const reopened = await f.open('receive'); await assert.rejects(resumeReceive(reopened, source, target.folder));
});

test('crash tail without an ACK is discarded, while the acknowledged offset and payload remain usable', async t => {
  const f = await fixture(t), data = crypto.randomBytes(2 * BLOCK_BYTES + 5), source = await selected(f, data); await bind(f, source); const target = await receive(f, source);
  const first = data.subarray(0, BLOCK_BYTES); await f.receiver.writeBlock({receiveId: target.receiveId, fileId: source.file.id, offset: 0, data: first, sha256: sha(first)});
  await f.receiver.pause({receiveId: target.receiveId}); await f.receiver.close();
  const partial = await partFor(target.folder, BLOCK_BYTES), journal = (await regularFiles(target.folder)).find(filename => filename.endsWith('.jsonl'));
  assert.ok(journal); await fs.appendFile(partial, data.subarray(BLOCK_BYTES, 2 * BLOCK_BYTES)); await fs.appendFile(journal, '{"type":"block","id":');
  const reopened = await f.open('receive'), resumed = await resumeReceive(reopened, source, target.folder);
  assert.deepEqual(resumed.offsets, [{id: source.file.id, offset: BLOCK_BYTES}]); assert.equal((await fs.stat(partial)).size, BLOCK_BYTES);
  await sendRange(f.sender, source.sourceId, reopened, resumed.receiveId, source.file, BLOCK_BYTES);
  await reopened.completeFile({receiveId: resumed.receiveId, fileId: source.file.id, sha256: sha(data)});
  assert.deepEqual(await fs.readFile(path.join(target.folder, source.file.path)), data);
});

test('a complete corrupt journal record is rejected, not treated as an unacknowledged crash tail', async t => {
  const f = await fixture(t), data = crypto.randomBytes(BLOCK_BYTES + 5), source = await selected(f, data); await bind(f, source); const target = await receive(f, source);
  const first = data.subarray(0, BLOCK_BYTES); await f.receiver.writeBlock({receiveId: target.receiveId, fileId: source.file.id, offset: 0, data: first, sha256: sha(first)});
  await f.receiver.pause({receiveId: target.receiveId}); await f.receiver.close();
  const journal = (await regularFiles(target.folder)).find(filename => filename.endsWith('.jsonl'));
  await fs.appendFile(journal, '{broken committed record}\n');
  const reopened = await f.open('receive'); await assert.rejects(resumeReceive(reopened, source, target.folder));
});

test('crash after the no-overwrite link but before its completion record can finish idempotently', async t => {
  const f = await fixture(t), data = crypto.randomBytes(71), source = await selected(f, data); await bind(f, source); const target = await receive(f, source);
  await sendRange(f.sender, source.sourceId, f.receiver, target.receiveId, source.file);
  await f.receiver.pause({receiveId: target.receiveId}); await f.receiver.close();
  const partial = await partFor(target.folder, data.length), destination = path.join(target.folder, source.file.path);
  await fs.link(partial, destination);
  const reopened = await f.open('receive'), resumed = await resumeReceive(reopened, source, target.folder);
  assert.deepEqual(resumed.offsets, [{id: source.file.id, offset: data.length}]);
  await reopened.completeFile({receiveId: resumed.receiveId, fileId: source.file.id, sha256: sha(data)});
  await reopened.finish({receiveId: resumed.receiveId}); assert.deepEqual(await fs.readFile(destination), data);
});

test('an explicitly selected empty directory is preserved and finishes without manufacturing a data block', async t => {
  const f = await fixture(t), directory = path.join(f.sourceDirectory, 'empty'); await fs.mkdir(directory);
  const source = await f.sender.prepareSource([directory]); assert.deepEqual(source.manifest.files, []); assert.equal(source.manifest.totalBytes, 0);
  await bind(f, source); const target = await receive(f, source); assert.deepEqual(target.offsets, []);
  await f.receiver.finish({receiveId: target.receiveId}); await f.sender.finish({sourceId: source.sourceId});
  assert.deepEqual(await fs.readdir(target.folder), ['empty']); assert.deepEqual(await fs.readdir(path.join(target.folder, 'empty')), []);
});

for (const operation of ['readBlock', 'sourceHash']) {
  for (const stop of ['pause', 'finish', 'close']) {
    test(`${stop} cancels and drains an already pending source ${operation} before returning`, async t => {
      const f = await fixture(t), source = await selected(f, crypto.randomBytes(BLOCK_BYTES + 31)); await bind(f, source);
      const gate = await blockFirstDiskRead(t, source.filename);
      const pending = f.sender[operation]({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: BLOCK_BYTES});
      const rejected = assert.rejects(pending, /paused|closed|Unknown source/);
      rejected.catch(() => {}); // Still awaited below; a broken latch must not cause unhandled-rejection cascades.
      try {
        await gate.entered;
        let settled = false;
        const stopped = f.sender[stop]({sourceId: source.sourceId}).then(value => { settled = true; return value; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(settled, false, 'The stop operation must drain the actual open disk read');
        await assert.rejects(f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: 1}));
        gate.release(); await rejected; await stopped;
        await assert.rejects(f.sender.sourceHash({sourceId: source.sourceId, fileId: source.file.id}));
        const journals = (await regularFiles(path.join(f.root, 'send-state'))).filter(name => name.endsWith('.send-blocks.jsonl'));
        if (stop === 'finish') {
          assert.deepEqual(journals, []); assert.deepEqual(await f.sender.listResumable(), {send: [], receive: []});
        } else {
          assert.equal(journals.length, 1); assert.equal((await fs.readFile(journals[0])).length, 0, 'A cancelled read must not append a source checkpoint');
        }
        if (stop === 'close') {
          await assert.rejects(f.sender.prepareSource([source.filename]));
          await assert.rejects(f.sender.resumeSource(source.manifest.transferId));
        }
      } finally { gate.release(); await pending.catch(() => {}); }
    });
  }
}

test('only one final source checksum may hold disk resources per source capability', async t => {
  const f = await fixture(t), data = crypto.randomBytes(BLOCK_BYTES + 17), source = await selected(f, data); await bind(f, source);
  const gate = await blockFirstDiskRead(t, source.filename);
  const first = f.sender.sourceHash({sourceId: source.sourceId, fileId: source.file.id});
  first.catch(() => {}); // The causal latch has its own deadline; retain the operation for the assertions below.
  try {
    await gate.entered;
    await assert.rejects(f.sender.sourceHash({sourceId: source.sourceId, fileId: source.file.id}), /checksum.*running/);
    gate.release(); assert.deepEqual(await first, {sha256: sha(data), size: data.length});
    assert.deepEqual(await f.sender.sourceHash({sourceId: source.sourceId, fileId: source.file.id}), {sha256: sha(data), size: data.length});
  } finally { gate.release(); await first.catch(() => {}); }
});

test('the disk-read latch observes real I/O when the selected path has a symlink ancestor alias', async t => {
  const f = await fixture(t), data = Buffer.from('canonical selected bytes');
  await put(f, 'payload.bin', data);
  const alias = path.join(f.root, 'selected-directory-alias'); await fs.symlink(f.sourceDirectory, alias, 'dir');
  const selectedPath = path.join(alias, 'payload.bin'), source = await f.sender.prepareSource([selectedPath]); await bind(f, source);
  assert.notEqual(await fs.realpath(selectedPath), selectedPath);
  const gate = await blockFirstDiskRead(t, selectedPath);
  const pending = f.sender.readBlock({sourceId: source.sourceId, fileId: source.manifest.files[0].id, offset: 0, length: data.length});
  const rejected = assert.rejects(pending, /paused|closed|Unknown source/); rejected.catch(() => {});
  try {
    await gate.entered;
    const paused = f.sender.pause({sourceId: source.sourceId}); gate.release(); await rejected; await paused;
  } finally { gate.release(); await pending.catch(() => {}); }
});

test('source resume discards only an incomplete checkpoint tail and requires fresh peer approval', async t => {
  const f = await fixture(t), data = crypto.randomBytes(BLOCK_BYTES + 13), source = await selected(f, data); await bind(f, source);
  await f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: BLOCK_BYTES});
  await f.sender.pause({sourceId: source.sourceId}); await f.sender.close();
  const journal = (await regularFiles(path.join(f.root, 'send-state'))).find(name => name.endsWith('.send-blocks.jsonl'));
  assert.ok(journal); const committed = await fs.readFile(journal); assert.equal(committed.at(-1), 10);
  await fs.appendFile(journal, '{"id":"unfinished');
  const reopened = await f.open('send'), resumed = await reopened.resumeSource(source.manifest.transferId);
  assert.deepEqual(await fs.readFile(journal), committed);
  await assert.rejects(reopened.readBlock({sourceId: resumed.sourceId, fileId: source.file.id, offset: BLOCK_BYTES, length: 13}));
  await assert.rejects(reopened.sourceHash({sourceId: resumed.sourceId, fileId: source.file.id}));
  await assert.rejects(reopened.bindPeer({sourceId: resumed.sourceId, peerDeviceId: OTHER}));
  await reopened.bindPeer({sourceId: resumed.sourceId, peerDeviceId: RECEIVER});
  const last = await reopened.readBlock({sourceId: resumed.sourceId, fileId: source.file.id, offset: BLOCK_BYTES, length: 13});
  assert.deepEqual(last.data, data.subarray(BLOCK_BYTES)); assert.equal(last.sha256, sha(data.subarray(BLOCK_BYTES)));
});

test('source resume rejects a malformed newline-terminated checkpoint rather than discarding it', async t => {
  const f = await fixture(t), source = await selected(f, Buffer.from('chosen bytes')); await bind(f, source);
  await f.sender.readBlock({sourceId: source.sourceId, fileId: source.file.id, offset: 0, length: source.file.size});
  await f.sender.pause({sourceId: source.sourceId}); await f.sender.close();
  const journal = (await regularFiles(path.join(f.root, 'send-state'))).find(name => name.endsWith('.send-blocks.jsonl'));
  await fs.appendFile(journal, '{broken committed source record}\n');
  const reopened = await f.open('send'); await assert.rejects(reopened.resumeSource(source.manifest.transferId));
});

for (const replacedDirectory of ['partial', 'receive-folder']) {
  test(`replacing the active ${replacedDirectory} with a symlink cannot redirect block writes or their journal`, async t => {
    const f = await fixture(t), data = crypto.randomBytes(BLOCK_BYTES + 7), source = await selected(f, data); await bind(f, source);
    const target = await receive(f, source), first = data.subarray(0, BLOCK_BYTES);
    await f.receiver.writeBlock({receiveId: target.receiveId, fileId: source.file.id, offset: 0, data: first, sha256: sha(first)});
    const replaced = replacedDirectory === 'partial' ? path.join(target.folder, '.mouse-flash-partials') : target.folder;
    const original = path.join(f.root, 'original-receive-directory'), outside = path.join(f.root, 'outside-receive-grant');
    await fs.rename(replaced, original); await fs.cp(original, outside, {recursive: true}); await fs.symlink(outside, replaced, 'dir');
    const outsidePartial = replacedDirectory === 'partial' ? outside : path.join(outside, '.mouse-flash-partials');
    const part = path.join(outsidePartial, source.file.id + '.part'), journal = path.join(outsidePartial, 'blocks.jsonl');
    const originalPart = await fs.readFile(part), originalJournal = await fs.readFile(journal), last = data.subarray(BLOCK_BYTES);
    await assert.rejects(f.receiver.writeBlock({receiveId: target.receiveId, fileId: source.file.id, offset: BLOCK_BYTES, data: last, sha256: sha(last)}));
    assert.deepEqual(await fs.readFile(part), originalPart); assert.deepEqual(await fs.readFile(journal), originalJournal);
  });
}

test('finish refuses a replaced partial directory and cannot delete metadata outside its receive grant', async t => {
  const f = await fixture(t), data = Buffer.from('completed bytes'), source = await selected(f, data); await bind(f, source);
  const target = await receive(f, source); await sendRange(f.sender, source.sourceId, f.receiver, target.receiveId, source.file);
  await f.receiver.completeFile({receiveId: target.receiveId, fileId: source.file.id, sha256: sha(data)});
  const partial = path.join(target.folder, '.mouse-flash-partials'), original = path.join(f.root, 'original-partials'), outside = path.join(f.root, 'outside-finish-grant');
  await fs.rename(partial, original); await fs.cp(original, outside, {recursive: true}); await fs.symlink(outside, partial, 'dir');
  const names = (await fs.readdir(outside)).sort(), contents = await Promise.all(names.map(name => fs.readFile(path.join(outside, name))));
  await assert.rejects(f.receiver.finish({receiveId: target.receiveId}));
  assert.deepEqual((await fs.readdir(outside)).sort(), names);
  for (let index = 0; index < names.length; index++) assert.deepEqual(await fs.readFile(path.join(outside, names[index])), contents[index]);
  assert.deepEqual(await fs.readFile(path.join(target.folder, source.file.path)), data);
});

test('concurrent source resumes cannot grant one transfer to two independently approved peers', async t => {
  const f = await fixture(t), data = Buffer.from('one transfer, one peer'), source = await selected(f, data);
  await f.sender.pause({sourceId: source.sourceId});
  const results = await Promise.allSettled([f.sender.resumeSource(source.manifest.transferId), f.sender.resumeSource(source.manifest.transferId)]);
  const successes = results.filter(result => result.status === 'fulfilled');
  assert.equal(successes.length, 1, 'Exactly one live source capability may own the transfer and its journal');
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const resumed = successes[0].value;
  await f.sender.bindPeer({sourceId: resumed.sourceId, peerDeviceId: RECEIVER});
  await assert.rejects(f.sender.resumeSource(source.manifest.transferId));
  await f.sender.pause({sourceId: resumed.sourceId});
  const again = await f.sender.resumeSource(source.manifest.transferId);
  await assert.rejects(f.sender.bindPeer({sourceId: again.sourceId, peerDeviceId: OTHER}));
  await f.sender.bindPeer({sourceId: again.sourceId, peerDeviceId: RECEIVER});
  assert.deepEqual((await f.sender.readBlock({sourceId: again.sourceId, fileId: source.file.id, offset: 0, length: data.length})).data, data);
});
