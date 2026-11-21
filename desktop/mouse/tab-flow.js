'use strict';
(function(root){
 function shape(width,height){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
  const r=Math.min(10,width/2,height/2),right=r+width,total=width+2*r;
  return{radius:r,width:total,height,path:`M${2*r} 0H${right-r}Q${right} 0 ${right} ${r}V${height-r}Q${right} ${height} ${total} ${height}H0Q${r} ${height} ${r} ${height-r}V${r}Q${r} 0 ${2*r} 0Z`};
 }
 if(typeof module==='object'&&module.exports){module.exports={shape};return;}
 const bar=document.querySelector('.toolbar'),strip=document.querySelector('#tabstrip');if(!bar||!strip)return;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
 svg.classList.add('mouse-tab-flow');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.append(path);bar.prepend(svg);
 let frame=0,stopped=false,observed=null,signature='';
 const resize=new ResizeObserver(schedule);
 function draw(){
  if(stopped)return;
  const active=strip.querySelector('.tab-item.active');
  if(active!==observed){if(observed)resize.unobserve(observed);observed=active;if(observed)resize.observe(observed);}
  const b=bar.getBoundingClientRect(),a=active?.getBoundingClientRect(),s=a&&shape(a.width,b.bottom-a.top);
  if(!s||!active.getClientRects().length){if(signature!=='hidden'){signature='hidden';svg.style.display='none';delete bar.dataset.tabFlow;}return;}
  const next=[active.dataset.tab,a.left-b.left,a.top-b.top,s.width,s.height,s.path].join('|');if(next===signature)return;signature=next;
  svg.style.display='block';svg.style.left=(a.left-b.left-s.radius)+'px';svg.style.top=(a.top-b.top)+'px';svg.style.width=s.width+'px';svg.style.height=s.height+'px';
  svg.setAttribute('viewBox',`0 0 ${s.width} ${s.height}`);path.setAttribute('d',s.path);svg.dataset.tab=active.dataset.tab;bar.dataset.tabFlow='true';
 }
 function schedule(){
  if(stopped)return;
  // Metadata and tab fitting can deliver many mutations in one turn. Read
  // layout once per frame, and never force it from a MutationObserver callback.
  if(frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});
 }
 const mutations=new MutationObserver(schedule);mutations.observe(strip,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','data-density']});
 resize.observe(bar);resize.observe(strip);strip.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule);document.fonts?.ready.then(schedule);schedule();
 window.addEventListener('pagehide',()=>{stopped=true;cancelAnimationFrame(frame);mutations.disconnect();resize.disconnect();strip.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);svg.remove();observed=null;delete bar.dataset.tabFlow;},{once:true});
})(globalThis);
