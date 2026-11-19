'use strict';
// Native packaged proof: two retained local pages, simultaneous compositor
// surfaces, and an actual delayed layout IPC acknowledgement.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {nativeImage}=require('electron');
const {armFrameCapture}=require('./mouse-smoke-frames.cjs');
const {bounded}=require('./mouse-smoke-trace.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const BAND_ID='mouse627-native-transition-band',BAND_COLORS=[[199,37,77],[29,125,220]];
async function prepareVisiblePage({browser,id,index}){
 assert.ok(Number.isInteger(index)&&index>=0&&index<BAND_COLORS.length);const page=browser.get(id),wc=page?.view.webContents;assert.ok(wc&&!wc.isDestroyed());
 const startedAt=performance.now(),budget=operation=>bounded(operation,Math.max(1,4000-(performance.now()-startedAt)),'Visible transition fixture preparation');
 const native=()=>({selectedDesktop:browser.mouseDesktops.bank.active,logicalVisible:!!page.visible,nativeVisible:page.view.getVisible(),clipVisible:page.clipView?.getVisible?.()??true,webContentsId:wc.id,epoch:page.navigationEpoch||0,url:wc.getURL(),bounds:page.view.getBounds(),surfaceBounds:page.bounds,held:!!browser.mouseSurfaceHold});
 const before=native();assert.equal(before.logicalVisible,true);assert.equal(before.nativeVisible,true);assert.equal(before.clipVisible,true);assert.equal(before.held,false);
 const original=await budget(()=>wc.executeJavaScript('({minHeight:document.body.style.minHeight,scrollX,scrollY})')),row={id,index,original,native:before,startedAt,mainTimeOrigin:performance.timeOrigin,attempts:[],ready:false};let lastImage,lastScale=1;
 try{
  await budget(()=>wc.executeJavaScript('(()=>{if(document.getElementById('+JSON.stringify(BAND_ID)+'))throw Error("Transition band already exists");document.body.style.minHeight="2400px";scrollTo(0,137);const band=document.createElement("div");band.id='+JSON.stringify(BAND_ID)+';band.setAttribute("aria-hidden","true");band.style.cssText="position:fixed;inset:0 0 auto;height:8px;z-index:2147483647;pointer-events:none;background:rgb('+BAND_COLORS[index].join(',')+');";document.body.append(band);})()'));
  for(let attempt=1;attempt<=8;attempt++){
   assert.ok(performance.now()-startedAt<4000,'Visible transition fixture preparation exceeds its budget');assert.deepEqual(native(),before,'Fixture stays visible in the same native viewport before capture');
   const dom=await budget(()=>wc.executeJavaScript('new Promise(resolve=>requestAnimationFrame(first=>requestAnimationFrame(second=>{const e=document.getElementById('+JSON.stringify(BAND_ID)+'),r=e.getBoundingClientRect(),d=document.querySelector("#drop"),q=d.getBoundingClientRect(),x=Math.floor((Math.max(0,q.left)+Math.min(innerWidth,q.right))/2),y=Math.floor((Math.max(0,q.top)+Math.min(innerHeight,q.bottom))/2);resolve({timeOrigin:performance.timeOrigin,at:performance.now(),rafs:[first,second],width:innerWidth,height:innerHeight,scrollX,scrollY,band:{x:r.x,y:r.y,width:r.width,height:r.height,color:getComputedStyle(e).backgroundColor},scrollProbe:{x,y,hit:document.elementFromPoint(x,y)===d,color:getComputedStyle(d).backgroundColor}});})))'));
   assert.equal(dom.scrollX,0);assert.equal(dom.scrollY,137);assert.equal(dom.band.color,'rgb('+BAND_COLORS[index].join(', ')+')');assert.equal(dom.band.y,0);assert.ok(dom.band.width>=16&&dom.band.height>=4&&dom.band.x>=0&&dom.band.x+dom.band.width<=dom.width);assert.equal(dom.scrollProbe.hit,true);assert.equal(dom.scrollProbe.color,'rgb(207, 229, 208)');
   const image=await budget(()=>wc.capturePage(undefined,{stayHidden:true,stayAwake:false})),scaleFactor=Math.max(...image.getScaleFactors()),pixelSize=image.getSize(scaleFactor),pixels=image.toBitmap({scaleFactor});lastImage=image;lastScale=scaleFactor;
   assert.deepEqual(native(),before,'Native page identity and visibility survive fixture readback');assert.equal(pixels.length,pixelSize.width*pixelSize.height*4);
   const sx=pixelSize.width/dom.width,sy=pixelSize.height/dom.height,y=Math.floor(3*sy),left=Math.max(0,Math.ceil(dom.band.x*sx)),right=Math.min(pixelSize.width,Math.floor((dom.band.x+dom.band.width)*sx)),minimum=Math.ceil(16*sx);let count=0;
   for(let x=left;x<right;x++){const i=(y*pixelSize.width+x)*4;if(pixels[i+3]===255&&[pixels[i+2],pixels[i+1],pixels[i]].every((value,k)=>Math.abs(value-BAND_COLORS[index][k])<=2))count++;}
   const x=Math.floor(dom.scrollProbe.x*sx),py=Math.floor(dom.scrollProbe.y*sy),offset=(py*pixelSize.width+x)*4,rgba=[pixels[offset+2],pixels[offset+1],pixels[offset],pixels[offset+3]],scrollPainted=rgba[3]===255&&rgba.slice(0,3).every((value,k)=>Math.abs(value-[207,229,208][k])<=2);
   row.attempts.push({attempt,at:performance.now(),dom,scaleFactor,pixelSize,band:{expectedColor:BAND_COLORS[index],row:y,left,right,count,minimum},scrollProbe:{x,y:py,rgba,painted:scrollPainted}});
   if(count>=minimum&&scrollPainted){row.ready=true;break;}
  }
  assert.equal(row.ready,true,'Visible fixture must paint its band and scrolled content before becoming a background page');row.after=native();row.elapsedMs=performance.now()-startedAt;row.filename='mouse-627-desktop-transition-prepared-'+index+'.png';await fs.writeFile(row.filename,lastImage.toPNG({scaleFactor:lastScale}));return row;
 }catch(error){row.error=error.message;if(lastImage){row.filename='mouse-627-desktop-transition-prepared-'+index+'-failed.png';await fs.writeFile(row.filename,lastImage.toPNG({scaleFactor:lastScale})).catch(()=>{});}await wc.executeJavaScript('document.getElementById('+JSON.stringify(BAND_ID)+')?.remove();document.body.style.minHeight='+JSON.stringify(original.minHeight)+';scrollTo('+original.scrollX+','+original.scrollY+')').catch(()=>{});throw error;}
 finally{row.elapsedMs=performance.now()-startedAt;await fs.writeFile('mouse-627-desktop-transition-preparation-'+index+'.json',JSON.stringify(row,null,2)+'\n').catch(()=>{});}
}
function paintedBands(bytes,{scaleFactor,pixelSize},geometry){
 const {width,height}=pixelSize;
 if(bytes.length!==width*height*4||width<1||height<1)return null;
 const sx=width/geometry.width,sy=height/geometry.height,counts=[0,0],rows=[...new Set(geometry.rows.map(y=>Math.max(0,Math.min(height-1,Math.floor(y*sy)))))],rowCounts=rows.map(y=>({y,counts:[0,0]}));
 for(const row of rowCounts)for(let x=0;x<width;x++){
  const y=row.y;
  const i=(y*width+x)*4;if(bytes[i+3]!==255)continue;
  for(let c=0;c<BAND_COLORS.length;c++){const rgb=BAND_COLORS[c];if(Math.abs(bytes[i+2]-rgb[0])<=2&&Math.abs(bytes[i+1]-rgb[1])<=2&&Math.abs(bytes[i]-rgb[2])<=2){counts[c]++;row.counts[c]++;}}
 }
 const minimum=Math.ceil(16*sx);
 return{bothDesktopsPainted:counts.every(count=>count>=minimum),colors:BAND_COLORS,counts,minimum,rows,rowCounts,viewport:geometry,pixelSize,scaleFactor};
}
module.exports=async({app,win,browser,pages,prepared,leftDesk='desk-1',rightDesk='desk-3'})=>{
 const js=code=>win.webContents.executeJavaScript(code),surface=browser.mouseDesktops.surfaces,originalCommand=browser.command,originalBegin=surface.begin,originalCapture=surface.capture;
 const initial=await js('({theme:MouseTest.model.theme,desk:MouseTest.model.desktopId})'),saved=[];
 const evidence={version:app.getVersion(),preparation:prepared,simultaneous:false,pngSurfaces:false,compositorOnly:false,nativeIdentityPreserved:false,viewportAndScrollPreserved:false,slowAckBounded:false,restored:false,transitions:[]};
 const file='mouse-627-desktop-transition.json',save=()=>fs.writeFile(file,JSON.stringify(evidence,null,2)+'\n');let active=null,delay=0,attached=false,completed=false,frameCapture=null;const retained=[],retainedSurfaces=[];
 async function pins(){return Promise.all(pages.map(async id=>{const page=browser.get(id),wc=page.view.webContents,dom=await wc.executeJavaScript('({scrollX,scrollY,marker:window.marker})'),bounds=page.view.getBounds();return{id,webContentsId:wc.id,navigationEpoch:page.navigationEpoch||0,url:wc.getURL(),width:bounds.width,height:bounds.height,...dom};}));}
 function compare(before,after){assert.deepEqual(after,before,'WebContents, navigation, viewport and scroll survive desktop motion');}
 const observe="(()=>{const selected=new Set("+JSON.stringify(pages)+"),proof=globalThis.__mouse627DesktopProof={timeOrigin:performance.timeOrigin,startedAt:performance.now(),states:[],frames:[],snapshots:[],allSnapshots:[],midpoint:false,running:true};\nconst tick=at=>{if(!proof.running)return;const host=document.querySelector('#mouse-desktop-transition'),shadow=host?.shadowRoot,outgoing=shadow?.querySelector('[data-transition-frame=outgoing]'),incoming=shadow?.querySelector('[data-transition-frame=incoming]'),phase=host?.dataset.phase||'absent';if(proof.states.length<32&&proof.states.at(-1)?.phase!==phase)proof.states.push({at,phase});\nif(host?.dataset.phase==='animating'&&outgoing&&incoming){const x=node=>new DOMMatrixReadOnly(getComputedStyle(node).transform).m41,width=host.getBoundingClientRect().width,a=x(outgoing),b=x(incoming);if(proof.frames.length<120)proof.frames.push({at,outgoingX:a,incomingX:b,width});if(Math.abs(a)>width*.2&&Math.abs(a)<width*.9)proof.midpoint=true;\nif(!proof.allSnapshots.length){proof.allSnapshots=[...shadow.querySelectorAll('img[data-surface]')].map(img=>{const r=img.getBoundingClientRect();return{id:img.dataset.surface,frame:img.closest('[data-transition-frame]').dataset.transitionFrame,png:img.src.startsWith('data:image/png;base64,'),decoded:img.complete&&img.naturalWidth>0,pixelWidth:img.naturalWidth,pixelHeight:img.naturalHeight,x:r.x,y:r.y,width:r.width,height:r.height};});proof.snapshots=proof.allSnapshots.filter(img=>selected.has(img.id));}\n}\nproof.raf=requestAnimationFrame(tick);};proof.raf=requestAnimationFrame(tick);})()";
 const observation=stop=>js('(()=>{const p=globalThis.__mouse627DesktopProof;if(p&&'+!!stop+'){p.running=false;cancelAnimationFrame(p.raf);}return{timeOrigin:performance.timeOrigin,observedAt:performance.now(),startedAt:p?.startedAt,states:p?.states||[],frames:p?.frames||[],snapshots:p?.snapshots||[],allSnapshots:p?.allSnapshots||[],last:MouseDesktopSlide.last,overlayCount:document.querySelectorAll("#mouse-desktop-transition").length,visibility:document.querySelector("#workspace").style.visibility,sliding:MouseTest.model.desktopSliding,switching:MouseTest.model.switching,desktopId:MouseTest.model.desktopId,phase:document.querySelector("#mouse-desktop-transition")?.dataset.phase||"absent"};})()');
 async function failure(error){
  if(evidence.error)return;frameCapture?.cancel();const failedAt=performance.now();
  evidence.error={message:error.message,stack:error.stack,timeOrigin:performance.timeOrigin,failedAt};
  const recorded=await observation(false).catch(reason=>({error:reason.message}));
  evidence.pendingTransition={...active,failedAt,nativeLayoutCalls:(browser.mouseLayoutCalls||0)-(active?.counter??browser.mouseLayoutCalls??0),...recorded};
  try{evidence.failureNative={timeOrigin:performance.timeOrigin,observedAt:performance.now(),surfaces:surface.diagnostics?.(),held:!!browser.mouseSurfaceHold,panels:browser.panels,pages:pages.map(id=>{const page=browser.get(id);return{id,bounds:page?.bounds,viewport:page?.view.getBounds(),logicalVisible:page?.visible,nativeVisible:page?.view.getVisible?.(),clipVisible:page?.clipView?.getVisible?.()};})};}catch(reason){evidence.failureNative={error:reason.message};}
  // Preserve the actual rejected callbacks and captured surfaces. Encode/write
  // only after failure and cancellation; never request a later capturePage().
  await save().catch(reason=>{evidence.error.writeError=reason.message;});
  for(const {row,pixels}of retained){const filename='mouse-627-desktop-transition-'+active.theme+'-'+(active.direction>0?'forward':'back')+'-rejected-'+String(row.sequence).padStart(3,'0')+'.png';try{const png=nativeImage.createFromBitmap(pixels,{...row.pixelSize,scaleFactor:1}).toPNG();assert.deepEqual({width:png.readUInt32BE(16),height:png.readUInt32BE(20)},row.pixelSize);await fs.writeFile(filename,png);row.filename=filename;}catch(reason){row.writeError=reason.message;}}
  for(const {row,src,index}of retainedSurfaces){const filename='mouse-627-desktop-transition-'+active.theme+'-'+(active.direction>0?'forward':'back')+'-surface-'+index+'.png';try{await fs.writeFile(filename,Buffer.from(src.slice(src.indexOf(',')+1),'base64'));row.filename=filename;}catch(reason){row.writeError=reason.message;}}
  await save().catch(reason=>{evidence.error.writeError=reason.message;});
 }
 try{
  assert.equal(await js('MouseNative.test'),true);assert.equal(pages.length,BAND_COLORS.length);await save();
  assert.equal(prepared?.length,2);assert.equal(initial.desk,leftDesk);assert.equal(browser.mouseSurfaceHold,null);assert.equal(await js('!MouseTest.model.switching&&!MouseTest.model.desktopSliding&&!document.querySelector("#mouse-desktop-transition")&&!document.querySelector(".mouse-floating-snapshot")'),true);
  for(const [index,id]of pages.entries()){const row=prepared[index],page=browser.get(id),wc=page.view.webContents;assert.equal(row.id,id);assert.equal(row.index,index);assert.equal(row.ready,true);assert.equal(row.native.selectedDesktop,index===0?rightDesk:leftDesk);assert.equal(row.native.logicalVisible,true);assert.equal(row.native.nativeVisible,true);assert.equal(row.native.webContentsId,wc.id);assert.equal(row.native.epoch,page.navigationEpoch||0);assert.equal(row.native.url,wc.getURL());assert.deepEqual(row.native.bounds,page.view.getBounds());assert.deepEqual(row.native.surfaceBounds,page.bounds);saved.push({id,...row.original});const dom=await wc.executeJavaScript('({scrollX,scrollY,band:document.getElementById('+JSON.stringify(BAND_ID)+')?.style.backgroundColor})');assert.equal(dom.scrollX,0);assert.equal(dom.scrollY,137);assert.equal(dom.band,'rgb('+BAND_COLORS[index].join(', ')+')');}
  const debug=win.webContents.debugger;assert.equal(debug.isAttached(),false);debug.attach('1.3');attached=true;
  await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  browser.command=async function(action,args){const result=await originalCommand.call(this,action,args);if(action==='layout'&&delay)await sleep(delay);return result;};
  surface.begin=function(token,purpose){if(active&&purpose!=='popover'&&active.counter===undefined){active.counter=browser.mouseLayoutCalls||0;active.holdBeganAt=performance.now();}return originalBegin.call(this,token,purpose);};
  surface.capture=async function(args){
   const probes=new Map(),recording=active,timing=recording?{startedAt:performance.now(),prepared:!!args.hold,ids:args.ids.slice()}:null;
   if(timing)recording.captureTimeline.push(timing);
   try{
   if(recording)for(const id of args.ids.filter(id=>pages.includes(id))){const wc=browser.get(id).view.webContents,probe=await wc.executeJavaScript('(()=>{const body=document.body,background=getComputedStyle(body).backgroundColor,width=innerWidth,height=innerHeight,e=document.getElementById('+JSON.stringify(BAND_ID)+'),r=e?.getBoundingClientRect(),band=r?{x:r.x,y:r.y,width:r.width,height:r.height,color:getComputedStyle(e).backgroundColor}:null;for(const fy of [.85,.65,.45,.25])for(const fx of [.85,.65,.35,.15]){const x=Math.max(1,Math.min(width-2,Math.floor(width*fx))),y=Math.max(1,Math.min(height-2,Math.floor(height*fy))),hit=document.elementFromPoint(x,y);if(hit===body)return{x,y,width,height,domTag:hit.tagName,background,band};}throw Error("No exposed fixture body pixel");})()');assert.equal(probe.domTag,'BODY');assert.equal(probe.background,'rgb(240, 240, 240)');probes.set(id,probe);}
   if(timing)timing.captureStartedAt=performance.now();
   const result=await originalCapture.call(this,args);
   if(timing)timing.captureReturnedAt=performance.now();
   if(recording){
    const rows=[];recording.captures.push({prepared:!!args.hold,complete:result.complete,ids:(result.surfaces||[]).map(row=>row.id),rows});
    for(const row of result.surfaces||[]){
     if(!pages.includes(row.id))continue;assert.match(row.src,/^data:image\/png;base64,/);const image=nativeImage.createFromDataURL(row.src),bitmap=image.toBitmap(),probe=probes.get(row.id);assert.ok(probe);assert.equal(bitmap.length,row.pixelWidth*row.pixelHeight*4,'Decoded PNG has the recorded native pixel dimensions');
     const px=Math.min(row.pixelWidth-1,Math.floor(probe.x*row.pixelWidth/probe.width)),py=Math.min(row.pixelHeight-1,Math.floor(probe.y*row.pixelHeight/probe.height)),offset=(py*row.pixelWidth+px)*4,rgba=[bitmap[offset+2],bitmap[offset+1],bitmap[offset],bitmap[offset+3]];
     assert.ok(rgba.slice(0,3).every(value=>value>=238&&value<=242)&&rgba[3]===255,'Native PNG contains the measured exposed fixture body pixel: '+JSON.stringify({probe,px,py,rgba}));
     const measured={id:row.id,pixelWidth:row.pixelWidth,pixelHeight:row.pixelHeight,width:row.width,height:row.height,bounds:row.bounds,epoch:row.epoch,webContentsId:row.webContentsId,band:{dom:probe.band,expectedColor:BAND_COLORS[pages.indexOf(row.id)],pixels:paintedBands(bitmap,{scaleFactor:1,pixelSize:{width:row.pixelWidth,height:row.pixelHeight}},{width:probe.width,height:probe.height,rows:[3]})},sample:{x:probe.x,y:probe.y,pixelX:px,pixelY:py,viewportWidth:probe.width,viewportHeight:probe.height,rgba,domTag:probe.domTag,background:probe.background}};rows.push(measured);
     if(retainedSurfaces.length<4&&row.src.length<=16*1024*1024)retainedSurfaces.push({row:measured,src:row.src,index:retainedSurfaces.length});
     const bands=measured.band.pixels,expected=pages.indexOf(row.id);if(bands.counts[expected]<bands.minimum){evidence.pendingTransition={...recording};await save();}assert.ok(bands.counts[expected]>=bands.minimum,'Actual transition source PNG must retain its prepared band: '+JSON.stringify({id:row.id,expectedColor:BAND_COLORS[expected],counts:bands.counts,minimum:bands.minimum}));
    }
   }
   return result;
   }catch(error){if(timing)timing.error=error.message;throw error;}finally{if(timing)timing.endedAt=performance.now();}
  };
  for(const theme of ['light','dark'])for(const direction of [1,-1]){
   await js('MouseTest.setTheme('+JSON.stringify(theme)+')');await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(60);
   const target=direction>0?rightDesk:leftDesk;assert.notEqual(await js('MouseTest.model.desktopId'),target);
   delay=theme==='dark'&&direction===-1?250:0;active={theme,direction,ackDelayMs:delay,mainTimeOrigin:performance.timeOrigin,mainStartedAt:performance.now(),captures:[],captureTimeline:[]};const pageBefore=await pins();active.pageBefore=pageBefore;await js(observe);
   let paintedFrame;
   if(direction===1){
    const [width,height]=win.getContentSize(),geometry={width,height,rows:pages.map(id=>browser.get(id).bounds.y+3)},diagnostic=active.presentation={source:'beginFrameSubscription',geometry,armedAt:performance.now(),timeoutMs:4000,maxFrames:120,ready:null,frames:[],retainedBytes:0,droppedFrames:0,retention:{maxFrames:12,maxBytes:32*1024*1024,policy:'first and latest'}};
    frameCapture=armFrameCapture(win.webContents,{select(image,context){
     const receivedAt=performance.now(),pixels=image.toBitmap({scaleFactor:context.scaleFactor}),bands=paintedBands(pixels,context,geometry),selected=bands?.bothDesktopsPainted===true,row={...context,receivedAt,selectionMs:performance.now()-receivedAt,bands,selected};diagnostic.frames.push(row);
     // Reuse the existing readback. Retain the first and most recent frames
     // within both limits; encode only after a failed subscription is cancelled.
     while(retained.length>1&&(retained.length>=12||diagnostic.retainedBytes+pixels.length>32*1024*1024)){diagnostic.retainedBytes-=retained.splice(1,1)[0].pixels.length;diagnostic.droppedFrames++;}
     if(retained.length<12&&diagnostic.retainedBytes+pixels.length<=32*1024*1024){retained.push({row,pixels});diagnostic.retainedBytes+=pixels.length;}else diagnostic.droppedFrames++;
     return selected?bands:null;
    }});diagnostic.ready=await frameCapture.ready;diagnostic.readyAt=performance.now();
   }
   active.switchStartedAt=performance.now();const changing=js('MouseTest.switchDesktop('+JSON.stringify(target)+')');changing.catch(()=>{});const switchingRecord=active;changing.then(()=>{switchingRecord.switchFinishedAt=performance.now();},error=>{switchingRecord.switchFailedAt=performance.now();switchingRecord.switchError=error.message;});
   try{
    if(direction===1){
     const frame=await frameCapture.result;const filename='mouse-627-desktop-transition-'+theme+'.png';await fs.writeFile(filename,frame.png);const {png,...proof}=frame;paintedFrame={...proof,filename};
    }
    await changing;
   }catch(error){await failure(error);throw error;}finally{frameCapture?.cancel();await changing.catch(()=>{});}
   await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(40);
   const recorded=await observation(true);
   const pageAfter=await pins(),nativeLayoutCalls=(browser.mouseLayoutCalls||0)-(active.counter??browser.mouseLayoutCalls);
   const {frames,snapshots,allSnapshots,last}=recorded;
   // Persist the already measured facts before assertions can abort this attempt.
   // Frames are capped at 120 by the observer; surfaces at 16 pages per capture.
   // No readback or disk write is added inside the animation interval.
   evidence.pendingTransition={...active,nativeLayoutCalls,pageAfter,...recorded,...(paintedFrame?{paintedFrame}:{})};await save();
   compare(pageBefore,pageAfter);assert.ok(last.animated&&last.decoded,'Both real page surfaces must be decoded and animated');assert.equal(last.direction,direction);assert.equal(last.layoutCalls,2);
   assert.ok(Number.isInteger(nativeLayoutCalls)&&nativeLayoutCalls>0&&nativeLayoutCalls<=8,'Native layouts are bounded independently of animation frames: '+nativeLayoutCalls);
   assert.ok(frames.length>=3,'At least three genuine compositor frames are observed');const width=frames[0].width;
   assert.ok(frames.every(f=>f.width===width&&Math.abs((f.incomingX-f.outgoingX)-direction*width)<=1.5),'Both full-width layers remain adjacent, without an empty exit/change gap');
   assert.ok(new Set(frames.map(f=>Math.round(f.outgoingX))).size>=3&&new Set(frames.map(f=>Math.round(f.incomingX))).size>=3,'Both layers move during the same interval');
   assert.ok(last.animationDurationMs>0&&last.animationDurationMs<=660+delay,'Native acknowledgements cannot stretch the compositor timeline into seconds: '+JSON.stringify(last));
   assert.ok(last.totalDurationMs>=last.animationDurationMs);assert.equal(snapshots.length,2,'Both selected fixture pages have their own native surfaces');assert.deepEqual(snapshots.map(s=>s.id).sort(),pages.slice().sort(),'The selected proof pages are present exactly once');assert.ok(allSnapshots.length>=2&&allSnapshots.every(s=>s.png&&s.decoded&&s.pixelWidth>=s.width-1&&s.pixelHeight>=s.height-1),'Every actual native viewport uses a decoded full-size PNG');
   assert.equal(active.captures.length,2);assert.ok(active.captures.every(c=>c.complete&&c.rows.length===1));assert.equal(active.captures[0].prepared,false);assert.equal(active.captures[1].prepared,true);
   for(const [index,frame]of ['outgoing','incoming'].entries()){const ids=allSnapshots.filter(s=>s.frame===frame).map(s=>s.id);assert.equal(new Set(ids).size,ids.length,'Each native page is painted once in its desktop frame');assert.deepEqual(ids.sort(),active.captures[index].ids.slice().sort(),'The '+frame+' frame paints the complete set of captured page surfaces');}
   assert.equal(recorded.overlayCount,0);assert.equal(recorded.visibility,'');assert.equal(recorded.sliding,false);assert.equal(browser.mouseSurfaceHold,null);assert.equal(surface.records.size,0);
   evidence.transitions.push({theme,direction,ackDelayMs:delay,nativeLayoutCalls,animationDurationMs:last.animationDurationMs,totalDurationMs:last.totalDurationMs,frames,pageBefore,pageAfter,snapshots,allSnapshots,captures:active.captures,...(paintedFrame?{paintedFrame}:{})});delete evidence.pendingTransition;active=null;frameCapture=null;retained.length=retainedSurfaces.length=0;delay=0;await save();
  }
  evidence.simultaneous=evidence.pngSurfaces=evidence.compositorOnly=evidence.nativeIdentityPreserved=evidence.viewportAndScrollPreserved=evidence.slowAckBounded=true;completed=true;
 }catch(error){await failure(error);throw error;}finally{
  frameCapture?.cancel();retained.length=retainedSurfaces.length=0;
  active=null;delay=0;browser.command=originalCommand;surface.begin=originalBegin;surface.capture=originalCapture;
  await js('(()=>{const p=globalThis.__mouse627DesktopProof;if(p){p.running=false;cancelAnimationFrame(p.raf);}delete globalThis.__mouse627DesktopProof;})()').catch(()=>{});
  if(attached){await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'',features:[]}).catch(()=>{});win.webContents.debugger.detach();}
  for(const item of saved){const page=browser.get(item.id);if(page&&!page.view.webContents.isDestroyed())await page.view.webContents.executeJavaScript('document.getElementById('+JSON.stringify(BAND_ID)+')?.remove();document.body.style.minHeight='+JSON.stringify(item.minHeight)+';scrollTo('+item.scrollX+','+item.scrollY+')');}
  await js('MouseTest.setTheme('+JSON.stringify(initial.theme)+')');if(await js('MouseTest.model.desktopId')!==initial.desk)await js('MouseTest.switchDesktop('+JSON.stringify(initial.desk)+')');
  evidence.restored=await js('!MouseTest.model.desktopSliding&&!document.querySelector("#mouse-desktop-transition")')&&!browser.mouseSurfaceHold;
  await save();
 }
 if(completed){assert.equal(evidence.restored,true);console.log('MOUSE_627_COMPOSITOR_DESKTOP_SLIDE_NATIVE_PASS',JSON.stringify(evidence.transitions.map(x=>({theme:x.theme,direction:x.direction,ackDelayMs:x.ackDelayMs,nativeLayoutCalls:x.nativeLayoutCalls,frames:x.frames.length,animationDurationMs:x.animationDurationMs}))));console.log('MOUSE_621_SMOOTH_DESKTOP_NATIVE_SLIDE_PASS');}
};
module.exports.prepareVisiblePage=prepareVisiblePage;
