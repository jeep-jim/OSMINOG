'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;
 try{
  fs.mkdirSync('artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM?{executablePath:process.env.TEST_CHROMIUM}:{})});
  const context=await browser.newContext({viewport:{width:1600,height:1000}});page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());
  await page.addInitScript(()=>{const store={},listeners=[],event={addListener(){},removeListener(){}};window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.36'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},storage:{local:{get:(keys,cb)=>{const v=typeof keys==='string'?{[keys]:structuredClone(store[keys])}:{...structuredClone(store)};cb?.(v);return Promise.resolve(v)},set:(values,cb)=>{for(const [key,value]of Object.entries(values))store[key]=structuredClone(value);cb?.();return Promise.resolve()},remove:async key=>{delete store[key]}},onChanged:{addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}}},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async x=>({id:2,...x})},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/editor.html');
  await page.waitForFunction(()=>!!window.OSMINOGWindowsFolders&&!!window.OSMINOGWorkdesk);
  const result=await page.evaluate(async()=>{
   await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();
   const p=project();p.objects=[];p.osminogFolders=[];p.activeDesktop='main';
   for(let i=0;i<60;i++)p.osminogFolders.push({id:'perf-folder-'+i,name:'Folder '+i,parentId:null,desktopVisible:true,screenX:10+(i%10)*140,screenY:80+Math.floor(i/10)*120,members:[]});
   for(let i=0;i<2400;i++){const id='perf-folder-'+(i%60);p.objects.push({...objectDefaults('brief'),id:'perf-object-'+i,name:'Object '+i,text:'payload '+i,osminogFolderId:id,osminogDesktopId:'main'})}
   const original=window.objects;let calls=0;window.objects=function(...args){calls++;return original.apply(this,args)};
   const start=performance.now();OSMINOGWindowsFolders.render();const elapsed=performance.now()-start;
   const counts=[...document.querySelectorAll('#osminogWindowsDesktopFolders [data-win-folder-id] small')].map(x=>Number(x.textContent));
   return{calls,elapsed,visibleFolders:counts.length,totalCount:counts.reduce((a,b)=>a+b,0),min:Math.min(...counts),max:Math.max(...counts)};
  });
  assert.equal(result.calls,1,JSON.stringify(result));
  assert.equal(result.visibleFolders,60,JSON.stringify(result));
  assert.equal(result.totalCount,2400,JSON.stringify(result));
  assert.equal(result.min,40,JSON.stringify(result));assert.equal(result.max,40,JSON.stringify(result));
  assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/folder-count-436-results.json',JSON.stringify({fixture:'60 visible folders, 2,400 stored objects',result,errors},null,2));
  console.log('PASS folder counter rendering scans project objects once, not twice per folder; 60 counters correctly show 40 items each');
 }catch(error){if(page)await page.screenshot({path:'artifacts/folder-count-436-failure.png'}).catch(()=>{});throw error}
 finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exit(1)});
