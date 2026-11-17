'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const head=require('./mouse/mouse-head.json'),{pixels,orientPrivateSVG}=require('./mouse-icon.cjs');
test('owner620 replaces the tail with the exact 128-cell head in both app icon themes',()=>{
 for(const dark of [false,true])for(const app of [false,true]){const size=1024,data=pixels(size,{dark,app}),scale=Math.max(1,Math.floor(size*(app?.68:.90)/19)),left=Math.floor((size-19*scale)/2),top=Math.floor((size-17*scale)/2),rows=[];
 for(let y=0;y<17;y++){let row='';for(let x=0;x<19;x++){const i=((top+y*scale+Math.floor(scale/2))*size+left+x*scale+Math.floor(scale/2))*4;row+=data[i+3]>250&&(dark?data[i]>250:data[i]<5)?'1':'0';}rows.push(row);}assert.deepEqual(rows,head.pixels);
 }
});
test('owner621 restores the exact approved619 private drawing and glasses, leaving ordinary Dock head intact',()=>{
 const svg=fs.readFileSync('mouse/mouse-private.svg','utf8');assert.equal(orientPrivateSVG(svg),svg);assert.match(svg,/viewBox="0 0 47 64"/);
 const bytes=Buffer.from(svg),hash=require('node:crypto').createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');assert.equal(hash,'3391c3bd30fb0ee516654d0c4796018bf7dc809d');
 assert.match(svg,/id="mouse-approved-left"/);assert.match(svg,/id="owner-pixel-glasses" transform="translate\(-1 0\)"/);assert.match(svg,/fill="#a855f7"/);
});
