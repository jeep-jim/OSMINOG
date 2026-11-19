'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {armFrameCapture}=require('./mouse-smoke-frames.cjs');
function fixture(){const contents=new EventEmitter(),events=[];contents.beginFrameSubscription=(onlyDirty,callback)=>{assert.equal(onlyDirty,false);contents.frame=callback;events.push('armed');};contents.endFrameSubscription=()=>events.push('ended');return{contents,events,image(value){return{value,getScaleFactors:()=>[1,2],getSize:s=>({width:50*s,height:30*s}),toPNG:({scaleFactor})=>{events.push('encoded '+value+' at '+scaleFactor);return Buffer.from(value);}};}};}
test('arms before action; rejects endpoints and encodes only the selected actual frame at its native scale',async()=>{const f=fixture(),seen=[],capture=armFrameCapture(f.contents,{select(image,frame){seen.push(frame);return image.value==='middle'?{top:27}:null;}});assert.deepEqual(f.events,['armed']);f.contents.frame(f.image('closed'),{x:0,y:0,width:100,height:60});f.contents.frame(f.image('middle'),{x:4,y:9,width:20,height:12});f.contents.frame(f.image('late'),{});const result=await capture.result;assert.deepEqual(f.events,['armed','ended','encoded middle at 2']);assert.equal(result.source,'beginFrameSubscription');assert.equal(result.sequence,2);assert.equal(result.scaleFactor,2);assert.deepEqual(result.pixelSize,{width:100,height:60});assert.deepEqual(result.metadata,{top:27});assert.equal(result.png.toString(),'middle');assert.equal(seen.length,2);assert.equal(f.contents.listenerCount('destroyed'),0);capture.cancel();assert.equal(f.events.filter(x=>x==='ended').length,1);});
test('pixel selector failure always unsubscribes and never encodes',async()=>{const f=fixture(),capture=armFrameCapture(f.contents,{select(){throw Error('bad pixels');}});f.contents.frame(f.image('bad'),{});await assert.rejects(capture.result,/bad pixels/);assert.deepEqual(f.events,['armed','ended']);});
test('cancel and destroyed window end the subscription exactly once',async()=>{for(const destroy of [false,true]){const f=fixture(),capture=armFrameCapture(f.contents,{select:()=>null});if(destroy)f.contents.emit('destroyed');else capture.cancel();capture.cancel();await assert.rejects(capture.result,/closed|cancelled/);assert.deepEqual(f.events,['armed','ended']);assert.equal(f.contents.listenerCount('destroyed'),0);}});
test('bounded callback budget rejects without keeping image buffers',async()=>{const f=fixture(),capture=armFrameCapture(f.contents,{select:()=>null,maxFrames:2});f.contents.frame(f.image('closed'),{});f.contents.frame(f.image('open'),{});await assert.rejects(capture.result,/2 presentation callbacks/);assert.deepEqual(f.events,['armed','ended']);});
test('timeout unsubscribes without requiring another presentation event',async()=>{const f=fixture(),capture=armFrameCapture(f.contents,{select:()=>null,timeoutMs:1});await assert.rejects(capture.result,/timed out/);assert.deepEqual(f.events,['armed','ended']);});
test('async selectors are rejected instead of accepting a pending Promise as a frame',async()=>{const f=fixture(),capture=armFrameCapture(f.contents,{select:()=>Promise.resolve(null)});f.contents.frame(f.image('bad'),{});await assert.rejects(capture.result,/must be synchronous/);assert.deepEqual(f.events,['armed','ended']);});
test('invalid scales and bitmap sizes fail before selecting or encoding',async()=>{for(const [scales,size]of [[[NaN],{width:100,height:60}],[[0],{width:100,height:60}],[[],{width:100,height:60}],[[2],{width:Infinity,height:60}],[[2],{width:100,height:0}],[[2],{width:100.5,height:60}]]){const f=fixture(),image=f.image('bad'),capture=armFrameCapture(f.contents,{select(){throw Error('invalid dimensions reached selector');}});image.getScaleFactors=()=>scales;image.getSize=()=>size;f.contents.frame(image,{});await assert.rejects(capture.result,/Invalid presentation (image scale|bitmap dimensions)/);assert.deepEqual(f.events,['armed','ended']);}});
test('ready waits for a valid framebuffer while selection continues on the same subscription',async()=>{
 const f=fixture(),capture=armFrameCapture(f.contents,{select:image=>image.value==='middle'?{middle:true}:null});let ready=false;capture.ready.then(()=>{ready=true;});await Promise.resolve();assert.equal(ready,false,'registering capture does not signal a framebuffer');
 f.contents.frame(f.image('baseline'),{x:1,y:2,width:100,height:60});const baseline=await capture.ready;assert.equal(ready,true);assert.equal(baseline.sequence,1);assert.ok(Number.isFinite(baseline.elapsedMs)&&baseline.elapsedMs>=0);assert.deepEqual(baseline.pixelSize,{width:100,height:60});assert.equal(baseline.scaleFactor,2);assert.deepEqual(f.events,['armed'],'waiting for the baseline does not encode or restart capture');
 f.contents.frame(f.image('middle'),{});const selected=await capture.result;assert.equal(selected.sequence,2);assert.deepEqual(await capture.ready,baseline);assert.deepEqual(f.events,['armed','ended','encoded middle at 2']);
});
test('ready and result reject together when timeout, cancel or destruction precedes the first framebuffer',async()=>{
 for(const reason of ['timeout','cancel','destroy']){const f=fixture(),capture=armFrameCapture(f.contents,{select:()=>null,timeoutMs:reason==='timeout'?1:4000});if(reason==='cancel')capture.cancel();else if(reason==='destroy')f.contents.emit('destroyed');const outcomes=await Promise.allSettled([capture.ready,capture.result]);assert.ok(outcomes.every(value=>value.status==='rejected'));assert.strictEqual(outcomes[0].reason,outcomes[1].reason);assert.match(outcomes[0].reason.message,/timed out|cancelled|closed/);assert.deepEqual(f.events,['armed','ended']);assert.equal(f.contents.listenerCount('destroyed'),0);}
});
test('a malformed first framebuffer or throwing selector never signals readiness',async()=>{
 for(const malformed of [true,false]){const f=fixture(),capture=armFrameCapture(f.contents,{select(){if(!malformed)throw Error('invalid bitmap data');return null;}}),image=f.image('bad');if(malformed)image.getSize=()=>({width:NaN,height:60});f.contents.frame(image,{});const outcomes=await Promise.allSettled([capture.ready,capture.result]);assert.ok(outcomes.every(value=>value.status==='rejected'));assert.strictEqual(outcomes[0].reason,outcomes[1].reason);assert.deepEqual(f.events,['armed','ended']);}
});

