'use strict';
// Test-only helpers for the isolated 6.0.31 installed-app process. No public
// service, user profile or external account is involved in these HTTP fixtures.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {screen,nativeImage}=require('electron');
const {screenCropGeometry,cornerBackground}=require('./mouse-628-ui-smoke.cjs');
const {staticShellReadback,staticThemeProbe,nativeStaticFrameMatch}=require('./mouse-smoke-frames.cjs');
const clone=value=>structuredClone(value);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const colorFor=(index,part)=>[40+(index*47+part*101)%160,55+(index*71+part*37)%150,65+(index*29+part*83)%140];

async function bounded(operation,ms,label){
 let timer;
 try{return await Promise.race([Promise.resolve(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Mouse631 timeout: '+label+' ('+ms+' ms)')),ms);})]);}
 finally{clearTimeout(timer);}
}

function pageHTML(index,{slowImage=false}={}){
 const token=randomUUID(),colors=[colorFor(index,0),colorFor(index,1)];
 return `<!doctype html><html><head><meta charset="utf-8"><title>Mouse631 page ${index}</title>
 <style>html{background:#f3f0e8;color:#17242d;font:14px system-ui}body{margin:0;min-height:1800px}header{position:fixed;inset:0 0 auto;background:#f3f0e8;padding:7px 14px;height:60px;box-sizing:border-box}h1{font-size:15px;margin:0 0 5px}input{width:75%;box-sizing:border-box}.region{position:fixed;top:78px;width:36%;height:34px;border:0}#region-a{left:8%;background:rgb(${colors[0]})}#region-b{left:56%;background:rgb(${colors[1]})}main{padding:140px 20px 0}p{max-width:48em;line-height:1.5}#site-progress{position:fixed;left:8%;top:120px;width:84%;height:14px}#stream-status{position:fixed;left:8%;top:142px;font-size:11px;background:#f3f0e8}</style></head><body>
 <header><h1>Desktop fixture · live page ${index}</h1><input id="field" aria-label="Preserved form value" value="initial-${index}"></header>
 <div id="region-a" class="region" aria-label="Page ${index} first content region"></div><div id="region-b" class="region" aria-label="Page ${index} second content region"></div>
 <main><p>This is an owned local test document with a real renderer, form state, cookie and scrolling content. Page ${index} must stay alive while other desktops are visible.</p><p id="ordinary-busy" aria-busy="true">An ordinary busy region is not a browser task.</p><progress id="ordinary-progress" max="100" value="23"></progress></main><output id="stream-status">No stream started</output>
 ${slowImage?'<img src="/hold-image" width="1" height="1" alt="">':''}
 <script>
 globalThis.mouse631={index:${index},identity:${JSON.stringify(token)},ticks:0,stream:null};
 document.cookie='mouse631_${index}=${token}; SameSite=Lax; Path=/page/${index}/';
 setInterval(()=>{mouse631.ticks++;},100);
 globalThis.mouse631Stream=async function(id){
   if(mouse631.stream)throw Error('Fixture stream must never restart');
   const state=mouse631.stream={id,requests:1,chunks:[],done:false,error:null,startedAt:performance.now()};
   const status=document.querySelector('#stream-status');
   try{
     await MouseAgent.updateProgress(null,'Owned HTTP stream '+id,{taskId:'stream-'+id,phase:'running'});
     const response=await fetch('/stream/'+id);if(!response.ok)throw Error('Stream HTTP '+response.status);
     const reader=response.body.getReader(),decoder=new TextDecoder();let text='';
     for(;;){const next=await reader.read();if(next.done)break;text+=decoder.decode(next.value,{stream:true});let end;
       while((end=text.indexOf('\\n'))>=0){const line=text.slice(0,end);text=text.slice(end+1);if(!line)continue;const item=JSON.parse(line);if(item.done){state.expected=item.count;state.done=true;state.finishedAt=performance.now();await MouseAgent.updateProgress(100,'Owned HTTP stream complete',{taskId:'stream-'+id,phase:'completed'});}else{state.chunks.push(item.value);status.textContent='Received '+state.chunks.length+' chunks · '+id;}}
     }
     if(!state.done||state.chunks.length!==state.expected)throw Error('Incomplete stream');
   }catch(error){state.error=String(error.message);}
 };
 </script></body></html>`;
}

async function createFixture(ctx,name,budgetMs){
 const {app,win,browser,store,globalCapture}=ctx;
 assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);
 assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 const started=performance.now(),deadline=started+budgetMs,created=[],bank=browser.mouseDesktops.bank;
 const js=source=>bounded(win.webContents.executeJavaScript(source),12000,name+' shell JS');
 const pageJS=(record,source)=>bounded(record.page.view.webContents.executeJavaScript(source),12000,name+' page '+record.index+' JS');
 const originalBounds=win.getBounds(),fullscreen=win.isFullScreen(),maximized=win.isMaximized();
 await js('MouseTest.desktopUI.close({immediate:true});MouseTest.save()');await store.queue;
 const original=await js('({preferences:MouseTest.prefs(),focusPane:MouseTest.model.focusPane,focusAI:MouseTest.model.focusAI,libraryOpen:MouseTest.model.libraryOpen})');
 const savedBank=bank.snapshot(),originalPages=new Map([...browser.tabs.values()].map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL(),epoch:page.navigationEpoch||0}]));
 async function until(check,label,ms=10000){
  const limit=Math.min(deadline,performance.now()+ms);let last;
  do{last=await check();if(last)return last;await sleep(25);}while(performance.now()<limit);
  throw Error('Mouse631 '+name+' timeout: '+label);
 }
 const frame=()=>js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 if(fullscreen){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave fullscreen');}
 if(maximized)win.unmaximize();
 await js('MouseTest.restorePane();MouseNative.window("pane-restore")');
 const work=screen.getDisplayMatching(win.getBounds()).workArea;
 assert.ok(work.width>=1000&&work.height>=700,'Native fixture requires the actual CI desktop to fit four readable panes');
 win.setBounds({x:work.x+4,y:work.y+4,width:Math.min(1200,work.width-8),height:Math.min(820,work.height-8)});
 app.focus({steal:true});win.show();win.focus();await until(()=>win.isFocused(),'native fixture window focus');await frame();

 async function switchDesk(id,options){
  assert.ok(bank.items.some(item=>item.id===id),'Only an existing owned desktop is selected');
  await bounded(js(`MouseTest.switchDesktop(${JSON.stringify(id)},false,${JSON.stringify(options||{})})`),12000,'switch '+id);
  await until(()=>js(`!MouseTest.model.switching&&MouseTest.model.desktopId===${JSON.stringify(id)}`),'settled desktop '+id);
  assert.equal(bank.active,id);
 }
 async function preparePage(record){
  const index=record.index;
  await until(()=>pageJS(record,'!!globalThis.mouse631'),'real page script '+index+' runs',15000);
  await pageJS(record,`document.querySelector('#field').value=${JSON.stringify('preserved-'+index+'-данные')};scrollTo(0,${130+index});true`);
  await until(()=>pageJS(record,`scrollY===${130+index}`),'page '+index+' scroll state');
  record.before=await identity(record);return record;
 }
 async function open(url,index,{waitLoad=true,prepare=true}={}){
  const result=await browser.command('open',{url,lane:'main'}),record={id:result.id,index,desk:bank.active,page:browser.get(result.id)};created.push(record);
  if(waitLoad)await until(()=>!record.page.loading&&!record.page.error&&record.page.view.webContents.getURL()===url,'HTTP page '+index+' loads',15000);
  return prepare?preparePage(record):record;
 }
 async function setLayout(records){
  assert.ok(records.length===2||records.length===4);assert.ok(records.every(record=>record.desk===bank.active));
  const tree=require('./mouse/layout.js').preset(records.length),leaves=require('./mouse/layout.js').leaves(tree),slots=Object.fromEntries(leaves.map((id,i)=>[id,records[i].id]));
  await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:${JSON.stringify(slots)},active:${JSON.stringify(leaves[0])},aiOpen:false,agentOpen:false,libraryOpen:false,focusPane:'',focusAI:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.requestLayout();MouseTest.save()`);
  await until(()=>records.every(record=>record.page.visible&&record.page.bounds?.width>80&&record.page.bounds?.height>100),'native split panes appear');await frame();
  return{tree,slots,active:leaves[0]};
 }
 async function identity(record){
  const page=browser.get(record.id),wc=page.view.webContents;
  return{id:page.id,index:record.index,desk:bank.members[page.id],webContentsId:wc.id,url:wc.getURL(),navigationEpoch:page.navigationEpoch||0,...await pageJS(record,'({identity:mouse631.identity,timeOrigin:performance.timeOrigin,field:document.querySelector("#field").value,scrollX,scrollY,cookie:document.cookie,ticks:mouse631.ticks,stream:mouse631.stream})')};
 }
 function assertIdentity(before,after){
  for(const key of ['id','index','desk','webContentsId','url','navigationEpoch','identity','timeOrigin','field','scrollX','scrollY','cookie'])assert.deepEqual(after[key],before[key],'Live page keeps '+key);
  assert.ok(after.ticks>=before.ticks,'Live page timer never restarts');
 }
 function nativeState(record){
  const page=record.page,root=page.clipView||page.view,view=page.view.getBounds(),parent=page.clipView?.getBounds()||null,bounds=clone(page.bounds),actual={x:view.x+(parent?.x||0),y:view.y+(parent?.y||0),width:view.width,height:view.height};
  assert.deepEqual(actual,bounds,'Actual native View hierarchy keeps the recorded page geometry');
  return{tabId:page.id,index:record.index,desk:bank.members[page.id],webContentsId:page.view.webContents.id,bounds,viewBounds:view,parentBounds:parent,actualBounds:actual,visible:page.view.getVisible(),parentVisible:page.clipView?.getVisible()??true,cachedVisible:!!page.visible,attached:win.contentView.children.includes(root)};
 }
 async function captureContent(filename,records,{shellRegions=[]}={}){
  assert.equal(globalCapture.permission(),process.platform==='win32'?'not-required':'granted');
  const contentBounds=win.getContentBounds(),display=screen.getDisplayMatching(win.getBounds()),states=records.map(nativeState);
  assert.ok(states.every(state=>state.visible&&state.parentVisible&&state.cachedVisible&&state.attached));
  const content=[];
  for(const record of records){const dom=await pageJS(record,'({index:mouse631.index,identity:mouse631.identity,regions:["a","b"].map(part=>{const element=document.querySelector("#region-"+part),r=element.getBoundingClientRect();return{part,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},color:getComputedStyle(element).backgroundColor};})})');assert.equal(dom.index,record.index);assert.equal(dom.identity,record.before.identity);content.push({tabId:record.id,...dom});}
  const themeProbe=shellRegions.length?await js(`(${staticThemeProbe.toString()})()`):null;
  const background=themeProbe?{...themeProbe,...cornerBackground(themeProbe.css)}:null;
  const attempts=[],begin=performance.now();let last;
  for(let sequence=1;sequence<=10&&performance.now()-begin<4000;sequence++){
   assert.deepEqual(win.getContentBounds(),contentBounds);assert.deepEqual(records.map(nativeState),states,'The native owners and bounds stay fixed during OS readback');
   const reference=shellRegions.length?await bounded(staticShellReadback(win.webContents),3500,'static task pill readback'):null;
   const frame=await bounded(globalCapture.acquire(display),4500,'OS display acquisition');assert.equal(frame.kind,'screen');assert.ok(frame.backend);
   const full=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64'),screenPixelSize={width:full.readUInt32BE(16),height:full.readUInt32BE(20)},image=nativeImage.createFromBuffer(full),geometry=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),cropped=image.crop(geometry.cropPixels),png=cropped.toPNG({scaleFactor:1}),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},bitmap=cropped.toBitmap({scaleFactor:1});
   assert.equal(bitmap.length,pixelSize.width*pixelSize.height*4);
   const probes=[];
   for(let i=0;i<records.length;i++)for(const region of content[i].regions){
    const local=region.bounds,native=states[i];assert.ok(local.x>=0&&local.y>=0&&local.x+local.width<=native.bounds.width&&local.y+local.height<=native.bounds.height);
    const expectedRGB=colorFor(records[i].index,region.part==='a'?0:1);assert.equal(region.color,'rgb('+expectedRGB.join(', ')+')');
    for(const [dx,dy]of [[0,0],[-6,0],[6,0],[0,-6],[0,6]]){
     const cssPoint={x:native.bounds.x+local.x+local.width/2+dx,y:native.bounds.y+local.y+local.height/2+dy},x=Math.floor(geometry.mapping.originX+cssPoint.x*geometry.mapping.scaleX),y=Math.floor(geometry.mapping.originY+cssPoint.y*geometry.mapping.scaleY);
     assert.ok(x>=0&&y>=0&&x<pixelSize.width&&y<pixelSize.height);const at=(y*pixelSize.width+x)*4,actualRGBA=[bitmap[at+2],bitmap[at+1],bitmap[at],bitmap[at+3]];
     probes.push({tabId:native.tabId,index:records[i].index,webContentsId:native.webContentsId,desk:native.desk,region:region.part,localBounds:local,offset:{x:dx,y:dy},cssPoint,x,y,expectedRGB,actualRGBA,tolerance:3});
    }
   }
   const shellMatch=reference?nativeStaticFrameMatch({reference,candidate:{...pixelSize,data:bitmap},viewport:{width:contentBounds.width,height:contentBounds.height},mapping:geometry.mapping,regions:shellRegions,background}):null;
   const accepted=(!shellMatch||shellMatch.accepted)&&probes.every(probe=>probe.actualRGBA[3]===255&&probe.actualRGBA.slice(0,3).every((channel,i)=>Math.abs(channel-probe.expectedRGB[i])<=3));
   attempts.push({sequence,elapsedMs:performance.now()-begin,accepted,shellMatch,mismatches:probes.filter(probe=>probe.actualRGBA[3]!==255||probe.actualRGBA.slice(0,3).some((channel,i)=>Math.abs(channel-probe.expectedRGB[i])>3))});
   last={png,full,kind:frame.kind,backend:frame.backend,screenPixelSize,...geometry,pixelSize,probes,reference,shellMatch};if(accepted)break;
  }
  assert.ok(last,'OS capture produced a frame');const displayFilename=filename.replace(/\.png$/,'-display.png');await fs.writeFile(filename,last.png);await fs.writeFile(displayFilename,last.full);
  const result={filename,sha256:sha256(last.png),displayFilename,displaySha256:sha256(last.full),source:'globalCapture.acquire(display)',kind:last.kind,backend:last.backend,display:{id:display.id,bounds:display.bounds,scaleFactor:display.scaleFactor},contentBounds,screenPixelSize:last.screenPixelSize,cropPixels:last.cropPixels,mapping:last.mapping,pixelSize:last.pixelSize,native:states,content,probes:last.probes,attempts};
  if(last.reference){const referenceFilename=filename.replace(/\.png$/,'-shell-reference.png');await fs.writeFile(referenceFilename,last.reference.png);result.shell={filename:referenceFilename,sha256:sha256(last.reference.png),pixelSize:{width:last.reference.width,height:last.reference.height},regions:shellRegions,background,match:last.shellMatch};}
  if(!attempts.at(-1).accepted)throw Object.assign(Error('Mouse631 actual OS pixels do not show every live page content region'),{capture:result});
  return result;
 }
 async function cleanup(){
  const errors=[];
  try{await js('MouseTest.desktopUI.close({immediate:true})');}catch(error){errors.push(error);}
  // The ordinary close command deliberately rejects another desktop's tab.
  // Use the same scoped close-tab action as Nora to remove only fixture IDs.
  for(const record of created)try{if(browser.tabs.has(record.id))await js(`MouseNative.desktops('close-tab',{id:${JSON.stringify(record.id)}})`);}catch(error){errors.push(error);}
  try{
   await js('globalThis.MouseFlush?.()');Object.assign(bank,new(require('./mouse-desktops.cjs').DesktopBank)(savedBank,original.preferences));browser.emit();
   await js(`(async()=>{const initial=await MouseNative.init();Object.assign(MouseTest.model,${JSON.stringify(original.preferences)},{focusPane:${JSON.stringify(original.focusPane)},focusAI:${JSON.stringify(original.focusAI)},libraryOpen:${JSON.stringify(original.libraryOpen)}});MouseTest.model.state=initial.state;MouseTest.setTheme(${JSON.stringify(original.preferences.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();await MouseTest.save();MouseTest.requestLayout();})()`);
   await browser.save();await store.queue;assert.deepEqual(bank.snapshot(),savedBank);assert.deepEqual([...browser.tabs.keys()].sort(),[...originalPages.keys()].sort());
   for(const [id,before]of originalPages){const current=browser.get(id);assert.equal(current,before.page);assert.equal(current.view.webContents,before.wc);assert.equal(current.view.webContents.getURL(),before.url);assert.equal(current.navigationEpoch||0,before.epoch);}
  }catch(error){errors.push(error);}
  try{if(win.isFullScreen())win.setFullScreen(false);win.setBounds(originalBounds);if(maximized)win.maximize();if(fullscreen)win.setFullScreen(true);await frame();}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Mouse631 fixture cleanup failed');
  return{restored:true,ownedPagesClosed:created.length,originalPagesPreserved:originalPages.size,desktopStateRestored:true};
 }
 return{...ctx,name,started,deadline,js,pageJS,until,frame,bank,created,switchDesk,open,preparePage,setLayout,identity,assertIdentity,nativeState,captureContent,cleanup};
}

module.exports={createFixture,pageHTML,colorFor,bounded,sleep,sha256};
