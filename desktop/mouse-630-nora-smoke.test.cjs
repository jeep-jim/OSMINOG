'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assertSevenPaneGeometry}=require('./mouse-630-nora-smoke.cjs').fixtures;

function capturedWindowsGeometry(){
 // Actual 971px seven-pane geometry from Windows run 45146717879. Native
 // roots matched every DOM endpoint; the obsolete fractional precondition failed.
 const rows=[[0,74,197,237],[0,345,197,270],[203,74,308,541],[0,649,511,97],[517,74,184,444],[517,552,184,194],[707,74,264,672]];
 const slots=rows.map(([x,y,width,height],i)=>({id:'owned-'+i,x,y,width,height}));
 return{slots,pages:slots.map(({id,...bounds})=>({id,bounds:{...bounds}}))};
}

test('Mouse638 accepts the seven actual Windows integer DOM/native rectangles with its explicit contract',()=>{
 assert.equal(assertSevenPaneGeometry(capturedWindowsGeometry(),'6.0.42'),'integer-dom-native-endpoints-638');
});

test('Mouse638 rejects fractional coordinates and sizes even when rounded native bounds still match',()=>{
 for(const key of ['x','y','width','height']){
  const before=capturedWindowsGeometry();before.slots[0][key]+=.125;
  assert.throws(()=>assertSevenPaneGeometry(before,'6.0.42'),/integer DIPs/);
 }
 for(const value of [NaN,Infinity]){const before=capturedWindowsGeometry();before.slots[0].x=value;assert.throws(()=>assertSevenPaneGeometry(before,'6.0.42'),/integer DIPs/);}
 for(const value of [0,-1]){const before=capturedWindowsGeometry();before.slots[0].height=value;assert.throws(()=>assertSevenPaneGeometry(before,'6.0.42'),/integer DIPs/);}
});

test('Mouse638 rejects missing or duplicate ownership and a one-pixel actual native mismatch',()=>{
 for(const mutate of [b=>b.slots.pop(),b=>b.pages.pop(),b=>b.slots[1].id=b.slots[0].id,b=>b.pages[1].id=b.pages[0].id,b=>b.pages[0].id='another-page',b=>b.pages[0].bounds.width++]){
  const before=capturedWindowsGeometry();mutate(before);assert.throws(()=>assertSevenPaneGeometry(before,'6.0.42'));
 }
});

test('previous releases retain their fractional endpoint mismatch precondition without a Mouse638 receipt',()=>{
 const before=capturedWindowsGeometry();before.slots[0].x=.4;before.slots[0].width=197.4;before.pages[0].bounds.width=198;
 assert.equal(Math.round(before.slots[0].width),197);assert.equal(before.pages[0].bounds.width,198);
 for(const version of ['6.0.30','6.0.37']){
  assert.equal(assertSevenPaneGeometry(before,version),null);
  assert.throws(()=>assertSevenPaneGeometry(capturedWindowsGeometry(),version),/endpoint\/independent-span mismatch/);
 }
 assert.throws(()=>assertSevenPaneGeometry(before,'6.0.42'),/integer DIPs/);
});
