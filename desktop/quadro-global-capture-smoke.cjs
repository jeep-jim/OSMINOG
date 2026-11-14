'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {BrowserWindow,globalShortcut,clipboard,nativeImage,dialog,screen}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<240;n++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label);}
module.exports=async({app,win,browser,globalCapture})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 assert.equal(globalCapture.registered,true);assert.equal(globalShortcut.isRegistered('Control+A'),true);
 const png=await js(`(()=>{const c=document.createElement('canvas');c.width=960;c.height=640;const x=c.getContext('2d');x.fillStyle='#fafafa';x.fillRect(0,0,960,640);x.fillStyle='#267c61';x.fillRect(40,40,300,240);x.fillStyle='#e9ab34';x.fillRect(430,160,380,310);x.fillStyle='#111';x.font='32px sans-serif';x.fillText('Global screenshot fixture',70,560);return c.toDataURL('image/png')})()`);
 globalCapture.testFrame={base:png,width:960,height:640,layers:[],kind:'screen'};
 const page=[...browser.tabs.values()].find(t=>t.visible);assert.ok(page);
 page.view.webContents.focus();page.view.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']});page.view.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['control']});
 await until(()=>globalCapture.editor&&!globalCapture.busy,'Ctrl+A independent editor');
 assert.equal(await globalCapture.editor.webContents.executeJavaScript('document.documentElement.dataset.captureReady'),'true');
 assert.equal(await js('QuadroTest.capture.isOpen()'),false,'Global screen editor is separate from browser snapshot');
 globalCapture.editor.close();await until(()=>!globalCapture.editor,'close first global editor');
 // Validate the background/minimized lifecycle independently of TCC availability.
 // Test frame is explicitly synthetic. It must not be called a captured Mac screen.
 win.hide();await globalCapture.request();await until(()=>globalCapture.editor&&!globalCapture.busy,'editor while browser hidden');assert.equal(win.isVisible(),false);
 const editor=globalCapture.editor,ej=s=>editor.webContents.executeJavaScript(s);
 const click=async sel=>{const p=await ej(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);editor.focus();editor.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])editor.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(130);};
 assert.equal(await ej('typeof QuadroNative.browser'),'undefined');assert.equal(await ej('typeof QuadroNative.web3'),'undefined');
 const r=await ej('(()=>{const r=document.querySelector("#capture-canvas").getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()');
 const a={x:Math.round(r.x+.1*r.w),y:Math.round(r.y+.1*r.h)},b={x:Math.round(r.x+.8*r.w),y:Math.round(r.y+.8*r.h)};
 editor.webContents.sendInputEvent({type:'mouseMove',...a});editor.webContents.sendInputEvent({type:'mouseDown',...a,button:'left',clickCount:1});await sleep(70);editor.webContents.sendInputEvent({type:'mouseMove',...b,button:'left'});await sleep(90);editor.webContents.sendInputEvent({type:'mouseUp',...b,button:'left',clickCount:1});await sleep(100);
 assert.ok(await ej('QuadroCaptureTest.test.getCanvas().width')<960);await click('#capture-copy');
 const item=(await clipboard.read()).find(i=>i.types.includes('image/png'));assert.ok(item);
 const data=await ej('QuadroCaptureTest.test.getCanvas().toDataURL("image/png")');
 const copied=Buffer.from(await(await item.getType('image/png')).arrayBuffer());assert.ok(nativeImage.createFromBuffer(copied).toBitmap().equals(nativeImage.createFromDataURL(data).toBitmap()));
 const save=dialog.showSaveDialog,file=path.join(app.getPath('userData'),'global-capture-fixture.png');dialog.showSaveDialog=async()=>({canceled:false,filePath:file});try{await click('#capture-save');await until(async()=>{try{return(await fs.stat(file)).size>0}catch{return false;}},'global PNG save');}finally{dialog.showSaveDialog=save;}
 assert.equal(await fs.readFile(file,'base64'),data.split(',')[1]);await fs.writeFile('quadro-605-global-editor.png',(await editor.capturePage()).toPNG());
 await click('#capture-close');await until(()=>!globalCapture.editor,'real X closes isolated editor');assert.equal(globalCapture.pending,null);assert.equal(win.isVisible(),false);
 console.log('QUADRO_GLOBAL_SHORTCUT_REGISTERED_BACKGROUND_EDITOR_CROP_PNG_PASS');
 // A real native display capture can only be validated with existing TCC consent.
 globalCapture.testFrame=null;
 const permission=globalCapture.permission();console.log('QUADRO_SCREEN_TCC_STATUS '+permission);
 if(permission==='granted'){
  const frame=await globalCapture.acquire(screen.getDisplayNearestPoint(screen.getCursorScreenPoint()));assert.ok(frame?.base.startsWith('data:image/png;base64,'));assert.equal(frame.kind,'screen');assert.ok(frame.width>100);console.log('QUADRO_NATIVE_DISPLAY_CAPTURE_PASS');
 }else console.log('QUADRO_NATIVE_DISPLAY_CAPTURE_NOT_TESTED_TCC');
 win.show();win.focus();await sleep(200);
 // Keep permissions untouched; Cmd+A remains the native selection action.
 await js('QuadroNative.globalCapture("enable",{enabled:false})');assert.equal(globalShortcut.isRegistered('Control+A'),false);
 await js('QuadroNative.globalCapture("enable",{enabled:true})');assert.equal(globalShortcut.isRegistered('Control+A'),true);
 console.log('QUADRO_GLOBAL_CAPTURE_ENABLE_DISABLE_PASS');
};
