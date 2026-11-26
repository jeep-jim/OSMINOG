'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'mouse-632-documents-smoke.cjs'),'utf8');

function fixture(){
 const listeners=[],calls=[],clock={now:100,timeOrigin:123000},guard={clickUntil:280,dragActive:false,pending:false,finishing:false},nora={motion:{goal:0},isPreparing:false,holdsNative:false};
 const original=function(event){calls.push({target:this,type:event.type});return 'existing-handler';},button={tagName:'BUTTON',id:'documents-button',onclick:original,disabled:false,isConnected:true},tray={open:false,hidden:true,dataset:{motion:'closed'}},settings={open:false,matches:selector=>{assert.equal(selector,':modal');return false;}};
 const document={documentElement:{dataset:{mouseReady:'true'}},activeElement:button,hasFocus:()=>true,querySelector(selector){return{'#documents-button':button,'#settings-dialog':settings,'#desktop-tray':tray}[selector]??null;},addEventListener(type,handler,capture=false){listeners.push({type,handler,capture});},removeEventListener(type,handler,capture=false){const index=listeners.findIndex(item=>item.type===type&&item.handler===handler&&item.capture===capture);assert.ok(index>=0);listeners.splice(index,1);}};
 const MouseTest={desktopUI:nora,arrangement:{inputDiagnostics:()=>({now:clock.now,...guard})},overlays:{active:()=>false},documentsUI:{records:new Map()}};
 const context=vm.createContext({document,MouseTest,performance:{get timeOrigin(){return clock.timeOrigin;},now:()=>clock.now},module:{exports:{}},require:name=>name.startsWith('node:')?require(name):{}});
 // Loading the real smoke module only defines its runner. Its input probe runs
 // here against controlled DOM state; no native acceptance result is produced.
 vm.runInContext(source,context,{filename:'mouse-632-documents-smoke.cjs'});context.installDocumentInputProbe();
 return{context,document,MouseTest,clock,guard,nora,tray,button,original,calls,listeners,probe:context.__mouse632DocumentInput,snapshot(){return JSON.parse(JSON.stringify(this.probe.snapshot()));}};
}

test('document input snapshots read current Nora and arrangement state without performing UI work',()=>{
 const f=fixture();assert.equal(f.listeners.length,10);const handler=f.button.onclick;
 const before=JSON.parse(JSON.stringify(f.probe.begin()));
 assert.deepEqual(before.arrangement,{now:100,clickUntil:280,dragActive:false,pending:false,finishing:false});assert.deepEqual(before.nora,{open:false,hidden:true,motion:'closed',goal:0,isPreparing:false,holdsNative:false});
 f.clock.now=130;f.guard.clickUntil=0;f.guard.pending=true;f.tray.open=true;f.tray.hidden=false;f.tray.dataset.motion='opening';f.nora.motion.goal=1;f.nora.isPreparing=true;f.nora.holdsNative=true;
 const after=f.snapshot();assert.deepEqual(after.arrangement,{now:130,clickUntil:0,dragActive:false,pending:true,finishing:false});assert.deepEqual(after.nora,{open:true,hidden:false,motion:'opening',goal:1,isPreparing:true,holdsNative:true});assert.deepEqual(after.events,[]);
 assert.equal(after.buttonSelector,'#documents-button');assert.equal(after.handlerPresent,true);assert.equal(f.button.onclick,handler);assert.equal(f.listeners.length,10);assert.deepEqual(f.calls,[]);
 assert.equal(before.nora.open,false,'An earlier receipt must not change with the current state');assert.equal(before.arrangement.clickUntil,280);
});

test('document input probe preserves existing event tracing, handler and disposal with optional diagnostics absent',()=>{
 const f=fixture();delete f.MouseTest.arrangement;delete f.MouseTest.desktopUI;f.document.querySelector=selector=>({'#documents-button':f.button,'#settings-dialog':{open:false,matches:()=>false}}[selector]??null);
 const event={type:'click',isTrusted:false,defaultPrevented:false,button:0,buttons:0,clientX:10,clientY:20,target:f.button,composedPath:()=>[f.button]};
 for(const item of f.listeners.filter(item=>item.type==='click'&&item.capture))item.handler(event);
 assert.equal(f.button.onclick(event),'existing-handler');
 for(const item of f.listeners.filter(item=>item.type==='click'&&!item.capture))item.handler(event);
 const state=f.snapshot();assert.equal(state.arrangement,null);assert.deepEqual(state.nora,{open:null,hidden:null,motion:null,goal:null,isPreparing:null,holdsNative:null});assert.deepEqual(state.events.map(item=>item.phase),['capture','handler','bubble']);assert.ok(state.events.every(item=>item.trusted===false),'The passive probe preserves the observed trust value');assert.equal(f.calls.length,1);assert.equal(f.calls[0].target,f.button);
 f.probe.dispose();assert.equal(f.listeners.length,0);assert.equal(f.button.onclick,f.original);assert.equal(f.context.__mouse632DocumentInput,undefined);
});
