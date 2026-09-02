"use strict";
(()=>{
  if(globalThis.__osminogWindowsFoldersV2)return;
  globalThis.__osminogWindowsFoldersV2=true;

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const projectNow=()=>globalThis.project?.()||null;
  const objectsNow=()=>globalThis.objects?.()||[];
  const foldersNow=()=>{const p=projectNow();if(!p)return[];if(!Array.isArray(p.osminogFolders))p.osminogFolders=[];return p.osminogFolders};
  const folderById=id=>foldersNow().find(f=>f.id===id)||null;
  const pid=()=>projectNow()?.id||"global";
  const uid=prefix=>globalThis.uid?.(prefix)||`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const api=()=>globalThis.OSMINOGProjectFolderAPI||null;
  const coreState=()=>{try{return typeof state!=="undefined"?state:null}catch{return null}};
  const notify=text=>{try{globalThis.showToast?.(text)}catch{}console.info("[OSMINOG Windows folders]",text)};
  let uiFrame=0,rootConnected=false,rootFolderName="OSMINOG";
  const scheduleUi=()=>{if(uiFrame)return;uiFrame=requestAnimationFrame(()=>{uiFrame=0;renderDesktopFolders();injectLayerControls();refreshExplorerSoon()})};
  const persist=()=>{try{globalThis.queuePersist?.()}catch{};try{globalThis.renderLayers?.()}catch{};scheduleUi()};
  const safeName=value=>String(value||"").trim().replace(/[\\/:*?"<>|]/g," ").replace(/\s+/g," ").slice(0,80)||"Новая папка";
  const baseName=path=>String(path||"").replace(/\\/g,"/").split("/").filter(Boolean).pop()||"OSMINOG";
  const parentPath=path=>String(path||"").replace(/\\/g,"/").split("/").filter(Boolean).slice(0,-1).join("/");
  const joinPath=(a,b)=>[String(a||"").replace(/\/+$/,""),String(b||"").replace(/^\/+/,"")].filter(Boolean).join("/");
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const ROOT_HIDDEN_KEY=()=>`osminogRootFolderHiddenV2:${pid()}`;
  const DEFAULT_PREFS={viewMode:"tiles",contentSize:"medium",desktopSize:"medium",sort:"name",perPath:{}};

  let rootHidden=false;
  let active={kind:"root",path:"",folderId:null};
  let explorerItems=[];
  const thumbnailCache=new Map();
  let selectedItemKey="";
  let searchText="";
  let renderTimer=0;
  let renameState=null;
  let dragItem=null;
  let folderIconDrag=null;
  let contextPoint={x:120,y:120};

  function settings(){const p=projectNow();if(!p)return DEFAULT_PREFS;if(!p.osminogFolderSettings)p.osminogFolderSettings={...DEFAULT_PREFS,perPath:{}};const s=p.osminogFolderSettings;s.perPath=s.perPath&&typeof s.perPath==="object"?s.perPath:{};return s}
  function currentPrefs(){const s=settings();if(active.kind==="virtual"){const f=folderById(active.folderId);return f?{viewMode:f.viewMode||s.viewMode,contentSize:f.contentSize||s.contentSize,desktopSize:f.desktopSize||s.desktopSize,sort:f.sort||s.sort}:s}const key=active.path||"/";return{...s,...(s.perPath?.[key]||{})}}
  function savePrefs(next,{all=false}={}){const s=settings();if(all){Object.assign(s,next);for(const f of foldersNow())Object.assign(f,next);s.perPath={};persist();return}if(active.kind==="virtual"){const f=folderById(active.folderId);if(f)Object.assign(f,next)}else{const key=active.path||"/";s.perPath[key]={...(s.perPath[key]||{}),...next};if(key==="/")Object.assign(s,next)}persist()}

  function viewportRect(){return $("#viewport")?.getBoundingClientRect()||{left:0,top:0,width:innerWidth,height:innerHeight}}
  function screenFromLegacy(f){const r=viewportRect(),view=coreState()?.view||{x:0,y:0,scale:1};const x=Number(f.x),y=Number(f.y);return{x:clamp(Number.isFinite(x)?view.x+x*view.scale:120,8,Math.max(8,r.width-130)),y:clamp(Number.isFinite(y)?view.y+y*view.scale:130,72,Math.max(72,r.height-120))}}
  function ensureFolder(f){
    const p=settings();
    f.members=Array.isArray(f.members)?f.members:[];
    f.name=safeName(f.name);
    f.parentId=f.parentId||null;
    if(typeof f.desktopVisible!=="boolean")f.desktopVisible=!f.parentId&&!f.minimized;
    if(!Number.isFinite(Number(f.screenX))||!Number.isFinite(Number(f.screenY))){const pos=screenFromLegacy(f);f.screenX=pos.x;f.screenY=pos.y}
    f.viewMode=f.viewMode||p.viewMode||"tiles";
    f.contentSize=f.contentSize||p.contentSize||"medium";
    f.desktopSize=f.desktopSize||p.desktopSize||"medium";
    f.sort=f.sort||p.sort||"name";
    f.minimized=false;
    return f;
  }
  function migrate(){
    const ids=new Set(foldersNow().map(f=>f.id));
    for(const f of foldersNow()){ensureFolder(f);if(f.parentId&&!ids.has(f.parentId))f.parentId=null;f.members=f.members.filter(id=>objectsNow().some(o=>o.id===id))}
    for(const o of objectsNow())if(o.osminogFolderId&&!ids.has(o.osminogFolderId))delete o.osminogFolderId;
  }
  function descendant(candidate,parent){let f=folderById(candidate),guard=0;while(f&&guard++<80){if(f.parentId===parent)return true;f=folderById(f.parentId)}return false}
  function folderCount(f){return (f.members?.length||0)+foldersNow().filter(x=>x.parentId===f.id).length}

  function createVirtualFolder({parentId=null,screenX,screenY,name="Новая папка",desktopVisible=parentId?false:true,rename=true}={}){
    const r=viewportRect(),s=settings(),f=ensureFolder({id:uid("folder"),name,parentId,desktopVisible,screenX:Number.isFinite(screenX)?screenX:clamp(r.width*.5-48,8,r.width-120),screenY:Number.isFinite(screenY)?screenY:clamp(r.height*.35,72,r.height-120),members:[],viewMode:s.viewMode,contentSize:s.contentSize,desktopSize:s.desktopSize,sort:s.sort,createdAt:Date.now()});
    foldersNow().push(f);persist();if(rename){setTimeout(()=>beginDesktopRename(f.id),30)}return f;
  }
  function closeVirtualFolder(id){const f=folderById(id);if(!f)return;f.parentId=null;f.desktopVisible=false;persist();notify(`Папка «${f.name}» сохранена внутри папки проекта`)}
  function showVirtualOnDesktop(id,position={}){const f=folderById(id);if(!f)return false;f.parentId=null;f.desktopVisible=true;const r=viewportRect(),size=desktopSizePx(f.desktopSize);const px=Number(position.screenX),py=Number(position.screenY);f.screenX=clamp(Number.isFinite(px)?px:(Number(f.screenX)||r.width*.5-size/2),8,Math.max(8,r.width-size-10));f.screenY=clamp(Number.isFinite(py)?py:(Number(f.screenY)||r.height*.35),72,Math.max(72,r.height-105));persist();notify(`Папка «${f.name}» возвращена на рабочий стол`);return true}
  function moveVirtualFolder(childId,parentId){if(!childId||childId===parentId||descendant(parentId,childId))return false;const child=folderById(childId),parent=folderById(parentId);if(!child||!parent)return false;child.parentId=parent.id;child.desktopVisible=false;persist();return true}
  function moveObjectToFolder(objectId,folderId){const o=objectsNow().find(x=>x.id===objectId),target=folderById(folderId);if(!o||!target)return false;const old=folderById(o.osminogFolderId);if(old)old.members=old.members.filter(id=>id!==o.id);o.osminogFolderId=folderId;if(!target.members.includes(o.id))target.members.push(o.id);try{globalThis.renderObjects?.(true);globalThis.renderConnections?.()}catch{}persist();return true}
  function moveObjectToDesktop(objectId){const o=objectsNow().find(x=>x.id===objectId);if(!o)return;const old=folderById(o.osminogFolderId);if(old)old.members=old.members.filter(id=>id!==o.id);delete o.osminogFolderId;const c=globalThis.viewportCenter?.()||{x:0,y:0};o.x=c.x-(Number(o.w)||240)/2;o.y=c.y-(Number(o.h)||160)/2;try{globalThis.renderObjects?.(true);globalThis.renderConnections?.()}catch{}persist()}
  function deleteVirtualFolder(id){const f=folderById(id);if(!f)return;for(const child of foldersNow().filter(x=>x.parentId===id)){child.parentId=null;child.desktopVisible=false}for(const objectId of f.members||[])moveObjectToDesktop(objectId);const p=projectNow();p.osminogFolders=foldersNow().filter(x=>x.id!==id);if(active.folderId===id)closeExplorer();persist()}

  function ensureDesktopLayer(){const viewport=$("#viewport");if(!viewport)return null;let layer=$("#osminogWindowsDesktopFolders");if(!layer){layer=document.createElement("div");layer.id="osminogWindowsDesktopFolders";layer.className="osminog-windows-desktop-folders";viewport.append(layer)}return layer}
  function folderGlyph(){return '<span class="osminog-win-folder-glyph" aria-hidden="true"><i></i></span>'}
  function desktopSizePx(size){return size==="small"?66:size==="large"?116:90}
  function renderDesktopFolders(){
    const layer=ensureDesktopLayer();if(!layer)return;const r=viewportRect();const visible=foldersNow().filter(f=>!f.parentId&&f.desktopVisible).map(ensureFolder);const wanted=new Set(visible.map(f=>f.id));
    for(const f of visible){
      f.screenX=clamp(Number(f.screenX)||80,6,Math.max(6,r.width-desktopSizePx(f.desktopSize)-10));f.screenY=clamp(Number(f.screenY)||120,66,Math.max(66,r.height-105));
      let el=layer.querySelector(`[data-win-folder-id="${CSS.escape(f.id)}"]`);if(!el){el=document.createElement("div");el.className="osminog-win-folder-icon";el.dataset.winFolderId=f.id;el.tabIndex=0;el.innerHTML=`<button type="button" class="osminog-win-folder-close" title="Закрыть и сохранить внутри папки проекта">×</button>${folderGlyph()}<strong class="osminog-win-folder-label"></strong><small></small>`;layer.append(el);bindDesktopFolder(el)}
      el.dataset.size=f.desktopSize;el.style.left=`${f.screenX}px`;el.style.top=`${f.screenY}px`;el.querySelector(".osminog-win-folder-label").textContent=f.name;el.querySelector("small").textContent=`${folderCount(f)} элемент(а)`;
    }
    layer.querySelectorAll("[data-win-folder-id]").forEach(el=>{if(!wanted.has(el.dataset.winFolderId))el.remove()});applyRootIconSize();
  }
  function bindDesktopFolder(el){
    const id=()=>el.dataset.winFolderId;
    el.querySelector(".osminog-win-folder-close")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();closeVirtualFolder(id())});
    el.addEventListener("dblclick",e=>{if(e.target.closest("button,input"))return;e.preventDefault();e.stopPropagation();if(e.target.closest(".osminog-win-folder-label"))beginDesktopRename(id());else openVirtualFolder(id())});
    el.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();showFolderContext(e.clientX,e.clientY,id())});
    el.addEventListener("pointerdown",e=>{if(e.button!==0||e.target.closest("button,input"))return;const f=folderById(id()),r=viewportRect();folderIconDrag={id:id(),pointerId:e.pointerId,dx:e.clientX-r.left-f.screenX,dy:e.clientY-r.top-f.screenY,startX:e.clientX,startY:e.clientY,moved:false};el.setPointerCapture?.(e.pointerId);e.preventDefault()});
    el.addEventListener("pointermove",e=>{if(!folderIconDrag||folderIconDrag.pointerId!==e.pointerId||folderIconDrag.id!==id())return;const f=folderById(id()),r=viewportRect(),sz=desktopSizePx(f.desktopSize);if(Math.hypot(e.clientX-folderIconDrag.startX,e.clientY-folderIconDrag.startY)>4)folderIconDrag.moved=true;f.screenX=clamp(e.clientX-r.left-folderIconDrag.dx,6,r.width-sz-8);f.screenY=clamp(e.clientY-r.top-folderIconDrag.dy,66,r.height-100);el.style.left=`${f.screenX}px`;el.style.top=`${f.screenY}px`;highlightDesktopDrop(e.clientX,e.clientY,id())});
    const end=e=>{if(!folderIconDrag||folderIconDrag.pointerId!==e.pointerId||folderIconDrag.id!==id())return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.(".osminog-win-folder-icon")?.dataset.winFolderId;if(folderIconDrag.moved&&target&&target!==id())moveVirtualFolder(id(),target);folderIconDrag=null;clearDesktopDrop();persist()};
    el.addEventListener("pointerup",end);el.addEventListener("pointercancel",()=>{folderIconDrag=null;clearDesktopDrop()});
    el.addEventListener("dragover",e=>{if(e.dataTransfer?.types?.includes("application/x-osminog-folder-item")||e.dataTransfer?.files?.length){e.preventDefault();el.classList.add("drop-active")}});
    el.addEventListener("dragleave",()=>el.classList.remove("drop-active"));
    el.addEventListener("drop",async e=>{e.preventDefault();el.classList.remove("drop-active");await handleDropOnVirtualFolder(e,id())});
  }
  function beginDesktopRename(id){const el=$(`[data-win-folder-id="${CSS.escape(id)}"]`),f=folderById(id);if(!el||!f)return;const old=el.querySelector(".osminog-win-folder-label");if(!old)return;const input=document.createElement("input");input.className="osminog-win-folder-rename";input.value=f.name;old.replaceWith(input);input.focus();input.select();const commit=()=>{f.name=safeName(input.value);persist()};input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();commit()}else if(e.key==="Escape")renderDesktopFolders()});input.addEventListener("blur",commit,{once:true})}
  function highlightDesktopDrop(x,y,exclude){clearDesktopDrop();const target=document.elementsFromPoint(x,y).find(el=>el.classList?.contains("osminog-win-folder-icon")&&el.dataset.winFolderId!==exclude);target?.classList.add("drop-active")}
  function clearDesktopDrop(){$$(".osminog-win-folder-icon.drop-active").forEach(el=>el.classList.remove("drop-active"))}

  function injectRootClose(){
    const icon=$("#osminogDesktopFolderIcon");if(!icon)return;
    icon.dataset.winFoldersBound="2";
    icon.querySelectorAll(".osminog-root-folder-close").forEach(x=>x.remove());let close=icon.querySelector(".osminog-win-root-close");if(!close){close=document.createElement("button");close.type="button";close.className="osminog-win-root-close";close.title="Свернуть основную папку в раздел «Папки»";close.textContent="×";icon.append(close)}
    if(close.dataset.bound!=="1"){close.dataset.bound="1";close.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();rootHidden=true;await chrome.storage.local.set({[ROOT_HIDDEN_KEY()]:true});applyRootVisibility();injectLayerControls()})}
    if(icon.dataset.rootDragBound==="1")return;icon.dataset.rootDragBound="1";
    let drag=null,moved=false;
    const move=e=>{if(!drag||drag.id!==e.pointerId)return;const vr=viewportRect(),dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(!moved&&Math.hypot(dx,dy)<3)return;moved=true;icon.dataset.dragMoved="1";const left=clamp(e.clientX-vr.left-drag.dx,8,Math.max(8,vr.width-icon.offsetWidth-8)),top=clamp(e.clientY-vr.top-drag.dy,72,Math.max(72,vr.height-icon.offsetHeight-8));icon.style.left=`${left}px`;icon.style.top=`${top}px`;icon.style.right="auto";icon.style.bottom="auto";e.preventDefault();e.stopPropagation()};
    const end=async e=>{if(!drag||drag.id!==e.pointerId)return;document.removeEventListener("pointermove",move,true);document.removeEventListener("pointerup",end,true);document.removeEventListener("pointercancel",end,true);const wasMoved=moved;drag=null;if(wasMoved){try{await chrome.storage.local.set({[`osminogRootFolderPositionV3:${pid()}`]:{left:parseFloat(icon.style.left)||72,top:parseFloat(icon.style.top)||116}})}catch{}setTimeout(()=>delete icon.dataset.dragMoved,250)}};
    icon.addEventListener("pointerdown",e=>{if(e.button!==0||e.target.closest(".osminog-win-root-close"))return;const r=icon.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,sx:e.clientX,sy:e.clientY};moved=false;document.addEventListener("pointermove",move,true);document.addEventListener("pointerup",end,true);document.addEventListener("pointercancel",end,true);e.preventDefault();e.stopImmediatePropagation()},true);
    icon.addEventListener("dblclick",e=>{if(icon.dataset.dragMoved==="1")return;e.preventDefault();e.stopImmediatePropagation();openRootFolder()},true);
  }
  function applyRootIconSize(){const icon=$("#osminogDesktopFolderIcon");if(!icon)return;const size=settings().desktopSize||"medium";icon.dataset.size=size}
  function applyRootVisibility(){const icon=$("#osminogDesktopFolderIcon");if(!icon)return;icon.hidden=!rootConnected||rootHidden;icon.dataset.userMinimized=rootHidden?"1":"0";const label=$("#osminogDesktopFolderLabel"),meta=$("#osminogDesktopFolderMeta");if(label)label.textContent=rootFolderName||"OSMINOG";if(meta)meta.textContent="Папка проекта";applyRootIconSize()}
  async function refreshRootConnection(){try{const status=await api()?.status?.();rootConnected=!!status?.connected;rootFolderName=status?.folder||"OSMINOG"}catch{rootConnected=false;rootFolderName="OSMINOG"}applyRootVisibility();return rootConnected}
  async function restoreRootFolder(){rootHidden=false;await chrome.storage.local.set({[ROOT_HIDDEN_KEY()]:false});applyRootVisibility();injectLayerControls()}

  function injectLayerControls(){
    const panel=$("#layersPanel"),list=$("#layerList");if(!panel)return;
    list?.querySelectorAll(".osminog-layer-folder-section,.osminog-win-layer-folders").forEach(el=>el.remove());
    let dock=$("#osminogFolderDock",panel);
    if(!dock){
      dock=document.createElement("section");dock.id="osminogFolderDock";dock.className="osminog-folder-dock";
      dock.innerHTML=`<button type="button" id="osminogFolderDockAdd" title="Новая папка на рабочем столе">+</button><button type="button" id="osminogFolderDockRoot" title="Открыть папку проекта"><span class="osminog-mini-folder-glyph" aria-hidden="true"></span><span><strong>Папка проекта</strong><small></small></span></button>`;
      const footer=panel.querySelector(".panel-footer");footer?.insertAdjacentElement("beforebegin",dock)||panel.append(dock);
      dock.querySelector("#osminogFolderDockAdd")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();createVirtualFolder({rename:true})});
      dock.querySelector("#osminogFolderDockRoot")?.addEventListener("click",async e=>{
        e.preventDefault();e.stopPropagation();
        if(!rootConnected){
          const ok=await api()?.choose?.();
          if(!ok)return;
          await refreshRootConnection();injectLayerControls();
        }
        openRootFolder();
      });
      dock.querySelector("#osminogFolderDockRoot")?.addEventListener("dblclick",async e=>{
        e.preventDefault();e.stopPropagation();
        if(!rootConnected){const ok=await api()?.choose?.();if(!ok)return;await refreshRootConnection();injectLayerControls()}
        openRootFolder();
      });
    }else{
      const footer=panel.querySelector(".panel-footer");if(footer&&dock.nextElementSibling!==footer)footer.insertAdjacentElement("beforebegin",dock);
    }
    const count=foldersNow().filter(f=>!f.parentId&&!f.desktopVisible).length,root=dock.querySelector("#osminogFolderDockRoot"),small=root?.querySelector("small"),strong=root?.querySelector("strong");
    root?.classList.toggle("minimized",false);root?.classList.toggle("disconnected",!rootConnected);
    if(root)root.title=rootConnected?`Открыть локальную папку проекта: ${rootFolderName||"OSMINOG"}`:"Подключить локальную папку проекта";
    if(strong)strong.textContent=rootConnected?(rootFolderName||"OSMINOG"):"Локальная папка";
    if(small)small.textContent=rootConnected?`${count} внутри`:"подключить";
  }

  function ensureExplorer(){
    if($("#osminogWindowsExplorer"))return;
    const el=document.createElement("section");el.id="osminogWindowsExplorer";el.className="osminog-windows-explorer";el.hidden=true;el.innerHTML=`
      <header class="osminog-windows-explorer-head">
        <div class="osminog-windows-explorer-title">${folderGlyph()}<div><strong id="osminogWindowsExplorerTitle">Папка проекта</strong><small id="osminogWindowsExplorerMeta">OSMINOG</small></div></div>
        <div class="osminog-windows-explorer-actions"><button type="button" id="osminogWindowsExplorerNew">Новая папка</button><button type="button" id="osminogWindowsExplorerDesktop" hidden>На рабочий стол</button><button type="button" id="osminogWindowsExplorerClose" title="Закрыть">×</button></div>
      </header>
      <div class="osminog-windows-explorer-toolbar">
        <button id="osminogWindowsExplorerBack" type="button" title="Назад">←</button><button id="osminogWindowsExplorerUp" type="button" title="Вверх">↑</button>
        <div id="osminogWindowsExplorerBreadcrumb" class="osminog-windows-explorer-breadcrumb"></div>
        <label class="osminog-windows-explorer-search"><span>⌕</span><input id="osminogWindowsExplorerSearch" placeholder="Поиск в папке"></label>
        <select id="osminogWindowsExplorerView" title="Вид"><option value="large">Крупные значки</option><option value="tiles">Плитка</option><option value="list">Список</option><option value="details">Таблица</option></select>
        <button id="osminogWindowsExplorerSettings" type="button" title="Настройки папки">⚙</button>
      </div>
      <div class="osminog-windows-explorer-body"><div id="osminogWindowsExplorerItems" class="osminog-windows-explorer-items"></div><aside id="osminogWindowsExplorerPreview" class="osminog-windows-explorer-preview"><h3>Папка проекта</h3><p>Выбери элемент для просмотра.</p></aside></div>
      <footer><span id="osminogWindowsExplorerStatus">0 элементов</span><span>Перетаскивай элементы между папками как в проводнике.</span></footer>
      <div id="osminogWindowsExplorerPrefs" class="osminog-windows-explorer-prefs" hidden>
        <label><span>Размер значков внутри</span><select data-pref="contentSize"><option value="small">Мелкий</option><option value="medium">Средний</option><option value="large">Крупный</option></select></label>
        <label><span>Размер папки на рабочем столе</span><select data-pref="desktopSize"><option value="small">Маленькая</option><option value="medium">Средняя</option><option value="large">Большая</option></select></label>
        <label><span>Сортировка</span><select data-pref="sort"><option value="name">По имени</option><option value="type">По типу</option><option value="modified">По дате</option></select></label>
        <button type="button" data-apply-all>Применить вид ко всем папкам</button>
      </div>`;
    document.body.append(el);bindExplorerWindow(el);
    $("#osminogWindowsExplorerClose").addEventListener("click",closeExplorer);
    $("#osminogWindowsExplorerDesktop").addEventListener("click",()=>{if(active.kind==="virtual"){showVirtualOnDesktop(active.folderId);closeExplorer()}});
    $("#osminogWindowsExplorerNew").addEventListener("click",createFolderInsideActive);
    $("#osminogWindowsExplorerBack").addEventListener("click",goBack);
    $("#osminogWindowsExplorerUp").addEventListener("click",goUp);
    $("#osminogWindowsExplorerSearch").addEventListener("input",e=>{searchText=e.target.value;renderExplorerItems()});
    $("#osminogWindowsExplorerView").addEventListener("change",e=>savePrefs({viewMode:e.target.value}));
    $("#osminogWindowsExplorerSettings").addEventListener("click",()=>{const p=$("#osminogWindowsExplorerPrefs");p.hidden=!p.hidden;syncPrefsUi()});
    $$("#osminogWindowsExplorerPrefs [data-pref]").forEach(sel=>sel.addEventListener("change",()=>savePrefs({[sel.dataset.pref]:sel.value})));
    $("#osminogWindowsExplorerPrefs [data-apply-all]").addEventListener("click",()=>{const p=currentPrefs();savePrefs({viewMode:p.viewMode,contentSize:p.contentSize,desktopSize:p.desktopSize,sort:p.sort},{all:true});notify("Настройки применены ко всем папкам")});
    el.addEventListener("dragover",e=>{if(e.dataTransfer?.types?.includes("application/x-osminog-folder-item")||e.dataTransfer?.files?.length){e.preventDefault();e.dataTransfer.dropEffect="move"}});
    el.addEventListener("drop",async e=>{if(e.target.closest(".osminog-windows-explorer-item"))return;e.preventDefault();await handleDropOnCurrent(e)});
  }
  function bindExplorerWindow(el){
    const handle=el.querySelector(".osminog-windows-explorer-head");let drag=null;handle.addEventListener("pointerdown",e=>{if(e.button!==0||e.target.closest("button,input,select"))return;const r=el.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};handle.setPointerCapture?.(e.pointerId);e.preventDefault()});handle.addEventListener("pointermove",e=>{if(!drag||drag.id!==e.pointerId)return;el.style.left=`${clamp(e.clientX-drag.dx,8,innerWidth-el.offsetWidth-8)}px`;el.style.top=`${clamp(e.clientY-drag.dy,70,innerHeight-el.offsetHeight-8)}px`});handle.addEventListener("pointerup",()=>drag=null);
    for(const dir of["n","e","s","w","ne","se","sw","nw"]){const h=document.createElement("span");h.className=`osminog-win-resize ${dir}`;el.append(h);let rs=null;h.addEventListener("pointerdown",e=>{const r=el.getBoundingClientRect();rs={id:e.pointerId,x:e.clientX,y:e.clientY,l:r.left,t:r.top,w:r.width,h:r.height,dir};h.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopPropagation()});h.addEventListener("pointermove",e=>{if(!rs||rs.id!==e.pointerId)return;const dx=e.clientX-rs.x,dy=e.clientY-rs.y;let l=rs.l,t=rs.t,w=rs.w,hh=rs.h;if(dir.includes("e"))w=Math.max(560,rs.w+dx);if(dir.includes("s"))hh=Math.max(360,rs.h+dy);if(dir.includes("w")){w=Math.max(560,rs.w-dx);l=rs.l+(rs.w-w)}if(dir.includes("n")){hh=Math.max(360,rs.h-dy);t=rs.t+(rs.h-hh)}Object.assign(el.style,{left:`${clamp(l,8,innerWidth-580)}px`,top:`${clamp(t,70,innerHeight-380)}px`,width:`${Math.min(innerWidth-16,w)}px`,height:`${Math.min(innerHeight-78,hh)}px`})});h.addEventListener("pointerup",()=>rs=null)}
  }

  function openRootFolder(path=""){ensureExplorer();active={kind:"root",path:String(path||""),folderId:null};searchText="";selectedItemKey="";$("#osminogWindowsExplorer").hidden=false;$("#osminogWindowsExplorerSearch").value="";renderExplorer()}
  function openVirtualFolder(id){const f=folderById(id);if(!f)return;ensureExplorer();active={kind:"virtual",path:"",folderId:id};searchText="";selectedItemKey="";$("#osminogWindowsExplorer").hidden=false;$("#osminogWindowsExplorerSearch").value="";renderExplorer()}
  function closeExplorer(){const win=$("#osminogWindowsExplorer");if(win)win.hidden=true;selectedItemKey="";renameState=null}
  function activeTitle(){if(active.kind==="virtual")return folderById(active.folderId)?.name||"Папка";return active.path?baseName(active.path):(api()?.status?"Папка проекта":"OSMINOG")}
  function renderExplorer(){ensureExplorer();const title=activeTitle(),meta=active.kind==="virtual"?"Папка холста":active.path||"Папка проекта";$("#osminogWindowsExplorerTitle").textContent=title;$("#osminogWindowsExplorerMeta").textContent=meta;$("#osminogWindowsExplorerDesktop").hidden=active.kind!=="virtual"||!!folderById(active.folderId)?.desktopVisible;syncPrefsUi();renderBreadcrumb();loadExplorerItems()}
  function syncPrefsUi(){const p=currentPrefs();$("#osminogWindowsExplorerView").value=p.viewMode||"tiles";$$("#osminogWindowsExplorerPrefs [data-pref]").forEach(sel=>sel.value=p[sel.dataset.pref]||DEFAULT_PREFS[sel.dataset.pref])}
  function renderBreadcrumb(){const box=$("#osminogWindowsExplorerBreadcrumb");if(!box)return;if(active.kind==="root"){const parts=active.path.split("/").filter(Boolean);box.innerHTML=`<button data-crumb-root>OSMINOG</button>${parts.map((part,i)=>`<span>›</span><button data-crumb-real="${esc(parts.slice(0,i+1).join("/"))}">${esc(part)}</button>`).join("")}`;box.querySelector("[data-crumb-root]")?.addEventListener("click",()=>openRootFolder(""));box.querySelectorAll("[data-crumb-real]").forEach(b=>b.addEventListener("click",()=>openRootFolder(b.dataset.crumbReal)))}else{const path=[];let f=folderById(active.folderId),guard=0;while(f&&guard++<80){path.unshift(f);f=folderById(f.parentId)}box.innerHTML=`<button data-crumb-root>OSMINOG</button>${path.map(x=>`<span>›</span><button data-crumb-virtual="${esc(x.id)}">${esc(x.name)}</button>`).join("")}`;box.querySelector("[data-crumb-root]")?.addEventListener("click",()=>openRootFolder(""));box.querySelectorAll("[data-crumb-virtual]").forEach(b=>b.addEventListener("click",()=>openVirtualFolder(b.dataset.crumbVirtual)))}
  }
  function goBack(){goUp()}
  function goUp(){if(active.kind==="root"){if(active.path)openRootFolder(parentPath(active.path));else closeExplorer()}else{const f=folderById(active.folderId);if(f?.parentId)openVirtualFolder(f.parentId);else openRootFolder("")}}
  async function loadExplorerItems(){const box=$("#osminogWindowsExplorerItems");if(!box)return;box.innerHTML='<div class="osminog-win-empty">Загрузка…</div>';let items=[];if(active.kind==="root"){
      if(!active.path){items.push(...foldersNow().filter(f=>!f.parentId&&!f.desktopVisible).map(f=>({key:`vf:${f.id}`,kind:"virtual-folder",name:f.name,folderId:f.id,type:"Папка холста",modified:f.createdAt||0,count:folderCount(f)})))}
      const result=await api()?.list?.({path:active.path,depth:0,max:500,include_meta:true});if(result?.entries)items.push(...result.entries.map(entry=>({key:`fs:${entry.path}`,kind:entry.kind==="directory"?"real-folder":"real-file",name:baseName(entry.path),path:entry.path,type:entry.type||entry.kind,size:entry.size||0,modified:entry.modified||0})))
    }else{const f=folderById(active.folderId);if(f){items.push(...foldersNow().filter(x=>x.parentId===f.id).map(x=>({key:`vf:${x.id}`,kind:"virtual-folder",name:x.name,folderId:x.id,type:"Папка холста",modified:x.createdAt||0,count:folderCount(x)})));items.push(...(f.members||[]).map(id=>objectsNow().find(o=>o.id===id)).filter(Boolean).map(o=>({key:`obj:${o.id}`,kind:"object",name:o.name||o.id,objectId:o.id,type:o.type||"object",modified:o.updated||0,previewSrc:o.type==="image"?(o.src||o.dataUrl||o.previewDataUrl||""):""})))}}
    explorerItems=items;renderExplorerItems();
  }
  function sortItems(items,prefs){return items.slice().sort((a,b)=>{const ad=a.kind.includes("folder"),bd=b.kind.includes("folder");if(ad!==bd)return ad?-1:1;if(prefs.sort==="type")return String(a.type).localeCompare(String(b.type),"ru")||a.name.localeCompare(b.name,"ru");if(prefs.sort==="modified")return Number(b.modified||0)-Number(a.modified||0)||a.name.localeCompare(b.name,"ru");return a.name.localeCompare(b.name,"ru")})}
  function itemIcon(item){const thumb=item.previewSrc||thumbnailCache.get(item.key);if(thumb)return`<span class="osminog-win-thumb"><img src="${esc(thumb)}" alt="${esc(item.name||"preview")}"></span>`;if(item.kind.includes("folder"))return folderGlyph();if(item.kind==="object"){const map={image:"🖼️",file:"📄",code:"🧩",brief:"📋",text:"T",note:"📝",shape:"▰",vector:"✒️",browser:"🌐",button:"▣",node:"◉",ink:"✏️"};return`<span class="osminog-win-file-glyph">${map[item.type]||"◻"}</span>`}const type=String(item.type||"");return`<span class="osminog-win-file-glyph">${type.startsWith("image/")?"🖼️":type.startsWith("video/")?"🎬":type.startsWith("audio/")?"🎵":/pdf/i.test(type)?"📕":"📄"}</span>`}
  async function hydrateExplorerThumbnails(items){
    const targets=(items||[]).filter(item=>item.kind==="real-file"&&String(item.type||"").startsWith("image/")&&!thumbnailCache.has(item.key)).slice(0,24);
    await Promise.all(targets.map(async item=>{try{const read=await api()?.read?.({path:item.path,include_data:true,max_mb:4,max_chars:0});if(read?.kind==="image"&&read.dataUrl)thumbnailCache.set(item.key,read.dataUrl)}catch{}}));
    if(targets.some(item=>thumbnailCache.has(item.key))){const box=$("#osminogWindowsExplorerItems");if(box&&!box.dataset.thumbRefresh){box.dataset.thumbRefresh="1";requestAnimationFrame(()=>{delete box.dataset.thumbRefresh;renderExplorerItems()})}}
  }
  function renderExplorerItems(){const box=$("#osminogWindowsExplorerItems");if(!box)return;const p=currentPrefs(),q=searchText.trim().toLowerCase(),items=sortItems(explorerItems.filter(i=>!q||i.name.toLowerCase().includes(q)),p);box.className=`osminog-windows-explorer-items view-${p.viewMode||"tiles"} size-${p.contentSize||"medium"}`;box.innerHTML=items.map(item=>`<article class="osminog-windows-explorer-item ${esc(item.kind)}${selectedItemKey===item.key?" selected":""}" data-item-key="${esc(item.key)}" draggable="true">${itemIcon(item)}<div class="osminog-win-item-copy">${renameState===item.key?`<input class="osminog-win-item-rename" value="${esc(item.name)}" maxlength="180">`:`<strong class="osminog-win-item-name">${esc(item.name)}</strong>`}<small>${esc(item.type||"")}</small></div><span class="osminog-win-item-size">${item.size?formatSize(item.size):item.count!=null?`${item.count} эл.`:""}</span><span class="osminog-win-item-date">${item.modified?new Date(item.modified).toLocaleDateString():""}</span>${item.kind==="virtual-folder"?`<button type="button" class="osminog-win-item-desktop" data-item-desktop="${esc(item.folderId)}" title="Вернуть папку на рабочий стол" aria-label="Вернуть папку на рабочий стол">↗</button>`:""}</article>`).join("")||'<div class="osminog-win-empty">Ничего не найдено</div>';$("#osminogWindowsExplorerStatus").textContent=`${items.length} элемент(а)`;bindExplorerItems();hydrateExplorerThumbnails(items).catch(()=>{});if(renameState)queueMicrotask(()=>{const input=box.querySelector(".osminog-win-item-rename");input?.focus();input?.select()})}
  function formatSize(n){n=Number(n)||0;return n<1024?`${n} Б`:n<1048576?`${(n/1024).toFixed(1)} КБ`:`${(n/1048576).toFixed(1)} МБ`}
  function bindExplorerItems(){const box=$("#osminogWindowsExplorerItems");box.querySelectorAll("[data-item-key]").forEach(el=>{const item=explorerItems.find(i=>i.key===el.dataset.itemKey);if(!item)return;el.querySelector("[data-item-desktop]")?.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();if(showVirtualOnDesktop(item.folderId))loadExplorerItems()});el.addEventListener("contextmenu",e=>{if(item.kind!=="virtual-folder")return;e.preventDefault();e.stopPropagation();showFolderContext(e.clientX,e.clientY,item.folderId)});el.addEventListener("click",e=>{if(e.target.closest("input,button"))return;selectedItemKey=item.key;renderExplorerItems();showPreview(item)});el.addEventListener("dblclick",e=>{if(e.target.closest("button"))return;if(e.target.closest(".osminog-win-item-name")){e.preventDefault();startRename(item);return}if(item.kind==="virtual-folder")openVirtualFolder(item.folderId);else if(item.kind==="real-folder")openRootFolder(item.path);else showPreview(item,true)});el.addEventListener("dragstart",e=>{if(e.target.closest("button,input")){e.preventDefault();return}dragItem=item;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-osminog-folder-item",JSON.stringify(item));el.classList.add("dragging")});el.addEventListener("dragend",()=>{dragItem=null;el.classList.remove("dragging")});if(item.kind.includes("folder")){el.addEventListener("dragover",e=>{if(dragItem||e.dataTransfer?.files?.length){e.preventDefault();el.classList.add("drop-active")}});el.addEventListener("dragleave",()=>el.classList.remove("drop-active"));el.addEventListener("drop",async e=>{e.preventDefault();e.stopPropagation();el.classList.remove("drop-active");if(item.kind==="virtual-folder")await handleDropOnVirtualFolder(e,item.folderId);else await handleDropOnRealFolder(e,item.path)})}});box.querySelectorAll(".osminog-win-item-rename").forEach(input=>{const key=input.closest("[data-item-key]")?.dataset.itemKey,item=explorerItems.find(i=>i.key===key);if(!item)return;const commit=async()=>{await commitRename(item,input.value)};input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();commit()}else if(e.key==="Escape"){renameState=null;renderExplorerItems()}});input.addEventListener("blur",commit,{once:true})})}
  function startRename(item){renameState=item.key;renderExplorerItems()}
  async function commitRename(item,value){const name=safeName(value);renameState=null;if(item.kind==="virtual-folder"){const f=folderById(item.folderId);if(f)f.name=name;persist()}else if(item.kind==="object"){const o=objectsNow().find(x=>x.id===item.objectId);if(o){o.name=name;persist();try{globalThis.renderObjects?.(true)}catch{}}}else{const result=await api()?.rename?.({path:item.path,name});if(result?.error)notify(result.error);await loadExplorerItems()}}
  async function showPreview(item,force=false){const preview=$("#osminogWindowsExplorerPreview");if(!preview)return;preview.innerHTML=`<h3>${esc(item.name)}</h3><p>${esc(item.type||item.kind)}</p>`;if(item.kind==="virtual-folder")preview.innerHTML+=`<button type="button" data-open-vf>Открыть</button><button type="button" data-desktop-vf>На рабочий стол</button>`;else if(item.kind==="object")preview.innerHTML+=`<button type="button" data-object-desktop>Вернуть на холст</button>`;else if(item.kind==="real-folder")preview.innerHTML+=`<button type="button" data-open-real>Открыть</button>`;else if(item.kind==="real-file"&&(force||String(item.type||"").startsWith("image/"))){const read=await api()?.read?.({path:item.path,include_data:true,max_mb:10,max_chars:100000});if(read?.kind==="image")preview.innerHTML+=`<img src="${esc(read.dataUrl)}" alt="">`;else if(read?.kind==="video")preview.innerHTML+=`<video controls src="${esc(read.dataUrl)}"></video>`;else if(read?.kind==="audio")preview.innerHTML+=`<audio controls src="${esc(read.dataUrl)}"></audio>`;else if(read?.kind==="text")preview.innerHTML+=`<pre>${esc(read.content||"")}</pre>`;preview.innerHTML+=`<button type="button" data-real-canvas>На холст</button>`;preview._read=read}
    preview.querySelector("[data-open-vf]")?.addEventListener("click",()=>openVirtualFolder(item.folderId));preview.querySelector("[data-desktop-vf]")?.addEventListener("click",()=>showVirtualOnDesktop(item.folderId));preview.querySelector("[data-object-desktop]")?.addEventListener("click",()=>moveObjectToDesktop(item.objectId));preview.querySelector("[data-open-real]")?.addEventListener("click",()=>openRootFolder(item.path));preview.querySelector("[data-real-canvas]")?.addEventListener("click",()=>putRealFileOnCanvas(item,preview._read))}
  async function putRealFileOnCanvas(item,read){if(!read)return;const c=globalThis.viewportCenter?.()||{x:0,y:0};let created=null;if(read.kind==="image")created=globalThis.OSMINOGCanvasObjectAPI?.create?.("image",{name:item.name,src:read.dataUrl,x:c.x-240,y:c.y-170,w:480,h:340,radius:0,fillEnabled:false,strokeEnabled:false});else if(read.kind==="text")created=globalThis.OSMINOGCanvasObjectAPI?.create?.("code",{name:item.name,code:read.content||"",x:c.x-360,y:c.y-215,w:720,h:430});else if(read.dataUrl)created=globalThis.OSMINOGCanvasObjectAPI?.create?.("file",{name:item.name,fileName:item.name,mime:read.type||item.type,size:read.size||item.size,src:read.dataUrl,x:c.x-180,y:c.y-75,w:360,h:150});if(created){closeExplorer();notify(`Добавлено на холст: ${item.name}`)}}

  async function uniqueRealFolderName(base="Новая папка"){const existing=new Set(explorerItems.filter(i=>i.kind.startsWith("real-")).map(i=>i.name.toLowerCase()));let name=base,n=2;while(existing.has(name.toLowerCase()))name=`${base} ${n++}`;return name}
  async function createFolderInsideActive(){if(active.kind==="virtual"){const f=createVirtualFolder({parentId:active.folderId,desktopVisible:false,rename:false});await loadExplorerItems();startRename({key:`vf:${f.id}`,kind:"virtual-folder",folderId:f.id,name:f.name})}else{const name=await uniqueRealFolderName();const path=joinPath(active.path,name),result=await api()?.mkdir?.({path});if(result?.error)notify(result.error);await loadExplorerItems();const item=explorerItems.find(i=>i.kind==="real-folder"&&i.path===path);if(item)startRename(item)}}

  function parseDrag(e){if(dragItem)return dragItem;try{return JSON.parse(e.dataTransfer?.getData("application/x-osminog-folder-item")||"null")}catch{return null}}
  async function handleDropOnVirtualFolder(e,targetId){const item=parseDrag(e);if(item){if(item.kind==="virtual-folder")moveVirtualFolder(item.folderId,targetId);else if(item.kind==="object")moveObjectToFolder(item.objectId,targetId);else if(item.kind==="real-file")await importRealFileToVirtual(item,targetId);return}if(e.dataTransfer?.files?.length)await importExternalFilesToVirtual(e.dataTransfer.files,targetId)}
  async function handleDropOnRealFolder(e,targetPath){const item=parseDrag(e);if(item?.kind==="real-file"||item?.kind==="real-folder"){const result=await api()?.move?.({source:item.path,targetDir:targetPath});if(result?.error)notify(result.error);await loadExplorerItems();return}if(e.dataTransfer?.files?.length)notify("Для внешних файлов используйте обычную папку Windows или кнопку подключения")}
  async function handleDropOnCurrent(e){const item=parseDrag(e);if(!item)return;if(active.kind==="virtual"){if(item.kind==="virtual-folder")moveVirtualFolder(item.folderId,active.folderId);else if(item.kind==="object")moveObjectToFolder(item.objectId,active.folderId);else if(item.kind==="real-file")await importRealFileToVirtual(item,active.folderId)}else if(item.kind==="real-file"||item.kind==="real-folder"){const result=await api()?.move?.({source:item.path,targetDir:active.path});if(result?.error)notify(result.error);await loadExplorerItems()}else if(item.kind==="virtual-folder"&&!active.path){const f=folderById(item.folderId);if(f){f.parentId=null;f.desktopVisible=false;persist()}}}
  async function importRealFileToVirtual(item,targetId){const read=await api()?.read?.({path:item.path,include_data:true,max_mb:10,max_chars:100000});if(!read||read.error){notify(read?.error||"Не удалось прочитать файл");return}const c=globalThis.viewportCenter?.()||{x:0,y:0};let created=null;if(read.kind==="image")created=globalThis.OSMINOGCanvasObjectAPI?.create?.("image",{name:item.name,src:read.dataUrl,x:c.x,y:c.y,w:480,h:340,radius:0,fillEnabled:false,strokeEnabled:false});else if(read.kind==="text")created=globalThis.OSMINOGCanvasObjectAPI?.create?.("code",{name:item.name,code:read.content||"",x:c.x,y:c.y,w:720,h:430});else if(read.dataUrl)created=globalThis.OSMINOGCanvasObjectAPI?.create?.("file",{name:item.name,fileName:item.name,mime:read.type||item.type,size:read.size||item.size,src:read.dataUrl,x:c.x,y:c.y,w:360,h:150});if(created)moveObjectToFolder(created.id,targetId)}
  async function importExternalFilesToVirtual(files,targetId){const before=new Set(objectsNow().map(o=>o.id)),f=folderById(targetId);if(!f)return;if(typeof globalThis.importFiles==="function")await globalThis.importFiles([...files],globalThis.viewportCenter?.()||{x:0,y:0});await new Promise(r=>setTimeout(r,60));for(const o of objectsNow().filter(o=>!before.has(o.id)))moveObjectToFolder(o.id,targetId)}

  function showFolderContext(x,y,id=""){let menu=$("#osminogWindowsFolderMenu");if(!menu){menu=document.createElement("div");menu.id="osminogWindowsFolderMenu";menu.className="osminog-windows-folder-menu";document.body.append(menu)}menu.dataset.folderId=id;const folder=id?folderById(id):null,canRestore=!!folder&&(!folder.desktopVisible||!!folder.parentId);menu.innerHTML=id?`<button data-action="open">Открыть</button><button data-action="rename">Переименовать</button>${canRestore?'<button data-action="desktop">На рабочий стол</button>':'<button data-action="close">Закрыть в папку проекта</button>'}<button data-action="delete" class="danger">Удалить</button>`:`<button data-action="new">📁 Новая папка</button><button data-action="root">Открыть папку проекта</button><button data-action="settings">Настройки папок</button>`;menu.style.left=`${clamp(x,8,innerWidth-230)}px`;menu.style.top=`${clamp(y,70,innerHeight-230)}px`;menu.hidden=false;menu.onclick=e=>{const action=e.target.closest("[data-action]")?.dataset.action;if(!action)return;menu.hidden=true;if(action==="new")createVirtualFolder({screenX:contextPoint.x,screenY:contextPoint.y,rename:true});if(action==="root")openRootFolder();if(action==="settings"){openRootFolder();setTimeout(()=>$("#osminogWindowsExplorerSettings")?.click(),50)}if(action==="open")openVirtualFolder(id);if(action==="rename"){if(folder?.desktopVisible)beginDesktopRename(id);else{const item=explorerItems.find(i=>i.folderId===id);if(item)startRename(item)}}if(action==="desktop"){showVirtualOnDesktop(id);loadExplorerItems()}if(action==="close")closeVirtualFolder(id);if(action==="delete"&&confirm("Удалить папку? Объекты вернутся на холст."))deleteVirtualFolder(id)};setTimeout(()=>document.addEventListener("pointerdown",ev=>{if(!ev.target.closest("#osminogWindowsFolderMenu"))menu.hidden=true},{capture:true,once:true}),0)}
  function installContextMenu(){const viewport=$("#viewport");viewport?.addEventListener("contextmenu",e=>{if(e.target.closest(".canvas-object,.osminog-win-folder-icon,.osminog-desktop-folder-icon,.side-panel,.inspector,.gpt-presence-shell,.team-shell,.osminog-google-chat,.osminog-windows-explorer"))return;e.preventDefault();e.stopImmediatePropagation();const r=viewport.getBoundingClientRect();contextPoint={x:clamp(e.clientX-r.left-45,8,r.width-120),y:clamp(e.clientY-r.top-35,72,r.height-110)};showFolderContext(e.clientX,e.clientY,"")},true)}

  function installExplorerDesktopDrop(){const viewport=$("#viewport");if(!viewport||viewport.dataset.osminogFolderDesktopDrop==="1")return;viewport.dataset.osminogFolderDesktopDrop="1";viewport.addEventListener("dragover",e=>{const item=dragItem;if(!item||e.target.closest(".osminog-windows-explorer,.osminog-win-folder-icon"))return;if(!["virtual-folder","object","real-file"].includes(item.kind))return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect="move"},true);viewport.addEventListener("drop",async e=>{const item=dragItem;if(!item||e.target.closest(".osminog-windows-explorer,.osminog-win-folder-icon"))return;if(!["virtual-folder","object","real-file"].includes(item.kind))return;e.preventDefault();e.stopPropagation();const r=viewportRect();if(item.kind==="virtual-folder"){const f=folderById(item.folderId),size=desktopSizePx(f?.desktopSize||"medium");showVirtualOnDesktop(item.folderId,{screenX:e.clientX-r.left-size/2,screenY:e.clientY-r.top-36})}else if(item.kind==="object"){moveObjectToDesktop(item.objectId);const o=objectsNow().find(x=>x.id===item.objectId),wp=globalThis.worldPoint?.(e.clientX,e.clientY);if(o&&wp){o.x=Math.round(wp.x-o.w/2);o.y=Math.round(wp.y-o.h/2);persist();globalThis.renderAll?.()}}else if(item.kind==="real-file"){const read=await api()?.read?.({path:item.path,include_data:true,max_mb:20,max_chars:120000});const wp=globalThis.worldPoint?.(e.clientX,e.clientY)||globalThis.viewportCenter?.()||{x:0,y:0};if(read){let created=null;if(read.kind==="image")created=globalThis.OSMINOGCanvasObjectAPI?.create?.("image",{name:item.name,src:read.dataUrl,x:wp.x-240,y:wp.y-170,w:480,h:340,radius:0,fillEnabled:false,strokeEnabled:false});else if(read.kind==="text")created=globalThis.OSMINOGCanvasObjectAPI?.create?.("code",{name:item.name,code:read.content||"",x:wp.x-360,y:wp.y-215,w:720,h:430});if(created)notify(`Добавлено на холст: ${item.name}`)}}dragItem=null;loadExplorerItems()},true)}

  function installCanvasObjectDrop(){let drag=null;document.addEventListener("pointerdown",e=>{const el=e.target.closest?.(".canvas-object");if(!el||e.button!==0)return;drag={id:el.dataset.id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false}},true);document.addEventListener("pointermove",e=>{if(!drag||drag.pointerId!==e.pointerId)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;if(!drag.moved)return;const target=document.elementsFromPoint(e.clientX,e.clientY).find(el=>el.classList?.contains("osminog-win-folder-icon"));clearDesktopDrop();target?.classList.add("drop-active")},true);document.addEventListener("pointerup",e=>{if(!drag||drag.pointerId!==e.pointerId)return;const stack=document.elementsFromPoint(e.clientX,e.clientY),desktopTarget=stack.find(el=>el.classList?.contains("osminog-win-folder-icon"))?.dataset.winFolderId,explorerItem=stack.find(el=>el?.dataset?.itemKey?.startsWith?.("vf:")),explorer=stack.find(el=>el?.id==="osminogWindowsExplorer"||el?.closest?.("#osminogWindowsExplorer")),explorerTarget=explorerItem?.dataset?.itemKey?.slice(3)||((explorer&&active.kind==="virtual")?active.folderId:null),target=desktopTarget||explorerTarget;if(target&&drag.moved){const picked=Array.isArray(coreState()?.selected)&&coreState().selected.includes(drag.id)?coreState().selected:[drag.id];for(const id of picked)moveObjectToFolder(id,target);if(explorer)loadExplorerItems()}drag=null;clearDesktopDrop()},true);document.addEventListener("pointercancel",()=>{drag=null;clearDesktopDrop()},true)}

  function removeOldFolderUi(){$("#osminogFolderTray")?.remove();$("#osminogCanvasFolderWindow")?.setAttribute("hidden","");$("#osminogFolderContextMenu")?.setAttribute("hidden","");$("#osminogDesktopFolderWindow")?.setAttribute("hidden","");$$(".osminog-canvas-folder").forEach(el=>el.remove());$("#layerList .osminog-layer-folder-section")?.remove()}
  function wrapRenderLayers(){if(typeof globalThis.renderLayers!=="function"||globalThis.renderLayers.__osminogWinFolders)return;const base=globalThis.renderLayers;let raf=0;const wrapped=function(...args){const out=base.apply(this,args);if(!raf)raf=requestAnimationFrame(()=>{raf=0;removeOldFolderUi();injectLayerControls()});return out};wrapped.__osminogWinFolders=true;globalThis.renderLayers=wrapped}
  function refreshExplorerSoon(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(!$("#osminogWindowsExplorer")?.hidden)loadExplorerItems()},80)}

  async function install(){
    removeOldFolderUi();wrapRenderLayers();ensureDesktopLayer();ensureExplorer();injectRootClose();installContextMenu();installExplorerDesktopDrop();installCanvasObjectDrop();migrate();try{rootHidden=!!(await chrome.storage.local.get(ROOT_HIDDEN_KEY()))?.[ROOT_HIDDEN_KEY()]}catch{rootHidden=false}await refreshRootConnection();try{const pos=(await chrome.storage.local.get(`osminogRootFolderPositionV3:${pid()}`))?.[`osminogRootFolderPositionV3:${pid()}`],icon=$("#osminogDesktopFolderIcon");if(pos&&icon){icon.style.left=`${Number(pos.left)||72}px`;icon.style.top=`${Number(pos.top)||116}px`}}catch{}renderDesktopFolders();injectLayerControls();
    document.addEventListener("osminog:project-opened",async()=>{active={kind:"root",path:"",folderId:null};migrate();try{rootHidden=!!(await chrome.storage.local.get(ROOT_HIDDEN_KEY()))?.[ROOT_HIDDEN_KEY()]}catch{rootHidden=false}await refreshRootConnection();scheduleUi()});
    document.addEventListener("osminog:project-folder-ready",async()=>{rootConnected=true;await refreshRootConnection();injectLayerControls();if(!$("#osminogWindowsExplorer")?.hidden)loadExplorerItems()});
    document.addEventListener("osminog:project-folder-synced",()=>{rootConnected=true;applyRootVisibility();if(!$("#osminogWindowsExplorer")?.hidden)loadExplorerItems()});
    window.addEventListener("resize",scheduleUi,{passive:true});
    const exposed={openRoot:openRootFolder,openVirtual:openVirtualFolder,create:createVirtualFolder,showOnDesktop:showVirtualOnDesktop,closeIntoProject:closeVirtualFolder,list:()=>foldersNow().map(f=>({...f})),root:()=>foldersNow().filter(f=>!f.parentId),rename:(id,name)=>{const f=folderById(id);if(f){f.name=safeName(name);persist()}},moveObject:moveObjectToFolder,moveFolder:moveVirtualFolder,acceptCanvasObjects:async(ids,targetFolderId=null)=>{const target=targetFolderId||((active.kind==="virtual")?active.folderId:null);if(!target)return false;for(const id of Array.isArray(ids)?ids:[])moveObjectToFolder(id,target);await loadExplorerItems();return true},render:renderDesktopFolders};
    globalThis.OSMINOGWindowsFolders=exposed;globalThis.OSMINOGCanvasFolders={create:exposed.create,open:exposed.openVirtual,list:exposed.list,root:exposed.root,showOnDesktop:exposed.showOnDesktop,rename:exposed.rename,moveObject:exposed.moveObject,moveFolder:exposed.moveFolder,archive:exposed.closeIntoProject,render:exposed.render};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
