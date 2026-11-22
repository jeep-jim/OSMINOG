'use strict';
// Local progress metadata only. The caller supplies an authenticated owner and
// trusted source/desk identity; webpage payloads must never choose those fields.
const {randomUUID}=require('node:crypto');
const MAX_ACTIVE=64,MAX_PER_OWNER=4,MAX_HISTORY=24,HISTORY_TTL=60000,STALE_TTL=30*60*1000;
const COMPLETED_VISIBLE=0,STOPPED_VISIBLE=5000,EMIT_INTERVAL=100,MAX_ETA_SECONDS=7*24*60*60;
const SOURCES=new Set(['page','shell']),KINDS=new Set(['reported','observed']),FINAL=new Set(['completed','stopped','cancelled','error']);
class ProgressLimitError extends Error{constructor(){super('Progress task limit reached');this.name='ProgressLimitError';this.code='MOUSE_PROGRESS_LIMIT';}}
function cleanText(value,limit=240){
 if(value===undefined||value===null)return'';if(typeof value!=='string')throw Error('Progress text must be a string');
 return Array.from(value.slice(0,4096).replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()).slice(0,limit).join('');
}
function identifier(value,name,max=160){if(typeof value!=='string'||!value||value.length>max||/[\x00-\x20\x7f]/.test(value))throw Error('Invalid progress '+name);return value;}
function percent(value){if(value===undefined||value===null)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw Error('Progress percent must be null or a number from 0 to 100');return Math.floor(value*10)/10;}
function etaSeconds(value){if(value===undefined||value===null)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>MAX_ETA_SECONDS)throw Error('Progress ETA must be null or seconds from 0 to '+MAX_ETA_SECONDS);return value;}
function phase(value='running'){if(!['running',...FINAL].includes(value))throw Error('Invalid progress phase');return value;}
class ProgressStore{
 constructor({emit=()=>{},now=Date.now}={}){this.emit=emit;this.now=now;this.entries=new Map();this.latest=new Map();this.revision=0;this.lastEmit=-Infinity;this.lastUrgent=-Infinity;this.emitTimer=null;this.expiryTimer=null;this.disposed=false;}
 key(owner,taskId){return identifier(owner,'owner')+'\0'+identifier(taskId,'taskId',64);}
 public(entry){const {owner,key,expiresAt,dismissed,...value}=entry;return{...value};}
 prune(){
  const now=this.now();let changed=false;
  for(const [id,e]of this.entries){
   if(e.phase==='running'&&now-e.updatedAt>=STALE_TTL){e.phase='stale';e.statusText='Нет обновлений';e.etaSeconds=null;e.updatedAt=now;e.dismissAt=now+STOPPED_VISIBLE;e.expiresAt=now+HISTORY_TTL;changed=true;}
   if(e.phase!=='running'&&now>=e.expiresAt){this.entries.delete(id);if(this.latest.get(e.key)===id)this.latest.delete(e.key);changed=true;}
  }
  const history=[...this.entries.values()].filter(e=>e.phase!=='running').sort((a,b)=>a.updatedAt-b.updatedAt);
  while(history.length>MAX_HISTORY){const e=history.shift();this.entries.delete(e.id);if(this.latest.get(e.key)===e.id)this.latest.delete(e.key);changed=true;}
  return changed;
 }
 snapshot({desk}={}){this.prune();const now=this.now();return{revision:this.revision,tasks:[...this.entries.values()].filter(e=>(desk===undefined||e.desk===desk)&&!e.dismissed&&(e.phase==='running'||e.dismissAt>now)).sort((a,b)=>a.createdAt-b.createdAt).map(e=>this.public(e))};}
 schedule(){
  clearTimeout(this.expiryTimer);this.expiryTimer=null;if(this.disposed)return;const now=this.now(),deadlines=[];
  for(const e of this.entries.values())if(e.phase==='running')deadlines.push(e.updatedAt+STALE_TTL);else{if(!e.dismissed&&e.dismissAt>now)deadlines.push(e.dismissAt);deadlines.push(e.expiresAt);}
  if(deadlines.length){this.expiryTimer=setTimeout(()=>{this.prune();this.changed(true);},Math.max(1,Math.min(...deadlines)-now));this.expiryTimer.unref?.();}
 }
 changed(immediate=false){
  if(this.disposed)return;this.revision++;this.schedule();const wait=Math.max(0,EMIT_INTERVAL-(this.now()-this.lastEmit));
  // One prompt final-state event is allowed per interval. Repeated reported
  // completions cannot bypass throttling; trusted privacy removal stays instant.
  const urgent=immediate==='force'||immediate&&this.now()-this.lastUrgent>=EMIT_INTERVAL;
  if(urgent||!wait){clearTimeout(this.emitTimer);this.emitTimer=null;this.lastEmit=this.now();if(urgent)this.lastUrgent=this.lastEmit;this.emit(this.snapshot());}
  else if(!this.emitTimer){this.emitTimer=setTimeout(()=>{this.emitTimer=null;if(this.disposed)return;this.lastEmit=this.now();this.emit(this.snapshot());},wait);this.emitTimer.unref?.();}
 }
 update(owner,input={}){
  if(this.disposed)throw Error('Progress store is closed');if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid progress update');
  const taskId=input.taskId??'default',key=this.key(owner,taskId),value=percent(input.percent),desk=identifier(input.desk,'desk',64),source=input.source;
  if(!SOURCES.has(source))throw Error('Invalid progress source');
  const kind=input.kind??'reported';if(!KINDS.has(kind))throw Error('Invalid progress kind');
  const statusText=cleanText(input.statusText),label=cleanText(input.label||source,64),tabId=input.tabId===undefined?'':identifier(input.tabId,'tabId',100),estimated=input.estimated!==false,eta=etaSeconds(input.etaSeconds),now=this.now();this.prune();
  let entry=this.entries.get(this.latest.get(key));const phase=value===100?'completed':'running';
  if(entry&&(entry.desk!==desk||entry.source!==source||entry.label!==label||(entry.tabId||'')!==tabId||entry.kind!==kind))throw Error('Progress owner context changed');
  if(entry&&entry.phase==='completed'&&phase==='completed'&&entry.statusText===statusText)return this.public(entry);
  if(!entry||entry.phase!=='running'){
   const active=[...this.entries.values()].filter(e=>e.phase==='running');if(phase==='running'&&(active.length>=MAX_ACTIVE||active.filter(e=>e.owner===owner).length>=MAX_PER_OWNER))throw new ProgressLimitError();
   if(entry)entry.dismissed=true;
   entry={id:randomUUID(),taskId,owner,key,desk,source,label,kind,...(tabId?{tabId}:{}),percent:value,statusText,phase,estimated,etaSeconds:eta,createdAt:now,updatedAt:now,dismissAt:0,expiresAt:0,dismissed:false};this.entries.set(entry.id,entry);this.latest.set(key,entry.id);
  }else{
   if(entry.percent===value&&entry.statusText===statusText&&entry.estimated===estimated&&entry.etaSeconds===eta){entry.updatedAt=now;if(eta!==null)this.changed();else this.schedule();return this.public(entry);}
   Object.assign(entry,{percent:value,statusText,phase,estimated,etaSeconds:eta,updatedAt:now});
  }
  // Completion is retained only as bounded metadata. There is no success toast:
  //100 means that the producer no longer needs its pane's task indicator.
  if(phase==='completed'){entry.etaSeconds=null;entry.dismissAt=now;entry.expiresAt=now+HISTORY_TTL;}
  this.prune();this.changed(phase==='completed');return this.public(entry);
 }
 finish(owner,taskId='default',{phase='completed',statusText,estimated}={}){
  if(this.disposed)return null;if(!FINAL.has(phase))throw Error('Invalid progress outcome');const text=statusText===undefined?undefined:cleanText(statusText);this.prune();const e=this.entries.get(this.latest.get(this.key(owner,taskId)));if(!e||e.phase!=='running')return e?this.public(e):null;
  e.phase=phase;if(phase==='completed')e.percent=100;if(text!==undefined)e.statusText=text;if(estimated!==undefined)e.estimated=estimated===true;e.etaSeconds=null;e.updatedAt=this.now();e.dismissAt=e.updatedAt+(phase==='completed'?COMPLETED_VISIBLE:STOPPED_VISIBLE);e.expiresAt=e.updatedAt+HISTORY_TTL;this.prune();this.changed(true);return this.public(e);
 }
 report(owner,input={}){
  const outcome=phase(input.phase);percent(input.percent);etaSeconds(input.etaSeconds);
  if(outcome==='running')return this.update(owner,input);
  if(outcome==='completed')return this.update(owner,{...input,percent:100});
  const existing=this.finish(owner,input.taskId??'default',{phase:outcome,statusText:input.statusText,estimated:input.estimated});if(existing)return existing;
  // An error without an earlier running report has no measured percentage.
  this.update(owner,{...input,percent:null,etaSeconds:null});return this.finish(owner,input.taskId??'default',{phase:outcome,statusText:input.statusText,estimated:input.estimated});
 }
 stopOwner(owner,statusText='Остановлено'){identifier(owner,'owner');for(const e of [...this.entries.values()])if(e.owner===owner&&e.phase==='running')this.finish(owner,e.taskId,{phase:'stopped',statusText});}
 removeOwner(owner){identifier(owner,'owner');let changed=false;for(const [id,e]of this.entries)if(e.owner===owner){this.entries.delete(id);if(this.latest.get(e.key)===id)this.latest.delete(e.key);changed=true;}if(changed)this.changed('force');}
 removeTask(owner,taskId){const key=this.key(owner,taskId);let changed=false;for(const[id,e]of this.entries)if(e.key===key){this.entries.delete(id);changed=true;}this.latest.delete(key);if(changed)this.changed(true);}
 moveOwner(owner,desk){identifier(owner,'owner');identifier(desk,'desk',64);let changed=false;for(const entry of this.entries.values())if(entry.owner===owner&&entry.desk!==desk){entry.desk=desk;changed=true;}if(changed)this.changed(true);}
 dismiss(id){const e=this.entries.get(id);if(e&&!e.dismissed){e.dismissed=true;this.changed(true);}return this.snapshot();}
 clear(){if(this.disposed)return;this.entries.clear();this.latest.clear();this.changed('force');}
 sweep(){if(this.disposed)return;this.prune();this.changed(true);}
 dispose(){if(this.disposed)return;this.disposed=true;clearTimeout(this.emitTimer);clearTimeout(this.expiryTimer);this.entries.clear();this.latest.clear();}
}
module.exports={ProgressStore,ProgressLimitError,cleanText,percent,etaSeconds,phase,MAX_ACTIVE,MAX_PER_OWNER,MAX_HISTORY,HISTORY_TTL,STALE_TTL,COMPLETED_VISIBLE,STOPPED_VISIBLE,EMIT_INTERVAL,MAX_ETA_SECONDS};
