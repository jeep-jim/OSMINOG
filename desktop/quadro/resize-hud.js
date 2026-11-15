'use strict';
// Ephemeral geometry only: no history, settings or persistent workspace state.
(function(root){
 function create(){
  let active=false,frame=0,before=new Map();
  const targets=()=>[...document.querySelectorAll('.pane,#ai-panel,#library-dialog')].filter(e=>!e.hidden&&e.getBoundingClientRect().width>1);
  function read(e){const r=e.getBoundingClientRect();return{width:Math.round(r.width),height:Math.round(r.height)};}
  function paint(){frame=0;if(!active)return;for(const e of targets()){
   const now=read(e),old=before.get(e);let badge=e.querySelector(':scope > .resize-size-hud');
   const changed=old&&(old.width!==now.width||old.height!==now.height);
   if(changed){if(!badge){badge=document.createElement('output');badge.className='resize-size-hud';badge.setAttribute('aria-hidden','true');e.append(badge);}badge.textContent=now.width+' × '+now.height;badge.hidden=false;}
   else if(badge)badge.hidden=true;
  }}
  function update(){if(!active)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);}
  function end(){active=false;cancelAnimationFrame(frame);frame=0;before.clear();document.querySelectorAll('.resize-size-hud').forEach(e=>e.remove());}
  function begin(){end();active=true;for(const e of targets())before.set(e,read(e));}
  return{begin,update,end};
 }
 root.createMouseResizeHUD=create;
})(globalThis);
