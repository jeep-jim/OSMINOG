from pathlib import Path
import json, re

ROOT=Path('.')

def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s):
    path=ROOT/p; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(s,encoding='utf-8')
def once(s,old,new,label):
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected one match, got {n}')
    return s.replace(old,new,1)
def append_once(path,marker,text):
    s=read(path)
    if marker not in s: write(path,s.rstrip()+"\n\n"+text.strip()+"\n")

# Version/build metadata.
m=json.loads(read('manifest.json'))
assert m['version']=='3.14.3',m['version']
m['version']=m['version_name']='3.14.4'
hosts=list(m.get('host_permissions') or [])
for host in ('https://www.bing.com/*','https://*.bing.net/*'):
    if host not in hosts: hosts.append(host)
m['host_permissions']=hosts
write('manifest.json',json.dumps(m,ensure_ascii=False,indent=2)+'\n')

b=json.loads(read('OSMINOG_BUILD.json'))
assert b['version']=='3.14.3',b['version']
b.update(version='3.14.4',codename='CHAT EXECUTION RECOVERY',baseVersion='3.14.3',artifact='OSMINOG-Chrome-3.14.4-CHAT-EXECUTION-RECOVERY.zip',manifestVersion='3.14.4',runtimeVerified=False,binaryInGitHub=False,notes='Restores single-provider chat progress with elapsed seconds and smart scrolling, fixes compact widget close/recreate lifecycle, adds deterministic web image placement, live version badge refresh, and distinct Normal/Compact interface text sizes.')
write('OSMINOG_BUILD.json',json.dumps(b,ensure_ascii=False,indent=2)+'\n')

# Version chip: never flash stale hard-coded releases; desktop-v3 also stops overwriting it.
s=read('editor.html')
s=once(s,'<button id="versionButton" class="version-chip" title="Версия и обновления">v3.14.1</button>','<button id="versionButton" class="version-chip" title="Версия и обновления">v…</button>','editor version placeholder')
s=once(s,'<span id="updateCurrentVersion">v3.11.43</span>','<span id="updateCurrentVersion">v…</span>','update version placeholder')
write('editor.html',s)

s=read('osminog-desktop-v3.js')
s=once(s,'$("#versionButton").textContent="v3.14.1";','const versionButton=$("#versionButton");if(versionButton)versionButton.textContent=`v${chrome.runtime.getManifest().version}`;','desktop version overwrite')
write('osminog-desktop-v3.js',s)

# Default interface text = Normal once after upgrade and apply it on first paint.
s=read('editor.js')
s=once(s,'interfaceTextSize:"normal",oceanShellMigrated:false','interfaceTextSize:"normal",textSizeDefaultNormalV3144:false,oceanShellMigrated:false','text migration flag')
s=once(s,'state.ui={...state.ui,...saved.ui};applyWorkspaceOverrides();','state.ui={...state.ui,...saved.ui};const needsTextSizeDefaultMigration=!state.ui.textSizeDefaultNormalV3144;if(needsTextSizeDefaultMigration){state.ui.interfaceTextSize="normal";state.ui.textSizeDefaultNormalV3144=true}applyWorkspaceOverrides();','text migration')
s=once(s,'if(needsThreeThemeMigration)setTimeout(()=>queuePersist(),0);','if(needsThreeThemeMigration||needsTextSizeDefaultMigration)setTimeout(()=>queuePersist(),0);','persist migration')
s=once(s,'const welcome=$("#welcome"),app=$("#app");if(welcome)welcome.hidden=true;if(app)app.hidden=false;const p=project();','const welcome=$("#welcome"),app=$("#app");if(welcome)welcome.hidden=true;if(app)app.hidden=false;renderVersionUI();const p=project();','version on first workspace paint')
write('editor.js',s)

