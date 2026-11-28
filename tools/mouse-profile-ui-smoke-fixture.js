'use strict';
// Minimal owned shell: the profile controller, layout, appearance and styles are shipped code.
// Only settings services unrelated to the profile are fixtures.
(() => {
  const errors = [];
  addEventListener('error', event => errors.push(String(event.message).slice(0, 500)));
  addEventListener('unhandledrejection', event => errors.push(String(event.reason?.message || event.reason).slice(0, 500)));
  const model = {theme: 'light', locale: 'ru', appearance: MouseAppearance.normalize(MouseAppearance.DEFAULTS),
    tree: MouseLayout.preset(1), aiWidth: 300, settingsWidth: 760, privateMode: false, settingsOpen: false, controlSettings: {}};
  const bridge = globalThis.MouseProfileSmokeNative;
  if (!bridge) throw new Error('The native profile fixture bridge is missing');
  const N = {
    version: document.documentElement.dataset.fixtureVersion, platform: 'darwin',
    profile: bridge.profile, openFlash: bridge.openFlash,
    zoom: async () => ({factor: 1}), update: async () => ({phase: 'idle'}),
    archive: async () => ({enabled: false, count: 0}),
    import: async () => ({bookmarksCount: 0, passwords: {available: true, count: 0}}),
    settings: async (_action, changes) => ({...model.controlSettings, ...changes}),
    adBlockState: async () => ({enabled: false, phase: 'off', lists: 0, rules: 0, updatedAt: null}),
    onZoom() {}, onUpdate() {}, onSettings() {}, onLibrary() {}, onAdBlockState() {}
  };
  let ui;
  function side() {
    const max = Math.max(340, document.querySelector('#workspace').clientWidth - 280);
    document.querySelector('#settings-dialog').style.width = Math.round(MouseLayout.clamp(model.settingsWidth, 340, max)) + 'px';
    document.body.classList.toggle('sidebar-dimmed', model.settingsOpen);
  }
  function theme(value) { model.theme = value; document.documentElement.dataset.theme = value; MouseAppearance.apply(model.appearance); ui?.sync(); }
  function locale(value) { model.locale = value; document.documentElement.lang = value; ui?.sync(); }
  function appearance(changes) {
    model.appearance = MouseAppearance.update(model.appearance, changes, {privateMode: model.privateMode}).settings;
    ui.sync(); return model.appearance;
  }
  ui = createMouseSettings({N, model, action() {}, setTheme: theme, setLocale: locale, setAppearance: appearance,
    changeLayout() {}, applySide: side, save() {}, zoom() {}, onSidebar(open) { model.settingsOpen = open; side(); },
    status(message) { errors.push(String(message).slice(0, 500)); }});
  function rect(element) {
    const value = element.getBoundingClientRect();
    return {left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height};
  }
  function visible(element) {
    if (!element || !element.isConnected) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    const r = rect(element);
    return r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }
  function snapshot() {
    const ids = ['settings-profile', 'settings-profile-open', 'settings-profile-photo', 'settings-profile-initials',
      'settings-profile-name', 'settings-profile-id', 'settings-profile-flash', 'settings-profile-editor', 'settings-sidebar-version'];
    const nodes = {};
    for (const id of ids) {
      const element = document.getElementById(id), style = getComputedStyle(element), bounds = rect(element);
      const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      nodes[id] = {text: element.tagName === 'IMG' ? '' : element.textContent.trim(), visible: visible(element), hidden: element.hidden,
        disabled: !!element.disabled, rect: bounds, color: style.color, background: style.backgroundColor,
        hit: !!hit && (hit === element || element.contains(hit))};
    }
    const photo = document.getElementById('settings-profile-photo'), avatar = document.querySelector('.settings-profile-avatar');
    const footer = document.querySelector('.settings-sidebar-footer'), sidebar = document.querySelector('.settings-sidebar');
    return {theme: model.theme, locale: model.locale, privateMode: model.privateMode, open: ui.isOpen(),
      viewport: {width: innerWidth, height: innerHeight}, panel: rect(document.getElementById('settings-dialog')),
      sidebar: rect(sidebar), footer: rect(footer), navigation: rect(document.querySelector('.settings-navigation')),
      main: rect(document.querySelector('.settings-main')), nodes,
      avatar: {rect: rect(avatar), radius: getComputedStyle(avatar).borderRadius,
        complete: photo.complete, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight,
        srcSet: photo.hasAttribute('src'), pngSource: /^data:image\/png;base64,/.test(photo.getAttribute('src') || '')},
      profileBeforeVersion: !!(document.getElementById('settings-profile').compareDocumentPosition(document.getElementById('settings-sidebar-version')) & Node.DOCUMENT_POSITION_FOLLOWING),
      footerContainsCard: footer.contains(document.getElementById('settings-profile-open')),
      sectionCount: document.querySelectorAll('[data-settings-section]').length,
      toggleCount: document.querySelectorAll('[data-setting]').length,
      nodeInRenderer: typeof require !== 'undefined' || typeof process !== 'undefined', errors: [...errors]};
  }
  const painted = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  globalThis.MouseProfileSmokeFixture = Object.freeze({
    async configure({theme: nextTheme = model.theme, width = model.settingsWidth, privateMode = model.privateMode, locale: nextLocale = model.locale} = {}) {
      model.privateMode = !!privateMode; document.documentElement.dataset.private = String(model.privateMode);
      model.settingsWidth = width; model.locale = nextLocale; theme(nextTheme); side(); await painted(); return snapshot();
    },
    async reopen() { if (ui.isOpen()) ui.close(); await ui.open(); await painted(); return snapshot(); },
    snapshot,
    ready: (async () => { theme('light'); await ui.open(); await painted(); return true; })()
  });
})();
