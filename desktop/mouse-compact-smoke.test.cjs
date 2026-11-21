'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {currentFooterControls}=require('./mouse-compact-smoke.cjs');
const rows=()=>[
 {id:'layout-select',hidden:true,w:0,h:0,hit:false},
 {id:'layout-menu-button',hidden:false,w:54,h:22,hit:true},
 {id:'desktops-button',hidden:false,w:36,h:23,hit:true},
 {id:'settings-button',hidden:false,w:25,h:22,hit:true}
];
test('compact footer checks exclude only the hidden canonical select and retain all visible controls',()=>{
 const input=rows(),actual=currentFooterControls(input);assert.deepEqual(actual,input.slice(1));assert.equal(input.length,4);
 const otherHidden={id:'settings-hidden-regression',hidden:true,w:0,h:0,hit:false};input.push(otherHidden);assert.ok(currentFooterControls(input).includes(otherHidden),'Unrelated hidden controls must still reach the geometry assertions');
});
test('compact footer cannot pass with a missing, hidden or covered native layout-menu button',()=>{
 for(const patch of [{w:0},{h:0},{hit:false}]){const input=rows();Object.assign(input[1],patch);assert.throws(()=>currentFooterControls(input));}
 assert.throws(()=>currentFooterControls(rows().filter(row=>row.id!=='layout-menu-button')));
 assert.throws(()=>currentFooterControls([...rows(),{...rows()[1]}]));
});
test('compatibility-select exclusion requires its explicit hidden flag and actual zero bounds',()=>{
 for(const patch of [{hidden:false},{w:40},{h:22},{hit:true}]){const input=rows();Object.assign(input[0],patch);assert.throws(()=>currentFooterControls(input));}
 assert.throws(()=>currentFooterControls(rows().slice(1)));
});
