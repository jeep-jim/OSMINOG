'use strict';

// Only the offscreen page touches clipboard files. Media goes directly to IDB;
// extension messages contain status and committed IDs, never file contents.
const sink = document.querySelector('#clipboard');
const MAX_FILE_BYTES = 32 * 1024 * 1024, MAX_BATCH_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 256, MAX_TEXT_CHARS = 4 * 1024 * 1024, COMPARE_CHUNK = 65536;
let config = {}, migrated = false, busy = false, again = false, baseline = true;
let pasteTask = null, retry = null, last = null, reportedError = '', timer = 0, eventLeaseUntil = 0, bootstrapTask = null;

function permanent(message) { const error = Error(message); error.retryable = false; return error; }
async function digest(blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function sameBytes(left, right) {
  if (!left || left.size !== right.size || left.type !== right.type) return false;
  let yielded = performance.now();
  for (let offset = 0; offset < left.size; offset += COMPARE_CHUNK) {
    const buffers = await Promise.all([left.slice(offset, offset + COMPARE_CHUNK).arrayBuffer(), right.slice(offset, offset + COMPARE_CHUNK).arrayBuffer()]);
    const a = new Uint8Array(buffers[0]), b = new Uint8Array(buffers[1]);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    if (performance.now() - yielded > 8) { await new Promise(resolve => setTimeout(resolve, 0)); yielded = performance.now(); }
  }
  return true;
}
function fileDescriptor(file) {
  return {name: file.name || '', mime: file.type || 'application/octet-stream', size: file.size};
}
function immutableFile(file) { return new Blob([file], {type: file.type || 'application/octet-stream'}); }
function snapshotPaste(data) {
  const files = Array.from(data?.files || []);
  if (!files.length) for (const item of data?.items || []) {
    if (item.kind === 'file') { const file = item.getAsFile(); if (file) files.push(file); }
  }
  if (files.length) {
    if (files.length > MAX_FILES || files.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES) {
      throw permanent('Набор файлов из буфера превышает лимит: 256 файлов или 256 МБ. Скопируйте меньшую группу.');
    }
    if (files.some(file => file.size > MAX_FILE_BYTES)) throw permanent('В буфере есть файл больше 32 МБ. Скопируйте меньшую группу файлов.');
    return {kind: 'files', files};
  }
  const text = data?.getData('text/plain') || '';
  if (text.length > MAX_TEXT_CHARS) throw permanent('Текст из буфера больше 4 млн символов. Автоматический сбор не обработал его.');
  return text ? {kind: 'text', text} : null;
}
sink.addEventListener('paste', event => {
  event.preventDefault();
  // Retain all File handles inside this event; subsequent reads are sequential.
  try { pasteTask = Promise.resolve(snapshotPaste(event.clipboardData)); }
  catch (error) { pasteTask = Promise.reject(error); pasteTask.catch(() => {}); }
});
async function report(error) {
  const message = error ? String(error.message || error).slice(0, 240) : '';
  if (message === reportedError) return;
  try { await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_ERROR', error: message}); reportedError = message; } catch {}
}
async function unchanged(capture) {
  if (capture.kind !== last?.kind) return false;
  if (capture.kind === 'text') return capture.text === last.text;
  if (capture.files.length !== last.files.length) return false;
  for (let i = 0; i < capture.files.length; i++) {
    const file = capture.files[i], old = last.files[i], descriptor = fileDescriptor(file);
    if (descriptor.name !== old.name || descriptor.mime !== old.mime || descriptor.size !== old.size) return false;
    const before = old.assetId ? await OSMINOGCoreStore.getBlob(old.assetId) : old.blob;
    if (!await sameBytes(before, immutableFile(file))) return false;
  }
  return true;
}
async function fileMaterial(file) {
  const blob = immutableFile(file), hash = await digest(blob), type = blob.type.startsWith('image/') ? 'image' : 'file';
  const result = {type, blob, blobId: 'sha256:' + hash, captureHash: hash,
    name: type === 'image' ? 'Изображение из буфера' : file.name || 'Файл из буфера', fileName: file.name || '', mime: blob.type, w: 320, h: 220};
  if (blob.type === 'image/png' && blob.size >= 24) {
    const header = new DataView(await blob.slice(0, 24).arrayBuffer());
    if (header.getUint32(0) === 0x89504e47 && header.getUint32(12) === 0x49484452) {
      result.pixelWidth = header.getUint32(16); result.pixelHeight = header.getUint32(20);
      if (result.pixelWidth && result.pixelHeight) { const scale = Math.min(1, 480 / result.pixelWidth, 360 / result.pixelHeight); result.w = result.pixelWidth * scale; result.h = result.pixelHeight * scale; }
    }
  }
  return result;
}
async function notifyCommitted(item) {
  let timeout;
  try {
    await Promise.race([
      chrome.runtime.sendMessage({type: 'OSMINOG_CORE_CAPTURE_COMMITTED', id: item.id, deskId: item.deskId}).catch(() => {}),
      new Promise(resolve => { timeout = setTimeout(resolve, 5000); })
    ]);
  } catch {} finally { clearTimeout(timeout); }
}
async function commitPending() {
  const batch = retry;
  if (!batch) return;
  if (batch.kind === 'text') {
    const result = await OSMINOGCoreStore.capture({id: 'capture-' + batch.id, captureId: batch.id, deskId: batch.deskId,
      folderId: batch.folderId, capturedAt: batch.at, type: 'text', name: batch.text.slice(0, 60), text: batch.text});
    last = {kind: 'text', text: batch.text}; retry = null; await notifyCommitted(result.item); return;
  }
  while (batch.next < batch.files.length) {
    const index = batch.next, file = batch.files[index], material = await fileMaterial(file);
    const captureId = batch.id + '-' + index;
    const result = await OSMINOGCoreStore.capture({id: 'capture-' + captureId, captureId, deskId: batch.deskId,
      folderId: batch.folderId, capturedAt: batch.at, ...material});
    batch.saved.push({...fileDescriptor(file), assetId: result.item.assetId});
    batch.files[index] = null; // Only the current file's byte buffer exists in JS.
    batch.next = index + 1;
    await notifyCommitted(result.item);
  }
  last = {kind: 'files', files: batch.saved}; retry = null;
}
async function ingest(capture) {
  if (baseline) {
    baseline = false;
    last = capture.kind === 'text' ? {kind: 'text', text: capture.text} :
      {kind: 'files', files: capture.files.map(file => ({...fileDescriptor(file), blob: immutableFile(file)}))};
    return;
  }
  if (await unchanged(capture)) return;
  retry = {...capture, id: crypto.randomUUID(), deskId: config.projectId, folderId: config.folderId || null, at: Date.now(), next: 0, saved: []};
  await commitPending();
}
async function tick() {
  if (!migrated || !config.enabled || !config.projectId) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    if (retry) await commitPending();
    pasteTask = null; sink.replaceChildren(); sink.focus();
    const allowed = document.execCommand('paste');
    if (!pasteTask && !allowed) throw Error('Chrome не разрешил чтение буфера обмена. Перезапустите сбор.');
    const capture = pasteTask ? await pasteTask : null;
    if (capture) await ingest(capture); else baseline = false;
    await report(null);
  } catch (error) { if (baseline && error.retryable === false) baseline = false; await report(error); }
  finally { sink.replaceChildren(); busy = false; if (again) { again = false; queueMicrotask(tick); } }
}
function applyConfig(next) {
  const wasEnabled = config.enabled;
  config = next || {}; clearInterval(timer); timer = 0;
  if (!migrated || !config.enabled) { if (!retry) last = null; return; }
  if (!wasEnabled) { baseline = true; last = null; eventLeaseUntil = 0; }
  // The fallback works with the editor closed. A focused editor can optionally
  // provide a short event lease; correctness does not require that API.
  timer = setInterval(() => { if (retry || reportedError || Date.now() >= eventLeaseUntil) tick(); }, 1500);
  if (!wasEnabled) tick();
}
function bootstrap() {
  if (migrated) return {started: Promise.resolve({ok: true})};
  if (bootstrapTask) return bootstrapTask;
  let acknowledge;
  const started = new Promise(resolve => { acknowledge = resolve; });
  const done = (async () => {
    try {
      // The trigger is acknowledged only after the running state commits, so
      // a retry cannot immediately return the previous error to the editor.
      await OSMINOGCoreStore.init({migrate: true, onProgress(progress) {
        if (progress.status === 'running') acknowledge({ok: true});
      }});
      const response = await chrome.runtime.sendMessage({type: 'OSMINOG_CORE_MIGRATED'});
      if (!response?.ok) throw Error(response?.error || 'Не удалось подготовить сбор материалов');
      migrated = true; config = {}; applyConfig(response.config); acknowledge({ok: true});
    } catch (error) {
      acknowledge({ok: false, error: String(error.message || error)});
      await report(error);
    }
  })().finally(() => { bootstrapTask = null; });
  bootstrapTask = {started, done};
  return bootstrapTask;
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === 'OSMINOG_CORE_MIGRATE' && !sender.tab) { bootstrap().started.then(reply); return true; }
  if (message.type === 'OSMINOG_CORE_CAPTURE_CONFIG' && !sender.tab) { applyConfig(message.config); return; }
  if (message.type !== 'OSMINOG_CLIPBOARD_ACTIVITY' || sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('editor.html')) return;
  const wasPolling = Date.now() >= eventLeaseUntil;
  if (message.action === 'release') { eventLeaseUntil = 0; tick(); }
  else if (message.action === 'lease' || message.action === 'change') {
    eventLeaseUntil = Date.now() + 6000;
    if (wasPolling || message.action === 'change') tick();
  }
});
bootstrap();
