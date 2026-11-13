'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,browser})=>{
 const js=code=>win.webContents.executeJavaScript(code);
 for(const width of [1440,1100,900,800]){
  win.setSize(width,900);await sleep(120);
  const r=await js(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return{header:rect('.toolbar'),tabs:rect('#tabstrip'),address:rect('#address-form'),workspace:rect('#workspace'),footer:rect('#statusbar'),paneHeaders:document.querySelectorAll('.pane-head').length,slots:[...document.querySelectorAll('.pane')].map(p=>({paneY:p.getBoundingClientRect().y,pageY:p.querySelector('.page-slot').getBoundingClientRect().y})),footerControls:[...document.querySelectorAll('#statusbar button,#statusbar select')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom}})}})()`);
  assert.equal(r.header.h,46);assert.equal(r.workspace.y,46);assert.equal(r.footer.h,28);assert.equal(r.paneHeaders,0);
  assert.ok(r.tabs.y>=0&&r.tabs.bottom<=46);assert.ok(r.address.x>=80);assert.ok(r.tabs.x>=r.address.right);
  assert.ok(r.slots.every(p=>p.pageY-p.paneY<=1.5),'No permanent second toolbar row');
  assert.ok(r.footerControls.every(c=>c.x>=0&&c.right<=width&&c.y>=r.footer.y&&c.bottom<=r.footer.bottom),'Footer controls remain accessible');
 }
 win.setSize(1440,960);await sleep(100);
 const main=[...browser.tabs.values()].filter(t=>t.lane!=='side'&&t.visible);assert.ok(main.length>=2);
 const target=main[1];target.view.webContents.focus();await sleep(100);
 assert.equal(await js('document.querySelector("#address-input").value'),target.view.webContents.getURL());
 const expected=await js('QuadroTest.model.slots[QuadroTest.model.active]');assert.equal(expected,target.id);
 const tab=await js(`(()=>{const e=document.querySelector('.tab-item'),t=e.querySelector('.tab-title'),c=e.querySelector('.tab-close');return{order:c===e.firstElementChild,reserved:c.getBoundingClientRect().right<=t.getBoundingClientRect().x+1}})()`);
 assert.ok(tab.order&&tab.reserved,'Close button is reserved on the left, never overlays the title');
 console.log('QUADRO_SINGLE_ROW_SHARED_ADDRESS_FOOTER_PASS');
 for(const theme of ['light','dark']){await js(`QuadroTest.setTheme('${theme}')`);await fs.writeFile('quadro-compact-'+theme+'.png',(await win.capturePage()).toPNG())}
};
