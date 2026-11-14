'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<200;n++){if(await fn())return;await sleep(60);}throw Error('Timed out '+label);}
module.exports=async({app,win,browser,store,libraryService,overlayGate,startService})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 async function click(selector){const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing click target');const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await sleep(140);}
 const old=await js('JSON.parse(JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,locale:QuadroTest.model.locale}))');
 const original=new Map([...browser.tabs.values()].map(t=>[t.id,t.view.webContents.id]));
 function noGuestAboveModal(){assert.equal(overlayGate.blocked,true);assert.equal(browser.panels.length,0);for(const t of browser.tabs.values()){assert.equal(t.visible,false);assert.ok(!win.contentView.children.includes(t.clipView||t.view),'native webpage detached during modal');}}
 for(const [button,dialog,close] of [
  ['#statusbar [data-action=settings]','#settings-dialog','#settings-dialog [data-close-dialog]'],
  ['#statusbar [data-action=wallet]','#web3-dialog','#web3-close'],
  ['#version-button','#update-dialog','#update-dialog [data-close-dialog]'],
  ['#screenshot-button','#capture-dialog','#capture-close']
 ]){
  const stale=structuredClone(browser.panels);await click(button);await until(()=>js(`document.querySelector('${dialog}').open`),'footer modal '+dialog);noGuestAboveModal();
  // The old one-shot hide() design fails this check. A busy guest/resize may
  // deliver an obsolete layout after the dialog is already visible.
  browser.layout(stale);browser.emit();win.emit('resize');await sleep(150);noGuestAboveModal();
  await click(close);await until(()=>!overlayGate.blocked&&browser.panels.length>0,'modal closes and pages resume');
 }
 console.log('QUADRO_ALL_FOOTER_MODALS_NATIVE_BARRIER_RACE_PASS');
 for(const [select,value] of [['#language-select','en'],['#language-select','ru'],['#layout-select','2']]){
  await click(select);await until(()=>js('document.querySelector("#choice-dialog").open'),'footer select opens');noGuestAboveModal();await click('#choice-dialog button[data-value="'+value+'"]');await until(()=>!overlayGate.blocked,'choice releases native pages');assert.equal(await js(`document.querySelector('${select}').value`),value);
 }
 console.log('QUADRO_FOOTER_CHOOSERS_REAL_CLICK_PASS');
 const server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.setHeader('Content-Type','image/png');require('node:fs').createReadStream(path.join(__dirname,'quadro/brand.png')).pipe(res);return;}res.end('<!doctype html><title>Start target fixture</title><h1>Opened visual bookmark</h1>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/start-target';
 try{
  await js('QuadroTest.changeLayout(1)');await click('#new-tab');await until(()=>js('!!document.querySelector(".pane .home-page")'),'new visual tab');
  const internal=await js('QuadroTest.model.slots[QuadroTest.model.active]');assert.ok(startService.tabs.has(internal));assert.equal(browser.tabs.has(internal),false,'internal page is not a remote webpage');
  await click('.favorite-add');await until(()=>js('document.querySelector("#start-bookmark-dialog").open'),'add tile dialog');noGuestAboveModal();
  await click('#start-bookmark-name');win.webContents.insertText('Visual bookmark fixture');await click('#start-bookmark-url');win.webContents.insertText(url);await click('#start-bookmark-form button[type=submit]');
  await until(()=>libraryService.library.data.bookmarks.some(x=>x.url===url),'bookmark stored');await until(()=>js('document.querySelector(".favorites-grid").textContent.includes("Visual bookmark fixture")'),'real tile shown');
  const row=libraryService.library.data.bookmarks.find(x=>x.url===url);await click('[data-bookmark="'+row.id+'"] .favorite-open');await until(()=>browser.tabs.get(internal)?.view.webContents.getURL()===url,'bookmark navigates in same pane');assert.equal(startService.tabs.has(internal),false);
  await click('#new-tab');await until(()=>js('!!document.querySelector(".home-page")'),'second visual tab');await js('QuadroTest.home.refresh()');
  assert.ok(await js('document.querySelector(".recent-grid").textContent.includes("Start target fixture")'),'recent cards are real history');
  await fs.writeFile('quadro-604-start-page.png',(await win.capturePage()).toPNG());
  await click('.home-customize');await until(()=>js('document.querySelector("#start-settings-dialog").open'),'start customization');noGuestAboveModal();await click('[data-background="sea"].background-preset');await until(()=>startService.getPreferences().background==='sea','preset stored');
  await click('#start-settings-dialog .start-close');await until(()=>!overlayGate.blocked,'start settings close');
  const fixture=path.join(app.getPath('userData'),'start-background-fixture.png');await fs.copyFile(path.join(__dirname,'quadro/brand.png'),fixture);await startService.setBackground(fixture);await js('QuadroTest.home.refresh()');assert.equal(startService.getPreferences().background,'custom');assert.ok(await js('document.querySelector(".home-page").style.backgroundImage.includes("data:image/jpeg")'));
  assert.ok(startService.tabs.size>=1);await startService.flush();assert.ok((await fs.stat(path.join(app.getPath('userData'),'quadro-start-background.jpg'))).size>0);
  for(const [id,wc] of original){assert.equal(browser.tabs.get(id)?.view.webContents.id,wc,'modal/start page must preserve existing page instance');}
  console.log('QUADRO_VISUAL_BOOKMARK_RECENT_BACKGROUND_PASS');
 }finally{await new Promise(r=>server.close(r));}
 // Existing layout/persistence regressions still run against the pre-test split.
 await js(`Object.assign(QuadroTest.model,${JSON.stringify(old)});QuadroTest.renderTree();QuadroTest.applySide()`);await until(()=>browser.panels.length>0,'original layout restored');
};
