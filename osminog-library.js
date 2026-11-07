/* Local capture destination, date filter and searchable text index. No cloud upload. */
(()=>{'use strict';
const KEY='osminogCollectorV1',PREFIX='osminogCapture:',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localIcons={search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',clipboard:'<rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="M9 12h6M9 16h6"/>'};
const $=s=>document.querySelector(s),icon=n=>localIcons[n]?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+localIcons[n]+'</svg>':'<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor"/><path d="m15 15 5 5" stroke="currentColor"/></svg>';
let panel,cfg={},worker,pdfEngine,indexing=false,pending=0,mode='search',draining=null,drainAgain=false,queuePending=0,importErrors=[],selectedResults=new Set();
const L=k=>OSMINOGWorkspaceLanguage.label(k);const t=k=>OSMINOGWorkspaceLanguage.text(k);
const when=o=>Number(o.capturedAt||o.createdAt)||0;
const day=n=>{if(!n)return'';const d=new Date(n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function all(){return state.projects.flatMap(p=>(p.objects||[]).map(o=>({p,o})))}
const signatureCache=new WeakMap();
function signature(o){const s=o.src||'',revision=o.documentRevision||0,old=signatureCache.get(o);if(old&&old.src===s&&old.revision===revision)return old.value;let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);const value=s.length+':'+(h>>>0)+':'+revision;signatureCache.set(o,{src:s,revision,value});return value}
function body(o){return [OSMINOGWorkspaceLanguage.captureCaption(o,"name"),o.fileName,OSMINOGWorkspaceLanguage.captureCaption(o,"title"),o.text,o.url,o.code,o.searchIndex?.text].filter(v=>typeof v==='string').join('\n')}
function highlight(text,q){const i=q?text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()):-1;return i<0?esc(text):esc(text.slice(0,i))+'<mark>'+esc(text.slice(i,i+q.length))+'</mark>'+esc(text.slice(i+q.length))}
function matches(o,q,from,to){const d=day(when(o));return(!q||body(o).toLocaleLowerCase().includes(q.toLocaleLowerCase()))&&(!from||d&&d>=from)&&(!to||d&&d<=to)}
function captureStatus(){const status=cfg.error||importErrors[0]||(cfg.enabled?t('active'):t('paused'));return status+(queuePending?` · Ожидают сохранения: ${queuePending}`:'')}
function renderCaptureStatus(){const status=panel?.querySelector('[data-status]');if(status)status.textContent=captureStatus();const b=$('#libraryCapture');if(b){b.classList.toggle('active',!!cfg.enabled);b.setAttribute('aria-pressed',String(!!cfg.enabled));b.title=cfg.error||importErrors.length?captureStatus():cfg.enabled?L("Сбор включён · нажмите для настройки"):L("Сохранять из буфера");b.dataset.tip=b.title}}
async function refreshConfig(){const before=cfg;cfg=(await chrome.storage.local.get(KEY))[KEY]||{};document.dispatchEvent(new Event('osminog:capture-config'));renderCaptureStatus();if(before.projectId!==cfg.projectId||before.folderId!==cfg.folderId){globalThis.OSMINOGWindowsFolders?.render?.();globalThis.renderLayers?.()}}
async function saveConfig(next){const r=await chrome.runtime.sendMessage({type:'OSMINOG_COLLECTOR_CONFIGURE',patch:next});if(!r?.ok)throw Error(r?.error||'Не удалось сохранить настройки сбора');await refreshConfig()}
function close(){panel?.remove();panel=null}
function open(which='search'){close();mode=which;panel=document.createElement('section');panel.id='osminogLibrary';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',which==='capture'?t('capture'):'Поиск материалов');panel.innerHTML=`<header><strong>${which==='capture'?t('capture'):t('find')}</strong><div class="lib-header-actions">${which==='capture'?'':`<button type="button" data-delete-selected disabled aria-label="${L("Удалить выбранные материалы")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg><span>${L('Удалить')} (0)</span></button>`}<button data-close aria-label="${L("Закрыть")}">×</button></div></header><div class="lib-body"></div>`;document.body.append(panel);globalThis.OSMINOGPanelStack?.activate?.(panel);panel.querySelector('[data-close]').onclick=close;if(which==='capture')captureUI();else {searchUI(which==='calendar'||which==='today');if(which==='today'){panel.querySelector('header strong').textContent=state.language==='ru'?'Сегодня сохранено':'Saved today';panel.querySelector('[data-scope]').value='all';for(const field of panel.querySelectorAll('input[type=date]'))field.value=day(Date.now());results()}}}
function captureUI(){const root=panel.querySelector('.lib-body'),p=project();if(!p){root.textContent='Сначала откройте стол';return}const target=state.projects.find(p=>p.id===cfg.projectId),folder=target?.osminogFolders?.find(f=>f.id===cfg.folderId),validTarget=!!target&&(!cfg.folderId||!!folder);root.innerHTML=`<p class="lib-destination">${esc(target?.name||L("Стол не выбран"))} → ${esc(cfg.folderId?folder?.name||L("Папка не найдена"):L("На стол"))}</p><label>${t("dest")}<select data-folder><option value="" ${cfg.projectId===p.id&&!cfg.folderId?'selected':''}>${t("deskDest")}</option>${(p.osminogFolders||[]).map(f=>`<option value="${esc(f.id)}" ${cfg.projectId===p.id&&cfg.folderId===f.id?'selected':''}>${t("folder")}: ${esc(f.name)}</option>`).join('')}<option value="__new_inbox__">${t("makeInbox")}</option></select></label><button data-destination>${t("saveHere")}</button><label class="lib-toggle"><input type="checkbox" data-enabled ${cfg.enabled?'checked':''}> ${t("auto")}</label><p>${t('captureHelp')}</p><p data-status role="status">${esc(captureStatus())}</p><button data-open-folder ${validTarget?'':'disabled'}>${folder?t('openFolder'):t('openDesk')}</button>`;
root.querySelector('[data-destination]').onclick=async()=>{try{let id=root.querySelector('[data-folder]').value;if(id==='__new_inbox__'){const f=OSMINOGWindowsFolders.create({name:t('inbox'),rename:false});f.sort='modified';id=f.id;}await persist();await saveConfig({followDesk:false,projectId:p.id,folderId:id,lastHash:'',error:''});captureUI()}catch(e){root.querySelector('[data-status]').textContent=e.message}};
root.querySelector('[data-enabled]').onchange=async e=>{try{if(e.target.checked&&!validTarget)throw Error('Сначала выберите стол или папку кнопкой «Сохранять сюда»');await saveConfig({enabled:e.target.checked,error:''});captureUI()}catch(err){e.target.checked=!!cfg.enabled;root.querySelector('[data-status]').textContent=err.message}};
root.querySelector('[data-open-folder]').onclick=()=>{openProject(target.id);if(folder)OSMINOGWindowsFolders.openVirtual(folder.id);close()};}
function searchUI(calendar){const root=panel.querySelector('.lib-body');selectedResults.clear();root.innerHTML=`<input data-query type="search" placeholder="${L("Текст, название файла, слова на скриншоте…")}" aria-label="${L('Поиск')}"><div class="lib-filters"><select data-scope aria-label="${L("Где искать")}"><option value="current">${L("Этот стол")}</option><option value="all">${L("Все столы")}</option></select><select data-kind aria-label="${L("Тип материала")}"><option value="">${L("Все материалы")}</option><option value="text">${L("Текст")}</option><option value="media">${L("Медиа")}</option><option value="file">${L("Файлы")}</option></select></div><details ${calendar?'open':''}><summary>${L("Дата сохранения")}</summary><div class="lib-filters"><label>${L("С")}<input type="date" data-from></label><label>${L("По")}<input type="date" data-to></label><button data-reset title="${L("Сбросить даты")}">×</button></div><small>${L("У старых материалов дата может быть неизвестна.")}</small></details><p data-index-status></p><div class="lib-bulk-bar"><label><input type="checkbox" data-select-all> <span>${L("Выбрать показанные")}</span></label><span data-selected-count>Выбрано: 0</span></div><button data-reindex>${L("Распознать текст в сохранённых файлах")}</button><div class="lib-results"></div>`;
root.querySelector('[data-reindex]').onclick=()=>{for(const {o} of all())if(o.searchIndex?.error)delete o.searchIndex;indexAll().catch(e=>globalThis.showToast?.(e.message))};
root.querySelectorAll('input:not([type=checkbox]),select').forEach(el=>el.addEventListener('input',results));
root.querySelector('[data-reset]').onclick=()=>{root.querySelector('[data-from]').value='';root.querySelector('[data-to]').value='';results()};
root.querySelector('[data-select-all]').onchange=e=>{visibleResults().forEach(({p,o})=>{const key=resultKey(p,o);if(e.target.checked)selectedResults.add(key);else selectedResults.delete(key)});results()};
root.addEventListener('change',e=>{const box=e.target.closest('[data-result-select]');if(!box)return;const key=box.dataset.resultSelect;if(box.checked)selectedResults.add(key);else selectedResults.delete(key);updateBulkControls()});
panel.addEventListener('click',e=>{if(e.target.closest('[data-delete-selected]')){deleteSelectedResults();return}const open=e.target.closest('[data-result-open]');if(open){const [pid,oid]=decodeResultKey(open.dataset.resultOpen),p=state.projects.find(x=>x.id===pid),o=p?.objects?.find(x=>x.id===oid);if(!p||!o)return;if(project()?.id!==p.id)openProject(p.id);const folder=p.osminogFolders?.find(f=>f.id===o.osminogFolderId);close();if(globalThis.OSMINOGWindowsFolders?.openObject)OSMINOGWindowsFolders.openObject(o.id);else{selectObject(o.id,false);focusObject(o)}}});
results();if(!calendar)root.querySelector('[data-query]').focus();}
function resultKey(p,o){return encodeURIComponent(p.id)+'|'+encodeURIComponent(o.id)}
function decodeResultKey(key){const i=key.indexOf('|');return[decodeURIComponent(key.slice(0,i)),decodeURIComponent(key.slice(i+1))]}
function visibleResults(){const root=panel?.querySelector('.lib-body');if(!root)return[];const q=root.querySelector('[data-query]').value.trim(),scope=root.querySelector('[data-scope]').value,kind=root.querySelector('[data-kind]').value,from=root.querySelector('[data-from]').value,to=root.querySelector('[data-to]').value;return all().filter(({p,o})=>(mode!=='today'||o.captureId)&&(scope==='all'||p.id===project()?.id)&&(!kind||globalThis.OSMINOGWorkspacePolish?.materialKind(o)===kind)&&matches(o,q,from,to)).sort((a,b)=>when(b.o)-when(a.o)).slice(0,200)}
function updateBulkControls(){const root=panel?.querySelector('.lib-body');if(!root)return;const visible=visibleResults(),count=selectedResults.size,allSelected=visible.length>0&&visible.every(({p,o})=>selectedResults.has(resultKey(p,o))),selectAll=root.querySelector('[data-select-all]');if(selectAll){selectAll.checked=allSelected;selectAll.indeterminate=!allSelected&&visible.some(({p,o})=>selectedResults.has(resultKey(p,o)))}root.querySelector('[data-selected-count]').textContent=(L('Выбрано')+': ')+count;const del=panel.querySelector('[data-delete-selected]');del.disabled=!count;del.querySelector('span').textContent=(L('Удалить')+' (')+count+')'}
async function deleteSelectedResults(){const picked=all().filter(({p,o})=>selectedResults.has(resultKey(p,o)));if(!picked.length)return;const ok=await (globalThis.OSMINOGConfirm?.({title:state.language==='ru'?'Удалить выбранное?':'Delete selected?',text:state.language==='ru'?'Будет удалено материалов: '+picked.length+'. Действие можно отменить через Undo.':'This will delete '+picked.length+' items. You can undo this action.',confirmText:state.language==='ru'?L("Удалить"):'Delete',cancelText:state.language==='ru'?'Отмена':'Cancel',danger:true})??Promise.resolve(confirm('Delete '+picked.length+' items?')));if(!ok)return;const ids=[...new Set(picked.map(({p})=>p.id))],snapshot=globalThis.OSMINOGSnapshotProjects?.(ids);if(snapshot)globalThis.OSMINOGPushBulkHistory?.(snapshot);const byProject=new Map();for(const {p,o} of picked){if(!byProject.has(p.id))byProject.set(p.id,new Set());byProject.get(p.id).add(o.id)}for(const [pid,remove] of byProject){const p=state.projects.find(x=>x.id===pid);if(!p)continue;p.objects=(p.objects||[]).filter(o=>!remove.has(o.id));(p.osminogFolders||[]).forEach(f=>{f.members=(f.members||[]).filter(id=>!remove.has(id))});p.connections=(p.connections||[]).filter(c=>!remove.has(c.from)&&!remove.has(c.to));const used=new Set(p.objects.map(o=>o.group).filter(Boolean));p.groups=(p.groups||[]).filter(g=>used.has(g.id));p.logs=p.logs||[];p.logs.unshift({id:'bulk-delete-'+Date.now(),at:Date.now(),text:'Удалено материалов: '+remove.size});p.logs=p.logs.slice(0,80)}selectedResults.clear();state.selected=[];state.selectedConnection=null;renderAll(true);queuePersist();results()}
function results(){if(!panel||mode==='capture')return;const root=panel,q=root.querySelector('[data-query]').value.trim(),list=visibleResults(),out=root.querySelector('.lib-results');root.querySelector('[data-index-status]').textContent=indexing?`${L('Распознавание')}: ${pending}`:`${L('Найдено')}: ${list.length}`;out.replaceChildren();const visibleKeys=new Set(list.map(({p,o})=>resultKey(p,o)));selectedResults=new Set([...selectedResults].filter(key=>visibleKeys.has(key)));for(const {p,o} of list){const key=resultKey(p,o),card=document.createElement('article');card.className='lib-card';const folder=p.osminogFolders?.find(f=>f.id===o.osminogFolderId),content=body(o),at=q?content.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()):-1,start=Math.max(0,at-60),excerpt=content.slice(start,start+220);card.innerHTML=`<label class="lib-card-select"><input type="checkbox" data-result-select="${esc(key)}" ${selectedResults.has(key)?'checked':''} aria-label="${L("Выбрать материал")}"></label>${o.type==='image'&&String(o.src||'').startsWith('data:image/')?`<img loading="lazy" decoding="async" alt="">`:''}<strong>${esc(OSMINOGWorkspaceLanguage.captureCaption(o,"name")||o.fileName||o.type)}</strong><small>${esc(p.name)}${folder?' / '+esc(folder.name):''} · ${when(o)?new Date(when(o)).toLocaleString(state.language):L("Дата неизвестна")}</small><p>${highlight(excerpt,q)}</p>${o.searchIndex?.error?`<small class="lib-error">${esc(o.searchIndex.error)}</small>`:''}<button type="button" data-result-open="${esc(key)}">${L('Открыть')}</button>`;const img=card.querySelector("img");if(img)img.src=o.src;out.append(card)}if(list.length>=200){const note=document.createElement('p');note.textContent='Показаны первые 200 результатов. Уточните запрос или даты.';out.append(note)}if(!list.length)out.textContent=L("Ничего не найдено");updateBulkControls()}
// This module is a separate closure from Workdesk: image decoding must be local.
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image(),timer=setTimeout(()=>finish(Error('Истекло время чтения изображения')),10000);function finish(error){clearTimeout(timer);img.onload=img.onerror=null;error?reject(error):resolve(img)}img.crossOrigin='anonymous';img.onload=()=>finish(img.naturalWidth&&img.naturalHeight?null:Error('Получено пустое изображение'));img.onerror=()=>finish(Error('Не удалось прочитать изображение'));img.src=src})}
function capturePosition(p,w,h){const view=p.id===project()?.id?state.view:p.view||{x:0,y:0,scale:1},r=$('#viewport').getBoundingClientRect(),scale=Number(view.scale)||1,center=p.id===project()?.id?viewportCenter():{x:(r.width/2-(Number(view.x)||0))/scale,y:(r.height/2-(Number(view.y)||0))/scale},offset=p.objects.filter(o=>o.captureId&&!o.osminogFolderId).length%8*24;return{x:center.x-w/2+offset,y:center.y-h/2+offset}}
async function* pendingCaptureEntries(){
 const storage=chrome.storage.local;
 const legacy=typeof storage.getKeys==='function'?(await storage.getKeys()).filter(key=>key.startsWith(PREFIX)):Object.keys(await OSMINOGIOBudget.selectedStorage(storage,key=>key.startsWith(PREFIX)));
 const queue=globalThis.OSMINOGCaptureStore;
 queuePending=legacy.length+(queue?await queue.count():0);
 for(const key of legacy)yield{key,legacy:true};
 if(!queue)return;
 let after=null;
 while(true){
  const page=await queue.list({limit:32,after});if(!page.length)return;
  for(const meta of page)yield{key:meta.id,meta,legacy:false};
  const last=page[page.length-1];after={at:last.at,id:last.id};
 }
}
async function acknowledgeCapture(entry){
 if(entry.legacy)await chrome.storage.local.remove(entry.key);else await OSMINOGCaptureStore.ack(entry.key);
 queuePending=Math.max(0,queuePending-1);
}
async function importPendingCaptures(){importErrors=[];let changed=false;const destinations=new Set();
for await(const entry of pendingCaptureEntries()){try{
const item=entry.legacy?(await chrome.storage.local.get(entry.key))[entry.key]:await OSMINOGCaptureStore.read(entry.key);
if(!item){await acknowledgeCapture(entry);continue}
if(entry.legacy&&await globalThis.OSMINOGRestore438?.skipLegacyCapture(item)){await acknowledgeCapture(entry);changed=true;continue}
if(typeof item.id!=='string'||!item.id||!['image','text','file'].includes(item.kind)||typeof item.value!=='string'||!item.value)throw Error('Повреждён материал в очереди');
const p=state.projects.find(p=>p.id===item.projectId),f=item.folderId?p?.osminogFolders?.find(f=>f.id===item.folderId):null;if(!p)throw Error('Стол для сохранения не найден');if(item.folderId&&!f)throw Error('Папка для сохранения не найдена');
if(!p.objects.some(o=>o.captureId===item.id)){const props=item.kind==='image'?{src:item.value,name:item.fileName||t('screen'),w:480,h:320,fillEnabled:false,strokeEnabled:false}:item.kind==='file'?{src:item.value,name:item.fileName||'Файл',fileName:item.fileName||'Файл',mime:item.mime||'application/octet-stream',size:item.size||0}:{title:t('text'),text:item.value,name:item.value.slice(0,60),textColor:null};
if(item.kind==='image'){
 let size=null;
 if(item.value.startsWith('data:image/png;base64,')){
  const header=atob(item.value.slice(22,54));
  if(header.slice(0,8)!=='\x89PNG\r\n\x1a\n'||header.slice(12,16)!=='IHDR')throw Error('Повреждён заголовок PNG');
  if(header.slice(12,16)==='IHDR'){
   const n=i=>header.charCodeAt(i)*16777216+header.charCodeAt(i+1)*65536+header.charCodeAt(i+2)*256+header.charCodeAt(i+3);
   if(n(16)>0&&n(20)>0)size={w:n(16),h:n(20)};
  }
 }
 if(!size&&!f){const img=await loadImage(item.value);size={w:img.naturalWidth,h:img.naturalHeight}}
 if(size){const scale=Math.min(1,560/size.w,420/size.h);props.w=size.w*scale;props.h=size.h*scale}
 else props.needsCaptureSize=true;
}
const defaults=objectDefaults(item.kind==='image'?'image':item.kind==='file'?'file':'brief'),o={...defaults,...props,id:'capture-'+item.id,osminogDesktopId:p.activeDesktop||'main',...(f?{osminogFolderId:f.id}:{}),captureId:item.id,captureHash:item.hash,capturedAt:item.at,createdAt:item.at,updated:item.at,radius:0,...(f?{x:0,y:0}:capturePosition(p,props.w||defaults.w,props.h||defaults.h))};
p.objects.push(o);if(f){f.members=f.members||[];if(!f.members.includes(o.id))f.members.push(o.id)}p.updated=Date.now();changed=true}
// Even a previously created in-memory object may not have reached storage.
// Keep the queue entry until persist succeeds; retrying reuses captureId.
const object=p.objects.find(o=>o.captureId===item.id);
await OSMINOGItemEdits.save(p,{kind:'capture',object});await acknowledgeCapture(entry);changed=true;if(p===project())destinations.add(f?.id||'');
// Reconcile the viewport once after the import batch. Direct appends here
// would mount every distant capture and bypass the canvas DOM budget.

}catch(e){importErrors.push('Не удалось сохранить материал: '+String(e?.message||e))}}
renderCaptureStatus();if(changed){if(destinations.size){renderObjects();renderLayers();if(objects().length)document.getElementById('emptyHint').hidden=true;OSMINOGWindowsFolders.captureAdded(destinations)}results()}return{pending:queuePending,errors:[...importErrors]}}
async function drain(){if(!globalThis.OSMINOGWindowsFolders||!project())return;if(draining){drainAgain=true;return draining}draining=navigator.locks.request('osminog-capture-import',{ifAvailable:true},async lock=>{if(!lock)return;let result;do{drainAgain=false;result=await importPendingCaptures()}while(drainAgain);return result}).catch(e=>{importErrors=['Не удалось прочитать очередь: '+String(e?.message||e)];renderCaptureStatus();return{pending:queuePending,errors:[...importErrors]}}).finally(()=>draining=null);return draining}
let ocrScript;
async function ocr(src){
 if(!globalThis.Tesseract){
  if(!ocrScript)ocrScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=chrome.runtime.getURL('vendor/ocr/tesseract.min.js');script.onload=resolve;script.onerror=()=>{ocrScript=null;script.remove();reject(Error('OCR'))};document.head.append(script)});
  await ocrScript;
 }
