/* Local HTML scenes. Public screenshots, when supplied, are served by mouse.black. */
(() => {
  'use strict';
  const EN = {
    showcaseTitle: 'Your workspace, in motion',
    showcaseSupport: 'Support', showcaseSupportText: 'Messages, maps and mail — together',
    showcaseTrading: 'Trading', showcaseTradingText: 'Charts, news and your research — in view',
    showcaseAi: 'AI', showcaseAiText: 'Compare ideas and keep your documents beside them',
    showcaseDevelopment: 'Development', showcaseDevelopmentText: 'Your editor, assistant and documentation — side by side',
    showcaseContent: 'Content', showcaseContentText: 'Create, review and plan in one workspace',
    showcaseDesign: 'Design', showcaseDesignText: 'Your canvas, references and ideas — connected',
    showcaseExpand: 'Explore full screen', showcaseClose: 'Close', showcasePause: 'Pause',
    showcasePlay: 'Play', showcasePrevious: 'Previous scene', showcaseNext: 'Next scene',
    showcaseHint: 'Swipe up over the preview to explore', showcaseDemo: 'Demo scenes',
    showcaseScenesLabel: 'Workspaces'
  };
  const icon = (name) => {
    const paths = {
      expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
      play: '<path d="m9 5 11 7-11 7Z"/>',
      previous: '<path d="m15 5-7 7 7 7"/>',
      next: '<path d="m9 5 7 7-7 7"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
  };
  const lines = '<div class="showcase-note-lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>';
  const mini = (initial, name, copy) => '<div class="showcase-mini-row"><span class="showcase-avatar">' + initial + '</span><span class="showcase-mini-copy"><b>' + name + '</b><small>' + copy + '</small></span></div>';
  const page = (content) => '<div class="showcase-demo-page">' + content + '</div>';
  const docs = page('<div class="showcase-demo-eyebrow">Working document</div><h3>Launch notes</h3><p>One shared view of the next steps</p><h4>Make room for good work</h4><p>Keep the brief, your references and the conversation close at hand</p>' + mini('1', 'Explore', 'Collect the useful details') + mini('2', 'Create', 'Turn the idea into a first draft') + mini('3', 'Review', 'Refine it with the team') + lines);
  const chatgpt = page('<div class="showcase-demo-eyebrow">ChatGPT</div><div class="showcase-ai-heading">Let’s work through it</div><div class="showcase-ai-prompt">Help me turn this project brief into a clear plan</div><div class="showcase-answer"><p>Here is a practical starting point</p><ul><li>Define the main idea</li><li>Collect the essential material</li><li>Create a first version</li></ul><p>Keep the brief open beside this conversation as you refine it</p></div>');
  const claude = page('<div class="showcase-demo-eyebrow">Claude</div><div class="showcase-ai-heading">A fresh perspective</div><div class="showcase-ai-prompt">Review this idea and suggest a simpler approach</div><div class="showcase-answer"><p>Start with the part that matters most</p><p>Use one clear example, then add only what helps explain it</p><ul><li>Make the structure easy to follow</li><li>Keep the next step visible</li></ul></div>');
  const map = '<div class="showcase-map"><svg viewBox="0 0 500 400" preserveAspectRatio="xMidYMid slice" aria-label="Illustrative city map"><rect width="500" height="400" fill="currentColor" opacity=".08"/><g fill="none" stroke="currentColor" opacity=".27" stroke-width="11"><path d="M-20 60 520 350M-20 350 520 60M90-20 150 420M320-20 270 420M-20 180 520 180M-20 285 520 265"/></g><path d="M20 400C180 280 70 160 220 0" fill="none" stroke="currentColor" stroke-width="34" opacity=".13"/><g fill="currentColor"><circle cx="320" cy="190" r="9"/><circle cx="174" cy="130" r="6" opacity=".5"/><circle cx="244" cy="288" r="6" opacity=".5"/></g><circle cx="320" cy="190" r="21" fill="none" stroke="currentColor" opacity=".3"/><text x="342" y="195" fill="currentColor" font-family="Arial,sans-serif" font-size="13">Meeting point</text></svg><span class="showcase-map-label">Search Google Maps</span><span class="showcase-map-attribution">Illustrative workspace</span></div>';
  const chart = '<div class="showcase-chart-page"><div class="showcase-chart-heading"><strong>Market overview</strong><span>Illustrative chart · 1D</span></div><svg class="showcase-chart" viewBox="0 0 600 290" preserveAspectRatio="none" aria-label="Illustrative market chart, not live prices"><g class="showcase-chart-grid"><path d="M0 50H600M0 100H600M0 150H600M0 200H600M0 250H600M100 0V290M200 0V290M300 0V290M400 0V290M500 0V290"/></g><g class="showcase-chart-volume"><path d="M15 290v-22h14v22M40 290v-33h14v33M65 290v-26h14v26M90 290v-40h14v40M115 290v-35h14v35M140 290v-55h14v55M165 290v-28h14v28M190 290v-42h14v42M215 290v-50h14v50M240 290v-40h14v40M265 290v-57h14v57M290 290v-66h14v66M315 290v-30h14v30M340 290v-40h14v40M365 290v-45h14v45M390 290v-61h14v61M415 290v-76h14v76M440 290v-52h14v52M465 290v-48h14v48M490 290v-35h14v35M515 290v-65h14v65M540 290v-74h14v74M565 290v-65h14v65"/></g><path class="showcase-chart-line" d="M0 210 20 192 40 200 60 170 80 187 100 163 120 171 140 143 160 159 180 128 200 140 220 109 240 120 260 85 280 99 300 122 320 110 340 135 360 113 380 87 400 102 420 66 440 87 460 70 480 98 500 79 520 63 540 47 560 60 580 41 600 48"/></svg></div>';
  const code = `<div class="showcase-code"><aside class="showcase-code-files"><b>EXPLORER</b><span>⌄ studio-site</span><span>　⌄ src</span><span>　　App.tsx</span><span>　　styles.css</span><span>　　main.tsx</span><span>　package.json</span></aside><div class="showcase-code-main"><pre><em>import</em> { useState } <em>from</em> "react";

<em>export default function</em> Workspace() {
  const [mode, setMode] = useState("create");

  return (
    &lt;main className="workspace"&gt;
      &lt;h1&gt;Make room for your ideas&lt;/h1&gt;
      &lt;Canvas mode={mode} /&gt;
    &lt;/main&gt;
  );
}</pre><div class="showcase-code-terminal">TERMINAL<br>Local development workspace<br>Ready for your next idea</div></div></div>`;
  const figma = '<div class="showcase-figma"><aside class="showcase-figma-layers"><b>Design file</b><span>Layers</span><span>⌄ Landing</span><span>　Header</span><span>　Hero</span><span>　Canvas</span><span>　Footer</span></aside><div class="showcase-figma-canvas"><div class="showcase-figma-artboard"><div class="showcase-artboard-logo">STUDIO / FORM</div><div class="showcase-artboard-title">Make<br>space<br>for ideas</div><div class="showcase-artboard-footer"><span>Thoughtfully made</span><span>Explore</span></div></div></div></div>';
  const play = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 4 13 8-13 8Z"/></svg>';
  const services = {
    telegram: { name: 'Telegram', host: 'web.telegram.org', mark: 'T', html: page('<div class="showcase-demo-eyebrow">Support team</div><div class="showcase-bubble">Could you share the meeting location?</div><div class="showcase-bubble is-mine">I have the map open — sending the details next</div>' + mini('S', 'Support', 'Keep the conversation in view')) },
    whatsapp: { name: 'WhatsApp', host: 'web.whatsapp.com', mark: 'W', html: page('<div class="showcase-demo-eyebrow">Customer conversations</div>' + mini('A', 'Alex', 'Thanks, that is helpful') + mini('J', 'Jamie', 'A quick question about the plan') + mini('R', 'Robin', 'Ready when you are')) },
    maps: { name: 'Google Maps', host: 'maps.google.com', mark: 'G', html: map },
    mail: { name: 'Gmail', host: 'mail.google.com', mark: 'M', html: page('<h4>Inbox</h4>' + mini('B', 'Project brief', 'The details for our next meeting') + mini('T', 'Team update', 'Notes and shared documents') + mini('C', 'Customer enquiry', 'A question about availability')) },
    slack: { name: 'Slack', host: 'slack.com', mark: 'S', html: page('<div class="showcase-demo-eyebrow"># team-support</div><div class="showcase-bubble">The updated guide is ready for review</div><p>Keep your team close while you help customers</p>') },
    tradingview: { name: 'TradingView', host: 'tradingview.com', mark: 'T', html: chart },
    calendar: { name: 'Economic calendar', host: 'investing.com', mark: 'C', html: page('<h4>Research calendar</h4>' + mini('•', 'Market briefing', 'Read the latest releases') + mini('•', 'Economic indicators', 'Compare the published data') + mini('•', 'Company reports', 'Review the source material')) },
    news: { name: 'Financial news', host: 'reuters.com', mark: 'R', html: page('<div class="showcase-demo-eyebrow">Research desk</div><h4>Read the story behind the chart</h4><p>Keep original reporting and source documents beside your analysis</p>' + lines) },
    watchlist: { name: 'Watchlist', host: 'tradingview.com', mark: 'W', html: page('<h4>Research list</h4><table class="showcase-watch"><tbody><tr><td>Equities</td><td>Review</td></tr><tr><td>Currencies</td><td>Review</td></tr><tr><td>Commodities</td><td>Review</td></tr></tbody></table>') },
    notes: { name: 'Research notes', host: 'docs.google.com', mark: 'N', html: page('<h4>Trading journal</h4><p>Write down your reasoning</p>' + mini('1', 'Sources', 'What changed?') + mini('2', 'Questions', 'What needs checking?') + lines) },
    chatgpt: { name: 'ChatGPT', host: 'chatgpt.com', mark: 'C', html: chatgpt },
    claude: { name: 'Claude', host: 'claude.ai', mark: 'C', html: claude },
    docs: { name: 'Google Docs', host: 'docs.google.com', mark: 'D', html: docs },
    vscode: { name: 'VS Code for the Web', host: 'vscode.dev', mark: 'V', html: code },
    mdn: { name: 'MDN Web Docs', host: 'developer.mozilla.org', mark: 'M', html: page('<div class="showcase-demo-eyebrow">Web documentation</div><h3>CSS grid layout</h3><p>A flexible foundation for two-dimensional layouts</p><h4>Build with the documentation beside you</h4>' + lines) },
    figma: { name: 'Figma', host: 'figma.com', mark: 'F', html: figma },
    youtube: { name: 'YouTube', host: 'youtube.com', mark: 'Y', html: page('<div class="showcase-video">' + play + '</div><h4>From a first sketch to a finished idea</h4><p>Review your references as you create</p>') },
    instagram: { name: 'Instagram', host: 'instagram.com', mark: 'I', html: page('<h4>studio.form</h4><p>Ideas, experiments and things in progress</p><div class="showcase-social-grid"><span>Aa</span><span>FORM</span><span>◯</span><span>GRID</span><span>✳</span><span>TYPE</span></div>') },
    plan: { name: 'Content plan', host: 'docs.google.com', mark: 'P', html: page('<h4>From idea to publish</h4>' + mini('✓', 'Collect references', 'Ready') + mini('2', 'Create the draft', 'In progress') + mini('3', 'Review together', 'Next')) },
    references: { name: 'Design references', host: 'figma.com', mark: 'R', html: page('<div class="showcase-demo-eyebrow">Visual direction</div><h3>Less noise<br>More clarity</h3><div class="showcase-social-grid"><span>Aa</span><span>◯</span><span>↗</span></div>') }
  };
  const scenes = [
    { id: 'support', key: 'Support', panes: ['telegram','whatsapp','maps','mail','slack'], rects: [[0,0,26,50],[0,50,26,50],[26,0,45,100],[71,0,29,50],[71,50,29,50]] },
    { id: 'trading', key: 'Trading', panes: ['tradingview','calendar','news','watchlist','notes'], rects: [[0,0,65,66],[65,0,35,66],[0,66,40,34],[40,66,25,34],[65,66,35,34]] },
    { id: 'ai', key: 'Ai', panes: ['chatgpt','claude','docs'], rects: [[0,0,33,100],[33,0,33,100],[66,0,34,100]] },
    { id: 'development', key: 'Development', panes: ['vscode','claude','mdn'], rects: [[0,0,67,100],[67,0,33,60],[67,60,33,40]] },
    { id: 'content', key: 'Content', panes: ['figma','youtube','instagram','plan'], rects: [[0,0,55,65],[55,0,45,65],[0,65,55,35],[55,65,45,35]] },
    { id: 'design', key: 'Design', panes: ['figma','chatgpt','references'], rects: [[0,0,68,100],[68,0,32,62],[68,62,32,38]] }
  ];
  const portraitRects = {
    support: [[0,0,50,30],[50,0,50,30],[0,30,100,42],[0,72,50,28],[50,72,50,28]],
    trading: [[0,0,100,48],[0,48,50,26],[50,48,50,26],[0,74,50,26],[50,74,50,26]],
    ai: [[0,0,50,64],[50,0,50,64],[0,64,100,36]],
    development: [[0,0,100,58],[0,58,50,42],[50,58,50,42]],
    content: [[0,0,50,58],[50,0,50,58],[0,58,50,42],[50,58,50,42]],
    design: [[0,0,100,60],[0,60,60,40],[60,60,40,40]]
  };
  let controller = null;
  function create(root) {
    if (!root || root.dataset.showcaseReady === 'true') return controller;
    const experience = root.querySelector('.showcase-experience');
    const dock = root.querySelector('.showcase-dock');
    const canvas = root.querySelector('.showcase-canvas');
    const dialog = root.querySelector('.showcase-dialog');
    const dialogHost = root.querySelector('.showcase-dialog-host');
    if (!experience || !dock || !canvas || !dialog || !dialogHost) return null;
    root.dataset.showcaseReady = 'true';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const portrait = matchMedia('(max-width: 600px) and (orientation: portrait)');
    const duration = 6800;
    let index = 0, timer = null, cleanTimer = null, userPaused = reduced.matches, visible = true;
    let savedScroll = 0, savedFocus = null, savedOverflow = '', expanded = false, touch = null, wheel = 0, wheelAt = 0;
    let assets = window.MOUSE_SHOWCASE_ASSETS || {};
    const text = key => {
      const language = document.documentElement.lang;
      return window.MOUSE_I18N?.messages?.[language]?.[key] || window.MOUSE_I18N?.messages?.en?.[key] || EN[key] || '';
    };
    const paneNodes = [];
    canvas.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const pane = document.createElement('article');
      pane.className = 'showcase-pane';
      pane.innerHTML = '<div class="showcase-pane-head"><span class="showcase-service-mark" aria-hidden="true"></span><span class="showcase-service-name"></span><span class="showcase-service-host"></span></div><div class="showcase-pane-page"></div>';
      canvas.append(pane); paneNodes.push(pane);
    }
    const modes = root.querySelector('.showcase-modes');
    modes.replaceChildren();
    scenes.forEach((scene, sceneIndex) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'showcase-mode'; button.dataset.scene = scene.id;
      button.dataset.showcaseKey = 'showcase' + scene.key; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => select(sceneIndex, true));
      modes.append(button);
    });
    function layer(serviceId) {
      const service = services[serviceId];
      const element = document.createElement('div'); element.className = 'showcase-page-layer';
      const path = assets[serviceId];
      if (typeof path === 'string' && /^\/showcase\/[a-z0-9][a-z0-9._-]*\.(webp|jpg|jpeg|png)$/.test(path)) {
        const image = document.createElement('img'); image.className = 'showcase-capture';
        image.alt = service.name + ' public preview'; image.decoding = 'async'; image.draggable = false;
        const fallback = document.createElement('div'); fallback.className = 'showcase-page-layer';
        fallback.innerHTML = service.html; element.append(fallback);
        image.addEventListener('load', () => fallback.remove(), { once: true });
        image.addEventListener('error', () => image.remove(), { once: true });
        image.src = path; element.append(image);
      } else element.innerHTML = service.html;
      return element;
    }
    function pauseTimer() {
      clearTimeout(timer); timer = null; root.classList.remove('is-playing');
      root.querySelectorAll('.showcase-mode').forEach(button => button.classList.remove('is-counting'));
    }
    function schedule() {
      pauseTimer();
      if (userPaused || !visible || document.visibilityState === 'hidden') return;
      root.classList.add('is-playing');
      const active = modes.children[index];
      requestAnimationFrame(() => { if (root.classList.contains('is-playing')) active.classList.add('is-counting'); });
      timer = setTimeout(() => select((index + 1) % scenes.length), duration);
    }
    function refreshLanguage() {
      root.querySelectorAll('[data-showcase-key]').forEach(node => { node.textContent = text(node.dataset.showcaseKey); });
      root.querySelectorAll('[data-showcase-aria]').forEach(node => node.setAttribute('aria-label', text(node.dataset.showcaseAria)));
      const scene = scenes[index];
      root.querySelector('[data-showcase-title]').textContent = text('showcase' + scene.key);
      root.querySelector('[data-showcase-description]').textContent = text('showcase' + scene.key + 'Text');
      const chromeScene = root.querySelector('[data-showcase-chrome-scene]');
      chromeScene.textContent = text('showcase' + scene.key);
      chromeScene.lang = document.documentElement.lang || 'en';
      chromeScene.dir = 'auto';
      const pause = root.querySelector('[data-showcase-pause]');
      pause.innerHTML = icon(userPaused ? 'play' : 'pause');
      pause.setAttribute('aria-label', text(userPaused ? 'showcasePlay' : 'showcasePause'));
      pause.setAttribute('aria-pressed', String(userPaused));
    }
    function layoutGeometry() {
      const scene = scenes[index];
      const rects = expanded && portrait.matches ? portraitRects[scene.id] : scene.rects;
      paneNodes.forEach((pane, i) => {
        if (!rects[i]) return;
        const [x,y,w,h] = rects[i];
        pane.style.left = x + '%'; pane.style.top = y + '%';
        pane.style.width = 'calc(' + w + '% - ' + (x + w < 100 ? 5 : 0) + 'px)';
        pane.style.height = 'calc(' + h + '% - ' + (y + h < 100 ? 5 : 0) + 'px)';
      });
    }
    function select(next, announce = false) {
      index = ((next % scenes.length) + scenes.length) % scenes.length;
      const scene = scenes[index];
      clearTimeout(cleanTimer);
      paneNodes.forEach((pane, i) => {
        const serviceId = scene.panes[i];
        if (!serviceId) { pane.classList.add('is-unused'); pane.setAttribute('aria-hidden', 'true'); return; }
        pane.classList.remove('is-unused'); pane.removeAttribute('aria-hidden');
        const service = services[serviceId];
        pane.querySelector('.showcase-service-mark').textContent = service.mark;
        pane.querySelector('.showcase-service-name').textContent = service.name;
        pane.querySelector('.showcase-service-host').textContent = service.host;
        pane.setAttribute('aria-label', service.name);
        const body = pane.querySelector('.showcase-pane-page');
        // Fast manual changes keep only the newest layer, never an animation backlog.
        const previous = body.lastElementChild;
        Array.from(body.children).forEach(node => { if (node !== previous) node.remove(); });
        if (previous) {
          previous.classList.remove('is-old', 'is-new');
          previous.removeAttribute('aria-hidden');
        }
        const fresh = layer(serviceId);
        if (previous && !reduced.matches) {
          previous.setAttribute('aria-hidden', 'true');
          fresh.classList.add('is-new'); body.append(fresh);
          requestAnimationFrame(() => {
            if (previous.parentNode === body) previous.classList.add('is-old');
            if (fresh.parentNode === body) fresh.classList.remove('is-new');
          });
        } else body.replaceChildren(fresh);
      });
      layoutGeometry();
      cleanTimer = setTimeout(() => root.querySelectorAll('.showcase-page-layer.is-old').forEach(node => node.remove()), 850);
      modes.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      refreshLanguage();
      if (announce) root.querySelector('[data-showcase-status]').textContent = text('showcase' + scene.key);
      schedule();
    }
    function expand() {
      if (expanded || typeof dialog.showModal !== 'function') return;
      savedScroll = window.scrollY; savedFocus = document.activeElement;
      savedOverflow = document.documentElement.style.overflow;
      dock.style.height = dock.getBoundingClientRect().height + 'px';
      dialogHost.append(experience); dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
      expanded = true; visible = true; wheel = 0;
      layoutGeometry();
      root.querySelector('[data-showcase-close]').focus({ preventScroll: true });
      schedule();
    }
    function restore() {
      if (!expanded) return;
      expanded = false; dock.append(experience); dock.style.height = '';
      layoutGeometry();
      document.documentElement.style.overflow = savedOverflow;
      const behavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, savedScroll);
      if (savedFocus && savedFocus.isConnected && typeof savedFocus.focus === 'function') savedFocus.focus({ preventScroll: true });
      requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = behavior; });
      visible = root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight;
      schedule();
    }
    root.querySelector('[data-showcase-expand]').addEventListener('click', expand);
    root.querySelector('[data-showcase-preview-hit]')?.addEventListener('click', expand);
    root.querySelector('[data-showcase-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', restore);
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    root.querySelector('[data-showcase-pause]').addEventListener('click', () => { userPaused = !userPaused; refreshLanguage(); schedule(); });
    root.querySelector('[data-showcase-previous]').addEventListener('click', () => select(index - 1, true));
    root.querySelector('[data-showcase-next]').addEventListener('click', () => select(index + 1, true));
    const frame = root.querySelector('.showcase-frame');
    if (typeof dialog.showModal === 'function') {
      root.classList.add('showcase-gesture-enabled');
      frame.addEventListener('wheel', event => {
        if (expanded || event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        const now = performance.now();
        if (now - wheelAt > 350) wheel = 0;
        wheelAt = now; wheel += Math.max(0, -event.deltaY);
        if (event.deltaY >= 0) { wheel = 0; return; }
        if (wheel >= 42) { event.preventDefault(); expand(); }
      }, { passive: false });
      frame.addEventListener('touchstart', event => {
        if (!expanded && event.touches.length === 1) touch = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: performance.now() };
        else touch = null;
      }, { passive: true });
      frame.addEventListener('touchmove', event => {
        if (!touch || expanded || event.touches.length !== 1) return;
        const dx = event.touches[0].clientX - touch.x, dy = touch.y - event.touches[0].clientY;
        // Claim only a clear upward gesture early enough to prevent native scrolling.
        // Downward, horizontal and multi-touch gestures keep their normal behavior.
        const upward = dy > 6 && Math.abs(dx) < dy * .65 && performance.now() - touch.time < 1100;
        if (upward) event.preventDefault();
        if (upward && dy > 58) { touch = null; expand(); }
      }, { passive: false });
      frame.addEventListener('touchend', () => { touch = null; }, { passive: true });
      frame.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
    } else {
      root.querySelector('[data-showcase-expand]').hidden = true;
      const previewHit = root.querySelector('[data-showcase-preview-hit]');
      if (previewHit) previewHit.hidden = true;
      root.querySelector('.showcase-hint').hidden = true;
    }
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (expanded) return;
        visible = entries[0].isIntersecting; schedule();
      }, { threshold: .1 });
      observer.observe(root);
    }
    document.addEventListener('visibilitychange', schedule);
    document.addEventListener('mouse:language', refreshLanguage);
    new MutationObserver(refreshLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const onReduced = () => { if (reduced.matches) userPaused = true; refreshLanguage(); schedule(); };
    if (reduced.addEventListener) reduced.addEventListener('change', onReduced);
    else if (reduced.addListener) reduced.addListener(onReduced);
    if (portrait.addEventListener) portrait.addEventListener('change', layoutGeometry);
    else if (portrait.addListener) portrait.addListener(layoutGeometry);
    root.querySelectorAll('[data-showcase-interactive]').forEach(node => { node.hidden = false; });
    if (typeof dialog.showModal !== 'function') {
      const previewHit = root.querySelector('[data-showcase-preview-hit]');
      if (previewHit) previewHit.hidden = true;
    }
    select(0);
    return {
      refreshLanguage,
      setAssets(value) { assets = value && typeof value === 'object' ? value : {}; select(index); }
    };
  }
  function init() { controller = create(document.getElementById('mouse-showcase')) || controller; return controller; }
  window.MouseShowcase = Object.freeze({ init, refreshLanguage() { controller?.refreshLanguage(); }, setAssets(value) { controller?.setAssets(value); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
