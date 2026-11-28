'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {createFrameLease}=require('./mouse-frame-lease.cjs');
const {installIPCSwitch}=require('./mouse-private-core.cjs'),{trustedFrame}=require('./trust.cjs');
// Exercise the shipped registration with the native owner and private IPC
// router: neither guest pages nor private mode may bypass shell authorization.
function fixture(platform='darwin'){
 const callbacks=new Map(),ipcMain={handle:(name,fn)=>callbacks.set(name,fn)},state={closing:false,locked:false,destroyed:false,contentsDestroyed:false,visible:true,minimized:false,focused:true,redraws:0,throttled:true};
 const entry='file:///Mouse/resources/app.asar/mouse/index.html',mainFrame={processId:41,routingId:7,url:entry};
 const contents=Object.assign(new EventEmitter(),{mainFrame,isDestroyed:()=>state.contentsDestroyed,invalidate:()=>state.redraws++,getBackgroundThrottling:()=>state.throttled,setBackgroundThrottling:value=>{state.throttled=value;}});
 const win=Object.assign(new EventEmitter(),{isDestroyed:()=>state.destroyed,isVisible:()=>state.visible,isMinimized:()=>state.minimized,isFocused:()=>state.focused,webContents:contents});
 const router=installIPCSwitch(ipcMain,()=>win.webContents),handlers=new Map();
 const trusted=event=>{if(!trustedFrame(event,win,entry))throw Error('Untrusted frame');};
 const frameLease=createFrameLease({win,platform,authorize:event=>{trusted(event);return true;},isLocked:()=>state.locked,isClosing:()=>state.closing});
 const context={isMac:platform==='darwin',process:{platform},ipcMain,frameLease,handlers,router};
 const registration=fs.readFileSync(require.resolve('./mouse-main.cjs'),'utf8').split('\n').find(line=>line.includes("ipcMain.handle('mouse:frame-lease'"));
 const privateRoute=fs.readFileSync(require.resolve('./mouse-private.cjs'),'utf8').split('\n').find(line=>line.includes("handlers.set('mouse:frame-lease'"));
 assert(registration&&privateRoute,'Both shipped shell registrations must exist');vm.runInNewContext(registration,context);vm.runInNewContext(privateRoute,context);
 return{state,win,router,handlers,frameLease,invoke:callbacks.get('mouse:frame-lease'),event:{sender:contents,senderFrame:{...mainFrame}}};
}
test('foreground leases preserve trusted authorization in normal and private Mac shells',()=>{
 const f=fixture();try{for(const privateMode of [false,true]){
  f.router.use(privateMode?f.handlers:null);const before=f.state.redraws;
  const grant=f.invoke(f.event,'begin');assert.equal(grant.active,true);assert.equal(f.state.throttled,false);assert.equal(f.state.redraws,before+1);
  for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{...f.event.senderFrame,routingId:8}},{...f.event,senderFrame:{...f.event.senderFrame,url:'https://untrusted.example/'}}])assert.throws(()=>f.invoke(event,'end',grant.token),/Untrusted frame/);
  assert.equal(f.state.throttled,false);assert.equal(f.state.redraws,before+1);
  assert.equal(f.invoke(f.event,'end',grant.token).released,true);assert.equal(f.state.throttled,true);assert.equal(f.frameLease.state().active,false);
 }}finally{f.frameLease.destroy();}
});
test('IPC cannot wake background windows or start a lease during profile lock and shutdown',()=>{
 const f=fixture();try{
  for(const key of ['closing','locked','contentsDestroyed','minimized']){f.state[key]=true;assert.equal(f.invoke(f.event,'begin').active,false);f.state[key]=false;}
  for(const key of ['visible','focused']){f.state[key]=false;assert.equal(f.invoke(f.event,'begin').active,false);f.state[key]=true;}
  f.state.destroyed=true;assert.throws(()=>f.invoke(f.event,'begin'),/Untrusted frame/);assert.equal(f.state.redraws,0);assert.equal(f.state.throttled,true);
 }finally{f.frameLease.destroy();}
});
test('frame scheduling capability remains Mac-only in normal and private routes',()=>{
 for(const platform of ['win32','linux']){const f=fixture(platform);try{assert.equal(f.invoke,undefined);assert.equal(f.handlers.has('mouse:frame-lease'),false);}finally{f.frameLease.destroy();}}
});
test('sandboxed preload preserves begin/end argument counts and exposes no native diagnostic owner',()=>{
 const source=fs.readFileSync(require.resolve('./mouse-preload.cjs'),'utf8');
 for(const platform of ['darwin','win32','linux']){
  let exposed;const calls=[],electron={contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'MouseNative');exposed=value;}},ipcRenderer:{invoke:(...args)=>{calls.push(args);return Promise.resolve(null);},on:()=>{},removeListener:()=>{}}};
  vm.runInNewContext(source,{require:name=>{assert.equal(name,'electron');return electron;},process:{platform,arch:'arm64',isMainFrame:true,argv:[]}});
  assert.equal('mouseFrameLeaseForTest' in exposed,false);assert.equal('requestRedraw' in exposed,false);
  if(platform==='darwin'){exposed.frameLease('begin');exposed.frameLease('end','token');assert.deepEqual(calls,[['mouse:frame-lease','begin'],['mouse:frame-lease','end','token']]);}
  else assert.equal('frameLease' in exposed,false);
 }
 assert.ok(require('./mouse-build.cjs').files.includes('mouse-frame-lease.cjs'),'The installed app must contain the native owner');
});
