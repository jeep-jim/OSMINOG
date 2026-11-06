/* Real extension, real chrome.storage, real origin-private directory handles and reload.
 * The directory is a disposable browser-profile fixture, not an owner filesystem. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 const url=`chrome-extension://${id}/editor.html`,profile=fs.mkdtempSync(path.join(os.tmpdir(),'osminog-io-425-'));
 let context;const errors=[],checks=[],record=name=>{checks.push(name);console.log('PASS '+name)};
 try{
  context=await chromium.launchPersistentContext(profile,{headless:false,...(process.env.TEST_CHROMIUM?{executablePath:process.env.TEST_CHROMIUM}:{}),ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox',`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000}});
  await context.route('https://**',route=>route.abort());
  let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  await page.waitForFunction(()=>!!globalThis.OSMINOGWindowsFolders&&!!globalThis.OSMINOGLibrary&&!!globalThis.OSMINOGIOBudget);
  const ids=await page.evaluate(async()=>{
   await OSMINOGStateReady;createProject();document.querySelector('#osminogStorageOnboarding')?.close();
   const p=project();p.name='I/O recovery fixture';p.objects=[];p.osminogFolders=[];
   const f=OSMINOGWindowsFolders.create({name:'Retained material',rename:false});
   const o=createObject('brief',{name:'Unchanged note',text:'The original text must survive update'});o.osminogFolderId=f.id;f.members.push(o.id);
   const root=await navigator.storage.getDirectory();state.folderHandle=root;
   // OPFS is sandboxed by this disposable extension origin.
   if(typeof root.queryPermission!=='function')root.queryPermission=async()=> 'granted';
   if(!await handlePermission(root,false))throw Error('OPFS fixture did not grant readwrite permission');
   await savePersistentHandle('workspace',root);
   const file=await root.getFileHandle('fixture.txt',{create:true}),writer=await file.createWritable();await writer.write('directory fixture');await writer.close();
   await chrome.storage.local.set({osminogCollectorV1:{projectId:p.id,folderId:f.id,enabled:false,error:''}});
   clearTimeout(state.saveTimer);await persist();return{project:p.id,folder:f.id,note:o.id};
  });
  await page.waitForTimeout(700);
  await page.evaluate(()=>{
   window.__io={calls:0,active:0,peak:0};const list=OSMINOGProjectFolderAPI.list;
   OSMINOGProjectFolderAPI.list=async args=>{__io.calls++;__io.peak=Math.max(__io.peak,++__io.active);try{await new Promise(r=>setTimeout(r,180));return await list(args)}finally{__io.active--}};
   OSMINOGWindowsFolders.openRoot();
  });
  await page.waitForSelector('#osminogWindowsExplorerItems [data-item-key="fs:fixture.txt"]');
  const before=await page.evaluate(()=>__io.calls);
  for(let i=0;i<10;i++){await page.evaluate(async i=>{const cfg=(await chrome.storage.local.get('osminogCollectorV1')).osminogCollectorV1;await chrome.storage.local.set({osminogCollectorV1:{...cfg,lastCapture:i,lastHash:'hash'+i}})},i);await page.waitForTimeout(110)}
  assert.equal(await page.evaluate(()=>__io.calls),before,'Clipboard status alone must not reread the filesystem');record('ten clipboard status updates do not reread the real directory');
  // Explicit refreshes during slow real reads must serialize and coalesce.
  for(let i=0;i<10;i++){await page.evaluate(()=>document.dispatchEvent(new CustomEvent('osminog:project-folder-synced')));await page.waitForTimeout(25)}
  await page.waitForFunction(()=>__io.active===0);assert.equal(await page.evaluate(()=>__io.peak),1);record('folder reads have peak concurrency one under sync-event bursts');
  await page.evaluate(id=>{document.dispatchEvent(new CustomEvent('osminog:project-folder-synced'));OSMINOGWindowsFolders.openVirtual(id)},ids.folder);
  await page.waitForSelector(`#osminogWindowsExplorerItems [data-item-key="obj:${ids.note}"]`);
  await page.waitForTimeout(250);assert.equal(await page.locator('#osminogWindowsExplorerItems [data-item-key="fs:fixture.txt"]').count(),0);record('stale disk results cannot replace a newly opened virtual folder');
  const counts=await page.evaluate(()=>({...__io}));
  // No mocks of storage or project-folder writers: force concurrent requests.
  await page.evaluate(async()=>{for(let i=0;i<40;i++)project().objects.push({...objectDefaults('brief'),id:'fixture-note-'+i,name:'Fixture '+i,text:'Retained text '+i});await Promise.all(Array.from({length:25},()=>persist()))});
  const preserved=await page.evaluate(async id=>{const storage=(await chrome.storage.local.get('briefCraftStudioV2')).briefCraftStudioV2;const root=state.folderHandle,meta=await root.getDirectoryHandle('.osminog'),handle=await meta.getFileHandle('workspace-memory.json'),file=JSON.parse(await(await handle.getFile()).text());return{local:storage.projects.find(p=>p.id===id).objects.length,disk:file.projects.find(p=>p.id===id).objects.length}},ids.project);
  assert.equal(preserved.local,41);assert.equal(preserved.disk,41);record('coalesced writes preserve the latest project in real storage and directory files');
  const KEY='briefCraftReopenAfterUpdateV1';
  for(let attempt=0;attempt<2;attempt++){
   await page.evaluate(async KEY=>{await persist();await chrome.storage.local.set({[KEY]:{at:Date.now(),url:'editor.html'}});setTimeout(()=>chrome.runtime.reload(),100)},KEY);
   const deadline=Date.now()+20000;let restored=null;
   while(Date.now()<deadline){for(const candidate of context.pages()){try{if(candidate.url()!==url||candidate.isClosed())continue;const ok=await candidate.evaluate(async KEY=>!!globalThis.OSMINOGIOBudget&&!!globalThis.OSMINOGWindowsFolders&&!(await chrome.storage.local.get(KEY))[KEY],KEY);if(ok){restored=candidate;break}}catch{}}if(restored)break;await new Promise(r=>setTimeout(r,150))}
   assert(restored,'Updated editor did not reopen and acknowledge readiness');page=restored;
   await page.waitForFunction(id=>state.projects.some(p=>p.id===id),ids.project);
   assert.equal(context.pages().filter(p=>!p.isClosed()&&p.url()===url).length,1,'Reload must not duplicate editors');
   assert.equal(await page.evaluate(id=>state.projects.find(p=>p.id===id).objects.length,ids.project),41);
  }
  record('two actual extension reloads reopen exactly one editor and preserve the project');
  assert.deepEqual(errors,[]);fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/io-extension-425.png'});fs.writeFileSync('artifacts/io-extension-425-results.json',JSON.stringify({checks,counts,preserved,errors},null,2));
 }finally{await context?.close();await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})().catch(e=>{console.error(e);process.exitCode=1});
