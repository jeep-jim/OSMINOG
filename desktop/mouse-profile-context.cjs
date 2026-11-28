'use strict';

const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
function accountId(value){if(!Number.isSafeInteger(value)||value<1||value>999999999999999)throw Error('Некорректный Mouse ID');return value;}
function directorySync(value){fs.mkdirSync(value,{recursive:true,mode:0o700});const s=fs.lstatSync(value);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Unsafe Mouse profile directory');}
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
  try{const s=fs.lstatSync(this.marker);if(!s.isFile()||s.isSymbolicLink()||s.size>1024)throw Error('Invalid active Mouse profile');const value=JSON.parse(fs.readFileSync(this.marker,'utf8'));if(value?.v!==1||Object.keys(value).some(x=>!['v','accountId'].includes(x)))throw Error('Invalid Mouse profile selector');if(value.accountId!==null)this.active=accountId(value.accountId);}catch(e){if(e.code!=='ENOENT')throw e;}
  this.directory=this.directoryFor(this.active);
 }
 directoryFor(id){if(id===null)return this.base;accountId(id);const profiles=path.join(this.base,'mouse-accounts');directorySync(profiles);const dir=path.join(profiles,String(id));directorySync(dir);return dir;}
 async select(id){if(id!==null)accountId(id);this.directoryFor(id);await writePrivateJSON(this.marker,{v:1,accountId:id});}
 async seed(id,snapshot){
  const dir=this.directoryFor(id),Store=require('./storage.cjs').Store,store=new Store(dir);
  const current=await store.get(null);if(Object.keys(current).length)return{directory:dir,created:false};
  const safe=require('./mouse-config-sync.cjs').importWorkspace({},snapshot);await store.set(safe);return{directory:dir,created:true};
 }
}
module.exports={MouseProfileContext,accountId,readPrivateJSON,writePrivateJSON};
