'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {screen,nativeImage}=require('electron');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<220;i++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label);}
module.exports=async({win,browser,app,store,globalCapture})=>{
 const js=s=>win.webContents.executeJavaScript(s),oldBounds=win.getBounds();
 const old=await js('JSON.parse(JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,theme:QuadroTest.model.theme,aiOpen:QuadroTest.model.aiOpen,tabOrder:QuadroTest.model.tabOrder}))');
 const created=[];const rect=sel=>js(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()`);
 const send=(type,p)=>win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});
 const click=async sel=>{const r=await rect(sel),p={x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])send(type,p);await sleep(150);};
 const drag=async(a,b)=>{const ra=await rect(a),rb=await rect(b),p={x:Math.round(ra.x+ra.width/2),y:Math.round(ra.y+ra.height/2)},q={x:Math.round(rb.x+rb.width/2),y:Math.round(rb.y+rb.height/2)};win.focus();win.webContents.focus();send('mouseMove',p);send('mouseDown',p);await sleep(60);send('mouseMove',{x:p.x+8,y:p.y});await sleep(100);send('mouseMove',q);await sleep(160);send('mouseUp',q);await sleep(220);};
 try{
  assert.equal(await js('document.querySelector("#status").textContent.includes("Mouse Browser готов")'),false);
  const controls=await js('[...document.querySelector("#footer-right").children].map(e=>e.dataset.action)');assert.deepEqual(controls.slice(0,4),['history','bookmarks','downloads','ai']);
  assert.equal(await js('document.querySelector(".mouse-domain button").textContent'),'mouse.black');
  win.setSize(1050,760);await sleep(250);
  for(let i=0;i<20;i++){await js('QuadroTest.openPage("quadro://start")');created.push(await js('QuadroTest.model.slots[QuadroTest.model.active]'));}
  const fit=await js('(()=>{const s=document.querySelector("#tabstrip"),r=s.getBoundingClientRect(),tabs=[...s.children].map(e=>{const x=e.getBoundingClientRect();return {left:x.left,right:x.right,width:x.width}}),plus=document.querySelector("#new-tab").getBoundingClientRect();return {tabs,left:r.left,right:r.right,client:s.clientWidth,scroll:s.scrollWidth,plus:plus.right,viewport:innerWidth}})()');
  assert.ok(fit.tabs.length>=20);assert.ok(fit.scroll<=fit.client+1);for(const r of fit.tabs){assert.ok(r.width>0);assert.ok(r.left>=fit.left-1&&r.right<=fit.right+1);}assert.ok(fit.plus<=fit.viewport);
  const beforeOrder=await js('QuadroTest.workspaceUI.order()');await drag('.tab-item:first-child .tab-title','.tab-item:nth-child(2) .tab-title');
  const afterOrder=await js('QuadroTest.workspaceUI.order()');assert.equal(afterOrder[0],beforeOrder[1]);assert.equal(afterOrder[1],beforeOrder[0]);
  await js('QuadroTest.save()');assert.deepEqual((await store.get('quadroPreferences')).quadroPreferences.tabOrder,afterOrder);
  const closed=created.splice(0);for(const id of closed)await js(`QuadroNative.browser('close',{id:${JSON.stringify(id)}})`);await until(()=>js(`!QuadroTest.model.state.tabs.some(t=>${JSON.stringify(closed)}.includes(t.id))`),'temporary starts closed');
  await js('QuadroTest.changeLayout(4);QuadroTest.model.aiOpen=true;QuadroTest.applySide()');await sleep(200);
  const slots=await js('JSON.parse(JSON.stringify(QuadroTest.model.slots))'),panes=await js('[...document.querySelectorAll(".pane")].map(p=>p.dataset.pane)');assert.ok(panes.length>=2);
  const refs=new Map([...browser.tabs].map(([id,t])=>[id,t.view]));await drag(`.pane[data-pane="${panes[0]}"] .pane-icon`,`.pane[data-pane="${panes[1]}"] .pane-icon`);
  assert.equal(await js(`QuadroTest.model.slots[${JSON.stringify(panes[0])}]`),slots[panes[1]]||'');assert.equal(await js(`QuadroTest.model.slots[${JSON.stringify(panes[1])}]`),slots[panes[0]]||'');for(const [id,view]of refs)assert.equal(browser.get(id).view,view,'native page must not be replaced');
  const input=`.pane[data-pane="${panes[1]}"] .pane-address input`;await click(input);await sleep(80);
  const address=await rect(input),header=await rect(`.pane[data-pane="${panes[1]}"] .pane-head`);assert.ok(address.width>=header.width-12,'focused URL fills its header');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESC'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESC'});await sleep(100);assert.equal(await js('document.querySelectorAll(".address-editing").length'),0);
  for(const theme of ['light','dark']){
   await js(`QuadroTest.setTheme('${theme}');QuadroTest.applySide()`);await sleep(140);
   const ai=await rect('.ai-controls'),pane=await rect('.pane-head');assert.equal(ai.height,pane.height);
   const icon=await rect('#ai-provider-icon');assert.ok(icon.width<=16&&icon.height<=16);
   await js('document.querySelector("#ai-select").value="https://chatgpt.com/";QuadroTest.overlays.choose(document.querySelector("#ai-select"))');await until(()=>js('document.querySelector("#choice-dialog").open'),'AI options open');
   const chosen=await js('(()=>{const b=document.querySelector("#choice-dialog [aria-selected=true]");return{value:b?.dataset.value,check:b&&getComputedStyle(b,"::after").content,count:document.querySelectorAll("#choice-dialog [aria-selected=true]").length}})()');
   assert.equal(chosen.value,'https://chatgpt.com/');assert.equal(chosen.count,1);assert.equal(chosen.check,'"✓"');
   await fs.writeFile('mouse-613-ui-'+theme+'.png',(await win.capturePage()).toPNG());await js('document.querySelector("#choice-dialog").close();QuadroTest.renderAISites()');await sleep(100);
  }
  const png=await js(`(()=>{const c=document.createElement('canvas');c.width=3456;c.height=2234;const x=c.getContext('2d');x.fillStyle='#eee';x.fillRect(0,0,c.width,c.height);for(const [px,py,color]of [[0,0,'#ff0000'],[3392,0,'#00ff00'],[0,2170,'#0000ff'],[3392,2170,'#ff00ff']]){x.fillStyle=color;x.fillRect(px,py,64,64);}return c.toDataURL('image/png')})()`);
  globalCapture.testFrame={base:png,width:1728,height:1117,layers:[],kind:'screen'};
  await js('QuadroTest.action("screenshot")');await until(()=>globalCapture.editor&&!globalCapture.busy,'toolbar opens full-display editor');const editor=globalCapture.editor,ej=s=>editor.webContents.executeJavaScript(s);await sleep(250);
  const geometry=await ej('(()=>{const c=document.querySelector("#capture-canvas"),s=document.querySelector(".capture-stage"),r=c.getBoundingClientRect(),a=s.getBoundingClientRect();return {w:c.width,h:c.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom,sl:a.left,st:a.top,sr:a.right,sb:a.bottom}})()');assert.equal(geometry.w,3456);assert.equal(geometry.h,2234);assert.ok(geometry.left>=geometry.sl&&geometry.top>=geometry.st&&geometry.right<=geometry.sr+1&&geometry.bottom<=geometry.sb+1,'all four edges visible');
  const data=await ej('QuadroCaptureTest.test.getCanvas().toDataURL("image/png")');assert.ok(nativeImage.createFromDataURL(png).toBitmap().equals(nativeImage.createFromDataURL(data).toBitmap()),'preview must not crop or rescale saved pixels');
  await fs.writeFile('mouse-613-full-display-editor.png',(await editor.capturePage()).toPNG());editor.close();await until(()=>!globalCapture.editor,'close full editor');globalCapture.testFrame=null;
  const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());assert.equal(globalCapture.permission(),'granted','real display checks require granted CI permission');
  for(const [name,frame]of [['legacy',await globalCapture.acquire(display)],['native',await globalCapture.nativeCapture.capture(Number(display.id),false)]]){
   const size=nativeImage.createFromDataURL(frame.base).getSize();assert.ok(Math.abs(size.width/size.height-display.bounds.width/display.bounds.height)<.004);assert.equal(frame.width,display.bounds.width);assert.equal(frame.height,display.bounds.height);await fs.writeFile('mouse-613-entire-screen-'+name+'.png',nativeImage.createFromDataURL(frame.base).toPNG());
  }
  console.log('MOUSE_613_WORKSPACE_AND_FULL_SCREEN_PASS');
 }finally{
  globalCapture.testFrame=null;if(globalCapture.editor&&!globalCapture.editor.isDestroyed())globalCapture.editor.close();
  for(const id of created)await js(`QuadroNative.browser('close',{id:${JSON.stringify(id)}})`).catch(()=>{});
  await js(`document.querySelector('#choice-dialog').close();Object.assign(QuadroTest.model,${JSON.stringify(old)});QuadroTest.setTheme(${JSON.stringify(old.theme)});QuadroTest.renderTree();QuadroTest.applySide();QuadroTest.save()`);win.setBounds(oldBounds);
 }
};
