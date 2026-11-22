'use strict';
globalThis.createMouseBrowsing=({N,openPage,selected,show,restore,status,locale,onSidebar})=>{
 const $=s=>document.querySelector(s),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const tr=(ru,en)=>locale()==='en'?en:ru;
 const d=make('dialog','library-dialog');d.id='library-dialog';d.dataset.nonmodal='true';d.setAttribute('aria-label','Библиотека');
 d.innerHTML='<header><strong id="library-title" class="library-sr">История</strong><nav class="library-tabs" aria-label="Раздел библиотеки"><button data-library="history">◷</button><button data-library="searches">⌕</button><button data-library="bookmarks">☆</button><button data-library="downloads">↓</button><button data-library="captures"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h5l2-3h4l2 3h5v15H3Z"/><circle cx="12" cy="13" r="4"/></svg></button></nav><div class="library-views"><button id="library-list" data-view="list" aria-label="Список" title="Список"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 5h11M6 10h11M6 15h11M2 5h1M2 10h1M2 15h1"/></svg></button><button id="library-grid" data-view="grid" aria-label="Плитка" title="Плитка"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 2h6v6H2zM12 2h6v6h-6zM2 12h6v6H2zM12 12h6v6h-6z"/></svg></button></div><button type="button" id="library-close" aria-label="Закрыть">×</button></header><div class="library-search"><input id="library-query" placeholder="Поиск в списке" autocomplete="off" aria-label="Поиск в списке"></div><div class="library-summary"><button id="library-clear" hidden>Очистить</button><span id="library-count"></span><button id="library-more" hidden>Показать все</button><label class="library-select-all"><input type="checkbox" id="library-select-all" aria-label="Выделить всё найденное"><span class="library-sr">Выделить всё найденное</span></label></div><section id="library-capture-settings" hidden><label class="capture-switch-label"><input id="capture-auto" type="checkbox" role="switch"><span>Локальный автосбор</span></label><p id="capture-local-status" class="hint"></p><div class="capture-actions"><button id="capture-import">Добавить</button><button id="capture-watch-folder">Папка скриншотов</button><button id="capture-open-folder">Открыть архив</button></div><p class="hint">Новые изображения и текст из буфера — пока браузер запущен. Новые снимки — из выбранной папки. Без отправки в сеть. Не сохраняйте секреты.</p></section><div id="library-rows" data-view="list"></div>';
 document.querySelector('#workspace').append(d);let kind='history',limit=100,generation=0,previewGeneration=0,previewContentSerial=0,stalePreviewCloses=0,total=0,removableTotal=0,allSelected=false,renderedKind='';
 const selection=new Set(),excluded=new Set(),views={history:'list',searches:'list',bookmarks:'list',downloads:'list',captures:'grid'};
 const rowRecords=new Map(),dayRecords=new Map();
 const run=fn=>Promise.resolve().then(fn).catch(e=>status(e.message));
 const button=(label,fn,cls)=>{const b=make('button',cls,label);b.type='button';b.onclick=()=>run(fn);return b};
 const bytes=n=>!n?'0 B':n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
 const names={history:()=>tr('История','History'),searches:()=>tr('Поиск','Searches'),bookmarks:()=>tr('Закладки','Bookmarks'),downloads:()=>tr('Загрузки','Downloads'),captures:()=>tr('Скриншоты и текст','Screenshots and text')};
 const library=(action,args)=>args.kind==='captures'?N.archive(action,args):N.library(action,args);
 async function fileAction(rowKind,item,action){
  if(kind!==rowKind||!d.open||!rowRecords.has(item.id)||rowKind==='captures'&&document.documentElement.dataset.private==='true')return;
  if(action==='preview'&&rowKind==='captures')return previewCapture(item);
  if(action==='copy'&&rowKind==='captures')return N.archive('copy',{id:item.id});
  if(action==='remove'){const result=await library('remove',{kind:rowKind,id:item.id});if(result?.cleared===false)return;selection.delete(item.id);excluded.delete(item.id);await render();return;}
  if(rowKind==='downloads'&&['open','show','pause','resume','cancel','retry'].includes(action))return N.library('download',{id:item.id,action});
 }
 function fileControls(row,label,rowKind,item){
  let dragged=false;const open=label.onclick;label.onclick=event=>{if(dragged){dragged=false;return;}return open?.(event);};label.onpointerdown=()=>{dragged=false;};
  const context=event=>{event.preventDefault();event.stopPropagation?.();const box=label.getBoundingClientRect(),x=Number.isFinite(event.clientX)&&event.clientX>0?event.clientX:box.x+box.width/2,y=Number.isFinite(event.clientY)&&event.clientY>0?event.clientY:box.y+box.height/2;
   void run(async()=>{const result=await library('context-menu',{kind:rowKind,id:item.id,x:Math.max(0,Math.min(innerWidth-1,Math.round(x))),y:Math.max(0,Math.min(innerHeight-1,Math.round(y)))});if(result?.action)await fileAction(rowKind,rowRecords.get(item.id)?.item||item,result.action);});};
  row.oncontextmenu=context;label.onkeydown=event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10')context(event);else if(event.key==='Enter'||event.key===' ')dragged=false;};
  label.draggable=rowKind==='captures'||item.state==='completed';label.ondragstart=event=>{event.preventDefault();event.stopPropagation?.();event.dataTransfer?.clearData();if(event.isTrusted!==true||!label.draggable)return;dragged=true;void run(()=>library('drag',{kind:rowKind,id:item.id}));};
 }
 const preview=make('dialog','local-preview-dialog');preview.id='local-preview-dialog';preview.innerHTML='<header><strong id="local-preview-title"></strong><button type="button" aria-label="Закрыть">×</button></header><div class="local-preview-body"></div>';document.body.append(preview);preview.querySelector('button').onclick=()=>preview.close();preview.addEventListener('close',()=>{if(stalePreviewCloses)stalePreviewCloses--;else previewGeneration++;restore()});
 async function previewCapture(item){const serial=++previewGeneration,result=await N.archive('preview',{id:item.id});if(serial!==previewGeneration||kind!=='captures'||!d.open||document.documentElement.dataset.private==='true'||!rowRecords.has(item.id))return;const body=preview.querySelector('.local-preview-body');previewContentSerial=serial;body.replaceChildren();preview.querySelector('strong').textContent=result.title;if(result.type==='text')body.append(make('pre','local-text-full',result.text));else{const img=make('img');img.src=result.src;img.alt=result.title;body.append(img);}if(!preview.open)await show(preview);
  // Native overlay preparation is asynchronous too. An obsolete show must not
  // reopen a closed/private library or dismiss a newer preview's content.
  const invalidContext=kind!=='captures'||!d.open||document.documentElement.dataset.private==='true';
  if(invalidContext||previewContentSerial===serial&&(serial!==previewGeneration||!rowRecords.has(item.id))){body.replaceChildren();preview.querySelector('strong').textContent='';if(preview.open){stalePreviewCloses++;preview.close();}}
 }
 async function captureSettings(){const id=generation,panel=$('#library-capture-settings');panel.hidden=kind!=='captures';if(panel.hidden)return;const toggle=$('#capture-auto'),label=$('#capture-local-status');if(document.documentElement.dataset.private==='true'){toggle.disabled=true;toggle.checked=false;label.textContent=tr('В инкогнито архив и автосбор недоступны.','Archive and collection are unavailable in private mode.');panel.querySelectorAll('button').forEach(b=>b.disabled=true);return;}const s=await N.archive('state');if(id!==generation||kind!=='captures'||document.documentElement.dataset.private==='true')return;toggle.disabled=false;toggle.checked=s.enabled;panel.querySelectorAll('button').forEach(b=>b.disabled=false);label.textContent=s.error||((s.enabled?(s.paused?'Пауза':'Сбор включён'):'Сбор выключен')+' · '+s.count+' · '+bytes(s.bytes)+' · '+s.root+' · Папка снимков: '+s.folder);}
 const fileFallback='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M4 1h15l9 10v28H4z" fill="#edf0f5" stroke="#8b95a5"/><path d="M19 1v10h9M9 21h14M9 26h14M9 31h9" fill="none" stroke="#8b95a5"/></svg>');
 const iconTasks=new WeakMap(),observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);const task=iconTasks.get(entry.target);if(task)void task();}},{root:d.querySelector('#library-rows'),rootMargin:'100px'});
 function setIcon(record,rowKind){
  const {img,item}=record,key=JSON.stringify([rowKind,item.id,item.url,item.favicon,item.path,item.filename,item.type,item.state==='completed']);
  const changed=record.iconKey!==key;if(changed){record.iconKey=key;record.iconVersion=(record.iconVersion||0)+1;}
  // Archive copies are immutable per ID. Completed downloads can change on
  // disk: revalidate their cached preview without discarding the displayed img.
  if(!changed&&(rowKind!=='downloads'||item.state!=='completed'))return;
  record.iconAgain=true;if(record.iconPending)return;
  iconTasks.set(img,async()=>{if(record.iconPending)return;record.iconPending=true;record.iconAgain=false;const version=record.iconVersion,current=record.item;let value='',thumbnail=false;
   try{if(rowKind==='captures'){if(current.type!=='text'){value=(await N.archive('preview',{id:current.id})).src;thumbnail=!!value;}}else if(rowKind==='downloads'){value=await N.library('preview',{id:current.id});thumbnail=!!value;if(!value)value=await N.library('icon',{kind:rowKind,id:current.id});}else value=await N.library('icon',{kind:rowKind,url:current.url});}catch{}
   if(record.iconVersion===version&&rowRecords.get(current.id)===record&&img.isConnected&&d.open&&kind===rowKind&&!(rowKind==='captures'&&document.documentElement.dataset.private==='true')){const loaded=/^data:image\//.test(value||''),src=loaded?value:['downloads','captures'].includes(rowKind)?fileFallback:'globe.svg';if(img.getAttribute('src')!==src)img.src=src;img.classList.toggle('library-thumbnail',loaded&&thumbnail);if(loaded)img.dataset.loaded='true';else delete img.dataset.loaded;}
   record.iconPending=false;if(record.iconAgain&&rowRecords.get(record.item.id)===record&&d.open)observer.observe(img);
  });observer.observe(img);
 }
 function forget(record){observer.unobserve(record.img);iconTasks.delete(record.img);record.iconVersion=(record.iconVersion||0)+1;}
 function clearRows(){for(const record of rowRecords.values())forget(record);rowRecords.clear();dayRecords.clear();renderedKind='';}
 function reconcile(list,nodes){const wanted=new Set(nodes);for(const child of [...list.children])if(!wanted.has(child))child.remove();let next=list.firstChild;for(const node of nodes){if(node===next)next=next.nextSibling;else list.insertBefore(node,next);}}
 function downloadProgress(row,item){const detail=row.querySelector('.library-detail'),state={completed:tr('Готово','Complete'),paused:tr('Пауза','Paused'),progressing:tr('Скачивается','Downloading'),cancelled:tr('Отменено','Cancelled'),interrupted:tr('Прервано','Interrupted')}[item.state]||item.state,text=state+' · '+bytes(item.received)+(item.total?' / '+bytes(item.total):'');if(detail.textContent!==text)detail.textContent=text;const progress=row.querySelector('progress');if(!progress)return;if(Number.isFinite(item.total)&&item.total>0){progress.max=item.total;progress.value=Math.min(item.total,Math.max(0,item.received||0));progress.removeAttribute('aria-valuetext');}else{progress.removeAttribute('value');progress.setAttribute('aria-valuetext',tr('Размер файла неизвестен','File size is unknown'));}}
 function resetSelection(){allSelected=false;selection.clear();excluded.clear();}
 const checked=id=>allSelected?!excluded.has(id):selection.has(id);
 function controls(){
  const count=allSelected?Math.max(0,removableTotal-excluded.size):selection.size;
  const clear=$('#library-clear');clear.hidden=count===0;clear.textContent=tr('Очистить','Clear')+' ('+count+')';
  const all=$('#library-select-all');all.checked=removableTotal>0&&count===removableTotal;all.indeterminate=count>0&&count<removableTotal;all.disabled=removableTotal===0;all.title=tr('Выделить всё найденное','Select all matching entries');all.setAttribute('aria-label',all.title);
  d.querySelectorAll('.library-check').forEach(e=>{e.checked=checked(e.dataset.id);e.closest('.library-row').classList.toggle('is-selected',e.checked)});
  d.querySelectorAll('[data-view]').forEach(e=>{if(e.tagName==='BUTTON')e.setAttribute('aria-pressed',String(e.dataset.view===views[kind]))});
 }
 async function render(){
  const id=++generation;await captureSettings();if(id!==generation)return;if(kind==='captures'&&document.documentElement.dataset.private==='true'){clearRows();$('#library-rows').replaceChildren(make('p','hint','Локальный архив недоступен в инкогнито.'));$('#library-count').textContent='';return;}
  const query=$('#library-query').value,rowKind=kind,parts=[];
  for(let offset=0;offset<limit;offset+=100){const part=await library('list',{kind:rowKind,query,offset});if(id!==generation)return;parts.push(part);if(offset+100>=part.total)break;}
  const list=$('#library-rows'),scrollTop=list.scrollTop,listBounds=list.getBoundingClientRect(),focused=document.activeElement?.closest('.library-row'),visible=row=>row&&list.contains(row)&&row.getBoundingClientRect().bottom>listBounds.top&&row.getBoundingClientRect().top<listBounds.bottom,anchor=scrollTop>0?(visible(focused)?focused:[...list.querySelectorAll('.library-row')].find(visible)):null,anchorTop=anchor?.getBoundingClientRect().top;
  if(renderedKind!==rowKind){clearRows();renderedKind=rowKind;}list.dataset.view=views[kind];d.dataset.kind=kind;$('#library-title').textContent=names[kind]();d.setAttribute('aria-label',names[kind]());
  d.querySelectorAll('[data-library]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.library===kind));b.title=names[b.dataset.library]();b.setAttribute('aria-label',b.title)});
  for(const [view,ru,en] of [['list','Список','List'],['grid','Плитка','Tiles']]){const b=$('#library-'+view);b.title=tr(ru,en);b.setAttribute('aria-label',b.title);}
  $('#library-query').placeholder=tr('Поиск в списке','Search this list');$('#library-query').setAttribute('aria-label',$('#library-query').placeholder);
  const rows=parts.flatMap(x=>x.items);total=parts[0]?.total||0;removableTotal=parts[0]?.removableTotal??total;
  const ids=new Set(rows.map(item=>item.id));for(const [key,record]of rowRecords)if(!ids.has(key)){forget(record);rowRecords.delete(key);}if(rows.length>=total)for(const set of [selection,excluded])for(const key of set)if(!ids.has(key))set.delete(key);
  let day='';const nodes=[],days=new Set(),icons=[];if(!rows.length){const empty=list.querySelector('.hint')||make('p','hint'),text=tr('Пока пусто.','Nothing here yet.');if(empty.textContent!==text)empty.textContent=text;nodes.push(empty);}
  for(const item of rows){
   const stamp=new Date(item.at);const date=Number.isFinite(stamp.getTime())?new Intl.DateTimeFormat(locale(),{year:'numeric',month:'long',day:'numeric'}).format(stamp):'';
   if(date!==day){day=date;const key=day+':'+days.size;days.add(key);let heading=dayRecords.get(key);if(!heading){heading=make('h3','library-day',day);dayRecords.set(key,heading);}nodes.push(heading);}
   const shape=JSON.stringify(rowKind==='downloads'?{...item,received:undefined,total:undefined}:item)+'|'+locale();let record=rowRecords.get(item.id);
   if(record&&record.shape===shape){record.item=item;if(rowKind==='downloads')downloadProgress(record.row,item);nodes.push(record.row);if(item.url||['downloads','captures'].includes(rowKind))icons.push(record);continue;}
   const row=record?.row||make('article','library-row');row.dataset.id=item.id;const body=make('div','library-body'),actions=make('div','library-actions'),fileRow=['captures','downloads'].includes(rowKind),contentOnly=rowKind==='captures'||rowKind==='downloads'&&item.state==='completed';row.classList.toggle('library-file-row',fileRow);row.classList.toggle('library-content-only',contentOnly);
   const title=String(item.title||item.query||item.filename||item.url||'');
   const visual=make('span','library-visual'),img=record?.img||make('img','library-icon');if(!record){img.alt='';img.draggable=false;img.src=['downloads','captures'].includes(rowKind)?fileFallback:'globe.svg';}visual.append(img);
   if(rowKind==='downloads'){const ext=(item.filename||'').match(/\.([\p{L}\p{N}]{1,8})$/u)?.[1]||'FILE';visual.append(make('small','library-extension',ext.toUpperCase()));}
   const label=rowKind==='captures'?button('',()=>previewCapture(item),'library-name library-file-open'):rowKind==='downloads'?(contentOnly?button('',()=>N.library('download',{id:item.id,action:'open'}),'library-name library-file-open'):make('strong','library-name',title)):button(title,async()=>{await openPage(item.url||item.query);restore()},'library-name');label.title=title;label.setAttribute('aria-label',title||tr('Открыть файл','Open file'));body.append(label);
   if(rowKind==='captures'){
    if(item.type==='text'){label.classList.add('library-text-preview');label.textContent=item.snippet;visual.hidden=true;}else{visual.classList.add('library-capture-image');label.append(visual);}
   }else if(rowKind==='downloads'){
    const state={completed:tr('Готово','Complete'),paused:tr('Пауза','Paused'),progressing:tr('Скачивается','Downloading'),cancelled:tr('Отменено','Cancelled'),interrupted:tr('Прервано','Interrupted')}[item.state]||item.state;
    body.append(make('small','library-detail',state+' · '+bytes(item.received)+(item.total?' / '+bytes(item.total):'')));
    if(['progressing','paused'].includes(item.state)){const progress=make('progress');progress.setAttribute('aria-label',title);if(Number.isFinite(item.total)&&item.total>0){progress.max=item.total;progress.value=Math.min(item.total,Math.max(0,item.received||0));}else{progress.removeAttribute('value');progress.setAttribute('aria-valuetext',tr('Размер файла неизвестен','File size is unknown'));}body.append(progress);actions.append(button(item.state==='paused'?tr('Продолжить','Resume'):tr('Пауза','Pause'),()=>N.library('download',{id:item.id,action:item.state==='paused'?'resume':'pause'})),button(tr('Отменить','Cancel'),()=>N.library('download',{id:item.id,action:'cancel'})));}
    else if(item.state==='completed')label.append(visual);
    else if(item.url)actions.append(button(tr('Повторить','Retry'),()=>N.library('download',{id:item.id,action:'retry'})));
   }else body.append(make('small','library-detail',item.url||date));
   let checkbox;if(!['progressing','paused'].includes(item.state)){
    if(!fileRow){const remove=button('×',async()=>{await library('remove',{kind:rowKind,id:item.id});selection.delete(item.id);excluded.delete(item.id);await render()},'library-remove');remove.title=tr('Удалить запись','Remove entry');remove.setAttribute('aria-label',remove.title+': '+title);actions.append(remove);}
    checkbox=record?.checkbox||make('input','library-check');checkbox.type='checkbox';checkbox.dataset.id=item.id;checkbox.setAttribute('aria-label',tr('Выделить: ','Select: ')+title);checkbox.onchange=()=>{if(allSelected){if(checkbox.checked)excluded.delete(item.id);else excluded.add(item.id)}else if(checkbox.checked)selection.add(item.id);else selection.delete(item.id);controls()};
   }
   if(fileRow)fileControls(row,label,rowKind,item);
   reconcile(row,[...(checkbox?[checkbox]:[]),...(!contentOnly||visual.hidden?[visual]:[]),body,...(actions.children.length?[actions]:[])]);record=Object.assign(record||{row,img},{item,shape,checkbox});rowRecords.set(item.id,record);nodes.push(row);if(item.url||['downloads','captures'].includes(rowKind))icons.push(record);
  }
  for(const key of dayRecords.keys())if(!days.has(key))dayRecords.delete(key);reconcile(list,nodes);list.scrollTop=scrollTop;if(anchor?.isConnected)list.scrollTop+=anchor.getBoundingClientRect().top-anchorTop;for(const record of icons)setIcon(record,rowKind);
  $('#library-count').textContent=rows.length+' / '+total+' · '+names[kind]();$('#library-more').hidden=rows.length>=total;$('#library-more').textContent=tr('Показать все','Show all');controls();
 }
 async function open(value){hideHints();previewGeneration++;clearRows();kind=value;limit=100;resetSelection();$('#library-query').value='';if(!d.open){await N.browser('layout',{panels:[]});d.show();}onSidebar(true);restore();if(kind==='downloads')await N.library('download-seen');await render();$('#library-query').focus();}
 $('#capture-auto').onchange=()=>run(async()=>{try{await N.archive('toggle',{enabled:$('#capture-auto').checked});}finally{await captureSettings();}});
 for(const [id,action] of [['capture-import','import'],['capture-watch-folder','folder'],['capture-open-folder','show-folder']])$('#'+id).onclick=()=>run(async()=>{await N.archive(action);await render();});
 $('#library-close').onclick=()=>d.close();d.addEventListener('close',()=>{if(d.open)return;generation++;previewGeneration++;observer.disconnect();clearRows();onSidebar(false);hideHints();restore()});
 d.querySelectorAll('[data-library]').forEach(b=>b.onclick=()=>run(async()=>{previewGeneration++;kind=b.dataset.library;limit=100;resetSelection();if(kind==='downloads')await N.library('download-seen');return render()}));
 d.querySelectorAll('button[data-view]').forEach(b=>b.onclick=()=>{views[kind]=b.dataset.view;$('#library-rows').dataset.view=b.dataset.view;controls()});
 $('#library-query').oninput=()=>{previewGeneration++;limit=100;resetSelection();void run(render)};$('#library-more').onclick=()=>{limit=Math.max(100,total);void run(render)};
 $('#library-select-all').onchange=e=>{resetSelection();allSelected=e.target.checked;controls()};
 $('#library-clear').onclick=()=>run(async()=>{const result=await library('remove-selected',{kind,query:$('#library-query').value,all:allSelected,ids:[...selection],exclude:[...excluded]});if(result.cleared)resetSelection();await render()});
 N.onLibrary(()=>{if(d.open)void run(render)});
 const pop=make('div','address-suggestions');pop.id='address-suggestions';pop.setAttribute('popover','manual');pop.setAttribute('role','listbox');document.body.append(pop);
 let anchor=null,options=[],active=-1,serial=0,delay=null;
 function hideHints(){serial++;clearTimeout(delay);const wasOpen=pop.matches(':popover-open');if(wasOpen)pop.hidePopover();anchor?.setAttribute('aria-expanded','false');anchor?.removeAttribute('aria-activedescendant');anchor=null;options=[];active=-1;if(wasOpen)restore()}
 function bounds(){return pop.matches(':popover-open')?pop.getBoundingClientRect():null}
 function highlight(){[...pop.children].forEach((e,i)=>e.setAttribute('aria-selected',String(i===active)));if(active>=0)anchor?.setAttribute('aria-activedescendant','address-option-'+active)}
 async function choose(index){if(!anchor||!options[index])return;const input=anchor,value=options[index].value;hideHints();input.value=value;input.focus();input.form?.requestSubmit()}
 async function suggest(input){const id=++serial;const result=await N.library('suggest',{query:input.value});if(id!==serial||document.activeElement!==input)return;anchor=input;options=result;active=-1;pop.replaceChildren();if(!options.length){hideHints();return}
  const host=input.closest('dialog')||document.body;if(pop.parentElement!==host)host.append(pop);
  options.forEach((o,i)=>{const row=make('div','suggestion');row.id='address-option-'+i;row.setAttribute('role','option');row.append(make('span','suggestion-symbol',o.kind==='bookmark'?'☆':o.kind==='search'?'⌕':'↶'),make('strong','suggestion-title',o.title),make('small','suggestion-url',o.value));row.onpointerdown=e=>{e.preventDefault();void run(()=>choose(i))};pop.append(row)});
  const r=input.getBoundingClientRect(),area=(input.closest('.pane')||input.closest('dialog')||input).getBoundingClientRect(),width=Math.min(innerWidth-16,Math.max(220,area.width-8));
  pop.style.width=width+'px';pop.style.left=Math.max(8,Math.min(innerWidth-width-8,area.x+4))+'px';pop.style.top=Math.min(innerHeight-100,r.bottom+4)+'px';pop.style.maxHeight=Math.max(70,Math.min(270,innerHeight-r.bottom-40))+'px';
  if(!pop.matches(':popover-open'))pop.showPopover();input.setAttribute('aria-expanded','true');restore();
 }
 function bind(input){if(input.dataset.hints)return;input.dataset.hints='true';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls','address-suggestions');input.setAttribute('aria-expanded','false');
  input.addEventListener('input',()=>{clearTimeout(delay);delay=setTimeout(()=>run(()=>suggest(input)),90)});
  input.addEventListener('focus',()=>{clearTimeout(delay);delay=setTimeout(()=>run(()=>suggest(input)),100)});
  input.addEventListener('blur',()=>{setTimeout(()=>{if(anchor===input&&document.activeElement!==input)hideHints()},120)});
  input.addEventListener('keydown',e=>{if(anchor!==input||!pop.matches(':popover-open'))return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;highlight()}else if(e.key==='Enter'&&active>=0){e.preventDefault();void run(()=>choose(active))}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hideHints()}});
  input.form?.addEventListener('submit',()=>hideHints());
 }
 document.addEventListener('pointerdown',e=>{if(anchor&&e.target!==anchor&&!pop.contains(e.target))hideHints()});window.addEventListener('resize',hideHints);
 async function action(name){if(names[name])return open(name);if(name==='bookmark'){const t=selected();if(!t||t.internal){status(tr('Сначала откройте сайт','Open a site first'));return}await N.library('bookmark',{id:t.id});status(tr('Добавлено в закладки','Bookmark saved'));return}if(name==='reopen'){const item=await N.library('reopen');if(item)await openPage(item.url);else status(tr('Нет закрытых вкладок','No recently closed tabs'));return}}
 return{action,bind,hideHints,bounds,open,render,close:()=>{if(d.open)d.close()},isOpen:()=>d.open};
};
