'use strict';

// The native preference reaches every webpage through prefers-color-scheme.
// Explicit themes are adapted only through a documented root contract or both
// light/dark selectors in the page's readable CSS. No account, cookie, storage,
// network response, image, or page-callable bridge is changed.
// https://primer.style/product/primitives/#theming
// https://getbootstrap.com/docs/5.3/customize/color-modes/
function createPageThemeTools(){
 const primerAttributes=['data-color-mode','data-light-theme','data-dark-theme'];
 const genericAttributes=['data-theme','data-bs-theme','data-color-mode','data-color-scheme','color-mode','theme'];
 const attributes=[...new Set([...primerAttributes,...genericAttributes,'class'])];
 const lightThemes=new Set(['light','light_tritanopia','light_high_contrast','light_colorblind']);
 const darkThemes=new Set(['dark','dark_colorblind','dark_dimmed','dark_high_contrast','dark_tritanopia']);
 const stateValue=value=>['auto','system','light','dark'].includes(value);
 function isSupported(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}
 }
 function isPrimer(value){try{return new URL(value).origin==='https://github.com';}catch{return false;}}
 // Only a leading root theme selector is evidence. A component's dark/light
 // attributes, :not(.dark), or dark-looking class names do not opt in the page.
 function cssContracts(document){
  const found=new Map(),seen=new Set();let remaining=6000,characters=262144;
  const add=(key,value)=>{if(!found.has(key))found.set(key,new Set());found.get(key).add(value);};
  function rules(owner,depth=0){
   if(!owner||seen.has(owner)||depth>5||remaining<=0||owner.disabled)return;
   seen.add(owner);let list;try{list=owner.cssRules;}catch{return;}
   if(!list)return;
   for(const rule of list){
    if(--remaining<0)return;
    if(typeof rule.selectorText==='string'&&characters>0){
     const selectors=rule.selectorText.slice(0,Math.min(characters,4096));characters-=selectors.length;
     for(const selector of selectors.split(',')){
      const text=selector.trim();
      const attr=/^(?:html|:root)?\[\s*(data-theme|data-bs-theme|data-color-mode|data-color-scheme|color-mode|theme)\s*=\s*(["']?)(light|dark)\2\s*\](?=$|[\s>+~])/.exec(text);
      if(attr)add(attr[1],attr[3]);
      const cls=/^(?:html|:root)?\.(light|dark)(?=$|[\s>+~])/.exec(text);
      if(cls)add('class',cls[1]);
     }
    }
    if(rule.styleSheet)rules(rule.styleSheet,depth+1);
    else if(rule.cssRules)rules(rule,depth+1);
   }
  }
  for(const sheet of Array.from(document.styleSheets||[]).slice(0,64))rules(sheet);
  for(const sheet of Array.from(document.adoptedStyleSheets||[]).slice(0,64))rules(sheet);
  return found;
 }
 const tokens=node=>(node.getAttribute('class')||'').split(/\s+/).filter(Boolean);
 const themeTokens=node=>tokens(node).filter(value=>value==='light'||value==='dark');
 const equalTokens=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function writeThemeTokens(node,value){
  const next=[...tokens(node).filter(token=>token!=='light'&&token!=='dark'),...value].join(' ');
  if(next)node.setAttribute('class',next);else node.removeAttribute('class');
 }
 function install({document,window}){
  let enabled=false,suspended=false,disposed=false,root=null,original=null,frame=0,head=null,contracts=null;
  let originalClass=null,appliedClass=null,classWritten=false;
  const applied=new Map(),written=new Set();
  const supported=()=>isSupported(window.location?.href||document.URL);
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const hasPrimer=node=>node&&['auto','light','dark'].includes(node.getAttribute('data-color-mode'))&&node.hasAttribute('data-light-theme')&&node.hasAttribute('data-dark-theme');
  function rememberSiteChanges(){
   if(!root||!original)return;
   for(const name of Object.keys(original)){const value=root.getAttribute(name);if(!applied.has(name)||value!==applied.get(name))original[name]=value;}
   if(originalClass&&!equalTokens(themeTokens(root),appliedClass))originalClass=themeTokens(root);
  }
  function restore(){
   rootObserver.disconnect();rememberSiteChanges();
   if(root&&original)for(const name of written){
    if(root.getAttribute(name)!==applied.get(name)||root.getAttribute(name)===original[name])continue;
    if(original[name]===null)root.removeAttribute(name);else root.setAttribute(name,original[name]);
   }
   if(root&&classWritten&&equalTokens(themeTokens(root),appliedClass))writeThemeTokens(root,originalClass||[]);
   original=null;originalClass=null;appliedClass=null;classWritten=false;applied.clear();written.clear();
  }
  function desiredTheme(){
   const value=media.matches?'dark':'light';
   if(isPrimer(window.location?.href||document.URL)&&hasPrimer(root))return{
    attributes:{'data-color-mode':value,'data-light-theme':lightThemes.has(original?.['data-light-theme']??root.getAttribute('data-light-theme'))?(original?.['data-light-theme']??root.getAttribute('data-light-theme')):'light',
     'data-dark-theme':darkThemes.has(original?.['data-dark-theme']??root.getAttribute('data-dark-theme'))?(original?.['data-dark-theme']??root.getAttribute('data-dark-theme')):'dark'},classes:null};
   if(!genericAttributes.some(name=>stateValue(root.getAttribute(name)))&&!originalClass&&!themeTokens(root).length)return{attributes:{},classes:null};
   if(!contracts)contracts=cssContracts(document);
   const desired={};
   for(const name of genericAttributes){
    if(!stateValue(root.getAttribute(name)))continue;
    const proof=contracts.get(name);
    // Bootstrap publishes this attribute contract. Require its actual root
    // color variables too, including when a CDN stylesheet hides cssRules.
    let bootstrap=false;
    if(name==='data-bs-theme'&&typeof window.getComputedStyle==='function'){
     const style=window.getComputedStyle(root);bootstrap=!!(style.getPropertyValue('--bs-body-bg').trim()&&style.getPropertyValue('--bs-body-color').trim());
    }
    if(bootstrap||(proof?.has('light')&&proof?.has('dark')))desired[name]=value;
   }
   const proof=contracts.get('class'),classes=proof?.has('light')&&proof?.has('dark')&&(originalClass||themeTokens(root).length)?[value]:null;
   return{attributes:desired,classes};
  }
  function cancelFrame(){if(frame){window.cancelAnimationFrame(frame);frame=0;}}
  function refresh(){
   cancelFrame();
   if(disposed||suspended||!enabled||!supported()){
    documentObserver.disconnect();styleObserver.disconnect();head=null;restore();root=null;contracts=null;return;
   }
   documentObserver.observe(document,{childList:true});
   const current=document.documentElement;
   if(current!==root){restore();root=current;contracts=null;}
   if(!root)return;
   if(document.head!==head){styleObserver.disconnect();head=document.head;contracts=null;if(head)styleObserver.observe(head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','media','disabled']});}
   rootObserver.disconnect();rememberSiteChanges();
   const desired=desiredTheme(),names=Object.keys(desired.attributes);
   if(!names.length&&!desired.classes){restore();rootObserver.observe(root,{attributes:true,attributeFilter:attributes});return;}
   if(!original)original={};
   // A site may remove a contract or load a different stylesheet during an SPA
   // transition. Restore only still-owned writes before dropping that contract.
   for(const name of Object.keys(original))if(!names.includes(name)){
    if(written.has(name)&&root.getAttribute(name)===applied.get(name)){if(original[name]===null)root.removeAttribute(name);else root.setAttribute(name,original[name]);}
    delete original[name];applied.delete(name);written.delete(name);
   }
   for(const name of names){
    if(!Object.hasOwn(original,name))original[name]=root.getAttribute(name);
    if(root.getAttribute(name)!==desired.attributes[name]){root.setAttribute(name,desired.attributes[name]);written.add(name);}
    applied.set(name,desired.attributes[name]);
   }
   if(desired.classes){
    if(!originalClass)originalClass=themeTokens(root);
    if(!equalTokens(themeTokens(root),desired.classes)){writeThemeTokens(root,desired.classes);classWritten=true;}
    appliedClass=desired.classes;
   }else if(originalClass){
    if(classWritten&&equalTokens(themeTokens(root),appliedClass))writeThemeTokens(root,originalClass);
    originalClass=null;appliedClass=null;classWritten=false;
   }
   rootObserver.observe(root,{attributes:true,attributeFilter:attributes});
  }
  function schedule(){if(!disposed&&!suspended&&enabled&&!frame)frame=window.requestAnimationFrame(refresh);}
  const rootObserver=new window.MutationObserver(schedule),documentObserver=new window.MutationObserver(schedule);
  const styleChanged=()=>{contracts=null;schedule();};
  const styleObserver=new window.MutationObserver(styleChanged);
  const reloadStyles=()=>{contracts=null;refresh();};
  const hide=()=>{suspended=true;refresh();};
  const show=()=>{suspended=false;reloadStyles();};
  media.addEventListener('change',reloadStyles);
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);window.addEventListener('load',reloadStyles);
  document.addEventListener('DOMContentLoaded',reloadStyles);document.addEventListener('load',styleChanged,true);
  return{
   setEnabled(value){if(typeof value!=='boolean')throw Error('Invalid website theme preference');enabled=value;refresh();return enabled;},
   state:()=>({enabled,active:!!original,theme:media.matches?'dark':'light',supported:supported()}),
   dispose(){if(disposed)return;disposed=true;refresh();media.removeEventListener('change',reloadStyles);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);window.removeEventListener('load',reloadStyles);document.removeEventListener('DOMContentLoaded',reloadStyles);document.removeEventListener('load',styleChanged,true);}
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
