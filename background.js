importScripts("sha3.js");

const MENU_ID = "briefcraft-open-selection";
const MENU_TITLES = {
  en:"Add selected text to OSMINOG",
  ru:"Добавить выделенный текст в OSMINOG",
  de:"Markierten Text zu OSMINOG hinzufügen",
  es:"Añadir texto seleccionado a OSMINOG",
  ja:"選択したテキストをOSMINOGに追加",
  zh:"将所选文字添加到 OSMINOG"
};
function currentLanguage() {
  const value = (chrome.i18n.getUILanguage?.() || "en").toLowerCase();
  return ["ru","de","es","ja","zh"].find((code) => value.startsWith(code)) || "en";
}
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({id:MENU_ID,title:MENU_TITLES[currentLanguage()],contexts:["selection"]});
  });
}
chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.contextMenus.onClicked.addListener(async(info) => {
  if (info.menuItemId !== MENU_ID) return;
  await chrome.storage.local.set({richCraftPendingText:info.selectionText || "",richCraftPendingAt:Date.now()});
  await chrome.tabs.create({url:chrome.runtime.getURL("editor.html?import=selection")});
});
chrome.runtime.onMessage.addListener((message,_sender,sendResponse) => {
  if (!message) return;
  if (["OPEN_EDITOR","OPEN_SCREENSHOT"].includes(message.type)) {
    const page = message.type === "OPEN_SCREENSHOT" ? "screenshot.html" : "editor.html";
    chrome.tabs.create({url:chrome.runtime.getURL(message.query ? page + "?" + message.query : page)})
      .then(() => sendResponse({ok:true}))
      .catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  }
});

// OSMINOG 3.8.18 · full project memory + PDF + owner Jarvis.
// No ChatGPT tab/window is ever created. Text turns use Temporary Chat
// (history_and_training_disabled=true) and are hidden defensively after completion.
const BC_BASE="https://chatgpt.com";
const BC_SESSION_URL=`${BC_BASE}/api/auth/session`;
const BC_REQUIREMENTS_URL=`${BC_BASE}/backend-api/sentinel/chat-requirements`;
const BC_MODELS_URL=`${BC_BASE}/backend-api/models?history_and_training_disabled=true`;
const BC_CONVERSATION_URLS=[`${BC_BASE}/backend-api/f/conversation`,`${BC_BASE}/backend-api/conversation`];
const BC_FILES_URL=`${BC_BASE}/backend-api/files`;
const BC_ENABLE_KEY="briefCraftGptLiteEnabledV1";
const BC_NAV_KEYS=["webdriver−false","geolocation","languages","language","platform","userAgent","vendor","hardwareConcurrency","deviceMemory","permissions","plugins","mediaDevices"];
const BC_DOC_KEYS=["_reactListeningkfj3eavmks","_reactListeningo743lnnpvdg","location","scrollingElement","documentElement"];
const BC_WIN_KEYS=["webpackChunk_N_E","__NEXT_DATA__","chrome","history","screen","navigation","scrollX","scrollY"];
let bcDirectContext=null;
let bcDplCache=null;
const bcThreads=new Map();

const bcSleep=ms=>new Promise(r=>setTimeout(r,ms));
const bcPick=a=>a[Math.floor(Math.random()*a.length)];
const bcUuid=()=>crypto.randomUUID?.()||`bc-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
function bcBase64(text){
  const bytes=new TextEncoder().encode(String(text));let bin="";const step=0x8000;
  for(let i=0;i<bytes.length;i+=step)bin+=String.fromCharCode(...bytes.subarray(i,i+step));
  return btoa(bin);
}
function bcErrText(v){return String(v||"").replace(/\s+/g," ").slice(0,360)}

async function bcGetSession(){
  const started=Date.now();
  try{
    const response=await fetch(BC_SESSION_URL,{method:"GET",credentials:"include",cache:"no-store",redirect:"follow",headers:{accept:"application/json,text/plain,*/*"}});
    const contentType=response.headers.get("content-type")||"";let data=null,text="";
    try{if(contentType.includes("application/json"))data=await response.json();else text=await response.text()}catch{}
    const accessToken=(data&&typeof data.accessToken==="string")?data.accessToken:"";
    const accountId=data?.account?.id||data?.activeAccount?.id||data?.user?.account_id||data?.user?.accountId||"";
    return {ok:response.ok&&accessToken.length>40,httpStatus:response.status,accessToken,accountId,hasUser:!!data?.user,data,elapsedMs:Date.now()-started,bodyHint:response.ok?"":bcErrText(text)};
  }catch(error){return {ok:false,httpStatus:0,accessToken:"",accountId:"",elapsedMs:Date.now()-started,error:error?.message||String(error)}}
}
async function bcJsonFetch(url,{method="GET",accessToken,body,headers={}}={}){
  const started=Date.now();
  try{
    const response=await fetch(url,{method,credentials:"include",cache:"no-store",redirect:"follow",headers:{accept:"application/json,text/plain,*/*",...(body!==undefined?{"content-type":"application/json"}:{}),...(accessToken?{Authorization:`Bearer ${accessToken}`}:{ }),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const contentType=response.headers.get("content-type")||"";let data=null,text="";
    try{if(contentType.includes("application/json"))data=await response.json();else text=await response.text()}catch{}
    return {ok:response.ok,httpStatus:response.status,data,text,contentType,elapsedMs:Date.now()-started,bodyHint:response.ok?"":bcErrText(text||JSON.stringify(data||{}))};
  }catch(error){return {ok:false,httpStatus:0,data:null,text:"",elapsedMs:Date.now()-started,error:error?.message||String(error)}}
}
async function bcGetDpl(){
  if(bcDplCache&&Date.now()<bcDplCache.expiresAt)return bcDplCache;
  let dpl="",scriptSrc="";
  try{
    const r=await fetch(`${BC_BASE}/`,{method:"GET",credentials:"include",cache:"no-store",redirect:"follow",headers:{accept:"text/html,application/xhtml+xml,*/*"}});
    const html=await r.text();
    const dm=html.match(/data-build=["']([^"']+)["']/i);if(dm)dpl=`dpl=${dm[1]}`;
    const sm=html.match(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/i);
    if(sm){scriptSrc=sm[1];if(scriptSrc.startsWith("/"))scriptSrc=BC_BASE+scriptSrc;}
  }catch{}
  if(!dpl)dpl="dpl=prod";
  if(!scriptSrc)scriptSrc=`${BC_BASE}/_next/static/chunks/webpack.js`;
  bcDplCache={dpl,scriptSrc,expiresAt:Date.now()+60*60*1000};return bcDplCache;
}
function bcPowConfig(dplInfo,legacy=false){
  const ua=navigator.userAgent||"Mozilla/5.0";
  if(legacy){
    const cores=bcPick([1,2,4,8]);
    return [bcPick([3008,4010,6000])+cores,new Date().toString(),4294705152,0,ua,dplInfo.scriptSrc,dplInfo.dpl,"en-US","en-US",4294705152,"plugins−[object PluginArray]",bcPick(BC_DOC_KEYS),bcPick(["alert","ontransitionend","onprogress"])];
  }
  const perf=performance.now();
  return [bcPick([3000,4000,3120,4160]),new Date().toString(),4294705152,0,ua,dplInfo.scriptSrc,dplInfo.dpl,"en-US","en-US,en",0,bcPick(BC_NAV_KEYS),bcPick(BC_DOC_KEYS),bcPick(BC_WIN_KEYS),perf,bcUuid(),"",bcPick([8,16,24,32]),Date.now()-perf];
}
async function bcSolvePow(seed,difficulty,dplInfo,{legacy=false,maxIter=300000}={}){
  const started=Date.now();const target=String(difficulty||"").toLowerCase();
  if(!seed||!target)throw new Error("PoW seed/difficulty отсутствуют");
  const cfg=bcPowConfig(dplInfo,legacy);const sha3=globalThis.BriefCraftSHA3?.sha3_512Hex;
  if(typeof sha3!=="function")throw new Error("SHA3-512 solver не загружен");
  for(let i=0;i<maxIter;i++){
    cfg[3]=i;const b64=bcBase64(JSON.stringify(cfg));const hash=sha3(String(seed)+b64);
    if(hash.slice(0,target.length)<=target)return {token:"gAAAAAB"+b64,iterations:i+1,elapsedMs:Date.now()-started,legacy};
    if(i&&i%250===0)await bcSleep(0);
  }
  throw new Error(`PoW не найден за ${maxIter} итераций`);
}
async function bcGetRequirements(accessToken){
  return bcJsonFetch(BC_REQUIREMENTS_URL,{method:"POST",accessToken});
}
async function bcProbe(){
  const total=Date.now();const session=await bcGetSession();
  if(!session.ok)return {ok:false,stage:"session",httpStatus:session.httpStatus||0,error:session.error||session.bodyHint||"ChatGPT session unavailable",elapsedMs:Date.now()-total};
  const [models,requirements,accountCheck]=await Promise.all([
    bcJsonFetch(BC_MODELS_URL,{accessToken:session.accessToken}),bcGetRequirements(session.accessToken),bcJsonFetch(`${BC_BASE}/backend-api/accounts/check/v4-2023-04-27`,{accessToken:session.accessToken})
  ]);
  const list=Array.isArray(models.data?.models)?models.data.models:[];const req=requirements.data||{};const reqToken=typeof req.token==="string"?req.token:"";
  return {ok:session.ok&&models.ok&&requirements.ok&&!!reqToken,stage:!models.ok?"models":(!requirements.ok?"requirements":(!reqToken?"requirements-token":"ready")),httpStatus:session.httpStatus,modelsStatus:models.httpStatus,modelCount:list.length,modelSlugs:list.slice(0,20).map(m=>m?.slug||m?.id||m?.title).filter(Boolean),requirementsStatus:requirements.httpStatus,hasRequirementsToken:!!reqToken,proofOfWorkRequired:!!req.proofofwork?.required,proofDifficulty:req.proofofwork?.difficulty||null,arkoseRequired:!!req.arkose?.required,websocket:/shared_websocket/i.test(JSON.stringify(accountCheck.data||{})),elapsedMs:Date.now()-total,error:(!models.ok?(models.error||models.bodyHint):(!requirements.ok?(requirements.error||requirements.bodyHint):""))||""};
}
function bcMachineInstructions(context={}){
  const mode=context?.intent?.execution||(context?.intent?.edit?"canvas":"chat");
  if(mode==="app")return [
    "OSMINOG Workspace App Runtime is active.",
    "Build the requested working application now as one complete standalone HTML document with all CSS and JavaScript inline.",
    "Return the document in one fenced html block. Do not return osminog.patch/v1 and do not ask for module_create: OSMINOG itself installs and verifies the result. Common widgets may be created directly by the host before this prompt is even needed.",
    "For compact utilities such as a stopwatch, timer, clock, alarm, calculator, counter or weather widget, design only the compact widget itself: html/body must be transparent, with no full-page white card, viewport-sized shell, page background, or surrounding application canvas. Let the widget content define its intrinsic size.",
    "Honor attached reference images and the owner's functional requirements. For compact desktop utilities use a transparent page/root with no outer browser/window card; a visible close control must call OSMINOG.close() or use data-osminog-close. Prefer a usable compact product over a mockup or plan.",
    "Do not claim that installation already happened; the runtime verifies it after your response. Do not expose hidden chain-of-thought."
  ].join(" ");
  if(mode==="source")return [
    "OSMINOG Product Source Executor is active.",
    "The owner is changing the OSMINOG product itself, not drawing a mockup on the canvas.",
    "Inspect the canonical private repository jeep-jim/OSMINOG with github_status, github_list_tree/search_code and github_fetch_file, then make the real source change with github_commit_files. A selected local folder is optional and must never block the edit.",
    "Do not use osminog.patch/v1 or loose canvas objects as a substitute for a product UI/source change. Preserve unrelated behavior and verify the edited source before claiming completion.",
    "Do not stop at a plan or explanation. Completion requires a successful source mutation or a concrete blocker that genuinely requires the owner. Do not expose hidden chain-of-thought."
  ].join(" ");
  if(mode==="canvas")return [
    "OSMINOG Canvas Executor is active.",
    "Perform the requested canvas change now; do not answer with a plan, promise, status sentence, or preliminary explanation.",
    "Return exactly one machine-only JSON block with protocol osminog.patch/v1 in this first answer. The block must contain real create/set/delete/connect/disconnect actions.",
    "Use existing IDs only for set/delete/connect/disconnect. New editable objects must use create actions with explicit numeric x,y,w,h.",
    "If essential project data is missing, return exactly one osminog.request/v1 block instead, then produce the patch immediately after the tool result. For a requested internet image/file, request web_search if needed and then asset_create; its real object.id is completion and no decorative patch is required.",
    "A natural-language sentence is optional, but it never counts as completion without a valid patch or a successful asset_create object. Do not expose hidden chain-of-thought."
  ].join(" ");
  const owner=context?.capabilities?.mode==="owner-max"||context?.externalAccess?.mode==="owner-max"||context?.capabilities?.poseidon?.verified===true;
  return [
    "OSMINOG Browser Presence is connected.",
    "Treat OSMINOG object and connection IDs from the attached compact context as ground truth; never invent an existing ID.",
    "Answer the user's natural-language request normally.",
    `${owner?"You are connected to OSMINOG Owner Max Access.":"You are connected to OSMINOG Interactive Workspace Access. Product source and release mutations are owner-only and must not be claimed unless owner-max is present."} Use osminog.request/v1 tool calls whenever the task needs real project data or an action. You may use up to 8 calls per tool hop and continue through as many as 12 consecutive hops after results. Never stop at a plan, promise, or status message when the user requested an action: continue until a required mutation succeeds or a concrete blocker requires the user. Show only concise progress, not hidden chain-of-thought. Supported interactive tools include canvas read/write, graphics_status/graphics_create/graphics_edit/graphics_open, assets, files, apps/modules, browser, projects, agents and media. Owner-max additionally exposes product source/GitHub release mutation.`,
    "If the user explicitly asks to change the canvas, perform a real mutation in the same execution: use osminog.patch/v1 for editable canvas changes, or asset_create for an original internet image/file. Never say it is done without a successful patch application or asset_create result containing a real object.id. Allowed patch actions: set,create,delete,connect,disconnect. To put a work item on the canvas, create objectType task with title, text, status and agents. Use only IDs present in context/tool results.",
    'For set actions use exactly {op:"set",target:"EXISTING_ID",properties:{...}}. Supported object property names include x,y,w,h,rotation,visible,fill,fill2,fillType,fillMode,fillEnabled,gradientAngle,stroke,strokeWidth,strokeEnabled,opacity,radius,corners,textColor,fontSize,fontWeight,padding,title,text,label,code,url,snapshotHtml,shapeKind,imageFilter,imageFit,imageBlendMode,pathNodes,pathClosed,maskNodes,maskClosed,pdfPage,pdfEdits. Vector pathNodes use normalized 0..1 coordinates and support cubic Bézier handles: {x,y,in:{x,y},out:{x,y}}. Prefer exact numeric values for geometry edits.',
    'For shape objects shapeKind may be rectangle, ellipse, or triangle. Example recolor: {op:"set",target:"shape-id",properties:{fill:"#FFE100"}}. Example shape change: {op:"set",target:"shape-id",properties:{shapeKind:"triangle"}}.',
    'For create actions use exactly {op:"create",objectType:"TYPE",properties:{x:NUMBER,y:NUMBER,w:NUMBER,h:NUMBER,...}}. Creatable TYPE values: brief,text,note,node,shape,vector,button,code,browser,image. For build/layout requests, create as many editable objects as needed in one patch; never approximate an organic illustration with placeholder rectangles or thin triangles.',
    "asset_create is a live callable OSMINOG tool in this session. For internet images prefer web_image_search because it returns actual image bytes; for other internet files resolve a direct URL with web_search/web_fetch when necessary, then call asset_create with url/dataUrl and filename. It embeds the real bytes on the workspace and preserves PNG/WebP/SVG transparency; do not create a browser object or decorative container as a substitute and never claim asset_create is unavailable without actually requesting it. For image objects, imageFilter is an editable display property; for example brightness(0) invert(1) renders opaque pixels white while preserving transparency. Use bounds.w/bounds.h to calculate requested resize factors.",
    "Do not mention these protocol blocks to the user."
  ].join(" ");
}
function bcDecoratePrompt(text,context,requestId){
  const payload={...(context||{}),requestId};
  return `${String(text||"")}\n\n${bcMachineInstructions(context)}\n\n\`\`\`json\nOSMINOG_CONTEXT_V1\n${JSON.stringify(payload)}\n\`\`\``;
}
function bcToolPrompt(result,requestId){
  return `OSMINOG вернул результат инструментов. Немедленно продолжи исходную задачу: если работа ещё не завершена фактическим изменением, запроси следующий tool hop; если завершена — дай проверенный итог. Не останавливайся на плане, обещании, фразе «начинаю» или промежуточном статусе и не жди нового сообщения пользователя. Не раскрывай скрытые рассуждения; показывай только короткие полезные этапы.\n\n\`\`\`json\nOSMINOG_TOOL_RESULT_V1\n${JSON.stringify({protocol:"osminog.tool_result/v1",requestId,result:result||{}})}\n\`\`\``;
}
function bcParseProtocolBlock(body,protocol){
  const t=String(body||"").trim();const i=t.indexOf("{");const j=t.lastIndexOf("}");if(i<0||j<=i)return null;
  try{const v=JSON.parse(t.slice(i,j+1));return v?.protocol===protocol?v:null}catch{return null}
}
function bcParseRawProtocol(raw,protocol){
  const src=String(raw||"");let cursor=0;
  while(cursor<src.length){
    const hit=src.indexOf(protocol,cursor);if(hit<0)return null;
    const start=src.lastIndexOf("{",hit);if(start<0){cursor=hit+protocol.length;continue}
    let depth=0,inString=false,escaped=false;
    for(let i=start;i<src.length;i++){const ch=src[i];
      if(inString){if(escaped){escaped=false;continue}if(ch==="\\"){escaped=true;continue}if(ch==='"')inString=false;continue}
      if(ch==='"'){inString=true;continue}if(ch==="{")depth++;else if(ch==="}"){depth--;if(depth===0){const body=src.slice(start,i+1);try{const value=JSON.parse(body);if(value?.protocol===protocol)return{value,raw:body}}catch{}break}}
    }
    cursor=hit+protocol.length;
  }
  return null;
}
function bcParseAssistant(raw){
  let request=null,patch=null;const machineBlocks=[];const source=String(raw||"").replaceAll("briefcraft.request/v1","osminog.request/v1").replaceAll("briefcraft.patch/v1","osminog.patch/v1");const re=/```(?:json)?\s*([\s\S]*?)```/gi;let m;
  while((m=re.exec(source))){const body=m[1]||"";let machine=false;
    if(body.includes("osminog.request/v1")){request=request||bcParseProtocolBlock(body,"osminog.request/v1");machine=true;}
    if(body.includes("osminog.patch/v1")){patch=patch||bcParseProtocolBlock(body,"osminog.patch/v1");machine=true;}
    if(machine)machineBlocks.push(m[0]);
  }
  if(!request){const rawRequest=bcParseRawProtocol(source,"osminog.request/v1");if(rawRequest){request=rawRequest.value;machineBlocks.push(rawRequest.raw)}}
  if(!patch){const rawPatch=bcParseRawProtocol(source,"osminog.patch/v1");if(rawPatch){patch=rawPatch.value;machineBlocks.push(rawPatch.raw)}}
  let text=source;for(const block of [...new Set(machineBlocks)])text=text.replace(block,"");text=text.trim();
  return {text,request,patch};
}
function bcThreadKey(context){return `${context?.project?.id||"default"}::${context?.chat?.threadId||"main"}`}
function bcThread(context){const key=bcThreadKey(context);if(!bcThreads.has(key))bcThreads.set(key,{conversationId:null,parentMessageId:bcUuid()});return bcThreads.get(key)}
function bcModelFromList(list){
  const slugs=(Array.isArray(list)?list:[]).map(m=>typeof m==="string"?m:(m?.slug||m?.id||"")).filter(Boolean);
  for(const p of ["auto","gpt-5","gpt-5-1","gpt-5-2","gpt-5-3","gpt-5-4","gpt-5-5"])if(slugs.includes(p))return p;
  return slugs[0]||"auto";
}
function bcConversationBody(prompt,thread,model,attachments=[]){
  const id=bcUuid(),textPart=String(prompt||""),images=attachments.filter(a=>a.is_image);
  const content=images.length?{content_type:"multimodal_text",parts:[...images.map(img=>({asset_pointer:`file-service://${img.file_id}`,height:img.height||undefined,size_bytes:img.file_size||undefined,width:img.width||undefined})),textPart]}:{content_type:"text",parts:[textPart]};
  const message={id,author:{role:"user"},content};
  if(attachments.length)message.metadata={attachments:attachments.map(a=>({id:a.file_id,mimeType:a.mime_type,name:a.file_name,size:a.file_size,...(a.width&&a.height?{width:a.width,height:a.height}:{})}))};
  return {action:"next",messages:[message],model:model||"auto",conversation_id:thread.conversationId||null,parent_message_id:thread.parentMessageId||bcUuid(),timezone_offset_min:-new Date().getTimezoneOffset(),history_and_training_disabled:true,suggestions:[],websocket_request_id:bcUuid(),conversation_mode:{kind:"primary_assistant"},supports_buffering:true,force_parallel_switch:"auto",paragen_cot_summary_display_override:"allow"};
}
function bcParseSse(text){
  let answer="",conversationId=null,parentMessageId=null,lastError="";
  const lines=String(text||"").split(/\r?\n/);
  for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;let data;try{data=JSON.parse(raw)}catch{continue}
    if(data?.conversation_id)conversationId=data.conversation_id;
    if(data?.error){lastError=typeof data.error==="string"?data.error:(data.error.message||data.error.code||JSON.stringify(data.error));}
    const msg=data?.message;if(!msg)continue;if(msg.id)parentMessageId=msg.id;
    if(msg?.author?.role!=="assistant")continue;
    const parts=msg?.content?.parts;if(Array.isArray(parts)){
      const strings=parts.filter(p=>typeof p==="string");if(strings.length)answer=strings.join("\n");
    }
  }
  return {answer:answer.trim(),conversationId,parentMessageId,lastError};
}
async function bcHideConversation(accessToken,conversationId){
  if(!conversationId)return;
  try{await bcJsonFetch(`${BC_BASE}/backend-api/conversation/${conversationId}`,{method:"PATCH",accessToken,body:{is_visible:false}})}catch{}
}

