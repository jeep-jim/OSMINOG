'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {sample}=require('./mouse-638-feedback-helpers.cjs');

function harness({frames=[false,true],states}={}){
 const source=fs.readFileSync(require.resolve('./mouse-638-feedback-smoke.cjs'),'utf8'),start=source.indexOf(' async function capture('),end=source.indexOf('\n async function gridCapture(',start);assert.ok(start>=0&&end>start);
 const bounds={x:120,y:220,width:20,height:30},display={id:1,bounds:{x:100,y:200,width:100,height:100},workArea:{x:100,y:200,width:100,height:100},scaleFactor:2},facts={captures:[]},writes=[],sleeps=[];let reads=0,stateIndex=0;
 const state=()=>states?.[Math.min(stateIndex,states.length-1)]||{visible:true,bounds};
 const popupWindow={isDestroyed:()=>false,isVisible:()=>state().visible,getBounds:()=>{const value={...state().bounds};stateIndex++;return value;}};
 const png=(width,height,index)=>{const bytes=Buffer.alloc(25);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);bytes[24]=index;return bytes;};
 const image=(width,height,index)=>({crop:()=>image(200,200,index),toPNG:()=>png(width,height,index),toBitmap(){
  const bitmap=Buffer.alloc(width*height*4);for(let i=0;i<bitmap.length;i+=4){bitmap[i]=36;bitmap[i+1]=30;bitmap[i+2]=20;bitmap[i+3]=255;}
  if(frames[Math.min(index,frames.length-1)]){const x=Math.floor((bounds.x+bounds.width*.5-display.bounds.x)*2),y=Math.floor((bounds.y+bounds.height*.5-display.bounds.y)*2),at=(y*width+x)*4;bitmap[at]=118;bitmap[at+1]=106;bitmap[at+2]=56;}
  return bitmap;
 }});
 const ctx=vm.createContext({assert,Buffer,process:{pid:17,platform:'darwin'},fixture:{frame:async()=>{}},screen:{getDisplayMatching:()=>display},win:{getBounds:()=>display.bounds,getContentBounds:()=>display.bounds},
  globalCapture:{permission:()=> 'granted',acquire:async()=>({kind:'screen',backend:'owned-unit-frame',base:'data:image/png;base64,'+png(200,200,reads++).toString('base64')})},
  bounded:async(operation,ms)=>{assert.equal(ms,4500);return operation;},nativeImage:{createFromBuffer:bytes=>image(bytes.readUInt32BE(16),bytes.readUInt32BE(20),bytes[24])},screenCropGeometry:()=>({cropPixels:{x:0,y:0,width:200,height:200},mapping:{scaleX:2,scaleY:2,originX:0,originY:0}}),
  sample,sha256:bytes=>createHash('sha256').update(bytes).digest('hex'),facts,fs:{writeFile:async(name,bytes)=>writes.push({name,bytes})},save:async()=>{},sleep:async ms=>{assert.equal(ms,40);sleeps.push(ms);}});
 vm.runInContext(source.slice(start,end),ctx);
 return{capture:()=>ctx.capture('mouse-638-webstore-action-write.png',{popupWindow,meta:{kind:'webstore-action'}}),facts,writes,sleeps,get reads(){return reads;},bounds};
}

test('native popup capture rejects the blank first OS frame and records the accepted original grid and bounds',async()=>{
 const f=harness(),shot=await f.capture();assert.equal(f.reads,2);assert.equal(shot.attempts[0].accepted,false);assert.equal(shot.attempts[0].popup.range,0);assert.equal(shot.attempts[1].accepted,true);assert.equal(shot.popup.range,194);assert.equal(shot.popup.levels.length,25);assert.deepEqual({...shot.popup.bounds},f.bounds);assert.deepEqual({...shot.meta.bounds},f.bounds);assert.equal(f.sleeps.length,1);
});

test('native popup capture fails closed on six blank frames with no retry or threshold increase',async()=>{
 const f=harness({frames:[false]});await assert.rejects(f.capture(),/Actual OS pixels/);assert.equal(f.reads,6);const shot=f.facts.captures[0];assert.equal(shot.attempts.length,6);assert.ok(shot.attempts.every(x=>!x.accepted&&x.popup.range===0));assert.equal(f.writes.length,2,'The final failed OS frame remains available');
});

test('a visually varied frame cannot pass while the actual popup is hidden or moves during acquisition',async()=>{
 const b={x:120,y:220,width:20,height:30};
 for(const states of [[{visible:false,bounds:b}],[{visible:true,bounds:b},{visible:true,bounds:{...b,x:121}}]]){
  const repeated=states.length===1?states:Array.from({length:12},(_,i)=>states[i%2]);const f=harness({frames:[true],states:repeated});await assert.rejects(f.capture(),/Actual OS pixels/);assert.equal(f.reads,6);assert.ok(f.facts.captures[0].attempts.every(x=>!x.accepted));
 }
});
