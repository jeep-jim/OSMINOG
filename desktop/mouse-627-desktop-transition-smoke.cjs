'use strict';
// Native packaged proof: two retained local pages, simultaneous compositor
// surfaces, and an actual delayed layout IPC acknowledgement.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {nativeImage}=require('electron');
const {armFrameCapture}=require('./mouse-smoke-frames.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const BAND_ID='mouse627-native-transition-band',BAND_COLORS=[[199,37,77],[29,125,220]];
function paintedBands(image,{scaleFactor,pixelSize},geometry){
 const bytes=image.toBitmap({scaleFactor}),{width,height}=pixelSize;
 if(bytes.length!==width*height*4||width<1||height<1)return null;
 const sx=width/geometry.width,sy=height/geometry.height,counts=[0,0],rows=[...new Set(geometry.rows.map(y=>Math.max(0,Math.min(height-1,Math.floor(y*sy)))))];
 for(const y of rows)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;if(bytes[i+3]!==255)continue;
  for(let c=0;c<BAND_COLORS.length;c++){const rgb=BAND_COLORS[c];if(Math.abs(bytes[i+2]-rgb[0])<=2&&Math.abs(bytes[i+1]-rgb[1])<=2&&Math.abs(bytes[i]-rgb[2])<=2)counts[c]++;}
 }
 const minimum=Math.ceil(16*sx);if(!counts.every(count=>count>=minimum))return null;
 return{bothDesktopsPainted:true,colors:BAND_COLORS,counts,minimum,rows,viewport:geometry,pixelSize,scaleFactor};
}
module.exports=async({app,win,browser,pages,leftDesk='desk-1',rightDesk='desk-3'})=>{
 const js=code=>win.webContents.executeJavaScript(code),surface=browser.mouseDesktops.surfaces,originalCommand=browser.command,originalBegin=surface.begin,originalCapture=surface.capture;
 const initial=await js('({theme:MouseTest.model.theme,desk:MouseTest.model.desktopId})'),saved=[];
 const evidence={version:app.getVersion(),simultaneous:false,pngSurfaces:false,compositorOnly:false,nativeIdentityPreserved:false,viewportAndScrollPreserved:false,slowAckBounded:false,restored:false,transitions:[]};
 const file='mouse-627-desktop-transition.json',save=()=>fs.writeFile(file,JSON.stringify(evidence,null,2)+'\n');let active=null,delay=0,attached=false,completed=false;
 async function pins(){return Promise.all(pages.map(async id=>{const page=browser.get(id),wc=page.view.webContents,dom=await wc.executeJavaScript('({scrollX,scrollY,marker:window.marker})'),bounds=page.view.getBounds();return{id,webContentsId:wc.id,navigationEpoch:page.navigationEpoch||0,url:wc.getURL(),width:bounds.width,height:bounds.height,...dom};}));}
 function compare(before,after){assert.deepEqual(after,before,'WebContents, navigation, viewport and scroll survive desktop motion');}
 const observe="(()=>{const selected=new Set("+JSON.stringify(pages)+"),proof=globalThis.__mouse627DesktopProof={frames:[],snapshots:[],allSnapshots:[],midpoint:false,running:true};\nconst tick=at=>{if(!proof.running)return;const host=document.querySelector('#mouse-desktop-transition'),shadow=host?.shadowRoot,outgoing=shadow?.querySelector('[data-transition-frame=outgoing]'),incoming=shadow?.querySelector('[data-transition-frame=incoming]');\nif(host?.dataset.phase==='animating'&&outgoing&&incoming){const x=node=>new DOMMatrixReadOnly(getComputedStyle(node).transform).m41,width=host.getBoundingClientRect().width,a=x(outgoing),b=x(incoming);if(proof.frames.length<120)proof.frames.push({at,outgoingX:a,incomingX:b,width});if(Math.abs(a)>width*.2&&Math.abs(a)<width*.9)proof.midpoint=true;\nif(!proof.allSnapshots.length){proof.allSnapshots=[...shadow.querySelectorAll('img[data-surface]')].map(img=>({id:img.dataset.surface,frame:img.closest('[data-transition-frame]').dataset.transitionFrame,png:img.src.startsWith('data:image/png;base64,'),decoded:img.complete&&img.naturalWidth>0,pixelWidth:img.naturalWidth,pixelHeight:img.naturalHeight,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height}));proof.snapshots=proof.allSnapshots.filter(img=>selected.has(img.id));}\n}\nproof.raf=requestAnimationFrame(tick);};proof.raf=requestAnimationFrame(tick);})()";
 try{
  assert.equal(await js('MouseNative.test'),true);assert.equal(pages.length,BAND_COLORS.length);await save();
  const debug=win.webContents.debugger;assert.equal(debug.isAttached(),false);debug.attach('1.3');attached=true;
  await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  for(const [index,id]of pages.entries()){const wc=browser.get(id).view.webContents;saved.push({id,...await wc.executeJavaScript('({minHeight:document.body.style.minHeight,scrollX,scrollY})')});await wc.executeJavaScript('(()=>{document.body.style.minHeight="2400px";scrollTo(0,137);const band=document.createElement("div");band.id='+JSON.stringify(BAND_ID)+';band.setAttribute("aria-hidden","true");band.style.cssText="position:fixed;inset:0 0 auto;height:8px;z-index:2147483647;pointer-events:none;background:rgb('+BAND_COLORS[index].join(',')+');";document.body.append(band);})()');}
  browser.command=async function(action,args){const result=await originalCommand.call(this,action,args);if(action==='layout'&&delay)await sleep(delay);return result;};
  surface.begin=function(token,purpose){if(active&&purpose!=='popover'&&active.counter===undefined)active.counter=browser.mouseLayoutCalls||0;return originalBegin.call(this,token,purpose);};
  surface.capture=async function(args){
   const probes=new Map();
   if(active)for(const id of args.ids.filter(id=>pages.includes(id))){const wc=browser.get(id).view.webContents,probe=await wc.executeJavaScript('(()=>{const body=document.body,background=getComputedStyle(body).backgroundColor,width=innerWidth,height=innerHeight;for(const fy of [.85,.65,.45,.25])for(const fx of [.85,.65,.35,.15]){const x=Math.max(1,Math.min(width-2,Math.floor(width*fx))),y=Math.max(1,Math.min(height-2,Math.floor(height*fy))),hit=document.elementFromPoint(x,y);if(hit===body)return{x,y,width,height,domTag:hit.tagName,background};}throw Error("No exposed fixture body pixel");})()');assert.equal(probe.domTag,'BODY');assert.equal(probe.background,'rgb(240, 240, 240)');probes.set(id,probe);}
   const result=await originalCapture.call(this,args);
   if(active){
    const rows=[];
    for(const row of result.surfaces||[]){
     if(!pages.includes(row.id))continue;assert.match(row.src,/^data:image\/png;base64,/);const image=nativeImage.createFromDataURL(row.src),bitmap=image.toBitmap(),probe=probes.get(row.id);assert.ok(probe);assert.equal(bitmap.length,row.pixelWidth*row.pixelHeight*4,'Decoded PNG has the recorded native pixel dimensions');
     const px=Math.min(row.pixelWidth-1,Math.floor(probe.x*row.pixelWidth/probe.width)),py=Math.min(row.pixelHeight-1,Math.floor(probe.y*row.pixelHeight/probe.height)),offset=(py*row.pixelWidth+px)*4,rgba=[bitmap[offset+2],bitmap[offset+1],bitmap[offset],bitmap[offset+3]];
     assert.ok(rgba.slice(0,3).every(value=>value>=238&&value<=242)&&rgba[3]===255,'Native PNG contains the measured exposed fixture body pixel: '+JSON.stringify({probe,px,py,rgba}));
     rows.push({id:row.id,pixelWidth:row.pixelWidth,pixelHeight:row.pixelHeight,width:row.width,height:row.height,epoch:row.epoch,webContentsId:row.webContentsId,sample:{x:probe.x,y:probe.y,pixelX:px,pixelY:py,viewportWidth:probe.width,viewportHeight:probe.height,rgba,domTag:probe.domTag,background:probe.background}});
    }
    active.captures.push({prepared:!!args.hold,complete:result.complete,ids:(result.surfaces||[]).map(row=>row.id),rows});
   }
   return result;
  };
  for(const theme of ['light','dark'])for(const direction of [1,-1]){
   await js('MouseTest.setTheme('+JSON.stringify(theme)+')');await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(60);
   const target=direction>0?rightDesk:leftDesk;assert.notEqual(await js('MouseTest.model.desktopId'),target);
   delay=theme==='dark'&&direction===-1?250:0;active={theme,direction,ackDelayMs:delay,captures:[]};const pageBefore=await pins();await js(observe);
   let frameCapture,paintedFrame;
   if(direction===1){const [width,height]=win.getContentSize(),geometry={width,height,rows:pages.map(id=>browser.get(id).bounds.y+3)};frameCapture=armFrameCapture(win.webContents,{select:(image,context)=>paintedBands(image,context,geometry)});await frameCapture.ready;}
   const changing=js('MouseTest.switchDesktop('+JSON.stringify(target)+')');changing.catch(()=>{});
   try{
    if(direction===1){
     const frame=await frameCapture.result;const filename='mouse-627-desktop-transition-'+theme+'.png';await fs.writeFile(filename,frame.png);const {png,...proof}=frame;paintedFrame={...proof,filename};
    }
    await changing;
   }finally{frameCapture?.cancel();await changing.catch(()=>{});}
   await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(40);
   const recorded=await js('(()=>{const p=globalThis.__mouse627DesktopProof;p.running=false;cancelAnimationFrame(p.raf);return{frames:p.frames,snapshots:p.snapshots,allSnapshots:p.allSnapshots,last:MouseDesktopSlide.last,overlayCount:document.querySelectorAll("#mouse-desktop-transition").length,visibility:document.querySelector("#workspace").style.visibility,sliding:MouseTest.model.desktopSliding}})()');
   const pageAfter=await pins(),nativeLayoutCalls=(browser.mouseLayoutCalls||0)-(active.counter??browser.mouseLayoutCalls);
   const {frames,snapshots,allSnapshots,last}=recorded;
   // Persist the already measured facts before assertions can abort this attempt.
   // Frames are capped at 120 by the observer; surfaces at 16 pages per capture.
   // No readback or disk write is added inside the animation interval.
   evidence.pendingTransition={theme,direction,ackDelayMs:delay,nativeLayoutCalls,frames,pageBefore,pageAfter,snapshots,allSnapshots,captures:active.captures,last,overlayCount:recorded.overlayCount,visibility:recorded.visibility,sliding:recorded.sliding,...(paintedFrame?{paintedFrame}:{})};await save();
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
   evidence.transitions.push({theme,direction,ackDelayMs:delay,nativeLayoutCalls,animationDurationMs:last.animationDurationMs,totalDurationMs:last.totalDurationMs,frames,pageBefore,pageAfter,snapshots,allSnapshots,captures:active.captures,...(paintedFrame?{paintedFrame}:{})});delete evidence.pendingTransition;active=null;delay=0;await save();
  }
  evidence.simultaneous=evidence.pngSurfaces=evidence.compositorOnly=evidence.nativeIdentityPreserved=evidence.viewportAndScrollPreserved=evidence.slowAckBounded=true;completed=true;
 }finally{
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
