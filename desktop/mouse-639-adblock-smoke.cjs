'use strict';
// Installed-process acceptance against owned HTTP pages and explicitly
// synthetic cached lists. This never claims to test the live EasyList content.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {randomUUID,createHash}=require('node:crypto');
const VERSION='6.0.39',REPORT='mouse-639-adblock.json',PREFIX='/mouse-adblock-fixture/';
const SCRIPT={allowed:'/* Mouse639 owned allowed script */ globalThis.mouse639.executed.allowed++;',advertising:'/* Mouse639 owned advertising script */ globalThis.mouse639.executed.advertising++;'};
const COLORS={allowed:[42,178,93],advertising:[235,158,43],blocked:[200,65,85]};
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixturePage(){return `<!doctype html><html><head><meta charset="utf-8"><title>Mouse639 owned AdBlock fixture</title><style>html{background:#f3f0e8;color:#17242d;font:15px system-ui}body{margin:24px}h1{font-size:18px;margin:0}.result{position:fixed;left:24px;width:200px;height:42px;background:#666}#allowed-result{top:80px}#advertising-result{top:144px}#result-text{position:fixed;top:210px;left:24px;max-width:520px}</style></head><body><h1>Owned local AdBlock fixture · synthetic lists</h1><div id="allowed-result" class="result"></div><div id="advertising-result" class="result"></div><p id="result-text">Waiting for two actual script requests.</p><script>
const token=new URLSearchParams(location.search).get('token');
globalThis.mouse639={token,attempted:{allowed:0,advertising:0},executed:{allowed:0,advertising:0},settled:{allowed:'pending',advertising:'pending'}};
for(const kind of ['allowed','advertising']){const script=document.createElement('script');script.src='${PREFIX}'+kind+'-script.js?token='+encodeURIComponent(token);mouse639.attempted[kind]++;const finish=state=>{mouse639.settled[kind]=state;document.querySelector('#'+kind+'-result').style.background=state==='error'?'rgb(${COLORS.blocked})':kind==='allowed'?'rgb(${COLORS.allowed})':'rgb(${COLORS.advertising})';document.querySelector('#result-text').textContent='Allowed: '+mouse639.settled.allowed+' · Advertising: '+mouse639.settled.advertising;};script.onload=()=>finish('load');script.onerror=()=>finish('error');document.head.append(script);}
</script></body></html>`;}
async function createHTTPFixture(){
 const hits=[];let base;
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,base||'http://127.0.0.1'),token=url.searchParams.get('token');
  response.setHeader('Cache-Control','no-store, max-age=0');response.setHeader('Pragma','no-cache');
  const kind=url.pathname===PREFIX+'page'?'page':url.pathname===PREFIX+'allowed-script.js'?'allowed':url.pathname===PREFIX+'advertising-script.js'?'advertising':null;
  if(request.method!=='GET'||!kind||!token||!/^[-a-zA-Z0-9]{1,80}$/.test(token)){response.writeHead(404,{'Content-Type':'text/plain'});response.end('Owned fixture route not found');return;}
  const body=kind==='page'?fixturePage():SCRIPT[kind],contentType=kind==='page'?'text/html; charset=utf-8':'application/javascript; charset=utf-8';
  hits.push({sequence:hits.length+1,at:Date.now(),method:request.method,path:url.pathname,token,kind,status:200,bodySha256:sha(body),bytes:Buffer.byteLength(body),contentType});
  response.writeHead(200,{'Content-Type':contentType,'Content-Length':Buffer.byteLength(body)});response.end(body);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});base='http://127.0.0.1:'+server.address().port;
 return{server,base,hits,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
function pageReadback(){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 return{url:location.href,title:document.title,timeOrigin:performance.timeOrigin,...globalThis.mouse639,regions:['allowed','advertising'].map(kind=>{const e=document.querySelector('#'+kind+'-result');return{kind,bounds:rect(e),color:getComputedStyle(e).backgroundColor};})};
}
function settingsReadback(){
 const input=document.querySelector('[data-setting="blockAds"]'),panel=document.querySelector('#settings-dialog'),r=input.getBoundingClientRect();
 return{open:!!panel.open,checked:input.checked,disabled:input.disabled,theme:document.documentElement.dataset.theme,privateMode:MouseTest.model.privateMode,stored:MouseTest.model.controlSettings.blockAds,status:document.querySelector('#settings-adblock-state').textContent,label:input.closest('label').textContent,bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};
}
function inputProbe(selector,ticket){
 globalThis.__mouse639Input?.();const target=document.querySelector(selector);
 const listener=event=>console.log('MOUSE_639_INPUT '+JSON.stringify({ticket,selector,type:event.type,trusted:event.isTrusted,matches:!!target&&(event.target===target||target.contains(event.target)),at:Date.now(),x:event.clientX,y:event.clientY}));
 document.addEventListener('click',listener,{capture:true,once:true});globalThis.__mouse639Input=()=>document.removeEventListener('click',listener,true);
}
function noraReadback(){
 const tray=document.querySelector('#desktop-tray'),content=tray?.querySelector('.desk-content'),ui=globalThis.MouseTest?.desktopUI;
 const state={open:tray?.open===true,hidden:tray?.hidden!==false,phase:tray?.dataset.motion||'missing',inert:content?.inert!==false,isOpen:ui?.isOpen===true,preparing:ui?.isPreparing!==false,holdsNative:ui?.holdsNative===true,settled:ui?.motion?.isSettled===true};
 return{...state,ready:state.open&&!state.hidden&&state.phase==='open'&&!state.inert&&state.isOpen&&!state.preparing&&state.holdsNative&&state.settled};
}
function settingsCaptureReadback(readSettings){
 const ui=readSettings(),input=document.querySelector('[data-setting="blockAds"]'),panel=document.querySelector('#settings-dialog'),body=panel.querySelector('.dialog-content');
 const rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};},panelBounds=rect(panel),bodyBounds=rect(body),b=ui.bounds,style=getComputedStyle(input),thumb=getComputedStyle(input,'::before');
 const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2),inside=r=>b.x>=r.x&&b.y>=r.y&&b.x+b.width<=r.x+r.width&&b.y+b.height<=r.y+r.height;
 // A disabled private checkbox is still visible evidence. This readback must
 // not use nativeHitTarget(), which deliberately rejects disabled controls.
 const visible=ui.open&&input.isConnected&&b.width>0&&b.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&inside(panelBounds)&&inside(bodyBounds)&&inside({x:0,y:0,width:innerWidth,height:innerHeight})&&!!hit&&input.contains(hit);
 return{ui,panel:panelBounds,body:bodyBounds,scroll:{x:body.scrollLeft,y:body.scrollTop},style:{opacity:style.opacity,background:style.backgroundColor,thumbTransform:thumb.transform},visible};
}
function settingsGuestOverlaps(pages,children,panel){
 const overlaps=[];
 for(const page of pages){
  const view=page.view,surface=page.clipView||view;if(!view||!children.includes(surface)||!surface.getVisible()||!view.getVisible())continue;
  // The attached clipping view owns window coordinates; its child may start
  // at (0,0). Cached page.bounds cannot establish actual native placement.
  const b=surface.getBounds();if(b.x<panel.x+panel.width&&b.x+b.width>panel.x&&b.y<panel.y+panel.height&&b.y+b.height>panel.y)overlaps.push({id:page.id,bounds:{...b}});
 }
 return overlaps;
}
function settingsPixelContrast(pixels,size,mapping,bounds){
 const shades=[];let opaque=true;
 for(const x of [.2,.4,.6,.8])for(const y of [.2,.4,.6,.8]){
  const px=Math.floor(mapping.originX+(bounds.x+bounds.width*x)*mapping.scaleX),py=Math.floor(mapping.originY+(bounds.y+bounds.height*y)*mapping.scaleY);
  if(!Number.isInteger(px)||!Number.isInteger(py)||px<0||py<0||px>=size.width||py>=size.height)return{contrast:0,opaque:false,shades,reason:'outside-capture'};
  const at=(py*size.width+px)*4;shades.push(pixels[at]+pixels[at+1]+pixels[at+2]);opaque=opaque&&pixels[at+3]===255;
 }
 return{contrast:Math.max(...shades)-Math.min(...shades),opaque,shades};
}
function settingsFrameAcceptance(before,after,pixelReadback){
 const stable=before.snapshot.visible&&after.snapshot.visible&&JSON.stringify(before.snapshot)===JSON.stringify(after.snapshot),nativeClear=before.guests.length===0&&after.guests.length===0;
 return{stable,nativeClear,...pixelReadback,accepted:stable&&nativeClear&&pixelReadback.opaque&&pixelReadback.contrast>=20};
}
function assertPage(value,counts,blocked){
 assert.deepEqual(value.attempted,{allowed:1,advertising:1});assert.deepEqual(value.executed,{allowed:1,advertising:blocked?0:1});
 assert.deepEqual(value.settled,{allowed:'load',advertising:blocked?'error':'load'});assert.deepEqual(counts,{page:1,allowed:1,advertising:blocked?0:1});
}
async function run(ctx){
 const {app,win,browser,store,privateMode,settingsService,adBlock,globalCapture}=ctx;
 const {screen,nativeImage}=require('electron'),{createFixture,bounded,sleep}=require('./mouse-631-smoke-helpers.cjs');
 const {screenCropGeometry}=require('./mouse-628-ui-smoke.cjs'),{nativeHitTarget}=require('./mouse-smoke-hit-target.cjs'),{SOURCES,validRecord}=require('./mouse-adblock.cjs');
 const read=process.argv.includes('--mouse-639-adblock-read'),phase=read?'read':'write',budgetMs=read?60000:180000,startedAt=Date.now();
 const exit=require('./mouse-smoke-exit.cjs')({app,win});
 let facts={schema:1,version:app.getVersion(),platform:process.platform,arch:process.arch,packaged:app.isPackaged,pid:process.pid,profile:path.resolve(app.getPath('userData')),profileIsolated:false,physicalUserDeviceVerified:false,fixture:'synthetic-cache-and-loopback-http',ok:false,restored:false,awaitingRestart:false};
 let fixture,httpFixture,nativeInput,error,part;const pending=new Map();
 const save=()=>bounded(fs.writeFile(REPORT,JSON.stringify(facts,null,2)+'\n'),3000,'639 evidence write');
 const watchdog=setTimeout(()=>{facts.error={stage:facts.stage,message:'Mouse639 fixed native budget exceeded'};void save().finally(()=>exit(1));},budgetMs);
 const consoleInput=(event,...args)=>{const message=[event,...args].map(value=>typeof value==='string'?value:value?.message).find(value=>value?.startsWith('MOUSE_639_INPUT '));if(!message)return;try{const value=JSON.parse(message.slice(16)),receipt=pending.get(value.ticket);if(receipt)receipt.events.push(value);}catch{}};
 win.webContents.on('console-message',consoleInput);
 const js=source=>bounded(win.webContents.executeJavaScript(source),10000,'639 shell JS');
 const ready=async()=>{try{return await js('document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest');}catch{return false;}};
 const until=async(check,label,ms=10000)=>{const end=Math.min(startedAt+budgetMs,Date.now()+ms);do{if(await check())return;await sleep(25);}while(Date.now()<end);throw Error('Mouse639 timeout: '+label);};
 async function click(selector,{activate=true,scroll=true}={}){
  if(activate){app.focus({steal:true});win.show();win.focus();win.webContents.focus();}
  await until(()=>win.isFocused()&&(process.platform!=='darwin'||app.isActive()&&win.isVisible()),'native focus');
  if(scroll)await js(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',inline:'nearest'});true`);await fixture.frame();
  let hit;try{await until(async()=>{hit=await js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}),{})`);return hit.ready;},'native hit target '+selector);}catch(error){facts.inputFailure={selector,hit};throw error;}
  const ticket=randomUUID(),origin=win.getContentBounds(),point={x:Math.round(origin.x+hit.x),y:Math.round(origin.y+hit.y)};
  const receipt={ticket,selector,action:'click',pid:process.pid,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',point,at:Date.now(),events:[]};pending.set(ticket,receipt);part.inputs.push(receipt);
  await js(`(${inputProbe.toString()})(${JSON.stringify(selector)},${JSON.stringify(ticket)})`);assert.equal(await nativeInput.testClick(point.x,point.y),true);
  await until(()=>receipt.events.some(event=>event.type==='click'&&event.trusted&&event.matches),'trusted native click '+selector);pending.delete(ticket);return receipt;
 }
 function nativeState(record){
  const page=record.page,view=page.view.getBounds(),parent=page.clipView?.getBounds()||null,bounds={...page.bounds},actual={x:view.x+(parent?.x||0),y:view.y+(parent?.y||0),width:view.width,height:view.height};assert.deepEqual(actual,bounds);
  return{tabId:record.id,desk:record.workspace.mouseDesktops.bank.members[record.id],webContentsId:page.view.webContents.id,bounds,viewBounds:view,parentBounds:parent,actualBounds:actual,visible:page.view.getVisible(),parentVisible:page.clipView?.getVisible()??true,cachedVisible:!!page.visible,attached:win.contentView.children.includes(page.clipView||page.view),zoom:page.view.webContents.getZoomFactor()};
 }
 async function readSettingsCapture(){
  const snapshot=await js(`(${settingsCaptureReadback.toString()})(${settingsReadback.toString()})`),workspace=privateMode.current?.browser||browser;
  return{snapshot,guests:settingsGuestOverlaps([...workspace.tabs.values(),...workspace.providers.values()],win.contentView.children,snapshot.panel)};
 }
 async function capture(name,{probes=[],settings=false}={}){
  const filename='mouse-639-adblock-'+phase+'-'+name+'.png';assert.match(filename,/^mouse-639-adblock-[a-z0-9-]+\.png$/);
  await fixture.frame();const display=screen.getDisplayMatching(win.getBounds()),contentBounds=win.getContentBounds();assert.equal(globalCapture.permission(),process.platform==='darwin'?'granted':'not-required');
  const uiAttempts=[];let out,png,full;for(let attempt=1;attempt<=6;attempt++){
   let beforeUI=null,preparation=null;
   if(settings){
    preparation={reads:0,first:null};let previous=null;
    try{await until(async()=>{const next=await readSettingsCapture();preparation.reads++;preparation.first??=next;const stable=previous&&JSON.stringify(previous.snapshot)===JSON.stringify(next.snapshot);previous=next;beforeUI=next;if(stable&&next.snapshot.visible&&next.guests.length===0)return true;await fixture.frame();return false;},'visible stable settings sidebar');}
    catch(error){facts.uiCaptureFailure={name,preparation,last:beforeUI};throw error;}
   }
   const frame=await bounded(globalCapture.acquire(display),4500,'639 OS screen readback');assert.equal(frame.kind,'screen');assert.ok(frame.backend);
   full=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64');const screenPixelSize={width:full.readUInt32BE(16),height:full.readUInt32BE(20)},geometry=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),image=nativeImage.createFromBuffer(full).crop(geometry.cropPixels);
   png=image.toPNG({scaleFactor:1});const pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},pixels=image.toBitmap({scaleFactor:1});
   const observed=probes.map(probe=>{const x=Math.floor(geometry.mapping.originX+probe.point.x*geometry.mapping.scaleX),y=Math.floor(geometry.mapping.originY+probe.point.y*geometry.mapping.scaleY);assert.ok(x>=0&&y>=0&&x<pixelSize.width&&y<pixelSize.height);const at=(y*pixelSize.width+x)*4;return{...probe,x,y,actualRGBA:[pixels[at+2],pixels[at+1],pixels[at],pixels[at+3]]};});
   let ui=null,uiAccepted=true;
   if(settings){const afterUI=await readSettingsCapture(),readback=settingsPixelContrast(pixels,pixelSize,geometry.mapping,beforeUI.snapshot.ui.bounds),gate=settingsFrameAcceptance(beforeUI,afterUI,readback);uiAttempts.push({attempt,preparation,before:beforeUI,after:afterUI,...gate});ui=beforeUI.snapshot.ui;uiAccepted=gate.accepted;}
   const accepted=uiAccepted&&observed.every(probe=>probe.actualRGBA[3]===255&&probe.expectedRGB.every((channel,index)=>Math.abs(channel-probe.actualRGBA[index])<=3));
   out={filename,displayFilename:filename.replace(/\.png$/,'-display.png'),pid:process.pid,source:'globalCapture.acquire(display)',kind:frame.kind,backend:frame.backend,sha256:sha(png),displaySha256:sha(full),screenPixelSize,pixelSize,display:{bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor},contentBounds,...geometry,probes:observed,ui,...(settings?{uiAttempts}:{}),attempt,accepted};if(accepted)break;await sleep(40);
  }
  await fs.writeFile(filename,png);await fs.writeFile(out.displayFilename,full);part.captures.push(out);await save();assert.equal(out.accepted,true);return filename;
 }
 async function openSettings(){if(!await js('document.querySelector("#settings-dialog").open'))await click('#settings-button');await until(()=>js('document.querySelector("#settings-dialog").open'),'settings open');await js('document.querySelector("[data-setting=blockAds]").scrollIntoView({block:"center"});true');await fixture.frame();}
 async function closeSettings(){if(await js('document.querySelector("#settings-dialog").open'))await click('#settings-dialog [data-close-dialog]');await until(()=>js('!document.querySelector("#settings-dialog").open'),'settings close');}
 async function settingsShot(name){await openSettings();const filename=await capture(name,{settings:true}),ui=part.captures.at(-1).ui;assert.equal(ui.open,true);part.ui.push({name,...ui,capture:filename});return ui;}
 async function changeEnabled(name,enabled){
  await openSettings();const before=await js(`(${settingsReadback.toString()})()`);assert.equal(before.disabled,false);assert.equal(before.checked,!enabled);
  const input=await click('[data-setting="blockAds"]');await settingsService.flush();await until(()=>settingsService.state().blockAds===enabled&&adBlock.state().enabled===enabled&&(!enabled||adBlock.state().phase==='ready'&&adBlock.state().lists===2),'saved setting and active filters',15000);
  await until(()=>js(`document.querySelector('[data-setting="blockAds"]').checked===${enabled}`),'saved checkbox');
  const after=await settingsShot(name),saved=(await store.get('mouseControlSettings')).mouseControlSettings;assert.equal(saved.blockAds,enabled);
  part.changes.push({name,enabled,before,after,input:input.ticket,saved:{...saved},state:adBlock.state(),at:Date.now()});await closeSettings();await save();
 }
 async function show(record){
  const tree={id:'p1'};await js(`Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:{p1:${JSON.stringify(record.id)}},active:'p1',focusPane:'',focusAI:false,aiOpen:false,libraryOpen:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.requestLayout();MouseTest.save()`);
  await until(()=>record.page.visible&&record.page.bounds?.width>300&&record.page.bounds?.height>280,'owned native page visible');await fixture.frame();
 }
 async function openRecord(workspace,url,index){const result=await workspace.command('open',{url,lane:'main'}),record={id:result.id,page:workspace.get(result.id),workspace,index,desk:workspace.mouseDesktops.bank.active};if(workspace===browser)fixture.created.push(record);return record;}
 async function probe(name,blocked,workspace=browser,record=null){
  facts.stage=name;await save();const token=randomUUID(),url=httpFixture.base+PREFIX+'page?token='+token;
  if(record)await workspace.command('navigate',{id:record.id,url});else record=await openRecord(workspace,url,part.cases.length+1);
  await until(()=>!record.page.loading&&!record.page.error&&record.page.view.webContents.getURL()===url,'owned HTTP page '+name,15000);await show(record);
  let dom;await until(async()=>{dom=await fixture.pageJS(record,`(${pageReadback.toString()})()`);return dom.token===token&&['allowed','advertising'].every(kind=>dom.settled[kind]!=='pending');},'actual script outcomes '+name);
  const counts=Object.fromEntries(['page','allowed','advertising'].map(kind=>[kind,httpFixture.hits.filter(hit=>hit.token===token&&hit.kind===kind).length]));assertPage(dom,counts,blocked);const native=nativeState(record);assert.equal(native.zoom,1);
  const probes=dom.regions.flatMap(region=>{const b=region.bounds,expectedRGB=COLORS[region.kind==='advertising'&&blocked?'blocked':region.kind];assert.equal(region.color,'rgb('+expectedRGB.join(', ')+')');return[-5,0,5].map(dx=>({kind:region.kind,localBounds:b,offset:dx,point:{x:native.bounds.x+b.x+b.width/2+dx,y:native.bounds.y+b.y+b.height/2},expectedRGB}));});
  const receipt={name,token,pid:process.pid,url,blocked,privateMode:workspace!==browser,sessionPersistent:record.page.view.webContents.session.isPersistent(),native,dom,counts,state:adBlock.state(),settings:settingsService.state(),at:Date.now()};receipt.capture=await capture(name,{probes});part.cases.push(receipt);await save();return record;
 }
 async function checkCache(){
  const bytes=await fs.readFile('mouse-639-adblock-cache.json'),seed=JSON.parse(bytes);assert.equal(seed.synthetic,true);assert.equal(seed.version,VERSION);const records=[];
  for(const source of SOURCES){const row=seed.records.find(value=>value.source===source.id);assert.ok(row);assert.equal(row.url,source.url);const raw=await fs.readFile(path.join(app.getPath('userData'),'mouse-adblock',source.id+'.json'));assert.equal(sha(raw),row.sha256);const value=validRecord(JSON.parse(raw),source);assert.ok(Date.now()-Date.parse(value.updatedAt)<3600000);assert.equal(value.synthetic,true);records.push({source:source.id,sha256:sha(raw),textSha256:value.sha256,updatedAt:value.updatedAt});}
  return{seedSha256:sha(bytes),records,state:adBlock.state()};
 }
 async function switchDesk(id){
  await click('#desktops-button');
  // showModal() precedes native surface readback and the 300 ms opening. Do
  // not focus or scroll the inert, translated panel while it is preparing.
  await until(async()=>{const state=await js(`(${noraReadback.toString()})()`);return state.ready;},'Nora fully open');
  const input=await click('.desktop-card[data-desk="'+id+'"] .desk-open',{activate:false,scroll:false});
  await until(()=>js(`!MouseTest.model.switching&&MouseTest.model.desktopId===${JSON.stringify(id)}&&!document.querySelector('#desktop-tray').open`),'native desk switch',15000);return input;
 }
 async function togglePrivate(enabled){const input=await click('#private-button');await until(async()=>!!privateMode.current===enabled&&!privateMode.busy&&await ready(),'private context switch',20000);assert.equal(await js('MouseTest.model.privateMode'),enabled);return input;}
 try{
  assert.equal(process.env.CI,'true');assert.ok(path.isAbsolute(process.env.MOUSE_TEST_PROFILE||''));assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),VERSION);assert.equal(app.getName(),'Mouse Browser');assert.ok(globalCapture&&adBlock&&privateMode);
  assert.ok([['darwin','arm64'],['win32','x64'],['linux','x64']].some(([platform,arch])=>platform===process.platform&&arch===process.arch));await until(ready,'initial shell ready',15000);
  if(read){facts=JSON.parse(await fs.readFile(REPORT,'utf8'));assert.equal(facts.version,VERSION);assert.equal(facts.awaitingRestart,true);assert.equal(facts.writeComplete,true);assert.notEqual(facts.pid,process.pid);assert.equal(facts.profile,path.resolve(app.getPath('userData')));}
  facts.profileIsolated=true;part={pid:process.pid,startedAt,budgetMs,inputs:[],captures:[],cases:[],changes:[],ui:[]};facts[read?'restart':'write']=part;
  part.initial={settings:settingsService.state(),state:adBlock.state(),cache:await checkCache()};assert.equal(part.initial.settings.blockAds,read);assert.equal(part.initial.state.enabled,read);assert.equal(part.initial.state.phase,read?'ready':'off');assert.equal(part.initial.state.lists,read?2:0);
  nativeInput=ctx.nativeInput||(process.platform==='darwin'?require('./mouse-native-menu.node'):process.platform==='win32'?require('./mouse-windows-input.cjs').createWindowsInput():require('./mouse-linux-input.cjs').createLinuxInput());
  fixture=await createFixture({...ctx,nativeInput},'adblock639-'+phase,budgetMs);httpFixture=await createHTTPFixture();const html=fixturePage();await fs.writeFile('mouse-639-adblock-fixture.html',html);part.fixtureSha256=sha(html);part.origin=httpFixture.base;
  if(read){await probe('restart-enabled',true);await settingsShot('restored-enabled');await closeSettings();await changeEnabled('restore-initial-off',false);}
  else{
   const first=await probe('default-off',false);const initialUI=await settingsShot('initial-off');assert.equal(initialUI.checked,false);await closeSettings();
   if(await js('MouseTest.model.theme')!=='dark'){await click('#theme-button');await until(()=>js('MouseTest.model.theme==="dark"'),'dark theme');}
   await changeEnabled('enable-dark',true);await probe('enabled-first',true,browser,first);const retainedBefore=await fixture.pageJS(first,'({token:mouse639.token,timeOrigin:performance.timeOrigin})');
   await click('#theme-button');await until(()=>js('MouseTest.model.theme==="light"'),'light theme');await settingsShot('enabled-light');await closeSettings();
   const second=await probe('enabled-second-tab',true);assert.notEqual(second.page.view.webContents.id,first.page.view.webContents.id);
   const home=browser.mouseDesktops.bank.active,other=browser.mouseDesktops.bank.items.find(value=>value.id!==home).id;part.deskSwitch={from:home,to:other,input:(await switchDesk(other)).ticket};await probe('enabled-other-desktop',true);
   part.deskSwitch.returnInput=(await switchDesk(home)).ticket;part.private={enterInput:(await togglePrivate(true)).ticket};
   const privateWorkspace=privateMode.current.browser;part.private.partition=privateMode.current.partition;part.private.persistent=privateMode.current.ses.isPersistent();part.private.distinctSession=privateMode.current.ses!==first.page.view.webContents.session;assert.equal(part.private.persistent,false);assert.equal(part.private.distinctSession,true);
   await probe('enabled-private',true,privateWorkspace);const privateUI=await settingsShot('private-enabled');assert.equal(privateUI.checked,true);assert.equal(privateUI.disabled,true);part.private.ui=privateUI;
   part.private.writeError=await js('(async()=>{try{await MouseNative.settings("set",{blockAds:false});return null;}catch(error){return String(error.message);}})()');assert.match(part.private.writeError,/обычном режиме/);assert.equal(settingsService.state().blockAds,true);await closeSettings();part.private.leaveInput=(await togglePrivate(false)).ticket;
   part.retained={before:retainedBefore,after:await fixture.pageJS(first,'({token:mouse639.token,timeOrigin:performance.timeOrigin})'),webContentsId:first.page.view.webContents.id};assert.deepEqual(part.retained.after,part.retained.before);
   const token=randomUUID(),url=httpFixture.base+PREFIX+'advertising-script.js?token='+token,main=await openRecord(browser,url,99);await until(()=>!main.page.loading&&!main.page.error&&main.page.view.webContents.getURL()===url,'advertising-pattern main frame is allowed');part.mainFrame={token,url,enabled:adBlock.state().enabled,hits:httpFixture.hits.filter(hit=>hit.token===token).length,body:await fixture.pageJS(main,'document.body.innerText'),webContentsId:main.page.view.webContents.id};assert.equal(part.mainFrame.hits,1);assert.equal(part.mainFrame.enabled,true);assert.ok(part.mainFrame.body.includes(SCRIPT.advertising));
   await show(first);await changeEnabled('disable-again',false);await probe('disabled-again',false,browser,first);await changeEnabled('persist-enabled',true);
  }
  part.cache=await checkCache();facts.cleanup=await fixture.cleanup();fixture=null;await settingsService.flush();await store.queue;
  part.finalSettings=(await store.get('mouseControlSettings')).mouseControlSettings;assert.equal(part.finalSettings.blockAds,!read);part.completedAt=Date.now();part.elapsedMs=part.completedAt-startedAt;
  facts.writeComplete=true;facts.awaitingRestart=!read;facts.ok=read;facts.restored=read;
 }catch(cause){error=cause;facts.ok=false;facts.error={stage:facts.stage,message:cause.message,stack:cause.stack};if(fixture){try{facts.failureUI=await js(`({nora:(${noraReadback.toString()})(),motion:globalThis.MouseTest?.desktopUI?.motion?.diagnostics?.(),backdrop:globalThis.MouseTest?.desktopUI?.diagnostics?.(),focused:document.hasFocus(),scroll:{x:scrollX,y:scrollY}})`);}catch(readbackError){facts.failureUIError=readbackError.message;}try{await capture('failure');}catch(captureError){facts.captureError=captureError.message;}try{if(privateMode.current)await privateMode.toggle();facts.failureCleanup=await fixture.cleanup();}catch(cleanupError){facts.cleanupError=cleanupError.message;}}}
 finally{
  if(httpFixture){const filename='mouse-639-adblock-http-'+phase+'.json',value={schema:1,synthetic:true,version:VERSION,pid:process.pid,origin:httpFixture.base,hits:httpFixture.hits},raw=JSON.stringify(value,null,2)+'\n';await fs.writeFile(filename,raw);part.http={file:filename,sha256:sha(raw)};await httpFixture.close();}
  win.webContents.removeListener('console-message',consoleInput);clearTimeout(watchdog);await save();
 }
 if(error){console.error('MOUSE_639_ADBLOCK_FAIL',error.stack);return exit(1);}console.log(read?'MOUSE_639_ADBLOCK_NATIVE_PASS':'MOUSE_639_ADBLOCK_WRITE_PASS');return exit(0);
}
module.exports=run;
module.exports.fixtures={fixturePage,createHTTPFixture,pageReadback,settingsReadback,inputProbe,noraReadback,settingsCaptureReadback,settingsGuestOverlaps,settingsPixelContrast,settingsFrameAcceptance,assertPage,SCRIPT,COLORS,PREFIX,sha};
