'use strict';
// Cross-platform footer actions through real renderer pointer input. The only
// public destination is redirected to an owned HTTP fixture for this test.
const assert=require('node:assert/strict'),http=require('node:http');
module.exports=async({win,browser,js,click,until})=>{
 const original=await js('JSON.parse(JSON.stringify({preferences:MouseTest.prefs(),focusPane:MouseTest.model.focusPane,focusAI:MouseTest.model.focusAI,libraryOpen:MouseTest.model.libraryOpen}))');
 const pages=new Map(browser.state().tabs.map(t=>[t.id,{id:t.id,url:t.url,internal:!!t.internal,page:browser.tabs.get(t.id),wc:browser.tabs.get(t.id)?.view.webContents,epoch:browser.tabs.get(t.id)?.navigationEpoch||0}]));
 const ids=()=>browser.state().tabs.map(t=>t.id).sort(),beforeIds=ids(),command=browser.command;
 const state=()=>js('MouseNative.agent("state")');let requested=0,websiteId='',server;
 const layout=()=>js('JSON.stringify((({mode,tree,slots,active,tabOrder,aiId,aiSessions,aiOpen,aiWidth})=>({mode,tree,slots,active,tabOrder,aiId,aiSessions,aiOpen,aiWidth}))(MouseTest.prefs()))');
 function retainedPages(){for(const [id,record]of pages){const current=browser.state().tabs.find(t=>t.id===id);assert.ok(current,'Existing tab survives a footer action');assert.equal(current.url,record.url);assert.equal(!!current.internal,record.internal);if(record.wc){const page=browser.tabs.get(id);assert.equal(page,record.page);assert.equal(page.view.webContents,record.wc);assert.equal(page.navigationEpoch||0,record.epoch);assert.equal(record.wc.isDestroyed(),false);}}}
 async function openSettings(){await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'footer632 Nora ready');await click('#desk-settings');await until(()=>js('document.querySelector("#settings-dialog").open'),'footer632 settings visible');}
 async function openHelper(){await openSettings();await click('[data-action="assistant"]');await until(()=>js('MouseTest.model.agentOpen&&!document.querySelector("#agent-panel").hidden'),'footer632 helper explicitly opened');}
 try{
  assert.equal((await state()).enabled,false,'The fixture must begin with the optional agent disconnected');
  assert.equal(await js('MouseTest.model.agentOpen'),false);
  server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><title>Mouse632 website offer fixture</title><h1>Owned website destination</h1>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/website-offer';
  browser.command=function(action,args={}){if(action==='open'&&args.url==='https://mouse.black'){requested++;return command.call(this,action,{...args,url});}return command.call(this,action,args);};
  const beforeCancel=await layout();await click('#statusbar [data-action="website"]');await until(()=>js('document.querySelector("#website-dialog").open'),'footer632 logo opens the website offer');assert.equal(await js('document.querySelector("#settings-dialog").open'),false);assert.equal(requested,0);
  await click('#website-dialog footer [data-close-dialog]');await until(()=>js('!document.querySelector("#website-dialog").open'),'footer632 offer cancelled');assert.equal(requested,0);assert.deepEqual(ids(),beforeIds);assert.equal(await layout(),beforeCancel);retainedPages();
  await click('#statusbar [data-action="website"]');await until(()=>js('document.querySelector("#website-dialog").open'),'footer632 offer reopened');await click('[data-action="open-website"]');
  await until(()=>{const tab=browser.state().tabs.find(t=>!pages.has(t.id));websiteId=tab?.id||'';return requested===1&&tab?.url===url&&!tab.loading;},'footer632 confirmation opens the owned native page');assert.equal(ids().length,beforeIds.length+1);assert.equal(await js('document.querySelector("#website-dialog").open'),false);retainedPages();
  const websiteOffer={cancelledWithoutNavigation:true,settingsDistinct:true,confirmedUrl:'https://mouse.black',confirmedAsNewTab:true,existingTabsPreserved:true};
  await browser.command('close',{id:websiteId});websiteId='';await until(()=>ids().length===beforeIds.length,'footer632 destination cleanup');
  await js(`(async()=>{Object.assign(MouseTest.model,${JSON.stringify(original.preferences)});MouseTest.model.state=await MouseNative.browser('state');MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();await MouseTest.save();})()`);
  await until(()=>js('!!document.querySelector(".pane .home-page")'),'footer632 ordinary start page');
  const ui=await js('({entries:document.querySelectorAll("[data-action=assistant]").length,promos:document.querySelectorAll(".home-agent-open").length,presets:document.querySelectorAll(".ai-preset-card[data-ai-url=\\"mouse://agent\\"],#ai-select option[value=\\"mouse://agent\\"]").length})');assert.deepEqual(ui,{entries:1,promos:0,presets:0});
  const beforeHelper=await layout();await openHelper();assert.equal(await layout(),beforeHelper,'Manual helper keeps the complete browser layout');assert.equal((await state()).enabled,false,'Showing the helper does not start its connection');assert.deepEqual(ids(),beforeIds);retainedPages();
  await click('#agent-close');await until(()=>js('!MouseTest.model.agentOpen&&document.querySelector("#agent-panel").hidden'),'footer632 helper closes from its own control');assert.equal((await state()).enabled,false);assert.equal(await layout(),beforeHelper,'Closing the helper restores the prior web-AI panel state');
  await openHelper();await js('MouseTest.save()');
  const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Mouse632 shell reload timed out')),12000);win.webContents.once('did-finish-load',()=>{clearTimeout(timer);resolve();});});win.webContents.reload();await loaded;
  await until(()=>js('document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest'),'footer632 shell reloaded');assert.equal(await js('MouseTest.model.agentOpen'),false);assert.equal(await js('document.querySelector("#agent-panel").hidden'),true);assert.equal((await state()).enabled,false);retainedPages();assert.deepEqual(ids(),beforeIds);
  const manualHelper={singleEntry:true,noStartPromo:true,noProviderPromotion:true,openedExplicitly:true,disabledUntilEnabled:true,closed:true,pagesPreserved:true,layoutPreserved:true,autoRestoreDisabled:true};
  console.log('MOUSE_632_WEBSITE_OFFER_NEW_TAB_PASS');console.log('MOUSE_632_OPTIONAL_HELPER_MANUAL_ONLY_PASS');
  return{websiteOffer,manualHelper};
 }finally{
  browser.command=command;
  await js('document.querySelector("#website-dialog").close();document.querySelector("#settings-dialog").close();MouseTest.desktopUI.close({immediate:true})').catch(()=>{});
  if(websiteId)await browser.command('close',{id:websiteId}).catch(()=>{});
  try{await js(`(async()=>{Object.assign(MouseTest.model,${JSON.stringify(original.preferences)},{focusPane:${JSON.stringify(original.focusPane)},focusAI:${JSON.stringify(original.focusAI)},libraryOpen:${JSON.stringify(original.libraryOpen)}});MouseTest.model.state=await MouseNative.browser('state');MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();await MouseTest.save();})()`);}
  finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
 }
};
