/* OSMINOG 4.0.38: small editor; durable media and collection live outside this view. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), store = globalThis.OSMINOGCoreStore;
  const MAX_NODES = 160, MAX_IMAGES = 48, PAGE_SIZE = 50, CELL = 1024;
  const state = {desk:null,desks:[],items:new Map(),view:{x:80,y:100,scale:1},selected:new Set(),folder:'',desktop:'main',revision:0};
  const nodes = new Map(), previews = new Map(), imageErrors = new Set(), pendingImages = new Set(), deskListeners = new Set();
  const metrics = {renderCount:0,persistCount:0};
  let viewDirty=false, chatReady=false;
  let canvasSize = {width:1,height:1}, frame=0, viewTimer, searchTimer, toastTimer, changeTimer, gesture, space=false;
  let subscribed=false;
  let openSerial=0, searchSerial=0, searchPage=0, collectorConfig={}, collectorBusy=false, searchRows=[], migrationTimer;
  let searchWorker=null, searchRequest=0;const searchWaiters=new Map();
  let modalItem=null, modalURL=null, previewWorker=null, imageDebounce, isReady=false, starting=false, updateBusy=false, updatePreflight=null;
  let changes = new Set(), fullRefresh=false, lastImageList='', currentImageIds=new Set(), pendingWrites=new Set();
  const number = (value,fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const pause = () => new Promise(resolve=>setTimeout(resolve,0));
  const message = data => chrome.runtime.sendMessage(data);
  const iconFor = item => /image/.test(item.type)||String(item.mime).startsWith('image/') ? '▧' : item.assetId ? '▤' : '≡';
  const isImage = item => !!item.assetId && (/image/.test(item.type)||String(item.mime).startsWith('image/'));
  const rect = item => ({x:number(item.x),y:number(item.y),w:clamp(number(item.w,320),40,50000),h:clamp(number(item.h,220),40,50000)});
  function toast(text){$('toast').textContent=String(text);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500)}
  function fail(error){console.error('OSMINOG core:',error);$('saveStatus').textContent='Не сохранено';toast(error?.message||String(error))}
  function track(promise){pendingWrites.add(promise);promise.finally(()=>pendingWrites.delete(promise)).catch(()=>{});return promise}
  async function flushWrites(){clearTimeout(viewTimer);await saveView();await Promise.all([...pendingWrites]);}
  function saved(){metrics.persistCount++;$('saveStatus').textContent='Сохранено на устройстве'}
  class SpatialIndex{
    constructor(){this.cells=new Map();this.keys=new Map();this.large=new Set()}
    clear(){this.cells.clear();this.keys.clear();this.large.clear()}
    remove(id){for(const key of this.keys.get(id)||[]){const cell=this.cells.get(key);cell?.delete(id);if(!cell?.size)this.cells.delete(key)}this.keys.delete(id);this.large.delete(id)}
    put(item){this.remove(item.id);const r=rect(item),x1=Math.floor(r.x/CELL),x2=Math.floor((r.x+r.w)/CELL),y1=Math.floor(r.y/CELL),y2=Math.floor((r.y+r.h)/CELL),keys=[];if((x2-x1+1)*(y2-y1+1)>64){this.large.add(item.id);return}for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++){const k=x+':'+y;if(!this.cells.has(k))this.cells.set(k,new Set());this.cells.get(k).add(item.id);keys.push(k)}this.keys.set(item.id,keys)}
    query(r){const ids=new Set(this.large),x1=Math.floor(r.x/CELL),x2=Math.floor((r.x+r.w)/CELL),y1=Math.floor(r.y/CELL),y2=Math.floor((r.y+r.h)/CELL);if((x2-x1+1)*(y2-y1+1)>512){for(const id of this.keys.keys())ids.add(id)}else for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(const id of this.cells.get(x+':'+y)||[])ids.add(id);return [...ids].map(id=>state.items.get(id)).filter(item=>item&&inScope(item)&&intersects(rect(item),r))}
  }
  const index=new SpatialIndex();
  function inScope(item){return !item.deletedAt && (state.folder==='*'||(item.folderId||'')===state.folder) && (!state.desktop||!item.desktopId||item.desktopId===state.desktop)}
  function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function viewport(extra=0){const v=state.view;return{x:(-v.x-extra)/v.scale,y:(-v.y-extra)/v.scale,w:(canvasSize.width+extra*2)/v.scale,h:(canvasSize.height+extra*2)/v.scale}}
  function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(render)}
  function render(){
    frame=0;metrics.renderCount++;const v=state.view,area=viewport(100),cx=area.x+area.w/2,cy=area.y+area.h/2;
    $('canvasWorld').style.transform=`translate(${v.x}px,${v.y}px) scale(${v.scale})`;
    const grid=clamp(24*v.scale,8,96);$('canvas').style.backgroundSize=`${grid}px ${grid}px`;$('canvas').style.backgroundPosition=`${v.x}px ${v.y}px`;
    $('zoomValue').textContent=Math.round(v.scale*100)+'%';
    let visible=index.query(area);visible.sort((a,b)=>Number(state.selected.has(b.id))-Number(state.selected.has(a.id))||((a.x+a.w/2-cx)**2+(a.y+a.h/2-cy)**2)-((b.x+b.w/2-cx)**2+(b.y+b.h/2-cy)**2));
    visible=visible.slice(0,MAX_NODES);const keep=new Set(visible.map(item=>item.id));
    for(const [id,node]of nodes)if(!keep.has(id)){node.remove();nodes.delete(id)}
    const images=[];
    for(const item of visible){let node=nodes.get(item.id);if(!node){node=document.createElement('article');node.className='canvas-item';node.dataset.id=item.id;node.tabIndex=0;node.setAttribute('role','button');nodes.set(item.id,node);$('canvasItems').append(node)}updateNode(node,item);if(isImage(item)&&images.length<MAX_IMAGES)images.push(item.assetId)}
    renderConnections(keep);
    const list=[...new Set(images)];currentImageIds=new Set(list);trimPreviews();
    if(list.join('|')!==lastImageList){lastImageList=list.join('|');clearTimeout(imageDebounce);imageDebounce=setTimeout(()=>requestPreviews(list),gesture?150:45)}
    applyImageURLs();
  }
  function updateNode(node,item){
    const r=rect(item);node.style.transform=`translate(${r.x}px,${r.y}px)`;node.style.width=r.w+'px';node.style.height=r.h+'px';node.classList.toggle('selected',state.selected.has(item.id));node.dataset.type=item.type;node.setAttribute('aria-label',item.name||'Материал');
    const signature=[item.rev,item.updatedAt,item.name,item.assetId,item.text?.slice(0,120),item.type].join('|');
    if(node.dataset.content===signature)return;node.dataset.content=signature;node.replaceChildren();
    if(isImage(item)){const img=document.createElement('img');img.className='item-image';img.alt='';img.decoding='async';img.draggable=false;node.append(img)}
    else if(item.text){const content=document.createElement('div');content.className='item-text';content.textContent=item.text.slice(0,1200);node.append(content)}
    else{const content=document.createElement('div');content.className='item-file';const glyph=document.createElement('span');glyph.className='file-glyph';glyph.textContent=iconFor(item);const name=document.createElement('span');name.textContent=item.fileName?.split('.').pop()?.toUpperCase()|| (item.assetId?'Сохранённый файл':'Сохранённый материал');content.append(glyph,name);node.append(content)}
    const label=document.createElement('div');label.className='item-label';label.textContent=item.name||item.title||'Материал';node.append(label);
  }
  function renderConnections(visible){
    const connections=state.desk?.connections||[],paths=[];
    for(const c of connections){const source=c.from?.id||c.source?.id||c.fromId||c.sourceId||c.from||c.source,target=c.to?.id||c.target?.id||c.toId||c.targetId||c.to||c.target;if(!visible.has(source)||!visible.has(target))continue;const a=state.items.get(source),b=state.items.get(target);if(!a||!b)continue;const x1=a.x+a.w,y1=a.y+a.h/2,x2=b.x,y2=b.y+b.h/2,dx=Math.max(40,Math.abs(x2-x1)/2);paths.push(`M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`);if(paths.length>=240)break}
    const svg=$('canvasConnections'),signature=paths.join('|');if(svg.dataset.paths===signature)return;svg.dataset.paths=signature;svg.replaceChildren(...paths.map(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);return p}));
  }
  function createPreviewWorker(){
    previewWorker=new Worker(chrome.runtime.getURL('osminog-core-media-worker.js'));
    previewWorker.onmessage=({data})=>{pendingImages.delete(data.id);if(data.error){imageErrors.add(data.id);if(modalItem?.assetId===data.id)$('itemPreview').textContent='Оригинал сохранён и доступен для скачивания.';return}if(!(data.blob instanceof Blob))return;if(modalItem?.assetId===data.id&&$('itemDialog').open)showModalPreview(data.blob);if(!currentImageIds.has(data.id))return;const old=previews.get(data.id);if(old)URL.revokeObjectURL(old.url);previews.set(data.id,{url:URL.createObjectURL(data.blob),at:Date.now()});trimPreviews();applyImageURLs()};
    previewWorker.onerror=error=>{console.warn('OSMINOG preview worker:',error.message);pendingImages.clear()};
  }
  function trimPreviews(){for(const[id,value]of previews)if(!currentImageIds.has(id)){URL.revokeObjectURL(value.url);previews.delete(id)}}
  function requestPreviews(ids){trimPreviews();if(!previewWorker)createPreviewWorker();const needed=ids.filter(id=>!previews.has(id)&&!imageErrors.has(id));if(modalItem&&$('itemDialog').open&&isImage(modalItem)&&!modalURL)needed.unshift(modalItem.assetId);const unique=[...new Set(needed)].slice(0,MAX_IMAGES);SetCompat(pendingImages,unique);previewWorker.postMessage({type:'wanted',ids:unique});}
  // Keep the shared Set identity used by the diagnostic counters.
  function SetCompat(target,values){target.clear();for(const value of values)target.add(value);return target}
  function applyImageURLs(){for(const[id,node]of nodes){const img=node.querySelector('img');if(!img)continue;const item=state.items.get(id),url=currentImageIds.has(item.assetId)?previews.get(item.assetId)?.url:null;if(url){if(img.getAttribute('src')!==url)img.src=url}else img.removeAttribute('src')}}
  function disposePreviews(){clearTimeout(imageDebounce);previewWorker?.postMessage({type:'wanted',ids:[]});currentImageIds.clear();pendingImages.clear();trimPreviews();lastImageList=''}
  function setView(next,{save=true}={}){state.view={x:number(next.x,state.view.x),y:number(next.y,state.view.y),scale:clamp(number(next.scale,state.view.scale),.08,4)};schedule();if(save)queueViewSave()}
  function zoom(factor,point={x:canvasSize.width/2,y:canvasSize.height/2}){const old=state.view,scale=clamp(old.scale*factor,.08,4);setView({scale,x:point.x-(point.x-old.x)*scale/old.scale,y:point.y-(point.y-old.y)*scale/old.scale})}
  function queueViewSave(){viewDirty=true;clearTimeout(viewTimer);viewTimer=setTimeout(()=>track(saveView()).catch(fail),300)}
  async function saveView(){if(!state.desk||!viewDirty)return;const id=state.desk.id,view={...state.view};viewDirty=false;try{await store.saveDesk({id,view});saved()}catch(error){viewDirty=true;throw error}}
  function scopeItems(){return[...state.items.values()].filter(inScope)}
  function updateCount(){const count=scopeItems().length;$('itemCount').textContent=count.toLocaleString('ru-RU')+' материалов';$('canvasEmpty').hidden=!!count;$('saveStatus').textContent='Сохранено на устройстве'}
  async function openDesk(id){
    const serial=++openSerial;clearTimeout(viewTimer);if(state.desk)await track(saveView());
    const desk=await store.getDesk(id);if(!desk||desk.deletedAt)throw Error('Стол не найден');
    const items=[];let offset=0;
    while(true){const page=await store.listItems(id,{offset,limit:500,includeDeleted:true});if(serial!==openSerial)return;items.push(...page.filter(item=>!item.deletedAt));if(page.length<500)break;offset+=page.length;await pause()}
    if(serial!==openSerial)return;disposePreviews();nodes.forEach(node=>node.remove());nodes.clear();index.clear();state.items=new Map(items.map(item=>[item.id,item]));for(const item of items)index.put(item);
    state.desk=desk;state.revision=number(desk.updatedAt);state.selected.clear();state.folder='';state.desktop=desk.activeDesktop||desk.desktops?.[0]?.id||items[0]?.desktopId||'main';
    const view=desk.view||{};state.view={x:number(view.x,80),y:number(view.y,100),scale:clamp(number(view.scale,number(view.zoom,number(view.z,1))),.08,4)};
    $('deskTitle').textContent=desk.name;document.title=desk.name+' — OSMINOG';renderScopes();updateCount();renderDeskList();schedule();
    await chrome.storage.local.set({osminogCoreUiV1:{activeDesk:id}});
    if(collectorConfig.followDesk!==false)await configureCollector({projectId:id,folderId:desk.folders?.some(folder=>folder.id===collectorConfig.folderId)?collectorConfig.folderId:null});
    for(const listener of deskListeners)listener(desk);if(chatReady)await globalThis.OSMINOGCoreChat?.refreshDesk?.();if(!$('searchPanel').hidden)runSearch();
  }
  function renderScopes(){
    const select=$('folderSelect');select.replaceChildren();const add=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)};
    add('','На холсте');add('*','Все материалы');const folders=new Map((state.desk?.folders||[]).map(folder=>[String(folder.id),folder]));for(const item of state.items.values())if(item.folderId&&!folders.has(item.folderId))folders.set(item.folderId,{id:item.folderId,name:'Сохранённая папка'});
    const counts=new Map();for(const item of state.items.values())if(item.folderId)counts.set(item.folderId,(counts.get(item.folderId)||0)+1);
    for(const folder of folders.values())add(folder.id,`${folder.name||folder.title||'Папка'} · ${counts.get(folder.id)||0}`);select.value=state.folder;
    const desktops=state.desk?.desktops||[];const options=desktops.length?desktops:[...new Set([...state.items.values()].map(item=>item.desktopId||'main'))].map(id=>({id,name:id==='main'?'Основной стол':id}));
    $('desktopSelect').replaceChildren(...options.map(desk=>{const option=document.createElement('option');option.value=desk.id;option.textContent=desk.name||desk.title||'Рабочий стол';return option}));$('desktopSelect').value=state.desktop;$('desktopSelect').hidden=options.length<2;
  }
  async function refreshDesks(){state.desks=await store.desks();if(state.desk){const latest=state.desks.find(d=>d.id===state.desk.id);if(latest)state.desk={...state.desk,...latest}}renderDeskList()}
  function renderDeskList(){
    const fragment=document.createDocumentFragment();for(const desk of state.desks){const button=document.createElement('button');button.className='desk-row'+(desk.id===state.desk?.id?' active':'');button.dataset.deskId=desk.id;const icon=document.createElement('span');icon.className='desk-icon';icon.textContent='▦';const name=document.createElement('span');name.textContent=desk.name;button.append(icon,name);button.onclick=()=>openDesk(desk.id).then(()=>togglePanel('desks',false)).catch(fail);fragment.append(button)}$('deskList').replaceChildren(fragment);
  }
  async function createItem(data){const item=await track(store.putItem({deskId:state.desk.id,desktopId:state.desktop,folderId:state.folder==='*'?null:state.folder||null,...data}));if(item.deskId===state.desk?.id){state.items.set(item.id,item);index.put(item);state.revision++;renderScopes();updateCount();schedule()}saved();return item}
  async function patchItem(id,patch){const result=await track(store.patchItem(id,patch));if(result.deskId===state.desk?.id){state.items.set(id,result);index.put(result);state.revision++;updateCount();schedule()}saved();return result}
  async function deleteItem(id){const result=await track(store.deleteItem(id));state.items.delete(id);index.remove(id);state.selected.delete(id);state.revision++;updateCount();schedule();saved();return result}
  async function applyChanges(){
    const ids=[...changes];changes.clear();if(fullRefresh){fullRefresh=false;await refreshDesks()}
    for(const id of ids){const item=await(store.getMetadata?store.getMetadata(id):store.getItem(id));if(!item)continue;if(item.deskId!==state.desk?.id||item.deletedAt){if(state.items.has(id)){state.items.delete(id);index.remove(id)}}else{state.items.set(id,item);index.put(item)}}
    if(ids.length){state.revision++;renderScopes();updateCount();schedule();if(!$('searchPanel').hidden){clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(),180)}}
  }
  function togglePanel(name,force){
    if(name==='chat'){const open=typeof force==='boolean'?force:document.body.dataset.chat!=='open';document.body.dataset.chat=open?'open':'closed';$('chatToggle').setAttribute('aria-expanded',String(open));if(open&&isReady)globalThis.OSMINOGCoreChat?.refreshDesk?.();}
    else{const panel=$(name==='desks'?'deskPanel':'searchPanel'),open=typeof force==='boolean'?force:panel.hidden;panel.hidden=!open;$(name==='desks'?'deskToggle':'searchToggle').setAttribute('aria-expanded',String(open));if(name==='search'&&open){runSearch();$('searchInput').focus()}}
    schedule();
  }
  function searchInWorker(query,options){
    if(!searchWorker){searchWorker=new Worker(chrome.runtime.getURL('osminog-core-search-worker.js'));searchWorker.onmessage=({data})=>{const waiter=searchWaiters.get(data.id);if(!waiter)return;searchWaiters.delete(data.id);if(data.cancelled)waiter.reject(new DOMException('Search superseded','AbortError'));else if(data.error)waiter.reject(Error(data.error));else waiter.resolve(data.items)};searchWorker.onerror=error=>{for(const waiter of searchWaiters.values())waiter.reject(Error(error.message));searchWaiters.clear()}}
    const id=++searchRequest;return new Promise((resolve,reject)=>{searchWaiters.set(id,{resolve,reject});searchWorker.postMessage({type:'search',id,query,options})});
  }
  async function runSearch(){
    const serial=++searchSerial,query=$('searchInput').value.trim();$('searchSummary').textContent='Ищу…';
    try{const results=await searchInWorker(query,{...($('searchScope').value==='desk'?{deskId:state.desk?.id}:{}),offset:searchPage*PAGE_SIZE,limit:PAGE_SIZE+1});if(serial!==searchSerial)return;searchRows=results.slice(0,PAGE_SIZE);const fragment=document.createDocumentFragment();for(const item of searchRows){const button=document.createElement('button');button.className='search-result';button.dataset.id=item.id;const icon=document.createElement('span');icon.className='result-icon';icon.textContent=iconFor(item);const text=document.createElement('div');text.className='result-text';const name=document.createElement('strong');name.textContent=item.name||'Материал';const preview=document.createElement('p');preview.textContent=(item.searchText||item.text||item.fileName||item.mime||'').slice(0,180);const meta=document.createElement('small');meta.textContent=(state.desks.find(d=>d.id===item.deskId)?.name||'Стол')+' · '+new Date(item.createdAt||item.updatedAt).toLocaleDateString('ru-RU');text.append(name,preview,meta);button.append(icon,text);button.onclick=()=>showItem(item.id).catch(fail);button.ondblclick=()=>focusItem(item.id).catch(fail);fragment.append(button)}$('searchResults').replaceChildren(fragment);$('searchSummary').textContent=searchRows.length?`Показано ${searchPage*PAGE_SIZE+1}–${searchPage*PAGE_SIZE+searchRows.length}`:'Материалы не найдены';$('searchPrev').disabled=!searchPage;$('searchNext').disabled=results.length<=PAGE_SIZE;$('searchPage').textContent=String(searchPage+1)}catch(error){if(serial===searchSerial)$('searchSummary').textContent=error.message}
  }
  async function focusItem(id){let item=await(store.getMetadata?store.getMetadata(id):store.getItem(id));if(!item||item.deletedAt)throw Error('Материал не найден');if(item.deskId!==state.desk?.id)await openDesk(item.deskId);state.folder=item.folderId||'';state.desktop=item.desktopId||'main';renderScopes();state.selected=new Set([id]);const r=rect(item),scale=clamp(Math.min(1,canvasSize.width/(r.w+160),canvasSize.height/(r.h+160)),.08,4);setView({scale,x:canvasSize.width/2-(r.x+r.w/2)*scale,y:canvasSize.height/2-(r.y+r.h/2)*scale});updateCount();$('itemDialog').close();togglePanel('search',false)}
  async function showItem(id){
    const item=await store.getItem(id);if(!item)throw Error('Материал не найден');modalItem=item;releaseModalURL();$('itemTitle').textContent=item.name||'Материал';$('itemPreview').replaceChildren();$('itemMessage').textContent='';$('copyItem').disabled=!(item.text||isImage(item));$('downloadItem').disabled=!(item.assetId||item.text||item.detailBlobId);$('placeItem').textContent=item.folderId?'Перенести на холст':'Показать на холсте';
    if(isImage(item)){const blob=await store.getBlob('preview:'+item.assetId);if(blob)showModalPreview(blob);else $('itemPreview').textContent='Подготовка предпросмотра…'}
    else if(item.text){const pre=document.createElement('pre');pre.textContent=item.text;$('itemPreview').append(pre)}
    else{const p=document.createElement('p');p.className='legacy-note';p.textContent=item.assetId?`Файл ${item.fileName||item.name}. Оригинал сохранён.`:'Материал прежнего редактора сохранён. Его исходные данные доступны для скачивания.';$('itemPreview').append(p)}
    if(!$('itemDialog').open)$('itemDialog').showModal();if(isImage(item)&&!modalURL)requestPreviews([...currentImageIds]);
  }
  function showModalPreview(blob){releaseModalURL();modalURL=URL.createObjectURL(blob);const img=document.createElement('img');img.src=modalURL;img.alt=modalItem?.name||'';$('itemPreview').replaceChildren(img)}
  function releaseModalURL(){if(modalURL)URL.revokeObjectURL(modalURL);modalURL=null}
  async function copyModal(){try{if(modalItem.text)await navigator.clipboard.writeText(modalItem.text);else{const blob=await store.getBlob(modalItem.assetId);if(blob.type!=='image/png')throw Error('Этот формат можно скачать. В буфер копируются изображения PNG.');await navigator.clipboard.write([new ClipboardItem({'image/png':blob})])}$('itemMessage').textContent='Скопировано'}catch(error){$('itemMessage').textContent=error.message}}
  async function downloadModal(){try{let blob=modalItem.assetId?await store.getBlob(modalItem.assetId):null;let name=modalItem.fileName||modalItem.name||'Материал';if(!blob&&modalItem.text){blob=new Blob([modalItem.text],{type:'text/plain;charset=utf-8'});if(!/\.[a-z0-9]{1,5}$/i.test(name))name+='.txt'}if(!blob&&modalItem.detailBlobId){blob=await store.getBlob(modalItem.detailBlobId);name+='.json'}if(!blob)throw Error('Оригинал не найден');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}catch(error){$('itemMessage').textContent=error.message}}
  async function configureCollector(patch){const result=await message({type:'OSMINOG_COLLECTOR_CONFIGURE',patch});if(result?.ok===false)throw Error(result.error||'Не удалось изменить сбор');collectorConfig=result.config||{...collectorConfig,...patch};renderCollector();return result}
  function renderCollector(){const active=!!collectorConfig.enabled;$('captureToggle').setAttribute('aria-pressed',String(active));$('captureToggle').title=active?'Сбор включён. Нажмите, чтобы приостановить.':'Сбор выключен. Нажмите, чтобы включить.';$('captureStatus').textContent=collectorConfig.error|| (active?'Автосбор включён':'Автосбор приостановлен');document.querySelector('.capture-summary').dataset.active=String(active)}
  async function collectorStatus(){const result=await message({type:'OSMINOG_CORE_STATUS'});if(result?.config){collectorConfig=result.config;renderCollector()}return result}
  function bindUI(){
    $('deskToggle').onclick=()=>togglePanel('desks');$('searchToggle').onclick=()=>togglePanel('search');$('chatToggle').onclick=()=>togglePanel('chat');$('emptyOpenSearch').onclick=()=>togglePanel('search',true);
    document.querySelectorAll('[data-close-panel]').forEach(button=>button.onclick=()=>togglePanel(button.dataset.closePanel,false));
    document.querySelectorAll('[data-close-dialog]').forEach(button=>button.onclick=()=>$(button.dataset.closeDialog).close());
    $('accessButton').onclick=()=>{$('accessDialog').showModal();globalThis.OSMINOGCoreChat?.openAccess?.()};
    $('captureToggle').onclick=async()=>{if(collectorBusy)return;collectorBusy=true;$('captureToggle').disabled=true;try{await configureCollector({enabled:!collectorConfig.enabled,projectId:state.desk?.id})}catch(error){fail(error)}finally{collectorBusy=false;$('captureToggle').disabled=false}};
    $('newDeskForm').onsubmit=async event=>{event.preventDefault();const name=$('newDeskName').value.trim();if(!name)return;try{const desk=await store.saveDesk({name,view:{x:80,y:100,scale:1},chatProjectId:null});$('newDeskName').value='';await refreshDesks();await openDesk(desk.id);togglePanel('desks',false)}catch(error){fail(error)}};
    $('folderSelect').onchange=()=>{state.folder=$('folderSelect').value;state.selected.clear();updateCount();fitCanvas()};
    $('desktopSelect').onchange=()=>{state.desktop=$('desktopSelect').value;state.selected.clear();track(store.saveDesk({id:state.desk.id,activeDesktop:state.desktop})).catch(fail);updateCount();fitCanvas()};
    $('searchInput').oninput=()=>{searchPage=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(),180)};$('searchScope').onchange=()=>{searchPage=0;runSearch()};$('searchPrev').onclick=()=>{searchPage--;runSearch()};$('searchNext').onclick=()=>{searchPage++;runSearch()};
    $('zoomIn').onclick=()=>zoom(1.2);$('zoomOut').onclick=()=>zoom(1/1.2);$('zoomValue').onclick=()=>zoom(1/state.view.scale);$('fitCanvas').onclick=fitCanvas;
    $('copyItem').onclick=copyModal;$('downloadItem').onclick=downloadModal;$('placeItem').onclick=async()=>{try{const id=modalItem.id;if(modalItem.folderId)await patchItem(id,{folderId:null});await focusItem(id)}catch(error){fail(error)}};$('itemDialog').addEventListener('close',()=>{releaseModalURL();modalItem=null;requestPreviews([...currentImageIds])});
    $('canvas').addEventListener('pointerdown',pointerDown);$('canvas').addEventListener('pointermove',pointerMove);$('canvas').addEventListener('pointerup',pointerUp);$('canvas').addEventListener('pointercancel',pointerUp);$('canvas').addEventListener('wheel',wheel,{passive:false});
    $('canvas').addEventListener('dblclick',event=>{const node=event.target.closest('.canvas-item');if(node)showItem(node.dataset.id).catch(fail)});
    $('canvas').addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy'});$('canvas').addEventListener('drop',drop);
    $('canvas').addEventListener('keydown',event=>{if(event.key==='Enter'&&state.selected.size===1){event.preventDefault();showItem([...state.selected][0]).catch(fail)}});
    window.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select,[contenteditable=true]'))return;if(event.code==='Space'){event.preventDefault();space=true}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();togglePanel('search',true)}if(event.key==='Escape'){state.selected.clear();schedule()}if(event.key==='Delete'&&state.selected.size){for(const id of [...state.selected])deleteItem(id).catch(fail)}});
    window.addEventListener('keyup',event=>{if(event.code==='Space')space=false});window.addEventListener('blur',()=>{space=false;if(gesture)pointerUp()});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;disposePreviews()}else{schedule();collectorStatus().catch(()=>{})}});
    chrome.storage.onChanged.addListener((events,area)=>{if(area==='local'&&events.osminogCollectorV1){collectorConfig=events.osminogCollectorV1.newValue||{};renderCollector()}});
    new ResizeObserver(()=>{canvasSize={width:$('canvas').clientWidth,height:$('canvas').clientHeight};schedule()}).observe($('canvas'));
    $('versionButton').onclick=()=>{$('updateDialog').showModal();checkUpdate()};$('oneClickUpdate').onclick=installUpdate;$('startupRetry').onclick=start;
  }
  function pointerDown(event){
    if(!isReady||event.target.closest('button,select,input,.canvas-top,.canvas-bottom'))return;if(event.button!==0&&event.button!==1)return;
    const node=event.target.closest('.canvas-item'),pan=!node||space||event.button===1;event.preventDefault();$('canvas').focus({preventScroll:true});$('canvas').setPointerCapture(event.pointerId);
    gesture={kind:pan?'pan':'item',pointerId:event.pointerId,sx:event.clientX,sy:event.clientY,view:{...state.view},moved:false};
    if(pan){$('canvas').classList.add('panning');if(!space&&!node)state.selected.clear()}
    else{const item=state.items.get(node.dataset.id);if(!item)return;state.selected=new Set([item.id]);gesture.id=item.id;gesture.original={x:item.x,y:item.y};node.classList.add('dragging')}
    schedule();
  }
  function pointerMove(event){if(!gesture||event.pointerId!==gesture.pointerId)return;const dx=event.clientX-gesture.sx,dy=event.clientY-gesture.sy;if(Math.abs(dx)+Math.abs(dy)>3)gesture.moved=true;if(gesture.kind==='pan'){state.view={...gesture.view,x:gesture.view.x+dx,y:gesture.view.y+dy};schedule()}else{const item=state.items.get(gesture.id);if(!item)return;item.x=gesture.original.x+dx/state.view.scale;item.y=gesture.original.y+dy/state.view.scale;const node=nodes.get(item.id);if(node)node.style.transform=`translate(${item.x}px,${item.y}px)`;renderConnections(new Set(nodes.keys()))}}
  function pointerUp(event){if(!gesture)return;const finished=gesture;gesture=null;$('canvas').classList.remove('panning');if(event&&$('canvas').hasPointerCapture(event.pointerId))$('canvas').releasePointerCapture(event.pointerId);if(finished.kind==='item'){nodes.get(finished.id)?.classList.remove('dragging');const item=state.items.get(finished.id);if(item){index.put(item);if(finished.moved)patchItem(item.id,{x:item.x,y:item.y}).catch(error=>{Object.assign(item,finished.original);index.put(item);schedule();fail(error)})}}else if(finished.moved)queueViewSave();schedule()}
  function wheel(event){if(!isReady)return;event.preventDefault();if(event.ctrlKey||event.metaKey){const bounds=$('canvas').getBoundingClientRect();zoom(Math.exp(-event.deltaY*.002),{x:event.clientX-bounds.left,y:event.clientY-bounds.top})}else{const factor=event.deltaMode===1?16:event.deltaMode===2?canvasSize.height:1;setView({...state.view,x:state.view.x-event.deltaX*factor,y:state.view.y-event.deltaY*factor})}}
  function fitCanvas(){const items=scopeItems();if(!items.length){setView({x:80,y:100,scale:1});return}let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const item of items){const r=rect(item);x=Math.min(x,r.x);y=Math.min(y,r.y);right=Math.max(right,r.x+r.w);bottom=Math.max(bottom,r.y+r.h)}const scale=clamp(Math.min((canvasSize.width-120)/(right-x||1),(canvasSize.height-140)/(bottom-y||1),1),.08,4);setView({scale,x:canvasSize.width/2-(x+right)/2*scale,y:canvasSize.height/2-(y+bottom)/2*scale});schedule()}
  async function drop(event){event.preventDefault();if(!isReady)return;try{const bounds=$('canvas').getBoundingClientRect(),x=(event.clientX-bounds.left-state.view.x)/state.view.scale,y=(event.clientY-bounds.top-state.view.y)/state.view.scale;let offset=0;for(const file of event.dataTransfer.files){await createItem({name:file.name,fileName:file.name,type:file.type.startsWith('image/')?'image':'file',blob:file,mime:file.type,x:x+offset,y:y+offset,w:320,h:240});offset+=24}if(!event.dataTransfer.files.length){const text=event.dataTransfer.getData('text/plain');if(text)await createItem({type:'text',name:text.slice(0,70),text,x,y,w:320,h:220})}}catch(error){fail(error)}}
  async function checkUpdate(){if(updateBusy)return;const button=$('oneClickUpdate');button.disabled=true;$('updateStatusText').textContent='Проверяю обновления…';$('updateStatusSub').textContent='';try{updatePreflight=await globalThis.OSMINOGFolderUpdater.check();$('updateStatusText').textContent=updatePreflight.available?`Доступна версия ${updatePreflight.latestVersion}`:`Установлена версия ${chrome.runtime.getManifest().version}`;$('updateStatusSub').textContent=updatePreflight.message||'';button.textContent=updatePreflight.available?'Обновить сейчас':'Проверить снова'}catch(error){updatePreflight=null;$('updateStatusText').textContent='Не удалось проверить обновление';$('updateStatusSub').textContent=error.message;button.textContent='Повторить проверку'}finally{button.disabled=false}}
  async function installUpdate(){if(updateBusy)return;if(!updatePreflight?.available)return checkUpdate();updateBusy=true;const button=$('oneClickUpdate');button.disabled=true;button.textContent='Обновляю…';try{await flushWrites();const result=await globalThis.OSMINOGFolderUpdater.update({preflight:updatePreflight,onStatus:event=>{$('updateStatusText').textContent=event.message||'Обновляю…';$('updateStatusSub').textContent=Math.round(number(event.progress))+'%'}});if(!result.updated){updatePreflight=null;throw Error(result.message||'Обновление не установлено')}await flushWrites();await globalThis.OSMINOGUpdateHandoff.prepare({from:chrome.runtime.getManifest().version,to:result.currentVersion});chrome.runtime.reload()}catch(error){$('updateStatusText').textContent='Обновление не завершено';$('updateStatusSub').textContent=error.message;button.textContent='Проверить состояние';button.disabled=false;updateBusy=false;updatePreflight=null}}
  let resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve});
  const api={getDeskId:()=>state.desk?.id,getDesk:async()=>state.desk,listItems:()=>[...state.items.values()],getItem:id=>store.getItem(id),getBlob:id=>store.getBlob(id),search:(q,opts)=>store.search(q,opts),createItem,patchItem,deleteItem,focusItem,selectedIds:()=>[...state.selected],getView:()=>({...state.view}),revision:()=>state.revision,onDeskChange:fn=>{deskListeners.add(fn);return()=>deskListeners.delete(fn)}};
  globalThis.OSMINOGCoreApp={...api,ready,items:()=>[...state.items.values()],view:()=>({...state.view}),openDesk,togglePanel,stats:()=>({...metrics,visibleNodes:nodes.size,imageUrls:previews.size,pendingImages:pendingImages.size,totalItems:state.items.size}),flush:flushWrites};
  globalThis.OSMINOGStateReady=ready;
  async function start(){
    if(starting||isReady)return;starting=true;$('startupRetry').hidden=true;$('startupStatus').hidden=false;
    try{
      await store.init({migrate:false});let result=await message({type:'OSMINOG_CORE_INIT'});if(result?.ok===false)throw Error(result.error||'Не удалось открыть хранилище');
      for(let attempt=0;;attempt++){
        result=await collectorStatus();const migration=result?.migration||result?.stats?.migration;
        if(migration?.status==='done')break;if(migration?.status==='error')throw Error(migration.error||'Не удалось перенести материалы');if(attempt>1800)throw Error('Перенос ещё выполняется. Сохранённые исходники не изменены. Откройте стол позже.');
        $('startupDetail').textContent=migration?.items?`Переношу материалы в новое хранилище: ${migration.items.toLocaleString('ru-RU')}. Исходные данные сохранены.`:'Подготовка материалов. При первом запуске переношу прежние столы.';
        await new Promise(resolve=>{migrationTimer=setTimeout(resolve,500)});
      }
      await refreshDesks();const prefs=await chrome.storage.local.get(['osminogCoreUiV1','osminogDisplayPrefs']);
      const legacyPrefs=await store.getMeta('legacy-workspace');const persisted=prefs.osminogCoreUiV1?.activeDesk||legacyPrefs?.activeProject;const selected=state.desks.find(d=>d.id===persisted)||state.desks.find(d=>d.id===collectorConfig.projectId)||state.desks[0];if(!selected)throw Error('Не найден стол');
      if(!subscribed){store.subscribe(event=>{if(event.type==='items')for(const id of event.ids||[])changes.add(id);if(event.type==='desks')fullRefresh=true;if(isReady){clearTimeout(changeTimer);changeTimer=setTimeout(()=>applyChanges().catch(fail),35)}});subscribed=true}
      await openDesk(selected.id);
      chatReady=true;Promise.resolve(globalThis.OSMINOGCoreChat?.init?.({root:$('coreChat'),accessRoot:$('coreAccess'),api})).catch(error=>toast('История чата: '+error.message));
      const query=new URLSearchParams(location.search);if(query.get('view')==='inbox'){state.folder=collectorConfig.folderId||'*';renderScopes();updateCount();fitCanvas();togglePanel('search',true)}
      isReady=true;$('startupStatus').hidden=true;$('saveStatus').textContent='Сохранено на устройстве';resolveReady(globalThis.OSMINOGCoreApp);schedule();if(changes.size||fullRefresh)applyChanges().catch(fail);
      message({type:'OSMINOG_EDITOR_READY',version:chrome.runtime.getManifest().version}).catch(()=>{});
    }catch(error){console.error(error);$('startupDetail').textContent=error.message||String(error);$('startupRetry').hidden=false}finally{starting=false}
  }
  bindUI();const version=chrome.runtime.getManifest().version;$('versionButton').textContent='v'+version;$('updateCurrentVersion').textContent='v'+version;start();
})();
