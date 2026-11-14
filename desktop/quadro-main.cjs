'use strict';
const {app,BrowserWindow,ipcMain,Menu,session,nativeTheme,shell,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
if(process.platform!=='darwin')throw Error('Quadro Browser build requires macOS');
app.setName('Quadro Browser');
// Retain the existing Mac profile and website logins. Internal legacy names are migration keys, not UI.
app.setPath('userData',path.join(app.getPath('appData'),'Trader OS'));
const test=process.env.CI==='true'&&process.env.QUADRO_TEST_PROFILE&&path.isAbsolute(process.env.QUADRO_TEST_PROFILE);
if(test)app.setPath('userData',process.env.QUADRO_TEST_PROFILE);
fs.mkdirSync(app.getPath('userData'),{recursive:true});
const logFile=path.join(app.getPath('userData'),'quadro-startup.log');
function log(s){fs.appendFileSync(logFile,new Date().toISOString()+' '+s+'\n');console.log(s)}
let win,browser,store,exitController,libraryService,overlayGate,startService;
const entry=pathToFileURL(path.join(__dirname,'quadro/index.html')).href;
function show(){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus()}
function trusted(e){if(!require('./trust.cjs').trustedFrame(e,win,entry))throw Error('Untrusted frame')}
const ownsProfile=app.requestSingleInstanceLock();
if(!ownsProfile)app.quit();
app.on('second-instance',show);app.on('activate',show);
if(ownsProfile)app.whenReady().then(async()=>{
 store=new (require('./storage.cjs').Store)(app.getPath('userData'));
 const wallet=new (require('./wallet-vault.cjs').WalletVault)(store);
 nativeTheme.themeSource='light';
 win=new BrowserWindow({title:'Quadro Browser',width:1440,height:960,minWidth:800,minHeight:600,show:false,backgroundColor:'#f3f5f9',titleBarStyle:'hidden',webPreferences:{preload:path.join(__dirname,'quadro-preload.cjs'),additionalArguments:['--quadro-version='+app.getVersion(),...(test?['--quadro-test']:[])],nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
 exitController=require('./quadro-lifecycle.cjs').install({app,win,log,onError:error=>{if(!test)dialog.showErrorBox('Quadro Browser — данные не сохранены','Браузер оставлен открытым. Повторите выход после устранения ошибки: '+error.message)},flush:async()=>{
  if(win.webContents.getURL()===entry)await win.webContents.executeJavaScript('globalThis.QuadroFlush?.()');
  if(browser){await browser.save();await browser.saveQueue;await browser.session.cookies.flushStore();browser.session.flushStorageData();}
  if(libraryService)await libraryService.flush();
  if(store)await store.queue;
 }});
 win.on('closed',()=>log('QUADRO_WINDOW_CLOSED'));
 app.on('will-quit',()=>log('QUADRO_APP_QUIT'));
 win.on('leave-full-screen',()=>log('QUADRO_LEFT_FULLSCREEN'));
 const send=name=>{show();if(win.webContents.getURL()===entry)win.webContents.send('quadro:menu',name)};
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Quadro Browser',submenu:[{role:'about'},{label:'Проверить обновление…',click:()=>send('updates')},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
  {label:'Файл',submenu:[{label:'Скриншот',accelerator:'Control+A',click:()=>send('screenshot')},{label:'Новая вкладка',accelerator:'Cmd+T',click:()=>send('new-tab')},{label:'Адрес страницы',accelerator:'Cmd+L',click:()=>send('address')},{label:'Вернуть закрытую вкладку',accelerator:'Cmd+Shift+T',click:()=>send('reopen')},{label:'Новое окно в раскладке',accelerator:'Cmd+Alt+T',click:()=>send('split-x')},{label:'Закрыть вкладку',accelerator:'Cmd+W',click:()=>send('close-tab')}]},
  {label:'Правка',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'pasteAndMatchStyle'},{role:'selectAll'}]},
  {label:'Вид',submenu:[{label:'Обновить страницу',accelerator:'Cmd+R',click:()=>send('reload')},{label:'Показать / скрыть ИИ',accelerator:'Cmd+Shift+I',click:()=>send('ai')},{label:'Сменить тему',click:()=>send('theme')},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},
  {label:'История',submenu:[{label:'Показать историю',accelerator:'Cmd+Y',click:()=>send('history')},{label:'Сохранённые запросы',click:()=>send('searches')},{label:'Закладки',accelerator:'Cmd+Alt+B',click:()=>send('bookmarks')},{label:'Добавить закладку',accelerator:'Cmd+D',click:()=>send('bookmark')},{label:'Загрузки',accelerator:'Cmd+Shift+J',click:()=>send('downloads')}]},
  {label:'Окно',submenu:[{role:'minimize'},{role:'zoom'},{type:'separator'},{role:'front'}]}
 ]));
 // No menu-bar status item: the Dock icon and native application menu are sufficient.
 app.setAboutPanelOptions({applicationName:'Quadro Browser',applicationVersion:app.getVersion(),copyright:'Локальный многооконный браузер',credits:'macOS Apple Silicon preview'});
 session.defaultSession.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault()});
 browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);
 overlayGate=new (require('./quadro-overlays.cjs').OverlayGate)(browser,win);
 ipcMain.handle('quadro:overlay',(e,state)=>{trusted(e);return overlayGate.set(state)});
 await browser.initNetwork();await browser.command('project',{id:'trader-os-main'});
 // Custom AI links are ordinary sandboxed webpages. No automatic AI executor or background context reader.
 browser.contextScope=[];
 require('./quadro-shell.cjs').install({win,browser,ipcMain,trusted,send});
 libraryService=await require('./quadro-browsing.cjs').install({app,win,browser,store,ipcMain,trusted,shell,dialog,test});
 startService=await require('./quadro-start.cjs').install({app,win,browser,store,libraryService,ipcMain,trusted,dialog,test});
 const updates=new (require('./quadro-update.cjs').QuadroUpdates)({app,shell,emit:state=>{if(!win.isDestroyed())win.webContents.send('quadro:update-state',state)}});
 const escapeFullscreen=(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'&&win.isFullScreen()){event.preventDefault();win.setFullScreen(false)}};
 // The shell handles Escape itself: a modal closes before fullscreen exits.
 for(const t of [...browser.tabs.values(),...browser.providers.values()])t.view.webContents.on('before-input-event',escapeFullscreen);
 const makePage=browser.make.bind(browser);browser.make=(...args)=>{const page=makePage(...args);page.view.webContents.on('before-input-event',escapeFullscreen);return page};
 const allowed=new Set(['state','open','close','navigate','back','forward','reload','layout','save']);
 ipcMain.handle('quadro:init',async e=>{trusted(e);const data=await store.get(['quadroPreferences','traderPreferences']);const initial={state:browser.state(),preferences:data.quadroPreferences||{theme:data.traderPreferences?.theme||'light'}};if(test&&process.argv.includes('--quadro-init-race')){win.webContents.send('browser:state',browser.state());await new Promise(resolve=>setTimeout(resolve,450));}return initial});
 ipcMain.handle('quadro:save',async(e,p)=>{trusted(e);if(!p||typeof p!=='object'||JSON.stringify(p).length>100000)throw Error('Invalid preferences');const value={tree:require('./quadro/layout.js').validate(p.tree),slots:p.slots,active:p.active,theme:p.theme,locale:p.locale==='en'?'en':'ru',aiOpen:p.aiOpen===true,aiWidth:Number(p.aiWidth)||360,aiId:p.aiId,aiSites:p.aiSites,aiSessions:p.aiSessions};await store.set({quadroPreferences:value});return true});
 ipcMain.handle('quadro:browser',(e,action,args={})=>{trusted(e);if(!allowed.has(action))throw Error('Unsupported browser action');return browser.command(action,args)});
 ipcMain.handle('quadro:window',(e,action)=>{trusted(e);if(action==='quit'){void exitController.request();return true}if(action==='minimize'){void require('./quadro-lifecycle.cjs').leaveFullscreen(win).then(()=>{if(!win.isDestroyed())win.minimize()});return true}if(action==='fullscreen'||action==='zoom'){win.setFullScreen(!win.isFullScreen());return true}if(action==='exit-fullscreen'){if(win.isFullScreen())win.setFullScreen(false);return true}throw Error('Unsupported window action')});
 ipcMain.handle('quadro:theme',(e,theme)=>{trusted(e);if(!['dark','light'].includes(theme))throw Error('Unsupported theme');nativeTheme.themeSource=theme;win.setBackgroundColor(theme==='light'?'#f3f5f9':'#10151e');return true});
 ipcMain.handle('quadro:wallet',async(e,action,args)=>{trusted(e);try{return await wallet.command(action,args)}catch(error){throw Error(error.message.replaceAll('Trader OS','Quadro Browser'))}});
 ipcMain.handle('quadro:update',(e,action)=>{trusted(e);if(!['check','download','open'].includes(action))throw Error('Unsupported update action');return updates.run(action)});
 win.webContents.on('preload-error',(_e,_p,error)=>log('PRELOAD_ERROR '+error.message));
 win.webContents.on('render-process-gone',(_e,detail)=>log('SHELL_STOPPED '+detail.reason));
 await win.loadURL(entry);show();
 await win.webContents.executeJavaScript("new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const s=document.documentElement.dataset.quadroReady;if(s==='true'){clearInterval(t);resolve()}else if(s==='error'||++n>300){clearInterval(t);reject(Error('Quadro UI failed to start'))}},100)})");
 log('QUADRO_READY '+app.getVersion());
 if(test&&process.argv.some(x=>/^--quadro-smoke-(write|read)$/.test(x)))await require('./quadro-smoke.cjs')({app,win,browser,store,libraryService,overlayGate,startService});
 if(test&&process.argv.some(x=>x.startsWith('--quadro-close-test=')))await require('./quadro-close-smoke.cjs')({app,win,store,log});
}).catch(error=>{log('STARTUP_FAILED '+error.stack);if(!test)dialog.showErrorBox('Quadro Browser — ошибка запуска','Локальные данные не удалены.\n'+error.message+'\nЖурнал: '+logFile);app.exit(1)});
