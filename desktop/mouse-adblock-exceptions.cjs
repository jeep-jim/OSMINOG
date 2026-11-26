'use strict';

// User exclusions belong to the top-level website, never to the URL of an ad
// request. Only canonical hostnames are retained in the profile.
const {isIP}=require('node:net');
const KEY='mouseAdBlockExceptions',MAX_SITES=500,MAX_INPUT=8192;
const invalid=()=>Object.assign(Error('Введите адрес сайта HTTP или HTTPS без логина и пароля.'),{code:'MOUSE_ADBLOCK_SITE_INVALID'});
function normalizeSite(input,{allowBare=true}={}){
 if(typeof input!=='string'||input.length>MAX_INPUT||/[\x00-\x1f\x7f\\]/.test(input))throw invalid();
 let value=input.trim();if(!value||/\s/.test(value)||/%(?![\da-f]{2})/i.test(value))throw invalid();
 const explicit=/^[a-z][a-z\d+.-]*:/i.test(value),http=/^https?:\/\//i.test(value);
 if(!http){
  if(!allowBare||value.startsWith('//'))throw invalid();
  // A bare host may include a decimal port. Other scheme-like input is not a
  // website, even if the URL parser could repair it into one.
  if(isIP(value)===6)value='['+value+']';
  else if(explicit){const bare=/^([^/?#:@]+):\d+(?:[/?#]|$)/.exec(value);if(!bare||!bare[1].includes('.')&&bare[1].toLowerCase()!=='localhost')throw invalid();}
  value='https://'+value;
 }
 const authority=value.slice(value.indexOf('://')+3).split(/[/?#]/,1)[0];
 if(!authority||authority.includes('@')||authority.includes('%')||authority.endsWith(':'))throw invalid();
 let url;try{url=new URL(value);}catch{throw invalid();}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname)throw invalid();
 let host=url.hostname.toLowerCase();
 if(host.startsWith('[')){
  if(!host.endsWith(']')||isIP(host.slice(1,-1))!==6)throw invalid();
  return host;
 }
 host=host.replace(/\.$/,'');
 if(host.length>253||!host.split('.').every(label=>label.length>0&&label.length<=63&&/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(label)))throw invalid();
 return host;
}
function siteFromURL(url){try{return normalizeSite(url,{allowBare:false});}catch{return '';}}
function storedHosts(value){
 if(value===undefined)return [];
 if(!value||typeof value!=='object'||Array.isArray(value)||value.schema!==1||!Array.isArray(value.hosts)||value.hosts.length>MAX_SITES)throw Error('Invalid AdBlock exceptions');
 const hosts=value.hosts.map(host=>{if(typeof host!=='string'||normalizeSite(host)!==host)throw Error('Invalid AdBlock exception hostname');return host;});
 if(new Set(hosts).size!==hosts.length)throw Error('Duplicate AdBlock exception');
 return hosts.sort();
}
class AdBlockExceptions{
 constructor({store,isPrivate=()=>false,notify=()=>{},report=()=>{}}={}){
  if(!store?.get||!store?.set)throw Error('A profile Store is required');
  this.store=store;this.isPrivate=isPrivate;this.notify=notify;this.report=report;this.hosts=new Set();this.revision=0;this.ready=false;this.initializing=null;this.queue=Promise.resolve();
 }
 async initialize(){
  if(this.ready)return this;if(this.initializing)return this.initializing;
  this.initializing=(async()=>{
   const record=(await this.store.get(KEY))[KEY];
   try{this.hosts=new Set(storedHosts(record));}catch{this.hosts=new Set();try{this.report('MOUSE_ADBLOCK_EXCEPTIONS_IGNORED');}catch{}}
   this.ready=true;return this;
  })().finally(()=>{this.initializing=null;});return this.initializing;
 }
 list(){return [...this.hosts].sort();}
 state(){return{hosts:this.list(),privateMode:!!this.isPrivate(),revision:this.revision,maxSites:MAX_SITES};}
 hasURL(url){const host=siteFromURL(url);return!!host&&this.hosts.has(host);}
 effective(url,globalEnabled){
  const host=siteFromURL(url),excluded=!!host&&this.hosts.has(host),privateMode=!!this.isPrivate();
  return{host,eligible:!!host,excluded,globalEnabled:globalEnabled===true,enabled:globalEnabled===true&&!!host&&!excluded,privateMode,canChange:!!host&&!privateMode};
 }
 assertWritable(guard){
  if(this.isPrivate())throw Object.assign(Error('Исключения сайтов меняются только в обычном режиме.'),{code:'MOUSE_ADBLOCK_SITE_PRIVATE'});
  if(guard&&guard()!==true)throw Object.assign(Error('Страница изменилась. Откройте меню или выберите вкладку ещё раз.'),{code:'MOUSE_ADBLOCK_SITE_CHANGED'});
 }
 async change(input,add,{guard}={}){
  this.assertWritable(guard);const host=normalizeSite(input);
  const work=this.queue.catch(()=>{}).then(async()=>{
   await this.initialize();this.assertWritable(guard);
   if(this.hosts.has(host)===add)return this.state();
   const next=new Set(this.hosts);if(add)next.add(host);else next.delete(host);
   if(next.size>MAX_SITES)throw Object.assign(Error('Достигнут предел исключений сайтов: '+MAX_SITES+'.'),{code:'MOUSE_ADBLOCK_SITE_LIMIT'});
   // Commit first. A failed write leaves both the live request policy and the
   // previous profile record intact. No optimistic allowlist is exposed.
   await this.store.set({[KEY]:{schema:1,hosts:[...next].sort()}});
   this.hosts=next;this.revision++;
   const state=this.state();try{this.notify(state);}catch{}
   return state;
  });this.queue=work.then(()=>{},()=>{});return work;
 }
 add(input,options){return this.change(input,true,options);}
 remove(input,options){return this.change(input,false,options);}
 flush(){return this.queue;}
}
function liveURL(wc){try{return wc&&!wc.isDestroyed?.()?wc.getURL():'';}catch{return '';}}
function pageFor(browser,id){
 if(typeof id!=='string'||!id||id.length>100||!browser||browser.disposed)throw Error('Не удалось определить открытую вкладку.');
 const page=browser.get(id),wc=page?.view?.webContents,url=liveURL(wc);
 if(page.managedExtension||!siteFromURL(url))throw invalid();
 return{page,wc,url,host:siteFromURL(url),epoch:page.navigationEpoch||0};
}
function openTabs(browser){
 if(!browser||browser.disposed)return [];
 const seen=new Set(),out=[];
 for(const page of [...browser.tabs?.values?.()||[],...browser.providers?.values?.()||[]]){
  if(seen.has(page.id)||page.project!==browser.project||page.ephemeral||page.managedExtension)continue;
  seen.add(page.id);const host=siteFromURL(liveURL(page.view?.webContents));if(host)out.push({id:page.id,title:String(page.title||host).slice(0,256),host});
 }
 return out;
}
function install({service,ipcMain,trusted,getBrowser,getEnabled=()=>false,isAvailable=()=>true}){
 if(!service||typeof trusted!=='function'||typeof getBrowser!=='function')throw Error('AdBlock exception IPC requires a service and trusted browser context');
 const state=()=>({...service.state(),enabled:getEnabled()===true,tabs:openTabs(getBrowser())});
 ipcMain.handle('mouse:adblock-exceptions',async(event,action,args={})=>{
  trusted(event);
  if(!isAvailable())throw Error('Дождитесь завершения переключения режима.');
  if(action==='state')return state();
  if(!args||typeof args!=='object'||Array.isArray(args))throw invalid();
  if(action==='site')return service.effective(pageFor(getBrowser(),args.tabId).url,getEnabled());
  if(action==='add'){if(Object.keys(args).some(key=>key!=='url'))throw invalid();await service.add(args.url,{guard:()=>isAvailable()===true});return state();}
  if(action==='remove'){if(Object.keys(args).some(key=>key!=='host'))throw invalid();await service.remove(args.host,{guard:()=>isAvailable()===true});return state();}
  if(action==='add-tab'||action==='set-site'){
   if(Object.keys(args).some(key=>!['tabId','host',...(action==='set-site'?['blocking']:[])].includes(key)))throw invalid();
   const browser=getBrowser(),target=pageFor(browser,args.tabId);
   if(args.host!==undefined&&args.host!==target.host)throw Object.assign(Error('Адрес вкладки изменился. Выберите её ещё раз.'),{code:'MOUSE_ADBLOCK_SITE_CHANGED'});
   if(action==='set-site'&&(typeof args.blocking!=='boolean'||getEnabled()!==true))throw Error('Сначала включите общую блокировку рекламы в настройках.');
   const guard=()=>{
    if(!isAvailable()||getBrowser()!==browser||browser.disposed)return false;
    try{const current=pageFor(browser,args.tabId);return current.page===target.page&&current.wc===target.wc&&current.url===target.url&&current.epoch===target.epoch;}catch{return false;}
   };
   await service[action==='set-site'&&args.blocking?'remove':'add'](target.url,{guard});return state();
  }
  throw Error('Неизвестная команда исключений AdBlock.');
 });
 return{state,flush:()=>service.flush()};
}
function contextItem({service,wc,getEnabled=()=>false,locale='ru',valid=()=>true,onError=()=>{}}){
 if(!service)return null;
 const url=liveURL(wc),state=service.effective(url,getEnabled()),revision=service.revision;
 const guard=()=>valid()===true&&getEnabled()===true&&revision===service.revision&&liveURL(wc)===url;
 return{id:'mouse-context-adblock',type:'checkbox',label:locale==='en'?'Block ads on this site':'Блокировать рекламу на этом сайте',checked:state.enabled,enabled:state.eligible&&state.globalEnabled&&!state.privateMode,
  click:()=>{if(!state.eligible||!state.globalEnabled||state.privateMode||!guard())return;return service[state.excluded?'remove':'add'](url,{guard}).catch(onError);}};
}
module.exports={KEY,MAX_SITES,MAX_INPUT,normalizeSite,siteFromURL,storedHosts,AdBlockExceptions,liveURL,openTabs,install,contextItem};