function bcDecodeDataUrl(dataUrl){const m=String(dataUrl||"").match(/^data:([^;]+);base64,([\s\S]+)$/i);if(!m)throw new Error("Некорректное изображение");const bin=atob(m[2]);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return {mime:m[1].toLowerCase(),bytes}}
function bcImageSize(bytes,mime){try{if(mime==="image/png"&&bytes.length>=24){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return {width:v.getUint32(16),height:v.getUint32(20)}}if(mime==="image/gif"&&bytes.length>=10){return {width:bytes[6]|bytes[7]<<8,height:bytes[8]|bytes[9]<<8}}if(mime==="image/jpeg"){let i=2;while(i+9<bytes.length){if(bytes[i]!==0xff){i++;continue}const marker=bytes[i+1];i+=2;if(marker===0xd8||marker===0xd9)continue;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;if(i+2>bytes.length)break;const len=(bytes[i]<<8)|bytes[i+1];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&i+7<=bytes.length)return {height:(bytes[i+3]<<8)|bytes[i+4],width:(bytes[i+5]<<8)|bytes[i+6]};i+=len}}if(mime==="image/webp"&&bytes.length>=30&&String.fromCharCode(...bytes.slice(12,16))==="VP8X"){return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)}}}catch{}return {width:null,height:null}}
async function bcUploadAttachment(accessToken,item){const decoded=bcDecodeDataUrl(item.dataUrl),isImage=["image/png","image/jpeg","image/gif","image/webp"].includes(decoded.mime),isPdf=decoded.mime==="application/pdf";if(!isImage&&!isPdf)throw new Error(`Вложение ${decoded.mime} пока не поддерживается прямой загрузкой`);const size=isImage?bcImageSize(decoded.bytes,decoded.mime):{width:null,height:null};const ext=isPdf?"pdf":(decoded.mime.split("/")[1]||"bin"),name=String(item.name||`briefcraft-${Date.now()}.${ext}`);const create=await bcJsonFetch(BC_FILES_URL,{method:"POST",accessToken,body:{file_name:name,file_size:decoded.bytes.byteLength,use_case:isImage?"multimodal":"my_files",mime_type:decoded.mime,store_in_library:!isImage,library_persistence_mode:!isImage?"opportunistic":undefined}});if(!create.ok)throw new Error(`file create HTTP ${create.httpStatus}: ${create.error||create.bodyHint||"failed"}`);const uploadUrl=create.data?.upload_url,fileId=create.data?.file_id;if(!uploadUrl||!fileId)throw new Error("ChatGPT не вернул upload_url/file_id");const upload=await fetch(uploadUrl,{method:"PUT",body:decoded.bytes,headers:{"content-type":decoded.mime,"x-ms-blob-type":"BlockBlob","x-ms-version":"2020-04-08","accept":"application/json, text/plain, */*"}});if(!upload.ok)throw new Error(`file upload HTTP ${upload.status}`);const fin=await bcJsonFetch(`${BC_FILES_URL}/${fileId}/uploaded`,{method:"POST",accessToken,body:{}});if(!fin.ok)throw new Error(`file finalize HTTP ${fin.httpStatus}`);return {file_id:fileId,file_name:name,file_size:decoded.bytes.byteLength,mime_type:decoded.mime,width:size.width,height:size.height,is_image:isImage}}
async function bcUploadAttachments(accessToken,items){const out=[];for(const item of (Array.isArray(items)?items:[]).slice(0,6))out.push(await bcUploadAttachment(accessToken,item));return out}

async function bcConversationFetch(accessToken,reqToken,proofToken,body,accountId=""){
  const headers={accept:"text/event-stream",Authorization:`Bearer ${accessToken}`,"content-type":"application/json","Openai-Sentinel-Chat-Requirements-Token":reqToken,"Openai-Sentinel-Proof-Token":proofToken,"Oai-Language":"ru-RU","Oai-Session-Id":bcUuid(),...(accountId?{"chatgpt-account-id":accountId}:{})};
  let last=null;
  for(const url of BC_CONVERSATION_URLS){
    try{
      const response=await fetch(url,{method:"POST",credentials:"include",cache:"no-store",redirect:"follow",headers,body:JSON.stringify(body)});
      const text=await response.text();const result={ok:response.ok,httpStatus:response.status,url,text,bodyHint:response.ok?"":bcErrText(text)};
      if(response.status===404||response.status===405){last=result;continue}
      return result;
    }catch(error){last={ok:false,httpStatus:0,url,error:error?.message||String(error),text:""}}
  }
  return last||{ok:false,httpStatus:0,error:"conversation endpoint unavailable",text:""};
}
async function bcSendDirect({text,context,requestId,toolResult,images}){
  const started=Date.now();const session=await bcGetSession();if(!session.ok)throw new Error(`ChatGPT session ${session.httpStatus||0}: ${session.error||session.bodyHint||"нет accessToken"}`);
  const models=await bcJsonFetch(BC_MODELS_URL,{accessToken:session.accessToken});const model=bcModelFromList(models.data?.models||[]);
  const requirements=await bcGetRequirements(session.accessToken);if(!requirements.ok)throw new Error(`chat-requirements HTTP ${requirements.httpStatus}: ${requirements.error||requirements.bodyHint||"blocked"}`);
  const req=requirements.data||{};const reqToken=typeof req.token==="string"?req.token:"";if(!reqToken)throw new Error("chat-requirements token не найден");
  if(req.arkose?.required)throw new Error("Arkose внезапно стал обязателен для этого запроса; отправка остановлена без создания чата.");
  const dpl=await bcGetDpl();let pow={token:"",iterations:0,elapsedMs:0,legacy:false};
  if(req.proofofwork?.required)pow=await bcSolvePow(req.proofofwork.seed,req.proofofwork.difficulty,dpl,{legacy:false,maxIter:300000});
  const thread=bcThread(context);const prompt=toolResult?bcToolPrompt(toolResult,requestId):bcDecoratePrompt(text,context,requestId);const uploadedAttachments=await bcUploadAttachments(session.accessToken,images||[]);const body=bcConversationBody(prompt,thread,model,uploadedAttachments);
  let conv=await bcConversationFetch(session.accessToken,reqToken,pow.token,body,session.accountId);
  // One conservative compatibility retry with the legacy fingerprint shape only when
  // Sentinel rejects the modern proof. Both attempts remain Temporary Chat.
  if(!conv.ok&&req.proofofwork?.required&&[401,403].includes(conv.httpStatus)){
    const requirements2=await bcGetRequirements(session.accessToken);const req2=requirements2.data||{};if(requirements2.ok&&req2.token&&!req2.arkose?.required&&req2.proofofwork?.required){
      pow=await bcSolvePow(req2.proofofwork.seed,req2.proofofwork.difficulty,dpl,{legacy:true,maxIter:220000});
      conv=await bcConversationFetch(session.accessToken,req2.token,pow.token,body,session.accountId);
    }
  }
  if(!conv.ok)throw new Error(`conversation HTTP ${conv.httpStatus||0}: ${conv.error||conv.bodyHint||"request failed"}`);
  const parsed=bcParseSse(conv.text);if(parsed.lastError)throw new Error(parsed.lastError);
  if(parsed.conversationId)thread.conversationId=parsed.conversationId;if(parsed.parentMessageId)thread.parentMessageId=parsed.parentMessageId;
  bcHideConversation(session.accessToken,thread.conversationId).catch(()=>{});
  if(!parsed.answer)throw new Error("GPT ответил без текстового сообщения (SSE пустой)");
  const payload=bcParseAssistant(parsed.answer);
  return {ok:true,requestId,payload:{requestId,...payload},diag:{model,endpoint:conv.url?.includes("/f/")?"f/conversation":"conversation",powRequired:!!req.proofofwork?.required,powIterations:pow.iterations,powMs:pow.elapsedMs,powLegacy:pow.legacy,totalMs:Date.now()-started,conversationHidden:true,imageCount:uploadedAttachments.filter(a=>a.is_image).length,attachmentCount:uploadedAttachments.length}};
}

