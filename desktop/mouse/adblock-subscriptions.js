'use strict';
(function(root){
 const COPY={
  ru:{title:'Списки сетевых фильтров',description:'Правила проверяются на устройстве. Включённые списки обновляются автоматически каждые 12 часов, пока работает Mouse.',scope:'При сбое остаётся последняя рабочая копия. Встроенные списки доступны и без интернета. Изменения применяются к новым запросам; открытую страницу при необходимости обновите.',refresh:'Обновить списки',refreshing:'Проверяем списки…',url:'URL подписки',placeholder:'https://example.com/filters.txt',add:'Добавить список',remove:'Удалить',enabled:'Использовать список',custom:'Пользовательский список',builtin:'Встроенная подписка',license:'Лицензия',source:'Источник',updated:'Правила получены',checked:'Последняя проверка',never:'Ещё не проверялся',bundled:'Резервная копия из приложения',cache:'Сохранённая копия',none:'Правил пока нет',rules:'Сетевых правил',off:'Блокировка выключена. Настройки списков сохранены; загрузка возобновится после включения.',private:'В инкогнито списки доступны только для просмотра.',privacy:'Подписка скачивается с указанного адреса без cookies и истории посещений. Добавляйте источники, которым доверяете.',saved:'Список сохранён.',removed:'Список удалён.',changed:'Настройка списка сохранена.',refreshed:'Проверка завершена. Результат показан у каждого списка.',error:'Не удалось выполнить действие.',loading:'Загрузка…',ready:'Готов',fallback:'Работает резервная копия',failed:'Обновление не удалось',disabled:'Выключен',stale:'Используется предыдущая копия'},
  en:{title:'Network filter lists',description:'Requests are checked on your device. Enabled lists update automatically every 12 hours while Mouse is running.',scope:'If an update fails, the last working copy remains active. Bundled lists are also available offline. Changes affect new requests; reload an open page if needed.',refresh:'Update lists',refreshing:'Checking lists…',url:'Subscription URL',placeholder:'https://example.com/filters.txt',add:'Add list',remove:'Remove',enabled:'Use this list',custom:'Custom list',builtin:'Built-in subscription',license:'License',source:'Source',updated:'Rules downloaded',checked:'Last checked',never:'Not checked yet',bundled:'Copy bundled with Mouse',cache:'Saved copy',none:'No rules yet',rules:'Network rules',off:'Ad blocking is off. List settings are saved; downloads resume when enabled.',private:'In incognito, filter lists are read-only.',privacy:'The subscription is downloaded from its URL without cookies or browsing history. Add sources you trust.',saved:'List saved.',removed:'List removed.',changed:'List setting saved.',refreshed:'Check complete. Each list shows its result.',error:'Could not complete this action.',loading:'Loading…',ready:'Ready',fallback:'Bundled copy is active',failed:'Update failed',disabled:'Off',stale:'Using the previous copy'}
 };
 Object.assign(COPY.ru,{checked:'Последняя успешная проверка',working:'Сохраняем…',paused:'Приостановлен',empty:'Нет поддерживаемых сетевых правил',unavailable:'Статус недоступен'});
 Object.assign(COPY.en,{checked:'Last successful check',working:'Saving…',paused:'Paused',empty:'No supported network rules',unavailable:'Status unavailable'});
 function createMouseAdBlockSubscriptions({N,model:m,container,status=()=>{},document:doc=root.document}){
  if(!container||!N.adBlockSubscriptions)return{sync(){},refresh:async()=>{},accept(){},dispose(){}};
  const make=(tag,id='',className='')=>{const node=doc.createElement(tag);if(id)node.id=id;if(className)node.className=className;return node;};
  const section=make('section','settings-adblock-subscriptions','adblock-subscriptions'),title=make('h3'),description=make('p'),scope=make('p','','hint'),toolbar=make('div','','dialog-actions'),update=make('button','settings-filter-refresh'),list=make('ul','settings-filter-lists');
  const form=make('form','','filter-subscription-form'),label=make('label'),row=make('div','','filter-subscription-entry'),url=make('input','settings-filter-url'),add=make('button','settings-filter-add'),privacy=make('p','','hint'),note=make('p','settings-filter-note','hint'),message=make('p','settings-filter-message');
  update.type='button';add.type='submit';url.type='url';url.maxLength=2048;url.autocomplete='off';url.spellcheck=false;url.setAttribute('autocapitalize','none');label.htmlFor=url.id;message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.hidden=true;
  toolbar.append(update);row.append(url,add);form.append(label,row,privacy);section.append(title,description,scope,toolbar,list,form,note,message);container.append(section);
  let state={enabled:false,subscriptions:[],revision:-1},busy=false,busyAction='',disposed=false,serial=0,notice='',error='',pendingFocus=null;
  const copy=()=>COPY[m.locale==='en'?'en':'ru'],readOnly=()=>!!m.privateMode||state.privateMode===true;
  const updating=()=>state.phase==='loading'||state.refreshing===true;
  const rows=new Map(),text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  const focusedControl=()=>{const active=doc.activeElement;return active?.dataset?.filterToggle?{tag:'input',key:'filterToggle',id:active.dataset.filterToggle}:active?.dataset?.filterRemove?{tag:'button',key:'filterRemove',id:active.dataset.filterRemove}:null;};
  const date=value=>{const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toLocaleString(m.locale==='en'?'en-GB':'ru-RU'):copy().never;};
  const messageState=()=>{message.textContent=error||(busy?copy()[busyAction==='refresh'?'refreshing':'working']:notice?copy()[notice]:'');message.hidden=!message.textContent;message.dataset.error=String(!!error);message.setAttribute('role',error?'alert':'status');};
  function controls(){
   const locked=disposed||busy||readOnly();url.disabled=locked;add.disabled=locked||!url.value.trim();update.disabled=locked||!state.enabled||updating();
   for(const input of list.querySelectorAll('input'))input.disabled=locked;for(const button of list.querySelectorAll('button'))button.disabled=locked;
   section.setAttribute('aria-busy',String(busy));messageState();
  }
  function sync(){
   if(disposed)return;const c=copy();title.textContent=c.title;description.textContent=c.description;scope.textContent=c.scope;update.textContent=busyAction==='refresh'||updating()?c.refreshing:c.refresh;label.textContent=c.url;url.placeholder=c.placeholder;url.setAttribute('aria-label',c.url);add.textContent=c.add;privacy.textContent=c.privacy;
   const focus=focusedControl(),active=doc.activeElement;if(focus)pendingFocus=focus;else if(active&&active!==doc.body&&active!==doc.documentElement&&!list.contains(active))pendingFocus=null;
   const ids=new Set(state.subscriptions.map(item=>item.id));for(const [id,row]of rows)if(!ids.has(id)){row.li.remove();rows.delete(id);}
   for(const [index,item]of state.subscriptions.entries()){
    let row=rows.get(item.id);
    if(!row){
     const li=make('li'),heading=make('label','','filter-list-heading'),toggle=make('input'),name=make('strong'),meta=make('small','','filter-list-source'),details=make('p','','filter-list-status'),attribution=make('small','','filter-list-attribution');
     li.dataset.filterId=item.id;toggle.type='checkbox';toggle.dataset.filterToggle=item.id;toggle.onchange=()=>run('toggle',{id:item.id,enabled:toggle.checked},'changed');heading.append(toggle,name);li.append(heading,meta,details,attribution);
     row={li,toggle,name,meta,details,attribution,remove:null};rows.set(item.id,row);
    }
    const {li,toggle,name,meta,details,attribution}=row;
    if(list.children[index]!==li)list.insertBefore(li,list.children[index]||null);
    if(toggle.checked!==(item.enabled===true))toggle.checked=item.enabled===true;toggle.setAttribute('aria-label',c.enabled+' '+(item.name||c.custom));text(name,item.name||c.custom);
    text(meta,(item.builtin?c.builtin:c.custom)+' · '+item.url);
    const origin=c[item.origin]||c.none,phases={disabled:c.disabled,off:c.paused,loading:c.loading,stale:c.stale,error:c.failed,ready:c.ready,bundled:c.fallback,empty:c.empty},phase=item.enabled===false?c.disabled:phases[item.phase]||c.unavailable;
    details.textContent=phase+' · '+origin+' · '+c.rules+': '+(Number.isSafeInteger(item.ruleCount)?item.ruleCount:0)+'\n'+c.checked+': '+date(item.checkedAt)+(item.updatedAt?'\n'+c.updated+': '+date(item.updatedAt):'');
    if(item.lastError){const failed=make('span','','filter-list-error');failed.textContent='\n'+String(item.lastError);details.append(failed);}
    text(attribution,[item.authors,item.homepage,item.license].filter(value=>typeof value==='string').join(' · '));attribution.hidden=!attribution.textContent;
    if(!item.builtin){if(!row.remove){row.remove=make('button');row.remove.type='button';row.remove.dataset.filterRemove=item.id;row.remove.onclick=()=>run('remove',{id:item.id},'removed');li.append(row.remove);}text(row.remove,c.remove);row.remove.setAttribute('aria-label',c.remove+' '+(item.name||c.custom));}
    else if(row.remove){row.remove.remove();row.remove=null;}
   }
   note.textContent=readOnly()?c.private:!state.enabled?c.off:'';note.hidden=!note.textContent;controls();
   if(!busy&&pendingFocus){const target=[...list.querySelectorAll(pendingFocus.tag)].find(node=>node.dataset[pendingFocus.key]===pendingFocus.id)||url;if(!target.disabled)target.focus?.({preventScroll:true});pendingFocus=null;}
  }
  function accept(value){if(disposed||!value||typeof value.enabled!=='boolean'||!Array.isArray(value.subscriptions)||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision<state.revision)return false;state={...value,subscriptions:value.subscriptions.filter(item=>item&&typeof item.id==='string'&&typeof item.url==='string').map(item=>({...item}))};sync();return true;}
  function report(reason){error=String(reason?.message||copy().error);messageState();status(error);}
  async function refresh(){if(disposed||busy)return false;const ticket=++serial;try{const value=await N.adBlockSubscriptions('state');if(ticket===serial)accept(value);}catch(reason){if(ticket===serial&&!disposed)report(reason);}}
  async function run(action,args,success){
   if(disposed||busy||readOnly()||action==='refresh'&&(!state.enabled||updating()))return false;pendingFocus=focusedControl();busy=true;busyAction=action;notice='';error='';serial++;controls();
   try{const value=await N.adBlockSubscriptions(action,args);if(disposed)return false;accept(value);notice=success;if(action==='add')url.value='';return true;}
   catch(reason){if(!disposed)report(reason);return false;}
   finally{busy=false;busyAction='';if(!disposed)sync();}
  }
  url.oninput=controls;form.onsubmit=event=>{event.preventDefault();return url.value.trim()?run('add',{url:url.value.trim()},'saved'):false;};update.onclick=()=>state.enabled?run('refresh',{},'refreshed'):false;
  const unsubscribe=N.onAdBlockState?.(value=>{if(accept(value))serial++;});sync();
  return{sync,refresh,accept,get state(){return structuredClone(state);},dispose(){disposed=true;serial++;unsubscribe?.();section.remove();}};
 }
 if(typeof module==='object'&&module.exports)module.exports={createMouseAdBlockSubscriptions};else root.createMouseAdBlockSubscriptions=createMouseAdBlockSubscriptions;
})(globalThis);
