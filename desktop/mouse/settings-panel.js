'use strict';
globalThis.createMouseSettings=({N,model:m,action,setTheme,setLocale,setAppearance,changeLayout,applySide,save,zoom,onSidebar,status})=>{
 const d=document.querySelector('#settings-dialog'),body=d.querySelector('.dialog-content');
 const shapes={
  overview:'<rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect>',
  appearance:'<path d="M20.8 13.4A9 9 0 1 1 10.6 3.2a7 7 0 0 0 10.2 10.2Z"></path><path d="m17 3 .5 1.5L19 5l-1.5.5L17 7l-.5-1.5L15 5l1.5-.5Z"></path>',
  workspace:'<rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M3 9h18M12 9v11"></path><path d="M6 6.5h.01M9 6.5h.01"></path>',
  privacy:'<path d="m12 3 8 3v5c0 5-4.3 8.5-8 10-3.7-1.5-8-5-8-10V6Z"></path><path d="m8.5 12 2.3 2.3 4.7-4.6"></path>',
  imports:'<rect x="4" y="12" width="16" height="8" rx="2.5"></rect><path d="M12 3v12m-4-4 4 4 4-4M7 17h.01"></path>',
  capture:'<path d="M8 5.5 9.5 3h5L16 5.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z"></path><circle cx="12" cy="12.5" r="4"></circle>',
  downloads:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"></path>',
  documents:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"></path><path d="M14 3v6h6M8 13h8M8 17h5"></path>',
  about:'<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"></path><circle cx="8" cy="6" r="2" fill="currentColor"></circle><circle cx="16" cy="12" r="2" fill="currentColor"></circle><circle cx="10" cy="18" r="2" fill="currentColor"></circle>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4 4"></path>',
  close:'<path d="m6 6 12 12M18 6 6 18"></path>',
  chevron:'<path d="m9 5 7 7-7 7"></path>',
  check:'<path d="m5 12 4 4L19 6"></path>',
  key:'<circle cx="8" cy="9" r="5"></circle><path d="m12 13 8 8m-3-3 3-3m-6 0 3-3"></path>',
  update:'<path d="M20 7v5h-5M4 17v-5h5"></path><path d="M6 6a8 8 0 0 1 13 1l1 2M4 15l1 2a8 8 0 0 0 13 1"></path>'
 };
 const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]||shapes.settings}</svg>`;
 const icon=(name,tone)=>`<span class="settings-icon" data-icon="${name}" data-tone="${tone}">${svg(name)}</span>`;
 const pages=[
  {id:'overview',title:'Основное',description:'Главные настройки — всегда под рукой.',icon:'overview',tone:'blue'},
  {id:'appearance',title:'Оформление',description:'Тема, цвета и детали интерфейса.',icon:'appearance',tone:'purple'},
  {id:'workspace',title:'Окна и столы',description:'Удобное пространство для ваших задач.',icon:'workspace',tone:'blue'},
  {id:'privacy',title:'Приватность',description:'Реклама, инкогнито и история просмотра.',icon:'privacy',tone:'green'},
  {id:'imports',title:'Пароли и перенос',description:'Ваши закладки и пароли из другого браузера.',icon:'key',tone:'amber'},
  {id:'capture',title:'Снимки и архив',description:'Скриншоты, сочетания клавиш и локальный архив.',icon:'capture',tone:'pink'},
  {id:'downloads',title:'Загрузки',description:'Уведомления о скачанных файлах.',icon:'downloads',tone:'cyan'},
  {id:'documents',title:'Документы',description:'Просмотр файлов внутри Mouse.',icon:'documents',tone:'orange'},
  {id:'about',title:'О браузере',description:'Версия, обновления и полезные сочетания.',icon:'about',tone:'slate'}
 ];
 const heading=(name,tone,title,hint='')=>`<div class="settings-card-heading">${icon(name,tone)}<div><h3>${title}</h3>${hint?`<p>${hint}</p>`:''}</div></div>`;
 const toggle=(key,label,hint='',featured=false)=>`<label class="settings-switch${featured?' settings-switch-feature':''}"><span class="settings-control-copy"><strong>${label}</strong>${hint?'<small>'+hint+'</small>':''}</span><input type="checkbox" role="switch" data-setting="${key}"></label>`;
 const quick=(id,hint)=>{const p=pages.find(x=>x.id===id);return `<button type="button" class="settings-quick-link" data-settings-page="${id}">${icon(p.icon,p.tone)}<span><strong>${p.title}</strong><small>${hint}</small></span>${svg('chevron')}</button>`;};
 d.dataset.nonmodal='true';d.setAttribute('aria-label','Настройки Mouse Browser');
 d.querySelector('header').innerHTML=`<span class="settings-heading-icon">${icon('settings','slate')}</span><div><strong>Настройки</strong><small>Mouse Browser</small></div><button type="button" class="settings-close" data-close-dialog aria-label="Закрыть настройки">${svg('close')}</button>`;
 body.innerHTML=`<div class="settings-layout">
  <aside class="settings-sidebar">
   <label class="settings-search">${svg('search')}<span class="library-sr">Найти настройку</span><input id="settings-search" type="search" placeholder="Поиск настроек" autocomplete="off"><button id="settings-search-clear" type="button" aria-label="Очистить поиск" hidden>${svg('close')}</button></label>
   <nav class="settings-navigation" aria-label="Разделы настроек">${pages.map(p=>`<button type="button" class="settings-nav-item" data-settings-page="${p.id}" aria-current="${p.id==='overview'?'page':'false'}">${icon(p.icon,p.tone)}<span class="settings-nav-label">${p.title}</span></button>`).join('')}</nav>
   <div class="settings-sidebar-footer"><strong>Mouse Browser</strong><span id="settings-sidebar-version"></span></div>
  </aside>
  <div class="settings-main" role="region" aria-labelledby="settings-page-title" tabindex="-1">
   <div class="settings-page-heading"><span class="settings-eyebrow">MOUSE BROWSER</span><h2 id="settings-page-title">Основное</h2><p id="settings-page-description">Главные настройки — всегда под рукой.</p></div>
   <p id="settings-private-note" class="settings-notice" hidden>Инкогнито. Часть настроек недоступна; изменения оформления действуют только в этой сессии.</p>
   <p id="settings-message" role="status" aria-live="polite" hidden></p>
   <div id="settings-empty" hidden>${icon('search','slate')}<h3>Ничего не найдено</h3><p>Попробуйте «реклама», «тема» или «снимки».</p><button type="button" id="settings-search-reset">Сбросить поиск</button></div>
   <div class="settings-sections">
    <section class="settings-card settings-adblock-card" data-settings-section="privacy" data-pages="overview privacy" data-keywords="adblock ad block ads реклама реклам вк vk фильтр защита privacy">
     ${heading('privacy','green','Реклама и фильтры')}
     ${toggle('blockAds','Блокировать рекламу','Блокирует рекламные запросы. После изменения при необходимости обновите страницу.',true)}
     <div class="settings-status-row" data-state="off"><span class="settings-status-dot" aria-hidden="true"></span><strong id="settings-blockads-label">Выключена</strong><small id="settings-adblock-state" role="status" aria-live="polite" hidden></small></div>
    </section>
    <section class="settings-overview-links" data-settings-section="overview-links" data-pages="overview" data-settings-searchable="false">
     <h3>Настройте под себя</h3><div class="settings-quick-grid">${quick('appearance','Тема, цвета и масштаб')}${quick('workspace','Сетка и рабочие столы')}${quick('capture','Снимки и горячие клавиши')}${quick('imports','Закладки и пароли')}</div>
     <p class="settings-autosave">${svg('check')}<span>Изменения сохраняются автоматически.</span></p>
    </section>
    <section class="settings-card" data-settings-section="appearance" data-pages="appearance" data-keywords="theme dark light color white тёмная темная светлая цвет apple стекло" hidden>
     ${heading('appearance','purple','Тема и цвета')}
     <label class="settings-switch"><span class="settings-control-copy"><strong>Тёмная тема</strong><small>Тёмное стекло и мягкий светлый текст.</small></span><input id="settings-dark" type="checkbox" role="switch"></label>
     <label class="settings-switch"><span class="settings-control-copy"><strong>Прямоугольная сетка</strong><small>Без скруглений, с тонкими разделителями между окнами.</small></span><input id="settings-square-grid" type="checkbox" role="switch"></label>
     <div class="settings-white-tone"><label for="settings-white-tone">Тон белого</label><output id="settings-white-tone-value" for="settings-white-tone">#D4D4D4</output><input id="settings-white-tone" type="range" min="0" max="100" step="1" value="55" aria-describedby="settings-white-tone-hint"><span id="settings-white-tone-preview">Мягкий белый для чтения</span><button id="settings-white-tone-reset" type="button">Мягкий белый</button><small id="settings-white-tone-hint">Светлый текст сайтов и интерфейса в тёмной теме</small></div>
     <p id="settings-appearance-private" class="hint" hidden>В инкогнито изменения действуют только до выхода.</p>
    </section>
    <section class="settings-card" data-settings-section="interface" data-pages="appearance" data-keywords="язык русский english language logo favicon" hidden>
     ${heading('settings','blue','Детали интерфейса')}
     <label class="settings-field"><span>Язык интерфейса</span><select id="settings-language"><option value="ru">Русский</option><option value="en">English</option></select></label>
     ${toggle('showBrandName','Название рядом с логотипом')}${toggle('showFavicons','Значки сайтов во вкладках')}
     <div class="dialog-actions"><button type="button" data-settings-action="start-settings">Фон и закладки новой вкладки</button><button type="button" data-settings-action="fullscreen">Полный экран</button></div>
    </section>
    <section class="settings-card" data-settings-section="scale" data-pages="appearance" data-keywords="zoom scale размер шрифт масштаб" hidden>
     ${heading('search','cyan','Масштаб страниц')}
     <div class="settings-scale"><label for="settings-scale">Масштаб всех страниц</label><output id="settings-scale-value">100%</output><input id="settings-scale" type="range" min="25" max="500" step="5" value="100"><button type="button" id="settings-scale-reset">100%</button><small>Изменения сразу видны в открытых окнах.</small></div>
    </section>
    <section class="settings-card" data-settings-section="workspace" data-pages="workspace" data-keywords="окна рабочий стол сетка layout grid ai ии жест gesture" hidden>
     ${heading('workspace','blue','Рабочее пространство')}
     <label class="settings-field"><span>Окон на столе</span><select id="settings-layout"><option>1</option><option>2</option><option>3</option><option>4</option><option>6</option><option>8</option><option>9</option><option>12</option></select></label>
     <label class="settings-field"><span>Ширина панели ИИ</span><input id="settings-ai-width" type="range" min="240" max="800" step="10"></label>
     ${toggle('desktopGestures','Переключать столы жестом','Два пальца по горизонтали или колесо в Норе.')}
     <div class="dialog-actions"><button type="button" data-settings-action="desktops">Рабочие столы</button><button type="button" data-settings-action="new-desktop">Добавить стол</button></div>
    </section>
    <section class="settings-card" data-settings-section="imports" data-pages="imports" data-keywords="import chrome chromium safari html json csv перенос закладк пароль password" hidden>
     ${heading('imports','amber','Перенос данных','Из другого браузера в Mouse')}
     <p class="hint">Выберите файл экспорта из другого браузера. Исходные данные остаются на месте.</p>
     <div class="dialog-actions"><button type="button" id="settings-import-bookmarks">Импорт закладок</button><button type="button" id="settings-import-passwords">Импорт паролей CSV</button></div>
     <p id="settings-import-state" class="hint"></p>
     <details class="settings-details"><summary>Форматы и хранение данных</summary><p class="hint">Закладки: HTML или Chromium JSON. Пароли сохраняются локально с шифрованием ОС и копируются по вашей команде; автоматического заполнения форм пока нет.</p></details>
    </section>
    <section class="settings-card" data-settings-section="passwords" data-pages="imports" data-keywords="password credential пароль пароли логин copy" hidden>
     ${heading('key','amber','Ваши пароли')}
     <details id="settings-passwords" class="settings-details"><summary>Сохранённые пароли</summary><input id="settings-password-query" type="search" placeholder="Сайт или логин" autocomplete="off" aria-label="Найти сохранённый пароль"><div id="settings-password-list"></div><button type="button" id="settings-password-more" hidden>Показать ещё</button></details>
    </section>
    <section class="settings-card" data-settings-section="private-browsing" data-pages="privacy" data-keywords="private incognito history bookmarks инкогнито приватность история закладки" hidden>
     ${heading('privacy','slate','История и приватный режим')}
     <div class="dialog-actions"><button type="button" data-settings-action="privacy">Открыть инкогнито</button><button type="button" data-settings-action="history">История</button><button type="button" data-settings-action="bookmarks">Закладки</button></div>
     <p class="hint">В истории можно найти и удалить выбранные записи. Данные обычного профиля не переносятся в инкогнито.</p>
    </section>
    <section class="settings-card" data-settings-section="capture" data-pages="capture" data-keywords="screenshot screen capture archive control ctrl снимок снимки скриншот экран архив буфер горячие клавиши" hidden>
     ${heading('capture','pink','Снимки и локальный архив')}
     <label class="settings-switch"><span class="settings-control-copy"><strong>Автосбор снимков и текста</strong><small>Из буфера и выбранной папки, пока браузер открыт.</small></span><input id="settings-archive" type="checkbox" role="switch"></label>
     <p id="settings-archive-state" class="hint"></p><div class="dialog-actions"><button type="button" data-settings-action="captures">Открыть архив</button><button type="button" id="settings-archive-folder">Папка скриншотов</button><button type="button" data-settings-action="screenshot">Сделать снимок</button></div>
    </section>
    <section class="settings-card" data-settings-section="downloads" data-pages="downloads" data-keywords="download скачивание файлы уведомления" hidden>
     ${heading('downloads','cyan','Завершение загрузки')}${toggle('downloadBounce','Подскок стрелки после скачивания')}${toggle('downloadBadge','Число новых файлов у стрелки','Сбрасывается при открытии загрузок.')}<div class="dialog-actions"><button type="button" data-settings-action="downloads">Открыть загрузки</button></div>
    </section>
    <section class="settings-card" data-settings-section="documents" data-pages="documents" data-keywords="pdf doc docx word excel xlsx txt документ файл office" hidden>
     ${heading('documents','orange','Открыть документ')}<p class="hint">PDF, Word, Excel и текст открываются в окнах только для просмотра.</p><div class="dialog-actions" id="settings-document-actions"></div>
    </section>
    <section class="settings-card" data-settings-section="updates" data-pages="about" data-keywords="update version обновление версия установить" hidden>
     ${heading('update','blue','Обновления')}<p>Mouse Browser <strong id="settings-version"></strong></p><p id="settings-update-state" class="hint"></p><progress id="settings-update-progress" max="100" hidden></progress><div class="dialog-actions"><button type="button" data-settings-update="check">Проверить обновления</button><button type="button" data-settings-update="download" hidden>Скачать</button><button type="button" data-settings-update="install" hidden>Установить и перезапустить</button><button type="button" data-settings-update="open" hidden>Открыть установщик</button></div>
    </section>
    <section class="settings-card" data-settings-section="about" data-pages="about" data-keywords="mouse browser сайт website shortcuts сочетания клавиш" hidden>
     ${heading('about','slate','О Mouse Browser')}<p><strong>mouse.black</strong></p><p class="hint" id="settings-shortcuts"></p><div class="dialog-actions"><button type="button" data-settings-action="website">Открыть сайт</button></div>
    </section>
   </div>
  </div>
 </div>`;
 document.querySelector('#workspace').append(d);
 const $=s=>d.querySelector(s);let opened=false,serial=0,queryTimer,credentialOffset=0,adBlockSerial=0,selectedPage='overview',lastAdBlockState;
 $('[data-setting="blockAds"]').setAttribute('aria-describedby','settings-adblock-state');
 const message=(value,error=false)=>{const node=$('#settings-message');node.hidden=!value;node.textContent=value;node.dataset.error=String(error);};
 const run=fn=>Promise.resolve().then(fn).catch(e=>{message(e.message,true);status(e.message);});
 function sync(){
  $('#settings-dark').checked=m.theme==='dark';$('#settings-language').value=m.locale;
  const appearance=MouseAppearance.normalize(m.appearance);$('#settings-square-grid').checked=appearance.paneMode==='square';$('#settings-white-tone').value=appearance.whiteTone;$('#settings-white-tone-value').textContent=MouseAppearance.color(appearance.whiteTone);$('#settings-white-tone').setAttribute('aria-valuetext',MouseAppearance.color(appearance.whiteTone));$('#settings-appearance-private').hidden=!m.privateMode;
  const count=String(MouseLayout.leaves(m.tree).length),select=$('#settings-layout');if(![...select.options].some(option=>option.value===count)){const option=document.createElement('option');option.value=count;option.textContent=count;select.append(option);}select.value=count;$('#settings-ai-width').max=Math.max(240,document.querySelector('#workspace').clientWidth-280);$('#settings-ai-width').value=m.aiWidth;
  for(const input of d.querySelectorAll('[data-setting]')){const key=input.dataset.setting;input.checked=key==='blockAds'?m.controlSettings?.[key]===true:m.controlSettings?.[key]!==false;input.disabled=!!m.privateMode;}
  d.querySelector('[data-settings-action="privacy"]').textContent=m.privateMode?'Вернуться в обычный режим':'Открыть инкогнито';
  for(const input of d.querySelectorAll('#settings-import-bookmarks,#settings-import-passwords,#settings-archive,#settings-archive-folder'))input.disabled=!!m.privateMode;
  $('#settings-version').textContent=N.version;$('#settings-sidebar-version').textContent='v'+N.version;$('#settings-private-note').hidden=!m.privateMode;$('#settings-blockads-label').textContent=m.controlSettings?.blockAds===true?'Включена':'Выключена';$('[data-settings-section=privacy]').dataset.enabled=String(m.controlSettings?.blockAds===true);if(!lastAdBlockState)$('.settings-status-row').dataset.state=m.controlSettings?.blockAds===true?'unknown':'off';const mod=N.platform==='darwin'?'⌘':'Ctrl+';
  $('#settings-shortcuts').textContent=`${mod}T — новая вкладка · ${mod}L — адрес · ${mod}O — документ · ${mod}W — закрыть вкладку · Esc — закрыть панель.`;
  document.querySelector('#settings-button')?.setAttribute('aria-expanded',String(opened));
  globalThis.MouseLocale?.apply(m.locale);
 }
 function zoomState(s){if(!Number.isFinite(s?.factor))return;$('#settings-scale-value').textContent=Math.round(s.factor*100)+'%';$('#settings-scale').value=Math.round(s.factor*100);}
 function adBlockState(s){
  const node=$('#settings-adblock-state'),labels={off:'Блокировка рекламы выключена',loading:'Загружаем списки фильтров…',ready:'Локальные списки фильтров готовы',fallback:'Базовые правила · списки недоступны'};
  lastAdBlockState=s;node.hidden=!s;node.textContent=s?(labels[s.enabled?s.phase:'off']||'Статус фильтров недоступен'):'';$('.settings-status-row').dataset.state=s?(s.enabled?s.phase:'off'):'unknown';globalThis.MouseLocale?.apply(m.locale);
 }
 async function refreshAdBlockState(){
  if(!N.adBlockState)return;const ticket=++adBlockSerial;
  try{const state=await N.adBlockState();if(ticket===adBlockSerial)adBlockState(state);}
  catch{if(ticket===adBlockSerial)adBlockState({enabled:true,phase:'unknown'});}
 }
 function updateState(s){
  if(!s)return;const labels={idle:'Проверка ещё не выполнялась',checking:'Проверяем…',current:'Установлена актуальная версия',available:'Доступна версия '+s.latestVersion,downloading:'Скачивание: '+Math.floor(s.percent||0)+'%',ready:'Файл скачан и проверен',opened:'Установщик открыт',installing:'Сохраняем профиль и устанавливаем…',error:s.error};$('#settings-update-state').textContent=labels[s.phase]||'';
  const progress=$('#settings-update-progress');progress.hidden=s.phase!=='downloading';progress.value=s.percent||0;
  for(const b of d.querySelectorAll('[data-settings-update]')){const a=b.dataset.settingsUpdate;b.hidden=a==='download'?s.phase!=='available':a==='install'?!['ready','opened'].includes(s.phase)||!s.canInstall:a==='open'?!['ready','opened'].includes(s.phase):false;b.disabled=['checking','downloading','installing'].includes(s.phase);}
 }
 async function archiveState(){if(m.privateMode){$('#settings-archive').checked=false;$('#settings-archive-state').textContent='Архив недоступен в инкогнито.';return;}const s=await N.archive('state');$('#settings-archive').checked=s.enabled;$('#settings-archive-state').textContent=s.error||`${s.count} записей · ${s.enabled?'Сбор включён':'Сбор выключен'}`;}
 async function importState(){if(m.privateMode){$('#settings-import-state').textContent='Перенос данных доступен в обычном режиме.';$('#settings-password-list').replaceChildren();return;}const s=await N.import('state');$('#settings-import-passwords').disabled=!s.passwords.available;$('#settings-import-state').textContent=`Закладок: ${s.bookmarksCount}. Паролей: ${s.passwords.count}.`+(s.passwords.available?'':' '+s.passwords.reason);}
 const normalized=value=>String(value).toLocaleLowerCase().replaceAll('ё','е').trim();
 function filter(){
  const query=normalized($('#settings-search').value),terms=query.split(/\s+/).filter(Boolean);let count=0;
  for(const section of d.querySelectorAll('[data-settings-section]')){
   const walk=document.createTreeWalker(section,NodeFilter.SHOW_TEXT),parts=[];let textNode;while((textNode=walk.nextNode()))parts.push(textNode.data);
   const haystack=normalized(parts.join(' ')+' '+(section.dataset.keywords||'')),words=haystack.match(/[\p{L}\p{N}]+/gu)||[];
   const visible=query?section.dataset.settingsSearchable!=='false'&&terms.every(term=>/^[\p{L}\p{N}]+$/u.test(term)?words.some(word=>term.length<=2?word===term:word.startsWith(term)):haystack.includes(term)):section.dataset.pages.split(' ').includes(selectedPage);
   section.hidden=!visible;if(visible)count++;
  }
  $('#settings-search-clear').hidden=!query;$('#settings-empty').hidden=!query||count>0;
  const page=pages.find(p=>p.id===selectedPage);
  $('#settings-page-title').textContent=query?'Результаты поиска':page.title;
  $('#settings-page-description').textContent=query?'Настройки из всех разделов.':page.description;
  for(const button of d.querySelectorAll('.settings-nav-item'))button.setAttribute('aria-current',!query&&button.dataset.settingsPage===selectedPage?'page':'false');
  d.dataset.searching=String(!!query);globalThis.MouseLocale?.apply(m.locale);
 }
 function clearSearch(){ $('#settings-search').value='';filter();$('.settings-main').scrollTop=0;$('#settings-search').focus({preventScroll:true}); }
 function selectPage(id){
  if(!pages.some(p=>p.id===id))return;selectedPage=id;$('#settings-search').value='';filter();$('.settings-main').scrollTop=0;$('.settings-nav-item[data-settings-page='+id+']')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
 }

 async function passwords(append=false){
  if(m.privateMode)return;const ticket=++serial;if(!append)credentialOffset=0;const result=await N.import('credentials/list',{query:$('#settings-password-query').value,offset:credentialOffset});if(ticket!==serial)return;
  const list=$('#settings-password-list');if(!append)list.replaceChildren();
  if(!result.available){const p=document.createElement('p');p.className='hint';p.textContent=result.reason;list.append(p);return;}
  for(const item of result.items){const row=document.createElement('article');row.className='settings-credential';const labels=document.createElement('div'),site=document.createElement('strong'),user=document.createElement('span');site.textContent=item.origin;user.textContent=item.username;labels.append(site,user);row.append(labels);
   for(const [name,label]of [['copy','Копировать'],['remove','Удалить']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>run(async()=>{const out=await N.import('credentials/'+name,{id:item.id});if(name==='copy'&&out.copied)message('Пароль скопирован на '+out.clearAfterSeconds+' секунд.');if(name==='remove'&&out.removed){await passwords();await importState();}});row.append(b);}list.append(row);}
  credentialOffset+=result.items.length;$('#settings-password-more').hidden=credentialOffset>=result.total;
  if(!result.total){const p=document.createElement('p');p.className='hint';p.textContent='Сохранённых паролей пока нет.';list.append(p);}
 }
 async function open(){if(opened)return close();opened=true;message('');selectPage('overview');sync();if(!d.open)d.show();onSidebar(true);document.querySelector('#settings-button')?.setAttribute('aria-expanded','true');$('#settings-search').focus({preventScroll:true});await Promise.allSettled([N.zoom('state').then(zoomState),N.update('state').then(updateState),archiveState(),importState(),refreshAdBlockState()]);}
 function close(){opened=false;serial++;clearTimeout(queryTimer);if(d.open)d.close();onSidebar(false);document.querySelector('#settings-button')?.setAttribute('aria-expanded','false');document.querySelector('#settings-button')?.focus({preventScroll:true});}
 d.querySelector('[data-close-dialog]').onclick=close;d.addEventListener('close',()=>{if(opened)close();});
 d.addEventListener('click',e=>{const page=e.target.closest('[data-settings-page]');if(page){selectPage(page.dataset.settingsPage);return;}const a=e.target.closest('[data-settings-action]');if(a)void run(async()=>{if(['privacy','desktops','new-desktop','history','bookmarks','downloads','captures','start-settings','screenshot','website','fullscreen'].includes(a.dataset.settingsAction))close();return action(a.dataset.settingsAction);});});
 $('#settings-dark').onchange=e=>{setTheme(e.target.checked?'dark':'light');sync();};$('#settings-language').onchange=e=>{setLocale(e.target.value);sync();};
 $('#settings-square-grid').onchange=e=>setAppearance({paneMode:e.target.checked?'square':'rounded'});$('#settings-white-tone').oninput=e=>setAppearance({whiteTone:Number(e.target.value)});$('#settings-white-tone-reset').onclick=()=>setAppearance({whiteTone:MouseAppearance.DEFAULTS.whiteTone});
 $('#settings-layout').onchange=e=>run(()=>changeLayout(Number(e.target.value)));$('#settings-ai-width').oninput=e=>{m.aiWidth=Number(e.target.value);applySide();save();};
 for(const input of d.querySelectorAll('[data-setting]'))input.onchange=()=>run(async()=>{try{m.controlSettings=await N.settings('set',{[input.dataset.setting]:input.checked});}finally{sync();}});
 $('#settings-scale').oninput=e=>zoom('set',Number(e.target.value)/100);$('#settings-scale-reset').onclick=()=>zoom('reset');
 $('#settings-search').oninput=()=>{filter();$('.settings-main').scrollTop=0;};$('#settings-search-clear').onclick=clearSearch;$('#settings-search-reset').onclick=clearSearch;$('#settings-search').onkeydown=e=>{if(e.key==='Escape'&&$('#settings-search').value){e.preventDefault();e.stopPropagation();clearSearch();}};$('#settings-password-query').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>void run(()=>passwords()),180);};$('#settings-passwords').ontoggle=()=>{if($('#settings-passwords').open)void run(()=>passwords());};$('#settings-password-more').onclick=()=>run(()=>passwords(true));
 for(const kind of ['bookmarks','passwords'])$('#settings-import-'+kind).onclick=()=>run(async()=>{const result=await N.import(kind);if(!result.canceled){message(`Импортировано: ${result.imported}. Уже есть: ${result.duplicates}. Пропущено: ${result.skipped}${result.conflicts?' · Различающихся записей без замены: '+result.conflicts:''}.`);await importState();if($('#settings-passwords').open)await passwords();}});
 $('#settings-archive').onchange=e=>run(async()=>{await N.archive('toggle',{enabled:e.target.checked});await archiveState();});$('#settings-archive-folder').onclick=()=>run(async()=>{await N.archive('folder');await archiveState();});
 for(const b of d.querySelectorAll('[data-settings-update]'))b.onclick=()=>run(async()=>updateState(await N.update(b.dataset.settingsUpdate)));
 N.onZoom(zoomState);N.onUpdate(updateState);N.onSettings?.(sync);N.onAdBlockState?.(s=>{adBlockSerial++;adBlockState(s);});N.onLibrary(()=>{if(opened)void run(archiveState);});
 return{open,close,sync,isOpen:()=>opened,filter};
};
