'use strict';
// Shared retained-fixture proof for the owner's641 link behavior. A real link
// opens a normal classic tab; preparation of an existing side preview is a
// separate, explicitly labelled fixture operation in the calling suites.
const assert=require('node:assert/strict');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {focusNativeInputWindow}=require('./mouse-636-native-input-focus.cjs');
const {nativeGuestInputState,observeGuestClick}=require('./mouse-636-guest-input-diagnostics.cjs');
function installLinkPointerReceipt(selector){
 globalThis.__mouse641LinkPointer?.dispose();
 const anchor=document.querySelector(selector);if(!anchor||anchor.tagName!=='A')throw Error('Missing owned anchor '+selector);
 const events=[],observedEvents=[];let dropped=0;
 const onPointer=event=>{const target=event.target?.closest?.('a'),row={type:event.type,id:target?.id||event.target?.id||'',href:target?.href||'',matches:target===anchor,trusted:event.isTrusted,isTrusted:event.isTrusted,button:event.button,pointerType:event.pointerType,at:Date.now(),x:event.clientX,y:event.clientY};if(observedEvents.length<16)observedEvents.push(row);else dropped++;if(target===anchor&&events.length<16)events.push(row);};
 window.addEventListener('pointerdown',onPointer,true);
 globalThis.__mouse641LinkPointer={events,read:()=>({events:events.slice(),observedEvents:observedEvents.slice(),dropped}),dispose(){window.removeEventListener('pointerdown',onPointer,true);}};return true;
}
function linkTargetReadback(selector,hitTarget){
 const anchor=document.querySelector(selector);
 return{hit:hitTarget(anchor),focused:document.hasFocus(),visible:document.visibilityState==='visible',viewport:{width:innerWidth,height:innerHeight},url:location.href,timeOrigin:performance.timeOrigin,anchor:anchor?{id:anchor.id,href:anchor.href,connected:anchor.isConnected}:null};
}
function linkNativeReady(native,dom,factor,webContentsId,{focused=true}={}){
 const finite=rect=>rect&&['x','y','width','height'].every(key=>Number.isFinite(rect[key]))&&rect.width>0&&rect.height>0;
 const state=native?.native,view=state?.viewBounds,parent=state?.parentBounds,bounds=state?.cachedBounds,content=native?.contentBounds;
 if(!finite(view)||!finite(bounds)||!finite(content)||(parent!==null&&!finite(parent)))return false;
 const actual={x:view.x+(parent?.x||0),y:view.y+(parent?.y||0),width:view.width,height:view.height};
 if(!['x','y','width','height'].every(key=>actual[key]===bounds[key]))return false;
 if(bounds.x<0||bounds.y<0||bounds.x+bounds.width>content.width||bounds.y+bounds.height>content.height)return false;
 if(!['visible','parentVisible','cachedVisible','attached'].every(key=>state[key]===true)||native.loading!==false||native.windowVisible!==true||native.appActive!==true||native.focus?.window!==true)return false;
 if(!Number.isFinite(factor)||factor<=0||!dom?.visible||!dom.anchor?.connected||!dom.hit?.ready||native.url!==dom.url)return false;
 if(!['width','height'].every(key=>Number.isFinite(dom.viewport?.[key])&&Math.abs(dom.viewport[key]*factor-bounds[key])<=1))return false;
 if(![dom.hit.x,dom.hit.y].every(Number.isFinite)||dom.hit.x<0||dom.hit.y<0||dom.hit.x*factor>=bounds.width||dom.hit.y*factor>=bounds.height)return false;
 return !focused||(native.focus.guest===true&&native.focus.webContentsId===webContentsId&&dom.focused===true);
}
async function boundedLinkOperation(operation,ms,label){
 let timer;
 try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]);}
 finally{clearTimeout(timer);}
}
// An ordinary click is consumed in the isolated preload before document click
// listeners run. Observe only the preceding trusted pointerdown; verify() then
// proves the actual new main tab and unchanged source document independently.
async function nativeLinkInput({app,win,fixture,nativeInput,record,selector,attempts=[],save=async()=>{},readNative,now=()=>performance.now()}){
 const wc=record.page.view.webContents;
 if(!readNative){const {screen,webContents}=require('electron');readNative=()=>({...nativeGuestInputState({win,page:record.page,screen,webContents}),windowVisible:win.isVisible(),appActive:process.platform!=='darwin'||app.isActive()});}
 const receipt={selector,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',action:'intercepted-link',pid:process.pid,at:Date.now(),evidence:'Trusted pointerdown on the exact anchor before isolated click interception',tabId:record.id,webContentsId:wc.id,stage:'activation',events:[],deliveryAttempts:[]};
 attempts.push(receipt);let installed=false,error;
 const errorFacts=cause=>({message:cause?.message||String(cause),stack:cause?.stack||null});
 const snapshot=()=>{try{return structuredClone(readNative());}catch(cause){return{diagnosticError:errorFacts(cause)};}};
 const persist=async()=>{try{await boundedLinkOperation(save,2500,'641 native anchor diagnostic save timeout');}catch(cause){receipt.diagnosticSaveError=errorFacts(cause);}};
 try{
  receipt.focusReadiness=await focusNativeInputWindow({app,win,until:fixture.until});receipt.stage='preparation';
  // Native attachment, guest focus and the fresh hit share the former target
  // wait. Preparation never posts a mouse button and never retries the click.
  const startedAt=now(),deadlineAt=startedAt+10000,preparation=receipt.preparation={startedAt,deadlineAt,budgetMs:10000,samples:[],sampleCount:0,droppedSamples:0};
  const remaining=()=>{const ms=deadlineAt-now();if(ms<=0)throw Error('641 native anchor readiness deadline '+selector);return ms;};
  // Only passive IPC/waits enter this race. After timeout their eventual
  // resolution cannot resume preparation or reach the single native post.
  const prepare=operation=>boundedLinkOperation(operation,remaining(),'641 native anchor readiness deadline '+selector);
  const prepareJS=source=>prepare(()=>fixture.pageJS(record,source));
  async function sample(phase,focused){
   remaining();const dom=await prepareJS('('+linkTargetReadback.toString()+')('+JSON.stringify(selector)+','+nativeHitTarget.toString()+')');remaining();
   const native=snapshot(),factor=wc.getZoomFactor(),row={at:now(),phase,dom,native,factor,ready:linkNativeReady(native,dom,factor,wc.id,{focused})};
   preparation.sampleCount++;if(preparation.samples.length<8)preparation.samples.push(row);else{preparation.samples[7]=row;preparation.droppedSamples++;}
   preparation.latest=row;return row;
  }
  await prepare(()=>fixture.until(async()=>{const row=await sample('visible native target',false);return row.ready;},'641 attached native anchor '+selector,remaining()));remaining();
  wc.focus();preparation.focusRequestedAt=now();
  await prepareJS('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');remaining();
  installed=true;await prepareJS('('+installLinkPointerReceipt.toString()+')('+JSON.stringify(selector)+')');remaining();
  let fresh;await prepare(()=>fixture.until(async()=>{fresh=await sample('focused native target',true);return fresh.ready;},'641 focused native anchor '+selector,remaining()));remaining();
  const {dom,native,factor}=fresh,hit=dom.hit,contentBounds=native.contentBounds,pageBounds=native.native.cachedBounds,point={x:Math.round(contentBounds.x+pageBounds.x+hit.x*factor),y:Math.round(contentBounds.y+pageBounds.y+hit.y*factor)};
  Object.assign(receipt,{hit,factor,contentBounds,pageBounds,point,stage:'pointerdown'});preparation.preparedAt=now();
  receipt.events=await observeGuestClick({attempts:receipt.deliveryAttempts,details:{selector,point,tabId:record.id,webContentsId:wc.id,hit,factor,contentBounds,pageBounds},readNative,post:()=>nativeInput.testClick(point.x,point.y),
   readEvents:async()=>{const value=await fixture.pageJS(record,'__mouse641LinkPointer.read()');receipt.events=value.events;receipt.observedEvents=value.observedEvents;receipt.droppedEvents=value.dropped;return value.events;},
   accept:events=>events.some(event=>event.type==='pointerdown'&&event.trusted&&event.matches&&event.button===0),waitFor:fixture.until,label:'641 trusted native anchor pointerdown '+selector,save:persist});
  receipt.stage='complete';
 }catch(cause){error=cause;receipt.error=errorFacts(cause);receipt.failedNative={at:Date.now(),native:snapshot()};await persist();}
 finally{
  if(installed)try{await boundedLinkOperation(()=>fixture.pageJS(record,'globalThis.__mouse641LinkPointer?.dispose();delete globalThis.__mouse641LinkPointer;true'),2000,'641 native anchor observer cleanup timeout');}catch(cause){receipt.cleanupError=errorFacts(cause);error||=cause;receipt.error||=errorFacts(cause);await persist();}
 }
 if(error)throw error;return receipt;
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
module.exports={verify,readback,assertRouting,assertReturnedGrid,nativeLinkInput,installLinkPointerReceipt,linkTargetReadback,linkNativeReady,assertInterceptedChatNavigation};
