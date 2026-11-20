'use strict';
// Platform-specific presentation; the same browser, desks and document runtime
// is used on all desktop operating systems.
(()=>{
 const N=globalThis.MouseNative;if(!['win32','linux'].includes(N?.platform))return;
 document.documentElement.dataset.platform=N.platform;
 const controls=document.querySelector('.traffic-space'),toolbar=document.querySelector('.toolbar');
 for(const action of ['minimize','zoom','quit'])controls.append(controls.querySelector(`[data-window="${action}"]`));
 toolbar.append(controls);
 const zoom=controls.querySelector('[data-window="zoom"]');
 const update=state=>{zoom.textContent=state.maximized?'❐':'□';zoom.title=state.maximized?'Восстановить окно':'Развернуть окно';zoom.setAttribute('aria-label',zoom.title);zoom.setAttribute('aria-pressed',String(!!state.maximized));};
 update({maximized:false});N.onChrome(update);void N.chrome().then(update).catch(()=>{});
 const settings=document.querySelectorAll('#settings-dialog .dialog-content>.hint');
 settings[0].textContent='Ctrl+Alt+S — скриншот экрана · Ctrl+A — выделить всё · Ctrl+L — адрес · Ctrl+T — новая вкладка · Ctrl+W — закрыть вкладку · F11 — полный экран · Esc — выйти из полного экрана · Ctrl+Q — завершить браузер.';
 settings[1].textContent='Кнопки справа сворачивают, разворачивают и закрывают окно. Закрытие сохраняет вкладки и раскладку. Полный экран включается клавишей F11 или кнопкой в настройках.';
 const hints=document.querySelectorAll('#update-dialog .dialog-content>.hint');
 hints[0].textContent=N.platform==='linux'?'Обновление AppImage: скачайте пакет и нажмите «Установить и перезапустить». Браузер проверит SHA-256, сохранит профиль и заменит AppImage в вашей личной папке. Для установки .deb откройте скачанный пакет в системном менеджере пакетов.':'Скачайте обновление и нажмите «Установить и перезапустить». Браузер проверит SHA-256 и сохранит данные. Установщик обновит Mouse Browser в прежней папке и запустит его снова. Профиль и вкладки сохраняются.';
 hints[1].textContent=N.platform==='linux'?'Предварительная версия Linux x64. Пакеты AppImage и .deb.':'Предварительная версия Windows x64 без цифровой подписи издателя.';
 document.querySelector('#screenshot-button').title='Скриншот окон браузера';
})();
