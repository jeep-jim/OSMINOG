'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sectors,progress}=require('./mouse/update-burrow.js');
function inside(x,y,row){const dx=x-300,dy=y-300,radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;return radius>=238&&radius<=296&&angle>=row.right&&angle<=row.left;}
test('every visible annular action has an actual centre or quartile native hit in compact and full-size circles',()=>{
 for(const count of [1,2,3,4])for(const size of [304,352,400,600]){
  const rows=sectors(count),scale=size/600;assert.equal(rows.length,count);
  for(const row of rows){
   assert.ok(row.x>=0&&row.y>=0&&row.x+row.width<=600&&row.y+row.height<=600);
   let hit=false;for(const xf of [.5,.25,.75])for(const yf of [.5,.25,.75]){
    const x=Math.round((row.x+row.width*xf)*scale)/scale,y=Math.round((row.y+row.height*yf)*scale)/scale;if(inside(x,y,row))hit=true;
   }
   assert.equal(hit,true,`${count} actions, ${size}px circle has a hit-tested sector`);
   const middle=(row.left+row.right)/2*Math.PI/180,x=300+269*Math.cos(middle),y=300+269*Math.sin(middle);
   assert.equal(rows.filter(value=>inside(x,y,value)).length,1,'Sibling action regions never cover the same label');
  }
 }
 assert.deepEqual(sectors(0),[]);assert.deepEqual(sectors(5),[]);
});
test('the ring follows downloader percent and preserves indeterminate checking and completed states',()=>{
 assert.deepEqual(progress({phase:'downloading',percent:37.5}),{percent:37.5,indeterminate:false,busy:true});
 assert.deepEqual(progress({phase:'checking',percent:83}),{percent:0,indeterminate:true,busy:true});
 for(const phase of ['ready','opened','installing'])assert.equal(progress({phase,percent:2}).percent,100);
 for(const phase of ['idle','current','available','error'])assert.deepEqual(progress({phase,percent:80}),{percent:0,indeterminate:false,busy:false});
 for(const [percent,expected]of [[-1,0],[150,100],[NaN,0],[Infinity,0]])assert.equal(progress({phase:'downloading',percent}).percent,expected);
});
