'use strict';
// Only the trusted application frame invokes these actions. No timer installs updates.
class Updates {
 constructor({updater,version,packaged,save,emit,schedule=setTimeout}){
  this.updater=updater;this.version=version;this.packaged=packaged;this.save=save;this.emit=emit;this.schedule=schedule;this.task=null;
  this.state={phase:'idle',currentVersion:version,latestVersion:version,percent:0,error:'',available:false,releaseNotes:require('./release-notes.cjs').notes,releaseName:'Что нового',releaseDate:'',transferred:0,total:0,bytesPerSecond:0};
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowDowngrade=false;
  updater.on('download-progress',p=>this.set({phase:'downloading',percent:Math.max(0,Math.min(100,Number(p.percent)||0)),transferred:finite(p.transferred),total:finite(p.total),bytesPerSecond:finite(p.bytesPerSecond)}));
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
  const info=result.updateInfo||{},available=!!result.isUpdateAvailable;
  return this.set({phase:available?'available':'current',available,latestVersion:info.version||this.version,source:'OSMINOG Windows Preview',releaseName:String(info.releaseName||'Что нового').slice(0,200),releaseDate:String(info.releaseDate||'').slice(0,60),releaseNotes:notes(info.releaseNotes)||(available?'Описание этой версии не опубликовано.':require('./release-notes.cjs').notes)});
 })}
 download(){return this.single(async()=>{
  if(this.state.phase==='ready')return{...this.state};
  if(this.state.phase!=='available')throw Error('Сначала проверьте доступность обновления');
  this.set({phase:'downloading',error:'',percent:0,downloaded:false,transferred:0,total:0,bytesPerSecond:0});
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
function finite(value){return Number.isFinite(Number(value))?Math.max(0,Number(value)):0}
function notes(value){return (Array.isArray(value)?value.slice(0,10).map(v=>[v.version,v.note].filter(x=>typeof x==='string').join('\n')).join('\n\n'):typeof value==='string'?value:'').slice(0,24000)}
module.exports={Updates};

