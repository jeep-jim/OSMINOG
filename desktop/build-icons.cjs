'use strict';
// Vector master + deterministic, dependency-free PNG/ICO build for every release.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const out=path.join(__dirname,'icons');fs.mkdirSync(out,{recursive:true});
// Temporary Trader OS mark: an angular market gateway with a candlestick T.
// It intentionally avoids the previous eye/octopus identity and can be replaced
// without changing the stable Windows application/profile identity.
const svg=fs.readFileSync(path.join(__dirname,'..','brand','trader-os-mark.svg'),'utf8');
fs.writeFileSync(path.join(out,'trader-os.svg'),svg);
function crc(buf){let n=0xffffffff;for(const b of buf){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0}
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,c])}
function inside(x,y,l,t,w,h,r){const dx=Math.max(l+r-x,0,x-(l+w-r)),dy=Math.max(t+r-y,0,y-(t+h-r));return x>=l&&x<=l+w&&y>=t&&y<=t+h&&dx*dx+dy*dy<=r*r}
function diamond(x,y,r){return Math.abs(x-128)+Math.abs(y-128)<=r}
function png(size){const raw=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)for(let x=0;x<size;x++){const total=[0,0,0,0];for(let j=0;j<4;j++)for(let i=0;i<4;i++){const X=(x+(i+.5)/4)*256/size,Y=(y+(j+.5)/4)*256/size;let c=inside(X,Y,12,12,232,232,42)?[11,15,21,255]:[0,0,0,0];if(diamond(X,Y,106)&&!diamond(X,Y,92))c=[93,124,255,255];if(X>=66&&X<=190&&Y>=70&&Y<=102||X>=110&&X<=146&&Y>=70&&Y<=194)c=[244,247,251,255];if((X>=81&&X<=89&&Y>=128&&Y<=171)||(X>=74&&X<=96&&Y>=142&&Y<=150))c=[18,201,155,255];if((X>=170&&X<=178&&Y>=116&&Y<=159)||(X>=163&&X<=185&&Y>=130&&Y<=138))c=[255,94,103,255];for(let k=0;k<4;k++)total[k]+=c[k]}const a=total[3]/16,p=y*(size*4+1)+1+x*4;for(let k=0;k<3;k++)raw[p+k]=a?Math.round(total[k]/16*255/a):0;raw[p+3]=Math.round(a)}const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
const sizes=[16,20,24,32,48,64,128,256],images=sizes.map(png),head=Buffer.alloc(6+sizes.length*16);head.writeUInt16LE(1,2);head.writeUInt16LE(sizes.length,4);let offset=head.length;images.forEach((img,i)=>{const p=6+i*16;head[p]=head[p+1]=sizes[i]===256?0:sizes[i];head.writeUInt16LE(1,p+4);head.writeUInt16LE(32,p+6);head.writeUInt32LE(img.length,p+8);head.writeUInt32LE(offset,p+12);offset+=img.length});fs.writeFileSync(path.join(out,'trader-os.ico'),Buffer.concat([head,...images]));fs.writeFileSync(path.join(out,'trader-os.png'),images.at(-1));


module.exports={png,svg};
