'use strict';
(function(root){
 const page=Object.freeze({id:'surfaces',title:'Панели и фон',description:'Свои цвета для верхней панели, нижней панели и пространства между окнами.',icon:'surfaces',tone:'pink'});
 const definitions=Object.freeze([
  {id:'top',title:'Верхняя панель',hint:'Панель навигации и вкладок',icon:'workspace',tone:'blue'},
  {id:'bottom',title:'Нижняя панель',hint:'Кнопки браузера и рабочие столы',icon:'settings',tone:'purple'},
  {id:'workspace',title:'Фон рабочего пространства',hint:'Пространство между окнами браузера',icon:'appearance',tone:'pink'}
 ]);
 const presets=Object.freeze([
  {id:'slate',name:'Графит',light:['#E4E9F2','#C8D1E2'],dark:['#253144','#121B2A']},
  {id:'blue',name:'Океан',light:['#C5E4FF','#DCD9FF'],dark:['#174A70','#292754']},
  {id:'violet',name:'Лаванда',light:['#E9D8FF','#CCD9FF'],dark:['#51376B','#263C61']},
  {id:'rose',name:'Роза',light:['#FFE0E8','#F8D6C0'],dark:['#6C354D','#4B304B']},
  {id:'forest',name:'Лес',light:['#CFEBDC','#D7E8CE'],dark:['#1E5148','#243C42']},
  {id:'sand',name:'Песок',light:['#F3E6CA','#F2DCC8'],dark:['#594B30','#403C3D']}
 ]);
 function markup({heading}){
  const card=def=>`<section class="settings-card chrome-surface-card" data-settings-section="surface-${def.id}" data-pages="surfaces" data-keywords="${def.id} color gradient opacity цвет градиент прозрачность непрозрачность панель фон" hidden>
   ${heading(def.icon,def.tone,def.title,def.hint)}
   <div class="surface-mode" role="group" aria-label="Заливка: ${def.title}"><button type="button" data-surface="${def.id}" data-surface-mode="solid" aria-pressed="true">Один цвет</button><button type="button" data-surface="${def.id}" data-surface-mode="gradient" aria-pressed="false">Градиент</button></div>
   <div class="surface-presets" role="group" aria-label="Палитры: ${def.title}">${presets.map(p=>`<button type="button" class="surface-swatch" data-surface="${def.id}" data-surface-preset="${p.id}" aria-label="${p.name}: ${def.title}" title="${p.name}"><span aria-hidden="true"></span></button>`).join('')}</div>
   <div class="surface-colors"><label for="surface-${def.id}-color"><span data-surface-color-label="${def.id}">Цвет</span><span class="surface-color-control"><input type="color" id="surface-${def.id}-color" data-surface="${def.id}" data-surface-field="color" value="#253144"><output id="surface-${def.id}-color-value" for="surface-${def.id}-color">#253144</output></span></label><label for="surface-${def.id}-end-color" data-surface-gradient="${def.id}"><span>Второй цвет</span><span class="surface-color-control"><input type="color" id="surface-${def.id}-end-color" data-surface="${def.id}" data-surface-field="endColor" value="#121B2A"><output id="surface-${def.id}-end-color-value" for="surface-${def.id}-end-color">#121B2A</output></span></label></div>
   <div class="surface-slider" data-surface-gradient="${def.id}"><label for="surface-${def.id}-angle">Направление</label><output id="surface-${def.id}-angle-value" for="surface-${def.id}-angle">135°</output><input type="range" id="surface-${def.id}-angle" data-surface="${def.id}" data-surface-field="angle" min="0" max="359" step="1" value="135"></div>
   ${def.id==='workspace'?'':`<div class="surface-slider"><label for="surface-${def.id}-opacity">Непрозрачность</label><output id="surface-${def.id}-opacity-value" for="surface-${def.id}-opacity">100%</output><input type="range" id="surface-${def.id}-opacity" data-surface="${def.id}" data-surface-field="opacity" min="0" max="100" step="1" value="100" aria-describedby="surface-${def.id}-opacity-hint"><small id="surface-${def.id}-opacity-hint">Прозрачность фона; текст и кнопки остаются читаемыми.</small></div>`}
  </section>`;
  return `<section class="settings-card surface-theme-card" data-settings-section="surface-theme" data-pages="surfaces" data-keywords="theme light dark темы светлая темная панели фон цвет" hidden>
   ${heading('surfaces','pink','Цвета для выбранной темы','Светлая и тёмная темы сохраняются отдельно.')}
   <div class="surface-theme-switch" role="group" aria-label="Тема для настройки"><button type="button" data-surface-theme="light" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"></path></svg>Светлая</button><button type="button" data-surface-theme="dark" aria-pressed="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.5 14A8.8 8.8 0 0 1 10 3.5 8.8 8.8 0 1 0 20.5 14Z"></path></svg>Тёмная</button></div>
   <div class="surface-preview" aria-label="Предпросмотр оформления" role="img"><div class="surface-preview-top"><i></i><i></i><span></span></div><div class="surface-preview-workspace"><i></i><i></i><i></i></div><div class="surface-preview-bottom"><i></i><i></i><span></span><i></i></div></div>
   <div class="surface-theme-footer"><p id="surface-theme-note" class="hint">Изменения сразу видны в браузере.</p><button type="button" id="surface-theme-reset">Сбросить эту тему</button></div>
  </section>${definitions.map(card).join('')}`;
 }
 function create({dialog,model,setAppearance,setTheme}){
  const A=root.MouseAppearance,$=selector=>dialog.querySelector(selector),$$=selector=>dialog.querySelectorAll(selector);
  const theme=()=>model.theme==='dark'?'dark':'light';
  function change(name,values){setAppearance(A.changeSurface(model.appearance,theme(),name,values));sync();}
  function sync(){
   const selected=theme(),configured=!!model.appearance?.surfaces?.[selected];
   for(const button of $$('[data-surface-theme]'))button.setAttribute('aria-pressed',String(button.dataset.surfaceTheme===selected));
   const preview=$('.surface-preview');preview.dataset.theme=selected;
   for(const def of definitions){
    const name=def.id,value=A.getSurface(model.appearance,selected,name);
    for(const button of $$('[data-surface="'+name+'"][data-surface-mode]'))button.setAttribute('aria-pressed',String(button.dataset.surfaceMode===value.mode));
    for(const element of $$('[data-surface-gradient="'+name+'"]'))element.hidden=value.mode!=='gradient';
    $('[data-surface-color-label="'+name+'"]').textContent=value.mode==='gradient'?'Первый цвет':'Цвет';
    for(const field of ['color','endColor','angle','opacity']){
     const suffix=field==='endColor'?'end-color':field,input=$('#surface-'+name+'-'+suffix),output=$('#surface-'+name+'-'+suffix+'-value');if(!input)continue;
     const string=String(value[field]);if(input.value.toUpperCase()!==string.toUpperCase())input.value=string;
     output.textContent=string+(field==='angle'?'°':field==='opacity'?'%':'');
    }
    for(const button of $$('[data-surface="'+name+'"][data-surface-preset]')){
     const p=presets.find(item=>item.id===button.dataset.surfacePreset),colors=p[selected];button.style.setProperty('--surface-swatch',A.surfaceCSS({...value,color:colors[0],endColor:colors[1],opacity:100}));button.setAttribute('aria-pressed',String(value.color===colors[0]&&(value.mode==='solid'||value.endColor===colors[1])));
    }
    preview.style.setProperty('--preview-'+name,A.surfaceCSS(value));
   }
   $('#surface-theme-reset').disabled=!configured;
   $('#surface-theme-note').textContent=model.privateMode?'В инкогнито цвета действуют только в этой сессии.':configured?'Цвета настроены для этой темы.':'Используются стандартные цвета этой темы.';
  }
  for(const button of $$('[data-surface-theme]'))button.addEventListener('click',()=>{setTheme(button.dataset.surfaceTheme);sync();});
  for(const button of $$('[data-surface-mode]'))button.addEventListener('click',()=>change(button.dataset.surface,{mode:button.dataset.surfaceMode}));
  for(const button of $$('[data-surface-preset]'))button.addEventListener('click',()=>{const colors=presets.find(p=>p.id===button.dataset.surfacePreset)[theme()];change(button.dataset.surface,{color:colors[0],endColor:colors[1]});});
  for(const input of $$('[data-surface-field]'))input.addEventListener('input',()=>change(input.dataset.surface,{[input.dataset.surfaceField]:input.type==='range'?Number(input.value):input.value}));
  $('#surface-theme-reset').addEventListener('click',()=>{setAppearance(A.resetSurfaces(model.appearance,theme()));sync();});
  sync();return Object.freeze({sync});
 }
 const api=Object.freeze({page,definitions,presets,markup,create});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseChromeSurfaceSettings=api;
})(globalThis);
