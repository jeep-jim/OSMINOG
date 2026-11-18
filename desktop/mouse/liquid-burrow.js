'use strict';
// The footer is the fixed origin. Only the shared surface contour changes;
// the menu is never translated from an off-screen rectangular card.
(function(root){
 const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
 const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 const n=x=>Math.round(x*1000)/1000;
 function geometry({width,height,referenceHeight,progress=1}){
  const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),p=clamp(progress),ref=Math.max(1,Number(referenceHeight)||h),centre=w/2;
  const spread=smooth(p),lift=smooth(Math.min(1,p*1.65)),visible=h*lift;
  const baseWidth=Math.min(w,36)+(w-Math.min(w,36))*Math.pow(spread,1.7);
  const bodyWidth=Math.min(w*.928,24)+(w*.928-Math.min(w*.928,24))*Math.pow(spread,1.3);
  const left=(w-baseWidth)/2,right=w-left,body=centre-bodyWidth/2,top=h-visible;
  const rx=Math.min(w*.076,bodyWidth*.44),ry=Math.min(ref*.18,visible*.48),shoulder=ry*7/18;
  const foot=Math.min(ref*.095+visible*(1-p)*.12,Math.max(0,visible-ry)),control=foot*15/38,handle=Math.min(w*.025,baseWidth*.2);
  const d=`M${n(left)} ${n(h)}C${n(left+handle)} ${n(h)} ${n(body)} ${n(h-control)} ${n(body)} ${n(h-foot)}V${n(top+ry)}C${n(body)} ${n(top+shoulder)} ${n(body+rx*32/76)} ${n(top)} ${n(body+rx)} ${n(top)}H${n(w-body-rx)}C${n(w-body-rx*32/76)} ${n(top)} ${n(w-body)} ${n(top+shoulder)} ${n(w-body)} ${n(top+ry)}V${n(h-foot)}C${n(w-body)} ${n(h-control)} ${n(right-handle)} ${n(h)} ${n(right)} ${n(h)}`;
  // Extend the shared fill through the centre of the footer stroke. There is
  // no second horizontal border, and no transparent half-pixel gap below it.
  return{d,clip:d+`L${n(right)} ${n(h+1)}H${n(left)}Z`,left,right,top,bottom:h,width:w,height:h,progress:p,visibleHeight:visible};
 }
 function motion({paint,now=()=>performance.now(),request=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id),reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}){
  let frame=0,phase='closed',progress=0,height=1,metrics={width:1,height:1,referenceHeight:1},travel=null,resize=null,resolveTravel=null;
  const state=()=>({phase,progress,height,animating:!!travel||!!resize});
  const draw=()=>paint(geometry({...metrics,height,progress}),state());
  const schedule=()=>{if(!frame)frame=request(tick);};
  function tick(stamp){
   frame=0;
   if(travel){const t=clamp((stamp-travel.at)/travel.duration);progress=travel.from+(travel.to-travel.from)*t;if(t===1){phase=travel.to?'open':'closed';travel=null;}}
   if(resize){const t=clamp((stamp-resize.at)/resize.duration);height=resize.from+(resize.to-resize.from)*smooth(t);if(t===1)resize=null;}
   draw();
   if(travel||resize)schedule();else if(resolveTravel){const done=resolveTravel;resolveTravel=null;done(true);}
  }
  function measure(next,{immediate=false}={}){
   metrics={...metrics,...next};const target=Math.max(1,metrics.height);
   if(immediate||phase==='closed'||reduced()){height=target;resize=null;}
   else if(Math.abs((resize?.to??height)-target)>.25){resize={from:height,to:target,at:now(),duration:300};schedule();}
   draw();
  }
  function to(open,{immediate=false}={}){
   const target=open?1:0;
   if(resolveTravel){resolveTravel(false);resolveTravel=null;}
   if(immediate||reduced()||Math.abs(progress-target)<.0001){
    travel=null;resize=null;if(frame)cancel(frame);frame=0;progress=target;height=metrics.height;phase=open?'open':'closed';draw();return Promise.resolve(true);
   }
   phase=open?'opening':'closing';travel={from:progress,to:target,at:now(),duration:Math.max(100,(open?540:440)*Math.abs(target-progress))};
   draw();schedule();return new Promise(resolve=>{resolveTravel=resolve;});
  }
  function reset(){if(frame)cancel(frame);frame=0;travel=resize=null;if(resolveTravel)resolveTravel(false);resolveTravel=null;phase='closed';progress=0;height=metrics.height;draw();}
  return{measure,open:options=>to(true,options),close:options=>to(false,options),reset,state};
 }
 const api={geometry,motion};if(typeof module==='object'&&module.exports)module.exports=api;root.MouseLiquidBurrow=api;
})(typeof globalThis==='object'?globalThis:this);
