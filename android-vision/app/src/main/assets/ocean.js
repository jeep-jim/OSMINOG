'use strict';
// Local-file design: Untitled (2).fig. Network activity is deliberately absent
// until an authenticated ocean API and discussion audience are configured.
(()=>{
 const root=node('section','ocean-view');root.id='oceanView';root.hidden=true;root.setAttribute('aria-label','Океан мыслей');
 root.innerHTML='<div class="ocean-heading"><span id="oceanTitle">Живой океан мыслей</span><small id="oceanCount">Не подключён</small></div><div id="oceanField" class="ocean-field"><div id="oceanCanvas" class="ocean-canvas"></div></div><p id="oceanEmpty" class="ocean-empty"></p><section id="oceanCard" class="ocean-card" hidden><button id="cardHandle" class="card-handle" aria-label="Раскрыть обсуждение"><span></span></button><div class="card-author"><img id="cardAvatar" alt=""><div><span id="cardAuthor"></span><small id="cardDate"></small></div><button id="cardClose" aria-label="Закрыть карточку">×</button></div><p id="cardText"></p><div id="cardMedia" class="card-media"></div><button id="cardExpand" class="card-expand">Открыть обсуждение</button><section id="discussion" hidden><p class="discussion-status">Обсуждение открыто всем после выпуска в океан. Это намерение ещё не опубликовано.</p><textarea id="replyDraft" maxlength="12000" aria-label="Черновик ответа" placeholder="Написать…"></textarea><small>Черновик только на этом устройстве. Ответ станет виден всем после отправки. Общий океан пока не подключён.</small></section></section><form id="oceanSearch" class="ocean-search"><button id="oceanBack" type="button" aria-label="Назад в личный чат">‹</button><div><input id="oceanQuery" type="search" maxlength="1000" aria-label="Найти мысли" placeholder="Найти мысли"><button type="submit" aria-label="Искать мысли"><span class="search-eye"></span></button></div></form>';
 $('scene').append(root);
 const compass=node('button','ocean-compass');compass.id='oceanToggle';compass.setAttribute('aria-label','Открыть океан мыслей');compass.innerHTML='<img src="design/ocean-compass.svg" alt="">';document.querySelector('#scene>header').append(compass);
 let active=false,scope='ocean',cardId=null,expanded=false,chatScroll=0;
 let pan={x:0,y:0,scale:1},drag=null,suppressTap=false;
 function paintPan(){ $('oceanCanvas').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${pan.scale})`; }
 const field=$('oceanField');
 field.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;suppressTap=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};});
 field.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6){suppressTap=true;field.setPointerCapture(e.pointerId);}if(suppressTap){pan.x=drag.px+dx;pan.y=drag.py+dy;paintPan();}});
 field.addEventListener('pointerup',()=>{drag=null;setTimeout(()=>suppressTap=false,0);});field.addEventListener('pointercancel',()=>{drag=null;suppressTap=true;});
 field.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey){pan.scale=Math.max(.35,Math.min(2.5,pan.scale*Math.exp(-e.deltaY*.002)));}else{pan.x-=e.deltaX;pan.y-=e.deltaY;}paintPan();},{passive:false});
 function current(){return records.find(r=>r.id===cardId&&r.intent&&r.role==='user');}
 function saveReply(){if(cardId)persist('osminogReplyDraft:'+cardId,$('replyDraft').value);}
 function refresh(){
  const q=$('oceanQuery').value.trim().toLocaleLowerCase();const list=scope==='local'?records.filter(r=>r.intent&&r.role==='user'&&r.text.toLocaleLowerCase().includes(q)):[];
  $('oceanTitle').textContent=scope==='local'?(q?'Найдено на устройстве':'Мои намерения'):'Живой океан мыслей';$('oceanCount').textContent=scope==='local'?String(list.length):'Не подключён';
  $('oceanCanvas').replaceChildren();$('oceanEmpty').replaceChildren();
  if(scope==='ocean'){$('oceanEmpty').append(node('span','','Общий океан пока не подключён. Поиск среди других людей недоступен.'));const local=node('button','','Мои намерения на устройстве');local.onclick=()=>{scope='local';refresh();};$('oceanEmpty').append(local);}
  else if(!list.length)$('oceanEmpty').textContent=q?'На устройстве ничего не найдено.':'Здесь появятся сохранённые черновики намерений.';
  for(const [i,r]of list.entries()){
   const b=node('button','thought-bubble');b.dataset.id=r.id;b.setAttribute('aria-label',r.text);b.setAttribute('aria-pressed',String(cardId===r.id));
   const img=node('img');img.src=imageFor(preferences.avatar);img.alt='';b.append(img,node('span','bubble-label',r.text));
   const angle=i*2.399963, radius=140*Math.sqrt(i);b.style.left=(Math.cos(angle)*radius)+'px';b.style.top=(Math.sin(angle)*radius)+'px';b.onclick=()=>{if(!suppressTap)openCard(r.id);};$('oceanCanvas').append(b);
  }
 }
 function open(local=false){if(!active)chatScroll=$('main').scrollTop;setMenu(false);stopCamera();stopVoice();active=true;scope=local?'local':'ocean';root.hidden=false;document.body.classList.add('ocean-open');$('main').inert=true;$('dock').inert=true;compass.setAttribute('aria-label','Вернуться в личный чат');refresh();}
 function closeCard(){saveReply();cardId=null;expanded=false;$('oceanCard').hidden=true;$('discussion').hidden=true;root.classList.remove('thread-open','card-open');refresh();}
 function close(){closeCard();active=false;root.hidden=true;document.body.classList.remove('ocean-open');$('main').inert=false;$('dock').inert=false;$('main').scrollTop=chatScroll;compass.setAttribute('aria-label','Открыть океан мыслей');}
 function openCard(id){saveReply();const r=records.find(x=>x.id===id&&x.intent&&x.role==='user');if(!r)return;cardId=id;expanded=false;$('oceanCard').hidden=false;root.classList.add('card-open');root.classList.remove('thread-open');$('discussion').hidden=true;
  $('cardAvatar').src=preferences.photo||imageFor(preferences.avatar);$('cardAuthor').textContent=preferences.name||'Планктон';const date=new Date(r.created);$('cardDate').textContent='Не опубликовано'+(Number.isFinite(date.getTime())?' · '+date.toLocaleDateString('ru-RU'):'');$('cardText').textContent=r.text;$('cardMedia').replaceChildren();renderAttachment(r.file,$('cardMedia'));$('replyDraft').value=read('osminogReplyDraft:'+id,'');$('cardExpand').hidden=false;refresh();
 }
 function expand(){if(!current())return;expanded=true;root.classList.add('thread-open');$('discussion').hidden=false;$('cardExpand').hidden=true;$('cardHandle').setAttribute('aria-label','Свернуть обсуждение');}
 function back(){if(!active)return false;if(expanded){saveReply();expanded=false;root.classList.remove('thread-open');$('discussion').hidden=true;$('cardExpand').hidden=false;$('cardHandle').setAttribute('aria-label','Раскрыть обсуждение');return true;}if(cardId){closeCard();return true;}close();return true;}
 compass.onclick=()=>active?close():open();$('oceanBack').onclick=back;$('cardClose').onclick=closeCard;$('cardExpand').onclick=expand;$('cardHandle').onclick=()=>{if(swiped){swiped=false;return;}expanded?back():expand();};$('replyDraft').oninput=saveReply;
 $('oceanSearch').onsubmit=e=>{e.preventDefault();closeCard();document.activeElement?.blur();refresh();};$('oceanQuery').oninput=()=>{if(cardId)closeCard();else refresh();};
 let gesture=null,swiped=false;$('cardHandle').addEventListener('pointerdown',e=>{gesture=e.clientY;swiped=false;$('cardHandle').setPointerCapture?.(e.pointerId);});$('cardHandle').addEventListener('pointerup',e=>{if(gesture===null)return;const dy=e.clientY-gesture;gesture=null;if(Math.abs(dy)>55){swiped=true;if(dy>0)back();else expand();}});$('cardHandle').addEventListener('pointercancel',()=>gesture=null);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)saveReply();});window.addEventListener('pagehide',saveReply);
 window.OceanUI={open,close,back,preview(id){open(true);openCard(id);},get active(){return active;}};
})();
