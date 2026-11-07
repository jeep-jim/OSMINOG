/* Durable clipboard queue. Only one requested body is expanded for the full
 * editor; polling, notifications and queue listings contain small metadata. */
(() => {
  'use strict';
  const DB_NAME = 'osminog-capture-queue-v2', CHANNEL = 'osminog-capture-queue-v2';
  const MAX_FILE_BYTES = 32 * 1024 * 1024, MAX_TEXT_CHARS = 4 * 1024 * 1024;
  const listeners = new Set();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  let opening;
  function deliver(change) { for (const listener of listeners) { try { listener(change); } catch (error) { console.warn(error); } } }
  if (channel) channel.onmessage = event => deliver(event.data);
  const announce = change => { deliver(change); channel?.postMessage(change); };
  const request = req => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || Error('Не удалось прочитать очередь буфера'));
  });
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const entries = req.result.createObjectStore('entries', {keyPath: 'id'});
        entries.createIndex('at', ['at', 'id']);
        req.result.createObjectStore('bodies');
        req.result.createObjectStore('meta');
      };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opening = null; }; resolve(req.result); };
      req.onerror = () => { opening = null; reject(req.error); };
    });
    return opening;
  }
  async function transaction(names, mode, work) {
    const tx = (await open()).transaction(names, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || Error('Материал из буфера не сохранён'));
    });
    done.catch(() => {});
    try { const result = await work(tx); await done; return result; }
    catch (error) { try { tx.abort(); } catch {} await done.catch(() => {}); throw error; }
  }
  const day = at => new Date(at).toLocaleDateString('en-CA');
  async function hash(blob) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function invalid(message) { const error = Error(message); error.retryable = false; return error; }
  function fromDataURL(value) {
    const split = value.indexOf(',');
    if (split < 0 || !/^data:/i.test(value)) throw invalid('Повреждён файл в буфере');
    const header = value.slice(5, split), mime = header.split(';')[0] || 'application/octet-stream';
    if (!/;base64$/i.test(header)) return new Blob([decodeURIComponent(value.slice(split + 1))], {type: mime});
    const parts = [], encoded = value.slice(split + 1);
    for (let start = 0; start < encoded.length; start += 65536) {
      const text = atob(encoded.slice(start, start + 65536)), bytes = new Uint8Array(text.length);
      for (let i = 0; i < bytes.length; i++) bytes[i] = text.charCodeAt(i);
      parts.push(bytes);
    }
    return new Blob(parts, {type: mime});
  }
  function toDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || Error('Не удалось открыть файл из буфера'));
      reader.readAsDataURL(blob);
    });
  }
  async function put(input) {
    const kind = input.kind;
    if (!['text', 'image', 'file'].includes(kind)) throw invalid('Неподдерживаемый материал в буфере');
    if (typeof input.projectId !== 'string' || !input.projectId) throw invalid('Не выбран стол для сохранения');
    const id = String(input.id || crypto.randomUUID()), at = Number(input.at) || Date.now();
    let body;
    if (kind === 'text') {
      const value = String(input.value ?? input.text ?? '');
      if (!value || value.length > MAX_TEXT_CHARS) throw invalid('Текст из буфера пуст или больше 4 млн символов');
      body = {value};
    } else {
      if (!(input.blob instanceof Blob) || input.blob.size > MAX_FILE_BYTES) throw invalid('Файл из буфера больше 32 МБ или недоступен');
      body = {blob: new Blob([input.blob], {type: input.mime || input.blob.type || 'application/octet-stream'})};
    }
    const entry = {id, at, kind, projectId: input.projectId, folderId: input.folderId || null,
      hash: input.hash || await hash(body.blob || new Blob([body.value], {type: 'text/plain'})),
      fileName: String(input.fileName || ''), mime: body.blob?.type || 'text/plain', size: body.blob?.size || body.value.length};
    const result = await transaction(['entries', 'bodies', 'meta'], 'readwrite', async tx => {
      const entries = tx.objectStore('entries'), previous = await request(entries.get(id));
      if (previous) return {ok: true, duplicate: true, entry: previous};
      await request(tx.objectStore('bodies').put(body, id));
      await request(entries.put(entry));
      const meta = tx.objectStore('meta'), key = 'today:' + day(at), counter = await request(meta.get(key));
      const base = input.todayBase?.day === day(at) ? Math.max(0, Number(input.todayBase.count) || 0) : 0;
      await request(meta.put({day: day(at), count: (counter?.count ?? base) + 1}, key));
      return {ok: true, entry};
    });
    if (!result.duplicate) announce({type: 'added', id: entry.id, projectId: entry.projectId});
    return result;
  }
  async function list({limit = 32, after = null} = {}) {
    const bound = after ? IDBKeyRange.lowerBound([after.at, after.id], true) : null;
    return transaction(['entries'], 'readonly', tx => request(tx.objectStore('entries').index('at').getAll(bound, Math.max(1, Math.min(128, Number(limit) || 32)))));
  }
  async function read(id, {binary = false} = {}) {
    const entry = await transaction(['entries', 'bodies'], 'readonly', async tx => {
      const meta = await request(tx.objectStore('entries').get(String(id)));
      if (!meta) return null;
      const body = await request(tx.objectStore('bodies').get(String(id)));
      if (!body) throw Error('Не найдено содержимое сохранённого материала');
      return {...meta, ...body};
    });
    if (!entry) return null;
    if (entry.blob && !binary) { entry.value = await toDataURL(entry.blob); delete entry.blob; }
    return entry;
  }
  async function ack(id) {
    await transaction(['entries', 'bodies'], 'readwrite', async tx => {
      await request(tx.objectStore('entries').delete(String(id)));
      await request(tx.objectStore('bodies').delete(String(id)));
    });
    announce({type: 'removed', id: String(id)});
  }
  const getMetadata = id => transaction(['entries'], 'readonly', tx => request(tx.objectStore('entries').get(String(id))));
  const count = () => transaction(['entries'], 'readonly', tx => request(tx.objectStore('entries').count()));
  const today = at => transaction(['meta'], 'readonly', tx => request(tx.objectStore('meta').get('today:' + day(at || Date.now()))));
  globalThis.OSMINOGCaptureStore = {put, list, read, ack, getMetadata, count, today, hash, fromDataURL,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    __test: {DB_NAME, MAX_FILE_BYTES, MAX_TEXT_CHARS}};
})();
