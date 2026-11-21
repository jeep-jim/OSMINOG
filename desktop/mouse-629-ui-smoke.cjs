'use strict';
// Reproduce the owner's dense pane junctions with owned, vivid native pages.
// Screen captures include WebContentsViews: shell-only screenshots cannot prove
// that Nora covers guests or that the native corner masks have no square rims.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {screen,nativeImage}=require('electron');
const {screenCropGeometry}=require('./mouse-628-ui-smoke.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const workspace633=require('./mouse-633-workspace-geometry.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),copy=value=>JSON.parse(JSON.stringify(value));
async function until(fn,label){for(let n=0;n<320;n++){if(await fn())return;await sleep(25);}throw Error('Mouse629 UI timeout: '+label);}
const COLORS=[[171,43,158],[24,117,150],[158,75,32],[75,89,158],[35,130,77],[143,52,86],[83,100,41]];
const PALETTE={light:{hex:'#c7cfdf',rgb:[199,207,223]},dark:{hex:'#43536b',rgb:[67,83,107]}};
const TREE={axis:'x',ratio:.53,a:{axis:'y',ratio:.82,a:{axis:'x',ratio:.39,a:{axis:'y',ratio:.47,a:{id:'p1'},b:{id:'p2'}},b:{id:'p3'}},b:{id:'p4'}},b:{axis:'x',ratio:.41,a:{axis:'y',ratio:.68,a:{id:'p5'},b:{id:'p6'}},b:{id:'p7'}}};
function sample(image,mapping,point,bitmap){
 const {size,bytes}=bitmap||{size:image.getSize(1),bytes:image.toBitmap({scaleFactor:1})},x=Math.floor(mapping.originX+point.x*mapping.scaleX),y=Math.floor(mapping.originY+point.y*mapping.scaleY);
 assert.ok(x>=0&&y>=0&&x<size.width&&y<size.height,'A sample remains in the real native window crop');
 assert.equal(bytes.length,size.width*size.height*4);const i=(y*size.width+x)*4;return{x,y,rgba:[bytes[i+2],bytes[i+1],bytes[i],bytes[i+3]]};
}
function matches(probe){return probe.rgba[3]===255&&probe.expected.every((v,i)=>Math.abs(v-probe.rgba[i])<=3);}
function fixtureControlsReadback(){
 const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 return{viewport:{width:innerWidth,height:innerHeight},title:rect('h2'),input:rect('input')};
}
function validateFixtureControls(geometry,bounds,points,factor){
 assert.ok(Number.isFinite(factor)&&factor>0);const {viewport}=geometry;
 assert.ok(Number.isFinite(viewport.width)&&Number.isFinite(viewport.height)&&viewport.width>0&&viewport.height>0);
 for(const name of ['title','input']){
  const r=geometry[name];assert.ok(r&&['x','y','width','height'].every(key=>Number.isFinite(r[key]))&&r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height-8,'Owned fixture '+name+' remains above the bottom pixel witness zone');
  for(const probe of points){const x=(probe.point.x-bounds.x)/factor,y=(probe.point.y-bounds.y)/factor;assert.ok(x>=0&&y>=0&&x<viewport.width&&y<viewport.height);assert.ok(!(x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height),'Owned fixture '+name+' does not cover the unchanged native page-interior probe');}
 }
 return true;
}
module.exports=async({app,win,browser,store,globalCapture,overlayGate,nativeInput})=>{
 assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 assert.equal(app.getVersion(),'6.0.36');assert.equal(globalCapture?.permission(),process.platform==='darwin'?'granted':'not-required');
 const js=source=>win.webContents.executeJavaScript(source),bank=browser.mouseDesktops.bank,original=await js('MouseTest.prefs()'),savedBank=bank.snapshot(),savedGlobal=copy(bank.global),before=new Set(browser.tabs.keys()),bounds=win.getBounds(),fullscreen=win.isFullScreen();
 const facts={version:app.getVersion(),baselineVersion:'6.0.27',platform:process.platform,arch:process.arch,paneCount:7,separators:[],nora:[],workspace633:{schema:1,gap:6,radius:12,aiScenes:[]},restored:false};
 const pages=[],extraPages=[];let server,verificationError,cleanupError;
 const painted=async()=>{await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(80);};
 async function activate(){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await until(()=>win.isFocused(),'window focus');}
 async function click(selector){
  await activate();const target=await js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}))`);assert.equal(target.ready,true,selector+' is a real native click target');
  const origin=win.getContentBounds();assert.equal((nativeInput||require('./mouse-native-menu.node')).testClick(Math.round(origin.x+target.x),Math.round(origin.y+target.y)),true);
 }
 function nativePaneCorners(){
  if(process.platform!=='win32'&&process.platform!=='linux')return;
  if(process.platform==='linux')try{return{native:browser.mouseCornerMask.state()};}catch(error){return{error:String(error.stack||error).slice(0,4000)};}
  try{return{electron:{windowBounds:win.getBounds(),contentBounds:win.getContentBounds(),contentViewBounds:win.contentView.getBounds(),visible:win.isVisible(),focused:win.isFocused(),surfaceHeld:!!browser.mouseSurfaceHold},native:require('./mouse-mcp-fs.node').paneCornersState(win.getNativeWindowHandle())};}
  catch(error){return{error:String(error.stack||error).slice(0,4000)};}
 }
 async function capture(name){
  const display=screen.getDisplayMatching(win.getBounds()),contentBounds=win.getContentBounds(),cornerStateBefore=nativePaneCorners(),frame=await globalCapture.acquire(display),cornerStateAfter=nativePaneCorners();
  assert.equal(frame.kind,'screen');assert.ok(frame.backend);assert.deepEqual({width:frame.width,height:frame.height},{width:display.bounds.width,height:display.bounds.height});assert.deepEqual(win.getContentBounds(),contentBounds);
  assert.match(frame.base,/^data:image\/png;base64,/);const screenPNG=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64'),screenPixelSize={width:screenPNG.readUInt32BE(16),height:screenPNG.readUInt32BE(20)},full=nativeImage.createFromBuffer(screenPNG);
  assert.deepEqual(full.getSize(1),screenPixelSize);const {cropPixels,mapping}=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),image=full.crop(cropPixels),png=image.toPNG({scaleFactor:1}),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
  assert.deepEqual(pixelSize,{width:cropPixels.width,height:cropPixels.height});
  const metadata={source:'globalCapture.acquire(display)',kind:frame.kind,backend:frame.backend,display:{id:display.id,bounds:{...display.bounds},scaleFactor:display.scaleFactor},contentBounds,screenPixelSize,cropPixels,pixelSize,mapping,capture:name+'.png',screenCapture:name+'-display.png'};
  if(process.platform==='win32'||process.platform==='linux')metadata.nativePaneCorners={before:cornerStateBefore,after:cornerStateAfter};
  await fs.writeFile(metadata.capture,png);await fs.writeFile(metadata.screenCapture,screenPNG);return{image,metadata,bitmap:{size:image.getSize(1),bytes:image.toBitmap({scaleFactor:1})}};
 }
 async function identities(){return Promise.all(pages.map(async page=>({id:page.id,webContentsId:page.view.webContents.id,url:page.view.webContents.getURL(),epoch:page.navigationEpoch||0,bounds:page.bounds,clip:page.clipView?.getBounds()||null,...await page.view.webContents.executeJavaScript('({timeOrigin:performance.timeOrigin,identity:globalThis.mouse629Identity,field:document.querySelector("input").value,width:innerWidth,height:innerHeight,scrollX,scrollY})')})));}
 async function fixtureControls(row,targets,points){
  row.fixtureControls=await Promise.all(targets.map(async page=>({id:page.id,webContentsId:page.view.webContents.id,bounds:{...page.bounds},factor:page.view.webContents.getZoomFactor(),...await page.view.webContents.executeJavaScript('('+fixtureControlsReadback.toString()+')()')})));
  for(const item of row.fixtureControls)validateFixtureControls(item,item.bounds,points.filter(probe=>probe.id===item.id&&['page-interior','ai-bottom-interior'].includes(probe.kind)),item.factor);
 }
 async function workspaceScene(theme,aiPage){
  const geometry=await js('('+workspace633.workspaceReadback.toString()+')()');workspace633.validateGeometry(geometry,{ai:!!aiPage});
  const native=[...pages,...(aiPage?[aiPage]:[])].map(page=>workspace633.nativePanel(page,win));workspace633.validateNative(geometry,native);
  return{geometry,nativePanels:native,identityBefore:await identities(),identityAfter:null,probes:[],points:workspace633.geometryPoints(geometry,PALETTE[theme].rgb,theme==='light'?[255,255,255]:[25,33,46])};
 }
 function workspacePixels(row,captured){if(process.platform==='linux')for(const phase of ['before','after'])workspace633.validateLinuxMasks(captured.metadata.nativePaneCorners[phase].native,row.nativePanels.length);row.probes=row.points.map(point=>({...point,...sample(captured.image,captured.metadata.mapping,point.point,captured.bitmap)}));return row.probes.every(matches);}
 async function finishWorkspace(row){row.identityAfter=await identities();assert.deepEqual(row.identityAfter,row.identityBefore,'Workspace pixels preserve native page identities and viewports');workspace633.validateNative(row.geometry,[...pages,...extraPages.filter(page=>page.visible)].map(page=>workspace633.nativePanel(page,win)));delete row.points;for(const probe of row.probes)assert.ok(matches(probe),'Current633 workspace gap/corner pixels: '+JSON.stringify(probe));}
 async function separators(theme,variant){
  const expected=PALETTE[theme],geometry=await js(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{actualToken:getComputedStyle(document.documentElement).getPropertyValue('--line').trim(),stageColor:getComputedStyle(document.querySelector('#stage')).backgroundColor,dividerColors:[...document.querySelectorAll('#stage .divider')].map(e=>getComputedStyle(e).backgroundColor),dividers:[...document.querySelectorAll('#stage .divider')].map(rect),panes:[...document.querySelectorAll('#stage .pane')].map(e=>({id:MouseTest.model.slots[e.dataset.pane],slot:rect(e.querySelector('.page-slot')),roundBottom:parseFloat(e.style.getPropertyValue('--pane-round-bottom'))||0})),viewport:{width:innerWidth,height:innerHeight}};})()`);
  assert.equal(geometry.actualToken,expected.hex);assert.equal(geometry.stageColor,'rgb('+expected.rgb.join(', ')+')');assert.equal(geometry.panes.length,7);assert.ok(geometry.dividers.length>=6);assert.ok(geometry.dividerColors.every(color=>color==='rgb('+expected.rgb.join(', ')+')'));
  const points=[];
  for(const r of geometry.dividers)for(const fraction of [.2,.5,.8])points.push({kind:'divider',point:{x:r.x+r.width*(r.width>r.height?fraction:.5),y:r.y+r.height*(r.height>r.width?fraction:.5)},expected:expected.rgb});
  for(const [index,page]of pages.entries()){
   const pane=geometry.panes.find(p=>p.id===page.id),r=page.bounds;assert.ok(r&&page.visible&&page.view.getVisible());
   if(pane.roundBottom!==12)continue;
   for(const side of ['left','right']){
    // Probe the whole square-corner cutout, away from the antialiased arc.
    for(const u of [.65,1.6,3])for(const v of [.65,1.6,3])if(Math.hypot(12-u,12-v)>13.5)points.push({kind:'corner-cutout',id:page.id,side,guestBounds:{...r},point:{x:side==='left'?r.x+u:r.x+r.width-u,y:r.y+r.height-v},expected:expected.rgb});
    points.push({kind:'page-interior',id:page.id,side,guestBounds:{...r},point:{x:side==='left'?r.x+20:r.x+r.width-20,y:r.y+r.height-3},expected:COLORS[index]});
   }
  }
  assert.ok(points.filter(p=>p.kind==='corner-cutout').length>=20,'Dense fixture covers several independent native junctions');
  const row={theme,variant,expectedHex:expected.hex,expectedRGB:expected.rgb,actualToken:geometry.actualToken,stageColor:geometry.stageColor,dividerColors:geometry.dividerColors,paneCount:7,viewport:geometry.viewport,nativePanels:pages.map(page=>({id:page.id,bounds:page.bounds})),probes:[],workspace633:await workspaceScene(theme)};facts.separators.push(row);
  await fixtureControls(row,pages,points);
  for(let attempt=0;attempt<15;attempt++){
   if(attempt)await sleep(100);const captured=await capture('mouse-629-separators-'+theme+'-'+variant);row.nativeCapture=captured.metadata;row.probes=points.map(p=>({...p,...sample(captured.image,captured.metadata.mapping,p.point,captured.bitmap)}));row.attempts=attempt+1;
   if(row.probes.every(matches)&&workspacePixels(row.workspace633,captured))break;
  }
  for(const p of row.probes)assert.ok(matches(p),'The displayed native junction matches its original627 divider/page colour: '+JSON.stringify({theme,variant,probe:p}));await finishWorkspace(row.workspace633);return row;
 }
 async function aiGeometry(theme){
  const before=await identities(),windowBefore=win.getContentBounds(),saved=await js('JSON.parse(JSON.stringify({aiOpen:MouseTest.model.aiOpen,aiId:MouseTest.model.aiId,aiSessions:MouseTest.model.aiSessions,aiSites:MouseTest.model.aiSites,active:MouseTest.model.active,focusAI:MouseTest.model.focusAI}))'),url='http://127.0.0.1:'+server.address().port+'/ai';
  await js('MouseTest.openAI('+JSON.stringify(url)+')');const id=await js('MouseTest.model.aiId'),page=browser.get(id);assert.ok(!before.some(row=>row.id===id)&&!extraPages.includes(page));extraPages.push(page);
  await until(()=>!page.loading&&!page.error&&page.visible&&page.view.getVisible(),'native AI geometry fixture');await painted();
  const wc=page.view.webContents,identity=async()=>({id:page.id,webContentsId:wc.id,...await wc.executeJavaScript('({url:location.href,timeOrigin:performance.timeOrigin,identity:mouse629Identity,field:document.querySelector("input").value})')});
  const row={theme,variant:'ai',url,windowBefore,windowAfter:null,aiIdentityBefore:await identity(),aiIdentityAfter:null,beforePages:before,afterPages:null,restored:false,closed:false,...await workspaceScene(theme,page)};facts.workspace633.aiScenes.push(row);
  const bounds=page.bounds;
  for(const side of ['left','right']){
   for(const u of [.65,1.6,3])for(const v of [.65,1.6,3])if(Math.hypot(12-u,12-v)>13.5)row.points.push({kind:'ai-bottom-cutout',id,side,guestBounds:{...bounds},point:{x:side==='left'?bounds.x+u:bounds.x+bounds.width-u,y:bounds.y+bounds.height-v},expected:PALETTE[theme].rgb});
   row.points.push({kind:'ai-bottom-interior',id,side,guestBounds:{...bounds},point:{x:side==='left'?bounds.x+20:bounds.x+bounds.width-20,y:bounds.y+bounds.height-3},expected:workspace633.AI_COLOR});
  }
  await fixtureControls(row,[...pages,page],row.points);
  for(let attempt=0;attempt<15;attempt++){if(attempt)await sleep(100);const captured=await capture('mouse-633-workspace-ai-'+theme);row.nativeCapture=captured.metadata;row.attempts=attempt+1;if(workspacePixels(row,captured))break;}
  await finishWorkspace(row);row.aiIdentityAfter=await identity();assert.deepEqual(row.aiIdentityAfter,row.aiIdentityBefore);assert.equal(row.aiIdentityBefore.url,url);
  row.input=[];
  for(const target of [pages[0],page]){
   await activate();const beforeCount=await target.view.webContents.executeJavaScript('mouse633WorkspaceInputs.length'),native=workspace633.nativePanel(target,win),factor=target.view.webContents.getZoomFactor(),origin=win.getContentBounds(),side=target===page?'left':'right',point={x:Math.round(origin.x+native.bounds.x+(side==='left'?2:native.bounds.width-2)),y:Math.round(origin.y+native.bounds.y+native.bounds.height-2)};
   assert.equal((nativeInput||require('./mouse-native-menu.node')).testClick(point.x,point.y),true);
   let event;await until(async()=>{event=await target.view.webContents.executeJavaScript('mouse633WorkspaceInputs['+beforeCount+']');return event?.trusted===true;},'real input passes the transparent native corner overlay');
   const expected={x:(point.x-origin.x-native.bounds.x)/factor,y:(point.y-origin.y-native.bounds.y)/factor};assert.ok(Math.abs(event.x-expected.x)<=1.5&&Math.abs(event.y-expected.y)<=1.5);
   row.input.push({id:target.id,webContentsId:target.view.webContents.id,side,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',point,contentBounds:origin,guestBounds:native.bounds,factor,expectedClient:expected,event});
  }
  await js('Object.assign(MouseTest.model,'+JSON.stringify(saved)+');MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()');await browser.command('close',{id});await until(()=>wc.isDestroyed()&&!browser.tabs.has(id),'owned AI fixture closed');row.closed=wc.isDestroyed();assert.equal(row.closed,true);extraPages.splice(extraPages.indexOf(page),1);await painted();await until(()=>pages.every(item=>item.visible&&item.view.getVisible()),'main pages after AI geometry');row.afterPages=await identities();assert.deepEqual(row.afterPages,before,'AI geometry fixture restores all seven live page viewports');row.windowAfter=win.getContentBounds();assert.deepEqual(row.windowAfter,windowBefore);row.restored=true;
 }
 async function nora(theme){
  const beforeIdentity=await identities();await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'Nora fully opens');await painted();
  assert.ok(browser.mouseSurfaceHold);assert.equal(overlayGate.blocked,true);
  const nativeHidden=pages.map(page=>({id:page.id,view:page.view.getVisible(),clip:page.clipView?.getVisible()??null}));assert.ok(nativeHidden.every(p=>p.view===false&&(p.clip===null||p.clip===false)));
  assert.ok([...browser.tabs.values(),...browser.providers.values()].every(page=>!page.view.getVisible()&&(!page.clipView||!page.clipView.getVisible())),'Every native guest is hidden, including inactive and AI guests');
  const guests=pages.map(page=>({id:page.id,bounds:page.bounds})),geometry=await js(`(()=>{const surface=document.querySelector('#mouse-dock-surface'),fill=document.querySelector('#mouse-dock-fill'),content=document.querySelector('.desk-content'),r=surface.getBoundingClientRect(),c=content.getBoundingClientRect(),padding=getComputedStyle(content),guests=${JSON.stringify(guests)},points=[];const inside=(x,y)=>fill.isPointInFill(new DOMPoint(x-r.left,y-r.top));for(const x of [c.left+parseFloat(padding.paddingLeft)*.5,c.right-parseFloat(padding.paddingRight)*.5])for(const f of [.55,.65,.75,.85,.92]){const y=r.top+r.height*f;if(document.elementFromPoint(x,y)!==content)continue;if(![[0,0],[2,0],[-2,0],[0,2],[0,-2]].every(([dx,dy])=>inside(x+dx,y+dy)))continue;const guest=guests.find(g=>x>g.bounds.x+4&&x<g.bounds.x+g.bounds.width-4&&y>g.bounds.y+4&&y<g.bounds.y+g.bounds.height-4);if(guest)points.push({point:{x,y},overlapGuestId:guest.id,guestBounds:guest.bounds});}return{panelFill:getComputedStyle(fill).fill.match(/[\\d.]+/g).slice(0,3).map(Number),panelBounds:{x:r.x,y:r.y,width:r.width,height:r.height},points,snapshots:[...document.querySelectorAll('.mouse-floating-snapshot')].map(e=>({id:e.dataset.tabId,complete:e.complete,width:e.naturalWidth,height:e.naturalHeight})),stroke:getComputedStyle(document.querySelector('#mouse-dock-outline')).stroke};})()`);
  assert.ok(geometry.points.length>=3,'At least three blank Nora-fill positions overlap real guest viewports');assert.equal(geometry.snapshots.length,7);assert.ok(geometry.snapshots.every(p=>p.complete&&p.width>0&&p.height>0));assert.equal(geometry.stroke,'none');
  const row={theme,holdActive:true,overlayBlocked:true,nativeHidden,snapshots:geometry.snapshots,panelFill:geometry.panelFill,panelBounds:geometry.panelBounds,probes:[],identityPreserved:false,boundsPreserved:false};facts.nora.push(row);
  for(let attempt=0;attempt<15;attempt++){
   if(attempt)await sleep(100);const captured=await capture('mouse-629-nora-'+theme);row.nativeCapture=captured.metadata;row.probes=geometry.points.map(p=>({...p,kind:'nora-fill',expected:geometry.panelFill,...sample(captured.image,captured.metadata.mapping,p.point,captured.bitmap)}));row.attempts=attempt+1;if(row.probes.every(matches))break;
  }
  for(const p of row.probes)assert.ok(matches(p),'Nora fill, rather than native guest pixels, is actually presented above the page: '+JSON.stringify({theme,probe:p}));
  assert.deepEqual(await identities(),beforeIdentity,'Nora preserves native page identity, viewport, fields, scroll and bounds while open');
  await click('#desks-close');await until(()=>js('document.querySelector("#desktop-tray").hidden&&!document.querySelector("#desktop-tray").open&&!document.querySelector(".mouse-floating-snapshot")'),'Nora closes');await until(()=>pages.every(page=>page.visible&&page.view.getVisible()),'all seven guests return');
  assert.deepEqual(await identities(),beforeIdentity);row.identityPreserved=true;row.boundsPreserved=true;
 }
 try{
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');await until(()=>!browser.mouseSurfaceHold,'previous overlays release');
  if(fullscreen){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'exit fullscreen');}
  const work=screen.getDisplayMatching(bounds).workArea,initialBounds={x:work.x+8,y:work.y+8,width:Math.min(1443,work.width-16),height:Math.min(917,work.height-16)};
  win.setBounds(initialBounds);await activate();await painted();
  server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}const ai=req.url==='/ai',index=ai?7:Number(req.url.slice(1));assert.ok(Number.isInteger(index)&&index>=0&&index<(ai?8:7));res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>Mouse629 pane '+index+'</title><style>html,body{margin:0;min-height:100%;background:rgb('+(ai?workspace633.AI_COLOR:COLORS[index]).join(',')+');color:white;font:14px sans-serif}h2{position:absolute;left:12px;right:12px;top:6px;height:18px;margin:0;overflow:hidden;white-space:nowrap;font:600 16px/18px sans-serif}input{box-sizing:border-box;position:absolute;left:12px;top:28px;width:min(160px,calc(100% - 24px));height:20px;margin:0;padding:1px 2px;font:12px/16px sans-serif}</style><h2>Native pane '+index+'</h2><input value="retained-'+index+'"><script>globalThis.mouse629Identity=Math.random();globalThis.mouse633WorkspaceInputs=[];document.addEventListener("pointerdown",event=>{mouse633WorkspaceInputs.push({trusted:event.isTrusted,x:event.clientX,y:event.clientY,at:performance.now()})})</script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));for(let i=0;i<7;i++){const opened=await browser.command('open',{url:'http://127.0.0.1:'+server.address().port+'/'+i,lane:'main'});pages.push(browser.get(opened.id));}
  await until(()=>pages.every(page=>!page.loading&&!page.error),'seven native fixture pages load');
  const leaves=require('./mouse/layout.js').leaves(TREE),slots=Object.fromEntries(leaves.map((id,i)=>[id,pages[i].id]));
  await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(TREE)},slots:${JSON.stringify(slots)},active:'p1',aiOpen:false,agentOpen:false,libraryOpen:false,focusPane:'',focusAI:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);await until(()=>pages.every(page=>page.visible),'seven native panes visible');
  for(const theme of ['light','dark']){
   win.setBounds(initialBounds);await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await painted();await separators(theme,'initial');
   win.setBounds({...initialBounds,width:initialBounds.width-37,height:initialBounds.height-23});await painted();await separators(theme,'resized');await nora(theme);await aiGeometry(theme);
  }
 }catch(error){
  verificationError=error;facts.error=error.stack||String(error);
  facts.failure={renderer:await js('({viewport:{width:innerWidth,height:innerHeight},phase:document.querySelector("#desktop-tray").dataset.motion,open:document.querySelector("#desktop-tray").open,hidden:document.querySelector("#desktop-tray").hidden,motion:MouseTest.desktopUI.motion.diagnostics?.(),backdrop:MouseTest.desktopUI.diagnostics?.(),snapshotCount:document.querySelectorAll(".mouse-floating-snapshot").length,panes:[...document.querySelectorAll("#stage .pane")].map(e=>{const r=e.querySelector(".page-slot").getBoundingClientRect();return{id:MouseTest.model.slots[e.dataset.pane],bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};})})').catch(e=>({error:e.message})),native:{surfaces:browser.mouseDesktops.surfaces.diagnostics?.(),overlayBlocked:overlayGate.blocked,surfaceHeld:!!browser.mouseSurfaceHold,pages:pages.map(page=>({id:page.id,bounds:page.bounds,visible:page.visible,nativeVisible:page.view.getVisible()}))}};
  try{facts.failure.nativeCapture=(await capture('mouse-629-ui-failure')).metadata;}catch(e){facts.failure.captureError=e.message;}
  throw error;
 }
 finally{
  try{
   await js('MouseTest.desktopUI.close({immediate:true})');await until(()=>!browser.mouseSurfaceHold,'cleanup releases Nora');await js('MouseFlush()');
   for(const page of [...pages,...extraPages])if(browser.tabs.has(page.id)&&!before.has(page.id))await browser.command('close',{id:page.id});
   await js('MouseFlush()');bank.items=copy(savedBank.items);bank.members=Object.assign(Object.create(null),savedBank.members);bank.active=savedBank.active;bank.global=savedGlobal;bank.recovery=savedBank.recovery?copy(savedBank.recovery):null;bank.historyGroups.clear();bank.historyLiveKey='';browser.mouseDesktops.previews.clear();
   await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);browser.emit();await browser.save();await browser.saveQueue;await store.queue;win.setBounds(bounds);if(fullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'restore fullscreen');}
   assert.deepEqual([...browser.tabs.keys()].sort(),[...before].sort());assert.deepEqual(bank.snapshot(),savedBank,'Dense native fixture restores the original desktop bank');assert.deepEqual(await js('MouseTest.prefs()'),original,'Dense native fixture restores the original preferences');facts.restored=true;
  }catch(error){cleanupError=error;facts.cleanupError=error.stack||String(error);}
  server?.closeAllConnections?.();server?.close();await fs.writeFile('mouse-629-ui-regressions.json',JSON.stringify(facts,null,2)+'\n');if(cleanupError&&!verificationError)throw cleanupError;
 }
 try{
  facts.scrollbars=await require('./mouse-629-scrollbars-smoke.cjs')({app,win,browser,store});
 }catch(error){facts.scrollbars=error.scrollbarEvidence||facts.scrollbars;facts.error=error.stack||String(error);throw error;}
 finally{for(const row of facts.scrollbars?.themes||[]){const shot=row.screenshot;if(path.resolve(shot.path)!==path.resolve(shot.filename))await fs.copyFile(shot.path,shot.filename);}await fs.writeFile('mouse-629-ui-regressions.json',JSON.stringify(facts,null,2)+'\n');}
 console.log('MOUSE_629_UI_REGRESSIONS_NATIVE_PASS');return facts;
};
module.exports.fixtureControlsReadback=fixtureControlsReadback;
module.exports.validateFixtureControls=validateFixtureControls;
