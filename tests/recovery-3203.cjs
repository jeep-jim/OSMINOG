// Run: OSMINOG_CHROMIUM=/path/to/chromium node tests/recovery-3203.cjs
// Real Chromium DOM/events; Chrome transport/storage and file handle are mocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.OSMINOG_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,r=>r.abort());
 await page.addInitScript(()=>{
  const store={};const event={addListener(){},removeListener(){}};
  const get=(keys,cb)=>{const value=typeof keys==='string'?{[keys]:store[keys]}:Array.isArray(keys)?Object.fromEntries(keys.map(k=>[k,store[k]])):{...store};cb?.(value);return Promise.resolve(value)};
  window.__messages=[];window.__store=store;window.__grant=false;window.__connectOK=true;window.__tabsCreated=0;
  window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'3.20.3'}),onMessage:event,sendMessage:async m=>{window.__messages.push(m);if(m.type==='BC_EXTERNAL_CONNECT_CHATGPT')return window.__connectOK?{ok:true,tabId:42}:{ok:false,error:'No existing ChatGPT tab'};if(m.type==='BC_EXTERNAL_CONTEXT_UPDATE')return{ok:true};return{ok:false,error:'Offline test'}}},storage:{local:{get,set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async keys=>{for(const k of [].concat(keys))delete store[k]}},onChanged:event},permissions:{contains:async()=>window.__grant,request:async()=>{window.__grant=true;return true}},tabs:{getCurrent:async()=>({id:1,windowId:1}),query:async()=>[],create:async()=>{window.__tabsCreated++;return{id:999}}},i18n:{getMessage:()=>''}};
 });
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../editor.html')).href);
  await page.waitForFunction(()=>!!globalThis.OSMINOGWindowsFolders&&!!globalThis.BriefCraftBridge);
  await page.waitForTimeout(500);
  await page.evaluate(()=>{createProject();sessionStorage.setItem('osminogIntroDismissedV1','1');renderAll()});
  // A new text object selected in the inspector used to starve the event loop.
  const textId=await page.evaluate(()=>createObject('text',{name:'Formatted',text:'Hello OSMINOG',fontWeight:400}).id);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.graphics-v2-sidecar').count(),1);
  await page.evaluate(id=>{document.querySelector('#inspector').classList.remove('collapsed');const f=document.querySelector(`[data-id="${id}"] [contenteditable]`);f.focus();const r=document.createRange();r.selectNodeContents(f);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);f.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))},textId);
  await page.locator('[data-format="bold"]').click();
  assert.match(await page.evaluate(id=>objects().find(o=>o.id===id).html,textId),/<(b|strong)>/);
  await page.evaluate(()=>applyTextFormat('italic'));
  await page.evaluate(()=>{renderAll(true);renderInspector()});
  await page.waitForTimeout(250);
  assert.match(await page.evaluate(id=>objects().find(o=>o.id===id).html,textId),/<(i|em)>/);
  assert.equal(await page.locator('.graphics-v2-sidecar').count(),1);
  await page.evaluate(()=>persist());
  assert.match(await page.evaluate(id=>__store.briefCraftStudioV2.projects.flatMap(p=>p.objects).find(o=>o.id===id).html,textId),/<(b|strong)>/);
  console.log('PASS text creation, bold/italic, persistence, rerender and responsive inspector');
  // Native File/DataTransfer drop: each user drop imports exactly once, including repeats.
  for(let attempt=0;attempt<2;attempt++){
   await page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'drop.png',{type:'image/png'}));document.querySelector('#viewport').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:650,clientY:400}))});
   await page.waitForFunction(n=>objects().filter(o=>o.name==='drop.png').length===n,attempt+1);
  }
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>objects().filter(o=>o.name==='drop.png').length),2);
  console.log('PASS native image drops: one object per drop, repeat accepted');
  const moved=await page.evaluate(()=>{const o=objects().find(o=>o.name==='drop.png'),f=OSMINOGWindowsFolders.create({name:'Test folder',rename:false});OSMINOGWindowsFolders.moveObject(o.id,f.id);OSMINOGWindowsFolders.openVirtual(f.id);return{id:o.id,folder:f.id,count:objects().length}});
  await page.waitForFunction(id=>!!document.querySelector(`[data-item-key="obj:${id}"]`),moved.id);
  await page.evaluate(id=>{const dt=new DataTransfer(),el=document.querySelector(`[data-item-key="obj:${id}"]`);el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));document.querySelector('#viewport').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:750,clientY:450}));el.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}))},moved.id);
  await page.waitForFunction(id=>!objects().find(o=>o.id===id).osminogFolderId,moved.id);
  assert.equal(await page.evaluate(()=>objects().length),moved.count);
  assert.equal(await page.evaluate(x=>OSMINOGWindowsFolders.list().find(f=>f.id===x.folder).members.includes(x.id),moved),false);
  console.log('PASS internal folder image move preserves ID and does not duplicate');
  // Original project file, including content beyond the old preview limit.
  await page.evaluate(()=>{
   projectFileHandle=async()=>({handle:{getFile:async()=>new File(['x'.repeat(260001)],'complete.txt',{type:'text/plain'})}});
   OSMINOGProjectFolderAPI.list=async()=>({entries:[{path:'complete.txt',kind:'file',type:'text/plain',size:260001}]});
   OSMINOGWindowsFolders.openRoot();
  });
  await page.waitForFunction(()=>!!document.querySelector('[data-item-key="fs:complete.txt"]'));
  await page.evaluate(()=>{const dt=new DataTransfer(),el=document.querySelector('[data-item-key="fs:complete.txt"]');el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));document.querySelector('#viewport').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:750,clientY:450}));el.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}))});
  await page.waitForFunction(()=>objects().some(o=>o.fileName==='complete.txt'));
  assert.equal(await page.evaluate(()=>atob(objects().find(o=>o.fileName==='complete.txt').src.split(',')[1]).length),260001);
  console.log('PASS internal real file import retains all 260001 bytes');
  // Access control routes through existing external Presence, not managed service tabs.
  await page.evaluate(()=>document.querySelector('#osminogWindowsExplorer').hidden=true);
  await page.locator('#collabShare').click();
  assert.equal(await page.locator('#collabPopover').isVisible(),true);
  await page.evaluate(()=>{document.querySelector('#externalChatGptRole').value='edit'});
  await page.locator('#connectExternalChatGpt').click();
  await page.waitForFunction(()=>BriefCraftBridge.externalPresenceStatus().connected&&!document.querySelector('#connectExternalChatGpt').disabled);
  const connection=await page.evaluate(()=>({calls:__messages.filter(m=>m.type==='BC_EXTERNAL_CONNECT_CHATGPT').map(m=>({role:m.role,canEdit:m.context.externalAccess.canEdit})),created:__tabsCreated,role:BriefCraftBridge.externalPresenceStatus().role}));
  assert.deepEqual(connection,{calls:[{role:'edit',canEdit:true}],created:0,role:'edit'});
  assert.match(await page.locator('#externalChatGptState').innerText(),/Подключён/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#collabPopover').isVisible(),false);
  console.log('PASS screenshot-style access panel, current ChatGPT edit role, no new tabs');
  assert.deepEqual(errors,[]);
  console.log('PASS no uncaught page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
