'use strict';
globalThis.createQuadroStart=({N,overlays,navigate,locale,status})=>{
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
 settings.innerHTML='<header><strong>Новая вкладка</strong><button type="button" class="start-close" aria-label="Закрыть">×</button></header><div class="dialog-content"><p>Фон страницы</p><div class="background-presets"></div><button id="start-background-file">Выбрать своё изображение…</button><p class="hint">PNG, JPEG или WebP. Копия хранится только на этом Mac.</p><label class="home-recent-check"><input id="start-recent-visible" type="checkbox">Недавно посещённые сайты</label><p id="start-background-error" class="hint" role="status"></p></div>';
 document.body.append(settings);settings.querySelector('.start-close').onclick=()=>settings.close();
 const presets=[['dusk','Закат','Dusk'],['sea','Море','Sea'],['aurora','Сияние','Aurora'],['plain','Без фона','Plain']];
 for(const [key,ru,en] of presets){const b=button(ru,async()=>{await N.start('preferences',{background:key});await refresh();},'background-preset');b.dataset.background=key;b.title=en;settings.querySelector('.background-presets').append(b);}
 settings.querySelector('#start-background-file').onclick=()=>run(async()=>{try{await N.start('background');await refresh();settings.querySelector('#start-background-error').textContent='';}catch(e){settings.querySelector('#start-background-error').textContent=e.message;}});
 settings.querySelector('#start-recent-visible').onchange=e=>run(async()=>{await N.start('preferences',{showRecent:e.target.checked});await refresh();});
 async function customize(){await refresh();settings.querySelector('#start-recent-visible').checked=data.preferences.showRecent;await overlays.show(settings);}
 const icons=new Map(),iconQueue=[];let running=0;
 function queueIcon(item,box){
  const initial=(new URL(item.url).hostname.replace(/^www\./,'')[0]||'').toUpperCase();box.textContent=initial;
  const apply=src=>{if(!src||!box.isConnected)return;const image=make('img');image.alt='';globalThis.QuadroIcons.watch(image);image.src=src;box.replaceChildren(image);};
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
  if(!data||!root.isConnected)return;const pref=data.preferences;root.dataset.background=pref.background;
  root.style.backgroundImage=pref.background==='custom'&&data.backgroundData?'linear-gradient(#10182c38,#10182c55),url("'+data.backgroundData+'")':'';
  const grid=root.querySelector('.favorites-grid');grid.replaceChildren();for(const item of items)grid.append(tile(item,info.pane));
  const add=button('',()=>editBookmark(null),'favorite-open favorite-add');add.append(make('span','home-site-icon','＋'),make('span','home-site-label',tr('Добавить сайт','Add website')));grid.append(add);
  root.querySelector('.home-favorites-title').textContent=tr('Избранное','Favorites');root.querySelector('.home-welcome').textContent=tr('Новая вкладка','New tab');root.querySelector('.home-query').placeholder=tr('Поиск или адрес сайта','Search or enter website');
  const more=root.querySelector('.home-more');more.hidden=items.length>=data.bookmarks.total;more.textContent=tr('Показать ещё','Show more');info.items=items;
  const recent=root.querySelector('.recent-grid');recent.replaceChildren();for(const item of data.recent)recent.append(tile(item,info.pane,true));
  const section=root.querySelector('.home-recent');section.hidden=!pref.showRecent||!data.recent.length;root.querySelector('.home-recent-title').textContent=tr('Недавно посещённые','Recently visited');
  root.querySelector('.home-customize').textContent=tr('⚙ Настроить страницу','⚙ Customize start page');
 }
 async function refresh(){const id=++generation;const value=await N.start('get');if(id!==generation)return;data=value;for(const [root,info] of roots){if(!root.isConnected){roots.delete(root);continue;}paint(root,info);}if(settings.open)settings.querySelector('#start-recent-visible').checked=data.preferences.showRecent;}
 function mount(slot,pane,enabled){
  let root=slot.querySelector('.home-page');const empty=slot.querySelector('.empty');
  if(!enabled){if(root){roots.delete(root);root.remove();}if(empty)empty.hidden=false;return;}
  if(empty)empty.hidden=true;if(root)return;
  root=make('section','home-page');root.setAttribute('aria-label',tr('Новая вкладка','New tab'));
  root.innerHTML='<div class="home-content"><p class="home-welcome">Новая вкладка</p><form class="home-search"><span aria-hidden="true">⌕</span><input class="home-query" aria-label="Поиск или адрес сайта" placeholder="Поиск или адрес сайта" autocomplete="off" spellcheck="false"><button type="submit" aria-label="Открыть">→</button></form><section class="home-favorites"><h2 class="home-favorites-title">Избранное</h2><div class="favorites-grid"></div><button class="home-more" hidden>Показать ещё</button></section><section class="home-recent" hidden><h2 class="home-recent-title">Недавно посещённые</h2><div class="recent-grid"></div></section></div><div class="home-bottom"><button class="home-customize">⚙ Настроить страницу</button></div>';
  slot.append(root);const info={pane,items:[]};roots.set(root,info);
  root.querySelector('form').onsubmit=e=>{e.preventDefault();const q=root.querySelector('input').value.trim();if(q)run(()=>navigate(q,pane));};root.querySelector('.home-customize').onclick=()=>run(customize);
  root.querySelector('.home-more').onclick=()=>run(async()=>{const result=await N.start('get',{offset:info.items.length});paint(root,info,[...info.items,...result.bookmarks.items]);});
  if(data)paint(root,info);else void run(refresh);
 }
 const later=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>run(refresh),100);};N.onStart(later);N.onLibrary(later);
 return{mount,refresh,customize,editBookmark};
};
