/* Local manifesto and installation help. No accounts, telemetry or external requests. */
(() => {
  'use strict';
  const root = document.documentElement;
  let guide, manifesto, activePlatform = 'macos', returnTo = null, previousOverflow = '';
  const text = key => {
    const messages = window.MOUSE_I18N?.messages || {};
    return messages[root.lang]?.[key] || messages.en?.[key] || '';
  };
  const sourceAnchor = () => document.querySelector('.download[data-platform="' + activePlatform + '"]');
  function refreshDownload() {
    if (!guide) return;
    const source = sourceAnchor(), retry = guide.querySelector('[data-install-retry]');
    if (!source || !retry) return;
    const href = source.getAttribute('href');
    if (!/^\/downloads\/Mouse-Browser-\d+\.\d+\.\d+-(mac-arm64\.dmg|Windows-x64\.exe)$/.test(href || '')) return;
    const filename = guide.querySelector('[data-install-filename]');
    if (filename) filename.textContent = source.getAttribute('download') || href.split('/').pop();
  }
  function refreshLanguage() {
    document.querySelectorAll('[data-city-pause]').forEach(button => {
      const label = text(button.getAttribute('aria-pressed') === 'true' ? 'cityPlay' : 'cityPause');
      button.setAttribute('aria-label', label); button.title = label;
    });
    if (guide) {
      const key = activePlatform === 'macos' ? 'installMacTitle' : 'installWindowsTitle';
      const title = guide.querySelector('#install-title');
      if (title) title.textContent = text(key);
      refreshDownload();
    }
  }
  function show(dialog, opener) {
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    if (dialog.open) return true;
    const other = dialog === guide ? manifesto : guide;
    const switching = other?.open;
    if (switching) other.close();
    if (!switching) {
      returnTo = opener || document.activeElement;
      previousOverflow = document.body.style.overflow;
    }
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    dialog.querySelector('[data-modal-close]')?.focus({ preventScroll: true });
    return true;
  }
  function openGuide(platform, opener) {
    if (!['macos', 'windows'].includes(platform) || !guide) return false;
    const alreadyOpen = guide.open;
    activePlatform = platform;
    guide.querySelectorAll('[data-install-panel]').forEach(panel => {
      panel.hidden = panel.dataset.installPanel !== platform;
    });
    guide.querySelectorAll('[data-install-tab]').forEach(button => {
      const selected = button.dataset.installTab === platform;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    refreshLanguage();
    if (!alreadyOpen) show(guide, opener);
    return true;
  }
  function init() {
    guide = document.getElementById('install-guide');
    manifesto = document.getElementById('manifest-dialog');
    if (!guide || !manifesto) return;
    for (const dialog of [guide, manifesto]) {
      dialog.querySelectorAll('[data-modal-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
      });
      dialog.addEventListener('close', () => {
        const other = dialog === guide ? manifesto : guide;
        if (!other?.open) {
          document.body.style.overflow = previousOverflow;
          if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
        }
      });
    }
    document.querySelectorAll('[data-manifest-open]').forEach(button => button.addEventListener('click', () => show(manifesto, button)));
    document.querySelectorAll('[data-install-guide]').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      openGuide(button.dataset.installGuide, button);
    }));
    guide.querySelectorAll('[data-install-tab]').forEach(button => {
      button.addEventListener('click', () => openGuide(button.dataset.installTab));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'macos' : event.key === 'End' ? 'windows' : activePlatform === 'macos' ? 'windows' : 'macos';
        openGuide(next);
        guide.querySelector('[data-install-tab="' + next + '"]').focus();
      });
    });
    guide.querySelector('[data-install-retry]')?.addEventListener('click', event => {
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const anchor = sourceAnchor();
      if (anchor) { event.preventDefault(); anchor.click(); }
    });
    document.addEventListener('mouse:city-state', refreshLanguage);
    refreshLanguage();
  }
  window.MouseManifest = Object.freeze({ openGuide, refreshDownload, refreshLanguage });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
