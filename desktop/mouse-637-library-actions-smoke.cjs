'use strict';
// Real OS file drags from the installed library into two retained Chromium
// panes. Only the isolated profile's owned image/text copies are involved.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),syncFS=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {nativeImage,Menu,clipboard}=require('electron');
const {sha256,sleep}=require('./mouse-631-smoke-helpers.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {metadata}=require('./mouse-637-library-actions.cjs');
const IMAGE_RGB=[218,55,96],DOWNLOAD_RGB=[37,143,191],TEXT='Mouse637 owned library text\nНастоящий текстовый файл — данные для переноса.';

function readback(){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},dialog=document.querySelector('#library-dialog');
 return{open:dialog.open,kind:dialog.dataset.kind,view:document.querySelector('#library-rows').dataset.view,theme:MouseTest.model.theme,query:document.querySelector('#library-query').value,
  rows:[...dialog.querySelectorAll('.library-row')].map(row=>{const open=row.querySelector('.library-file-open'),image=row.querySelector('.library-icon'),check=row.querySelector('.library-check');return{id:row.dataset.id,content:open?.textContent||'',tag:open?.tagName,aria:open?.getAttribute('aria-label'),title:open?.title,draggable:open?.draggable,
   controls:row.querySelectorAll('.library-actions button,.library-remove').length,open:open?rect(open):null,checkbox:check?{bounds:rect(check),checked:check.checked}:null,image:image?{bounds:rect(image),src:image.src,loaded:image.dataset.loaded==='true',width:image.naturalWidth,height:image.naturalHeight}:null};})};
}
function installReceiver(){
 globalThis.__mouse637LibraryReceiver?.dispose();const box=document.createElement('div'),drops=[],over=[];box.id='mouse637-library-drop';box.textContent='Drop owned file';box.style.cssText='position:fixed;z-index:2147483000;left:18px;top:150px;width:160px;height:96px;box-sizing:border-box;padding:36px 5px;color:white;background:rgb(37,143,191);font:14px system-ui';document.body.append(box);
 const dragover=event=>{if(box===event.target||box.contains(event.target)){event.preventDefault();event.dataTransfer.dropEffect='copy';over.push({trusted:event.isTrusted,at:Date.now()});}},drop=async event=>{if(box!==event.target&&!box.contains(event.target))return;event.preventDefault();const items=[...event.dataTransfer.files],record={trusted:event.isTrusted,types:[...event.dataTransfer.types],at:Date.now(),files:[]};for(const file of items)record.files.push({name:file.name,type:file.type,size:file.size,bytes:[...new Uint8Array(await file.arrayBuffer())]});drops.push(record);};
 document.addEventListener('dragover',dragover);document.addEventListener('drop',drop);globalThis.__mouse637LibraryReceiver={drops,over,dispose(){document.removeEventListener('dragover',dragover);document.removeEventListener('drop',drop);box.remove();delete globalThis.__mouse637LibraryReceiver;}};
 return true;
}
function assertRows(state,files,view,theme){
 assert.equal(state.open,true);assert.equal(state.kind,'captures');assert.equal(state.view,view);assert.equal(state.theme,theme);assert.equal(state.rows.length,2);
 for(const file of files){const row=state.rows.find(item=>item.id===file.id);assert.ok(row);assert.equal(row.tag,'BUTTON');assert.equal(row.aria,file.title);assert.equal(row.title,file.title);assert.equal(row.draggable,true);assert.equal(row.controls,0);assert.ok(row.open.width>30&&row.open.height>30);assert.ok(row.checkbox.bounds.width>0&&row.checkbox.bounds.height>0);
  assert.equal(row.content,file.type==='text/plain'?TEXT:'');if(file.type==='image/png'){assert.equal(row.image.loaded,true);assert.equal(row.image.width,160);assert.equal(row.image.height,96);assert.equal(row.checkbox.checked,true);}
 }
}
function assertReceived(value,file,bytes){
 assert.equal(value.trusted,true);assert.ok(value.types.includes('Files'));assert.equal(value.files.length,1);const received=value.files[0];assert.equal(received.name,file.dragName);assert.equal(received.type,file.type);assert.equal(received.size,bytes.length);assert.deepEqual(Buffer.from(received.bytes),bytes);
}

