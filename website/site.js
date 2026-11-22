/* Preferences stay on this device. No network calls or tracking. */
(() => {
  'use strict';
  const root = document.documentElement;
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
