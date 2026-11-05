/* Workspace 4.0.23: shared helpers; no storage migration or deletion. */
(()=>{'use strict';
 const native=!!document.documentElement.dataset.nativeDesktop;
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function pointEye(el,x,y){
  if(!el||!Number.isFinite(x)||!Number.isFinite(y))return;
  const previous=el.__eyePoint||{x,y},dx=Math.max(-7,Math.min(7,(x-previous.x)/5)),dy=Math.max(-3,Math.min(3,(y-previous.y)/6));
  el.__eyePoint={x,y};el.style.setProperty('--eye-x',dx+'px');el.style.setProperty('--eye-y',dy+'px');el.style.setProperty('--eye-tilt',(dx*.7)+'deg');
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
 function captureFolder(f){const p=globalThis.project?.(),cfg=globalThis.OSMINOGLibrary?.destination?.();return !!p&&!!f&&cfg?.projectId===p.id&&cfg?.folderId===f.id}
 async function openExternal(value){const url=new URL(String(value||''));if(!['https:','http:'].includes(url.protocol))throw Error('Поддерживаются ссылки HTTP и HTTPS');if(globalThis.chrome?.tabs?.create)return chrome.tabs.create({url:url.href});window.open(url.href,'_blank','noopener,noreferrer');return{ok:true}}
 function appendStoredLayers(root,query){
  const p=globalThis.project?.();if(!p)return;
  const list=(p.objects||[]).filter(o=>o.osminogFolderId&&(o.osminogDesktopId||'main')===(p.activeDesktop||'main')&&[o.name,o.fileName,o.text,o.title].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  if(!list.length)return;
  const heading=document.createElement('div');heading.className='cl-stored-heading';heading.textContent=state.language==='ru'?'В папках · '+list.length:'In folders · '+list.length;root.append(heading);
  for(const o of list){
   const f=(p.osminogFolders||[]).find(f=>f.id===o.osminogFolderId);if(!f)continue;
   const row=document.createElement('button');row.type='button';row.className='clean-layer cl-stored';row.dataset.storedId=o.id;
   const thumb=document.createElement('span');thumb.className='cl-thumb';thumb.textContent=materialKind(o)==='text'?'T':o.type==='image'?'▧':'▤';
   const title=document.createElement('span');title.className='cl-title';title.append(document.createTextNode(o.name||o.fileName||o.title||String(o.text||'').slice(0,60)||'Материал'));
   const sub=document.createElement('small');sub.textContent=f.name;title.append(sub);const arrow=document.createElement('span');arrow.className='cl-open';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
   row.append(thumb,title,arrow);row.title=(state.language==='ru'?'Открыть из папки «':'Open from folder “')+f.name+'”';
   row.onclick=()=>globalThis.OSMINOGWindowsFolders?.openObject?.(o.id);root.append(row);
  }
 }
 function headerEdge(){const bar=document.querySelector('#app .topbar'),r=bar?.getBoundingClientRect();if(r&&r.height>0)document.documentElement.style.setProperty('--workspace-top',Math.round(r.bottom)+'px')}
 function install(){
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
