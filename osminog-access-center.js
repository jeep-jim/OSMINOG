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
  function open(){globalThis.toggleCollabPopover?.(true);syncPresence();return $("#collabPopover")}
  function refresh(){globalThis.renderCollab?.();syncPresence()}
  function route(){
    const old=$("#collabShare");if(!old||old.dataset.presence3203)return;
    const button=old.cloneNode(true);button.dataset.presence3203="1";old.replaceWith(button);
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();globalThis.toggleCollabPopover?.();syncPresence()});
  }
  globalThis.OSMINOGAccessCenter={version:"3.20.3",open,refresh,shareLink:()=>globalThis.collabDescriptor?.()||""};
  document.addEventListener("osminog:external-presence",e=>syncPresence(e.detail));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")globalThis.toggleCollabPopover?.(false)});
  document.addEventListener("osminog:desktop-v3-ready",route);
  presenceControls();route();if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",route,{once:true});
})();
