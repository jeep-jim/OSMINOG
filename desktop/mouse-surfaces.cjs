'use strict';
// Short-lived, exact-viewport page pixels for shell transitions. Normal and
// private instances keep their own RAM only; nothing is written to a profile.
const {randomUUID}=require('node:crypto');
const MAX_PAGES=16,MAX_PNG_BYTES=32*1024*1024,MAX_PIXELS=16*1024*1024,MAX_CAPTURES=2,CAPTURE_MS=700,HOLD_MS=5000;
const rect=r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
const same=(a,b)=>!!a&&!!b&&['x','y','width','height'].every(k=>a[k]===b[k]);
class DesktopSurfaces{
 constructor({browser,bank,win,onImage,now=Date.now,captureMs=CAPTURE_MS,holdMs=HOLD_MS}){
  Object.assign(this,{browser,bank,win,onImage,now,captureMs,holdMs});this.generation=0;this.records=new Map();this.activeCaptures=0;this.busy=false;this.held=null;this.locked=false;this.disposed=false;this.watchers=[];
  this.resize=()=>this.clear(true);this.navigation=(_event,_url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace)this.clear(false);};
  win?.on?.('resize',this.resize);win?.webContents?.on?.('did-start-navigation',this.navigation);
 }
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
  if(this.busy||this.disposed||this.locked||this.browser.disposed||this.held&&args.hold!==this.held.token||args.hold&&!this.held)return this.empty();
  const pins=args.ids.map(id=>this.live(id,args.hold));if(pins.some(p=>!p))return this.empty();
  const generation=this.generation,desk=this.bank.active,shape=this.shape(),surfaces=[];let index=0,bytes=0,pixels=0,cancelled=false,timer;
  const current=()=>!cancelled&&!this.disposed&&!this.locked&&!this.browser.disposed&&generation===this.generation&&desk===this.bank.active&&shape===this.shape();
  this.busy=true;
  const worker=async()=>{
   while(index<pins.length&&current()){
    const pin=pins[index++];if(!this.valid(pin,args.hold)||this.activeCaptures>=MAX_CAPTURES)continue;
    this.activeCaptures++;
    try{
     // Capturing the selected incoming desk during an owned hold must not make
     // hidden/background pages visible or keep the computer awake.
     const image=await pin.wc.capturePage(undefined,{stayHidden:true,stayAwake:false});
     if(!current()||!this.valid(pin,args.hold)||image.isEmpty?.())continue;
     // Preserve the sharpest representation the compositor actually supplied.
     // NativeImage.toPNG defaults to 1x even when the original frame is Retina.
     const scales=image.getScaleFactors?.().filter(v=>Number.isFinite(v)&&v>0)||[1],scaleFactor=Math.max(...scales);
     if(!Number.isFinite(scaleFactor)||pixels+pin.viewport.width*pin.viewport.height*scaleFactor*scaleFactor>MAX_PIXELS)continue;
     const png=image.toPNG({scaleFactor});
     if(!Buffer.isBuffer(png)||png.length<24||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))continue;
     const pixelWidth=png.readUInt32BE(16),pixelHeight=png.readUInt32BE(20),area=pixelWidth*pixelHeight;
     const width=pin.viewport.width,height=pin.viewport.height;
     if(!pixelWidth||!pixelHeight||pixelWidth<width-1||pixelHeight<height-1||Math.abs(pixelWidth/width-pixelHeight/height)>.02||bytes+png.length>MAX_PNG_BYTES||pixels+area>MAX_PIXELS)continue;
     bytes+=png.length;pixels+=area;
     surfaces.push({id:pin.id,src:'data:image/png;base64,'+png.toString('base64'),width,height,pixelWidth,pixelHeight,epoch:pin.epoch,webContentsId:pin.wc.id,bounds:{...pin.bounds}});
     try{this.onImage?.(pin.id,image,pin);}catch{}
    }catch{}finally{this.activeCaptures--;}
   }
  };
  try{
   await Promise.race([Promise.all(Array.from({length:Math.min(MAX_CAPTURES,pins.length)},worker)),new Promise(resolve=>{timer=setTimeout(()=>{cancelled=true;resolve();},this.captureMs);timer.unref?.();})]);
   if(!current()||surfaces.length!==pins.length||pins.some(pin=>!this.valid(pin,args.hold)))return this.empty();
   const token=randomUUID();this.records.set(token,{generation,desk,shape,pins,at:this.now()});while(this.records.size>2)this.records.delete(this.records.keys().next().value);
   if(args.hold)this.watch(pins);
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
 dispose(){if(this.disposed)return;this.disposed=true;this.clear(false);this.win?.removeListener?.('resize',this.resize);this.win?.webContents?.removeListener?.('did-start-navigation',this.navigation);}
}
module.exports={DesktopSurfaces,MAX_PAGES,MAX_PNG_BYTES,MAX_PIXELS,MAX_CAPTURES,CAPTURE_MS,HOLD_MS};
