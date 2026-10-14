'use strict';
const {app,BrowserWindow,ipcMain,shell,session,Tray,Menu}=require('electron');
const path=require('node:path'),{pathToFileURL}=require('node:url'),{Store}=require('./storage.cjs');
app.setName('OSMINOG Preview');
if(process.platform==='win32')app.setAppUserModelId('com.osminog.desktop.preview');
const ownsProfile=app.requestSingleInstanceLock();
if(!ownsProfile)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
let win,browser,updates,tray;
const {autoUpdater}=require('electron-updater');
const entry=pathToFileURL(path.join(__dirname,'board/editor.html')).href;
function trusted(event){if(!require('./trust.cjs').trustedFrame(event,win,entry)){const frame=event.senderFrame,main=win&&!win.isDestroyed()?win.webContents.mainFrame:null;const reason=!main?'window-closed':!frame||frame.detached?'frame-detached':frame.processId!==main.processId||frame.routingId!==main.routingId?'different-frame':'different-document';throw Error('Untrusted frame: '+reason);}}
async function external(url){const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Unsupported link');await shell.openExternal(parsed.href);return{url:parsed.href};}
if(ownsProfile)app.whenReady().then(async()=>{
 const store=new Store(app.getPath('userData'));
 for(const op of ['get','set','remove'])ipcMain.handle('store:'+op,async(e,arg)=>{trusted(e);const result=await store[op](arg);if(op!=='get')win.webContents.send('store:changed',result);return op==='get'?result:undefined});
 ipcMain.handle('external:open',(e,url)=>{trusted(e);return external(url)});
 ipcMain.handle('file:save',(e,args)=>{trusted(e);return require('./file-save.cjs').saveFile(win,args)});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 const shellIcon=require('./windows-identity.cjs').installIdentity({app,shell});
 win=new BrowserWindow({icon:shellIcon,width:1440,height:960,minWidth:800,minHeight:600,show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--osminog-version='+app.getVersion()],nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}});
 if(process.platform==='win32')require('./windows-identity.cjs').applyTaskbar(win,shellIcon);
 if(!process.argv.some(a=>a.includes('smoke'))){tray=new Tray(shellIcon);tray.setToolTip('OSMINOG');const show=()=>{if(!win.isDestroyed()){win.show();if(win.isMinimized())win.restore();win.focus()}};tray.on('click',show);tray.setContextMenu(Menu.buildFromTemplate([{label:'Открыть Осьминог',click:show},{type:'separator'},{label:'Выйти',click:()=>app.quit()}]));}
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(!require('./trust.cjs').sameDocument(url,entry))e.preventDefault()});
 browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);
 await browser.initNetwork();
 const providers=new (require('./provider.cjs').Providers)(browser);
 const control=new (require('./control.cjs').Control)(browser,providers);
 browser.control=control;
 ipcMain.handle('provider:runtime',async(e,message,projectId)=>{trusted(e);try{return await providers.runtime(message,String(projectId||''))}catch(error){return{ok:false,error:error.message}}});
 updates=new (require('./updates.cjs').Updates)({updater:autoUpdater,version:app.getVersion(),packaged:app.isPackaged,save:async()=>{await win.webContents.executeJavaScript('persist()');await browser.save();await browser.saveQueue;await store.queue;await store.read()},emit:state=>{if(!win.isDestroyed())win.webContents.send('update:state',state)}});
 for(const action of ['check','download','install'])ipcMain.handle('update:'+action,e=>{trusted(e);return updates[action]()});
 ipcMain.handle('update:state',e=>{trusted(e);return{...updates.state}});
 ipcMain.on('page:drag',(e,payload)=>{const t=[...browser.tabs.values(),...browser.providers.values()].find(t=>t.view.webContents===e.sender);const f=e.senderFrame,m=e.sender.mainFrame;if(!t||t.project!==browser.project||!f||f.processId!==m.processId||f.routingId!==m.routingId)return;const url=String(payload?.url||'').slice(0,45000000),text=String(payload?.text||'').slice(0,100000);const token=String(payload?.token||'');if(!/^[a-f0-9-]{32,36}$/.test(token))return;browser.dragTransfer={id:t.id,url,text,token,source:t.view.webContents.getURL(),project:browser.project,at:Date.now(),epoch:t.navigationEpoch};win.webContents.send('browser:media',{destination:'drag',id:t.id,token,project:browser.project})});
 function pageSender(e){
  const tab=[...browser.tabs.values(),...browser.providers.values()].find(t=>t.view.webContents===e.sender),frame=e.senderFrame,main=e.sender.mainFrame;
  if(!tab||tab.project!==browser.project||!frame||frame.processId!==main.processId||frame.routingId!==main.routingId||!require('./page-context.cjs').providerFor(e.sender.getURL()))throw Error('Неизвестный источник чата');
  return tab;
 }
 async function captureWorkspace(tab){
  const expected=browser.project;
  const before=await win.webContents.executeJavaScript('globalThis.OSMINOGDirectCanvas.snapshot()');
  const pages=await browser.command('context',{all:true,automatic:true,excludeId:tab.id,includeChats:false});
  const board=await win.webContents.executeJavaScript(`(()=>{
   const el=document.querySelector('.native-canvas #viewport'),r=el?.getBoundingClientRect();
   const rect=r&&r.width>0&&r.height>0&&!document.querySelector('.native-context:not([hidden])')?{x:Math.max(0,Math.ceil(r.x)),y:Math.max(0,Math.ceil(r.y)),width:Math.max(0,Math.floor(Math.min(r.right,innerWidth)-Math.max(0,r.x))),height:Math.max(0,Math.floor(Math.min(r.bottom,innerHeight)-Math.max(0,r.y)))}:null;
   return {rect,map:globalThis.BriefCraftBridge?.getProjectMap?.({limit:300}),viewport:globalThis.BriefCraftBridge?.getViewport?.(),objects:(globalThis.desktopObjects?.()||[]).slice(0,300).map(o=>({id:o.id,type:o.type,name:o.name,x:o.x,y:o.y,w:o.w,h:o.h,text:String(globalThis.objectText?.(o)||'').slice(0,2000)}))};
  })()`);
  const canvasState=await win.webContents.executeJavaScript('globalThis.OSMINOGDirectCanvas.snapshot()');
  if(before!==canvasState)throw Error('Холст изменился во время чтения; повторите отправку');
  const images=[];
  if(board?.rect?.width>0&&board.rect.height>0){const image=await win.webContents.capturePage(board.rect);if(!image.isEmpty())images.push({name:'OSMINOG-canvas.png',dataUrl:image.resize({width:Math.min(1600,image.getSize().width)}).toDataURL()})}
  if(browser.project!==expected||tab.project!==expected)throw Error('Проект изменился');
  return {schema:'osminog.browser-context/v1',project:expected,capturedAt:new Date().toISOString(),canvas:board.map,viewport:board.viewport,canvasObjects:board.objects,canvasState,canvasImageAttached:images.length>0,pages,images};
 }
 const direct=new (require('./direct-chat.cjs').DirectChat)(browser,providers,control,captureWorkspace);
 browser.direct=direct;
 ipcMain.handle('page:context',(e,args)=>direct.begin(pageSender(e),args?.prompt));
 ipcMain.handle('page:sent',(e,args)=>direct.start(pageSender(e),args?.turn));
 ipcMain.on('page:aborted',(e,args)=>{try{const tab=pageSender(e);if(direct.turn?.source===tab.id&&direct.turn?.id===args?.turn)direct.stop()}catch{}});
 ipcMain.handle('browser:command',(e,action,args)=>{trusted(e);if(action==='media-attach'){return providers.attach(args)}if(action==='stop-ai'){direct.stop();control.stop();return providers.stop()}if(action.startsWith('control-'))return control.command(action.slice(8),args);return browser.command(action,args)});
 win.once('ready-to-show',()=>win.show());
 await win.loadURL(entry);
 if(process.argv.includes('--update-smoke')||process.argv.includes('--verify-update-smoke')){
  try{await require('./update-smoke.cjs')({app,win,browser,autoUpdater,updates,verify:process.argv.includes('--verify-update-smoke')})}catch(e){console.error(e);app.exit(1)}return;
 }
 if(process.argv.includes('--shell-smoke')){try{await require('./shell-smoke.cjs')(win,browser);app.exit(0)}catch(e){console.error(e);app.exit(1)}return;}
 if(process.argv.includes('--provider-smoke')){
  try{await require('./provider-smoke.cjs')(win,browser,providers);app.exit(0)}catch(e){console.error(e);app.exit(1)}return;
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




