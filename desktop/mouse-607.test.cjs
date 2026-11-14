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
test('private mascot and its glasses are reflected together exactly once',()=>{
 const svg=fs.readFileSync('quadro/mouse-private.svg','utf8');
 const result=orientPrivateSVG(svg);
 assert.equal((result.match(/id="mouse-approved-left"/g)||[]).length,1);
 assert.match(result,/transform="translate\(44 0\) scale\(-1 1\)"/);
 assert.equal(orientPrivateSVG(result),result,'rebuild cannot flip the mouse back');
 const strip=s=>s.replace('<g id="mouse-approved-left" transform="translate(44 0) scale(-1 1)">','').replace('</g></svg>','</svg>');
 assert.equal(strip(result),svg.includes('mouse-approved-left')?strip(svg):svg);
});
