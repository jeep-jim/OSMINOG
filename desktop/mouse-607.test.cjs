'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const head=require('./mouse/mouse-head.json'),{pixels,orientPrivateSVG}=require('./mouse-icon.cjs');
test('owner620 replaces the tail with the exact 128-cell head in both app icon themes',()=>{
 for(const dark of [false,true])for(const app of [false,true]){const size=1024,data=pixels(size,{dark,app}),scale=Math.max(1,Math.floor(size*(app?.68:.90)/19)),left=Math.floor((size-19*scale)/2),top=Math.floor((size-17*scale)/2),rows=[];
 for(let y=0;y<17;y++){let row='';for(let x=0;x<19;x++){const i=((top+y*scale+Math.floor(scale/2))*size+left+x*scale+Math.floor(scale/2))*4;row+=data[i+3]>250&&(dark?data[i]>250:data[i]<5)?'1':'0';}rows.push(row);}assert.deepEqual(rows,head.pixels);
 }
});
test('private head has exact body cells and straight purple glasses; no tail or duplicate transform',()=>{
 const svg=fs.readFileSync('mouse/mouse-private.svg','utf8');assert.equal(orientPrivateSVG(svg),svg);assert.match(svg,/viewBox="0 0 19 17"/);assert.doesNotMatch(svg,/transform=|filter=/);
 const body=svg.match(/id="mouse-owner-head"><path fill="#ffffff" d="([^"]+)"/)[1],actual=[...body.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(m=>[+m[1],+m[2]]),expected=head.pixels.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='1'?[[x,y]]:[]));assert.deepEqual(actual,expected);assert.equal(actual.length,128);assert.match(svg,/id="owner-pixel-glasses"/);assert.match(svg,/fill="#a855f7"/);
});
