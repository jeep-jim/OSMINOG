'use strict';
// Test-only observer. The native key is sent by the main process after the
// real WAAPI timeline reaches its middle; no animation timing is changed.
function closingReversalPair(first,second){
 return!!first&&!!second&&first.phase==='closing'&&second.phase==='closing'&&first.open&&!first.hidden&&second.open&&!second.hidden&&second.time>first.time&&second.progress>0&&second.progress<first.progress&&second.matrix.f-first.matrix.f>=1;
}
// Self-contained so the native smoke can serialize this exact tested function
// into its renderer, without exposing a production automation API.
function observeNoraReversal({recorder,tray,panel,eventTarget,reopen,qualifiesClosing,timeoutMs=10000}){
 let previous=null,finished=false,openingResolved=false,timer,resolve,resolveOpening;
 const observed={armedAt:performance.now(),frameCount:0,closingCount:0,lastFrame:null,openingTrigger:null,escape:null};
 const promise=new Promise(done=>{resolve=done;}),opening=new Promise(done=>{resolveOpening=done;});
 const timing=()=>{
  const player=panel.getAnimations().find(animation=>animation.effect?.target===panel);
  return player?{currentTime:player.currentTime,duration:player.effect.getComputedTiming().duration,playState:player.playState,playbackRate:player.playbackRate}:null;
 };
 const openingAt=(frame,value,min,max)=>!!frame&&frame.phase==='opening'&&frame.open&&!frame.hidden&&frame.progress>0&&frame.progress<1&&!!value&&Number.isFinite(value.currentTime)&&value.currentTime>=min&&value.currentTime<=max&&value.duration===300&&value.playState==='running'&&value.playbackRate===1;
 const finish=result=>{
  if(finished)return;finished=true;clearTimeout(timer);eventTarget.removeEventListener('keydown',onKey,true);if(recorder.onFrame===observe)recorder.onFrame=null;
  if(!openingResolved){openingResolved=true;resolveOpening({error:result.error||'Reversal ended before its opening timeline trigger'});}
  resolve({...result,observed});
 };
 const onKey=event=>{
  if(event.key!=='Escape'||finished)return;
  const frame=recorder.sample(),value=timing();observed.escape={observedAt:performance.now(),isTrusted:event.isTrusted,frame,timing:value};
  if(!observed.openingTrigger||event.isTrusted!==true||!openingAt(frame,value,150,250))finish({error:'Native Escape did not arrive during the 150..250ms opening timeline'});
 };
 const observe=frame=>{
  if(finished)return;observed.frameCount++;observed.lastFrame=frame;if(frame.phase==='closing')observed.closingCount++;
  if(!openingResolved){
   const value=timing();
   if(openingAt(frame,value,150,200)){openingResolved=true;observed.openingTrigger={observedAt:performance.now(),frame,timing:value};resolveOpening(observed.openingTrigger);}
   else if(frame.phase==='open'||frame.phase==='opening'&&value&&Number.isFinite(value.currentTime)&&value.currentTime>200){finish({error:'The 150..200ms opening timeline trigger was missed'});return;}
  }
  if(observed.escape&&qualifiesClosing(previous,frame)){
   const closingFrames=[previous,frame],before=recorder.sample();
   try{void reopen();const after=recorder.sample();finish({before,after,closingFrames,open:tray.open});}catch(error){finish({error:String(error),before,closingFrames});}
   return;
  }
  previous=frame.phase==='closing'?frame:null;
 };
 // Window capture precedes the product's document capture listener, which
 // deliberately stops propagation after handling a genuine Escape.
 eventTarget.addEventListener('keydown',onKey,true);recorder.onFrame=observe;
 timer=setTimeout(()=>finish({error:'Timed out waiting for two painted closing frames separated by at least one pixel'}),timeoutMs);
 return{opening,promise,observed,dispose:()=>finish({error:'Interruption observer disposed'})};
}
module.exports={closingReversalPair,observeNoraReversal};
