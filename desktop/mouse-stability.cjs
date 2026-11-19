'use strict';
// Mouse-only lifecycle repair. Never install a blanket uncaughtException handler.
function installWorkspace(browser,{report=()=>{}}={}){
 if(browser.mouseSafety)return browser.mouseSafety;
 browser.mouseCoalescePageState=true;
 const gone=t=>!t?.view?.webContents||t.view.webContents.isDestroyed();
 const unlink=t=>{for(const [id,page] of browser.tabs)if(page===t)browser.tabs.delete(id);for(const [id,page] of browser.providers)if(page===t)browser.providers.delete(id);browser.layoutPages?.delete(t);if(browser.ai===t){browser.ai=null;browser.provider='';}if(!browser.tabs.has(t.id)&&![...browser.providers.values()].some(page=>page.id===t.id))browser.panels=browser.panels.filter(p=>p.id!==t.id);};
 function detach(t){if(browser.win.isDestroyed())return;try{const root=t.clipView||t.view;if(browser.win.contentView.children.includes(root))browser.win.contentView.removeChildView(root);if(t.clipView?.children.includes(t.view))t.clipView.removeChildView(t.view);}catch{report('VIEW_DETACH_FAILED');}}
 const forget=t=>{unlink(t);detach(t);},watched=new WeakSet();
 function watch(t){if(watched.has(t)||gone(t))return;watched.add(t);const wc=t.view.webContents;wc.once('destroyed',()=>{forget(t);if(!browser.disposed&&!browser.win.isDestroyed()){browser.emit();void browser.save();}});wc.on('render-process-gone',(_event,detail)=>{t.loading=false;report('PAGE_RENDERER_STOPPED '+String(detail.reason||'unknown'));});}
 function prune(){let removed=0;for(const t of [...browser.tabs.values(),...browser.providers.values()]){if(gone(t)){forget(t);removed++;}else watch(t);}return removed;}
 // Destruction events handle the normal path. Keep a bounded defensive retry
 // for stale native handles without polling every hidden page on every layout
 // and every metadata snapshot. Unrelated exceptions are never swallowed.
 for(const name of ['state','save','layout']){const old=browser[name].bind(browser);browser[name]=(...args)=>{try{return old(...args);}catch(error){if(!prune())throw error;return old(...args);}};}
 const oldMake=browser.make.bind(browser);
 browser.make=(...args)=>{const t=oldMake(...args);watch(t);return t;};
 browser.destroy=t=>{if(!t)return;unlink(t);detach(t);if(!gone(t))t.view.webContents.close({waitForBeforeUnload:false});};
 browser.dispose=()=>{if(browser.disposed)return;browser.disposed=true;clearTimeout(browser.pageStateTimer);browser.pageStateTimer=null;const pages=[...new Set([...browser.tabs.values(),...browser.providers.values()])];browser.tabs.clear();browser.providers.clear();browser.layoutPages?.clear();browser.ai=null;browser.provider='';browser.panels=[];for(const t of pages){detach(t);if(!gone(t))t.view.webContents.close({waitForBeforeUnload:false});}};
 prune();return browser.mouseSafety={prune,forget};
}
function installShellRecovery({win,entry,current,isClosing,report=()=>{}}){
 let recovering=false,last=0,disposed=false;
 async function recover(_event,detail){
  if(disposed||win.isDestroyed()||isClosing()||detail.reason==='clean-exit')return;
  report('SHELL_RENDERER_STOPPED '+String(detail.reason||'unknown'));
  if(recovering||Date.now()-last<60000){report('SHELL_RECOVERY_LIMIT');return;}
  last=Date.now();recovering=true;
  try{const {browser,gate}=current();if(!browser||browser.disposed)return;await browser.save();await browser.saveQueue;if(gate){gate.blocked=true;gate.hide();gate.sequence=0;gate.desired=[];gate.blocked=false;}if(!win.isDestroyed()&&!isClosing()){await win.loadURL(entry);report('SHELL_RECOVERY_LOADED');}}
  catch{report('SHELL_RECOVERY_FAILED');}finally{recovering=false;}
 }
 win.webContents.on('render-process-gone',recover);win.once('closed',()=>{disposed=true;});return{recover};
}
module.exports={installWorkspace,installShellRecovery};
