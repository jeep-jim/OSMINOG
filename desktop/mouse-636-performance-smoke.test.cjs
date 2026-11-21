'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {distribution,compareReports}=require('./mouse-636-performance-smoke.cjs');
// Synthetic validator inputs only. Actual timings and pixels come from the
// two installed native processes, never from this unit fixture.
function report(candidate){
 const stages=[20,50].map(total=>{
  const beforePages=Array.from({length:total},(_,index)=>({id:'page-'+index,index,desk:'desk-'+index%5,webContentsId:index+1,url:'http://owned/page/'+index,navigationEpoch:1,identity:'document-'+index,timeOrigin:1000+index,field:'value-'+index,scrollX:0,scrollY:130,cookie:'fixture='+index}));
  const switches=Array.from({length:total===20?5:10},(_,i)=>({sequence:i+1,from:'desk-'+i%5,to:'desk-'+(i+1)%5,elapsedMs:(candidate?40:600)+i,slide:{phase:'complete',animated:!candidate,decoded:!candidate,...(candidate?{strategy:'live',presented:true,snapshotCaptures:0,borrowedHold:false}:{})},counts:{capturePage:candidate?0:8},surfaceCalls:candidate?[]:[{},{}],visiblePageIds:beforePages.slice(0,4).map(page=>page.id),capture:{filename:'owned.png',sha256:'a'.repeat(64)}}));
  return{ownedPageCount:total,deskCount:5,pagesPerDesk:Array(5).fill(total/5),switchCount:switches.length,switches,beforePages,afterPages:structuredClone(beforePages),requests:beforePages.map(({index})=>({index})),metadata:beforePages.map(({index})=>({index,updates:2})),streams:Array.from({length:5},()=>({before:{chunks:['a']},after:{requests:1,done:true,error:null,chunks:['a','b']},server:{requestCount:1,values:['a','b']}})),nora:{held:true,diagnostics:{lastCapture:{paintProof:true},lastPaint:{ready:true}}},renderer:{frames:4,longTasks:[],gaps:[16,17,16],gapDistribution:distribution([16,17,16])},mainEventLoopSamplesMs:[25,26,25],mainEventLoop:distribution([25,26,25]),switchLatencyMs:distribution(switches.map(row=>row.elapsedMs))};
 });
 return{version:candidate?'6.0.36':'6.0.35',platform:'darwin',arch:'arm64',ok:true,restored:true,renderFailures:[],budgetMs:200000,stages};
}
const inputs=()=>({baseline:report(false),candidate:report(true),platform:'darwin',arch:'arm64'});
test('comparison uses both actual workload shapes and recalculates all switch percentiles',()=>{
 const rows=compareReports(inputs());assert.equal(rows.length,2);assert.equal(rows[1].candidate.switchLatencyMs.p95,48);assert.equal(rows[1].candidate.switchCaptures,0);assert.ok(rows.every(row=>row.medianRatio>1));
});
test('timing distribution rejects non-finite or empty raw samples',()=>{for(const values of [[],[NaN],[Infinity],[-1]])assert.throws(()=>distribution(values));});
test('forged summary does not hide a slower raw switch',()=>{const data=inputs();data.candidate.stages[1].switches[0].elapsedMs=900;assert.throws(()=>compareReports(data));});
test('a correctly summarized 50-page outlier still exceeds the fixed maximum',()=>{const data=inputs(),row=data.candidate.stages[1];row.switches[0].elapsedMs=601;row.switchLatencyMs=distribution(row.switches.map(entry=>entry.elapsedMs));assert.throws(()=>compareReports(data),/600 ms/);});
test('the absolute p95 budget remains separate from the predecessor improvement',()=>{const data=inputs(),row=data.candidate.stages[1];for(const entry of row.switches)entry.elapsedMs=251;row.switchLatencyMs=distribution(row.switches.map(entry=>entry.elapsedMs));assert.throws(()=>compareReports(data),/250 ms/);});
test('a fast run is insufficient if the predecessor median was faster',()=>{const data=inputs();for(const row of data.baseline.stages){for(const entry of row.switches)entry.elapsedMs=20;row.switchLatencyMs=distribution(row.switches.map(entry=>entry.elapsedMs));}assert.throws(()=>compareReports(data),/median/);});
test('switching must not read back native page pixels',()=>{const data=inputs();data.candidate.stages[1].switches[3].counts.capturePage=1;assert.throws(()=>compareReports(data));});
test('document replacement invalidates an otherwise fast run',()=>{const data=inputs();data.candidate.stages[1].afterPages[7].webContentsId=9000;assert.throws(()=>compareReports(data),/document must survive/);});
test('missing renderer raw samples cannot be replaced by a claimed summary',()=>{const data=inputs();delete data.candidate.stages[0].renderer.gaps;assert.throws(()=>compareReports(data),/Raw/);});
test('a different workload or predecessor version is not comparable',()=>{const data=inputs();data.baseline.stages[1].pagesPerDesk=[10,10,10,10,9];assert.throws(()=>compareReports(data));const other=inputs();other.baseline.version='6.0.34';assert.throws(()=>compareReports(other));});
test('the old published format does not require raw frame gaps it never recorded',()=>{const data=inputs();for(const row of data.baseline.stages){delete row.renderer.gaps;delete row.mainEventLoopSamplesMs;}assert.equal(compareReports(data).length,2);});
