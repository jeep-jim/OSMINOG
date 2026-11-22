'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{randomUUID}=require('node:crypto');
const Desktops=require('./mouse-desktops.cjs'),TabOrder=require('./mouse/mouse-613-ui.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const source=fs.readFileSync(process.env.MOUSE_628_CLEANUP_TEST_SOURCE||path.join(__dirname,'mouse-628-local-smoke.cjs'),'utf8');
function between(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a,'Actual fixture boundaries are present');return text.slice(a,b);}
const snapshot=between(source,' const original=await js(', '\n const base=');
const variables=between(source,' let client,verificationError,cleanupError,openedId', '\n const action=');
const setup=between(source,'  assert.equal(agentHost.state().enabled,false);', '\n  agentHost.dialog=');
const completion=between(source,'  facts.completed=true;', "console.log('MOUSE_628_LOCAL_MCP_NATIVE_PASS');");
const prefs=between(fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),' const prefs=()=>(', '\n function save(');

// These are unit adapters for Electron surfaces. Both tab stores, mode planning,
// desktop commands, persistence and the fixture's restoration code are real.
async function harness({reuse=''}={}){
 const handlers=new Map(),saved={quadroPreferences:{theme:'dark',locale:'ru',libraryWidth:350,aiSites:[],aiPreviewRatio:.5,agentPreviewId:'',presetTabs:{}}},closed=[];
 let closeFailure=null,webContentsId=10,lastFacts;
 const store={get:async()=>saved,set:async value=>{Object.assign(saved,structuredClone(value));},queue:Promise.resolve()};
 const win={isDestroyed:()=>false,isFullScreen:()=>false,isMaximized:()=>false,getBounds:()=>({x:0,y:0,width:1200,height:900}),setBounds(){},webContents:{send(){}}};
 const browser={tabs:new Map(),providers:new Map(),project:'owned-project',
  state(){return{tabs:[...this.tabs.values()].map(page=>({id:page.id,title:page.title,lane:page.lane,url:page.url,internal:false}))};},
  make(url='https://fixture.test/'){
   const page={id:randomUUID(),url,title:'Owned unit page',lane:'main',navigationEpoch:1,visible:false};
   page.view={webContents:{id:++webContentsId,isDestroyed:()=>false,getURL:()=>page.url}};
   this.tabs.set(page.id,page);return page;
  },get(id){return this.tabs.get(id);},save:async()=>{},layout(){},dispose(){this.disposed=true;},emit(){return this.state();},
  async command(action,args={}){
   if(action==='state')return this.state();
   if(action==='open'){const page=this.make(args.url);page.lane=args.lane||'main';this.emit();return{id:page.id};}
   if(action==='close'){this.tabs.delete(args.id);this.emit();return this.state();}
   throw Error('Unexpected native unit command '+action);
  }};
 const ipcMain={handle:(name,handler)=>handlers.set(name,handler)},trusted=()=>{};
 const startModule={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-start.cjs'),'utf8'),{module:startModule,exports:startModule.exports,require:id=>id==='electron'?{nativeImage:{}}:require(id)});
 const startService=await startModule.exports.install({app:{getPath:()=>os.tmpdir()},win,browser,store,ipcMain,trusted,libraryService:{library:{input(){}},search:{resolve:value=>value}}});
 const originalNative=browser.make('https://fixture.test/original');
 const originalInternal=(await browser.command('open',{url:'mouse://start'})).id;
 const desktop=await Desktops.install({browser,store,ipcMain,trusted,win});browser.mouseDesktops=desktop;
 const call=(action,args)=>handlers.get('mouse:desktops')({},action,args);
 await call('switch',{id:'desk-1',from:'desk-3',preferences:desktop.preferences()});
 const otherNative=(await browser.command('open',{url:'https://fixture.test/other-desk'})).id;
 const otherInternal=(await browser.command('open',{url:'mouse://start'})).id;
 await call('switch',{id:'desk-3',from:'desk-1',preferences:desktop.preferences()});
 let reusedId='';
 if(reuse){
  const result=await call('apply-mode',{mode:'agents',from:'desk-3',preferences:desktop.preferences()});reusedId=result.preferences.agentPreviewId;
  if(reuse==='native')await browser.command('navigate',{id:reusedId,url:'http://127.0.0.1:4321/existing-app'});
 }
 const originalState={bank:desktop.bank.snapshot(),native:new Map(browser.tabs),internal:[...startService.tabs.keys()].sort()};
 const model={...desktop.preferences(),pinnedPanes:{},state:browser.state(),focusPane:'',focusAI:false,libraryOpen:false};
 const renderer=vm.createContext({m:model,MouseTabOrder:TabOrder});
 const realPrefs=vm.runInContext(prefs+'\n prefs',renderer);
 const MouseTest={model,prefs:()=>clone(realPrefs()),desktopUI:{close(){}},restorePane(){},setTheme:theme=>{model.theme=theme;},renderTree(){},renderAISites(){},applySide(){},
  async applyMode(mode){const result=await call('apply-mode',{mode,from:model.desktopId,preferences:realPrefs()});Object.assign(model,result.preferences);model.state=result.state;},
  save:()=>desktop.savePreferences(realPrefs())};
 Object.assign(renderer,{MouseTest,MouseNative:{init:async()=>({state:browser.state(),preferences:desktop.preferences()})},MouseFlush:()=>desktop.flush(),document:{querySelector:()=>({hidden:false})}});
 const js=async text=>vm.runInContext(text,renderer);
 const agentHost={dialog:{},folder:'original-folder',logs:[],mcp:new EventEmitter(),dev:{state:()=>({running:false})},state:()=>({enabled:false}),emit(){},async stop(){}};
 agentHost.mcp.connected=false;
 const privateMode={current:null,toggle:async()=>{throw Error('Unexpected private transition in cleanup unit');}};
 const originalCommand=browser.command.bind(browser);
 browser.command=async(action,args)=>{
  if(action==='close'){closed.push(args.id);if(closeFailure?.id===args.id)throw closeFailure.error;}
  return originalCommand(action,args);
 };
 const run=async body=>{
  const context={win,browser,store,agentHost,startService,privateMode,js,assert,require,copy:clone,
   until:async check=>{assert.ok(await check(),'Unit surface must already be ready');},
   afterSetup:body||(async()=>{}),onSave:facts=>{lastFacts=clone(facts);}};
  const script=`(async()=>{${snapshot}\n${variables}\nconst facts={completed:false,restored:false,status:'running'},action=()=>{},change=()=>{},save=async()=>onSave(facts);\ntry{${setup}\nopenedId=await afterSetup({agentId:MouseAgentId(),facts});\n${completion}\nreturn facts;})()`;
  context.MouseAgentId=()=>model.agentPreviewId;
  return vm.runInNewContext(script,context);
 };
 return{browser,startService,desktop,closed,run,originalState,originalNative,originalInternal,otherNative,otherInternal,reusedId,
  failClose:(id,error)=>{closeFailure={id,error};},get facts(){return lastFacts;},dispose:()=>browser.dispose()};
}

test('actual Local cleanup closes only its new internal Agents landing and native localhost, restoring both stores',async()=>{
 const h=await harness();let landing,localhost;
 try{
  const facts=await h.run(async({agentId})=>{
   landing=agentId;assert.ok(h.startService.tabs.has(landing));assert.equal(h.browser.tabs.has(landing),false);
   assert.ok(!h.originalState.internal.includes(landing));localhost=(await h.browser.command('open',{url:'http://127.0.0.1:4321/new-app'})).id;return localhost;
  });
  assert.equal(facts.restored,true);assert.equal(facts.status,'pass');assert.deepEqual(clone(facts.agentLanding),{id:landing,createdByFixture:true});
  assert.deepEqual(h.closed,[localhost,landing]);assert.deepEqual(h.desktop.bank.snapshot(),h.originalState.bank);
  assert.deepEqual([...h.startService.tabs.keys()].sort(),h.originalState.internal);
  for(const [id,page]of h.originalState.native)assert.equal(h.browser.tabs.get(id),page);
  assert.equal(h.desktop.bank.members[h.otherNative],'desk-1');assert.equal(h.desktop.bank.members[h.otherInternal],'desk-1');
 }finally{h.dispose();}
});

test('pre-existing internal and native Agents landings are reused and never claimed or closed',async()=>{
 for(const reuse of ['internal','native']){
  const h=await harness({reuse});let localhost;
  try{
   const facts=await h.run(async({agentId})=>{assert.equal(agentId,h.reusedId);localhost=(await h.browser.command('open',{url:'http://127.0.0.1:4321/new-app'})).id;return localhost;});
   assert.equal(facts.status,'pass');assert.deepEqual(clone(facts.agentLanding),{id:h.reusedId,createdByFixture:false});assert.deepEqual(h.closed,[localhost]);
   assert.deepEqual(h.desktop.bank.snapshot(),h.originalState.bank);assert.deepEqual([...h.startService.tabs.keys()].sort(),h.originalState.internal);
   if(reuse==='native')assert.equal(h.browser.tabs.get(h.reusedId),h.originalState.native.get(h.reusedId));else assert.ok(h.startService.tabs.has(h.reusedId));
  }finally{h.dispose();}
 }
});

test('unexpected extra internal or native pages remain visible to the original strict restoration assertion',async()=>{
 for(const internal of [true,false]){
  const h=await harness();let extra,landing;
  try{
   await assert.rejects(h.run(async({agentId})=>{landing=agentId;extra=(await h.browser.command('open',{url:internal?'mouse://start':'https://fixture.test/unexpected'})).id;}),error=>error.code==='ERR_ASSERTION');
   assert.deepEqual(h.closed,[landing]);assert.equal(h.facts.status,'fail');assert.equal(h.facts.restored,false);
   assert.ok(internal?h.startService.tabs.has(extra):h.browser.tabs.has(extra),'Unknown pages must not be swept away to pass cleanup');
   for(const [id,page]of h.originalState.native)assert.equal(h.browser.tabs.get(id),page);
  }finally{h.dispose();}
 }
});

test('a fixture-owned landing already closed by the scenario is not closed again',async()=>{
 const h=await harness();let landing;
 try{
  const facts=await h.run(async({agentId})=>{landing=agentId;await h.browser.command('close',{id:landing});});
  assert.equal(facts.status,'pass');assert.deepEqual(h.closed,[landing]);assert.deepEqual(h.desktop.bank.snapshot(),h.originalState.bank);
 }finally{h.dispose();}
});

test('an owned-page close failure remains the original cleanup failure',async()=>{
 const h=await harness(),error=new Error('Owned close failed');let landing;
 try{
  await assert.rejects(h.run(async({agentId})=>{landing=agentId;h.failClose(landing,error);}),cause=>cause===error);
  assert.equal(h.facts.status,'fail');assert.equal(h.facts.restored,false);assert.match(h.facts.cleanupError,/Owned close failed/);assert.ok(h.startService.tabs.has(landing));assert.deepEqual(h.closed,[landing]);
 }finally{h.dispose();}
});

test('an original scenario failure is retained even if owned-page cleanup also fails',async()=>{
 const h=await harness(),original=new Error('Original Local scenario failed'),cleanup=new Error('Owned cleanup failed');
 try{
  await assert.rejects(h.run(async({agentId})=>{h.failClose(agentId,cleanup);throw original;}),cause=>cause===original);
  assert.equal(h.facts.error.message,original.message);assert.match(h.facts.cleanupError,/Owned cleanup failed/);assert.equal(h.facts.status,'fail');assert.equal(h.facts.restored,false);
 }finally{h.dispose();}
});