function bcHtmlDecode(text){return String(text||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)||32))}
function bcStripHtml(html,max=30000){return bcHtmlDecode(String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()).slice(0,max)}
async function bcWebSearch(query,limit=8){const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,res=await fetch(url,{cache:"no-store"});if(!res.ok)throw new Error(`Search HTTP ${res.status}`);const html=await res.text(),blocks=html.split(/class=["']result(?:\s|["'])/i).slice(1),results=[];for(const block of blocks){const am=block.match(/class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);if(!am)continue;let href=bcHtmlDecode(am[1]);try{const u=new URL(href,"https://duckduckgo.com");const real=u.searchParams.get("uddg");if(real)href=decodeURIComponent(real)}catch{}const sm=block.match(/class=["']result__snippet["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);results.push({title:bcStripHtml(am[2],500),url:href,snippet:sm?bcStripHtml(sm[1],900):""});if(results.length>=limit)break}return{ok:true,query,results,source:"DuckDuckGo HTML"}}

async function bcWebImageSearch(query,limit=6){
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
async function bcWebFetch(url,maxChars=16000){const res=await fetch(url,{cache:"no-store",redirect:"follow"});if(!res.ok)throw new Error(`Fetch HTTP ${res.status}`);const type=(res.headers.get("content-type")||"").toLowerCase();if(type.includes("application/pdf"))return{ok:true,url:res.url||url,contentType:type,error:"PDF webpage fetch is binary; attach the PDF canvas object directly instead."};const raw=await res.text(),text=type.includes("html")?bcStripHtml(raw,maxChars):raw.slice(0,maxChars);return{ok:true,url:res.url||url,contentType:type,title:(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/<[^>]+>/g,"").trim(),text,chars:text.length}}


const BC_PROVIDER_HISTORY=new Map();
let bcExternalTabId=null,bcExternalRole="view";
function bcProviderHistoryKey(context,provider){return `${provider}:${context?.project?.id||"none"}:${context?.chat?.threadId||"main"}`}
function bcProviderSystem(){return "You are an AI participant inside OSMINOG. Use object IDs and the compact canvas map as ground truth. If you need more canvas data, return one osminog.request/v1 machine JSON block. If the user asks to change the canvas, return osminog.patch/v1. Never invent IDs or claim an edit happened without a patch."}
async function bcGeminiSend(text,context,apiKey,toolResult=null,requestId=""){if(!apiKey)throw new Error("Gemini API key отсутствует");const key=bcProviderHistoryKey(context,"gemini"),hist=BC_PROVIDER_HISTORY.get(key)||[],rid=requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,prompt=toolResult?bcToolPrompt(toolResult,rid):bcDecoratePrompt(text,context,rid),contents=[...hist.slice(-10),{role:"user",parts:[{text:prompt}]}];const res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({systemInstruction:{parts:[{text:bcProviderSystem()}]},contents,generationConfig:{temperature:.25,maxOutputTokens:8192}})});const raw=await res.text();if(!res.ok)throw new Error(`Gemini HTTP ${res.status}: ${bcErrText(raw)}`);let data;try{data=JSON.parse(raw)}catch{throw new Error("Gemini вернул не-JSON ответ")};const answer=(data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||"").join("\n").trim();if(!answer)throw new Error("Gemini вернул пустой ответ");contents.push({role:"model",parts:[{text:answer}]});BC_PROVIDER_HISTORY.set(key,contents.slice(-12));return{rid,answer}}
async function bcClaudeSend(text,context,apiKey,toolResult=null,requestId=""){if(!apiKey)throw new Error("Claude API key отсутствует");const key=bcProviderHistoryKey(context,"claude"),hist=BC_PROVIDER_HISTORY.get(key)||[],rid=requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,prompt=toolResult?bcToolPrompt(toolResult,rid):bcDecoratePrompt(text,context,rid),messages=[...hist.slice(-10),{role:"user",content:prompt}];const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:8192,temperature:.2,system:bcProviderSystem(),messages})});const raw=await res.text();if(!res.ok)throw new Error(`Claude HTTP ${res.status}: ${bcErrText(raw)}`);let data;try{data=JSON.parse(raw)}catch{throw new Error("Claude вернул не-JSON ответ")};const answer=(data.content||[]).filter(x=>x.type==="text").map(x=>x.text||"").join("\n").trim();if(!answer)throw new Error("Claude вернул пустой ответ");messages.push({role:"assistant",content:answer});BC_PROVIDER_HISTORY.set(key,messages.slice(-12));return{rid,answer}}
async function bcDeepSeekSend(text,context,apiKey,toolResult=null,requestId=""){if(!apiKey)throw new Error("DeepSeek API key отсутствует");const key=bcProviderHistoryKey(context,"deepseek"),hist=BC_PROVIDER_HISTORY.get(key)||[],rid=requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,prompt=toolResult?bcToolPrompt(toolResult,rid):bcDecoratePrompt(text,context,rid),messages=[{role:"system",content:bcProviderSystem()},...hist.slice(-10),{role:"user",content:prompt}];const res=await fetch("https://api.deepseek.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:"deepseek-chat",messages,stream:false})});const raw=await res.text();if(!res.ok)throw new Error(`DeepSeek HTTP ${res.status}: ${bcErrText(raw)}`);let data;try{data=JSON.parse(raw)}catch{throw new Error("DeepSeek вернул не-JSON ответ")};const answer=String(data.choices?.[0]?.message?.content||"").trim();if(!answer)throw new Error("DeepSeek вернул пустой ответ");messages.push({role:"assistant",content:answer});BC_PROVIDER_HISTORY.set(key,messages.filter(x=>x.role!=="system").slice(-12));return{rid,answer}}
const BC_PROVIDER_TAB_LINKS_KEY="briefCraftProviderTabLinksV1",BC_CUSTOM_PROVIDER_KEY="briefCraftCustomProviderV1";
const BC_PROVIDER_TAB_PATTERNS={gpt:["https://chatgpt.com/*","https://chat.openai.com/*"],deepseek:["https://chat.deepseek.com/*","https://www.deepseek.com/*"],claude:["https://claude.ai/*"],gemini:["https://gemini.google.com/*"],googleai:["https://www.google.com/*","https://google.com/*"],"nano-banana":["https://gemini.google.com/*"]};
async function bcProviderLinks(){return (await chrome.storage.local.get(BC_PROVIDER_TAB_LINKS_KEY))?.[BC_PROVIDER_TAB_LINKS_KEY]||{}}
async function bcSaveProviderLinks(v){await chrome.storage.local.set({[BC_PROVIDER_TAB_LINKS_KEY]:v})}
function bcGoogleAiTab(tab){try{const u=new URL(tab?.url||"");return /(^|\.)google\.com$/i.test(u.hostname)&&(/\/ai\/?$/i.test(u.pathname)||(u.pathname==="/search"&&(u.searchParams.get("udm")==="50"||/AI Mode|Режим ИИ/i.test(tab?.title||""))))}catch{return false}}
function bcProviderTransport(provider=""){provider=osminogProviderKey(provider);return provider==="nano-banana"?"gemini":provider}
function bcProviderPatterns(provider=""){provider=osminogProviderKey(provider);const explicit=BC_PROVIDER_TAB_PATTERNS[provider];if(explicit?.length)return explicit;const url=OSMINOG_PROVIDER_URLS?.[provider]||"";try{return [`${new URL(url).origin}/*`]}catch{return[]}}
function bcProviderMatchesUrl(provider,url=""){provider=osminogProviderKey(provider);if(provider==="googleai")return bcGoogleAiTab({url});try{const target=new URL(url),patterns=bcProviderPatterns(provider);return patterns.some(pattern=>{const origin=new URL(pattern.replace(/\*.*$/,"")).origin;return target.origin===origin})}catch{return false}}
async function bcFindProviderTab(provider){provider=osminogProviderKey(provider);const patterns=bcProviderPatterns(provider);if(!patterns.length)return null;let tabs=await chrome.tabs.query({url:patterns});if(provider==="googleai")tabs=tabs.filter(bcGoogleAiTab);if(!tabs?.length)return null;return tabs.find(t=>t.active)||[...tabs].sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0]||tabs[0]}
async function bcInjectProviderBridge(tab,provider){let last="",lastProbe=null;for(let attempt=0;attempt<3;attempt++){try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:["provider-tab-bridge.js"]})}catch(e){last=e?.message||String(e)}for(let i=0;i<10;i++){await bcSleep(120+i*35);const pong=await chrome.tabs.sendMessage(tab.id,{type:"BC_PROVIDER_TAB_CONFIG",provider}).catch(e=>({ok:false,error:e?.message||String(e)}));if(pong?.bridge)lastProbe=pong;if(pong?.ok){const probe=await chrome.tabs.sendMessage(tab.id,{type:"BC_PROVIDER_TAB_PROBE"}).catch(()=>pong);return{ok:true,...pong,probe}}last=pong?.error||last}await bcSleep(250)}return{ok:false,error:last||lastProbe?.error||"content bridge did not find a ready composer",probe:lastProbe}}
async function bcProbeProviderTab(provider,tab,{repair=false}={}){provider=osminogProviderKey(provider);if(!tab?.id)return{ok:false,error:"Вкладка сервиса не найдена"};const transport=bcProviderTransport(provider);if(transport==="deepseek")return bcDeepSeekDirectProbe(tab);let probe=await chrome.tabs.sendMessage(tab.id,{type:"BC_PROVIDER_TAB_CONFIG",provider:transport}).catch(e=>({ok:false,error:e?.message||String(e)}));if(!probe?.ok&&repair){const injected=await bcInjectProviderBridge(tab,transport);probe=injected?.probe||injected}return{...probe,ok:!!probe?.ok,provider,transport,error:probe?.ok?"":(probe?.error||"Поле ввода или авторизованный диалог не распознаны")}}
async function bcDiscoverProvider(provider){provider=osminogProviderKey(provider);const links=await bcProviderLinks(),linked=links[provider],tab=linked?.tabId?await chrome.tabs.get(linked.tabId).catch(()=>null):null,valid=!!(tab&&bcProviderMatchesUrl(provider,tab.url||"")),found=await bcFindProviderTab(provider),readiness=valid?await bcProbeProviderTab(provider,tab).catch(e=>({ok:false,error:e?.message||String(e)})):null;return{provider,connected:!!(valid&&readiness?.ok),ready:!!readiness?.ok,error:valid&&!readiness?.ok?(readiness?.error||"Вкладка открыта, но чат не готов"):"",linked:valid?{tabId:tab.id,title:tab.title||provider,url:tab.url,directWeb:!!linked.directWeb,transportProvider:linked.transportProvider||bcProviderTransport(provider),ready:!!readiness?.ok,probe:readiness||null}:null,found:found?{tabId:found.id,title:found.title||provider,url:found.url}:null}}
async function bcConnectProviderTab(provider,preferredTabId=null){provider=osminogProviderKey(provider);const transport=bcProviderTransport(provider),preferred=preferredTabId?await chrome.tabs.get(Number(preferredTabId)).catch(()=>null):null,tab=preferred&&bcProviderMatchesUrl(provider,preferred.url||"")?preferred:await bcFindProviderTab(provider);if(!tab)return{ok:false,provider,needsOpenTab:true,noTabCreated:true,error:provider==="googleai"?"Открой Google AI Mode в обычной вкладке и повтори подключение.":`Открой ${provider} в обычной вкладке и повтори подключение.`};if(transport==="deepseek"){const probe=await bcDeepSeekDirectProbe(tab);if(!probe.ok)return{ok:false,provider,needsAuth:true,noTabCreated:true,tabId:tab.id,error:probe.error||"DeepSeek web session недоступна"};const links=await bcProviderLinks();links[provider]={tabId:tab.id,url:tab.url,title:tab.title||provider,connectedAt:Date.now(),directWeb:true,transportProvider:transport};await bcSaveProviderLinks(links);await osminogRememberSession(provider,tab);return{ok:true,provider,mode:"direct-web-session",tabId:tab.id,title:tab.title||provider,url:tab.url,probe,reusedExisting:true}}const injected=await bcInjectProviderBridge(tab,transport);if(!injected.ok)return{ok:false,provider,needsAuth:true,noTabCreated:true,tabId:tab.id,error:`Не удалось активировать мост: ${injected.error||"unknown"}`};if(injected.probe&&injected.probe.ok===false)return{ok:false,provider,needsAuth:true,noTabCreated:true,tabId:tab.id,error:`Вкладка найдена, но поле ввода не распознано (${injected.probe?.url||tab.url}). Открой сам диалог и повтори.`};const links=await bcProviderLinks();links[provider]={tabId:tab.id,url:tab.url,title:tab.title||provider,connectedAt:Date.now(),transportProvider:transport,genericWeb:!["gpt","claude","gemini","googleai"].includes(transport)};await bcSaveProviderLinks(links);await osminogRememberSession(provider,tab);return{ok:true,provider,mode:["gpt","claude","gemini","googleai"].includes(transport)?"tab":"generic-web-brain",tabId:tab.id,title:tab.title||provider,url:tab.url,probe:injected.probe||null,reusedExisting:true}}

