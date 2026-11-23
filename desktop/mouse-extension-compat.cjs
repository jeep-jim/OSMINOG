'use strict';
const {ID}=require('./mouse-extension-crx.cjs');
function extensionOrigin(value,id){try{const u=new URL(value);return u.protocol==='chrome-extension:'&&u.hostname===id&&!u.username&&!u.password&&!u.port;}catch{return false;}}
function matchHost(pattern,value){
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))return false;if(pattern==='<all_urls>')return true;
  const m=/^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern);if(!m||(m[1]!=='*'&&m[1]+':'!==u.protocol))return false;
  if(m[2]!=='*'&&m[2]!==u.hostname&&!(m[2].startsWith('*.')&&(u.hostname===m[2].slice(2)||u.hostname.endsWith(m[2].slice(1)))))return false;
  const escaped=m[3].replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');return new RegExp('^'+escaped+'$').test(u.pathname+u.search);
 }catch{return false;}
}
function installExtensionCompatibility({browser,win,dialog,isAvailable,onChanged=()=>{},onSelect=()=>{},Extensions}){
 const {app,ipcMain}=require('electron'),Class=Extensions||require('electron-chrome-extensions').ElectronChromeExtensions;
 const pages=()=>[...browser.tabs.values(),...browser.providers.values()];
 const pageFor=wc=>pages().find(page=>page.view.webContents===wc);
 const allowed=()=>{if(!isAvailable()||browser.disposed||win.isDestroyed())throw Error('Расширения недоступны в приватном режиме');};
 let instance,registering=0,syncingSelection=0;const tracked=new WeakSet(),watched=new WeakSet(),gestures=new WeakMap(),activeGrants=new Map();
 // Upstream echoes selectTab() through its implementation callback. Native
 // focus/action bookkeeping must not become a request to place a browser tab.
 const syncSelection=wc=>{syncingSelection++;try{instance.selectTab(wc);}finally{syncingSelection--;}};
 const select=wc=>{if(registering||syncingSelection)return;allowed();const page=pageFor(wc);if(!page||page.project!==browser.project)throw Error('Вкладка недоступна');syncSelection(wc);onSelect({id:page.id,desk:browser.state().desktopId});};
 instance=new Class({session:browser.session,
  createTab:async details=>{allowed();const url=details.url||'https://www.google.com/';let result;
   if(url.startsWith('chrome-extension://')){const parsed=new URL(url);result=browser.openManagedExtension({url,extensionId:parsed.hostname});}
   else result=browser.open({url,lane:'main'});
   const page=browser.get(result.id);track(page);if(details.active!==false)select(page.view.webContents);return[page.view.webContents,win];},
  selectTab:wc=>select(wc),
  // Upstream also invokes these callbacks from native destroyed/closed events.
  // Those are bookkeeping notifications, not extension requests to close again.
  removeTab:wc=>{if(wc.isDestroyed()||browser.disposed||win.isDestroyed())return;allowed();const page=pageFor(wc);if(page)void browser.command('close',{id:page.id});},
  createWindow:async()=>{throw Error('Создание отдельных окон расширением пока не поддерживается; используйте вкладки.');},
  removeWindow:async target=>{if(target.isDestroyed())return;throw Error('Расширение не может закрыть окно Mouse.');},
  requestPermissions:async(extension,request)=>{
   allowed();const manifest=extension.manifest,permissions=request.permissions||[],origins=request.origins||[];
   if(!Array.isArray(permissions)||!Array.isArray(origins)||permissions.length>100||origins.length>100) return false;
   const declared=new Set([...(manifest.permissions||[]),...(manifest.optional_permissions||[])]),declaredHosts=[...(manifest.host_permissions||[]),...(manifest.optional_host_permissions||[])];
   if(permissions.some(p=>typeof p!=='string'||!declared.has(p)||p==='nativeMessaging')||origins.some(p=>typeof p!=='string'||!declaredHosts.includes(p)))return false;
   const response=await dialog.showMessageBox(win,{type:'question',title:'Дополнительный доступ расширения',message:extension.name,detail:'Разрешения: '+(permissions.join(', ')||'нет')+'\nСайты: '+(origins.join(', ')||'нет'),buttons:['Запретить','Разрешить'],defaultId:0,cancelId:0,noLink:true});allowed();return response.response===1;
  },
  assignTabDetails:(details,wc)=>{
   // Metadata changes do not change tab order. Read the live order once,
   // without materializing every page twice or caching a stale tab index.
   let index=0;
   for(const collection of [browser.tabs,browser.providers])for(const page of collection.values()){
    const included=page.project===browser.project&&!page.managedExtension;
    if(page.view.webContents===wc){details.id=wc.id;details.incognito=false;details.discarded=wc.isDestroyed();details.index=included?index:-1;return;}
    if(included)index++;
   }
  }
 });
 // The package is pinned to 4.10.0. Its action/router internals are deliberately
 // confined to this adapter; no raw IPC or cross-session API is exposed to the
 // Mouse shell or remote pages. Test these hooks when changing the pin.
 const router=instance.ctx?.router,action=instance.api?.browserAction;
 if(!router||typeof router.onExtensionMessage!=='function'||typeof action?.activateClick!=='function'||typeof action?.getState!=='function')throw Error('Несовместимая версия слоя расширений');
 const permissionsOf=extension=>instance.api.permissions?.permissionMap?.get(extension.id)||{permissions:extension.manifest.permissions||[],origins:extension.manifest.host_permissions||[]};
 function hasHost(extension,url){const current=permissionsOf(extension);return [...current.origins,...current.permissions.filter(p=>p.includes('://')||p==='<all_urls>')].some(p=>matchHost(p,url));}
 function canReadTab(extension,value){return permissionsOf(extension).permissions.includes('tabs')||hasHost(extension,value?.url||'')||activeGrants.has(extension.id)&&activeGrants.get(extension.id)===value?.id;}
 function grantedTab(extension,wc){return activeGrants.has(extension.id)&&activeGrants.get(extension.id)===wc?.id;}
 function redact(extension,result){
  const item=value=>{if(!value||typeof value!=='object')return value;const copy={...value};if(!canReadTab(extension,copy)){delete copy.url;delete copy.pendingUrl;delete copy.title;delete copy.favIconUrl;}if(Array.isArray(copy.tabs))copy.tabs=copy.tabs.map(item);return copy;};
  return Array.isArray(result)?result.map(item):item(result);
 }
 const originalMessage=router.onExtensionMessage.bind(router);
 router.onExtensionMessage=async(event,id,method,...args)=>{
  allowed();if(!ID.test(id||''))throw Error('Запрос не принадлежит расширению');
  const session=event.type==='service-worker'?event.session:event.sender?.session;
  const source=event.type==='service-worker'?event.serviceWorker?.scope:event.senderFrame?.url;
  if(session!==browser.session||!extensionOrigin(source,id))throw Error('Источник запроса не совпал с расширением');
  const extension=session.extensions.getExtension(id);if(!extension)throw Error('Расширение выключено');
  const permission=permissionsOf(extension).permissions;
  if(method.startsWith('webNavigation.')&&!permission.includes('webNavigation'))throw Error('Нет разрешения webNavigation');
  if(method.startsWith('notifications.')&&!permission.includes('notifications'))throw Error('Нет разрешения notifications');
  if(method.startsWith('contextMenus.')&&!permission.includes('contextMenus'))throw Error('Нет разрешения contextMenus');
  if(method.startsWith('runtime.')&&/Native/.test(method))throw Error('Native Messaging пока не поддерживается');
  if(method==='permissions.remove')throw Error('Для отзыва доступа выключите расширение в меню Mouse.');
  if(method==='browserAction.setPopup'){
   const popup=args[0]?.popup;if(popup&&(/^[a-z][a-z\d+.-]*:/i.test(popup)||popup.startsWith('//'))&&!extensionOrigin(popup,id))throw Error('Всплывающее окно должно принадлежать расширению');
  }
  if(method==='tabs.create'||method==='tabs.update'){
   const index=method==='tabs.create'||typeof args[0]==='object'?0:1,details=args[index],url=details?.url;
   if(url!==undefined&&typeof url!=='string')throw Error('Некорректный адрес вкладки');
   if(typeof url==='string'&&url){
    // Upstream resolves relative URLs before loading them directly. Validate
    // that same resolved URL so //another-extension cannot bypass ownership
    // and tabs.update cannot bypass Mouse's ordinary navigation schemes.
    const target=new URL(url,'chrome-extension://'+id+'/');
    if(target.protocol==='chrome-extension:'){
     if(!extensionOrigin(target.href,id))throw Error('Вкладка расширения должна принадлежать вызывающему расширению');
    }else if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('Можно открыть только адрес HTTP или HTTPS без пароля');
    args=[...args];args[index]={...details,url:target.href};
   }
  }
  if(method==='permissions.request'){
   const recent=event.type==='frame'?gestures.get(event.sender):null;
   if(!recent||Date.now()-recent>8000)throw Error('Дополнительный доступ запрашивается после нажатия в расширении.');gestures.delete(event.sender);
  }
  if(method==='tabs.insertCSS'){
   const wc=pages().map(p=>p.view.webContents).find(w=>w.id===args[0]);if(!wc||!hasHost(extension,wc.getURL())&&!grantedTab(extension,wc))throw Error('Расширению не предоставлен доступ к этому сайту');
  }
  if(method.startsWith('cookies.')){
   if(!permission.includes('cookies'))throw Error('Нет разрешения cookies');
   const url=args[0]?.url;if(url&&!hasHost(extension,url))throw Error('Нет доступа к cookies этого сайта');
  }
  let privateQuery;
  if(method==='tabs.query'&&!permission.includes('tabs')&&args[0]&&(args[0].url||args[0].title)){
   privateQuery={url:args[0].url,title:args[0].title};args=[{...args[0]},...args.slice(1)];delete args[0].url;delete args[0].title;
  }
  let result=await originalMessage(event,id,method,...args);
  if(privateQuery&&Array.isArray(result))result=result.filter(tab=>canReadTab(extension,tab)&&(!privateQuery.url||(Array.isArray(privateQuery.url)?privateQuery.url:[privateQuery.url]).some(pattern=>matchHost(pattern,tab.url)))&&(!privateQuery.title||new RegExp('^'+privateQuery.title.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$').test(tab.title||'')));
  if(/^(?:tabs\.(?:get|getAllInWindow|getCurrent|query|create|update)|windows\.(?:get|getCurrent|getLastFocused|getAll))$/.test(method))return redact(extension,result);
  if(method==='cookies.getAll'&&Array.isArray(result))return result.filter(c=>hasHost(extension,(c.secure?'https://':'http://')+String(c.domain).replace(/^\./,'')+(c.path||'/')));
  return result;
 };
 const originalListener=router.addListener.bind(router);
 router.addListener=(listener,id,event)=>{if(!ID.test(id||'')||listener.type==='frame'&&!extensionOrigin(listener.host?.getURL(),id))return;return originalListener(listener,id,event);};
 // The library broadcasts tab/cookie metadata without Chrome's permission
 // checks. Copy and route each event once per extension, retaining native event
 // payloads only for recipients with the corresponding permission and host.
 const originalSend=router.sendEvent.bind(router);
 router.sendEvent=(target,event,...args)=>{
  if(!isAvailable())return;
  const ids=target?[target]:[...new Set((router.listeners.get(event)||[]).map(listener=>listener.extensionId))];
  for(const id of ids){
   const extension=browser.session.extensions.getExtension(id);if(!extension)continue;const permission=permissionsOf(extension).permissions;let payload=args;
   if(event==='cookies.onChanged'){
    const cookie=args[0]?.cookie;if(!permission.includes('cookies')||!cookie||!hasHost(extension,(cookie.secure?'https://':'http://')+String(cookie.domain).replace(/^\./,'')+(cookie.path||'/')))continue;
   }
   if(event.startsWith('webNavigation.')&&!permission.includes('webNavigation'))continue;
   if(event==='tabs.onUpdated'){
    const tab=args[2]||{id:args[0],url:args[1]?.url};payload=[args[0],{...args[1]},redact(extension,tab)];if(!canReadTab(extension,tab))for(const key of ['url','pendingUrl','title','favIconUrl'])delete payload[1][key];
   }else if(event==='tabs.onCreated'||event==='browserAction.onClicked'||event.startsWith('windows.'))payload=args.map(value=>redact(extension,value));
   else if(event==='contextMenus.onClicked')payload=[args[0],redact(extension,args[1])];
   originalSend(id,event,...payload);
  }
 };
 // Preserve the sender when registering service-worker listeners: upstream's
 // listener record drops its scope, so checking only addListener is too late.
 const delegateRestores=[];
 for(const [property,channel]of [['onAddListener','crx-add-listener'],['onRemoveListener','crx-remove-listener']]){
  const delegate=router.delegate,original=delegate?.[property];if(typeof original!=='function')continue;
  const bound=(event,id,name)=>{const session=event.type==='service-worker'?event.session:event.sender?.session,source=event.type==='service-worker'?event.serviceWorker?.scope:event.senderFrame?.url;if(session===browser.session&&ID.test(id||'')&&extensionOrigin(source,id))return original(event,id,name);};
  ipcMain.removeListener(channel,original);delegate[property]=bound;ipcMain.on(channel,bound);delegateRestores.push(()=>{ipcMain.removeListener(channel,bound);delegate[property]=original;ipcMain.on(channel,original);});
 }
 function watchContents(_event,wc){if(!wc||wc.session!==browser.session||watched.has(wc))return;watched.add(wc);const input=(_event,event)=>{if((event.type==='mouseDown'&&event.button==='left')||(event.type==='keyDown'&&['Enter',' ','Space'].includes(event.key)))gestures.set(wc,Date.now());};wc.on('before-mouse-event',input);wc.on('before-input-event',input);}
 app.on('web-contents-created',watchContents);
 function track(page){const wc=page.view.webContents;if(tracked.has(wc)||page.managedExtension||wc.isDestroyed())return;tracked.add(wc);registering++;try{instance.addTab(wc,win);}finally{registering--;}wc.on('focus',()=>{if(isAvailable())syncSelection(wc);});wc.on('did-start-navigation',(_e,_url,inPlace,main)=>{if(main!==false&&!inPlace)for(const [id,target]of activeGrants)if(target===wc.id)activeGrants.delete(id);});}
 const make=browser.make.bind(browser);browser.make=(...args)=>{const page=make(...args);if(pageFor(page.view.webContents))track(page);else queueMicrotask(()=>{if(pageFor(page.view.webContents)&&!page.view.webContents.isDestroyed())track(page);});return page;};for(const page of pages())track(page);
 let updateQueued=false;const changed=()=>{if(updateQueued)return;updateQueued=true;queueMicrotask(()=>{updateQueued=false;try{onChanged();}catch{}});};
 browser.session.extensions.on('extension-loaded',changed);browser.session.extensions.on('extension-unloaded',changed);
 instance.on('browser-action-popup-created',popup=>{watchContents(null,popup.browserWindow?.webContents||popup.webContents);});
 return Object.freeze({
  instance,
  activate(id,{tabId,anchor}={}){allowed();if(!ID.test(id||'')||!browser.session.extensions.getExtension(id))throw Error('Расширение выключено');
   const page=typeof tabId==='string'?pages().find(p=>p.id===tabId&&!p.managedExtension):null;if(page)syncSelection(page.view.webContents);
   const current=page?.view.webContents||instance.ctx.store.getActiveTabOfCurrentWindow();if(!current||current.isDestroyed())throw Error('Сначала откройте страницу для расширения');
   const ext=browser.session.extensions.getExtension(id);if(ext.manifest.permissions?.includes('activeTab'))activeGrants.set(id,current.id);
   const popup=action.getPopupUrl(id,current.id);if(popup&&!extensionOrigin(popup,id))throw Error('Всплывающее окно должно принадлежать расширению');
   const bounds=win.getContentBounds(),rect=anchor&&Object.values(anchor).every(Number.isFinite)?anchor:{x:bounds.width-40,y:bounds.height-28,width:24,height:24};
   action.activateClick({eventType:'click',extensionId:id,tabId:current.id,anchorRect:{x:Math.max(0,Math.min(bounds.width-1,rect.x)),y:Math.max(0,Math.min(bounds.height-1,rect.y)),width:Math.max(1,Math.min(80,rect.width)),height:Math.max(1,Math.min(80,rect.height))},alignment:'top right'});return true;
  },
  actionState(){return action.getState();},
  contextMenu(wc,params){return isAvailable()?instance.getContextMenuItems(wc,params):[];},
  suspend(){action.popup?.destroy();action.popup=undefined;activeGrants.clear();},
  dispose(){app.removeListener('web-contents-created',watchContents);browser.session.extensions.removeListener('extension-loaded',changed);browser.session.extensions.removeListener('extension-unloaded',changed);for(const restore of delegateRestores)restore();}
 });
}
module.exports={installExtensionCompatibility,extensionOrigin,matchHost};
