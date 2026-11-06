const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const name=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!name.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(name,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({locale:'ru-RU',viewport:{width:1400,height:1000}});page.setDefaultTimeout(10000);await page.route('https://**',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const store={osminogDisplayPrefs:{language:'ru',theme:'dark'}},event={addListener(){},removeListener(){}};window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.23'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},storage:{local:{get:(keys,cb)=>{const value=typeof keys==='string'?{[keys]:store[keys]}:{...store};cb?.(value);return Promise.resolve(value)},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async()=>{}},onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async args=>{window.__opened=args.url;return{id:2,...args}}},permissions:{contains:async()=>false,request:async()=>false},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}}});
  await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForSelector('#osminogStorageOnboarding[open]');
  // Onboarding is localized now; check its current copy rather than removed text.
  const onboarding=page.locator('#osminogStorageOnboarding');
  const copy=await page.evaluate(()=>({body:OSMINOGWorkspaceLanguage.text('storageBody'),choose:OSMINOGWorkspaceLanguage.text('choose')}));
  assert.ok(typeof copy.body==='string' && copy.body.length>20, 'storage explanation is present');
  assert.ok((await onboarding.innerText()).includes(copy.body), 'onboarding uses localized storage guidance');
  await page.evaluate(()=>{OSMINOGProjectFolderAPI.choose=async()=>{window.__chosen=true;return true}});await onboarding.getByRole('button',{name:copy.choose,exact:true}).click();assert.equal(await page.evaluate(()=>window.__chosen),true);
  await page.evaluate(()=>{createProject();renderAll()});
  await page.evaluate(async()=>{const id=project().id;await chrome.storage.local.set({[`briefCraftGptLiteChat:${id}:main`]:Array.from({length:300},(_,i)=>({id:'m'+i,role:'user',text:'history '+i,at:i}))});await BriefCraftBridge.open()});assert.equal(await page.locator('#gptPresenceMessages .local-ai-msg').count(),80);await page.getByRole('button',{name:/Показать предыдущие сообщения/}).click();assert.equal(await page.locator('#gptPresenceMessages .local-ai-msg').count(),160);
  await page.evaluate(async()=>{const key=`briefCraftGptLiteChat:${project().id}:main`;await chrome.storage.local.set({[key]:[{id:'choice',role:'assistant',source:'media-choice',text:'найди изображение или сгенерируй картинку'}]});await BriefCraftBridge.open()});await page.getByRole('button',{name:'Найти в интернете',exact:true}).waitFor({state:'visible'});assert.equal(await page.getByRole('button',{name:'Найти в интернете',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Сгенерировать',exact:true}).count(),1);
  // The original BrowserApp is restored as a managed window; old canvas browser
  // embed entrypoints remain retired and stored links stay project-scoped.
  assert.equal(await page.evaluate(()=>typeof OSMINOGBrowserApp?.open),'function');
  assert.equal(await page.evaluate(()=>typeof OSMINOGWindowManager?.register),'function');
  assert.equal(await page.locator('script[src="osminog-browser-app.js"]').count(),1);
  assert.equal(await page.locator('#workspaceBrowserMode,[data-mode="browser"],[data-tool="browser"]').count(),0);
  for(const name of ['browser_load_html','browser_export','browser_edit_current','browser_extract_current'])assert.equal(await page.evaluate(name=>OSMINOGToolEnabled(name),name),false);
  const stored=await page.evaluate(async()=>{document.querySelector('#bridgePanel').hidden=true;const p=project();p.browserDocuments=[{id:'retained-html',title:'Previous document',html:'<h1>Preserved HTML</h1>',css:'h1{color:red}'}];const o=createObject('browser',{name:'Previous link',url:'https://example.com/retained',x:250,y:120,w:360,h:180});await persist();renderAll(true);return{project:p.id,object:o.id,documents:JSON.stringify(p.browserDocuments)}});
  assert.equal(await page.locator(`.canvas-object[data-id="${stored.object}"] iframe`).count(),0);
  await page.locator(`.canvas-object[data-id="${stored.object}"] [data-open-saved-link]`).click();assert.equal(await page.evaluate(()=>window.__opened),'https://example.com/retained');
  await page.evaluate(()=>createProject());assert.equal(await page.evaluate(()=>objects().some(o=>o.url==='https://example.com/retained')),false);
  await page.evaluate(id=>openProject(id),stored.project);
  assert.equal(await page.evaluate(()=>JSON.stringify(project().browserDocuments)),stored.documents);
  assert.equal(await page.evaluate(id=>objects().find(o=>o.id===id).url,stored.object),'https://example.com/retained');
  assert.deepEqual(errors,[]);
  console.log('PASS first-folder onboarding, paged chat history, media choices, retired browser, safe retained links and project isolation');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
