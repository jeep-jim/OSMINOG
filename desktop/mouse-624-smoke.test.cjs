'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helpers={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-631-smoke-helpers.cjs'),'utf8'),{module:helpers,require:name=>name.startsWith('node:')?require(name):{},setTimeout,clearTimeout});
const smoke={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-624-smoke.cjs'),'utf8'),{module:smoke,require:name=>name.startsWith('node:')?require(name):name==='./mouse-631-smoke-helpers.cjs'?helpers.exports:name==='./mouse-smoke-hit-target.cjs'?require(name):{}});
const bounds={x:8,y:33,width:1008,height:668};
const readySample=()=>({leftFullscreen:true,fullscreen:false,maximized:false,bounds:{...bounds},renderer:{focusPane:'',focusAI:false,settingsOpen:true,dialog:{open:true,hidden:false}}});
test('624 settings rejects renderer-ready states until the native fullscreen exit and restored bounds agree',()=>{
 const changes=[s=>{s.leftFullscreen=false;},s=>{s.fullscreen=true;},s=>{s.maximized=true;},s=>{s.bounds={x:0,y:0,width:1024,height:768};},s=>{s.bounds.x++;},s=>{s.bounds.y++;},s=>{s.bounds.width++;},s=>{s.bounds.height++;},s=>{s.renderer.focusPane='p3';},s=>{s.renderer.focusAI=true;},s=>{s.renderer.settingsOpen=false;},s=>{s.renderer.dialog.open=false;},s=>{s.renderer.dialog.hidden=true;}];
 for(const change of changes){const barrier=smoke.exports.settingsRestoreBarrier(bounds),sample=readySample();change(sample);for(let i=0;i<8;i++){const state=barrier(sample);assert.equal(state.ready,false);assert.equal(state.stable,0);}}
});
test('624 settings needs six consecutive restored observations and restarts the count when native geometry moves',()=>{
 const barrier=smoke.exports.settingsRestoreBarrier(bounds);
 for(let i=1;i<6;i++){const state=barrier(readySample());assert.equal(state.ready,false);assert.equal(state.stable,i);}
 const moving=readySample();moving.bounds.width=1024;const reset=barrier(moving);assert.equal(reset.ready,false);assert.equal(reset.stable,0);
 for(let i=1;i<=6;i++){const state=barrier(readySample());assert.equal(state.ready,i===6);assert.equal(state.stable,i);}
 const stale=readySample();stale.renderer.focusPane='p3';assert.equal(barrier(stale).ready,false);
});
test('624 failed diagnostic read/write retains the original input error, while required success proof errors reject',async()=>{
 const original=Error('actual native click failed'),write=Error('proof write failed'),errors=[];
 await assert.rejects(async()=>{try{throw original;}finally{await smoke.exports.settingsDiagnostic(()=>Promise.reject(write),'save failed click',original,errors);}},error=>error===original);
 assert.equal(errors.length,1);assert.equal(errors[0].message,write.message);
 await assert.rejects(smoke.exports.settingsDiagnostic(()=>Promise.reject(write),'save successful click'),error=>error===write);
});
test('624 hung diagnostics terminate at the existing1500ms bound and a required hung proof still fails',{timeout:5000},async()=>{
 const original=Error('actual receipt timeout'),errors=[];
 const results=await Promise.allSettled([smoke.exports.settingsDiagnostic(()=>new Promise(()=>{}),'failure renderer snapshot',original,errors),smoke.exports.settingsDiagnostic(()=>new Promise(()=>{}),'required proof write')]);
 assert.equal(results[0].status,'fulfilled');assert.match(results[0].value.error,/1500 ms/);assert.equal(errors.length,1);
 assert.equal(results[1].status,'rejected');assert.match(results[1].reason.message,/1500 ms/);
});
function snapshotRenderer(selector,state='visible'){
 const targetBounds={x:554,y:322,width:125,height:28,left:554,top:322,right:679,bottom:350},dialogBounds={x:480,y:160,width:360,height:400},queries=[];
 const target={ownerDocument:null,parentElement:null,disabled:false,tagName:'BUTTON',className:'',getBoundingClientRect:()=>targetBounds,getClientRects:()=>[targetBounds],matches:()=>false,contains:node=>node===target};
 const dialog={open:true,hidden:false,getBoundingClientRect:()=>dialogBounds,querySelector:name=>name==='.dialog-content'?{scrollTop:17}:null};
 const document={defaultView:{innerWidth:1008,innerHeight:668,getComputedStyle:()=>({pointerEvents:'auto',visibility:state==='hidden'?'hidden':'visible',display:'block',opacity:'1'})},querySelector:name=>{queries.push(name);return name==='#settings-dialog'?dialog:name===selector&&state!=='missing'?target:null;},elementFromPoint:()=>target};target.ownerDocument=document;
 return{queries,targetBounds,context:{document,innerWidth:1008,innerHeight:668,performance:{now:()=>1234,timeOrigin:100000},MouseTest:{model:{focusPane:'',focusAI:false,settingsOpen:true}}}};
}
for(const selector of ['#settings-button','#settings-dialog [data-close-dialog]']){
 test('624 actual serialized snapshot resolves '+selector+' without ambient main-process variables',()=>{
  const fixture=snapshotRenderer(selector);assert.equal(Object.hasOwn(fixture.context,'selector'),false);
  const snapshot=vm.runInNewContext(smoke.exports.settingsSnapshotScript(selector),fixture.context);
  assert.equal(snapshot.target.selector,selector);assert.equal(snapshot.target.hit.ready,true);assert.equal(snapshot.target.hit.x,617);assert.equal(snapshot.target.hit.y,336);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.target.bounds)),{x:554,y:322,width:125,height:28});
  assert.equal(snapshot.at,1234);assert.equal(snapshot.timeOrigin,100000);assert.equal(snapshot.viewport.width,1008);assert.equal(snapshot.viewport.height,668);
  assert.equal(snapshot.focusPane,'');assert.equal(snapshot.focusAI,false);assert.equal(Object.hasOwn(snapshot,'agentOpen'),false);assert.equal(Object.hasOwn(snapshot,'agentHidden'),false);assert.equal(snapshot.settingsOpen,true);
  assert.equal(snapshot.dialog.open,true);assert.equal(snapshot.dialog.hidden,false);assert.equal(snapshot.dialog.scrollTop,17);assert.deepEqual(fixture.queries,['#settings-dialog',selector]);
 });
 test('624 actual serialized snapshot preserves '+selector+' when its target is missing or hidden',()=>{
  for(const state of ['missing','hidden']){
   const fixture=snapshotRenderer(selector,state),snapshot=vm.runInNewContext(smoke.exports.settingsSnapshotScript(selector),fixture.context);
   assert.equal(snapshot.target.selector,selector);assert.equal(snapshot.target.hit.ready,false);assert.equal(snapshot.target.hit.reason,state==='missing'?'missing':'hidden or disabled');
   if(state==='missing')assert.equal(snapshot.target.bounds,null);else assert.equal(snapshot.target.bounds.width,125);
   assert.equal(snapshot.settingsOpen,true);assert.equal(snapshot.dialog.open,true);
  }
 });
}
