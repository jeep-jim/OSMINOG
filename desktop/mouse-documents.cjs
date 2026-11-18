'use strict';
const fs=require('node:fs/promises'),fsSync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const MAX_FILE=32*1024*1024,MAX_TOTAL=96*1024*1024,MAX_OPEN=6,MAX_DRAFT=2*1024*1024;
const FORMATS={'.pdf':'pdf','.docx':'docx','.xlsx':'xlsx','.txt':'text','.md':'text','.csv':'text','.tsv':'text','.json':'text'};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const error=(code,message)=>Object.assign(Error(message),{code});
async function readRegular(file){const handle=await fs.open(file,'r');try{
 const stat=await handle.stat();if(!stat.isFile()||stat.size>MAX_FILE)throw Error('Нужен обычный файл размером до 32 МБ');
 const chunks=[];let total=0;
 // The source can grow after stat(). Read at most one byte beyond the limit,
 // rather than allowing readFile() to allocate an unbounded changed file.
 while(total<=MAX_FILE){const chunk=Buffer.allocUnsafe(Math.min(64*1024,MAX_FILE+1-total)),result=await handle.read(chunk,0,chunk.length,null);if(!result.bytesRead)break;total+=result.bytesRead;if(total>MAX_FILE)throw Error('Файл превышает 32 МБ');chunks.push(chunk.subarray(0,result.bytesRead));}
 const bytes=Buffer.concat(chunks,total);return{bytes,hash:digest(bytes),mode:stat.mode&0o777};
}finally{await handle.close();}}
async function fileState(file){try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Выберите обычный файл, не ссылку');return await readRegular(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function canonicalTarget(file){
 // Open records already use realpath. Resolve the native Save dialog's parent
 // too, including macOS /var aliases, before comparing original/saved hashes.
 const parent=await fs.realpath(path.dirname(file)),target=path.join(parent,path.basename(file));let stat;
 try{stat=await fs.lstat(target);}catch(e){if(e.code==='ENOENT')return target;throw e;}
 if(!stat.isFile()||stat.isSymbolicLink())throw Error('Выберите обычный файл, не ссылку');
 const canonical=await fs.realpath(target),current=await fs.lstat(target);
 if(!current.isFile()||current.isSymbolicLink())throw Error('Выберите обычный файл, не ссылку');
 if(stat.dev!==current.dev||stat.ino!==current.ino)throw error('MOUSE_DOCUMENT_CONFLICT','Файл изменён другой программой. Сохраните новую копию.');
 return canonical;
}
async function atomicWrite(file,bytes,before,check=()=>{},onCommit=()=>{}){
 const temporary=path.join(path.dirname(file),'.mouse-document-'+crypto.randomUUID()+'.tmp');let handle;
 try{handle=await fs.open(temporary,'wx',before?.mode||0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;check();const current=await fileState(file);if((current?.hash||null)!==(before?.hash||null))throw error('MOUSE_DOCUMENT_CONFLICT','Файл изменён другой программой. Сохраните новую копию.');const hash=digest(bytes);check();
  // The prepared rename and host revision commit share one JavaScript turn.
  // There is no IPC yield between the final context check and the record update.
  // This is an atomic replacement, not a cross-process compare-and-swap lock.
  fsSync.renameSync(temporary,file);onCommit(hash);
  let directory;try{directory=await fs.open(path.dirname(file),'r');await directory.sync();}catch{}finally{await directory?.close().catch(()=>{});}return hash;}
 finally{await handle?.close().catch(()=>{});await fs.unlink(temporary).catch(()=>{});}
}
class DocumentService{
 constructor({win,dialog,trusted,ipcMain,isPrivate=()=>false,codec,emit}){Object.assign(this,{win,dialog,trusted,isPrivate});this.codec=codec;this.records=new Map();this.listeners=new Set();this.epoch=0;this.queue=Promise.resolve();this.disposed=false;this.emit=emit||(()=>{});if(ipcMain)ipcMain.handle('mouse:documents',(event,action,args)=>{trusted(event);return this.handle(action,args);});}
 zip(){return this.codec||(this.codec=require('./mouse-document-zip.cjs'));}
 describe(r){return{id:r.id,name:r.name,kind:r.kind,size:r.bytes.length,revision:r.revision,dirty:r.dirty,hasSavedCopy:!!r.savedPath,private:r.private};}
 state(){return{documents:[...this.records.values()].map(r=>this.describe(r))};}
 subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 changed(){if(this.disposed)return;const state=this.state();this.emit(state);for(const listener of this.listeners)listener(state);}
 own(id){if(this.disposed||typeof id!=='string')throw Error('Документ закрыт');const r=this.records.get(id);if(!r||r.private!==!!this.isPrivate())throw Error('Документ недоступен в этом сеансе');return r;}
 guard(r,revision=r.revision){const epoch=this.epoch,editGeneration=r.editGeneration;return()=>{if(this.disposed||this.epoch!==epoch||this.records.get(r.id)!==r||r.private!==!!this.isPrivate()||r.revision!==revision||r.editGeneration!==editGeneration)throw error('MOUSE_DOCUMENT_STALE','Документ или режим изменился. Откройте его снова.');};}
 async open(){
  if(this.disposed)throw Error('Редактор закрыт');if(this.records.size>=MAX_OPEN)throw Error('Сначала закройте один из шести документов');const epoch=this.epoch,privateMode=!!this.isPrivate();
  const selected=await this.dialog.showOpenDialog(this.win,{title:'Открыть документ в Mouse',properties:['openFile'],filters:[{name:'Документы',extensions:['pdf','docx','xlsx','txt','md','csv','tsv','json']},{name:'PDF',extensions:['pdf']},{name:'Word',extensions:['docx']},{name:'Excel',extensions:['xlsx']}]});
  if(selected.canceled||!selected.filePaths?.length)return null;if(epoch!==this.epoch||privateMode!==!!this.isPrivate()||this.disposed)throw Error('Режим изменился');
  const file=await fs.realpath(selected.filePaths[0]),kind=FORMATS[path.extname(file).toLowerCase()];if(!kind)throw Error('Поддерживаются PDF, DOCX, XLSX и текстовые файлы');
  const existing=[...this.records.values()].find(r=>(r.originalPath===file||r.savedPath===file)&&r.private===privateMode);if(existing)return this.describe(existing);
  const data=await readRegular(file);if(epoch!==this.epoch||privateMode!==!!this.isPrivate()||this.disposed)throw Error('Режим изменился');
  if([...this.records.values()].reduce((n,r)=>n+r.bytes.length,0)+data.bytes.length>MAX_TOTAL)throw Error('Закройте другие документы: общий размер открытых файлов ограничен 96 МБ');
  let archive;if(kind==='docx'||kind==='xlsx'){archive=this.zip().read(data.bytes);if(archive.kind!==kind)throw Error('Содержимое документа не совпадает с расширением файла');}else if(kind==='pdf'&&!data.bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Файл не является PDF');
  const r={id:crypto.randomUUID(),name:path.basename(file),kind,originalPath:file,originalHash:data.hash,bytes:data.bytes,archive,revision:0,editGeneration:0,dirty:false,draft:null,private:privateMode,savedPath:'',savedHash:''};this.records.set(r.id,r);this.changed();return this.describe(r);
 }
 read(id){const r=this.own(id);return{...this.describe(r),...(r.archive?this.zip().snapshot(r.archive):{bytes:new Uint8Array(r.bytes)}),draft:r.draft?structuredClone(r.draft):null};}
 draft(id,value,expectedRevision){const r=this.own(id),wasDirty=r.dirty;if(expectedRevision!==undefined&&(!Number.isInteger(expectedRevision)||expectedRevision!==r.revision))throw error('MOUSE_DOCUMENT_STALE','Версия документа изменилась');if(value!==undefined){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Неверный черновик');const encoded=JSON.stringify(value);if(encoded.length>MAX_DRAFT)throw Error('Черновик слишком большой');const next=JSON.parse(encoded);if(isDeepStrictEqual(r.draft,next))return this.describe(r);r.draft=next;}r.editGeneration++;r.dirty=true;if(!wasDirty)this.changed();return this.describe(r);}
 async save(args={}){
  const r=this.own(args.id);if(!Number.isInteger(args.expectedRevision)||args.expectedRevision!==r.revision)throw error('MOUSE_DOCUMENT_STALE','Версия документа изменилась');const check=this.guard(r),kind=r.kind;let bytes;
  if(r.archive){if(!args.parts||typeof args.parts!=='object'||Array.isArray(args.parts)||Object.keys(args.parts).length>256)throw Error('Неверные изменения документа');const allowed=kind==='docx'?/^word\/(?:document|header\d*|footer\d*)\.xml$/:/^(?:xl\/workbook\.xml|xl\/worksheets\/[^/]+\.xml)$/;for(const [part,value]of Object.entries(args.parts)){if(!allowed.test(part)||typeof value!=='string'||value.length>16*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(value))throw Error('Неподдерживаемая часть документа');}bytes=this.zip().save(r.archive,args.parts);}
  else{if(!(args.bytes instanceof Uint8Array))throw Error('Нужны байты документа');bytes=Buffer.from(args.bytes);if(kind==='pdf'&&!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('Неверный PDF');}
  if(bytes.length>MAX_FILE)throw Error('Сохраняемый документ превышает 32 МБ');
  const saveAs=args.saveAs===true||!r.savedPath;let target=r.savedPath;
  if(saveAs){const extension=path.extname(r.name),base=path.basename(r.name,extension),result=await this.dialog.showSaveDialog(this.win,{title:r.private?'Сохранить копию · файл останется на Mac':'Сохранить документ',defaultPath:path.join(path.dirname(r.savedPath||r.originalPath),base+(r.savedPath?'':' — копия')+extension),filters:[{name:kind.toUpperCase(),extensions:[extension.slice(1)]}],properties:['showOverwriteConfirmation','createDirectory']});check();if(result.canceled||!result.filePath)return{cancelled:true};target=path.resolve(result.filePath);if(path.extname(target).toLowerCase()!==extension.toLowerCase())throw Error('Сохраните файл с расширением '+extension);}
  target=await canonicalTarget(target);check();const before=await fileState(target);check();const expected=target===r.originalPath?r.originalHash:target===r.savedPath?r.savedHash:null;
  if(expected&&(before?.hash||null)!==expected)throw error('MOUSE_DOCUMENT_CONFLICT','Файл изменён другой программой. Выберите «Сохранить как».');
  const nextArchive=r.archive?this.zip().read(bytes):null;check();await atomicWrite(target,bytes,before,check,hash=>{
   r.bytes=bytes;r.archive=nextArchive;r.savedPath=target;r.savedHash=hash;if(target===r.originalPath)r.originalHash=hash;r.name=path.basename(target);r.revision++;r.dirty=false;r.draft=null;
  });this.changed();return{...this.describe(r),saved:true};
 }
 async confirmClose(id){const r=this.own(id);if(!r.dirty)return'discard';const check=this.guard(r);const result=await this.dialog.showMessageBox(this.win,{type:'question',title:'Изменения документа',message:'Сохранить изменения в «'+r.name+'»?',buttons:['Сохранить','Не сохранять','Отмена'],defaultId:0,cancelId:2,noLink:true});check();return['save','discard','cancel'][result.response]||'cancel';}
 async closeDocument(id,exporter,commit=()=>{}){
  if(this.preparing)throw Error('Завершите выбор сохранения документов');
  const run=async()=>{const r=this.own(id);let check=this.guard(r);const choice=await this.confirmClose(id);check();if(choice==='cancel')return false;
   if(choice==='save'){const payload=await exporter(id);const result=await this.save({id,expectedRevision:r.revision,...payload});if(result.cancelled)return false;if(r.dirty)throw error('MOUSE_DOCUMENT_STALE','После сохранения появились новые правки. Повторите закрытие.');check=this.guard(r);}
   check();
   // A navigation creates the replacement page before the document disappears.
   // DesktopBank therefore sees the same tab ID throughout the transition.
   commit();this.records.delete(id);this.changed();return true;
  };
  const result=this.queue.then(run);this.queue=result.catch(()=>{});return result;
 }
 async prepareExit(exporter){
  if(this.preparing)return this.preparing;
  this.preparing=(async()=>{await this.queue;const records=[...this.records.values()],checks=new Map(records.map(r=>[r,this.guard(r)])),discard=[];
   for(const r of records){if(!r.dirty)continue;const choice=await this.confirmClose(r.id);if(choice==='cancel')throw error('MOUSE_DOCUMENT_CANCEL','Закрытие отменено');if(choice==='discard'){discard.push(r);checks.set(r,this.guard(r));continue;}const payload=await exporter(r.id);const result=await this.save({id:r.id,expectedRevision:r.revision,...payload});if(result.cancelled)throw error('MOUSE_DOCUMENT_CANCEL','Сохранение отменено');if(r.dirty)throw error('MOUSE_DOCUMENT_STALE','После сохранения появились новые правки. Повторите закрытие.');checks.set(r,this.guard(r));}
   // Validate the entire document set, including initially clean and already
   // saved records, before accepting exit or clearing any discard decision.
   if(this.records.size!==records.length)throw error('MOUSE_DOCUMENT_STALE','Список документов изменился. Повторите закрытие.');
   for(const check of checks.values())check();
   for(const r of discard){r.dirty=false;r.draft=null;}if(discard.length)this.changed();
  })();try{return await this.preparing;}finally{this.preparing=null;}
 }
 async handle(action,args={}){
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Неверный запрос документа');
  if(action==='state')return this.state();if(action==='read')return this.read(args.id);if(action==='draft')return this.draft(args.id,args.draft,args.expectedRevision);
  if(this.preparing&&!['state','read','draft'].includes(action))throw Error('Завершите выбор сохранения документов');
  if(action==='release'){const r=this.own(args.id);if(r.dirty)throw Error('Сначала сохраните или закройте документ через его вкладку');this.records.delete(args.id);this.changed();return true;}
  if(!['open','save','confirm-close'].includes(action))throw Error('Неизвестное действие документа');
  const run=()=>action==='open'?this.open():action==='save'?this.save(args):this.confirmClose(args.id),result=this.queue.then(run);this.queue=result.catch(()=>{});return result;
 }
 clear(){this.epoch++;this.records.clear();this.changed();}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.listeners.clear();}
}
module.exports={DocumentService,readRegular,atomicWrite,digest,MAX_FILE,MAX_TOTAL,MAX_OPEN};
