'use strict';
// OS events must come from a separate process: AppKit's native window-drag
// tracking loop may suspend the host's JavaScript until mouse-up arrives.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {spawn}=require('node:child_process'),{screen}=require('electron');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<160;i++){if(await fn())return;await sleep(40);}throw Error('Mouse627 window timeout: '+label);}
module.exports=async({app,win})=>{
 assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);
 const js=code=>win.webContents.executeJavaScript(code),native=require('./mouse-native-menu.node');
 const driverModule=require.resolve('./mouse-native-menu.node').replace('app.asar/','app.asar.unpacked/');
 const originalBounds=win.getBounds(),originalTheme=await js('MouseTest.prefs().theme'),wasFullscreen=win.isFullScreen();
 const evidence={version:app.getVersion(),gestures:[],controls:[],restored:false};
 async function focus(){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await until(()=>win.isFocused(),'foreground window');}
 async function point(selector){return js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,visible:r.width>0&&r.height>0,hit:e.contains(document.elementFromPoint(x,y)),region:getComputedStyle(e).webkitAppRegion};})()`);}
 async function click(selector){await focus();const p=await point(selector);assert.ok(p.visible&&p.hit,'Uncovered native control '+selector);assert.equal(p.region,'no-drag',selector+' accepts clicks');const o=win.getContentBounds();native.testClick(Math.round(o.x+p.x),Math.round(o.y+p.y));await sleep(100);}
 async function gesture(label,p,dx=36,dy=24){
  await focus();const before=win.getBounds(),o=win.getContentBounds(),a={x:Math.round(o.x+p.x),y:Math.round(o.y+p.y)};
  evidence.activeGesture={label,point:p,before,requested:{dx,dy}};
  const script=`const n=require(${JSON.stringify(driverModule)});const sleep=ms=>new Promise(r=>setTimeout(r,ms));(async()=>{const a=${JSON.stringify(a)};await sleep(80);n.testMouse(a.x,a.y,0);try{await sleep(100);for(let i=1;i<=12;i++){n.testMouse(a.x+${dx}*i/12,a.y+${dy}*i/12,1);await sleep(22);}}finally{n.testMouse(a.x+${dx},a.y+${dy},2);}})().catch(e=>{console.error(e);process.exitCode=1});`;
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['-e',script,'--','--mouse-smoke-write'],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Native gesture subprocess '+code+': '+output)));});
  await until(()=>Math.abs(win.getBounds().x-before.x-dx)<=2&&Math.abs(win.getBounds().y-before.y-dy)<=2,label+' translates the window');
  const after=win.getBounds();assert.equal(after.width,before.width,label+' does not resize width');assert.equal(after.height,before.height,label+' does not resize height');
  evidence.gestures.push({label,point:p,before,after,requested:{dx,dy}});delete evidence.activeGesture;win.setBounds(before);await sleep(70);
 }
 try{
  if(wasFullscreen)await require('./mouse-lifecycle.cjs').leaveFullscreen(win);
  const area=screen.getDisplayMatching(win.getBounds()).workArea;
  win.setBounds({x:area.x+40,y:area.y+40,width:Math.min(1440,area.width-120),height:Math.min(800,area.height-120)});await sleep(200);
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await sleep(80);
   const points=await js(`(()=>{const rect=id=>document.querySelector(id).getBoundingClientRect(),bar=rect('#statusbar'),left=rect('#footer-left'),right=rect('#footer-right'),nora=rect('#desktops-button'),top=rect('.mouse-window-drag-handle');return{region:getComputedStyle(document.querySelector('#statusbar')).webkitAppRegion,left:{x:(left.right+nora.left)/2,y:bar.y+bar.height/2,width:nora.left-left.right},right:{x:(nora.right+right.left)/2,y:bar.y+bar.height/2,width:right.left-nora.right},top:{x:top.x+top.width/2,y:top.y+top.height/2}};})()`);
   assert.equal(points.region,'drag');assert.ok(points.left.width>8&&points.right.width>8,'Both empty footer regions are available');
   await gesture(theme+' footer left',points.left);await gesture(theme+' footer right',points.right);await gesture(theme+' top grip',points.top);
   const before=win.getBounds();await click('[data-action="theme"]');await until(()=>js(`MouseTest.prefs().theme!==${JSON.stringify(theme)}`),'theme responds to a real click');assert.deepEqual(win.getBounds(),before);evidence.controls.push(theme+' theme');
   await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'Nora responds to a real click');await click('#desks-close');await until(()=>js('document.querySelector("#desktop-tray").hidden'),'Nora closes');assert.deepEqual(win.getBounds(),before);evidence.controls.push(theme+' Nora');
   await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);await fs.writeFile('mouse-627-window-'+theme+'.png',(await win.capturePage()).toPNG());
  }
 }finally{
  if(evidence.activeGesture)evidence.activeGesture.after=win.getBounds();win.setBounds(originalBounds);await js(`MouseTest.setTheme(${JSON.stringify(originalTheme)})`);if(wasFullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'restore fullscreen');}
  evidence.restored=true;await fs.writeFile('mouse-627-window-verification.json',JSON.stringify(evidence,null,2)+'\n');
 }
 assert.equal(evidence.gestures.length,6);assert.equal(evidence.controls.length,4);console.log('MOUSE_627_NATIVE_WINDOW_FOOTER_DRAG_PASS');
};
