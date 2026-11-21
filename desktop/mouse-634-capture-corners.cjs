'use strict';
// Installed capture acceptance. The saved canvas is the real browser capture
// opened by native input; before/after images come from the OS compositor.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createHash}=require('node:crypto');
const GAP=6,RADIUS=12,TOLERANCE=3;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const right=rect=>rect.x+rect.width,bottom=rect=>rect.y+rect.height;
const sameBox=(a,b)=>['x','y','width','height'].every(key=>a[key]===b[key]);
function rgb(css){
 const value=String(css).trim(),hex=/^#([a-f0-9]{6})$/i.exec(value),functional=/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*(1))?\s*\)$/.exec(value);
 const color=hex?[0,2,4].map(offset=>parseInt(hex[1].slice(offset,offset+2),16)):functional?functional.slice(1,4).map(Number):null;
 assert.ok(color&&color.every(channel=>channel>=0&&channel<=255),'Opaque fixture/theme RGB is required: '+value);return color;
}
// Serialised into the trusted shell only. This reads the measured geometry;
// it never changes a stylesheet, calls a click handler, or paints test pixels.
function captureReadback(targets){
 const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const radii=node=>{const style=getComputedStyle(node);return['TopLeft','TopRight','BottomRight','BottomLeft'].map(corner=>parseFloat(style['border'+corner+'Radius']));};
 const workspace=document.querySelector('#workspace'),style=getComputedStyle(workspace),root=getComputedStyle(document.documentElement);
 return{theme:MouseTest.model.theme,viewport:{width:innerWidth,height:innerHeight},workspace:rect(workspace),padding:Object.fromEntries(['Top','Right','Bottom','Left'].map(side=>[side.toLowerCase(),parseFloat(style['padding'+side])])),line:style.backgroundColor,panel:root.getPropertyValue('--panel').trim(),focusPane:MouseTest.model.focusPane||'',focusAI:!!MouseTest.model.focusAI,targets:targets.map(target=>{const pane=document.querySelector(target.paneSelector),slot=document.querySelector(target.slotSelector);return{...target,pane:rect(pane),slot:rect(slot),paneRadii:radii(pane),slotRadii:radii(slot),hidden:pane.hidden||slot.hidden};})};
}
function validateGeometry(geometry,native){
 assert.deepEqual(geometry.padding,{top:GAP,right:0,bottom:GAP,left:0});assert.equal(geometry.focusPane,'');assert.equal(geometry.focusAI,false);
 assert.equal(geometry.workspace.x,0);assert.ok(Math.abs(right(geometry.workspace)-geometry.viewport.width)<=1/16);
 assert.equal(native.length,geometry.targets.length);assert.equal(new Set(native.map(page=>page.id)).size,native.length);
 for(const target of geometry.targets){
  assert.equal(target.hidden,false);assert.equal(target.paneRadii[0],RADIUS);assert.equal(target.paneRadii[1],RADIUS);
  const page=native.find(value=>value.id===target.id);assert.ok(page&&page.visible&&page.viewVisible&&page.parentVisible&&page.attached,'Every target is an actual visible native page');
  const expected={x:Math.round(target.slot.x),y:Math.round(target.slot.y),width:Math.round(right(target.slot))-Math.round(target.slot.x),height:Math.round(bottom(target.slot))-Math.round(target.slot.y)};
  assert.deepEqual(page.bounds,expected);assert.deepEqual(page.actualBounds,expected);assert.deepEqual(page.clip,expected);assert.equal(page.roundBottom,RADIUS,'This fixture is the ordinary, unfocused workspace');
  assert.ok(page.bounds.width>2*RADIUS&&page.bounds.height>2*RADIUS);assert.ok(target.pane.y<target.slot.y);assert.ok(target.pane.y>=geometry.workspace.y+GAP-1/16);
 }
 const chat=geometry.targets.find(target=>target.role==='ai-chat'),preview=geometry.targets.find(target=>target.role==='ai-preview');
 if(chat&&preview){assert.ok(Math.abs(preview.pane.y-bottom(chat.pane)-GAP)<=1/16);assert.ok(Math.abs(chat.pane.x-preview.pane.x)<=1/16);assert.ok(Math.abs(right(preview.pane)-geometry.viewport.width)<=1/16);}
 return true;
}
function capturePoints(geometry,native){
 const points=[],line=rgb(geometry.line),panel=rgb(geometry.panel),workspace=geometry.workspace;
 const add=(kind,cssPoint,expectedRGB,extra={})=>points.push({kind,...extra,cssPoint,expectedRGB});
 for(const edge of ['top','bottom'])for(const fraction of [.2,.5,.8])add('workspace-gap',{x:workspace.x+workspace.width*fraction,y:edge==='top'?workspace.y+GAP/2:bottom(workspace)-GAP/2},line,{edge});
 for(const target of geometry.targets){const pane=target.pane,page=native.find(value=>value.id===target.id),box=page.clip;
  for(const side of ['left','right']){
   for(const u of [.65,1.6])for(const v of [.65,1.6]){
    add('pane-top-cutout',{x:side==='left'?pane.x+u:right(pane)-u,y:pane.y+v},line,{id:target.id,side});
    add('page-bottom-cutout',{x:side==='left'?box.x+u:right(box)-u,y:bottom(box)-v},line,{id:target.id,side});
   }
   add('pane-top-interior',{x:side==='left'?Math.ceil(pane.x+RADIUS)+.5:Math.floor(right(pane)-RADIUS)-.5,y:Math.ceil(pane.y)+.5},panel,{id:target.id,side});
   add('page-bottom-interior',{x:side==='left'?box.x+RADIUS+3.5:right(box)-RADIUS-3.5,y:bottom(box)-3.5},target.backgroundRGB,{id:target.id,side});
  }
 }
 const chat=geometry.targets.find(target=>target.role==='ai-chat'),preview=geometry.targets.find(target=>target.role==='ai-preview');
 if(chat&&preview)for(const fraction of [.2,.5,.8])add('ai-split-gap',{x:chat.pane.x+chat.pane.width*fraction,y:bottom(chat.pane)+GAP/2},line);
 return points;
}
function samplePixels(bitmap,size,mapping,points){
 assert.equal(bitmap.length,size.width*size.height*4);assert.ok([mapping.scaleX,mapping.scaleY,mapping.originX,mapping.originY].every(Number.isFinite));assert.ok(mapping.scaleX>0&&mapping.scaleY>0);
 return points.map(point=>{const pixel={x:Math.floor(mapping.originX+point.cssPoint.x*mapping.scaleX),y:Math.floor(mapping.originY+point.cssPoint.y*mapping.scaleY)};assert.ok(pixel.x>=0&&pixel.y>=0&&pixel.x<size.width&&pixel.y<size.height,'Pixel probe is inside the actual PNG');const offset=(pixel.y*size.width+pixel.x)*4,actualRGBA=[bitmap[offset+2],bitmap[offset+1],bitmap[offset],bitmap[offset+3]];return{...point,pixel,actualRGBA,tolerance:TOLERANCE};});
}
function assertPixels(probes,label){
 const failure=probes.find(probe=>probe.actualRGBA[3]!==255||probe.expectedRGB.some((value,index)=>Math.abs(value-probe.actualRGBA[index])>probe.tolerance));
 assert.ok(!failure,label+' actual corner/gap pixels: '+JSON.stringify(failure));
}
// One absolute deadline covers presentation, acquisition and validation. A
// late acquisition may resolve, but its guard prevents it from writing pixels
// or adding an accepted receipt after the caller has already timed out.
async function withinCaptureDeadline(deadline,work,now=()=>performance.now()){
 assert.ok(Number.isFinite(deadline));let timer,finished=false;
 const live=()=>{if(finished||now()>=deadline)throw Error('Capture readiness deadline exceeded');};
 try{
  live();return await Promise.race([(async()=>{live();const value=await work(live);live();return value;})(),new Promise((_,reject)=>{timer=setTimeout(()=>{finished=true;reject(Error('Capture readiness deadline exceeded'));},Math.max(0,deadline-now()));})]);
 }finally{finished=true;clearTimeout(timer);}
}
async function waitForClearCapture({capture,inspect,stable,deadline=Infinity,onAttempt=()=>{},now=()=>performance.now()}){
 const started=now(),limit=Math.min(deadline,started+4500),readiness={source:'actual OS corner pixels after trusted pointer park',startedAt:Date.now(),finishedAt:null,budgetMs:4500,maxAttempts:20,timeoutMs:Math.max(0,limit-started),elapsedMs:0,acceptedIndex:null,attempts:[]};
 onAttempt(readiness);
 try{
  const selected=await withinCaptureDeadline(limit,async live=>{
   for(let sequence=1;sequence<=20;sequence++){
    const before=await stable();live();
    const current=await capture(sequence,limit);live();
    const attempt={...current,sequence,elapsedMs:now()-started,accepted:false,probes:[],failedProbes:[],before};readiness.attempts.push(attempt);onAttempt(readiness);
    attempt.after=await stable();live();
    attempt.probes=await inspect(current);live();assert.equal(attempt.probes.length,89,'All unchanged corner probes are required');assert.ok(attempt.probes.every(probe=>probe.tolerance===TOLERANCE),'Corner pixel tolerance stays unchanged');
    attempt.failedProbes=attempt.probes.filter(probe=>probe.actualRGBA[3]!==255||probe.expectedRGB.some((value,index)=>Math.abs(value-probe.actualRGBA[index])>probe.tolerance));
    attempt.after=await stable();live();attempt.elapsedMs=now()-started;
    attempt.accepted=attempt.failedProbes.length===0;attempt.reason=attempt.accepted?'all unchanged corner probes match':'native corner pixels do not match';onAttempt(readiness);
    if(attempt.accepted){readiness.acceptedIndex=readiness.attempts.length-1;return{capture:current,probes:attempt.probes,after:attempt.after};}
   }
   assertPixels(readiness.attempts.at(-1).probes,'No clear frame in 20 native acquisitions');throw Error('No clear native capture');
  },now);
  return{...selected,readiness};
 }catch(error){readiness.error={message:error.message};const pending=readiness.attempts.at(-1);if(pending&&!pending.reason)pending.error={message:error.message};throw Object.assign(error,{readiness});}
 finally{readiness.finishedAt=Date.now();readiness.elapsedMs=now()-started;onAttempt(readiness);}
}
function nativeState(browser,win,targets){
 return targets.map(target=>{const page=browser.get(target.id),view=page.view.getBounds(),parent=page.clipView?.getBounds()||null,root=page.clipView||page.view;return{id:page.id,webContentsId:page.view.webContents.id,bounds:{...page.bounds},actualBounds:{x:view.x+(parent?.x||0),y:view.y+(parent?.y||0),width:view.width,height:view.height},clip:{...page.captureGeometry?.clip},roundBottom:page.captureGeometry?.roundBottom,visible:page.visible===true,viewVisible:page.view.getVisible(),parentVisible:page.clipView?.getVisible()??true,attached:win.contentView.children.includes(root)};});
}
// Native close leaves the pointer where the editor's titled button was. A
// platform tooltip can outlive the dialog and shade the restored pane corner.
// Move onto the existing empty workspace gap; never hide UI or change pixels.
function installCapturePointerProbe(point){
 const workspace=document.querySelector('#workspace'),target=document.elementFromPoint(point.x,point.y);
 if(!workspace||target!==workspace||target.closest('[title]'))throw Error('Capture pointer target must be the untitled workspace gap');
 globalThis.__mouse634CapturePointer?.dispose();let event=null;
 const move=e=>{if(e.target===workspace)event={type:e.type,trusted:e.isTrusted,x:e.clientX,y:e.clientY,target:e.target.id};};
 document.addEventListener('pointermove',move,true);
 globalThis.__mouse634CapturePointer={read:()=>event,dispose(){document.removeEventListener('pointermove',move,true);delete globalThis.__mouse634CapturePointer;}};
}
async function parkCapturePointer(fixture,win,geometry){
 const cssPoint={x:Math.round(geometry.workspace.x+geometry.workspace.width*.375),y:Math.round(geometry.workspace.y+GAP/2)},origin=win.getContentBounds(),point={x:origin.x+cssPoint.x,y:origin.y+cssPoint.y};
 await fixture.js(`(${installCapturePointerProbe.toString()})(${JSON.stringify(cssPoint)})`);
 try{
  const native=await fixture.nativeInput.testPointer(point.x,point.y);assert.equal(native.warpResult,0);assert.equal(native.postAccess,true);let event;
  await fixture.until(async()=>{event=await fixture.js('__mouse634CapturePointer.read()');return event?.trusted===true&&event.target==='workspace'&&event.x===cssPoint.x&&event.y===cssPoint.y;},'634 native pointer leaves capture-close tooltip',2000);
  await fixture.frame();return{cssPoint,point,native,event};
 }finally{await fixture.js('globalThis.__mouse634CapturePointer?.dispose()');}
}
async function runCaptureCorners({win,browser,overlayGate,fixture,click,screenCapture,targets}){
 const {nativeImage}=require('electron'),facts={schema:1,ok:false,source:'Native screenshot-button input, actual composed editor canvas and OS before/after captures',physicalUserDeviceVerified:false,radius:RADIUS,gap:GAP,targets:structuredClone(targets),scenes:[],captures:[],identityRestored:false};
 assert.ok(Array.isArray(targets)&&targets.length>0&&new Set(targets.map(target=>target.id)).size===targets.length);
 const records=targets.map(target=>{const record=fixture.records.find(value=>value.id===target.id);assert.ok(record,'Every target belongs to the owned native fixture');return record;}),originalTheme=await fixture.js('MouseTest.model.theme');
 const identities=()=>Promise.all(records.map(async record=>({...await fixture.identity(record),raf:await fixture.pageJS(record,'mouse634.raf')})));
 const geometry=()=>fixture.js(`(${captureReadback.toString()})(${JSON.stringify(targets)})`);
 async function readPixels(capture,points,phase,theme){
  const bytes=await fs.readFile(capture.filename);assert.equal(sha256(bytes),capture.sha256);assert.equal(bytes.length,capture.bytes);
  const pixelSize={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};assert.deepEqual(pixelSize,capture.pixelSize);
  const decoded=nativeImage.createFromBuffer(bytes);assert.equal(decoded.isEmpty(),false);const probes=samplePixels(decoded.toBitmap({scaleFactor:1}),pixelSize,capture.mapping,points);return{...capture,phase,theme,probes};
 }
 async function pixels(capture,points,phase,theme){
  const result=await readPixels(capture,points,phase,theme);facts.captures.push(result);assertPixels(result.probes,theme+' '+phase);return result;
 }
 try{
  for(const theme of ['light','dark']){
   const scene={theme,stage:'before'};facts.scenes.push(scene);
   if(await fixture.js('MouseTest.model.theme')!==theme)scene.themeInput=await click('#statusbar [data-action="theme"]');
   await fixture.until(()=>fixture.js('MouseTest.model.theme==='+JSON.stringify(theme)),'634 capture theme '+theme);await fixture.frame();
   assert.equal(overlayGate.blocked,false);scene.before={geometry:await geometry(),native:nativeState(browser,win,targets),identities:await identities()};validateGeometry(scene.before.geometry,scene.before.native);
   const points=capturePoints(scene.before.geometry,scene.before.native),prefix='mouse-634-capture-corners-'+theme;
   scene.before.capture=(await pixels(await screenCapture(prefix+'-before.png','634 corners before browser capture'),points,'before',theme)).filename;
   scene.stage='open';scene.openInput=await click('#screenshot-button');
   await fixture.until(()=>fixture.js('MouseTest.capture.isOpen()&&document.querySelector("#capture-dialog").open&&document.querySelector("#capture-canvas").width>1'),'634 actual capture editor opens',15000);
   assert.equal(overlayGate.blocked,true);scene.during={native:nativeState(browser,win,targets),overlayBlocked:overlayGate.blocked};assert.ok(scene.during.native.every(page=>!page.visible&&!page.viewVisible&&!page.attached),'Only the real capture editor holds native pages');
   const canvas=await fixture.js('({src:document.querySelector("#capture-canvas").toDataURL("image/png"),width:document.querySelector("#capture-canvas").width,height:document.querySelector("#capture-canvas").height})'),bytes=Buffer.from(canvas.src.slice(canvas.src.indexOf(',')+1),'base64');
   assert.ok(bytes.length>24&&bytes.length<=32*1024*1024);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),canvas.width);assert.equal(bytes.readUInt32BE(20),canvas.height);
   const filename=prefix+'-composed.png',viewport=scene.before.geometry.viewport;await fs.writeFile(filename,bytes);
   const composed={filename,kind:'634 actual composed browser screenshot',source:'capture-dialog #capture-canvas.toDataURL after native screenshot-button click',sha256:sha256(bytes),bytes:bytes.length,pixelSize:{width:canvas.width,height:canvas.height},viewport,mapping:{scaleX:canvas.width/viewport.width,scaleY:canvas.height/viewport.height,originX:0,originY:0}};
   scene.composed=(await pixels(composed,points,'composed',theme)).filename;
   scene.stage='close';scene.closeInput=await click('#capture-close');
   await fixture.until(()=>!overlayGate.blocked&&records.every(record=>record.page.visible&&record.page.view.getVisible()),'634 same native pages restored after capture');
   scene.pointerAfterClose=await parkCapturePointer(fixture,win,scene.before.geometry);
   await fixture.until(async()=>{const after=await identities();return after.every((row,index)=>row.raf>scene.before.identities[index].raf);},'634 live page animation resumes after capture');await fixture.frame();
   scene.after={geometry:await geometry(),native:nativeState(browser,win,targets),identities:await identities()};validateGeometry(scene.after.geometry,scene.after.native);
   assert.deepEqual(scene.after.geometry,scene.before.geometry,'Capture and close preserve all DOM workspace gaps and corners');assert.deepEqual(scene.after.native,scene.before.native,'Capture and close restore the same native owners, bounds and masks');
   scene.before.identities.forEach((before,index)=>fixture.assertIdentity(before,scene.after.identities[index]));
   const stable=async()=>{
    assert.equal(overlayGate.blocked,false,'Capture overlay stays closed during native readiness');
    const state={geometry:await geometry(),native:nativeState(browser,win,targets),identities:await identities()};validateGeometry(state.geometry,state.native);
    assert.deepEqual(state.geometry,scene.before.geometry,'Capture readiness cannot change DOM geometry');assert.deepEqual(state.native,scene.before.native,'Capture readiness cannot change native owners or masks');
    scene.before.identities.forEach((before,index)=>{fixture.assertIdentity(before,state.identities[index]);assert.ok(state.identities[index].raf>before.raf,'Live page animation stays resumed');});return state;
   };
   const selected=await waitForClearCapture({deadline:fixture.deadline,stable,
    capture:(sequence,deadline)=>screenCapture(prefix+'-after-attempt-'+sequence+'.png','634 corners after browser capture',{deadline}),
    inspect:async capture=>(await readPixels(capture,points,'after',theme)).probes,
    onAttempt:readiness=>{scene.after.readiness=readiness;}
   });
   // Keep every rejected OS frame. The accepted bytes become the existing
   // canonical filename; the owner ledger holds this same capture object.
   const capture=selected.capture,afterFilename=prefix+'-after.png',afterDisplayFilename=prefix+'-after-display.png';
   await fs.rename(capture.filename,afterFilename);await fs.rename(capture.displayFilename,afterDisplayFilename);Object.assign(capture,{filename:afterFilename,displayFilename:afterDisplayFilename});
   Object.assign(selected.readiness.attempts[selected.readiness.acceptedIndex],capture);
   facts.captures.push({...capture,phase:'after',theme,probes:selected.probes});assertPixels(selected.probes,theme+' after');
   scene.after={...selected.after,readiness:selected.readiness,capture:afterFilename};
   scene.preserved=true;scene.stage='complete';
  }
  facts.identityRestored=true;facts.ok=true;console.log('MOUSE_634_CAPTURE_CORNERS_PASS');return facts;
 }catch(error){facts.error={message:error.message,stack:error.stack};await fs.writeFile('mouse-634-capture-corners-failure.json',JSON.stringify(facts,null,2)+'\n');throw error;}
 finally{
  if(await fixture.js('MouseTest.capture.isOpen()').catch(()=>false))await fixture.js('document.querySelector("#capture-dialog").close()').catch(()=>{});
  if(await fixture.js('MouseTest.model.theme').catch(()=>originalTheme)!==originalTheme)await fixture.js('MouseTest.setTheme('+JSON.stringify(originalTheme)+')').catch(()=>{});
 }
}
module.exports=Object.assign(runCaptureCorners,{captureReadback,validateGeometry,capturePoints,samplePixels,assertPixels,installCapturePointerProbe,parkCapturePointer,withinCaptureDeadline,waitForClearCapture});
