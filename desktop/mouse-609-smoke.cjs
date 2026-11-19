'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {screen,desktopCapturer,systemPreferences}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label);}
// Test-only receipt observer; this is serialized into the installed shell.
// It observes Electron's real input route without dispatching renderer events.
function installResizeInputProbe({axis,path,from,to}){
 const events=[],frames=[];let disposed=false,requested=false,frame=0;
 function sample(){const m=MouseTest.model,at=performance.now();let split=m.tree;for(const key of path)split=split[key];return{at,ratio:split.ratio,drag:m.drag?{kind:m.drag.kind,axis:m.drag.axis,path:m.drag.path,pointer:m.drag.pointer}:null,resizing:document.body.classList.contains('resizing'),hudCount:document.querySelectorAll('.resize-size-hud').length,panes:[...document.querySelectorAll('.pane')].map(e=>{const r=e.getBoundingClientRect();return{id:e.dataset.pane,width:r.width,height:r.height};}),badges:[...document.querySelectorAll('.pane>.resize-size-hud:not([hidden])')].map(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return{text:e.textContent,w:Math.round(p.width),h:Math.round(p.height),dx:Math.abs(r.x+r.width/2-p.x-p.width/2),dy:Math.abs(r.y+r.height/2-p.y-p.height/2)};})};}
 function observe(event){
  if(disposed)return;const row={type:event.type,at:performance.now(),x:event.clientX,y:event.clientY,pointer:event.pointerId,button:event.button,buttons:event.buttons,trusted:event.isTrusted};if(events.length<40)events.push(row);
  if(!requested&&row.trusted&&row.type==='pointermove'&&Math.abs(row.x-to.x)<=1&&Math.abs(row.y-to.y)<=1&&MouseTest.model.drag?.pointer===row.pointer&&MouseTest.model.drag?.axis===axis&&MouseTest.model.drag?.path===path){requested=true;frame=requestAnimationFrame(timestamp=>{if(disposed)return;frames.push({timestamp,...sample()});frame=requestAnimationFrame(timestamp=>{if(!disposed)frames.push({timestamp,...sample()});});});}
 }
 for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,observe,true);
 return{state:()=>({clock:'renderer performance.now',axis,path,from,to,events:events.slice(),frames:frames.slice(),...sample()}),dispose(){disposed=true;cancelAnimationFrame(frame);for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.removeEventListener(type,observe,true);}};
}
function resizeInputProbeScript(spec){
 // executeJavaScript clones the completion value across IPC; keep probe methods in the renderer.
 return `globalThis.__mouse609ResizeInput=(${installResizeInputProbe.toString()})(${JSON.stringify(spec)});true`;
}
async function observedResizeDrag({input,from,to,waitDown,waitMove,waitFrames,verify,waitRelease}){
 let pressed=false,position=from,result,error;
 try{input('mouseMove',from);pressed=true;input('mouseDown',from);await waitDown();position=to;input('mouseMove',to);await waitMove();result=await waitFrames();await verify(result);}
 catch(reason){error=reason;}
 finally{if(pressed)try{input('mouseUp',position);await waitRelease(position);}catch(reason){if(error)error.resizeReleaseError=String(reason.stack||reason);else error=reason;}}
 if(error)throw error;return result;
}
module.exports=async({app,win,browser,globalCapture})=>{
 const js=s=>win.webContents.executeJavaScript(s),native=require('./mouse-native-menu.node');
 const old=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,theme:MouseTest.model.theme,aiOpen:MouseTest.model.aiOpen}))');
 if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave fullscreen');await sleep(700);}
 const input=(type,p)=>win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});
 const rect=sel=>js(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
 const click=async sel=>{const r=await rect(sel),p={x:Math.round(r.x+r.w/2),y:Math.round(r.y+r.h/2)};win.focus();win.webContents.focus();for(const t of ['mouseMove','mouseDown','mouseUp'])input(t,p);await sleep(120);};
 try{
  await js('MouseTest.changeLayout(4)');await sleep(200);
  const resizeFacts={version:app.getVersion(),source:'webContents.sendInputEvent observed in the shell; HUD after matching pointermove animation frames',axes:[]};
  for(const axis of ['x','y']){
   const selector=`.divider[data-axis=${axis}]`,r=await rect(selector),p={x:Math.round(r.x+r.w/2),y:Math.round(r.y+r.h/2)},q={x:p.x+(axis==='x'?70:0),y:p.y+(axis==='y'?60:0)},path=await js(`document.querySelector(${JSON.stringify(selector)}).dataset.path`);
   const attempt={axis,path,from:p,to:q,divider:r,clock:'main performance.now',startedAt:performance.now(),sent:[]},deadline=attempt.startedAt+12000;resizeFacts.axes.push(attempt);let pointer;
   await js(resizeInputProbeScript({axis,path,from:p,to:q}));
   const state=()=>js('globalThis.__mouse609ResizeInput.state()'),matching=(s,type,point)=>s.events.find(e=>e.type===type&&e.trusted&&Math.abs(e.x-point.x)<=1&&Math.abs(e.y-point.y)<=1&&(pointer===undefined||e.pointer===pointer));
   const receipt=async(check,label)=>{attempt.phase=label;while(performance.now()<deadline){attempt.last=await state();const checkedAt=performance.now();if(checkedAt>=deadline)break;if(check(attempt.last)){attempt[label+'At']=checkedAt;return attempt.last;}await sleep(60);}throw Error('Timed out resize '+axis+' '+label);};
   try{
    attempt.before=await state();assert.equal(attempt.before.drag,null,'No previous drag is left active');assert.equal(attempt.before.resizing,false);assert.equal(attempt.before.hudCount,0);
    win.focus();win.webContents.focus();
    await observedResizeDrag({input:(type,point)=>{attempt.sent.push({type,...point,at:performance.now()});input(type,point);},from:p,to:q,
     waitDown:async()=>{const s=await receipt(s=>matching(s,'pointerdown',p)&&s.drag?.kind==='pane'&&s.drag.axis===axis&&s.drag.path===path&&s.resizing,'down');pointer=matching(s,'pointerdown',p).pointer;attempt.down=s;},
     waitMove:async()=>{attempt.move=await receipt(s=>matching(s,'pointermove',q)&&s.drag?.pointer===pointer,'move');},
     waitFrames:()=>receipt(s=>s.frames.length===2,'frames'),
     verify:async after=>{attempt.after=after;assert.ok(after.drag?.pointer===pointer&&after.drag.axis===axis&&after.resizing,'The same real drag remains active through the resize frame');assert.notEqual(after.ratio,attempt.before.ratio,'The delivered drag changes the affected split');const badges=after.badges;assert.ok(badges.length>=2,'size HUD for both affected panels');for(const b of badges){assert.equal(b.text,b.w+' × '+b.h);assert.ok(b.dx<1&&b.dy<1,'HUD centered in pane');}if(axis==='x')await fs.writeFile('mouse-609-resize-hud.png',(await win.capturePage()).toPNG());},
     waitRelease:async point=>{attempt.releaseStartedAt=performance.now();await until(async()=>{attempt.released=await state();return matching(attempt.released,'pointerup',point)&&!attempt.released.drag&&!attempt.released.resizing&&attempt.released.hudCount===0;},'HUD removed on observed release');attempt.releaseFinishedAt=performance.now();}
    });attempt.status='pass';
   }catch(error){attempt.status='fail';attempt.error={message:error.message,stack:error.stack,release:error.resizeReleaseError};throw error;}
   finally{attempt.finishedAt=performance.now();attempt.final=await state();await js('globalThis.__mouse609ResizeInput.dispose();delete globalThis.__mouse609ResizeInput');await fs.writeFile('mouse-609-resize-hud.json',JSON.stringify(resizeFacts,null,2)+'\n');}
  }
  console.log('MOUSE_609_RESIZE_HUD_BOTH_AXES_CENTERS_RELEASE_PASS');
  for(const theme of ['light','dark']){
 await js(`MouseTest.setTheme('${theme}');MouseTest.overlays.show(document.querySelector('#update-dialog'))`);
 await until(()=>js('document.querySelector("#update-dialog").open'),'actual update dialog open');
 await js('document.querySelector("#update-mouse").decode()');
 await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await sleep(700);
 const image=await rect('#update-mouse'),dialog=await rect('#update-dialog');assert.ok(image.w>=150&&image.h>=150);assert.ok(Math.abs(image.x+image.w/2-dialog.x-dialog.w/2)<2);
 assert.equal(await js('getComputedStyle(document.querySelector("#update-mouse")).filter'),theme==='dark'?'invert(1)':'none');
 // capturePage can return a previous compositor frame; require actual
 // foreground ink in the logo rectangle, not just positive DOM bounds.
 let shot,visible=false;
 for(let attempt=0;attempt<8;attempt++){
  shot=await win.capturePage();const dims=shot.getSize(),rgba=shot.toBitmap(),scale=dims.width/await js('innerWidth');let ink=0;
  for(let y=Math.ceil(image.y*scale);y<Math.floor((image.y+image.h)*scale);y++)for(let x=Math.ceil(image.x*scale);x<Math.floor((image.x+image.w)*scale);x++){
   const i=(y*dims.width+x)*4;if(rgba[i+3]>250&&(theme==='dark'?Math.min(rgba[i],rgba[i+1],rgba[i+2])>200:Math.max(rgba[i],rgba[i+1],rgba[i+2])<50))ink++;
  }
  if(ink>300*scale*scale){visible=true;break;}await sleep(250);
 }
 assert.equal(visible,true,'actual update mascot ink visible in '+theme);assert.equal(await js('document.querySelector("#update-dialog").open'),true);
 await fs.writeFile('mouse-609-update-'+theme+'.png',shot.toPNG());
 await js('document.querySelector("#update-dialog").close();MouseTest.overlays.sync()');await sleep(250);
}
  console.log('MOUSE_609_LARGE_UPDATE_MASCOT_BOTH_THEMES_PASS');
  const display=screen.getDisplayMatching(win.getBounds());
  if(globalCapture.permission()==='granted'){
   const frame=await globalCapture.acquire(display);assert.equal(frame.backend,'desktopCapturer');require('./mouse-shell.cjs').pngBuffer(frame.base);
   const sc=globalCapture.nativeCapture;
   if(sc?.status().granted){const first=await sc.capture(Number(display.id),false,true);assert.equal(first.backend,'ScreenCaptureKit-test-frame');require('./mouse-shell.cjs').pngBuffer(first.base);assert.equal(sc.status().busy,false);}
   console.log('MOUSE_609_REAL_LEGACY_AND_ONE_FRAME_STREAM_STOP_PASS');
  }else throw Error('Native capture verification needs already granted CI display consent');
  // Native OS events, not renderer-only events, prove titlebar cannot intercept tabs.
  await js('MouseTest.changeLayout(2)');await sleep(160);app.focus({steal:true});win.focus();win.webContents.focus();
  win.setFullScreen(true);await until(()=>win.isFullScreen(),'enter fullscreen');await sleep(900);
  const d=screen.getDisplayMatching(win.getBounds());native.testPointer(d.bounds.x+d.bounds.width-160,d.bounds.y);
  await until(()=>{const state=win.mouseChromeGuard.nativeState();return state.menuVisible&&state.held;},'real system menu visible and native hover handled');await sleep(300);win.mouseChromeGuard.sample();await sleep(200);
  console.log('MOUSE_609_NATIVE_CHROME_STATE',JSON.stringify(win.mouseChromeGuard.nativeState()));
  const before=await js('MouseTest.model.slots[MouseTest.model.active]');
  const target=await js(`(()=>{const t=[...document.querySelectorAll('.tab-item')].find(t=>!t.classList.contains('active'));if(!t)throw Error('Need two tabs');const r=t.querySelector('.tab-title').getBoundingClientRect();return{id:t.dataset.tab,x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const bounds=win.getContentBounds();assert.equal(native.testClick(Math.round(bounds.x+target.x),Math.round(bounds.y+target.y)),true);
  await until(()=>js(`MouseTest.model.slots[MouseTest.model.active]===${JSON.stringify(target.id)}`),'actual native tab click below Apple menu');
  assert.notEqual(before,target.id);assert.equal(win.mouseChromeGuard.nativeState().appleMenuDisabled,false);
  if(systemPreferences.getMediaAccessStatus('screen')==='granted'){const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:d.size.width,height:d.size.height}});const im=sources.find(x=>String(x.display_id)===String(d.id))?.thumbnail;if(im&&!im.isEmpty())await fs.writeFile('mouse-609-real-menu-tab-click.png',im.toPNG());}
  console.log('MOUSE_609_REAL_APPLE_MENU_TAB_CLICK_PASS');
 }finally{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'final exit');await sleep(700);}
  await js(`Object.assign(MouseTest.model,${JSON.stringify(old)});MouseTest.setTheme(${JSON.stringify(old.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);
 }
};
module.exports.observedResizeDrag=observedResizeDrag;
module.exports.installResizeInputProbe=installResizeInputProbe;
module.exports.resizeInputProbeScript=resizeInputProbeScript;
