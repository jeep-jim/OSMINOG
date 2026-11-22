'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {NAME,BASE,LIMITS,installDOMInputDiagnostic,beginInputDiagnostic}=require('./mouse-637-input-diagnostic.cjs');
const {guestInputReadback,observeGuestClick}=require('./mouse-636-guest-input-diagnostics.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));

function dom(role='guest'){
 const listeners=new Map(),options=[],removed=[];let focused=false,time=0;
 const body={tagName:'BODY',id:'',parentElement:null},link={tagName:'A',id:'download-a',parentElement:body,getBoundingClientRect:()=>({x:17,y:141,width:166,height:16}),contains:node=>node===link};
 const window={addEventListener(type,fn,value){listeners.set(type,fn);options.push({type,...value});},removeEventListener(type,fn,capture){assert.equal(listeners.get(type),fn);assert.equal(capture,true);removed.push(type);listeners.delete(type);}};
 const document={activeElement:body,hasFocus:()=>focused,querySelector:selector=>selector==='#download-a'?link:null,elementFromPoint:(x,y)=>x>=17&&x<183&&y>=141&&y<157?link:body};
 const context=vm.createContext({window,document,TextEncoder,performance:{now:()=>++time,timeOrigin:role==='guest'?1000:2000},Date,innerWidth:597,innerHeight:686,devicePixelRatio:1,scrollX:0,scrollY:130,mouse634:{clicks:[]}});
 vm.runInContext('('+installDOMInputDiagnostic.toString()+')('+JSON.stringify(role)+')',context);
 const dispatch=(type,extra={})=>{const event={type,target:link,isTrusted:true,clientX:100,clientY:149,screenX:104,screenY:252,button:0,buttons:type.endsWith('down')?1:0,pointerId:1,pointerType:'mouse',detail:1,preventDefault(){throw Error('Passive diagnostic must not prevent input');},stopPropagation(){throw Error('Passive diagnostic must not stop input');},...extra};listeners.get(type)?.(event);return event;};
 return{context,link,body,document,window,listeners,options,removed,dispatch,read:()=>copy(context.__mouse637InputDiagnostic.read('#download-a',100,149)),focus:value=>{focused=value;},evaluate:code=>vm.runInContext(code,context)};
}

function nativeMock(){
 const calls=[],state={supported:true,started:false,stopped:false,events:{total:0,dropped:0,records:[]},posts:{total:0,dropped:0,records:[]},diagnosticErrors:[]};
 return{calls,state,inputDiagnosticStart(){calls.push('start');state.started=true;return JSON.stringify(state);},inputDiagnosticRead(){calls.push('read');return JSON.stringify(state);},inputDiagnosticStop(){calls.push('stop');state.stopped=true;return JSON.stringify(state);}};
}
function enabled(extra={}){
 const native=nativeMock(),writes=[],profile=path.resolve('unit-isolated-input-profile');
 const args={app:{isPackaged:true,getVersion:()=> '6.0.37',getPath:name=>{assert.equal(name,'userData');return profile;}},nativeInput:native,env:{CI:'true',MOUSE_637_INPUT_DIAGNOSTIC:'1',MOUSE_TEST_PROFILE:profile},argv:['electron','--mouse-636-retained-smoke'],platform:'darwin',pid:321,write:async(name,data)=>writes.push({name,data}),...extra};
 return{args,native,writes,diagnostic:beginInputDiagnostic(args)};
}

test('disabled diagnostic has no app/native/file side effects and explicit unsafe invocation is rejected',()=>{
 assert.equal(beginInputDiagnostic({app:new Proxy({},{get(){throw Error('Disabled accessed app');}}),nativeInput:new Proxy({},{get(){throw Error('Disabled accessed native');}}),env:{}}),null);
 const f=enabled();assert.deepEqual(f.native.calls,['start']);
 for(const value of [{env:{...f.args.env,CI:'false'}},{env:{...f.args.env,MOUSE_TEST_PROFILE:'relative'}},{env:{...f.args.env,MOUSE_TEST_PROFILE:path.resolve('other')}},{platform:'linux'},{argv:[]},{app:{...f.args.app,isPackaged:false}},{app:{...f.args.app,getVersion:()=> '6.0.36'}}])assert.throws(()=>beginInputDiagnostic({...f.args,...value}));
 assert.equal(f.writes.length,0);
});

test('actual serialized DOM collector records targets, coordinates and clock domains without handling the event',()=>{
 const f=dom();assert.deepEqual(f.options.map(x=>x.type),['pointerdown','pointerup','pointercancel','mousedown','mouseup','click','focus','blur']);assert.ok(f.options.every(x=>x.capture&&x.passive));
 const original=f.dispatch('pointerdown');f.dispatch('mousedown');f.focus(true);f.dispatch('focus',{target:f.window});f.dispatch('pointerup');f.dispatch('mouseup');f.dispatch('click');
 assert.equal(original.defaultPrevented,undefined);const read=f.read();assert.equal(read.total,6);assert.equal(read.dropped,0);assert.deepEqual(read.records.map(r=>r.seq),[1,2,3,4,5,6]);assert.equal(read.records[0].target.id,'download-a');assert.equal(read.records[0].buttons,1);assert.equal(read.records.at(-1).trusted,true);assert.equal(read.state.hitInsideTarget,true);assert.equal(read.state.documentFocused,true);assert.equal(read.state.timeOrigin,1000);
 f.context.__mouse637InputDiagnostic.dispose();f.context.__mouse637InputDiagnostic.dispose();assert.equal(f.removed.length,8);f.dispatch('click');assert.equal(f.read().total,6);
});

test('DOM first32 plus rolling tail remains bounded by events and actual escaped UTF8 bytes',()=>{
 const f=dom();let parent=null;for(let n=0;n<8;n++)parent={tagName:'DIV',id:'\0'.repeat(40),parentElement:parent};f.link.parentElement=parent;
 for(let n=0;n<500;n++)f.dispatch('mousedown');const r=f.read();assert.equal(r.total,500);assert.equal(r.total,r.records.length+r.dropped);assert.ok(r.records.length<=128);assert.ok(r.byteEvicted>0);assert.equal(r.oversize,0,'This case exercises the aggregate byte cap, not oversize markers');
 assert.deepEqual(r.records.slice(0,32).map(x=>x.seq),Array.from({length:32},(_,i)=>i+1));assert.equal(r.records.at(-1).seq,500);assert.ok(Buffer.byteLength(JSON.stringify(r.records))<=262144+129,'Only JSON array punctuation is outside the sum of record bytes');
 let oversizedParent=null;for(let n=0;n<8;n++)oversizedParent={tagName:'DIV',id:'\0'.repeat(4000),parentElement:oversizedParent};
 for(let n=0;n<40;n++)f.dispatch('mouseup',{target:{tagName:'A',id:'\0'.repeat(4000),parentElement:oversizedParent}});const next=f.read();assert.ok(next.stringTruncated>0);assert.equal(next.oversize,40);assert.equal(next.total,next.records.length+next.dropped);assert.equal(next.records.at(-1).seq,540);assert.equal(next.records.at(-1).oversize,true);
});

test('DOM getter failures remain diagnostic records and never escape into input dispatch',()=>{
 const f=dom(),bad={get parentElement(){throw Error('Getter unavailable');}};assert.doesNotThrow(()=>f.dispatch('mousedown',{target:bad}));f.dispatch('mouseup');const r=f.read();assert.equal(r.total,2);assert.equal(r.dropped,0);assert.equal(r.errors,1);assert.equal(r.records[0].seq,1);assert.equal(r.records[0].type,'diagnostic-error');assert.equal(r.records[1].seq,2);
 const tail=dom();for(let n=0;n<32;n++)tail.dispatch('mousedown');assert.doesNotThrow(()=>tail.dispatch('mouseup',{target:bad}));for(let n=0;n<200;n++)tail.dispatch('click');
 const after=tail.read();assert.equal(after.total,233);assert.equal(after.errors,1,'The persistent error count survives eviction of its detailed record');assert.equal(after.total,after.records.length+after.dropped);assert.ok(after.dropped>0);assert.equal(after.records.some(row=>row.type==='diagnostic-error'),false);assert.equal(after.records.some(row=>row.seq===33),false);assert.equal(after.records.at(-1).seq,233);
});

function observationFixture(){
 const f=enabled(),guest=dom(),shell=dom('shell'),calls=[],record={id:'owned',index:0},details={selector:'#download-a',tabId:'owned',webContentsId:2,beforeCount:0,hit:{ready:true,x:100,y:149},factor:1,pageBounds:{x:0,y:74,width:597,height:686},beforeGuest:guest.evaluate(f.diagnostic.beforeGuest(guestInputReadback,'#download-a',100,149))};
 const fixture={pageJS:async(r,code)=>{assert.equal(r,record);calls.push('guest-read');return guest.evaluate(code);},js:async code=>{calls.push('shell-read');return shell.evaluate(code);}};
 const observed=[],events=[{id:'download-a',trusted:true}],args={attempts:observed,details,readNative:()=>({}),post:async()=>{calls.push('post');guest.dispatch('mousedown');guest.dispatch('mouseup');guest.dispatch('click');for(let n=0;n<3;n++){const item={sequence:++f.native.state.posts.total,type:n,created:true,postCalled:true};f.native.state.posts.records.push(item);}return true;},readEvents:async()=>{calls.push('events');return events;},accept:rows=>rows.some(row=>row.id==='download-a'&&row.trusted),waitFor:async check=>{calls.push('wait');assert.equal(await check(),true);},label:'634 trusted guest link #download-a',save:async()=>calls.push('original-save')};
 return{...f,guest,shell,calls,record,details,fixture,args,observed,events,work:()=>observeGuestClick(args)};
}

test('diagnostic wraps the actual original click observer once, with no added pre-click IPC or wait',async()=>{
 const f=observationFixture();const value=await f.diagnostic.observe({details:f.details,fixture:f.fixture,record:f.record,work:f.work});assert.equal(value,f.events);assert.deepEqual(f.calls,['post','wait','events','guest-read','shell-read']);assert.equal(f.observed.length,1);assert.equal(f.diagnostic.report.attempts.length,1);
 const row=f.diagnostic.report.attempts[0];assert.equal(row.capturedBeforeCleanup,true);assert.equal(row.beforeCount,0);assert.equal(row.guestAfter.records.at(-1).type,'click');assert.equal(row.shellAfter.role,'shell');assert.equal(row.originalError,null);assert.equal(row.nativeSequenceBefore.posts,0);assert.equal(row.nativeSequenceAfter.posts,3);
 await f.diagnostic.beforeCleanup({stage:'complete'});const calls=f.calls.slice();await f.diagnostic.finish({ok:true,restored:true});assert.deepEqual(f.calls,calls,'Final sealing does not reread guest/shell events after cleanup');assert.equal(f.native.calls.filter(x=>x==='stop').length,1);
 const final=JSON.parse(f.writes.at(-1).data);assert.equal(f.writes.at(-1).name,NAME);assert.equal(final.sourceBase,BASE);assert.equal(final.retainedCompleted,true);assert.equal(final.originalFailureRetained,false);assert.equal(final.releaseAcceptance,false);assert.equal(final.native.stopped,true);assert.equal(final.capturedBeforeCleanup,true);assert.deepEqual(final.native.posts.records.map(row=>row.sequence),[1,2,3]);
});

test('original timeout identity and saved original facts survive diagnostics and final cleanup',async()=>{
 const f=observationFixture(),original=Error('original trusted click timeout');f.args.readEvents=async()=>{f.calls.push('events');return[];};f.args.waitFor=async check=>{f.calls.push('wait');assert.equal(await check(),false);throw original;};
 await assert.rejects(f.diagnostic.observe({details:f.details,fixture:f.fixture,record:f.record,work:f.work}),error=>error===original);assert.deepEqual(f.calls,['post','wait','events','original-save','guest-read','shell-read']);
 const facts={ok:false,restored:true,error:{stage:'pane-download-widgets',message:original.message,stack:original.stack}};await f.diagnostic.beforeCleanup({stage:facts.error.stage,error:original});await f.diagnostic.finish(facts);assert.deepEqual(f.diagnostic.report.originalError,facts.error);assert.equal(f.diagnostic.report.originalFailureRetained,true);assert.equal(f.diagnostic.report.attempts[0].originalError.message,original.message);assert.equal(f.diagnostic.report.retainedCompleted,false);
});

test('failed or hanging diagnostic reads cannot replace the original workload error',async()=>{
 const f=observationFixture(),original=Error('original timeout');f.fixture.pageJS=()=>new Promise(()=>{});f.fixture.js=async()=>{throw Error('shell unavailable');};
 await assert.rejects(f.diagnostic.observe({details:f.details,fixture:f.fixture,record:f.record,work:async()=>{throw original;}}),error=>error===original);
 const row=f.diagnostic.report.attempts[0];assert.match(row.guestAfter.diagnosticError.message,/exceeded2000ms/);assert.equal(row.shellAfter.diagnosticError.message,'shell unavailable');assert.equal(row.diagnosticErrors.length,2);assert.equal(row.capturedBeforeCleanup,true);assert.equal(f.diagnostic.report.diagnosticErrors.length,2);
});

test('the original before-count readback survives a failing optional collector',()=>{
 const f=enabled(),context=vm.createContext({mouse634:{clicks:[1,2]},document:{hasFocus:()=>true,activeElement:{tagName:'BODY',id:''}},__mouse637InputDiagnostic:{read(){throw Error('Optional read failed');}}});
 const result=vm.runInContext(f.diagnostic.beforeGuest(guestInputReadback,'#download-a',100,149),context);assert.equal(result.count,2);assert.equal(result.documentFocused,true);assert.equal(result.inputDiagnostic.diagnosticError.message,'Optional read failed');
});

test('receipt bounds retain the first failed attempt and skip later optional recording without replaying work',async()=>{
 const f=observationFixture();let calls=0;for(let i=0;i<19;i++)await f.diagnostic.observe({details:f.details,fixture:f.fixture,record:f.record,work:async()=>++calls});
 assert.equal(calls,19);assert.equal(f.diagnostic.report.attempts.length,16);assert.equal(f.diagnostic.report.attemptsDropped,3);assert.equal(f.diagnostic.report.attempts[0].selector,'#download-a');assert.ok(f.writes.every(row=>Buffer.byteLength(row.data)<=LIMITS.receiptBytes));
});

test('same serialized collector is installed through owned HTML and the existing shell probe',()=>{
 const f=enabled(),g=dom(),html=f.diagnostic.pageHTML('<html><body>owned content</body></html>');assert.match(html,/owned content<script>/);assert.equal((html.match(/<script>/g)||[]).length,1);
 const fresh=vm.createContext({...g.context,__mouse637InputDiagnostic:undefined});assert.doesNotThrow(()=>vm.runInContext(f.diagnostic.shellInstall(),fresh));assert.equal(fresh.__mouse637InputDiagnostic.read().role,'shell');
 const source=fs.readFileSync(path.join(__dirname,'mouse-636-retained-smoke.cjs'),'utf8');assert.match(source,/const started=Date\.now\(\),budgetMs=240000/);assert.equal((source.match(/nativeInput\.testClick\(point\.x,point\.y\)/g)||[]).length,2,'The existing shell/guest driver sites remain single clicks');
});
