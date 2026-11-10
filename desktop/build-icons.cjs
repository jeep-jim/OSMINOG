'use strict';
// Vector master + deterministic, dependency-free PNG/ICO build for every release.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const out=path.join(__dirname,'icons');fs.mkdirSync(out,{recursive:true});
// Existing MargelET brand pictogram, reused as the Trader OS product mark.
// Keep the public brand colors and five-by-five modular geometry in sync with
// brand/trader-os-mark.svg without changing the stable Windows app identity.
const svg=fs.readFileSync(path.join(__dirname,'..','brand','trader-os-mark.svg'),'utf8');
fs.writeFileSync(path.join(out,'trader-os.svg'),svg);
function crc(buf){let n=0xffffffff;for(const b of buf){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,c])}
const green=new Set(['0:1','0:2','0:3','1:2','3:2','4:1','4:2','4:3']);
const red=new Set(['1:0','1:4','2:0','2:1','2:3','2:4','3:0','3:4']);
function mark(x,y,origin,cell){const col=Math.floor((x-origin)/cell),row=Math.floor((y-origin)/cell),key=`${row}:${col}`;if(row<0||row>4||col<0||col>4)return[0,0,0,0];if(green.has(key))return[85,212,143,255];if(red.has(key))return[249,105,124,255];return[0,0,0,0]}
function png(size){const cell=Math.max(2,Math.round(size/6.4)),origin=Math.round((size-cell*5)/2),raw=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)for(let x=0;x<size;x++){const total=[0,0,0,0];for(let j=0;j<4;j++)for(let i=0;i<4;i++){const c=mark(x+(i+.5)/4,y+(j+.5)/4,origin,cell);for(let k=0;k<4;k++)total[k]+=c[k]}const a=total[3]/16,p=y*(size*4+1)+1+x*4;for(let k=0;k<3;k++)raw[p+k]=a?Math.round(total[k]/16*255/a):0;raw[p+3]=Math.round(a)}const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
const sizes=[16,20,24,32,48,64,128,256],images=sizes.map(png),head=Buffer.alloc(6+sizes.length*16);head.writeUInt16LE(1,2);head.writeUInt16LE(sizes.length,4);let offset=head.length;images.forEach((img,i)=>{const p=6+i*16;head[p]=head[p+1]=sizes[i]===256?0:sizes[i];head.writeUInt16LE(1,p+4);head.writeUInt16LE(32,p+6);head.writeUInt32LE(img.length,p+8);head.writeUInt32LE(offset,p+12);offset+=img.length});fs.writeFileSync(path.join(out,'trader-os.ico'),Buffer.concat([head,...images]));fs.writeFileSync(path.join(out,'trader-os.png'),images.at(-1));


module.exports={png,svg};
