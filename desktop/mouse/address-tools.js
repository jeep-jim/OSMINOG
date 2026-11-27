'use strict';
(function(root){
 function webAddress(value){try{const url=new URL(String(value||''));return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
 function entries(desktops,history=[],query=''){
  const result=[],seen=new Set(),needle=String(query||'').trim().toLocaleLowerCase();
  const matches=row=>!needle||[row.title,row.url,row.deskName].some(value=>String(value||'').toLocaleLowerCase().includes(needle));
  for(const desk of desktops?.items||[])for(const tab of desk.tabs||[]){
   const url=webAddress(tab.url);if(tab.internal||!url)continue;seen.add(url);
   const row={kind:'open',id:tab.id,desk:desk.id,deskName:desk.name||'',title:tab.title||new URL(url).hostname,url};
   if(matches(row))result.push(row);
  }
  for(const item of history){const url=webAddress(item.url);if(!url||seen.has(url))continue;seen.add(url);const row={kind:'history',id:item.id,title:item.title||new URL(url).hostname,url};if(matches(row))result.push(row);}
  return result;
 }
 if(typeof module==='object'&&module.exports){module.exports={webAddress,entries};return;}
 root.createMouseAddressTools=({N,model,activateTab,navigate,layout,hideHints,status,doc=document})=>{
  const make=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const tr=(ru,en)=>model.locale==='en'?en:ru;
  const icon=(name)=>name==='copy'?'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 7V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3"/></svg>':'<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';
  const popup=make('div','mouse-address-pages');popup.id='mouse-address-pages';popup.setAttribute('popover','manual');popup.setAttribute('role','dialog');
  const filter=make('input','mouse-address-filter');filter.type='search';filter.autocomplete='off';filter.spellcheck=false;filter.setAttribute('role','combobox');filter.setAttribute('aria-autocomplete','list');filter.setAttribute('aria-controls','mouse-address-page-list');
  const list=make('div','mouse-address-page-list');list.id='mouse-address-page-list';list.setAttribute('role','listbox');
  const more=make('button','mouse-address-more');more.type='button';popup.append(filter,list,more);doc.body.append(popup);
  const bindings=new WeakMap();let owner=null,generation=0,source=null,rows=[],active=-1,limit=80,iconObserver;
  const run=fn=>Promise.resolve().then(fn).catch(error=>status(error.message));
  const isOpen=()=>popup.matches(':popover-open');
  function close({focus=false}={}){const previous=owner,opened=isOpen();if(!previous&&!opened)return;generation++;iconObserver?.disconnect();owner=null;source=null;rows=[];active=-1;if(opened)popup.hidePopover();previous?.menu.setAttribute('aria-expanded','false');previous?.head.classList.remove('address-menu-open');filter.removeAttribute('aria-activedescendant');filter.setAttribute('aria-expanded','false');if(focus&&previous?.menu.isConnected)previous.menu.focus();layout();}
  function bounds(){return isOpen()?popup.getBoundingClientRect():null;}
  function position(){if(!owner?.head.isConnected){close();return;}const rect=owner.head.getBoundingClientRect(),width=Math.max(0,Math.min(innerWidth-20,Math.max(290,Math.min(440,rect.width)))),below=Math.max(0,innerHeight-rect.bottom-49),above=Math.max(0,rect.top-15),opensAbove=below<Math.min(240,above);popup.style.width=width+'px';popup.style.left=Math.max(10,Math.min(innerWidth-width-10,rect.left+4))+'px';popup.style.top=opensAbove?'auto':(rect.bottom+5)+'px';popup.style.bottom=opensAbove?(innerHeight-rect.top+5)+'px':'auto';popup.style.maxHeight=Math.min(430,opensAbove?above:below)+'px';layout();}
  function highlight(){const items=[...list.querySelectorAll('.mouse-address-page')];items.forEach((node,index)=>node.setAttribute('aria-selected',String(index===active)));if(active>=0&&items[active]){filter.setAttribute('aria-activedescendant',items[active].id);items[active].scrollIntoView({block:'nearest'});}else filter.removeAttribute('aria-activedescendant');}
  async function choose(index){const row=rows[index],current=owner;if(!row||!current)return;close();if(row.kind==='open')await activateTab({desk:row.desk,id:row.id});else await navigate(current.getTab()?.id,row.url);}
  function render(){
   if(!source||!owner)return;iconObserver?.disconnect();rows=entries(source.desktops,source.history,filter.value);active=-1;list.replaceChildren();const serial=generation;
   iconObserver=new IntersectionObserver(changes=>{for(const change of changes)if(change.isIntersecting){const img=change.target;iconObserver.unobserve(img);const row=rows[Number(img.dataset.index)];if(!row)continue;void (row.kind==='open'?N.favicon(row.id):N.library('icon',{kind:'history',url:row.url})).then(value=>{if(serial===generation&&img.isConnected&&isOpen()&&/^data:image\//.test(value||''))img.src=value;}).catch(()=>{});}},{root:list,rootMargin:'40px'});
   let section='';for(const [index,row]of rows.slice(0,limit).entries()){
    const group=row.kind==='open'?'desk:'+row.desk:'history';
    const label=row.kind==='open'?row.deskName:tr('Недавно','Recently');
    if(section!==group){section=group;const heading=make('div','mouse-address-section',label);heading.setAttribute('role','presentation');list.append(heading);}
    const button=make('button','mouse-address-page');button.type='button';button.id='mouse-address-page-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;button.dataset.kind=row.kind;if(row.kind==='open'){button.dataset.tab=row.id;button.dataset.desk=row.desk;}
    const img=make('img','mouse-address-favicon');img.alt='';img.src='globe.svg';img.draggable=false;img.dataset.index=String(index);
    const text=make('span','mouse-address-text');text.append(make('strong','',row.title),make('small','',row.url));button.append(img,text);button.title=row.url;button.onclick=()=>void run(()=>choose(index));list.append(button);iconObserver.observe(img);
   }
   if(!rows.length)list.append(make('p','mouse-address-empty',tr('Страниц не найдено','No pages found')));
   more.hidden=rows.length<=limit;more.textContent=tr('Показать ещё','Show more');highlight();position();
  }
  async function open(record){
   if(owner===record&&isOpen()){close({focus:true});return;}close();hideHints();owner=record;record.head.classList.add('address-menu-open');record.menu.setAttribute('aria-expanded','true');const serial=++generation;filter.value='';limit=80;filter.placeholder=tr('Найти среди открытых и недавних','Find open and recent pages');filter.setAttribute('aria-label',filter.placeholder);filter.setAttribute('aria-expanded','true');popup.setAttribute('aria-label',tr('Страницы на всех столах','Pages on all desktops'));list.replaceChildren(make('p','mouse-address-empty',tr('Загрузка…','Loading…')));more.hidden=true;position();popup.showPopover();filter.focus({preventScroll:true});layout();
   try{const [desktops,history]=await Promise.all([N.desktops('state'),N.library('list',{kind:'history',offset:0})]);if(serial!==generation||owner!==record||!record.head.isConnected)return;source={desktops,history:history?.items||[]};render();}catch(error){if(serial===generation){close({focus:true});throw error;}}
  }
  filter.addEventListener('input',()=>{limit=80;render();});
  filter.addEventListener('keydown',event=>{if(event.isComposing)return;const count=Math.min(rows.length,limit);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&count){event.preventDefault();active=event.key==='Home'?0:event.key==='End'?count-1:event.key==='ArrowDown'?(active+1)%count:(active<0?count-1:(active-1+count)%count);highlight();}else if(event.key==='Enter'&&active>=0){event.preventDefault();void run(()=>choose(active));}});
  more.onclick=()=>{limit+=80;render();};
  popup.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close({focus:true});}});
  function bind(head,getTab){
   if(bindings.has(head))return;const form=head.querySelector('.pane-address'),input=form?.querySelector('input'),favicon=head.querySelector('.pane-icon');if(!form||!input||!favicon)return;
   const copy=make('button','pane-address-copy');copy.type='button';copy.innerHTML=icon('copy');const menu=make('button','pane-address-menu');menu.type='button';menu.innerHTML=icon('down');menu.setAttribute('aria-haspopup','dialog');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls',popup.id);favicon.after(menu);form.append(copy);
   const record={head,input,copy,menu,getTab};bindings.set(head,record);
   copy.addEventListener('pointerdown',event=>event.preventDefault());
   copy.onclick=()=>void run(async()=>{const page=getTab();if(!page||!webAddress(page.url))return;await N.address('copy',{id:page.id,url:page.url});copy.dataset.copied='true';copy.title=tr('Скопировано','Copied');setTimeout(()=>{if(copy.isConnected){delete copy.dataset.copied;sync(head);}},1300);});
   menu.onclick=()=>void run(()=>open(record));input.addEventListener('focus',()=>{if(isOpen())close();});form.addEventListener('submit',()=>close());sync(head);
  }
  function sync(head){const record=bindings.get(head);if(!record)return;record.menu.title=tr('Открытые и недавние страницы','Open and recent pages');record.menu.setAttribute('aria-label',record.menu.title);record.copy.disabled=!webAddress(record.getTab()?.url);if(!record.copy.dataset.copied)record.copy.title=tr('Скопировать адрес','Copy address');record.copy.setAttribute('aria-label',record.copy.title);}
  doc.addEventListener('pointerdown',event=>{if(owner&&!popup.contains(event.target)&&event.target!==owner.menu&&!owner.menu.contains(event.target))close();},true);
  doc.addEventListener('focusin',event=>{if(owner&&!popup.contains(event.target)&&!owner.head.contains(event.target))close();});
  window.addEventListener('resize',()=>{if(isOpen())position();});window.addEventListener('blur',()=>close());
  return{bind,sync,close,bounds,isOpen};
 };
})(globalThis);
