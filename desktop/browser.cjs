'use strict';
const {WebContentsView,session,dialog,clipboard,Menu}=require('electron');
const {randomUUID}=require('node:crypto');
const PROVIDERS={chatgpt:'https://chatgpt.com/',claude:'https://claude.ai/',gemini:'https://gemini.google.com/',deepseek:'https://chat.deepseek.com/'};
function address(value){
 const input=String(value||'').trim();if(!input)return 'https://www.google.com/';
 const candidate=/^[a-z][a-z\d+.-]*:/i.test(input)?input:/^[^\s/]+\.[^\s]+/.test(input)?'https://'+input:'https://www.google.com/search?q='+encodeURIComponent(input);
 const url=new URL(candidate);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Можно открыть только адрес HTTP или HTTPS без пароля');return url.href;
}
// Runs only on an explicitly selected webpage. Form values and password fields are not read.
const {readPage,providerFor}=require('./page-context.cjs');
const {proxyConfig}=require('./network.cjs');
const path=require('node:path');
class BrowserWorkspace{
 constructor(win,store){
  this.store=store;this.snapshots={};this.restored=new Set();this.saveQueue=Promise.resolve();this.win=win;this.tabs=new Map();this.providers=new Map();this.project='';this.panels=[];this.contextIds=[];this.ai=null;this.provider='';this.disposed=false;
  // Browser profile remains on this device; no proxy, sync endpoint or screen relay.
  this.contextSharing={includeChats:false};this.network={mode:'system',server:''};
  this.session=session.fromPartition('persist:osminog-browser');
  const ua=this.session.getUserAgent?.();if(ua)this.session.setUserAgent(require('./network.cjs').browserUserAgent(ua));
  this.session.setPermissionCheckHandler(()=>false);
  this.session.setPermissionRequestHandler(async(wc,permission,callback,details)=>{
   const owned=[...this.tabs.values(),...this.providers.values()].some(t=>t?.view.webContents===wc);
   if(!owned||!['media','geolocation','notifications','clipboard-read'].includes(permission)){callback(false);return}
   try{const origin=new URL(details.requestingUrl||wc.getURL()).origin;
    const r=await dialog.showMessageBox(win,{type:'question',buttons:['Запретить','Разрешить один раз'],defaultId:0,cancelId:0,message:`${origin} запрашивает разрешение: ${permission}`,detail:'Разрешение относится к этой странице на вашем устройстве.'});callback(r.response===1);
   }catch{callback(false)}
  });
  this.session.on('will-download',(_event,item)=>{
   // Electron's native save dialog chooses the destination; never a server upload.
   item.setSaveDialogOptions({title:'Сохранить файл на устройстве'});
  });
  win.on('resize',()=>this.layout(this.panels));
  win.webContents.on('did-start-loading',()=>this.layout([]));
  win.on('closed',()=>this.dispose());
 }
 save(){if(!this.store)return;for(const id of this.restored)this.snapshots[id]=[...this.tabs.values(),...this.providers.values()].filter(t=>t.project===id).map(t=>({id:t.id,url:t.view.webContents.getURL()||t.url,lane:t.lane||'main',provider:t.provider,thread:t.thread}));const snapshot=JSON.parse(JSON.stringify(this.snapshots));this.saveQueue=this.saveQueue.catch(()=>{}).then(()=>this.store.set({browserSessions:snapshot}));this.saveQueue.catch(e=>{if(!this.disposed)this.win.webContents.send('browser:error',e.message)});return this.saveQueue}
 async initNetwork(){if(this.store){const saved=(await this.store.get('browserNetwork')).browserNetwork;if(saved)await this.setNetwork(saved,false)}}
 async setNetwork(input,persist=true){const config=proxyConfig(input);await this.session.setProxy(config.mode==='fixed_servers'?{mode:config.mode,proxyRules:config.server,proxyBypassRules:'<local>'}:{mode:config.mode});await this.session.closeAllConnections();this.network=config;if(persist&&this.store)await this.store.set({browserNetwork:config});return config}
 async restore(id){if(this.restored.has(id)||!this.store)return;if(!Object.keys(this.snapshots).length)this.snapshots=(await this.store.get('browserSessions')).browserSessions||{};this.restored.add(id);for(const item of this.snapshots[id]||[]){try{const t=this.make(address(item.url),id,!!item.provider);if(typeof item.id==='string'&&/^[a-f0-9-]{36}$/.test(item.id)){if(!item.provider){this.tabs.delete(t.id);this.tabs.set(item.id,t)}t.id=item.id}if(item.provider&&Object.hasOwn(PROVIDERS,item.provider)){t.provider=item.provider;t.thread=item.thread||'main';this.providers.set(JSON.stringify([id,t.provider,t.thread]),t)}else{t.lane=item.lane==='side'?'side':'main'}}catch{}}}
 emit(){if(!this.disposed&&!this.win.isDestroyed())this.win.webContents.send('browser:state',this.state())}
 state(){return{activeProvider:this.ai?.id||'',sessions:[...this.providers.values()].filter(t=>t.project===this.project).map(t=>({id:t.id,title:t.title,favicon:t.favicon||'',url:t.view.webContents.getURL()||t.url,loading:t.loading,session:true,provider:t.provider,error:t.error||'',back:t.view.webContents.navigationHistory.canGoBack(),forward:t.view.webContents.navigationHistory.canGoForward(),contextEnabled:!!t.contextOrigin&&t.contextOrigin===new URL(t.view.webContents.getURL()||t.url).origin})),project:this.project,tabs:[...this.tabs.values()].filter(t=>t.project===this.project).map(t=>({id:t.id,contextEnabled:!!t.contextOrigin&&t.contextOrigin===new URL(t.view.webContents.getURL()||t.url).origin,lane:t.lane||'main',url:t.view.webContents.getURL()||t.url,title:t.title||t.url,favicon:t.favicon||'',loading:t.loading,error:t.error||'',back:t.view.webContents.navigationHistory.canGoBack(),forward:t.view.webContents.navigationHistory.canGoForward()})),provider:this.provider}}
 make(url,project,ai=false){
  const view=new WebContentsView({webPreferences:{session:this.session,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,preload:path.join(__dirname,'page-preload.cjs')}});
  const t={id:randomUUID(),project,url,title:url,view,loading:true,error:'',visible:false},wc=view.webContents;
  view.setBorderRadius?.(18);view.setBounds({x:0,y:0,width:1000,height:800});view.setVisible(false);this.win.contentView.addChildView(view);
  wc.setWindowOpenHandler(({url:next})=>{try{if(t.project===this.project)this.open({url:address(next),lane:t.provider?'side':t.lane})}catch{}return{action:'deny'}});
  wc.on('will-navigate',(e,next)=>{try{address(next)}catch{e.preventDefault()}});
  wc.on('did-start-navigation',(_e,_url,_inPlace,isMainFrame)=>{if(isMainFrame)t.navigationEpoch=(t.navigationEpoch||0)+1});
  wc.on('will-redirect',(e,next)=>{try{address(next)}catch{e.preventDefault()}});
  wc.on('context-menu',(_event,params)=>{if(t.project!==this.project||!params.srcURL)return;const url=params.srcURL;Menu.buildFromTemplate([{label:'Добавить медиа на рабочий стол',click:()=>this.win.webContents.send('browser:media',{id:t.id,url,project:t.project,destination:'canvas'})},{label:'Прикрепить изображение к чату справа',enabled:params.mediaType==='image',click:()=>this.win.webContents.send('browser:media',{id:t.id,url,project:t.project,destination:'chat'})}]).popup({window:this.win})});
  wc.on('focus',()=>{if(t.project===this.project)this.win.webContents.send('browser:focus',{id:t.id})});
  wc.on('page-favicon-updated',(_e,icons)=>{t.favicon=Array.isArray(icons)?icons[0]||'':'';this.emit()});
  wc.on('page-title-updated',(_e,title)=>{t.title=title;this.emit()});
  wc.on('did-start-loading',()=>{t.loading=true;t.error='';this.emit()});
  wc.on('did-finish-load',()=>{const origin=new URL(wc.getURL()).origin;wc.send('page:context-enabled',!!t.contextOrigin&&t.contextOrigin===origin)});
  wc.on('did-stop-loading',()=>{t.loading=false;this.emit()});
  wc.on('did-navigate',()=>{t.favicon='';this.emit();this.save()});wc.on('did-navigate-in-page',()=>{this.emit();this.save()});
  wc.on('did-fail-load',(_e,code,description,_url,main)=>{if(main&&code!==-3){t.error=description;t.loading=false;this.emit()}});
  wc.on('preload-error',(_e,_path,error)=>{t.error='Не удалось загрузить коннектор: '+error.message;this.emit()});
  wc.on('render-process-gone',()=>{t.error='Вкладка остановлена. Нажмите обновить.';this.emit()});
  if(!ai)this.tabs.set(t.id,t);
  wc.loadURL(url).catch(e=>{t.error=e.message;this.emit()});return t;
 }
 get(id){const t=this.tabs.get(id)||[...this.providers.values()].find(t=>t.id===id);if(!t||t.project!==this.project)throw Error('Вкладка не принадлежит открытому проекту');return t}
 selectProvider(provider,thread='main'){
  if(!Object.hasOwn(PROVIDERS,provider)&&provider!=='')throw Error('Неизвестный ИИ');
  if(!provider){this.ai=null;this.provider='';this.layout(this.panels);this.emit();return null}
  const key=JSON.stringify([this.project,provider,String(thread).slice(0,200)]);
  if(!this.providers.has(key)){const t=this.make(PROVIDERS[provider],this.project,true);t.provider=provider;t.thread=thread;this.providers.set(key,t)}
  this.ai=this.providers.get(key);this.provider=provider;this.save();this.layout(this.panels);this.emit();return this.ai;
 }
 open({url,lane}){if(!this.project)throw Error('Сначала откройте проект');const t=this.make(address(url),this.project);t.lane=lane==='side'?'side':'main';this.save();this.emit();return{id:t.id}}
 destroy(t){if(!t)return;this.win.contentView.removeChildView(t.view);if(!t.view.webContents.isDestroyed())t.view.webContents.close({waitForBeforeUnload:false})}
 async command(action,args={}){
  switch(action){
   case 'project':{const id=String(args.id||'').slice(0,200);if(id!==this.project){this.ai=null;this.provider='';this.contextIds=[]}this.project=id;await this.restore(id);this.layout([]);this.emit();return this.state()}
   case 'state':return this.state();
   case 'context-enable':{const t=this.get(args.id),url=t.view.webContents.getURL();if(args.enabled&&!providerFor(url))throw Error('Автоконтекст пока поддерживает ChatGPT, Claude, Gemini и DeepSeek');t.contextOrigin=args.enabled?new URL(url).origin:'';t.view.webContents.send('page:context-enabled',!!t.contextOrigin);this.emit();return{enabled:!!t.contextOrigin}}
   case 'network-get':return this.network;
   case 'network-check':{
    const provider=Object.hasOwn(PROVIDERS,args.provider)?args.provider:'chatgpt',url=PROVIDERS[provider];
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);const started=Date.now();
    try{const response=await this.session.fetch(url,{signal:controller.signal,redirect:'follow'});await response.body?.cancel();return{provider,status:response.status,ok:response.ok,elapsed:Date.now()-started,mode:this.network.mode}}catch(e){return{provider,ok:false,error:controller.signal.aborted?'Таймаут подключения (12 секунд)':e.message,elapsed:Date.now()-started,mode:this.network.mode}}finally{clearTimeout(timer)}
   }
   case 'network-set':return this.setNetwork(args);
   case 'context-sharing':this.contextSharing={includeChats:args.includeChats===true};return this.contextSharing;
   case 'activate-provider':{const t=[...this.providers.values()].find(t=>t.id===args.id&&t.project===this.project);if(!t)throw Error('Диалог не принадлежит проекту');this.ai=t;this.provider=t.provider;this.layout(this.panels);return this.state()}
   case 'close-provider':{const entry=[...this.providers.entries()].find(([,t])=>t.id===args.id&&t.project===this.project);if(!entry)throw Error('Диалог не принадлежит проекту');this.providers.delete(entry[0]);if(this.ai===entry[1]){this.ai=null;this.provider=''}this.destroy(entry[1]);this.save();this.emit();return this.state()}
   case 'open':return this.open(args);
   case 'close':{const t=this.get(args.id);this.tabs.delete(t.id);this.destroy(t);this.save();this.emit();return this.state()}
   case 'navigate':{const t=this.get(args.id);t.url=address(args.url);await t.view.webContents.loadURL(t.url);return this.state()}
   case 'back':case 'forward':case 'reload':{const wc=this.get(args.id).view.webContents,h=wc.navigationHistory;if(action==='reload')wc.reload();else if(action==='back'&&h.canGoBack())h.goBack();else if(action==='forward'&&h.canGoForward())h.goForward();return this.state()}
   case 'layout':this.layout(args.panels);return true;
   case 'provider':{
    this.selectProvider(args.provider,args.thread||'main');return this.state();
   }
   case 'context':{
    const expected=this.project;
    const all=[...this.tabs.values(),...this.providers.values()].filter(t=>t.project===expected);
    const selected=args.all?all.filter(t=>t.id!==args.excludeId&&(args.includeChats===true||(!t.provider&&!providerFor(t.view.webContents.getURL()||t.url)))):[...new Set(Array.isArray(args.ids)?args.ids:[])].map(id=>this.get(id));
    let budget=120000;const deadline=Date.now()+10000,result=[];
    for(const t of selected){if(this.project!==expected)throw Error('Проект изменился во время чтения');const url=t.view.webContents.getURL();if(!/^https?:/.test(url)){result.push({id:t.id,url,error:'Страница ещё не загружена'});continue}
     if(budget<=0||Date.now()>=deadline){result.push({id:t.id,url,title:t.title,truncated:true,text:''});continue}
     let timer;try{const page=await Promise.race([t.view.webContents.executeJavaScript(readPage),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Таймаут чтения страницы')),Math.min(4000,Math.max(1,deadline-Date.now())))})]);if(this.project!==expected)throw Error('Проект изменился во время чтения');if(t.view.webContents.getURL()!==url){result.push({id:t.id,url,error:'Страница изменилась во время чтения'});continue}const text=String(page.text||'').slice(0,budget);budget-=text.length;result.push({id:t.id,...page,text,truncated:text.length<String(page.text||'').length,capturedAt:new Date().toISOString()})}catch(e){result.push({id:t.id,url,error:e.message})}finally{clearTimeout(timer)}
    }
    if(this.project!==expected)throw Error('Проект изменился во время чтения');return result;
   }
   case 'media-read':return require('./media.cjs').readMedia(this,args.id,args.url);
   case 'capture':{const t=this.get(args.id),img=await t.view.webContents.capturePage();return{url:t.view.webContents.getURL(),title:t.title,src:img.toDataURL(),...img.getSize()}}
   case 'copy-context':{if(typeof args.text!=='string'||args.text.length>150000)throw Error('Слишком большой контекст');clipboard.writeText(args.text);return true}
   default:throw Error('Неизвестное действие браузера');
  }
 }
 layout(panels){
  this.panels=Array.isArray(panels)?panels.slice(0,5):[];const contextIds=this.panels.filter(p=>p.id!=='ai'&&this.tabs.get(p.id)?.project===this.project&&this.tabs.get(p.id)?.lane!=='side').map(p=>p.id);if(contextIds.length)this.contextIds=contextIds;
  const desired=new Map();
  const [width,height]=this.win.getContentSize(),seen=new Set();
  for(const p of this.panels){const t=p.id==='ai'?this.ai:this.tabs.get(p.id)||[...this.providers.values()].find(t=>t.id===p.id);if(!t||seen.has(t.id)||(p.id!=='ai'&&t.project!==this.project))continue;seen.add(t.id);
   const {x,y,width:w,height:h}=p;if(![x,y,w,h].every(Number.isFinite)||w<1||h<1)continue;
   const left=Math.max(0,Math.min(width,Math.round(x))),top=Math.max(0,Math.min(height,Math.round(y)));
   const bounds={x:left,y:top,width:Math.max(0,Math.min(width-left,Math.round(w))),height:Math.max(0,Math.min(height-top,Math.round(h)))};
   if(bounds.width<1||bounds.height<1)continue;desired.set(t,bounds);
  }
  for(const t of [...this.tabs.values(),...this.providers.values()]){const bounds=desired.get(t),show=!!bounds;if(bounds&&JSON.stringify(bounds)!==JSON.stringify(t.bounds)){t.view.setBounds(bounds);t.bounds=bounds}if(show!==!!t.visible){t.view.setVisible(show);t.visible=show}}
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const t of [...this.tabs.values(),...this.providers.values()])if(!t.view.webContents.isDestroyed())t.view.webContents.close({waitForBeforeUnload:false});this.tabs.clear();this.providers.clear();this.ai=null}
}
module.exports={BrowserWorkspace,address,readPage};



