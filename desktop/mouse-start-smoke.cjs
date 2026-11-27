'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<200;n++){if(await fn())return;await sleep(60);}throw Error('Timed out '+label);}
async function selectNativeLayout({app,win,js,service,overlayGate,nativeInput,Menu,screen=require('electron').screen,platform=process.platform,wait=until,pause=sleep,save=record=>fs.writeFile('mouse-635-start-layout.json',JSON.stringify(record,null,2)+'\n')}){
 const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs'),{fixtureWindowBounds,containsRect}=require('./mouse-631-smoke-helpers.cjs'),popup=Menu.prototype.popup,started=Date.now(),originalBounds=win.getBounds();
 const facts={schema:1,source:'Actual native footer pointer and menu key events',target:'mouse-context-layout-2-x',input:null,keys:[],menu:null,ok:false};let menu;
 Menu.prototype.popup=function(options){
  if(service.lastMenu===this&&service.lastTarget?.kind==='layout'){
   menu=this;facts.menu={target:{...service.lastTarget},shownAt:null,closedAt:null,items:this.items.map(item=>({id:item.id,enabled:item.enabled,visible:item.visible,type:item.type,checked:item.checked}))};
   this.once('menu-will-show',()=>{facts.menu.shownAt=Date.now();});this.once('menu-will-close',()=>{facts.menu.closedAt=Date.now();});
  }
  return Reflect.apply(popup,this,arguments);
 };
 try{
  // Earlier geometry checks deliberately leave a 1440px window on a smaller
  // CI display. A renderer hit is not an OS hit until its window is on-screen.
  const display=screen.getDisplayMatching(originalBounds),work=display.workArea;
  facts.geometry={before:{window:originalBounds,content:win.getContentBounds()},display:{id:display.id,bounds:display.bounds,workArea:work}};
  if(!containsRect(work,originalBounds)||!containsRect(work,win.getContentBounds())){facts.geometry.requested=fixtureWindowBounds(work,win.getMinimumSize());win.setBounds(facts.geometry.requested);}
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();await wait(()=>win.isFocused(),'native layout menu window focus');let hit;
  await wait(async()=>{const content=win.getContentBounds(),viewport=await js('({width:innerWidth,height:innerHeight})');facts.geometry.fitted={window:win.getBounds(),content,viewport};return containsRect(work,win.getBounds())&&containsRect(work,content)&&viewport.width===content.width&&viewport.height===content.height;},'native layout menu on-screen viewport');
  await wait(async()=>{hit=await js('('+nativeHitTarget.toString()+')(document.querySelector("#layout-menu-button"))');return hit.ready;},'native layout menu pointer target');
  const origin=win.getContentBounds(),point={x:Math.round(origin.x+hit.x),y:Math.round(origin.y+hit.y)};
  assert.ok(containsRect(work,{...point,width:1,height:1}),'Native menu pointer is inside the actual display work area');
  facts.input={source:platform==='darwin'?'CGEvent':platform==='win32'?'User32':'XTest',point,at:Date.now()};assert.equal(await nativeInput.testClick(point.x,point.y),true);
  await wait(()=>facts.menu?.shownAt!==null&&facts.menu?.shownAt!==undefined,'native layout menu actually shown');
  assert.equal(overlayGate.blocked,false,'Native menu keeps live pages attached');
  const choices=menu.items.filter(item=>item.visible&&item.enabled&&item.type!=='separator'),index=choices.findIndex(item=>item.id===facts.target);assert.ok(index>=0);
  const key=async name=>{const value=platform==='linux'?({HOME:'Home',DOWN:'Down',ENTER:'Return'})[name]:name;facts.keys.push({key:name,at:Date.now()});assert.equal(nativeInput.testKey(value),true);await pause(45);};
  await key('HOME');for(let n=0;n<index;n++)await key('DOWN');await key('ENTER');
  await wait(()=>facts.menu.closedAt!==null,'native layout menu actually closed');
  await wait(async()=>{facts.after=await js('(()=>({count:MouseLayout.leaves(MouseTest.model.tree).length,axis:MouseTest.model.tree.axis||"",select:document.querySelector("#layout-select").value,expanded:document.querySelector("#layout-menu-button").getAttribute("aria-expanded")}))()');return facts.after.count===2&&facts.after.axis==='x'&&facts.after.select==='2'&&facts.after.expanded==='false';},'native layout menu applies and closes');
  facts.ok=true;return facts;
 }catch(error){facts.error=error.message;throw error;}
 finally{
  Menu.prototype.popup=popup;if(menu&&facts.menu.closedAt===null)try{menu.closePopup(win);}catch{}
  let restoreError;
  if(facts.geometry?.requested)try{win.setBounds(originalBounds);await wait(async()=>{const content=win.getContentBounds(),viewport=await js('({width:innerWidth,height:innerHeight})');return viewport.width===content.width&&viewport.height===content.height;},'native layout menu original viewport restored');facts.geometry.restored=win.getBounds();assert.deepEqual(facts.geometry.restored,originalBounds);}catch(error){restoreError=error;facts.ok=false;facts.restoreError=error.message;}
  facts.elapsedMs=Date.now()-started;await save(facts);
  if(restoreError&&!facts.error)throw restoreError;
 }
}
module.exports=async({app,win,browser,store,libraryService,overlayGate,startService})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 async function click(selector){const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing click target');const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await sleep(140);}
 const old=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,locale:MouseTest.model.locale}))');
 const original=new Map([...browser.tabs.values()].map(t=>[t.id,t.view.webContents.id]));
 function noGuestAboveModal(){assert.equal(overlayGate.blocked,true);assert.equal(browser.panels.length,0);for(const t of browser.tabs.values()){assert.equal(t.visible,false);assert.ok(!win.contentView.children.includes(t.clipView||t.view),'native webpage detached during modal');}}
 for(const [button,dialog,close] of [
  ['#statusbar [data-action=website]','#website-dialog','#website-dialog [data-close-dialog]'],
  ['#version-button','#update-dialog','#update-dialog [data-close-dialog]'],
  ['#screenshot-button','#capture-dialog','#capture-close']
 ]){
  const stale=structuredClone(browser.panels);await click(button);await until(()=>js(`document.querySelector('${dialog}').open`),'footer modal '+dialog);noGuestAboveModal();
  // The old one-shot hide() design fails this check. A busy guest/resize may
  // deliver an obsolete layout after the dialog is already visible.
  browser.layout(stale);browser.emit();win.emit('resize');await sleep(150);noGuestAboveModal();
  await click(close);await until(()=>!overlayGate.blocked&&browser.panels.length>0,'modal closes and pages resume');
 }
 await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'Nora ready');assert.equal(await js('!!document.querySelector("#desk-settings")'),false,'Nora has no settings gear');await click('#desks-close');await until(()=>js('!MouseTest.desktopUI.holdsNative&&!document.querySelector("#desktop-tray").open'),'Nora closes before footer settings');
 await click('#settings-button');await until(()=>js('document.querySelector("#settings-dialog").open'),'footer opens browser settings');await until(()=>!overlayGate.blocked&&browser.panels.length>0,'settings retains live native pages');assert.equal(await js('document.querySelector("#settings-dialog").matches(":modal")'),false);assert.equal(await js('document.querySelector("#desktop-tray").open'),false);await click('#settings-dialog [data-close-dialog]');await until(()=>!overlayGate.blocked&&browser.panels.length>0,'settings closes and pages resume');
 console.log('MOUSE_ALL_FOOTER_MODALS_NATIVE_BARRIER_RACE_PASS');
 await click('#settings-button');await until(()=>js('document.querySelector("#settings-dialog").open'),'settings locale');await click('.settings-nav-item[data-settings-page=appearance]');
 for(const [select,value] of [['#settings-language','en'],['#settings-language','ru']]){
  await click(select);await until(()=>js('document.querySelector("#choice-dialog").open'),'settings language chooser opens');noGuestAboveModal();await click('#choice-dialog button.language-chooser-row:enabled:has(bdi[lang="'+value+'"])');await until(()=>!overlayGate.blocked,'choice releases native pages');assert.equal(await js(`document.querySelector('${select}').value`),value);
 }
 const nativeInput=process.platform==='darwin'?require('./mouse-native-menu.node'):process.platform==='win32'?require('./mouse-windows-input.cjs').createWindowsInput():require('./mouse-linux-input.cjs').createLinuxInput();
 await click('#settings-dialog [data-close-dialog]');await until(()=>!overlayGate.blocked&&browser.panels.length>0,'settings language returns to pages');
 await selectNativeLayout({app,win,js,service:libraryService.contextMenu,overlayGate,nativeInput,Menu:require('electron').Menu});
 console.log('MOUSE_FOOTER_CHOOSERS_REAL_CLICK_PASS');
 const server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.setHeader('Content-Type','image/png');require('node:fs').createReadStream(path.join(__dirname,'mouse/brand.png')).pipe(res);return;}res.end('<!doctype html><title>Start target fixture</title><h1>Opened visual bookmark</h1>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/start-target';
 try{
  // Exercise the actual offer and confirmation while redirecting only its
  // public URL to the local native-page fixture; do not depend on the website.
  const websiteCommand=browser.command.bind(browser),beforeWebsite=new Set(browser.state().tabs.map(t=>t.id));let websiteRequests=0,websiteId='';
  browser.command=(action,args={})=>{if(action==='open'&&args.url==='https://mouse.black'){websiteRequests++;return websiteCommand(action,{...args,url});}return websiteCommand(action,args);};
  try{
   await click('#statusbar [data-action=website]');await until(()=>js('document.querySelector("#website-dialog").open'),'brand offers the website');assert.equal(websiteRequests,0);assert.equal(await js('document.querySelector("#settings-dialog").open'),false,'Brand no longer duplicates settings');
   await click('#website-dialog footer [data-close-dialog]');await until(()=>!overlayGate.blocked,'website offer cancelled');assert.equal(websiteRequests,0);assert.deepEqual(new Set(browser.state().tabs.map(t=>t.id)),beforeWebsite);
   await click('#statusbar [data-action=website]');await until(()=>js('document.querySelector("#website-dialog").open'),'brand offer reopened');await click('[data-action=open-website]');await until(()=>{const t=browser.state().tabs.find(t=>!beforeWebsite.has(t.id));websiteId=t?.id||'';return websiteRequests===1&&!!t&&!t.loading;},'confirmed website opens a new native tab');
   for(const id of beforeWebsite)assert.ok(browser.state().tabs.some(t=>t.id===id),'Existing tabs survive the website offer');assert.equal(await js('document.querySelector("#website-dialog").open'),false);
   console.log('MOUSE_632_WEBSITE_OFFER_NEW_TAB_PASS');
  }finally{browser.command=websiteCommand;if(websiteId)await browser.command('close',{id:websiteId});}
  await js('MouseTest.changeLayout(1)');await click('#new-tab');await until(()=>js('!!document.querySelector(".pane .home-page")'),'new visual tab');
  const internal=await js('MouseTest.model.classicTabId');assert.ok(startService.tabs.has(internal));assert.equal(browser.tabs.has(internal),false,'internal page is not a remote webpage');
  await click('.favorite-add');await until(()=>js('document.querySelector("#start-bookmark-dialog").open'),'add tile dialog');noGuestAboveModal();
  await click('#start-bookmark-name');win.webContents.insertText('Visual bookmark fixture');await click('#start-bookmark-url');win.webContents.insertText(url);await click('#start-bookmark-form button[type=submit]');
  await until(()=>libraryService.library.data.bookmarks.some(x=>x.url===url),'bookmark stored');await until(()=>js('document.querySelector(".favorites-grid").textContent.includes("Visual bookmark fixture")'),'real tile shown');
  const row=libraryService.library.data.bookmarks.find(x=>x.url===url);await click('[data-bookmark="'+row.id+'"] .favorite-open');await until(()=>browser.tabs.get(internal)?.view.webContents.getURL()===url,'bookmark navigates in same pane');assert.equal(startService.tabs.has(internal),false);
  await click('#new-tab');await until(()=>js('!!document.querySelector(".home-page")'),'second visual tab');await js('MouseTest.home.refresh()');
  await until(()=>libraryService.library.list('history',url).items.some(x=>x.url===url&&x.title==='Start target fixture'),'completed meaningful visit persisted');
  await until(()=>js('document.querySelector(".recent-grid").textContent.includes("Start target fixture")'),'recent cards update from real delayed history');
  await fs.writeFile('mouse-604-start-page.png',(await win.capturePage()).toPNG());
  await click('.home-customize');await until(()=>js('document.querySelector("#start-settings-dialog").open'),'start customization');noGuestAboveModal();await click('[data-background="sea"].background-preset');await until(()=>startService.getPreferences().background==='sea','preset stored');
  await click('#start-settings-dialog .start-close');await until(()=>!overlayGate.blocked,'start settings close');
  const fixture=path.join(app.getPath('userData'),'start-background-fixture.png');await fs.copyFile(path.join(__dirname,'mouse/brand.png'),fixture);await startService.setBackground(fixture);await js('MouseTest.home.refresh()');assert.equal(startService.getPreferences().background,'custom');assert.ok(await js('document.querySelector(".home-page").style.backgroundImage.includes("data:image/jpeg")'));
  assert.ok(startService.tabs.size>=1);await startService.flush();assert.ok((await fs.stat(path.join(app.getPath('userData'),'quadro-start-background.jpg'))).size>0);
  for(const [id,wc] of original){assert.equal(browser.tabs.get(id)?.view.webContents.id,wc,'modal/start page must preserve existing page instance');}
  console.log('MOUSE_VISUAL_BOOKMARK_RECENT_BACKGROUND_PASS');
 }finally{await new Promise(r=>server.close(r));}
 // Existing layout/persistence regressions still run against the pre-test split.
 await js(`MouseTest.returnToGrid();Object.assign(MouseTest.model,${JSON.stringify(old)});MouseTest.renderTree();MouseTest.applySide()`);await until(()=>browser.panels.length>0,'original layout restored');
};
module.exports.selectNativeLayout=selectNativeLayout;
