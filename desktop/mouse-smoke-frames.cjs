'use strict';
// Test-only presentation capture. Selection examines the pixels delivered by
// Electron; it never requests a later screenshot or changes animation timing.
function armFrameCapture(contents,{select,timeoutMs=4000,maxFrames=120}={}){
 if(typeof select!=='function')throw Error('A painted-frame selector is required');
 let resolve,reject,resolveReady,rejectReady,timer,done=false,sequence=0,subscribed=false;const started=performance.now();
 const result=new Promise((yes,no)=>{resolve=yes;reject=no;});result.catch(()=>{});
 // Wait for an actual framebuffer before triggering a short transition;
 // registering a subscription alone does not prove that capture is ready.
 const ready=new Promise((yes,no)=>{resolveReady=yes;rejectReady=no;});ready.catch(()=>{});
 function cleanup(){clearTimeout(timer);contents.removeListener?.('destroyed',destroyed);if(subscribed){subscribed=false;try{contents.endFrameSubscription();}catch{}}}
 function fail(error){if(done)return;done=true;cleanup();const reason=error instanceof Error?error:Error(String(error));rejectReady(reason);reject(reason);}
 function destroyed(){fail(Error('Window closed before the painted frame arrived'));}
 const cancel=()=>fail(Error('Painted-frame capture cancelled'));
 try{
  contents.once?.('destroyed',destroyed);subscribed=true;
  contents.beginFrameSubscription(false,(image,dirtyRect)=>{
   if(done)return;sequence++;
   try{
    const scales=image.getScaleFactors?.()||[1];if(!Array.isArray(scales)||!scales.length||scales.some(value=>!Number.isFinite(value)||value<=0))throw Error('Invalid presentation image scale');
    const scaleFactor=Math.max(...scales),pixelSize=image.getSize(scaleFactor);if(!pixelSize||!['width','height'].every(key=>Number.isInteger(pixelSize[key])&&pixelSize[key]>0))throw Error('Invalid presentation bitmap dimensions');
    const frame={sequence,elapsedMs:performance.now()-started,dirtyRect:{...dirtyRect},scaleFactor,pixelSize};
    const metadata=select(image,frame);
    if(metadata&&typeof metadata.then==='function')throw Error('Painted-frame selection must be synchronous');
    if(sequence===1)resolveReady({...frame,dirtyRect:{...frame.dirtyRect},pixelSize:{...pixelSize}});
    if(metadata){done=true;cleanup();const png=image.toPNG({scaleFactor});resolve({source:'beginFrameSubscription',...frame,metadata,png});}
    else if(sequence>=maxFrames)fail(Error('No qualifying painted frame in '+maxFrames+' presentation callbacks'));
   }catch(error){if(done){cleanup();reject(error);}else fail(error);}
  });
  if(!done)timer=setTimeout(()=>fail(Error('Painted-frame capture timed out after '+timeoutMs+'ms ('+sequence+' frames)')),timeoutMs);
 }catch(error){fail(error);}
 return{result,ready,cancel};
}
module.exports={armFrameCapture};
