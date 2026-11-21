'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helpers={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-631-smoke-helpers.cjs'),'utf8'),{module:helpers,require:name=>name.startsWith('node:')?require(name):{},setTimeout,clearTimeout});
const smoke={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-624-smoke.cjs'),'utf8'),{module:smoke,require:name=>name.startsWith('node:')?require(name):name==='./mouse-631-smoke-helpers.cjs'?helpers.exports:{}});
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
