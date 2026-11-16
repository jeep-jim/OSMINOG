'use strict';
const assert=require('node:assert/strict');
module.exports=async({win})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 const previous=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,theme:MouseTest.model.theme,aiOpen:MouseTest.model.aiOpen}))');
 await js('MouseTest.changeLayout(1);MouseTest.action("new-tab")');
 await new Promise(r=>setTimeout(r,300));
 await js('MouseNative.start("bookmark",{url:"https://example.com/mouse-contrast",title:"Contrast fixture"}).then(()=>MouseTest.home.refresh())');
 for(const theme of ['dark','light']){
  await js(`MouseTest.setTheme('${theme}')`);
  const ratios=await js(`(()=>{const lum=s=>{const a=s.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};return['.home-search button','.favorite-edit'].map(sel=>{const s=getComputedStyle(document.querySelector(sel)),a=lum(s.color),b=lum(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})})()`);
  assert.ok(ratios.every(x=>x>=7),theme+' start control contrast '+ratios);
 }
 await js('MouseTest.action("screenshot")');
 assert.equal(await js('document.querySelector("#capture-dialog").dataset.captured'),'true');
 assert.match(await js('document.querySelector("#capture-status").textContent'),/Снимок готов/);
 assert.ok(await js('MouseTest.capture.test.getCanvas().width')>1);
 await js('document.querySelector("#capture-close").click()');
 await js(`Object.assign(MouseTest.model,${JSON.stringify(previous)});MouseTest.setTheme(${JSON.stringify(previous.theme)});MouseTest.renderTree();MouseTest.applySide();MouseFlush()`);
 const stored=await js('MouseNative.init().then(x=>x.preferences.tree)');
 assert.deepEqual(stored,previous.tree,'The new contrast probe must not overwrite the earlier drag/restart fixture');
 console.log('MOUSE_START_BUTTON_DARK_LIGHT_CONTRAST_CAPTURE_FEEDBACK_PASS');
};
