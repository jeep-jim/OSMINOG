'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<240;i++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label)}
module.exports=async({app,win,browser,globalCapture,paneFocus})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 async function transition(event,action,label){
  let emitted=false;const mark=()=>{emitted=true;};win.on(event,mark);
  try{await action();await until(()=>emitted,label+' native event');await until(()=>win.isFullScreen()===(event==='enter-full-screen'),label+' native state');if(event==='leave-full-screen')await until(()=>!paneFocus.returnState&&!paneFocus.exitRequested,label+' focus frame restored');console.log('MOUSE_608_TRANSITION',JSON.stringify({label,event,bounds:win.getBounds(),active:paneFocus.active,pending:!!paneFocus.returnState,exitRequested:paneFocus.exitRequested}));}
  finally{win.removeListener(event,mark);}
 }

 const previous=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,aiOpen:MouseTest.model.aiOpen}))');
 const full=win.isFullScreen();if(full)await transition('leave-full-screen',()=>win.setFullScreen(false),'exit initial fullscreen');
 await js('MouseTest.changeLayout(4)');await sleep(200);
 const saved=await js('JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots})');
 const ids=[...browser.tabs.values()].filter(t=>t.visible).map(t=>[t.id,t.view.webContents.id]);
 const click=async selector=>{const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});};
 await transition('enter-full-screen',()=>click('[data-pane=p2] [data-pane-action=fullscreen]'),'focused pane');assert.equal(paneFocus.active,true);
 assert.equal(await js('document.querySelectorAll(".pane").length'),1);assert.equal(await js('MouseTest.model.focusPane'),'p2');
 await sleep(300);assert.equal([...browser.tabs.values()].filter(t=>t.visible).length,1);
 assert.equal(await js('JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots})'),saved);
 await transition('leave-full-screen',()=>click('[data-pane-action=fullscreen]'),'restore native mode');assert.equal(paneFocus.active,false);
 assert.equal(await js('document.querySelectorAll(".pane").length'),4);assert.equal(await js('JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots})'),saved);
 for(const [id,wcid] of ids)assert.equal(browser.get(id).view.webContents.id,wcid,'no page recreated');
 await transition('enter-full-screen',()=>win.setFullScreen(true),'preexisting fullscreen');await js('MouseTest.togglePaneFullscreen("p1")');await sleep(150);paneFocus.leave();await sleep(150);assert.equal(win.isFullScreen(),true,'restore pane must keep preexisting fullscreen');
 await transition('leave-full-screen',()=>win.setFullScreen(false),'final exit');
 await js(`Object.assign(MouseTest.model,${JSON.stringify(previous)});MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);
 if(full)await transition('enter-full-screen',()=>win.setFullScreen(true),'restore initial fullscreen');
 const native=globalCapture.nativeCapture;assert.ok(native&&native.status().pickerAvailable,'native ScreenCaptureKit module loaded');
 // Real display capture only with pre-existing permission; never fake a user picker choice.
 if(native.status().granted){const display=require('electron').screen.getPrimaryDisplay(),frame=await native.capture(Number(display.id),false);assert.equal(frame.backend,'ScreenCaptureKit');require('./mouse-shell.cjs').pngBuffer(frame.base);console.log('MOUSE_608_NATIVE_SCK_STILL_CAPTURE_PASS');}else console.log('MOUSE_608_NATIVE_SCK_PICKER_REQUIRES_USER_NOT_AUTOMATED');
 console.log('MOUSE_608_PANE_FULLSCREEN_RESTORE_NO_RELOAD_PASS');
 await fs.writeFile('mouse-608-layout-verified.png',(await win.capturePage()).toPNG());
};
