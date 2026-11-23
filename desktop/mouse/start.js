'use strict';
globalThis.createMouseStart=({N,overlays,navigate,locale,status})=>{
 const tr=(ru,en)=>locale()==='en'?en:ru;
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const roots=new Map();let data=null,generation=0,refreshTimer=0;
 const run=fn=>Promise.resolve().then(fn).catch(e=>status(e.message));
 const button=(label,fn,cls)=>{const b=make('button',cls,label);b.type='button';b.onclick=()=>run(fn);return b;};
 const edit=make('dialog','home-dialog');edit.id='start-bookmark-dialog';
 edit.innerHTML='<form id="start-bookmark-form"><header><strong id="start-bookmark-title">Закладка</strong><button type="button" class="start-close" aria-label="Закрыть">×</button></header><label>Название<input id="start-bookmark-name" maxlength="500" autocomplete="off"></label><label>Адрес сайта<input id="start-bookmark-url" maxlength="8192" autocomplete="off" spellcheck="false" placeholder="example.com" required></label><p id="start-bookmark-error" role="status" class="hint"></p><footer><button type="button" id="start-bookmark-delete" hidden>Удалить</button><span class="spacer"></span><button type="button" class="start-close">Отмена</button><button type="submit" class="primary">Сохранить</button></footer></form>';
 document.body.append(edit);let editId=null;
 edit.querySelectorAll('.start-close').forEach(b=>b.onclick=()=>edit.close());
 async function editBookmark(item){editId=item?.id||null;edit.querySelector('#start-bookmark-name').value=item?.title||'';edit.querySelector('#start-bookmark-url').value=item?.url||'';edit.querySelector('#start-bookmark-delete').hidden=!editId;edit.querySelector('#start-bookmark-error').textContent='';edit.querySelector('#start-bookmark-title').textContent=editId?tr('Изменить закладку','Edit bookmark'):tr('Добавить сайт','Add website');await overlays.show(edit);edit.querySelector(editId?'#start-bookmark-name':'#start-bookmark-url').focus();}
 edit.querySelector('form').onsubmit=e=>{e.preventDefault();run(async()=>{try{await N.start('bookmark',{id:editId,url:edit.querySelector('#start-bookmark-url').value,title:edit.querySelector('#start-bookmark-name').value});edit.close();await refresh();}catch(err){edit.querySelector('#start-bookmark-error').textContent=err.message;}});};
 edit.querySelector('#start-bookmark-delete').onclick=()=>run(async()=>{await N.start('remove',{id:editId});edit.close();await refresh();});
 const settings=make('dialog','home-dialog');settings.id='start-settings-dialog';
 settings.innerHTML='<header><strong>Новая вкладка</strong><button type="button" class="start-close" aria-label="Закрыть">×</button></header><div class="dialog-content"><p>Фон страницы</p><div class="background-presets"></div><button id="start-background-file">Выбрать своё изображение…</button><p class="hint">PNG, JPEG или WebP. Копия хранится только '+(N.platform==='win32'?'на этом компьютере':'на этом Mac')+'.</p><label class="home-recent-check"><input id="start-recent-visible" type="checkbox">Недавно посещённые сайты</label><p id="start-background-error" class="hint" role="status"></p></div>';
 document.body.append(settings);settings.querySelector('.start-close').onclick=()=>settings.close();
 const presets=[['dusk','Закат','Dusk'],['sea','Море','Sea'],['aurora','Сияние','Aurora'],['plain','Без фона','Plain']];
 for(const [key,ru,en] of presets){const b=button(ru,async()=>{await N.start('preferences',{background:key});await refresh();},'background-preset');b.dataset.background=key;b.title=en;settings.querySelector('.background-presets').append(b);}
 settings.querySelector('#start-background-file').onclick=()=>run(async()=>{try{await N.start('background');await refresh();settings.querySelector('#start-background-error').textContent='';}catch(e){settings.querySelector('#start-background-error').textContent=e.message;}});
 settings.querySelector('#start-recent-visible').onchange=e=>run(async()=>{await N.start('preferences',{showRecent:e.target.checked});await refresh();});
 async function customize(){await refresh();settings.querySelector('#start-recent-visible').checked=data.preferences.showRecent;await overlays.show(settings);}
 const searchPicker=make('dialog','choice-dialog home-search-engine-dialog');searchPicker.id='start-search-engine-dialog';searchPicker.setAttribute('aria-label',tr('Поисковик','Search engine'));document.body.append(searchPicker);
 let searchAnchor=null,searchOpening=false,searchChoosing=false;
 searchPicker.addEventListener('close',()=>{const anchor=searchAnchor;searchAnchor=null;anchor?.setAttribute('aria-expanded','false');if(anchor?.isConnected)anchor.focus();});
 searchPicker.addEventListener('click',e=>{if(e.target!==searchPicker)return;const r=searchPicker.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)searchPicker.close();});
 searchPicker.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();searchPicker.close();return;}
  const options=[...searchPicker.querySelectorAll('[data-search-engine]')],index=options.indexOf(document.activeElement);let next;
  if(e.key==='ArrowDown')next=(index+1)%options.length;else if(e.key==='ArrowUp')next=(index-1+options.length)%options.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=options.length-1;
  if(next!==undefined){e.preventDefault();options[next]?.focus();}
 });
 async function chooseSearch(anchor){
  if(searchOpening||searchPicker.open||searchChoosing)return;searchOpening=true;
  try{
   await refresh();if(!anchor.isConnected)return;searchAnchor=anchor;searchPicker.replaceChildren();searchPicker.setAttribute('aria-label',tr('Поисковик','Search engine'));
   const list=make('div','home-search-engine-list');list.setAttribute('role','listbox');list.setAttribute('aria-label',tr('Поисковик','Search engine'));searchPicker.append(list);
   for(const engine of data.search.engines){
    const option=button('',async()=>{
     if(searchChoosing)return;searchChoosing=true;const buttons=[...list.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
     try{await N.start('preferences',{searchEngine:engine.id});await refresh();if(searchPicker.open)searchPicker.close();}finally{searchChoosing=false;buttons.forEach(b=>b.disabled=false);}
    });
    option.dataset.searchEngine=engine.id;option.setAttribute('role','option');option.setAttribute('aria-selected',String(engine.id===data.search.engine));
    const check=make('span','home-search-engine-check',engine.id===data.search.engine?'✓':'');check.setAttribute('aria-hidden','true');option.append(make('span','',engine.name),check);list.append(option);
   }
   const r=anchor.getBoundingClientRect(),width=Math.min(innerWidth-24,Math.max(170,r.width)),height=Math.min(data.search.engines.length*36+12,innerHeight-24);
   searchPicker.style.width=width+'px';searchPicker.style.maxHeight=height+'px';searchPicker.style.left=Math.max(12,Math.min(innerWidth-width-12,r.right-width))+'px';searchPicker.style.top=(r.top>innerHeight/2?Math.max(12,r.top-height-6):Math.min(innerHeight-height-12,r.bottom+6))+'px';
   await overlays.show(searchPicker);anchor.setAttribute('aria-expanded','true');searchPicker.querySelector('[aria-selected="true"]')?.focus();
  }finally{searchOpening=false;}
 }
 const icons=new Map(),iconQueue=[];let running=0;
 function queueIcon(item,box){
  const initial=(new URL(item.url).hostname.replace(/^www\./,'')[0]||'').toUpperCase();box.textContent=initial;
  const apply=src=>{if(!src||!box.isConnected)return;const image=make('img');image.alt='';globalThis.MouseIcons.watch(image);image.src=src;box.replaceChildren(image);};
  if(icons.has(item.url)){icons.get(item.url).then(apply);return;}
  let resolve;const promise=new Promise(r=>resolve=r);if(icons.size>600)icons.delete(icons.keys().next().value);icons.set(item.url,promise);promise.then(apply);
  iconQueue.push(async()=>{try{resolve(await N.start('icon',{url:item.url}));}catch{resolve('');}});pump();
 }
 function pump(){while(running<3&&iconQueue.length){running++;iconQueue.shift()().finally(()=>{running--;pump();});}}
 function tile(item,pane,recent=false){
  const wrapper=make('article',recent?'recent-tile':'favorite-tile');wrapper.dataset.bookmark=item.id;
  const open=button('',()=>navigate(item.url,pane),recent?'recent-open':'favorite-open');open.title=item.url;
  const icon=make('span','home-site-icon'),label=make('span','home-site-label',item.title||new URL(item.url).hostname);queueIcon(item,icon);open.append(icon,label);wrapper.append(open);
  if(recent)open.append(make('small','home-site-host',new URL(item.url).hostname));
  else{const more=button('⋯',()=>editBookmark(item),'favorite-edit');more.title=tr('Изменить закладку','Edit bookmark');more.setAttribute('aria-label',more.title);wrapper.append(more);}
  return wrapper;
 }
 function paint(root,info,items=data?.bookmarks.items||[]){
  if(!data||!root.isConnected)return;const pref=data.preferences;if(root.dataset.background!==pref.background)root.dataset.background=pref.background;
  const background=pref.background==='custom'&&data.backgroundData?'linear-gradient(#10182c38,#10182c55),url("'+data.backgroundData+'")':'';
  if(info.background!==background){root.style.backgroundImage=background;info.background=background;}
  // Downloads and visits notify the same library. Keep existing bookmark DOM,
  // image decodes and focused controls when none of their own data changed.
  const bookmarkKey=JSON.stringify([locale(),items.map(({id,url,title})=>({id,url,title}))]);
  if(info.bookmarkKey!==bookmarkKey){
   const grid=root.querySelector('.favorites-grid');grid.replaceChildren();for(const item of items)grid.append(tile(item,info.pane));
   const add=button('',()=>editBookmark(null),'favorite-open favorite-add');add.append(make('span','home-site-icon','＋'),make('span','home-site-label',tr('Добавить сайт','Add website')));grid.append(add);info.bookmarkKey=bookmarkKey;
  }
  root.querySelector('.home-favorites-title').textContent=tr('Избранное','Favorites');root.querySelector('.home-welcome').textContent=tr('Новая вкладка','New tab');root.querySelector('.home-query').placeholder=tr('Поиск или адрес сайта','Search or enter website');
  const engineButton=root.querySelector('.home-search-engine');engineButton.disabled=!data.search;engineButton.querySelector('.home-search-engine-name').textContent=data.search?.name||'Google';engineButton.dataset.searchEngine=data.search?.engine||'google';engineButton.setAttribute('aria-label',tr('Поисковик: ','Search engine: ')+(data.search?.name||'Google'));engineButton.title=tr('Выбрать поисковик','Choose search engine');
  const more=root.querySelector('.home-more');more.hidden=items.length>=data.bookmarks.total;more.textContent=tr('Показать ещё','Show more');info.items=items;
  const recentKey=JSON.stringify([locale(),data.recent.map(({id,url,title})=>({id,url,title}))]);
  if(info.recentKey!==recentKey){const recent=root.querySelector('.recent-grid');recent.replaceChildren();for(const item of data.recent)recent.append(tile(item,info.pane,true));info.recentKey=recentKey;}
  const section=root.querySelector('.home-recent');section.hidden=!pref.showRecent||!data.recent.length;root.querySelector('.home-recent-title').textContent=tr('Недавно посещённые','Recently visited');
  root.querySelector('.home-customize').textContent=tr('⚙ Настроить страницу','⚙ Customize start page');
 }
 async function refresh(){const id=++generation;const value=await N.start('get');if(id!==generation)return;data=value;for(const [root,info] of roots){if(!root.isConnected){roots.delete(root);continue;}paint(root,info);}if(settings.open)settings.querySelector('#start-recent-visible').checked=data.preferences.showRecent;}
 function mount(slot,pane,enabled){
  let root=slot.querySelector('.home-page');const empty=slot.querySelector('.empty');
  if(!enabled){if(root){roots.delete(root);root.remove();}if(empty)empty.hidden=false;return;}
  if(empty)empty.hidden=true;if(root)return;
  root=make('section','home-page');root.setAttribute('aria-label',tr('Новая вкладка','New tab'));
  root.innerHTML='<div class="home-content"><div class="private-welcome"><div class="private-intro"><img class="private-mascot" src="mouse-private.svg" alt="Маскот в пиксельных очках"><h1 class="private-pixel-title"><img src="incognito-title.svg" alt="Инкогнито"></h1></div><p>Посещения, поиск, cookies и данные сайтов этой сессии не сохраняются в профиль. Закройте браузер или выйдите из инкогнито, чтобы очистить сессию.</p><p class="private-note">Сохранённые вами файлы, скриншоты и буфер обмена остаются. Это не анонимность перед сайтами, сетью или '+(N.platform==='win32'?'Windows':N.platform==='linux'?'Linux':'macOS')+'.</p></div><p class="home-welcome">Новая вкладка</p><div class="home-search-row"><form class="home-search"><span aria-hidden="true">⌕</span><input class="home-query" aria-label="Поиск или адрес сайта" placeholder="Поиск или адрес сайта" autocomplete="off" spellcheck="false"><button type="submit" aria-label="Открыть">→</button></form><button type="button" class="home-search-engine" aria-haspopup="listbox" aria-expanded="false" aria-controls="start-search-engine-dialog" disabled><span class="home-search-engine-name">Google</span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><section class="home-favorites"><h2 class="home-favorites-title">Избранное</h2><div class="favorites-grid"></div><button class="home-more" hidden>Показать ещё</button></section><section class="home-recent" hidden><h2 class="home-recent-title">Недавно посещённые</h2><div class="recent-grid"></div></section></div><div class="home-bottom"><button class="home-customize">⚙ Настроить страницу</button></div>';
  root.querySelector('.private-mascot').src=document.documentElement.dataset.theme==='light'?'mouse-private-light.svg':'mouse-private.svg';
  slot.append(root);const info={pane,items:[]};roots.set(root,info);
  root.querySelector('form').onsubmit=e=>{e.preventDefault();const q=root.querySelector('.home-query').value.trim();if(q)run(()=>navigate(q,pane));};root.querySelector('.home-customize').onclick=()=>run(customize);
  const searchButton=root.querySelector('.home-search-engine');searchButton.onclick=()=>run(()=>chooseSearch(searchButton));searchButton.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();void run(()=>chooseSearch(searchButton));}};
  root.querySelector('.home-more').onclick=()=>run(async()=>{const result=await N.start('get',{offset:info.items.length});paint(root,info,[...info.items,...result.bookmarks.items]);});
  if(data)paint(root,info);else void run(refresh);
 }
 const later=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>run(refresh),100);};N.onStart(later);N.onLibrary(later);
 return{mount,refresh,customize,editBookmark};
};
