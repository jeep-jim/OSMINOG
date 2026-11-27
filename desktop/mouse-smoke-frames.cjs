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
// A restored WebContents can finish a failed navigation before its native
// widget has presented even one frame. A restart persistence fixture must
// observe that first presentation before testing a subsequent UI action.
// This never changes a page, asks production to capture it, or opens the UI.
async function observeNativePagePresentations(pages,{current,timeoutMs=4000}={}){
 if(!Array.isArray(pages)||pages.length>16||typeof current!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid restored page observation');
 if(new Set(pages.map(page=>page.id)).size!==pages.length||new Set(pages.map(page=>page.contents)).size!==pages.length||pages.some(page=>!page.id||!page.contents||!['width','height'].every(key=>Number.isSafeInteger(page.viewport?.[key])&&page.viewport[key]>0)))throw Error('Invalid restored page identities or viewport');
 const captures=[],deadline=performance.now()+timeoutMs;
 const live=()=>{if(performance.now()>=deadline)throw Error('Restored page presentation timed out');};
 const check=page=>{live();const same=current(page)===true;live();if(!same)throw Error('Restored page changed before its first presentation: '+page.id);};
 try{
  for(const page of pages){
   check(page);
   const capture=armFrameCapture(page.contents,{timeoutMs:Math.max(1,deadline-performance.now()),select(image,frame){
    check(page);
    if(image.isEmpty?.()||frame.pixelSize.width!==Math.round(page.viewport.width*frame.scaleFactor)||frame.pixelSize.height!==Math.round(page.viewport.height*frame.scaleFactor))return null;
    return{id:page.id,webContentsId:page.contents.id,viewport:{...page.viewport}};
   }});
   captures.push({page,capture});
  }
  const frames=await Promise.all(captures.map(async({page,capture})=>{const frame=await capture.result;check(page);return{id:page.id,...frame};}));
  for(const page of pages)check(page);
  return frames;
 }finally{for(const {capture}of captures)capture.cancel();}
}
// Static chrome needs a different proof from the moving-frame selector above.
// desktopCapturer returns asynchronously prepared source thumbnails; a DOM/RAF
// observation does not bind that thumbnail to the current shell presentation.
// Compare only static shell UI (never guest page pixels) with an actual shell
// readback, and require the current opaque theme colour in the real display.
function nativeBitmap(image,pixelSize,scaleFactor=1){
 if(!pixelSize||!['width','height'].every(key=>Number.isInteger(pixelSize[key])&&pixelSize[key]>0))throw Error('Invalid native UI bitmap size');
 const data=image.toBitmap({scaleFactor});if(!Buffer.isBuffer(data)||data.length!==pixelSize.width*pixelSize.height*4)throw Error('Invalid native UI bitmap bytes');
 return{...pixelSize,data};
}
async function staticShellReadback(contents){
 const image=await contents.capturePage(),scales=image.getScaleFactors?.()||[1];if(!scales.length||scales.some(n=>!Number.isFinite(n)||n<=0))throw Error('Invalid static shell readback scale');
 const scaleFactor=Math.max(...scales),png=image.toPNG({scaleFactor}),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};return{...nativeBitmap(image,pixelSize,scaleFactor),png};
}
function staticThemeProbe(scope=globalThis){
 // The display compositor can shade the bottom footer with the Dock's shadow
 // and clip its outer window corners. The existing new-tab button supplies an
 // opaque --panel surface inside the top chrome, without adding test paint.
 const backgroundAlpha=css=>{const match=/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i.exec(String(css).trim());if(!match||!match.slice(1,4).map(Number).every(n=>Number.isInteger(n)&&n>=0&&n<=255))return NaN;const alpha=match[4]===undefined?1:Number(match[4]);return alpha>=0&&alpha<=1?alpha:NaN;};
 const inset=4,dataset=scope.document.documentElement.dataset;let selector='.toolbar>#new-tab',source='computed opaque toolbar button',e=scope.document.querySelector(selector);if(!e)throw Error('Static theme button is missing');
 let style=scope.getComputedStyle(e);
 // A custom Mac header intentionally gives its ordinary controls translucent
 // paint. Its actual active tab keeps the opaque root theme surface instead.
 // This is a different existing control, never a composited colour estimate.
 if(dataset.platform==='darwin'&&dataset.surfaceTop==='custom'&&backgroundAlpha(style.backgroundColor)<1){selector='.toolbar #tabstrip .tab-item.active';source='computed opaque active toolbar tab';e=scope.document.querySelector(selector);if(!e)throw Error('Static theme active tab is missing');style=scope.getComputedStyle(e);}
 const r=e.getBoundingClientRect(),elementBounds={x:r.x,y:r.y,width:r.width,height:r.height};
 if(!Object.values(elementBounds).every(Number.isFinite)||r.width<=inset*2||r.height<=inset*2||r.x<0||r.y<0||r.x+r.width>scope.innerWidth||r.y+r.height>scope.innerHeight||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)!==1||style.backgroundImage!=='none'||backgroundAlpha(style.backgroundColor)!==1)throw Error('Static theme button must be visible opaque chrome inside the viewport');
 const bounds={x:r.x+inset,y:r.y+inset,width:r.width-inset*2,height:r.height-inset*2},points=[[bounds.x+.5,bounds.y+.5],[bounds.x+bounds.width-.5,bounds.y+.5],[bounds.x+.5,bounds.y+bounds.height-.5],[bounds.x+bounds.width-.5,bounds.y+bounds.height-.5],[bounds.x+bounds.width/2,bounds.y+bounds.height/2]];
 if(!points.every(([x,y])=>{const hit=scope.document.elementFromPoint(x,y);return hit===e||e.contains(hit);}))throw Error('Static theme button is covered or clipped');
 return{source,selector,theme:dataset.theme,elementBounds,inset,bounds,css:style.backgroundColor};
}
function nativeStaticFrameMatch({reference,candidate,viewport,mapping,regions,background}){
 const validBitmap=bitmap=>bitmap&&Number.isInteger(bitmap.width)&&bitmap.width>0&&Number.isInteger(bitmap.height)&&bitmap.height>0&&Buffer.isBuffer(bitmap.data)&&bitmap.data.length===bitmap.width*bitmap.height*4;
 if(!validBitmap(reference)||!validBitmap(candidate)||!viewport||!['width','height'].every(key=>Number.isFinite(viewport[key])&&viewport[key]>0)||!mapping||!['scaleX','scaleY','originX','originY'].every(key=>Number.isFinite(mapping[key]))||mapping.scaleX<=0||mapping.scaleY<=0)throw Error('Invalid static native UI mapping');
 if(!Array.isArray(regions)||!regions.length||!background||!Array.isArray(background.rgb)||background.rgb.length!==3||background.rgb.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('Static native UI regions and current theme are required');
 const sx=reference.width/viewport.width,sy=reference.height/viewport.height,pixel=(bitmap,x,y)=>{if(x<0||y<0||x>=bitmap.width||y>=bitmap.height)throw Error('Static native UI sample lies outside its bitmap');const i=(y*bitmap.width+x)*4;return[bitmap.data[i+2],bitmap.data[i+1],bitmap.data[i],bitmap.data[i+3]];},close=(a,b)=>a[3]===255&&b[3]===255&&a.slice(0,3).every((value,i)=>Math.abs(value-b[i])<=2);
 const scan=(bounds,visit,inset=0)=>{
  if(!bounds||!['x','y','width','height'].every(key=>Number.isFinite(bounds[key]))||bounds.width<=0||bounds.height<=0||bounds.x<0||bounds.y<0||bounds.x+bounds.width>viewport.width+.01||bounds.y+bounds.height>viewport.height+.01)throw Error('Static native UI region lies outside its viewport');
  const trim=Math.min(inset,bounds.width/4,bounds.height/4),left=Math.ceil((bounds.x+trim)*sx),top=Math.ceil((bounds.y+trim)*sy),right=Math.floor((bounds.x+bounds.width-trim)*sx),bottom=Math.floor((bounds.y+bounds.height-trim)*sy);
  if(right<=left||bottom<=top)throw Error('Static native UI region has no physical pixels');
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const css={x:(x+.5)/sx,y:(y+.5)/sy},actual={x:Math.floor(mapping.originX+css.x*mapping.scaleX),y:Math.floor(mapping.originY+css.y*mapping.scaleY)};
   visit(pixel(reference,x,y),pixel(candidate,actual.x,actual.y),{reference:{x,y},actual,css});
  }
 };
 const expected=[...background.rgb,255],theme={bounds:{...background.bounds},css:String(background.css||''),rgb:background.rgb.slice(),referencePixels:0,mismatched:0,minimum:0};let themeArea=0;
 scan(background.bounds,(a,b)=>{themeArea++;if(close(a,expected)){theme.referencePixels++;if(!close(b,expected))theme.mismatched++;}});
 theme.minimum=Math.max(16,Math.ceil(themeArea/4));
 const observations=regions.map(region=>{
  const aColors=new Set(),bColors=new Set(),row={label:String(region.label),bounds:{...region.bounds},compared:0,mismatched:0,referenceColors:0,nativeColors:0};
  scan(region.bounds,(a,b,point)=>{row.compared++;if(aColors.size<3)aColors.add(a.join(','));if(bColors.size<3)bColors.add(b.join(','));if(!close(a,b)){row.mismatched++;if(!row.firstMismatch)row.firstMismatch={...point,referenceRGBA:a,nativeRGBA:b};}},1);
  row.referenceColors=aColors.size;row.nativeColors=bColors.size;return row;
 });
 const reasons=[];if(theme.referencePixels<theme.minimum)reasons.push('shell readback has not painted the current theme');if(theme.mismatched)reasons.push('native display does not match the current theme');
 for(const row of observations){if(row.referenceColors<3)reasons.push(row.label+': shell UI is not painted');if(row.nativeColors<3)reasons.push(row.label+': native UI is not painted');if(row.mismatched)reasons.push(row.label+': native pixels differ from the current static shell readback');}
 return{accepted:reasons.length===0,reasons,theme,regions:observations,tolerance:2};
}
async function acquireFreshNativeFrame({reference,capture,select,assertStable=async()=>{},onAttempt=()=>{},timeoutMs=4000,maxFrames=20}={}){
 if(![reference,capture,select,assertStable,onAttempt].every(fn=>typeof fn==='function')||!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isInteger(maxFrames)||maxFrames<=0)throw Error('Invalid fresh native frame capture');
 const started=performance.now(),attempts=[];let lastCapture,lastReference,timer,finished=false;
 const readiness=(at=performance.now())=>({source:'current static shell readback matched to native display pixels',timeoutMs,maxFrames,elapsedMs:at-started,attempts:attempts.slice()});
 const failure=message=>Object.assign(Error(message),{readiness:readiness(),lastCapture,lastReference});
 const requireLive=(at=performance.now())=>{if(finished||at-started>=timeoutMs)throw failure('Fresh native UI capture timed out');};
 const run=async()=>{
  for(let sequence=1;sequence<=maxFrames&&!finished;sequence++){
   await assertStable();requireLive();lastReference=await reference();requireLive();await assertStable();requireLive();lastCapture=await capture();requireLive();await assertStable();requireLive();
   const result=select(lastCapture,lastReference);if(!result||typeof result!=='object'||typeof result.then==='function'||typeof result.accepted!=='boolean')throw Error('Fresh native frame selector must return synchronous pixel evidence');
   const selectedAt=performance.now();requireLive(selectedAt);attempts.push({sequence,elapsedMs:selectedAt-started,...result});onAttempt(readiness(selectedAt));
   if(result.accepted){const acceptedAt=performance.now();requireLive(acceptedAt);return{frame:lastCapture,reference:lastReference,readiness:readiness(acceptedAt)};}
  }
  throw failure('No matching native UI frame in '+maxFrames+' acquisitions');
 };
 try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>{finished=true;reject(failure('Fresh native UI capture timed out after '+timeoutMs+'ms'));},timeoutMs);})]);}
 catch(error){if(!error.readiness)Object.assign(error,{readiness:readiness(),lastCapture,lastReference});throw error;}
 finally{finished=true;clearTimeout(timer);}
}
module.exports={armFrameCapture,observeNativePagePresentations,nativeBitmap,staticShellReadback,staticThemeProbe,nativeStaticFrameMatch,acquireFreshNativeFrame};
