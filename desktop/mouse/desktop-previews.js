'use strict';
// Keep preview nodes and decoded images stable across title/loading notifications.
const mousePreviewLayouts=new WeakMap(),mousePreviewIcons=new Map();
function mousePreviewFavicon(image,tab,N){
 const key=tab?.id+'|'+(tab?.favicon||'')+'|'+(tab?.url||'')+'|'+!!tab?.internal;
 if(image.dataset.iconKey===key)return;
 image.dataset.iconKey=key;image.alt='';image.draggable=false;image.src=tab?.internal?'mouse-head.svg':'globe.svg';
 if(!tab?.id||tab.internal||!N?.favicon)return;
 if(!mousePreviewIcons.has(key)){
  while(mousePreviewIcons.size>=80)mousePreviewIcons.delete(mousePreviewIcons.keys().next().value);
  mousePreviewIcons.set(key,Promise.resolve(N.favicon(tab.id)).catch(()=>''));
 }
 mousePreviewIcons.get(key).then(src=>{if(src&&image.isConnected&&image.dataset.iconKey===key&&image.getAttribute('src')!==src)image.src=src;});
}
globalThis.MouseDesktopPreview={
 favicon:mousePreviewFavicon,
 clearIcons(){mousePreviewIcons.clear();},
 render(host,desk,{N,large=false,tree=desk.tree}={}){
  const panes=desk.preview?.panes||[],lookup=new Map(panes.map(p=>[p.pane,p]));
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const structure=JSON.stringify([tree,large,lookup.has('ai'),lookup.has('ai-preview')]);
  host.classList.add('desk-preview');host.classList.toggle('desk-preview-large',large);
  if(mousePreviewLayouts.get(host)!==structure||!host.querySelector(':scope>.desk-preview-main')){
   host.replaceChildren();mousePreviewLayouts.set(host,structure);
   function build(t,parent){
    if(!t)return;
    if(t.id){const cell=make('span','desk-cell');cell.dataset.pane=t.id;const label=make('span','desk-cell-label');label.append(make('img','desk-favicon'),make('span','desk-domain'));cell.append(label);if(large)cell.append(make('span','desk-page-title'));parent.append(cell);return;}
    const split=make('span','desk-split');split.dataset.axis=t.axis;parent.append(split);
    for(const [sub,ratio]of [[t.a,t.ratio],[t.b,1-t.ratio]]){const part=make('span','desk-part');part.style.flex=String(ratio);split.append(part);build(sub,part);}
   }
   const main=make('span','desk-preview-main');host.append(main);build(tree,main);
   if(lookup.has('ai')){const side=make('span','desk-preview-side');side.style.flex='0 0 24%';host.append(side);build(lookup.has('ai-preview')?{axis:'y',ratio:.5,a:{id:'ai'},b:{id:'ai-preview'}}:{id:'ai'},side);}
  }
  for(const cell of host.querySelectorAll('.desk-cell')){
   const p=lookup.get(cell.dataset.pane),src=p?.src||'',hasImage=/^data:image\/(?:jpeg|png);base64,/.test(src);let image=cell.querySelector('.desk-page-image');
   cell.classList.toggle('desk-cell-empty',!p?.id);
   if(hasImage){if(!image){image=make('img','desk-page-image');image.alt='';image.draggable=false;cell.prepend(image);}if(image.getAttribute('src')!==src)image.src=src;}else image?.remove();
   mousePreviewFavicon(cell.querySelector('.desk-favicon'),p,N);
   const domain=p?.site||p?.title||desk.panes?.[cell.dataset.pane]||'Свободно',label=cell.querySelector('.desk-domain');if(label.textContent!==domain)label.textContent=domain;
   const title=cell.querySelector('.desk-page-title'),caption=p?.title||desk.panes?.[cell.dataset.pane]||'Свободное окно';if(title&&title.textContent!==caption)title.textContent=caption;
   const tooltip=p?.title?(p.title+(p.url?'\n'+p.url:'')):'Свободное окно';if(cell.title!==tooltip)cell.title=tooltip;
  }
  host.classList.toggle('desk-empty',!desk.count);let empty=host.querySelector(':scope>.desk-empty-label');if(!desk.count&&!empty)host.append(make('span','desk-empty-label','Пустой стол'));else if(desk.count)empty?.remove();
 },
 icon(mode){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',mode.icon);svg.append(path);return svg;}
};
