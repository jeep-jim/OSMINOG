'use strict';
const {app,BrowserWindow,ipcMain,Menu,session,nativeTheme,shell,dialog,systemPreferences}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
if(process.platform!=='darwin')throw Error('Mouse Browser build requires macOS');
app.setName('Mouse Browser');
// Retain the existing Mac profile and website logins. Internal legacy names are migration keys, not UI.
app.setPath('userData',path.join(app.getPath('appData'),'Trader OS'));
const test=process.env.CI==='true'&&process.env.MOUSE_TEST_PROFILE&&path.isAbsolute(process.env.MOUSE_TEST_PROFILE);
if(test)app.setPath('userData',process.env.MOUSE_TEST_PROFILE);
fs.mkdirSync(app.getPath('userData'),{recursive:true});
const logFile=path.join(app.getPath('userData'),'mouse-startup.log');
function log(s){fs.appendFileSync(logFile,new Date().toISOString()+' '+s+'\n');console.log(s)}
let paneFocus;
let win,browser,store,exitController,libraryService,overlayGate,startService,globalCapture,privateMode,localCaptures,desktopService,pageZoom,imageDrag,agentHost;
const ipcRouter=require('./mouse-private-core.cjs').installIPCSwitch(ipcMain,()=>win?.webContents);
const entry=pathToFileURL(path.join(__dirname,'mouse/index.html')).href;
function show(){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus()}
function trusted(e){if(!require('./trust.cjs').trustedFrame(e,win,entry))throw Error('Untrusted frame')}
const ownsProfile=app.requestSingleInstanceLock();
if(!ownsProfile)app.quit();
app.on('second-instance',show);app.on('activate',show);
if(ownsProfile)app.whenReady().then(async()=>{
 store=new (require('./storage.cjs').Store)(app.getPath('userData'));
 nativeTheme.themeSource='light';
 // Owner requirement: Dock always uses the black mouse on white, irrespective of theme.
 const updateDock=()=>{const theme='light';app.dock.setIcon(path.join(__dirname,'icons/mouse-browser-'+theme+'.png'));updateDock.appliedTheme=theme;};updateDock();
 nativeTheme.on('updated',updateDock);app.on('will-quit',()=>nativeTheme.removeListener('updated',updateDock));
 // Create genuinely untitled from the outset: roundedCorners=true otherwise
 // retains AppKit Titled even for frame:false and creates a fullscreen blank bar.
 // The native module rounds the normal root view, without changing style masks.
 win=new BrowserWindow({title:'Mouse Browser',width:1440,height:960,minWidth:800,minHeight:600,show:false,backgroundColor:'#f3f5f9',frame:false,fullscreenable:true,roundedCorners:false,kiosk:false,simpleFullscreen:false,alwaysOnTop:false,webPreferences:{preload:path.join(__dirname,'mouse-preload.cjs'),additionalArguments:['--mouse-version='+app.getVersion(),...(test?['--mouse-test']:[])],nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
 if(test)win.mouseDockThemeForTest=()=>updateDock.appliedTheme;
 exitController=require('./mouse-lifecycle.cjs').install({app,win,log,onError:error=>{if(!test)dialog.showErrorBox('Mouse Browser — данные не сохранены','Браузер оставлен открытым. Повторите выход после устранения ошибки: '+error.message)},flush:async()=>{
  if(win.webContents.getURL()===entry)await win.webContents.executeJavaScript('globalThis.MouseFlush?.()');
  await agentHost?.stop('Браузер закрывается');
  if(privateMode?.current)await privateMode.dispose();
  if(browser){await browser.save();await browser.saveQueue;await browser.session.cookies.flushStore();browser.session.flushStorageData();}
  if(libraryService)await libraryService.flush();
  if(store)await store.queue;
 }});
 win.on('closed',()=>log('MOUSE_WINDOW_CLOSED'));
 app.on('will-quit',()=>log('MOUSE_APP_QUIT'));
 win.on('leave-full-screen',()=>log('MOUSE_LEFT_FULLSCREEN'));
 paneFocus=new (require('./mouse-pane-focus.cjs').PaneFocus)({win,restore:()=>{if(!win.isDestroyed())win.webContents.send('mouse:menu','restore-pane')}});
 const send=name=>{show();if(win.webContents.getURL()===entry)win.webContents.send('mouse:menu',name)};
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Mouse Browser',submenu:[{role:'about'},{label:'Проверить обновление…',click:()=>send('updates')},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
  {label:'Файл',submenu:[{label:'Скриншот экрана Mac · ⌃A',click:()=>void globalCapture?.request()},{label:'Скриншот окон браузера',click:()=>send('screenshot')},{label:'Инкогнито / обычный режим',accelerator:'Cmd+Shift+N',click:()=>send('privacy')},{label:'Новый рабочий стол',accelerator:'Cmd+N',click:()=>send('new-desktop')},{label:'Новая вкладка',accelerator:'Cmd+T',click:()=>send('new-tab')},{label:'Адрес страницы',accelerator:'Cmd+L',click:()=>send('address')},{label:'Вернуть закрытую вкладку',accelerator:'Cmd+Shift+T',click:()=>send('reopen')},{label:'Новое окно в раскладке',accelerator:'Cmd+Alt+T',click:()=>send('split-x')},{label:'Закрыть вкладку',accelerator:'Cmd+W',click:()=>send('close-tab')}]},
  {label:'Правка',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'pasteAndMatchStyle'},{role:'selectAll'}]},
  {label:'Вид',submenu:[{label:'Обновить страницу',accelerator:'Cmd+R',click:()=>send('reload')},{label:'Показать / скрыть ИИ',accelerator:'Cmd+Shift+I',click:()=>send('ai')},{label:'Сменить тему',click:()=>send('theme')},{type:'separator'},{label:'Масштаб всех вкладок: 100%',accelerator:'Cmd+0',click:()=>send('zoom-reset')},{label:'Увеличить все вкладки',accelerator:'Cmd+Plus',click:()=>send('zoom-in')},{label:'Уменьшить все вкладки',accelerator:'Cmd+-',click:()=>send('zoom-out')},{type:'separator'},{role:'togglefullscreen'}]},
  {label:'История',submenu:[{label:'Показать историю',accelerator:'Cmd+Y',click:()=>send('history')},{label:'Сохранённые запросы',click:()=>send('searches')},{label:'Закладки',accelerator:'Cmd+Alt+B',click:()=>send('bookmarks')},{label:'Добавить закладку',accelerator:'Cmd+D',click:()=>send('bookmark')},{label:'Загрузки',accelerator:'Cmd+Shift+J',click:()=>send('downloads')}]},
  {label:'Окно',submenu:[{role:'minimize'},{role:'zoom'},{type:'separator'},{role:'front'}]}
 ]));
 // No menu-bar status item: the Dock icon and native application menu are sufficient.
 app.setAboutPanelOptions({applicationName:'Mouse Browser',applicationVersion:app.getVersion(),copyright:'Mouse Browser · mouse.black',credits:'mouse.black · macOS Apple Silicon'});
 session.defaultSession.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault()});
 browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);browser.mouseRoundedPanes=true;browser.mouseCornerMask=rects=>require('./mouse-native-menu.node').paneCorners(rects);
 require('./mouse-stability.cjs').installWorkspace(browser,{report:log});
 overlayGate=new (require('./mouse-overlays.cjs').OverlayGate)(browser,win);
 ipcMain.handle('mouse:overlay',(e,state)=>{trusted(e);return overlayGate.set(state)});
 await browser.initNetwork();await browser.command('project',{id:'trader-os-main'});
 // Custom AI links are ordinary sandboxed webpages. No automatic AI executor or background context reader.
 browser.contextScope=[];
 globalCapture=await new (require('./mouse-global-capture.cjs').GlobalCapture)({electron:require('electron'),app,mainWindow:win,store,trusted,entryDirectory:__dirname,test}).init();
 require('./mouse-shell.cjs').install({win,browser,ipcMain,trusted,send,test,captureScreen:()=>globalCapture.request()});
 localCaptures=await require('./mouse-local-captures.cjs').install({e:require('electron'),app,win,store,ipcMain,trusted,isPrivate:()=>!!(privateMode?.current||privateMode?.busy),test});
 app.once('will-quit',()=>void localCaptures.dispose());
 libraryService=await require('./mouse-browsing.cjs').install({app,win,browser,store,ipcMain,trusted,shell,dialog,test});
 startService=await require('./mouse-start.cjs').install({app,win,browser,store,libraryService,ipcMain,trusted,dialog,test});
 require('./mouse-ai-icons.cjs').install({win,browser,store,ipcMain,trusted});
 desktopService=await require('./mouse-desktops.cjs').install({win,browser,store,ipcMain,trusted,powerMonitor:require('electron').powerMonitor});
 agentHost=require('./mouse-agent/host.cjs').install({app,win,browser,ipcMain,trusted,dialog,powerMonitor:require('electron').powerMonitor,utilityProcess:require('electron').utilityProcess,isPrivate:()=>!!(privateMode?.current||privateMode?.busy),test});
 app.once('will-quit',()=>agentHost.dispose());
 const previewPowerMonitor=require('electron').powerMonitor;
 const clearDesktopPreviewUI=()=>{desktopService.previews.clear();privateMode?.current?.desktopService?.previews.clear();if(!win.isDestroyed()&&win.webContents.getURL()===entry)win.webContents.send('mouse:previews-cleared');};
 previewPowerMonitor.on('lock-screen',clearDesktopPreviewUI);previewPowerMonitor.on('unlock-screen',clearDesktopPreviewUI);
 app.once('will-quit',()=>{previewPowerMonitor.removeListener('lock-screen',clearDesktopPreviewUI);previewPowerMonitor.removeListener('unlock-screen',clearDesktopPreviewUI);});
 pageZoom=await require('./mouse-zoom.cjs').install({win,browser,store,ipcMain,trusted});
 imageDrag=require('./mouse-image-drag.cjs').install({app,win,ipcMain,getBrowser:()=>privateMode?.current?.browser||browser,isTransition:()=>!!privateMode?.busy});
 app.once('will-quit',()=>imageDrag.dispose());
 const installer=new (require('./mouse-install-update.cjs').MacInstaller)({app,quit:()=>exitController.request(),test});
 const updates=new (require('./mouse-update.cjs').MouseUpdates)({app,shell,installer,emit:state=>{if(!win.isDestroyed())win.webContents.send('mouse:update-state',state)}});
 const escapeFullscreen=(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'){if(paneFocus.active){event.preventDefault();paneFocus.leave();return}if(win.isFullScreen()){event.preventDefault();win.setFullScreen(false)}}};
 // The shell handles Escape itself: a modal closes before fullscreen exits.
 for(const t of [...browser.tabs.values(),...browser.providers.values()])t.view.webContents.on('before-input-event',escapeFullscreen);
 const makePage=browser.make.bind(browser);browser.make=(...args)=>{const page=makePage(...args);page.view.webContents.on('before-input-event',escapeFullscreen);return page};
 const allowed=new Set(['state','open','close','navigate','back','forward','reload','layout','save']);
 ipcMain.handle('mouse:init',async e=>{trusted(e);const data=await store.get(['quadroPreferences','traderPreferences']);const initial={state:browser.state(),preferences:desktopService.preferences()};if(test&&process.argv.includes('--mouse-init-race')){win.webContents.send('browser:state',browser.state());await new Promise(resolve=>setTimeout(resolve,450));}return initial});
 ipcMain.handle('mouse:save',async(e,p)=>{trusted(e);if(!p||typeof p!=='object'||JSON.stringify(p).length>100000)throw Error('Invalid preferences');const value={tree:require('./mouse/layout.js').validate(p.tree),slots:p.slots,tabOrder:Array.isArray(p.tabOrder)?[...new Set(p.tabOrder.filter(id=>typeof id==='string'&&id.length<=100))].slice(0,1000):[],active:p.active,theme:p.theme,locale:p.locale==='en'?'en':'ru',libraryWidth:Math.max(300,Math.min(1600,Number(p.libraryWidth)||380)),aiOpen:p.aiOpen===true,aiWidth:Number(p.aiWidth)||360,aiId:p.aiId,aiSites:p.aiSites,aiSessions:p.aiSessions,desktopId:p.desktopId,mode:p.mode};return desktopService.savePreferences(value)});
 ipcMain.handle('mouse:browser',(e,action,args={})=>{trusted(e);if(!allowed.has(action))throw Error('Unsupported browser action');return browser.command(action,args)});
 ipcMain.handle('mouse:window',(e,action)=>{trusted(e);if(action==='pane-fullscreen'){paneFocus.enter();return true}if(action==='pane-restore'){paneFocus.leave();return true}if(action==='quit'){void exitController.request();return true}if(action==='minimize'){void require('./mouse-lifecycle.cjs').leaveFullscreen(win).then(()=>{if(!win.isDestroyed())win.minimize()});return true}if(action==='fullscreen'||action==='zoom'){win.setFullScreen(!win.isFullScreen());return true}if(action==='exit-fullscreen'){if(win.isFullScreen())win.setFullScreen(false);return true}throw Error('Unsupported window action')});
 ipcMain.handle('mouse:theme',(e,theme)=>{trusted(e);if(!['dark','light'].includes(theme))throw Error('Unsupported theme');nativeTheme.themeSource=theme;updateDock();win.setBackgroundColor(theme==='light'?'#f3f5f9':'#10151e');return true});
 ipcMain.handle('mouse:update',(e,action)=>{trusted(e);if(action==='state')return{...updates.state};if(!['check','download','open','install'].includes(action))throw Error('Unsupported update action');return updates.run(action)});
 privateMode=new (require('./mouse-private.cjs').PrivateMode)({e:require('electron'),win,entry,normalBrowser:browser,normalGate:overlayGate,normalStore:store,router:ipcRouter,trusted,globalCapture,paneFocus,test,onPrivacyChange:()=>{localCaptures.privacyChanged();imageDrag.cancel();clearDesktopPreviewUI();void agentHost.stop('Режим приватности изменён');}});
 ipcMain.handle('mouse:privacy',(event)=>{trusted(event);setImmediate(()=>privateMode.toggle().catch(()=>{if(!win.isDestroyed())win.webContents.send('browser:error','Не удалось переключить режим. Завершите браузер через ⌘Q и повторите.')}));return true;});
 win.webContents.on('preload-error',(_e,_p,error)=>log('PRELOAD_ERROR '+error.message));
 require('./mouse-stability.cjs').installShellRecovery({win,entry,current:()=>privateMode?.current?{browser:privateMode.current.browser,gate:privateMode.current.gate}:{browser,gate:overlayGate},isClosing:()=>exitController.isClosing(),report:log});
 app.on('child-process-gone',(_e,detail)=>log('CHILD_STOPPED '+detail.type+' '+detail.reason));
 const updateWatch=new (require('./mouse-update-watch.cjs').UpdateWatch)({updates,canCheck:()=>!privateMode?.current&&!exitController.isClosing()});if(!test)updateWatch.start();app.once('will-quit',()=>updateWatch.stop());
 await win.loadURL(entry);show();
 await win.webContents.executeJavaScript("new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const s=document.documentElement.dataset.mouseReady;if(s==='true'){clearInterval(t);resolve()}else if(s==='error'||++n>300){clearInterval(t);reject(Error('Mouse UI failed to start'))}},100)})");
 log('MOUSE_READY '+app.getVersion());
 await require('./mouse-install-update.cjs').acknowledge(app).catch(()=>{});
 if(test&&process.argv.some(x=>/^--mouse-smoke-(write|read)$/.test(x)))await require('./mouse-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService,globalCapture,paneFocus,localCaptures,updates,agentHost});
 if(test&&(process.argv.includes('--mouse-private-smoke')||process.argv.includes('--mouse-private-close')))await require('./mouse-private-smoke.cjs')({app,win,browser,store,privateMode,ipcRouter,localCaptures});
 if(test&&process.argv.some(x=>x.startsWith('--mouse-close-test=')))await require('./mouse-close-smoke.cjs')({app,win,store,log});
}).catch(error=>{log('STARTUP_FAILED '+error.stack);if(!test)dialog.showErrorBox('Mouse Browser — ошибка запуска','Локальные данные не удалены.\n'+error.message+'\nЖурнал: '+logFile);app.exit(1)});
