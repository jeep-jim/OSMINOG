'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
async function newStartTabReady({js,beforeIds}){
 return js(`(()=>{const m=MouseTest.model,before=${JSON.stringify(beforeIds)},selected=m.state.tabs.find(t=>t.id===m.slots[m.active]),pane=document.querySelector('.pane.active');return m.state.tabs.length===before.length+1&&!!selected&&!before.includes(selected.id)&&selected.internal===true&&!!pane&&pane.dataset.pane===m.active&&!!pane.querySelector('.home-page');})()`);
}
async function waitForNewStartTab({js,sleep,beforeIds}){
 // The emitted browser state precedes the IPC result that selects and mounts it.
 for(let i=0;i<100&&!await newStartTabReady({js,beforeIds});i++)await sleep(30);
 assert.equal(await newStartTabReady({js,beforeIds}),true,'Mouse614 timeout: new start tab is selected and mounted');
}
module.exports=async({win})=>{
 const js=s=>win.webContents.executeJavaScript(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const theme=await js('MouseTest.model.theme'),checks=[];
 try{
  win.show();win.focus();await sleep(200);
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);
   const states=[],state=async s=>{await js(`MouseTest.renderUpdate(${JSON.stringify(s)})`);const available=await js('document.querySelector("#version-button").dataset.updateAvailable');states.push({state:s,available});return available;};
   assert.equal(await state({phase:'idle'}),'false');
   assert.equal(await state({phase:'error',error:'offline'}),'false');
   assert.equal(await state({phase:'available',latestVersion:'9.0.0'}),'false','unvalidated version cannot show update availability');
   assert.equal(await state({phase:'available',availableVersion:'9.0.0',latestVersion:'9.0.0'}),'true');
   await js('document.querySelector("#update-dialog").open&&document.querySelector("#update-dialog").close()');
   assert.equal(await state({phase:'downloading',availableVersion:'9.0.0',latestVersion:'9.0.0',percent:37}),'true');
   const color=await js('getComputedStyle(document.querySelector("#version-button")).color');assert.equal(color,theme==='dark'?'rgb(103, 230, 109)':'rgb(22, 130, 59)');
   assert.equal(await state({phase:'error',availableVersion:'9.0.0',error:'test download failed'}),'true');
   // The 628 owner correction replaces the decorative green border with a
   // tinted surface and green text. Native pixels must prove both are painted.
   const rgb=theme==='dark'?[103,230,109]:[22,130,59];let screenshot,textPixels=0,fillPixels=0,evidence;
   for(let attempt=0;attempt<30;attempt++){
    await sleep(100);
    const meta=await js('(()=>{const b=document.querySelector("#version-button"),r=b.getBoundingClientRect(),c=getComputedStyle(b),a=getComputedStyle(b,"::after"),canvas=document.createElement("canvas");canvas.width=canvas.height=1;const x=canvas.getContext("2d"),rgb=color=>{x.clearRect(0,0,1,1);x.fillStyle=color;x.fillRect(0,0,1,1);return[...x.getImageData(0,0,1,1).data].slice(0,3);};return{label:b.textContent,compactLabel:b.dataset.compactLabel??null,ariaLabel:b.getAttribute("aria-label"),fontSize:c.fontSize,fontWeight:c.fontWeight,after:{content:a.content,fontSize:a.fontSize,fontWeight:a.fontWeight,color:a.color},available:b.dataset.updateAvailable,width:innerWidth,height:innerHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height},border:parseFloat(c.borderTopWidth),shadow:c.boxShadow,text:rgb(c.color),fill:rgb(c.backgroundColor),panel:rgb(getComputedStyle(document.querySelector("#statusbar")).backgroundColor)}})()');
    assert.equal(meta.available,'true','known newer release must stay indicated while dialog is closed');
    assert.equal(meta.border,0);assert.equal(meta.shadow,'none');assert.deepEqual(meta.text,rgb);assert.notDeepEqual(meta.fill,meta.panel,'Update availability has its own tinted background');
    screenshot=await win.capturePage();const size=screenshot.getSize(),bytes=screenshot.toBitmap(),sx=size.width/meta.width,sy=size.height/meta.height,sample={left:Math.max(0,Math.floor(meta.rect.x*sx)),top:Math.max(0,Math.floor(meta.rect.y*sy)),right:Math.min(size.width,Math.ceil((meta.rect.x+meta.rect.width)*sx)),bottom:Math.min(size.height,Math.ceil((meta.rect.y+meta.rect.height)*sy))};textPixels=fillPixels=0;
    for(let y=sample.top;y<sample.bottom;y++)for(let x=sample.left;x<sample.right;x++){
     const i=(y*size.width+x)*4,actual=[bytes[i+2],bytes[i+1],bytes[i]];if(actual.every((value,c)=>Math.abs(value-rgb[c])<=3))textPixels++;if(actual.every((value,c)=>Math.abs(value-meta.fill[c])<=3))fillPixels++;
    }
    const minimumFillPixels=Math.ceil((sample.right-sample.left)*(sample.bottom-sample.top)*.25);evidence={meta,image:{width:size.width,height:size.height,scaleX:sx,scaleY:sy},sample,tolerance:3,textPixels,fillPixels,minimumTextPixels:16,minimumFillPixels};
    if(textPixels>=16&&fillPixels>=minimumFillPixels)break;
    if(attempt===29)console.log('MOUSE_614_BADGE_PAINT_DIAGNOSTICS',JSON.stringify({theme,...evidence}));
   }
   const file='mouse-614-burrow-update-'+theme+'.png',check={theme,file,states,...evidence};
   await fs.writeFile(file,screenshot.toPNG());
   await fs.writeFile('mouse-614-update-badge-'+theme+'.json',JSON.stringify(check,null,2)+'\n');
   assert.ok(textPixels>=16&&fillPixels>=evidence.minimumFillPixels,'Actual screenshot must contain the green text and tinted update surface: '+JSON.stringify(evidence));
   checks.push(check);
   assert.equal(await state({phase:'current',availableVersion:''}),'false');
   const icon=await js('(()=>{const b=document.querySelector("#new-tab"),s=b.querySelector("svg"),r=s.getBoundingClientRect();return{label:b.getAttribute("aria-label"),plus:b.textContent.includes("＋"),paths:s.querySelectorAll("path").length,width:r.width,height:r.height}})()');
   // Owner621 restores a permanently visible 14px top plus; desktop burrow is tested separately.
   assert.equal(icon.label,'Новая вкладка');assert.equal(icon.plus,false);assert.equal(icon.paths,1);assert.equal(icon.width,14);assert.equal(icon.height,14);
  }
  const beforeIds=await js('MouseTest.model.state.tabs.map(t=>t.id)'),count=beforeIds.length;await js('document.querySelector("#new-tab").click()');await waitForNewStartTab({js,sleep,beforeIds});assert.equal(await js('MouseTest.model.state.tabs.length'),count+1);assert.equal(await js('MouseTest.model.state.tabs.find(t=>t.id===MouseTest.model.slots[MouseTest.model.active]).internal'),true);
  await fs.writeFile('mouse-614-update-badge.json',JSON.stringify({version:'6.0.14',visualVersion:'6.0.28',metadataOnly:true,newerVersionRequired:true,borderless:true,greenText:true,tintedFill:true,themes:['light','dark'],checks},null,2)+'\n');
  console.log('MOUSE_628_BORDERLESS_UPDATE_BADGE_BOTH_THEMES_PASS');
 }finally{await js(`MouseTest.renderUpdate({phase:'idle',availableVersion:''});MouseTest.setTheme(${JSON.stringify(theme)})`);}
};
module.exports.newStartTabReady=newStartTabReady;
module.exports.waitForNewStartTab=waitForNewStartTab;
