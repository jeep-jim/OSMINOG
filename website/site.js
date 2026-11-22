/* Theme stays on this device. This page makes no analytics requests. */
(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'mouse.black.theme';
  let theme = 'dark';
  try {
    if (localStorage.getItem(storageKey) === 'light') theme = 'light';
  } catch (_) {
    // Browsing and theme switching still work with storage disabled.
  }
  root.dataset.theme = theme;

  const setTheme = (nextTheme) => {
    theme = nextTheme === 'light' ? 'light' : 'dark';
    root.dataset.theme = theme;
    const light = theme === 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = light ? '#ffffff' : '#000000';
    const button = document.getElementById('theme-switch');
    if (button) {
      button.setAttribute('aria-pressed', String(light));
      button.setAttribute('aria-label', light ? 'Включить тёмную тему' : 'Включить светлую тему');
      button.querySelector('.theme-label').textContent = light ? 'Выключить свет' : 'Включить свет';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-switch');
    button.hidden = false;
    setTheme(theme);
    button.addEventListener('click', () => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(storageKey, theme); } catch (_) { /* Optional preference. */ }
    });

    const details = document.querySelector('.install-details');
    document.addEventListener('click', (event) => {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && details.open) {
        details.open = false;
        details.querySelector('summary').focus();
      }
    });
  }, { once: true });
})();
