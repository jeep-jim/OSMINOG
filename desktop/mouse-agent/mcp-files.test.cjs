'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {ScopedFiles,LIMITS,TOOLS}=require('./mcp-files.cjs'),native=require('../mouse-mcp-fs.node');
function fixture(options={}){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-mcp-files-')),root=path.join(base,'project'),outside=path.join(base,'outside');fs.mkdirSync(root);fs.mkdirSync(outside);fs.writeFileSync(path.join(root,'hello.txt'),'inside');fs.writeFileSync(path.join(outside,'secret.txt'),'outside sentinel');
 const files=new ScopedFiles(root,options);return{base,root,outside,files,close(){files.close();fs.rmSync(base,{recursive:true,force:true});}};
}
test('real native file tools default readonly, list/search/read and opt-in UTF-8 atomic writes',()=>{
 const f=fixture();try{
  assert.deepEqual(TOOLS.map(x=>x.name),['read_file','write_file','list_directory','search_files']);assert.equal(f.files.execute('read_file',{path:'hello.txt'}).content,'inside');
  assert.equal(f.files.execute('list_directory',{}).entries[0].path,'hello.txt');assert.equal(f.files.execute('search_files',{query:'HELLO'}).entries[0].name,'hello.txt');
  assert.throws(()=>f.files.execute('write_file',{path:'new/nested.txt',content:'bad'}),/Запись отключена/);assert.equal(fs.existsSync(path.join(f.root,'new')),false);
  f.files.writeAllowed=true;const before=f.files.read('hello.txt');assert.throws(()=>f.files.write('hello.txt','replace'),/Конфликт/);
  f.files.write('hello.txt','текст €',before.sha256);assert.equal(fs.readFileSync(path.join(f.root,'hello.txt'),'utf8'),'текст €');
  const result=f.files.write('new/nested.txt','hello');assert.equal(result.created,true);assert.equal(f.files.read('new/nested.txt').content,'hello');assert.ok(!fs.readdirSync(path.join(f.root,'new')).some(x=>x.startsWith('.mouse-local-')));
 }finally{f.close();}
});
test('absolute, traversal, alternate separator, null, command-shaped args and excessive parent depth denied',()=>{
 const f=fixture({write:true});try{
  for(const name of ['../outside/secret.txt','/etc/passwd','a/../../outside/secret.txt','a\\..\\secret','file:stream','a//file','./hello.txt','hello.txt\0x',Array(34).fill('x').join('/')])assert.throws(()=>f.files.read(name),/путь|пути|папки|Выход/);
  assert.throws(()=>f.files.execute('read_file',{path:'hello.txt',command:'cat /etc/passwd'}),/параметры/);assert.throws(()=>f.files.execute('exec',{command:'bad'}),/Неизвестный/);
 }finally{f.close();}
});
test('symlink directory/file, hardlinks and special files never cross the selected capability',()=>{
 const f=fixture({write:true});try{
  fs.symlinkSync(f.outside,path.join(f.root,'link'));fs.symlinkSync(path.join(f.outside,'secret.txt'),path.join(f.root,'file-link'));fs.linkSync(path.join(f.outside,'secret.txt'),path.join(f.root,'hard'));
  for(const name of ['link/secret.txt','file-link','hard']){assert.throws(()=>f.files.read(name));assert.throws(()=>f.files.write(name,'escape'));}
  const blocked=f.files.walk().entries.filter(x=>x.type==='blocked');assert.equal(blocked.length,3);assert.equal(fs.readFileSync(path.join(f.outside,'secret.txt'),'utf8'),'outside sentinel');
 }finally{f.close();}
});
test('held parent directory prevents a symlink replacement redirecting read or final write',()=>{
 for(const phase of ['openRead','openTemp','commit']){
  let f,swapped=false;const backend=new Proxy(Object.fromEntries(Object.getOwnPropertyNames(native).map(k=>[k,native[k]])),{get(target,key){const value=target[key];if(key!==phase)return value;return(...args)=>{if(!swapped){swapped=true;fs.renameSync(path.join(f.root,'sub'),path.join(f.root,'held'));fs.symlinkSync(f.outside,path.join(f.root,'sub'));}return value(...args);};}});
  f=fixture({write:true,native:backend});try{
   fs.mkdirSync(path.join(f.root,'sub'));fs.writeFileSync(path.join(f.root,'sub','secret.txt'),'authorized object');
   if(phase==='openRead')assert.equal(f.files.read('sub/secret.txt').content,'authorized object');else{f.files.write('sub/new.txt','authorized write');assert.equal(fs.readFileSync(path.join(f.root,'held','new.txt'),'utf8'),'authorized write');}
   assert.equal(fs.readFileSync(path.join(f.outside,'secret.txt'),'utf8'),'outside sentinel');assert.equal(fs.existsSync(path.join(f.outside,'new.txt')),false);
  }finally{f.close();}
 }
});
test('directory replacement before openat fails closed instead of following it',()=>{
 let f,done=false;const backend=new Proxy(Object.fromEntries(Object.getOwnPropertyNames(native).map(k=>[k,native[k]])),{get(target,key){if(key!=='openDir')return target[key];return(...args)=>{if(!done&&args[1]==='sub'){done=true;fs.renameSync(path.join(f.root,'sub'),path.join(f.root,'old'));fs.symlinkSync(f.outside,path.join(f.root,'sub'));}return target.openDir(...args);};}});
 f=fixture({write:true,native:backend});try{fs.mkdirSync(path.join(f.root,'sub'));assert.throws(()=>f.files.write('sub/new.txt','must not escape'),/symlink/);assert.equal(fs.existsSync(path.join(f.outside,'new.txt')),false);}finally{f.close();}
});
test('new-file conflict and an edited existing file are preserved at commit',()=>{
 for(const existing of [false,true]){
  let f;const backend=new Proxy(Object.fromEntries(Object.getOwnPropertyNames(native).map(k=>[k,native[k]])),{get(target,key){if(key!=='commit')return target[key];return(...args)=>{fs.writeFileSync(path.join(f.root,'race.txt'),'concurrent writer');return target.commit(...args);};}});
  f=fixture({write:true,native:backend});try{if(existing)fs.writeFileSync(path.join(f.root,'race.txt'),'old');const digest=existing?f.files.read('race.txt').sha256:undefined;assert.throws(()=>f.files.write('race.txt','agent replacement',digest),/another writer|changed after/);assert.equal(fs.readFileSync(path.join(f.root,'race.txt'),'utf8'),'concurrent writer');assert.ok(!fs.readdirSync(f.root).some(x=>x.startsWith('.mouse-local-')));}finally{f.close();}
 }
});
test('read and write are bounded by UTF-8 bytes, including a file that grows during descriptor reading',()=>{
 let largest=0,grew=false,f;const extra={...fs,readSync(fd,buffer,offset,length,position){largest=Math.max(largest,length);if(!grew){grew=true;fs.appendFileSync(path.join(f.root,'hello.txt'),'x'.repeat(LIMITS.readBytes*2));}return fs.readSync(fd,buffer,offset,length,position);}};
 f=fixture({write:true,extra});try{assert.throws(()=>f.files.read('hello.txt'),/лимит/);assert.equal(largest,LIMITS.readBytes+1);assert.throws(()=>f.files.write('utf.txt','€'.repeat(Math.ceil(LIMITS.writeBytes/3))),/64 КиБ/);assert.equal(fs.existsSync(path.join(f.root,'utf.txt')),false);}finally{f.close();}
});
test('directory enumeration is capped before sorting and explicit truncation is reported',()=>{
 let largest=0;const backend=new Proxy(Object.fromEntries(Object.getOwnPropertyNames(native).map(k=>[k,native[k]])),{get(target,key){if(key!=='list')return target[key];return(fd,limit)=>{const result=target.list(fd,limit);largest=Math.max(largest,result.names.length);return result;};}}),f=fixture({native:backend});try{
  for(let i=0;i<1200;i++)fs.writeFileSync(path.join(f.root,'file-'+i),'');const result=f.files.walk('.',{limit:1});assert.equal(result.entries.length,1);assert.equal(result.truncated,true);assert.ok(largest<=1001);
 }finally{f.close();}
});
test('root replacement and closed capability cannot regain access',()=>{
 const f=fixture({write:true});try{fs.renameSync(f.root,path.join(f.base,'old'));fs.symlinkSync(f.outside,f.root);assert.throws(()=>f.files.read('secret.txt'),/заменена/);assert.throws(()=>f.files.write('secret.txt','bad'),/заменена/);f.files.close();assert.throws(()=>f.files.walk(),/отозван/);assert.equal(fs.readFileSync(path.join(f.outside,'secret.txt'),'utf8'),'outside sentinel');}finally{f.close();}
});
test('audit contains operation/path/outcome and never file contents',()=>{
 const records=[],f=fixture({onAction:record=>records.push(record)});try{f.files.execute('read_file',{path:'hello.txt'});assert.throws(()=>f.files.execute('write_file',{path:'hello.txt',content:'SENSITIVE_CONTENT'}));assert.equal(records.length,2);assert.equal(records[0].status,'ok');assert.equal(records[1].status,'denied');assert.ok(!JSON.stringify(records).includes('SENSITIVE_CONTENT'));}finally{f.close();}
});
