'use strict';
// The 621 owned pages still prove viewport/form/scroll retention. Ordinary 636
// switches now select their existing live views without taking any snapshots.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {screen,nativeImage,webContents}=require('electron');
const {bounded,containsRect}=require('./mouse-631-smoke-helpers.cjs');
const {screenCropGeometry}=require('./mouse-628-ui-smoke.cjs');
const BAND_ID='mouse627-native-transition-band',COLORS=[[199,37,77],[29,125,220]],DROP=[207,229,208];
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const IDENTITY_KEYS=Object.freeze(['id','webContentsId','navigationEpoch','url','width','height','timeOrigin','marker','field','scrollX','scrollY']);
function assertIdentities(before,after){
 assert.equal(after.length,before.length);for(let i=0;i<before.length;i++)for(const key of IDENTITY_KEYS)assert.deepEqual(after[i][key],before[i][key],'Retained ordinary desktop page keeps '+key);
}
function assertLiveSwitch(row){
 const {last}=row;assert.equal(last.strategy,'live');assert.equal(last.phase,'complete');assert.equal(last.presented,true);assert.equal(last.snapshotCaptures,0);assert.equal(last.animated,false);assert.equal(last.decoded,false);assert.equal(last.borrowedHold,false);assert.equal(last.layoutCalls,1);assert.equal(last.direction,row.direction);
 assert.deepEqual(Object.keys(row.counts).sort(),['capturePage','windowCapture','osAcquire','surfaceCapture','surfaceBegin'].sort());for(const value of Object.values(row.counts))assert.equal(value,0,'An ordinary switch must not capture or hold native surfaces');assert.deepEqual(row.captureEvents,[]);
 assert.ok(row.nativeLayoutCalls>0&&row.nativeLayoutCalls<=8,'Actual native layout calls stay bounded independently of presentation');assert.equal(row.desktopId,row.to);assert.equal(row.overlayCount,0);assert.equal(row.visibility,'');assert.equal(row.sliding,false);assert.equal(row.switching,false);assert.equal(row.inert,false);assert.equal(row.surfaceHeld,false);assert.equal(row.retainedSurfaces,0);assert.equal(row.samePageObjects,true);assert.equal(row.sameWebContents,true);
 assertIdentities(row.pageBefore,row.pageAfter);assert.equal(row.native.filter(page=>page.visible).length,1);assert.equal(row.native.find(page=>page.visible).desk,row.to);assert.ok(row.native.every(page=>page.visible===page.logicalVisible&&page.visible===page.clipVisible));
}
function observeCaptureCalls({app,win,globalCapture,surface,contents,onCall}){
 const restorers=[],wrapped=new Set();
 function wrap(object,key,kind,details={}){const original=object?.[key];assert.equal(typeof original,'function','Actual '+kind+' observation is available');object[key]=function(...args){onCall({kind,...details,at:performance.now()});return original.apply(this,args);};restorers.push(()=>{object[key]=original;});}
 function page(wc){if(wrapped.has(wc)||wc.isDestroyed())return;wrapped.add(wc);wrap(wc,'capturePage','capturePage',{webContentsId:wc.id});}
 for(const wc of contents.getAllWebContents())page(wc);
 wrap(win,'capturePage','windowCapture');wrap(globalCapture,'acquire','osAcquire');wrap(surface,'capture','surfaceCapture');wrap(surface,'begin','surfaceBegin');
 const listener=(_event,wc)=>page(wc);app.on('web-contents-created',listener);
 return()=>{app.removeListener('web-contents-created',listener);for(const restore of restorers.reverse())restore();};
}
function paintReadback(){
 const band=document.getElementById('mouse627-native-transition-band'),drop=document.querySelector('#drop'),box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const b=box(band),d=box(drop),x=Math.floor((Math.max(0,d.x)+Math.min(innerWidth,d.x+d.width))/2),y=Math.floor((Math.max(0,d.y)+Math.min(innerHeight,d.y+d.height))/2);
 return{url:location.href,timeOrigin:performance.timeOrigin,marker:window.marker,field:document.querySelector('#kept').value,scrollX,scrollY,width:innerWidth,height:innerHeight,band:{bounds:b,color:getComputedStyle(band).backgroundColor},drop:{bounds:d,color:getComputedStyle(drop).backgroundColor,point:{x,y},hit:document.elementFromPoint(x,y)===drop}};
}
function paintProbes(dom,index){
 assert.ok(Number.isInteger(index)&&index>=0&&index<COLORS.length);assert.equal(dom.scrollX,0);assert.equal(dom.scrollY,137);assert.equal(dom.band.color,'rgb('+COLORS[index].join(', ')+')');assert.equal(dom.drop.color,'rgb('+DROP.join(', ')+')');assert.equal(dom.drop.hit,true);
 assert.ok(dom.band.bounds.width>=32&&dom.band.bounds.height>=8&&dom.band.bounds.y===0);
 const probes=[.2,.5,.8].map(fraction=>({kind:'band',x:dom.band.bounds.x+dom.band.bounds.width*fraction,y:4,expectedRGB:COLORS[index]}));
 for(const [dx,dy]of [[0,0],[-6,0],[6,0],[0,-6],[0,6]]){const x=dom.drop.point.x+dx,y=dom.drop.point.y+dy;assert.ok(x>dom.drop.bounds.x&&x<dom.drop.bounds.x+dom.drop.bounds.width&&y>dom.drop.bounds.y&&y<dom.drop.bounds.y+dom.drop.bounds.height);probes.push({kind:'scrolled-content',x,y,expectedRGB:DROP});}
 assert.ok(probes.every(p=>p.x>=0&&p.x<dom.width&&p.y>=0&&p.y<dom.height));return probes;
}

