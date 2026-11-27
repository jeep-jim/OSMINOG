'use strict';
// Owned cross-origin sites exercise the real lower AI pane. All resize/move
// commands originate in native input, retaining the same live native pages.
const assert=require('node:assert/strict'),http=require('node:http');
const {pageHTML,sleep}=require('./mouse-631-smoke-helpers.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {inputProbe}=require('./mouse-636-search-removal-smoke.cjs');
const {verify:verifyLinkRouting,nativeLinkInput}=require('./mouse-641-ai-link-routing.cjs');

function ownedPage(index,previewBase){
 return pageHTML(index).replace('</head>','<link rel="icon" href="/icon.png"></head>').replace('</body>',
  `<style>#ai-preview-witness{position:fixed;left:18px;top:84px;width:72px;height:32px;background:rgb(37,143,191);z-index:20}#ai-preview-link{position:fixed;left:18px;top:150px;background:#fff;padding:5px;z-index:21}</style><div id="ai-preview-witness"></div>`+
  (previewBase?`<a id="ai-preview-link" href="${previewBase}/page/3/" target="_blank">Open owned source</a>`:'')+'</body>');
}
function readback(){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},m=MouseTest.model;
 const input=document.querySelector('#ai-preview-address-input'),icon=document.querySelector('#ai-preview-icon'),image=icon.matches('img')?icon:icon.querySelector('img');
 return{theme:m.theme,mode:m.appearance.paneMode,ratio:m.aiPreviewRatio,aiId:m.aiId,previewId:m.aiPreviewId,focusAI:m.focusAI,
  column:rect(document.querySelector('#ai-panel')),chat:rect(document.querySelector('#ai-chat-pane')),preview:rect(document.querySelector('#ai-preview-pane')),
  chatSlot:rect(document.querySelector('#ai-slot')),previewSlot:rect(document.querySelector('#ai-preview-slot')),divider:rect(document.querySelector('#ai-preview-divider')),
  gap:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--workspace-gap')),slots:{...m.slots},
  address:{value:input.value,readOnly:input.readOnly,disabled:input.disabled},icon:{url:image?.src||'',complete:image?.complete===true,width:image?.naturalWidth||0,height:image?.naturalHeight||0},
  tabs:m.state.tabs.map(t=>({id:t.id,lane:t.lane,previewOf:t.previewOf||'',url:t.url,favicon:t.favicon||''})),dividerValue:Number(document.querySelector('#ai-preview-divider').getAttribute('aria-valuenow'))};
}
function assertGeometry(value,chatId,previewId){
 const near=(a,b,what)=>assert.ok(Math.abs(a-b)<1.1,what+': '+a+' / '+b),gap=value.mode==='square'?1:6;
 assert.equal(value.aiId,chatId);assert.equal(value.previewId,previewId);assert.equal(value.gap,gap);
 assert.ok(Number.isFinite(value.ratio)&&value.ratio>0&&value.ratio<1);assert.equal(value.dividerValue,Math.round(value.ratio*100));
 near(value.preview.y,value.chat.y+value.chat.height+gap,'AI pages share the exact chosen gap');
 near(value.divider.height,gap,'AI divider occupies the gap only');near(value.divider.y,value.chat.y+value.chat.height,'AI divider follows the chat');
 near(value.chat.x,value.preview.x,'AI pages align horizontally');near(value.chat.width,value.preview.width,'AI pages have equal width');
 near(value.chat.y,value.column.y,'Chat starts at the column edge');near(value.preview.y+value.preview.height,value.column.y+value.column.height,'Preview fills the lower column');
 near(value.chat.height,(value.column.height-gap)*value.ratio,'Actual height follows the stored ratio');
 assert.ok(value.chatSlot.height>112&&value.previewSlot.height>112,'Both native owned content regions remain visible');
 const preview=value.tabs.find(t=>t.id===previewId);assert.equal(preview.lane,'side');assert.equal(preview.previewOf,chatId);
 assert.equal(value.address.value,preview.url);assert.equal(value.address.readOnly,false);assert.equal(value.address.disabled,false);
}
function assertNativeGeometry(value,states,owners){
 assert.equal(states.length,2);assert.equal(owners.length,2);
 for(let i=0;i<2;i++){
  const actual=states[i],owner=owners[i],slot=i===0?value.chatSlot:value.previewSlot;
  assert.equal(actual.tabId,owner.id);assert.equal(actual.webContentsId,owner.webContentsId);assert.equal(actual.index,owner.index);assert.equal(actual.desk,owner.desk);
  assert.ok(Number.isSafeInteger(actual.webContentsId)&&actual.webContentsId>0);
  for(const key of ['visible','parentVisible','cachedVisible','attached'])assert.equal(actual[key],true);
  const expected={x:Math.round(slot.x),y:Math.round(slot.y),width:Math.round(slot.x+slot.width)-Math.round(slot.x),height:Math.round(slot.y+slot.height)-Math.round(slot.y)};
  assert.deepEqual(actual.bounds,expected);assert.deepEqual(actual.actualBounds,expected);assert.equal(actual.roundBottom,value.mode==='square'?0:12);
 }
}
function assertAddressSubmission(value,chatId,previewId,platform){
 const owner=value.beforeInput;
 assert.equal(owner.aiId,chatId);assert.equal(owner.previewId,previewId);assert.equal(owner.url,value.from);assert.equal(owner.value,value.to);
 assert.equal(owner.focused,true);assert.equal(owner.formId,'ai-preview-address');assert.equal(owner.hasSubmitHandler,true);assert.equal(owner.readOnly,false);assert.equal(owner.disabled,false);
 const key=value.nativeKey;assert.equal(key.method,'nativeInput.testKey');assert.equal(key.key,platform==='linux'?'Return':'ENTER');assert.equal(key.source,platform==='darwin'?'CGEvent':platform==='win32'?'User32':'XTest');assert.equal(key.accepted,true);assert.ok(Number.isSafeInteger(key.pid)&&key.pid>0);assert.ok(Number.isFinite(key.at)&&key.at>0);
 const events=value.keyboard;assert.ok(Array.isArray(events)&&events.length>0&&events.length<=20);
 const down=events.findIndex(e=>e.type==='keydown'&&e.key==='Enter'&&e.isTrusted&&e.value===value.to),press=events.findIndex(e=>e.type==='keypress'&&e.key==='Enter'&&e.isTrusted&&e.value===value.to),submit=events.findIndex(e=>e.type==='submit'&&e.isTrusted&&e.value===value.to);
 assert.ok(down>=0&&press>down&&submit>press,'The actual native Enter sequence submits the focused preview form');assert.equal(events.filter(e=>e.type==='submit').length,1,'Exactly one real form submission');
}
function traceFaviconNavigation(page){
 const wc=page.view.webContents,events=[];
 const record=(type,details)=>events.push({type,at:Date.now(),webContentsId:wc.id,url:wc.getURL(),favicon:page.favicon||'',navigationEpoch:page.navigationEpoch||0,...details});
 const listeners={
  'did-start-navigation':(_event,url,isSameDocument,isMainFrame)=>record('did-start-navigation',{targetURL:url,isSameDocument,isMainFrame}),
  'did-navigate':(_event,url)=>record('did-navigate',{targetURL:url}),
  'page-favicon-updated':(_event,icons)=>record('page-favicon-updated',{icons:Array.isArray(icons)?icons.slice():[]})
 };
 for(const [event,listener]of Object.entries(listeners))wc.on(event,listener);
 return{events,dispose(){for(const [event,listener]of Object.entries(listeners))wc.removeListener(event,listener);}};
}

