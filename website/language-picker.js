/* A local, searchable language picker. No network requests. */
(() => {
  'use strict';
  let nextId = 0;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const icon = (kind, className) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', className || 'language-picker-icon');
    const shapes = {
      globe: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M3.5 12h17M12 3.5c3 3 4.5 5.8 4.5 8.5s-1.5 5.5-4.5 8.5c-3-3-4.5-5.8-4.5-8.5s1.5-5.5 4.5-8.5Z' }]],
      chevron: [['path', { d: 'm8 10 4 4 4-4' }]],
      search: [['circle', { cx: 10.5, cy: 10.5, r: 6.5 }], ['path', { d: 'm15.5 15.5 4.5 4.5' }]],
      close: [['path', { d: 'm7 7 10 10M17 7 7 17' }]],
      check: [['path', { d: 'm6 12 4 4 8-8' }]]
    };
    for (const [tag, attrs] of shapes[kind]) {
      const shape = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attrs)) shape.setAttribute(name, value);
      svg.appendChild(shape);
    }
    return svg;
  };
  const fold = (value) => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss').replace(/ı/g, 'i').replace(/ł/g, 'l').trim();
  const displayNames = (locale) => {
    try { return new Intl.DisplayNames([locale || 'en'], { type: 'language' }); } catch (_) { return null; }
  };
  const displayName = (formatter, code) => {
    try { return formatter ? formatter.of(code) || '' : ''; } catch (_) { return ''; }
  };

  const create = ({ host, languages, selectedCode, labels, onSelect }) => {
    if (!(host instanceof HTMLElement)) throw new TypeError('Language picker requires a host element.');
    const choices = Array.isArray(languages) ? languages.slice() : [];
    let selected = selectedCode;
    let wording = labels || {};
    let opened = false;
    let visible = [];
    let entries = [];
    const id = `mouse-language-${++nextId}`;
    const fallback = { languageLabel: 'Language', languageSearch: 'Search languages', languageNoResults: 'No languages found', languageClose: 'Close' };
    const label = (key) => wording[key] || fallback[key];
    const current = () => choices.find((item) => item.code === selected) || choices[0];

    const trigger = element('button', 'language-picker-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${id}-panel`);
    const triggerName = element('span', 'language-picker-current');
    const triggerChevron = icon('chevron', 'language-picker-icon language-picker-chevron');
    trigger.append(icon('globe'), triggerName, triggerChevron);

    const panel = element('div', 'language-picker-panel');
    panel.id = `${id}-panel`;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', `${id}-heading`);

    const headingRow = element('div', 'language-picker-heading-row');
    const heading = element('h2', 'language-picker-heading');
    heading.id = `${id}-heading`;
    const dismiss = element('button', 'language-picker-close');
    dismiss.type = 'button';
    dismiss.append(icon('close'));
    headingRow.append(heading, dismiss);

    const searchWrap = element('label', 'language-picker-search-wrap');
    const searchText = element('span', 'language-picker-sr-only');
    searchText.id = `${id}-search-label`;
    const search = element('input', 'language-picker-search');
    search.type = 'search';
    search.autocomplete = 'off';
    search.autocapitalize = 'off';
    search.spellcheck = false;
    search.setAttribute('aria-labelledby', searchText.id);
    search.setAttribute('aria-controls', `${id}-list`);
    searchWrap.append(icon('search'), searchText, search);

    const list = element('ul', 'language-picker-list');
    list.id = `${id}-list`;
    const empty = element('p', 'language-picker-empty');
    empty.hidden = true;
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    panel.append(headingRow, searchWrap, list, empty);
    host.replaceChildren(trigger, panel);
    host.classList.add('language-picker-host');
    host.hidden = false;

    const close = (restoreFocus = false) => {
      if (!opened) return;
      opened = false;
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
    };
    const choose = (code) => {
      selected = code;
      try {
        if (typeof onSelect === 'function') onSelect(code);
      } finally {
        update({ selectedCode: selected });
        close(true);
      }
    };
    const buildEntries = () => {
      const local = displayNames(document.documentElement.lang);
      const english = displayNames('en');
      const russian = displayNames('ru');
      entries = choices.map((item) => {
        const localized = displayName(local, item.code);
        const native = item.name || item.code;
        return {
          ...item,
          name: native,
          localized: fold(localized) === fold(native) || localized === item.code ? '' : localized,
          haystack: fold([native, item.code, localized, displayName(english, item.code), displayName(russian, item.code)].join(' '))
        };
      });
    };
    const render = () => {
      const terms = fold(search.value).split(/\s+/).filter(Boolean);
      const fragment = document.createDocumentFragment();
      visible = [];
      for (const item of entries) {
        if (!terms.every((term) => item.haystack.includes(term))) continue;
        const row = element('li', 'language-picker-item');
        const button = element('button', 'language-picker-option');
        button.type = 'button';
        button.dataset.language = item.code;
        button.setAttribute('aria-pressed', String(item.code === selected));
        const native = element('span', 'language-picker-native', item.name);
        native.lang = item.code;
        native.dir = item.dir || 'ltr';
        button.append(native);
        if (item.localized) button.append(element('span', 'language-picker-localized', item.localized));
        if (item.code === selected) button.append(icon('check', 'language-picker-icon language-picker-check'));
        button.addEventListener('click', () => choose(item.code));
        row.append(button);
        fragment.append(row);
        visible.push(button);
      }
      list.replaceChildren(fragment);
      list.hidden = visible.length === 0;
      empty.hidden = visible.length !== 0;
    };
    const open = () => {
      opened = true;
      search.value = '';
      render();
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      search.focus({ preventScroll: true });
      list.scrollTop = 0;
    };
    const update = (next = {}) => {
      if (next.selectedCode !== undefined) selected = next.selectedCode;
      if (next.labels) wording = next.labels;
      const item = current();
      triggerName.textContent = item ? item.name : label('languageLabel');
      triggerName.lang = item ? item.code : document.documentElement.lang;
      triggerName.dir = item ? item.dir || 'ltr' : 'auto';
      trigger.setAttribute('aria-label', `${label('languageLabel')}: ${item ? item.name : ''}`);
      trigger.title = label('languageLabel');
      heading.textContent = label('languageLabel');
      dismiss.setAttribute('aria-label', label('languageClose'));
      dismiss.title = label('languageClose');
      searchText.textContent = label('languageSearch');
      search.placeholder = label('languageSearch');
      empty.textContent = label('languageNoResults');
      list.setAttribute('aria-label', label('languageLabel'));
      buildEntries();
      render();
    };

    trigger.addEventListener('click', () => opened ? close(true) : open());
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (opened) search.focus(); else open();
      }
    });
    dismiss.addEventListener('click', () => close(true));
    search.addEventListener('input', () => { render(); list.scrollTop = 0; });
    search.addEventListener('keydown', (event) => {
      if (!visible.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        visible[event.key === 'ArrowDown' ? 0 : visible.length - 1].focus();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        visible[0].click();
      }
    });
    list.addEventListener('keydown', (event) => {
      const index = visible.indexOf(document.activeElement);
      if (index < 0) return;
      const rtl = document.documentElement.dir === 'rtl';
      let nextIndex = index;
      if (event.key === 'ArrowDown') nextIndex += 2;
      else if (event.key === 'ArrowUp') nextIndex -= 2;
      else if (event.key === 'ArrowRight') nextIndex += rtl ? -1 : 1;
      else if (event.key === 'ArrowLeft') nextIndex += rtl ? 1 : -1;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = visible.length - 1;
      else return;
      event.preventDefault();
      if (nextIndex < 0) search.focus();
      else visible[Math.min(nextIndex, visible.length - 1)].focus();
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (opened && !host.contains(event.target)) close(false);
    });
    document.addEventListener('keydown', (event) => {
      if (opened && event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    });
    update({ selectedCode, labels });
    return { update };
  };

  window.MouseLanguagePicker = Object.freeze({ create });
})();
