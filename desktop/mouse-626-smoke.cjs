'use strict';
// Actual installed controls, compositor frames and native page identities in
// the isolated CI profile. The former contour-morph gates are superseded.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {screen,clipboard,ClipboardItem,nativeImage}=require('electron');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {armFrameCapture}=require('./mouse-smoke-frames.cjs');
const {closingReversalPair,observeNoraReversal}=require('./mouse-smoke-reversal.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<400;i++){if(await fn())return;await sleep(25);}throw Error('Mouse627 motion timeout: '+label);}
const layoutKeys=['desktopId','mode','agentOpen','tree','slots','active','tabOrder','aiId','aiSessions','aiOpen','aiWidth'];
function paintedPanel(pixels,size,geometry){
 const sx=size.width/geometry.viewport.width,sy=size.height/geometry.viewport.height,top=geometry.baseline-geometry.height,columns=[.2,.5,.8].map(f=>Math.floor((geometry.left+geometry.width*f)*sx)),fill=geometry.fill,line=geometry.line;
 const rgb=(x,y)=>{const i=(y*size.width+x)*4;return[pixels[i+2],pixels[i+1],pixels[i],pixels[i+3]];},distance=(a,b)=>Math.max(...b.map((v,i)=>Math.abs(a[i]-v))),solid=p=>p[3]===255&&distance(p,fill)<=2;
 const delta=line.map((v,i)=>v-fill[i]),norm=delta.reduce((sum,v)=>sum+v*v,0);
 for(let y=Math.max(2,Math.floor(top*sy));y<Math.min(size.height-7,Math.floor((geometry.baseline-8)*sy));y++){
  const probes=[];let matched=true;
  for(const x of columns){
   const above=rgb(x,y-Math.max(2,Math.round(2*sy))),edge=rgb(x,y),inside=rgb(x,y+Math.max(2,Math.round(2*sy))),lower=rgb(x,y+Math.max(6,Math.round(6*sy))),mix=edge.slice(0,3).reduce((sum,v,i)=>sum+(v-fill[i])*delta[i],0)/norm;
   if(solid(above)||!solid(inside)||!solid(lower)||edge[3]!==255||mix<.025||mix>1.03||distance(edge,fill.map((v,i)=>v+delta[i]*mix))>8){matched=false;break;}
   probes.push({x,y,above,edge,inside,lower});
  }
  if(matched){const paintedTop=y/sy,translateY=paintedTop-top;return{top:paintedTop,translateY,progress:1-translateY/geometry.height,probes};}
 }
 return null;
}
module.exports=async({app,win,browser,store})=>{
 assert.equal(process.env.CI,'true','The visual fixture must never run in a personal profile');
 assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 const js=source=>win.webContents.executeJavaScript(source),native=require('./mouse-native-menu.node'),debug=win.webContents.debugger;
 const bounds=win.getBounds(),originalFullscreen=win.isFullScreen(),original=await js('MouseTest.prefs()'),layout=()=>js(`Object.fromEntries(${JSON.stringify(layoutKeys)}.map(k=>[k,MouseTest.prefs()[k]]))`),beforeLayout=await layout();
 const allPages=()=>[...browser.tabs.values(),...browser.providers.values()];
 const pages=new Map(allPages().map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL(),epoch:page.navigationEpoch}]));
 const savedClipboard=await Promise.all((await clipboard.read()).map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
 const facts={version:'6.0.26',palette:{},stateRestored:false,supersededForNora:{version:'6.0.27',proof:'mouse-627-motion.json',reason:'Fixed-size compositor slide replaces the former contour morph'}};
 const motionFacts={version:'6.0.27',themes:['light','dark'],fixedSize:false,translationOnly:false,constantContour:false,openClosePainted:false,interruptionPreserved:false,reducedMotion:false,contentScrollable:false,backgroundStable:false,footerStable:false,stateRestored:false,frames:{},geometry:{},captures:{},captureStates:{},footer:{},background:{before:[],after:[],nativeBoundsCalls:0,resizeEvents:0,snapshots:[]}};
 let attached=false,lastClick=null,lastInput=null,verificationError,cleanupError,backgroundProbe=false,paintCapture=null;
 const boundsHooks=[],captureDiagnostics=[];
 const phase=()=>js('document.querySelector("#desktop-tray").dataset.motion');
 const settled=()=>until(()=>js('(()=>{const t=document.querySelector("#desktop-tray");return t.hidden||t.dataset.motion==="open";})()'),'Nora reaches its current target');
 const closed=()=>until(()=>js('document.querySelector("#desktop-tray").hidden&&!document.querySelector("#desktop-tray").open&&!document.querySelector(".mouse-floating-snapshot")'),'Nora closes and restores native pages');
 async function activate(){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await until(()=>win.isFocused(),'native window focus');}
 async function painted(){await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(60);}
 async function click(selector,wait=true){
  if(wait)await settled();await activate();
  const point=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(e?.closest('#desktop-tray'))e.scrollIntoView({block:'nearest',inline:'nearest'});return(${nativeHitTarget.toString()})(e);})()`);
  lastClick={selector,point};assert.equal(point.ready,true,'Mouse627 native target: '+JSON.stringify(lastClick));
  const origin=win.getContentBounds(),target={x:Math.round(origin.x+point.x),y:Math.round(origin.y+point.y)},area=screen.getDisplayNearestPoint(target).bounds;
  assert.ok(target.x>=area.x&&target.y>=area.y&&target.x<area.x+area.width&&target.y<area.y+area.height,'Native click stays on the display');
  lastClick.nativeAt=performance.now();assert.equal(native.testClick(target.x,target.y),true);await sleep(90);
  if(wait){if(selector==='#desktops-button')await until(async()=>await phase()==='open','Nora opens from its footer control');else if(selector==='#desks-close')await closed();await settled();}
 }
 async function key(keyCode,modifiers=[]){keyCode=({Enter:'Return',ArrowLeft:'Left',ArrowRight:'Right',ArrowUp:'Up',ArrowDown:'Down'})[keyCode]||keyCode;win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});if(keyCode==='Return')win.webContents.sendInputEvent({type:'char',keyCode:'\r',modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await sleep(35);}
 async function traceInput(selector){
  await js(`(()=>{globalThis.__mouse626Input?.dispose();const input=document.querySelector(${JSON.stringify(selector)}),events=[],types=['focus','blur','keydown','keyup','beforeinput','input','change','select','selectionchange','compositionstart','compositionupdate','compositionend'];const state=()=>{const active=document.activeElement,r=input.getBoundingClientRect(),style=getComputedStyle(input),measure=document.createElement('canvas').getContext('2d');measure.font=style.font;return{time:performance.now(),value:input.value,focused:active===input,documentFocused:document.hasFocus(),activeSelector:active?.tagName+'#'+active?.id,selectionStart:input.selectionStart,selectionEnd:input.selectionEnd,fullySelected:active===input&&input.selectionStart===0&&input.selectionEnd===input.value.length,disabled:input.disabled,readOnly:input.readOnly,maxLength:input.maxLength,controlType:input.type,rect:{x:r.x,y:r.y,width:r.width,height:r.height},requiredTextWidth:measure.measureText('#FFFFFF').width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth),paletteHidden:document.querySelector('#capture-palette').hidden,color:document.querySelector('#capture-color').value};};const observe=e=>{if(e.target!==input&&!(e.type==='selectionchange'&&document.activeElement===input))return;events.push({type:e.type,key:e.key??null,data:e.data??null,inputType:e.inputType??null,isTrusted:e.isTrusted,defaultPrevented:e.defaultPrevented,...state()});if(events.length>100)events.shift();};for(const type of types)document.addEventListener(type,observe,true);globalThis.__mouse626Input={state,events,dispose(){for(const type of types)document.removeEventListener(type,observe,true);}};})()`);
 }
 const inputState=()=>js('globalThis.__mouse626Input.state()');
 async function type(selector,value){
  lastInput={selector,value,stage:'focus',snapshots:[]};await traceInput(selector);await click(selector);await until(async()=>{lastInput.observed=await inputState();return lastInput.observed.focused;},'palette input receives focus');
  lastInput.snapshots.push({stage:'focused',...lastInput.observed});assert.ok(lastInput.observed.rect.width>=lastInput.observed.requiredTextWidth,'The complete seven-character HEX value fits in its native input');
  lastInput.stage='select-all';await key('A',['meta']);await until(async()=>{lastInput.observed=await inputState();return lastInput.observed.fullySelected;},'palette input is fully selected');lastInput.snapshots.push({stage:'selected',...lastInput.observed});
  lastInput.stage='insert';await win.webContents.insertText(value);lastInput.snapshots.push({stage:'insert-complete',...await inputState()});await until(async()=>{lastInput.observed=await inputState();return lastInput.observed.value.toLowerCase()===value.toLowerCase();},'native text reaches the palette input');
  lastInput.stage='verified';lastInput.snapshots.push({stage:'verified',...lastInput.observed});lastInput.events=await js('globalThis.__mouse626Input.events');(facts.palette.inputs??=[]).push(lastInput);
 }
 async function gesture(a,b,steps=10){
  await activate();const origin=win.getContentBounds(),from={x:Math.round(origin.x+a.x),y:Math.round(origin.y+a.y)},to={x:Math.round(origin.x+b.x),y:Math.round(origin.y+b.y)};
  assert.equal(native.testMouse(from.x,from.y,0),true);
  try{for(let i=1;i<=steps;i++){assert.equal(native.testMouse(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps,1),true);await sleep(18);}}
  finally{assert.equal(native.testMouse(to.x,to.y,2),true);}await sleep(60);
 }
 async function installRecorder(){
  await js(`(()=>{
   globalThis.__mouse627Recorder?.stop();const frames=[],sizes=[],mutations=[],longTasks=[],tray=document.querySelector('#desktop-tray'),panel=tray.querySelector('.desk-burrow-panel'),outline=document.querySelector('#mouse-dock-outline'),fill=document.querySelector('#mouse-dock-fill'),surface=document.querySelector('#mouse-dock-surface'),content=tray.querySelector('.desk-content'),button=tray.querySelector('#desks-close');let raf=0,stopped=false,geometry=null,tasks=null;
   if(globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')){tasks=new PerformanceObserver(list=>{for(const entry of list.getEntries()){longTasks.push({startTime:entry.startTime,duration:entry.duration,name:entry.name});if(longTasks.length>128)longTasks.shift();}});tasks.observe({type:'longtask'});}
   const resize=new ResizeObserver(entries=>{for(const entry of entries)sizes.push({time:performance.now(),target:entry.target===tray?'tray':entry.target===panel?'panel':entry.target===content?'content':'button',width:entry.contentRect.width,height:entry.contentRect.height,phase:tray.dataset.motion});});for(const e of [tray,panel,content,button])resize.observe(e);
   const mutation=new MutationObserver(records=>{for(const record of records){if(!geometry)continue;const target=record.target;mutations.push({time:performance.now(),phase:tray.dataset.motion,target:target.id||target.className,attribute:record.attributeName,value:target.getAttribute(record.attributeName)});}});for(const e of [outline,fill,surface])mutation.observe(e,{attributes:true,attributeFilter:['d','viewBox']});mutation.observe(tray,{attributes:true,attributeFilter:['style']});
   const sample=()=>{
    const value=MouseTest.desktopUI.motion.sample();if(!value)return null;
    if(!geometry){const size=e=>({width:e.offsetWidth,height:e.offsetHeight});geometry={tray:size(tray),panel:size(panel),content:size(content),button:size(button),font:getComputedStyle(button).fontSize,footer:(()=>{const r=document.querySelector('#statusbar').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()};}
    const transform=new DOMMatrix(getComputedStyle(panel).transform),style=getComputedStyle(content),buttonStyle=getComputedStyle(button);
    return{time:performance.now(),documentTime:document.timeline.currentTime,phase:tray.dataset.motion,progress:value.progress,open:tray.open,hidden:tray.hidden,height:value.height,targetHeight:value.targetHeight,width:value.width,left:value.left,baseline:value.baseline,inert:content.inert,opacity:Number(style.opacity),font:buttonStyle.fontSize,controlBackdrop:buttonStyle.backdropFilter,controlWebkitBackdrop:buttonStyle.webkitBackdropFilter,measurements:value.measurements,geometryWrites:value.geometryWrites,paths:{outline:outline.getAttribute('d'),fill:fill.getAttribute('d'),viewBox:surface.getAttribute('viewBox')},matrix:{a:transform.a,b:transform.b,c:transform.c,d:transform.d,e:transform.e,f:transform.f}};
   };
   const recorder={frames,sizes,mutations,longTasks,sample,onFrame:null,stop(){if(!stopped){const frame=sample();if(frame)frames.push(frame);}stopped=true;cancelAnimationFrame(raf);resize.disconnect();mutation.disconnect();tasks?.disconnect();recorder.onFrame=null;return{frames,geometry,sizes,mutations,longTasks,timeOrigin:performance.timeOrigin,startup:MouseTest.desktopUI.motion.diagnostics?.()};}};
   const tick=()=>{const frame=sample();if(frame){frames.push(frame);recorder.onFrame?.(frame);}if(!stopped&&frames.length<1000)raf=requestAnimationFrame(tick);};globalThis.__mouse627Recorder=recorder;tick();
  })()`);
 }
 async function armInterruptedReopen(){
  await js(`(()=>{
   globalThis.__mouse627Reversal?.dispose();const tray=document.querySelector('#desktop-tray');
   globalThis.__mouse627Reversal=(${observeNoraReversal.toString()})({recorder:globalThis.__mouse627Recorder,tray,panel:tray.querySelector('.desk-burrow-panel'),eventTarget:window,reopen:()=>MouseTest.desktopUI.open(),qualifiesClosing:${closingReversalPair.toString()}});return true;
  })()`);
 }
 async function retainFrames(name){
  const record=await js('globalThis.__mouse627Recorder.stop()');motionFacts.frames[name]=record.frames;motionFacts.geometry[name]={sizes:record.sizes,initial:record.geometry,mutations:record.mutations,longTasks:record.longTasks,timeOrigin:record.timeOrigin,startup:record.startup};
  await fs.writeFile('mouse-627-motion-diagnostics.json',JSON.stringify({version:motionFacts.version,frames:motionFacts.frames,geometry:motionFacts.geometry},null,2)+'\n');return record;
 }
 function fixedGeometry(record,label){
  const frames=record.frames.filter(f=>f.open&&!f.hidden);assert.ok(frames.length>0,label+' has actual rendered frames');const first=frames[0];
  for(const frame of frames){
   assert.ok([frame.height,frame.width,frame.progress,...Object.values(frame.matrix)].every(Number.isFinite),label+' records finite geometry');
   assert.equal(frame.height,first.height,label+' preserves panel height');assert.equal(frame.targetHeight,first.height);assert.equal(frame.width,first.width,label+' preserves panel width');
   assert.deepEqual(frame.paths,first.paths,label+' preserves the complete contour');assert.equal(frame.geometryWrites,first.geometryWrites,label+' has no per-frame geometry writes');
   assert.equal(frame.font,first.font,label+' keeps the text size');assert.equal(frame.opacity,1,label+' keeps the content opaque instead of balloon scaling or fading it');
   assert.equal(frame.controlBackdrop,'none',label+' avoids backdrop filters inside the opaque moving panel');assert.ok(['','none'].includes(frame.controlWebkitBackdrop),label+' avoids prefixed backdrop filters');
   const m=frame.matrix;for(const key of ['a','d'])assert.ok(Math.abs(m[key]-1)<.001,label+' has unit scale');for(const key of ['b','c','e'])assert.ok(Math.abs(m[key])<.001,label+' only translates vertically');
   assert.ok(m.f>=-.1&&m.f<=frame.height+.1,label+' remains on its translation track');assert.ok(Math.abs(m.f/frame.height-(1-frame.progress))<.02,label+' paints its actual sampled WAAPI translation');
  }
  // The initial ResizeObserver delivery may measure once, but the animation
  // must never measure/rewrite its shape on each rendered frame.
  assert.ok(Math.max(...frames.map(f=>f.measurements))-Math.min(...frames.map(f=>f.measurements))<=2,label+' avoids geometry reads on animation frames');
  assert.equal(record.mutations.filter(m=>m.time>first.time&&m.time<frames.at(-1).time).length,0,label+' has no path/viewBox/viewport-style mutation during motion');
  for(const name of ['tray','panel','content','button']){const nonzero=record.sizes.filter(s=>s.target===name&&s.width>0&&s.height>0);if(nonzero.length){for(const size of nonzero)assert.ok(Math.abs(size.width-nonzero[0].width)<.05&&Math.abs(size.height-nonzero[0].height)<.05,label+' keeps the actual '+name+' box constant');}}
  assert.ok(record.geometry.panel.height>100&&Math.abs(record.geometry.panel.height-first.height)<=1,label+' samples a full fixed panel');
 }
 function continuous(record,direction,label){
  fixedGeometry(record,label);const moving=record.frames.filter(f=>f.phase===direction&&f.progress>0&&f.progress<1);
  assert.ok(moving.length>=3,label+' paints at least three intermediate frames');
  assert.ok(Math.max(...moving.map(f=>f.matrix.f))-Math.min(...moving.map(f=>f.matrix.f))>=2,label+' paints distinct translations');
  for(let i=1;i<moving.length;i++){const delta=moving[i].matrix.f-moving[i-1].matrix.f;assert.ok(direction==='opening'?delta<=.75:delta>=-.75,label+' moves monotonically without geometry jumps: '+JSON.stringify({before:moving[i-1],after:moving[i]}));}
  assert.ok(moving.every(f=>f.open&&!f.hidden&&f.inert),'The native view gate and inert content stay active throughout '+direction);
 }
 async function armPanelCapture(theme,state){
  const geometry=await js(`(()=>{const t=document.querySelector('#desktop-tray'),footer=document.querySelector('#statusbar').getBoundingClientRect(),toolbar=document.querySelector('.toolbar').getBoundingClientRect(),current=MouseTest.desktopUI.motion.sample(),rgb=value=>value.match(/[\\d.]+/g).slice(0,3).map(Number),width=current?.width||Math.min(1000,innerWidth-12),height=current?.height||Math.max(1,Math.min(440,footer.top-toolbar.bottom-12));return{viewport:{width:innerWidth,height:innerHeight},width,height,left:(innerWidth-width)/2,baseline:footer.top,fill:rgb(getComputedStyle(document.querySelector('#mouse-dock-fill')).fill),line:rgb(getComputedStyle(document.querySelector('#mouse-dock-outline')).stroke),before:globalThis.__mouse627Recorder?.sample()};})()`);
  const diagnostic={theme,state,geometry,timeOrigin:performance.timeOrigin,armedAt:performance.now(),ready:null,frames:[],retainedBytes:0,droppedFrames:0},retained=[];captureDiagnostics.push(diagnostic);
  let last=null;const capture=armFrameCapture(win.webContents,{select(image,frame){
   const receivedAt=performance.now();
   const pixels=image.toBitmap({scaleFactor:frame.scaleFactor});assert.equal(pixels.length,frame.pixelSize.width*frame.pixelSize.height*4,'Presentation bitmap matches its native dimensions');
   last=paintedPanel(pixels,frame.pixelSize,geometry);
   const selected=!!last&&last.translateY>=Math.max(16,geometry.height*.08)&&last.translateY<=geometry.height*.9,row={...frame,receivedAt,selectionMs:performance.now()-receivedAt,boundary:last,selected};diagnostic.frames.push(row);
   // Keep a small, bounded raw sample for a failed capture. PNG encoding and
   // disk writes happen only after the subscription has ended, never in motion.
   if(retained.length<12&&diagnostic.retainedBytes+pixels.length<=32*1024*1024){retained.push({row,pixels});diagnostic.retainedBytes+=pixels.length;}else diagnostic.droppedFrames++;
   // Detect the top edge first, then reject endpoints. A scrim or a fully open
   // panel must never pass as motion simply because a DOM sample was moving.
   if(!selected)return null;
   return{theme,state,geometry,...last};
  }});paintCapture=capture;capture.result.catch(()=>{});
  const armed={capture,geometry,last:()=>last,clear:()=>{retained.length=0;},async failure(){
   diagnostic.lastClick=lastClick;diagnostic.failedAt=performance.now();
   for(const {row,pixels}of retained){const filename='mouse-627-panel-'+theme+'-'+state+'-rejected-'+String(row.sequence).padStart(3,'0')+'.png';try{const image=nativeImage.createFromBitmap(pixels,{...row.pixelSize,scaleFactor:1}),png=image.toPNG();assert.deepEqual({width:png.readUInt32BE(16),height:png.readUInt32BE(20)},row.pixelSize);await fs.writeFile(filename,png);row.filename=filename;}catch(error){row.writeError=error.message;}}
  }};
  try{diagnostic.ready=await capture.ready;return armed;}catch(error){await armed.failure();armed.clear();throw error;}
 }
 async function capturePanel(theme,state,armed){
  if(armed){
   try{const result=await armed.capture.result,{png,...painted}=result,filename='mouse-627-panel-'+theme+'-'+state+'.png';assert.deepEqual({width:png.readUInt32BE(16),height:png.readUInt32BE(20)},result.pixelSize,'Saved PNG is the selected presentation bitmap');await fs.writeFile(filename,png);(motionFacts.captures[theme]??={})[state]=filename;(motionFacts.captureStates[theme]??={})[state]={before:armed.geometry.before,after:await js('globalThis.__mouse627Recorder?.sample()'),painted};}
   catch(error){await armed.failure();throw Error(error.message+'; last painted boundary: '+JSON.stringify(armed.last()));}
   finally{armed.capture.cancel();armed.clear();if(paintCapture===armed.capture)paintCapture=null;}return;
  }
  const before=await js('globalThis.__mouse627Recorder?.sample()');
  if(state!=='open')assert.ok(before&&before.phase===(state==='opening'?'opening':'closing')&&before.progress>0&&before.progress<1,'Capture begins during a natural '+state+' frame');
  const filename='mouse-627-panel-'+theme+'-'+state+'.png',image=await win.capturePage();await fs.writeFile(filename,image.toPNG());
  (motionFacts.captures[theme]??={})[state]=filename;(motionFacts.captureStates[theme]??={})[state]={before,after:await js('globalThis.__mouse627Recorder?.sample()')};
 }
 async function footer(){
  const data=await js(`(()=>{const bar=document.querySelector('#statusbar'),r=bar.getBoundingClientRect(),style=getComputedStyle(bar);return{x:r.x,y:r.y,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight},borderWidth:style.borderTopWidth,borderColor:style.borderTopColor,borderImage:style.borderImageSource,background:style.backgroundColor};})()`),image=await win.capturePage(),size=image.getSize(),pixels=image.toBitmap(),sx=size.width/data.viewport.width,sy=size.height/data.viewport.height;
  data.pixels=[.15,.3,.7,.85].map(fraction=>{const x=data.x+data.width*fraction,y=data.y+.25,i=(Math.floor(y*sy)*size.width+Math.floor(x*sx))*4;return{x,y,rgb:[pixels[i+2],pixels[i+1],pixels[i]]};});return data;
 }
 async function fixedControls(theme){
  const before=await js('MouseTest.desktopUI.motion.sample()'),states=[];
  await click('.desktop-card[aria-current="true"] .desk-preview-button');await until(()=>js('!document.querySelector("#desktop-preview-popover").hidden'),'preview opens within Nora');
  for(const [name,selector]of [['preview','.desk-preview-close'],['modes','#desk-modes .desk-mode:last-child'],['history','#desk-history-panel']]){
   if(name==='modes'){await click('.desk-preview-close');await click('#desk-modes-button');assert.equal(await js('document.querySelector("#desk-modes").inert'),false);}
   if(name==='history'){await click('#desk-history-button');assert.equal(await js('document.querySelector("#desk-history-panel").hidden'),false);assert.equal(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")'),'false');}
   const state=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),tray=document.querySelector('#desktop-tray'),content=tray.querySelector('.desk-content');e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect(),c=content.getBoundingClientRect(),hit=(${nativeHitTarget.toString()})(e),sample=MouseTest.desktopUI.motion.sample();return{name:${JSON.stringify(name)},height:tray.offsetHeight,width:tray.offsetWidth,paths:sample.paths,geometryWrites:sample.geometryWrites,scrollTop:content.scrollTop,scrollHeight:content.scrollHeight,clientHeight:content.clientHeight,overflow:getComputedStyle(content).overflowY,accessible:hit.ready,visibleHeight:Math.max(0,Math.min(r.bottom,c.bottom)-Math.max(r.top,c.top))};})()`);
   assert.ok(Math.abs(state.height-before.height)<=1&&Math.abs(state.width-before.width)<=1,theme+' '+name+' uses the same fixed viewport');assert.deepEqual(state.paths,before.paths);assert.equal(state.geometryWrites,before.geometryWrites);assert.equal(state.overflow,'auto');assert.ok(state.accessible&&state.visibleHeight>0,theme+' '+name+' remains reachable inside the scroll viewport');states.push(state);
  }
  await click('#desk-history-button');motionFacts.geometry[theme+'Controls']=states;
 }
 async function pageSnapshot(page){
  const wc=page.view.webContents,renderer=await wc.executeJavaScript('({timeOrigin:performance.timeOrigin,width:innerWidth,height:innerHeight,scrollX,scrollY,resizeEvents:globalThis.__mouse627PageProbe?.events||[]})');
  return{id:page.id,webContentsId:wc.id,url:wc.getURL(),epoch:page.navigationEpoch||0,bounds:page.view.getBounds(),clip:page.clipView?.getBounds()||null,surfaceBounds:page.bounds||null,visible:!!page.visible,...renderer};
 }
 async function beginBackgroundProbe(){
  await painted();backgroundProbe=true;
  for(const page of allPages()){
   const wc=page.view.webContents;await wc.executeJavaScript('(()=>{const events=[],observe=()=>events.push({time:performance.now(),width:innerWidth,height:innerHeight});window.addEventListener("resize",observe);globalThis.__mouse627PageProbe={events,dispose:()=>window.removeEventListener("resize",observe)};})()');
   motionFacts.background.before.push(await pageSnapshot(page));
   for(const view of [page.view,page.clipView].filter(Boolean)){const original=view.setBounds;view.setBounds=function(...args){motionFacts.background.nativeBoundsCalls++;return original.apply(this,args);};boundsHooks.push({view,original});}
  }
 }
 async function snapshotEvidence(theme){
  const images=await js(`[...document.querySelectorAll('.mouse-floating-snapshot')].map(image=>{const r=image.getBoundingClientRect();return{id:image.dataset.tabId,complete:image.complete,png:image.src.startsWith('data:image/png;base64,'),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},transform:getComputedStyle(image).transform};})`);
  const visible=motionFacts.background.before.filter(before=>before.visible);
  assert.ok(images.length>0,'Nora keeps the visible native pages painted with exact-size PNG surfaces');assert.equal(new Set(images.map(image=>image.id)).size,images.length,'One surface is used per visible page');
  for(const image of images){const page=visible.find(before=>before.id===image.id),expected=page?.surfaceBounds;assert.ok(page&&expected,'Surface belongs to an existing visible native page');assert.equal(image.complete,true);assert.equal(image.png,true);assert.equal(image.transform,'none');assert.deepEqual(image.bounds,expected,'The surface occupies the exact unchanged native page bounds');assert.ok(image.naturalWidth>=expected.width&&image.naturalHeight>=expected.height,'Snapshot has at least the native viewport pixel resolution');}
  assert.deepEqual(images.map(image=>image.id).sort(),visible.map(page=>page.id).sort(),'Every previously visible native page retains its painted surface');motionFacts.background.snapshots.push({theme,images});
 }
 async function endBackgroundProbe(){
  for(const page of allPages())motionFacts.background.after.push(await pageSnapshot(page));
  motionFacts.background.resizeEvents=motionFacts.background.after.reduce((sum,page)=>sum+page.resizeEvents.length,0);
  assert.equal(motionFacts.background.nativeBoundsCalls,0,'Nora never moves or resizes a native page');assert.equal(motionFacts.background.resizeEvents,0,'Hidden native documents receive no viewport resize event');
  const comparable=pages=>pages.map(({resizeEvents,...page})=>page);assert.deepEqual(comparable(motionFacts.background.after),comparable(motionFacts.background.before),'Nora retains real page IDs, URLs, time origins, viewports, scroll and native bounds');
  await removeBackgroundProbe();motionFacts.backgroundStable=true;
 }
 async function removeBackgroundProbe(){
  for(const {view,original}of boundsHooks.splice(0))view.setBounds=original;
  if(backgroundProbe){backgroundProbe=false;for(const page of allPages())await page.view.webContents.executeJavaScript('globalThis.__mouse627PageProbe?.dispose();delete globalThis.__mouse627PageProbe').catch(()=>{});}
 }
 async function samePages(){
  const current=new Map(allPages().map(p=>[p.id,p]));assert.deepEqual([...current.keys()].sort(),[...pages.keys()].sort(),'Nora and capture preserve all page IDs');
  for(const [id,before]of pages){const page=current.get(id);assert.equal(page,before.page);assert.equal(page.view.webContents,before.wc);assert.equal(page.view.webContents.getURL(),before.url);assert.equal(page.navigationEpoch,before.epoch);}
  assert.deepEqual(await layout(),beforeLayout,'All custom pane geometry and page membership are preserved');
 }
 async function verifyPalette(){
  await click('#screenshot-button');await until(()=>js('MouseTest.capture.isOpen()'),'screenshot editor opens');await click('#capture-all');await click('[data-tool=line]');
  await click('#capture-color');await until(()=>js('!document.querySelector("#capture-palette").hidden'),'full palette opens');
  await type('#capture-hex','#2a79c3');await key('Enter');assert.equal(await js('document.querySelector("#capture-color").value'),'#2a79c3');assert.equal(await js('document.querySelector("#capture-palette").hidden'),true);facts.palette.arbitraryHex=true;
  await click('#capture-width');await key('End');assert.equal(await js('Number(document.querySelector("#capture-width").value)'),16);
  const line=await js('(()=>{const r=document.querySelector("#capture-canvas").getBoundingClientRect();return{a:{x:r.x+40,y:r.y+50},b:{x:r.x+180,y:r.y+50}};})()');await gesture(line.a,line.b);
  await until(()=>js('MouseTest.capture.test.getOps().length===1'),'real pointer gesture creates an annotation');const first=await js('MouseTest.capture.test.getOps()[0]');assert.equal(first.tool,'line');assert.equal(first.color,'#2a79c3');
  await click('#capture-color');await click('#capture-hue');await key('End');assert.equal(await js('Number(document.querySelector("#capture-hue").value)'),359);await key('Home');assert.equal(await js('Number(document.querySelector("#capture-hue").value)'),0);
  const field=await js('(()=>{const r=document.querySelector("#capture-spectrum").getBoundingClientRect();return{a:{x:r.x+r.width*.2,y:r.y+r.height*.2},b:{x:r.x+r.width*.5,y:r.y+r.height*.5}};})()');await gesture(field.a,field.b);
  const chosen=await js('document.querySelector("#capture-color").value'),rgb=chosen.slice(1).match(/../g).map(x=>parseInt(x,16));assert.match(chosen,/^#[0-9a-f]{6}$/);assert.ok(rgb[0]>=125&&rgb[0]<=131&&rgb[1]>=60&&rgb[1]<=68&&Math.abs(rgb[1]-rgb[2])<=1,'Native saturation/value field produces the independently expected half-red RGB: '+chosen);
  assert.equal(await js('!!document.querySelector("#capture-palette [data-color=\\"'+chosen+'\\"]")'),false,'The chosen value is not one of the quick swatches');facts.palette.arbitraryRGB=true;
  const beforeKey=chosen;await key('ArrowRight',['shift']);await key('ArrowUp');assert.notEqual(await js('document.querySelector("#capture-color").value'),beforeKey,'Keyboard adjusts the 2D field');facts.palette.fieldSelection=true;
  await fs.writeFile('mouse-626-palette.png',(await win.capturePage()).toPNG());await key('Escape');await click('[data-tool=move]');const midpoint={x:(line.a.x+line.b.x)/2,y:line.a.y};await gesture(midpoint,midpoint,1);assert.equal(await js('MouseTest.capture.test.getSelected()'),0);
  await click('#capture-color');await type('#capture-hex','#7a41d3');assert.equal(await js('MouseTest.capture.test.getOps()[0].color'),'#7a41d3','Existing annotation follows custom color live');await key('Enter');await click('#capture-undo');assert.equal(await js('MouseTest.capture.test.getOps()[0].color'),'#2a79c3','One undo restores the previous annotation color');await click('#capture-redo');assert.equal(await js('MouseTest.capture.test.getOps()[0].color'),'#7a41d3');facts.palette.annotationApplied=true;
  await click('#capture-copy');await until(()=>js('document.querySelector("#capture-status").textContent.includes("Скопировано")'),'actual PNG reaches the native clipboard');
  const item=(await clipboard.read()).find(value=>value.types.includes('image/png'));assert.ok(item,'A PNG ClipboardItem exists in the real system clipboard');
  const blob=await item.getType('image/png'),png=Buffer.from(await blob.arrayBuffer());assert.equal(blob.type,'image/png');assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const exported=nativeImage.createFromBuffer(png);assert.equal(exported.isEmpty(),false);const canvas=await js('(()=>{const c=MouseTest.capture.test.getCanvas(),op=MouseTest.capture.test.getOps()[0];return{width:c.width,height:c.height,x:Math.round((op.points[0].x+op.points.at(-1).x)/2),y:Math.round((op.points[0].y+op.points.at(-1).y)/2)};})()'),size=exported.getSize();assert.equal(size.width,canvas.width);assert.equal(size.height,canvas.height);
  const bytes=exported.toBitmap(),matches=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const i=((canvas.y+dy)*size.width+canvas.x+dx)*4;if(bytes[i+2]===122&&bytes[i+1]===65&&bytes[i]===211&&bytes[i+3]===255)matches.push({x:canvas.x+dx,y:canvas.y+dy});}assert.ok(matches.length>0,'Exported native PNG preserves the exact arbitrary RGB, not a preview-only color');facts.palette.exportPreserved=true;facts.palette.exportSample={color:'#7a41d3',size,pixels:matches.length};
  await click('#capture-color');await click('#capture-palette [data-color="#32c76a"]');await click('#capture-close');await until(()=>js('!MouseTest.capture.isOpen()'),'capture editor closes');
 }
 try{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'exit inherited fullscreen');}
  const work=screen.getDisplayMatching(bounds).workArea;assert.ok(work.width>=800&&work.height>=600);win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1200,work.width-16),height:Math.min(820,work.height-16)});
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');await closed();await activate();await painted();
  assert.equal(debug.isAttached(),false);debug.attach('1.3');attached=true;await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),false);
  await beginBackgroundProbe();
  for(const theme of motionFacts.themes){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await painted();const footerBefore=await footer();await installRecorder();const openingCapture=await armPanelCapture(theme,'opening');await click('#desktops-button',false);
   await capturePanel(theme,'opening',openingCapture);await until(async()=>await phase()==='open','open fixed panel');await painted();await capturePanel(theme,'open');const opening=await retainFrames(theme+'Opening');continuous(opening,'opening',theme+' opening');
   assert.ok(allPages().every(page=>!page.visible),'Native pages are held behind the painted snapshot without changing their viewports');await snapshotEvidence(theme);
   const footerAfter=await footer();assert.deepEqual(footerAfter,footerBefore,theme+' keeps the footer geometry, border and actual pixels stationary');motionFacts.footer[theme]={before:footerBefore,after:footerAfter};
   await fixedControls(theme);await installRecorder();const closingCapture=await armPanelCapture(theme,'closing');await click('#desks-close',false);await capturePanel(theme,'closing',closingCapture);await closed();const closing=await retainFrames(theme+'Closing');continuous(closing,'closing',theme+' closing');await samePages();
  }
  Object.assign(motionFacts,{fixedSize:true,translationOnly:true,constantContour:true,openClosePainted:true,contentScrollable:true,footerStable:true});
  await installRecorder();await armInterruptedReopen();await click('#desktops-button',false);const openingTrigger=await js('globalThis.__mouse627Reversal.opening');assert.equal(openingTrigger.error,undefined,'Native Escape waits for the real opening timeline: '+JSON.stringify(openingTrigger));await key('Escape');
  const interruption=await js('globalThis.__mouse627Reversal.promise');motionFacts.interruption=interruption;assert.equal(interruption.error,undefined,'Reversal waits for genuine painted closing motion: '+JSON.stringify(interruption));assert.ok(closingReversalPair(...interruption.closingFrames));assert.ok(Math.abs(interruption.before.progress-interruption.after.progress)<.04,'Reversal retains the current progress');assert.ok(Math.abs(interruption.before.matrix.f-interruption.after.matrix.f)<2,'Reversal does not jump to an endpoint');assert.deepEqual(interruption.after.paths,interruption.before.paths);assert.equal(interruption.after.height,interruption.before.height);assert.equal(interruption.open,true);await until(async()=>await phase()==='open','reopened panel finishes');const interrupted=await retainFrames('interrupted');fixedGeometry(interrupted,'interrupted translation');assert.ok(interrupted.frames.some(f=>f.phase==='closing')&&interrupted.frames.some(f=>f.phase==='opening'));motionFacts.interruptionPreserved=true;await click('#desks-close');
  await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),true);await installRecorder();await click('#desktops-button');assert.equal(await phase(),'open');assert.equal(await js('MouseTest.desktopUI.motion.progress'),1);await click('#desks-close');const reduced=await retainFrames('reduced');assert.ok(reduced.frames.length>0);assert.ok(reduced.frames.every(f=>f.progress===0||f.progress===1),'Reduced motion has no intermediate translation');fixedGeometry(reduced,'reduced motion');motionFacts.reducedMotion=true;
  await endBackgroundProbe();await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await verifyPalette();await samePages();
 }catch(error){
  verificationError=error;const renderer=await js('({timeOrigin:performance.timeOrigin,current:globalThis.__mouse627Recorder?.sample(),frames:globalThis.__mouse627Recorder?.frames,sizes:globalThis.__mouse627Recorder?.sizes,mutations:globalThis.__mouse627Recorder?.mutations,longTasks:globalThis.__mouse627Recorder?.longTasks,startup:MouseTest.desktopUI.motion.diagnostics?.(),backdrop:MouseTest.desktopUI.diagnostics?.(),input:globalThis.__mouse626Input?{state:globalThis.__mouse626Input.state(),events:globalThis.__mouse626Input.events}:null})').catch(diagnosticError=>({error:diagnosticError.message}));
  if(lastInput&&renderer.input){lastInput.failureState=renderer.input.state;lastInput.events=renderer.input.events;}const failure={version:motionFacts.version,message:error.message,stack:error.stack,native:{timeOrigin:performance.timeOrigin,surfaces:browser.mouseDesktops?.surfaces?.diagnostics?.()},lastClick,lastInput,interruption:motionFacts.interruption??null,motion:await phase().catch(()=>null),recorded:motionFacts,renderer,captureDiagnostics};console.error('MOUSE_627_MOTION_FAILURE_CONTEXT',JSON.stringify({message:error.message,lastClick,lastInput,interruption:failure.interruption,motion:failure.motion,current:renderer.current}));await fs.writeFile('mouse-627-motion-failure.json',JSON.stringify(failure,null,2)+'\n').catch(()=>{});await fs.writeFile('mouse-627-motion-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});throw error;
 }finally{
  try{paintCapture?.cancel();paintCapture=null;await removeBackgroundProbe();await js('globalThis.__mouse627Reversal?.dispose();delete globalThis.__mouse627Reversal;globalThis.__mouse627Recorder?.stop();delete globalThis.__mouse627Recorder;globalThis.__mouse626Input?.dispose();delete globalThis.__mouse626Input;MouseTest.desktopUI.close({immediate:true});document.querySelector("#capture-dialog")?.open&&document.querySelector("#capture-dialog").close();MouseTest.zoomUI.close()');await closed();
   if(attached){await debug.sendCommand('Emulation.setEmulatedMedia',{media:'',features:[]});debug.detach();attached=false;}
   await js(`MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.requestLayout();MouseTest.save()`);await store.queue;win.setBounds(bounds);if(originalFullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'restore inherited fullscreen');}await samePages();await clipboard.write(savedClipboard);
   assert.equal(await js('document.querySelectorAll(".mouse-floating-snapshot").length'),0,'Snapshot image memory is released after closing');await until(()=>js('!document.querySelector("dialog[open]:not([data-nonmodal])")'),'all fixture modal gates close');facts.stateRestored=true;motionFacts.stateRestored=true;
  }catch(error){cleanupError=error;console.error('MOUSE_627_MOTION_CLEANUP_FAILURE',error.message);}
  if(cleanupError&&!verificationError)throw cleanupError;
 }
 await fs.writeFile('mouse-626-verification.json',JSON.stringify(facts,null,2)+'\n');await fs.writeFile('mouse-627-motion.json',JSON.stringify(motionFacts,null,2)+'\n');
 console.log('MOUSE_627_FIXED_PANEL_SLIDE_NATIVE_PASS');console.log('MOUSE_626_CAPTURE_ANY_COLOR_PASS');
};
