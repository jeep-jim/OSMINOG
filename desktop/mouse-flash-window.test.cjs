'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {FlashService,stunOnly}=require('./mouse-flash.cjs');
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function electronFixture(){
  const handlers=new Map(),windows=[],sessions=[],clipboard=[];
  class BrowserWindow extends EventEmitter{
    constructor(options){super();this.options=options;this.destroyed=false;this.webContents=new EventEmitter();this.webContents.mainFrame={processId:17,routingId:windows.length+1,url:'',detached:false};this.webContents.setWindowOpenHandler=handler=>this.openHandler=handler;windows.push(this);}
    isDestroyed(){return this.destroyed;}
    async loadURL(url){this.loaded=url;this.webContents.mainFrame.url=url;}
    show(){this.shown=true;}
    focus(){this.focused=true;}
    destroy(){if(this.destroyed)return;this.destroyed=true;this.emit('closed');}
  }
  const electron={BrowserWindow,ipcMain:{handle:(key,handler)=>{assert.equal(handlers.has(key),false);handlers.set(key,handler);},removeHandler:key=>handlers.delete(key)},
    session:{fromPartition:(partition,options)=>{
      const session=new EventEmitter();Object.assign(session,{partition,options,webRequest:{onBeforeRequest:(filter,handler)=>{session.requestFilter=filter;session.requestHandler=handler;}},
        setPermissionCheckHandler:handler=>session.permissionCheck=handler,setPermissionRequestHandler:handler=>session.permissionRequest=handler});sessions.push(session);return session;
    }},clipboard:{writeText:text=>clipboard.push(text)},dialog:{showOpenDialog:async()=>({canceled:true,filePaths:[]})},powerSaveBlocker:{start:()=>1,stop:()=>{}}};
  return{electron,handlers,windows,sessions,clipboard};
}
async function setup(t,options={}){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-flash-window-test-')),fixture=electronFixture();
  const device={identity:{deviceId:'a'.repeat(32),name:'Synthetic Mac',publicKey:'cHVibGlj'},sign:()=>({signature:'c2lnbmF0dXJl'})};
  let allowed=true;
  const service=new FlashService({electron:fixture.electron,directory,identity:device,canOpen:()=>allowed,...options});
  t.after(async()=>{await service.dispose();await fs.rm(directory,{recursive:true,force:true});});
  const event=()=>({sender:service.window.webContents,senderFrame:{...service.window.webContents.mainFrame}});
  return{...fixture,directory,service,event,setAllowed:value=>allowed=value};
}

test('Flash window has separate ephemeral session, sandbox and denied navigation/network/permissions',async t=>{
  const f=await setup(t);await f.service.open();const win=f.service.window,prefs=win.options.webPreferences,ses=f.sessions[0];
  assert.equal(prefs.sandbox,true);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.webSecurity,true);assert.equal(prefs.webviewTag,false);
  assert.match(prefs.partition,/^mouse-flash-[a-f0-9]{32}$/);assert.equal(prefs.partition.startsWith('persist:'),false);assert.equal(ses.options.cache,false);
  assert.equal(ses.permissionCheck(),false);let permission;ses.permissionRequest(null,'camera',v=>permission=v);assert.equal(permission,false);
  let prevented=0;for(const type of ['will-navigate','will-redirect','will-attach-webview'])win.webContents.emit(type,{preventDefault:()=>prevented++});ses.emit('will-download',{preventDefault:()=>prevented++});assert.equal(prevented,4);
  assert.deepEqual(win.openHandler(),{action:'deny'});let request;ses.requestHandler({url:'https://untrusted.invalid'},value=>request=value);assert.deepEqual(request,{cancel:true});
  assert.deepEqual(ses.requestFilter.urls,['http://*/*','https://*/*','ws://*/*','wss://*/*']);
  assert.match(prefs.additionalArguments[0],/^--mouse-flash-channel=mouse:flash-native:[a-f0-9]{32}$/);
  assert.match(win.loaded,/\/mouse\/flash\/index\.html$/);assert.equal(win.shown,true);
  await f.service.open();assert.equal(f.windows.length,1);assert.equal(win.focused,true);
});

test('only exact owning WebContents, main frame and local document can call native Flash',async t=>{
  const f=await setup(t);await f.service.open();const invoke=f.handlers.get(f.service.channel),valid=f.event();
  const config=await invoke(valid,'config',{});assert.equal(config.device.name,'Synthetic Mac');assert.equal(config.broker,null);assert.equal(config.freeLimitBytes,100000000000);assert.equal(config.blockBytes,1048576);
  const bad=[{...valid,sender:{}},{...valid,senderFrame:null},{...valid,senderFrame:{...valid.senderFrame,routingId:99}},{...valid,senderFrame:{...valid.senderFrame,processId:98}},
    {...valid,senderFrame:{...valid.senderFrame,detached:true}},{...valid,senderFrame:{...valid.senderFrame,url:'https://untrusted.invalid/'}},
    {...valid,senderFrame:{...valid.senderFrame,url:'file:///tmp/untrusted.html'}}];
  for(const event of bad)await assert.rejects(invoke(event,'copy-invite',{text:'mouse-flash://join#synthetic'}),/Untrusted Flash caller/);
  assert.equal(f.clipboard.length,0);await invoke(valid,'copy-invite',{text:'mouse-flash://join#synthetic'});assert.deepEqual(f.clipboard,['mouse-flash://join#synthetic']);
  await assert.rejects(invoke(valid,'arbitrary-read',{path:'/tmp/private'}),/Unsupported Flash action/);
  await assert.rejects(invoke(valid,'read-block',{sourceId:'foreign',fileId:'foreign',offset:0,length:1}),/Unknown source capability/);
  await assert.rejects(invoke(valid,'config',[]),/Invalid Flash request/);
});

