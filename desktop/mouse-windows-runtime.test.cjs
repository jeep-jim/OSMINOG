'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {MouseUpdates,WINDOWS_CHANNEL,channelCandidate,selectRelease,releaseTarget}=require('./mouse-update.cjs');
const {WindowsInstaller,windowsPackage,acknowledgeWindows,ordinaryWindowsDirectory,WINDOWS_HELPER,startWindowsHelper}=require('./mouse-install-update.cjs');
const target={platform:'win32',arch:'x64'};
const manifest=(patch={})=>({schema:1,...target,version:'6.0.30',url:'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.30-x64/Mouse-Browser-6.0.30-Windows-x64.exe',size:100,digest:'sha256:'+'a'.repeat(64),...patch});
function load(name,stubs={}){const mod={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,name),'utf8'),{module:mod,exports:mod.exports,require:id=>Object.hasOwn(stubs,id)?stubs[id]:require(id),process,Buffer,URL,Date,AbortSignal,setTimeout,clearTimeout,console},{filename:name});return mod.exports;}

test('Windows update discovery uses its dedicated channel and cannot select any Mac or Trader package',async()=>{
 const calls=[],u=new MouseUpdates({target,app:{getVersion:()=> '6.0.29'},fetcher:async url=>{calls.push(url);return{ok:true,json:async()=>manifest()};}});
 assert.equal((await u.run('check')).phase,'available');assert.deepEqual(calls,[WINDOWS_CHANNEL]);assert.equal(u.candidate.name,'Mouse-Browser-6.0.30-Windows-x64.exe');
 const c=manifest(),release={tag_name:'mouse-windows-v6.0.30-x64',assets:[{name:u.candidate.name,state:'uploaded',size:c.size,digest:c.digest,browser_download_url:c.url}]};
 assert.equal(selectRelease([release],'6.0.29',target).version,'6.0.30');assert.equal(selectRelease([release],'6.0.29'),null);
 assert.equal(selectRelease([{...release,tag_name:'windows-v6.0.30'},{...release,tag_name:'quadro-macos-v6.0.30-arm64'}],'6.0.29',target),null);
 assert.equal(selectRelease([{...release,draft:true}],'6.0.29',target),null);
});
test('Windows metadata rejects cross-platform, hashless, foreign, oversized and downgraded packages',()=>{
 for(const patch of [{platform:'darwin'},{arch:'arm64'},{size:536870913},{size:0},{size:1.2},{digest:'sha256:bad'},{url:'https://evil.example/Mouse.exe'}])assert.throws(()=>channelCandidate(manifest(patch),'6.0.29',target));
 assert.equal(channelCandidate(manifest(),'6.0.30',target),null);assert.equal(channelCandidate(manifest(),'6.0.31',target),null);assert.throws(()=>releaseTarget({platform:'win32',arch:'arm64'}));
 const c=channelCandidate(manifest(),'6.0.29',target);assert.equal(windowsPackage(c),c);assert.throws(()=>windowsPackage({...c,name:'Mouse-Browser-6.0.30-mac-arm64.dmg'}));assert.throws(()=>windowsPackage({...c,url:c.url.replace('OSMINOG-Releases','other')}));
});
test('Windows API fallback preserves platform filtering and network failures remain errors',async()=>{
 const u=new MouseUpdates({target,app:{getVersion:()=> '6.0.29'},fetcher:async()=>({ok:false,status:503})});await assert.rejects(()=>u.run('check'),/503/);assert.equal(u.state.phase,'error');
});

