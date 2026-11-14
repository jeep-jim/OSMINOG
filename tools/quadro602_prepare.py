from pathlib import Path
root=Path(__file__).resolve().parents[1];d=root/'desktop'
def edit(file,old,new):
 p=root/file;s=p.read_text();assert old in s,(file,old[:90]);p.write_text(s.replace(old,new))
edit('desktop/quadro-main.cjs',"titleBarStyle:'customButtonsOnHover',trafficLightPosition:{x:14,y:16}","titleBarStyle:'hidden'")
edit('desktop/quadro-main.cjs',"{label:'Новая вкладка',accelerator:'Cmd+T'","{label:'Скриншот',accelerator:'Control+A',click:()=>send('screenshot')},{label:'Новая вкладка',accelerator:'Cmd+T'")
edit('desktop/quadro-main.cjs',"browser.contextScope=[];","browser.contextScope=[];\n require('./quadro-shell.cjs').install({win,browser,ipcMain,trusted,send});")
edit('desktop/quadro-main.cjs',"active:p.active,theme:p.theme,","active:p.active,theme:p.theme,locale:p.locale==='en'?'en':'ru',")
edit('desktop/quadro-main.cjs',"if(action==='fullscreen'){","if(action==='minimize'||action==='zoom'){void require('./quadro-lifecycle.cjs').leaveFullscreen(win).then(()=>{if(win.isDestroyed())return;if(action==='minimize')win.minimize();else if(win.isMaximized())win.unmaximize();else win.maximize()});return true}if(action==='fullscreen'){")
edit('desktop/quadro-preload.cjs',"window:action=>", "capture:(action,args)=>ipcRenderer.invoke('quadro:capture',action,args),\n favicon:id=>ipcRenderer.invoke('quadro:favicon',id),chrome:()=>ipcRenderer.invoke('quadro:chrome'),onChrome:cb=>on('quadro:chrome',cb),\n window:action=>")
(d/'quadro-icon.cjs').write_text("'use strict';\nconst fs=require('node:fs'),path=require('node:path'),{png}=require('./build-icons.cjs');\nfs.mkdirSync(path.join(__dirname,'icons'),{recursive:true});\nfs.writeFileSync(path.join(__dirname,'icons/quadro-browser.png'),png(1024));\nfs.writeFileSync(path.join(__dirname,'quadro/brand.png'),png(64));\n")
edit('desktop/quadro-build.cjs',"version:'6.0.1'","version:'6.0.2'")
edit('desktop/quadro-build.cjs',"'quadro-compact-smoke.cjs'","'quadro-compact-smoke.cjs','quadro-shell.cjs','quadro-refinements-smoke.cjs'")
p=d/'quadro/index.html';s=p.read_text()
s=s.replace('<link rel="stylesheet" href="quadro.css">','<link rel="stylesheet" href="quadro.css"><link rel="stylesheet" href="refinements.css">')
s=s.replace('<div class="traffic-space" aria-hidden="true"></div>','<div class="traffic-space" role="group" aria-label="Управление окном"><button data-window="quit" title="Закрыть браузер" aria-label="Закрыть браузер">×</button><button data-window="minimize" title="Свернуть" aria-label="Свернуть">−</button><button data-window="zoom" title="Развернуть / восстановить" aria-label="Развернуть / восстановить">+</button></div>')
start=s.index('<footer id="statusbar"');end=s.index('</footer>',start)+len('</footer>')
s=s[:start]+'''<footer id="statusbar" aria-label="Управление браузером">
 <div class="control-group"><button class="brand" data-action="settings" title="Настройки Quadro Browser"><img src="brand.png" alt=""><strong>Quadro Browser</strong></button><select id="language-select" title="Язык интерфейса" aria-label="Язык интерфейса"><option value="ru">RU</option><option value="en">EN</option></select><button data-action="theme" title="Сменить тему" aria-label="Сменить тему">◐</button><button data-action="settings" title="Настройки" aria-label="Настройки">⚙</button><button id="screenshot-button" data-action="screenshot" title="Скриншот · Control+A" aria-label="Скриншот"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h5l2-3h4l2 3h5v15H3Z"/><circle cx="12" cy="13" r="4"/></svg></button></div>
 <label class="layout-label">Окна <select id="layout-select" aria-label="Количество окон"><option>1</option><option>2</option><option>3</option><option>4</option><option>6</option><option>8</option><option>9</option><option>12</option></select></label>
 <button data-action="split-x" title="Разделить справа">◫</button><button data-action="split-y" title="Разделить снизу">⊟</button><button data-action="remove-pane" title="Убрать окно, сохранить вкладку">×</button>
 <button id="ai-toggle" data-action="ai" aria-pressed="false">ИИ</button><button data-action="wallet">Кошелёк</button><button data-action="updates" id="version-button" title="Проверить обновление">Обновление</button><button data-action="fullscreen" title="Полный экран · ⌃⌘F">⤢</button><button data-action="quit" title="Завершить браузер · ⌘Q">⏻</button>
 <span id="status" role="status">Запуск…</span>
</footer>'''+s[end:]
s=s.replace('Нажмите на нужное окно — общая адресная строка управляет выбранной страницей. Размеры окон и чата меняются перетаскиванием разделителей.','У каждого окна своя адресная строка. Размеры окон и чата меняются перетаскиванием разделителей.')
s=s.replace('Кнопки окна появляются при наведении в левый верхний угол. Красная кнопка завершает браузер, а не прячет его. Раскладка и открытые адреса сохраняются.','Три точки всегда видны слева. При наведении становятся цветными. Зелёная разворачивает окно без полноэкранной шторки macOS; полный экран доступен снизу. Красная завершает браузер с сохранением раскладки.')
s=s.replace('⌘L — адрес ·','Control+A — скриншот · ⌘A — выделить текст · ⌘L — адрес ·')
s=s.replace('<section class="pane" tabindex="-1"><div class="page-slot">','''<section class="pane" tabindex="-1"><header class="pane-head"><button data-pane-action="back" title="Назад">‹</button><button data-pane-action="forward" title="Вперёд">›</button><button data-pane-action="reload" title="Обновить страницу">↻</button><span class="pane-icon"></span><span class="pane-title"></span><form class="pane-address"><input autocomplete="off" spellcheck="false" aria-label="Адрес страницы" placeholder="Адрес или поиск"></form><button data-pane-action="split-x" title="Разделить справа">◫</button><button data-pane-action="split-y" title="Разделить снизу">⊟</button><button data-pane-action="remove" title="Убрать окно, сохранить вкладку">×</button></header><div class="page-slot">''')
s=s.replace('<script src="layout.js">','<script src="i18n.js"></script><script src="capture-core.js"></script><script src="capture.js"></script><script src="layout.js">')
p.write_text(s)
p=d/'quadro/quadro.js';s=p.read_text()
s=s.replace("active:'p1',theme:'light',","active:'p1',theme:'light',locale:'ru',")
s=s.replace('active:m.active,theme:m.theme,','active:m.active,theme:m.theme,locale:m.locale,')
pos=s.index(' function renderTabs()')
s=s[:pos]+''' const iconCache=new Map();
 function favicon(t){const im=el('img','favicon');im.alt='';im.src='globe.svg';if(!t)return im;const key=t.id+'|'+(t.favicon||t.url);if(!iconCache.has(key)){if(iconCache.size>100)iconCache.delete(iconCache.keys().next().value);iconCache.set(key,N.favicon(t.id).catch(()=>''))}iconCache.get(key).then(src=>{if(src&&im.isConnected)im.src=src});return im}
 function setLocale(value){m.locale=value==='en'?'en':'ru';$('#language-select').value=m.locale;document.documentElement.lang=m.locale;globalThis.QuadroLocale.apply(m.locale);save()}
 $('#language-select').onchange=e=>setLocale(e.target.value);
 document.querySelectorAll('[data-window]').forEach(b=>b.onclick=()=>safe(()=>N.window(b.dataset.window)));
 const chrome=state=>{document.body.style.setProperty('--chrome-inset',state.inset+'px');requestLayout()};N.onChrome(chrome);N.chrome().then(chrome).catch(()=>{});
 const capture=createQuadroCapture({N,hide:()=>N.browser('layout',{panels:[]}),restore:requestLayout,locale:()=>m.locale});
''' + s[pos:]
s=s.replace('box.append(close,select);','box.append(close,favicon(t),select);')
s=s.replace("p.setAttribute('aria-label',item?.title||'Свободное окно');","p.setAttribute('aria-label',item?.title||'Свободное окно');const input=p.querySelector('.pane-address input');if(document.activeElement!==input)input.value=item?.url||'';input.title=item?.title||'Адрес страницы';p.querySelector('.pane-title').textContent=item?.title||'';p.querySelector('.pane-title').title=item?.title||'';const slot=p.querySelector('.pane-icon');const key=item?.id+'|'+item?.favicon+'|'+item?.url;if(slot.dataset.key!==key){slot.dataset.key=key;slot.replaceChildren(favicon(item))}p.querySelector('[data-pane-action=back]').disabled=!item?.back;p.querySelector('[data-pane-action=forward]').disabled=!item?.forward;")
s=s.replace("pane.querySelector('[data-pane-action=open]').onclick=()=>safe(()=>{setActive(t.id);return showUrl('tab')});return pane",'''pane.querySelector('.pane-address').onsubmit=e=>{e.preventDefault();safe(async()=>{setActive(t.id);const value=pane.querySelector('input').value.trim();if(!value)return;const item=tab(m.slots[t.id]);if(item)await N.browser('navigate',{id:item.id,url:value});else await openPage(value,t.id);pane.querySelector('input').blur()})};pane.querySelectorAll('[data-pane-action]').forEach(b=>b.onclick=()=>safe(()=>{setActive(t.id);const a=b.dataset.paneAction;if(a==='open')return showUrl('tab');if(a==='split-x'||a==='split-y')return split(a.slice(-1));if(a==='remove')return removePane(t.id);const item=tab(m.slots[t.id]);if(item)return N.browser(a,{id:item.id})}));return pane''')
s=s.replace("async function action(name){", "async function action(name){if(name==='screenshot')return capture.open();")
s=s.replace("const input=$('#address-input');input.focus();input.select();return", "const input=document.querySelector('.pane.active .pane-address input');input?.focus();input?.select();return")
s=s.replace("setTheme(m.theme);$('#version-button')", "setLocale(p.locale);setTheme(m.theme);$('#version-button')")
s=s.replace('model:m,changeLayout','model:m,capture,setLocale,changeLayout')
p.write_text(s)
for file in ['desktop/quadro-smoke.cjs','tools/quadro-verify.py','desktop/quadro.test.cjs','.github/workflows/quadro-macos.yml']:
 p=root/file;p.write_text(p.read_text().replace('6.0.1','6.0.2'))
