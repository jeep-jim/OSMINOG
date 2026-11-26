'use strict';
// Actual installed application regression evidence for the owner's 6.0.37
// screenshots. The independent Python reader checks the archived OS pixels.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {screen,nativeImage}=require('electron');
const {createFixture,pageHTML,colorFor,bounded,sleep,sha256}=require('./mouse-631-smoke-helpers.cjs');
const {screenCropGeometry}=require('./mouse-628-ui-smoke.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {installInputProbe}=require('./mouse-633-smoke-helpers.cjs');
const {tonePage,gridReadback,newTabReadback,toneReadback,rgb,sample,assertGrid}=require('./mouse-638-feedback-helpers.cjs');
const L=require('./mouse/layout.js'),VERSION='6.0.41',REPORT='mouse-638-feedback.json';

module.exports=async ctx=>{
 const {app,win,browser,store,globalCapture}=ctx,read=process.argv.includes('--mouse-638-feedback-restore-read'),budgetMs=read?180000:360000,started=Date.now();
 const exit=require('./mouse-smoke-exit.cjs')({app,win});
 let facts={schema:1,version:app.getVersion(),platform:process.platform,arch:process.arch,packaged:app.isPackaged,pid:process.pid,writePid:process.pid,profile:path.resolve(app.getPath('userData')),profileIsolated:false,physicalUserDeviceVerified:false,source:'Installed app, actual OS display captures, native input, owned HTTP documents and live Chrome Web Store',phase:'write',budgetMs,ok:false,restored:false,captures:[],nativeInputs:[],grid:[],newTabs:[],tone:[],drags:[]};
 let fixture,nativeInput,server,error,initial,base;const ownedStartTabs=[];
 const save=()=>bounded(fs.writeFile(REPORT,JSON.stringify(facts,null,2)+'\n'),3000,'638 evidence write');
 const watchdog=setTimeout(()=>{facts.ok=false;facts.error={stage:facts.stage,message:'Mouse638 fixed native budget exceeded'};void save().catch(()=>{}).finally(()=>exit(1));},budgetMs);
 const stage=async(name,work)=>{facts.stage=name;await save();console.log('MOUSE_638_STAGE '+name);return work();};
 const js=source=>fixture.js(source);
 async function focus(wc=win.webContents){app.focus({steal:true});win.show();win.focus();wc.focus();await fixture.until(()=>win.isFocused(),'638 native focus');}
 async function click(selector,record){
  const wc=record?.page.view.webContents||win.webContents,run=record?source=>fixture.pageJS(record,source):js;
  await focus(wc);await run(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',inline:'nearest'});true`);await fixture.frame();
  let hit;await fixture.until(async()=>{hit=await run(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}),{})`);return hit.ready;},'638 native target '+selector);
  await run(`if(!globalThis.__mouse633Input)(${installInputProbe.toString()})();__mouse633Input.begin(${JSON.stringify(selector)})`);
  const origin=win.getContentBounds(),offset=record?fixture.nativeState(record).bounds:{x:0,y:0},point={x:Math.round(origin.x+offset.x+hit.x),y:Math.round(origin.y+offset.y+hit.y)};
  assert.equal(await nativeInput.testClick(point.x,point.y),true);
  const entry={selector,action:'click',tabId:record?.id||null,pid:process.pid,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',point,at:Date.now()};facts.nativeInputs.push(entry);
  await fixture.until(async()=>{entry.events=await run('__mouse633Input.read()');return entry.events.some(e=>e.type==='click'&&e.trusted&&e.matches);},'638 actual trusted click '+selector);
  await fixture.frame();return entry;
 }
 async function key(keyCode){win.webContents.sendInputEvent({type:'keyDown',keyCode});win.webContents.sendInputEvent({type:'keyUp',keyCode});await fixture.frame();}
 async function appearance(mode,tone,theme){
  if(await js('MouseTest.model.theme')!==theme)await click('#theme-button');
  await fixture.until(()=>js(`MouseTest.model.theme===${JSON.stringify(theme)}`),'638 theme '+theme);
  await click('#settings-button');await fixture.until(()=>js('document.querySelector("#settings-dialog").open'),'638 appearance settings');
  await click('#settings-dialog .settings-nav-item[data-settings-page=appearance]');await fixture.until(()=>js('!document.querySelector("[data-settings-section=appearance]").hidden'),'638 appearance category');
  if(await js('MouseTest.model.appearance.paneMode')!==mode)await click('#settings-square-grid');
  await click('#settings-white-tone');await key(tone===0?'Home':'End');
  await fixture.until(()=>js(`MouseTest.model.appearance.paneMode===${JSON.stringify(mode)}&&MouseTest.model.appearance.whiteTone===${tone}`),'638 native appearance change');
  await click('#settings-dialog [data-close-dialog]');await fixture.until(()=>js('!document.querySelector("#settings-dialog").open'),'638 settings closed');
  await browser.mousePageTone.wait();await fixture.frame();
 }
 async function parkPointer(){const b=win.getContentBounds();await nativeInput.testMouse(b.x+12,b.y+12,1);await js('document.activeElement?.blur();true');await fixture.frame();}
 async function layout(records){
  const tree=L.preset(records.length);if(records.length===8){tree.ratio=.314159;tree.b.ratio=.618034;}const leaves=L.leaves(tree),slots=Object.fromEntries(leaves.map((id,i)=>[id,records[i].id]));
  await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:${JSON.stringify(slots)},active:${JSON.stringify(leaves[0])},classicTabId:'',pinnedPanes:{},aiOpen:false,libraryOpen:false,focusPane:'',focusAI:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.requestLayout();MouseTest.save()`);
  await fixture.until(()=>records.filter(r=>!r.internal).every(r=>r.page.visible&&r.page.bounds?.width>100&&r.page.bounds?.height>115),'638 native layout');await fixture.frame();
  return{tree,slots};
 }
 async function capture(filename,options={}){
  const {probes=[],reference=false,meta={},popupWindow}=options;assert.match(filename,/^mouse-638-[a-z0-9-]+\.png$/);await fixture.frame();
  const display=screen.getDisplayMatching(win.getBounds()),contentBounds=win.getContentBounds();
  assert.equal(globalCapture.permission(),process.platform==='darwin'?'granted':'not-required');
  const popupState=()=>popupWindow.isDestroyed()?{visible:false,bounds:null}:{visible:popupWindow.isVisible(),bounds:popupWindow.getBounds()};
  let last,png,full;const attempts=[];
  for(let attempt=1;attempt<=6;attempt++){
   const popupBefore=popupWindow?popupState():null;
   const frame=await bounded(globalCapture.acquire(display),4500,'638 OS display readback');assert.equal(frame.kind,'screen');assert.ok(frame.backend);
   const popupAfter=popupWindow?popupState():null;
   full=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64');const screenPixelSize={width:full.readUInt32BE(16),height:full.readUInt32BE(20)},geometry=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),displayImage=nativeImage.createFromBuffer(full),image=displayImage.crop(geometry.cropPixels);
   png=image.toPNG({scaleFactor:1});const pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},bitmap=image.toBitmap({scaleFactor:1});
   const observed=probes.map(probe=>{const value=sample(bitmap,pixelSize,geometry.mapping,probe.point);return{...probe,x:value.x,y:value.y,actualRGBA:value.rgba,tolerance:3};});
   let popup;
   if(popupWindow){
    const bounds=popupAfter.bounds,visible=popupBefore.visible&&popupAfter.visible,stable=!!bounds&&!!popupBefore.bounds&&['x','y','width','height'].every(k=>Number.isFinite(bounds[k])&&bounds[k]===popupBefore.bounds[k])&&bounds.width>0&&bounds.height>0,levels=[];
    if(stable){
     const mapping={scaleX:screenPixelSize.width/display.bounds.width,scaleY:screenPixelSize.height/display.bounds.height,originX:-display.bounds.x*screenPixelSize.width/display.bounds.width,originY:-display.bounds.y*screenPixelSize.height/display.bounds.height},points=[];
     for(const fx of [.1,.25,.5,.75,.9])for(const fy of [.1,.25,.5,.75,.9])points.push({x:bounds.x+bounds.width*fx,y:bounds.y+bounds.height*fy});
     if(points.every(p=>{const x=Math.floor(mapping.originX+p.x*mapping.scaleX),y=Math.floor(mapping.originY+p.y*mapping.scaleY);return x>=0&&y>=0&&x<screenPixelSize.width&&y<screenPixelSize.height;})){
      const pixels=displayImage.toBitmap({scaleFactor:1});for(const point of points)levels.push(sample(pixels,screenPixelSize,mapping,point).rgba.slice(0,3).reduce((sum,n)=>sum+n,0));
     }
    }
    const range=levels.length===25?Math.max(...levels)-Math.min(...levels):null;
    popup={before:popupBefore,after:popupAfter,bounds,visible,stable,levels,range,accepted:visible&&stable&&range!==null&&range>=45};
   }
   const accepted=observed.every(p=>p.actualRGBA[3]===255&&p.expectedRGB.every((n,i)=>Math.abs(n-p.actualRGBA[i])<=3))&&(!popupWindow||popup.accepted);attempts.push({attempt,accepted,...(popup?{popup}:{})});
   last={filename,displayFilename:filename.replace(/\.png$/,'-display.png'),source:'globalCapture.acquire(display)',kind:'screen',backend:frame.backend,pid:process.pid,bytes:png.length,sha256:sha256(png),displaySha256:sha256(full),screenPixelSize,pixelSize,contentBounds,display:{id:display.id,bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor},...geometry,probes:observed,attempts,...(popup?{popup}:{}),meta:{...meta,...(popup?.bounds?{bounds:popup.bounds}:{})}};
   if(accepted)break;await sleep(40);
  }
  await fs.writeFile(filename,png);await fs.writeFile(last.displayFilename,full);
  if(reference){const ref=await bounded(win.webContents.capturePage(),4500,'638 compositor reference'),bytes=ref.toPNG({scaleFactor:1}),refName=filename.replace(/\.png$/,'-reference.png');await fs.writeFile(refName,bytes);last.reference={filename:refName,sha256:sha256(bytes),pixelSize:{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}};}
  facts.captures.push(last);await save();assert.ok(attempts.at(-1).accepted,'Actual OS pixels match the independently owned native fixture');return last;
 }
 async function gridCapture(records,name){
  await parkPointer();const state=await js(`(${gridReadback.toString()})()`);assertGrid(state,records.length);
  const native=records.map(fixture.nativeState),probes=[],seam=state.theme==='dark'?[53,67,87]:[199,207,223];assert.deepEqual(rgb(state.seam),seam);
  for(const record of records){
   const own=native.find(n=>n.tabId===record.id),pane=state.panes.find(p=>p.tabId===record.id);assert.ok(own.visible&&own.parentVisible&&own.cachedVisible&&own.attached);assert.deepEqual(own.bounds,pane.slot,'Native content fits the actual DOM slot');
   const regions=await fixture.pageJS(record,'[...document.querySelectorAll(".region")].map(e=>{const r=e.getBoundingClientRect();return{id:e.id,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},color:getComputedStyle(e).backgroundColor}})');
   for(const region of regions){const part=region.id==='region-a'?0:1;assert.deepEqual(rgb(region.color),colorFor(record.index,part));probes.push({kind:'page',tabId:record.id,index:record.index,part,localBounds:region.bounds,point:{x:own.bounds.x+region.bounds.x+region.bounds.width/2,y:own.bounds.y+region.bounds.y+region.bounds.height/2},expectedRGB:colorFor(record.index,part)});}
   for(const side of ['left','right'])probes.push({kind:'corner',tabId:record.id,side,point:{x:pane.bounds.x+(side==='left'?1.5:pane.bounds.width-1.5),y:pane.bounds.y+pane.bounds.height-1.5},expectedRGB:state.appearance.paneMode==='rounded'?seam:[243,240,232]});
   if(state.appearance.paneMode==='rounded')for(const side of ['left','right']){
    const b=pane.bounds,content=win.getContentBounds(),points=[{x:b.x+(side==='left'?-.5:b.width+.5),y:b.y+b.height-1.5},{x:b.x+(side==='left'?1.5:b.width-1.5),y:b.y+b.height+.5}];
    for(const point of points)if(point.x>=0&&point.y>=0&&point.x<content.width&&point.y<content.height)probes.push({kind:'corner-neighbor',tabId:record.id,side,point,expectedRGB:seam});
   }
  }
  for(const d of state.dividers)for(const fraction of [.08,.3,.7,.92])probes.push({kind:'seam',path:d.path,fraction,point:{x:d.bounds.x+d.bounds.width*(d.axis==='x'?.5:fraction),y:d.bounds.y+d.bounds.height*(d.axis==='y'?.5:fraction)},expectedRGB:seam});
  const receipt={name,state,native,identities:await Promise.all(records.map(fixture.identity))};receipt.capture=(await capture('mouse-638-grid-'+name+'.png',{probes,meta:{kind:'grid',name}})).filename;facts.grid.push(receipt);await save();return receipt;
 }
 async function drag(selector,toPoint,{kind,records,expect}={}){
  await focus();await js(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',inline:'nearest'});true`);await fixture.frame();
  const hit=await js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}),{yFraction:.12})`);assert.equal(hit.ready,true);
  await js(`(()=>{const target=document.querySelector(${JSON.stringify(selector)}),events=[];const fn=e=>events.push({type:e.type,trusted:e.isTrusted,matches:e.target===target||target.contains(e.target),x:e.clientX,y:e.clientY});for(const type of ['pointerdown','pointermove','pointerup'])document.addEventListener(type,fn,true);globalThis.__mouse638Drag={events,dispose(){for(const type of ['pointerdown','pointermove','pointerup'])document.removeEventListener(type,fn,true)}};})()`);
  const origin=win.getContentBounds(),from={x:Math.round(origin.x+hit.x),y:Math.round(origin.y+hit.y)},to={x:Math.round(origin.x+toPoint.x),y:Math.round(origin.y+toPoint.y)},before=await Promise.all(records.map(fixture.identity));
  const receipt={selector,action:'drag',kind,from,to,pid:process.pid,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',events:[],before,completed:false};facts.nativeInputs.push(receipt);facts.drags.push(receipt);await save();
  try{
  try{assert.equal(await nativeInput.testMouse(from.x,from.y,0),true);for(let i=1;i<=12;i++){assert.equal(await nativeInput.testMouse(Math.round(from.x+(to.x-from.x)*i/12),Math.round(from.y+(to.y-from.y)*i/12),1),true);await sleep(18);}}
  finally{assert.equal(await nativeInput.testMouse(to.x,to.y,2),true);}
  await fixture.until(()=>js('!MouseTest.model.drag&&!MouseTest.model.swapDrag'),'638 drag settled');await fixture.until(expect,'638 native drag changed the actual layout');await fixture.frame();
  const events=await js('__mouse638Drag.events');assert.ok(events.some(e=>e.type==='pointerdown'&&e.trusted&&e.matches));assert.ok(events.some(e=>e.type==='pointermove'&&e.trusted));assert.ok(events.some(e=>e.type==='pointerup'&&e.trusted));
  const after=await Promise.all(records.map(fixture.identity));before.forEach((value,i)=>fixture.assertIdentity(value,after[i]));
  Object.assign(receipt,{after,completed:true});return receipt;
  }finally{receipt.events=await js('__mouse638Drag.events');await js('__mouse638Drag.dispose();delete globalThis.__mouse638Drag');await save();}
 }
 async function toneCapture(record,name,channel,{dynamic=false}={}){
  await fixture.until(()=>fixture.pageJS(record,`getComputedStyle(document.querySelector('#neutral-light')).color==='rgb(${channel}, ${channel}, ${channel})'`),'638 actual neutral website colour');
  if(dynamic)await fixture.until(()=>fixture.pageJS(record,`getComputedStyle(document.querySelector('#dynamic-neutral')).color==='rgb(${channel}, ${channel}, ${channel})'`),'638 dynamic website colour');
  const dom=await fixture.pageJS(record,`(${toneReadback.toString()})()`),native=fixture.nativeState(record),appearance=await js('({theme:MouseTest.model.theme,...MouseTest.model.appearance})');
  for(const [id,expected]of [['neutral-light',[channel,channel,channel]],['colored-link',[45,145,235]],['light-panel',[190,190,190]],['inherit-light',[255,255,255]],['inherit-blue',[255,255,255]],['inherit-svg',[255,255,255]]]){const e=dom.elements.find(e=>e.id===id);assert.deepEqual(rgb(e.color),expected);assert.deepEqual(rgb(e.fill),expected,'Text fill cannot recolour nested excluded content');}
  const media=dom.elements.find(e=>e.id==='media'),probes=[{kind:'media',point:{x:native.bounds.x+media.bounds.x+media.bounds.width/2,y:native.bounds.y+media.bounds.y+media.bounds.height/2},expectedRGB:[235,40,155]}];
  const svg=dom.elements.find(e=>e.id==='inherit-svg');assert.deepEqual(rgb(svg.svgFill),[255,255,255]);probes.push({kind:'currentColor-svg',point:{x:native.bounds.x+svg.bounds.x+svg.bounds.width/2,y:native.bounds.y+svg.bounds.y+svg.bounds.height/2},expectedRGB:[255,255,255]});
  const receipt={name,dom,native,appearance,pageTone:browser.mousePageTone.state(),channel};receipt.capture=(await capture('mouse-638-tone-'+name+'.png',{probes,meta:{kind:'tone',name}})).filename;facts.tone.push(receipt);await save();return receipt;
 }
 async function newTabCapture(name){
  const before=new Set(browser.state().tabs.map(t=>t.id));await click('#new-tab');let id;
  await fixture.until(async()=>{id=await js('MouseTest.model.classicTabId');return!before.has(id)&&ctx.startService.tabs.has(id)&&await js('!!document.querySelector("#stage .pane.active .home-page .favorite-tile")');},'638 actual new tab');
  // mouse://start is browser-owned DOM and deliberately has no native guest
  // WebContentsView. Its IDs live in startService, not browser.tabs/get().
  const record={id,index:-1,desk:fixture.bank.active,internal:true};ownedStartTabs.push(id);let placement=null;
  if(name.startsWith('grid-')){
   // The641 top plus opens classic view. This retained paint fixture then
   // explicitly places that owned start page in its prepared grid; real user
   // insertion and empty-tile selection are proved in the641 native ledger.
   placement=await js(`(()=>{MouseTest.returnToGrid();const pane=MouseTest.model.active;MouseTest.model.slots[pane]=${JSON.stringify(id)};MouseTest.renderTree();MouseTest.applySide();return{source:'owned fixture placement after native new-tab',pane};})()`);
  }
  // First complete production paint. No CSS, animation, opacity or DOM content
  // is replaced by the test, including on repeated openings of the same pane.
  await fixture.frame();await parkPointer();
  const state=await js(`(${newTabReadback.toString()})()`);assert.equal(state.background,'aurora');assert.ok(state.regions.filter(r=>r.kind==='text').length>=3);assert.ok(state.regions.some(r=>r.kind==='icon'));
  const receipt={name,tabId:id,state,placement,input: facts.nativeInputs.findLast(e=>e.selector==='#new-tab')};receipt.capture=(await capture('mouse-638-newtab-'+name+'.png',{reference:true,meta:{kind:'newtab',name}})).filename;facts.newTabs.push(receipt);await save();return record;
 }
 async function closeStarts(){for(const id of ownedStartTabs)if(ctx.startService.tabs.has(id))await js(`MouseNative.desktops('close-tab',{id:${JSON.stringify(id)}})`);}
 try{
  assert.equal(process.env.CI,'true');assert.ok(path.isAbsolute(process.env.MOUSE_TEST_PROFILE||''));assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),VERSION);assert.equal(app.getName(),'Mouse Browser');assert.ok(browser.mousePageTone);
  assert.ok([['darwin','arm64'],['win32','x64'],['linux','x64']].some(([p,a])=>p===process.platform&&a===process.arch));
  if(read){facts=JSON.parse(await fs.readFile(REPORT,'utf8'));assert.equal(facts.version,VERSION);assert.equal(facts.writeComplete,true);assert.equal(facts.awaitingRestart,true);assert.notEqual(facts.writePid,process.pid);assert.equal(facts.profile,path.resolve(app.getPath('userData')));facts.phase='read';facts.restart={pid:process.pid,writePid:facts.writePid,budgetMs,startedAt:Date.now()};}
  if(read)await stage('appearance-preferences-restart',async()=>{
   const shell=source=>bounded(win.webContents.executeJavaScript(source),12000,'feedback638-read shell JS'),deadline=performance.now()+15000;let ready=false;
   do{ready=await shell('document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest');if(ready)break;await sleep(25);}while(performance.now()<deadline);
   assert.ok(ready,'638 ready');
   // Record persisted preferences before createFixture saves or changes any UI.
   facts.restart.appearance=await shell('({theme:MouseTest.model.theme,appearance:{...MouseTest.model.appearance},stored:JSON.parse(localStorage.getItem("mouseAppearance"))})');
   assert.deepEqual(facts.restart.appearance,{theme:'dark',appearance:{paneMode:'square',whiteTone:0},stored:{paneMode:'square',whiteTone:0}});await save();
  });
  facts.profileIsolated=true;nativeInput=ctx.nativeInput||(process.platform==='darwin'?require('./mouse-native-menu.node'):process.platform==='win32'?require('./mouse-windows-input.cjs').createWindowsInput():require('./mouse-linux-input.cjs').createLinuxInput());
  fixture=await createFixture({...ctx,nativeInput},read?'feedback638-read':'feedback638-write',budgetMs);await fixture.until(()=>js('document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest'),'638 ready',15000);
  initial=read?facts.initial:await js('(async()=>({theme:MouseTest.model.theme,appearance:{...MouseTest.model.appearance},zoom:(await MouseNative.zoom("state")).factor}))()');facts.initial=initial;
  server=http.createServer((request,response)=>{response.setHeader('Cache-Control','no-store');if(request.url==='/tone'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(tonePage());return;}const match=/^\/page\/(\d+)\/$/.exec(request.url);if(match){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(pageHTML(Number(match[1])));return;}response.statusCode=404;response.end('owned fixture not found');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  if(!read){
   await stage('eight-live-panes-both-styles-and-themes',async()=>{
    const records=[];for(let index=1;index<=8;index++)records.push(await fixture.open(base+'/page/'+index+'/',index));await layout(records);facts.gridInitial=await Promise.all(records.map(fixture.identity));
    for(const [mode,theme]of [['rounded','dark'],['rounded','light'],['square','light'],['square','dark']]){await appearance(mode,100,theme);await gridCapture(records,mode+'-'+theme);}
    for(const mode of ['square','rounded']){
     await appearance(mode,100,'dark');const state=await js(`(${gridReadback.toString()})()`),root=state.dividers.find(d=>d.path===''),old=await js('MouseTest.model.tree.ratio');
     await drag('.divider[data-path=""]',{x:root.bounds.x+root.bounds.width/2+28,y:root.bounds.y+root.bounds.height*.12},{kind:'resize-'+mode,records,expect:()=>js(`Math.abs(MouseTest.model.tree.ratio-${old})>.005`)});await gridCapture(records,mode+'-after-resize');
     const current=await js(`(${gridReadback.toString()})()`),source=current.panes[0],target=current.panes[1];
     await drag('.tab-item[data-tab="'+source.tabId+'"] .tab-title',{x:target.bounds.x+target.bounds.width/2,y:target.bounds.y+target.bounds.height/2},{kind:'swap-'+mode,records,expect:()=>js(`MouseTest.model.slots[${JSON.stringify(target.id)}]===${JSON.stringify(source.tabId)}`)});await gridCapture(records,mode+'-after-swap');
    }
    const after=await Promise.all(records.map(fixture.identity));facts.gridInitial.forEach((value,i)=>fixture.assertIdentity(value,after[i]));facts.gridAfter=after;
    facts.ownedPageIds=records.map(r=>r.id);
    await stage('new-tab-complete-first-and-repeat-paints',async()=>{
     await js(`MouseNative.start('preferences',{background:'aurora',showRecent:true})`);for(let index=1;index<=8;index++)await js(`MouseNative.start('bookmark',{url:${JSON.stringify(base+'/page/'+index+'/')},title:${JSON.stringify('Owned bookmark '+index)}})`);await js('MouseTest.home.refresh()');
     await layout([records[0]]);await js('MouseTest.zoomUI.change("set",.8)');await newTabCapture('full-dark-first');await newTabCapture('full-dark-repeat');await js('MouseTest.zoomUI.change("set",1)');await appearance('rounded',100,'light');await newTabCapture('full-light');await js('MouseTest.zoomUI.change("set",1.25)');await newTabCapture('full-light-125');await js('MouseTest.zoomUI.change("set",1)');await layout(records.slice(0,4));await newTabCapture('grid-light');await appearance('square',100,'dark');await js('MouseTest.zoomUI.change("set",.8)');await newTabCapture('grid-dark');await js('MouseTest.zoomUI.change("set",1)');
    });
   });
   await stage('native-website-white-tone-and-exclusions',async()=>{
    const record=await fixture.open(base+'/tone',30,{prepare:false});await layout([record]);await appearance('square',0,'dark');const low=await toneCapture(record,'minimum',160);
    await fixture.pageJS(record,'const dynamic=document.createElement("p");dynamic.id="dynamic-neutral";dynamic.textContent="DYNAMIC WHITE TEXT 638";document.body.append(dynamic);true');await toneCapture(record,'dynamic',160,{dynamic:true});
    await appearance('rounded',100,'dark');const high=await toneCapture(record,'maximum',255,{dynamic:true});assert.deepEqual(low.dom.identity,high.dom.identity);
    await appearance('rounded',0,'light');await toneCapture(record,'light-theme-unchanged',255,{dynamic:true});
    await appearance('square',0,'dark');await browser.command('reload',{id:record.id});await fixture.until(()=>!record.page.loading&&record.page.view.webContents.getURL()===base+'/tone','638 reloaded website');await toneCapture(record,'navigation',160);
    await browser.command('navigate',{id:record.id,url:base+'/page/32/'});await fixture.until(()=>!record.page.loading&&record.page.view.webContents.getURL()===base+'/page/32/','638 history neighbour loaded');await browser.command('back',{id:record.id});await fixture.until(()=>!record.page.loading&&record.page.view.webContents.getURL()===base+'/tone','638 actual history return');await toneCapture(record,'history-back',160);
   });
  }
  await stage(read?'live-chrome-web-store-restart':'live-chrome-web-store-install',async()=>{facts.webStore??={};const value=await require('./mouse-638-webstore-smoke.cjs')({...ctx,fixture,nativeInput,click,capture,facts,read,save});facts.webStore[read?'restart':'write']=value;await save();});
  if(read)await stage('appearance-and-website-restart',async()=>{
   // Restored Dark Reader also transforms colours. Finish its complete native
   // restart/removal lifecycle before opening the independent PageTone document.
   assert.equal(facts.webStore.restart.removed,true);
   facts.restart.appearanceAfterStore=await js('({theme:MouseTest.model.theme,appearance:{...MouseTest.model.appearance},stored:JSON.parse(localStorage.getItem("mouseAppearance"))})');
   assert.deepEqual(facts.restart.appearanceAfterStore,facts.restart.appearance);await save();
   const record=await fixture.open(base+'/tone',31,{prepare:false});await layout([record]);facts.restart.tone=await toneCapture(record,'restored',160);
  });
  await closeStarts();facts.cleanup=await fixture.cleanup();facts.cleanup.ownedStartTabsClosed=ownedStartTabs.length;fixture=null;
  if(read){await win.webContents.executeJavaScript(`MouseTest.setAppearance(${JSON.stringify(initial.appearance)});MouseTest.setTheme(${JSON.stringify(initial.theme)});MouseTest.zoomUI.change("set",${initial.zoom});MouseFlush()`);await store.queue;facts.ok=true;facts.restored=true;facts.awaitingRestart=false;facts.restart.completedAt=Date.now();facts.restart.elapsedMs=Date.now()-started;}
  else{await win.webContents.executeJavaScript('MouseTest.setAppearance({paneMode:"square",whiteTone:0});MouseTest.setTheme("dark");MouseFlush()');await store.queue;facts.writeComplete=true;facts.awaitingRestart=true;facts.writeElapsedMs=Date.now()-started;}
 }catch(cause){error=cause;facts.ok=false;facts.error={stage:facts.stage,message:cause.message,stack:cause.stack};if(fixture){try{await capture('mouse-638-failure.png');}catch(captureError){facts.failureCaptureError=captureError.message;}try{await closeStarts();facts.failureCleanup=await fixture.cleanup();}catch(cleanupError){facts.cleanupError=cleanupError.message;}}}
 finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}clearTimeout(watchdog);await save();}
 if(error){console.error('MOUSE_638_FEEDBACK_FAIL',error.stack);return exit(1);}
 console.log(read?'MOUSE_638_FEEDBACK_NATIVE_PASS':'MOUSE_638_FEEDBACK_WRITE_PASS');return exit(0);
};
