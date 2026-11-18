'use strict';
// Installed macOS proof: real CG input and real rendered animation frames.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,n=180){for(let i=0;i<n;i++){const value=await fn();if(value)return value;await sleep(40);}throw Error('Mouse626 timeout: '+label);}

// This runs in the actual shell. Measurements use the painted SVG, never a
// reconstructed copy of the geometry helper or manually assigned progress.
function measureBurrow(){
 const tray=document.querySelector('#desktop-tray'),bar=document.querySelector('#statusbar'),r=tray.getBoundingClientRect(),f=bar.getBoundingClientRect(),footer=getComputedStyle(bar),state=MouseTest.desktopUI.motion.state();
 const basic={at:performance.now(),phase:tray.dataset.motion,progress:Number(tray.dataset.motionProgress),hidden:tray.hidden,open:tray.open,animating:state.animating,viewport:{width:innerWidth,height:innerHeight},footer:{left:f.left,right:f.right,top:f.top,width:f.width,border:parseFloat(footer.borderTopWidth),color:footer.borderTopColor},rect:{left:r.left,top:r.top,width:r.width,height:r.height,bottom:r.bottom}};
 if(tray.hidden||!tray.open||!r.width||!r.height)return basic;
 const path=tray.querySelector('.desk-burrow-shape>path'),matrix=path.getScreenCTM(),length=path.getTotalLength(),points=[];
 if(!matrix)return{...basic,error:'Missing SVG screen transform'};
 for(let i=0;i<=40;i++){const p=path.getPointAtLength(length*i/40).matrixTransform(matrix);points.push({x:p.x,y:p.y});}
 const transform=new DOMMatrixReadOnly(getComputedStyle(tray).transform),history=tray.querySelector('.desk-history-controls').getBoundingClientRect(),button=tray.querySelector('#desk-history-button').getBoundingClientRect(),glass=getComputedStyle(tray.querySelector('.desk-glass'));
 return{...basic,points,drawnHeight:basic.footer.top+basic.footer.border/2-Math.min(...points.map(p=>p.y)),footWidth:points.at(-1).x-points[0].x,stroke:getComputedStyle(path).stroke,fill:glass.backgroundColor,footerFill:footer.backgroundColor,transform:{a:transform.a,b:transform.b,c:transform.c,d:transform.d,f:transform.f},history:{center:history.left+history.width/2,buttonCenter:button.left+button.width/2,width:history.width}};
}

