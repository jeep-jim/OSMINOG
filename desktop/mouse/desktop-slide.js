'use strict';
// Translate the live native clip containers with the shell. Never resize/reload
// website viewports or capture private page pixels for this visual transition.
(function(root){
 const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
 async function run({workspace,model,layout,change,direction=1}){
  if(root.matchMedia?.('(prefers-reduced-motion:reduce)').matches){await change();await layout();return;}
  const width=Math.max(1,workspace.getBoundingClientRect().width),sign=direction<0?-1:1;
  const previous=workspace.style.transform,wasInert=workspace.inert;
  model.desktopSliding=true;workspace.dataset.sliding='true';workspace.inert=true;
  async function animate(from,to,duration){
   let elapsed=0,last=performance.now();
   while(true){
    // A delayed native layout acknowledgement must not skip the whole slide.
    // Cap one displayed frame at 32ms; ordinary 60/120Hz timing is unchanged.
    const now=performance.now();elapsed+=Math.min(32,Math.max(0,now-last));last=now;
    const progress=Math.min(1,elapsed/duration);
    workspace.style.transform='translateX('+Math.round(from+(to-from)*ease(progress))+'px)';
    await layout();
    if(progress===1)break;
    await new Promise(resolve=>{
     let done=false,frame,timer;
     const finish=()=>{if(done)return;done=true;clearTimeout(timer);root.cancelAnimationFrame?.(frame);resolve();};
     frame=root.requestAnimationFrame(finish);timer=setTimeout(finish,40);
    });
   }
  }
  try{
   await animate(0,-sign*width,140);
   await change();
   await animate(sign*width,0,190);
  }finally{
   workspace.style.transform=previous;workspace.inert=wasInert;delete workspace.dataset.sliding;model.desktopSliding=false;await layout();
  }
 }
 const api={run,ease};if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseDesktopSlide=api;
})(globalThis);