async function bcDeepSeekDirectProbe(tab){
  const out=await chrome.scripting.executeScript({target:{tabId:tab.id},world:"MAIN",func:async()=>{
    const rec=v=>v&&typeof v==="object"&&!Array.isArray(v);
    const raw=localStorage.getItem("userToken")||"";let token="";
    if(raw){try{const p=JSON.parse(raw);token=rec(p)&&typeof p.value==="string"?p.value:typeof p==="string"?p:raw}catch{token=raw}}
    if(!token)return{ok:false,error:"DeepSeek userToken не найден в авторизованной вкладке"};
    try{
      const r=await fetch("/api/v0/users/current",{headers:{authorization:`Bearer ${token}`,"x-client-platform":"web","x-client-version":"2.2.0","x-client-locale":"zh_CN","x-client-bundle-id":"com.deepseek.chat"}}),j=await r.json().catch(()=>null);
      if(j&&(j.code===40002||j.code===40003))return{ok:false,error:j.msg||"DeepSeek web token недействителен"};
      return{ok:true,hasToken:true,title:document.title,url:location.href};
    }catch(e){return{ok:true,hasToken:true,title:document.title,url:location.href,warning:e?.message||String(e)}}
  }}).catch(e=>[{result:{ok:false,error:e?.message||String(e)}}]);
  return out?.[0]?.result||{ok:false,error:"DeepSeek direct probe failed"};
}
async function bcDeepSeekDirectTabSend(text,context,toolResult=null,requestId=""){
  const links=await bcProviderLinks(),link=links.deepseek,tab=link?.tabId?await chrome.tabs.get(link.tabId).catch(()=>null):null;
  if(!tab)throw new Error("DeepSeek: подключённая вкладка не найдена");
  const rid=requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const key=bcProviderHistoryKey(context,"deepseek-web"),hist=BC_PROVIDER_HISTORY.get(key)||[];
  const current=toolResult?bcToolPrompt(toolResult,rid):bcDecoratePrompt(text,context,rid),memoryInput=toolResult?"[OSMINOG tool result delivered]":String(text||"").slice(0,2200);
  const prompt=[bcProviderSystem(),...hist.slice(-4).map(x=>`${x.role==='assistant'?'ASSISTANT':'USER'}:\n${String(x.content||"").slice(0,2600)}`),`USER:\n${current}`].join("\n\n");
  const exec=await chrome.scripting.executeScript({target:{tabId:tab.id},world:"MAIN",func:async(prompt)=>{
    const record=v=>v&&typeof v==="object"&&!Array.isArray(v);
    const rawToken=localStorage.getItem("userToken")||"";let token="";
    if(rawToken){try{const parsed=JSON.parse(rawToken);token=record(parsed)&&typeof parsed.value==="string"?parsed.value:typeof parsed==="string"?parsed:rawToken}catch{token=rawToken}}
    if(!token)throw new Error("DeepSeek userToken не найден. Перелогинься во вкладке DeepSeek.");
    const headers={authorization:`Bearer ${token}`,"content-type":"application/json","x-client-platform":"web","x-client-version":"2.2.0","x-client-locale":"zh_CN","x-client-bundle-id":"com.deepseek.chat"};
    const targetPath="/api/v0/chat/completion";
    let sessionId="";
    const parseSse=text=>{
      let current="reasoning",reasoning="",output="";
      const frag=f=>{if(!record(f))return;const t=String(f.type||""),c=typeof f.content==="string"?f.content:"";if(t==="THINK"){current="reasoning";reasoning+=c}else if(t==="RESPONSE"){current="output";output+=c}};
      for(const block of String(text||"").split(/\r?\n\r?\n/)){
        const lines=block.split(/\r?\n/),dataLines=[];for(const line of lines)if(line.startsWith("data:"))dataLines.push(line.slice(5).trimStart());if(!dataLines.length)continue;
        let d;try{d=JSON.parse(dataLines.join("\n"))}catch{continue}if(!record(d))continue;
        const nested=record(d.v)&&record(d.v.response)?d.v.response:null;if(nested&&Array.isArray(nested.fragments)){nested.fragments.forEach(frag);continue}
        if(d.p==="response/fragments"&&d.o==="APPEND"&&Array.isArray(d.v)){d.v.forEach(frag);continue}
        const contentAppend=d.p==="response/fragments/-1/content"&&d.o==="APPEND",rootAppend=d.p===undefined&&d.o==="APPEND"&&d.v!==undefined,bare=d.p===undefined&&d.o===undefined&&typeof d.v==="string";
        if(contentAppend||rootAppend||bare){const delta=String(d.v??"");if(delta){if(current==="output")output+=delta;else reasoning+=delta}}
      }
      return(output.trim()?output:reasoning).trim();
    };
    const solveChallenge=async challenge=>{
      const candidates=["https://fe-static.deepseek.com/chat/static/76608.8f2a9fa413.js",...performance.getEntriesByType("resource").map(x=>x.name).filter(x=>/fe-static\.deepseek\.com\/chat\/static\/.*\.js/i.test(x))];
      const uniq=[...new Set(candidates)].slice(0,12);let last="";
      for(const url of uniq){try{
        const wr=await fetch(url);if(!wr.ok)continue;const src=await wr.text(),blob=URL.createObjectURL(new Blob([src],{type:"application/javascript"}));
        try{return await new Promise((resolve,reject)=>{const w=new Worker(blob),to=setTimeout(()=>{w.terminate();reject(new Error("worker timeout"))},7000);w.onmessage=e=>{const m=e.data,a=record(m)&&record(m.answer)?m.answer:null;if(m?.type==="pow-answer"&&a){clearTimeout(to);w.terminate();resolve(a)}};w.onerror=e=>{clearTimeout(to);w.terminate();reject(new Error(e.message||"worker error"))};w.postMessage({type:"pow-challenge",challenge:{algorithm:challenge.algorithm,challenge:challenge.challenge,salt:challenge.salt,difficulty:challenge.difficulty,signature:challenge.signature,expireAt:challenge.expire_at}})})}finally{URL.revokeObjectURL(blob)}
      }catch(e){last=e?.message||String(e)}}throw new Error("DeepSeek PoW worker не найден: "+last)};
    try{
      const cr=await fetch("/api/v0/chat/create_pow_challenge",{method:"POST",headers,body:JSON.stringify({target_path:targetPath})}),cj=await cr.json();const challenge=cj?.data?.biz_data?.challenge;if(!cr.ok||cj?.code!==0||!challenge)throw new Error("PoW challenge: "+JSON.stringify(cj).slice(0,300));
      const ans=await solveChallenge(challenge);const proof={algorithm:ans.algorithm,challenge:ans.challenge,salt:ans.salt,answer:ans.answer,signature:ans.signature,target_path:targetPath};const bytes=new TextEncoder().encode(JSON.stringify(proof));let bin="";for(const b of bytes)bin+=String.fromCharCode(b);const powHeader=btoa(bin);
      const sr=await fetch("/api/v0/chat_session/create",{method:"POST",headers,body:JSON.stringify({character_id:null})}),sj=await sr.json();sessionId=sj?.data?.biz_data?.chat_session?.id||"";if(!sr.ok||!sessionId)throw new Error("DeepSeek session create: "+JSON.stringify(sj).slice(0,300));
      const rr=await fetch(targetPath,{method:"POST",headers:{...headers,accept:"text/event-stream","x-ds-pow-response":powHeader},body:JSON.stringify({chat_session_id:sessionId,parent_message_id:null,model_type:"default",prompt,ref_file_ids:[],thinking_enabled:false,search_enabled:false,action:null,preempt:false})});const raw=await rr.text();if(!rr.ok)throw new Error(`DeepSeek completion HTTP ${rr.status}: ${raw.slice(0,300)}`);const answer=parseSse(raw);if(!answer)throw new Error("DeepSeek direct stream вернулся без текста");return{ok:true,answer,sessionId};
    }finally{if(sessionId){try{await fetch("/api/v0/chat_session/delete",{method:"POST",headers,body:JSON.stringify({chat_session_id:sessionId})})}catch{}}}
  },args:[prompt]}).catch(e=>[{result:{ok:false,error:e?.message||String(e)}}]);
  const r=exec?.[0]?.result;if(!r?.ok)throw new Error(r?.error||"DeepSeek direct web-session failed");
  const answer=String(r.answer||"").trim();BC_PROVIDER_HISTORY.set(key,[...hist,{role:"user",content:memoryInput},{role:"assistant",content:answer.slice(0,5000)}].slice(-8));
  return{rid,answer,mode:"direct-web-session",sessionDeleted:true};
}
async function bcProviderTabSend(provider,text,context,toolResult=null,requestId=""){const links=await bcProviderLinks(),link=links[provider],tab=link?.tabId?await chrome.tabs.get(link.tabId).catch(()=>null):null;if(!tab)throw new Error(`${provider}: подключённая вкладка не найдена`);const transport=link?.transportProvider||bcProviderTransport(provider),rid=requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,prompt=toolResult?bcToolPrompt(toolResult,rid):bcDecoratePrompt(text,context,rid);let r=await chrome.tabs.sendMessage(tab.id,{type:"BC_PROVIDER_TAB_SEND_V4",provider:transport,text:prompt,requestId:rid}).catch(e=>({ok:false,error:e?.message||String(e)}));if(!r?.ok&&/Receiving end|message port|Could not establish/i.test(String(r?.error||""))){const reinjected=await bcInjectProviderBridge(tab,transport);if(reinjected.ok)r=await chrome.tabs.sendMessage(tab.id,{type:"BC_PROVIDER_TAB_SEND_V4",provider:transport,text:prompt,requestId:rid}).catch(e=>({ok:false,error:e?.message||String(e)}))}if(!r?.ok)throw new Error(r?.error||`${provider}: tab bridge failed`);return{rid,answer:String(r.answer||"").trim(),mode:"tab"}}
async function bcCustomSend(text,context,toolResult=null,requestId=""){const cfg=(await chrome.storage.local.get(BC_CUSTOM_PROVIDER_KEY))?.[BC_CUSTOM_PROVIDER_KEY]||{},base=String(cfg.baseUrl||"").trim().replace(/\/+$/,""),model=String(cfg.model||"").trim(),apiKey=String(cfg.apiKey||"").trim();if(!base||!model)throw new Error("Custom AI: укажи Base URL и model");const endpoint=/\/chat\/completions$/i.test(base)?base:`${base}${/\/v1$/i.test(base)?"":"/v1"}/chat/completions`,key=bcProviderHistoryKey(context,"custom"),hist=BC_PROVIDER_HISTORY.get(key)||[],rid=requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,prompt=toolResult?bcToolPrompt(toolResult,rid):bcDecoratePrompt(text,context,rid),system=[bcProviderSystem(),String(cfg.systemPrompt||"").trim()].filter(Boolean).join("\n\n"),messages=[{role:"system",content:system},...hist.slice(-10),{role:"user",content:prompt}],headers={"content-type":"application/json"};if(apiKey)headers.Authorization=`Bearer ${apiKey}`;const res=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify({model,messages,stream:false,temperature:.25})}),raw=await res.text();if(!res.ok)throw new Error(`Custom AI HTTP ${res.status}: ${bcErrText(raw)}`);let data;try{data=JSON.parse(raw)}catch{throw new Error("Custom AI вернул не-JSON ответ")};const answer=String(data.choices?.[0]?.message?.content||data.output_text||"").trim();if(!answer)throw new Error("Custom AI вернул пустой ответ");messages.push({role:"assistant",content:answer});BC_PROVIDER_HISTORY.set(key,messages.filter(x=>x.role!=="system").slice(-12));return{rid,answer,mode:"api"}}

