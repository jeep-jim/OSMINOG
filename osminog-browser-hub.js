"use strict";
/* 4.0.29: ordinary web pages are workspace panes, never provider-session popups.
 * This is an isolated web-frame preview, not a native Chrome WebContents host.
 * CSP/X-Frame-Options remain intact; load events are NOT proof of visible content.
 */
(() => {
  const $ = s => document.querySelector(s);
  const send = (type, extra = {}) => chrome.runtime.sendMessage({type, ...extra});
  for (const id of ['browserHub', 'browserHubButton']) document.getElementById(id)?.remove();
  async function connections() {
    await globalThis.BriefCraftBridge?.open?.();
    globalThis.OSMINOGSetAgentSettingsOpen?.(true);
    return {ok: true, mode: 'chat-settings', popup: false};
  }
  globalThis.OSMINOGBrowserHubAPI = {
    open: connections, close() {}, refresh: async () => ({ok:true, retired:true}),
    list: () => send('OSMINOG_SESSION_LIST'),
    openUrl: (url, provider = '') => provider && provider !== 'web'
      ? connections() : openUrl(url)
  };
  globalThis.OSMINOGOpenConnections = connections;
  // The Windows app owns real native WebContentsViews and its own shell.
  if (globalThis.OSMINOGNative) {
    globalThis.OSMINOGBrowserHubAPI.openUrl = url => send('OSMINOG_BROWSER_HUB_OPEN', {url, active:true, reuse:true, allowCreate:true});
    return;
  }
  let pane, tabsBar, address, domain, frames, notice, divider, planet, monitor;
  let tabs = [], active = '', owner = '', mode = 'desk', ratio = .5, epoch = 0;
  let raf = 0, drag = null, loaded = Promise.resolve(), pendingWrite = Promise.resolve();
  const frameMap = new Map(), maxTabs = 8;
  const projectId = () => String(globalThis.project?.()?.id || '');
  const storageKey = id => 'osminogWebWorkspaceV1:' + id;
  const ru = () => typeof state === 'undefined' || state.language === 'ru';
  const label = (r,e) => ru() ? r : e;
  const icons = {
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    desk:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>'
  };
  function safeUrl(raw) {
    raw = String(raw || '').trim();
    if (!raw || raw.length > 8192) throw Error(label('Введите адрес сайта','Enter a website address'));
    if (!/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = 'https://' + raw;
    const url = new URL(raw);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password)
      throw Error(label('Разрешены только HTTP(S)-адреса без пароля','Only HTTP(S) addresses without credentials are allowed'));
    return url.href;
  }
  function button(text, title, onClick) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text;
    el.title = title; el.setAttribute('aria-label', title); el.onclick = onClick; return el;
  }
  function headerButton(id, icon, title, onClick) {
    const el = button('', title, onClick); el.id = id; el.className = 'icon-btn ow-header-button';
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[icon] + '</svg>';
    el.setAttribute('aria-pressed','false'); return el;
  }
  function report(error) { if (notice) notice.textContent = error?.message || String(error); }
  function persist() {
    const id = owner; if (!id) return;
    // Save only small navigation metadata. Never read/serialize the canvas archive.
    const value = {tabs:tabs.map(t=>({id:t.id,url:t.url})),active,ratio};
    pendingWrite = pendingWrite.catch(()=>{}).then(()=>chrome.storage.local.set({[storageKey(id)]:value}));
    pendingWrite.catch(report);
  }
  function result(tab) {
    return {ok:true, id:tab.id, tabId:tab.id, url:tab.url, projectId:owner,
      mode:'workspace-web-preview', background:false, separateWindow:false,
      displayVerified:false, loaded:tab.loaded === true,
      note:'A sandboxed frame was opened in the workspace. Website frame restrictions are preserved. This does not verify successful page rendering, authentication or native browser control.'};
  }
  function setMode(value) {
    mode = value; document.body.dataset.webWorkspace = value;
    pane.hidden = value === 'desk'; divider.hidden = value !== 'split';
    planet.setAttribute('aria-pressed',String(value !== 'desk'));
    monitor.setAttribute('aria-pressed',String(value !== 'browser'));
    scheduleLayout();
  }
  function layout() {
    raf = 0; if (!pane) return;
    const bar = $('#app .topbar'), chat = $('#bridgePanel');
    const chatOpen = chat && !chat.hidden;
    const right = chatOpen ? chat.getBoundingClientRect().left - 7 : innerWidth;
    const available = Math.max(0, right), top = bar?.getBoundingClientRect().bottom || 56;
    const small = available < 580;
    const split = mode === 'split' && !small;
    const cut = split ? Math.round(Math.max(240, Math.min(available-240, available*ratio))) : 0;
    document.body.dataset.webWorkspaceSplit = String(split);
    document.documentElement.style.setProperty('--ow-top', top+'px');
    document.documentElement.style.setProperty('--ow-right', Math.max(0,innerWidth-available)+'px');
    document.documentElement.style.setProperty('--ow-cut', cut+'px');
    document.documentElement.style.setProperty('--ow-desk-center', (split ? cut/2 : available/2)+'px');
    divider.hidden = !split; divider.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
    pane.style.left = (split ? cut+6 : 0)+'px';
    pane.dataset.narrow = String(available-cut < 500);
    globalThis.applyView?.();
  }
  function scheduleLayout() { if (!raf) raf=requestAnimationFrame(layout); }
  function select(id) {
    const tab = tabs.find(t=>t.id===id); if (!tab) return;
    active = id; address.value = tab.url || ''; domain.textContent = tab.url ? new URL(tab.url).hostname : label('Новая ссылка','New link');
    domain.title = label('Исходный адрес; переходы внутри сайта не проверены: ','Requested address; in-page navigation is not verified: ') + (tab.url || ''); renderTabs();
    for (const [key,frame] of frameMap) frame.hidden = key !== id;
    if (tab.url && !frameMap.has(id)) {
      const frame = document.createElement('iframe'); frame.title = new URL(tab.url).hostname;
      frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups');
      frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.dataset.tabId = id;
      frame.onload = () => {tab.loaded=true; if (active===id) notice.textContent=label('Встроенный просмотр · некоторые сайты запрещают показ во фрейме.','Embedded preview · some websites block framing.');};
      frame.onerror = () => {if(active===id)report(label('Сайт не удалось показать внутри расширения.','The website could not be displayed inside the extension.'));};
      frame.src=tab.url; frameMap.set(id,frame); frames.append(frame);
    }
    if (!tab.url) address.focus();
    persist();
  }
  function renderTabs() {
    tabsBar.replaceChildren();
    for (const tab of tabs) {
      const row=document.createElement('span'); row.className='ow-tab'; row.classList.toggle('active',tab.id===active);
      const title=tab.url?new URL(tab.url).hostname:label('Новая ссылка','New link');
      const choose=button(title,title,()=>select(tab.id)); choose.setAttribute('role','tab');
      choose.setAttribute('aria-selected',String(tab.id===active));
      const close=button('×',label('Закрыть ссылку','Close link'),()=>closeTab(tab.id));
      row.append(choose,close); tabsBar.append(row);
    }
  }
  function closeTab(id) {
    if (!tabs.some(t=>t.id===id)) return {ok:false,error:'Unknown workspace tab'};
    frameMap.get(id)?.remove(); frameMap.delete(id); tabs=tabs.filter(t=>t.id!==id);
    if(active===id)active=tabs.at(-1)?.id||'';
    if(active)select(active); else {address.value='';domain.textContent='';renderTabs();setMode('desk');persist();}
    return {ok:true,id,closed:true};
  }
  async function openUrl(raw) {
    await ready; await loaded;
    if (!projectId()) return {ok:false,error:'Open a project first'};
    if (owner !== projectId()) await loadProject();
    const url = safeUrl(raw); let tab=tabs.find(t=>t.url===url);
    if(!tab){if(tabs.length>=maxTabs)throw Error(label('Закройте одну из восьми ссылок перед открытием новой.','Close one of the eight links before opening another.'));tab={id:'web-'+crypto.randomUUID(),url};tabs.push(tab);}
    setMode(mode==='split'?'split':'browser');select(tab.id);return result(tab);
  }
  async function loadProject() {
    const generation=++epoch, id=projectId(); owner=id; tabs=[];active='';ratio=.5;
    for(const frame of frameMap.values())frame.remove();frameMap.clear();setMode('desk');renderTabs();
    if(!id)return;
    await pendingWrite.catch(()=>{});
    const saved=(await chrome.storage.local.get(storageKey(id)))[storageKey(id)];
    if(generation!==epoch||id!==projectId())return;
    const seen=new Set();
    tabs=(Array.isArray(saved?.tabs)?saved.tabs:[]).slice(0,maxTabs).flatMap(t=>{
      try{if(typeof t.id!=='string'||!t.id.startsWith('web-')||seen.has(t.id))return[];seen.add(t.id);return[{id:t.id,url:t.url?safeUrl(t.url):''}]}catch{return[]}
    });
    active=tabs.some(t=>t.id===saved?.active)?saved.active:tabs[0]?.id||'';
    ratio=Number.isFinite(saved?.ratio)?Math.max(.2,Math.min(.8,saved.ratio)):.5;
    renderTabs(); // Saved pages do not contact the network until explicitly opened.
  }
  async function newTab() {
    await loaded; if(owner!==projectId())await loadProject();
    if(tabs.length>=maxTabs)return report(label('Открыто восемь ссылок. Закройте ненужную.','Eight links are open. Close one first.'));
    const tab={id:'web-'+crypto.randomUUID(),url:''};tabs.push(tab);setMode(mode==='split'?'split':'browser');select(tab.id);
  }
  function install() {
    const link=document.createElement('link');link.rel='stylesheet';link.href='osminog-browser-workspace.css';document.head.append(link);
    document.body.dataset.webWorkspace='desk';
    pane=document.createElement('section');pane.id='osminogWebWorkspace';pane.hidden=true;pane.setAttribute('aria-label',label('Сайты в рабочем пространстве','Web workspace'));
    const header=document.createElement('header');tabsBar=document.createElement('nav');tabsBar.setAttribute('role','tablist');tabsBar.setAttribute('aria-label',label('Открытые ссылки','Open links'));
    const add=button('+',label('Новая ссылка','New link'),newTab);add.id='owNewTab';
    domain=document.createElement('small');domain.id='owDomain';
    const form=document.createElement('form');address=document.createElement('input');address.id='owAddress';address.type='text';address.autocomplete='off';address.spellcheck=false;address.placeholder='https://example.com';address.setAttribute('aria-label',label('Адрес сайта','Website address'));
    const go=button('↵',label('Открыть адрес','Open address'));go.type='submit';
    form.append(address,go);form.onsubmit=e=>{e.preventDefault();try{const url=safeUrl(address.value),tab=tabs.find(t=>t.id===active);if(!tab)return void openUrl(url).catch(report);frameMap.get(tab.id)?.remove();frameMap.delete(tab.id);tab.url=url;tab.loaded=false;select(tab.id)}catch(err){report(err)}};
    header.append(tabsBar,add,domain,button('×',label('Показать только стол','Show desk only'),()=>setMode('desk')));
    frames=document.createElement('div');frames.className='ow-frames';notice=document.createElement('p');notice.className='ow-notice';notice.setAttribute('role','status');notice.textContent=label('Встроенный просмотр · ограничения сайтов сохраняются.','Embedded preview · website restrictions remain in effect.');
    pane.append(header,form,frames,notice);$('#app').append(pane);
    divider=document.createElement('div');divider.id='owDeskDivider';divider.hidden=true;divider.tabIndex=0;divider.role='separator';divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-label',label('Ширина стола и браузера','Desk and browser width'));divider.setAttribute('aria-valuemin','20');divider.setAttribute('aria-valuemax','80');$('#app').append(divider);
    planet=headerButton('workspaceWebToggle','globe',label('Браузер','Browser'),async()=>{await loaded;if(mode!=='desk')setMode('desk');else if(active){setMode('browser');select(active)}else newTab()});
    monitor=headerButton('workspaceDeskToggle','desk',label('Стол рядом с браузером','Desk beside browser'),async()=>{await loaded;if(mode==='desk'){if(active){setMode('split');select(active)}}else setMode(mode==='split'?'browser':'split')});
    $('#app .top-actions').prepend(planet,monitor);
    divider.onpointerdown=e=>{if(e.button!==0)return;drag=e.pointerId;divider.setPointerCapture(e.pointerId);document.body.classList.add('ow-resizing');e.preventDefault()};
    divider.onpointermove=e=>{if(drag!==e.pointerId)return;const available=innerWidth-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ow-right')||'0');ratio=Math.max(.2,Math.min(.8,e.clientX/Math.max(1,available)));scheduleLayout()};
    const finish=()=>{if(drag===null)return;drag=null;document.body.classList.remove('ow-resizing');persist()};
    divider.onpointerup=finish;divider.onpointercancel=finish;divider.onlostpointercapture=finish;
    divider.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();ratio=e.key==='Home'?.5:Math.max(.2,Math.min(.8,ratio+(e.key==='ArrowLeft'?-.03:.03)));scheduleLayout();persist()};
    divider.ondblclick=()=>{ratio=.5;scheduleLayout();persist()};
    const observer=new ResizeObserver(scheduleLayout);for(const el of [$('#app .topbar'),$('#bridgePanel')])if(el)observer.observe(el);
    if($('#bridgePanel'))new MutationObserver(scheduleLayout).observe($('#bridgePanel'),{attributes:true,attributeFilter:['hidden']});
    window.addEventListener('resize',scheduleLayout,{passive:true});
    document.addEventListener('osminog:project-opened',()=>{loaded=loadProject().catch(report)});
    chrome.storage.onChanged?.addListener((changes,area)=>{
      if(area!=='local'||!changes.osminogTrashIndex)return;
      for(const [id,entry] of Object.entries(changes.osminogTrashIndex.newValue||{})){
        if(entry.purged)chrome.storage.local.remove(storageKey(id)).catch(report);
      }
    });
    // Project switches without an event are covered by this public API's owner check.
    Promise.resolve(globalThis.OSMINOGStateReady).then(()=>{loaded=loadProject().catch(report)});
    scheduleLayout();
  }
  const ready = new Promise(resolve=>{
    const run=()=>{install();resolve()};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  });
  const previous=globalThis.OSMINOGWorkspaceTools;
  const names=['browser_open','browser_tabs','browser_close','browser_read','browser_act'];
  globalThis.OSMINOGWorkspaceTools={names:[...new Set([...(previous?.names||[]),...names])],async run(name,args){
    if(!names.includes(name))return previous.run(name,args);
    await ready;await loaded;
    if(owner!==projectId())await loadProject();
    if(name==='browser_open'){
      if(args.provider&&args.provider!=='web')return connections();
      return openUrl(args.url);
    }
    if(name==='browser_read'||name==='browser_act')return {ok:false,error:'The Chrome workspace preview is not a native browser automation session. Its remote DOM and input are not exposed. Do not claim that an action was performed.'};
    if(name==='browser_close')return closeTab(String(args.tabId||args.id||''));
    return {ok:true,projectId:owner,tabs:tabs.map(result),mode,displayVerified:false};
  }};
  globalThis.OSMINOGWebWorkspace={open:openUrl,close:()=>setMode('desk'),split:()=>setMode('split'),list:()=>tabs.map(result),ready};
})();
