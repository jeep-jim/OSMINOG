'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const {screen}=require('electron'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<160;n++){if(await fn())return;await sleep(50)}throw Error('Mouse617 timeout: '+label)}
module.exports=async({win,browser})=>{
 const js=s=>win.webContents.executeJavaScript(s),native=require('./mouse-native-menu.node'),before=new Set(browser.tabs.keys()),bounds=win.getBounds();
 const saved=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,theme:MouseTest.model.theme,aiOpen:MouseTest.model.aiOpen,aiId:MouseTest.model.aiId,aiWidth:MouseTest.model.aiWidth,aiSessions:MouseTest.model.aiSessions,aiSites:MouseTest.model.aiSites,libraryOpen:MouseTest.model.libraryOpen}))');
 const counts={};let server,lastClick;
 async function click(selector){win.focus();const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing/disabled '+${JSON.stringify(selector)});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`),o=win.getContentBounds();assert.equal(native.testClick(o.x+p.x,o.y+p.y),true);await sleep(100)}
 try{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave fullscreen');await sleep(400)}
  win.show();win.focus();const work=screen.getPrimaryDisplay().workArea;win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1101,work.width-16),height:Math.min(801,work.height-16)});
  server=http.createServer((req,res)=>{counts[req.url]=(counts[req.url]||0)+1;res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Mouse617</title><style>body{margin:0;background:#dd3c92;height:100vh}</style><input id="retained" value="native-focus"><script>window.marker=Math.random();window.nativePresses=0;document.querySelector("#retained").addEventListener("pointerdown",e=>{if(e.isTrusted)window.nativePresses++})</script>')});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port,ids=[];
  for(let i=0;i<4;i++)ids.push((await browser.command('open',{url:root+'/page'+i,lane:'main'})).id);
  await until(()=>ids.every(id=>!browser.get(id).loading),'native fixtures loaded');
  await js(`MouseTest.changeLayout(4);Object.keys(MouseTest.model.slots).forEach((p,i)=>MouseTest.model.slots[p]=${JSON.stringify(ids)}[i]);MouseTest.model.libraryOpen=false;MouseTest.renderTree();MouseTest.applySide()`);
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);await sleep(200);
   const input='.pane .pane-address input',reload='.pane [data-pane-action=reload]',first=browser.get(ids[0]);
   for(let n=0;n<3;n++){
    await click(input);assert.equal(await js('document.activeElement.matches(".pane-address input")'),true);
    await js('document.activeElement.value="unsubmitted address"');const count=counts['/page0'];
    await click(reload);await until(()=>counts['/page0']>count&&!first.loading,'one native click reload after address focus');
    assert.equal(await js('!!document.querySelector(".address-editing")'),false);
    // Navigation completion is not the compositor/async hint-layout barrier.
    // Require fully restored native bounds, then issue exactly ONE actual click.
    await until(async()=>{
     const dom=await js('(()=>{const r=document.querySelector(".pane .page-slot").getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),hint:!!document.querySelector("#address-suggestions:popover-open"),blocked:MouseTest.overlays.active()}})()');
     const b=(first.clipView||first.view).getBounds();
     return first.visible&&!dom.hint&&!dom.blocked&&b.x===dom.x&&b.y===dom.y&&b.x+b.width===dom.right&&b.y+b.height===dom.bottom;
    },'restored native page bounds after hints/reload');
    const point=await first.view.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const r=document.querySelector("#retained").getBoundingClientRect();resolve({x:r.x+r.width/2,y:r.y+r.height/2,presses:window.nativePresses})})))');
    assert.equal(point.presses,0,'reload must reset real-pointer counter');
    const p=first.bounds,o=win.getContentBounds();lastClick={theme,n,point,page:{...p},parent:(first.clipView||first.view).getBounds(),child:first.view.getBounds()};
    console.log('MOUSE_617_NATIVE_CLICK_BEFORE',JSON.stringify(lastClick));
    assert.equal(native.testClick(o.x+p.x+point.x,o.y+p.y+point.y),true);
    await until(()=>first.view.webContents.executeJavaScript('document.activeElement.id==="retained"&&window.nativePresses===1'),'native web content still receives one actual click');
   }
   await browser.command('navigate',{id:ids[0],url:root+'/second'});await until(()=>!first.loading,'second history entry');
   await click(input);await click('.pane [data-pane-action=back]');await until(()=>first.view.webContents.getURL()===root+'/page0'&&!first.loading,'native back after address focus');
   await click(input);await click('.pane [data-pane-action=forward]');await until(()=>first.view.webContents.getURL()===root+'/second'&&!first.loading,'native forward after address focus');
   await browser.command('navigate',{id:ids[0],url:root+'/page0'});await until(()=>!first.loading,'restore first URL');
   await click(input);await click('#statusbar [data-action=settings]');await until(()=>js('document.querySelector("#settings-dialog").open'),'footer settings after address focus');
   await click('#settings-dialog [data-close-dialog]');await until(()=>js('!document.querySelector("#settings-dialog").open'),'settings close');
   await js(`MouseTest.openAI(${JSON.stringify(root+'/ai')})`);await sleep(250);
   const geometry=await js(`(()=>{const h=document.querySelector('.pane-head'),i=h.querySelector('input'),f=h.querySelector('[data-pane-action=fullscreen]'),b=document.querySelector('#new-tab'),bar=document.querySelector('.toolbar');return{gap:f.getBoundingClientRect().left-i.getBoundingClientRect().right,inputRadius:getComputedStyle(i).borderRadius,buttonRadius:getComputedStyle(f).borderRadius,burrowBottom:b.getBoundingClientRect().bottom,lineTop:bar.getBoundingClientRect().bottom-1,plusWidth:b.querySelector('svg').getBoundingClientRect().width,brand:document.querySelector('.brand img').getAttribute('src'),footer:getComputedStyle(document.querySelector('#statusbar')).display,status:document.querySelector('#status').textContent}})()`);
   assert.ok(geometry.gap>=8);assert.equal(geometry.inputRadius,'10px');assert.equal(geometry.buttonRadius,'10px');assert.ok(geometry.burrowBottom<geometry.lineTop);assert.equal(geometry.plusWidth,14);assert.equal(geometry.brand,'mouse-head.svg');assert.notEqual(geometry.footer,'none');assert.equal(geometry.status,'');
   await until(()=>browser.panels.length===5,'native five-panel layout');
   const slots=await js('[...document.querySelectorAll(".pane")].map(p=>{const r=p.querySelector(".page-slot").getBoundingClientRect();return{id:MouseTest.model.slots[p.dataset.pane],left:r.left,right:r.right,top:r.top,bottom:r.bottom}})');
   for(const r of slots){const b=browser.get(r.id).bounds;assert.equal(b.x,Math.round(r.left));assert.equal(b.x+b.width,Math.round(r.right));assert.equal(b.y,Math.round(r.top));assert.equal(b.y+b.height,Math.round(r.bottom));}
   await fs.writeFile('mouse-617-chrome-'+theme+'.png',(await win.capturePage()).toPNG());console.log('MOUSE_617_NATIVE_FOCUS_GEOMETRY',theme,JSON.stringify(geometry));
  }
  console.log('MOUSE_617_NATIVE_ADDRESS_CLICKS_HEAD_10PX_FOOTER_PASS');
 }catch(error){
  console.log('MOUSE_617_FOCUS_FAILURE',JSON.stringify({lastClick,window:win.getBounds(),native:native.state(),pages:[...browser.tabs.values()].filter(t=>!before.has(t.id)).map(t=>({id:t.id,url:t.url,visible:t.visible,bounds:t.bounds,view:t.view.getBounds(),clip:t.clipView?.getBounds()})),shell:await js('({active:document.activeElement?.outerHTML,hint:!!document.querySelector("#address-suggestions:popover-open"),blocked:MouseTest.overlays.active(),drag:MouseTest.model.swapDrag,slots:MouseTest.model.slots})')}));
  await fs.writeFile('mouse-617-focus-failure.png',(await win.capturePage()).toPNG());throw error;
 }finally{
  await js('document.querySelector("#settings-dialog").open&&document.querySelector("#settings-dialog").close()').catch(()=>{});
  for(const id of [...browser.tabs.keys()])if(!before.has(id))await browser.command('close',{id});server?.close();
  await js(`Object.assign(MouseTest.model,${JSON.stringify(saved)});MouseTest.setTheme(${JSON.stringify(saved.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.renderAISites();MouseTest.save()`);win.setBounds(bounds);
 }
};
