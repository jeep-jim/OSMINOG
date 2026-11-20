'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const moduleFixture={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-629-ui-smoke.cjs'),'utf8'),{module:moduleFixture,exports:moduleFixture.exports,require:id=>id==='electron'||id==='./mouse-628-ui-smoke.cjs'?{}:require(id)},{filename:'mouse-629-ui-smoke.cjs'});
const {validateFixtureControls}=moduleFixture.exports;
function geometry(width=531,height=77){return{viewport:{width,height},title:{x:12,y:6,width:width-24,height:18},input:{x:12,y:28,width:Math.min(160,width-24),height:20}};}
function scene(factor=1,width=531,height=77){const bounds={x:0,y:557,width:width*factor,height:height*factor};return{bounds,points:[{point:{x:20,y:bounds.y+bounds.height-3}},{point:{x:bounds.width-20,y:bounds.y+bounds.height-3}}]};}

test('small owned fixture viewports keep the unchanged native bottom probes clear at each zoom',()=>{
 for(const factor of [.5,1,2])for(const width of [96,531]){const value=geometry(width),before=structuredClone(value),{bounds,points}=scene(factor,width);assert.equal(validateFixtureControls(value,bounds,points,factor),true);assert.deepEqual(value,before);}
});

test('the actual 77-pixel viewport cannot accept a control extending into its bottom witness zone',()=>{
 // The archived Mac12 viewport and legacy probe are real; this controlled
 // rectangle models the overlapping input rather than inventing a DOM readback.
 const value=geometry(),{bounds,points}=scene();value.input={x:12,y:62,width:152,height:20};
 assert.throws(()=>validateFixtureControls(value,bounds,points,1),/fixture input remains above the bottom pixel witness zone/);
 const compact=geometry();assert.throws(()=>validateFixtureControls(compact,bounds,[{point:{x:20,y:587}}],1),/does not cover the unchanged native page-interior probe/);
});
