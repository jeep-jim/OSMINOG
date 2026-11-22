'use strict';
// A bounded, on-demand timeline: no page captures and no background polling.
globalThis.createMouseLayoutHistory=({N,model,header,before,restore,status,changed,show})=>{
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const controls=make('div','desk-history-controls');controls.innerHTML='<button id="desk-history-back" type="button" aria-label="Вернуть предыдущую сетку" title="Предыдущая сетка" disabled>←</button><button id="desk-history-button" type="button" aria-controls="desk-history-panel" aria-expanded="false"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 3h18v5H3zM3 12h7v9H3zM14 12h7v9h-7z"/></svg><span>История сетки</span></button><button id="desk-history-forward" type="button" aria-label="Повторить изменение сетки" title="Повторить изменение" disabled>→</button>';
 header.firstElementChild.after(controls);
 const panel=make('section','desk-history-panel');panel.id='desk-history-panel';panel.hidden=true;panel.setAttribute('aria-label','История сетки текущего стола');
 const heading=make('div','desk-history-heading'),title=make('strong','','История сетки'),close=make('button','','×');close.type='button';close.title='Скрыть историю';close.setAttribute('aria-label',close.title);heading.append(title,close);
 const list=make('div','desk-history-list'),hint=make('p','desk-history-hint','Сохраняются размеры, расположение и порядок окон. Закрытые вкладки не открываются заново.');list.setAttribute('role','list');panel.append(heading,list,hint);before.before(panel);
 const back=controls.querySelector('#desk-history-back'),forward=controls.querySelector('#desk-history-forward'),toggle=controls.querySelector('#desk-history-button');
 const reasons={initial:'Исходная сетка',layout:'Сетка окон',split:'Разделение окна',resize:'Размеры окон','ai-resize':'Ширина ИИ','ai-preview-resize':'Высота сайта под ИИ','preview-transfer':'Перенос сайта в окно','ai-panel':'Панель ИИ','apply-mode':'Режим стола','move-tab':'Перемещение вкладки','close-tab':'Закрытие вкладки',restore:'Восстановление сетки',recovery:'Сохранённая сетка'};
 let info=null,busy=false,request=0,key='';
 function buttons(){back.disabled=busy||!info?.canUndo;forward.disabled=busy||!info?.canRedo;toggle.disabled=busy;for(const card of list.children)card.querySelector('.desk-history-restore').disabled=busy||card.dataset.position==='current';back.title=info?.canUndo?'Предыдущая сетка · '+(reasons[info.undoReason]||'Изменение'):'Предыдущих сеток пока нет';forward.title=info?.canRedo?'Повторить изменение · '+(reasons[info.redoReason]||'Изменение'):'Повторять пока нечего';}
 function draw(next){
  info=next;buttons();title.textContent='История сетки · '+(model.state.desktops?.items.find(d=>d.id===model.desktopId)?.name||'Текущий стол');
  if(!next?.entries)return;list.replaceChildren();
  for(const entry of next.entries){
   const card=make('article','desk-history-entry');card.dataset.historyId=entry.id;card.dataset.position=entry.position;card.setAttribute('role','listitem');
   const preview=make('div','desk-history-grid');MouseDesktopPreview.render(preview,{tree:entry.tree,count:MouseLayout.leaves(entry.tree).length},{tree:entry.tree});
   const label=make('strong','',entry.position==='current'?'Текущая сетка':reasons[entry.reason]||'Изменение сетки');
   const date=new Date(entry.createdAt),time=make('time','',date.toLocaleString(model.locale==='en'?'en-GB':'ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}));time.dateTime=date.toISOString();
   const count=make('span','desk-history-count','Окна: '+MouseLayout.leaves(entry.tree).length);
   const button=make('button','desk-history-restore',entry.position==='current'?'Сейчас':'Восстановить');button.type='button';button.disabled=entry.position==='current'||busy;button.onclick=()=>void change('restore-layout',entry.id);card.append(preview,label,time,count,button);list.append(card);
  }
  const current=list.querySelector('[data-position=current]');
  if(current){const item=current.getBoundingClientRect(),viewport=list.getBoundingClientRect();if(item.left<viewport.left)list.scrollLeft-=viewport.left-item.left;else if(item.right>viewport.right)list.scrollLeft+=item.right-viewport.right;}
  changed();
 }
 async function refresh(flush=false){const ticket=++request;try{if(flush)await globalThis.MouseFlush?.();const next=await N.desktops('history-state',{from:model.desktopId});if(ticket===request)draw(next);}catch(error){if(ticket===request)status(error.message);}}
 async function change(action,id){if(busy)return;busy=true;buttons();try{const result=await restore(action,id);if(result?.history)draw(result.history);if(!panel.hidden)await refresh();}catch(error){status(error.message);}finally{busy=false;buttons();}}
 function hide(){++request;panel.hidden=true;toggle.setAttribute('aria-expanded','false');changed();}
 toggle.onclick=()=>{if(!panel.hidden){hide();return;}show?.();panel.hidden=false;toggle.setAttribute('aria-expanded','true');changed();void refresh(true);};close.onclick=hide;back.onclick=()=>void change('undo');forward.onclick=()=>void change('redo');
 function render(state){const next=state?.layoutHistory||state?.items?.find(d=>d.id===model.desktopId)?.history;const nextKey=JSON.stringify([model.desktopId,next?.currentId,next?.undoCount,next?.redoCount]);if(next)info=next;buttons();if(nextKey!==key){key=nextKey;if(!panel.hidden)void refresh();}}
 return{render,hide,refresh,panel};
};
