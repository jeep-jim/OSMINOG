'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {zoomPresentation,presentationSettled}=require('./mouse-637-zoom-smoke.cjs');
const {colorBounds,METER_RGB}=require('./mouse-633-smoke-helpers.cjs');
function bitmap(color){
 const width=180,height=80,pixels=Buffer.alloc(width*height*4,255);
 for(let y=20;y<60;y++)for(let x=24;x<152;x++){const i=(y*width+x)*4;pixels[i]=color[2];pixels[i+1]=color[1];pixels[i+2]=color[0];}
 return{pixels,width,height};
}
function bounds(image,presentation){return colorBounds(image.pixels,image.width,image.height,presentation.expectedRGB);}
test('637 settings zoom finds the requested composite and retains the original physical meter bounds',()=>{
 const presentation=zoomPresentation('6.0.45','settings'),image=bitmap([202,34,133]);
 assert.deepEqual(presentation,{kind:'settings',dimmed:true,expectedRGB:[202,34,133]});
 assert.deepEqual(METER_RGB,[235,40,155]);
 assert.equal(colorBounds(image.pixels,image.width,image.height),null,'The previous predicate reproduces the native failure');
 assert.deepEqual(bounds(image,presentation),{x:24,y:20,width:128,height:40,count:5120});
 assert.equal(bounds(bitmap(METER_RGB),presentation),null,'Missing requested dim fails');
 assert.equal(bounds(bitmap([199,34,133]),presentation),null,'The original RGB tolerance of two is unchanged');
});
test('popover and prior636 retain the undimmed predicate and reject a stale sidebar layer',()=>{
 for(const [version,kind]of [['6.0.45','popover'],['6.0.36','settings'],['6.0.36','popover']]){
  const presentation=zoomPresentation(version,kind);
  assert.equal(presentation.dimmed,false);
  assert.deepEqual(bounds(bitmap(METER_RGB),presentation),{x:24,y:20,width:128,height:40,count:5120});
  assert.equal(bounds(bitmap([202,34,133]),presentation),null);
 }
 assert.throws(()=>zoomPresentation('6.0.45','unrecognized'),'Unknown controls cannot select a relaxed palette');
});
test('capture waits for both native pages to finish the expected sidebar presentation',()=>{
 for(const enabled of [true,false]){
  const state={requested:enabled,applied:enabled,pending:false,error:''};
  assert.equal(presentationSettled([state,{...state}],enabled),true);
  for(const changed of [{requested:!enabled},{applied:!enabled},{applied:null},{pending:true},{error:'SIDEBAR_DIM_FAILED'}])assert.equal(presentationSettled([state,{...state,...changed}],enabled),false);
 }
 assert.equal(presentationSettled([],false),false);
 assert.equal(presentationSettled([null],false),false);
});