# Compact and Normal previously shared inherited sizes in many controls. Force all four presets through the same variables.
s=read('editor.css')
css='''\n/* 3.14.4 — all interface text presets apply their variables consistently. */
html[data-ui-text-size] :is(.topbar,.side-panel,.inspector,.tool-rail,.modules-popover,.provider-registry,.team-shell,.browser-hub,.markdown-studio,.osminog-windows-explorer,.gpt-resizable-panel,.osminog-google-chat) :is(button,input,textarea,select,label){font-size:var(--osminog-ui-small)!important}
html[data-ui-text-size] :is(.topbar,.side-panel,.inspector,.tool-rail,.modules-popover,.provider-registry,.team-shell,.browser-hub,.markdown-studio,.osminog-windows-explorer,.gpt-resizable-panel,.osminog-google-chat) :is(p,.layer-row,.local-ai-msg,.gpt-msg-text,.google-ai-turn,.team-msg-body){font-size:var(--osminog-ui-body)!important}
html[data-ui-text-size] :is(.topbar,.side-panel,.inspector,.tool-rail,.modules-popover,.provider-registry,.team-shell,.browser-hub,.markdown-studio,.osminog-windows-explorer,.gpt-resizable-panel,.osminog-google-chat) small{font-size:var(--osminog-ui-caption)!important}
html[data-ui-text-size] :is(.provider-registry-head,.osminog-store-head,.panel-head,.bridge-head,.team-head) strong{font-size:var(--osminog-ui-title)!important}
.local-ai-activity.task-progress-active>small{font-variant-numeric:tabular-nums;letter-spacing:.01em}.local-ai-activity.task-progress-active{min-height:32px!important}
'''
if '3.14.4 — all interface text presets' not in s: s+=css
write('editor.css',s)

# Sandbox widgets: inner × closes the managed parent, and reinstall/recreate cannot leave a stale transparent shell.
s=read('osminog-module-runtime.js')
s=once(s,'  async function invoke(ext,method,args={}){\n    const permission=','  async function invoke(ext,method,args={}){\n    if(method==="window.close"){document.dispatchEvent(new CustomEvent("osminog:module-close",{detail:{moduleId:ext.id}}));return{ok:true,closed:true}}\n    const permission=','window.close runtime')
old='function inject(ext,html){const widget=ext.displayMode==="widget"||ext.type==="widget"||ext.type==="tool",chrome=widget?"<style id=\\"osminog-widget-chrome\\">html,body{margin:0!important;padding:0!important;background:transparent!important;min-width:0!important;min-height:0!important;width:fit-content!important;height:fit-content!important;overflow:visible!important}body{display:block!important}</style>":"",script=bridgeScript(ext)+chrome;return /<\\/head>/i.test(html)?html.replace(/<\\/head>/i,chrome+bridgeScript(ext)+"</head>"):/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+script):script+html}'
new='function inject(ext,html){const widget=ext.displayMode==="widget"||ext.type==="widget"||ext.type==="tool",chrome=widget?"<style id=\\"osminog-widget-chrome\\">html,body{margin:0!important;padding:0!important;background:transparent!important;min-width:0!important;min-height:0!important;width:fit-content!important;height:fit-content!important;overflow:visible!important}body{display:block!important}</style>":"",closer=widget?`<script>(function(){window.OSMINOG.close=function(){return window.OSMINOG.call(\'window.close\',{})};addEventListener(\'click\',function(e){const t=e.target&&e.target.closest?e.target.closest(\'button,[role="button"]\'):null;if(!t)return;const label=(t.getAttribute(\'aria-label\')||t.getAttribute(\'title\')||t.dataset.osminogAction||t.dataset.action||t.textContent||\'\').trim();if(t.matches(\'[data-osminog-close],[data-close],.osminog-close,.close-btn,#close,#closeBtn\')||/^(?:×|✕|✖|x|close|закрыть)$/i.test(label)){e.preventDefault();e.stopPropagation();window.OSMINOG.close().catch(function(){})}},true)})();<\\/script>`:"",script=bridgeScript(ext)+chrome+closer;return /<\\/head>/i.test(html)?html.replace(/<\\/head>/i,script+"</head>"):/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+script):script+html}'
s=once(s,old,new,'compact widget close bridge')
write('osminog-module-runtime.js',s)