async function installerFixture(){
 const temporary=await fsp.mkdtemp(path.join(os.tmpdir(),'mouse-windows-test-')),root=process.platform==='win32'?temporary:await fsp.realpath(temporary),dir=path.join(root,'Mouse — spaces'),profile=path.join(root,'profile'),temp=path.join(root,'temp');await Promise.all([fsp.mkdir(dir),fsp.mkdir(profile),fsp.mkdir(temp)]);
 const executable=path.join(dir,'Mouse Browser.exe');await fsp.writeFile(executable,'MZ installed');await fsp.writeFile(path.join(dir,'Uninstall Mouse Browser.exe'),'MZ uninstaller');
 const bytes=Buffer.from('MZ synthetic installer; never executed'),file=path.join(root,'Mouse-Browser-6.0.30-Windows-x64.exe');await fsp.writeFile(file,bytes);
 const candidate=channelCandidate(manifest({size:bytes.length,digest:'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex')}),'6.0.29',target),app={isPackaged:true,getVersion:()=> '6.0.30',getPath:name=>name==='temp'?temp:profile};
 return{root,dir,profile,temp,executable,file,candidate,app,arch:'x64',cleanup:()=>fsp.rm(root,{recursive:true,force:true})};
}
function helperRuntime(onLaunch=()=>{},initialExit=null){
 const handle={},state={exitCode:initialExit,released:0,stopped:0,args:null};
 const native={
  launchUpdateHelper(...args){state.args=args;onLaunch(...args);return{pid:12345,handle};},
  updateHelperStatus(value){assert.equal(value,handle);return{running:state.exitCode===null,exitCode:state.exitCode};},
  stopUpdateHelper(value){assert.equal(value,handle);state.stopped++;state.exitCode=1;return true;},
  releaseUpdateHelper(value){assert.equal(value,handle);state.released++;},
 };
 return{native,state};
}
test('Windows installer validates real package bytes and installed identity before preparing any replacement',async()=>{
 const f=await installerFixture();try{
  const installer=new WindowsInstaller({...f,platform:'win32',quit:async()=>{throw Error('must not quit during preparation');}}),plan=await installer.prepare(f.file,f.candidate);
  assert.equal(plan.target,f.dir);assert.equal(plan.executable,f.executable);assert.equal(plan.hash,f.candidate.hash);assert.equal(JSON.parse(await fsp.readFile(path.join(plan.stage,'plan.json'),'utf8')).file,f.file);
  await fsp.appendFile(f.file,'changed');await assert.rejects(()=>installer.prepare(f.file,f.candidate),/изменился/);
  await assert.rejects(()=>new WindowsInstaller({...f,platform:'darwin'}).prepare(f.file,f.candidate),/Windows/);
 }finally{await f.cleanup();}
});
test('Windows install path accepts an ordinary directory but rejects a junction or symlink in any ancestor',async()=>{
 const f=await installerFixture();try{
  await ordinaryWindowsDirectory(f.dir);
  const alias=path.join(f.root,'alias');await fsp.symlink(f.dir,alias,process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>ordinaryWindowsDirectory(alias),/символическую/);
  await fsp.mkdir(path.join(f.dir,'child'));await assert.rejects(()=>ordinaryWindowsDirectory(path.join(alias,'child')),/символическую/);
 }finally{await f.cleanup();}
});
test('failed browser save cancels the held Windows helper and never acknowledges a new version',async()=>{
 const f=await installerFixture();try{
  let installer;const runtime=helperRuntime(()=>fs.writeFileSync(installer.plan.ready,'ready'));
  installer=new WindowsInstaller({...f,platform:'win32',quit:async()=>{throw Error('save failed');},nativeHelper:runtime.native});
  await installer.prepare(f.file,f.candidate);await assert.rejects(()=>installer.install(),/save failed/);
  assert.equal(await fsp.readFile(installer.plan.cancel,'utf8'),'cancel');const [encoded,entries,cwd,out,err]=runtime.state.args;
  assert.equal(Buffer.from(encoded,'base64').toString('utf16le'),WINDOWS_HELPER);assert.ok(!WINDOWS_HELPER.includes(f.dir),'Unicode/space install path is data, never interpolated script source');
  assert.ok(entries.includes('MOUSE_INSTALL_PLAN='+path.join(installer.plan.stage,'plan.json')));assert.equal(cwd,installer.plan.stage);assert.ok(Number.isInteger(out)&&Number.isInteger(err));
  assert.equal(runtime.state.stopped,1);assert.equal(runtime.state.released,1);assert.equal(installer.child.exitCode,1);assert.equal(installer.child.killed,true);
  assert.equal(await fsp.readFile(installer.plan.helperOut,'utf8'),'');assert.equal(await fsp.readFile(installer.plan.helperErr,'utf8'),'');
 }finally{await f.cleanup();}
});
test('a Windows helper exiting zero before readiness fails immediately and preserves its diagnostic',{timeout:3000},async()=>{
 const f=await installerFixture();try{
  let quit=false,installer;const runtime=helperRuntime(()=>fs.writeFileSync(installer.plan.result,'Helper diagnostic before readiness'),0);
  installer=new WindowsInstaller({...f,platform:'win32',quit:async()=>{quit=true;},nativeHelper:runtime.native});
  await installer.prepare(f.file,f.candidate);await assert.rejects(()=>installer.install(),/до подтверждения \(код 0\): Helper diagnostic before readiness/);
  assert.equal(quit,false);assert.equal(runtime.state.stopped,0,'an exited process is released, not terminated again');assert.equal(runtime.state.released,1);assert.equal(await fsp.readFile(installer.plan.cancel,'utf8'),'cancel');assert.equal(fs.existsSync(installer.plan.ready),false);
 }finally{await f.cleanup();}
});
test('a native helper creation error leaves Mouse open and cancels the prepared plan',async()=>{
 const f=await installerFixture();try{
  let quit=false;const runtime=helperRuntime(()=>{throw Error('CreateProcess refused the helper');}),installer=new WindowsInstaller({...f,platform:'win32',nativeHelper:runtime.native,quit:async()=>{quit=true;}});
  await installer.prepare(f.file,f.candidate);await assert.rejects(()=>installer.install(),/CreateProcess refused/);
  assert.equal(quit,false);assert.equal(installer.child,null);assert.equal(runtime.state.stopped,0);assert.equal(runtime.state.released,0);
  assert.equal(await fsp.readFile(installer.plan.cancel,'utf8'),'cancel');assert.equal(fs.existsSync(installer.plan.ready),false);assert.equal(await fsp.readFile(f.executable,'utf8'),'MZ installed');
 }finally{await f.cleanup();}
});
test('a native helper status error stays observable even if releasing its handle also fails',{timeout:3000},async()=>{
 const f=await installerFixture();try{
  let quit=false;const runtime=helperRuntime(),failure=Error('Helper status unavailable');
  runtime.native.updateHelperStatus=()=>{throw failure;};runtime.native.releaseUpdateHelper=()=>{runtime.state.released++;throw Error('Handle release failed');};
  const installer=new WindowsInstaller({...f,platform:'win32',nativeHelper:runtime.native,quit:async()=>{quit=true;}});
  await installer.prepare(f.file,f.candidate);await assert.rejects(()=>installer.install(),error=>error===failure);
  assert.equal(quit,false);assert.equal(installer.child.mouseHelperState.error,failure);assert.equal(runtime.state.released,1);
  assert.equal(await fsp.readFile(installer.plan.cancel,'utf8'),'cancel');assert.equal(fs.existsSync(installer.plan.ready),false);
 }finally{await f.cleanup();}
});
test('the Windows helper resets only its inherited PowerShell module path and preserves the isolated profile',async()=>{
 const f=await installerFixture();let child;try{
  const installer=new WindowsInstaller({...f,platform:'win32'}),plan=await installer.prepare(f.file,f.candidate),env={PSModulePath:'PS7 modules',pSmOdUlEpAtH:'another PS7 path',PATH:'keep executable search',CI:'true',MOUSE_TEST_PROFILE:f.profile},original={...env},runtime=helperRuntime();
  child=await startWindowsHelper(plan,{env,native:runtime.native});const entries=runtime.state.args[1];
  assert.deepEqual(env,original);assert.equal(entries.some(value=>value.slice(0,value.indexOf('=')).toLowerCase()==='psmodulepath'),false);
  for(const [key,value]of Object.entries({PATH:env.PATH,CI:'true',MOUSE_TEST_PROFILE:f.profile,MOUSE_INSTALL_PLAN:path.join(plan.stage,'plan.json')}))assert.ok(entries.includes(key+'='+value));
 }finally{child?.kill();await f.cleanup();}
});
test('Windows acknowledgement is bound to the running version, executable and dedicated temp stage',async()=>{
 const f=await installerFixture();try{
  const installer=new WindowsInstaller({...f,platform:'win32'}),p=await installer.prepare(f.file,f.candidate),receipt={platform:'win32',version:'6.0.30',target:f.executable,stage:p.stage};
  await fsp.writeFile(p.receipt,JSON.stringify({...receipt,version:'6.0.31'}));await acknowledgeWindows(f.app,f.executable);assert.equal(fs.existsSync(p.receipt),true);assert.equal(fs.existsSync(path.join(p.stage,'READY')),false);
  await fsp.writeFile(p.receipt,JSON.stringify(receipt));await acknowledgeWindows(f.app,f.executable);assert.equal(fs.existsSync(p.receipt),false);assert.equal(await fsp.readFile(path.join(p.stage,'READY'),'utf8'),'6.0.30');assert.equal(await fsp.readFile(f.executable,'utf8'),'MZ installed');
 }finally{await f.cleanup();}
});

