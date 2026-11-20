 'use strict';
(function(root){
 function internalCorners(pane,stage){return{top:pane.top>stage.top+1?12:0,bottom:pane.bottom<stage.bottom-1?12:0};}
 function install({model,tab,doc=document,clock=()=>performance.now()}){
  const pulses=new WeakMap();let timer=0;
  const prop=(node,key,value)=>{if(node[key]!==value)node[key]=value;},attribute=(node,key,value)=>{if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
  const all=()=>[...doc.querySelectorAll('[data-pane-action="reload"],[data-action="reload"],[data-action="ai-reload"]')];
  function state(b){if(b.dataset.action==='ai-reload')return tab(model.aiId);const p=b.closest('.pane');return tab(model.slots[p?.dataset.pane||model.active]);}
  function sync(){
   for(const b of all()){
    if(!b.querySelector('.mouse-reload-glyph')){const glyph=doc.createElement('span');glyph.className='mouse-reload-glyph';glyph.setAttribute('aria-hidden','true');glyph.textContent='↻';b.replaceChildren(glyph);}
    const item=state(b),pulse=(pulses.get(b)||0)>clock(),busy=!!item?.loading;
    prop(b,'disabled',!item);prop(b.dataset,'loading',String(busy||pulse));b.classList.toggle('mouse-reload-feedback',pulse);attribute(b,'aria-busy',String(busy));
   }
  }
  function feedback(event){const b=event.target.closest?.('[data-pane-action="reload"],[data-action="reload"],[data-action="ai-reload"]');if(!b||b.disabled)return;pulses.set(b,clock()+500);sync();clearTimeout(timer);timer=setTimeout(sync,520);}
  doc.addEventListener('click',feedback,true);
  function fullscreen(active){const windows=root.MouseNative?.platform==='win32';for(const b of doc.querySelectorAll(windows?'[data-action="fullscreen"]':'[data-window="zoom"],[data-action="fullscreen"]')){b.textContent=active?'⤡':'⤢';b.setAttribute('aria-pressed',String(!!active));b.title=(active?'Выйти из полного экрана · ':'Полный экран · ')+(windows?'F11':'⌃⌘F');b.setAttribute('aria-label',b.title);}}
  function round(){const stage=doc.querySelector('#stage'),r=stage.getBoundingClientRect();for(const p of stage.querySelectorAll('.pane')){const c=internalCorners(p.getBoundingClientRect(),r);p.style.setProperty('--pane-round-top',c.top+'px');p.style.setProperty('--pane-round-bottom',c.bottom+'px');}}
  sync();fullscreen(false);return{sync,fullscreen,round,dispose(){clearTimeout(timer);doc.removeEventListener('click',feedback,true);}};
 }
 root.createMouseChromeControls=install;
 if(typeof module!=='undefined')module.exports={internalCorners};
})(typeof globalThis!=='undefined'?globalThis:this);
