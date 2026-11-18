'use strict';
// Native macOS child views may hit-test beyond their visual clip. Interactive
// popovers use the existing modal view gate; bounded previews stay in RAM only.
function mouseFloatingBackdrop(N,m){
 let epoch=0,owner='',images=[];
 const clear=()=>{for(const image of images)image.remove();images=[];};
 return{
  async show(name){
   const ticket=++epoch;owner=name;clear();const specs=[];
   const add=(id,slot)=>{const tab=m.state.tabs.find(t=>t.id===id),r=slot?.getBoundingClientRect();if(tab&&!tab.internal&&r?.width>1&&r.height>1)specs.push({id,r});};
   if(!m.focusAI)for(const pane of document.querySelectorAll('.pane'))add(m.slots[pane.dataset.pane],pane.querySelector('.page-slot'));
   if(!m.focusPane&&m.aiOpen&&!m.libraryOpen)add(m.aiId,document.querySelector('#ai-slot'));
   let timeout;
   const pictures=Promise.all(specs.map(async({id,r})=>{try{
    const result=await N.desktops('thumbnail',{id});if(ticket!==epoch||owner!==name||!/^data:image\/(?:png|jpeg);base64,/.test(result.src||''))return;
    const image=document.createElement('img');image.className='mouse-floating-snapshot';image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');image.src=result.src;
    Object.assign(image.style,{position:'fixed',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',objectFit:'fill',pointerEvents:'none',zIndex:'800'});document.body.append(image);images.push(image);
   }catch{}}));
   await Promise.race([pictures,new Promise(resolve=>{timeout=setTimeout(resolve,350)})]);clearTimeout(timeout);
   if(ticket!==epoch||owner!==name)return false;
   await N.browser('layout',{panels:[]});return ticket===epoch&&owner===name;
  },
  hide(name){if(owner!==name)return;epoch++;owner='';clear();}
 };
}
globalThis.createMouseDesktopUI=({N,model:m,preferences,switchDesktop,applyMode,moveTab,closeTab,activateTab,layout,status})=>{
 const backdrop=mouseFloatingBackdrop(N,m);globalThis.MouseFloatingBackdrop=backdrop;
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const button=make('button','');button.id='desktops-button';button.type='button';button.title='Рабочие столы';button.setAttribute('aria-label','Рабочие столы');button.setAttribute('aria-expanded','false');button.innerHTML='<span class="burrow-entry" aria-hidden="true"></span><span class="desktop-total-badge" hidden></span>';
 document.querySelector('#statusbar').append(button);
 const tray=document.createElement('dialog');tray.id='desktop-tray';tray.hidden=true;tray.setAttribute('aria-label','Рабочие столы');
 tray.innerHTML=`<svg class="desk-burrow-shape" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="mouse-desktop-burrow" clipPathUnits="userSpaceOnUse"><path d="M0 400C25 400 36 385 36 362V72C36 28 68 0 112 0H888C932 0 964 28 964 72V362C964 385 975 400 1000 400Z"/></clipPath></defs><path d="M0 400C25 400 36 385 36 362V72C36 28 68 0 112 0H888C932 0 964 28 964 72V362C964 385 975 400 1000 400" vector-effect="non-scaling-stroke"/></svg><div class="desk-glass" aria-hidden="true"></div><div class="desk-content"><section id="desktop-preview-popover" hidden aria-label="Предпросмотр стола"><div class="desk-peek-heading"><strong></strong><span></span><button class="desk-preview-go" type="button">Перейти ↗</button><button class="desk-preview-close" type="button" aria-label="Закрыть предпросмотр">×</button></div><div class="desk-peek-image"></div><div class="desk-peek-tabs"></div></section><header><div><strong>Рабочие столы</strong><span class="desk-description">Пять пространств. Всё на своих местах.</span></div><button id="desk-modes-button" type="button" aria-expanded="false" aria-controls="desk-modes">Режимы <span aria-hidden="true">⌃</span></button><button id="desk-add" type="button" title="Перейти на свободный стол" aria-label="Перейти на свободный стол">+</button><button id="desks-close" type="button" aria-label="Закрыть рабочие столы">×</button></header><section id="desk-modes" aria-label="Режимы рабочего стола" inert><div class="desk-modes-inner"><p>Раскладка для текущего стола <strong class="desk-current-name"></strong></p><div class="desk-mode-list"></div><small>Ваши вкладки сохраняются. Сервисы открываются только на пустом столе.</small></div></section><div class="desktop-list"></div><p class="desk-help">Нажмите миниатюру, чтобы посмотреть. «Перейти» откроет стол.</p></div>`;
 document.body.append(tray);let state={items:[],active:''},opening=false,epoch=0,peekId='',modesOpen=false,previewState=null,chipDrag=null,suppressChipClick=0;
 const peek=tray.querySelector('#desktop-preview-popover'),modeButton=tray.querySelector('#desk-modes-button'),modes=tray.querySelector('#desk-modes');
 // Only the straight sides grow: use the real modes-open layout for every state.
 const shape=tray.querySelector('.desk-burrow-shape'),content=tray.querySelector('.desk-content');
 function shapeBurrow(){
  const w=tray.clientWidth,h=tray.clientHeight;if(!w||!h)return;
  const previewHeight=peek.hidden?0:peek.offsetHeight+(parseFloat(getComputedStyle(peek).marginBottom)||0);
  const expanded=Math.min(parseFloat(getComputedStyle(tray).maxHeight)||Infinity,content.offsetHeight-modes.offsetHeight-previewHeight+modes.firstElementChild.scrollHeight);
  const top=expanded*.18,shoulder=expanded*.07,foot=Math.min(expanded*.095,Math.max(0,h-top)),control=foot*15/38,n=x=>Math.round(x*1000)/1000;
  const d=`M0 ${h}C${n(w*.025)} ${h} ${n(w*.036)} ${n(h-control)} ${n(w*.036)} ${n(h-foot)}V${n(top)}C${n(w*.036)} ${n(shoulder)} ${n(w*.068)} 0 ${n(w*.112)} 0H${n(w*.888)}C${n(w*.932)} 0 ${n(w*.964)} ${n(shoulder)} ${n(w*.964)} ${n(top)}V${n(h-foot)}C${n(w*.964)} ${n(h-control)} ${n(w*.975)} ${h} ${w} ${h}`;
  shape.setAttribute('viewBox',`0 0 ${w} ${h}`);shape.querySelector(':scope>path').setAttribute('d',d);shape.querySelector('clipPath path').setAttribute('d',d+'Z');
 }
 const shapeObserver=new ResizeObserver(shapeBurrow);shapeObserver.observe(tray);shapeObserver.observe(content);shapeObserver.observe(modes.firstElementChild);
 const rename=document.createElement('dialog');rename.id='desktop-rename';rename.innerHTML='<form><header><strong>Название рабочего стола</strong><button type="button" aria-label="Закрыть">×</button></header><label>Название<input maxlength="60" required></label><footer><button type="submit">Сохранить</button></footer></form>';document.body.append(rename);let renameId='';
 rename.querySelector('header button').onclick=()=>rename.close();rename.addEventListener('close',layout);
 rename.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const r=await N.desktops('rename',{id:renameId,name:rename.querySelector('input').value});rename.close();render(r.state.desktops);}catch(error){status(error.message)}};
 function showModes(value){modesOpen=value;modeButton.setAttribute('aria-expanded',String(value));modes.inert=!value;tray.classList.toggle('modes-open',value);if(value)closePeek();layout();}
 function closePeek(){clearChipDrag();peekId='';peek.hidden=true;tray.classList.remove('preview-open');layout();}
 function enriched(d){
  const previous=previewState?.items?.find(x=>x.id===d.id),snapshot=previous?.preview||d.preview||{},current=d.tabs||snapshot.tabs;
  if(!current)return previous?{...previous,...d,preview:snapshot}:d;
  const byId=new Map(current.map(t=>[t.id,t])),oldImages=new Map((snapshot.panes||[]).filter(p=>p.id).map(p=>[p.id,p]));
  const info=id=>{const t=byId.get(id);if(!t)return{id:'',title:'Свободное окно',src:''};const old=oldImages.get(id);let site=t.site;try{site=site||new URL(t.url).hostname.replace(/^www\./,'');}catch{}return{...t,site:site||t.title,src:old?.url===t.url?old.src||'':'',capturedAt:old?.url===t.url?old.capturedAt||0:0};};
  const slots=d.slots||previous?.slots||{},panes=MouseLayout.leaves(d.tree).map(pane=>({pane,...info(slots[pane])}));if(d.aiOpen&&d.aiId)panes.push({pane:'ai',...info(d.aiId)});
  return{...previous,...d,preview:{...snapshot,panes,tabs:current,extraTabs:current.filter(t=>!t.placed),capturedAt:Math.max(0,...panes.map(p=>p.capturedAt||0))}};
 }
 const words=(n,a,b,c)=>n%10===1&&n%100!==11?a:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?b:c;
 const caption=d=>{const n=d.paneCount??d.count;return n+' '+words(n,'окно','окна','окон')+(d.hiddenCount?' · '+d.hiddenCount+' в фоне':'');};
 const setText=(e,text)=>{if(e.textContent!==text)e.textContent=text;};
 async function changeTabs(kind,args){try{const result=await(kind==='move'?moveTab(args):closeTab(args));if(result?.previews)previewState=result.previews;if(result?.state?.desktops)render(result.state.desktops);}catch(error){status(error.message);}}
 function clearChipDrag(){const d=chipDrag;chipDrag=null;if(!d)return;d.ghost?.remove();d.node.classList.remove('desk-chip-dragging');d.targetElement?.classList.remove('desk-drop-target','desk-drop-before');if(d.node.hasPointerCapture?.(d.pointer))d.node.releasePointerCapture(d.pointer);}
 function beginChipDrag(e,id,desk,node){if(e.button!==0||e.target.closest('.desk-chip-close'))return;chipDrag={id,desk,node,pointer:e.pointerId,x:e.clientX,y:e.clientY,active:false,target:null};}
 document.addEventListener('pointermove',e=>{
  const d=chipDrag;if(!d||d.pointer!==e.pointerId)return;
  if(!d.active){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;d.active=true;d.node.setPointerCapture(e.pointerId);d.node.classList.add('desk-chip-dragging');d.ghost=d.node.cloneNode(true);d.ghost.removeAttribute('data-tab');d.ghost.className='desk-tab-chip desk-chip-ghost';d.ghost.setAttribute('aria-hidden','true');tray.append(d.ghost);}
  e.preventDefault();const r=tray.getBoundingClientRect();d.ghost.style.left=(e.clientX-r.left+12)+'px';d.ghost.style.top=(e.clientY-r.top+12)+'px';
  d.targetElement?.classList.remove('desk-drop-target','desk-drop-before');const hit=document.elementFromPoint(e.clientX,e.clientY),chip=hit?.closest('.desk-tab-chip[data-tab]'),card=hit?.closest('.desktop-card'),row=peek.querySelector('.desk-peek-tabs');d.target=null;d.targetElement=null;
  if(chip&&chip!==d.node){d.target={desk:peekId,before:chip.dataset.tab};d.targetElement=chip;chip.classList.add('desk-drop-before');}
  else if(card){d.target={desk:card.dataset.desk};d.targetElement=card;card.classList.add('desk-drop-target');}
  else if(row.contains(hit)&&hit!==d.node&&!d.node.contains(hit)){d.target={desk:peekId};}
  const rr=row.getBoundingClientRect();if(e.clientY>=rr.top&&e.clientY<=rr.bottom){if(e.clientX<rr.left+20)row.scrollLeft-=14;else if(e.clientX>rr.right-20)row.scrollLeft+=14;}
 });
 document.addEventListener('pointerup',e=>{const d=chipDrag;if(!d||d.pointer!==e.pointerId)return;const active=d.active,target=d.target,id=d.id;clearChipDrag();if(active){suppressChipClick=performance.now()+300;e.preventDefault();if(target)void changeTabs('move',{id,...target});}});
 document.addEventListener('pointercancel',clearChipDrag);window.addEventListener('blur',clearChipDrag);
 const chipRow=peek.querySelector('.desk-peek-tabs');chipRow.setAttribute('role','list');chipRow.setAttribute('aria-label','Открытые вкладки; перетаскивайте для порядка или на другой стол');
 chipRow.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&chipRow.scrollWidth>chipRow.clientWidth){chipRow.scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
 function drawPeek(){
  const d=state.items.find(x=>x.id===peekId);if(!d)return closePeek();const full=enriched(d);peek.hidden=false;tray.classList.add('preview-open');setText(peek.querySelector('strong'),d.name);setText(peek.querySelector('.desk-peek-heading>span'),caption(d)+(d.active?' · Вы здесь':full.preview?.capturedAt?' · Последний видимый кадр':''));
  const go=peek.querySelector('.desk-preview-go');go.disabled=!!d.active;setText(go,d.active?'Текущий стол':'Перейти ↗');MouseDesktopPreview.render(peek.querySelector('.desk-peek-image'),full,{N,large:true});
  const tabs=full.preview?.tabs||[...(full.preview?.panes||[]),...(full.preview?.extraTabs||[])].filter(p=>p.id),unique=[...new Map(tabs.map(t=>[t.id,t])).values()],existing=new Map([...chipRow.children].map(e=>[e.dataset.tab,e])),wanted=new Set();
  for(let index=0;index<unique.length;index++){
   const t=unique[index];wanted.add(t.id);let chip=existing.get(t.id);
   if(!chip){chip=make('div','desk-tab-chip');chip.dataset.tab=t.id;chip.setAttribute('role','listitem');const select=make('button','desk-chip-select'),image=make('img','desk-chip-favicon'),label=make('span','desk-chip-label'),close=make('button','desk-chip-close','×');select.type=close.type='button';select.append(image,label);chip.append(select,close);chip.onpointerdown=e=>beginChipDrag(e,chip.dataset.tab,peekId,chip);select.onclick=()=>{if(performance.now()<suppressChipClick)return;void Promise.resolve(activateTab({desk:peekId,id:chip.dataset.tab})).catch(error=>status(error.message));};close.onclick=e=>{e.stopPropagation();void changeTabs('close',{id:chip.dataset.tab});};}
   let site=t.site;try{site=site||new URL(t.url).hostname.replace(/^www\./,'');}catch{}const label=site||t.title||'Новая вкладка';setText(chip.querySelector('.desk-chip-label'),label);chip.title=(t.title||t.url||'Новая вкладка')+(t.placed===false?' · В фоне':'');chip.classList.toggle('desk-chip-background',t.placed===false);chip.querySelector('.desk-chip-select').setAttribute('aria-label','Открыть '+label);chip.querySelector('.desk-chip-close').setAttribute('aria-label','Закрыть '+label);MouseDesktopPreview.favicon(chip.querySelector('.desk-chip-favicon'),t,N);
   if(chipRow.children[index]!==chip)chipRow.insertBefore(chip,chipRow.children[index]||null);
  }
  for(const [id,node]of existing)if(!wanted.has(id)){if(chipDrag?.id===id)clearChipDrag();node.remove();}shapeBurrow();layout();
 }
 function showPeek(id){showModes(false);peekId=id;drawPeek();}
 async function refreshPreviews(ticket=epoch){try{const next=await N.desktops('previews',{preferences:preferences()});if(ticket!==epoch||tray.hidden)return;previewState=next;render(next);}catch(error){if(ticket===epoch&&!tray.hidden)status(error.message)}}
 async function open(){
  if(!tray.hidden||opening){close();return;}opening=true;const ticket=++epoch;
  try{await N.desktops('remember-preview',{preferences:preferences()});if(ticket!==epoch)return;if(!await backdrop.show('desktops')||ticket!==epoch)return;tray.hidden=false;tray.showModal();button.setAttribute('aria-expanded','true');render(m.state.desktops||state);layout();void refreshPreviews(ticket);}
  catch(error){close();status(error.message);}finally{if(ticket===epoch)opening=false;}
 }
 function clearPreviewDOM(){previewState=null;tray.querySelector('.desktop-list').replaceChildren();peek.querySelector('.desk-peek-image').replaceChildren();peek.querySelector('.desk-peek-tabs').replaceChildren();}
 function close(){epoch++;opening=false;closePeek();showModes(false);if(tray.open)tray.close();tray.hidden=true;button.setAttribute('aria-expanded','false');backdrop.hide('desktops');clearPreviewDOM();layout();}
 tray.addEventListener('cancel',e=>{e.preventDefault();if(peekId)closePeek();else close();button.focus();});
 tray.addEventListener('close',()=>{if(tray.open||opening)return;epoch++;tray.hidden=true;button.setAttribute('aria-expanded','false');backdrop.hide('desktops');clearPreviewDOM();layout();});
 async function choose(id,add=false){try{await switchDesktop(id,add);render(m.state.desktops);close();}catch(error){status(error.message)}}
 function render(next){
  if(!next)return;state={...next,items:next.items.map(d=>{if(!d.active)return d;const tabs=MouseTabOrder.ordered(m.state.tabs||[],m.tabOrder),placed=new Set([...Object.values(m.slots).filter(id=>tabs.some(t=>t.id===id&&t.lane!=='side')),...(m.aiOpen&&tabs.some(t=>t.id===m.aiId)?[m.aiId]:[])]);return{...d,tree:m.tree,slots:m.slots,aiOpen:m.aiOpen,aiId:m.aiId,count:tabs.length,paneCount:placed.size,hiddenCount:tabs.length-placed.size,tabs:tabs.map(t=>({...t,placed:placed.has(t.id)}))};})};const unseen=state.items.filter(d=>!d.active).reduce((sum,d)=>sum+d.unread,0),badge=button.querySelector('.desktop-total-badge');badge.hidden=!unseen;setText(badge,unseen>99?'99+':String(unseen));button.title='Рабочие столы'+(unseen?' · Непрочитано по счётчикам сайтов: '+unseen:'');if(tray.hidden)return;
  setText(tray.querySelector('.desk-current-name'),state.items.find(d=>d.active)?.name||'');const list=tray.querySelector('.desktop-list'),existing=new Map([...list.children].map(e=>[e.dataset.desk,e])),wanted=new Set();
  for(let index=0;index<state.items.length;index++){
   const d=state.items[index];wanted.add(d.id);let tile=existing.get(d.id);
   if(!tile){tile=make('article','desktop-card');tile.dataset.desk=d.id;const preview=make('button','desk-preview-button'),picture=make('span','desk-preview'),name=make('button','desk-name'),meta=make('span','desk-meta'),go=make('button','desk-open');preview.type=name.type=go.type='button';preview.append(picture);preview.onclick=()=>showPeek(d.id);name.title='Двойной щелчок — переименовать';name.onclick=()=>showPeek(d.id);name.ondblclick=async e=>{e.preventDefault();const current=state.items.find(v=>v.id===d.id);if(!current)return;renameId=d.id;rename.querySelector('input').value=current.name;close();await N.browser('layout',{panels:[]});rename.showModal();rename.querySelector('input').focus();};go.onclick=()=>choose(d.id);tile.append(preview,name,meta,go);}
   tile.setAttribute('aria-current',String(d.active));tile.setAttribute('aria-label',d.name+(d.active?' — текущий стол':''));tile.querySelector('.desk-preview-button').setAttribute('aria-label','Предпросмотр: '+d.name);MouseDesktopPreview.render(tile.querySelector('.desk-preview'),enriched(d),{N,tree:d.active?m.tree:d.tree});setText(tile.querySelector('.desk-name'),d.name);setText(tile.querySelector('.desk-meta'),d.active?'● Вы здесь'+(d.hiddenCount?' · '+d.hiddenCount+' в фоне':''):d.count?caption(d):'Свободный стол');const go=tile.querySelector('.desk-open');go.disabled=!!d.active;setText(go,d.active?'Текущий стол':'Перейти');
   let unread=tile.querySelector('.desk-badge');if(d.unread){if(!unread){unread=make('span','desk-badge');tile.append(unread);}setText(unread,d.unread>99?'99+':String(d.unread));}else unread?.remove();
   const a=m.agentState;let mouse=tile.querySelector('.desk-agent-badge');if(a?.enabled&&a.desk===d.id){if(!mouse){mouse=make('img','desk-agent-badge');tile.append(mouse);}MouseAgentBrand.apply(mouse,d.id);mouse.alt=a.running?'Агент работает здесь':'Агент подключён здесь';mouse.dataset.running=String(!!a.running);}else mouse?.remove();
   if(list.children[index]!==tile)list.insertBefore(tile,list.children[index]||null);
  }
  for(const [id,node]of existing)if(!wanted.has(id))node.remove();
  tray.querySelector('#desk-add').disabled=!state.items.some(d=>d.count===0);for(const el of tray.querySelectorAll('[data-mode]'))el.setAttribute('aria-pressed',String(el.dataset.mode===m.mode));if(peekId)drawPeek();shapeBurrow();layout();
 }
 for(const mode of MouseModes.modes){const b=make('button','desk-mode');b.type='button';b.dataset.mode=mode.id;b.title=mode.hint;b.setAttribute('aria-pressed','false');b.append(MouseDesktopPreview.icon(mode),make('strong','',mode.name));const diagram=make('span','desk-preview');MouseDesktopPreview.render(diagram,{tree:mode.tree,count:mode.sites.length},{tree:mode.tree});b.append(diagram);b.onclick=async()=>{b.disabled=true;try{await applyMode(mode.id);previewState=null;render(m.state.desktops);await refreshPreviews();}catch(error){status(error.message)}finally{b.disabled=false}};tray.querySelector('.desk-mode-list').append(b);}
 button.onclick=open;tray.querySelector('#desks-close').onclick=close;tray.querySelector('#desk-add').onclick=()=>choose('',true);modeButton.onclick=()=>showModes(!modesOpen);peek.querySelector('.desk-preview-close').onclick=closePeek;peek.querySelector('.desk-preview-go').onclick=()=>choose(peekId);
 N.onPreviewsCleared?.(()=>{MouseDesktopPreview.clearIcons();close();});
 document.addEventListener('pointerdown',e=>{if(tray.hidden)return;const r=tray.getBoundingClientRect(),outside=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;if(outside&&!button.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tray.hidden){e.preventDefault();e.stopImmediatePropagation();if(peekId)closePeek();else close();button.focus();}},true);
 return{render,open,close,showPeek,add:()=>choose('',true),bounds:()=>tray.hidden?null:tray.getBoundingClientRect()};
};

