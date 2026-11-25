'use strict';

const fs=require('node:fs/promises'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {compile,compileAsync,SEED_RULES}=require('./mouse-adblock-rules.cjs');
const SOURCES=Object.freeze([
 Object.freeze({id:'easylist',url:'https://easylist-downloads.adblockplus.org/easylist.txt',name:'EasyList',authors:'The EasyList authors',homepage:'https://easylist.to/',license:'https://creativecommons.org/licenses/by-sa/3.0/'}),
 Object.freeze({id:'ruadlist',url:'https://easylist-downloads.adblockplus.org/ruadlist.txt',name:'RU AdList',authors:'RU AdList authors (see the preserved list header)',homepage:'https://forums.lanik.us/viewforum.php?f=102',license:'https://creativecommons.org/licenses/by/3.0/'})
]);
const MAX_BYTES=8*1024*1024,MAX_CACHE_BYTES=MAX_BYTES*2,MAX_AGE=24*60*60*1000;
const sha256=value=>createHash('sha256').update(value).digest('hex');
function validateText(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BYTES||text.includes('\0')||!/^\uFEFF?\[Adblock(?: Plus)? [\d.]+\]/.test(text))throw Error('Invalid filter-list format');
 const lines=text.split(/\r?\n/);if(lines.length<50||lines.length>250000||lines.some(line=>line.startsWith('%include')))throw Error('Incomplete filter list');
 return text;
}
async function downloadList(source,{signal,fetchImpl=globalThis.fetch}={}){
 if(!SOURCES.some(item=>item.id===source.id&&item.url===source.url))throw Error('Unknown filter subscription');
 const response=await fetchImpl(source.url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,
  headers:{Accept:'text/plain','User-Agent':'Mouse-Browser-Filter-Updater'}});
 if(response.status!==200||!response.body)throw Error('Filter server unavailable');
 const type=response.headers.get('content-type')||'';
 if(type&&!/^(?:text\/plain|application\/octet-stream)(?:;|$)/i.test(type))throw Error('Unexpected filter content type');
 const declared=Number(response.headers.get('content-length'));if(declared>MAX_BYTES)throw Error('Filter list too large');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES)throw Error('Filter list too large');chunks.push(Buffer.from(value));}}
 finally{try{await reader.cancel();}catch{}reader.releaseLock();}
 return validateText(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes)));
}
function validRecord(value,source,now=Date.now()){
 if(!value||value.schema!==1||value.source!==source.id||value.url!==source.url||typeof value.updatedAt!=='string')throw Error('Invalid filter cache');
 const date=Date.parse(value.updatedAt);if(!Number.isFinite(date)||date>now+300000)throw Error('Invalid filter cache date');
 validateText(value.text);if(value.sha256!==sha256(value.text))throw Error('Filter cache checksum mismatch');
 return value;
}
class MouseAdBlock{
 constructor({directory,notify=()=>{},report=()=>{},fetchList=downloadList,now=Date.now,requestTimeout=20000}={}){
  if(!path.isAbsolute(directory||''))throw Error('An absolute local filter-cache directory is required');
  this.directory=directory;this.notify=notify;this.report=report;this.fetchList=fetchList;this.now=now;this.requestTimeout=requestTimeout;
  this.enabled=false;this.disposed=false;this.records=new Map();this.sessions=new Map();this.engine=compile([SEED_RULES]);
  this.loading=false;this.prepared=false;this.preparing=null;this.inFlight=null;this.controllers=new Set();this.generation=0;this.timer=null;
 }
 state(){
  const dates=[...this.records.values()].map(record=>record.updatedAt).sort();
  return{enabled:this.enabled,phase:!this.enabled?'off':this.loading?'loading':this.records.size?'ready':'fallback',lists:this.records.size,rules:this.engine.count,updatedAt:dates[0]||null};
 }
 emit(){try{this.notify(this.state());}catch{}}
 reportFailure(stage,source){try{this.report('MOUSE_ADBLOCK_'+stage+(source?' '+source:''));}catch{}}
 async prepare(){
  if(this.prepared)return;if(this.preparing)return this.preparing;
  this.preparing=(async()=>{
   for(const source of SOURCES){
    try{const file=path.join(this.directory,source.id+'.json'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_CACHE_BYTES)throw Error('Invalid cache file');
     const record=validRecord(JSON.parse(await fs.readFile(file,'utf8')),source,this.now());
     const candidate=await compileAsync([record.text]);if(candidate.blockCount<10)throw Error('Empty filter cache');this.records.set(source.id,record);
    }catch(error){if(error.code!=='ENOENT')this.reportFailure('CACHE_IGNORED',source.id);}
   }
   this.engine=await compileAsync([SEED_RULES,...[...this.records.values()].map(record=>record.text)]);this.prepared=true;
  })().finally(()=>{this.preparing=null;this.emit();});return this.preparing;
 }
 async initialize(enabled=false){
  // Disabled profiles do not parse lists or contact a subscription server.
  if(enabled===true){await this.prepare();this.setEnabled(true);}return this;
 }
 setEnabled(value){
  if(this.disposed)return;
  const enabled=value===true;if(enabled===this.enabled)return;
  this.enabled=enabled;this.generation++;
  if(!enabled){clearInterval(this.timer);this.timer=null;for(const controller of this.controllers)controller.abort();this.loading=false;this.emit();return;}
  this.loading=!this.prepared;this.emit();
  this.timer=setInterval(()=>void this.refresh().catch(()=>this.reportFailure('REFRESH_FAILED')),60*60*1000);this.timer.unref?.();
  void this.prepare().then(()=>this.refresh()).catch(()=>{this.loading=false;this.emit();this.reportFailure('PREPARE_FAILED');});
 }
 async save(source,record){
  await fs.mkdir(this.directory,{recursive:true,mode:0o700});
  const stat=await fs.lstat(this.directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Invalid filter-cache directory');
  const temporary=path.join(this.directory,'.'+source.id+'-'+randomUUID()+'.tmp');
  try{await fs.writeFile(temporary,JSON.stringify(record),{encoding:'utf8',flag:'wx',mode:0o600});await fs.rename(temporary,path.join(this.directory,source.id+'.json'));}
  finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
 }
 async refresh(){
  if(!this.enabled||this.disposed)return;if(this.inFlight)return this.inFlight;
  const due=SOURCES.filter(source=>!this.records.has(source.id)||this.now()-Date.parse(this.records.get(source.id).updatedAt)>=MAX_AGE);
  if(!due.length){this.loading=false;this.emit();return;}
  const generation=this.generation;this.loading=true;this.emit();
  this.inFlight=(async()=>{
   const result=await Promise.allSettled(due.map(async source=>{
    const controller=new AbortController();this.controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),this.requestTimeout);timeout.unref?.();
    try{
     const text=validateText(await this.fetchList(source,{signal:controller.signal}));
     const candidate=await compileAsync([text]);if(candidate.blockCount<10)throw Error('Filter list contains no supported network rules');
     if(!this.enabled||this.disposed||generation!==this.generation||controller.signal.aborted)return;
     const record={schema:1,source:source.id,url:source.url,updatedAt:new Date(this.now()).toISOString(),sha256:sha256(text),text};
     await this.save(source,record);this.records.set(source.id,record);
    }catch{if(!controller.signal.aborted)this.reportFailure('LIST_UNAVAILABLE',source.id);}
    finally{clearTimeout(timeout);this.controllers.delete(controller);}
   }));
   if(result.some(item=>item.status==='rejected'))this.reportFailure('REFRESH_FAILED');
   // Keep the old complete matcher until the next one is ready. No network or
   // disk operations happen inside a request callback.
   this.engine=await compileAsync([SEED_RULES,...[...this.records.values()].map(record=>record.text)]);
  })().finally(()=>{
   this.inFlight=null;this.loading=false;this.emit();
   if(this.enabled&&!this.disposed&&this.generation!==generation)void this.refresh().catch(()=>this.reportFailure('REFRESH_FAILED'));
  });return this.inFlight;
 }
 attach(ses){
  if(!ses?.webRequest?.onBeforeRequest)throw Error('Electron Session.webRequest is required');
  if(this.sessions.has(ses))return this.sessions.get(ses).detach;
  // Mouse owns one listener for this event on its shell, persistent browsing
  // and ephemeral private sessions. Toggling changes only enabled state.
  const listener=(details,callback)=>{
   let cancel=false;
   if(this.enabled&&!this.disposed){try{
    let frameUrl='',topUrl='';try{frameUrl=details.frame?.url||'';}catch{}try{topUrl=details.webContents?.getURL?.()||'';}catch{}
    cancel=this.engine.shouldBlock({...details,frameUrl,topUrl});
   }catch{this.reportFailure('REQUEST_ALLOWED');}}
   callback({cancel});
  };
  const detach=()=>{if(!this.sessions.has(ses))return;this.sessions.delete(ses);try{ses.webRequest.onBeforeRequest(null);}catch{}};
  ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},listener);
  this.sessions.set(ses,{listener,detach});return detach;
 }
 dispose(){
  if(this.disposed)return;this.setEnabled(false);this.disposed=true;
  for(const {detach}of [...this.sessions.values()])detach();
 }
}
module.exports={MouseAdBlock,SOURCES,MAX_BYTES,MAX_AGE,sha256,validateText,validRecord,downloadList};
