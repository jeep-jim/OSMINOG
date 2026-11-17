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
globalThis.createMouseDesktopUI=({N,model:m,preferences,switchDesktop,layout,status})=>{
 const backdrop=mouseFloatingBackdrop(N,m);globalThis.MouseFloatingBackdrop=backdrop;
 const button=document.createElement('button');button.id='desktops-button';button.type='button';button.title='Рабочие столы';button.setAttribute('aria-label','Рабочие столы');button.setAttribute('aria-expanded','false');button.innerHTML='<span class="burrow-entry" aria-hidden="true"></span><span class="desktop-total-badge" hidden></span>';
 document.querySelector('#statusbar').append(button);
 const tray=document.createElement('dialog');tray.id='desktop-tray';tray.hidden=true;tray.setAttribute('aria-label','Рабочие столы');tray.innerHTML='<header><strong>Рабочие столы</strong><span>Двойной щелчок по названию — переименовать</span><button id="desk-add" type="button" title="Добавить рабочий стол">+</button><button id="desks-close" type="button" aria-label="Закрыть рабочие столы">×</button></header><div class="desktop-list"></div>';
 Object.assign(tray.style,{margin:'0',top:'auto',maxHeight:'calc(100vh - 80px)',color:'var(--text)'});
 document.body.append(tray);let state={items:[],active:''},opening=false;
 const rename=document.createElement('dialog');rename.id='desktop-rename';rename.innerHTML='<form><header><strong>Название рабочего стола</strong><button type="button" aria-label="Закрыть">×</button></header><label>Название<input maxlength="60" required></label><footer><button type="submit">Сохранить</button></footer></form>';document.body.append(rename);let renameId='';
 rename.querySelector('header button').onclick=()=>rename.close();rename.addEventListener('close',layout);
 rename.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const r=await N.desktops('rename',{id:renameId,name:rename.querySelector('input').value});rename.close();render(r.state.desktops);}catch(error){status(error.message)}};
 async function open(){
  if(!tray.hidden||opening){close();return;}opening=true;
  try{if(!await backdrop.show('desktops'))return;tray.hidden=false;tray.showModal();button.setAttribute('aria-expanded','true');render(m.state.desktops||state);tray.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest',inline:'center'});layout();}
  catch(error){close();status(error.message);}finally{opening=false;}
 }
 function close(){opening=false;if(tray.open)tray.close();tray.hidden=true;button.setAttribute('aria-expanded','false');backdrop.hide('desktops');layout();}
 tray.addEventListener('cancel',e=>{e.preventDefault();close();button.focus();});
 tray.addEventListener('close',()=>{tray.hidden=true;button.setAttribute('aria-expanded','false');backdrop.hide('desktops');layout();});
 function diagram(tree,host){const node=document.createElement('div');if(tree?.id){node.className='desk-cell';host.append(node);return;}node.className='desk-split';node.dataset.axis=tree?.axis||'x';host.append(node);for(const [sub,ratio]of [[tree?.a,tree?.ratio||.5],[tree?.b,1-(tree?.ratio||.5)]]){const part=document.createElement('div');part.className='desk-part';part.style.flex=String(ratio);node.append(part);if(sub)diagram(sub,part);}}
 async function choose(id,add=false){try{await switchDesktop(id,add);render(m.state.desktops);close();}catch(error){status(error.message)}}
 function render(next){if(!next)return;state=next;const unseen=state.items.filter(d=>!d.active).reduce((sum,d)=>sum+d.unread,0),badge=button.querySelector('.desktop-total-badge');badge.hidden=!unseen;badge.textContent=unseen>99?'99+':String(unseen);button.title='Рабочие столы'+(unseen?' · Непрочитано по счётчикам сайтов: '+unseen:'');if(tray.hidden)return;
  const list=tray.querySelector('.desktop-list'),scroll=list.scrollLeft;list.replaceChildren();
  for(const d of state.items){const tile=document.createElement('button');tile.type='button';tile.className='desktop-card';tile.dataset.desk=d.id;tile.setAttribute('aria-current',String(d.active));tile.title=d.name+' · Вкладок: '+d.count+(d.unread?' · Непрочитано по заголовкам сайтов: '+d.unread:'');
   const preview=document.createElement('span');preview.className='desk-preview';if(d.count)diagram(d.active?m.tree:d.tree,preview);else{preview.classList.add('desk-empty');preview.textContent='+';}tile.append(preview);
   const name=document.createElement('span');name.className='desk-name';name.textContent=d.name;tile.append(name);const count=document.createElement('small');count.textContent=d.count?d.count+' вкладок':'Пустой стол';tile.append(count);
   if(d.unread){const b=document.createElement('span');b.className='desk-badge';b.textContent=d.unread>99?'99+':String(d.unread);tile.append(b);}
   tile.onclick=()=>choose(d.id);name.onclick=e=>e.stopPropagation();name.ondblclick=async e=>{e.preventDefault();e.stopPropagation();renameId=d.id;rename.querySelector('input').value=d.name;close();await N.browser('layout',{panels:[]});rename.showModal();rename.querySelector('input').focus();};list.append(tile);
  }list.scrollLeft=scroll;layout();
 }
 button.onclick=open;tray.querySelector('#desks-close').onclick=close;tray.querySelector('#desk-add').onclick=()=>choose('',true);
 document.addEventListener('pointerdown',e=>{if(tray.hidden)return;const r=tray.getBoundingClientRect(),outside=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;if(outside&&!button.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tray.hidden){e.preventDefault();e.stopImmediatePropagation();close();button.focus();}},true);
 return{render,open,close,add:()=>choose('',true),bounds:()=>tray.hidden?null:tray.getBoundingClientRect()};
};
globalThis.createMouseZoomUI=({N,layout,status})=>{
 const backdrop=globalThis.MouseFloatingBackdrop;
 const b=document.createElement('button');b.type='button';b.id='global-zoom-button';b.textContent='Т+';b.title='Масштаб всех вкладок';b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded','false');document.querySelector('#emoji-button').after(b);
 const box=document.createElement('dialog');box.id='global-zoom-panel';box.hidden=true;box.innerHTML='<strong>Масштаб всех вкладок</strong><div><button data-zoom="minus" aria-label="Уменьшить">−</button><output>100%</output><button data-zoom="plus" aria-label="Увеличить">+</button><button data-zoom="reset">100%</button></div><input type="range" min="25" max="500" step="5" value="100" aria-label="Масштаб всех вкладок">';Object.assign(box.style,{margin:'0',left:'auto',top:'auto',color:'var(--text)'});document.body.append(box);let factor=1,opening=false;
 const close=()=>{opening=false;if(box.open)box.close();box.hidden=true;b.setAttribute('aria-expanded','false');backdrop.hide('zoom');layout();};
 box.addEventListener('cancel',e=>{e.preventDefault();close();b.focus();});box.addEventListener('close',()=>{box.hidden=true;b.setAttribute('aria-expanded','false');backdrop.hide('zoom');layout();});
 function render(s){factor=s.factor;box.querySelector('output').textContent=Math.round(factor*100)+'%';box.querySelector('input').value=Math.round(factor*100);b.title='Масштаб всех вкладок · '+Math.round(factor*100)+'%';document.documentElement.style.setProperty('--page-zoom',String(factor));}
 async function change(action,value){try{render(await N.zoom('set',{factor:action==='reset'?1:action==='set'?value:Math.max(.25,Math.min(5,Math.round((factor+(action==='plus'?.1:-.1))*100)/100))}));}catch(error){status(error.message)}}
 b.onclick=async()=>{if(!box.hidden||opening){close();return;}opening=true;try{if(!await backdrop.show('zoom'))return;box.hidden=false;box.showModal();b.setAttribute('aria-expanded','true');layout();}catch(error){close();status(error.message);}finally{opening=false;}};box.querySelectorAll('[data-zoom]').forEach(e=>e.onclick=()=>change(e.dataset.zoom));box.querySelector('input').oninput=e=>change('set',Number(e.target.value)/100);
 document.addEventListener('pointerdown',e=>{if(box.hidden)return;const r=box.getBoundingClientRect();if((e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)&&!b.contains(e.target))close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){e.preventDefault();e.stopImmediatePropagation();close();b.focus();}},true);
 N.zoom('state').then(render).catch(error=>status(error.message));N.onZoom(render);
 return{change,close,bounds:()=>box.hidden?null:box.getBoundingClientRect()};
};
