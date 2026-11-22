'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const {createPerformanceDiagnostic,rendererExpression,FILES}=require('./mouse-637-performance-diagnostic.cjs');
const profileRoot=path.join(os.tmpdir(),'mouse-637-diagnostic-unit-profile');
const profile=()=>({nodes:[{id:1,callFrame:{functionName:'unitOnly',scriptId:'1',url:'file:///owned/unit.cjs',lineNumber:1,columnNumber:1},hitCount:1}],startTime:100000,endTime:102000,samples:[1,1],timeDeltas:[1000,1000]});

// Explicit unit adapters, not an installed/native performance measurement.
function harness({mainFailure,rendererFailure,writeFailure,limits={},env={},appOverrides={}}={}){
 const events=[],files=new Map(),calls=[],realms={main:0,renderer:0};let tick=10,rendererTick=500;
 const renderer=vm.createContext({performance:{timeOrigin:900000,now:()=>rendererTick++}});
 class Session{
  connect(){events.push('main.connect');}
  post(method,params,callback){calls.push({target:'main',method,params});if(method===mainFailure)return callback(Error('main '+method+' failed'));callback(null,method==='Profiler.stop'?{profile:profile()}:{});}
  disconnect(){events.push('main.disconnect');}
 }
 const debug={isAttached:()=>true,sendCommand:async(method,params)=>{calls.push({target:'renderer',method,params});if(method===rendererFailure)throw Error('renderer '+method+' failed');return method==='Profiler.stop'?{profile:profile()}:{};}};
 const fs={writeFile:async(name,bytes)=>{if(writeFailure&&name.includes(writeFailure))throw Error('owned write failed');files.set(name,Buffer.from(bytes));},rename:async(before,after)=>{files.set(after,files.get(before));files.delete(before);},rm:async name=>{files.delete(name);}};
 const fixture={js:code=>{events.push('fixture.js');return Promise.resolve(vm.runInContext(code,renderer));}};
 const app={isPackaged:true,getVersion:()=> '6.0.37',getPath:()=>profileRoot,...appOverrides};
 const options={app,env:{CI:'true',MOUSE_TEST_PROFILE:profileRoot,MOUSE_637_PERFORMANCE_DIAGNOSTIC:'1',...env},platform:'darwin',arch:'arm64',pid:123,cwd:path.join(os.tmpdir(),'mouse-637-diagnostic-unit-output'),limits,
  dependencies:{fs,sessionFactory:()=>{realms.main++;return new Session();},now:()=>tick++,monotonic:()=>String(1000000+tick)}};
 return{diagnostic:createPerformanceDiagnostic(options),options,events,files,calls,realms,renderer,fixture,debug,read:name=>JSON.parse(files.get(path.join(options.cwd,name)).toString())};
}

test('disabled diagnostics do not inspect app, create sessions, read clocks, or write files',()=>{
 const forbidden=()=>{throw Error('disabled side effect');};
 const dependencies=new Proxy({},{get:forbidden});
 assert.equal(createPerformanceDiagnostic({app:new Proxy({},{get:forbidden}),env:{},dependencies}),null);
});

test('diagnostics require the existing packaged CI and isolated profile boundaries',()=>{
 for(const values of [{env:{CI:'false'}},{env:{MOUSE_TEST_PROFILE:'relative'}},{appOverrides:{isPackaged:false}},{appOverrides:{getVersion:()=> '6.0.36'}},{appOverrides:{getPath:()=>path.join(profileRoot,'another')}}])assert.throws(()=>harness(values));
});

test('separate main and renderer profiles preserve raw V8 timestamps and close without detaching the owned debugger',async()=>{
 const h=harness();await h.diagnostic.start({debugger:h.debug,fixture:h.fixture});
 h.diagnostic.beginSwitch({stage:20,sequence:1});
 h.renderer.answer=Promise.resolve('same value');let ipcCalls=0,returned;
 const original=h.diagnostic.invoke('switch','answer',code=>{ipcCalls++;returned=h.fixture.js(code);return returned;});
 assert.equal(original,returned);assert.equal(await original,'same value');
 assert.equal(await h.diagnostic.invoke('settled','true',code=>{ipcCalls++;return h.fixture.js(code);}),true);
 h.diagnostic.endSwitch();const result=await h.diagnostic.stop();
 assert.equal(ipcCalls,2);assert.equal(result.ok,true);assert.equal(result.diagnosticOnly,true);assert.equal(result.acceptanceEligible,false);
 assert.equal(result.renderer.start.value.timeOrigin,900000);assert.equal(result.renderer.end.value.clock,'renderer.performance.now');
 assert.equal(result.renderer.end.value.markers.length,4);assert.equal(result.mainMarkers.length,6);
 for(const target of ['main','renderer']){
  assert.deepEqual(h.read(FILES[target]),profile());assert.equal(result.profiles[target].startTime,100000);assert.equal(result.profiles[target].endTime,102000);
  assert.deepEqual(h.calls.filter(x=>x.target===target).map(x=>x.method),['Profiler.enable','Profiler.setSamplingInterval','Profiler.start','Profiler.stop','Profiler.disable']);
 }
 assert.equal(h.events.filter(x=>x==='main.disconnect').length,1);assert.equal(h.events.filter(x=>x==='fixture.js').length,4);
 assert.ok(result.commands.every(x=>x.after.performanceNowMs>=x.before.performanceNowMs&&typeof x.before.monotonicNs==='string'));
 assert.equal(await h.diagnostic.stop(),result);assert.deepEqual(h.read(FILES.report),JSON.parse(JSON.stringify(result)));
});

