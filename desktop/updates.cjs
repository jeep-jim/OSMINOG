'use strict';
// Only the trusted application frame invokes these actions. No timer installs updates.
class Updates {
 constructor({updater,version,packaged,save,emit,schedule=setTimeout}){
  this.updater=updater;this.version=version;this.packaged=packaged;this.save=save;this.emit=emit;this.schedule=schedule;this.task=null;
  this.state={phase:'idle',currentVersion:version,latestVersion:version,percent:0,error:'',available:false};
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowDowngrade=false;
  updater.on('download-progress',p=>this.set({phase:'downloading',percent:Math.max(0,Math.min(100,Number(p.percent)||0))}));
  updater.on('error',e=>this.fail(e));
 }
 set(patch){Object.assign(this.state,patch);this.emit?.({...this.state});return{...this.state}}
 fail(error){return this.set({phase:'error',error:error?.message||String(error),downloaded:false})}
 single(fn){if(this.task)return this.task;this.task=Promise.resolve().then(fn).catch(e=>{this.fail(e);throw e}).finally(()=>{this.task=null});return this.task}
 check(){return this.single(async()=>{
  if(!this.packaged)throw Error('Обновления доступны в установленном приложении Windows');
  if(this.state.phase==='ready'||this.state.phase==='installing')return{...this.state};
  this.set({phase:'checking',error:'',percent:0,available:false});
  const result=await this.updater.checkForUpdates();if(!result)throw Error('Канал обновления не ответил');
  return this.set({phase:result.isUpdateAvailable?'available':'current',available:!!result.isUpdateAvailable,latestVersion:result.updateInfo?.version||this.version,source:'OSMINOG Windows Preview'});
 })}
 download(){return this.single(async()=>{
  if(this.state.phase==='ready')return{...this.state};
  if(this.state.phase!=='available')throw Error('Сначала проверьте доступность обновления');
  this.set({phase:'downloading',error:'',percent:0,downloaded:false});
  const files=await this.updater.downloadUpdate();
  if(!Array.isArray(files)||!files.length)throw Error('Проверенный установщик не получен');
  return this.set({phase:'ready',percent:100,downloaded:true});
 })}
 install(){return this.single(async()=>{
  if(this.state.phase==='installing')return{...this.state};
  if(this.state.phase!=='ready'||!this.state.downloaded)throw Error('Обновление ещё не скачано и не проверено');
  // Save again immediately before quitting: edits can occur during a long download.
  await this.save();this.set({phase:'installing',error:''});
  this.schedule(()=>{try{this.updater.quitAndInstall(true,true)}catch(e){this.fail(e)}},250);
  return{...this.state};
 })}
}
module.exports={Updates};
