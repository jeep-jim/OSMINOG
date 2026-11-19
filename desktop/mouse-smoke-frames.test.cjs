'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {armFrameCapture,nativeBitmap,staticShellReadback,nativeStaticFrameMatch,acquireFreshNativeFrame}=require('./mouse-smoke-frames.cjs');
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

function nativeCornerHelpers(){
 const fs=require('node:fs'),vm=require('node:vm'),file=require.resolve('./mouse-628-ui-smoke.cjs'),from=require('node:module').createRequire(file),context={module:{exports:{}},require:id=>id==='electron'?{}:from(id)};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return context.module.exports;
}
function nativeCornerCrop(){const helpers=nativeCornerHelpers();return(...args)=>JSON.parse(JSON.stringify(helpers.screenCropGeometry(...args)));}
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
test('native corner proof derives expected RGB from the current computed theme variable',()=>{
 const {cornerBackground}=nativeCornerHelpers(),read=value=>JSON.parse(JSON.stringify(cornerBackground(value)));
 assert.deepEqual(read(' #f3f5f9 '),{css:'#f3f5f9',rgb:[243,245,249]});assert.deepEqual(read('#10151e'),{css:'#10151e',rgb:[16,21,30]});
 assert.deepEqual(read('rgb(243, 245, 249)'),{css:'rgb(243, 245, 249)',rgb:[243,245,249]});assert.deepEqual(read('rgba(16, 21, 30, 1)'),{css:'rgba(16, 21, 30, 1)',rgb:[16,21,30]});
 for(const value of ['transparent','rgba(16, 21, 30, 0.5)','rgb(256, 0, 0)','rgb(1.5, 2, 3)',''])assert.throws(()=>cornerBackground(value),/opaque RGB theme colour/);
});
test('native corner readiness waits for both the painted marker and the current theme mask',()=>{
 const {nativeCornerPaintReady}=nativeCornerHelpers(),marker=[171,43,158],light=[243,245,249],dark=[16,21,30],row=(inside,outside)=>({before:{inside:{rgba:inside},outside:{rgba:outside}}}),stale=row([...marker,255],[...dark,255]),current=row([...marker,255],[...light,255]);
 // Actual second Mac failure: light DOM and visible marker, but the native
 // cutout still used the preceding dark theme. Distinct-from-marker is not
 // enough evidence that the selected theme has reached the native display.
 assert.equal(nativeCornerPaintReady([stale],marker,light),false);assert.equal(nativeCornerPaintReady([current],marker,light),true);assert.equal(nativeCornerPaintReady([stale],marker,dark),true);
 assert.equal(nativeCornerPaintReady([current,stale],marker,light),false);assert.equal(nativeCornerPaintReady([],marker,light),false);
 assert.equal(nativeCornerPaintReady([row([...light,255],[...light,255])],marker,light),false);assert.equal(nativeCornerPaintReady([row([...marker,254],[...light,255])],marker,light),false);assert.equal(nativeCornerPaintReady([row([...marker,255],[...light,254])],marker,light),false);
 assert.equal(nativeCornerPaintReady([row([...marker,255],[240,245,249,255])],marker,light),false,'the existing RGB tolerance remains two levels');
});