function nativeCornerCrop(){
 const fs=require('node:fs'),vm=require('node:vm'),file=require.resolve('./mouse-628-ui-smoke.cjs'),from=require('node:module').createRequire(file),context={module:{exports:{}},require:id=>id==='electron'?{}:from(id)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return(...args)=>JSON.parse(JSON.stringify(context.module.exports.screenCropGeometry(...args)));
}
test('native corner proof crops the real display origin from the first failed Mac geometry',()=>{
 const crop=nativeCornerCrop(),display={x:0,y:0,width:1024,height:768},content={x:8,y:33,width:1008,height:668};
 const result=crop(display,content,{width:1024,height:768});assert.deepEqual(result,{cropPixels:{x:8,y:33,width:1008,height:668},mapping:{scaleX:1,scaleY:1,originX:0,originY:0}});
 // The failing interior probe is window-local (15,404); its actual screen
 // pixel is (23,437), not a pixel in the shell WebContents screenshot.
 const point={x:15,y:404},mapped={x:result.cropPixels.x+Math.floor(result.mapping.originX+point.x*result.mapping.scaleX),y:result.cropPixels.y+Math.floor(result.mapping.originY+point.y*result.mapping.scaleY)};
 assert.deepEqual(mapped,{x:23,y:437});
 const retina=crop(display,content,{width:2048,height:1536});assert.deepEqual(retina.cropPixels,{x:16,y:66,width:2016,height:1336});assert.deepEqual(retina.mapping,{scaleX:2,scaleY:2,originX:0,originY:0});
});
test('fractional scale and a negative display origin retain exact source pixels without resizing',()=>{
 const crop=nativeCornerCrop(),display={x:-1280,y:-100,width:1280,height:800},content={x:-1273,y:-93,width:803,height:603},result=crop(display,content,{width:1600,height:1000});
 assert.deepEqual(result.cropPixels,{x:8,y:8,width:1005,height:755});assert.deepEqual(result.mapping,{scaleX:1.25,scaleY:1.25,originX:.75,originY:.75});
 for(const point of [{x:0,y:0},{x:1.25,y:1.25},{x:15,y:404},{x:801.75,y:601.75}]){
  const actual={x:result.cropPixels.x+Math.floor(result.mapping.originX+point.x*result.mapping.scaleX),y:result.cropPixels.y+Math.floor(result.mapping.originY+point.y*result.mapping.scaleY)};
  assert.deepEqual(actual,{x:Math.floor((7+point.x)*1.25),y:Math.floor((7+point.y)*1.25)},'cropped coordinates still identify the original physical framebuffer pixel');
 }
});
test('native corner proof rejects off-display windows and invalid capture dimensions',()=>{
 const crop=nativeCornerCrop(),display={x:0,y:0,width:1024,height:768},pixels={width:1024,height:768};
 for(const content of [{x:-1,y:0,width:100,height:100},{x:1000,y:0,width:100,height:100},{x:0,y:700,width:100,height:100},{x:0,y:0,width:0,height:100}])assert.throws(()=>crop(display,content,pixels),/inside the captured display/);
 assert.throws(()=>crop(display,{x:0,y:0,width:100,height:100},{width:NaN,height:768}),/real display scale/);
});
