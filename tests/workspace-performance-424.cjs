'use strict';
// Rendered UI fixture, not a claim about performance on the owner's device.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(process.env.OSMINOG_EXTENSION_ROOT||path.join(__dirname,'..'));
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;const errors=[],passed=[];let redrawMs;
 const check=label=>{passed.push(label);console.log('PASS '+label)};
 function fixture(){
  const store={},listeners=[],event={addListener(){},removeListener(){}};window.__store=store;
  // Offline rendering can use about:blank without opening a network connection.
  if(location.protocol==='about:')for(const key of ['localStorage','sessionStorage']){const memory=new Map();Object.defineProperty(window,key,{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}})}
  window.chrome={runtime:{getURL:p=>'https://workspace-fixture.test/'+p,getManifest:()=>({version:'4.0.24'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},storage:{local:{get:(keys,cb)=>{const v=typeof keys==='string'?{[keys]:structuredClone(store[keys])}:{...structuredClone(store)};cb?.(v);return Promise.resolve(v)},set:(values,cb)=>{const changes={};for(const [key,value]of Object.entries(values)){if(JSON.stringify(value)!==JSON.stringify(store[key]))changes[key]={oldValue:structuredClone(store[key]),newValue:structuredClone(value)};store[key]=structuredClone(value)}cb?.();if(Object.keys(changes).length)queueMicrotask(()=>listeners.forEach(fn=>fn(changes,'local')));return Promise.resolve()},remove:async key=>delete store[key]},onChanged:{addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}}},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async x=>({id:2,...x})},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}};
 }
 try{
  fs.mkdirSync('artifacts',{recursive:true});browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM?{executablePath:process.env.TEST_CHROMIUM}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
  if(process.env.WORKSPACE_INLINE==='1'){
   await page.evaluate(fixture);let html=fs.readFileSync(path.join(root,'editor.html'),'utf8');
   html=html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g,tag=>{const m=tag.match(/href="([^"]+)"/);return m&&fs.existsSync(path.join(root,m[1]))?'<style>'+fs.readFileSync(path.join(root,m[1]),'utf8')+'</style>':tag});
   html=html.replace(/<script\s+src="([^"]+)"[^>]*><\/script>/g,(tag,file)=>fs.existsSync(path.join(root,file))?'<script>'+fs.readFileSync(path.join(root,file),'utf8').replace(/<\/script/gi,'<\\/script')+'\n</script>':tag);
   await page.setContent(html,{waitUntil:'domcontentloaded'});
  }else{await page.addInitScript(fixture);await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`)}
  await page.waitForFunction(()=>!!window.OSMINOGWindowsFolders&&!!window.OSMINOGWorkspacePolish);
  const ids=await page.evaluate(async()=>{
   await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();state.language='ru';state.theme='dark';applyTheme();const p=project();p.objects=[];p.osminogFolders=[];p.groups=[];p.connections=[];
   const f=OSMINOGWindowsFolders.create({name:'Архив',rename:false});f.screenX=540;f.screenY=300;
   const payload='Большой сохранённый текст без изменений. '.repeat(60);
   for(let i=0;i<1200;i++){const o={...objectDefaults('brief'),id:'perf-'+i,name:'Материал '+i,text:payload+'needle-'+i,osminogFolderId:f.id};p.objects.push(o);f.members.push(o.id)}
   state.selected=[];state.ui.layersTab='layers';await chrome.storage.local.set({osminogCollectorV1:{projectId:p.id,folderId:f.id,enabled:false}});renderAll(true);return {folder:f.id,project:p.id};
  });
  await page.locator('#layersToggle').click();await page.waitForSelector('#layersPanel.open');await page.waitForSelector('.cl-stored');
  assert.equal(await page.locator('.cl-stored').count(),80);assert.match(await page.locator('.cl-stored-heading').textContent(),/1200/);check('1200 stored objects stay discoverable with only 80 live rows');
  await page.locator('[data-stored-page="1"]').click();assert.equal(await page.locator('.cl-stored').first().getAttribute('data-stored-id'),'perf-80');
  await page.locator('#layerSearch').fill('needle-1199');assert.equal(await page.locator('.cl-stored').count(),1);assert.equal(await page.locator('.cl-stored').first().getAttribute('data-stored-id'),'perf-1199');
  await page.evaluate(()=>{objects().find(o=>o.id==='perf-1199').text='changed';renderLayers()});assert.equal(await page.locator('.cl-stored').count(),0);await page.locator('#layerSearch').fill('');check('pagination and full-archive text search remain live after in-place edits');
  await page.waitForTimeout(400);
  const budget=await page.evaluate(async()=>{
   renderLayers();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const root=document.querySelector('#layerList'),first=root.querySelector('.cl-stored');let mutations=0;
   const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(root,{childList:true,subtree:true});
   const start=performance.now();for(let i=0;i<120;i++){renderLayers();root.getBoundingClientRect()}const duration=performance.now()-start;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));observer.disconnect();return {duration,mutations,same:first===root.querySelector('.cl-stored')};
  });redrawMs=budget.duration;assert.equal(budget.mutations,0,JSON.stringify(budget));assert(budget.same);assert(redrawMs<2500,JSON.stringify(budget));check('120 identical redraw requests preserve the DOM; '+redrawMs.toFixed(1)+' ms in this runner');
  const statusOnly=await page.evaluate(async()=>{let changes=0;const root=document.querySelector('#layerList'),observer=new MutationObserver(r=>changes+=r.length);observer.observe(root,{childList:true,subtree:true});for(let i=0;i<5;i++){await chrome.storage.local.set({osminogCollectorV1:{...__store.osminogCollectorV1,lastCapture:i+1,lastHash:'hash-'+i}});await new Promise(r=>setTimeout(r,10))}observer.disconnect();return changes});assert.equal(statusOnly,0);check('collector status and hash changes do not reconstruct Layers');
  await page.locator('#layersToggle').click();await page.waitForTimeout(300);
  await page.evaluate(()=>{checkpoint();project().objects=objects().filter(o=>o.id!=='perf-1198');renderAll(true)});
  const badge=`[data-win-folder-id="${ids.folder}"]>small`;
  await page.waitForFunction(selector=>document.querySelector(selector)?.textContent==='1199',badge);
  await page.evaluate(()=>document.querySelector('#undo').click());await page.waitForFunction(selector=>document.querySelector(selector)?.textContent==='1200',badge);
  await page.locator('#layersToggle').click();await page.waitForSelector('#layersPanel.open');assert.match(await page.locator('.cl-stored-heading').textContent(),/1200/);check('hidden Layers do not block live folder counters or Undo; reopening shows current state');
  await page.evaluate(()=>{const g=document.createElement('div');g.id='perf-eye';g.className='ai-canvas-ghost active';g.style.transform='translate3d(780px,420px,0)';g.innerHTML='<div class="ai-ghost-wisp"><i></i><i></i><b></b></div><small>Готовлю ответ</small>';document.body.append(g);OSMINOGWorkspacePolish.pointEye(g,100,100);OSMINOGWorkspacePolish.pointEye(g,130,110)});
  assert.notEqual(await page.locator('#perf-eye i').first().evaluate(el=>getComputedStyle(el).clipPath),'none');assert.equal(await page.locator('#perf-eye').evaluate(el=>getComputedStyle(el).filter),'none');
  await page.screenshot({path:'artifacts/workspace-424-performance-eye.png'});
  await page.locator('#perf-eye').evaluate(el=>el.classList.remove('active'));assert.equal(await page.locator('#perf-eye .ai-ghost-wisp').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('#perf-eye').evaluate(el=>el.classList.add('active'));await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#perf-eye .ai-ghost-wisp').evaluate(el=>getComputedStyle(el).animationName),'none');check('logo-shaped eye has a dark figure-eight pupil and no inactive or reduced-motion animation');
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/workspace-424-results.json',JSON.stringify({fixture:'Rendered UI with mock extension storage; not owner-device telemetry',passed,redrawMs,errors},null,2));
 }catch(error){if(page)await page.screenshot({path:'artifacts/workspace-424-failure.png'}).catch(()=>{});throw error}
 finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exit(1)});
