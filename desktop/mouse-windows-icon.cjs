'use strict';
const fs=require('node:fs'),path=require('node:path');
const brand=require('./mouse-icon.cjs');
function ico(){
 // Supply each common shell/DPI size directly so the smallest shell icons
 // retain their own complete, proportionate raster instead of a reduced 32px one.
 const sizes=[16,20,24,32,40,48,64,96,128,256],images=sizes.map(size=>brand.png(size,{app:true,smooth:true}));
 const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
 let offset=header.length;
 images.forEach((png,i)=>{const p=6+i*16,size=sizes[i];header[p]=header[p+1]=size===256?0:size;
  header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);
  header.writeUInt32LE(offset,p+12);offset+=png.length;});
 return Buffer.concat([header,...images]);
}
function build(){
 brand.build();
 // The footer uses the same owner paths. Allow antialiasing at fractional DPI,
 // while keeping the approved pixel SVG and all Mac/private assets untouched.
 const svg=fs.readFileSync(path.join(__dirname,'mouse/mouse-head.svg'),'utf8');
 fs.writeFileSync(path.join(__dirname,'mouse/mouse-head-smooth.svg'),svg.replace('shape-rendering="crispEdges"','shape-rendering="geometricPrecision"'));
 const target=path.join(__dirname,'icons/mouse-browser.ico');fs.writeFileSync(target,ico());return target;
}
if(require.main===module)console.log(build());
module.exports={ico,build};
