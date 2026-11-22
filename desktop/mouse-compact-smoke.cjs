'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function currentFooterControls(rows){
 const compatibility=rows.filter(row=>row.id==='layout-select');assert.equal(compatibility.length,1,'Canonical compatibility layout value remains present');
 const legacy=compatibility[0];assert.equal(legacy.hidden,true,'Only the intentionally hidden compatibility select is excluded');assert.equal(legacy.w,0);assert.equal(legacy.h,0);assert.equal(legacy.hit,false);
 // The player is intentionally not part of the footer controls until opened.
 const dormantMedia=rows.filter(row=>row.inHiddenMedia);assert.equal(dormantMedia.length,3,'Three owned media-widget controls stay in the hidden player');
 assert.ok(dormantMedia.every(row=>row.w===0&&row.h===0&&row.hit===false),'The hidden media widget cannot steal footer clicks');
 const controls=rows.filter(row=>!(row.id==='layout-select'&&row.hidden===true)&&!row.inHiddenMedia),layout=controls.filter(row=>row.id==='layout-menu-button');
 assert.equal(layout.length,1,'The actual native layout-menu control remains present');assert.ok(layout[0].w>0&&layout[0].h>0,'The actual layout control is visible');assert.equal(layout[0].hit,true,'The actual layout control receives its own click');
 return controls;
}
module.exports=async({win,browser})=>{
 const js=code=>win.webContents.executeJavaScript(code),footerCases=[];
 for(const width of [1440,1100,900,800]){
  win.setSize(width,900);await sleep(150);
  const r=await js(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return{theme:document.documentElement.dataset.theme,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},spacing:{libraryGap:getComputedStyle(document.querySelector('#footer-library')).gap,libraryMarginRight:getComputedStyle(document.querySelector('#footer-library')).marginRight,rightGap:getComputedStyle(document.querySelector('#footer-right')).gap,settingsMarginLeft:getComputedStyle(document.querySelector('#settings-button')).marginLeft},header:rect('.toolbar'),tabs:rect('#tabstrip'),workspace:rect('#workspace'),footer:rect('#statusbar'),dots:[...document.querySelectorAll('.traffic-space button')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}),slots:[...document.querySelectorAll('.pane')].map(p=>({paneY:p.getBoundingClientRect().y,pageY:p.querySelector('.page-slot').getBoundingClientRect().y,headerH:p.querySelector('.pane-head').getBoundingClientRect().height,shadow:getComputedStyle(p).boxShadow})),footerControls:[...document.querySelectorAll('#statusbar button,#statusbar select')].map(e=>{const r=e.getBoundingClientRect();return{id:e.id,hidden:e.hidden,inHiddenMedia:!!e.closest('#mouse-media-widget[hidden]'),x:r.x,right:r.right,y:r.y,bottom:r.bottom,w:r.width,h:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button,select')===e}})}})()`);
  const footerControls=currentFooterControls(r.footerControls),burrows=footerControls.filter(c=>c.id==='desktops-button'),b=burrows[0],controls=footerControls.filter(c=>c.id!=='desktops-button'),overlaps=b?controls.filter(c=>c.w>0&&c.h>0&&c.right>b.x&&c.x<b.right):[];
  const evidence={width,windowBounds:win.getBounds(),contentBounds:win.getContentBounds(),...r,burrow:b||null,overlaps};footerCases.push(evidence);
  await fs.writeFile('mouse-634-compact-footer.json',JSON.stringify({schema:1,platform:process.platform,source:'Installed renderer bounds; diagnostic capturePage only',cases:footerCases},null,2)+'\n');
  if(overlaps.length)await fs.writeFile('mouse-634-compact-footer-failure.png',(await win.capturePage()).toPNG());
  assert.equal(r.header.h,40);assert.equal(r.workspace.y,40);assert.equal(r.footer.h,28);assert.equal(r.dots.length,3);const right=await js("document.querySelector('#footer-right').getBoundingClientRect().right");assert.ok(Math.abs(right-width)<=10,'Right controls anchored at right edge');assert.ok(r.dots.every(x=>x.w===13&&x.h===13&&x.y>=0));
  assert.ok(r.tabs.x>=80);assert.ok(r.slots.every(p=>p.headerH===28&&p.pageY-p.paneY===28&&p.shadow==='none'));
  // Owner's Figma reference: compact 23px burrow inside the unchanged 28px footer.
  // Its top stays 5px below the panel edge; bottom and horizontal center stay aligned.
  assert.equal(burrows.length,1);
  assert.equal(b.w,36);assert.equal(b.h,23);assert.ok(Math.abs((b.x+b.right)/2-width/2)<.51,'Desktop burrow centered');
  assert.ok(Math.abs(b.y-r.footer.y-5)<.05,'Burrow leaves five-pixel top clearance');assert.ok(Math.abs(b.bottom-r.footer.bottom)<.05,'Burrow sits on footer baseline');assert.equal(b.hit,true,'Desktop entrance receives its own click');
  assert.ok(controls.every(c=>c.x>=0&&c.right<=width&&c.y>=r.footer.y&&c.bottom<=r.footer.bottom),'Unified footer remains accessible: '+JSON.stringify({width,footer:r.footer,controls}));
  assert.ok(controls.filter(c=>c.w>0&&c.h>0).every(c=>c.right<=b.x||c.x>=b.right),'Desktop burrow does not cover existing footer controls: '+JSON.stringify(evidence));
 }
 win.setSize(1440,960);await sleep(100);
 const main=[...browser.tabs.values()].filter(t=>t.lane!=='side'&&t.visible);assert.ok(main.length>=2);
 main[1].view.webContents.focus();await sleep(100);
 assert.equal(await js('document.querySelector(".pane.active .pane-address input").value'),main[1].view.webContents.getURL());
 const t=await js(`(()=>{const e=document.querySelector('.tab-item'),title=e.querySelector('.tab-title'),c=e.querySelector('.tab-close');return{reserved:c.getBoundingClientRect().right<=title.getBoundingClientRect().x}})()`);assert.ok(t.reserved);
 console.log('MOUSE_PER_PANE_BARS_GLASS_DOTS_FOOTER_PASS');
 for(const theme of ['light','dark']){await js(`MouseTest.setTheme('${theme}')`);await fs.writeFile('mouse-compact-'+theme+'.png',(await win.capturePage()).toPNG())}
};
module.exports.currentFooterControls=currentFooterControls;