s=read('osminog-extension-studio.js')
s=once(s,'if(old){const keep={createdAt:old.createdAt','if(old){closeWindow(old.id);const keep={createdAt:old.createdAt','close stale module before reinstall')
s=once(s,'globalThis.OSMINOGExtensionStudio={install,update,test,open,openStudio,list,load,restore,removeFromDesktop,uninstall,focus:id=>globalThis.OSMINOGWindowManager?.front?.(`extension:${id}`),refreshDesktop:renderLaunchers};','globalThis.OSMINOGExtensionStudio={install,update,test,open,close:closeWindow,openStudio,list,load,restore,removeFromDesktop,uninstall,focus:id=>globalThis.OSMINOGWindowManager?.front?.(`extension:${id}`),refreshDesktop:renderLaunchers};\n  document.addEventListener("osminog:module-close",event=>{const id=String(event.detail?.moduleId||"");if(id)closeWindow(id)});','studio close event')
s=once(s,'let firstSize=true;globalThis.OSMINOGModuleRuntime?.mount?.(ext,frame,{autoSize:compact,onSize:({width,height})=>{if(!compact||!firstSize||win.dataset.osminogUserResized)return;firstSize=false;win.style.width=`${Math.max(160,Math.min(innerWidth-24,width))}px`;win.style.height=`${Math.max(100,Math.min(innerHeight-92,height))}px`}})','let autoSizePasses=0;globalThis.OSMINOGModuleRuntime?.mount?.(ext,frame,{autoSize:compact,onSize:({width,height})=>{if(!compact||win.dataset.osminogUserResized||autoSizePasses++>8)return;const nextW=Math.max(120,Math.min(innerWidth-24,width)),nextH=Math.max(70,Math.min(innerHeight-92,height));if(Math.abs(win.getBoundingClientRect().width-nextW)>2)win.style.width=`${nextW}px`;if(Math.abs(win.getBoundingClientRect().height-nextH)>2)win.style.height=`${nextH}px`}})','convergent widget autosize')
write('osminog-extension-studio.js',s)

# A deterministic image-search tool that returns actual bytes, not a provider promise.
s=read('bridge.js')
s=once(s,'browser:["browser_tabs","browser_open","browser_close","web_search","web_fetch"]','browser:["browser_tabs","browser_open","browser_close","web_search","web_fetch","web_image_search"]','bridge capability')
s=once(s,'async function webFetchTool(args={}){','async function webImageSearchTool(args={}){const query=String(args.query||"").trim();if(!query)return{error:"query is empty"};try{return await chrome.runtime.sendMessage({type:"BC_WEB_IMAGE_SEARCH",query,limit:clamp(Number(args.limit)||6,1,10)})}catch(error){return{error:error?.message||"Image search failed"}}}\n  async function webFetchTool(args={}){','image search tool')
s=once(s,'else if(name==="web_search")result=await webSearchTool(args);','else if(name==="web_search")result=await webSearchTool(args);\n      else if(name==="web_image_search")result=await webImageSearchTool(args);','image search dispatch')
write('bridge.js',s)

