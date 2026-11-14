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
function bundlePath(exe){return path.dirname(path.dirname(path.dirname(exe)));}
function allowedTarget(target,home){return path.basename(target)==='Mouse Browser.app'&&[path.resolve('/Applications'),path.resolve(home,'Applications')].includes(path.dirname(target));}
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
 const receipt=path.join(app.getPath('userData'),'mouse-update-receipt.json');let r;try{r=JSON.parse(await fs.readFile(receipt,'utf8'))}catch{return}
 const target=bundlePath(executable);if(r.version!==app.getVersion()||r.target!==target||typeof r.stage!=='string'||path.dirname(r.stage)!==path.dirname(target)||!/^\.mouse-update-[\w-]+$/.test(path.basename(r.stage)))return;
 const stat=await fs.lstat(r.stage).catch(()=>null);if(!stat||!stat.isDirectory()||stat.isSymbolicLink())return;
 // The previous executable remains available for recovery; no profile is touched.
 await fs.writeFile(path.join(r.stage,'READY'),app.getVersion(),{mode:0o600});await fs.unlink(receipt);
}
module.exports={MacInstaller,acknowledge,allowedTarget,bundlePath,HELPER};
