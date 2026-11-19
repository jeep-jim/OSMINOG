'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {WindowsInstaller,startWindowsHelper}=require('./mouse-install-update.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('real Windows update helper acknowledges checked bytes and cancels without executing the installer',{
 skip:process.platform!=='win32',timeout:40000,
},async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-helper-')),
  target=path.join(root,'Установленная копия'),profile=path.join(root,'Профиль с пробелами'),temporary=path.join(root,'temp');
 let child,plan,ended=false,exitCode,spawnError;
 try{
  await Promise.all([fs.mkdir(target),fs.mkdir(profile),fs.mkdir(temporary)]);
  const executable=path.join(target,'Mouse Browser.exe'),uninstaller=path.join(target,'Uninstall Mouse Browser.exe'),
   bytes=Buffer.from('MZ synthetic package; this must never execute'),version='6.0.30',
   name=`Mouse-Browser-${version}-Windows-x64.exe`,file=path.join(root,name);
  await Promise.all([fs.writeFile(executable,'MZ original application'),fs.writeFile(uninstaller,'MZ original uninstaller'),fs.writeFile(file,bytes)]);
  const candidate={version,name,size:bytes.length,hash:crypto.createHash('sha256').update(bytes).digest('hex'),
   url:`https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v${version}-x64/${name}`};
  const installer=new WindowsInstaller({app:{isPackaged:true,getPath:name=>name==='temp'?temporary:profile},
   executable,quit:async()=>{throw Error('This test must not close its original process');}});
  plan=await installer.prepare(file,candidate);
  assert.equal(plan.pid,process.pid,'the real original process remains alive throughout cancellation');
  child=await startWindowsHelper(plan);
  child.once('error',error=>{spawnError=error;ended=true;});
  child.once('exit',code=>{exitCode=code;ended=true;});
  if(child.mouseHelperState?.error){spawnError=child.mouseHelperState.error;ended=true;}
  if(child.mouseHelperState?.exit){exitCode=child.mouseHelperState.exit.code;ended=true;}
  const readyDeadline=Date.now()+15000;
  while(!await fs.stat(plan.ready).then(stat=>stat.isFile()).catch(()=>false)){
   if(spawnError)throw spawnError;
   assert.equal(ended,false,`helper exited before readiness with code ${exitCode}`);
   assert.ok(Date.now()<readyDeadline,'real PowerShell helper did not acknowledge readiness');
   await delay(50);
  }
  assert.equal(await fs.readFile(plan.ready,'utf8'),'ready');
  assert.equal(ended,false,'helper must remain waiting for the original application');
  await fs.writeFile(plan.cancel,'cancel');
  const exitDeadline=Date.now()+10000;
  while(!ended){assert.ok(Date.now()<exitDeadline,'cancelled helper did not exit');await delay(50);}
  if(spawnError)throw spawnError;
  // Conhost does not forward its client's exit code (microsoft/terminal#17178).
  // The helper's own cancellation record is the required semantic result.
  assert.equal(Number.isInteger(exitCode),true,'the console host must exit normally after cancellation');
  assert.match(await fs.readFile(plan.result,'utf8'),/Update cancelled/);
  assert.equal(await fs.readFile(executable,'utf8'),'MZ original application');
  assert.equal(await fs.readFile(uninstaller,'utf8'),'MZ original uninstaller');
  assert.deepEqual(await fs.readFile(file),bytes);
  t.diagnostic('Actual Windows PowerShell checked the package, acknowledged readiness and cancelled while the original PID remained alive.');
 }catch(error){
  if(plan)for(const name of (await fs.readdir(plan.stage).catch(()=>[])).filter(name=>name.endsWith('.log'))){
   const value=await fs.readFile(path.join(plan.stage,name),'utf8').catch(()=>null);
   if(value)t.diagnostic(name+': '+value.slice(-8000));
  }
  throw error;
 }finally{
  if(plan)await fs.writeFile(plan.cancel,'cancel').catch(()=>{});
  if(child&&!ended){
   const deadline=Date.now()+1500;while(!ended&&Date.now()<deadline)await delay(50);
   if(!ended){child.kill();const deadline=Date.now()+1500;while(!ended&&Date.now()<deadline)await delay(50);}
  }
  await fs.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
});
