'use strict';
// The two temporary shell surfaces move together on the compositor. Native
// pages retain their identities and viewports; no layout IPC runs per frame.
(function(root){
 const DURATION=330,MAX_FRAME_PIXELS=16*1024*1024;
 const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 const box=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
 const same=(a,b)=>a&&b&&['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<=1);
 const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 function presented(){
  if(!root.requestAnimationFrame)return Promise.resolve(true);
  return new Promise(resolve=>{let frame,timer,done=false;const finish=painted=>{if(done)return;done=true;root.clearTimeout(timer);root.cancelAnimationFrame?.(frame);resolve(painted);};frame=root.requestAnimationFrame(()=>{frame=root.requestAnimationFrame(()=>finish(true));});timer=root.setTimeout(()=>finish(false),120);});
 }
 function placements(workspace,model){
  const tabs=new Map((model.state?.tabs||[]).map(t=>[t.id,t])),list=[],area=box(workspace.getBoundingClientRect());
  for(const pane of workspace.querySelectorAll('.pane')){
   const id=model.slots?.[pane.dataset.pane],tab=tabs.get(id),slot=pane.querySelector('.page-slot');
   if(!tab||tab.internal||!slot)continue;const bounds=box(slot.getBoundingClientRect());
   if(bounds.width>1&&bounds.height>1&&intersects(area,bounds))list.push({id,slot,bounds});
  }
  const ai=workspace.querySelector('#ai-slot'),tab=tabs.get(model.aiId);
  if(ai&&tab&&!tab.internal&&model.aiOpen&&(!model.agentOpen||model.privateMode)&&!model.focusPane&&!model.libraryOpen){const bounds=box(ai.getBoundingClientRect());if(bounds.width>1&&bounds.height>1&&intersects(area,bounds))list.push({id:tab.id,slot:ai,bounds});}
  return list;
 }
 function createScene(workspace,model,direction){
  const document=workspace.ownerDocument,area=box(workspace.getBoundingClientRect()),sign=direction<0?-1:1;
  const overlay=document.createElement('div');overlay.id='mouse-desktop-transition';overlay.setAttribute('aria-hidden','true');overlay.inert=true;
  Object.assign(overlay.style,{position:'fixed',left:area.x+'px',top:area.y+'px',width:area.width+'px',height:area.height+'px',overflow:'hidden',pointerEvents:'none',zIndex:'1000',visibility:'hidden',contain:'layout paint',background:'var(--bg)'});
  // Isolate clone IDs/classes from live querySelectorAll, editor mounting and
  // layout observers. Existing local CSS is reused without network requests.
  const shadow=overlay.attachShadow({mode:'open'}),style=document.createElement('style');
  style.textContent=Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules,rule=>rule.cssText);}catch{return[];}}).join('\n')+'\n#workspace[data-transition-frame]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;visibility:visible!important;will-change:transform;pointer-events:none!important;background:var(--bg);transform-origin:0 0;}';
  shadow.append(style);const frames={},animations=[];let cancelled=false,animationStartedAt=0,animationEndedAt=0;
  function valid(){return !cancelled&&same(area,box(workspace.getBoundingClientRect()));}
  async function stage(kind,packet){
   const items=placements(workspace,model),images=new Map((packet.surfaces||[]).map(s=>[s.id,s]));
   if(!valid()||!packet.complete||packet.desk!==model.desktopId||items.length!==images.size||items.some(p=>!images.has(p.id)||!same(p.bounds,images.get(p.id).bounds)))return false;
   const clone=workspace.cloneNode(true),sources=[workspace,...workspace.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')],mapping=new Map(sources.map((node,i)=>[node,copies[i]]));let pixels=0;
   clone.dataset.transitionFrame=kind;delete clone.dataset.sliding;clone.inert=true;clone.removeAttribute('aria-label');clone.style.transform='translate3d('+(kind==='outgoing'?0:sign*area.width)+'px,0,0)';
   for(let i=0;i<sources.length;i++){
    const source=sources[i],copy=copies[i];
    if(source.tagName==='INPUT'&&source.type!=='file'){copy.value=source.value;copy.checked=source.checked;}
    if(source.tagName==='TEXTAREA'||source.tagName==='SELECT')copy.value=source.value;
    if(source.tagName==='CANVAS'&&intersects(area,box(source.getBoundingClientRect()))){pixels+=source.width*source.height;if(pixels>MAX_FRAME_PIXELS)return false;copy.width=source.width;copy.height=source.height;copy.getContext('2d')?.drawImage(source,0,0);}
   }
   const decoding=[];
   for(const p of items){
    const capture=images.get(p.id),slot=mapping.get(p.slot),img=document.createElement('img');img.dataset.surface=p.id;img.alt='';img.draggable=false;img.src=capture.src;
    Object.assign(img.style,{position:'absolute',inset:'0',display:'block',width:'100%',height:'100%',maxWidth:'none',objectFit:'fill'});slot.replaceChildren(img);decoding.push(img.decode());
   }
   await Promise.all(decoding);if(!valid())return false;
   // Attributes on the shell root supply the same theme selectors within the
   // isolated shadow tree; custom properties inherit from the live document.
   const theme=document.documentElement.dataset.theme;if(theme)clone.dataset.theme=theme;
   shadow.append(clone);if(!overlay.isConnected)document.body.append(overlay);
   for(let i=0;i<sources.length;i++){copies[i].scrollTop=sources[i].scrollTop;copies[i].scrollLeft=sources[i].scrollLeft;}
   frames[kind]=clone;return true;
  }
  return{overlay,area,valid,ids:()=>placements(workspace,model).map(p=>p.id),stage,
   show(){overlay.style.visibility='visible';},
   async animate(){
    if(!valid()||!frames.outgoing||!frames.incoming)return false;
    const options={duration:DURATION,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'};
    animationStartedAt=root.performance.now();overlay.dataset.phase='animating';
    animations.push(frames.outgoing.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-sign*area.width)+'px,0,0)'}],options),frames.incoming.animate([{transform:'translate3d('+(sign*area.width)+'px,0,0)'},{transform:'translate3d(0,0,0)'}],options));
    // Explicitly share the document timeline start: IPC latency never extends
    // this interval or inserts an empty exit/change/entry phase.
    const start=document.timeline.currentTime;if(start!==null)for(const animation of animations)animation.startTime=start;
    await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));animationEndedAt=root.performance.now();overlay.dataset.phase='finished';return valid();
   },
   cancel(){cancelled=true;for(const animation of animations)animation.cancel();},
   remove(){for(const animation of animations)animation.cancel();overlay.remove();frames.outgoing=frames.incoming=null;},
   timing:()=>({animationStartedAt,animationEndedAt,animationDurationMs:animationEndedAt?animationEndedAt-animationStartedAt:0})
  };
 }
 async function run({workspace,model,layout,change,direction=1,N,sceneFactory=createScene}){
  if(root.matchMedia?.('(prefers-reduced-motion:reduce)').matches||!N?.desktops){await change();await layout();return;}
  const previousVisibility=workspace.style.visibility,wasInert=workspace.inert,startedAt=root.performance.now();
  model.desktopSliding=true;workspace.dataset.sliding='true';workspace.inert=true;
  let scene,hold='',changed=false,cancelled=false,stopCleared;const cancel=()=>{cancelled=true;scene?.cancel();};
  const result={direction:direction<0?-1:1,animated:false,decoded:false,layoutCalls:0,startedAt};
  const changeOnce=async()=>{if(changed)return;changed=true;await change();};
  root.addEventListener?.('resize',cancel);root.addEventListener?.('pagehide',cancel);stopCleared=N.onPreviewsCleared?.(cancel);
  try{
   let ready=false;
   try{scene=sceneFactory(workspace,model,direction);const old=await N.desktops('surfaces',{ids:scene.ids()});ready=!cancelled&&await scene.stage('outgoing',old);if(ready){scene.show();ready=await presented();if(ready&&!cancelled){const response=await N.desktops('surface-hold',{phase:'begin',token:old.token});if(response.held)hold=response.token;else ready=false;}}}catch{ready=false;}
   if(!ready||!hold||cancelled){await changeOnce();return;}
   workspace.style.visibility='hidden';await changeOnce();result.layoutCalls++;await layout();
   if(cancelled||!scene.valid())return;
   let incomingReady=false;try{const incoming=await N.desktops('surfaces',{ids:scene.ids(),hold});incomingReady=!cancelled&&await scene.stage('incoming',incoming);}catch{}
   if(!incomingReady)return;
   if(!await presented()||cancelled||!scene.valid())return;
   result.decoded=true;result.animated=await scene.animate();Object.assign(result,scene.timing());
  }finally{
   workspace.style.visibility=previousVisibility;
   try{if(hold){await N.desktops('surface-hold',{phase:'end',token:hold});await presented();}}
   finally{
    scene?.remove();root.removeEventListener?.('resize',cancel);root.removeEventListener?.('pagehide',cancel);if(typeof stopCleared==='function')stopCleared();
    workspace.inert=wasInert;delete workspace.dataset.sliding;model.desktopSliding=false;result.layoutCalls++;await layout();result.totalDurationMs=root.performance.now()-startedAt;
    if(N.test)api.last=result;
   }
  }
 }
 const api={run,ease,createScene,placements,DURATION};if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseDesktopSlide=api;
})(globalThis);