function assertContour(frame,label){
 assert.ok(!frame.error,label+': '+frame.error);assert.ok(frame.points?.length===41,label+' has actual SVG points');
 const centre=frame.footer.left+frame.footer.width/2,baseline=frame.footer.top+frame.footer.border/2,first=frame.points[0],last=frame.points.at(-1);
 assert.ok(frame.footer.border>0,label+' retains the footer border box');
 assert.ok(Math.abs(first.y-baseline)<=.05&&Math.abs(last.y-baseline)<=.05,label+' stays attached to the actual footer border: '+JSON.stringify({first,last,baseline}));
 assert.ok(Math.abs(first.x+last.x-2*centre)<.1,label+' has a centred footprint');
 for(let i=0;i<frame.points.length;i++){const a=frame.points[i],b=frame.points[frame.points.length-1-i];assert.ok(Math.abs(a.x+b.x-2*centre)<=.5&&Math.abs(a.y-b.y)<=.5,label+' has mirrored actual contour points');}
 assert.equal(frame.stroke,frame.footer.color,label+' shares the footer outline color');
 assert.equal(frame.fill,frame.footerFill,label+' shares the opaque footer fill');
 assert.match(frame.fill,/^rgb\(/,label+' has opaque fill');
 assert.ok(Math.abs(frame.transform.a-1)<.001&&Math.abs(frame.transform.d-1)<.001&&Math.abs(frame.transform.b)<.001&&Math.abs(frame.transform.c)<.001&&Math.abs(frame.transform.f)<.001,label+' grows without vertical translation or scale');
 assert.ok(Math.abs(frame.history.center-centre)<=1&&Math.abs(frame.history.buttonCenter-centre)<=1,label+' centres the history controls independently of side content');
}

function assertMotion(trace,direction,theme){
 assert.equal(trace.done,true,theme+' '+direction+' completes within the bounded trace');assert.equal(trace.error,null);
 const moving=trace.frames.filter(f=>f.phase===direction&&f.points),visible=trace.frames.filter(f=>f.points);
 assert.ok(moving.length>=3,theme+' records actual intermediate '+direction+' frames');
 assert.ok(new Set(moving.map(f=>Math.round(f.drawnHeight))).size>=3,theme+' changes the rendered contour height during '+direction);
 assert.ok(new Set(moving.map(f=>Math.round(f.footWidth))).size>=3,theme+' changes the footer footprint during '+direction);
 for(const f of visible)assertContour(f,theme+' '+direction+' '+f.progress.toFixed(3));
 for(let i=1;i<moving.length;i++){
  const sign=direction==='opening'?1:-1;
  assert.ok(sign*(moving[i].drawnHeight-moving[i-1].drawnHeight)>=-1,theme+' contour height moves continuously '+direction);
  assert.ok(sign*(moving[i].footWidth-moving[i-1].footWidth)>=-1,theme+' footprint moves continuously '+direction);
 }
 const end=trace.frames.at(-1);assert.equal(end.phase,direction==='opening'?'open':'closed');assert.equal(end.hidden,direction==='closing');
 const click=direction==='opening'?'desktops-button':'desks-close';assert.ok(trace.clicks.some(e=>e.id===click&&e.trusted),theme+' '+direction+' follows a real native click');
 if(direction==='closing')assert.ok(moving.at(-1).drawnHeight<Math.max(12,moving[0].drawnHeight*.2),theme+' closes back into the footer before hiding');
}

function seamPixels(image,before,after,label){
 const size=image.getSize(),pixels=image.toBitmap(),sx=size.width/before.viewport.width,sy=size.height/before.viewport.height,baseline=before.footer.top+before.footer.border/2;
 assert.ok(Math.abs(baseline-(after.footer.top+after.footer.border/2))<=.05,label+' footer did not move during capture');
 const rgb=(x,y)=>{const ix=Math.floor(x*sx),iy=Math.floor(y*sy);assert.ok(ix>=0&&iy>=0&&ix<size.width&&iy<size.height);const i=(iy*size.width+ix)*4;return[pixels[i+2],pixels[i+1],pixels[i]];};
 const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),left=Math.max(before.points[0].x,after.points[0].x),right=Math.min(before.points.at(-1).x,after.points.at(-1).x),inside=[],outside=[];
 assert.ok(right-left>70,label+' opening is wide enough for independent seam pixels');
 for(const fraction of [.25,.4,.6,.75]){
  const x=left+(right-left)*fraction,above=rgb(x,baseline-2),below=rgb(x,baseline+2.5),rows=[-1,-.5,0,.5,1].map(offset=>({offset,rgb:rgb(x,baseline+offset)}));
  for(const row of rows)for(let c=0;c<3;c++)assert.ok(row.rgb[c]>=Math.min(above[c],below[c])-6&&row.rgb[c]<=Math.max(above[c],below[c])+6,label+' has no extra seam at '+row.offset+': '+JSON.stringify({x,above,below,row}));
  assert.ok(delta(rgb(x,baseline+.5),below)<=6,label+' removes the footer divider inside its actual footprint');inside.push({x,above,below,rows});
 }
 const outerLeft=Math.min(before.points[0].x,after.points[0].x),outerRight=Math.max(before.points.at(-1).x,after.points.at(-1).x);
 for(const x of [outerLeft/2,(outerRight+before.viewport.width)/2]){const line=rgb(x,before.footer.top+.5),below=rgb(x,before.footer.top+2.5),difference=delta(line,below);assert.ok(difference>8,label+' preserves the footer border outside the burrow');outside.push({x,line,below,difference});}
 return{inside,outside};
}

