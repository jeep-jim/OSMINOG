'use strict';

// Offscreen documents cannot be focused. With clipboardRead, the paste command
// supplies the OS clipboard to this editable element without focusing a tab.
const sink = document.querySelector('#clipboard');
let busy = false, baseline = true, last = '', pasteTask = null, retry = null, rejected = null, reportedError = '';

function dataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || Error('Не удалось прочитать скриншот'));
    reader.readAsDataURL(file);
  });
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
    ? dataURL(file).then(value => ({kind: 'image', value}))
    : Promise.resolve(text ? {kind: 'text', value: text} : null);
});

async function ingest(capture) {
  const signature = capture.kind + '\n' + capture.value;
  if (baseline) {
    baseline = false;
    last = signature;
    return;
  }
  if (signature === rejected?.signature) throw Error(rejected.error);
  if (signature === last) {rejected = null; return;}
  retry = capture;
  const result = await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CAPTURE', ...capture});
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
  }
}

tick();
setInterval(tick, 1500);
