/* Shared by the shell and geometry tests; coordinates stay inside the workspace. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.OSMINOGTileLayout=api})(globalThis,()=>{
 const gap=12,near=18;
 const overlap=(a,b)=>a.x<b.x+b.w+gap-.1&&a.x+a.w+gap>b.x+.1&&a.y<b.y+b.h+gap-.1&&a.y+a.h+gap>b.y+.1;
 function arrange(items,width,priority){
  width=Math.max(1,width);const placed=[],result=new Map();
  const ordered=[...items.filter(r=>r.key!==priority),...items.filter(r=>r.key===priority)];
  for(const item of ordered){
   const w=Math.min(width,Math.max(Math.min(220,width),item.w)),h=Math.max(160,item.h);
   let x=Math.max(0,Math.min(width-w,item.x)),y=Math.max(0,item.y);
   const xs=[0,width-w,...placed.flatMap(p=>[p.x,p.x+p.w-w,p.x+p.w+gap,p.x-w-gap])].filter(v=>v>=0&&v<=width-w);
   const ys=[0,...placed.flatMap(p=>[p.y,p.y+p.h-h,p.y+p.h+gap,p.y-h-gap])].filter(v=>v>=0);
   const snap=(value,edges)=>edges.reduce((best,v)=>Math.abs(v-value)<Math.abs(best-value)?v:best,value+near+1);
   const sx=snap(x,xs),sy=snap(y,ys);if(Math.abs(sx-x)<=near)x=sx;if(Math.abs(sy-y)<=near)y=sy;
   let r={key:item.key,x,y,w,h};
   if(placed.some(p=>overlap(r,p))){
    const candidates=[];for(const cx of new Set([x,...xs]))for(const cy of new Set([y,...ys]))candidates.push({key:item.key,x:cx,y:cy,w,h});
    candidates.sort((a,b)=>(a.x-x)**2+(a.y-y)**2-((b.x-x)**2+(b.y-y)**2)||a.y-b.y||a.x-b.x);
    r=candidates.find(c=>placed.every(p=>!overlap(c,p)))||{...r,x:0,y:Math.max(0,...placed.map(p=>p.y+p.h+gap))};
   }
   placed.push(r);result.set(item.key,r);
  }
  return items.map(item=>result.get(item.key));
 }
 function resize(rect,w,h,others,width){
  w=Math.max(Math.min(220,width),Math.min(width-rect.x,w));h=Math.max(160,h);
  for(const o of others)if(o.x>=rect.x+rect.w-.1&&rect.y<o.y+o.h+gap&&rect.y+rect.h+gap>o.y)w=Math.min(w,Math.max(rect.w,o.x-rect.x-gap));
  for(const o of others)if(o.y>=rect.y+rect.h-.1&&rect.x<o.x+o.w+gap&&rect.x+w+gap>o.x)h=Math.min(h,Math.max(rect.h,o.y-rect.y-gap));
  return{w,h};
 }
 return{arrange,resize,overlap,gap};
});
