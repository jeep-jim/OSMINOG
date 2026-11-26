'use strict';
const assert=require('node:assert/strict');

// Serialized into the installed shell. Observe the target and its ancestors,
// never finish/cancel animations or change their playback, styles or geometry.
function ownerClickTarget(selector,hitTarget,options={}){
 const element=document.querySelector(selector),point=hitTarget(element,options),bounds=element?.getBoundingClientRect();
 const rect=bounds?{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}:null,animations=[];
 let animationCount=0,activeFinite=0,unknownTiming=0,ancestors=0,inspectionTruncated=false;
 ancestry:for(let node=element;node;node=node.parentElement){
  if(++ancestors>64){unknownTiming++;inspectionTruncated=true;break;}
  for(const animation of node.getAnimations({subtree:false})){
   if(animationCount>=128){unknownTiming++;inspectionTruncated=true;break ancestry;}
   const timing=animation.effect?.getComputedTiming(),end=timing?.endTime,finite=Number.isFinite(end),active=animation.pending||['running','paused'].includes(animation.playState);
   if(active&&finite)activeFinite++;if(active&&!finite&&end!==Infinity)unknownTiming++;
   animationCount++;
   if(animations.length<8)animations.push({owner:node.id||node.tagName,name:String(animation.animationName||animation.transitionProperty||'').slice(0,80),playState:animation.playState,pending:animation.pending===true,finite,endTime:finite?end:null,currentTime:Number.isFinite(animation.currentTime)?animation.currentTime:null});
  }
 }
 const focused=document.hasFocus(),visible=document.visibilityState==='visible',connected=!!element?.isConnected;
 return{at:performance.now(),timeOrigin:performance.timeOrigin,target:element?{id:element.id||'',tag:element.tagName,connected,bounds:rect}:null,point,focused,visible,animations,animationCount,droppedAnimations:Math.max(0,animationCount-animations.length),inspectionTruncated,activeFinite,unknownTiming,ready:connected&&focused&&visible&&point.ready&&activeFinite===0&&unknownTiming===0};
}

// A separate, bounded passive receipt supplements the retained trusted-click
// probe. In particular, record geometry when DOWN/UP/click actually arrive.
function installOwnerClickReadback(selector,readTarget,hitTarget,options={},ticket){
 globalThis.__mouse637ClickReadback?.dispose();
 const expected=document.querySelector(selector),events=[],types=['pointerdown','pointerup','click'];let dropped=0;
 const listener=event=>{
  if(events.length>=8){dropped++;return;}
  const row={type:event.type,trusted:event.isTrusted,matches:!!expected&&(expected===event.target||expected.contains(event.target)),target:event.target?.id||event.target?.tagName||null,targetClass:String(event.target?.className?.baseVal??event.target?.className??'').slice(0,120),x:event.clientX,y:event.clientY,button:event.button,buttons:event.buttons,at:performance.now()};
  try{const r=event.target?.getBoundingClientRect?.();row.targetBounds=r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;row.readback=readTarget(selector,hitTarget,options);row.sameTarget=expected===document.querySelector(selector);}catch(error){row.readbackError=String(error?.message||error).slice(0,240);}
  events.push(row);
 };
 for(const type of types)document.addEventListener(type,listener,{capture:true,passive:true});
 const observer={ticket,read:()=>({events:events.slice(),dropped}),dispose(){for(const type of types)document.removeEventListener(type,listener,true);if(globalThis.__mouse637ClickReadback===observer)delete globalThis.__mouse637ClickReadback;}};globalThis.__mouse637ClickReadback=observer;
}

// The two readiness phases share the former 10-second target deadline. A
// failed preparation never posts DOWN/UP; callers still send exactly one click.
async function prepareOwnerClick({read,hover,frame,until,report,now=()=>performance.now()}){
 const startedAt=now(),deadlineAt=startedAt+10000;
 Object.assign(report,{clock:'main.performance.now',startedAt,deadlineAt,timeoutMs:10000,samples:[],sampleCount:0,droppedSamples:0});
 const remaining=()=>{const value=deadlineAt-now();if(value<=0)throw Error('Mouse636 native target readiness deadline exceeded');return value;};
 const observe=(phase,sample)=>{report.sampleCount++;const row={phase,...sample};if(report.samples.length<8)report.samples.push(row);else{report.samples[7]=row;report.droppedSamples++;}};
 async function ready(phase){
  let sample;await until(async()=>{sample=await read(remaining(),phase==='after-hover');remaining();observe(phase,sample);return sample.ready;},'636 native target '+phase,remaining());remaining();return sample;
 }
 const before=await ready('before-hover');report.beforeHover=before;
 report.hover=await hover(before,remaining());remaining();
 await frame(remaining());remaining();
 const fresh=await ready('after-hover');assert.equal(fresh.dom.timeOrigin,before.dom.timeOrigin,'The native click retains its actual renderer document');
 report.beforeDown=fresh;report.preparedAt=now();remaining();return{sample:fresh,deadlineAt};
}

module.exports={ownerClickTarget,installOwnerClickReadback,prepareOwnerClick};
