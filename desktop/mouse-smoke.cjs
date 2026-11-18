'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){for(let n=0;n<200;n++){if(await check())return;await sleep(75)}throw Error('Timed out: '+label)}
module.exports=async({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,agentHost,documentService,privateMode})=>{
 let server;
 const js=source=>win.webContents.executeJavaScript(source);
 try{
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');assert.equal(app.getName(),'Mouse Browser');assert.equal(app.getVersion(),'6.0.25');
  assert.equal(await js('document.title'),'Mouse Browser');
  if(process.argv.includes('--mouse-smoke-read')){
   const saved=(await store.get('quadroPreferences')).quadroPreferences;
   assert.equal(saved.tree.axis,'x');assert.ok(saved.tree.ratio>.55);assert.ok(saved.aiWidth>400);
   assert.ok((await store.get('mousePersistence')).mousePersistence==='mouse-6');
   assert.equal((await browser.session.cookies.get({url:'https://example.com/',name:'mouse-persistence'}))[0]?.value,'retained');
   assert.equal((await store.get('macPortPersistence')).macPortPersistence,'actual-legacy-mac-profile');
   assert.equal((await store.get('traderWalletWatch')).traderWalletWatch[0]?.address,'0x1111111111111111111111111111111111111111');
   assert.ok(libraryService.library.data.bookmarks.some(x=>x.title==='Library persistence fixture'));assert.ok(libraryService.library.data.searches.some(x=>x.query==='mouse persistent search'));console.log('MOUSE_LIBRARY_RESTART_PASS');assert.ok(startService.tabs.size>=1,'internal start tab restored');assert.equal(startService.getPreferences().background,'custom');assert.ok(libraryService.library.data.bookmarks.some(x=>x.title==='Visual bookmark fixture'));console.log('MOUSE_START_PAGE_RESTART_PASS');
   assert.equal(await fs.readFile(require('node:path').join(app.getPath('userData'),'quadro-wallet','mouse616-preserve-fixture'),'utf8'),'legacy bytes must remain unchanged');console.log('MOUSE_PROFILE_COOKIE_RESTART_PASS');
  }else{
   await store.set({macPortPersistence:'actual-legacy-mac-profile',traderWalletWatch:[{address:'0x1111111111111111111111111111111111111111',label:'Migration fixture'}]});
   server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.setHeader('Content-Type','image/png');require('node:fs').createReadStream(require('node:path').join(__dirname,'mouse/brand.png')).pipe(res);return}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Mouse fixture '+req.url+'</title><h1>Локальная проверка браузера</h1><input id="kept" value="retained"><script>globalThis.loadedOnce=Math.random()</script>')});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
   for(let i=0;i<6;i++)await js(`MouseTest.openPage(${JSON.stringify(url+'/pane/'+i)})`);
   await until(()=>[...browser.tabs.values()].filter(t=>t.lane!=='side').every(t=>!t.loading),'fixture loads');
   const originals=new Map();for(const t of browser.tabs.values()){assert.equal(t.error,'','Guest page/preload error');originals.set(t.id,{wc:t.view.webContents.id,value:await t.view.webContents.executeJavaScript('globalThis.loadedOnce')})}
   async function geometry(n,full){
    await until(()=>browser.panels.filter(p=>browser.tabs.get(p.id)?.lane!=='side').length===n,'native panel count');await sleep(100);
    const boxes=await js(`Array.from(document.querySelectorAll('.pane')).map(p=>{const r=p.querySelector('.page-slot').getBoundingClientRect();return{id:MouseTest.model.slots[p.dataset.pane],x:r.x,y:r.y,width:r.width,height:r.height}})`);
    for(const b of boxes){const t=browser.get(b.id);assert.equal(t.visible,true);for(const key of ['x','y','width','height'])assert.ok(Math.abs(t.bounds[key]-b[key])<=1.5,key+' native mismatch')}
    if(full){const width=await js('innerWidth');assert.ok(Math.abs(Math.max(...boxes.map(b=>b.x+b.width))-width)<=1);assert.ok(Math.min(...boxes.map(b=>b.x))<=1)}
   }
   for(const width of [1440,1100,900]){win.setSize(width,900);await sleep(100);for(const n of [1,2,4,6]){await js(`MouseTest.changeLayout(${n})`);await geometry(n,true)}}
   console.log('MOUSE_FULLWIDTH_1_2_4_6_PASS');
   win.setSize(1440,960);await js('MouseTest.changeLayout(4)');await sleep(150);
   async function drag(selector,dx,dy){const r=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.sendInputEvent({type:'mouseMove',x:r.x,y:r.y});win.webContents.sendInputEvent({type:'mouseDown',x:r.x,y:r.y,button:'left',clickCount:1});await until(()=>js('document.body.classList.contains("resizing")'),'real pointer down');await sleep(50);console.log('MOUSE_609_DRAG_DOWN',selector,await js('JSON.stringify({path:MouseTest.model.drag?.path,axis:MouseTest.model.drag?.axis,pointer:MouseTest.model.drag?.pointer})'));win.webContents.sendInputEvent({type:'mouseMove',x:r.x+dx,y:r.y+dy,button:'left'});await sleep(100);console.log('MOUSE_609_DRAG_MOVED',selector,await js('JSON.stringify({axis:MouseTest.model.drag?.axis,ratio:MouseTest.model.tree.ratio,childRatio:MouseTest.model.tree.a.ratio})'));win.webContents.sendInputEvent({type:'mouseUp',x:r.x+dx,y:r.y+dy,button:'left',clickCount:1});await until(()=>js('!document.body.classList.contains("resizing")'),'real pointer up');await sleep(150)}
   await drag('.divider[data-axis=x]',150,0);assert.ok(await js('MouseTest.model.tree.ratio')>.55);await geometry(4,true);
   await drag('.divider[data-axis=y]',0,100);assert.ok(await js('MouseTest.model.tree.a.ratio')>.55);await geometry(4,true);
   console.log('MOUSE_REAL_HORIZONTAL_VERTICAL_DRAG_PASS');
   await js(`MouseTest.openAI(${JSON.stringify(url+'/custom-ai')})`);await until(()=>browser.panels.length===5,'custom AI webpage');
   const aiId=await js('MouseTest.model.aiId');await until(()=>browser.get(aiId).view.webContents.getURL().endsWith('/custom-ai')&&!browser.get(aiId).loading,'custom AI navigation completion');assert.equal(browser.get(aiId).error,'');
   await drag('#ai-divider',-140,0);assert.ok(await js('MouseTest.model.aiWidth')>400);await geometry(4,false);
   await js('document.querySelector("[data-action=ai]").click()');await until(()=>!browser.get(aiId).visible,'hidden AI');await geometry(4,true);
   await js('document.querySelector("[data-action=ai]").click()');await until(()=>browser.get(aiId).visible,'AI returns');await geometry(4,false);
   for(const [id,old] of originals){const t=browser.get(id);assert.equal(t.view.webContents.id,old.wc);assert.equal(await t.view.webContents.executeJavaScript('globalThis.loadedOnce'),old.value);assert.equal(await t.view.webContents.executeJavaScript('document.querySelector("#kept").value'),'retained')}
   console.log('MOUSE_CUSTOM_AI_RESIZE_NO_RELOAD_PASS');
   for(const theme of ['light','dark']){await js(`MouseTest.setTheme('${theme}')`);const ratios=await js(`(()=>{const probe=document.createElement('span');probe.style.color='var(--panel)';document.body.append(probe);const panel=getComputedStyle(probe).color;probe.remove();const lum=s=>{const x=s.match(/[0-9.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return x[0]*.2126+x[1]*.7152+x[2]*.0722};return Array.from(document.querySelectorAll('button.primary, .navigation button, #new-tab, #statusbar button, .ai-controls select')).filter(e=>e.getBoundingClientRect().width>0).map(e=>{const c=getComputedStyle(e),a=lum(c.color),b=lum(panel);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})})()`);assert.ok(ratios.length>=7);assert.ok(ratios.every(x=>x>=4.5),theme+' contrast '+ratios)}
   await js('MouseTest.setTheme("light")');await fs.writeFile('mouse-light-smoke.png',(await win.capturePage()).toPNG());await js('MouseTest.setTheme("dark")');await fs.writeFile('mouse-dark-smoke.png',(await win.capturePage()).toPNG());
   console.log('MOUSE_LIGHT_DARK_CONTRAST_PASS');
   await require('./mouse-compact-smoke.cjs')({win,browser});
   await require('./mouse-refinements-smoke.cjs')({win,browser,store});
   await require('./mouse-basics-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus});
   await require('./mouse-start-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus});
   await require('./mouse-polish-smoke.cjs')({win,browser,overlayGate});
   await require('./mouse-global-capture-smoke.cjs')({app,win,browser,globalCapture,paneFocus});
   await store.set({mousePersistence:'mouse-6'});await browser.session.cookies.set({url:'https://example.com/',name:'mouse-persistence',value:'retained',expirationDate:Date.now()/1000+86400});await browser.session.cookies.flushStore();await js('MouseTest.save()');await browser.save();await browser.saveQueue;await libraryService.flush();await store.queue;
  }
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-606-smoke.cjs')({app,win,browser,globalCapture,paneFocus});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-608-smoke.cjs')({app,win,browser,globalCapture,paneFocus});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-609-smoke.cjs')({app,win,browser,globalCapture});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-final-smoke.cjs')({win});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-612-smoke.cjs')({win,browser,app});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-613-smoke.cjs')({win,browser,store});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-614-smoke.cjs')({win,browser});await require('./mouse-614-badge-smoke.cjs')({win});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-615-smoke.cjs')({win,browser});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-616-smoke.cjs')({app,win,browser,store,globalCapture});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-617-smoke.cjs')({win,browser});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-library-view-smoke.cjs')({app,win,browser,libraryService});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-tab-flow-smoke.cjs')({win,browser});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-emoji-smoke.cjs')({app,win,browser,nativePanel:true});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-620-smoke.cjs')({app,win,browser,libraryService,localCaptures,updates});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-621-smoke.cjs')({app,win,browser,store});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-622-smoke.cjs')({app,win,browser,store,agentHost});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-625-smoke.cjs')({app,win,browser,store,documentService,privateMode});
  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-625-search-smoke.cjs')({app,win,browser,store,privateMode,startService,libraryService});
  console.log('MOUSE_ARM64_SMOKE_PASS');server?.close();app.exit(0);
 }catch(error){console.error(error);console.error('MOUSE_TAB_DIAGNOSTICS',JSON.stringify(browser.state()));await fs.writeFile('mouse-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});server?.close();app.exit(1)}
};
