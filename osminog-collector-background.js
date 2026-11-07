/* Collector lifecycle and small status records. No workspace reads, media
 * payload messages, or full-image hashes on the unchanged clipboard path. */
(() => {
  'use strict';
  const KEY = 'osminogCollectorV1';
  const url = chrome.runtime.getURL('collector.html'), editorURL = chrome.runtime.getURL('editor.html');
  let serial = Promise.resolve(), lifecycleSerial = Promise.resolve();
  const enqueue = work => (serial = serial.catch(() => {}).then(work));
  const config = async () => (await chrome.storage.local.get(KEY))[KEY] || {};
  const isEditor = sender => sender.url?.split(/[?#]/)[0] === editorURL;
  const isCollector = sender => sender.url === url;

  async function status() {
    const values = await chrome.storage.local.get([KEY, 'osminogToday']);
    return {...values[KEY], todayBase: values.osminogToday || null};
  }
  async function notifyConfiguration() {
    const settings = await status();
    await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_CONFIG', config: settings}).catch(() => {});
  }
  function lifecycle() {
    lifecycleSerial = lifecycleSerial.catch(() => {}).then(async () => {
      const cfg = await config();
      if (!chrome.offscreen) {
        if (cfg.enabled) throw Error('Эта версия Chrome не поддерживает фоновый сбор буфера');
        return;
      }
      const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url]});
      if (cfg.enabled && !contexts.length) await chrome.offscreen.createDocument({
        url: 'collector.html', reasons: ['CLIPBOARD', 'BLOBS'],
        justification: 'Save clipboard files and text locally to the selected OSMINOG desk, including with the editor closed'
      });
      // A paused document has no timer or clipboard reads. Let an already read
      // batch finish its durable writes instead of destroying it mid-file.
      if (cfg.enabled || contexts.length) await notifyConfiguration();
    });
    return lifecycleSerial;
  }
  async function setError(message) {
    const cfg = await config(), error = String(message || '').slice(0, 240);
    if (cfg.error !== error) await chrome.storage.local.set({[KEY]: {...cfg, error}});
  }
  async function configure(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Некорректные настройки сбора');
    const cfg = await config(), next = {...cfg};
    for (const key of ['followDesk', 'enabled']) if (key in patch) next[key] = patch[key] === true;
    if ('projectId' in patch) next.projectId = String(patch.projectId || '');
    if ('folderId' in patch) next.folderId = patch.folderId ? String(patch.folderId) : null;
    if (next.enabled && !next.projectId) throw Error('Сначала выберите стол для сохранения');
    if (patch.lastHash === '') next.lastHash = '';
    next.error = '';
    await chrome.storage.local.set({[KEY]: next});
    try { await lifecycle(); }
    catch (error) { await setError(error.message); throw error; }
    return {ok: true, config: await config()};
  }
  async function committed(message) {
    const saved = await OSMINOGCaptureStore.getMetadata(String(message.id || ''));
    // The editor can acknowledge the queue before this small notification is
    // delivered. The daily counter is still the one committed with the body.
    const at = Number(saved?.at || message.at), counter = await OSMINOGCaptureStore.today(at);
    if (!Number.isFinite(at) || !counter) throw Error('Сохранение материала не подтверждено');
    const cfg = await config();
    await chrome.storage.local.set({[KEY]: {...cfg, lastCapture: Math.max(Number(cfg.lastCapture) || 0, at),
      lastHash: saved?.hash || message.hash || cfg.lastHash || '', lastKind: saved?.kind || message.kind || cfg.lastKind || '', error: ''},
      osminogToday: counter});
    return {ok: true, id: message.id};
  }
  async function acceptLegacy(message) {
    if (!['text', 'image', 'file'].includes(message.kind)) return {ok: false, retryable: false, error: 'Неподдерживаемый материал в буфере'};
    const kind = message.kind, value = String(message.value || '');
    if (!value || value.length > 45000000) return {ok: false, retryable: false, error: 'Материал из буфера слишком большой'};
    const blob = kind === 'text' ? new Blob([value], {type: 'text/plain'}) : OSMINOGCaptureStore.fromDataURL(value);
    const hash = await OSMINOGCaptureStore.hash(blob), cfg = await config();
    if (!cfg.enabled || !cfg.projectId) return {ok: false, error: 'Сбор выключен'};
    if (message.ignore) {
      await chrome.storage.local.set({[KEY]: {...cfg, lastHash: hash, lastKind: kind}});
      await chrome.runtime.sendMessage({type: 'OSMINOG_COLLECTOR_IGNORED', kind, hash}).catch(() => {});
      return {ok: true};
    }
    if (cfg.lastHash === hash && (!cfg.lastKind || cfg.lastKind === kind)) return {ok: true, duplicate: true};
    const settings = await status();
    const result = await OSMINOGCaptureStore.put({id: message.id || crypto.randomUUID(), kind,
      ...(kind === 'text' ? {value} : {blob}), fileName: message.fileName || '', hash,
      projectId: cfg.projectId, folderId: cfg.folderId, todayBase: settings.todayBase});
    await committed(result.entry);
    return {ok: true, id: result.entry.id, duplicate: result.duplicate};
  }
  chrome.runtime.onMessage.addListener((raw, sender, reply) => {
    if (!raw || sender.id !== chrome.runtime.id || typeof raw.type !== 'string') return;
    const message = {...raw, type: raw.type.replace(/^BC_COLLECTOR_/, 'OSMINOG_COLLECTOR_')};
    let task;
    if (message.type === 'OSMINOG_COLLECTOR_STATUS') task = status();
    else if (message.type === 'OSMINOG_COLLECTOR_CONFIGURE' && isEditor(sender)) task = enqueue(() => configure(message.patch));
    else if (message.type === 'OSMINOG_COLLECTOR_CAPTURE' && isCollector(sender)) task = enqueue(() => acceptLegacy(message));
    else if (message.type === 'OSMINOG_COLLECTOR_COMMITTED' && isCollector(sender)) task = enqueue(() => committed(message));
    else if (message.type === 'OSMINOG_COLLECTOR_IGNORE' && isEditor(sender)) task = enqueue(() => acceptLegacy({...message, ignore: true}));
    else if (message.type === 'OSMINOG_COLLECTOR_ERROR' && isCollector(sender)) task = enqueue(async () => { await setError(message.error); return {ok: true}; });
    else if (message.type === 'OSMINOG_COLLECTOR_START' && isEditor(sender)) task = lifecycle().then(() => ({ok: true}));
    if (!task) return;
    task.then(reply, error => reply({ok: false, retryable: error.retryable !== false, error: String(error.message || error)}));
    return true;
  });
  const resume = () => lifecycle().catch(error => enqueue(() => setError(error.message)).catch(console.error));
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    if (changes[KEY].oldValue?.enabled !== changes[KEY].newValue?.enabled) resume();
    else notifyConfiguration().catch(() => {});
  });
  chrome.runtime.onStartup.addListener(resume);
  resume();
})();
