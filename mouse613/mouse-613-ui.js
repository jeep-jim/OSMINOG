'use strict';
// Shell-only rearrangement. Native website views retain their identity and session.
globalThis.createMouse613UI=({N,m,L,tab,renderTabs,renderTree,applySide,save,requestLayout,hideHints,openPage})=>{
 const $=s=>document.querySelector(s),strip=$('#tabstrip');let drag=null,suppressClick=false;
 const mainIds=()=>m.state.tabs.filter(t=>t.lane!=='side').map(t=>t.id);
 const order=()=>{const ids=mainIds();return [...new Set([...(m.tabOrder||[]).filter(id=>ids.includes(id)),...ids])];};
 function swapTabs(a,b){if(a===b)return;const ids=order(),i=ids.indexOf(a),j=ids.indexOf(b);if(i<0||j<0)return;[ids[i],ids[j]]=[ids[j],ids[i]];m.tabOrder=ids;renderTabs();save();}
 function swapPanes(a,b){const leaves=L.leaves(m.tree);if(a===b||!leaves.includes(a)||!leaves.includes(b))return;[m.slots[a],m.slots[b]]=[m.slots[b]||'',m.slots[a]||''];m.active=b;renderTree();applySide();save();}
 function placeTab(id,pane){if(!mainIds().includes(id)||!L.leaves(m.tree).includes(pane))return;const from=L.leaves(m.tree).find(p=>m.slots[p]===id);if(from)return swapPanes(from,pane);m.slots[pane]=id;m.active=pane;renderTree();applySide();save();}
 function clearTarget(){document.querySelectorAll('.mouse-drop-target').forEach(e=>e.classList.remove('mouse-drop-target'));}
 function finish(e,cancel=false){if(!drag||e&&e.pointerId!==drag.pointer)return;const d=drag;drag=null;m.swapDrag=false;clearTarget();document.body.classList.remove('mouse-swapping');if(d.capture?.hasPointerCapture(d.pointer))d.capture.releasePointerCapture(d.pointer);
  if(d.moved){suppressClick=true;setTimeout(()=>{suppressClick=false},0);if(!cancel&&d.target){if(d.kind==='tab'&&d.target.kind==='tab')swapTabs(d.id,d.target.id);else if(d.kind==='pane'&&d.target.kind==='pane')swapPanes(d.id,d.target.id);else if(d.kind==='tab'&&d.target.kind==='pane')placeTab(d.id,d.target.id);}}
  requestLayout();
 }
 document.addEventListener('pointerdown',e=>{if(e.button!==0||m.drag||drag||document.querySelector('dialog[open]:not([data-nonmodal])'))return;const t=e.target.closest('#tabstrip .tab-item'),h=e.target.closest('.pane-head');let d;
  if(t&&!e.target.closest('.tab-close'))d={kind:'tab',id:t.dataset.tab,capture:strip};
  else if(h&&!e.target.closest('button,input,form,select'))d={kind:'pane',id:h.closest('.pane').dataset.pane,capture:document.body};
  if(d)drag={...d,pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
 },true);
 document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;e.preventDefault();
  if(!drag.moved){drag.moved=true;m.swapDrag=true;hideHints();drag.capture.setPointerCapture(drag.pointer);document.body.classList.add('mouse-swapping');void N.browser('layout',{panels:[]}).catch(()=>finish(e,true));}
  const at=document.elementFromPoint(e.clientX,e.clientY),t=at?.closest('#tabstrip .tab-item'),p=at?.closest('.pane');clearTarget();drag.target=null;
  if(drag.kind==='tab'&&t){drag.target={kind:'tab',id:t.dataset.tab};t.classList.add('mouse-drop-target');}
  else if(p){drag.target={kind:'pane',id:p.dataset.pane};p.classList.add('mouse-drop-target');}
 },{passive:false});
 document.addEventListener('pointerup',e=>finish(e),true);document.addEventListener('pointercancel',e=>finish(e,true),true);window.addEventListener('blur',()=>finish(null,true));
 document.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(drag?.moved){e.preventDefault();e.stopImmediatePropagation();finish(null,true);return;}const input=e.target.closest?.('.pane-address input');if(input){e.preventDefault();e.stopImmediatePropagation();const item=tab(m.slots[input.closest('.pane').dataset.pane]);input.value=item?.internal?'':item?.url||'';hideHints();input.blur();}},true);
 document.addEventListener('focusin',e=>{const input=e.target.closest?.('.pane-address input');if(!input)return;input.closest('.pane-head').classList.add('address-editing');requestAnimationFrame(()=>{if(document.activeElement===input)input.select()});});
 document.addEventListener('focusout',e=>{const input=e.target.closest?.('.pane-address input');if(input)input.closest('.pane-head').classList.remove('address-editing');});
 function fitTabs(){const list=[...strip.querySelectorAll('.tab-item')].filter(e=>e.getBoundingClientRect().width>0),width=list[0]?.getBoundingClientRect().width||230;strip.dataset.density=width<28?'tiny':width<75?'compact':'normal';}
 new ResizeObserver(fitTabs).observe(strip);new MutationObserver(fitTabs).observe(strip,{childList:true});
 const right=$('#footer-right');for(const selector of ['#history-button','[data-action=bookmarks]','#downloads-button'])right.insertBefore($(selector),$('#ai-toggle'));
 $('#status').textContent='';
 const about=document.createElement('p');about.className='hint mouse-domain';about.append('Mouse Browser · ');const link=document.createElement('button');link.type='button';link.textContent='mouse.black';link.title='Домен Mouse Browser';link.onclick=()=>{document.querySelector('#settings-dialog').close();void openPage('https://mouse.black/');};about.append(link);$('#settings-dialog .dialog-content').append(about);
 return{swapTabs,swapPanes,placeTab,order,fitTabs};
};