module.exports=async({app,win,browser,globalCapture,pages,prepared,leftDesk='desk-1',rightDesk='desk-3'})=>{
 const js=code=>bounded(win.webContents.executeJavaScript(code),12000,'636 live desktop shell'),surface=browser.mouseDesktops.surfaces;
 const initial=await js('({theme:MouseTest.model.theme,desk:MouseTest.model.desktopId})'),objects=new Map(pages.map(id=>{const page=browser.get(id);return[id,{page,wc:page.view.webContents}];}));
 const facts={schema:1,contract:'mouse636-live-desktop-transition-v1',version:app.getVersion(),platform:process.platform,arch:process.arch,packaged:app.isPackaged,profileIsolated:false,preparation:prepared,ok:false,restored:false,transitions:[],cleanupErrors:[]},file='mouse-636-desktop-transition.json',save=()=>fs.writeFile(file,JSON.stringify(facts,null,2)+'\n');
 const saved=[];let active=null,dispose,error;
 async function until(check,label,ms=12000){const end=performance.now()+ms;do{if(await check())return;await sleep(25);}while(performance.now()<end);throw Error('636 live desktop timeout: '+label);}
 async function pins(){return Promise.all(pages.map(async id=>{const page=browser.get(id),wc=page.view.webContents,bounds=page.view.getBounds();return{id,webContentsId:wc.id,navigationEpoch:page.navigationEpoch||0,url:wc.getURL(),width:bounds.width,height:bounds.height,...await bounded(wc.executeJavaScript('({timeOrigin:performance.timeOrigin,marker:window.marker,field:document.querySelector("#kept").value,scrollX,scrollY})'),5000,'636 live page identity')};}));}
 function native(id){const page=browser.get(id),view=page.view.getBounds(),clip=page.clipView?.getBounds(),actual={x:view.x+(clip?.x||0),y:view.y+(clip?.y||0),width:view.width,height:view.height};assert.deepEqual(actual,page.bounds);return{id,desk:browser.mouseDesktops.bank.members[id],webContentsId:page.view.webContents.id,bounds:{...page.bounds},viewBounds:view,clipBounds:clip||null,logicalVisible:!!page.visible,visible:page.view.getVisible(),clipVisible:page.clipView?.getVisible()??page.view.getVisible(),attached:win.contentView.children.includes(page.clipView||page.view)};}
 async function capture(row){
  assert.equal(active,null,'OS proof is acquired only after the measured switch interval');assert.equal(globalCapture.permission(),process.platform==='darwin'?'granted':'not-required');
  const target=pages.find(id=>browser.mouseDesktops.bank.members[id]===row.to),index=pages.indexOf(target),page=browser.get(target),wc=page.view.webContents,state=native(target),contentBounds=win.getContentBounds(),display=screen.getDisplayMatching(win.getBounds());assert.ok(state.visible&&state.logicalVisible&&state.clipVisible&&state.attached);assert.ok(containsRect(display.workArea,contentBounds));
  const dom=await bounded(wc.executeJavaScript(`(${paintReadback.toString()})()`),5000,'636 actual selected page paint points'),local=paintProbes(dom,index);assert.equal(dom.url,wc.getURL());assert.equal(dom.marker,row.pageAfter[index].marker);assert.equal(dom.timeOrigin,row.pageAfter[index].timeOrigin);
  const attempts=[],begin=performance.now();let last;
  for(let sequence=1;sequence<=10&&performance.now()-begin<4000;sequence++){
   assert.deepEqual(win.getContentBounds(),contentBounds);assert.deepEqual(native(target),state);
   const frame=await bounded(globalCapture.acquire(display),4500,'636 selected live page OS capture');assert.equal(frame.kind,'screen');assert.ok(frame.backend);
   const full=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64'),screenPixelSize={width:full.readUInt32BE(16),height:full.readUInt32BE(20)},image=nativeImage.createFromBuffer(full),geometry=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),cropped=image.crop(geometry.cropPixels),png=cropped.toPNG({scaleFactor:1}),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},bitmap=cropped.toBitmap({scaleFactor:1});assert.equal(bitmap.length,pixelSize.width*pixelSize.height*4);
   const probes=local.map(point=>{const cssPoint={x:state.bounds.x+point.x,y:state.bounds.y+point.y},x=Math.floor(geometry.mapping.originX+cssPoint.x*geometry.mapping.scaleX),y=Math.floor(geometry.mapping.originY+cssPoint.y*geometry.mapping.scaleY);assert.ok(x>=0&&x<pixelSize.width&&y>=0&&y<pixelSize.height);const offset=(y*pixelSize.width+x)*4;return{...point,localPoint:{x:point.x,y:point.y},cssPoint,x,y,actualRGBA:[bitmap[offset+2],bitmap[offset+1],bitmap[offset],bitmap[offset+3]],tolerance:2};});
   const accepted=probes.every(probe=>probe.actualRGBA[3]===255&&probe.actualRGBA.slice(0,3).every((value,i)=>Math.abs(value-probe.expectedRGB[i])<=2));attempts.push({sequence,elapsedMs:performance.now()-begin,accepted});last={full,png,kind:frame.kind,backend:frame.backend,screenPixelSize,...geometry,pixelSize,probes};if(accepted)break;
  }
  assert.ok(last);const filename='mouse-636-desktop-transition-'+row.theme+'-'+(row.direction>0?'forward':'back')+'.png',displayFilename=filename.replace(/\.png$/,'-display.png');await fs.writeFile(filename,last.png);await fs.writeFile(displayFilename,last.full);
  const receipt={filename,sha256:sha256(last.png),displayFilename,displaySha256:sha256(last.full),source:'globalCapture.acquire(display)',kind:last.kind,backend:last.backend,display:{id:display.id,bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor},contentBounds,screenPixelSize:last.screenPixelSize,cropPixels:last.cropPixels,mapping:last.mapping,pixelSize:last.pixelSize,native:state,dom,probes:last.probes,attempts};row.capture=receipt;await save();assert.equal(attempts.at(-1).accepted,true,'Actual OS pixels show the selected live page band and its scrolled content');assert.deepEqual(native(target),state);assertIdentities(row.pageAfter,await pins());return receipt;
 }
 try{
  assert.equal(process.env.CI,'true');assert.ok(path.isAbsolute(process.env.MOUSE_TEST_PROFILE||''));assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));assert.equal(app.isPackaged,true);assert.ok(['6.0.36','6.0.45'].includes(app.getVersion()),'Retained636 acceptance requires636 or637');assert.equal(pages.length,2);assert.equal(prepared?.length,2);assert.equal(initial.desk,leftDesk);assert.equal(browser.mouseSurfaceHold,null);facts.profileIsolated=true;
  for(let index=0;index<pages.length;index++){
   const id=pages[index],page=browser.get(id),wc=page.view.webContents,row=prepared[index];assert.equal(row.id,id);assert.equal(row.index,index);assert.equal(row.ready,true);assert.equal(row.native.selectedDesktop,index===0?rightDesk:leftDesk);assert.equal(row.native.webContentsId,wc.id);assert.equal(row.native.epoch,page.navigationEpoch||0);assert.equal(row.native.url,wc.getURL());assert.deepEqual(row.native.bounds,page.view.getBounds());saved.push({id,...row.original});
  }
  dispose=observeCaptureCalls({app,win,globalCapture,surface,contents:webContents,onCall:event=>{if(active){active.counts[event.kind]++;active.captureEvents.push(event);}}});
  for(const theme of ['light','dark'])for(const direction of [1,-1]){
   await js('MouseTest.setTheme('+JSON.stringify(theme)+');new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   const from=await js('MouseTest.model.desktopId'),to=direction>0?rightDesk:leftDesk;assert.notEqual(from,to);assert.equal(browser.mouseSurfaceHold,null);assert.equal(await js('document.querySelector("#desktop-tray").hidden&&!MouseTest.model.switching&&!MouseTest.model.desktopSliding'),true);
   const row={theme,direction,from,to,mainTimeOrigin:performance.timeOrigin,startedAt:performance.now(),counts:{capturePage:0,windowCapture:0,osAcquire:0,surfaceCapture:0,surfaceBegin:0},captureEvents:[],pageBefore:await pins(),nativeBefore:pages.map(native),layoutCallsBefore:browser.mouseLayoutCalls||0};facts.transitions.push(row);await save();active=row;
   await js('MouseTest.switchDesktop('+JSON.stringify(to)+')');await until(()=>js('!MouseTest.model.switching&&!MouseTest.model.desktopSliding&&MouseTest.model.desktopId==='+JSON.stringify(to)),'actual selected desktop');
   Object.assign(row,await js('({last:MouseDesktopSlide.last,desktopId:MouseTest.model.desktopId,overlayCount:document.querySelectorAll("#mouse-desktop-transition").length,visibility:document.querySelector("#workspace").style.visibility,sliding:MouseTest.model.desktopSliding,switching:MouseTest.model.switching,inert:document.querySelector("#workspace").inert})'));
   row.pageAfter=await pins();row.native=pages.map(native);row.nativeLayoutCalls=(browser.mouseLayoutCalls||0)-row.layoutCallsBefore;row.surfaceHeld=!!browser.mouseSurfaceHold;row.retainedSurfaces=surface.records.size;row.samePageObjects=pages.every(id=>browser.get(id)===objects.get(id).page);row.sameWebContents=pages.every(id=>browser.get(id).view.webContents===objects.get(id).wc);row.elapsedMs=performance.now()-row.startedAt;active=null;await save();assertLiveSwitch(row);await capture(row);
  }
 }catch(cause){error=cause;facts.error={message:cause.message,stack:cause.stack};}
 finally{
  active=null;dispose?.();const restore=async(label,action)=>{try{await action();}catch(cause){facts.cleanupErrors.push({label,message:cause.message});}};
  for(const item of saved)await restore('owned preparation '+item.id,async()=>{const page=browser.get(item.id);assert.ok(page&&!page.view.webContents.isDestroyed());await page.view.webContents.executeJavaScript('document.getElementById('+JSON.stringify(BAND_ID)+')?.remove();document.body.style.minHeight='+JSON.stringify(item.minHeight)+';scrollTo('+item.scrollX+','+item.scrollY+')');});
  await restore('initial theme and desktop',async()=>{await js('MouseTest.setTheme('+JSON.stringify(initial.theme)+')');if(await js('MouseTest.model.desktopId')!==initial.desk)await js('MouseTest.switchDesktop('+JSON.stringify(initial.desk)+')');assert.equal(await js('!MouseTest.model.desktopSliding&&!MouseTest.model.switching&&!document.querySelector("#mouse-desktop-transition")'),true);assert.equal(browser.mouseSurfaceHold,null);});
  facts.restored=!facts.cleanupErrors.length;facts.ok=!error&&facts.restored;await save();
 }
 if(error)throw error;assert.equal(facts.restored,true);console.log('MOUSE_636_LIVE_DESKTOP_TRANSITION_PASS');return facts;
};
Object.assign(module.exports,{prepareVisiblePage:require('./mouse-627-desktop-transition-smoke.cjs').prepareVisiblePage,IDENTITY_KEYS,assertIdentities,assertLiveSwitch,observeCaptureCalls,paintProbes,paintReadback});
