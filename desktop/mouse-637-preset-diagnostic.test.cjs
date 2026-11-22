'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const D=require('./mouse-637-preset-diagnostic.cjs'),L=require('./mouse/layout.js'),Modes=require('./mouse/modes.js');
const profile=path.resolve('owned-preset-diagnostic-profile'),env={CI:'true',MOUSE_TEST_PROFILE:profile,[D.ENV]:'1'},app={isPackaged:true,getPath:()=>profile,getVersion:()=> '6.0.37'};
const clone=value=>JSON.parse(JSON.stringify(value));
function harness(){
 const context=vm.createContext({performance:{now:()=>900000},document:{querySelectorAll:()=>[]},MouseTest:{model:{ready:true,desktopId:'desk-2',switching:false,state:{tabs:[]}},prefs:()=>({desktopId:'desk-2',mode:'design',slots:{p1:''}})}}),sent=[],writes=[];
 const win={webContents:{send(...args){sent.push({receiver:this,args});return 'sent';}}},originalSend=win.webContents.send;
 const browser={tabs:new Map(),mouseDesktops:{bank:{active:'desk-2',members:{},preferences:()=>({desktopId:'desk-2',mode:'design',slots:{p1:''}})}}};
 const js=async source=>vm.runInContext(source,context);
 return{context,sent,writes,win,browser,js,originalSend,start:overrides=>D.beginDiagnostic({app,win,browser,js,env,write:async(file,data)=>writes.push({file,data}),...overrides})};
}

test('explicit opt-in is required before app, renderer, filesystem or native state is accessed',async()=>{
 const denied=new Proxy({},{get(){throw Error('disabled diagnostics touched a dependency');}});
 assert.equal(await D.beginDiagnostic({app:denied,win:denied,browser:denied,env:{}}),null);
 for(const change of [{CI:'false'},{MOUSE_TEST_PROFILE:'relative'},{MOUSE_TEST_PROFILE:path.resolve('different')}])assert.throws(()=>D.guard(app,{...env,...change}),/packaged CI/);
 assert.throws(()=>D.guard({...app,isPackaged:false},env),/packaged CI/);
 await assert.rejects(D.beginDiagnostic({app,...harness(),env,js:undefined}),/bounded shell adapter/);
});

test('collector owns immutable first/latest snapshots and reports every truncation boundary',()=>{
 let clock=0;const c=D.createCollector({domain:'unit-main',now:()=>++clock,maxEvents:4,maxBytes:6000,maxRecordBytes:1000}),value={slots:{p1:'before'}};
 c.record('first',value);value.slots.p1='after';for(let i=0;i<8;i++)c.record('next',{i});
 const s=c.snapshot();assert.equal(s.events.length,4);assert.equal(s.events[0].data.slots.p1,'before');assert.equal(s.events.at(-1).data.i,7);assert.equal(s.dropped,5);assert.equal(s.recordLimitReached,true);assert.equal(s.events[0].sequence,1);assert.equal(s.events.at(-1).sequence,9);
 const limited=D.createCollector({domain:'unit'}),many=Array.from({length:100},(_,i)=>({id:String(i)}));let visited=0;
 Object.defineProperty(many,64,{get(){throw Error('Array cap read element64');}});
 assert.equal(D.selectedState({tabs:many}).tabs.length,64);assert.equal(D.selectedState({tabs:many}).tabsOmitted,36);
 const object={};for(let i=0;i<65;i++)Object.defineProperty(object,'k'+i,{enumerable:true,get(){visited++;if(i===64)throw Error('Object cap read key64');return i;}});
 limited.record('bounded',{many,object,text:'x'.repeat(400)});assert.equal(visited,64);const t=limited.snapshot();assert.equal(t.errors.length,0);assert.equal(t.truncated.arrays,36);assert.equal(t.truncated.objects,1);assert.equal(t.truncated.strings,1);
});

test('worst escaped bounded buffers stay below the separate receipt cap',()=>{
 for(const char of ['\0','\ud800','漢','😀']){
  const buffers=[];for(const domain of ['main','renderer']){const c=D.createCollector({domain});for(let i=0;i<700;i++)c.record('event',{tabs:Array.from({length:64},(_,n)=>({id:char.repeat(128),lane:'main',n})),sequence:i});buffers.push(c.snapshot());}
  const bytes=Buffer.byteLength(JSON.stringify({main:buffers[0],renderer:buffers[1]}));assert.ok(bytes<3*1024*1024,bytes+' bounded collector bytes');assert.ok(buffers.every(v=>v.events.length<=512&&v.recordLimitReached&&v.dropped>0));
 }
});

