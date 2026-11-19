'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./mouse-631-stress-smoke.cjs'),'utf8');

// Exercise the actual fixture's setup/finally without pretending to run native
// pages on this host. Stop at bank access, after media setup and before HTTP/UI.
async function trial(before,{enableFailure=false,restoreMismatch=false}={}){
 let reduced=before,attached=false,report,cleanupCalls=0;
 const commands=[],setupFailure=Error('Owned fixture setup stopped for cleanup test');
 const debug={isAttached:()=>attached,attach:version=>{assert.equal(version,'1.3');attached=true;},detach:()=>{attached=false;},sendCommand:async(name,params)=>{
  assert.equal(name,'Emulation.setEmulatedMedia');commands.push(JSON.parse(JSON.stringify(params)));
  if(params.features.length){reduced=false;if(enableFailure)throw Error('Media command failed after applying override');}
  else reduced=restoreMismatch?!before:before;
 }};
 const fixture={win:{webContents:{debugger:debug}},js:async text=>{assert.equal(text,'matchMedia("(prefers-reduced-motion:reduce)").matches');return reduced;},cleanup:async()=>{cleanupCalls++;return{restored:true};},get bank(){throw setupFailure;}};
 const sandbox={module:{exports:{}},process,performance,structuredClone,console,setInterval,clearInterval,require:name=>{
  if(name==='node:fs/promises')return{writeFile:async(_name,bytes)=>{report=JSON.parse(bytes);}};
  if(name==='./mouse-631-smoke-helpers.cjs')return{createFixture:async()=>fixture,bounded:async operation=>operation,sleep:async()=>{},pageHTML:()=>{throw Error('HTTP must not start in this targeted fixture test');}};
  return require(name);
 }};
 vm.runInNewContext(source,sandbox,{filename:'mouse-631-stress-smoke.cjs'});
 await assert.rejects(sandbox.module.exports({app:{getVersion:()=> '6.0.31'}}),enableFailure?/Media command failed/:/Owned fixture setup stopped/);
 return{commands,attached,reduced,report,cleanupCalls};
}

for(const before of [true,false])test('stress animation fixture restores inherited reduced motion '+before+' after failure',async()=>{
 const result=await trial(before);
 assert.deepEqual(result.commands,[{features:[{name:'prefers-reduced-motion',value:'no-preference'}]},{media:'',features:[]}]);
 assert.deepEqual(result.report.motionMedia,{before,normal:false,restored:before});
 assert.equal(result.attached,false);assert.equal(result.reduced,before);assert.equal(result.cleanupCalls,1);assert.equal(result.report.ok,false);assert.equal(result.report.motionCleanupError,undefined);
});

test('stress fixture clears a partially applied media override when setup rejects',async()=>{
 const result=await trial(true,{enableFailure:true});
 assert.equal(result.commands.length,2);assert.equal(result.report.motionMedia.restored,true);assert.equal(result.reduced,true);assert.equal(result.attached,false);assert.equal(result.cleanupCalls,1);
});

test('stress fixture records a failed inherited motion restoration and remains failed',async()=>{
 const result=await trial(true,{restoreMismatch:true});
 assert.equal(result.attached,false);assert.equal(result.report.ok,false);assert.match(result.report.motionCleanupError.message,/restores the inherited motion preference/);
});