module.exports=async({app,win,browser})=>{
 const {screen}=require('electron'),native=require('./mouse-native-menu.node'),js=source=>win.webContents.executeJavaScript(source),original=await js('MouseTest.prefs()'),bounds=win.getBounds(),fullScreen=win.isFullScreen(),records=new Map([...browser.tabs].map(([id,t])=>[id,{tab:t,wc:t.view.webContents,url:t.view.webContents.getURL(),epoch:t.navigationEpoch||0}])),visibleBefore=browser.panels.map(p=>p.id).sort();
 const result={version:'6.0.26',burrow:{openingAnimated:false,closingAnimated:false,footerJoinContinuous:false,symmetricOutline:false,historyCentered:false,bothThemes:false},palette:{fullPickerVisible:false,customColorPicked:false,annotationColorApplied:false,hexSynchronized:false,bothThemes:false},stateRestored:false,evidence:{burrow:[],palette:[]}};
 let debugAttached=false,lastAction=null,failure=null,originalColor=await js('document.querySelector("#capture-color").value');
 async function activate(){
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();await sleep(100);
  if(!win.isFocused()){
   const p=await js(`(()=>{const bar=document.querySelector('#statusbar'),r=bar.getBoundingClientRect(),y=r.top+r.height/2;for(let x=r.left+8;x<r.right-8;x+=4){const e=document.elementFromPoint(x,y);if(e&&bar.contains(e)&&!e.closest('button,a,input,select,label'))return{x,y};}return null;})()`);assert.ok(p,'An empty footer focus area exists');const o=win.getContentBounds();assert.equal(native.testClick(Math.round(o.x+p.x),Math.round(o.y+p.y)),true);await sleep(150);win.focus();win.webContents.focus();
  }
  await until(()=>win.isFocused(),'focused native window');
 }
 async function target(selector,x=.5,y=.5){
  const probe=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return{ok:false,reason:'missing',selector:${JSON.stringify(selector)}};const r=e.getBoundingClientRect(),x=r.left+r.width*${x},y=r.top+r.height*${y},hit=document.elementFromPoint(x,y),ok=!!r.width&&!!r.height&&e.contains(hit);return{ok,reason:ok?'ready':'empty or covered',selector:${JSON.stringify(selector)},x,y,rect:{left:r.left,top:r.top,width:r.width,height:r.height},hit:hit?{tag:hit.tagName,id:hit.id||''}:null};})()`);assert.equal(probe.ok,true,'Mouse626 native target: '+JSON.stringify(probe));
  const o=win.getContentBounds(),point={x:Math.round(o.x+probe.x),y:Math.round(o.y+probe.y)},area=screen.getDisplayNearestPoint(point).bounds;assert.ok(point.x>=area.x&&point.y>=area.y&&point.x<area.x+area.width&&point.y<area.y+area.height,'Native target is on screen');return{...probe,screen:point};
 }
 async function tap(selector,{delay=70,focus=true}={}){if(focus)await activate();const p=await target(selector);lastAction={type:'click',selector,point:p.screen};assert.equal(native.testClick(p.screen.x,p.screen.y),true);if(delay)await sleep(delay);}
 async function drag(selector,from,to){
  await activate();const a=await target(selector,...from),b=await target(selector,...to);lastAction={type:'drag',selector,from:a.screen,to:b.screen};assert.equal(native.testMouse(a.screen.x,a.screen.y,0),true);
  try{await sleep(70);for(let i=1;i<=10;i++){assert.equal(native.testMouse(a.screen.x+(b.screen.x-a.screen.x)*i/10,a.screen.y+(b.screen.y-a.screen.y)*i/10,1),true);await sleep(25);}}
  finally{assert.equal(native.testMouse(b.screen.x,b.screen.y,2),true);}await sleep(70);
 }
 async function settled(){await until(()=>js(`(()=>{const t=document.querySelector('#desktop-tray'),s=MouseTest.desktopUI.motion.state();return !s.animating&&t.dataset.motion==='open'&&!t.hidden&&t.open;})()`),'settled, interactive burrow');await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
 async function armTrace(direction){
  await js(`(()=>{globalThis.__mouse626Trace?.dispose?.();const trace={frames:[],clicks:[],done:false,error:null,frame:0,start:performance.now()},target=${JSON.stringify(direction==='opening'?'open':'closed')};let started=false,stable=0;const click=e=>{if(trace.clicks.length<8){const id=e.target.closest?.('button')?.id;if(id==='desktops-button'||id==='desks-close')trace.clicks.push({id,trusted:e.isTrusted,at:performance.now()});}};document.addEventListener('click',click,true);trace.dispose=()=>{cancelAnimationFrame(trace.frame);document.removeEventListener('click',click,true);};function sample(){try{const f=__mouse626Measure();trace.frames.push(f);if(f.phase===${JSON.stringify(direction)})started=true;if(started&&f.phase===target&&!f.animating)stable++;else stable=0;if(stable>=2){trace.done=true;trace.dispose();return;}if(trace.frames.length>=240||performance.now()-trace.start>8000)throw Error('Bounded native motion trace did not complete');trace.frame=requestAnimationFrame(sample);}catch(e){trace.error=e.message;trace.done=true;trace.dispose();}}globalThis.__mouse626Trace=trace;trace.frame=requestAnimationFrame(sample);})()`);
 }
 async function traceResult(){await until(()=>js('__mouse626Trace.done'),'native motion trace completion');return js('({frames:__mouse626Trace.frames,clicks:__mouse626Trace.clicks,done:__mouse626Trace.done,error:__mouse626Trace.error})');}
 async function captureSeam(theme,state,before){const image=await win.capturePage(),after=await js('__mouse626Measure()');assertContour(before,theme+' '+state+' before capture');assertContour(after,theme+' '+state+' after capture');if(state==='opening'){assert.equal(before.phase,'opening');assert.equal(after.phase,'opening','Opening screenshot must be captured while the real animation is still running');}const pixels=seamPixels(image,before,after,theme+' '+state);await fs.writeFile('mouse-626-burrow-'+state+'-'+theme+'.png',image.toPNG());return{before,after,pixels};}
 async function paletteState(){return js(`(()=>{const p=document.querySelector('#capture-palette'),s=document.querySelector('#capture-spectrum'),h=document.querySelector('#capture-hue'),r=s.getBoundingClientRect(),pr=p.getBoundingClientRect();return{visible:!p.hidden,spectrum:{left:r.left,top:r.top,width:r.width,height:r.height},palette:{left:pr.left,top:pr.top,right:pr.right,bottom:pr.bottom},viewport:{width:innerWidth,height:innerHeight},hue:{value:Number(h.value),min:Number(h.min),max:Number(h.max)},color:document.querySelector('#capture-color').value,hex:document.querySelector('#capture-hex').value,presets:[...p.querySelectorAll('[data-color]')].map(b=>b.dataset.color),events:globalThis.__mouse626Palette?.events||[]};})()`);}
 try{
  assert.equal(await js('MouseTest.capture.isOpen()'),false);assert.equal(await js('!!MouseTest.model.switching'),false);
  if(fullScreen){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave full screen');}
  const work=screen.getPrimaryDisplay().workArea;win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1200,work.width-16),height:Math.min(820,work.height-16)});await activate();
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');await until(()=>browser.panels.map(p=>p.id).sort().join(',')===visibleBefore.join(','),'initial native pages restored');
  const debug=win.webContents.debugger;assert.equal(debug.isAttached(),false);debug.attach('1.3');debugAttached=true;await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),false);
  await js('globalThis.__mouse626Measure='+measureBurrow.toString()+';void 0');
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)});MouseTest.feedback.hide()`);await activate();await armTrace('opening');await tap('#desktops-button',{delay:0,focus:false});
   const openingFrame=await until(()=>js('(()=>{const f=__mouse626Measure();return f.phase==="opening"&&f.progress>=.3&&f.progress<.72&&f.footWidth>100?f:null;})()'),'a real intermediate opening frame',100);
   const openingCapture=await captureSeam(theme,'opening',openingFrame),opening=await traceResult();assertMotion(opening,'opening',theme);await settled();
   const compact=await js('__mouse626Measure()');assertContour(compact,theme+' compact');
   await tap('#desk-modes-button');await settled();const modes=await js('__mouse626Measure()');assertContour(modes,theme+' modes');assert.ok(modes.rect.height>compact.rect.height+60,'Modes expand the same surface upward');
   await tap('#desk-history-button');await until(()=>js('!document.querySelector("#desk-history-panel").hidden'),'history panel opened');await settled();const history=await js('__mouse626Measure()');assertContour(history,theme+' history');
   const settledCapture=await captureSeam(theme,'settled',history);
   await activate();await armTrace('closing');await tap('#desks-close',{delay:0,focus:false});const closing=await traceResult();assertMotion(closing,'closing',theme);
   await until(()=>browser.panels.map(p=>p.id).sort().join(',')===visibleBefore.join(','),'native pages return after burrow closes');
   result.evidence.burrow.push({theme,opening,closing,compact,modes,history,openingCapture,settledCapture});
  }
  for(const key of Object.keys(result.burrow))result.burrow[key]=true;
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)});MouseTest.feedback.hide()`);await tap('#screenshot-button');await until(()=>js('MouseTest.capture.isOpen()&&MouseTest.capture.test.getCanvas().width>1'),'real screenshot editor');await tap('#capture-all');await tap('#capture-color');
   const initial=await paletteState();assert.equal(initial.visible,true);assert.ok(initial.spectrum.width>=180&&initial.spectrum.height>=120,'A full two-dimensional color field is visible');assert.equal(initial.hue.min,0);assert.equal(initial.hue.max,359);assert.equal(initial.presets.length,8);assert.ok(initial.palette.left>=0&&initial.palette.top>=0&&initial.palette.right<=initial.viewport.width&&initial.palette.bottom<=initial.viewport.height,'Full palette fits in the native editor');
   await js(`(()=>{globalThis.__mouse626Palette?.dispose?.();const events=[],listeners=[];for(const id of ['capture-hue','capture-spectrum'])for(const type of ['pointerdown','pointermove','pointerup','input']){const node=document.getElementById(id),fn=e=>{if(events.length<48&&(type!=='pointermove'||e.buttons))events.push({id,type,trusted:e.isTrusted,x:e.clientX??null,y:e.clientY??null,value:node.value??null});};node.addEventListener(type,fn);listeners.push([node,type,fn]);}globalThis.__mouse626Palette={events,dispose:()=>listeners.forEach(([n,t,f])=>n.removeEventListener(t,f))};})()`);
   await drag('#capture-hue',[.2,.5],[theme==='light'?.66:.82,.5]);await drag('#capture-spectrum',[.2,.2],[theme==='light'?.57:.43,theme==='light'?.23:.31]);
   const picked=await paletteState();assert.match(picked.color,/^#[0-9a-f]{6}$/);assert.notEqual(picked.color,initial.color);assert.ok(!picked.presets.includes(picked.color),'Real pointer gestures select a color outside the eight swatches');assert.notEqual(picked.hue.value,initial.hue.value);assert.equal(picked.hex,picked.color);
   for(const [id,type]of [['capture-hue','input'],['capture-spectrum','pointerdown'],['capture-spectrum','pointerup']])assert.ok(picked.events.some(e=>e.id===id&&e.type===type&&e.trusted),'Native palette event '+id+' '+type);
   const pointer=picked.events.filter(e=>e.id==='capture-spectrum'&&e.type==='pointerup').at(-1),s=(pointer.x-picked.spectrum.left)/picked.spectrum.width,v=1-(pointer.y-picked.spectrum.top)/picked.spectrum.height,h=picked.hue.value/60,c=v*s,xx=c*(1-Math.abs(h%2-1)),m=v-c,components=h<1?[c,xx,0]:h<2?[xx,c,0]:h<3?[0,c,xx]:h<4?[0,xx,c]:h<5?[xx,0,c]:[c,0,xx],expected=components.map(x=>Math.round((x+m)*255)),actual=picked.color.slice(1).match(/../g).map(x=>parseInt(x,16));
   assert.ok(actual.every((x,i)=>Math.abs(x-expected[i])<=1),'The displayed HEX matches independently calculated HSV from the real pointer');
   await fs.writeFile('mouse-626-palette-'+theme+'.png',(await win.capturePage()).toPNG());
   await tap('[data-tool=line]');const count=await js('MouseTest.capture.test.getOps().length');await drag('#capture-canvas',[.28,.45],[.62,.45]);await until(async()=>(await js('MouseTest.capture.test.getOps().length'))===count+1,'actual colored annotation committed');
   const annotation=await js(`(()=>{const op=MouseTest.capture.test.getOps().at(-1),canvas=MouseTest.capture.test.getCanvas(),ctx=canvas.getContext('2d'),p=op.points,mid={x:Math.round((p[0].x+p.at(-1).x)/2),y:Math.round((p[0].y+p.at(-1).y)/2)},data=ctx.getImageData(mid.x-2,mid.y-2,5,5).data,pixels=[];for(let i=0;i<data.length;i+=4)pixels.push([...data.slice(i,i+4)]);return{op,mid,pixels};})()`);assert.equal(annotation.op.tool,'line');assert.equal(annotation.op.color,picked.color);assert.ok(annotation.pixels.some(pixel=>pixel[3]===255&&actual.every((v,i)=>Math.abs(v-pixel[i])<=4)),'The actual screenshot canvas contains the chosen annotation color');
   result.evidence.palette.push({theme,initial,picked,independentHSV:{s,v,hue:picked.hue.value,expected},annotation});
   await js('__mouse626Palette.dispose();delete globalThis.__mouse626Palette');
   if(theme==='dark'){
    await tap('#capture-color');const selector='#capture-palette [data-color="'+originalColor+'"]';assert.equal(await js('!!document.querySelector('+JSON.stringify(selector)+')'),true,'Original fixture color has a normal palette control');await tap(selector);assert.equal(await js('document.querySelector("#capture-color").value'),originalColor);
   }
   await tap('#capture-close');await until(async()=>!await js('MouseTest.capture.isOpen()'),'screenshot editor closed');
   await until(()=>browser.panels.map(p=>p.id).sort().join(',')===visibleBefore.join(','),'native pages return after screenshot editor');
  }
  for(const key of Object.keys(result.palette))result.palette[key]=true;
 }catch(error){failure=error;console.error('MOUSE_626_FAILURE_CONTEXT',JSON.stringify({lastAction,window:win.getBounds(),focused:win.isFocused(),error:error.message}));await fs.writeFile('mouse-626-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});await fs.writeFile('mouse-626-failure.json',JSON.stringify({lastAction,error:error.message,trace:await js('globalThis.__mouse626Trace?({frames:__mouse626Trace.frames,clicks:__mouse626Trace.clicks,error:__mouse626Trace.error}):null').catch(()=>null),palette:await paletteState().catch(()=>null),result},null,2)+'\n').catch(()=>{});
 }finally{
  try{const o=win.getContentBounds();native.testMouse(o.x+10,o.y+60,2);}catch{}
  try{
   await js(`globalThis.__mouse626Trace?.dispose?.();globalThis.__mouse626Palette?.dispose?.();delete globalThis.__mouse626Trace;delete globalThis.__mouse626Palette;delete globalThis.__mouse626Measure;if(MouseTest.capture.isOpen())document.querySelector('#capture-dialog').close();MouseTest.desktopUI.close({immediate:true});MouseTest.zoomUI.close();MouseTest.feedback.hide()`);
   if(debugAttached){await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'',features:[]});win.webContents.debugger.detach();debugAttached=false;}
   await js(`MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.save()`);win.setBounds(bounds);if(fullScreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'restore fullscreen');}
   await until(()=>browser.panels.map(p=>p.id).sort().join(',')===visibleBefore.join(','),'restore original native page layout');
   assert.deepEqual(await js('MouseTest.prefs()'),original,'All original preferences and layout remain unchanged');assert.deepEqual([...browser.tabs.keys()].sort(),[...records.keys()].sort(),'No pages were added or closed');
   for(const [id,record]of records){const current=browser.get(id);assert.equal(current,record.tab);assert.equal(current.view.webContents,record.wc);assert.equal(current.view.webContents.getURL(),record.url);assert.equal(current.navigationEpoch||0,record.epoch,'No native page navigation occurred');}
   assert.equal(await js('MouseTest.capture.isOpen()'),false);assert.equal(await js('document.querySelector("#desktop-tray").hidden'),true);assert.equal(await js('document.querySelector("#capture-color").value'),originalColor);result.stateRestored=true;
  }catch(error){if(!failure)failure=error;else console.error('MOUSE_626_CLEANUP_FAILURE',error);}
 }
 if(failure)throw failure;
 assert.equal(result.evidence.burrow.length,2);assert.equal(result.evidence.palette.length,2);await fs.writeFile('mouse-626-verification.json',JSON.stringify(result,null,2)+'\n');console.log('MOUSE_626_BURROW_LIQUID_JOIN_HISTORY_CENTER_PASS');console.log('MOUSE_626_SCREENSHOT_FULL_COLOR_PICKER_PASS');
};
