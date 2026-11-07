/* Lifecycle and small status messages only. Clipboard bytes are committed in
 * the offscreen page's IndexedDB and never relayed through chrome.storage. */
(() => {
  'use strict';
  const KEY = 'osminogCollectorV1', url = chrome.runtime.getURL('collector.html');
  const editorURL = chrome.runtime.getURL('editor.html');
  const allowedLegacy = key => ['briefCraftStudioV2', 'briefCraftStudioV2Backup', 'osminogTrashIndex'].includes(key) ||
    /^(osminogItemEdit:|osminogCapture:|osminogTrashProject:)/.test(key);
  let lifecycleTask, configTask = Promise.resolve();
  const config = async () => (await chrome.storage.local.get(KEY))[KEY] || {};
  const isEditor = sender => sender.url?.split(/[?#]/)[0] === editorURL;
  const isCollector = sender => sender.url === url;
  const enqueue = work => (configTask = configTask.catch(() => {}).then(work));
  async function ensureOffscreen() {
    if (lifecycleTask) return lifecycleTask;
    lifecycleTask = (async () => {
      if (!chrome.offscreen) throw Error('Эта версия Chrome не поддерживает фоновый сбор буфера');
      const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url]});
      if (!contexts.length) await chrome.offscreen.createDocument({url: 'collector.html', reasons: ['CLIPBOARD', 'BLOBS'],
        justification: 'Save user-enabled clipboard captures locally as binary files and migrate existing OSMINOG materials without loading them in the editor'});
    })().finally(() => { lifecycleTask = null; });
    return lifecycleTask;
  }
  async function status() {
    const [stats, settings] = await Promise.all([OSMINOGCoreStore.stats(), config()]);
    return {ok: true, migration: stats.migration, stats, config: settings};
  }
  async function setError(message) {
    const cfg = await config(), error = String(message || '').slice(0, 240);
    if (cfg.error !== error) await chrome.storage.local.set({[KEY]: {...cfg, error}});
  }
  async function notifyConfiguration() {
    const cfg = await config();
    await chrome.runtime.sendMessage({type: 'OSMINOG_CORE_CAPTURE_CONFIG', config: cfg}).catch(() => {});
    return cfg;
  }
  async function configure(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Некорректные настройки сбора');
    const cfg = await config(), next = {...cfg};
    for (const key of ['enabled', 'followDesk']) if (key in patch) next[key] = patch[key] === true;
    if ('projectId' in patch) next.projectId = String(patch.projectId || '');
    if ('folderId' in patch) next.folderId = patch.folderId ? String(patch.folderId) : null;
    if (next.enabled && !next.projectId) throw Error('Сначала выберите стол для сохранения');
    if (next.projectId) {
      const desk = await OSMINOGCoreStore.getDesk(next.projectId);
      if (!desk || desk.deletedAt) throw Error('Стол для сохранения недоступен');
      if (next.folderId && !desk.folders?.some(folder => folder.id === next.folderId)) throw Error('Папка для сохранения недоступна');
    }
    next.error = '';
    await chrome.storage.local.set({[KEY]: next});
    if (next.enabled) await ensureOffscreen();
    await notifyConfiguration();
    return {ok: true, config: next};
  }
  async function finishMigration() {
    const cfg = await config(), available = await OSMINOGCoreStore.desks();
    const selected = available.find(desk => desk.id === cfg.projectId) || available[0];
    if (!selected) throw Error('Не удалось подготовить стол для материалов');
    const next = {...cfg, projectId: selected.id, folderId: selected.folders?.some(folder => folder.id === cfg.folderId) ? cfg.folderId : null,
      enabled: cfg.enabled !== false, error: ''};
    await chrome.storage.local.set({[KEY]: next});
    const stats = await OSMINOGCoreStore.stats();
    await chrome.storage.local.set({osminogToday: {day: new Date().toLocaleDateString('en-CA'), count: stats.today}});
    return {ok: true, config: next, migration: stats.migration};
  }
  async function committed(message) {
    const item = await OSMINOGCoreStore.getMetadata(String(message.id || ''));
    if (!item || item.deskId !== message.deskId || !item.captureId) throw Error('Сохранение материала не подтверждено');
    const cfg = await config(), stats = await OSMINOGCoreStore.stats();
    await chrome.storage.local.set({[KEY]: {...cfg, lastCapture: item.capturedAt, error: ''},
      osminogToday: {day: new Date().toLocaleDateString('en-CA'), count: stats.today}});
    return {ok: true, id: item.id};
  }
  chrome.runtime.onMessage.addListener((raw, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !raw || typeof raw.type !== 'string') return;
    const message = {...raw, type: raw.type.replace(/^BC_COLLECTOR_/, 'OSMINOG_COLLECTOR_')};
    let task;
    if (message.type === 'OSMINOG_CORE_INIT' && isEditor(sender)) task = ensureOffscreen().then(status);
    else if (message.type === 'OSMINOG_CORE_STATUS') task = status();
    else if (message.type === 'OSMINOG_COLLECTOR_STATUS') task = config();
    else if (message.type === 'OSMINOG_COLLECTOR_CONFIGURE' && isEditor(sender)) task = enqueue(() => configure(message.patch));
    else if (message.type === 'OSMINOG_COLLECTOR_START' && isEditor(sender)) task = ensureOffscreen().then(() => ({ok: true}));
    else if (message.type === 'OSMINOG_CORE_LEGACY_READ' && isCollector(sender)) {
      const keys = message.keys;
      task = Array.isArray(keys) && keys.length <= 3 && keys.every(key => typeof key === 'string' && allowedLegacy(key))
        ? chrome.storage.local.get(keys).then(values => OSMINOGCoreStore.stageLegacy(Object.fromEntries(keys.map(key => [key, values[key]])))).then(staged => ({ok: true, staged})) : Promise.reject(Error('Недопустимый источник переноса'));
    } else if (message.type === 'OSMINOG_CORE_LEGACY_KEYS' && isCollector(sender)) {
      task = chrome.storage.local.getKeys().then(keys => ({ok: true, keys: keys.filter(allowedLegacy)}));
    } else if (message.type === 'OSMINOG_CORE_MIGRATED' && isCollector(sender)) task = enqueue(finishMigration);
    else if (message.type === 'OSMINOG_CORE_CAPTURE_COMMITTED' && isCollector(sender)) task = enqueue(() => committed(message));
    else if (message.type === 'OSMINOG_COLLECTOR_ERROR' && isCollector(sender)) task = enqueue(async () => { await setError(message.error); return {ok: true}; });
    if (!task) return;
    task.then(reply, error => reply({ok: false, error: String(error.message || error)})); return true;
  });
  // A fresh profile waits for the first editor. Existing enabled installations
  // resume in the background, including when no OSMINOG tab is open.
  const resume = () => config().then(cfg => cfg.enabled === true ? ensureOffscreen() : null).catch(error => enqueue(() => setError(error.message)));
  chrome.runtime.onStartup.addListener(resume);
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) notifyConfiguration().catch(() => {});
  });
  resume();
})();
