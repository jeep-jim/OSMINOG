'use strict';

// Only the documented GitHub/Primer root theme contract is adapted. Standard
// websites already receive nativeTheme through prefers-color-scheme. This code
// never changes an account, cookie, storage item, network response, or image.
// https://primer.style/product/primitives/#theming
function createPageThemeTools(){
 const attributes=['data-color-mode','data-light-theme','data-dark-theme'];
 const lightThemes=new Set(['light','light_tritanopia','light_high_contrast','light_colorblind']);
 const darkThemes=new Set(['dark','dark_colorblind','dark_dimmed','dark_high_contrast','dark_tritanopia']);
 function isSupported(value){
  try{const url=new URL(value);return url.origin==='https://github.com'&&!url.username&&!url.password;}catch{return false;}
 }
 function install({document,window}){
  let enabled=false,suspended=false,disposed=false,root=null,original=null,frame=0;
  const applied=new Map(),written=new Set();
  const supported=()=>isSupported(window.location?.href||document.URL);
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const hasContract=node=>node&&['auto','light','dark'].includes(node.getAttribute('data-color-mode'))&&node.hasAttribute('data-light-theme')&&node.hasAttribute('data-dark-theme');
  const snapshot=node=>Object.fromEntries(attributes.map(name=>[name,node.getAttribute(name)]));
  function rememberSiteChanges(){
   if(!root||!original)return;
   for(const name of attributes){const value=root.getAttribute(name);if(!applied.has(name)||value!==applied.get(name))original[name]=value;}
  }
  function restore(){
   rootObserver.disconnect();
   rememberSiteChanges();
   if(root&&original)for(const name of written){
    // A late site write must not be overwritten by an old saved value.
    if(root.getAttribute(name)!==applied.get(name))continue;
    if(root.getAttribute(name)===original[name])continue;
    if(original[name]===null)root.removeAttribute(name);else root.setAttribute(name,original[name]);
   }
   original=null;applied.clear();written.clear();
  }
  function cancelFrame(){if(frame){window.cancelAnimationFrame(frame);frame=0;}}
  function refresh(){
   cancelFrame();
   if(disposed||suspended||!enabled||!supported()){
    documentObserver.disconnect();restore();root=null;return;
   }
   documentObserver.observe(document,{childList:true});
   const current=document.documentElement;
   if(current!==root){restore();root=current;}
   if(!root)return;
   rootObserver.disconnect();rememberSiteChanges();
   if(!hasContract(root)){restore();rootObserver.observe(root,{attributes:true,attributeFilter:attributes});return;}
   if(!original)original=snapshot(root);
   const desired={
    'data-color-mode':media.matches?'dark':'light',
    'data-light-theme':lightThemes.has(original['data-light-theme'])?original['data-light-theme']:'light',
    'data-dark-theme':darkThemes.has(original['data-dark-theme'])?original['data-dark-theme']:'dark'
   };
   for(const name of attributes){
    if(root.getAttribute(name)!==desired[name]){root.setAttribute(name,desired[name]);written.add(name);}
    applied.set(name,desired[name]);
   }
   // Our own writes cannot schedule another pass. Site mutations are coalesced
   // to one animation frame; steady pages have no timer or document scan.
   rootObserver.observe(root,{attributes:true,attributeFilter:attributes});
  }
  function schedule(){if(!disposed&&!suspended&&enabled&&!frame)frame=window.requestAnimationFrame(refresh);}
  const rootObserver=new window.MutationObserver(schedule),documentObserver=new window.MutationObserver(schedule);
  const hide=()=>{suspended=true;refresh();};
  const show=()=>{suspended=false;refresh();};
  media.addEventListener('change',refresh);
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
  document.addEventListener('DOMContentLoaded',refresh);
  return{
   setEnabled(value){if(typeof value!=='boolean')throw Error('Invalid website theme preference');enabled=value;refresh();return enabled;},
   state:()=>({enabled,active:!!original,theme:media.matches?'dark':'light',supported:supported()}),
   dispose(){if(disposed)return;disposed=true;refresh();media.removeEventListener('change',refresh);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);document.removeEventListener('DOMContentLoaded',refresh);}
  };
 }
 function listen({document,window,readState,subscribe}){
  const controller=install({document,window});let revision=-1,disposed=false;
  const receive=value=>{if(disposed||!value||typeof value.enabled!=='boolean'||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision<revision)return;revision=value.revision;controller.setEnabled(value.enabled);};
  const unsubscribe=subscribe(receive);
  const read=()=>{Promise.resolve().then(readState).then(receive).catch(()=>{});};
  // Subscribe first: an older asynchronous startup reply cannot undo a newer
  // settings change. Re-read after BFCache resume if an IPC was suspended.
  read();window.addEventListener('pageshow',read);
  return{state:()=>({...controller.state(),revision}),dispose(){if(disposed)return;disposed=true;unsubscribe?.();window.removeEventListener('pageshow',read);controller.dispose();}};
 }
 return{isSupported,install,listen};
}