function staticUIFixture(){
 const viewport={width:40,height:24},reference={width:40,height:24,data:Buffer.alloc(40*24*4)},background={bounds:{x:0,y:18,width:40,height:6},rgb:[255,255,255]},regions=[{label:'owning p1 progress 37%',bounds:{x:1,y:2,width:16,height:12}},{label:'owning p2 progress 64%',bounds:{x:21,y:2,width:16,height:12}}],mapping={scaleX:1,scaleY:1,originX:0,originY:0};
 const fill=(bitmap,box,rgb)=>{for(let y=box.y;y<box.y+box.height;y++)for(let x=box.x;x<box.x+box.width;x++){const i=(y*bitmap.width+x)*4;bitmap.data.set([rgb[2],rgb[1],rgb[0],255],i);}};
 fill(reference,{x:0,y:0,width:40,height:24},[243,245,249]);fill(reference,background.bounds,background.rgb);
 for(const region of regions){const{x,y}=region.bounds;fill(reference,{x:x+1,y:y+1,width:6,height:10},[200,228,215]);fill(reference,{x:x+3,y:y+4,width:8,height:2},[16,21,30]);}
 const clone=()=>({...reference,data:Buffer.from(reference.data)}),check=candidate=>nativeStaticFrameMatch({reference,candidate,viewport,mapping,regions,background});return{reference,viewport,background,regions,mapping,fill,clone,check};
}
test('static native UI requires current-theme display pixels and both actual owning pills',()=>{
 const f=staticUIFixture(),current=f.clone();assert.equal(f.check(current).accepted,true);
 const staleTheme=f.clone();f.fill(staleTheme,f.background.bounds,[16,21,30]);assert.ok(f.check(staleTheme).reasons.includes('native display does not match the current theme'));
 // Actual run119 small/light failure: the p2 rectangle is uniform light --bg,
 // while renderer metadata claims a hit-ready 64% pill.
 const missing=f.clone();f.fill(missing,f.regions[1].bounds,[243,245,249]);const result=f.check(missing);assert.equal(result.accepted,false);assert.equal(result.regions[1].nativeColors,1);assert.ok(result.reasons.some(reason=>reason.includes('p2')&&reason.includes('native UI is not painted')));
});
test('an old shell readback cannot bless an equally old native theme or a missing pill',()=>{
 for(const missing of [false,true]){const f=staticUIFixture();if(missing)f.fill(f.reference,f.regions[1].bounds,[243,245,249]);else f.fill(f.reference,f.background.bounds,[16,21,30]);const result=f.check(f.clone());assert.equal(result.accepted,false);assert.ok(result.reasons.some(reason=>reason.includes(missing?'shell UI is not painted':'shell readback has not painted the current theme')));}
});
test('same-theme stale scroll or text position fails static shell/native pixel agreement',()=>{
 const f=staticUIFixture(),candidate=f.clone();f.fill(candidate,{x:24,y:6,width:8,height:2},[243,245,249]);f.fill(candidate,{x:24,y:9,width:8,height:2},[16,21,30]);const result=f.check(candidate);assert.equal(result.accepted,false);assert.ok(result.regions[1].nativeColors>=3);assert.ok(result.regions[1].mismatched>0);assert.ok(result.regions[1].firstMismatch);assert.equal(result.theme.mismatched,0);
});
test('static pixel comparison preserves fractional source-plane mapping without resizing',()=>{
 const f=staticUIFixture(),mapping={scaleX:1.25,scaleY:1.25,originX:.75,originY:.75},candidate={width:51,height:31,data:Buffer.alloc(51*31*4)};
 for(let y=0;y<f.reference.height;y++)for(let x=0;x<f.reference.width;x++){const px=Math.floor(.75+(x+.5)*1.25),py=Math.floor(.75+(y+.5)*1.25),from=(y*f.reference.width+x)*4,to=(py*candidate.width+px)*4;f.reference.data.copy(candidate.data,to,from,from+4);}
 assert.equal(nativeStaticFrameMatch({...f,candidate,mapping}).accepted,true);assert.throws(()=>nativeStaticFrameMatch({...f,candidate,mapping:{...mapping,originX:100}}),/outside its bitmap/);
});
test('native bitmap readback checks physical BGRA dimensions and the actual representation scale',async()=>{
 const f=staticUIFixture(),calls=[],png=Buffer.alloc(24);png.writeUInt32BE(40,16);png.writeUInt32BE(24,20);const image={getScaleFactors:()=>[1,2],toPNG:options=>{calls.push(['png',options]);return png;},toBitmap:options=>{calls.push(['bitmap',options]);return f.reference.data;}};
 const bitmap=await staticShellReadback({capturePage:async()=>image});assert.deepEqual(calls,[['png',{scaleFactor:2}],['bitmap',{scaleFactor:2}]]);assert.equal(bitmap.width,40);assert.equal(bitmap.height,24);assert.strictEqual(bitmap.data,f.reference.data);assert.throws(()=>nativeBitmap(image,{width:39,height:24}),/bitmap bytes/);assert.throws(()=>nativeBitmap(image,{width:0,height:24}),/bitmap size/);
});
test('fresh native selection accepts a matching first acquisition without a forced discard',async()=>{
 const f=staticUIFixture(),candidate={bitmap:f.clone(),originalPNG:Buffer.from('untouched original')};let captures=0,readbacks=0;
 const result=await acquireFreshNativeFrame({reference:async()=>{readbacks++;return f.reference;},capture:async()=>{captures++;return candidate;},select:(frame,reference)=>nativeStaticFrameMatch({...f,reference,candidate:frame.bitmap})});assert.strictEqual(result.frame,candidate);assert.equal(result.frame.originalPNG.toString(),'untouched original');assert.equal(captures,1);assert.equal(readbacks,1);assert.equal(result.readiness.attempts.length,1);assert.equal(result.readiness.attempts[0].accepted,true);
});
test('fresh native selection rejects wrong theme and absent p2, then returns the exact qualifying frame',async()=>{
 const f=staticUIFixture(),old=f.clone(),missing=f.clone(),current=f.clone();f.fill(old,f.background.bounds,[16,21,30]);f.fill(missing,f.regions[1].bounds,[243,245,249]);const sequence=[old,missing,current],notices=[];let stable=0;
 const result=await acquireFreshNativeFrame({reference:async()=>f.reference,capture:async()=>({bitmap:sequence.shift()}),select:(frame,reference)=>nativeStaticFrameMatch({...f,reference,candidate:frame.bitmap}),assertStable:async()=>{stable++;},onAttempt:state=>notices.push(state)});
 assert.strictEqual(result.frame.bitmap,current);assert.deepEqual(result.readiness.attempts.map(row=>row.accepted),[false,false,true]);assert.equal(stable,9);assert.deepEqual(notices.map(row=>row.attempts.length),[1,2,3]);assert.ok(notices[0].attempts[0].reasons.includes('native display does not match the current theme'));
});
test('native acquisition budget fails with rejected-pixel evidence rather than accepting the last frame',async()=>{
 const f=staticUIFixture(),candidate=f.clone();f.fill(candidate,f.regions[1].bounds,[243,245,249]);let captures=0;
 await assert.rejects(acquireFreshNativeFrame({reference:async()=>f.reference,capture:async()=>{captures++;return candidate;},select:frame=>f.check(frame),maxFrames:2}),error=>{assert.match(error.message,/2 acquisitions/);assert.equal(error.readiness.attempts.length,2);assert.ok(error.readiness.attempts.every(row=>row.accepted===false));assert.strictEqual(error.lastCapture,candidate);return true;});assert.equal(captures,2);
});
test('a stalled native acquisition has a real deadline and never starts another capture',async()=>{
 const f=staticUIFixture();let captures=0;await assert.rejects(acquireFreshNativeFrame({reference:async()=>f.reference,capture:async()=>{captures++;return new Promise(()=>{});},select:()=>({accepted:true}),timeoutMs:5}),error=>{assert.match(error.message,/timed out/);assert.deepEqual(error.readiness.attempts,[]);return true;});assert.equal(captures,1);
});
test('a stability barrier that resolves after the deadline cannot start readback, capture or selection',async()=>{
 for(const blocked of [1,2,3]){
  const f=staticUIFixture();let stable=0,readbacks=0,captures=0,selections=0,release;
  const barrier=new Promise(resolve=>{release=resolve;}),pending=acquireFreshNativeFrame({assertStable:async()=>{if(++stable===blocked)await barrier;},reference:async()=>{readbacks++;return f.reference;},capture:async()=>{captures++;return f.clone();},select:frame=>{selections++;return f.check(frame);},timeoutMs:5});
  await assert.rejects(pending,/timed out/);release();await new Promise(resolve=>setImmediate(resolve));assert.equal(readbacks,blocked===1?0:1);assert.equal(captures,blocked===3?1:0);assert.equal(selections,0);
 }
});
test('synchronous pixel selection cannot accept after the deadline while its timer is blocked',async()=>{
 const f=staticUIFixture();await assert.rejects(acquireFreshNativeFrame({reference:async()=>f.reference,capture:async()=>f.clone(),select:frame=>{const until=performance.now()+15;while(performance.now()<until){}return f.check(frame);},timeoutMs:10}),error=>{assert.match(error.message,/timed out/);assert.ok(error.readiness.elapsedMs>=10);assert.deepEqual(error.readiness.attempts,[]);return true;});
});
test('changed live UI and asynchronous selectors never certify a native frame',async()=>{
 const f=staticUIFixture();let stable=0;await assert.rejects(acquireFreshNativeFrame({reference:async()=>f.reference,capture:async()=>f.clone(),select:frame=>f.check(frame),assertStable:async()=>{if(++stable===3)throw Error('theme changed during capture');}}),error=>{assert.match(error.message,/theme changed/);assert.deepEqual(error.readiness.attempts,[]);return true;});
 await assert.rejects(acquireFreshNativeFrame({reference:async()=>f.reference,capture:async()=>f.clone(),select:async()=>({accepted:true})}),/synchronous pixel evidence/);
});
