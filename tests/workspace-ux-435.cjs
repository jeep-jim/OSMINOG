'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;
 const passed=[],check=s=>{passed.push(s);console.log('PASS '+s)};
 try{
  fs.mkdirSync('artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM?{executablePath:process.env.TEST_CHROMIUM}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
  await page.addInitScript(()=>{const store={},listeners=[],event={addListener(){},removeListener(){}};window.__store=store;window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.35'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},storage:{local:{get:(keys,cb)=>{const v=typeof keys==='string'?{[keys]:structuredClone(store[keys])}:{...structuredClone(store)};cb?.(v);return Promise.resolve(v)},set:(values,cb)=>{const changes={};for(const [key,value]of Object.entries(values)){if(JSON.stringify(value)!==JSON.stringify(store[key]))changes[key]={oldValue:structuredClone(store[key]),newValue:structuredClone(value)};store[key]=structuredClone(value)}cb?.();if(Object.keys(changes).length)queueMicrotask(()=>listeners.forEach(fn=>fn(changes,'local')));return Promise.resolve()},remove:async key=>{delete store[key]}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}}},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async x=>({id:2,...x})},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/editor.html');
  await page.waitForFunction(()=>!!window.OSMINOGWorkdesk&&!!window.OSMINOGWindowsFolders&&!!window.OSMINOLibrary);
  await page.evaluate(async()=>{
   await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();
   const p=project();p.objects=[];p.osminogFolders=[];p.activeDesktop='main';const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2ioAAAAASUVORK5CYII=';
   for(let i=0;i<40;i++)p.objects.push({...objectDefaults('image'),id:'gallery-'+i,type:'image',name:'Screenshot '+i,src,x:i*12,y:0,w:120,h:80,osminogDesktopId:'main'});
   p.objects.push({...objectDefaults('image'),id:'inactive-image',type:'image',name:'Other desk image',src,osminogDesktopId:'other'});
   p.objects.push({...objectDefaults('image'),id:'folder-image',type:'image',name:'Folder image',src,osminogDesktopId:'main',osminogFolderId:'folder-1'});
   state.selected=[];state.ui.layersTab='files';renderAll(true);
  });
  await page.locator('#layersToggle').click();await page.waitForSelector('#layersPanel.open');
  await page.locator('#layersPanel .panel-tabs button').nth(1).click();await page.waitForSelector('.bc-file-tile');
  assert.equal(await page.locator('.bc-file-tile').count(),36,'first gallery page is bounded');
  assert.equal(await page.locator('[data-files-more]').count(),1);
  assert.equal(await page.locator('[data-file-id="inactive-image"]').count(),0,'inactive desktop assets must not leak into this desk');
  assert.equal(await page.locator('[data-file-id="folder-image"]').count(),0,'folder assets must remain in their folder');
  const grid=await page.locator('#layerList').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns.split(' ').length,firstHeight:el.querySelector('.bc-file-tile').getBoundingClientRect().height,lazy:el.querySelector('.bc-file-tile img')?.loading}));
  assert.equal(grid.columns,2,JSON.stringify(grid));assert(grid.firstHeight>=148,JSON.stringify(grid));assert.equal(grid.lazy,'lazy',JSON.stringify(grid));
  await page.locator('[data-files-more]').click();assert.equal(await page.locator('.bc-file-tile').count(),40);check('roomy two-column gallery, lazy thumbnails, 36-item paging and current-desk-only media');
  await page.locator('.bc-file-tile').first().click();await page.waitForSelector('.osminog-media-preview');
  const previewActions=await page.locator('.osminog-media-preview footer button').allTextContents();
  for(const label of ['Add to canvas','Download','Copy','Properties','Close'])assert(previewActions.includes(label),JSON.stringify(previewActions));
  await page.locator('.osminog-media-preview header button').click();check('single-click media preview opens a full modal with canvas, download, copy and properties actions');
  const churn=await page.evaluate(()=>{
   const root=document.querySelector('#layerList');let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(root,{childList:true,subtree:true});
   const first=root.querySelector('.bc-file-tile');for(let i=0;i<120;i++)renderLayers();observer.disconnect();
   return{mutations,same:first===root.querySelector('.bc-file-tile')};
  });
  assert.equal(churn.mutations,0,JSON.stringify(churn));assert.equal(churn.same,true);check('120 unchanged Layers redraws do not rebuild the file gallery or reload image elements');
  const exportState=await page.evaluate(()=>{state.selected=[];renderInspector();return{disabled:document.querySelector('#exportBtn').disabled,count:OSMINOGEditorAPI.selected().length}});
  assert.equal(exportState.disabled,false,JSON.stringify(exportState));await page.locator('#exportBtn').click();assert.equal(await page.locator('#exportMenu').evaluate(el=>el.hidden),false);await page.locator('#exportBtn').click();check('Export remains available without a selection and opens the existing format menu for current-desk content');
  const layout=await page.evaluate(()=>{
   document.body.dataset.workdesk='true';document.body.classList.add('desk-chat-open','unified-inspector');
   const chat=document.querySelector('#bridgePanel');chat.hidden=false;
   OSMINOGLibrary.open('search');
   const a=document.querySelector('#osminogLibrary').getBoundingClientRect(),b=chat.getBoundingClientRect();
   return{libraryRight:a.right,chatLeft:b.left,chatRight:b.right,viewport:innerWidth};
  });
  assert(Math.abs(layout.libraryRight-layout.chatLeft)<2,JSON.stringify(layout));assert(Math.abs(layout.chatRight-layout.viewport)<2,JSON.stringify(layout));check('saved-material search panel docks immediately left of the chat without overlap');
  const langs=await page.evaluate(()=>{
   const expected={de:'Papierkorb',es:'Papelera',ja:'ゴミ箱',zh:'回收站'},out={};
   document.querySelector('#app').hidden=true;document.querySelector('#welcome').hidden=false;
   for(const [lang,label] of Object.entries(expected)){state.language=lang;applyLanguage();showHub();out[lang]=document.querySelector('#trashToggle').textContent}
   return out;
  });
  for(const [lang,label]of Object.entries({de:'Papierkorb',es:'Papelera',ja:'ゴミ箱',zh:'回收站'}))assert(langs[lang].includes(label),JSON.stringify(langs));
  const trashTitles=await page.evaluate(()=>{const expected={de:'Projekt-Papierkorb',es:'Papelera de proyectos',ja:'プロジェクトのゴミ箱',zh:'项目回收站'},out={};for(const [lang]of Object.entries(expected)){state.language=lang;applyLanguage();showHub();document.querySelector('#trashToggle').click();out[lang]=document.querySelector('#projectHub h2').textContent;document.querySelector('#trashToggle').click()}return out});
  for(const [lang,label]of Object.entries({de:'Projekt-Papierkorb',es:'Papelera de proyectos',ja:'プロジェクトのゴミ箱',zh:'项目回收站'}))assert.equal(trashTitles[lang],label,JSON.stringify(trashTitles));
  const preview=await page.locator('#projectGrid .project-card').first().evaluate(el=>({images:el.querySelectorAll('.project-mini-image img').length,lazy:el.querySelector('.project-mini-image img')?.loading}));
  assert(preview.images<=1,JSON.stringify(preview));if(preview.images)assert.equal(preview.lazy,'lazy');check('project hub actions translate in German, Spanish, Japanese and Chinese; each project preview loads at most one lazy image');
  assert.deepEqual(errors,[]);fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/workspace-ux-435-results.json',JSON.stringify({passed,errors,layout,grid,churn,langs,preview},null,2));
 }catch(error){if(page)await page.screenshot({path:'artifacts/workspace-ux-435-failure.png'}).catch(()=>{});throw error}
 finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exit(1)});
