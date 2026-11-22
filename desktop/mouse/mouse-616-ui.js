 'use strict';
(function(root){
 function paneCorners({focused=false,paneMode='rounded'}={}){return paneMode==='square'?{top:0,bottom:0}:{top:12,bottom:focused?0:12};}
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
  function fullscreen(active){
   const nativeMaximize=['win32','linux'].includes(root.MouseNative?.platform),selector='[data-action="fullscreen"],[data-settings-action="fullscreen"]',caption=active?'Выйти из полного экрана':'Полный экран';
   for(const b of doc.querySelectorAll(nativeMaximize?selector:'[data-window="zoom"],'+selector)){
    prop(b,'textContent',b.dataset.settingsAction==='fullscreen'?caption:active?'⤡':'⤢');attribute(b,'aria-pressed',String(!!active));prop(b,'title',caption+' · '+(nativeMaximize?'F11':'⌃⌘F'));attribute(b,'aria-label',b.title);
   }
  }
  function round(){for(const p of doc.querySelector('#stage').querySelectorAll('.pane')){const c=paneCorners({focused:!!model.focusPane,paneMode:model.appearance?.paneMode});for(const edge of ['top','bottom']){const name='--pane-round-'+edge,value=c[edge]+'px';if(p.style.getPropertyValue(name)!==value)p.style.setProperty(name,value);}}}
  sync();fullscreen(false);return{sync,fullscreen,round,dispose(){clearTimeout(timer);doc.removeEventListener('click',feedback,true);}};
 }
 root.createMouseChromeControls=install;
 if(typeof module!=='undefined')module.exports={paneCorners};
})(typeof globalThis!=='undefined'?globalThis:this);
