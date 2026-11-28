'use strict';
// Privileged, bounded file capabilities for Mouse Flash. No peer-supplied absolute paths.
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const BLOCK_BYTES = 1024 * 1024;
const FREE_LIMIT = 100000000000;
const MAX_FILES = 250000;
const MAX_DIRECTORIES = 250000;
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;
const INTERNAL = '.mouse-flash-partials';
const HEX = /^[a-f0-9]{32}$/;
const HASH = /^[a-f0-9]{64}$/;
const RECEIPT_AGE = 30 * 24 * 60 * 60 * 1000;
const MAX_RECEIPTS = 64, MAX_RECEIPT_BYTES = 64 * 1024 * 1024;
const NOFOLLOW = fs.constants.O_NOFOLLOW || 0;
const token = () => crypto.randomBytes(16).toString('hex');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function need(value, message) { if (!value) throw new Error(message); }
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
function relativeName(value) {
  need(typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 1024, 'Invalid file name');
  need(value === value.normalize('NFC') && !/[\\\x00-\x1f\x7f<>:"|?*]/.test(value), 'Unsupported file name');
  const parts = value.split('/');
  for (const part of parts) {
    need(part && part !== '.' && part !== '..' && !/[. ]$/.test(part), 'Unsafe relative path');
    need(Buffer.byteLength(part) <= 240 && part.toLowerCase() !== INTERNAL, 'Reserved or oversized path');
    need(!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part), 'Reserved Windows name');
  }
  return value;
}
function canonicalManifest(value) {
  return JSON.stringify({v: 1, transferId: value.transferId,
    files: value.files.map(({id, path: name, size}) => ({id, path: name, size})),
    directories: value.directories, totalBytes: value.totalBytes});
}
function validateManifest(value, maxTransferBytes = FREE_LIMIT) {
  need(value && value.v === 1 && HEX.test(value.transferId), 'Invalid transfer identity');
  need(Array.isArray(value.files) && value.files.length <= MAX_FILES, 'Too many files');
  need(Array.isArray(value.directories) && value.directories.length <= MAX_DIRECTORIES, 'Too many directories');
  need(value.files.length + value.directories.length > 0, 'Nothing selected');
  const names = new Map(), ids = new Set(); let total = 0, last = null;
  for (const entry of value.files) {
    need(entry && HEX.test(entry.id) && !ids.has(entry.id) && integer(entry.size), 'Invalid file descriptor');
    const name = relativeName(entry.path); const key = name.toLowerCase();
    need(last === null || last < name, 'File list must be sorted and unique'); last = name;
    need(!names.has(key), 'File name collision'); names.set(key, 'file'); ids.add(entry.id);
    total += entry.size; need(integer(total), 'Transfer size overflow');
  }
  last = null;
  for (const item of value.directories) {
    const name = relativeName(item), key = name.toLowerCase();
    need(last === null || last < name, 'Directory list must be sorted and unique'); last = name;
    need(!names.has(key), 'Directory name collision'); names.set(key, 'directory');
  }
  for (const name of names.keys()) {
    const parts = name.split('/'); parts.pop();
    while (parts.length) { need(names.get(parts.join('/')) !== 'file', 'File used as a directory'); parts.pop(); }
  }
  need(value.totalBytes === total && integer(value.totalBytes), 'Incorrect transfer size');
  need(maxTransferBytes === null || (integer(maxTransferBytes) && total <= maxTransferBytes), 'Transfer exceeds the current size limit');
  const text = canonicalManifest(value);
  need(Buffer.byteLength(text) <= MAX_MANIFEST_BYTES, 'Manifest is too large');
  return JSON.parse(text);
}
function hashManifest(value) { return digest(canonicalManifest(value)); }
function fingerprint(stat) {
  return {dev: String(stat.dev), ino: String(stat.ino), size: Number(stat.size), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs)};
}
const directoryIdentity = stat => ({dev: String(stat.dev), ino: String(stat.ino)});
function sameFingerprint(a, b) { return Object.keys(a).every(key => a[key] === b[key]); }
async function regularHandle(filename, flags = fs.constants.O_RDONLY) {
  const handle = await fsp.open(filename, flags | NOFOLLOW, 0o600);
  try { need((await handle.stat()).isFile(), 'Expected a regular file'); return handle; }
  catch (error) { await handle.close(); throw error; }
}
async function writeAll(handle, data, offset) {
  let written = 0;
  while (written < data.length) {
    const result = await handle.write(data, written, data.length - written, offset === null ? null : offset + written);
    need(result.bytesWritten > 0, 'Disk write made no progress'); written += result.bytesWritten;
  }
}
async function readExactly(handle, length, offset) {
  const data = Buffer.alloc(length); let read = 0;
  while (read < length) {
    const result = await handle.read(data, read, length - read, offset + read);
    need(result.bytesRead > 0, 'File ended unexpectedly'); read += result.bytesRead;
  }
  return data;
}
async function atomicJSON(filename, value) {
  const temporary = filename + '.' + token() + '.tmp';
  const handle = await fsp.open(temporary, 'wx', 0o600);
  try { await writeAll(handle, Buffer.from(JSON.stringify(value)), 0); await handle.sync(); }
  catch (error) { await fsp.unlink(temporary).catch(() => {}); throw error; }
  finally { await handle.close(); }
  try { await fsp.rename(temporary, filename); }
  catch (error) { await fsp.unlink(temporary).catch(() => {}); throw error; }
  await syncDirectory(path.dirname(filename));
}
async function syncDirectory(directory) {
  const handle = await fsp.open(directory, fs.constants.O_RDONLY | NOFOLLOW);
  try { need((await handle.stat()).isDirectory(), 'Expected a directory'); await handle.sync(); }
  finally { await handle.close(); }
}
async function boundedJSON(filename, limit = MAX_MANIFEST_BYTES * 2) {
  const handle = await regularHandle(filename);
  try {
    const stat = await handle.stat(); need(stat.size <= limit, 'State file is too large');
    return JSON.parse((await readExactly(handle, stat.size, 0)).toString('utf8'));
  } finally { await handle.close(); }
}
async function hashRegular(filename, check = () => {}) {
  const handle = await regularHandle(filename); const hash = crypto.createHash('sha256');
  try {
    const stat = await handle.stat(); let offset = 0;
    while (offset < stat.size) {
      check();
      const data = await readExactly(handle, Math.min(BLOCK_BYTES, stat.size - offset), offset);
      hash.update(data); offset += data.length;
    }
    check(); return {sha256: hash.digest('hex'), size: offset};
  } finally { await handle.close(); }
}
async function trimUncommittedTail(filename) {
  const handle = await regularHandle(filename, fs.constants.O_RDWR);
  try {
    const size = (await handle.stat()).size;
    if (!size) return;
    const tail = await readExactly(handle, Math.min(2048, size), Math.max(0, size - 2048));
    if (tail[tail.length - 1] === 10) return;
    const newline = tail.lastIndexOf(10);
    need(newline >= 0 || size <= 1024, 'Oversized incomplete resume record');
    await handle.truncate(newline >= 0 ? size - tail.length + newline + 1 : 0); await handle.sync();
  } finally { await handle.close(); }
}
function sourceIdle(source) {
  if (!source._reading && !source._hashing) return Promise.resolve();
  return new Promise(resolve => source._idleWaiters.add(resolve));
}
function sourceSettled(source) {
  if (!source._reading && !source._hashing) { for (const resolve of source._idleWaiters) resolve(); source._idleWaiters.clear(); }
}
async function safeDirectory(directory) {
  const stat = await fsp.lstat(directory);
  need(stat.isDirectory() && !stat.isSymbolicLink(), 'Unsafe directory');
  return fsp.realpath(directory);
}
async function targetPath(root, relative, createParents = false) {
  relativeName(relative); const pieces = relative.split('/'); const base = pieces.pop(); let directory = root;
  for (const piece of pieces) {
    directory = path.join(directory, piece);
    if (createParents) {
      try { await fsp.mkdir(directory, {mode: 0o700}); await syncDirectory(path.dirname(directory)); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    await safeDirectory(directory);
  }
  const actual = await fsp.realpath(directory);
  need(actual === root || actual.startsWith(root + path.sep), 'Destination escaped its selected folder');
  return path.join(actual, base);
}
class FlashFiles {
  constructor({stateDirectory, maxTransferBytes = FREE_LIMIT, publishLink = (...args) => fsp.link(...args), fault = null}) {
    need(path.isAbsolute(stateDirectory), 'An absolute private state directory is required');
    this.stateDirectory = stateDirectory; this.maxTransferBytes = maxTransferBytes;
    this.publishLink = publishLink; this.fault = fault;
    this.sources = new Map(); this.receivers = new Map(); this.preparing = new Set(); this.preparingSources = new Set(); this.closed = false;
  }
  async initialize() {
    await fsp.mkdir(this.stateDirectory, {recursive: true, mode: 0o700});
    this.stateDirectory = await safeDirectory(this.stateDirectory); await this.pruneCompleted(); return this;
  }
  statePath(id, role) { need(HEX.test(id) && ['send', 'receive'].includes(role), 'Invalid saved session'); return path.join(this.stateDirectory, id + '.' + role + '.json'); }
  sourceJournalPath(id) { need(HEX.test(id), 'Invalid source journal'); return path.join(this.stateDirectory, id + '.send-blocks.jsonl'); }
  receiptPath(id) { need(HEX.test(id), 'Invalid completion receipt'); return path.join(this.stateDirectory, id + '.complete.json'); }
  async readReceipt(id) {
    let saved;
    try { saved = await boundedJSON(this.receiptPath(id), MAX_RECEIPT_BYTES); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    need(saved && saved.v === 1 && saved.transferId === id && HASH.test(saved.manifestHash) && HEX.test(saved.peerDeviceId) &&
      typeof saved.folder === 'string' && path.isAbsolute(saved.folder) && saved.folderIdentity &&
      Array.isArray(saved.hashes) && saved.hashes.length <= MAX_FILES && saved.fileCount === saved.hashes.length && integer(saved.totalBytes) &&
      integer(saved.completedAt) && saved.completedAt <= Date.now() + 60000 && Date.now() - saved.completedAt <= RECEIPT_AGE,
    'Invalid or expired completion receipt');
    const ids = new Set();
    for (const item of saved.hashes) { need(item && HEX.test(item.id) && !ids.has(item.id) && HASH.test(item.sha256), 'Invalid completion receipt checksum'); ids.add(item.id); }
    return saved;
  }
  async pruneCompleted() {
    const entries = [];
    for (const name of await fsp.readdir(this.stateDirectory)) {
      if (!/^[a-f0-9]{32}\.complete\.json$/.test(name)) continue;
      const filename = path.join(this.stateDirectory, name), stat = await fsp.lstat(filename);
      // Never follow a substituted receipt; leave unexpected objects for explicit inspection.
      if (stat.isFile() && !stat.isSymbolicLink()) entries.push({filename, size: stat.size, at: stat.mtimeMs});
    }
    entries.sort((a, b) => b.at - a.at); let bytes = 0, kept = 0, changed = false;
    for (const entry of entries) {
      if (Date.now() - entry.at > RECEIPT_AGE || kept >= MAX_RECEIPTS || bytes + entry.size > MAX_RECEIPT_BYTES) {
        await fsp.unlink(entry.filename); changed = true;
      } else { kept++; bytes += entry.size; }
    }
    if (changed) await syncDirectory(this.stateDirectory);
  }
  async listCompleted() {
    await this.pruneCompleted(); const result = [];
    for (const name of await fsp.readdir(this.stateDirectory)) {
      const match = /^([a-f0-9]{32})\.complete\.json$/.exec(name); if (!match) continue;
      try {
        const saved = await this.readReceipt(match[1]);
        if (saved) result.push({transferId: saved.transferId, peerDeviceId: saved.peerDeviceId, manifestHash: saved.manifestHash,
          fileCount: saved.fileCount, totalBytes: saved.totalBytes, folderName: path.basename(saved.folder)});
      } catch { /* Invalid receipts never authorize a completed receive. */ }
    }
    return result;
  }
  async cleanupCompleted(receipt) {
    const state = {...receipt, partial: path.join(receipt.folder, INTERNAL), receipt: true};
    await this.checkReceivePaths(state);
    let partialExists = false;
    try { await fsp.lstat(state.partial); partialExists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (partialExists) {
      state.receipt = false; await this.checkReceivePaths(state);
      for (const item of receipt.hashes) {
        await this.checkReceivePaths(state);
        await fsp.unlink(path.join(state.partial, item.id + '.part')).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      for (const name of ['blocks.jsonl', 'manifest.json']) {
        await this.checkReceivePaths(state); await fsp.unlink(path.join(state.partial, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      await this.checkReceivePaths(state); await fsp.rmdir(state.partial); await syncDirectory(state.folder);
    }
    let saved;
    try { saved = await boundedJSON(this.statePath(receipt.transferId, 'receive')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (saved) {
      need(saved.manifestHash === receipt.manifestHash && saved.peerDeviceId === receipt.peerDeviceId && saved.folder === receipt.folder &&
        saved.folderIdentity?.dev === receipt.folderIdentity.dev && saved.folderIdentity?.ino === receipt.folderIdentity.ino, 'Saved receive changed after completion');
      await fsp.unlink(this.statePath(receipt.transferId, 'receive')); await syncDirectory(this.stateDirectory);
    }
  }
  async preflightPublication(partial) {
    const source = path.join(partial, 'publish-probe-' + token()), target = source + '.linked';
    let handle;
    try {
      handle = await fsp.open(source, 'wx', 0o600); await handle.write(Buffer.from('Mouse Flash filesystem check')); await handle.sync(); await handle.close(); handle = null;
      await this.publishLink(source, target);
      const a = await fsp.lstat(source), b = await fsp.lstat(target);
      need(b.isFile() && a.dev === b.dev && a.ino === b.ino, 'The selected file system cannot publish files safely');
      await syncDirectory(partial);
    } catch (cause) {
      throw new Error('This file system does not support safe file publication with hard links. Choose a folder on the internal Mac disk.', {cause});
    } finally {
      await handle?.close(); await fsp.unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await fsp.unlink(source).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  async prepareSource(selected) {
    need(!this.closed && Array.isArray(selected) && selected.length > 0, 'Choose files or folders');
    const files = [], directories = [], local = []; let totalBytes = 0;
    const walk = async (absolute, relative) => {
      need(!this.closed, 'Flash is closed');
      relativeName(relative); const stat = await fsp.lstat(absolute, {bigint: true});
      need(!stat.isSymbolicLink(), 'Symbolic links are not transferred');
      if (stat.isDirectory()) {
        need(directories.length < MAX_DIRECTORIES, 'Too many directories'); directories.push(relative);
        const children = await fsp.readdir(absolute); children.sort();
        for (const child of children) await walk(path.join(absolute, child), relative + '/' + child.normalize('NFC'));
      } else {
        need(stat.isFile() && files.length < MAX_FILES, 'Only regular files can be transferred');
        const size = Number(stat.size); need(integer(size), 'File size is out of range');
        totalBytes += size;
        need(integer(totalBytes) && (this.maxTransferBytes === null || totalBytes <= this.maxTransferBytes), 'Transfer exceeds the current size limit');
        const id = token(); files.push({id, path: relative, size});
        local.push({id, absolute: await fsp.realpath(absolute), fingerprint: fingerprint(stat)});
      }
    };
    for (const item of selected) {
      need(typeof item === 'string' && path.isAbsolute(item), 'Invalid selected path');
      await walk(item, path.basename(item).normalize('NFC'));
    }
    files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0); directories.sort();
    const manifest = validateManifest({v: 1, transferId: token(), files, directories, totalBytes}, this.maxTransferBytes);
    const saved = {v: 1, manifest, manifestHash: hashManifest(manifest), local, peerDeviceId: null};
    need(Buffer.byteLength(JSON.stringify(saved)) <= MAX_MANIFEST_BYTES * 2, 'Source index is too large');
    const journal = await fsp.open(this.sourceJournalPath(manifest.transferId), 'wx', 0o600); await journal.close();
    await atomicJSON(this.statePath(manifest.transferId, 'send'), saved);
    return this.addSource(saved);
  }
  addSource(saved) {
    need(!this.closed, 'Flash is closed');
    Object.defineProperty(saved, '_approved', {value: false, writable: true});
    Object.defineProperty(saved, '_reading', {value: 0, writable: true});
    Object.defineProperty(saved, '_hashing', {value: 0, writable: true});
    Object.defineProperty(saved, '_idleWaiters', {value: new Set()});
    Object.defineProperty(saved, '_journalQueue', {value: Promise.resolve(), writable: true});
    const sourceId = token(); this.sources.set(sourceId, saved);
    return {sourceId, manifest: saved.manifest, manifestHash: saved.manifestHash};
  }
  async resumeSource(transferId) {
    need(!this.closed, 'Flash is closed');
    need(HEX.test(transferId) && !this.preparingSources.has(transferId) && ![...this.sources.values()].some(value => value.manifest.transferId === transferId), 'Source session is already active');
    this.preparingSources.add(transferId);
    try { return await this._resumeSource(transferId); } finally { this.preparingSources.delete(transferId); }
  }
  async _resumeSource(transferId) {
    const saved = await boundedJSON(this.statePath(transferId, 'send'));
    saved.manifest = validateManifest(saved.manifest, this.maxTransferBytes);
    need(saved.manifest.transferId === transferId && saved.manifestHash === hashManifest(saved.manifest), 'Saved manifest changed');
    need(Array.isArray(saved.local) && saved.local.length === saved.manifest.files.length, 'Saved source capabilities differ');
    for (const descriptor of saved.local) await this.checkSourceFile(saved, descriptor.id);
    await this.verifySourceJournal(saved);
    return this.addSource(saved);
  }
  async verifySourceJournal(source) {
    const filename = this.sourceJournalPath(source.manifest.transferId);
    await trimUncommittedTail(filename);
    const lines = readline.createInterface({input: fs.createReadStream(filename, {highWaterMark: 16384}), crlfDelay: Infinity});
    try {
      for await (const line of lines) {
        need(Buffer.byteLength(line) <= 1024, 'Oversized saved source record');
        const row = JSON.parse(line); const {entry, local} = await this.checkSourceFile(source, row.id);
        need(integer(row.offset) && integer(row.length) && row.length > 0 && row.length <= BLOCK_BYTES && row.offset + row.length <= entry.size && HASH.test(row.sha256), 'Invalid source checkpoint');
        const file = await regularHandle(local.absolute);
        try { need(digest(await readExactly(file, row.length, row.offset)) === row.sha256, 'Previously sent source data changed; resume refused'); }
        finally { await file.close(); }
      }
    } finally { lines.close(); lines.input.destroy(); }
  }
  source(id) { const source = this.sources.get(id); need(source && !this.closed, 'Unknown source capability'); return source; }
  async bindPeer({sourceId, peerDeviceId}) {
    need(HEX.test(peerDeviceId), 'Invalid peer device identity'); const source = this.source(sourceId);
    need(!source.peerDeviceId || source.peerDeviceId === peerDeviceId, 'A resumed transfer belongs to another device');
    source.peerDeviceId = peerDeviceId;
    await atomicJSON(this.statePath(source.manifest.transferId, 'send'), source);
    need(this.sources.get(sourceId) === source && !this.closed, 'Transfer paused'); source._approved = true; return {ok: true};
  }
  async checkSourceFile(source, fileId) {
    need(!this.closed, 'Flash is closed');
    if (!source._fileMap) Object.defineProperty(source, '_fileMap', {value: new Map(source.manifest.files.map(item => [item.id, item]))});
    if (!source._localMap) Object.defineProperty(source, '_localMap', {value: new Map(source.local.map(item => [item.id, item]))});
    const entry = source._fileMap.get(fileId), local = source._localMap.get(fileId);
    need(entry && local && path.isAbsolute(local.absolute), 'Unknown selected file');
    const stat = await fsp.lstat(local.absolute, {bigint: true});
    need(stat.isFile() && !stat.isSymbolicLink() && sameFingerprint(local.fingerprint, fingerprint(stat)), 'Selected file changed; choose it again');
    need(await fsp.realpath(local.absolute) === local.absolute, 'Selected source path changed'); return {entry, local};
  }
  async readBlock({sourceId, fileId, offset, length}) {
    const source = this.source(sourceId); need(source.peerDeviceId && source._approved, 'Approve a peer before reading transfer bytes');
    need(source._reading < 4, 'Too many source reads'); source._reading++;
    try {
      const {entry, local} = await this.checkSourceFile(source, fileId);
      need(integer(offset) && integer(length) && length > 0 && length <= BLOCK_BYTES && offset + length <= entry.size, 'Invalid source range');
      const handle = await regularHandle(local.absolute); let data;
      try {
        need(sameFingerprint(local.fingerprint, fingerprint(await handle.stat({bigint: true}))), 'Selected file changed');
        data = await readExactly(handle, length, offset);
        need(sameFingerprint(local.fingerprint, fingerprint(await handle.stat({bigint: true}))), 'Selected file changed during reading');
      } finally { await handle.close(); }
      const sha256 = digest(data);
      const save = source._journalQueue.then(async () => {
        need(source._approved && !this.closed, 'Transfer paused');
        const journal = await regularHandle(this.sourceJournalPath(source.manifest.transferId), fs.constants.O_WRONLY | fs.constants.O_APPEND);
        try { await writeAll(journal, Buffer.from(JSON.stringify({id: fileId, offset, length, sha256}) + '\n'), null); await journal.sync(); }
        finally { await journal.close(); }
      });
      source._journalQueue = save.catch(() => {}); await save;
      need(source._approved && !this.closed, 'Transfer paused');
      return {data, sha256};
    } finally { source._reading--; sourceSettled(source); }
  }
  async sourceHash({sourceId, fileId}) {
    const source = this.source(sourceId); need(source.peerDeviceId && source._approved, 'Approve a peer first');
    need(!source._hashing, 'A final checksum is already running'); source._hashing++;
    try {
      const {local} = await this.checkSourceFile(source, fileId);
      const check = () => need(source._approved && !this.closed, 'Transfer paused');
      const value = await hashRegular(local.absolute, check);
      await this.checkSourceFile(source, fileId); check(); return value;
    } finally { source._hashing--; sourceSettled(source); }
  }
  async prepareReceive(options) {
    const id = options?.manifest?.transferId;
    need(HEX.test(id) && !this.preparing.has(id) && ![...this.receivers.values()].some(state => state.active && state.manifest.transferId === id), 'Receive session is already active or invalid');
    this.preparing.add(id);
    try { return await this._prepareReceive(options); } finally { this.preparing.delete(id); }
  }
  async _prepareReceive({manifest: proposed, manifestHash, peerDeviceId, destination, resume = false}) {
    need(!this.closed && HEX.test(peerDeviceId), 'Invalid peer identity');
    const manifest = validateManifest(proposed, this.maxTransferBytes);
    need(HASH.test(manifestHash) && manifestHash === hashManifest(manifest), 'Manifest checksum mismatch');
    need(typeof destination === 'string' && path.isAbsolute(destination), 'Choose a destination folder');
    const receipt = await this.readReceipt(manifest.transferId);
    if (receipt) {
      need(resume, 'This transfer is already complete; choose Resume to confirm its receipt');
      need(receipt.peerDeviceId === peerDeviceId && receipt.manifestHash === manifestHash && receipt.fileCount === manifest.files.length && receipt.totalBytes === manifest.totalBytes, 'Resume device or manifest mismatch');
      const folder = await safeDirectory(destination); need(folder === receipt.folder, 'Choose the original receive folder');
      const state = {...receipt, manifest, receipt: true, active: true, queue: Promise.resolve(), pending: 0,
        filesById: new Map(manifest.files.map(file => [file.id, file])), offsets: new Map(manifest.files.map(file => [file.id, file.size])),
        complete: new Map(receipt.hashes.map(item => [item.id, item.sha256]))};
      await this.checkReceivePaths(state);
      for (const file of manifest.files) {
        need(state.complete.has(file.id), 'Completion receipt file mismatch');
        const value = await hashRegular(await targetPath(folder, file.path), () => need(!this.closed, 'Flash is closed'));
        need(value.size === file.size && value.sha256 === state.complete.get(file.id), 'Completed file changed');
      }
      await this.cleanupCompleted(receipt);
      await this.checkReceivePaths(state); const receiveId = token(); this.receivers.set(receiveId, state);
      return {receiveId, folderName: path.basename(folder), offsets: manifest.files.map(file => ({id: file.id, offset: file.size})), completedReceipt: true};
    }
    let folder, partial, saved;
    if (resume) {
      saved = await boundedJSON(this.statePath(manifest.transferId, 'receive'));
      need(saved.peerDeviceId === peerDeviceId && saved.manifestHash === manifestHash && hashManifest(saved.manifest) === manifestHash, 'Resume device or manifest mismatch');
      folder = await safeDirectory(destination);
      need(folder === saved.folder, 'Choose the original receive folder');
      partial = await safeDirectory(path.join(folder, INTERNAL));
    } else {
      const parent = await safeDirectory(destination);
      try { await fsp.access(this.statePath(manifest.transferId, 'receive')); throw new Error('This transfer has saved data; choose Resume'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const capacity = await fsp.statfs(parent, {bigint: true});
      need(capacity.bavail * capacity.bsize >= BigInt(manifest.totalBytes) + 1024n * 1024n, 'Not enough free disk space');
      folder = await fsp.mkdtemp(path.join(parent, 'Mouse Flash-')); await fsp.chmod(folder, 0o700);
      await syncDirectory(parent);
      partial = path.join(folder, INTERNAL); await fsp.mkdir(partial, {mode: 0o700});
      try { await this.preflightPublication(partial); }
      catch (error) { await fsp.rmdir(partial).catch(() => {}); await fsp.rmdir(folder).catch(() => {}); throw error; }
      saved = {v: 1, manifest, manifestHash, peerDeviceId, folder,
        folderIdentity: directoryIdentity(await fsp.lstat(folder)), partialIdentity: directoryIdentity(await fsp.lstat(partial))};
      await atomicJSON(path.join(partial, 'manifest.json'), saved);
      const journal = await fsp.open(path.join(partial, 'blocks.jsonl'), 'wx', 0o600); await journal.close();
      await atomicJSON(this.statePath(manifest.transferId, 'receive'), saved);
    }
    const onDisk = await boundedJSON(path.join(partial, 'manifest.json'));
    need(onDisk.peerDeviceId === peerDeviceId && onDisk.manifestHash === manifestHash && hashManifest(onDisk.manifest) === manifestHash, 'Receive folder identity mismatch');
    const state = {...saved, manifest, partial, filesById: new Map(manifest.files.map(file => [file.id, file])), offsets: new Map(manifest.files.map(file => [file.id, 0])), complete: new Map(), queue: Promise.resolve(), pending: 0, active: true};
    await this.checkReceivePaths(state);
    if (resume) await this.preflightPublication(partial);
    await this.restoreJournal(state);
    for (const directory of manifest.directories) {
      const target = await targetPath(folder, directory, true);
      await fsp.mkdir(target, {mode: 0o700}).catch(error => { if (error.code !== 'EEXIST') throw error; }); await safeDirectory(target);
      await syncDirectory(path.dirname(target));
    }
    const remaining = manifest.files.reduce((sum, file) => sum + file.size - state.offsets.get(file.id), 0);
    const capacity = await fsp.statfs(folder, {bigint: true});
    need(capacity.bavail * capacity.bsize >= BigInt(remaining), 'Not enough free disk space to resume');
    need(!this.closed, 'Flash is closed'); const receiveId = token(); this.receivers.set(receiveId, state);
    return {receiveId, folderName: path.basename(folder), offsets: manifest.files.map(file => ({id: file.id, offset: state.offsets.get(file.id)}))};
  }
  async restoreJournal(state) {
    await this.checkReceivePaths(state);
    const journalPath = path.join(state.partial, 'blocks.jsonl');
    // A record without its newline cannot have been durably acknowledged.
    await trimUncommittedTail(journalPath);
    const stream = fs.createReadStream(journalPath, {highWaterMark: 16384});
    const lines = readline.createInterface({input: stream, crlfDelay: Infinity});
    let validBytes = 0;
    try {
      for await (const line of lines) {
        need(Buffer.byteLength(line) <= 1024, 'Oversized resume record');
        let row;
        try { row = JSON.parse(line); } catch { throw new Error('Resume journal is incomplete or changed'); }
        const file = state.filesById.get(row.id); need(file && !state.complete.has(file.id), 'Invalid resume file');
        if (row.type === 'block') {
          need(integer(row.offset) && row.offset === state.offsets.get(file.id) && row.offset % BLOCK_BYTES === 0 && row.length === Math.min(BLOCK_BYTES, file.size - row.offset) && row.length > 0 && HASH.test(row.sha256), 'Invalid resume checkpoint');
          state.offsets.set(file.id, row.offset + row.length);
        } else if (row.type === 'complete') {
          need(row.size === file.size && state.offsets.get(file.id) === file.size && HASH.test(row.sha256), 'Incomplete file marked complete');
          state.complete.set(file.id, row.sha256);
        } else throw new Error('Unknown resume checkpoint');
        validBytes += Buffer.byteLength(line) + 1;
      }
    } finally { lines.close(); stream.destroy(); }
    // Re-read committed blocks on resume: local disk reads, never retransmit verified data.
    const reread = readline.createInterface({input: fs.createReadStream(journalPath, {highWaterMark: 16384}), crlfDelay: Infinity});
    try {
      for await (const line of reread) {
        const row = JSON.parse(line); if (row.type !== 'block') continue;
        const file = state.filesById.get(row.id);
        const filename = state.complete.has(file.id) ? await targetPath(state.folder, file.path) : path.join(state.partial, file.id + '.part');
        const handle = await regularHandle(filename);
        try { need(digest(await readExactly(handle, row.length, row.offset)) === row.sha256, 'Saved file data changed; resume refused'); }
        finally { await handle.close(); }
      }
    } finally { reread.close(); reread.input.destroy(); }
    for (const file of state.manifest.files) {
      if (state.complete.has(file.id)) {
        const value = await hashRegular(await targetPath(state.folder, file.path));
        need(value.size === file.size && value.sha256 === state.complete.get(file.id), 'Completed file changed'); continue;
      }
      const filename = path.join(state.partial, file.id + '.part'); let handle;
      try { handle = await regularHandle(filename, fs.constants.O_RDWR); }
      catch (error) {
        if (error.code !== 'ENOENT' || state.offsets.get(file.id) !== 0) throw error;
        continue; // Create a partial lazily, not hundreds of thousands of empty files up front.
      }
      try { need((await handle.stat()).size >= state.offsets.get(file.id), 'Saved data is missing'); await handle.truncate(state.offsets.get(file.id)); }
      finally { await handle.close(); }
    }
    const stat = await fsp.stat(journalPath); need(stat.size === validBytes, 'Resume journal has an incomplete tail');
  }
  receiver(id) { const state = this.receivers.get(id); need(state && state.active && !this.closed, 'Unknown receive capability'); return state; }
  async checkReceivePaths(state) {
    need(!this.closed, 'Flash is closed');
    const directories = [[state.folder, state.folderIdentity]];
    if (!state.receipt) directories.push([state.partial, state.partialIdentity]);
    for (const [directory, expected] of directories) {
      need(expected && typeof expected.dev === 'string' && typeof expected.ino === 'string', 'Missing receive folder identity');
      const stat = await fsp.lstat(directory);
      need(stat.isDirectory() && !stat.isSymbolicLink() && stat.dev.toString() === expected.dev && stat.ino.toString() === expected.ino && await fsp.realpath(directory) === directory, 'Receive directory changed; transfer paused');
    }
  }
  enqueue(state, work) {
    need(state.pending < 4, 'Too many pending disk blocks'); state.pending++;
    const result = state.queue.then(() => { need(state.active, 'Transfer paused'); return work(); });
    state.queue = result.catch(() => {}).finally(() => { state.pending--; }); return result;
  }
  async journal(state, record) {
    await this.checkReceivePaths(state);
    const handle = await regularHandle(path.join(state.partial, 'blocks.jsonl'), fs.constants.O_WRONLY | fs.constants.O_APPEND);
    try { await writeAll(handle, Buffer.from(JSON.stringify(record) + '\n'), null); await handle.sync(); }
    finally { await handle.close(); }
  }
  async writeBlock({receiveId, fileId, offset, data, sha256}) {
    const state = this.receiver(receiveId);
    need((Buffer.isBuffer(data) || data instanceof Uint8Array) && data.byteLength > 0 && data.byteLength <= BLOCK_BYTES, 'Invalid bounded data block');
    const bytes = Buffer.from(data); need(HASH.test(sha256) && digest(bytes) === sha256, 'Block checksum mismatch');
    return this.enqueue(state, async () => {
      await this.checkReceivePaths(state);
      const file = state.filesById.get(fileId);
      need(file && !state.complete.has(fileId) && integer(offset) && offset === state.offsets.get(fileId) && offset % BLOCK_BYTES === 0, 'Out-of-order or unknown file block');
      need(bytes.length === Math.min(BLOCK_BYTES, file.size - offset), 'Incorrect block length');
      const filename = path.join(state.partial, fileId + '.part'); let handle;
      try { handle = await regularHandle(filename, fs.constants.O_RDWR); }
      catch (error) {
        if (error.code !== 'ENOENT' || offset !== 0) throw error;
        handle = await fsp.open(filename, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | NOFOLLOW, 0o600);
      }
      try { await writeAll(handle, bytes, offset); await handle.sync(); } finally { await handle.close(); }
      await this.journal(state, {type: 'block', id: fileId, offset, length: bytes.length, sha256});
      await this.checkReceivePaths(state);
      state.offsets.set(fileId, offset + bytes.length); return {id: fileId, offset: offset + bytes.length};
    });
  }
  async completeFile({receiveId, fileId, sha256}) {
    const state = this.receiver(receiveId); need(HASH.test(sha256), 'Invalid final checksum');
    return this.enqueue(state, async () => {
      await this.checkReceivePaths(state);
      const file = state.filesById.get(fileId); need(file && state.offsets.get(fileId) === file.size, 'File is incomplete');
      if (state.complete.has(fileId)) { need(state.complete.get(fileId) === sha256, 'Completed checksum changed'); return {id: fileId, ok: true}; }
      const partial = path.join(state.partial, fileId + '.part');
      if (file.size === 0) {
        const empty = await fsp.open(partial, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | NOFOLLOW, 0o600).catch(error => { if (error.code !== 'EEXIST') throw error; return null; });
        if (empty) { await empty.sync(); await empty.close(); }
      }
      const value = await hashRegular(partial);
      need(value.size === file.size && value.sha256 === sha256, 'Final file checksum mismatch');
      const destination = await targetPath(state.folder, file.path, true);
      // link is atomic and refuses EEXIST, unlike rename which could overwrite a user file.
      try { await this.publishLink(partial, destination); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const a = await fsp.lstat(partial), b = await fsp.lstat(destination);
        // Recover our own completed link after a crash; never accept an unrelated existing file.
        need(b.isFile() && !b.isSymbolicLink() && a.dev === b.dev && a.ino === b.ino, 'Refusing to overwrite an existing destination');
      }
      await syncDirectory(path.dirname(destination));
      await this.journal(state, {type: 'complete', id: fileId, size: file.size, sha256});
      await this.checkReceivePaths(state);
      state.complete.set(fileId, sha256); await fsp.unlink(partial); return {id: fileId, ok: true};
    });
  }
  async finish({sourceId, receiveId}) {
    if (sourceId) {
      const source = this.source(sourceId); need(source.peerDeviceId && source._approved, 'No approved peer');
      source._approved = false; await sourceIdle(source); await source._journalQueue;
      // Stop advertising a resumable source before deleting its journal.
      await fsp.unlink(this.statePath(source.manifest.transferId, 'send')); await syncDirectory(this.stateDirectory);
      await fsp.unlink(this.sourceJournalPath(source.manifest.transferId)); this.sources.delete(sourceId);
    }
    if (receiveId) {
      const state = this.receiver(receiveId); await state.queue;
      need(state.complete.size === state.manifest.files.length, 'Transfer is incomplete');
      need(!state.finishing, 'Completion is already pending'); state.finishing = true;
      try {
      await this.checkReceivePaths(state);
      if (state.receipt) { state.active = false; this.receivers.delete(receiveId); return {ok: true}; }
      const receipt = {v: 1, transferId: state.manifest.transferId, manifestHash: state.manifestHash, peerDeviceId: state.peerDeviceId,
        folder: state.folder, folderIdentity: state.folderIdentity, partialIdentity: state.partialIdentity, hashes: [...state.complete].map(([id, sha256]) => ({id, sha256})),
        fileCount: state.manifest.files.length, totalBytes: state.manifest.totalBytes, completedAt: Date.now()};
      // The receipt is durable BEFORE deleting any receive checkpoints or acknowledging finish.
      await atomicJSON(this.receiptPath(state.manifest.transferId), receipt);
      if (this.fault) await this.fault('completion-receipt-durable');
      await this.cleanupCompleted(receipt);
      state.active = false; this.receivers.delete(receiveId); await this.pruneCompleted();
      } finally { state.finishing = false; }
    }
    return {ok: true};
  }
  async pause({sourceId, receiveId} = {}) {
    if (sourceId) { const source = this.sources.get(sourceId); if (source) { source._approved = false; this.sources.delete(sourceId); await sourceIdle(source); await source._journalQueue; } }
    if (receiveId) { const state = this.receivers.get(receiveId); if (state) { state.active = false; this.receivers.delete(receiveId); await state.queue; } }
    return {ok: true};
  }
  async listResumable() {
    const result = {send: [], receive: []};
    for (const filename of await fsp.readdir(this.stateDirectory)) {
      const match = /^([a-f0-9]{32})\.(send|receive)\.json$/.exec(filename); if (!match) continue;
      try {
        const saved = await boundedJSON(path.join(this.stateDirectory, filename));
        const manifest = validateManifest(saved.manifest, this.maxTransferBytes);
        need(saved.manifestHash === hashManifest(manifest), 'Invalid saved transfer');
        result[match[2]].push({transferId: manifest.transferId, fileCount: manifest.files.length, totalBytes: manifest.totalBytes, peerDeviceId: saved.peerDeviceId || null, ...(match[2] === 'receive' ? {folderName: path.basename(saved.folder)} : {})});
      } catch { /* Damaged entries are never promoted to file capabilities. */ }
    }
    return result;
  }
  async close() {
    this.closed = true;
    await Promise.all([...this.sources.keys()].map(sourceId => this.pause({sourceId})));
    await Promise.all([...this.receivers.keys()].map(receiveId => this.pause({receiveId})));
  }
}
module.exports = {FlashFiles, BLOCK_BYTES, FREE_LIMIT, MAX_FILES, MAX_DIRECTORIES, MAX_MANIFEST_BYTES, canonicalManifest, validateManifest, hashManifest, relativeName};
