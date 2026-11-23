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
    const art=imgs.map(i=>{const c=document.createElement('canvas');c.width=47;c.height=64;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(i,0,0,47,64);return{src:i.getAttribute('src'),filter:getComputedStyle(i).filter,pixels:[...x.getImageData(0,0,47,64).data]}});
    const home=document.querySelector('.home-page'),style=getComputedStyle(home);
    return{art,tab:document.querySelector('#tabstrip .private-logo')?.getAttribute('src'),pane:document.querySelector('.pane-icon .private-logo')?.getAttribute('src'),background:style.backgroundColor,text:style.color,private:document.documentElement.dataset.private,version:MouseNative.version,whiteTone:MouseTest.model.appearance?.whiteTone,primary:getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()};
   })()`);
   const light=theme==='light',src=light?'mouse-private-light.svg':'mouse-private.svg';
   assert.equal(result.private,'true');assert.ok(result.art.length>=1);assert.equal(result.tab,light?'mouse-head.svg':'mouse-head-dark.svg');assert.equal(result.pane,light?'mouse-head.svg':'mouse-head-dark.svg');
   for(const a of result.art){
    assert.equal(a.src,src);assert.equal(a.filter,'none');
    const at=(x,y)=>a.pixels.slice((y*47+x)*4,(y*47+x)*4+4);
    assert.deepEqual(at(10,2),light?[0,0,0,255]:[255,255,255,255]);
    assert.deepEqual(at(13,16),[168,85,247,255]);assert.deepEqual(at(15,17),[255,255,255,255]);
   }
   assert.equal(result.background,light?'rgb(237, 238, 240)':'rgb(23, 24, 34)');
   let darkText='rgb(245, 241, 255)';
   if(result.version==='6.0.38'){
    // Only637 primary text follows the selected tone; private artwork and
    // backgrounds above retain their exact earlier pixel/color assertions.
    assert.ok(Number.isInteger(result.whiteTone)&&result.whiteTone>=0&&result.whiteTone<=100,'637 private white tone is an integer from 0 to 100');
    const byte=Math.round(160+95*result.whiteTone/100),hex=byte.toString(16).padStart(2,'0');
    assert.equal(result.primary.toLowerCase(),'#'+hex.repeat(3),'637 private primary variable matches the selected white tone');
    darkText=`rgb(${byte}, ${byte}, ${byte})`;
   }
   assert.equal(result.text,light?'rgb(25, 25, 35)':darkText);
   assert.deepEqual(await js('MouseTest.model.state.tabs.map(t=>t.id)'),tabIds);
   await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await sleep(350);
   await fs.writeFile('mouse-611-private-'+theme+'.png',(await win.capturePage()).toPNG());
  }
  console.log('MOUSE_611_PRIVATE_THEME_ASSETS_AND_LIVE_SWITCH_PASS');
 }finally{await js(`MouseTest.setTheme(${JSON.stringify(previous)})`);}
};
