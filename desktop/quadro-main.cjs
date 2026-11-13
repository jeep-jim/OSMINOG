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
let win,browser,store,quitting=false,flushed=false;
const entry=pathToFileURL(path.join(__dirname,'quadro/index.html')).href;
function show(){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus()}
function trusted(e){if(!require('./trust.cjs').trustedFrame(e,win,entry))throw Error('Untrusted frame')}
const ownsProfile=app.requestSingleInstanceLock();
if(!ownsProfile)app.quit();
app.on('second-instance',show);app.on('activate',show);
app.on('before-quit',event=>{quitting=true;if(flushed||!browser||!store)return;event.preventDefault();Promise.resolve().then(async()=>{await browser.save();await browser.saveQueue;await store.queue}).catch(error=>log('SAVE_FAILED '+error.message)).finally(()=>{flushed=true;app.quit()})});
app.on('window-all-closed',()=>{if(quitting)app.quit()});
if(ownsProfile)app.whenReady().then(async()=>{
 store=new (require('./storage.cjs').Store)(app.getPath('userData'));
 const wallet=new (require('./wallet-vault.cjs').WalletVault)(store);
 nativeTheme.themeSource='light';
 win=new BrowserWindow({title:'Quadro Browser',width:1440,height:960,minWidth:800,minHeight:600,show:false,backgroundColor:'#f3f5f9',titleBarStyle:'hiddenInset',trafficLightPosition:{x:14,y:18},webPreferences:{preload:path.join(__dirname,'quadro-preload.cjs'),additionalArguments:['--quadro-version='+app.getVersion(),...(test?['--quadro-test']:[])],nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
 win.on('close',e=>{if(!quitting){e.preventDefault();win.hide()}});
 const send=name=>{show();if(win.webContents.getURL()===entry)win.webContents.send('quadro:menu',name)};
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Quadro Browser',submenu:[{role:'about'},{label:'Проверить обновление…',click:()=>send('updates')},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
  {label:'Файл',submenu:[{label:'Новая вкладка',accelerator:'Cmd+T',click:()=>send('new-tab')},{label:'Адрес страницы',accelerator:'Cmd+L',click:()=>send('address')},{label:'Новое окно в раскладке',accelerator:'Cmd+Shift+T',click:()=>send('split-x')},{label:'Закрыть вкладку',accelerator:'Cmd+W',click:()=>send('close-tab')}]},
  {label:'Правка',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'pasteAndMatchStyle'},{role:'selectAll'}]},
  {label:'Вид',submenu:[{label:'Обновить страницу',accelerator:'Cmd+R',click:()=>send('reload')},{label:'Показать / скрыть ИИ',accelerator:'Cmd+Shift+I',click:()=>send('ai')},{label:'Сменить тему',click:()=>send('theme')},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},
  {label:'Окно',submenu:[{role:'minimize'},{role:'zoom'},{type:'separator'},{role:'front'}]}
 ]));
 // No menu-bar status item: the Dock icon and native application menu are sufficient.
 app.setAboutPanelOptions({applicationName:'Quadro Browser',applicationVersion:app.getVersion(),copyright:'Локальный многооконный браузер',credits:'macOS Apple Silicon preview'});
 session.defaultSession.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault()});
 browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);
 await browser.initNetwork();await browser.command('project',{id:'trader-os-main'});
 // Custom AI links are ordinary sandboxed webpages. No automatic AI executor or background context reader.
 browser.contextScope=[];
 const updates=new (require('./quadro-update.cjs').QuadroUpdates)({app,shell,emit:state=>{if(!win.isDestroyed())win.webContents.send('quadro:update-state',state)}});
 const allowed=new Set(['state','open','close','navigate','back','forward','reload','layout','save']);
 ipcMain.handle('quadro:init',async e=>{trusted(e);const data=await store.get(['quadroPreferences','traderPreferences']);return{state:browser.state(),preferences:data.quadroPreferences||{theme:data.traderPreferences?.theme||'light'}}});
 ipcMain.handle('quadro:save',async(e,p)=>{trusted(e);if(!p||typeof p!=='object'||JSON.stringify(p).length>100000)throw Error('Invalid preferences');const value={tree:require('./quadro/layout.js').validate(p.tree),slots:p.slots,active:p.active,theme:p.theme,aiOpen:p.aiOpen===true,aiWidth:Number(p.aiWidth)||360,aiId:p.aiId,aiSites:p.aiSites,aiSessions:p.aiSessions};await store.set({quadroPreferences:value});return true});
 ipcMain.handle('quadro:browser',(e,action,args={})=>{trusted(e);if(!allowed.has(action))throw Error('Unsupported browser action');return browser.command(action,args)});
 ipcMain.handle('quadro:theme',(e,theme)=>{trusted(e);if(!['dark','light'].includes(theme))throw Error('Unsupported theme');nativeTheme.themeSource=theme;win.setBackgroundColor(theme==='light'?'#f3f5f9':'#10151e');return true});
 ipcMain.handle('quadro:wallet',async(e,action,args)=>{trusted(e);try{return await wallet.command(action,args)}catch(error){throw Error(error.message.replaceAll('Trader OS','Quadro Browser'))}});
 ipcMain.handle('quadro:update',(e,action)=>{trusted(e);if(!['check','download','open'].includes(action))throw Error('Unsupported update action');return updates.run(action)});
 win.webContents.on('preload-error',(_e,_p,error)=>log('PRELOAD_ERROR '+error.message));
 win.webContents.on('render-process-gone',(_e,detail)=>log('SHELL_STOPPED '+detail.reason));
 await win.loadURL(entry);show();
 await win.webContents.executeJavaScript("new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const s=document.documentElement.dataset.quadroReady;if(s==='true'){clearInterval(t);resolve()}else if(s==='error'||++n>300){clearInterval(t);reject(Error('Quadro UI failed to start'))}},100)})");
 log('QUADRO_READY '+app.getVersion());
 if(test&&process.argv.some(x=>/^--quadro-smoke-(write|read)$/.test(x)))await require('./quadro-smoke.cjs')({app,win,browser,store});
}).catch(error=>{log('STARTUP_FAILED '+error.stack);if(!test)dialog.showErrorBox('Quadro Browser — ошибка запуска','Локальные данные не удалены.\n'+error.message+'\nЖурнал: '+logFile);app.exit(1)});
