'use strict';
// A bounded PDF viewer. It never loads the export/font-editing runtime, creates
// annotation canvases, changes document bytes, or marks a document dirty.
globalThis.createMousePDFViewer=async({host,document:doc,status=()=>{}})=>{
 const engine=await import('./document-vendor/pdf.mjs');engine.GlobalWorkerOptions.workerSrc=new URL('document-vendor/pdf.worker.mjs',document.baseURI).href;
 const task=engine.getDocument({data:new Uint8Array(doc.bytes).slice(),isEvalSupported:false,enableScripting:false,maxImageSize:16000000,canvasMaxAreaInBytes:64000000,useSystemFonts:true,disableAutoFetch:true});let pdf;
 try{pdf=await task.promise;}catch(error){await task.destroy().catch(()=>{});throw error;}
 let page=Math.max(1,Math.min(pdf.numPages,Math.floor(Number(doc.view?.page)||1))),scale=Math.max(.35,Math.min(2.5,Number(doc.view?.scale)||1.1)),rotation=Number(doc.view?.rotation)||0,renderTask=null,textLayer=null,renderedPage=null,disposed=false,epoch=0;
 host.innerHTML='<div class="document-pdf-tools"><button data-pdf="prev" type="button" aria-label="Предыдущая страница">←</button><span class="document-pdf-page"></span><button data-pdf="next" type="button" aria-label="Следующая страница">→</button><button data-pdf="minus" type="button" aria-label="Уменьшить масштаб">−</button><span class="document-pdf-scale"></span><button data-pdf="plus" type="button" aria-label="Увеличить масштаб">+</button><button data-pdf="rotate" type="button" aria-label="Повернуть вид">↻</button></div><div class="document-pdf-scroll"><div class="document-pdf-sheet"><canvas class="document-pdf-base"></canvas><div class="document-pdf-text-layer"></div></div></div>';
 const base=host.querySelector('.document-pdf-base'),sheet=host.querySelector('.document-pdf-sheet'),text=host.querySelector('.document-pdf-text-layer'),scroll=host.querySelector('.document-pdf-scroll');
 if(globalThis.MouseNative?.test)base.dataset.workerOffMainThread=String(task._worker?.port instanceof Worker);
 async function draw(){
  const ticket=++epoch,previous=renderTask;previous?.cancel();textLayer?.cancel();textLayer=null;if(previous)await previous.promise.catch(()=>{});if(ticket!==epoch||disposed)return;
  renderedPage?.cleanup();renderedPage=null;const p=await pdf.getPage(page);if(ticket!==epoch||disposed){p.cleanup();return;}renderedPage=p;
  const viewport=p.getViewport({scale,rotation:(p.rotate+rotation)%360}),ratio=Math.min(devicePixelRatio||1,2);if(viewport.width*viewport.height*ratio*ratio>16000000)throw Error('Уменьшите масштаб: страница слишком велика');
  base.width=Math.ceil(viewport.width*ratio);base.height=Math.ceil(viewport.height*ratio);base.style.width=sheet.style.width=viewport.width+'px';base.style.height=sheet.style.height=viewport.height+'px';text.replaceChildren();text.style.setProperty('--scale-factor',String(scale));
  host.querySelector('.document-pdf-page').textContent=page+' / '+pdf.numPages;host.querySelector('.document-pdf-scale').textContent=Math.round(scale*100)+'%';host.querySelector('[data-pdf=prev]').disabled=page<=1;host.querySelector('[data-pdf=next]').disabled=page>=pdf.numPages;
  renderTask=p.render({canvasContext:base.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});try{await renderTask.promise;}catch(error){if(error.name!=='RenderingCancelledException')throw error;}
  if(ticket!==epoch||disposed)return;
  textLayer=new engine.TextLayer({textContentSource:p.streamTextContent({includeMarkedContent:true}),container:text,viewport});try{await textLayer.render();}catch(error){if(ticket===epoch&&!disposed&&error.name!=='AbortException')status('Страница показана; выделение текста недоступно');}
 }
 const safeDraw=()=>void draw().catch(error=>{if(!disposed)status(error.message);});
 host.querySelectorAll('[data-pdf]').forEach(button=>button.onclick=()=>{const action=button.dataset.pdf;if(action==='prev')page=Math.max(1,page-1);if(action==='next')page=Math.min(pdf.numPages,page+1);if(action==='minus')scale=Math.max(.35,Math.round((scale-.15)*100)/100);if(action==='plus')scale=Math.min(2.5,Math.round((scale+.15)*100)/100);if(action==='rotate')rotation=(rotation+90)%360;safeDraw();});
 try{await draw();}catch(error){disposed=true;renderTask?.cancel();textLayer?.cancel();renderedPage?.cleanup();await task.destroy().catch(()=>{});throw error;}
 scroll.scrollTop=Math.max(0,Number(doc.view?.top)||0);scroll.scrollLeft=Math.max(0,Number(doc.view?.left)||0);status('PDF · '+pdf.numPages+' стр. · Только просмотр');
 return{getView:()=>({page,scale,rotation,top:scroll.scrollTop,left:scroll.scrollLeft}),dispose(){if(disposed)return;disposed=true;epoch++;renderTask?.cancel();textLayer?.cancel();renderedPage?.cleanup();void task.destroy().catch(()=>{});host.replaceChildren();}};
};