test('event cap retains the first32 and an ordered recent tail containing adjacent causal pairs',()=>{
 const c=D.createCollector({domain:'unit-tail',now:()=>1});for(let i=1;i<=900;i++)c.record(i%2?'state-enter':'state-reconciled',{inputSequence:Math.ceil(i/2)});
 const result=c.snapshot();assert.equal(result.events.length,512);assert.deepEqual(result.events.slice(0,32).map(event=>event.sequence),Array.from({length:32},(_,i)=>i+1));
 assert.deepEqual(result.events.slice(32).map(event=>event.sequence),Array.from({length:480},(_,i)=>421+i));assert.equal(result.dropped,388);assert.equal(result.retention.eventLimitEvictions,388);assert.equal(result.retention.byteLimitEvictions,0);
 const pair=result.events.slice(-2);assert.equal(pair[0].kind,'state-enter');assert.equal(pair[1].kind,'state-reconciled');assert.equal(pair[0].data.inputSequence,pair[1].data.inputSequence);
});

test('total byte budget fills before the event cap without omitting individual records',()=>{
 const c=D.createCollector({domain:'unit-byte-budget',now:()=>1}),count=600;
 // Each record is large but below the independent per-record cap, so this
 // exercises the aggregate byte limit rather than the omitted-record path.
 for(let i=0;i<count;i++)c.record('near-record-cap',{i,payload:Array.from({length:6},()=> '\0'.repeat(256))});
 const result=c.snapshot(),serialized=JSON.stringify(result);
 assert.equal(result.truncated.records,0);assert.equal(result.errors.length,0);assert.ok(result.events.every(event=>!event.omitted));
 assert.ok(result.events.length<result.limits.maxEvents);assert.equal(result.recordLimitReached,true);assert.equal(result.events[0].data.i,0);assert.equal(result.events.at(-1).data.i,count-1);
 assert.equal(result.dropped,count-result.events.length);assert.ok(Buffer.byteLength(serialized)<result.limits.maxBytes);
 assert.equal(result.events.at(-2).data.i,count-2);assert.ok(result.retention.byteLimitEvictions>0);assert.equal(result.retention.eventLimitEvictions,0);assert.ok(result.retention.retainedUpperBoundBytes<=result.limits.maxBytes);
 assert.ok(Buffer.byteLength(JSON.stringify(result.events[0]))>9000,'large complete records actually occupy the byte budget');
});

test('WeakMap stamps preserve state identity and fields; only existing state delivery gains a separate causal payload',async()=>{
 const f=harness(),api=await f.start(),state={desktopId:'desk-2',tabs:[{id:'owned',lane:'main',url:'https://must-not-enter-buffer.test/',favicon:'secret-image'}]},before=clone(state);
 assert.equal(api.state(state),state);assert.deepEqual(state,before);assert.equal(Object.hasOwn(state,D.FIELD),false);
 assert.equal(f.win.webContents.send('browser:state',state),'sent');assert.equal(f.sent[0].receiver,f.win.webContents);assert.equal(f.sent[0].args[1],state);assert.deepEqual(f.sent[0].args[2],{[D.FIELD]:{sequence:1}});
 f.win.webContents.send('ordinary',{x:1});assert.equal(f.sent[1].args.length,2);
 const result=await api.finish(null);assert.equal(result.presetCompleted,true);assert.equal(result.releaseAcceptance,false);assert.equal(f.win.webContents.send,f.originalSend);assert.equal(f.browser.mousePresetDiagnostic,undefined);assert.equal(f.context.MousePresetDiagnostic,undefined);
 assert.doesNotMatch(f.writes[0].data,/must-not-enter-buffer|secret-image/);assert.equal(result.main.events.find(x=>x.kind==='native-state-sent').data.sequence,1);assert.equal(f.writes.length,1);await api.finish(null);assert.equal(f.writes.length,1);
});

test('actual preload keeps ordinary callback arity and forwards diagnostic metadata without changing state',()=>{
 const ipc=new EventEmitter();ipc.invoke=()=>Promise.resolve();let exposed;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:ipc,contextBridge:{exposeInMainWorld(_name,value){exposed=value;}}}),process:{isMainFrame:true,platform:'darwin',arch:'arm64',argv:[]}});
 const calls=[],dispose=exposed.onState(function(){calls.push([...arguments]);}),state={tabs:[]},meta={[D.FIELD]:{sequence:7}};
 ipc.emit('browser:state',{},state);ipc.emit('browser:state',{},state,meta);assert.equal(calls[0].length,1);assert.equal(calls[0][0],state);assert.equal(calls[1].length,2);assert.equal(calls[1][0],state);assert.equal(calls[1][1],meta);dispose();assert.equal(ipc.listenerCount('browser:state'),0);
});

