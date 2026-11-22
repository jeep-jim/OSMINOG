'use strict';
const MOUSE_LANGUAGE_CODES='ru en sq am ar hy bn bs bg my ca zh-Hans zh-Hant hr cs da nl et fi fr ka de el gu hi hu is id it ja kn kk ko lv lt mk ms ml mr mn nb fa pl pt-BR pt-PT pa ro sr sk sl so es sw sv fil ta te th tr uk ur vi he uz az af eu gl km lo ne si'.split(' ');
const MOUSE_LIVE_LANGUAGES=new Set(['ru','en']);
let mouseLanguageCatalog;
function mouseInterfaceLanguages(){
 if(mouseLanguageCatalog)return mouseLanguageCatalog;
 const english=new Intl.DisplayNames(['en'],{type:'language'}),russian=new Intl.DisplayNames(['ru'],{type:'language'});
 const labelOverrides={'zh-Hans':'简体中文','zh-Hant':'繁體中文','pt-BR':'Português (Brasil)','pt-PT':'Português (Portugal)','fil':'Filipino / Tagalog'};
 mouseLanguageCatalog=Object.freeze(MOUSE_LANGUAGE_CODES.map(code=>Object.freeze({
  code,label:labelOverrides[code]||new Intl.DisplayNames([code],{type:'language'}).of(code),
  english:english.of(code),russian:russian.of(code),available:MOUSE_LIVE_LANGUAGES.has(code)
 })));
 return mouseLanguageCatalog;
}
function mouseLanguageSearch(value){
 const q=value.trim().toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
 return mouseInterfaceLanguages().filter(x=>(x.label+' '+x.english+' '+x.russian+' '+x.code).toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu,'').includes(q));
}
if(typeof module==='object'&&module.exports)module.exports={mouseInterfaceLanguages,mouseLanguageSearch};
globalThis.createMouseOverlays=({N,restore,error,prepare})=>{
 const held=new Set();let sequence=0,last=false;
 const active=()=>held.size>0||!!document.querySelector('dialog[open]:not([data-nonmodal])');
 function publish(force=false){const blocked=active();if(!force&&blocked===last)return Promise.resolve();last=blocked;return N.overlay({sequence:++sequence,blocked}).catch(e=>{error(e.message);throw e;});}
 function reconcile(){const wasBlocked=last;return publish().then(()=>{if(wasBlocked&&!active())restore();});}
 function bind(d){if(d.dataset.overlayBound)return;d.dataset.overlayBound='true';
  d.addEventListener('close',()=>{held.delete(d);void reconcile().catch(()=>{});});
 }
 async function show(d){
  if(prepare)await prepare();
  bind(d);held.add(d);
  try{await publish(true);if(!d.open)d.showModal();d.querySelector('input,button,[tabindex]')?.focus();}
  catch(e){held.delete(d);if(d.open)d.close();await publish(true).catch(()=>{});restore();throw e;}
 }
 // Cover direct showModal(), newly inserted/nested dialogs and removal without
 // close(). Page titles, loading labels and progress text are not modal state:
 // their childList notifications must not trigger another native layout.
 const isDialog=node=>node?.nodeType===1&&(node.localName==='dialog'||node.tagName==='DIALOG');
 const observer=new MutationObserver(records=>{
  const changed=new Set(),closed=new Set(),collect=node=>{if(node.nodeType!==1)return;if(isDialog(node))changed.add(node);for(const dialog of node.querySelectorAll('dialog'))changed.add(dialog);};
  for(const record of records){if(record.type==='attributes'){if(isDialog(record.target)){changed.add(record.target);if(!record.target.open)closed.add(record.target);}}else{for(const node of record.addedNodes)collect(node);for(const node of record.removedNodes)collect(node);}}
  if(!changed.size)return;
  // A newly appended dialog may still be awaiting show()'s native hide ACK.
  // Only an actual open-attribute removal (or detachment) releases that hold.
  for(const dialog of changed){if(dialog.isConnected)bind(dialog);if(!dialog.isConnected||closed.has(dialog))held.delete(dialog);}
  void reconcile().catch(()=>{});
 });
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 document.querySelectorAll('dialog').forEach(bind);
 // Native HTML select popups may be obscured by native pages. Use one accessible
 // compact glass chooser through the same modal barrier, not a separate UI system.
 let chooserOpening=false;
 const chooser=document.createElement('dialog');chooser.id='choice-dialog';chooser.className='choice-dialog';chooser.setAttribute('aria-label','Выберите вариант');document.body.append(chooser);
 let anchor=null;
 chooser.addEventListener('close',()=>{anchor?.focus();anchor=null;});
 chooser.addEventListener('click',e=>{if(e.target===chooser){const r=chooser.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)chooser.close();}});
 chooser.addEventListener('keydown',e=>{
  // A search input otherwise consumes Escape to clear its query. The chooser
  // owns dismissal, and the same key must not reach the workspace after close.
  if(e.key==='Escape'&&!e.isComposing&&!e.defaultPrevented){e.preventDefault();e.stopPropagation();chooser.close();return;}
  const buttons=[...chooser.querySelectorAll('button')];const i=buttons.indexOf(document.activeElement);if(buttons.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();buttons[i<0?(e.key==='ArrowDown'?0:buttons.length-1):(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
 });
 function languageOptions(select){
  const en=document.documentElement.lang==='en',copy=en?{title:'Interface language',find:'Find a language',available:'Available now',planned:'Planned languages',note:'Only Russian and English are translated now.',empty:'No languages found'}:{title:'Язык интерфейса',find:'Найти язык',available:'Доступны сейчас',planned:'В планах',note:'Сейчас переведены только русский и английский.',empty:'Ничего не найдено'};
  const make=(tag,cls,label)=>{const el=document.createElement(tag);el.className=cls;if(label)el.textContent=label;return el;};
  chooser.setAttribute('aria-label',copy.title);
  const lead=make('div','language-chooser-head'),search=make('input','language-chooser-search'),list=make('div','language-chooser-list');
  search.type='search';search.autocomplete='off';search.placeholder=copy.find;search.setAttribute('aria-label',copy.find);
  lead.append(make('strong','language-chooser-title',copy.title),search);chooser.append(lead,list,make('p','language-chooser-note',copy.note));
  const render=()=>{
   list.replaceChildren();const rows=mouseLanguageSearch(search.value);
   for(const [enabled,title] of [[true,copy.available],[false,copy.planned]]){
    const group=rows.filter(x=>x.available===enabled);if(!group.length)continue;
    list.append(make('div','language-chooser-group',title));
    for(const item of group){
     const row=make(enabled?'button':'div','language-chooser-row'),label=make('bdi','language-chooser-label',item.label);
     label.lang=item.code;row.append(label,make('span','language-chooser-code',item.code.toUpperCase()));
     if(enabled){
      row.type='button';const current=select.value===item.code;row.setAttribute('aria-pressed',String(current));
      const check=make('span','language-chooser-check',current?'✓':'');check.setAttribute('aria-hidden','true');row.append(check);
      row.onclick=()=>{select.value=item.code;chooser.close();select.dispatchEvent(new Event('change',{bubbles:true}));};
     }
     list.append(row);
    }
   }
   if(!rows.length)list.append(make('p','language-chooser-empty',copy.empty));
  };search.addEventListener('input',render);render();return search;
 }
 async function choose(select){
  if(select.disabled||chooser.open||chooserOpening)return;chooserOpening=true;
  try{
  anchor=select;chooser.dataset.select=select.id;chooser.replaceChildren();
  const languages=['language-select','settings-language'].includes(select.id);
  chooser.classList.toggle('language-chooser',languages);
  chooser.setAttribute('aria-label',select.getAttribute('aria-label')||(document.documentElement.lang==='en'?'Choose an option':'Выберите вариант'));
  const search=languages?languageOptions(select):null;
  if(!languages)for(const option of select.options){if(option.hidden)continue;const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.disabled=option.disabled;b.dataset.value=option.value;b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));
   if(select.id==='ai-select'){b.classList.add('provider-option');const text=document.createElement('span');text.textContent=option.textContent;text.className='provider-label';b.replaceChildren();const icon=document.createElement('img');icon.className='favicon';icon.alt='';icon.src='globe.svg';const check=document.createElement('span');check.className='provider-check';check.setAttribute('aria-hidden','true');check.textContent=option.selected?'✓':'';b.append(icon,text);b.append(check);globalThis.MouseAIIcons?.apply(icon,option.value);}
   b.onclick=()=>{select.value=option.value;chooser.close();select.dispatchEvent(new Event('change',{bubbles:true}));};chooser.append(b);
  }
  const r=select.getBoundingClientRect(),width=Math.min(innerWidth-24,Math.max(languages?330:160,r.width)),height=Math.min(languages?430:320,languages?430:chooser.children.length*32+12,innerHeight-24);
  chooser.style.width=width+'px';chooser.style.maxHeight=height+'px';chooser.style.left=Math.max(12,Math.min(innerWidth-width-12,r.left))+'px';chooser.style.top=(r.top>innerHeight/2?Math.max(12,r.top-height-5):Math.min(innerHeight-height-12,r.bottom+5))+'px';
  await show(chooser);(search||chooser.querySelector('[aria-selected=true]'))?.focus();
  }finally{chooserOpening=false;}
 }
 document.addEventListener('pointerdown',e=>{if(e.button===0&&e.target instanceof HTMLSelectElement){e.preventDefault();void choose(e.target).catch(e=>error(e.message));}},true);
 document.addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement&&[' ','Enter','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();void choose(e.target).catch(e=>error(e.message));}},true);
 return{show,active,choose,sync:()=>publish(true)};
};
