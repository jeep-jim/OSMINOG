'use strict';
// Shared retained-fixture proof for the owner's641 link behavior. A real link
// opens a normal classic tab; preparation of an existing side preview is a
// separate, explicitly labelled fixture operation in the calling suites.
const assert=require('node:assert/strict');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {focusNativeInputWindow}=require('./mouse-636-native-input-focus.cjs');
function installLinkPointerReceipt(selector){
 globalThis.__mouse641LinkPointer?.dispose();
 const anchor=document.querySelector(selector);if(!anchor||anchor.tagName!=='A')throw Error('Missing owned anchor '+selector);
 const events=[],onPointer=event=>{const target=event.target?.closest?.('a');if(target!==anchor)return;events.push({type:event.type,id:target.id,href:target.href,matches:target===anchor,trusted:event.isTrusted,isTrusted:event.isTrusted,button:event.button,pointerType:event.pointerType,at:Date.now()});};
 window.addEventListener('pointerdown',onPointer,true);
 globalThis.__mouse641LinkPointer={events,dispose(){window.removeEventListener('pointerdown',onPointer,true);}};return true;
}
// An ordinary click is consumed in the isolated preload before document click
// listeners run. Observe only the preceding trusted pointerdown; verify() then
// proves the actual new main tab and unchanged source document independently.
async function nativeLinkInput({app,win,fixture,nativeInput,record,selector}){
 const focusReadiness=await focusNativeInputWindow({app,win,until:fixture.until});let hit;
 await fixture.until(async()=>{hit=await fixture.pageJS(record,'('+nativeHitTarget.toString()+')(document.querySelector('+JSON.stringify(selector)+'))');return hit.ready;},'641 native anchor target '+selector);
 const factor=record.page.view.webContents.getZoomFactor(),contentBounds=win.getContentBounds(),pageBounds={...record.page.bounds},point={x:Math.round(contentBounds.x+pageBounds.x+hit.x*factor),y:Math.round(contentBounds.y+pageBounds.y+hit.y*factor)};
 const receipt={selector,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',action:'intercepted-link',pid:process.pid,at:Date.now(),evidence:'Trusted pointerdown on the exact anchor before isolated click interception',point,tabId:record.id,webContentsId:record.page.view.webContents.id,hit,factor,contentBounds,pageBounds,focusReadiness};
 await fixture.pageJS(record,'('+installLinkPointerReceipt.toString()+')('+JSON.stringify(selector)+')');
 try{
  assert.equal(await nativeInput.testClick(point.x,point.y),true);
  await fixture.until(async()=>{receipt.events=await fixture.pageJS(record,'__mouse641LinkPointer.events.slice()');return receipt.events.some(event=>event.type==='pointerdown'&&event.trusted&&event.matches&&event.button===0);},'641 trusted native anchor pointerdown '+selector);
  return receipt;
 }finally{await fixture.pageJS(record,'__mouse641LinkPointer.dispose();delete globalThis.__mouse641LinkPointer;true');}
}
function assertInterceptedChatNavigation(before,after,witness,assertIdentity){
 assert.equal(witness.tabId,before.id);assert.equal(witness.webContentsId,before.webContentsId);
 assert.deepEqual(witness.events,[],'Isolated link interception starts no source WebContents navigation');
 assert.ok(Number.isSafeInteger(before.navigationEpoch)&&before.navigationEpoch>=0);assert.equal(after.navigationEpoch,before.navigationEpoch);
 assertIdentity(before,after);
}
function readback(){
 const m=MouseTest.model;
 return{classicTabId:m.classicTabId||'',view:document.body.dataset.viewMode||'',tree:m.tree,slots:{...m.slots},aiId:m.aiId||'',previewId:m.aiPreviewId||'',
  panes:[...document.querySelectorAll('#stage .pane')].map(pane=>({id:pane.dataset.pane,view:pane.dataset.view})),
  returnVisible:!!document.querySelector('#return-to-grid')&&!document.querySelector('#return-to-grid').hidden};
}
function assertRouting(receipt){
 const {beforeGrid,state,tab}=receipt;assert.equal(beforeGrid.classicTabId,'');assert.equal(beforeGrid.view,'grid');
 assert.equal(receipt.input.selector,receipt.selector);assert.equal(receipt.input.tabId,receipt.chatBefore.id);assert.equal(receipt.input.webContentsId,receipt.chatBefore.webContentsId);
 assert.ok(receipt.input.events.some(event=>event.type==='pointerdown'&&event.id===receipt.selector.slice(1)&&event.href===receipt.url&&event.trusted===true&&event.isTrusted===true&&event.matches===true&&event.button===0&&event.pointerType==='mouse'),'The exact source anchor received trusted native pointer input');
 assert.ok(tab&&typeof tab.id==='string'&&tab.id.length);assert.equal(tab.lane,'main');assert.equal(tab.previewOf,'');assert.equal(tab.url,receipt.url);assert.ok(Number.isSafeInteger(tab.webContentsId)&&tab.webContentsId>0);
 assert.equal(state.classicTabId,tab.id);assert.equal(state.view,'classic');assert.equal(state.returnVisible,true);assert.deepEqual(state.panes,[{id:'p0',view:'classic'}]);
 assert.deepEqual(state.tree,beforeGrid.tree);assert.deepEqual(state.slots,beforeGrid.slots);assert.equal(state.aiId,beforeGrid.aiId);assert.equal(state.previewId,beforeGrid.previewId);
}
function assertReturnedGrid(receipt){
 const {beforeGrid,returnedGrid}=receipt;assert.equal(returnedGrid.classicTabId,'');assert.equal(returnedGrid.view,'grid');assert.equal(returnedGrid.returnVisible,false);assert.deepEqual(returnedGrid.tree,beforeGrid.tree);assert.deepEqual(returnedGrid.slots,beforeGrid.slots);assert.deepEqual(returnedGrid.panes,beforeGrid.panes);assert.equal(returnedGrid.aiId,beforeGrid.aiId);assert.equal(returnedGrid.previewId,beforeGrid.previewId);
}
async function verify({browser,fixture,chat,url,index,selector,input,returnInput}){
 const beforeIds=new Set(browser.tabs.keys()),receipt={source:'Native link input opens an ordinary classic tab; native Grid control restores the untouched saved grid',selector,url,beforeGrid:await fixture.js('('+readback.toString()+')()'),chatBefore:await fixture.identity(chat)};
 receipt.input=await input();let page;
 await fixture.until(()=>{page=[...browser.tabs.values()].find(candidate=>!beforeIds.has(candidate.id)&&candidate.lane==='main'&&candidate.view.webContents.getURL()===url);return page&&!page.loading&&!page.error&&page.visible;},'641 native AI link opens its ordinary tab');
 const record={id:page.id,index,desk:fixture.bank.active,page};fixture.created.push(record);await fixture.preparePage(record);
 await fixture.until(()=>fixture.js('MouseTest.model.classicTabId==='+JSON.stringify(page.id)),'641 renderer selects the native linked tab');await fixture.frame();
 receipt.state=await fixture.js('('+readback.toString()+')()');receipt.tab={id:page.id,lane:page.lane,previewOf:page.previewOf||'',url:page.view.webContents.getURL(),webContentsId:page.view.webContents.id};receipt.chatAfter=await fixture.identity(chat);
 assertRouting(receipt);fixture.assertIdentity(receipt.chatBefore,receipt.chatAfter);
 receipt.returnInput=await returnInput();await fixture.until(()=>fixture.js('!MouseTest.model.classicTabId&&document.body.dataset.viewMode==="grid"'),'641 native Grid control restores saved layout');await fixture.until(()=>chat.page.visible,'641 original chat returns with grid');await fixture.frame();
 receipt.returnedGrid=await fixture.js('('+readback.toString()+')()');assertReturnedGrid(receipt);fixture.assertIdentity(receipt.chatBefore,await fixture.identity(chat));
 return{receipt,record};
}
module.exports={verify,readback,assertRouting,assertReturnedGrid,nativeLinkInput,installLinkPointerReceipt,assertInterceptedChatNavigation};
