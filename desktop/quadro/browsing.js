'use strict';
globalThis.createQuadroBrowsing=({N,openPage,selected,show,restore,status,locale,onSidebar})=>{
 const $=s=>document.querySelector(s),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const tr=(ru,en)=>locale()==='en'?en:ru;
 const d=make('dialog','library-dialog');d.id='library-dialog';d.dataset.nonmodal='true';d.setAttribute('aria-label','Библиотека');
 d.innerHTML='<header><strong id="library-title">История</strong><button type="button" id="library-close" aria-label="Закрыть">×</button></header><nav class="library-tabs"><button data-library="history">История</button><button data-library="searches">Поиск</button><button data-library="bookmarks">Закладки</button><button data-library="downloads">Загрузки</button></nav><div class="library-search"><input id="library-query" placeholder="Поиск в списке" autocomplete="off"><button id="library-clear">Очистить</button></div><div id="library-rows"></div><footer><span id="library-count"></span><button id="library-more" hidden>Показать ещё</button></footer>';
 document.querySelector('#workspace').append(d);let kind='history',limit=100,generation=0;
 const run=fn=>Promise.resolve().then(fn).catch(e=>status(e.message));
 const button=(label,fn,cls)=>{const b=make('button',cls,label);b.type='button';b.onclick=()=>run(fn);return b};
 const bytes=n=>!n?'0 B':n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
 const names={history:()=>tr('История','History'),searches:()=>tr('Поиск','Searches'),bookmarks:()=>tr('Закладки','Bookmarks'),downloads:()=>tr('Загрузки','Downloads')};
 async function render(){const id=++generation,query=$('#library-query').value;const parts=[];for(let offset=0;offset<limit;offset+=100)parts.push(await N.library('list',{kind,query,offset}));if(id!==generation)return;
  const list=$('#library-rows');list.replaceChildren();$('#library-title').textContent=names[kind]();d.querySelectorAll('[data-library]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.library===kind)));const rows=parts.flatMap(x=>x.items),total=parts[0]?.total||0;
  if(!rows.length)list.append(make('p','hint',tr('Пока пусто. Новые записи сохраняются на этом Mac.','Nothing here yet. New entries are stored on this Mac.')));
  let day='';for(const item of rows){
   const date=new Intl.DateTimeFormat(locale(),{year:'numeric',month:'long',day:'numeric'}).format(new Date(item.at));if(date!==day){day=date;list.append(make('h3','library-day',day))}
   const row=make('article','library-row');row.dataset.id=item.id;const body=make('div','library-body'),actions=make('div','library-actions');
   const title=item.title||item.query||item.filename||item.url;
   const label=kind==='downloads'?make('strong','library-name',title):button(title,async()=>{await openPage(item.url||item.query);restore()},'library-name');body.append(label);
   if(kind==='downloads'){
    const state={completed:tr('Готово','Complete'),paused:tr('Пауза','Paused'),progressing:tr('Скачивается','Downloading'),cancelled:tr('Отменено','Cancelled'),interrupted:tr('Прервано','Interrupted')}[item.state]||item.state;
    body.append(make('small','library-detail',state+' · '+bytes(item.received)+(item.total?' / '+bytes(item.total):'')));
    if(['progressing','paused'].includes(item.state)){const progress=make('progress');progress.max=item.total||1;progress.value=item.received||0;body.append(progress);actions.append(button(item.state==='paused'?tr('Продолжить','Resume'):tr('Пауза','Pause'),()=>N.library('download',{id:item.id,action:item.state==='paused'?'resume':'pause'})),button(tr('Отменить','Cancel'),()=>N.library('download',{id:item.id,action:'cancel'})))}
    else if(item.state==='completed')actions.append(button(tr('Открыть','Open'),()=>N.library('download',{id:item.id,action:'open'})),button('Finder',()=>N.library('download',{id:item.id,action:'show'})));
    else if(item.url)actions.append(button(tr('Повторить','Retry'),()=>N.library('download',{id:item.id,action:'retry'})));
   }else body.append(make('small','library-detail',item.url||new Intl.DateTimeFormat(locale(),{hour:'2-digit',minute:'2-digit'}).format(new Date(item.at))));
   if(!['progressing','paused'].includes(item.state))actions.append(button('×',async()=>{await N.library('remove',{kind,id:item.id});await render()},'library-remove'));
   row.append(body,actions);list.append(row);
  }
  $('#library-count').textContent=rows.length+' / '+total;$('#library-more').hidden=rows.length>=total;
 }
 async function open(value){hideHints();kind=value;limit=100;$('#library-query').value='';if(!d.open)d.show();onSidebar(true);restore();await render();$('#library-query').focus()}
 $('#library-close').onclick=()=>d.close();d.addEventListener('close',()=>{generation++;onSidebar(false);hideHints();restore()});
 d.querySelectorAll('[data-library]').forEach(b=>b.onclick=()=>run(()=>{kind=b.dataset.library;limit=100;return render()}));
 $('#library-query').oninput=()=>{limit=100;void run(render)};$('#library-more').onclick=()=>{limit+=100;void run(render)};
 $('#library-clear').onclick=()=>run(async()=>{await N.library('clear',{kind});await render()});
 N.onLibrary(()=>{if(d.open)void run(render);void N.library('list',{kind:'downloads'}).then(data=>{const count=data.items.filter(x=>['progressing','paused'].includes(x.state)).length,b=$('#downloads-button');if(b){b.dataset.active=String(count>0);b.setAttribute('aria-label',tr('Загрузки','Downloads')+(count?' · '+count:''))}})});
 const pop=make('div','address-suggestions');pop.id='address-suggestions';pop.setAttribute('popover','manual');pop.setAttribute('role','listbox');document.body.append(pop);
 let anchor=null,options=[],active=-1,serial=0,delay=null;
 function hideHints(){serial++;clearTimeout(delay);if(pop.matches(':popover-open'))pop.hidePopover();anchor?.setAttribute('aria-expanded','false');anchor?.removeAttribute('aria-activedescendant');anchor=null;options=[];active=-1;restore()}
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
