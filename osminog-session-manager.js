"use strict";
(()=>{
  if(globalThis.OSMINOGSessionManager)return;
  const $=(s,r=document)=>r.querySelector(s);
  const normalize=id=>{id=String(id||"").toLowerCase();return id==="chatgpt"?"gpt":id==="google-ai"?"googleai":id};
  const registryId=id=>normalize(id)==="gpt"?"chatgpt":normalize(id);
  const custom={id:"custom",name:"Custom AI",category:"chat",icon:"AI",iconSrc:"icons/providers/custom.svg",tone:"#8b5cf6",access:"OpenAI-compatible",caps:["локально","API","код"]};
  const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function providers(){return globalThis.OSMINOGProviderRegistry?.list?.()||[]}
  function brainProviders(){const list=providers().map(p=>({...p,brainId:p.id==="chatgpt"?"gpt":p.id}));return [...list,custom].filter((p,i,a)=>a.findIndex(x=>(x.brainId||x.id)===(p.brainId||p.id))===i)}
  function brainIds(){return brainProviders().map(p=>p.brainId||p.id)}
  function meta(id){id=normalize(id);if(id==="custom")return custom;return providers().find(p=>p.id===registryId(id)||p.id===id||normalize(p.bridge||p.id)===id)||null}
  function label(id){return meta(id)?.name||(normalize(id)==="gpt"?"ChatGPT":String(id||"AI"))}
  async function call(type,extra={}){return chrome.runtime.sendMessage({type,...extra})}
  async function list(){return call("OSMINOG_SESSION_LIST").catch(e=>({ok:false,error:e?.message||String(e),tabs:[],sessions:{}}))}
  function emit(id,detail={}){document.dispatchEvent(new CustomEvent("osminog:session-changed",{detail:{provider:normalize(id),...detail}}))}
  async function ensurePermission(id){
    id=normalize(id);if(id==="gpt"||id==="custom")return true;const p=meta(id);if(!p?.url)return true;
    try{const origin=`${new URL(p.url).origin}/*`,extra=id==="googleai"?["https://google.com/*"]:id==="deepseek"?["https://www.deepseek.com/*"]:[],origins=[origin,...extra];if(await chrome.permissions.contains({origins}))return true;return await chrome.permissions.request({origins})}catch{return false}
  }

  async function getOrCreate(id,opts={}){
    id=normalize(id);const p=meta(id),provider=id==="gpt"?"gpt":(p?.id||id),url=opts.url||p?.url||"";
    const r=await call("OSMINOG_SESSION_GET_OR_CREATE",{provider,url,active:!!opts.active,reuse:opts.reuse!==false,allowCreate:opts.allowCreate!==false});
    if(r?.ok)emit(id,{session:r});
    return r
  }
  async function connect(id){
    id=normalize(id);
    if(id==="gpt"){const direct=globalThis.OSMINOGConnectDirectChatGPT;if(typeof direct!=="function")return{ok:false,error:"ChatGPT panel not ready"};const r=await direct();if(r?.ok!==false)emit(id,{connected:true,mode:"direct-session"});return r||{ok:true,provider:id,mode:"direct-session"}}
    if(id==="custom")return{ok:true,provider:id,mode:"custom"};
    if(!await ensurePermission(id))return{ok:false,provider:id,error:`Нужно разрешить доступ к ${label(id)}`};
    const created=await getOrCreate(id,{active:false,reuse:true,allowCreate:true});
    if(!created?.ok)return created;
    const r=id==="googleai"?await call("BC_GOOGLE_AI_SERVICE_CONNECT"):await call("OSMINOG_SESSION_CONNECT",{provider:id,tabId:created.tabId});
    if(r?.ok){emit(id,{connected:true,session:r});await refreshCenter(id)}
    return r
  }
  async function authorize(id){
    id=normalize(id);
    if(id==="gpt")return connect(id);
    if(id==="custom")return{ok:true,provider:id,mode:"custom"};
    if(!await ensurePermission(id))return{ok:false,provider:id,error:`Нужно разрешить доступ к ${label(id)}`};
    const st=await status(id);
    if(st?.tabId){await call("OSMINOG_BROWSER_HUB_FOCUS_TAB",{tabId:st.tabId}).catch(()=>null);return{ok:true,provider:id,tabId:st.tabId,mode:"managed-authorization"}}
    const r=await getOrCreate(id,{active:true,reuse:true,allowCreate:true});
    if(r?.ok)emit(id,{authorization:true,session:r});return r
  }
  async function status(id){
    id=normalize(id);
    if(id==="gpt")return{ok:true,provider:id,connected:!!globalThis.OSMINOGDirectChatGPTStatus?.(),found:true,mode:"direct-session"};
    if(id==="custom"){const r=await call("BC_PROVIDER_CUSTOM_GET").catch(()=>null);return{ok:true,provider:id,connected:!!(r?.config?.baseUrl&&r?.config?.model),mode:"custom",config:r?.config||{}}}
    if(id==="googleai"){const service=await call("BC_GOOGLE_AI_SERVICE_STATUS").catch(()=>null);if(service?.tabId)return{ok:true,provider:id,connected:!!service.connected,ready:!!service.ready,mode:"service",tabId:service.tabId,title:service.title,error:service.error||"",linked:service}}
    const linked=await call("BC_PROVIDER_DISCOVER",{provider:id}).catch(()=>null);
    if(linked?.connected)return{ok:true,provider:id,connected:true,ready:true,mode:linked.linked?.directWeb?"direct-web-session":"attached-tab",tabId:linked.linked?.tabId,title:linked.linked?.title,probe:linked.linked?.probe||null};
    const hub=await list(),rid=registryId(id),session=hub?.sessions?.[rid]||hub?.sessions?.[id];
    return{ok:true,provider:id,connected:false,ready:false,linked:linked?.linked||session||null,found:linked?.found||null,error:linked?.error||session?.error||"",mode:session?"managed-service":linked?.linked?"linked-not-ready":linked?.found?"open-tab":"none",tabId:session?.tabId||linked?.linked?.tabId||linked?.found?.tabId||null,title:session?.title||linked?.linked?.title||linked?.found?.title||meta(id)?.name||id}
  }
  async function focus(id){const st=await status(id);if(st?.tabId)return call("OSMINOG_BROWSER_HUB_FOCUS_TAB",{tabId:st.tabId});return authorize(id)}

  function icon(p){return p?.iconSrc?`<img src="${esc(p.iconSrc)}" alt="${esc(p.name||"AI")}" referrerpolicy="no-referrer"><b hidden>${esc(p?.icon||"AI")}</b>`:`<b>${esc(p?.icon||"AI")}</b>`}
  function activeProvider(){return normalize($("#gptAgentProvider")?.value||"gpt")}
  async function openSettings(id=""){return globalThis.OSMINOGBrowserHubAPI?.open?.({provider:normalize(id)})}
  function showReconnect(id,reason="closed"){
    id=normalize(id);const previous=$("#osminogSessionReconnectToast");if(previous?.dataset.provider===id)return;previous?.remove();
    const p=meta(id)||{name:label(id),icon:"AI"},toast=document.createElement("aside");toast.id="osminogSessionReconnectToast";toast.className="osminog-session-reconnect";toast.dataset.provider=id;toast.setAttribute("role","alert");toast.innerHTML=`<span class="osminog-session-reconnect-icon">${icon(p)}</span><div><strong>${esc(label(id))} отключён</strong><small>${reason==="navigated"?"Вкладка ушла с сайта сервиса.":"Связанная вкладка закрыта."}</small></div><button type="button" data-session-reconnect>Подключить ${esc(label(id))}</button><button type="button" data-session-dismiss aria-label="Закрыть">×</button>`;
    document.body.append(toast);
    toast.querySelector("[data-session-dismiss]")?.addEventListener("click",()=>toast.remove());
    toast.querySelector("[data-session-reconnect]")?.addEventListener("click",async e=>{e.currentTarget.disabled=true;const r=await connect(id).catch(error=>({ok:false,error:error?.message||String(error)}));if(r?.ok)toast.remove();else{e.currentTarget.disabled=false;await openSettings(id)}});
    setTimeout(()=>{if(toast.isConnected)toast.classList.add("visible")},20)
  }
  async function refreshCenter(selected=activeProvider()){
    const box=$("#osminogSessionConnectedList");if(!box)return;
    const r=await list(),items=Object.entries(r?.sessions||{});
    box.innerHTML=items.length?items.map(([id,state])=>`<button type="button" data-session-provider="${esc(id)}" class="${state?.ready?"ready":"not-ready"}" title="${esc(state?.ready?"Показать связанную вкладку":state?.error||"Вкладка открыта, но чат не готов")}"><i></i><span>${esc(label(id))}</span><small>${state?.ready?"On":"Не готов"}</small></button>`).join(""):`<span class="osminog-session-empty">Нет подключённых web-сессий</span>`;
    box.querySelectorAll("[data-session-provider]").forEach(b=>b.addEventListener("click",()=>focus(b.dataset.sessionProvider)));
    const st=await status(selected),row=$("#gptProviderConnectRow");if(row)row.classList.toggle("connected",!!st?.connected)
  }
  function bindSessionActions(){/* Keep gpt-presence direct connect/authorize listeners. Access Center must not hijack them. */}
  function installAgentSettings(){
    const panel=$("#gptPresenceSettingsPanel"),sel=$("#gptAgentProvider");if(!panel||!sel)return false;
    const brains=brainProviders();sel.innerHTML=brains.map(p=>`<option value="${esc(p.brainId||p.id)}">${esc(p.name)}</option>`).join("");
    $("#gptProviderBrandGrid")?.remove();$("#osminogBrainPicker")?.remove();$("#osminogSettingsProviderTools")?.remove();
    const providerLabel=sel.closest("label");providerLabel?.classList.add("gpt-native-provider-select");
    const picker=document.createElement("div");picker.id="osminogBrainPicker";picker.className="osminog-brain-picker";picker.innerHTML=`<div class="osminog-brain-picker-head"><span>МОЗГ АГЕНТА</span><small>Выбери ИИ для этого чата. OSMINOG держит одну фоновую авторизованную service session для каждого сервиса и переиспользует её.</small></div><div class="osminog-brain-picker-grid">${brains.map(p=>`<button type="button" data-brain="${esc(p.brainId||p.id)}" title="${esc(p.name)}" style="--provider-tone:${esc(p.tone||"#58c9ff")}">${icon(p)}<span>${esc(p.name)}</span><i></i></button>`).join("")}</div>`;providerLabel?.before(picker);
    picker.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{img.hidden=true;if(img.nextElementSibling)img.nextElementSibling.hidden=false},{once:true}));
    function syncBrain(){picker.querySelectorAll("[data-brain]").forEach(b=>b.classList.toggle("active",b.dataset.brain===sel.value))}
    picker.querySelectorAll("[data-brain]").forEach(b=>b.addEventListener("click",()=>{sel.value=b.dataset.brain;sel.dispatchEvent(new Event("change",{bubbles:true}));syncBrain()}));sel.addEventListener("change",()=>{syncBrain();refreshCenter(sel.value)});syncBrain();
    const row=$("#gptProviderConnectRow");if(row){row.classList.remove("osminog-session-center");row.classList.add("osminog-connection-launch");$("#osminogSessionCenterHead",row)?.remove();$("#osminogSessionConnectedList",row)?.remove();const connectBtn=$("#gptProviderTabConnect",row),authBtn=$("#gptProviderAuthorize",row),state=$("#gptProviderTabState",row);if(connectBtn){connectBtn.hidden=false;connectBtn.textContent="Подключить в фоне"}if(authBtn)authBtn.hidden=false;if(state)state.textContent="Подключённые сервисы и быстрый доступ открываются в отдельном адаптивном окне.";bindSessionActions(row)}
    $("#bridgeLiveBadge")?.setAttribute("aria-label","Provider status");refreshCenter(sel.value);return true
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(installAgentSettings()||tries>40)clearInterval(timer)},120);
  chrome.runtime.onMessage.addListener(message=>{if(message?.type!=="OSMINOG_SESSION_DISCONNECTED")return;showReconnect(message.provider,message.reason);emit(message.provider,{connected:false,reason:message.reason});refreshCenter(message.provider)});
  document.addEventListener("osminog:session-changed",e=>refreshCenter(e.detail?.provider||activeProvider()));
  globalThis.OSMINOGSessionManager={version:"3.14.2-dev",list,getOrCreate,connect,authorize,status,focus,providers,meta,brainProviders,brainIds:brainIds(),openSettings,openCenter:openSettings,showReconnect,refreshCenter};
  globalThis.OSMINOGOpenProviderSettings=openSettings;
  document.dispatchEvent(new CustomEvent("osminog:session-manager-ready"));
})();
