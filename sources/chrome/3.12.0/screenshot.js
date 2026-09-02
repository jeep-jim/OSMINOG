const COPY={
  en:{subtitle:"Select, annotate and keep only what matters",reset:"Reset selection",close:"Close",empty:"No screenshot is waiting. Start a new capture from the OSMINOG toolbar or extension popup.",stepTitle:"Select an area",stepHint:"Crop first, then add arrows, shapes, notes or freehand marks.",toolsTitle:"Markup tools",copy:"Copy to clipboard",download:"Save PNG",open:"Open in OSMINOG",local:"The image and annotations stay on this device.",copied:"Copied to clipboard.",copyFailed:"Chrome could not copy this image. Try Save PNG.",saved:"PNG saved.",opened:"Opening the selected area in OSMINOG…",textPrompt:"Type a note",toolNames:{crop:"Crop",pen:"Pen",line:"Line",arrow:"Arrow",rect:"Rectangle",ellipse:"Ellipse",text:"Text",undo:"Undo"}},
  ru:{subtitle:"Выберите область и добавьте понятные пометки",reset:"Сбросить выделение",close:"Закрыть",empty:"Скриншот не найден. Запустите новый захват из OSMINOG или меню расширения.",stepTitle:"Выберите область",stepHint:"Сначала задайте кадр, затем добавьте стрелки, фигуры, текст или рисунок.",toolsTitle:"Инструменты разметки",copy:"Копировать в буфер",download:"Сохранить PNG",open:"Открыть в OSMINOG",local:"Изображение и разметка остаются на этом устройстве.",copied:"Скопировано в буфер обмена.",copyFailed:"Chrome не смог скопировать изображение. Используйте «Сохранить PNG».",saved:"PNG сохранён.",opened:"Открываю выбранную область в OSMINOG…",textPrompt:"Введите подпись",toolNames:{crop:"Кадрировать",pen:"Карандаш",line:"Линия",arrow:"Стрелка",rect:"Прямоугольник",ellipse:"Эллипс",text:"Текст",undo:"Отменить"}}
};
let language=(chrome.i18n.getUILanguage?.()||navigator.language||"en").toLowerCase().startsWith("ru")?"ru":"en";
let text=COPY[language];
const canvas=document.querySelector("#cropCanvas");
const context=canvas.getContext("2d");
const status=document.querySelector("#status");
const info=document.querySelector("#selectionInfo");
const image=new Image();
let selection=null;
let pointerStart=null;
let activeTool="crop";
let draft=null;
const annotations=[];

function applyCopy(){
  document.querySelector("#subtitle").textContent=text.subtitle;
  document.querySelector("#reset").textContent=text.reset;
  document.querySelector("#close").title=text.close;
  document.querySelector("#empty").textContent=text.empty;
  document.querySelector("#stepTitle").textContent=text.stepTitle;
  document.querySelector("#stepHint").textContent=text.stepHint;
  document.querySelector("#toolsTitle").textContent=text.toolsTitle;
  document.querySelector("#copy").textContent=text.copy;
  document.querySelector("#download").textContent=text.download;
  document.querySelector("#openEditor").textContent=text.open;
  document.querySelectorAll("[data-tool]").forEach(button=>button.title=text.toolNames[button.dataset.tool]);
  document.querySelector("#undoAnnotation").title=text.toolNames.undo;
  status.textContent=text.local;
}
function normalize(start,end){
  const x=Math.max(0,Math.min(start.x,end.x));
  const y=Math.max(0,Math.min(start.y,end.y));
  return{x,y,w:Math.max(1,Math.min(canvas.width,Math.max(start.x,end.x))-x),h:Math.max(1,Math.min(canvas.height,Math.max(start.y,end.y))-y)};
}
function canvasPoint(event){
  const rect=canvas.getBoundingClientRect();
  return{x:Math.max(0,Math.min(canvas.width,(event.clientX-rect.left)*canvas.width/rect.width)),y:Math.max(0,Math.min(canvas.height,(event.clientY-rect.top)*canvas.height/rect.height))};
}
function toolStyle(){return{color:document.querySelector("#drawColor").value,width:Number(document.querySelector("#drawWidth").value)||6}}
function drawArrow(ctx,start,end,color,width){
  const angle=Math.atan2(end.y-start.y,end.x-start.x),head=Math.max(14,width*3.2);
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-head*Math.cos(angle-Math.PI/6),end.y-head*Math.sin(angle-Math.PI/6));ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-head*Math.cos(angle+Math.PI/6),end.y-head*Math.sin(angle+Math.PI/6));ctx.stroke();
}
function drawAnnotation(ctx,item,offsetX=0,offsetY=0){
  ctx.save();ctx.translate(offsetX,offsetY);ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.lineWidth=item.width;ctx.lineCap="round";ctx.lineJoin="round";
  if(item.type==="pen"){
    ctx.beginPath();item.points.forEach((p,index)=>index?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  }else if(item.type==="line"){
    ctx.beginPath();ctx.moveTo(item.start.x,item.start.y);ctx.lineTo(item.end.x,item.end.y);ctx.stroke();
  }else if(item.type==="arrow")drawArrow(ctx,item.start,item.end,item.color,item.width);
  else if(item.type==="rect"){
    const box=normalize(item.start,item.end);ctx.strokeRect(box.x,box.y,box.w,box.h);
  }else if(item.type==="ellipse"){
    const box=normalize(item.start,item.end);ctx.beginPath();ctx.ellipse(box.x+box.w/2,box.y+box.h/2,box.w/2,box.h/2,0,0,Math.PI*2);ctx.stroke();
  }else if(item.type==="text"){
    ctx.font=`700 ${Math.max(22,item.width*4)}px "Segoe UI", Arial, sans-serif`;ctx.textBaseline="top";ctx.lineWidth=Math.max(3,item.width/2);ctx.strokeStyle="#07101dcc";ctx.strokeText(item.text,item.point.x,item.point.y);ctx.fillText(item.text,item.point.x,item.point.y);
  }
  ctx.restore();
}
function drawAll(ctx,offsetX=0,offsetY=0){annotations.forEach(item=>drawAnnotation(ctx,item,offsetX,offsetY));if(draft)drawAnnotation(ctx,draft,offsetX,offsetY)}
function render(){
  if(!image.complete||!image.naturalWidth)return;
  context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0);drawAll(context);
  if(selection){
    context.fillStyle="#06101db8";context.fillRect(0,0,canvas.width,canvas.height);
    context.save();context.beginPath();context.rect(selection.x,selection.y,selection.w,selection.h);context.clip();context.drawImage(image,0,0);drawAll(context);context.restore();
    context.strokeStyle="#58a0ff";context.lineWidth=Math.max(2,canvas.width/700);context.setLineDash([12,8]);context.strokeRect(selection.x,selection.y,selection.w,selection.h);context.setLineDash([]);
    info.textContent=`${Math.round(selection.w)} × ${Math.round(selection.h)} px · x ${Math.round(selection.x)} · y ${Math.round(selection.y)}`;
  }
}
function resetSelection(){selection={x:0,y:0,w:canvas.width,h:canvas.height};render()}
function croppedCanvas(){
  const output=document.createElement("canvas");output.width=Math.max(1,Math.round(selection.w));output.height=Math.max(1,Math.round(selection.h));
  const outputContext=output.getContext("2d");outputContext.drawImage(image,selection.x,selection.y,selection.w,selection.h,0,0,output.width,output.height);drawAll(outputContext,-selection.x,-selection.y);return output;
}
function cropBlob(){return new Promise((resolve,reject)=>croppedCanvas().toBlob(blob=>blob?resolve(blob):reject(new Error("PNG encoding failed")),"image/png"))}
function cropDataUrl(){return croppedCanvas().toDataURL("image/png")}
function setTool(tool){activeTool=tool;document.querySelectorAll("[data-tool]").forEach(button=>button.classList.toggle("active",button.dataset.tool===tool));canvas.dataset.tool=tool}

