/* OSMINOG's small local store. Media bytes never enter chrome.storage or a
 * change notification. Legacy snapshots are read once, in the offscreen page,
 * and remain untouched so that migration can be retried or inspected. */
(() => {
  'use strict';
  if (globalThis.OSMINOGCoreStore) return;
  const DB_NAME = 'osminog-core-v1', DB_VERSION = 1;
  const TEXT_PREVIEW = 4096, SEARCH_PREVIEW = 1024, PAGE_LIMIT = 500;
  const PRIMARY = 'briefCraftStudioV2', BACKUP = 'briefCraftStudioV2Backup';
  const CHANGE_CHANNEL = 'osminog-core-changes';
  const stores = ['desks', 'items', 'blobs', 'search', 'meta'];
  let opening, migrating;
  const listeners = new Set();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANGE_CHANNEL) : null;
  if (channel) channel.onmessage = event => deliver(event.data);
  const uuid = () => crypto.randomUUID();
  const now = () => Date.now();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const dateKey = at => {
    const date = new Date(at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase();
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  function deliver(change) { for (const listener of listeners) { try { listener(change); } catch (error) { console.warn('OSMINOG store listener:', error.message); } } }
  function announce(change) { deliver(change); channel?.postMessage(change); }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  const request = value => new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error || Error('Не удалось прочитать локальное хранилище'));
  });
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const desks = db.createObjectStore('desks', {keyPath: 'id'});
        desks.createIndex('updatedAt', 'updatedAt');
        const items = db.createObjectStore('items', {keyPath: 'id'});
        items.createIndex('deskId', 'deskId');
        items.createIndex('updatedAt', ['updatedAt', 'id']);
        items.createIndex('deskUpdated', ['deskId', 'updatedAt', 'id']);
        items.createIndex('captureKey', 'captureKey', {unique: true});
        db.createObjectStore('blobs', {keyPath: 'id'});
        const search = db.createObjectStore('search', {keyPath: 'id'});
        search.createIndex('updatedAt', ['updatedAt', 'id']);
        search.createIndex('deskUpdated', ['deskId', 'updatedAt', 'id']);
        db.createObjectStore('meta');
      };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opening = null; }; resolve(req.result); };
      req.onerror = () => { opening = null; reject(req.error || Error('Не удалось открыть локальное хранилище')); };
      req.onblocked = () => { opening = null; reject(Error('Другая вкладка OSMINOG удерживает старое хранилище. Закройте её и повторите.')); };
    });
    return opening;
  }
  async function transaction(names, mode, work, signal) {
    if (signal?.aborted) throw signal.reason || new DOMException('Поиск отменён', 'AbortError');
    const db = await open(), tx = db.transaction(names, mode);
    const abort = () => { try { tx.abort(); } catch {} };
    signal?.addEventListener('abort', abort, {once: true});
    const completed = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(signal?.aborted ? signal.reason || new DOMException('Поиск отменён', 'AbortError') : tx.error || Error('Локальная запись отменена'));
    });
    // Attach a rejection handler before awaiting individual requests.
    completed.catch(() => {});
    try { const result = await work(tx); await completed; return result; }
    catch (error) { try { tx.abort(); } catch {} await completed.catch(() => {}); throw signal?.aborted ? signal.reason || new DOMException('Поиск отменён', 'AbortError') : error; }
    finally { signal?.removeEventListener('abort', abort); }
  }
  const read = (store, key) => transaction([store], 'readonly', tx => request(tx.objectStore(store).get(key)));
  const writeMeta = (key, value) => transaction(['meta'], 'readwrite', tx => request(tx.objectStore('meta').put(value, key)));
  async function stageLegacy(values) {
    const keys = Object.keys(values);
    // A fixed slot per source cannot accumulate abandoned copies after a crash.
    // Unlike runtime JSON messages, IndexedDB can persist a large structured
    // value without serializing the whole old workspace to a message string.
    for (const key of keys) {
      await writeMeta('legacy-transfer:' + key, values[key]);
      values[key] = null;
    }
    return keys;
  }
  async function consumeLegacy(keys) {
    return transaction(['meta'], 'readwrite', async tx => {
      const meta = tx.objectStore('meta'), values = {};
      for (const key of keys) {
        const slot = 'legacy-transfer:' + key;
        values[key] = await request(meta.get(slot)); await request(meta.delete(slot));
      }
      return values;
    });
  }
  async function sha256(blob) {
    const bytes = await blob.arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function blobRecord(blob, options = {}) {
    if (!(blob instanceof Blob)) throw Error('Материал должен быть Blob или File');
    const immutable = new Blob([blob], {type: options.mime || blob.type || 'application/octet-stream'});
    const id = options.id || 'sha256:' + await sha256(immutable);
    return {id, blob: immutable, mime: immutable.type, size: immutable.size};
  }
  async function putBlob(blob, options = {}) {
    const record = await blobRecord(blob, options);
    await transaction(['blobs'], 'readwrite', tx => request(tx.objectStore('blobs').put(record)));
    return record.id;
  }
  async function getBlob(id) { return (await read('blobs', id))?.blob || null; }
  function dataURLBlob(value) {
    const split = value.indexOf(',');
    if (!value.startsWith('data:') || split < 0) throw Error('Повреждён встроенный файл');
    const header = value.slice(5, split), mime = header.split(';')[0] || 'application/octet-stream';
    if (!/;base64(?:;|$)/i.test(header)) return new Blob([decodeURIComponent(value.slice(split + 1))], {type: mime});
    const encoded = value.slice(split + 1), chunks = [], step = 65536;
    for (let offset = 0; offset < encoded.length; offset += step) {
      const binary = atob(encoded.slice(offset, offset + step));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      chunks.push(bytes);
    }
    return new Blob(chunks, {type: mime});
  }
  function deskRecord(input, previous = {}) {
    const result = {...previous};
    for (const key of ['name', 'description', 'view', 'sharing', 'folders', 'desktops', 'activeDesktop', 'connections', 'chatProjectId', 'canvas', 'deletedAt', 'sourceId', 'detailBlobId']) {
      if (Object.hasOwn(input, key)) result[key] = input[key];
    }
    result.id = String(input.id || previous.id || uuid());
    result.name = String(result.name || 'Без названия');
    result.createdAt = finite(input.createdAt ?? previous.createdAt, now());
    result.updatedAt = finite(input.updatedAt, now());
    result.folders = Array.isArray(result.folders) ? result.folders : [];
    result.desktops = Array.isArray(result.desktops) ? result.desktops : [];
    return result;
  }
  async function saveDesk(input = {}) {
    const id = String(input.id || uuid());
    const result = await transaction(['desks', 'meta'], 'readwrite', async tx => {
      const store = tx.objectStore('desks'), previous = await request(store.get(id));
      const next = deskRecord({...input, id}, previous); await request(store.put(next));
      const meta = tx.objectStore('meta'), count = finite(await request(meta.get('desk-count')));
      await request(meta.put(count + (!next.deletedAt ? 1 : 0) - (previous && !previous.deletedAt ? 1 : 0), 'desk-count'));
      return next;
    });
    announce({type: 'desks', ids: [result.id]}); return result;
  }
  const getDesk = id => read('desks', String(id));
  async function desks({includeDeleted = false} = {}) {
    return (await transaction(['desks'], 'readonly', tx => request(tx.objectStore('desks').getAll())))
      .filter(desk => includeDeleted || !desk.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const itemFields = ['id', 'deskId', 'type', 'name', 'title', 'fileName', 'mime', 'size', 'x', 'y', 'w', 'h', 'rotation',
    'folderId', 'desktopId', 'createdAt', 'updatedAt', 'capturedAt', 'captureId', 'captureHash', 'sourceId', 'sourceDeskId',
    'assetId', 'text', 'textBlobId', 'url', 'detailBlobId', 'deletedAt', 'legacySource', 'legacyPositionAt', 'legacyPositionOrder', 'pixelWidth', 'pixelHeight'];
  async function prepareItem(input) {
    const fields = Object.fromEntries(itemFields.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
    const blobs = [];
    if (input.blob instanceof Blob) {
      const asset = await blobRecord(input.blob, {id: input.blobId, mime: input.mime});
      blobs.push(asset); Object.assign(fields, {assetId: asset.id, size: asset.size, mime: asset.mime});
    }
    let fullText;
    if (Object.hasOwn(input, 'text')) {
      fullText = String(input.text ?? '');
      if (fullText.length > TEXT_PREVIEW) {
        const text = await blobRecord(new Blob([fullText], {type: 'text/plain;charset=utf-8'}));
        blobs.push(text); fields.textBlobId = text.id; fields.text = fullText.slice(0, TEXT_PREVIEW);
      } else { fields.text = fullText; fields.textBlobId = null; }
    }
    return {fields, blobs, fullText, searchText: Object.hasOwn(input, 'searchText') ? String(input.searchText || '') : undefined};
  }
  function indexText(item, content) {
    return normalize([item.name, item.title, item.fileName, item.url, content].filter(value => typeof value === 'string').join('\n'));
  }
  async function updateCounts(tx, previous, item) {
    const meta = tx.objectStore('meta'), count = await request(meta.get('counts')) || {items: 0, captures: 0, today: {day: dateKey(now()), count: 0}};
    const before = previous && !previous.deletedAt ? 1 : 0, after = item && !item.deletedAt ? 1 : 0;
    count.items += after - before;
    if (!previous && item?.captureId) {
      count.captures++;
      const day = dateKey(now());
      if (count.today?.day !== day) count.today = {day, count: 0};
      if (dateKey(item.capturedAt || item.createdAt) === day) count.today.count++;
    }
    await request(meta.put(count, 'counts'));
  }
  async function putItem(input = {}) {
    const id = String(input.id || uuid()), prepared = await prepareItem({...input, id});
    const result = await transaction(stores, 'readwrite', async tx => {
      const items = tx.objectStore('items'), previous = await request(items.get(id));
      if (input.__captureInsertOnly && previous) return previous;
      const item = {...previous, ...prepared.fields, id};
      item.deskId = String(item.deskId || '');
      if (!item.deskId || !await request(tx.objectStore('desks').get(item.deskId))) throw Error('Стол для материала не найден');
      item.type = String(item.type || 'text'); item.name = String(item.name || item.title || item.fileName || 'Материал');
      item.createdAt = finite(item.createdAt, now()); item.updatedAt = finite(input.updatedAt, now());
      item.x = finite(item.x); item.y = finite(item.y); item.w = Math.max(40, finite(item.w, 320)); item.h = Math.max(40, finite(item.h, 220));
      item.folderId = item.folderId ? String(item.folderId) : null; item.desktopId = String(item.desktopId || 'main');
      item.rev = (previous?.rev || 0) + 1;
      if (item.captureId) item.captureKey = item.deskId + '\n' + item.captureId;
      else delete item.captureKey;
      const needsIndex = !previous || ['text', 'searchText', 'name', 'title', 'fileName', 'url', 'deskId', 'deletedAt'].some(key => Object.hasOwn(input, key));
      let content;
      if (needsIndex && !item.deletedAt) {
        const oldIndex = prepared.searchText === undefined && prepared.fullText === undefined ? await request(tx.objectStore('search').get(id)) : null;
        content = prepared.searchText ?? prepared.fullText ?? oldIndex?.content ?? item.text ?? '';
        item.searchText = String(content).slice(0, SEARCH_PREVIEW);
      }
      if (!previous && item.captureId && !Object.hasOwn(input, 'x') && !Object.hasOwn(input, 'y')) {
        const positionKey = 'capture-position:' + item.deskId + ':' + (item.folderId || '');
        const ordinal = finite(await request(tx.objectStore('meta').get(positionKey)));
        item.x = (ordinal % 8) * 360; item.y = Math.floor(ordinal / 8) * 260;
        await request(tx.objectStore('meta').put(ordinal + 1, positionKey));
      }
      for (const blob of prepared.blobs) await request(tx.objectStore('blobs').put(blob));
      await request(items.put(item));
      if (item.deletedAt) await request(tx.objectStore('search').delete(id));
      else if (needsIndex) await request(tx.objectStore('search').put({id, deskId: item.deskId, updatedAt: item.updatedAt, text: indexText(item, content), content}));
      await updateCounts(tx, previous, item);
      return item;
    });
    announce({type: 'items', ids: [result.id], deskId: result.deskId}); return result;
  }
  async function patchItem(id, patch) {
    if (!await read('items', String(id))) throw Error('Материал не найден');
    return putItem({...patch, id: String(id)});
  }
  const deleteItem = id => patchItem(id, {deletedAt: now()});
  async function getItem(id) {
    const item = await read('items', String(id));
    if (!item) return null;
    if (item.textBlobId) { const blob = await getBlob(item.textBlobId); if (!blob) throw Error('Не найден текст материала'); item.text = await blob.text(); }
    return item;
  }
  function rangeFor(deskId) { return deskId ? IDBKeyRange.bound([String(deskId), 0, ''], [String(deskId), Number.MAX_SAFE_INTEGER, '\uffff']) : null; }
  function limits(options = {}) { return {offset: Math.max(0, Math.floor(finite(options.offset))), limit: Math.min(PAGE_LIMIT, Math.max(1, Math.floor(finite(options.limit, 100))))}; }
  async function listItems(deskId, options = {}) {
    const {offset, limit} = limits(options);
    let deletedDesks = new Set();
    if (!options.includeDeleted) {
      if (deskId && (await getDesk(deskId))?.deletedAt) return [];
      if (!deskId) deletedDesks = new Set((await desks({includeDeleted: true})).filter(desk => desk.deletedAt).map(desk => desk.id));
    }
    return transaction(['items'], 'readonly', tx => new Promise((resolve, reject) => {
      const store = tx.objectStore('items'), index = store.index(deskId ? 'deskUpdated' : 'updatedAt');
      const found = []; let skipped = 0, advanced = false;
      const fastOffset = options.includeDeleted && !Object.hasOwn(options, 'folderId') && !Object.hasOwn(options, 'desktopId');
      const req = index.openCursor(rangeFor(deskId), 'prev');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(found);
        if (fastOffset && offset && !advanced) { advanced = true; skipped = offset; cursor.advance(offset); return; }
        const item = cursor.value;
        const visible = (options.includeDeleted || !item.deletedAt) && !deletedDesks.has(item.deskId) &&
          (!Object.hasOwn(options, 'folderId') || (item.folderId || null) === (options.folderId || null)) &&
          (!Object.hasOwn(options, 'desktopId') || item.desktopId === options.desktopId);
        if (visible && skipped++ >= offset) found.push(item);
        if (found.length >= limit) resolve(found); else cursor.continue();
      };
    }), options.signal);
  }
  async function search(query, options = {}) {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean), {offset, limit} = limits(options);
    if (!words.length) return listItems(options.deskId, options);
    return transaction(['search', 'items', 'desks'], 'readonly', tx => new Promise((resolve, reject) => {
      const store = tx.objectStore('search'), index = store.index(options.deskId ? 'deskUpdated' : 'updatedAt');
      const found = []; let skipped = 0;
      const req = index.openCursor(rangeFor(options.deskId), 'prev');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(found);
        if (!words.every(word => cursor.value.text.includes(word))) return cursor.continue();
        const itemReq = tx.objectStore('items').get(cursor.value.id);
        itemReq.onerror = () => reject(itemReq.error);
        itemReq.onsuccess = () => {
          const item = itemReq.result;
          const deskReq = tx.objectStore('desks').get(item?.deskId || '');
          deskReq.onerror = () => reject(deskReq.error);
          deskReq.onsuccess = () => {
            if (item && !item.deletedAt && !deskReq.result?.deletedAt && skipped++ >= offset) found.push(item);
            if (found.length >= limit) resolve(found); else cursor.continue();
          };
        };
      };
    }), options.signal);
  }
  async function stats() {
    const [counts, migration, deskCount] = await Promise.all([read('meta', 'counts'), read('meta', 'migration'), read('meta', 'desk-count')]);
    return {desks: deskCount || 0, items: counts?.items || 0, captures: counts?.captures || 0,
      today: counts?.today?.day === dateKey(now()) ? counts.today.count : 0,
      migration: migration || {status: 'pending', stage: 'waiting', projects: 0, items: 0}};
  }
  async function capture(input) {
    // One durable transaction contains both binary and metadata. Retrying the
    // same capture id cannot create another material after a lost notification.
    const id = String(input.id || ('capture-' + (input.captureId || uuid())));
    const existing = await read('items', id);
    if (existing) return {ok: true, duplicate: true, item: existing};
    const item = await putItem({...input, id, __captureInsertOnly: true, capturedAt: input.capturedAt || now(), captureId: input.captureId || id.replace(/^capture-/, '')});
    return {ok: true, item};
  }
  async function defaultLegacyReader(keys) {
    if (globalThis.chrome?.storage?.local) return chrome.storage.local.get(keys);
    const response = await chrome.runtime.sendMessage({type: 'OSMINOG_CORE_LEGACY_READ', keys});
    if (!response?.ok) throw Error(response?.error || 'Не удалось прочитать прежние материалы');
    if (!Array.isArray(response.staged) || response.staged.some(key => !keys.includes(key))) throw Error('Неверный ответ переноса материалов');
    return consumeLegacy(keys);
  }
  async function defaultLegacyKeys() {
    if (globalThis.chrome?.storage?.local?.getKeys) return chrome.storage.local.getKeys();
    const response = await chrome.runtime.sendMessage({type: 'OSMINOG_CORE_LEGACY_KEYS'});
    if (!response?.ok) throw Error(response?.error || 'Не удалось прочитать список прежних материалов');
    return response.keys;
  }
  function validWorkspace(value) {
    return !!value && typeof value === 'object' && Array.isArray(value.projects) &&
      value.projects.every(project => project && typeof project === 'object' && typeof project.id === 'string' && project.id &&
        (project.objects === undefined || Array.isArray(project.objects)));
  }
  async function legacyId(deskId, sourceId) {
    const id = String(sourceId || uuid()), current = await read('items', id);
    return !current || current.deskId === deskId ? id : id + '@' + encodeURIComponent(deskId);
  }
  async function archive(value, id) { return putBlob(new Blob([JSON.stringify(value)], {type: 'application/json'}), {id}); }
  async function importObject(deskId, source, migrationKey) {
    const id = await legacyId(deskId, source.id || 'capture-' + source.captureId);
    if (await read('items', id)) return false;
    if (source.captureId && await transaction(['items'], 'readonly', tx => request(tx.objectStore('items').index('captureKey').get(deskId + '\n' + source.captureId)))) return false;
    let blob = null, remote = '';
    if (typeof source.src === 'string' && source.src.startsWith('data:')) blob = dataURLBlob(source.src);
    else if (typeof source.src === 'string') remote = source.src;
    const text = typeof source.text === 'string' ? source.text : typeof source.code === 'string' ? source.code : '';
    const detail = {...source}; delete detail.src; delete detail.text; delete detail.searchIndex;
    const detailBlobId = await archive(detail, 'legacy-detail:' + id);
    await putItem({id, deskId, sourceId: source.id || id, legacySource: migrationKey,
      type: source.type === 'image' ? 'image' : source.type === 'file' ? 'file' : ['brief', 'text', 'note', 'node'].includes(source.type) ? 'text' : source.type || 'text',
      name: source.name || source.fileName || source.title || 'Материал', title: source.title || '', text,
      searchText: [text, source.code, source.url, source.searchIndex?.text].filter(value => typeof value === 'string').join('\n'),
      fileName: source.fileName || '', mime: source.mime || blob?.type || '', size: source.size || blob?.size || 0,
      ...(blob ? {blob} : {}), ...(remote ? {url: remote} : source.url ? {url: source.url} : {}), detailBlobId,
      x: source.x, y: source.y, w: source.w, h: source.h, rotation: source.rotation,
      folderId: source.osminogFolderId || source.folderId || null, desktopId: source.osminogDesktopId || source.desktopId || 'main',
      createdAt: source.createdAt || source.created || source.capturedAt || 0, updatedAt: source.updated || source.updatedAt || source.createdAt || 0,
      captureId: source.captureId, captureHash: source.captureHash, capturedAt: source.capturedAt, deletedAt: source.deletedAt || null});
    return true;
  }
  async function migrateLegacy(options = {}) {
    const readLegacy = options.legacyReader || defaultLegacyReader, keysLegacy = options.legacyKeys || defaultLegacyKeys;
    let progress = await read('meta', 'migration');
    if (progress?.status === 'done') return progress;
    progress = {...progress, status: 'running', stage: 'workspace', projects: progress?.projects || 0, items: progress?.items || 0, startedAt: progress?.startedAt || now(), error: ''};
    const publish = async stage => {
      progress.stage = stage; progress.updatedAt = now();
      await writeMeta('migration', {...progress}); options.onProgress?.({...progress}); announce({type: 'migration', migration: {...progress}});
    };
    let trash = {};
    const ensureLegacyDesk = async (raw, deleted = false) => {
      const id = String(raw.id || uuid());
      if (!await getDesk(id)) {
        const detail = {...raw}; delete detail.objects;
        const detailBlobId = await archive(detail, 'legacy-desk:' + id);
        const folders = Array.isArray(raw.osminogFolders) ? raw.osminogFolders : [];
        await saveDesk({id, name: raw.name || 'Восстановленные материалы', sourceId: id, detailBlobId,
          createdAt: raw.created || raw.createdAt || 0, updatedAt: raw.updated || raw.updatedAt || 0,
          view: raw.view, sharing: raw.sharing, canvas: raw.canvas, folders, desktops: raw.desktops || raw.osminogDesktops || [], activeDesktop: raw.activeDesktop || 'main', chatProjectId: raw.id,
          connections: Array.isArray(raw.connections) ? raw.connections.map(link => Object.fromEntries(['id', 'from', 'to', 'fromPort', 'toPort', 'style', 'color', 'width', 'label', 'dashed', 'arrow'].filter(key => Object.hasOwn(link, key)).map(key => [key, link[key]]))) : [],
          ...(deleted || trash[id] ? {deletedAt: finite(trash[id]?.at, now()) || now()} : {})});
      }
      for (const token of Object.keys(raw.savedItemEdits || {})) await writeMeta('legacy-applied:' + token, true);
      return id;
    };
    const importDesk = async (raw, deleted) => {
      if (!raw || typeof raw !== 'object' || !raw.id) return;
      const id = await ensureLegacyDesk(raw, deleted), list = Array.isArray(raw.objects) ? raw.objects : [];
      const memberships = new Map();
      for (const folder of raw.osminogFolders || []) for (const member of folder.members || []) if (!memberships.has(member)) memberships.set(member, folder.id);
      for (let i = 0; i < list.length; i++) {
        const object = list[i];
        if (object && typeof object === 'object') {
          if (!object.osminogFolderId && memberships.has(object.id)) object.osminogFolderId = memberships.get(object.id);
          if (!object.id) object.id = id + ':legacy-' + i;
          if (await importObject(id, object, 'workspace:' + id)) progress.items++;
        }
        list[i] = null; // Release the old inline source after its Blob committed.
        if (i % 4 === 0) { await publish('workspace'); await tick(); }
      }
      raw.objects = null; progress.projects++; await publish('workspace');
    };
    try {
      await publish('workspace');
      trash = (await readLegacy(['osminogTrashIndex'])).osminogTrashIndex || {};
      await writeMeta('legacy-trash-index', trash);
      let workspace = (await readLegacy([PRIMARY]))[PRIMARY];
      const hadPrimary = workspace !== undefined && workspace !== null;
      if (!validWorkspace(workspace)) {
        workspace = (await readLegacy([BACKUP]))[BACKUP]; progress.source = BACKUP;
        if (!validWorkspace(workspace) && (hadPrimary || workspace !== undefined && workspace !== null)) throw Error('Прежнее хранилище и резервная копия повреждены. Исходные данные сохранены без изменений.');
      }
      else progress.source = PRIMARY;
      if (validWorkspace(workspace)) {
        for (let i = 0; i < workspace.projects.length; i++) { await importDesk(workspace.projects[i], false); workspace.projects[i] = null; }
        await writeMeta('legacy-workspace', {activeProject: workspace.activeProject, theme: workspace.theme, language: workspace.language});
      }
      workspace = null;
      const keys = (await keysLegacy()).filter(key => /^(osminogItemEdit:|osminogCapture:|osminogTrashProject:)/.test(key));
      await publish('trash');
      for (const key of keys.filter(key => key.startsWith('osminogTrashProject:'))) {
        const raw = (await readLegacy([key]))[key]; if (raw) await importDesk(raw, true); await tick();
      }
      await publish('edits');
      const positionEdits = [];
      for (const key of keys.filter(key => key.startsWith('osminogItemEdit:'))) {
        const edit = (await readLegacy([key]))[key];
        if (!edit || !edit.token || !edit.projectId || await read('meta', 'legacy-applied:' + edit.token)) continue;
        const deskId = await ensureLegacyDesk({id: edit.projectId});
        if (edit.kind === 'capture' && edit.object) {
          if (await importObject(deskId, edit.object, key)) progress.items++;
          await writeMeta('legacy-applied:' + edit.token, true);
        } else positionEdits.push({...edit, deskId});
        await publish('edits'); await tick();
      }
      for (const edit of positionEdits.sort((a, b) => finite(a.at) - finite(b.at) || finite(a.order) - finite(b.order))) {
        const deskId = edit.deskId;
        if (edit.kind === 'objectPosition') {
          const id = await legacyId(deskId, edit.objectId), item = await read('items', id);
          if (item && (finite(edit.at) > finite(item.legacyPositionAt) || finite(edit.at) === finite(item.legacyPositionAt) && finite(edit.order) > finite(item.legacyPositionOrder))) {
            await patchItem(id, {...edit.position, legacyPositionAt: finite(edit.at), legacyPositionOrder: finite(edit.order), updatedAt: Math.max(item.updatedAt, finite(edit.at))});
          }
        } else if (edit.folderId) {
          const desk = await getDesk(deskId), folder = desk.folders.find(folder => folder.id === edit.folderId);
          if (folder && (finite(edit.at) > finite(folder.legacyPositionAt) || finite(edit.at) === finite(folder.legacyPositionAt) && finite(edit.order) > finite(folder.legacyPositionOrder))) {
            Object.assign(folder, edit.position, {legacyPositionAt: finite(edit.at), legacyPositionOrder: finite(edit.order)});
            await saveDesk(desk);
          }
        }
        await writeMeta('legacy-applied:' + edit.token, true); await publish('edits'); await tick();
      }
      await publish('captures');
      for (const key of keys.filter(key => key.startsWith('osminogCapture:'))) {
        const entry = (await readLegacy([key]))[key];
        if (!entry?.id || !entry.projectId || typeof entry.value !== 'string') continue;
        const deskId = await ensureLegacyDesk({id: entry.projectId});
        const source = {id: 'capture-' + entry.id, captureId: entry.id, captureHash: entry.hash, capturedAt: entry.at, createdAt: entry.at,
          type: entry.kind === 'image' ? 'image' : 'brief', name: entry.kind === 'image' ? 'Снимок экрана' : entry.value.slice(0, 60),
          ...(entry.kind === 'image' ? {src: entry.value} : {text: entry.value}), osminogFolderId: entry.folderId || null};
        if (await importObject(deskId, source, key)) progress.items++;
        await publish('captures'); await tick();
      }
      if (!(await desks()).length) await saveDesk({id: await getDesk('inbox') ? 'inbox-' + uuid() : 'inbox', name: 'Входящие', view: {x: 0, y: 0, scale: 1}});
      progress.status = 'done'; progress.finishedAt = now(); await publish('done'); return {...progress};
    } catch (error) {
      progress.status = 'error'; progress.error = String(error.message || error).slice(0, 240); await publish(progress.stage); throw error;
    }
  }
  async function init(options = {}) {
    await open();
    if (!options.migrate) return stats();
    if (!migrating) {
      const run = () => migrateLegacy(options);
      migrating = (navigator.locks?.request ? navigator.locks.request('osminog-core-migration-v1', run) : run()).finally(() => { migrating = null; });
    }
    return migrating;
  }
  globalThis.OSMINOGCoreStore = {init, ready: () => init(), desks, saveDesk, getDesk, listItems, getItem, getMetadata: id => read('items', String(id)), putItem, patchItem, deleteItem,
    getBlob, putBlob, search, stats, capture, subscribe, getMeta: key => read('meta', key), stageLegacy,
    __test: {DB_NAME, DB_VERSION, dataURLBlob, validWorkspace, migrateLegacy, TEXT_PREVIEW}};
})();
