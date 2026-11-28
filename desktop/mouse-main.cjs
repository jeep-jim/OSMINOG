'use strict';
const {app,BrowserWindow,ipcMain,Menu,session,nativeTheme,shell,dialog,systemPreferences}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const isMac=process.platform==='darwin',isWindows=process.platform==='win32',isLinux=process.platform==='linux';
if(!isMac&&!isWindows&&!isLinux)throw Error('Mouse Browser supports macOS, Windows and Linux');
if(isLinux&&process.arch!=='x64')throw Error('This Mouse Browser Linux build requires x64');
if(isWindows&&process.arch!=='x64')throw Error('This Mouse Browser Windows build requires x64');
app.setName(isMac?'Mouse':'Mouse Browser');
// Apply before ready so native root/nested page scrollbars stay hidden.
require('./mouse-scrollbars.cjs').configure(app);
if(isLinux)require('./mouse-linux-compat.cjs').configure(app);
// Retain Mac profile/logins. The first Windows Mouse release has its own stable
// profile and installer identity; legacy Windows Trader data is never replaced.
if(isMac)app.setPath('userData',path.join(app.getPath('appData'),'Trader OS'));
else{app.setPath('userData',path.join(app.getPath('appData'),'Mouse Browser'));if(isWindows)app.setAppUserModelId('black.mouse.browser.windows');}
const test=process.env.CI==='true'&&process.env.MOUSE_TEST_PROFILE&&path.isAbsolute(process.env.MOUSE_TEST_PROFILE);
if(test)app.setPath('userData',process.env.MOUSE_TEST_PROFILE);
fs.mkdirSync(app.getPath('userData'),{recursive:true});
// The legacy guest keeps its exact path and partitions. Accounts select their
// own userData/sessionData before Chromium or any persistent session exists.
const ownsProfile=app.requestSingleInstanceLock();
const profileContext=isMac?new (require('./mouse-profile-context.cjs').MouseProfileContext)(app.getPath('userData')):null;
if(profileContext&&profileContext.directory!==profileContext.base){app.setPath('userData',profileContext.directory);app.setPath('sessionData',profileContext.directory);}
const logFile=path.join(app.getPath('userData'),'mouse-startup.log');
function log(s){fs.appendFileSync(logFile,new Date().toISOString()+' '+s+'\n');console.log(s)}
let paneFocus;
let win,browser,store,exitController,libraryService,overlayGate,startService,globalCapture,privateMode,localCaptures,desktopService,pageZoom,imageDrag,progress,progressBridge,documentService,documentPreparation,documentClosing,settingsService,importService,adBlock,adBlockExceptions,workspaceGestures,inputLanguage,flashService,profileService,accountClient,accountSync,accountKeychain;
let flashPanelWanted=false,deviceIdentityPromise=null,accountTransitionId=null,accountProfileLocked=false,accountLogoutSync=false;
const serviceConfig=isMac?require('./mouse-service-config.cjs'):{};
const accountConfig=test?{...serviceConfig,origin:process.env.MOUSE_ACCOUNT_ORIGIN||serviceConfig.origin,serverPublicKey:process.env.MOUSE_ACCOUNT_PUBLIC_KEY||serviceConfig.serverPublicKey}:serviceConfig;
const getDeviceIdentity=()=>deviceIdentityPromise||(deviceIdentityPromise=(async()=>{const {safeStorage}=require('electron');if(!safeStorage.isEncryptionAvailable())throw Error('Защищённое хранилище устройства недоступно.');return require('./mouse-flash-identity.cjs').loadIdentity({directory:path.join(profileContext.base,'mouse-flash','identity'),name:require('node:os').hostname().replace(/[\x00-\x1f\x7f]/g,'').slice(0,100)||'Mouse',protect:value=>safeStorage.encryptString(value),unprotect:value=>safeStorage.decryptString(value)});})().catch(error=>{deviceIdentityPromise=null;throw error;}));
const ipcRouter=require('./mouse-private-core.cjs').installIPCSwitch(ipcMain,()=>win?.webContents);
const entry=pathToFileURL(path.join(__dirname,'mouse/index.html')).href;
async function flushCurrentProfile(){
 importService?.cancelPending();
 if(win?.webContents.getURL()===entry)await win.webContents.executeJavaScript('globalThis.MouseFlush?.()');
 if(privateMode?.current)await privateMode.dispose();
 if(browser){await browser.save();await browser.saveQueue;await browser.session.cookies.flushStore();browser.session.flushStorageData();}
 if(libraryService)await libraryService.flush();
 await desktopService?.flush();await settingsService?.flush();await profileService?.flush();
 await adBlockExceptions?.flush();await adBlock?.flush();await importService?.flush();
 if(store)await store.queue;
}
async function releaseDocumentsUI(){if(!win||win.isDestroyed()||win.webContents.isDestroyed()||win.webContents.getURL()!==entry)return;try{await require('./mouse-lifecycle.cjs').bounded(win.webContents.executeJavaScript('globalThis.MouseDocumentsTransaction?.(false)'),7000,'Document controls');}catch(error){log('DOCUMENT_UI_RELEASE_FAILED '+error.message);}}
function prepareDocuments(){
 if(flashService?.window)return flashService.pause().then(()=>prepareDocuments());
 if(!documentService)return Promise.resolve();if(documentPreparation)return documentPreparation;const bounded=require('./mouse-lifecycle.cjs').bounded;
 documentPreparation=(async()=>{try{
  await documentClosing;
  if(win.webContents.getURL()===entry){await bounded(win.webContents.executeJavaScript('globalThis.MouseDocumentsTransaction?.(true)'),7000,'Document controls');await bounded(win.webContents.executeJavaScript('globalThis.MouseFlushDocuments?.()'),7000,'Document draft');}
  await documentService.prepareExit(id=>bounded(win.webContents.executeJavaScript('globalThis.MouseExportDocument('+JSON.stringify(id)+')'),30000,'Document export'));
  // Success stays inert until privacy destroys this shell or quitting finishes.
  // Cancellation, failed persistence and failed update installation release it.
 }catch(error){await releaseDocumentsUI();throw error;}})().finally(()=>{documentPreparation=null;});return documentPreparation;
}
function closeDocumentTab(id,commit){
 if(documentPreparation)throw Error('Завершите выбор сохранения документов');
 const previous=documentClosing,bounded=require('./mouse-lifecycle.cjs').bounded;
 const work=(async()=>{await previous;try{
  if(win.webContents.getURL()!==entry)throw Error('Редактор документа недоступен');
  await bounded(win.webContents.executeJavaScript('globalThis.MouseDocumentsTransaction?.(true)'),7000,'Document controls');
  await bounded(win.webContents.executeJavaScript('globalThis.MouseFlushDocuments?.()'),7000,'Document draft');
  return await documentService.closeDocument(id,documentId=>bounded(win.webContents.executeJavaScript('globalThis.MouseExportDocument('+JSON.stringify(documentId)+')'),30000,'Document export'),commit);
 }finally{await releaseDocumentsUI();}})();
 const pending=work.catch(()=>{});documentClosing=pending;void pending.finally(()=>{if(documentClosing===pending)documentClosing=null;});return work;
}
function show(){if(accountProfileLocked||!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus()}
function trusted(e){if(!require('./trust.cjs').trustedFrame(e,win,entry))throw Error('Untrusted frame')}
if(!ownsProfile)app.quit();
app.on('second-instance',show);app.on('activate',show);
if(ownsProfile)app.whenReady().then(async()=>{
 store=new (require('./storage.cjs').Store)(app.getPath('userData'));
 if(isMac){
  accountKeychain=new (require('./mouse-account-keychain.cjs').MouseAccountKeychain)({namespace:profileContext.namespace});await accountKeychain.ready;
  const canAccount=()=>!privateMode?.current&&!privateMode?.busy&&(!exitController?.isClosing()||accountTransitionId!==null)&&(!accountProfileLocked||accountLogoutSync);
  accountClient=new (require('./mouse-account-client.cjs').MouseAccountClient)({directory:profileContext.control,origin:accountConfig.origin,serverPublicKey:accountConfig.serverPublicKey,getIdentity:getDeviceIdentity,keychain:accountKeychain,allowLoopback:!!test,
   protect:value=>{const {safeStorage}=require('electron');if(!safeStorage.isEncryptionAvailable())throw Error('Защищённое хранилище Mouse ID недоступно.');return safeStorage.encryptString(value);},unprotect:value=>require('electron').safeStorage.decryptString(value),canUse:canAccount,
   onState:state=>{if(!privateMode?.current&&!privateMode?.busy&&win&&!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('mouse:account-state',state);},
   beforeLogout:async()=>{
    await prepareDocuments();await flashService?.pause();accountProfileLocked=true;win?.hide();
    try{await accountSync?.stop();await flushCurrentProfile();}catch(error){accountProfileLocked=false;accountSync?.start();show();await releaseDocumentsUI();throw error;}
    // Publish the final lightweight edits before deleting credentials. The
    // hidden, locked shell cannot issue account operations while this native
    // request runs. Offline logout still completes; local edits remain saved.
    const id=accountClient.snapshot()?.accountId;
    if(id&&id===profileContext.active){
     accountLogoutSync=true;const finalSync=new (require('./mouse-config-sync.cjs').MouseConfigSync)({store,account:accountClient,canSync:()=>accountLogoutSync&&accountClient.snapshot()?.accountId===id});
     try{await require('./mouse-lifecycle.cjs').bounded(finalSync.tick(),3500,'Final account sync');}catch{log('MOUSE_ACCOUNT_FINAL_SYNC_DEFERRED');}
     finally{await finalSync.stop();accountLogoutSync=false;}
    }
   },
   onActivate:async(id,options={})=>{
    const {Store}=require('./storage.cjs'),sync=require('./mouse-config-sync.cjs');
    accountTransitionId=id;
    try{
    await flashService?.pause();await accountSync?.stop();
    const target=id===profileContext.active?store:new Store(profileContext.directoryFor(id));
    // A new registration can take this guest's lightweight setup. A login to
    // somebody else's existing ID never imports the previous guest's settings.
    if(id!==profileContext.active){if(win.webContents.getURL()===entry)await win.webContents.executeJavaScript('globalThis.MouseFlush?.()');await browser.save();await libraryService.flush();const seed=options.registration?sync.exportWorkspace(await store.get(null)):sync.exportWorkspace({});await profileContext.seed(id,seed);}
    await exitController.request({beforeQuit:async()=>{
     win.hide();const targetSync=new sync.MouseConfigSync({store:target,account:accountClient});const result=await targetSync.tick({apply:true});await targetSync.stop();if(['error','retry'].includes(result.phase))throw Error('Не удалось получить настройки Mouse ID. Повторите вход или синхронизацию.');
     const current=accountClient.snapshot();if(!current||current.accountId!==id)throw Error('Вход в Mouse ID прерван.');
     const presentation={v:1,name:current.name,avatar:current.avatar,certificate:current.certificate};await require('./mouse-profile-context.cjs').writePrivateJSON(path.join(profileContext.directoryFor(id),'mouse-profile','profile.json'),presentation);
     const previous=profileContext.active;await profileContext.select(id);try{app.relaunch();}catch(error){await profileContext.select(previous);throw error;}
    }});if(!exitController.isClosing()){accountSync?.start();throw Error('Переключение профиля отменено.');}
    }finally{if(!exitController?.isClosing())accountTransitionId=null;}
   },
   onLogout:async()=>{
    // Credentials have already gone. Persist the clean guest selector before
    // another exit gate can fail; never reveal the signed-out profile again.
    try{await profileContext.select(null,{isolateGuest:true,freshGuest:true});}catch{log('MOUSE_ACCOUNT_SIGNOUT_SELECTOR_FAILED');if(!test)dialog.showErrorBox('Mouse ID','Вы вышли из аккаунта. Профиль закрыт, но не удалось сохранить переключение. Проверьте свободное место и запустите Mouse снова.');app.exit(1);return;}
    await exitController.request({beforeQuit:async()=>{app.relaunch();}});
    if(!exitController.isClosing()){app.relaunch();app.exit(0);}
   }
  });await accountClient.ready;
  if(profileContext.active){
   if(accountClient.touchIdEnabled&&!accountClient.tokens){try{await accountClient.unlockStoredSession();}catch{}}
   else if(accountClient.tokens&&!accountClient.snapshot()){await accountClient.restore();}
   const unlocked=accountClient.record?.account?.id===profileContext.active&&accountClient.tokens?.refreshExpiresAt>Date.now()&&!accountClient.recoveryPending;
   if(!unlocked){
    await profileContext.select(null,{isolateGuest:true,freshGuest:true});
    if(test&&process.argv.includes('--mouse-645-account-smoke'))await require('./mouse-645-account-smoke.cjs').recordStartupGuard({app,profileContext,accountState:accountClient.state()});
    accountClient.dispose();app.relaunch();app.exit(0);return;
   }
  }
  // Apply already-received metadata before creating pages. Network polling
  // during browsing only stages changes; it never tears down a live web form.
  if(profileContext.active){const sync=require('./mouse-config-sync.cjs'),data=await store.get(null),cached=data[sync.CACHE];if(cached?.accountId===profileContext.active&&cached.cloud&&cached.local){try{const merged=sync.mergeWorkspace(cached.local,sync.exportWorkspace(data),cached.cloud);await store.set({...sync.importWorkspace(data,merged),[sync.CACHE]:{...cached,local:cached.cloud}});}catch{log('MOUSE_SYNC_CACHE_NOT_APPLIED');}}}
 }
 // Set Chromium's preference before any restored page makes its first request.
 // A fixed light Dock icon is independent of this website/UI preference.
 const startupPreferences=(await store.get('quadroPreferences')).quadroPreferences||{};
 nativeTheme.themeSource=startupPreferences.theme==='dark'?'dark':'light';
 // Owner requirement: Dock always uses the black mouse on white, irrespective of theme.
 const updateDock=()=>{const theme='light';if(isMac)app.dock.setIcon(path.join(__dirname,'icons/mouse-browser-'+theme+'.png'));updateDock.appliedTheme=theme;};updateDock();
 nativeTheme.on('updated',updateDock);app.on('will-quit',()=>nativeTheme.removeListener('updated',updateDock));
 // Create genuinely untitled from the outset: roundedCorners=true otherwise
 // retains AppKit Titled even for frame:false and creates a fullscreen blank bar.
 // The native module rounds the normal root view, without changing style masks.
 win=new BrowserWindow({title:isMac?'Mouse':'Mouse Browser',width:1440,height:960,minWidth:800,minHeight:600,show:false,backgroundColor:nativeTheme.shouldUseDarkColors?'#10151e':'#f3f5f9',frame:false,fullscreenable:true,roundedCorners:!isMac,icon:path.join(__dirname,'icons/mouse-browser-light.png'),autoHideMenuBar:!isMac,kiosk:false,simpleFullscreen:false,alwaysOnTop:false,webPreferences:{preload:path.join(__dirname,'mouse-preload.cjs'),additionalArguments:['--mouse-version='+app.getVersion(),...(test?['--mouse-test']:[])],nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
 if(test)win.mouseDockThemeForTest=()=>updateDock.appliedTheme;
 exitController=require('./mouse-lifecycle.cjs').install({app,win,log,prepare:prepareDocuments,onError:error=>{if(accountProfileLocked)return;if(!privateMode?.busy)void releaseDocumentsUI();if(!test&&error.code!=='MOUSE_DOCUMENT_CANCEL')dialog.showErrorBox('Mouse Browser — данные не сохранены','Браузер оставлен открытым. Повторите выход после устранения ошибки: '+error.message)},canShowOnError:()=>!accountProfileLocked,flush:flushCurrentProfile});
 win.on('closed',()=>log('MOUSE_WINDOW_CLOSED'));
 app.on('will-quit',()=>log('MOUSE_APP_QUIT'));
 win.on('leave-full-screen',()=>log('MOUSE_LEFT_FULLSCREEN'));
 paneFocus=new (require('./mouse-pane-focus.cjs').PaneFocus)({win,restore:()=>{if(!win.isDestroyed())win.webContents.send('mouse:menu','restore-pane')}});
 const flashEnabled=isMac;
 if(flashEnabled)flashService=new (require('./mouse-flash.cjs').FlashService)({electron:require('electron'),directory:path.join(app.getPath('userData'),'mouse-flash'),identity:getDeviceIdentity,account:accountClient,canOpen:()=>!privateMode?.current&&!privateMode?.busy&&!exitController.isClosing(),broker:test&&process.env.MOUSE_FLASH_BROKER||serviceConfig.broker,stunServers:test&&process.env.MOUSE_FLASH_STUN?process.env.MOUSE_FLASH_STUN.split(',').map(x=>x.trim()).filter(Boolean):serviceConfig.stunServers,allowLoopback:!!test});
 if(isMac)profileService=new (require('./mouse-profile.cjs').MouseProfile)({directory:path.join(app.getPath('userData'),'mouse-profile'),electron:require('electron'),window:win,canUse:()=>!privateMode?.current&&!privateMode?.busy&&!exitController.isClosing(),flashAvailable:()=>!!flashService,serverPublicKey:accountConfig.serverPublicKey,getIdentity:getDeviceIdentity});
 if(profileService){
  ipcMain.handle('mouse:profile',async(event,action,payload)=>{trusted(event);const state=await profileService.call(action,payload);if(['set','choose-avatar','remove-avatar'].includes(action)&&!state.canceled&&accountClient.snapshot()){await accountClient.updateProfile(state);await profileService.acceptCertificate(accountClient.snapshot().certificate);}return profileService.state();});
  ipcMain.handle('mouse:account',async(event,action,payload={})=>{trusted(event);if((exitController.isClosing()||accountProfileLocked)&&action!=='state')throw Error('Переключение профиля уже выполняется.');if(typeof action!=='string'||!payload||typeof payload!=='object'||Array.isArray(payload)||Buffer.byteLength(JSON.stringify(payload))>16384)throw Error('Некорректный запрос Mouse ID');if(action==='sync-now'){if(accountClient.recoveryPending)throw Error('Сначала сохраните код восстановления.');const id=accountClient.snapshot()?.accountId;if(!id)throw Error('Войдите в Mouse ID.');if(profileContext.active!==id){await accountClient.onActivate(id);return accountClient.state();}if(accountSync){await accountSync.tick();if(!accountSync.state().pendingRemote)return accountClient.state();}await accountClient.onActivate(id);return accountClient.state();}try{return await accountClient.operation(action,payload,action==='register'?await profileService.state():{});}catch(error){if(error.code==='ACCOUNT_SIGNOUT_BLOCKED'){accountProfileLocked=false;accountSync?.start();show();await releaseDocumentsUI();}throw error;}});
  ipcMain.handle('mouse:open-flash',event=>{trusted(event);win.webContents.send('mouse:menu','flash');return{ok:true};});
  ipcMain.handle('mouse:flash-panel',async(event,action,payload={})=>{trusted(event);if(!flashService||privateMode?.current||privateMode?.busy||exitController.isClosing())throw Error('Флэш недоступен в этом режиме.');if(action==='close'){flashPanelWanted=false;flashService.setPanelVisible(false);return{ok:true};}if(!['open','bounds'].includes(action))throw Error('Неизвестное действие Флэш');flashPanelWanted=payload.visible!==false;const theme=payload.theme==='dark'?'dark':'light';if(action==='open')await flashService.open({parentWindow:win,bounds:payload.bounds,theme});else{flashService.setPanelBounds(payload.bounds);flashService.setAppearance(theme);}flashService.setPanelVisible(flashPanelWanted&&!overlayGate?.blocked);return{ok:true};});
 }
 const openFlash=()=>{if(flashService&&!win.isDestroyed())win.webContents.send('mouse:menu','flash');};
 if(flashService)app.once('will-quit',()=>void flashService.dispose());
 const send=name=>{show();if(win.webContents.getURL()===entry)win.webContents.send('mouse:menu',name)};
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  isMac?{label:'Mouse',submenu:[{role:'about'},{label:'Проверить обновление…',click:()=>send('updates')},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]}:{label:'Mouse Browser',submenu:[{label:'О Mouse Browser',role:'about'},{label:'Проверить обновление…',click:()=>send('updates')},{type:'separator'},{label:'Завершить браузер',accelerator:'Ctrl+Q',click:()=>void exitController.request()}]},
  {label:'Файл',submenu:[...(flashEnabled?[{label:'Флэш — передать файлы…',click:openFlash},{type:'separator'}]:[]),{label:'Открыть документ…',accelerator:'CommandOrControl+O',click:()=>send('open-document')},{type:'separator'},{label:isMac?'Скриншот экрана Mac · ⌃A':'Скриншот экрана · Ctrl+Alt+S',click:()=>void globalCapture?.request()},{label:'Скриншот окон браузера',click:()=>send('screenshot')},{label:'Инкогнито / обычный режим',accelerator:'CommandOrControl+Shift+N',click:()=>send('privacy')},{label:'Новый рабочий стол',accelerator:'CommandOrControl+N',click:()=>send('new-desktop')},{label:'Новая вкладка',accelerator:'CommandOrControl+T',click:()=>send('new-tab')},{label:'Адрес страницы',accelerator:'CommandOrControl+L',click:()=>send('address')},{label:'Вернуть закрытую вкладку',accelerator:'CommandOrControl+Shift+T',click:()=>send('reopen')},{label:'Новое окно в раскладке',accelerator:'CommandOrControl+Alt+T',click:()=>send('split-x')},{label:'Закрыть вкладку',accelerator:'CommandOrControl+W',click:()=>send('close-tab')}]},
  {label:'Правка',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'pasteAndMatchStyle'},{role:'selectAll'}]},
  {label:'Вид',submenu:[{label:'Обновить страницу',accelerator:'CommandOrControl+R',click:()=>send('reload')},{label:'Показать / скрыть ИИ',accelerator:'CommandOrControl+Shift+I',click:()=>send('ai')},{label:'Сменить тему',click:()=>send('theme')},{type:'separator'},{label:'Масштаб всех вкладок: 100%',accelerator:'CommandOrControl+0',click:()=>send('zoom-reset')},{label:'Увеличить все вкладки',accelerator:'CommandOrControl+Plus',click:()=>send('zoom-in')},{label:'Уменьшить все вкладки',accelerator:'CommandOrControl+-',click:()=>send('zoom-out')},{type:'separator'},{role:'togglefullscreen',...(isWindows?{accelerator:'F11'}:{})}]},
  {label:'История',submenu:[{label:'Показать историю',accelerator:'CommandOrControl+Y',click:()=>send('history')},{label:'Сохранённые запросы',click:()=>send('searches')},{label:'Закладки',accelerator:'CommandOrControl+Alt+B',click:()=>send('bookmarks')},{label:'Добавить закладку',accelerator:'CommandOrControl+D',click:()=>send('bookmark')},{label:'Загрузки',accelerator:'CommandOrControl+Shift+J',click:()=>send('downloads')}]},
  {label:'Окно',submenu:isMac?[{role:'minimize'},{role:'zoom'},{type:'separator'},{role:'front'}]:[{role:'minimize'},{label:'Развернуть / восстановить',click:()=>{if(win.isMaximized())win.unmaximize();else win.maximize();}}]}
 ]));
 // No menu-bar status item: the Dock icon and native application menu are sufficient.
 app.setAboutPanelOptions({applicationName:isMac?'Mouse':'Mouse Browser',applicationVersion:app.getVersion(),copyright:isMac?'Mouse · mouse.black':'Mouse Browser · mouse.black',credits:isMac?'mouse.black · macOS Apple Silicon':isLinux?'mouse.black · Linux x64':'mouse.black · Windows x64'});
 session.defaultSession.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));
 adBlockExceptions=await new (require('./mouse-adblock-exceptions.cjs').AdBlockExceptions)({store,isPrivate:()=>!!(privateMode?.current||privateMode?.busy),report:log,notify:state=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('mouse:adblock-exceptions-state',state);}}).initialize();
 adBlock=new (require('./mouse-adblock.cjs').MouseAdBlock)({directory:path.join(app.getPath('userData'),'mouse-adblock'),exceptions:adBlockExceptions,isPrivate:()=>!!(privateMode?.current||privateMode?.busy),getWebContents:id=>require('electron').webContents.fromId(id),report:log,
  notify:state=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('mouse:adblock-state',state);}});
 settingsService=await require('./mouse-settings.cjs').install({store,win,ipcMain,trusted,isPrivate:()=>!!(privateMode?.current||privateMode?.busy),onChange:values=>{adBlock.setEnabled(values.blockAds);browser?.mousePageTheme?.setEnabled(values.syncWebsiteTheme);}});
 await adBlock.initialize(settingsService.state().blockAds);
 adBlock.attach(session.defaultSession);
 ipcMain.handle('mouse:adblock-state',event=>{trusted(event);return adBlock.state();});
 require('./mouse-adblock-subscriptions-ipc.cjs').install({ipcMain,trusted,service:adBlock,isPrivate:()=>!!(privateMode?.current||privateMode?.busy)});
 app.once('will-quit',()=>adBlock.dispose());
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault()});
 browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);browser.mouseRoundedPanes=true;browser.mouseTrackPage=wc=>adBlock.track(wc);browser.mouseAdBlockExceptions=adBlockExceptions;browser.mouseAdBlockEnabled=()=>adBlock.enabled;
 adBlock.attach(browser.session);
 require('./mouse-page-tone.cjs').install(browser,{report:log});
 require('./mouse-page-theme.cjs').install(browser,{ipcMain,enabled:settingsService.state().syncWebsiteTheme,report:log});
 if(isMac){browser.mouseCornerMask=rects=>require('./mouse-native-menu.node').paneCorners(rects);}
 else if(isWindows){browser.mouseCornerMask=rects=>{if(!win.isDestroyed())require('./mouse-platform.node').paneCorners(win.getNativeWindowHandle(),rects);};}
 else if(isLinux)require('./mouse-linux-corners.cjs').install(win,browser);
 require('./mouse-stability.cjs').installWorkspace(browser,{report:log});
 require('./mouse-637-sidebar-dim.cjs').install(browser,{report:log});
 overlayGate=new (require('./mouse-overlays.cjs').OverlayGate)(browser,win);
 const hideNativePages=overlayGate.hide.bind(overlayGate);overlayGate.hide=()=>{flashService?.setPanelVisible(false);return hideNativePages();};
 ipcMain.handle('mouse:overlay',(e,state)=>{trusted(e);const result=overlayGate.set(state,e.senderFrame);flashService?.setPanelVisible(flashPanelWanted&&!result.blocked&&!privateMode?.current&&!privateMode?.busy);return result;});
 const extensionsAvailable=()=>!privateMode?.current&&!privateMode?.busy&&!win.isDestroyed()&&!exitController?.isClosing();
 const notifyExtensions=()=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('mouse:extensions-changed');};
 const extensions=require('./mouse-extensions.cjs').createMouseExtensions({session:browser.session,dialog,win,
  storage:path.join(app.getPath('userData'),'mouse-local-extensions'),isAvailable:extensionsAvailable,onUnload:id=>browser.closeManagedExtension(id),onChanged:notifyExtensions});
 // Register the store preload before restored pages load. Extension background
 // workers start later, after the desktop bank can assign their welcome tabs.
 const extensionCompat=require('./mouse-extension-compat.cjs').installExtensionCompatibility({browser,win,dialog,isAvailable:extensionsAvailable,onChanged:notifyExtensions,
  onSelect:state=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('mouse:extension-tab',state);}});
 browser.mouseExtensionContextMenu=(wc,params)=>extensionCompat.contextMenu(wc,params);
 const webStore=require('./mouse-web-store.cjs').installMouseWebStore({app,browser,win,ipcMain,dialog,extensions,isAvailable:extensionsAvailable,onChanged:notifyExtensions});
 app.once('will-quit',()=>{webStore.dispose();extensionCompat.suspend();extensionCompat.dispose();});
 await browser.initNetwork();await browser.command('project',{id:'trader-os-main'});
 // Custom AI links are ordinary sandboxed webpages. No automatic AI executor or background context reader.
 browser.contextScope=[];
 globalCapture=await new (require('./mouse-global-capture.cjs').GlobalCapture)({electron:require('electron'),app,mainWindow:win,store,trusted,entryDirectory:__dirname,test,platform:process.platform}).init();
 require('./mouse-shell.cjs').install({win,browser,ipcMain,trusted,send,test,captureScreen:()=>globalCapture.request()});
 localCaptures=await require('./mouse-local-captures.cjs').install({e:require('electron'),app,win,store,ipcMain,trusted,isPrivate:()=>!!(privateMode?.current||privateMode?.busy),test});
 app.once('will-quit',()=>void localCaptures.dispose());
 libraryService=await require('./mouse-browsing.cjs').install({app,win,browser,store,ipcMain,trusted,shell,dialog,test,isAvailable:()=>!privateMode?.current&&!privateMode?.busy&&!exitController?.isClosing()});
 importService=require('./mouse-browser-import.cjs').install({app,win,browser,library:libraryService.library,ipcMain,trusted,dialog,safeStorage:require('electron').safeStorage,clipboard:require('electron').clipboard,powerMonitor:require('electron').powerMonitor,isPrivate:()=>!!(privateMode?.current||privateMode?.busy||exitController?.isClosing()),notify:()=>{if(!win.isDestroyed())win.webContents.send('mouse:library-changed');}});
 app.once('will-quit',()=>void importService.dispose());
 startService=await require('./mouse-start.cjs').install({app,win,browser,store,libraryService,ipcMain,trusted,dialog,test});
 require('./mouse-ai-icons.cjs').install({win,browser,store,ipcMain,trusted});
 documentService=new (require('./mouse-documents.cjs').DocumentService)({win,dialog,ipcMain,trusted,readOnly:true,isPrivate:()=>!!privateMode?.current,emit:state=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('mouse:documents-state',state);}});
 require('./mouse-document-tabs.cjs').install({browser,documents:documentService,closeDocument:closeDocumentTab,library:libraryService.library});
 desktopService=await require('./mouse-desktops.cjs').install({win,browser,store,ipcMain,trusted,powerMonitor:require('electron').powerMonitor,screen:require('electron').screen});
 const extensionRestore=extensions.restore().catch(error=>{log('EXTENSIONS_RESTORE_FAILED '+error.message);});
 await extensionRestore;
 app.once('will-quit',()=>documentService.dispose());
 progress=new (require('./mouse-progress.cjs').ProgressStore)({emit:state=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('mouse:progress-state',state);}});
 progressBridge=require('./mouse-progress-bridge.cjs').install({win,browser,ipcMain,trusted,progress,powerMonitor:require('electron').powerMonitor,isPrivate:()=>!!(privateMode?.current||privateMode?.busy)});
 app.once('will-quit',()=>{progressBridge.dispose();progress.dispose();});
 const previewPowerMonitor=require('electron').powerMonitor;
 const clearDesktopPreviewUI=()=>{desktopService.previews.clear();privateMode?.current?.desktopService?.previews.clear();if(!win.isDestroyed()&&win.webContents.getURL()===entry)win.webContents.send('mouse:previews-cleared');};
 previewPowerMonitor.on('lock-screen',clearDesktopPreviewUI);previewPowerMonitor.on('unlock-screen',clearDesktopPreviewUI);
 app.once('will-quit',()=>{previewPowerMonitor.removeListener('lock-screen',clearDesktopPreviewUI);previewPowerMonitor.removeListener('unlock-screen',clearDesktopPreviewUI);});
 pageZoom=await require('./mouse-zoom.cjs').install({win,browser,store,ipcMain,trusted});
 imageDrag=require('./mouse-image-drag.cjs').install({app,win,ipcMain,getBrowser:()=>privateMode?.current?.browser||browser,isTransition:()=>!!privateMode?.busy});
 app.once('will-quit',()=>imageDrag.dispose());
 workspaceGestures=require('./mouse-workspace-gestures.cjs').install({win,ipcMain,trusted,getBrowser:()=>privateMode?.current?.browser||browser,isTransition:()=>!!(privateMode?.busy||exitController?.isClosing())});
 app.once('will-quit',()=>workspaceGestures.dispose());
 inputLanguage=require('./mouse-input-language.cjs').install({win,ipcMain,trusted,getBrowser:()=>privateMode?.current?.browser||browser,isTransition:()=>!!(privateMode?.busy||exitController?.isClosing())});
 app.once('will-quit',()=>inputLanguage.dispose());
 require('./mouse-address-tools.cjs').install({ipcMain,trusted,getBrowser:()=>privateMode?.current?.browser||browser,isTransition:()=>!!(privateMode?.busy||exitController?.isClosing()),clipboard:require('electron').clipboard});
 const {MacInstaller,WindowsInstaller}=require('./mouse-install-update.cjs');
 const quitForUpdate=async()=>{await exitController.request();if(!exitController.isClosing())throw Error('Установка отменена: не удалось сохранить данные браузера');};
 const linuxUpdate=isLinux?require('./mouse-linux-update.cjs'):null;
 const installer=isLinux?(linuxUpdate.appImagePath()?new linuxUpdate.LinuxInstaller({app,quit:quitForUpdate,test}):null):new (isWindows?WindowsInstaller:MacInstaller)({app,quit:quitForUpdate,test});
 const updates=new (require('./mouse-update.cjs').MouseUpdates)({app,shell,installer,target:{platform:process.platform,arch:isMac?'arm64':process.arch,...(isLinux?{format:process.env.APPIMAGE?'appimage':'deb'}:{})},emit:state=>{if(!win.isDestroyed())win.webContents.send('mouse:update-state',state)}});
 const escapeFullscreen=(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'){if(paneFocus.active){event.preventDefault();paneFocus.leave();return}if(win.isFullScreen()){event.preventDefault();win.setFullScreen(false)}}};
 // The shell handles Escape itself: a modal closes before fullscreen exits.
 for(const t of [...browser.tabs.values(),...browser.providers.values()])t.view.webContents.on('before-input-event',escapeFullscreen);
 const makePage=browser.make.bind(browser);browser.make=(...args)=>{const page=makePage(...args);page.view.webContents.on('before-input-event',escapeFullscreen);return page};
 const allowed=new Set(['state','open','close','navigate','back','forward','reload','mute','layout','save']);
 ipcMain.handle('mouse:init',async e=>{trusted(e);const data=await store.get(['mouseAppearance']);const preferences=desktopService.preferences();if(data.mouseAppearance)preferences.appearance=require('./mouse/appearance.js').normalize(data.mouseAppearance);const initial={state:browser.state(),preferences};if(test&&process.argv.includes('--mouse-init-race')){win.webContents.send('browser:state',browser.state());await new Promise(resolve=>setTimeout(resolve,450));}return initial});
 ipcMain.handle('mouse:save',async(e,p,history)=>{trusted(e);if(!p||typeof p!=='object'||JSON.stringify(p).length>100000)throw Error('Invalid preferences');const value={tree:require('./mouse/layout.js').validate(p.tree),slots:p.slots,pinnedPanes:p.pinnedPanes,tabOrder:Array.isArray(p.tabOrder)?[...new Set(p.tabOrder.filter(id=>typeof id==='string'&&id.length<=100))].slice(0,1000):[],active:p.active,theme:p.theme,locale:p.locale==='en'?'en':'ru',libraryWidth:Math.max(300,Math.min(1600,Number(p.libraryWidth)||380)),settingsWidth:Math.max(340,Math.min(1600,Number(p.settingsWidth)||760)),flashWidth:Math.max(300,Math.min(1600,Number(p.flashWidth)||420)),...(p.appearance?{appearance:isMac?require('./mouse-sync-schema.cjs').appearance(p.appearance):require('./mouse/appearance.js').normalize(p.appearance)}:{}),aiOpen:p.aiOpen===true,aiWidth:Number(p.aiWidth)||360,aiPreviewRatio:p.aiPreviewRatio,aiId:p.aiId,aiSites:p.aiSites,aiSessions:p.aiSessions,desktopId:p.desktopId,mode:p.mode,presetTabs:p.presetTabs};const saved=await desktopService.savePreferences(value,history);if(saved!==false&&value.appearance)await store.set({mouseAppearance:value.appearance});return saved;});
 ipcMain.handle('mouse:browser',(e,action,args={})=>{trusted(e);if(!allowed.has(action))throw Error('Unsupported browser action');return browser.command(action,args)});
 ipcMain.handle('mouse:window',(e,action)=>{trusted(e);if(action==='pane-fullscreen'){paneFocus.enter();return true}if(action==='pane-restore'){paneFocus.leave();return true}if(action==='quit'){void exitController.request();return true}if(action==='minimize'){void require('./mouse-lifecycle.cjs').leaveFullscreen(win).then(()=>{if(!win.isDestroyed())win.minimize()});return true}if((action==='maximize'||action==='zoom')&&!isMac){if(win.isMaximized())win.unmaximize();else win.maximize();return true}if(action==='fullscreen'||action==='zoom'){win.setFullScreen(!win.isFullScreen());return true}if(action==='exit-fullscreen'){if(win.isFullScreen())win.setFullScreen(false);return true}throw Error('Unsupported window action')});
 ipcMain.handle('mouse:appearance',(e,value)=>{trusted(e);return (privateMode?.current?.browser||browser).mousePageTone.set(value);});
 ipcMain.handle('mouse:theme',(e,theme)=>{trusted(e);if(!['dark','light'].includes(theme))throw Error('Unsupported theme');nativeTheme.themeSource=theme;updateDock();win.setBackgroundColor(theme==='light'?'#f3f5f9':'#10151e');return true});
 ipcMain.handle('mouse:update',async(e,action)=>{trusted(e);if(action==='state')return{...updates.state};if(!['check','download','open','install'].includes(action))throw Error('Unsupported update action');if(action!=='install')return updates.run(action);try{await prepareDocuments();return await updates.run(action);}catch(error){if(error.code==='MOUSE_DOCUMENT_CANCEL')return{...updates.state};throw error;}finally{if(!exitController.isClosing()&&!privateMode?.busy)await releaseDocumentsUI();}});
 privateMode=new (require('./mouse-private.cjs').PrivateMode)({e:require('electron'),win,entry,normalBrowser:browser,normalGate:overlayGate,normalStore:store,router:ipcRouter,trusted,globalCapture,paneFocus,test,prepareDocuments,documentService,closeDocumentTab,attachAdBlockSession:ses=>adBlock.attach(ses),trackAdBlockPage:wc=>adBlock.track(wc),adBlockExceptions,adBlockEnabled:()=>adBlock.enabled,onPrivacySettled:()=>{progressBridge.resume();},onPrivacyChange:()=>{void accountClient?.operation('cancel').catch(()=>{});flashPanelWanted=false;profileService?.cancelPending();inputLanguage?.clear();workspaceGestures?.cancel();extensionCompat.suspend();importService.cancelPending();documentService.clear();progressBridge.clear();localCaptures.privacyChanged();imageDrag.cancel();clearDesktopPreviewUI();return Promise.all([importService.flush(),adBlockExceptions.flush(),adBlock.flush(),profileService?.flush()]);}});
 require('./mouse-adblock-exceptions.cjs').install({service:adBlockExceptions,ipcMain,trusted,getBrowser:()=>privateMode?.current?.browser||browser,getEnabled:()=>adBlock.enabled,isAvailable:()=>!privateMode?.busy&&!exitController?.isClosing()});
 ipcMain.handle('mouse:extensions',async(e,action,args={})=>{
  trusted(e);
  if(!extensionsAvailable())throw Error('Расширения недоступны в приватном режиме');
  await extensionRestore;
  if(!extensionsAvailable())throw Error('Расширения недоступны в приватном режиме');
  if(!extensions)throw Error('Модуль расширений недоступен');
  if(action==='state')return extensions.state();
  if(action==='install')return extensions.install();
  if(action==='store-page')return webStore.currentPage(args?.tabId);
  if(action==='install-store-page')return{...await webStore.installFromBrowser(args?.tabId),extensions:extensions.state()};
  if(action==='open-store'){
   const id=typeof args?.id==='string'&&/^[a-p]{32}$/.test(args.id)?args.id:'';
   const url='https://chromewebstore.google.com/'+(id?'detail/'+id:'');
   return {...browser.open({url,lane:'main'}),desk:browser.state().desktopId};
  }
  if(!args||typeof args.id!=='string'||args.id.length>100)throw Error('Не удалось определить расширение');
  if(action==='activate'){const id=extensions.chromiumId(args.id);if(!id)throw Error('Расширение выключено');extensionCompat.activate(id,args);return extensions.state();}
  if(action==='open-page')return extensions.openPage(args.id,entry=>{if(!extensionsAvailable())throw Error('Расширения недоступны в приватном режиме');const desk=browser.state().desktopId;return {...browser.openManagedExtension(entry),desk};});
  if(action==='set-enabled'&&typeof args.value==='boolean')return extensions.setEnabled(args.id,args.value);
  if(action==='set-pinned'&&typeof args.value==='boolean')return extensions.setPinned(args.id,args.value);
  if(action==='remove')return extensions.remove(args.id);
  throw Error('Действие не поддерживается');
 });
 const desktopGesture=await require('./mouse-gesture.cjs').install({win,store,ipcMain,trusted,enabled:()=>settingsService.state().desktopGestures,getContext:()=>({privateMode:privateMode.current,busy:privateMode.busy,browser:privateMode.current?.browser||browser,desktopService:privateMode.current?.desktopService||desktopService})});
 app.once('will-quit',()=>desktopGesture.dispose());
 ipcMain.handle('mouse:privacy',(event)=>{trusted(event);importService.cancelPending();setImmediate(()=>privateMode.toggle().catch(async error=>{if(!exitController.isClosing())await releaseDocumentsUI();if(error.code!=='MOUSE_DOCUMENT_CANCEL'&&!win.isDestroyed())win.webContents.send('browser:error','Не удалось переключить режим. Завершите браузер через '+(isMac?'⌘Q':'Ctrl+Q')+' и повторите.')}));return true;});
 win.webContents.on('preload-error',(_e,_p,error)=>log('PRELOAD_ERROR '+error.message));
 require('./mouse-stability.cjs').installShellRecovery({win,entry,current:()=>privateMode?.current?{browser:privateMode.current.browser,gate:privateMode.current.gate}:{browser,gate:overlayGate},isClosing:()=>exitController.isClosing(),report:log});
 app.on('child-process-gone',(_e,detail)=>log('CHILD_STOPPED '+detail.type+' '+detail.reason));
 const updateWatch=new (require('./mouse-update-watch.cjs').UpdateWatch)({updates,canCheck:()=>!privateMode?.current&&!exitController.isClosing()});if(!test)updateWatch.start();app.once('will-quit',()=>updateWatch.stop());
 await win.loadURL(entry);show();
 await win.webContents.executeJavaScript("new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const s=document.documentElement.dataset.mouseReady;if(s==='true'){clearInterval(t);resolve()}else if(s==='error'||++n>300){clearInterval(t);reject(Error('Mouse UI failed to start'))}},100)})");
 log('MOUSE_READY '+app.getVersion());
 if(accountClient){accountSync=new (require('./mouse-config-sync.cjs').MouseConfigSync)({store,account:accountClient,canSync:()=>!privateMode?.current&&!privateMode?.busy&&!exitController.isClosing()&&profileContext.active===accountClient.snapshot()?.accountId,beforeRead:async()=>{await browser.save();await libraryService.flush();await desktopService.flush();},onState:state=>accountClient.setSync(state)});accountSync.start();if(!test)void accountClient.restore().then(()=>accountSync.tick());app.once('will-quit',()=>{accountClient.dispose();void accountSync.stop();});}
 if(test&&isMac&&process.argv.includes('--mouse-645-account-smoke'))await require('./mouse-645-account-smoke.cjs')({app,win,browser,store,libraryService,desktopService,profileService,accountService:accountClient,accountSync,profileContext,globalCapture});
 if(test&&isMac&&process.argv.some(x=>['--mouse-645-smoke','--mouse-645-read'].includes(x)))await require('./mouse-645-smoke.cjs')({app,win,browser,store,privateMode,startService,libraryService,globalCapture,settingsService,updates,flashService,profileService,accountService:accountClient});
 await require('./mouse-install-update.cjs').acknowledge(app).catch(()=>{});
 if(test&&process.argv.some(x=>['--mouse-644-sync-smoke','--mouse-644-sync-read'].includes(x)))await require('./mouse-644-sync-smoke.cjs')({app,win,browser,store,privateMode,startService,libraryService,globalCapture,settingsService,adBlock});
 if(test&&process.argv.some(x=>['--mouse-643-polish-smoke','--mouse-643-polish-read'].includes(x)))await require('./mouse-643-polish-smoke.cjs')({app,win,browser,store,privateMode,startService,libraryService,globalCapture,settingsService});
 if(test&&process.argv.some(x=>['--mouse-642-controls-smoke','--mouse-642-controls-read'].includes(x)))await require('./mouse-642-controls-smoke.cjs')({app,win,browser,store,privateMode,globalCapture,inputLanguageService:inputLanguage});
 if(test&&process.argv.some(x=>['--mouse-641-workspace-smoke','--mouse-641-workspace-read'].includes(x)))await require('./mouse-641-workspace-smoke.cjs')({app,win,browser,store,startService,libraryService,settingsService,adBlock,adBlockExceptions,globalCapture,privateMode,ipcMain});
 if(test&&process.argv.some(x=>['--mouse-639-adblock-smoke','--mouse-639-adblock-read'].includes(x)))await require('./mouse-639-adblock-smoke.cjs')({app,win,browser,store,privateMode,settingsService,adBlock,ipcMain,globalCapture});
 if(test&&process.argv.some(x=>['--mouse-638-feedback-smoke','--mouse-638-feedback-restore-read'].includes(x)))await require('./mouse-638-feedback-smoke.cjs')({app,win,browser,store,startService,globalCapture,extensions,extensionCompatibility:extensionCompat,webStore,dialog,privateMode,settingsService,ipcMain});
 if(test&&process.argv.some(x=>['--mouse-637-features-smoke','--mouse-637-features-restore-read'].includes(x)))await require('./mouse-637-features-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode,settingsService,importService,ipcMain,extensions,dialog});
 if(test&&process.argv.includes('--mouse-637-smoke'))await require('./mouse-637-owner-feedback-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode,settingsService,importService,ipcMain});
 if(test&&process.argv.includes('--mouse-636-retained-smoke'))await require('./mouse-636-retained-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode,settingsService,importService,ipcMain});
 if(test&&process.argv.includes('--mouse-636-smoke'))await require('./mouse-636-owner-feedback-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode,settingsService,importService,ipcMain});
 if(test&&process.argv.includes('--mouse-633-smoke'))await require('./mouse-633-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode,settingsService,importService});
 if(test&&isLinux&&process.argv.some(x=>/^--mouse-linux-smoke-(write|read)$/.test(x)))await require('./mouse-linux-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode});
 if(test&&process.argv.includes('--mouse-631-smoke'))await require('./mouse-631-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode});
 if(test&&isWindows&&process.argv.some(x=>/^--mouse-windows-smoke-(write|read)$/.test(x)||x==='--mouse-windows-update-smoke'))await require('./mouse-windows-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode});
 if(test&&process.argv.some(x=>/^--mouse-smoke-(write|read)$/.test(x)))await require('./mouse-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,documentService,privateMode});
 if(test&&(process.argv.includes('--mouse-private-smoke')||process.argv.includes('--mouse-private-close')))await require('./mouse-private-smoke.cjs')({app,win,browser,store,privateMode,ipcRouter,localCaptures});
 if(test&&process.argv.some(x=>x.startsWith('--mouse-close-test=')))await require('./mouse-close-smoke.cjs')({app,win,store,log});
}).catch(error=>{log('STARTUP_FAILED '+error.stack);if(!test)dialog.showErrorBox('Mouse Browser — ошибка запуска','Локальные данные не удалены.\n'+error.message+'\nЖурнал: '+logFile);app.exit(1)});
