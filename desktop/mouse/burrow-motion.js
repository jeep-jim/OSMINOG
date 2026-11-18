'use strict';
// One contour owns both the footer and its expanding menu. No dialog translation,
// independently composited glass, or overlapping outlines form the join.
(function(root){
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const ease=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
 const n=x=>Math.round(x*1000)/1000;
 function contour({width,height,progress=1}){
  const w=Math.max(1,Number(width)||1),h=Math.max(0,Number(height)||0),p=clamp(Number(progress)||0),cx=w/2;
  const base=mix(Math.min(36,w),w,Math.pow(p,1.65));
  const body=mix(Math.min(18,w),w*.928,Math.pow(p,.92));
  const left=cx-body/2,right=cx+body/2,start=cx-base/2,end=cx+base/2;
  const rx=Math.min(w*.076,body*.4,h*.8),ry=Math.min(64,h*.55),foot=Math.min(40,h*.35),k=.55228475;
  const d=`M${n(start)} ${n(h)}C${n(mix(start,left,.65))} ${n(h)} ${n(left)} ${n(h-foot*.39)} ${n(left)} ${n(h-foot)}V${n(ry)}C${n(left)} ${n(ry*(1-k))} ${n(left+rx*(1-k))} 0 ${n(left+rx)} 0H${n(right-rx)}C${n(right-rx*(1-k))} 0 ${n(right)} ${n(ry*(1-k))} ${n(right)} ${n(ry)}V${n(h-foot)}C${n(right)} ${n(h-foot*.39)} ${n(mix(end,right,.65))} ${n(h)} ${n(end)} ${n(h)}`;
  return{d,closed:d+'Z',width:w,height:h,start,end,left,right,rx,ry,foot,center:cx};
 }
 function surface({viewportWidth,viewportHeight,baseline,left,shape}){
  // The bump uses the very same coordinates as the content clipping path.
  // Footer coordinates use the same translated control points as the local clip.
  const x=left,y=baseline-shape.height,w=viewportWidth,h=viewportHeight;
  // Relative path conversion would change cubic coordinates; use a reusable
  // absolute translation of each numeric pair instead.
  const translated=shape.d.replace(/([MCVH])([^MCVH]*)/g,(_,command,args)=>{
   const values=args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
   return command+values.map((v,i)=>n(v+(command==='H'?x:command==='V'?y:i%2===0?x:y))).join(' ');
  });
  const top=`M0 ${n(baseline)}H${n(x+shape.start)}`+translated.replace(/^M[^C]*/, '')+`H${n(w)}`;
  return{outline:top,fill:top+`V${n(h)}H0Z`};
 }
 const api={contour,surface,ease};
 if(typeof module!=='undefined')module.exports=api;
 root.MouseBurrowGeometry=api;
 root.createMouseBurrowMotion=({tray,content,footer,button,settled})=>{
  const svgNS='http://www.w3.org/2000/svg',surfaceNode=document.createElementNS(svgNS,'svg');
  surfaceNode.id='mouse-dock-surface';surfaceNode.setAttribute('aria-hidden','true');surfaceNode.setAttribute('preserveAspectRatio','none');surfaceNode.setAttribute('hidden','');
  const fill=document.createElementNS(svgNS,'path'),outline=document.createElementNS(svgNS,'path');fill.id='mouse-dock-fill';outline.id='mouse-dock-outline';surfaceNode.append(fill,outline);
  const scrim=document.createElement('div');scrim.id='mouse-dock-scrim';scrim.hidden=true;scrim.setAttribute('aria-hidden','true');document.body.append(scrim,surfaceNode);
  const local=tray.querySelector('.desk-burrow-shape'),localPath=local.querySelector(':scope>path'),clip=local.querySelector('clipPath path');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let progress=0,height=0,targetHeight=0,goal=0,frame=0,progressTween=null,heightTween=null,last=null,waiter=null,active=false;
  const cancelWaiter=()=>{if(waiter){waiter.resolve(false);waiter=null;}};
  const tweenValue=(t,time)=>mix(t.from,t.to,ease(clamp((time-t.start)/t.duration)));
  function advance(time){
   if(progressTween){progress=tweenValue(progressTween,time);if(time>=progressTween.start+progressTween.duration){progress=progressTween.to;progressTween=null;}}
   if(heightTween){height=tweenValue(heightTween,time);if(time>=heightTween.start+heightTween.duration){height=heightTween.to;heightTween=null;}}
  }
  function measure(){
   const r=footer.getBoundingClientRect(),border=parseFloat(getComputedStyle(footer).borderTopWidth)||0,baseline=r.top+border/2;
   const top=document.querySelector('.toolbar')?.getBoundingClientRect().bottom||40,max=Math.max(80,baseline-top-12);
   content.style.maxHeight=max+'px';
   const next=Math.min(max,content.scrollHeight);
   return{baseline,width:tray.getBoundingClientRect().width,height:Math.max(1,next),viewportWidth:innerWidth,viewportHeight:innerHeight};
  }
  function paint(){
   if(!active)return;
   const m=measure(),shown=Math.max(0,height*progress),left=(m.viewportWidth-m.width)/2;
   tray.style.bottom=(m.viewportHeight-m.baseline)+'px';tray.style.height=shown+'px';
   const shape=contour({width:m.width,height:shown,progress}),paths=surface({...m,left,shape});
   local.setAttribute('viewBox',`0 0 ${m.width} ${Math.max(.001,shown)}`);localPath.setAttribute('d',shape.d);clip.setAttribute('d',shape.closed);
   surfaceNode.setAttribute('viewBox',`0 0 ${m.viewportWidth} ${m.viewportHeight}`);fill.setAttribute('d',paths.fill);outline.setAttribute('d',paths.outline);
   surfaceNode.style.setProperty('--dock-line-width',getComputedStyle(footer).borderTopWidth||'1px');
   scrim.style.bottom=(m.viewportHeight-m.baseline)+'px';scrim.style.opacity=String(progress*.12);
   content.style.opacity=String(clamp((progress-.24)/.62));
   tray.dataset.motionProgress=String(n(progress));
   tray.dataset.motion=progressTween?(goal?'opening':'closing'):heightTween?'resizing':goal?'open':'closed';
   content.inert=goal!==1||progress<1||!!progressTween;
   last={progress,height:shown,targetHeight,baseline:m.baseline,width:m.width,left,center:m.viewportWidth/2,shape,paths,state:tray.dataset.motion};
  }
  function complete(){
   if(progressTween||heightTween)return;
   if(waiter&&progress===goal){const done=waiter;waiter=null;done.resolve(true);settled?.(goal===1);}
  }
  function tick(time){frame=0;advance(time);paint();complete();if(progressTween||heightTween)frame=requestAnimationFrame(tick);}
  function schedule(){if(!frame)frame=requestAnimationFrame(tick);}
  function sync(){
   if(!active||tray.hidden)return;
   const time=performance.now();advance(time);const next=measure().height;
   if(Math.abs(next-targetHeight)>.25){targetHeight=next;if(!height||reduced.matches||progress===0){height=next;heightTween=null;}else heightTween={from:height,to:next,start:time,duration:300};}
   paint();if(progressTween||heightTween)schedule();
  }
  function animate(to,immediate=false){
   cancelWaiter();const time=performance.now();advance(time);goal=to;
   if(!active){active=true;surfaceNode.removeAttribute('hidden');scrim.hidden=false;document.body.classList.add('mouse-dock-active');}
   sync();
   const result=new Promise(resolve=>{waiter={resolve};});
   if(immediate||reduced.matches){progress=to;progressTween=null;height=targetHeight;heightTween=null;paint();complete();}
   else if(Math.abs(to-progress)<.0001){progress=to;progressTween=null;paint();complete();}
   else{progressTween={from:progress,to,start:time,duration:(to?640:500)*Math.max(.28,Math.sqrt(Math.abs(to-progress)))};paint();schedule();}
   return result;
  }
  function release(){
   cancelWaiter();if(frame)cancelAnimationFrame(frame);frame=0;progressTween=heightTween=null;progress=goal=0;active=false;last=null;
   surfaceNode.setAttribute('hidden','');scrim.hidden=true;document.body.classList.remove('mouse-dock-active');content.inert=true;content.style.opacity='0';tray.style.height='0px';tray.dataset.motion='closed';tray.dataset.motionProgress='0';
  }
  const observer=new ResizeObserver(()=>sync());observer.observe(content);observer.observe(footer);
  window.addEventListener('resize',sync);
  reduced.addEventListener('change',()=>{if(!active)return;if(reduced.matches){progress=goal;progressTween=null;height=targetHeight;heightTween=null;paint();complete();}else sync();});
  tray.dataset.motion='closed';tray.dataset.motionProgress='0';
  return{open:()=>animate(1),close:({immediate=false}={})=>animate(0,immediate),sync,release,get active(){return active;},get isSettled(){return!progressTween&&!heightTween;},get progress(){return progress;},get goal(){return goal;},sample:()=>last};
 };
})(globalThis);
