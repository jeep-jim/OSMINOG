'use strict';
// Tests actual installed app artwork, including the Finder/DMG .icns file.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {nativeImage}=require('electron'),brand=require('./mouse/mouse-head.json');
function verify(image,{app=false,dark=false,size}={}){
 assert.equal(image.isEmpty(),false);assert.deepEqual(image.getSize(),{width:size,height:size});
 const data=image.toBitmap(),scale=Math.max(1,Math.floor(size*(app?.68:.90)/19)),left=Math.floor((size-19*scale)/2),top=Math.floor((size-17*scale)/2);
 const mask=[];
 for(let y=0;y<17;y++){
  let row='';for(let x=0;x<19;x++){
   const px=left+x*scale+Math.floor(scale/2),py=top+y*scale+Math.floor(scale/2),i=(py*size+px)*4;
   row+=data[i+3]>250&&(dark?data[i]>250:data[i]<5)?'1':'0';
  }mask.push(row);
 }
 assert.deepEqual(mask,brand.pixels,'installed icon must match exact owner head');
 assert.equal(mask.length,17);
}
module.exports=async({app,win})=>{
 for(const dark of [false,true]){
  const bytes=await fs.readFile(path.join(__dirname,'icons/mouse-browser-'+(dark?'dark':'light')+'.png'));
  verify(nativeImage.createFromBuffer(bytes),{app:true,dark,size:1024});
  const ui=await fs.readFile(path.join(__dirname,'mouse/'+(dark?'brand-dark.png':'brand.png')));
  verify(nativeImage.createFromBuffer(ui),{dark,size:64});
 }
 const svg=await fs.readFile(path.join(__dirname,'mouse/mouse-private.svg'),'utf8');
 assert.match(svg,/viewBox="0 0 47 64"/);assert.match(svg,/id="mouse-approved-left"/);
 const artwork=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=47;c.height=64;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(i,0,0);resolve({pixels:[...x.getImageData(0,0,47,64).data],png:c.toDataURL('image/png')})};i.onerror=reject;i.src='mouse-private.svg'})`);
 const at=(x,y)=>artwork.pixels.slice((y*47+x)*4,(y*47+x)*4+4);
 assert.deepEqual(at(10,2),[255,255,255,255]);assert.equal(at(46,63)[3],0);assert.deepEqual(at(13,16),[168,85,247,255]);assert.deepEqual(at(15,17),[255,255,255,255]);
 for(let i=3;i<artwork.pixels.length;i+=4)assert.ok(artwork.pixels[i]===0||artwork.pixels[i]===255);
 await fs.writeFile('mouse-607-incognito-artwork.png',Buffer.from(artwork.png.split(',')[1],'base64'));
 const js=s=>win.webContents.executeJavaScript(s),previous=await js('MouseTest.model.theme');
 try{
  for(const theme of ['light','dark','light']){
   await js(`MouseNative.theme('${theme}')`);
   assert.equal(win.mouseDockThemeForTest(),'light','Dock must remain black on white in every theme');
  }
 }finally{await js(`MouseNative.theme(${JSON.stringify(previous)})`);}
 console.log('MOUSE_608_WHITE_SQUARE_PIXELS_AND_FIXED_DOCK_PASS');
 const beforeTheme=await js('MouseTest.model.theme');
 try{
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);
   const icon=await js(`(async()=>{const e=document.querySelector('#private-button svg'),r=e.getBoundingClientRect(),i=new Image();const copy=e.cloneNode(true),paths=[...e.querySelectorAll('path')];paths.forEach((p,n)=>copy.querySelectorAll('path')[n].setAttribute('fill',getComputedStyle(p).fill));i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(copy));await i.decode();const c=document.createElement('canvas');c.width=48;c.height=28;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(i,0,0,48,28);return{width:r.width,height:r.height,filter:getComputedStyle(e).filter,pixels:[...x.getImageData(0,0,48,28).data]}})()`);
   assert.equal(icon.width,24);assert.equal(icon.height,14);assert.equal(icon.filter,'none');const tuples=[];for(let i=0;i<icon.pixels.length;i+=4)tuples.push(icon.pixels.slice(i,i+4).join(','));assert.ok(tuples.includes('168,85,247,255'));assert.ok(tuples.includes('255,255,255,255'));
   await new Promise(r=>setTimeout(r,250));await fs.writeFile('mouse-610-footer-'+theme+'.png',(await win.capturePage()).toPNG());
  }
 }finally{await js(`MouseTest.setTheme(${JSON.stringify(beforeTheme)})`)}
 console.log('MOUSE_610_PURPLE_GLASSES_AND_ALL_FOOTER_PIXELS_BOTH_THEMES_PASS');

 const contents=path.dirname(path.dirname(process.execPath));
 let icon=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIconFile',path.join(contents,'Info.plist')],{encoding:'utf8'}).trim();
 assert.ok(icon&&!icon.includes('/'));if(!icon.endsWith('.icns'))icon+='.icns';
 const temp=await fs.mkdtemp(path.join(app.getPath('temp'),'mouse-icon-check-')),out=path.join(temp,'actual.iconset');
 try{
  execFileSync('/usr/bin/iconutil',['-c','iconset',path.join(contents,'Resources',icon),'-o',out]);
  const bytes=await fs.readFile(path.join(out,'icon_512x512@2x.png'));
  verify(nativeImage.createFromBuffer(bytes),{app:true,size:1024});
  await fs.writeFile('mouse-607-installed-app-icon.png',bytes);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
 console.log('MOUSE_620_INSTALLED_ICNS_DOCK_UI_HEAD_PASS');
};
