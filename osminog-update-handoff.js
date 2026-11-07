/* A normal, extension-independent tab keeps the browser open during runtime.reload.
 * Only this temporary tab may be removed, and only after the new editor is ready. */
(() => {
  'use strict';
  if (globalThis.OSMINOGUpdateHandoff) return;
  const KEY = 'briefCraftReopenAfterUpdateV1';
  const version = value => /^\d+(?:\.\d+){0,3}$/.test(String(value || ''));
  function compare(a, b) {
    const left = String(a).split('.').map(Number), right = String(b).split('.').map(Number);
    for (let i = 0; i < 4; i++) {
      const difference = (left[i] || 0) - (right[i] || 0);
      if (difference) return Math.sign(difference);
    }
    return 0;
  }
  async function installedManifest() {
    const response = await fetch(chrome.runtime.getURL('manifest.json'), {cache: 'no-store'});
    if (!response.ok) throw new Error('Не удалось проверить установленную версию OSMINOG.');
    const installed = await response.json(), running = chrome.runtime.getManifest();
    if (installed.name !== 'OSMINOG' || !installed.key || installed.key !== running.key || !version(installed.version)) {
      throw new Error('Проверка установленного OSMINOG не пройдена. Перезапуск отменён.');
    }
    return installed;
  }
  async function guardTab(request) {
    if (!Number.isInteger(request?.guardTabId) || !Number.isInteger(request?.guardWindowId)) return null;
    try {
      const tab = await chrome.tabs.get(request.guardTabId);
      return tab.windowId === request.guardWindowId && tab.url === 'about:blank' &&
        (!tab.pendingUrl || tab.pendingUrl === 'about:blank') ? tab : null;
    } catch { return null; }
  }
  async function releaseGuard(request, readyTabId) {
    const tab = await guardTab(request);
    if (!tab || tab.id === readyTabId) return;
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
  let preparing = null;
  function prepare({from, to} = {}) {
    if (preparing) return preparing;
    const operation = async () => {
      const running = chrome.runtime.getManifest();
      if (from !== running.version || !version(to) || compare(to, from) <= 0) {
        throw new Error('Версия для перезапуска не совпадает с установленным обновлением.');
      }
      const installed = await installedManifest();
      if (installed.version !== to) throw new Error('Файлы обновления не готовы. Перезапуск отменён.');
      const previous = (await chrome.storage.local.get(KEY))[KEY];
      let guard = previous?.from === from && previous?.to === to ? await guardTab(previous) : null;
      const age = previous ? Date.now() - Number(previous.at) : Infinity;
      if (guard && Number.isFinite(age) && age >= 0 && age < 300000) return {ok: true, request: previous};
      let created = false;
      if (!guard) {
        const windows = await chrome.windows.getAll({windowTypes: ['normal']});
        const normal = windows.find(window => window.focused) || windows[0];
        if (normal) guard = await chrome.tabs.create({windowId: normal.id, url: 'about:blank', active: false});
        else {
          const window = await chrome.windows.create({url: 'about:blank', type: 'normal', focused: false});
          guard = window.tabs?.[0] || (await chrome.tabs.query({windowId: window.id}))[0];
        }
        created = true;
      }
      if (!Number.isInteger(guard?.id) || !Number.isInteger(guard?.windowId)) {
        throw new Error('Не удалось подготовить безопасный перезапуск расширения.');
      }
      const request = {
        at: Date.now(), url: 'editor.html', from, to, phase: 'ready-to-reload',
        requestId: crypto.randomUUID(), guardTabId: guard.id, guardWindowId: guard.windowId
      };
      try {
        await chrome.storage.local.set({[KEY]: request});
        const saved = (await chrome.storage.local.get(KEY))[KEY];
        if (saved?.requestId !== request.requestId) throw new Error('Не удалось сохранить состояние перезапуска.');
        return {ok: true, request};
      } catch (error) {
        if (created) await releaseGuard(request);
        throw error;
      }
    };
    const locks = globalThis.navigator?.locks;
    preparing = (locks?.request ? locks.request('osminog-update-handoff-v2', {mode: 'exclusive'}, operation) : operation())
      .finally(() => { preparing = null; });
    return preparing;
  }
  globalThis.OSMINOGUpdateHandoff = {prepare, installedManifest, releaseGuard, guardTab, compare};
})();
