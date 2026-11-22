'use strict';
globalThis.createMouseSettings=({N,model:m,action,setTheme,setLocale,setAppearance,changeLayout,applySide,save,zoom,agentSettings,onSidebar,status})=>{
 const d=document.querySelector('#settings-dialog'),body=d.querySelector('.dialog-content');
 d.dataset.nonmodal='true';d.setAttribute('aria-label','Настройки Mouse Browser');
 d.querySelector('header').innerHTML='<div><strong>Настройки</strong><small>Пульт управления Mouse Browser</small></div><button type="button" data-close-dialog aria-label="Закрыть настройки">×</button>';
 const toggle=(key,label,hint='')=>`<label class="settings-switch"><span>${label}${hint?'<small>'+hint+'</small>':''}</span><input type="checkbox" role="switch" data-setting="${key}"></label>`;
 body.innerHTML=`
  <label class="settings-search"><span class="library-sr">Найти настройку</span><input id="settings-search" type="search" placeholder="Найти настройку…" autocomplete="off"></label>
  <p id="settings-message" role="status" aria-live="polite" hidden></p>
  <section data-settings-section="appearance"><h3>Внешний вид</h3>
   <label class="settings-switch"><span>Тёмная тема</span><input id="settings-dark" type="checkbox" role="switch"></label>
   <label class="settings-switch"><span>Прямоугольная сетка<small>Без скруглений и отступов между окнами.</small></span><input id="settings-square-grid" type="checkbox" role="switch"></label>
   <div class="settings-white-tone"><label for="settings-white-tone">Тон белого</label><output id="settings-white-tone-value" for="settings-white-tone">#D4D4D4</output><input id="settings-white-tone" type="range" min="0" max="100" step="1" value="55" aria-describedby="settings-white-tone-hint"><span id="settings-white-tone-preview">Мягкий белый для чтения</span><button id="settings-white-tone-reset" type="button">Мягкий белый</button><small id="settings-white-tone-hint">Основной текст тёмной темы</small></div>
   <p id="settings-appearance-private" class="hint" hidden>В инкогнито изменения действуют только до выхода.</p>
   <label class="settings-field"><span>Язык интерфейса</span><select id="settings-language"><option value="ru">Русский</option><option value="en">English</option></select></label>
   <div class="settings-scale"><label for="settings-scale">Масштаб всех страниц</label><output id="settings-scale-value">100%</output><input id="settings-scale" type="range" min="25" max="500" step="5" value="100"><button type="button" id="settings-scale-reset">100%</button><small>Изменения сразу видны в открытых окнах.</small></div>
   ${toggle('showBrandName','Название рядом с логотипом')}${toggle('showFavicons','Значки сайтов во вкладках')}
   <div class="dialog-actions"><button type="button" data-settings-action="start-settings">Фон и закладки новой вкладки</button><button type="button" data-settings-action="fullscreen">Полный экран</button></div>
  </section>
  <section data-settings-section="workspace"><h3>Окна и рабочие столы</h3>
   <label class="settings-field"><span>Окон на столе</span><select id="settings-layout"><option>1</option><option>2</option><option>3</option><option>4</option><option>6</option><option>8</option><option>9</option><option>12</option></select></label>
   <label class="settings-field"><span>Ширина панели ИИ</span><input id="settings-ai-width" type="range" min="240" max="800" step="10"></label>
   ${toggle('desktopGestures','Переключать столы жестом','Два пальца по горизонтали или колесо в Норе.')}
   <div class="dialog-actions"><button type="button" data-settings-action="desktops">Рабочие столы</button><button type="button" data-settings-action="new-desktop">Добавить стол</button></div>
  </section>
  <section data-settings-section="agent"><h3>Агент Маус</h3><p class="hint">Агент рядом с вашими страницами. Подключение модели и запуск задачи остаются под вашим управлением.</p>
   <div class="dialog-actions"><button type="button" data-action="assistant">Открыть Агент Маус</button><button type="button" data-agent-settings="ollama">Подключить Ollama</button><button type="button" data-agent-settings="model">Модель и API</button><button type="button" data-agent-settings="permissions">Файлы и терминал</button></div>
   ${toggle('restoreAgent','Восстанавливать открытую панель агента','Возвращает панель после запуска; не запускает задачи автоматически.')}
  </section>
  <section data-settings-section="imports"><h3>Перенос данных</h3><p class="hint">Выберите файл экспорта из другого браузера. Исходные данные остаются на месте.</p>
   <div class="dialog-actions"><button type="button" id="settings-import-bookmarks">Импорт закладок</button><button type="button" id="settings-import-passwords">Импорт паролей CSV</button></div>
   <p id="settings-import-state" class="hint"></p><p class="hint">Закладки: HTML или Chromium JSON. Пароли сохраняются локально с шифрованием ОС и копируются по вашей команде; автоматического заполнения форм пока нет.</p>
   <details id="settings-passwords"><summary>Сохранённые пароли</summary><input id="settings-password-query" type="search" placeholder="Сайт или логин" autocomplete="off" aria-label="Найти сохранённый пароль"><div id="settings-password-list"></div><button type="button" id="settings-password-more" hidden>Показать ещё</button></details>
  </section>
  <section data-settings-section="privacy"><h3>Приватность и библиотека</h3><div class="dialog-actions"><button type="button" data-settings-action="privacy">Открыть инкогнито</button><button type="button" data-settings-action="history">История</button><button type="button" data-settings-action="bookmarks">Закладки</button></div><p class="hint">В истории можно найти и удалить выбранные записи. Данные обычного профиля не переносятся в инкогнито.</p></section>
  <section data-settings-section="capture"><h3>Скриншоты и локальный архив</h3><label class="settings-switch"><span>Автосбор снимков и текста<small>Из буфера и выбранной папки, пока браузер открыт.</small></span><input id="settings-archive" type="checkbox" role="switch"></label><p id="settings-archive-state" class="hint"></p><div class="dialog-actions"><button type="button" data-settings-action="captures">Открыть архив</button><button type="button" id="settings-archive-folder">Папка скриншотов</button><button type="button" data-settings-action="screenshot">Сделать снимок</button></div></section>
  <section data-settings-section="downloads"><h3>Загрузки</h3>${toggle('downloadBounce','Подскок стрелки после скачивания')}${toggle('downloadBadge','Число новых файлов у стрелки','Сбрасывается при открытии загрузок.')}<div class="dialog-actions"><button type="button" data-settings-action="downloads">Открыть загрузки</button></div></section>
  <section data-settings-section="documents"><h3>Документы</h3><p class="hint">PDF, Word, Excel и текст открываются в окнах только для просмотра.</p><div class="dialog-actions" id="settings-document-actions"></div></section>
  <section data-settings-section="updates"><h3>Обновления</h3><p>Mouse Browser <strong id="settings-version"></strong></p><p id="settings-update-state" class="hint"></p><progress id="settings-update-progress" max="100" hidden></progress><div class="dialog-actions"><button type="button" data-settings-update="check">Проверить обновления</button><button type="button" data-settings-update="download" hidden>Скачать</button><button type="button" data-settings-update="install" hidden>Установить и перезапустить</button><button type="button" data-settings-update="open" hidden>Открыть установщик</button></div></section>
  <section data-settings-section="about"><h3>О Mouse Browser</h3><p><strong>mouse.black</strong></p><p class="hint" id="settings-shortcuts"></p><div class="dialog-actions"><button type="button" data-settings-action="website">Открыть сайт</button></div></section>`;
 document.querySelector('#workspace').append(d);
 const $=s=>d.querySelector(s);let opened=false,serial=0,queryTimer,credentialOffset=0;
 const message=(value,error=false)=>{const node=$('#settings-message');node.hidden=!value;node.textContent=value;node.dataset.error=String(error);};
 const run=fn=>Promise.resolve().then(fn).catch(e=>{message(e.message,true);status(e.message);});
 function sync(){
  $('#settings-dark').checked=m.theme==='dark';$('#settings-language').value=m.locale;
  const appearance=MouseAppearance.normalize(m.appearance);$('#settings-square-grid').checked=appearance.paneMode==='square';$('#settings-white-tone').value=appearance.whiteTone;$('#settings-white-tone-value').textContent=MouseAppearance.color(appearance.whiteTone);$('#settings-white-tone').setAttribute('aria-valuetext',MouseAppearance.color(appearance.whiteTone));$('#settings-appearance-private').hidden=!m.privateMode;
  const count=String(MouseLayout.leaves(m.tree).length),select=$('#settings-layout');if(![...select.options].some(option=>option.value===count)){const option=document.createElement('option');option.value=count;option.textContent=count;select.append(option);}select.value=count;$('#settings-ai-width').max=Math.max(240,document.querySelector('#workspace').clientWidth-280);$('#settings-ai-width').value=m.aiWidth;
  for(const input of d.querySelectorAll('[data-setting]')){input.checked=m.controlSettings?.[input.dataset.setting]!==false;input.disabled=!!m.privateMode;}
  d.querySelector('[data-settings-action="privacy"]').textContent=m.privateMode?'Вернуться в обычный режим':'Открыть инкогнито';
  for(const input of d.querySelectorAll('[data-action="assistant"],[data-agent-settings],#settings-import-bookmarks,#settings-import-passwords,#settings-archive,#settings-archive-folder'))input.disabled=!!m.privateMode;
  $('#settings-version').textContent=N.version;const mod=N.platform==='darwin'?'⌘':'Ctrl+';
  $('#settings-shortcuts').textContent=`${mod}T — новая вкладка · ${mod}L — адрес · ${mod}O — документ · ${mod}W — закрыть вкладку · Esc — закрыть панель.`;
  document.querySelector('#settings-button')?.setAttribute('aria-expanded',String(opened));
 }
 function zoomState(s){if(!Number.isFinite(s?.factor))return;$('#settings-scale-value').textContent=Math.round(s.factor*100)+'%';$('#settings-scale').value=Math.round(s.factor*100);}
 function updateState(s){
  if(!s)return;const labels={idle:'Проверка ещё не выполнялась',checking:'Проверяем…',current:'Установлена актуальная версия',available:'Доступна версия '+s.latestVersion,downloading:'Скачивание: '+Math.floor(s.percent||0)+'%',ready:'Файл скачан и проверен',opened:'Установщик открыт',installing:'Сохраняем профиль и устанавливаем…',error:s.error};$('#settings-update-state').textContent=labels[s.phase]||'';
  const progress=$('#settings-update-progress');progress.hidden=s.phase!=='downloading';progress.value=s.percent||0;
  for(const b of d.querySelectorAll('[data-settings-update]')){const a=b.dataset.settingsUpdate;b.hidden=a==='download'?s.phase!=='available':a==='install'?!['ready','opened'].includes(s.phase)||!s.canInstall:a==='open'?!['ready','opened'].includes(s.phase):false;b.disabled=['checking','downloading','installing'].includes(s.phase);}
 }
 async function archiveState(){if(m.privateMode){$('#settings-archive').checked=false;$('#settings-archive-state').textContent='Архив недоступен в инкогнито.';return;}const s=await N.archive('state');$('#settings-archive').checked=s.enabled;$('#settings-archive-state').textContent=s.error||`${s.count} записей · ${s.enabled?'Сбор включён':'Сбор выключен'}`;}
 async function importState(){if(m.privateMode){$('#settings-import-state').textContent='Перенос данных доступен в обычном режиме.';$('#settings-password-list').replaceChildren();return;}const s=await N.import('state');$('#settings-import-passwords').disabled=!s.passwords.available;$('#settings-import-state').textContent=`Закладок: ${s.bookmarksCount}. Паролей: ${s.passwords.count}.`+(s.passwords.available?'':' '+s.passwords.reason);}
 function filter(){const query=$('#settings-search').value.trim().toLocaleLowerCase();for(const section of d.querySelectorAll('[data-settings-section]'))section.hidden=!!query&&!section.textContent.toLocaleLowerCase().includes(query);}
 async function passwords(append=false){
  if(m.privateMode)return;const ticket=++serial;if(!append)credentialOffset=0;const result=await N.import('credentials/list',{query:$('#settings-password-query').value,offset:credentialOffset});if(ticket!==serial)return;
  const list=$('#settings-password-list');if(!append)list.replaceChildren();
  if(!result.available){const p=document.createElement('p');p.className='hint';p.textContent=result.reason;list.append(p);return;}
  for(const item of result.items){const row=document.createElement('article');row.className='settings-credential';const labels=document.createElement('div'),site=document.createElement('strong'),user=document.createElement('span');site.textContent=item.origin;user.textContent=item.username;labels.append(site,user);row.append(labels);
   for(const [name,label]of [['copy','Копировать'],['remove','Удалить']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>run(async()=>{const out=await N.import('credentials/'+name,{id:item.id});if(name==='copy'&&out.copied)message('Пароль скопирован на '+out.clearAfterSeconds+' секунд.');if(name==='remove'&&out.removed){await passwords();await importState();}});row.append(b);}list.append(row);}
  credentialOffset+=result.items.length;$('#settings-password-more').hidden=credentialOffset>=result.total;
  if(!result.total){const p=document.createElement('p');p.className='hint';p.textContent='Сохранённых паролей пока нет.';list.append(p);}
 }
 async function open(){if(opened)return close();opened=true;message('');sync();if(!d.open)d.show();onSidebar(true);document.querySelector('#settings-button')?.setAttribute('aria-expanded','true');$('#settings-search').focus({preventScroll:true});await Promise.allSettled([N.zoom('state').then(zoomState),N.update('state').then(updateState),archiveState(),importState()]);}
 function close(){opened=false;serial++;clearTimeout(queryTimer);if(d.open)d.close();onSidebar(false);document.querySelector('#settings-button')?.setAttribute('aria-expanded','false');}
 d.querySelector('[data-close-dialog]').onclick=close;d.addEventListener('close',()=>{if(opened)close();});
 d.addEventListener('click',e=>{const a=e.target.closest('[data-settings-action]');if(a)void run(async()=>{if(['assistant','privacy','desktops','new-desktop','history','bookmarks','downloads','captures','start-settings','screenshot','website','fullscreen'].includes(a.dataset.settingsAction))close();return action(a.dataset.settingsAction);});const agent=e.target.closest('[data-agent-settings]');if(agent)void run(async()=>{close();await agentSettings(agent.dataset.agentSettings);});});
 $('#settings-dark').onchange=e=>{setTheme(e.target.checked?'dark':'light');sync();};$('#settings-language').onchange=e=>{setLocale(e.target.value);sync();};
 $('#settings-square-grid').onchange=e=>setAppearance({paneMode:e.target.checked?'square':'rounded'});$('#settings-white-tone').oninput=e=>setAppearance({whiteTone:Number(e.target.value)});$('#settings-white-tone-reset').onclick=()=>setAppearance({whiteTone:MouseAppearance.DEFAULTS.whiteTone});
 $('#settings-layout').onchange=e=>run(()=>changeLayout(Number(e.target.value)));$('#settings-ai-width').oninput=e=>{m.aiWidth=Number(e.target.value);applySide();save();};
 for(const input of d.querySelectorAll('[data-setting]'))input.onchange=()=>run(async()=>{try{m.controlSettings=await N.settings('set',{[input.dataset.setting]:input.checked});}finally{sync();}});
 $('#settings-scale').oninput=e=>zoom('set',Number(e.target.value)/100);$('#settings-scale-reset').onclick=()=>zoom('reset');
 $('#settings-search').oninput=filter;$('#settings-password-query').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>void run(()=>passwords()),180);};$('#settings-passwords').ontoggle=()=>{if($('#settings-passwords').open)void run(()=>passwords());};$('#settings-password-more').onclick=()=>run(()=>passwords(true));
 for(const kind of ['bookmarks','passwords'])$('#settings-import-'+kind).onclick=()=>run(async()=>{const result=await N.import(kind);if(!result.canceled){message(`Импортировано: ${result.imported}. Уже есть: ${result.duplicates}. Пропущено: ${result.skipped}${result.conflicts?' · Различающихся записей без замены: '+result.conflicts:''}.`);await importState();if($('#settings-passwords').open)await passwords();}});
 $('#settings-archive').onchange=e=>run(async()=>{await N.archive('toggle',{enabled:e.target.checked});await archiveState();});$('#settings-archive-folder').onclick=()=>run(async()=>{await N.archive('folder');await archiveState();});
 for(const b of d.querySelectorAll('[data-settings-update]'))b.onclick=()=>run(async()=>updateState(await N.update(b.dataset.settingsUpdate)));
 N.onZoom(zoomState);N.onUpdate(updateState);N.onSettings?.(sync);N.onLibrary(()=>{if(opened)void run(archiveState);});
 return{open,close,sync,isOpen:()=>opened,filter};
};
