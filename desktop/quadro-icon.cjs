'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),brand=require('./mouse-brand.cjs');
function crc(b){let c=0xffffffff;for(const n of b){c^=n;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,c]);}
function pixels(size,{dark=false,app=false}={}){
 const data=Buffer.alloc(size*size*4),scale=Math.max(1,Math.floor(size*(app?.68:.90)/brand.height)),w=brand.width*scale,h=brand.height*scale,left=Math.floor((size-w)/2),top=Math.floor((size-h)/2);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4;
  if(app){const qx=Math.abs(x-size/2)/(size*.44),qy=Math.abs(y-size/2)/(size*.44);if(qx**5+qy**5<=1){const v=dark?29:241;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}}
  const sx=Math.floor((x-left)/scale),sy=Math.floor((y-top)/scale);
  if(sx>=0&&sx<brand.width&&sy>=0&&sy<brand.height&&brand.pixels[sy][sx]==='1'){const v=dark?255:0;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 }
 return data;
}
function png(size,options){const raw=pixels(size,options),scan=Buffer.alloc((size*4+1)*size),head=Buffer.alloc(13);for(let y=0;y<size;y++)raw.copy(scan,y*(size*4+1)+1,y*size*4,(y+1)*size*4);head.writeUInt32BE(size);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);}
function build(){
 const original=Buffer.from(brand.sourcePNG,'base64');if(crypto.createHash('sha256').update(original).digest('hex')!==brand.sourceSHA256)throw Error('Owner mouse source hash mismatch');
 fs.mkdirSync(path.join(__dirname,'icons'),{recursive:true});
 for(const dark of [false,true])fs.writeFileSync(path.join(__dirname,'icons/mouse-browser-'+(dark?'dark':'light')+'.png'),png(1024,{dark,app:true}));
 fs.writeFileSync(path.join(__dirname,'quadro/brand.png'),png(64));
 fs.writeFileSync(path.join(__dirname,'quadro/brand-dark.png'),png(64,{dark:true}));
 fs.writeFileSync(path.join(__dirname,'quadro/mouse-original.png'),original);
}
if(require.main===module)build();module.exports={png,pixels,build};
