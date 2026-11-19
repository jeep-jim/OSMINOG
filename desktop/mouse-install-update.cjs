'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(cp.execFile);
const HELPER=`#!/bin/sh
set -eu
pid="$1"; target="$2"; stage="$3"; expected="$4"; receipt="$5"
count=0
while kill -0 "$pid" 2>/dev/null; do
 count=$((count+1)); if [ "$count" -gt 90 ]; then printf 'Original app did not quit; update aborted.\\n' > "$stage/result.log"; exit 1; fi
 sleep 1
done
[ -d "$target" ] && [ ! -L "$target" ] && [ -d "$stage/next.app" ]
actual=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$target/Contents/Info.plist")
[ "$actual" = "$expected" ]
/usr/bin/codesign --verify --deep --strict "$stage/next.app"
/bin/mv "$target" "$stage/previous.app"
if ! /bin/mv "$stage/next.app" "$target"; then /bin/mv "$stage/previous.app" "$target"; exit 1; fi
if ! /usr/bin/open -n "$target"; then
 /bin/mv "$target" "$stage/failed.app"
 /bin/mv "$stage/previous.app" "$target"
 /usr/bin/open -n "$target" || true
 printf 'Launch failed; previous application restored.\\n' > "$stage/result.log"
 exit 1
fi
printf 'Application replaced. Previous application retained until successful new launch.\\n' > "$stage/result.log"
`;
function bundlePath(exe){return path.posix.dirname(path.posix.dirname(path.posix.dirname(exe)));}
function allowedTarget(target,home){return path.posix.basename(target)==='Mouse Browser.app'&&[path.posix.resolve('/Applications'),path.posix.resolve(home,'Applications')].includes(path.posix.dirname(target));}
async function plist(file,key){return(await exec('/usr/libexec/PlistBuddy',['-c','Print :'+key,file])).stdout.trim();}
class MacInstaller{
 constructor({app,quit,executable=process.execPath,test=false}){this.app=app;this.quit=quit;this.executable=executable;this.test=test&&process.env.CI==='true';this.stage=null;this.child=null;}
 async prepare(file,candidate){
  const target=bundlePath(this.executable),parent=path.dirname(target);
  if(!allowedTarget(target,this.app.getPath('home'))&&!this.test)throw Error('Для обновления по кнопке перенесите Mouse Browser в «Программы» и запустите оттуда.');
  if((await fs.lstat(target)).isSymbolicLink()||await fs.realpath(target)!==target)throw Error('Нельзя обновить приложение через символическую ссылку.');
  await fs.access(parent,require('node:fs').constants.W_OK);
  const oldPlist=path.join(target,'Contents/Info.plist'),id=await plist(oldPlist,'CFBundleIdentifier');
  const stage=await fs.mkdtemp(path.join(parent,'.mouse-update-'));await fs.chmod(stage,0o700);this.stage=stage;
  const mount=path.join(stage,'mount');await fs.mkdir(mount);let mounted=false;
  try{
   await exec('/usr/bin/hdiutil',['attach',file,'-nobrowse','-readonly','-mountpoint',mount],{timeout:60000});mounted=true;
   const source=path.join(mount,'Mouse Browser.app'),info=path.join(source,'Contents/Info.plist');
   if((await fs.lstat(source)).isSymbolicLink())throw Error('Некорректный установщик');
   if(await plist(info,'CFBundleIdentifier')!==id||await plist(info,'CFBundleShortVersionString')!==candidate.version)throw Error('Идентификатор или версия приложения не совпадает с проверенным выпуском.');
   await exec('/usr/bin/codesign',['--verify','--deep','--strict',source],{timeout:60000});
   const arch=(await exec('/usr/bin/lipo',['-archs',path.join(source,'Contents/MacOS/Mouse Browser')])).stdout.trim();if(!arch.split(/\s+/).includes('arm64'))throw Error('Обновление не предназначено для Apple Silicon');
   await exec('/usr/bin/ditto',[source,path.join(stage,'next.app')],{timeout:90000});
   await exec('/usr/bin/codesign',['--verify','--deep','--strict',path.join(stage,'next.app')],{timeout:60000});
   await exec('/usr/bin/hdiutil',['detach',mount],{timeout:30000});mounted=false;
   await fs.writeFile(path.join(stage,'install.sh'),HELPER,{mode:0o700,flag:'wx'});
   this.plan={stage,target,id,version:candidate.version,receipt:path.join(this.app.getPath('userData'),'mouse-update-receipt.json')};return this.plan;
  }catch(e){if(mounted)await exec('/usr/bin/hdiutil',['detach',mount],{timeout:30000}).catch(()=>{});await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});this.stage=null;throw e;}
 }
 async install(){
  const p=this.plan;if(!p)throw Error('Обновление не подготовлено');
  await fs.writeFile(p.receipt,JSON.stringify({version:p.version,target:p.target,stage:p.stage}),{mode:0o600});
  this.child=cp.spawn('/bin/sh',[path.join(p.stage,'install.sh'),String(process.pid),p.target,p.stage,p.id,p.receipt],{detached:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{this.child.once('spawn',resolve);this.child.once('error',reject)});this.child.unref();
  await this.quit();
 }
}
// Keep previous.app until the new executable really reaches its ready state.
async function acknowledge(app,executable=process.execPath){
 if(process.platform==='win32')return acknowledgeWindows(app,executable);
 const receipt=path.join(app.getPath('userData'),'mouse-update-receipt.json');let r;try{r=JSON.parse(await fs.readFile(receipt,'utf8'))}catch{return}
 const target=bundlePath(executable);if(r.version!==app.getVersion()||r.target!==target||typeof r.stage!=='string'||path.dirname(r.stage)!==path.dirname(target)||!/^\.mouse-update-[\w-]+$/.test(path.basename(r.stage)))return;
 const stat=await fs.lstat(r.stage).catch(()=>null);if(!stat||!stat.isDirectory()||stat.isSymbolicLink())return;
 // The previous executable remains available for recovery; no profile is touched.
 await fs.writeFile(path.join(r.stage,'READY'),app.getVersion(),{mode:0o600});await fs.unlink(receipt);
}
// A Windows helper must run outside the application directory: an Electron
// helper would keep Mouse Browser.exe locked while NSIS replaces it. Paths are
// passed as JSON data, never interpolated into PowerShell source or a shell.
const WINDOWS_HELPER=`$ErrorActionPreference = 'Stop'
$plan = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($env:MOUSE_INSTALL_PLAN))
function Verify-Package {
 $item = Get-Item -LiteralPath $plan.file -Force
 if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or $item.Length -ne $plan.size) { throw 'Update file changed' }
 if ((Get-FileHash -Algorithm SHA256 -LiteralPath $plan.file).Hash.ToLowerInvariant() -ne $plan.hash) { throw 'Update SHA256 changed' }
}
try {
 Verify-Package
 [IO.File]::WriteAllText($plan.ready, 'ready')
 $deadline = [DateTime]::UtcNow.AddSeconds(90)
 while (Get-Process -Id $plan.pid -ErrorAction SilentlyContinue) {
  if (Test-Path -LiteralPath $plan.cancel) { throw 'Update cancelled because Mouse did not close' }
  if ([DateTime]::UtcNow -gt $deadline) { throw 'Mouse did not close; update aborted' }
  Start-Sleep -Milliseconds 250
 }
 if (Test-Path -LiteralPath $plan.cancel) { throw 'Update cancelled' }
 Verify-Package
 # /D must be last: NSIS reads the remainder as the literal install directory.
 $arguments = '--updated /S --force-run /D=' + $plan.target
 $installer = Start-Process -FilePath $plan.file -ArgumentList $arguments -PassThru
 # Start-Process -Wait also waits for the newly launched browser's process
 # tree. Wait only for NSIS so a successful running app can be acknowledged.
 if (-not $installer.WaitForExit(180000)) { throw 'Installer did not complete within three minutes' }
 if ($installer.ExitCode -ne 0) { throw ('Installer exited with code ' + $installer.ExitCode) }
 [IO.File]::WriteAllText($plan.result, 'Installer completed')
} catch {
 [IO.File]::WriteAllText($plan.result, $_.Exception.Message)
 exit 1
}
`;
function windowsPackage(candidate){
 if(!candidate||!/^\d+\.\d+\.\d+$/.test(candidate.version)||candidate.name!==`Mouse-Browser-${candidate.version}-Windows-x64.exe`||!/^[a-f0-9]{64}$/.test(candidate.hash)||!Number.isSafeInteger(candidate.size)||candidate.size<=0||candidate.size>512*1024*1024)throw Error('Неверный установщик Windows x64');
 const expected=`https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v${candidate.version}-x64/${candidate.name}`;
 if(candidate.url!==expected)throw Error('Неверный адрес установщика Windows');
 return candidate;
}
class WindowsInstaller{
 constructor({app,quit,executable=process.execPath,platform=process.platform,arch=process.arch,spawn=cp.spawn}){this.app=app;this.quit=quit;this.executable=executable;this.platform=platform;this.arch=arch;this.spawn=spawn;this.plan=null;this.child=null;}
 async prepare(file,candidate){
  if(this.platform!=='win32'||this.arch!=='x64'||!this.app.isPackaged)throw Error('Обновление Windows доступно из установленного Mouse Browser x64');
  const c=windowsPackage(candidate),target=path.dirname(this.executable);
  if(path.basename(this.executable)!=='Mouse Browser.exe'||!path.isAbsolute(file)||path.basename(file)!==c.name||/[\r\n\0]/.test(target))throw Error('Недопустимый путь установки Windows');
  const exe=await fs.lstat(this.executable),uninstaller=await fs.lstat(path.join(target,'Uninstall Mouse Browser.exe')).catch(()=>null);
  if(!exe.isFile()||exe.isSymbolicLink()||!uninstaller?.isFile()||uninstaller.isSymbolicLink())throw Error('Сначала установите Mouse Browser с помощью установщика Windows');
  if((await fs.realpath(target)).toLowerCase()!==path.resolve(target).toLowerCase())throw Error('Нельзя обновить приложение через символическую ссылку');
  await fs.access(target,require('node:fs').constants.W_OK);
  const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==c.size||await require('./mouse-update.cjs').fileHash(file)!==c.hash)throw Error('Скачанный установщик изменился');
  const handle=await fs.open(file,'r');try{const magic=Buffer.alloc(2);await handle.read(magic,0,2,0);if(magic.toString('ascii')!=='MZ')throw Error('Файл не является установщиком Windows');}finally{await handle.close();}
  const stage=await fs.mkdtemp(path.join(this.app.getPath('temp'),'mouse-update-install-'));
  this.plan={platform:'win32',version:c.version,file,hash:c.hash,size:c.size,target,executable:this.executable,pid:process.pid,stage,ready:path.join(stage,'helper.ready'),cancel:path.join(stage,'cancel'),result:path.join(stage,'result.log'),receipt:path.join(this.app.getPath('userData'),'mouse-windows-update-receipt.json')};
  await fs.writeFile(path.join(stage,'plan.json'),JSON.stringify(this.plan),{mode:0o600,flag:'wx'});return this.plan;
 }
 async install(){
  const p=this.plan;if(!p)throw Error('Обновление не подготовлено');
  await fs.writeFile(p.receipt,JSON.stringify({platform:'win32',version:p.version,target:p.executable,stage:p.stage}),{mode:0o600});
  const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  this.child=this.spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-Command',WINDOWS_HELPER],{detached:true,windowsHide:true,stdio:'ignore',env:{...process.env,MOUSE_INSTALL_PLAN:path.join(p.stage,'plan.json')}});
  let failure;this.child.once('error',error=>{failure=error;});this.child.once('exit',code=>{if(code!==0)failure=Error('Не удалось запустить установку Windows');});
  try{
   const deadline=Date.now()+15000;
   while(!await fs.stat(p.ready).then(s=>s.isFile()).catch(()=>false)){if(failure)throw failure;if(Date.now()>deadline)throw Error('Помощник установки Windows не ответил');await new Promise(resolve=>setTimeout(resolve,50));}
   this.child.unref();await this.quit();
  }catch(error){await fs.writeFile(p.cancel,'cancel',{mode:0o600}).catch(()=>{});try{this.child.kill?.();}catch{}throw error;}
 }
}
async function acknowledgeWindows(app,executable=process.execPath){
 const receipt=path.join(app.getPath('userData'),'mouse-windows-update-receipt.json');let r;try{r=JSON.parse(await fs.readFile(receipt,'utf8'));}catch{return;}
 if(r.platform!=='win32'||r.version!==app.getVersion()||typeof r.target!=='string'||path.resolve(r.target).toLowerCase()!==path.resolve(executable).toLowerCase()||typeof r.stage!=='string'||path.resolve(path.dirname(r.stage)).toLowerCase()!==path.resolve(app.getPath('temp')).toLowerCase()||!/^mouse-update-install-[\w-]+$/.test(path.basename(r.stage)))return;
 const stat=await fs.lstat(r.stage).catch(()=>null);if(!stat?.isDirectory()||stat.isSymbolicLink())return;
 await fs.writeFile(path.join(r.stage,'READY'),app.getVersion(),{mode:0o600});await fs.unlink(receipt);
}
module.exports={MacInstaller,WindowsInstaller,acknowledge,acknowledgeWindows,allowedTarget,bundlePath,HELPER,WINDOWS_HELPER,windowsPackage};
