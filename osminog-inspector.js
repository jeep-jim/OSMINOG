(()=>{'use strict';
const base=renderInspector,root=document.querySelector('#inspectorBody'),panel=document.querySelector('#inspector'),title=document.querySelector('#inspectorTitle');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>OSMINOGIcons.svg(n),round=n=>Math.round(Number(n)*100)/100;
const section=(name,body)=>`<section class="ui-section"><h3>${name}</h3>${body}</section>`;
const button=(name,label,attrs='',active=false)=>`<button type="button" class="ui-icon" title="${label}" aria-label="${label}" ${attrs} aria-pressed="${active}">${icon(name)}</button>`;
const numeric=(o,k,label,min,max,step=1)=>`<label class="ui-value" title="${label}"><span>${label}</span><input aria-label="${label}" data-edit="${k}" type="number" value="${round(k==='opacity'?100*(o.opacity??1):o[k]??0)}" ${min!=null?'min="'+min+'"':''} ${max!=null?'max="'+max+'"':''} step="${step}"></label>`;
const color=(o,k,label,fallback)=>`<div class="ui-paint"><input aria-label="${label}" title="${label}" type="color" data-edit="${k}" value="${validColor(o[k],fallback)}"><input class="ui-hex" aria-label="${label} HEX" data-hex="${k}" value="${validColor(o[k],fallback).slice(1).toUpperCase()}" maxlength="7" spellcheck="false">${['fill','stroke'].includes(k)?button(o[k+'Enabled']===false?'eye-off':'eye',label+' — видимость',`data-toggle="${k}Enabled"`,o[k+'Enabled']!==false):''}</div>`;
function paint(o,strokeOnly=false){let html='';if(!strokeOnly){html+=section('Заливка',`<div class="ui-segments">${button('paint-bucket','Сплошной цвет','data-fill-type="solid"',o.fillType!=='gradient')}${button('blend','Градиент','data-fill-type="gradient"',o.fillType==='gradient')}</div>`+color(o,'fill','Цвет заливки','#ffffff')+(o.fillType==='gradient'?color(o,'fill2','Второй цвет','#8b5cf6')+numeric(o,'gradientAngle','Угол градиента',-360,360):''))}return html+section('Обводка',color(o,'stroke','Цвет обводки','#202633')+numeric(o,'strokeWidth','Толщина',strokeOnly?1:0,100,.5))}
function canvas(){const c=project().canvas||(project().canvas={grid:'plain',size:24}),dark=state.theme!=='light';title.textContent='Холст';
 const modes=[['plain','square','Без сетки'],['dots','grip','Точки'],['grid','grid-3x3','Сетка / плитка'],['both','grid-2x2','Сетка и точки']];
 root.innerHTML=section('Фон',color(c,dark?'boardDark':'boardLight','Цвет фона',dark?'#171a20':'#DEE2E7'))+section('Сетка',`<div class="ui-segments" role="group" aria-label="Вид сетки">${modes.map(([v,i,l])=>button(i,l,`data-grid="${v}"`,(c.grid||'plain')===v)).join('')}</div>`+numeric(c,'size','Шаг',8,160)+color(c,dark?'gridColorDark':'gridColorLight','Цвет сетки',dark?'#4a5262':'#c8ceda'))+section('Цвета темы',`<small class="ui-caption">Светлая</small>${color(c,'boardLight','Фон светлой темы','#DEE2E7')}<small class="ui-caption">Тёмная</small>${color(c,'boardDark','Фон тёмной темы','#171a20')}`);
 bind(c,()=>{applyCanvasStyle();queuePersist();canvas()},false);root.querySelectorAll('[data-grid]').forEach(b=>b.onclick=()=>{checkpoint();c.grid=b.dataset.grid;applyCanvasStyle();queuePersist();canvas()});
}
function bind(o,refresh,isPreset){
 const change=(k,value)=>{if(!isPreset)checkpoint();if(k==='opacity')value/=100;o[k]=value;if(k==='radius'){o.corners={tl:value,tr:value,br:value,bl:value};o.cornersLinked=true}if(k==='fill'||k==='fill2'){o.fillMode='custom';o.fillEnabled=true}if(k==='stroke')o.strokeEnabled=true;if(k==='textColor')o.textColorMode='custom';refresh()};
 root.querySelectorAll('[data-edit]').forEach(input=>input.onchange=()=>{let v=input.value;if(input.type==='number'){if(v===''||!Number.isFinite(Number(v)))return;v=Number(v);if(input.min!=='')v=Math.max(Number(input.min),v);if(input.max!=='')v=Math.min(Number(input.max),v)}change(input.dataset.edit,v)});
 root.querySelectorAll('[data-hex]').forEach(input=>input.onchange=()=>{const v='#'+input.value.replace(/^#/,'');if(!/^#[0-9a-f]{6}$/i.test(v)){input.setCustomValidity('Шесть символов HEX');input.reportValidity();return}input.setCustomValidity('');change(input.dataset.hex,v)});
 root.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>change(b.dataset.toggle,o[b.dataset.toggle]===false));
 root.querySelectorAll('[data-fill-type]').forEach(b=>b.onclick=()=>change('fillType',b.dataset.fillType));
}
function render(){if(!project()){root.innerHTML='';return}panel.classList.remove('collapsed');if(globalThis.OSMINOGPhotoEditor?.sync())return;root.hidden=false;
 if(state.selectedConnection){base();return}
 const items=selectedObjects(),preset=!items.length&&!['select','hand'].includes(state.tool);
 if(!items.length&&!preset){canvas();return}
 if(items.length>1){title.textContent=items.length+' объектов';root.innerHTML=section('Выделение',`<button data-group>${items.every(o=>o.group&&o.group===items[0].group)?'Разгруппировать':'Сгруппировать объекты'}</button>`);root.querySelector('[data-group]').onclick=()=>items.every(o=>o.group&&o.group===items[0].group)?ungroupSelection():groupSelection();return}
 const type=preset?state.tool:items[0].type,o=preset?toolPreset(type):items[0];
 if(!['shape','pen','ink','vector','image','text','note','node','brief'].includes(type)){base();return}
 const names={image:'Изображение',shape:'Фигура',text:'Текст',note:'Заметка',vector:'Контур',node:'Нода',ink:'Рисунок',pen:'Карандаш',brief:'Документ'};
 title.textContent=(names[type]||'Объект')+(preset?' · новый':'');
 let html=preset?'':section('Слой',`<input class="ui-name" aria-label="Название объекта" data-edit="name" value="${esc(o.name)}">`)+section('Положение',`<div class="ui-grid">${numeric(o,'x','X',null,null,.01)}${numeric(o,'y','Y',null,null,.01)}${numeric(o,'rotation','Поворот',-360,360,.1)}</div>`)+section('Размер',`<div class="ui-grid">${numeric(o,'w','W',1,50000,.01)}${numeric(o,'h','H',1,50000,.01)}</div>`);
 html+=section('Внешний вид',`<div class="ui-grid">${numeric(o,'opacity','Непрозр. %',0,100)}${!['ink','pen','vector','text','image'].includes(type)&&o.shapeKind!=='ellipse'?numeric(o,'radius','Радиус',0,500):''}</div>`);
 if(type==='shape'&&o.shapeKind!=='ellipse')html+=section('Углы',`<div class="ui-grid">${['tl','tr','bl','br'].map((k,i)=>`<label class="ui-value" title="${['Верхний левый','Верхний правый','Нижний левый','Нижний правый'][i]}"><span>${['↖','↗','↙','↘'][i]}</span><input type="number" min="0" max="500" aria-label="${['Верхний левый угол','Верхний правый угол','Нижний левый угол','Нижний правый угол'][i]}" data-corner="${k}" value="${round(o.corners?.[k]??o.radius??0)}"></label>`).join('')}</div>`);
 if(['shape','vector','note','node','brief','ink','pen'].includes(type))html+=paint(o,['ink','pen'].includes(type));
 if(['note','brief','node'].includes(type))html+=section('Текст',`<div class="ui-grid">${numeric(o,'fontSize','Кегль',8,200)}${numeric(o,'padding','Отступ',0,180)}</div>`+color(o,'textColor','Цвет текста','#202633'));
 if(type==='node'&&preset){html+=section('Связи',connectionPresetInspector())}

 if(type==='vector'&&!preset)html+=section('Контур','<button data-nodes>Редактировать узлы</button>');
 root.innerHTML=html;bind(o,()=>{renderAll(true);queuePersist()},preset);
 root.querySelectorAll('[data-corner]').forEach(input=>input.onchange=()=>{if(input.value===''||!Number.isFinite(Number(input.value)))return;if(!preset)checkpoint();o.corners={tl:o.radius||0,tr:o.radius||0,bl:o.radius||0,br:o.radius||0,...o.corners,[input.dataset.corner]:Math.max(0,Math.min(500,Number(input.value)))};o.cornersLinked=false;renderAll(true);queuePersist()});
 root.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>OSMINOGPhotoEditor.open({tool:b.dataset.photo}));
 root.querySelector('[data-nodes]')?.addEventListener('click',()=>{state.nodeEditId=o.id;renderAll(true)});
 root.querySelectorAll('[data-connection-preset]').forEach(input=>input.onchange=()=>{const k=input.dataset.connectionPreset;state.connectionPreset[k]=k==='width'?Number(input.value):['dashed','arrow'].includes(k)?input.value==='true':input.value;queuePersist()});
}
globalThis.renderInspector=render;
document.body.classList.add('unified-inspector');panel.classList.remove('collapsed');document.querySelector('#inspectorCollapse').hidden=false;document.querySelector('#inspector .inspector-mini')?.remove();document.querySelector('#inspector .panel-resizer')?.remove();
// Visibility is a user choice, independent of inspector rendering and photo edits.
const visibilityKey='osminogInspectorVisible';
let visible=localStorage.getItem(visibilityKey)!=='false';
function syncVisibility(){
 document.body.classList.toggle('inspector-hidden',!visible);
 const button=document.querySelector('#canvasSettings');button.setAttribute('aria-expanded',String(visible));button.setAttribute('aria-controls','inspector');button.title=visible?'Скрыть настройки':'Показать настройки';button.setAttribute('aria-label',button.title);
}
function setVisible(value){visible=!!value;localStorage.setItem(visibilityKey,String(visible));syncVisibility();applyView();return visible}
globalThis.OSMINOGInspector={show:()=>setVisible(true),hide:()=>setVisible(false),toggle:()=>setVisible(!visible),isVisible:()=>visible};
document.addEventListener('click',e=>{
 const button=e.target.closest?.('#canvasSettings,#inspectorCollapse,[data-desk-group="magic"]');if(!button)return;
 if(button.dataset.deskGroup==='magic'&&!globalThis.OSMINOGPhotoEditor?.active())return;
 e.preventDefault();e.stopImmediatePropagation();OSMINOGWorkdeskMenus?.close();OSMINOGInspector.toggle();
},true);
const collapse=document.querySelector('#inspectorCollapse');collapse.title='Скрыть настройки';collapse.setAttribute('aria-label','Скрыть настройки');
const oldApply=applyView;globalThis.applyView=function(){oldApply();OSMINOGPhotoEditor.sync()};
document.addEventListener('osminog:mode-change',()=>{document.body.classList.remove('mode-team')});
const canvasButton=document.createElement('button');canvasButton.className='ui-icon';canvasButton.title='Настройки холста';canvasButton.setAttribute('aria-label','Настройки холста');canvasButton.innerHTML=icon('grid-2x2');canvasButton.onclick=()=>{OSMINOGPhotoEditor.close();state.selected=[];state.selectedConnection=null;setTool('select');OSMINOGInspector.show();renderAll(true)};document.querySelector('#inspector .panel-head').insertBefore(canvasButton,collapse);
syncVisibility();render();
})();
