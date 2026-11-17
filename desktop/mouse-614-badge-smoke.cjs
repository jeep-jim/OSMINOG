'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async({win})=>{
 const js=s=>win.webContents.executeJavaScript(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const theme=await js('MouseTest.model.theme');
 try{
  win.show();win.focus();await sleep(200);
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
   const rgb=theme==='dark'?[103,230,109]:[22,130,59];let screenshot,painted=0;
   for(let attempt=0;attempt<30;attempt++){
    await sleep(100);
    const meta=await js('(()=>{const b=document.querySelector("#version-button"),r=b.getBoundingClientRect(),c=getComputedStyle(b);return{available:b.dataset.updateAvailable,width:innerWidth,height:innerHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height},border:c.borderTopWidth,shadow:c.boxShadow}})()');
    assert.equal(meta.available,'true','known newer release must stay indicated while dialog is closed');
    screenshot=await win.capturePage();const size=screenshot.getSize(),bytes=screenshot.toBitmap(),sx=size.width/meta.width,sy=size.height/meta.height;painted=0;
    for(let y=Math.max(0,Math.floor(meta.rect.y*sy));y<Math.min(size.height,Math.ceil((meta.rect.y+meta.rect.height)*sy));y++)for(let x=Math.max(0,Math.floor(meta.rect.x*sx));x<Math.min(size.width,Math.ceil((meta.rect.x+meta.rect.width)*sx));x++){
     const i=(y*size.width+x)*4;if(Math.abs(bytes[i+2]-rgb[0])<=3&&Math.abs(bytes[i+1]-rgb[1])<=3&&Math.abs(bytes[i]-rgb[2])<=3)painted++;
    }
    if(painted>=40)break;
    if(attempt===29)console.log('MOUSE_614_BADGE_PAINT_DIAGNOSTICS',JSON.stringify({theme,painted,meta,size}));
   }
   assert.ok(painted>=40,'actual screenshot must contain the green update border: '+painted);
   await fs.writeFile('mouse-614-burrow-update-'+theme+'.png',screenshot.toPNG());
   assert.equal(await state({phase:'current',availableVersion:''}),'false');
   const icon=await js('(()=>{const b=document.querySelector("#new-tab"),s=b.querySelector("svg"),r=s.getBoundingClientRect();return{label:b.getAttribute("aria-label"),plus:b.textContent.includes("＋"),paths:s.querySelectorAll("path").length,width:r.width,height:r.height}})()');
   // Owner621 restores a permanently visible 14px top plus; desktop burrow is tested separately.
   assert.equal(icon.label,'Новая вкладка');assert.equal(icon.plus,false);assert.equal(icon.paths,1);assert.equal(icon.width,14);assert.equal(icon.height,14);
  }
  const count=await js('MouseTest.model.state.tabs.length');await js('document.querySelector("#new-tab").click()');for(let i=0;i<100&&await js('MouseTest.model.state.tabs.length')===count;i++)await sleep(30);assert.equal(await js('MouseTest.model.state.tabs.length'),count+1);assert.equal(await js('MouseTest.model.state.tabs.find(t=>t.id===MouseTest.model.slots[MouseTest.model.active]).internal'),true);
  console.log('MOUSE_614_REAL_UPDATE_BADGE_BOTH_THEMES_AND_BURROW_CLICK_PASS');
 }finally{await js(`MouseTest.renderUpdate({phase:'idle',availableVersion:''});MouseTest.setTheme(${JSON.stringify(theme)})`);}
};
