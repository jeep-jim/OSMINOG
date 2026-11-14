'use strict';
globalThis.createQuadroCapture=({N,show,restore,locale})=>{
 const d=document.createElement('dialog');d.id='capture-dialog';d.innerHTML=`<header><strong data-i18n>Скриншот</strong><span id="capture-status" role="status"></span><button type="button" id="capture-close" title="Закрыть · Esc" aria-label="Закрыть скриншот">×</button></header><div class="capture-tools"><button data-tool="select" title="Выделить заново">▧</button><button data-tool="arrow" title="Стрелка">↗</button><button data-tool="line" title="Линия">╱</button><button data-tool="text" title="Текст">T</button><button data-tool="ellipse" title="Круг">○</button><button data-tool="rect" title="Прямоугольник">□</button><button data-tool="pencil" title="Карандаш">✎</button><button data-tool="marker" title="Маркер">▰</button><input id="capture-color" type="color" value="#ee364b" title="Цвет"><input id="capture-width" type="range" min="1" max="16" value="3" title="Толщина"><input id="capture-text" placeholder="Текст подписи" maxlength="500" aria-label="Текст подписи"><input id="capture-font" type="number" min="12" max="96" value="24" title="Размер текста"><button id="capture-undo" title="Отменить">↶</button><button id="capture-redo" title="Повторить">↷</button><button id="capture-all">Весь снимок</button><button id="capture-copy">Копировать</button><button id="capture-save" class="primary">Сохранить PNG</button></div><div class="capture-stage"><canvas id="capture-canvas" tabindex="0" aria-label="Выделение и разметка снимка"></canvas></div><footer><span>Выделите область мышью. Затем выберите инструмент. Снимки никуда не отправляются.</span></footer>`;
 document.body.append(d);const $=s=>d.querySelector(s),c=$('#capture-canvas'),ctx=c.getContext('2d');
 let full,base,ops=[],redo=[],current=null,start=null,tool='select',busy=false,opened=false;
 const status=s=>{$('#capture-status').textContent=s;globalThis.QuadroLocale?.apply(locale())};
 const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Не удалось прочитать снимок'));i.src=src});
 async function compose(data){
  const bg=await image(data.base),out=document.createElement('canvas');out.width=bg.naturalWidth;out.height=bg.naturalHeight;
  if(out.width*out.height>40000000)throw Error('Снимок слишком большой');
  const x=out.getContext('2d');x.drawImage(bg,0,0);const sx=out.width/data.width,sy=out.height/data.height;
  for(const layer of data.layers){const im=await image(layer.src);x.drawImage(im,layer.x*sx,layer.y*sy,layer.width*sx,layer.height*sy)}
  return out;
 }
 function selectTool(value){tool=value;d.dataset.tool=tool;d.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));$('#capture-text').hidden=tool!=='text';$('#capture-font').hidden=tool!=='text'}
 function render(){if(!base)return;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(base,0,0);for(const op of ops)QuadroCaptureCore.draw(ctx,op);if(current&&tool!=='select')QuadroCaptureCore.draw(ctx,current);$('#capture-undo').disabled=!ops.length;$('#capture-redo').disabled=!redo.length}
 function reset(){base=full;ops=[];redo=[];current=null;start=null;c.width=base.width;c.height=base.height;selectTool('select');render();status('Выделите область мышью')}
 function crop(r){if(r.width<8||r.height<8)return;const out=document.createElement('canvas');out.width=r.width;out.height=r.height;out.getContext('2d').drawImage(full,r.x,r.y,r.width,r.height,0,0,r.width,r.height);base=out;c.width=r.width;c.height=r.height;ops=[];redo=[];selectTool('arrow');render();status(`${r.width} × ${r.height}`)}
 const pos=e=>{const r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(c.width,(e.clientX-r.x)*c.width/r.width)),y:Math.max(0,Math.min(c.height,(e.clientY-r.y)*c.height/r.height))}};
 c.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();c.focus();c.setPointerCapture(e.pointerId);start=pos(e);if(tool==='select')return;
  current={tool,color:$('#capture-color').value,width:Number($('#capture-width').value),font:Math.max(12,Math.min(96,Number($('#capture-font').value)||24)),points:[start],text:$('#capture-text').value};
  if(tool==='text'){if(!current.text.trim()){status('Введите текст подписи');current=null;start=null;$('#capture-text').focus();return}ops.push(current);current=null;start=null;redo=[];render()}
 };
 c.onpointermove=e=>{if(!start)return;const p=pos(e);if(tool==='select'){render();const r=QuadroCaptureCore.rect(start,p,c.width,c.height);ctx.save();ctx.fillStyle='#0007';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(full,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,c.width/c.clientWidth);ctx.strokeRect(r.x,r.y,r.width,r.height);ctx.restore();return}if(!current)return;if(['pencil','marker'].includes(tool)){if(current.points.length<4000)current.points.push(p)}else current.points=[start,p];render()};
 c.onpointerup=e=>{if(!start)return;const p=pos(e);if(tool==='select'){crop(QuadroCaptureCore.rect(start,p,c.width,c.height))}else if(current){if(!['pencil','marker'].includes(tool))current.points=[start,p];ops.push(current);redo=[];current=null;render()}start=null};
 c.onpointercancel=()=>{start=null;current=null;render()};
 d.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{if(b.dataset.tool==='select')reset();else{selectTool(b.dataset.tool);if(tool==='text')$('#capture-text').focus()}});
 $('#capture-all').onclick=()=>crop({x:0,y:0,width:full.width,height:full.height});
 $('#capture-undo').onclick=()=>{if(ops.length)redo.push(ops.pop());render()};$('#capture-redo').onclick=()=>{if(redo.length)ops.push(redo.pop());render()};
 async function exportImage(action){if(tool==='select'){status('Сначала выделите область или нажмите «Весь снимок»');return}render();try{const result=await N.capture(action,{src:c.toDataURL('image/png')});status(result.canceled?'Сохранение отменено':action==='copy'?'Скопировано':'Сохранено')}catch(e){status(e.message)}}
 $('#capture-copy').onclick=()=>exportImage('copy');$('#capture-save').onclick=()=>exportImage('save');$('#capture-close').onclick=e=>{e.preventDefault();e.stopPropagation();d.close()};
 d.addEventListener('cancel',e=>{e.preventDefault();d.close()});
 d.addEventListener('close',()=>{opened=false;full=null;base=null;ops=[];redo=[];start=null;current=null;c.width=1;c.height=1;restore()});
 d.addEventListener('keydown',e=>{if(e.metaKey&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'#capture-redo':'#capture-undo').click()}});
 async function open(kind='browser'){
  if(busy||opened)return;busy=true;
  try{const data=await N.capture(kind);full=await compose(data);await show(d);opened=true;reset();globalThis.QuadroLocale?.apply(locale());c.focus()}
  finally{busy=false}
 }
 // Browser-region capture only. Closing never starts a second capture or a permission request.
 const api={open,isOpen:()=>opened};
 if(N.test)api.test={compose,crop,render,getCanvas:()=>c,getOps:()=>ops,getFull:()=>full,selectTool,exportImage};
 return api;
};
