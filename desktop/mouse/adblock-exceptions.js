'use strict';
(function(root){
 const COPY={
  ru:{title:'Исключения сайтов',description:'На этих сайтах блокировка рекламы отключена.',scope:'Сохраняется только имя сайта: все страницы и порты. Поддомены, включая www, добавляются отдельно.',url:'Адрес сайта',placeholder:'example.com или https://example.com/страница',add:'Добавить',tab:'Из открытых вкладок',choose:'Выберите вкладку',noTabs:'Нет открытых сайтов',addTab:'Добавить сайт',empty:'Исключений пока нет.',remove:'Удалить',private:'В инкогнито список только для просмотра.',off:'Общий AdBlock выключен. Исключения сохранены.',saved:'Исключение сохранено. Обновите страницу, чтобы применить его ко всему содержимому.',removed:'Исключение удалено. Обновите страницу, чтобы применить блокировку ко всему содержимому.',unavailable:'Не удалось загрузить исключения сайтов.',saving:'Сохраняем…'},
  en:{title:'Site exceptions',description:'Ad blocking is disabled on these websites.',scope:'Only the hostname is saved: all pages and ports. Add subdomains, including www, separately.',url:'Website address',placeholder:'example.com or https://example.com/page',add:'Add',tab:'From open tabs',choose:'Choose a tab',noTabs:'No open websites',addTab:'Add website',empty:'No site exceptions yet.',remove:'Remove',private:'In incognito, this list is read-only.',off:'AdBlock is off globally. Your exceptions are saved.',saved:'Exception saved. Reload the page to apply it to all content.',removed:'Exception removed. Reload the page to apply blocking to all content.',unavailable:'Could not load site exceptions.',saving:'Saving…'}
 };
 const ERRORS={
  'MOUSE_ADBLOCK_SITE_INVALID':'Enter an HTTP or HTTPS website address without a username or password.',
  'MOUSE_ADBLOCK_SITE_PRIVATE':'Site exceptions can only be changed in normal mode.',
  'MOUSE_ADBLOCK_SITE_CHANGED':'The page changed. Open the menu or select the tab again.',
  'MOUSE_ADBLOCK_SITE_LIMIT':'The site exception limit has been reached.'
 };
 function createMouseAdBlockExceptions({N,model:m,container,status=()=>{},document:doc=root.document}){
  if(!container||!N.adBlockExceptions)return{sync(){},refresh:async()=>{},dispose(){}};
  const make=(tag,id='',className='')=>{const element=doc.createElement(tag);if(id)element.id=id;if(className)element.className=className;return element;};
  const section=make('section','settings-adblock-exceptions','settings-adblock-exceptions'),heading=make('div','','adblock-exceptions-heading'),title=make('h4'),count=make('span','','adblock-exceptions-count'),description=make('p'),scope=make('p','settings-adblock-exception-scope','adblock-exceptions-scope');
  const form=make('form','','adblock-exceptions-form'),urlLabel=make('label'),urlRow=make('div','','adblock-exceptions-entry'),url=make('input','settings-adblock-exception-url'),add=make('button','settings-adblock-exception-add');
  url.type='text';url.maxLength=8192;url.autocomplete='off';url.spellcheck=false;url.setAttribute('autocapitalize','none');url.setAttribute('aria-describedby',scope.id);urlLabel.htmlFor=url.id;add.type='submit';urlRow.append(url,add);form.append(urlLabel,urlRow);
  const tabLabel=make('label'),tabRow=make('div','','adblock-exceptions-entry'),tabs=make('select','settings-adblock-exception-tab'),addTab=make('button','settings-adblock-exception-add-tab');tabLabel.htmlFor=tabs.id;addTab.type='button';tabRow.append(tabs,addTab);
  const note=make('p','settings-adblock-exception-note','adblock-exceptions-note'),list=make('ul','settings-adblock-exception-list'),empty=make('p','settings-adblock-exception-empty'),message=make('p','settings-adblock-exception-message','adblock-exceptions-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.hidden=true;
  heading.append(title,count);section.append(heading,description,scope,form,tabLabel,tabRow,note,list,empty,message);container.append(section);
  let disposed=false,busy=false,readSerial=0,timer=null,lastTabsKey='',state={hosts:[],tabs:[],revision:-1,privateMode:false,enabled:false},notice='',errorText='';
  const copy=()=>COPY[m.locale==='en'?'en':'ru'],readOnly=()=>!!m.privateMode||state.privateMode===true;
  const showMessage=()=>{const text=errorText||(busy?copy().saving:notice?copy()[notice]:'');message.textContent=text;message.hidden=!text;message.dataset.error=String(!!errorText);message.setAttribute('role',errorText?'alert':'status');};
  function controls(){const locked=disposed||busy||readOnly();url.disabled=locked;add.disabled=locked||!url.value.trim();tabs.disabled=locked||!state.tabs.length;addTab.disabled=locked||!state.tabs.some(row=>row.id===tabs.value);for(const button of list.querySelectorAll('button'))button.disabled=locked;section.setAttribute('aria-busy',String(busy));showMessage();}
  function sync(){
   if(disposed)return;const c=copy();title.textContent=c.title;count.textContent=String(state.hosts.length);description.textContent=c.description;scope.textContent=c.scope;urlLabel.textContent=c.url;url.placeholder=c.placeholder;url.setAttribute('aria-label',c.url);add.textContent=c.add;tabLabel.textContent=c.tab;tabs.setAttribute('aria-label',c.tab);addTab.textContent=c.addTab;
   const selection=tabs.value,options=state.tabs.map(row=>{const option=make('option');option.value=row.id;option.textContent=row.host+(row.title&&row.title!==row.host?' · '+row.title:'');return option;}),placeholder=make('option');placeholder.value='';placeholder.textContent=state.tabs.length?c.choose:c.noTabs;tabs.replaceChildren(placeholder,...options);tabs.value=state.tabs.some(row=>row.id===selection)?selection:'';
   list.replaceChildren();for(const host of state.hosts){const row=make('li'),name=make('code'),remove=make('button');row.dataset.adblockHost=host;name.textContent=host;remove.type='button';remove.dataset.adblockRemove=host;remove.textContent=c.remove;remove.setAttribute('aria-label',c.remove+' '+host);remove.onclick=()=>run('remove',{host},'removed');row.append(name,remove);list.append(row);}
   list.hidden=!state.hosts.length;empty.hidden=!!state.hosts.length;empty.textContent=c.empty;
   const globalEnabled=typeof m.controlSettings?.blockAds==='boolean'?m.controlSettings.blockAds:state.enabled;note.textContent=readOnly()?c.private:!globalEnabled?c.off:'';note.hidden=!note.textContent;controls();
  }
  function accept(value){
   if(disposed||!value||!Array.isArray(value.hosts)||!Number.isInteger(value.revision)||value.revision<state.revision)return false;
   state={...state,...value,hosts:value.hosts.filter(host=>typeof host==='string'),tabs:Array.isArray(value.tabs)?value.tabs.filter(row=>typeof row?.id==='string'&&typeof row.host==='string'):state.tabs};sync();return true;
  }
  const report=error=>{errorText=m.locale==='en'&&ERRORS[error?.code]?ERRORS[error.code]:String(error?.message||copy().unavailable);showMessage();status(errorText);};
  async function refresh(){
   if(disposed)return;const ticket=++readSerial;
   try{const value=await N.adBlockExceptions('state');if(ticket===readSerial)accept(value);}
   catch(error){if(!disposed&&ticket===readSerial)report(error);}
  }
  async function run(action,args,success){
   if(disposed||busy||readOnly())return false;busy=true;notice='';errorText='';controls();
   try{const value=await N.adBlockExceptions(action,args);if(disposed)return false;accept(value);notice=success;if(action==='add')url.value='';return true;}
   catch(error){if(!disposed)report(error);return false;}
   finally{busy=false;if(!disposed)controls();}
  }
  url.oninput=controls;tabs.onchange=controls;form.onsubmit=event=>{event.preventDefault();if(!url.value.trim())return false;return run('add',{url:url.value},'saved');};
  addTab.onclick=()=>{const target=state.tabs.find(row=>row.id===tabs.value);if(!target)return false;return run('add-tab',{tabId:target.id,host:target.host},'saved');};
  const unsubscribe=N.onAdBlockExceptions?.(value=>{readSerial++;accept(value);if(m.settingsOpen)void refresh();});
  const unsubscribeTabs=N.onState?.(value=>{if(!m.settingsOpen||disposed)return;const key=JSON.stringify((value?.tabs||[]).map(row=>[row.id,row.url]));if(key===lastTabsKey)return;lastTabsKey=key;clearTimeout(timer);timer=setTimeout(()=>{timer=null;void refresh();},80);});
  sync();
  return{sync,refresh,get state(){return{...state,hosts:[...state.hosts],tabs:state.tabs.map(row=>({...row}))};},dispose(){if(disposed)return;disposed=true;readSerial++;clearTimeout(timer);unsubscribe?.();unsubscribeTabs?.();section.remove();}};
 }
 if(typeof module==='object'&&module.exports)module.exports={createMouseAdBlockExceptions};else root.createMouseAdBlockExceptions=createMouseAdBlockExceptions;
})(globalThis);
