'use strict';

const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
const selections=new Map();
function accountId(value){if(!Number.isSafeInteger(value)||value<1||value>999999999999999)throw Error('Некорректный Mouse ID');return value;}
function directorySync(value){fs.mkdirSync(value,{recursive:true,mode:0o700});const s=fs.lstatSync(value);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Unsafe Mouse profile directory');}
function readSelector(filename){
 let descriptor;
 try{
  descriptor=fs.openSync(filename,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));const stat=fs.fstatSync(descriptor);
  if(!stat.isFile()||stat.size>1024)throw Error('Invalid active Mouse profile');
  const value=JSON.parse(fs.readFileSync(descriptor,'utf8'));
  if(!value||typeof value!=='object'||Array.isArray(value)||![1,2].includes(value.v))throw Error('Invalid Mouse profile selector');
  const fields=value.v===1?['v','accountId']:['v','accountId','guestIsolated'];
  if(Object.keys(value).length!==fields.length||Object.keys(value).some(key=>!fields.includes(key)))throw Error('Invalid Mouse profile selector');
  if(value.accountId!==null)accountId(value.accountId);
  if(value.v===2&&(typeof value.guestIsolated!=='boolean'||value.accountId!==null&&!value.guestIsolated))throw Error('Invalid isolated Mouse guest selector');
  // V1 account profiles keep their exact directory. Their existence already
  // means authentication happened, so future logout must use the clean guest.
  return{accountId:value.accountId,guestIsolated:value.v===2?value.guestIsolated:value.accountId!==null};
 }catch(error){if(error.code==='ENOENT')return{accountId:null,guestIsolated:false};throw error;}
 finally{if(descriptor!==undefined)fs.closeSync(descriptor);}
}
function queueSelection(marker,action){
 const previous=selections.get(marker)||Promise.resolve(),work=previous.catch(()=>{}).then(action);selections.set(marker,work);
 const release=()=>{if(selections.get(marker)===work)selections.delete(marker);};void work.then(release,release);return work;
}
async function readPrivateJSON(filename,limit=1024*1024){
 let h;try{h=await fsp.open(filename,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));const s=await h.stat();if(!s.isFile()||s.size>limit)throw Error('Invalid private Mouse record');return JSON.parse(await h.readFile('utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}finally{if(h)await h.close();}
}
async function writePrivateJSON(filename,value){
 const dir=path.dirname(filename);directorySync(dir);const temporary=path.join(dir,'.mouse-'+randomBytes(16).toString('hex')+'.tmp');let h;
 try{h=await fsp.open(temporary,'wx',0o600);await h.writeFile(JSON.stringify(value));await h.sync();await h.close();h=null;await fsp.rename(temporary,filename);const d=await fsp.open(dir,'r');try{await d.sync();}finally{await d.close();}}
 finally{if(h)await h.close();await fsp.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
class MouseProfileContext{
 constructor(base){
  if(!path.isAbsolute(base))throw Error('Absolute Mouse profile root required');directorySync(base);
  this.base=base;this.control=path.join(base,'mouse-account');directorySync(this.control);
  this.marker=path.join(this.control,'active-profile.json');this.active=null;
  this.namespace=createHash('sha256').update(path.resolve(base)).digest('hex').slice(0,24);
  const selected=readSelector(this.marker);this.active=selected.accountId;this._guestIsolated=selected.guestIsolated;
  this.directory=this.directoryFor(this.active);
 }
 get guestIsolated(){return this._guestIsolated;}
 _directoryFor(id,isolated){if(id===null){if(!isolated)return this.base;const guest=path.join(this.base,'mouse-guest');directorySync(guest);return guest;}accountId(id);const profiles=path.join(this.base,'mouse-accounts');directorySync(profiles);const dir=path.join(profiles,String(id));directorySync(dir);return dir;}
 directoryFor(id){return this._directoryFor(id,this.guestIsolated);}
 async select(id,options={}){
  if(id!==null)accountId(id);
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>key!=='isolateGuest')||options.isolateGuest!==undefined&&typeof options.isolateGuest!=='boolean')throw Error('Invalid Mouse profile selection options');
  const isolateRequested=options.isolateGuest===true;
  return queueSelection(this.marker,async()=>{
   // A stale context must not undo isolation committed by another selection.
   // The app holds its single-instance lock on base for the process lifetime.
   const persisted=readSelector(this.marker),isolated=this.guestIsolated||persisted.guestIsolated||isolateRequested||id!==null;
   this._directoryFor(id,isolated);if(isolated)this._directoryFor(null,true);
   await writePrivateJSON(this.marker,{v:2,accountId:id,guestIsolated:isolated});
   this._guestIsolated=isolated;
   // Chromium still owns this.active/this.directory until the relaunch. Never
   // make existing pages or writes adopt the next account in the same process.
  });
 }
 async seed(id,snapshot){
  accountId(id);const dir=this.directoryFor(id),Store=require('./storage.cjs').Store,store=new Store(dir);
  const current=await store.get(null);if(Object.keys(current).length)return{directory:dir,created:false};
  const safe=require('./mouse-config-sync.cjs').importWorkspace({},snapshot);await store.set(safe);return{directory:dir,created:true};
 }
}
module.exports={MouseProfileContext,accountId,readPrivateJSON,writePrivateJSON};