module.exports=async function verifyLibraryActions({app,win,browser,libraryService,localCaptures,fixture,nativeInput,click,text,capture,theme,facts,records}){
 const report={schema:1,source:'Owned local files, native context menu and OS file drops into live panes',files:[],samples:[],menus:[],transfers:[],ok:false};facts.libraryActions=report;
 assert.equal(process.env.CI,'true');assert.equal(app.isPackaged,true);assert.equal(records.length,2);assert.equal(localCaptures.archive.enabled,false);
 const archive=localCaptures.archive,library=libraryService.library,archiveBefore=structuredClone(archive.items),downloadsBefore=structuredClone(library.data.downloads),readsBefore=archive.reads,ownedCaptureIds=[];
 const originalDrag=win.webContents.startDrag,originalPopup=Menu.prototype.popup,source=process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest';let folder,pendingDrag,pendingMenu,error,cleanupError;
 const selector=id=>'.library-row[data-id='+JSON.stringify(id)+'] .library-file-open',state=()=>fixture.js(`(${readback.toString()})()`),identities=()=>Promise.all(records.map(fixture.identity));
 const raw=new Map(),fileByKey=key=>report.files.find(file=>file.key===key);
 const solid=rgb=>{const data=Buffer.alloc(160*96*4);for(let i=0;i<data.length;i+=4){data[i]=rgb[2];data[i+1]=rgb[1];data[i+2]=rgb[0];data[i+3]=255;}return nativeImage.createFromBitmap(data,{width:160,height:96}).toPNG();};
 async function focus(){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await fixture.until(()=>win.isFocused(),'library native shell focus');}
 async function observe(target,eventsName){await fixture.js(`(()=>{globalThis.__mouse637LibraryInput?.dispose();const target=document.querySelector(${JSON.stringify(target)}),events=[],listener=e=>events.push({type:e.type,trusted:e.isTrusted,matches:e.target===target||target.contains(e.target),at:Date.now()});for(const type of ${JSON.stringify(eventsName)})document.addEventListener(type,listener,true);globalThis.__mouse637LibraryInput={events,dispose(){for(const type of ${JSON.stringify(eventsName)})document.removeEventListener(type,listener,true);delete globalThis.__mouse637LibraryInput;}};})()`);}
 async function hit(target){await fixture.js(`document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'nearest'});true`);await fixture.frame();const value=await fixture.js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(target)}),{})`);assert.equal(value.ready,true);const origin=win.getContentBounds();return{x:Math.round(origin.x+value.x),y:Math.round(origin.y+value.y)};}
 const guestWitness=()=>{const page=fixture.nativeState(records[0]);return{name:'owned library drop target',tabId:records[0].id,webContentsId:page.webContentsId,point:{x:page.bounds.x+98,y:page.bounds.y+230},expectedRGB:[32,123,164]};};
 async function captureSample(view,color){
  await click('#library-'+view);await fixture.until(async()=>{const now=await state();return now.rows.find(row=>row.id===fileByKey('archive-image').id)?.image.loaded},'library actual owned image decoded');await fixture.frame();
  const value=await state();assertRows(value,report.files.filter(file=>file.kind==='captures'),view,color);const image=value.rows.find(row=>row.id===fileByKey('archive-image').id).image.bounds;
  const filename='mouse-637-library-captures-'+view+'-'+color+'.png',native=records.map(fixture.nativeState),entry={theme:color,view,state:value,native,capture:filename};report.samples.push(entry);
  await capture(filename,[{name:'owned archive thumbnail',entryId:fileByKey('archive-image').id,point:{x:image.x+image.width/2,y:image.y+image.height/2},expectedRGB:IMAGE_RGB},guestWitness()]);
 }
 win.webContents.startDrag=function(options){
  if(pendingDrag){const data=syncFS.readFileSync(options.file);assert.ok(data.length<100000,'Only the small owned file fixture is observed');pendingDrag.nativeFile={name:path.basename(options.file),size:data.length,sha256:sha256(data),hasIcon:!options.icon.isEmpty(),keys:Object.keys(options).sort()};}
  return Reflect.apply(originalDrag,this,arguments);
 };
 Menu.prototype.popup=function(options){
  if(pendingMenu&&[localCaptures.fileActions.lastMenu,libraryService.fileActions.lastMenu].includes(this)){
   pendingMenu.popup={windowId:options.window.id,x:options.x,y:options.y};this.once('menu-will-show',()=>{pendingMenu.shownAt=Date.now();});const row=pendingMenu;this.once('menu-will-close',()=>{row.closedAt=Date.now();});
  }
  return Reflect.apply(originalPopup,this,arguments);
 };
 async function menu(file,{preview=false,captureName}={}){
  await focus();const target=selector(file.id),point=await hit(target);await observe(target,['contextmenu']);const entry={id:file.id,kind:file.kind,shownAt:null,closedAt:null,keys:[],items:[],state:await state(),contentBounds:win.getContentBounds()};report.menus.push(entry);pendingMenu=entry;
  assert.equal(await nativeInput.testRightClick(point.x,point.y),true);const service=file.kind==='captures'?localCaptures.fileActions:libraryService.fileActions;
  await fixture.until(()=>entry.shownAt!==null&&!!service.lastMenu,'actual native file menu shown');const popup=service.lastMenu;entry.items=popup.items.map(item=>({id:item.id||'',label:item.label||'',type:item.type,enabled:item.enabled,visible:item.visible}));
  const events=await fixture.js('__mouse637LibraryInput.events');assert.ok(events.some(event=>event.type==='contextmenu'&&event.trusted&&event.matches));entry.input={selector:target,action:'context-menu',pid:process.pid,source,point,at:Date.now(),events};facts.nativeInputs.push(entry.input);
  entry.locale=await fixture.js('MouseTest.model.locale');const expected=metadata({...file,type:file.archiveType},file.kind,entry.locale);entry.metadata=expected;assert.deepEqual(entry.items.slice(0,3).map(item=>item.label),expected.labels);assert.ok(entry.items.slice(0,3).every(item=>!item.enabled));
  assert.deepEqual(entry.items.filter(item=>item.enabled&&item.type!=='separator').map(item=>item.id),file.kind==='captures'?['mouse-library-preview','mouse-library-copy','mouse-library-remove']:['mouse-library-open','mouse-library-show','mouse-library-remove']);
  if(captureName){entry.capture=captureName;entry.native=records.map(fixture.nativeState);await capture(captureName,[guestWitness()]);}
  for(const key of preview?['HOME','ENTER']:['ESC']){const linux={HOME:'Home',ENTER:'Return',ESC:'Escape'};assert.equal(await nativeInput.testKey(process.platform==='linux'?linux[key]:key),true);entry.keys.push({key,source,at:Date.now()});await sleep(45);}
  await fixture.until(()=>entry.closedAt!==null&&service.lastMenu===null,'native file menu closes');entry.previewSelected=preview;pendingMenu=null;await fixture.js('__mouse637LibraryInput.dispose()');
  if(preview){await fixture.until(()=>fixture.js('document.querySelector("#local-preview-dialog").open'),'native menu preview opens');const rendered=await fixture.js(`({title:document.querySelector('#local-preview-title').textContent,src:document.querySelector('.local-preview-body img')?.src})`);assert.equal(rendered.title,file.title);assert.deepEqual(nativeImage.createFromDataURL(rendered.src).toBitmap({scaleFactor:1}),nativeImage.createFromBuffer(raw.get(file.key)).toBitmap({scaleFactor:1}));entry.preview=rendered;await click('#local-preview-dialog header button');}
 }
 async function transfer(file,target,index){
  await focus();await fixture.pageJS(target,'__mouse637LibraryReceiver.drops.length=0;__mouse637LibraryReceiver.over.length=0;true');const control=selector(file.id),from=await hit(control),nativeBefore=fixture.nativeState(target),bounds=nativeBefore.bounds,origin=win.getContentBounds(),to={x:Math.round(origin.x+bounds.x+98),y:Math.round(origin.y+bounds.y+198)};
  const before=await fixture.identity(target),clipBefore=sha256(Buffer.from(await clipboard.readText())),entry={fileKey:file.key,targetTabId:target.id,pane:'p'+(index+1),before,nativeBefore,clipboardBefore:clipBefore,sourceState:await state(),contentBounds:origin};report.transfers.push(entry);await observe(control,['pointerdown','dragstart','pointercancel','pointerup']);pendingDrag=entry;
  try{
   assert.equal(await nativeInput.testMouse(from.x,from.y,0),true);await sleep(60);assert.equal(await nativeInput.testMouse(from.x-14,from.y+8,1),true);
   await fixture.until(()=>!!entry.nativeFile,'actual Electron native file drag started');await sleep(100);
   for(let step=1;step<=10;step++){assert.equal(await nativeInput.testMouse(Math.round(from.x+(to.x-from.x)*step/10),Math.round(from.y+(to.y-from.y)*step/10),1),true);await sleep(22);}await sleep(120);
  }finally{assert.equal(await nativeInput.testMouse(to.x,to.y,2),true);pendingDrag=null;}
  await fixture.until(()=>fixture.pageJS(target,'__mouse637LibraryReceiver.drops.length===1'),'OS file drop reached the intended live page');
  const events=await fixture.js('__mouse637LibraryInput.events');await fixture.js('__mouse637LibraryInput.dispose()');assert.ok(events.some(e=>e.type==='pointerdown'&&e.trusted&&e.matches));assert.ok(events.some(e=>e.type==='dragstart'&&e.trusted&&e.matches));
  entry.input={selector:control,action:'file-drag',pid:process.pid,source,from,to,events};facts.nativeInputs.push(entry.input);entry.received=await fixture.pageJS(target,'__mouse637LibraryReceiver.drops[0]');entry.over=await fixture.pageJS(target,'__mouse637LibraryReceiver.over.slice()');assert.ok(entry.over.some(event=>event.trusted));assertReceived(entry.received,file,raw.get(file.key));
  assert.equal(entry.nativeFile.sha256,file.sha256);assert.equal(entry.nativeFile.size,file.size);assert.equal(entry.nativeFile.name,file.dragName);assert.equal(entry.nativeFile.hasIcon,true);assert.deepEqual(entry.nativeFile.keys,['file','icon']);
  entry.after=await fixture.identity(target);fixture.assertIdentity(before,entry.after);entry.nativeAfter=fixture.nativeState(target);entry.clipboardAfter=sha256(Buffer.from(await clipboard.readText()));assert.equal(entry.clipboardAfter,clipBefore);entry.libraryStillOpen=(await state()).open;assert.equal(entry.libraryStillOpen,true);
 }
 try{
  await fixture.switchDesk(records[0].desk);await fixture.setLayout(records);report.pages={before:await identities()};for(const record of records)await fixture.pageJS(record,`(${installReceiver.toString()})()`);
  folder=await fs.mkdtemp(path.join(app.getPath('userData'),'mouse637-library-'));const query='Mouse637 owned library';report.query=query;
  for(const spec of [{key:'archive-image',kind:'captures',type:'image/png',title:query+' image',bytes:solid(IMAGE_RGB),filename:'mouse-637-library-source.png',rgb:IMAGE_RGB},{key:'archive-text',kind:'captures',type:'text/plain',title:query+' text',bytes:Buffer.from(TEXT),filename:'mouse-637-library-source.txt'},{key:'download-image',kind:'downloads',type:'image/png',title:query+' download.png',bytes:solid(DOWNLOAD_RGB),filename:'mouse-637-library-download.png',rgb:DOWNLOAD_RGB}]){
   let row;if(spec.kind==='captures'){row=await archive.add({type:spec.type==='text/plain'?'text':'image',data:spec.bytes,title:spec.title,source:'mouse637-owned-file-fixture'});assert.ok(row);ownedCaptureIds.push(row.id);}else{const file=path.join(folder,spec.title);await fs.writeFile(file,spec.bytes);row={id:'mouse637-'+randomUUID(),filename:spec.title,title:spec.title,path:file,state:'completed',received:spec.bytes.length,total:spec.bytes.length,at:Date.now()};library.data.downloads.unshift(row);}
   const bytes=spec.kind==='captures'?await require('./mouse-capture-archive.cjs').readBounded(path.join(archive.root,row.filename),100000):await fs.readFile(row.path);raw.set(spec.key,bytes);await fs.writeFile(spec.filename,bytes);
   report.files.push({key:spec.key,kind:spec.kind,id:row.id,type:spec.type,title:row.title,filename:row.filename,at:row.at,dragName:spec.kind==='captures'?path.parse(row.title).name+(spec.type==='text/plain'?'.txt':'.png'):row.filename,size:bytes.length,sha256:sha256(bytes),artifact:spec.filename,...(spec.rgb?{rgb:spec.rgb}:{}),archiveType:spec.type==='text/plain'?'text':'image'});
  }
  await libraryService.flush();win.webContents.send('mouse:library-changed');await click('#downloads-button');await click('[data-library=captures]');await text('#library-query',query);await click('.library-row[data-id='+JSON.stringify(fileByKey('archive-image').id)+'] .library-check');
  for(const color of ['light','dark']){
   await theme(color);await captureSample('list',color);await captureSample('grid',color);
   if(color==='light')await menu(fileByKey('archive-image'),{preview:true,captureName:'mouse-637-library-context.png'});
  }
  const textFile=fileByKey('archive-text');report.textPreview={input:await click(selector(textFile.id))};await fixture.until(()=>fixture.js('document.querySelector("#local-preview-dialog").open'),'single click text preview');report.textPreview.state=await fixture.js(`({title:document.querySelector('#local-preview-title').textContent,text:document.querySelector('.local-text-full').textContent,nested:document.querySelector('.local-text-full').children.length})`);assert.equal(report.textPreview.state.text,TEXT);assert.equal(report.textPreview.state.title,textFile.title);assert.equal(report.textPreview.state.nested,0);await click('#local-preview-dialog header button');
  await click('#library-list');await transfer(fileByKey('archive-image'),records[0],0);await transfer(fileByKey('archive-text'),records[1],1);
  await click('[data-library=downloads]');await text('#library-query',query);await fixture.until(async()=>{const value=await state();return value.rows.length===1&&value.rows[0].image.loaded},'owned downloaded image ready');report.downloadState=await state();assert.equal(report.downloadState.rows[0].controls,0);await menu(fileByKey('download-image'));await transfer(fileByKey('download-image'),records[0],0);
  await click('#library-close');report.pages.after=await identities();for(let i=0;i<2;i++)fixture.assertIdentity(report.pages.before[i],report.pages.after[i]);report.pages.identityPreserved=true;
 }catch(e){error=e;report.error={message:String(e.message),stack:String(e.stack).slice(0,5000)};}
 finally{
  win.webContents.startDrag=originalDrag;Menu.prototype.popup=originalPopup;
  const cleanup=async fn=>{try{await fn();}catch(e){cleanupError||=e;}};
  await cleanup(async()=>{localCaptures.fileActions.lastMenu?.closePopup(win);libraryService.fileActions.lastMenu?.closePopup(win);await fixture.js('globalThis.__mouse637LibraryInput?.dispose();const p=document.querySelector("#local-preview-dialog");if(p.open)p.close();MouseTest.browsing.close();true');});
  for(const record of records)await cleanup(()=>fixture.pageJS(record,'globalThis.__mouse637LibraryReceiver?.dispose();true'));
  await cleanup(async()=>{await archive.remove(ownedCaptureIds);assert.deepEqual(archive.items,archiveBefore);assert.equal(archive.enabled,false);assert.equal(archive.reads,readsBefore);library.data.downloads=downloadsBefore;await libraryService.flush();report.restored={archiveEntries:true,downloads:true,collectorUnchanged:true};});
  if(folder)await cleanup(()=>fs.rm(folder,{recursive:true,force:true}));await cleanup(()=>fixture.setLayout(records));
  report.ok=!error&&!cleanupError;
 }
 if(error||cleanupError)throw error||cleanupError;return report;
};
module.exports.readback=readback;module.exports.installReceiver=installReceiver;module.exports.assertRows=assertRows;module.exports.assertReceived=assertReceived;module.exports.IMAGE_RGB=IMAGE_RGB;module.exports.DOWNLOAD_RGB=DOWNLOAD_RGB;module.exports.TEXT=TEXT;