test('renderer expression preserves original Promise, synchronous result, and exception identity',async()=>{
 const records=[],failure=Error('original renderer error'),promise=Promise.resolve('kept');
 const context=vm.createContext({promise,failure,__mouse637PerformanceDiagnostic:{mark:value=>records.push(value)}});
 assert.equal(vm.runInContext(rendererExpression('promise',{kind:'switch'}),context),promise);
 assert.equal(vm.runInContext(rendererExpression('42',{kind:'settled'}),context),42);
 assert.throws(()=>vm.runInContext(rendererExpression('(()=>{throw failure;})()',{kind:'switch'}),context),cause=>cause===failure);
 await promise;assert.deepEqual(records.map(x=>x.phase),['begin','begin','returned','begin','throw','resolved']);
});

test('main invocation preserves the original rejection and still saves both profiles on workload failure',async()=>{
 const h=harness();await h.diagnostic.start({debugger:h.debug,fixture:h.fixture});h.diagnostic.beginSwitch({stage:20,sequence:2});
 const failure=Error('owned workload failure'),original=Promise.reject(failure);
 assert.equal(h.diagnostic.invoke('switch','true',()=>original),original);await assert.rejects(original,cause=>cause===failure);h.diagnostic.endSwitch();
 const report=await h.diagnostic.stop('workload-error');assert.equal(report.profilesStopReason,'workload-error');assert.equal(report.profiles.main.samples,2);assert.equal(report.profiles.renderer.samples,2);assert.ok(report.mainMarkers.some(x=>x.phase==='rejected'));
});

test('setup without an active measured switch is exactly one untouched JS invocation',async()=>{
 const h=harness();await h.diagnostic.start({debugger:h.debug,fixture:h.fixture});let count=0;const code='original expression',answer={};
 assert.equal(h.diagnostic.invoke('switch',code,actual=>{count++;assert.equal(actual,code);return answer;}),answer);assert.equal(count,1);
 const report=await h.diagnostic.stop();assert.deepEqual(report.mainMarkers,[]);assert.equal(report.renderer.end.value.markers.length,0);
});

test('partial main or renderer profiler failures preserve other output and cleanup',async()=>{
 for(const options of [{mainFailure:'Profiler.start'},{rendererFailure:'Profiler.stop'},{writeFailure:FILES.main}]){
  const h=harness(options);await h.diagnostic.start({debugger:h.debug,fixture:h.fixture});const report=await h.diagnostic.stop('workload-error');
  assert.equal(report.ok,false);assert.ok(report.errors.length>0);assert.equal(h.events.filter(x=>x==='main.disconnect').length,1);
  assert.ok(h.calls.some(x=>x.target==='renderer'&&x.method==='Profiler.disable'));assert.ok(h.calls.some(x=>x.target==='main'&&x.method==='Profiler.disable'));
  assert.ok(h.files.has(path.join(h.options.cwd,FILES.report)));assert.ok([...h.files.keys()].every(name=>!name.endsWith('.partial')));
 }
});

test('bounded marker storage preserves first and latest observations with explicit dropped counts',async()=>{
 const h=harness({limits:{markers:4}});await h.diagnostic.start({debugger:h.debug,fixture:h.fixture});h.diagnostic.beginSwitch({stage:50,sequence:10});
 for(let index=0;index<4;index++)await h.diagnostic.invoke('settled',index===3?'true':'false',h.fixture.js);
 h.diagnostic.endSwitch();const report=await h.diagnostic.stop();
 assert.equal(report.mainMarkers.length,4);assert.equal(report.mainMarkers[0].phase,'switch-window-begin');assert.equal(report.mainMarkers.at(-1).phase,'switch-window-end');assert.equal(report.droppedMainMarkers,6);
 assert.equal(report.renderer.end.value.markers.length,4);assert.equal(report.renderer.end.value.markers[0].phase,'begin');assert.equal(report.renderer.end.value.markers.at(-1).phase,'returned');assert.equal(report.renderer.end.value.dropped,4);
});

test('oversized CPU profiles are rejected independently of the raw stress report reader',async()=>{
 const h=harness({limits:{profileBytes:10}});await h.diagnostic.start({debugger:h.debug,fixture:h.fixture});const report=await h.diagnostic.stop();
 assert.equal(report.ok,false);assert.deepEqual(report.profiles,{});assert.equal(report.errors.filter(x=>/diagnostic byte cap/.test(x.message)).length,2);assert.ok(h.files.has(path.join(h.options.cwd,FILES.report)));
});

test('profiler command timeout remains bounded and attempts stop and disable',async()=>{
 const h=harness({limits:{commandMs:10}});h.debug.sendCommand=(method,params)=>{h.calls.push({target:'renderer',method,params});return method==='Profiler.start'?new Promise(()=>{}):Promise.resolve(method==='Profiler.stop'?{profile:profile()}:{});};
 await h.diagnostic.start({debugger:h.debug,fixture:h.fixture});const report=await h.diagnostic.stop();
 assert.equal(report.ok,false);assert.ok(report.errors.some(x=>/timed out/.test(x.message)));assert.ok(h.calls.some(x=>x.target==='renderer'&&x.method==='Profiler.stop'));assert.ok(h.calls.some(x=>x.target==='renderer'&&x.method==='Profiler.disable'));
});
