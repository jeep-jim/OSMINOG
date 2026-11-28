'use strict';

const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {compile,compileAsync,SEED_RULES}=require('./mouse-adblock-rules.cjs');
const {TopPageContext}=require('./mouse-adblock-context.cjs');
const {SOURCES,MAX_BYTES,MAX_CUSTOM_SOURCES,sha256,customSource,validateText,validRecord,downloadList}=require('./mouse-adblock-subscriptions.cjs');
const MAX_CACHE_BYTES=MAX_BYTES*2,MAX_AGE=12*60*60*1000,RETRY_BASE=5*60*1000,MAX_RETRY=6*60*60*1000,CONFIG_FILE='subscriptions.json';
const defaults=()=>SOURCES.map(source=>({...source,enabled:true}));
const codeError=(message,code)=>Object.assign(Error(message),{code:'MOUSE_ADBLOCK_'+code});
function savedSources(value){
 if(!value||value.schema!==1||!value.enabled||typeof value.enabled!=='object'||Array.isArray(value.enabled)||Object.keys(value.enabled).length!==SOURCES.length||!Array.isArray(value.custom)||value.custom.length>MAX_CUSTOM_SOURCES)throw Error('Invalid subscription settings');
 const sources=defaults().map(source=>{
  if(typeof value.enabled[source.id]!=='boolean')throw Error('Invalid built-in subscription setting');
  return{...source,enabled:value.enabled[source.id]};
 });
 for(const item of value.custom){
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['id','url','name','enabled'].includes(key))||typeof item.enabled!=='boolean')throw Error('Invalid custom subscription setting');
  const source=customSource({url:item.url,name:item.name});
  if(source.id!==item.id||source.url!==item.url||sources.some(old=>old.id===source.id||old.url===source.url))throw Error('Duplicate or invalid subscription');
  sources.push({...source,enabled:item.enabled});
 }
 return sources;
}
function sourceSettings(sources){return{schema:1,enabled:Object.fromEntries(sources.filter(source=>source.builtin).map(source=>[source.id,source.enabled])),custom:sources.filter(source=>!source.builtin).map(({id,url,name,enabled})=>({id,url,name,enabled}))};}
async function readFile(file,max){
 const stat=await fs.lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)throw Error('Invalid filter data file');
 return fs.readFile(file,'utf8');
}
function usable(engine,source){return source.builtin===false?engine.count>0:engine.blockCount>=10;}
class MouseAdBlock{
 constructor({directory,notify=()=>{},report=()=>{},fetchList=downloadList,now=Date.now,requestTimeout=20000,exceptions=null,getWebContents,isPrivate=()=>false,bundledDirectory=path.join(__dirname,'mouse-filter-lists')}={}){
  if(!path.isAbsolute(directory||''))throw Error('An absolute local filter-cache directory is required');
  if(bundledDirectory&&(typeof bundledDirectory!=='string'||!path.isAbsolute(bundledDirectory)))throw Error('An absolute bundled-list directory is required');
  this.directory=directory;this.bundledDirectory=bundledDirectory;this.notify=notify;this.report=report;this.fetchList=fetchList;this.now=now;this.requestTimeout=requestTimeout;this.isPrivate=isPrivate;
  // Preparation applies the persisted selection before publishing any rules.
  // In particular, enabling a never-prepared profile must not briefly expose
  // basic fallback rules when the user has disabled every subscription.
  this.enabled=false;this.disposed=false;this.sources=defaults();this.records=new Map();this.bundled=new Map();this.counts=new Map();this.loaded=new Set();this.failures=new Map();this.sessions=new Map();this.engine=compile([]);this.engineDirty=false;
  this.loading=false;this.prepared=false;this.preparing=null;this.configReady=false;this.configLoading=null;this.queue=Promise.resolve();this.inFlight=null;this.controllers=new Set();this.refreshing=new Set();this.generation=0;this.revision=0;this.timer=null;this.manifest=null;this.manifestLoading=null;
  this.exceptions=exceptions;this.context=new TopPageContext({getWebContents});
 }
 currentRecord(source){return this.records.get(source.id)||this.bundled.get(source.id)||null;}
 state(){
  const now=this.now(),active=this.sources.filter(source=>source.enabled),available=active.filter(source=>this.currentRecord(source));
  const subscriptions=this.sources.map(source=>{
   const record=this.currentRecord(source),cached=this.records.has(source.id),failure=this.failures.get(source.id),checkedAt=cached?(record.checkedAt||record.updatedAt):null;
   const phase=!source.enabled?'disabled':!this.enabled?'off':this.refreshing.has(source.id)?'loading':failure?(record?'stale':'error'):cached?(now-Date.parse(checkedAt)>=MAX_AGE?'stale':'ready'):record?'bundled':'empty';
   return{id:source.id,name:source.name,url:source.url,builtin:source.builtin,enabled:source.enabled,phase,origin:cached?'cache':record?'bundled':'none',ruleCount:this.counts.get(source.id)||0,updatedAt:record?.updatedAt||null,checkedAt,sha256:record?.sha256||null,lastError:failure?.lastError||null,nextRetryAt:failure?new Date(failure.nextRetryAt).toISOString():null,authors:source.authors||null,homepage:source.homepage||null,license:source.license||null};
  });
  const dates=available.map(source=>this.currentRecord(source).updatedAt).sort();
  return{enabled:this.enabled,phase:!this.enabled?'off':this.loading?'loading':!active.length||active.some(source=>this.records.has(source.id))?'ready':'fallback',lists:available.length,rules:this.engine.count,updatedAt:dates[0]||null,subscriptions,updateIntervalHours:12,maxSubscriptions:MAX_CUSTOM_SOURCES,privateMode:!!this.isPrivate(),revision:this.revision};
 }
 emit(){this.revision++;try{this.notify(this.state());}catch{}}
 reportFailure(stage,source){try{this.report('MOUSE_ADBLOCK_'+stage+(source?' '+source:''));}catch{}}
 async loadConfig(){
  if(this.configReady)return;if(this.configLoading)return this.configLoading;
  this.configLoading=(async()=>{
   try{this.sources=savedSources(JSON.parse(await readFile(path.join(this.directory,CONFIG_FILE),32768)));}
   catch(error){if(error.code!=='ENOENT')this.reportFailure('SUBSCRIPTIONS_IGNORED');}
   this.configReady=true;
  })().finally(()=>{this.configLoading=null;});return this.configLoading;
 }
 async loadManifest(){
  if(this.manifest)return this.manifest;if(!this.bundledDirectory)return null;if(this.manifestLoading)return this.manifestLoading;
  this.manifestLoading=(async()=>{
   const value=JSON.parse(await readFile(path.join(this.bundledDirectory,'manifest.json'),16384));
   if(value.schema!==1||!Array.isArray(value.lists)||value.lists.length!==SOURCES.length)throw Error('Invalid bundled-list manifest');
   for(const source of SOURCES){
    const items=value.lists.filter(item=>item.id===source.id),item=items[0];
    if(items.length!==1||item.url!==source.url||item.file!==source.id+'.txt'||!Number.isInteger(item.bytes)||item.bytes<1||item.bytes>MAX_BYTES||!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isFinite(Date.parse(item.updatedAt))||Date.parse(item.updatedAt)>this.now()+300000)throw Error('Invalid bundled-list entry');
   }
   this.manifest=value;return value;
  })().finally(()=>{this.manifestLoading=null;});return this.manifestLoading;
 }
 async loadSource(source){
  if(this.loaded.has(source.id))return;
  try{
   const record=validRecord(JSON.parse(await readFile(path.join(this.directory,source.id+'.json'),MAX_CACHE_BYTES)),source,this.now());
   const engine=await compileAsync([record.text]);if(!usable(engine,source))throw Error('Empty filter cache');
   this.records.set(source.id,record);this.counts.set(source.id,engine.count);
  }catch(error){if(error.code!=='ENOENT')this.reportFailure('CACHE_IGNORED',source.id);}
  if(!this.records.has(source.id)&&source.builtin&&this.bundledDirectory){
   try{
    const manifest=await this.loadManifest(),item=manifest.lists.find(value=>value.id===source.id),text=await readFile(path.join(this.bundledDirectory,item.file),MAX_BYTES);
    if(Buffer.byteLength(text)!==item.bytes||sha256(text)!==item.sha256)throw Error('Bundled filter checksum mismatch');
    validateText(text);const engine=await compileAsync([text]);if(!usable(engine,source))throw Error('Empty bundled filter');
    this.bundled.set(source.id,{schema:1,source:source.id,url:source.url,updatedAt:item.updatedAt,sha256:item.sha256,text});this.counts.set(source.id,engine.count);
   }catch{this.reportFailure('BUNDLED_IGNORED',source.id);}
  }
  this.loaded.add(source.id);
 }
 texts(sources=this.sources){
  const active=sources.filter(source=>source.enabled),texts=active.map(source=>this.currentRecord(source)?.text).filter(Boolean);
  // The basic domain fallback is visible only when enabled subscriptions have
  // no usable data. Turning every subscription off leaves an empty matcher.
  return texts.length?texts:active.length?[SEED_RULES]:[];
 }
 async prepare(){
  if(this.prepared)return;if(this.preparing)return this.preparing;
  this.preparing=(async()=>{
   await this.loadConfig();for(const source of this.sources)if(source.enabled)await this.loadSource(source);
   this.engine=await compileAsync(this.texts());this.engineDirty=false;this.prepared=true;
  })().finally(()=>{this.preparing=null;this.emit();});return this.preparing;
 }
 async initialize(enabled=false){
  await this.exceptions?.initialize();await this.loadConfig();
  // Disabled profiles read only subscription preferences, never filter bodies
  // and never subscription endpoints.
  if(enabled===true){await this.prepare();this.setEnabled(true);}return this;
 }
 track(wc){if(this.disposed||!wc||wc.session&&!this.sessions.has(wc.session))return null;return this.context.track(wc);}
 stopTimer(){clearTimeout(this.timer);this.timer=null;}
 schedule(){
  this.stopTimer();if(!this.enabled||this.disposed||this.inFlight)return;
  const active=this.sources.filter(source=>source.enabled);if(!active.length)return;
  const next=Math.min(...active.map(source=>{
   const failure=this.failures.get(source.id);if(failure)return failure.nextRetryAt;
   const record=this.records.get(source.id);return record?Date.parse(record.checkedAt||record.updatedAt)+MAX_AGE:this.now();
  }));
  this.timer=setTimeout(()=>{this.timer=null;void this.refresh().catch(()=>{this.reportFailure('REFRESH_FAILED');this.schedule();});},Math.max(1000,Math.min(MAX_AGE,next-this.now())));this.timer.unref?.();
 }
 invalidate(){this.generation++;this.stopTimer();for(const controller of this.controllers)controller.abort();}
 setEnabled(value){
  if(this.disposed)return;const enabled=value===true;if(enabled===this.enabled)return;
  // Register before enabling; an incomplete registration rolls back to off.
  if(enabled){const started=[];try{for(const entry of this.sessions.values()){entry.start();started.push(entry);}}catch(error){for(const entry of started)entry.stop();throw error;}}
  this.enabled=enabled;this.invalidate();
  if(!enabled){for(const entry of this.sessions.values())entry.stop();this.loading=false;this.emit();return;}
  this.loading=!this.prepared;this.emit();
  void this.prepare().then(()=>this.refresh()).catch(()=>{this.loading=false;this.emit();this.reportFailure('PREPARE_FAILED');this.schedule();});
 }
 async writeAtomic(name,value,guard=()=>true){
  await fs.mkdir(this.directory,{recursive:true,mode:0o700});const stat=await fs.lstat(this.directory);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Invalid filter-cache directory');
  const temporary=path.join(this.directory,'.'+name+'-'+randomUUID()+'.tmp');
  try{
   await fs.writeFile(temporary,JSON.stringify(value),{encoding:'utf8',flag:'wx',mode:0o600});
   if(guard()!==true)return false;
   await fs.rename(temporary,path.join(this.directory,name));return true;
  }finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
 }
 save(source,record,guard){return this.writeAtomic(source.id+'.json',record,guard);}
 assertWritable(guard){
  if(this.disposed)throw codeError('Браузер закрывается.','DISPOSED');
  if(this.isPrivate())throw codeError('Списки фильтров меняются только в обычном режиме.','SUBSCRIPTION_PRIVATE');
  if(guard&&guard()!==true)throw codeError('Дождитесь завершения переключения режима.','SUBSCRIPTION_CHANGED');
 }
 changeSources(change,{guard}={}){
  this.assertWritable(guard);
  const work=this.queue.catch(()=>{}).then(async()=>{
   await this.loadConfig();await this.preparing;this.assertWritable(guard);
   const next=change(this.sources.map(source=>({...source})));
   if(JSON.stringify(sourceSettings(next))===JSON.stringify(sourceSettings(this.sources)))return this.state();
   // Stop stale downloads before compiling a policy change. This also prevents
   // an old compile from reinstalling rules for a disabled or removed list.
   this.invalidate();await this.inFlight;this.assertWritable(guard);
   let engine=this.engine;
   if(this.prepared){for(const source of next)if(source.enabled)await this.loadSource(source);engine=await compileAsync(this.texts(next));}
   this.assertWritable(guard);
   await this.writeAtomic(CONFIG_FILE,sourceSettings(next),()=>{this.assertWritable(guard);return true;});
   const removed=this.sources.filter(source=>!next.some(item=>item.id===source.id));
   this.sources=next;this.engine=engine;this.engineDirty=false;
   for(const source of removed){
    this.records.delete(source.id);this.bundled.delete(source.id);this.counts.delete(source.id);this.loaded.delete(source.id);this.failures.delete(source.id);
    await fs.rm(path.join(this.directory,source.id+'.json'),{force:true}).catch(()=>this.reportFailure('CACHE_REMOVE_FAILED',source.id));
   }
   this.emit();return this.state();
  });
  this.queue=work.then(()=>{},()=>{});
  void this.queue.then(()=>{if(this.enabled)void this.refresh().catch(()=>this.reportFailure('REFRESH_FAILED'));else this.emit();});
  return work;
 }
 addSubscription(input,options){
  const added=customSource(input);
  return this.changeSources(sources=>{
   if(sources.some(source=>source.url===added.url))throw codeError('Этот список уже добавлен.','SUBSCRIPTION_DUPLICATE');
   if(sources.filter(source=>!source.builtin).length>=MAX_CUSTOM_SOURCES)throw codeError('Можно добавить не более '+MAX_CUSTOM_SOURCES+' своих списков.','SUBSCRIPTION_LIMIT');
   return[...sources,added];
  },options);
 }
 setSubscriptionEnabled(id,enabled,options){
  if(typeof enabled!=='boolean')throw codeError('Не удалось изменить список.','SUBSCRIPTION_INVALID');
  return this.changeSources(sources=>{const source=sources.find(item=>item.id===id);if(!source)throw codeError('Список не найден.','SUBSCRIPTION_MISSING');source.enabled=enabled;return sources;},options);
 }
 removeSubscription(id,options){
  return this.changeSources(sources=>{const source=sources.find(item=>item.id===id);if(!source)throw codeError('Список не найден.','SUBSCRIPTION_MISSING');if(source.builtin)throw codeError('Встроенный список можно отключить.','SUBSCRIPTION_BUILTIN');return sources.filter(item=>item.id!==id);},options);
 }
 async manualRefresh(id,options={}){
  this.assertWritable(options.guard);await this.queue;this.assertWritable(options.guard);
  if(!this.enabled)throw codeError('Сначала включите блокировку рекламы.','DISABLED');
  if(id!==undefined&&!this.sources.some(source=>source.id===id&&source.enabled))throw codeError('Включённый список не найден.','SUBSCRIPTION_MISSING');
  await this.refresh({force:true,id,guard:()=>{try{this.assertWritable(options.guard);return true;}catch{return false;}}});return this.state();
 }
 async refresh({force=false,id,guard}={}){
  if(!this.enabled||this.disposed)return;await this.queue;await this.prepare();
  if(!this.enabled||this.disposed||guard&&guard()!==true)return;
  if(this.inFlight){
   const covered=id?this.refreshing.has(id):this.sources.filter(source=>source.enabled).every(source=>this.refreshing.has(source.id));
   if(this.flightGeneration===this.generation&&(!force||covered))return this.inFlight;
   await this.inFlight;return this.refresh({force,id,guard});
  }
  const due=this.sources.filter(source=>{
   if(!source.enabled||id!==undefined&&source.id!==id)return false;if(force)return true;
   const failure=this.failures.get(source.id);if(failure)return this.now()>=failure.nextRetryAt;
   const record=this.records.get(source.id);return!record||this.now()-Date.parse(record.checkedAt||record.updatedAt)>=MAX_AGE;
  });
  const generation=this.generation;
  if(!due.length){
   if(this.engineDirty){const engine=await compileAsync(this.texts());if(generation===this.generation){this.engine=engine;this.engineDirty=false;}}
   this.loading=false;this.emit();this.schedule();return;
  }
  this.stopTimer();this.flightGeneration=generation;this.refreshing=new Set(due.map(source=>source.id));this.loading=true;this.emit();
  this.inFlight=(async()=>{
   await Promise.allSettled(due.map(async source=>{
    const controller=new AbortController();this.controllers.add(controller);let timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},this.requestTimeout);timeout.unref?.();
    const current=()=>this.enabled&&!this.disposed&&generation===this.generation&&(!guard||guard()===true);
    const live=()=>current()&&!controller.signal.aborted;
    try{
     const previous=this.records.get(source.id),result=await this.fetchList(source,{signal:controller.signal,record:previous,withMetadata:true,now:this.now()});
     const response=typeof result==='string'?{status:200,text:result}:result;
     if(!live())return;
     let record,count;
     if(response?.status===304){
      if(!previous||!previous.etag&&!previous.lastModified)throw Error('Not Modified requires a verified conditional cache');
      validRecord(previous,source,this.now());
      record={...previous,checkedAt:new Date(Math.max(this.now(),Date.parse(previous.updatedAt))).toISOString(),etag:response.etag??previous.etag??null,lastModified:response.lastModified??previous.lastModified??null};count=this.counts.get(source.id)||0;
     }else if(response?.status===200){
      const text=validateText(response.text,{custom:source.builtin===false}),candidate=await compileAsync([text]);
      if(!usable(candidate,source))throw Error('Filter list contains no supported network rules');
      const date=new Date(this.now()).toISOString();record={schema:1,source:source.id,url:source.url,updatedAt:date,checkedAt:date,sha256:sha256(text),text,etag:response.etag||null,lastModified:response.lastModified||null};count=candidate.count;
     }else throw Error('Filter server unavailable');
     validRecord(record,source,this.now());
     if(!live()||!await this.save(source,record,live)||!live())return;
     this.records.set(source.id,record);this.counts.set(source.id,count);this.failures.delete(source.id);this.engineDirty=true;
    }catch{
     if(current()&&(!controller.signal.aborted||timedOut)){
      const attempts=(this.failures.get(source.id)?.attempts||0)+1,lastError=timedOut?'MOUSE_ADBLOCK_TIMEOUT':'MOUSE_ADBLOCK_LIST_UNAVAILABLE';
      this.failures.set(source.id,{attempts,lastError,nextRetryAt:this.now()+Math.min(MAX_RETRY,RETRY_BASE*2**Math.min(attempts-1,16))});this.reportFailure(timedOut?'TIMEOUT':'LIST_UNAVAILABLE',source.id);
     }
    }finally{clearTimeout(timeout);this.controllers.delete(controller);}
   }));
   if(this.enabled&&!this.disposed&&generation===this.generation&&this.engineDirty){
    const engine=await compileAsync(this.texts());
    if(this.enabled&&!this.disposed&&generation===this.generation){this.engine=engine;this.engineDirty=false;}
   }
  })().finally(()=>{this.inFlight=null;this.refreshing.clear();this.loading=false;this.emit();this.schedule();});return this.inFlight;
 }
 flush(){return this.queue;}
 attach(ses){
  if(this.disposed)throw Error('AdBlock controller is disposed');
  if(!ses?.webRequest?.onBeforeRequest)throw Error('Electron Session.webRequest is required');
  if(this.sessions.has(ses))return this.sessions.get(ses).detach;
  // Shell, persistent and private Sessions share the same local policy, while
  // each retains exactly one owned callback and its existing exception context.
  let attached=true,active=false;
  const listener=(details,callback)=>{
   let cancel=false;
   if(attached&&this.enabled&&!this.disposed){try{
    let frameUrl='';try{frameUrl=details.frame?.url||'';}catch{}
    const topUrl=this.context.requestURL(details,ses);
    if(!this.exceptions?.hasURL(topUrl))cancel=this.engine.shouldBlock({...details,frameUrl,topUrl});
   }catch{this.reportFailure('REQUEST_ALLOWED');}}
   callback({cancel});
  };
  const start=()=>{if(active)return;ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},listener);active=true;};
  const stop=()=>{if(!active)return;try{ses.webRequest.onBeforeRequest(null);active=false;}catch{this.reportFailure('SESSION_DETACH_FAILED');}};
  const detach=()=>{if(!attached)return;attached=false;this.sessions.delete(ses);stop();this.context.detachSession(ses);};
  if(this.enabled)start();this.sessions.set(ses,{listener,detach,start,stop});return detach;
 }
 dispose(){
  if(this.disposed)return;this.setEnabled(false);this.disposed=true;
  for(const {detach}of [...this.sessions.values()])detach();this.context.dispose();
 }
}
module.exports={MouseAdBlock,SOURCES,MAX_BYTES,MAX_AGE,RETRY_BASE,MAX_RETRY,MAX_CUSTOM_SOURCES,CONFIG_FILE,sha256,validateText,validRecord,downloadList,savedSources};