test('Windows Ctrl+A stays editing; screenshot requires Ctrl+Alt+S and Mac Ctrl+A remains compatible',()=>{
 const {captureShortcut}=load('mouse-shell.cjs',{electron:{}}),input={type:'keyDown',control:true,meta:false,alt:false,shift:false,key:'a',code:'KeyA'};
 assert.equal(captureShortcut(input,'win32'),false);assert.equal(captureShortcut(input,'darwin'),true);
 assert.equal(captureShortcut({...input,key:'s',code:'KeyS',alt:true},'win32'),true);
 for(const patch of [{shift:true},{meta:true},{control:false},{type:'keyUp'}])assert.equal(captureShortcut({...input,key:'s',code:'KeyS',alt:true,...patch},'win32'),false);
});
test('Windows capture registers only Ctrl+Alt+S and never opens Mac permissions or captures at startup',async()=>{
 const {GlobalCapture}=require('./mouse-global-capture.cjs'),app=new EventEmitter(),main=new EventEmitter(),registered=new Set(),handlers=new Map();let captures=0;
 Object.assign(main,{isDestroyed:()=>false,webContents:{send(){}}});
 const service=new GlobalCapture({platform:'win32',app,mainWindow:main,entryDirectory:__dirname,store:{get:async()=>({})},trusted(){},electron:{ipcMain:{handle:(k,v)=>handlers.set(k,v)},globalShortcut:{register:k=>{registered.add(k);return true;},unregister:k=>registered.delete(k)},systemPreferences:{getMediaAccessStatus(){throw Error('Mac permissions must not run');}},shell:{openExternal(){throw Error('Mac settings must not open');}},desktopCapturer:{getSources:async()=>{captures++;return[];}}}});
 await service.init();assert.deepEqual([...registered],['Control+Alt+S']);assert.equal(service.permission(),'not-required');assert.equal(captures,0);await handlers.get('mouse:global-capture-admin')({},'permission');service.dispose();assert.equal(registered.size,0);
});
test('Windows bottom-corner chrome preserves the guest viewport and clears for Nora and square panes',()=>{
 class View{constructor(){this.children=[];this.visible=true;this.writes=0;}addChildView(v){this.children.push(v);}removeChildView(v){this.children=this.children.filter(x=>x!==v);}setBorderRadius(n){this.radius=n;}setBounds(b){this.bounds=b;this.writes++;}setVisible(v){this.visible=v;}getVisible(){return this.visible;}}
 const {BrowserWorkspace}=load('browser.cjs',{electron:{View,WebContentsView:View},'./page-context.cjs':{},'./network.cjs':{}}),win={isDestroyed:()=>false,getContentSize:()=>[1000,800],contentView:new View()},view=new View(),page={id:'t',project:'p',lane:'main',view,visible:false};win.contentView.addChildView(view);
 const masks=[],workspace={mouseRoundedPanes:true,mouseCornerMask:rects=>masks.push(JSON.parse(JSON.stringify(rects))),win,disposed:false,project:'p',tabs:new Map([['t',page]]),providers:new Map()},layout=panels=>BrowserWorkspace.prototype.layout.call(workspace,panels),panels=[{id:'t',x:5.25,y:80.25,width:450.5,height:300.5,roundBottom:12,roundColor:'#c7cfdf'}];
 layout(panels);assert.equal(page.clipView,undefined);assert.equal(page.roundView,undefined);assert.equal(page.view.bounds.width,451);assert.equal(page.view.bounds.height,301);
 assert.equal(page.view.bounds.y,80);assert.equal(page.view.bounds.x,5);assert.deepEqual(masks.at(-1),[{x:5,y:80,width:451,height:301,color:'#c7cfdf'}]);
 const roots=[...win.contentView.children],writes=page.view.writes;layout(panels);assert.equal(page.view.writes,writes);assert.deepEqual(win.contentView.children,roots);
 workspace.mouseSurfaceHold='nora';layout(panels);assert.equal(page.view.visible,false);assert.deepEqual(masks.at(-1),[]);assert.deepEqual(win.contentView.children,roots);
 workspace.mouseSurfaceHold=null;layout([{...panels[0],roundBottom:0}]);assert.deepEqual(masks.at(-1),[]);assert.equal(page.view.bounds.y,80);assert.equal(page.view.bounds.height,301);assert.equal(page.view.visible,true);
 layout([{...panels[0],clip:{x:20,y:90,width:200,height:291}}]);assert.equal(page.clipView.bounds.x+page.view.bounds.x,5);assert.equal(page.clipView.bounds.y+page.view.bounds.y,80);assert.equal(page.view.bounds.width,451);assert.equal(page.view.bounds.height,301);assert.deepEqual(masks.at(-1),[{x:20,y:90,width:200,height:291,color:'#c7cfdf'}]);
 layout([]);assert.equal(page.view.visible,false);assert.equal(page.clipView.visible,false);assert.deepEqual(masks.at(-1),[]);
});