function rendererProbe(){
 const source=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),line=prefix=>source.split('\n').find(row=>row.trimStart().startsWith(prefix));
 const old=Array.from({length:10},(_,i)=>({id:'old-'+i,lane:'main'})),added=Array.from({length:5},(_,i)=>({id:'design-'+i,lane:'main'})),fresh={desktopId:'desk-2',tabs:[...old,...added]},layout=Modes.arranged('design',fresh.tabs,{},{selectedIds:added.map(t=>t.id)});
 const collector=D.createCollector({domain:'renderer-unit',now:()=>800000}),m={...layout,state:fresh,desktopId:'desk-2',ready:true,switching:false,pinnedPanes:{},aiSessions:{},aiSites:[],appearance:{},active:'p1'},counts={save:0},noop=()=>{};
 const context=vm.createContext({m,L,MouseTabOrder:require('./mouse/mouse-613-ui.js'),MousePresetDiagnostic:collector,desktopUI:{render:noop},progressUI:{render:noop},renderTabs:noop,syncPaneLabels:noop,syncAIIcon:noop,syncAIPreview:noop,applySide:noop,save:()=>counts.save++,pendingState:null});
 const trace=source.slice(source.indexOf(' function tracePreset('),source.indexOf('\n function save(',source.indexOf(' function tracePreset(')));
 const receive=source.slice(source.indexOf(' function receiveState('),source.indexOf('\n N.onState(',source.indexOf(' function receiveState(')));
 vm.runInContext([line('const tab='),line('const prefs='),line('function reconcile('),trace,receive,'globalThis.receive=receiveState;'].join('\n'),context);
 return{context,m,old,fresh,added,counts,collector};
}
test('actual renderer hooks expose conditional stale-state slot loss without asserting native delivery occurred',()=>{
 const f=rendererProbe(),original=clone(f.m.slots);f.context.receive({...f.fresh,tabs:f.fresh.tabs.map(t=>({...t,title:'metadata'}))},{[D.FIELD]:{sequence:20}});assert.deepEqual(f.m.slots,original);
 f.context.receive({desktopId:'desk-2',tabs:f.old},{[D.FIELD]:{sequence:10}});assert.ok(Object.values(f.m.slots).every(id=>id===''));f.context.receive(f.fresh,{[D.FIELD]:{sequence:21}});assert.ok(Object.values(f.m.slots).every(id=>id===''));
 const events=f.collector.snapshot().events,entered=events.find(e=>e.kind==='state-enter'&&e.data.incoming.sequence===10),cleared=events.find(e=>e.kind==='state-reconciled'&&e.data.incoming.sequence===10);assert.deepEqual(entered.data.model.slots,original);assert.ok(Object.values(cleared.data.model.slots).every(id=>id===''));assert.equal(entered.at,800000);assert.ok(f.counts.save>0);
});

test('main core state/preset results remain identical with diagnostics and no extra authoritative state reads',async()=>{
 async function run(enabled){const f=harness(),handlers=new Map(),saved={};let seq=0,rawReads=0;
  // The two independent banks receive identical deterministic unit UUIDs;
  // the full production result is compared without deleting history fields.
  const Module=require('node:module'),filename=path.join(__dirname,'mouse-desktops.cjs'),loaded=new Module(filename,module),localRequire=Module.createRequire(filename);let uuid=0;
  loaded.filename=filename;loaded.paths=module.paths;loaded.require=name=>name==='node:crypto'?{...require('node:crypto'),randomUUID:()=> '00000000-0000-4000-8000-'+String(++uuid).padStart(12,'0')}:localRequire(name);loaded._compile(fs.readFileSync(filename,'utf8'),filename);const {install}=loaded.exports;
  const b=f.browser;Object.assign(b,{providers:new Map(),state(){rawReads++;return{tabs:[...this.tabs.values()].map(({id,lane,url})=>({id,lane,url}))};},make(){const id='page-'+(++seq),page={id,lane:'main',url:'',view:{webContents:{}}};this.tabs.set(id,page);return page;},save:async()=>{},layout(){},dispose(){},emit(){return f.win.webContents.send('browser:state',this.state());},async command(action,args){if(action==='open'){const t=this.make();t.url=args.url;t.lane=args.lane;this.emit();return{id:t.id};}return this.state();}});
  const service=await install({browser:b,store:{get:async()=>saved,set:async v=>Object.assign(saved,structuredClone(v))},ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},trusted(){},win:{...f.win,isDestroyed:()=>false}});let api;if(enabled)api=await f.start();
  const results=[];for(const mode of ['support','design'])results.push(await handlers.get('mouse:desktops')({},'apply-mode',{mode,from:'desk-3',preferences:service.preferences()}));
  const reads=rawReads,report=api?await api.finish(null):null;b.dispose();return{results:clone(results),reads,report};
 }
 const off=await run(false),on=await run(true);assert.deepEqual(on.results,off.results);assert.equal(on.reads,off.reads);assert.ok(on.report.main.events.some(e=>e.kind==='mode-return'&&e.data.stateSequence>0));assert.ok(on.report.main.events.some(e=>e.kind==='desktop-enqueue'));assert.ok(on.report.main.events.some(e=>e.kind==='mode-opened'));
});

