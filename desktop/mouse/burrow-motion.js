'use strict';
// Nora keeps its final shape and dimensions. Only its inner panel translates;
// the compositor owns animation frames, while geometry changes on window resize.
(function(root){
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const mix=(a,b,t)=>a+(b-a)*t;
 const n=x=>Math.round(x*1000)/1000;
 function contour({width,height}){
  const w=Math.max(1,Number(width)||1),h=Math.max(0,Number(height)||0),cx=w/2;
  const base=w,body=w*.928;
  const left=cx-body/2,right=cx+body/2,start=cx-base/2,end=cx+base/2;
  const rx=Math.min(w*.076,body*.4,h*.8),ry=Math.min(64,h*.55),foot=Math.min(40,h*.35),k=.55228475;
  const d=`M${n(start)} ${n(h)}C${n(mix(start,left,.65))} ${n(h)} ${n(left)} ${n(h-foot*.39)} ${n(left)} ${n(h-foot)}V${n(ry)}C${n(left)} ${n(ry*(1-k))} ${n(left+rx*(1-k))} 0 ${n(left+rx)} 0H${n(right-rx)}C${n(right-rx*(1-k))} 0 ${n(right)} ${n(ry*(1-k))} ${n(right)} ${n(ry)}V${n(h-foot)}C${n(right)} ${n(h-foot*.39)} ${n(mix(end,right,.65))} ${n(h)} ${n(end)} ${n(h)}`;
  return{d,closed:d+'Z',width:w,height:h,start,end,left,right,rx,ry,foot,center:cx};
 }
 const api={contour};
 if(typeof module!=='undefined')module.exports=api;
 root.MouseBurrowGeometry=api;
 root.createMouseBurrowMotion=({tray,content,footer,button,settled})=>{
  const local=tray.querySelector('.desk-burrow-shape'),outline=local.querySelector(':scope>path'),clip=local.querySelector('clipPath path');
  const panel=document.createElement('div');panel.className='desk-burrow-panel';
  local.id='mouse-dock-surface';outline.id='mouse-dock-outline';
  const fill=document.createElementNS('http://www.w3.org/2000/svg','path');fill.id='mouse-dock-fill';local.insertBefore(fill,outline);
  const glass=tray.querySelector('.desk-glass');panel.append(local);if(glass)panel.append(glass);panel.append(content);tray.append(panel);
  const scrim=document.createElement('div');scrim.id='mouse-dock-scrim';scrim.hidden=true;scrim.setAttribute('aria-hidden','true');document.body.append(scrim);
  const toolbar=document.querySelector('.toolbar'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),duration=300;
  let active=false,goal=0,position=0,movement=null,shade=null,waiter=null,generation=0,geometry=null,geometryDirty=true,measurements=0,geometryWrites=0,preparing=false,preparationFrame=0;
  const cancelWaiter=()=>{if(waiter){waiter.resolve(false);waiter=null;}};
  const cancelPreparation=()=>{preparing=false;if(preparationFrame)cancelAnimationFrame(preparationFrame);preparationFrame=0;};
  const progress=()=>{if(!movement)return position;const value=movement.effect.getComputedTiming().progress;if(value!==null&&value!==undefined)return clamp(value);const time=Number(movement.currentTime);return time>=duration?1:time<=0?0:position;};
  function measure(){
   measurements++;
   const r=footer.getBoundingClientRect(),line=parseFloat(getComputedStyle(footer).borderTopWidth)||1,baseline=r.top,top=toolbar?.getBoundingClientRect().bottom||40;
   const width=Math.max(1,tray.getBoundingClientRect().width),height=Math.max(1,Math.min(440,baseline-top-12));
   return{width,height,targetHeight:height,baseline,left:(innerWidth-width)/2,center:innerWidth/2,bottom:innerHeight-baseline,viewportWidth:innerWidth,viewportHeight:innerHeight,line};
  }
  function sync(){
   if(!active||tray.hidden||!geometryDirty)return;
   geometryDirty=false;const next=measure();
   if(geometry&&['width','height','baseline','left','bottom','line'].every(key=>Math.abs(geometry[key]-next[key])<.01))return;
   const shape=contour({width:next.width,height:next.height});
   geometry={...next,shape,paths:{outline:shape.d,fill:shape.closed}};geometryWrites++;
   tray.style.bottom=next.bottom+'px';tray.style.height=next.height+'px';
   local.setAttribute('viewBox',`0 0 ${next.width} ${next.height}`);fill.setAttribute('d',shape.closed);outline.setAttribute('d',shape.d);clip.setAttribute('d',shape.closed);
   local.style.setProperty('--dock-line-width',next.line+'px');panel.style.setProperty('--nora-curve-x',shape.rx+'px');panel.style.setProperty('--nora-curve-y',shape.ry+'px');scrim.style.bottom=next.bottom+'px';
  }
  function stopPlayers(){
   cancelPreparation();
   const current=movement,shadow=shade;movement=shade=null;
   // All finished promises have rejection handlers before cancellation.
   current?.cancel();shadow?.cancel();panel.style.willChange='';scrim.style.willChange='';
  }
  function complete(to){
   position=to;panel.style.transform=to?'translate3d(0,0,0)':'translate3d(0,100%,0)';scrim.style.opacity=String(to*.12);stopPlayers();
   tray.dataset.motion=to?'open':'closed';tray.dataset.motionProgress=String(to);content.inert=to!==1;
   if(waiter){const done=waiter;waiter=null;done.resolve(true);settled?.(to===1);}
  }
  function players(){
   if(movement)return;
   const options={duration,easing:'cubic-bezier(.22,.8,.25,1)',fill:'both'};
   movement=panel.animate([{transform:'translate3d(0,100%,0)'},{transform:'translate3d(0,0,0)'}],options);
   shade=scrim.animate([{opacity:0},{opacity:.12}],options);
   for(const animation of [movement,shade]){animation.pause();animation.currentTime=position*duration;animation.finished.catch(()=>{});}
  }
  function startPlayers(to,ticket,sharedStart=false){
   if(!active||ticket!==generation||!movement)return;preparing=false;
   for(const animation of [movement,shade]){if(typeof animation.updatePlaybackRate==='function')animation.updatePlaybackRate(to?1:-1);else animation.playbackRate=to?1:-1;animation.play();animation.finished.catch(()=>{});}
   // Both freshly prepared layers start at zero on the same timeline. A
   // reversal keeps its existing playhead and must never use this reset.
   const start=document.timeline?.currentTime;if(sharedStart&&Number.isFinite(start))for(const animation of [movement,shade])animation.startTime=start;
   const current=movement;
   current.finished.then(()=>{if(active&&ticket===generation&&current===movement)complete(to);}).catch(()=>{});
  }
  function prepareOpening(ticket){
   preparing=true;const current=movement;
   // Materializing the dialog, SVG and controls must not consume the300ms
   // slide. Let the paused layers commit before their timeline starts.
   Promise.all([movement.ready,shade.ready]).then(()=>{
    if(!active||ticket!==generation||current!==movement)return;
    preparationFrame=requestAnimationFrame(()=>{
     preparationFrame=requestAnimationFrame(()=>{preparationFrame=0;startPlayers(1,ticket,true);});
    });
   }).catch(error=>{if(active&&ticket===generation&&current===movement){const failed=waiter;waiter=null;stopPlayers();failed?.reject(error);}});
  }
  function animate(to,immediate=false){
   const wasPreparing=preparing;cancelPreparation();cancelWaiter();const ticket=++generation;goal=to;
   if(!active){active=true;geometryDirty=true;scrim.hidden=false;document.body.classList.add('mouse-dock-active');sync();}
   const result=new Promise((resolve,reject)=>{waiter={resolve,reject};});
   if(immediate||reduced.matches||typeof panel.animate!=='function'||(!movement&&position===to)||(wasPreparing&&to===0)){complete(to);return result;}
   content.inert=true;panel.style.willChange='transform';scrim.style.willChange='opacity';const fresh=!movement;players();
   tray.dataset.motion=to?'opening':'closing';tray.dataset.motionProgress=String(progress());
   if(to===1&&(wasPreparing||fresh&&position===0))prepareOpening(ticket);else startPlayers(to,ticket);
   return result;
  }
  function release(){
   generation++;cancelWaiter();position=goal=0;active=false;stopPlayers();
   scrim.hidden=true;scrim.style.opacity='0';document.body.classList.remove('mouse-dock-active');content.inert=true;panel.style.transform='translate3d(0,100%,0)';tray.dataset.motion='closed';tray.dataset.motionProgress='0';
  }
  // Content growth scrolls inside a constant viewport. Observe only geometry
  // inputs, not content height or transform frames; repeated sync() is a no-op.
  const observed=new WeakMap(),observer=new ResizeObserver(entries=>{
   let changed=false;for(const entry of entries){const size={width:entry.contentRect.width,height:entry.target===tray?0:entry.contentRect.height},old=observed.get(entry.target);observed.set(entry.target,size);if(!old||Math.abs(old.width-size.width)>.01||Math.abs(old.height-size.height)>.01)changed=true;}
   if(changed){geometryDirty=true;sync();}
  });
  observer.observe(footer);observer.observe(tray);if(toolbar)observer.observe(toolbar);
  window.addEventListener('resize',()=>{geometryDirty=true;sync();});
  reduced.addEventListener('change',()=>{if(active&&reduced.matches){generation++;complete(goal);}});
  content.inert=true;tray.dataset.motion='closed';tray.dataset.motionProgress='0';panel.style.transform='translate3d(0,100%,0)';
  return{open:()=>animate(1),close:({immediate=false}={})=>animate(0,immediate),sync,release,get active(){return active;},get isSettled(){return!movement;},get progress(){return progress();},get goal(){return goal;},sample(){if(!active||!geometry)return null;const value=progress();return{...geometry,kind:'slide',progress:value,translateY:geometry.height*(1-value),state:tray.dataset.motion,measurements,geometryWrites};}};
 };
})(globalThis);