test('private-mode guard blocks opening and all calls from an existing window',async t=>{
  const f=await setup(t);f.setAllowed(false);await assert.rejects(f.service.open(),/unavailable/);assert.equal(f.windows.length,0);
  f.setAllowed(true);await f.service.open();const event=f.event();f.setAllowed(false);
  await assert.rejects(f.service.handle(event,'config',{}),/unavailable/);await assert.rejects(f.service.handle(event,'identity-sign',{transcriptHash:'a'.repeat(64)}),/unavailable/);
  await f.service.pause();assert.equal(f.windows[0].isDestroyed(),true);assert.equal(f.service.context,null);
});

test('mode change while native file dialog is open rejects selection before creating a capability',async t=>{
  const selected=gate();const f=await setup(t,{choosePaths:()=>selected.promise});await f.service.open();const context=f.service.context;
  const pending=f.service.handle(f.event(),'choose-source',{});await new Promise(setImmediate);assert.equal(context.dialog,true);
  f.setAllowed(false);selected.resolve({canceled:false,filePaths:[path.join(f.directory,'must-not-be-opened')]});
  await assert.rejects(pending,/unavailable/);assert.equal(context.dialog,false);assert.equal(context.sourceIds.size,0);assert.equal(context.pending,0);
});

test('closing window revokes capabilities, retains selected transfer for explicit resume and removes handler on dispose',async t=>{
  let selected;const f=await setup(t,{choosePaths:async()=>({canceled:false,filePaths:[selected]})});
  selected=path.join(f.directory,'synthetic.txt');await fs.writeFile(selected,'Synthetic Flash file');await f.service.open();const event=f.event();
  const source=await f.service.handle(event,'choose-source',{});assert.equal(f.service.context.sourceIds.has(source.sourceId),true);
  const old=f.service.window;old.destroy();await f.service.stopping;assert.equal(f.service.context,null);
  await assert.rejects(f.service.handle(event,'read-block',{sourceId:source.sourceId,fileId:source.manifest.files[0].id,offset:0,length:1}),/Untrusted/);
  await f.service.open();assert.notEqual(f.service.window,old);const list=await f.service.handle(f.event(),'list-resumable',{});assert.equal(list.send.length,1);assert.equal(list.send[0].transferId,source.manifest.transferId);
  await f.service.dispose();assert.equal(f.handlers.has(f.service.channel),false);await assert.rejects(f.service.open(),/unavailable/);
});

test('late async results from a closed window are rejected and cannot escape to its renderer',async t=>{
  const f=await setup(t);await f.service.open();const event=f.event(),context=f.service.context,reply=gate();
  context.files.listResumable=()=>reply.promise;
  const pending=f.service.handle(event,'list-resumable',{});await new Promise(setImmediate);await f.service.pause();reply.resolve({send:[{synthetic:true}],receive:[]});
  await assert.rejects(pending,/unavailable/);assert.equal(context.pending,0);
});

test('two services use independent native channels and reject each other’s renderer',async t=>{
  const f=await setup(t);await f.service.open();
  const second=new FlashService({electron:f.electron,directory:path.join(f.directory,'second'),identity:{identity:{deviceId:'b'.repeat(32),name:'Second',publicKey:'cHVibGlj'},sign:()=>({signature:'c2ln'})}});
  t.after(()=>second.dispose());await second.open();assert.notEqual(second.channel,f.service.channel);assert.notEqual(second.window.options.webPreferences.partition,f.service.window.options.webPreferences.partition);
  await assert.rejects(second.handle(f.event(),'config',{}),/Untrusted/);assert.equal(f.handlers.size,2);
});

test('TURN and untrusted schemes are refused before window or network creation',()=>{
  assert.deepEqual(stunOnly(['stun:127.0.0.1:3478']),[{urls:'stun:127.0.0.1:3478'}]);
  for(const values of [['turn:relay.invalid:3478'],['turns:relay.invalid:443'],['https://server.invalid'],['stun:user@server.invalid'],['stun:server.invalid?credential=x']])assert.throws(()=>stunOnly(values));
});

test('sandbox preload exposes only allowlisted calls in main frame and keeps unique channel internal',async()=>{
  const code=await fs.readFile(path.join(__dirname,'mouse-flash-preload.cjs'),'utf8'),channel='mouse:flash-native:'+'a'.repeat(32),calls=[];
  function load(main,args){
    let exposed;
    vm.runInNewContext(code,{process:{isMainFrame:main,argv:args},require:name=>{
      assert.equal(name,'electron');
      return{contextBridge:{exposeInMainWorld:(name,api)=>exposed={name,api}},ipcRenderer:{invoke:(...values)=>{calls.push(values);return Promise.resolve({ok:true});}}};
    }});
    return exposed;
  }
  assert.equal(load(false,['--mouse-flash-channel='+channel]),undefined);
  const exposed=load(true,['--mouse-flash-channel='+channel]);assert.equal(exposed.name,'MouseFlashNative');assert.equal(Object.isFrozen(exposed.api),true);assert.deepEqual(Object.keys(exposed.api),['call']);
  await exposed.api.call('config');assert.equal(calls.length,1);assert.equal(calls[0][0],channel);assert.equal(calls[0][1],'config');
  await assert.rejects(exposed.api.call('read-any-path',{path:'/tmp/private'}),/Unsupported/);assert.equal(calls.length,1);
  await assert.rejects(load(true,[]).api.call('config'),/not configured/);assert.equal(calls.length,1);
});
