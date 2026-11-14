'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const brand=require('./mouse-brand.cjs'),{pixels,orientPrivateSVG}=require('./quadro-icon.cjs');
test('approved mouse is an exact horizontal reflection, with tail on the left in BOTH themes',()=>{
 assert.equal(brand.pixels[29],'0000000000000001111111');
 for(const app of [false,true])for(const dark of [false,true])for(const size of [64,1024]){
  const data=pixels(size,{app,dark}),scale=Math.max(1,Math.floor(size*(app?.68:.90)/30));
  const left=Math.floor((size-22*scale)/2),top=Math.floor((size-30*scale)/2);
  let count=0;
  for(let y=0;y<30;y++)for(let x=0;x<22;x++){
   const i=((top+y*scale)*size+left+x*scale)*4;
   const ink=data[i+3]===255&&data[i]===(dark?255:0);
   assert.equal(ink,brand.pixels[y][21-x]==='1',`${size}/${app}/${dark} at ${x},${y}`);
   if(ink)count++;
  }
  assert.equal(count,175,'no pixels invented or removed');
  const tail=x=>data[((top+29*scale)*size+left+x*scale)*4];
  assert.equal(tail(0),dark?255:0);
  assert.notEqual(data[((top+29*scale)*size+left+21*scale)*4+3]===255&&tail(21)===(dark?255:0),true);
 }
});
test('private mascot uses uniform square pixels on 47x64 grid, unchanged silhouette and idempotent orientation',()=>{
 const svg=fs.readFileSync('quadro/mouse-private.svg','utf8');
 assert.equal(orientPrivateSVG(svg),svg,'already approved art cannot be flipped again');
 assert.equal((svg.match(/id="mouse-approved-left"/g)||[]).length,1);
 assert.match(svg,/viewBox="0 0 47 64"/);assert.doesNotMatch(svg,/transform=|filter=/);
 const body=svg.match(/<g id="mouse-approved-left"><path fill="#ffffff" d="([^"]+)"/)[1];
 const mask=Array.from({length:64},()=>Array(47).fill(false));
 const segments=[...body.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)];assert.equal(segments.map(m=>m[0]).join(''),body);
 for(const m of segments){const [x,y,w,h]=m.slice(1).map(Number);assert.ok(x+w<=47&&y+h<=64);assert.equal(w,2);assert.equal(h,2);for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)mask[j][i]=true;}
 for(let y=0;y<64;y++)for(let x=0;x<47;x++)assert.equal(mask[y][x],(x<44&&y<60&&brand.pixels[Math.floor(y/2)][21-Math.floor(x/2)]==='1'),`private source silhouette ${x},${y}`);
 assert.match(svg,/id="owner-pixel-glasses"/);assert.match(svg,/fill="#000000"/);assert.match(svg,/fill="#ffffff"/);
});
