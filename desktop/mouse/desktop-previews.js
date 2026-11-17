'use strict';
// Mission Control previews are last-visible RAM images, never hidden-page loads.
globalThis.MouseDesktopPreview={
 render(host,desk,{N,large=false,tree=desk.tree}={}){
  host.replaceChildren();host.classList.add('desk-preview');host.classList.toggle('desk-preview-large',large);
  const panes=desk.preview?.panes||[],lookup=new Map(panes.map(p=>[p.pane,p]));
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function build(t,parent){
   if(!t)return;
   if(t.id){
    const p=lookup.get(t.id),cell=make('span','desk-cell'+(p?.id?'':' desk-cell-empty'));cell.dataset.pane=t.id;
    if(p?.src?.startsWith('data:image/jpeg;base64,')||p?.src?.startsWith('data:image/png;base64,')){const im=make('img','desk-page-image');im.src=p.src;im.alt='';im.draggable=false;cell.append(im);}
    const label=make('span','desk-cell-label'),ico=make('img','desk-favicon');ico.alt='';ico.src=p?.internal?'mouse-head.svg':'globe.svg';label.append(ico,make('span','desk-domain',p?.site||p?.title||desk.panes?.[t.id]||'Свободно'));cell.append(label);
    if(p?.id&&N?.favicon&&!p.internal)N.favicon(p.id).then(src=>{if(src&&ico.isConnected)ico.src=src}).catch(()=>{});
    if(large){const title=make('span','desk-page-title',p?.title||desk.panes?.[t.id]||'Свободное окно');cell.append(title);}
    cell.title=p?.title?(p.title+(p.url?'\n'+p.url:'')):'Свободное окно';parent.append(cell);return;
   }
   const split=make('span','desk-split');split.dataset.axis=t.axis;parent.append(split);
   for(const [sub,ratio]of [[t.a,t.ratio],[t.b,1-t.ratio]]){const part=make('span','desk-part');part.style.flex=String(ratio);split.append(part);build(sub,part);}
  }
  const main=make('span','desk-preview-main');host.append(main);build(tree,main);
  const ai=lookup.get('ai');if(ai){const side=make('span','desk-preview-side');side.style.flex='0 0 24%';host.append(side);const proxy={id:'ai'};build(proxy,side);}
  if(!desk.count){host.classList.add('desk-empty');const empty=make('span','desk-empty-label','Пустой стол');host.append(empty);}else host.classList.remove('desk-empty');
 },
 icon(mode){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',mode.icon);svg.append(path);return svg;}
};
