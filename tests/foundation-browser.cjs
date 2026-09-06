const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const name=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!name.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(name,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1400,height:1000}});page.setDefaultTimeout(10000);await page.route('https://**',route=>route.abort());
  await page.addInitScript(()=>{const store={},event={addListener(){},removeListener(){}};window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'3.21.0'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},storage:{local:{get:(keys,cb)=>{const value=typeof keys==='string'?{[keys]:store[keys]}:{...store};cb?.(value);return Promise.resolve(value)},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async()=>{}},onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[]},permissions:{contains:async()=>false,request:async()=>false},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}}});
  await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForSelector('#osminogStorageOnboarding[open]');
  assert.match(await page.locator('#osminogStorageOnboarding').innerText(),/Вход в аккаунт сам по себе файлы не переносит/);
  // Test the onboarding action without opening an OS-native chooser on CI.
  await page.evaluate(()=>{OSMINOGProjectFolderAPI.choose=async()=>{window.__chosen=true;return true}});await page.locator('#osminogStorageOnboarding button').click();assert.equal(await page.evaluate(()=>window.__chosen),true);
  await page.evaluate(()=>{createProject();renderAll();window.__writes=[];OSMINOGProjectFolderAPI.write=async args=>{__writes.push(args);return{ok:true,path:args.path,size:args.content.length}}});
  const loaded=await page.evaluate(()=>OSMINOGBrowserApp.loadHtml({title:'Fixture',html:'<!doctype html><html><body><h1 id="title">Before</h1><p>Preserved</p></body></html>'}));assert.equal(loaded.ok,true);
  const frame=page.frameLocator('[data-browser-frame]');await frame.locator('#title').click();
  await page.locator('[data-web-text]').fill('After manual edit');await page.locator('[data-web-apply]').click();
  const result=await page.evaluate(()=>OSMINOGBrowserApp.exportFiles({path:'exports/test/index.html'}));assert.equal(result.ok,true);
  const saved=await page.evaluate(()=>__writes.at(-1));assert.match(saved.content,/After manual edit/);assert.match(saved.content,/Preserved/);assert.equal(saved.path,'exports/test/index.html');
  await page.evaluate(()=>createProject());assert.equal(await page.evaluate(()=>OSMINOGBrowserApp.context()),null);assert.equal((await page.evaluate(()=>OSMINOGBrowserApp.exportFiles())).ok,undefined);
  console.log('PASS first-folder onboarding; load HTML, manual inspector edit, exported DOM and cross-project isolation');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
