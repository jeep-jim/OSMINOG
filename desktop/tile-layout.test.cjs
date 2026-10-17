'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{arrange,overlap}=require('./tile-layout.js');
function valid(items,width){for(const a of items){assert(a.x>=0&&a.x+a.w<=width+.01);for(const b of items)if(a!==b)assert(!overlap(a,b),JSON.stringify([a,b]))}}
test('old overlapping layouts migrate without hiding any pane',()=>{const items=Array.from({length:12},(_,i)=>({key:String(i),x:0,y:0,w:400,h:300}));const r=arrange(items,1000);valid(r,1000);assert.equal(r.length,12);assert.deepEqual(arrange(r,1000),r)});
test('dragged pane snaps to adjacent edge and leaves neighbours fixed',()=>{const a={key:'a',x:0,y:0,w:400,h:300},b={key:'b',x:430,y:7,w:400,h:300};const r=arrange([a,b],1000,'b');assert.deepEqual(r[0],a);assert.equal(r[1].x,412);assert.equal(r[1].y,0);valid(r,1000)});
test('resize collision relocates only edited pane; viewport shrink stays in bounds',()=>{const items=[{key:'a',x:0,y:0,w:700,h:400},{key:'b',x:512,y:0,w:488,h:400}];const r=arrange(items,1000,'a');assert.deepEqual(r[1],items[1]);valid(r,1000);valid(arrange(r,450),450)});
test('many placements and repeated resizes never overlap or create horizontal overflow',()=>{let items=Array.from({length:25},(_,i)=>({key:String(i),x:(i*37)%1200,y:(i*81)%800,w:220+i*13,h:160+i*5}));for(let i=0;i<30;i++){const width=700+i*11;items=arrange(items,width,String(i%25));valid(items,width)}});

test('resize stops at adjacent boundaries and never shifts the window',()=>{const {resize}=require('./tile-layout.js'),r={x:0,y:0,w:400,h:300},others=[{x:412,y:0,w:400,h:300},{x:0,y:312,w:400,h:300}];assert.deepEqual(resize(r,600,500,others,1000),{w:400,h:300});assert.deepEqual(resize(r,300,200,others,1000),{w:300,h:200})});
