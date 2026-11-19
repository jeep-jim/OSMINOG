'use strict';
const fs=require('node:fs'),path=require('node:path');
const brand=require('./mouse-icon.cjs');
function ico(){
 // PNG-compressed ICO entries retain the approved, code-defined mouse artwork.
 // Windows scales the 32px entry for its smallest shell icon sizes.
 const sizes=[32,48,64,128,256],images=sizes.map(size=>brand.png(size,{app:true}));
 const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
 let offset=header.length;
 images.forEach((png,i)=>{const p=6+i*16,size=sizes[i];header[p]=header[p+1]=size===256?0:size;
  header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);
  header.writeUInt32LE(offset,p+12);offset+=png.length;});
 return Buffer.concat([header,...images]);
}
function build(){brand.build();const target=path.join(__dirname,'icons/mouse-browser.ico');fs.writeFileSync(target,ico());return target;}
if(require.main===module)console.log(build());
module.exports={ico,build};
