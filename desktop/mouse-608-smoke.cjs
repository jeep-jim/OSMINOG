'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<240;i++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label)}
module.exports=async({app,win,browser,globalCapture,paneFocus})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 const previous=await js('JSON.parse(JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,aiOpen:QuadroTest.model.aiOpen}))');
 const full=win.isFullScreen();if(full){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'exit initial fullscreen');}
 await js('QuadroTest.changeLayout(4)');await sleep(200);
 const saved=await js('JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots})');
 const ids=[...browser.tabs.values()].filter(t=>t.visible).map(t=>[t.id,t.view.webContents.id]);
 const click=async selector=>{const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});};
 await click('[data-pane=p2] [data-pane-action=fullscreen]');await until(()=>win.isFullScreen()&&paneFocus.active,'focused pane native fullscreen');
 assert.equal(await js('document.querySelectorAll(".pane").length'),1);assert.equal(await js('QuadroTest.model.focusPane'),'p2');
 await sleep(300);assert.equal([...browser.tabs.values()].filter(t=>t.visible).length,1);
 assert.equal(await js('JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots})'),saved);
 await click('[data-pane-action=fullscreen]');await until(()=>!win.isFullScreen()&&!paneFocus.active,'restore native mode');
 assert.equal(await js('document.querySelectorAll(".pane").length'),4);assert.equal(await js('JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots})'),saved);
 for(const [id,wcid] of ids)assert.equal(browser.get(id).view.webContents.id,wcid,'no page recreated');
 win.setFullScreen(true);await until(()=>win.isFullScreen(),'preexisting fullscreen');await js('QuadroTest.togglePaneFullscreen("p1")');await sleep(150);paneFocus.leave();await sleep(150);assert.equal(win.isFullScreen(),true,'restore pane must keep preexisting fullscreen');
 win.setFullScreen(false);await until(()=>!win.isFullScreen(),'final exit');
 await js(`Object.assign(QuadroTest.model,${JSON.stringify(previous)});QuadroTest.renderTree();QuadroTest.applySide();QuadroTest.save()`);
 if(full)win.setFullScreen(true);
 const native=globalCapture.nativeCapture;assert.ok(native&&native.status().pickerAvailable,'native ScreenCaptureKit module loaded');
 // Real display capture only with pre-existing permission; never fake a user picker choice.
 if(native.status().granted){const display=require('electron').screen.getPrimaryDisplay(),frame=await native.capture(Number(display.id),false);assert.equal(frame.backend,'ScreenCaptureKit');require('./quadro-shell.cjs').pngBuffer(frame.base);console.log('MOUSE_608_NATIVE_SCK_STILL_CAPTURE_PASS');}else console.log('MOUSE_608_NATIVE_SCK_PICKER_REQUIRES_USER_NOT_AUTOMATED');
 console.log('MOUSE_608_PANE_FULLSCREEN_RESTORE_NO_RELOAD_PASS');
 await fs.writeFile('mouse-608-layout-verified.png',(await win.capturePage()).toPNG());
};
