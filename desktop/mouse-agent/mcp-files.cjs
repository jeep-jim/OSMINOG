'use strict';
// The file-tool boundary, not an OS sandbox. No shell, network, symlink or
// arbitrary module operation is exposed by this server. Commands are a separate
// permission in AgentHost. Filesystem checks do not sandbox other local programs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LIMITS=Object.freeze({readBytes:256*1024,writeBytes:64*1024,entries:1000,depth:8,path:2048});
const IGNORED=new Set(['.git','node_modules','.cache','.next','dist','build']);
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
const invalid=message=>Object.assign(Error(message),{code:'MOUSE_LOCAL_DENIED'});
function relativePath(value,{root=false}={}){
 if(typeof value!=='string'||!value||value.length>LIMITS.path||/[\x00-\x1f\x7f\\:]/.test(value)||path.isAbsolute(value))throw invalid('Нужен относительный путь внутри папки проекта');
 if(root&&value==='.')return'.';
 const pieces=value.split('/');if(pieces.length>32||pieces.some(x=>!x||x==='.'||x==='..'))throw invalid('Выход за пределы папки и неоднозначные пути запрещены');
 return pieces.join('/');
}
function integer(value,fallback,max){if(value===undefined)return fallback;if(!Number.isInteger(value)||value<1||value>max)throw invalid('Превышен лимит обхода папки');return value;}
function strictArgs(args,names){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!names.includes(k)))throw invalid('Недопустимые параметры файлового инструмента');}
const tool=(name,description,properties,required,readOnlyHint)=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint,destructiveHint:!readOnlyHint,idempotentHint:readOnlyHint,openWorldHint:false}});
const PATH={type:'string',maxLength:LIMITS.path,description:'Relative path within the user-selected project. No symlinks or .. segments.'};
const TOOLS=Object.freeze([
 tool('read_file','Read a UTF-8 file, at most 256 KiB. Returns content and SHA-256 for a precommit conflict check.',{path:PATH},['path'],true),
 tool('write_file','Create a UTF-8 file exclusively or replace its content atomically, at most 64 KiB. Requires the owner\'s editing permission. Existing files require expectedSha256 from read_file and are checked again before replacement; this is not an atomic compare-and-swap with other editors. No commands are executed by this tool.',{path:PATH,content:{type:'string',maxLength:LIMITS.writeBytes},expectedSha256:{type:'string',pattern:'^[a-f0-9]{64}$'}},['path','content'],false),
 tool('list_directory','List a bounded project tree. Symlinks are shown as blocked and never followed. Generated directories are not recursively expanded.',{path:{...PATH,default:'.'},depth:{type:'integer',minimum:1,maximum:LIMITS.depth,default:4},limit:{type:'integer',minimum:1,maximum:LIMITS.entries,default:500}},[],true),
 tool('search_files','Find names using a literal case-insensitive substring within the project, with bounded depth and result count. Does not read file contents.',{query:{type:'string',minLength:1,maxLength:200},path:{...PATH,default:'.'},limit:{type:'integer',minimum:1,maximum:LIMITS.entries,default:200}},['query'],true)
]);
class ScopedFiles{
 constructor(folder,{write=false,extra,native,onAction=()=>{}}={}){
  if(typeof folder!=='string'||!path.isAbsolute(folder))throw invalid('Нужна абсолютная папка проекта');
  this.fs=extra||require('./deps.cjs')('fs-extra');
  // This module is mandatory. Missing native confinement never falls back to
  // check-then-open path operations. Electron resolves it from app.asar.unpacked.
  this.native=native||require('../mouse-mcp-fs.node');this.root=fs.realpathSync(folder);this.rootIdentity=fs.lstatSync(this.root);
  if(!this.rootIdentity.isDirectory()||this.rootIdentity.isSymbolicLink())throw invalid('Нужна обычная папка проекта');
  this.rootFd=this.native.openRoot(this.root);
  if(!same(fs.fstatSync(this.rootFd),this.rootIdentity)){fs.closeSync(this.rootFd);throw invalid('Папка изменена во время открытия');}
  this.writeAllowed=write===true;this.closed=false;this.onAction=onAction;
 }
 checkRoot(){
  if(this.closed)throw invalid('Доступ к папке отозван');
  const current=fs.lstatSync(this.root);if(current.isSymbolicLink()||!current.isDirectory()||!same(current,this.rootIdentity)||fs.realpathSync(this.root)!==this.root)throw invalid('Папка проекта была заменена; выберите её снова');
 }
 directory(value='.',{create=false}={}){
  const relative=relativePath(value,{root:true});this.checkRoot();let fd=this.rootFd;
  try{if(relative!=='.')for(const component of relative.split('/')){const next=this.native.openDir(fd,component,create);if(fd!==this.rootFd)fs.closeSync(fd);fd=next;}
   return{fd,close:()=>{if(fd!==this.rootFd)fs.closeSync(fd);}};
  }catch(error){if(fd!==this.rootFd)fs.closeSync(fd);throw error;}
 }
 parent(value,{create=false}={}){
  const relative=relativePath(value),pieces=relative.split('/'),name=pieces.pop(),parent=this.directory(pieces.join('/')||'.',{create});return{...parent,relative,name};
 }
 regular(stat){if(stat?.type!=='file'||stat.nlink!==1)throw invalid('Доступны только обычные файлы без жёстких ссылок');}
 readAt(parent,name,relative){
  const fd=this.native.openRead(parent,name);
  try{
   const before=fs.fstatSync(fd,{bigint:true});if(before.size>BigInt(LIMITS.readBytes))throw invalid('Файл больше лимита чтения 256 КиБ');
   // A growing file cannot cause unbounded readFile allocation. Never request
   // more than limit+1 bytes even if another process keeps appending.
   const buffer=Buffer.alloc(LIMITS.readBytes+1);let length=0;
   while(length<buffer.length){const count=this.fs.readSync(fd,buffer,length,buffer.length-length,null);if(!count)break;length+=count;}
   if(length>LIMITS.readBytes)throw invalid('Файл вырос сверх лимита чтения');
   const after=fs.fstatSync(fd,{bigint:true});if(before.ino!==after.ino||before.dev!==after.dev||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs||before.size!==after.size)throw invalid('Файл изменён во время чтения');
   const bytes=buffer.subarray(0,length),content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(content.includes('\0'))throw invalid('Двоичные файлы не редактируются текстовым инструментом');
   this.checkRoot();return{path:relative,content,encoding:'utf-8',bytes:length,sha256:hash(bytes)};
  }finally{fs.closeSync(fd);}
 }
 read(value){const parent=this.parent(value);try{return this.readAt(parent.fd,parent.name,parent.relative);}finally{parent.close();}}
 write(value,content,expectedSha256){
  if(!this.writeAllowed)throw invalid('Запись отключена. Владелец должен включить «Разрешить редактирование»');
  const relative=relativePath(value);if(typeof content!=='string'||content.includes('\0')||Buffer.byteLength(content,'utf8')>LIMITS.writeBytes)throw invalid('Нужен UTF-8 текст не больше 64 КиБ');
  if(expectedSha256!==undefined&&(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedSha256)))throw invalid('Недопустимый SHA-256 прежнего файла');
  const parent=this.parent(relative,{create:true});let fd,created=false,tempName;
  try{
   const prior=this.native.stat(parent.fd,parent.name);
   if(prior){this.regular(prior);if(expectedSha256!==this.readAt(parent.fd,parent.name,relative).sha256)throw invalid('Конфликт файла: сначала прочитайте актуальный файл и передайте его expectedSha256');}
   else if(expectedSha256!==undefined)throw invalid('Файл был удалён после чтения');
   tempName='.mouse-local-'+crypto.randomBytes(16).toString('hex')+'.tmp';fd=this.native.openTemp(parent.fd,tempName,prior?prior.mode&0o777:0o600);created=true;
   this.fs.writeFileSync(fd,content,{encoding:'utf8'});fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;this.checkRoot();
   // Native commit checks the observed prior inode/timestamps and uses only the
   // held parent FD. A path/symlink replacement cannot redirect this rename.
   this.native.commit(parent.fd,tempName,parent.name,prior);created=false;const result=this.readAt(parent.fd,parent.name,relative);
   if(result.sha256!==hash(Buffer.from(content,'utf8')))throw invalid('Содержимое изменено другим процессом после записи');
   return{path:relative,bytes:result.bytes,sha256:result.sha256,created:!prior};
  }finally{if(fd!==undefined)fs.closeSync(fd);if(created){try{this.native.remove(parent.fd,tempName);}catch{}}parent.close();}
 }
 walk(value='.',{depth=4,limit=500,query}={}){
  depth=integer(depth,4,LIMITS.depth);limit=integer(limit,500,LIMITS.entries);const relative=relativePath(value,{root:true}),base=this.directory(relative),entries=[];let visited=0,truncated=false;
  const visit=(fd,dir,level)=>{
   const listing=this.native.list(fd,LIMITS.entries+1);if(listing.truncated)truncated=true;
   for(const name of listing.names.sort((a,b)=>a.localeCompare(b))){
    if(name.startsWith('.mouse-local-'))continue;
    if(++visited>LIMITS.entries||entries.length>=limit){truncated=true;return;}
    const child=dir==='.'?name:dir+'/'+name;let stat;try{relativePath(child);stat=this.native.stat(fd,name);}catch{continue;}if(!stat)continue;
    const blocked=stat.type==='symlink'?'symlink':stat.type==='file'&&stat.nlink!==1?'hardlink':!['file','directory'].includes(stat.type)?'special':null;
    const type=blocked?'blocked':stat.type;
    if(!query||name.toLocaleLowerCase().includes(query))entries.push({path:child,name,type,depth:level,size:stat.type==='file'?stat.size:0,modifiedAt:Math.floor(stat.modifiedAt),...(blocked?{blocked}:{})});
    if(type==='directory'&&level<depth&&!IGNORED.has(name)){
     let childFd;try{childFd=this.native.openDir(fd,name,false);visit(childFd,child,level+1);}catch{truncated=true;}finally{if(childFd!==undefined)fs.closeSync(childFd);}if(visited>LIMITS.entries||entries.length>=limit)return;
    }
   }
  };try{visit(base.fd,relative,1);this.checkRoot();return{path:relative,entries,truncated,depth,limit,ignoredDirectories:[...IGNORED]};}finally{base.close();}
 }
 execute(name,args={}){
  let relative='';try{
   let result;
   if(name==='read_file'){strictArgs(args,['path']);relative=args.path;result=this.read(args.path);}
   else if(name==='write_file'){strictArgs(args,['path','content','expectedSha256']);relative=args.path;result=this.write(args.path,args.content,args.expectedSha256);}
   else if(name==='list_directory'){strictArgs(args,['path','depth','limit']);relative=args.path||'.';result=this.walk(relative,{depth:args.depth,limit:args.limit});}
   else if(name==='search_files'){strictArgs(args,['query','path','limit']);if(typeof args.query!=='string'||!args.query.trim()||args.query.length>200)throw invalid('Нужна строка поиска длиной до 200 символов');relative=args.path||'.';result=this.walk(relative,{depth:LIMITS.depth,limit:args.limit??200,query:args.query.toLocaleLowerCase()});}
   else throw invalid('Неизвестный файловый инструмент');
   this.onAction({tool:name,path:relative,status:'ok',...(name==='write_file'?{bytes:result.bytes}:{})});return result;
  }catch(error){this.onAction({tool:String(name).slice(0,50),path:typeof relative==='string'?relative.slice(0,400):'',status:'denied',message:String(error.message).slice(0,300)});throw error;}
 }
 close(){if(this.closed)return;this.closed=true;this.writeAllowed=false;fs.closeSync(this.rootFd);}
}

module.exports={ScopedFiles,LIMITS,TOOLS,IGNORED,relativePath};
