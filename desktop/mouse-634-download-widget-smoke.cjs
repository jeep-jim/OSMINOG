'use strict';
// Real DownloadItems from two independent owned pages. The caller supplies native
// clicks and full-display capture; this helper never synthesizes a download event.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {sha256,colorFor}=require('./mouse-631-smoke-helpers.cjs');
const {downloadPaneSample,downloadNativeBounds,assertDownloadPaneGeometry}=require('./mouse-630-feedback-smoke.cjs');
const PALETTE={track:[83,207,139],fill:[7,130,60]},PIXEL_TOLERANCE=12;

function widgetSnapshot(tabIds,samplePane){
 const state=MouseTest.downloadUI.snapshot(),active=item=>['started','downloading','paused'].includes(item.state);
 return{at:Date.now(),theme:MouseTest.model.theme,activity:state,panels:tabIds.map(tabId=>{const own=state.items.filter(item=>item.tabId===tabId&&active(item)),sample=samplePane(own[0]?.id||null,tabId);return{tabId,activeIds:own.map(item=>item.id),...sample};}),runningTransitions:[...document.querySelectorAll('.mouse-download-fill')].flatMap(node=>node.getAnimations().filter(animation=>animation.playState==='running').map(animation=>({currentTime:animation.currentTime,duration:animation.effect.getComputedTiming().duration})))};
}
function assertIndependentGeometry(current,before,activeTabIds,rounded=true){
 assert.equal(current.panels.length,before.panels.length);assert.equal(current.native.length,before.native.length);
 for(let i=0;i<current.panels.length;i++){
  const row=current.panels[i],base=before.panels[i],native=current.native[i],active=activeTabIds.includes(row.tabId);
  assert.equal(row.tabId,base.tabId);assert.equal(native.tabId,row.tabId);assert.equal(native.webContentsId,before.native[i].webContentsId);
  assertDownloadPaneGeometry(row.ui,base.ui,active);
  assert.ok(native.visible&&native.parentVisible&&native.cachedVisible&&native.attached,'The same live native page stays visible');
  assert.deepEqual(native.bounds,downloadNativeBounds(row.ui.slot,rounded),'Native viewport uses the real reserved content slot');
  assert.deepEqual(native.actualBounds,native.bounds);
  for(const key of ['x','y','width'])assert.equal(native.bounds[key],before.native[i].bounds[key],'Other native coordinates are unchanged: '+key);
  assert.equal(native.bounds.height,before.native[i].bounds.height-(active?22:0),'Only the owning native viewport reserves 22px');
  if(!active)assert.deepEqual(native.bounds,before.native[i].bounds,'A terminal or unrelated pane has its exact original viewport');
 }
}
function pixelAt(bitmap,size,mapping,point){
 const x=Math.floor(mapping.originX+point.x*mapping.scaleX),y=Math.floor(mapping.originY+point.y*mapping.scaleY);
 assert.ok(x>=0&&y>=0&&x<size.width&&y<size.height,'Probe is inside the actual captured content');
 assert.equal(bitmap.length,size.width*size.height*4);const at=(y*size.width+x)*4;return{x,y,rgba:[bitmap[at+2],bitmap[at+1],bitmap[at],bitmap[at+3]]};
}
function probeDelta(rgba,rgb){return Math.max(...rgb.map((value,i)=>Math.abs(value-rgba[i])));}

function ownedDownloadURL(name,pageURL,origin){
 assert.ok(['a','b','chat','preview'].includes(name));
 assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/,'Downloads use a caller-owned HTTP fixture origin');
 assert.equal(new URL(pageURL).origin,origin,'The download fixture is same-origin with its actual native owner');
 return origin+'/download/'+name;
}