const tools=createPageThemeTools(),CHANNEL='mouse:page-theme-state',endpoints=new WeakMap();
function bundlePagePreload(source){return 'const MousePageTheme=('+createPageThemeTools.toString()+')();\n'+source;}

function endpoint(ipcMain){
 let value=endpoints.get(ipcMain);if(value)return value;
 value={pages:new Map(),owners:new Set()};
 ipcMain.handle(CHANNEL,event=>{
  const record=value.pages.get(event.sender?.id);
  if(!record||record.wc!==event.sender||event.senderFrame!==record.wc.mainFrame||record.wc.isDestroyed()||!tools.isSupported(event.senderFrame?.url))throw Error('Website theme is only available to its registered main page');
  return record.state();
 });
 endpoints.set(ipcMain,value);return value;
}
function install(browser,{ipcMain,enabled=true,report=()=>{}}={}){
 if(browser.mousePageTheme)return browser.mousePageTheme;
 if(!ipcMain||typeof ipcMain.handle!=='function')throw Error('Website theme requires main IPC');
 if(typeof enabled!=='boolean')throw Error('Invalid website theme preference');
 const registry=endpoint(ipcMain),records=new Map();let revision=0,disposed=false;
 const owner={};registry.owners.add(owner);
 const state=()=>({enabled,revision});
 function send(record){
  if(disposed||browser.disposed||record.wc.isDestroyed()||!tools.isSupported(record.wc.getURL()))return;
  try{record.wc.send(CHANNEL,state());}catch{report('PAGE_THEME_FAILED');}
 }
 function attach(page){
  const wc=page.view?.webContents;if(!wc||page.managedExtension||records.has(wc.id))return page;
  const record={wc,state,listeners:[]};records.set(wc.id,record);registry.pages.set(wc.id,record);
  const on=(name,listener)=>{wc.on(name,listener);record.listeners.push([name,listener]);};
  for(const name of ['dom-ready','did-navigate','did-navigate-in-page'])on(name,()=>send(record));
  on('destroyed',()=>{records.delete(wc.id);if(registry.pages.get(wc.id)===record)registry.pages.delete(wc.id);});
  return page;
 }
 const make=browser.make.bind(browser);browser.make=(...args)=>attach(make(...args));
 for(const page of [...browser.tabs.values(),...browser.providers.values()])attach(page);
 const dispose=browser.dispose.bind(browser);browser.dispose=(...args)=>{
  if(!disposed){
   disposed=true;
   for(const record of records.values()){for(const [name,listener]of record.listeners)record.wc.removeListener(name,listener);if(registry.pages.get(record.wc.id)===record)registry.pages.delete(record.wc.id);}
   records.clear();registry.owners.delete(owner);
   if(!registry.owners.size){ipcMain.removeHandler(CHANNEL);endpoints.delete(ipcMain);}
  }
  return dispose(...args);
 };
 browser.mousePageTheme={get enabled(){return enabled;},state,setEnabled(value){if(typeof value!=='boolean')throw Error('Invalid website theme preference');if(value!==enabled){enabled=value;revision++;}for(const record of records.values())send(record);return state();}};
 return browser.mousePageTheme;
}
module.exports={createPageThemeTools,bundlePagePreload,install,CHANNEL};
