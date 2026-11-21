'use strict';
// Installed-app regression proof. Every file and model record below belongs to
// the dedicated CI profile; no clipboard input or external download is used.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function installLibraryProbe(id){
 const list=document.querySelector('#library-rows'),row=[...list.querySelectorAll('.library-row')].find(node=>node.dataset.id===id);
 if(!row)throw Error('Missing owned library row '+id);
 const img=row.querySelector('.library-icon'),checkbox=row.querySelector('.library-check'),listTop=list.getBoundingClientRect().top;
 const probe={id,list,row,img,checkbox,focus:document.activeElement,source:img.getAttribute('src'),scrollTop:list.scrollTop,rowTop:row.getBoundingClientRect().top-listTop,removed:0,sourceWrites:0,events:[],order:[...list.querySelectorAll('.library-row')].map(node=>node.dataset.id)};
 probe.observer=new MutationObserver(records=>{for(const record of records){if(record.type==='childList')for(const node of record.removedNodes)if(node===row||node===img||node.contains?.(row)||node.contains?.(img)){probe.removed++;probe.events.push({type:'remove',tag:node.nodeName,at:performance.now()});}if(record.type==='attributes'&&record.target===img&&record.attributeName==='src'){probe.sourceWrites++;probe.events.push({type:'src',at:performance.now()});}}});
 probe.observer.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});globalThis.mouse635LibraryProbe=probe;
 return{id,kind:document.querySelector('#library-dialog').dataset.kind,view:list.dataset.view,theme:MouseTest.model.theme,scrollTop:probe.scrollTop,rowTop:probe.rowTop,selected:checkbox.checked,focused:probe.focus===checkbox,source:probe.source,imageSize:{width:img.naturalWidth,height:img.naturalHeight},order:probe.order};
}
function sampleLibraryProbe(){
 const p=globalThis.mouse635LibraryProbe;if(!p)throw Error('Missing library probe');const row=[...p.list.querySelectorAll('.library-row')].find(node=>node.dataset.id===p.id),img=row?.querySelector('.library-icon'),checkbox=row?.querySelector('.library-check');
 return{id:p.id,kind:document.querySelector('#library-dialog').dataset.kind,view:p.list.dataset.view,theme:MouseTest.model.theme,sameRow:row===p.row,sameImage:img===p.img,sameCheckbox:checkbox===p.checkbox,sameFocus:document.activeElement===p.focus,focusedCheckbox:document.activeElement===checkbox,selected:checkbox?.checked===true,sameSource:img?.getAttribute('src')===p.source,source:img?.getAttribute('src'),imageSize:{width:img?.naturalWidth||0,height:img?.naturalHeight||0},thumbnail:img?.classList.contains('library-thumbnail')===true,scrollTop:p.list.scrollTop,rowTop:row?row.getBoundingClientRect().top-p.list.getBoundingClientRect().top:null,removed:p.removed,sourceWrites:p.sourceWrites,events:p.events.slice(),order:[...p.list.querySelectorAll('.library-row')].map(node=>node.dataset.id)};
}
function stable(before,after,{source=true,scroll=true,order=true}={}){
 for(const key of ['kind','view','theme'])assert.equal(after[key],before[key],'Library keeps observed '+key);
 for(const key of ['sameRow','sameImage','sameCheckbox','sameFocus','focusedCheckbox','selected'])assert.equal(after[key],true,'Library keeps '+key);
 assert.equal(after.removed,0,'Existing library row/image never leaves the DOM');
 if(source){assert.equal(after.sameSource,true);assert.equal(after.sourceWrites,0);assert.ok(after.imageSize.width>0&&after.imageSize.height>0);}
 if(scroll)assert.ok(Math.abs(after.scrollTop-before.scrollTop)<=1,'Library scroll stays fixed');
 assert.ok(Math.abs(after.rowTop-before.rowTop)<=1,'The viewed file stays at the same screen position');
 if(order)assert.deepEqual(after.order,before.order);
}

