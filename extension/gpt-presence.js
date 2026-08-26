"use strict";
(()=>{
  const B=globalThis.BriefCraftBridge;if(!B)return;
  const panel=document.getElementById("bridgePanel"),body=panel?.querySelector(".bridge-body");if(!panel||!body)return;
  const q=(s,r=document)=>r.querySelector(s);const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const projectId=()=>globalThis.project?.()?.id||"none";
  const threadChatKey=id=>`briefCraftGptLiteChat:${projectId()}:${id||"main"}`,threadContextKey=id=>`briefCraftGptPinnedContext:${projectId()}:${id||"main"}`,THREADS_KEY=()=>`briefCraftGptThreads:${projectId()}`;
  const LEGACY_CHAT_KEY=()=>`briefCraftGptLiteChat:${projectId()}`,LEGACY_CONTEXT_KEY=()=>`briefCraftGptPinnedContext:${projectId()}`;
  const ENABLE_KEY="briefCraftGptLiteEnabledV1",PROVIDER_KEYS="briefCraftProviderKeysV1",RESEARCH_KEY="briefCraftInternetResearchV1",PANEL_KEY="briefCraftGptPanelGeometryV2",BUBBLE_KEY="briefCraftGptBubbleGeometryV1",STYLE_KEY=()=>`briefCraftGptStyle:${projectId()}`;
  const AGENT_COLORS=["#8b5cf6","#06b6d4","#ec4899","#22c55e","#f59e0b","#ef4444","#3b82f6"];
  const PROVIDER_COLORS={gpt:"#22c55e",claude:"#f97316",gemini:"#6366f1",deepseek:"#06b6d4",custom:"#8b5cf6"};
  const ROLE_LABELS={universal:"Универсал",layout:"Верстальщик",copy:"Копирайтер",research:"Исследователь",design:"Дизайнер",code:"Кодер"};
  const ROLE_INSTRUCTIONS={universal:"Work as a generalist project agent.",layout:"Act as a layout/DOM specialist. Prioritize structure, CSS, responsive composition and implementation details.",copy:"Act as a copywriter/spec editor. Prioritize wording, hierarchy, labels, product copy and clear briefs.",research:"Act as a researcher. Verify facts, compare sources, use web tools when enabled, and summarize evidence before edits.",design:"Act as a visual designer. Prioritize hierarchy, spacing, color, composition and vector geometry.",code:"Act as a senior implementation engineer. Prioritize code correctness, debugging, maintainability and live previews."};
  const AGENT_FACES=["wisp-1","wisp-2","wisp-3","wisp-4","wisp-5","wisp-6","wisp-7"];
  let threads=[{id:"main",name:"Главный",kind:"main",color:PROVIDER_COLORS.gpt,ghost:"✦",face:"wisp-main",provider:"gpt",role:"universal"}],activeThreadId="main",chat=[],connected=false,busy=false,lastContextRaw="",lastRequestId="",panelMoved=false,pendingAttachments=[],pinnedContexts=[],lastMainOverviewRevision=0,ghostTimer=0,ghostHighlight=null,ghostOrbitTimer=0,ghostAnchor=null,ghostOrbitStep=0,ghostMode="inspect",currentPromptMeta=null,patchRetrying=false,researchEnabled=false,jarvisEnabled=false,jarvisFolder="",chatStyle={panel:"",user:"",assistant:"",composer:""};
  const threadTasks=new Map();let patchSerial=Promise.resolve();
  const safeText=(selector,value)=>{const el=q(selector);if(el)el.textContent=value};const safeClass=(selector,value)=>{const el=q(selector);if(el)el.className=value};
  const fmtSize=n=>{n=Number(n)||0;if(n<1024)return `${n} Б`;if(n<1048576)return `${(n/1024).toFixed(1)} КБ`;return `${(n/1048576).toFixed(1)} МБ`};
  const wispMarkup=(extra="")=>`<span class="agent-wisp ${extra}"><i></i><i></i><b></b></span>`;

  function ensureBubble(){
    let bubble=document.getElementById("gptPresenceBubble");if(bubble)return bubble;
    bubble=document.createElement("button");bubble.type="button";bubble.id="gptPresenceBubble";bubble.className="gpt-presence-bubble";bubble.hidden=true;
    bubble.innerHTML=`${wispMarkup("bubble-wisp")}<span class="gpt-presence-bubble-dot"></span><strong>GPT</strong><small>чат</small>`;
    bubble.title="Открыть ИИ на холсте";let drag=null,moved=false;
    bubble.addEventListener("pointerdown",e=>{if(e.button!==0)return;const r=bubble.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};moved=false;bubble.setPointerCapture?.(e.pointerId);e.preventDefault()});
    bubble.addEventListener("pointermove",e=>{if(!drag||e.pointerId!==drag.id)return;if(Math.abs(e.movementX)+Math.abs(e.movementY)>1)moved=true;const left=Math.max(8,Math.min(innerWidth-bubble.offsetWidth-8,e.clientX-drag.dx)),top=Math.max(8,Math.min(innerHeight-bubble.offsetHeight-8,e.clientY-drag.dy));bubble.style.left=`${left}px`;bubble.style.top=`${top}px`;bubble.style.right="auto"});
    const stop=async e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;const r=bubble.getBoundingClientRect();try{await chrome.storage.local.set({[BUBBLE_KEY]:{left:Math.round(r.left),top:Math.round(r.top)}})}catch{};if(!moved){bubble.hidden=true;panel.hidden=false;syncUi()}};
    bubble.addEventListener("pointerup",stop);bubble.addEventListener("pointercancel",e=>{drag=null});
    document.body.append(bubble);chrome.storage.local.get(BUBBLE_KEY).then(g=>{const p=g?.[BUBBLE_KEY];if(p){bubble.style.left=`${Math.max(8,Math.min(innerWidth-100,Number(p.left)||8))}px`;bubble.style.top=`${Math.max(8,Math.min(innerHeight-60,Number(p.top)||112))}px`;bubble.style.right="auto"}}).catch(()=>{});return bubble;
  }
  async function loadPanelGeometry(){try{const got=await chrome.storage.local.get(PANEL_KEY),g=got?.[PANEL_KEY];if(!g)return;const w=Math.max(380,Math.min(innerWidth-16,Number(g.width)||560)),h=Math.max(430,Math.min(innerHeight-16,Number(g.height)||760));panel.style.width=`${w}px`;panel.style.height=`${h}px`;const maxLeft=Math.max(8,innerWidth-w-8),maxTop=Math.max(8,innerHeight-h-8);panel.style.position="fixed";panel.style.right="auto";panel.style.left=`${Math.max(8,Math.min(maxLeft,Number(g.left)||8))}px`;panel.style.top=`${Math.max(8,Math.min(maxTop,Number(g.top)||82))}px`;panelMoved=true}catch{}}
  function savePanelGeometry(){const r=panel.getBoundingClientRect();chrome.storage.local.set({[PANEL_KEY]:{left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)}}).catch(()=>{})}
  function installPanelControls(){
    panel.classList.add("gpt-resizable-panel");const head=panel.querySelector(".bridge-head");if(!head)return;head.classList.add("gpt-presence-drag-handle");
    const actions=head.querySelector(".bridge-head-actions"),close=q("#bridgeClose");
    if(actions&&!q("#gptPresenceSettingsToggle",actions)){const gear=document.createElement("button");gear.id="gptPresenceSettingsToggle";gear.type="button";gear.className="icon-btn";gear.title="Настройки GPT";gear.innerHTML='<svg><use href="#i-settings"/></svg>';actions.insertBefore(gear,close||null);gear.addEventListener("click",e=>{e.stopPropagation();const box=q("#gptPresenceSettingsPanel");if(box)box.hidden=!box.hidden})}
    if(actions&&!q("#gptPresenceMinimize",actions)){const min=document.createElement("button");min.id="gptPresenceMinimize";min.type="button";min.className="icon-btn";min.title="Свернуть чат";min.innerHTML='<svg><use href="#i-minus"/></svg>';actions.insertBefore(min,close||null);min.addEventListener("click",e=>{e.stopPropagation();panel.hidden=true;ensureBubble().hidden=false;drawAgentTethers()})}
    let drag=null;head.addEventListener("pointerdown",e=>{if(e.button!==0||e.target.closest("button,select,input,textarea,a"))return;const r=panel.getBoundingClientRect();panel.style.position="fixed";panel.style.right="auto";panel.style.left=`${r.left}px`;panel.style.top=`${r.top}px`;panelMoved=true;drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};head.setPointerCapture?.(e.pointerId);panel.classList.add("gpt-presence-moving");e.preventDefault()});
    head.addEventListener("pointermove",e=>{if(!drag||e.pointerId!==drag.id)return;const w=panel.offsetWidth||560,h=panel.offsetHeight||700;panel.style.left=`${Math.max(8,Math.min(innerWidth-w-8,e.clientX-drag.dx))}px`;panel.style.top=`${Math.max(8,Math.min(innerHeight-Math.min(80,h)-8,e.clientY-drag.dy))}px`;drawAgentTethers()});
    const finish=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;panel.classList.remove("gpt-presence-moving");savePanelGeometry();drawAgentTethers()};head.addEventListener("pointerup",finish);head.addEventListener("pointercancel",()=>{drag=null;panel.classList.remove("gpt-presence-moving")});
    [["n","top"],["s","bottom"],["e","right"],["w","left"],["ne"],["nw"],["se"],["sw"]].forEach(([dir])=>{const h=document.createElement("span");h.className=`gpt-panel-resize gpt-panel-resize-${dir}`;h.dataset.gptResize=dir;panel.append(h)});
    panel.querySelectorAll("[data-gpt-resize]").forEach(h=>h.addEventListener("pointerdown",e=>{if(e.button!==0)return;const r=panel.getBoundingClientRect(),dir=h.dataset.gptResize;const start={x:e.clientX,y:e.clientY,left:r.left,top:r.top,w:r.width,h:r.height};h.setPointerCapture?.(e.pointerId);const move=ev=>{const dx=ev.clientX-start.x,dy=ev.clientY-start.y;let left=start.left,top=start.top,w=start.w,hgt=start.h;if(dir.includes("e"))w=Math.max(380,start.w+dx);if(dir.includes("s"))hgt=Math.max(430,start.h+dy);if(dir.includes("w")){w=Math.max(380,start.w-dx);left=start.left+(start.w-w)}if(dir.includes("n")){hgt=Math.max(430,start.h-dy);top=start.top+(start.h-hgt)}w=Math.min(innerWidth-left-8,w);hgt=Math.min(innerHeight-top-8,hgt);Object.assign(panel.style,{position:"fixed",right:"auto",left:`${Math.max(8,left)}px`,top:`${Math.max(8,top)}px`,width:`${w}px`,height:`${hgt}px`});panelMoved=true;drawAgentTethers()};const up=()=>{h.removeEventListener("pointermove",move);h.removeEventListener("pointerup",up);savePanelGeometry()};h.addEventListener("pointermove",move);h.addEventListener("pointerup",up);e.preventDefault()}));
  }
  function providerColor(provider){return PROVIDER_COLORS[provider]||"#8b5cf6"}
  const providerLabel=p=>p==="gemini"?"Gemini":p==="claude"?"Claude":p==="deepseek"?"DeepSeek":p==="custom"?"Custom AI":"GPT";
  function updateActiveAgentIdentity(){
    const t=activeThread()||threads[0],orb=panel.querySelector(".bridge-orb"),heading=q("#bridgeHeading"),kicker=panel.querySelector(".bridge-title small");
    const provider=t?.provider||"gpt",pv=providerLabel(provider),icon=provider==="gemini"?"icons/providers/gemini.svg":provider==="claude"?"icons/providers/claude.svg":provider==="deepseek"?"icons/providers/deepseek.svg":provider==="custom"?"icons/providers/custom.svg":"icons/providers/openai.svg";
    panel.style.setProperty("--agent-color",providerColor(provider));
    if(kicker)kicker.hidden=true;
    if(orb){orb.classList.remove("agent-head-avatar");orb.classList.add("provider-head-avatar");orb.style.setProperty("--agent-color",providerColor(provider));orb.innerHTML=`<img src="${icon}" alt="${esc(pv)}">`}
    if(heading)heading.textContent=pv;const bubble=q("#gptPresenceBubble");if(bubble){bubble.style.setProperty("--agent-color",providerColor(provider));const strong=bubble.querySelector("strong");if(strong)strong.textContent=pv}
  }
  // Canonical source continues in the packaged build. This repository copy is the active owner-update target for microfixes.
})();
