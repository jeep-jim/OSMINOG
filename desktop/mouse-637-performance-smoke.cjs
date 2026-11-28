'use strict';
// Compare two actual installed processes from the same native runner. The old
// executable and its 20/50-page workload are unchanged; all raw reports remain.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const {createHash}=require('node:crypto');
const SHA=/^[a-f0-9]{64}$/;
const VERSION='6.0.44',BASELINE_VERSION='6.0.43';
// A predeclared presentation budget, not an estimate of measured runner noise:
// retain636 latency within one 60 Hz frame, without requiring another speedup.
const CRITERIA=Object.freeze({p95MaxMs:250,maxMaxMs:600,medianMustImprove:false,medianAllowanceMs:1000/60});
const distribution=values=>{
 assert.ok(Array.isArray(values)&&values.length&&values.every(value=>Number.isFinite(value)&&value>=0),'Raw nonnegative timing samples are required');
 const sorted=values.slice().sort((a,b)=>a-b);
 return{count:values.length,min:sorted[0],p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1)};
};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function workload(report,{version,platform,arch,candidate}){
 assert.equal(report.version,version);assert.equal(report.platform,platform);assert.equal(report.arch,arch);
 assert.equal(report.ok,true);assert.equal(report.restored,true);assert.equal(report.error,undefined);assert.equal(report.cleanupError,undefined);
 assert.deepEqual(report.renderFailures,[]);assert.equal(report.budgetMs,200000);
 assert.deepEqual(report.stages.map(row=>row.ownedPageCount),[20,50]);
 return report.stages.map(row=>{
  const total=row.ownedPageCount,count=total===20?5:10;
  assert.equal(row.deskCount,5);assert.deepEqual(row.pagesPerDesk,Array(5).fill(total/5));
  assert.equal(row.switchCount,count);assert.equal(row.switches.length,count);
  assert.equal(row.beforePages.length,total);assert.equal(row.afterPages.length,total);
  assert.equal(new Set(row.beforePages.map(page=>page.id)).size,total);
  const stable=['id','index','desk','webContentsId','url','navigationEpoch','identity','timeOrigin','field','scrollX','scrollY','cookie'];
  for(let i=0;i<total;i++){
   const before=row.beforePages[i],after=row.afterPages[i];
   for(const key of stable){assert.notEqual(before[key],undefined,'Missing native document identity '+key);assert.deepEqual(after[key],before[key],'The document must survive switching: '+key);}
   assert.equal(row.requests.filter(request=>request.index===before.index).length,1,'No document reload during switching');
  }
  assert.equal(row.metadata.length,total);assert.ok(row.metadata.every(item=>item.updates>0));
  assert.equal(row.streams.length,5);
  for(const stream of row.streams){
   assert.equal(stream.after.requests,1);assert.equal(stream.server.requestCount,1);assert.equal(stream.after.done,true);assert.equal(stream.after.error,null);
   assert.deepEqual(stream.after.chunks,stream.server.values);assert.ok(stream.after.chunks.length>stream.before.chunks.length);
  }
  assert.equal(row.nora.held,true);assert.equal(row.nora.diagnostics.lastCapture.paintProof,true);assert.equal(row.nora.diagnostics.lastPaint.ready,true);
  const switchSamplesMs=row.switches.map((entry,i)=>{
   assert.equal(entry.sequence,i+1);assert.notEqual(entry.from,entry.to);assert.equal(entry.slide.phase,'complete');
   assert.equal(entry.visiblePageIds.length,4);assert.equal(new Set(entry.visiblePageIds).size,4);
   assert.ok(entry.visiblePageIds.every(id=>row.beforePages.some(page=>page.id===id)));
   assert.ok(entry.capture&&typeof entry.capture.filename==='string'&&SHA.test(entry.capture.sha256),'Real native content capture receipt is required');
   assert.equal(entry.slide.strategy,'live');assert.equal(entry.slide.presented,true);assert.equal(entry.slide.snapshotCaptures,0);
   assert.equal(entry.slide.animated,false);assert.equal(entry.slide.decoded,false);assert.equal(entry.slide.borrowedHold,false);
   assert.equal(entry.counts.capturePage,0);assert.deepEqual(entry.surfaceCalls,[]);
   return entry.elapsedMs;
  });
  const switchLatencyMs=distribution(switchSamplesMs);assert.deepEqual(row.switchLatencyMs,switchLatencyMs);
  assert.ok(row.renderer.frames>=2&&Array.isArray(row.renderer.longTasks));
  assert.deepEqual(row.renderer.gapDistribution,distribution(row.renderer.gaps));
  assert.deepEqual(row.mainEventLoop,distribution(row.mainEventLoopSamplesMs));
  assert.ok(switchLatencyMs.p50>0,'Both actual processes must record a positive median');
  return{ownedPageCount:total,deskCount:5,switchCount:count,switchLatencyMs,switchSamplesMs,
   switchCaptures:row.switches.reduce((sum,entry)=>sum+entry.counts.capturePage,0),
   mainEventLoop:row.mainEventLoop,mainEventLoopSamplesMs:row.mainEventLoopSamplesMs,renderer:row.renderer};
 });
}

