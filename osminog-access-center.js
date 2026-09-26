"use strict";
(()=>{
  if(globalThis.OSMINOGAccessCenter?.version==="3.20.3")return;
  const $=s=>document.querySelector(s);
  // Reuse the original sharing/Presence controls and their existing handlers.
  // Human sharing and external AI roles remain separate from Owner Unlock.
  function syncPresence(detail){
    const status=detail||globalThis.BriefCraftBridge?.externalPresenceStatus?.();
    if(!status)return;
    const button=$("#connectExternalChatGpt"),label=$("#externalChatGptState"),role=$("#externalChatGptRole");
    if(button?.disabled)return;
    if(status.connected){
      if(role&&["view","comment","edit"].includes(status.role))role.value=status.role;
      if(label)label.textContent=`${status.title||status.provider||"Чат ИИ"} · ${{view:"Просмотр",comment:"Комментарии",edit:"Редактирование"}[status.role]||status.role}`;
    }else if(label)label.textContent=status.error||"Не подключён";
    if(button)button.textContent=status.connected?"Переподключить":"Подключить";
    $("#collabShare")?.classList.toggle("external-live",!!status.connected);
  }
  function presenceControls(){const row=$(".collab-ai-row");if(!row||$("#disconnectExternalPresence"))return;const b=document.createElement("button");b.id="disconnectExternalPresence";b.textContent="Отключить";b.type="button";b.onclick=()=>globalThis.BriefCraftBridge?.disconnectExternalPresence?.();row.parentElement.append(b);$("#externalChatGptRole")?.addEventListener("change",()=>{if(globalThis.BriefCraftBridge?.externalPresenceStatus?.().connected)$("#connectExternalChatGpt")?.click()})}
  function contextText(){
    const p=globalThis.project?.();if(!p)return 'Откройте доску.';
    const lines=['# Доска: '+p.name,'Снимок контекста: '+new Date().toISOString(),'Это экспорт текущей доски. Он не предоставляет прямой доступ или право изменять файлы. Изображения и бинарные файлы нужно прикрепить отдельно.',''];
    for(const o of globalThis.objects?.()||[]){lines.push('## '+(o.name||o.type),'ID: '+o.id+'; тип: '+o.type,JSON.stringify({x:o.x,y:o.y,w:o.w,h:o.h,visible:o.visible!==false}),String(o.text||o.code||o.title||''));if(/^https?:\/\//.test(o.url||''))lines.push(o.url);for(const c of o.comments||[])lines.push('Комментарий: '+c.text);lines.push('')}
    for(const d of p.browserDocuments||[])lines.push('## Макет: '+d.title,d.snapshot||'');
    lines.push('## Связи');for(const c of p.connections||[])lines.push(c.from+' → '+c.to+(c.label?' — '+c.label:''));return lines.join('\n');
  }
  function exportContext(){
    let dialog=$('#osminogContextExport');if(dialog)dialog.remove();dialog=document.createElement('dialog');dialog.id='osminogContextExport';dialog.className='workdeskConfirm';dialog.style.width='min(700px,90vw)';dialog.style.maxWidth='700px';dialog.innerHTML='<h2>Контекст для внешнего ChatGPT</h2><p>Скопируйте текст в нужный диалог или прикрепите скачанный файл. Это снимок текущей доски, не постоянное подключение. Картинки прикрепляются отдельно.</p><textarea aria-label="Контекст доски" style="width:100%;height:260px;box-sizing:border-box"></textarea><div><button data-copy>Копировать</button><button data-download>Скачать .md</button><button data-close>Закрыть</button></div><p role="status"></p>';dialog.querySelector('textarea').value=contextText();document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(dialog.querySelector('textarea').value);dialog.querySelector('[role=status]').textContent='Скопировано. Вставьте в сообщение ChatGPT.'}catch{dialog.querySelector('textarea').select();dialog.querySelector('[role=status]').textContent='Нажмите Ctrl+C для копирования.'}};dialog.querySelector('[data-download]').onclick=()=>{const url=URL.createObjectURL(new Blob([dialog.querySelector('textarea').value],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='osminog-context.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)};dialog.showModal();
  }
  function open(){globalThis.toggleCollabPopover?.(true);syncPresence();return $("#collabPopover")}
  function refresh(){globalThis.renderCollab?.();syncPresence()}
  function route(){
    const old=$("#collabShare");if(!old||old.dataset.presence3203)return;
    const button=old.cloneNode(true);button.dataset.presence3203="1";old.replaceWith(button);
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();globalThis.toggleCollabPopover?.();syncPresence()});
  }
  globalThis.OSMINOGAccessCenter={version:"3.20.3",open,refresh,exportContext,contextText,shareLink:()=>globalThis.collabDescriptor?.()||""};
  document.addEventListener("osminog:external-presence",e=>syncPresence(e.detail));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")globalThis.toggleCollabPopover?.(false)});
  document.addEventListener("osminog:desktop-v3-ready",route);
  presenceControls();const section=$(".collab-ai-section");if(section){const b=document.createElement("button");b.type="button";b.textContent="Скопировать / скачать контекст для ChatGPT";b.onclick=exportContext;section.append(b)}route();if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",route,{once:true});
})();
