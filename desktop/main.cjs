'use strict';
const {app,BrowserWindow,ipcMain,shell,session}=require('electron');
const path=require('node:path'),{pathToFileURL}=require('node:url'),{Store}=require('./storage.cjs');
app.setName('OSMINOG Preview');
let win,downloaded=false;
const {autoUpdater}=require('electron-updater');
autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=false;
autoUpdater.on('error',e=>console.error('Update:',e.message));
const entry=pathToFileURL(path.join(__dirname,'board/editor.html')).href;
function trusted(event){if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==entry)throw Error('Untrusted frame');}
async function external(url){const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Unsupported link');await shell.openExternal(parsed.href);return{url:parsed.href};}
app.whenReady().then(async()=>{
 ipcMain.handle('update:check',async e=>{trusted(e);if(!app.isPackaged)throw Error('Обновление доступно только в установленном Windows-клиенте');const r=await autoUpdater.checkForUpdates();return{available:!!r?.isUpdateAvailable,latestVersion:r?.updateInfo?.version||app.getVersion(),source:'Windows Preview'}});
 ipcMain.handle('update:download',async e=>{trusted(e);await autoUpdater.downloadUpdate();downloaded=true;return{downloaded:true}});
 ipcMain.handle('update:install',e=>{trusted(e);if(!downloaded)throw Error('Пакет не скачан и не проверен');setTimeout(()=>autoUpdater.quitAndInstall(false,true),200);return true});
 const store=new Store(app.getPath('userData'));
 for(const op of ['get','set','remove'])ipcMain.handle('store:'+op,async(e,arg)=>{trusted(e);const result=await store[op](arg);if(op!=='get')win.webContents.send('store:changed',result);return op==='get'?result:undefined});
 ipcMain.handle('external:open',(e,url)=>{trusted(e);return external(url)});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win=new BrowserWindow({width:1440,height:960,minWidth:800,minHeight:600,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault()});
 win.once('ready-to-show',()=>win.show());
 await win.loadURL(entry);
 if(process.argv.includes('--smoke')){
  try{
   await win.webContents.executeJavaScript('OSMINOGStateReady');
   await win.webContents.executeJavaScript(`(async()=>{document.querySelector('#osminogStorageOnboarding')?.close();createProject();createObject('text',{name:'Native smoke',text:'Windows persistence'});await persist();toggleTheme();await persist();if(!['light','dark'].includes(state.theme))throw Error('Theme');if(!document.querySelector('#versionButton'))throw Error('Update button missing')})()`);
   await new Promise(r=>{win.webContents.once('did-finish-load',r);win.reload()});
   await win.webContents.executeJavaScript('OSMINOGStateReady');
   const found=await win.webContents.executeJavaScript("objects().some(o=>o.name==='Native smoke')");if(!found)throw Error('Persistence failed');
   console.log('DESKTOP_SMOKE_PASS');app.exit(0);
  }catch(e){console.error(e);app.exit(1)}
 }
});
app.on('window-all-closed',()=>app.quit());
