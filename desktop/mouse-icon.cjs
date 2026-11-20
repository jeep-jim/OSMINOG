'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),brand=require('./mouse-brand.cjs'),head=require('./mouse/mouse-head.json');
function crc(b){let c=0xffffffff;for(const n of b){c^=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,c]);}
function pixels(size,{dark=false,app=false}={}){
 const data=Buffer.alloc(size*size*4),scale=Math.max(1,Math.floor(size*(app?.68:.90)/Math.max(head.width,head.height))),w=head.width*scale,h=head.height*scale,left=Math.floor((size-w)/2),top=Math.floor((size-h)/2);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4;
  if(app){const qx=Math.abs(x-size/2)/(size*.44),qy=Math.abs(y-size/2)/(size*.44);if(qx**5+qy**5<=1){const v=dark?29:241;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}}
  const sx=Math.floor((x-left)/scale),sy=Math.floor((y-top)/scale);
  if(sx>=0&&sx<head.width&&sy>=0&&sy<head.height&&head.pixels[sy][sx]==='1'){const v=dark?255:0;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 }
 return data;
}
// Windows asks for small images at fractional desktop scales (100/125/150%).
// Keep the exact approved cell mask, but rasterize at continuous scale with
// area coverage instead of dropping whiskers or snapping the whole mark down
// to an integer cell size. Mac's approved pixel-exact assets remain unchanged.
function smoothPixels(size,{dark=false,app=false}={}){
 if(!Number.isInteger(size)||size<1||size>1024)throw Error('Invalid Mouse icon size');
 const data=Buffer.alloc(size*size*4),samples=8,scale=size*(app?.68:.90)/Math.max(head.width,head.height),left=(size-head.width*scale)/2,top=(size-head.height*scale)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let alpha=0,light=0;
  for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
   const px=x+(sx+.5)/samples,py=y+(sy+.5)/samples,hx=Math.floor((px-left)/scale),hy=Math.floor((py-top)/scale);
   if(hx>=0&&hx<head.width&&hy>=0&&hy<head.height&&head.pixels[hy][hx]==='1'){alpha++;light+=dark?255:0;}
   else if(app&&(Math.abs(px-size/2)/(size*.44))**5+(Math.abs(py-size/2)/(size*.44))**5<=1){alpha++;light+=dark?29:241;}
  }
  const at=(y*size+x)*4;
  if(alpha){data[at]=data[at+1]=data[at+2]=Math.round(light/alpha);data[at+3]=Math.round(alpha*255/(samples*samples));}
 }
 return data;
}
function png(size,options){const raw=options?.smooth?smoothPixels(size,options):pixels(size,options),scan=Buffer.alloc((size*4+1)*size),head=Buffer.alloc(13);for(let y=0;y<size;y++)raw.copy(scan,y*(size*4+1)+1,y*size*4,(y+1)*size*4);head.writeUInt32BE(size);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);}
// Current owner artwork is the exact tail-free head. Legacy orientation remains
// only for historical input compatibility; current outputs never use the old body.
function orientPrivateSVG(svg){
 if(svg.includes('id="mouse-owner-head"'))return svg;
 const marker='id="mouse-approved-left"';
 if(svg.includes(marker))return svg;
 if(!svg.includes('viewBox="0 0 44 60"')||!svg.endsWith('</svg>'))throw Error('Unexpected private mascot source');
 return svg.replace(/(<svg[^>]*>)/, '$1<g id="mouse-approved-left" transform="translate(44 0) scale(-1 1)">').replace(/<\/svg>$/, '</g></svg>');
}
function build(){
 const original=Buffer.from(brand.sourcePNG,'base64');if(crypto.createHash('sha256').update(original).digest('hex')!==brand.sourceSHA256)throw Error('Owner mouse source hash mismatch');
 fs.mkdirSync(path.join(__dirname,'icons'),{recursive:true});
 for(const dark of [false,true])fs.writeFileSync(path.join(__dirname,'icons/mouse-browser-'+(dark?'dark':'light')+'.png'),png(1024,{dark,app:true}));
 fs.writeFileSync(path.join(__dirname,'mouse/brand.png'),png(64));
 fs.writeFileSync(path.join(__dirname,'mouse/brand-dark.png'),png(64,{dark:true}));
 fs.writeFileSync(path.join(__dirname,'mouse/mouse-original.png'),original);
 const privatePath=path.join(__dirname,'mouse/mouse-private.svg');
 fs.writeFileSync(privatePath,orientPrivateSVG(fs.readFileSync(privatePath,'utf8')));
}
if(require.main===module)build();module.exports={png,pixels,smoothPixels,build,orientPrivateSVG};
