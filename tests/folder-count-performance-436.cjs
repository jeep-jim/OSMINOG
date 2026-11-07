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
   const initial={calls,elapsed,visibleFolders:counts.length,totalCount:counts.reduce((a,b)=>a+b,0),min:Math.min(...counts),max:Math.max(...counts)};
   const layer=document.querySelector('#osminogWindowsDesktopFolders'),icons=[...layer.querySelectorAll('[data-win-folder-id]')];
   const nodes=icons.map(icon=>({icon,label:icon.querySelector('.osminog-win-folder-label').firstChild,count:icon.querySelector('small').firstChild}));
   const observer=new MutationObserver(()=>{});observer.observe(layer,{childList:true,subtree:true,attributes:true});
   for(let i=0;i<20;i++)OSMINOGWindowsFolders.render();
   const records=observer.takeRecords();observer.disconnect();
   const unchanged={renders:20,objectScans:calls-initial.calls,childMutations:records.filter(r=>r.type==='childList').length,attributeMutations:records.filter(r=>r.type==='attributes').length,
    retainedNodes:nodes.every(({icon,label,count})=>icon.isConnected&&icon.querySelector('.osminog-win-folder-label').firstChild===label&&icon.querySelector('small').firstChild===count)};
   const first=p.osminogFolders[0],inbox=p.defaultInboxId,rootSize=p.osminogFolderSettings.desktopSize;
   first.name='Renamed folder';first.screenX=33;first.screenY=88;first.desktopSize='large';p.objects[0].osminogFolderId='perf-folder-1';p.defaultInboxId=first.id;p.osminogFolderSettings.desktopSize='large';
   OSMINOGWindowsFolders.render();
   const changed={sameIcons:icons.every(icon=>icon.isConnected&&layer.querySelector('[data-win-folder-id="'+icon.dataset.winFolderId+'"]')===icon),
    name:icons[0].querySelector('.osminog-win-folder-label').textContent,left:icons[0].style.left,top:icons[0].style.top,size:icons[0].dataset.size,capture:icons[0].dataset.capture,
    firstCount:Number(icons[0].querySelector('small').textContent),secondCount:Number(icons[1].querySelector('small').textContent),aria:icons[0].querySelector('small').getAttribute('aria-label'),rootSize:document.querySelector('#osminogDesktopFolderIcon')?.dataset.size};
   Object.assign(first,{name:'Folder 0',screenX:10,screenY:80,desktopSize:'medium'});p.objects[0].osminogFolderId=first.id;p.defaultInboxId=inbox;p.osminogFolderSettings.desktopSize=rootSize;
   OSMINOGWindowsFolders.render();window.objects=original;
   const restored={name:icons[0].querySelector('.osminog-win-folder-label').textContent,left:icons[0].style.left,top:icons[0].style.top,size:icons[0].dataset.size,
    firstCount:Number(icons[0].querySelector('small').textContent),secondCount:Number(icons[1].querySelector('small').textContent)};
   return{...initial,unchanged,changed,restored};
  });
  assert.equal(result.calls,1,JSON.stringify(result));
  assert.equal(result.visibleFolders,60,JSON.stringify(result));
  assert.equal(result.totalCount,2400,JSON.stringify(result));
  assert.equal(result.min,40,JSON.stringify(result));assert.equal(result.max,40,JSON.stringify(result));
  assert.deepEqual(result.unchanged,{renders:20,objectScans:20,childMutations:0,attributeMutations:0,retainedNodes:true});
  assert.deepEqual(result.changed,{sameIcons:true,name:'Renamed folder',left:'33px',top:'88px',size:'large',capture:'true',firstCount:39,secondCount:41,aria:'Элементов: 39',rootSize:'large'});
  assert.deepEqual(result.restored,{name:'Folder 0',left:'10px',top:'80px',size:'medium',firstCount:40,secondCount:40});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/folder-count-436-results.json',JSON.stringify({fixture:'60 visible folders, 2,400 stored objects',result,errors},null,2));
  console.log('PASS one object scan per render; 60 correct counters; unchanged folder DOM retained without mutations; changed name, position, size, capture flag and membership update immediately');
 }catch(error){if(page)await page.screenshot({path:'artifacts/folder-count-436-failure.png'}).catch(()=>{});throw error}
 finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exit(1)});
