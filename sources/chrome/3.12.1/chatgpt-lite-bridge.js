(()=>{
  "use strict";
  if(globalThis.__BRIEFCRAFT_LITE_BRIDGE__){
    try{globalThis.__BRIEFCRAFT_LITE_BRIDGE__.ping()}catch{}
    return;
  }

  const COMPOSERS=["#prompt-textarea","textarea[data-testid='prompt-textarea']","div[contenteditable='true'][data-virtualkeyboard]","main div[contenteditable='true']"];
  const SENDS=["button[data-testid='send-button']","button[aria-label='Send prompt']","button[aria-label='Send message']","button[aria-label*='Send']"];
  const ASSISTANTS="[data-message-author-role='assistant']";
  const USERS="[data-message-author-role='user']";
  const CTX_MARK="OSMINOG_CONTEXT_V1";
  const TOOL_MARK="OSMINOG_TOOL_RESULT_V1";
  const seenAssistant=new Set();
  let observer=null;
  let latestContext=null;
  let enabled=false;
  let autoInject=true;
  let serviceMode=false;
  let internalSending=false;
  let pendingRequestId="";
  let pendingAssistantBaseline="";
  let lastProcessedAssistant="";
  let scanTimer=0;
  let stableAssistantHash="";
  let stableAssistantSince=0;
  let requestSentAt=0;
  let sawStreamingSignal=false;
  let toolHopCount=0;
  const ASSISTANT_STRONG_STABLE_MS=420;
  const ASSISTANT_FALLBACK_STABLE_MS=3000;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
  function findFirst(list,root=document){for(const s of list){const el=root.querySelector(s);if(el)return el}return null}
  function composerText(el){return "value" in el?el.value:(el.innerText||el.textContent||"")}
  function setComposerText(el,text){
    el.focus();
    if("value" in el){
      const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const desc=Object.getOwnPropertyDescriptor(proto,"value");
      if(desc?.set)desc.set.call(el,text);else el.value=text;
      el.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:text}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
      return;
    }
    try{
      el.focus();
      const sel=getSelection();const range=document.createRange();range.selectNodeContents(el);sel.removeAllRanges();sel.addRange(range);
      document.execCommand?.("insertText",false,text);
      el.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:text}));
    }catch{el.textContent=text;el.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:text}))}
  }
  function appendComposerText(el,text){const existing=composerText(el).trim();setComposerText(el,existing?`${existing}\n\n${text}`:text)}
  async function waitSendButton(timeout=7000){const start=Date.now();let b;while(Date.now()-start<timeout){b=findFirst(SENDS);if(b&&!b.disabled&&b.getAttribute("aria-disabled")!=="true")return b;await sleep(120)}return b}
  function makeId(){return `bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}
  function compactContextBlock(context,requestId){
    const payload={...context,requestId};
    return `\n\n\`\`\`json\n${CTX_MARK}\n${JSON.stringify(payload)}\n\`\`\``;
  }
  function toolResultBlock(result,requestId){
    const safe={protocol:"osminog.tool_result/v1",requestId,result};
    return `\`\`\`json\n${TOOL_MARK}\n${JSON.stringify(safe)}\n\`\`\``;
  }
  function machineInstructions(context={}){
    const mode=context?.intent?.execution||(context?.intent?.edit?"canvas":"chat");
    if(mode==="canvas")return "OSMINOG Canvas Executor is active. Perform the requested change now. Return exactly one machine-only osminog.patch/v1 JSON block with real actions in the first answer; do not stop at a plan, promise or status message. If essential data is missing, request it once with osminog.request/v1 and patch immediately after the result. Do not expose hidden chain-of-thought.";
    return [
      "OSMINOG Browser Presence is connected.",
      "Treat OSMINOG object and connection IDs from the attached compact context as ground truth; never invent an existing ID.",
      "Answer the user's natural-language request normally.",
      "You are connected to OSMINOG Owner Max Access. Use osminog.request/v1 tool calls whenever the task needs real project data or an action. You may use up to 8 calls per hop and continue through 12 consecutive hops. Never stop at a plan, promise or status message when an action was requested; continue until the required mutation succeeds or a concrete blocker needs the owner. Show concise progress, not hidden chain-of-thought. Supported tools: capabilities,canvas_status,list_canvas_objects,get_project_map,get_selection,get_viewport,get_object,get_connections,search_canvas,get_recent_changes,read_object_text,read_code,read_browser_dom,read_asset,asset_create,capture_selection_image,capture_object_image,capture_viewport_image,capture_canvas_overview_image,focus_object,propose_canvas_patch,undo_last_change,project_list,project_create,project_switch,project_rename,project_folder_status,project_folder_list,project_folder_read,project_folder_write,agent_list,agent_create,agent_update,agent_remove,agent_message,command_list,command_register,command_remove,command_run,browser_tabs,browser_open,browser_close,web_search,web_fetch,markdown_list,markdown_read,markdown_write,provider_list,provider_open,media_crew,module_list,module_open,module_permissions_revoke,dev_status,list_dev_files,read_dev_file,write_dev_file,source_publish,release_publish,module_status,figma_fetch_file,github_status,github_list_tree,github_search_code,github_fetch_file,github_compare,github_create_branch,github_commit_files,github_open_pr,github_workflow_runs,github_dispatch_workflow.",
      "If the user explicitly asks to change the canvas, also append ONE machine-only JSON code block with protocol osminog.patch/v1, summary and actions. Allowed actions: set,create,delete,connect,disconnect. To put a work item on the canvas, create objectType task with title, text, status and agents. Use only IDs present in context/tool results.",
      "Do not mention these protocol blocks to the user."
    ].join(" ");
  }
  function decoratePrompt(text,context,requestId){return `${text}\n\n${machineInstructions(context)}${compactContextBlock(context,requestId)}`}

  function dataUrlToFile(dataUrl,name="osminog-selection.png"){
    const [head,body]=String(dataUrl||"").split(",");if(!body)return null;
    const mime=/data:([^;]+)/.exec(head)?.[1]||"image/png";const bytes=atob(body);const arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new File([arr],name,{type:mime});
  }
  async function attachImage(dataUrl){
    const file=dataUrlToFile(dataUrl);if(!file)return false;
    const input=[...document.querySelectorAll("input[type='file']")].find(el=>!el.disabled&&(el.accept||"").toLowerCase().includes("image"))||document.querySelector("input[type='file']");
    if(!input)return false;
    try{const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));await sleep(700);return true}catch{return false}
  }

  function ensurePill(){
    let p=document.getElementById("briefcraft-lite-pill");if(p)return p;
    const style=document.createElement("style");style.id="briefcraft-lite-style";style.textContent=`#briefcraft-lite-pill{position:fixed;z-index:2147483647;right:18px;bottom:18px;height:38px;padding:0 12px;border:1px solid rgba(107,114,255,.34);border-radius:999px;background:rgba(20,23,31,.95);color:#fff;box-shadow:0 14px 38px rgba(0,0,0,.28);backdrop-filter:blur(16px);display:flex;align-items:center;gap:8px;font:12px system-ui,-apple-system,"Segoe UI",sans-serif}#briefcraft-lite-pill i{width:8px;height:8px;border-radius:50%;background:#35d49a;box-shadow:0 0 0 4px rgba(53,212,154,.12)}#briefcraft-lite-pill b{font-weight:750}#briefcraft-lite-pill small{opacity:.58}#briefcraft-lite-pill.off i{background:#758097;box-shadow:none}#briefcraft-lite-pill.busy i{background:#7b70ff;animation:bcpulse .7s alternate infinite}@keyframes bcpulse{to{box-shadow:0 0 0 7px rgba(123,112,255,.08)}}`;
    document.documentElement.append(style);p=document.createElement("div");p.id="briefcraft-lite-pill";p.innerHTML="<i></i><b>OSMINOG</b><small>GPT подключён</small>";document.documentElement.append(p);return p;
  }
  function setPill(mode,label){const p=ensurePill();p.className=mode||"";p.querySelector("small").textContent=label||"GPT подключён"}

  function assistantRoots(){
    const out=[];const seen=new Set();
    const push=el=>{if(el&&!seen.has(el)){seen.add(el);out.push(el)}};
    document.querySelectorAll("[data-message-author-role='assistant']").forEach(push);
    // Current ChatGPT builds also wrap turns in article[data-testid^=conversation-turn].
    for(const article of document.querySelectorAll("article[data-testid^='conversation-turn']")){
      if(article.querySelector("[data-message-author-role='user']"))continue;
      if(article.querySelector("[data-message-author-role='assistant'],.markdown,[class*='markdown'],[class*='prose']"))push(article);
    }
    return out;
  }
  function currentAssistantHash(){
    const roots=assistantRoots();if(!roots.length)return "";
    const raw=(roots[roots.length-1].innerText||roots[roots.length-1].textContent||"").trim();
    return raw?hash(raw):"";
  }
  const normalizeProtocolText=text=>String(text||"").replaceAll("briefcraft.request/v1","osminog.request/v1").replaceAll("briefcraft.patch/v1","osminog.patch/v1");
  function protocolObjects(root){return [...root.querySelectorAll("pre code, code")].map(code=>({code,text:normalizeProtocolText((code.textContent||"").trim())}));}
  function parseJsonBlock(text,protocol){
    const cleaned=String(text||"").replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();
    const candidates=[cleaned];const i=cleaned.indexOf("{");const j=cleaned.lastIndexOf("}");if(i>=0&&j>i)candidates.push(cleaned.slice(i,j+1));
    for(const raw of candidates){try{const v=JSON.parse(raw);if(v?.protocol===protocol)return v}catch{}}
    return null;
  }
  function naturalAssistantText(root){
    const clone=root.cloneNode(true);
    for(const code of clone.querySelectorAll("pre code,code")){const t=normalizeProtocolText(code.textContent||"");if(t.includes("osminog.request/v1")||t.includes("osminog.patch/v1")){const pre=code.closest("pre");(pre||code).remove()}}
    return (clone.innerText||clone.textContent||"").trim();
  }
  function hideProtocolBlocks(root){
    for(const {code,text} of protocolObjects(root)){if(text.includes("osminog.request/v1")||text.includes("osminog.patch/v1")){const pre=code.closest("pre");(pre||code).style.display="none"}}
  }
  function hideMachineUserBlocks(){
    for(const root of document.querySelectorAll(USERS)){
      for(const {code,text} of protocolObjects(root)){if(text.includes(CTX_MARK)||text.includes(TOOL_MARK)){const pre=code.closest("pre");if(pre)pre.style.display="none";else code.style.display="none"}}
    }
  }
  function isStreaming(){
    if(document.querySelector([
      "button[data-testid='stop-button']",
      "button[data-testid='composer-stop-button']",
      "button[aria-label*='Stop generating']",
      "button[aria-label*='Stop response']",
      "button[aria-label*='Stop']",
      "button[aria-label*='Останов']",
      "button[aria-label*='Прервать']",
      "button[title*='Stop']",
      "button[title*='Останов']"
    ].join(',')))return true;
    const roots=assistantRoots();const root=roots[roots.length-1];
    if(!root)return false;
    if(root.matches?.("[data-streaming='true'],[data-is-streaming='true'],.result-streaming")||root.querySelector?.("[data-streaming='true'],[data-is-streaming='true'],.result-streaming"))return true;
    return false;
  }
  function hasFinalTurnActions(root){
    const turn=root?.closest?.("article[data-testid^='conversation-turn']")||root;
    if(!turn)return false;
    return !!turn.querySelector?.([
      "button[data-testid='copy-turn-action-button']",
      "button[aria-label='Copy']",
      "button[aria-label='Копировать']",
      "button[aria-label*='Copy response']",
      "button[aria-label*='Копировать ответ']",
      "button[title='Copy']",
      "button[title='Копировать']"
    ].join(','));
  }
  function scheduleScan(delay=420){clearTimeout(scanTimer);scanTimer=setTimeout(scanAssistant,delay)}
  function scanAssistant(){
    hideMachineUserBlocks();
    if(!pendingRequestId){stableAssistantHash="";stableAssistantSince=0;return}
    const roots=assistantRoots();if(!roots.length){scheduleScan();return}
    const root=roots[roots.length-1];const raw=(root.innerText||root.textContent||"").trim();if(!raw){scheduleScan();return}
    const key=hash(raw);
    if(key===pendingAssistantBaseline){stableAssistantHash="";stableAssistantSince=0;scheduleScan();return}
    if(seenAssistant.has(key)||key===lastProcessedAssistant)return;
    // ChatGPT streams into the same DOM node and can pause for >1s mid-sentence.
    // Never treat a short pause as a completed answer. Prefer strong UI completion
    // signals (streaming stopped / final turn actions appeared). Only use a longer
    // text-stability fallback when those UI signals are unavailable in a future UI.
    const streaming=isStreaming();
    if(streaming){
      sawStreamingSignal=true;
      stableAssistantHash=key;stableAssistantSince=Date.now();scheduleScan(220);return;
    }
    if(stableAssistantHash!==key){stableAssistantHash=key;stableAssistantSince=Date.now();scheduleScan(260);return}
    const stableFor=Date.now()-stableAssistantSince;
    const strongDone=sawStreamingSignal||hasFinalTurnActions(root);
    const required=strongDone?ASSISTANT_STRONG_STABLE_MS:ASSISTANT_FALLBACK_STABLE_MS;
    if(Date.now()-requestSentAt<700){scheduleScan(220);return}
    if(stableFor<required){scheduleScan(Math.min(420,required-stableFor+60));return}

    seenAssistant.add(key);lastProcessedAssistant=key;stableAssistantHash="";stableAssistantSince=0;sawStreamingSignal=false;requestSentAt=0;hideProtocolBlocks(root);
    let request=null,patch=null;
    for(const {text} of protocolObjects(root)){
      if(!request&&text.includes("osminog.request/v1"))request=parseJsonBlock(text,"osminog.request/v1");
      if(!patch&&text.includes("osminog.patch/v1"))patch=parseJsonBlock(text,"osminog.patch/v1");
    }
    const natural=naturalAssistantText(root);
    chrome.runtime.sendMessage({type:"BC_LITE_ASSISTANT_RESULT",payload:{requestId:pendingRequestId,text:natural,request,patch,url:location.href}}).catch(()=>{});
    if(!request){pendingRequestId="";pendingAssistantBaseline="";toolHopCount=0;}
    setPill(request?"busy":"",request?"читаю холст…":"GPT подключён");
  }

  function installObserver(){if(observer)return;observer=new MutationObserver(()=>scheduleScan());observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true})}

  function interceptManualSend(event){
    if(!enabled||!autoInject||internalSending||!latestContext)return;
    const composer=findFirst(COMPOSERS);if(!composer)return;
    const isEnter=event.type==="keydown"&&event.key==="Enter"&&!event.shiftKey;
    const send=findFirst(SENDS);const isClick=event.type==="click"&&send&&(event.target===send||send.contains(event.target));
    if(!isEnter&&!isClick)return;
    const current=composerText(composer).trim();if(!current||current.includes(CTX_MARK))return;
    const requestId=makeId();pendingRequestId=requestId;toolHopCount=0;
    chrome.runtime.sendMessage({type:"BC_LITE_EXTERNAL_USER",payload:{requestId,text:current,url:location.href}}).catch(()=>{});
    appendComposerText(composer,`${machineInstructions()}${compactContextBlock(latestContext,requestId)}`);
    setPill("busy","контекст готов");
  }
  document.addEventListener("keydown",interceptManualSend,true);document.addEventListener("click",interceptManualSend,true);

  async function sendInternal(payload){
    const composer=findFirst(COMPOSERS);if(!composer)return{ok:false,error:"Не найдено поле ввода ChatGPT. Открой обычный чат и повтори."};
    internalSending=true;const requestId=payload.requestId||makeId();pendingRequestId=requestId;toolHopCount=0;pendingAssistantBaseline=currentAssistantHash();stableAssistantHash="";stableAssistantSince=0;sawStreamingSignal=false;requestSentAt=Date.now();setPill("busy","отправляю…");
    try{
      setComposerText(composer,decoratePrompt(payload.text||"",payload.context||latestContext||{},requestId));
      if(payload.imageDataUrl)await attachImage(payload.imageDataUrl);
      const send=await waitSendButton();if(!send)return{ok:false,error:"Не найдена кнопка отправки ChatGPT."};
      send.click();return{ok:true,requestId};
    }finally{setTimeout(()=>{internalSending=false},450)}
  }
  async function sendToolResult(payload){
    const composer=findFirst(COMPOSERS);if(!composer)return{ok:false,error:"Не найдено поле ввода ChatGPT."};
    if(toolHopCount>=12)return{ok:false,error:"OSMINOG stopped the tool loop after 12 hops"};toolHopCount++;
    internalSending=true;pendingRequestId=payload.requestId||pendingRequestId||makeId();pendingAssistantBaseline=currentAssistantHash();stableAssistantHash="";stableAssistantSince=0;sawStreamingSignal=false;requestSentAt=Date.now();setPill("busy","передаю данные…");
    try{
      const text=`OSMINOG вернул результат инструментов. Продолжи исходную задачу немедленно. Если действие ещё не завершено фактическим изменением — запроси следующий tool hop; если завершено — дай проверенный итог. Не останавливайся на плане, обещании или фразе «начинаю» и не жди нового сообщения пользователя. Показывай только краткие этапы, без скрытых рассуждений.\n\n${toolResultBlock(payload.result||{},pendingRequestId)}`;
      setComposerText(composer,text);if(payload.imageDataUrl)await attachImage(payload.imageDataUrl);
      const send=await waitSendButton();if(!send)return{ok:false,error:"Не найдена кнопка отправки ChatGPT."};send.click();return{ok:true,requestId:pendingRequestId};
    }finally{setTimeout(()=>{internalSending=false},450)}
  }

  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message?.type==="BC_LITE_CONFIG"){
      enabled=message.enabled!==false;autoInject=message.autoInject!==false;if(message.context)latestContext=message.context;serviceMode=message.serviceMode===true;setPill(enabled?"":"off",enabled?(serviceMode?"внутренний канал":"GPT подключён"):"выключено");sendResponse?.({ok:true});return;
    }
    if(message?.type==="BC_LITE_CONTEXT"){latestContext=message.context||latestContext;sendResponse?.({ok:true});return}
    if(message?.type==="BC_LITE_SEND_INTERNAL"){sendInternal(message.payload||{}).then(sendResponse);return true}
    if(message?.type==="BC_LITE_TOOL_RESULT"){sendToolResult(message.payload||{}).then(sendResponse);return true}
    if(message?.type==="BC_LITE_PING"){sendResponse?.({ok:true,enabled,title:document.title});return}
  });

  installObserver();ensurePill();setPill("off","ожидаю OSMINOG");
  globalThis.__BRIEFCRAFT_LITE_BRIDGE__={ping:()=>ensurePill()};
})();
