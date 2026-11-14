'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {Menu,screen,desktopCapturer,systemPreferences}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){for(let i=0;i<100;i++){if(await check())return;await sleep(80);}throw Error('Timed out: '+label);}
module.exports=async({app,win,browser})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 assert.equal(app.getName(),'Mouse Browser');assert.equal(Menu.getApplicationMenu().items[0].label,'Mouse Browser');assert.equal(win.isKiosk(),false);assert.equal(win.isAlwaysOnTop(),false);
 const s=win.quadroChromeGuard.nativeState();assert.equal(s.attached,true);assert.equal(s.menuHidden,false);assert.equal(s.appleMenuDisabled,false);assert.ok(s.mainMenuItems>=5);
 const previous=await js('({theme:QuadroTest.model.theme,aiOpen:QuadroTest.model.aiOpen})');
 const ai=[...browser.tabs.values()].find(t=>t.lane==='side');assert.ok(ai,'existing AI fixture');
 await js(`QuadroTest.openAI(${JSON.stringify(ai.url)})`);await sleep(200);
 const r=await js(`(()=>{const p=document.querySelector('#ai-panel').getBoundingClientRect(),h=document.querySelector('.ai-controls').getBoundingClientRect(),v=document.querySelector('#ai-slot').getBoundingClientRect(),i=document.querySelector('#ai-provider-icon').getBoundingClientRect(),n=document.querySelector('#ai-select').getBoundingClientRect();return{top:p.top,head:h.height,slot:v.top,iconLeft:i.left,nameLeft:n.left,headCount:document.querySelectorAll('#ai-panel>.ai-controls').length,extra:!!document.querySelector('#ai-panel>.ai-head')}})()`);
 assert.equal(r.head,34);assert.equal(r.slot-r.top,34);assert.equal(r.headCount,1);assert.equal(r.extra,false);assert.ok(r.iconLeft>=r.nameLeft);
 // Existing service favicon is reused in its selector and chooser without reloading guest content.
 const epoch=ai.navigationEpoch||0,wc=ai.view.webContents.id;
 await until(()=>js(`document.querySelector('#ai-provider-icon').src.startsWith('data:image/')`),'actual provider favicon');
 for(const theme of ['light','dark']){
  await js(`QuadroTest.setTheme('${theme}')`);await sleep(80);
  assert.equal(await js('getComputedStyle(document.querySelector(".brand img")).filter'),theme==='dark'?'invert(1)':'none');
  await fs.writeFile('mouse-606-ai-'+theme+'.png',(await win.capturePage()).toPNG());
 }
 assert.equal(ai.navigationEpoch||0,epoch);assert.equal(ai.view.webContents.id,wc);
 console.log('MOUSE_COMPACT_AI_PROVIDER_ICON_AND_EXACT_BRAND_PASS');
 await js(`QuadroTest.setTheme(${JSON.stringify(previous.theme)})`);if(!previous.aiOpen)await js('QuadroTest.action("close-ai")');
 // Exercise the genuine Cocoa menu reveal, not a mock DOM menu.
 if(!win.isFullScreen())await new Promise(resolve=>{win.once('enter-full-screen',resolve);win.setFullScreen(true)});
 win.focus();await sleep(150);const d=screen.getDisplayMatching(win.getBounds());
 win.quadroChromeGuard.setTestPoint({x:d.bounds.x+d.bounds.width-120,y:d.bounds.y+1});
 await until(()=>win.quadroChromeGuard.nativeState().menuVisible,'real Apple menu visible');
 const visible=win.quadroChromeGuard.nativeState();assert.equal(visible.appleMenuDisabled,false);assert.equal(visible.menuHidden,false);assert.equal(visible.windowLevel,0);
 win.quadroChromeGuard.sample();await sleep(200);
 assert.ok(Math.abs(await js('document.querySelector(".toolbar").getBoundingClientRect().height')-(40+visible.inset))<=2);
 if(systemPreferences.getMediaAccessStatus('screen')==='granted'){
  const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:d.size.width,height:d.size.height}});const image=sources.find(x=>String(x.display_id)===String(d.id))?.thumbnail;
  if(image&&!image.isEmpty())await fs.writeFile('mouse-606-system-menu.png',image.toPNG());
 }
 await require('./quadro-lifecycle.cjs').leaveFullscreen(win);win.quadroChromeGuard.setTestPoint(null);await sleep(200);
 assert.equal(await js('document.querySelector(".toolbar").getBoundingClientRect().height'),40);
 console.log('MOUSE_NATIVE_APPLE_MENU_AVAILABLE_NO_EXTRA_TITLE_BAND_PASS');
};