s=read('background.js')
insert='''\nasync function bcWebImageSearch(query,limit=6){
  const url=`https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC3&first=1`;
  const res=await fetch(url,{cache:"no-store",headers:{"accept-language":"ru,en;q=0.8"}});if(!res.ok)throw new Error(`Image search HTTP ${res.status}`);
  const html=await res.text(),results=[];for(const match of html.matchAll(/<a[^>]+class=["'][^"']*iusc[^"']*["'][^>]+m=["']([^"']+)["']/gi)){
    let meta;try{meta=JSON.parse(bcHtmlDecode(match[1]))}catch{continue}
    const candidates=[meta.turl,meta.murl].filter(Boolean);let captured=null;
    for(const candidate of candidates){try{const r=await fetch(candidate,{cache:"no-store",redirect:"follow"});if(!r.ok)continue;const type=(r.headers.get("content-type")||"").split(";")[0].toLowerCase();if(!type.startsWith("image/"))continue;const buf=await r.arrayBuffer();if(!buf.byteLength||buf.byteLength>12*1024*1024)continue;let binary="";const bytes=new Uint8Array(buf);for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));captured={title:bcHtmlDecode(meta.t||meta.purl||query),sourceUrl:meta.murl||candidate,pageUrl:meta.purl||"",mime:type,size:buf.byteLength,dataUrl:`data:${type};base64,${btoa(binary)}`};break}catch{}}
    if(captured)results.push(captured);if(results.length>=limit)break
  }
  return{ok:true,query,results,source:"Bing Images"}
}
'''
s=once(s,'async function bcWebFetch(url,maxChars=16000){',insert+'async function bcWebFetch(url,maxChars=16000){','background image search')
s=once(s,'if(message.type==="BC_WEB_FETCH"){','if(message.type==="BC_WEB_IMAGE_SEARCH"){(async()=>{try{sendResponse(await bcWebImageSearch(String(message.query||""),Math.max(1,Math.min(10,Number(message.limit)||6))))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}\n  if(message.type==="BC_WEB_FETCH"){','background image message')
s=s.replace('browser_close,web_search,web_fetch,markdown_list','browser_close,web_search,web_fetch,web_image_search,markdown_list')
s=s.replace('For internet files and media, first resolve a direct original-file URL with web_search/web_fetch when necessary, then call asset_create','For internet images prefer web_image_search because it returns actual image bytes; for other internet files resolve a direct URL with web_search/web_fetch when necessary, then call asset_create')
s=s.replace('Honor attached reference images and the owner\'s functional requirements. Prefer a usable compact product over a mockup or plan.','Honor attached reference images and the owner\'s functional requirements. For compact desktop utilities use a transparent page/root with no outer browser/window card; a visible close control must call OSMINOG.close() or use data-osminog-close. Prefer a usable compact product over a mockup or plan.')
write('background.js',s)

