'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const moduleFixture={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-629-ui-smoke.cjs'),'utf8'),{module:moduleFixture,exports:moduleFixture.exports,require:id=>id==='electron'||id==='./mouse-628-ui-smoke.cjs'?{}:require(id)},{filename:'mouse-629-ui-smoke.cjs'});
const {validateFixtureControls,parkPointerForPixels}=moduleFixture.exports;
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

function pointerScene({stuckCursor=false,stuckState='',nativeReply={warpResult:0,postAccess:true}}={}){
 const calls=[],receipt={},workArea={x:0,y:0,width:1440,height:860},windowBounds={x:8,y:8,width:1424,height:844};
 let cursor={x:1037,y:793},moved=false;
 const dividers=()=>Array.from({length:6},(_,i)=>({hovered:i===5&&(!moved||stuckState==='hovered'),focused:i===5&&stuckState==='focused',dragging:i===5&&stuckState==='dragging'}));
 const args={receipt,workArea,windowBounds,readCursor:()=>({...cursor}),readDividers:async()=>dividers(),
  native:{testPointer:async(x,y)=>{calls.push({type:'native-pointer',x,y});moved=true;if(!stuckCursor)cursor={x,y};return nativeReply;}},
  waitFor:async(fn,label)=>{if(!await fn())throw Error(label);},painted:async()=>{calls.push({type:'painted'});}};
 return{args,calls,receipt};
}

test('native pointer parking preserves the actual Windows hover witness before unchanged rest pixels',async()=>{
 const fixture=pointerScene();await parkPointerForPixels(fixture.args);
 assert.deepEqual(fixture.calls,[{type:'native-pointer',x:2,y:2},{type:'painted'}]);
 assert.deepEqual(fixture.receipt.before.cursor,{x:1037,y:793});assert.equal(fixture.receipt.before.dividers[5].hovered,true);
 assert.deepEqual(fixture.receipt.after.cursor,{x:2,y:2});assert.equal(fixture.receipt.after.dividers.some(row=>row.hovered||row.focused||row.dragging),false);
});

test('driver acknowledgement cannot replace actual cursor and divider state readback',async()=>{
 for(const options of [{stuckCursor:true},{stuckState:'hovered'},{stuckState:'focused'},{stuckState:'dragging'}]){
  const fixture=pointerScene(options);await assert.rejects(parkPointerForPixels(fixture.args),/native pointer leaves every divider/);
  assert.equal(fixture.calls.some(row=>row.type==='painted'),false);
 }
 for(const nativeReply of [{warpResult:1,postAccess:true},{warpResult:0,postAccess:false}]){
  const fixture=pointerScene({nativeReply});await assert.rejects(parkPointerForPixels(fixture.args));
  assert.equal(fixture.calls.some(row=>row.type==='painted'),false);
 }
});

test('parking refuses to move inside a fullscreen fixture or mutate its interaction state',async()=>{
 const fixture=pointerScene();fixture.args.windowBounds={...fixture.args.workArea};
 await assert.rejects(parkPointerForPixels(fixture.args),/outside the fixture window/);assert.deepEqual(fixture.calls,[]);
});
