'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){for(let n=0;n<200;n++){if(await check())return;await sleep(75)}throw Error('Timed out: '+label)}
module.exports=async({app,win,browser,store,libraryService,overlayGate,startService})=>{
 let server;
 const js=source=>win.webContents.executeJavaScript(source);
 try{
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');assert.equal(app.getName(),'Quadro Browser');assert.equal(app.getVersion(),'6.0.4');
  assert.equal(await js('document.title'),'Quadro Browser');
  if(process.argv.includes('--quadro-smoke-read')){
   const saved=(await store.get('quadroPreferences')).quadroPreferences;
   assert.equal(saved.tree.axis,'x');assert.ok(saved.tree.ratio>.55);assert.ok(saved.aiWidth>400);
   assert.ok((await store.get('quadroPersistence')).quadroPersistence==='quadro-6');
   assert.equal((await browser.session.cookies.get({url:'https://example.com/',name:'quadro-persistence'}))[0]?.value,'retained');
   assert.equal((await store.get('macPortPersistence')).macPortPersistence,'actual-legacy-mac-profile');
   assert.equal((await js('QuadroNative.wallet("list")'))[0]?.address,'0x1111111111111111111111111111111111111111');
   assert.ok(libraryService.library.data.bookmarks.some(x=>x.title==='Library persistence fixture'));assert.ok(libraryService.library.data.searches.some(x=>x.query==='quadro persistent search'));console.log('QUADRO_LIBRARY_RESTART_PASS');assert.ok(startService.tabs.size>=1,'internal start tab restored');assert.equal(startService.getPreferences().background,'custom');assert.ok(libraryService.library.data.bookmarks.some(x=>x.title==='Visual bookmark fixture'));console.log('QUADRO_START_PAGE_RESTART_PASS');
   console.log('QUADRO_PROFILE_COOKIE_WALLET_RESTART_PASS');
  }else{
   await store.set({macPortPersistence:'actual-legacy-mac-profile',traderWalletWatch:[{address:'0x1111111111111111111111111111111111111111',label:'Migration fixture'}]});
   server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.setHeader('Content-Type','image/png');require('node:fs').createReadStream(require('node:path').join(__dirname,'quadro/brand.png')).pipe(res);return}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Quadro fixture '+req.url+'</title><h1>Локальная проверка браузера</h1><input id="kept" value="retained"><script>globalThis.loadedOnce=Math.random()</script>')});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
   for(let i=0;i<6;i++)await js(`QuadroTest.openPage(${JSON.stringify(url+'/pane/'+i)})`);
   await until(()=>[...browser.tabs.values()].filter(t=>t.lane!=='side').every(t=>!t.loading),'fixture loads');
   const originals=new Map();for(const t of browser.tabs.values()){assert.equal(t.error,'','Guest page/preload error');originals.set(t.id,{wc:t.view.webContents.id,value:await t.view.webContents.executeJavaScript('globalThis.loadedOnce')})}
   async function geometry(n,full){
    await until(()=>browser.panels.filter(p=>browser.tabs.get(p.id)?.lane!=='side').length===n,'native panel count');await sleep(100);
    const boxes=await js(`Array.from(document.querySelectorAll('.pane')).map(p=>{const r=p.querySelector('.page-slot').getBoundingClientRect();return{id:QuadroTest.model.slots[p.dataset.pane],x:r.x,y:r.y,width:r.width,height:r.height}})`);
    for(const b of boxes){const t=browser.get(b.id);assert.equal(t.visible,true);for(const key of ['x','y','width','height'])assert.ok(Math.abs(t.bounds[key]-b[key])<=1.5,key+' native mismatch')}
    if(full){const width=await js('innerWidth');assert.ok(Math.abs(Math.max(...boxes.map(b=>b.x+b.width))-width)<=1);assert.ok(Math.min(...boxes.map(b=>b.x))<=1)}
   }
   for(const width of [1440,1100,900]){win.setSize(width,900);await sleep(100);for(const n of [1,2,4,6]){await js(`QuadroTest.changeLayout(${n})`);await geometry(n,true)}}
   console.log('QUADRO_FULLWIDTH_1_2_4_6_PASS');
   win.setSize(1440,960);await js('QuadroTest.changeLayout(4)');await sleep(150);
   async function drag(selector,dx,dy){const r=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.sendInputEvent({type:'mouseMove',x:r.x,y:r.y});win.webContents.sendInputEvent({type:'mouseDown',x:r.x,y:r.y,button:'left',clickCount:1});await until(()=>js('document.body.classList.contains("resizing")'),'real pointer down');await sleep(50);win.webContents.sendInputEvent({type:'mouseMove',x:r.x+dx,y:r.y+dy,button:'left'});await sleep(100);win.webContents.sendInputEvent({type:'mouseUp',x:r.x+dx,y:r.y+dy,button:'left',clickCount:1});await until(()=>js('!document.body.classList.contains("resizing")'),'real pointer up');await sleep(150)}
   await drag('.divider[data-axis=x]',150,0);assert.ok(await js('QuadroTest.model.tree.ratio')>.55);await geometry(4,true);
   await drag('.divider[data-axis=y]',0,100);assert.ok(await js('QuadroTest.model.tree.a.ratio')>.55);await geometry(4,true);
   console.log('QUADRO_REAL_HORIZONTAL_VERTICAL_DRAG_PASS');
   await js(`QuadroTest.openAI(${JSON.stringify(url+'/custom-ai')})`);await until(()=>browser.panels.length===5,'custom AI webpage');
   const aiId=await js('QuadroTest.model.aiId');await until(()=>browser.get(aiId).view.webContents.getURL().endsWith('/custom-ai')&&!browser.get(aiId).loading,'custom AI navigation completion');assert.equal(browser.get(aiId).error,'');
   await drag('#ai-divider',-140,0);assert.ok(await js('QuadroTest.model.aiWidth')>400);await geometry(4,false);
   await js('document.querySelector("[data-action=close-ai]").click()');await until(()=>!browser.get(aiId).visible,'hidden AI');await geometry(4,true);
   await js('document.querySelector("[data-action=ai]").click()');await until(()=>browser.get(aiId).visible,'AI returns');await geometry(4,false);
   for(const [id,old] of originals){const t=browser.get(id);assert.equal(t.view.webContents.id,old.wc);assert.equal(await t.view.webContents.executeJavaScript('globalThis.loadedOnce'),old.value);assert.equal(await t.view.webContents.executeJavaScript('document.querySelector("#kept").value'),'retained')}
   console.log('QUADRO_CUSTOM_AI_RESIZE_NO_RELOAD_PASS');
   for(const theme of ['light','dark']){await js(`QuadroTest.setTheme('${theme}')`);const ratios=await js(`(()=>{const lum=s=>{const x=s.match(/[0-9.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return x[0]*.2126+x[1]*.7152+x[2]*.0722};return Array.from(document.querySelectorAll('button.primary, .navigation button, #new-tab, #statusbar button, .ai-controls select')).filter(e=>e.getBoundingClientRect().width>0).map(e=>{const c=getComputedStyle(e),a=lum(c.color),b=lum(c.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})})()`);assert.ok(ratios.length>=7);assert.ok(ratios.every(x=>x>=4.5),theme+' contrast '+ratios)}
   await js('QuadroTest.setTheme("light")');await fs.writeFile('quadro-light-smoke.png',(await win.capturePage()).toPNG());await js('QuadroTest.setTheme("dark")');await fs.writeFile('quadro-dark-smoke.png',(await win.capturePage()).toPNG());
   console.log('QUADRO_LIGHT_DARK_CONTRAST_PASS');
   await require('./quadro-compact-smoke.cjs')({win,browser});
   await require('./quadro-refinements-smoke.cjs')({win,browser,store});
   await require('./quadro-basics-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService});
   await require('./quadro-start-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService});
   await store.set({quadroPersistence:'quadro-6'});await browser.session.cookies.set({url:'https://example.com/',name:'quadro-persistence',value:'retained',expirationDate:Date.now()/1000+86400});await browser.session.cookies.flushStore();await js('QuadroTest.save()');await browser.save();await browser.saveQueue;await libraryService.flush();await store.queue;
  }
  console.log('QUADRO_ARM64_SMOKE_PASS');server?.close();app.exit(0);
 }catch(error){console.error(error);console.error('QUADRO_TAB_DIAGNOSTICS',JSON.stringify(browser.state()));await fs.writeFile('quadro-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});server?.close();app.exit(1)}
};