const BC_GOOGLE_AI_HISTORY=[];
const BC_GOOGLE_AI_INFLIGHT=new Map(),BC_GOOGLE_AI_RECENT=new Map(),BC_GOOGLE_AI_SERVICE_KEY="briefCraftGoogleAiServiceV2";
function bcGoogleNormalizeQuery(value){return String(value||"").toLowerCase().replace(/\s+/g," ").trim()}
function bcGoogleContextSummary(context={}){
  const linked=context?.googleAiModule?.linked||context?.linked||[],selected=context?.selection?.selectedIds||context?.selectedIds||[],objects=context?.projectMap?.objects||context?.objects||[];
  const labels=[];
  for(const item of Array.isArray(linked)?linked:[]){const name=String(item?.name||item?.label||item?.id||"").trim();if(name&&!labels.includes(name))labels.push(name)}
  for(const id of Array.isArray(selected)?selected:[]){const obj=Array.isArray(objects)?objects.find(x=>x?.id===id):null,name=String(obj?.name||obj?.title||id||"").trim();if(name&&!labels.includes(name))labels.push(name)}
  if(!labels.length&&Array.isArray(objects)&&objects.length<=8)for(const obj of objects){const name=String(obj?.name||obj?.title||obj?.id||"").trim();if(name&&!labels.includes(name))labels.push(name)}
  return labels.slice(0,8).join(", ")
}
function bcGoogleServicePrompt(query,context,requestId){
  const summary=bcGoogleContextSummary(context),marker=`[OSMINOG:${requestId}]`,parts=[String(query||"").trim()];
  if(summary)parts.push(`Контекст проекта: ${summary}.`);
  parts.push(`Ответь на запрос один раз. Не повторяй служебный контекст. ${marker}`);
  return parts.filter(Boolean).join("\n\n")
}
async function bcWaitTabComplete(tabId,timeout=30000){const started=Date.now();while(Date.now()-started<timeout){const tab=await chrome.tabs.get(tabId).catch(()=>null);if(!tab)throw new Error("Вкладка Google AI закрыта");if(tab.status==="complete")return tab;await bcSleep(250)}throw new Error("Google AI не успел загрузиться")}
async function bcGoogleServiceState(){const stored=(await chrome.storage.local.get(BC_GOOGLE_AI_SERVICE_KEY))?.[BC_GOOGLE_AI_SERVICE_KEY]||{},tab=stored.tabId?await chrome.tabs.get(stored.tabId).catch(()=>null):null,valid=!!(tab&&bcGoogleAiTab(tab)),probe=valid?await bcProbeProviderTab("googleai",tab).catch(e=>({ok:false,error:e?.message||String(e)})):null;return{connected:!!(valid&&probe?.ok),ready:!!probe?.ok,found:valid,tabId:valid?tab.id:null,title:valid?(tab.title||"Google AI"):"",url:valid?(tab.url||""):"",windowId:valid?(tab.windowId??null):null,mode:valid?(stored.mode||"google-ai-mode"):"",probe,error:valid&&!probe?.ok?(probe?.error||"Поле ввода Google AI не распознано"):""}}
async function bcEnsureGoogleServiceTab({allowCreate=true}={}){
  let state=await bcGoogleServiceState(),tab=state.tabId?await chrome.tabs.get(state.tabId).catch(()=>null):null,mode=state.mode||"google-ai-mode";
  if(!tab){
    tab=await osminogSessionTab("googleai").catch(()=>null);
    if(tab)mode="service-window";
  }
  if(!tab){
    tab=await bcFindProviderTab("googleai");
    if(tab)mode="existing-tab";
  }
  if(!tab){
    if(!allowCreate)throw new Error("Google AI Mode не открыт.");
    const opened=await osminogHubOpen({url:"https://www.google.com/ai",provider:"googleai",active:false,reuse:true,allowCreate:true});
    tab=opened?.tabId?await chrome.tabs.get(opened.tabId).catch(()=>null):null;mode="service-window";
    if(!tab)throw new Error("Не удалось создать фоновую сессию Google AI");
    await chrome.storage.local.set({[BC_GOOGLE_AI_SERVICE_KEY]:{tabId:tab.id,windowId:tab.windowId,mode,createdAt:Date.now()}})
  }
  tab=await bcWaitTabComplete(tab.id);
  if(!bcGoogleAiTab(tab))return{ok:false,tabId:tab.id,error:"В служебной вкладке открой Google AI Mode и нажми «Подключить» ещё раз."};
  const injected=await bcInjectProviderBridge(tab,"googleai");
  if(!injected.ok||injected.probe?.ok===false)return{ok:false,tabId:tab.id,error:`Google AI Mode открыт, но рабочее поле ввода не найдено${injected?.probe?.bridge?` мостом ${injected.probe.bridge}`:""}. Открой сам диалог AI Mode, дождись поля вопроса и повтори подключение.`};
  const links=await bcProviderLinks();links.googleai={tabId:tab.id,url:tab.url,title:tab.title||"Google AI",connectedAt:Date.now()};await bcSaveProviderLinks(links);
  await chrome.storage.local.set({[BC_GOOGLE_AI_SERVICE_KEY]:{tabId:tab.id,windowId:tab.windowId,mode,connectedAt:Date.now()}});
  return{ok:true,tabId:tab.id,title:tab.title||"Google AI",url:tab.url,mode,probe:injected.probe||null}
}
async function bcGoogleServiceSend(query,requestId="",images=[]){const svc=await bcEnsureGoogleServiceTab({allowCreate:false});if(!svc.ok)throw Object.assign(new Error(svc.error||"Google AI transport unavailable"),{tabId:svc.tabId});const rid=requestId||`gai-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,r=await chrome.tabs.sendMessage(svc.tabId,{type:"BC_PROVIDER_TAB_SEND_V4",provider:"googleai",text:String(query||""),requestId:rid,images:Array.isArray(images)?images:[]}).catch(e=>({ok:false,error:e?.message||String(e)}));if(!r?.ok)throw new Error(r?.error||"Google AI Mode bridge failed");return{rid:r.requestId||rid,answer:String(r.answer||"").trim(),media:Array.isArray(r.media)?r.media:[],widgets:Array.isArray(r.widgets)?r.widgets:[],mode:svc.mode||"existing-tab"}}
async function bcGoogleAiWidgetSend(query,options={}){
  query=String(query||" ").trim();
  if(!query)throw new Error("Пустой запрос");
  const requestId=String(options.requestId||`gai-${Date.now()}-${Math.random().toString(36).slice(2,7)}`),queryKey=bcGoogleNormalizeQuery(query);
  if(BC_GOOGLE_AI_INFLIGHT.has(requestId))return await BC_GOOGLE_AI_INFLIGHT.get(requestId);
  const recent=BC_GOOGLE_AI_RECENT.get(queryKey);
  if(recent&&Date.now()-recent.at<5000)return await recent.promise;
  const task=(async()=>{
    const keys=(await chrome.storage.local.get("briefCraftProviderKeysV1"))?.briefCraftProviderKeysV1||{},apiKey=String(keys.gemini||"").trim(),context=options.canvasContext||{},decorated=bcGoogleServicePrompt(query,context,requestId);
    try{
      const r=await bcGoogleServiceSend(decorated,requestId,options.images||[]),parsed=bcParseAssistant(r.answer);
      return{ok:true,requestId:r.rid||requestId,answer:parsed.text||r.answer,patch:parsed.patch||null,request:parsed.request||null,sources:[],media:r.media||[],widgets:r.widgets||[],model:"Google AI Mode · служебная вкладка"}
    }catch(serviceError){
      if(!apiKey)return{ok:false,requestId,needsKey:false,needsLogin:true,tabId:serviceError?.tabId||null,error:serviceError?.message||"Подключи Google AI Mode"};
      const contents=[...BC_GOOGLE_AI_HISTORY.slice(-8),{role:"user",parts:[{text:decorated}]}],url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",res=await fetch(url,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents,tools:[{google_search:{}}],generationConfig:{maxOutputTokens:4096}})}),raw=await res.text();
      if(!res.ok)throw new Error(`Google AI HTTP ${res.status}: ${bcErrText(raw)}`);
      let data;try{data=JSON.parse(raw)}catch{throw new Error("Google AI вернул не-JSON ответ")}
      const candidate=data.candidates?.[0]||{},answer=(candidate.content?.parts||[]).map(x=>x.text||"").join("\n").trim();
      if(!answer)throw new Error("Google AI вернул пустой ответ");
      BC_GOOGLE_AI_HISTORY.push({role:"user",parts:[{text:decorated}]},{role:"model",parts:[{text:answer}]});
      if(BC_GOOGLE_AI_HISTORY.length>12)BC_GOOGLE_AI_HISTORY.splice(0,BC_GOOGLE_AI_HISTORY.length-12);
      const chunks=candidate.groundingMetadata?.groundingChunks||[],sources=[];
      for(const chunk of chunks){const w=chunk?.web;if(w?.uri&&!sources.some(x=>x.url===w.uri))sources.push({title:w.title||w.uri,url:w.uri})}
      const parsed=bcParseAssistant(answer);
      return{ok:true,requestId,answer:parsed.text||answer,patch:parsed.patch||null,request:parsed.request||null,sources,model:"Gemini 2.5 Flash + Google Search"}
    }
  })();
  BC_GOOGLE_AI_INFLIGHT.set(requestId,task);
  BC_GOOGLE_AI_RECENT.set(queryKey,{at:Date.now(),promise:task});
  try{return await task}finally{setTimeout(()=>{BC_GOOGLE_AI_INFLIGHT.delete(requestId);const latest=BC_GOOGLE_AI_RECENT.get(queryKey);if(latest?.promise===task)BC_GOOGLE_AI_RECENT.delete(queryKey)},30000)}
}


async function bcProviderSend(payload,toolResult=null){const provider=String(payload?.provider||""),context=payload?.context||bcDirectContext||{},requestId=payload?.requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;if(provider==="googleai"){const query=toolResult?bcToolPrompt(toolResult,requestId):String(payload?.text||"");const g=await bcGoogleAiWidgetSend(query,{requestId,canvasContext:context,images:Array.isArray(payload?.images)?payload.images:[]});if(!g?.ok)return g;return{ok:true,requestId:g.requestId||requestId,payload:{requestId:g.requestId||requestId,text:g.answer||"",patch:g.patch||null,request:g.request||null,media:g.media||[],widgets:g.widgets||[]},diag:{provider:"googleai",mode:g.model||"google-ai-mode",totalMs:0}}}let got;if(provider==="custom")got=await bcCustomSend(payload?.text||"",context,toolResult,requestId);else{const status=await bcDiscoverProvider(provider).catch(()=>({connected:false}));if(status.connected){try{got=provider==="deepseek"?await bcDeepSeekDirectTabSend(payload?.text||"",context,toolResult,requestId):await bcProviderTabSend(provider,payload?.text||"",context,toolResult,requestId)}catch(e){if(provider==="deepseek"){await bcSleep(260);try{got=await bcDeepSeekDirectTabSend(payload?.text||"",context,toolResult,requestId)}catch(e2){if(!payload?.apiKey)throw e2}}else if(!payload?.apiKey)throw e}}if(!got){if(provider==="gemini")got=await bcGeminiSend(payload?.text||"",context,payload?.apiKey||"",toolResult,requestId);else if(provider==="claude")got=await bcClaudeSend(payload?.text||"",context,payload?.apiKey||"",toolResult,requestId);else if(provider==="deepseek")got=await bcDeepSeekSend(payload?.text||"",context,payload?.apiKey||"",toolResult,requestId);else{const hub=await osminogSessionTab(provider).catch(()=>null);if(hub){const connected=await osminogHubConnect(hub.id,provider);if(!connected?.ok)throw new Error(connected?.error||`${provider}: внутренняя service session не готова`);got=await bcProviderTabSend(provider,payload?.text||"",context,toolResult,requestId)}else throw new Error(`${provider}: нет подключённой внутренней service session`)}}}const parsed=bcParseAssistant(got.answer);return{ok:true,requestId:got.rid,payload:{requestId:got.rid,...parsed},diag:{provider,mode:got.mode||"api",totalMs:0}}}
async function bcFindChatGptTab(){const tabs=await chrome.tabs.query({url:["https://chatgpt.com/*","https://chat.openai.com/*"]});if(!tabs?.length)return null;const active=tabs.find(t=>t.active);if(active)return active;return [...tabs].sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0]||tabs[0]}
async function bcConfigureExternalTab(tab,context){await chrome.scripting.executeScript({target:{tabId:tab.id},files:["chatgpt-lite-bridge.js"]}).catch(()=>{});await new Promise(r=>setTimeout(r,140));const pong=await chrome.tabs.sendMessage(tab.id,{type:"BC_LITE_CONFIG",enabled:true,autoInject:true,serviceMode:false,context}).catch(()=>null);if(!pong?.ok)throw new Error("Не удалось активировать OSMINOG Presence в этой вкладке ChatGPT");bcExternalTabId=tab.id;return{ok:true,tabId:tab.id,title:tab.title||"ChatGPT",url:tab.url}}


async function bcModuleTool(name,args={}){
  const key="briefCraftModulesV1",stored=await chrome.storage.local.get([key,"osminogOwnerGrantV1"]),mods=stored?.[key]||{},github=mods.github||{},grant=stored?.osminogOwnerGrantV1||{},grantAge=Date.now()-Number(grant.verifiedAt||0),ownerVerified=!!(github.token&&grant.verified===true&&grant.ownerMax===true&&grantAge>=0&&grantAge<30*24*60*60*1000);
  if(name==="module_status")return{ok:true,figma:{connected:!!mods.figma?.connected,name:mods.figma?.name||null},github:{connected:!!github.connected,name:github.name||null,ownerVerified,ownerUser:grant.user||null,writeGateway:"owner-confirmed"},drive:{connected:false,note:"OAuth client configuration required"}};
  if(name==="figma_fetch_file"){
    if(!mods.figma?.token)throw new Error("Figma module not connected");
    const fileKey=String(args.fileKey||"").trim();if(!fileKey)throw new Error("fileKey required");
    const depth=Math.max(1,Math.min(4,Number(args.depth)||2)),r=await fetch(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}?depth=${depth}`,{headers:{"X-Figma-Token":mods.figma.token}}),raw=await r.text();
    if(!r.ok)throw new Error(`Figma HTTP ${r.status}: ${raw.slice(0,200)}`);const d=JSON.parse(raw);return{ok:true,name:d.name,lastModified:d.lastModified,version:d.version,document:d.document};
  }
  if(!name.startsWith("github_"))throw new Error(`Unknown module tool: ${name}`);
  if(!github.token)throw new Error("GitHub module not connected");
  const repo=String(args.repo||"jeep-jim/OSMINOG").trim(),allowedRepos=new Set(["jeep-jim/OSMINOG","jeep-jim/OSMINOG-Releases"]);
  if(!allowedRepos.has(repo))throw new Error("GitHub gateway is restricted to OSMINOG repositories");
  const headers={Authorization:`Bearer ${github.token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"};
  const gh=async(path,options={})=>{const r=await fetch(`https://api.github.com${path}`,{...options,headers:{...headers,...(options.headers||{})}}),raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}if(!r.ok)throw new Error(`GitHub HTTP ${r.status}: ${typeof data==="string"?data.slice(0,300):data?.message||raw.slice(0,300)}`);return{data,headers:r.headers,status:r.status}};
  const repoPath=`/repos/${repo}`,cleanPath=value=>String(value||"").replace(/^\/+/,""),encodePath=value=>cleanPath(value).split("/").map(encodeURIComponent).join("/");
  const requireOwner=()=>{if(args.__ownerApproved!==true)throw new Error("Owner confirmation is required for GitHub write")};
  const safeBranch=value=>{const branch=String(value||"").trim();if(!/^osminog-ai\/[A-Za-z0-9._\/-]+$/.test(branch))throw new Error("Write branches must use osminog-ai/<name>");return branch};
  const protectedPath=value=>{const path=cleanPath(value);if(!path||path.includes(".."))throw new Error(`Unsafe path: ${path}`);if(/(^|\/)(\.env|\.npmrc|\.pypirc|credentials?|secrets?|tokens?)(\.|\/|$)/i.test(path))throw new Error(`Protected secret path: ${path}`);if(/^\.github\/workflows\//i.test(path))throw new Error("Workflow files cannot be changed from the internal AI gateway");return path};
  const decodeBase64=value=>{const raw=String(value||"").replace(/\s/g,""),bin=atob(raw),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes};
  const hexDigest=async bytes=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");
  const repoRequest=async(target,path,options={},allow404=false)=>{const r=await fetch(`https://api.github.com/repos/${target}${path}`,{...options,headers:{...headers,...(options.headers||{})}}),raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}if(allow404&&r.status===404)return{status:404,data:null};if(!r.ok)throw new Error(`GitHub HTTP ${r.status}: ${typeof data==="string"?data.slice(0,300):data?.message||raw.slice(0,300)}`);return{status:r.status,data,headers:r.headers}};
  const commitDirect=async(target,entries,message)=>{const head=(await repoRequest(target,"/git/ref/heads/main")).data?.object?.sha;if(!head)throw new Error(`${target}: main head is missing`);const baseTree=(await repoRequest(target,`/git/commits/${head}`)).data?.tree?.sha;if(!baseTree)throw new Error(`${target}: base tree is missing`);const tree=[];for(const entry of entries){const path=protectedPath(entry.path),encoding=entry.encoding==="base64"?"base64":"utf-8",content=String(entry.content??"");if(content.length>1800000)throw new Error(`File payload is too large: ${path}`);const blob=(await repoRequest(target,"/git/blobs",{method:"POST",body:JSON.stringify({content,encoding})})).data;tree.push({path,mode:String(entry.mode||"100644"),type:"blob",sha:blob.sha})}const nextTree=(await repoRequest(target,"/git/trees",{method:"POST",body:JSON.stringify({base_tree:baseTree,tree})})).data,nextCommit=(await repoRequest(target,"/git/commits",{method:"POST",body:JSON.stringify({message,tree:nextTree.sha,parents:[head]})})).data;await repoRequest(target,"/git/refs/heads/main",{method:"PATCH",body:JSON.stringify({sha:nextCommit.sha,force:false})});return nextCommit.sha};
  const releasePayload=async()=>{requireOwner();const version=String(args.version||"").trim(),packageName=String(args.packageName||"").trim(),packageBase64=String(args.packageBase64||"").replace(/\s/g,""),files=Array.isArray(args.files)?args.files:[];if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error("Valid release version is required");if(!/^OSMINOG-Chrome-[A-Za-z0-9._-]+\.zip$/.test(packageName))throw new Error("Unsafe package name");if(!packageBase64||!files.length||files.length>160)throw new Error("Complete package and source file list are required");const bytes=decodeBase64(packageBase64),sha256=await hexDigest(bytes),expectedSize=Number(args.size)||0,expectedSha=String(args.sha256||"").toLowerCase();if(expectedSize!==bytes.length)throw new Error(`Package size mismatch: ${bytes.length} != ${expectedSize}`);if(expectedSha!==sha256)throw new Error("Package SHA-256 mismatch");const safeFiles=[];for(const file of files){const path=protectedPath(file?.path),base64=String(file?.base64||"").replace(/\s/g,"");if(!base64)throw new Error(`Source file is empty: ${path}`);safeFiles.push({path,base64})}return{version,packageName,packageBase64,bytes,sha256,size:bytes.length,files:safeFiles,notes:String(args.notes||`OSMINOG Chrome ${version} release.`)}};
  const archiveSource=async payload=>{const prefix=`sources/chrome/${payload.version}`,entries=[];for(const file of payload.files)entries.push({path:`${prefix}/${file.path}`,content:file.base64,encoding:"base64"},{path:`sources/chrome/current/${file.path}`,content:file.base64,encoding:"base64"});const meta={schema:"osminog-source-snapshot/v1",product:"OSMINOG",platform:"chrome-extension",version:payload.version,package:payload.packageName,size:payload.size,sha256:payload.sha256,fileCount:payload.files.length,createdAt:new Date().toISOString()};entries.push({path:`${prefix}/source.json`,content:JSON.stringify(meta,null,2)+"\n"},{path:"sources/chrome/current/source.json",content:JSON.stringify(meta,null,2)+"\n"},{path:`artifacts/chrome/${payload.version}/${payload.packageName}`,content:payload.packageBase64,encoding:"base64"});const commit=await commitDirect("jeep-jim/OSMINOG",entries,`Archive OSMINOG Chrome ${payload.version} source and package`);return{commit,url:`https://github.com/jeep-jim/OSMINOG/commit/${commit}`}};
  if(name==="github_publish_source"||name==="github_publish_release"){
    const payload=await releasePayload(),source=await archiveSource(payload);
    if(name==="github_publish_source")return{ok:true,repo:"jeep-jim/OSMINOG",version:payload.version,package:payload.packageName,size:payload.size,sha256:payload.sha256,sourceCommit:source.commit,sourceUrl:source.url,mode:"source-archived"};
    const publicRepo="jeep-jim/OSMINOG-Releases",tag=`chrome-v${payload.version}`,title=`OSMINOG Chrome ${payload.version}`,releaseNotes=`${payload.notes}\n\nPackage: \`${payload.packageName}\`\nSHA-256: \`${payload.sha256}\`\nSize: \`${payload.size}\` bytes`;let release=(await repoRequest(publicRepo,`/releases/tags/${encodeURIComponent(tag)}`,{},true)).data;if(release)release=(await repoRequest(publicRepo,`/releases/${release.id}`,{method:"PATCH",body:JSON.stringify({tag_name:tag,target_commitish:"main",name:title,body:releaseNotes,draft:false,prerelease:true})})).data;else release=(await repoRequest(publicRepo,"/releases",{method:"POST",body:JSON.stringify({tag_name:tag,target_commitish:"main",name:title,body:releaseNotes,draft:false,prerelease:true})})).data;for(const asset of release.assets||[])if(asset.name===payload.packageName)await repoRequest(publicRepo,`/releases/assets/${asset.id}`,{method:"DELETE"});const upload=await fetch(`https://uploads.github.com/repos/${publicRepo}/releases/${release.id}/assets?name=${encodeURIComponent(payload.packageName)}`,{method:"POST",headers:{Authorization:`Bearer ${github.token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/zip"},body:payload.bytes});const uploadRaw=await upload.text();let asset=null;try{asset=JSON.parse(uploadRaw)}catch{}if(!upload.ok)throw new Error(`GitHub asset upload HTTP ${upload.status}: ${asset?.message||uploadRaw.slice(0,240)}`);const now=new Date().toISOString(),downloadUrl=`https://github.com/${publicRepo}/releases/download/${tag}/${payload.packageName}`,notesPath=`platforms/chrome-extension/releases/${payload.version}/README.md`,metadata={schema:"osminog-chrome-release/v2",product:"OSMINOG",platform:"chrome-extension",channel:"dev",version:payload.version,package:payload.packageName,size:payload.size,sha256:payload.sha256,manifestVersion:payload.version,fixedExtensionKeyRequired:true,runtimeVerified:false,publishedAt:now,sourceRepository:"jeep-jim/OSMINOG",sourceCommit:source.commit,downloadUrl},feed={schema:"osminog-update-feed-envelope/v1",signed:{schema:"osminog-update-feed/v2",product:"OSMINOG",platform:"chrome-extension",channel:"dev",generatedAt:now,status:"active",latest:{version:payload.version,kind:"full-package",packageUrl:downloadUrl,size:payload.size,sha256:payload.sha256,manifestVersion:payload.version,fixedExtensionKeyRequired:true,minDevHubVersion:"2.0.0",runtimeVerified:false,notesUrl:`https://raw.githubusercontent.com/${publicRepo}/main/${notesPath}`,publishedAt:now}},signature:null},readme=`# OSMINOG Chrome ${payload.version}\n\n${payload.notes}\n\n- Package: \`${payload.packageName}\`\n- Size: \`${payload.size}\` bytes\n- SHA-256: \`${payload.sha256}\`\n- Source commit: [${source.commit}](${source.url})\n- Download: [${payload.packageName}](${downloadUrl})\n`;const publicCommit=await commitDirect(publicRepo,[{path:notesPath,content:readme},{path:`platforms/chrome-extension/releases/${payload.version}/release-v2.json`,content:JSON.stringify(metadata,null,2)+"\n"},{path:"channels/dev/chrome-extension.json",content:JSON.stringify(feed,null,2)+"\n"}],`Publish OSMINOG Chrome ${payload.version} update feed`);return{ok:true,version:payload.version,package:payload.packageName,size:payload.size,sha256:payload.sha256,sourceCommit:source.commit,sourceUrl:source.url,publicCommit,releaseUrl:release.html_url,downloadUrl,feedUrl:`https://raw.githubusercontent.com/${publicRepo}/main/channels/dev/chrome-extension.json`,mode:"release-published"}
  }
  if(name==="github_status"){const [{data:r},{data:u}]=await Promise.all([gh(repoPath),gh("/user")]);return{ok:true,repo:r.full_name,private:!!r.private,defaultBranch:r.default_branch,permissions:r.permissions||{},user:u.login||u.name||github.name||"GitHub",pushedAt:r.pushed_at}}
  if(name==="github_list_tree"){const ref=String(args.ref||"main"),recursive=args.recursive!==false;let treeSha=ref;try{const c=(await gh(`${repoPath}/commits/${encodeURIComponent(ref)}`)).data;treeSha=c?.commit?.tree?.sha||c?.sha||ref}catch{}const {data}=await gh(`${repoPath}/git/trees/${encodeURIComponent(treeSha)}${recursive?"?recursive=1":""}`);let items=Array.isArray(data.tree)?data.tree:[];const prefix=cleanPath(args.path||"");if(prefix)items=items.filter(x=>x.path===prefix||x.path?.startsWith(prefix+"/"));const limit=Math.max(1,Math.min(1200,Number(args.limit)||500));return{ok:true,repo,ref,truncated:!!data.truncated,items:items.slice(0,limit).map(x=>({path:x.path,type:x.type,size:x.size||0,sha:x.sha}))}}
  if(name==="github_search_code"){const query=String(args.query||"").trim();if(!query)throw new Error("query required");const {data}=await gh(`/search/code?q=${encodeURIComponent(query+` repo:${repo}`)}&per_page=${Math.max(1,Math.min(50,Number(args.limit)||20))}`);return{ok:true,repo,total:data.total_count||0,items:(data.items||[]).map(x=>({path:x.path,name:x.name,sha:x.sha,url:x.html_url}))}}
  if(name==="github_fetch_file"){const path=cleanPath(args.path),ref=String(args.ref||"main");if(!path)throw new Error("path required");const {data:d}=await gh(`${repoPath}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);if(Array.isArray(d))return{ok:true,repo,path,ref,items:d.map(x=>({name:x.name,path:x.path,type:x.type,size:x.size,sha:x.sha}))};const raw=String(d.content||"").replace(/\s/g,"");let content="";if(d.encoding==="base64"){const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));content=new TextDecoder().decode(bytes)}else content=String(d.content||"");return{ok:true,repo,path:d.path||path,ref,sha:d.sha||null,size:d.size||content.length,content:content.slice(0,240000),truncated:content.length>240000}}
  if(name==="github_compare"){const base=String(args.base||"main"),head=String(args.head||"").trim();if(!head)throw new Error("head required");const {data}=await gh(`${repoPath}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);return{ok:true,repo,status:data.status,aheadBy:data.ahead_by,behindBy:data.behind_by,totalCommits:data.total_commits,files:(data.files||[]).slice(0,120).map(f=>({filename:f.filename,status:f.status,additions:f.additions,deletions:f.deletions,changes:f.changes,patch:f.patch?.slice(0,12000)}))}}
  if(name==="github_create_branch"){requireOwner();const branch=safeBranch(args.branch),from=String(args.from||"main"),base=(await gh(`${repoPath}/git/ref/heads/${encodeURIComponent(from)}`)).data,sha=base?.object?.sha;if(!sha)throw new Error("Base branch SHA missing");const {data}=await gh(`${repoPath}/git/refs`,{method:"POST",body:JSON.stringify({ref:`refs/heads/${branch}`,sha})});return{ok:true,repo,branch,sha:data?.object?.sha||sha}}
  if(name==="github_commit_files"){
    requireOwner();const branch=safeBranch(args.branch),message=String(args.message||"").trim(),files=Array.isArray(args.files)?args.files:(Array.isArray(args.changes)?args.changes:[]);if(!message)throw new Error("commit message required");if(!files.length||files.length>40)throw new Error("files must contain 1..40 entries");
    const ref=(await gh(`${repoPath}/git/ref/heads/${encodeURIComponent(branch)}`)).data,headSha=ref?.object?.sha;if(!headSha)throw new Error("Branch head missing");const commit=(await gh(`${repoPath}/git/commits/${headSha}`)).data,baseTree=commit?.tree?.sha;if(!baseTree)throw new Error("Base tree missing");const tree=[];
    for(const item of files){const path=protectedPath(item?.path),operation=String(item?.operation||"update");if(operation==="delete"){tree.push({path,mode:"100644",type:"blob",sha:null});continue}const content=String(item?.content??"");if(new TextEncoder().encode(content).length>1000000)throw new Error(`File too large: ${path}`);const blob=(await gh(`${repoPath}/git/blobs`,{method:"POST",body:JSON.stringify({content,encoding:"utf-8"})})).data;tree.push({path,mode:String(item?.mode||"100644"),type:"blob",sha:blob.sha})}
    const newTree=(await gh(`${repoPath}/git/trees`,{method:"POST",body:JSON.stringify({base_tree:baseTree,tree})})).data,newCommit=(await gh(`${repoPath}/git/commits`,{method:"POST",body:JSON.stringify({message,tree:newTree.sha,parents:[headSha]})})).data;await gh(`${repoPath}/git/refs/heads/${encodeURIComponent(branch)}`,{method:"PATCH",body:JSON.stringify({sha:newCommit.sha,force:false})});return{ok:true,repo,branch,commitSha:newCommit.sha,files:tree.map(x=>x.path),message}
  }
  if(name==="github_open_pr"){requireOwner();const head=safeBranch(args.head||args.branch),base=String(args.base||"main"),title=String(args.title||"").trim();if(!title)throw new Error("PR title required");const {data}=await gh(`${repoPath}/pulls`,{method:"POST",body:JSON.stringify({title,head,base,body:String(args.body||""),draft:args.draft!==false})});return{ok:true,repo,number:data.number,url:data.html_url,state:data.state,draft:!!data.draft,head,base}}
  if(name==="github_workflow_runs"||name==="github_get_workflow_runs"){const workflow=String(args.workflow||"").trim(),branch=String(args.branch||"").trim(),path=workflow?`${repoPath}/actions/workflows/${encodeURIComponent(workflow)}/runs`:`${repoPath}/actions/runs`,qs=new URLSearchParams({per_page:String(Math.max(1,Math.min(30,Number(args.limit)||10)))});if(branch)qs.set("branch",branch);const {data}=await gh(`${path}?${qs}`);return{ok:true,repo,runs:(data.workflow_runs||[]).map(r=>({id:r.id,name:r.name,title:r.display_title,status:r.status,conclusion:r.conclusion,branch:r.head_branch,sha:r.head_sha,url:r.html_url,createdAt:r.created_at,updatedAt:r.updated_at}))}}
  if(name==="github_dispatch_workflow"){requireOwner();const workflow=String(args.workflow||"").trim();if(!workflow)throw new Error("workflow required");const ref=String(args.ref||args.branch||"main");await gh(`${repoPath}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,{method:"POST",body:JSON.stringify({ref,inputs:args.inputs&&typeof args.inputs==="object"?args.inputs:{}})});return{ok:true,repo,workflow,ref,dispatched:true}}
  throw new Error(`Unknown GitHub tool: ${name}`);
}

const OSMINOG_BROWSER_HUB_KEY="osminogBrowserHubWindowV1";
const OSMINOG_PROVIDER_SESSION_KEY="osminogProviderSessionsV1";
const OSMINOG_PROVIDER_URLS={gpt:"https://chatgpt.com/",chatgpt:"https://chatgpt.com/",deepseek:"https://chat.deepseek.com/",claude:"https://claude.ai/",gemini:"https://gemini.google.com/app",googleai:"https://www.google.com/ai","nano-banana":"https://gemini.google.com/app",designer:"https://designer.microsoft.com/",firefly:"https://firefly.adobe.com/",leonardo:"https://app.leonardo.ai/",ideogram:"https://ideogram.ai/t/explore",krea:"https://www.krea.ai/",stability:"https://platform.stability.ai/",pixlr:"https://pixlr.com/image-generator/",canva:"https://www.canva.com/ai-image-generator/",runway:"https://app.runwayml.com/",heygen:"https://app.heygen.com/",luma:"https://dream-machine.lumalabs.ai/",pika:"https://pika.art/",suno:"https://suno.com/create",udio:"https://www.udio.com/",elevenlabs:"https://elevenlabs.io/app/speech-synthesis/text-to-speech",alice:"https://alice.yandex.ru/","yandex-ai":"https://console.yandex.cloud/folders?section=ai"};
function osminogProviderKey(provider=""){provider=String(provider||"").trim().toLowerCase();if(provider==="chatgpt")return"gpt";if(provider==="google-ai"||provider==="google")return"googleai";return provider||"web"}
async function osminogSessionMap(){return (await chrome.storage.local.get(OSMINOG_PROVIDER_SESSION_KEY))?.[OSMINOG_PROVIDER_SESSION_KEY]||{}}
async function osminogSaveSessionMap(map){await chrome.storage.local.set({[OSMINOG_PROVIDER_SESSION_KEY]:map||{}})}
async function osminogSessionTab(provider){provider=osminogProviderKey(provider);if(!provider||provider==="web")return null;const map=await osminogSessionMap(),saved=map[provider];if(!saved?.tabId)return null;const tab=await chrome.tabs.get(Number(saved.tabId)).catch(()=>null);if(!tab||!bcProviderMatchesUrl(provider,tab.url||"")){delete map[provider];await osminogSaveSessionMap(map);return null}return tab}
async function osminogRememberSession(provider,tab){provider=osminogProviderKey(provider);if(!provider||provider==="web"||!tab?.id)return;const map=await osminogSessionMap();map[provider]={tabId:tab.id,windowId:tab.windowId,url:tab.url||OSMINOG_PROVIDER_URLS[provider]||"",updatedAt:Date.now()};await osminogSaveSessionMap(map)}
async function osminogForgetSessionTab(tabId){const map=await osminogSessionMap();let changed=false;for(const [provider,state] of Object.entries(map)){if(Number(state?.tabId)===Number(tabId)){delete map[provider];changed=true}}if(changed)await osminogSaveSessionMap(map)}
async function osminogHubEnsure(url="about:blank"){let win=await osminogHubWindow();if(win)return win;win=await chrome.windows.create({url,focused:false,type:"normal"});await chrome.storage.local.set({[OSMINOG_BROWSER_HUB_KEY]:{windowId:win.id,createdAt:Date.now()}});try{await chrome.windows.update(win.id,{state:"minimized",focused:false})}catch{}return await chrome.windows.get(win.id,{populate:true})}
async function osminogSessionList(){const map=await osminogSessionMap(),win=await osminogHubWindow(),tabs=[],sessions={},kept={};for(const [provider,state] of Object.entries(map)){const tab=state?.tabId?await chrome.tabs.get(Number(state.tabId)).catch(()=>null):null;if(!tab||!bcProviderMatchesUrl(provider,tab.url||""))continue;kept[provider]=state;const managed=!!(win&&Number(tab.windowId)===Number(win.id));const readiness=await bcProbeProviderTab(provider,tab).catch(e=>({ok:false,error:e?.message||String(e)}));sessions[provider]={...state,tabId:tab.id,windowId:tab.windowId,managed,connected:!!readiness?.ok,ready:!!readiness?.ok,error:readiness?.ok?"":(readiness?.error||"Чат не готов"),probe:readiness||null};tabs.push({id:tab.id,title:tab.title||provider,url:tab.url||"",status:tab.status||"",active:!!tab.active,provider,managed,connected:!!readiness?.ok,ready:!!readiness?.ok,error:readiness?.ok?"":(readiness?.error||"Чат не готов")})}if(Object.keys(kept).length!==Object.keys(map).length)await osminogSaveSessionMap(kept);return{ok:true,window:win?{id:win.id,state:win.state,focused:win.focused}:null,tabs,sessions,policy:{silentCreate:true,preferExisting:true,chatInsideOsminog:true,connectedMeansLiveProbe:true}}}
async function osminogConnectExisting(provider,preferredTabId=null){provider=osminogProviderKey(provider);const connected=await bcConnectProviderTab(provider,preferredTabId);if(connected?.ok){const tab=await chrome.tabs.get(Number(connected.tabId)).catch(()=>null);if(tab)await osminogRememberSession(provider,tab)}return connected}
async function osminogAuthorizeProvider(provider){provider=osminogProviderKey(provider);const existing=await bcFindProviderTab(provider);if(existing){await chrome.windows.update(existing.windowId,{state:"normal",focused:true}).catch(()=>{});await chrome.tabs.update(existing.id,{active:true}).catch(()=>{});return{ok:true,provider,tabId:existing.id,reusedExisting:true,mode:"visible-login-tab"}}const url=OSMINOG_PROVIDER_URLS[provider];if(!url)return{ok:false,provider,error:"Для этого сервиса не задан адрес авторизации"};const tab=await chrome.tabs.create({url,active:true});return{ok:true,provider,tabId:tab.id,reusedExisting:false,mode:"visible-login-tab",note:"После входа вернись в OSMINOG и нажми «Подключить открытую вкладку»."}}
async function osminogHubWindow(){const saved=(await chrome.storage.local.get(OSMINOG_BROWSER_HUB_KEY))?.[OSMINOG_BROWSER_HUB_KEY]||{},win=saved.windowId?await chrome.windows.get(saved.windowId,{populate:true}).catch(()=>null):null;return win||null}
async function osminogHubOpen({url="",provider="",active=false,reuse=true,allowCreate=true}={}){provider=osminogProviderKey(provider);url=String(url||OSMINOG_PROVIDER_URLS[provider]||"").trim();if(!url)throw new Error("URL пустой");if(!/^https?:\/\//i.test(url))url="https://"+url;
  if(reuse!==false&&provider&&provider!=="web"){
    const existing=await osminogSessionTab(provider);
    if(existing){if(active){await chrome.windows.update(existing.windowId,{state:"normal",focused:true}).catch(()=>{});await chrome.tabs.update(existing.id,{active:true}).catch(()=>{})}else try{await chrome.windows.update(existing.windowId,{state:"minimized",focused:false})}catch{}return{ok:true,reused:true,windowId:existing.windowId,tabId:existing.id,url:existing.url||url,provider}}
  }
  if(!allowCreate)return{ok:false,provider,needsOpenTab:true,noTabCreated:true,error:"Фоновая сессия не создана"};
  let win=await osminogHubWindow(),tab;if(!win){win=await osminogHubEnsure(url);tab=(win.tabs||[])[0]}else tab=await chrome.tabs.create({windowId:win.id,url,active:!!active});if(tab&&provider&&provider!=="web")await osminogRememberSession(provider,tab);if(active&&tab?.id){await chrome.windows.update(tab.windowId,{state:"normal",focused:true}).catch(()=>{});await chrome.tabs.update(tab.id,{active:true}).catch(()=>{})}else if(!active)try{await chrome.windows.update(win.id,{state:"minimized",focused:false})}catch{}return{ok:true,reused:false,windowId:win.id,tabId:tab?.id,url:tab?.url||url,provider:provider||bcProviderFromUrl(tab?.url||url)||"web",managed:true,background:!active}}
async function osminogHubList(){const win=await osminogHubWindow();if(!win)return{ok:true,window:null,tabs:[],sessions:{}};const tabs=await chrome.tabs.query({windowId:win.id}),map=await osminogSessionMap(),byTab=new Map();for(const [provider,state] of Object.entries(map))if(state?.tabId)byTab.set(Number(state.tabId),provider);const live=new Set(tabs.map(t=>Number(t.id))),cleaned={};for(const [provider,state] of Object.entries(map))if(live.has(Number(state?.tabId)))cleaned[provider]=state;if(Object.keys(cleaned).length!==Object.keys(map).length)await osminogSaveSessionMap(cleaned);return{ok:true,window:{id:win.id,state:win.state,focused:win.focused},sessions:cleaned,tabs:tabs.map(t=>({id:t.id,title:t.title||"Новая вкладка",url:t.url||"",status:t.status||"",active:!!t.active,provider:byTab.get(Number(t.id))||bcProviderFromUrl(t.url||"")||"web"}))}}
async function osminogHubConnect(tabId,provider=""){const tab=await chrome.tabs.get(Number(tabId));provider=osminogProviderKey(provider||bcProviderFromUrl(tab.url||""));if(!provider||provider==="web")return{ok:false,error:"Это обычная веб-вкладка"};return bcConnectProviderTab(provider,tab.id)}
chrome.windows?.onRemoved?.addListener?.(async id=>{const saved=(await chrome.storage.local.get(OSMINOG_BROWSER_HUB_KEY))?.[OSMINOG_BROWSER_HUB_KEY];if(saved?.windowId===id)await chrome.storage.local.remove(OSMINOG_BROWSER_HUB_KEY)});
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(!message)return;
  if(message.type==="BC_PROVIDER_DISCOVER"){(async()=>{try{sendResponse({ok:true,...await bcDiscoverProvider(String(message.provider||""))})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_PROVIDER_CONNECT_TAB"){(async()=>{try{sendResponse(await bcConnectProviderTab(String(message.provider||""),message.tabId||null))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_PROVIDER_CUSTOM_SAVE"){(async()=>{try{const cfg=message.config||{},baseUrl=String(cfg.baseUrl||"").trim(),model=String(cfg.model||"").trim();if(!baseUrl||!model)throw new Error("Base URL и model обязательны");await chrome.storage.local.set({[BC_CUSTOM_PROVIDER_KEY]:{name:String(cfg.name||"Custom AI"),baseUrl,model,apiKey:String(cfg.apiKey||""),systemPrompt:String(cfg.systemPrompt||"")}});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_PROVIDER_CUSTOM_GET"){(async()=>{const cfg=(await chrome.storage.local.get(BC_CUSTOM_PROVIDER_KEY))?.[BC_CUSTOM_PROVIDER_KEY]||{};sendResponse({ok:true,config:{name:cfg.name||"",baseUrl:cfg.baseUrl||"",model:cfg.model||"",apiKey:cfg.apiKey||"",systemPrompt:cfg.systemPrompt||""}})})();return true;}
  if(message.type==="BC_EXTERNAL_CONNECT_CHATGPT"){(async()=>{try{const tab=await bcFindChatGptTab();if(!tab)throw new Error("Открой нужный чат ChatGPT и повтори подключение. OSMINOG не создаёт новые вкладки.");bcExternalRole=["view","comment","edit"].includes(message.role)?message.role:"view";sendResponse(await bcConfigureExternalTab(tab,message.context||{}))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_EXTERNAL_CONTEXT_UPDATE"){(async()=>{try{if(!bcExternalTabId)throw new Error("External ChatGPT не подключён");await chrome.tabs.sendMessage(bcExternalTabId,{type:"BC_LITE_CONTEXT",context:message.context||{}});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_EXTERNAL_TOOL_RESULT"){(async()=>{try{if(!bcExternalTabId)throw new Error("External ChatGPT не подключён");const r=await chrome.tabs.sendMessage(bcExternalTabId,{type:"BC_LITE_TOOL_RESULT",payload:message.payload||{}});sendResponse(r||{ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_PROVIDER_TAB_BRIDGE_READY"){sendResponse?.({ok:true});return;}
  if(message.type==="BC_PROVIDER_SEND"){(async()=>{try{sendResponse(await bcProviderSend(message.payload||{}))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_PROVIDER_TOOL_RESULT"){(async()=>{try{const q=message.payload||{};sendResponse(await bcProviderSend(q,q.result||{}))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_LITE_EXTERNAL_USER"&&_sender?.tab?.id&&_sender.tab.id===bcExternalTabId){chrome.runtime.sendMessage({type:"BC_LITE_EXTERNAL_USER",payload:message.payload||{}}).catch(()=>{});sendResponse?.({ok:true});return;}
  if(message.type==="BC_LITE_ASSISTANT_RESULT"&&_sender?.tab?.id&&_sender.tab.id===bcExternalTabId){chrome.runtime.sendMessage({type:"BC_EXTERNAL_ASSISTANT_RESULT",payload:message.payload||{},role:bcExternalRole}).catch(()=>{});sendResponse?.({ok:true});return;}
  if(message.type==="BC_MODULE_TOOL"){(async()=>{try{sendResponse(await bcModuleTool(String(message.name||""),message.args||{}))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_MODULE_FETCH"){(async()=>{try{const url=new URL(String(message.url||""));if(!/^https?:$/.test(url.protocol))throw new Error("Unsupported network protocol");const options=message.options||{},method=["GET","POST","PUT","PATCH","DELETE"].includes(String(options.method||"GET"))?String(options.method||"GET"):"GET",headers={};for(const [k,v] of Object.entries(options.headers||{}))if(!/^(cookie|host|origin|referer|content-length)$/i.test(k))headers[k]=String(v);const response=await fetch(url.href,{method,headers,body:["GET","HEAD"].includes(method)?undefined:(options.body??undefined),credentials:"omit",redirect:"follow"}),responseType=String(options.responseType||"text").toLowerCase();if(["arraybuffer","binary","base64"].includes(responseType)){const buf=await response.arrayBuffer();if(buf.byteLength>32*1024*1024)throw new Error("Module binary response exceeds 32 MB");const bytes=new Uint8Array(buf);let raw="";for(let i=0;i<bytes.length;i+=0x8000)raw+=String.fromCharCode(...bytes.subarray(i,i+0x8000));sendResponse({ok:response.ok,status:response.status,binary:true,base64:btoa(raw),mime:response.headers.get("content-type")||"application/octet-stream",size:bytes.length,error:response.ok?"":`HTTP ${response.status}`});return}const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data=raw.slice(0,2_000_000)}sendResponse({ok:response.ok,status:response.status,data,mime:response.headers.get("content-type")||"",error:response.ok?"":`HTTP ${response.status}`})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_MODULE_TEST"){(async()=>{try{const kind=String(message.module||""),token=String(message.token||"").trim();if(!token)throw new Error("Token пустой");if(kind==="figma"){const r=await fetch("https://api.figma.com/v1/me",{headers:{"X-Figma-Token":token}}),raw=await r.text();if(!r.ok)throw new Error(`Figma HTTP ${r.status}: ${raw.slice(0,180)}`);const d=JSON.parse(raw);sendResponse({ok:true,name:d.handle||d.email||"Figma"});return}if(kind==="github"){const headers={Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},request=async url=>{const r=await fetch(url,{headers}),raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}return{ok:r.ok,status:r.status,data,raw}};const user=await request("https://api.github.com/user");if(!user.ok)throw new Error(`GitHub account HTTP ${user.status}: ${typeof user.data==="string"?user.data.slice(0,180):user.data?.message||user.raw.slice(0,180)}`);const repos=["jeep-jim/OSMINOG","jeep-jim/OSMINOG-Releases"],checks=[];for(const repo of repos){const rr=await request(`https://api.github.com/repos/${repo}`);if(rr.status===404){checks.push({repo,visible:false,write:false,status:404});continue}if(!rr.ok)throw new Error(`GitHub ${repo} HTTP ${rr.status}: ${typeof rr.data==="string"?rr.data.slice(0,180):rr.data?.message||rr.raw.slice(0,180)}`);const p=rr.data?.permissions||{},write=!!(p.admin||p.maintain||p.push);checks.push({repo,visible:true,write,status:rr.status,permissions:p,private:!!rr.data?.private})}const missing=checks.filter(x=>!x.visible),readonly=checks.filter(x=>x.visible&&!x.write),ownerOk=!missing.length&&!readonly.length;if(!ownerOk){const code=missing.length?"repo_access":"repo_write",detail=missing.length?`Токен GitHub работает, но не видит: ${missing.map(x=>x.repo).join(", ")}. В fine-grained token открой Repository access → Only select repositories и добавь OSMINOG + OSMINOG-Releases.`:`Токен видит репозитории, но не имеет записи: ${readonly.map(x=>x.repo).join(", ")}. Нужен Contents: Read and write.`;sendResponse({ok:false,accountOk:true,name:user.data?.login||user.data?.name||"GitHub",code,error:detail,owner:{ok:false,checks}});return}sendResponse({ok:true,accountOk:true,name:user.data?.login||user.data?.name||"GitHub",owner:{ok:true,checks,repositories:repos}});return}if(kind==="gemini"){const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?key="+encodeURIComponent(token)),raw=await r.text();if(!r.ok)throw new Error(`Gemini HTTP ${r.status}: ${raw.slice(0,180)}`);sendResponse({ok:true,name:"Google AI · Gemini"});return}throw new Error("Unsupported module") }catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_BROWSER_HUB_LIST"){(async()=>{try{sendResponse(await osminogHubList())}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_SESSION_GET_OR_CREATE"){(async()=>{try{sendResponse(await osminogHubOpen({url:message.url,provider:message.provider,active:!!message.active,reuse:message.reuse!==false,allowCreate:message.allowCreate!==false}))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_SESSION_CONNECT_EXISTING"){(async()=>{try{sendResponse(await osminogConnectExisting(String(message.provider||""),message.tabId||null))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_SESSION_AUTHORIZE"){(async()=>{try{sendResponse(await osminogAuthorizeProvider(String(message.provider||"")))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_SESSION_CONNECT"){(async()=>{try{sendResponse(await osminogHubConnect(Number(message.tabId),String(message.provider||"")))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_SESSION_LIST"){(async()=>{try{sendResponse(await osminogSessionList())}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_BROWSER_HUB_OPEN"){(async()=>{try{sendResponse(await osminogHubOpen({url:message.url,provider:message.provider,active:message.active===true,reuse:message.reuse!==false,allowCreate:message.allowCreate!==false}))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_BROWSER_HUB_SHOW"){(async()=>{try{const w=await osminogHubWindow();if(!w)throw new Error("Служебное окно ещё не создано");await chrome.windows.update(w.id,{state:"normal",focused:true});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_BROWSER_HUB_HIDE"){(async()=>{try{const w=await osminogHubWindow();if(w)await chrome.windows.update(w.id,{state:"minimized",focused:false});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_BROWSER_HUB_FOCUS_TAB"){(async()=>{try{const tab=await chrome.tabs.get(Number(message.tabId));await chrome.windows.update(tab.windowId,{state:"normal",focused:true});await chrome.tabs.update(tab.id,{active:true});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_BROWSER_HUB_CLOSE_TAB"){(async()=>{try{await chrome.tabs.remove(Number(message.tabId));sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="OSMINOG_BROWSER_HUB_CONNECT"){(async()=>{try{sendResponse(await osminogHubConnect(message.tabId,message.provider||""))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_GOOGLE_AI_SERVICE_STATUS"){(async()=>sendResponse({ok:true,...await bcGoogleServiceState()}))();return true;}
  if(message.type==="BC_GOOGLE_AI_SERVICE_CONNECT"){(async()=>{try{sendResponse(await bcEnsureGoogleServiceTab({allowCreate:true}))}catch(e){sendResponse({ok:false,error:e?.message||String(e),tabId:e?.tabId||null})}})();return true;}
  if(message.type==="BC_GOOGLE_AI_SERVICE_OPEN"){(async()=>{try{const st=await bcGoogleServiceState();if(!st.tabId)throw new Error("Служебная вкладка ещё не создана");await chrome.tabs.update(st.tabId,{active:true});if(st.windowId!=null)await chrome.windows.update(st.windowId,{focused:true}).catch(()=>{});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_GOOGLE_AI_SEND"){(async()=>{try{sendResponse(await bcGoogleAiWidgetSend(message.query||"",{requestId:message.requestId,canvasContext:message.canvasContext||{},images:Array.isArray(message.images)?message.images:[]}))}catch(e){sendResponse({ok:false,error:e?.message||String(e),tabId:e?.tabId||null})}})();return true;}
  if(message.type==="BC_WEB_SEARCH"){(async()=>{try{sendResponse(await bcWebSearch(String(message.query||""),Math.max(1,Math.min(10,Number(message.limit)||8))))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_WEB_IMAGE_SEARCH"){(async()=>{try{sendResponse(await bcWebImageSearch(String(message.query||""),Math.max(1,Math.min(10,Number(message.limit)||6))))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_WEB_FETCH"){(async()=>{try{sendResponse(await bcWebFetch(String(message.url||""),Math.max(1000,Math.min(30000,Number(message.maxChars)||16000))))}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;}
  if(message.type==="BC_LITE_CONNECT_GPT"){
    (async()=>{try{bcDirectContext=message.context||bcDirectContext;const probe=await bcProbe();sendResponse({ok:!!probe.ok,ready:!!probe.ok,direct:true,probe,error:probe.ok?"":probe.error||`stage ${probe.stage}`})}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;
  }
  if(message.type==="BC_LITE_CONTEXT_UPDATE"){bcDirectContext=message.context||bcDirectContext;sendResponse?.({ok:true,direct:true});return;}
  if(message.type==="BC_LITE_SEND_INTERNAL"){
    (async()=>{try{const p=message.payload||{};const requestId=p.requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const result=await bcSendDirect({text:p.text||"",context:p.context||bcDirectContext||{},requestId,images:p.images||[]});sendResponse(result)}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;
  }
  if(message.type==="BC_LITE_TOOL_RESULT"){
    (async()=>{try{const p=message.payload||{};const requestId=p.requestId||`bc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const result=await bcSendDirect({context:p.context||bcDirectContext||{},requestId,toolResult:p.result||{},images:p.imageDataUrl?[{name:"osminog-tool-result.png",type:"image/png",dataUrl:p.imageDataUrl}]:[]});sendResponse(result)}catch(e){sendResponse({ok:false,error:e?.message||String(e)})}})();return true;
  }
});

function bcProviderFromUrl(url=""){try{const u=new URL(url),h=u.hostname;if(h==="chatgpt.com"||h==="chat.openai.com")return"gpt";if(h==="chat.deepseek.com"||h.endsWith(".deepseek.com"))return"deepseek";if(h==="claude.ai"||h.endsWith(".claude.ai"))return"claude";if(h==="gemini.google.com")return"gemini";if(/(^|\.)google\.com$/i.test(h)&&(/\/ai\/?$/i.test(u.pathname)||(u.pathname==="/search"&&u.searchParams.get("udm")==="50")))return"googleai";for(const [provider,target] of Object.entries(OSMINOG_PROVIDER_URLS)){if(["gpt","chatgpt","googleai","gemini","nano-banana"].includes(provider))continue;try{if(new URL(target).origin===u.origin)return provider}catch{}}}catch{}return""}
async function bcDisconnectLinkedTab(tabId,reason="closed",nextUrl=""){const links=await bcProviderLinks(),sessions=await osminogSessionMap(),providers=new Set();for(const [provider,state] of Object.entries(links))if(Number(state?.tabId)===Number(tabId)&&(!nextUrl||!bcProviderMatchesUrl(provider,nextUrl))){delete links[provider];providers.add(provider)}for(const [provider,state] of Object.entries(sessions))if(Number(state?.tabId)===Number(tabId)&&(!nextUrl||!bcProviderMatchesUrl(provider,nextUrl))){delete sessions[provider];providers.add(provider)}if(providers.size){await Promise.all([bcSaveProviderLinks(links),osminogSaveSessionMap(sessions)]);for(const provider of providers)chrome.runtime.sendMessage({type:"OSMINOG_SESSION_DISCONNECTED",provider,tabId,reason}).catch(()=>{})}return[...providers]}
chrome.tabs?.onUpdated?.addListener?.((tabId,change,tab)=>{const url=change.url||tab?.url||"",provider=bcProviderFromUrl(url);if(change.url)bcDisconnectLinkedTab(tabId,"navigated",url).catch(()=>{});if(provider&&(change.status==="complete"||change.url))chrome.runtime.sendMessage({type:"BC_PROVIDER_TAB_AVAILABLE",provider,tabId,title:tab?.title||provider}).catch(()=>{})});
chrome.tabs?.onCreated?.addListener?.(tab=>{const provider=bcProviderFromUrl(tab?.url||"");if(provider)chrome.runtime.sendMessage({type:"BC_PROVIDER_TAB_AVAILABLE",provider,tabId:tab.id,title:tab.title||provider}).catch(()=>{})});
chrome.tabs?.onRemoved?.addListener?.(id=>{if(id===bcExternalTabId)bcExternalTabId=null;bcDisconnectLinkedTab(id,"closed").catch(()=>{});osminogForgetSessionTab(id).catch(()=>{})});


/* OSMINOG 3.8.62 · public chat request/response bridge for canvas widgets.
   Uses the existing provider transports and validated osminog.patch/v1 parser.
   Legacy BRIEFCRAFT_* action names remain accepted only for compatibility. */
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  const action=String(message?.action||message?.type||"");
  if(action!=="OSMINOG_CHAT_REQUEST"&&action!=="BRIEFCRAFT_CHAT_REQUEST")return;
  (async()=>{
    const input=message?.payload||{};
    const text=String(input.message||input.text||"").trim();
    if(!text)throw new Error("Пустое сообщение");
    const provider=String(input.provider||"gpt").trim().toLowerCase();
    const context=input.canvasContext||input.context||bcDirectContext||{};
    const requestId=String(input.requestId||`osminog-${Date.now()}-${Math.random().toString(36).slice(2,7)}`);
    let result;
    if(provider==="googleai"||provider==="google-ai"||provider==="gemini-search"){
      const got=await bcGoogleAiWidgetSend(text);
      if(!got?.ok)throw new Error(got?.error||"Google AI request failed");
      const parsed=bcParseAssistant(got.answer||"");
      result={ok:true,requestId,payload:{requestId,...parsed},diag:{provider:"googleai",model:got.model||"Google AI"}};
    }else if(provider==="gpt"||provider==="chatgpt"){
      result=await bcSendDirect({text,context,requestId,images:Array.isArray(input.images)?input.images:[]});
    }else{
      result=await bcProviderSend({provider,text,context,requestId,apiKey:String(input.apiKey||"")});
    }
    const payload=result?.payload||{};
    const response={
      action:"OSMINOG_CHAT_RESPONSE",
      ok:true,
      requestId:payload.requestId||requestId,
      provider,
      text:String(payload.text||""),
      patch:payload.patch||null,
      request:payload.request||null,
      diag:result?.diag||null
    };
    chrome.runtime.sendMessage(response).catch(()=>{});
    chrome.runtime.sendMessage({...response,action:"BRIEFCRAFT_CHAT_RESPONSE"}).catch(()=>{});
    sendResponse(response);
  })().catch(error=>{
    const response={action:"OSMINOG_CHAT_RESPONSE",ok:false,error:error?.message||String(error),text:`Ошибка выполнения команды: ${error?.message||String(error)}`};
    chrome.runtime.sendMessage(response).catch(()=>{});
    chrome.runtime.sendMessage({...response,action:"BRIEFCRAFT_CHAT_RESPONSE"}).catch(()=>{});
    sendResponse(response);
  });
  return true;
});

/* Microfix 3.8.33: reopen OSMINOG editor after extension reload/update */
(async()=>{
  const KEY="briefCraftReopenAfterUpdateV1";
  try{
    const got=await chrome.storage.local.get(KEY),req=got?.[KEY];
    if(!req)return;
    const at=Number(req.at||0);
    if(!at||Date.now()-at>120000){await chrome.storage.local.remove(KEY);return}
    await chrome.storage.local.remove(KEY);
    await new Promise(r=>setTimeout(r,350));
    const editorUrl=chrome.runtime.getURL(String(req.url||"editor.html").replace(/^\/+/,""));
    const tabs=await chrome.tabs.query({});
    const existing=tabs.find(t=>typeof t.url==="string"&&t.url.startsWith(chrome.runtime.getURL("editor.html")));
    if(existing?.id){
      await chrome.tabs.update(existing.id,{active:true});
      if(existing.windowId!=null)try{await chrome.windows.update(existing.windowId,{focused:true})}catch{}
    }else{
      await chrome.tabs.create({url:editorUrl,active:true});
    }
  }catch{}
})();
