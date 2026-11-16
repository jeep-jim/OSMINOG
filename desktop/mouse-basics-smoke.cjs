'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await sleep(60)}throw Error('Timed out '+label)}
module.exports=async({app,win,browser,libraryService})=>{
 const js=s=>win.webContents.executeJavaScript(s),lib=libraryService.library;
 const click=async selector=>{const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await sleep(130)};
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/download')){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="mouse-fixture.bin"','Content-Length':262144});let count=0;const t=setInterval(()=>{res.write(Buffer.alloc(8192,42));if(++count===32){clearInterval(t);res.end()}},60);res.on('close',()=>clearInterval(t));return}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Library Alpha fixture</title><h1>Local browser history fixture</h1><input value="not-recorded">');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 const destination=path.join(app.getPath('userData'),'mouse-download-fixture.bin');
 const setPath=(_e,item)=>{if(item.getURL().startsWith(root+'/download'))item.setSavePath(destination)};
 browser.session.prependListener('will-download',setPath);
 try{
  await js(`MouseTest.openPage(${JSON.stringify(root+'/visited-alpha')})`);await until(()=>lib.data.history.some(x=>x.url===root+'/visited-alpha'),'real navigation in history');
  require('electron').Menu.getApplicationMenu().items.find(x=>x.label==='История').submenu.items.find(x=>x.label==='Добавить закладку').click();await until(()=>lib.data.bookmarks.length>0,'bookmark from retained native menu');
  await click('.pane.active input');await js(`(()=>{const e=document.querySelector('.pane.active input');e.value='visited-alpha';e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await until(()=>js('document.querySelector("#address-suggestions").matches(":popover-open")'),'address suggestion popup');
  assert.ok(await js('document.querySelector("#address-suggestions").textContent.includes("visited-alpha")'));
  await until(()=>browser.panels.some(p=>p.clip),'native pages clipped below suggestions');
  // sendInputEvent requires Accelerator key codes (Down), not DOM names (ArrowDown).
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Down'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Down'});
  await until(()=>js('!!document.querySelector("#address-suggestions [aria-selected=true]")'),'keyboard suggestion selected');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});
  await until(()=>js('!document.querySelector("#address-suggestions").matches(":popover-open")'),'suggestion accepted');
  await click('#history-button');await until(()=>js('document.querySelector("#library-dialog").open'),'history UI');assert.ok(await js('document.querySelector("#library-rows").textContent.includes("visited-alpha")'));await click('#library-close');
  await until(()=>js('!document.querySelector("#library-dialog").open'),'history sidebar closed');
  await until(()=>[...browser.tabs.values()].some(t=>t.visible&&t.lane!=='side'&&!t.view.webContents.isDestroyed()),'native page restored after history close');
  console.log('MOUSE_HISTORY_BOOKMARKS_ADDRESS_SUGGESTIONS_PASS');
  const page=[...browser.tabs.values()].find(t=>t.visible&&t.lane!=='side');assert.ok(page,'download starts from a restored live webpage');page.view.webContents.downloadURL(root+'/download');
  await until(()=>lib.data.downloads.some(x=>x.state==='progressing'&&x.received>0),'real download progress');const id=lib.data.downloads[0].id;
  await js(`MouseNative.library('download',{id:${JSON.stringify(id)},action:'pause'})`);assert.equal(lib.data.downloads[0].state,'paused');
  await js(`MouseNative.library('download',{id:${JSON.stringify(id)},action:'resume'})`);await until(()=>lib.data.downloads.find(x=>x.id===id)?.state==='completed','real download completed');
  assert.equal((await fs.readFile(destination)).length,262144);
  await click('#downloads-button');await until(()=>js('document.querySelector("#library-dialog").open'),'downloads UI');assert.ok(await js('document.querySelector("#library-rows").textContent.includes("mouse-fixture.bin")'));await click('#library-close');
  await js(`MouseNative.library('remove',{kind:'downloads',id:${JSON.stringify(id)}})`);assert.ok((await fs.stat(destination)).isFile(),'Removing list entry never deletes file');
  console.log('MOUSE_DOWNLOAD_PROGRESS_PAUSE_RESUME_FILE_PASS');
  for(const fullscreen of [false,true]){
   if(fullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'fullscreen screenshot setup');await sleep(800)}
   await click('#screenshot-button');await until(()=>js('MouseTest.capture.isOpen()'),'open screenshot via camera');
   assert.equal(await js('getComputedStyle(document.querySelector(".toolbar")).webkitAppRegion'),'no-drag');
   await click('#capture-close');await until(()=>js('!MouseTest.capture.isOpen()&&!document.querySelector("#capture-dialog").open'),'actual screenshot X');await until(()=>browser.panels.length>1,'panes restored after screenshot X');
   if(fullscreen)await require('./mouse-lifecycle.cjs').leaveFullscreen(win);
  }
  console.log('MOUSE_SCREENSHOT_X_REAL_CLICK_NORMAL_FULLSCREEN_PASS');
  lib.bookmark(root+'/persistent','Library persistence fixture');lib.input('mouse persistent search','https://www.google.com/search?q=mouse%20persistent%20search');await libraryService.flush();
  await js('MouseTest.browsing.hideHints()');
  await fs.writeFile('mouse-603-browser.png',(await win.capturePage()).toPNG());
 }finally{browser.session.removeListener('will-download',setPath);await new Promise(r=>server.close(r))}
};
