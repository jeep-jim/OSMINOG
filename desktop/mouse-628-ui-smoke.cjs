'use strict';
// Actual installed controls, compositor frames and native page identities in
// the isolated CI profile. Content growth and borderless paint replace the
// former fixed-height, inner-scroll and one-pixel outline contracts.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {screen,clipboard,ClipboardItem,nativeImage}=require('electron');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {armFrameCapture}=require('./mouse-smoke-frames.cjs');
const {closingReversalPair,observeNoraReversal,runNoraReversalTrials}=require('./mouse-smoke-reversal.cjs');
const {createMotionTrace,MARKER_PREFIX,bounded}=require('./mouse-smoke-trace.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<400;i++){if(await fn())return;await sleep(25);}throw Error('Mouse628 motion timeout: '+label);}
const layoutKeys=['desktopId','mode','agentOpen','tree','slots','active','tabOrder','aiId','aiSessions','aiOpen','aiWidth'];
// Find the opaque moving fill in the presented bitmap. There is deliberately
// no outline-colour oracle: the old one-pixel stroke is forbidden in628.
function paintedPanel(pixels,size,geometry){
 const sx=size.width/geometry.viewport.width,sy=size.height/geometry.viewport.height,top=geometry.baseline-geometry.height,columns=[.2,.5,.8].map(f=>Math.floor((geometry.left+geometry.width*f)*sx));
 const rgb=(x,y)=>{const i=(y*size.width+x)*4;return[pixels[i+2],pixels[i+1],pixels[i],pixels[i+3]];},solid=p=>p[3]===255&&geometry.fill.every((v,i)=>Math.abs(p[i]-v)<=2),step=Math.max(2,Math.round(2*sy));
 for(let y=Math.max(step,Math.floor(top*sy));y<Math.min(size.height-step*3-1,Math.floor((geometry.baseline-8)*sy));y++){
  const probes=columns.map(x=>({x,y,above:rgb(x,y-step),edge:rgb(x,y),inside:rgb(x,y+step),lower:rgb(x,y+step*3)}));
  if(probes.every(p=>!solid(p.above)&&solid(p.inside)&&solid(p.lower))){const paintedTop=y/sy,translateY=paintedTop-top;return{top:paintedTop,translateY,progress:1-translateY/geometry.height,fill:geometry.fill,strokeFree:true,probes};}
 }
 return null;
}
const GESTURE_KEY=require('./mouse-gesture.cjs').KEY;
// Map an actual display framebuffer to the BrowserWindow's content area.
// Preserve integer source pixels; fractional backing scales are represented
// by the sample origin instead of resizing or rounding away their phase.
function screenCropGeometry(displayBounds,contentBounds,screenPixelSize){
 const scaleX=screenPixelSize.width/displayBounds.width,scaleY=screenPixelSize.height/displayBounds.height;
 const left=(contentBounds.x-displayBounds.x)*scaleX,top=(contentBounds.y-displayBounds.y)*scaleY,right=left+contentBounds.width*scaleX,bottom=top+contentBounds.height*scaleY;
 const cropPixels={x:Math.floor(left),y:Math.floor(top),width:Math.ceil(right)-Math.floor(left),height:Math.ceil(bottom)-Math.floor(top)};
 assert.ok([scaleX,scaleY,left,top,right,bottom].every(Number.isFinite)&&scaleX>0&&scaleY>0,'A real display scale is required');
 assert.ok(cropPixels.x>=0&&cropPixels.y>=0&&cropPixels.width>0&&cropPixels.height>0&&cropPixels.x+cropPixels.width<=screenPixelSize.width&&cropPixels.y+cropPixels.height<=screenPixelSize.height,'The complete native window content is inside the captured display');
 return{cropPixels,mapping:{scaleX,scaleY,originX:left-cropPixels.x,originY:top-cropPixels.y}};
}
function cornerBackground(css){
 const value=String(css).trim(),hex=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(value),functional=/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i.exec(value);
 let rgb;if(hex){const digits=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];rgb=[0,2,4].map(offset=>parseInt(digits.slice(offset,offset+2),16));}else if(functional&&(!functional[4]||Number(functional[4])===1))rgb=functional.slice(1,4).map(Number);
 assert.ok(rgb&&rgb.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'The computed --bg must resolve to an opaque RGB theme colour: '+value);return{css:value,rgb};
}
function nativeCornerPaintReady(rows,marker,background){
 const matches=(pixel,rgb)=>pixel?.rgba?.[3]===255&&rgb.every((v,i)=>Math.abs(pixel.rgba[i]-v)<=2);
 return rows.length>0&&rows.every(row=>matches(row.before?.inside,marker)&&matches(row.before?.outside,background));
}
async function verifyGestureRestart({app,win,store}){
 const filename='mouse-628-swipe-tutorial.json',facts=JSON.parse(await fs.readFile(filename,'utf8'));
 assert.equal(facts.version,'6.0.28');assert.equal(facts.successHidden,true);assert.equal(facts.privateIsolated,true);
 assert.equal(facts.syntheticNativeEvent,true);assert.equal(facts.physicalTrackpadVerified,false);
 const persisted=(await store.get(GESTURE_KEY))[GESTURE_KEY];assert.deepEqual(persisted,{completed:true});
 const js=source=>win.webContents.executeJavaScript(source),before=await js('({timeOrigin:performance.timeOrigin,open:document.querySelector("#desktop-tray").open})');
 assert.notEqual(process.pid,facts.writePid,'Restart is a different native application process');assert.notEqual(performance.timeOrigin,facts.writeMainTimeOrigin,'Restart has a new main-process time origin');assert.notEqual(before.timeOrigin,facts.writeRendererTimeOrigin,'Restart has a new renderer, not a repeated state query');
 try{
  await js('MouseTest.desktopUI.gesture.ready');await js('MouseTest.desktopUI.open()');
  await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'restarted Nora opens');
  const observed=await js('({gesture:MouseTest.desktopUI.gesture.diagnostics(),hintHidden:document.querySelector(".desktop-gesture-hint").hidden,noraOpen:document.querySelector("#desktop-tray").open,timeOrigin:performance.timeOrigin})');
  assert.equal(observed.gesture.learned,true);assert.equal(observed.hintHidden,true);assert.equal(observed.noraOpen,true);
  facts.restart={pid:process.pid,mainTimeOrigin:performance.timeOrigin,version:app.getVersion(),persisted,...observed};facts.restartHidden=true;
  await fs.writeFile('mouse-628-swipe-restart.png',(await win.capturePage()).toPNG());facts.restart.capture='mouse-628-swipe-restart.png';
 }finally{if(!before.open)await js('MouseTest.desktopUI.close({immediate:true})');}
 facts.restored=await js('!document.querySelector("#desktop-tray").open&&!document.querySelector(".mouse-floating-snapshot")');assert.equal(facts.restored,true);
 await fs.writeFile(filename,JSON.stringify(facts,null,2)+'\n');console.log('MOUSE_628_THREE_FINGER_TUTORIAL_NATIVE_PASS');
}
function rendererTraceState(marker){
 const before=performance.now(),documentTimeBefore=document.timeline.currentTime;
 performance.mark(marker);const mark=performance.getEntriesByName(marker,'mark').at(-1);performance.clearMarks(marker);
 return{marker,markStartTime:mark?.startTime,before,after:performance.now(),documentTimeBefore,documentTimeAfter:document.timeline.currentTime,visibilityState:document.visibilityState,hidden:document.hidden,hasFocus:document.hasFocus()};
}
module.exports=async({app,win,browser,store,privateMode,globalCapture})=>{
 assert.equal(process.env.CI,'true','The visual fixture must never run in a personal profile');
 assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 if(process.argv.includes('--mouse-smoke-read'))return verifyGestureRestart({app,win,store});
 const js=source=>win.webContents.executeJavaScript(source),native=require('./mouse-native-menu.node'),debug=win.webContents.debugger;
 const bounds=win.getBounds(),originalFullscreen=win.isFullScreen(),original=await js('MouseTest.prefs()'),layout=()=>js(`Object.fromEntries(${JSON.stringify(layoutKeys)}.map(k=>[k,MouseTest.prefs()[k]]))`),beforeLayout=await layout();
 const allPages=()=>[...browser.tabs.values(),...browser.providers.values()];
 const pages=new Map(allPages().map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL(),epoch:page.navigationEpoch}]));
 const savedClipboard=await Promise.all((await clipboard.read()).map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
 const facts={version:'6.0.26',palette:{},stateRestored:false,supersededForNora:{version:'6.0.28',proof:'mouse-628-motion.json',reason:'Content-fit borderless Nora replaces the former fixed-size scrolling and outline contracts'}};
 const borderlessFacts={version:'6.0.28',themes:['light','dark'],viewports:[],rows:[],tinyBurrow:[],footerSeamAbsent:false,decorativeOutlinesAbsent:false,roundedBackgroundCorners:false,restored:false};
 const motionFacts={version:'6.0.28',themes:['light','dark'],contentFit:false,noInnerScroll:false,translationOnly:false,strokeFreeContour:false,openClosePainted:false,interruptionPreserved:false,reducedMotion:false,backgroundStable:false,footerStable:false,stateRestored:false,frames:{},geometry:{},captures:{},captureStates:{},footer:{},background:{before:[],after:[],nativeBoundsCalls:0,resizeEvents:0,snapshots:[]}};
 let attached=false,lastClick=null,lastInput=null,verificationError,cleanupError,backgroundProbe=false,paintCapture=null,motionTrace=null,traceSaved=false;
 const boundsHooks=[],captureDiagnostics=[];
 const nativeTraceState=()=>({at:performance.now(),wallTime:Date.now(),pid:process.pid,rendererPid:win.webContents.getOSProcessId(),visible:win.isVisible(),focused:win.isFocused(),minimized:win.isMinimized(),webContentsFocused:win.webContents.isFocused()});
 const rendererTrace=label=>motionTrace?.active?`(${rendererTraceState.toString()})(${JSON.stringify(MARKER_PREFIX+label)})`:'null';
 const tracePoint=(label,renderer)=>{if(motionTrace?.active)motionTrace.checkpoint(label,{native:nativeTraceState(),renderer});};
 async function stopMotionTrace(reason){
  if(!motionTrace||traceSaved)return;
  try{const result=await motionTrace.stop(reason),meta=result.mouseMotionTrace;traceSaved=true;motionFacts.trace={file:'mouse-628-motion-trace.json',complete:meta.complete,reason:meta.reason,eventCount:meta.eventCount,bytes:meta.bytes,dataLossOccurred:meta.dataLossOccurred,errors:meta.errors};console.log('MOUSE_628_MOTION_TRACE',JSON.stringify(motionFacts.trace));}
  catch(error){traceSaved=true;console.error('MOUSE_628_MOTION_TRACE_DIAGNOSTIC_ERROR',error.message);}
 }
 const phase=()=>js('document.querySelector("#desktop-tray").dataset.motion');
 const settled=()=>until(()=>js('(()=>{const t=document.querySelector("#desktop-tray");return t.hidden||t.dataset.motion==="open";})()'),'Nora reaches its current target');
 const closed=()=>until(()=>js('document.querySelector("#desktop-tray").hidden&&!document.querySelector("#desktop-tray").open&&!document.querySelector(".mouse-floating-snapshot")'),'Nora closes and restores native pages');
 async function activate(){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await until(()=>win.isFocused(),'native window focus');}
 async function painted(){await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(60);}
 async function click(selector,wait=true,afterInput){
  if(wait)await settled();await activate();
  const traceLabel=selector==='#desktops-button'?'click-open':selector==='#desks-close'?'click-close':'click-control';
  const point=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return{...(${nativeHitTarget.toString()})(e),trace:${rendererTrace(traceLabel)}};})()`);tracePoint(traceLabel,point.trace);
  lastClick={selector,point};assert.equal(point.ready,true,'Mouse628 native target: '+JSON.stringify(lastClick));
  const origin=win.getContentBounds(),target={x:Math.round(origin.x+point.x),y:Math.round(origin.y+point.y)},area=screen.getDisplayNearestPoint(target).bounds;
  assert.ok(target.x>=area.x&&target.y>=area.y&&target.x<area.x+area.width&&target.y<area.y+area.height,'Native click stays on the display');
  lastClick.nativeAt=performance.now();assert.equal(native.testClick(target.x,target.y),true);if(afterInput)await afterInput();await sleep(90);
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
   globalThis.__mouse628Recorder?.stop();const frames=[],sizes=[],mutations=[],longTasks=[],tray=document.querySelector('#desktop-tray'),panel=tray.querySelector('.desk-burrow-panel'),outline=document.querySelector('#mouse-dock-outline'),fill=document.querySelector('#mouse-dock-fill'),surface=document.querySelector('#mouse-dock-surface'),content=tray.querySelector('.desk-content'),button=tray.querySelector('#desks-close');let raf=0,stopped=false,geometry=null,tasks=null;
   if(globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask')){tasks=new PerformanceObserver(list=>{for(const entry of list.getEntries()){longTasks.push({startTime:entry.startTime,duration:entry.duration,name:entry.name});if(longTasks.length>128)longTasks.shift();}});tasks.observe({type:'longtask'});}
   const resize=new ResizeObserver(entries=>{for(const entry of entries)sizes.push({time:performance.now(),target:entry.target===tray?'tray':entry.target===panel?'panel':entry.target===content?'content':'button',width:entry.contentRect.width,height:entry.contentRect.height,phase:tray.dataset.motion});});for(const e of [tray,panel,content,button])resize.observe(e);
   const mutation=new MutationObserver(records=>{for(const record of records){if(!geometry)continue;const target=record.target;mutations.push({time:performance.now(),phase:tray.dataset.motion,target:target.id||target.className,attribute:record.attributeName,value:target.getAttribute(record.attributeName)});}});for(const e of [outline,fill,surface])mutation.observe(e,{attributes:true,attributeFilter:['d','viewBox']});mutation.observe(tray,{attributes:true,attributeFilter:['style']});
   const sample=()=>{
    const value=MouseTest.desktopUI.motion.sample();if(!value)return null;
    if(!geometry){const size=e=>({width:e.offsetWidth,height:e.offsetHeight});geometry={tray:size(tray),panel:size(panel),content:size(content),button:size(button),font:getComputedStyle(button).fontSize,footer:(()=>{const r=document.querySelector('#statusbar').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()};}
    const transform=new DOMMatrix(getComputedStyle(panel).transform),style=getComputedStyle(content),buttonStyle=getComputedStyle(button);
    return{time:performance.now(),documentTime:document.timeline.currentTime,phase:tray.dataset.motion,progress:value.progress,open:tray.open,hidden:tray.hidden,height:value.height,targetHeight:value.targetHeight,width:value.width,left:value.left,baseline:value.baseline,inert:content.inert,opacity:Number(style.opacity),font:buttonStyle.fontSize,controlBackdrop:buttonStyle.getPropertyValue('backdrop-filter'),controlWebkitBackdrop:buttonStyle.getPropertyValue('-webkit-backdrop-filter'),measurements:value.measurements,geometryWrites:value.geometryWrites,paths:{outline:outline.getAttribute('d'),fill:fill.getAttribute('d'),viewBox:surface.getAttribute('viewBox')},matrix:{a:transform.a,b:transform.b,c:transform.c,d:transform.d,e:transform.e,f:transform.f}};
   };
   const recorder={frames,sizes,mutations,longTasks,sample,onFrame:null,stop(){if(!stopped){const frame=sample();if(frame)frames.push(frame);}stopped=true;cancelAnimationFrame(raf);resize.disconnect();mutation.disconnect();tasks?.disconnect();recorder.onFrame=null;return{frames,geometry,sizes,mutations,longTasks,timeOrigin:performance.timeOrigin,startup:MouseTest.desktopUI.motion.diagnostics?.()};}};
   const tick=()=>{const frame=sample();if(frame){frames.push(frame);recorder.onFrame?.(frame);}if(!stopped&&frames.length<1000)raf=requestAnimationFrame(tick);};globalThis.__mouse628Recorder=recorder;tick();
  })()`);
 }
 async function armInterruptedReopen(){
  await js(`(()=>{
   globalThis.__mouse628Reversal?.dispose();const tray=document.querySelector('#desktop-tray');
   globalThis.__mouse628Reversal=(${observeNoraReversal.toString()})({recorder:globalThis.__mouse628Recorder,tray,panel:tray.querySelector('.desk-burrow-panel'),eventTarget:window,reopen:()=>MouseTest.desktopUI.open(),qualifiesClosing:${closingReversalPair.toString()}});return true;
  })()`);
 }
 async function retainFrames(name){
  const record=await js('globalThis.__mouse628Recorder.stop()');motionFacts.frames[name]=record.frames;motionFacts.geometry[name]={sizes:record.sizes,initial:record.geometry,mutations:record.mutations,longTasks:record.longTasks,timeOrigin:record.timeOrigin,startup:record.startup};
  await fs.writeFile('mouse-628-motion-diagnostics.json',JSON.stringify({version:motionFacts.version,frames:motionFacts.frames,geometry:motionFacts.geometry},null,2)+'\n');return record;
 }
 function stableMotionGeometry(record,label){
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
  assert.ok(record.geometry.panel.height>100&&Math.abs(record.geometry.panel.height-first.height)<=1,label+' samples a full content-sized panel');
 }
 function continuous(record,direction,label){
  stableMotionGeometry(record,label);const moving=record.frames.filter(f=>f.phase===direction&&f.progress>0&&f.progress<1);
  assert.ok(moving.length>=3,label+' paints at least three intermediate frames');
  assert.ok(Math.max(...moving.map(f=>f.matrix.f))-Math.min(...moving.map(f=>f.matrix.f))>=2,label+' paints distinct translations');
  for(let i=1;i<moving.length;i++){const delta=moving[i].matrix.f-moving[i-1].matrix.f;assert.ok(direction==='opening'?delta<=.75:delta>=-.75,label+' moves monotonically without geometry jumps: '+JSON.stringify({before:moving[i-1],after:moving[i]}));}
  assert.ok(moving.every(f=>f.open&&!f.hidden&&f.inert),'The native view gate and inert content stay active throughout '+direction);
 }
 async function armPanelCapture(theme,state){
  const traceLabel='arm-'+theme+'-'+state;
  const geometry=await js(`(()=>{const t=document.querySelector('#desktop-tray'),footer=document.querySelector('#statusbar').getBoundingClientRect(),toolbar=document.querySelector('.toolbar').getBoundingClientRect(),current=MouseTest.desktopUI.motion.sample(),rgb=value=>value.match(/[\\d.]+/g).slice(0,3).map(Number),width=current?.width||Math.min(1000,innerWidth-12),height=current?.height||Math.max(1,Math.min(440,footer.top-toolbar.bottom-12));return{ready:!!current,viewport:{width:innerWidth,height:innerHeight},width,height,left:(innerWidth-width)/2,baseline:footer.top,fill:rgb(getComputedStyle(document.querySelector('#mouse-dock-fill')).fill),stroke:getComputedStyle(document.querySelector('#mouse-dock-outline')).stroke,before:globalThis.__mouse628Recorder?.sample(),trace:${rendererTrace(traceLabel)}};})()`);tracePoint(traceLabel,geometry.trace);
  const diagnostic={theme,state,geometry,timeOrigin:performance.timeOrigin,armedAt:performance.now(),ready:null,frames:[],retainedBytes:0,droppedFrames:0},retained=[];captureDiagnostics.push(diagnostic);
  let last=null;const capture=armFrameCapture(win.webContents,{select(image,frame){
   const receivedAt=performance.now();
   const pixels=image.toBitmap({scaleFactor:frame.scaleFactor});assert.equal(pixels.length,frame.pixelSize.width*frame.pixelSize.height*4,'Presentation bitmap matches its native dimensions');
   last=geometry.ready?paintedPanel(pixels,frame.pixelSize,geometry):null;
   const selected=!!last&&last.translateY>=Math.max(16,geometry.height*.08)&&last.translateY<=geometry.height*.9,row={...frame,receivedAt,selectionMs:performance.now()-receivedAt,boundary:last,selected};diagnostic.frames.push(row);
   // Keep a small, bounded raw sample for a failed capture. PNG encoding and
   // disk writes happen only after the subscription has ended, never in motion.
   if(retained.length<12&&diagnostic.retainedBytes+pixels.length<=32*1024*1024){retained.push({row,pixels});diagnostic.retainedBytes+=pixels.length;}else diagnostic.droppedFrames++;
   // Detect the top edge first, then reject endpoints. A scrim or a fully open
   // panel must never pass as motion simply because a DOM sample was moving.
   if(!selected)return null;
   return{theme,state,geometry,...last};
  }});paintCapture=capture;capture.result.catch(()=>{});
  const armed={capture,geometry,async measure(){await until(async()=>{const sample=await js('MouseTest.desktopUI.motion.sample()');if(!sample)return false;Object.assign(geometry,{height:sample.height,width:sample.width,left:sample.left,baseline:sample.baseline,measuredAtOpening:sample,ready:true});return true;},'content-sized opening geometry is measured');},last:()=>last,clear:()=>{retained.length=0;},async failure(){
   diagnostic.lastClick=lastClick;diagnostic.failedAt=performance.now();
   for(const {row,pixels}of retained){const filename='mouse-628-panel-'+theme+'-'+state+'-rejected-'+String(row.sequence).padStart(3,'0')+'.png';try{const image=nativeImage.createFromBitmap(pixels,{...row.pixelSize,scaleFactor:1}),png=image.toPNG();assert.deepEqual({width:png.readUInt32BE(16),height:png.readUInt32BE(20)},row.pixelSize);await fs.writeFile(filename,png);row.filename=filename;}catch(error){row.writeError=error.message;}}
  }};
  try{diagnostic.ready=await capture.ready;return armed;}catch(error){await armed.failure();armed.clear();throw error;}
 }
 async function capturePanel(theme,state,armed){
  if(armed){
   try{const result=await armed.capture.result,{png,...painted}=result,filename='mouse-628-panel-'+theme+'-'+state+'.png';assert.deepEqual({width:png.readUInt32BE(16),height:png.readUInt32BE(20)},result.pixelSize,'Saved PNG is the selected presentation bitmap');await fs.writeFile(filename,png);const traceLabel='capture-'+theme+'-'+state,captured=await js(`({sample:globalThis.__mouse628Recorder?.sample(),trace:${rendererTrace(traceLabel)}})`);tracePoint(traceLabel,captured.trace);(motionFacts.captures[theme]??={})[state]=filename;(motionFacts.captureStates[theme]??={})[state]={before:armed.geometry.before,after:captured.sample,painted};}
   catch(error){await armed.failure();throw Error(error.message+'; last painted boundary: '+JSON.stringify(armed.last()));}
   finally{armed.capture.cancel();armed.clear();if(paintCapture===armed.capture)paintCapture=null;}return;
  }
  const before=await js('globalThis.__mouse628Recorder?.sample()');
  if(state!=='open')assert.ok(before&&before.phase===(state==='opening'?'opening':'closing')&&before.progress>0&&before.progress<1,'Capture begins during a natural '+state+' frame');
  const filename='mouse-628-panel-'+theme+'-'+state+'.png',image=await win.capturePage();await fs.writeFile(filename,image.toPNG());
  (motionFacts.captures[theme]??={})[state]=filename;(motionFacts.captureStates[theme]??={})[state]={before,after:await js('globalThis.__mouse628Recorder?.sample()')};
 }
 async function footer(captured){
  const data=await js(`(()=>{const bar=document.querySelector('#statusbar'),r=bar.getBoundingClientRect(),style=getComputedStyle(bar),columns=[];for(let x=r.left+8;x<r.right-8;x+=4){if(Math.abs(x-innerWidth/2)<24)continue;const covered=[...bar.querySelectorAll('button,select,input')].some(e=>{const b=e.getBoundingClientRect();return x>=b.left&&x<=b.right&&b.top<=r.top+3;});if(!covered){columns.push(x);x+=20;}}return{x:r.x,y:r.y,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight},borderWidth:style.borderTopWidth,borderColor:style.borderTopColor,borderImage:style.borderImageSource,boxShadow:style.boxShadow,background:style.backgroundColor,columns:columns.slice(0,24)};})()`),image=captured||await win.capturePage(),size=image.getSize(),pixels=image.toBitmap(),sx=size.width/data.viewport.width,sy=size.height/data.viewport.height;
  assert.equal(parseFloat(data.borderWidth),0,'Footer has no top border');assert.equal(data.borderImage,'none');assert.equal(data.boxShadow,'none');assert.ok(data.columns.length>=4,'There are exposed native footer pixels to verify');
  const expected=data.background.match(/[\d.]+/g).slice(0,3).map(Number);
  data.pixels=data.columns.map(x=>({x,samples:[.5,1.5,2.5].map(offset=>{const pixelX=Math.floor(x*sx),pixelY=Math.floor((data.y+offset)*sy),i=(pixelY*size.width+pixelX)*4,rgba=[pixels[i+2],pixels[i+1],pixels[i],pixels[i+3]];assert.ok(expected.every((v,c)=>Math.abs(rgba[c]-v)<=2)&&rgba[3]===255,'Footer edge is exactly its background, without a one-pixel seam: '+JSON.stringify({x,offset,expected,rgba}));return{offset,pixelX,pixelY,rgba};})}));return data;
 }
 async function captureTinyBurrow(theme){
  const measured=await js(`(()=>{const button=document.querySelector('#desktops-button'),entry=button.querySelector('.burrow-entry'),bar=document.querySelector('#statusbar'),r=button.getBoundingClientRect(),footer=bar.getBoundingClientRect(),bounds=r=>({x:r.x,y:r.y,width:r.width,height:r.height}),paint=(element,pseudo)=>{const c=getComputedStyle(element,pseudo);return{display:c.display,content:c.content,borderWidths:['Top','Right','Bottom','Left'].map(side=>parseFloat(c['border'+side+'Width'])),boxShadow:c.boxShadow,backgroundImage:c.backgroundImage};};const x=Math.max(0,Math.floor(r.left-6)),right=Math.min(innerWidth,Math.ceil(r.right+6)),y=Math.max(0,Math.floor(footer.top-3)),bottom=Math.min(innerHeight,Math.ceil(footer.bottom));return{viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},button:{bounds:bounds(r),...paint(button)},pseudo:paint(button,'::before'),entry:{bounds:bounds(entry.getBoundingClientRect()),...paint(entry)},footer:bounds(footer),crop:{x,y,width:right-x,height:bottom-y}};})()`);
  assert.equal(measured.pseudo.display,'none','The small Nora rim pseudo-element is not displayed');assert.equal(measured.pseudo.content,'none','The small Nora rim has no generated content');
  for(const name of ['button','pseudo','entry']){assert.deepEqual(measured[name].borderWidths,[0,0,0,0],'The small Nora '+name+' has no four-sided frame');assert.equal(measured[name].boxShadow,'none','The small Nora '+name+' has no shadow outline');}
  assert.ok(measured.crop.width>measured.button.bounds.width&&measured.crop.height>=measured.footer.height,'The crop includes Nora sides and the footer junction');
  const image=await win.capturePage(measured.crop);assert.equal(image.isEmpty(),false);const scales=image.getScaleFactors().filter(scale=>Number.isFinite(scale)&&scale>0),scaleFactor=Math.max(...scales);assert.ok(Number.isFinite(scaleFactor)&&scaleFactor>0);
  const png=image.toPNG({scaleFactor}),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.ok(Math.abs(pixelSize.width-measured.crop.width*scaleFactor)<=1&&Math.abs(pixelSize.height-measured.crop.height*scaleFactor)<=1,'The cropped PNG preserves the native representation scale');
  const capture='mouse-628-footer-burrow-'+theme+'.png';await fs.writeFile(capture,png);borderlessFacts.tinyBurrow.push({theme,source:'BrowserWindow.capturePage(rect)',...measured,capture,pixelSize,scaleFactor});
 }
 async function contentControls(theme,viewport){
  const states=[];
  async function state(name,selector){
   // A grid expansion may have its own brief transition. Wait for the measured
   // content to settle naturally; never scroll or modify animation playback.
   await painted();await sleep(260);
   const measured=await js(`(()=>{const tray=document.querySelector('#desktop-tray'),content=tray.querySelector('.desk-content'),panel=tray.querySelector('.desk-burrow-panel'),sample=MouseTest.desktopUI.motion.sample(),r=content.getBoundingClientRect(),e=document.querySelector(${JSON.stringify(selector)}),hit=(${nativeHitTarget.toString()})(e),style=getComputedStyle(content),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight};};const scrollers=[content,...content.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return b.width&&b.height&&s.visibility!=='hidden'&&e.scrollHeight>e.clientHeight+1&&['auto','scroll'].includes(s.overflowY);}).map(e=>({id:e.id,className:e.className,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflowY:getComputedStyle(e).overflowY}));const frames=[...document.querySelectorAll('#statusbar,.toolbar,.pane,.pane-head,#desktop-tray,.desktop-card,.desk-preview,.desk-cell,.desk-mode,.desk-history-panel,.desk-history-entry,.desk-tab-chip,.desk-preview-large,#desktop-tray .desk-content>header')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.closest('[hidden]');}).map(e=>{const c=getComputedStyle(e);return{tag:e.tagName,id:e.id,className:typeof e.className==='string'?e.className:'svg',width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,borders:['Top','Right','Bottom','Left'].map(side=>({width:parseFloat(c['border'+side+'Width']),style:c['border'+side+'Style']})),boxShadow:c.boxShadow};});return{name:${JSON.stringify(name)},sample,content:rect(content),panel:rect(panel),tray:rect(tray),scrollTop:content.scrollTop,scrollHeight:content.scrollHeight,clientHeight:content.clientHeight,overflowY:style.overflowY,overflowX:style.overflowX,scrollers,control:{selector:${JSON.stringify(selector)},...hit},outline:{stroke:getComputedStyle(document.querySelector('#mouse-dock-outline')).stroke,fill:getComputedStyle(document.querySelector('#mouse-dock-fill')).fill},decorations:frames};})()`);
   assert.ok(measured.sample.fits,'The complete '+name+' content fits its available height: '+JSON.stringify(measured.sample));
   assert.ok(Math.abs(measured.sample.height-measured.sample.contentHeight)<=1,'Nora follows '+name+' content height');assert.ok(Math.abs(measured.tray.height-measured.content.height)<=1,'Nora leaves no fixed empty area below '+name);
   assert.equal(measured.scrollTop,0);assert.equal(measured.tray.scrollTop,0,'The hidden Nora viewport never scrolls programmatically');assert.equal(measured.panel.scrollTop,0,'The translated panel never scrolls programmatically');assert.ok(measured.scrollHeight<=measured.clientHeight+1);assert.ok(!['auto','scroll'].includes(measured.overflowY));assert.deepEqual(measured.scrollers,[],'No vertical inner scrollbar in '+name);assert.equal(measured.control.ready,true,'Control remains visible without programmatic scrolling');
   assert.equal(measured.outline.stroke,'none');assert.ok(measured.decorations.length>=10);for(const frame of measured.decorations){assert.ok(frame.borders.every(border=>border.width===0||border.style==='none'),name+' has no decorative frame: '+JSON.stringify(frame));assert.equal(frame.boxShadow,'none',name+' has no shadow outline: '+JSON.stringify(frame));}
   const capture='mouse-628-'+viewport+'-'+theme+'-'+name+'.png',image=await win.capturePage();await fs.writeFile(capture,image.toPNG());const row={theme,viewport,mode:name,measurements:measured,capture,footer:await footer(image)};borderlessFacts.rows.push(row);states.push(row);return measured;
  }
  const compact=await state('compact','#desks-close');
  await click('#desk-modes-button');const modes=await state('modes','#desk-modes .desk-mode:last-child');assert.ok(modes.sample.height>compact.sample.height+10,'Modes grow Nora upward');
  await click('#desk-history-button');assert.equal(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")'),'false');const history=await state('history','#desk-history-panel .desk-history-heading button');assert.ok(history.sample.height>compact.sample.height+10,'History grows Nora upward');
  await click('#desk-history-button');await click('.desktop-card[aria-current="true"] .desk-preview-button');const preview=await state('preview','.desk-preview-close');assert.ok(preview.sample.height>compact.sample.height+10,'Preview grows Nora upward');
  await click('.desktop-gesture-copy summary');await state('preview-help','.desktop-gesture-copy summary');assert.equal(await js('document.querySelector(".desktop-gesture-hint details").open'),true);await click('.desktop-gesture-copy summary');
  await click('.desk-preview-close');const after=await state('collapsed','#desks-close');assert.ok(Math.abs(after.sample.height-compact.sample.height)<=1,'Nora shrinks to compact content again');
  motionFacts.geometry[viewport+'-'+theme+'Controls']=states;return states;
 }
 const cornerColor=[171,43,158],cornerMarker='mouse628-corner-proof';let cornerPages=[];
 async function installCornerMarkers(){
  for(const page of allPages().filter(page=>page.visible)){await page.view.webContents.executeJavaScript(`(()=>{const e=document.createElement('div');e.id=${JSON.stringify(cornerMarker)};e.setAttribute('aria-hidden','true');e.style.cssText='position:fixed;inset:auto 0 0;height:28px;z-index:2147483647;pointer-events:none;background:rgb(${cornerColor.join(',')});';document.body.append(e);})()`);cornerPages.push(page);}
  await painted();
 }
 async function removeCornerMarkers(){for(const page of cornerPages.splice(0))if(!page.view.webContents.isDestroyed())await page.view.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(cornerMarker)})?.remove()`).catch(()=>{});}
 function pixel(image,point,viewport,mapping){const size=image.getSize(1),bytes=image.toBitmap({scaleFactor:1}),x=Math.max(0,Math.min(size.width-1,Math.floor(mapping?mapping.originX+point.x*mapping.scaleX:point.x*size.width/viewport.width))),y=Math.max(0,Math.min(size.height-1,Math.floor(mapping?mapping.originY+point.y*mapping.scaleY:point.y*size.height/viewport.height))),i=(y*size.width+x)*4;assert.equal(bytes.length,size.width*size.height*4,'Pixel samples use the exact archived native representation');return{x,y,rgba:[bytes[i+2],bytes[i+1],bytes[i],bytes[i+3]]};}
 const cornerDiagnostics=[];
 async function captureNativeWindow(theme,stage,viewport){
  assert.equal(globalCapture?.permission(),'granted','Native corner proof requires the existing CI screen-capture grant');
  const display=screen.getDisplayMatching(win.getBounds()),contentBounds=win.getContentBounds();assert.deepEqual({width:contentBounds.width,height:contentBounds.height},viewport,'Native content bounds match the measured renderer viewport');
  const frame=await globalCapture.acquire(display);assert.equal(frame?.kind,'screen');assert.ok(typeof frame.backend==='string'&&frame.backend);assert.deepEqual({width:frame.width,height:frame.height},{width:display.bounds.width,height:display.bounds.height},'The screen frame belongs to the selected complete display');assert.deepEqual(win.getContentBounds(),contentBounds,'The native window did not move while its frame was acquired');
  assert.match(frame.base,/^data:image\/png;base64,/);const screenPNG=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64'),screenPixelSize={width:screenPNG.readUInt32BE(16),height:screenPNG.readUInt32BE(20)},screenImage=nativeImage.createFromBuffer(screenPNG);assert.equal(screenImage.isEmpty(),false);assert.deepEqual(screenImage.getSize(1),screenPixelSize,'Display PNG is decoded without scaling');
  const {cropPixels,mapping}=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),image=screenImage.crop(cropPixels),png=image.toPNG({scaleFactor:1}),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};assert.deepEqual(pixelSize,{width:cropPixels.width,height:cropPixels.height},'The native window crop preserves source pixels');
  const name='mouse-628-corners-'+theme+'-'+stage,capture=name+'.png',screenCapture=name+'-display.png',metadata={source:'globalCapture.acquire(display)',kind:frame.kind,backend:frame.backend,display:{id:display.id,bounds:{...display.bounds},scaleFactor:display.scaleFactor},contentBounds:{...contentBounds},screenPixelSize,screenCapture,capture,cropPixels,pixelSize,mapping};
  // Archive the actual source plane and lossless crop before a pixel assertion.
  // A failure must retain the image which failed, not a later cleanup frame.
  await fs.writeFile(screenCapture,screenPNG);await fs.writeFile(capture,png);return{image,metadata};
 }
 async function cornerBaseline(theme){
  const geometry=await js(`(()=>{const rows=[];for(const pane of document.querySelectorAll('.pane')){const slot=pane.querySelector('.page-slot'),r=slot.getBoundingClientRect(),radius=parseFloat(pane.style.getPropertyValue('--pane-round-bottom'))||0,id=MouseTest.model.slots[pane.dataset.pane];if(radius<4||!id)continue;for(const side of ['left','right']){const x=side==='left'?r.left+1.25:r.right-1.25,insideX=side==='left'?r.left+radius+3:r.right-radius-3;if(x>innerWidth*.12&&x<innerWidth*.88)continue;rows.push({id,side,radius,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},outside:{x,y:r.bottom-1.25},inside:{x:insideX,y:r.bottom-1.25}});}}return{viewport:{width:innerWidth,height:innerHeight},actualTheme:document.documentElement.dataset.theme,backgroundCSS:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),rows};})()`);
  assert.equal(geometry.actualTheme,theme,'The measured native corners belong to the requested theme');geometry.expectedBackground=cornerBackground(geometry.backgroundCSS);delete geometry.backgroundCSS;
  geometry.rows=geometry.rows.filter(row=>cornerPages.some(page=>page.id===row.id));assert.ok(geometry.rows.length>0,'Real rounded native page corners are present');
  const diagnostic={theme,actualTheme:geometry.actualTheme,expectedBackground:geometry.expectedBackground,stage:'before',viewport:geometry.viewport,attempts:[]};cornerDiagnostics.push(diagnostic);
  for(let attempt=0;attempt<20;attempt++){
   if(attempt)await sleep(100);const captured=await captureNativeWindow(theme,'before',geometry.viewport);geometry.capture=captured.metadata.capture;geometry.nativeCapture=captured.metadata;
   for(const row of geometry.rows)row.before={outside:pixel(captured.image,row.outside,geometry.viewport,captured.metadata.mapping),inside:pixel(captured.image,row.inside,geometry.viewport,captured.metadata.mapping)};
   diagnostic.attempts.push({attempt,nativeCapture:captured.metadata,rows:structuredClone(geometry.rows)});await fs.writeFile('mouse-628-corner-diagnostics.json',JSON.stringify(cornerDiagnostics,null,2)+'\n');
   if(nativeCornerPaintReady(geometry.rows,cornerColor,geometry.expectedBackground.rgb))break;
  }
  for(const row of geometry.rows){assert.ok(row.before.inside.rgba[3]===255&&cornerColor.every((v,i)=>Math.abs(row.before.inside.rgba[i]-v)<=2),'Native interior corner marker is really painted: '+JSON.stringify(row));assert.ok(row.before.outside.rgba[3]===255&&geometry.expectedBackground.rgb.every((v,i)=>Math.abs(row.before.outside.rgba[i]-v)<=2),'The native corner cutout has the current theme background: '+JSON.stringify({theme,expectedBackground:geometry.expectedBackground,row}));assert.ok(cornerColor.some((v,i)=>Math.abs(row.before.outside.rgba[i]-v)>16),'The real native page corner is clipped before Nora opens: '+JSON.stringify(row));}
  return geometry;
 }
 async function verifyOpenCorners(theme,before){
  const visible=await js(`(()=>{const g=${JSON.stringify(before)},surface=document.querySelector('#mouse-dock-surface'),fill=document.querySelector('#mouse-dock-fill'),r=surface.getBoundingClientRect(),point=p=>new DOMPoint(p.x-r.left,p.y-r.top),outside=p=>!fill.isPointInFill(point(p));return{actualTheme:document.documentElement.dataset.theme,backgroundCSS:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),alpha:Number(getComputedStyle(document.querySelector('#mouse-dock-scrim')).opacity),rows:g.rows.filter(row=>outside(row.inside)&&outside(row.outside)).map(row=>{const image=[...document.querySelectorAll('.mouse-floating-snapshot')].find(e=>e.dataset.tabId===row.id),c=getComputedStyle(image);return{...row,roundBottom:Number(image.dataset.roundBottom),borderBottomLeftRadius:c.borderBottomLeftRadius,borderBottomRightRadius:c.borderBottomRightRadius,clipPath:c.clipPath};})};})()`),captured=await captureNativeWindow(theme,'open',before.viewport);assert.ok(visible.rows.length>0,'At least one native lower corner stays exposed beside Nora');
  assert.equal(visible.actualTheme,theme);const expectedBackground=cornerBackground(visible.backgroundCSS);assert.deepEqual(expectedBackground,before.expectedBackground,'The current theme background remains identical while Nora opens');
  for(const key of ['display','contentBounds','screenPixelSize','cropPixels','pixelSize','mapping'])assert.deepEqual(captured.metadata[key],before.nativeCapture[key],'Before and open corners use the same physical source plane: '+key);
  for(const row of visible.rows)row.after={outside:pixel(captured.image,row.outside,before.viewport,captured.metadata.mapping),inside:pixel(captured.image,row.inside,before.viewport,captured.metadata.mapping)};
  cornerDiagnostics.push({theme,actualTheme:visible.actualTheme,expectedBackground,stage:'open',alpha:visible.alpha,nativeCapture:captured.metadata,rows:visible.rows});await fs.writeFile('mouse-628-corner-diagnostics.json',JSON.stringify(cornerDiagnostics,null,2)+'\n');
  for(const row of visible.rows){assert.equal(row.roundBottom,row.radius);assert.equal(parseFloat(row.borderBottomLeftRadius),row.radius);assert.equal(parseFloat(row.borderBottomRightRadius),row.radius);assert.notEqual(row.clipPath,'none');for(const key of ['outside','inside']){const expected=row.before[key].rgba.slice(0,3).map(v=>Math.round(v*(1-visible.alpha)));assert.ok(expected.every((v,i)=>Math.abs(row.after[key].rgba[i]-v)<=4),'The presented rounded corner retains its pixels under the measured scrim: '+JSON.stringify({row:row.side,key,expected,actual:row.after[key]}));}}
  const capture=captured.metadata.capture,proof={theme,actualTheme:visible.actualTheme,expectedBackground,viewport:before.viewport,alpha:visible.alpha,beforeCapture:before.capture,capture,nativeCapture:{before:before.nativeCapture,open:captured.metadata},rows:visible.rows};(borderlessFacts.corners??=[]).push(proof);return proof;
 }
 async function pageSnapshot(page){
  const wc=page.view.webContents,renderer=await wc.executeJavaScript('({timeOrigin:performance.timeOrigin,width:innerWidth,height:innerHeight,scrollX,scrollY,resizeEvents:globalThis.__mouse628PageProbe?.events||[]})');
  return{id:page.id,webContentsId:wc.id,url:wc.getURL(),epoch:page.navigationEpoch||0,bounds:page.view.getBounds(),clip:page.clipView?.getBounds()||null,surfaceBounds:page.bounds||null,visible:!!page.visible,...renderer};
 }
 async function beginBackgroundProbe(){
  await painted();backgroundProbe=true;
  for(const page of allPages()){
   const wc=page.view.webContents;await wc.executeJavaScript('(()=>{const events=[],observe=()=>events.push({time:performance.now(),width:innerWidth,height:innerHeight});window.addEventListener("resize",observe);globalThis.__mouse628PageProbe={events,dispose:()=>window.removeEventListener("resize",observe)};})()');
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
  if(backgroundProbe){backgroundProbe=false;for(const page of allPages())await page.view.webContents.executeJavaScript('globalThis.__mouse628PageProbe?.dispose();delete globalThis.__mouse628PageProbe').catch(()=>{});}
 }
 async function samePages(){
  const current=new Map(allPages().map(p=>[p.id,p]));assert.deepEqual([...current.keys()].sort(),[...pages.keys()].sort(),'Nora and capture preserve all page IDs');
  for(const [id,before]of pages){const page=current.get(id);assert.equal(page,before.page);assert.equal(page.view.webContents,before.wc);assert.equal(page.view.webContents.getURL(),before.url);assert.equal(page.navigationEpoch,before.epoch);}
  assert.deepEqual(await layout(),beforeLayout,'All custom pane geometry and page membership are preserved');
 }
 async function verifyGestureAndSlide(){
  const bank=browser.mouseDesktops.bank,savedBank=bank.snapshot(),savedPreferences=await js('MouseTest.prefs()'),fromIndex=bank.items.findIndex(d=>d.id===bank.active),leftIndex=Math.min(fromIndex,bank.items.length-2),desks=[bank.items[leftIndex].id,bank.items[leftIndex+1].id],colors=[[199,37,77],[29,125,220]],made=[],packets=[];
  const evidence={version:'6.0.28',simultaneous:false,pngSurfaces:false,compositorOnly:false,nativeIdentityPreserved:false,viewportAndScrollPreserved:false,slowAckBounded:false,noraStayedOpen:false,borrowedHold:true,restored:false,transitions:[]};
  const tutorial={version:'6.0.28',source:'BrowserWindow swipe event via isolated CI fixture',syntheticNativeEvent:true,physicalTrackpadVerified:false,recognizer:'macos-three-finger-swipe',firstUseShown:false,nonSwitchRetained:false,successHidden:false,reopenHidden:false,restartHidden:false,privateIsolated:false,restored:false,writePid:process.pid,writeMainTimeOrigin:performance.timeOrigin,writeRendererTimeOrigin:await js('performance.timeOrigin'),records:[]};
  const send=win.webContents.send,command=browser.command,surfaces=browser.mouseDesktops.surfaces,capture=surfaces.capture;let active=null,ackDelay=0,server,frameCapture=null,completed=false;
  const persist=async()=>{await fs.writeFile('mouse-628-desktop-transition.json',JSON.stringify(evidence,null,2)+'\n');await fs.writeFile('mouse-628-swipe-tutorial.json',JSON.stringify(tutorial,null,2)+'\n');};
  const shell=()=>js(`(()=>{const t=document.querySelector('#desktop-tray'),c=t.querySelector('.desk-content'),r=t.getBoundingClientRect();return{desktopId:MouseTest.model.desktopId,nora:{open:t.open,hidden:t.hidden,modal:t.matches(':modal'),phase:t.dataset.motion,inert:c.inert,x:r.x,y:r.y,width:r.width,height:r.height},gesture:MouseTest.desktopUI.gesture.diagnostics(),hintHidden:document.querySelector('.desktop-gesture-hint').hidden};})()`);
  const pins=()=>Promise.all(made.map(async({id})=>{const page=browser.get(id),wc=page.view.webContents,b=page.view.getBounds();return{id,webContentsId:wc.id,url:wc.getURL(),epoch:page.navigationEpoch||0,width:b.width,height:b.height,...await wc.executeJavaScript('({timeOrigin:performance.timeOrigin,scrollX,scrollY,marker:window.marker})')};}));
  const observe=()=>js(`(()=>{const proof=globalThis.__mouse628DesktopProof={frames:[],states:[],allSnapshots:[],running:true};const tick=at=>{if(!proof.running)return;const t=document.querySelector('#desktop-tray'),c=t.querySelector('.desk-content'),r=t.getBoundingClientRect(),nora={open:t.open,hidden:t.hidden,modal:t.matches(':modal'),phase:t.dataset.motion,inert:c.inert,x:r.x,y:r.y,width:r.width,height:r.height};if(proof.states.length<600)proof.states.push({at,...nora});const host=document.querySelector('#mouse-desktop-transition'),shadow=host?.shadowRoot,outgoing=shadow?.querySelector('[data-transition-frame=outgoing]'),incoming=shadow?.querySelector('[data-transition-frame=incoming]');if(host?.dataset.phase==='animating'&&outgoing&&incoming){const x=node=>new DOMMatrixReadOnly(getComputedStyle(node).transform).m41,width=host.getBoundingClientRect().width;if(proof.frames.length<120)proof.frames.push({at,outgoingX:x(outgoing),incomingX:x(incoming),width,nora});if(!proof.allSnapshots.length)proof.allSnapshots=[...shadow.querySelectorAll('img[data-surface]')].map(img=>({id:img.dataset.surface,frame:img.closest('[data-transition-frame]').dataset.transitionFrame,png:img.src.startsWith('data:image/png;base64,'),decoded:img.complete&&img.naturalWidth>0,pixelWidth:img.naturalWidth,pixelHeight:img.naturalHeight,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height}));}proof.raf=requestAnimationFrame(tick);};proof.raf=requestAnimationFrame(tick);})()`);
  const finishObservation=()=>js(`(()=>{const p=globalThis.__mouse628DesktopProof;p.running=false;cancelAnimationFrame(p.raf);return{frames:p.frames,states:p.states,allSnapshots:p.allSnapshots,last:MouseDesktopSlide.last,overlayCount:document.querySelectorAll('#mouse-desktop-transition').length,sliding:MouseTest.model.desktopSliding,visibility:document.querySelector('#workspace').style.visibility};})()`);
  function nativeSwipe(direction){const before=packets.length;assert.ok(win.listenerCount('swipe')>=1);win.emit('swipe',{},direction);return before;}
  async function waitForSwitch(before,target){await until(()=>js(`!MouseTest.model.switching&&!MouseTest.desktopUI.gesture.diagnostics().running&&MouseTest.model.desktopId===${JSON.stringify(target)}&&MouseTest.desktopUI.gesture.diagnostics().lastResult?.id===${JSON.stringify(packets[before]?.packet?.id||'')}`),'native swipe finishes the requested background desktop switch');}
  function bandFrame(image,frame,geometry){
   const bytes=image.toBitmap({scaleFactor:frame.scaleFactor}),{width,height}=frame.pixelSize,sx=width/geometry.width,sy=height/geometry.height,counts=[0,0],expected=colors.map(rgb=>rgb.map(v=>Math.round(v*(1-geometry.scrimAlpha)))),rows=[...new Set(geometry.rows.map(y=>Math.max(0,Math.min(height-1,Math.floor(y*sy)))))];
   assert.equal(bytes.length,width*height*4);for(const y of rows)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(bytes[i+3]!==255)continue;for(let c=0;c<expected.length;c++)if(expected[c].every((v,k)=>Math.abs(bytes[i+2-k]-v)<=3))counts[c]++;}
   const minimum=Math.ceil(16*sx);return counts.every(count=>count>=minimum)?{bothDesktopsPainted:true,sourceColors:colors,colors:expected,scrimAlpha:geometry.scrimAlpha,counts,minimum,rows,viewport:geometry,pixelSize:frame.pixelSize}:null;
  }
  try{
   assert.equal(await js('MouseNative.test'),true);assert.equal(privateMode?.current,null);assert.notEqual((await store.get(GESTURE_KEY))[GESTURE_KEY]?.completed,true,'First-use fixture requires its fresh isolated profile');
   win.webContents.send=function(channel,...args){if(channel==='mouse:desktop-swipe')packets.push({at:performance.now(),origin:'synthetic BrowserWindow.emit swipe invoking the registered native bridge',channel,packet:structuredClone(args[0])});return send.call(this,channel,...args);};
   browser.command=async function(action,args){const result=await command.call(this,action,args);if(action==='layout'&&ackDelay)await sleep(ackDelay);return result;};
   surfaces.capture=async function(args){const result=await capture.call(this,args);if(active){const rows=[];for(const row of result.surfaces||[]){const item=made.find(x=>x.id===row.id);if(!item)continue;const image=nativeImage.createFromDataURL(row.src),bytes=image.toBitmap(),pixelX=Math.min(row.pixelWidth-1,Math.floor(12*row.pixelWidth/row.width)),pixelY=Math.min(row.pixelHeight-1,Math.floor(3*row.pixelHeight/row.height)),offset=(pixelY*row.pixelWidth+pixelX)*4,rgba=[bytes[offset+2],bytes[offset+1],bytes[offset],bytes[offset+3]],expected=colors[item.index];assert.equal(bytes.length,row.pixelWidth*row.pixelHeight*4);assert.ok(expected.every((v,i)=>Math.abs(rgba[i]-v)<=2)&&rgba[3]===255,'Incoming capture contains its independently known fixture pixels');rows.push({id:row.id,pixelWidth:row.pixelWidth,pixelHeight:row.pixelHeight,width:row.width,height:row.height,epoch:row.epoch,webContentsId:row.webContentsId,sample:{pixelX,pixelY,rgba,expected}});}active.captures.push({prepared:!!args.hold,complete:result.complete,holdTokenMatches:result.holdToken===browser.mouseSurfaceHold,ids:(result.surfaces||[]).map(row=>row.id),rows});}return result;};
   server=require('node:http').createServer((req,res)=>{const index=req.url==='/right'?1:0;res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>628 background slide '+index+'</title><style>html,body{margin:0;background:#f0f0f0;color:#111}body{min-height:2400px}#band{position:fixed;inset:0 0 auto;height:8px;z-index:2147483647;background:rgb('+colors[index].join(',')+')}</style><div id="band"></div><p>Retained background desktop '+index+'</p><script>window.marker=Math.random()</script>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   for(const [index,desk]of desks.entries()){await js(`MouseTest.switchDesktop(${JSON.stringify(desk)})`);await js(`MouseTest.openPage(${JSON.stringify('http://127.0.0.1:'+server.address().port+(index?'/right':'/left'))})`);const id=await js('MouseTest.model.slots[MouseTest.model.active]');made.push({id,desk,index});await until(()=>!browser.get(id).loading,'transition fixture page loaded');await js(`MouseTest.changeLayout(1);MouseTest.model.slots={p1:${JSON.stringify(id)}};MouseTest.model.active='p1';MouseTest.model.aiOpen=false;MouseTest.model.agentOpen=false;MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);await painted();await browser.get(id).view.webContents.executeJavaScript('scrollTo(0,137)');}
   await js(`MouseTest.switchDesktop(${JSON.stringify(desks[0])})`);await js("MouseTest.setTheme('light')");await click('#desktops-button');await js('MouseTest.desktopUI.gesture.sync()');
   const first=await shell();assert.equal(first.gesture.hintVisible,true);assert.equal(first.gesture.learned,false);assert.equal(first.nora.open,true);tutorial.firstUseShown=true;tutorial.records.push({kind:'first-use',...first,persisted:(await store.get(GESTURE_KEY))[GESTURE_KEY]??null});await fs.writeFile('mouse-628-swipe-first-use.png',(await win.capturePage()).toPNG());
   // Ordinary UI interaction and illustration playback cannot train the hint.
   const artBefore=await js('getComputedStyle(document.querySelector(".desktop-gesture-hand")).transform');await click('#desk-modes-button');await click('#desk-modes-button');await sleep(220);const artAfter=await js('getComputedStyle(document.querySelector(".desktop-gesture-hand")).transform');assert.notEqual(artBefore,artAfter,'The actual three-finger illustration is animated');assert.equal((await shell()).gesture.hintVisible,true);assert.notEqual((await store.get(GESTURE_KEY))[GESTURE_KEY]?.completed,true);tutorial.records.push({kind:'ordinary-controls-and-animation',artBefore,artAfter,...await shell()});
   await js('MouseTest.model.switching=true');let failedStart;
   try{failedStart=nativeSwipe('left');await until(()=>packets.length>failedStart,'failed input reaches the native bridge');await painted();await sleep(220);}finally{await js('MouseTest.model.switching=false');}
   const failed=await shell();assert.equal(failed.desktopId,desks[0]);assert.equal(failed.gesture.hintVisible,true);assert.equal(failed.gesture.learned,false);assert.notEqual((await store.get(GESTURE_KEY))[GESTURE_KEY]?.completed,true);tutorial.nonSwitchRetained=true;tutorial.records.push({kind:'failed-native-switch',dispatch:packets[failedStart],...failed});
   for(const [theme,direction]of [['light',1],['light',-1],['dark',1],['dark',-1]]){
    await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await painted();const before=await shell(),target=desks[direction>0?1:0];assert.notEqual(before.desktopId,target);assert.equal(before.nora.phase,'open');const pageBefore=await pins(),hold=browser.mouseSurfaceHold;assert.ok(hold);ackDelay=theme==='dark'&&direction===-1?250:0;active={theme,direction,ackDelayMs:ackDelay,captures:[]};const startLayouts=browser.mouseLayoutCalls||0;await observe();
    const geometry={width:win.getContentSize()[0],height:win.getContentSize()[1],rows:made.map(({id})=>browser.get(id).bounds.y+3),scrimAlpha:await js('Number(getComputedStyle(document.querySelector("#mouse-dock-scrim")).opacity)')};frameCapture=armFrameCapture(win.webContents,{select:(image,frame)=>bandFrame(image,frame,geometry)});await frameCapture.ready;const beforePackets=nativeSwipe(direction>0?'left':'right');win.emit('swipe',{},direction>0?'left':'right');
    const frame=await frameCapture.result;frameCapture.cancel();frameCapture=null;const filename='mouse-628-desktop-transition-'+theme+'-'+(direction>0?'forward':'back')+'.png';await fs.writeFile(filename,frame.png);const {png,...paintedFrame}=frame;await waitForSwitch(beforePackets,target);await painted();const recorded=await finishObservation(),after=await shell(),pageAfter=await pins(),nativeLayoutCalls=(browser.mouseLayoutCalls||0)-startLayouts,{frames,states,allSnapshots,last}=recorded;
    assert.equal(packets.length-beforePackets,1,'A duplicate native swipe cannot cause a second switch');assert.equal(after.desktopId,target);assert.equal(after.gesture.lastResult.completed,true);assert.equal(after.gesture.hintVisible,false);assert.equal(after.nora.open,true);assert.equal(after.nora.modal,true);assert.equal(after.nora.hidden,false);assert.equal(after.nora.inert,false);assert.equal(after.nora.phase,'open');assert.equal(browser.mouseSurfaceHold,hold,'The original Nora hold is borrowed and stays owned by Nora');
    assert.equal(last.borrowedHold,true);assert.equal(last.phase,'complete');assert.equal(last.animated,true);assert.equal(last.decoded,true);assert.equal(last.direction,direction);assert.equal(last.layoutCalls,2);assert.ok(nativeLayoutCalls>0&&nativeLayoutCalls<=8);assert.ok(last.animationDurationMs>0&&last.animationDurationMs<=660+ackDelay);assert.ok(last.totalDurationMs>=last.animationDurationMs);assert.ok(frames.length>=3);const width=frames[0].width;
    assert.ok(frames.every(f=>f.width===width&&Math.abs(f.incomingX-f.outgoingX-direction*width)<=1.5));assert.ok(new Set(frames.map(f=>Math.round(f.outgoingX))).size>=3&&new Set(frames.map(f=>Math.round(f.incomingX))).size>=3);assert.ok(states.length>=3&&states.every(f=>f.open&&!f.hidden&&f.modal&&!f.inert&&f.phase==='open'),'Nora stays open and usable throughout desktop motion');for(const f of frames)for(const k of ['x','y','width','height'])assert.ok(Math.abs(f.nora[k]-before.nora[k])<=1,'Nora geometry stays stationary while both desktop layers move');
    assert.deepEqual(pageAfter,pageBefore,'The native pages retain identities, viewports, scroll and DOM');assert.equal(allSnapshots.length,2);assert.deepEqual(allSnapshots.map(s=>s.id).sort(),made.map(p=>p.id).sort());assert.ok(allSnapshots.every(s=>s.png&&s.decoded&&s.pixelWidth>=s.width-1&&s.pixelHeight>=s.height-1));assert.equal(active.captures.length,1,'Borrowed outgoing pixels are reused; only the incoming desktop is captured');assert.ok(active.captures.every(c=>c.complete&&c.prepared&&c.holdTokenMatches&&c.rows.length===1));assert.equal(recorded.overlayCount,0);assert.equal(recorded.sliding,false);assert.equal(recorded.visibility,'');
    const row={...active,cleanup:{overlayCount:recorded.overlayCount,sliding:recorded.sliding,visibility:recorded.visibility,holdRetained:browser.mouseSurfaceHold===hold},nativeLayoutCalls,animationDurationMs:last.animationDurationMs,totalDurationMs:last.totalDurationMs,frames,states,pageBefore,pageAfter,allSnapshots,before,after,last,paintedFrame:{...paintedFrame,filename}};evidence.transitions.push(row);tutorial.records.push({kind:'successful-native-switch',theme,direction,dispatch:packets[beforePackets],duplicateSuppressed:true,before,after,persisted:(await store.get(GESTURE_KEY))[GESTURE_KEY]});tutorial.successHidden=true;active=null;ackDelay=0;await persist();
    if(evidence.transitions.length===1){await click('#desks-close');await click('#desktops-button');const reopened=await shell();assert.equal(reopened.gesture.hintVisible,false);assert.equal(reopened.gesture.learned,true);tutorial.reopenHidden=true;tutorial.records.push({kind:'reopened',...reopened});}
   }
   evidence.simultaneous=evidence.pngSurfaces=evidence.compositorOnly=evidence.nativeIdentityPreserved=evidence.viewportAndScrollPreserved=evidence.slowAckBounded=evidence.noraStayedOpen=true;
   await click('#desks-close');const normalValue=structuredClone((await store.get(GESTURE_KEY))[GESTURE_KEY]);assert.deepEqual(normalValue,{completed:true});
   await privateMode.toggle();assert.ok(privateMode.current);await js('MouseTest.desktopUI.gesture.ready');await click('#desktops-button');await js('MouseTest.desktopUI.gesture.sync()');const privateFirst=await shell();assert.equal(privateFirst.gesture.learned,false);assert.equal(privateFirst.gesture.hintVisible,true);assert.deepEqual((await store.get(GESTURE_KEY))[GESTURE_KEY],normalValue);const privateBank=privateMode.current.desktopService.bank,privateTarget=privateBank.items[privateBank.items.findIndex(d=>d.id===privateBank.active)+1].id;await sleep(200);const privateStart=nativeSwipe('left');await until(()=>packets.length>privateStart,'private swipe bridge dispatch');await waitForSwitch(privateStart,privateTarget);const privateDone=await shell();assert.equal(privateDone.gesture.learned,true);assert.equal(privateDone.gesture.hintVisible,false);assert.deepEqual((await store.get(GESTURE_KEY))[GESTURE_KEY],normalValue);assert.equal((await privateMode.current.store.get(GESTURE_KEY))[GESTURE_KEY],undefined,'Private completion is not written to storage');tutorial.records.push({kind:'private-session',first:privateFirst,dispatch:packets[privateStart],after:privateDone,normalValue});
   await privateMode.toggle();await js('MouseTest.desktopUI.gesture.ready');assert.equal((await shell()).gesture.learned,true);await privateMode.toggle();await js('MouseTest.desktopUI.gesture.ready');await click('#desktops-button');const privateAgain=await shell();assert.equal(privateAgain.gesture.learned,false);assert.equal(privateAgain.gesture.hintVisible,true);assert.deepEqual((await store.get(GESTURE_KEY))[GESTURE_KEY],normalValue);tutorial.records.push({kind:'fresh-private-session',...privateAgain});await privateMode.toggle();await js('MouseTest.desktopUI.gesture.ready');tutorial.privateIsolated=true;completed=true;
  }finally{
   frameCapture?.cancel();active=null;ackDelay=0;browser.command=command;surfaces.capture=capture;win.webContents.send=send;
   if(privateMode?.current)await privateMode.toggle();await js('(()=>{const p=globalThis.__mouse628DesktopProof;if(p){p.running=false;cancelAnimationFrame(p.raf);}delete globalThis.__mouse628DesktopProof;MouseTest.model.switching=false;return MouseTest.desktopUI.close({immediate:true});})()');await closed();
   for(const {id,desk}of made){await js(`MouseTest.switchDesktop(${JSON.stringify(desk)})`);if(browser.tabs.has(id))await browser.command('close',{id});}
   await js('globalThis.MouseFlush?.()');Object.assign(bank,new(require('./mouse-desktops.cjs').DesktopBank)(savedBank,savedPreferences));browser.emit();await js(`(async()=>{const initial=await MouseNative.init();Object.assign(MouseTest.model,${JSON.stringify(savedPreferences)});MouseTest.model.state=initial.state;MouseTest.setTheme(${JSON.stringify(savedPreferences.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();await MouseTest.save();})()`);await browser.save();await store.queue;server?.close();await samePages();assert.deepEqual(bank.snapshot(),savedBank,'Temporary native fixture desktops and history are restored');
   evidence.restored=await js('!MouseTest.model.desktopSliding&&!document.querySelector("#mouse-desktop-transition")')&&!browser.mouseSurfaceHold;tutorial.restored=evidence.restored;tutorial.writeRendererTimeOrigin=await js('performance.timeOrigin');await persist();
  }
  assert.equal(completed,true);assert.equal(evidence.restored,true);console.log('MOUSE_628_OPEN_NORA_DESKTOP_SLIDE_NATIVE_PASS');console.log('MOUSE_628_THREE_FINGER_TUTORIAL_WRITE_PASS');
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
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');await closed();await activate();await painted();await js('MouseTest.desktopUI.gesture.ready');
  borderlessFacts.viewports.push({name:'large',bounds:win.getBounds(),content:win.getContentSize()});await installCornerMarkers();
  assert.equal(debug.isAttached(),false);debug.attach('1.3');attached=true;await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),false);
  motionTrace=createMotionTrace(debug,{file:'mouse-628-motion-trace.json',versions:Object.fromEntries(['electron','chrome','node','v8'].map(key=>[key,process.versions[key]])),snapshot:async label=>{
   const native=nativeTraceState(),renderer=await js(`(${rendererTraceState.toString()})(${JSON.stringify(MARKER_PREFIX+label)})`),metrics=app.getAppMetrics().map(({pid,type,cpu,memory,creationTime,sandboxed})=>({pid,type,cpu,memory,creationTime,sandboxed}));
   return{native,renderer,metrics,...(label==='before'?{gpuFeatureStatus:app.getGPUFeatureStatus?.()}:{})};
  }});await motionTrace.start();
  await beginBackgroundProbe();
  for(const theme of motionFacts.themes){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await painted();const footerBefore=await footer(),cornersBefore=await cornerBaseline(theme);await captureTinyBurrow(theme);await installRecorder();const openingCapture=await armPanelCapture(theme,'opening');await click('#desktops-button',false,()=>openingCapture.measure());
   await capturePanel(theme,'opening',openingCapture);await until(async()=>await phase()==='open','open content-sized panel');await painted();await capturePanel(theme,'open');const opening=await retainFrames(theme+'Opening');continuous(opening,'opening',theme+' opening');
   assert.ok(allPages().every(page=>!page.visible),'Native pages are held behind the painted snapshot without changing their viewports');await snapshotEvidence(theme);await verifyOpenCorners(theme,cornersBefore);
   const footerAfter=await footer();assert.deepEqual(footerAfter,footerBefore,theme+' keeps the footer geometry, border and actual pixels stationary');motionFacts.footer[theme]={before:footerBefore,after:footerAfter};
   await installRecorder();const closingCapture=await armPanelCapture(theme,'closing');await click('#desks-close',false);await capturePanel(theme,'closing',closingCapture);await closed();const closing=await retainFrames(theme+'Closing');continuous(closing,'closing',theme+' closing');await samePages();
  }
  Object.assign(motionFacts,{translationOnly:true,strokeFreeContour:true,openClosePainted:true,footerStable:true});
  motionFacts.interruptionTrials=[];
  const reversal=await runNoraReversalTrials({trials:motionFacts.interruptionTrials,
   arm:async()=>{await installRecorder();await armInterruptedReopen();},open:()=>click('#desktops-button',false),
   opening:()=>js('globalThis.__mouse628Reversal.opening'),result:()=>js('globalThis.__mouse628Reversal.promise'),sendEscape:()=>key('Escape'),
   capture:()=>js('({timeOrigin:performance.timeOrigin,current:globalThis.__mouse628Recorder.sample(),frames:globalThis.__mouse628Recorder.frames,sizes:globalThis.__mouse628Recorder.sizes,mutations:globalThis.__mouse628Recorder.mutations,longTasks:globalThis.__mouse628Recorder.longTasks,startup:MouseTest.desktopUI.motion.diagnostics?.(),observed:globalThis.__mouse628Reversal.observed})'),
   reset:async()=>{await js('globalThis.__mouse628Recorder.stop();globalThis.__mouse628Reversal.dispose();MouseTest.desktopUI.close({immediate:true})');await closed();await until(()=>!browser.mouseSurfaceHold,'pre-input reversal releases native pages');await samePages();return{...await js('({phase:document.querySelector("#desktop-tray").dataset.motion,open:document.querySelector("#desktop-tray").open,hidden:document.querySelector("#desktop-tray").hidden,snapshotCount:document.querySelectorAll(".mouse-floating-snapshot").length})'),nativeHeld:!!browser.mouseSurfaceHold};}
  });
  motionFacts.interruptionInputTrial=reversal.inputTrial;const {openingTrigger,interruption}=reversal;motionFacts.interruption=interruption;assert.equal(openingTrigger.error,undefined,'Native Escape waits for the real opening timeline: '+JSON.stringify(openingTrigger));
  assert.equal(interruption.error,undefined,'Reversal waits for genuine painted closing motion: '+JSON.stringify(interruption));assert.ok(closingReversalPair(...interruption.closingFrames));assert.ok(Math.abs(interruption.before.progress-interruption.after.progress)<.04,'Reversal retains the current progress');assert.ok(Math.abs(interruption.before.matrix.f-interruption.after.matrix.f)<2,'Reversal does not jump to an endpoint');assert.deepEqual(interruption.after.paths,interruption.before.paths);assert.equal(interruption.after.height,interruption.before.height);assert.equal(interruption.open,true);await until(async()=>await phase()==='open','reopened panel finishes');const interrupted=await retainFrames('interrupted');stableMotionGeometry(interrupted,'interrupted translation');assert.ok(interrupted.frames.some(f=>f.phase==='closing')&&interrupted.frames.some(f=>f.phase==='opening'));motionFacts.interruptionTrials.at(-1).status='passed';motionFacts.interruptionPreserved=true;await click('#desks-close');
  await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),true);await installRecorder();await click('#desktops-button');assert.equal(await phase(),'open');assert.equal(await js('MouseTest.desktopUI.motion.progress'),1);await click('#desks-close');const reduced=await retainFrames('reduced');assert.ok(reduced.frames.length>0);assert.ok(reduced.frames.every(f=>f.progress===0||f.progress===1),'Reduced motion has no intermediate translation');stableMotionGeometry(reduced,'reduced motion');motionFacts.reducedMotion=true;
  await endBackgroundProbe();await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await stopMotionTrace('motion-complete');await removeCornerMarkers();
  for(const viewport of ['large','small']){
   if(viewport==='small'){win.setBounds({x:work.x+8,y:work.y+8,width:800,height:600});await painted();borderlessFacts.viewports.push({name:viewport,bounds:win.getBounds(),content:win.getContentSize()});assert.notDeepEqual(borderlessFacts.viewports[0].content,borderlessFacts.viewports[1].content,'A genuinely smaller app window is tested');}
   for(const theme of motionFacts.themes){await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await click('#desktops-button');await contentControls(theme,viewport);await click('#desks-close');}
  }
  motionFacts.contentFit=motionFacts.noInnerScroll=true;borderlessFacts.footerSeamAbsent=borderlessFacts.decorativeOutlinesAbsent=borderlessFacts.roundedBackgroundCorners=true;
  win.setBounds(borderlessFacts.viewports[0].bounds);await painted();await verifyPalette();await samePages();await verifyGestureAndSlide();
 }catch(error){
  verificationError=error;const renderer=await js('({timeOrigin:performance.timeOrigin,current:globalThis.__mouse628Recorder?.sample(),frames:globalThis.__mouse628Recorder?.frames,sizes:globalThis.__mouse628Recorder?.sizes,mutations:globalThis.__mouse628Recorder?.mutations,longTasks:globalThis.__mouse628Recorder?.longTasks,startup:MouseTest.desktopUI.motion.diagnostics?.(),backdrop:MouseTest.desktopUI.diagnostics?.(),input:globalThis.__mouse626Input?{state:globalThis.__mouse626Input.state(),events:globalThis.__mouse626Input.events}:null})').catch(diagnosticError=>({error:diagnosticError.message}));
  if(lastInput&&renderer.input){lastInput.failureState=renderer.input.state;lastInput.events=renderer.input.events;}const failure={version:motionFacts.version,message:error.message,stack:error.stack,native:{timeOrigin:performance.timeOrigin,surfaces:browser.mouseDesktops?.surfaces?.diagnostics?.()},lastClick,lastInput,interruption:motionFacts.interruption??null,motion:await phase().catch(()=>null),recorded:motionFacts,borderless:borderlessFacts,renderer,captureDiagnostics};await stopMotionTrace('verification-error');console.error('MOUSE_628_MOTION_FAILURE_CONTEXT',JSON.stringify({message:error.message,lastClick,lastInput,interruption:failure.interruption,motion:failure.motion,current:renderer.current}));await fs.writeFile('mouse-628-motion-failure.json',JSON.stringify(failure,null,2)+'\n').catch(()=>{});await fs.writeFile('mouse-628-motion-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});throw error;
 }finally{
  await stopMotionTrace(verificationError?'verification-error':'fixture-cleanup');
  try{paintCapture?.cancel();paintCapture=null;await removeBackgroundProbe();await removeCornerMarkers();await js('globalThis.__mouse628Reversal?.dispose();delete globalThis.__mouse628Reversal;globalThis.__mouse628Recorder?.stop();delete globalThis.__mouse628Recorder;globalThis.__mouse626Input?.dispose();delete globalThis.__mouse626Input;MouseTest.desktopUI.close({immediate:true});document.querySelector("#capture-dialog")?.open&&document.querySelector("#capture-dialog").close();MouseTest.zoomUI.close()');await closed();
   if(attached){try{await bounded(()=>debug.sendCommand('Emulation.setEmulatedMedia',{media:'',features:[]}),3000,'Restore fixture emulated media');}finally{debug.detach();attached=false;}}
   await js(`MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.requestLayout();MouseTest.save()`);await store.queue;win.setBounds(bounds);if(originalFullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'restore inherited fullscreen');}await samePages();await clipboard.write(savedClipboard);
   assert.equal(await js('document.querySelectorAll(".mouse-floating-snapshot").length'),0,'Snapshot image memory is released after closing');await until(()=>js('!document.querySelector("dialog[open]:not([data-nonmodal])")'),'all fixture modal gates close');facts.stateRestored=true;motionFacts.stateRestored=true;borderlessFacts.restored=true;
  }catch(error){cleanupError=error;console.error('MOUSE_628_MOTION_CLEANUP_FAILURE',error.message);}
  finally{if(attached){try{debug.detach();}catch(error){cleanupError??=error;console.error('MOUSE_628_MOTION_DEBUGGER_CLEANUP_FAILURE',error.message);}attached=false;}}
  if(cleanupError&&!verificationError)throw cleanupError;
 }
 await fs.writeFile('mouse-628-borderless.json',JSON.stringify(borderlessFacts,null,2)+'\n');await fs.writeFile('mouse-626-verification.json',JSON.stringify(facts,null,2)+'\n');await fs.writeFile('mouse-628-motion.json',JSON.stringify(motionFacts,null,2)+'\n');
 console.log('MOUSE_628_BORDERLESS_NATIVE_PASS');console.log('MOUSE_628_NORA_CONTENT_FIT_NATIVE_PASS');console.log('MOUSE_626_CAPTURE_ANY_COLOR_PASS');
};
module.exports.screenCropGeometry=screenCropGeometry;
module.exports.cornerBackground=cornerBackground;
module.exports.nativeCornerPaintReady=nativeCornerPaintReady;