canvas.addEventListener("pointerdown",event=>{
  if(!image.naturalWidth)return;event.preventDefault();const point=canvasPoint(event);pointerStart=point;canvas.setPointerCapture(event.pointerId);
  if(activeTool==="crop")selection={x:point.x,y:point.y,w:1,h:1};
  else if(activeTool==="text"){
    const value=prompt(text.textPrompt,"");if(value?.trim())annotations.push({type:"text",point,text:value.trim(),...toolStyle()});pointerStart=null;
  }else if(activeTool==="pen")draft={type:"pen",points:[point],...toolStyle()};
  else draft={type:activeTool,start:point,end:point,...toolStyle()};
  render();
});
canvas.addEventListener("pointermove",event=>{
  if(!pointerStart)return;const point=canvasPoint(event);
  if(activeTool==="crop")selection=normalize(pointerStart,point);
  else if(activeTool==="pen")draft.points.push(point);
  else draft.end=point;
  render();
});
canvas.addEventListener("pointerup",event=>{
  if(!pointerStart)return;const point=canvasPoint(event);
  if(activeTool==="crop")selection=normalize(pointerStart,point);
  else{if(activeTool==="pen")draft.points.push(point);else draft.end=point;annotations.push(draft);draft=null}
  pointerStart=null;try{canvas.releasePointerCapture(event.pointerId)}catch(_error){}render();
});
canvas.addEventListener("pointercancel",event=>{pointerStart=null;draft=null;try{canvas.releasePointerCapture(event.pointerId)}catch(_error){}render()});
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>setTool(button.dataset.tool)));
document.querySelector("#undoAnnotation").addEventListener("click",()=>{annotations.pop();render()});
document.querySelector("#reset").addEventListener("click",()=>{annotations.splice(0);resetSelection()});
document.querySelector("#close").addEventListener("click",()=>window.close());
document.addEventListener("keydown",event=>{if(event.key==="Escape")window.close();if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();annotations.pop();render()}});
document.querySelector("#copy").addEventListener("click",async()=>{try{const blob=await cropBlob();await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);status.textContent=text.copied}catch(_error){status.textContent=text.copyFailed}});
document.querySelector("#download").addEventListener("click",async()=>{const blob=await cropBlob();const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="OSMINOG-screenshot-"+new Date().toISOString().replace(/[:.]/g,"-")+".png";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);status.textContent=text.saved});
document.querySelector("#openEditor").addEventListener("click",async()=>{const dataUrl=cropDataUrl();await chrome.storage.local.set({richCraftPendingImage:dataUrl,richCraftPendingAt:Date.now(),briefCraftLastCachedImage:dataUrl,briefCraftLastCachedImageAt:Date.now()});await chrome.storage.local.remove(["richCraftPendingCapture"]);status.textContent=text.opened;await chrome.runtime.sendMessage({type:"OPEN_EDITOR",query:"import=screenshot"})});

async function initialize(){
  const stored=await chrome.storage.local.get(["richCraftPendingCapture","briefCraftStudioV2"]);language=stored.briefCraftStudioV2?.language==="ru"?"ru":"en";text=COPY[language];document.documentElement.lang=language;applyCopy();
  if(!stored.richCraftPendingCapture){canvas.hidden=true;document.querySelector("#empty").hidden=false;document.querySelectorAll("aside button:not(#reset):not(#close)").forEach(button=>button.disabled=true);return}
  image.onload=()=>{canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;resetSelection()};image.src=stored.richCraftPendingCapture;
}
initialize();
