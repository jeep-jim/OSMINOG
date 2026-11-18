'use strict';
// Real installed controls and painted SVG frames, using only the isolated CI profile.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {screen,clipboard,ClipboardItem,nativeImage}=require('electron');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<400;i++){if(await fn())return;await sleep(25);}throw Error('Mouse626 timeout: '+label);}
const layoutKeys=['desktopId','mode','agentOpen','tree','slots','active','tabOrder','aiId','aiSessions','aiOpen','aiWidth'];
// Parse the actual painted SVG in Node after recording. Dense browser arc-length
// queries would themselves consume the animation frames being measured.
function contourEvidence(frame){
 const d=frame.paths.outline,tokens=d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
 assert.equal(d.replace(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g,''),'','Complete recorded path is parsed');
 let i=0,point=null,first=null;const segments=[];
 const number=()=>{const value=Number(tokens[i++]);assert.ok(Number.isFinite(value),'SVG command has a finite coordinate');return value;};
 while(i<tokens.length){
  const command=tokens[i++];assert.ok(['M','H','V','C'].includes(command),'Supported actual outline command: '+command);
  if(command==='M'){assert.equal(point,null,'Outline has a single continuous subpath');point={x:number(),y:number()};first=point;continue;}
  assert.ok(point,'Outline starts with a move');let controls;
  if(command==='C')controls=[point,{x:number(),y:number()},{x:number(),y:number()},{x:number(),y:number()}];
  else controls=[point,command==='H'?{x:number(),y:point.y}:{x:point.x,y:number()}];
  segments.push(controls);point=controls.at(-1);
 }
 assert.ok(segments.length>0,'Recorded outline contains painted segments');
 const m=frame.matrix,screen=p=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});
 const at=(points,t)=>{let values=points;while(values.length>1)values=values.slice(1).map((p,j)=>({x:values[j].x*(1-t)+p.x*t,y:values[j].y*(1-t)+p.y*t}));return screen(values[0]);};
 let mirror=0,top=Infinity;
 for(let j=0;j<segments.length;j++)for(let k=0;k<=40;k++){const p=at(segments[j],k/40),q=at(segments.at(-j-1),1-k/40);mirror=Math.max(mirror,Math.abs(p.x+q.x-frame.width),Math.abs(p.y-q.y));top=Math.min(top,p.y);}
 return{mirror,top,endpoints:[screen(first),screen(point)]};
}
function distinctVisibleHeights(frames){
 let count=0,previous=-Infinity;
 for(const top of frames.map(frame=>frame.top).sort((a,b)=>a-b))if(top-previous>=1){count++;previous=top;}
 return count;
}
module.exports=async({app,win,browser,store})=>{
 assert.equal(process.env.CI,'true','The visual fixture must never run in a personal profile');
 assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 const js=source=>win.webContents.executeJavaScript(source),native=require('./mouse-native-menu.node'),debug=win.webContents.debugger;
 const bounds=win.getBounds(),originalFullscreen=win.isFullScreen(),original=await js('MouseTest.prefs()'),layout=()=>js(`Object.fromEntries(${JSON.stringify(layoutKeys)}.map(k=>[k,MouseTest.prefs()[k]]))`),beforeLayout=await layout();
 const pages=new Map([...browser.tabs.values(),...browser.providers.values()].map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL(),epoch:page.navigationEpoch}]));
 // Electron 44 exposes asynchronous MIME ClipboardItems. Resolve each Blob now
 // so the original bytes remain available after the fixture exports a new PNG.
 const savedClipboard=await Promise.all((await clipboard.read()).map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
 const facts={version:'6.0.26',themes:['light','dark'],nora:{},palette:{},stateRestored:false,frames:{},seams:{}};
 let attached=false,lastClick=null,lastInput=null,verificationError,cleanupError;
 const phase=()=>js('document.querySelector("#desktop-tray").dataset.motion');
 const settled=()=>until(()=>js('(()=>{const t=document.querySelector("#desktop-tray");return t.hidden||t.dataset.motion==="open";})()'),'Nora reaches its current target geometry');
 const closed=()=>until(()=>js('document.querySelector("#desktop-tray").hidden&&!document.querySelector("#desktop-tray").open'),'Nora closes and releases its modal gate');
 async function activate(){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await until(()=>win.isFocused(),'native window focus');}
 async function painted(){await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(60);}
 async function click(selector,wait=true){
  if(wait)await settled();await activate();
  const point=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return{ok:false,reason:'missing'};const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{ok:!e.disabled&&r.width>0&&r.height>0&&e.contains(hit),x,y,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?.tagName+'#'+hit?.id};})()`);
  lastClick={selector,point};assert.equal(point.ok,true,'Mouse626 native target: '+JSON.stringify(lastClick));
  const origin=win.getContentBounds(),target={x:Math.round(origin.x+point.x),y:Math.round(origin.y+point.y)},area=screen.getDisplayNearestPoint(target).bounds;
  assert.ok(target.x>=area.x&&target.y>=area.y&&target.x<area.x+area.width&&target.y<area.y+area.height,'Native click stays on the display');
  assert.equal(native.testClick(target.x,target.y),true);await sleep(90);
  if(wait){if(selector==='#desktops-button')await until(async()=>await phase()==='open','Nora opens from its footer control');else if(selector==='#desks-close')await closed();await settled();}
 }
 async function key(keyCode,modifiers=[]){keyCode=({Enter:'Return',ArrowLeft:'Left',ArrowRight:'Right',ArrowUp:'Up',ArrowDown:'Down'})[keyCode]||keyCode;win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});if(keyCode==='Return')win.webContents.sendInputEvent({type:'char',keyCode:'\r',modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await sleep(35);}
 async function traceInput(selector){
  await js(`(()=>{globalThis.__mouse626Input?.dispose();const input=document.querySelector(${JSON.stringify(selector)}),events=[],types=['focus','blur','keydown','keyup','beforeinput','input','change','select','selectionchange','compositionstart','compositionupdate','compositionend'];const state=()=>{const active=document.activeElement,r=input.getBoundingClientRect(),style=getComputedStyle(input),measure=document.createElement('canvas').getContext('2d');measure.font=style.font;return{time:performance.now(),value:input.value,focused:active===input,documentFocused:document.hasFocus(),activeSelector:active?.tagName+'#'+active?.id,selectionStart:input.selectionStart,selectionEnd:input.selectionEnd,fullySelected:active===input&&input.selectionStart===0&&input.selectionEnd===input.value.length,disabled:input.disabled,readOnly:input.readOnly,maxLength:input.maxLength,type:input.type,rect:{x:r.x,y:r.y,width:r.width,height:r.height},requiredTextWidth:measure.measureText('#FFFFFF').width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth),paletteHidden:document.querySelector('#capture-palette').hidden,color:document.querySelector('#capture-color').value};};const observe=e=>{if(e.target!==input&&!(e.type==='selectionchange'&&document.activeElement===input))return;events.push({type:e.type,key:e.key??null,data:e.data??null,inputType:e.inputType??null,isTrusted:e.isTrusted,defaultPrevented:e.defaultPrevented,...state()});if(events.length>100)events.shift();};for(const type of types)document.addEventListener(type,observe,true);globalThis.__mouse626Input={state,events,dispose(){for(const type of types)document.removeEventListener(type,observe,true);}};})()`);
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
   globalThis.__mouse626Recorder?.stop();const frames=[],tray=document.querySelector('#desktop-tray'),outline=document.querySelector('#mouse-dock-outline'),content=tray.querySelector('.desk-content'),bar=document.querySelector('#statusbar'),surface=document.querySelector('#mouse-dock-surface'),local=tray.querySelector('.desk-burrow-shape'),localPath=local.querySelector(':scope>path');let raf=0,stopped=false;
   const rect=e=>{const r=e?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;};
   const sample=(detailed=false)=>{
    const sampleStart=performance.now(),d=outline?.getAttribute('d');if(!d)return null;const matrix=outline.getScreenCTM();if(!matrix)return null;
    const box=outline.getBBox(),footer=bar.getBoundingClientRect(),transform=new DOMMatrix(getComputedStyle(tray).transform),style=getComputedStyle(content),motion=MouseTest.desktopUI.motion.sample();
    const result={time:sampleStart,sampleStart,phase:tray.dataset.motion,progress:Number(tray.dataset.motionProgress),open:tray.open,hidden:tray.hidden,bbox:{x:box.x,y:box.y,width:box.width,height:box.height},baseline:footer.top+(parseFloat(getComputedStyle(bar).borderTopWidth)||0)/2,width:innerWidth,inert:content.inert,opacity:Number(style.opacity),bounds:rect(tray),content:{scrollHeight:content.scrollHeight},motion:motion?{progress:motion.progress,height:motion.height,targetHeight:motion.targetHeight,width:motion.width,left:motion.left,baseline:motion.baseline,state:motion.state}:null,paths:{outline:d,local:localPath.getAttribute('d'),viewBox:surface.getAttribute('viewBox'),localViewBox:local.getAttribute('viewBox')},matrix:{a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f},transform:{a:transform.a,b:transform.b,c:transform.c,d:transform.d,f:transform.f}};
    if(detailed){const header=content.querySelector(':scope>header'),headerRect=rect(header),headerHit=headerRect&&document.elementFromPoint((headerRect.left+headerRect.right)/2,(headerRect.top+headerRect.bottom)/2);Object.assign(result.content,{bounds:rect(content),clientHeight:content.clientHeight,offsetHeight:content.offsetHeight,scrollTop:content.scrollTop,maxHeight:style.maxHeight,paddingTop:style.paddingTop,header:headerRect,headerDisplay:header?getComputedStyle(header).display:null,headerHit:headerHit?.tagName+'#'+headerHit?.id,headerVisible:!!header&&header.contains(headerHit)});}
    result.sampleDuration=performance.now()-sampleStart;return result;
   };
   const tick=()=>{const frame=sample();if(frame)frames.push(frame);if(!stopped&&frames.length<1000)raf=requestAnimationFrame(tick);};globalThis.__mouse626Recorder={frames,sample,stop(){stopped=true;cancelAnimationFrame(raf);const frame=sample(true);if(frame)frames.push(frame);return frames;}};tick();
  })()`);
 }
 const stopFrames=()=>js('globalThis.__mouse626Recorder.stop()');
 async function retainFrames(name){const frames=await stopFrames();facts.frames[name]=frames;const save=()=>fs.writeFile('mouse-626-motion-diagnostics.json',JSON.stringify({version:facts.version,frames:facts.frames},null,2)+'\n');await save();for(const frame of frames)Object.assign(frame,contourEvidence(frame));await save();return frames;}
 function attachedGeometry(frames,label){
  assert.ok(frames.length>0,label+' has rendered frames');
  for(const f of frames.filter(f=>f.open&&!f.hidden)){
   assert.ok(f.mirror<=.8,label+' is symmetric in a rendered frame: '+f.mirror);
   assert.ok(Math.abs(f.endpoints[0].x)<=.1&&Math.abs(f.endpoints[1].x-f.width)<=.1,label+' owns the complete footer outline');
   for(const p of f.endpoints)assert.ok(Math.abs(p.y-f.baseline)<=.1,label+' remains joined at the footer baseline');
   assert.ok(Math.abs(f.transform.a-1)<.001&&Math.abs(f.transform.d-1)<.001&&Math.abs(f.transform.b)<.001&&Math.abs(f.transform.c)<.001&&Math.abs(f.transform.f)<.001,label+' changes contour without translating/scaling a panel');
  }
 }
 function continuous(frames,direction,label){
  attachedGeometry(frames,label);const moving=frames.filter(f=>f.phase===direction&&f.progress>0&&f.progress<1);
  assert.ok(moving.length>=3,label+' paints at least three intermediate frames');
  assert.ok(distinctVisibleHeights(moving)>=3,label+' has at least three intermediate contour heights separated by one pixel');
  for(let i=1;i<moving.length;i++){const delta=moving[i].top-moving[i-1].top,summary=f=>({time:f.time,sampleDuration:f.sampleDuration,top:f.top,progress:f.progress,baseline:f.baseline,bounds:f.bounds,motion:f.motion,content:f.content});assert.ok(direction==='opening'?delta<=1:delta>=-1,label+' reverses its geometry smoothly: '+JSON.stringify({index:i,delta,elapsed:moving[i].time-moving[i-1].time,before:summary(moving[i-1]),after:summary(moving[i])}));}
  assert.ok(moving.every(f=>f.open&&!f.hidden),'Modal view gate remains active throughout '+direction);
  if(direction==='opening')assert.ok(moving.some(f=>f.inert&&f.opacity<.9),'Content is revealed only after the surface grows');
 }
 async function seam(theme){
  await painted();const data=await js(`(()=>{const t=document.querySelector('#desktop-tray'),r=t.getBoundingClientRect(),bar=document.querySelector('#statusbar'),f=bar.getBoundingClientRect(),surface=document.querySelector('#mouse-dock-fill'),outline=document.querySelector('#mouse-dock-outline'),probe=document.createElement('i');probe.style.color='var(--panel)';document.body.append(probe);const panel=getComputedStyle(probe).color;probe.remove();const history=t.querySelector('.desk-history-controls').getBoundingClientRect(),actions=t.querySelector('.desk-actions').getBoundingClientRect(),title=t.querySelector('.desk-title').getBoundingClientRect();return{width:innerWidth,height:innerHeight,left:r.left,right:r.right,menuWidth:r.width,baseline:f.top+(parseFloat(getComputedStyle(bar).borderTopWidth)||0)/2,fill:getComputedStyle(surface).fill,panel,opacity:getComputedStyle(surface).opacity,stroke:getComputedStyle(outline).stroke,historyCenter:history.x+history.width/2,menuCenter:r.x+r.width/2,titleRight:title.right,historyLeft:history.left,historyRight:history.right,actionsLeft:actions.left,contentOpacity:getComputedStyle(t.querySelector('.desk-content')).opacity,inert:t.querySelector('.desk-content').inert,phase:t.dataset.motion};})()`);
  assert.equal(data.phase,'open');assert.equal(data.fill,data.panel,'The footer and menu share one solid fill');assert.equal(Number(data.opacity),1);assert.equal(Number(data.contentOpacity),1);assert.equal(data.inert,false);
  assert.ok(Math.abs(data.menuCenter-data.width/2)<=.5&&Math.abs(data.historyCenter-data.menuCenter)<=.5,'History is centred on the menu and footer');
  assert.ok(data.titleRight<=data.historyLeft+1&&data.historyRight<=data.actionsLeft+1,'Header groups do not overlap');
  const image=await win.capturePage(),size=image.getSize(),pixels=image.toBitmap(),sx=size.width/data.width,sy=size.height/data.height;
  const rgb=(x,y)=>{const i=(Math.floor(y*sy)*size.width+Math.floor(x*sx))*4;return[pixels[i+2],pixels[i+1],pixels[i]];},difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),samples=[];
  for(const fraction of [.2,.35,.65,.8]){const x=data.left+data.menuWidth*fraction,above=rgb(x,data.baseline-2),below=rgb(x,data.baseline+2.5);assert.ok(difference(above,below)<=6,theme+' has no background discontinuity at its footer join');for(const offset of [-1,-.5,0,.5,1]){const pixel=rgb(x,data.baseline+offset);assert.ok(difference(pixel,below)<=6,theme+' has no separate stroke at the joined surface');}samples.push({x,above,below});}
  facts.seams[theme]={...data,samples};await fs.writeFile('mouse-626-burrow-'+theme+'.png',image.toPNG());
 }
 async function samePages(){
  const current=new Map([...browser.tabs.values(),...browser.providers.values()].map(p=>[p.id,p]));assert.deepEqual([...current.keys()].sort(),[...pages.keys()].sort(),'Nora and capture preserve all page IDs');
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
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');await activate();await painted();
  assert.equal(debug.isAttached(),false);debug.attach('1.3');attached=true;await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),false);
  for(const theme of facts.themes){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await installRecorder();await click('#desktops-button');const opening=await retainFrames(theme+'-open');continuous(opening,'opening',theme+' opening');
   assert.ok([...browser.tabs.values(),...browser.providers.values()].every(page=>!page.visible),'Native pages remain behind the active menu');
   const compact=await js('document.querySelector("#desktop-tray").getBoundingClientRect().height');await installRecorder();await click('.desktop-card[aria-current="true"] .desk-preview-button');await settled();const expansion=await retainFrames(theme+'-resize');attachedGeometry(expansion,theme+' preview growth');const resizing=expansion.filter(f=>f.phase==='resizing');assert.ok(resizing.length>=3,'Preview grows across multiple painted geometries: '+JSON.stringify(expansion.map(f=>({time:f.time,phase:f.phase,top:f.top,sampleDuration:f.sampleDuration,motion:f.motion}))));assert.ok(distinctVisibleHeights(resizing)>=3,'Preview paints at least three intermediate contour heights separated by one pixel');assert.ok(await js('document.querySelector("#desktop-tray").getBoundingClientRect().height')>compact+60,'Preview truly expands the menu');facts.frames[theme+'-resize']=expansion;await seam(theme);
   await click('.desk-preview-close');await click('#desk-modes-button');assert.equal(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")'),'true');assert.equal(await js('document.querySelector("#desk-modes").inert'),false);await click('#desk-history-button');assert.equal(await js('document.querySelector("#desk-history-panel").hidden'),false);assert.equal(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")'),'false');await click('#desk-history-button');
   await installRecorder();await click('#desks-close');const closing=await retainFrames(theme+'-close');continuous(closing,'closing',theme+' closing');await samePages();
  }
  Object.assign(facts.nora,{symmetric:true,footerConnected:true,continuousOpen:true,continuousClose:true,resizeContinuous:true,contentRevealed:true,controlsWork:true});
  // Interrupt native opening with Escape, then reopen the same live contour.
  await installRecorder();await click('#desktops-button',false);await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="opening"&&Number(document.querySelector("#desktop-tray").dataset.motionProgress)>.08'),'partly grown Nora');await key('Escape');await until(async()=>await phase()==='closing','Escape reverses the growing surface');
  const interruption=await js('(()=>{const tray=document.querySelector("#desktop-tray"),path=document.querySelector("#mouse-dock-outline"),before={time:performance.now(),top:path.getBBox().y,progress:Number(tray.dataset.motionProgress),height:tray.getBoundingClientRect().height};void MouseTest.desktopUI.open();return{before,after:{time:performance.now(),top:path.getBBox().y,progress:Number(tray.dataset.motionProgress),height:tray.getBoundingClientRect().height},open:tray.open};})()');facts.interruption=interruption;assert.ok(Math.abs(interruption.before.progress-interruption.after.progress)<.08,'Retargeting advances the current motion rather than resetting its progress: '+JSON.stringify(interruption));assert.ok(Math.abs(interruption.before.top-interruption.after.top)<Math.max(8,interruption.before.height*.2),'Retargeting has no height jump: '+JSON.stringify(interruption));assert.equal(interruption.open,true);await until(async()=>await phase()==='open','reopened Nora finishes');const interrupted=await retainFrames('interrupted');attachedGeometry(interrupted,'interrupted motion');assert.ok(interrupted.some(f=>f.phase==='closing')&&interrupted.some(f=>f.phase==='opening'));facts.frames.interrupted=interrupted;facts.nora.interruptedMotion=true;await click('#desks-close');
  await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),true);await installRecorder();await click('#desktops-button');assert.equal(await phase(),'open');assert.equal(await js('Number(document.querySelector("#desktop-tray").dataset.motionProgress)'),1);await click('#desks-close');const reduced=await retainFrames('reduced');assert.ok(!reduced.some(f=>f.progress>0&&f.progress<1),'Reduced motion never paints intermediate motion');facts.nora.reducedMotion=true;
  await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await verifyPalette();await samePages();
 }catch(error){verificationError=error;const renderer=await js('({current:globalThis.__mouse626Recorder?.sample(true),frames:globalThis.__mouse626Recorder?.frames,input:globalThis.__mouse626Input?{state:globalThis.__mouse626Input.state(),events:globalThis.__mouse626Input.events}:null})').catch(diagnosticError=>({error:diagnosticError.message}));if(lastInput&&renderer.input){lastInput.failureState=renderer.input.state;lastInput.events=renderer.input.events;}const failure={version:facts.version,message:error.message,stack:error.stack,lastClick,lastInput,interruption:facts.interruption??null,motion:await phase().catch(()=>null),recorded:facts.frames,renderer};console.error('MOUSE_626_FAILURE_CONTEXT',JSON.stringify({lastClick,lastInput,interruption:failure.interruption,motion:failure.motion,current:renderer.current}));await fs.writeFile('mouse-626-failure-diagnostics.json',JSON.stringify(failure,null,2)+'\n').catch(()=>{});await fs.writeFile('mouse-626-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});throw error;}
 finally{
  try{await js('globalThis.__mouse626Recorder?.stop();delete globalThis.__mouse626Recorder;globalThis.__mouse626Input?.dispose();delete globalThis.__mouse626Input;MouseTest.desktopUI.close({immediate:true});document.querySelector("#capture-dialog")?.open&&document.querySelector("#capture-dialog").close();MouseTest.zoomUI.close()');
   if(attached){await debug.sendCommand('Emulation.setEmulatedMedia',{media:'',features:[]});debug.detach();attached=false;}
   await js(`MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.requestLayout();MouseTest.save()`);await store.queue;win.setBounds(bounds);if(originalFullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'restore inherited fullscreen');}await samePages();
   await clipboard.write(savedClipboard);
   assert.equal(await js('document.querySelectorAll(".mouse-floating-snapshot").length'),0,'Preview image memory is released after closing');
   await until(()=>js('!document.querySelector("dialog[open]:not([data-nonmodal])")'),'all fixture modal gates close');facts.stateRestored=true;
  }catch(error){cleanupError=error;console.error('MOUSE_626_CLEANUP_FAILURE',error.message);}
  if(cleanupError&&!verificationError)throw cleanupError;
 }
 await fs.writeFile('mouse-626-verification.json',JSON.stringify(facts,null,2)+'\n');
 console.log('MOUSE_626_BURROW_LIQUID_SYMMETRY_PASS');console.log('MOUSE_626_CAPTURE_ANY_COLOR_PASS');
};
