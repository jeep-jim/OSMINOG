'use strict';
// Installed-app proof: real sidebar controls, real input into a dimmed guest,
// a strict-CSP owned site and real OS pixels from native and shell-owned panes.
const assert=require('node:assert/strict'),http=require('node:http');
const {pageHTML}=require('./mouse-631-smoke-helpers.cjs'),L=require('./mouse/layout.js');
const ORIGINAL=[37,143,191],DIMMED=[32,123,164];
function ownedPage(){
 const source=pageHTML(5),match=source.match(/<style>([\s\S]*?)<\/style>/);assert.ok(match);
 const css=match[1]+'\nhtml::before{content:"owned decoration";position:fixed;right:8px;bottom:8px;color:#314256}main{filter:contrast(1);transform:translateZ(0)}#dim-witness{position:fixed;left:24px;top:174px;width:72px;height:32px;background:rgb(37,143,191);z-index:10}#dim-click{position:fixed;left:24px;top:222px;width:120px;height:30px;z-index:10}';
 const html=source.replace(match[0],'<link rel="stylesheet" href="/site.css">').replace('</body>','<div id="dim-witness"></div><button id="dim-click">Owned click</button><script>globalThis.mouse637DimClicks=[];document.querySelector("#dim-click").onclick=event=>mouse637DimClicks.push({trusted:event.isTrusted,at:performance.now()});</script></body>');
 return{html,css};
}
function shellReadback(){
 const m=MouseTest.model,style=e=>{const c=getComputedStyle(e);return{backgroundColor:c.backgroundColor,backgroundImage:c.backgroundImage}},pseudo=getComputedStyle(document.querySelector('#stage'),'::after'),w=document.querySelector('#mouse-637-shell-witness'),r=w.getBoundingClientRect(),slot=document.querySelector('.pane[data-pane="p3"] .page-slot').getBoundingClientRect();
 return{theme:m.theme,settingsOpen:m.settingsOpen,libraryOpen:m.libraryOpen,dimmed:document.body.classList.contains('sidebar-dimmed'),mask:{content:pseudo.content,backgroundColor:pseudo.backgroundColor,pointerEvents:pseudo.pointerEvents},toolbar:style(document.querySelector('.toolbar')),settings:style(document.querySelector('#settings-dialog')),library:style(document.querySelector('#library-dialog')),start:{id:m.slots.p3,internal:m.state.tabs.find(t=>t.id===m.slots.p3)?.internal===true,visible:!!document.querySelector('.pane[data-pane="p3"] .home-page'),slotBounds:{x:slot.x,y:slot.y,width:slot.width,height:slot.height}},witness:{point:{x:r.x+r.width/2,y:r.y+r.height/2},color:getComputedStyle(w).backgroundColor}};
}
function guestReadback(){
 const host=document.querySelector('[data-mouse-sidebar-dim]'),button=document.querySelector('#dim-click'),witness=document.querySelector('#dim-witness'),r=witness.getBoundingClientRect(),b=button.getBoundingClientRect(),css=host&&getComputedStyle(host),h=host?.getBoundingClientRect();
 return{mask:host?{count:document.querySelectorAll('[data-mouse-sidebar-dim]').length,ariaHidden:host.getAttribute('aria-hidden'),inert:host.inert,closedShadow:host.shadowRoot===null,pointerEvents:css.pointerEvents,backdropPointerEvents:getComputedStyle(host,'::backdrop').pointerEvents,popoverOpen:host.matches(':popover-open'),bounds:{x:h.x,y:h.y,width:h.width,height:h.height}}:null,viewport:{width:innerWidth,height:innerHeight},author:{filter:getComputedStyle(document.querySelector('main')).filter,transform:getComputedStyle(document.querySelector('main')).transform,before:getComputedStyle(document.documentElement,'::before').content},buttonReceivesPoint:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===button,clicks:mouse637DimClicks.slice(),witness:{point:{x:r.x+r.width/2,y:r.y+r.height/2},color:getComputedStyle(witness).backgroundColor}};
}
function assertGuest(value,enabled){
 assert.equal(value.buttonReceivesPoint,true,'The actual native document hit target remains its original button');
 if(!enabled){assert.equal(value.mask,null,'Closing the sidebar removes the owned page layer');return;}
 const m=value.mask;assert.ok(m);assert.equal(m.count,1);assert.equal(m.ariaHidden,'true');assert.equal(m.inert,true);assert.equal(m.closedShadow,true);assert.equal(m.pointerEvents,'none');assert.equal(m.backdropPointerEvents,'none');assert.equal(m.popoverOpen,true);
 for(const [key,expected]of Object.entries({x:0,y:0,width:value.viewport.width,height:value.viewport.height}))assert.ok(Math.abs(m.bounds[key]-expected)<1.1,'Owned native dim bounds fill '+key);
}
function assertShell(value,enabled,kind){
 assert.equal(value.dimmed,enabled);assert.equal(value.settingsOpen,kind==='settings');assert.equal(value.libraryOpen,kind==='library');assert.equal(value.start.internal,true);assert.equal(value.start.visible,true);
 if(enabled){assert.equal(value.mask.pointerEvents,'none');assert.equal(value.mask.backgroundColor,'rgba(0, 0, 0, 0.14)');assert.notEqual(value.mask.content,'none');}
 else assert.equal(value.mask.content,'none');
 if(value.theme==='dark'&&kind)assert.deepEqual(value[kind],value.toolbar,'Dark sidebar shares the real toolbar surface');
}
module.exports=async function verifySidebarFocus({browser,fixture,click,capture,theme,facts,records}){
 const report={schema:1,opacity:.14,source:'Owned native and browser-owned panes, real OS capture and trusted native clicks',samples:[],ok:false};facts.sidebarFocus=report;
 const owned=ownedPage(),server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'self'; img-src 'self' data:; connect-src 'self'");if(req.url==='/site.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(owned.css);}else if(req.url==='/page/5/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(owned.html);}else{res.writeHead(404);res.end();}});
 let primary,start,error,cleanupError;
 const readShell=()=>fixture.js('('+shellReadback.toString()+')()'),readGuest=()=>fixture.pageJS(primary,'('+guestReadback.toString()+')()');
 const native=page=>{const value=fixture.nativeState(page);assert.equal(browser.tabs.get(page.id),page.page);for(const key of ['visible','parentVisible','cachedVisible','attached'])assert.equal(value[key],true);return{...value,dim:browser.mouseSidebarDim.state(page.page)};};
 async function settle(enabled,kind){
  await fixture.until(async()=>{const s=await readShell(),d=browser.mouseSidebarDim.state(primary.page);return s.dimmed===enabled&&s.settingsOpen===(kind==='settings')&&s.libraryOpen===(kind==='library')&&d.requested===enabled&&d.applied===enabled&&!d.pending},'sidebar native presentation reaches '+(kind||'closed'));
  await browser.mouseSidebarDim.flush();await fixture.frame();const [shell,guest]=await Promise.all([readShell(),readGuest()]);assertShell(shell,enabled,kind);assertGuest(guest,enabled);return{readback:shell,guest,native:[native(primary),native(records[1])]};
 }
 async function shot(filename,enabled){
  const [shell,guest]=await Promise.all([readShell(),readGuest()]),n=native(primary),expectedRGB=enabled?DIMMED:ORIGINAL;
  assert.equal(guest.witness.color,'rgb(37, 143, 191)');assert.equal(shell.witness.color,'rgb(37, 143, 191)');
  await capture(filename,[{name:'owned native sidebar witness',tabId:primary.id,webContentsId:n.webContentsId,point:{x:n.bounds.x+guest.witness.point.x,y:n.bounds.y+guest.witness.point.y},expectedRGB},{name:'owned browser start witness',tabId:start.id,point:shell.witness.point,expectedRGB}]);return filename;
 }
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});report.origin='http://127.0.0.1:'+server.address().port;report.csp="style-src 'self'";
  primary=await fixture.open(report.origin+'/page/5/',5);const opened=await browser.command('open',{url:'mouse://start',lane:'main'});start={id:opened.id,desk:fixture.bank.active};
  assert.equal(browser.state().tabs.find(tab=>tab.id===start.id)?.internal,true,'The start-page fixture is owned by browser chrome');assert.equal(browser.tabs.has(start.id),false,'An internal start page has no native WebContents');
  const tree=L.preset(3),slots={p1:primary.id,p2:records[1].id,p3:start.id};
  await fixture.js(`(async()=>{MouseTest.settingsUI.close();MouseTest.browsing.close();MouseTest.model.state=await MouseNative.browser('state');Object.assign(MouseTest.model,{tree:${JSON.stringify(tree)},slots:${JSON.stringify(slots)},active:'p1',mode:'',aiOpen:false,focusAI:false,focusPane:''});MouseTest.renderTree();MouseTest.applySide();const slot=document.querySelector('.pane[data-pane="p3"] .page-slot'),w=document.createElement('div');w.id='mouse-637-shell-witness';w.setAttribute('aria-hidden','true');for(const [key,value]of Object.entries({position:'absolute',left:'24px',top:'174px',width:'72px',height:'32px',background:'rgb(37,143,191)',zIndex:'10',pointerEvents:'none'}))w.style[key]=value;slot.append(w);await MouseTest.save();MouseTest.requestLayout();})()`);
  await fixture.until(()=>primary.page.visible&&records[1].page.visible&&primary.page.bounds?.height>280,'owned native and start layout is visible');await fixture.frame();
  report.owners={primary:primary.id,adjacent:records[1].id,start:start.id};
  for(const color of ['light','dark']){
   await theme(color);const before=await settle(false),identities=await Promise.all([fixture.identity(primary),fixture.identity(records[1])]),sample={theme:color,before:{...before,identities},captures:{}};report.samples.push(sample);
   sample.captures.before=await shot('mouse-637-sidebar-before-'+color+'.png',false);
   for(const kind of ['settings','library']){
    const openInput=await click(kind==='settings'?'#settings-button':'#history-button'),opened=await settle(true,kind),count=opened.guest.clicks.length,clickInput=await click('#dim-click',primary);let afterClick;
    await fixture.until(async()=>{afterClick=await readGuest();return afterClick.clicks.length===count+1},'native click passes through '+kind+' dim');assert.equal(afterClick.clicks.at(-1).trusted,true);
    const current=await settle(true,kind);assert.deepEqual(current.guest.author,before.guest.author,'Author filters, transforms and pseudo-elements remain their own');sample[kind]={openInput,clickInput,...current,clicks:afterClick.clicks};
    sample.captures[kind]=await shot('mouse-637-sidebar-'+kind+'-'+color+'.png',true);
    sample[kind].closeInput=await click(kind==='settings'?'#settings-dialog [data-close-dialog]':'#library-close');await settle(false);
   }
   const after=await settle(false),afterIdentities=await Promise.all([fixture.identity(primary),fixture.identity(records[1])]);for(let i=0;i<identities.length;i++)fixture.assertIdentity(identities[i],afterIdentities[i]);assert.deepEqual(after.guest.author,before.guest.author);sample.after={...after,identities:afterIdentities};sample.captures.restored=await shot('mouse-637-sidebar-restored-'+color+'.png',false);
  }
  report.ok=true;
 }catch(cause){error=cause;
 }finally{
  try{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(report.ok){await fixture.setLayout(records);await fixture.js(`MouseTest.mutateDesktopTabs('close-tab',{id:${JSON.stringify(primary.id)}})`);}}
  catch(cause){cleanupError=cause;}
  // mouse://start lives in the start-page service, outside browser.tabs and
  // the native fixture cleanup. Close only our internal ID on every outcome.
  try{if(start){await fixture.js(`MouseTest.mutateDesktopTabs('close-tab',{id:${JSON.stringify(start.id)}})`);assert.equal(browser.state().tabs.some(tab=>tab.id===start.id),false);}}
  catch(cause){cleanupError||=cause;}
  report.ok=!error&&!cleanupError;
 }
 if(error||cleanupError)throw error||cleanupError;
 return report;
};
module.exports.fixtures={ownedPage,shellReadback,guestReadback,assertGuest,assertShell,ORIGINAL,DIMMED};