test('actual populated assertion records its exact failing pane/state/pages and still rejects',async()=>{
 const {createPresetProof}=require('./mouse-637-presets-helpers.cjs'),spec=Modes.get('design'),tabs=spec.sites.map((url,i)=>({id:'d'+i,lane:'main',url})),state=Modes.arranged('design',tabs,{}, {selectedIds:tabs.map(t=>t.id)});state.slots.p3='';
 const selected=[],snapshots=[],root='http://127.0.0.1:3000',browser={mouseDesktops:{bank:{active:'desk-2'}},state:()=>({tabs}),get:id=>({loading:false,view:{webContents:{id:tabs.findIndex(t=>t.id===id)+1,getURL:()=>root+'/suggested/'+encodeURIComponent(tabs.find(t=>t.id===id).url),executeJavaScript:async()=>({identity:.1,timeOrigin:1000,field:'preserved-preset-'+id,scrollX:0,scrollY:0})}}})};
 const disconnected={enabled:false,running:false,port:0,connectionUrl:'',local:{writeAllowed:false,commandsAllowed:false,dev:{enabled:false,running:false}}};
 const proof=createPresetProof({app,browser,agentHost:{state:()=>disconnected},selectedRequests:selected,js:async source=>source==='MouseTest.prefs()'?clone(state):source.includes('mouse637PresetClick')?{trusted:true,at:2}:source.includes('aria-expanded')?'true':true,until:async check=>assert.ok(await check()),click:async selector=>({selector,at:1}),frame:async()=>{},diagnostic:()=>({failedSelection:value=>snapshots.push(clone(value))})});proof.evidence.fixtureOrigin=root;
 await assert.rejects(proof.applyPreset('design'),error=>error instanceof assert.AssertionError&&error.message==='Every preset pane is populated');assert.equal(snapshots.length,1);assert.equal(snapshots[0].pane,'p3');assert.equal(snapshots[0].id,'');assert.equal(snapshots[0].hasSlot,true);assert.equal(snapshots[0].all.length,5);assert.deepEqual(snapshots[0].state,state);
});

test('pre-cleanup snapshots preserve the original failure and bounded-adapter errors cannot replace it',async()=>{
 const f=harness(),api=await f.start(),original=Error('original populated assertion'),events=[];api.failedSelection({mode:'design',pane:'p3',id:'',state:{slots:{p3:''}},all:[{id:'still-live'}]});
 await api.failure(original,async()=>{events.push('capture-before-cleanup');return{filename:'mouse-637-presets-failure-before-cleanup.png'};});const result=await api.finish(original);events.push('cleanup');assert.equal(result.originalError.message,original.message);assert.equal(result.failedSelection.pane,'p3');assert.equal(result.rendererAtFailure.desktopId,'desk-2');assert.equal(result.originalFailureRetained,true);assert.deepEqual(events,['capture-before-cleanup','cleanup']);
 const g=harness();let calls=0;const broken=await g.start({js:async source=>{if(++calls===1)return g.js(source);throw Error('Existing bounded shell adapter timeout');}});await broken.failure(original,async()=>{throw Error('capture unavailable');});const failed=await broken.finish(original);assert.equal(failed.originalError.message,original.message);assert.equal(g.win.webContents.send,g.originalSend);assert.equal(g.browser.mousePresetDiagnostic,undefined);assert.equal(g.writes.length,1);assert.ok(failed.errors.some(e=>e.where==='renderer-trace'));assert.ok(failed.errors.some(e=>e.where==='pre-cleanup-capture'));
});

test('actual preset catch/finally performs diagnosis before cleanup and retains the same exception',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'mouse-637-presets-smoke.cjs'),'utf8'),start=source.indexOf(' }catch(error){failure=error;'),end=source.indexOf('  const errors=[],created=',start),tail=source.slice(start,end);
 for(const broken of [false,true]){const original=Error('same original'),events=[],context={original,capture:async()=>{events.push('capture');if(broken)throw Error('capture failure');},diagnostic:{failure:async(error,take)=>{assert.equal(error,original);await take();},finish:async(error)=>{assert.equal(error,original);events.push('finish');}},events};
  const code='(async()=>{let failure;try{throw original;'+tail+'events.push("cleanup");}if(failure)throw failure;})()';await assert.rejects(vm.runInNewContext(code,context),error=>error===original);assert.deepEqual(events,['capture','finish','cleanup']);
 }
});