globalThis.createMouseZoomUI=({N,layout,status})=>{
 const backdrop=globalThis.MouseFloatingBackdrop;
 const b=document.createElement('button');b.type='button';b.id='global-zoom-button';b.textContent='Т+';b.title='Масштаб всех вкладок';b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded','false');document.querySelector('#emoji-button').after(b);
 const box=document.createElement('dialog');box.id='global-zoom-panel';box.hidden=true;box.innerHTML='<strong>Масштаб всех вкладок</strong><div><button data-zoom="minus" aria-label="Уменьшить">−</button><output>100%</output><button data-zoom="plus" aria-label="Увеличить">+</button><button data-zoom="reset">100%</button></div><input type="range" min="25" max="500" step="5" value="100" aria-label="Масштаб всех вкладок">';Object.assign(box.style,{margin:'0',left:'auto',top:'auto',color:'var(--text)'});document.body.append(box);let factor=1,opening=false;
 const close=()=>{opening=false;if(box.open)box.close();box.hidden=true;b.setAttribute('aria-expanded','false');backdrop.hide('zoom');layout();};
 N.onPreviewsCleared?.(close);
 box.addEventListener('cancel',e=>{e.preventDefault();close();b.focus();});box.addEventListener('close',()=>{if(box.open||opening)return;box.hidden=true;b.setAttribute('aria-expanded','false');backdrop.hide('zoom');layout();});
 function render(s){factor=s.factor;box.querySelector('output').textContent=Math.round(factor*100)+'%';box.querySelector('input').value=Math.round(factor*100);b.title='Масштаб всех вкладок · '+Math.round(factor*100)+'%';document.documentElement.style.setProperty('--page-zoom',String(factor));}
 async function change(action,value){try{render(await N.zoom('set',{factor:action==='reset'?1:action==='set'?value:Math.max(.25,Math.min(5,Math.round((factor+(action==='plus'?.1:-.1))*100)/100))}));}catch(error){status(error.message)}}
 b.onclick=async()=>{if(!box.hidden||opening){close();return;}opening=true;try{if(!await backdrop.show('zoom'))return;box.hidden=false;box.showModal();b.setAttribute('aria-expanded','true');layout();}catch(error){close();status(error.message);}finally{opening=false;}};box.querySelectorAll('[data-zoom]').forEach(e=>e.onclick=()=>change(e.dataset.zoom));box.querySelector('input').oninput=e=>change('set',Number(e.target.value)/100);
 document.addEventListener('pointerdown',e=>{if(box.hidden)return;const r=box.getBoundingClientRect();if((e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)&&!b.contains(e.target))close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){e.preventDefault();e.stopImmediatePropagation();close();b.focus();}},true);
 N.zoom('state').then(render).catch(error=>status(error.message));N.onZoom(render);
 return{change,close,bounds:()=>box.hidden?null:box.getBoundingClientRect()};
};
