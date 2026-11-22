'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {currentFooterControls}=require('./mouse-compact-smoke.cjs');
const zeroBounds=()=>({x:0,right:0,y:0,bottom:0,w:0,h:0});
const mediaWidget=()=>({id:'mouse-media-widget',count:1,parentId:'statusbar',directChild:true,hidden:true,mode:'hidden',room:'full',display:'none',bounds:zeroBounds()});
const rows=()=>[
 {id:'layout-select',hidden:true,w:0,h:0,hit:false},
 {id:'layout-menu-button',hidden:false,w:54,h:22,hit:true},
 {id:'desktops-button',hidden:false,w:36,h:23,hit:true},
 {id:'settings-button',hidden:false,w:25,h:22,hit:true},
 ...['toggle','return','dismiss'].map(mediaAction=>({id:'',tag:'BUTTON',hidden:false,mediaAction,mediaWidget:mediaWidget(),...zeroBounds(),hit:false}))
];
test('compact footer excludes only the witnessed inactive media buttons and canonical select without mutating evidence',()=>{
 const input=rows(),before=structuredClone(input),actual=currentFooterControls(input);assert.deepEqual(actual,input.slice(1,4));assert.deepEqual(input,before);
 const otherHidden={id:'settings-hidden-regression',hidden:true,w:0,h:0,hit:false};input.push(otherHidden);assert.ok(currentFooterControls(input).includes(otherHidden),'Unrelated hidden controls must still reach the geometry assertions');
});
test('active full and compact media controls remain subject to the existing footer geometry checks',()=>{
 for(const mode of ['full','compact']){
  const input=rows();
  for(const row of input.slice(4)){
   Object.assign(row.mediaWidget,{hidden:false,mode,display:'flex',bounds:{x:750,right:870,y:875,bottom:897,w:120,h:22}});
   Object.assign(row,{x:755,right:775,y:877,bottom:895,w:20,h:18,hit:true});
  }
  assert.deepEqual(currentFooterControls(input),input.slice(1));
  Object.assign(input[6],zeroBounds(),{hit:false});
  assert.ok(currentFooterControls(input).includes(input[6]),'An active-widget zero-size child is never silently excluded');
 }
});
test('inactive-media exclusion rejects missing, duplicate and unknown button actions',()=>{
 for(const mutate of [
  input=>input.pop(),input=>input.splice(4),input=>input.push(structuredClone(input[4])),
  input=>{input[6].mediaAction='toggle';},input=>{input[6].mediaAction='seek';},input=>{delete input[6].mediaAction;}
 ]){const input=rows();mutate(input);assert.throws(()=>currentFooterControls(input));}
});
test('inactive-media exclusion requires semantic buttons and their exact unique direct footer ancestor',()=>{
 for(const patch of [{id:'another-widget'},{count:0},{count:2},{parentId:'toolbar'},{directChild:false}]){
  const input=rows();for(const row of input.slice(4))Object.assign(row.mediaWidget,patch);assert.throws(()=>currentFooterControls(input));
 }
 for(const patch of [{tag:'SELECT'},{mediaWidget:null},{mediaWidget:undefined}]){
  const input=rows();Object.assign(input[4],patch);assert.throws(()=>currentFooterControls(input));
 }
 const inconsistent=rows();inconsistent[6].mediaWidget.room='buttons';assert.throws(()=>currentFooterControls(inconsistent));
});
test('inactive-media exclusion requires explicit hidden mode, computed hiding and a recorded room',()=>{
 for(const patch of [{hidden:false},{hidden:undefined},{mode:'full'},{mode:'compact'},{mode:'unknown'},{mode:undefined},{display:'flex'},{display:undefined},{room:'unknown'},{room:undefined}]){
  const input=rows();for(const row of input.slice(4))Object.assign(row.mediaWidget,patch);assert.throws(()=>currentFooterControls(input));
 }
});
test('inactive-media exclusion rejects nonzero or missing widget and child bounds and any possible child hit',()=>{
 for(const key of Object.keys(zeroBounds())){
  const child=rows();child[4][key]=1;assert.throws(()=>currentFooterControls(child));
  const widget=rows();for(const row of widget.slice(4))row.mediaWidget.bounds[key]=1;assert.throws(()=>currentFooterControls(widget));
 }
 for(const patch of [{hit:true},{hit:undefined},{w:undefined}]){const input=rows();Object.assign(input[4],patch);assert.throws(()=>currentFooterControls(input));}
 const missing=rows();for(const row of missing.slice(4))delete row.mediaWidget.bounds;assert.throws(()=>currentFooterControls(missing));
});
test('compact footer cannot pass with a missing, hidden or covered native layout-menu button',()=>{
 for(const patch of [{w:0},{h:0},{hit:false}]){const input=rows();Object.assign(input[1],patch);assert.throws(()=>currentFooterControls(input));}
 assert.throws(()=>currentFooterControls(rows().filter(row=>row.id!=='layout-menu-button')));
 assert.throws(()=>currentFooterControls([...rows(),{...rows()[1]}]));
});
test('compatibility-select exclusion requires its explicit hidden flag and actual zero bounds',()=>{
 for(const patch of [{hidden:false},{w:40},{h:22},{hit:true}]){const input=rows();Object.assign(input[0],patch);assert.throws(()=>currentFooterControls(input));}
 assert.throws(()=>currentFooterControls(rows().slice(1)));
 assert.throws(()=>currentFooterControls([...rows(),{...rows()[0]}]));
});