edit('.github/workflows/quadro-macos.yml',"'codex/quadro-compact-20261113']","'codex/quadro-compact-20261113','codex/quadro-602-controls-capture']")
edit('.github/workflows/quadro-macos.yml','node --test quadro.test.cjs quadro-lifecycle.test.cjs','node --test quadro.test.cjs quadro-lifecycle.test.cjs quadro-capture.test.cjs')
edit('desktop/quadro-smoke.cjs',"await require('./quadro-compact-smoke.cjs')({win,browser});","await require('./quadro-compact-smoke.cjs')({win,browser});\n   await require('./quadro-refinements-smoke.cjs')({win,browser,store});")
edit('desktop/quadro-smoke.cjs',"server=http.createServer((req,res)=>{res.setHeader", "server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.setHeader('Content-Type','image/png');require('node:fs').createReadStream(require('node:path').join(__dirname,'quadro/brand.png')).pipe(res);return}res.setHeader")
(root/'.github/workflows/quadro-source-snapshot.yml').unlink()
journal='docs/desktop/2026-11-14-quadro-controls-capture.md'
(root/journal).write_text('''# Quadro 6.0.2 — интерфейс и локальные скриншоты

Прямое поручение владельца: вернуть прежнюю зелёно-розовую иконку, не менять бренд самовольно; постоянно видимые стеклянные точки управления, цветные при наведении; устранить перекрытие системной шторкой; убрать синюю рамку активной плитки; вернуть компактную адресную строку в каждую плитку, favicon; объединить название/язык/тему/настройки; добавить локальный скриншот Control+A с выделением, стрелкой, текстом, кругом, прямоугольником, линией, карандашом, маркером, выбором цвета и толщины.

Реализация Mac-only: старый генератор build-icons.cjs без изменения геометрии/цветов; собственные доступные кнопки окна в оболочке, native traffic lights скрыты. Зелёная кнопка максимизирует в обычном рабочем пространстве; отдельный native fullscreen сохраняется, для системного меню сверху зарезервирован безопасный отступ. Закрытие сохраняет проверенный lifecycle 6.0.1. Верхняя строка только вкладок; адреса/навигация/названия в панелях 28px. Общие настройки собраны рядом снизу, RU/EN, умеренный glass; синяя рамка снята. Favicon получает host из текущего browser session, ограничивает размер/время и передаёт shell как PNG data URI.

Control+A работает при фокусе браузера и его страниц, не глобально вне приложения; Cmd+A не меняется. Скрин браузера собирает реальные пиксели native webviews и оболочки. Выделение и разметка на локальном canvas; undo/redo, PNG/clipboard. Отдельный «Экран Mac» снимает дисплей текущего окна только по явной команде и требует системного разрешения macOS. Никаких фоновых захватов или загрузок в ИИ/облако. Экранные разрешения не обходятся. Картинки в памяти очищаются при закрытии редактора; файл создаётся только после Save Dialog.

Новый канал/профиль не создаётся. Старые cookies, ссылки, раскладки, адреса кошелька сохраняются; кошелёк watch-only не выдаётся за MetaMask. Windows, Chrome, Android, АвтоЦена не изменяются. Версия 6.0.2, ad-hoc без Developer ID/notarization; обновление скачивает DMG, замена приложения остаётся ручной.

Подготовлены unit/native gates: перетаскивание плиток/ИИ; строки28px; постоянные кнопки и fullscreen inset; RU/EN; favicon с локального сервера; реальный Control+A и отдельный Cmd+A; выделение и все инструменты, undo/redo, пиксели буфера/PNG, повторный запуск и fullscreen close. Системный захват рабочего стола с личным TCC-разрешением и устройство владельца не считаются проверенными синтетическим CI. На этом этапе публикация не подтверждена; результаты записать после завершения.
''')
with (root/'OSMINOG_BROWSER_ROADMAP.md').open('a') as f:f.write('\n\n## 2026-11-14 — Quadro: управление, favicon и скриншоты\n\nНовое поручение владельца и границы реализации: [дополнение](docs/desktop/2026-11-14-quadro-controls-capture.md). Прежняя иконка обязательна; Mac-only, сохранение профиля, локальный захват по Control+A. Результаты CI/публикации записываются после фактической проверки.\n')
