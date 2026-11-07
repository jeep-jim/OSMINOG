/* A pending update is consumed only by the target version's ready editor. */
(() => {
  'use strict';
  const KEY = 'briefCraftReopenAfterUpdateV1', url = chrome.runtime.getURL('editor.html');
  const isEditor = value => typeof value === 'string' &&
    (value === url || value.startsWith(url + '?') || value.startsWith(url + '#'));
  let timer = null, running = null, target = null, attempts = 0;
  const schedule = (delay = 350) => {
    clearTimeout(timer);
    timer = setTimeout(() => restore().catch(error => console.warn('OSMINOG update recovery:', error.message)), delay);
  };
  async function pending() {
    const request = (await chrome.storage.local.get(KEY))[KEY];
    if (!request) return null;
    const age = Date.now() - Number(request.at);
    if (!Number.isFinite(age) || age < -60000 || age > 600000) {
      await chrome.storage.local.remove(KEY);
      return null;
    }
    // The old worker/editor still runs between disk commit and runtime.reload.
    if (request.to && request.to !== chrome.runtime.getManifest().version) return null;
    return request;
  }
  function restore() {
    if (running) return running;
    running = (async () => {
      const request = await pending();
      if (!request) { clearTimeout(timer); target = null; return; }
      if (attempts++ >= 6) return;
      try {
        const tabs = (await chrome.tabs.query({})).filter(tab => isEditor(tab.url));
        const existing = tabs.find(tab => tab.id === target) || tabs[0];
        if (existing) {
          if (target !== existing.id) {
            const tab = await chrome.tabs.update(existing.id, {url, active: true});
            target = tab.id;
          }
        } else {
          const guard = await globalThis.OSMINOGUpdateHandoff?.guardTab(request);
          const tab = await chrome.tabs.create({url, active: true, ...(guard ? {windowId: guard.windowId} : {})});
          target = tab.id;
        }
      } catch (error) {
        target = null;
        console.warn('OSMINOG editor reopen will retry:', error.message);
      }
      schedule(1500);
    })().finally(() => { running = null; });
    return running;
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== 'OSMINOG_EDITOR_READY' || sender.id !== chrome.runtime.id ||
        !isEditor(sender.url) || message.version !== chrome.runtime.getManifest().version ||
        !Number.isInteger(sender.tab?.id)) return;
    (async () => {
      const request = await pending();
      if (!request || (target !== null && sender.tab.id !== target)) return {ok: true, pending: !!request};
      const current = (await chrome.storage.local.get(KEY))[KEY];
      if (current?.at !== request.at || current?.requestId !== request.requestId) return {ok: false};
      await chrome.storage.local.remove(KEY);
      clearTimeout(timer);
      target = null;
      attempts = 0;
      await globalThis.OSMINOGUpdateHandoff?.releaseGuard(request, sender.tab.id);
      return {ok: true};
    })().then(reply, error => reply({ok: false, error: error.message}));
    return true;
  });
  chrome.runtime.onInstalled.addListener(() => { attempts = 0; schedule(); });
  chrome.runtime.onStartup.addListener(() => { attempts = 0; schedule(); });
  chrome.tabs.onRemoved?.addListener(id => {
    if (id === target) { target = null; schedule(350); }
  });
  schedule();
})();
