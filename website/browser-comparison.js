/* Desktop layout examples, checked against vendor documentation on 2026-11-25.
   These are interactive models using local website captures, not embedded browsers. */
(() => {
  'use strict';
  const two = ['1', '2', '2-stacked'];
  const four = [...two, '3', '3-stacked', '4', '4-horizontal', '4-stacked'];
  const grid = [...four, '6', '8', '9', '12'];
  const source = (url, labelKey = 'compareSourceSplit') => ({ url, labelKey });
  const base = { chrome: 'single-address', organization: 'examples', paneSwap: 'button', paneResize: true, paneExpand: false };
  const profiles = [
    { ...base, id: 'chrome', name: 'Chrome', allowedLayouts: two, defaultLayout: '2', organization: 'tab-groups', noteKey: 'compareTwoAxisNote', sources: [source('https://support.google.com/chrome/answer/16971124')] },
    { ...base, id: 'safari', name: 'Safari', allowedLayouts: ['1', 'mac-split'], defaultLayout: '1', chrome: 'os-windows', organization: 'tab-groups', paneSwap: 'none', noteKey: 'compareSafariNote', sources: [source('https://support.apple.com/guide/safari/use-tabs-for-webpages-sfri11576/mac', 'compareOrdinary'), source('https://support.apple.com/guide/mac-help/mchl4fbe2921/mac', 'compareMacWindows')] },
    { ...base, id: 'firefox', name: 'Firefox', allowedLayouts: ['1', '2'], defaultLayout: '2', organization: 'tab-groups', noteKey: 'compareFirefoxNote', sources: [source('https://support.mozilla.org/en-US/kb/split-view-firefox')] },
    { ...base, id: 'edge', name: 'Edge', allowedLayouts: two, defaultLayout: '2', organization: 'workspaces', noteKey: 'compareTwoAxisNote', sources: [source('https://www.microsoft.com/en-us/edge/features/split-screen'), source('https://support.microsoft.com/en-us/edge/getting-started-with-microsoft-edge-workspaces', 'compareSourceSpaces')] },
    { ...base, id: 'brave', name: 'Brave', allowedLayouts: two, defaultLayout: '2', noteKey: 'compareTwoAxisNote', sources: [source('https://support.brave.app/hc/en-us/articles/35087087593997-How-do-I-use-Split-view-in-Brave'), source('https://brave.com/latest/', 'compareSourceStatus')] },
    { ...base, id: 'mouse', name: 'Mouse', allowedLayouts: grid, defaultLayout: null, chrome: 'mouse-panes', organization: 'workspaces', paneSwap: 'drag', paneExpand: true, desktopCount: 5, noteKey: 'compareMouseNote', sources: [source('#features', 'featuresTitle')] },
    { ...base, id: 'opera', name: 'Opera', allowedLayouts: four, defaultLayout: '4', organization: 'workspaces', noteKey: 'compareOperaNote', sources: [source('https://www.opera.com/features/splitscreen'), source('https://www.opera.com/features/workspaces', 'compareSourceSpaces')] },
    { ...base, id: 'yandex', name: 'Yandex', allowedLayouts: ['1', 'web-app'], defaultLayout: 'web-app', chrome: 'web-app', organization: 'tab-groups', paneSwap: 'none', noteKey: 'compareYandexNote', sources: [source('https://yandex.ru/support/browser/ru/personalization/web-app', 'compareWebApp')] },
    { ...base, id: 'vivaldi', name: 'Vivaldi', allowedLayouts: grid, defaultLayout: '6', organization: 'workspaces', paneSwap: 'drag', noteKey: 'compareVivaldiNote', sources: [source('https://help.vivaldi.com/desktop/tabs/tab-tiling/'), source('https://vivaldi.com/features/workspaces/', 'compareSourceSpaces')] },
    { ...base, id: 'arc', name: 'Arc', allowedLayouts: two, defaultLayout: '2', organization: 'workspaces', noteKey: 'compareArcNote', sources: [source('https://start.arc.net/master-multitasking'), source('https://resources.arc.net/hc/en-us/articles/44412972248471-Arc-Sunset-Key-Dates-and-What-to-Expect', 'compareSourceStatus')] },
    { ...base, id: 'zen', name: 'Zen', allowedLayouts: four, defaultLayout: '4', organization: 'workspaces', paneSwap: 'drag', noteKey: 'compareZenNote', sources: [source('https://docs.zen-browser.app/user-manual/split-view'), source('https://docs.zen-browser.app/user-manual/workspaces', 'compareSourceSpaces')] }
  ].map(profile => Object.freeze({ ...profile, allowedLayouts: Object.freeze([...profile.allowedLayouts]), sources: Object.freeze(profile.sources) }));
  if (typeof module === 'object' && module.exports) {
    module.exports = Object.freeze({ profiles });
    return;
  }
  window.MOUSE_BROWSER_PROFILES = Object.freeze(profiles);
  const text = key => window.MOUSE_I18N?.messages?.[document.documentElement.lang]?.[key] || window.MOUSE_I18N?.messages?.en?.[key] || '';
  let selected = 'mouse', currentLayout = null, root = null;
  function refreshLanguage() {
    if (!root) return;
    const heading = root.querySelector('[data-compare-heading]');
    const parts = text('compareTitle').split('{mouse}');
    const brand = document.createElement('span');
    brand.className = 'comparison-brand'; brand.textContent = text('compareMouseName') || 'Mouse';
    heading.replaceChildren(document.createTextNode(parts[0]), brand, document.createTextNode(parts[1] || ''));
    const profile = profiles.find(item => item.id === selected);
    root.querySelector('[data-compare-name]').textContent = profile.name;
    root.querySelector('[data-compare-note]').textContent = text(profile.noteKey);
    const mode = currentLayout === '1' ? 'compareOrdinary' : currentLayout === 'mac-split' ? 'compareMacWindows' : currentLayout === 'web-app' ? 'compareWebApp' : ['mouse', 'vivaldi', 'opera', 'zen'].includes(selected) ? 'compareTiling' : 'compareSplit';
    root.querySelector('[data-compare-mode]').textContent = text(mode);
    root.querySelector('[data-compare-checked]').textContent = text('compareChecked').replace('{date}', '25.11.2026');
    root.querySelectorAll('[data-browser-reference]').forEach(node => { node.hidden = node.dataset.browserReference !== selected; });
    root.querySelectorAll('[data-browser-choice]').forEach(button => {
      const active = button.dataset.browserChoice === selected;
      button.setAttribute('aria-pressed', String(active));
      button.tabIndex = active ? 0 : -1;
    });
  }
  function init() {
    root = document.getElementById('browser-comparison');
    if (!root) return;
    const buttons = [...root.querySelectorAll('[data-browser-choice]')];
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => {
        const id = button.dataset.browserChoice;
        if (!window.MouseShowcase?.setBrowser) return;
        window.MouseShowcase.setBrowser(id);
      });
      button.addEventListener('keydown', event => {
        const rtl = document.documentElement.dir === 'rtl';
        let next = index;
        if (event.key === 'ArrowRight') next += rtl ? -1 : 1;
        else if (event.key === 'ArrowLeft') next += rtl ? 1 : -1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        const target = buttons[(next + buttons.length) % buttons.length];
        target.focus(); target.click();
      });
    });
    document.addEventListener('mouse:browser-change', event => {
      if (!profiles.some(profile => profile.id === event.detail?.id)) return;
      selected = event.detail.id; currentLayout = event.detail.layoutId;
      root.dataset.selectedBrowser = selected;
      refreshLanguage();
    });
    new MutationObserver(refreshLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    refreshLanguage();
  }
  window.MouseComparison = Object.freeze({ refreshLanguage });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
