'use strict';
// Only normal live desktop tabs. No guest IPC, CDP, capture, download, URL or media bytes.
const {randomUUID}=require('node:crypto');
const WORLD=1294, ID=/^[0-9a-f-]{36}$/i, INTERVAL=1000, DEADLINE=1700;
const CHANNEL='mouse:media-player', STATE_CHANNEL='mouse:media-player-state';

// Runs only in Electron's isolated top document with a fixed operation argument.
async function originalMedia(action,id,seconds,expiresAt){
 const key=Symbol.for('mouse.isolated.originalMedia.v1');
 const valid=e=>e instanceof HTMLMediaElement&&e.ownerDocument===document&&e.isConnected&&!e.srcObject&&!e.error&&e.readyState>=1&&!e.ended;
 const playing=e=>valid(e)&&!e.paused;
 const hasPosition=e=>Number.isFinite(e.duration)&&e.duration>0;
 const read=e=>{
  const duration=hasPosition(e)?e.duration:null;
  const currentTime=Number.isFinite(e.currentTime)&&e.currentTime>=0?e.currentTime:null;
  const clean=value=>{
   if(typeof value!=='string'||value.length>1024)return '';
   const text=value.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,' ').trim();
   return /(?:[a-z][\w+.-]*:\/\/|\bblob:|\bdata:|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]|(?=\s|$)))/i.test(text)?'':text.slice(0,150);
  };
  let trackTitle='',artist='';
  try{
   const metadata=navigator.mediaSession?.metadata;
   trackTitle=clean(metadata?.title);artist=clean(metadata?.artist);
  }catch{} // Other sites/engines need not expose MediaSession metadata.
  return{kind:e instanceof HTMLVideoElement?'video':'audio',paused:e.paused,currentTime,duration,canSeek:duration!==null&&e.seekable.length>0,...(trackTitle?{trackTitle}:{}),...(artist?{artist}:{})};
 };
 if(Date.now()>expiresAt)return{status:'expired'};
 if(action==='discover'){
  // Scope to light DOM in this document; no iframes, shadow traversal or site heuristics.
  const elements=document.querySelectorAll('audio,video');
  if(elements.length>100)return{status:'unsupported'};
  const active=Array.from(elements).filter(playing);
  if(active.length!==1)return{status:active.length?'ambiguous':'missing'};
  const old=globalThis[key], element=active[0];
  if(old?.element===element&&old.id===seconds)return{status:'ok',id:old.id,media:read(element)};
  globalThis[key]={id,element};
  return{status:'ok',id,media:read(element)};
 }
 const current=globalThis[key], element=current?.element;
 if(current?.id!==id||!valid(element))return{status:'missing'};
 try{
  if(action==='pause')element.pause();
  else if(action==='resume')await element.play(); // real site can reject, no fake user gesture
  else if(action==='seek'){
   if(!hasPosition(element)||seconds<0||seconds>element.duration)return{status:'seek_unavailable'};
   const ranges=element.seekable;
   let allowed=false;
   for(let i=0;i<Math.min(ranges.length,100);i++)if(seconds>=ranges.start(i)&&seconds<=ranges.end(i)){allowed=true;break}
   if(!allowed)return{status:'seek_unavailable'};
   element.currentTime=seconds;
  }else if(action!=='read')return{status:'unsupported'};
 }catch{return{status:action==='resume'?'resume_blocked':'unsupported'}}
 return valid(element)?{status:'ok',id,media:read(element)}:{status:'missing'};
}
function runOriginal(wc,action,id,seconds){
 // action is a main-owned literal, id is an internal UUID, seconds is validated.
 const code='('+originalMedia.toString()+')('+JSON.stringify(action)+','+JSON.stringify(id)+','+JSON.stringify(seconds??null)+','+(Date.now()+DEADLINE)+')';
 return wc.executeJavaScriptInIsolatedWorld(WORLD,[{code}],false);
}
function safeMedia(data){
 if(!data||!['audio','video'].includes(data.kind)||typeof data.paused!=='boolean'||typeof data.canSeek!=='boolean')return null;
 const seconds=n=>n===null?null:(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e10?(n<0.1?n:Math.round(n*10)/10):undefined);
 let currentTime=seconds(data.currentTime),duration=seconds(data.duration);
 if(currentTime===undefined||duration===undefined||(duration!==null&&duration<=0))return null;
 if(duration!==null&&currentTime!==null)currentTime=Math.min(currentTime,duration);
 const trackTitle=cleanText(data.trackTitle),artist=cleanText(data.artist);
 return{kind:data.kind,paused:data.paused,currentTime,duration,canSeek:data.canSeek&&duration!==null,...(trackTitle?{trackTitle}:{}),...(artist?{artist}:{})};
}
function cleanText(value){
 if(typeof value!=='string'||value.length>1024)return '';
 const text=value.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,' ').trim();
 return /(?:[a-z][\w+.-]*:\/\/|\bblob:|\bdata:|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]|(?=\s|$)))/i.test(text)?'':text.slice(0,150);
}
function label(wc,host){
 try{return cleanText(wc.getTitle())||host.slice(0,100)}catch{return host.slice(0,100)}
}
function install({win,browser,ipcMain,trusted,isPrivate=()=>false,powerMonitor,execute=runOriginal}){
 const shell=win.webContents, bindings=new Map(), off=[];
 let active=null, disposed=false, locked=false, probes=0, revision=0, last='', timer;
 const available=()=>!disposed&&!locked&&!isPrivate()&&!browser.disposed;
 const listen=(target,event,handler)=>{target?.on(event,handler);return()=>target?.removeListener(event,handler)};
 function context(b){
  const {page,wc}=b;
  if(!available()||b.navigating||!page?.id||browser.tabs.get(page.id)!==page||page.internal||page.provider||page.previewOf||page.ephemeral||wc.isDestroyed()||page.project!==browser.project)return null;
  const bank=browser.mouseDesktops?.bank;
  if(!bank||!Object.hasOwn(bank.members,page.id))return null;
  const deskId=bank.members[page.id];
  if(typeof deskId!=='string'||!bank.items?.some(d=>d.id===deskId))return null;
  let u;
  try{u=new URL(wc.getURL())}catch{return null}
  return ['http:','https:'].includes(u.protocol)?{deskId,title:label(wc,u.hostname)}:null;
 }
 function snapshot(){
  const ctx=active&&context(active.binding);
  return{available:available(),player:ctx?{id:active.id,tabId:active.binding.page.id,originDeskId:active.originDeskId,...ctx,...active.media}:null,revision};
 }
 function publish(){
  const state=snapshot(), serial=JSON.stringify([state.available,state.player]);
  if(last===serial)return;
  last=serial; revision++;
  try{if(!shell.isDestroyed())shell.send(STATE_CHANNEL,{...state,revision})}catch{}
 }
 function clear(){
  active=null;clearInterval(timer);timer=undefined;
  // Revoke any in-flight discover/read, including across a quick privacy round-trip.
  for(const b of bindings.values())b.epoch++;
  publish();
 }
 function forget(b){
  if(active?.binding!==b)return;
  active=null;clearInterval(timer);timer=undefined;publish();
 }
 function reconcile(){if(active&&!context(active.binding))forget(active.binding);else if(active)publish()}
 async function operation(b,action,id,seconds){
  if(b.pending)return{status:'busy'};
  const epoch=b.epoch;b.pending=true;
  let job;
  try{job=Promise.resolve(execute(b.wc,action,id,seconds))}catch{b.pending=false;return{status:'unsupported'}}
  let timeout;
  const actual=job.then(x=>x,()=>({status:'unsupported'})).finally(()=>{b.pending=false});
  const result=await Promise.race([actual,new Promise(resolve=>{timeout=setTimeout(()=>resolve({status:'timeout'}),DEADLINE);timeout.unref?.()})]);
  clearTimeout(timeout);
  return b.epoch===epoch&&context(b)?result:{status:'expired'};
 }
 function refresh(b){
  const owner=active;
  if(owner?.binding!==b||b.pending||!context(b))return;
  void operation(b,'read',owner.id).then(r=>{
   if(active!==owner)return;
   const m=r?.id===owner.id&&safeMedia(r.media);
   if(r?.status==='ok'&&m){owner.media=m;publish()}
   else if(r?.status==='missing'||r?.status==='expired')forget(b)
  });
 }
 async function discover(b){
  const initial=context(b);
  if(!initial||probes>=4||b.pending||b.dismissed||(active&&active.binding!==b))return;
  // Native play event confirmed; do not poll all browser tabs/screens.
  probes++;
  const id=randomUUID();
  try{
   const r=await operation(b,'discover',id,active?.binding===b?active.id:null);
   const ctx=context(b);
   if(!ctx||b.dismissed||(active&&active.binding!==b))return;
   if(r?.status==='ambiguous'||r?.status==='unsupported'){forget(b);return}
   const goodId=r?.id===id||(active?.binding===b&&r?.id===active.id);
   const media=goodId&&safeMedia(r.media);
   if(r?.status!=='ok'||!media||media.paused)return;
   const origin=active?.id===r.id?active.originDeskId:initial.deskId;
   active={binding:b,id:r.id,originDeskId:origin,media};
   if(!timer){timer=setInterval(()=>{if(active)refresh(active.binding)},INTERVAL);timer.unref?.()}
   publish();
  }finally{probes--}
 }
 function bind(page){
  const wc=page?.view?.webContents;
  if(!wc||typeof wc.executeJavaScriptInIsolatedWorld!=='function'||bindings.has(wc))return;
  const b={page,wc,epoch:0,navigating:false,pending:false,dismissed:false,off:[]};
  const on=(e,f)=>b.off.push(listen(wc,e,f));
  bindings.set(wc,b);
  on('media-started-playing',()=>void discover(b));
  on('media-paused',()=>refresh(b));
  const reset=()=>{b.epoch++;b.navigating=true;b.dismissed=false;forget(b)};
  // New and legacy Electron argument forms; a same-document history/hash change is not a reload.
  on('did-start-navigation',(_event,detail,inPlace,isMainFrame)=>{
   const d=typeof detail==='object'&&detail?detail:{isMainFrame,isSameDocument:inPlace};
   if(d.isMainFrame===true&&d.isSameDocument!==true&&d.isInPlace!==true)reset()
  });
  on('did-navigate',()=>{b.navigating=false});
  on('did-finish-load',()=>{b.navigating=false});
  on('render-process-gone',reset);
  on('destroyed',()=>{reset();bindings.delete(wc);for(const remove of b.off)remove()});
 }
 for(const page of browser.tabs.values())bind(page);
 const oldMake=browser.make, oldEmit=browser.emit;
 const make=function(...args){const page=oldMake.apply(this,args);bind(page);return page};
 const emit=function(...args){const result=oldEmit.apply(this,args);reconcile();return result};
 browser.make=make;browser.emit=emit;
 ipcMain.handle(CHANNEL,async(event,action,args={})=>{
  trusted(event);
  if(action==='state'){reconcile();return snapshot()}
  if(!['pause','resume','seek','return','dismiss'].includes(action))throw Error('Неизвестное действие плеера');
  if(!args||typeof args!=='object'||Array.isArray(args)||!ID.test(typeof args.id==='string'?args.id:''))throw Error('Недействительный плеер');
  if(action==='seek'&&(typeof args.seconds!=='number'||!Number.isFinite(args.seconds)||args.seconds<0||args.seconds>1e10))throw Error('Некорректная позиция');
  const owner=active, b=owner?.binding, ctx=b&&context(b);
  if(!ctx||args.id!==owner.id)throw Error('Исходная вкладка недоступна');
  if(action==='return')return{desk:ctx.deskId,id:b.page.id};
  if(action==='dismiss'){b.dismissed=true;b.epoch++;forget(b);return snapshot()}
  if(action==='seek'&&!owner.media.canSeek)throw Error('Перемотка недоступна');
  const r=await operation(b,action,owner.id,args.seconds);
  if(active!==owner||!context(b)||r?.status==='expired')throw Error('Исходная вкладка изменилась');
  if(r?.status==='missing'){forget(b);throw Error('Источник воспроизведения недоступен')}
  if(r?.status==='resume_blocked')throw Error('Сайт не разрешил возобновить воспроизведение. Откройте исходную вкладку.');
  if(r?.status==='seek_unavailable')throw Error('Эта позиция недоступна в исходном плеере');
  if(r?.status==='busy'||r?.status==='timeout')throw Error('Источник ещё не ответил');
  const media=r?.id===owner.id&&safeMedia(r.media);
  if(r?.status!=='ok'||!media)throw Error('Исходная вкладка не поддерживает это действие');
  owner.media=media;publish();return snapshot();
 });
 off.push(listen(powerMonitor,'lock-screen',()=>{locked=true;clear()}));
 off.push(listen(powerMonitor,'unlock-screen',()=>{locked=false;publish()}));
 function dispose(){if(disposed)return;disposed=true;clear();for(const b of bindings.values())for(const remove of b.off)remove();bindings.clear();for(const remove of off)remove();if(browser.make===make)browser.make=oldMake;if(browser.emit===emit)browser.emit=oldEmit}
 off.push(listen(win,'closed',dispose));
 return{clear,resume:publish,dispose};
}
module.exports={install,originalMedia,safeMedia};
