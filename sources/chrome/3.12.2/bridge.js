"use strict";
(()=>{
  const STORE_KEY="briefCraftPresenceV2";
  const CFG=globalThis.BRIEFCRAFT_CLOUD_CONFIG||{};
  const I18N={
    ru:{heading:"AI Presence",setupTitle:"Подключить ChatGPT",setupText:"Одно нажатие. Без API‑ключа, отдельной программы и выгрузки холста в чат. OSMINOG держит проект локально и отвечает только на конкретные инструменты ChatGPT.",presence:"OSMINOG подключён",presenceSub:"ChatGPT может запрашивать объекты холста через инструменты. Полная синхронизация не отправляется.",noSelection:"Сейчас на холсте ничего не выделено.",patchApplied:"Правки ИИ применены",patchDismissed:"Правки ИИ отклонены",wrongProject:"Эта правка относится к другому проекту.",unsafePatch:"Правка содержит неподдерживаемые действия.",proposal:"ИИ предлагает изменения",apply:"Применить проверенные правки",dismiss:"Отклонить",connected:"OSMINOG подключён к AI Presence",disconnected:"AI Presence отключён",relayMissing:"Relay ещё не настроен издателем OSMINOG.",relayOffline:"OSMINOG Relay недоступен. Повторяю подключение в фоне.",permissionDenied:"Нужно разрешить доступ только к серверу OSMINOG Relay.",waiting:"Ожидаю запросы ChatGPT",accessReadWrite:"чтение + предложения",accessRead:"только чтение",accessSelection:"только выделение",relayReady:"OSMINOG Relay готов",relayConnecting:"Подключаю OSMINOG…",relayLive:"ChatGPT ↔ OSMINOG готов"},
    en:{heading:"AI Presence",setupTitle:"Connect ChatGPT",setupText:"One click. No API key, companion app or canvas dump into chat. OSMINOG keeps the project local and answers only the ChatGPT tools that are actually called.",presence:"OSMINOG is connected",presenceSub:"ChatGPT can request canvas objects through tools. No full synchronization is sent.",noSelection:"Nothing is selected on the canvas right now.",patchApplied:"AI patch applied",patchDismissed:"AI patch dismissed",wrongProject:"This patch belongs to a different project.",unsafePatch:"The patch contains unsupported actions.",proposal:"AI proposes changes",apply:"Apply reviewed patch",dismiss:"Dismiss",connected:"OSMINOG connected to AI Presence",disconnected:"AI Presence disconnected",relayMissing:"The OSMINOG publisher has not configured the relay yet.",relayOffline:"OSMINOG Relay is unavailable. Reconnecting in the background.",permissionDenied:"OSMINOG needs permission only for its relay server.",waiting:"Waiting for ChatGPT requests",accessReadWrite:"read + propose",accessRead:"read only",accessSelection:"selection only",relayReady:"OSMINOG Relay is ready",relayConnecting:"Connecting OSMINOG…",relayLive:"ChatGPT ↔ OSMINOG ready"}
  };
  const lang=()=>state.language==="ru"?"ru":"en";
  const t=k=>I18N[lang()][k]||I18N.en[k]||k;
  const accessLabel=()=>store.access==="readwrite"?t("accessReadWrite"):store.access==="selection"?t("accessSelection"):t("accessRead");
  const deepClone=v=>JSON.parse(JSON.stringify(v));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const clip=(value,max=4000)=>{const s=String(value??"");return s.length>max?s.slice(0,max)+`\n… [${s.length-max} more chars]`:s};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  let store={access:"readwrite",mirrors:{},pendingPatch:null,connected:false,deviceToken:"",toolEvents:[],requestCount:0};
  let socket=null,reconnectTimer=0,reconnectAttempt=0,manualDisconnect=false,statusTimer=0;
  const TOOL_GROUPS={
    system:["capabilities","tool_list"],
    canvas:["canvas_status","list_canvas_objects","get_project_map","get_selection","get_viewport","get_object","get_connections","search_canvas","get_recent_changes","read_object_text","read_code","read_browser_dom","capture_selection_image","capture_object_image","capture_viewport_image","capture_canvas_overview_image","focus_object","propose_canvas_patch","undo_last_change"],
    assets:["read_asset","asset_create"],
    projects:["project_list","project_create","project_switch","project_rename","project_folder_status","project_folder_list","project_folder_read","project_folder_write"],
    agents:["agent_list","agent_create","agent_update","agent_remove","agent_message"],
    commands:["command_list","command_register","command_remove","command_run"],
    browser:["browser_tabs","browser_open","browser_close","web_search","web_fetch"],
    documents:["markdown_list","markdown_read","markdown_write"],
    media:["provider_list","provider_open","media_crew"],
    modules:["module_list","module_open","module_permissions_revoke"],
    source:["dev_status","list_dev_files","read_dev_file","write_dev_file","source_publish","release_publish"],
    github:["module_status","github_status","github_list_tree","github_search_code","github_fetch_file","github_compare","github_create_branch","github_commit_files","github_open_pr","github_workflow_runs","github_dispatch_workflow"],
    integrations:["figma_fetch_file"]
  };
  const MUTATING_TOOLS=new Set(["propose_canvas_patch","undo_last_change","asset_create","project_create","project_switch","project_rename","project_folder_write","agent_create","agent_update","agent_remove","command_register","command_remove","command_run","write_dev_file","source_publish","release_publish","github_create_branch","github_commit_files","github_open_pr","github_dispatch_workflow"]);
  let externalExecutionRole="";
  function capabilityManifest(){return{protocol:"osminog.capabilities/v1",mode:store.access==="readwrite"?"owner-max":store.access,groups:deepClone(TOOL_GROUPS),tools:[...new Set(Object.values(TOOL_GROUPS).flat())],limits:{callsPerHop:8,toolHops:12,canvasPatchActions:80},safety:{canvasWrites:"validated osminog.patch/v1 with undo",sourceWrites:"Poseidon toggle plus selected local source folder",githubWrites:"explicit owner confirmation; source_publish archives source, release_publish archives and publishes updater feed",commandChanges:"owner confirmation"},runtime:{kind:"chrome-extension",nativeShell:false,generativeMedia:"provider-dependent"}}}

  function projectKey(){return project()?.id||"__none__"}
  function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("")}
  function ensureDeviceToken(){if(!store.deviceToken)store.deviceToken=randomToken();return store.deviceToken}
  const saveStore=()=>storageSet({[STORE_KEY]:store}).catch(()=>{});
  function relayHttp(){return String(CFG.relayHttpBase||"").replace(/\/+$/,"")}
  function relayWs(){const direct=String(CFG.relayWsBase||"").replace(/\/+$/,"");if(direct)return direct;return relayHttp().replace(/^https:/,"wss:").replace(/^http:/,"ws:")}
  function relayConfigured(){return /^https?:\/\//.test(relayHttp())&&/^wss?:\/\//.test(relayWs())}
  function relayOrigin(){try{return new URL(relayHttp()).origin}catch{return""}}
  async function ensureRelayPermission(){const origin=relayOrigin();if(!origin)return false;try{const pattern=origin+"/*";if(await chrome.permissions.contains({origins:[pattern]}))return true;return await chrome.permissions.request({origins:[pattern]})}catch{return false}}

  async function loadStore(){
    const got=await storageGet([STORE_KEY,"briefCraftPendingPatchV1"]);
    store={...store,...(got[STORE_KEY]||{}),mirrors:{...(got[STORE_KEY]?.mirrors||{})},toolEvents:Array.isArray(got[STORE_KEY]?.toolEvents)?got[STORE_KEY].toolEvents:[]};
    ensureDeviceToken();
    if(!store.pendingPatch&&got.briefCraftPendingPatchV1?.patch){store.pendingPatch=got.briefCraftPendingPatchV1.patch;await storageSet({briefCraftPendingPatchV1:null}).catch(()=>{})}
    const access=document.getElementById("liveAiAccess");if(access)access.value=store.access||"readwrite";
    applyLanguage();renderPatch();refreshMirror();renderToolLog();renderRelayHealth();renderConnector();
    // Legacy relay transport is disabled in 3.8 Browser Transport Lite.
    store.connected=false;
  }
  function applyLanguage(){
    const map={bridgeHeading:t("heading"),connectorSetupTitle:t("setupTitle"),connectorSetupText:t("setupText"),bridgeSyncText:t("presence"),bridgeSyncSub:`${t("presenceSub")} · ${accessLabel()}`,bridgePatchTitle:t("proposal"),bridgeDismissPatch:t("dismiss"),bridgeApplyPatch:t("apply")};
    for(const[id,val]of Object.entries(map)){const el=document.getElementById(id);if(el)el.textContent=val}
  }
  function fastTextSig(value){
    const s=String(value??"");if(!s)return"0:";
    const points=8,part=48;let sample="";
    for(let i=0;i<points;i++){const pos=Math.floor((Math.max(0,s.length-part))*i/Math.max(1,points-1));sample+=s.slice(pos,pos+part)}
    let h=2166136261;for(let i=0;i<sample.length;i++){h^=sample.charCodeAt(i);h=Math.imul(h,16777619)}
    return`${s.length}:${(h>>>0).toString(36)}`;
  }
  function objectFingerprint(o){
    return[
      o.type,o.name,Math.round(o.x),Math.round(o.y),Math.round(o.w),Math.round(o.h),Number(o.rotation||0),o.visible!==false,o.group||"",
      o.fill||"",o.fill2||"",o.fillType||"",o.fillEnabled!==false,o.stroke||"",Number(o.strokeWidth||0),o.strokeEnabled!==false,Number(o.opacity??1),Number(o.radius||0),
      o.textColor||"",o.fontSize||"",o.fontWeight||"",o.padding||"",fastTextSig(o.title),fastTextSig(o.text),fastTextSig(o.label),fastTextSig(o.code),fastTextSig(o.snapshotHtml),o.url||""
    ].join("|");
  }
  function connectionFingerprint(c){return[c.from,c.to,c.fromPort||"",c.toPort||"",c.style||"curve",c.color||"",Number(c.width||0),!!c.dashed,c.arrow!==false,Number(c.order||0),fastTextSig(c.label),fastTextSig(c.description)].join("|")}
  function lightSnapshot(){
    const p=project();if(!p)return null;
    const obj={};for(const o of objects())obj[o.id]=objectFingerprint(o);
    const con={};for(const c of p.connections||[])con[c.id]=connectionFingerprint(c);
    return{objects:obj,connections:con,canvas:JSON.stringify(p.canvas||{}),selected:[...state.selected]};
  }
  function diffKeys(a={},b={}){const added=[],removed=[],changed=[];for(const id of Object.keys(b)){if(!(id in a))added.push(id);else if(a[id]!==b[id])changed.push(id)}for(const id of Object.keys(a))if(!(id in b))removed.push(id);return{added,removed,changed}}
  function refreshMirror(){
    const p=project();if(!p)return null;const id=p.id,current=lightSnapshot();const old=store.mirrors[id]?.snapshot||null;let revision=store.mirrors[id]?.revision||0;let lastDiff={revision,objects:{added:[],removed:[],changed:[]},connections:{added:[],removed:[],changed:[]},canvasChanged:false,selectionChanged:false};
    if(old){const od=diffKeys(old.objects,current.objects),cd=diffKeys(old.connections,current.connections),canvasChanged=old.canvas!==current.canvas,selectionChanged=JSON.stringify(old.selected)!==JSON.stringify(current.selected);if(od.added.length||od.removed.length||od.changed.length||cd.added.length||cd.removed.length||cd.changed.length||canvasChanged||selectionChanged){revision+=1;lastDiff={revision,objects:od,connections:cd,canvasChanged,selectionChanged}}}
    else revision=1;
    store.mirrors[id]={revision,snapshot:current,lastDiff,updated:Date.now()};saveStore();updateStatusBadges();return store.mirrors[id]
  }
  function updateStatusBadges(){const m=store.mirrors[projectKey()]||{revision:0,lastDiff:{}};const rev=$("#bridgeRevision");if(rev)rev.textContent=`rev ${m.revision||0}`;const d=m.lastDiff||{},n=(d.objects?.added?.length||0)+(d.objects?.removed?.length||0)+(d.objects?.changed?.length||0)+(d.connections?.added?.length||0)+(d.connections?.removed?.length||0)+(d.connections?.changed?.length||0)+(d.canvasChanged?1:0);const count=$("#bridgeChangeCount");if(count)count.textContent=`${n} ${lang()==="ru"?"изм.":"changes"}`}

  function viewportBounds(){const el=$("#viewport"),scale=state.view.scale||1;if(!el)return null;const r=el.getBoundingClientRect();return{x1:(-state.view.x)/scale,y1:(-state.view.y)/scale,x2:(r.width-state.view.x)/scale,y2:(r.height-state.view.y)/scale}}
  function inBounds(o,b){return !b||o.x+o.w>=b.x1&&o.x<=b.x2&&o.y+o.h>=b.y1&&o.y<=b.y2}
  function textExcerpt(o,max=240){const value=o.text||o.title||o.label||"";return clip(value,max)}
  function objectSummary(o){
    const out={id:o.id,type:o.type,name:o.name||o.type,bounds:{x:Math.round(o.x),y:Math.round(o.y),w:Math.round(o.w),h:Math.round(o.h)},rotation:Number(o.rotation||0),visible:o.visible!==false,group:o.group||null,...(o.type==="shape"?{shapeKind:o.shapeKind||"rectangle"}:{}),...(o.type==="vector"?{path:{nodes:Array.isArray(o.pathNodes)?o.pathNodes.length:0,closed:o.pathClosed!==false}}:{})};
    if(["text","note","brief","node","button","task"].includes(o.type))out.textExcerpt=textExcerpt(o,260);
    if(o.type==="task")out.task={status:o.status||"ready",agents:Array.isArray(o.agents)?o.agents.slice(0,12):[],hasResult:!!o.result};
    if(o.type==="code")out.code={chars:String(o.code||"").length,preview:clip(o.code||"",180)};
    if(o.type==="browser")out.browser={url:o.url||"",htmlChars:String(o.snapshotHtml||"").length,title:extractHtmlTitle(o.snapshotHtml)||""};
    if(o.type==="ink")out.ink={points:Array.isArray(o.points)?o.points.length:0,stroke:o.stroke||null,strokeWidth:Number(o.strokeWidth||0),sample:Array.isArray(o.points)?o.points.slice(0,24).map(p=>({x:Math.round(p.x),y:Math.round(p.y)})):[]};if(o.type==="vector")out.vector={closed:o.pathClosed!==false,nodes:Array.isArray(o.pathNodes)?o.pathNodes.length:0};
    if(o.type==="image")out.asset={kind:"image",name:o.name||"image",embedded:!!o.src,masked:Array.isArray(o.maskNodes)&&o.maskNodes.length>2,liveUri:`osminog://asset/${o.id}`};
    if(o.type==="file")out.asset={kind:"file",name:o.fileName||o.name||"file",mime:o.mime||"",size:o.size||0,liveUri:`osminog://asset/${o.id}`,...(o.mime==="application/pdf"?{pdf:{page:Number(o.pdfPage)||1,edits:Array.isArray(o.pdfEdits)?o.pdfEdits.length:0}}:{})};
    return out;
  }
  function virtualModuleObjects(){const id="module:google-ai",bridge=globalThis.OSMINOGModuleNodeBridge,nw=bridge?.portPoint?.(id,"nw"),se=bridge?.portPoint?.(id,"se");if(!nw||!se)return[];return[{id,type:"module",name:"Google AI",x:Math.min(nw.x,se.x),y:Math.min(nw.y,se.y),w:Math.max(1,Math.abs(se.x-nw.x)),h:Math.max(1,Math.abs(se.y-nw.y)),rotation:0,visible:true,group:null,text:"OSMINOG Google AI module with eight connection ports"}]}
  function readableObjects(){return[...objects(),...virtualModuleObjects()]}
  function readableObject(id){return readableObjects().find(o=>o.id===id)||null}

  function objectDetail(o){
    const out={...objectSummary(o),style:{fill:o.fill??null,fill2:o.fill2??null,fillType:o.fillType||"solid",fillEnabled:o.fillEnabled!==false,stroke:o.stroke??null,strokeWidth:Number(o.strokeWidth||0),strokeEnabled:o.strokeEnabled!==false,opacity:Number(o.opacity??1),radius:Number(o.radius||0),corners:o.corners||null,textColor:o.textColor||null,fontSize:o.fontSize||null,fontWeight:o.fontWeight||null,padding:o.padding??null}};
    if(["text","note","brief","node","button","task"].includes(o.type)){out.title=clip(o.title||"",1200);out.text=clip(o.text||o.label||"",1600)}
    if(o.type==="task")out.task={status:o.status||"ready",agents:Array.isArray(o.agents)?deepClone(o.agents):[],result:clip(o.result||"",4000)};
    if(o.type==="code")out.editable={code:clip(o.code||"",10000)};
    if(o.type==="browser")out.editable={url:o.url||"",snapshotHtml:clip(o.snapshotHtml||"",10000)};
    if(o.type==="image")out.editable={imageFilter:o.imageFilter||"none",imageFit:o.imageFit||"contain",imageBlendMode:o.imageBlendMode||"normal",maskNodes:Array.isArray(o.maskNodes)?deepClone(o.maskNodes):null,maskClosed:o.maskClosed!==false};if(o.type==="vector")out.editable={pathNodes:Array.isArray(o.pathNodes)?deepClone(o.pathNodes):[],pathClosed:o.pathClosed!==false};if(o.type==="file"&&o.mime==="application/pdf")out.editable={pdfPage:Number(o.pdfPage)||1,pdfEdits:Array.isArray(o.pdfEdits)?deepClone(o.pdfEdits):[]};
    return out;
  }
  function extractHtmlTitle(html){if(!html)return"";const m=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);return m?m[1].replace(/<[^>]+>/g,"").trim():""}
  function connectionSummary(c){return{id:c.id,from:c.from,to:c.to,fromPort:c.fromPort||null,toPort:c.toPort||null,style:c.style||"curve",color:c.color||"#526fff",width:Number(c.width||3),dashed:!!c.dashed,arrow:c.arrow!==false,order:Number(c.order||0),label:clip(c.label||"",200),description:clip(c.description||"",300)}}
  function accessAllows(id){if(store.access!=="selection")return true;return state.selected.includes(id)}
  function requireObject(id){const o=objects().find(x=>x.id===id);if(!o)return{error:`Object ${id} does not exist`};if(!accessAllows(id))return{error:`Object ${id} is outside current Selection-only access`};return o}
  function themeFxSnapshot(){
    const api=globalThis.OSMINOGOceanTheme,spaceRaw=api?.getSpacePrefs?.()||{},oceanRaw=api?.getPrefs?.()||{};
    const spaceFx={stars:spaceRaw.stars!==false,satellites:spaceRaw.satellites!==false,meteors:spaceRaw.meteors!==false,galaxies:(spaceRaw.galaxies??spaceRaw.phenomena)!==false,density:["low","medium","high"].includes(spaceRaw.density)?spaceRaw.density:"medium",glow:["off","soft","bright"].includes(spaceRaw.glow||spaceRaw.luminescence)?(spaceRaw.glow||spaceRaw.luminescence):"soft"};
    const oceanFx={plankton:oceanRaw.plankton!==false,bubbles:oceanRaw.bubbles!==false,organics:oceanRaw.organics!==false,density:["low","medium","high"].includes(oceanRaw.density)?oceanRaw.density:"medium",glow:["off","soft","bright"].includes(oceanRaw.glow||oceanRaw.luminescence)?(oceanRaw.glow||oceanRaw.luminescence):"soft"};
    return{active:state.theme==="dark"?"space":state.theme==="ocean"?"ocean":"none",spaceFx,oceanFx};
  }
  function canvasToolState(p,compact=false){
    const base=compact?{grid:p?.canvas?.grid,size:p?.canvas?.size}:deepClone(p?.canvas||{}),fx=themeFxSnapshot();
    delete base.spaceFx;delete base.oceanFx;delete base.activeFx;delete base.fxProfiles;
    base.activeFx=fx.active;
    if(fx.active==="space")base.spaceFx=fx.spaceFx;else if(fx.active==="ocean")base.oceanFx=fx.oceanFx;
    base.fxProfiles={space:fx.spaceFx,ocean:fx.oceanFx};
    return base;
  }

  function canvasStatus(){const p=project();if(!p)return{error:"No active project"};const counts={};for(const o of objects())counts[o.type]=(counts[o.type]||0)+1;const mirror=refreshMirror();return{project:{id:p.id,name:p.name},revision:mirror?.revision||0,workspace:{language:state.language,theme:state.theme,mode:state.mode,tool:state.tool},canvas:canvasToolState(p,true),view:{scale:Number((state.view.scale||1).toFixed(3)),bounds:viewportBounds()},selectedIds:[...state.selected],counts,connections:(p.connections||[]).length,access:store.access}}
  function getSelection(args={}){const ids=[...state.selected];if(!ids.length)return{selectedIds:[],message:t("noSelection")};const selected=ids.map(id=>objects().find(o=>o.id===id)).filter(Boolean).map(objectDetail);const idSet=new Set(ids);let rawLinks=(project()?.connections||[]).filter(c=>idSet.has(c.from)||idSet.has(c.to));if(store.access==="selection")rawLinks=rawLinks.filter(c=>idSet.has(c.from)&&idSet.has(c.to));const links=rawLinks.map(connectionSummary);let neighbors=[];if(store.access!=="selection"&&args.include_neighbors!==false){const neighborIds=new Set();for(const c of rawLinks){if(!idSet.has(c.from))neighborIds.add(c.from);if(!idSet.has(c.to))neighborIds.add(c.to)}neighbors=[...neighborIds].map(id=>objects().find(o=>o.id===id)).filter(Boolean).map(objectSummary)}return{selectedIds:ids,objects:selected,connections:links,neighbors}}
  function listCanvasObjects(args={}){const offset=clamp(Number(args.offset)||0,0,100000),limit=clamp(Number(args.limit)||60,1,100),type=String(args.type||"").trim(),includePreview=!!args.include_preview;let list=objects();if(store.access==="selection")list=list.filter(o=>state.selected.includes(o.id));if(type)list=list.filter(o=>o.type===type);const total=list.length;const page=list.slice(offset,offset+limit).map(o=>{const base={id:o.id,type:o.type,name:o.name||o.type,bounds:{x:Math.round(o.x),y:Math.round(o.y),w:Math.round(o.w),h:Math.round(o.h)},rotation:Number(o.rotation||0),visible:o.visible!==false,group:o.group||null};if(includePreview){if(["text","note","brief","node","button","task"].includes(o.type))base.preview=textExcerpt(o,140);if(o.type==="task")base.task={status:o.status||"ready",agents:Array.isArray(o.agents)?o.agents.slice(0,8):[]};if(o.type==="code")base.preview=`code · ${String(o.code||"").length} chars`;if(o.type==="browser")base.preview=`${extractHtmlTitle(o.snapshotHtml)||o.url||"browser"} · ${String(o.snapshotHtml||"").length} html chars`}return base});return{total,offset,returned:page.length,hasMore:offset+page.length<total,objects:page}}
  function getViewport(args={}){const b=viewportBounds(),limit=clamp(Number(args.limit)||60,1,120);let list=objects().filter(o=>inBounds(o,b));if(store.access==="selection")list=list.filter(o=>state.selected.includes(o.id));const total=list.length;list=list.slice(0,limit).map(objectSummary);const ids=new Set(list.map(o=>o.id));const connections=(project()?.connections||[]).filter(c=>ids.has(c.from)&&ids.has(c.to)).slice(0,120).map(connectionSummary);return{bounds:b,total,returned:list.length,objects:list,connections}}
  function getObject(args={}){const o=requireObject(String(args.id||""));if(o?.error)return o;return objectDetail(o)}
  function getConnections(args={}){const id=String(args.id||"");if(id&&!accessAllows(id)&&id!=="module:google-ai")return{error:`Object ${id} is outside current Selection-only access`};let list=project()?.connections||[];if(id)list=list.filter(c=>c.from===id||c.to===id);if(store.access==="selection"){const set=new Set(state.selected);list=list.filter(c=>set.has(c.from)&&set.has(c.to))}return{connections:list.slice(0,160).map(connectionSummary),neighbors:id?[...new Set(list.flatMap(c=>[c.from,c.to]).filter(x=>x!==id))].map(readableObject).filter(Boolean).map(objectSummary):[]}}
  function getProjectMap(args={}){const p=project();if(!p)return{error:"No active project"};let list=readableObjects();if(store.access==="selection")list=list.filter(o=>state.selected.includes(o.id)||o.id==="module:google-ai");const max=clamp(Number(args.limit)||200,1,400),mapped=list.slice(0,max).map(objectSummary),ids=new Set(mapped.map(o=>o.id)),connections=(p.connections||[]).filter(c=>store.access!=="selection"||ids.has(c.from)&&ids.has(c.to)).slice(0,400).map(connectionSummary),memory=list.filter(o=>["brief","note","node","text","task","module"].includes(o.type)).slice(0,80).map(o=>({id:o.id,type:o.type,name:o.name||o.type,text:textExcerpt(o,520)}));return{project:{id:p.id,name:p.name},revision:refreshMirror()?.revision||0,totalObjects:list.length,returned:mapped.length,hasMore:mapped.length<list.length,canvas:canvasToolState(p,false),objects:mapped,connections,memory,instruction:"This is the compact persistent project map. Use it for broad awareness; request exact object bodies/crops only when needed."}}
  function snippetAround(text,q,max=260){const s=String(text||""),lower=s.toLowerCase(),idx=lower.indexOf(q.toLowerCase());if(idx<0)return"";const start=Math.max(0,idx-Math.floor(max/2));return clip(s.slice(start,start+max),max)}
  function searchCanvas(args={}){const q=String(args.query||"").trim();if(!q)return{error:"query is empty"};const limit=clamp(Number(args.limit)||20,1,40),results=[];for(const o of objects()){if(store.access==="selection"&&!state.selected.includes(o.id))continue;const fields=[["name",o.name],["title",o.title],["text",o.text],["label",o.label],["url",o.url],["code",o.code],["html",o.snapshotHtml]];for(const[field,value]of fields){if(value&&String(value).toLowerCase().includes(q.toLowerCase())){results.push({...objectSummary(o),matchedField:field,snippet:snippetAround(value,q)});break}}if(results.length>=limit)break}return{query:q,count:results.length,results}}
  function recentChanges(){const p=project();if(!p)return{error:"No active project"};const m=refreshMirror();return{revision:m.revision,lastDiff:m.lastDiff||{},selectedIds:[...state.selected]}}
  function readObjectText(args={}){const o=requireObject(String(args.id||""));if(o?.error)return o;if(!["text","note","brief","node","button","task"].includes(o.type))return{error:`Object ${o.id} is ${o.type}, not a text object`};const source=String(o.text||o.label||o.title||""),offset=clamp(Number(args.offset)||0,0,source.length),max=clamp(Number(args.max_chars)||5000,200,8000);return{id:o.id,totalChars:source.length,offset,returned:Math.min(max,Math.max(0,source.length-offset)),text:source.slice(offset,offset+max),hasMore:offset+max<source.length}}
  function readCode(args={}){const o=requireObject(String(args.id||""));if(o?.error)return o;if(o.type!=="code")return{error:`Object ${o.id} is ${o.type}, not code`};const source=String(o.code||""),offset=clamp(Number(args.offset)||0,0,source.length),max=clamp(Number(args.max_chars)||6000,200,10000);return{id:o.id,totalChars:source.length,offset,code:source.slice(offset,offset+max),hasMore:offset+max<source.length}}
  function readBrowserDom(args={}){const o=requireObject(String(args.id||""));if(o?.error)return o;if(o.type!=="browser")return{error:`Object ${o.id} is ${o.type}, not a browser snapshot`};const html=String(o.snapshotHtml||"");if(!html)return{id:o.id,url:o.url||"",error:"This browser object has no saved DOM snapshot"};const max=clamp(Number(args.max_chars)||6000,300,10000),mode=args.mode==="html"?"html":"text",selector=String(args.selector||"").trim();try{const doc=new DOMParser().parseFromString(html,"text/html");let nodes=[];if(selector)nodes=[...doc.querySelectorAll(selector)].slice(0,8);else nodes=[doc.body||doc.documentElement];let source=nodes.map(n=>mode==="html"?n.outerHTML:(n.innerText||n.textContent||"")).join("\n\n");source=source.replace(/\n{3,}/g,"\n\n").trim();return{id:o.id,url:o.url||"",title:doc.title||extractHtmlTitle(html),selector:selector||null,mode,matches:selector?nodes.length:1,totalChars:source.length,content:clip(source,max)}}catch(error){return{id:o.id,url:o.url||"",error:error.message||"Could not parse saved DOM"}}}
  function focusObjectTool(args={}){const o=requireObject(String(args.id||""));if(o?.error)return o;state.selected=[o.id];focusObject(o);renderAll();return{ok:true,focused:o.id}}
  async function webSearchTool(args={}){const query=String(args.query||"").trim();if(!query)return{error:"query is empty"};const allowed=await storageGet("briefCraftInternetResearchV1");if(!allowed?.briefCraftInternetResearchV1)return{error:"Internet research is disabled in OSMINOG GPT settings"};try{return await chrome.runtime.sendMessage({type:"BC_WEB_SEARCH",query,limit:clamp(Number(args.limit)||8,1,10)})}catch(error){return{error:error?.message||"Web search failed"}}}
  async function webFetchTool(args={}){const url=String(args.url||"").trim();if(!/^https?:\/\//i.test(url))return{error:"Only http/https URLs are supported"};const allowed=await storageGet("briefCraftInternetResearchV1");if(!allowed?.briefCraftInternetResearchV1)return{error:"Internet research is disabled in OSMINOG GPT settings"};try{return await chrome.runtime.sendMessage({type:"BC_WEB_FETCH",url,maxChars:clamp(Number(args.max_chars)||16000,1000,30000)})}catch(error){return{error:error?.message||"Web fetch failed"}}}
  async function devTool(name,args={}){const D=globalThis.BriefCraftDevTools;if(!D)return{error:"Poseidon developer tools are unavailable"};if(name==="dev_status")return D.status();if(name==="list_dev_files")return D.listFiles(args);if(name==="read_dev_file")return D.readFile(args);if(name==="write_dev_file")return D.writeFile(args);if(name==="source_publish"||name==="release_publish"){if(typeof D.buildRelease!=="function")return{error:"Poseidon release builder is unavailable"};const approved=await globalThis.OSMINOGConfirmGitHubAction?.(name,args||{});if(!approved)return{error:"Publication cancelled by owner"};const built=await D.buildRelease(args);if(!built?.ok)return built||{error:"Package build failed"};const payload={...args,...built,__ownerApproved:true};const response=await chrome.runtime.sendMessage({type:"BC_MODULE_TOOL",name:name==="source_publish"?"github_publish_source":"github_publish_release",args:payload});if(response?.ok===false)return{error:response.error};await D.markPublished?.();return{...response,packageBase64:undefined,files:undefined,key:undefined,built:{version:built.version,packageName:built.packageName,size:built.size,sha256:built.sha256,fileCount:built.fileCount}}}return{error:`Unknown developer tool ${name}`}}

  const OBJ_PROPS=new Set(["name","group","x","y","w","h","rotation","visible","fill","fill2","fillType","fillMode","fillEnabled","gradientAngle","stroke","strokeWidth","strokeEnabled","opacity","radius","corners","cornersLinked","textColor","fontSize","fontWeight","padding","title","text","label","code","codeViewMode","codeSplit","url","src","snapshotHtml","shapeKind","themeSurface","imageFilter","imageFit","imageBlendMode","action","actionValue","animation","states","launcherStyle","appIcon","appWindow","appDeveloperMode","pathNodes","pathClosed","maskNodes","maskClosed","pdfPage","pdfEdits","status","agents","result"]);
  const CONN_PROPS=new Set(["style","color","width","dashed","arrow","order","label","description","fromPort","toPort"]);
  function cleanProperties(input,allowed){const out={};for(const[k,v]of Object.entries(input||{})){if(!allowed.has(k)||["__proto__","prototype","constructor"].includes(k))continue;out[k]=deepClone(v)}return out}
  function normalizePatchAction(raw){
    if(!raw||typeof raw!=="object")return null;let op=String(raw.op||raw.action||raw.operation||"").toLowerCase();
    if(["update","modify","edit","resize","move","style","recolor","transform"].includes(op))op="set";
    const target=raw.target||raw.id||raw.objectId||raw.object_id||raw.connectionId||raw.connection_id;
    const from=raw.from||raw.source||raw.fromId||raw.from_id,to=raw.to||raw.destination||raw.toId||raw.to_id;
    let props={...(raw.properties||raw.props||raw.changes||raw.values||{})};
    if(raw.bounds&&typeof raw.bounds==="object")props={...props,...raw.bounds};
    for(const k of ["group","x","y","w","h","width","height","rotation","visible","fill","fill2","fillType","fillMode","fillEnabled","gradientAngle","stroke","strokeWidth","strokeEnabled","opacity","radius","textColor","fontSize","fontWeight","padding","title","text","label","code","codeViewMode","codeSplit","url","src","snapshotHtml","shapeKind","shape","imageFilter","imageFit","imageBlendMode","pathNodes","pathClosed","maskNodes","maskClosed"]){if(raw[k]!==undefined&&props[k]===undefined)props[k]=raw[k]}
    if(props.width!==undefined&&props.w===undefined)props.w=props.width;if(props.height!==undefined&&props.h===undefined)props.h=props.height;delete props.width;delete props.height;
    if(props.shape!==undefined&&props.shapeKind===undefined)props.shapeKind=props.shape;delete props.shape;
    return{...raw,op,target,from,to,properties:props,objectType:raw.objectType||raw.object_type||raw.type};
  }
  function safeImageSource(value){const source=String(value||"").trim().replace(/^url\((.*)\)$/i,"$1").replace(/^['"]|['"]$/g,"");return /^https:\/\//i.test(source)||/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(source)?source:""}
  function normalizeObjectProperties(input,obj){const p={...(input||{})};
    if(p.background!==undefined&&p.fill===undefined)p.fill=p.background;if(p.backgroundColor!==undefined&&p.fill===undefined)p.fill=p.backgroundColor;if(p.fillColor!==undefined&&p.fill===undefined)p.fill=p.fillColor;
    if(p.color!==undefined){if(["text","note","brief","node","button","task"].includes(obj?.type)&&p.textColor===undefined)p.textColor=p.color;else if(p.fill===undefined)p.fill=p.color;delete p.color}
    if(typeof p.opacity==="number"&&p.opacity>1&&p.opacity<=100)p.opacity=p.opacity/100;
    const aliases={triangle:"triangle",треугольник:"triangle",ellipse:"ellipse",circle:"ellipse",круг:"ellipse",эллипс:"ellipse",rectangle:"rectangle",rect:"rectangle",прямоугольник:"rectangle"};if(p.shapeKind!==undefined)p.shapeKind=aliases[String(p.shapeKind).toLowerCase()]||p.shapeKind;
    if(obj?.type==="image"){const source=safeImageSource(p.src||p.url||((p.fillType==="image"||String(p.fill||"").startsWith("url("))?p.fill:""));if(source){p.src=source;p.fillEnabled=false;p.strokeEnabled=false}else delete p.src}
    return p;
  }
  function validatePatch(patch){if(!patch||!["osminog.patch/v1","briefcraft.patch/v1"].includes(patch.protocol)||!Array.isArray(patch.actions)||patch.actions.length>80)return null;if(patch.projectId&&patch.projectId!==project()?.id)return{wrongProject:true,actions:[]};const actions=[];for(const raw of patch.actions){const action=normalizePatchAction(raw);if(!action)continue;const op=action.op;if(op==="set"){const obj=objects().find(o=>o.id===action.target),conn=(project()?.connections||[]).find(c=>c.id===action.target);if(!obj&&!conn)continue;const normalized=obj?normalizeObjectProperties(action.properties,obj):action.properties;const properties=cleanProperties(normalized,obj?OBJ_PROPS:CONN_PROPS);if(Object.keys(properties).length)actions.push({op,target:action.target,properties,kind:obj?"object":"connection"})}else if(op==="create"&&["brief","text","note","node","task","shape","vector","button","code","browser","image"].includes(action.objectType)){const properties=cleanProperties(normalizeObjectProperties(action.properties,{type:action.objectType}),OBJ_PROPS);if(action.objectType!=="image"||properties.src)actions.push({op,objectType:action.objectType,properties})}else if(op==="delete"&&objects().some(o=>o.id===action.target))actions.push({op,target:action.target});else if(op==="connect"&&objects().some(o=>o.id===action.from)&&objects().some(o=>o.id===action.to))actions.push({op,from:action.from,to:action.to,properties:cleanProperties(action.properties,CONN_PROPS)});else if(op==="disconnect"&&(project()?.connections||[]).some(c=>c.id===action.target))actions.push({op,target:action.target})}return{wrongProject:false,actions,summary:clip(patch.summary||"",1000),raw:patch}}
  function stagePatch(args={}){if(store.access!=="readwrite")return{error:"Canvas access is read-only; patch proposals are disabled"};const patch={protocol:"osminog.patch/v1",projectId:project()?.id||"",baseRevision:store.mirrors[projectKey()]?.revision||0,summary:String(args.summary||"AI proposal"),actions:Array.isArray(args.actions)?args.actions:[]};const parsed=validatePatch(patch);if(!parsed||!parsed.actions.length)return{error:"No supported patch actions were produced"};store.pendingPatch=patch;saveStore();renderPatch();return{ok:true,staged:true,actions:parsed.actions.length,summary:parsed.summary,message:"Patch is staged in OSMINOG and will not be applied until the user explicitly approves it."}}
  function describeAction(a){if(a.op==="set")return`${a.kind==="connection"?"↝":"◆"} ${a.target}: ${Object.keys(a.properties).join(", ")}`;if(a.op==="create")return`＋ ${a.objectType}`;if(a.op==="delete")return`− ${a.target}`;if(a.op==="connect")return`↝ ${a.from} → ${a.to}`;if(a.op==="disconnect")return`× ${a.target}`;return a.op}
  function renderPatch(){const box=$("#bridgePatchBox"),parsed=validatePatch(store.pendingPatch);if(!box)return;if(!parsed||!parsed.actions.length){box.hidden=true;return}box.hidden=false;$("#bridgePatchCount").textContent=String(parsed.actions.length);$("#bridgePatchTitle").textContent=parsed.summary||t("proposal");const list=$("#bridgePatchList");list.innerHTML="";parsed.actions.forEach((a,i)=>{const row=document.createElement("button");row.type="button";row.className="bridge-patch-row";row.innerHTML=`<span>${i+1}</span><strong>${esc(describeAction(a))}</strong>`;row.addEventListener("click",()=>{const id=a.target||a.from;const obj=objects().find(o=>o.id===id);if(obj){state.selected=[obj.id];focusObject(obj);renderAll()}});list.append(row)})}
  function applyPatch(){const parsed=validatePatch(store.pendingPatch);if(!parsed){showToast(t("unsafePatch"));return}if(parsed.wrongProject){showToast(t("wrongProject"));return}if(!parsed.actions.length){showToast(t("unsafePatch"));return}if(parsed.actions.some(a=>a.op==="delete")&&!confirm(lang()==="ru"?"ИИ предлагает удалить объект. Применить проверенный патч?":"AI proposes deleting an object. Apply the reviewed patch?"))return;checkpoint();for(const a of parsed.actions){if(a.op==="set"){const obj=objects().find(o=>o.id===a.target),conn=(project().connections||[]).find(c=>c.id===a.target);Object.assign(obj||conn,a.properties)}else if(a.op==="create"){project().objects.push({...objectDefaults(a.objectType),...a.properties,id:uid(a.objectType)})}else if(a.op==="delete"){project().objects=objects().filter(o=>o.id!==a.target);project().connections=(project().connections||[]).filter(c=>c.from!==a.target&&c.to!==a.target)}else if(a.op==="connect"){project().connections.push({id:uid("connection"),from:a.from,to:a.to,fromPort:"right",toPort:"left",style:"curve",color:"#526fff",width:3,dashed:false,arrow:true,order:(project().connections.length||0)+1,label:"",description:"",...a.properties})}else if(a.op==="disconnect")project().connections=project().connections.filter(c=>c.id!==a.target)}store.pendingPatch=null;saveStore();renderPatch();logChange(lang()==="ru"?"Применены правки Live AI":"Applied Live AI patch");renderAll(true);queuePersist();refreshMirror();showToast(t("patchApplied"))}
  function dismissPatch(){store.pendingPatch=null;saveStore();renderPatch();showToast(t("patchDismissed"))}


  async function cropVisibleTab(rect,maxWidth=1400,maxHeight=1000){
    const tab=await chrome.tabs.getCurrent();if(!tab)throw new Error("Could not resolve OSMINOG tab");
    const dataUrl=await chrome.tabs.captureVisibleTab(tab.windowId,{format:"png"});
    const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=dataUrl});
    const sx=img.naturalWidth/window.innerWidth,sy=img.naturalHeight/window.innerHeight;
    const left=clamp(Math.floor(rect.left*sx),0,img.naturalWidth-1),top=clamp(Math.floor(rect.top*sy),0,img.naturalHeight-1);
    const width=clamp(Math.ceil(rect.width*sx),1,img.naturalWidth-left),height=clamp(Math.ceil(rect.height*sy),1,img.naturalHeight-top);
    const scale=Math.min(1,maxWidth/width,maxHeight/height),outW=Math.max(1,Math.round(width*scale)),outH=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement("canvas");canvas.width=outW;canvas.height=outH;const ctx=canvas.getContext("2d");ctx.drawImage(img,left,top,width,height,0,0,outW,outH);
    const out=canvas.toDataURL("image/png");return{mimeType:"image/png",data:out.split(",")[1],width:outW,height:outH};
  }
  async function captureViewportImage(){const el=$("#viewport");if(!el)return{error:"Viewport is unavailable"};const image=await cropVisibleTab(el.getBoundingClientRect(),1500,1100);return{image,kind:"viewport",revision:refreshMirror()?.revision||0}}
  async function captureSelectionImage(){
    const ids=[...state.selected];if(!ids.length)return{error:t("noSelection")};const selected=ids.map(id=>objects().find(o=>o.id===id)).filter(Boolean);if(!selected.length)return{error:t("noSelection")};
    const vp=$("#viewport").getBoundingClientRect(),sc=state.view.scale||1,pad=28;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const o of selected){const x=vp.left+state.view.x+o.x*sc,y=vp.top+state.view.y+o.y*sc,w=o.w*sc,h=o.h*sc;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+w);bottom=Math.max(bottom,y+h)}
    left=Math.max(vp.left,left-pad);top=Math.max(vp.top,top-pad);right=Math.min(vp.right,right+pad);bottom=Math.min(vp.bottom,bottom+pad);if(right<=left||bottom<=top)return{error:"Selected object is outside the visible viewport"};
    const image=await cropVisibleTab({left,top,width:right-left,height:bottom-top},1200,900);return{image,kind:"selection",selectedIds:ids,revision:refreshMirror()?.revision||0}
  }
  async function captureObjectImage(args={}){const o=requireObject(String(args.id||""));if(o?.error)return o;const el=$(`[data-id="${CSS.escape(o.id)}"]`),vp=$("#viewport")?.getBoundingClientRect();if(!el||!vp)return{error:"Object is not rendered"};const r=el.getBoundingClientRect(),pad=24,left=Math.max(vp.left,r.left-pad),top=Math.max(vp.top,r.top-pad),right=Math.min(vp.right,r.right+pad),bottom=Math.min(vp.bottom,r.bottom+pad);if(right<=left||bottom<=top)return{error:`Object ${o.id} is outside the visible viewport`};const image=await cropVisibleTab({left,top,width:right-left,height:bottom-top},1200,900);return{image,kind:"object",objectId:o.id,revision:refreshMirror()?.revision||0}}
  async function captureCanvasOverviewImage(){try{const svg=exportSvgText(),blob=new Blob([svg],{type:"image/svg+xml"}),url=URL.createObjectURL(blob),img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url}),max=1600,scale=Math.min(1,max/Math.max(img.width||1,img.height||1)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round((img.width||1)*scale));canvas.height=Math.max(1,Math.round((img.height||1)*scale));canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);const data=canvas.toDataURL("image/png").split(",")[1];return{image:{mimeType:"image/png",data,width:canvas.width,height:canvas.height},kind:"canvas_overview",revision:refreshMirror()?.revision||0}}catch(error){return{error:error?.message||"Could not render canvas overview"}}}
  async function readAsset(args={}){
    const o=requireObject(String(args.id||""));if(o?.error)return o;if(!["image","file"].includes(o.type))return{error:`Object ${o.id} is not an image or file`};
    let src=String(o.src||"");if(!src)return{error:`Asset ${o.id} has no embedded data`};
    if(!src.startsWith("data:")){try{const response=await fetch(src);if(!response.ok)throw new Error(`HTTP ${response.status}`);const blob=await response.blob();src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}catch(error){return{error:`Could not read asset ${o.id}: ${error?.message||error}`}}}
    const match=src.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);if(!match)return{error:"Unsupported asset encoding"};const mime=match[1]||o.mime||"application/octet-stream",base64=!!match[2],body=match[3]||"";
    if(/^image\//i.test(mime)){let data=body;if(!base64){const bytes=new TextEncoder().encode(decodeURIComponent(body));let binary="";for(const b of bytes)binary+=String.fromCharCode(b);data=btoa(binary)}return{image:{mimeType:mime,data},kind:"asset",objectId:o.id,name:o.fileName||o.name||"image"}}
    if(/^text\//i.test(mime)||/\.(txt|md|json|csv|js|ts|tsx|jsx|css|html|xml|ya?ml|log)$/i.test(o.fileName||o.name||"")){try{const text=base64?new TextDecoder().decode(Uint8Array.from(atob(body),c=>c.charCodeAt(0))):decodeURIComponent(body),max=Math.max(1000,Math.min(120000,Number(args.max_chars)||50000)),offset=Math.max(0,Number(args.offset)||0);return{kind:"text-asset",objectId:o.id,name:o.fileName||o.name||"file",mime,totalChars:text.length,offset,content:text.slice(offset,offset+max),hasMore:offset+max<text.length}}catch(error){return{error:`Could not decode asset: ${error?.message||error}`}}}
    return{kind:"binary-asset",objectId:o.id,name:o.fileName||o.name||"file",mime,size:o.size||0,note:"Binary is present in OSMINOG. Direct tool transport currently supports image and text assets; PDFs are passed through chat attachments."}
  }

  async function executeTool(name,args={}){
    refreshMirror();
    logToolEvent(name,args,"running");
    try{
      let result;
      if(name==="capabilities"||name==="tool_list")result=capabilityManifest();
      else if(name==="canvas_status")result=canvasStatus();
      else if(name==="list_canvas_objects")result=listCanvasObjects(args);
      else if(name==="get_selection")result=getSelection(args);
      else if(name==="get_viewport")result=getViewport(args);
      else if(name==="get_object")result=getObject(args);
      else if(name==="get_connections")result=getConnections(args);
      else if(name==="get_project_map")result=getProjectMap(args);
      else if(name==="search_canvas")result=searchCanvas(args);
      else if(name==="web_search")result=await webSearchTool(args);
      else if(name==="web_fetch")result=await webFetchTool(args);
      else if(name==="get_recent_changes")result=recentChanges();
      else if(name==="read_object_text")result=readObjectText(args);
      else if(name==="read_code")result=readCode(args);
      else if(name==="read_browser_dom")result=readBrowserDom(args);
      else if(name==="capture_viewport_image")result=await captureViewportImage();
      else if(name==="capture_selection_image")result=await captureSelectionImage();
      else if(name==="capture_object_image")result=await captureObjectImage(args);
      else if(name==="capture_canvas_overview_image")result=await captureCanvasOverviewImage();
      else if(name==="read_asset")result=await readAsset(args);
      else if(name==="asset_create")result=await globalThis.OSMINOGProjectAPI?.importAsset?.(args)||{error:"Project API unavailable"};
      else if(name==="focus_object")result=focusObjectTool(args);
      else if(name==="propose_canvas_patch")result=stagePatch(args);
      else if(["module_status","figma_fetch_file","github_status","github_list_tree","github_search_code","github_fetch_file","github_compare","github_create_branch","github_commit_files","github_open_pr","github_dispatch_workflow","github_workflow_runs","github_get_workflow_runs"].includes(name)){const writes=new Set(["github_create_branch","github_commit_files","github_open_pr","github_dispatch_workflow"]),write=writes.has(name);let approved=!write;if(write)approved=await globalThis.OSMINOGConfirmGitHubAction?.(name,args||{});if(write&&!approved){result={error:"GitHub action cancelled by owner"}}else{const safeArgs={...(args||{}),__ownerApproved:approved===true};const r=await chrome.runtime.sendMessage({type:"BC_MODULE_TOOL",name,args:safeArgs});result=r?.ok===false?{error:r.error}:r;}}
      else if(["dev_status","list_dev_files","read_dev_file","write_dev_file","source_publish","release_publish"].includes(name))result=await devTool(name,args);
      else if(name==="browser_tabs")result=await chrome.runtime.sendMessage({type:"OSMINOG_BROWSER_HUB_LIST"});
      else if(name==="browser_open")result=await chrome.runtime.sendMessage({type:"OSMINOG_BROWSER_HUB_OPEN",url:String(args.url||""),provider:String(args.provider||""),allowCreate:true});
      else if(name==="browser_close")result=await chrome.runtime.sendMessage({type:"OSMINOG_BROWSER_HUB_CLOSE_TAB",tabId:Number(args.tabId)});
      else if(name==="markdown_list")result=await globalThis.OSMINOGMarkdownAPI?.list?.()||{error:"Markdown Studio unavailable"};
      else if(name==="markdown_read")result=await globalThis.OSMINOGMarkdownAPI?.read?.(args)||{error:"Markdown Studio unavailable"};
      else if(name==="markdown_write")result=await globalThis.OSMINOGMarkdownAPI?.write?.(args)||{error:"Markdown Studio unavailable"};
      else if(name==="agent_list")result={agents:globalThis.OSMINOGAgentAPI?.list?.()||[]};
      else if(name==="agent_create")result=await globalThis.OSMINOGAgentAPI?.create?.(args)||{error:"Agent API unavailable"};
      else if(name==="agent_update")result=await globalThis.OSMINOGAgentAPI?.update?.(args)||{error:"Agent API unavailable"};
      else if(name==="agent_remove")result=await globalThis.OSMINOGAgentAPI?.remove?.(args)||{error:"Agent API unavailable"};
      else if(name==="agent_message")result=await globalThis.OSMINOGAgentAPI?.ask?.(String(args.agentId||"main"),String(args.message||""),{fullProject:args.fullProject!==false,mode:"tool",execute:!!args.execute})||{error:"Agent API unavailable"};
      else if(name==="project_list")result={projects:globalThis.OSMINOGProjectAPI?.list?.()||[]};
      else if(name==="project_create")result=await globalThis.OSMINOGProjectAPI?.create?.(args)||{error:"Project API unavailable"};
      else if(name==="project_switch")result=await globalThis.OSMINOGProjectAPI?.switch?.(args)||{error:"Project API unavailable"};
      else if(name==="project_rename")result=await globalThis.OSMINOGProjectAPI?.rename?.(args)||{error:"Project API unavailable"};
      else if(name==="command_list")result=await globalThis.OSMINOGCommandAPI?.list?.()||{error:"Command API unavailable"};
      else if(name==="command_register")result=await globalThis.OSMINOGCommandAPI?.register?.(args)||{error:"Command API unavailable"};
      else if(name==="command_remove")result=await globalThis.OSMINOGCommandAPI?.remove?.(args)||{error:"Command API unavailable"};
      else if(name==="command_run")result=await globalThis.OSMINOGCommandAPI?.run?.(args)||{error:"Command API unavailable"};
      else if(name==="provider_list")result={providers:globalThis.OSMINOGProviderRegistry?.list?.()||[]};
      else if(name==="provider_open")result=await globalThis.OSMINOGProviderRegistry?.openProvider?.(String(args.providerId||args.id||""))||{error:"Provider Registry unavailable"};
      else if(name==="media_crew")result={providers:globalThis.OSMINOGProviderRegistry?.selected?.()||[]};
      else if(name==="module_list")result={modules:globalThis.OSMINOGExtensionStudio?.list?.()||[]};
      else if(name==="module_open"){const id=String(args.id||args.moduleId||"");const opened=globalThis.OSMINOGExtensionStudio?.open?.(id);result=opened?{ok:true,id}:{error:"Module not found"};}
      else if(name==="module_permissions_revoke")result=await globalThis.OSMINOGModuleRuntime?.revoke?.(String(args.id||args.moduleId||""))||{error:"Module runtime unavailable"};
      else if(name==="project_folder_status")result=await globalThis.OSMINOGProjectFolderAPI?.status?.()||{error:"Project folder API unavailable"};
      else if(name==="project_folder_list")result=await globalThis.OSMINOGProjectFolderAPI?.list?.(args)||{error:"Project folder API unavailable"};
      else if(name==="project_folder_read")result=await globalThis.OSMINOGProjectFolderAPI?.read?.(args)||{error:"Project folder API unavailable"};
      else if(name==="project_folder_write")result=await globalThis.OSMINOGProjectFolderAPI?.write?.(args)||{error:"Project folder API unavailable"};
      else if(name==="undo_last_change"){undo();result={ok:true,message:"Undid the last canvas change"};}
      else result={error:`Unknown OSMINOG tool: ${name}`};
      finishToolEvent(name,result?.error?"error":"done");
      return result;
    }catch(error){finishToolEvent(name,"error");return{error:error?.message||String(error)}}
  }


  let externalPresence={connected:false,role:"view",tabId:null,lastRevision:0,timer:0};
  function externalContext(){refreshMirror();const status=canvasStatus(),map=getProjectMap({limit:260}),selection=getSelection({include_neighbors:true}),objs=listCanvasObjects({limit:110,include_preview:true});return{protocol:"osminog.browser_presence/v1",project:status.project,revision:status.revision,workspace:status.workspace,canvas:status.canvas,view:status.view,selectedIds:status.selectedIds,counts:status.counts,connectionCount:status.connections,selection,objects:objs.objects||[],projectMap:map,capabilities:capabilityManifest(),externalAccess:{role:externalPresence.role,canEdit:externalPresence.role==="edit",canComment:["comment","edit"].includes(externalPresence.role),mode:store.access==="readwrite"?"owner-max":store.access},policy:{sourceOfTruth:"OSMINOG canvas",neverInventExistingIds:true,fullBodiesOnRequest:true,editsViaPatch:true,neverClaimEditWithoutPatch:true}}}
  async function pushExternalContext(force=false){if(!externalPresence.connected)return;const ctx=externalContext();if(!force&&ctx.revision===externalPresence.lastRevision)return;externalPresence.lastRevision=ctx.revision;await chrome.runtime.sendMessage({type:"BC_EXTERNAL_CONTEXT_UPDATE",context:ctx}).catch(()=>{})}
  async function connectExternalChatGPT(role="view"){try{const granted=await chrome.permissions.request({origins:["https://chatgpt.com/*","https://chat.openai.com/*"]});if(!granted)return{ok:false,error:"Нужно разрешить OSMINOG доступ к выбранной вкладке ChatGPT."}}catch{}externalPresence.role=["view","comment","edit"].includes(role)?role:"view";const ctx=externalContext(),r=await chrome.runtime.sendMessage({type:"BC_EXTERNAL_CONNECT_CHATGPT",role:externalPresence.role,context:ctx});if(!r?.ok)return r;clearInterval(externalPresence.timer);externalPresence={...externalPresence,connected:true,tabId:r.tabId,lastRevision:ctx.revision};externalPresence.timer=setInterval(()=>pushExternalContext(false),850);return{...r,role:externalPresence.role}}
  async function handleExternalAssistant(payload,role){
    if(!payload)return;
    if(payload.request?.calls?.length){
      const results=[];let imageDataUrl=null;externalExecutionRole=role;
      try{for(const call of payload.request.calls.slice(0,8)){const tool=String(call?.tool||"");if(!tool)continue;const result=role!=="edit"&&MUTATING_TOOLS.has(tool)?{error:`Tool ${tool} requires the Edit role`}:await executeTool(tool,call?.args||{});if(result?.image?.data&&!imageDataUrl){imageDataUrl=`data:${result.image.mimeType||"image/png"};base64,${result.image.data}`;results.push({tool,result:{kind:result.kind||"image",objectId:result.objectId||null,selectedIds:result.selectedIds||[],revision:result.revision||0,imageAttached:true}})}else results.push({tool,result})}}
      finally{externalExecutionRole=""}
      await chrome.runtime.sendMessage({type:"BC_EXTERNAL_TOOL_RESULT",payload:{requestId:payload.requestId,result:{calls:results},imageDataUrl}}).catch(()=>{});return
    }
    if(payload.patch?.actions?.length){if(role!=="edit"){showToast(lang()==="ru"?"ChatGPT предложил правку, но его роль — без редактирования":"ChatGPT proposed an edit but its role is read-only");return}const parsed=validatePatch(payload.patch);if(parsed?.actions?.length){store.pendingPatch=payload.patch;saveStore();renderPatch();showToast(lang()==="ru"?"Внешний ChatGPT предложил правки":"External ChatGPT proposed edits")}}
  }

  function logToolEvent(name,args,status){
    store.requestCount=(store.requestCount||0)+1;store.toolEvents=Array.isArray(store.toolEvents)?store.toolEvents:[];
    store.toolEvents.unshift({id:`evt-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name,args:clip(JSON.stringify(args||{}),180),status,at:Date.now()});store.toolEvents=store.toolEvents.slice(0,40);saveStore();renderToolLog();
  }
  function finishToolEvent(name,status){const e=(store.toolEvents||[]).find(x=>x.name===name&&x.status==="running");if(e){e.status=status;e.doneAt=Date.now();saveStore();renderToolLog()}}
  function renderToolLog(){
    const root=$("#connectorToolLog");if(!root)return;root.innerHTML="";const list=store.toolEvents||[];const c=$("#connectorRequestCount");if(c)c.textContent=`${store.requestCount||0} calls`;
    if(!list.length){const e=document.createElement("div");e.className="connector-empty";e.textContent=lang()==="ru"?"ChatGPT ещё ничего не запрашивал у холста.":"ChatGPT has not requested any canvas data yet.";root.append(e);return}
    for(const item of list.slice(0,16)){const row=document.createElement("div");row.className=`connector-tool-row ${item.status||"done"}`;const age=Math.max(0,Math.round((Date.now()-item.at)/1000));row.innerHTML=`<span class="connector-tool-icon">${item.status==="running"?"…":item.status==="error"?"!":"✓"}</span><div><strong>${esc(item.name)}</strong><small>${esc(item.args||"{}")} · ${age}s</small></div>`;root.append(row)}
  }
  function setBadge(mode,text){const badge=$("#bridgeLiveBadge");if(!badge)return;badge.classList.remove("offline","online","thinking");badge.classList.add(mode==="online"?"online":mode==="thinking"?"thinking":"offline");badge.textContent=text||(mode==="online"?"LIVE":mode==="thinking"?"…":"OFFLINE")}
  function renderRelayHealth(stateName="idle"){
    const dot=$("#connectorHealthDot"),title=$("#connectorHealthTitle"),sub=$("#connectorHealthSub");
    const configured=relayConfigured(),live=stateName==="live"||(socket&&socket.readyState===WebSocket.OPEN);
    dot?.classList.toggle("online",!!live);dot?.classList.toggle("offline",!live);
    if(!configured){if(title)title.textContent="OSMINOG Relay";if(sub)sub.textContent=t("relayMissing");return}
    if(live){if(title)title.textContent=t("relayReady");if(sub)sub.textContent=lang()==="ru"?"Защищённое соединение активно. Холст остаётся локальным.":"Secure connection is active. The canvas stays local."}
    else if(stateName==="connecting"){if(title)title.textContent=t("relayConnecting");if(sub)sub.textContent=lang()==="ru"?"Это не блокирует работу с холстом.":"Canvas work stays responsive while connecting."}
    else{if(title)title.textContent="OSMINOG Relay";if(sub)sub.textContent=lang()==="ru"?"Готов к подключению одним нажатием.":"Ready for one-click connection."}
  }
  function tinyHello(){const s=canvasStatus();return{type:"hello",protocol:"briefcraft.presence/v2",deviceToken:ensureDeviceToken(),access:store.access,extensionVersion:"3.8.3",project:s.project,revision:s.revision,selectedIds:s.selectedIds,counts:s.counts,ts:Date.now()}}
  function socketUrl(){return `${relayWs()}/ws/${encodeURIComponent(ensureDeviceToken())}`}
  function clearReconnect(){clearTimeout(reconnectTimer);reconnectTimer=0}
  function scheduleReconnect(){if(manualDisconnect||!store.connected||!relayConfigured())return;clearReconnect();const wait=Math.min(15000,500*Math.pow(1.7,reconnectAttempt++));setBadge("offline","RETRY");renderRelayHealth("connecting");reconnectTimer=setTimeout(()=>openSocket(),wait)}
  async function openSocket(){
    if(manualDisconnect||!store.connected||!relayConfigured())return;
    clearReconnect();if(socket&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(socket.readyState))return;
    renderRelayHealth("connecting");setBadge("thinking","…");
    try{
      socket=new WebSocket(socketUrl());
      socket.addEventListener("open",()=>{reconnectAttempt=0;setBadge("online","LIVE");renderRelayHealth("live");try{socket.send(JSON.stringify(tinyHello()))}catch{};renderConnector()});
      socket.addEventListener("message",async ev=>{let msg;try{msg=JSON.parse(ev.data)}catch{return}if(msg?.type==="ping"){try{socket.send(JSON.stringify({type:"pong",ts:Date.now()}))}catch{};return}if(msg?.type!=="tool_call"||!msg.id||!msg.tool)return;const result=await executeTool(msg.tool,msg.args||{});try{socket.send(JSON.stringify({type:"tool_result",id:msg.id,result,ts:Date.now()}))}catch{}});
      socket.addEventListener("close",()=>{socket=null;renderRelayHealth("offline");if(store.connected&&!manualDisconnect)scheduleReconnect();else setBadge("offline","OFFLINE")});
      socket.addEventListener("error",()=>{});
    }catch{socket=null;scheduleReconnect()}
  }
  async function connectCanvas(){
    store.access=$("#liveAiAccess")?.value||"readwrite";applyLanguage();
    if(!relayConfigured()){showToast(t("relayMissing"));renderRelayHealth();return}
    if(!(await ensureRelayPermission())){showToast(t("permissionDenied"));return}
    refreshMirror();manualDisconnect=false;store.connected=true;ensureDeviceToken();await saveStore();renderConnector();openSocket();showToast(t("connected"));
  }
  function resumeConnector(){manualDisconnect=false;openSocket()}
  async function disconnectCanvas(){manualDisconnect=true;clearReconnect();clearTimeout(statusTimer);try{socket?.close(1000,"user disconnect")}catch{}socket=null;store.connected=false;await saveStore();renderConnector();renderRelayHealth();showToast(t("disconnected"))}
  function renderConnector(){
    const on=!!store.connected;const setup=$("#connectorSetup"),workspace=$("#connectorWorkspace");if(setup)setup.hidden=on;if(workspace)workspace.hidden=!on;
    const live=socket&&socket.readyState===WebSocket.OPEN;setBadge(live?"online":on?"thinking":"offline",live?"LIVE":on?"…":"OFFLINE");$("#share")?.classList.toggle("bridge-connected",!!live);updateStatusBadges();renderPatch();renderToolLog();applyLanguage();
    const pn=$("#connectorProjectName");if(pn)pn.textContent=project()?.name||"Current canvas";const pt=$("#connectorPairTitle");if(pt)pt.textContent=live?t("relayLive"):t("waiting");
    const dev=$("#connectorDevTest"),devInput=$("#connectorDevMcpUrl");if(dev)dev.hidden=!(CFG.devMode&&live);if(devInput)devInput.value=relayConfigured()?`${relayHttp()}/mcp/${ensureDeviceToken()}`:"";
  }
  function showAccessSettings(){manualDisconnect=true;clearReconnect();try{socket?.close(1000,"change access")}catch{}socket=null;store.connected=false;saveStore();const setup=$("#connectorSetup"),workspace=$("#connectorWorkspace");if(setup)setup.hidden=false;if(workspace)workspace.hidden=true;const sel=$("#liveAiAccess");if(sel)sel.value=store.access||"readwrite";renderRelayHealth()}
  function openChatGPT(){const url=CFG.chatGPTAppUrl||"https://chatgpt.com/";chrome.tabs?.create?chrome.tabs.create({url}):window.open(url,"_blank")}
  function open(){applyLanguage();$("#bridgePanel").hidden=false;refreshMirror();renderRelayHealth();renderConnector();if(store.connected)openSocket()}
  function close(){$("#bridgePanel").hidden=true}
  function bind(){
    $("#bridgeClose")?.addEventListener("click",close);$("#connectorConnect")?.addEventListener("click",connectCanvas);$("#connectorDisconnect")?.addEventListener("click",disconnectCanvas);$("#connectorSettings")?.addEventListener("click",showAccessSettings);$("#connectorOpenChatGPT")?.addEventListener("click",openChatGPT);$("#connectorDevCopy")?.addEventListener("click",async()=>{const u=$("#connectorDevMcpUrl")?.value||"";if(!u)return;try{await navigator.clipboard.writeText(u);showToast(lang()==="ru"?"Тестовый MCP URL скопирован":"Test MCP URL copied")}catch{}});$("#liveAiAccess")?.addEventListener("change",()=>{store.access=$("#liveAiAccess").value;saveStore();applyLanguage();if(socket?.readyState===WebSocket.OPEN){try{socket.send(JSON.stringify(tinyHello()))}catch{}}});$("#bridgeApplyPatch")?.addEventListener("click",applyPatch);$("#bridgeDismissPatch")?.addEventListener("click",dismissPatch);
    window.addEventListener("online",()=>{if(store.connected)openSocket()});window.addEventListener("offline",()=>renderRelayHealth("offline"));
  }
  chrome.runtime.onMessage.addListener((m)=>{if(m?.type==="BC_EXTERNAL_ASSISTANT_RESULT")handleExternalAssistant(m.payload||{},m.role||externalPresence.role)});
  globalThis.BriefCraftBridge={open,refreshMirror,canvasStatus,listCanvasObjects,getSelection,getViewport,getObject,getProjectMap,searchCanvas,recentChanges,executeTool,applyPatch,dismissPatch,renderPatch,connectExternalChatGPT,setAccess:(value)=>{store.access=["readwrite","read","selection"].includes(value)?value:"readwrite";saveStore();applyLanguage();return store.access},getAccess:()=>store.access};
  bind();loadStore();
})();
