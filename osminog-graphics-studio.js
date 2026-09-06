"use strict";
(()=>{
  if(globalThis.OSMINOGGraphicsStudio)return;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  let win=null,canvas=null,currentTool="select",drawing=null,history=[],historyIndex=-1,historyLock=false,resizeObserver=null,nodeHandles=[],sourceSelectionIds=[],zoom=1,spaceHeld=false,panState=null,applyingToCanvas=false,documentBackground="#ffffff",documentTransparent=true;
  const icon=(path)=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  const toolButton=(id,label,path)=>`<button type="button" data-gfx-tool="${id}" title="${label}" aria-label="${label}" aria-pressed="false">${icon(path)}<span>${label}</span></button>`;
  function markup(){return `
    <div class="graphics-studio-shell graphics-v2">
      <aside class="graphics-studio-tools" aria-label="Инструменты">
        ${toolButton("select","Выбор","m5 3 13 9-6 1-3 6Z")}
        ${toolButton("nodes","Узлы","M5 5h4v4H5zM15 15h4v4h-4zM9 7c5 0 3 10 8 10")}
        ${toolButton("draw","Кисть","M4 20c5 0 7-2 7-6 0-2 1-3 3-3l6-7M14 11l6-7")}
        ${toolButton("eraser","Ластик","m5 16 8-11 6 5-8 9H7zM11 19h9")}
        ${toolButton("pen","Перо","m4 20 4-1L19 8l-3-3L5 16Z")}
        ${toolButton("line","Линия","M4 20 20 4")}
        ${toolButton("rect","Прямоугольник","M4 5h16v14H4Z")}
        ${toolButton("ellipse","Эллипс","M4 12c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7-8-3-8-7Z")}
        ${toolButton("star","Звезда","m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2L12 18.3 6.4 21l1.1-6.2L3 10.4l6.2-.9Z")}
        ${toolButton("text","Текст","M5 5h14M12 5v14M8 19h8")}
        ${toolButton("image","Изображение","M4 5h16v14H4zM6 16l4-4 3 3 2-2 3 3M15 9h.01")}
        <span class="graphics-tool-divider" aria-hidden="true"></span>
        <button type="button" class="gfx-zoom-button" data-gfx-action="zoom-out" title="Уменьшить">${icon("M6 12h12")}</button>
        <button type="button" class="gfx-zoom-readout" data-gfx-action="zoom-reset" title="Масштаб 100%"><b data-gfx-zoom>100%</b></button>
        <button type="button" class="gfx-zoom-button" data-gfx-action="zoom-in" title="Увеличить">${icon("M12 6v12M6 12h12")}</button>
        <button type="button" class="gfx-zoom-button" data-gfx-action="zoom-fit" title="Показать всё">${icon("M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4")}</button>
      </aside>
      <section class="graphics-studio-center">
        <div class="graphics-studio-toolbar">
          <button type="button" data-gfx-action="toggle-layers" title="Показать или скрыть слои">Слои</button>
          <button type="button" data-gfx-action="toggle-inspector" title="Показать или скрыть свойства">Свойства</button>
          <button type="button" data-gfx-action="new">Новый</button>
          <button type="button" data-gfx-action="open-selection">Из выделенного</button>
          <button type="button" data-gfx-action="undo" title="Отменить">↶</button>
          <button type="button" data-gfx-action="redo" title="Повторить">↷</button>
          <button type="button" data-gfx-action="finish" class="primary">Применить</button>
          <span data-gfx-status>Graphics Studio v2.2 · готово</span>
          <button type="button" data-gfx-action="export-svg">SVG</button>
          <button type="button" data-gfx-action="export">PNG</button>
          <button type="button" data-gfx-action="apply" class="primary">На холст</button>
        </div>
        <div class="graphics-studio-stage"><canvas data-gfx-canvas></canvas></div>
      </section>
      <aside class="graphics-studio-inspector">
        <header><strong>Графика · свойства</strong><small data-gfx-selection>Нет выделения</small></header>
        <details open><summary>Холст</summary>
          <div class="gfx-section gfx-document-section">
            <label>Фон <input data-gfx-bg-color type="color" value="#ffffff"></label>
            <label class="gfx-checkbox-row"><span>Прозрачный</span><input data-gfx-bg-transparent type="checkbox" checked></label>
          </div>
        </details>
        <details open><summary>Кисть и ластик</summary>
          <div class="gfx-section">
            <label>Размер <input data-gfx-brush="width" type="range" min="1" max="100" value="4"><output data-gfx-brush-output="width">4</output></label>
            <label>Сглаживание <input data-gfx-brush="smoothing" type="range" min="0" max="20" value="4"><output data-gfx-brush-output="smoothing">4</output></label>
            <label>Непрозрачность <input data-gfx-brush="opacity" type="range" min="0.05" max="1" step="0.05" value="1"><output data-gfx-brush-output="opacity">100%</output></label>
          </div><small class="gfx-help">B — кисть, E — ластик. Размер и цвет можно менять до рисования.</small>
        </details>
        <details open><summary>Заливка и обводка</summary>
          <div class="gfx-section">
            <label>Заливка <input data-gfx-prop="fill" type="color" value="#8b6cff"></label>
            <label>Второй цвет <input data-gfx-prop="fill2" type="color" value="#3bd1b3"></label>
            <label>Тип <select data-gfx-prop="fillMode"><option value="solid">Цвет</option><option value="gradient">Градиент</option><option value="none">Нет</option></select></label>
            <label>Угол <input data-gfx-prop="gradientAngle" type="range" min="0" max="360" step="1" value="0"><output data-gfx-output="gradientAngle">0°</output></label>
            <label>Обводка <input data-gfx-prop="stroke" type="color" value="#20242d"></label>
            <label>Толщина <input data-gfx-prop="strokeWidth" type="range" min="0" max="80" step="1" value="3"><output data-gfx-output="strokeWidth">3</output></label>
            <label>Пунктир <select data-gfx-prop="strokeDash"><option value="solid">Сплошная</option><option value="dash">Штрих</option><option value="dot">Точки</option></select></label>
            <label>Концы <select data-gfx-prop="strokeLineCap"><option value="round">Круглые</option><option value="butt">Прямые</option><option value="square">Квадратные</option></select></label>
            <label>Прозрачность <input data-gfx-prop="opacity" type="range" min="0" max="1" step=".01" value="1"><output data-gfx-output="opacity">100%</output></label>
          </div>
        </details>
        <details><summary>Геометрия</summary>
          <div class="graphics-studio-geometry">
            <label>X <input data-gfx-prop="left" type="number" step="1"></label><label>Y <input data-gfx-prop="top" type="number" step="1"></label>
            <label>W <input data-gfx-prop="width" type="number" min="1" step="1"></label><label>H <input data-gfx-prop="height" type="number" min="1" step="1"></label>
            <label>↻ <input data-gfx-prop="angle" type="number" step="1"></label><label>R <input data-gfx-prop="cornerRadius" type="number" min="0" step="1"></label>
          </div>
          <div class="gfx-action-grid compact">
            <button data-gfx-action="flip-x">↔ Отразить</button><button data-gfx-action="flip-y">↕ Отразить</button>
            <button data-gfx-action="rotate-left">−90°</button><button data-gfx-action="rotate-right">+90°</button>
          </div>
        </details>
        <details><summary>Выравнивание</summary>
          <div class="gfx-action-grid tri">
            <button data-gfx-action="align-left">⇤</button><button data-gfx-action="align-center">↔</button><button data-gfx-action="align-right">⇥</button>
            <button data-gfx-action="align-top">⇡</button><button data-gfx-action="align-middle">↕</button><button data-gfx-action="align-bottom">⇣</button>
            <button data-gfx-action="distribute-h">Расп. ↔</button><button data-gfx-action="distribute-v">Расп. ↕</button><button data-gfx-action="center-stage">По центру</button>
          </div>
        </details>
        <details><summary>Контур</summary>
          <div class="gfx-action-grid">
            <button data-gfx-action="smooth">Сгладить</button><button data-gfx-action="simplify">Упростить</button>
            <button data-gfx-action="close-path">Замкнуть</button><button data-gfx-action="reverse-path">Развернуть</button>
            <button data-gfx-action="stroke-path">Обводка → контур</button><button data-gfx-action="nodes">Узлы</button>
          </div>
        </details>
        <details><summary>Boolean и маски</summary>
          <div class="gfx-action-grid">
            <button data-gfx-action="boolean-union">Объединить</button><button data-gfx-action="boolean-subtract">Вычесть</button>
            <button data-gfx-action="boolean-intersect">Пересечь</button><button data-gfx-action="boolean-exclude">Исключить</button>
            <button data-gfx-action="mask">Маска</button><button data-gfx-action="unmask">Снять маску</button>
          </div><small class="gfx-help">Boolean в v2 неразрушающий: исходные формы сохраняются внутри группы и могут быть разгруппированы.</small>
        </details>
        <details open><summary>Изображение и фон</summary>
          <div class="gfx-section">
            <label>Порог белого <input data-gfx-white-threshold type="range" min="120" max="250" value="205"><output data-gfx-white-output>205</output></label>
            <label>Мягкость края <input data-gfx-white-softness type="range" min="1" max="80" value="30"><output data-gfx-softness-output>30</output></label>
          </div><div class="gfx-action-grid"><button data-gfx-action="remove-white">Убрать светлый фон</button><button data-gfx-action="restore-image">Вернуть исходник</button></div>
          <small class="gfx-help">Для подписи на светлой бумаге. Тёмные участки сохраняются; светлые детали тоже могут исчезнуть. Результат можно отменить.</small>
          <div class="gfx-action-grid">
            <button data-gfx-action="filter-gray">Ч/Б</button><button data-gfx-action="filter-sepia">Сепия</button>
            <button data-gfx-action="filter-bright">Светлее</button><button data-gfx-action="filter-contrast">Контраст</button>
            <button data-gfx-action="filter-blur">Размытие</button><button data-gfx-action="filter-reset">Сброс</button>
          </div>
        </details>
        <details open data-gfx-text-section hidden><summary>Текст</summary><div class="gfx-section">
          <label class="gfx-wide">Содержание<textarea data-gfx-prop="text" aria-label="Содержание текста"></textarea></label>
          <label data-gfx-font-size>Размер <input data-gfx-prop="fontSize" type="number" min="6" max="240" value="42"></label>
          <label data-gfx-font-family>Шрифт <select data-gfx-prop="fontFamily"><option>Inter</option><option>Arial</option><option>Georgia</option><option>monospace</option></select></label>
          <label>Начертание <select data-gfx-prop="fontWeight"><option value="400">Обычный</option><option value="700">Жирный</option></select></label>
          <label>Наклон <select data-gfx-prop="fontStyle"><option value="normal">Обычный</option><option value="italic">Курсив</option></select></label>
          <label>Выравнивание <select data-gfx-prop="textAlign"><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
          <label>Интервал <input data-gfx-prop="lineHeight" type="number" min="0.8" max="3" step="0.1" value="1.2"></label>
        </div></details>
        <details><summary>Экспорт</summary><div class="gfx-section">
          <label>Масштаб PNG <select data-gfx-export-scale><option value="1">1×</option><option value="2" selected>2×</option><option value="3">3×</option></select></label>
        </div><small class="gfx-help">Экспорт охватывает весь рисунок и не зависит от масштаба просмотра. Сетка в файл не попадает.</small></details>
        <div class="graphics-studio-actions">
          <button type="button" data-gfx-action="duplicate">Дублировать</button><button type="button" data-gfx-action="delete">Удалить</button>
          <button type="button" data-gfx-action="group">Группа</button><button type="button" data-gfx-action="ungroup">Разгруппировать</button>
          <button type="button" data-gfx-action="front">На передний</button><button type="button" data-gfx-action="back">На задний</button>
        </div>
        <section class="graphics-studio-layers"><strong>Слои</strong><div data-gfx-layers></div></section>
      </aside>
      <input data-gfx-file type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>
    </div>`}

  const SERIAL_PROPS=["name","lockedByStudio","gfxFill2","gfxGradientAngle","booleanOp","gfxOriginalSrc","studioId"];
  let imageBusy=false;
  function studioId(o){if(!o.studioId)o.studioId=`gfx-${crypto.randomUUID()}`;return o.studioId}
  function documentState(){return {version:1,background:documentBackground,transparent:documentTransparent,canvas:canvas.toObject(SERIAL_PROPS)}}
  function configureBrush(){
    if(!canvas?.freeDrawingBrush||!win)return;
    const f=fapi(),width=Number($('[data-gfx-brush="width"]',win).value)||4,opacity=Number($('[data-gfx-brush="opacity"]',win).value),smoothing=Number($('[data-gfx-brush="smoothing"]',win).value);
    const color=new f.Color(currentTool==="eraser"?"#000000":$('[data-gfx-prop="stroke"]',win).value);
    color.setAlpha(opacity);canvas.freeDrawingBrush.color=color.toRgba();canvas.freeDrawingBrush.width=width;canvas.freeDrawingBrush.decimate=smoothing;
    for(const key of ["width","smoothing","opacity"]){const value=$(`[data-gfx-brush="${key}"]`,win).value;$(`[data-gfx-brush-output="${key}"]`,win).value=key==="opacity"?`${Math.round(Number(value)*100)}%`:value}
  }
  function installPanelLayout(){
    const shell=$(".graphics-studio-shell",win),center=$(".graphics-studio-center",win),tools=$(".graphics-studio-tools",win);
    center.append(tools);
    for(const side of ["left","right"]){
      const handle=document.createElement("div");handle.className=`gfx-panel-resizer ${side}`;handle.title=side==="left"?"Ширина слоёв":"Ширина свойств";shell.append(handle);
      handle.addEventListener("pointerdown",event=>{
        event.preventDefault();event.stopPropagation();handle.setPointerCapture(event.pointerId);
        handle.onpointermove=e=>{
          const r=shell.getBoundingClientRect(),other=$(side==="left"?".graphics-studio-inspector":".graphics-studio-layers-panel",win).getBoundingClientRect().width;
          const width=clamp(side==="left"?e.clientX-r.left:r.right-e.clientX,side==="left"?120:250,Math.max(side==="left"?120:250,r.width-other-280));
          shell.style.setProperty(side==="left"?"--gfx-layers-width":"--gfx-inspector-width",`${width}px`);
        };
        const done=()=>{handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null};handle.onpointerup=done;handle.onpointercancel=done;
      });
    }
  }
  async function removeWhiteBackground(){
    const o=active();if(!o||!/image/i.test(o.type))throw Error("Выберите изображение для удаления фона");
    if(imageBusy)throw Error("Дождитесь обработки изображения");imageBusy=true;
    try{
      status("Удаляю светлый фон…");await new Promise(requestAnimationFrame);
      const f=fapi(),src=o.gfxOriginalSrc||o.getSrc(),image=await f.FabricImage.fromURL(src),el=image.getElement();
      const width=image.width,height=image.height;if(width*height>16000000)throw Error("Для удаления фона используйте изображение до 16 мегапикселей");
      const surface=document.createElement("canvas");surface.width=width;surface.height=height;const ctx=surface.getContext("2d",{willReadFrequently:true});ctx.drawImage(el,0,0);
      const pixels=ctx.getImageData(0,0,width,height),d=pixels.data,threshold=Number($('[data-gfx-white-threshold]',win).value),softness=Number($('[data-gfx-white-softness]',win).value);
      for(let y=0;y<height;y++){
        for(let i=y*width*4,end=i+width*4;i<end;i+=4){const light=Math.min(d[i],d[i+1],d[i+2]),t=clamp((light-threshold)/softness,0,1);d[i+3]=Math.round(d[i+3]*(1-t*t*(3-2*t)))}
        if(y%128===127)await new Promise(requestAnimationFrame);
      }
      ctx.putImageData(pixels,0,0);const scaleX=o.scaleX,scaleY=o.scaleY;await o.setSrc(surface.toDataURL("image/png"));o.set({scaleX,scaleY});o.gfxOriginalSrc=src;o.applyFilters?.();
      documentTransparent=true;updateStageBackground();o.setCoords();snapshot();refresh();status("Светлый фон удалён · можно отменить");return{ok:true,id:studioId(o)};
    }finally{imageBusy=false}
  }
  async function restoreImage(){const o=active();if(!o?.gfxOriginalSrc)throw Error("У выбранного изображения нет сохранённого исходника");await o.setSrc(o.gfxOriginalSrc);o.filters=[];o.applyFilters?.();o.setCoords();snapshot();refresh();return{ok:true,id:studioId(o)}}
  function needsRaster(){const check=o=>o.globalCompositeOperation&&o.globalCompositeOperation!=="source-over"||o.booleanOp||o.getObjects?.().some(check);return canvas.getObjects().some(check)}
  function exportBounds(){const items=canvas.getObjects().filter(o=>o.visible!==false&&o.name!=="__node");if(!items.length)throw Error("На холсте редактора нет рисунка");const b=getBounds(items),pad=4;return {left:Math.floor(b.left-pad),top:Math.floor(b.top-pad),width:Math.ceil(b.right-b.left+2*pad),height:Math.ceil(b.bottom-b.top+2*pad)}}
  function exportPng(multiplier=Number($('[data-gfx-export-scale]',win)?.value)||2){
    const b=exportBounds();if(b.width*b.height*multiplier*multiplier>24000000)throw Error("Результат слишком большой: уменьшите масштаб экспорта или размер рисунка");
    const vt=canvas.viewportTransform.slice(),visible=nodeHandles.map(h=>h.visible);
    try{nodeHandles.forEach(h=>h.visible=false);canvas.setViewportTransform([1,0,0,1,0,0]);return{src:canvas.toDataURL({format:"png",multiplier,...b}),bounds:b}}
    finally{nodeHandles.forEach((h,i)=>h.visible=visible[i]);canvas.setViewportTransform(vt);canvas.requestRenderAll()}
  }
  function exportSvg(){if(needsRaster())throw Error("Для ластика и составных Boolean-групп выберите PNG: он сохраняет результат без искажений");const b=exportBounds();return canvas.toSVG({width:b.width,height:b.height,viewBox:{x:b.left,y:b.top,width:b.width,height:b.height}})}
  function selectStudioObjects(ids){const items=canvas.getObjects().filter(o=>ids.includes(studioId(o))&&o.name!=="__node");if(!items.length)throw Error("Объекты редактора не найдены");canvas.discardActiveObject();canvas.setActiveObject(items.length===1?items[0]:new (fapi().ActiveSelection)(items,{canvas}));canvas.requestRenderAll();refresh();return items}

  function fapi(){return globalThis.fabric}
  function status(text,error=false){const el=$('[data-gfx-status]',win);if(el){el.textContent=text;el.classList.toggle("error",error)}}
  function active(){return canvas?.getActiveObject?.()||null}
  function selectedFabric(){const o=active();if(!o)return[];if(/activeselection/i.test(String(o.type||"")))return o.getObjects?.()||[];return[o]}
  function snapshot(){
    if(!canvas||historyLock)return;canvas.getObjects().filter(o=>o.name!=="__node").forEach(studioId);
    const value=JSON.stringify(documentState());if(history[historyIndex]===value)return;
    history=history.slice(0,historyIndex+1);history.push(value);if(history.length>60)history.shift();historyIndex=history.length-1;
    const undo=$('[data-gfx-action="undo"]',win),redo=$('[data-gfx-action="redo"]',win);if(undo)undo.disabled=historyIndex<1;if(redo)redo.disabled=true;
  }
  async function restoreHistory(index){
    if(!canvas||historyLock||imageBusy||index<0||index>=history.length)return;
    historyLock=true;
    try{removeNodeHandles();const saved=JSON.parse(history[index]);await canvas.loadFromJSON(saved.canvas);documentBackground=saved.background;documentTransparent=saved.transparent;historyIndex=index;updateStageBackground();selectTool("select");refresh();$('[data-gfx-action="undo"]',win).disabled=index<1;$('[data-gfx-action="redo"]',win).disabled=index>=history.length-1}
    finally{historyLock=false}
  }
  function removeNodeHandles(){for(const h of nodeHandles)canvas?.remove?.(h);nodeHandles=[]}
  function pathEndpoint(cmd){const c=String(cmd?.[0]||"").toUpperCase();if(c==="M"||c==="L"||c==="T")return[1,2];if(c==="C")return[5,6];if(c==="S"||c==="Q")return[3,4];if(c==="H")return[1,null];if(c==="V")return[null,1];return null}
  function enterNodeMode(){removeNodeHandles();const f=fapi(),o=active();if(!o||String(o.type).toLowerCase()!=="path"||!Array.isArray(o.path)){status("Узлы доступны для векторного контура",true);return}const offset=o.pathOffset||{x:0,y:0},matrix=o.calcTransformMatrix(),inverse=f.util.invertTransform(matrix);o.path.forEach((cmd,i)=>{const at=pathEndpoint(cmd);if(!at)return;const x=at[0]==null?0:Number(cmd[at[0]])||0,y=at[1]==null?0:Number(cmd[at[1]])||0,p=f.util.transformPoint(new f.Point(x-offset.x,y-offset.y),matrix),h=new f.Circle({left:p.x,top:p.y,radius:5,originX:"center",originY:"center",fill:"#ffffff",stroke:"#6d7cff",strokeWidth:2,hasBorders:false,hasControls:false,name:"__node",excludeFromExport:true});h.__pathIndex=i;h.__pathTarget=o;h.on("moving",()=>{const local=f.util.transformPoint(new f.Point(h.left,h.top),inverse);if(at[0]!=null)cmd[at[0]]=local.x+offset.x;if(at[1]!=null)cmd[at[1]]=local.y+offset.y;o.set({dirty:true});o.setCoords();canvas.requestRenderAll()});h.on("modified",()=>{snapshot();refresh()});nodeHandles.push(h);canvas.add(h);canvas.bringObjectToFront?.(h)});canvas.discardActiveObject();canvas.requestRenderAll();status(`Узлы · ${nodeHandles.length}`)}
  function updateStageBackground(){if(!win||!canvas)return;const stage=$(".graphics-studio-stage",win);stage?.classList.toggle("is-transparent",documentTransparent);canvas.backgroundColor=documentTransparent?null:documentBackground;canvas.requestRenderAll();const c=$("[data-gfx-bg-color]",win),t=$("[data-gfx-bg-transparent]",win);if(c&&c.value!==documentBackground)c.value=documentBackground;if(t)t.checked=documentTransparent}
  function updateZoomReadout(){const el=$("[data-gfx-zoom]",win);if(el)el.textContent=`${Math.round(zoom*100)}%`}
  function setStudioZoom(next,point=null){if(!canvas)return;const f=fapi();next=clamp(Number(next)||1,.1,8);if(point&&canvas.zoomToPoint&&f?.Point)canvas.zoomToPoint(new f.Point(point.x,point.y),next);else{const vt=canvas.viewportTransform||[1,0,0,1,0,0],cx=canvas.getWidth()/2,cy=canvas.getHeight()/2;if(canvas.zoomToPoint&&f?.Point)canvas.zoomToPoint(new f.Point(cx,cy),next);else canvas.setZoom?.(next);if(!canvas.viewportTransform)canvas.viewportTransform=vt}zoom=next;updateZoomReadout();canvas.requestRenderAll()}
  function resetStudioView(){if(!canvas)return;zoom=1;canvas.setViewportTransform?.([1,0,0,1,0,0]);updateZoomReadout();canvas.requestRenderAll()}
  function fitStudioView(){if(!canvas)return;const items=canvas.getObjects().filter(o=>o.name!=="__node"&&o.visible!==false);if(!items.length)return resetStudioView();const r=$(".graphics-studio-stage",win)?.getBoundingClientRect?.();if(!r)return;let l=Infinity,t=Infinity,rr=-Infinity,bb=-Infinity;for(const o of items){const b=o.getBoundingRect?.(true,true)||{left:o.left||0,top:o.top||0,width:o.width||1,height:o.height||1};l=Math.min(l,b.left);t=Math.min(t,b.top);rr=Math.max(rr,b.left+b.width);bb=Math.max(bb,b.top+b.height)}const w=Math.max(1,rr-l),h=Math.max(1,bb-t),z=clamp(Math.min((r.width-120)/w,(r.height-140)/h),.1,4);zoom=z;const tx=r.width/2-((l+rr)/2)*z,ty=r.height/2-((t+bb)/2)*z;canvas.setViewportTransform?.([z,0,0,z,tx,ty]);updateZoomReadout();canvas.requestRenderAll()}
  function installLayersPanel(){if(!win)return;const shell=$(".graphics-studio-shell",win),layers=$(".graphics-studio-layers",win);if(!shell||!layers)return;let panel=$(".graphics-studio-layers-panel",win);if(!panel){panel=document.createElement("aside");panel.className="graphics-studio-layers-panel";panel.innerHTML='<header><strong>Слои</strong><small>Порядок объектов</small></header>';shell.prepend(panel)}panel.append(layers);layers.querySelector(":scope > strong")?.remove()}
  function limitPathNodes(nodes=[],max=360){if(nodes.length<=max)return nodes;const step=(nodes.length-1)/(max-1),out=[];for(let i=0;i<max;i++)out.push(nodes[Math.min(nodes.length-1,Math.round(i*step))]);return out}
  function updateLayers(){const root=$('[data-gfx-layers]',win);if(!root||!canvas)return;const objects=canvas.getObjects().filter(o=>o.name!=="__node").slice().reverse();root.innerHTML=objects.length?objects.map((o,i)=>`<div class="gfx-layer-row"><button type="button" data-layer-index="${canvas.getObjects().indexOf(o)}" class="${selectedFabric().includes(o)?"active":""}"><span>${String(o.name||o.type||"Слой")}</span></button><button data-layer-visibility="${canvas.getObjects().indexOf(o)}" title="Показать/скрыть">${o.visible===false?"○":"●"}</button><button data-layer-lock="${canvas.getObjects().indexOf(o)}" title="Блокировка">${o.lockedByStudio?"🔒":"🔓"}</button></div>`).join(""):'<small>Пустой документ</small>';$$('[data-layer-index]',root).forEach(button=>button.onclick=()=>{const o=canvas.item(Number(button.dataset.layerIndex));canvas.setActiveObject(o);canvas.requestRenderAll();refresh()});$$('[data-layer-visibility]',root).forEach(button=>button.onclick=()=>{const o=canvas.item(Number(button.dataset.layerVisibility));o.visible=o.visible===false;canvas.requestRenderAll();snapshot();refresh()});$$('[data-layer-lock]',root).forEach(button=>button.onclick=()=>{const o=canvas.item(Number(button.dataset.layerLock));o.lockedByStudio=!o.lockedByStudio;o.selectable=!o.lockedByStudio;o.evented=!o.lockedByStudio;canvas.discardActiveObject();canvas.requestRenderAll();snapshot();refresh()})}
  function solidColor(value,fallback="#000000"){return typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback}
  function refresh(){if(!win||!canvas)return;const o=active(),type=String(o?.type||"");const text=$('[data-gfx-selection]',win);if(text)text.textContent=o?(o.name||type):"Нет выделения";const fill=solidColor(o?.fill,"#8b6cff"),fields={fill,fill2:o?.gfxFill2||"#3bd1b3",stroke:solidColor(o?.stroke,"#20242d"),strokeWidth:o?.strokeWidth,opacity:o?.opacity,fontSize:o?.fontSize,fontFamily:o?.fontFamily,left:o?.left,top:o?.top,width:o?Math.round(o.getScaledWidth?.()||o.width||0):"",height:o?Math.round(o.getScaledHeight?.()||o.height||0):"",angle:o?.angle||0,cornerRadius:o?.rx||0,gradientAngle:o?.gfxGradientAngle||0,strokeDash:Array.isArray(o?.strokeDashArray)?(o.strokeDashArray[1]===1?"dot":"dash"):"solid",strokeLineCap:o?.strokeLineCap||"round",fillMode:o?.fill instanceof Object&&o.fill?.type?"gradient":o?.fill?"solid":"none"};Object.entries(fields).forEach(([key,value])=>{const el=$(`[data-gfx-prop="${key}"]`,win);if(!el||value==null||document.activeElement===el)return;el.value=value});$('[data-gfx-font-size]',win).hidden=!/text/i.test(type);$('[data-gfx-font-family]',win).hidden=!/text/i.test(type);const isText=/text/i.test(type);$('[data-gfx-text-section]',win).hidden=!isText;
    for(const key of ["text","fontWeight","fontStyle","textAlign","lineHeight"]){const input=$(`[data-gfx-prop="${key}"]`,win);if(input&&document.activeElement!==input&&o?.[key]!=null)input.value=o[key]}
    updateOutputs();updateLayers()}
  function updateOutputs(){for(const key of ["strokeWidth","opacity","gradientAngle"]){const out=$(`[data-gfx-output="${key}"]`,win),input=$(`[data-gfx-prop="${key}"]`,win);if(!out||!input)continue;out.value=key==="opacity"?`${Math.round(Number(input.value)*100)}%`:key==="gradientAngle"?`${input.value}°`:input.value}}
  function applyGradient(o){if(!o)return;const f=fapi(),mode=$('[data-gfx-prop="fillMode"]',win)?.value||"solid",c1=$('[data-gfx-prop="fill"]',win)?.value||"#8b6cff",c2=$('[data-gfx-prop="fill2"]',win)?.value||"#3bd1b3",ang=Number($('[data-gfx-prop="gradientAngle"]',win)?.value)||0;o.gfxFill2=c2;o.gfxGradientAngle=ang;if(mode==="none"){o.set("fill","transparent");return}if(mode==="solid"){o.set("fill",c1);return}const rad=ang*Math.PI/180,w=Math.max(1,o.width||100),h=Math.max(1,o.height||100),cx=w/2,cy=h/2,dx=Math.cos(rad)*w/2,dy=Math.sin(rad)*h/2;o.set("fill",new f.Gradient({type:"linear",gradientUnits:"pixels",coords:{x1:cx-dx,y1:cy-dy,x2:cx+dx,y2:cy+dy},colorStops:[{offset:0,color:c1},{offset:1,color:c2}]}))}
  function selectTool(id){
    if(!canvas)return;removeNodeHandles();currentTool=id;drawing=null;canvas.isDrawingMode=["draw","pen","eraser"].includes(id);canvas.selection=id==="select";canvas.skipTargetFind=!["select","nodes"].includes(id);canvas.defaultCursor=id==="select"?"default":"crosshair";
    if(canvas.isDrawingMode){canvas.discardActiveObject();canvas.freeDrawingBrush=new (fapi().PencilBrush)(canvas);configureBrush()}
    $$('[data-gfx-tool]',win).forEach(b=>{b.classList.toggle("active",b.dataset.gfxTool===id);b.setAttribute("aria-pressed",String(b.dataset.gfxTool===id))});
    if(id==="nodes")enterNodeMode();else status(`${win.querySelector(`[data-gfx-tool="${id}"] span`)?.textContent||id} · готово`);
  }
  function scenePoint(opt){return canvas.getScenePoint?.(opt.e)||canvas.getPointer?.(opt.e)||{x:0,y:0}}
  function startShape(opt){if(!["line","rect","ellipse","star"].includes(currentTool))return;const f=fapi(),p=scenePoint(opt),common={left:p.x,top:p.y,fill:$('[data-gfx-prop="fill"]',win).value,stroke:$('[data-gfx-prop="stroke"]',win).value,strokeWidth:Number($('[data-gfx-prop="strokeWidth"]',win).value)||1,selectable:false,evented:false};if(currentTool==="line")drawing=new f.Line([p.x,p.y,p.x,p.y],{...common,fill:null,originX:"center",originY:"center"});if(currentTool==="rect")drawing=new f.Rect({...common,width:1,height:1,rx:Number($('[data-gfx-prop="cornerRadius"]',win)?.value)||0,ry:Number($('[data-gfx-prop="cornerRadius"]',win)?.value)||0});if(currentTool==="ellipse")drawing=new f.Ellipse({...common,rx:1,ry:1});if(currentTool==="star")drawing=new f.Polygon([{x:0,y:-1},{x:.24,y:-.32},{x:.95,y:-.31},{x:.38,y:.12},{x:.59,y:.81},{x:0,y:.4},{x:-.59,y:.81},{x:-.38,y:.12},{x:-.95,y:-.31},{x:-.24,y:-.32}],{...common,originX:"center",originY:"center",scaleX:1,scaleY:1});drawing.name=currentTool==="line"?"Линия":currentTool==="rect"?"Прямоугольник":currentTool==="ellipse"?"Эллипс":"Звезда";drawing.__start=p;canvas.add(drawing)}
  function moveShape(opt){if(!drawing)return;const p=scenePoint(opt),s=drawing.__start;if(currentTool==="line")drawing.set({x2:p.x,y2:p.y});else{const left=Math.min(s.x,p.x),top=Math.min(s.y,p.y),w=Math.max(1,Math.abs(p.x-s.x)),h=Math.max(1,Math.abs(p.y-s.y));if(currentTool==="rect")drawing.set({left,top,width:w,height:h});else if(currentTool==="ellipse")drawing.set({left,top,rx:w/2,ry:h/2});else drawing.set({left:s.x,top:s.y,scaleX:w/2,scaleY:h/2})}drawing.setCoords();canvas.requestRenderAll()}
  function finishShape(){if(!drawing)return;delete drawing.__start;drawing.set({selectable:true,evented:true});canvas.setActiveObject(drawing);drawing=null;snapshot();refresh();selectTool("select")}
  function addText(opt){if(currentTool!=="text")return;const f=fapi(),p=scenePoint(opt),o=new f.IText("Текст",{left:p.x,top:p.y,fontFamily:$('[data-gfx-prop="fontFamily"]',win).value,fontSize:Number($('[data-gfx-prop="fontSize"]',win).value)||42,fill:$('[data-gfx-prop="fill"]',win).value,name:"Текст"});canvas.add(o);canvas.setActiveObject(o);o.enterEditing?.();o.selectAll?.();snapshot();refresh();selectTool("select")}
  function finishTool(){if(!canvas)return;if(drawing)finishShape();active()?.exitEditing?.();selectTool("select");snapshot();status("Инструмент применён")}
  function sanitizeSvg(text){const doc=new DOMParser().parseFromString(String(text||""),"image/svg+xml");for(const el of [...doc.querySelectorAll("script,foreignObject,iframe,object,embed")])el.remove();for(const el of [...doc.querySelectorAll("*")])for(const attr of [...el.attributes]){const name=attr.name.toLowerCase(),value=attr.value;if(name.startsWith("on")||((name==="href"||name.endsWith(":href"))&&!value.startsWith("#")&&!value.startsWith("data:"))||(/url\s*\(/i.test(value)&&!/url\s*\(\s*#/.test(value)))el.removeAttribute(attr.name)}return new XMLSerializer().serializeToString(doc.documentElement)}
  async function addImage(file){if(!file||!canvas)return;const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;if(file.type==="image/svg+xml")reader.readAsText(file);else reader.readAsDataURL(file)}),f=fapi();if(file.type==="image/svg+xml"){const safe=sanitizeSvg(data),parsed=await f.loadSVGFromString(safe),objects=parsed.objects.filter(Boolean),group=f.util.groupSVGElements?f.util.groupSVGElements(objects,parsed.options):new f.Group(objects);group.set({left:60,top:60,name:file.name||"SVG"});canvas.add(group);canvas.setActiveObject(group);snapshot();refresh();selectTool("select");return}let img;if(f.FabricImage?.fromURL)img=await f.FabricImage.fromURL(data);else img=await new Promise(resolve=>f.Image.fromURL(data,resolve));const max=Math.min(1,700/(img.width||700),500/(img.height||500));img.set({left:60,top:60,scaleX:max,scaleY:max,name:file.name||"Изображение"});canvas.add(img);canvas.setActiveObject(img);snapshot();refresh();selectTool("select")}
  function applyProperty(input){const targets=selectedFabric();configureBrush();updateOutputs();if(!targets.length)return;const key=input.dataset.gfxProp;let value=input.value;if(["strokeWidth","opacity","fontSize","left","top","width","height","angle","cornerRadius","gradientAngle","fontWeight","lineHeight"].includes(key))value=Number(value);for(const o of targets){if(["fill","fill2","fillMode","gradientAngle"].includes(key)){if(key==="fill2")o.gfxFill2=value;if(key==="gradientAngle")o.gfxGradientAngle=value;applyGradient(o);continue}if(key==="strokeDash")o.set({strokeDashArray:value==="dash"?[12,8]:value==="dot"?[2,6]:null});else if(key==="cornerRadius")o.set({rx:value,ry:value});else if(key==="width")o.set({scaleX:value/Math.max(1,o.width||1)});else if(key==="height")o.set({scaleY:value/Math.max(1,o.height||1)});else o.set(key,value);o.setCoords()}canvas.requestRenderAll();updateOutputs();snapshot();refresh()}
  function getBounds(items){const rs=items.map(o=>o.getBoundingRect());return{left:Math.min(...rs.map(r=>r.left)),top:Math.min(...rs.map(r=>r.top)),right:Math.max(...rs.map(r=>r.left+r.width)),bottom:Math.max(...rs.map(r=>r.top+r.height))}}
  function align(items,kind){if(!items.length)return;const b=getBounds(items);for(const o of items){const r=o.getBoundingRect();if(kind==="left")o.left+=(b.left-r.left);if(kind==="center")o.left+=((b.left+b.right)/2-(r.left+r.width/2));if(kind==="right")o.left+=(b.right-(r.left+r.width));if(kind==="top")o.top+=(b.top-r.top);if(kind==="middle")o.top+=((b.top+b.bottom)/2-(r.top+r.height/2));if(kind==="bottom")o.top+=(b.bottom-(r.top+r.height));o.setCoords()}canvas.requestRenderAll();snapshot();refresh()}
  function distribute(items,axis){if(items.length<3)return status("Для распределения выберите 3+ объекта",true);const arr=items.slice().sort((a,b)=>axis==="x"?a.getBoundingRect().left-b.getBoundingRect().left:a.getBoundingRect().top-b.getBoundingRect().top),first=arr[0].getBoundingRect(),last=arr.at(-1).getBoundingRect(),start=axis==="x"?first.left:first.top,end=axis==="x"?last.left:last.top,step=(end-start)/(arr.length-1);arr.forEach((o,i)=>{const r=o.getBoundingRect(),now=axis==="x"?r.left:r.top;if(axis==="x")o.left+=start+i*step-now;else o.top+=start+i*step-now;o.setCoords()});canvas.requestRenderAll();snapshot();refresh()}
  function pathPoints(o){if(!o||String(o.type).toLowerCase()!=="path"||!Array.isArray(o.path))return[];return o.path.map((cmd,i)=>{const at=pathEndpoint(cmd);return at?{cmd,i,at,x:at[0]==null?0:Number(cmd[at[0]])||0,y:at[1]==null?0:Number(cmd[at[1]])||0}:null}).filter(Boolean)}
  function smoothPath(o){const pts=pathPoints(o);if(pts.length<3)return false;for(let i=1;i<pts.length-1;i++){const a=pts[i-1],b=pts[i],c=pts[i+1],cmd=b.cmd;if(String(cmd[0]).toUpperCase()!=="C"){const x1=b.x+(a.x-b.x)*.28,y1=b.y+(a.y-b.y)*.28,x2=b.x+(c.x-b.x)*.28,y2=b.y+(c.y-b.y)*.28,bx=b.x,by=b.y;cmd.splice(0,cmd.length,"C",x1,y1,x2,y2,bx,by)}}o.set({dirty:true});return true}
  function simplifyPath(o){const pts=pathPoints(o);if(pts.length<4)return false;for(let i=pts.length-2;i>0;i--){const a=pts[i-1],b=pts[i],c=pts[i+1],area=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)),dist=Math.hypot(c.x-a.x,c.y-a.y)||1;if(area/dist<2.5)o.path.splice(b.i,1)}o.set({dirty:true});return true}
  function reversePath(o){if(!o?.path?.length)return false;const pts=pathPoints(o).map(p=>[p.x,p.y]).reverse();o.path=pts.map((p,i)=>[i?"L":"M",p[0],p[1]]);o.set({dirty:true});return true}
  function closePath(o){if(!o?.path?.length)return false;if(String(o.path.at(-1)?.[0]).toUpperCase()!=="Z")o.path.push(["Z"]);o.set({dirty:true});return true}
  function strokeToPath(o){if(!o?.path?.length)return false;const pts=pathPoints(o).map(p=>({x:p.x,y:p.y}));if(pts.length<2)return false;const half=Math.max(1,Number(o.strokeWidth)||2)/2,left=[],right=[];for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*half,ny=dx/len*half;left.push([pts[i].x+nx,pts[i].y+ny]);right.push([pts[i].x-nx,pts[i].y-ny])}const poly=[...left,...right.reverse()];o.path=poly.map((p,i)=>[i?"L":"M",p[0],p[1]]);o.path.push(["Z"]);o.set({fill:o.stroke||"#20242d",stroke:null,strokeWidth:0,dirty:true});return true}
  async function booleanGroup(op){
    const f=fapi(),items=selectedFabric();if(items.length<2)throw Error("Выберите минимум 2 формы");canvas.discardActiveObject();
    const clones=await Promise.all(items.map(o=>o.clone(SERIAL_PROPS)));
    clones.forEach((o,i)=>{if(i>0)o.globalCompositeOperation=op==="subtract"?"destination-out":op==="intersect"?"destination-in":op==="exclude"?"xor":"source-over"});
    canvas.remove(...items);const group=new f.Group(clones,{name:`Boolean · ${op}`,booleanOp:op,subTargetCheck:true});canvas.add(group);canvas.setActiveObject(group);canvas.requestRenderAll();snapshot();refresh();return{ok:true,id:studioId(group)};
  }
  function applyMask(){const items=selectedFabric();if(items.length<2)return status("Выберите объект и форму-маску",true);const target=items[0],mask=items[1];mask.clone().then(c=>{c.absolutePositioned=true;c.set({left:mask.left,top:mask.top,angle:mask.angle,scaleX:mask.scaleX,scaleY:mask.scaleY});target.clipPath=c;canvas.remove(mask);canvas.setActiveObject(target);snapshot();refresh();status("Маска применена")})}
  function imageFilter(kind){const f=fapi(),o=active();if(!o||!/image/i.test(String(o.type)))return status("Выберите изображение",true);const filters=f.filters||f.Image?.filters||f.FabricImage?.filters||{};if(kind==="reset")o.filters=[];else{let filter=null;if(kind==="gray"&&filters.Grayscale)filter=new filters.Grayscale();if(kind==="sepia"&&filters.Sepia)filter=new filters.Sepia();if(kind==="bright"&&filters.Brightness)filter=new filters.Brightness({brightness:.18});if(kind==="contrast"&&filters.Contrast)filter=new filters.Contrast({contrast:.22});if(kind==="blur"&&filters.Blur)filter=new filters.Blur({blur:.18});if(filter)o.filters=[...(o.filters||[]),filter]}o.applyFilters?.();canvas.requestRenderAll();snapshot();refresh()}
  function download(data,name){const a=document.createElement("a");a.href=data;a.download=name;a.click()}

  function mainObjects(){return globalThis.objects?.()||[]}
  function mainSelected(){const ids=globalThis.OSMINOGEditorAPI?.selected?.()||[];return mainObjects().filter(o=>ids.includes(o.id))}
  function smoothNodes(nodes=[]){return nodes.map((n,i,arr)=>{if(i===0||i===arr.length-1)return{...n};const a=arr[i-1],c=arr[i+1],dx=(c.x-a.x)*.18,dy=(c.y-a.y)*.18;return{...n,in:{x:clamp(n.x-dx,0,1),y:clamp(n.y-dy,0,1)},out:{x:clamp(n.x+dx,0,1),y:clamp(n.y+dy,0,1)}}})}
  function simplifyNodes(nodes=[]){if(nodes.length<4)return nodes;return nodes.filter((n,i)=>i===0||i===nodes.length-1||i%2===0)}
  function applyCanvasAction(action,args={}){const items=mainSelected();if(!items.length)return{error:"Select a graphics object first"};const p=globalThis.project?.(),render=()=>{globalThis.renderAll?.(true);globalThis.queuePersist?.();globalThis.OSMINOGEditorAPI?.render?.()};if(action==="style"){for(const o of items){for(const k of ["fill","fill2","fillType","gradientAngle","stroke","strokeWidth","opacity","rotation"])if(args[k]!=null)o[k]=args[k]}render();return{ok:true,changed:items.map(o=>o.id)}}if(action.startsWith("align_")){const left=Math.min(...items.map(o=>o.x)),right=Math.max(...items.map(o=>o.x+o.w)),top=Math.min(...items.map(o=>o.y)),bottom=Math.max(...items.map(o=>o.y+o.h));for(const o of items){if(action==="align_left")o.x=left;if(action==="align_center")o.x=(left+right-o.w)/2;if(action==="align_right")o.x=right-o.w;if(action==="align_top")o.y=top;if(action==="align_middle")o.y=(top+bottom-o.h)/2;if(action==="align_bottom")o.y=bottom-o.h}render();return{ok:true,changed:items.map(o=>o.id)}}if(action==="smooth"||action==="simplify"||action==="close"||action==="reverse"){for(const o of items.filter(x=>x.type==="vector"&&Array.isArray(x.pathNodes))){if(action==="smooth")o.pathNodes=smoothNodes(o.pathNodes);if(action==="simplify")o.pathNodes=simplifyNodes(o.pathNodes);if(action==="close")o.pathClosed=true;if(action==="reverse")o.pathNodes=o.pathNodes.slice().reverse()}render();return{ok:true,changed:items.map(o=>o.id)}}if(action==="group"&&p){const gid=`group-gfx-${Date.now().toString(36)}`;p.groups=p.groups||[];p.groups.push({id:gid,name:String(args.name||"Graphics group"),collapsed:false});items.forEach(o=>o.group=gid);render();return{ok:true,groupId:gid,changed:items.map(o=>o.id)}}if(action==="ungroup"){items.forEach(o=>o.group=null);render();return{ok:true,changed:items.map(o=>o.id)}}if(action==="front"&&p){p.objects=p.objects.filter(o=>!items.includes(o)).concat(items);render();return{ok:true}}if(action==="back"&&p){p.objects=items.concat(p.objects.filter(o=>!items.includes(o)));render();return{ok:true}}if(action==="open")return openSelection();return{error:`Unsupported graphics_edit action: ${action}`}}
  function importMainObject(o){const f=fapi(),common={left:Number(o.x)||0,top:Number(o.y)||0,angle:Number(o.rotation)||0,opacity:o.opacity??1,stroke:o.strokeEnabled===false?null:(o.stroke||null),strokeWidth:Number(o.strokeWidth)||0,fill:o.fillEnabled===false?"transparent":(o.fill||"transparent"),name:o.name||o.type};if(o.type==="shape"){if(o.shapeKind==="ellipse")return new f.Ellipse({...common,rx:(o.w||100)/2,ry:(o.h||100)/2});return new f.Rect({...common,width:o.w||100,height:o.h||100,rx:o.radius||0,ry:o.radius||0})}if(o.type==="text")return new f.IText(String(o.text||"Текст"),{...common,fontSize:o.fontSize||42,fontFamily:o.fontFamily||"Inter",fill:o.textColor||o.fill||"#20242d"});if(o.type==="vector"&&Array.isArray(o.pathNodes)){const w=o.w||100,h=o.h||100,nodes=o.pathNodes,path=[];nodes.forEach((n,i)=>{if(!i)path.push(["M",n.x*w,n.y*h]);else{const prev=nodes[i-1];if(prev.out||n.in){const a=prev.out||prev,b=n.in||n;path.push(["C",a.x*w,a.y*h,b.x*w,b.y*h,n.x*w,n.y*h])}else path.push(["L",n.x*w,n.y*h])}});if(o.pathClosed){const a=nodes.at(-1),b=nodes[0];if(a?.out||b?.in){const c=a.out||a,d=b.in||b;path.push(["C",c.x*w,c.y*h,d.x*w,d.y*h,b.x*w,b.y*h])}path.push(["Z"]);}return new f.Path(path,{...common,left:o.x,top:o.y})}if(o.type==="image"&&o.src)return null;return null}
  async function openSelection(){
    open();const selected=mainSelected();if(!selected.length){status("На холсте нет выбранной графики",true);return{error:"No selected graphics"}}
    if(imageBusy||historyLock)throw Error("Дождитесь завершения текущей операции");
    removeNodeHandles();canvas.clear();resetStudioView();documentBackground="#ffffff";documentTransparent=true;sourceSelectionIds=selected.map(o=>o.id);
    if(selected.length===1&&selected[0].graphicsDocument?.version===1){const saved=selected[0].graphicsDocument;await canvas.loadFromJSON(saved.canvas);documentBackground=saved.background;documentTransparent=saved.transparent}
    else for(const o of selected){if(o.type==="image"&&o.src){const img=await fapi().FabricImage.fromURL(o.src);img.set({left:o.x,top:o.y,scaleX:(o.w||img.width)/(img.width||1),scaleY:(o.h||img.height)/(img.height||1),name:o.name||"Изображение"});canvas.add(img)}else{const item=importMainObject(o);if(item)canvas.add(item)}}
    updateStageBackground();history=[];historyIndex=-1;snapshot();refresh();selectTool("select");status(`Загружено из холста: ${sourceSelectionIds.length}`);setTimeout(fitStudioView,30);return{ok:true,sourceSelectionIds};
  }
  async function applyToCanvas(){
    if(!canvas||applyingToCanvas)throw Error("Дождитесь переноса рисунка");finishTool();
    const api=globalThis.OSMINOGEditorAPI,button=$('[data-gfx-action="apply"]',win);applyingToCanvas=true;button.disabled=true;
    try{
      status("Переношу на холст…");await new Promise(requestAnimationFrame);
      // A faithful render plus editable Fabric document preserves curves, masks, filters and erasing.
      const {src,bounds}=exportPng(),saved=documentState(),specs=[{type:"image",props:{x:bounds.left,y:bounds.top,w:bounds.width,h:bounds.height,src,name:"Графика · редактируемый рисунок",mime:"image/png",graphicsDocument:saved}}];
      const created=api?.createBatch?.(specs,{group:false,name:"OSMINOG Graphics",keepPosition:false})||[];
      if(!created.length)throw Error("Редактор холста не создал объект");
      sourceSelectionIds=[];status("Рисунок добавлен на стол · повторная правка через «Из выделенного»");return{ok:true,created,format:"png",editable:true};
    }finally{applyingToCanvas=false;button.disabled=false}
  }
  async function runAction(id){
    if(imageBusy||historyLock)throw Error("Дождитесь завершения текущей операции");
    const f=fapi(),o=active(),items=selectedFabric();
    if(id==="toggle-layers"||id==="toggle-inspector"){const side=id.replace("toggle-","");$(".graphics-studio-shell",win).classList.toggle(`hide-${side}`);return{ok:true}}
    if(id==="remove-white")return removeWhiteBackground();if(id==="restore-image")return restoreImage();if(id==="zoom-in")return setStudioZoom(zoom*1.2);if(id==="zoom-out")return setStudioZoom(zoom/1.2);if(id==="zoom-reset")return resetStudioView();if(id==="zoom-fit")return fitStudioView();if(id==="new"){if(canvas.getObjects().filter(x=>x.name!=="__node").length&&!confirm("Очистить документ?"))return;removeNodeHandles();canvas.clear();documentBackground="#ffffff";documentTransparent=true;resetStudioView();updateStageBackground();sourceSelectionIds=[];canvas.requestRenderAll();history=[];historyIndex=-1;snapshot();refresh();return}if(id==="open-selection")return openSelection();if(id==="undo")return restoreHistory(historyIndex-1);if(id==="redo")return restoreHistory(historyIndex+1);if(id==="finish")return finishTool();if(id==="delete"&&o){canvas.discardActiveObject();canvas.remove(...items);snapshot();refresh();return{ok:true,removed:items.length}}if(id==="duplicate"&&o){return o.clone(SERIAL_PROPS.filter(p=>p!=="studioId")).then(copy=>{copy.set({left:(o.left||0)+20,top:(o.top||0)+20});canvas.add(copy);canvas.setActiveObject(copy);snapshot();refresh()})}if(id==="group"){if(items.length<2)throw Error("Выберите минимум два объекта");canvas.discardActiveObject();canvas.remove(...items);const group=new f.Group(items,{name:"Группа",subTargetCheck:true});canvas.add(group);canvas.setActiveObject(group);snapshot();refresh();return{ok:true,id:studioId(group)}}
    if(id==="ungroup"){if(!o||o.type.toLowerCase()!=="group")throw Error("Выберите группу");canvas.discardActiveObject();const children=o.removeAll();canvas.remove(o);canvas.add(...children);canvas.setActiveObject(new f.ActiveSelection(children,{canvas}));snapshot();refresh();return{ok:true,ungrouped:children.length}}if(id==="front"&&o){canvas.bringObjectToFront?.(o)||canvas.bringToFront?.(o);snapshot();refresh();return}if(id==="back"&&o){canvas.sendObjectToBack?.(o)||canvas.sendToBack?.(o);snapshot();refresh();return}if(id.startsWith("align-"))return align(items,id.replace("align-",""));if(id==="distribute-h")return distribute(items,"x");if(id==="distribute-v")return distribute(items,"y");if(id==="center-stage"&&items.length){const center=f.util.transformPoint(new f.Point(canvas.getWidth()/2,canvas.getHeight()/2),f.util.invertTransform(canvas.viewportTransform)),b=getBounds(items),dx=center.x-(b.left+b.right)/2,dy=center.y-(b.top+b.bottom)/2;items.forEach(x=>{x.left+=dx;x.top+=dy;x.setCoords()});canvas.requestRenderAll();snapshot();refresh();return}if(id==="flip-x"&&o){o.flipX=!o.flipX;o.setCoords();snapshot();canvas.requestRenderAll();return}if(id==="flip-y"&&o){o.flipY=!o.flipY;o.setCoords();snapshot();canvas.requestRenderAll();return}if(id==="rotate-left"&&o){o.rotate((o.angle||0)-90);o.setCoords();snapshot();canvas.requestRenderAll();return}if(id==="rotate-right"&&o){o.rotate((o.angle||0)+90);o.setCoords();snapshot();canvas.requestRenderAll();return}if(id==="smooth"&&smoothPath(o)){snapshot();canvas.requestRenderAll();enterNodeMode();return}if(id==="simplify"&&simplifyPath(o)){snapshot();canvas.requestRenderAll();enterNodeMode();return}if(id==="close-path"&&closePath(o)){snapshot();canvas.requestRenderAll();return}if(id==="reverse-path"&&reversePath(o)){snapshot();canvas.requestRenderAll();return}if(id==="stroke-path"&&strokeToPath(o)){snapshot();canvas.requestRenderAll();return}if(id==="nodes")return selectTool("nodes");if(id==="boolean-union")return booleanGroup("union");if(id==="boolean-subtract")return booleanGroup("subtract");if(id==="boolean-intersect")return booleanGroup("intersect");if(id==="boolean-exclude")return booleanGroup("exclude");if(id==="mask")return applyMask();if(id==="unmask"&&o){o.clipPath=null;snapshot();canvas.requestRenderAll();return}if(id.startsWith("filter-"))return imageFilter(id.replace("filter-",""));if(id==="export"){download(exportPng().src,"OSMINOG-Graphics.png");return{ok:true,format:"png"}}if(id==="export-svg"){const svg=exportSvg();return download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,"OSMINOG-Graphics.svg")}if(id==="apply")return applyToCanvas()}
  function fit(){if(!win||!canvas)return;const stage=$(".graphics-studio-stage",win),r=stage.getBoundingClientRect();if(r.width<100||r.height<100)return;const w=Math.floor(r.width),h=Math.floor(r.height),el=canvas.getElement?.(),same=el&&Math.abs((el.width||0)-w)<=1&&Math.abs((el.height||0)-h)<=1;if(same){updateZoomReadout();return}const vt=(canvas.viewportTransform||[zoom,0,0,zoom,0,0]).slice();canvas.setDimensions({width:w,height:h});canvas.setViewportTransform?.(vt);canvas.requestRenderAll();updateZoomReadout()}
  function bind(){
    const dispatch=id=>Promise.resolve().then(()=>runAction(id)).catch(e=>status(e.message||String(e),true));
    $$('[data-gfx-tool]',win).forEach(b=>b.onclick=()=>{if(b.dataset.gfxTool==="image")return $('[data-gfx-file]',win).click();selectTool(b.dataset.gfxTool)});
    $$('[data-gfx-action]',win).forEach(b=>b.onclick=()=>dispatch(b.dataset.gfxAction));
    $$('[data-gfx-prop]',win).forEach(input=>input.oninput=()=>applyProperty(input));
    $$('[data-gfx-brush]',win).forEach(input=>input.oninput=configureBrush);
    $('[data-gfx-white-threshold]',win).oninput=e=>$('[data-gfx-white-output]',win).value=e.target.value;
    $('[data-gfx-white-softness]',win).oninput=e=>$('[data-gfx-softness-output]',win).value=e.target.value;
    $('[data-gfx-bg-color]',win).oninput=e=>{documentBackground=e.target.value;documentTransparent=false;updateStageBackground();snapshot()};
    $('[data-gfx-bg-transparent]',win).onchange=e=>{documentTransparent=e.target.checked;updateStageBackground();snapshot()};
    $('[data-gfx-file]',win).onchange=e=>{addImage(e.target.files?.[0]).catch(error=>status(error.message,true));e.target.value=""};
    canvas.on("mouse:wheel",opt=>{const e=opt.e;e.preventDefault();e.stopPropagation();setStudioZoom(zoom*Math.pow(.999,Number(e.deltaY)||0),{x:e.offsetX,y:e.offsetY})});
    canvas.on("mouse:down",opt=>{const e=opt.e;if((e.button===1||spaceHeld)&&currentTool==="select"){panState={x:e.clientX,y:e.clientY};canvas.selection=false;canvas.defaultCursor="grabbing";return}startShape(opt);addText(opt)});
    canvas.on("mouse:move",opt=>{if(panState){const e=opt.e,vt=canvas.viewportTransform.slice();vt[4]+=e.clientX-panState.x;vt[5]+=e.clientY-panState.y;panState={x:e.clientX,y:e.clientY};canvas.setViewportTransform(vt);canvas.requestRenderAll();return}moveShape(opt)});
    canvas.on("mouse:up",()=>{if(panState){panState=null;canvas.selection=currentTool==="select";canvas.defaultCursor="default";return}finishShape()});
    for(const event of ["selection:created","selection:updated","selection:cleared"])canvas.on(event,refresh);
    for(const event of ["object:modified","text:editing:exited"])canvas.on(event,()=>{snapshot();refresh()});
    canvas.on("path:created",e=>{if(e.path){e.path.name=currentTool==="pen"?"Контур":currentTool==="eraser"?"Ластик":"Кисть";if(currentTool==="eraser")e.path.set({globalCompositeOperation:"destination-out"})}snapshot();refresh()});
    win.addEventListener("keydown",e=>{
      if(e.target.closest("input,textarea,select,[contenteditable]")||active()?.isEditing)return;
      const key=e.key.toLowerCase();
      if(e.code==="Space"&&!e.repeat){spaceHeld=true;e.preventDefault();e.stopPropagation();return}
      if((e.ctrlKey||e.metaKey)&&key==="z"){e.preventDefault();e.stopPropagation();dispatch(e.shiftKey?"redo":"undo");return}
      if((e.ctrlKey||e.metaKey)&&key==="d"){e.preventDefault();e.stopPropagation();dispatch("duplicate");return}
      if(key==="delete"||key==="backspace"){e.preventDefault();e.stopPropagation();dispatch("delete");return}
      if(e.key==="Escape"){e.preventDefault();e.stopPropagation();finishTool();return}
      const tool={v:"select",b:"draw",e:"eraser",p:"pen",t:"text",r:"rect",o:"ellipse",l:"line"}[key];
      if(tool&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopPropagation();selectTool(tool)}
    });
    win.addEventListener("keyup",e=>{if(e.code==="Space")spaceHeld=false});window.addEventListener("blur",()=>{spaceHeld=false;panState=null});
    resizeObserver=new ResizeObserver(()=>{clearTimeout(resizeObserver.__osminogTimer);resizeObserver.__osminogTimer=setTimeout(fit,24)});resizeObserver.observe($(".graphics-studio-stage",win));
  }
  function create(){const f=fapi();if(!f?.Canvas)throw new Error("Fabric.js не загружен");win=document.createElement("section");win.id="osminogGraphicsStudio";win.className="osminog-app-window osminog-graphics-studio glass";win.tabIndex=-1;win.innerHTML=`<header class="osminog-app-window-head"><span class="osminog-app-window-mark">🎨</span><div><small>OSMINOG · GRAPHICS STUDIO V2.2</small><strong>Графика</strong></div></header><main>${markup()}</main>`;document.body.append(win);installLayersPanel();installPanelLayout();canvas=new f.Canvas($('[data-gfx-canvas]',win),{backgroundColor:null,preserveObjectStacking:true,selection:true});documentBackground="#ffffff";documentTransparent=true;zoom=1;bind();updateStageBackground();updateZoomReadout();globalThis.OSMINOGWindowManager?.register?.({name:"graphics-app",el:win,handle:$("header",win),title:"Графика",icon:"🎨",nodeable:false,minW:900,minH:620,defaultW:1280,defaultH:820});setTimeout(()=>{fit();snapshot();selectTool("select")},0);return win}
  function open(){try{if(!win?.isConnected)create();win.hidden=false;globalThis.OSMINOGWindowManager?.restore?.("graphics-app");globalThis.OSMINOGWindowManager?.front?.("graphics-app");setTimeout(fit,0);win.focus()}catch(error){console.error(error);alert(`Графика: ${error.message||error}`)}}
  function createFromSpec(args={}){const layers=Array.isArray(args.layers)?args.layers:Array.isArray(args.objects)?args.objects:[],allowed=new Set(["shape","vector","text","image"]),specs=[];for(const layer of layers.slice(0,120)){const type=String(layer?.type||layer?.objectType||"");if(!allowed.has(type))continue;const props={...(layer.props||layer.properties||{})};if(!Number.isFinite(Number(props.x))||!Number.isFinite(Number(props.y))||!Number.isFinite(Number(props.w))||!Number.isFinite(Number(props.h)))continue;props.x=Number(props.x);props.y=Number(props.y);props.w=Math.max(1,Number(props.w));props.h=Math.max(1,Number(props.h));specs.push({type,props})}if(!specs.length)return{error:"graphics_create requires editable shape/vector/text/image layers with numeric x,y,w,h"};const created=globalThis.OSMINOGEditorAPI?.createBatch?.(specs,{group:args.group!==false,name:String(args.name||"AI Graphics")})||[];return created.length?{ok:true,editable:true,created,grouped:args.group!==false,capabilities:graphicsStatus().capabilities}:{error:"Editor did not create graphics layers"}}
  async function graphicsEdit(args={}){
    const scope=String(args.scope||"canvas"),action=String(args.action||"").replace(/-/g,"_");
    if(scope!=="studio")return applyCanvasAction(action,args);
    open();
    try{
      if(Array.isArray(args.ids))selectStudioObjects(args.ids);
      if(action==="select"){if(!args.ids?.length)throw Error("Укажите ids из graphics_status");return{ok:true,selected:args.ids}}
      if(action==="background"){if(typeof args.transparent!=="boolean")throw Error("Укажите transparent: true или false");documentTransparent=args.transparent;updateStageBackground();snapshot();return{ok:true,transparent:documentTransparent}}
      if(action==="brush"){for(const key of ["width","smoothing","opacity"]){const input=$(`[data-gfx-brush="${key}"]`,win);if(args[key]!=null)input.value=clamp(Number(args[key]),Number(input.min),Number(input.max))}selectTool("draw");configureBrush();return{ok:true}}
      const map={close:"close-path",reverse:"reverse-path",stroke_to_path:"stroke-path",export_png:"export",export_to_canvas:"apply"},id=map[action]||action.replace(/_/g,"-");
      if(!win.querySelector(`[data-gfx-action="${CSS.escape(id)}"]`))throw Error(`Неизвестное действие редактора: ${action}`);
      const globalActions=new Set(["new","open-selection","undo","redo","finish","apply","export","export-svg","zoom-in","zoom-out","zoom-reset","zoom-fit","toggle-layers","toggle-inspector"]);
      if(!globalActions.has(id)&&!active())throw Error("Сначала выберите объект редактора через ids из graphics_status");
      const before=JSON.stringify(documentState()),result=await runAction(id);
      if(result?.error||result?.ok===false)return result;
      if(!result?.ok&&!globalActions.has(id)&&before===JSON.stringify(documentState()))return{ok:false,error:"Действие не изменило выбранный объект"};
      return{ok:true,scope:"studio",action:id,...result};
    }catch(error){status(error.message,true);return{ok:false,error:error.message}}
  }
  function graphicsStatus(){return{ok:true,available:true,open:!!win?.isConnected&&!win.hidden,editable:true,engine:"Fabric.js + OSMINOG native vectors",capabilities:["select","node-edit","bezier","brush","eraser","pen","shapes","star","text","images","svg-import-sanitized","layers","visibility","lock","groups","align","distribute","gradients","stroke","dash","opacity","smooth","simplify","close-path","reverse-path","stroke-to-path","non-destructive-boolean","masks","image-filters","svg-export","png-export","canvas-roundtrip","adjustable-brush-smoothing","remove-light-background","restore-image","full-drawing-export","editable-png-roundtrip"],document:canvas?{transparent:documentTransparent,zoom,objects:canvas.getObjects().filter(o=>o.name!=="__node").map(o=>({id:studioId(o),type:o.type,name:o.name||o.type,visible:o.visible!==false,text:o.text||null,bounds:o.getBoundingRect()})),selected:selectedFabric().map(studioId)}:null,notes:"AI and user share graphics_create + graphics_edit. SVG import is sanitized before Fabric parsing. Boolean groups are non-destructive and remain editable."}}
  function installCanvasSidePanel(){const root=document.querySelector("#inspectorBody");if(!root)return;const inject=()=>{const ids=globalThis.OSMINOGEditorAPI?.selected?.()||[],items=mainObjects().filter(o=>ids.includes(o.id)),ok=items.length&&items.every(o=>["shape","vector","image","text","ink"].includes(o.type));const existing=root.querySelector(".graphics-v2-sidecar");if(!ok){existing?.remove();return}if(existing)return;const box=document.createElement("section");box.className="graphics-v2-sidecar";box.innerHTML=`<div class="section-title">ГРАФИКА V2</div><button data-gv2="open">🎨 Открыть в редакторе</button><div class="gv2-grid"><button data-gv2="smooth">Сгладить</button><button data-gv2="simplify">Упростить</button><button data-gv2="close">Замкнуть</button><button data-gv2="reverse">Развернуть</button><button data-gv2="align_left">⇤</button><button data-gv2="align_center">↔</button><button data-gv2="align_right">⇥</button><button data-gv2="group">Группа</button></div><div class="gv2-gradient"><input type="color" value="#8b6cff" data-gv2-c1><input type="color" value="#3bd1b3" data-gv2-c2><button data-gv2="gradient">Градиент</button></div>`;root.append(box);$$('[data-gv2]',box).forEach(b=>b.onclick=()=>{const a=b.dataset.gv2;if(a==="open")return openSelection();if(a==="gradient")return applyCanvasAction("style",{fill:box.querySelector('[data-gv2-c1]').value,fill2:box.querySelector('[data-gv2-c2]').value,fillType:"gradient",gradientAngle:135});return applyCanvasAction(a)})};let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;inject()})};new MutationObserver(schedule).observe(root,{childList:true});document.addEventListener("click",e=>{if(e.target.closest?.(".canvas-object"))setTimeout(inject,0)},true);inject()}
  globalThis.OSMINOGGraphicsStudio={open,openSelection,finish:finishTool,canvas:()=>canvas,createFromSpec,edit:graphicsEdit,status:graphicsStatus};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(installCanvasSidePanel,80),{once:true}):setTimeout(installCanvasSidePanel,80);
})();


