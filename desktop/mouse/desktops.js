'use strict';
globalThis.createMouseDesktopUI=({N,model:m,preferences,switchDesktop,layout,status})=>{
 const button=document.createElement('button');button.id='desktops-button';button.type='button';button.title='Рабочие столы';button.setAttribute('aria-label','Рабочие столы');button.setAttribute('aria-expanded','false');button.innerHTML='<svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 12 7-7 7 7"/></svg><span class="desktop-total-badge" hidden></span>';
 document.querySelector('#statusbar').append(button);
 const tray=document.createElement('section');tray.id='desktop-tray';tray.hidden=true;tray.setAttribute('aria-label','Рабочие столы');tray.innerHTML='<header><strong>Рабочие столы</strong><span>Двойной щелчок по названию — переименовать</span><button id="desk-add" type="button" title="Добавить рабочий стол">+</button><button id="desks-close" type="button" aria-label="Закрыть рабочие столы">×</button></header><div class="desktop-list"></div>';
 document.body.append(tray);let state={items:[],active:''};
 const rename=document.createElement('dialog');rename.id='desktop-rename';rename.innerHTML='<form><header><strong>Название рабочего стола</strong><button type="button" aria-label="Закрыть">×</button></header><label>Название<input maxlength="60" required></label><footer><button type="submit">Сохранить</button></footer></form>';document.body.append(rename);let renameId='';
 rename.querySelector('header button').onclick=()=>rename.close();rename.addEventListener('close',layout);
 rename.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const r=await N.desktops('rename',{id:renameId,name:rename.querySelector('input').value});rename.close();render(r.state.desktops);}catch(error){status(error.message)}};
 function open(){tray.hidden=!tray.hidden;button.setAttribute('aria-expanded',String(!tray.hidden));if(!tray.hidden){render(m.state.desktops||state);tray.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest',inline:'center'});}layout();}
 function close(){tray.hidden=true;button.setAttribute('aria-expanded','false');layout();}
 function diagram(tree,host){const node=document.createElement('div');if(tree?.id){node.className='desk-cell';host.append(node);return;}node.className='desk-split';node.dataset.axis=tree?.axis||'x';host.append(node);for(const [sub,ratio]of [[tree?.a,tree?.ratio||.5],[tree?.b,1-(tree?.ratio||.5)]]){const part=document.createElement('div');part.className='desk-part';part.style.flex=String(ratio);node.append(part);if(sub)diagram(sub,part);}}
 async function choose(id,add=false){try{await switchDesktop(id,add);render(m.state.desktops);close();}catch(error){status(error.message)}}
 function render(next){if(!next)return;state=next;const unseen=state.items.filter(d=>!d.active).reduce((sum,d)=>sum+d.unread,0),badge=button.querySelector('span');badge.hidden=!unseen;badge.textContent=unseen>99?'99+':String(unseen);button.title='Рабочие столы'+(unseen?' · Непрочитано по счётчикам сайтов: '+unseen:'');if(tray.hidden)return;
  const list=tray.querySelector('.desktop-list'),scroll=list.scrollLeft;list.replaceChildren();
  for(const d of state.items){const tile=document.createElement('button');tile.type='button';tile.className='desktop-card';tile.dataset.desk=d.id;tile.setAttribute('aria-current',String(d.active));tile.title=d.name+' · Вкладок: '+d.count+(d.unread?' · Непрочитано по заголовкам сайтов: '+d.unread:'');
   const preview=document.createElement('span');preview.className='desk-preview';if(d.count)diagram(d.active?m.tree:d.tree,preview);else{preview.classList.add('desk-empty');preview.textContent='+';}tile.append(preview);
   const name=document.createElement('span');name.className='desk-name';name.textContent=d.name;tile.append(name);const count=document.createElement('small');count.textContent=d.count?d.count+' вкладок':'Пустой стол';tile.append(count);
   if(d.unread){const b=document.createElement('span');b.className='desk-badge';b.textContent=d.unread>99?'99+':String(d.unread);tile.append(b);}
   tile.onclick=()=>choose(d.id);name.onclick=e=>e.stopPropagation();name.ondblclick=async e=>{e.preventDefault();e.stopPropagation();renameId=d.id;rename.querySelector('input').value=d.name;close();await N.browser('layout',{panels:[]});rename.showModal();rename.querySelector('input').focus();};list.append(tile);
  }list.scrollLeft=scroll;layout();
 }
 button.onclick=open;tray.querySelector('#desks-close').onclick=close;tray.querySelector('#desk-add').onclick=()=>choose('',true);
 document.addEventListener('pointerdown',e=>{if(!tray.hidden&&!tray.contains(e.target)&&!button.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tray.hidden){e.preventDefault();e.stopImmediatePropagation();close();button.focus();}},true);
 return{render,open,close,add:()=>choose('',true),bounds:()=>tray.hidden?null:tray.getBoundingClientRect()};
};
globalThis.createMouseZoomUI=({N,layout,status})=>{
 const b=document.createElement('button');b.type='button';b.id='global-zoom-button';b.textContent='Т+';b.title='Масштаб всех вкладок';b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded','false');document.querySelector('#emoji-button').after(b);
 const box=document.createElement('section');box.id='global-zoom-panel';box.hidden=true;box.innerHTML='<strong>Масштаб всех вкладок</strong><div><button data-zoom="minus" aria-label="Уменьшить">−</button><output>100%</output><button data-zoom="plus" aria-label="Увеличить">+</button><button data-zoom="reset">100%</button></div><input type="range" min="25" max="500" step="5" value="100" aria-label="Масштаб всех вкладок">';document.body.append(box);let factor=1;
 const close=()=>{box.hidden=true;b.setAttribute('aria-expanded','false');layout();};
 function render(s){factor=s.factor;box.querySelector('output').textContent=Math.round(factor*100)+'%';box.querySelector('input').value=Math.round(factor*100);b.title='Масштаб всех вкладок · '+Math.round(factor*100)+'%';document.documentElement.style.setProperty('--page-zoom',String(factor));}
 async function change(action,value){try{render(await N.zoom('set',{factor:action==='reset'?1:action==='set'?value:Math.max(.25,Math.min(5,Math.round((factor+(action==='plus'?.1:-.1))*100)/100))}));}catch(error){status(error.message)}}
 b.onclick=()=>{box.hidden=!box.hidden;b.setAttribute('aria-expanded',String(!box.hidden));layout();};box.querySelectorAll('[data-zoom]').forEach(e=>e.onclick=()=>change(e.dataset.zoom));box.querySelector('input').oninput=e=>change('set',Number(e.target.value)/100);
 document.addEventListener('pointerdown',e=>{if(!box.hidden&&!box.contains(e.target)&&!b.contains(e.target))close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){e.preventDefault();e.stopImmediatePropagation();close();b.focus();}},true);
 N.zoom('state').then(render).catch(error=>status(error.message));N.onZoom(render);
 return{change,close,bounds:()=>box.hidden?null:box.getBoundingClientRect()};
};
