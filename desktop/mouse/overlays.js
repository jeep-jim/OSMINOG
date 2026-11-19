'use strict';
globalThis.createMouseOverlays=({N,restore,error})=>{
 const held=new Set();let sequence=0,last=false;
 const active=()=>held.size>0||!!document.querySelector('dialog[open]:not([data-nonmodal])');
 function publish(force=false){const blocked=active();if(!force&&blocked===last)return Promise.resolve();last=blocked;return N.overlay({sequence:++sequence,blocked}).catch(e=>{error(e.message);throw e;});}
 function reconcile(){const wasBlocked=last;return publish().then(()=>{if(wasBlocked&&!active())restore();});}
 function bind(d){if(d.dataset.overlayBound)return;d.dataset.overlayBound='true';
  d.addEventListener('close',()=>{held.delete(d);void reconcile().catch(()=>{});});
 }
 async function show(d){
  bind(d);held.add(d);
  try{await publish(true);if(!d.open)d.showModal();d.querySelector('input,button,[tabindex]')?.focus();}
  catch(e){held.delete(d);if(d.open)d.close();await publish(true).catch(()=>{});restore();throw e;}
 }
 // Cover direct showModal(), newly inserted/nested dialogs and removal without
 // close(). Page titles, loading labels and progress text are not modal state:
 // their childList notifications must not trigger another native layout.
 const isDialog=node=>node?.nodeType===1&&(node.localName==='dialog'||node.tagName==='DIALOG');
 const observer=new MutationObserver(records=>{
  const changed=new Set(),closed=new Set(),collect=node=>{if(node.nodeType!==1)return;if(isDialog(node))changed.add(node);for(const dialog of node.querySelectorAll('dialog'))changed.add(dialog);};
  for(const record of records){if(record.type==='attributes'){if(isDialog(record.target)){changed.add(record.target);if(!record.target.open)closed.add(record.target);}}else{for(const node of record.addedNodes)collect(node);for(const node of record.removedNodes)collect(node);}}
  if(!changed.size)return;
  // A newly appended dialog may still be awaiting show()'s native hide ACK.
  // Only an actual open-attribute removal (or detachment) releases that hold.
  for(const dialog of changed){if(dialog.isConnected)bind(dialog);if(!dialog.isConnected||closed.has(dialog))held.delete(dialog);}
  void reconcile().catch(()=>{});
 });
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
  if(select.disabled||chooser.open)return;anchor=select;chooser.dataset.select=select.id;chooser.replaceChildren();
  for(const option of select.options){if(option.hidden)continue;const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.disabled=option.disabled;b.dataset.value=option.value;b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));
   if(select.id==='ai-select'){b.classList.add('provider-option');const text=document.createElement('span');text.textContent=option.textContent;text.className='provider-label';b.replaceChildren();const icon=document.createElement('img');icon.className='favicon';icon.alt='';icon.src='globe.svg';const check=document.createElement('span');check.className='provider-check';check.setAttribute('aria-hidden','true');check.textContent=option.selected?'✓':'';b.append(icon,text);b.append(check);globalThis.MouseAIIcons?.apply(icon,option.value);}
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
