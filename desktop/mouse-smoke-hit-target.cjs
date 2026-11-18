'use strict';
// This function is also serialized into the installed shell. Keep it closed
// over browser inputs only: no Node globals and no synthetic DOM clicks.
function nativeHitTarget(element,{xFraction=.5,yFraction=.5}={}){
 if(!element)return{ready:false,reason:'missing'};
 const document=element.ownerDocument,view=document.defaultView,style=view.getComputedStyle(element),bounds=element.getBoundingClientRect();
 const geometry={width:bounds.width,height:bounds.height};
 if(element.disabled||!bounds.width||!bounds.height||style.pointerEvents==='none'||style.visibility==='hidden'||style.display==='none'||Number(style.opacity)<(element.matches('.tab-close')?0.95:0.01))return{ready:false,reason:'hidden or disabled',...geometry,pointer:style.pointerEvents,opacity:style.opacity};
 // Inline spans may occupy several disjoint line boxes. Their union's centre
 // can be empty space between lines, so hit-test each visible fragment.
 const clip={left:0,top:0,right:view.innerWidth,bottom:view.innerHeight};
 for(let parent=element.parentElement;parent;parent=parent.parentElement){
  const css=view.getComputedStyle(parent),x=/^(?:auto|scroll|hidden|clip)$/.test(css.overflowX),y=/^(?:auto|scroll|hidden|clip)$/.test(css.overflowY);if(!x&&!y)continue;
  const box=parent.getBoundingClientRect(),left=box.left+parent.clientLeft,top=box.top+parent.clientTop;
  if(x){clip.left=Math.max(clip.left,left);clip.right=Math.min(clip.right,left+parent.clientWidth);}
  if(y){clip.top=Math.max(clip.top,top);clip.bottom=Math.min(clip.bottom,top+parent.clientHeight);}
 }
 const fragments=[...element.getClientRects()].filter(r=>r.width>0&&r.height>0),rects=fragments.length?fragments:[bounds],seen=new Set();let lastHit='';
 function hit(x,y){
  x=Math.round(x);y=Math.round(y);if(x<clip.left||x>=clip.right||y<clip.top||y>=clip.bottom)return null;const key=x+','+y;if(seen.has(key))return null;seen.add(key);
  const target=document.elementFromPoint(x,y);lastHit=target?target.tagName.toLowerCase()+(target.className?'.'+String(target.className).trim().replace(/\s+/g,'.'):''):'none';return element.contains(target)?{ready:true,x,y}:null;
 }
 // Preserve an explicitly chosen canvas location when it is actually exposed.
 const preferred=hit(bounds.left+bounds.width*xFraction,bounds.top+bounds.height*yFraction);if(preferred)return preferred;
 for(const rect of rects){
  const left=Math.max(rect.left,clip.left),right=Math.min(rect.right,clip.right),top=Math.max(rect.top,clip.top),bottom=Math.min(rect.bottom,clip.bottom);if(right-left<1||bottom-top<1)continue;
  const xs=element.matches('.tab-title')?[right-3,left+(right-left)*.75,left+(right-left)*.5]:[left+(right-left)*xFraction,left+(right-left)*.5,left+(right-left)*.25,left+(right-left)*.75,left+1,right-2];
  const ys=[top+(bottom-top)*yFraction,top+(bottom-top)*.5,top+(bottom-top)*.25,top+(bottom-top)*.75];
  for(const y of ys)for(const x of xs)if(x>=left&&x<right&&y>=top&&y<bottom){const point=hit(x,y);if(point)return point;}
 }
 return{ready:false,reason:'covered or clipped',...geometry,fragments:rects.map(r=>({left:r.left,top:r.top,width:r.width,height:r.height})),clip,lastHit,density:document.querySelector('#tabstrip')?.dataset.density};
}
module.exports={nativeHitTarget};
