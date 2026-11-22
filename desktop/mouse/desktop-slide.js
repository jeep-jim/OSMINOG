'use strict';
// Ordinary switches select the existing live views immediately. Pixel-backed
// transitions are reserved for an already open Nora, which owns a native hold.
(function(root){
 const DURATION=330,MAX_FRAME_PIXELS=16*1024*1024;
 const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 const box=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
 const same=(a,b)=>a&&b&&['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<=1);
 const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 function presented(valid=()=>true){
  if(!root.requestAnimationFrame)return Promise.resolve(true);
  // Rendering a large workspace can legitimately take longer than 120 ms.
  // A missed short deadline must never silently replace a requested slide by
  // an instantaneous desktop change. The caller aborts preparation instead.
  return new Promise(resolve=>{let frame,timer,done=false;const finish=painted=>{if(done)return;done=true;root.clearTimeout(timer);root.cancelAnimationFrame?.(frame);resolve(painted&&valid());};frame=root.requestAnimationFrame(()=>{if(!valid())return finish(false);frame=root.requestAnimationFrame(()=>finish(true));});timer=root.setTimeout(()=>finish(false),1500);});
 }
 function placements(workspace,model){
  const tabs=new Map((model.state?.tabs||[]).map(t=>[t.id,t])),list=[],area=box(workspace.getBoundingClientRect());
  for(const pane of workspace.querySelectorAll('.pane')){
   const id=model.slots?.[pane.dataset.pane],tab=tabs.get(id),slot=pane.querySelector('.page-slot');
   if(!tab||tab.internal||!slot)continue;const bounds=box(slot.getBoundingClientRect());
   if(bounds.width>1&&bounds.height>1&&intersects(area,bounds))list.push({id,slot,bounds});
  }
  const ai=workspace.querySelector('#ai-slot'),tab=tabs.get(model.aiId);
  if(ai&&tab&&!tab.internal&&model.aiOpen&&!model.focusPane&&!model.libraryOpen){const bounds=box(ai.getBoundingClientRect());if(bounds.width>1&&bounds.height>1&&intersects(area,bounds))list.push({id:tab.id,slot:ai,bounds});}
  return list;
 }
 function createScene(workspace,model,direction,{borrowedHold=false}={}){
  const document=workspace.ownerDocument,area=box(workspace.getBoundingClientRect()),sign=direction<0?-1:1;
  const overlay=document.createElement('div');overlay.id='mouse-desktop-transition';overlay.setAttribute('aria-hidden','true');overlay.inert=true;
  Object.assign(overlay.style,{position:'fixed',left:area.x+'px',top:area.y+'px',width:area.width+'px',height:area.height+'px',overflow:'hidden',pointerEvents:'none',zIndex:borrowedHold?'850':'1000',visibility:'hidden',contain:'layout paint',background:'var(--bg)'});
  // Isolate clone IDs/classes from live querySelectorAll, editor mounting and
  // layout observers. Existing local CSS is reused without network requests.
  const shadow=overlay.attachShadow({mode:'open'}),style=document.createElement('style');
  style.textContent=Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules,rule=>rule.cssText);}catch{return[];}}).join('\n').replace(/:root\b/g,'[data-transition-root]')+'\n#workspace[data-transition-frame]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;visibility:visible!important;will-change:transform;pointer-events:none!important;background:var(--bg);transform-origin:0 0;}';
  // Each desktop owns its own root/body selectors. The incoming desk can
  // change focused-pane/AI/sidebar state while the outgoing image is moving.
  // Sharing the outgoing body class could hide the incoming stage entirely.
  shadow.append(style);const frames={},animations=[];let cancelled=false,animationStartedAt=0,animationEndedAt=0;
  function valid(){return !cancelled&&same(area,box(workspace.getBoundingClientRect()));}
  async function stage(kind,packet){
   const items=placements(workspace,model),images=new Map((packet.surfaces||[]).map(s=>[s.id,s]));
   if(!valid()||!packet.complete||packet.desk!==model.desktopId||items.length!==images.size||items.some(p=>!images.has(p.id)||!same(p.bounds,images.get(p.id).bounds)))return false;
   const clone=workspace.cloneNode(true),sources=[workspace,...workspace.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')],mapping=new Map(sources.map((node,i)=>[node,copies[i]]));let pixels=0;
   const html=document.createElement('html'),body=document.createElement('body');
   for(const [source,target]of [[document.documentElement,html],[document.body,body]]){for(const attribute of source.attributes)if(attribute.name!=='id')target.setAttribute(attribute.name,attribute.value);target.style.setProperty('display','contents','important');}
   html.dataset.transitionRoot='true';html.append(body);
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
   body.append(clone);shadow.append(html);if(!overlay.isConnected)document.body.append(overlay);
   for(let i=0;i<sources.length;i++){copies[i].scrollTop=sources[i].scrollTop;copies[i].scrollLeft=sources[i].scrollLeft;}
   frames[kind]=clone;return true;
  }
  return{overlay,area,valid,ids:()=>placements(workspace,model).map(p=>p.id),stage,
   show(){overlay.style.visibility='visible';},
   async animate(){
    if(!valid()||!frames.outgoing||!frames.incoming)return false;
    const options={duration:DURATION,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'};
    animations.push(frames.outgoing.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-sign*area.width)+'px,0,0)'}],options),frames.incoming.animate([{transform:'translate3d('+(sign*area.width)+'px,0,0)'},{transform:'translate3d(0,0,0)'}],options));
    // Commit both paused layers first. Capture/decode/layer preparation must
    // not consume the timeline before the first moving frame is presented.
    for(const animation of animations){animation.pause();animation.currentTime=0;animation.finished.catch(()=>{});}
    overlay.dataset.phase='preparing';
    try{await Promise.all(animations.map(animation=>animation.ready));}catch{return false;}
    if(!valid()||!await presented(valid))return false;
    animationStartedAt=root.performance.now();overlay.dataset.phase='animating';
    for(const animation of animations){animation.play();animation.finished.catch(()=>{});}
    const finished=Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
    try{await Promise.all(animations.map(animation=>animation.ready));}catch{return false;}
    if(!valid())return false;
    // Both browser play operations are now ready. Their actual starts may
    // differ by a compositor frame; use the outgoing player's real start to
    // keep the two surfaces adjacent, never an earlier document/wall clock.
    const start=animations[0].startTime;
    if(Number.isFinite(start)&&animations[1].startTime!==start)animations[1].startTime=start;
    await finished;animationEndedAt=root.performance.now();overlay.dataset.phase='finished';return valid();
   },
   cancel(){cancelled=true;for(const animation of animations)animation.cancel();},
   remove(){for(const animation of animations)animation.cancel();overlay.remove();frames.outgoing=frames.incoming=null;},
   timing:()=>({animationStartedAt,animationEndedAt,animationDurationMs:animationEndedAt?animationEndedAt-animationStartedAt:0})
  };
 }
 async function live({workspace,model,layout,change,direction=1,N,present=presented}){
  const startedAt=root.performance.now(),wasInert=workspace.inert;
  const result={strategy:'live',direction:direction<0?-1:1,animated:false,decoded:false,borrowedHold:false,snapshotCaptures:0,layoutCalls:0,startedAt,phase:'changing'};
  model.desktopSliding=true;workspace.dataset.sliding='true';workspace.inert=true;
  try{
   // Do not capture, clone, hide or wait for outgoing website pixels. Native
   // pages keep their process, viewport, forms, audio and outstanding requests.
   await change();result.selectedAt=root.performance.now();
   result.layoutCalls++;await layout();result.layoutAt=root.performance.now();
   result.phase='presenting';result.presented=await present(()=>true);
   if(!result.presented)throw Error('Не удалось отрисовать выбранный рабочий стол.');
   result.phase='complete';return result;
  }catch(error){result.phase='failed';result.error=String(error?.message||error);throw error;
  }finally{
   workspace.inert=wasInert;delete workspace.dataset.sliding;model.desktopSliding=false;
   result.totalDurationMs=root.performance.now()-startedAt;if(N?.test)api.last=result;
  }
 }
 async function run({workspace,model,layout,change,direction=1,N,lease=null,sceneFactory=createScene,present=presented}){
  if(!lease)return live({workspace,model,layout,change,direction,N,present});
  const reduced=!!root.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
  if(!N?.desktops||reduced&&!lease){await change();await layout();return;}
  if(lease&&(!lease.token||!lease.outgoing||typeof lease.valid!=='function'||typeof lease.replace!=='function'||typeof lease.abort!=='function'))throw Error('Invalid desktop backdrop lease');
  const previousVisibility=workspace.style.visibility,wasInert=workspace.inert,startedAt=root.performance.now();
  model.desktopSliding=true;workspace.dataset.sliding='true';workspace.inert=true;
  let scene,hold=lease?.token||'',changed=false,cancelled=false,committed=false,stopCleared;
  const cancel=()=>{cancelled=true;scene?.cancel();},current=()=>!cancelled&&(!lease||lease.valid());
  const result={strategy:'nora-snapshot',direction:direction<0?-1:1,animated:false,decoded:false,layoutCalls:0,startedAt,borrowedHold:!!lease,reducedMotion:reduced,phase:'preparing-outgoing'};
  const changeOnce=async()=>{if(changed)return;changed=true;await change();};
  root.addEventListener?.('resize',cancel);root.addEventListener?.('pagehide',cancel);stopCleared=N.onPreviewsCleared?.(cancel);
  try{
   scene=sceneFactory(workspace,model,direction,{borrowedHold:!!lease});
   const old=lease?lease.outgoing:await N.desktops('surfaces',{ids:scene.ids(),paintProof:false});
   if(!current()||!await scene.stage('outgoing',old))throw Error('Не удалось подготовить переход. Рабочий стол сохранён.');
   scene.show();if(!await present(current))throw Error('Переход ещё не готов. Повторите переключение.');
   if(!lease){const response=await N.desktops('surface-hold',{phase:'begin',token:old.token});if(!response.held)throw Error('Рабочий стол изменился во время подготовки.');hold=response.token;}
   if(!current())return result;
   result.phase='changing';
   workspace.style.visibility='hidden';await changeOnce();result.layoutCalls++;await layout();
   if(!current()||!scene.valid())return result;
   result.phase='preparing-incoming';const incoming=await N.desktops('surfaces',{ids:scene.ids(),hold,paintProof:!!lease});
   if(!current()||!await scene.stage('incoming',incoming))throw Error('Не удалось подготовить изображение выбранного стола.');
   if(!await present(current)||!scene.valid())throw Error('Изображение выбранного стола ещё не готово.');
   result.decoded=true;result.phase='animating';result.animated=!reduced&&await scene.animate();Object.assign(result,scene.timing());
   if(!current()||!scene.valid())return result;
   if(!reduced&&!result.animated)throw Error('Переход рабочего стола был прерван.');
   result.phase='committing';
   if(lease&&!await lease.replace(incoming))throw Error('Фон Норы изменился во время переключения.');
   committed=true;result.phase='complete';return result;
  }catch(error){result.error=String(error?.message||error);result.phase='failed';throw error;
  }finally{
   workspace.style.visibility=previousVisibility;
   try{
    if(lease){if(changed&&!committed)await lease.abort();else if(committed)await present(current);}
    else if(hold){await N.desktops('surface-hold',{phase:'end',token:hold});await present(()=>true);}
   }
   finally{
    scene?.remove();root.removeEventListener?.('resize',cancel);root.removeEventListener?.('pagehide',cancel);if(typeof stopCleared==='function')stopCleared();
    workspace.inert=wasInert;delete workspace.dataset.sliding;model.desktopSliding=false;result.layoutCalls++;await layout();result.totalDurationMs=root.performance.now()-startedAt;
    if(N.test)api.last=result;
   }
  }
 }
 const api={run,ease,createScene,placements,presented,DURATION};if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseDesktopSlide=api;
})(globalThis);
