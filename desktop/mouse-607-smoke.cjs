'use strict';
// Tests actual installed app artwork, including the Finder/DMG .icns file.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {nativeImage}=require('electron'),brand=require('./mouse-brand.cjs');
function verify(image,{app=false,dark=false,size}={}){
 assert.equal(image.isEmpty(),false);assert.deepEqual(image.getSize(),{width:size,height:size});
 const data=image.toBitmap(),scale=Math.max(1,Math.floor(size*(app?.68:.90)/30)),left=Math.floor((size-22*scale)/2),top=Math.floor((size-30*scale)/2);
 const mask=[];
 for(let y=0;y<30;y++){
  let row='';for(let x=0;x<22;x++){
   const px=left+x*scale+Math.floor(scale/2),py=top+y*scale+Math.floor(scale/2),i=(py*size+px)*4;
   row+=data[i+3]>250&&(dark?data[i]>250:data[i]<5)?'1':'0';
  }mask.push(row);
 }
 assert.deepEqual(mask,brand.pixels.map(row=>[...row].reverse().join('')),'installed icon must match approved mirrored source');
 assert.equal(mask[29],'1111111000000000000000','tail MUST end on the LEFT');
}
module.exports=async({app,win})=>{
 for(const dark of [false,true]){
  const bytes=await fs.readFile(path.join(__dirname,'icons/mouse-browser-'+(dark?'dark':'light')+'.png'));
  verify(nativeImage.createFromBuffer(bytes),{app:true,dark,size:1024});
  const ui=await fs.readFile(path.join(__dirname,'quadro/'+(dark?'brand-dark.png':'brand.png')));
  verify(nativeImage.createFromBuffer(ui),{dark,size:64});
 }
 const svg=await fs.readFile(path.join(__dirname,'quadro/mouse-private.svg'),'utf8');
 assert.match(svg,/viewBox="0 0 47 64"/);assert.doesNotMatch(svg,/transform=/);
 assert.equal((svg.match(/id="mouse-approved-left"/g)||[]).length,1);
 const artwork=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=47;c.height=64;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(i,0,0);resolve({pixels:[...x.getImageData(0,0,47,64).data],png:c.toDataURL('image/png')})};i.onerror=reject;i.src='mouse-private.svg'})`);
 const at=(x,y)=>artwork.pixels.slice((y*47+x)*4,(y*47+x)*4+4);
 assert.deepEqual(at(0,58),[255,255,255,255],'owner now requires white mascot; tail ends left');
 assert.equal(at(46,63)[3],0);
 assert.deepEqual(at(45,17),[168,85,247,255],'approved glasses have an opaque purple right arm');
 assert.deepEqual(at(15,17),[255,255,255,255],'reference glasses retain white pixel highlights');
 for(let i=3;i<artwork.pixels.length;i+=4)assert.ok(artwork.pixels[i]===0||artwork.pixels[i]===255,'pixel art has no fractional translucent edges');
 await fs.writeFile('mouse-607-incognito-artwork.png',Buffer.from(artwork.png.split(',')[1],'base64'));
 const js=s=>win.webContents.executeJavaScript(s),previous=await js('QuadroTest.model.theme');
 try{
  for(const theme of ['light','dark','light']){
   await js(`QuadroNative.theme('${theme}')`);
   assert.equal(win.mouseDockThemeForTest(),'light','Dock must remain black on white in every theme');
  }
 }finally{await js(`QuadroNative.theme(${JSON.stringify(previous)})`);}
 console.log('MOUSE_608_WHITE_SQUARE_PIXELS_AND_FIXED_DOCK_PASS');
 const beforeTheme=await js('QuadroTest.model.theme');
 try{
  for(const theme of ['light','dark']){
   await js(`QuadroTest.setTheme('${theme}')`);
   const icon=await js(`(()=>{const e=document.querySelector('#private-button svg'),r=e.getBoundingClientRect(),p=e.querySelectorAll('path');return{width:r.width,height:r.height,shape:getComputedStyle(e).shapeRendering,body:getComputedStyle(p[0]).fill,shine:getComputedStyle(p[1]).fill,paths:[...p].map(x=>x.getAttribute('d'))}})()`);
   assert.equal(icon.width,24);assert.equal(icon.height,14);assert.equal(icon.shape.toLowerCase(),'crispedges');
   assert.equal(icon.body,'rgb(168, 85, 247)');assert.equal(icon.shine,'rgb(255, 255, 255)');
   assert.deepEqual(icon.paths,['M1 2h22v3h-2v4h-2v2h-6V7h-2v4H5V9H3V5H1Z','M5 4h2v2H5zm2 2h2v2H7zm8-2h2v2h-2zm2 2h2v2h-2z']);
   const rendered=await js(`(()=>{const svg=document.querySelector('#private-button svg').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','24');svg.setAttribute('height','14');svg.setAttribute('shape-rendering','crispEdges');svg.querySelectorAll('path')[0].setAttribute('fill','#a855f7');svg.querySelectorAll('path')[1].setAttribute('fill','#ffffff');return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=24;c.height=14;const x=c.getContext('2d');x.drawImage(i,0,0);resolve([...x.getImageData(0,0,24,14).data])};i.onerror=reject;i.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(svg))})})()`);
   const pixel=(x,y)=>rendered.slice((y*24+x)*4,(y*24+x)*4+4);
   assert.deepEqual(pixel(5,4),[255,255,255,255]);assert.deepEqual(pixel(7,6),[255,255,255,255]);assert.deepEqual(pixel(15,4),[255,255,255,255]);assert.deepEqual(pixel(17,6),[255,255,255,255]);assert.deepEqual(pixel(1,2),[168,85,247,255]);
   await new Promise(r=>setTimeout(r,250));await fs.writeFile('mouse-610-footer-'+theme+'.png',(await win.capturePage()).toPNG());
  }
 }finally{await js(`QuadroTest.setTheme(${JSON.stringify(beforeTheme)})`)}
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
 console.log('MOUSE_607_INSTALLED_ICNS_DOCK_UI_PRIVATE_TAIL_LEFT_PASS');
};
