'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {configure,FEATURE}=require('./mouse-linux-compat.cjs');

function fixture(values={},ready=false){
 const switches=new Map(Object.entries(values)),writes=[];
 return{switches,writes,app:{isReady:()=>ready,commandLine:{getSwitchValue:key=>switches.get(key)||'',appendSwitch(key,value){writes.push([key,value]);switches.set(key,value);}}}};
}

test('Linux native layer compatibility preserves existing switches and is idempotent on pinned Electron',()=>{
 const f=fixture({'disable-features':'ExistingFeature,OtherFeature<OwnedTrial','enable-features':'OwnedEnabledFeature','enable-sandbox':'','user-data-dir':'/owned profile'}),before=new Map(f.switches);
 assert.equal(configure(f.app,{platform:'linux',electronVersion:'44.5.0'}),true);
 assert.equal(f.switches.get('disable-features'),before.get('disable-features')+','+FEATURE);
 for(const[key,value]of before)if(key!=='disable-features')assert.equal(f.switches.get(key),value);
 assert.equal(configure(f.app,{platform:'linux',electronVersion:'44.5.0'}),true);assert.equal(f.writes.length,1);assert.equal(f.switches.size,before.size);
 assert.deepEqual(f.writes.map(row=>row[0]),['disable-features']);
});

test('Linux native layer compatibility is restricted to the exact affected platform and runtime',()=>{
 for(const platform of ['darwin','win32','linux'])for(const electronVersion of [undefined,'44.4.0','44.5.0','44.5.1','45.0.0']){
  if(platform==='linux'&&electronVersion==='44.5.0')continue;
  const f=fixture({},true);assert.equal(configure(f.app,{platform,electronVersion}),false);assert.deepEqual(f.writes,[]);
 }
 const f=fixture();assert.equal(configure(f.app,{platform:'linux',electronVersion:'44.5.0'}),true);assert.deepEqual(f.writes,[['disable-features',FEATURE]]);
});

test('Linux native layer compatibility never changes initialized Chromium or duplicates an existing disable',()=>{
 const late=fixture({},true);assert.throws(()=>configure(late.app,{platform:'linux',electronVersion:'44.5.0'}),/before ready/);assert.deepEqual(late.writes,[]);
 const existing=fixture({'disable-features':'OwnedFeature, '+FEATURE});assert.equal(configure(existing.app,{platform:'linux',electronVersion:'44.5.0'}),true);assert.deepEqual(existing.writes,[]);
});
