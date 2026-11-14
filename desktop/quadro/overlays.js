'use strict';
globalThis.createQuadroOverlays=({N,restore,error})=>{
 const held=new Set();let sequence=0,last=false;
 const active=()=>held.size>0||!!document.querySelector('dialog[open]');
 function publish(force=false){const blocked=active();if(!force&&blocked===last)return Promise.resolve();last=blocked;return N.overlay({sequence:++sequence,blocked}).catch(e=>{error(e.message);throw e;});}
 function bind(d){if(d.dataset.overlayBound)return;d.dataset.overlayBound='true';
  d.addEventListener('close',()=>{held.delete(d);void publish(true).then(restore).catch(()=>{});});
 }
 async function show(d){
  bind(d);held.add(d);
  try{await publish(true);if(!d.open)d.showModal();d.querySelector('input,button,[tabindex]')?.focus();}
  catch(e){held.delete(d);if(d.open)d.close();await publish(true).catch(()=>{});restore();throw e;}
 }
 // Also covers dialogs inserted later and incidental direct showModal() callers.
 const observer=new MutationObserver(()=>{document.querySelectorAll('dialog').forEach(bind);void publish().then(()=>{if(!active())restore();}).catch(()=>{});});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 document.querySelectorAll('dialog').forEach(bind);
 // Native HTML select popups may be obscured by native pages. Use one accessible
 // compact glass chooser through the same modal barrier, not a separate UI system.
 const chooser=document.createElement('dialog');chooser.id='choice-dialog';chooser.className='choice-dialog';chooser.setAttribute('aria-label','Выберите вариант');document.body.append(chooser);
 let anchor=null;
 chooser.addEventListener('close',()=>{anchor?.focus();anchor=null;});
 chooser.addEventListener('click',e=>{if(e.target===chooser){const r=chooser.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)chooser.close();}});
 chooser.addEventListener('keydown',e=>{const buttons=[...chooser.querySelectorAll('button')];const i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}});
 async function choose(select){
  if(select.disabled||chooser.open)return;anchor=select;chooser.replaceChildren();
  for(const option of select.options){if(option.hidden)continue;const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.disabled=option.disabled;b.dataset.value=option.value;b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));
   b.onclick=()=>{select.value=option.value;chooser.close();select.dispatchEvent(new Event('change',{bubbles:true}));};chooser.append(b);
  }
  const r=select.getBoundingClientRect(),width=Math.min(innerWidth-24,Math.max(160,r.width)),height=Math.min(320,chooser.children.length*32+12,innerHeight-24);
  chooser.style.width=width+'px';chooser.style.maxHeight=height+'px';chooser.style.left=Math.max(12,Math.min(innerWidth-width-12,r.left))+'px';chooser.style.top=(r.top>innerHeight/2?Math.max(12,r.top-height-5):Math.min(innerHeight-height-12,r.bottom+5))+'px';
  await show(chooser);chooser.querySelector('[aria-selected=true]')?.focus();
 }
 document.addEventListener('pointerdown',e=>{if(e.button===0&&e.target instanceof HTMLSelectElement){e.preventDefault();void choose(e.target).catch(e=>error(e.message));}},true);
 document.addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement&&[' ','Enter','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();void choose(e.target).catch(e=>error(e.message));}},true);
 return{show,active,choose,sync:()=>publish(true)};
};
