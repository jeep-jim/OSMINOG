'use strict';
// Actual installed native mask submissions and OS pixels are read independently
// by the641 Python reader. No renderer-generated reference image is accepted.
const assert=require('node:assert/strict');
module.exports=async function corners({ctx,row,fixture,capture,js,until,masks}){
 const {win,browser}=ctx,original=win.getBounds(),result=[];
 try{
  for(const stage of ['before','resized']){
   if(stage==='resized'){
    const size=win.getMinimumSize(),next={...original,width:original.width-40};assert.ok(next.width>=size[0]);win.setBounds(next);await until(()=>win.getBounds().width===next.width,'641 actual native window resizes');await fixture.frame();
   }
   const shell=await js('(()=>{const m=MouseTest.model,w=document.querySelector("#workspace"),r=w.getBoundingClientRect();return{theme:m.theme,appearance:m.appearance,settingsOpen:m.settingsOpen,libraryOpen:m.libraryOpen,workspace:{x:r.x,y:r.y,width:r.width,height:r.height},gradient:getComputedStyle(w).backgroundImage}})()');
   assert.equal(shell.settingsOpen,false);assert.equal(shell.libraryOpen,false);assert.equal(shell.theme,row.theme);
   await until(()=>browser.panels.length>=2&&browser.panels.every(p=>p.roundBottom===12&&p.roundGradient)&&masks().length===browser.panels.length,'641 custom native gradient masks applied');await fixture.frame();
   const native=browser.panels.map(p=>{const page=browser.tabs.get(p.id),wc=page.view.webContents,viewBounds=page.view.getBounds(),parentBounds=page.clipView?.getBounds()||null,actualBounds={x:viewBounds.x+(parentBounds?.x||0),y:viewBounds.y+(parentBounds?.y||0),width:viewBounds.width,height:viewBounds.height};assert.deepEqual(actualBounds,page.bounds,'641 actual native child plus clip parent matches window geometry');return{id:p.id,webContentsId:wc.id,panel:{...p},bounds:{...page.bounds},viewBounds,parentBounds,actualBounds,parentVisible:page.clipView?.getVisible()??true,attached:win.contentView.children.includes(page.clipView||page.view),visible:page.visible&&page.view.getVisible()};});
   assert.ok(native.every(p=>p.attached&&p.visible&&p.parentVisible));const submitted=structuredClone(masks());assert.ok(submitted.every(mask=>mask.gradient));
   const probes=native.flatMap(page=>['left','right'].map(side=>({tabId:page.id,webContentsId:page.webContentsId,side,point:{x:side==='left'?page.bounds.x+1:page.bounds.x+page.bounds.width-1,y:page.bounds.y+page.bounds.height-1}})));
   result.push({stage,theme:row.theme,shell,native,masks:submitted,windowBounds:win.getBounds(),contentBounds:win.getContentBounds(),probes,capture:await capture('corners-'+row.theme+'-'+stage)});
  }
 }finally{win.setBounds(original);await fixture.frame();}
 return result;
};
