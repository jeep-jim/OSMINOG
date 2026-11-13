'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const size=1024,raw=Buffer.alloc(size*(size*4+1));
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=y*(size*4+1)+1+x*4;const inside=x>=64&&x<960&&y>=64&&y<960;if(!inside)continue;let c=[35,72,160,255];const col=x<500?0:1,row=y<500?0:1;const left=col?530:176,top=row?530:176;if(x>=left&&x<left+318&&y>=top&&y<top+318)c=[240,246,255,255];raw.set(c,p)}
function crc(b){let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),s=Buffer.alloc(4),c=Buffer.alloc(4);s.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([s,t,data,c])}
const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;fs.mkdirSync(path.join(__dirname,'icons'),{recursive:true});fs.writeFileSync(path.join(__dirname,'icons/quadro-browser.png'),Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
