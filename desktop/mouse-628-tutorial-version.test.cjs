'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=require.resolve('./mouse-628-ui-smoke.cjs'),source=fs.readFileSync(file,'utf8'),from=require('node:module').createRequire(file);
async function fixture(version){
 const profile=path.join(__dirname,'isolated-tutorial-fixture'),accepted=Error('Tutorial version header accepted');let facts,reads=0;
 const app={getVersion:()=>version,getPath:()=>profile},context=vm.createContext({module:{exports:{}},app,performance:{timeOrigin:100},js:async()=>200,process:{pid:300,argv:[],env:{CI:'true',MOUSE_TEST_PROFILE:profile}},require:id=>id==='electron'?{}:id==='node:fs/promises'?{readFile:async()=>JSON.stringify(facts)}:from(id)});
 vm.runInContext(source,context,{filename:file});
 // Evaluate the production writer's initializer so its recorded version and
 // the production restart entry point are checked together.
 const initializer=source.match(/^  const tutorial=.+;$/m)?.[0];assert.ok(initializer);
 facts=await vm.runInContext('(async()=>{'+initializer+'return tutorial;})()',context);
 Object.assign(facts,{successHidden:true,privateIsolated:true});
 const run=expectedSavedVersion=>context.module.exports({app,win:{listenerCount:()=>0},browser:{},store:{async get(){reads++;throw accepted;}},readMode:true,...(expectedSavedVersion===undefined?{}:{expectedSavedVersion})});
 return{facts,run,accepted,reads:()=>reads};
}
test('the tutorial evidence writer records the installed app version and restart expects that version by default',async()=>{
 for(const version of ['6.0.36','6.0.37']){
  const f=await fixture(version);assert.equal(f.facts.version,version);
  await assert.rejects(f.run(),error=>error===f.accepted);assert.equal(f.reads(),1);
 }
});
test('a stale tutorial report is rejected before persisted gesture state is read',async()=>{
 const f=await fixture('6.0.36');f.facts.version='6.0.35';
 await assert.rejects(f.run(),error=>error.code==='ERR_ASSERTION'&&error.actual==='6.0.35'&&error.expected==='6.0.36');assert.equal(f.reads(),0);
});
test('a real upgrade keeps its explicitly required predecessor version',async()=>{
 const f=await fixture('6.0.36');f.facts.version='6.0.29';
 await assert.rejects(f.run('6.0.29'),error=>error===f.accepted);assert.equal(f.reads(),1);
 f.facts.version='6.0.36';await assert.rejects(f.run('6.0.29'),error=>error.code==='ERR_ASSERTION'&&error.actual==='6.0.36'&&error.expected==='6.0.29');assert.equal(f.reads(),1);
});
