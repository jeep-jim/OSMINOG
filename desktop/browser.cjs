'use strict';
const {WebContentsView,session,dialog,clipboard}=require('electron');
const {randomUUID}=require('node:crypto');
const PROVIDERS={chatgpt:'https://chatgpt.com/',claude:'https://claude.ai/',gemini:'https://gemini.google.com/',deepseek:'https://chat.deepseek.com/'};
function address(value){
 const input=String(value||'').trim();if(!input)return 'https://www.google.com/';
 const candidate=/^[a-z][a-z\d+.-]*:/i.test(input)?input:/^[^\s/]+\.[^\s]+/.test(input)?'https://'+input:'https://www.google.com/search?q='+encodeURIComponent(input);
 const url=new URL(candidate);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Можно открыть только адрес HTTP или HTTPS без пароля');return url.href;
}
// Runs only on an explicitly selected webpage. Form values and password fields are not read.
const readPage=`(()=>{const root=document.body?.cloneNode(true);root?.querySelectorAll('script,style,noscript,input,textarea,select,[contenteditable],iframe').forEach(n=>n.remove());return {url:location.href,title:document.title,text:(root?.innerText||root?.textContent||'').slice(0,24000),selection:String(getSelection()).slice(0,12000)}})()`;
class BrowserWorkspace{
 constructor(win,store){
  this.store=store;this.snapshots={};this.restored=new Set();this.saveQueue=Promise.resolve();this.win=win;this.tabs=new Map();this.providers=new Map();this.project='';this.panels=[];this.contextIds=[];this.ai=null;this.provider='';this.disposed=false;
  // Browser profile remains on this device; no proxy, sync endpoint or screen relay.
  this.session=session.fromPartition('persist:osminog-browser');
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
 async restore(id){if(this.restored.has(id)||!this.store)return;if(!Object.keys(this.snapshots).length)this.snapshots=(await this.store.get('browserSessions')).browserSessions||{};this.restored.add(id);for(const item of this.snapshots[id]||[]){try{const t=this.make(address(item.url),id,!!item.provider);if(typeof item.id==='string'&&/^[a-f0-9-]{36}$/.test(item.id)){if(!item.provider){this.tabs.delete(t.id);this.tabs.set(item.id,t)}t.id=item.id}if(item.provider&&Object.hasOwn(PROVIDERS,item.provider)){t.provider=item.provider;t.thread=item.thread||'main';this.providers.set(JSON.stringify([id,t.provider,t.thread]),t)}else{t.lane=item.lane==='side'?'side':'main'}}catch{}}}
 emit(){if(!this.disposed&&!this.win.isDestroyed())this.win.webContents.send('browser:state',this.state())}
 state(){return{activeProvider:this.ai?.id||'',sessions:[...this.providers.values()].filter(t=>t.project===this.project).map(t=>({id:t.id,title:t.title,url:t.view.webContents.getURL()||t.url,loading:t.loading,session:true,provider:t.provider})),project:this.project,tabs:[...this.tabs.values()].filter(t=>t.project===this.project).map(t=>({id:t.id,lane:t.lane||'main',url:t.view.webContents.getURL()||t.url,title:t.title||t.url,loading:t.loading,error:t.error||'',back:t.view.webContents.navigationHistory.canGoBack(),forward:t.view.webContents.navigationHistory.canGoForward()})),provider:this.provider}}
 make(url,project,ai=false){
  const view=new WebContentsView({webPreferences:{session:this.session,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false}});
  const t={id:randomUUID(),project,url,title:url,view,loading:true,error:''},wc=view.webContents;
  view.setBounds({x:0,y:0,width:1000,height:800});view.setVisible(false);this.win.contentView.addChildView(view);
  wc.setWindowOpenHandler(({url:next})=>{try{if(t.project===this.project)this.open({url:address(next),lane:t.provider?'side':t.lane})}catch{}return{action:'deny'}});
  wc.on('will-navigate',(e,next)=>{try{address(next)}catch{e.preventDefault()}});
  wc.on('will-redirect',(e,next)=>{try{address(next)}catch{e.preventDefault()}});
  wc.on('page-title-updated',(_e,title)=>{t.title=title;this.emit()});
  wc.on('did-start-loading',()=>{t.loading=true;t.error='';this.emit()});
  wc.on('did-stop-loading',()=>{t.loading=false;this.emit()});
  wc.on('did-navigate',()=>{this.emit();this.save()});wc.on('did-navigate-in-page',()=>{this.emit();this.save()});
  wc.on('did-fail-load',(_e,code,description,_url,main)=>{if(main&&code!==-3){t.error=description;t.loading=false;this.emit()}});
  wc.on('render-process-gone',()=>{t.error='Вкладка остановлена. Нажмите обновить.';this.emit()});
  if(!ai)this.tabs.set(t.id,t);
  wc.loadURL(url).catch(e=>{t.error=e.message;this.emit()});return t;
 }
 get(id){const t=this.tabs.get(id);if(!t||t.project!==this.project)throw Error('Вкладка не принадлежит открытому проекту');return t}
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
    const ids=[...new Set(Array.isArray(args.ids)?args.ids:[])].slice(0,4);
    return Promise.all(ids.map(async id=>({id,...await this.get(id).view.webContents.executeJavaScript(readPage)})));
   }
   case 'capture':{const t=this.get(args.id),img=await t.view.webContents.capturePage();return{url:t.view.webContents.getURL(),title:t.title,src:img.toDataURL(),...img.getSize()}}
   case 'copy-context':{if(typeof args.text!=='string'||args.text.length>150000)throw Error('Слишком большой контекст');clipboard.writeText(args.text);return true}
   default:throw Error('Неизвестное действие браузера');
  }
 }
 layout(panels){
  this.panels=Array.isArray(panels)?panels.slice(0,5):[];const contextIds=this.panels.filter(p=>p.id!=='ai'&&this.tabs.get(p.id)?.project===this.project&&this.tabs.get(p.id)?.lane!=='side').map(p=>p.id);if(contextIds.length)this.contextIds=contextIds;
  for(const t of [...this.tabs.values(),...this.providers.values()])t.view.setVisible(false);
  const [width,height]=this.win.getContentSize(),seen=new Set();
  for(const p of this.panels){const t=p.id==='ai'?this.ai:this.tabs.get(p.id)||[...this.providers.values()].find(t=>t.id===p.id);if(!t||seen.has(t.id)||(p.id!=='ai'&&t.project!==this.project))continue;seen.add(t.id);
   const {x,y,width:w,height:h}=p;if(![x,y,w,h].every(Number.isFinite)||w<1||h<1)continue;
   const left=Math.max(0,Math.min(width,Math.round(x))),top=Math.max(0,Math.min(height,Math.round(y)));
   const bounds={x:left,y:top,width:Math.max(0,Math.min(width-left,Math.round(w))),height:Math.max(0,Math.min(height-top,Math.round(h)))};
   if(bounds.width<1||bounds.height<1)continue;t.view.setBounds(bounds);t.view.setVisible(true);
  }
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const t of [...this.tabs.values(),...this.providers.values()])if(!t.view.webContents.isDestroyed())t.view.webContents.close({waitForBeforeUnload:false});this.tabs.clear();this.providers.clear();this.ai=null}
}
module.exports={BrowserWorkspace,address,readPage};