module.exports=async(ctx,{fixture,click,screenCapture,stage})=>{
 const {app,win,libraryService,localCaptures}=ctx,{nativeImage}=require('electron'),lib=libraryService.library,archive=localCaptures.archive,js=fixture.js;
 assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(app.isPackaged,true);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 const profile=path.resolve(app.getPath('userData')),relative=path.relative(profile,archive.root);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Only the isolated archive is used');assert.equal(archive.enabled,false,'The default auto collector remains off');
 const original=structuredClone(lib.data),originalArchive=structuredClone(archive.items),archiveBefore=archive.state(),readsBefore=archive.reads,originalPreview=archive.preview;
 const facts={schema:1,version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:app.isPackaged,profileIsolated:true,startedAt:new Date().toISOString(),scenario:'installed-library-stability',fixtureOnly:true,realTransfer:false,phases:[],captures:[],notifications:[],previewRequests:[]};
 const ownedCaptureIds=[],pending=new Set(),gates=new Map(),allGates=new Set();let owned,primaryError,cleanupError,previewSequence=0;
 const save=()=>fs.writeFile('mouse-635-library.json',JSON.stringify(facts,null,2)+'\n');
 const notify=(reason)=>{facts.notifications.push({reason,at:Date.now()});win.webContents.send('mouse:library-changed');};
 const probe=async id=>js(`(${installLibraryProbe.toString()})(${JSON.stringify(id)})`),sample=()=>js(`(${sampleLibraryProbe.toString()})()`);
 const stopProbe=()=>js('globalThis.mouse635LibraryProbe?.observer.disconnect();delete globalThis.mouse635LibraryProbe;true');
 const selector=id=>'.library-row[data-id='+JSON.stringify(id)+']';
 const image=seed=>{const width=160,height=96,bitmap=Buffer.alloc(width*height*4);for(let n=0;n<bitmap.length;n+=4){bitmap[n]=(seed*29+31)%220;bitmap[n+1]=(seed*47+57)%220;bitmap[n+2]=(seed*61+83)%220;bitmap[n+3]=255;}return nativeImage.createFromBitmap(bitmap,{width,height}).toPNG();};
 const addCapture=async(type,data,title)=>{const row=await archive.add({type,data,title,source:'mouse635-owned-fixture'});assert.ok(row?.id);ownedCaptureIds.push(row.id);return row;};
 const hold=id=>{let release;const promise=new Promise(resolve=>release=resolve),gate={id,promise,release,entered:false};gates.set(id,gate);allGates.add(gate);return gate;};
 archive.preview=function(id){const sequence=++previewSequence,gate=gates.get(id),request={sequence,id,startedAt:Date.now(),controlledDelay:!!gate};facts.previewRequests.push(request);if(gate){gates.delete(id);gate.entered=true;}
  const work=(async()=>{try{if(gate)await gate.promise;const value=await originalPreview.call(this,id);request.finishedAt=Date.now();request.type=value.type;return value;}catch(error){request.error=String(error.message);throw error;}})();pending.add(work);void work.finally(()=>pending.delete(work)).catch(()=>{});return work;
 };
 try{
  owned=await fs.mkdtemp(path.join(profile,'mouse635-library-'));const stamp=Date.now(),downloads=[];
  for(let n=0;n<14;n++){const file=path.join(owned,'image-'+n+'.png'),data=image(n+1);await fs.writeFile(file,data);downloads.push({id:'mouse635-'+randomUUID(),filename:path.basename(file),path:file,url:'https://owned-fixture.invalid/image-'+n+'.png',state:'completed',received:data.length,total:data.length,at:stamp-n*1000});}
  const active={id:'mouse635-'+randomUUID(),filename:'owned-progress.zip',state:'progressing',received:1,total:100,at:stamp+1};lib.data.downloads=[active,...downloads,...original.downloads];
  const copies=[];for(let n=0;n<14;n++)copies.push(await addCapture('image',image(n+31),'Mouse635 image '+n));await addCapture('text',Buffer.from('Mouse635 owned read-only capture\nNo clipboard input.'),'Mouse635 text');
  facts.owned={downloadIds:downloads.map(row=>row.id),activeId:active.id,captureIds:[...ownedCaptureIds],fileHashes:await Promise.all(downloads.map(async row=>({id:row.id,filename:row.filename,sha256:hash(await fs.readFile(row.path))})))};await save();
  for(const theme of ['light','dark'])for(const kind of ['downloads','captures'])for(const view of ['list','grid']){
   await stage('library-'+kind+'-'+view+'-'+theme,async()=>{
    await js(`MouseTest.setTheme(${JSON.stringify(theme)});MouseTest.browsing.open(${JSON.stringify(kind)})`);await click('#library-'+view);
    const id=kind==='downloads'?downloads[5].id:copies[8].id,target=selector(id);
    await js(`document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'center'});true`);
    await fixture.until(()=>js(`(()=>{const i=document.querySelector(${JSON.stringify(target+' .library-icon')});return i?.dataset.loaded==='true'&&i.naturalWidth>0;})()`),'Owned library thumbnail decoded');
    await click(target+' .library-check');await fixture.until(()=>js(`document.querySelector(${JSON.stringify(target+' .library-check')}).checked`),'Native checkbox selected');
    await js(`document.querySelector(${JSON.stringify(target+' .library-check')}).focus();true`);await fixture.frame();
    const before=await probe(id);assert.equal(before.kind,kind);assert.equal(before.view,view);assert.equal(before.theme,theme);assert.equal(before.selected,true);assert.equal(before.focused,true);assert.ok(before.scrollTop>0,'The owned file list is genuinely scrolled');const previewStart=facts.previewRequests.length;
    for(let n=0;n<6;n++){active.received=10+n;notify(kind==='captures'?'other-kind download progress':'same-kind download progress');await sleep(130);}
    // Await the actual renderer refresh too, rather than trusting an arbitrary
    // sleep or only a sampled frame after the rows have already flickered.
    await js('MouseTest.browsing.render()');await fixture.frame();const after=await sample();stable(before,after);
    if(kind==='downloads'){after.activeProgress=await js(`document.querySelector(${JSON.stringify(selector(active.id)+' progress')}).value`);assert.equal(after.activeProgress,15,'Real progress DOM receives the final model update');}
    const backgroundArchivePreviewCalls=facts.previewRequests.length-previewStart;if(kind==='captures')assert.equal(backgroundArchivePreviewCalls,0,'Background download updates do not re-decode archive thumbnails');
    const extra=await addCapture('text',Buffer.from('Mouse635 inserted '+theme+' '+kind+' '+view+' '+randomUUID()),'Mouse635 new capture');await js('MouseTest.browsing.render()');await fixture.frame();const inserted=await sample();stable(before,inserted,{scroll:kind!=='captures',order:kind!=='captures'});if(kind==='captures')assert.ok(inserted.order.includes(extra.id));
    await archive.remove([extra.id]);await js('MouseTest.browsing.render()');await fixture.frame();const removed=await sample();stable(before,removed);
    const capture=await screenCapture('mouse-635-library-'+kind+'-'+view+'-'+theme);facts.captures.push(capture);facts.phases.push({theme,kind,view,before,after,inserted,removed,updates:6,backgroundArchivePreviewCalls,archivePreviewCalls:facts.previewRequests.length-previewStart,capture});await stopProbe();await save();
   });
  }
  await stage('library-file-change',async()=>{
   await js('MouseTest.browsing.open("downloads")');await click('#library-grid');const row=downloads[5],target=selector(row.id);await js(`document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'center'});true`);await fixture.until(()=>js(`document.querySelector(${JSON.stringify(target+' .library-icon')})?.classList.contains('library-thumbnail')`),'Download thumbnail before file replacement');await click(target+' .library-check');await js(`document.querySelector(${JSON.stringify(target+' .library-check')}).focus();true`);await fixture.frame();
   const fileReceipt=async filename=>{const raw=await fs.readFile(row.path);await fs.writeFile(filename,raw);return{filename,source:'fs.readFile of owned installed-app fixture',bytes:raw.length,sha256:hash(raw),pixelSize:{width:raw.readUInt32BE(16),height:raw.readUInt32BE(20)}};};
   const originalFile=await fileReceipt('mouse-635-library-file-before.png'),before=await probe(row.id),replacement=image(93);await fs.writeFile(row.path,replacement);const replacementFile=await fileReceipt('mouse-635-library-file-after.png');const future=new Date(Date.now()+2000);await fs.utimes(row.path,future,future);notify('actual owned image bytes replaced');
   await fixture.until(async()=>{const result=await sample();return !result.sameSource&&result.thumbnail&&result.imageSize.width>0;},'Actual changed image reaches existing thumbnail');const changed=await sample();stable(before,changed,{source:false});assert.equal(changed.sourceWrites,1);const changedDigest=hash(await fs.readFile(row.path));assert.equal(changedDigest,hash(replacement));await stopProbe();
   const beforeDelete=await probe(row.id);await fs.rm(row.path);await assert.rejects(fs.lstat(row.path),{code:'ENOENT'});notify('actual owned download file removed');await fixture.until(async()=>!(await sample()).thumbnail,'Missing file loses stale image preview');const deleted=await sample();stable(beforeDelete,deleted,{source:false});assert.notEqual(deleted.source,beforeDelete.source);const openError=await js(`MouseNative.library('download',{id:${JSON.stringify(row.id)},action:'open'}).then(()=>null,error=>String(error.message))`);assert.match(openError,/перемещён или удалён/);facts.files={before,changed,beforeDelete,deleted,originalFile,replacementFile,replacementSha256:changedDigest,missingOnDisk:true,missingOpenError:openError,entryRetained:lib.data.downloads.includes(row)};await stopProbe();await save();
  });
  await stage('library-preview-order',async()=>{
   await js('MouseTest.browsing.open("captures")');await click('#library-list');const first=copies[8],second=copies[7],target=selector(first.id);await js(`document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'center'});true`);await fixture.until(()=>js(`document.querySelector(${JSON.stringify(target+' .library-icon')})?.dataset.loaded==='true'`),'Capture thumbnail ready before delay');
   const gate=hold(first.id);await click(target+' .library-name');await fixture.until(()=>gate.entered,'Actual archive preview request enters controlled delay');active.received=81;notify('download update while explicit capture preview pending');await js('MouseTest.browsing.render()');gate.release();await fixture.until(()=>js('document.querySelector("#local-preview-dialog").open'),'Explicit preview survives background refresh');const firstPreview=await js('({title:document.querySelector("#local-preview-title").textContent,src:document.querySelector(".local-preview-body img").src})');assert.equal(firstPreview.title,first.title);await click('#local-preview-dialog header button');
   await js(`document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'center'});true`);const stale=hold(first.id);await click(target+' .library-name');await fixture.until(()=>stale.entered,'Older preview is pending');const secondTarget=selector(second.id);await js(`document.querySelector(${JSON.stringify(secondTarget)}).scrollIntoView({block:'center'});true`);await click(secondTarget+' .library-name');await fixture.until(()=>js(`document.querySelector('#local-preview-dialog').open&&document.querySelector('#local-preview-title').textContent===${JSON.stringify(second.title)}`),'Latest user preview wins');stale.release();await fixture.until(()=>pending.size===0,'Older real file read completes');await fixture.frame();const latest=await js('({title:document.querySelector("#local-preview-title").textContent,src:document.querySelector(".local-preview-body img").src})');assert.equal(latest.title,second.title);await click('#local-preview-dialog header button');
   const closed=hold(first.id);await js(`document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'center'});true`);await click(target+' .library-name');await fixture.until(()=>closed.entered,'Preview pending before section change');await click('[data-library=downloads]');closed.release();await fixture.until(()=>pending.size===0,'Obsolete preview completes');await fixture.frame();const staleClosed=await js('({open:document.querySelector("#local-preview-dialog").open,kind:document.querySelector("#library-dialog").dataset.kind})');assert.deepEqual(staleClosed,{open:false,kind:'downloads'});facts.previews={firstPreview,latest,staleClosed,realArchiveReads:true};await save();
  });
  facts.completed=true;
 }catch(error){primaryError=error;facts.error={message:String(error.message),stack:String(error.stack).slice(0,6000)};}
 finally{
  for(const gate of allGates)gate.release();gates.clear();archive.preview=originalPreview;
  const restore=async(label,fn)=>{try{await fn();}catch(error){cleanupError||=error;(facts.cleanupErrors||=[]).push({label,message:String(error.message)});}};
  await restore('renderer',()=>js('globalThis.mouse635LibraryProbe?.observer.disconnect();delete globalThis.mouse635LibraryProbe;const p=document.querySelector("#local-preview-dialog");if(p.open)p.close();MouseTest.browsing.close();true'));
  await restore('pending previews',()=>fixture.until(()=>pending.size===0,'Library preview cleanup',1500));
  await restore('library',async()=>{lib.data=original;await libraryService.flush();assert.deepEqual(lib.data,original);});
  await restore('archive',async()=>{await archive.remove(ownedCaptureIds);assert.deepEqual(archive.items,originalArchive);assert.equal(archive.enabled,archiveBefore.enabled);assert.equal(archive.folder,archiveBefore.folder);assert.equal(archive.reads,readsBefore);});
  if(owned)await restore('owned files',()=>fs.rm(owned,{recursive:true,force:true}));
  facts.restored=!cleanupError;facts.autoCollection={before:archiveBefore.enabled,after:archive.enabled,clipboardReadsBefore:readsBefore,clipboardReadsAfter:archive.reads};facts.finishedAt=new Date().toISOString();facts.ok=!!facts.completed&&!primaryError&&!cleanupError;await save();
 }
 if(primaryError||cleanupError)throw primaryError||cleanupError;console.log('MOUSE_635_LIBRARY_STABLE_PASS');return{...facts,reportFile:'mouse-635-library.json',reportSha256:hash(await fs.readFile('mouse-635-library.json'))};
};
module.exports.installLibraryProbe=installLibraryProbe;
module.exports.sampleLibraryProbe=sampleLibraryProbe;
module.exports.assertStable=stable;
