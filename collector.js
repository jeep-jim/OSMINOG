'use strict';

// Clipboard bytes are read only here and committed directly to IndexedDB.
// Runtime messages contain configuration or committed IDs, never media bytes.
const sink = document.querySelector('#clipboard');
const MAX_FILE_BYTES = 32 * 1024 * 1024, MAX_BATCH_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 256, MAX_TEXT_CHARS = 4 * 1024 * 1024, COMPARE_CHUNK = 65536;
let config = {}, ready = false, busy = false, again = false, baseline = true;
let pasteTask = null, retry = null, last = null, ignored = null, reportedError = '', timer = 0, eventLeaseUntil = 0;

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
    if (descriptor.name !== old.name || descriptor.mime !== old.mime || descriptor.size !== old.size ||
        !await sameBytes(old.blob, immutableFile(file))) return false;
  }
  return true;
}
async function notifyCommitted(entry) {
  let timeout;
  try {
    await Promise.race([
      chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_COMMITTED', id: entry.id, projectId: entry.projectId, at: entry.at, hash: entry.hash, kind: entry.kind}).catch(() => {}),
      new Promise(resolve => { timeout = setTimeout(resolve, 5000); })
    ]);
  } catch {} finally { clearTimeout(timeout); }
}
async function commitPending() {
  const batch = retry;
  if (!batch) return;
  if (batch.kind === 'text') {
    batch.hash ||= await digest(new Blob([batch.text], {type: 'text/plain'}));
    if (ignored?.kind !== 'text' || ignored.hash !== batch.hash) {
      const result = await OSMINOGCaptureStore.put({id: batch.id, kind: 'text', value: batch.text, hash: batch.hash,
        projectId: batch.projectId, folderId: batch.folderId, at: batch.at, todayBase: config.todayBase});
      last = {kind: 'text', text: batch.text}; retry = null; ignored = null; await notifyCommitted(result.entry);
    } else { last = {kind: 'text', text: batch.text}; retry = null; ignored = null; }
    return;
  }
  while (batch.next < batch.files.length) {
    const index = batch.next, file = batch.files[index], blob = immutableFile(file);
    const hash = await digest(blob), kind = blob.type.startsWith('image/') ? 'image' : 'file';
    if (batch.files.length === 1 && ignored?.kind === kind && ignored.hash === hash) {
      last = {kind: 'files', files: [{...fileDescriptor(file), blob}]}; retry = null; ignored = null; return;
    }
    const result = await OSMINOGCaptureStore.put({id: batch.id + '-' + index, kind, blob, hash, fileName: file.name || '',
      projectId: batch.projectId, folderId: batch.folderId, at: batch.at, todayBase: config.todayBase});
    batch.saved.push({...fileDescriptor(file), blob});
    batch.files[index] = null; // Release the clipboard File before reading the next file.
    batch.next = index + 1;
    await notifyCommitted(result.entry);
  }
  last = {kind: 'files', files: batch.saved}; retry = null; ignored = null;
}
async function ingest(capture) {
  if (baseline) {
    baseline = false;
    last = capture.kind === 'text' ? {kind: 'text', text: capture.text} :
      {kind: 'files', files: capture.files.map(file => ({...fileDescriptor(file), blob: immutableFile(file)}))};
    return;
  }
  if (await unchanged(capture)) return;
  retry = {...capture, id: crypto.randomUUID(), projectId: config.projectId, folderId: config.folderId || null, at: Date.now(), next: 0, saved: []};
  await commitPending();
}
async function tick() {
  if (!ready || !config.enabled || !config.projectId) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    if (retry) await commitPending();
    if (!config.enabled || !config.projectId) return;
    pasteTask = null; sink.replaceChildren(); sink.focus();
    const allowed = document.execCommand('paste');
    if (!pasteTask && !allowed) throw Error('Chrome не разрешил чтение буфера обмена. Перезапустите сбор.');
    const capture = pasteTask ? await pasteTask : null;
    if (capture) await ingest(capture); else { baseline = false; last = null; }
    await report(null);
  } catch (error) { if (baseline && error.retryable === false) baseline = false; await report(error); }
  finally { sink.replaceChildren(); busy = false; if (again) { again = false; queueMicrotask(tick); } }
}
function applyConfig(next) {
  const wasEnabled = config.enabled;
  config = next || {}; clearInterval(timer); timer = 0;
  if (!ready || !config.enabled) { if (!retry) last = null; return; }
  if (!wasEnabled) { baseline = true; last = null; eventLeaseUntil = 0; reportedError = ''; }
  timer = setInterval(() => { if (retry || reportedError || Date.now() >= eventLeaseUntil) tick(); }, 1500);
  if (!wasEnabled) tick();
}
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === 'OSMINOG_COLLECTOR_CONFIG' && !sender.tab) { applyConfig(message.config); return; }
  if (message.type === 'OSMINOG_COLLECTOR_IGNORED' && !sender.tab) {
    ignored = {kind: message.kind, hash: message.hash}; return;
  }
  if (message.type !== 'OSMINOG_CLIPBOARD_ACTIVITY' || sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL('editor.html')) return;
  const wasPolling = Date.now() >= eventLeaseUntil;
  if (message.action === 'release') { eventLeaseUntil = 0; tick(); }
  else if (message.action === 'lease' || message.action === 'change') {
    eventLeaseUntil = Date.now() + 6000;
    if (wasPolling || message.action === 'change') tick();
  }
});
(async () => {
  try {
    const settings = await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_STATUS'});
    if (settings?.ok === false) throw Error(settings.error || 'Не удалось открыть настройки сбора');
    ready = true; applyConfig(settings);
  } catch (error) { await report(error); }
})();
