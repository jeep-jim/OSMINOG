'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {colorBounds,METER_RGB,assertRetained}=require('./mouse-633-smoke-helpers.cjs');
test('native BGRA probe measures a physical pixel rectangle and rejects unrelated pixels',()=>{
 const width=80,height=50,bitmap=Buffer.alloc(width*height*4,255);for(let y=11;y<31;y++)for(let x=7;x<47;x++){const i=(y*width+x)*4;bitmap[i]=METER_RGB[2];bitmap[i+1]=METER_RGB[1];bitmap[i+2]=METER_RGB[0];}
 assert.deepEqual(colorBounds(bitmap,width,height),{x:7,y:11,width:40,height:20,count:800});assert.equal(colorBounds(Buffer.alloc(width*height*4),width,height),null);assert.throws(()=>colorBounds(Buffer.alloc(5),width,height));
});
test('live-page evidence fails on document replacement or stopped RAF and permits intentional zoom scroll movement only explicitly',()=>{
 const before={id:'a',index:0,desk:'d',webContentsId:1,url:'http://127.0.0.1/',navigationEpoch:1,identity:'owned',timeOrigin:4,field:'saved',cookie:'fixture',scrollX:0,scrollY:130,ticks:5,raf:9};
 assertRetained(before,{...before,raf:10},{advancing:true});assert.throws(()=>assertRetained(before,{...before,identity:'new',raf:10}));assert.throws(()=>assertRetained(before,{...before},{advancing:true}));assert.throws(()=>assertRetained(before,{...before,scrollY:120}));assertRetained(before,{...before,scrollY:120,raf:10},{scroll:false,advancing:true});
});
