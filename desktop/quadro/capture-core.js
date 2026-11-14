'use strict';
(function(root){
 function rect(a,b,w,h){const clamp=(n,max)=>Math.max(0,Math.min(max,n));const x=clamp(Math.min(a.x,b.x),w),y=clamp(Math.min(a.y,b.y),h);return{x:Math.floor(x),y:Math.floor(y),width:Math.max(0,Math.floor(clamp(Math.max(a.x,b.x),w)-x)),height:Math.max(0,Math.floor(clamp(Math.max(a.y,b.y),h)-y))}}
 function draw(ctx,op){
  ctx.save();ctx.strokeStyle=op.color;ctx.fillStyle=op.color;ctx.lineWidth=op.width;ctx.lineCap='round';ctx.lineJoin='round';
  const a=op.points[0],b=op.points[op.points.length-1];ctx.beginPath();
  if(op.tool==='text'){ctx.font=`${op.font||24}px -apple-system,Arial,sans-serif`;ctx.textBaseline='top';String(op.text||'').split('\n').slice(0,20).forEach((s,i)=>ctx.fillText(s.slice(0,200),a.x,a.y+i*(op.font||24)*1.2));}
  else if(op.tool==='rect')ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
  else if(op.tool==='ellipse'){ctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.abs(b.x-a.x)/2,Math.abs(b.y-a.y)/2,0,0,Math.PI*2);ctx.stroke()}
  else{
   if(op.tool==='marker'){ctx.globalAlpha=.3;ctx.lineWidth=op.width*4;ctx.lineCap='square'}
   ctx.moveTo(a.x,a.y);for(const p of op.points)ctx.lineTo(p.x,p.y);ctx.stroke();
   if(op.tool==='arrow'){const angle=Math.atan2(b.y-a.y,b.x-a.x),len=Math.max(12,op.width*4);ctx.beginPath();ctx.moveTo(b.x-len*Math.cos(angle-.45),b.y-len*Math.sin(angle-.45));ctx.lineTo(b.x,b.y);ctx.lineTo(b.x-len*Math.cos(angle+.45),b.y-len*Math.sin(angle+.45));ctx.stroke()}
  }
  ctx.restore();
 }
 const api={rect,draw};if(typeof module!=='undefined')module.exports=api;else root.QuadroCaptureCore=api;
})(globalThis);
