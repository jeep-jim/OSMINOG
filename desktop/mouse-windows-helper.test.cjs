'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {WindowsInstaller,startWindowsHelper}=require('./mouse-install-update.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};

async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mouse-helper-')),target=path.join(root,'Установленная копия'),profile=path.join(root,'Профиль с пробелами'),temporary=path.join(root,'temp');
 await Promise.all([fs.mkdir(target),fs.mkdir(profile),fs.mkdir(temporary)]);
 const executable=path.join(target,'Mouse Browser.exe'),uninstaller=path.join(target,'Uninstall Mouse Browser.exe'),bytes=Buffer.from('MZ synthetic package; this must never execute'),version='6.0.30',name=`Mouse-Browser-${version}-Windows-x64.exe`,file=path.join(root,name);
 await Promise.all([fs.writeFile(executable,'MZ original application'),fs.writeFile(uninstaller,'MZ original uninstaller'),fs.writeFile(file,bytes)]);
 const candidate={version,name,size:bytes.length,hash:crypto.createHash('sha256').update(bytes).digest('hex'),url:`https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v${version}-x64/${name}`};
 const installer=new WindowsInstaller({app:{isPackaged:true,getPath:name=>name==='temp'?temporary:profile},executable,quit:async()=>{throw Error('This test must not close its original process');}}),plan=await installer.prepare(file,candidate);
 assert.equal(plan.pid,process.pid,'the independent original-process guard stays alive until cancellation');
 return{root,executable,uninstaller,file,bytes,plan};
}
async function diagnostics(t,plan){
 if(!plan)return;
 const names=new Set(['helper.trace.log','helper.stdout.log','helper.stderr.log','result.log','helper.ready','cancel']);
 for(const name of (await fs.readdir(plan.stage).catch(()=>[])).filter(name=>name.endsWith('.log')).slice(0,16))names.add(name);
 for(const name of names){
  try{const stat=await fs.lstat(path.join(plan.stage,name));if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536){t.diagnostic(name+': omitted nonordinary or oversized file');continue;}const value=await fs.readFile(path.join(plan.stage,name),'utf8');t.diagnostic(name+': '+value.slice(-8000));}
  catch(error){t.diagnostic(name+': '+error.code);}
 }
}
async function unchanged(f){
 assert.equal(await fs.readFile(f.executable,'utf8'),'MZ original application');assert.equal(await fs.readFile(f.uninstaller,'utf8'),'MZ original uninstaller');assert.deepEqual(await fs.readFile(f.file),f.bytes);
 assert.match(await fs.readFile(f.plan.result,'utf8'),/Update cancelled/);
 assert.doesNotMatch(await fs.readFile(f.plan.helperTrace,'utf8'),/Original Mouse exited|Installer started|Updated Mouse launched/);
}
async function waitReady(plan,child){
 const deadline=Date.now()+15000;
 for(;;){
  if(child.mouseHelperState.error)throw child.mouseHelperState.error;
  assert.equal(child.mouseHelperState.exit,null,'helper exited before readiness: '+JSON.stringify(child.mouseHelperState.exit));
  if(await fs.readFile(plan.ready,'utf8').catch(()=>null)==='ready')return;
  assert.ok(Date.now()<deadline,'real PowerShell helper did not acknowledge readiness');await delay(50);
 }
}
async function cleanup(f,child,helperPid){
 if(f)await fs.writeFile(f.plan.cancel,'cancel').catch(()=>{});
 if(child&&child.exitCode==null){
  const deadline=Date.now()+1500;while(child.exitCode==null&&Date.now()<deadline)await delay(50);
  if(child.exitCode==null)child.kill();
 }
 if(helperPid&&alive(helperPid)){
  const deadline=Date.now()+1500;while(alive(helperPid)&&Date.now()<deadline)await delay(50);
  if(alive(helperPid))process.kill(helperPid);
 }
 if(f)await fs.rm(f.root,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}

test('real Windows helper acknowledges checked bytes and cancels with its actual PowerShell exit code',{
 skip:process.platform!=='win32',timeout:40000,
},async t=>{
 let f,child;
 try{
  f=await fixture();child=await startWindowsHelper(f.plan);await waitReady(f.plan,child);
  assert.equal(alive(child.pid),true,'PowerShell remains alive while the original process guard is running');
  await fs.writeFile(f.plan.cancel,'cancel');const deadline=Date.now()+10000;
  while(child.exitCode==null){if(child.mouseHelperState.error)throw child.mouseHelperState.error;assert.ok(Date.now()<deadline,'cancelled helper did not exit');await delay(50);}
  assert.equal(child.exitCode,1,'the native process handle reports PowerShell\'s real cancellation exit code');
  assert.equal(child.killed,false,'normal cancellation exits through the helper script');await unchanged(f);
  t.diagnostic('MOUSE_WINDOWS_HELPER_READY_CANCEL_PASS');
 }catch(error){await diagnostics(t,f?.plan);throw error;}
 finally{await cleanup(f,child);}
});

// This separate Node process is the launcher that must disappear. The plan's
// original PID remains this test process, preventing dummy installer execution.
const PARENT=`'use strict';
const fs=require('node:fs/promises');
(async()=>{
 const plan=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
 const {startWindowsHelper}=require(process.argv[2]);
 const child=await startWindowsHelper(plan),deadline=Date.now()+15000;
 for(;;){
  if(child.mouseHelperState.error)throw child.mouseHelperState.error;
  if(child.mouseHelperState.exit)throw Error('helper exited before parent handoff: '+JSON.stringify(child.mouseHelperState.exit));
  if(await fs.readFile(plan.ready,'utf8').catch(()=>null)==='ready')break;
  if(Date.now()>deadline)throw Error('helper readiness timed out before parent handoff');
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 await fs.writeFile(process.argv[4],JSON.stringify({helperPid:child.pid,launcherPid:process.pid}));
 child.unref();process.exit(0);
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
`;
test('real Windows helper survives its launcher exiting and still cancels without running the installer',{
 skip:process.platform!=='win32',timeout:40000,
},async t=>{
 let f,launcher,helperPid,ended=false;
 try{
  f=await fixture();const script=path.join(f.root,'launch-helper.cjs'),marker=path.join(f.root,'handoff.json');await fs.writeFile(script,PARENT);
  launcher=cp.spawn(process.execPath,[script,path.join(__dirname,'mouse-install-update.cjs'),path.join(f.plan.stage,'plan.json'),marker],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [launcher.stdout,launcher.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-16000);});
  const completion=new Promise((resolve,reject)=>{launcher.once('error',error=>{ended=true;reject(error);});launcher.once('close',(code,signal)=>{ended=true;resolve({code,signal});});});
  let timer;const result=await Promise.race([completion,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('helper launcher did not exit: '+output)),18000);})]).finally(()=>clearTimeout(timer));
  assert.deepEqual(result,{code:0,signal:null},output);const handoff=JSON.parse(await fs.readFile(marker,'utf8'));helperPid=handoff.helperPid;
  assert.equal(handoff.launcherPid,launcher.pid);assert.ok(Number.isSafeInteger(helperPid)&&helperPid>0&&helperPid!==launcher.pid&&helperPid!==process.pid);
  assert.equal(await fs.readFile(f.plan.ready,'utf8'),'ready');
  const survivalDeadline=Date.now()+1000;
  while(Date.now()<survivalDeadline){
   assert.equal(alive(helperPid),true,'helper survives closing all handles of its actual launcher');
   assert.equal(await fs.stat(f.plan.result).then(()=>true).catch(()=>false),false,'helper is still waiting for the independent original-process guard');await delay(100);
  }
  await fs.writeFile(f.plan.cancel,'cancel');const exitDeadline=Date.now()+10000;
  while(alive(helperPid)){assert.ok(Date.now()<exitDeadline,'surviving helper did not honor cancellation');await delay(50);}
  await unchanged(f);t.diagnostic('MOUSE_WINDOWS_HELPER_PARENT_LIFETIME_PASS');
 }catch(error){await diagnostics(t,f?.plan);throw error;}
 finally{if(launcher&&!ended)launcher.kill();await cleanup(f,null,helperPid);}
});
