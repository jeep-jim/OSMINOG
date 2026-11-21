'use strict';

// Live search cards use the same sandboxed WebContentsView primitive as the
// browser workspace, but own an ephemeral session and never join saved desks.
const {EventEmitter}=require('node:events');
const {randomUUID}=require('node:crypto');
const path=require('node:path');
const RADIUS=16,MAX_LIVE=8,MAX_RESULTS=1000,WHEEL_CHANNEL='mouse:search-wheel';
function webURL(value){
 if(typeof value!=='string'||value.length>8192)throw Error('Invalid search page URL');
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Search pages require HTTP or HTTPS without credentials');
 return url.href;
}
function identifier(value){if(typeof value!=='string'||!value||value.length>160||/[\x00-\x1f\x7f]/.test(value))throw Error('Invalid search result ID');return value;}
function rectangle(value,label='rectangle'){
 if(!value||!['x','y','width','height'].every(key=>Number.isFinite(value[key]))||Math.abs(value.x)>32768||Math.abs(value.y)>32768||value.width<0||value.height<0||value.width>16384||value.height>16384)throw Error('Invalid search '+label);
 return{x:value.x,y:value.y,width:value.width,height:value.height};
}
function intersection(...rects){
 const x=Math.max(...rects.map(r=>r.x)),y=Math.max(...rects.map(r=>r.y)),right=Math.min(...rects.map(r=>r.x+r.width)),bottom=Math.min(...rects.map(r=>r.y+r.height));
 // Round inward, so even a fractional slot can never cover filters or footer.
 const left=Math.ceil(x),top=Math.ceil(y),width=Math.floor(right)-left,height=Math.floor(bottom)-top;
 return width>=RADIUS*2&&height>=RADIUS*2?{x:left,y:top,width,height}:null;
}
function ownedMainFrame(event,wc){
 try{const frame=event.senderFrame,main=wc.mainFrame;return event.sender===wc&&!!frame&&!!main&&!frame.detached&&!main.detached&&frame.processId===main.processId&&frame.routingId===main.routingId&&Number.isSafeInteger(frame.processId)&&Number.isSafeInteger(frame.routingId);}catch{return false;}
}
function wheelDelta(value){
 if(!value||!Number.isFinite(value.deltaX)||!Number.isFinite(value.deltaY)||Math.abs(value.deltaX)>4096||Math.abs(value.deltaY)>4096||typeof value.ctrlKey!=='boolean')throw Error('Invalid search wheel delta');
 return{deltaX:value.deltaX,deltaY:value.deltaY,ctrlKey:value.ctrlKey};
}
class SearchViews extends EventEmitter{
 constructor({win,blocked=()=>false,isPrivate=()=>false,onState,onScroll,onInvalidate,maxLive=MAX_LIVE,electron}={}){
  super();if(!win||!Number.isInteger(maxLive)||maxLive<1||maxLive>MAX_LIVE)throw Error('Invalid live search view options');
  Object.assign(this,{win,blocked,isPrivate,onState,onScroll,onInvalidate,maxLive});this.electron=electron||require('electron');this.results=new Map();this.records=new Map();this.active=false;this.suspended=false;this.reason='';this.revision=0;this.disposed=false;this.packet=null;this.session=null;this.sessionCleanup=Promise.resolve();
  this.onMinimize=()=>this._hide('minimized');this.onRestore=()=>this._apply();this.onShellNavigation=(_event,_url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace)this.close('shell-navigation');};this.onClosed=()=>{void this.dispose();};
  win.on('minimize',this.onMinimize);win.on('hide',this.onMinimize);win.on('restore',this.onRestore);win.on('show',this.onRestore);win.once('closed',this.onClosed);this.shell=win.webContents;this.shell.on('did-start-navigation',this.onShellNavigation);
 }
 _blockedReason(){
  if(this.disposed||!this.active)return'closed';
  if(this.isPrivate())return'private';if(this.win.isDestroyed())return'closed';if(this.win.isMinimized?.())return'minimized';if(this.win.isVisible?.()===false)return'hidden';
  if(this.suspended)return this.reason||'suspended';return this.blocked()?'overlay':'';
 }
 _notify(){const state=this.state();this.onState?.(state);this.emit('state',state);return state;}
 _invalidate(id,reason){const event={id,reason,revision:this.revision};this.onInvalidate?.(event);this.emit('invalidate',event);}
 _ensureSession(){
  if(this.session)return this.session;
  const session=this.electron.session.fromPartition('mouse-search-'+randomUUID(),{cache:false});
  session.setPermissionCheckHandler(()=>false);session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));session.setDevicePermissionHandler?.(()=>false);
  const denyDownload=event=>{event.preventDefault();};session.on('will-download',denyDownload);this.session={value:session,denyDownload};return this.session;
 }
 setResults(results,{revision=this.revision+1}={}){
  if(this.disposed)throw Error('Search views are disposed');if(!Array.isArray(results)||results.length>MAX_RESULTS||!Number.isSafeInteger(revision)||revision<1||revision<this.revision)throw Error('Invalid search results revision');
  const next=new Map();for(const row of results){const id=identifier(row?.id),url=webURL(row.url);if(next.has(id))throw Error('Duplicate search result ID');next.set(id,{id,url,title:String(row.title||url).slice(0,500)});}
  const changed=revision!==this.revision;
  for(const [id,record]of this.records)if(changed||!next.has(id)||next.get(id).url!==record.resultURL)this._destroy(record,'results-changed');
  if(changed){this._invalidate(null,'search-changed');this.packet=null;}
  this.results=next;this.revision=revision;this.active=true;return this._notify();
 }
 layout(packet){
  if(this.disposed||!this.active||packet?.revision!==this.revision)return this.state();
  const viewport=rectangle(packet.viewport,'viewport');if(!Array.isArray(packet.tiles)||packet.tiles.length>256)throw Error('Invalid search tiles');
  const tiles=[],seen=new Set();
  for(const tile of packet.tiles){
   const id=identifier(tile?.id),result=this.results.get(id);if(!result||seen.has(id)||webURL(tile.url)!==result.url)throw Error('Search tile is outside the current results');seen.add(id);
   tiles.push({id,url:result.url,bounds:rectangle(tile,'tile'),clip:tile.clip?rectangle(tile.clip,'clip'):viewport});
  }
  this.packet={revision:this.revision,viewport,tiles};this._apply();return this.state();
 }
 _create(result){
  const view=new this.electron.WebContentsView({webPreferences:{session:this._ensureSession().value,preload:path.join(__dirname,'mouse-search-page-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInSubFrames:false,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,backgroundThrottling:true}}),wc=view.webContents;
  const record={id:result.id,resultURL:result.url,url:result.url,title:result.title,view,ipc:wc.ipc,webContentsId:wc.id,visible:false,loading:true,error:'',navigationEpoch:0,bounds:null,captureGeometry:null,listeners:[]};this.records.set(record.id,record);
  view.setVisible(false);view.setBorderRadius(RADIUS);wc.setAudioMuted(true);wc.setWindowOpenHandler(()=>({action:'deny'}));
  const on=(type,handler)=>{wc.on(type,handler);record.listeners.push([type,handler]);},current=()=>!this.disposed&&this.records.get(record.id)===record&&!wc.isDestroyed();
  const update=()=>{if(current())this._notify();};
  const control=()=>{if(current())wc.send('mouse:search-page-control',{outerScroll:true,enabled:record.visible&&!this._blockedReason()});};record.control=control;
  for(const type of ['will-navigate','will-redirect'])on(type,(event,url)=>{try{webURL(url);}catch{event.preventDefault();}this._invalidate(record.id,'navigation');});
  on('did-start-navigation',(_event,_url,_inPlace,main)=>{if(main!==false){record.navigationEpoch++;record.loading=true;record.error='';this._invalidate(record.id,'navigation');update();}});
  on('did-navigate',(_event,url)=>{try{record.url=webURL(url);}catch{}update();});
  on('did-navigate-in-page',(_event,url,main)=>{if(main!==false){record.navigationEpoch++;this._invalidate(record.id,'navigation');try{record.url=webURL(url);}catch{}update();}});
  on('did-finish-load',control);on('did-stop-loading',()=>{record.loading=false;control();update();});
  on('page-title-updated',(_event,title)=>{record.title=String(title).slice(0,500);update();});
  on('did-fail-load',(_event,code,description,_url,main)=>{if(main!==false&&code!==-3){record.loading=false;record.error=String(description||'Page unavailable').slice(0,500);this._hideRecord(record,'load-failed');update();}});
  on('render-process-gone',()=>{record.loading=false;record.error='Страница остановлена';this._hideRecord(record,'renderer-gone');update();});
  on('destroyed',()=>{if(this.records.get(record.id)===record){this.records.delete(record.id);this._invalidate(record.id,'closed');update();}});
  record.wheel=(event,value)=>{
   if(!current()||!record.visible||this._blockedReason()||!ownedMainFrame(event,wc))return;
   let delta;try{delta=wheelDelta(value);}catch{return;}if(!delta.deltaX&&!delta.deltaY)return;
   const data={id:record.id,revision:this.revision,...delta};this.onScroll?.(data);this.emit('scroll',data);
  };record.ipc.on(WHEEL_CHANNEL,record.wheel);
  void wc.loadURL(result.url).catch(error=>{if(current()&&error.code!=='ERR_ABORTED'&&error.errno!==-3){record.loading=false;record.error=String(error.message||error).slice(0,500);this._hideRecord(record,'load-failed');update();}});
  return record;
 }
 _hideRecord(record,reason){
  const wc=record.view.webContents;if(!wc.isDestroyed()){record.view.setVisible(false);record.visible=false;record.control?.();}
  if(!this.win.isDestroyed())this.win.contentView.removeChildView(record.view);this._invalidate(record.id,reason);
 }
 _hide(reason){for(const record of this.records.values())this._hideRecord(record,reason);return this._notify();}
 _destroy(record,reason){
  if(this.records.get(record.id)!==record)return;this._hideRecord(record,reason);this.records.delete(record.id);const wc=record.view.webContents;
  record.ipc.removeListener(WHEEL_CHANNEL,record.wheel);for(const [name,handler]of record.listeners)wc.removeListener(name,handler);
  if(!wc.isDestroyed())wc.close({waitForBeforeUnload:false});
 }
 _apply(){
  const blocked=this._blockedReason();if(blocked){if(this.records.size)this._hide(blocked);return;}
  if(!this.packet||this.packet.revision!==this.revision)return;
  const [width,height]=this.win.getContentSize(),window={x:0,y:0,width,height},desired=[];
  for(const tile of this.packet.tiles){const bounds=intersection(window,this.packet.viewport,tile.bounds,tile.clip);if(bounds)desired.push({...tile,visibleBounds:bounds});if(desired.length===this.maxLive)break;}
  const ids=new Set(desired.map(row=>row.id));for(const record of this.records.values())if(!ids.has(record.id))this._destroy(record,'virtualized');
  for(const tile of desired){
   const record=this.records.get(tile.id)||this._create(this.results.get(tile.id));if(record.view.webContents.isDestroyed()||record.error)continue;
   // NativeViewHost does not reliably clip a separate native guest to a parent
   // View. Give the actual guest only its visible intersection, never a larger
   // negative-offset child which could cover the filters/footer on macOS.
   const bounds=tile.visibleBounds,attached=this.win.contentView.children.includes(record.view);
   if(!record.visible&&attached)this.win.contentView.removeChildView(record.view);
   if(!record.bounds||['x','y','width','height'].some(key=>record.bounds[key]!==bounds[key]))record.view.setBounds(bounds);record.bounds={...bounds};record.captureGeometry={clip:{...bounds},roundTop:RADIUS,roundBottom:RADIUS};record.slotBounds={...tile.bounds};
   if(!this.win.contentView.children.includes(record.view))this.win.contentView.addChildView(record.view);
   record.view.setVisible(true);record.visible=true;record.control();
  }
  this._notify();
 }
 setSuspended(value,reason='suspended'){if(typeof value!=='boolean')throw Error('Invalid search suspension');this.suspended=value;this.reason=value?String(reason).slice(0,120):'';if(value)this._hide(this.reason);else this._apply();return this.state();}
 suspend(reason){return this.setSuspended(true,reason);}
 resume(){return this.setSuspended(false);}
 target(id){const record=this.records.get(identifier(id));if(this._blockedReason()||!record||!record.visible||record.error||record.view.webContents.isDestroyed())throw Error('Выбранный сайт сейчас не виден');return record;}
 resultURL(id){const result=this.results.get(identifier(id));if(!this.active||!result)throw Error('Результат поиска уже закрыт');const record=this.records.get(id);return webURL(record?.url||result.url);}
 capturePages(){return this._blockedReason()?[]:[...this.records.values()].filter(record=>record.visible&&!record.view.webContents.isDestroyed());}
 state(){
  const reason=this._blockedReason();return{active:this.active&&!this.disposed,suspended:this.active&&!!reason,reason:reason||'',revision:this.revision,maxLive:this.maxLive,liveCount:this.records.size,pages:[...this.results.values()].map(result=>{const row=this.records.get(result.id);return{id:result.id,url:row?.url||result.url,title:row?.title||result.title,live:!!row,visible:!!row?.visible&&!reason,loading:!!row?.loading,error:row?.error||'',webContentsId:row?.webContentsId||null,navigationEpoch:row?.navigationEpoch||0,bounds:row?.bounds?{...row.bounds}:null,clip:row?.captureGeometry?{...row.captureGeometry.clip}:null,radius:RADIUS};})};
 }
 close(reason='closed'){
  this.active=false;this.packet=null;for(const row of this.records.values())this._destroy(row,reason);this.results.clear();this._invalidate(null,reason);
  const owned=this.session;this.session=null;if(owned){owned.value.removeListener('will-download',owned.denyDownload);this.sessionCleanup=Promise.allSettled([this.sessionCleanup,owned.value.clearStorageData(),owned.value.clearCache?.()]).then(()=>{});}
  return this._notify();
 }
 async dispose(){
  if(this.disposed)return this.sessionCleanup;this.close('disposed');this.disposed=true;
  for(const [name,handler]of [['minimize',this.onMinimize],['hide',this.onMinimize],['restore',this.onRestore],['show',this.onRestore],['closed',this.onClosed]])this.win.removeListener(name,handler);
  this.shell.removeListener('did-start-navigation',this.onShellNavigation);this.removeAllListeners();await this.sessionCleanup;
 }
}
module.exports={createSearchViews:options=>new SearchViews(options),SearchViews,webURL,rectangle,intersection,ownedMainFrame,wheelDelta,RADIUS,MAX_LIVE,MAX_RESULTS,WHEEL_CHANNEL};
