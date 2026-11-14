'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async({win})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 const previous=await js('JSON.parse(JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active}))');
 await js('QuadroTest.changeLayout(1);QuadroTest.action("new-tab")');
 await new Promise(r=>setTimeout(r,300));
 // Bookmark fixture ensures the ellipsis control exists even in an empty profile.
 await js('QuadroNative.start("bookmark",{url:"https://example.com/mouse-contrast",title:"Contrast fixture"}).then(()=>QuadroTest.home.refresh())');
 for(const theme of ['dark','light']){
  await js(`QuadroTest.setTheme('${theme}')`);
  const ratios=await js(`(()=>{const lum=s=>{const a=s.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};return['.home-search button','.favorite-edit'].map(sel=>{const s=getComputedStyle(document.querySelector(sel)),a=lum(s.color),b=lum(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})})()`);
  assert.ok(ratios.every(x=>x>=7),theme+' start control contrast '+ratios);
 }
 await js('QuadroTest.action("screenshot")');
 assert.equal(await js('document.querySelector("#capture-dialog").dataset.captured'),'true');
 assert.match(await js('document.querySelector("#capture-status").textContent'),/Снимок готов/);
 assert.ok(await js('QuadroTest.capture.test.getCanvas().width')>1);
 await js('document.querySelector("#capture-close").click()');
 await js(`Object.assign(QuadroTest.model,${JSON.stringify(previous)});QuadroTest.renderTree();QuadroTest.applySide()`);
 console.log('MOUSE_START_BUTTON_DARK_LIGHT_CONTRAST_CAPTURE_FEEDBACK_PASS');
};
