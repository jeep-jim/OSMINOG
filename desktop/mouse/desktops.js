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
    const result=await N.desktops('thumbnail',{id});if(ticket!==epoch||owner!==name||!result.src?.startsWith('data:image/png;base64,'))return;
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
globalThis.createMouseDesktopUI=({N,model:m,preferences,switchDesktop,applyMode,layout,status})=>{
 const backdrop=mouseFloatingBackdrop(N,m);globalThis.MouseFloatingBackdrop=backdrop;
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const button=make('button','');button.id='desktops-button';button.type='button';button.title='Рабочие столы';button.setAttribute('aria-label','Рабочие столы');button.setAttribute('aria-expanded','false');button.innerHTML='<span class="burrow-entry" aria-hidden="true"></span><span class="desktop-total-badge" hidden></span>';
 document.querySelector('#statusbar').append(button);
 const tray=document.createElement('dialog');tray.id='desktop-tray';tray.hidden=true;tray.setAttribute('aria-label','Рабочие столы');
 tray.innerHTML=`<svg class="desk-burrow-shape" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="mouse-desktop-burrow" clipPathUnits="objectBoundingBox"><path d="M0 1C.025 1 .036 .9625 .036 .905V.18C.036 .07 .068 0 .112 0H.888C.932 0 .964 .07 .964 .18V.905C.964 .9625 .975 1 1 1Z"/></clipPath></defs><path d="M0 400C25 400 36 385 36 362V72C36 28 68 0 112 0H888C932 0 964 28 964 72V362C964 385 975 400 1000 400" vector-effect="non-scaling-stroke"/></svg><div class="desk-glass" aria-hidden="true"></div><div class="desk-content"><section id="desktop-preview-popover" hidden aria-label="Предпросмотр стола"><div class="desk-peek-heading"><strong></strong><span></span><button class="desk-preview-go" type="button">Перейти ↗</button><button class="desk-preview-close" type="button" aria-label="Закрыть предпросмотр">×</button></div><div class="desk-peek-image"></div><div class="desk-peek-tabs"></div></section><header><div><strong>Рабочие столы</strong><span class="desk-description">Пять пространств. Всё на своих местах.</span></div><button id="desk-modes-button" type="button" aria-expanded="false" aria-controls="desk-modes">Режимы <span aria-hidden="true">⌃</span></button><button id="desk-add" type="button" title="Перейти на свободный стол" aria-label="Перейти на свободный стол">+</button><button id="desks-close" type="button" aria-label="Закрыть рабочие столы">×</button></header><section id="desk-modes" aria-label="Режимы рабочего стола" inert><div class="desk-modes-inner"><p>Раскладка для текущего стола <strong class="desk-current-name"></strong></p><div class="desk-mode-list"></div><small>Ваши вкладки сохраняются. Сервисы открываются только на пустом столе.</small></div></section><div class="desktop-list"></div><p class="desk-help">Нажмите миниатюру, чтобы посмотреть. «Перейти» откроет стол.</p></div>`;
 document.body.append(tray);let state={items:[],active:''},opening=false,epoch=0,peekId='',modesOpen=false,previewState=null;
 const peek=tray.querySelector('#desktop-preview-popover'),modeButton=tray.querySelector('#desk-modes-button'),modes=tray.querySelector('#desk-modes');
 const rename=document.createElement('dialog');rename.id='desktop-rename';rename.innerHTML='<form><header><strong>Название рабочего стола</strong><button type="button" aria-label="Закрыть">×</button></header><label>Название<input maxlength="60" required></label><footer><button type="submit">Сохранить</button></footer></form>';document.body.append(rename);let renameId='';
 rename.querySelector('header button').onclick=()=>rename.close();rename.addEventListener('close',layout);
 rename.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const r=await N.desktops('rename',{id:renameId,name:rename.querySelector('input').value});rename.close();render(r.state.desktops);}catch(error){status(error.message)}};
 function showModes(value){modesOpen=value;modeButton.setAttribute('aria-expanded',String(value));modes.inert=!value;tray.classList.toggle('modes-open',value);if(value)closePeek();layout();}
 function closePeek(){peekId='';peek.hidden=true;tray.classList.remove('preview-open');layout();}
 function enriched(d){const p=previewState?.items?.find(x=>x.id===d.id);return p?{...p,...d,preview:p.preview}:d;}
 function drawPeek(){const d=state.items.find(x=>x.id===peekId);if(!d)return closePeek();const full=enriched(d);peek.hidden=false;tray.classList.add('preview-open');peek.querySelector('strong').textContent=d.name;peek.querySelector('.desk-peek-heading>span').textContent=d.active?'Вы здесь':full.preview?.capturedAt?'Последний видимый кадр':'Расположение окон';const go=peek.querySelector('.desk-preview-go');go.disabled=!!d.active;go.textContent=d.active?'Текущий стол':'Перейти ↗';MouseDesktopPreview.render(peek.querySelector('.desk-peek-image'),full,{N,large:true});const tabs=peek.querySelector('.desk-peek-tabs');tabs.replaceChildren();for(const p of [...(full.preview?.panes||[]),...(full.preview?.extraTabs||[])].filter(p=>p.id)){const t=make('span','',p.site||p.title||'Новая вкладка');t.title=p.title||p.url||'';tabs.append(t);}layout();}
 function showPeek(id){showModes(false);peekId=id;drawPeek();}
 async function refreshPreviews(ticket=epoch){try{const next=await N.desktops('previews',{preferences:preferences()});if(ticket!==epoch||tray.hidden)return;previewState=next;render(m.state.desktops||next);}catch(error){if(ticket===epoch&&!tray.hidden)status(error.message)}}
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
  if(!next)return;state=next;const unseen=state.items.filter(d=>!d.active).reduce((sum,d)=>sum+d.unread,0),badge=button.querySelector('.desktop-total-badge');badge.hidden=!unseen;badge.textContent=unseen>99?'99+':String(unseen);button.title='Рабочие столы'+(unseen?' · Непрочитано по счётчикам сайтов: '+unseen:'');if(tray.hidden)return;
  tray.querySelector('.desk-current-name').textContent=state.items.find(d=>d.active)?.name||'';const list=tray.querySelector('.desktop-list');list.replaceChildren();
  for(const d of state.items){const tile=make('article','desktop-card');tile.dataset.desk=d.id;tile.setAttribute('aria-current',String(d.active));tile.setAttribute('aria-label',d.name+(d.active?' — текущий стол':''));
   const preview=make('button','desk-preview-button');preview.type='button';preview.setAttribute('aria-label','Предпросмотр: '+d.name);preview.onclick=()=>showPeek(d.id);const picture=make('span','desk-preview');MouseDesktopPreview.render(picture,enriched(d),{N,tree:d.active?m.tree:d.tree});preview.append(picture);tile.append(preview);
   const name=make('button','desk-name',d.name);name.type='button';name.title='Двойной щелчок — переименовать';name.onclick=()=>showPeek(d.id);name.ondblclick=async e=>{e.preventDefault();renameId=d.id;rename.querySelector('input').value=d.name;close();await N.browser('layout',{panels:[]});rename.showModal();rename.querySelector('input').focus();};tile.append(name);
   const meta=make('span','desk-meta',d.active?'● Вы здесь':d.count?d.count+' вкладок':'Свободный стол');tile.append(meta);
   const go=make('button','desk-open',d.active?'Текущий стол':'Перейти');go.type='button';go.disabled=!!d.active;go.onclick=()=>choose(d.id);tile.append(go);
   if(d.unread){const b=make('span','desk-badge',d.unread>99?'99+':String(d.unread));tile.append(b);}
   const a=m.agentState;if(a?.enabled&&a.desk===d.id){const mouse=make('img','desk-agent-badge');mouse.src='mouse-head.svg';mouse.alt=a.running?'Агент работает здесь':'Агент подключён здесь';mouse.dataset.running=String(!!a.running);tile.append(mouse);}list.append(tile);
  }
  tray.querySelector('#desk-add').disabled=!state.items.some(d=>d.count===0);for(const el of tray.querySelectorAll('[data-mode]'))el.setAttribute('aria-pressed',String(el.dataset.mode===m.mode));if(peekId)drawPeek();layout();
 }
 for(const mode of MouseModes.modes){const b=make('button','desk-mode');b.type='button';b.dataset.mode=mode.id;b.title=mode.hint;b.setAttribute('aria-pressed','false');b.append(MouseDesktopPreview.icon(mode),make('strong','',mode.name));const diagram=make('span','desk-preview');MouseDesktopPreview.render(diagram,{tree:mode.tree,count:mode.sites.length},{tree:mode.tree});b.append(diagram);b.onclick=async()=>{b.disabled=true;try{await applyMode(mode.id);previewState=null;render(m.state.desktops);await refreshPreviews();}catch(error){status(error.message)}finally{b.disabled=false}};tray.querySelector('.desk-mode-list').append(b);}
 button.onclick=open;tray.querySelector('#desks-close').onclick=close;tray.querySelector('#desk-add').onclick=()=>choose('',true);modeButton.onclick=()=>showModes(!modesOpen);peek.querySelector('.desk-preview-close').onclick=closePeek;peek.querySelector('.desk-preview-go').onclick=()=>choose(peekId);
 N.onPreviewsCleared?.(close);
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
