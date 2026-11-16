'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async({win})=>{
 const js=s=>win.webContents.executeJavaScript(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const theme=await js('MouseTest.model.theme');
 try{
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);
   const state=async s=>{await js(`MouseTest.renderUpdate(${JSON.stringify(s)})`);return js('document.querySelector("#version-button").dataset.updateAvailable');};
   assert.equal(await state({phase:'idle'}),'false');
   assert.equal(await state({phase:'error',error:'offline'}),'false');
   assert.equal(await state({phase:'available',latestVersion:'9.0.0'}),'false','unvalidated version cannot glow');
   assert.equal(await state({phase:'available',availableVersion:'9.0.0',latestVersion:'9.0.0'}),'true');
   await js('document.querySelector("#update-dialog").open&&document.querySelector("#update-dialog").close()');
   assert.equal(await state({phase:'downloading',availableVersion:'9.0.0',latestVersion:'9.0.0',percent:37}),'true');
   const color=await js('getComputedStyle(document.querySelector("#version-button")).borderTopColor');assert.equal(color,theme==='dark'?'rgb(103, 230, 109)':'rgb(22, 130, 59)');
   assert.equal(await state({phase:'error',availableVersion:'9.0.0',error:'test download failed'}),'true');
   await sleep(100);await fs.writeFile('mouse-614-burrow-update-'+theme+'.png',(await win.capturePage()).toPNG());
   assert.equal(await state({phase:'current',availableVersion:''}),'false');
   const icon=await js('(()=>{const b=document.querySelector("#new-tab"),s=b.querySelector("svg"),r=s.getBoundingClientRect();return{label:b.getAttribute("aria-label"),plus:b.textContent.includes("＋"),paths:s.querySelectorAll("path").length,width:r.width,height:r.height}})()');
   assert.equal(icon.label,'Новая вкладка');assert.equal(icon.plus,false);assert.equal(icon.paths,3);assert.equal(icon.width,23);assert.equal(icon.height,25);
  }
  const count=await js('MouseTest.model.state.tabs.length');await js('document.querySelector("#new-tab").click()');for(let i=0;i<100&&await js('MouseTest.model.state.tabs.length')===count;i++)await sleep(30);assert.equal(await js('MouseTest.model.state.tabs.length'),count+1);assert.equal(await js('MouseTest.model.state.tabs.find(t=>t.id===MouseTest.model.slots[MouseTest.model.active]).internal'),true);
  console.log('MOUSE_614_REAL_UPDATE_BADGE_BOTH_THEMES_AND_BURROW_CLICK_PASS');
 }finally{await js(`MouseTest.renderUpdate({phase:'idle',availableVersion:''});MouseTest.setTheme(${JSON.stringify(theme)})`);}
};