if(/^data:image\/svg\+xml/.test(src)){const img=await loadImage(src),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);src=c.toDataURL('image/png')}if(!worker)worker=Tesseract.createWorker('rus+eng',1,{workerPath:chrome.runtime.getURL('vendor/ocr/worker.min.js'),corePath:chrome.runtime.getURL('vendor/ocr/tesseract-core-lstm.wasm.js'),langPath:chrome.runtime.getURL('vendor/ocr/lang'),gzip:false,workerBlobURL:false,errorHandler:()=>{}});return(await(await worker).recognize(src)).data.text}
async function extract(o){if(o.type==='image')return ocr(o.src);if(o.mime==='application/pdf'||/\.pdf$/i.test(o.fileName||o.name||'')){if(!pdfEngine)pdfEngine=import(chrome.runtime.getURL('vendor/pdf/pdf.mjs')).then(m=>{m.GlobalWorkerOptions.workerSrc=chrome.runtime.getURL('vendor/pdf/pdf.worker.mjs');return m});const engine=await pdfEngine,doc=await engine.getDocument({data:new Uint8Array(await(await fetch(o.src)).arrayBuffer()),isEvalSupported:false}).promise;try{let parts=[];for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),text=(await page.getTextContent()).items.map(x=>x.str||'').join(' ');if(text.trim())parts.push(text);else{const viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;parts.push(await ocr(canvas.toDataURL('image/png')));canvas.width=canvas.height=0}page.cleanup()}return parts.join('\n')}finally{doc.destroy()}}if(/^text\//.test(o.mime||'')||/\.(txt|md|csv|json|html|xml|log)$/i.test(o.fileName||o.name||''))return(await fetch(o.src)).text();return null}
async function indexAll(){if(indexing)return;indexing=true;try{const todo=[];let yielded=performance.now();for(const item of all()){const o=item.o;if(['image','file'].includes(o.type)&&o.src&&o.searchIndex?.signature!==signature(o))todo.push(item);if(performance.now()-yielded>8){await new Promise(resolve=>setTimeout(resolve,0));yielded=performance.now()}}pending=todo.length;for(const {o} of todo){const sig=signature(o);try{const text=await extract(o);if(signature(o)===sig)o.searchIndex={signature:sig,text:text||'',at:Date.now(),...(text===null?{error:'Поиск по названию. Содержимое этого формата пока не индексируется.'}:{})}}catch(e){o.searchIndex={signature:sig,text:'',error:'Не удалось распознать: '+String(e?.message||e),at:Date.now()}}pending--;results()}if(todo.length)await persist()}finally{const current=worker;worker=null;try{if(current)await(await current).terminate()}finally{indexing=false;results()}}}
function useClipboardEvents(){
 const clipboard=navigator.clipboard;
 if(!clipboard||!('onclipboardchange' in clipboard)||!navigator.permissions)return;
 let timer=0,permitted=false;
 const send=action=>chrome.runtime.sendMessage({type:'OSMINOG_CLIPBOARD_ACTIVITY',action}).catch(()=>{});
 const ready=()=>permitted&&cfg.enabled&&document.hasFocus()&&!document.hidden;
 const update=()=>{
  if(ready()&&!timer){send('lease');timer=setInterval(()=>{if(ready())send('lease');else update()},2500)}
  else if(!ready()&&timer){clearInterval(timer);timer=0;send('release')}
 };
 clipboard.addEventListener('clipboardchange',()=>{if(ready())send('change')});
 window.addEventListener('focus',update);window.addEventListener('blur',update);document.addEventListener('visibilitychange',update);
 document.addEventListener('osminog:capture-config',update);
 navigator.permissions.query({name:'clipboard-read'}).then(permission=>{const refresh=()=>{permitted=permission.state==='granted';update()};permission.onchange=refresh;refresh()}).catch(()=>{});
}
async function ensureInbox() {
  await globalThis.OSMINOGStateReady;
  return navigator.locks.request('osminog-default-inbox',async()=>{
    const p=project();
    if(!p||document.getElementById('app').hidden||!globalThis.OSMINOGWindowsFolders)return;
    const prefs=(await chrome.storage.local.get(KEY))[KEY]||{};
    if(prefs.projectId && prefs.followDesk!==true)return;
    let folder=(p.osminogFolders||[]).find(f=>f.id===p.defaultInboxId);
    if(!folder && !p.defaultInboxId){
      folder=(p.osminogFolders||[]).find(f=>!f.parentId&&[t('inbox'),'Входящие','Inbox'].includes(f.name)) || OSMINOGWindowsFolders.create({name:t('inbox'),rename:false});
      folder.sort='modified';p.defaultInboxId=folder.id;
      await persist();
    }
    if(!folder || project()!==p)return;
    if(prefs.projectId!==p.id||prefs.folderId!==folder.id){
      await saveConfig({followDesk:true,projectId:p.id,folderId:folder.id,enabled:prefs.enabled!==false,lastHash:''});
    }
    OSMINOGWindowsFolders.render();
  });
}
async function enterDesk(){
  await ensureInbox();const query=new URLSearchParams(location.search);
  if(query.get('view')!=='inbox')return;
  const prefs=(await chrome.storage.local.get(KEY))[KEY]||{};
  if(globalThis.OSMINOGWindowsFolders&&prefs.projectId===project()?.id&&prefs.folderId)OSMINOGWindowsFolders.openVirtual(prefs.folderId);
  if(globalThis.OSMINOGWindowsFolders)history.replaceState(null,'',location.pathname);
}
async function install(){await globalThis.OSMINOGStateReady;
document.addEventListener('osminog:folders-ready',()=>enterDesk().catch(e=>showToast(e.message)));
document.addEventListener('osminog:project-opened',()=>ensureInbox().catch(e=>showToast(e.message)));
await enterDesk();useClipboardEvents();await chrome.storage.local.remove(['briefCraftLastCachedImage','briefCraftLastCachedImageAt']);const actions=$('.top-actions');if(!actions)return;for(const [id,label,name,which] of [['librarySearch',t('search'),'search','search'],['libraryCapture',t('capture'),'clipboard','capture']]){const b=document.createElement('button');b.id=id;b.className='icon-btn';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(name);b.onclick=()=>panel&&mode===which?close():open(which);actions.prepend(b)}await refreshConfig();const account=chrome.identity?await globalThis.OSMINOGAccountAPI?.status?.():null;if(!account?.configured){$('#profileButton')?.setAttribute('hidden','');$('#welcomeProfile')?.setAttribute('hidden','')}
const originalCreate=globalThis.createObject;globalThis.createObject=function(type,props={}){return originalCreate(type,{createdAt:Date.now(),...props})};
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes[KEY])refreshConfig();if(Object.entries(changes).some(([k,c])=>k.startsWith(PREFIX)&&c.newValue))drain().catch(console.error)});
globalThis.OSMINOGCaptureStore?.subscribe(change=>{if(change.type==='added')drain().catch(console.error)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});setInterval(()=>{if(queuePending||importErrors.length)drain().catch(console.error)},10000);document.addEventListener('osminog:project-opened',()=>drain().catch(console.error));drain().catch(console.error);
}
async function rememberPaste(kind,value){await chrome.runtime.sendMessage({type:'OSMINOG_COLLECTOR_IGNORE',kind,value}).catch(()=>{})}
async function reuseCapture(kind,value){const pid=project()?.id;await drain();if(project()?.id!==pid)throw Error('Доска изменилась — повторите вставку');const o=objects().find(o=>o.captureId&&Date.now()-o.capturedAt<60000&&(kind==='image'?o.src===value:o.text===value));if(!o)return false;
checkpoint();for(const f of project().osminogFolders||[])f.members=(f.members||[]).filter(id=>id!==o.id);delete o.osminogFolderId;o.osminogDesktopId=project().activeDesktop||'main';const center=viewportCenter();o.x=center.x-o.w/2;o.y=center.y-o.h/2;renderAll(true);(OSMINOGWindowsFolders.refresh||OSMINOGWindowsFolders.render)();selectObject(o.id,false);focusObject(o);await persist();await rememberPaste(kind,value);return true}
document.addEventListener("osminog:language-changed",()=>{if(panel)open(mode);renderCaptureStatus()});globalThis.OSMINOGLibrary={open,close,drain,index:indexAll,matches,when,extract,reuseCapture,rememberPaste,destination:()=>({...cfg})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
