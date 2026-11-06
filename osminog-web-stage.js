"use strict";
/* Real Chrome popup. No iframe bypass, tab reparenting, focus loop or background scan. */
(() => {
  const KEY = "osminogWebStagesV2", PREFIX = "OSMINOG_WEB_STAGE_";
  const EDITOR = chrome.runtime.getURL("editor.html");
  let states = {}, ready = chrome.storage.session.get(KEY).then(v => {states = v[KEY] || {}});
  const queues = new Map();
  const save = () => chrome.storage.session.set({[KEY]: states});
  const serial = (id, fn) => {
    const task = (queues.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    queues.set(id, task);
    task.finally(() => {if (queues.get(id) === task) queues.delete(id)}).catch(() => {});
    return task;
  };
  const emit = (s, data) => chrome.runtime.sendMessage({...data, ownerTabId:s.parentTabId}).catch(() => {});
  const editorUrl = value => typeof value === "string" && value.split(/[?#]/)[0] === EDITOR;
  function safeUrl(value) {
    const u = new URL(String(value || ""));
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password) throw Error("Разрешены только HTTP(S)-адреса без пароля");
    return u.href;
  }
  function bounds(g) {
    if (!g || !['left','top','width','height'].every(k => Number.isFinite(g[k]))) throw Error("Нет координат рамки");
    // Fit the WHOLE native popup inside the frame. Do not guess OS titlebar insets.
    if (g.width < 260 || g.height < 180 || g.width > 10000 || g.height > 10000) throw Error("Область слишком мала для окна Chrome");
    return Object.fromEntries(['left','top','width','height'].map(k => [k,Math.round(g[k])]));
  }
  async function owner(message, sender) {
    if (sender.id !== chrome.runtime.id || !editorUrl(sender.url)) throw Error("Команда разрешена только редактору OSMINOG");
    let id = sender.tab?.id ?? message.parentTabId;
    if (!Number.isInteger(id) && sender.documentId) {const contexts=await chrome.runtime.getContexts({documentIds:[sender.documentId],contextTypes:['TAB']});id=contexts[0]?.tabId;}
    if (!Number.isInteger(id)) throw Error("Не найдена вкладка редактора");
    const tab = await chrome.tabs.get(id);
    if (!editorUrl(tab.url) || (sender.tab && sender.tab.id !== id)) throw Error("Чужая вкладка редактора");
    return tab;
  }
  async function live(s) {
    if (!s) return null;
    const w = await chrome.windows.get(s.windowId).catch(() => null);
    if (!w || w.type !== 'popup') {delete states[s.parentTabId]; await save(); return null}
    return w;
  }
  async function ownedTab(s, id) {
    if (!s || !Number.isInteger(id)) throw Error("Нет вкладки сайта");
    const t = await chrome.tabs.get(id).catch(() => null);
    if (!t || t.windowId !== s.windowId) throw Error("Вкладка не принадлежит этому окну OSMINOG");
    return t;
  }
  function result(s, t) {
    return {ok:true,windowId:s.windowId,tabId:t?.id || s.activeTabId,url:t?.url || '',
      mode:'magnetized-chrome-window',separateWindow:true,displayVerified:false,
      loadStatus:t?.status || 'unknown',alwaysOnTop:false};
  }
  async function handle(m, parent) {
    await ready;
    let s = states[parent.id], w = await live(s);
    const op = m.type.slice(PREFIX.length);
    if (op === 'OPEN') {
      const url = safeUrl(m.url), g = bounds(m.geometry);
      let t = null;
      if (w && m.tabId) t = await ownedTab(s, m.tabId).catch(() => null);
      if (!w) {
        w = await chrome.windows.create({url,type:'popup',focused:false,...g});
        t = w.tabs?.[0] || (await chrome.tabs.query({windowId:w.id}))[0];
        s = {windowId:w.id,parentTabId:parent.id,parentWindowId:parent.windowId,activeTabId:t.id,visible:true,bounds:g};
        states[parent.id] = s;
      } else if (t) {
        t = await chrome.tabs.update(t.id,{active:true,...(t.url === url ? {} : {url})});
      } else t = await chrome.tabs.create({windowId:w.id,url,active:true});
      s.activeTabId=t.id;s.visible=true;s.bounds=g;
      await save();
      if (w.state === 'minimized') await chrome.windows.update(w.id,{state:'normal'});
      await chrome.windows.update(w.id,{...g,focused:true});
      await emit(s,{type:PREFIX+'TAB_UPDATED',tabId:t.id,url:t.url || url,title:t.title || '',active:true});
      return result(s,t);
    }
    if (!w) return {ok:op==='HIDE',missing:true,error:op==='HIDE'?undefined:'Окно сайта ещё не открыто'};
    if (op === 'BOUNDS') {
      const g = bounds(m.geometry);
      if (!s.visible) return {ok:true,hidden:true};
      // Resize never changes focus or restores an explicitly hidden popup.
      if (w.state === 'minimized') return {ok:true,minimized:true};
      if (['left','top','width','height'].some(k => Math.abs(w[k]-g[k])>1)) await chrome.windows.update(w.id,g);
      s.bounds=g;await save();return {ok:true,bounds:g};
    }
    if (op === 'HIDE') {
      s.visible=false;await save();
      if (w.state !== 'minimized') await chrome.windows.update(w.id,{state:'minimized'});
      return {ok:true};
    }
    if (op === 'FOCUS') {
      const t=await ownedTab(s,m.tabId || s.activeTabId);s.visible=true;s.activeTabId=t.id;await save();
      if (w.state === 'minimized') await chrome.windows.update(w.id,{state:'normal'});
      await chrome.tabs.update(t.id,{active:true});await chrome.windows.update(w.id,{...s.bounds,focused:true});return result(s,t);
    }
    if (op === 'LIST') return {ok:true,tabs:await chrome.tabs.query({windowId:w.id}),visible:s.visible};
    const t=await ownedTab(s,Number(m.tabId));
    if (op === 'HISTORY') {if(Number(m.direction)<0) await chrome.tabs.goBack(t.id);else await chrome.tabs.goForward(t.id);return {ok:true}}
    if (op === 'NAVIGATE') {const updated=await chrome.tabs.update(t.id,{url:safeUrl(m.url),active:true});return result(s,updated)}
    if (op === 'CLOSE_TAB') {await chrome.tabs.remove(t.id);return {ok:true,closed:true}}
    throw Error('Неизвестная команда окна');
  }
  chrome.runtime.onMessage.addListener((m,sender,reply) => {
    if (!m?.type?.startsWith(PREFIX)) return false;
    if (!['OPEN','BOUNDS','HIDE','FOCUS','LIST','HISTORY','NAVIGATE','CLOSE_TAB'].includes(m.type.slice(PREFIX.length))) return false;
    owner(m,sender).then(parent => serial(parent.id,() => handle(m,parent))).then(reply,e => reply({ok:false,error:e.message}));
    return true;
  });
  const event = fn => (...args) => {ready.then(() => fn(...args)).catch(() => {})};
  const forWindow = id => Object.values(states).find(s => s.windowId === id);
  chrome.tabs.onUpdated.addListener(event(async(id,changes,t) => {
    const s=forWindow(t.windowId);if (!s || !(changes.status || changes.url || changes.title)) return;
    await emit(s,{type:PREFIX+'TAB_UPDATED',tabId:id,url:t.url || '',title:t.title || '',active:t.active});
  }));
  // New-window/auth pages keep Chrome's native opener and form state; never reparent them.
  chrome.tabs.onActivated.addListener(event(async info => {
    const s=forWindow(info.windowId);
    if (s) {s.activeTabId=info.tabId;await save();const t=await chrome.tabs.get(info.tabId);await emit(s,{type:PREFIX+'TAB_UPDATED',tabId:t.id,url:t.url||'',title:t.title||'',active:true});return}
    for (const item of Object.values(states)) if (item.parentWindowId===info.windowId && item.parentTabId!==info.tabId && item.visible) {
      item.visible=false;await save();await chrome.windows.update(item.windowId,{state:'minimized'}).catch(()=>{});
    }
  }));
  chrome.tabs.onRemoved.addListener(event(async(id,info) => {
    if (states[id]) {const s=states[id];delete states[id];await save();await chrome.windows.update(s.windowId,{state:'normal'}).catch(()=>{});return}
    const s=forWindow(info.windowId);if (s) await emit(s,{type:PREFIX+'TAB_CLOSED',tabId:id});
  }));
  chrome.windows.onBoundsChanged.addListener(event(async w => {
    for (const s of Object.values(states)) if (s.parentWindowId===w.id) {
      if (w.state==='minimized') {s.visible=false;await save();await chrome.windows.update(s.windowId,{state:'minimized'}).catch(()=>{})}
      else await emit(s,{type:PREFIX+'PARENT_BOUNDS'});
    }
  }));
  chrome.windows.onRemoved.addListener(event(async id => {
    const s=forWindow(id);if (s) {delete states[s.parentTabId];await save();await emit(s,{type:PREFIX+'WINDOW_CLOSED'})}
  }));
})();
