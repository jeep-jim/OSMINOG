"use strict";
(()=>{
  if(globalThis.__osminogProviderTabBridgeV6)return;
  globalThis.__osminogProviderTabBridgeV6=true;

  let provider="",lastAccepted="",cancelEpoch=0;
  let syncBinding=null,internalSending=false,nativePending=false;
  const syncRoute=()=>OSMINOGChatSync.route(location.href);
  const syncRpc=(type,fields={})=>chrome.runtime.sendMessage({type,bindingId:syncBinding?.id,...fields});
  const isGpt=()=>/^(chatgpt\.com|chat\.openai\.com)$/.test(location.hostname);
  const route=()=>location.origin+location.pathname;
  const inflight=new Map(),recentPrompts=new Map(),directWatches=new Map();
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const clean=value=>String(value||"").replace(/\u200b/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  const norm=value=>clean(value).toLowerCase().replace(/\s+/g," ");
  const textOf=el=>{let text=clean(el?.innerText||el?.textContent||"");for(const a of el?.querySelectorAll?.('a[href]')||[]){const label=clean(a.innerText||a.textContent),url=a.href;if(label&&/^https?:\/\//i.test(url))text=text.replace(label,'['+label.replace(/[\[\]]/g,'')+']('+url.replace(/\(/g,'%28').replace(/\)/g,'%29')+')')}return text};
  const root=()=>document.querySelector("main,[role='main']")||document.body;
  const vis=el=>{try{if(!el||!el.isConnected)return false;const style=getComputedStyle(el),rect=el.getBoundingClientRect();return style.display!=="none"&&style.visibility!=="hidden"&&Number(style.opacity||1)!==0&&rect.width>2&&rect.height>2}catch{return false}};
  function queryAllDeep(selector,start=document){
    const out=[],seen=new Set(),roots=[start];
    while(roots.length){
      const scope=roots.shift();
      try{for(const el of scope.querySelectorAll(selector))if(!seen.has(el)){seen.add(el);out.push(el)}}catch{}
      try{for(const el of scope.querySelectorAll("*"))if(el.shadowRoot)roots.push(el.shadowRoot)}catch{}
    }
    return out
  }

  function inputSelectors(){
    if(provider==="deepseek")return["textarea[placeholder*='DeepSeek' i]","textarea[placeholder*='Message' i]","textarea","[contenteditable='true'][role='textbox']","[contenteditable='true'][data-lexical-editor='true']"];
    if(provider==="claude")return["[contenteditable='true'][data-lexical-editor='true']","[contenteditable='true'][role='textbox']",".ProseMirror[contenteditable=true]","textarea"];
    if(provider==="gemini")return["rich-textarea textarea","div[contenteditable='true'][role='textbox']","textarea"];
    if(provider==="googleai")return[
      "textarea[placeholder*='Ask' i]","textarea[placeholder*='Спрос' i]","textarea[aria-label*='Ask' i]","textarea[aria-label*='Спрос' i]",
      "textarea[name='q']","textarea[jsname]","textarea","[contenteditable='true'][role='textbox']","[contenteditable='true'][role='combobox']",
      "[contenteditable='true'][aria-multiline='true']","[contenteditable='true'][data-placeholder]","[contenteditable='plaintext-only']",
      "[contenteditable='true'][aria-label*='Ask' i]","[contenteditable='true'][aria-label*='Спрос' i]","div[contenteditable='true']",
      "input[name='q']","input[type='text'][aria-label*='Ask' i]","input[type='text'][aria-label*='Спрос' i]"
    ];
    return["textarea","[contenteditable='true'][role='textbox']","[contenteditable='true'][role='combobox']","[contenteditable='true'][aria-multiline='true']","[contenteditable='true'][data-placeholder]","div[contenteditable='true']"];
  }

  function composer(){
    const found=[],seen=new Set();
    for(const selector of inputSelectors())for(const el of queryAllDeep(selector)){
      if(seen.has(el)||!vis(el))continue;
      seen.add(el);
      const rect=el.getBoundingClientRect(),hint=String(el.getAttribute("placeholder")||el.getAttribute("aria-label")||"");
      if(rect.width<120||rect.height<18)continue;
      if(rect.bottom<innerHeight*.28&&!/ask|message|deepseek|prompt|спрос|сообщ|вопрос/i.test(hint))continue;
      found.push(el);
    }
    return found.sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0]||null;
  }

  function setComposer(el,text){
    el.focus();
    if(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement){
      const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
      setter?setter.call(el,text):el.value=text;
      el.dispatchEvent(new InputEvent("input",{bubbles:true,composed:true,inputType:"insertText",data:text}));
      el.dispatchEvent(new Event("change",{bubbles:true,composed:true}));
      return;
    }
    try{
      const selection=getSelection();selection?.removeAllRanges();
      const range=document.createRange();range.selectNodeContents(el);selection?.addRange(range);
      document.execCommand("insertText",false,text);
    }catch{el.textContent=text}
    el.dispatchEvent(new InputEvent("input",{bubbles:true,composed:true,inputType:"insertText",data:text}));
  }

  function sendButton(el){
    const area=el.closest("form")||el.parentElement?.parentElement||root();
    const selectors=["button[type='submit']","button[aria-label^='Run' i]","button[aria-label*='Send' i]","button[aria-label*='Submit' i]","button[aria-label*='Отправ' i]","button[aria-label*='Ask' i]","button[aria-label*='Search' i]","button[data-testid*='send' i]","button[class*='send' i]"];
    for(const selector of selectors){
      const items=[...queryAllDeep(selector,area),...queryAllDeep(selector)].filter((button,index,list)=>list.indexOf(button)===index).filter(vis).filter(button=>!button.disabled&&button.getAttribute("aria-disabled")!=="true");
      if(items.length)return items.at(-1);
    }
    return null;
  }

  function pressEnter(el){
    for(const type of["keydown","keypress","keyup"])el.dispatchEvent(new KeyboardEvent(type,{key:"Enter",code:"Enter",keyCode:13,which:13,bubbles:true,composed:true,cancelable:true}));
  }

  function answerSelectors(){
    if(isGpt())return ["[data-message-author-role='assistant']"];
    if(provider==="alice")return ["[data-message-author-role='assistant']","[data-testid*='assistant']","[class*='AssistantMessage']","[class*='assistant-message']","[class*='assistantMessage']","[class*='MessageContent']","[class*='message-content']","[class*='markdown']"];
    const generic=["[data-message-author-role='assistant']","[data-testid*='assistant']","[role='article']","article","[class*='markdown']","[class*='prose']","[class*='response']","[class*='answer']"];
    if(provider==="deepseek")return[".ds-markdown","[class*='ds-markdown']",...generic];
    if(provider==="claude")return["[data-testid*='assistant']","[class*='font-claude-response']",...generic];
    if(provider==="gemini")return["message-content","model-response",".model-response-text","[class*='model-response']",...generic];
    if(provider==="googleai")return[
      "[data-attrid='wa:/description']","[data-attrid^='wa:']","[data-container-id]","[data-content-feature]","[data-snhf]","[role='article']","article","[class*='response']","[class*='answer']","[class*='markdown']","[class*='prose']"
    ];
    return generic;
  }

  function boilerplate(text){
    const value=norm(text);
    if(!value)return true;
    return /^(здравствуйте|привет)[,!\s].*(что вас интересует|чем могу помочь)|^(hello|hi)[,!\s].*(how can i help|what are you interested)|войдите в аккаунт|sign in to continue|^режим ии$|^ai mode$|попробуйте поискать|google search/i.test(value)&&value.length<260;
  }

  function uiNoise(text){
    const value=norm(text);
    if(value.length<8)return true;
    if(/^(все|картинки|видео|новости|ещ[её]|tools|images|videos|news)$/i.test(value))return true;
    if(/задайте вопрос|поиск в google|search with google/i.test(value)&&value.length<120)return true;
    return false;
  }

  function elementOrder(a,b){
    if(a===b)return 0;
    const pos=a.compareDocumentPosition(b);
    if(pos&Node.DOCUMENT_POSITION_FOLLOWING)return-1;
    if(pos&Node.DOCUMENT_POSITION_PRECEDING)return 1;
    return 0;
  }

  function promptMarker(requestId){return requestId?`[OSMINOG:${requestId}]`:""}

  function findPromptEcho(prompt,requestId){
    const marker=promptMarker(requestId),np=norm(prompt),short=np.slice(0,180),base=root();
    let best=null,bestScore=Infinity;
    for(const el of queryAllDeep("div,span,p,article,[role='article']",base)){
      if(!vis(el)||el.querySelector("textarea,input,[contenteditable='true']"))continue;
      const text=textOf(el),value=norm(text);
      if(!value)continue;
      const matches=(marker&&text.includes(marker))||value===np||(short&&value.includes(short));
      if(!matches)continue;
      const descendants=el.querySelectorAll("div,section,article,p,span").length,score=text.length+descendants*120;
      if(score<=bestScore){best=el;bestScore=score}
    }
    return best;
  }

  function candidateNodes(){
    const base=root(),out=[],seen=new Set();
    for(const selector of answerSelectors())for(const el of queryAllDeep(selector,base)){
      if(seen.has(el)||!vis(el))continue;
      seen.add(el);
      if(el.querySelector("textarea,input,[contenteditable='true']"))continue;
      const text=textOf(el),rect=el.getBoundingClientRect();
      if(!text||text.length>100000||rect.width<110)continue;
      const descendants=el.querySelectorAll("div,section,article,p").length;
      const leaf=Math.max(0,12-Math.min(12,descendants));
      out.push({el,text,bottom:rect.bottom,top:rect.top,area:rect.width*rect.height,leaf,order:0});
    }
    out.sort((a,b)=>elementOrder(a.el,b.el));
    out.forEach((item,index)=>item.order=index);
    return out;
  }

  function snapshot(){
    const list=candidateNodes(),byEl=new Map(),texts=new Set();
    for(const item of list){byEl.set(item.el,item.text);texts.add(norm(item.text))}
    return{byEl,texts,count:list.length};
  }

  function stripPrompt(value,prompt,requestId){
    let text=clean(value),marker=promptMarker(requestId),np=clean(prompt);
    if(marker&&text.includes(marker))text=clean(text.slice(text.lastIndexOf(marker)+marker.length));
    if(np){
      const index=text.indexOf(np);
      if(index>=0&&index<Math.max(500,text.length*.55))text=clean(text.slice(index+np.length));
      const short=np.slice(0,180),shortIndex=short?text.indexOf(short):-1;
      if(shortIndex>=0&&shortIndex<240)text=clean(text.slice(shortIndex+short.length));
    }
    return text;
  }

  function freshText(before,candidate,prompt,requestId,anchor){
    const previous=before.byEl.get(candidate.el)||"";
    let value=candidate.text;
    if(anchor&&candidate.el!==anchor){
      const relation=anchor.compareDocumentPosition(candidate.el);
      if(!(relation&Node.DOCUMENT_POSITION_FOLLOWING)&&!candidate.el.contains(anchor))return"";
    }
    if(previous===value)return"";
    if(previous&&value.startsWith(previous))value=clean(value.slice(previous.length));
    value=stripPrompt(value,prompt,requestId);
    if(!value)return"";
    const normalized=norm(value),normalizedPrompt=norm(prompt);
    if(normalized===normalizedPrompt)return"";
    if(normalizedPrompt&&normalized.endsWith(normalizedPrompt)&&normalized.length<normalizedPrompt.length+80)return"";
    return value;
  }

  function rootFreshText(before,prompt,requestId){
    return ""; // Never export a page or conversation as an assistant response.
    const base=root(),all=clean(base.innerText||base.textContent||""),marker=promptMarker(requestId);if(!all)return"";let value=all;
    if(marker&&value.includes(marker))value=clean(value.slice(value.lastIndexOf(marker)+marker.length));else{const np=clean(prompt),i=np?value.lastIndexOf(np):-1;if(i>=0)value=clean(value.slice(i+np.length))}
    if(!value||value.length<8||boilerplate(value)||uiNoise(value)||before.texts.has(norm(value))||norm(value)===lastAccepted)return"";
    const lines=value.split(/\n+/).map(clean).filter(x=>x&&!uiNoise(x)&&!boilerplate(x));return clean(lines.slice(-80).join("\n"));
  }

  async function waitAnswer(before,prompt,requestId,initialRoute=route(),responseFormat="",generation=cancelEpoch){
    const started=Date.now();let sentRoute=initialRoute;let last="",stableAt=0,anchor=null,wake=null;
    const observer=new MutationObserver(()=>wake?.());
    observer.observe(root(),{childList:true,subtree:true,characterData:true});
    try{
      while(Date.now()-started<150000){
        if(generation!==cancelEpoch)throw Error("Управление остановлено пользователем");
        await Promise.race([sleep(420),new Promise(resolve=>wake=resolve)]);wake=null;
        if(route()!==sentRoute){if(!OSMINOGChatSync.promoted(provider,sentRoute,route())||!findPromptEcho(prompt,requestId))throw new Error("Открыт другой диалог. Подключи его к нужному чату OSMINOG.");sentRoute=route();if(syncBinding)syncBinding.route=sentRoute;}
        if(!anchor)anchor=findPromptEcho(prompt,requestId);
        if(!anchor)continue;
        let best="",score=-Infinity;
        for(const candidate of candidateNodes()){
          let value=freshText(before,candidate,prompt,requestId,anchor);
          if(responseFormat==="osminog-control"){value=globalThis.OSMINOGExtractControlPlan?.(value)||"";}
          if(!value||(nativePending&&/osminog\.(?:request|tool_result|patch)\/v1/.test(value)))continue;
          const afterBonus=anchor&&candidate.el!==anchor&&(anchor.compareDocumentPosition(candidate.el)&Node.DOCUMENT_POSITION_FOLLOWING)?60:0;
          const scoreNow=afterBonus+candidate.order*1.8+candidate.bottom/1400+candidate.leaf*4+Math.min(4000,value.length)/120;
          if(scoreNow>score){best=value;score=scoreNow}
        }
        if(!best&&responseFormat!=="osminog-control"&&responseFormat!=="osminog-direct")best=rootFreshText(before,prompt,requestId);
        if(best){
          if(norm(best)===norm(last)){
            if(!stableAt)stableAt=Date.now();
            if(Date.now()-stableAt>1300&&!queryAllDeep("button[aria-label*='Stop' i],button[aria-label*='Останов' i],[aria-busy='true']").some(vis)){lastAccepted=norm(best);return best}
          }else{last=best;stableAt=Date.now()}
        }
      }
      throw new Error("Новый ответ в служебной вкладке не обнаружен. Запрос отправлен один раз; старый ответ не подставлен.");
    }finally{observer.disconnect()}
  }

  function dataUrlFile(dataUrl,name="screenshot.png",type="image/png"){try{const [head,payload]=String(dataUrl||"").split(","),mime=head.match(/^data:([^;]+)/i)?.[1]||type,binary=head.includes(";base64")?atob(payload):decodeURIComponent(payload),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new File([bytes],name,{type:mime})}catch{return null}}
  function imageAttachmentSignal(){let count=0;for(const img of queryAllDeep("img")){if(!vis(img))continue;const src=String(img.currentSrc||img.src||"");if(/^blob:|^data:image\//i.test(src))count++}for(const el of queryAllDeep("[style*='blob:'],[style*='data:image']"))if(vis(el))count++;return count}
  async function uploadImages(images=[],target=null){if(!images.length)return{ok:true,count:0};const dt=new DataTransfer(),names=[];for(const item of images.slice(0,6)){const name=item.name||`screenshot-${Date.now()}.png`,file=dataUrlFile(item.dataUrl||item.previewDataUrl,name,item.type||"image/png");if(file){dt.items.add(file);names.push(name)}}if(!dt.files.length)throw new Error("OSMINOG не смог подготовить изображение для отправки.");const before=imageAttachmentSignal(),fileInputs=queryAllDeep('input[type="file"]');let input=fileInputs.find(el=>!el.disabled&&/image|\*/i.test(el.accept||"*"))||fileInputs[0],method="file";if(input){try{input.files=dt.files;input.dispatchEvent(new Event("input",{bubbles:true,composed:true}));input.dispatchEvent(new Event("change",{bubbles:true,composed:true}))}catch{input=null}}
    if(!input){method="paste";const host=target||composer();if(!host)throw new Error("Поле для изображения не найдено.");const evt=new Event("paste",{bubbles:true,cancelable:true});try{Object.defineProperty(evt,"clipboardData",{value:dt})}catch{}host.dispatchEvent(evt)}
    const started=Date.now();while(Date.now()-started<6000){await sleep(220);const signal=imageAttachmentSignal();const named=names.some(name=>{const token=name.toLowerCase();return [...document.querySelectorAll("[aria-label],[title],span,div")].some(el=>vis(el)&&String(el.getAttribute("aria-label")||el.getAttribute("title")||el.textContent||"").toLowerCase().includes(token))});if(signal>before||named)return{ok:true,count:dt.files.length,method}}
    if(provider==="googleai")throw new Error("Google AI не подтвердил прикрепление изображения. Запрос не отправлен без картинки.");return{ok:true,count:dt.files.length,method,unconfirmed:true}}


  async function uploadDirectAttachments(items,input){
    if(!items.length)return;
    let upload=queryAllDeep('input[type="file"]').find(e=>!e.disabled&&(!e.accept||/text|\.txt|\*/i.test(e.accept)));
    if(!upload){const button=queryAllDeep('button').find(b=>vis(b)&&/^(attach|add files|upload|прикрепить|добавить файлы)/i.test(b.getAttribute('aria-label')||b.title||''));button?.click();for(let i=0;i<10&&!upload;i++){await sleep(150);upload=queryAllDeep('input[type="file"]').find(e=>!e.disabled&&(!e.accept||/text|\.txt|\*/i.test(e.accept)))}}
    if(!upload||items.length>1&&!upload.multiple)throw Error('Чат не предоставляет подходящее прикрепление файлов');
    const dt=new DataTransfer(),names=[];
    for(const item of items){const f=dataUrlFile(item.dataUrl,item.name,item.type);if(!f)throw Error('Не удалось подготовить контекст');dt.items.add(f);names.push(f.name)}
    upload.files=dt.files;upload.dispatchEvent(new Event('input',{bubbles:true,composed:true}));upload.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
    const deadline=Date.now()+15000;let ready=0;
    while(Date.now()<deadline){await sleep(150);const scope=input.closest('form')||input.parentElement?.parentElement||document;
      const found=names.every(name=>[...scope.querySelectorAll('[title],[aria-label],span,p,div')].some(el=>vis(el)&&[el.title,el.getAttribute('aria-label'),el.childElementCount===0?el.textContent:''].some(t=>String(t||'').includes(name))));
      if(found&&sendButton(input)&&!queryAllDeep('[role="progressbar"],[aria-busy="true"]').some(vis)){if(!ready)ready=Date.now();if(Date.now()-ready>=600)return}else ready=0;
    }throw Error('Чат не подтвердил готовность вложений; продолжение не отправлено');
  }

  function collectRich(answer,prompt,requestId){
    const answerNorm=norm(answer),base=root(),media=[],seenMedia=new Set(),widgets=[];
    const answerNodes=candidateNodes().filter(c=>{
      const n=norm(c.text),head=answerNorm.slice(0,120);
      return head&&(n.includes(head)||answerNorm.includes(n.slice(0,120)))
    }).map(c=>c.el);
    const scope=answerNodes;
    for(const host of scope){
      for(const img of host.querySelectorAll?.("img")||[]){
        if(!vis(img))continue;
        const r=img.getBoundingClientRect(),src=img.currentSrc||img.src||"";
        if(!src||r.width<80||r.height<60||seenMedia.has(src))continue;
        if(/logo|icon|avatar|favicon|profile/i.test(String(img.alt||""))&&r.width<180)continue;
        seenMedia.add(src);media.push({url:src,alt:String(img.alt||"Изображение").slice(0,160),width:Math.round(r.width),height:Math.round(r.height)});
        if(media.length>=8)break
      }
      if(media.length>=8)break
    }
    const selectors=["[data-attrid*='weather' i]","[data-attrid*='sports' i]","[data-attrid*='finance' i]","[data-attrid*='local' i]","[data-content-feature]","[role='region']"];
    const seenWidget=new Set();
    for(const host of scope)for(const selector of selectors)for(const el of host.querySelectorAll(selector)){
      if(!vis(el))continue;const text=clean(el.innerText||el.textContent||"");if(text.length<12||text.length>1800)continue;
      const key=norm(text).slice(0,240);if(!key||seenWidget.has(key)||boilerplate(text)||uiNoise(text))continue;
      const promptNorm=norm(prompt);if(promptNorm&&key===promptNorm.slice(0,240))continue;
      seenWidget.add(key);const title=clean(el.querySelector("h1,h2,h3,[role='heading'],strong")?.innerText||"Google");
      widgets.push({kind:(el.getAttribute("data-attrid")||el.getAttribute("data-content-feature")||"card").slice(0,80),title:title.slice(0,160),text:text.slice(0,1600)});
      if(widgets.length>=6)break
    }
    return{media,widgets}
  }

  async function send(text,requestId="",images=[],responseFormat="",strictAttachments=false){
    if(isGpt()&&!syncBinding&&!managedAgentSession)throw new Error("Подключи синхронизацию этого чата в OSMINOG");
    if(internalSending||nativePending)throw new Error("Дождись текущего ответа в подключённом диалоге");
    if(syncBinding&&syncBinding.route!==route())throw new Error("Открыт другой диалог. Подключи его отдельно.");
    const input=composer();
    if(!input)throw new Error("Поле ввода не найдено. Открой Google AI Mode/диалог провайдера в служебной вкладке.");
    const draft=clean(input.value??input.innerText??input.textContent);
    if(draft)throw new Error("В оригинальном чате набран текст. Отправь или убери его перед запросом из OSMINOG.");
    const start=syncBinding?await syncRpc('BC_CHAT_SYNC_START',{requestId}):{ok:true};if(!start?.ok)throw Error(start?.error||'Чат занят');
    internalSending=true;document.documentElement.dataset.osminogSyncInternal='1';
    const before=snapshot(),initialRoute=route(),generation=cancelEpoch;
    try{if(strictAttachments)await uploadDirectAttachments(images,input);else{const uploaded=await uploadImages(images,input);if(uploaded?.unconfirmed)throw Error('Сайт ИИ не подтвердил загрузку снимка. Команда не отправлена без изображения.')}if(generation!==cancelEpoch)throw Error("Управление остановлено пользователем");
    if(strictAttachments&&clean(input.value??input.innerText??input.textContent))throw Error('В чате появился новый черновик. Он сохранён; продолжение остановлено.');
    setComposer(input,text);
    await sleep(180);
    const button=sendButton(input);
    if(nativeSubmit){const r=button?.getBoundingClientRect();globalThis.__osminogSubmitIntent={requestId,kind:button?'click':'enter',x:r?r.x+r.width/2:0,y:r?r.y+r.height/2:0};}else if(button)button.click();else pressEnter(input);
    const ackStart=Date.now();let acknowledged=false;
    while(Date.now()-ackStart<8000){if(generation!==cancelEpoch)throw Error('Управление остановлено пользователем');if(findPromptEcho(text,requestId)){acknowledged=true;break}await sleep(160)}
    if(!acknowledged)throw Error('SEND_NOT_CONFIRMED: сайт ИИ не подтвердил отправку команды. Повторная отправка не выполнялась.');
    const answer=await waitAnswer(before,text,requestId,initialRoute,responseFormat,generation);
    return{answer,...collectRich(answer,text,requestId)};
    }finally{delete globalThis.__osminogSubmitIntent;internalSending=false;delete document.documentElement.dataset.osminogSyncInternal;if(syncBinding)await syncRpc('BC_CHAT_SYNC_EVENT',{requestId,role:'complete',text:''}).catch(()=>{});}

  }

  function nativeSend(event){
    if(!syncBinding||event.isComposing)return;
    if(route()!==syncBinding.route)return;
    const input=composer();if(!input)return;const button=sendButton(input);
    if(!(event.type==='keydown'&&event.key==='Enter'&&!event.shiftKey&&input.contains(event.target))&&!(event.type==='click'&&button?.contains(event.target))&&!(event.type==='submit'&&event.target.contains(input)))return;
    if(internalSending||nativePending){
      if(event.isTrusted&&event.type!=='submit'){event.preventDefault();event.stopImmediatePropagation();let notice=document.getElementById('osminog-sync-wait');if(!notice){notice=document.createElement('div');notice.id='osminog-sync-wait';notice.style.cssText='position:fixed;right:16px;top:16px;z-index:2147483647;background:#202737;color:white;padding:12px;border-radius:12px;font:13px system-ui';document.documentElement.append(notice)}notice.textContent='OSMINOG: дождись текущего ответа. Набранный текст сохранён.';setTimeout(()=>notice.remove(),4000)}
      return;
    }
    const text=clean(input.value??input.innerText??input.textContent);if(!text)return;
    const before=snapshot(),initialEcho=findPromptEcho(text,''),initialRoute=route(),requestId=crypto.randomUUID(),binding=syncBinding;
    nativePending=true;
    (async()=>{try{
      const start=await syncRpc('BC_CHAT_SYNC_START',{requestId});if(!start?.ok)throw Error(start?.error||'Нет связи с OSMINOG');
      // Require a real native prompt echo: cancelled sends and draft edits are not imported.
      for(let i=0;i<100&&(!findPromptEcho(text,'')||findPromptEcho(text,'')===initialEcho);i++)await sleep(100);
      if(!findPromptEcho(text,'')||findPromptEcho(text,'')===initialEcho)throw Error('Сообщение не отправлено на сайте ИИ');
      if(syncBinding!==binding)return;
      const user=await syncRpc('BC_CHAT_SYNC_EVENT',{requestId,role:'user',text});if(!user?.ok)throw Error(user?.error);
      const answer=await waitAnswer(before,text,'',initialRoute);if(syncBinding!==binding)return;
      const result=await syncRpc('BC_CHAT_SYNC_EVENT',{requestId,role:'assistant',text:answer});if(!result?.ok)throw Error(result?.error);
    }catch(e){await syncRpc('BC_CHAT_SYNC_EVENT',{requestId,role:'error',text:'Синхронизация: '+e.message}).catch(()=>{});
    }finally{nativePending=false}})();
  }
  for(const type of ['keydown','click','submit'])document.addEventListener(type,nativeSend,true);

  let managedAgentSession=false,nativeSubmit=false;
  function probe(){
    const input=composer(),candidates=inputSelectors().reduce((sum,selector)=>sum+queryAllDeep(selector).filter(vis).length,0);
    return{ok:!!input,provider,title:document.title,url:location.href,composer:input?{tag:input.tagName.toLowerCase(),role:input.getAttribute("role")||"",editable:input.getAttribute("contenteditable")||"",placeholder:input.getAttribute("placeholder")||input.getAttribute("aria-label")||input.getAttribute("data-placeholder")||""}:null,candidates,answers:candidateNodes().length,readyState:document.readyState,bridge:"v6"};
  }

  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(message?.type==='BC_PROVIDER_MANAGED_CONFIG'){
      if(_sender?.id!==chrome.runtime.id||_sender?.tab){reply({ok:false,error:'Only extension background may configure managed execution'});return}
      if(internalSending||nativePending){reply({ok:false,error:'Служебный чат занят'});return}
      managedAgentSession=true;nativeSubmit=message.nativeSubmit===true;syncBinding=null;delete document.documentElement.dataset.osminogChatSyncBound;
      provider=String(message.provider||provider||'');reply({ok:true,...probe()});return;
    }
    if(message?.type==='BC_CHAT_SYNC_CONFIG'){
      if((nativePending||internalSending)&&message.binding?.id!==syncBinding?.id){reply({ok:false,error:'Диалог занят'});return}
      managedAgentSession=false;const reset=!syncBinding;
      if(message.binding?.id!==syncBinding?.id)syncBinding=message.binding||null;
      else if(syncBinding)syncBinding.route=message.binding.route;
      // A bound native conversation is a plaintext synchronization channel.
      // Presence must never rewrite its composer with workspace context.
      if(syncBinding)document.documentElement.dataset.osminogChatSyncBound=syncBinding.id;
      else delete document.documentElement.dataset.osminogChatSyncBound;
      reply({ok:true,reset});return;
    }
    if(message?.type==="BC_PROVIDER_TAB_CONFIG"){
      provider=String(message.provider||provider||"");
      document.documentElement.dataset.osminogProvider=provider;
      reply({ok:true,...probe()});
      return;
    }
    if(message?.type==="BC_PROVIDER_TAB_CANCEL"&&_sender?.id===chrome.runtime.id&&!_sender?.tab){cancelEpoch++;reply({ok:true});return}
    if(message?.type==="BC_PROVIDER_TAB_ATTACH"){if(_sender?.id!==chrome.runtime.id||_sender?.tab||internalSending||nativePending){reply({ok:false,error:'Диалог занят или отправитель не разрешён'});return}uploadImages(Array.isArray(message.images)?message.images:[],composer()).then(reply).catch(e=>reply({ok:false,error:e.message}));return true}
    if(message?.type==='BC_PROVIDER_DIRECT_PREPARE'){
      if(_sender?.id!==chrome.runtime.id||_sender?.tab||!managedAgentSession||internalSending||nativePending){reply({ok:false,error:'Чат занят'});return}
      directWatches.clear();directWatches.set(message.requestId,{before:snapshot(),prompt:String(message.text||''),route:route(),generation:cancelEpoch});reply({ok:true});return;
    }
    if(message?.type==='BC_PROVIDER_DIRECT_WAIT'){
      if(_sender?.id!==chrome.runtime.id||_sender?.tab||!managedAgentSession){reply({ok:false,error:'Источник не разрешён'});return}
      const w=directWatches.get(message.requestId);directWatches.delete(message.requestId);if(!w){reply({ok:false,error:'Запрос уже обработан'});return}
      waitAnswer(w.before,w.prompt,'',w.route,'osminog-direct',w.generation).then(answer=>reply({ok:true,answer})).catch(e=>reply({ok:false,error:e.message}));return true;
    }
    if(message?.type==="BC_PROVIDER_TAB_PROBE"){reply(probe());return}
    if(message?.type!=="BC_PROVIDER_TAB_SEND_V4"&&message?.type!=="BC_PROVIDER_TAB_SEND")return;

    if(message.bindingId&&message.bindingId!==syncBinding?.id){reply({ok:false,error:'Чат переподключён другому агенту'});return}
    const requestId=String(message.requestId||`tab-${Date.now()}-${Math.random().toString(36).slice(2,7)}`),text=String(message.text||""),key=norm(text);
    const cacheKey=requestId+"\u0000"+text;let task=inflight.get(cacheKey);
    if(!task){
      task=send(text,requestId,Array.isArray(message.images)?message.images:[],message.responseFormat||"",message.strictAttachments===true);
      inflight.set(cacheKey,task);
      recentPrompts.set(key,{at:Date.now(),task});
    }
    task.then(result=>{const pack=typeof result==="string"?{answer:result}:result||{};reply({ok:true,answer:String(pack.answer||""),media:Array.isArray(pack.media)?pack.media:[],widgets:Array.isArray(pack.widgets)?pack.widgets:[],probe:probe(),requestId})}).catch(error=>reply({ok:false,error:error?.message||String(error),probe:probe(),requestId})).finally(()=>{
      setTimeout(()=>{if(inflight.get(cacheKey)===task)inflight.delete(cacheKey);const latest=recentPrompts.get(key);if(latest?.task===task)recentPrompts.delete(key)},30000);
    });
    return true;
  });

  try{chrome.runtime.sendMessage({type:"BC_PROVIDER_TAB_BRIDGE_READY",provider,url:location.href,title:document.title,bridge:"v6"}).catch(()=>{})}catch{}
})();
