'use strict';
globalThis.createQuadroGlobalCaptureSettings=({N,status})=>{
 const box=document.createElement('section');box.className='global-capture-settings';box.innerHTML='<h3>Скриншот из любого приложения · ⌃A</h3><label class="global-capture-enable"><input type="checkbox" id="global-capture-enabled"> Включить Control+A для всего Mac</label><p id="global-capture-state" role="status"></p><div class="dialog-actions"><button type="button" id="global-capture-now">Снять экран сейчас</button><button type="button" id="global-capture-choose">Выбрать экран через macOS</button><button type="button" id="global-capture-refresh">Проверить разрешение</button><button type="button" id="global-capture-permission">Разрешение macOS…</button></div><p class="hint">Работает, пока Mouse Browser запущен, даже если он свёрнут. ⌘Q завершает и браузер, и сочетание. Снимки остаются локально; перед копированием или сохранением можно выделить область и добавить разметку. ⌘A не меняется. Control+A в других программах будет занят скриншотом.</p>';
 document.querySelector('#settings-dialog .dialog-content').append(box);
 const draw=s=>{box.querySelector('#global-capture-choose').hidden=!s.pickerAvailable;if(s.error)status(s.error);box.querySelector('#global-capture-enabled').checked=s.enabled;box.querySelector('#global-capture-state').textContent=s.error||(s.registered?'Control+A включено. ':'Глобальное сочетание выключено. ')+(s.permission==='granted'?'Запись экрана разрешена.':(s.pickerAvailable?'macOS предложит выбрать экран для одного снимка.':'Нужно разрешение «Запись экрана» для установленного приложения.'));};
 const run=fn=>Promise.resolve().then(fn).catch(e=>status(e.message));
 box.querySelector('#global-capture-enabled').onchange=e=>run(async()=>draw(await N.globalCapture('enable',{enabled:e.target.checked})));
 box.querySelector('#global-capture-now').onclick=()=>run(()=>N.globalCapture('request'));
 box.querySelector('#global-capture-permission').onclick=()=>run(()=>N.globalCapture('permission'));
 box.querySelector('#global-capture-choose').onclick=()=>run(()=>N.globalCapture('choose'));
 box.querySelector('#global-capture-refresh').onclick=()=>run(async()=>draw(await N.globalCapture('refresh')));
 N.onGlobalCapture(draw);void run(async()=>draw(await N.globalCapture('state')));
 return{refresh:()=>run(async()=>draw(await N.globalCapture('state')))};
};
