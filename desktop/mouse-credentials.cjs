'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const MAGIC=Buffer.from('MOUSE-CREDENTIALS-1\n'),MAX_BYTES=32*1024*1024,MAX_ENTRIES=10000;
const UNAVAILABLE='Защищённое хранилище паролей ОС недоступно. Разблокируйте системную связку ключей; на Linux нужен Secret Service или KWallet. Пароли не будут сохранены без шифрования.';
function origin(value){try{if(typeof value!=='string'||value.length>8192||/[\x00-\x20]/.test(value))return '';const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.origin:'';}catch{return '';}}
function cleanTitle(value){return String(value||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,500);}
function validCredential(row){return row&&typeof row==='object'&&!!row.origin&&origin(row.origin)===row.origin&&typeof row.username==='string'&&row.username.length<=1024&&!/[\x00-\x1f\x7f]/.test(row.username)&&typeof row.password==='string'&&row.password.length>0&&row.password.length<=16384&&!row.password.includes('\0');}
function clearSecrets(rows){for(const row of rows||[])if(row&&typeof row==='object')row.password='';}
async function boundedRead(file,max=MAX_BYTES){
 let handle;
 try{
  handle=await fs.open(file,'r');const stat=await handle.stat();if(!stat.isFile()||stat.size>max)throw Error('LIMIT');
  const data=Buffer.alloc(Math.min(stat.size+1,max+1));let used=0;
  while(used<data.length){const {bytesRead}=await handle.read(data,used,data.length-used,null);if(!bytesRead)break;used+=bytesRead;}
  // Reject a file that grew during the read instead of importing a truncated prefix.
  const extra=Buffer.alloc(1),tail=await handle.read(extra,0,1,null);if(tail.bytesRead||used>max||used>stat.size){data.fill(0);throw Error('LIMIT');}
  return data.subarray(0,used);
 }finally{await handle?.close();}
}
class CredentialStore{
 constructor({file,safeStorage,platform=process.platform}){this.file=file;this.safeStorage=safeStorage;this.platform=platform;this.queue=Promise.resolve();}
 availability(){
  try{if(!this.safeStorage?.isEncryptionAvailable?.())return{available:false,reason:UNAVAILABLE};if(this.platform==='linux'&&!['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(this.safeStorage.getSelectedStorageBackend?.()))return{available:false,reason:UNAVAILABLE};return{available:true,reason:''};}catch{return{available:false,reason:UNAVAILABLE};}
 }
 requireEncryption(){const value=this.availability();if(!value.available)throw Error(value.reason);}
 run(work){const next=this.queue.catch(()=>{}).then(work);this.queue=next.then(()=>{},()=>{});return next;}
 async read(){
  this.requireEncryption();let bytes;
  try{bytes=await boundedRead(this.file);}catch(error){if(error.code==='ENOENT')return [];throw Error('Не удалось прочитать защищённое хранилище. Существующие пароли не изменены.');}
  try{
   if(!bytes.subarray(0,MAGIC.length).equals(MAGIC))throw Error('Format');
   const plain=this.safeStorage.decryptString(bytes.subarray(MAGIC.length)),value=JSON.parse(plain);
   if(value?.schema!==1||!Array.isArray(value.entries)||value.entries.length>MAX_ENTRIES)throw Error('Format');
   const ids=new Set(),keys=new Set();for(const row of value.entries){const key=row.origin+'\n'+row.username;if(!validCredential(row)||typeof row.id!=='string'||row.id.length>100||ids.has(row.id)||keys.has(key)||!Number.isSafeInteger(row.createdAt)||row.createdAt<0)throw Error('Format');ids.add(row.id);keys.add(key);}
   return value.entries;
  }catch{throw Error('Не удалось расшифровать сохранённые пароли. Проверьте доступ к системной связке ключей; хранилище не изменено.');}
  finally{bytes.fill(0);}
 }
 async write(rows,guard=()=>{}){
  this.requireEncryption();guard();let encrypted,handle,tmp;
  try{
   const plain=JSON.stringify({schema:1,entries:rows});if(Buffer.byteLength(plain)>MAX_BYTES-MAGIC.length-4096)throw Error('LIMIT');
   encrypted=Buffer.concat([MAGIC,this.safeStorage.encryptString(plain)]);
   if(encrypted.length>MAX_BYTES)throw Error('LIMIT');
   await fs.mkdir(path.dirname(this.file),{recursive:true,mode:0o700});guard();
   tmp=this.file+'.'+randomUUID()+'.tmp';handle=await fs.open(tmp,'wx',0o600);await handle.writeFile(encrypted);await handle.sync();await handle.close();handle=null;
   guard();await fs.rename(tmp,this.file);tmp=null;
  }catch(error){if(error?.code==='MOUSE_IMPORT_CANCELLED')throw error;throw Error('Не удалось сохранить зашифрованные пароли. Существующее хранилище сохранено.');}
  finally{await handle?.close().catch(()=>{});if(tmp)await fs.unlink(tmp).catch(()=>{});encrypted?.fill(0);}
 }
 async status(){const state=this.availability();if(!state.available)return{...state,count:0};return this.run(async()=>{let rows;try{rows=await this.read();return{...state,count:rows.length};}catch(error){return{available:false,count:0,reason:error.message};}finally{clearSecrets(rows);}});}
 list({query='',offset=0}={}){return this.run(async()=>{let rows;try{rows=await this.read();const q=String(query).toLocaleLowerCase().slice(0,500),matched=rows.filter(row=>!q||[row.origin,row.username,row.title].join(' ').toLocaleLowerCase().includes(q));offset=Math.max(0,Math.min(matched.length,Math.floor(Number(offset)||0)));return{available:true,reason:'',total:matched.length,offset,items:matched.slice(offset,offset+100).map(({id,origin,username,title,createdAt})=>({id,origin,username,title,createdAt}))};}finally{clearSecrets(rows);}});}
 merge(records,guard=()=>{}){return this.run(async()=>{
  let rows;try{
   guard();rows=await this.read();guard();const keys=new Map(rows.map(row=>[row.origin+'\n'+row.username,row]));let imported=0,duplicates=0,conflicts=0;
   for(const row of records){if(!validCredential(row))throw Error('Некорректная запись пароля');const key=row.origin+'\n'+row.username,old=keys.get(key);if(old){if(old.password===row.password)duplicates++;else conflicts++;continue;}if(rows.length>=MAX_ENTRIES)throw Error('В хранилище может быть не больше 10000 паролей; импорт не выполнен.');const next={id:randomUUID(),origin:row.origin,username:row.username,password:row.password,title:cleanTitle(row.title)||row.origin,createdAt:Date.now()};rows.push(next);keys.set(key,next);imported++;}
   if(imported)await this.write(rows,guard);guard();return{imported,duplicates,conflicts};
  }finally{clearSecrets(rows);}
 });}
 withPassword(id,work,guard=()=>{}){return this.run(async()=>{let rows;try{guard();rows=await this.read();guard();const row=rows.find(item=>item.id===id);if(!row)throw Error('Сохранённый пароль не найден');return await work(row.password);}finally{clearSecrets(rows);}});}
 remove(id,guard=()=>{}){return this.run(async()=>{let rows;try{guard();rows=await this.read();guard();const index=rows.findIndex(row=>row.id===id);if(index<0)return false;rows[index].password='';rows.splice(index,1);await this.write(rows,guard);guard();return true;}finally{clearSecrets(rows);}});}
}
module.exports={CredentialStore,origin,cleanTitle,validCredential,clearSecrets,boundedRead,MAX_BYTES,MAX_ENTRIES,UNAVAILABLE};
