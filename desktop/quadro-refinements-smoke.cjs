'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {clipboard,nativeImage,dialog,app}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await sleep(50)}throw Error('Timed out '+label)}
module.exports=async({win,browser,store})=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const click=async selector=>{const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await sleep(150)};
 await until(()=>js("[...document.querySelectorAll('.tab-item .favicon')].some(e=>e.src.startsWith('data:image/png')&&e.naturalWidth>0)"),'real favicon');
 assert.ok(await js("[...document.querySelectorAll('.pane-icon .favicon')].some(e=>e.src.startsWith('data:image/png'))"));
 const page=[...browser.tabs.values()].find(t=>t.visible&&t.lane!=='side');
 const iconServer=http.createServer((_q,r)=>{r.setHeader('Content-Type','image/svg+xml');r.end('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="#183e61"/></svg>')});
 await new Promise(r=>iconServer.listen(0,'127.0.0.1',r));
 try{const href='http://127.0.0.1:'+iconServer.address().port+'/favicon.svg';await page.view.webContents.executeJavaScript(`(()=>{const l=document.createElement('link');l.rel='icon';l.href=${JSON.stringify(href)};document.head.append(l)})()`);await until(()=>js("[...document.querySelectorAll('.tab-item .favicon')].some(e=>e.src.startsWith('data:image/svg+xml')&&e.naturalWidth>0)"),'SVG favicon from actual page event')}finally{await new Promise(r=>iconServer.close(r))}
 await js('QuadroTest.setLocale("en")');await sleep(100);assert.equal(await js('document.querySelector("[data-action=wallet]").textContent'),'Wallet');
 await js('QuadroTest.setLocale("ru")');await sleep(100);assert.equal(await js('document.querySelector("[data-action=wallet]").textContent'),'Кошелёк');
 console.log('QUADRO_FAVICONS_PNG_SVG_LOCALE_PASS');
 page.view.webContents.focus();page.view.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']});page.view.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['control']});
 await until(()=>js('QuadroTest.capture.isOpen()'),'Control+A screenshot');assert.ok(browser.panels.length===0,'Native pages hidden behind editor');
 assert.ok(await js('QuadroTest.capture.test.getFull().width>800'));
 const fullPixel=await js(`(()=>{const f=QuadroTest.capture.test.getFull(),r=document.querySelector('.pane .page-slot').getBoundingClientRect(),s=f.width/innerWidth;return Array.from(f.getContext('2d').getImageData(Math.round((r.x+r.width-12)*s),Math.round((r.y+12)*s),1,1).data)})()`);
 assert.ok(fullPixel.slice(0,3).every(n=>n>245),'Actual white fixture pixels included');
 async function drag(ax,ay,bx,by){const r=await js(`(()=>{const r=document.querySelector('#capture-canvas').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);const point=(x,y)=>({x:Math.round(r.x+x*r.w),y:Math.round(r.y+y*r.h)});const a=point(ax,ay),b=point(bx,by);win.webContents.sendInputEvent({type:'mouseMove',...a});win.webContents.sendInputEvent({type:'mouseDown',...a,button:'left',clickCount:1});await sleep(60);win.webContents.sendInputEvent({type:'mouseMove',...b,button:'left'});await sleep(80);win.webContents.sendInputEvent({type:'mouseUp',...b,button:'left',clickCount:1});await sleep(100)}
 const full=await js('QuadroTest.capture.test.getFull().width');await drag(.07,.08,.9,.9);assert.ok(await js('QuadroTest.capture.test.getCanvas().width')<full);
 for(const tool of ['arrow','line','rect','ellipse','pencil','marker']){await js(`document.querySelector('[data-tool=${tool}]').click()`);await drag(.15,.18,.65,.65)}
 await js("document.querySelector('[data-tool=text]').click();document.querySelector('#capture-text').value='Тест текста';document.querySelector('#capture-color').value='#00aa55'");await drag(.2,.7,.2,.7);
 assert.equal(await js('QuadroTest.capture.test.getOps().length'),7);
 await js('document.querySelector("#capture-undo").click()');assert.equal(await js('QuadroTest.capture.test.getOps().length'),6);await js('document.querySelector("#capture-redo").click()');assert.equal(await js('QuadroTest.capture.test.getOps().length'),7);
 const png=await js('QuadroTest.capture.test.getCanvas().toDataURL("image/png")');await js('QuadroTest.capture.test.exportImage("copy")');
 const item=(await clipboard.read()).find(x=>x.types.includes('image/png'));assert.ok(item,'PNG image is in actual system clipboard');
 const copied=Buffer.from(await(await item.getType('image/png')).arrayBuffer());assert.ok(nativeImage.createFromBuffer(copied).toBitmap().equals(nativeImage.createFromDataURL(png).toBitmap()));
 const file=path.join(app.getPath('userData'),'screenshot-native-test.png'),original=dialog.showSaveDialog;
 dialog.showSaveDialog=async()=>({canceled:false,filePath:file});try{await js('QuadroTest.capture.test.exportImage("save")')}finally{dialog.showSaveDialog=original}
 assert.ok((await fs.readFile(file)).equals(Buffer.from(png.split(',')[1],'base64')));await fs.writeFile('quadro-screenshot-editor.png',(await win.capturePage()).toPNG());
 console.log('QUADRO_CAPTURE_REGION_TOOLS_CLIPBOARD_SAVE_PASS');
 await click('#capture-close');await until(()=>browser.panels.length>1,'native panes restored');
 await click('.pane.active input');await js('document.querySelector(".pane.active input").value="select-all-test"');
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['meta']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['meta']});await sleep(100);
 assert.equal(await js('QuadroTest.capture.isOpen()'),false);assert.equal(await js('document.activeElement.selectionStart'),0);assert.equal(await js('document.activeElement.selectionEnd'),15);
 console.log('QUADRO_CONTROL_A_VS_COMMAND_A_PASS');
 await click('[data-window=zoom]');await until(()=>win.isFullScreen(),'green control enters fullscreen');await sleep(800);
 await click('[data-window=zoom]');await until(()=>!win.isFullScreen(),'green control exits fullscreen');await sleep(800);
 await click('[data-window=minimize]');await until(()=>win.isMinimized(),'yellow control minimizes');win.restore();win.show();win.focus();await sleep(300);
 console.log('QUADRO_REAL_GLASS_BUTTON_CLICK_PASS');
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('fullscreen timeout')),10000);win.once('enter-full-screen',()=>{clearTimeout(timeout);resolve()});win.setFullScreen(true)});await sleep(150);
 const y=await js("document.querySelector('.traffic-space button').getBoundingClientRect().y");assert.ok(y>=0&&y<40,'No artificial fullscreen header gap');assert.equal(await js("document.querySelector('.toolbar').getBoundingClientRect().height"),40);
 await require('./quadro-lifecycle.cjs').leaveFullscreen(win);await sleep(200);console.log('QUADRO_FULLSCREEN_NO_EMPTY_BAND_PASS');
};
