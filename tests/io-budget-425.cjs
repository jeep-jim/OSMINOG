'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {coalesce,selectedStorage}=require('../osminog-io-budget.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('writes hold one active snapshot and collapse pending calls to the latest state',async()=>{
 let release,active=0,peak=0,state=0;const saved=[];
 const save=coalesce(async()=>{peak=Math.max(peak,++active);const captured=state;saved.push(captured);await new Promise(r=>release=r);active--;return captured});
 const first=save();await tick();state=1;const waiting=[];for(let i=1;i<=50;i++){state=i;waiting.push(save())}assert.deepEqual(saved,[0]);release();assert.equal(await first,0);await tick();assert.deepEqual(saved,[0,50]);release();assert.deepEqual(await Promise.all(waiting),Array(50).fill(50));assert.equal(peak,1);
});
test('failed persistence rejects its callers and later writes remain usable',async()=>{
 let bad=true;const save=coalesce(async()=>{if(bad)throw Error('disk full');return 17});await assert.rejects(save(),/disk full/);bad=false;assert.equal(await save(),17);
});
test('queue polling does not read project, image or revision values',async()=>{
 const reads=[],storage={getKeys:async()=>['briefCraftStudioV2','briefCraftRevisionsV1','osminogCapture:a'],get:async keys=>{reads.push(keys);assert.deepEqual(keys,['osminogCapture:a']);return{'osminogCapture:a':{value:'test'}}}};
 assert.deepEqual(await selectedStorage(storage,k=>k.startsWith('osminogCapture:')),{'osminogCapture:a':{value:'test'}});assert.equal(reads.length,1);
 storage.getKeys=async()=>['briefCraftStudioV2'];assert.deepEqual(await selectedStorage(storage,k=>k.startsWith('osminogCapture:')),{});assert.equal(reads.length,1);
});
test('legacy storage adapters keep the same scoped data contract',async()=>{assert.deepEqual(await selectedStorage({get:async()=>({a:1,b:2})},k=>k==='b'),{b:2})});