module.exports=async({fixture,browser,win,libraryService,guestClick,screenCapture,streams,downloads,base,records=fixture.records.slice(0,2),names=['a','b'],downloadOrigins=[base,base],filePrefix='mouse-634-download-widget'})=>{
 assert.equal(records.length,2);assert.equal(names.length,2);assert.equal(new Set(records.map(record=>record.id)).size,2);assert.match(filePrefix,/^mouse-634-[a-z0-9-]+$/);
 assert.equal(downloadOrigins.length,records.length);
 // A cross-origin <a download> is a navigation that may become an attachment.
 // This viewport gate uses same-origin download links and retains the strict
 // unchanged document/security epoch assertion throughout every byte milestone.
 const downloadURLs=records.map((record,index)=>ownedDownloadURL(names[index],record.page.view.webContents.getURL(),downloadOrigins[index]));
 const tabIds=records.map(record=>record.id),facts={schema:1,version:fixture.app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,source:'Actual DownloadItems, trusted native guest clicks and full OS display pixels',physicalUserDeviceVerified:false,placement:'bottom',pillHeight:16,gap:6,reservedHeight:22,palette:PALETTE,pixelTolerance:PIXEL_TOLERANCE,names:[...names],tabIds,nativeInputs:[],stages:[],captures:[],files:[],ok:false},reportFile=filePrefix+'.json';
 const save=()=>fs.writeFile(reportFile,JSON.stringify(facts,null,2)+'\n');
 const initialTheme=await fixture.js('MouseTest.model.theme');let original;
 async function read(){
  await fixture.js('MouseTest.downloadUI.refresh()');const state=await fixture.js(`(${widgetSnapshot.toString()})(${JSON.stringify(tabIds)},${downloadPaneSample.toString()})`);
  return{...state,native:records.map(fixture.nativeState),identities:await Promise.all(records.map(fixture.identity))};
 }
 async function settled(label,activeNames,{received={}}={}){
  const activeTabIds=activeNames.map(name=>tabIds[names.indexOf(name)]);let value;
  await fixture.until(async()=>{
   value=await read();
   for(let i=0;i<names.length;i++){
    const active=activeNames.includes(names[i]),row=value.panels[i],native=value.native[i],download=libraryService.library.data.downloads.find(item=>item.url===downloadURLs[i]);
    if(!row.ui.slot||!native.visible||!native.parentVisible||!native.cachedVisible||!native.attached)return false;
    if(active){
     if(!download||!row.activeIds.includes(download.id)||row.activeIds.length!==1||!row.ui.pill||row.ui.pill.hidden)return false;
     if(!['started','downloading','paused'].includes(row.activity?.state)||row.activity.total!==524288)return false;
     if(received[names[i]]!==undefined&&row.activity.received!==received[names[i]])return false;
    }else if(row.activeIds.length||row.ui.pill||row.ui.activeWidgetCount)return false;
    const expected=downloadNativeBounds(row.ui.slot,browser.mouseRoundedPanes);if(!['x','y','width','height'].every(key=>native.bounds[key]===expected[key]))return false;
   }
   return value.runningTransitions.length===0;
  },'634 '+label+' actual download/DOM/native observation',12000);
  if(original){assertIndependentGeometry(value,original,activeTabIds,browser.mouseRoundedPanes);for(let i=0;i<records.length;i++)fixture.assertIdentity(original.identities[i],value.identities[i]);}
  facts.stages.push({name:label,activeNames:[...activeNames],...value});await save();return value;
 }
 async function capture(label,snapshot,{badge=false}={}){
  const {nativeImage}=require('electron'),expected=[];
  for(let i=0;i<snapshot.panels.length;i++){
   const row=snapshot.panels[i],native=snapshot.native[i],pill=row.ui.pill;
   if(pill){
    const r=pill.bounds,p=Number(pill.ariaNow)/100;assert.ok(p>.02&&p<.95,'Known held bytes provide both filled and remaining pixels');
    for(const [kind,x,color]of [['fill',r.x+r.width*p/2,PALETTE.fill],['track',r.x+r.width*(1+p)/2,PALETTE.track]])for(const dy of [-2,0,2])expected.push({kind,tabId:row.tabId,point:{x,y:r.y+r.height/2+dy},expectedRGB:color});
    const line=await fixture.js('getComputedStyle(document.documentElement).getPropertyValue("--line").trim()');const lineRGB=await fixture.js(`(()=>{const probe=document.createElement('span');probe.style.color=${JSON.stringify(line)};document.body.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color.match(/[\\d.]+/g).slice(0,3).map(Number);})()`);
    expected.push({kind:'gap',tabId:row.tabId,point:{x:r.x+r.width/2,y:r.y-3},expectedRGB:lineRGB});
   }
   const content=await fixture.pageJS(records[i],'(()=>{const element=document.querySelector("#region-a"),r=element.getBoundingClientRect();return{bounds:{x:r.x,y:r.y,width:r.width,height:r.height},color:getComputedStyle(element).backgroundColor};})()'),color=colorFor(records[i].index,0),r=content.bounds;
   assert.equal(content.color,'rgb('+color.join(', ')+')');assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=native.bounds.width&&r.y+r.height<=native.bounds.height);
   for(const [dx,dy]of [[0,0],[-4,0],[4,0],[0,-4],[0,4]])expected.push({kind:'native-page',tabId:row.tabId,point:{x:native.bounds.x+r.x+r.width/2+dx,y:native.bounds.y+r.y+r.height/2+dy},expectedRGB:color});
  }
  if(badge){
   const state=await fixture.js('(()=>{const e=document.querySelector("#downloads-button .mouse-download-badge"),r=e.getBoundingClientRect();return{hidden:e.hidden,display:getComputedStyle(e).display,color:getComputedStyle(e).backgroundColor,text:e.textContent,bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};})()');assert.equal(state.hidden,false);assert.notEqual(state.display,'none');assert.equal(state.color,'rgb(7, 130, 60)');assert.ok(Number(state.text)>=1);facts.badge=state;
   for(const dy of [-1,0,1])expected.push({kind:'unread-badge',point:{x:state.bounds.x+2.5,y:state.bounds.y+state.bounds.height/2+dy},expectedRGB:PALETTE.fill});
  }
  const attempts=[],result={label,theme:snapshot.theme,attempts,acceptedAttempt:null};facts.captures.push(result);let accepted;
  for(let attempt=1;attempt<=4;attempt++){
   const file=filePrefix+'-'+label+'-'+snapshot.theme+'-'+attempt+'.png',source=await screenCapture(file,'634 bottom download '+label),png=await fs.readFile(source.filename),full=await fs.readFile(source.displayFilename);assert.equal(sha256(png),source.sha256);assert.equal(sha256(full),source.displaySha256);
   const size={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};assert.deepEqual(size,source.pixelSize);const bitmap=nativeImage.createFromBuffer(png).toBitmap({scaleFactor:1}),probes=expected.map(row=>{const pixel=pixelAt(bitmap,size,source.mapping,row.point),delta=probeDelta(pixel.rgba,row.expectedRGB);return{...row,pixel,maxChannelDelta:delta,pass:delta<=PIXEL_TOLERANCE};}),pass=probes.every(probe=>probe.pass);
   const after=records.map(fixture.nativeState);assert.deepEqual(after,snapshot.native,'OS readback never hides, moves or replaces the measured native pages');const capture={attempt,pass,...source,probes};attempts.push(capture);await save();if(pass){accepted=capture;result.acceptedAttempt=attempt;break;}await fixture.frame();
  }
  await save();assert.ok(accepted,'Actual OS frame contains the full-width green widget, gap, live pages and requested badge');return result;
 }
 async function start(index){
  const name=names[index],record=records[index],selector='#download-'+name,input=await guestClick(record,selector);assert.ok(['CGEvent','User32','XTest'].includes(input.source));assert.equal(input.webContentsId,record.page.view.webContents.id);assert.ok(input.events.some(event=>event.id===selector.slice(1)&&(event.isTrusted===true||event.trusted===true)));facts.nativeInputs.push(input);
  await fixture.until(()=>downloads.has(name)&&streams.has(name),'634 native DownloadItem '+name);assert.equal(downloads.get(name).webContentsId,record.page.view.webContents.id);assert.equal(streams.get(name).data.length,524288);assert.equal(streams.get(name).requests,1);await save();
 }
 try{
  original=await settled('before',[]);facts.unreadBefore=original.activity.unreadCount;
  await start(0);const first=await settled('first-active',[names[0]],{received:{[names[0]]:65536}});await capture('first',first);
  await start(1);const concurrent=await settled('both-active',names,{received:{[names[0]]:65536,[names[1]]:65536}});await capture('both',concurrent);
  streams.get(names[0]).cap=262144;streams.get(names[1]).cap=131072;const advanced=await settled('measured-progress',names,{received:{[names[0]]:262144,[names[1]]:131072}});
  assert.equal(advanced.panels[0].ui.pill.ariaNow,'50');assert.equal(advanced.panels[1].ui.pill.ariaNow,'25');assert.deepEqual(advanced.native,concurrent.native,'Measured byte changes do not alter native geometry');
  const otherTheme=initialTheme==='dark'?'light':'dark';await fixture.js(`MouseTest.setTheme(${JSON.stringify(otherTheme)})`);await capture('both',await settled('both-other-theme',names,{received:{[names[0]]:262144,[names[1]]:131072}}));await fixture.js(`MouseTest.setTheme(${JSON.stringify(initialTheme)})`);
  streams.get(names[0]).cap=streams.get(names[0]).data.length;await fixture.until(()=>downloads.get(names[0]).done==='completed','634 first native download completes',12000);const firstDone=await settled('first-completed',[names[1]],{received:{[names[1]]:131072}});assert.equal(firstDone.activity.unreadCount,facts.unreadBefore+1);await capture('first-completed',firstDone,{badge:true});
  streams.get(names[1]).cap=streams.get(names[1]).data.length;await fixture.until(()=>downloads.get(names[1]).done==='completed','634 second native download completes',12000);const completed=await settled('both-completed',[]);assert.equal(completed.activity.unreadCount,facts.unreadBefore+2);await capture('completed',completed,{badge:true});
  for(let i=0;i<names.length;i++){
   const name=names[i],record=downloads.get(name),data=await fs.readFile(record.path||record.file),expected=streams.get(name).data,entry=libraryService.library.data.downloads.find(item=>item.url===downloadURLs[i]);assert.ok(entry);assert.equal(entry.state,'completed');assert.equal(entry.received,data.length);assert.equal(entry.total,expected.length);assert.equal(data.length,524288);assert.equal(sha256(data),sha256(expected));assert.equal(streams.get(name).requests,1);assert.ok(record.events.some(event=>(event.type||event.event)==='done'&&event.state==='completed'));assert.equal(record.webContentsId,records[i].page.view.webContents.id);
   const url=record.item.getURL();assert.equal(url,downloadURLs[i]);assert.equal(entry.url,url);
   facts.files.push({name,id:entry.id,url,tabId:records[i].id,webContentsId:record.webContentsId,filename:path.basename(record.path||record.file),bytes:data.length,sha256:sha256(data),expectedBytes:expected.length,expectedSha256:sha256(expected),requests:streams.get(name).requests,events:record.events.map(event=>({...event})),saveDecision:'DownloadItem.setSavePath only for this owned HTTP fixture'});
  }
  for(let i=0;i<records.length;i++){fixture.assertIdentity(original.identities[i],completed.identities[i]);assert.ok(completed.identities[i].ticks>original.identities[i].ticks,'Both original renderers kept running throughout the transfer');}
  facts.ok=true;facts.unreadAfter=completed.activity.unreadCount;await save();return{...facts,reportFile,reportSha256:sha256(await fs.readFile(reportFile))};
 }catch(error){facts.error={message:error.message,stack:error.stack};throw error;}
 finally{await fixture.js(`MouseTest.setTheme(${JSON.stringify(initialTheme)})`).catch(()=>{});await save();}
};
module.exports.widgetSnapshot=widgetSnapshot;
module.exports.assertIndependentGeometry=assertIndependentGeometry;
module.exports.pixelAt=pixelAt;
module.exports.probeDelta=probeDelta;
module.exports.PALETTE=PALETTE;
module.exports.ownedDownloadURL=ownedDownloadURL;
