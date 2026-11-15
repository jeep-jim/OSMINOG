'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {screen,desktopCapturer,systemPreferences}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label);}
module.exports=async({app,win,browser,globalCapture})=>{
 const js=s=>win.webContents.executeJavaScript(s),native=require('./mouse-native-menu.node');
 const old=await js('JSON.parse(JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,theme:QuadroTest.model.theme,aiOpen:QuadroTest.model.aiOpen}))');
 if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave fullscreen');await sleep(700);}
 const input=(type,p)=>win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});
 const rect=sel=>js(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
 const click=async sel=>{const r=await rect(sel),p={x:Math.round(r.x+r.w/2),y:Math.round(r.y+r.h/2)};win.focus();win.webContents.focus();for(const t of ['mouseMove','mouseDown','mouseUp'])input(t,p);await sleep(120);};
 try{
  await js('QuadroTest.changeLayout(4)');await sleep(200);
  for(const axis of ['x','y']){
   const r=await rect(`.divider[data-axis=${axis}]`),p={x:Math.round(r.x+r.w/2),y:Math.round(r.y+r.h/2)},q={x:p.x+(axis==='x'?70:0),y:p.y+(axis==='y'?60:0)};
   win.focus();win.webContents.focus();input('mouseMove',p);input('mouseDown',p);await sleep(100);input('mouseMove',q);await sleep(140);
   const badges=await js(`Array.from(document.querySelectorAll('.pane>.resize-size-hud:not([hidden])')).map(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return{text:e.textContent,w:Math.round(p.width),h:Math.round(p.height),dx:Math.abs(r.x+r.width/2-p.x-p.width/2),dy:Math.abs(r.y+r.height/2-p.y-p.height/2)}})`);
   assert.ok(badges.length>=2,'size HUD for both affected panels');for(const b of badges){assert.equal(b.text,b.w+' × '+b.h);assert.ok(b.dx<1&&b.dy<1,'HUD centered in pane');}
   if(axis==='x')await fs.writeFile('mouse-609-resize-hud.png',(await win.capturePage()).toPNG());
   input('mouseUp',q);await until(()=>js('document.querySelectorAll(".resize-size-hud").length===0'),'HUD removed on release');
  }
  console.log('MOUSE_609_RESIZE_HUD_BOTH_AXES_CENTERS_RELEASE_PASS');
  for(const theme of ['light','dark']){
 await js(`QuadroTest.setTheme('${theme}');QuadroTest.overlays.show(document.querySelector('#update-dialog'))`);
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
 await js('document.querySelector("#update-dialog").close();QuadroTest.overlays.sync()');await sleep(250);
}
  console.log('MOUSE_609_LARGE_UPDATE_MASCOT_BOTH_THEMES_PASS');
  const display=screen.getDisplayMatching(win.getBounds());
  if(globalCapture.permission()==='granted'){
   const frame=await globalCapture.acquire(display);assert.equal(frame.backend,'desktopCapturer');require('./quadro-shell.cjs').pngBuffer(frame.base);
   const sc=globalCapture.nativeCapture;
   if(sc?.status().granted){const first=await sc.capture(Number(display.id),false,true);assert.equal(first.backend,'ScreenCaptureKit-test-frame');require('./quadro-shell.cjs').pngBuffer(first.base);assert.equal(sc.status().busy,false);}
   console.log('MOUSE_609_REAL_LEGACY_AND_ONE_FRAME_STREAM_STOP_PASS');
  }else throw Error('Native capture verification needs already granted CI display consent');
  // Native OS events, not renderer-only events, prove titlebar cannot intercept tabs.
  await js('QuadroTest.changeLayout(2)');await sleep(160);app.focus({steal:true});win.focus();win.webContents.focus();
  win.setFullScreen(true);await until(()=>win.isFullScreen(),'enter fullscreen');await sleep(900);
  const d=screen.getDisplayMatching(win.getBounds());native.testPointer(d.bounds.x+d.bounds.width-160,d.bounds.y);
  await until(()=>{const state=win.quadroChromeGuard.nativeState();return state.menuVisible&&state.held;},'real system menu visible and native hover handled');await sleep(300);win.quadroChromeGuard.sample();await sleep(200);
  console.log('MOUSE_609_NATIVE_CHROME_STATE',JSON.stringify(win.quadroChromeGuard.nativeState()));
  const before=await js('QuadroTest.model.slots[QuadroTest.model.active]');
  const target=await js(`(()=>{const t=[...document.querySelectorAll('.tab-item')].find(t=>!t.classList.contains('active'));if(!t)throw Error('Need two tabs');const r=t.querySelector('.tab-title').getBoundingClientRect();return{id:t.dataset.tab,x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const bounds=win.getContentBounds();assert.equal(native.testClick(Math.round(bounds.x+target.x),Math.round(bounds.y+target.y)),true);
  await until(()=>js(`QuadroTest.model.slots[QuadroTest.model.active]===${JSON.stringify(target.id)}`),'actual native tab click below Apple menu');
  assert.notEqual(before,target.id);assert.equal(win.quadroChromeGuard.nativeState().appleMenuDisabled,false);
  if(systemPreferences.getMediaAccessStatus('screen')==='granted'){const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:d.size.width,height:d.size.height}});const im=sources.find(x=>String(x.display_id)===String(d.id))?.thumbnail;if(im&&!im.isEmpty())await fs.writeFile('mouse-609-real-menu-tab-click.png',im.toPNG());}
  console.log('MOUSE_609_REAL_APPLE_MENU_TAB_CLICK_PASS');
 }finally{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'final exit');await sleep(700);}
  await js(`Object.assign(QuadroTest.model,${JSON.stringify(old)});QuadroTest.setTheme(${JSON.stringify(old.theme)});QuadroTest.renderTree();QuadroTest.applySide();QuadroTest.save()`);
 }
};
