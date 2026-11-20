'use strict';
// Native fullscreen controls, real viewport endpoints and full OS screenshots.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {bounded,sha256}=require('./mouse-631-smoke-helpers.cjs');
const {downloadNativeBounds}=require('./mouse-630-feedback-smoke.cjs');
const {pixelAt,probeDelta}=require('./mouse-634-download-widget-smoke.cjs');

function focusedChromeReadback(){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 function chrome(selector){
  const node=document.querySelector(selector),bounds=rect(node),style=getComputedStyle(node),points=[];
  for(const fraction of [.1,.9]){
   const y=bounds.y+bounds.height*fraction;let selected;
   for(let x=bounds.x+100;x<bounds.right-100;x+=2){
    let hit=document.elementFromPoint(x,y),surface=hit,path=[],valid=true;
    while(surface&&surface!==node){
     const s=getComputedStyle(surface);path.push(surface.id||surface.tagName.toLowerCase());
     if(!['DIV','NAV','HEADER','FOOTER','FORM'].includes(surface.tagName)||s.backgroundImage!=='none'||s.backgroundColor!=='rgba(0, 0, 0, 0)'||[...surface.childNodes].some(child=>child.nodeType===3&&child.textContent.trim())||['::before','::after'].some(pseudo=>!['none','normal','""'].includes(getComputedStyle(surface,pseudo).content))){valid=false;break;}
     surface=surface.parentElement;
    }
    if(valid&&surface===node){selected={fraction,point:{x,y},hit:hit.id||hit.tagName.toLowerCase(),surfacePath:path};break;}
   }
   if(selected)points.push(selected);
  }
  return{bounds,backgroundImage:style.backgroundImage,backgroundColor:style.backgroundColor,backdropFilter:style.backdropFilter,opacity:style.opacity,points};
 }
 const m=MouseTest.model,workspace=document.querySelector('#workspace'),style=getComputedStyle(workspace),panels=MouseTest.progressUI.panels().filter(p=>p.kind==='page'&&p.content&&p.element.getBoundingClientRect().width>0).map(p=>{const s=getComputedStyle(p.element);return{key:p.key,tabId:p.tabId,pane:rect(p.element),slot:rect(p.content),radius:{topLeft:parseFloat(s.borderTopLeftRadius),topRight:parseFloat(s.borderTopRightRadius),bottomLeft:parseFloat(s.borderBottomLeftRadius),bottomRight:parseFloat(s.borderBottomRightRadius)}};});
 return{theme:m.theme,focusPane:m.focusPane||'',focusAI:!!m.focusAI,aiId:m.aiId,aiPreviewId:m.aiPreviewId||'',mainSlots:{...m.slots},workspace:rect(workspace),padding:{top:parseFloat(style.paddingTop),bottom:parseFloat(style.paddingBottom),left:parseFloat(style.paddingLeft),right:parseFloat(style.paddingRight)},header:chrome('.toolbar'),footer:chrome('#statusbar'),nora:{open:document.querySelector('#desktop-tray').open,motion:document.querySelector('#desktop-tray').dataset.motion},panels};
}
function assertFocusedGeometry(state,mode){
 const near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1/64,label+': '+a+' vs '+b),focused=mode!=='grid';
 assert.equal(state.padding.top,6);assert.equal(state.padding.bottom,focused?0:6);assert.equal(state.padding.left,0);assert.equal(state.padding.right,0);assert.ok(state.panels.length>0);
 const top=Math.min(...state.panels.map(row=>row.pane.y)),bottom=Math.max(...state.panels.map(row=>row.slot.bottom));near(top-state.header.bounds.bottom,6,'The top gap stays six pixels');near(state.footer.bounds.y-bottom,focused?0:6,'Only expanded mode removes the bottom gap');
 if(mode==='pane'){assert.ok(state.focusPane);assert.equal(state.focusAI,false);assert.equal(state.panels.length,1);assert.equal(state.panels[0].key,'pane:'+state.focusPane);}
 else if(mode==='ai'){assert.equal(state.focusPane,'');assert.equal(state.focusAI,true);assert.equal(state.panels.length,state.aiPreviewId?2:1);}
 else{assert.equal(state.focusPane,'');assert.equal(state.focusAI,false);}
 for(const row of state.panels){const lower=mode==='pane'||mode==='ai'&&row.tabId===(state.aiPreviewId||state.aiId),expected=lower?0:12;assert.equal(row.radius.topLeft,12);assert.equal(row.radius.topRight,12);assert.equal(row.radius.bottomLeft,expected);assert.equal(row.radius.bottomRight,expected);const native=state.native.find(item=>item.tabId===row.tabId);assert.ok(native&&native.visible&&native.attached&&native.parentVisible&&native.cachedVisible);assert.equal(native.roundBottom,expected);assert.deepEqual(native.bounds,downloadNativeBounds(row.slot,true));if(lower){near(row.pane.bottom,state.footer.bounds.y,'The expanded pane touches the footer');assert.equal(native.bounds.y+native.bounds.height,Math.round(state.footer.bounds.y));}}
}
function assertChromeSurfaces(state){
 assert.match(state.header.backgroundImage,/^linear-gradient\(/);assert.equal(state.footer.backgroundImage,state.header.backgroundImage);assert.equal(state.footer.backgroundColor,state.header.backgroundColor);assert.equal(state.footer.backdropFilter,state.header.backdropFilter);assert.equal(state.header.opacity,'1');assert.equal(state.footer.opacity,'1');assert.equal(state.header.points.length,2);assert.equal(state.footer.points.length,2);
}

module.exports=async({fixture,browser,win,click,screenCapture})=>{
 const file='mouse-634-focused-chrome.json',records=[...fixture.records],originalTheme=await fixture.js('MouseTest.model.theme'),originalBounds=win.getBounds(),facts={schema:1,version:fixture.app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,physicalUserDeviceVerified:false,source:'Native pane fullscreen controls, actual native bounds and full OS display pixels',stages:[],nativeInputs:[],captures:[],ok:false,restored:false};
 const save=()=>fs.writeFile(file,JSON.stringify(facts,null,2)+'\n');
 let baseline;
 async function read(){const state=await fixture.js(`(${focusedChromeReadback.toString()})()`);return{...state,window:{bounds:win.getBounds(),contentBounds:win.getContentBounds(),fullscreen:win.isFullScreen()},native:records.map(record=>({...fixture.nativeState(record),roundBottom:record.page.captureGeometry?.roundBottom})),identities:await Promise.all(records.map(fixture.identity))};}
 async function settled(label,mode){let state;await fixture.until(async()=>{state=await read();if(state.window.fullscreen!==(mode!=='grid'))return false;if(mode==='grid'&&(state.focusPane||state.focusAI))return false;if(mode==='pane'&&!state.focusPane||mode==='ai'&&!state.focusAI)return false;for(const row of state.panels){const native=state.native.find(item=>item.tabId===row.tabId),expected=downloadNativeBounds(row.slot,true);if(!native?.visible||!['x','y','width','height'].every(key=>native.bounds[key]===expected[key]))return false;}return true;},'634 focused chrome '+label,15000);assertFocusedGeometry(state,mode);assertChromeSurfaces(state);if(baseline){assert.deepEqual(state.mainSlots,baseline.mainSlots);for(let i=0;i<records.length;i++)fixture.assertIdentity(baseline.identities[i],state.identities[i]);}facts.stages.push({name:label,mode,...state});await save();return state;}
 async function nativeFullscreen(selector,active){
  const event=active?'enter-full-screen':'leave-full-screen';let handler;const completed=new Promise(resolve=>{handler=resolve;win.once(event,handler);});
  try{facts.nativeInputs.push(await click(selector));await bounded(completed,15000,'634 native '+event);await fixture.frame();if(!active)await fixture.until(()=>['x','y','width','height'].every(key=>win.getBounds()[key]===originalBounds[key]),'634 exact original window restored',15000);}finally{win.removeListener(event,handler);}
 }
 async function capture(label,state,{corners=true}={}){
  const {nativeImage}=require('electron'),expected=[];
  if(corners)for(const row of state.panels){
   const native=state.native.find(item=>item.tabId===row.tabId),record=records.find(item=>item.id===row.tabId);assert.equal(await fixture.pageJS(record,'getComputedStyle(document.documentElement).backgroundColor'),'rgb(243, 240, 232)');
   const line=await fixture.js('(()=>{const e=document.createElement("span");e.style.color="var(--line)";document.body.append(e);const value=getComputedStyle(e).color;e.remove();return value.match(/[\\d.]+/g).slice(0,3).map(Number);})()');
   for(const side of ['left','right'])expected.push({kind:'native-bottom-corner',tabId:row.tabId,side,roundBottom:native.roundBottom,point:{x:side==='left'?native.bounds.x+1.5:native.bounds.x+native.bounds.width-1.5,y:native.bounds.y+native.bounds.height-1.5},expectedRGB:native.roundBottom===0?[243,240,232]:line});
   expected.push({kind:'native-bottom-interior',tabId:row.tabId,point:{x:native.bounds.x+native.bounds.width-24.5,y:native.bounds.y+native.bounds.height-1.5},expectedRGB:[243,240,232]});
  }
  const result={label,theme:state.theme,attempts:[],acceptedAttempt:null};facts.captures.push(result);
  for(let attempt=1;attempt<=4;attempt++){
   const source=await screenCapture('mouse-634-focused-chrome-'+label+'-'+state.theme+'-'+attempt+'.png','634 focused chrome '+label),png=await fs.readFile(source.filename),full=await fs.readFile(source.displayFilename);assert.equal(sha256(png),source.sha256);assert.equal(sha256(full),source.displaySha256);const size={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},bitmap=nativeImage.createFromBuffer(png).toBitmap({scaleFactor:1});assert.deepEqual(size,source.pixelSize);assert.deepEqual(win.getContentBounds(),state.window.contentBounds);
   const probes=expected.map(row=>{const pixel=pixelAt(bitmap,size,source.mapping,row.point),delta=probeDelta(pixel.rgba,row.expectedRGB);return{...row,pixel,maxChannelDelta:delta,pass:delta<=12};}),chromePairs=state.header.points.map((header,i)=>{const footer=state.footer.points[i],a=pixelAt(bitmap,size,source.mapping,header.point),b=pixelAt(bitmap,size,source.mapping,footer.point),delta=probeDelta(a.rgba,b.rgba),visible=state.theme==='light'?a.rgba.slice(0,3).every(value=>value>=180):a.rgba.slice(0,3).reduce((sum,value)=>sum+value,0)>30;return{fraction:header.fraction,header,footer,headerPixel:a,footerPixel:b,maxChannelDelta:delta,pass:delta<=6&&visible};});
   const pass=probes.every(row=>row.pass)&&chromePairs.every(row=>row.pass),shot={attempt,pass,...source,probes,chromePairs};result.attempts.push(shot);await save();if(pass){result.acceptedAttempt=attempt;break;}await fixture.frame();
  }
  await save();assert.ok(result.acceptedAttempt,'The OS frame shows correct native bottom corners and matching top/footer backgrounds');
 }
 try{
  assert.equal(win.isFullScreen(),false);baseline=await settled('before','grid');assert.ok(baseline.panels.some(row=>row.key.startsWith('pane:')));assert.ok(baseline.panels.some(row=>row.key==='ai'),'The actual right-side chat is included');const pane=baseline.panels.find(row=>row.key.startsWith('pane:')),selector='.pane[data-pane="'+pane.key.slice(5)+'"] [data-pane-action="fullscreen"]';
  for(const theme of ['light','dark']){
   await fixture.js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await capture('grid',await settled('grid-'+theme,'grid'));
   await nativeFullscreen(selector,true);await capture('pane-expanded',await settled('pane-expanded-'+theme,'pane'));await nativeFullscreen(selector,false);await settled('pane-restored-'+theme,'grid');
   await nativeFullscreen('[data-action="ai-fullscreen"]',true);await capture('ai-expanded',await settled('ai-expanded-'+theme,'ai'));await nativeFullscreen('[data-action="ai-fullscreen"]',false);await settled('ai-restored-'+theme,'grid');
   facts.nativeInputs.push(await click('#desktops-button'));await fixture.until(()=>fixture.js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'634 Nora open chrome');const open=await read();assert.equal(open.nora.open,true);assertChromeSurfaces(open);facts.stages.push({name:'nora-open-'+theme,mode:'nora',...open});await capture('nora-open',open,{corners:false});facts.nativeInputs.push(await click('#desktops-button'));await fixture.until(()=>fixture.js('!MouseTest.desktopUI.holdsNative&&!document.querySelector("#desktop-tray").open'),'634 Nora closed chrome');await settled('nora-restored-'+theme,'grid');
  }
  await fixture.js(`MouseTest.setTheme(${JSON.stringify(originalTheme)})`);const restored=await settled('restored','grid');assert.deepEqual(restored.window.bounds,originalBounds);facts.restored=true;facts.ok=true;await save();return{...facts,reportFile:file,reportSha256:sha256(await fs.readFile(file))};
 }catch(error){facts.error={message:error.message,stack:error.stack};throw error;}
 finally{await fixture.js(`(async()=>{await MouseTest.desktopUI.close({immediate:true});if(MouseTest.model.focusPane||MouseTest.model.focusAI){MouseTest.restorePane();await MouseNative.window('pane-restore');}MouseTest.setTheme(${JSON.stringify(originalTheme)});})()`).catch(()=>{});await save();}
};
module.exports.focusedChromeReadback=focusedChromeReadback;
module.exports.assertFocusedGeometry=assertFocusedGeometry;
module.exports.assertChromeSurfaces=assertChromeSurfaces;
