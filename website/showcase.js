/* Real website captures, served locally. The tiles are interactive; the sites are screenshots. */
(() => {
  'use strict';
  // Tabs and visible grid slots are separate: adding a tab must not add a
  // thirteenth window or discard a visitor's tabs when the scene changes.
  function createTabWorkspace() {
    let base = [], added = [], sequence = 0;
    const start = (tabId, name) => ({ tabId, id: tabId, kind: 'start', name, host: '' });
    return {
      get tabs() { return [...base, ...added]; },
      reset(sources) { base = [...sources]; },
      ensure(sources) {
        const present = new Set([...base, ...added].map(tab => tab.tabId));
        for (const tab of sources) if (!present.has(tab.tabId)) { base.push(tab); present.add(tab.tabId); }
      },
      snapshot() { return JSON.parse(JSON.stringify({ base, added, sequence })); },
      restore(saved) {
        const copy = JSON.parse(JSON.stringify(saved));
        base = copy.base; added = copy.added; sequence = copy.sequence;
      },
      add(name) {
        const tab = start('user-' + (++sequence), name);
        added.push(tab); return tab;
      },
      choose(tabId, source) {
        const collection = added.some(tab => tab.tabId === tabId) ? added : base;
        const index = collection.findIndex(tab => tab.tabId === tabId);
        if (index < 0) return null;
        const tab = { ...source, tabId };
        collection[index] = tab; return tab;
      },
      refresh(available, name) {
        const captures = new Set(available.map(source => source.src));
        const refresh = tab => tab.kind === 'start' || !captures.has(tab.src) ? start(tab.tabId, name) : tab;
        base = base.map(refresh); added = added.map(refresh);
      }
    };
  }
  function chooseVisibleTabs(tabs, previous, count, activeId) {
    const byId = new Map(tabs.map(tab => [tab.tabId, tab]));
    let visible = previous.map(tab => byId.get(typeof tab === 'string' ? tab : tab.tabId)).filter(Boolean);
    if (visible.length > count && visible.some(tab => tab.tabId === activeId)) {
      visible = [byId.get(activeId), ...visible.filter(tab => tab.tabId !== activeId)];
    }
    const seen = new Set();
    return [...visible, ...tabs].filter(tab => !seen.has(tab.tabId) && seen.add(tab.tabId)).slice(0, count);
  }
  function createBrowserStateBank() {
    const states = new Map(), lastScenes = new Map();
    const copy = value => JSON.parse(JSON.stringify(value));
    const key = (browser, scene) => JSON.stringify([browser, scene]);
    return {
      remember(browser, scene, value) { states.set(key(browser, scene), copy(value)); lastScenes.set(browser, scene); },
      recall(browser, scene) { const value = states.get(key(browser, scene)); return value ? copy(value) : null; },
      lastScene(browser) { return lastScenes.get(browser); }
    };
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = Object.freeze({ createTabWorkspace, chooseVisibleTabs, createBrowserStateBank });
    return;
  }
  const EN = {
    showcaseTitle: 'Your workspace, in motion',
    showcaseSupport: 'Support', showcaseSupportText: 'Help, resources and maps — together',
    showcaseTrading: 'Trading', showcaseTradingText: 'Charts and market research — side by side',
    showcaseAi: 'AI', showcaseAiText: 'AI answers, tools and documentation — in view',
    showcaseDevelopment: 'Development', showcaseDevelopmentText: 'Your editor, assistant and documentation — side by side',
    showcaseContent: 'Content', showcaseContentText: 'Create, review and plan in one workspace',
    showcaseDesign: 'Design', showcaseDesignText: 'Find inspiration and keep your references together',
    showcaseExpand: 'Explore full screen', showcaseClose: 'Close', showcasePause: 'Pause',
    showcasePlay: 'Play', showcasePrevious: 'Previous scene', showcaseNext: 'Next scene',
    showcaseHint: 'Swipe up over the preview to explore', showcaseDemo: 'Real website captures',
    showcaseScenesLabel: 'Workspaces', showcaseMove: 'Move window',
    showcaseResize: 'Resize windows', showcaseRestore: 'Restore grid', showcaseCaptured: 'Captured website',
    showcaseTry: 'Try it yourself', showcaseWindows: 'Windows', showcaseSideBySide: 'Side by side',
    showcaseStacked: 'Stacked', showcaseTabs: 'Open tabs',
    showcaseNewTab: 'New tab', showcaseChooseSite: 'Choose a site',
    demoScenes: 'Website examples', demoWorkspaces: 'Workspaces', demoAddress: 'Address of the selected capture',
    demoSwap: 'Swap pages',
    demoModel: 'Interactive model · real website captures',
    demoDesktops: 'Desktops', demoDesktop: 'Desktop {number}: {name}', demoDesktopCount: '5 desktops'
  };
  const icon = name => {
    const paths = {
      expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',
      restore: '<path d="M9 3v6H3M15 3v6h6M21 15h-6v6M3 15h6v6"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
      play: '<path d="m9 5 11 7-11 7Z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      swap: '<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
  };
  const services = {
    maps: { name: 'Google Maps', host: 'maps.google.com' },
    tradingview: { name: 'TradingView', host: 'tradingview.com' },
    youtube: { name: 'YouTube', host: 'youtube.com' },
    vscode: { name: 'VS Code for the Web', host: 'vscode.dev' },
    github: { name: 'GitHub', host: '' },
    mdn: { name: 'MDN Web Docs', host: 'developer.mozilla.org' },
    figma: { name: 'Figma Community', host: 'figma.com' },
    huggingface: { name: 'Hugging Face Spaces', host: 'huggingface.co' },
    perplexity: { name: 'Perplexity', host: 'perplexity.ai' },
    discord: { name: 'Discord Help Center', host: 'support.discord.com' },
    finviz: { name: 'Finviz', host: 'finviz.com' }
  };
  const scenes = [
    { id: 'support', key: 'Support', action: 'drag', count: 3,
      sources: ['discord','mdn','maps'],
      rects: [[0,0,32,50],[0,50,32,50],[32,0,68,100]],
      portrait: [[0,0,50,32],[50,0,50,32],[0,32,100,68]] },
    { id: 'trading', key: 'Trading', action: 'resize', count: 2,
      sources: ['tradingview','finviz'],
      rects: [[0,0,63,100],[63,0,37,100]],
      portrait: [[0,0,100,54],[0,54,100,46]] },
    { id: 'ai', key: 'Ai', action: 'zoom', count: 3,
      sources: ['perplexity','huggingface','mdn'],
      rects: [[0,0,38,100],[38,0,34,100],[72,0,28,100]],
      portrait: [[0,0,50,64],[50,0,50,64],[0,64,100,36]] },
    { id: 'development', key: 'Development', action: 'drag', count: 4,
      sources: ['vscode','perplexity','mdn','github'],
      rects: [[0,0,60,100],[60,0,40,44],[60,44,40,28],[60,72,40,28]],
      portrait: [[0,0,100,52],[0,52,50,27],[50,52,50,27],[0,79,100,21]] },
    { id: 'content', key: 'Content', action: 'resize', count: 4,
      sources: ['youtube','figma','perplexity','huggingface'],
      rects: [[0,0,54,62],[54,0,46,62],[0,62,38,38],[38,62,62,38]],
      portrait: [[0,0,50,58],[50,0,50,58],[0,58,50,42],[50,58,50,42]] },
    { id: 'design', key: 'Design', action: 'zoom', count: 3,
      sources: ['figma','perplexity','youtube'],
      rects: [[0,0,64,100],[64,0,36,62],[64,62,36,38]],
      portrait: [[0,0,100,60],[0,60,60,40],[60,60,40,40]] }
  ];
  const mouseDesktops = [4, 1, 3, 5, 0];
  const uniformGrid = (columns, rows) => Array.from({ length: columns * rows }, (_, i) => [
    i % columns * 100 / columns, Math.floor(i / columns) * 100 / rows, 100 / columns, 100 / rows
  ]);
  const layouts = [
    { id: '1', columns: 1, rows: 1 },
    { id: '2', columns: 2, rows: 1, key: 'showcaseSideBySide' },
    { id: '2-stacked', columns: 1, rows: 2, key: 'showcaseStacked' },
    { id: '3', columns: 3, rows: 1 },
    { id: '3-stacked', columns: 1, rows: 3, key: 'showcaseStacked' },
    { id: '4', columns: 2, rows: 2 },
    { id: '4-horizontal', columns: 4, rows: 1, key: 'showcaseSideBySide' },
    { id: '4-stacked', columns: 1, rows: 4, key: 'showcaseStacked' },
    { id: '6', columns: 3, rows: 2 },
    { id: '8', columns: 4, rows: 2 },
    { id: '9', columns: 3, rows: 3 },
    { id: '12', columns: 4, rows: 3 }
  ];
  const mouseProfile = {
    id: 'mouse', name: 'Mouse', allowedLayouts: layouts.map(layout => layout.id),
    defaultLayout: null, chrome: 'mouse-panes', organization: 'workspaces', paneSwap: 'drag', paneResize: true, paneExpand: true
  };
  // The public example has one profile: Mouse. Keep the existing controller
  // API for its desktop/grid state without exposing other browser models.
  const browserProfiles = () => new Map([['mouse', mouseProfile]]);
  const balanced = count => {
    const known = layouts.find(item => item.columns * item.rows === count);
    if (known) return uniformGrid(known.columns, known.rows);
    if (!count) return [];
    // A missing capture still leaves a complete grid, without an empty placeholder.
    const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns), result = [];
    for (let row = 0; row < rows; row++) {
      const inRow = Math.min(columns, count - row * columns);
      for (let column = 0; column < inRow; column++) result.push([column * 100 / inRow, row * 100 / rows, 100 / inRow, 100 / rows]);
    }
    return result;
  };
  const gridIcon = (columns = 2, rows = 2) => {
    let lines = '<rect x="2" y="3" width="20" height="18"/>';
    for (let i = 1; i < columns; i++) lines += '<path d="M' + (2 + 20 * i / columns) + ' 3v18"/>';
    for (let i = 1; i < rows; i++) lines += '<path d="M2 ' + (3 + 18 * i / rows) + 'h20"/>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' + lines + '</svg>';
  };
  const cloneRects = rects => rects.map(rect => [...rect]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const near = (a, b) => Math.abs(a - b) < .02;
  const localCapture = value => typeof value === 'string' && /^\/showcase\/[a-z0-9][a-z0-9._-]*\.(webp|jpg|jpeg|png)$/.test(value);
  let controller = null;

  function create(root) {
    if (!root || root.dataset.showcaseReady === 'true') return controller;
    const experience = root.querySelector('.showcase-experience');
    const dock = root.querySelector('.showcase-dock');
    const canvas = root.querySelector('.showcase-canvas');
    const frame = root.querySelector('.showcase-frame');
    const dialog = root.querySelector('.showcase-dialog');
    const dialogHost = root.querySelector('.showcase-dialog-host');
    const modes = root.querySelector('.showcase-modes');
    const modePicker = root.querySelector('.showcase-mode-picker');
    if (!experience || !dock || !canvas || !frame || !dialog || !dialogHost || !modes) return null;
    root.dataset.showcaseReady = 'true';
    root.style.setProperty('--showcase-duration', '4600ms');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const portrait = matchMedia('(max-width: 600px) and (orientation: portrait)');
    const duration = 4600, gap = 5;
    const timers = new Set(), paneNodes = [], handles = new Map(), failed = new Set();
    let assets = window.MOUSE_SHOWCASE_ASSETS || {}, sources = [];
    let index = 4, gridRects = [], paneSlots = [], zoomed = -1, geometryEpoch = 0, layoutId = null, activePane = 0;
    let userPaused = reduced.matches, visible = true, expanded = false, gesture = null;
    let savedScroll = 0, savedFocus = null, savedOverflow = '', touch = null, wheel = 0, wheelAt = 0;
    let hoverPoint = null, cleanTimer = null, autoDragged = null;
    const text = key => window.MOUSE_I18N?.messages?.[document.documentElement.lang]?.[key] || window.MOUSE_I18N?.messages?.en?.[key] || EN[key] || '';
    const tabNodes = [];
    const tabWorkspace = createTabWorkspace();
    const stateBank = createBrowserStateBank();
    let browserId = 'mouse', profile = browserProfiles().get('mouse') || mouseProfile, sceneReady = false;
    const sequence = () => browserId === 'mouse' ? mouseDesktops : scenes.map((_, i) => i);
    const allowedLayout = id => Array.isArray(profile.allowedLayouts) && profile.allowedLayouts.includes(id) && layouts.some(layout => layout.id === id);
    const swapKind = () => profile.paneSwap || 'none';
    const canDrag = () => sources.length > 1 && swapKind() === 'drag';
    const canResize = () => sources.length > 1 && profile.paneResize === true;
    const canExpandPane = () => profile.paneExpand === true;
    const editablePane = () => clamp(activePane, 0, Math.max(0, sources.length - 1));
    const chromeMode = () => profile.chrome;
    const chrome = root.querySelector('.showcase-chrome');
    const nora = root.querySelector('.showcase-nora');
    const tabs = document.createElement('div');
    tabs.className = 'showcase-tabs'; tabs.setAttribute('role', 'toolbar'); tabs.dataset.showcaseAria = 'showcaseTabs';
    const newTabButton = document.createElement('button');
    newTabButton.type = 'button'; newTabButton.className = 'showcase-button showcase-new-tab';
    newTabButton.dataset.showcaseAria = 'showcaseNewTab'; newTabButton.innerHTML = icon('plus');
    newTabButton.addEventListener('click', addTab);
    const layoutPicker = document.createElement('details');
    layoutPicker.className = 'showcase-layout-picker';
    layoutPicker.innerHTML = '<summary class="showcase-layout-trigger">' + gridIcon() + '<span data-showcase-layout-label></span><svg class="showcase-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="showcase-layouts" role="group" data-showcase-aria="showcaseWindows"></div>';
    const layoutMenu = layoutPicker.querySelector('.showcase-layouts');
    const swapButton = document.createElement('button');
    swapButton.type = 'button'; swapButton.className = 'showcase-button showcase-swap';
    swapButton.dataset.showcaseAria = 'demoSwap'; swapButton.innerHTML = icon('swap');
    swapButton.addEventListener('click', () => {
      if (sources.length < 2 || swapKind() === 'none') return;
      manual(); cancelGesture();
      const first = editablePane(); swap(first, (first + 1) % sources.length); rememberCurrent();
      announce(text('demoSwap'));
    });
    const addressbar = document.createElement('div');
    addressbar.className = 'showcase-addressbar';
    const addressValue = document.createElement('bdi');
    addressValue.className = 'showcase-address-value'; addressbar.append(addressValue);
    const desktopBar = document.createElement('div');
    desktopBar.className = 'showcase-desktops';
    const desktopLabel = document.createElement('span');
    desktopLabel.className = 'showcase-desktops-label'; desktopLabel.dataset.showcaseKey = 'demoDesktops';
    const desktopButtons = document.createElement('div');
    desktopButtons.className = 'showcase-desktop-buttons'; desktopButtons.setAttribute('role', 'group');
    desktopButtons.dataset.showcaseAria = 'demoDesktops';
    mouseDesktops.forEach((sceneIndex, ordinal) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'showcase-desktop'; button.dataset.desktop = String(ordinal + 1);
      const number = document.createElement('span'); number.className = 'showcase-desktop-number'; number.textContent = String(ordinal + 1);
      const name = document.createElement('span'); name.className = 'showcase-desktop-name';
      button.append(number, name);
      button.addEventListener('click', () => { manual(); select(sceneIndex, true); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); manual();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? mouseDesktops.length - 1 : (ordinal + (event.key === 'ArrowLeft' ? -1 : 1) + mouseDesktops.length) % mouseDesktops.length;
        select(mouseDesktops[next], true); desktopButtons.children[next].focus({ preventScroll: true });
      });
      desktopButtons.append(button);
    });
    desktopBar.append(desktopLabel, desktopButtons);
    const organizationLabel = document.createElement('span');
    organizationLabel.className = 'showcase-organization-label';
    modePicker?.querySelector('summary')?.prepend(organizationLabel);
    const invitation = document.createElement('span');
    invitation.className = 'showcase-invitation'; invitation.dataset.showcaseKey = 'showcaseTry';
    const disclosure = document.createElement('span');
    disclosure.className = 'showcase-disclosure'; disclosure.dataset.showcaseKey = 'demoModel';
    // The native Mouse metaphor: current tabs above, desktop/grid controls below.
    if (chrome && nora) {
      const controls = root.querySelector('.showcase-inline-controls');
      nora.replaceChildren(layoutPicker, swapButton);
      if (modePicker) nora.append(modePicker);
      nora.append(invitation, disclosure);
      if (controls) nora.append(controls);
      chrome.replaceChildren(tabs, newTabButton);
      chrome.after(addressbar);
      canvas.after(desktopBar);
    }
    root.querySelector('[data-showcase-preview-hit]')?.remove();
    const closePicker = () => { if (modePicker) modePicker.open = false; layoutPicker.open = false; };
    const rectFor = paneIndex => gridRects[paneSlots[paneIndex]];
    const canPlay = () => !userPaused && !modePicker?.open && !layoutPicker.open && visible && document.visibilityState !== 'hidden' && !gesture && sources.length > 0;
    const announce = (message, language = document.documentElement.lang || 'en') => { const node = root.querySelector('[data-showcase-status]'); if (node) { node.lang = language; node.textContent = message; } };

    canvas.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const pane = document.createElement('article');
      pane.className = 'showcase-pane'; pane.dataset.paneIndex = String(i);
      pane.innerHTML = '<div class="showcase-pane-head"><button class="showcase-pane-drag" type="button"><span class="showcase-service-mark" aria-hidden="true"></span><span class="showcase-service-name"></span><span class="showcase-service-host"></span></button><button class="showcase-pane-zoom" type="button">' + icon('expand') + '</button></div><div class="showcase-pane-page"></div>';
      pane.querySelector('.showcase-pane-zoom').addEventListener('click', () => {
        if (!canExpandPane()) return;
        manual(); setZoom(zoomed === i ? -1 : i, true);
      });
      pane.querySelector('.showcase-pane-page').addEventListener('dblclick', () => {
        if (!canExpandPane()) return;
        manual(); setZoom(zoomed === i ? -1 : i, true);
      });
      pane.querySelector('.showcase-pane-drag').addEventListener('keydown', event => {
        if (!canDrag() || zoomed >= 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault(); manual();
        const current = rectFor(i), horizontal = /Left|Right/.test(event.key), direction = /Left|Up/.test(event.key) ? -1 : 1;
        const axis = horizontal ? 0 : 1, cross = horizontal ? 1 : 0;
        const center = r => r[axis] + r[axis + 2] / 2;
        const choices = sources.map((_, j) => ({ j, r: rectFor(j) })).filter(item => item.j !== i && (center(item.r) - center(current)) * direction > .1);
        choices.sort((a, b) => {
          const distance = r => Math.abs(center(r) - center(current)) + Math.abs(r[cross] + r[cross + 2] / 2 - current[cross] - current[cross + 2] / 2) * .8;
          return distance(a.r) - distance(b.r);
        });
        if (choices.length) { swap(i, choices[0].j); announce(sources[i].name + ' — ' + text('showcaseMove')); }
      });
      canvas.append(pane); paneNodes.push(pane);
    }
    const cursor = document.createElement('div');
    cursor.className = 'showcase-cursor'; cursor.hidden = true; cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<svg viewBox="0 0 28 32" aria-hidden="true"><path d="M3 2v24l6-6 5 10 5-3-5-9 9-1Z" fill="white" stroke="black" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="showcase-cursor-label"></span>';
    canvas.append(cursor);
    modes.replaceChildren();
    scenes.forEach((scene, sceneIndex) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'showcase-mode'; button.dataset.scene = scene.id;
      button.dataset.showcaseKey = 'showcase' + scene.key; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => { manual(); select(sceneIndex, true); });
      modes.append(button);
    });
    layouts.forEach(layout => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'showcase-layout-option'; button.dataset.layout = layout.id;
      button.innerHTML = gridIcon(layout.columns, layout.rows) + '<span class="showcase-layout-count">' + layout.columns * layout.rows + '</span><span class="showcase-layout-description"></span><span class="showcase-layout-check" aria-hidden="true">✓</span>';
      button.addEventListener('click', () => {
        if (!allowedLayout(layout.id)) return;
        manual(); changeLayout(layout.id);
        layoutPicker.querySelector('summary').focus({ preventScroll: true });
        announce(text('showcaseWindows') + ': ' + sources.length + (layout.key ? ' — ' + text(layout.key) : ''));
      });
      layoutMenu.append(button);
    });
    function menuKeyboard(picker, list) {
      picker.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); picker.open = false; picker.querySelector('summary').focus({ preventScroll:true }); return; }
        if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
        event.preventDefault(); picker.open = true;
        const buttons = Array.from(list.querySelectorAll('button')).filter(button => !button.hidden && !button.disabled);
        const current = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus({ preventScroll: true });
      });
      picker.addEventListener('toggle', () => {
        if (picker.open) { userPaused = true; stopPlayback(); refreshLanguage(); }
      });
    }
    menuKeyboard(layoutPicker, layoutMenu);
    if (modePicker) menuKeyboard(modePicker, modes);

    function updateProfileUI() {
      root.dataset.browser = browserId;
      root.dataset.browserChrome = chromeMode();
      root.dataset.paneDrag = String(canDrag());
      root.dataset.organization = profile.organization || 'examples';
      desktopBar.hidden = browserId !== 'mouse';
      if (modePicker) modePicker.hidden = browserId === 'mouse';
      addressbar.hidden = ['mouse-panes', 'os-windows'].includes(chromeMode());
      swapButton.hidden = sources.length < 2 || swapKind() === 'none';
      layoutMenu.querySelectorAll('button').forEach(button => {
        const available = allowedLayout(button.dataset.layout);
        button.hidden = !available; button.disabled = !available;
      });
      const heading = root.querySelector('.showcase-dialog-heading');
      if (heading) heading.textContent = profile.name || browserId;
      tabs.setAttribute('aria-orientation', 'horizontal');
    }
    function notifyBrowser() {
      document.dispatchEvent(new CustomEvent('mouse:browser-change', { detail: { id: browserId, layoutId } }));
    }
    function syncTabState() {
      const activeId = sources[activePane]?.tabId;
      const open = tabWorkspace.tabs;
      tabNodes.forEach((tab, i) => {
        const active = open[i]?.tabId === activeId;
        tab.setAttribute('aria-pressed', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      paneNodes.forEach((pane, i) => pane.classList.toggle('is-active-pane', i === activePane));
      const source = sources[activePane];
      addressValue.textContent = source?.kind === 'start' ? text('showcaseNewTab') : source?.host || source?.name || '';
      addressbar.setAttribute('aria-label', text('demoAddress'));
      addressbar.title = text('demoAddress');
    }
    function focusTab(tabIndex, fromKeyboard = false) {
      const tab = tabWorkspace.tabs[tabIndex];
      if (!tab) return;
      manual();
      const visiblePane = sources.findIndex(source => source.tabId === tab.tabId);
      if (visiblePane >= 0) activePane = visiblePane;
      else {
        activePane = editablePane();
        if (!sources.length) { activePane = 0; paneSlots = [0]; gridRects = [[0,0,100,100]]; }
        sources[activePane] = tab;
        renderPane(activePane, false);
      }
      root.dataset.windowCount = String(sources.length);
      if (zoomed >= 0) setZoom(activePane);
      layoutGeometry(); refreshLanguage();
      syncTabState();
      // Keep tab focus in the strip; content remains reachable with Tab. This
      // also prevents scene re-renders from stealing keyboard navigation.
      tabNodes[tabIndex]?.focus({ preventScroll: true });
      tabNodes[tabIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
    function refreshTabs() {
      const focusedId = document.activeElement?.dataset.showcaseTab;
      tabs.replaceChildren(); tabNodes.length = 0;
      tabWorkspace.tabs.forEach((source, i) => {
        const tab = document.createElement('button');
        tab.type = 'button'; tab.className = 'showcase-tab'; tab.title = source.name; tab.dataset.showcaseTab = source.tabId;
        const mark = document.createElement('span'); mark.className = 'showcase-tab-mark'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = source.kind === 'start' ? '+' : source.name.slice(0, 1);
        const title = document.createElement('span'); title.textContent = source.name;
        tab.append(mark, title); tab.addEventListener('click', () => focusTab(i));
        tab.addEventListener('keydown', event => {
          if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
          event.preventDefault();
          const open = tabWorkspace.tabs;
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? open.length - 1 : (i + (['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1) + open.length) % open.length;
          focusTab(next, true);
        });
        tabs.append(tab); tabNodes.push(tab);
      });
      syncTabState();
      if (focusedId) (tabNodes.find(tab => tab.dataset.showcaseTab === focusedId) || tabNodes.find(tab => tab.tabIndex === 0))?.focus({ preventScroll: true });
    }

    function addTab() {
      manual(); cancelGesture();
      const tab = tabWorkspace.add(text('showcaseNewTab'));
      activePane = editablePane();
      if (!sources.length) { sources = [tab]; paneSlots = [0]; gridRects = [[0,0,100,100]]; activePane = 0; }
      else sources[activePane] = tab;
      renderPane(activePane, false); refreshTabs(); layoutGeometry(); refreshLanguage();
      root.dataset.windowCount = String(sources.length);
      root.dataset.tabCount = String(tabWorkspace.tabs.length);
      tabNodes.at(-1)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      paneNodes[activePane].querySelector('.showcase-start-choice')?.focus({ preventScroll: true });
      announce(text('showcaseNewTab') + ' — ' + text('showcaseChooseSite'));
    }

    function chooseSite(tabId, source) {
      manual();
      const chosen = tabWorkspace.choose(tabId, source);
      if (!chosen) return;
      const visiblePane = sources.findIndex(tab => tab.tabId === tabId);
      if (visiblePane < 0) return;
      sources[visiblePane] = chosen; activePane = visiblePane;
      renderPane(visiblePane, false); refreshTabs(); layoutGeometry(); refreshLanguage();
      const target = canExpandPane() && zoomed >= 0 ? paneNodes[visiblePane].querySelector('.showcase-pane-zoom') : canDrag() ? paneNodes[visiblePane].querySelector('.showcase-pane-drag') : tabNodes.find(tab => tab.dataset.showcaseTab === tabId);
      target?.focus({ preventScroll: true });
      announce(chosen.name);
    }

    function availableSources() {
      return Object.entries(assets).flatMap(([id, value]) => {
        const entry = typeof value === 'string' ? { src: value } : value;
        if (!entry || !localCapture(entry.src) || failed.has(entry.src)) return [];
        const defaults = services[id] || { name: id, host: '' };
        return [{ id, src: entry.src, name: String(entry.name || defaults.name).slice(0,100), host: String(entry.host ?? defaults.host).slice(0,100), alt: String(entry.alt || (entry.name || defaults.name) + ' — captured public website').slice(0,240), fit: ['contain','cover'].includes(entry.fit) ? entry.fit : '', position: /^(left|center|right|top|bottom)( (left|center|right|top|bottom))?$/.test(entry.position || '') ? entry.position : '' }];
      });
    }
    function sceneSources(scene) {
      const available = availableSources(), byId = new Map(available.map(item => [item.id, item]));
      const chosen = [], seen = new Set();
      for (const id of scene.sources) {
        const item = byId.get(id);
        if (item && !seen.has(item.src)) { chosen.push(item); seen.add(item.src); }
        if (chosen.length >= scene.count) break;
      }
      return chosen;
    }
    function sourcePool(scene) {
      const pool = sceneSources(scene), seen = new Set(pool.map(item => item.src));
      for (const source of availableSources()) if (!seen.has(source.src)) { pool.push(source); seen.add(source.src); }
      return pool;
    }
    function ensureCaptureTabs(count) {
      const pool = sourcePool(scenes[index]);
      if (!pool.length) return;
      const existing = new Set(tabWorkspace.tabs.map(tab => tab.tabId));
      const additions = [];
      for (let i = 0; tabWorkspace.tabs.length + additions.length < count; i++) {
        const source = pool[i % pool.length], copy = Math.floor(i / pool.length) + 1;
        const tabId = 'capture-' + source.id + '-' + copy;
        if (existing.has(tabId)) continue;
        const tab = { ...source, tabId, ...(copy > 1 ? { name: source.name + ' · ' + copy } : {}) };
        additions.push(tab); existing.add(tabId);
      }
      tabWorkspace.ensure(additions);
    }
    function layer(source) {
      const element = document.createElement('div'); element.className = 'showcase-page-layer';
      if (source.kind === 'start') {
        element.classList.add('showcase-start');
        element.lang = document.documentElement.lang || 'en'; element.dir = 'auto';
        const heading = document.createElement('h3'); heading.dataset.showcaseKey = 'showcaseNewTab';
        const prompt = document.createElement('p'); prompt.dataset.showcaseKey = 'showcaseChooseSite';
        const choices = document.createElement('div'); choices.className = 'showcase-start-choices';
        choices.setAttribute('role', 'group'); choices.dataset.showcaseAria = 'showcaseChooseSite';
        availableSources().forEach(choice => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'showcase-start-choice';
          button.dataset.showcaseSource = choice.id; button.title = choice.name;
          const mark = document.createElement('span'); mark.className = 'showcase-tab-mark'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = choice.name.slice(0, 1);
          const name = document.createElement('bdi'); name.textContent = choice.name;
          button.append(mark, name); button.addEventListener('click', () => chooseSite(source.tabId, choice));
          choices.append(button);
        });
        element.append(heading, prompt, choices);
        return element;
      }
      const image = document.createElement('img'); image.className = 'showcase-capture';
      image.alt = source.alt; image.decoding = 'async'; image.draggable = false;
      if (source.fit) image.style.objectFit = source.fit;
      if (source.position) image.style.objectPosition = source.position;
      image.addEventListener('error', () => {
        if (failed.has(source.src)) return;
        failed.add(source.src);
        // Keep the tab identity, but return a failed capture to the real chooser.
        if (sources.some(item => item.src === source.src) || tabWorkspace.tabs.some(tab => tab.src === source.src)) refreshAssets();
      }, { once: true });
      image.src = source.src; element.append(image);
      return element;
    }
    function renderPane(i, animate = true) {
      const pane = paneNodes[i], source = sources[i], body = pane.querySelector('.showcase-pane-page');
      pane.style.transform = ''; pane.classList.remove('is-grabbed','is-drop-target');
      if (!source) { body.replaceChildren(); delete pane.dataset.service; return; }
      pane.setAttribute('aria-label', source.name); pane.dataset.service = source.id;
      pane.querySelector('.showcase-service-mark').textContent = source.kind === 'start' ? '+' : source.name.slice(0,1);
      pane.querySelector('.showcase-service-name').textContent = source.name;
      pane.querySelector('.showcase-service-host').textContent = source.host;
      const previous = body.lastElementChild, sourceKey = source.src || source.tabId;
      Array.from(body.children).forEach(node => { if (node !== previous) node.remove(); });
      if (previous) { previous.classList.remove('is-old','is-new'); previous.removeAttribute('aria-hidden'); }
      if (previous?.dataset.src === sourceKey) return;
      const fresh = layer(source); fresh.dataset.src = sourceKey;
      if (previous && animate && !reduced.matches) {
        previous.setAttribute('aria-hidden','true'); fresh.classList.add('is-new'); body.append(fresh);
        requestAnimationFrame(() => {
          if (previous.parentNode === body) previous.classList.add('is-old');
          if (fresh.parentNode === body) fresh.classList.remove('is-new');
        });
      } else body.replaceChildren(fresh);
    }
    function baseRects() {
      const scene = scenes[index];
      const selected = layouts.find(item => item.id === layoutId);
      if (selected && sources.length === selected.columns * selected.rows) return uniformGrid(selected.columns, selected.rows);
      return cloneRects(sources.length === scene.count ? (expanded && portrait.matches ? scene.portrait : scene.rects) : balanced(sources.length));
    }
    function drawRect(element, rect) {
      const [x,y,w,h] = rect;
      element.style.left = x + '%'; element.style.top = y + '%';
      element.style.width = 'calc(' + w + '% - ' + (x + w < 99.99 ? gap : 0) + 'px)';
      element.style.height = 'calc(' + h + '% - ' + (y + h < 99.99 ? gap : 0) + 'px)';
    }
    function layoutGeometry(reset = false) {
      if (reset) { geometryEpoch++; gridRects = baseRects(); }
      canvas.classList.toggle('has-zoomed-pane', zoomed >= 0);
      paneNodes.forEach((pane, i) => {
        const used = i < sources.length, obscured = zoomed >= 0 && zoomed !== i;
        pane.classList.toggle('is-unused', !used);
        pane.classList.toggle('is-zoomed', zoomed === i);
        pane.classList.toggle('is-occluded', obscured);
        pane.inert = !used || obscured;
        if (!used || obscured) pane.setAttribute('aria-hidden', 'true'); else pane.removeAttribute('aria-hidden');
        if (used) drawRect(pane, zoomed === i ? [0,0,100,100] : rectFor(i));
        const drag = pane.querySelector('.showcase-pane-drag'), zoom = pane.querySelector('.showcase-pane-zoom');
        drag.disabled = !canDrag();
        drag.tabIndex = used && !obscured && zoomed < 0 && canDrag() ? 0 : -1;
        zoom.tabIndex = used && !obscured && canExpandPane() ? 0 : -1;
        zoom.hidden = !used || !canExpandPane(); zoom.disabled = !canExpandPane();
        zoom.innerHTML = icon(zoomed === i ? 'restore' : 'expand');
        if (used) {
          const label = text(zoomed === i ? 'showcaseRestore' : 'showcaseExpand');
          zoom.setAttribute('aria-label', sources[i].name + ' — ' + label);
          zoom.title = label;
        }
      });
      drawHandles(); updateHover(); syncTabState();
    }
    function boundaries() {
      const out = [];
      for (const axis of [0,1]) {
        const cross = axis === 0 ? 1 : 0;
        const values = [...new Set(gridRects.map(rect => +rect[axis].toFixed(3)).filter(value => value > .02 && value < 99.98))].sort((a,b) => a-b);
        values.forEach((value, ordinal) => {
          const left = gridRects.filter(rect => near(rect[axis] + rect[axis + 2], value));
          const right = gridRects.filter(rect => near(rect[axis], value));
          const intervals = [];
          for (const a of left) for (const b of right) {
            const start = Math.max(a[cross], b[cross]), end = Math.min(a[cross] + a[cross + 2], b[cross] + b[cross + 2]);
            if (end - start > .02) intervals.push([start,end]);
          }
          intervals.sort((a,b) => a[0]-b[0]);
          const merged = [];
          for (const interval of intervals) {
            const last = merged.at(-1);
            if (last && interval[0] <= last[1] + .02) last[1] = Math.max(last[1], interval[1]);
            else merged.push([...interval]);
          }
          merged.forEach(([start,end], segment) => out.push({ axis, value, start, end, key: axis + ':' + ordinal + ':' + segment }));
        });
      }
      return out;
    }
    function boundaryLimits(boundary, rects = gridRects) {
      const size = boundary.axis === 0 ? canvas.clientWidth : canvas.clientHeight;
      const minimum = Math.min(boundary.axis === 0 ? 18 : 20, (boundary.axis === 0 ? 100 : 70) / Math.max(1,size) * 100);
      let min = 0, max = 100;
      for (const rect of rects) {
        if (near(rect[boundary.axis] + rect[boundary.axis + 2], boundary.value)) min = Math.max(min, rect[boundary.axis] + minimum);
        if (near(rect[boundary.axis], boundary.value)) max = Math.min(max, rect[boundary.axis] + rect[boundary.axis + 2] - minimum);
      }
      return { min, max };
    }
    function resized(rects, boundary, target) {
      const { min,max } = boundaryLimits(boundary, rects), value = clamp(target,min,max), delta = value - boundary.value;
      return rects.map(rect => {
        const result = [...rect];
        if (near(rect[boundary.axis] + rect[boundary.axis + 2], boundary.value)) result[boundary.axis + 2] += delta;
        else if (near(rect[boundary.axis], boundary.value)) { result[boundary.axis] += delta; result[boundary.axis + 2] -= delta; }
        return result;
      });
    }
    function drawHandles() {
      const active = new Set();
      for (const boundary of canResize() ? boundaries() : []) {
        active.add(boundary.key);
        let handle = handles.get(boundary.key);
        if (!handle) {
          handle = document.createElement('button'); handle.type = 'button';
          handle.className = 'showcase-resize-handle'; handle.setAttribute('role','separator');
          handle.addEventListener('keydown', event => {
            const current = handle.geometry, horizontal = current.axis === 0;
            if (!canResize() || zoomed >= 0 || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
            if ((horizontal && /Up|Down/.test(event.key)) || (!horizontal && /Left|Right/.test(event.key))) return;
            event.preventDefault(); manual();
            const limits = boundaryLimits(current), step = event.shiftKey ? 5 : 2;
            const target = event.key === 'Home' ? limits.min : event.key === 'End' ? limits.max : current.value + (/Left|Up/.test(event.key) ? -step : step);
            gridRects = resized(gridRects, current, target); layoutGeometry();
          });
          canvas.insertBefore(handle,cursor); handles.set(boundary.key,handle);
        }
        handle.geometry = boundary; handle.dataset.axis = boundary.axis === 0 ? 'x' : 'y';
        handle.hidden = zoomed >= 0;
        handle.tabIndex = zoomed < 0 ? 0 : -1;
        handle.setAttribute('aria-label', text('showcaseResize'));
        handle.lang = document.documentElement.lang || 'en';
        handle.setAttribute('aria-orientation', boundary.axis === 0 ? 'vertical' : 'horizontal');
        const limits = boundaryLimits(boundary);
        handle.setAttribute('aria-valuemin', String(Math.round(limits.min)));
        handle.setAttribute('aria-valuemax', String(Math.round(limits.max)));
        handle.setAttribute('aria-valuenow', String(Math.round(boundary.value)));
        if (boundary.axis === 0) {
          handle.style.left = 'calc(' + boundary.value + '% - ' + gap/2 + 'px)'; handle.style.top = boundary.start + '%';
          handle.style.height = (boundary.end-boundary.start) + '%'; handle.style.width = '';
        } else {
          handle.style.top = 'calc(' + boundary.value + '% - ' + gap/2 + 'px)'; handle.style.left = boundary.start + '%';
          handle.style.width = (boundary.end-boundary.start) + '%'; handle.style.height = '';
        }
      }
      for (const [key,handle] of handles) if (!active.has(key)) { handle.remove(); handles.delete(key); }
    }
    function point(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      return { x:(clientX-box.left)/Math.max(1,box.width)*100, y:(clientY-box.top)/Math.max(1,box.height)*100 };
    }
    function controlPoint(paneIndex, selector) {
      const box = paneNodes[paneIndex].querySelector(selector).getBoundingClientRect();
      return point(box.left + box.width/2,box.top + box.height/2);
    }
    function paneAt(position, exclude = -1) {
      if (zoomed >= 0) return zoomed === exclude ? -1 : zoomed;
      return sources.findIndex((_,i) => {
        const rect = rectFor(i);
        return i !== exclude && position.x >= rect[0] && position.x <= rect[0]+rect[2] && position.y >= rect[1] && position.y <= rect[1]+rect[3];
      });
    }
    function updateHover() {
      const target = hoverPoint ? paneAt(point(hoverPoint.x,hoverPoint.y)) : -1;
      paneNodes.forEach((pane,i) => pane.classList.toggle('is-hovered',i === target));
    }
    function swap(a,b) {
      if (swapKind() === 'none' || !sources[a] || !sources[b]) return;
      [paneSlots[a],paneSlots[b]] = [paneSlots[b],paneSlots[a]];
      layoutGeometry();
    }
    function setZoom(value, focus = false) {
      if (value >= 0 && !canExpandPane()) return;
      if (value >= 0) activePane = value;
      zoomed = value; layoutGeometry();
      if (focus && value >= 0) paneNodes[value].querySelector('.showcase-pane-zoom').focus({ preventScroll:true });
    }
    function after(callback, delay) {
      const timer = setTimeout(() => { timers.delete(timer); if (canPlay()) callback(); },delay);
      timers.add(timer);
    }
    function clearMotion() {
      if (autoDragged) { autoDragged.classList.remove('is-grabbed'); autoDragged.style.transform = ''; autoDragged = null; }
      paneNodes.forEach(pane => pane.classList.remove('is-drop-target'));
      cursor.hidden = true; cursor.classList.remove('is-pressed');
      delete root.dataset.autoAction;
    }
    function stopPlayback() {
      timers.forEach(clearTimeout); timers.clear(); clearMotion();
      root.classList.remove('is-playing');
      modes.querySelectorAll('button').forEach(button => button.classList.remove('is-counting'));
      desktopButtons.querySelectorAll('button').forEach(button => button.classList.remove('is-counting'));
    }
    function cursorAt(x,y,label) {
      cursor.hidden = false; cursor.style.left = x + '%'; cursor.style.top = y + '%';
      cursor.querySelector('.showcase-cursor-label').textContent = label;
    }
    function demonstrate() {
      if (sources.length < 2 || zoomed >= 0) return;
      const epoch = geometryEpoch, action = scenes[index].action;
      if (action === 'drag' && !canDrag() || action === 'resize' && !canResize() || action === 'zoom' && !canExpandPane()) return;
      root.dataset.autoAction = action;
      const valid = callback => () => { if (geometryEpoch === epoch) callback(); };
      if (action === 'drag') {
        const from = 0, to = Math.min(2,sources.length-1);
        const { x,y } = controlPoint(from,'.showcase-pane-drag');
        cursorAt(x,y,text('showcaseMove'));
        after(valid(() => {
          cursor.classList.add('is-pressed'); autoDragged = paneNodes[from]; autoDragged.classList.add('is-grabbed');
          paneNodes[to].classList.add('is-drop-target');
        }),350);
        after(valid(() => {
          const target = controlPoint(to,'.showcase-pane-drag'), tx = target.x, ty = target.y, box = canvas.getBoundingClientRect();
          autoDragged.style.transform = 'translate(' + (tx-x)*box.width/100 + 'px,' + (ty-y)*box.height/100 + 'px) scale(1.018)';
          cursorAt(tx,ty,text('showcaseMove'));
        }),550);
        after(valid(() => {
          if (autoDragged) autoDragged.style.transform = '';
          swap(from,to); cursor.classList.remove('is-pressed');
        }),1150);
        after(valid(clearMotion),1750);
      } else if (action === 'resize') {
        const boundary = boundaries().sort((a,b) => (b.end-b.start)-(a.end-a.start))[0];
        if (!boundary) return;
        const middle = (boundary.start+boundary.end)/2;
        cursorAt(boundary.axis === 0 ? boundary.value : middle,boundary.axis === 0 ? middle : boundary.value,text('showcaseResize'));
        after(valid(() => cursor.classList.add('is-pressed')),300);
        after(valid(() => {
          const limits = boundaryLimits(boundary), target = clamp(boundary.value + (boundary.value>55?-16:17),limits.min,limits.max);
          gridRects = resized(gridRects,boundary,target); layoutGeometry();
          cursorAt(boundary.axis === 0 ? target : middle,boundary.axis === 0 ? middle : target,text('showcaseResize'));
        }),500);
        after(valid(() => cursor.classList.remove('is-pressed')),1150);
        after(valid(clearMotion),1700);
      } else {
        const target = 0, position = controlPoint(target,'.showcase-pane-zoom');
        cursorAt(position.x,position.y,text('showcaseExpand'));
        after(valid(() => cursor.classList.add('is-pressed')),300);
        after(valid(() => { setZoom(target); cursor.classList.remove('is-pressed'); cursor.hidden = true; }),470);
        after(valid(() => { const restored = controlPoint(target,'.showcase-pane-zoom'); cursorAt(restored.x,restored.y,text('showcaseRestore')); }),1900);
        after(valid(() => { cursor.classList.add('is-pressed'); }),2200);
        after(valid(() => { setZoom(-1); clearMotion(); }),2400);
      }
    }
    function schedule() {
      stopPlayback();
      if (!canPlay()) return;
      if (zoomed >= 0) setZoom(-1);
      root.classList.add('is-playing');
      const active = browserId === 'mouse' ? desktopButtons.children[mouseDesktops.indexOf(index)] : modes.children[index];
      requestAnimationFrame(() => { if (root.classList.contains('is-playing')) active?.classList.add('is-counting'); });
      if (!reduced.matches) after(demonstrate,550);
      after(() => advanceScene(1),duration);
    }
    function manual() {
      userPaused = true; stopPlayback(); closePicker(); refreshLanguage();
    }
    function refreshLanguage() {
      const scene = scenes[index], language = document.documentElement.lang || 'en';
      tabWorkspace.tabs.forEach((source, i) => {
        if (source.kind !== 'start') return;
        source.name = text('showcaseNewTab');
        const tab = tabNodes[i];
        if (tab) { tab.title = source.name; tab.lastElementChild.textContent = source.name; tab.lang = language; }
      });
      root.querySelectorAll('[data-showcase-key]').forEach(node => { node.textContent = text(node.dataset.showcaseKey); node.lang=language; node.dir='auto'; });
      root.querySelectorAll('[data-showcase-aria]').forEach(node => { node.setAttribute('aria-label',text(node.dataset.showcaseAria)); node.lang=language; });
      newTabButton.title = text('showcaseNewTab');
      modes.lang=language; modes.dir='auto';
      const organizationKey = profile.organization === 'workspaces' ? 'demoWorkspaces' : 'demoScenes';
      modes.dataset.showcaseAria = organizationKey; modes.setAttribute('aria-label', text(organizationKey));
      organizationLabel.textContent = text(organizationKey); organizationLabel.lang = language; organizationLabel.dir = 'auto';
      desktopBar.lang = language;
      desktopButtons.querySelectorAll('button').forEach((button, ordinal) => {
        const sceneIndex = mouseDesktops[ordinal], name = text('showcase' + scenes[sceneIndex].key);
        button.querySelector('.showcase-desktop-name').textContent = name;
        const label = text('demoDesktop').replace('{number}', String(ordinal + 1)).replace('{name}', name);
        button.title = label; button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(index === sceneIndex));
      });
      swapButton.title = text('demoSwap');
      for (const selector of ['[data-showcase-title]','[data-showcase-chrome-scene]']) root.querySelectorAll(selector).forEach(node => {
        node.textContent = text('showcase'+scene.key); node.lang = language; node.dir = 'auto';
      });
      root.querySelectorAll('[data-showcase-description]').forEach(node => { node.textContent = text('showcase'+scene.key+'Text'); node.lang = language; node.dir = 'auto'; });
      const pause = root.querySelector('[data-showcase-pause]');
      pause.innerHTML = icon(userPaused ? 'play' : 'pause'); pause.lang=language;
      pause.setAttribute('aria-label',text(userPaused ? 'showcasePlay' : 'showcasePause'));
      pause.setAttribute('aria-pressed',String(userPaused));
      paneNodes.forEach((pane,i) => {
        if (!sources[i]) return;
        const drag = pane.querySelector('.showcase-pane-drag'), zoom = pane.querySelector('.showcase-pane-zoom');
        if (sources[i].kind === 'start') {
          pane.setAttribute('aria-label', sources[i].name);
          pane.querySelector('.showcase-service-name').textContent = sources[i].name;
          const start = pane.querySelector('.showcase-start');
          if (start) { start.lang = language; start.dir = 'auto'; }
        }
        drag.lang = language; zoom.lang = language;
        drag.setAttribute('aria-label',sources[i].name + (canDrag() ? ' — ' + text('showcaseMove') : ''));
        drag.title = canDrag() ? text('showcaseMove') : sources[i].host;
        zoom.setAttribute('aria-label',sources[i].name + ' — ' + text(zoomed === i ? 'showcaseRestore' : 'showcaseExpand'));
        zoom.title = text(zoomed === i ? 'showcaseRestore' : 'showcaseExpand');
      });
      handles.forEach(handle => { handle.setAttribute('aria-label',text('showcaseResize')); handle.lang = language; });
      cursor.querySelector('.showcase-cursor-label').lang = language;
      layoutPicker.lang = language;
      layoutPicker.querySelector('[data-showcase-layout-label]').textContent = text('showcaseWindows') + ' · ' + sources.length;
      layoutMenu.querySelectorAll('button').forEach(button => {
        const layout = layouts.find(item => item.id === button.dataset.layout), count = layout.columns * layout.rows;
        button.querySelector('.showcase-layout-description').textContent = layout.key ? text(layout.key) : '';
        button.setAttribute('aria-label', text('showcaseWindows') + ': ' + count + (layout.key ? ' — ' + text(layout.key) : ''));
        button.setAttribute('aria-pressed', String(layout.id === layoutId));
      });
      syncTabState();
    }
    function rememberCurrent() {
      if (!sceneReady) return;
      stateBank.remember(browserId, index, {
        tabs: tabWorkspace.snapshot(), layoutId, sources: sources.map(source => source.tabId),
        gridRects, paneSlots, activePane, zoomed
      });
    }
    function placeTabs(previous = [], activeId = '') {
      const selected = layouts.find(item => item.id === layoutId);
      const count = selected ? selected.columns * selected.rows : scenes[index].count;
      ensureCaptureTabs(count);
      sources = chooseVisibleTabs(tabWorkspace.tabs, previous, count, activeId);
      activePane = Math.max(0, sources.findIndex(source => source.tabId === activeId));
      paneSlots = sources.map((_, i) => i); zoomed = -1; geometryEpoch++;
      gridRects = baseRects();
    }
    function loadScene(sceneIndex) {
      index = sceneIndex;
      const saved = stateBank.recall(browserId, index);
      if (saved) {
        tabWorkspace.restore(saved.tabs);
        tabWorkspace.refresh(availableSources(), text('showcaseNewTab'));
        layoutId = saved.layoutId === null && browserId === 'mouse' ? null : allowedLayout(saved.layoutId) ? saved.layoutId : allowedLayout(profile.defaultLayout) ? profile.defaultLayout : '1';
        const byId = new Map(tabWorkspace.tabs.map(tab => [tab.tabId, tab]));
        sources = saved.sources.map(id => byId.get(id)).filter(Boolean);
        if (layoutId !== saved.layoutId || sources.length !== saved.sources.length || !sources.length && availableSources().length) placeTabs(sources, byId.get(saved.sources[saved.activePane])?.tabId);
        else {
          gridRects = cloneRects(saved.gridRects); paneSlots = [...saved.paneSlots];
          activePane = clamp(saved.activePane, 0, Math.max(0, sources.length - 1));
          zoomed = canExpandPane() && saved.zoomed < sources.length ? saved.zoomed : -1;
          geometryEpoch++;
        }
      } else {
        tabWorkspace.restore({ base: [], added: [], sequence: 0 });
        layoutId = allowedLayout(profile.defaultLayout) ? profile.defaultLayout : browserId === 'mouse' ? null : '1';
        placeTabs();
      }
      sceneReady = true;
    }
    function renderCurrent(animate = true) {
      root.dataset.scene = scenes[index].id;
      root.dataset.layout = layoutId || 'scene';
      root.dataset.windowCount = String(sources.length);
      root.dataset.tabCount = String(tabWorkspace.tabs.length);
      updateProfileUI();
      paneNodes.forEach((_,i) => renderPane(i, animate));
      refreshTabs();
      layoutGeometry();
      cleanTimer = setTimeout(() => root.querySelectorAll('.showcase-page-layer.is-old').forEach(node => node.remove()),600);
      modes.querySelectorAll('button').forEach((button,i) => button.setAttribute('aria-pressed',String(i===index)));
      refreshLanguage();
    }
    function select(next, announceChange = false) {
      stopPlayback(); cancelGesture(); clearTimeout(cleanTimer); rememberCurrent();
      const available = sequence(), normalized = ((next % scenes.length) + scenes.length) % scenes.length;
      loadScene(available.includes(normalized) ? normalized : available[0]);
      renderCurrent(); rememberCurrent(); notifyBrowser();
      if (announceChange) announce(text('showcase' + scenes[index].key));
      schedule();
    }
    function advanceScene(direction) {
      const order = sequence(), current = order.indexOf(index);
      select(order[(current + direction + order.length) % order.length], true);
    }
    function changeLayout(id) {
      if (!allowedLayout(id)) return false;
      stopPlayback(); cancelGesture(); clearTimeout(cleanTimer);
      const activeId = sources[activePane]?.tabId;
      const ordered = sources.map((source, i) => ({ source, slot: paneSlots[i] })).sort((a, b) => a.slot - b.slot).map(item => item.source);
      layoutId = id; placeTabs(ordered, activeId);
      renderCurrent(false); rememberCurrent(); notifyBrowser();
      return true;
    }
    function setBrowser(id) {
      const next = browserProfiles().get(id);
      if (!next) return false;
      if (id === browserId) {
        manual(); cancelGesture(); rememberCurrent(); notifyBrowser();
        return true;
      }
      stopPlayback(); cancelGesture(); clearTimeout(cleanTimer); closePicker(); rememberCurrent();
      userPaused = true; browserId = id; profile = next;
      loadScene(stateBank.lastScene(id) ?? 4);
      renderCurrent(false); rememberCurrent(); notifyBrowser();
      return true;
    }
    function refreshAssets() {
      stopPlayback(); cancelGesture(); clearTimeout(cleanTimer);
      const previous = sources, activeId = sources[activePane]?.tabId;
      tabWorkspace.refresh(availableSources(), text('showcaseNewTab'));
      const byId = new Map(tabWorkspace.tabs.map(tab => [tab.tabId, tab]));
      sources = previous.map(source => byId.get(source.tabId)).filter(Boolean);
      if (sources.length !== previous.length || !sources.length && availableSources().length) placeTabs(sources, activeId);
      geometryEpoch++; renderCurrent(false); rememberCurrent(); notifyBrowser(); schedule();
    }
    function cancelGesture() {
      if (!gesture) return;
      const ended=gesture; gesture=null;
      if (canvas.hasPointerCapture?.(ended.id)) canvas.releasePointerCapture(ended.id);
      if (ended.kind === 'drag') paneNodes[ended.pane].style.transform = '';
      paneNodes.forEach(pane => pane.classList.remove('is-grabbed','is-drop-target'));
      root.classList.remove('is-manipulating');
    }
    canvas.addEventListener('pointerdown',event => {
      if (gesture || !event.isPrimary || event.button !== 0) return;
      const selectedPane = event.target.closest('.showcase-pane');
      if (selectedPane) {
        activePane = Number(selectedPane.dataset.paneIndex); syncTabState();
      }
      if (zoomed >= 0) return;
      const drag = event.target.closest('.showcase-pane-drag'), handle = event.target.closest('.showcase-resize-handle');
      if (!drag && !handle) return;
      if (drag && !canDrag() || handle && !canResize()) return;
      manual(); event.preventDefault();
      if (drag) {
        const pane = Number(drag.closest('.showcase-pane').dataset.paneIndex);
        activePane = pane; syncTabState();
        gesture = { kind:'drag', id:event.pointerId, pane, startX:event.clientX, startY:event.clientY, target:-1, focus:drag };
        paneNodes[pane].classList.add('is-grabbed');
      } else {
        gesture = { kind:'resize', id:event.pointerId, boundary:{...handle.geometry}, rects:cloneRects(gridRects), focus:handle };
      }
      root.classList.add('is-manipulating'); canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      event.preventDefault();
      const position = point(event.clientX,event.clientY);
      if (gesture.kind === 'drag') {
        paneNodes[gesture.pane].style.transform = 'translate('+(event.clientX-gesture.startX)+'px,'+(event.clientY-gesture.startY)+'px) scale(1.018)';
        gesture.target = paneAt(position,gesture.pane);
        paneNodes.forEach((pane,i) => pane.classList.toggle('is-drop-target',i===gesture.target));
      } else {
        gridRects = resized(gesture.rects,gesture.boundary,gesture.boundary.axis === 0 ? position.x : position.y);
        layoutGeometry();
      }
    });
    canvas.addEventListener('pointerup',event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const ended = gesture;
      cancelGesture();
      if (ended.kind === 'drag' && ended.target >= 0) { swap(ended.pane,ended.target); announce(sources[ended.pane].name + ' — ' + text('showcaseMove')); }
      if (ended.focus.isConnected) ended.focus.focus({ preventScroll:true });
    });
    canvas.addEventListener('pointercancel',cancelGesture);
    canvas.addEventListener('lostpointercapture',() => { if (gesture) cancelGesture(); });
    canvas.addEventListener('focusin',event => {
      manual();
      const pane = event.target.closest('.showcase-pane');
      if (pane) { activePane = Number(pane.dataset.paneIndex); syncTabState(); }
    });
    frame.addEventListener('keydown',event => {
      if (event.key === 'Escape' && zoomed >= 0) {
        event.preventDefault(); event.stopPropagation(); const previous = zoomed; manual(); setZoom(-1);
        paneNodes[previous].querySelector('.showcase-pane-zoom').focus({ preventScroll:true });
      }
    });
    frame.addEventListener('pointermove',event => { if (event.pointerType !== 'touch') { hoverPoint={x:event.clientX,y:event.clientY}; updateHover(); } });
    frame.addEventListener('pointerleave',() => { hoverPoint=null; updateHover(); });

    function expand() {
      if (expanded || typeof dialog.showModal !== 'function') return;
      manual(); savedScroll=window.scrollY; savedFocus=document.activeElement;
      savedOverflow=document.documentElement.style.overflow;
      dock.style.height=dock.getBoundingClientRect().height+'px';
      dialogHost.append(experience); dialog.showModal(); document.documentElement.style.overflow='hidden';
      expanded=true; visible=true; wheel=0; root.classList.add('is-expanded');
      layoutGeometry(); root.querySelector('[data-showcase-close]').focus({ preventScroll:true }); schedule();
    }
    function restore() {
      if (!expanded) return;
      stopPlayback(); cancelGesture(); closePicker(); expanded=false;
      root.classList.remove('is-expanded'); dock.append(experience); dock.style.height='';
      layoutGeometry(); document.documentElement.style.overflow=savedOverflow;
      const behavior=document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,savedScroll);
      if (savedFocus?.isConnected && typeof savedFocus.focus === 'function') savedFocus.focus({ preventScroll:true });
      requestAnimationFrame(() => { document.documentElement.style.scrollBehavior=behavior; });
      visible=root.getBoundingClientRect().bottom>0 && root.getBoundingClientRect().top<innerHeight;
      hoverPoint=null; updateHover(); schedule();
    }
    root.querySelector('[data-showcase-expand]').addEventListener('click',expand);
    root.querySelector('[data-showcase-preview-hit]')?.addEventListener('click',expand);
    root.querySelector('[data-showcase-close]').addEventListener('click',() => dialog.close());
    dialog.addEventListener('close',restore);
    dialog.addEventListener('cancel',event => {
      if (zoomed>=0) { event.preventDefault(); const previous=zoomed; manual(); setZoom(-1); paneNodes[previous].querySelector('.showcase-pane-zoom').focus({ preventScroll:true }); }
    });
    dialog.addEventListener('click',event => { if (event.target===dialog) dialog.close(); });
    root.querySelector('[data-showcase-pause]').addEventListener('click',() => {
      userPaused=!userPaused; refreshLanguage(); schedule();
    });
    root.querySelector('[data-showcase-previous]').addEventListener('click',() => { manual(); advanceScene(-1); });
    root.querySelector('[data-showcase-next]').addEventListener('click',() => { manual(); advanceScene(1); });
    document.addEventListener('pointerdown',event => {
      if (!layoutPicker.contains(event.target)) layoutPicker.open = false;
      if (modePicker && !modePicker.contains(event.target)) modePicker.open = false;
    });
    if (typeof dialog.showModal === 'function') {
      root.classList.add('showcase-gesture-enabled');
      frame.addEventListener('wheel',event => {
        if (expanded || userPaused || gesture || event.target.closest('button,summary,details') || event.ctrlKey || event.metaKey || Math.abs(event.deltaX)>Math.abs(event.deltaY)) return;
        const now=performance.now(); if(now-wheelAt>350)wheel=0;
        wheelAt=now; wheel+=Math.max(0,-event.deltaY);
        if(event.deltaY>=0){wheel=0;return;}
        if(wheel>=42){event.preventDefault();expand();}
      },{passive:false});
      frame.addEventListener('touchstart',event => {
        touch=!expanded&&!userPaused&&!gesture&&!event.target.closest('button,summary,details')&&event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY,time:performance.now()}:null;
      },{passive:true});
      frame.addEventListener('touchmove',event => {
        if(!touch||expanded||event.touches.length!==1)return;
        const dx=event.touches[0].clientX-touch.x,dy=touch.y-event.touches[0].clientY;
        const upward=dy>6&&Math.abs(dx)<dy*.65&&performance.now()-touch.time<1100;
        if(upward)event.preventDefault(); if(upward&&dy>58){touch=null;expand();}
      },{passive:false});
      frame.addEventListener('touchend',()=>{touch=null;},{passive:true});
      frame.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { if(!expanded){visible=entries[0].isIntersecting;schedule();} },{threshold:.1}).observe(root);
    }
    document.addEventListener('visibilitychange',schedule);
    document.addEventListener('mouse:language',refreshLanguage);
    new MutationObserver(refreshLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    const onReduced=()=>{if(reduced.matches)userPaused=true;refreshLanguage();schedule();};
    const onPortrait=()=>{cancelGesture();clearMotion();layoutGeometry(!userPaused && !layoutId);};
    if(reduced.addEventListener)reduced.addEventListener('change',onReduced);else reduced.addListener?.(onReduced);
    if(portrait.addEventListener)portrait.addEventListener('change',onPortrait);else portrait.addListener?.(onPortrait);
    root.querySelectorAll('[data-showcase-interactive]').forEach(node=>{node.hidden=false;});
    if(typeof dialog.showModal!=='function'){
      root.querySelector('[data-showcase-expand]').hidden=true;
      const hit=root.querySelector('[data-showcase-preview-hit]');if(hit)hit.hidden=true;
      const hint=root.querySelector('.showcase-hint');if(hint)hint.hidden=true;
    }
    select(index);
    return { refreshLanguage, setBrowser, setAssets(value){assets=value&&typeof value==='object'?value:{};failed.clear();refreshAssets();} };
  }
  function init(){controller=create(document.getElementById('mouse-showcase'))||controller;return controller;}
  window.MouseShowcase=Object.freeze({init,refreshLanguage(){controller?.refreshLanguage();},setBrowser(id){return (controller || init())?.setBrowser(id) || false;},setAssets(value){controller?.setAssets(value);}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
