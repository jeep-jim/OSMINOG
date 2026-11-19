'use strict';
// Local, opt-in clipboard/screenshot copies. No network, telemetry or page APIs.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const MAX_TEXT=1024*1024,MAX_IMAGE=24*1024*1024,MAX_ITEMS=1000,MAX_BYTES=512*1024*1024;
const ID=/^[a-f0-9-]{36}$/i,IMAGE=/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
async function openNoFollow(file){
 const nodeFS=require('node:fs');
 if(process.platform!=='win32')return fs.open(file,nodeFS.constants.O_RDONLY|nodeFS.constants.O_NOFOLLOW);
 // Windows ignores O_NOFOLLOW. The shared native boundary opens the leaf
 // relative to a held parent HANDLE, inspects reparse metadata, and gives Node
 // the same already-validated handle. Never fall back to check-then-open.
 const native=require('./mouse-mcp-fs.node');let fd,parent;
 try{parent=native.openRoot(path.dirname(path.resolve(file)));fd=native.openRead(parent,path.basename(file));}
 catch(error){if([2,3].includes(error.win32Error)&&/cannot be opened|cannot be read/.test(error.message))error.code='ENOENT';throw error;}
 finally{if(parent!==undefined)nodeFS.closeSync(parent);}
 const {promisify}=require('node:util'),stat=promisify(nodeFS.fstat),read=promisify(nodeFS.read),close=promisify(nodeFS.close);
 return{stat:()=>stat(fd),read:(buffer,offset,length,position)=>read(fd,buffer,offset,length,position),close:()=>close(fd)};
}
function hash(type,data){return crypto.createHash('sha256').update(type).update(data).digest('hex');}
function protectedFormats(types){return types.some(t=>/concealed|transient|password|sensitive|exclud(e|ed).*monitor|CanIncludeInClipboardHistory/i.test(t));}
async function readBounded(file,max){
 const h=await openNoFollow(file);
 try{const stat=await h.stat();if(!stat.isFile()||stat.size>max)throw Error('Файл слишком большой или недоступен');const chunks=[];let size=0;for(;;){const block=Buffer.alloc(Math.min(65536,max+1-size));const {bytesRead}=await h.read(block,0,block.length,null);if(!bytesRead)break;size+=bytesRead;if(size>max)throw Error('Файл слишком большой');chunks.push(block.subarray(0,bytesRead));}return Buffer.concat(chunks);}finally{await h.close();}
}
class CaptureArchive{
 constructor({root,clipboard,nativeImage,paused=()=>false,notify=()=>{},now=()=>Date.now()}){
  Object.assign(this,{root:path.resolve(root),clipboard,nativeImage,paused,notify,now});this.items=[];this.enabled=false;this.closed=false;this.epoch=0;this.timer=null;this.busy=false;this.queue=Promise.resolve();this.last='';this.wasPaused=false;this.error='';this.folder='';this.seen=new Map();this.nextScan=0;this.reads=0;
 }
 async init(){
  const stat=await fs.lstat(this.root).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(stat&&(!stat.isDirectory()||stat.isSymbolicLink()))throw Error('Папка локальных копий должна быть обычной папкой');
  let raw;try{raw=await readBounded(path.join(this.root,'index.json'),16*1024*1024)}catch(e){if(e.code!=='ENOENT')throw e;}
  if(raw){const data=JSON.parse(raw.toString('utf8'));if(data.schema!==1||!Array.isArray(data.items)||data.items.length>MAX_ITEMS)throw Error('Не удалось прочитать локальный архив; исходные файлы сохранены');
   for(const x of data.items){if(!x||!ID.test(x.id)||!['text','image'].includes(x.type)||x.file!==x.id+(x.type==='text'?'.txt':'.png')||!Number.isSafeInteger(x.size)||x.size<0||x.size>MAX_IMAGE||typeof x.title!=='string'||x.title.length>200||typeof x.snippet!=='string'||x.snippet.length>2400||!Number.isFinite(x.at)||!/^[a-f0-9]{64}$/.test(x.hash))throw Error('Повреждён индекс локального архива; файлы не изменены');}this.items=data.items;
  }return this;
 }
 state(){return{enabled:this.enabled,paused:this.enabled&&this.paused(),count:this.items.length,bytes:this.items.reduce((s,x)=>s+x.size,0),root:this.root,folder:this.folder,error:this.error,limit:MAX_ITEMS};}
 emit(){this.notify(this.state());}
 async directory(){await fs.mkdir(this.root,{recursive:true,mode:0o700});const s=await fs.lstat(this.root);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Небезопасная папка архива');await fs.chmod(this.root,0o700);}
 serial(fn){const result=this.queue.catch(()=>{}).then(fn);this.queue=result.catch(()=>{});return result;}
 async saveIndex(items=this.items){await this.directory();const temp=path.join(this.root,'.index-'+crypto.randomUUID()+'.tmp');try{await fs.writeFile(temp,JSON.stringify({schema:1,items}),{flag:'wx',mode:0o600});await fs.rename(temp,path.join(this.root,'index.json'));}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
 async snapshot(){
  this.reads++;
  if(typeof this.clipboard.read==='function'){
   const items=await this.clipboard.read();if(Array.isArray(items)){
    const types=items.flatMap(i=>Array.from(i.types||[]));if(protectedFormats(types))return null;
    for(const item of items){const type=Array.from(item.types||[]).find(x=>/^image\/(png|jpeg|webp)$/i.test(x));if(type){const blob=await item.getType(type);if(blob.size>MAX_IMAGE)return null;return{type:'image',data:Buffer.from(await blob.arrayBuffer()),source:'clipboard'};}}
    for(const item of items)if(Array.from(item.types||[]).includes('text/plain')){const blob=await item.getType('text/plain');if(blob.size>MAX_TEXT)return null;const text=await blob.text();if(text.trim())return{type:'text',data:Buffer.from(text),source:'clipboard'};}
    return null;
   }
  }
  // Feature-detected compatibility for an older Windows runtime, not a keypress fallback.
  const types=this.clipboard.availableFormats?.()||[];if(protectedFormats(types))return null;
  if(types.some(t=>/^image\//.test(t))&&this.clipboard.readImage){const image=await this.clipboard.readImage();if(!image.isEmpty()){const data=image.toPNG();if(data.length<=MAX_IMAGE)return{type:'image',data,source:'clipboard'};}}
  const text=await this.clipboard.readText();if(typeof text==='string'&&text.trim()&&Buffer.byteLength(text)<=MAX_TEXT)return{type:'text',data:Buffer.from(text),source:'clipboard'};return null;
 }
 async scan(prime=false,epoch=this.epoch){
  if(!this.folder)return;
  let entries;try{entries=await fs.readdir(this.folder,{withFileTypes:true});}catch(e){if(!prime)this.error='Папка скриншотов недоступна. Выберите её заново.';return;}
  const next=new Map();for(const item of entries.slice(0,5000)){
   if(!item.isFile()||!IMAGE.test(item.name))continue;const file=path.join(this.folder,item.name),stat=await fs.lstat(file).catch(()=>null);if(!stat?.isFile()||stat.isSymbolicLink())continue;
   const key=stat.size+':'+stat.mtimeMs;next.set(item.name,key);
   if(prime||this.seen.get(item.name)===key||stat.size<=0||stat.size>MAX_IMAGE||this.now()-stat.mtimeMs<700)continue;
   if(!this.enabled||this.paused()||this.epoch!==epoch||this.closed)return;
   const data=await readBounded(file,MAX_IMAGE).catch(()=>null);if(data)await this.add({type:'image',data,source:'screenshot-folder',title:item.name},epoch);
  }
  // Keep unsettled files eligible for the next poll; never read originals while paused.
  for(const [name,key]of next){const stamp=Number(key.split(':')[1]);if(this.now()-stamp<700&&!prime)next.set(name,this.seen.get(name)||'pending');}
  this.seen=next;
 }
 async configure({enabled,folder=this.folder}){
  if(typeof enabled!=='boolean')throw Error('Invalid capture preference');if(folder&&(!path.isAbsolute(folder)||folder===this.root))throw Error('Выберите отдельную папку скриншотов');
  this.epoch++;this.enabled=false;clearInterval(this.timer);this.timer=null;this.folder=folder;this.last='';this.error='';this.wasPaused=false;
  if(!enabled){await this.queue;this.emit();return this.state();}
  await this.directory();await this.scan(true);this.enabled=true;const epoch=this.epoch;
  // Do not import the clipboard that existed before explicit enable/resume.
  try{if(!this.paused()){const first=await this.snapshot();if(this.epoch!==epoch||this.closed)return this.state();this.last=first?hash(first.type,first.data):'';}else this.wasPaused=true;}catch(error){this.enabled=false;this.error='Не удалось прочитать буфер: '+error.message;this.emit();throw error;}
  this.timer=setInterval(()=>void this.tick(),1000);this.timer.unref?.();this.emit();return this.state();
 }
 async tick(){
  if(!this.enabled||this.closed||this.busy)return;this.busy=true;const epoch=this.epoch;
  try{
   if(this.paused()){this.wasPaused=true;return;}
   if(this.wasPaused){await this.scan(true,epoch);const first=await this.snapshot();if(epoch!==this.epoch||this.paused())return;this.last=first?hash(first.type,first.data):'';this.wasPaused=false;this.emit();return;}
   const value=await this.snapshot();if(epoch!==this.epoch||!this.enabled||this.paused()||this.closed){this.wasPaused=true;return;}
   const fingerprint=value?hash(value.type,value.data):'';if(fingerprint&&fingerprint!==this.last)await this.add(value,epoch);this.last=fingerprint;
   if(this.now()>=this.nextScan){this.nextScan=this.now()+3000;await this.scan(false,epoch);}
  }catch(e){this.error='Автосбор приостановлен: '+e.message;this.enabled=false;this.epoch++;clearInterval(this.timer);this.timer=null;this.emit();}finally{this.busy=false;}
 }
 async add(value,epoch=null){
  return this.serial(async()=>{
   const allowed=()=>!this.closed&&!this.paused()&&(epoch===null||this.enabled&&epoch===this.epoch);
   if(!allowed())return null;let data=Buffer.from(value.data),type=value.type;if(!['text','image'].includes(type))throw Error('Unsupported capture type');
   if(data.length>(type==='text'?MAX_TEXT:MAX_IMAGE))throw Error('Размер локальной копии превышает лимит');
   if(type==='image'){if(data.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&data.length>=24){const w=data.readUInt32BE(16),h=data.readUInt32BE(20);if(w*h>40000000||!w||!h)throw Error('Изображение слишком большое');}
    const image=this.nativeImage.createFromBuffer(data);if(image.isEmpty())return null;const size=image.getSize();if(size.width*size.height>40000000)throw Error('Изображение слишком большое');data=image.toPNG();if(data.length>MAX_IMAGE)throw Error('Изображение слишком большое');}
   const digest=hash(type,data);if(this.items.some(x=>x.hash===digest))return null;
   if(this.items.length>=MAX_ITEMS||this.state().bytes+data.length>MAX_BYTES)throw Error('Архив заполнен. Удалите ненужные локальные копии.');
   const text=type==='text'?data.toString('utf8'):'';if(type==='text'&&!text.trim())return null;
   const id=crypto.randomUUID(),row={id,type,file:id+(type==='text'?'.txt':'.png'),at:this.now(),size:data.length,hash:digest,source:String(value.source||'manual').slice(0,40),title:String(value.title||(type==='text'?text.trim().split(/\r?\n/)[0].slice(0,100):'Скриншот')).slice(0,200),snippet:text.slice(0,2400)};
   await this.directory();if(!allowed())return null;const file=path.join(this.root,row.file);await fs.writeFile(file,data,{flag:'wx',mode:0o600});
   if(!allowed()){await fs.rm(file,{force:true});return null;}
   const next=[row,...this.items];try{await this.saveIndex(next);}catch(e){await fs.rm(file,{force:true});throw e;}
   if(!allowed()){await this.saveIndex(this.items);await fs.rm(file,{force:true});return null;}
   this.items=next;this.emit();return this.publicRow(row);
  });
 }
 publicRow(x){return{id:x.id,at:x.at,type:x.type,title:x.title,filename:x.file,snippet:x.snippet,size:x.size,state:'completed',source:x.source};}
 matching(query=''){const q=String(query).slice(0,2000).toLocaleLowerCase();return this.items.filter(x=>!q||(x.title+' '+x.snippet).toLocaleLowerCase().includes(q));}
 list(query='',offset=0){const rows=this.matching(query);offset=Math.max(0,Math.min(rows.length,Number(offset)||0));return{total:rows.length,removableTotal:rows.length,items:rows.slice(offset,offset+100).map(x=>this.publicRow(x)),offset};}
 selected({query='',all=false,ids=[],exclude=[]}={}){if(typeof all!=='boolean'||![ids,exclude].every(a=>Array.isArray(a)&&a.length<=MAX_ITEMS&&a.every(x=>typeof x==='string'&&ID.test(x))))throw Error('Invalid archive selection');const s=new Set(ids),e=new Set(exclude);return this.matching(query).filter(x=>all?!e.has(x.id):s.has(x.id)).map(x=>x.id);}
 async preview(id){if(this.paused())throw Error('Архив недоступен в инкогнито или при блокировке устройства');const row=this.items.find(x=>x.id===id);if(!row)throw Error('Копия не найдена');const data=await readBounded(path.join(this.root,row.file),row.type==='text'?MAX_TEXT:MAX_IMAGE);
  if(row.type==='text')return{type:'text',text:data.toString('utf8'),title:row.title};const image=this.nativeImage.createFromBuffer(data);if(image.isEmpty())throw Error('Изображение недоступно');const s=image.getSize(),scale=Math.min(1,1200/s.width,900/s.height);return{type:'image',src:image.resize({width:Math.max(1,Math.round(s.width*scale)),height:Math.max(1,Math.round(s.height*scale))}).toDataURL(),title:row.title};}
 async remove(ids){return this.serial(async()=>{if(this.paused())throw Error('Архив сейчас недоступен');const set=new Set(ids),removed=this.items.filter(x=>set.has(x.id));if(!removed.length)return 0;const next=this.items.filter(x=>!set.has(x.id));await this.saveIndex(next);this.items=next;for(const item of removed)await fs.rm(path.join(this.root,item.file),{force:true});this.emit();return removed.length;});}
 async dispose(){this.closed=true;this.enabled=false;this.epoch++;clearInterval(this.timer);this.timer=null;await this.queue;}
}
module.exports={CaptureArchive,readBounded,protectedFormats,MAX_TEXT,MAX_IMAGE,MAX_ITEMS,MAX_BYTES,IMAGE};
