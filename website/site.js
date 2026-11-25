/* Preferences stay on this device. Download metadata comes only from this site. */
(() => {
  'use strict';
  const root = document.documentElement;
  // The tab icon follows the browser's preference, independently of the page switch.
  const favicon = document.getElementById('site-favicon');
  if (favicon && typeof window.matchMedia === 'function') {
    const browserTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const syncFavicon = () => {
      const path = browserTheme.matches ? '/favicon-dark.svg' : '/favicon.svg';
      favicon.setAttribute('href', path + '?v=20261123-3');
    };
    syncFavicon();
    if (browserTheme.addEventListener) browserTheme.addEventListener('change', syncFavicon);
    else browserTheme.addListener(syncFavicon);
  }
  const themeKey = 'mouse.black.theme';
  const languageKey = 'mouse.black.language';
  const i18n = window.MOUSE_I18N || { languages: [{ code: 'ru', name: 'Русский', dir: 'ltr' }], messages: {} };
  const languages = i18n.languages;
  const byCode = new Map(languages.map((item) => [item.code.toLowerCase(), item]));
  const readPreference = (key) => {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  };
  const savePreference = (key, value) => {
    try { localStorage.setItem(key, value); } catch (_) { /* Preferences are optional. */ }
  };
  const matchLanguage = (candidate) => {
    if (typeof candidate !== 'string') return null;
    const value = candidate.replace(/_/g, '-').toLowerCase();
    if (byCode.has(value)) return byCode.get(value).code;
    const base = value.split('-')[0];
    if (base === 'zh') return /hant|-(tw|hk|mo)(-|$)/.test(value) ? 'zh-Hant' : 'zh-Hans';
    if (base === 'pt') return value.startsWith('pt-br') ? 'pt-BR' : 'pt-PT';
    const aliases = { no: 'nb', nn: 'nb', tl: 'fil', iw: 'he', in: 'id' };
    const match = byCode.get(aliases[base] || base);
    return match ? match.code : null;
  };
  // A published language URL always renders the same language, including before JS.
  // Saved/browser preferences never silently replace its indexable HTML.
  const staticLanguage = matchLanguage(root.dataset.staticLanguage);
  let requestedLanguage = null;
  try {
    const parameter = new URLSearchParams(window.location.search).get('lang');
    const exact = parameter && byCode.get(parameter.replace(/_/g, '-').toLowerCase());
    requestedLanguage = exact ? exact.code : null;
  } catch (_) { /* The static page also works without URL parsing. */ }
  let language = staticLanguage || requestedLanguage || matchLanguage(readPreference(languageKey));
  if (!language) {
    for (const preferred of navigator.languages || [navigator.language || 'en']) {
      language = matchLanguage(preferred);
      if (language) break;
    }
  }
  language = language || (byCode.has('en') ? 'en' : 'ru');
  let theme = readPreference(themeKey) === 'light' ? 'light' : 'dark';
  root.dataset.theme = theme;
  root.lang = language;
  root.dir = (byCode.get(language.toLowerCase()) || {}).dir || 'ltr';

  const text = (key) => {
    const active = i18n.messages[language] || {};
    const fallback = i18n.messages.en || i18n.messages.ru || {};
    return active[key] || fallback[key] || '';
  };
  let languagePicker = null;
  const languageLabels = () => ({
    languageLabel: text('languageLabel'),
    languageSearch: text('languageSearch'),
    languageNoResults: text('languageNoResults'),
    languageClose: text('languageClose')
  });
  const fitHeadline = () => {
    const headline = document.getElementById('headline');
    if (!headline) return;
    headline.style.fontSize = '';
    const available = headline.clientWidth;
    const actual = headline.scrollWidth;
    if (available > 0 && actual > available) {
      const size = parseFloat(getComputedStyle(headline).fontSize);
      headline.style.fontSize = `${Math.floor(size * available / actual * 100) / 100}px`;
    }
  };
  const setTheme = (value) => {
    theme = value === 'light' ? 'light' : 'dark';
    root.dataset.theme = theme;
    const light = theme === 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = light ? '#ffffff' : '#1e1e1e';
    const button = document.getElementById('theme-switch');
    if (button) {
      const label = text(light ? 'themeDark' : 'themeLight') || (light ? 'Выключить свет' : 'Включить свет');
      button.setAttribute('aria-pressed', String(light));
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.querySelector('.theme-label').textContent = label;
    }
  };

  const platformInfo = {
    macos: { suffix: 'mac-arm64.dmg', key: 'mac', label: 'macOS' },
    windows: { suffix: 'Windows-x64.exe', key: 'windows', label: 'Windows' },
    linux: { suffix: 'Linux-x64.AppImage', key: 'linux', label: 'Linux' }
  };
  const versionParts = (value) => {
    if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) return null;
    const parts = value.split('.').map(Number);
    return parts.every(Number.isSafeInteger) ? parts : null;
  };
  const compareVersions = (left, right) => {
    const a = versionParts(left), b = versionParts(right);
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    return 0;
  };
  const validDownloads = (value) => {
    if (!value || value.schema !== 1 || !versionParts(value.version) || !Array.isArray(value.files) || value.files.length !== 3) return null;
    const found = new Map();
    for (const item of value.files) {
      if (!item || !Object.prototype.hasOwnProperty.call(platformInfo, item.platform) || found.has(item.platform) || !versionParts(item.version)) return null;
      const filename = 'Mouse-Browser-' + item.version + '-' + platformInfo[item.platform].suffix;
      if (item.filename !== filename || item.url !== '/downloads/' + filename ||
          !Number.isSafeInteger(item.size) || item.size <= 0 || item.size > 512 * 1024 * 1024 ||
          typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) return null;
      found.set(item.platform, { platform: item.platform, version: item.version, filename,
        url: item.url, size: item.size, sha256: item.sha256 });
    }
    const files = Object.keys(platformInfo).map((platform) => found.get(platform));
    const newest = files.reduce((latest, item) => compareVersions(item.version, latest) > 0 ? item.version : latest, files[0].version);
    return value.version === newest ? { schema: 1, version: newest, files } : null;
  };
  let currentDownloads = validDownloads(window.MOUSE_DOWNLOADS_CURRENT);
  const applyDownloadLabels = () => {
    if (!currentDownloads) return;
    const shared = new Set(currentDownloads.files.map((item) => item.version)).size === 1;
    for (const item of currentDownloads.files) {
      const info = platformInfo[item.platform];
      const anchor = document.querySelector('.download[data-platform="' + item.platform + '"]');
      if (!anchor) continue;
      const version = document.querySelector('[data-download-version="' + item.platform + '"]');
      if (version) version.textContent = 'v' + item.version;
      anchor.setAttribute('href', item.url);
      anchor.setAttribute('download', item.filename);
      const aria = text(info.key + 'AriaTemplate');
      if (aria.includes('{version}')) anchor.setAttribute('aria-label', aria.replace('{version}', item.version));
      const meta = anchor.querySelector('.download-meta');
      const base = text(info.key + 'MetaBase');
      if (meta && base) meta.textContent = base + (shared ? '' : ' · ' + item.version);
    }
    const footer = document.querySelector('[data-i18n="releaseLabel"]');
    if (footer) {
      const template = text('releaseTemplate');
      const label = shared && template.includes('{version}')
        ? template.replace('{version}', currentDownloads.version)
        : currentDownloads.files.map((item) => platformInfo[item.platform].label + ' ' + item.version).join(' · ');
      if (footer.textContent !== label) footer.textContent = label;
    }
    try { window.MouseDownloadStats?.update(currentDownloads); } catch (_) { /* Optional totals cannot block installer refresh. */ }
  };
  const acceptDownloads = (candidate) => {
    const next = validDownloads(candidate);
    if (!next) return false;
    if (currentDownloads) {
      for (const item of next.files) {
        const previous = currentDownloads.files.find((file) => file.platform === item.platform);
        const order = compareVersions(item.version, previous.version);
        // Old responses and changed bytes under an immutable version never replace a working link.
        if (order < 0 || (order === 0 && (item.filename !== previous.filename || item.size !== previous.size || item.sha256 !== previous.sha256))) return false;
      }
    }
    currentDownloads = next;
    applyDownloadLabels();
    return true;
  };
  let downloadsRequest = null;
  let downloadRequestNumber = 0;
  const refreshDownloads = () => {
    if (downloadsRequest) return downloadsRequest;
    // A script containing only our public JSON works with the site's existing
    // script-src 'self' policy; no cross-origin requests or connect-src allowance.
    downloadsRequest = new Promise((resolve) => {
      const script = document.createElement('script');
      let finished = false;
      let timeout;
      const finish = (loaded) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        script.onload = null;
        script.onerror = null;
        script.remove();
        if (loaded) acceptDownloads(window.MOUSE_DOWNLOADS_CURRENT);
        resolve();
      };
      script.async = true;
      script.src = '/downloads-current.js?v=' + Date.now() + '-' + (++downloadRequestNumber);
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      timeout = setTimeout(() => finish(false), 3500);
      document.head.appendChild(script);
    }).finally(() => { downloadsRequest = null; });
    return downloadsRequest;
  };

  const setLanguage = (value, updateLocation = false) => {
    language = matchLanguage(value) || language;
    const definition = byCode.get(language.toLowerCase());
    root.lang = language;
    root.dir = definition && definition.dir === 'rtl' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const translated = text(node.dataset.i18n);
      if (translated) node.textContent = translated;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
      const translated = text(node.dataset.i18nAria);
      if (translated) node.setAttribute('aria-label', translated);
    });
    if (!staticLanguage) {
      if (text('pageTitle')) document.title = text('pageTitle');
      const description = document.querySelector('meta[name="description"]');
      if (description && text('metaDescription')) description.content = text('metaDescription');
    }
    fitHeadline();
    if (languagePicker) languagePicker.update({ selectedCode: language, labels: languageLabels() });
    if (updateLocation) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', language);
        window.history.replaceState(null, '', url);
      } catch (_) { /* Local file previews can restrict history updates. */ }
    }
    setTheme(theme);
    applyDownloadLabels();
    window.MouseShowcase?.refreshLanguage();
    window.MouseComparison?.refreshLanguage();
    window.MouseManifest?.refreshLanguage();
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (staticLanguage && requestedLanguage && requestedLanguage !== staticLanguage) {
      // Preserve old explicitly selected ?lang= links, without language auto-redirects.
      const url = new URL(window.location.href);
      url.pathname = '/' + requestedLanguage.toLowerCase() + '/';
      url.searchParams.delete('lang');
      window.location.replace(url);
      return;
    }
    const languageHost = document.getElementById('language-picker');
    languagePicker = window.MouseLanguagePicker.create({
      host: languageHost,
      languages,
      selectedCode: language,
      labels: languageLabels(),
      onSelect(value) {
        const next = matchLanguage(value);
        if (!next) return;
        savePreference(languageKey, next);
        if (staticLanguage) {
          window.location.assign('/' + next.toLowerCase() + '/');
        } else {
          setLanguage(next, true);
        }
      }
    });
    languageHost.hidden = false;

    const button = document.getElementById('theme-switch');
    button.hidden = false;
    setLanguage(language);
    window.addEventListener('resize', fitHeadline, { passive: true });
    if (document.fonts) document.fonts.ready.then(fitHeadline);
    button.addEventListener('click', () => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
      savePreference(themeKey, theme);
    });

    // Keep open tabs current, and recheck immediately before a normal download.
    // Failure is bounded: the already verified direct anchor remains usable.
    const replaying = new WeakSet();
    const waiting = new WeakSet();
    document.querySelectorAll('.download[data-platform]').forEach((anchor) => {
      anchor.addEventListener('click', async (event) => {
        if (replaying.has(anchor) || event.defaultPrevented || (event.button != null && event.button !== 0) ||
            event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        event.preventDefault();
        if (waiting.has(anchor)) return;
        // Installation help accompanies the download; it never becomes a gate.
        try { window.MouseManifest?.openGuide(anchor.getAttribute('data-platform')); } catch (_) { /* Keep the direct download usable. */ }
        waiting.add(anchor);
        anchor.setAttribute('aria-busy', 'true');
        try {
          await refreshDownloads();
        } finally {
          waiting.delete(anchor);
          anchor.removeAttribute('aria-busy');
          try { window.MouseManifest?.refreshDownload(); } catch (_) { /* Help cannot block a download. */ }
          replaying.add(anchor);
          try { anchor.click(); } finally { replaying.delete(anchor); }
        }
      });
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'hidden') refreshDownloads();
    };
    setInterval(refreshWhenVisible, 60000);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', (event) => { if (event.persisted) refreshWhenVisible(); });
    document.addEventListener('visibilitychange', refreshWhenVisible);

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
