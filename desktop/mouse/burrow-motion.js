'use strict';
// Nora slides as one panel. Its resting height follows the actual content;
// opening/closing never scales the content or animates the silhouette.
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
 root.createMouseBurrowMotion=({tray,content,footer,button,settled,preparePaint,trace=false})=>{
  const local=tray.querySelector('.desk-burrow-shape'),outline=local.querySelector(':scope>path'),clip=local.querySelector('clipPath path');
  const panel=document.createElement('div');panel.className='desk-burrow-panel';
  local.id='mouse-dock-surface';outline.id='mouse-dock-outline';
  const fill=document.createElementNS('http://www.w3.org/2000/svg','path');fill.id='mouse-dock-fill';local.insertBefore(fill,outline);
  const glass=tray.querySelector('.desk-glass');panel.append(local);if(glass)panel.append(glass);panel.append(content);tray.append(panel);
  const scrim=document.createElement('div');scrim.id='mouse-dock-scrim';scrim.hidden=true;scrim.setAttribute('aria-hidden','true');document.body.append(scrim);
  const toolbar=document.querySelector('.toolbar'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),duration=300,backdropOpacity=.24;
  let active=false,goal=0,position=0,movement=null,shade=null,waiter=null,generation=0,geometry=null,geometryDirty=true,measurements=0,geometryWrites=0,preparing=false,preparationFrame=0,parked=false;
  let readyObservation=null;
  const events=[],animationTime=animation=>animation?{currentTime:animation.currentTime,startTime:animation.startTime,pending:animation.pending===true,playState:animation.playState,playbackRate:animation.playbackRate}:null;
  const timing=()=>({performanceNow:performance.now(),documentTime:document.timeline?.currentTime??null,generation,goal,preparing,phase:tray.dataset.motion,movement:animationTime(movement),shade:animationTime(shade)});
  const note=(event,extra={})=>{if(!trace)return;events.push({event,...timing(),...extra});if(events.length>32)events.shift();};
  const cancelReadyObservation=()=>{const old=readyObservation;readyObservation=null;if(old?.frame)cancelAnimationFrame(old.frame);};
  function observeReady(ticket){
   cancelReadyObservation();
   const observation={ticket,movement,shade,frame:0};readyObservation=observation;
   const current=()=>readyObservation===observation&&active&&ticket===generation&&observation.movement===movement&&observation.shade===shade;
   Promise.all([observation.movement.ready,observation.shade.ready]).then(()=>{
    if(!current())return;
    // Preserve the raw promise-resolution snapshot, including any endpoint
    // overshoot. The first RAF can still share that document timestamp.
    note('play-ready-resolved');
    observation.frame=requestAnimationFrame(rafTime=>{
     if(!current())return;observation.frame=0;
     note('play-ready-frame-1',{rafTime});
     observation.frame=requestAnimationFrame(rafTime=>{
      if(!current())return;observation.frame=0;readyObservation=null;
      // Always sample the fixed second frame. No range filter, retry, seek or
      // rounding: invalid/finished values remain invalid for the verifier.
      note('play-ready',{rafTime});
     });
    });
   }).catch(()=>{});
  }
  const cancelWaiter=()=>{if(waiter){waiter.resolve(false);waiter=null;}};
  const cancelPreparation=()=>{preparing=false;if(preparationFrame)cancelAnimationFrame(preparationFrame);preparationFrame=0;};
  const progress=()=>{if(!movement)return position;const value=movement.effect.getComputedTiming().progress;if(value!==null&&value!==undefined)return clamp(value);const time=Number(movement.currentTime);return time>=duration?1:time<=0?0:position;};
  function measure(){
   measurements++;
   const r=footer.getBoundingClientRect(),line=parseFloat(getComputedStyle(footer).borderTopWidth)||0,baseline=r.top,top=toolbar?.getBoundingClientRect().bottom||40;
   const width=Math.max(1,tray.getBoundingClientRect().width),availableHeight=Math.max(1,baseline-top-12);
   const contentHeight=Math.max(1,Math.ceil(content.getBoundingClientRect().height));
   const height=Math.min(contentHeight,availableHeight);
   return{width,height,targetHeight:height,contentHeight,availableHeight,fits:contentHeight<=availableHeight,baseline,left:(innerWidth-width)/2,center:innerWidth/2,bottom:innerHeight-baseline,viewportWidth:innerWidth,viewportHeight:innerHeight,line};
  }
  function sync(){
   if(!active||tray.hidden||!geometryDirty)return;
   geometryDirty=false;const next=measure();
   if(geometry&&['width','height','baseline','left','bottom','line'].every(key=>Math.abs(geometry[key]-next[key])<.01)){geometry={...geometry,...next};return;}
   const shape=contour({width:next.width,height:next.height});
   geometry={...next,shape,paths:{outline:shape.d,fill:shape.closed}};geometryWrites++;
   tray.style.bottom=next.bottom+'px';tray.style.height=next.height+'px';
   local.setAttribute('viewBox',`0 0 ${next.width} ${next.height}`);fill.setAttribute('d',shape.closed);outline.setAttribute('d',shape.d);clip.setAttribute('d',shape.closed);
   local.style.setProperty('--dock-line-width',next.line+'px');panel.style.setProperty('--nora-curve-x',shape.rx+'px');panel.style.setProperty('--nora-curve-y',shape.ry+'px');scrim.style.bottom=next.bottom+'px';
  }
  function stopPlayers(keepLayers=false){
   if(trace)cancelReadyObservation();
   cancelPreparation();parked=false;
   const current=movement,shadow=shade;movement=shade=null;
   // All finished promises have rejection handlers before cancellation.
   current?.cancel();shadow?.cancel();
   if(!keepLayers){panel.style.willChange='';scrim.style.willChange='';}
  }
  function complete(to,retainOpen=false){
   if(trace)cancelReadyObservation();
   note('complete',{to});
   position=to;panel.style.transform=to?'translate3d(0,0,0)':'translate3d(0,100%,0)';scrim.style.opacity=String(to*backdropOpacity);
   if(to===1&&retainOpen&&!reduced.matches&&movement&&shade){
    if(!parked){
     cancelPreparation();
     // Keep the visible layers and their players throughout the open state. Chromium
     // caches effect phase by time/idle state, so changing rate at exactly300ms
     // alone can leave the finished forward effect non-current. Reapplying its
     // identical keyframes invalidates that cache at rest, without changing
     // timing, easing, pixels or player identity.
     for(const animation of [movement,shade]){animation.pause();animation.playbackRate=-1;animation.currentTime=duration;animation.effect.setKeyframes(animation.effect.getKeyframes());animation.finished.catch(()=>{});}
     parked=true;note('park-open');
    }
   }else stopPlayers();
   tray.dataset.motion=to?'open':'closed';tray.dataset.motionProgress=String(to);content.inert=to!==1;
   if(waiter){const done=waiter;waiter=null;done.resolve(true);settled?.(to===1);}
  }
  function players(to){
   if(movement)return;
   const options={duration,easing:'cubic-bezier(.22,.8,.25,1)',fill:'both'};
   movement=panel.animate([{transform:'translate3d(0,100%,0)'},{transform:'translate3d(0,0,0)'}],options);
   shade=scrim.animate([{opacity:0},{opacity:backdropOpacity}],options);
   // Establish direction before the first endpoint timing calculation. At the
   // end boundary a forward effect is after/non-current even with fill:both;
   // changing only its rate later can leave that cached phase non-compositable.
   for(const animation of [movement,shade]){animation.pause();animation.playbackRate=to?1:-1;animation.currentTime=position*duration;animation.finished.catch(()=>{});}
   note('players-paused');
  }
  function startPlayers(to,ticket){
   if(!active||ticket!==generation||!movement)return;preparing=false;parked=false;
   note('play-request',{to});
   for(const animation of [movement,shade]){if(typeof animation.updatePlaybackRate==='function')animation.updatePlaybackRate(to?1:-1);else animation.playbackRate=to?1:-1;animation.play();animation.finished.catch(()=>{});}
   // Keep the browser's pending play/start time. The document timeline can
   // still describe an old frame after expensive rendering; forcing it into
   // startTime would consume that delay from the animation immediately.
   const current=movement;
   if(trace){note('play-pending');observeReady(ticket);}
   current.finished.then(()=>{if(active&&ticket===generation&&current===movement)complete(to,to===1);}).catch(()=>{});
  }
  function preparePlayers(to,ticket){
   preparing=true;const current=movement;
   const failed=error=>{if(active&&ticket===generation&&current===movement){const pending=waiter;waiter=null;stopPlayers();pending?.reject(error);}};
   const playWhenPainted=()=>{
    if(!active||ticket!==generation||current!==movement)return;
    if(to!==1||typeof preparePaint!=='function'){startPlayers(to,ticket);return;}
    // A new modal and its native-page snapshots can already have two RAFs
    // while their GPU render pass is still pending. Keep the real players at
    // time zero until a bounded native readback proves those exact surfaces.
    note('paint-await');
    Promise.resolve().then(preparePaint).then(ready=>{
     if(!active||ticket!==generation||current!==movement)return;
     if(ready!==true)throw Error('Рабочий стол ещё не отрисован. Повторите открытие.');
     note('paint-ready');startPlayers(to,ticket);
    }).catch(failed);
   };
   note('prepare-await-ready',{to});
   // Fresh opening and closing players commit paused layers before starting
   // the300ms timeline. A live reversal keeps its players and never repeats
   // this preparation.
   Promise.all([movement.ready,shade.ready]).then(()=>{
    if(!active||ticket!==generation||current!==movement)return;
    note('pause-ready',{to});preparationFrame=requestAnimationFrame(rafTime=>{
     note('preparation-frame-1',{rafTime,to});preparationFrame=requestAnimationFrame(rafTime=>{preparationFrame=0;note('preparation-frame-2',{rafTime,to});playWhenPainted();});
    });
   }).catch(failed);
  }
  function animate(to,immediate=false){
   const wasPreparing=preparing,atEndpoint=!!movement&&Number(movement.currentTime)===to*duration;cancelPreparation();cancelWaiter();const ticket=++generation;goal=to;
   if(trace)cancelReadyObservation();
   // Retain the current open effects until an actual close, then retire them
   // without dropping the visible layers or their inline endpoint. Closing
   // gets a fresh reverse pair and its full paused-readiness preparation.
   if(to===0&&parked&&!immediate&&!reduced.matches)stopPlayers(true);
   note('request',{to,immediate});
   if(!active){active=true;geometryDirty=true;scrim.hidden=false;document.body.classList.add('mouse-dock-active');sync();}
   const result=new Promise((resolve,reject)=>{waiter={resolve,reject};});
   if(immediate||reduced.matches||typeof panel.animate!=='function'||atEndpoint||(!movement&&position===to)||(wasPreparing&&position===to)){complete(to,!immediate&&!reduced.matches&&to===1&&(parked||!wasPreparing&&atEndpoint));return result;}
   content.inert=true;panel.style.willChange='transform';scrim.style.willChange='opacity';const fresh=!movement;players(to);
   tray.dataset.motion=to?'opening':'closing';tray.dataset.motionProgress=String(progress());
   if(fresh||wasPreparing)preparePlayers(to,ticket);else startPlayers(to,ticket);
   return result;
  }
  function release(){
   note('release');
   generation++;cancelWaiter();position=goal=0;active=false;stopPlayers();
   scrim.hidden=true;scrim.style.opacity='0';document.body.classList.remove('mouse-dock-active');content.inert=true;panel.style.transform='translate3d(0,100%,0)';tray.dataset.motion='closed';tray.dataset.motionProgress='0';
  }
  // Modes, preview, history and the first-use hint grow the panel upward.
  // Observe intrinsic content size, never the translating panel's position.
  const observed=new WeakMap(),observer=new ResizeObserver(entries=>{
   let changed=false;for(const entry of entries){const size={width:entry.contentRect.width,height:entry.target===tray?0:entry.contentRect.height},old=observed.get(entry.target);observed.set(entry.target,size);if(!old||Math.abs(old.width-size.width)>.01||Math.abs(old.height-size.height)>.01)changed=true;}
   if(changed){geometryDirty=true;sync();}
  });
  observer.observe(content);observer.observe(footer);observer.observe(tray);if(toolbar)observer.observe(toolbar);
  window.addEventListener('resize',()=>{geometryDirty=true;sync();});
  reduced.addEventListener('change',()=>{if(active&&reduced.matches){generation++;complete(goal);}});
  content.inert=true;tray.dataset.motion='closed';tray.dataset.motionProgress='0';panel.style.transform='translate3d(0,100%,0)';
  return{open:()=>animate(1),close:({immediate=false}={})=>animate(0,immediate),sync,release,diagnostics:()=>trace?{enabled:true,events:events.slice(),current:timing()}:{enabled:false,events:[]},get active(){return active;},get isSettled(){return!waiter&&!preparing;},get progress(){return progress();},get goal(){return goal;},sample(){if(!active||!geometry)return null;const value=progress();return{...geometry,kind:'slide',progress:value,translateY:geometry.height*(1-value),state:tray.dataset.motion,measurements,geometryWrites};}};
 };
})(globalThis);
