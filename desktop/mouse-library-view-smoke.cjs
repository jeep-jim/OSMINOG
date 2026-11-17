'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),{dialog}=require('electron');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function until(f,label){for(let n=0;n<150;n++){if(await f())return;await sleep(60)}throw Error('Library619 timeout: '+label)}
module.exports=async({app,win,browser,libraryService})=>{
 const js=s=>win.webContents.executeJavaScript(s),lib=libraryService.library,before=new Set(browser.tabs.keys()),saved=structuredClone(lib.data),box=win.getBounds();
 const model=await js('JSON.parse(JSON.stringify({theme:MouseTest.model.theme,slots:MouseTest.model.slots,tree:MouseTest.model.tree,active:MouseTest.model.active,aiOpen:MouseTest.model.aiOpen,libraryOpen:MouseTest.model.libraryOpen}))');
 const oldDialog=dialog.showMessageBox;let server,answer=0,confirmations=0;
 const destination=path.join(app.getPath('userData'),'library619-retain.txt');await fs.writeFile(destination,'library619 downloaded bytes must remain');
 async function click(selector){const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing control '+${JSON.stringify(selector)});const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(140);}
 async function query(value){await js(`(()=>{const q=document.querySelector('#library-query');q.value=${JSON.stringify(value)};q.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(180);}
 async function noOverflow(){const g=await js(`(()=>{const list=document.querySelector('#library-rows');return{overflow:list.scrollWidth-list.clientWidth,cards:[...list.querySelectorAll('.library-row')].every(row=>{const r=row.getBoundingClientRect(),b=row.querySelector('.library-body').getBoundingClientRect(),d=row.querySelector('.library-detail').getBoundingClientRect();return b.left>=r.left&&b.right<=r.right+1&&d.right<=r.right+1})}})()`);assert.ok(g.overflow<=1,'library rows overflow: '+JSON.stringify(g));assert.equal(g.cards,true);}
 try{
  server=http.createServer((req,res)=>{if(req.url==='/brand.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#32a469"/><circle cx="12" cy="12" r="6" fill="#ffffff"/></svg>');return}if(req.url==='/favicon.ico'){res.statusCode=404;res.end();return}res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>LIB619 real site</title><link rel="icon" href="/brand.svg"><input value="retained">');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
  win.setSize(1100,800);await js(`MouseTest.openPage(${JSON.stringify(root+'/page')})`);
  await until(()=>lib.data.history.some(x=>x.url===root+'/page'&&x.favicon?.endsWith('/brand.svg')),'actual page favicon persisted');
  const page=[...browser.tabs.values()].find(t=>t.url===root+'/page');await js(`MouseNative.library('bookmark',{id:${JSON.stringify(page.id)}})`);
  for(let n=0;n<105;n++)lib.bookmark(root+'/saved'+n+(n===104?'/very-long-path'.repeat(25):''),'LIB619 item '+n);await libraryService.flush();
  dialog.showMessageBox=async(...args)=>{const options=args.at(-1);assert.match(options.message,/Удалить выбранные записи/);confirmations++;return{response:answer};};
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}');MouseTest.browsing.open('bookmarks')`);await query('LIB619');
   await until(()=>js('document.querySelectorAll(".library-row").length===100'),'first page');
   await until(()=>js('[...document.querySelectorAll(".library-icon")].some(i=>i.dataset.loaded==="true"&&i.naturalWidth>0)'),'real saved favicon');
   await click('#library-more');await until(()=>js('document.querySelectorAll(".library-row").length===106'),'show all106');
   const top=await js(`(()=>{const d=document.querySelector('#library-dialog'),more=d.querySelector('#library-more'),count=d.querySelector('#library-count'),check=d.querySelector('#library-select-all'),summary=d.querySelector('.library-summary');return{header:d.querySelector('header').getBoundingClientRect().height,moreAdjacent:count.nextElementSibling===more,summaryTop:summary.getBoundingClientRect().top,rowsTop:d.querySelector('#library-rows').getBoundingClientRect().top,checkboxRight:check.getBoundingClientRect().right,closeRight:d.querySelector('#library-close').getBoundingClientRect().right,duplicate:d.querySelectorAll('footer').length,clearHidden:d.querySelector('#library-clear').hidden,round:getComputedStyle(d.querySelector('.library-remove')).borderRadius,overflow:d.scrollWidth-d.clientWidth}})()`);
   assert.equal(top.moreAdjacent,true);assert.equal(top.duplicate,0);assert.equal(top.clearHidden,true);assert.equal(top.round,'50%');assert.ok(top.summaryTop<top.rowsTop);assert.ok(top.overflow<=1);await noOverflow();
   await click('#library-grid');assert.equal(await js('document.querySelector("#library-rows").dataset.view'),'grid');await noOverflow();
   await click('#library-select-all');assert.equal(await js('document.querySelector("#library-clear").hidden'),false);assert.equal(await js('document.querySelectorAll(".library-check:checked").length'),106);
   const c=confirmations;answer=0;await click('#library-clear');assert.equal(confirmations,c+1);assert.equal(lib.data.bookmarks.filter(x=>x.title.startsWith('LIB619')).length,106);
   await click('#library-select-all');await noOverflow();await fs.writeFile('mouse-619-library-bookmarks-'+theme+'.png',(await win.capturePage()).toPNG());
   await click('[data-library=history]');await query('LIB619');await until(()=>js('document.querySelectorAll(".library-row").length===1'),'real history record');await until(()=>js('document.querySelector(".library-icon").dataset.loaded==="true"&&document.querySelector(".library-icon").naturalWidth>0'),'history custom favicon');
   await noOverflow();await fs.writeFile('mouse-619-library-history-'+theme+'.png',(await win.capturePage()).toPNG());
  }
  await js('MouseTest.browsing.open("bookmarks")');await query('LIB619');await click('#library-select-all');answer=1;await click('#library-clear');await until(()=>!lib.data.bookmarks.some(x=>x.title.startsWith('LIB619')),'all filtered bookmarks deleted beyond visible page');assert.deepEqual(lib.data.bookmarks,saved.bookmarks);
  lib.data.downloads.unshift({id:'lib619-file',filename:'LIB619 notes.txt',path:destination,state:'completed',received:40,total:40,at:Date.now()},{id:'lib619-active',filename:'LIB619 active.zip',state:'progressing',received:5,total:100,at:Date.now()});
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}');MouseTest.browsing.open('downloads')`);await query('LIB619');
   await until(()=>js('document.querySelectorAll(".library-row").length===2'),'download list');await until(()=>js('document.querySelector("[data-id=lib619-file] .library-icon").dataset.loaded==="true"'),'real OS file icon');
   for(const view of ['list','grid']){await click('#library-'+view);assert.equal(await js('document.querySelector("#library-rows").dataset.view'),view);await noOverflow();await fs.writeFile('mouse-619-library-downloads-'+view+'-'+theme+'.png',(await win.capturePage()).toPNG());}
  }
  await click('#library-select-all');assert.equal(await js('document.querySelectorAll(".library-check:checked").length'),1);await click('#library-clear');await until(()=>!lib.data.downloads.some(x=>x.id==='lib619-file'),'download entry removed');assert.ok(lib.data.downloads.some(x=>x.id==='lib619-active'));assert.equal(await fs.readFile(destination,'utf8'),'library619 downloaded bytes must remain');
  console.log('MOUSE_619_LIBRARY_ICONS_VIEWS_TOPBAR_SELECTION_SAFE_CLEAR_PASS');
 }finally{
  dialog.showMessageBox=oldDialog;await js('MouseTest.browsing.close()').catch(()=>{});for(const id of [...browser.tabs.keys()])if(!before.has(id))await browser.command('close',{id});server?.close();lib.data=saved;await libraryService.flush();
  await js(`Object.assign(MouseTest.model,${JSON.stringify(model)});MouseTest.setTheme(${JSON.stringify(model.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.save()`);win.setBounds(box);
 }
};
