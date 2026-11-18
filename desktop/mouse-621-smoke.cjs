'use strict';
// Actual packaged macOS workspace, shell gestures and CGEvent PNG transfer.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http');
const {screen}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,n=160){for(let i=0;i<n;i++){if(await fn())return;await sleep(60)}throw Error('Mouse621 timeout: '+label)}
module.exports=async({app,win,browser,store})=>{
 const js=s=>win.webContents.executeJavaScript(s),native=require('./mouse-native-menu.node'),before=new Set(browser.tabs.keys()),original=await js('MouseTest.prefs()'),bounds=win.getBounds();let server,debugAttached=false,lastClick=null;const made=[];
 async function activate(){
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();await sleep(100);
  if(!win.isFocused()){
   // A visible app can still be inactive after the system Character Viewer.
   // Use a genuine focus click in empty chrome, never synthesize a target action.
   const p=await js(`(()=>{const bar=document.querySelector('#statusbar'),r=bar.getBoundingClientRect(),y=r.y+r.height/2;for(let x=r.x+8;x<r.right-8;x+=4){const e=document.elementFromPoint(x,y);if(e&&bar.contains(e)&&!e.closest('button,a,input,select,label'))return{x,y};}throw Error('No empty footer area for native activation');})()`),o=win.getContentBounds();
   assert.equal(native.testClick(Math.round(o.x+p.x),Math.round(o.y+p.y)),true);await sleep(160);win.focus();win.webContents.focus();
  }
  await until(()=>win.isFocused(),'focused Electron native window');
  console.log('MOUSE_621_NATIVE_ACTIVATION',JSON.stringify({focused:win.isFocused(),focusable:win.isFocusable(),native:native.state()}));
 }
 async function burrowSettled(){await until(()=>js(`(()=>{const tray=document.querySelector('#desktop-tray'),state=globalThis.MouseTest?.desktopUI?.motion?.state?.();return !state?.animating&&!['opening','closing'].includes(tray?.dataset.motion)&&tray?.dataset.heightMoving!=='true';})()`),'burrow motion and height transition settle');}
 async function click(sel){await activate();await burrowSettled();const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}),r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Invisible '+${JSON.stringify(sel)});const x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw Error('Covered '+${JSON.stringify(sel)});return{x,y}})()`),o=win.getContentBounds(),point={x:Math.round(o.x+p.x),y:Math.round(o.y+p.y)},area=screen.getDisplayNearestPoint(point).bounds;lastClick={sel,point,area,window:win.getBounds(),native:native.state()};assert.ok(point.x>=area.x&&point.y>=area.y&&point.x<area.x+area.width&&point.y<area.y+area.height,'Native click must be on screen: '+JSON.stringify(lastClick));assert.equal(native.testClick(point.x,point.y),true);await sleep(160)}
 async function png(){return Buffer.from(await js(`(()=>{const c=document.createElement('canvas');c.width=100;c.height=80;const x=c.getContext('2d');x.fillStyle='#32c76a';x.fillRect(0,0,100,80);return c.toDataURL('image/png').split(',')[1]})()`),'base64')}
 try{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave full screen');await sleep(350)}
  const work=screen.getPrimaryDisplay().workArea;win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1200,work.width-16),height:Math.min(800,work.height-16)});await activate();await sleep(250);await js('MouseTest.browsing.close();MouseTest.feedback.hide()');
  console.log('MOUSE_621_ONSCREEN_NATIVE_FIXTURE',JSON.stringify({work,window:win.getBounds()}));
  const image=await png();server=http.createServer((req,res)=>{if(req.url==='/image.png'){res.setHeader('Content-Type','image/png');res.end(image);return;}res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>621 fixture</title><style>body{margin:0;background:#f0f0f0;color:#111}img{margin:30px;width:100px;height:80px}#drop{height:160px;margin:20px;background:#cfe5d0}</style><input id="kept" value="keep621"><img id="image" src="/image.png" draggable="true"><div id="drop">Drop PNG here</div><script>window.marker=Math.random();window.dropped=null;document.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'});document.addEventListener('drop',async e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)window.dropped={name:f.name,type:f.type,size:f.size,bytes:[...new Uint8Array(await f.arrayBuffer())].slice(0,8)}});</script>`)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
  const initial=await js('MouseTest.model.state.desktops');assert.equal(initial.items.length,5);assert.equal(initial.active,'desk-3');
  const current=original.desktopId;
  await js(`MouseTest.openPage(${JSON.stringify(root+'/one')})`);const a=await js('MouseTest.model.slots[MouseTest.model.active]');made.push({id:a,desk:current});await until(()=>!browser.get(a).loading,'first page');const aw=browser.get(a).view.webContents,identity=aw.id,marker=await aw.executeJavaScript('window.marker');
  await js('MouseTest.changeLayout(2);MouseTest.model.slots.p1='+JSON.stringify(a)+';MouseTest.model.active="p1";MouseTest.renderTree();MouseTest.save()');
  // The CI desktop can prefer reduced motion. Exercise the real native slide under
  // explicit no-preference emulation, then restore media settings, not OS defaults.
  const debug=win.webContents.debugger;assert.equal(debug.isAttached(),false);debug.attach('1.3');debugAttached=true;
  await debug.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  assert.equal(await js('matchMedia("(prefers-reduced-motion:reduce)").matches'),false);
  await until(async()=>{const w=await js('Math.round(document.querySelector(".pane[data-pane=p1] .page-slot").getBoundingClientRect().width)');return browser.get(a).visible&&browser.get(a).view.getBounds().width===w;},'native viewport before slide');
  const rawLayout=browser.layout.bind(browser),viewport=browser.get(a).view.getBounds(),frames=[];
  browser.layout=panels=>{const value=rawLayout(panels),p=panels.find(p=>p.id===a);if(p&&browser.get(a).visible)frames.push({x:p.x,width:browser.get(a).view.getBounds().width});return value;};
  try{await js(`MouseTest.switchDesktop('desk-1')`);}finally{browser.layout=rawLayout;await debug.sendCommand('Emulation.setEmulatedMedia',{media:'',features:[]});debug.detach();debugAttached=false;}
  assert.ok(new Set(frames.map(f=>Math.round(f.x))).size>=3,'actual native positions must animate: '+JSON.stringify(frames));assert.ok(frames.every(f=>f.width===viewport.width),'page viewport stays unchanged during slide: '+JSON.stringify({viewport,frames}));
  assert.equal(await js('document.querySelector("#workspace").style.transform'),'');console.log('MOUSE_621_SMOOTH_DESKTOP_NATIVE_SLIDE_PASS',JSON.stringify({frames:frames.length,viewport:viewport.width,preference:'emulated-no-preference'}));assert.equal(browser.state().tabs.length,0);assert.equal(browser.get(a).visible,false);
  await js(`MouseTest.openPage(${JSON.stringify(root+'/two')})`);const b=await js('MouseTest.model.slots[MouseTest.model.active]');made.push({id:b,desk:'desk-1'});await until(()=>!browser.get(b).loading,'second page');const bw=browser.get(b).view.webContents;
  await aw.executeJavaScript('document.title="(3) Telegram fixture"');await until(()=>js('MouseTest.model.state.desktops.items.find(d=>d.id==="desk-3").unread===3'),'actual hidden title badge');
  await click('#desktops-button');await until(()=>js('!document.querySelector("#desktop-tray").hidden'),'tray visible');assert.equal(await js('document.querySelectorAll(".desktop-card").length'),5);assert.equal(await js('document.querySelector("[data-desk=desk-3] .desk-badge").textContent'),'3');
  await click('[data-desk=desk-3] .desk-open');await until(()=>js('MouseTest.model.desktopId==="desk-3"&&!MouseTest.model.switching'),'native desktop click');assert.equal(aw.id,identity);assert.equal(await aw.executeJavaScript('window.marker'),marker);assert.equal(await aw.executeJavaScript('document.querySelector("#kept").value'),'keep621');assert.equal(await js('MouseLayout.leaves(MouseTest.model.tree).length'),2);
  await js(`MouseTest.switchDesktop('desk-1')`);assert.equal(browser.state().tabs.length,1);assert.equal(browser.state().tabs[0].id,b);assert.equal(browser.get(a).visible,false);
  await js(`MouseNative.zoom('set',{factor:1.35})`);assert.ok(Math.abs(aw.getZoomFactor()-1.35)<.001);assert.ok(Math.abs(bw.getZoomFactor()-1.35)<.001);
  await js(`MouseTest.openPage(${JSON.stringify(root+'/newzoom')})`);const z=await js('MouseTest.model.slots[MouseTest.model.active]');made.push({id:z,desk:'desk-1'});await until(()=>!browser.get(z).loading,'new zoom page');assert.ok(Math.abs(browser.get(z).view.webContents.getZoomFactor()-1.35)<.001);await js("MouseNative.zoom('set',{factor:1})");
  await js(`MouseTest.switchDesktop(${JSON.stringify(current)})`);
  // A retained second page on the SAME desk is the native file-drop target.
  await js(`MouseTest.openPage(${JSON.stringify(root+'/drop')})`);const dest=await js('MouseTest.model.slots[MouseTest.model.active]');made.push({id:dest,desk:current});await until(()=>!browser.get(dest).loading,'destination loaded');await js(`MouseTest.model.slots={p1:${JSON.stringify(a)},p2:${JSON.stringify(dest)}};MouseTest.model.active='p1';MouseTest.renderTree();MouseTest.model.aiOpen=false;MouseTest.applySide()`);await until(()=>browser.panels.length===2,'two actual native pages');
  const dw=browser.get(dest).view.webContents;await aw.executeJavaScript('document.querySelector("#image").decode()');
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").open&&!document.querySelector("#desktop-tray").hidden'),'paint-ready desktop dialog');await burrowSettled();await sleep(180);await fs.writeFile('mouse-621-desktops-'+theme+'.png',(await win.capturePage()).toPNG());await click('#desks-close');
   await js(`MouseTest.feedback.show('621 transient fixture ${theme}')`);const geometry=await js(`(()=>{const e=document.querySelector('#status'),r=e.getBoundingClientRect();return{inFooter:!!document.querySelector('#statusbar #status'),x:r.x+r.width/2,width:innerWidth,hidden:e.hidden,paint:getComputedStyle(e).display,boxWidth:r.width}})()`);assert.equal(geometry.inFooter,false);assert.equal(geometry.hidden,false);assert.notEqual(geometry.paint,'none');assert.ok(geometry.boxWidth>0);assert.ok(Math.abs(geometry.x-geometry.width/2)<1);
   await fs.writeFile('mouse-621-toast-'+theme+'.png',(await win.capturePage()).toPNG());await js('MouseTest.feedback.hide()');await click('#global-zoom-button');await until(()=>js('document.querySelector("#global-zoom-panel").open&&!document.querySelector("#global-zoom-panel").hidden'),'paint-ready zoom dialog');await sleep(120);await fs.writeFile('mouse-621-zoom-'+theme+'.png',(await win.capturePage()).toPNG());await js('MouseTest.zoomUI.close()');
  }
  await js("MouseTest.feedback.show('621 expiration fixture')");await sleep(2600);await js("MouseTest.feedback.show('621 expiration fixture')");await sleep(2200);assert.equal(await js('document.querySelector("#status").hidden'),true,'repeat must not extend the lifetime');
  await js('MouseTest.browsing.open("history")');await until(()=>js('document.querySelector("#library-count").textContent.includes(" · История")'),'section label after count');await js('MouseTest.browsing.close();MouseTest.feedback.hide()');
  // Actual annotation gestures, keyboard nudges, undo and palette toggling.
  await click('#screenshot-button');await until(()=>js('MouseTest.capture.isOpen()'),'capture editor');await click('#capture-all');assert.equal(await js('document.querySelector("#capture-color").value'),'#32c76a');
  await click('#capture-color');assert.equal(await js('document.querySelector("#capture-palette").hidden'),false);await click('#capture-color');assert.equal(await js('document.querySelector("#capture-palette").hidden'),true);
  await click('[data-tool=rect]');const rect=await js('(()=>{const r=document.querySelector("#capture-canvas").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()');const x=Math.round(rect.x+40),y=Math.round(rect.y+40);
  const send=(type,px,py)=>win.webContents.sendInputEvent({type,x:px,y:py,button:'left',clickCount:1});send('mouseDown',x,y);send('mouseMove',x+65,y+50);send('mouseUp',x+65,y+50);await sleep(80);
  const op=await js('MouseTest.capture.test.getOps()[0]');assert.equal(op.color,'#32c76a');await click('[data-tool=move]');send('mouseDown',x+25,y+25);send('mouseMove',x+45,y+45);send('mouseUp',x+45,y+45);await sleep(70);assert.equal(await js('MouseTest.capture.test.getSelected()'),0);const moved=await js('MouseTest.capture.test.getOps()[0]');assert.ok(moved.points[0].x>op.points[0].x);win.webContents.sendInputEvent({type:'keyDown',keyCode:'Right',modifiers:['shift']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Right',modifiers:['shift']});await sleep(70);assert.equal((await js('MouseTest.capture.test.getOps()[0]')).points[0].x,moved.points[0].x+10);await click('#capture-undo');assert.deepEqual(await js('MouseTest.capture.test.getOps()[0]'),moved);await click('#capture-redo');await fs.writeFile('mouse-621-annotation-select.png',(await win.capturePage()).toPNG());await click('#capture-close');await until(()=>browser.panels.length===2,'restore pages');
  // Genuine OS mouse gesture -> source preload -> PNG tempfile -> other Chromium page.
  await js('MouseTest.feedback.hide();MouseTest.requestLayout()');await sleep(150);await activate();
  const img=await aw.executeJavaScript('(()=>{const r=document.querySelector("#image").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()'),drop=await dw.executeJavaScript('(()=>{const r=document.querySelector("#drop").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()'),origin=win.getContentBounds(),ab=browser.get(a).bounds,db=browser.get(dest).bounds;
  const sx=origin.x+ab.x+img.x,sy=origin.y+ab.y+img.y,dx=origin.x+db.x+drop.x,dy=origin.y+db.y+drop.y;
  assert.equal(native.testMouse(sx,sy,0),true);await sleep(100);native.testMouse(sx+14,sy+7,1);await sleep(800);for(let i=1;i<=12;i++){native.testMouse(sx+(dx-sx)*i/12,sy+(dy-sy)*i/12,1);await sleep(35)}await sleep(250);native.testMouse(dx,dy,2);
  await until(()=>dw.executeJavaScript('!!window.dropped'),'native image file received');const file=await dw.executeJavaScript('window.dropped');assert.equal(file.type,'image/png');assert.ok(file.size>50);assert.deepEqual(file.bytes,[137,80,78,71,13,10,26,10]);console.log('MOUSE_621_NATIVE_CROSS_PAGE_PNG_DRAG_PASS',JSON.stringify(file));
  await js(`MouseTest.switchDesktop('desk-1')`);await js('MouseTest.save()');await browser.save();await store.queue;const bank=(await store.get('mouseDesktopsV1')).mouseDesktopsV1;assert.equal(bank.members[a],current);assert.equal(bank.members[b],'desk-1');await js(`MouseTest.switchDesktop(${JSON.stringify(current)})`);
  console.log('MOUSE_621_DESKTOPS_TOASTS_ZOOM_EDITOR_PASS');
 }catch(error){
  console.log('MOUSE_621_FAILURE_CONTEXT',JSON.stringify({lastClick,window:win.getBounds(),focused:win.isFocused(),focusable:win.isFocusable(),native:native.state(),screen:screen.getPrimaryDisplay().bounds,shell:await js('({desk:MouseTest.model.desktopId,switching:MouseTest.model.switching,sliding:MouseTest.model.desktopSliding,trayHidden:document.querySelector("#desktop-tray").hidden,active:document.activeElement?.id})')}));
  await fs.writeFile('mouse-621-failure.png',(await win.capturePage()).toPNG());throw error;
 }finally{
  if(debugAttached){await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'',features:[]}).catch(()=>{});win.webContents.debugger.detach();}
  try{const o=win.getContentBounds();native.testMouse(o.x+10,o.y+60,2);}catch{}
  await js('document.querySelector("#capture-dialog")?.open&&document.querySelector("#capture-dialog").close();MouseTest.desktopUI.close();MouseTest.zoomUI.close();MouseTest.feedback.hide();MouseTest.browsing.close();MouseNative.zoom("set",{factor:1})').catch(()=>{});
  for(const {id,desk}of made){await js(`MouseTest.switchDesktop(${JSON.stringify(desk)})`).catch(()=>{});if(browser.tabs.has(id))await browser.command('close',{id});}
  await js(`MouseTest.switchDesktop(${JSON.stringify(original.desktopId)})`);await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);await browser.save();await store.queue;win.setBounds(bounds);server?.close();
 }
};