'use strict';

// AppImage replacement is confined to the current user's regular executable.
// deb installations are updated by their system package manager instead.
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
const {fileHash,newer}=require('./mouse-update.cjs');
const HELPER=`#!/bin/sh
set -eu
pid="$1"; target="$2"; stage="$3"; before="$4"; after="$5"
count=0
while kill -0 "$pid" 2>/dev/null; do
 [ ! -e "$stage/CANCEL" ] || exit 1
 count=$((count+1)); [ "$count" -le 90 ] || exit 1
 sleep 1
done
[ ! -e "$stage/CANCEL" ] || exit 1
[ -f "$target" ] && [ ! -L "$target" ] && [ -f "$stage/next.AppImage" ] && [ ! -L "$stage/next.AppImage" ]
[ "$(sha256sum -- "$target" | cut -d ' ' -f 1)" = "$before" ]
[ "$(sha256sum -- "$stage/next.AppImage" | cut -d ' ' -f 1)" = "$after" ]
mv -- "$target" "$stage/previous.AppImage"
if ! mv -- "$stage/next.AppImage" "$target"; then mv -- "$stage/previous.AppImage" "$target"; exit 1; fi
"$target" > "$stage/launch.log" 2>&1 &
launched=$!
count=0
while [ ! -f "$stage/READY" ]; do
 count=$((count+1))
 if [ "$count" -gt 120 ] || ! kill -0 "$launched" 2>/dev/null; then
  kill "$launched" 2>/dev/null || true
  wait "$launched" 2>/dev/null || true
  mv -- "$target" "$stage/failed.AppImage"
  mv -- "$stage/previous.AppImage" "$target"
  "$target" > "$stage/rollback.log" 2>&1 &
  printf 'Startup acknowledgement failed; previous AppImage restored.\n' > "$stage/result.log"
  exit 1
 fi
 sleep 1
done
printf 'AppImage replaced; previous executable retained.\n' > "$stage/result.log"
`;

function appImagePath(env=process.env){return typeof env.APPIMAGE==='string'&&path.posix.isAbsolute(env.APPIMAGE)?path.posix.resolve(env.APPIMAGE):null;}
async function regularOwned(file,uid=process.getuid()){
 const stat=await fs.lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.uid!==uid||await fs.realpath(file)!==file)throw Error('AppImage должен быть обычным файлом текущего пользователя, без ссылок.');
 return stat;
}
class LinuxInstaller{
 constructor({app,quit,executable=appImagePath(),runtime=process}){this.app=app;this.quit=quit;this.executable=executable;this.runtime=runtime;this.plan=null;}
 async prepare(file,candidate){
  const target=this.executable;if(this.runtime.platform!=='linux'||this.runtime.arch!=='x64'||!target)throw Error('Обновите пакет .deb через системный менеджер пакетов.');
  if(!candidate||!/^\d+\.\d+\.\d+$/.test(candidate.version)||!newer(candidate.version,this.app.getVersion())||candidate.name!==`Mouse-Browser-${candidate.version}-Linux-x64.AppImage`||!Number.isSafeInteger(candidate.size)||candidate.size<=0||candidate.size>512*1024*1024||!/^[a-f0-9]{64}$/.test(candidate.hash))throw Error('Некорректный пакет AppImage.');
  await regularOwned(target,this.runtime.getuid());const parent=path.dirname(target),parentStat=await fs.lstat(parent);
  if(!parentStat.isDirectory()||parentStat.isSymbolicLink()||parentStat.uid!==this.runtime.getuid()||await fs.realpath(parent)!==parent||(parentStat.mode&0o022))throw Error('Перенесите AppImage в личную папку, доступную для записи только вам.');
  const source=await regularOwned(path.resolve(file),this.runtime.getuid());if(source.size!==candidate.size||await fileHash(file)!==candidate.hash)throw Error('SHA-256 AppImage не совпадает.');
  const descriptor=await fs.open(file,'r');try{const bytes=Buffer.alloc(20);const read=await descriptor.read(bytes,0,20,0);if(read.bytesRead!==20||bytes.subarray(0,4).toString('hex')!=='7f454c46'||bytes[4]!==2||bytes[5]!==1||bytes.subarray(8,11).toString('hex')!=='414902'||bytes.readUInt16LE(18)!==62)throw Error('Пакет не является Linux x64 AppImage.');}finally{await descriptor.close();}
  const stage=await fs.mkdtemp(path.join(parent,'.mouse-update-'));await fs.chmod(stage,0o700);
  try{
   const next=path.join(stage,'next.AppImage');await fs.copyFile(file,next,require('node:fs').constants.COPYFILE_EXCL);await fs.chmod(next,0o700);
   if(await fileHash(next)!==candidate.hash)throw Error('Копия AppImage изменилась.');
   await fs.writeFile(path.join(stage,'install.sh'),HELPER,{flag:'wx',mode:0o700});
   this.plan={target,stage,version:candidate.version,hash:candidate.hash,previousHash:await fileHash(target),receipt:path.join(this.app.getPath('userData'),'mouse-linux-update-receipt.json')};return this.plan;
  }catch(error){await fs.rm(stage,{recursive:true,force:true});throw error;}
 }
 async install(){
  const plan=this.plan;if(!plan)throw Error('Обновление не подготовлено.');
  await fs.writeFile(plan.receipt,JSON.stringify(plan),{mode:0o600});
  const child=cp.spawn('/bin/sh',[path.join(plan.stage,'install.sh'),String(this.runtime.pid),plan.target,plan.stage,plan.previousHash,plan.hash],{detached:true,stdio:'ignore'});
  try{await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();await this.quit();}
  catch(error){await fs.writeFile(path.join(plan.stage,'CANCEL'),'cancelled',{mode:0o600});await fs.rm(plan.receipt,{force:true});throw error;}
 }
}
async function acknowledge(app,target=appImagePath()){
 if(!target)return;const receipt=path.join(app.getPath('userData'),'mouse-linux-update-receipt.json');let plan;try{plan=JSON.parse(await fs.readFile(receipt,'utf8'));}catch{return;}
 if(plan.target!==target||plan.version!==app.getVersion()||typeof plan.stage!=='string'||path.dirname(plan.stage)!==path.dirname(target)||!/^\.mouse-update-[\w-]+$/.test(path.basename(plan.stage))||!/^[a-f0-9]{64}$/.test(plan.hash||''))return;
 const stage=await fs.lstat(plan.stage).catch(()=>null);if(!stage?.isDirectory()||stage.isSymbolicLink()||stage.uid!==process.getuid()||(stage.mode&0o077))return;
 await regularOwned(target);if(await fileHash(target)!==plan.hash)return;
 await fs.writeFile(path.join(plan.stage,'READY.tmp'),plan.version,{mode:0o600});await fs.rename(path.join(plan.stage,'READY.tmp'),path.join(plan.stage,'READY'));await fs.unlink(receipt);
}
module.exports={LinuxInstaller,acknowledge,appImagePath,regularOwned,HELPER};
