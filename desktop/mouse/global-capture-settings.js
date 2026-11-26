'use strict';
globalThis.createMouseGlobalCaptureSettings=({N,status})=>{
 const box=document.createElement('section');box.className='global-capture-settings settings-subsection';box.innerHTML='<h3>Скриншот из любого приложения · ⌃A</h3><label class="global-capture-enable settings-switch"><span class="settings-control-copy"><strong id="global-capture-label">Включить Control+A для всего Mac</strong><small>Control+A займёт это сочетание в других приложениях. ⌘A не изменится.</small></span><input type="checkbox" role="switch" id="global-capture-enabled" aria-describedby="global-capture-state"></label><p id="global-capture-state" role="status"></p><div class="dialog-actions"><button type="button" id="global-capture-now">Снять экран сейчас</button><button type="button" id="global-capture-choose">Выбрать экран через macOS</button><button type="button" id="global-capture-refresh">Проверить разрешение</button><button type="button" id="global-capture-permission">Разрешение macOS…</button></div><details class="settings-details"><summary>Как работает сочетание</summary><p class="hint">Работает, пока Mouse Browser запущен, даже если он свёрнут. ⌘Q завершает и браузер, и сочетание. Снимки остаются локально; перед копированием или сохранением можно выделить область и добавить разметку. ⌘A не меняется. Control+A в других программах будет занят скриншотом.</p></details>';
 document.querySelector('#settings-dialog [data-settings-section=capture]').append(box);
 const windows=N.platform!=='darwin';
 if(windows){
  box.querySelector('h3').textContent='Скриншот из любого приложения · Ctrl+Alt+S';
  box.querySelector('#global-capture-label').textContent=' Включить Ctrl+Alt+S для '+(N.platform==='linux'?'Linux':'Windows');
  box.querySelector('.settings-control-copy small').textContent='Снимок по сочетанию клавиш, даже когда Mouse свёрнут.';
  box.querySelector('#global-capture-permission').hidden=true;box.querySelector('#global-capture-refresh').textContent='Проверить сочетание';
  box.querySelector('.hint').textContent='Работает, пока Mouse Browser запущен, даже если он свёрнут. Ctrl+Q завершает браузер и освобождает сочетание. Снимается экран под указателем мыши. Перед копированием или сохранением можно выделить область и добавить разметку. Снимки остаются локально. Ctrl+A сохраняет обычное выделение текста.';
 }
 const draw=s=>{box.querySelector('#global-capture-choose').hidden=!s.pickerAvailable;if(s.error)status(s.error);box.querySelector('#global-capture-enabled').checked=s.enabled;box.querySelector('#global-capture-state').textContent=s.error||(s.registered?(windows?'Ctrl+Alt+S включено. ':'Control+A включено. '):'Глобальное сочетание выключено. ')+(windows?'Снимок создаётся только по вашей команде.':s.permission==='granted'?'Запись экрана разрешена.':(s.pickerAvailable?'macOS предложит выбрать экран для одного снимка.':'Нужно разрешение «Запись экрана» для установленного приложения.'));};
 const run=fn=>Promise.resolve().then(fn).catch(e=>status(e.message));
 box.querySelector('#global-capture-enabled').onchange=e=>run(async()=>draw(await N.globalCapture('enable',{enabled:e.target.checked})));
 box.querySelector('#global-capture-now').onclick=()=>run(()=>N.globalCapture('request'));
 box.querySelector('#global-capture-permission').onclick=()=>run(()=>N.globalCapture('permission'));
 box.querySelector('#global-capture-choose').onclick=()=>run(()=>N.globalCapture('choose'));
 box.querySelector('#global-capture-refresh').onclick=()=>run(async()=>draw(await N.globalCapture('refresh')));
 N.onGlobalCapture(draw);void run(async()=>draw(await N.globalCapture('state')));
 return{refresh:()=>run(async()=>draw(await N.globalCapture('state')))};
};
