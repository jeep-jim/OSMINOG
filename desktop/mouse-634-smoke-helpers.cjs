'use strict';
const assert=require('node:assert/strict');

function ownerPage(html,index,{base,previewBase}){
 const links=`<nav id="owner-links" style="position:fixed;left:12px;top:136px;display:grid;gap:5px;background:#f3f0e8;padding:5px;z-index:5;font:12px system-ui">
 <a id="download-a" href="${base}/download/a" download>Download A</a>
 <a id="download-b" href="${base}/download/b" download>Download B</a>
 <a id="download-chat" href="${base}/download/chat" download>Download chat file</a>
 <a id="download-preview" href="${base}/download/preview" download>Download preview file</a>
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

module.exports={ownerPage,aiReadback,assertSplit};
