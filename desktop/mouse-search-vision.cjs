'use strict';

// Explicit, read-only observation of one visible search page. An isolated
// world avoids taking ownership of its debugger or opening a CDP listener.
const {randomUUID}=require('node:crypto');
const WORLD_ID=63401,MAX_ELEMENTS=120,MAX_CONTEXT_CHARS=6000,MAX_PACKET_CHARS=7000,POLL_MS=250;
const text=(value,limit=160)=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').slice(0,limit);
function withTimeout(promise,ms=2500){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Чтение выбранного сайта заняло слишком много времени')),ms);})]).finally(()=>clearTimeout(timer));}

// Serialized into the selected page's isolated world. It never accesses .value,
// selection, screenshots, clipboard, storage, cookies, input or keyboard events.
function createVisionPageReader(){
 const clean=(value,limit=160)=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').slice(0,limit);
 const sensitive=element=>!element||!!element.closest?.('[contenteditable]:not([contenteditable="false"]),[role="textbox"][contenteditable],input[type="password"],input[type="hidden"]')||/password|passwd|secret|token|one-time-code|cc-number|cc-csc|cvv|cvc|credit.?card|social.?security/i.test([element.getAttribute?.('type'),element.getAttribute?.('name'),element.getAttribute?.('id'),element.getAttribute?.('autocomplete'),element.getAttribute?.('aria-label')].join(' '));
 function label(element){
  const aria=element.getAttribute('aria-label');if(aria)return clean(aria);
  const node=element.cloneNode(true);node.querySelectorAll?.('input,textarea,select,[contenteditable],script,style,[hidden],[aria-hidden="true"]').forEach(child=>child.remove());return clean(node.textContent?.trim());
 }
 function selector(element){
  const parts=[];let current=element;
  for(let depth=0;current&&current.nodeType===1&&depth<6;depth++,current=current.parentElement){const tag=current.tagName.toLowerCase();if(!/^[a-z][a-z0-9-]*$/.test(tag))return'';const siblings=[...(current.parentElement?.children||[])].filter(node=>node.tagName===current.tagName);parts.unshift(tag+':nth-of-type('+(Math.max(0,siblings.indexOf(current))+1)+')');if(tag==='body')break;}
  return parts.join(' > ').slice(0,300);
 }
 function describe(element){
  if(sensitive(element))return null;const box=element.getBoundingClientRect(),style=getComputedStyle(element);
  if(box.width<=0||box.height<=0||box.right<=0||box.bottom<=0||box.x>=innerWidth||box.y>=innerHeight||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return null;
  const tag=element.tagName.toLowerCase(),type=element.getAttribute('type')||'',field=['input','textarea','select'].includes(tag);
  const role=element.getAttribute('role')||({a:'link',button:'button',summary:'button',select:'combobox',textarea:'textbox',input:['checkbox','radio'].includes(type)?type:'textbox'}[tag]||tag);
  const name=field?clean(element.getAttribute('aria-label')||[...(element.labels||[])].map(label).join(' ')||element.getAttribute('placeholder')||''):label(element);
  const x=Math.max(0,box.x),y=Math.max(0,box.y);return{role:clean(role,40),name,selector:selector(element),bounds:{x,y,width:Math.min(innerWidth,box.right)-x,height:Math.min(innerHeight,box.bottom)-y},disabled:element.disabled===true};
 }
 function context(){
  const url=new URL(location.href),elements=[];for(const element of document.querySelectorAll('a[href],button,summary,input,textarea,select,[role="button"],[role="link"],[role="checkbox"],[role="switch"]')){const value=describe(element);if(value)elements.push(value);if(elements.length>=120)break;}
  return{url:url.origin+url.pathname,title:clean(document.title,500),scope:'selected-main-frame',untrustedContent:true,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},elements,capturedAt:Date.now()};
 }
 return{describe,context};
}
function installVisionObserver(key,reader){
 let dirty=true,lastRead=0;const events=[];
 const click=event=>{
  if(!event.isTrusted||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||event.clientX<0||event.clientY<0||event.clientX>=innerWidth||event.clientY>=innerHeight)return;
  const element=event.target?.nodeType===1?event.target:event.target?.parentElement,description=reader.describe(element);
  events.push({type:'click',trusted:true,x:event.clientX,y:event.clientY,normalizedX:event.clientX/innerWidth,normalizedY:event.clientY/innerHeight,button:event.button,selector:description?.selector||'',receivedAt:Date.now()});if(events.length>16)events.shift();dirty=true;
 };
 const observer=new MutationObserver(()=>{dirty=true;});observer.observe(document,{subtree:true,childList:true,attributes:true,characterData:true});document.addEventListener('click',click,true);
 globalThis[key]={read(force=false){const now=Date.now(),pending=events.splice(0),include=force||dirty&&(now-lastRead>=2000||pending.length>0);let context=null;if(include){context=reader.context();lastRead=now;dirty=false;}return{events:pending,context};},dispose(){observer.disconnect();document.removeEventListener('click',click,true);delete globalThis[key];}};
 return true;
}
function sanitizeContext(value){
 if(!value||value.scope!=='selected-main-frame'||!value.viewport)throw Error('Не получен контекст выбранного сайта');
 const {width,height,scrollX=0,scrollY=0}=value.viewport;if(![width,height,scrollX,scrollY].every(Number.isFinite)||width<=0||height<=0||width>16384||height>16384)throw Error('Неверная область выбранного сайта');
 const url=new URL(value.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Неверный адрес выбранного сайта');
 const context={url:url.origin+url.pathname,title:text(value.title,500),scope:'selected-main-frame',untrustedContent:true,viewport:{width,height,scrollX,scrollY},elements:[],elementsTruncated:Array.isArray(value.elements)&&value.elements.length>MAX_ELEMENTS,capturedAt:Date.now()};
 if(JSON.stringify(context).length>MAX_CONTEXT_CHARS)throw Error('Адрес страницы слишком длинный для контекста');
 for(const item of Array.isArray(value.elements)?value.elements.slice(0,MAX_ELEMENTS):[]){const b=item?.bounds;if(!b||!['x','y','width','height'].every(key=>Number.isFinite(b[key]))||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>width+1||b.y+b.height>height+1)continue;context.elements.push({role:text(item.role,40),name:text(item.name),selector:text(item.selector,300),bounds:{x:b.x,y:b.y,width:b.width,height:b.height},disabled:item.disabled===true});if(JSON.stringify(context).length>MAX_CONTEXT_CHARS){context.elements.pop();context.elementsTruncated=true;break;}}
 return context;
}
function sanitizeAction(value,viewport){
 if(!value||value.type!=='click'||value.trusted!==true||![value.x,value.y].every(Number.isFinite)||value.x<0||value.y<0||value.x>=viewport.width||value.y>=viewport.height||![0,1,2].includes(value.button))return null;
 return{type:'click',x:value.x,y:value.y,normalizedX:value.x/viewport.width,normalizedY:value.y/viewport.height,button:value.button,selector:text(value.selector,300),receivedAt:Date.now()};
}
class SearchVision{
 constructor({views,win,powerMonitor,isPrivate=()=>false,onState,onContext,pollMs=POLL_MS}={}){
  if(!views||!win||!Number.isInteger(pollMs)||pollMs<100||pollMs>2000)throw Error('Invalid search vision options');
  Object.assign(this,{views,win,powerMonitor,isPrivate,onState,onContext,pollMs});this.generation=0;this.active=false;this.phase='stopped';this.reason='';this.entry=null;this.context=null;this.lastAction=null;this.receivedAt=null;this.timer=null;this.busy=false;this.disposed=false;this.cleanup=Promise.resolve();
  this.onInvalidated=event=>{if(this.entry&&(event.id===null||event.id===this.entry.id))void this.stop(event.reason);};views.on('invalidate',this.onInvalidated);
  this.onLock=()=>{void this.stop('lock');};powerMonitor?.on('lock-screen',this.onLock);this.onHidden=()=>{void this.stop('hidden');};win.on('minimize',this.onHidden);win.on('hide',this.onHidden);win.once('closed',this.onHidden);
 }
 state(){return{active:this.active&&!this.disposed,phase:this.phase,targetId:this.entry?.id||'',url:this.context?.url||'',title:this.context?.title||'',reason:this.reason,revision:this.entry?.revision||this.views.revision,receivedAt:this.receivedAt,context:this.context?structuredClone(this.context):null,lastAction:this.lastAction?{...this.lastAction}:null};}
 _emit(){const state=this.state();this.onState?.(state);return state;}
 _guard(entry){
  if(this.disposed||!this.active||this.entry!==entry||this.generation!==entry.generation||this.isPrivate()||this.win.isDestroyed()||this.win.isMinimized?.()||this.win.isVisible?.()===false||this.views.revision!==entry.revision||this.views.target(entry.id)!==entry.record||entry.wc.isDestroyed()||entry.record.navigationEpoch!==entry.epoch||entry.wc.getURL()!==entry.url)throw Error('Показ выбранного сайта остановлен');
 }
 async start({id,consent}={}){
  if(consent!==true)throw Error('Нажмите «Показать экран» для выбранного сайта');if(this.disposed||this.isPrivate())throw Error('Показ сайта недоступен');const cleanup=this.stop('replaced'),generation=this.generation;await cleanup;if(this.generation!==generation||this.disposed||this.isPrivate())throw Error('Показ выбранного сайта остановлен');
  const record=this.views.target(id),wc=record.view.webContents;if(record.loading||!/^https?:/.test(wc.getURL()))throw Error('Дождитесь загрузки выбранного сайта');
  const entry={id,record,wc,url:wc.getURL(),epoch:record.navigationEpoch,revision:this.views.revision,generation:++this.generation,key:'__mouseSearchVision_'+randomUUID().replaceAll('-','')};this.entry=entry;this.active=true;this.phase='starting';this.reason='';this.context=null;this.lastAction=null;
  entry.onNavigation=(_event,_url,_inPlace,main)=>{if(main!==false)void this.stop('navigation');};entry.onClosed=()=>{void this.stop('closed');};wc.on('did-start-navigation',entry.onNavigation);wc.on('destroyed',entry.onClosed);wc.on('render-process-gone',entry.onClosed);this._emit();
  const code=`(${installVisionObserver.toString()})(${JSON.stringify(entry.key)},(${createVisionPageReader.toString()})())`;
  try{
   entry.installing=wc.executeJavaScriptInIsolatedWorld(WORLD_ID,[{code}],false);
   await withTimeout(entry.installing);this._guard(entry);await this.snapshot();this._guard(entry);this.phase='observing';
   this.timer=setInterval(()=>{if(this.busy||!this.active)return;this.busy=true;const observed=this.entry;void this._read(false).catch(()=>{if(this.entry===observed)return this.stop('read-failed');}).finally(()=>{this.busy=false;});},this.pollMs);this.timer.unref?.();return this._emit();
  }catch(error){if(this.entry===entry)await this.stop('read-failed');throw error;}
 }
 async _read(force){
  const entry=this.entry;this._guard(entry);const value=await withTimeout(entry.wc.executeJavaScriptInIsolatedWorld(WORLD_ID,[{code:`globalThis[${JSON.stringify(entry.key)}]?.read(${force===true})`}],false));this._guard(entry);
  if(!value||!Array.isArray(value.events))throw Error('Наблюдение выбранного сайта прервано');let changed=false;
  if(value.context){this.context=sanitizeContext(value.context);changed=true;}
  if(!this.context)throw Error('Контекст сайта ещё не получен');
  for(const candidate of value.events.slice(-16)){const action=sanitizeAction(candidate,this.context.viewport);if(action){this.lastAction=action;changed=true;}}
  if(changed){this.receivedAt=Date.now();const packet=this._packet();this.onContext?.(packet);this._emit();}
  return this._packet();
 }
 _packet(){const packet={targetId:this.entry?.id||'',revision:this.entry?.revision,documentIdentity:{webContentsId:this.entry?.wc.id,navigationEpoch:this.entry?.epoch},receivedAt:this.receivedAt,...structuredClone(this.context),lastAction:this.lastAction?{...this.lastAction}:null};while(JSON.stringify(packet).length>MAX_PACKET_CHARS&&packet.elements?.length){packet.elements.pop();packet.elementsTruncated=true;}if(JSON.stringify(packet).length>MAX_PACKET_CHARS)throw Error('Контекст выбранного сайта слишком большой');return packet;}
 snapshot(){return this._read(true);}
 stop(reason='user'){
  const entry=this.entry;this.active=false;this.phase='stopped';this.reason=String(reason).slice(0,120);this.generation++;clearInterval(this.timer);this.timer=null;this.entry=null;this.context=null;this.lastAction=null;this.receivedAt=null;
  if(entry){
   entry.wc.removeListener('did-start-navigation',entry.onNavigation);entry.wc.removeListener('destroyed',entry.onClosed);entry.wc.removeListener('render-process-gone',entry.onClosed);
   // If an installation was in flight, remove that exact observer after it
   // completes. A later explicit session uses a different key and stays intact.
   const clean=Promise.resolve(entry.installing).catch(()=>{}).then(()=>{if(!entry.wc.isDestroyed())return entry.wc.executeJavaScriptInIsolatedWorld(WORLD_ID,[{code:`globalThis[${JSON.stringify(entry.key)}]?.dispose()`}],false);}).catch(()=>{});
   this.cleanup=Promise.allSettled([this.cleanup,withTimeout(clean)]).then(()=>{});
  }
  const state=this._emit();return this.cleanup.then(()=>state);
 }
 async dispose(){
  if(this.disposed)return this.cleanup;const pending=this.stop('disposed');this.disposed=true;this.views.removeListener('invalidate',this.onInvalidated);this.powerMonitor?.removeListener('lock-screen',this.onLock);for(const name of ['minimize','hide','closed'])this.win.removeListener(name,this.onHidden);await pending;
 }
}
module.exports={createSearchVision:options=>new SearchVision(options),SearchVision,createVisionPageReader,installVisionObserver,sanitizeContext,sanitizeAction,WORLD_ID,MAX_ELEMENTS,MAX_CONTEXT_CHARS,MAX_PACKET_CHARS,POLL_MS};
