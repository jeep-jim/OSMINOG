'use strict';
const {app,BrowserWindow,ipcMain,shell,session}=require('electron');
const path=require('node:path'),{pathToFileURL}=require('node:url'),{Store}=require('./storage.cjs');
app.setName('OSMINOG Preview');
const ownsProfile=app.requestSingleInstanceLock();
if(!ownsProfile)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
let win,browser,updates;
const {autoUpdater}=require('electron-updater');
const entry=pathToFileURL(path.join(__dirname,'board/editor.html')).href;
function trusted(event){if(!require('./trust.cjs').trustedFrame(event,win,entry))throw Error('Untrusted frame');}
async function external(url){const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Unsupported link');await shell.openExternal(parsed.href);return{url:parsed.href};}
if(ownsProfile)app.whenReady().then(async()=>{
 const store=new Store(app.getPath('userData'));
 for(const op of ['get','set','remove'])ipcMain.handle('store:'+op,async(e,arg)=>{trusted(e);const result=await store[op](arg);if(op!=='get')win.webContents.send('store:changed',result);return op==='get'?result:undefined});
 ipcMain.handle('external:open',(e,url)=>{trusted(e);return external(url)});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win=new BrowserWindow({width:1440,height:960,minWidth:800,minHeight:600,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(!require('./trust.cjs').sameDocument(url,entry))e.preventDefault()});
 browser=new (require('./browser.cjs').BrowserWorkspace)(win);
 const providers=new (require('./provider.cjs').Providers)(browser);
 ipcMain.handle('provider:runtime',async(e,message,projectId)=>{trusted(e);try{return await providers.runtime(message,String(projectId||''))}catch(error){return{ok:false,error:error.message}}});
 updates=new (require('./updates.cjs').Updates)({updater:autoUpdater,version:app.getVersion(),packaged:app.isPackaged,save:async()=>{await win.webContents.executeJavaScript('persist()');await store.queue;await store.read()},emit:state=>{if(!win.isDestroyed())win.webContents.send('update:state',state)}});
 for(const action of ['check','download','install'])ipcMain.handle('update:'+action,e=>{trusted(e);return updates[action]()});
 ipcMain.handle('update:state',e=>{trusted(e);return{...updates.state}});
 ipcMain.handle('browser:command',(e,action,args)=>{trusted(e);return browser.command(action,args)});
 win.once('ready-to-show',()=>win.show());
 await win.loadURL(entry);
 if(process.argv.includes('--provider-smoke')){
  try{await require('./provider-smoke.cjs')(win,browser);app.exit(0)}catch(e){console.error(e);app.exit(1)}return;
 }
 if(process.argv.includes('--browser-smoke')){
  try{await require('./browser-smoke.cjs')(win,browser);app.exit(0)}catch(e){console.error(e);app.exit(1)}return;
 }
 if(process.argv.includes('--smoke')){
  try{
   await win.webContents.executeJavaScript('OSMINOGStateReady');
   await win.webContents.executeJavaScript("(async()=>{await OSMINOGNative.set({nativeIpcSmoke:'actual-host-storage'});if((await OSMINOGNative.get('nativeIpcSmoke')).nativeIpcSmoke!=='actual-host-storage')throw Error('Native IPC storage failed')})()");
   if((await store.get('nativeIpcSmoke')).nativeIpcSmoke!=='actual-host-storage')throw Error('Host storage write missing');
   await win.webContents.executeJavaScript(`(async()=>{document.querySelector('#osminogStorageOnboarding')?.close();createProject();createObject('text',{name:'Native smoke',text:'Windows persistence'});state.theme='light';applyTheme();await persist();if(!document.querySelector('#versionButton'))throw Error('Update button missing')})()`);
   await win.webContents.executeJavaScript("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
   const fs=require('node:fs/promises');
   await fs.writeFile('smoke-light.png',(await win.webContents.capturePage()).toPNG());
   await win.webContents.executeJavaScript("(async()=>{toggleTheme();await persist();if(state.theme!=='dark')throw Error('Dark theme not reached')})()");
   await win.webContents.executeJavaScript("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
   await fs.writeFile('smoke-dark.png',(await win.webContents.capturePage()).toPNG());
   await new Promise(r=>{win.webContents.once('did-finish-load',r);win.reload()});
   await win.webContents.executeJavaScript('OSMINOGStateReady');
   const found=await win.webContents.executeJavaScript("state.theme==='dark'&&objects().some(o=>o.name==='Native smoke')");if(!found)throw Error('Persistence failed');
   console.log('DESKTOP_SMOKE_PASS');app.exit(0);
  }catch(e){console.error(e);app.exit(1)}
 }
});
app.on('window-all-closed',()=>app.quit());

