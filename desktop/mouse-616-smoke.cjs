'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {screen,nativeImage}=require('electron');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,label){for(let i=0;i<180;i++){if(await f())return;await sleep(50)}throw Error('Mouse616 timeout: '+label);}
module.exports=async({app,win,browser,store,globalCapture})=>{
 const js=s=>win.webContents.executeJavaScript(s),before=new Set(browser.tabs.keys()),bounds=win.getBounds();
 const saved=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,theme:MouseTest.model.theme,aiOpen:MouseTest.model.aiOpen,aiId:MouseTest.model.aiId,aiWidth:MouseTest.model.aiWidth,aiSessions:MouseTest.model.aiSessions,aiSites:MouseTest.model.aiSites}))');
 let server;const held=new Map();const hold=url=>{let release;const wait=new Promise(r=>release=r);held.set(url,wait);return()=>{held.delete(url);release();}};const sentinel=path.join(app.getPath('userData'),'quadro-wallet','mouse616-preserve-fixture');
 async function click(selector){win.focus();win.webContents.focus();const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});}
 async function full(value){if(win.isFullScreen()===value)return;await new Promise((resolve,reject)=>{const event=value?'enter-full-screen':'leave-full-screen',timer=setTimeout(()=>reject(Error('No native '+event)),7000);win.once(event,()=>{clearTimeout(timer);resolve()});win.setFullScreen(value)});await sleep(180);}
 try{
  await full(false);win.show();win.focus();const work=screen.getPrimaryDisplay().workArea;win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1100,work.width-16),height:Math.min(800,work.height-16)});await sleep(250);
  await fs.mkdir(path.dirname(sentinel),{recursive:true});await fs.writeFile(sentinel,'legacy bytes must remain unchanged');
  assert.deepEqual(await js('[typeof MouseNative.wallet,typeof MouseNative.web3]'),['undefined','undefined']);
  for(const name of ['wallet-vault.cjs','mouse-web3.cjs','mouse-web3-runtime.cjs','mouse/web3.js'])assert.equal(require('node:fs').existsSync(path.join(__dirname,name)),false,'Mac package excludes '+name);
  const counts={};server=http.createServer(async(req,res)=>{counts[req.url]=(counts[req.url]||0)+1;await held.get(req.url);res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Mouse616 '+req.url+'</title><style>html,body{margin:0;background:#dd3c92;color:#111;height:100%;overflow:hidden}</style><input id="draft" value="preserved"><script>globalThis.token=Math.random();globalThis.injected=typeof ethereum</script>')});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port,ids=[];
  for(let i=0;i<4;i++)ids.push((await browser.command('open',{url:root+'/pane'+i,lane:'main'})).id);
  await until(()=>ids.every(id=>!browser.get(id).loading),'main pages loaded');
  await js(`MouseTest.changeLayout(4);Object.keys(MouseTest.model.slots).forEach((p,i)=>MouseTest.model.slots[p]=${JSON.stringify(ids)}[i]);MouseTest.renderTree()`);
  await js(`MouseTest.openAI(${JSON.stringify(root+'/ai')})`);const ai=await js('MouseTest.model.aiId');await until(()=>!browser.get(ai).loading,'AI page loaded');
  await until(()=>browser.panels.length===5&&browser.get(ids[0]).bounds,'native top-row page');
  for(const t of [browser.get(ids[0]),browser.get(ai)])assert.equal(await t.view.webContents.executeJavaScript('typeof ethereum+","+typeof __mouseWalletTransport'),'undefined,undefined');
  for(const theme of ['light','dark']){
   // AppKit restores an earlier native size after fullscreen; place each independent pixel fixture on screen.
   win.setBounds({x:work.x+8,y:work.y+8,width:Math.min(1100,work.width-16),height:Math.min(800,work.height-16)});await sleep(300);
   await until(()=>{const b=win.getContentBounds();return b.x>=work.x&&b.y>=work.y&&b.x+b.width<=work.x+work.width&&b.y+b.height<=work.y+work.height;},'pixel fixture inside physical display');
   await js(`MouseTest.setTheme('${theme}')`);await sleep(180);
   const ui=await js(`(()=>{const order=[...document.querySelector('.ai-controls').children].map(b=>b.dataset.action||b.className);const style=s=>{const c=getComputedStyle(document.querySelector(s));return[c.borderRadius,c.backgroundColor,c.boxShadow,c.borderTopWidth,c.height]};return{order,extra:document.querySelectorAll('[data-pane-action=bookmark],[data-pane-action=split-x],[data-pane-action=split-y]').length,buttons:[style('#history-button'),style('#downloads-button'),style('#footer-library [data-action=bookmarks]')],common:style('#statusbar [data-action=settings]'),wallet:!!document.querySelector('[data-action=wallet]'),corners:[...document.querySelectorAll('.pane')].map(p=>[p.style.getPropertyValue('--pane-round-top'),p.style.getPropertyValue('--pane-round-bottom')])}})()`);
   assert.deepEqual(ui.order.slice(0,4),['ai-back','ai-forward','ai-reload','ai-provider']);assert.equal(ui.extra,0);assert.equal(ui.wallet,false);
   for(const b of ui.buttons)assert.deepEqual(b,ui.common,'one shared footer button style');
   assert.deepEqual(ui.corners,[['0px','8px'],['8px','0px'],['0px','8px'],['8px','0px']]);
   const firstSelector='.pane [data-pane-action=reload]';const t=browser.get(ids[0]),wc=t.view.webContents.id,oldCount=counts['/pane0'];const releaseMain=hold('/pane0');
   await click(firstSelector);await until(()=>js('document.querySelector(".pane [data-pane-action=reload]").dataset.loading==="true"'),'reload shows activity');
   await until(()=>t.loading&&counts['/pane0']>oldCount,'reload reached controlled response');
   const feedback=await js('(()=>{const b=document.querySelector(".pane [data-pane-action=reload]"),g=b.querySelector(".mouse-reload-glyph");return{loading:b.dataset.loading,busy:b.getAttribute("aria-busy"),animation:getComputedStyle(g).animationName,reduced:matchMedia("(prefers-reduced-motion:reduce)").matches}})()');console.log('MOUSE_616_RELOAD_FEEDBACK',theme,JSON.stringify(feedback));
   assert.equal(feedback.loading,'true');assert.equal(feedback.busy,'true');assert.equal(feedback.animation,feedback.reduced?'none':'mouse-reload-spin');releaseMain();
   await until(()=>!t.loading&&counts['/pane0']>oldCount,'actual page reload');await until(()=>js('document.querySelector(".pane [data-pane-action=reload]").dataset.loading==="false"'),'reload stops');assert.equal(t.view.webContents.id,wc);
   const oldAI=counts['/ai'],releaseAI=hold('/ai');await click('[data-action=ai-reload]');await until(()=>js('document.querySelector("[data-action=ai-reload]").dataset.loading==="true"'),'AI reload shows activity');await until(()=>browser.get(ai).loading&&counts['/ai']>oldAI,'AI controlled reload');releaseAI();await until(()=>!browser.get(ai).loading&&counts['/ai']>oldAI,'AI actual reload');await sleep(600);
   await fs.writeFile('mouse-616-controls-'+theme+'.png',(await win.capturePage()).toPNG());
   const display=screen.getDisplayMatching(win.getBounds());assert.equal(globalCapture.permission(),'granted');
   // Verify real composited native page pixels, not a DOM-only shell screenshot.
   let shot;for(let n=0;n<20;n++){
    await sleep(100);const frame=await globalCapture.acquire(display);shot=nativeImage.createFromDataURL(frame.base);const size=shot.getSize(),bytes=shot.toBitmap(),c=win.getContentBounds(),sx=size.width/display.size.width,sy=size.height/display.size.height;
    const rgb=(id,x,y)=>{const p=browser.get(id).bounds,ix=Math.round((c.x+p.x+x-display.bounds.x)*sx),iy=Math.round((c.y+p.y+y-display.bounds.y)*sy);assert.ok(ix>=0&&ix<size.width&&iy>=0&&iy<size.height,'sample must be inside actual display');const off=(iy*size.width+ix)*4;return[bytes[off+2],bytes[off+1],bytes[off]]};
    const p=t.bounds,lower=browser.get(ids[1]).bounds,side=browser.get(ai).bounds;
    const samples={inside:rgb(ids[0],20,p.height-2),cutLeft:rgb(ids[0],1,p.height-1),cutRight:rgb(ids[0],p.width-2,p.height-1),pageTop:rgb(ids[0],1,40),externalBottom:rgb(ids[1],1,lower.height-2),aiBottom:rgb(ai,1,side.height-2)};
    const pink=a=>a.every((v,i)=>Math.abs(v-[221,60,146][i])<20);
    if(pink(samples.inside)&&!pink(samples.cutLeft)&&!pink(samples.cutRight)&&pink(samples.pageTop)&&pink(samples.externalBottom)&&pink(samples.aiBottom)){console.log('MOUSE_616_REAL_CORNER_PIXELS',theme,JSON.stringify(samples));break;}
    if(n===19){await fs.writeFile('mouse-616-corner-failure.png',shot.toPNG());throw Error('Native corner chrome mismatch: '+JSON.stringify({samples,window:win.getBounds(),content:c,display:display.bounds,bounds:p}));}
   }
   await fs.writeFile('mouse-616-native-corners-'+theme+'.png',shot.toPNG());
   const origin=win.getContentBounds(),page=t.bounds;require('./mouse-native-menu.node').testClick(origin.x+page.x+40,origin.y+page.y+10);
   await until(()=>t.view.webContents.executeJavaScript('document.activeElement?.id==="draft"'),'native corner chrome must not intercept website input');
   const keys=[...ids,ai],tokens=await Promise.all(keys.map(id=>browser.get(id).view.webContents.executeJavaScript('token')));
   await full(true);await until(()=>js('document.querySelector("[data-window=zoom]").textContent==="⤡"&&document.querySelector("[data-action=fullscreen]").getAttribute("aria-pressed")==="true"'),'native fullscreen arrows inward');
   await full(false);await until(()=>js('document.querySelector("[data-window=zoom]").textContent==="⤢"&&document.querySelector("[data-action=fullscreen]").getAttribute("aria-pressed")==="false"'),'native fullscreen arrows outward');
   assert.deepEqual(await Promise.all(keys.map(id=>browser.get(id).view.webContents.executeJavaScript('token'))),tokens,'native transition never reloads pages');
  }
  assert.equal(await fs.readFile(sentinel,'utf8'),'legacy bytes must remain unchanged');
  assert.equal((await store.get('traderWalletWatch')).traderWalletWatch[0].address,'0x1111111111111111111111111111111111111111');
  console.log('MOUSE_616_CONTROLS_LOADING_FULLSCREEN_CORNERS_NO_WALLET_PASS');
 }finally{
  await full(false);for(const id of [...browser.tabs.keys()])if(!before.has(id))await browser.command('close',{id});server?.close();
  await js(`Object.assign(MouseTest.model,${JSON.stringify(saved)});MouseTest.setTheme(${JSON.stringify(saved.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.renderAISites();MouseTest.save()`);win.setBounds(bounds);
 }
};
