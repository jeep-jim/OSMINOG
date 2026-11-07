/* One-time return from 4.0.38's small store to the complete workspace.
 * Source Core databases are read-only. Every overwritten legacy value has a
 * durable original in a separate database; interrupted work can be replayed. */
(() => {
  'use strict';
  const DB_NAME = 'osminog-restore-439-v1', CORE_DB = 'osminog-core-v1', CHAT_DB = 'osminog-core-chat-v1';
  const PRIMARY = 'briefCraftStudioV2', BACKUP = 'briefCraftStudioV2Backup';
  const MARK = 'osminogRestore438', LOCK = 'osminog-restore-438-to-439';
  const local = () => chrome.storage.local;
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const request = req => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || Error('Не удалось прочитать сохранённые материалы'));
  });
  let opening, running, prepared, guardsRunId;
  const guards = new Map();
  async function existing(name) {
    if (indexedDB.databases && !(await indexedDB.databases()).some(db => db.name === name)) return null;
    return new Promise((resolve, reject) => {
      let absent = false;
      const req = indexedDB.open(name);
      req.onupgradeneeded = () => { absent = true; req.transaction.abort(); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => absent ? resolve(null) : reject(req.error);
      req.onblocked = () => reject(Error('Другая вкладка удерживает хранилище. Закройте её и повторите открытие OSMINOG.'));
    });
  }
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const name of ['meta', 'originals', 'captures']) req.result.createObjectStore(name);
      };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opening = null; }; resolve(req.result); };
      req.onerror = () => { opening = null; reject(req.error); };
    });
    return opening;
  }
  async function transact(db, names, mode, work) {
    const tx = db.transaction(names, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || Error('Запись восстановления не завершена'));
    });
    done.catch(() => {});
    try { const result = await work(tx); await done; return result; }
    catch (error) { try { tx.abort(); } catch {} await done.catch(() => {}); throw error; }
  }
  const read = (db, store, key) => transact(db, [store], 'readonly', tx => request(tx.objectStore(store).get(key)));
  const all = (db, store) => transact(db, [store], 'readonly', tx => request(tx.objectStore(store).getAll()));
  async function saveMeta(key, value) {
    return transact(await open(), ['meta'], 'readwrite', tx => request(tx.objectStore('meta').put(value, key)));
  }
  async function backup(key, supplied) {
    const db = await open();
    if (await read(db, 'originals', key)) return;
    const values = supplied || await local().get(key);
    const record = {present: Object.hasOwn(values, key), value: values[key]};
    await transact(db, ['originals'], 'readwrite', async tx => {
      const store = tx.objectStore('originals');
      if (!await request(store.get(key))) await request(store.put(record, key));
    });
  }
  async function writeLegacy(key, value) {
    await backup(key);
    await local().set({[key]: value});
  }
  function validWorkspace(value) {
    return value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.projects) &&
      value.projects.every(p => p && typeof p.id === 'string' && p.id && (p.objects === undefined || Array.isArray(p.objects)));
  }
  async function blob(core, id) {
    const record = await read(core, 'blobs', id);
    if (!(record?.blob instanceof Blob)) throw Error('Не найден исходный файл 4.0.38: ' + id);
    return record.blob;
  }
  async function detail(core, id) {
    if (!id) return {};
    const value = JSON.parse(await (await blob(core, id)).text());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Повреждено описание материала 4.0.38');
    return value;
  }
  async function dataURL(value) {
    const parts = [];
    // The block length is divisible by three, so only the final base64 block
    // has padding. No whole-file ArrayBuffer or worker FileReader is needed.
    for (let offset = 0; offset < value.size; offset += 49152) {
      const bytes = new Uint8Array(await value.slice(offset, offset + 49152).arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      parts.push(btoa(binary));
      if (offset % (49152 * 8) === 0) await pause();
    }
    return 'data:' + (value.type || 'application/octet-stream') + ';base64,' + parts.join('');
  }
  async function sameInline(value, file) {
    if (typeof value !== 'string' || !/^data:[^,]*;base64,/i.test(value)) return false;
    const split = value.indexOf(','), encoded = value.slice(split + 1);
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    if (encoded.length % 4 || encoded.length / 4 * 3 - padding !== file.size) return false;
    try {
      for (let start = 0, offset = 0; start < encoded.length; start += 65536) {
        const bytes = atob(encoded.slice(start, start + 65536));
        const other = new Uint8Array(await file.slice(offset, offset + bytes.length).arrayBuffer());
        for (let i = 0; i < bytes.length; i++) if (bytes.charCodeAt(i) !== other[i]) return false;
        offset += bytes.length;
      }
      return true;
    } catch { return false; }
  }
  async function* itemPages(core, deskId) {
    let lower = [deskId, 0, ''], exclusive = false;
    while (true) {
      const range = IDBKeyRange.bound(lower, [deskId, Infinity, []], exclusive, false);
      const rows = await transact(core, ['items'], 'readonly', tx => request(tx.objectStore('items').index('deskUpdated').getAll(range, 32)));
      if (!rows.length) return;
      yield rows;
      const last = rows[rows.length - 1]; lower = [deskId, last.updatedAt, last.id]; exclusive = true;
    }
  }
  const mergedList = (current, old, identity = value => value.id) => {
    const previous = new Map((old || []).map(value => [identity(value), value]));
    return (current || []).map(value => ({...previous.get(identity(value)), ...value}));
  };
  function newObject(type) {
    return {type, x: 0, y: 0, w: 320, h: 220, rotation: 0, visible: true, opacity: 1, group: null,
      fill: '#ffffff', fillEnabled: !['image', 'file'].includes(type), fillType: 'solid', fill2: '#7f5cff', gradientAngle: 135,
      stroke: '#d9dde7', strokeEnabled: !['image', 'file'].includes(type), strokeWidth: 1, radius: 0,
      corners: {tl: 0, tr: 0, br: 0, bl: 0}, cornersLinked: true, themeSurface: type === 'brief',
      textColor: '#202633', fontSize: 16, fontWeight: 500, padding: 18};
  }
  async function mergeObject(core, item, previous) {
    const archived = await detail(core, item.detailBlobId);
    const original = {...archived, ...previous};
    // A retry may start after the workspace committed but before chat restore
    // completed. Keep an already removed rich-text field removed; otherwise
    // the immutable archive would hide the new plain text on that second pass.
    for (const [field, saved] of [['html', 'osminogRestore438OriginalHtml'], ['titleHtml', 'osminogRestore438OriginalTitleHtml']]) {
      if (previous && Object.hasOwn(previous, saved) && !Object.hasOwn(previous, field)) delete original[field];
    }
    const type = item.legacySource && original.type ? original.type : item.type === 'text' ? 'brief' : item.type || original.type || 'brief';
    const object = {...newObject(type), ...original, type, id: String(previous?.id || item.sourceId || item.id)};
    for (const key of ['name', 'title', 'fileName', 'mime', 'size', 'x', 'y', 'w', 'h', 'rotation', 'captureId', 'captureHash', 'capturedAt', 'createdAt']) {
      if (Object.hasOwn(item, key) && item[key] !== undefined) object[key] = item[key];
    }
    object.updated = Number(item.updatedAt) || Number(object.updated) || 0;
    if (Object.hasOwn(item, 'folderId')) {
      if (item.folderId) object.osminogFolderId = item.folderId; else delete object.osminogFolderId;
    }
    if (item.desktopId) object.osminogDesktopId = item.desktopId;
    const text = item.textBlobId ? await (await blob(core, item.textBlobId)).text() : String(item.text || '');
    if (typeof original.code === 'string' && typeof original.text !== 'string' && !['brief', 'text', 'note', 'node'].includes(type)) {
      object.code = text;
      if (original.code !== text && Array.isArray(original.codeFiles) && original.codeFiles.length) {
        const active = original.codeFiles.find(file => file.id === original.activeCodeFile) || original.codeFiles[0];
        object.codeFiles = original.codeFiles.map(file => file === active ? {...file, content: text} : file);
      }
    }
    else if (Object.hasOwn(item, 'text') || item.textBlobId) {
      if (String(original.text ?? '') !== text && original.html) {
        object.osminogRestore438OriginalHtml = original.html; delete object.html;
      }
      object.text = text;
    }
    if (String(object.title ?? '') !== String(original.title ?? '') && original.titleHtml) {
      object.osminogRestore438OriginalTitleHtml = original.titleHtml; delete object.titleHtml;
    }
    if (item.assetId) {
      const file = await blob(core, item.assetId);
      if (!await sameInline(object.src, file)) object.src = await dataURL(file);
    } else if (item.url) {
      if (['image', 'file'].includes(type)) object.src = item.url; else object.url = item.url;
    }
    if (!object.searchIndex && item.legacySource && core.objectStoreNames.contains('search')) {
      const index = await read(core, 'search', item.id);
      if (index?.content) object.searchIndex = {text: index.content, at: object.updated, restoredFrom438: true};
    }
    delete object.deletedAt;
    return object;
  }
  async function mergeProject(core, desk, previous, runId, rememberCaptures = false) {
    const archived = await detail(core, desk.detailBlobId);
    const project = {...archived, ...previous, id: desk.id};
    for (const key of ['name', 'description', 'view', 'sharing', 'canvas', 'activeDesktop']) {
      if (Object.hasOwn(desk, key) && desk[key] !== undefined) project[key] = desk[key];
    }
    project.created = project.created || desk.createdAt || Date.now();
    project.updated = Math.max(Number(project.updated) || 0, Number(desk.updatedAt) || 0, Date.now());
    project.osminogFolders = mergedList(desk.folders, project.osminogFolders);
    project.desktops = mergedList(desk.desktops, project.desktops || project.osminogDesktops);
    project.connections = mergedList(desk.connections, project.connections, link => link.id || JSON.stringify([link.from, link.to]));
    project.groups = Array.isArray(project.groups) ? project.groups : [];
    project.ink = Array.isArray(project.ink) ? project.ink : [];
    project.logs = Array.isArray(project.logs) ? project.logs : [];
    const objects = new Map((previous?.objects || []).map(object => [object.id, object]));
    const captures = new Map((previous?.objects || []).filter(object => object.captureId).map(object => [object.captureId, object]));
    const touched = new Set(), deleted = new Set();
    for await (const rows of itemPages(core, desk.id)) {
      for (const item of rows) {
        const old = objects.get(item.sourceId || item.id) || objects.get(item.id) || captures.get(item.captureId);
        const id = old?.id || item.sourceId || item.id;
        touched.add(id);
        if (item.captureId && rememberCaptures) await transact(await open(), ['captures'], 'readwrite', tx =>
          request(tx.objectStore('captures').put(true, [desk.id, String(item.captureId)])));
        if (item.deletedAt) { objects.delete(id); deleted.add(id); continue; }
        objects.set(id, await mergeObject(core, item, old));
      }
      await pause();
    }
    project.objects = [...objects.values()];
    const existingIds = new Set(project.objects.map(object => object.id));
    for (const folder of project.osminogFolders) folder.members = (folder.members || []).filter(id => !touched.has(id) && existingIds.has(id));
    for (const object of project.objects) {
      const folder = project.osminogFolders.find(folder => folder.id === object.osminogFolderId);
      if (folder && !folder.members.includes(object.id)) folder.members.push(object.id);
    }
    project.connections = project.connections.filter(link => !deleted.has(link.from) && !deleted.has(link.to));
    project[MARK] = {runId};
    return project;
  }
  async function replayGuards(core, projects) {
    const keys = (await local().getKeys()).filter(key => /^(osminogItemEdit:|osminogCapture:)/.test(key));
    for (const key of keys) {
      const values = await local().get(key), entry = values[key];
      if (!entry || typeof entry !== 'object') continue;
      if (key.startsWith('osminogItemEdit:') && entry.token && await read(core, 'meta', 'legacy-applied:' + entry.token)) {
        await backup(key, values);
        const project = projects.get(entry.projectId);
        if (project) (project.savedItemEdits ||= {})[entry.token] = true;
      } else if (key.startsWith('osminogCapture:') && entry.id &&
        await read(await open(), 'captures', [entry.projectId, String(entry.id)])) await backup(key, values);
      await pause();
    }
  }
  async function restoreWorkspace(core, state) {
    for (const name of ['desks', 'items', 'blobs', 'meta']) if (!core.objectStoreNames.contains(name)) throw Error('Неполное хранилище материалов 4.0.38');
    const desks = await all(core, 'desks');
    if (!desks.length) return;
    const primaryValues = await local().get(PRIMARY);
    let workspace = primaryValues[PRIMARY];
    if (!validWorkspace(workspace)) {
      const fallback = (await local().get(BACKUP))[BACKUP];
      if (validWorkspace(fallback)) workspace = fallback;
      else if (workspace != null || fallback != null) throw Error('Прежний полный проект повреждён. Оригиналы сохранены; восстановление остановлено.');
      else workspace = {projects: []};
    }
    await backup(PRIMARY, primaryValues);
    const trashValues = await local().get('osminogTrashIndex'), trash = {...trashValues.osminogTrashIndex};
    const projects = new Map(workspace.projects.map(project => [project.id, project]));
    const removed = new Map();
    for (const desk of desks) {
      const key = 'osminogTrashProject:' + desk.id;
      let previous = projects.get(desk.id);
      if (!previous && (desk.deletedAt || trash[desk.id])) previous = (await local().get(key))[key];
      const merged = await mergeProject(core, desk, previous, state.runId, true);
      if (desk.deletedAt || trash[desk.id]) {
        projects.delete(desk.id); removed.set(desk.id, merged);
        // A permanent legacy purge marker remains permanent. A new soft delete
        // gets a restorable legacy trash record; its original Core body remains.
        if (!trash[desk.id]?.purged) {
          trash[desk.id] ||= {name: merged.name, expires: Date.now() + 7 * 86400000};
          await writeLegacy(key, merged);
        }
      } else projects.set(desk.id, merged);
      state.projects = (state.projects || 0) + 1; await saveMeta('progress', {...state, stage: 'workspace'}); await pause();
    }
    await replayGuards(core, new Map([...projects, ...removed]));
    for (const [id, project] of removed) if (!trash[id]?.purged) await writeLegacy('osminogTrashProject:' + id, project);
    workspace = {...workspace, projects: [...projects.values()]};
    if (!projects.has(workspace.activeProject)) workspace.activeProject = workspace.projects[0]?.id || null;
    await writeLegacy('osminogTrashIndex', trash);
    await local().set({[PRIMARY]: workspace});
    // Save the old backup before normal 4.0.39 saves are allowed to replace it.
    workspace = null; projects.clear(); removed.clear();
    await backup(BACKUP);
  }
  async function messageIdentity(value) {
    if (value && typeof value === 'object' && value.id) return 'id:' + String(value.id);
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    return 'body:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function restoreChats(chat, state) {
    for (const name of ['threads', 'bodies']) if (!chat.objectStoreNames.contains(name)) throw Error('Неполная история чатов 4.0.38');
    for (const meta of await all(chat, 'threads')) {
      const scope = String(meta.scope || ''), thread = String(meta.thread || '');
      if (!scope || !thread) throw Error('Повреждён адрес сохранённого чата');
      const key = 'briefCraftGptLiteChat:' + scope + ':' + thread, fallback = 'briefCraftGptLiteChat:' + scope;
      const threadKey = 'briefCraftGptThreads:' + scope, clearKey = 'briefCraftGptChatCleared:' + scope + ':' + thread;
      const values = await local().get([key, ...(thread === 'main' ? [fallback] : []), threadKey, clearKey]);
      const threads = values[threadKey];
      // An explicitly removed legacy thread must not be silently recreated.
      if (thread !== 'main' && Array.isArray(threads?.items) && !threads.items.some(value => value.id === thread)) continue;
      const cutoff = Number(values[clearKey]?.at) || 0;
      const visible = value => !cutoff || Number(value?.at ?? value?.createdAt) > cutoff;
      const source = Array.isArray(values[key]) ? values[key] : thread === 'main' && Array.isArray(values[fallback]) ? values[fallback] : [];
      const merged = source.filter(visible), available = new Map(), occurrences = new Map(), byId = new Map();
      for (let i = 0; i < merged.length; i++) {
        const identity = await messageIdentity(merged[i]);
        available.set(identity, (available.get(identity) || 0) + 1);
        if (identity.startsWith('id:')) byId.set(identity, i);
      }
      const end = Math.max(0, Number(meta.nextSeq) || 0);
      for (let seq = 0; seq < end; seq++) {
        const value = await read(chat, 'bodies', [scope, thread, seq]);
        if (value === undefined) throw Error('В истории 4.0.38 отсутствует сообщение ' + seq);
        if (visible(value)) {
          const identity = await messageIdentity(value), occurrence = (occurrences.get(identity) || 0) + 1;
          occurrences.set(identity, occurrence);
          if (identity.startsWith('id:') && byId.has(identity)) {
            const index = byId.get(identity);
            merged[index] = {...merged[index], ...value};
          } else if (occurrence > (available.get(identity) || 0)) {
            if (identity.startsWith('id:')) byId.set(identity, merged.length);
            merged.push(value);
          }
        }
        if (seq % 8 === 0) await pause();
      }
      await backup(key, values); await local().set({[key]: merged});
      state.chats = (state.chats || 0) + 1; await saveMeta('progress', {...state, stage: 'chats'}); await pause();
    }
  }
  async function restore() {
    const previous = await read(await open(), 'meta', 'complete');
    if (previous?.status === 'done') return previous;
    const core = await existing(CORE_DB), chat = await existing(CHAT_DB);
    // Do not leave a permanent marker before a first editor has any Lite data.
    if (!core && !chat) return {status: 'not-needed'};
    const interrupted = await read(await open(), 'meta', 'progress');
    const state = {status: 'running', stage: 'workspace', runId: interrupted?.runId || crypto.randomUUID(),
      startedAt: interrupted?.startedAt || Date.now(), projects: 0, chats: 0};
    await saveMeta('progress', state);
    try {
      if (core) await restoreWorkspace(core, state);
      if (chat) await restoreChats(chat, state);
      const done = {...state, status: 'done', stage: 'done', finishedAt: Date.now()};
      await saveMeta('complete', done); await saveMeta('progress', done);
      return done;
    } catch (error) {
      await saveMeta('progress', {...state, status: 'error', error: String(error.message || error).slice(0, 400)});
      throw error;
    } finally { core?.close(); chat?.close(); }
  }
  function ready() {
    if (!running) {
      const work = () => restore();
      running = (navigator.locks?.request ? navigator.locks.request(LOCK, work) : work()).finally(() => { running = null; });
    }
    return running;
  }
  async function loadGuards(result) {
    if (result?.status !== 'done' || guardsRunId === result.runId) return;
    const core = await existing(CORE_DB);
    guards.clear();
    if (!core) { guardsRunId = result.runId; return; }
    try {
      for (const desk of await all(core, 'desks')) {
        const group = {at: Number(desk.updatedAt) || 0, folders: new Map(), items: new Map(), captures: new Set()};
        for (const folder of desk.folders || []) group.folders.set(folder.id, Math.max(group.at, Number(folder.legacyPositionAt) || 0));
        for await (const rows of itemPages(core, desk.id)) for (const item of rows) {
          const at = Math.max(Number(item.updatedAt) || 0, Number(item.deletedAt) || 0, Number(item.legacyPositionAt) || 0);
          group.items.set(item.id, at);
          if (item.sourceId) group.items.set(item.sourceId, at);
          if (item.captureId) group.captures.add(String(item.captureId));
        }
        guards.set(desk.id, group);
      }
      guardsRunId = result.runId;
    } finally { core.close(); }
  }
  function shouldApplyAgainst(guard, edit, runId) {
    if (edit.restoredRunId && edit.restoredRunId === runId) return true;
    if (!guard) return true;
    if (edit.kind === 'capture') return !guard.captures.has(String(edit.object?.captureId || ''));
    const at = Number(edit.at) || 0;
    if (edit.kind === 'view') return at > guard.at;
    if (edit.kind === 'objectPosition' && guard.items.has(edit.objectId)) return at > guard.items.get(edit.objectId);
    if (edit.folderId && guard.folders.has(edit.folderId)) return at > guard.folders.get(edit.folderId);
    return true;
  }
  function shouldApplyLegacyEdit(project, edit) {
    return shouldApplyAgainst(guards.get(project?.id), edit, guardsRunId);
  }
  async function beforeLoad() {
    if (globalThis.location?.protocol !== 'chrome-extension:' && globalThis.location?.origin === 'null') return {status: 'not-needed'};
    if (globalThis.location?.protocol !== 'chrome-extension:' || !globalThis.chrome?.runtime?.id) {
      prepared = await ready(); await loadGuards(prepared); return prepared;
    }
    const response = await chrome.runtime.sendMessage({type: 'OSMINOG_RESTORE_438'});
    if (!response?.ok) throw Error(response?.error || 'Не удалось восстановить материалы 4.0.38. Оригиналы сохранены.');
    prepared = response.result; await loadGuards(prepared); return prepared;
  }
  async function afterLoad(state) {
    const result = prepared || await read(await open(), 'meta', 'complete');
    if (result?.status !== 'done') return {changed: false};
    await loadGuards(result);
    const core = await existing(CORE_DB);
    if (!core) return {changed: false};
    let changed = false;
    try {
      const projects = new Map((state.projects || []).map(project => [project.id, project]));
      for (const desk of await all(core, 'desks')) {
        const old = projects.get(desk.id);
        // Projects saved in the full UI keep the marker. Do not reapply an old
        // Lite snapshot over subsequent 4.0.39 edits or an explicit restoration.
        if (old?.[MARK]?.runId === result.runId) continue;
        if (desk.deletedAt) { if (old) { projects.delete(desk.id); changed = true; } continue; }
        if (!old) continue;
        projects.set(desk.id, await mergeProject(core, desk, old, result.runId)); changed = true;
      }
      if (changed) {
        await replayGuards(core, projects);
        state.projects = [...projects.values()];
        if (!projects.has(state.activeProject)) state.activeProject = state.projects[0]?.id || null;
      }
      return {changed};
    } finally { core.close(); }
  }
  async function skipLegacyCapture(entry) {
    if (!entry?.id || !entry.projectId) return false;
    return !!await read(await open(), 'captures', [String(entry.projectId), String(entry.id)]);
  }
  function installBackground() {
    if (installBackground.installed) return;
    installBackground.installed = true;
    const editor = chrome.runtime.getURL('editor.html');
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
      if (message?.type !== 'OSMINOG_RESTORE_438') return;
      if (sender.id !== chrome.runtime.id || sender.url?.split(/[?#]/)[0] !== editor) {
        reply({ok: false, error: 'Восстановление доступно только редактору OSMINOG'}); return;
      }
      ready().then(result => reply({ok: true, result}), error => reply({ok: false, error: String(error.message || error)}));
      return true;
    });
  }
  globalThis.OSMINOGRestore438 = {beforeLoad, afterLoad, ready, skipLegacyCapture, shouldApplyLegacyEdit, installBackground,
    status: async () => read(await open(), 'meta', 'progress'),
    __test: {DB_NAME, existing, mergeObject, mergeProject, sameInline, dataURL, messageIdentity, validWorkspace, shouldApplyAgainst,
      original: async key => read(await open(), 'originals', key)}};
})();
