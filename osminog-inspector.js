(()=>{'use strict';
const base=renderInspector,root=document.querySelector('#inspectorBody'),panel=document.querySelector('#inspector'),title=document.querySelector('#inspectorTitle');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=(o,k,label,min,max,step=1)=>`<label class="ui-value"><span>${label}</span><input aria-label="${label}" data-edit="${k}" type="number" value="${Number(o[k]??(k==='opacity'?1:0))}" ${min!=null?'min="'+min+'"':''} ${max!=null?'max="'+max+'"':''} step="${step}"></label>`;
const section=(name,body)=>`<section class="ui-section"><h3>${name}</h3>${body}</section>`;
const color=(o,k,label,fallback)=>`<label class="ui-color"><span>${label}</span><input aria-label="${label}" type="color" data-edit="${k}" value="${validColor(o[k],fallback)}"><code>${esc(validColor(o[k],fallback)).toUpperCase()}</code></label>`;
function render(){panel.classList.remove('collapsed');if(globalThis.OSMINOGPhotoEditor?.sync())return;root.hidden=false;
 if(state.selectedConnection||(!selectedObjects().length&&!['select','hand'].includes(state.tool))){base();return}
 const items=selectedObjects();if(!items.length){title.textContent='Холст';const c=project()?.canvas||{};root.innerHTML=section('Рабочая область','<p class="ui-help">Выбери объект на холсте или слой слева. Здесь появятся его свойства.</p>')+section('Сетка',`<label class="ui-value"><span>Вид</span><select aria-label="Вид сетки" data-canvas-grid><option value="dots">Точки</option><option value="lines">Линии</option><option value="none">Без сетки</option></select></label>`)+section('Изображения','<p class="ui-help">Перетащи фото на холст. Инструменты выделения, удаления и обрезки — под волшебной шляпой внизу.</p>');root.querySelector('[data-canvas-grid]').value=c.grid||'dots';root.querySelector('[data-canvas-grid]').onchange=e=>{checkpoint();project().canvas={...project().canvas,grid:e.target.value};renderAll(true);queuePersist()};return}
 if(items.length>1){title.textContent=items.length+' объектов';root.innerHTML=section('Выделение',`<p class="ui-help">Общее перемещение — на холсте. Порядок наложения — в слоях слева.</p><button data-group>${items.every(o=>o.group&&o.group===items[0].group)?'Разгруппировать':'Сгруппировать объекты'}</button>`);root.querySelector('[data-group]').onclick=()=>items.every(o=>o.group&&o.group===items[0].group)?ungroupSelection():groupSelection();return}
 const o=items[0];title.textContent=({image:'Изображение',shape:'Фигура',text:'Текст',note:'Заметка',vector:'Контур',node:'Нода',file:'Файл',folder:'Папка',browser:'Ссылка',code:'Код'})[o.type]||'Объект';
 const geo=section('Положение',`<div class="ui-grid">${numeric(o,'x','X')}${numeric(o,'y','Y')}</div>`)+section('Размер',`<div class="ui-grid">${numeric(o,'w','W',1,50000)}${numeric(o,'h','H',1,50000)}${numeric(o,'rotation','Угол',-360,360)}${numeric(o,'opacity','Непрозрачность',0,1,.05)}</div>`);
 let extra='';if(['shape','vector','note','node','button','brief'].includes(o.type))extra+=section('Оформление',color(o,'fill','Заливка','#ffffff')+color(o,'stroke','Обводка','#202633')+`<div class="ui-grid">${numeric(o,'strokeWidth','Толщина',0,100)}${numeric(o,'radius','Скругление',0,500)}</div>`);
 if(['text','note','brief','node','button'].includes(o.type))extra+=section('Текст',`<div class="ui-grid">${numeric(o,'fontSize','Кегль',8,200)}${numeric(o,'fontWeight','Насыщенность',100,900,100)}</div>`+color(o,'textColor','Цвет текста','#202633'));
 if(o.type==='image')extra+=section('Обработка','<p class="ui-help">Шляпа внизу → инструмент → работа прямо на фото. Настройки инструмента появятся здесь.</p>');
 if(o.type==='vector')extra+=section('Контур','<button data-nodes>Редактировать узлы</button>');
 root.innerHTML=section('Слой',`<input class="ui-name" aria-label="Название объекта" data-edit="name" value="${esc(o.name)}">`)+geo+extra;
 root.querySelectorAll('[data-edit]').forEach(input=>input.onchange=()=>{const current=objects().find(x=>x.id===o.id);if(!current)return;const key=input.dataset.edit;let value=input.type==='number'?Number(input.value):input.value;if(input.type==='number'){if(!Number.isFinite(value))return;if(input.min!=='')value=Math.max(Number(input.min),value);if(input.max!=='')value=Math.min(Number(input.max),value)}checkpoint();current[key]=value;if(key==='fill')current.fillEnabled=true;if(key==='stroke'||key==='strokeWidth')current.strokeEnabled=current.strokeWidth!==0;renderAll(true);queuePersist()});
 root.querySelector('[data-nodes]')?.addEventListener('click',()=>{state.nodeEditId=o.id;renderAll(true)});
}
globalThis.renderInspector=render;
document.body.classList.add('unified-inspector');panel.classList.remove('collapsed');document.querySelector('#inspectorCollapse').hidden=true;document.querySelector('#inspector .inspector-mini')?.remove();document.querySelector('#inspector .panel-resizer')?.remove();
// Keep settings in the fixed right rail; a chat opens next to it.
const oldApply=applyView;globalThis.applyView=function(){oldApply();OSMINOGPhotoEditor.sync()};
document.addEventListener('osminog:mode-change',()=>{document.body.classList.remove('mode-team')});
render();
})();
