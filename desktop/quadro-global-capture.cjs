'use strict';
// The only automatic activity is an OS shortcut registration. A screen image is
// acquired once, only after a user shortcut/menu command, before showing UI.
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const SHORTCUT = 'Control+A';
const SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';
class GlobalCapture {
 constructor({electron,app,mainWindow,store,trusted,entryDirectory,test=false}) {
  this.e=electron;this.app=app;this.main=mainWindow;this.store=store;this.trusted=trusted;
  this.dir=entryDirectory;this.test=test;this.enabled=true;this.registered=false;this.busy=false;
  this.editor=null;this.pending=null;this.lastError='';this.captureCount=0;this.requests=0;
  this.editorEntry=pathToFileURL(path.join(this.dir,'quadro/capture-global.html')).href;
 }
 async init() {
  const saved=await this.store.get('quadroGlobalCapture');this.enabled=saved.quadroGlobalCapture?.enabled!==false;
  this.register();
  this.app.on('will-quit',()=>this.dispose());
  this.main.on('closed',()=>this.dispose());
  this.e.ipcMain.handle('quadro:global-capture-admin',async(event,action,args={})=>{
   this.trusted(event);
   if(action==='state')return this.state();
   if(action==='enable'){
    if(typeof args.enabled!=='boolean')throw Error('Invalid screenshot preference');
    this.enabled=args.enabled;this.register();await this.store.set({quadroGlobalCapture:{enabled:this.enabled}});return this.state();
   }
   if(action==='request'){void this.request();return this.state();}
   if(action==='permission'){await this.e.shell.openExternal(SETTINGS_URL);return this.state();}
   throw Error('Unsupported global screenshot command');
  });
  this.e.ipcMain.handle('quadro:global-capture-editor',async(event,action,args={})=>{
   if(!this.editor||!require('./trust.cjs').trustedFrame(event,this.editor,this.editorEntry))throw Error('Untrusted capture editor');
   if(action==='initial'){
    if(!this.pending)throw Error('Снимок уже открыт или закрыт');const image=this.pending;this.pending=null;return image;
   }
   if(action==='close'){this.editor.close();return true;}
   if(action==='copy'||action==='save')return require('./quadro-shell.cjs').exportPNG(action,args,this.editor);
   throw Error('Unsupported screenshot editor command');
  });
  return this;
 }
 permission(){return this.e.systemPreferences.getMediaAccessStatus('screen');}
 state(){return{enabled:this.enabled,registered:this.registered,shortcut:SHORTCUT,permission:this.permission(),error:this.lastError,runningOnly:true};}
 publish(){if(!this.main.isDestroyed())this.main.webContents.send('quadro:global-capture-state',this.state());}
 register(){
  if(this.registered)this.e.globalShortcut.unregister(SHORTCUT);
  this.registered=false;this.lastError='';
  if(this.enabled){
   try{this.registered=this.e.globalShortcut.register(SHORTCUT,()=>void this.request());}
   catch{this.registered=false;}
   if(!this.registered)this.lastError='Control+A занято другим приложением или недоступно. Освободите сочетание либо используйте пункт «Скриншот экрана Mac» в меню «Файл».';
  }
  this.publish();
 }
 async explainPermission(){
  this.lastError='Для снимка других приложений разрешите Mouse Browser запись экрана в настройках macOS. После выдачи разрешения может понадобиться перезапуск Mouse Browser.';this.publish();
  const options={type:'info',title:'Mouse Browser — скриншот экрана',message:'Нужно разрешение macOS на запись экрана',detail:this.lastError,buttons:['Отмена','Открыть настройки macOS'],defaultId:0,cancelId:0,noLink:true};
  const result=await this.e.dialog.showMessageBox(options);
  if(result.response===1)await this.e.shell.openExternal(SETTINGS_URL);
 }
 async acquire(display){
  const permission=this.permission();
  if(permission==='denied'||permission==='restricted'){await this.explainPermission();return null;}
  // No microphone, video stream, continuous screen polling or audio capture.
  const scale=Math.min(display.scaleFactor||1,8192/Math.max(display.size.width,display.size.height),Math.sqrt(40000000/(display.size.width*display.size.height)));
  const sources=await this.e.desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.max(1,Math.round(display.size.width*scale)),height:Math.max(1,Math.round(display.size.height*scale))},fetchWindowIcons:false});
  if(this.permission()!=='granted'){await this.explainPermission();return null;}
  const source=sources.find(s=>String(s.display_id)===String(display.id));
  if(!source||source.thumbnail.isEmpty())throw Error('macOS не предоставила снимок выбранного экрана. Проверьте разрешение записи экрана.');
  const base=source.thumbnail.toDataURL();require('./quadro-shell.cjs').pngBuffer(base);
  this.captureCount++;
  return{base,width:display.size.width,height:display.size.height,layers:[],kind:'screen'};
 }
 async request(){
  this.requests++;
  if(this.editor&&!this.editor.isDestroyed()){this.editor.show();this.editor.focus();return;}
  if(this.busy)return;this.busy=true;
  try{
   // Select the display containing the pointer BEFORE any Mouse window moves focus.
   const display=this.e.screen.getDisplayNearestPoint(this.e.screen.getCursorScreenPoint());
   const frame=this.test&&this.testFrame?this.testFrame:await this.acquire(display);
   if(!frame)return;this.pending=frame;await this.openEditor(display);this.lastError='';
  }catch(error){
   this.pending=null;this.lastError=String(error.message||'Не удалось создать скриншот').slice(0,500);
   if(this.editor&&!this.editor.isDestroyed())this.editor.destroy();this.editor=null;
   if(!this.test)await this.e.dialog.showMessageBox({type:'error',title:'Mouse Browser — скриншот',message:'Не удалось открыть снимок',detail:this.lastError,buttons:['Закрыть']});
  }finally{this.busy=false;this.publish();}
 }
 async openEditor(display){
  // This remains a normal browser app, never a menu-less UIElement helper.
  if(process.platform==='darwin')this.app.setActivationPolicy('regular');
  const b=display.workArea;
  const editor=new this.e.BrowserWindow({title:'Mouse Browser — Скриншот',x:b.x,y:b.y,width:b.width,height:b.height,minWidth:480,minHeight:360,frame:false,show:false,backgroundColor:'#151a23',alwaysOnTop:true,skipTaskbar:false,minimizable:false,fullscreenable:false,webPreferences:{preload:path.join(this.dir,'quadro-capture-preload.cjs'),additionalArguments:[`--quadro-capture-theme=${this.e.nativeTheme.shouldUseDarkColors?'dark':'light'}`,...(this.test?['--quadro-capture-test']:[])],sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false}});
  this.editor=editor;
  editor.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});
  if(process.platform==='darwin')this.app.setActivationPolicy('regular');
  editor.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  editor.webContents.on('will-navigate',(e,url)=>{if(url!==this.editorEntry)e.preventDefault();});
  editor.on('closed',()=>{this.pending=null;if(this.editor===editor)this.editor=null;if(process.platform==='darwin'&&!this.main.isDestroyed())this.app.setActivationPolicy('regular');});
  await editor.loadURL(this.editorEntry);
  await editor.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.documentElement.dataset.captureReady==='true'){clearInterval(t);resolve()}else if(document.documentElement.dataset.captureReady==='error'||++n>100){clearInterval(t);reject(Error('Не удалось подготовить редактор скриншота'))}},50)})`);
  if(!editor.isDestroyed()){editor.show();editor.focus();}
 }
 dispose(){
  if(this.registered)this.e.globalShortcut.unregister(SHORTCUT);this.registered=false;
  this.pending=null;if(this.editor&&!this.editor.isDestroyed())this.editor.destroy();this.editor=null;
 }
}
module.exports={GlobalCapture,SHORTCUT,SETTINGS_URL};