function compareReports({baseline,candidate,platform,arch}){
 const old=workload(baseline,{version:BASELINE_VERSION,platform,arch,candidate:false});
 const next=workload(candidate,{version:VERSION,platform,arch,candidate:true});
 const stages=next.map((row,i)=>{
  assert.ok(row.switchLatencyMs.p50<=old[i].switchLatencyMs.p50+CRITERIA.medianAllowanceMs,'The median desktop switch exceeds the fixed predecessor plus one-frame budget');
  return{ownedPageCount:row.ownedPageCount,deskCount:row.deskCount,switchCount:row.switchCount,
   baseline:old[i],candidate:row,medianRatio:old[i].switchLatencyMs.p50/row.switchLatencyMs.p50,
   medianDeltaMs:row.switchLatencyMs.p50-old[i].switchLatencyMs.p50,medianWithinBudget:true};
 });
 for(const kind of ['baseline','candidate']){
  const fifty=stages[1][kind].switchLatencyMs;
  assert.ok(fifty.p95<=CRITERIA.p95MaxMs,kind+' 50-page desktop switch p95 exceeds the fixed 250 ms budget');
  assert.ok(fifty.max<=CRITERIA.maxMaxMs,kind+' 50-page desktop switch maximum exceeds the fixed 600 ms budget');
 }
 return stages;
}

module.exports=async({app})=>{
 const facts={schema:1,version:VERSION,platform:process.platform,arch:process.arch,pid:process.pid,
  kind:'installed-desktop-performance-comparison',source:'Exact published predecessor and candidate installed processes on the same native CI runner',
  physicalUserDeviceVerified:false,percentileMethod:'sorted[floor((count-1)*quantile)]',criteria:CRITERIA,sourceReports:{},ok:false};
 const file='mouse-637-performance.json';
 const save=()=>fs.writeFile(file,JSON.stringify(facts,null,2)+'\n');
 async function report(key,filename){
  const stat=await fs.lstat(filename);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=8*1024*1024);
  const bytes=await fs.readFile(filename);facts.sourceReports[key]={filename,bytes:bytes.length,sha256:hash(bytes)};return JSON.parse(bytes);
 }
 try{
  assert.equal(app.getVersion(),VERSION);assert.equal(app.isPackaged,true);assert.equal(process.env.CI,'true');
  const envelope=await report('baselineEnvelope','mouse-637-baseline-performance.json');
  const baseline=await report('baselineStress','mouse-637-baseline-performance/mouse-631-stress.json');
  const candidate=await report('candidateStress','mouse-631-stress.json');
  const native=await report('candidateNative','mouse-631-native.json');
  assert.equal(envelope.schema,1);assert.equal(envelope.kind,'published-baseline-stress-run');assert.equal(envelope.version,VERSION);
  assert.equal(envelope.ok,true);assert.equal(envelope.error,undefined);assert.equal(envelope.platform,process.platform);assert.equal(envelope.arch,process.arch);
  assert.equal(envelope.baselineVersion,BASELINE_VERSION);
  assert.ok(envelope.baseline.size>0&&SHA.test(envelope.baseline.sha256));
  assert.equal(envelope.process.exitCode,0);assert.ok(envelope.process.elapsedMs>0&&envelope.process.elapsedMs<=400000);
  assert.equal(envelope.process.budgetMs,400000);assert.ok(envelope.process.pid>0&&envelope.process.pid!==native.pid);
  for(const[key,variable]of Object.entries({runId:'GITHUB_RUN_ID',runAttempt:'GITHUB_RUN_ATTEMPT',job:'GITHUB_JOB',workflow:'GITHUB_WORKFLOW',sha:'GITHUB_SHA'})){
   assert.ok(process.env[variable],'Missing actual native runner identity '+variable);assert.equal(envelope.runner[key],process.env[variable],'Baseline must run in this exact candidate job');
  }
  assert.equal(envelope.runner.host,os.hostname());assert.equal(envelope.runner.display,process.env.DISPLAY||null);
  const bound=facts.sourceReports.baselineStress;
  assert.deepEqual(envelope.files[bound.filename],{size:bound.bytes,sha256:bound.sha256},'The raw predecessor measurements must match the installed baseline receipt');
  assert.equal(native.ok,true);assert.equal(native.version,VERSION);assert.equal(native.platform,process.platform);assert.equal(native.arch,process.arch);
  assert.ok(native.pid>0);assert.equal(native.budgetMs,350000);
  assert.deepEqual(native.stages.map(row=>row.name),['taskOnly','fiftyTabs','stationaryMedia']);assert.ok(native.stages.every(row=>row.ok));
  facts.baseline={version:envelope.baselineVersion,source:envelope.baselineSource,package:envelope.baseline,process:envelope.process,runner:envelope.runner};
  facts.candidate={version:VERSION,pid:native.pid,source:process.env.GITHUB_SHA};
  facts.stages=compareReports({baseline,candidate,platform:process.platform,arch:process.arch});
  facts.checks={sameRunner:true,workloadMatched:true,zeroSwitchCaptures:true,medianWithinBudget:true,baselineWithinBudget:true,p95WithinBudget:true,maxWithinBudget:true,restored:true};
  facts.ok=true;
 }catch(error){facts.error={message:error.message,stack:error.stack};await save();throw error;}
 await save();console.log('MOUSE_637_PERFORMANCE_PASS');return{...facts,reportFile:file,reportSha256:hash(await fs.readFile(file))};
};
module.exports.distribution=distribution;
module.exports.compareReports=compareReports;
module.exports.CRITERIA=CRITERIA;
