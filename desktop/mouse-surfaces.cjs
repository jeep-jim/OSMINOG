'use strict';
// Short-lived, exact-viewport page pixels for shell transitions. Normal and
// private instances keep their own RAM only; nothing is written to a profile.
const {randomUUID}=require('node:crypto');
// One bounded preparation budget covers the whole two-worker queue, including
// native readback and encoding; it is separate from the subsequent animation.
const MAX_PAGES=16,MAX_PNG_BYTES=32*1024*1024,MAX_PIXELS=16*1024*1024,MAX_CAPTURES=2,CAPTURE_MS=2500,HOLD_MS=5000;
const rect=r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
const same=(a,b)=>!!a&&!!b&&['x','y','width','height'].every(k=>a[k]===b[k]);
class DesktopSurfaces{
 constructor({browser,bank,win,onImage,now=Date.now,captureMs=CAPTURE_MS,holdMs=HOLD_MS}){
  Object.assign(this,{browser,bank,win,onImage,now,captureMs,holdMs});this.generation=0;this.records=new Map();this.activeCaptures=0;this.busy=false;this.held=null;this.locked=false;this.disposed=false;this.watchers=[];
  // BrowserWindow.webContents is a native getter: after 'closed' it throws.
  // Retain the emitter now so disposal can continue into closing every page.
  this.shellContents=win?.webContents;
  this.diagnostic=null;
  this.resize=()=>this.clear(true);this.navigation=(_event,_url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace)this.clear(false);};
  win?.on?.('resize',this.resize);this.shellContents?.on?.('did-start-navigation',this.navigation);
 }
 enableDiagnostics(){this.diagnostic={sequence:0,lastCapture:null,events:[]};}
 diagnostics(){const trace=this.diagnostic;return trace?structuredClone({enabled:true,busy:this.busy,activeCaptures:this.activeCaptures,generation:this.generation,held:!!this.held,locked:this.locked,disposed:this.disposed,lastCapture:trace.lastCapture,events:trace.events}):{enabled:false};}
 recordDiagnostic(trace,phase,detail={}){if(!trace||trace!==this.diagnostic)return;trace.events.push({phase,at:performance.now(),...detail});if(trace.events.length>32)trace.events.shift();}
 shape(){const size=this.win?.getContentSize?.();return Array.isArray(size)?size.join('x'):'';}
 live(id,hold){
  const page=this.browser.tabs.get(id),wc=page?.view?.webContents;
  if(this.disposed||this.locked||this.browser.disposed||this.win?.isDestroyed?.()||!page||!wc||wc.isDestroyed?.()||page.provider||page.ephemeral||this.bank.members[id]!==this.bank.active)return null;
  const prepared=!!hold&&this.held?.token===hold&&this.browser.mouseSurfaceHold===hold&&(this.browser.panels||[]).some(p=>p.id===id);
  if(!page.visible&&!prepared)return null;
  const bounds=rect(page.bounds),viewport=rect(page.view.getBounds?.()||page.bounds);if(!bounds||!viewport)return null;
  return{page,wc,id,desk:this.bank.active,epoch:page.navigationEpoch||0,url:wc.getURL?.()||page.url||'',bounds,viewport};
 }
 valid(pin,hold){const live=this.live(pin.id,hold);return !!live&&live.page===pin.page&&live.wc===pin.wc&&live.desk===pin.desk&&live.epoch===pin.epoch&&live.url===pin.url&&same(live.bounds,pin.bounds)&&same(live.viewport,pin.viewport);}
 empty(){return{desk:this.bank.active,surfaces:[],complete:false,generation:this.generation,token:''};}
 async capture(args={}){
  if(!Array.isArray(args.ids)||args.ids.length>MAX_PAGES||args.ids.some(id=>typeof id!=='string'||!id||id.length>100)||new Set(args.ids).size!==args.ids.length)throw Error('Invalid surface page identities');
  const trace=this.diagnostic,observed=trace?{sequence:++trace.sequence,startedAt:performance.now(),requestedIds:args.ids.slice(),generation:this.generation,reason:'pending',complete:false,completedIds:[],pngBytes:0,pixels:0,pages:[]}:null;
  if(trace){trace.lastCapture=observed;this.recordDiagnostic(trace,'capture-start',{sequence:observed.sequence,ids:observed.requestedIds,activeCaptures:this.activeCaptures,busy:this.busy,held:!!this.held});}
  const resultDiagnostic=(reason,complete)=>{if(observed){observed.reason=reason;observed.complete=complete;observed.elapsedMs=performance.now()-observed.startedAt;this.recordDiagnostic(trace,'capture-result',{sequence:observed.sequence,reason,complete,elapsedMs:observed.elapsedMs,activeCaptures:this.activeCaptures});}};
  const incomplete=reason=>{resultDiagnostic(reason,false);return this.empty();};
  if(this.busy||this.disposed||this.locked||this.browser.disposed||this.held&&args.hold!==this.held.token||args.hold&&!this.held)return incomplete(this.busy?'busy':this.disposed?'disposed':this.locked?'locked':this.browser.disposed?'workspace-disposed':this.held?'different-hold':'hold-ended');
  const pins=args.ids.map(id=>this.live(id,args.hold));if(pins.some(p=>!p)){if(observed)observed.invalidIds=args.ids.filter((_id,i)=>!pins[i]);return incomplete('invalid-initial-pins');}
  // Do not leave the largest selected viewport behind every small capture.
  // Stable sorting preserves request order for equal areas; limits stay shared.
  pins.sort((a,b)=>b.viewport.width*b.viewport.height-a.viewport.width*a.viewport.height);
  const generation=this.generation,desk=this.bank.active,shape=this.shape(),surfaces=[];let index=0,bytes=0,pixels=0,cancelled=false,deadline=false,timer;
  const current=()=>!cancelled&&!this.disposed&&!this.locked&&!this.browser.disposed&&generation===this.generation&&desk===this.bank.active&&shape===this.shape();
  this.busy=true;
  const worker=async()=>{
   while(index<pins.length&&current()){
    const pin=pins[index++],row=observed?{id:pin.id,webContentsId:pin.wc.id,viewport:{width:pin.viewport.width,height:pin.viewport.height},state:'starting',queueMs:null,nativeStartedAt:null,captureMs:null,pngMs:null,base64Ms:null,previewMs:null}:null;let stageStarted;
    if(row)observed.pages.push(row);
    const pageDiagnostic=state=>{if(row){row.state=state;this.recordDiagnostic(trace,'page',{sequence:observed.sequence,...row});}};
    if(!this.valid(pin,args.hold)){pageDiagnostic('invalid-before-capture');continue;}
    if(this.activeCaptures>=MAX_CAPTURES){pageDiagnostic('capture-capacity');continue;}
    this.activeCaptures++;
    try{
     // Capturing the selected incoming desk during an owned hold must not make
     // hidden/background pages visible or keep the computer awake.
     if(row){row.state='capturing';stageStarted=performance.now();row.nativeStartedAt=stageStarted;row.queueMs=stageStarted-observed.startedAt;}
     const image=await pin.wc.capturePage(undefined,{stayHidden:true,stayAwake:false});
     if(row){row.captureMs=performance.now()-stageStarted;pageDiagnostic('captured');}
     if(!current()){pageDiagnostic(deadline?'late-after-deadline':'capture-invalidated');continue;}
     if(!this.valid(pin,args.hold)){pageDiagnostic('pin-changed-after-capture');continue;}
     if(image.isEmpty?.()){pageDiagnostic('empty-image');continue;}
     // Preserve the sharpest representation the compositor actually supplied.
     // NativeImage.toPNG defaults to 1x even when the original frame is Retina.
     const scales=image.getScaleFactors?.().filter(v=>Number.isFinite(v)&&v>0)||[1],scaleFactor=Math.max(...scales);
     if(!Number.isFinite(scaleFactor)||pixels+pin.viewport.width*pin.viewport.height*scaleFactor*scaleFactor>MAX_PIXELS){pageDiagnostic('scale-or-pixel-budget');continue;}
     if(row){row.state='png';stageStarted=performance.now();}
     const png=image.toPNG({scaleFactor});
     if(row)row.pngMs=performance.now()-stageStarted;
     if(!Buffer.isBuffer(png)||png.length<24||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){pageDiagnostic('invalid-png');continue;}
     const pixelWidth=png.readUInt32BE(16),pixelHeight=png.readUInt32BE(20),area=pixelWidth*pixelHeight;
     const width=pin.viewport.width,height=pin.viewport.height;
     if(!pixelWidth||!pixelHeight||pixelWidth<width-1||pixelHeight<height-1||Math.abs(pixelWidth/width-pixelHeight/height)>.02||bytes+png.length>MAX_PNG_BYTES||pixels+area>MAX_PIXELS){pageDiagnostic(bytes+png.length>MAX_PNG_BYTES?'png-byte-budget':pixels+area>MAX_PIXELS?'png-pixel-budget':'png-dimensions');continue;}
     bytes+=png.length;pixels+=area;
     if(row){row.state='base64';stageStarted=performance.now();}const src='data:image/png;base64,'+png.toString('base64');if(row)row.base64Ms=performance.now()-stageStarted;
     surfaces.push({id:pin.id,src,width,height,pixelWidth,pixelHeight,epoch:pin.epoch,webContentsId:pin.wc.id,bounds:{...pin.bounds}});
     if(row){row.state='preview';stageStarted=performance.now();}
     try{this.onImage?.(pin.id,image,pin);}catch(error){if(row)row.previewError=String(error?.message||error).slice(0,512);}
     if(row){row.previewMs=performance.now()-stageStarted;row.pngBytes=png.length;row.pixelWidth=pixelWidth;row.pixelHeight=pixelHeight;pageDiagnostic('complete');}
    }catch(error){if(row){row.errorStage=row.state;row.message=String(error?.message||error).slice(0,512);pageDiagnostic('error');}}finally{this.activeCaptures--;}
   }
  };
  try{
   await Promise.race([Promise.all(Array.from({length:Math.min(MAX_CAPTURES,pins.length)},worker)),new Promise(resolve=>{timer=setTimeout(()=>{cancelled=true;deadline=true;if(observed)this.recordDiagnostic(trace,'capture-deadline',{sequence:observed.sequence,elapsedMs:performance.now()-observed.startedAt,completedIds:surfaces.map(surface=>surface.id),activeCaptures:this.activeCaptures});resolve();},this.captureMs);timer.unref?.();})]);
   if(observed){observed.completedIds=surfaces.map(surface=>surface.id);observed.pngBytes=bytes;observed.pixels=pixels;}
   if(!current())return incomplete(deadline?'deadline':this.disposed?'disposed':this.locked?'locked':this.browser.disposed?'workspace-disposed':generation!==this.generation?'generation-changed':desk!==this.bank.active?'desktop-changed':'window-size-changed');
   if(surfaces.length!==pins.length)return incomplete('incomplete-pages');
   if(pins.some(pin=>!this.valid(pin,args.hold)))return incomplete('pins-changed');
   const token=randomUUID();this.records.set(token,{generation,desk,shape,pins,at:this.now()});while(this.records.size>2)this.records.delete(this.records.keys().next().value);
   if(args.hold)this.watch(pins);
   resultDiagnostic('complete',true);
   return{desk,surfaces,complete:true,generation,token};
  }finally{cancelled=true;clearTimeout(timer);this.busy=false;}
 }
 watch(pins){
  for(const pin of pins){if(this.watchers.some(w=>w.wc===pin.wc))continue;const clear=()=>this.clear(true),nav=(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)this.clear(true);};pin.wc.on?.('destroyed',clear);pin.wc.on?.('did-start-navigation',nav);this.watchers.push({wc:pin.wc,clear,nav});}
 }
 begin(token,purpose='transition'){
  if(!['transition','popover'].includes(purpose))throw Error('Invalid surface hold purpose');
  const record=this.records.get(token);
  if(this.held||!record||this.disposed||this.locked||record.generation!==this.generation||record.desk!==this.bank.active||record.shape!==this.shape()||this.now()-record.at>HOLD_MS||record.pins.some(pin=>!this.valid(pin)))return{held:false,token:''};
  this.held={token,generation:this.generation,purpose};this.browser.mouseSurfaceHold=token;this.watch(record.pins);
  if(purpose==='transition'){this.timer=setTimeout(()=>this.clear(true),this.holdMs);this.timer.unref?.();}
  try{this.browser.layout(this.browser.panels||[]);}catch(error){this.clear(false);throw error;}
  return{held:true,token};
 }
 end(token){if(!this.held||this.held.token!==token)return{released:false};this.clear(false);return{released:true};}
 clear(notify=false){
  this.generation++;this.records.clear();clearTimeout(this.timer);this.timer=null;
  for(const w of this.watchers){w.wc.removeListener?.('destroyed',w.clear);w.wc.removeListener?.('did-start-navigation',w.nav);}this.watchers=[];
  const held=this.held;this.held=null;
  if(held&&this.browser.mouseSurfaceHold===held.token){this.browser.mouseSurfaceHold=null;if(!this.disposed&&!this.browser.disposed&&!this.win?.isDestroyed?.())this.browser.layout(this.browser.panels||[]);}
  if(notify&&!this.disposed&&!this.win?.isDestroyed?.()){try{this.win.webContents.send('mouse:previews-cleared');}catch{}}
 }
 lock(){this.locked=true;this.clear(true);}
 unlock(){this.locked=false;}
 dispose(){if(this.disposed)return;this.disposed=true;this.clear(false);this.win?.removeListener?.('resize',this.resize);this.shellContents?.removeListener?.('did-start-navigation',this.navigation);}
}
module.exports={DesktopSurfaces,MAX_PAGES,MAX_PNG_BYTES,MAX_PIXELS,MAX_CAPTURES,CAPTURE_MS,HOLD_MS};
