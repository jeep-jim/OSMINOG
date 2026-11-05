/* Capture is opt-in. Queue entries are immutable until acknowledged by an editor. */
(() => {
  'use strict';
  const KEY = 'osminogCollectorV1', PREFIX = 'osminogCapture:';
  const url = chrome.runtime.getURL('collector.html'), editorURL = chrome.runtime.getURL('editor.html');
  let serial = Promise.resolve(), lifecycleSerial = Promise.resolve();
  const enqueue = work => (serial = serial.catch(() => {}).then(work));
  const config = async () => (await chrome.storage.local.get(KEY))[KEY] || {};
  const isEditor = sender => sender.url === editorURL || sender.url?.startsWith(editorURL + '?') || sender.url?.startsWith(editorURL + '#');

  function lifecycle() {
    // A pause received while createDocument is pending must close the newly
    // created document too; racing create/close operations can otherwise leave
    // a collector running while the UI says it is paused.
    lifecycleSerial = lifecycleSerial.catch(() => {}).then(async () => {
      const cfg = await config();
      if (!chrome.offscreen) {
        if (cfg.enabled) throw Error('Эта версия Chrome не поддерживает фоновый сбор буфера');
        return;
      }
      const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url]});
      if (cfg.enabled && !contexts.length) {
        await chrome.offscreen.createDocument({
          url: 'collector.html', reasons: ['CLIPBOARD'],
          justification: 'User enabled saving clipboard text and screenshots to a selected OSMINOG desk or folder'
        });
      } else if (!cfg.enabled && contexts.length) {
        await chrome.offscreen.closeDocument();
      }
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
    if ('enabled' in patch) next.enabled = patch.enabled === true;
    if ('projectId' in patch) next.projectId = String(patch.projectId || '');
    if ('folderId' in patch) next.folderId = patch.folderId ? String(patch.folderId) : null;
    if (next.enabled && !next.projectId) throw Error('Сначала выберите стол для сохранения');
    if (patch.lastHash === '') next.lastHash = '';
    next.error = '';
    await chrome.storage.local.set({[KEY]: next});
    try {
      await lifecycle();
    } catch (error) {
      await setError(error.message);
      throw error;
    }
    return {ok: true, config: await config()};
  }

  async function accept(message) {
    const kind = message.kind;
    if (!['text', 'image'].includes(kind)) throw Error('Неподдерживаемый материал в буфере');
    const value = String(message.value || '');
    if (!value || value.length > 24000000) throw Error('Материал слишком большой (лимит 18 МБ)');
    if (kind === 'image' && !/^data:image\/(png|jpeg|webp|gif|bmp);base64,/i.test(value)) throw Error('Неподдерживаемое изображение в буфере');
    const bytes = new TextEncoder().encode(kind + '\n' + value);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    const cfg = await config();
    if (!cfg.enabled || !cfg.projectId) return {ok: false, error: 'Сбор выключен'};
    if (message.ignore) {
      await chrome.storage.local.set({[KEY]: {...cfg, lastHash: hash}});
      return {ok: true};
    }
    if (cfg.lastHash === hash) return {ok: true, duplicate: true};
    const id = crypto.randomUUID(), at = Date.now();
    await chrome.storage.local.set({
      [PREFIX + id]: {id, hash, at, kind, value, projectId: cfg.projectId, folderId: cfg.folderId || null},
      [KEY]: {...cfg, lastHash: hash, lastCapture: at, error: ''}
    });
    return {ok: true, id};
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (!message?.type?.startsWith('OSMINOG_COLLECTOR_') || sender.id !== chrome.runtime.id) return;
    let task;
    if (message.type === 'OSMINOG_COLLECTOR_STATUS') task = config();
    else if (message.type === 'OSMINOG_COLLECTOR_CONFIGURE' && isEditor(sender)) task = enqueue(() => configure(message.patch));
    else if (message.type === 'OSMINOG_COLLECTOR_CAPTURE' && sender.url === url) task = enqueue(() => accept(message));
    else if (message.type === 'OSMINOG_COLLECTOR_IGNORE' && isEditor(sender)) task = enqueue(() => accept({...message, ignore: true}));
    else if (message.type === 'OSMINOG_COLLECTOR_ERROR' && sender.url === url) task = enqueue(async () => {await setError(message.error); return {ok: true};});
    else if (message.type === 'OSMINOG_COLLECTOR_START') task = lifecycle().then(() => ({ok: true}));
    if (!task) return;
    task.then(reply, error => reply({ok: false, error: String(error.message || error)}));
    return true;
  });

  const resume = () => lifecycle().catch(error => enqueue(() => setError(error.message)).catch(console.error));
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes[KEY] && changes[KEY].oldValue?.enabled !== changes[KEY].newValue?.enabled) resume();
  });
  chrome.runtime.onStartup.addListener(resume);
  resume();
})();