# Chat execution UX: selected provider is the only speaker; OSMINOG progress stays in the strip.
s=read('gpt-presence.js')
s=once(s,'"browser_tabs","browser_open","browser_close","web_search","web_fetch"','"browser_tabs","browser_open","browser_close","web_search","web_fetch","web_image_search"','gpt max tools')
old='let responseProgressTimer=0,responseProgress=8;\n  function startResponseProgress(label="ИИ получает контекст…"){clearInterval(responseProgressTimer);responseProgress=6;activity(label,true,{pct:responseProgress});responseProgressTimer=setInterval(()=>{responseProgress=Math.min(92,responseProgress+(responseProgress<55?4:responseProgress<78?2:1));const el=q("#gptPresenceActivity");if(el&&!el.hidden)el.style.setProperty("--activity-pct",`${responseProgress}%`)},420)}'
new='let responseProgressTimer=0,responseProgress=8,responseStartedAt=0,responseStage="";\n  function renderResponseProgress(){const elapsed=Math.max(0,Math.floor((Date.now()-responseStartedAt)/1000)),provider=activeThread()?.provider||"gpt";activity(`${providerLabel(provider)} · ${responseStage} · ${elapsed}с`,true,{pct:responseProgress,color:providerColor(provider)})}\n  function startResponseProgress(label="ИИ получает контекст…"){clearInterval(responseProgressTimer);responseProgress=6;responseStartedAt=Date.now();responseStage=label;renderResponseProgress();responseProgressTimer=setInterval(()=>{responseProgress=Math.min(92,responseProgress+(responseProgress<55?4:responseProgress<78?2:1));renderResponseProgress()},420)}'
s=once(s,old,new,'elapsed progress')
# Any progress/runtime event updates the strip only, never becomes a second chat participant.
old='function add(role,text,attachments=[],meta={}){if(meta.author==="OSMINOG"&&(meta.source==="progress"||meta.source==="runtime")){activity(String(text||""),meta.source==="runtime");}if(!String(text||"").trim()&&!attachments.length)return Promise.resolve();chat.push('
new='function add(role,text,attachments=[],meta={}){if(meta.source==="progress"||(meta.author==="OSMINOG"&&meta.source==="runtime")){responseStage=String(text||"")||responseStage;if(responseStartedAt)renderResponseProgress();else activity(responseStage,true);return Promise.resolve()}if(!String(text||"").trim()&&!attachments.length)return Promise.resolve();chat.push('
s=once(s,old,new,'single speaker add')
# Smart scroll: follow fresh replies while the owner is near bottom, preserve manual reading otherwise.
old='function renderChat(revealLatest=false){\n    const root=q("#gptPresenceMessages");if(!root)return;const preservedScrollTop=root.scrollTop;if(revealLatest)root.style.visibility="hidden";'
new='function renderChat(revealLatest=false){\n    const root=q("#gptPresenceMessages");if(!root)return;const preservedScrollTop=root.scrollTop,nearBottom=root.dataset.readerMoved!=="1"||root.scrollHeight-root.scrollTop-root.clientHeight<84;if(revealLatest)root.style.visibility="hidden";'
s=once(s,old,new,'smart scroll state')
s=once(s,'requestAnimationFrame(()=>{root.scrollTo({top:revealLatest?root.scrollHeight:preservedScrollTop,behavior:"auto"});if(revealLatest)root.style.visibility=""})','requestAnimationFrame(()=>{root.scrollTo({top:(revealLatest||nearBottom)?root.scrollHeight:preservedScrollTop,behavior:"auto"});if(revealLatest)root.style.visibility=""})','smart scroll render')
# Explicit web asset requests are executed locally so the provider cannot falsely claim missing tools.
marker='function isWebAssetAction(text=""){const v=String(text||"");const asset=/(фото|фотограф|изображ|картин|png|webp|svg|jpeg|jpg|gif|файл|image|photo|picture|asset|file)/i.test(v),move=/(найд|поиск|скач|вытащ|вынес|полож|помест|добав|импорт|find|search|download|extract|place|put|add|import)/i.test(v),target=/(рабоч(?:ий|ем)\\s+стол|холст|доск|workspace|desktop|canvas|полож|помест|вынес|добав|импорт|place|put|add|import)/i.test(v);return asset&&move&&target}'
helper=marker+'\n  function webAssetQuery(text=""){return String(text||"").replace(/(?:найди|поищи|поиск|find|search|скачай|download|вытащи|extract|положи|помести|добавь|import|place|put|add)/gi," ").replace(/(?:на\\s+рабоч(?:ий|ем)\\s+стол|на\\s+холст|на\\s+доск[уе]|в\\s+интернете|из\\s+интернета|on\\s+the\\s+desktop|on\\s+the\\s+canvas|from\\s+the\\s+web|online)/gi," ").replace(/\\s+/g," ").trim()||String(text||"").trim()}\n  async function executeDirectWebAsset(text=""){const query=webAssetQuery(text);activity("Ищу изображение в интернете…");const search=await B.executeTool?.("web_image_search",{query,limit:6}),items=search?.results||[];for(const item of items){if(!/^data:image\\//i.test(String(item.dataUrl||"")))continue;activity("Сохраняю найденное изображение на рабочий стол…");const made=await B.executeTool?.("asset_create",{dataUrl:item.dataUrl,mime:item.mime||"image/jpeg",size:Number(item.size)||0,fileName:(String(item.title||query).replace(/[\\/:*?"<>|]+/g,"-").slice(0,90)||"web-image")+((item.mime||"").includes("png")?".png":".jpg"),name:item.title||query,w:420,h:315});if(made?.object?.id)return{...made,searchItem:item,query}}return{error:search?.error||"Не удалось встроить найденное изображение"}}'
s=once(s,marker,helper,'direct asset helpers')
s=once(s,'if(!result||result.error){activity(result?.error||"Module Runtime недоступен",true);return false}','if(!result||result.error){meta.fatalExecutionError=result?.error||"Module Runtime недоступен";activity(meta.fatalExecutionError,true);return false}','terminal module error')
old='currentPromptMeta={text,ctx,execution,edit:execution==="canvas",retry:0,attachments:current,toolHops:0,continuations:0,mutations:[],canvasChanged:false,visualReview:visualArtifactProfile(text,execution)};ctx.intent={...(ctx.intent||{}),execution,visualReviewRequired:currentPromptMeta.visualReview.required};if(execution!=="chat")'
new='currentPromptMeta={text,ctx,execution,edit:execution==="canvas",retry:0,attachments:current,toolHops:0,continuations:0,mutations:[],canvasChanged:false,visualReview:visualArtifactProfile(text,execution),lastContinuationSignature:"",stallCount:0,fatalExecutionError:""};ctx.intent={...(ctx.intent||{}),execution,visualReviewRequired:currentPromptMeta.visualReview.required};if(isWebAssetAction(text)){const direct=await executeDirectWebAsset(text);if(direct?.object?.id){currentPromptMeta.mutations.push("asset_create");currentPromptMeta.canvasChanged=true;add("assistant",`Нашёл и добавил изображение «${direct.searchItem?.title||direct.query}» на рабочий стол.`,[],{author:activeThread()?.name||providerLabel(provider),provider,source:"asset"});finishResponseProgress("Изображение добавлено");busy=false;patchRetrying=false;currentPromptMeta=null;syncUi();setTimeout(ghostIdle,500);return}activity(`Прямой поиск не завершился: ${direct?.error||"неизвестная ошибка"}. Передаю задачу провайдеру…`)}if(execution!=="chat")'
s=once(s,old,new,'direct asset send branch')
# Stop repeated no-tool answers instead of 10–12 identical attempts.
a=s.index('async function continueExecution(lastText="")'); z=s.index('  async function handleToolRequest',a)
old_cont=s[a:z]
new_cont='async function continueExecution(lastText=""){const meta=currentPromptMeta;if(!meta||meta.execution==="chat"||meta.continuations>=12||meta.toolHops>=12)return false;if(meta.fatalExecutionError){activity(`Остановлено: ${meta.fatalExecutionError}`);return false}const signature=cleanMachineControl(lastText).toLowerCase().replace(/\\s+/g," ").slice(0,900);if(signature&&signature===meta.lastContinuationSignature)meta.stallCount++;else meta.stallCount=0;meta.lastContinuationSignature=signature;const explicitNoTool=/(?:не могу|нет|не доступ|недоступ|отсутств).{0,120}(?:asset_create|module_create|osminog|инструмент|tool|endpoint)|(?:asset_create|module_create).{0,120}(?:не могу|нет|недоступ|отсутств)/i.test(lastText);if(meta.stallCount>=1||(explicitNoTool&&meta.retry>=1)){activity("Остановлено: провайдер повторяет ответ без реального действия.");return false}meta.continuations++;const evidence=meta.mutations.length?`Successful mutations so far: ${meta.mutations.join(", ")}.`:"No required mutation has succeeded yet.";activity(`Продолжаю выполнение · шаг ${meta.continuations+1}…`);const correction=`${executionDirective(meta)}\\n\\n[CONTINUATION ${meta.continuations}/12]\\nOriginal owner request: ${meta.text}\\n${evidence}\\nYour last visible message was: ${String(lastText||"").slice(0,1200)}\\nContinue now. Do not repeat the plan and do not ask the owner to say “continue”.`;const ctx=contextForPrompt(meta.text),providerNow=activeThread()?.provider||"gpt",keysNow=await providerKeys(),response=await chrome.runtime.sendMessage({type:providerMessageType(providerNow,false),payload:{text:correction,context:ctx,images:[],provider:providerNow,apiKey:keysNow[providerNow]||""}});if(!response?.ok)throw new Error(response?.error||"Не удалось продолжить автономный цикл");if(response.payload){await handleResult(response.payload);return true}return false}\n'
s=s[:a]+new_cont+s[z:]
# Errors/results belong to the selected provider, never to a fake second OSMINOG speaker.
s=s.replace('add("assistant",`Задача остановлена без статуса «готово»: ${reason}`,[],{author:"OSMINOG",color:"#ef4444",source:"runtime"});','add("assistant",`Не удалось завершить действие: ${reason}`,[],{author:activeThread()?.name||providerLabel(activeThread()?.provider||"gpt"),provider:activeThread()?.provider||"gpt",color:"#ef4444",source:"error"});')
s=s.replace('else if(review?.passed)add("assistant","Результат применён и прошёл визуальную проверку.",[],{author:"OSMINOG",source:"runtime"});','else if(review?.passed)add("assistant","Результат применён и прошёл визуальную проверку.",[],{author:activeThread()?.name||providerLabel(activeThread()?.provider||"gpt"),provider:activeThread()?.provider||"gpt",source:"result"});')
# Track manual reader scroll before general pointer handling.
s=once(s,'document.addEventListener("pointerdown",e=>{const picker=q("#gptAddAgentPicker");','const messageScroller=q("#gptPresenceMessages");messageScroller?.addEventListener("scroll",()=>{const near=messageScroller.scrollHeight-messageScroller.scrollTop-messageScroller.clientHeight<84;messageScroller.dataset.readerMoved=near?"0":"1"},{passive:true});\n  document.addEventListener("pointerdown",e=>{const picker=q("#gptAddAgentPicker");','reader scroll listener')
write('gpt-presence.js',s)

