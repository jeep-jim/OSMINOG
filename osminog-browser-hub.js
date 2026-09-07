"use strict";
(()=>{
  const $=(s,r=document)=>r.querySelector(s),panel=$("#browserHub"),quick=$("#browserHubQuick"),connected=$("#browserHubConnected"),current=$("#browserHubCurrent"),status=$("#browserHubStatus"),count=$("#browserHubConnectedCount");
  if(!panel)return;
  const CORE=["gpt","deepseek","claude","gemini","googleai"];
  const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const normalize=id=>{id=String(id||"").toLowerCase();return id==="chatgpt"?"gpt":id==="google-ai"?"googleai":id};
  const registryId=id=>normalize(id)==="gpt"?"chatgpt":normalize(id);
  const manager=()=>globalThis.OSMINOGSessionManager;
  const registry=()=>globalThis.OSMINOGProviderRegistry;
  const call=(type,extra={})=>chrome.runtime.sendMessage({type,...extra});
  let preferred="",busyProvider="";

  function providerMeta(id){
    id=normalize(id);
    if(id==="custom")return{id:"custom",brainId:"custom",name:"Custom AI",icon:"AI",iconSrc:"icons/providers/custom.svg",tone:"#8b5cf6",access:"OpenAI-compatible"};
    const p=registry()?.get?.(registryId(id))||manager()?.meta?.(id);
    return p?{...p,brainId:id}:{id,brainId:id,name:id==="gpt"?"ChatGPT":id,icon:"AI",tone:"#64748b",access:"Web"}
  }
  function icon(p){return p?.iconSrc?`<img src="${esc(p.iconSrc)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"><b hidden>${esc(p.icon||"AI")}</b>`:`<b>${esc(p?.icon||"AI")}</b>`}
  function bindFallbacks(root){root?.querySelectorAll?.("img").forEach(img=>img.addEventListener("error",()=>{img.hidden=true;if(img.nextElementSibling)img.nextElementSibling.hidden=false},{once:true}))}
  function quickIds(sessionIds=[]){
    const ids=[...CORE];
    for(const item of registry()?.selected?.()||[])ids.push(normalize(item.id));
    for(const item of registry()?.desktopShortcuts?.()||[])ids.push(normalize(item.id));
    for(const id of sessionIds)ids.push(normalize(id));
    if(preferred)ids.unshift(normalize(preferred));
    return [...new Set(ids.filter(Boolean))]
  }
  function card(id,state={}){
    const p=providerMeta(id),isOn=!!state.connected,isLinked=!isOn&&!!(state.linked||state.tabId),isFound=!!state.found||isLinked,isBusy=busyProvider===normalize(id),action=isOn?"Показать":"Подключить";
    return `<article class="browser-hub-provider-card ${isOn?"connected":isLinked?"not-ready":""} ${preferred===normalize(id)?"current":""}" data-provider-card="${esc(normalize(id))}" style="--provider-tone:${esc(p.tone||"#64748b")}"><span class="browser-hub-provider-icon">${icon(p)}</span><div class="browser-hub-provider-copy"><strong>${esc(p.name)}</strong><small>${isOn?"Подключено и проверено":isLinked?esc(state.error||"Вкладка открыта, но чат не готов"):isFound?"Вкладка найдена":esc(p.access||"Готов к подключению")}</small></div><span class="browser-hub-provider-state">${isOn?"On":isLinked?"Не готов":isFound?"Найден":"Off"}</span><button type="button" data-provider-action="${esc(normalize(id))}" ${isBusy?"disabled":""}>${isBusy?"Подождите…":action}</button></article>`
  }
  async function statesFor(ids,sessions={}){
    const entries=await Promise.all(ids.map(async id=>{
      if(sessions[id]||sessions[registryId(id)]){const session=sessions[id]||sessions[registryId(id)];return[id,{...session,connected:!!session.connected,ready:!!session.ready,linked:true,found:{tabId:session.tabId,title:session.title||id}}]}
      const st=await manager()?.status?.(id).catch(()=>null);return[id,st||{connected:false}]
    }));
    return Object.fromEntries(entries)
  }
  async function refresh(){
    if(status)status.textContent="Проверяю подключения…";
    const result=await manager()?.list?.().catch(()=>null)||await call("OSMINOG_SESSION_LIST").catch(e=>({ok:false,error:e?.message||String(e),sessions:{}}));
    const sessions=result?.sessions||{},sessionIds=Object.keys(sessions).map(normalize),ids=quickIds(sessionIds),states=await statesFor(ids,sessions),onIds=ids.filter(id=>states[id]?.connected);
    if(count)count.textContent=String(onIds.length);
    connected.innerHTML=onIds.length?onIds.map(id=>card(id,states[id])).join(""):'<div class="browser-hub-empty"><strong>Пока ничего не подключено</strong><small>Выберите сервис ниже — OSMINOG сначала найдёт уже открытую вкладку.</small></div>';
    quick.innerHTML=ids.filter(id=>!states[id]?.connected).map(id=>card(id,states[id])).join("")||'<div class="browser-hub-empty"><strong>Все сервисы уже подключены</strong></div>';
    if(current){const p=preferred&&providerMeta(preferred),st=preferred&&states[normalize(preferred)];current.hidden=!p;current.innerHTML=p?`<span>${icon(p)}</span><div><small>ТЕКУЩИЙ ЧАТ</small><strong>${esc(p.name)}</strong><p>${st?.connected?"Подключение активно. Можно продолжать работу в чате.":st?.found?"Авторизованная вкладка найдена. OSMINOG подключит одну внутреннюю сессию.":"OSMINOG проверит вход и подключит одну внутреннюю сессию."}</p></div><button type="button" data-provider-action="${esc(normalize(preferred))}">${st?.connected?"Показать":"Подключить"}</button>`:""}
    bindFallbacks(panel);bindActions(panel);
    if(status)status.textContent=result?.ok===false?(result.error||"Не удалось получить список"):`${onIds.length} подключено · ${ids.length} в быстром доступе`;
  }
  function bindActions(root){root.querySelectorAll("[data-provider-action]").forEach(button=>{if(button.dataset.bound)return;button.dataset.bound="1";button.addEventListener("click",()=>act(button.dataset.providerAction,button))})}
  async function act(id,button){
    id=normalize(id);if(!id||busyProvider)return;busyProvider=id;button.disabled=true;
    const p=providerMeta(id);if(status)status.textContent=`${p.name}: проверяю открытую вкладку…`;
    try{
      const st=await manager()?.status?.(id).catch(()=>null);
      if(st?.connected){await manager()?.focus?.(id,{external:false});return}
      if(id==="custom"){close();globalThis.OSMINOGSetAgentSettingsOpen?.(true);return}
      const r=await manager()?.connect?.(id);if(r?.ok){document.dispatchEvent(new CustomEvent("osminog:session-changed",{detail:{provider:id,connected:true}}));return}
      const opened=await manager()?.authorize?.(id);if(!opened?.ok)throw new Error(r?.error||opened?.error||"Не удалось подключить сервис");if(status)status.textContent=`${p.name}: выполните вход в уже открытую сессию, затем нажмите «Подключить».`;
    }catch(error){if(status)status.textContent=error?.message||String(error)}finally{busyProvider="";button.disabled=false;setTimeout(refresh,180)}
  }
  async function open(options={}){
    preferred=normalize(typeof options==="string"?options:options.provider||preferred||"");
    panel.hidden=false;panel.dataset.preferredProvider=preferred;
    const r=panel.getBoundingClientRect();if(r.width<680&&innerWidth>740)panel.style.width=`${Math.min(900,innerWidth-32)}px`;
    await refresh();
  }
  function close(){panel.hidden=true}
  $("#browserHubButton")?.addEventListener("click",()=>open());
  $("#browserHubClose")?.addEventListener("click",close);
  $("#browserHubRefresh")?.addEventListener("click",refresh);
  $("#browserHubOpenCatalog")?.addEventListener("click",()=>{close();registry()?.open?.()});
  $("#browserHubForm")?.addEventListener("submit",async event=>{event.preventDefault();const input=$("#browserHubUrl"),url=input?.value?.trim();if(!url)return;const r=await call("OSMINOG_BROWSER_HUB_OPEN",{url,active:true,reuse:true,allowCreate:true}).catch(e=>({ok:false,error:e?.message||String(e)}));if(status)status.textContent=r?.ok?"Адрес открыт в видимой вкладке":(r?.error||"Не удалось открыть адрес");if(r?.ok)input.value=""});
  chrome.runtime.onMessage.addListener(message=>{if(message?.type==="BC_PROVIDER_TAB_AVAILABLE"||message?.type==="OSMINOG_SESSION_DISCONNECTED")setTimeout(refresh,120)});
  document.addEventListener("osminog:provider-registry-changed",refresh);
  document.addEventListener("osminog:session-changed",refresh);
  globalThis.OSMINOGBrowserHubAPI={open,close,refresh,list:()=>call("OSMINOG_SESSION_LIST"),openUrl:(url,provider="")=>call("OSMINOG_BROWSER_HUB_OPEN",{url,provider,active:true,reuse:true,allowCreate:true})};
  globalThis.OSMINOGOpenConnections=open;
})();
