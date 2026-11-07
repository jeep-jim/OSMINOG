/* Legacy attachments are hydrated only in this worker. The editor exchanges
 * small staging tickets; original arrays remain untouched in chrome.storage. */
'use strict';
importScripts('osminog-core-store.js', 'osminog-core-chat.js');

let job = null;
const pending = new Map();
const history = OSMINOGCoreChat.createHistory({storage: {get(keys) {
  if (!job) return Promise.reject(Error('Не задан источник истории'));
  const token = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(token, {keys, resolve, reject});
    self.postMessage({type: 'stage', id: job.id, token, keys});
  });
}}});

self.onmessage = async ({data}) => {
  if (data?.type === 'staged') {
    if (!job || data.id !== job.id) return;
    const request = pending.get(data.token); if (!request) return; pending.delete(data.token);
    try {
      const response = data.response;
      if (!response?.ok || !response.transferId) throw Error(response?.error || 'Не удалось подготовить сохранённую историю');
      if (!Array.isArray(response.staged) || response.staged.length !== request.keys.length || response.staged.some((key, index) => key !== request.keys[index]))
        throw Error('Список подготовленной истории не совпадает с запросом');
      request.resolve(await OSMINOGCoreStore.consumeLegacy(request.keys, {transferId: response.transferId}));
    } catch (error) { request.reject(error); }
    return;
  }
  if (data?.type !== 'ensure' || job) return;
  job = {id: data.id, scope: String(data.scope || ''), thread: String(data.thread || '')};
  try {
    if (!job.scope || !job.thread) throw Error('Не указан стол или диалог');
    if (!navigator.locks?.request) throw Error('Браузер не поддерживает безопасный перенос истории');
    const meta = await history.ensure(job.scope, job.thread);
    self.postMessage({type: 'complete', id: job.id, meta});
  } catch (error) { self.postMessage({type: 'error', id: job.id, error: String(error.message || error).slice(0, 400)}); }
};