notes='''# OSMINOG Chrome 3.14.4 — CHAT EXECUTION RECOVERY

- Selected provider is the only visible speaker. OSMINOG progress/runtime events stay in the progress strip.
- Moving response progress again shows elapsed seconds and the chat smart-follows the bottom without fighting manual reading.
- Compact widgets close their whole managed parent when their × is pressed; recreating the same widget closes stale windows first.
- Explicit internet-image-to-desktop commands use a deterministic `web_image_search` → `asset_create` path with real image bytes.
- Repeated no-tool replies stop quickly instead of running a long autonomous retry loop.
- Version badge is rendered from the actual manifest version immediately and desktop-v3 no longer overwrites it with 3.14.1.
- Interface text migrates to Normal by default; Compact and Normal now apply visibly different CSS sizes.
'''
write('RELEASE_NOTES_3.14.4.md',notes)
append_once('OSMINOG_PROJECT_LOG.md','3.14.4 CHAT EXECUTION RECOVERY','''## 2026-09-03 — 3.14.4 CHAT EXECUTION RECOVERY

Live owner testing of 3.14.3 confirmed four regressions: a compact stopwatch could close only its inner UI while the transparent managed parent remained; recreating the widget could fall into repeated autonomous retries; internet image placement could be described by the provider without the real `asset_create`; and OSMINOG progress/runtime messages appeared as a second chat speaker beside the selected provider. The owner also requested the response-progress/elapsed-time and scroll feel preserved by the 3.11.34-era chat, an immediate live version badge, and Normal as the real default interface text size.

3.14.4 keeps the current 3.14 desktop architecture and repairs those execution/UX paths: module close bridges to the managed parent, reinstall closes stale windows, explicit web image placement runs locally through image bytes then `asset_create`, repeated no-tool replies fail fast, progress stays in the single status strip with elapsed seconds, chat bottom-follow is reader-aware, the selected provider is the only message speaker, the version chip reads the manifest immediately, and all four text-size presets apply their variables consistently.
''')
append_once('OSMINOG_ROADMAP.md','3.14.4 chat execution recovery','''### 3.14.4 chat execution recovery
- Preserve the proven 3.11.34-era chat feel: one provider conversation, inline moving progress with elapsed time, stable reader-aware scrolling.
- Never render OSMINOG execution telemetry as a second participant in a provider chat.
- Compact desktop widgets must close their managed parent and be safely recreatable without stale shells.
- Explicit internet image placement must end with a real `asset_create` object, not prose.
- Autonomous retries must stop on repeated no-action/no-tool replies.
- Version badge must always show the running manifest version from first paint.
- Default interface text is Normal; Compact, Normal, Large and Extra Large must be visibly distinct.
''')
write('project-log-archive/2026-09-03-3144-chat-execution-recovery.md',notes)
print('patched 3.14.4')
