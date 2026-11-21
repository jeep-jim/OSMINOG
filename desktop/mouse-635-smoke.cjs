'use strict';
// New owner635 checks run in their own installed-app profile and process.
// Public search uses the production IPC/transport; local files are owned fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {screen,nativeImage}=require('electron');
const {createFixture,bounded,sha256}=require('./mouse-631-smoke-helpers.cjs');
const {screenCropGeometry}=require('./mouse-628-ui-smoke.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {installInputProbe}=require('./mouse-633-smoke-helpers.cjs');

module.exports=async ctx=>{
 const {app,win,libraryService,globalCapture,tileSearch}=ctx;
 const budgetMs=240000,started=Date.now(),exit=require('./mouse-smoke-exit.cjs')({app,win});
 const facts={schema:1,version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,
  packaged:app.isPackaged,profileIsolated:false,budgetMs,source:'Installed Electron production public-search IPC and owned local file updates with actual native input',
  stage:'identity',ok:false,restored:false,physicalUserDeviceVerified:false,nativeInputs:[],captures:[]};
 const file='mouse-635-owner-feedback.json';
 const save=()=>bounded(fs.writeFile(file,JSON.stringify(facts,null,2)+'\n'),2500,'635 evidence write');
 const diagnosticSave=async()=>{try{await save();}catch(cause){(facts.evidenceWriteErrors||=[]).push({stage:facts.stage,message:cause.message});}};
 let fixture,nativeInput,originalLibrary,error,cleanupError;
 const watchdog=setTimeout(()=>{error||=Error('Mouse635 fixed 240000 ms native budget exceeded');facts.ok=false;facts.error||={stage:facts.stage,message:error.message};void diagnosticSave().finally(()=>exit(1));},budgetMs);
 const stage=async(name,work)=>{facts.stage=name;await save();console.log('MOUSE_635_STAGE '+name);return work();};
 async function focus(){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await fixture.until(()=>win.isFocused(),'635 window focus');}
 async function click(selector,{navigates=false,xFraction=.5,yFraction=.5}={}){
  await focus();await fixture.js(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',inline:'nearest'});true`);await fixture.frame();let hit;
  await fixture.until(async()=>{hit=await fixture.js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}),${JSON.stringify({xFraction,yFraction})})`);return hit.ready;},'635 native target '+selector);
  await fixture.js(`__mouse633Input.begin(${JSON.stringify(selector)})`);
  const origin=win.getContentBounds(),point={x:Math.round(origin.x+hit.x),y:Math.round(origin.y+hit.y)};
  assert.equal(await nativeInput.testClick(point.x,point.y),true);
  const result={selector,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',point,at:Date.now(),navigates};facts.nativeInputs.push(result);
  if(!navigates){await fixture.until(async()=>{result.events=await fixture.js('__mouse633Input.read()');return result.events.some(event=>event.type==='click'&&event.trusted&&event.matches);},'635 trusted click '+selector);await fixture.frame();}
  await save();return result;
 }
 async function screenCapture(filename,kind){
  if(!filename.endsWith('.png'))filename+='.png';kind||=filename;
  assert.match(filename,/^mouse-635-[a-z0-9-]+\.png$/);
  await fixture.frame();const display=screen.getDisplayMatching(win.getBounds()),contentBounds=win.getContentBounds();
  const frame=await bounded(globalCapture.acquire(display),4500,'635 actual OS pixels');assert.equal(frame.kind,'screen');
  const full=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64'),screenPixelSize={width:full.readUInt32BE(16),height:full.readUInt32BE(20)};
  const geometry=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),png=nativeImage.createFromBuffer(full).crop(geometry.cropPixels).toPNG({scaleFactor:1});
  await fs.writeFile(filename,png);const displayFilename=filename.replace(/\.png$/,'-display.png');await fs.writeFile(displayFilename,full);
  const capture={filename,displayFilename,displaySha256:sha256(full),screenPixelSize,kind,source:'globalCapture.acquire(display)',backend:frame.backend,sha256:sha256(png),bytes:png.length,
   pixelSize:{width:png.readUInt32BE(16),height:png.readUInt32BE(20)},contentBounds,display:{id:display.id,bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor},cropPixels:geometry.cropPixels,mapping:geometry.mapping};
  facts.captures.push(capture);await save();return capture;
 }
 try{
  assert.equal(process.env.CI,'true');assert.ok(path.isAbsolute(process.env.MOUSE_TEST_PROFILE||''));
  assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
  assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),'6.0.35');assert.equal(app.getName(),'Mouse Browser');
  assert.ok([['darwin','arm64'],['win32','x64'],['linux','x64']].some(([platform,arch])=>platform===process.platform&&arch===process.arch));facts.profileIsolated=true;
  nativeInput=ctx.nativeInput||(process.platform==='darwin'?require('./mouse-native-menu.node'):process.platform==='win32'?require('./mouse-windows-input.cjs').createWindowsInput():require('./mouse-linux-input.cjs').createLinuxInput());
  fixture=await createFixture({...ctx,nativeInput},'owner635',budgetMs);
  await fixture.until(()=>fixture.js('document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest'),'635 ready shell',15000);
  await fixture.js(`(${installInputProbe.toString()})()`);originalLibrary=structuredClone(libraryService.library.data);
  const helpers={fixture,nativeInput,click,screenCapture,stage};
  facts.library=await stage('stable-file-library',()=>require('./mouse-635-library-smoke.cjs')(ctx,helpers));
  await save();
  facts.agentChat=await stage('agent-chat',()=>require('./mouse-635-agent-smoke.cjs')(ctx,helpers));
  console.log('MOUSE_635_AGENT_CHAT_PASS');
  await save();
  facts.panes=await stage('pinned-panes',()=>require('./mouse-635-layout-smoke.cjs')(ctx,helpers));
  console.log('MOUSE_635_PINNED_PANES_PASS');
  await save();
  facts.publicSearch=await stage('public-search',()=>require('./mouse-635-public-search-smoke.cjs')(ctx,helpers));
  await save();
 }catch(cause){
  error=cause;facts.error={stage:facts.stage,message:cause.message,stack:cause.stack};await diagnosticSave();
  if(fixture)try{await bounded(screenCapture('mouse-635-owner-failure.png','failed '+facts.stage),5000,'635 failure OS snapshot');}catch(captureError){facts.failureCaptureError=captureError.message;await diagnosticSave();}
 }finally{
  const restore=async(label,work)=>{try{return await work();}catch(cause){cleanupError||=cause;(facts.cleanupErrors||=[]).push({stage:label,message:cause.message});await diagnosticSave();}};
  if(fixture){
   await restore('search close',()=>bounded(fixture.js('MouseTest.searchUI.close()'),5000,'635 search close'));
   if(tileSearch.active)await restore('controller close',()=>tileSearch.close('Owner635 cleanup'));
   await restore('renderer cleanup',()=>bounded(fixture.js('globalThis.__mouse633Input?.dispose();MouseTest.browsing.close();document.querySelector("#capture-dialog")?.close();MouseTest.desktopUI.close({immediate:true})'),2500,'635 renderer cleanup'));
   if(originalLibrary)await restore('library restoration',async()=>{libraryService.library.data=originalLibrary;libraryService.library.changed();await libraryService.flush();});
   facts.cleanup=await restore('workspace restoration',()=>bounded(fixture.cleanup(),22000,'635 workspace restoration'));
   facts.restored=facts.cleanup?.restored===true;
  }
  facts.ok=!error&&!cleanupError&&facts.restored;facts.elapsedMs=Date.now()-started;facts.stage=facts.ok?'complete':'failed';
  try{await save();}catch(cause){error||=cause;facts.ok=false;facts.stage='failed';facts.error||={stage:'final evidence write',message:cause.message};await diagnosticSave();}finally{clearTimeout(watchdog);}
 }
 if(facts.ok){console.log('MOUSE_635_OWNER_FEEDBACK_PASS');exit(0);}else{console.error('MOUSE_635_OWNER_FEEDBACK_FAILED '+(facts.error?.message||cleanupError?.message||'restoration failed'));exit(1);}
};
