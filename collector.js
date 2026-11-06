'use strict';

// Offscreen documents cannot be focused. With clipboardRead, the paste command
// supplies the OS clipboard to this editable element without focusing a tab.
const sink = document.querySelector('#clipboard');
let again=false;
let busy = false, baseline = true, last = '', pasteTask = null, retry = null, rejected = null, reportedError = '';

function dataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || Error('Не удалось прочитать скриншот'));
    reader.readAsDataURL(file);
  });
}

async function readImage(file) {
  // Compare clipboard bytes before allocating a base64 string for a PNG we
  // already saved. Keep only its digest after acknowledgement.
  if (!file.arrayBuffer) return {kind: 'image', value: await dataURL(file)};
  const bytes = await file.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const signature = file.type + ':' + Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (baseline || signature === last || signature === rejected?.signature) return {kind: 'image', signature};
  return {kind: 'image', signature, value: await dataURL(file)};
}

sink.addEventListener('paste', event => {
  event.preventDefault();
  const data = event.clipboardData;
  let file = [...(data?.files || [])].find(file => /^image\//i.test(file.type));
  if (!file) {
    for (const item of data?.items || []) {
      if (item.kind === 'file' && /^image\//i.test(item.type)) {
        file = item.getAsFile();
        if (file) break;
      }
    }
  }
  const text = data?.getData('text/plain') || '';
  // Keep the actual File while the paste event is alive; reading its bytes and
  // delivering the capture must finish before another polling pass starts.
  pasteTask = file
    ? readImage(file)
    : Promise.resolve(text ? {kind: 'text', value: text} : null);
});

async function ingest(capture) {
  const signature = capture.signature || capture.kind + '\n' + capture.value;
  if (baseline) {
    baseline = false;
    last = signature;
    return;
  }
  if (signature === rejected?.signature) throw Error(rejected.error);
  if (signature === last) {rejected = null; return;}
  retry = capture;
  const result = await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CAPTURE', kind: capture.kind, value: capture.value});
  if (!result?.ok) {
    const error = result?.error || 'Сборщик не подтвердил сохранение. Повторяем попытку.';
    // Invalid data cannot succeed on retry. Keep its error visible while letting
    // the next clipboard value through; all transport/storage failures still retry.
    if (result?.retryable === false) {retry = null; rejected = {signature, error};}
    throw Error(error);
  }
  last = signature;
  retry = null;
  rejected = null;
}

async function report(error) {
  const message = error ? String(error.message || error) : '';
  if (message === reportedError) return;
  try {
    await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_ERROR', error: message});
    reportedError = message;
  } catch {}
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    // A transient storage/service-worker failure must not discard the already
    // read screenshot when the clipboard is changed before the next attempt.
    if (retry) await ingest(retry);
    pasteTask = null;
    sink.replaceChildren();
    sink.focus();
    const allowed = document.execCommand('paste');
    if (!pasteTask && !allowed) throw Error('Chrome не разрешил чтение буфера обмена. Перезапустите сбор.');
    const capture = pasteTask ? await pasteTask : null;
    if (capture) await ingest(capture);
    else baseline = false;
    if (!rejected) await report(null);
  } catch (error) {
    await report(error);
  } finally {
    sink.replaceChildren();
    busy = false;
    if(again){again=false;queueMicrotask(tick)}
  }
}

// A focused editor can receive clipboardchange. While it holds this short
// lease the offscreen page reads only on a change, a retry, or a focus handoff.
let eventLeaseUntil=0;
chrome.runtime.onMessage?.addListener((msg,sender)=>{
 if(msg?.type!=='OSMINOG_CLIPBOARD_ACTIVITY'||sender.id!==chrome.runtime.id)return;
 if(sender.url?.split(/[?#]/)[0]!==chrome.runtime.getURL('editor.html'))return;
 const now=Date.now(),wasPolling=now>=eventLeaseUntil;
 if(msg.action==='release'){eventLeaseUntil=0;tick();return}
 if(msg.action==='lease'||msg.action==='change'){
  eventLeaseUntil=now+6000;
  if(wasPolling||msg.action==='change'){if(busy)again=true;else tick()}
 }
});
tick();
setInterval(()=>{if(retry||reportedError||Date.now()>=eventLeaseUntil)return tick()},1500);
