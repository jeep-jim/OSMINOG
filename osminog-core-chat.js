/* Lightweight chat and explicit canvas access. No polling, whole-workspace writes,
 * screenshots, automatic media decoding, or original chat transcript mirroring. */
"use strict";
((global) => {
  const DB_NAME = 'osminog-core-chat-v1', PAGE_SIZE = 40, PREVIEW_CHARS = 12000;
  const THREAD_PREFIX = 'briefCraftGptThreads:', CHAT_PREFIX = 'briefCraftGptLiteChat:';
  const CLEAR_PREFIX = 'briefCraftGptChatCleared:', PROVIDER_KEYS = 'briefCraftProviderKeysV1';
  const PROVIDERS = {
    gpt: {name: 'ChatGPT', url: 'https://chatgpt.com/', hosts: ['chatgpt.com', 'chat.openai.com']},
    claude: {name: 'Claude', url: 'https://claude.ai/new', hosts: ['claude.ai'], api: 'https://api.anthropic.com/*'},
    gemini: {name: 'Gemini', url: 'https://gemini.google.com/app', hosts: ['gemini.google.com'], api: 'https://generativelanguage.googleapis.com/*'},
    googleai: {name: 'Google AI', url: 'https://aistudio.google.com/prompts/new_chat', hosts: ['aistudio.google.com', 'www.google.com', 'google.com']},
    deepseek: {name: 'DeepSeek', url: 'https://chat.deepseek.com/', hosts: ['chat.deepseek.com'], api: 'https://api.deepseek.com/*'},
    custom: {name: 'Другой API', hosts: []}
  };
  const READ_TOOLS = ['capabilities', 'tool_list', 'canvas_status', 'list_canvas_objects', 'get_project_map',
    'get_selection', 'get_viewport', 'get_object', 'read_object_text', 'search_canvas', 'read_asset', 'chat_history_read'];
  const EDIT_TOOLS = ['propose_canvas_patch', 'canvas.create', 'canvas.move', 'focus_object'];
  const clip = (value, limit = 1000) => String(value ?? '').slice(0, limit);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback, max) => Math.max(0, Math.min(max, Math.floor(finite(value, fallback))));
  const uuid = () => global.crypto.randomUUID();
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const request = value => new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error || Error('Ошибка чтения истории'));
  });
  const completed = tx => new Promise((resolve, reject) => {
    tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || Error('История не сохранена'));
  });
  const textOf = message => typeof message === 'string' ? message :
    typeof message?.text === 'string' ? message.text : typeof message?.content === 'string' ? message.content : '';

  function previewOf(message, scope, thread, seq) {
    const source = message && typeof message === 'object' ? message : {};
    const text = textOf(message), attachments = Array.isArray(source.attachments) ? source.attachments : [];
    return {scope, thread, seq, at: Math.max(0, finite(source.at ?? source.createdAt)),
      id: clip(source.id || `saved-${seq}`, 200), role: source.role === 'user' ? 'user' : 'assistant',
      author: clip(source.author, 100), provider: clip(source.provider, 40), source: clip(source.source, 40),
      text: text.slice(0, PREVIEW_CHARS), fullTextChars: text.length, attachmentCount: attachments.length,
      attachments: attachments.slice(0, 12).map(file => ({name: clip(file?.name || file?.fileName || 'Вложение', 160),
        mime: clip(file?.mime || file?.type, 100), size: Math.max(0, finite(file?.size))}))};
  }
  function conversationOf(rows, budget = 24000) {
    const result = [];
    for (let index = rows.length - 1; index >= 0 && result.length < 40 && budget > 0; index--) {
      const row = rows[index]; if (['progress', 'runtime', 'media-choice'].includes(row.source)) continue;
      const text = clip(row.text, Math.min(4000, budget)); if (!text) continue;
      result.unshift({role: row.role, text, author: clip(row.author, 100), at: row.at || 0}); budget -= text.length;
    }
    return result;
  }

  function createHistory({indexedDB = global.indexedDB, keyRange = global.IDBKeyRange,
    storage = global.chrome?.storage?.local, locks = global.navigator?.locks} = {}) {
    let dbPromise;
    function open() {
      if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('threads', {keyPath: ['scope', 'thread']});
          const messages = db.createObjectStore('messages', {keyPath: ['scope', 'thread', 'seq']});
          messages.createIndex('byTime', ['scope', 'thread', 'at', 'seq']);
          // Bodies have out-of-line keys: every unknown legacy field remains byte-for-byte serializable.
          db.createObjectStore('bodies');
        };
        req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
        req.onerror = () => { dbPromise = null; reject(req.error); };
        req.onblocked = () => { dbPromise = null; reject(Error('Закрой другие окна OSMINOG и повтори открытие чата')); };
      });
      return dbPromise;
    }
    async function getMeta(scope, thread) {
      const db = await open(); return request(db.transaction('threads').objectStore('threads').get([scope, thread]));
    }
    async function ensureUnlocked(scope, thread) {
      let meta = await getMeta(scope, thread); if (meta?.legacyDone) return meta;
      const primary = CHAT_PREFIX + scope + ':' + thread, fallback = CHAT_PREFIX + scope;
      const values = await storage.get(thread === 'main' ? [primary, fallback] : [primary]);
      const legacy = Array.isArray(values[primary]) ? values[primary] : thread === 'main' && Array.isArray(values[fallback]) ? values[fallback] : [];
      const sourceKey = Array.isArray(values[primary]) ? primary : thread === 'main' && Array.isArray(values[fallback]) ? fallback : primary;
      meta = meta || {scope, thread, nextSeq: 0, legacyNext: 0};
      if (meta.sourceKey && meta.sourceKey !== sourceKey) throw Error('Источник сохранённой истории изменился во время переноса');
      for (let start = meta.legacyNext || 0; start < legacy.length; start += 8) {
        const end = Math.min(start + 8, legacy.length), db = await open();
        const tx = db.transaction(['threads', 'messages', 'bodies'], 'readwrite'), done = completed(tx);
        for (let index = start; index < end; index++) {
          tx.objectStore('messages').put(previewOf(legacy[index], scope, thread, index));
          tx.objectStore('bodies').put(legacy[index], [scope, thread, index]);
        }
        meta = {...meta, sourceKey, legacyNext: end, nextSeq: end, legacyLength: legacy.length, legacyDone: end === legacy.length};
        tx.objectStore('threads').put(meta); await done;
        for (let index = start; index < end; index++) legacy[index] = null;
        await pause();
      }
      if (!meta.legacyDone) {
        const db = await open(), tx = db.transaction('threads', 'readwrite'), done = completed(tx);
        meta = {...meta, sourceKey, legacyLength: legacy.length, legacyDone: true}; tx.objectStore('threads').put(meta); await done;
      }
      return meta;
    }
    function ensure(scope, thread) {
      const work = () => ensureUnlocked(scope, thread);
      return locks?.request ? locks.request('osminog-core-chat:' + JSON.stringify([scope, thread]), work) : work();
    }
    async function page(scope, thread, {before = null, limit = PAGE_SIZE, epoch = 0} = {}) {
      const db = await open(), count = Math.max(1, integer(limit, PAGE_SIZE, PAGE_SIZE));
      const lower = epoch > 0 ? [scope, thread, epoch, Number.MAX_SAFE_INTEGER] : [scope, thread, 0, -1];
      const upper = before ? [scope, thread, before[0], before[1]] : [scope, thread, Infinity, Infinity];
      if (before && epoch > 0 && before[0] <= epoch) return {rows: [], hasMore: false, next: null};
      const range = keyRange.bound(lower, upper, epoch > 0, !!before), rows = [];
      await new Promise((resolve, reject) => {
        const req = db.transaction('messages').objectStore('messages').index('byTime').openCursor(range, 'prev');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor || rows.length > count) { resolve(); return; }
          const row = cursor.value;
          if (!['progress', 'runtime', 'media-choice'].includes(row.source)) rows.push(row);
          cursor.continue();
        };
      });
      const hasMore = rows.length > count; if (hasMore) rows.pop(); rows.reverse();
      return {rows, hasMore, next: rows.length ? [rows[0].at, rows[0].seq] : null};
    }
    async function append(scope, thread, message) {
      const db = await open(), tx = db.transaction(['threads', 'messages', 'bodies'], 'readwrite'), done = completed(tx);
      let preview;
      const req = tx.objectStore('threads').get([scope, thread]);
      req.onsuccess = () => {
        const meta = req.result;
        if (!meta?.legacyDone) { tx.abort(); return; }
        const seq = meta.nextSeq || 0; preview = previewOf(message, scope, thread, seq);
        tx.objectStore('messages').put(preview); tx.objectStore('bodies').put(message, [scope, thread, seq]);
        tx.objectStore('threads').put({...meta, nextSeq: seq + 1});
      };
      await done; return preview;
    }
    async function body(scope, thread, seq) {
      const db = await open(); return request(db.transaction('bodies').objectStore('bodies').get([scope, thread, seq]));
    }
    return {ensure, page, append, body, getMeta, async close() { (await dbPromise)?.close(); dbPromise = null; }};
  }

  function objectPreview(item) {
    const result = {};
    for (const key of ['id', 'deskId', 'type', 'name', 'title', 'fileName', 'mime', 'folderId', 'desktopId']) {
      if (item?.[key] != null) result[key] = clip(item[key], key === 'id' || key === 'deskId' ? 200 : 180);
    }
    for (const key of ['x', 'y', 'w', 'h', 'size', 'createdAt', 'updatedAt']) if (Number.isFinite(item?.[key])) result[key] = item[key];
    result.textPreview = clip(item?.text, 400); return result;
  }
  function allowedTools(role) { return role === 'edit' ? [...READ_TOOLS, ...EDIT_TOOLS] : READ_TOOLS.slice(); }
  function executionContract(role, external = false) {
    return {mode: 'core-canvas', tools: allowedTools(role).filter(name => !external || name !== 'chat_history_read'),
      limits: {callsPerStep: 8, steps: external ? 12 : 6, objectsPerRead: 80, textCharsPerRead: 8000, patchActions: 20,
        createdTextChars: 30000, automaticImages: false},
      instructions: [
        'Only execution.tools are available. For conversation, answer normally. Use a tool only when the user asks for canvas data or an action.',
        'Call format: {"protocol":"osminog.request/v1","calls":[{"tool":"read_object_text","args":{"id":"EXISTING_ID","offset":0,"max_chars":8000}}]}. At most 8 calls per step.',
        'canvas_status returns project/counts/revision. list_canvas_objects and get_project_map accept offset and limit (max80); get_selection returns selected metadata; get_viewport returns transform only; get_object {id} returns metadata.',
        'search_canvas {query,limit} searches this desk (max25). read_object_text {id,offset,max_chars} pages exact text (max8000). read_asset {id} attaches one existing image only when explicitly requested; it does not generate an image or capture the screen.',
        external ? 'Internal chat history is private and unavailable to this connection.' : 'chat_history_read {before:[at,seq],limit} pages saved text (max40 messages and12000 characters); use the returned next cursor.',
        role === 'edit' ? 'propose_canvas_patch {summary,actions} only stages a reviewable proposal. Up to20 actions: {op:"create",objectType:"text",properties:{text,name,x,y,w,h}} or {op:"set",target:"EXISTING_ID",properties:{text,name,title,x,y,w,h}}. Only text notes may be created. canvas.create is a create-proposal alias; canvas.move {id,x,y} is a move-proposal alias; focus_object {id} focuses an existing object.' : 'This connection is read-only. No create, edit, move, deletion or focus action is granted.',
        'A staged proposal is NOT an applied change. The user must press Apply in OSMINOG. State that it awaits confirmation; never claim an edit was saved merely because a patch was returned.',
        'No other product feature is available through this interface. Do not invoke a tool absent from execution.tools. Stop and explain a concrete unsupported action instead of trying unrelated tools.',
        'Use real IDs from the current desk, keep results bounded and follow execution.limits.'
      ].join(' ')};
  }
  function normalizedPatch(raw) {
    const patch = raw?.patch || raw;
    if (!patch || !Array.isArray(patch.actions) || !patch.actions.length || patch.actions.length > 20) throw Error('Ожидается от 1 до 20 изменений');
    const actions = patch.actions.map(action => {
      if (!action || !['create', 'set', 'move'].includes(action.op)) throw Error('Разрешены только создание заметки, текст и перемещение');
      const input = action.properties || action.props || (action.op === 'move' ? {x: action.x, y: action.y} : {});
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Некорректные свойства объекта');
      const properties = {};
      for (const [key, value] of Object.entries(input)) {
        if (!['text', 'name', 'title', 'x', 'y', 'w', 'h'].includes(key)) throw Error('Свойство не разрешено: ' + key);
        if (['text', 'name', 'title'].includes(key)) {
          if (typeof value !== 'string' || value.length > (key === 'text' ? 30000 : 240)) throw Error('Слишком длинное или неверное текстовое поле');
          properties[key] = value;
        } else {
          if (!Number.isFinite(value) || Math.abs(value) > 10000000 || (key === 'w' || key === 'h') && (value < 16 || value > 10000)) throw Error('Недопустимые размеры или координаты');
          properties[key] = value;
        }
      }
      if (!Object.keys(properties).length) throw Error('В изменении нет поддерживаемых свойств');
      if (action.op === 'create') {
        const type = action.objectType || action.type || 'text';
        if (!['text', 'note', 'brief'].includes(type)) throw Error('ИИ может создать только текстовую заметку');
        return {op: 'create', properties: {type: 'brief', ...properties}};
      }
      const id = clip(action.target || action.id || action.objectId, 200); if (!id) throw Error('Не указан объект');
      return {op: 'set', id, properties};
    });
    return {summary: clip(patch.summary || 'Изменения холста', 240), actions};
  }

  function createTools({api, history, current, stage, readImage}) {
    function assert(scope) { if (current().deskId !== scope.deskId || api.getDeskId() !== scope.deskId || current().scope !== scope.scope || current().disposed) throw Error('Стол изменился; запрос отменён'); scope.assert?.(); }
    async function items(scope) { assert(scope); const rows = await api.listItems(); assert(scope); return (Array.isArray(rows) ? rows : []).filter(row => !row.deletedAt && (!row.deskId || row.deskId === scope.deskId)); }
    async function member(id, scope) {
      if (!(await items(scope)).some(row => String(row.id) === String(id))) throw Error('Объект отсутствует на текущем столе');
      const item = await api.getItem(id); assert(scope); if (!item || item.deletedAt || item.deskId && item.deskId !== scope.deskId) throw Error('Объект недоступен'); return item;
    }
    async function execute(name, args = {}, scope) {
      assert(scope); if (name === 'canvas_patch') name = 'propose_canvas_patch';
      if (!allowedTools(scope.role).includes(name)) throw Error('Инструмент недоступен для этого подключения: ' + name);
      if (name === 'capabilities' || name === 'tool_list') return {ok: true, tools: allowedTools(scope.role), role: scope.role,
        writes: 'Text/create/move are proposals, applied only after the user presses Apply in OSMINOG.', imageGeneration: false, browserAutomation: false};
      if (name === 'chat_history_read') {
        if (!scope.thread || scope.external) throw Error('История внутреннего чата не передаётся внешнему подключению');
        const result = await history.page(scope.scope, scope.thread, {before: Array.isArray(args.before) ? args.before : null,
          epoch: scope.epoch, limit: Math.max(1, integer(args.limit, 20, PAGE_SIZE))}); assert(scope);
        return {ok: true, messages: conversationOf(result.rows, 12000), next: result.hasMore ? result.next : null};
      }
      if (name === 'read_object_text') {
        const item = await member(args.id, scope), text = typeof item.text === 'string' ? item.text : typeof item.content === 'string' ? item.content : '';
        const offset = integer(args.offset, 0, text.length), limit = Math.max(1, integer(args.max_chars, 8000, 8000));
        return {ok: true, id: item.id, text: text.slice(offset, offset + limit), offset, nextOffset: offset + limit < text.length ? offset + limit : null, totalChars: text.length};
      }
      if (name === 'get_object') return {ok: true, object: objectPreview(await member(args.id, scope))};
      if (name === 'read_asset') {
        const item = await member(args.id, scope);
        if (!item.assetId) throw Error('У объекта нет отдельного файла');
        if (!readImage) return {ok: true, object: objectPreview(item), note: 'Файл можно открыть на холсте'};
        const result = await readImage(item, scope); assert(scope); return result;
      }
      if (name === 'get_viewport') return {ok: true, view: api.getView?.() || {}, note: 'Transform only; no canvas screenshot is taken.'};
      if (name === 'focus_object') { await member(args.id, scope); assert(scope); await api.focusItem(args.id); assert(scope); return {ok: true, focused: args.id}; }
      if (name === 'propose_canvas_patch' || name === 'canvas.create' || name === 'canvas.move') {
        const raw = name === 'canvas.create' ? {summary: args.summary, actions: [{op: 'create', objectType: args.type || args.objectType, properties: args.properties || args.props || {text: args.text || '', x: args.x ?? 80, y: args.y ?? 80}}]} :
          name === 'canvas.move' ? {summary: args.summary, actions: [{op: 'set', target: args.id || args.target, properties: {x: args.x, y: args.y}}]} : args;
        const patch = normalizedPatch(raw), rows = await items(scope), ids = new Set(rows.map(row => String(row.id)));
        for (const action of patch.actions) if (action.op !== 'create' && !ids.has(action.id)) throw Error('Объект отсутствует на текущем столе');
        assert(scope); return stage({...patch, scope: scope.scope, deskId: scope.deskId, revision: api.revision?.() || 0, role: scope.role});
      }
      const rows = await items(scope), selection = new Set(api.selectedIds?.() || []);
      if (name === 'canvas_status') {
        const desk = await api.getDesk(); assert(scope);
        return {ok: true, project: {id: scope.scope, name: clip(desk?.name, 200)}, revision: api.revision?.() || 0,
          counts: {objects: rows.length}, selectedIds: [...selection].slice(0, 40), view: api.getView?.() || {}};
      }
      if (name === 'get_selection') return {ok: true, objects: rows.filter(row => selection.has(row.id)).slice(0, 40).map(objectPreview)};
      if (name === 'search_canvas') {
        const query = clip(args.query || args.q, 500), limit = Math.max(1, integer(args.limit, 20, 25));
        const result = await api.search(query, {deskId: scope.deskId, limit}); assert(scope);
        const found = Array.isArray(result) ? result : result?.items || result?.results || [], ids = new Set(rows.map(row => String(row.id)));
        return {ok: true, objects: found.filter(row => ids.has(String(row.id))).slice(0, limit).map(objectPreview), limited: found.length >= limit};
      }
      const offset = integer(args.offset, 0, rows.length), limit = Math.max(1, integer(args.limit, 40, 80));
      return {ok: true, objects: rows.slice(offset, offset + limit).map(objectPreview), total: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null};
    }
    return {execute, assert, member};
  }

  function createTaskFence() {
    let active = null;
    return {get active() { return active; }, begin(snapshot) { if (active) active.cancelled = true; active = {...snapshot, cancelled: false}; return active; },
      valid(task, state) { return !!task && active === task && !task.cancelled && !state.disposed && task.scope === state.scope && task.deskId === state.deskId && task.thread === state.thread && task.epoch === state.epoch; },
      cancel() { const old = active; if (old) old.cancelled = true; active = null; return old; }, finish(task) { if (active === task) active = null; }};
  }

  function createApplication({root, accessRoot, api, chrome = global.chrome, document = global.document,
    history = createHistory(), now = Date.now}) {
    if (!root || !accessRoot || !api) throw Error('Нет контейнера чата или API стола');
    const state = {scope: '', deskId: '', thread: 'main', epoch: 0, disposed: false, threads: [], meta: {}, rows: [],
      before: null, next: null, hasMore: false, loading: false, serial: 0, transport: 'direct', proposal: null};
    const fence = createTaskFence(), grants = new Map(); let editorTabId = null, streamTimer = 0, channel, requestSerial = 0;
    const send = message => chrome.runtime.sendMessage(message);
    const local = chrome.storage.local;
    const node = (tag, attrs = {}, text = '') => {
      const element = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') element.className = value;
        else if (key === 'dataset') Object.assign(element.dataset, value);
        else if (key in element) element[key] = value;
        else element.setAttribute(key, String(value));
      }
      if (text) element.textContent = text; return element;
    };
    const button = (label, handler, attrs = {}) => {
      const element = node('button', {type: 'button', ...attrs}, label);
      element.addEventListener('click', () => Promise.resolve().then(handler).catch(error => status(error.message, true))); return element;
    };
    const select = (entries, label) => {
      const element = node('select', {'aria-label': label});
      for (const [value, text] of entries) element.append(node('option', {value}, text)); return element;
    };
    const providerOptions = Object.entries(PROVIDERS).map(([key, value]) => [key, value.name]);
    const ui = {};
    root.replaceChildren(); root.classList.add('core-chat');
    const heading = node('div', {class: 'core-chat-heading'}); heading.append(node('strong', {}, 'Чат'));
    ui.newThread = button('Новый диалог', newThread, {'data-core-chat-new': '', title: 'Новая история на этом столе'}); heading.append(ui.newThread);
    ui.thread = select([], 'Диалог'); ui.thread.dataset.coreChatThreads = '';
    const route = node('div', {class: 'core-chat-route'}); ui.provider = select(providerOptions, 'Провайдер ИИ');
    ui.connect = button('Подключить', connect, {'data-core-chat-connect': ''}); route.append(ui.provider, ui.connect);
    ui.status = node('p', {class: 'core-chat-status', role: 'status', 'aria-live': 'polite'}, 'История хранится на устройстве.');
    const paging = node('div', {class: 'core-chat-paging'});
    ui.older = button('Раньше', () => loadPage(state.next), {'data-core-chat-older': ''});
    ui.latest = button('Последние', () => loadPage(null), {'data-core-chat-latest': ''});
    ui.pageNote = node('span'); paging.append(ui.older, ui.pageNote, ui.latest);
    ui.messages = node('div', {class: 'core-chat-messages', role: 'log', 'aria-label': 'Сообщения'});
    ui.proposal = node('section', {class: 'core-chat-proposal', hidden: true, 'aria-label': 'Предложенные изменения'});
    const compose = node('form', {class: 'core-chat-compose'});
    ui.input = node('textarea', {rows: 3, maxLength: 30000, placeholder: 'Сообщение…', 'aria-label': 'Сообщение', 'data-core-chat-input': ''});
    const actions = node('div', {class: 'core-chat-actions'});
    ui.stop = button('Остановить', () => stop('Ответ остановлен.'), {hidden: true, 'data-core-chat-stop': ''});
    ui.send = node('button', {type: 'submit', class: 'primary', 'data-core-chat-send': ''}, 'Отправить'); actions.append(ui.stop, ui.send);
    compose.append(ui.input, actions); root.append(heading, ui.thread, route, ui.status, paging, ui.messages, ui.proposal, compose);
    compose.addEventListener('submit', event => { event.preventDefault(); sendPrompt(ui.input.value).catch(error => status(error.message, true)); });
    ui.input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); compose.requestSubmit(); } });
    ui.thread.addEventListener('change', () => chooseThread(ui.thread.value).catch(error => status(error.message, true)));
    ui.provider.addEventListener('change', () => changeProvider(ui.provider.value).catch(error => status(error.message, true)));

    function status(text, error = false) { ui.status.textContent = text; ui.status.classList.toggle('error', error); }
    function controls() {
      const busy = !!fence.active;
      ui.send.disabled = busy || state.loading; ui.input.disabled = state.loading;
      ui.stop.hidden = !busy; ui.connect.disabled = busy || state.loading; ui.provider.disabled = busy || state.loading;
      ui.thread.disabled = state.loading; ui.newThread.disabled = state.loading; ui.older.disabled = busy || state.loading || !state.hasMore;
      ui.latest.disabled = busy || state.loading || !state.before;
    }
    function snapshot(extra = {}) { return {scope: state.scope, deskId: state.deskId, thread: state.thread, epoch: state.epoch, role: 'edit', ...extra}; }
    function current(task) { return fence.valid(task, state); }
    function requireTask(task) { if (!current(task)) throw Error('Диалог или стол изменился; запрос отменён'); }
    function activeThread() { return state.threads.find(thread => thread.id === state.thread) || {id: state.thread, name: 'Диалог', provider: 'gpt'}; }
    function provider() { return PROVIDERS[activeThread().provider] ? activeThread().provider : 'gpt'; }
    function renderThreads() {
      ui.thread.replaceChildren(...state.threads.map(thread => node('option', {value: thread.id}, clip(thread.name || 'Диалог', 100))));
      ui.thread.value = state.thread; ui.provider.value = provider();
    }
    function finalText(element, text) {
      if (global.OSMINOGChatContent?.render) element.innerHTML = global.OSMINOGChatContent.render(text);
      else element.textContent = text;
    }
    function messageNode(row) {
      const article = node('article', {class: 'core-chat-message ' + row.role, dataset: {messageId: row.id}});
      const label = node('div', {class: 'core-chat-message-label'}, row.role === 'user' ? 'Вы' : row.author || PROVIDERS[row.provider]?.name || 'ИИ');
      const text = node('div', {class: 'core-chat-message-text'}); finalText(text, row.text); article.append(label, text);
      if (row.attachmentCount) article.append(node('p', {class: 'core-chat-attachment-note'}, 'Вложения сохранены: ' + row.attachmentCount + '. ' + row.attachments.map(item => item.name).join(', ')));
      if (row.fullTextChars > row.text.length || row.attachmentCount) article.append(button('Скачать сохранённое сообщение', () => exportMessage(row), {class: 'core-chat-download'}));
      return article;
    }
    function renderPage() {
      ui.messages.replaceChildren(...state.rows.map(messageNode));
      if (!state.rows.length) ui.messages.append(node('p', {class: 'core-chat-empty'}, 'Сообщения этого стола появятся здесь.'));
      ui.pageNote.textContent = state.rows.length ? state.rows.length + ' сообщений' : '';
      controls(); if (!state.before) ui.messages.scrollTop = ui.messages.scrollHeight;
    }
    async function exportMessage(row) {
      const body = await history.body(row.scope, row.thread, row.seq);
      const blob = new Blob([JSON.stringify(body, null, 2)], {type: 'application/json'}), url = URL.createObjectURL(blob);
      const link = node('a', {href: url, download: 'osminog-message-' + row.seq + '.json'}); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    async function loadPage(before = null) {
      const serial = ++requestSerial, scope = snapshot();
      const result = await history.page(scope.scope, scope.thread, {before, epoch: scope.epoch});
      if (state.disposed || serial !== requestSerial || scope.scope !== state.scope || scope.thread !== state.thread || scope.epoch !== state.epoch) return;
      state.before = before; state.rows = result.rows; state.next = result.next; state.hasMore = result.hasMore; renderPage();
    }
    async function loadThread(serial) {
      state.loading = true; controls(); ui.messages.replaceChildren(node('p', {class: 'core-chat-empty'}, 'Открываем историю…'));
      const scope = state.scope, thread = state.thread, key = CLEAR_PREFIX + scope + ':' + thread;
      try {
        const values = await local.get([key, 'osminogGptTransportV1']);
        if (serial !== state.serial || state.disposed) return;
        state.epoch = Math.max(0, finite(values[key]?.at)); state.transport = values.osminogGptTransportV1 === 'tab' ? 'tab' : 'direct';
        await history.ensure(scope, thread);
        if (serial !== state.serial || state.disposed) return;
        await loadPage(null); status('История хранится на устройстве. Подключение запускается по кнопке.');
      } finally { if (serial === state.serial) { state.loading = false; controls(); } }
    }
    async function refreshDesk() {
      const serial = ++state.serial; stop(); state.loading = true; controls(); state.proposal = null; renderProposal(); grants.clear();
      const deskId = String(api.getDeskId() || ''), desk = await api.getDesk(); if (serial !== state.serial || state.disposed) return;
      const scope = String(desk?.chatProjectId || desk?.id || deskId); if (!scope || !deskId) throw Error('Сначала открой стол');
      if (state.scope && state.scope !== scope && editorTabId != null) send({type: 'BC_PRESENCE_DISCONNECT', editorTabId}).catch(() => {});
      state.scope = scope; state.deskId = deskId;
      const key = THREAD_PREFIX + scope, values = await local.get(key); if (serial !== state.serial || state.disposed) return;
      state.meta = values[key] && typeof values[key] === 'object' && !Array.isArray(values[key]) ? values[key] : {};
      state.threads = (Array.isArray(state.meta.items) ? state.meta.items : []).filter(thread => thread && typeof thread.id === 'string');
      if (!state.threads.length) state.threads = [{id: 'main', name: 'Главный', kind: 'main', provider: 'gpt'}];
      state.thread = state.threads.some(thread => thread.id === state.meta.active) ? state.meta.active : state.threads[0].id;
      renderThreads(); await loadThread(serial);
    }
    async function saveThreads(scope, transform) {
      const key = THREAD_PREFIX + scope;
      const work = async () => {
        const values = await local.get(key), meta = values[key] && typeof values[key] === 'object' ? values[key] : {items: state.threads};
        const next = transform({...meta, items: Array.isArray(meta.items) ? meta.items : state.threads}); await local.set({[key]: next});
        if (scope === state.scope) { state.meta = next; state.threads = next.items.filter(thread => thread && typeof thread.id === 'string'); }
      };
      if (global.navigator?.locks?.request) await global.navigator.locks.request('osminog-core-threads:' + scope, work); else await work();
    }
    async function chooseThread(id) {
      if (id === state.thread || !state.threads.some(thread => thread.id === id)) return;
      stop(); state.proposal = null; renderProposal(); state.thread = id; const serial = ++state.serial, scope = state.scope;
      await saveThreads(scope, meta => ({...meta, active: id})); if (serial !== state.serial) return; renderThreads(); await loadThread(serial);
    }
    async function newThread() {
      stop(); const scope = state.scope, thread = {id: uuid(), name: 'Диалог ' + (state.threads.length + 1), provider: provider(), kind: 'agent'};
      await saveThreads(scope, meta => ({...meta, items: [...meta.items, thread], active: thread.id}));
      if (scope !== state.scope) return; state.thread = thread.id; const serial = ++state.serial; renderThreads(); await loadThread(serial);
    }
    async function changeProvider(value) {
      if (!PROVIDERS[value]) return; stop(); const scope = state.scope, id = state.thread;
      await saveThreads(scope, meta => ({...meta, items: meta.items.map(thread => thread.id === id ? {...thread, provider: value} : thread)})); renderThreads();
      status(PROVIDERS[value].name + ': нажми «Подключить».');
    }
    function stop(note = '') {
      const task = fence.cancel(); clearTimeout(streamTimer); streamTimer = 0;
      if (task) { task.node?.remove(); send({type: 'BC_CHAT_RESET', projectId: task.scope, threadId: task.thread}).catch(() => {}); }
      controls(); if (note) status(note);
    }
    async function permission(origins) {
      if (!origins.length) return;
      if (await chrome.permissions.contains({origins})) return;
      if (!await chrome.permissions.request({origins})) throw Error('Разрешение для выбранного ИИ не предоставлено');
    }
    async function routeConfig(selected) {
      if (selected === 'custom') {
        const result = await send({type: 'BC_PROVIDER_CUSTOM_GET'}); if (!result?.config?.baseUrl || !result.config.model) throw Error('Укажи адрес API и модель в разделе «Доступ»');
        const url = new URL(result.config.baseUrl); if (!['https:', 'http:'].includes(url.protocol)) throw Error('Неверный адрес API');
        return {apiKey: '', config: result.config, origins: [url.origin + '/*']};
      }
      const values = await local.get(PROVIDER_KEYS), key = String(values[PROVIDER_KEYS]?.[selected] || '');
      return {apiKey: key, origins: key && PROVIDERS[selected].api ? [PROVIDERS[selected].api] : PROVIDERS[selected].hosts.map(host => 'https://' + host + '/*')};
    }
    async function connect() {
      const selected = provider(), scope = state.scope, thread = state.thread; status('Подключаем ' + PROVIDERS[selected].name + '…');
      const route = await routeConfig(selected); await permission(route.origins);
      if (scope !== state.scope || thread !== state.thread) return;
      if (selected === 'custom' || route.apiKey) { status('API настроен. Проверка ответа выполняется при отправке сообщения.'); return; }
      if (selected === 'gpt') {
        const result = await send({type: 'BC_LITE_CONNECT_GPT', context: {project: {id: scope}, chat: {threadId: thread, historyEpoch: state.epoch}}});
        if (scope !== state.scope || thread !== state.thread) return;
        if (result?.ok && result.ready !== false) { state.transport = 'direct'; await local.set({osminogGptTransportV1: 'direct'}); status('ChatGPT: авторизованная сессия подключена.'); return; }
      }
      const session = await send({type: 'OSMINOG_SESSION_GET_OR_CREATE', provider: selected, url: PROVIDERS[selected].url, active: false, reuse: true, allowCreate: true});
      if (scope !== state.scope || thread !== state.thread) return;
      const tabId = session?.tabId || session?.session?.tabId; if (!session?.ok || !tabId) throw Error(session?.error || 'Не удалось открыть служебный чат');
      const result = await send({type: 'OSMINOG_SESSION_CONNECT', provider: selected, tabId});
      if (scope !== state.scope || thread !== state.thread) return;
      if (!result?.ok) {
        const tab = await chrome.tabs.update(tabId, {active: true});
        if (Number.isInteger(tab?.windowId)) await chrome.windows.update(tab.windowId, {focused: true});
        throw Error(result?.error || 'Войди в открывшийся чат и снова нажми «Подключить»');
      }
      if (selected === 'gpt') { state.transport = 'tab'; await local.set({osminogGptTransportV1: 'tab'}); }
      status(PROVIDERS[selected].name + ': служебный чат подключён.');
    }

    function stage(patch) {
      if (state.proposal) throw Error('Сначала примени или отклони уже предложенные изменения');
      state.proposal = {...patch, id: uuid()}; renderProposal();
      return {ok: true, staged: true, applied: false, proposalId: state.proposal.id, summary: patch.summary, actions: patch.actions.length,
        instruction: 'The change has not been applied. The user must press Apply in OSMINOG.'};
    }
    function renderProposal() {
      ui.proposal.replaceChildren(); ui.proposal.hidden = !state.proposal; if (!state.proposal) return;
      const patch = state.proposal; ui.proposal.append(node('strong', {}, patch.summary));
      const list = node('ul');
      for (const action of patch.actions) list.append(node('li', {}, action.op === 'create' ? 'Создать заметку: ' + clip(action.properties.text || action.properties.name, 100) :
        'Изменить ' + action.id + ': ' + Object.entries(action.properties).map(([key, value]) => key + ' = ' + clip(value, 100)).join(', ')));
      const actions = node('div', {class: 'core-chat-actions'});
      actions.append(button('Применить', applyProposal, {'data-core-chat-apply': ''}), button('Отклонить', () => { state.proposal = null; renderProposal(); }));
      ui.proposal.append(list, actions);
    }
    async function applyProposal() {
      const patch = state.proposal; if (!patch) return;
      if (patch.deskId !== state.deskId || patch.scope !== state.scope || patch.revision !== (api.revision?.() || 0)) throw Error('Стол изменился. Отклони предложение и запроси новое.');
      state.proposal = null; renderProposal(); let applied = 0;
      try {
        for (const action of patch.actions) {
          if (patch.deskId !== api.getDeskId() || patch.scope !== state.scope) throw Error('Стол переключён');
          if (action.op === 'create') await api.createItem(action.properties); else await api.patchItem(action.id, action.properties); applied++;
        }
        status('Применено изменений: ' + applied + '.');
      } catch (error) { throw Error('Применено ' + applied + ' из ' + patch.actions.length + '. ' + error.message); }
    }
    async function readImage(item, scope) {
      if (item.type !== 'image' || !/^image\/(png|jpeg|webp|gif)$/.test(item.mime || '')) return {ok: true, object: objectPreview(item), imageAttached: false, note: 'Двоичный файл открывается на холсте'};
      if (item.size > 8 * 1024 * 1024) throw Error('Для отправки ИИ изображение должно быть не больше 8 МБ');
      const blob = await api.getBlob(item.assetId); tools.assert(scope);
      if (!(blob instanceof Blob) || blob.size > 8 * 1024 * 1024) throw Error('Изображение недоступно или больше 8 МБ');
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
      tools.assert(scope); return {ok: true, object: objectPreview(item), imageAttached: true, imageDataUrl: dataUrl};
    }
    const tools = createTools({api, history, current: () => state, stage, readImage});
    async function context(scope, {external = false, compact = false} = {}) {
      const statusResult = await tools.execute('canvas_status', {}, scope), names = allowedTools(scope.role).filter(name => !external || name !== 'chat_history_read');
      const page = external ? {rows: []} : await history.page(scope.scope, scope.thread, {epoch: scope.epoch}); tools.assert(scope);
      const result = {protocol: 'osminog.browser_presence/v1', project: statusResult.project, revision: statusResult.revision,
        counts: statusResult.counts, selectedIds: statusResult.selectedIds, view: statusResult.view,
        execution: executionContract(scope.role, external),
        toolLease: {protocol: 'osminog.tool_lease/v1', fresh: true, tools: names, renewEveryPrompt: true},
        capabilities: {tools: names, role: scope.role, imageGeneration: false, browserAutomation: false,
          toolContract: {transport: 'osminog.request/v1', example: {protocol: 'osminog.request/v1', calls: [{tool: 'read_object_text', args: {id: 'existing-id'}}]},
            writes: 'propose_canvas_patch: create text notes or set text/name/x/y/w/h only. All proposals require the user to press Apply. Never claim applied before that.'}},
        policy: {currentProjectOnly: true, conversationMirroring: false, neverInventExistingIds: true, fullBodiesOnRequest: true, neverClaimEditWithoutToolResult: true},
        intent: {execution: 'chat', imageGeneration: false}, contextPolicy: {preload: false, automaticImages: false}};
      if (!external) result.chat = {threadId: scope.thread, historyEpoch: scope.epoch, provider: scope.provider,
        name: activeThread().name, kind: activeThread().kind || 'main', conversation: conversationOf(page.rows),
        instruction: 'Only tools in the fresh toolLease exist. Do not run browser/source/document/image-generation tools. Read exact text on request. A staged patch is not an applied edit.'};
      if (!compact) result.projectMap = await tools.execute('get_project_map', {limit: 40}, scope);
      tools.assert(scope); return result;
    }
    async function persistMessage(scope, message) {
      const row = await history.append(scope.scope, scope.thread, message); channel?.postMessage({scope: scope.scope, thread: scope.thread}); return row;
    }
    async function sendPrompt(raw) {
      const text = String(raw || '').trim(); if (!text || fence.active || state.loading) return;
      const task = fence.begin(snapshot({provider: provider(), streamToken: uuid(), requestId: uuid(), node: null})); task.assert = () => requireTask(task); controls();
      try {
        const route = await routeConfig(task.provider); requireTask(task); await permission(route.origins); requireTask(task);
        await persistMessage(task, {id: uuid(), role: 'user', text, at: Math.max(now(), task.epoch + 1), provider: task.provider}); requireTask(task);
        ui.input.value = ''; await loadPage(null); requireTask(task);
        task.node = messageNode({id: 'response-' + task.requestId, role: 'assistant', provider: task.provider, text: '', attachments: [], attachmentCount: 0});
        task.textNode = task.node.querySelector('.core-chat-message-text'); task.textNode.textContent = '…';
        // Include the streaming row in the same forty-node budget.
        while (ui.messages.querySelectorAll('.core-chat-message').length >= PAGE_SIZE) ui.messages.querySelector('.core-chat-message').remove();
        ui.messages.append(task.node); status(PROVIDERS[task.provider].name + ' отвечает…');
        let result = null, outgoing = text, requestId = task.requestId, final = null;
        for (let hop = 0; hop < 6; hop++) {
          requireTask(task); const ctx = await context(task); requireTask(task);
          const direct = task.provider === 'gpt' && state.transport === 'direct';
          const type = direct ? result ? 'BC_LITE_TOOL_RESULT' : 'BC_LITE_SEND_INTERNAL' : result ? 'BC_PROVIDER_TOOL_RESULT' : 'BC_PROVIDER_SEND';
          const reply = await send({type, payload: {provider: task.provider, text: outgoing, context: ctx, requestId,
            apiKey: route.apiKey, streamToken: task.streamToken, ...(result ? {result: {calls: result.calls}, imageDataUrl: result.imageDataUrl} : {})}});
          requireTask(task); if (!reply?.ok) throw Error(reply?.error || 'ИИ не вернул ответ');
          const payload = reply.payload || {}; requestId = reply.requestId || payload.requestId || requestId;
          if (payload.patch?.actions?.length) {
            const staged = await tools.execute('propose_canvas_patch', payload.patch, task); requireTask(task);
            status(staged.staged ? 'Изменения ждут кнопки «Применить».' : 'Предложение проверено.');
          }
          const calls = payload.request?.calls;
          if (!Array.isArray(calls) || !calls.length) { final = payload; break; }
          if (calls.length > 8) throw Error('ИИ запросил слишком много действий за один шаг');
          result = {calls: [], imageDataUrl: ''};
          for (const call of calls) {
            requireTask(task); let value;
            try { value = await tools.execute(String(call.tool || ''), call.args || {}, task); }
            catch (error) { requireTask(task); value = {ok: false, error: error.message}; }
            requireTask(task);
            if (value.imageDataUrl) { if (!result.imageDataUrl) result.imageDataUrl = value.imageDataUrl; delete value.imageDataUrl; }
            result.calls.push({tool: call.tool, result: value});
          }
          outgoing = ''; task.textNode.textContent = 'Проверяем данные холста…';
        }
        requireTask(task); if (!final) throw Error('Достигнут лимит шести шагов. Уточни запрос, чтобы продолжить.');
        clearTimeout(streamTimer); streamTimer = 0;
        const finalBody = {id: uuid(), role: 'assistant', text: String(final.text || (state.proposal ? 'Предложенные изменения ждут подтверждения на холсте.' : 'Ответ получен без текста.')),
          at: Math.max(now(), task.epoch + 1), provider: task.provider, author: PROVIDERS[task.provider].name};
        // Retain returned attachment metadata/bytes without rendering or adding generated media to the canvas.
        if (Array.isArray(final.media) && final.media.length) finalBody.attachments = final.media;
        await persistMessage(task, finalBody); requireTask(task); task.node.remove(); fence.finish(task); await loadPage(null);
        status(state.proposal ? 'Изменения ждут кнопки «Применить».' : 'Ответ сохранён.');
      } catch (error) {
        if (!current(task)) return; task.node?.remove(); status(error.message, true);
      } finally { if (fence.active === task) fence.finish(task); clearTimeout(streamTimer); streamTimer = 0; controls(); }
    }

    function updateOwner() {
      const element = accessRoot.querySelector('[data-core-owner-status]');
      if (element) element.textContent = global.OSMINOGOwnerGuard?.isUnlocked?.() ? 'Владелец подтверждён в этой вкладке.' : 'Владелец не подтверждён в этой вкладке.';
    }
    async function openAccess() {
      const scope = state.scope; accessRoot.replaceChildren();
      const internal = node('section', {class: 'core-access-section'}); internal.append(node('h3', {}, 'ИИ в правом чате'));
      const internalProvider = select(providerOptions, 'ИИ для настроек'); internalProvider.value = provider();
      const key = node('input', {type: 'password', autocomplete: 'off', placeholder: 'API key', 'aria-label': 'API key'});
      const base = node('input', {type: 'url', placeholder: 'https://…/v1', 'aria-label': 'Адрес API'});
      const model = node('input', {placeholder: 'Модель', 'aria-label': 'Модель API'}), configState = node('p', {class: 'core-access-note'});
      const fields = node('div', {class: 'core-access-fields'}); fields.append(base, model, key);
      async function loadConfig() {
        const selected = internalProvider.value; base.hidden = model.hidden = selected !== 'custom';
        key.hidden = selected === 'gpt' || selected === 'googleai'; key.value = ''; base.value = ''; model.value = '';
        configState.textContent = selected === 'gpt' ? 'Используется авторизованная сессия ChatGPT. Подключение запускается в правом чате.' : 'Без API-ключа кнопка «Подключить» использует служебный чат провайдера.';
        if (selected === 'custom') {
          const result = await send({type: 'BC_PROVIDER_CUSTOM_GET'}); if (!internalProvider.isConnected || internalProvider.value !== selected) return;
          base.value = result?.config?.baseUrl || ''; model.value = result?.config?.model || ''; key.value = result?.config?.apiKey || ''; configState.textContent = 'Совместимый с OpenAI API. Адрес, модель и ключ сохраняются на устройстве.';
        } else if (!key.hidden) {
          const values = await local.get(PROVIDER_KEYS); if (internalProvider.isConnected && internalProvider.value === selected) key.value = values[PROVIDER_KEYS]?.[selected] || '';
        }
      }
      const save = button('Сохранить настройки', async () => {
        const selected = internalProvider.value;
        if (selected === 'custom') {
          const result = await send({type: 'BC_PROVIDER_CUSTOM_GET'}), config = {...result?.config, baseUrl: base.value.trim(), model: model.value.trim(), apiKey: key.value.trim()};
          const address = new URL(config.baseUrl); if (address.protocol !== 'https:' && !(address.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname))) throw Error('Используй HTTPS или локальный API');
          if (!config.model) throw Error('Укажи модель'); const saved = await send({type: 'BC_PROVIDER_CUSTOM_SAVE', config}); if (!saved?.ok) throw Error(saved?.error || 'Настройки не сохранены');
        } else if (!key.hidden) {
          const values = await local.get(PROVIDER_KEYS); await local.set({[PROVIDER_KEYS]: {...values[PROVIDER_KEYS], [selected]: key.value.trim()}});
        }
        configState.textContent = 'Настройки сохранены. Для отправки выбери этого ИИ в правом чате.';
      });
      internal.append(internalProvider, fields, save, configState); internalProvider.addEventListener('change', () => loadConfig().catch(error => { configState.textContent = error.message; }));

      const external = node('section', {class: 'core-access-section'}); external.append(node('h3', {}, 'Холст в открытом чате'));
      external.append(node('p', {class: 'core-access-note'}, 'Выбранный оригинальный чат получает доступ только к текущему столу. Его переписка не копируется в правую панель.'));
      const externalProvider = select(providerOptions.filter(([name]) => name !== 'custom'), 'Провайдер открытого чата');
      const tabs = select([], 'Открытая вкладка чата'), role = select([['view', 'Просмотр'], ['comment', 'Просмотр и обсуждение'], ['edit', 'Предложения изменений']], 'Права доступа');
      const externalState = node('p', {class: 'core-access-note', role: 'status', 'data-core-access-status': ''});
      externalProvider.dataset.coreAccessProvider = ''; tabs.dataset.coreAccessTab = ''; role.dataset.coreAccessRole = '';
      async function refreshTabs() {
        const selected = externalProvider.value, list = await chrome.tabs.query({}); if (!tabs.isConnected || selected !== externalProvider.value) return;
        const matched = list.filter(tab => { try { const url = new URL(tab.url); return url.protocol === 'https:' && PROVIDERS[selected].hosts.includes(url.hostname); } catch { return false; } });
        tabs.replaceChildren(...matched.map(tab => node('option', {value: String(tab.id)}, clip(tab.title || tab.url, 100))));
        if (!matched.length) tabs.append(node('option', {value: ''}, 'Сначала открой нужный чат'));
      }
      const attach = button('Подключить холст', async () => {
        if (scope !== state.scope) throw Error('Стол изменился. Открой «Доступ» заново.');
        const selected = externalProvider.value, tabId = Number(tabs.value); if (!tabId) throw Error('Выбери открытую вкладку чата');
        const tab = await chrome.tabs.get(tabId), url = new URL(tab.url); if (!PROVIDERS[selected].hosts.includes(url.hostname)) throw Error('Вкладка изменилась');
        await permission([url.origin + '/*']); if (scope !== state.scope) throw Error('Стол изменился');
        editorTabId = (await chrome.tabs.getCurrent())?.id; if (editorTabId == null) throw Error('Не найдена вкладка OSMINOG');
        const result = await send({type: 'BC_PRESENCE_CONNECT', editorTabId, projectId: scope, provider: selected, role: role.value, tabId});
        if (scope !== state.scope) { await send({type: 'BC_PRESENCE_DISCONNECT', editorTabId, tabId}); throw Error('Стол изменился; подключение отменено'); }
        if (!result?.ok) throw Error(result?.error || 'Не удалось подключить холст');
        grants.set(result.connectionId, {scope, deskId: state.deskId, role: result.role, tabId: result.tabId});
        externalState.textContent = 'Подключён: ' + (result.title || PROVIDERS[selected].name) + '. Права: ' + role.options[role.selectedIndex].textContent + '.';
      }, {'data-core-access-connect': ''});
      const detach = button('Отключить холст', async () => {
        if (editorTabId == null) editorTabId = (await chrome.tabs.getCurrent())?.id;
        if (editorTabId != null) await send({type: 'BC_PRESENCE_DISCONNECT', editorTabId}); grants.clear(); externalState.textContent = 'Доступ открытых чатов к холсту отключён.';
      }, {'data-core-access-disconnect': ''});
      externalProvider.addEventListener('change', () => refreshTabs().catch(error => { externalState.textContent = error.message; }));
      const externalActions = node('div', {class: 'core-access-actions'}); externalActions.append(attach, detach, button('Обновить вкладки', refreshTabs));
      external.append(externalProvider, tabs, role, externalActions, externalState);

      const owner = node('section', {class: 'core-access-section'}); owner.append(node('h3', {}, 'Owner Authenticator'));
      owner.append(node('p', {class: 'core-access-note'}, 'Подтверждение владельца действует в этой вкладке. Доступ ИИ ограничен инструментами текущего холста.'));
      owner.append(node('p', {class: 'core-access-note', 'data-core-owner-status': ''}));
      const ownerActions = node('div', {class: 'core-access-actions'});
      const ownerButton = button('Подтвердить владельца', async () => {
        if (!global.OSMINOGOwnerGuard?.require) throw Error('Owner Authenticator не загружен');
        // A native modal dialog otherwise makes the unchanged body-level owner gate inert.
        const dialog = accessRoot.closest('dialog'), reopen = !!dialog?.open;
        if (reopen) dialog.close();
        try { await global.OSMINOGOwnerGuard.require('owner-access'); }
        finally {
          updateOwner();
          if (reopen && !state.disposed && accessRoot.isConnected) { if (!dialog.open) dialog.showModal(); ownerButton.focus(); }
        }
      }, {'data-core-owner-unlock': ''});
      ownerActions.append(ownerButton, button('Заблокировать', () => { global.OSMINOGOwnerGuard?.lock?.(); updateOwner(); })); owner.append(ownerActions);
      accessRoot.append(internal, external, owner); updateOwner(); await Promise.all([loadConfig(), refreshTabs()]);
      if (state.disposed || scope !== state.scope) return;
      editorTabId = (await chrome.tabs.getCurrent())?.id;
      if (editorTabId != null) {
        const result = await send({type: 'BC_PRESENCE_STATUS', editorTabId, projectId: scope});
        if (scope !== state.scope) return;
        // Restoring a router-held grant is read-only; no new connection or transcript sync is created.
        for (const connection of result?.connections || []) if (connection.projectId === scope && ['view', 'comment', 'edit'].includes(connection.role))
          grants.set(connection.connectionId, {scope, deskId: state.deskId, role: connection.role, tabId: connection.tabId});
        externalState.textContent = grants.size ? 'Подключений к текущему столу: ' + grants.size + '.' : 'Открытые чаты сейчас не подключены к этому столу.';
      }
    }

    async function presenceOperation(message) {
      const grant = grants.get(message.connectionId);
      if (!grant || grant.scope !== state.scope || grant.deskId !== state.deskId || message.projectId !== grant.scope) throw Error('Подключение относится к другому столу. Подключи холст заново.');
      const scope = snapshot({role: grant.role, external: true, thread: null,
        assert() { if (grants.get(message.connectionId) !== grant) throw Error('Доступ к холсту отключён'); }});
      if (message.operation === 'status') return {ok: true};
      if (message.operation === 'context') return {ok: true, context: await context(scope, {external: true, compact: message.compact === true})};
      if (message.operation !== 'tools') throw Error('Автоматический импорт медиа отключён в облегчённом холсте');
      if (!Array.isArray(message.calls) || message.calls.length > 8 || !message.calls.length) throw Error('Допускается от 1 до 8 вызовов');
      const calls = []; let imageDataUrl = '';
      for (const call of message.calls) {
        tools.assert(scope); let result;
        try { result = await tools.execute(String(call.tool || ''), call.args || {}, scope); }
        catch (error) { tools.assert(scope); result = {ok: false, error: error.message}; }
        tools.assert(scope); if (result.imageDataUrl) { if (!imageDataUrl) imageDataUrl = result.imageDataUrl; delete result.imageDataUrl; }
        calls.push({tool: call.tool, result});
      }
      return {ok: true, result: {calls}, imageDataUrl};
    }
    function runtimeListener(message, sender, reply) {
      if (sender?.id !== chrome.runtime.id || sender.tab) return;
      if (message?.type === 'BC_CHAT_STREAM') {
        const task = fence.active;
        if (!current(task) || message.projectId !== task.scope || message.threadId !== task.thread || message.streamToken !== task.streamToken || !task.textNode) return;
        task.stream = clip(message.text, PREVIEW_CHARS).split(/```(?:json|osminog)|\{"protocol"\s*:/)[0];
        if (!streamTimer) streamTimer = setTimeout(() => { streamTimer = 0; if (current(task) && task.textNode) task.textNode.textContent = task.stream || '…'; }, 80);
        return;
      }
      if (message?.type !== 'BC_PRESENCE_CANVAS' || message.editorTabId !== editorTabId) return;
      presenceOperation(message).then(reply, error => reply({ok: false, error: error.message})); return true;
    }
    function storageListener(changes, area) {
      if (area !== 'local' || state.disposed) return;
      const key = CLEAR_PREFIX + state.scope + ':' + state.thread;
      if (changes[key]) { stop(); state.epoch = Math.max(0, finite(changes[key].newValue?.at)); loadPage(null).catch(error => status(error.message, true)); }
    }
    chrome.runtime.onMessage.addListener(runtimeListener); chrome.storage.onChanged.addListener(storageListener);
    document.addEventListener('osminog:owner-unlocked', updateOwner);
    if (global.BroadcastChannel) {
      channel = new global.BroadcastChannel(DB_NAME);
      channel.onmessage = event => { if (event.data?.scope === state.scope && event.data?.thread === state.thread && !fence.active && !state.loading)
        loadPage(state.before).catch(error => status(error.message, true)); };
    }
    return {refreshDesk, openAccess, sendPrompt, async dispose() {
      if (state.disposed) return; stop(); state.disposed = true; ++state.serial; ++requestSerial; grants.clear(); channel?.close();
      chrome.runtime.onMessage.removeListener(runtimeListener); chrome.storage.onChanged.removeListener(storageListener);
      document.removeEventListener('osminog:owner-unlocked', updateOwner); await history.close();
    }, diagnostics() { return {scope: state.scope, thread: state.thread, historyPage: state.rows.length, renderedMessages: ui.messages.querySelectorAll('.core-chat-message').length,
      pendingRequest: !!fence.active, backgroundPolling: false, loaded: !state.loading}; }};
  }
  let application;
  const exported = {DB_NAME, PAGE_SIZE, PREVIEW_CHARS, previewOf, conversationOf, objectPreview, normalizedPatch,
    allowedTools, executionContract, createHistory, createTools, createTaskFence, createApplication,
    async init(options) { await application?.dispose(); application = createApplication(options); await application.refreshDesk(); return application; },
    refreshDesk: () => application?.refreshDesk(), openAccess: () => application?.openAccess(), dispose: () => application?.dispose(), diagnostics: () => application?.diagnostics()};
  global.OSMINOGCoreChat = exported;
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
})(globalThis);
