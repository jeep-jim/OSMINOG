'use strict';
const $ = id => document.getElementById(id);
const assets = {plankton: 'Group 26.svg', jelly: 'Group 27.svg', star: 'Star 35.svg'};
const state = {
  user: null, csrf: null, intelligence: 'disabled', intents: [], view: 'home', intent: null, thread: null,
  source: null, busy: false, register: false, file: null, fileUrl: null,
  nonce: null, camera: null, cameraGeneration: 0, homeScroll: null,
  noticeTimer: null, request: 0, lastMessages: '', draftScope: 'home',
  session: 0, depth: 0, refreshing: false, matchController: null
};
const editable = () => ['home', 'preview', 'thread'].includes(state.view);
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function notice(text) {
  $('notice').textContent = text;
  $('notice').hidden = !text;
  clearTimeout(state.noticeTimer);
  if (text) state.noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 11000);
}
function say(error) { notice(error.message || 'Не удалось выполнить действие'); }
async function api(path, {method = 'GET', body, signal} = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 12000);
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    const r = await fetch(path, {
      method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: {'Content-Type': 'application/json', ...(state.csrf ? {'X-CSRF-Token': state.csrf} : {})},
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    const value = await r.json();
    if (!r.ok) throw Error(value.error || 'Сервис недоступен');
    return value;
  } catch (e) {
    if (e.name === 'AbortError') throw Error('Нет подтверждения сервера. Черновик сохранён; повтор не создаст дубль.');
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
function draftKey(scope = state.draftScope, owner = state.user?.id || 'guest') {
  return 'ocean:draft:' + owner + ':' + scope;
}
function readDraft(key = draftKey()) {
  try { return JSON.parse(sessionStorage.getItem(key) || '{}'); } catch { return {}; }
}
function writeDraft(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { notice('Хранилище недоступно: не закрывай вкладку с черновиком.'); }
}
function saveDraft() {
  if (!editable()) return;
  writeDraft(draftKey(), {text: $('text').value, nonce: state.nonce,
    audience: $('audience').value, kind: $('kind').value});
}
function restoreDraft() {
  const value = readDraft();
  $('text').value = typeof value.text === 'string' ? value.text : '';
  state.nonce = value.nonce || null;
  if (state.view === 'home') {
    $('audience').value = value.audience === 'ocean' ? 'ocean' : 'private';
    $('kind').value = ['seek', 'offer', 'discuss', 'together'].includes(value.kind) ? value.kind : 'discuss';
  }
  typing();
}
function typing() {
  document.body.classList.toggle('typing', !!$('text').value.trim());
  $('text').style.height = '52px';
  $('text').style.height = Math.min(126, Math.max(52, $('text').scrollHeight)) + 'px';
}
function bubble(avatar = 'plankton', label = 'Найти похожие намерения') {
  const b = el('button', 'orb'); b.setAttribute('aria-label', label);
  const image = el('img'); image.src = '/design/' + encodeURIComponent(assets[avatar] || assets.plankton); image.alt = '';
  b.append(image); return b;
}
function textWithLinks(text) {
  const p = el('p', 'text'), re = /https:\/\/[^\s<>]+/g; let end = 0;
  for (const m of text.matchAll(re)) {
    p.append(document.createTextNode(text.slice(end, m.index)));
    try {
      const u = new URL(m[0]);
      if (u.protocol === 'https:' && !u.username && !u.password) {
        const a = el('a', '', m[0]); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(a);
      } else p.append(document.createTextNode(m[0]));
    } catch { p.append(document.createTextNode(m[0])); }
    end = m.index + m[0].length;
  }
  p.append(document.createTextNode(text.slice(end))); return p;
}
function attachment(item) {
  const wrap = el('div');
  for (const f of item.attachments || []) {
    if (f.mime.startsWith('image/')) {
      const image = el('img', 'photo'); image.src = '/api/files/' + f.id; image.alt = f.name; image.loading = 'lazy'; wrap.append(image);
    } else {
      const a = el('a', 'file-link', f.name); a.href = '/api/files/' + f.id; a.target = '_blank'; a.rel = 'noopener noreferrer'; wrap.append(a);
    }
  }
  return wrap;
}
function age(item) {
  return item.closed ? 'Завершено' : item.expires * 1000 < Date.now() ? 'Срок истёк' :
    item.audience === 'private' ? 'Только тебе' : 'В океане · до ' + new Date(item.expires * 1000).toLocaleString('ru', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
function profile() {
  const yes = !!state.user;
  $('authForm').hidden = yes; $('profileForm').hidden = !yes;
  if (yes) { $('profileName').value = state.user.name; $('avatar').value = state.user.avatar; }
  $('welcomeLogin').hidden = yes;
  $('aiConsent').checked = !!state.user?.ai_consent;
  $('aiStatus').textContent = state.intelligence === 'configured'
    ? 'Подключение настроено; успешный ответ REG ещё проверяется при подборе.'
    : 'ИИ пока не подключён. Доступен обычный подбор по словам.';
}
function layout() {
  const home = state.view === 'home', conversation = ['thread', 'preview'].includes(state.view);
  $('navigation').hidden = home;
  $('dock').closest('footer').hidden = !(home || conversation);
  $('options').hidden = !home; $('attach').disabled = !home;
  $('attachmentPreview').hidden = !home || !state.file;
  $('text').placeholder = conversation ? 'Откликнись на намерение…' : 'Что у тебя сейчас?';
  $('welcome').hidden = !home || state.intents.length > 0;
  $('messages').classList.toggle('magnet-field', state.view === 'matches');
  $('viewTitle').textContent = state.view === 'matches' ? state.source?.text || 'Магнит' :
    state.view === 'threads' ? 'Мои беседы' : state.intent?.text || 'Беседа';
  $('viewHint').textContent = state.view === 'matches' ? 'Нажми на пузырь · пока подбор по словам' :
    state.view === 'preview' ? 'Доступное намерение · чужие личные беседы скрыты' :
    state.view === 'thread' ? 'Личная беседа по намерению · видна участникам' : '';
}
function stopMatch() { state.matchController?.abort(); state.matchController = null; }
function routeData() {
  return {ocean:true, user:state.user?.id || null, view:state.view,
    source:state.source?.id || null, target:state.intent?.id || null,
    thread:state.thread?.id || null, depth:state.depth};
}
function pushRoute() { state.depth++; history.pushState(routeData(), ''); }
function resetRoute() { state.depth = 0; history.replaceState(routeData(), ''); }
function leaveView() {
  saveDraft();
  if (state.view === 'home') state.homeScroll = $('viewport').scrollTop;
  stopMatch(); state.request++;
}
function renderHome() {
  layout(); $('messages').replaceChildren();
  for (const item of state.intents) {
    const article = el('article', item.closed ? 'closed' : '');
    const b = bubble(item.avatar); b.disabled = !!item.closed || item.expires * 1000 < Date.now();
    b.onclick = () => magnet(item);
    const content = el('div', 'content'); content.append(textWithLinks(item.text), attachment(item), el('small','meta',age(item)));
    if (!b.disabled) {
      const c = el('button','close-intent','Завершить');
      c.onclick = async () => {
        if (!confirm('Завершить намерение и убрать его из подбора?')) return;
        try { await api('/api/intents/' + item.id + '/close', {method:'POST',body:{}}); await loadHome(); } catch(e) { say(e); }
      };
      content.append(c);
    }
    article.append(b,content); $('messages').append(article);
  }
}
function home() {
  leaveView(); state.view = 'home'; state.thread = null; state.intent = null; state.source = null; state.draftScope = 'home';
  renderHome(); restoreDraft();
  requestAnimationFrame(() => {
    if (state.view === 'home') $('viewport').scrollTop = state.homeScroll ?? $('viewport').scrollHeight;
  });
}
async function loadHome() {
  if (!state.user) return;
  const session = state.session, owner = state.user.id;
  const data = await api('/api/intents');
  if (session !== state.session || state.user?.id !== owner) return;
  state.intents = data.items;
  if (state.view === 'home') {
    const scroll = $('viewport').scrollTop;
    renderHome(); $('viewport').scrollTop = scroll;
  }
}
async function magnet(item, push = true) {
  leaveView(); state.source = item; state.intent = null; state.thread = null; state.view = 'matches';
  layout(); const request = state.request;
  $('messages').replaceChildren(el('p','empty','Ищем намерения…')); if (push) pushRoute();
  const controller = new AbortController(); state.matchController = controller;
  try {
    const useAI = state.intelligence === 'configured' && state.user?.ai_consent && item.audience === 'ocean';
    const data = await api('/api/intents/' + item.id + '/matches', {signal:controller.signal,
      ...(useAI ? {method:'POST',body:{intelligence:'reg'}} : {})});
    if (request !== state.request) return;
    $('messages').replaceChildren();
    $('viewHint').textContent = data.mode === 'reg_ai'
      ? 'ИИ REG проверил часть активных намерений; возможны ошибки'
      : data.ai_state && !['not_requested','consent_required','disabled'].includes(data.ai_state)
        ? 'ИИ недоступен или достигнут лимит · подбор по словам'
        : 'Нажми на пузырь · подбор по словам';
    const anchor = el('div','magnet-anchor');
    const source = bubble(state.user?.avatar,'Твоё намерение'); source.disabled = true;
    anchor.append(source, el('small','','Твоё намерение')); $('messages').append(anchor);
    if (!data.items.length) {
      const empty = el('p','empty','Пока никто не притянулся.');
      empty.append(el('small','','Вернись в свой чат или проверь позже. Мы не добавляем выдуманных людей.'));
      $('messages').append(empty);
    } else {
      const field = el('div','match-ocean'); field.setAttribute('aria-label','Подходящие намерения');
      for (const [index,x] of data.items.entries()) {
        const match = el('div','match'); match.style.setProperty('--arrival', Math.min(index * 70, 420) + 'ms');
        const orb = bubble(x.avatar, 'Открыть намерение ' + x.name); orb.classList.add('open-match');
        orb.onclick = () => previewIntent(x);
        const label = el('button','match-label',x.text); label.onclick = () => previewIntent(x);
        match.append(orb,label,el('small','match-name',x.name)); field.append(match);
      }
      $('messages').append(field);
    }
    $('viewport').scrollTop = 0;
  } catch(e) {
    if (request === state.request && !controller.signal.aborted) $('messages').replaceChildren(el('p','empty',e.message));
  }
}
function safetyActions(item) {
  const actions = el('div','match-actions');
  const block = el('button','','Заблокировать');
  block.onclick = async () => {
    if (!confirm('Скрыть этого человека и прекратить общение?')) return;
    try { await api('/api/block',{method:'POST',body:{target:item.owner}}); goBack(); } catch(e) { say(e); }
  };
  const report = el('button','','Пожаловаться');
  report.onclick = async () => {
    const reason = prompt('Что не так с этим намерением?'); if (!reason) return;
    try { await api('/api/report',{method:'POST',body:{intent:item.id,reason}}); notice('Жалоба сохранена для проверки.'); } catch(e) { say(e); }
  };
  actions.append(block,report); return actions;
}
async function previewIntent(item, push = true) {
  leaveView(); const request = state.request;
  state.view = 'preview'; state.intent = item; state.thread = null; state.draftScope = 'new:' + item.id;
  layout(); restoreDraft(); $('messages').replaceChildren(el('p','empty','Открываем намерение…')); if (push) pushRoute();
  try {
    // Revalidate visibility; merely looking at a bubble never creates a conversation.
    const current = await api('/api/intents/' + item.id);
    if (request !== state.request) return;
    state.intent = current;
    const article = el('article'); const orb = bubble(current.avatar,current.name); orb.disabled = true;
    const content = el('div','content'); content.append(el('small','meta',current.name),textWithLinks(current.text),attachment(current),el('small','meta',age(current)),safetyActions(current));
    article.append(orb,content); $('messages').replaceChildren(article); $('viewport').scrollTop = 0;
  } catch(e) {
    if (request === state.request) { $('messages').replaceChildren(el('p','empty',e.message)); $('dock').closest('footer').hidden = true; }
  }
}
async function openThread(t, item, push = true) {
  leaveView(); state.view = 'thread'; state.thread = t; state.intent = item;
  state.draftScope = t.id; state.lastMessages = ''; layout(); $('messages').replaceChildren(); restoreDraft();
  if (push) pushRoute(); await refreshThread();
}
async function refreshThread() {
  if (state.view !== 'thread' || !state.thread || state.refreshing) return;
  const tid = state.thread.id, session = state.session; state.refreshing = true;
  try {
    const data = await api('/api/threads/' + tid + '/messages');
    if (session !== state.session || state.thread?.id !== tid || state.view !== 'thread' || !state.user) return;
    const serial = JSON.stringify(data.items); if (serial === state.lastMessages) return;
    const nearBottom = $('viewport').scrollHeight - $('viewport').scrollTop - $('viewport').clientHeight < 100;
    state.lastMessages = serial; $('messages').replaceChildren();
    if (!data.items.length) $('messages').append(el('p','empty','Здесь начнётся ваш разговор.'));
    for (const item of data.items) {
      const article = el('article','chat-message' + (item.sender === state.user.id ? ' mine' : ''));
      article.append(el('small','',item.name),textWithLinks(item.text)); $('messages').append(article);
    }
    if (nearBottom || data.items.length < 3) $('viewport').scrollTop = $('viewport').scrollHeight;
  } finally { state.refreshing = false; }
}
async function listThreads(push = true) {
  leaveView(); $('profile').close(); state.view = 'threads'; state.thread = null; state.intent = null; state.source = null;
  const request = state.request; layout(); if (push) pushRoute(); $('messages').replaceChildren(el('p','empty','Загружаем беседы…'));
  try {
    const data = await api('/api/threads'); if (request !== state.request) return;
    $('messages').replaceChildren(); if (!data.items.length) $('messages').append(el('p','empty','Бесед пока нет.'));
    for (const t of data.items) {
      const b = el('button','thread-item'); b.append(el('strong','',t.name),el('small','',t.text));
      b.onclick = () => openThread(t,{id:t.intent,text:t.text}).catch(say); $('messages').append(b);
    }
  } catch(e) { if (request === state.request) say(e); }
}
async function restoreRoute(route) {
  if (!route?.ocean || route.user !== (state.user?.id || null)) { home(); resetRoute(); return; }
  state.depth = route.depth || 0;
  const source = state.intents.find(i => i.id === route.source) || null;
  if (route.view === 'matches' && source) return magnet(source,false);
  state.source = source;
  if (route.view === 'preview' && route.target) return previewIntent({id:route.target},false);
  if (route.view === 'threads') return listThreads(false);
  if (route.view === 'thread' && route.thread) return openThread({id:route.thread},{id:route.target,text:'Беседа'},false);
  home();
}
function goBack() { if (state.depth > 0) history.back(); else { home(); resetRoute(); } }
$('back').onclick = goBack;
window.addEventListener('popstate',e => { restoreRoute(e.state).catch(say); });
for (const id of ['audience','kind']) $(id).addEventListener('change',() => { state.nonce = null; saveDraft(); });
$('text').addEventListener('input',() => { state.nonce = null; saveDraft(); typing(); });
$('composer').onsubmit = async e => {
  e.preventDefault(); if (state.busy || !editable() || !$('text').value.trim()) return;
  if (!state.user) { $('profile').showModal(); notice('Для отправки нужен аккаунт участника пилота.'); return; }
  state.nonce = state.nonce || crypto.randomUUID(); saveDraft();
  const submit = {key:draftKey(),scope:state.draftScope,text:$('text').value.trim(),nonce:state.nonce,
    session:state.session,view:state.view,target:state.intent,source:state.source,file:state.file,thread:state.thread};
  state.busy = true; $('eye').disabled = true; document.body.classList.add('sending');
  try {
    let t = submit.thread;
    if (submit.view === 'home') {
      await api('/api/intents',{method:'POST',body:{text:submit.text,kind:$('kind').value,audience:$('audience').value,hours:24,nonce:submit.nonce,files:submit.file?[submit.file]:[]}});
    } else {
      if (!t) t = await api('/api/threads',{method:'POST',body:{intent:submit.target.id}});
      if (submit.session !== state.session) return;
      await api('/api/threads/' + t.id + '/messages',{method:'POST',body:{text:submit.text,nonce:submit.nonce}});
    }
    if (submit.session !== state.session) return;
    const latest = readDraft(submit.key);
    // A late acknowledgement must not erase text typed after Send, or a different conversation.
    if (latest.nonce === submit.nonce) writeDraft(submit.key,{...latest,text:'',nonce:null});
    if (submit.view === 'home' && state.file === submit.file) clearFile(false);
    const stillHere = editable() && state.draftScope === submit.scope;
    if (stillHere) restoreDraft();
    if (submit.view === 'preview' && stillHere) {
      const nextDraft = readDraft(submit.key);
      if (nextDraft.text) writeDraft(draftKey(t.id),nextDraft);
      writeDraft(submit.key,{text:'',nonce:null});
      // Replace preview with its conversation: one Back returns to the magnet, not another empty view.
      await openThread(t,submit.target,false); history.replaceState(routeData(),'');
    } else if (submit.view === 'home') await loadHome();
    else if (state.view === 'thread' && state.thread?.id === t.id) await refreshThread();
    if (stillHere) $('viewport').scrollTop = $('viewport').scrollHeight;
    else notice('Сообщение доставлено. Текущий черновик сохранён.');
  } catch(e) { if (submit.session === state.session) say(e); }
  finally { state.busy = false; $('eye').disabled = false; document.body.classList.remove('sending'); }
};
$('star').onclick = () => { profile(); $('profile').showModal(); };
$('welcomeLogin').onclick = () => $('star').click();
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => b.closest('dialog').close();
for (const d of document.querySelectorAll('dialog')) d.addEventListener('click',e => {
  if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); }
});
$('toggleRegister').onclick = () => {
  state.register = !state.register; $('registration').hidden = !state.register;
  $('name').required = state.register; $('invite').required = state.register;
  $('authSubmit').textContent = state.register ? 'Создать аккаунт' : 'Войти';
  $('toggleRegister').textContent = state.register ? 'Уже есть аккаунт' : 'Есть приглашение? Создать аккаунт';
  $('password').autocomplete = state.register ? 'new-password' : 'current-password';
};
$('authForm').onsubmit = async e => {
  e.preventDefault(); $('authSubmit').disabled = true; $('authError').textContent = ''; saveDraft();
  const guest = readDraft(draftKey('home','guest'));
  try {
    const data = await api(state.register ? '/api/register' : '/api/login',{method:'POST',body:{login:$('login').value,password:$('password').value,name:$('name').value,invite:$('invite').value}});
    state.user = data.user; state.csrf = data.csrf; state.intelligence = data.intelligence || 'disabled'; state.session++; state.homeScroll = null;
    $('password').value = ''; $('invite').value = ''; $('profile').close();
    // Carry a just-written guest draft into a new account, never publish it automatically.
    if (state.register && guest.text && !readDraft(draftKey('home')).text) {
      writeDraft(draftKey('home'),{...guest,audience:'private'});
      writeDraft(draftKey('home','guest'),{text:'',nonce:null});
    }
    state.view = 'home'; state.thread = null; state.intent = null; state.draftScope = 'home';
    restoreDraft(); profile(); resetRoute(); await loadHome();
  } catch(e) { $('authError').textContent = e.message; }
  finally { $('authSubmit').disabled = false; }
};
$('profileForm').onsubmit = async e => {
  e.preventDefault();
  try {
    await api('/api/profile',{method:'POST',body:{name:$('profileName').value,avatar:$('avatar').value,ai_consent:$('aiConsent').checked}});
    state.user.name = $('profileName').value; state.user.avatar = $('avatar').value; state.user.ai_consent = $('aiConsent').checked;
    $('profile').close(); await loadHome();
  } catch(e) { say(e); }
};
$('logout').onclick = async () => {
  if (state.busy) { notice('Дождись подтверждения отправки перед выходом.'); return; }
  saveDraft();
  try {
    await api('/api/logout',{method:'POST',body:{}});
    state.session++; stopMatch(); state.user = null; state.csrf = null; state.intents = [];
    state.view = 'home'; state.thread = null; state.draftScope = 'home'; state.homeScroll = null;
    clearFile(false); $('profile').close(); profile(); restoreDraft(); renderHome(); resetRoute();
  } catch(e) { say(e); }
};
$('conversations').onclick = () => listThreads().catch(say);
try { $('motion').checked = localStorage.getItem('ocean:motion') !== 'off'; } catch { $('motion').checked = true; }
function motion() {
  document.body.classList.toggle('no-motion',!$('motion').checked);
  try { localStorage.setItem('ocean:motion',$('motion').checked?'on':'off'); } catch {}
}
$('motion').onchange = motion; motion();
function clearFile(changeNonce = true) {
  state.file = null; if (state.fileUrl) URL.revokeObjectURL(state.fileUrl); state.fileUrl = null;
  $('attachmentPreview').hidden = true; $('attachmentPreview').replaceChildren(); $('file').value = '';
  if (changeNonce) { state.nonce = null; saveDraft(); }
}
async function selectFile(file) {
  if (!file) return;
  if (file.size > 2_000_000) throw Error('Вложение должно быть меньше 2 МБ');
  if (!['image/jpeg','image/png','application/pdf','text/plain'].includes(file.type)) throw Error('Выбери JPEG, PNG, PDF или TXT');
  const session = state.session;
  const data = await new Promise((resolve,reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = () => reject(Error('Файл не прочитан')); r.readAsDataURL(file);
  });
  if (session !== state.session) return;
  clearFile(); state.file = {name:file.name,type:file.type,data};
  if (file.type.startsWith('image/')) {
    state.fileUrl = URL.createObjectURL(file); const image = el('img'); image.src = state.fileUrl; image.alt = 'Предпросмотр'; $('attachmentPreview').append(image);
  }
  $('attachmentPreview').append(el('span','',file.name));
  const remove = el('button','','×'); remove.setAttribute('aria-label','Убрать вложение'); remove.onclick = () => clearFile();
  $('attachmentPreview').append(remove); $('attachmentPreview').hidden = state.view !== 'home'; $('attachments').close();
}
$('attach').onclick = () => $('attachments').showModal();
$('choosePhoto').onclick = () => { $('file').accept = 'image/jpeg,image/png'; $('file').click(); };
$('chooseFile').onclick = () => { $('file').accept = 'application/pdf,text/plain'; $('file').click(); };
$('file').onchange = () => selectFile($('file').files[0]).catch(say);
$('addLink').onclick = () => {
  try {
    const u = new URL($('link').value);
    if (u.protocol !== 'https:' || u.username || u.password) throw Error('Нужна обычная HTTPS-ссылка');
    const text = $('text').value + ($('text').value?'\n':'') + u.href;
    if (text.length > 2000) throw Error('Текст вместе со ссылкой должен быть не длиннее 2000 символов');
    $('text').value = text; $('link').value = ''; $('attachments').close(); state.nonce = null; saveDraft(); typing();
  } catch(e) { say(e); }
};
function stopCamera() {
  state.cameraGeneration++;
  if (state.camera) for (const t of state.camera.getTracks()) t.stop();
  state.camera = null; $('video').srcObject = null;
}
$('cameraSheet').addEventListener('close',stopCamera);
$('camera').onclick = async () => {
  $('attachments').close(); const generation = ++state.cameraGeneration;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('Камера доступна только через HTTPS и с разрешения устройства');
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
    if (generation !== state.cameraGeneration || document.hidden) { for (const t of stream.getTracks()) t.stop(); return; }
    state.camera = stream; $('video').srcObject = stream; $('cameraSheet').showModal();
  } catch(e) { stopCamera(); notice('Камера не открыта: ' + e.message); }
};
$('capture').onclick = async () => {
  try {
    const v = $('video'); if (!v.videoWidth) throw Error('Камера ещё не готова');
    const c = document.createElement('canvas'), scale = Math.min(1,1280/v.videoWidth);
    c.width = v.videoWidth*scale; c.height = v.videoHeight*scale; c.getContext('2d').drawImage(v,0,0,c.width,c.height);
    const blob = await new Promise(resolve => c.toBlob(resolve,'image/jpeg',.85));
    if (!blob) throw Error('Не удалось сохранить кадр'); $('cameraSheet').close();
    await selectFile(new File([blob],'camera.jpg',{type:'image/jpeg'}));
  } catch(e) { say(e); }
};
for (let i = 0; i < 8; i++) {
  const image = el('img','creature'); image.src = '/design/' + encodeURIComponent(['Group 26.svg','Group 27.svg','Group 28.svg','Group 29.svg','Group 30.svg','Star 35.svg','Vector.svg','Vector-1.svg'][i]);
  image.style.left = (7+i*17)%95+'%'; image.style.top = (17+i*13)%93+'%'; image.style.animationDelay = -i*4+'s'; image.alt = ''; $('plankton').append(image);
}
function viewport() {
  const v = window.visualViewport;
  document.documentElement.style.setProperty('--view',(v?v.height:innerHeight)+'px');
  document.documentElement.style.setProperty('--offset',(v?v.offsetTop:0)+'px');
}
window.visualViewport?.addEventListener('resize',viewport); window.visualViewport?.addEventListener('scroll',viewport); window.addEventListener('resize',viewport); viewport();
document.addEventListener('visibilitychange',() => {
  document.body.classList.toggle('paused',document.hidden);
  if (document.hidden) { saveDraft(); stopCamera(); if ($('cameraSheet').open) $('cameraSheet').close(); }
});
window.addEventListener('pagehide',() => { saveDraft(); stopCamera(); });
window.addEventListener('offline',() => notice('Нет сети. Текст остаётся черновиком; доставка и новые совпадения недоступны.'));
setInterval(() => { if (!document.hidden && state.user && state.view === 'thread') refreshThread().catch(say); },5000);
window.addEventListener('ocean-native',e => {
  const d = e.detail;
  if (d.type === 'updateAvailable') { if (confirm('Установить ' + d.versionName + '?\n' + d.notes)) window.OceanPort?.postMessage(JSON.stringify({type:'downloadUpdate'})); }
  else if (d.type === 'installPermissionRequired') { if (confirm('Разрешить установку обновлений OSMINOG?')) window.OceanPort?.postMessage(JSON.stringify({type:'installSettings'})); }
  else if (d.message) notice(d.message);
});
window.addEventListener('message',e => {
  if (e.origin === 'https://osminog.red' && e.data === 'OSMINOG_OCEAN_NATIVE' && e.ports[0]) {
    window.OceanPort = e.ports[0]; $('update').hidden = false;
    $('update').onclick = () => window.OceanPort.postMessage(JSON.stringify({type:'checkUpdate'}));
  }
});

/* Welcome language and theme preferences. The splash is shown once per install. */
const welcomeCopy = {
 ru:{lines:['Разбуди меня от сна','просто потянув тачскрин','я подниму с морского дна','то, что скрывает глубина'],hint:'Потяни экран, чтобы войти',label:'Выбери язык'},
 en:{lines:['Wake me from my sleep','with a gentle swipe','I will rise from the ocean floor','what the deep keeps hidden'],hint:'Swipe to enter',label:'Choose your language'},
 zh:{lines:['唤醒沉睡中的我','只需轻轻滑动屏幕','我将从海底升起','带来深海隐藏的一切'],hint:'滑动屏幕进入',label:'选择语言'},
 ja:{lines:['眠る私を目覚めさせて','画面をそっとなぞって','海の底からすくい上げる','深海に隠されたものを'],hint:'スワイプして始める',label:'言語を選択'},
 ko:{lines:['잠든 나를 깨워 줘','화면을 살며시 쓸어 올려','바다 깊은 곳에서 건져 올릴게','깊은 곳에 숨겨진 것들을'],hint:'밀어서 시작하기',label:'언어 선택'},
 ar:{lines:['أيقظني من سباتي','بتمريرة لطيفة على الشاشة','سأصعد من قاع البحر','بما تخفيه الأعماق'],hint:'اسحب للدخول',label:'اختر لغتك'},
 es:{lines:['Despiértame de mi sueño','con un suave deslizamiento','subiré desde el fondo del mar','lo que esconde la profundidad'],hint:'Desliza para entrar',label:'Elige tu idioma'},
 pt:{lines:['Desperta-me do meu sono','com um leve movimento na tela','vou subir do fundo do mar','o que a profundidade esconde'],hint:'Deslize para entrar',label:'Escolha seu idioma'},
 de:{lines:['Weck mich aus dem Schlaf','mit einer sanften Wischbewegung','ich steige vom Meeresgrund empor','was die Tiefe verborgen hält'],hint:'Wischen zum Eintreten',label:'Sprache auswählen'},
 fr:{lines:['Réveille-moi de mon sommeil','d’un simple glissement','je remonterai des fonds marins','ce que les profondeurs cachent'],hint:'Glissez pour entrer',label:'Choisissez votre langue'}
};
function applyOceanTheme(theme){
  const selected=theme==='blue'?'blue':'dark';
  document.body.classList.toggle('theme-dark',selected==='dark');
  document.body.dataset.theme=selected;
  try{localStorage.setItem('ocean:theme',selected);}catch{}
  const choice=$('themeChoice');if(choice)choice.value=selected;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=selected==='dark'?'#071522':'#064579';
}
function setWelcomeLanguage(code){
  const selected=welcomeCopy[code]?code:'en',copy=welcomeCopy[selected];
  $('splashPoem').replaceChildren(...copy.lines.map((line,i)=>{const p=el('p','',line);p.style.animationDelay=(i*.55)+'s';return p;}));
  $('splashPoem').lang=selected;$('splashPoem').dir=selected==='ar'?'rtl':'auto';
  $('splashHint').textContent=copy.hint;$('languageLabel').textContent=copy.label;
  document.documentElement.lang=selected;
  try{localStorage.setItem('ocean:language',selected);}catch{}
}
function wakeOcean(){
  if(!$('splash')||$('splash').classList.contains('leaving'))return;
  try{localStorage.setItem('ocean:onboarded','1');}catch{}
  $('splash').classList.add('leaving');document.body.classList.remove('splash-active');
  setTimeout(()=>$('splash')?.remove(),950);
}
function initWelcome(){
  let language='en',theme='dark',onboarded=false;
  try{language=localStorage.getItem('ocean:language')||'en';theme=localStorage.getItem('ocean:theme')||'dark';onboarded=localStorage.getItem('ocean:onboarded')==='1';}catch{}
  $('welcomeLanguage').value=welcomeCopy[language]?language:'en';setWelcomeLanguage($('welcomeLanguage').value);
  $('welcomeLanguage').addEventListener('change',()=>setWelcomeLanguage($('welcomeLanguage').value));
  applyOceanTheme(theme);
  $('themeChoice')?.addEventListener('change',()=>applyOceanTheme($('themeChoice').value));
  if(onboarded){$('splash').remove();return;}
  document.body.classList.add('splash-active');
  $('splashWake').addEventListener('click',wakeOcean);
  let start=null;
  $('splash').addEventListener('pointerdown',e=>{if(e.target.closest('select,button'))return;start={x:e.clientX,y:e.clientY};});
  $('splash').addEventListener('pointerup',e=>{if(!start)return;const dy=start.y-e.clientY,dx=Math.abs(start.x-e.clientX);start=null;if(Math.abs(dy)>62&&dx<90)wakeOcean();});
  $('splash').addEventListener('pointercancel',()=>start=null);
}

async function boot() {
  initWelcome();
  applyOceanTheme((()=>{try{return localStorage.getItem('ocean:theme')||'dark';}catch{return 'dark';}})());
  profile(); renderHome(); restoreDraft(); resetRoute();
  try {
    const s = await api('/api/session'); state.user = s.user; state.csrf = s.csrf; state.intelligence = s.intelligence || 'disabled'; state.session++;
    profile(); restoreDraft(); resetRoute(); if (state.user) await loadHome();
  } catch { notice('Сервер океана ещё не доступен. Это интерфейс пилота; сообщения не отправляются.'); }
}
boot();
if ('serviceWorker' in navigator && location.protocol === 'https:' && !navigator.userAgent.includes('OSMINOG_Ocean')) navigator.serviceWorker.register('/sw.js').catch(() => {});
