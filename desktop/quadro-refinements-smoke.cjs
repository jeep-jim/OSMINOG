'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {clipboard,nativeImage,dialog,app}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await sleep(50)}throw Error('Timed out '+label)}
module.exports=async({win,browser,store})=>{
 const js=code=>win.webContents.executeJavaScript(code);
 await until(()=>js("[...document.querySelectorAll('.tab-item .favicon')].some(e=>e.src.startsWith('data:image/png')&&e.naturalWidth>0)"),'real favicon');
 assert.ok(await js("[...document.querySelectorAll('.pane-icon .favicon')].some(e=>e.src.startsWith('data:image/png'))"));
 await js('QuadroTest.setLocale("en")');await sleep(100);assert.equal(await js('document.querySelector("[data-action=wallet]").textContent'),'Wallet');
 await js('QuadroTest.setLocale("ru")');await sleep(100);assert.equal(await js('document.querySelector("[data-action=wallet]").textContent'),'Кошелёк');
 console.log('QUADRO_FAVICONS_LOCALE_PASS');
 const page=[...browser.tabs.values()].find(t=>t.visible&&t.lane!=='side');page.view.webContents.focus();
 page.view.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']});page.view.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['control']});
 await until(()=>js('QuadroTest.capture.isOpen()'),'Control+A screenshot');
 assert.ok(browser.panels.length===0,'Native pages hidden behind editor');
 assert.ok(await js('QuadroTest.capture.test.getFull().width>800'));
 async function drag(ax,ay,bx,by){const r=await js(`(()=>{const r=document.querySelector('#capture-canvas').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);const point=(x,y)=>({x:Math.round(r.x+x*r.w),y:Math.round(r.y+y*r.h)});const a=point(ax,ay),b=point(bx,by);win.webContents.sendInputEvent({type:'mouseMove',...a});win.webContents.sendInputEvent({type:'mouseDown',...a,button:'left',clickCount:1});await sleep(60);win.webContents.sendInputEvent({type:'mouseMove',...b,button:'left'});await sleep(80);win.webContents.sendInputEvent({type:'mouseUp',...b,button:'left',clickCount:1});await sleep(100)}
 const full=await js('QuadroTest.capture.test.getFull().width');await drag(.07,.08,.9,.9);assert.ok(await js('QuadroTest.capture.test.getCanvas().width')<full);
 for(const tool of ['arrow','line','rect','ellipse','pencil','marker']){await js(`document.querySelector('[data-tool=${tool}]').click()`);await drag(.15,.18,.65,.65)}
 await js("document.querySelector('[data-tool=text]').click();document.querySelector('#capture-text').value='Тест текста';document.querySelector('#capture-color').value='#00aa55'");await drag(.2,.7,.2,.7);
 assert.equal(await js('QuadroTest.capture.test.getOps().length'),7);
 await js('document.querySelector("#capture-undo").click()');assert.equal(await js('QuadroTest.capture.test.getOps().length'),6);await js('document.querySelector("#capture-redo").click()');assert.equal(await js('QuadroTest.capture.test.getOps().length'),7);
 const png=await js('QuadroTest.capture.test.getCanvas().toDataURL("image/png")');
 await js('QuadroTest.capture.test.exportImage("copy")');assert.ok(clipboard.readImage().getBitmap().equals(nativeImage.createFromDataURL(png).getBitmap()));
 const file=path.join(app.getPath('userData'),'screenshot-native-test.png'),original=dialog.showSaveDialog;
 dialog.showSaveDialog=async()=>({canceled:false,filePath:file});try{await js('QuadroTest.capture.test.exportImage("save")')}finally{dialog.showSaveDialog=original}
 assert.ok((await fs.readFile(file)).equals(Buffer.from(png.split(',')[1],'base64')));
 await fs.writeFile('quadro-screenshot-editor.png',(await win.capturePage()).toPNG());
 await js('document.querySelector("#capture-close").click()');await until(()=>browser.panels.length>1,'native panes restored');
 await js('document.querySelector(".pane.active input").focus();document.querySelector(".pane.active input").value="select-all-test"');
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['meta']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['meta']});await sleep(100);
 assert.equal(await js('QuadroTest.capture.isOpen()'),false);assert.equal(await js('document.activeElement.selectionStart'),0);assert.equal(await js('document.activeElement.selectionEnd'),15);
 console.log('QUADRO_CAPTURE_REGION_TOOLS_CLIPBOARD_SAVE_SHORTCUT_PASS');
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('fullscreen timeout')),10000);win.once('enter-full-screen',()=>{clearTimeout(timeout);resolve()});win.setFullScreen(true)});await sleep(150);
 const y=await js("document.querySelector('.traffic-space button').getBoundingClientRect().y");assert.ok(y>=32,'Dots below macOS menu overlay');
 await require('./quadro-lifecycle.cjs').leaveFullscreen(win);await sleep(200);
 console.log('QUADRO_FULLSCREEN_CONTROL_SAFE_INSET_PASS');
};
