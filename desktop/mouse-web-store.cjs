'use strict';
const path=require('node:path');
const {ID}=require('./mouse-extension-crx.cjs');
const ORIGIN='https://chromewebstore.google.com';
function storeURL(value){try{const u=new URL(value);return u.origin===ORIGIN&&!u.username&&!u.password&&u.protocol==='https:';}catch{return false;}}
function detailID(value){if(!storeURL(value))return null;const parts=new URL(value).pathname.split('/').filter(Boolean);return parts[0]==='detail'&&ID.test(parts.at(-1)||'')?parts.at(-1):null;}
function installMouseWebStore({app,browser,win,ipcMain,dialog,extensions,isAvailable,onChanged=()=>{}}){
 const session=browser.session,observed=new WeakSet(),gestures=new WeakMap(),receipts=new WeakMap(),pending=new Map(),browserPending=new Set(),shell=win.webContents;
 let disposed=false,shellGesture=null;
 const pages=()=>[...browser.tabs.values(),...browser.providers.values()];
 function owned(wc){return wc&&!wc.isDestroyed()&&wc.session===session&&pages().some(t=>!t.managedExtension&&t.view.webContents===wc);}
 function validate(event){
  const frame=event.senderFrame,wc=event.sender;
  if(!isAvailable()||!owned(wc)||!frame||frame!==wc.mainFrame||frame.parent||frame.detached||!storeURL(frame.url)||!storeURL(wc.getURL()))throw Error('Установка доступна только на странице Chrome Web Store в обычном профиле.');
  return {wc,frame,url:frame.url};
 }
 function gesture(wc){const record=gestures.get(wc);gestures.delete(wc);if(!record||Date.now()-record.at>8000||record.url!==wc.getURL())throw Error('Нажмите кнопку установки на странице магазина.');return record;}
 function watch(wc){if(wc.session!==session||observed.has(wc))return;observed.add(wc);
  const input=(_event,value)=>{if(storeURL(wc.getURL())&&((value.type==='mouseDown'&&value.button==='left')||(value.type==='keyDown'&&['Enter',' ','Space'].includes(value.key))))gestures.set(wc,{at:Date.now(),url:wc.getURL(),type:value.type});};
  wc.on('before-mouse-event',input);wc.on('before-input-event',input);
  wc.on('did-start-navigation',(_event,_url,inPlace,main)=>{const controller=pending.get(wc);if(main!==false&&(!inPlace||browserPending.has(controller))){gestures.delete(wc);controller?.abort();}});
  wc.once('destroyed',()=>{pending.get(wc)?.abort();pending.delete(wc);});
 }
 const onCreated=(_event,wc)=>watch(wc);app.on('web-contents-created',onCreated);for(const page of pages())watch(page.view.webContents);
 session.registerPreloadScript({id:'mouse-chrome-web-store',type:'frame',filePath:path.join(__dirname,'mouse-web-store-preload.cjs')});
 const browserAvailable=()=>!disposed&&!browser.disposed&&!browser.privateMode&&browser.session===session&&isAvailable()&&!win.isDestroyed()&&shell&&win.webContents===shell&&!shell.isDestroyed();
 const shellInput=(_event,value)=>{if(browserAvailable()&&((value.type==='mouseDown'&&value.button==='left')||(value.type==='keyDown'&&['Enter',' ','Space'].includes(value.key))))shellGesture={at:Date.now(),url:shell.getURL(),frame:shell.mainFrame,type:value.type};};
 const clearShell=()=>{shellGesture=null;for(const controller of browserPending)controller.abort();};
 const shellNavigation=(_event,_url,_inPlace,main)=>{if(main!==false)clearShell();};
 shell?.on('before-mouse-event',shellInput);shell?.on('before-input-event',shellInput);shell?.on('did-start-navigation',shellNavigation);shell?.once('destroyed',clearShell);
 function browserPage(tabId){
  if(typeof tabId!=='string'||!tabId||tabId.length>100||!browserAvailable())return null;
  const page=browser.tabs.get(tabId),project=browser.project,bank=browser.mouseDesktops?.bank,desktopId=bank?.active;
  if(!page||page.managedExtension||page.internal||!project||page.project!==project)return null;
  if(bank&&(!desktopId||bank.members?.[tabId]!==desktopId))return null;
  const wc=page.view?.webContents;if(!owned(wc)||wc===shell)return null;
  const frame=wc.mainFrame,url=wc.getURL(),extensionId=detailID(url);
  if(!extensionId||!frame||frame.detached||frame.parent||frame.url!==url)return null;
  return{tabId,page,project,bank,desktopId,wc,frame,url,extensionId};
 }
 function currentPage(tabId){const context=browserPage(tabId);if(!context)return null;const {page,wc,extensionId,url}=context;return{tabId,extensionId,url,webContentsId:wc.id,title:typeof page.title==='string'?page.title:url};}
 const management=()=>extensions.state().filter(e=>e.source==='chrome-web-store').map(e=>({id:e.id,name:e.name,version:e.version,enabled:e.enabled,installType:'normal',type:'extension',isApp:false,mayDisable:true}));
 const notify=(wc,event,data)=>{if(!wc.isDestroyed()&&storeURL(wc.getURL()))wc.send('mouse:web-store-event',{event,data});try{onChanged();}catch{}};
 async function installFromBrowser(tabId){
  // This capability belongs to the trusted browser UI. A guest's native input
  // never authorizes it, and even a rejected request consumes the shell input.
  const input=shellGesture;shellGesture=null;
  const context=browserPage(tabId);if(!context)return{result:'invalid_id',message:'Откройте страницу расширения Chrome Web Store в обычном профиле Mouse.'};
  const {page,project,bank,desktopId,wc,frame,url,extensionId}=context;
  if(pending.has(wc))return{result:'install_in_progress'};
  const age=input?Date.now()-input.at:Infinity;
  if(!input||age<0||age>8000||!input.frame||input.frame!==shell.mainFrame||input.frame.detached||input.frame.parent||input.frame.url!==input.url||input.url!==shell.getURL())return{result:'user_gesture_required',message:'Нажмите «Установить в Mouse» в меню расширений.'};
  const receipt={requestSource:'browser-control',tabId,webContentsId:wc.id,nativeGestureWebContentsId:shell.id,extensionId,url,beginAt:Date.now(),nativeGestureAt:input.at,nativeGestureType:input.type};receipts.set(wc,receipt);
  const controller=new AbortController();pending.set(wc,controller);browserPending.add(controller);watch(wc);
  const valid=()=>{const current=browserPage(tabId);return!controller.signal.aborted&&!!current&&current.page===page&&current.project===project&&current.bank===bank&&current.desktopId===desktopId&&current.wc===wc&&current.frame===frame&&current.url===url&&current.extensionId===extensionId&&shell.mainFrame===input.frame&&!input.frame.detached&&!input.frame.parent&&input.frame.url===input.url&&shell.getURL()===input.url;};
  let committed=false,installed;
  const onCommit=()=>{
   if(!valid())throw Error('Страница установки изменилась. Повторите установку из магазина.');
   installed=management().find(e=>e.id===extensionId&&e.enabled);
   if(!installed||extensions.chromiumId(extensionId)!==extensionId)throw Error('Расширение не загрузилось');
   receipt.installedAt=Date.now();receipt.result='success';receipt.completeAt=Date.now();receipt.completionSource='browser-control';committed=true;
  };
  try{
   await extensions.installStore(extensionId,{signal:controller.signal,valid,onCommit});
   if(!committed)throw Error('Расширение не загрузилось');
   // Navigation after the completed transaction cannot undo its truthful result.
   // Only send the guest notification while the original owner is still current.
   try{if(valid())notify(wc,'installed',installed);}catch{}return{result:'success'};
  }catch(error){receipt.result=error.code==='USER_CANCELLED'?'user_cancelled':'install_error';return{result:receipt.result,message:/^(?:CRX_|USER_CANCELLED)/.test(error.code||'')||/^(?:В Mouse|Поддерживаются|Темы, приложения|Расширения доступны|Страница установки|Не удалось прочитать|Расширение не загрузилось)/.test(error.message)?error.message:'Не удалось установить расширение. Проверьте подключение и повторите.'};}
  finally{browserPending.delete(controller);if(pending.get(wc)===controller)pending.delete(wc);}
 }
 async function invoke(event,method,args=[]){
  const {wc,frame,url}=validate(event);if(!Array.isArray(args)||args.length>3)throw Error('Некорректный запрос магазина');
  if(method==='version')return {version_number:process.versions.chrome,app_name:'Mouse Browser'};
  if(method==='status'){
   const [id,manifestText]=args;if(!ID.test(id||''))return 'blocked_by_policy';
   if(typeof manifestText==='string'&&manifestText.length<256*1024){try{if(JSON.parse(manifestText).manifest_version!==3)return'deprecated_manifest_version';}catch{return'corrupted';}}
   const e=extensions.state().find(e=>e.id===id);return e?(e.error?'corrupted':e.enabled?'enabled':'disabled'):'installable';
  }
  if(method==='begin'){
   const [details]=args;if(!details||!ID.test(details.id||'')||detailID(url)!==details.id)return{result:'invalid_id',message:'Откройте страницу выбранного расширения.'};
   if(pending.has(wc))return {result:'install_in_progress'};
   let input;try{input=gesture(wc);}catch(error){return{result:'user_gesture_required',message:error.message};}
   const receipt={extensionId:details.id,url,beginAt:Date.now(),nativeGestureAt:input.at,nativeGestureType:input.type};receipts.set(wc,receipt);
   const controller=new AbortController();pending.set(wc,controller);
   const valid=()=>!controller.signal.aborted&&isAvailable()&&owned(wc)&&wc.mainFrame===frame&&!frame.detached&&frame.url===url&&wc.getURL()===url;
   try{await extensions.installStore(details.id,{signal:controller.signal,valid});const installed=management().find(e=>e.id===details.id&&e.enabled);if(!installed)throw Error('Расширение не загрузилось');receipt.result='success';receipt.installedAt=Date.now();notify(wc,'installed',installed);return{result:'success'};}
   catch(error){receipt.result=error.code==='USER_CANCELLED'?'user_cancelled':'install_error';return{result:receipt.result,message:/^(?:CRX_|USER_CANCELLED)/.test(error.code||'')||/^(?:В Mouse|Поддерживаются|Темы, приложения|Расширения доступны|Страница установки|Не удалось прочитать|Расширение не загрузилось)/.test(error.message)?error.message:'Не удалось установить расширение. Проверьте подключение и повторите.'};}
   finally{pending.delete(wc);}
  }
  if(method==='complete'){const success=ID.test(args[0]||'')&&detailID(url)===args[0]&&extensions.state().some(e=>e.id===args[0]&&e.enabled&&e.source==='chrome-web-store'),receipt=receipts.get(wc);if(success&&receipt?.extensionId===args[0]&&receipt.requestSource!=='browser-control')receipt.completeAt=Date.now();return success?'success':'install_error';}
  if(method==='getAll')return management();
  if(method==='setEnabled'){
   gesture(wc);const [id,enabled]=args;if(!ID.test(id||'')||typeof enabled!=='boolean')throw Error('Некорректный запрос магазина');await extensions.setEnabled(id,enabled);notify(wc,enabled?'enabled':'disabled',management().find(e=>e.id===id));return true;
  }
  if(method==='uninstall'){
   gesture(wc);const [id]=args,entry=management().find(e=>e.id===id);if(!entry)throw Error('Расширение не установлено');
   const choice=await dialog.showMessageBox(win,{type:'question',title:'Удалить расширение?',message:entry.name,buttons:['Отмена','Удалить'],defaultId:0,cancelId:0,noLink:true});
   validate(event);if(choice.response!==1)return'user_cancelled';await extensions.remove(id);notify(wc,'uninstalled',id);return'success';
  }
  if(method==='webgl')return app.getGPUFeatureStatus().webgl?.startsWith('enabled')?'webgl_allowed':'webgl_blocked';
  throw Error('Неподдерживаемый запрос Chrome Web Store');
 }
 ipcMain.handle('mouse:web-store',invoke);
 return Object.freeze({invoke,currentPage,installFromBrowser,installEvidence:wc=>{const receipt=receipts.get(wc);return receipt?structuredClone(receipt):null;},dispose(){disposed=true;clearShell();browserPending.clear();for(const c of pending.values())c.abort();pending.clear();shell?.removeListener('before-mouse-event',shellInput);shell?.removeListener('before-input-event',shellInput);shell?.removeListener('did-start-navigation',shellNavigation);shell?.removeListener('destroyed',clearShell);app.removeListener('web-contents-created',onCreated);ipcMain.removeHandler('mouse:web-store');try{session.unregisterPreloadScript('mouse-chrome-web-store');}catch{}}});
}
module.exports={installMouseWebStore,storeURL,detailID};
