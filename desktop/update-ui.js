'use strict';
(()=>{
 const native=globalThis.OSMINOGNative;if(!native)return;
 const labels={idle:'Проверить обновления',checking:'Проверяю…',available:'Скачать обновление',current:'Проверить снова',downloading:'Скачиваю…',ready:'Установить и перезапустить',installing:'Перезапускаю…',error:'Повторить проверку'};
 const titles={idle:'Обновления браузера',checking:'Проверяю канал Windows…',available:'Доступна новая версия',current:'Установлена актуальная версия',downloading:'Скачиваю и проверяю установщик',ready:'Обновление готово к установке',installing:'Проект сохранён. Устанавливаю обновление…',error:'Обновление не выполнено'};
 let current={phase:'idle',currentVersion:native.version},busy=false;
 function render(value){current=value;const button=document.querySelector('#oneClickUpdate'),title=document.querySelector('#updateStatusText'),sub=document.querySelector('#updateStatusSub');if(button){button.disabled=busy||['checking','downloading','installing'].includes(value.phase);button.textContent=labels[value.phase]||labels.idle}if(title)title.textContent=titles[value.phase]||titles.idle;if(sub)sub.textContent=value.error||(`Установлена ${value.currentVersion}`+(value.available?` → ${value.latestVersion}`:'')+(value.phase==='downloading'?` · ${Math.round(value.percent)}%`:'')+' · Доски и входы в сайты остаются на устройстве.');document.querySelector('#versionButton')?.classList.toggle('update-available',!!value.available);const note=document.querySelector('#updatePopover .update-note');if(note)note.textContent='Пакет проверяется перед установкой. Перед перезапуском проект сохраняется ещё раз. Папку расширения выбирать не нужно.'}
 async function update(){if(busy)return;busy=true;render(current);try{
  let next=await native.updateState();
  if(next.phase==='ready'){render(await native.installUpdate());return}
  if(next.phase==='available'){await globalThis.persist?.();render(await native.downloadUpdate());return}
  render(await native.checkUpdate());
 }catch(e){render({...current,phase:'error',error:e.message})}finally{busy=false;render(current)}}
 document.addEventListener('click',e=>{if(!e.target.closest('#oneClickUpdate'))return;e.preventDefault();e.stopImmediatePropagation();update()},true);
 native.onUpdate(render);
 globalThis.OSMINOGDesktopUpdates={open:()=>{document.querySelector('#versionButton')?.click();native.updateState().then(render)},update};
 native.updateState().then(render).catch(e=>render({...current,phase:'error',error:e.message}));
})();

