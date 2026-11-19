'use strict';
// Shared by the shell, main process and the bundled isolated page preload.
// Wheel events carry deltas, not a physical finger count.
function createMouseDesktopWheelTools(){
 const QUIET_MS=280,COOLDOWN_MS=420,HORIZONTAL_THRESHOLD=112,CONTROL_THRESHOLD=64;
 function normalize(event,height=800){
  if(!event||event.isTrusted!==true||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return null;
  const scale=event.deltaMode===1?16:event.deltaMode===2?Math.max(120,Math.min(800,height)):event.deltaMode===0?1:0;
  if(!scale||![event.deltaX,event.deltaY].every(Number.isFinite))return null;
  const clamp=value=>Math.max(-1024,Math.min(1024,value*scale));return{deltaX:clamp(event.deltaX),deltaY:clamp(event.deltaY)};
 }
 function axisOf({deltaX,deltaY},controls){const x=Math.abs(deltaX),y=Math.abs(deltaY);return x>=4&&x>=y*1.5?'x':controls&&y>=4&&y>=x*1.5?'y':null;}
 function ownsScroll(path,axis,window){
  for(const node of path.slice(0,40)){
   if(!node||node.nodeType!==1)continue;
   if(node.isContentEditable||node.matches?.('input,textarea,select,iframe,canvas,[role="slider"],[role="grid"]'))return true;
   const horizontal=axis==='x',size=horizontal?node.scrollWidth:node.scrollHeight,client=horizontal?node.clientWidth:node.clientHeight;if(!(size>client+1&&client>0))continue;
   const style=window.getComputedStyle(node),overflow=horizontal?style.overflowX:style.overflowY;
   // Reserve the whole gesture for a scrollable ancestor, including its edge.
   // Reaching the end of a carousel must not turn its inertia into a desk swipe.
   if(/^(auto|scroll|overlay)$/.test(overflow)||node===window.document?.scrollingElement)return true;
  }
  return false;
 }
 function listen({window,scope,send,now=()=>window.performance.now()}){
  let last=-Infinity,owner=null,blocked=false,axis=null;
  const wheel=event=>{
   const time=now(),data=normalize(event,window.innerHeight||800);if(!data)return;
   const path=typeof event.composedPath==='function'?event.composedPath():[event.target],next=scope(event,path),controls=next==='nora'||next==='control';
   if(time-last>QUIET_MS||owner!==next){owner=next;blocked=false;axis=null;}last=time;if(!owner||blocked)return;
   const candidate=axisOf(data,controls);
   if(!candidate){if(Math.abs(data.deltaY)>=4&&Math.abs(data.deltaY)>Math.abs(data.deltaX)*1.5)blocked=true;return;}
   if(axis&&axis!==candidate){blocked=true;return;}axis=candidate;
   if(ownsScroll(path,axis,window)){blocked=true;return;}
   if(event.cancelable)event.preventDefault();send({...data,scope:owner});
  };
  window.addEventListener('wheel',wheel,{passive:false});
  return{dispose:()=>window.removeEventListener('wheel',wheel),reset(){last=-Infinity;owner=null;blocked=false;axis=null;}};
 }
 function accumulator({now=Date.now}={}){
  let last=-Infinity,lastSwitch=-Infinity,locked=false,axis=null,direction=0,distance=0,count=0,started=0;
  function reset(){last=-Infinity;lastSwitch=-Infinity;locked=false;axis=null;direction=0;distance=0;count=0;}
  function push(value){
   const time=now(),controls=value.scope==='nora'||value.scope==='control',nextAxis=axisOf(value,controls);
   if(time-last>QUIET_MS){locked=time-lastSwitch<COOLDOWN_MS;axis=null;direction=0;distance=0;count=0;started=time;}last=time;
   if(locked||!nextAxis)return null;const delta=nextAxis==='x'?value.deltaX:value.deltaY,sign=Math.sign(delta);
   if(axis!==nextAxis||direction!==sign){axis=nextAxis;direction=sign;distance=0;count=0;started=time;}
   distance+=Math.abs(delta);count++;const threshold=axis==='x'?HORIZONTAL_THRESHOLD:CONTROL_THRESHOLD;
   if(distance<threshold||axis==='x'&&count<2)return null;
   locked=true;lastSwitch=time;return{direction:direction>0?'left':'right',axis,distance,count,startedAt:started};
  }
  return{push,reset};
 }
 return{QUIET_MS,COOLDOWN_MS,HORIZONTAL_THRESHOLD,CONTROL_THRESHOLD,normalize,axisOf,ownsScroll,listen,accumulator};
}
if(typeof module==='object'&&module.exports)module.exports={createMouseDesktopWheelTools,...createMouseDesktopWheelTools()};
else globalThis.MouseDesktopWheel=createMouseDesktopWheelTools();
