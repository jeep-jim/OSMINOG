'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{screen}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<200;n++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label);}
module.exports=async({win,browser,overlayGate})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 const click=async selector=>{const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(150);};
 const oldWidth=await js('MouseTest.model.libraryWidth');
 const pages=new Map([...browser.tabs.values()].map(t=>[t.id,{id:t.view.webContents.id,epoch:t.navigationEpoch||0}]));
 for(const name of ['history','bookmarks','downloads']){
  await js(`MouseTest.action('${name}')`);await until(()=>js('document.querySelector("#library-dialog").open'),'sidebar '+name);
  assert.equal(overlayGate.blocked,false);assert.equal(await js('document.querySelector("#library-dialog").matches(":modal")'),false);
  await until(async()=>{const x=await js('document.querySelector("#library-dialog").getBoundingClientRect().x');return browser.panels.length>0&&browser.panels.every(p=>p.x+p.width<=x+2)},'native sidebar geometry committed');
  const rect=await js('(()=>{const r=document.querySelector("#library-dialog").getBoundingClientRect();return{x:r.x,right:r.right,width:r.width,height:r.height}})()');
  assert.ok(Math.abs(rect.right-await js('innerWidth'))<2);assert.ok(rect.height>500);
  await until(()=>browser.panels.length>0,'live pages beside sidebar');
  for(const p of browser.panels)assert.ok(p.x+p.width<=rect.x+2,'Native pages cannot cover the library');
  for(const t of browser.tabs.values())if(t.visible){const r=(t.clipView||t.view).getBounds();assert.ok(r.x+r.width<=rect.x+2,'Actual native child must remain left of sidebar');}
  await click('#library-close');await until(()=>js('!document.querySelector("#library-dialog").open'),'sidebar closed');
 }
 await js('MouseTest.action("downloads")');await until(()=>js('document.querySelector("#library-dialog").open'),'resize sidebar');
 const sidebar=await js('(()=>{const d=document.querySelector("#library-dialog"),divider=document.querySelector("#library-divider"),r=divider.getBoundingClientRect();return{open:d.open,modelOpen:MouseTest.model.libraryOpen,aiHidden:document.querySelector("#ai-panel").hidden,dividerVisible:!divider.hidden&&r.width>0&&r.height>0}})()');
 assert.equal(sidebar.open,true,'Library dialog remains open before resizing');assert.equal(sidebar.modelOpen,true,'Open library dialog must retain sidebar state');assert.equal(sidebar.aiHidden,true,'Open library must hide the AI panel');assert.equal(sidebar.dividerVisible,true,'Open library must expose its resize divider');
 const pos=await js('(()=>{const r=document.querySelector("#library-divider").getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()');
 win.webContents.sendInputEvent({type:'mouseMove',...pos});win.webContents.sendInputEvent({type:'mouseDown',...pos,button:'left',clickCount:1});await sleep(100);win.webContents.sendInputEvent({type:'mouseMove',x:pos.x-90,y:pos.y,button:'left'});await sleep(120);win.webContents.sendInputEvent({type:'mouseUp',x:pos.x-90,y:pos.y,button:'left',clickCount:1});await sleep(150);
 assert.ok(await js('MouseTest.model.libraryWidth')>oldWidth+50);await click('#library-close');
 for(const [id,old] of pages){const p=browser.tabs.get(id);assert.equal(p.view.webContents.id,old.id);assert.equal(p.navigationEpoch||0,old.epoch);}
 console.log('MOUSE_RIGHT_LIBRARY_NATIVE_GEOMETRY_RESIZE_NO_RELOAD_PASS');
 await js(`(()=>{const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d');x.fillStyle='#050505';x.fillRect(4,4,16,16);const i=document.createElement('img');i.id='contrast-fixture';i.className='favicon';MouseIcons.watch(i);i.src=c.toDataURL();document.querySelector('#tabstrip').append(i)})()`);
 await until(()=>js('document.querySelector("#contrast-fixture").dataset.ink==="dark"'),'black icon classified');
 for(const theme of ['dark','light']){
  await js(`MouseTest.setTheme('${theme}')`);assert.equal(await js('getComputedStyle(document.querySelector("#contrast-fixture")).filter'),theme==='dark'?'invert(1)':'none');
  await js('MouseTest.action("settings")');await until(async()=>await js('document.querySelector("#settings-dialog").open')&&!overlayGate.blocked,'settings live sidebar');
  const gap=await js('(()=>{const [a,b]=document.querySelectorAll("#settings-dialog .dialog-actions button"),r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return s.top>r.bottom-1?s.top-r.bottom:s.left-r.right})()');assert.ok(gap>=7,'Settings action spacing');
  assert.ok((await js('getComputedStyle(document.querySelector("#settings-dialog")).backdropFilter')).includes('blur'));
  await click('#settings-dialog [data-close-dialog]');
 }
 await js('document.querySelector("#contrast-fixture")?.remove()');
 console.log('MOUSE_DARK_MONOCHROME_ICON_GLASS_SPACING_PASS');
 await js('MouseTest.setTheme("dark")');
 win.setFullScreen(true);await until(()=>win.isFullScreen(),'fullscreen');await sleep(900);
 const g=win.mouseChromeGuard,native=g.nativeState();
 assert.equal(native.menuHidden,false);assert.equal(native.appleMenuDisabled,false);assert.ok(native.mainMenuItems>=5);
 g.sample();await sleep(200);
 const measured=g.nativeState();assert.ok(Math.abs((await js('document.querySelector(".toolbar").getBoundingClientRect().height'))-(40+measured.inset))<=2);
 await require('./mouse-lifecycle.cjs').leaveFullscreen(win);await sleep(700);
 console.log('MOUSE_DYNAMIC_MENU_REVEAL_NO_PERMANENT_BAND_PASS');
 await js('MouseTest.action("bookmarks")');await sleep(150);await fs.writeFile('mouse-605-sidebar-dark.png',(await win.capturePage()).toPNG());await click('#library-close');
};
