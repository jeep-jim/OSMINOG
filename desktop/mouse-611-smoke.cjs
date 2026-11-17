'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({win})=>{
 const js=s=>win.webContents.executeJavaScript(s);
 const previous=await js('MouseTest.model.theme');
 const tabIds=await js('MouseTest.model.state.tabs.map(t=>t.id)');
 try{
  for(const theme of ['light','dark','light']){
   await js(`MouseTest.setTheme('${theme}')`);
   const result=await js(`(async()=>{
    const imgs=[...document.querySelectorAll('.private-mascot')];
    await Promise.all(imgs.map(i=>i.decode()));
    const art=imgs.map(i=>{const c=document.createElement('canvas');c.width=19;c.height=17;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(i,0,0,19,17);return{src:i.getAttribute('src'),filter:getComputedStyle(i).filter,pixels:[...x.getImageData(0,0,19,17).data]}});
    const home=document.querySelector('.home-page'),style=getComputedStyle(home);
    return{art,tab:document.querySelector('#tabstrip .private-logo')?.getAttribute('src'),pane:document.querySelector('.pane-icon .private-logo')?.getAttribute('src'),background:style.backgroundColor,text:style.color,private:document.documentElement.dataset.private};
   })()`);
   const light=theme==='light',src=light?'mouse-private-light.svg':'mouse-private.svg';
   assert.equal(result.private,'true');assert.ok(result.art.length>=1);assert.equal(result.tab,src);assert.equal(result.pane,src);
   for(const a of result.art){
    assert.equal(a.src,src);assert.equal(a.filter,'none');
    const at=(x,y)=>a.pixels.slice((y*19+x)*4,(y*19+x)*4+4);
    assert.deepEqual(at(2,2),light?[0,0,0,255]:[255,255,255,255]);
    assert.deepEqual(at(3,7),[168,85,247,255]);assert.deepEqual(at(5,8),[255,255,255,255]);
   }
   assert.equal(result.background,light?'rgb(237, 238, 240)':'rgb(23, 24, 34)');
   assert.equal(result.text,light?'rgb(25, 25, 35)':'rgb(245, 241, 255)');
   assert.deepEqual(await js('MouseTest.model.state.tabs.map(t=>t.id)'),tabIds);
   await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await sleep(350);
   await fs.writeFile('mouse-611-private-'+theme+'.png',(await win.capturePage()).toPNG());
  }
  console.log('MOUSE_611_PRIVATE_THEME_ASSETS_AND_LIVE_SWITCH_PASS');
 }finally{await js(`MouseTest.setTheme(${JSON.stringify(previous)})`);}
};
