/* Workspace 4.0.24: shared helpers; no storage migration or deletion. */
(()=>{'use strict';
 const native=!!document.documentElement.dataset.nativeDesktop;
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function pointEye(el,x,y){
  if(!el||!Number.isFinite(x)||!Number.isFinite(y))return;
  const previous=el.__eyePoint||{x,y},dx=Math.max(-7,Math.min(7,(x-previous.x)/5)),dy=Math.max(-3,Math.min(3,(y-previous.y)/6));
  el.__eyePoint={x,y};for(const [key,value] of [['--eye-x',dx+'px'],['--eye-y',dy+'px'],['--eye-tilt',(dx*.7)+'deg']])if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);
 }
 function materialKind(o){
  const mime=String(o.mime||'').toLowerCase(),name=String(o.fileName||o.name||'');
  if(o.type==='image'||o.type==='audio'||o.type==='video'||/^(image|audio|video)\//.test(mime))return'media';
  if(['text','note','brief','node','code'].includes(o.type)||/^text\//.test(mime)||/\.(txt|md|markdown|csv|json|yaml|yml|xml|log)$/i.test(name))return'text';
  return'file';
 }
 function folderCount(f){
  const p=globalThis.project?.();if(!p||!f)return 0;
  return (p.objects||[]).filter(o=>o.osminogFolderId===f.id).length+(p.osminogFolders||[]).filter(x=>x.parentId===f.id).length;
 }
 function captureFolder(f){const p=globalThis.project?.(),cfg=globalThis.OSMINOGLibrary?.destination?.();return !!p&&!!f&&(p.defaultInboxId===f.id||cfg?.projectId===p.id&&cfg?.folderId===f.id)}
 async function openExternal(value){const url=new URL(String(value||''));if(!['https:','http:'].includes(url.protocol))throw Error('Поддерживаются ссылки HTTP и HTTPS');if(globalThis.chrome?.tabs?.create)return chrome.tabs.create({url:url.href});window.open(url.href,'_blank','noopener,noreferrer');return{ok:true}}
 // Only a bounded page of stored materials enters the live DOM. Search still
 // covers every stored item; pagination never deletes or migrates user data.
 const STORED_PAGE_SIZE=80;
 // Do not let hidden/offscreen archive rows decode original screenshots.
 // The baseline preview preference applies to stored materials as well.
 const storedPreviewSources=new Map();
 let storedPreviewObserver;
 function observeStoredPreview(image,src){
  if(typeof IntersectionObserver!=='function')return;
  if(!storedPreviewObserver)storedPreviewObserver=new IntersectionObserver(entries=>{
   const panel=document.querySelector('#layersPanel');
   for(const entry of entries){
    const img=entry.target,source=storedPreviewSources.get(img);
    if(!img.isConnected){storedPreviewObserver.unobserve(img);storedPreviewSources.delete(img);continue}
    if(entry.isIntersecting&&!document.hidden&&!panel?.hidden&&panel?.classList.contains('open')&&state.ui?.layerPreviews){
     if(source&&img.getAttribute('src')!==source)img.src=source;
    }else img.removeAttribute('src');
   }
  },{root:document.querySelector('#layerList'),rootMargin:'0px',threshold:0});
  storedPreviewSources.set(image,src);storedPreviewObserver.observe(image);
 }
 function releaseStoredPreviews(){
  for(const image of storedPreviewSources.keys()){
   image.removeAttribute('src');storedPreviewObserver?.unobserve(image);
  }
  storedPreviewSources.clear();
 }
 let storedPage={scope:'',query:'',index:0};
 function appendStoredLayers(root,query){
  const p=globalThis.project?.();if(!p)return;
  const scope=p.id+':'+(p.activeDesktop||'main');
  if(storedPage.scope!==scope||storedPage.query!==query)storedPage={scope,query,index:0};
  const folders=new Map((p.osminogFolders||[]).map(f=>[f.id,f]));
  const list=(p.objects||[]).filter(o=>(folders.has(o.osminogFolderId)||(!o.osminogFolderId&&o.captureId))&&(o.osminogDesktopId||'main')===(p.activeDesktop||'main')&&
   (!query||[o.name,o.fileName,o.text,o.title].some(v=>typeof v==='string'&&v.toLocaleLowerCase().includes(query))));
  list.sort((a,b)=>(b.capturedAt||b.createdAt||0)-(a.capturedAt||a.createdAt||0));
  if(!list.length){storedPage.index=0;return}
  if(storedPage.newest&&storedPage.newest!==list[0].id)storedPage.index=0;
  storedPage.newest=list[0].id;
  const pages=Math.ceil(list.length/STORED_PAGE_SIZE);storedPage.index=Math.min(storedPage.index,pages-1);
  const heading=document.createElement('div');heading.className='cl-stored-heading';heading.textContent=OSMINOGWorkspaceLanguage.text('saved')+' · '+list.length;
  const fragment=document.createDocumentFragment();fragment.append(heading);
  for(const o of list.slice(storedPage.index*STORED_PAGE_SIZE,(storedPage.index+1)*STORED_PAGE_SIZE)){
   const f=folders.get(o.osminogFolderId);
   const row=document.createElement('button');row.type='button';row.className='clean-layer cl-stored';row.dataset.storedId=o.id;
   const preview=state.ui?.layerPreviews&&o.type==='image'&&o.src;
   const thumb=document.createElement(preview?'img':'span');thumb.className='cl-thumb';
   if(preview){thumb.alt='';thumb.decoding='async';observeStoredPreview(thumb,o.src)}
   else thumb.textContent=materialKind(o)==='text'?'T':'▤';
   const title=document.createElement('span');title.className='cl-title';title.append(document.createTextNode(OSMINOGWorkspaceLanguage.captureCaption(o,'name')||o.fileName||o.title||String(o.text||'').slice(0,60)||'Материал'));
   const sub=document.createElement('small');sub.textContent=f?.name||(OSMINOGWorkspaceLanguage.text('onDesk'));title.append(sub);const arrow=document.createElement('span');arrow.className='cl-open';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
   row.append(thumb,title,arrow);row.title=f?OSMINOGWorkspaceLanguage.label('Открыть из папки')+' · '+f.name:o.name;
   row.onclick=()=>{if(f)globalThis.OSMINOGWindowsFolders?.openObject?.(o.id);else{selectObject(o.id,false);focusObject(o)}};fragment.append(row);
  }
  if(pages>1){
   const nav=document.createElement('nav');nav.className='cl-stored-pages';nav.setAttribute('aria-label',state.language==='ru'?'Страницы материалов':'Material pages');
   for(const [direction,label] of [[-1,'←'],[1,'→']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.storedPage=String(direction);button.disabled=direction<0?storedPage.index===0:storedPage.index===pages-1;button.setAttribute('aria-label',direction<0?'Previous page':'Next page');button.onclick=()=>{storedPage.index+=direction;globalThis.renderLayers?.();root.scrollTop=0};nav.append(button);if(direction<0){const text=document.createElement('span');text.textContent=(storedPage.index+1)+' / '+pages;nav.append(text)}}
   fragment.append(nav);
  }
  root.prepend(fragment);
 }
 // Compare small presentation fields, not JSON/string hashes of complete images
 // and note bodies. Identical redraw requests must preserve existing DOM nodes.
 function installLayerBudget(){
  if(native||typeof globalThis.renderLayers!=='function')return;
  const base=globalThis.renderLayers,panel=document.querySelector('#layersPanel'),root=document.querySelector('#layerList');if(!panel||!root)return;
  let previous=null,first=null,last=null,children=0,rendering=false,dirty=true,counterFrame=0;
  // Counters belong to the canvas, not the visibility or cached DOM of Layers.
  const refreshCounters=()=>{if(counterFrame)return;counterFrame=requestAnimationFrame(()=>{counterFrame=0;globalThis.OSMINOGWindowsFolders?.render?.()})};
  const snapshot=()=>{
   const p=globalThis.project?.(),q=document.querySelector('#layerSearch')?.value||'',cfg=globalThis.OSMINOGLibrary?.destination?.();
   const keys=[p,p?.id,p?.activeDesktop,state.language,state.ui?.layerPreviews,q,storedPage.index,cfg?.projectId,cfg?.folderId,(state.selected||[]).length,...(state.selected||[]),(p?.groups||[]).length,(p?.osminogFolders||[]).length,(p?.objects||[]).length];
   for(const g of p?.groups||[])keys.push(g,g.id,g.name,g.collapsed);
   for(const f of p?.osminogFolders||[])keys.push(f,f.id,f.name,f.parentId,f.desktopVisible);
   for(const o of p?.objects||[])keys.push(o,o.id,o.capturedAt,o.createdAt,o.type,o.mime,o.name,o.fileName,o.title,o.group,o.visible,o.osminogFolderId,o.osminogDesktopId,
    q?o.text:(!o.name&&!o.fileName&&!o.title?String(o.text||'').slice(0,60):null),o.type==='image'&&!o.osminogFolderId?o.src:null);
   return keys;
  };
  globalThis.renderLayers=function(...args){
   if(rendering)return;
   if(state.ui?.layersTab&&state.ui.layersTab!=='layers'){previous=null;releaseStoredPreviews();return base.apply(this,args)}
   if(panel.hidden||!panel.classList.contains('open')){dirty=true;refreshCounters();return}
   const next=snapshot();
   if(!dirty&&previous&&first===root.firstChild&&last===root.lastChild&&children===root.childElementCount&&!root.querySelector('input')&&next.length===previous.length&&next.every((v,i)=>v===previous[i])){return;}
   rendering=true;try{releaseStoredPreviews();const result=base.apply(this,args);previous=next;dirty=false;first=root.firstChild;last=root.lastChild;children=root.childElementCount;return result}finally{rendering=false}
  };
  const observer=new MutationObserver(()=>{if(panel.hidden||!panel.classList.contains('open')){releaseStoredPreviews();dirty=true}else if(dirty)globalThis.renderLayers()});
  observer.observe(panel,{attributes:true,attributeFilter:['hidden','class']});
 }
 function headerEdge(){const bar=document.querySelector('#app .topbar'),r=bar?.getBoundingClientRect();if(r&&r.height>0){const value=Math.round(r.bottom)+'px';if(document.documentElement.style.getPropertyValue('--workspace-top')!==value)document.documentElement.style.setProperty('--workspace-top',value)}}
 function install(){
  installLayerBudget();
  const visibility=()=>document.documentElement.dataset.workspaceHidden=String(document.hidden);document.addEventListener('visibilitychange',visibility);visibility();
  const bar=document.querySelector('#app .topbar');if(bar)new ResizeObserver(headerEdge).observe(bar);window.addEventListener('resize',headerEdge,{passive:true});document.addEventListener('osminog:project-opened',()=>requestAnimationFrame(headerEdge));headerEdge();
  if(!native){
   // Legacy browser cards remain readable links; their data is never removed.
   const oldHTML=globalThis.objectHTML;if(oldHTML)globalThis.objectHTML=function(o){if(o.type!=='browser')return oldHTML(o);return objectBar(o)+'<div class="object-content desk-link-card"><strong>'+escape(o.name||'Ссылка')+'</strong><span>'+escape(o.url||'')+'</span><button type="button" data-open-saved-link>Открыть в Chrome ↗</button></div>'};
   globalThis.bindBrowser=function(el,o){const button=el.querySelector('[data-open-saved-link]');if(button)button.onclick=e=>{e.stopPropagation();openExternal(o.url).catch(err=>globalThis.showToast?.(err.message))}};
   if(globalThis.OSMINOGEditorAPI)delete globalThis.OSMINOGEditorAPI.openBrowserEditor;
   const enabled=globalThis.OSMINOGToolEnabled,retired=new Set(['browser_load_html','browser_export','browser_edit_current','browser_extract_current']);
   globalThis.OSMINOGToolEnabled=name=>retired.has(name)?false:enabled?enabled(name):true;
   if(typeof state!=='undefined'&&state.mode==='browser')state.mode='design';
  }
  globalThis.renderLayers?.();
 }
 globalThis.OSMINOGWorkspacePolish={pointEye,materialKind,folderCount,captureFolder,appendStoredLayers,openExternal};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
