'use strict';
/* Canvas UX 4.0.8. Reuses the canonical objects, persistence and undo stack.
   No project migration, remote transport, permissions or conversation changes. */
(() => {
  if (globalThis.OSMINOGCanvasUX) return;
  const $ = s => document.querySelector(s);
  const viewport = $('#viewport'), nav = $('#workdeskTools');
  if (!viewport || !nav || !globalThis.OSMINOGWorkdesk) return;
  const MIN_ZOOM = 0.005, MAX_ZOOM = 8;
  const paths = {
    select:'<path d="m5 3 14 9-7 1-3 7Z"/>',
    hand:'<path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8c0 4-3 6-7 6-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2"/>',
    text:'<path d="M5 5h14M12 5v14M8 19h8"/>',
    note:'<path d="M5 3h14v18H5zM3 7h4M3 12h4M3 17h4M10 8h5M10 12h5"/>',
    markdown:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 15V9l3 3 3-3v6m3-3 3 3 3-3m-3 3V9"/>',
    brief:'<path d="M7 4h10v17H4V4h3m1-2h6v4H8zM8 10h5M8 14h6M8 18h4"/>',
    files:'<path d="M12 4v16M4 12h16"/>',
    file:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h5"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m4 18 6-6 4 4 3-3 3 5"/>',
    folder:'<path d="M3 6h7l2 2h9v12H3zM3 11h18"/>',
    link:'<path d="m9 15 6-6m-7 4-2 2a3 3 0 0 0 4 4l3-3m-2-8 3-3a3 3 0 0 1 4 4l-2 2"/>',
    node:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a3 3 0 0 1 3 3v6"/>',
    connect:'<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18c8 0 2-12 10-12"/>',
    shape:'<rect x="3" y="3" width="11" height="11" rx="1"/><circle cx="16" cy="16" r="5"/>',
    pen:'<path d="M3 17c8-16 4 6 11-8s2 10 7-2"/>',
    vector:'<path d="m4 20 4-12 9-5 4 4-5 9-12 4Zm0 0 8-8"/><circle cx="13" cy="11" r="2"/>',
    eraser:'<path d="m4 13 9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8H8l-4-4a2 2 0 0 1 0-3Zm4-4 9 9M12 20h9"/>',
    capture:'<path d="M4 8h3l2-3h6l2 3h3v12H4Z"/><circle cx="12" cy="13" r="3"/>',
    crop:'<path d="M7 2v15h15M2 7h15v15"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    paste:'<path d="M9 4H5v17h14V4h-4M9 2h6v5H9zM8 12h8M8 16h6"/>',
    undo:'<path d="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12"/>',
    redo:'<path d="m15 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
    code:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18m-13 4-3 3 3 3m8-6 3 3-3 3"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    zoomIn:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
    zoomOut:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6"/>',
    settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
    comment:'<path d="M3 4h18v13H9l-6 4zM7 8h10M7 12h7"/>',
    open:'<path d="M14 3h7v7m0-7L10 14M10 5H4v15h15v-6"/>',
    sparkle:'<path d="m12 3 2 6 6 3-6 2-2 7-2-7-7-2 7-3zM20 2v4m-2-2h4"/>',
    play:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m10 8 7 4-7 4z"/>',
    team:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-6a5 5 0 0 1 6 5"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    tools:'<path d="m4 16 12-12 4 4L8 20H4Z"/><path d="m4 4 4 4m8 8 4 4"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.settings}</svg>`;
  const aliases = {'legacy-md':'markdown',files:'file',folders:'folder',graphics:'image',animation:'play',
    generate:'sparkle',ask:'sparkle',properties:'settings',overview:'fit',zoomLabel:'fit',
    original:'undo','paste-image':'paste','paste-cache':'paste',chat:'comment',providers:'team',
    apps:'code','saved-layouts':'code','browser-editor':'code','edit-layout':'code',context:'download'};
  function decorateMenu() {
    for (const button of $('#deskMore').querySelectorAll('[data-desk]')) {
      const action=button.dataset.desk;
      if (!button.querySelector('svg')) button.insertAdjacentHTML('afterbegin', icon(aliases[action]||action));
      button.classList.toggle('is-current',action===state.tool);
      button.setAttribute('aria-pressed',String(action===state.tool));
      if (!button.querySelector('.desk-active-dot')) button.insertAdjacentHTML('beforeend','<span class="desk-active-dot" aria-hidden="true"></span>');
    }
  }
  function syncTools() {
    nav.querySelectorAll('[data-desk-group]').forEach(button=>{
      const group=button.dataset.deskGroup;
      const active=group===state.tool || (group==='pen'&&['vector','eraser'].includes(state.tool)) ||
        (group==='text'&&['note','brief'].includes(state.tool));
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('#canvasEraser')?.setAttribute('aria-pressed',String(state.tool==='eraser'));
    $('#canvasUndo').disabled=!state.history.length; $('#canvasRedo').disabled=!state.future.length;
    const picked=selectedObjects()[0],kind=picked?.type==='text'||state.tool==='text'?'textColor':
      ['pen','eraser','vector'].includes(state.tool)||picked?.type==='ink'?'stroke':'fill';
    const source=picked||state.toolPresets[state.tool]||{};
    $('#canvasColor').value=validColor(source[kind],kind==='textColor'&&state.theme!=='light'?'#edf0f5':'#ff2d2d');
    $('#canvasColor').dataset.kind=kind;
    decorateMenu();
  }
  // Same core tool state for toolbar clicks, keyboard shortcuts and inspector updates.
  const baseSetTool=globalThis.setTool;
  globalThis.setTool=function(tool) {
    if(tool==='text'&&!state.toolPresets.text)state.toolPresets.text={fontSize:24,fontWeight:400,padding:0,textColorMode:'auto',textColor:state.theme==='light'?'#202633':'#edf0f5'};
    baseSetTool(tool);
    viewport.style.cursor=tool==='text'?'text':tool==='eraser'?'crosshair':viewport.style.cursor;
    if (['text','pen','eraser','shape','vector'].includes(tool)) $('#inspector').classList.remove('collapsed');
    syncTools();
  };
  const baseUpdateHistory=globalThis.updateHistoryButtons;
  globalThis.updateHistoryButtons=function(){baseUpdateHistory();if($('#canvasUndo'))syncTools()};

  // Unlimited panning; zoom anchor never jumps. The scene is DOM/SVG, not a huge bitmap.
  globalThis.zoomAt=function(clientX,clientY,newScale) {
    if (!Number.isFinite(newScale)||newScale<=0) return;
    const r=viewport.getBoundingClientRect(),p=worldPoint(clientX,clientY);
    state.view.scale=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,newScale));
    state.view.x=clientX-r.left-p.x*state.view.scale; state.view.y=clientY-r.top-p.y*state.view.scale;
    applyView();queuePersist();
  };
  globalThis.fitToContent=function(){
    const all=desktopObjects().filter(o=>o.visible!==false&&[o.x,o.y,o.w,o.h].every(Number.isFinite));
    if(!all.length)return;
    let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
    for(const o of all){const a=(o.rotation||0)*Math.PI/180,w=Math.abs(o.w*Math.cos(a))+Math.abs(o.h*Math.sin(a)),h=Math.abs(o.w*Math.sin(a))+Math.abs(o.h*Math.cos(a));x1=Math.min(x1,o.x+o.w/2-w/2);x2=Math.max(x2,o.x+o.w/2+w/2);y1=Math.min(y1,o.y+o.h/2-h/2);y2=Math.max(y2,o.y+o.h/2+h/2)}
    const r=viewport.getBoundingClientRect();let left=40,right=40;
    if(!document.body.classList.contains('osminog-focus')){
      for(const [el,side] of [[$('#layersPanel'),'left'],[$('#inspector'),'right']]){
        if(!el||el.hidden||el.classList.contains('collapsed')||!el.getClientRects().length)continue;
        const box=el.getBoundingClientRect();if(getComputedStyle(el).display==='none'||box.right<=r.left||box.left>=r.right)continue;
        if(side==='left')left=Math.min(r.width*.35,Math.max(left,box.right-r.left+24));
        else right=Math.min(r.width*.35,Math.max(right,r.right-box.left+24));
      }
    }
    const width=Math.max(80,r.width-left-right),height=Math.max(80,r.height-140);
    state.view.scale=Math.max(MIN_ZOOM,Math.min(1.25,width/Math.max(1,x2-x1),height/Math.max(1,y2-y1)));
    state.view.x=left+width/2-(x1+x2)/2*state.view.scale;state.view.y=40+height/2-(y1+y2)/2*state.view.scale;
    applyView();queuePersist();
  };
  const baseApplyView=globalThis.applyView;
  globalThis.applyView=function(){baseApplyView();const p=state.view.scale*100;$('#zoomLabel').textContent=(p<1?p.toFixed(2).replace(/0$/,''):p<10?p.toFixed(1).replace(/\.0$/,''):Math.round(p))+'%';};
  // The existing click listener captured the old function by reference.
  $('#overview').addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fitToContent()},true);
  function focusMode(value) {
    if($('#app').hidden || document.querySelector('dialog[open]'))return false;
    const center=viewportCenter();globalThis.OSMINOGWorkdeskMenus?.close();closeSmartSelects();
    document.body.classList.toggle('osminog-focus',value);
    const r=viewport.getBoundingClientRect();state.view.x=r.width/2-center.x*state.view.scale;state.view.y=r.height/2-center.y*state.view.scale;
    applyView();queuePersist();return document.body.classList.contains('osminog-focus');
  }
  function editing(target){return !!target?.isContentEditable||!!target?.closest?.('input,textarea,select,[contenteditable=true]')}
  window.addEventListener('keydown',e=>{
    if($('#app').hidden||e.isComposing)return;
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&(e.code==='Backslash'||e.key==='\\')){
      e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)focusMode(!document.body.classList.contains('osminog-focus'));return;
    }
    if(e.key==='Escape'&&document.body.classList.contains('osminog-focus')&&!editing(e.target)&&!document.querySelector('dialog[open]')){
      e.preventDefault();e.stopImmediatePropagation();focusMode(false);return;
    }
    if(e.key==='Escape'&&e.target.closest?.('.canvas-object[data-type=text] [contenteditable=true]')){
      e.preventDefault();e.stopImmediatePropagation();e.target.blur();setTool('select');viewport.focus({preventScroll:true});return;
    }
    if(editing(e.target)||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]'))return;
    if(e.code==='KeyE'){e.preventDefault();e.stopImmediatePropagation();setTool('eraser')}
    if(e.shiftKey&&e.code==='Digit1'){e.preventDefault();e.stopImmediatePropagation();fitToContent()}
  },true);

  // Inline text belongs to the ordinary object model, never the notebook dialog.
  function textField(id){return $(`.canvas-object[data-id="${CSS.escape(id)}"] [data-field=text]`)}
  const baseUpdateObject=globalThis.updateObjectElement;
  globalThis.updateObjectElement=function(el,o){
    if(o.type==='text'&&o.textColorMode==='auto')o.textColor=state.theme==='light'?'#202633':'#edf0f5';
    baseUpdateObject(el,o);if(o.type!=='text')return;
    el.toggleAttribute('data-auto-text',o.autoTextSize===true);
    const field=el.querySelector('[data-field=text]');if(!field)return;
    field.style.fontFamily=o.fontFamily||'Arial, sans-serif';field.style.fontWeight=String(o.fontWeight||400);
    field.style.fontStyle=o.fontStyle||'normal';field.style.textAlign=o.textAlign||'left';field.style.lineHeight=String(o.lineHeight||1.4);
  };
  function sizeText(o,field=textField(o.id)){
    if(!o.autoTextSize||!field)return;
    o.w=Math.max(16,Math.ceil(field.offsetWidth));o.h=Math.max(16,Math.ceil(field.scrollHeight));
    const el=field.closest('.canvas-object');updateObjectElement(el,o);renderConnections();
  }
  let freshText=null;
  function editText(o,at=null){
    state.selected=[o.id];setTool('select');$('#inspector').classList.remove('collapsed');renderInspector();
    const field=textField(o.id);if(!field)return;
    field.contentEditable='true';field.spellcheck=true;field.focus({preventScroll:true});
    let range=null;
    if(at&&document.caretRangeFromPoint){const candidate=document.caretRangeFromPoint(at.x,at.y);if(candidate&&field.contains(candidate.startContainer))range=candidate}
    if(!range){range=document.createRange();range.selectNodeContents(field);range.collapse(false)}
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);state.activeEditable=field;state.textRange=range.cloneRange();sizeText(o,field);
  }
  viewport.addEventListener('pointerdown',e=>{
    if(state.tool!=='text'||e.button!==0||e.altKey||state.space||editing(e.target)||e.target.closest('button,.port,.resize-handle,.rotate-handle'))return;
    e.preventDefault();e.stopImmediatePropagation();
    const el=e.target.closest('.canvas-object[data-type=text]'),existing=el&&objects().find(o=>o.id===el.dataset.id);
    if(existing){editText(existing,{x:e.clientX,y:e.clientY});return}
    const p=worldPoint(e.clientX,e.clientY),preset=state.toolPresets.text||{};
    const o=createObject('text',{fontSize:24,fontWeight:400,textColor:state.theme==='light'?'#202633':'#edf0f5',...preset,
      x:p.x,y:p.y,text:'',html:'',w:24,h:34,fillEnabled:false,strokeEnabled:false,padding:0,radius:0,
      corners:{tl:0,tr:0,br:0,bl:0},autoTextSize:true});
    freshText={id:o.id,projectId:project().id};editText(o);
  },true);
  document.addEventListener('input',e=>{
    const field=e.target.closest?.('.canvas-object[data-type=text] [data-field=text]');if(!field)return;
    const o=objects().find(o=>o.id===field.closest('.canvas-object').dataset.id);if(o){sizeText(o,field);queuePersist()}
  });
  document.addEventListener('focusout',e=>{
    const field=e.target.closest?.('.canvas-object[data-type=text] [data-field=text]');if(!field||!freshText)return;
    const item=freshText;if(field.closest('.canvas-object').dataset.id!==item.id)return;
    // Let the native blur handlers save first, then discard an unused text insertion.
    queueMicrotask(()=>{
      if(project()?.id!==item.projectId)return;
      const o=objects().find(o=>o.id===item.id);if(o&&!String(o.text||'').trim()&&document.activeElement!==field){
        project().objects=objects().filter(o=>o.id!==item.id);state.selected=state.selected.filter(id=>id!==item.id);renderAll();queuePersist();
      }
      if(freshText===item)freshText=null;
    });
  });
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textProperties={fontSize:[1,512],fontWeight:[100,900],lineHeight:[0.6,4],x:[-1e7,1e7],y:[-1e7,1e7]};
  function textInspector(o,isPreset){
    const root=$('#inspectorBody');$('#inspectorTitle').textContent=isPreset?'Текст':o.name||'Текст';
    const field=(key,label,type='text',value=o[key]??'')=>`<label class="canvas-text-field">${label}<input data-canvas-text-prop="${key}" type="${type}" value="${esc(value)}" ${textProperties[key]?`min="${textProperties[key][0]}" max="${textProperties[key][1]}" step="${key==='lineHeight'?'.1':'1'}"`:''}></label>`;
    root.innerHTML=`<section class="canvas-text-properties"><p class="canvas-text-hint">${isPreset?'Нажмите на доску и пишите. Без карточки и блокнота.':'Текст на холсте · двойной клик для редактирования'}</p>
      <label class="canvas-text-field">Шрифт<select data-canvas-text-prop="fontFamily" data-native><option value="Arial, sans-serif">Arial</option><option value="system-ui, sans-serif">Системный</option><option value="Georgia, serif">Georgia</option><option value="Verdana, sans-serif">Verdana</option><option value="monospace">Моноширинный</option></select></label>
      <div class="canvas-text-grid">${field('fontSize','Размер','number',o.fontSize||24)}${field('lineHeight','Интервал','number',o.lineHeight||1.4)}</div>
      <div class="canvas-text-grid"><label class="canvas-text-field">Начертание<select data-native data-canvas-text-prop="fontWeight"><option value="400">Обычный</option><option value="500">Средний</option><option value="600">Полужирный</option><option value="700">Жирный</option><option value="800">Очень жирный</option></select></label>
      <label class="canvas-text-field">Стиль<select data-native data-canvas-text-prop="fontStyle"><option value="normal">Прямой</option><option value="italic">Курсив</option></select></label></div>
      ${field('textColor','Цвет текста','color',validColor(o.textColor,state.theme==='light'?'#202633':'#edf0f5'))}
      <label class="canvas-text-field">Выравнивание<select data-native data-canvas-text-prop="textAlign"><option value="left">По левому краю</option><option value="center">По центру</option><option value="right">По правому краю</option></select></label>
      ${isPreset?'':`<div class="canvas-text-grid">${field('x','X','number',o.x)}${field('y','Y','number',o.y)}</div><button type="button" class="soft-btn" id="canvasTextDuplicate">${icon('copy')}Дублировать текст</button>`}</section>`;
    for(const input of root.querySelectorAll('[data-canvas-text-prop]')){
      const key=input.dataset.canvasTextProp;if(input.tagName==='SELECT')input.value=String(o[key]??{fontFamily:'Arial, sans-serif',fontWeight:400,fontStyle:'normal',textAlign:'left'}[key]);
      input.addEventListener('focus',()=>{if(!isPreset)checkpoint()},{once:true});
      input.addEventListener('input',()=>{
        let value=input.value;if(textProperties[key]){value=Number(value);if(!Number.isFinite(value)||input.value==='')return;value=Math.max(textProperties[key][0],Math.min(textProperties[key][1],value))}
        o[key]=value;if(key==='textColor')o.textColorMode='custom';
        if(!isPreset){const el=textField(o.id)?.closest('.canvas-object');if(el){updateObjectElement(el,o);sizeText(o)}renderConnections()}
        queuePersist();syncTools();
      });
    }
    $('#canvasTextDuplicate')?.addEventListener('click',()=>duplicateSelection());
  }
  const baseRenderInspector=globalThis.renderInspector;
  globalThis.renderInspector=function(){
    baseRenderInspector();const picked=selectedObjects();
    if(!state.selectedConnection&&picked.length===1&&picked[0].type==='text')textInspector(picked[0],false);
    else if(!picked.length&&state.tool==='text'){
      state.toolPresets.text=state.toolPresets.text||{fontSize:24,fontWeight:400,padding:0,textColor:state.theme==='light'?'#202633':'#edf0f5'};
      textInspector(state.toolPresets.text,true);
    } else if(!picked.length&&state.tool==='eraser'){
      $('#inspectorTitle').textContent='Ластик';$('#inspectorBody').innerHTML='<p class="canvas-text-hint">Проведите по нарисованному штриху, чтобы удалить его целиком. Изображения, текст и другие объекты не стираются. Ctrl + Z отменяет стирание.</p>';
    }
    if($('#canvasUndo'))syncTools();
  };

  // A stroke eraser only removes freehand ink. One gesture = one undo entry.
  let erasing=null;
  function eraseAt(e){
    if(!erasing||erasing.projectId!==project()?.id)return;
    const hits=[];
    for(const el of document.querySelectorAll('.canvas-object[data-type=ink]')){
      if(getComputedStyle(el).display==='none')continue;
      const path=el.querySelector('.ink-path');let matrix;try{matrix=path?.getScreenCTM()?.inverse()}catch{continue}if(!matrix)continue;
      if([[0,0],[-5,0],[5,0],[0,-5],[0,5]].some(([dx,dy])=>path.isPointInStroke(new DOMPoint(e.clientX+dx,e.clientY+dy).matrixTransform(matrix))))hits.push(el.dataset.id);
    }
    if(!hits.length)return;if(!erasing.changed){checkpoint();erasing.changed=true}
    const ids=new Set(hits);project().objects=objects().filter(o=>!ids.has(o.id));project().connections=project().connections.filter(c=>!ids.has(c.from)&&!ids.has(c.to));
    state.selected=state.selected.filter(id=>!ids.has(id));renderObjects();renderConnections();renderLayers();queuePersist();
  }
  viewport.addEventListener('pointerdown',e=>{
    if(state.tool!=='eraser'||e.button!==0||e.altKey||state.space)return;
    e.preventDefault();e.stopImmediatePropagation();erasing={pointerId:e.pointerId,projectId:project()?.id,changed:false};viewport.setPointerCapture(e.pointerId);eraseAt(e);
  },true);
  viewport.addEventListener('pointermove',e=>{if(erasing&&erasing.pointerId===e.pointerId){e.preventDefault();e.stopImmediatePropagation();eraseAt(e)}},true);
  function endErase(e){if(!erasing||e.pointerId!==erasing.pointerId)return;if(erasing.changed)logChange('Стерты штрихи');erasing=null;syncTools()}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,endErase,true);

  // One floating toolbar; all lesser-used actions remain in accessible menus.
  for(const button of nav.querySelectorAll('[data-desk-group]')){
    const id=button.dataset.deskGroup;button.innerHTML=icon(id)+'<span class="desk-active-dot" aria-hidden="true"></span>';
    button.title+=' · другие действия: правая кнопка / удержание';button.setAttribute('aria-haspopup','true');
  }
  function addButton(id,label,iconName,action){const b=document.createElement('button');b.type='button';b.id=id;b.title=label;b.setAttribute('aria-label',label);b.innerHTML=icon(iconName);b.addEventListener('click',action);nav.append(b);return b}
  const swatch=document.createElement('label');swatch.id='canvasColorWrap';swatch.title='Цвет активного инструмента';swatch.innerHTML='<input id="canvasColor" type="color" aria-label="Цвет активного инструмента">';nav.append(swatch);
  let colorCheckpoint=false;
  $('#canvasColor').addEventListener('pointerdown',()=>{colorCheckpoint=false});
  $('#canvasColor').addEventListener('input',e=>{const key=e.target.dataset.kind,picked=selectedObjects();if(picked.length){if(!colorCheckpoint){checkpoint();colorCheckpoint=true}for(const o of picked){o[key]=e.target.value;if(key==='textColor')o.textColorMode='custom'}renderObjects()}else{state.toolPresets[state.tool]=state.toolPresets[state.tool]||{};state.toolPresets[state.tool][key]=e.target.value;if(key==='textColor')state.toolPresets[state.tool].textColorMode='custom'}queuePersist()});
  addButton('canvasEraser','Ластик · E','eraser',()=>setTool('eraser'));
  addButton('canvasUndo','Отменить · Ctrl + Z','undo',()=>undo());
  addButton('canvasRedo','Повторить · Ctrl + Shift + Z','redo',()=>redo());
  const restore=document.createElement('button');restore.id='canvasToolsRestore';restore.type='button';restore.className='icon-btn';restore.title='Показать инструменты';restore.setAttribute('aria-label',restore.title);restore.innerHTML=icon('tools');restore.hidden=true;$('.top-actions').prepend(restore);
  restore.onclick=()=>{nav.hidden=false;restore.hidden=true};
  addButton('canvasToolsClose','Скрыть панель инструментов','close',()=>{globalThis.OSMINOGWorkdeskMenus?.close();nav.hidden=true;restore.hidden=false});
  const zoom=document.createElement('button');zoom.id='canvasFit';zoom.type='button';zoom.title='Вся доска · Shift + 1';zoom.setAttribute('aria-label',zoom.title);zoom.innerHTML=icon('fit');zoom.onclick=()=>fitToContent();nav.prepend(zoom);
  viewport.setAttribute('aria-keyshortcuts','Control+Backslash Meta+Backslash');
  $('#canvasToolsClose').title+=' · весь интерфейс: Ctrl + \\';
  globalThis.OSMINOGCanvasUX={version:'4.0.8',focusMode,decorateMenu,editText,sizeText,minZoom:MIN_ZOOM,maxZoom:MAX_ZOOM};
  renderAll(true);syncTools();applyView();
})();
