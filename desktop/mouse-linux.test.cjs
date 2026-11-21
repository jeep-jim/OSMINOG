'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createLinuxInput}=require('./mouse-linux-input.cjs');
const {releaseTarget,channelCandidate,LINUX_CHANNEL,CHANNEL,WINDOWS_CHANNEL}=require('./mouse-update.cjs');
const {LinuxInstaller,appImagePath,HELPER}=require('./mouse-linux-update.cjs');

test('Linux packaging keeps the common runtime and overwrites the unsafe upstream AppRun',async()=>{
 const build=require('./mouse-linux-build.cjs'),root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-linux-pack-'));
 try{
  assert.equal(build.extraMetadata.version,'6.0.34');assert.equal(build.appId,'black.mouse.browser.linux');assert.equal(build.mac,undefined);assert.equal(build.win,undefined);assert.equal(build.publish,null);assert.deepEqual(build.appImage.executableArgs,[]);
  assert.ok(build.files.includes('mouse-mcp-fs.node'));assert.ok(!build.files.includes('mouse-native-menu.node'));
  const appOutDir=path.join(root,'app'),stage=path.join(root,'stage');await fs.mkdir(appOutDir);await fs.mkdir(stage);await fs.writeFile(path.join(stage,'AppRun'),'UNSAFE_GENERATED_FALLBACK');
  await build.afterPack({appOutDir,electronPlatformName:'linux'});await require('builder-util').copyDir(appOutDir,stage);
  const entry=await fs.readFile(path.join(stage,'AppRun'),'utf8');assert.equal(entry,await fs.readFile(path.join(appOutDir,'AppRun'),'utf8'));assert.doesNotMatch(entry,/--no-sandbox|unshare|NO_SANDBOX/);assert.match(entry,/exec "\$APPDIR\/mouse-browser" "\$@"/);if(process.platform!=='win32')assert.equal((await fs.stat(path.join(stage,'AppRun'))).mode&0o777,0o755);
  const {getConfig,validateConfiguration}=require('app-builder-lib/out/util/config/config'),config=await getConfig(__dirname,'mouse-linux-build.cjs',null);await validateConfiguration(config,{add(){}});
  const {expandMacro}=require('app-builder-lib/out/util/macroExpander'),{getArtifactArchName,Arch}=require('builder-util');
  for(const ext of ['AppImage','deb'])assert.equal(expandMacro(config.artifactName,getArtifactArchName(Arch.x64,ext),config.extraMetadata,{ext}),`Mouse-Browser-6.0.34-Linux-x64.${ext}`,'the builder format-specific architecture must retain the fixed release channel filename');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('Linux native input is CI-only and emits bounded real XTest actions',()=>{
 const calls=[],runtime={platform:'linux',env:{CI:'true',DISPLAY:':99',MOUSE_TEST_PROFILE:'/tmp/owned-profile'}};
 let cursor=[0,0];const driver=createLinuxInput({runtime,spawnSync:(program,args,options)=>{calls.push({program,args});assert.equal(options.timeout,7000);if(args[0]==='mousemove')cursor=args.slice(1).map(Number);return{status:0,stdout:args[0]==='getmouselocation'?`X=${cursor[0]}\nY=${cursor[1]}\nSCREEN=0\nWINDOW=123\n`:''};}});
 assert.equal(driver.testClick(32.4,71.7),true);assert.deepEqual(calls.map(row=>row.args),[['mousemove','32','72'],['getmouselocation','--shell'],['click','1']]);
 assert.equal(driver.testKey('ctrl+a'),true);assert.deepEqual(calls.at(-1).args,['key','--clearmodifiers','ctrl+a']);
 assert.equal(driver.testRightClick(40,90),true);assert.deepEqual(calls.at(-1).args,['click','3']);assert.equal(driver.testKey('Home'),true);assert.deepEqual(calls.at(-1).args,['key','--clearmodifiers','Home']);
 assert.throws(()=>driver.testMouse(1,2,4),/phase/);assert.throws(()=>driver.testKey('a;echo bad'),/chord/);assert.throws(()=>driver.testClick(NaN,2),/finite/);
 for(const bad of [{...runtime,platform:'win32'},{...runtime,env:{...runtime.env,CI:'false'}},{...runtime,env:{...runtime.env,MOUSE_TEST_PROFILE:'relative'}},{...runtime,env:{...runtime.env,DISPLAY:'remote:99'}}])assert.throws(()=>createLinuxInput({runtime:bad}),/requires/);
});
test('Linux native input releases a stationary held pointer and verifies its real location',()=>{
 const runtime={platform:'linux',env:{CI:'true',DISPLAY:':99',MOUSE_TEST_PROFILE:'/tmp/owned-profile'}},calls=[];let cursor=[40,90];
 const driver=createLinuxInput({runtime,spawnSync:(_program,args)=>{calls.push(args);if(args[0]==='mousemove'){if(args[1]==='--sync'&&args.slice(2).map(Number).every((value,index)=>value===cursor[index]))return{error:new Error('stationary --sync exceeds the bounded driver deadline'),status:null};cursor=args.slice(1).map(Number);}return{status:0,stdout:args[0]==='getmouselocation'?`X=${cursor[0]}\nY=${cursor[1]}\nSCREEN=0\nWINDOW=123\n`:''};}});
 assert.equal(driver.testMouse(40,90,0),true);assert.equal(driver.testMouse(40,90,1),true);assert.equal(driver.testMouse(40,90,2),true);assert.equal(driver.testClick(40,90),true);
 assert.deepEqual(calls.filter(args=>['mousedown','mouseup','click'].includes(args[0])),[['mousedown','1'],['mouseup','1'],['click','1']]);assert.equal(calls.filter(args=>args[0]==='getmouselocation').length,4);
});
test('Linux native input refuses button events when the X server reports the wrong or missing position',()=>{
 const runtime={platform:'linux',env:{CI:'true',DISPLAY:':99',MOUSE_TEST_PROFILE:'/tmp/owned-profile'}};
 for(const stdout of ['X=41\nY=90\nSCREEN=0\nWINDOW=123\n','X=40\nSCREEN=0\n','not a position']){const calls=[],driver=createLinuxInput({runtime,spawnSync:(_program,args)=>{calls.push(args);return{status:0,stdout:args[0]==='getmouselocation'?stdout:''};}});assert.throws(()=>driver.testClick(40,90),/did not reach/);assert.equal(calls.some(args=>args[0]==='click'),false);}
});
test('Linux formats use their own fixed channel and never alter existing platform addresses',()=>{
 const target=releaseTarget({platform:'linux',arch:'x64'}),version='6.0.34',tag=target.tagFor(version),prefix='https://github.com/jeep-jim/OSMINOG-Releases/releases/download/'+tag+'/',digest='sha256:'+'a'.repeat(64);
 const feed={schema:1,platform:'linux',arch:'x64',version,url:prefix+'Mouse-Browser-'+version+'-Linux-x64.AppImage',size:125000000,digest,packages:{deb:{url:prefix+'Mouse-Browser-'+version+'-Linux-x64.deb',size:124000000,digest}}};
 assert.equal(target.channel,LINUX_CHANNEL);assert.match(CHANNEL,/channels\/mouse\/macos-arm64.json$/);assert.match(WINDOWS_CHANNEL,/platforms\/windows\/mouse-x64\/latest.json$/);
 assert.match(channelCandidate(feed,'6.0.33',target).name,/\.AppImage$/);assert.match(channelCandidate(feed,'6.0.33',{platform:'linux',arch:'x64',format:'deb'}).name,/\.deb$/);
 assert.equal(channelCandidate(feed,version,target),null);assert.throws(()=>channelCandidate({...feed,url:'https://invalid.example/app'},'6.0.33',target),/адрес/);assert.throws(()=>releaseTarget({platform:'linux',arch:'arm64'}),/поддерживается/);assert.throws(()=>releaseTarget({platform:'linux',arch:'x64',format:'rpm'}),/формат/);
});
test('AppImage preparation verifies real bytes, owns its path and leaves the current executable intact',async()=>{
 if(process.platform!=='linux')return;
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-linux-update-'));
 try{
  await fs.chmod(root,0o700);const target=path.join(root,'Mouse.AppImage'),download=path.join(root,'download.AppImage'),profile=path.join(root,'profile');await fs.mkdir(profile);await fs.writeFile(target,'OLD_EXECUTABLE');
  const bytes=Buffer.alloc(80);bytes.write('\x7fELF',0,'binary');bytes[4]=2;bytes[5]=1;bytes.write('AI',8);bytes[10]=2;bytes.writeUInt16LE(62,18);await fs.writeFile(download,bytes);
  const candidate={version:'6.0.34',name:'Mouse-Browser-6.0.34-Linux-x64.AppImage',size:bytes.length,hash:crypto.createHash('sha256').update(bytes).digest('hex')};
  const app={getVersion:()=> '6.0.33',getPath:()=>profile},installer=new LinuxInstaller({app,quit:async()=>{},executable:target});
  await assert.rejects(installer.prepare(download,{...candidate,hash:'0'.repeat(64)}),/SHA-256/);
  await assert.rejects(installer.prepare(download,{...candidate,version:'6.0.32'}),/пакет/);
  const plan=await installer.prepare(download,candidate);assert.equal(await fs.readFile(target,'utf8'),'OLD_EXECUTABLE');assert.deepEqual(await fs.readFile(path.join(plan.stage,'next.AppImage')),bytes);assert.equal((await fs.stat(plan.stage)).mode&0o777,0o700);
  const linked=path.join(root,'linked.AppImage');await fs.symlink(target,linked);await assert.rejects(new LinuxInstaller({app,quit:async()=>{},executable:linked}).prepare(download,candidate),/ссылок/);
  assert.equal(appImagePath({APPIMAGE:'relative'}),null);assert.equal(appImagePath({APPIMAGE:target}),target);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('the Linux replacement helper runs real files, waits for exit and rolls back a failed startup',async()=>{
 if(process.platform!=='linux')return;
 const cp=require('node:child_process'),root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-linux-helper-'));
 const quoted=value=>"'"+value.replaceAll("'","'\\''")+"'",sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 try{for(const succeeds of [true,false]){
  const stage=path.join(root,succeeds?'success stage':'rollback stage'),target=path.join(root,succeeds?'Mouse Success.AppImage':'Mouse Rollback.AppImage');await fs.mkdir(stage);
  const old='#!/bin/sh\nprintf old > '+quoted(path.join(stage,'old-launched'))+'\n',next=succeeds?'#!/bin/sh\nprintf ready > '+quoted(path.join(stage,'READY'))+'\nsleep 1\n':'#!/bin/sh\nexit 23\n';
  await fs.writeFile(target,old,{mode:0o700});await fs.writeFile(path.join(stage,'next.AppImage'),next,{mode:0o700});await fs.writeFile(path.join(stage,'install.sh'),HELPER,{mode:0o700});
  const oldProcess=cp.spawn(process.execPath,['-e','setTimeout(()=>{},400)'],{stdio:'ignore'}),oldExited=new Promise(resolve=>oldProcess.once('exit',resolve));
  const helper=cp.spawn('/bin/sh',[path.join(stage,'install.sh'),String(oldProcess.pid),target,stage,sha(old),sha(next)],{stdio:'ignore'}),done=new Promise((resolve,reject)=>{helper.once('error',reject);helper.once('exit',resolve);});
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(await fs.readFile(target,'utf8'),old,'The running executable is not replaced before its process exits');await oldExited;
  assert.equal(await done,succeeds?0:1);assert.equal(await fs.readFile(target,'utf8'),succeeds?next:old);assert.equal(await fs.readFile(path.join(stage,succeeds?'previous.AppImage':'failed.AppImage'),'utf8'),succeeds?old:next);
  assert.match(await fs.readFile(path.join(stage,'result.log'),'utf8'),succeeds?/replaced/:/previous AppImage restored/);
 }}finally{await fs.rm(root,{recursive:true,force:true});}
});
