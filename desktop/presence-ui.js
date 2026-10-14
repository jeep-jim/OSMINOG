'use strict';
(()=>{
 const native=globalThis.OSMINOGNative;if(!native)return;let cursor=null,busy=false,last='';
 document.addEventListener('pointermove',e=>{if(e.target.closest?.('.native-canvas'))cursor={x:e.clientX,y:e.clientY,surface:'canvas',at:Date.now()}},{passive:true});
 function collect(){const p=globalThis.project?.();if(!p)return null;let textBudget=250000;const preview=o=>{const t=String(o.text||o.code||'').slice(0,Math.min(2000,textBudget));textBudget-=t.length;return t};const all=globalThis.objects?.()||[],shell=globalThis.OSMINOGNativeBrowser?.state();return{project:p.id,activeTab:shell?.active||'',selection:typeof state!=='undefined'?[...state.selected]:[],cursor,canvas:{title:p.name,viewport:p.viewport||{},totalObjects:all.length,objects:all.slice(0,1000).map(o=>({id:o.id,type:o.type,name:o.name,fileName:o.fileName,mime:o.mime,x:o.x,y:o.y,w:o.w,h:o.h,text:preview(o),url:o.url,asset:o.src?'osminog://asset/'+o.id:undefined})),connections:(p.connections||[]).slice(0,1000)}}}
 globalThis.OSMINOGCollectBrowserContext=collect;
 async function publish(){if(busy)return;const board=collect();if(!board)return;const serialized=JSON.stringify(board);if(serialized===last)return;busy=true;try{await native.browser('presence-update',{board});last=serialized}catch{}finally{busy=false}}
 setInterval(publish,750);publish();
})();
