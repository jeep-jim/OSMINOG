'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const load=(file,overrides={})=>{const filename=require.resolve(file),module={exports:{}},localRequire=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:id=>Object.hasOwn(overrides,id)?overrides[id]:localRequire(id)},{filename});return module.exports;};
const helpers=load('./mouse-631-smoke-helpers.cjs',{electron:{},'./mouse-628-ui-smoke.cjs':{},'./mouse-smoke-frames.cjs':{}}),dependencies={'./mouse-631-smoke-helpers.cjs':helpers};
const {fixtures:{ownedPage,assertGuest,assertShell,ORIGINAL,DIMMED}}=load('./mouse-637-sidebar-focus-smoke.cjs',dependencies);
const guest=enabled=>({buttonReceivesPoint:true,viewport:{width:400,height:700},mask:enabled?{count:1,ariaHidden:'true',inert:true,closedShadow:true,pointerEvents:'none',backdropPointerEvents:'none',popoverOpen:true,bounds:{x:0,y:0,width:400,height:700}}:null});
const shell=(enabled,kind)=>({theme:'dark',dimmed:enabled,settingsOpen:kind==='settings',libraryOpen:kind==='library',start:{internal:true,visible:true},mask:{pointerEvents:'none',backgroundColor:'rgba(0, 0, 0, 0.14)',content:enabled?'""':'none'},toolbar:{backgroundColor:'rgb(14, 19, 28)',backgroundImage:'linear-gradient(fixture)'},settings:{backgroundColor:'rgb(14, 19, 28)',backgroundImage:'linear-gradient(fixture)'},library:{backgroundColor:'rgb(14, 19, 28)',backgroundImage:'linear-gradient(fixture)'}});
test('sidebar OS witness oracle independently expects fourteen-percent attenuation and complete restoration',()=>{
 assert.deepEqual([...ORIGINAL],[37,143,191]);assert.deepEqual([...DIMMED],[32,123,164]);for(let i=0;i<3;i++)assert.equal(DIMMED[i],Math.round(ORIGINAL[i]*.86));
 const fixture=ownedPage();assert.ok(fixture.html.includes('<link rel="stylesheet" href="/site.css">'));assert.ok(!fixture.html.includes('<style>'));assert.match(fixture.css,/background:rgb\(37,143,191\)/);assert.match(fixture.html,/event\.isTrusted/);
});
test('native presentation gate rejects intercepted input, exposed shadow content and incomplete viewport coverage',()=>{
 assertGuest(guest(false),false);assertGuest(guest(true),true);
 for(const change of [v=>v.buttonReceivesPoint=false,v=>v.mask.pointerEvents='auto',v=>v.mask.backdropPointerEvents='auto',v=>v.mask.closedShadow=false,v=>v.mask.inert=false,v=>v.mask.count=2,v=>v.mask.popoverOpen=false,v=>v.mask.bounds.height=120]){const value=guest(true);change(value);assert.throws(()=>assertGuest(value,true));}
 assert.throws(()=>assertGuest(guest(true),false),'Closing must actually remove the page layer');
});
test('shell presentation gate verifies each actual sidebar flag, internal owner, backdrop and dark toolbar surface',()=>{
 assertShell(shell(false),false);for(const kind of ['settings','library'])assertShell(shell(true,kind),true,kind);
 for(const change of [v=>v.dimmed=false,v=>v.libraryOpen=true,v=>v.start.visible=false,v=>v.start.internal=false,v=>v.mask.pointerEvents='auto',v=>v.mask.backgroundColor='rgba(0, 0, 0, 0.4)',v=>v.settings.backgroundColor='white']){const value=shell(true,'settings');change(value);assert.throws(()=>assertShell(value,true,'settings'));}
});

test('sidebar fixture treats the real start service as internal and closes only its owned start tab after a later failure',async()=>{
 const startModule=load('./mouse-start.cjs',{electron:{nativeImage:{}}}),nativePage={id:'owned-native'},otherNative={id:'other-native'},nativePages=[nativePage,otherNative],nativeTabs=new Map(nativePages.map(page=>[page.id,page]));let saved={},nativeLookups=0;
 const browser={tabs:nativeTabs,state:()=>({tabs:nativePages.map(page=>({id:page.id,url:'https://owned.invalid/',internal:false}))}),save:async()=>{},emit(){},command:async()=>{throw Error('Unexpected native command');},get(){nativeLookups++;throw Error('An internal start tab is not a native page');}};
 const service=await startModule.install({app:{getPath:()=>'/tmp/mouse637-sidebar-unit'},win:{isDestroyed:()=>false,webContents:{send(){}}},browser,store:{get:async()=>saved,set:async value=>{saved=structuredClone(value);}},libraryService:{library:{},search:{}},ipcMain:{handle(){}},trusted:()=>{}});
 const original=await browser.command('open',{url:'mouse://start'}),failure=Error('Owned later layout failure'),closed=[],created=[nativePage],facts={};let stopped=false;
 const fixture={bank:{active:'desk-owned'},created,open:async()=>nativePage,js:async source=>{
  if(source.includes('MouseTest.settingsUI.close()'))throw failure;
  return vm.runInNewContext(source,{MouseTest:{mutateDesktopTabs:async(action,args)=>{assert.equal(action,'close-tab');closed.push(args.id);return browser.command('close',args);}}});
 }};
 const verify=load('./mouse-637-sidebar-focus-smoke.cjs',{...dependencies,'node:http':{createServer:()=>({once(){},listen(_port,_host,ready){ready();},address:()=>({port:41005}),closeAllConnections(){},close(done){stopped=true;done();}})}});
 await assert.rejects(verify({browser,fixture,facts,records:nativePages}),error=>error===failure);
 assert.equal(nativeLookups,0);assert.deepEqual(created,[nativePage]);assert.equal(closed.length,1);assert.notEqual(closed[0],original.id);assert.equal(service.tabs.has(closed[0]),false);assert.equal(service.tabs.has(original.id),true);
 assert.deepEqual([...nativeTabs.values()],nativePages);assert.deepEqual(saved.quadroStartTabs.map(tab=>tab.id),[original.id]);assert.equal(stopped,true);assert.equal(facts.sidebarFocus.ok,false);
 await browser.command('close',{id:original.id});assert.equal(service.tabs.size,0);
});
