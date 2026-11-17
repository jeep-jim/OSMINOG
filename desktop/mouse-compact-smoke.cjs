'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win,browser})=>{
 const js=code=>win.webContents.executeJavaScript(code);
 for(const width of [1440,1100,900,800]){
  win.setSize(width,900);await sleep(150);
  const r=await js(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return{header:rect('.toolbar'),tabs:rect('#tabstrip'),workspace:rect('#workspace'),footer:rect('#statusbar'),dots:[...document.querySelectorAll('.traffic-space button')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}),slots:[...document.querySelectorAll('.pane')].map(p=>({paneY:p.getBoundingClientRect().y,pageY:p.querySelector('.page-slot').getBoundingClientRect().y,headerH:p.querySelector('.pane-head').getBoundingClientRect().height,shadow:getComputedStyle(p).boxShadow})),footerControls:[...document.querySelectorAll('#statusbar button,#statusbar select')].map(e=>{const r=e.getBoundingClientRect();return{id:e.id,x:r.x,right:r.right,y:r.y,bottom:r.bottom,w:r.width,h:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button,select')===e}})}})()`);
  assert.equal(r.header.h,40);assert.equal(r.workspace.y,40);assert.equal(r.footer.h,28);assert.equal(r.dots.length,3);const right=await js("document.querySelector('#footer-right').getBoundingClientRect().right");assert.ok(Math.abs(right-width)<=10,'Right controls anchored at right edge');assert.ok(r.dots.every(x=>x.w===13&&x.h===13&&x.y>=0));
  assert.ok(r.tabs.x>=80);assert.ok(r.slots.every(p=>p.headerH===28&&p.pageY-p.paneY===28&&p.shadow==='none'));
  // Owner's Figma reference: compact 23px burrow inside the unchanged 28px footer.
  // Its top stays 5px below the panel edge; bottom and horizontal center stay aligned.
  const burrows=r.footerControls.filter(c=>c.id==='desktops-button');assert.equal(burrows.length,1);
  const b=burrows[0];assert.equal(b.w,36);assert.equal(b.h,23);assert.ok(Math.abs((b.x+b.right)/2-width/2)<.51,'Desktop burrow centered');
  assert.ok(Math.abs(b.y-r.footer.y-5)<.05,'Burrow leaves five-pixel top clearance');assert.ok(Math.abs(b.bottom-r.footer.bottom)<.05,'Burrow sits on footer baseline');assert.equal(b.hit,true,'Desktop entrance receives its own click');
  const controls=r.footerControls.filter(c=>c.id!=='desktops-button');
  assert.ok(controls.every(c=>c.x>=0&&c.right<=width&&c.y>=r.footer.y&&c.bottom<=r.footer.bottom),'Unified footer remains accessible: '+JSON.stringify({width,footer:r.footer,controls}));
  assert.ok(controls.filter(c=>c.w>0&&c.h>0).every(c=>c.right<=b.x||c.x>=b.right),'Desktop burrow does not cover existing footer controls');
 }
 win.setSize(1440,960);await sleep(100);
 const main=[...browser.tabs.values()].filter(t=>t.lane!=='side'&&t.visible);assert.ok(main.length>=2);
 main[1].view.webContents.focus();await sleep(100);
 assert.equal(await js('document.querySelector(".pane.active .pane-address input").value'),main[1].view.webContents.getURL());
 const t=await js(`(()=>{const e=document.querySelector('.tab-item'),title=e.querySelector('.tab-title'),c=e.querySelector('.tab-close');return{reserved:c.getBoundingClientRect().right<=title.getBoundingClientRect().x}})()`);assert.ok(t.reserved);
 console.log('MOUSE_PER_PANE_BARS_GLASS_DOTS_FOOTER_PASS');
 for(const theme of ['light','dark']){await js(`MouseTest.setTheme('${theme}')`);await fs.writeFile('mouse-compact-'+theme+'.png',(await win.capturePage()).toPNG())}
};
