'use strict';
const assert=require('node:assert/strict');

function ownerPage(html,index,{base,previewBase}){
 const links=`<nav id="owner-links" style="position:fixed;left:12px;top:136px;display:grid;gap:5px;background:#f3f0e8;padding:5px;z-index:5;font:12px system-ui">
 <a id="download-a" href="/download/a" download>Download A</a>
 <a id="download-b" href="/download/b" download>Download B</a>
 <a id="download-chat" href="/download/chat" download>Download chat file</a>
 <a id="download-preview" href="/download/preview" download>Download preview file</a>
 <a id="link-blank" href="${previewBase}/page/3/" target="_blank">Open source in new window</a>
 <a id="link-same" href="${previewBase}/page/4/">Open source in same window</a>
 </nav><script>globalThis.mouse634={index:${index},clicks:[],raf:0};requestAnimationFrame(function tick(){mouse634.raf++;requestAnimationFrame(tick)});document.querySelector('#owner-links').addEventListener('click',event=>{const link=event.target.closest('a');if(link)mouse634.clicks.push({id:link.id,trusted:event.isTrusted,isTrusted:event.isTrusted,at:Date.now()});});</script>`;
 return html.replace('</body>',links+'</body>');
}

// Passive renderer readback: no synthetic clicks or calls into route handlers.
function aiReadback(){
 const rect=selector=>{const node=document.querySelector(selector),r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,hidden:node.hidden};};
 const m=MouseTest.model;
 return{aiId:m.aiId,previewId:m.aiPreviewId,aiOpen:m.aiOpen,chat:rect('#ai-chat-pane'),preview:rect('#ai-preview-pane'),chatSlot:rect('#ai-slot'),previewSlot:rect('#ai-preview-slot'),column:rect('#ai-panel'),workspace:rect('#workspace'),gap:Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--workspace-gap')),tabs:m.state.tabs.map(t=>({id:t.id,lane:t.lane,previewOf:t.previewOf||'',url:t.url})),mainSlots:{...m.slots}};
}

function assertSplit(value,{chatId,previewId,mainSlots}){
 assert.equal(value.aiId,chatId);assert.equal(value.previewId,previewId);assert.equal(value.preview.hidden,false);
 assert.deepEqual(value.mainSlots,mainSlots,'Opening a source never changes the main workspace slots');
 assert.ok(Math.abs(value.chat.height-value.preview.height)<=1,'Chat and preview occupy equal halves of the right column');
 assert.equal(value.preview.y-value.chat.bottom,value.gap,'Horizontal split uses the same workspace gap');
 assert.equal(value.chat.x,value.preview.x);assert.equal(value.chat.width,value.preview.width);
 assert.equal(value.chat.x,value.column.x);assert.equal(value.preview.right,value.column.right);
 assert.ok(value.chatSlot.height>100&&value.previewSlot.height>100,'Both native pages have visible content');
 assert.equal(value.tabs.find(t=>t.id===previewId).previewOf,chatId);
 assert.equal(value.tabs.find(t=>t.id===previewId).lane,'side');
}

// Electron emits did-start-navigation before the cancellable will-navigate.
// Observe the real event objects after the production listener has run; never
// alter the navigation epoch or cancel a navigation from the acceptance probe.
function observeChatNavigation(page,targetURL){
 const wc=page.view.webContents,events=[],listeners=[];
 const witness={source:'WebContents navigation events for one native same-window link click',tabId:page.id,webContentsId:wc.id,targetURL,events};
 const add=(type,url,mainFrame,sameDocument,extra={})=>events.push({type,url,mainFrame,sameDocument,navigationEpoch:page.navigationEpoch||0,at:Date.now(),...extra});
 const on=(type,listener)=>{wc.on(type,listener);listeners.push([type,listener]);};
 for(const type of ['did-start-navigation','will-navigate'])on(type,(event,url,inPlace,mainFrame)=>add(type,event.url??url,event.isMainFrame??mainFrame,event.isSameDocument??inPlace,type==='will-navigate'?{prevented:event.defaultPrevented===true}:{}));
 on('did-frame-navigate',(_event,url,_code,_status,mainFrame)=>add('did-frame-navigate',url,mainFrame,false));
 on('did-navigate',(_event,url)=>add('did-navigate',url,true,false));
 on('did-navigate-in-page',(_event,url,mainFrame)=>add('did-navigate-in-page',url,mainFrame,true));
 on('did-finish-load',()=>add('did-finish-load',wc.getURL(),true,false));
 return{witness,dispose(){for(const[type,listener]of listeners)wc.removeListener(type,listener);listeners.length=0;}};
}

function assertCanceledChatNavigation(before,after,witness,assertIdentity){
 assert.equal(witness.tabId,before.id);assert.equal(witness.webContentsId,before.webContentsId);
 assert.deepEqual(witness.events.map(event=>event.type),['did-start-navigation','will-navigate'],'Only one attempted navigation and its cancellation occur; no commit or finish-load');
 assert.ok(Number.isSafeInteger(before.navigationEpoch)&&before.navigationEpoch>=0);
 const canceledStarts=witness.events.filter(event=>event.type==='did-start-navigation').length,expectedEpoch=before.navigationEpoch+canceledStarts;
 for(const event of witness.events){assert.equal(event.url,witness.targetURL);assert.equal(event.mainFrame,true);assert.equal(event.sameDocument,false);assert.equal(event.navigationEpoch,expectedEpoch);assert.ok(Number.isSafeInteger(event.at)&&event.at>0);}
 assert.equal(witness.events[1].prevented,true,'The production navigation handler actually prevented this attempt');
 assert.ok(witness.events[1].at>=witness.events[0].at);
 assert.equal(after.navigationEpoch,expectedEpoch,'Only the observed canceled attempt advances the security epoch');
 // Keep the common identity predicate intact, including URL, document token,
 // time origin, WebContents, input, scroll, cookies and the live frame counter.
 assertIdentity({...before,navigationEpoch:expectedEpoch},after);
}

module.exports={ownerPage,aiReadback,assertSplit,observeChatNavigation,assertCanceledChatNavigation};
