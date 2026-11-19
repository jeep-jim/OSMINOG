'use strict';
const {randomUUID}=require('node:crypto');
const {MemoryStore,clearPrivateSession}=require('./mouse-private-core.cjs');
class PrivateMode {
 constructor(options){Object.assign(this,options);this.current=null;this.busy=false;}
 async reload(){
  await this.win.loadURL(this.entry);
  await this.win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const s=document.documentElement.dataset.mouseReady;if(s==='true'){clearInterval(t);resolve()}else if(s==='error'||++n>200){clearInterval(t);reject(Error('Не удалось открыть режим браузера'))}},50)})`);
 }
 async toggle(){
  if(this.busy)return;this.busy=true;
  try{if(this.current)await this.leave();else await this.enter();}
  finally{this.busy=false;}
 }
 async enter(){
  await this.prepareDocuments?.();
  this.onPrivacyChange?.();
  const {win,normalBrowser,normalGate,normalStore,router,trusted,test}=this;
  await win.webContents.executeJavaScript('globalThis.MouseFlush?.()');
  await normalBrowser.save();await normalBrowser.saveQueue;
  // Destroy the old host JS context before switching privileged IPC destinations.
  await win.loadURL('about:blank');
  const saved=(await normalStore.get('quadroPreferences')).quadroPreferences||{};
  const store=new MemoryStore({quadroPreferences:{theme:saved.theme||'dark',locale:saved.locale||'ru',aiOpen:false,aiWidth:360,libraryWidth:380},quadroStartPage:{background:'plain',showRecent:false}});
  const partition='mouse-private-'+randomUUID();
  const ses=this.e.session.fromPartition(partition,{cache:false});
  if(ses.isPersistent())throw Error('Приватная сессия не должна сохраняться на диск');
  normalGate.blocked=true;normalGate.hide();
  const emit=normalBrowser.emit;normalBrowser.emit=()=>{};
  const handlers=new Map(),listeners=[];
  const register={handle:(channel,fn)=>{handlers.set(channel,fn);}};
  const remember=(target,event)=>{const before=target.listeners(event);return()=>{for(const fn of target.listeners(event))if(!before.includes(fn))listeners.push([target,event,fn]);};};
  const collect=[remember(win,'resize'),remember(win,'closed'),remember(win.webContents,'did-start-navigation')];
  const browser=new (require('./browser.cjs').BrowserWorkspace)(win,store,{session:ses,privateMode:true});browser.mouseRoundedPanes=true;browser.mouseCornerMask=rects=>require('./mouse-native-menu.node').paneCorners(rects);
  require('./mouse-stability.cjs').installWorkspace(browser);
  // Explicitly bind only this private workspace's pages. Embedded views can
  // report no owning BrowserWindow while native fullscreen reparents them.
  const makePrivate=browser.make.bind(browser);
  browser.make=(...args)=>{const page=makePrivate(...args);page.view.webContents.on('before-input-event',(event,input)=>{
   if(input.type==='keyDown'&&input.key==='Escape'&&this.paneFocus?.active){event.preventDefault();this.paneFocus.leave();}
  });return page;};
  collect.forEach(fn=>fn());
  const gate=new (require('./mouse-overlays.cjs').OverlayGate)(browser,win);
  const current={store,ses,partition,browser,gate,handlers,emit,listeners,libraryService:null,startService:null};this.current=current;
  try{
   browser.contextScope=[];await browser.initNetwork();await browser.command('project',{id:'mouse-private'});
   const send=name=>{if(!win.isDestroyed())win.webContents.send('mouse:menu',name);};
   require('./mouse-shell.cjs').install({win,browser,ipcMain:register,trusted,send,test,captureScreen:()=>this.globalCapture.request(),reuseChrome:win.mouseChromeGuard});
   register.handle('mouse:overlay',(event,state)=>{trusted(event);return gate.set(state);});
   const libraryService=await require('./mouse-browsing.cjs').install({app:this.e.app,win,browser,store,ipcMain:register,trusted,shell:this.e.shell,dialog:this.e.dialog,test,searchEngine:normalBrowser.mouseSearch?.state().engine});
   current.libraryService=libraryService;
   // Do not even keep private visit/search/closed lists in the library UI.
   for(const name of ['visit','title','input','closed'])libraryService.library[name]=()=>{};
   const startService=await require('./mouse-start.cjs').install({app:this.e.app,win,browser,store,libraryService,ipcMain:register,trusted,dialog:this.e.dialog,test,privateMode:true});
   current.startService=startService;
   if(this.documentService)require('./mouse-document-tabs.cjs').install({browser,documents:this.documentService,closeDocument:this.closeDocumentTab,library:libraryService.library,privateMode:true});
   require('./mouse-ai-icons.cjs').install({win,browser,store,ipcMain:register,trusted});
   // Place the one fresh private start page before the bank's first checkpoint.
   // Saved empty slots remain intentional; renderer reconciliation stays prune-only.
   const initialTab=await browser.command('open',{url:'mouse://start',lane:'main'});
   const initialPreferences=(await store.get('quadroPreferences')).quadroPreferences||{};
   await store.set({quadroPreferences:{...initialPreferences,slots:{p1:initialTab.id},active:'p1',tabOrder:[initialTab.id]}});
   const desktopService=await require('./mouse-desktops.cjs').install({win,browser,store,ipcMain:register,trusted,powerMonitor:this.e.powerMonitor});
   current.desktopService=desktopService;current.pageZoom=await require('./mouse-zoom.cjs').install({win,browser,store,ipcMain:register,trusted});
   register.handle('mouse:init',async event=>{trusted(event);return{privateMode:true,state:browser.state(),preferences:desktopService.preferences()};});
   register.handle('mouse:save',async(event,p,history)=>{trusted(event);if(!p||typeof p!=='object'||JSON.stringify(p).length>100000)throw Error('Invalid private preferences');require('./mouse/layout.js').validate(p.tree);return desktopService.savePreferences(p,history);});
   const allowed=new Set(['state','open','close','navigate','back','forward','reload','layout','save']);
   register.handle('mouse:browser',(event,action,args={})=>{trusted(event);if(!allowed.has(action))throw Error('Unsupported private action');return browser.command(action,args);});
   for(const name of ['mouse:privacy','mouse:window','mouse:theme','mouse:documents','mouse:desktop-gesture'])handlers.set(name,router.normal.get(name));
   handlers.set('mouse:global-capture-admin',(event,action,args)=>{trusted(event);if(!['state','request','permission'].includes(action))throw Error('Настройки системного сочетания меняются в обычном режиме');return router.normal.get('mouse:global-capture-admin')(event,action,args);});
   handlers.set('mouse:agent',(event,action)=>{trusted(event);if(action==='state')return{enabled:false,running:false,connected:0,desk:'',logs:[],pending:null};throw Error('Agent Mouse доступен в обычном режиме');});
   handlers.set('mouse:progress',(event,action)=>{trusted(event);if(action==='state')return{tasks:[],revision:0};throw Error('Прогресс подключённого ИИ доступен в обычном режиме');});
   handlers.set('mouse:update',()=>{throw Error('Обновление доступно в обычном режиме');});
   // Explicit file downloads are allowed, but clearly distinguished from ephemeral browsing data.
   const warning=(_event,item)=>item.setSaveDialogOptions({title:'Инкогнито: сохранённый файл останется на Mac',defaultPath:require('node:path').join(this.e.app.getPath('downloads'),require('node:path').basename(item.getFilename()||'download')),properties:['showOverwriteConfirmation']});
   ses.on('will-download',warning);
   router.use(handlers);await this.reload();
  }catch(error){await this.dispose();router.use(null);normalGate.blocked=false;normalGate.sequence=0;normalBrowser.emit=emit;await this.reload();throw error;}
 }
 async dispose(){
  const c=this.current;if(!c)return;
  // Stop every private renderer before clearing its in-memory session.
  c.browser.emit=()=>{};c.gate.blocked=true;c.gate.hide();
  for(const item of c.libraryService?.live.values()||[])item.cancel();
  c.browser.dispose();
  for(const [target,event,fn] of c.listeners)target.removeListener(event,fn);
  if(c.libraryService){clearTimeout(c.libraryService.library.timer);c.libraryService.library.ready=false;c.libraryService.library.data={};}
  c.ses.removeAllListeners('will-download');
  await clearPrivateSession(c.ses);
  c.ses.setPermissionCheckHandler(null);c.ses.setPermissionRequestHandler(null);
  c.browser.snapshots={};c.browser.restored.clear();c.startService?.tabs.clear();
  c.store.destroy();c.handlers.clear();this.current=null;
 }
 async leave(){
  await this.prepareDocuments?.();
  this.onPrivacyChange?.();
  const emit=this.current.emit;await this.win.loadURL('about:blank');await this.dispose();this.router.use(null);
  this.normalBrowser.emit=emit;this.normalGate.sequence=0;this.normalGate.blocked=false;this.normalGate.desired=[];
  await this.reload();
 }
}
module.exports={PrivateMode};