module.exports=async function verifyAIPreview({app,win,browser,fixture,nativeInput,click,text,capture,theme,openAppearance,closeAppearance,facts,records,save}){
 const report={schema:1,source:'Native cross-origin link routing, explicit existing-preview fixture, native resize and native chooser/header transfers',samples:[],ok:false};facts.aiPreview=report;
 const servers=[];let previewBase,chatBase;
 const bitmap=Buffer.alloc(16*16*4);for(let i=0;i<bitmap.length;i+=4){bitmap[i]=191;bitmap[i+1]=143;bitmap[i+2]=37;bitmap[i+3]=255;}
 const icon=require('electron').nativeImage.createFromBitmap(bitmap,{width:16,height:16}).toPNG();
 async function start(isChat){
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
   if(url.pathname==='/icon.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(icon);return;}
   const match=url.pathname.match(/^\/page\/(\d+)\/$/);if(match){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(ownedPage(Number(match[1]),isChat?previewBase:null));return;}
   res.writeHead(404);res.end();});servers.push(server);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});return'http://127.0.0.1:'+server.address().port;
 }
 const state=()=>fixture.js(`(${readback.toString()})()`);
 const native=record=>{
  assert.equal(browser.tabs.get(record.id),record.page,'Native proof keeps the original registry page');const state=fixture.nativeState(record);
  for(const key of ['visible','parentVisible','cachedVisible','attached'])assert.equal(state[key],true,'Actual preview owner is '+key);
  return{...state,roundBottom:record.page.captureGeometry?.roundBottom};
 };
 const witness=record=>{const p=native(record);return{name:'owned native guest',tabId:record.id,webContentsId:p.webContentsId,point:{x:p.bounds.x+54,y:p.bounds.y+100},expectedRGB:[37,143,191]};};
 async function setMode(mode){await openAppearance();if(await fixture.js('MouseTest.model.appearance.paneMode')!==mode)await click('#settings-square-grid');await closeAppearance();await fixture.frame();}
 async function drag(selector,to){
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();await fixture.until(()=>win.isFocused(),'AI preview native focus');
  const hit=await fixture.js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}),{})`);assert.equal(hit.ready,true);
  const origin=win.getContentBounds(),from={x:Math.round(origin.x+hit.x),y:Math.round(origin.y+hit.y)},end=typeof to==='number'?{x:from.x,y:from.y+to}:{x:Math.round(origin.x+to.x),y:Math.round(origin.y+to.y)};
  await fixture.js(`(()=>{const target=document.querySelector(${JSON.stringify(selector)}),events=[],listener=e=>events.push({type:e.type,trusted:e.isTrusted,matches:e.target===target||target.contains(e.target),at:Date.now()});for(const type of ['pointerdown','pointerup'])document.addEventListener(type,listener,true);globalThis.__mouse637PreviewDrag={events,dispose(){for(const type of ['pointerdown','pointerup'])document.removeEventListener(type,listener,true)}};})()`);
  const input={selector,action:'drag',pid:process.pid,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',from,to:end,events:[]};facts.nativeInputs.push(input);let failure;
  try{
   try{assert.equal(await nativeInput.testMouse(from.x,from.y,0),true);for(let i=1;i<=12;i++){assert.equal(await nativeInput.testMouse(Math.round(from.x+(end.x-from.x)*i/12),Math.round(from.y+(end.y-from.y)*i/12),1),true);await sleep(20);}}
   finally{assert.equal(await nativeInput.testMouse(end.x,end.y,2),true);}
   await fixture.frame();
   // Frames do not acknowledge OS input delivery. Observe the same trusted
   // predicates within fixture.until's existing global deadline before disposal.
   await fixture.until(async()=>{input.events=await fixture.js('__mouse637PreviewDrag.events');return input.events.some(e=>e.type==='pointerdown'&&e.trusted&&e.matches)&&input.events.some(e=>e.type==='pointerup'&&e.trusted);},'AI preview trusted pointer down and up');
   const events=input.events;assert.ok(events.some(e=>e.type==='pointerdown'&&e.trusted&&e.matches));assert.ok(events.some(e=>e.type==='pointerup'&&e.trusted));
  }catch(cause){failure=cause;input.error={message:cause.message};}
  finally{
   try{input.events=await fixture.js('__mouse637PreviewDrag.events');}catch(cause){input.readbackError=cause.message;failure||=cause;}
   try{await fixture.js('__mouse637PreviewDrag.dispose();delete globalThis.__mouse637PreviewDrag');}catch(cause){input.cleanupError=cause.message;failure||=cause;}
   if(failure)input.error||={message:failure.message};
  }
  if(failure)throw failure;return input;
 }
 async function openPreview(chat,index=3){
  const input={source:'Explicit fixture setup for existing lower-pane resize and transfer controls; not a native-link outcome',action:'browser.command(open)',url:previewBase+'/page/'+index+'/',lane:'side',previewOf:chat.id};
  const opened=await browser.command('open',{url:input.url,lane:'side',previewOf:chat.id});input.id=opened.id;const page=browser.get(opened.id);
  await fixture.until(()=>!page.loading&&!page.error&&page.view.webContents.getURL()===input.url,'explicit existing lower preview fixture loads');
  const record={id:page.id,index,desk:fixture.bank.active,page};fixture.created.push(record);await fixture.preparePage(record);
  await fixture.until(()=>fixture.js(`MouseTest.model.aiPreviewId===${JSON.stringify(record.id)}`),'preview renderer owner');await fixture.frame();
  return{record,input};
 }
 async function placed(record,pane){
  await fixture.until(async()=>{
   const bounds=await fixture.js(`(()=>{const r=document.querySelector('.pane[data-pane="${pane}"] .page-slot').getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.right)-Math.round(r.x),height:Math.round(r.bottom)-Math.round(r.y)}})()`),page=record.page;
   return page.visible&&page.bounds&&Object.keys(bounds).every(key=>page.bounds[key]===bounds[key]);
  },'detached preview reaches its actual ordinary native pane');await fixture.frame();
 }
 async function awaitFavicon(record,diagnostic){
  let lastState=null;
  try{await fixture.until(async()=>{const s=lastState=await state();return s.tabs.find(t=>t.id===record.id)?.favicon===previewBase+'/icon.png'&&s.icon.url.startsWith('data:image/png;base64,')&&s.icon.complete&&s.icon.width===20&&s.icon.height===20},'actual preview favicon loaded');}
  catch(cause){
   if(diagnostic){
    diagnostic.faviconFailure={at:Date.now(),lastState};
    try{const page=record.page,wc=page.view.webContents;diagnostic.faviconFailure.native={id:page.id,webContentsId:wc.id,url:wc.getURL(),favicon:page.favicon||'',navigationEpoch:page.navigationEpoch||0};}
    catch(error){diagnostic.faviconFailure.nativeError=String(error.message);}
   }
   throw cause;
  }
 }
 try{
  previewBase=(await start(false)).replace('127.0.0.1','localhost');chatBase=await start(true);report.origins={chat:chatBase,preview:previewBase};
  const opened=await browser.command('open',{url:chatBase+'/page/2/',lane:'side'}),chat={id:opened.id,index:2,desk:fixture.bank.active,page:browser.get(opened.id)};fixture.created.push(chat);await fixture.preparePage(chat);
  await fixture.js(`Object.assign(MouseTest.model,{aiOpen:true,libraryOpen:false,aiId:${JSON.stringify(chat.id)},aiWidth:400,aiPreviewRatio:.5});MouseTest.renderAISites();MouseTest.applySide();MouseTest.requestLayout();MouseTest.save()`);
  await fixture.until(()=>chat.page.visible&&chat.page.bounds?.height>180,'owned AI chat displayed');report.chatBefore=await fixture.identity(chat);
  report.linkInputAttempts=[];
  const linked=await verifyLinkRouting({browser,fixture,chat,url:previewBase+'/page/3/',index:3,selector:'#ai-preview-link',input:()=>nativeLinkInput({app,win,fixture,nativeInput,record:chat,selector:'#ai-preview-link',attempts:report.linkInputAttempts,save}),returnInput:()=>click('#return-to-grid')});facts.nativeInputs.push(linked.receipt.input);report.linkRouting=[linked.receipt];report.nativeLinkClick=linked.receipt.input.events.find(event=>event.type==='pointerdown');assert.equal(report.nativeLinkClick.trusted,true);
  const first=await openPreview(chat),preview=first.record;report.open={input:first.input,source:'Explicit existing-preview fixture after the independently verified native classic-tab link'};
  await awaitFavicon(preview);
  report.initial=await state();assertGeometry(report.initial,chat.id,preview.id);assert.equal(report.initial.ratio,.5);
  const loadedIcon=require('electron').nativeImage.createFromDataURL(report.initial.icon.url),iconBytes=loadedIcon.toBitmap({scaleFactor:1});assert.deepEqual(loadedIcon.getSize(1),{width:20,height:20});assert.equal(iconBytes.length,1600);
  for(let i=0;i<iconBytes.length;i+=4)assert.deepEqual([...iconBytes.subarray(i,i+4)],[191,143,37,255],'Displayed favicon contains the owned source pixels');
  report.favicon={source:preview.page.favicon,pngDataURL:report.initial.icon.url,pixelSize:{width:20,height:20},expectedRGBA:[37,143,191,255]};
  const oldId=preview.id,oldContents=preview.page.view.webContents.id,navigation=report.navigation={id:preview.id,webContentsId:oldContents,from:previewBase+'/page/3/',to:previewBase+'/page/4/',beforeNative:native(preview)};
  await text('#ai-preview-address-input',navigation.to);
  navigation.beforeInput=await fixture.js(`(()=>{const input=document.querySelector('#ai-preview-address-input'),m=MouseTest.model;return{aiId:m.aiId,previewId:m.aiPreviewId,url:m.state.tabs.find(t=>t.id===m.aiPreviewId)?.url,value:input.value,focused:document.activeElement===input,formId:input.form?.id,hasSubmitHandler:typeof input.form?.onsubmit==='function',readOnly:input.readOnly,disabled:input.disabled}})()`);
  assert.equal(navigation.beforeInput.focused,true);assert.equal(navigation.beforeInput.previewId,preview.id);assert.equal(navigation.beforeInput.value,navigation.to);
  // Raw Electron keyDown/keyUp omits the Return character used by implicit
  // form submission. Use the same real OS key path as retained636 navigation.
  await fixture.js(`(${inputProbe.toString()})('#ai-preview-address-input')`);
  const faviconTrace=traceFaviconNavigation(preview.page);navigation.faviconEvents=faviconTrace.events;
  try{
   try{
    const key=process.platform==='linux'?'Return':'ENTER';navigation.nativeKey={method:'nativeInput.testKey',key,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',pid:process.pid,at:Date.now(),accepted:await nativeInput.testKey(key)};assert.equal(navigation.nativeKey.accepted,true);
    await fixture.until(()=>!preview.page.loading&&preview.page.view.webContents.getURL()===navigation.to,'preview address navigates its own native page');
   }finally{navigation.keyboard=await fixture.js('globalThis.__mouse636OrdinaryInput.events');await fixture.js('globalThis.__mouse636OrdinaryInput.dispose();delete globalThis.__mouse636OrdinaryInput;true');}
   assertAddressSubmission(navigation,chat.id,preview.id,process.platform);preview.index=4;await fixture.preparePage(preview);await awaitFavicon(preview,navigation);
  }finally{faviconTrace.dispose();}
  Object.assign(navigation,{afterNative:native(preview),state:await state()});assert.equal(preview.id,oldId);assert.equal(preview.page.view.webContents.id,oldContents);assertGeometry(navigation.state,chat.id,preview.id);
  let sequence=0;
  for(const mode of ['rounded','square'])for(const color of ['light','dark']){
   await setMode(mode);await theme(color);await fixture.frame();const before=await state(),beforeNative=[native(chat),native(preview)],identityBefore=await fixture.identity(preview);assertGeometry(before,chat.id,preview.id);assertNativeGeometry(before,beforeNative,[report.chatBefore,identityBefore]);
   const dy=[-40,40,-40,-24][sequence++],selector='#ai-preview-divider'+(mode==='square'?' > .divider-hit':''),input=await drag(selector,dy);
   await fixture.until(()=>Math.abs(preview.page.bounds.height-beforeNative[1].bounds.height)>=16,'actual lower native page height changes');
   const after=await state(),afterNative=[native(chat),native(preview)],identityAfter=await fixture.identity(preview);assertGeometry(after,chat.id,preview.id);fixture.assertIdentity(identityBefore,identityAfter);assertNativeGeometry(after,afterNative,[report.chatBefore,identityAfter]);
   assert.ok(Math.abs(after.preview.height-before.preview.height)>=16);assert.ok((after.preview.height-before.preview.height)*dy<0,'Dragging the boundary changes the lower height in the expected direction');
   assert.equal(afterNative[0].roundBottom,mode==='square'?0:12);assert.equal(afterNative[1].roundBottom,mode==='square'?0:12);
   report.samples.push({mode,theme:color,dy,before,after,beforeNative,afterNative,identityBefore,identityAfter,input});
   await capture('mouse-637-ai-preview-'+mode+'-'+color+'.png',[witness(chat),witness(preview)]);
  }
  await fixture.js('MouseFlush()');await fixture.store.queue;const savedRatio=fixture.bank.current().layout.aiPreviewRatio,desk=fixture.bank.active,other=fixture.bank.items.find(d=>d.id!==desk).id;
  assert.ok(Math.abs(savedRatio-.5)>.02);await fixture.switchDesk(other);await fixture.switchDesk(desk);const restored=await state();assert.equal(restored.ratio,savedRatio);assertGeometry(restored,chat.id,preview.id);
  report.persistence={desk,other,savedRatio,restored};
  const before=await fixture.identity(preview),displacedBefore=await fixture.identity(records[1]),beforeNative=native(preview);
  await click('[data-action=ai-fullscreen]');await fixture.until(()=>fixture.js('MouseTest.model.focusAI===true'),'AI fullscreen before moving its lower source');const fullscreen=await state();
  await click('#ai-preview-target');await fixture.until(()=>fixture.js('document.querySelector("#choice-dialog").open'),'preview move target chooser');await click('#choice-dialog button[data-value="p2"]');
  await fixture.until(()=>preview.page.lane==='main'&&!preview.page.previewOf&&preview.page.visible,'same native page becomes an ordinary pane');
  await fixture.until(()=>fixture.js(`MouseTest.model.slots.p2===${JSON.stringify(preview.id)}&&!MouseTest.model.focusAI&&!MouseTest.model.aiPreviewId`),'preview is placed in the selected main pane');
  await placed(preview,'p2');
  const after=await fixture.identity(preview),afterNative=native(preview),displacedAfter=await fixture.identity(records[1]);fixture.assertIdentity(before,after);fixture.assertIdentity(displacedBefore,displacedAfter);
  report.chooserMove={target:'p2',before,after,beforeNative,afterNative,fullscreen,displacedBefore,displacedAfter,lane:preview.page.lane,previewOf:preview.page.previewOf||'',state:await fixture.js('({slots:{...MouseTest.model.slots},previewId:MouseTest.model.aiPreviewId,focusAI:MouseTest.model.focusAI})'),captureNative:[native(preview)]};
  await capture('mouse-637-ai-preview-moved.png',[witness(preview)]);
  const second=await openPreview(chat),dragged=second.record,dragBefore=await fixture.identity(dragged),ordinaryBefore=await fixture.identity(records[0]);
  const target=await fixture.js('(()=>{const r=document.querySelector(".pane[data-pane=p1] .pane-head").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const input=await drag('#ai-preview-icon',target);await fixture.until(()=>dragged.page.lane==='main'&&!dragged.page.previewOf&&dragged.page.visible,'native preview header drag detaches its original page');
  await fixture.until(()=>fixture.js(`MouseTest.model.slots.p1===${JSON.stringify(dragged.id)}&&!MouseTest.model.aiPreviewId`),'preview header lands in the other ordinary pane');
  await placed(dragged,'p1');
  const dragAfter=await fixture.identity(dragged),ordinaryAfter=await fixture.identity(records[0]);fixture.assertIdentity(dragBefore,dragAfter);fixture.assertIdentity(ordinaryBefore,ordinaryAfter);
  report.headerMove={target:'p1',open:second.input,input,before:dragBefore,after:dragAfter,afterNative:native(dragged),displacedBefore:ordinaryBefore,displacedAfter:ordinaryAfter,lane:dragged.page.lane,previewOf:dragged.page.previewOf||'',state:await fixture.js('({slots:{...MouseTest.model.slots},previewId:MouseTest.model.aiPreviewId,focusAI:MouseTest.model.focusAI})'),captureNative:[native(dragged),native(preview)]};
  await capture('mouse-637-ai-preview-dragged.png',[witness(dragged),witness(preview)]);
  report.chatAfter=await fixture.identity(chat);fixture.assertIdentity(report.chatBefore,report.chatAfter);
  await click('[data-action=close-ai]');await fixture.until(()=>!browser.tabs.has(chat.id),'close the original AI chat');
  assert.equal(browser.tabs.get(preview.id),preview.page);assert.equal(browser.tabs.get(dragged.id),dragged.page);
  const retained=[await fixture.identity(preview),await fixture.identity(dragged)];fixture.assertIdentity(after,retained[0]);fixture.assertIdentity(dragAfter,retained[1]);
  await fixture.frame();report.parentClosed={id:chat.id,closed:true,retained,retainedNative:[native(preview),native(dragged)]};report.ok=true;
 }finally{
  for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  // On failure the enclosing feature suite closes its dialogs and restores its
  // owned desktop bank. A second settings error must not replace the cause.
  if(report.ok){await setMode('rounded');await fixture.setLayout(records);}
 }
 return report;
};
module.exports.fixtures={ownedPage,readback,assertGeometry,assertNativeGeometry,assertAddressSubmission,traceFaviconNavigation};
