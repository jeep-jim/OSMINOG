'use strict';
// Own search workspace. Requests, provider sessions and native page ownership
// stay in the main process; renderer messages never choose providers or secrets.
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const MAX_RESULTS=300,MAX_HISTORY=12,MAX_INPUT_BYTES=128*1024;
const text=(value,max=4000)=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max):'';
class TileSearch {
 constructor(options){
  Object.assign(this,options);
  this.active=false;this.disposed=false;this.locked=false;this.revision=1;this.results=[];this.query='';this.filter='all';this.page=0;this.hasMore=false;this.history=[];this.pending=new Set();this.summaryPending=new Set();this.chatPending=false;this.chatSerial=0;this.summary='';this.lastVisionContext=null;this.watchers=[];
  this.shell=this.win.webContents;
  const serviceFactory=options.serviceFactory||require('./mouse-search-service.cjs').createSearchService;
  this.serviceFactory=serviceFactory;this.service=serviceFactory(this.serviceOptions());
  const viewsFactory=options.viewsFactory||require('./mouse-search-views.cjs').createSearchViews;
  this.views=viewsFactory({win:this.win,blocked:()=>this.blocked(),isPrivate:()=>this.isPrivate?.()===true,maxLive:8,
   onState:state=>this.emit('pages',{...state,state}),onScroll:value=>this.emit('scroll',value),onInvalidate:event=>{if(this.vision?.state().targetId===event.id||!event.id)this.vision?.stop(event.reason);}});
  const visionFactory=options.visionFactory||require('./mouse-search-vision.cjs').createSearchVision;
  this.vision=visionFactory({views:this.views,win:this.win,powerMonitor:this.powerMonitor,isPrivate:()=>this.isPrivate?.()===true,
   onState:state=>{if(!state.active)this.lastVisionContext=null;this.emit('vision',{state});},onContext:context=>{this.lastVisionContext=context;this.emit('vision-context',{context});}});
  this.wrapLayout();
  if(this.ipcMain)this.ipcMain.handle('mouse:tile-search',(event,action,args={})=>{this.trusted(event);return this.handle(action,args);});
  this.listen(this.powerMonitor,'lock-screen',()=>{this.locked=true;this.close('Экран заблокирован',{reset:true});});
  this.listen(this.powerMonitor,'unlock-screen',()=>{this.locked=false;});
  this.listen(this.win,'minimize',()=>{this.views.suspend('Окно свёрнуто');this.vision.stop('Окно свёрнуто');});
  this.listen(this.win,'restore',()=>this.syncOverlay());
  this.listen(this.shell,'did-start-navigation',(_e,_url,inPlace,mainFrame)=>{if(mainFrame&&!inPlace)this.close('Страница браузера изменена',{reset:true});});
  this.listen(this.win,'closed',()=>this.dispose());
 }
 listen(emitter,event,listener){emitter?.on?.(event,listener);this.watchers.push({emitter,event,listener});}
 emit(kind,value={}){if(this.disposed||this.win.isDestroyed?.()||this.shell.isDestroyed?.())return;this.shell.send('mouse:search-state',{kind,revision:this.revision,...value});}
 encryptedStorage(){try{return this.safeStorage?.isEncryptionAvailable?.()&&(process.platform!=='linux'||['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(this.safeStorage.getSelectedStorageBackend?.()));}catch{return false;}}
 serviceOptions(){return{
  getSessionToken:async()=>{if(!this.encryptedStorage()||this.isPrivate?.())return '';const data=await this.store?.get?.(['mouseTileSearchSession']);const saved=data?.mouseTileSearchSession;if(saved?.schema!==1||typeof saved.encrypted!=='string'||saved.encrypted.length>8192)return '';try{return this.safeStorage.decryptString(Buffer.from(saved.encrypted,'base64'));}catch{return '';};},
  setSessionToken:async token=>{if(!this.encryptedStorage()||this.isPrivate?.()||this.disposed)return;if(typeof token!=='string'||token.length>4096)throw Error('Invalid search session');const encrypted=this.safeStorage.encryptString(token).toString('base64');await this.store?.set?.({mouseTileSearchSession:{schema:1,encrypted}});}
 };}
 blocked(){return !this.active||this.disposed||this.locked||this.isPrivate?.()===true||this.win.isDestroyed?.()||this.win.isMinimized?.()||this.overlayGate?.blocked===true||!!this.browser.mouseSurfaceHold;}
 requireOpen(){if(this.disposed||!this.active||this.locked||this.isPrivate?.())throw Error('Откройте поиск Mouse в обычном рабочем столе');}
 wrapLayout(){
  const browser=this.browser,gate=this.overlayGate;
  this.savedLayout=browser.layout;this.savedAdditionalPages=browser.mouseAdditionalCapturePages;
  this.layoutWrapper=panels=>{if(!this.active)return this.savedLayout.call(browser,panels);const value=this.savedLayout.call(browser,[]);this.syncOverlay();return value;};browser.layout=this.layoutWrapper;
  this.additionalPages=()=>this.active&&!this.blocked()?this.views.capturePages():this.savedAdditionalPages?.()||[];browser.mouseAdditionalCapturePages=this.additionalPages;
  if(gate){this.savedGateSet=gate.set;this.gateWrapper=(...args)=>{if(args[0]?.blocked)this.views.suspend('Открыта панель');const result=this.savedGateSet.apply(gate,args);if(this.active)this.savedLayout.call(browser,[]);this.syncOverlay();return result;};gate.set=this.gateWrapper;}
 }
 syncOverlay(){if(this.disposed)return;if(this.blocked()){this.views.suspend('Рабочая область временно закрыта');if(this.vision.state().active)this.vision.stop('Рабочая область временно закрыта');}else this.views.resume();}
 state(){return{active:this.active,revision:this.revision,query:this.query,filter:this.filter,page:this.page,hasMore:this.hasMore,results:this.results,summary:this.summary,pending:this.pending.size>0,vision:this.vision.state(),provider:this.service.state()};}
 open(){if(this.disposed||this.locked||this.isPrivate?.())throw Error('Поиск Mouse доступен в обычном рабочем столе');this.active=true;this.savedLayout.call(this.browser,[]);this.views.setResults(this.results,{revision:this.revision});this.syncOverlay();return this.state();}
 close(reason='Поиск закрыт',{reset=false}={}){
  this.active=false;this.revision++;this.chatSerial++;this.service.cancelAll();this.pending.clear();this.summaryPending.clear();this.chatPending=false;this.vision.stop(reason);this.lastVisionContext=null;this.views.close(reason);
  if(reset){this.results=[];this.query='';this.page=0;this.hasMore=false;this.summary='';this.history=[];}
  this.emit('closed',{reason,reset});return{closed:true,revision:this.revision};
 }
 clearResults(){
  this.requireOpen();this.revision++;this.chatSerial++;this.service.cancelAll();this.pending.clear();this.summaryPending.clear();this.chatPending=false;this.vision.stop('Запрос очищен');this.lastVisionContext=null;
  this.results=[];this.query='';this.page=0;this.hasMore=false;this.summary='';this.history=[];this.views.setResults([],{revision:this.revision});return{cleared:true,revision:this.revision};
 }
 async search(args){
  this.requireOpen();if(typeof args.query!=='string'||args.query.length>512)throw Error('Введите запрос длиной до 512 символов.');const query=text(args.query,512),filter=['all','video','product','article'].includes(args.filter)?args.filter:'all',page=Number(args.page||1),requestId=text(args.requestId,100)||randomUUID();
  if(!query||!Number.isSafeInteger(page)||page<1||page>30)throw Error('Укажите поисковый запрос');
  if(page===1){this.service.cancelAll();this.pending.clear();this.summaryPending.clear();this.vision.stop('Новый поиск');this.revision++;this.chatSerial++;this.chatPending=false;this.results=[];this.history=[];this.summary='';this.query=query;this.filter=filter;this.page=0;this.hasMore=false;this.views.setResults([],{revision:this.revision});}
  else if(this.pending.size||args.revision!==this.revision||query!==this.query||filter!==this.filter||page!==this.page+1||!this.hasMore)throw Error('Результаты изменились. Повторите поиск.');
  const revision=this.revision;this.pending.add(requestId);
  try{
   const response=await this.service.query({query,page,filter,requestId});
   if(!this.active||this.disposed||revision!==this.revision||!this.pending.has(requestId))throw Error('Поиск отменён');
   if(!Array.isArray(response.results))throw Error('Поисковик вернул некорректный ответ');
   const urls=new Set(this.results.map(row=>row.url)),newResults=[];
   for(const row of response.results){if(!row||typeof row.id!=='string'||typeof row.url!=='string'||urls.has(row.url)||this.results.length+newResults.length>=MAX_RESULTS)continue;urls.add(row.url);newResults.push(row);}
   this.results.push(...newResults);this.page=page;this.hasMore=response.hasMore===true&&this.results.length<MAX_RESULTS;this.views.setResults(this.results,{revision});
   const result={...response,requestId,revision,query,page,results:newResults,hasMore:this.hasMore};
   if(page===1&&this.results.length)void this.summarize(revision,query,this.results.slice(0,12),requestId);
   return result;
  }finally{this.pending.delete(requestId);}
 }
 async summarize(revision,query,results,requestId){
  const id=requestId+'-summary';this.summaryPending.add(id);
  try{const answer=await this.service.summarize({query,results,requestId:id});if(this.active&&!this.disposed&&revision===this.revision&&this.summaryPending.has(id)){this.summary=text(answer.text,12000);this.emit('summary',{requestId,text:this.summary});}}
  catch(error){if(this.active&&!this.disposed&&revision===this.revision&&this.summaryPending.has(id))this.emit('summary',{requestId,text:'',error:text(error.message,600)});}
  finally{this.summaryPending.delete(id);}
 }
 async chat(args){
  this.requireOpen();if(args.revision!==this.revision)throw Error('Результаты изменились');if(typeof args.message!=='string'||args.message.length>3000)throw Error('Введите вопрос длиной до 3000 символов.');const message=text(args.message,3000);if(!message)throw Error('Напишите вопрос');if(this.chatPending)throw Error('Дождитесь ответа Mouse');
  const revision=this.revision,serial=++this.chatSerial;this.chatPending=true;
  try{const visionContext=this.vision.state().active?await this.vision.snapshot():null;const answer=await this.service.chat({message,query:this.query,results:this.results.slice(0,15),history:this.history.slice(-MAX_HISTORY),visionContext,requestId:text(args.requestId,100)||randomUUID()});if(!this.active||revision!==this.revision)throw Error('Диалог закрыт');const reply=text(answer.text,16000);if(!reply)throw Error('ИИ не вернул ответ');this.history.push({role:'user',content:message},{role:'assistant',content:reply});this.history=this.history.slice(-MAX_HISTORY);return{revision,text:reply};}
  finally{if(serial===this.chatSerial)this.chatPending=false;}
 }
 async prepareOverlay(){
  const revision=this.revision;
  if(!this.active)return{revision,complete:true,expectedIds:[],pages:[]};
  if(this.blocked())return{revision,complete:false,skipped:true,pages:[]};
  const records=this.views.capturePages(),pins=records.map(record=>({record,id:record.id,epoch:record.navigationEpoch,bounds:{...record.bounds}}));
  if(records.length>8||new Set(pins.map(pin=>pin.id)).size!==records.length)throw Error('Состав поискового стола изменился.');
  const same=pin=>this.active&&!this.blocked()&&revision===this.revision&&pin.record.visible&&!pin.record.view.webContents.isDestroyed()&&pin.record.navigationEpoch===pin.epoch&&['x','y','width','height'].every(key=>pin.record.bounds[key]===pin.bounds[key]);
  const pages=await Promise.all(pins.map(async pin=>{
   const image=await require('./mouse-lifecycle.cjs').bounded(pin.record.view.webContents.capturePage(undefined,{stayHidden:true,stayAwake:false}),1500,'Поисковая страница');
   if(!same(pin))throw Error('Поисковый стол изменился. Повторите открытие.');
   const size=image.getSize();if(image.isEmpty()||size.width<=0||size.height<=0||size.width*size.height>4*1024*1024)throw Error('Не удалось подготовить открытый сайт.');
   const png=image.toPNG();if(!png.length||png.length>16*1024*1024)throw Error('Не удалось подготовить открытый сайт.');
   return{id:pin.id,src:'data:image/png;base64,'+png.toString('base64'),width:size.width,height:size.height,bounds:pin.bounds,bytes:png.length};
  }));
  const current=this.views.capturePages();if(!pins.every(same)||current.length!==records.length||current.some((record,index)=>record!==records[index])||pages.reduce((sum,page)=>sum+page.bytes,0)>16*1024*1024)throw Error('Не удалось подготовить все открытые сайты. Повторите открытие.');
  return{revision,complete:true,expectedIds:pins.map(pin=>pin.id),pages:pages.map(({bytes,...page})=>page)};
 }
 async handle(action,args={}){
  if(this.disposed)throw Error('Поиск закрыт');if(!args||typeof args!=='object'||Array.isArray(args)||Buffer.byteLength(JSON.stringify(args))>MAX_INPUT_BYTES)throw Error('Invalid search request');
  if(action==='state')return this.state();if(action==='open')return this.open();if(action==='close')return this.close();
  if(action==='cancel'){const id=text(args.requestId,100);this.pending.delete(id);this.summaryPending.delete(id+'-summary');this.service.cancel(id);this.service.cancel(id+'-summary');return{cancelled:true};}
  this.requireOpen();
  if(action==='clear')return this.clearResults();
  if(action==='query')return this.search(args);
  if(action==='layout'){if(args.revision!==this.revision)return{stale:true};return this.views.layout(args);}
  if(action==='prepare-overlay')return this.prepareOverlay();
  if(action==='chat')return this.chat(args);
  if(action==='vision-start'){if(args.revision!==this.revision)throw Error('Результаты изменились');return this.vision.start({id:args.id,consent:args.consent===true});}
  if(action==='vision-stop')return this.vision.stop('Показ экрана выключен');
  if(action==='vision-state')return this.vision.state();
  if(action==='open-result'){const url=this.views.resultURL(args.id);if(!url)throw Error('Результат больше недоступен');const result=await this.browser.command('open',{url,lane:'main'});this.close();this.emit('open-result',{id:result.id,desk:this.browser.mouseDesktops?.bank?.active});return{id:result.id};}
  throw Error('Неизвестная команда поиска');
 }
 configureFixtureService(options){
  if(!this.test||process.env.CI!=='true'||!path.isAbsolute(process.env.MOUSE_TEST_PROFILE||'')||path.resolve(this.app.getPath('userData'))!==path.resolve(process.env.MOUSE_TEST_PROFILE))throw Error('Search fixtures require the isolated native test profile');
  this.close('Настройка проверочного сервера',{reset:true});this.service.dispose();this.service=this.serviceFactory({...options,fixtureProfile:this.app.getPath('userData')});return this.service.state();
 }
 dispose(){
  if(this.disposed)return;this.close('Браузер закрывается',{reset:true});this.disposed=true;this.service.dispose();this.vision.dispose();this.views.dispose();
  for(const {emitter,event,listener}of this.watchers)emitter?.removeListener?.(event,listener);this.watchers=[];
  if(this.browser.layout===this.layoutWrapper)this.browser.layout=this.savedLayout;
  if(this.browser.mouseAdditionalCapturePages===this.additionalPages)this.browser.mouseAdditionalCapturePages=this.savedAdditionalPages;
  if(this.overlayGate?.set===this.gateWrapper)this.overlayGate.set=this.savedGateSet;
  this.ipcMain?.removeHandler?.('mouse:tile-search');
 }
}
module.exports={TileSearch,install:options=>new TileSearch(options),MAX_RESULTS,MAX_HISTORY};
